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

    size_t protocol_pos = target_url.find("://");
    if (protocol_pos == std::string::npos) {
        auto resp = drogon::HttpResponse::newHttpResponse();
        resp->setStatusCode(drogon::k400BadRequest);
        resp->setBody("Invalid URL format");
        resp->addHeader("Access-Control-Allow-Origin", "*");
        callback(resp);
        return;
    }

    size_t path_pos = target_url.find("/", protocol_pos + 3);
    std::string base_url = (path_pos == std::string::npos) ? target_url : target_url.substr(0, path_pos);
    std::string path = (path_pos == std::string::npos) ? "/" : target_url.substr(path_pos);

    std::string ua = req->getHeader("User-Agent");
    if (ua.empty()) ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";
    std::string accept = req->getHeader("Accept");
    if (accept.empty()) accept = "*/*";

    auto handleResponse = [callback](const drogon::HttpResponsePtr& resp) {
        auto proxyResp = drogon::HttpResponse::newHttpResponse();
        proxyResp->setStatusCode(resp->statusCode());
        proxyResp->setBody(std::string(resp->body()));
        proxyResp->setContentTypeCode(resp->contentType());
        proxyResp->addHeader("Access-Control-Allow-Origin", "*");
        proxyResp->addHeader("Cross-Origin-Resource-Policy", "cross-origin");
        callback(proxyResp);
    };

    // Recursive fetch function to handle multiple redirects
    auto performFetch = std::make_shared<std::function<void(std::string, int)>>();
    *performFetch = [callback, handleResponse, ua, accept, performFetch](std::string url, int depth) {
        if (depth <= 0) {
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

        auto client = drogon::HttpClient::newHttpClient(b_url);
        auto req = drogon::HttpRequest::newHttpRequest();
        req->setPath(p);
        req->setMethod(drogon::Get);
        req->addHeader("User-Agent", ua);
        req->addHeader("Accept", accept);

        client->sendRequest(req, [callback, handleResponse, url, depth, performFetch](drogon::ReqResult result, const drogon::HttpResponsePtr& response) {
            if (result != drogon::ReqResult::Ok || !response) {
                auto errorResp = drogon::HttpResponse::newHttpResponse();
                errorResp->setStatusCode(drogon::k502BadGateway);
                errorResp->setBody("Proxy request failed for: " + url);
                callback(errorResp);
                return;
            }

            if (response->statusCode() == drogon::k302Found || response->statusCode() == drogon::k301MovedPermanently || 
                response->statusCode() == drogon::k307TemporaryRedirect || response->statusCode() == drogon::k308PermanentRedirect) {
                std::string location = response->getHeader("Location");
                if (!location.empty()) {
                    (*performFetch)(location, depth - 1);
                    return;
                }
            }

            handleResponse(response);
        });
    };

    (*performFetch)(target_url, 5);
}
