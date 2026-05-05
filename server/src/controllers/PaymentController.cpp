#include "PaymentController.hpp"
#include <drogon/HttpClient.h>
#include <drogon/utils/Utilities.h>
#include <openssl/hmac.h>
#include <openssl/sha.h>
#include <iomanip>
#include <sstream>
#include <cstdlib>

// ---------------------------------------------------------------------------
// Helper: HMAC-SHA256 verification for Dodo Payments webhooks
// ---------------------------------------------------------------------------
bool PaymentController::verifyWebhookSignature(
    const std::string& payload,
    const std::string& signature,
    const std::string& secret)
{
    unsigned char digest[EVP_MAX_MD_SIZE];
    unsigned int digest_len = 0;

    HMAC(
        EVP_sha256(),
        secret.c_str(), static_cast<int>(secret.size()),
        reinterpret_cast<const unsigned char*>(payload.c_str()),
        payload.size(),
        digest,
        &digest_len
    );

    std::ostringstream oss;
    for (unsigned int i = 0; i < digest_len; ++i) {
        oss << std::hex << std::setw(2) << std::setfill('0') << static_cast<int>(digest[i]);
    }
    std::string computed = oss.str();

    // Dodo Payments sends: "sha256=<hex_digest>"
    std::string expected = "sha256=" + computed;

    // Constant-time comparison to prevent timing attacks
    if (expected.size() != signature.size()) return false;
    unsigned char result = 0;
    for (size_t i = 0; i < expected.size(); ++i) {
        result |= expected[i] ^ signature[i];
    }
    return result == 0;
}

// ---------------------------------------------------------------------------
// POST /api/v1/payments/checkout
// Creates a Dodo Payments checkout session and returns the checkout_url.
// ---------------------------------------------------------------------------
void PaymentController::createCheckout(
    const drogon::HttpRequestPtr& req,
    std::function<void(const drogon::HttpResponsePtr&)>&& callback)
{
    // 1. Authenticate the user via Bearer token
    std::string auth_header = req->getHeader("Authorization");
    if (auth_header.empty() || auth_header.find("Bearer ") != 0) {
        auto resp = drogon::HttpResponse::newHttpResponse();
        resp->setStatusCode(drogon::k401Unauthorized);
        callback(resp);
        return;
    }
    std::string api_key = auth_header.substr(7);

    // 2. Look up the user in the DB
    auto dbClient = drogon::app().getDbClient();
    dbClient->execSqlAsync(
        "SELECT id, email, username, is_pro FROM users WHERE api_key = $1",
        [callback, api_key](const drogon::orm::Result& r) mutable {
            if (r.empty()) {
                auto resp = drogon::HttpResponse::newHttpResponse();
                resp->setStatusCode(drogon::k401Unauthorized);
                callback(resp);
                return;
            }

            bool is_pro = r[0]["is_pro"].isNull() ? false : r[0]["is_pro"].as<bool>();
            if (is_pro) {
                Json::Value body;
                body["error"] = "You are already a Pro subscriber.";
                auto resp = drogon::HttpResponse::newHttpJsonResponse(body);
                resp->setStatusCode(drogon::k400BadRequest);
                callback(resp);
                return;
            }

            int user_id = r[0]["id"].as<int>();
            std::string email = r[0]["email"].isNull() ? "" : r[0]["email"].as<std::string>();
            std::string username = r[0]["username"].as<std::string>();

            const char* dodo_api_key = getenv("DODO_PAYMENTS_API_KEY");
            const char* product_id   = getenv("DODO_PRO_PRODUCT_ID");
            const char* app_url      = getenv("APP_URL");

            if (!dodo_api_key || !product_id) {
                LOG_ERROR << "DODO_PAYMENTS_API_KEY or DODO_PRO_PRODUCT_ID not set";
                auto resp = drogon::HttpResponse::newHttpResponse();
                resp->setStatusCode(drogon::k500InternalServerError);
                callback(resp);
                return;
            }

            std::string success_url = app_url ? std::string(app_url) + "/dashboard?payment=success" : "http://localhost:3000/dashboard?payment=success";
            std::string cancel_url  = app_url ? std::string(app_url) + "/dashboard?payment=cancelled" : "http://localhost:3000/dashboard?payment=cancelled";

            // 3. Create checkout session via Dodo Payments API
            auto dodo_client = drogon::HttpClient::newHttpClient("https://test.dodopayments.com");
            
            Json::Value checkout_body;
            
            // Dodo expects product_cart array
            Json::Value cart_item;
            cart_item["product_id"] = product_id;
            cart_item["quantity"] = 1;
            checkout_body["product_cart"].append(cart_item);
            
            checkout_body["success_url"] = success_url;
            checkout_body["return_url"] = success_url;
            
            // Pass user metadata so webhook can identify the user (Dodo requires strings)
            Json::Value metadata;
            metadata["user_id"] = std::to_string(user_id);
            checkout_body["metadata"] = metadata;

            if (!email.empty()) {
                Json::Value customer;
                customer["email"] = email;
                customer["name"]  = username;
                checkout_body["customer"] = customer;
            }

            auto post_req = drogon::HttpRequest::newHttpJsonRequest(checkout_body);
            post_req->setPath("/checkouts");
            post_req->setMethod(drogon::Post);
            post_req->addHeader("Authorization", "Bearer " + std::string(dodo_api_key));
            post_req->addHeader("User-Agent", "SWACN-Server/1.0");
            post_req->addHeader("Accept", "application/json");

            dodo_client->sendRequest(post_req, [callback](drogon::ReqResult res, const drogon::HttpResponsePtr& dodo_resp) {
                if (res != drogon::ReqResult::Ok) {
                    LOG_ERROR << "Dodo Payments API request failed with ReqResult: " << (int)res;
                    auto resp = drogon::HttpResponse::newHttpResponse();
                    resp->setStatusCode(drogon::k502BadGateway);
                    callback(resp);
                    return;
                }

                if (!dodo_resp->getJsonObject()) {
                    LOG_ERROR << "Dodo Payments API returned non-JSON response. Status: " << dodo_resp->getStatusCode() 
                              << " Body: " << dodo_resp->getBody();
                    auto resp = drogon::HttpResponse::newHttpResponse();
                    resp->setStatusCode(drogon::k502BadGateway);
                    callback(resp);
                    return;
                }

                auto dodo_json = *dodo_resp->getJsonObject();

                if (!dodo_json.isMember("checkout_url")) {
                    LOG_ERROR << "Dodo Payments response missing 'checkout_url': " << dodo_json.toStyledString();
                    Json::Value body;
                    body["error"] = "Failed to create checkout session.";
                    auto resp = drogon::HttpResponse::newHttpJsonResponse(body);
                    resp->setStatusCode(drogon::k500InternalServerError);
                    callback(resp);
                    return;
                }

                Json::Value ret;
                ret["checkout_url"] = dodo_json["checkout_url"].asString();
                auto resp = drogon::HttpResponse::newHttpJsonResponse(ret);
                callback(resp);
            });
        },
        [callback](const drogon::orm::DrogonDbException& e) {
            LOG_ERROR << "DB Error in createCheckout: " << e.base().what();
            auto resp = drogon::HttpResponse::newHttpResponse();
            resp->setStatusCode(drogon::k500InternalServerError);
            callback(resp);
        },
        api_key
    );
}

// ---------------------------------------------------------------------------
// POST /api/webhooks/dodopayments
// Handles payment events from Dodo Payments.
// ---------------------------------------------------------------------------
void PaymentController::webhook(
    const drogon::HttpRequestPtr& req,
    std::function<void(const drogon::HttpResponsePtr&)>&& callback)
{
    const char* webhook_secret = getenv("DODO_PAYMENTS_WEBHOOK_SECRET");
    if (!webhook_secret) {
        LOG_ERROR << "DODO_PAYMENTS_WEBHOOK_SECRET not set";
        auto resp = drogon::HttpResponse::newHttpResponse();
        resp->setStatusCode(drogon::k500InternalServerError);
        callback(resp);
        return;
    }

    // 1. Verify the signature
    std::string signature = req->getHeader("webhook-signature");
    std::string payload   = std::string(req->getBody());

    if (signature.empty() || !verifyWebhookSignature(payload, signature, std::string(webhook_secret))) {
        LOG_WARN << "Dodo webhook: invalid signature. Rejecting.";
        auto resp = drogon::HttpResponse::newHttpResponse();
        resp->setStatusCode(drogon::k401Unauthorized);
        callback(resp);
        return;
    }

    // 2. Parse the event
    auto json_obj = req->getJsonObject();
    if (!json_obj) {
        auto resp = drogon::HttpResponse::newHttpResponse();
        resp->setStatusCode(drogon::k400BadRequest);
        callback(resp);
        return;
    }

    auto& event = *json_obj;
    std::string event_type = event.isMember("type") ? event["type"].asString() : "";
    LOG_INFO << "Dodo Payments webhook received: " << event_type;

    // 3. Extract user_id from metadata (set during checkout creation)
    int user_id = 0;
    if (event.isMember("data") && event["data"].isMember("metadata") && event["data"]["metadata"].isMember("user_id")) {
        try {
            user_id = std::stoi(event["data"]["metadata"]["user_id"].asString());
        } catch (...) {
            LOG_WARN << "Dodo webhook: invalid user_id format in metadata";
        }
    }

    if (user_id == 0) {
        LOG_WARN << "Dodo webhook: no user_id in metadata for event " << event_type;
        // Return 200 so Dodo doesn't retry — it's not actionable
        auto resp = drogon::HttpResponse::newHttpResponse();
        resp->setStatusCode(drogon::k200OK);
        callback(resp);
        return;
    }

    auto dbClient = drogon::app().getDbClient();

    // subscription.active or payment.succeeded → grant pro
    if (event_type == "subscription.active" ||
        event_type == "payment.succeeded"   ||
        event_type == "subscription.renewed") {

        std::string dodo_subscription_id = "";
        std::string dodo_customer_id     = "";
        if (event.isMember("data")) {
            if (event["data"].isMember("subscription_id"))
                dodo_subscription_id = event["data"]["subscription_id"].asString();
            if (event["data"].isMember("customer_id"))
                dodo_customer_id = event["data"]["customer_id"].asString();
        }

        dbClient->execSqlAsync(
            "UPDATE users SET is_pro = TRUE, dodo_subscription_id = $2, dodo_customer_id = $3, updated_at = NOW() WHERE id = $1",
            [event_type](const drogon::orm::Result& r) {
                LOG_INFO << "User upgraded to Pro via event: " << event_type;
            },
            [event_type](const drogon::orm::DrogonDbException& e) {
                LOG_ERROR << "DB error on pro upgrade (" << event_type << "): " << e.base().what();
            },
            user_id, dodo_subscription_id, dodo_customer_id
        );

    } else if (event_type == "subscription.cancelled" ||
               event_type == "subscription.expired"   ||
               event_type == "subscription.failed") {

        dbClient->execSqlAsync(
            "UPDATE users SET is_pro = FALSE, updated_at = NOW() WHERE id = $1",
            [event_type](const drogon::orm::Result& r) {
                LOG_INFO << "User Pro revoked via event: " << event_type;
            },
            [event_type](const drogon::orm::DrogonDbException& e) {
                LOG_ERROR << "DB error on pro revoke (" << event_type << "): " << e.base().what();
            },
            user_id
        );
    }

    // Always return 200 to acknowledge receipt
    auto resp = drogon::HttpResponse::newHttpResponse();
    resp->setStatusCode(drogon::k200OK);
    callback(resp);
}
