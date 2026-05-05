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
        "SELECT id, (is_pro = true) as is_pro, (is_super_admin = true) as is_super_admin FROM users WHERE api_key = $1",
        [req, callback, dbClient](const drogon::orm::Result& r) {
            if (r.empty()) {
                auto resp = drogon::HttpResponse::newHttpResponse();
                resp->setStatusCode(drogon::k401Unauthorized);
                callback(resp);
                return;
            }
            int user_id = r[0]["id"].as<int>();
            bool is_pro = r[0]["is_pro"].isNull() ? false : r[0]["is_pro"].as<bool>();
            bool is_super_admin = r[0]["is_super_admin"].isNull() ? false : r[0]["is_super_admin"].as<bool>();
            bool has_extended_limits = is_pro || is_super_admin;
            int max_projects = has_extended_limits ? 50 : 15;
            size_t max_size = has_extended_limits ? 50 * 1024 * 1024 : 2 * 1024 * 1024;

            dbClient->execSqlAsync(
                "SELECT COUNT(*) FROM projects WHERE user_id = $1 AND deleted_at IS NULL",
                [req, callback, dbClient, user_id, max_projects, max_size, has_extended_limits](const drogon::orm::Result& r_count) {
                    int count = r_count[0][0].as<int>();
                    if (count >= max_projects) {
                        Json::Value err;
                        err["error"] = "Project limit reached. Please consider deleting projects not actively used by you before uploading new ones.";
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
                    if (total_size > max_size) {
                        Json::Value err;
                        err["error"] = "Project size exceeds the allocated capacity for your account tier. Please ensure your filesystem snapshot is small.";
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
                    std::vector<std::string> recording_files;
                    for (auto& file : fileUpload.getFiles()) {
                        std::string itemName = file.getItemName(); 
                        std::string targetName;

                        if (itemName == "manifest") targetName = "manifest.json";
                        else if (itemName == "baseline") { targetName = "baseline.tar.gz"; has_baseline = true; }
                        else if (itemName.find("recording") == 0) { 
                            targetName = itemName + ".cast"; 
                            recording_files.push_back(itemName); 
                        }
                        else targetName = file.getFileName(); 

                        std::string absolute_save_path = (cast_dir / targetName).string();
                        file.saveAs(absolute_save_path);
                    }

                    bool delete_baseline = false;
                    for (auto const& field : fileUpload.getParameters()) {
                        if (field.first == "delete_baseline" && field.second == "true") delete_baseline = true;
                        // For multiple casts, deletion is likely handled differently or via re-upload.
                    }

                    if (delete_baseline) {
                        try { fs::remove(cast_dir / "baseline.tar.gz"); } catch (...) {}
                        has_baseline = false;
                    }

                    std::string baseline_val = has_baseline ? (cast_uuid + "/baseline.tar.gz") : "";

                    bool has_keystrokes = false;
                    for (const auto& rec : recording_files) {
                        std::ifstream rec_file((cast_dir / (rec + ".cast")).string());
                        std::string line;
                        while (std::getline(rec_file, line)) {
                            if (line.find("\"i\"") != std::string::npos) {
                                has_keystrokes = true;
                                break;
                            }
                        }
                        if (has_keystrokes) break;
                    }

                    // 4.5 Extract project name from manifest if possible
                    std::string project_title = "";
                    try {
                        std::ifstream manifest_file((cast_dir / "manifest.json").string());
                        Json::Value manifest_json;
                        manifest_file >> manifest_json;
                        if (manifest_json.isMember("environment") && manifest_json["environment"].isMember("project")) {
                            project_title = manifest_json["environment"]["project"].asString();
                        }
                    } catch (...) {}

                    // Extract titles from form data
                    std::map<std::string, std::string> cast_titles;
                    for (auto const& field : fileUpload.getParameters()) {
                        if (field.first.find("title_") == 0) {
                            std::string rec_name = "recording_" + field.first.substr(6);
                            cast_titles[rec_name] = field.second.empty() ? project_title : field.second;
                        }
                    }

                    bool is_public = true;
                    for (auto const& field : fileUpload.getParameters()) {
                        if (field.first == "is_public") is_public = (field.second == "true");
                    }

                    // 5. Insert Project and Cast utilizing NULLIF
                    dbClient->execSqlAsync(
                        "INSERT INTO projects (user_id, name, manifest_url, baseline_url, show_keystrokes, allow_fs_download, embed_theme, is_public) VALUES ($1, COALESCE(NULLIF($2, ''), 'Untitled Project'), $3, NULLIF($4, ''), $5, $6, $7, $8) RETURNING id",
                        [callback, cast_uuid, user_id, project_title, recording_files, cast_titles, dbClient](const drogon::orm::Result& res) {
                            int project_id = res[0]["id"].as<int>();
                            
                            // Insert all recordings
                            if (recording_files.empty()) {
                                const char* env_url = getenv("APP_URL");
                                std::string base_url = env_url ? std::string(env_url) : "http://localhost:8080";
                                if (!base_url.empty() && base_url.back() == '/') base_url.pop_back();

                                Json::Value ret;
                                ret["status"] = "success";
                                ret["cast_id"] = cast_uuid;
                                ret["url"] = base_url + "/view/" + cast_uuid; 
                                callback(drogon::HttpResponse::newHttpJsonResponse(ret));
                                return;
                            }

                            auto counter = std::make_shared<int>(recording_files.size());
                            for (const auto& rec : recording_files) {
                                std::string rec_url = cast_uuid + "/" + rec + ".cast";
                                std::string title = cast_titles.count(rec) ? cast_titles.at(rec) : project_title;
                                
                                dbClient->execSqlAsync(
                                    "INSERT INTO casts (user_id, project_id, title, recording_url) VALUES ($1, $2, NULLIF($3, ''), NULLIF($4, ''))",
                                    [callback, cast_uuid, counter](const drogon::orm::Result& res2) {
                                        (*counter)--;
                                        if (*counter == 0) {
                                            const char* env_url = getenv("APP_URL");
                                            std::string base_url = env_url ? std::string(env_url) : "http://localhost:8080";
                                            if (!base_url.empty() && base_url.back() == '/') base_url.pop_back();

                                            Json::Value ret;
                                            ret["status"] = "success";
                                            ret["cast_id"] = cast_uuid;
                                            ret["url"] = base_url + "/view/" + cast_uuid; 
                                            callback(drogon::HttpResponse::newHttpJsonResponse(ret));
                                        }
                                    },
                                    [callback](const drogon::orm::DrogonDbException& e) {
                                        auto resp = drogon::HttpResponse::newHttpResponse();
                                        resp->setStatusCode(drogon::k500InternalServerError);
                                        callback(resp);
                                    },
                                    user_id, project_id, title, rec_url
                                );
                            }
                        },
                        [callback](const drogon::orm::DrogonDbException& e) {
                            auto resp = drogon::HttpResponse::newHttpResponse();
                            resp->setStatusCode(drogon::k500InternalServerError);
                            callback(resp);
                        },
                        user_id, 
                        project_title,
                        cast_uuid + "/manifest.json", 
                        baseline_val, 
                        has_keystrokes,
                        true, // allow_fs_download
                        "dark", // embed_theme
                        is_public
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
        "SELECT p.id, p.name, p.manifest_url, p.baseline_url, p.theme, p.show_keystrokes, p.allow_fs_download, p.embed_theme, p.created_at, (p.is_public = true) as is_public, p.user_id "
        "FROM projects p WHERE p.manifest_url LIKE $1 AND p.deleted_at IS NULL",
        [req, callback, dbClient, id](const drogon::orm::Result& r) {
            if (r.empty()) {
                auto resp = drogon::HttpResponse::newHttpResponse();
                resp->setStatusCode(drogon::k404NotFound);
                callback(resp);
                return;
            }
            
            auto const& row = r[0];
            bool is_public = row["is_public"].isNull() ? true : row["is_public"].as<bool>();
            int owner_id = row["user_id"].as<int>();

            auto proceed = [callback, dbClient, id, row, is_public]() {
                int project_id = row["id"].as<int>();
                Json::Value castObj;
                castObj["id"] = id;
                castObj["name"] = row["name"].isNull() ? "" : row["name"].as<std::string>();
                castObj["has_baseline"] = !row["baseline_url"].isNull();
                castObj["theme"] = row["theme"].isNull() ? "mocha" : row["theme"].as<std::string>();
                castObj["show_keystrokes"] = row["show_keystrokes"].isNull() ? true : row["show_keystrokes"].as<bool>();
                castObj["allow_fs_download"] = row["allow_fs_download"].isNull() ? true : row["allow_fs_download"].as<bool>();
                castObj["embed_theme"] = row["embed_theme"].isNull() ? "dark" : row["embed_theme"].as<std::string>();
                castObj["is_public"] = is_public;
                
                dbClient->execSqlAsync(
                    "SELECT id, title, recording_url FROM casts WHERE project_id = $1 AND deleted_at IS NULL ORDER BY created_at ASC",
                    [callback, castObj](const drogon::orm::Result& r2) mutable {
                        castObj["casts"] = Json::arrayValue;
                        for (auto const& c_row : r2) {
                            Json::Value c;
                            c["id"] = c_row["id"].as<int>();
                            c["title"] = c_row["title"].isNull() ? "" : c_row["title"].as<std::string>();
                            c["recording_url"] = c_row["recording_url"].as<std::string>();
                            castObj["casts"].append(c);
                        }
                        castObj["has_recording"] = (r2.size() > 0);
                        callback(drogon::HttpResponse::newHttpJsonResponse(castObj));
                    },
                    [callback](const drogon::orm::DrogonDbException& e) {
                        auto resp = drogon::HttpResponse::newHttpResponse();
                        resp->setStatusCode(drogon::k500InternalServerError);
                        callback(resp);
                    },
                    project_id
                );
            };

            if (is_public) {
                proceed();
            } else {
                std::string auth_header = req->getHeader("Authorization");
                if (auth_header.empty() || auth_header.find("Bearer ") != 0) {
                    auto resp = drogon::HttpResponse::newHttpResponse();
                    resp->setStatusCode(drogon::k401Unauthorized);
                    callback(resp);
                    return;
                }
                std::string api_key = auth_header.substr(7);
                dbClient->execSqlAsync(
                    "SELECT id, is_super_admin FROM users WHERE api_key = $1",
                    [callback, proceed, owner_id](const drogon::orm::Result& user_r) {
                        if (user_r.empty()) {
                            auto resp = drogon::HttpResponse::newHttpResponse();
                            resp->setStatusCode(drogon::k401Unauthorized);
                            callback(resp);
                            return;
                        }
                        int user_id = user_r[0]["id"].as<int>();
                        bool is_super_admin = user_r[0]["is_super_admin"].isNull() ? false : user_r[0]["is_super_admin"].as<bool>();
                        
                        if (user_id == owner_id || is_super_admin) {
                            proceed();
                        } else {
                            auto resp = drogon::HttpResponse::newHttpResponse();
                            resp->setStatusCode(drogon::k403Forbidden);
                            callback(resp);
                        }
                    },
                    [callback](const drogon::orm::DrogonDbException& e) {
                        auto resp = drogon::HttpResponse::newHttpResponse();
                        resp->setStatusCode(drogon::k500InternalServerError);
                        callback(resp);
                    },
                    api_key
                );
            }
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
        "SELECT projects.id, projects.user_id, (users.is_pro = true) as is_pro, (users.is_super_admin = true) as is_super_admin FROM projects JOIN users ON projects.user_id = users.id WHERE users.api_key = $1 AND projects.manifest_url LIKE $2 AND projects.deleted_at IS NULL",
        [req, callback, dbClient, id, like_pattern](const drogon::orm::Result& r) {
            if (r.empty()) {
                auto resp = drogon::HttpResponse::newHttpResponse();
                resp->setStatusCode(drogon::k403Forbidden);
                callback(resp);
                return;
            }
            int project_id = r[0]["id"].as<int>();
            int user_id = r[0]["user_id"].as<int>();
            bool is_pro = r[0]["is_pro"].isNull() ? false : r[0]["is_pro"].as<bool>();
            bool is_super_admin = r[0]["is_super_admin"].isNull() ? false : r[0]["is_super_admin"].as<bool>();
            bool has_extended_limits = is_pro || is_super_admin;

            // Check if user has exceeded limits (Grandfathering logic)
            dbClient->execSqlAsync(
                "SELECT "
                "(SELECT COUNT(*) FROM projects WHERE user_id = $1 AND deleted_at IS NULL) as project_count, "
                "(SELECT COUNT(*) FROM casts WHERE project_id = $2 AND deleted_at IS NULL) as cast_count",
                [req, callback, dbClient, id, project_id, user_id, has_extended_limits](const drogon::orm::Result& r_counts) {
                    long long project_count = r_counts[0]["project_count"].as<long long>();
                    long long cast_count = r_counts[0]["cast_count"].as<long long>();

                    if (!has_extended_limits) {
                        if (project_count > 15) {
                            Json::Value err;
                            err["error"] = "Project limit exceeded. You can view your projects, but editing is disabled as you have more than 15 projects. Please delete some or upgrade to Pro.";
                            auto resp = drogon::HttpResponse::newHttpJsonResponse(err);
                            resp->setStatusCode(drogon::k403Forbidden);
                            callback(resp);
                            return;
                        }
                        if (cast_count > 1) {
                            Json::Value err;
                            err["error"] = "This is a 'Super Project' with multiple recordings. Editing Super Projects is restricted to Pro users.";
                            auto resp = drogon::HttpResponse::newHttpJsonResponse(err);
                            resp->setStatusCode(drogon::k403Forbidden);
                            callback(resp);
                            return;
                        }
                    }

                    size_t max_size = has_extended_limits ? 50 * 1024 * 1024 : 2 * 1024 * 1024;

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
                    if (total_size > max_size) {
                        Json::Value err;
                        err["error"] = "Project size exceeds the allocated capacity for your account tier.";
                        auto resp = drogon::HttpResponse::newHttpJsonResponse(err);
                        resp->setStatusCode(drogon::k413RequestEntityTooLarge);
                        callback(resp);
                        return;
                    }

                    // Setup Directory - Clear out old contents if needed
                    std::string upload_path_from_config = drogon::app().getUploadPath();
                    fs::path root_upload_path(upload_path_from_config);
                    fs::path cast_dir = root_upload_path / id;

                    std::vector<int> casts_to_delete;
                    for (auto const& field : fileUpload.getParameters()) {
                        if (field.first.find("delete_cast_") == 0) {
                            try { casts_to_delete.push_back(std::stoi(field.first.substr(12))); } catch (...) {}
                        }
                    }

                    std::vector<std::string> recording_files;
                    for (auto const& file : fileUpload.getFiles()) {
                        std::string targetName = "";
                        if (file.getItemName().find("recording_") == 0) {
                            targetName = file.getItemName().substr(10);
                            recording_files.push_back(targetName);
                            targetName += ".cast";
                        }
                        else targetName = file.getFileName(); 

                        std::string absolute_save_path = (cast_dir / targetName).string();
                        file.saveAs(absolute_save_path);
                    }

                    bool delete_baseline = false;
                    for (auto const& field : fileUpload.getParameters()) {
                        if (field.first == "delete_baseline" && field.second == "true") delete_baseline = true;
                    }

                    if (delete_baseline) {
                        try { fs::remove(cast_dir / "baseline.tar.gz"); } catch (...) {}
                    }

                    std::string baseline_val = ""; // Baseline might be kept or updated
                    // Logic to check if baseline exists or was just uploaded
                    if (fs::exists(cast_dir / "baseline.tar.gz")) {
                        baseline_val = id + "/baseline.tar.gz";
                    }

                    bool has_keystrokes = false;
                    for (const auto& rec : recording_files) {
                        std::ifstream rec_file((cast_dir / (rec + ".cast")).string());
                        std::string line;
                        while (std::getline(rec_file, line)) {
                            if (line.find("\"i\"") != std::string::npos) {
                                has_keystrokes = true;
                                break;
                            }
                        }
                        if (has_keystrokes) break;
                    }

                    std::string project_title = "";
                    try {
                        std::ifstream manifest_file((cast_dir / "manifest.json").string());
                        Json::Value manifest_json;
                        manifest_file >> manifest_json;
                        if (manifest_json.isMember("environment") && manifest_json["environment"].isMember("project")) {
                            project_title = manifest_json["environment"]["project"].asString();
                        }
                    } catch (...) { }

                    std::map<std::string, std::string> cast_titles;
                    std::map<int, std::string> cast_titles_to_update;
                    bool is_public_update = true;
                    bool has_public_update = false;

                    for (auto const& field : fileUpload.getParameters()) {
                        if (field.first.find("title_") == 0) {
                            std::string rec_name = "recording_" + field.first.substr(6);
                            cast_titles[rec_name] = field.second.empty() ? project_title : field.second;
                        } else if (field.first.find("update_title_") == 0) {
                            try {
                                int cast_id = std::stoi(field.first.substr(13));
                                cast_titles_to_update[cast_id] = field.second;
                            } catch (...) {}
                        } else if (field.first == "is_public") {
                            is_public_update = (field.second == "true");
                            has_public_update = true;
                        }
                    }

                    // Execute Update Titles Query
                    for (const auto& pair : cast_titles_to_update) {
                        dbClient->execSqlAsync(
                            "UPDATE casts SET title = NULLIF($1, '') WHERE id = $2 AND project_id = $3",
                            [](const drogon::orm::Result& r) {},
                            [](const drogon::orm::DrogonDbException& e) {},
                            pair.second, pair.first, project_id
                        );
                    }

                    // Execute Delete Casts Query
                    if (!casts_to_delete.empty()) {
                        for (int cast_del_id : casts_to_delete) {
                            dbClient->execSqlAsync(
                                "UPDATE casts SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1 AND project_id = $2",
                                [](const drogon::orm::Result& r) {},
                                [](const drogon::orm::DrogonDbException& e) {},
                                cast_del_id, project_id
                            );
                        }
                    }

                    // Update Database Project
                    dbClient->execSqlAsync(
                        "UPDATE projects SET "
                        "name = COALESCE(NULLIF($1, ''), name), "
                        "baseline_url = CASE WHEN $2 = '__DELETE__' THEN NULL WHEN $2 <> '' THEN $2 ELSE baseline_url END, "
                        "show_keystrokes = CASE WHEN $5 THEN $3 ELSE show_keystrokes END, "
                        "is_public = CASE WHEN $6 THEN $7 ELSE is_public END "
                        "WHERE id = $4",
                        [callback, dbClient, id, project_id, user_id, project_title, recording_files, cast_titles](const drogon::orm::Result& res) {
                            
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

                            if (recording_files.empty()) {
                                returnSuccess();
                                return;
                            }

                            auto counter = std::make_shared<int>(recording_files.size());
                            for (const auto& rec : recording_files) {
                                std::string rec_url = id + "/" + rec + ".cast";
                                std::string title = cast_titles.count(rec) ? cast_titles.at(rec) : project_title;
                                
                                dbClient->execSqlAsync(
                                    "INSERT INTO casts (user_id, project_id, title, recording_url) VALUES ($1, $2, NULLIF($3, ''), NULLIF($4, ''))",
                                    [returnSuccess, counter](const drogon::orm::Result& res2) {
                                        (*counter)--;
                                        if (*counter == 0) returnSuccess();
                                    },
                                    [callback](const drogon::orm::DrogonDbException& e) {
                                        auto resp = drogon::HttpResponse::newHttpResponse();
                                        resp->setStatusCode(drogon::k500InternalServerError);
                                        callback(resp);
                                    },
                                    user_id, project_id, title, rec_url
                                );
                            }
                        },
                        [callback](const drogon::orm::DrogonDbException& e) {
                            auto resp = drogon::HttpResponse::newHttpResponse();
                            resp->setStatusCode(drogon::k500InternalServerError);
                            callback(resp);
                        },
                        project_title,
                        baseline_val,
                        has_keystrokes,
                        project_id,
                        !recording_files.empty(),
                        has_public_update,
                        is_public_update
                    );
                },
                [callback](const drogon::orm::DrogonDbException& e) {
                    auto resp = drogon::HttpResponse::newHttpResponse();
                    resp->setStatusCode(drogon::k500InternalServerError);
                    callback(resp);
                },
                user_id, project_id
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