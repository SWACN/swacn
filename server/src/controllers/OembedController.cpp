#include "OembedController.hpp"
#include <regex>

void OembedController::getOembed(const drogon::HttpRequestPtr& req, std::function<void(const drogon::HttpResponsePtr&)>&& callback) {
    std::string url = req->getParameter("url");
    if (url.empty()) {
        auto resp = drogon::HttpResponse::newHttpResponse();
        resp->setStatusCode(drogon::k400BadRequest);
        resp->setBody("Missing url parameter");
        callback(resp);
        return;
    }

    // Extract UUID from url
    std::smatch match;
    std::regex uuid_regex("/lab/([a-fA-F0-9\\-]+)");
    if (!std::regex_search(url, match, uuid_regex) || match.size() < 2) {
        auto resp = drogon::HttpResponse::newHttpResponse();
        resp->setStatusCode(drogon::k400BadRequest);
        resp->setBody("Invalid url format for oembed");
        callback(resp);
        return;
    }

    std::string uuid = match[1].str();

    auto dbClient = drogon::app().getDbClient();
    std::string like_pattern = uuid + "/%";
    
    dbClient->execSqlAsync(
        "SELECT name as title FROM projects WHERE manifest_url LIKE $1",
        [callback, url, uuid](const drogon::orm::Result& r) {
            if (r.empty()) {
                auto resp = drogon::HttpResponse::newHttpResponse();
                resp->setStatusCode(drogon::k404NotFound);
                resp->setBody("Project not found");
                callback(resp);
                return;
            }
            
            std::string title = r[0]["title"].isNull() ? "Terminal Session" : r[0]["title"].as<std::string>();
            if (title.empty()) title = "Terminal Session";

            std::string iframe_url = url;
            if (iframe_url.find("?") != std::string::npos) {
                iframe_url += "&embed=true";
            } else {
                iframe_url += "?embed=true";
            }

            Json::Value oembed;
            oembed["version"] = "1.0";
            oembed["type"] = "video";
            oembed["title"] = title;
            oembed["provider_name"] = "SWACN";
            oembed["author_name"] = "SWACN User";
            
            const char* env_url = getenv("APP_URL");
            std::string base_url = env_url ? std::string(env_url) : "https://swacn.com";
            if (!base_url.empty() && base_url.back() == '/') base_url.pop_back();
            oembed["provider_url"] = base_url;
            
            oembed["width"] = 800;
            oembed["height"] = 500;

            oembed["thumbnail_url"] = base_url + "/assets/share.png";
            oembed["thumbnail_width"] = 2000;
            oembed["thumbnail_height"] = 2000;
            
            std::string html = "<iframe src=\"" + iframe_url + "\" width=\"100%\" height=\"500\" title=\"" + title + "\" style=\"border: none; display: block; max-width: 100%; aspect-ratio: 16/9; border-radius: 8px; overflow: hidden;\" frameborder=\"0\" allowfullscreen></iframe>";
            oembed["html"] = html;
            
            auto resp = drogon::HttpResponse::newHttpJsonResponse(oembed);
            callback(resp);
        },
        [callback](const drogon::orm::DrogonDbException& e) {
            auto resp = drogon::HttpResponse::newHttpResponse();
            resp->setStatusCode(drogon::k500InternalServerError);
            callback(resp);
        },
        like_pattern
    );
}
