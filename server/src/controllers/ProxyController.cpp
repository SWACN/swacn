#include "ProxyController.hpp"
#include <drogon/HttpClient.h>
#include <algorithm>
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

    auto client = drogon::HttpClient::newHttpClient(base_url);
    auto proxyReq = drogon::HttpRequest::newHttpRequest();
    proxyReq->setMethod(drogon::Get);
    proxyReq->setPath(path);
    proxyReq->addHeader("User-Agent", "SWACN-Proxy/1.0");

    client->sendRequest(proxyReq, [callback](drogon::ReqResult result, const drogon::HttpResponsePtr& response) {
        if (result != drogon::ReqResult::Ok || !response) {
            auto errorResp = drogon::HttpResponse::newHttpResponse();
            errorResp->setStatusCode(drogon::k502BadGateway);
            errorResp->setBody("Proxy request failed");
            errorResp->addHeader("Access-Control-Allow-Origin", "*");
            callback(errorResp);
            return;
        }

        auto handleResponse = [callback](const drogon::HttpResponsePtr& resp) {
            auto proxyResp = drogon::HttpResponse::newHttpResponse();
            proxyResp->setStatusCode(resp->statusCode());
            proxyResp->setBody(std::string(resp->body()));
            proxyResp->setContentTypeCode(resp->contentType());
            
            for (auto const& [key, value] : resp->headers()) {
                std::string k = key;
                std::transform(k.begin(), k.end(), k.begin(), ::tolower);
                if (k != "access-control-allow-origin" && k != "transfer-encoding" && k != "content-length") {
                    proxyResp->addHeader(key, value);
                }
            }
            
            proxyResp->addHeader("Access-Control-Allow-Origin", "*");
            callback(proxyResp);
        };

        // Handle Redirects (e.g. GitHub Releases)
        if (response->statusCode() == drogon::k302Found || response->statusCode() == drogon::k301MovedPermanently || response->statusCode() == drogon::k307TemporaryRedirect || response->statusCode() == drogon::k308PermanentRedirect) {
            std::string location = response->getHeader("Location");
            if (!location.empty()) {
                // Basic URL parsing for the redirect
                size_t proto_pos = location.find("://");
                if (proto_pos != std::string::npos) {
                    size_t p_pos = location.find("/", proto_pos + 3);
                    std::string b_url = (p_pos == std::string::npos) ? location : location.substr(0, p_pos);
                    std::string p = (p_pos == std::string::npos) ? "/" : location.substr(p_pos);

                    auto rClient = drogon::HttpClient::newHttpClient(b_url);
                    auto rReq = drogon::HttpRequest::newHttpRequest();
                    rReq->setPath(p);
                    rReq->setMethod(drogon::Get);
                    rReq->addHeader("User-Agent", "SWACN-Proxy/1.0");

                    rClient->sendRequest(rReq, [callback, handleResponse](drogon::ReqResult res, const drogon::HttpResponsePtr& rResp) {
                        if (res != drogon::ReqResult::Ok || !rResp) {
                            auto eResp = drogon::HttpResponse::newHttpResponse();
                            eResp->setStatusCode(drogon::k502BadGateway);
                            eResp->setBody("Proxy redirect failed");
                            eResp->addHeader("Access-Control-Allow-Origin", "*");
                            callback(eResp);
                            return;
                        }
                        handleResponse(rResp);
                    });
                    return;
                }
            }
        }

        handleResponse(response);
    });
}
