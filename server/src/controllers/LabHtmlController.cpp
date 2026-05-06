#include "LabHtmlController.hpp"
#include <fstream>
#include <sstream>
#include <drogon/utils/Utilities.h>

void LabHtmlController::serveLab(const drogon::HttpRequestPtr& req, std::function<void(const drogon::HttpResponsePtr&)>&& callback, std::string id) {
    auto dbClient = drogon::app().getDbClient();
    std::string like_pattern = id + "/%";

    dbClient->execSqlAsync(
        "SELECT name FROM projects WHERE manifest_url LIKE $1",
        [callback, id, req](const drogon::orm::Result& r) {
            std::string document_root = drogon::app().getDocumentRoot();
            if (document_root.empty()) {
                document_root = "./public";
            }
            std::ifstream file(document_root + "/index.html");
            if (!file.is_open()) {
                auto resp = drogon::HttpResponse::newHttpResponse();
                resp->setStatusCode(drogon::k404NotFound);
                callback(resp);
                return;
            }
            std::stringstream buffer;
            buffer << file.rdbuf();
            std::string html = buffer.str();

            std::string project_name = (r.size() > 0 && !r[0]["name"].isNull()) ? r[0]["name"].as<std::string>() : "Terminal Session";
            if (project_name.empty()) project_name = "Terminal Session";

            const char* env_url = getenv("APP_URL");
            std::string base_url = env_url ? std::string(env_url) : "https://swacn.com";
            if (!base_url.empty() && base_url.back() == '/') base_url.pop_back();

            std::string query = req->query();
            std::string full_url = base_url + "/lab/" + id;
            if (!query.empty()) {
                full_url += "?" + query;
            }
            
            std::string encoded_url = drogon::utils::urlEncodeComponent(full_url);
            std::string oembed_url = base_url + "/oembed?url=" + encoded_url + "&format=json";
            std::string share_img = base_url + "/assets/share.png";
            std::string embed_url = full_url;
            if (embed_url.find("?") != std::string::npos) {
                embed_url += "&embed=true";
            } else {
                embed_url += "?embed=true";
            }

            // Build Comprehensive Meta Tags
            std::stringstream tags;
            tags << "\n    <!-- Primary Meta Tags -->\n";
            tags << "    <title>SWACN | " << project_name << "</title>\n";
            tags << "    <meta name=\"title\" content=\"SWACN | " << project_name << "\">\n";
            tags << "    <meta name=\"description\" content=\"Interactive terminal lab environment on SWACN.\">\n";
            
            tags << "\n    <!-- Open Graph / Facebook -->\n";
            tags << "    <meta property=\"og:type\" content=\"video.other\">\n";
            tags << "    <meta property=\"og:url\" content=\"" << full_url << "\">\n";
            tags << "    <meta property=\"og:site_name\" content=\"SWACN\">\n";
            tags << "    <meta property=\"og:title\" content=\"SWACN | " << project_name << "\">\n";
            tags << "    <meta property=\"og:description\" content=\"Interactive terminal lab environment.\">\n";
            tags << "    <meta property=\"og:image\" content=\"" << share_img << "\">\n";
            tags << "    <meta property=\"og:video\" content=\"" << embed_url << "\">\n";
            tags << "    <meta property=\"og:video:secure_url\" content=\"" << embed_url << "\">\n";
            tags << "    <meta property=\"og:video:type\" content=\"text/html\">\n";
            tags << "    <meta property=\"og:video:width\" content=\"800\">\n";
            tags << "    <meta property=\"og:video:height\" content=\"600\">\n";
            
            tags << "\n    <!-- Twitter -->\n";
            tags << "    <meta property=\"twitter:card\" content=\"player\">\n";
            tags << "    <meta property=\"twitter:url\" content=\"" << full_url << "\">\n";
            tags << "    <meta property=\"twitter:title\" content=\"SWACN | " << project_name << "\">\n";
            tags << "    <meta property=\"twitter:description\" content=\"Interactive terminal lab environment.\">\n";
            tags << "    <meta property=\"twitter:image\" content=\"" << share_img << "\">\n";
            tags << "    <meta property=\"twitter:player\" content=\"" << embed_url << "\">\n";
            tags << "    <meta property=\"twitter:player:width\" content=\"800\">\n";
            tags << "    <meta property=\"twitter:player:height\" content=\"600\">\n";

            tags << "\n    <!-- oEmbed Discovery -->\n";
            tags << "    <link rel=\"alternate\" type=\"application/json+oembed\" href=\"" << oembed_url << "\" title=\"" << project_name << "\" />\n";
            tags << "    <link rel=\"alternate\" type=\"text/xml+oembed\" href=\"" << oembed_url << "&format=xml\" title=\"" << project_name << "\" />\n";

            size_t head_close_pos = html.find("</head>");
            if (head_close_pos != std::string::npos) {
                html.insert(head_close_pos, tags.str());
            }

            auto resp = drogon::HttpResponse::newHttpResponse();
            resp->setBody(html);
            resp->setContentTypeCode(drogon::CT_TEXT_HTML);
            // Add oEmbed discovery via HTTP Header
            resp->addHeader("Link", "<" + oembed_url + ">; rel=\"alternate\"; type=\"application/json+oembed\"");
            
            // Enable Cloudflare Caching for public projects (1 hour)
            resp->addHeader("Cache-Control", "public, max-age=3600");
            
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
