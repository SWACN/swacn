#include "ProxyController.hpp"
#include <drogon/HttpClient.h>

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

        auto proxyResp = drogon::HttpResponse::newHttpResponse();
        proxyResp->setStatusCode(response->statusCode());
        proxyResp->setBody(std::string(response->body()));
        proxyResp->setContentTypeCode(response->contentType());
        
        for (auto const& [key, value] : response->headers()) {
            if (key != "Access-Control-Allow-Origin" && key != "access-control-allow-origin" && 
                key != "Transfer-Encoding" && key != "transfer-encoding") {
                proxyResp->addHeader(key, value);
            }
        }
        
        proxyResp->addHeader("Access-Control-Allow-Origin", "*");
        callback(proxyResp);
    });
}
