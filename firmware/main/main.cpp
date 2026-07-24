#include <cstring>

#include "brightness.h"
#include "config.h"
#include "esp_event.h"
#include "esp_log.h"
#include "esp_netif.h"
#include "esp_wifi.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "homespan_panel.h"
#include "matrix_refresh.h"
#include "net_sync.h"
#include "nvs.h"
#include "nvs_flash.h"
#include "offline.h"
#include "ota.h"
#include "provision.h"
#include "renderer_task.h"
#include "sensors.h"

namespace {
constexpr char kTag[] = "main";

void init_wifi_station() {
    ESP_ERROR_CHECK(esp_netif_init());
    ESP_ERROR_CHECK(esp_event_loop_create_default());
    esp_netif_create_default_wifi_sta();

    wifi_init_config_t cfg = WIFI_INIT_CONFIG_DEFAULT();
    ESP_ERROR_CHECK(esp_wifi_init(&cfg));
    ESP_ERROR_CHECK(esp_wifi_set_mode(WIFI_MODE_STA));
    ESP_ERROR_CHECK(esp_wifi_set_ps(MX_WIFI_PS_MODE));
    ESP_ERROR_CHECK(esp_wifi_start());
}

void load_device_token_from_nvs() {
    nvs_handle_t handle;
    if (nvs_open("matrix", NVS_READONLY, &handle) != ESP_OK) {
        return;
    }

    size_t required = 0;
    if (nvs_get_str(handle, "device_token", nullptr, &required) == ESP_OK && required > 1) {
        char token[128];
        if (required <= sizeof(token) && nvs_get_str(handle, "device_token", token, &required) == ESP_OK) {
            net_sync_set_bearer_token(token);
        }
    }

    nvs_close(handle);
}

void create_task(
    TaskFunction_t task_fn,
    const char *name,
    uint32_t stack_words,
    UBaseType_t priority,
    BaseType_t core) {
    BaseType_t rc = xTaskCreatePinnedToCore(task_fn, name, stack_words, nullptr, priority, nullptr, core);
    if (rc != pdPASS) {
        ESP_LOGE(kTag, "Failed to create task %s", name);
    }
}
}  // namespace

extern "C" void app_main(void) {
    esp_err_t err = nvs_flash_init();
    if (err == ESP_ERR_NVS_NO_FREE_PAGES || err == ESP_ERR_NVS_NEW_VERSION_FOUND) {
        ESP_ERROR_CHECK(nvs_flash_erase());
        err = nvs_flash_init();
    }
    ESP_ERROR_CHECK(err);

    ota_mark_running_image_valid();
    renderer_init();
    offline_init();
    sensors_init();

    OfflineCache cache;
    if (offline_load_last_good(&cache)) {
        if (cache.has_program) {
            renderer_set_program_blob(cache.program_bytes.data(), cache.program_bytes.size(), cache.program_version);
        } else {
            renderer_load_fallback_program();
        }
        if (cache.has_data) {
            renderer_apply_slot_frame(cache.slot_frame);
        }
        net_sync_seed_cache(cache.program_etag.c_str(), cache.data_etag.c_str(), cache.program_version, cache.slot_frame.data_version);
    } else {
        renderer_load_fallback_program();
    }

    init_wifi_station();
    load_device_token_from_nvs();
    provision_start_if_needed();

    create_task(matrix_refresh_task, "matrix_refresh", MX_STACK_REFRESH, MX_PRIO_REFRESH, MX_CORE_REFRESH);
    create_task(renderer_task, "renderer", MX_STACK_RENDERER, MX_PRIO_RENDERER, MX_CORE_RENDERER);
    create_task(homespan_task, "homespan", MX_STACK_HOMESPAN, MX_PRIO_HOMESPAN, MX_CORE_HOMESPAN);
    create_task(net_sync_task, "net_sync", MX_STACK_NET_SYNC, MX_PRIO_NET_SYNC, MX_CORE_NET_SYNC);
    create_task(sensors_task, "sensors", MX_STACK_SENSORS, MX_PRIO_SENSORS, MX_CORE_SENSORS);
    create_task(ota_task, "ota", MX_STACK_OTA, MX_PRIO_OTA, MX_CORE_OTA);

    ESP_LOGI(kTag, "Matrix Portal S3 firmware skeleton started");
}
