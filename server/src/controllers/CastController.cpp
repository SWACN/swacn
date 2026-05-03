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

            dbClient->execSqlAsync(
                "SELECT COUNT(*) FROM projects WHERE user_id = $1 AND deleted_at IS NULL",
                [req, callback, dbClient, user_id](const drogon::orm::Result& r_count) {
                    int count = r_count[0][0].as<int>();
                    if (count >= 15) {
                        Json::Value err;
                        err["error"] = "Project limit reached. You have 15 active projects. Please consider deleting projects not actively used by you before uploading new ones.";
                        auto resp = drogon::HttpResponse::newHttpJsonResponse(err);
                        resp->setStatusCode(drogon::k403Forbidden);
                        callback(resp);
                        return;
                    }

                    // 2. Parse Multipart
                    drogon::MultiPartParser fileUpload;
                    if (fileUpload.parse(req) != 0 || fileUpload.getFiles().empty()) {
                        auto resp = drogon::HttpResponse::newHttpResponse();
                        resp->setStatusCode(drogon::k400BadRequest);
                        resp->setBody("Incomplete upload assets. Requires at least a manifest.");
                        callback(resp);
                        return;
                    }

                    size_t total_size = 0;
                    for (auto const& file : fileUpload.getFiles()) {
                        total_size += file.fileLength();
                    }
                    if (total_size > 2 * 1024 * 1024) {
                        Json::Value err;
                        err["error"] = "Project size exceeds the 2 MB limit. Please ensure your filesystem snapshot is small.";
                        auto resp = drogon::HttpResponse::newHttpJsonResponse(err);
                        resp->setStatusCode(drogon::k413RequestEntityTooLarge);
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

                    bool delete_baseline = false;
                    bool delete_recording = false;
                    for (auto const& field : fileUpload.getParameters()) {
                        if (field.first == "delete_baseline" && field.second == "true") delete_baseline = true;
                        if (field.first == "delete_recording" && field.second == "true") delete_recording = true;
                    }

                    if (delete_baseline) {
                        try { fs::remove(cast_dir / "baseline.tar.gz"); } catch (...) {}
                        has_baseline = false;
                    }
                    if (delete_recording) {
                        try { fs::remove(cast_dir / "recording.cast"); } catch (...) {}
                        has_recording = false;
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
                    std::string title = "";
                    try {
                        std::ifstream manifest_file((cast_dir / "manifest.json").string());
                        Json::Value manifest_json;
                        manifest_file >> manifest_json;
                        if (manifest_json.isMember("environment") && manifest_json["environment"].isMember("project")) {
                            title = manifest_json["environment"]["project"].asString();
                        }
                    } catch (...) {
                        // Ignore parsing errors
                    }

                    // 5. Insert Project and Cast utilizing NULLIF
                    dbClient->execSqlAsync(
                        "INSERT INTO projects (user_id, name, manifest_url, baseline_url, show_keystrokes, allow_fs_download, embed_theme) VALUES ($1, COALESCE(NULLIF($2, ''), 'Untitled Project'), $3, NULLIF($4, ''), $5, $6, $7) RETURNING id",
                        [callback, cast_uuid, user_id, title, recording_val, dbClient](const drogon::orm::Result& res) {
                            int project_id = res[0]["id"].as<int>();
                            
                            dbClient->execSqlAsync(
                                "INSERT INTO casts (user_id, project_id, title, recording_url) VALUES ($1, $2, NULLIF($3, ''), NULLIF($4, ''))",
                                [callback, cast_uuid](const drogon::orm::Result& res2) {
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
                                project_id,
                                title,
                                recording_val
                            );
                        },
                        [callback](const drogon::orm::DrogonDbException& e) {
                            auto resp = drogon::HttpResponse::newHttpResponse();
                            resp->setStatusCode(drogon::k500InternalServerError);
                            callback(resp);
                        },
                        user_id, 
                        title,
                        cast_uuid + "/manifest.json", 
                        baseline_val, 
                        has_keystrokes,
                        true, // allow_fs_download
                        "dark" // embed_theme
                    );
                },
                [callback](const drogon::orm::DrogonDbException& e) {
                    auto resp = drogon::HttpResponse::newHttpResponse();
                    resp->setStatusCode(drogon::k500InternalServerError);
                    callback(resp);
                },
                user_id
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
        "SELECT p.id, p.name, p.manifest_url, p.baseline_url, p.theme, p.show_keystrokes, p.allow_fs_download, p.embed_theme, p.created_at, "
        "(SELECT recording_url FROM casts c WHERE c.project_id = p.id AND c.deleted_at IS NULL ORDER BY c.created_at DESC LIMIT 1) as recording_url "
        "FROM projects p WHERE p.manifest_url LIKE $1 AND p.deleted_at IS NULL",
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
            castObj["name"] = row["name"].isNull() ? "" : row["name"].as<std::string>();
            castObj["has_recording"] = !row["recording_url"].isNull();
            castObj["has_baseline"] = !row["baseline_url"].isNull();
            castObj["theme"] = row["theme"].isNull() ? "mocha" : row["theme"].as<std::string>();
            castObj["show_keystrokes"] = row["show_keystrokes"].isNull() ? true : row["show_keystrokes"].as<bool>();
            castObj["allow_fs_download"] = row["allow_fs_download"].isNull() ? true : row["allow_fs_download"].as<bool>();
            castObj["embed_theme"] = row["embed_theme"].isNull() ? "dark" : row["embed_theme"].as<std::string>();
            
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
    std::string embed_theme = (*jsonPtr)["embed_theme"].asString();

    auto dbClient = drogon::app().getDbClient();
    std::string like_pattern = id + "/%";

    // Verify ownership and update in one query using the api_key
    dbClient->execSqlAsync(
        "UPDATE projects SET theme = $1, show_keystrokes = $2, allow_fs_download = $3, embed_theme = $4 "
        "FROM users "
        "WHERE projects.user_id = users.id AND users.api_key = $5 AND projects.manifest_url LIKE $6 "
        "RETURNING projects.id",
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
        embed_theme,
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
        "SELECT p.id, p.name as title, p.manifest_url, p.baseline_url, p.theme, p.show_keystrokes, p.allow_fs_download, p.embed_theme, p.created_at, "
        "(SELECT recording_url FROM casts c WHERE c.project_id = p.id AND c.deleted_at IS NULL ORDER BY c.created_at DESC LIMIT 1) as recording_url "
        "FROM projects p JOIN users u ON p.user_id = u.id "
        "WHERE u.api_key = $1 AND p.deleted_at IS NULL ORDER BY p.created_at DESC",
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
                castObj["name"] = row["title"].isNull() ? "" : row["title"].as<std::string>();
                castObj["url"] = base_url + "/view/" + uuid;
                castObj["has_recording"] = !row["recording_url"].isNull();
                castObj["has_baseline"] = !row["baseline_url"].isNull();
                castObj["theme"] = row["theme"].isNull() ? "mocha" : row["theme"].as<std::string>();
                castObj["show_keystrokes"] = row["show_keystrokes"].isNull() ? true : row["show_keystrokes"].as<bool>();
                castObj["allow_fs_download"] = row["allow_fs_download"].isNull() ? true : row["allow_fs_download"].as<bool>();
                castObj["embed_theme"] = row["embed_theme"].isNull() ? "dark" : row["embed_theme"].as<std::string>();
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

void CastController::deleteCast(const drogon::HttpRequestPtr& req, std::function<void(const drogon::HttpResponsePtr&)>&& callback, std::string id) {
    std::string auth_header = req->getHeader("Authorization");
    if (auth_header.empty() || auth_header.find("Bearer ") != 0) {
        auto resp = drogon::HttpResponse::newHttpResponse();
        resp->setStatusCode(drogon::k401Unauthorized);
        callback(resp);
        return;
    }
    std::string api_key = auth_header.substr(7);
    
    auto dbClient = drogon::app().getDbClient();
    std::string like_pattern = id + "/%";
    
    // Verify ownership and soft-delete in one query
    dbClient->execSqlAsync(
        "UPDATE projects SET deleted_at = CURRENT_TIMESTAMP "
        "FROM users "
        "WHERE projects.user_id = users.id AND users.api_key = $1 AND projects.manifest_url LIKE $2 AND projects.deleted_at IS NULL "
        "RETURNING projects.id",
        [callback, id](const drogon::orm::Result& r) {
            if (r.empty()) {
                auto resp = drogon::HttpResponse::newHttpResponse();
                resp->setStatusCode(drogon::k403Forbidden);
                callback(resp);
                return;
            }
            
            // Hard delete files from filesystem
            try {
                std::string upload_path_from_config = drogon::app().getUploadPath();
                fs::path cast_dir = fs::path(upload_path_from_config) / id;
                if (fs::exists(cast_dir)) {
                    fs::remove_all(cast_dir);
                }
            } catch (const std::exception& e) {
                LOG_ERROR << "Failed to remove files for deleted cast " << id << ": " << e.what();
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
        api_key,
        like_pattern
    );
}

void CastController::updateCastUpload(const drogon::HttpRequestPtr& req, std::function<void(const drogon::HttpResponsePtr&)>&& callback, std::string id) {
    std::string auth_header = req->getHeader("Authorization");
    if (auth_header.empty() || auth_header.find("Bearer ") != 0) {
        auto resp = drogon::HttpResponse::newHttpResponse();
        resp->setStatusCode(drogon::k401Unauthorized);
        callback(resp);
        return;
    }
    std::string api_key = auth_header.substr(7);

    auto dbClient = drogon::app().getDbClient();
    std::string like_pattern = id + "/%";
    
    // First verify ownership
    dbClient->execSqlAsync(
        "SELECT projects.id, projects.user_id FROM projects JOIN users ON projects.user_id = users.id WHERE users.api_key = $1 AND projects.manifest_url LIKE $2 AND projects.deleted_at IS NULL",
        [req, callback, dbClient, id, like_pattern](const drogon::orm::Result& r) {
            if (r.empty()) {
                auto resp = drogon::HttpResponse::newHttpResponse();
                resp->setStatusCode(drogon::k403Forbidden);
                callback(resp);
                return;
            }
            int project_id = r[0]["id"].as<int>();
            int user_id = r[0]["user_id"].as<int>();

            // Parse Multipart
            drogon::MultiPartParser fileUpload;
            if (fileUpload.parse(req) != 0 || fileUpload.getFiles().empty()) {
                auto resp = drogon::HttpResponse::newHttpResponse();
                resp->setStatusCode(drogon::k400BadRequest);
                resp->setBody("Incomplete upload assets. Requires at least a manifest.");
                callback(resp);
                return;
            }

            size_t total_size = 0;
            for (auto const& file : fileUpload.getFiles()) {
                total_size += file.fileLength();
            }
            if (total_size > 2 * 1024 * 1024) {
                Json::Value err;
                err["error"] = "Project size exceeds the 2 MB limit.";
                auto resp = drogon::HttpResponse::newHttpJsonResponse(err);
                resp->setStatusCode(drogon::k413RequestEntityTooLarge);
                callback(resp);
                return;
            }

            // Setup Directory - Clear out old contents if needed
            std::string upload_path_from_config = drogon::app().getUploadPath();
            fs::path root_upload_path(upload_path_from_config);
            fs::path cast_dir = root_upload_path / id;

            try {
                if (!fs::exists(cast_dir)) {
                    fs::create_directories(cast_dir);
                }
            } catch (const std::exception& e) {
                LOG_ERROR << "FS Error: " << e.what();
                auto resp = drogon::HttpResponse::newHttpResponse();
                resp->setStatusCode(drogon::k500InternalServerError);
                callback(resp);
                return;
            }

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
                try {
                    if (fs::exists(absolute_save_path)) {
                        fs::remove(absolute_save_path);
                    }
                } catch (...) {}
                file.saveAs(absolute_save_path);
            }

            bool delete_baseline = false;
            bool delete_recording = false;
            for (auto const& field : fileUpload.getParameters()) {
                if (field.first == "delete_baseline" && field.second == "true") delete_baseline = true;
                if (field.first == "delete_recording" && field.second == "true") delete_recording = true;
            }

            if (delete_baseline) {
                try { fs::remove(cast_dir / "baseline.tar.gz"); } catch (...) {}
                has_baseline = false;
            }
            if (delete_recording) {
                try { fs::remove(cast_dir / "recording.cast"); } catch (...) {}
                has_recording = false;
            }

            LOG_INFO << "Updating Cast: " << id << " delete_baseline: " << delete_baseline << " delete_recording: " << delete_recording;

            std::string baseline_val = has_baseline ? (id + "/baseline.tar.gz") : (delete_baseline ? "__DELETE__" : "");
            std::string recording_val = has_recording ? (id + "/recording.cast") : (delete_recording ? "__DELETE__" : "");

            LOG_INFO << "Baseline Val: " << baseline_val << " Recording Val: " << recording_val;

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

            std::string title = "";
            try {
                std::ifstream manifest_file((cast_dir / "manifest.json").string());
                Json::Value manifest_json;
                manifest_file >> manifest_json;
                if (manifest_json.isMember("environment") && manifest_json["environment"].isMember("project")) {
                    title = manifest_json["environment"]["project"].asString();
                }
            } catch (const std::exception& e) { 
                LOG_WARN << "Manifest parse failed: " << e.what();
            }

            // Update Database
            dbClient->execSqlAsync(
                "UPDATE projects SET "
                "name = COALESCE(NULLIF($1, ''), name), "
                "baseline_url = CASE WHEN $2 = '__DELETE__' THEN NULL WHEN $2 <> '' THEN $2 ELSE baseline_url END, "
                "show_keystrokes = CASE WHEN $5 THEN $3 ELSE show_keystrokes END "
                "WHERE id = $4",
                [callback, dbClient, id, project_id, user_id, title, recording_val](const drogon::orm::Result& res) {
                    
                    auto returnSuccess = [callback, id]() {
                        const char* env_url = getenv("APP_URL");
                        std::string base_url = env_url ? std::string(env_url) : "http://localhost:8080";
                        if (!base_url.empty() && base_url.back() == '/') {
                            base_url.pop_back();
                        }
                        Json::Value ret;
                        ret["status"] = "success";
                        ret["cast_id"] = id;
                        ret["url"] = base_url + "/view/" + id; 
                        callback(drogon::HttpResponse::newHttpJsonResponse(ret));
                    };

                    if (recording_val == "__DELETE__") {
                        dbClient->execSqlAsync(
                            "UPDATE casts SET deleted_at = CURRENT_TIMESTAMP WHERE project_id = $1 AND deleted_at IS NULL",
                            [returnSuccess](const drogon::orm::Result& r) { returnSuccess(); },
                            [callback](const drogon::orm::DrogonDbException& e) { callback(drogon::HttpResponse::newHttpResponse()); },
                            project_id
                        );
                    } else if (!recording_val.empty()) {
                        dbClient->execSqlAsync(
                            "INSERT INTO casts (user_id, project_id, title, recording_url) VALUES ($1, $2, NULLIF($3, ''), $4)",
                            [returnSuccess](const drogon::orm::Result& res2) {
                                returnSuccess();
                            },
                            [callback](const drogon::orm::DrogonDbException& e) {
                                auto resp = drogon::HttpResponse::newHttpResponse();
                                resp->setStatusCode(drogon::k500InternalServerError);
                                callback(resp);
                            },
                            user_id, project_id, title, recording_val
                        );
                    } else {
                        returnSuccess();
                    }
                },
                [callback](const drogon::orm::DrogonDbException& e) {
                    auto resp = drogon::HttpResponse::newHttpResponse();
                    resp->setStatusCode(drogon::k500InternalServerError);
                    callback(resp);
                },
                title,
                baseline_val,
                has_keystrokes,
                project_id,
                has_recording
            );
        },
        [callback](const drogon::orm::DrogonDbException& e) {
            auto resp = drogon::HttpResponse::newHttpResponse();
            resp->setStatusCode(drogon::k500InternalServerError);
            callback(resp);
        },
        api_key,
        like_pattern
    );
}