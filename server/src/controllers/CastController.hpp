#pragma once
#include <drogon/HttpController.h>

class CastController : public drogon::HttpController<CastController> {
  public:
    METHOD_LIST_BEGIN
        ADD_METHOD_TO(CastController::uploadCast, "/v1/casts/upload", drogon::Post);
        ADD_METHOD_TO(CastController::listCasts, "/v1/casts", drogon::Get); // NEW
        ADD_METHOD_TO(CastController::getCast, "/v1/casts/{id}", drogon::Get);
        ADD_METHOD_TO(CastController::updateCastSettings, "/v1/casts/{id}/settings", drogon::Patch);
        ADD_METHOD_TO(CastController::deleteCast, "/v1/casts/{id}", drogon::Delete);
    METHOD_LIST_END

    void listCasts(const drogon::HttpRequestPtr& req, std::function<void(const drogon::HttpResponsePtr&)>&& callback);
    void uploadCast(const drogon::HttpRequestPtr& req, std::function<void(const drogon::HttpResponsePtr&)>&& callback);
    void getCast(const drogon::HttpRequestPtr& req, std::function<void(const drogon::HttpResponsePtr&)>&& callback, std::string id);
    void updateCastSettings(const drogon::HttpRequestPtr& req, std::function<void(const drogon::HttpResponsePtr&)>&& callback, std::string id);
    void deleteCast(const drogon::HttpRequestPtr& req, std::function<void(const drogon::HttpResponsePtr&)>&& callback, std::string id);
};