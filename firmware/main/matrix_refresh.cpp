#include "matrix_refresh.h"

#include <cstring>

#include "esp_log.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "mxr.h"

namespace {
constexpr char kTag[] = "matrix_refresh";

uint16_t s_refresh_fb[MXR_FB_PIXELS];
uint8_t s_refresh_brightness = 0;
portMUX_TYPE s_refresh_lock = portMUX_INITIALIZER_UNLOCKED;
}  // namespace

void matrix_refresh_submit_frame(const uint16_t *fb, uint8_t brightness_pct) {
    taskENTER_CRITICAL(&s_refresh_lock);
    memcpy(s_refresh_fb, fb, sizeof(s_refresh_fb));
    s_refresh_brightness = brightness_pct;
    taskEXIT_CRITICAL(&s_refresh_lock);
}

void matrix_refresh_task(void *arg) {
    (void)arg;
    ESP_LOGI(kTag, "Starting HUB75 refresh stub on core %d", xPortGetCoreID());
    ESP_LOGI(kTag, "TODO: replace stub with Adafruit Protomatter or direct ESP-IDF HUB75 driver");

    TickType_t last_wake = xTaskGetTickCount();
    while (true) {
        // This task is intentionally high priority and pinned to core 0 so
        // the eventual HUB75 bit-angle-modulation driver never contends with
        // HomeSpan, Wi-Fi, or TLS on core 1.
        taskENTER_CRITICAL(&s_refresh_lock);
        const uint8_t brightness = s_refresh_brightness;
        (void)brightness;
        taskEXIT_CRITICAL(&s_refresh_lock);

        vTaskDelayUntil(&last_wake, pdMS_TO_TICKS(16));
    }
}
