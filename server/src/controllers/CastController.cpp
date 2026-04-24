#include "CastController.hpp"
#include <filesystem>
#include <drogon/utils/Utilities.h>
#include <fstream>

namespace fs = std::filesystem;

void CastController::uploadCast(const drogon::HttpRequestPtr& req, std::function<void(const drogon::HttpResponsePtr&)>&& callback) {
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
        "SELECT id FROM users WHERE api_key = $1",
        [req, callback, dbClient](const drogon::orm::Result& r) {
            if (r.empty()) {
                auto resp = drogon::HttpResponse::newHttpResponse();
                resp->setStatusCode(drogon::k401Unauthorized);
                callback(resp);
                return;
            }
            int user_id = r[0]["id"].as<int>();

            // 2. Parse Multipart
            drogon::MultiPartParser fileUpload;
            if (fileUpload.parse(req) != 0 || fileUpload.getFiles().empty()) {
                auto resp = drogon::HttpResponse::newHttpResponse();
                resp->setStatusCode(drogon::k400BadRequest);
                resp->setBody("Incomplete upload assets. Requires at least a manifest.");
                callback(resp);
                return;
            }

            // 3. Setup Directory
            std::string cast_uuid = drogon::utils::getUuid();
            std::string upload_path_from_config = drogon::app().getUploadPath();
            fs::path root_upload_path(upload_path_from_config);
            fs::path cast_dir = root_upload_path / cast_uuid;

            try {
                fs::create_directories(cast_dir);
            } catch (const std::exception& e) {
                LOG_ERROR << "FS Error: " << e.what();
                auto resp = drogon::HttpResponse::newHttpResponse();
                resp->setStatusCode(drogon::k500InternalServerError);
                callback(resp);
                return;
            }

            // 4. Save files directly
            bool has_baseline = false;
            bool has_recording = false;
            for (auto& file : fileUpload.getFiles()) {
                std::string itemName = file.getItemName(); 
                std::string targetName;

                if (itemName == "manifest") targetName = "manifest.json";
                else if (itemName == "baseline") { targetName = "baseline.tar.gz"; has_baseline = true; }
                else if (itemName == "recording") { targetName = "recording.cast"; has_recording = true; }
                else targetName = file.getFileName(); 

                std::string absolute_save_path = (cast_dir / targetName).string();
                file.saveAs(absolute_save_path);
            }

            std::string baseline_val = has_baseline ? (cast_uuid + "/baseline.tar.gz") : "";
            std::string recording_val = has_recording ? (cast_uuid + "/recording.cast") : "";

            bool has_keystrokes = false;
            if (has_recording) {
                std::ifstream rec_file((cast_dir / "recording.cast").string());
                std::string line;
                while (std::getline(rec_file, line)) {
                    if (line.find("\"i\"") != std::string::npos) {
                        has_keystrokes = true;
                        break;
                    }
                }
            }

            // 4.5 Extract project name from manifest if possible
            std::string project_name = "";
            try {
                std::ifstream manifest_file((cast_dir / "manifest.json").string());
                Json::Value manifest_json;
                manifest_file >> manifest_json;
                if (manifest_json.isMember("environment") && manifest_json["environment"].isMember("project")) {
                    project_name = manifest_json["environment"]["project"].asString();
                }
            } catch (...) {
                // Ignore parsing errors
            }

            // 5. Update Database utilizing NULLIF for the empty string fallback
            dbClient->execSqlAsync(
                "INSERT INTO casts (user_id, project_name, manifest_url, baseline_url, recording_url, show_keystrokes, allow_fs_download) VALUES ($1, NULLIF($2, ''), $3, NULLIF($4, ''), NULLIF($5, ''), $6, $7)",
                [callback, cast_uuid](const drogon::orm::Result& res) {
                    
                    const char* env_url = getenv("APP_URL");
                    std::string base_url = env_url ? std::string(env_url) : "http://localhost:8080";
                    
                    if (!base_url.empty() && base_url.back() == '/') {
                        base_url.pop_back();
                    }

                    Json::Value ret;
                    ret["status"] = "success";
                    ret["cast_id"] = cast_uuid;
                    ret["url"] = base_url + "/view/" + cast_uuid; 
                    
                    callback(drogon::HttpResponse::newHttpJsonResponse(ret));
                },
                [callback](const drogon::orm::DrogonDbException& e) {
                    auto resp = drogon::HttpResponse::newHttpResponse();
                    resp->setStatusCode(drogon::k500InternalServerError);
                    callback(resp);
                },
                user_id, 
                project_name,
                cast_uuid + "/manifest.json", 
                baseline_val, 
                recording_val,
                has_keystrokes,
                true // allow_fs_download
            );
        },
        [callback](const drogon::orm::DrogonDbException& e) {
            auto resp = drogon::HttpResponse::newHttpResponse();
            resp->setStatusCode(drogon::k500InternalServerError);
            callback(resp);
        },
        api_key
    );
}

void CastController::getCast(const drogon::HttpRequestPtr& req, std::function<void(const drogon::HttpResponsePtr&)>&& callback, std::string id) {
    auto dbClient = drogon::app().getDbClient();
    std::string like_pattern = id + "/%";
    
    dbClient->execSqlAsync(
        "SELECT id, project_name, manifest_url, baseline_url, recording_url, theme, show_keystrokes, allow_fs_download, created_at "
        "FROM casts WHERE manifest_url LIKE $1",
        [callback, id](const drogon::orm::Result& r) {
            if (r.empty()) {
                auto resp = drogon::HttpResponse::newHttpResponse();
                resp->setStatusCode(drogon::k404NotFound);
                callback(resp);
                return;
            }
            
            auto const& row = r[0];
            Json::Value castObj;
            castObj["id"] = id;
            castObj["name"] = row["project_name"].isNull() ? "" : row["project_name"].as<std::string>();
            castObj["has_recording"] = !row["recording_url"].isNull();
            castObj["has_baseline"] = !row["baseline_url"].isNull();
            castObj["theme"] = row["theme"].isNull() ? "mocha" : row["theme"].as<std::string>();
            castObj["show_keystrokes"] = row["show_keystrokes"].isNull() ? true : row["show_keystrokes"].as<bool>();
            castObj["allow_fs_download"] = row["allow_fs_download"].isNull() ? true : row["allow_fs_download"].as<bool>();
            
            callback(drogon::HttpResponse::newHttpJsonResponse(castObj));
        },
        [callback](const drogon::orm::DrogonDbException& e) {
            auto resp = drogon::HttpResponse::newHttpResponse();
            resp->setStatusCode(drogon::k500InternalServerError);
            callback(resp);
        },
        like_pattern
    );
}

void CastController::updateCastSettings(const drogon::HttpRequestPtr& req, std::function<void(const drogon::HttpResponsePtr&)>&& callback, std::string id) {
    std::string auth_header = req->getHeader("Authorization");
    if (auth_header.empty() || auth_header.find("Bearer ") != 0) {
        auto resp = drogon::HttpResponse::newHttpResponse();
        resp->setStatusCode(drogon::k401Unauthorized);
        callback(resp);
        return;
    }
    std::string api_key = auth_header.substr(7);

    auto jsonPtr = req->getJsonObject();
    if (!jsonPtr) {
        auto resp = drogon::HttpResponse::newHttpResponse();
        resp->setStatusCode(drogon::k400BadRequest);
        callback(resp);
        return;
    }

    std::string theme = (*jsonPtr)["theme"].asString();
    bool show_keystrokes = (*jsonPtr)["show_keystrokes"].asBool();
    bool allow_fs_download = (*jsonPtr)["allow_fs_download"].asBool();

    auto dbClient = drogon::app().getDbClient();
    std::string like_pattern = id + "/%";

    // Verify ownership and update in one query using the api_key
    dbClient->execSqlAsync(
        "UPDATE casts SET theme = $1, show_keystrokes = $2, allow_fs_download = $3 "
        "FROM users "
        "WHERE casts.user_id = users.id AND users.api_key = $4 AND casts.manifest_url LIKE $5 "
        "RETURNING casts.id",
        [callback](const drogon::orm::Result& r) {
            if (r.empty()) {
                auto resp = drogon::HttpResponse::newHttpResponse();
                resp->setStatusCode(drogon::k403Forbidden); // Or 404
                callback(resp);
                return;
            }
            Json::Value ret;
            ret["status"] = "success";
            callback(drogon::HttpResponse::newHttpJsonResponse(ret));
        },
        [callback](const drogon::orm::DrogonDbException& e) {
            auto resp = drogon::HttpResponse::newHttpResponse();
            resp->setStatusCode(drogon::k500InternalServerError);
            callback(resp);
        },
        theme,
        show_keystrokes,
        allow_fs_download,
        api_key,
        like_pattern
    );
}

void CastController::listCasts(const drogon::HttpRequestPtr& req, std::function<void(const drogon::HttpResponsePtr&)>&& callback) {
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
        "SELECT c.id, c.project_name, c.manifest_url, c.baseline_url, c.recording_url, c.theme, c.show_keystrokes, c.allow_fs_download, c.created_at "
        "FROM casts c JOIN users u ON c.user_id = u.id "
        "WHERE u.api_key = $1 ORDER BY c.created_at DESC",
        [callback](const drogon::orm::Result& r) {
            Json::Value casts(Json::arrayValue);
            
            const char* env_url = getenv("APP_URL");
            std::string base_url = env_url ? std::string(env_url) : "http://localhost:8080";
            if (!base_url.empty() && base_url.back() == '/') base_url.pop_back();

            for (auto const& row : r) {
                Json::Value castObj;
                std::string manifest_path = row["manifest_url"].as<std::string>();
                std::string uuid = manifest_path.substr(0, manifest_path.find('/'));
                
                castObj["id"] = uuid;
                castObj["name"] = row["project_name"].isNull() ? "" : row["project_name"].as<std::string>();
                castObj["url"] = base_url + "/view/" + uuid;
                castObj["has_recording"] = !row["recording_url"].isNull();
                castObj["has_baseline"] = !row["baseline_url"].isNull();
                castObj["theme"] = row["theme"].isNull() ? "mocha" : row["theme"].as<std::string>();
                castObj["show_keystrokes"] = row["show_keystrokes"].isNull() ? true : row["show_keystrokes"].as<bool>();
                castObj["allow_fs_download"] = row["allow_fs_download"].isNull() ? true : row["allow_fs_download"].as<bool>();
                castObj["created_at"] = row["created_at"].as<std::string>();
                casts.append(castObj);
            }
            
            callback(drogon::HttpResponse::newHttpJsonResponse(casts));
        },
        [callback](const drogon::orm::DrogonDbException& e) {
            auto resp = drogon::HttpResponse::newHttpResponse();
            resp->setStatusCode(drogon::k500InternalServerError);
            callback(resp);
        },
        api_key
    );
}