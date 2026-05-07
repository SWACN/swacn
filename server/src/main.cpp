#include <drogon/drogon.h>
#include <fstream>
#include <string>
#include <cstdlib> // for setenv

// Lightweight .env parser
void load_env(const std::string& filepath = ".env") {
    std::ifstream file(filepath);
    if (!file.is_open()) {
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
}

int main() {
    // 1. Load the .env file first
    load_env();

    // 2. Load and merge configuration
    std::ifstream f("config.json");
    Json::Value config;
    if (f.is_open()) {
        f >> config;
    } else {
        LOG_WARN << "config.json not found, using defaults";
    }

    // 3. Database configuration from env or fallback
    std::string db_host = getenv("DB_HOST") ? getenv("DB_HOST") : "127.0.0.1";
    std::string db_port_str = getenv("DB_PORT") ? getenv("DB_PORT") : "5432";
    std::string db_name = getenv("DB_NAME") ? getenv("DB_NAME") : "swacn_db";
    std::string db_user = getenv("DB_USER") ? getenv("DB_USER") : "postgres";
    std::string db_pass = getenv("DB_PASS") ? getenv("DB_PASS") : "postgres";

    Json::Value db_client;
    db_client["name"] = "default";
    db_client["rdbms"] = "postgresql";
    db_client["host"] = db_host;
    db_client["port"] = std::stoi(db_port_str);
    db_client["dbname"] = db_name;
    db_client["user"] = db_user;
    db_client["password"] = db_pass;
    db_client["connection_number"] = 5;
    
    config["db_clients"].append(db_client);

    // 4. Listener configuration from env or fallback
    std::string listen_addr = getenv("LISTEN_ADDR") ? getenv("LISTEN_ADDR") : "127.0.0.1";
    std::string listen_port_str = getenv("LISTEN_PORT") ? getenv("LISTEN_PORT") : "8080";
    
    Json::Value listener;
    listener["address"] = listen_addr;
    listener["port"] = std::stoi(listen_port_str);
    config["listeners"].append(listener);

    // 5. Logging configuration from env or fallback
    std::string log_path = getenv("LOG_PATH") ? getenv("LOG_PATH") : "./logs";
    std::string log_level = getenv("LOG_LEVEL") ? getenv("LOG_LEVEL") : "DEBUG";
    
    Json::Value logging;
    logging["log_path"] = log_path;
    logging["logfile_base_name"] = "swacn";
    logging["log_size_limit"] = 100000000; // 100MB
    logging["log_level"] = log_level;
    logging["display_local_time"] = true;
    config["logging"] = logging;

    // Apply merged configuration
    drogon::app().loadConfigJson(config);
    
    // Force logging to file if path is provided
    if (!log_path.empty() && log_path != "./" && log_path != ".") {
        drogon::app().setLogPath(log_path);
        // We don't set base name here as it defaults to "drogon" 
        // unless set in config, but we can set it via config above.
    }

    LOG_INFO << "Loaded environment variables from .env";
    LOG_INFO << "Server starting on " << listen_addr << ":" << listen_port_str;

    // Quick sanity check to ensure the env variables are actually loaded
    if (getenv("GITHUB_CLIENT_ID") == nullptr) {
        LOG_WARN << "WARNING: GITHUB_CLIENT_ID is not set!";
    }

    // 5. Register PreRoutingAdvice to protect private uploads
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
                    "SELECT is_public, user_id FROM projects WHERE manifest_url ILIKE $1 AND deleted_at IS NULL",
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
    
    // 6. Register PostHandlingAdvice to disable caching for uploads
    drogon::app().registerPostHandlingAdvice([](const drogon::HttpRequestPtr &req, const drogon::HttpResponsePtr &resp) {
        std::string path = req->path();
        if (path.find("/uploads/") == 0 || path.find("/api/") == 0) {
            resp->addHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
            resp->addHeader("Pragma", "no-cache");
            resp->addHeader("Expires", "0");
        }
    });

    
    // 4. Run the fully asynchronous event loop
    drogon::app().run();
    return 0;
}