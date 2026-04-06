#pragma once
#include <drogon/HttpController.h>

class CastController : public drogon::HttpController<CastController> {
  public:
    METHOD_LIST_BEGIN
        ADD_METHOD_TO(CastController::uploadCast, "/v1/casts/upload", drogon::Post);
        ADD_METHOD_TO(CastController::listCasts, "/v1/casts", drogon::Get); // NEW
    METHOD_LIST_END

    void listCasts(const drogon::HttpRequestPtr& req, std::function<void(const drogon::HttpResponsePtr&)>&& callback);
    void uploadCast(const drogon::HttpRequestPtr& req, std::function<void(const drogon::HttpResponsePtr&)>&& callback);
};