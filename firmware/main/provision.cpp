#include "provision.h"

#include <cstdio>

#include "esp_log.h"
#include "esp_mac.h"
#include "wifi_provisioning/manager.h"
#include "wifi_provisioning/scheme_ble.h"

namespace {
constexpr char kTag[] = "provision";
bool s_prov_mgr_ready = false;
}

void provision_start_if_needed() {
    wifi_prov_mgr_config_t config = {
        .scheme = wifi_prov_scheme_ble,
        .scheme_event_handler = WIFI_PROV_SCHEME_BLE_EVENT_HANDLER_FREE_BTDM,
    };

    if (!s_prov_mgr_ready) {
        ESP_ERROR_CHECK(wifi_prov_mgr_init(config));
        s_prov_mgr_ready = true;
    }

    bool provisioned = false;
    ESP_ERROR_CHECK(wifi_prov_mgr_is_provisioned(&provisioned));
    if (provisioned) {
        ESP_LOGI(kTag, "Wi-Fi already provisioned");
        return;
    }

    uint8_t mac[6] = {};
    ESP_ERROR_CHECK(esp_read_mac(mac, ESP_MAC_WIFI_STA));

    char service_name[16];
    snprintf(service_name, sizeof(service_name), "MXPANEL-%02X%02X", mac[4], mac[5]);
    const char *service_key = nullptr;
    const char *proof_of_possession = nullptr;

    ESP_LOGI(kTag, "Starting Unified Provisioning over BLE as %s", service_name);
    ESP_ERROR_CHECK(wifi_prov_mgr_start_provisioning(
        WIFI_PROV_SECURITY_1,
        reinterpret_cast<const void *>(proof_of_possession),
        service_name,
        service_key));
}
