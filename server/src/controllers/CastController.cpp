#include "CastController.hpp"
#include <filesystem>
#include <drogon/utils/Utilities.h>

namespace fs = std::filesystem;

void CastController::uploadCast(const drogon::HttpRequestPtr& req, std::function<void(const drogon::HttpResponsePtr&)>&& callback) {
    // 1. Auth Logic (Keep your working auth check here)
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
            if (fileUpload.parse(req) != 0 || fileUpload.getFiles().size() != 3) {
                auto resp = drogon::HttpResponse::newHttpResponse();
                resp->setStatusCode(drogon::k400BadRequest);
                resp->setBody("Incomplete upload assets");
                callback(resp);
                return;
            }

            // 3. Setup the Flat Directory Structure
            std::string cast_uuid = drogon::utils::getUuid();
            
            // Get the upload path from config and append the UUID
            // This ensures we create: public/uploads/<UUID>/
            std::string upload_path_from_config = drogon::app().getUploadPath();
            fs::path root_upload_path(upload_path_from_config);
            fs::path cast_dir = root_upload_path / cast_uuid;

            try {
                // Create the UUID directory only (not directories for the files!)
                fs::create_directories(cast_dir);
            } catch (const std::exception& e) {
                LOG_ERROR << "FS Error: " << e.what();
                auto resp = drogon::HttpResponse::newHttpResponse();
                resp->setStatusCode(drogon::k500InternalServerError);
                callback(resp);
                return;
            }

            // 4. Save files directly into the UUID folder
            for (auto& file : fileUpload.getFiles()) {
                std::string itemName = file.getItemName(); // "manifest", "baseline", "recording"
                std::string targetName;

                if (itemName == "manifest") targetName = "manifest.json";
                else if (itemName == "baseline") targetName = "baseline.tar.gz";
                else if (itemName == "recording") targetName = "recording.cast";
                else targetName = file.getFileName(); // fallback

                // Use absolute path for saving to avoid Drogon's internal relative path guessing
                std::string absolute_save_path = (cast_dir / targetName).string();
                file.saveAs(absolute_save_path);
            }

            // 5. Update Database
            dbClient->execSqlAsync(
                "INSERT INTO casts (user_id, manifest_url, baseline_url, recording_url) VALUES ($1, $2, $3, $4)",
                [callback, cast_uuid](const drogon::orm::Result& res) {
                    Json::Value ret;
                    ret["status"] = "success";
                    ret["cast_id"] = cast_uuid;
                    ret["url"] = "http://localhost:8080/view/" + cast_uuid;
                    callback(drogon::HttpResponse::newHttpJsonResponse(ret));
                },
                [callback](const drogon::orm::DrogonDbException& e) {
                    auto resp = drogon::HttpResponse::newHttpResponse();
                    resp->setStatusCode(drogon::k500InternalServerError);
                    callback(resp);
                },
                user_id, 
                cast_uuid + "/manifest.json", 
                cast_uuid + "/baseline.tar.gz", 
                cast_uuid + "/recording.cast"
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