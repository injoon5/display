#include "provision.h"

#include <cstdio>

#include "config.h"
#include "esp_event.h"
#include "esp_log.h"
#include "esp_mac.h"
#include "esp_wifi.h"
#include "wifi_provisioning/manager.h"
#include "wifi_provisioning/scheme_ble.h"

namespace {
constexpr char kTag[] = "provision";
bool s_prov_mgr_ready = false;

void on_provisioning_event(void *arg, esp_event_base_t event_base, int32_t event_id, void *event_data) {
    (void)arg;
    (void)event_data;
    if (event_base != WIFI_PROV_EVENT) {
        return;
    }

    switch (event_id) {
        case WIFI_PROV_START:
            ESP_LOGI(kTag, "Provisioning started");
            break;
        case WIFI_PROV_CRED_SUCCESS:
            ESP_LOGI(kTag, "Provisioning credentials accepted");
            break;
        case WIFI_PROV_END:
            ESP_LOGI(kTag, "Provisioning finished; releasing BLE stack");
            wifi_prov_mgr_deinit();
            s_prov_mgr_ready = false;
            break;
        default:
            break;
    }
}
}  // namespace

void provision_start_if_needed() {
    wifi_prov_mgr_config_t config = {
        .scheme = wifi_prov_scheme_ble,
        .scheme_event_handler = WIFI_PROV_SCHEME_BLE_EVENT_HANDLER_FREE_BTDM,
    };

    if (!s_prov_mgr_ready) {
        ESP_ERROR_CHECK(wifi_prov_mgr_init(config));
        ESP_ERROR_CHECK(esp_event_handler_register(WIFI_PROV_EVENT, ESP_EVENT_ANY_ID, &on_provisioning_event, nullptr));
        s_prov_mgr_ready = true;
    }

    bool provisioned = false;
    ESP_ERROR_CHECK(wifi_prov_mgr_is_provisioned(&provisioned));
    if (provisioned) {
        ESP_LOGI(kTag, "Wi-Fi already provisioned; connecting station");
        wifi_prov_mgr_deinit();
        s_prov_mgr_ready = false;
        ESP_ERROR_CHECK(esp_wifi_connect());
        return;
    }

    uint8_t mac[6] = {};
    ESP_ERROR_CHECK(esp_read_mac(mac, ESP_MAC_WIFI_STA));

    char service_name[16];
    snprintf(service_name, sizeof(service_name), "MXPANEL-%02X%02X", mac[4], mac[5]);
    const char *service_key = nullptr;
    const char *proof_of_possession = MX_PROV_POP;

    ESP_LOGI(kTag, "Starting Unified Provisioning over BLE as %s", service_name);
    ESP_ERROR_CHECK(wifi_prov_mgr_start_provisioning(
        WIFI_PROV_SECURITY_1,
        proof_of_possession,
        service_name,
        service_key));
}
