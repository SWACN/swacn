#pragma once
#include <drogon/HttpController.h>

class AuthController : public drogon::HttpController<AuthController> {
  public:
    METHOD_LIST_BEGIN
        ADD_METHOD_TO(AuthController::login, "/auth/github/login", drogon::Get);
        ADD_METHOD_TO(AuthController::callback, "/auth/github/callback", drogon::Get);
    METHOD_LIST_END

    void login(const drogon::HttpRequestPtr& req, std::function<void(const drogon::HttpResponsePtr&)>&& callback);
    void callback(const drogon::HttpRequestPtr& req, std::function<void(const drogon::HttpResponsePtr&)>&& callback);

  private:
    std::string generateApiKey();
};