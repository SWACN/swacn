#pragma once
#include <drogon/HttpController.h>

class PaymentController : public drogon::HttpController<PaymentController> {
  public:
    METHOD_LIST_BEGIN
      ADD_METHOD_TO(PaymentController::createCheckout, "/v1/payments/checkout", drogon::Post);
      ADD_METHOD_TO(PaymentController::webhook, "/webhooks/dodopayments", drogon::Post);
    METHOD_LIST_END

    // POST /api/v1/payments/checkout
    // Requires Bearer token. Creates a Dodo Payments checkout session.
    void createCheckout(const drogon::HttpRequestPtr& req, std::function<void(const drogon::HttpResponsePtr&)>&& callback);

    // POST /api/webhooks/dodopayments
    // Receives events from Dodo Payments (no auth token, uses HMAC signature verification).
    void webhook(const drogon::HttpRequestPtr& req, std::function<void(const drogon::HttpResponsePtr&)>&& callback);

  private:
    // Verifies the Dodo Payments webhook signature using HMAC-SHA256
    bool verifyWebhookSignature(const std::string& payload, const std::string& signature, const std::string& secret);
};
