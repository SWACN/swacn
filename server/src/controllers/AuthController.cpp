#include "AuthController.hpp"
#include <drogon/HttpClient.h>
#include <drogon/utils/Utilities.h>
#include <uuid/uuid.h> // Requires libuuid
#include <map>
#include <mutex>

static std::map<std::string, std::string> g_handshake_tokens;
static std::mutex g_handshake_mutex;

std::string AuthController::generateApiKey() {
    return "swacn_" + drogon::utils::getUuid();
}

void AuthController::login(const drogon::HttpRequestPtr& req, std::function<void(const drogon::HttpResponsePtr&)>&& callback) {
    std::string client_id = getenv("GITHUB_CLIENT_ID");
    std::string is_popup = req->getParameter("popup");
    std::string handshake_id = req->getParameter("handshake_id");
    
    std::string state = "";
    if (is_popup == "true") {
        state = "popup";
        if (!handshake_id.empty()) {
            state += ":" + handshake_id;
        }
    }
    
    std::string redirect_url = "https://github.com/login/oauth/authorize?client_id=" + client_id + "&scope=read:user&state=" + state;
    
    auto resp = drogon::HttpResponse::newRedirectionResponse(redirect_url);
    callback(resp);
}

void AuthController::getMe(const drogon::HttpRequestPtr& req, std::function<void(const drogon::HttpResponsePtr&)>&& callback) {
    std::string auth_header = req->getHeader("Authorization");
    if (auth_header.empty() || auth_header.find("Bearer ") != 0) {
        auto resp = drogon::HttpResponse::newHttpResponse();
        resp->setStatusCode(drogon::k401Unauthorized);
        callback(resp);
        return;
    }
    
    std::string api_key = auth_header.substr(7);
    auto dbClient = drogon::app().getDbClient();
    
    dbClient->execSqlAsync(
        "SELECT username, email FROM users WHERE api_key = $1",
        [callback](const drogon::orm::Result& r) {
            if (r.empty()) {
                auto resp = drogon::HttpResponse::newHttpResponse();
                resp->setStatusCode(drogon::k401Unauthorized);
                callback(resp);
                return;
            }
            
            Json::Value ret;
            ret["username"] = r[0]["username"].as<std::string>();
            ret["email"] = r[0]["email"].isNull() ? "" : r[0]["email"].as<std::string>();
            
            auto resp = drogon::HttpResponse::newHttpJsonResponse(ret);
            callback(resp);
        },
        [callback](const drogon::orm::DrogonDbException& e) {
            auto resp = drogon::HttpResponse::newHttpResponse();
            resp->setStatusCode(drogon::k500InternalServerError);
            callback(resp);
        },
        api_key
    );
}

void AuthController::callback(const drogon::HttpRequestPtr& req, std::function<void(const drogon::HttpResponsePtr&)>&& callback) {
    auto code = req->getParameter("code");
    if (code.empty()) {
        auto resp = drogon::HttpResponse::newHttpResponse();
        resp->setStatusCode(drogon::k400BadRequest);
        resp->setBody("Missing code parameter");
        callback(resp);
        return;
    }

    // 1. Exchange code for access token using Drogon's async HTTP client
    auto client = drogon::HttpClient::newHttpClient("https://github.com");
    auto token_req = drogon::HttpRequest::newHttpRequest();
    token_req->setPath("/login/oauth/access_token");
    token_req->setMethod(drogon::Post);
    token_req->setParameter("client_id", getenv("GITHUB_CLIENT_ID"));
    token_req->setParameter("client_secret", getenv("GITHUB_CLIENT_SECRET"));
    token_req->setParameter("code", code);
    token_req->addHeader("Accept", "application/json");

    client->sendRequest(token_req, [this, callback, req](drogon::ReqResult result, const drogon::HttpResponsePtr& response) {
        if (result != drogon::ReqResult::Ok || !response->getJsonObject()) {
            auto resp = drogon::HttpResponse::newHttpResponse();
            resp->setStatusCode(drogon::k500InternalServerError);
            callback(resp);
            return;
        }

        auto json = *response->getJsonObject();
        std::string access_token = json["access_token"].asString();

        // 2. Fetch User Profile from GitHub API
        auto api_client = drogon::HttpClient::newHttpClient("https://api.github.com");
        auto user_req = drogon::HttpRequest::newHttpRequest();
        user_req->setPath("/user");
        user_req->setMethod(drogon::Get);
        user_req->addHeader("Authorization", "Bearer " + access_token);
        user_req->addHeader("User-Agent", "SWACN-Server"); // GitHub requires a User-Agent

        api_client->sendRequest(user_req, [this, callback, req](drogon::ReqResult res, const drogon::HttpResponsePtr& user_resp) {
            if (res != drogon::ReqResult::Ok || !user_resp->getJsonObject()) {
                auto resp = drogon::HttpResponse::newHttpResponse();
                resp->setStatusCode(drogon::k500InternalServerError);
                callback(resp);
                return;
            }

            auto user_json = *user_resp->getJsonObject();
            std::string github_id = std::to_string(user_json["id"].asInt64());
            std::string username = user_json["login"].asString();
            std::string new_api_key = generateApiKey();

            // 3. Upsert user into Database (Async)
            auto dbClient = drogon::app().getDbClient();
            dbClient->execSqlAsync(
                "INSERT INTO users (github_id, username, api_key) VALUES ($1, $2, $3) "
                "ON CONFLICT (github_id) DO UPDATE SET username = EXCLUDED.username RETURNING api_key",
                [callback, req](const drogon::orm::Result& r) {
                    std::string active_key = r[0]["api_key"].as<std::string>();
                    auto state = req->getParameter("state");
                    
                    std::string popup_param = "";
                    if (state.find("popup") == 0) {
                        popup_param = "&popup=true";
                        
                        // If there is a handshake ID, register the token
                        if (state.find(":") != std::string::npos) {
                            std::string handshake_id = state.substr(state.find(":") + 1);
                            std::lock_guard<std::mutex> lock(g_handshake_mutex);
                            g_handshake_tokens[handshake_id] = active_key;
                        }
                    }
                    
                    std::string frontend_url = getenv("APP_URL") ? std::string(getenv("APP_URL")) : "http://localhost:3000";
                    auto resp = drogon::HttpResponse::newRedirectionResponse(frontend_url + "/auth-callback?token=" + active_key + popup_param);
                    callback(resp);
                },
                [callback](const drogon::orm::DrogonDbException& e) {
                    LOG_ERROR << e.base().what();
                    auto resp = drogon::HttpResponse::newHttpResponse();
                    resp->setStatusCode(drogon::k500InternalServerError);
                    callback(resp);
                },
                github_id, username, new_api_key
            );
        });
    });
}

void AuthController::pollHandshake(const drogon::HttpRequestPtr& req, std::function<void(const drogon::HttpResponsePtr&)>&& callback) {
    auto handshake_id = req->getParameter("handshake_id");
    if (handshake_id.empty()) {
        auto resp = drogon::HttpResponse::newHttpResponse();
        resp->setStatusCode(drogon::k400BadRequest);
        callback(resp);
        return;
    }

    std::string token = "";
    {
        std::lock_guard<std::mutex> lock(g_handshake_mutex);
        if (g_handshake_tokens.count(handshake_id)) {
            token = g_handshake_tokens[handshake_id];
            g_handshake_tokens.erase(handshake_id); // Only one-time use
        }
    }

    Json::Value ret;
    ret["token"] = token;
    auto resp = drogon::HttpResponse::newHttpJsonResponse(ret);
    // Allow CORS for polling from any origin during development/testing if needed
    // But since it's /api/auth/poll on the same domain as the iframe, it should be fine.
    callback(resp);
}