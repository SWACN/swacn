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
    
    std::string redirect_url = "https://github.com/login/oauth/authorize?client_id=" + client_id + "&scope=user:email&state=" + state;
    
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
        "SELECT username, email, (is_pro = true) as is_pro, (is_super_admin = true) as is_super_admin FROM users WHERE api_key = $1",
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
            ret["is_pro"] = r[0]["is_pro"].isNull() ? false : r[0]["is_pro"].as<bool>();
            ret["is_super_admin"] = r[0]["is_super_admin"].isNull() ? false : r[0]["is_super_admin"].as<bool>();
            
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

        api_client->sendRequest(user_req, [this, callback, req, access_token, api_client](drogon::ReqResult res, const drogon::HttpResponsePtr& user_resp) {
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

            std::string email = user_json.isMember("email") && !user_json["email"].isNull() ? user_json["email"].asString() : "";

            // Fetch emails to find all verified ones and prep for enterprise domain matching
            auto email_req = drogon::HttpRequest::newHttpRequest();
            email_req->setPath("/user/emails");
            email_req->setMethod(drogon::Get);
            email_req->addHeader("Authorization", "Bearer " + access_token);
            email_req->addHeader("User-Agent", "SWACN-Server");

            api_client->sendRequest(email_req, [callback, req, github_id, username, email, new_api_key](drogon::ReqResult email_res, const drogon::HttpResponsePtr& email_resp) {
                std::string final_email = email;
                
                if (email_res == drogon::ReqResult::Ok && email_resp->getJsonObject() && email_resp->getJsonObject()->isArray()) {
                    auto emails_array = *email_resp->getJsonObject();
                    for (const auto& em : emails_array) {
                        if (em.isMember("verified") && em["verified"].asBool()) {
                            std::string current_email = em["email"].asString();
                            
                            // TODO: (Future Enterprise Logic)
                            // Here you can match `current_email` domain against the `enterprises` table.
                            // If it matches an enterprise domain, assign them the pro role!
                            
                            if (em.isMember("primary") && em["primary"].asBool()) {
                                final_email = current_email;
                            } else if (final_email.empty()) {
                                final_email = current_email;
                            }
                        }
                    }
                }

                // 3. Upsert user into Database (Async)
                auto dbClient = drogon::app().getDbClient();
            std::string sql = 
                "WITH existing AS ( "
                "    SELECT id FROM users WHERE (email = $1 AND $1 != '') OR github_id = $2 LIMIT 1 "
                "), "
                "updated AS ( "
                "    UPDATE users SET github_id = $2, username = $3 WHERE id = (SELECT id FROM existing) RETURNING api_key "
                "), "
                "inserted AS ( "
                "    INSERT INTO users (email, github_id, username, api_key) "
                "    SELECT NULLIF($1, ''), $2, $3, $4 "
                "    WHERE NOT EXISTS (SELECT 1 FROM existing) "
                "    RETURNING api_key "
                ") "
                "SELECT api_key FROM updated UNION ALL SELECT api_key FROM inserted;";

            dbClient->execSqlAsync(
                sql,
                [callback, req](const drogon::orm::Result& r) {
                    if (r.empty()) {
                        auto resp = drogon::HttpResponse::newHttpResponse();
                        resp->setStatusCode(drogon::k500InternalServerError);
                        callback(resp);
                        return;
                    }
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
                    LOG_ERROR << "GitHub DB Error: " << e.base().what();
                    auto resp = drogon::HttpResponse::newHttpResponse();
                    resp->setStatusCode(drogon::k500InternalServerError);
                    callback(resp);
                },
                final_email, github_id, username, new_api_key
            );
            });
        });
    });
}

void AuthController::loginGoogle(const drogon::HttpRequestPtr& req, std::function<void(const drogon::HttpResponsePtr&)>&& callback) {
    std::string client_id = getenv("GOOGLE_CLIENT_ID") ? getenv("GOOGLE_CLIENT_ID") : "";
    std::string is_popup = req->getParameter("popup");
    std::string handshake_id = req->getParameter("handshake_id");
    
    std::string state = "";
    if (is_popup == "true") {
        state = "popup";
        if (!handshake_id.empty()) {
            state += ":" + handshake_id;
        }
    }
    
    std::string frontend_url = getenv("APP_URL") ? std::string(getenv("APP_URL")) : "http://localhost:3000";
    std::string redirect_uri = frontend_url + "/api/auth/google/callback";
    
    std::string redirect_url = "https://accounts.google.com/o/oauth2/v2/auth?client_id=" + client_id + 
                               "&redirect_uri=" + drogon::utils::urlEncode(redirect_uri) + 
                               "&response_type=code&scope=email profile&state=" + state;
    
    auto resp = drogon::HttpResponse::newRedirectionResponse(redirect_url);
    callback(resp);
}

void AuthController::callbackGoogle(const drogon::HttpRequestPtr& req, std::function<void(const drogon::HttpResponsePtr&)>&& callback) {
    auto code = req->getParameter("code");
    if (code.empty()) {
        auto resp = drogon::HttpResponse::newHttpResponse();
        resp->setStatusCode(drogon::k400BadRequest);
        resp->setBody("Missing code parameter");
        callback(resp);
        return;
    }

    std::string frontend_url = getenv("APP_URL") ? std::string(getenv("APP_URL")) : "http://localhost:3000";
    std::string redirect_uri = frontend_url + "/api/auth/google/callback";

    auto client = drogon::HttpClient::newHttpClient("https://oauth2.googleapis.com");
    auto token_req = drogon::HttpRequest::newHttpRequest();
    token_req->setPath("/token");
    token_req->setMethod(drogon::Post);
    token_req->setParameter("client_id", getenv("GOOGLE_CLIENT_ID") ? getenv("GOOGLE_CLIENT_ID") : "");
    token_req->setParameter("client_secret", getenv("GOOGLE_CLIENT_SECRET") ? getenv("GOOGLE_CLIENT_SECRET") : "");
    token_req->setParameter("code", code);
    token_req->setParameter("grant_type", "authorization_code");
    token_req->setParameter("redirect_uri", redirect_uri);
    token_req->addHeader("Accept", "application/json");

    client->sendRequest(token_req, [this, callback, req](drogon::ReqResult result, const drogon::HttpResponsePtr& response) {
        if (result != drogon::ReqResult::Ok || !response->getJsonObject()) {
            auto resp = drogon::HttpResponse::newHttpResponse();
            resp->setStatusCode(drogon::k500InternalServerError);
            callback(resp);
            return;
        }

        auto json = *response->getJsonObject();
        if (!json.isMember("access_token")) {
            auto resp = drogon::HttpResponse::newHttpResponse();
            resp->setStatusCode(drogon::k500InternalServerError);
            callback(resp);
            return;
        }
        std::string access_token = json["access_token"].asString();

        auto api_client = drogon::HttpClient::newHttpClient("https://www.googleapis.com");
        auto user_req = drogon::HttpRequest::newHttpRequest();
        user_req->setPath("/oauth2/v2/userinfo");
        user_req->setMethod(drogon::Get);
        user_req->addHeader("Authorization", "Bearer " + access_token);

        api_client->sendRequest(user_req, [this, callback, req](drogon::ReqResult res, const drogon::HttpResponsePtr& user_resp) {
            if (res != drogon::ReqResult::Ok || !user_resp->getJsonObject()) {
                auto resp = drogon::HttpResponse::newHttpResponse();
                resp->setStatusCode(drogon::k500InternalServerError);
                callback(resp);
                return;
            }

            auto user_json = *user_resp->getJsonObject();
            std::string google_id = user_json["id"].asString();
            std::string username = user_json.isMember("name") ? user_json["name"].asString() : "GoogleUser";
            std::string email = user_json.isMember("email") ? user_json["email"].asString() : "";
            std::string new_api_key = generateApiKey();

            auto dbClient = drogon::app().getDbClient();
            std::string sql = 
                "WITH existing AS ( "
                "    SELECT id FROM users WHERE (email = $1 AND $1 != '') OR google_id = $2 LIMIT 1 "
                "), "
                "updated AS ( "
                "    UPDATE users SET google_id = $2, username = $3 WHERE id = (SELECT id FROM existing) RETURNING api_key "
                "), "
                "inserted AS ( "
                "    INSERT INTO users (email, google_id, username, api_key) "
                "    SELECT NULLIF($1, ''), $2, $3, $4 "
                "    WHERE NOT EXISTS (SELECT 1 FROM existing) "
                "    RETURNING api_key "
                ") "
                "SELECT api_key FROM updated UNION ALL SELECT api_key FROM inserted;";

            dbClient->execSqlAsync(
                sql,
                [callback, req](const drogon::orm::Result& r) {
                    if (r.empty()) {
                        auto resp = drogon::HttpResponse::newHttpResponse();
                        resp->setStatusCode(drogon::k500InternalServerError);
                        callback(resp);
                        return;
                    }
                    std::string active_key = r[0]["api_key"].as<std::string>();
                    auto state = req->getParameter("state");
                    
                    std::string popup_param = "";
                    if (state.find("popup") == 0) {
                        popup_param = "&popup=true";
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
                    LOG_ERROR << "Google DB Error: " << e.base().what();
                    auto resp = drogon::HttpResponse::newHttpResponse();
                    resp->setStatusCode(drogon::k500InternalServerError);
                    callback(resp);
                },
                email, google_id, username, new_api_key
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