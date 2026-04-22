#pragma once
#include <drogon/HttpController.h>

class ProxyController : public drogon::HttpController<ProxyController> {
  public:
    METHOD_LIST_BEGIN
        ADD_METHOD_TO(ProxyController::fetchUrl, "/v1/proxy", drogon::Get);
    METHOD_LIST_END

    void fetchUrl(const drogon::HttpRequestPtr& req, std::function<void(const drogon::HttpResponsePtr&)>&& callback);
};
