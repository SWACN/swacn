#pragma once
#include <drogon/HttpController.h>

class AuthController : public drogon::HttpController<AuthController> {
  public:
    METHOD_LIST_BEGIN
      ADD_METHOD_TO(AuthController::login, "/auth/github/login", drogon::Get);
      ADD_METHOD_TO(AuthController::callback, "/auth/github/callback", drogon::Get);
      ADD_METHOD_TO(AuthController::loginGoogle, "/auth/google/login", drogon::Get);
      ADD_METHOD_TO(AuthController::callbackGoogle, "/auth/google/callback", drogon::Get);
      ADD_METHOD_TO(AuthController::getMe, "/v1/users/me", drogon::Get);
      ADD_METHOD_TO(AuthController::pollHandshake, "/auth/poll", drogon::Get);
    METHOD_LIST_END

    void getMe(const drogon::HttpRequestPtr& req, std::function<void(const drogon::HttpResponsePtr&)>&& callback);
    void pollHandshake(const drogon::HttpRequestPtr& req, std::function<void(const drogon::HttpResponsePtr&)>&& callback);

    void login(const drogon::HttpRequestPtr& req, std::function<void(const drogon::HttpResponsePtr&)>&& callback);
    void callback(const drogon::HttpRequestPtr& req, std::function<void(const drogon::HttpResponsePtr&)>&& callback);

    void loginGoogle(const drogon::HttpRequestPtr& req, std::function<void(const drogon::HttpResponsePtr&)>&& callback);
    void callbackGoogle(const drogon::HttpRequestPtr& req, std::function<void(const drogon::HttpResponsePtr&)>&& callback);

  private:
    std::string generateApiKey();
};