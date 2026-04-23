#pragma once
#include <drogon/HttpController.h>

class OembedController : public drogon::HttpController<OembedController> {
  public:
    METHOD_LIST_BEGIN
        ADD_METHOD_TO(OembedController::getOembed, "/oembed", drogon::Get);
    METHOD_LIST_END

    void getOembed(const drogon::HttpRequestPtr& req, std::function<void(const drogon::HttpResponsePtr&)>&& callback);
};
