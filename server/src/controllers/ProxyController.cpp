#include "ProxyController.hpp"
#include <drogon/HttpClient.h>
#include <functional>
#include <vector>
#include <string>

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
        "range", "cache-control"
    };

    std::map<std::string, std::string> forwardHeaders;
    for (const auto& key : whitelist) {
        std::string val = req->getHeader(key);
        if (!val.empty()) forwardHeaders[key] = val;
    }

    // Ensure a reasonable User-Agent
    if (forwardHeaders.find("user-agent") == forwardHeaders.end()) {
        forwardHeaders["user-agent"] = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";
    }

    // Helper to forward the response back to the browser
    auto forwardResponse = [callback, target_url](const drogon::HttpResponsePtr& resp) {
        if (!resp) {
            auto err = drogon::HttpResponse::newHttpResponse();
            err->setStatusCode(drogon::k502BadGateway);
            err->setBody("No response from upstream");
            err->addHeader("Access-Control-Allow-Origin", "*");
            callback(err);
            return;
        }

        auto proxyResp = drogon::HttpResponse::newHttpResponse();
        proxyResp->setStatusCode(resp->statusCode());
        proxyResp->setBody(std::string(resp->body()));
        
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

    // Recursive fetch implementation
    struct Fetcher : std::enable_shared_from_this<Fetcher> {
        std::function<void(const drogon::HttpResponsePtr&)> callback;
        std::function<void(const drogon::HttpResponsePtr&)> forwarder;
        std::map<std::string, std::string> headers;

        void perform(std::string url, int depth) {
            if (depth <= 0) {
                auto err = drogon::HttpResponse::newHttpResponse();
                err->setStatusCode(drogon::k502BadGateway);
                err->setBody("Too many redirects");
                callback(err);
                return;
            }

            auto client = drogon::HttpClient::newHttpClient(url);
            auto req = drogon::HttpRequest::newHttpRequest();
            req->setMethod(drogon::Get);
            // newHttpClient(url) extracts the path automatically, but we need to set it for the request
            // Actually, drogon's newHttpClient(url) is a factory, the request still needs a path.
            
            size_t proto_pos = url.find("://");
            if (proto_pos == std::string::npos) {
                auto err = drogon::HttpResponse::newHttpResponse();
                err->setStatusCode(drogon::k400BadRequest);
                err->setBody("Invalid URL");
                callback(err);
                return;
            }
            size_t path_pos = url.find("/", proto_pos + 3);
            std::string path = (path_pos == std::string::npos) ? "/" : url.substr(path_pos);
            req->setPath(path);

            for (const auto& h : headers) req->addHeader(h.first, h.second);

            auto self = shared_from_this();
            client->sendRequest(req, [self, url, depth](drogon::ReqResult result, const drogon::HttpResponsePtr& response) {
                if (result != drogon::ReqResult::Ok || !response) {
                    auto err = drogon::HttpResponse::newHttpResponse();
                    err->setStatusCode(drogon::k502BadGateway);
                    err->setBody("Proxy failed for " + url + " (Result: " + std::to_string((int)result) + ")");
                    self->callback(err);
                    return;
                }

                if (response->statusCode() == 301 || response->statusCode() == 302 || 
                    response->statusCode() == 307 || response->statusCode() == 308) {
                    std::string loc = response->getHeader("Location");
                    if (!loc.empty()) {
                        // Handle relative redirects
                        if (loc.find("://") == std::string::npos) {
                            size_t proto_pos = url.find("://");
                            size_t host_end = url.find("/", proto_pos + 3);
                            std::string base = (host_end == std::string::npos) ? url : url.substr(0, host_end);
                            if (loc[0] == '/') loc = base + loc;
                            else loc = base + "/" + loc;
                        }
                        self->perform(loc, depth - 1);
                        return;
                    }
                }
                self->forwarder(response);
            });
        }
    };

    auto fetcher = std::make_shared<Fetcher>();
    fetcher->callback = callback;
    fetcher->forwarder = forwardResponse;
    fetcher->headers = forwardHeaders;
    fetcher->perform(target_url, 5);
}
