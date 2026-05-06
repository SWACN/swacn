#include "LabHtmlController.hpp"
#include <fstream>
#include <sstream>
#include <drogon/utils/Utilities.h>

void LabHtmlController::serveLab(const drogon::HttpRequestPtr& req, std::function<void(const drogon::HttpResponsePtr&)>&& callback, std::string id) {
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

    const char* env_url = getenv("APP_URL");
    std::string base_url = env_url ? std::string(env_url) : "http://localhost:3000";
    if (!base_url.empty() && base_url.back() == '/') {
        base_url.pop_back();
    }

    std::string full_url = base_url + "/lab/" + id;
    std::string encoded_url = drogon::utils::urlEncodeComponent(full_url);

    std::string oembed_url = base_url + "/oembed?url=" + encoded_url + "&format=json";
    std::string link_tag = "\n    <link rel=\"alternate\" type=\"application/json+oembed\" href=\"" + oembed_url + "\" title=\"SWACN Project\" />\n";

    size_t head_close_pos = html.find("</head>");
    if (head_close_pos != std::string::npos) {
        html.insert(head_close_pos, link_tag);
    }

    auto resp = drogon::HttpResponse::newHttpResponse();
    resp->setBody(html);
    resp->setContentTypeCode(drogon::CT_TEXT_HTML);
    callback(resp);
}
