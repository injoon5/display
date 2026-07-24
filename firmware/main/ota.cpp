#include "ota.h"

#include <cstring>

#include "config.h"
#include "esp_https_ota.h"
#include "esp_log.h"
#include "esp_ota_ops.h"
#include "esp_system.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

namespace {
constexpr char kTag[] = "ota";
constexpr char kLegacyUnsignedToken[] = "ED25519_SIGNATURE_TODO";

TaskHandle_t s_ota_task_handle = nullptr;
OtaManifest s_pending_manifest{};
bool s_has_pending_manifest = false;

bool is_hex_char(char c) {
    return (c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F');
}

bool is_exactly_64_hex(const char *signature) {
    if (!signature) {
        return false;
    }
    size_t len = 0;
    for (; signature[len] != '\0'; ++len) {
        if (len >= 64 || !is_hex_char(signature[len])) {
            return false;
        }
    }
    return len == 64;
}

bool pubkey_is_configured() {
    return MX_OTA_ED25519_PUBKEY_HEX[0] != '\0';
}

bool pubkey_looks_valid() {
    // Expect a hex-encoded 32-byte ed25519 public key (64 hex chars).
    return is_exactly_64_hex(MX_OTA_ED25519_PUBKEY_HEX);
}

bool ota_verify_signature_stub(const OtaManifest &manifest) {
    if (manifest.signature[0] == '\0') {
        ESP_LOGW(kTag, "Manifest signature missing");
        return false;
    }

    const bool is_todo = std::strcmp(manifest.signature.data(), kLegacyUnsignedToken) == 0;
    const bool is_hex64 = is_exactly_64_hex(manifest.signature.data());

    if (pubkey_is_configured()) {
        if (!pubkey_looks_valid()) {
            ESP_LOGE(kTag, "Baked MX_OTA_ED25519_PUBKEY_HEX is not 64 hex chars");
            return false;
        }
        if (!is_hex64) {
            ESP_LOGE(kTag, "Signature must be 64 hex chars when a public key is baked in");
            return false;
        }
        // Production path: format matches expected ed25519 signature encoding.
        // Wire mbedtls/libsodium ed25519 verify against the image sha256 here.
        ESP_LOGI(
            kTag,
            "Accepting 64-hex signature with baked public key present (crypto verify TODO)");
        return true;
    }

#if MX_OTA_ALLOW_UNSIGNED
    if (is_hex64) {
        ESP_LOGW(kTag, "Demo OTA: accepting deterministic 64-hex signature (unsigned mode)");
        return true;
    }
    if (is_todo) {
        ESP_LOGW(kTag, "Demo OTA: accepting legacy %s token (unsigned mode)", kLegacyUnsignedToken);
        return true;
    }
    ESP_LOGE(kTag, "Demo OTA: signature must be 64 hex chars or %s", kLegacyUnsignedToken);
    return false;
#else
    (void)is_todo;
    ESP_LOGE(kTag, "Unsigned OTA disabled; bake MX_OTA_ED25519_PUBKEY_HEX for release builds");
    return false;
#endif
}
}  // namespace

void ota_mark_running_image_valid() {
    const esp_err_t err = esp_ota_mark_app_valid_cancel_rollback();
    if (err != ESP_OK && err != ESP_ERR_NOT_FOUND && err != ESP_ERR_INVALID_STATE) {
        ESP_LOGW(kTag, "Failed to mark image valid: %s", esp_err_to_name(err));
    }
}

bool ota_request_update(const OtaManifest &manifest) {
    if (manifest.url[0] == '\0') {
        return false;
    }

    s_pending_manifest = manifest;
    s_has_pending_manifest = true;
    if (s_ota_task_handle) {
        xTaskNotifyGive(s_ota_task_handle);
    }
    return true;
}

void ota_task(void *arg) {
    (void)arg;
    s_ota_task_handle = xTaskGetCurrentTaskHandle();
    ESP_LOGI(kTag, "OTA task pinned to core %d", xPortGetCoreID());

    while (true) {
        ulTaskNotifyTake(pdTRUE, portMAX_DELAY);
        if (!s_has_pending_manifest) {
            continue;
        }

        OtaManifest manifest = s_pending_manifest;
        s_has_pending_manifest = false;

        if (!ota_verify_signature_stub(manifest)) {
            ESP_LOGE(kTag, "Manifest signature rejected");
            continue;
        }

        esp_http_client_config_t http_cfg = {};
        http_cfg.url = manifest.url.data();
        http_cfg.timeout_ms = 15'000;
        http_cfg.keep_alive_enable = true;

        esp_https_ota_config_t ota_cfg = {};
        ota_cfg.http_config = &http_cfg;

        ESP_LOGI(kTag, "Starting OTA for %s", manifest.version.data());
        const esp_err_t err = esp_https_ota(&ota_cfg);
        if (err != ESP_OK) {
            ESP_LOGE(kTag, "OTA failed: %s", esp_err_to_name(err));
            continue;
        }

        ESP_LOGI(kTag, "OTA complete, rebooting into inactive slot");
        esp_restart();
    }
}
