#pragma once
#include <drogon/HttpController.h>

class LabHtmlController : public drogon::HttpController<LabHtmlController> {
  public:
    METHOD_LIST_BEGIN
        ADD_METHOD_TO(LabHtmlController::serveLab, "/lab/{id}", drogon::Get);
    METHOD_LIST_END

    void serveLab(const drogon::HttpRequestPtr& req, std::function<void(const drogon::HttpResponsePtr&)>&& callback, std::string id);
};
