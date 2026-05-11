#include "ProxyController.hpp"
#include <drogon/HttpClient.h>
#include <functional>
#include <cctype>

void ProxyController::fetchUrl(const drogon::HttpRequestPtr& req, std::function<void(const drogon::HttpResponsePtr&)>&& callback) {
    std::string target_url = req->getParameter("url");
    if (target_url.empty()) {
        auto resp = drogon::HttpResponse::newHttpResponse();
        resp->setStatusCode(drogon::k400BadRequest);
        resp->setBody("Missing url parameter");
        resp->addHeader("Access-Control-Allow-Origin", "*");
        callback(resp);
        return;
    }

    // Whitelist of headers to forward to the destination
    static const std::vector<std::string> whitelist = {
        "user-agent", "accept", "accept-language", "accept-encoding",
        "range", "if-modified-since", "if-none-match", "cache-control"
    };

    std::map<std::string, std::string> forwardHeaders;
    for (const auto& key : whitelist) {
        std::string val = req->getHeader(key);
        if (!val.empty()) {
            forwardHeaders[key] = val;
        }
    }

    // Ensure we have a reasonable User-Agent if none provided
    if (forwardHeaders.find("user-agent") == forwardHeaders.end()) {
        forwardHeaders["user-agent"] = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";
    }

    LOG_INFO << "[Proxy] Request: " << target_url << " from " << req->getPeerAddr().toIp();

    auto handleResponse = [callback, target_url](const drogon::HttpResponsePtr& resp) {
        LOG_INFO << "[Proxy] Response: " << resp->statusCode() << " for " << target_url;
        auto proxyResp = drogon::HttpResponse::newHttpResponse();
        proxyResp->setStatusCode(resp->statusCode());
        proxyResp->setBody(std::string(resp->body()));
        
        // Forward essential headers back to the browser
        static const std::vector<std::string> respWhitelist = {
            "content-type", "content-encoding", "content-length",
            "cache-control", "expires", "etag", "last-modified", "accept-ranges"
        };
        for (const auto& h : respWhitelist) {
            std::string val = resp->getHeader(h);
            if (!val.empty()) proxyResp->addHeader(h, val);
        }

        proxyResp->addHeader("Access-Control-Allow-Origin", "*");
        proxyResp->addHeader("Cross-Origin-Resource-Policy", "cross-origin");
        callback(proxyResp);
    };

    // Recursive fetch function to handle multiple redirects
    auto performFetch = std::make_shared<std::function<void(std::string, int)>>();
    *performFetch = [callback, handleResponse, forwardHeaders, performFetch](std::string url, int depth) {
        if (depth <= 0) {
            LOG_ERROR << "[Proxy] Too many redirects for: " << url;
            auto errorResp = drogon::HttpResponse::newHttpResponse();
            errorResp->setStatusCode(drogon::k502BadGateway);
            errorResp->setBody("Too many redirects");
            callback(errorResp);
            return;
        }

        size_t proto_pos = url.find("://");
        if (proto_pos == std::string::npos) {
            auto errorResp = drogon::HttpResponse::newHttpResponse();
            errorResp->setStatusCode(drogon::k400BadRequest);
            errorResp->setBody("Invalid URL format in redirect");
            callback(errorResp);
            return;
        }

        size_t p_pos = url.find("/", proto_pos + 3);
        std::string b_url = (p_pos == std::string::npos) ? url : url.substr(0, p_pos);
        std::string p = (p_pos == std::string::npos) ? "/" : url.substr(p_pos);

        // Disable cert validation via the 4th argument of newHttpClient
        auto client = drogon::HttpClient::newHttpClient(b_url, nullptr, false, false);
        auto req = drogon::HttpRequest::newHttpRequest();
        req->setPath(p);
        req->setMethod(drogon::Get);
        
        for (const auto& header : forwardHeaders) {
            req->addHeader(header.first, header.second);
        }

        client->sendRequest(req, [callback, handleResponse, url, depth, performFetch](drogon::ReqResult result, const drogon::HttpResponsePtr& response) {
            if (result != drogon::ReqResult::Ok || !response) {
                LOG_ERROR << "[Proxy] Request failed: " << (int)result << " for " << url;
                auto errorResp = drogon::HttpResponse::newHttpResponse();
                errorResp->setStatusCode(drogon::k502BadGateway);
                errorResp->setBody("Proxy request failed for: " + url + " (Result: " + std::to_string((int)result) + ")");
                callback(errorResp);
                return;
            }

            if (response->statusCode() == drogon::k302Found || response->statusCode() == drogon::k301MovedPermanently || 
                response->statusCode() == drogon::k307TemporaryRedirect || response->statusCode() == drogon::k308PermanentRedirect) {
                std::string location = response->getHeader("Location");
                if (!location.empty()) {
                    LOG_INFO << "[Proxy] Redirecting to: " << location;
                    (*performFetch)(location, depth - 1);
                    return;
                }
            }

            handleResponse(response);
        });
    };

    (*performFetch)(target_url, 5);
}
