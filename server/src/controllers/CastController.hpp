#pragma once
#include <drogon/HttpController.h>

class CastController : public drogon::HttpController<CastController> {
  public:
    METHOD_LIST_BEGIN
        ADD_METHOD_TO(CastController::uploadCast, "/v1/casts/upload", drogon::Post);
    METHOD_LIST_END

    void uploadCast(const drogon::HttpRequestPtr& req, std::function<void(const drogon::HttpResponsePtr&)>&& callback);
};