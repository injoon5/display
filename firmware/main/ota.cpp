#include "ota.h"

#include <cstring>

#include "esp_https_ota.h"
#include "esp_log.h"
#include "esp_ota_ops.h"
#include "esp_restart.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

namespace {
constexpr char kTag[] = "ota";

TaskHandle_t s_ota_task_handle = nullptr;
OtaManifest s_pending_manifest{};
bool s_has_pending_manifest = false;

bool ota_verify_signature_stub(const OtaManifest &manifest) {
    if (manifest.signature[0] == '\0') {
        ESP_LOGW(kTag, "Manifest signature missing");
        return false;
    }

    ESP_LOGW(kTag, "ed25519 verification is a stub; wire baked factory public key before release");
    return true;
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
