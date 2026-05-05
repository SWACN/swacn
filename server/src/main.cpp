#include <drogon/drogon.h>
#include <fstream>
#include <string>
#include <cstdlib> // for setenv

// Lightweight .env parser
void load_env(const std::string& filepath = ".env") {
    std::ifstream file(filepath);
    if (!file.is_open()) {
        LOG_INFO << "No .env file found. Relying on system environment variables.";
        return;
    }

    std::string line;
    while (std::getline(file, line)) {
        // Skip empty lines and comments
        if (line.empty() || line[0] == '#') continue;

        auto delimiterPos = line.find('=');
        if (delimiterPos != std::string::npos) {
            std::string key = line.substr(0, delimiterPos);
            std::string value = line.substr(delimiterPos + 1);
            
            // setenv(key, value, overwrite_flag)
            setenv(key.c_str(), value.c_str(), 1); 
        }
    }
    LOG_INFO << "Loaded environment variables from .env";
}

int main() {
    // 1. Load the .env file first
    load_env();

    // 2. Load Drogon config file
    drogon::app().loadConfigFile("config.json");
    
    // Quick sanity check to ensure the env variables are actually loaded
    if (getenv("GITHUB_CLIENT_ID") == nullptr) {
        LOG_WARN << "WARNING: GITHUB_CLIENT_ID is not set!";
    }

    // 3. Register PreRoutingAdvice to protect private uploads
    drogon::app().registerPreRoutingAdvice([](const drogon::HttpRequestPtr &req, drogon::FilterCallback &&fcb, drogon::FilterChainCallback &&fccb) {
        std::string path = req->path();
        if (path.find("/uploads/") == 0) {
            // Path format: /uploads/{uuid}/{filename}
            std::string sub = path.substr(9);
            size_t slash = sub.find('/');
            if (slash != std::string::npos) {
                std::string id = sub.substr(0, slash);
                auto dbClient = drogon::app().getDbClient();
                dbClient->execSqlAsync(
                    "SELECT is_public, user_id FROM projects WHERE manifest_url LIKE $1 AND deleted_at IS NULL",
                    [req, fcb = std::move(fcb), fccb = std::move(fccb)](const drogon::orm::Result& r) mutable {
                        if (r.empty()) {
                            fccb();
                            return;
                        }
                        
                        bool is_public = r[0]["is_public"].isNull() ? true : r[0]["is_public"].as<bool>();
                        int owner_id = r[0]["user_id"].as<int>();
                        
                        if (is_public) {
                            fccb();
                        } else {
                            // Check Auth
                            std::string api_key = req->getParameter("token");
                            if (api_key.empty()) {
                                std::string auth_header = req->getHeader("Authorization");
                                if (auth_header.empty() || auth_header.find("Bearer ") != 0) {
                                    auto resp = drogon::HttpResponse::newHttpResponse();
                                    resp->setStatusCode(drogon::k401Unauthorized);
                                    fcb(resp);
                                    return;
                                }
                                api_key = auth_header.substr(7);
                            }
                            
                            auto dbClient = drogon::app().getDbClient();
                            dbClient->execSqlAsync(
                                "SELECT id, is_super_admin FROM users WHERE api_key = $1",
                                [fcb = std::move(fcb), fccb = std::move(fccb), owner_id](const drogon::orm::Result& user_r) mutable {
                                    if (user_r.empty()) {
                                        auto resp = drogon::HttpResponse::newHttpResponse();
                                        resp->setStatusCode(drogon::k401Unauthorized);
                                        fcb(resp);
                                        return;
                                    }
                                    
                                    int user_id = user_r[0]["id"].as<int>();
                                    bool is_super_admin = user_r[0]["is_super_admin"].isNull() ? false : user_r[0]["is_super_admin"].as<bool>();
                                    
                                    if (user_id == owner_id || is_super_admin) {
                                        fccb();
                                    } else {
                                        auto resp = drogon::HttpResponse::newHttpResponse();
                                        resp->setStatusCode(drogon::k403Forbidden);
                                        fcb(resp);
                                    }
                                },
                                [fcb = std::move(fcb)](const drogon::orm::DrogonDbException& e) mutable {
                                    auto resp = drogon::HttpResponse::newHttpResponse();
                                    resp->setStatusCode(drogon::k500InternalServerError);
                                    fcb(resp);
                                },
                                api_key
                            );
                        }
                    },
                    [fcb = std::move(fcb)](const drogon::orm::DrogonDbException& e) mutable {
                        auto resp = drogon::HttpResponse::newHttpResponse();
                        resp->setStatusCode(drogon::k500InternalServerError);
                        fcb(resp);
                    },
                    id + "/%"
                );
                return;
            }
        }
        fccb();
    });

    LOG_INFO << "Server running on 0.0.0.0:8080";
    
    // 4. Run the fully asynchronous event loop
    drogon::app().run();
    return 0;
}