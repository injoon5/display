#include "sensors.h"

#include <algorithm>
#include <array>
#include <cmath>
#include <cstring>

#include "config.h"
#include "driver/i2c.h"
#include "driver/uart.h"
#include "esp_log.h"
#include "esp_timer.h"
#include "freertos/FreeRTOS.h"
#include "freertos/semphr.h"
#include "freertos/task.h"
#include "homespan_panel.h"

namespace {
constexpr char kTag[] = "sensors";
constexpr float kLuxAlpha = 0.05f;
constexpr float kLuxHysteresis = 1.0f;

StaticSemaphore_t s_snapshot_mutex_storage;
SemaphoreHandle_t s_snapshot_mutex = nullptr;
SensorSnapshot s_snapshot{};

bool s_room_presence_state = false;
int s_room_assert_count = 0;
uint64_t s_room_last_true_ms = 0;

bool s_bed_presence_state = false;
bool s_bed_candidate_state = false;
uint64_t s_bed_candidate_since_ms = 0;

float stub_lux(uint64_t now_ms) {
    const float wave = (sinf(static_cast<float>(now_ms % 60'000) / 60'000.0f * 6.28318f) + 1.0f) * 0.5f;
    return 5.0f + wave * 180.0f;
}

float stub_temperature(uint64_t now_ms) {
    return 23.5f + 1.2f * sinf(static_cast<float>(now_ms % 120'000) / 120'000.0f * 6.28318f);
}

float stub_humidity(uint64_t now_ms) {
    return 48.0f + 6.0f * cosf(static_cast<float>(now_ms % 90'000) / 90'000.0f * 6.28318f);
}

bool stub_ld2410_presence() {
    return false;
}

float stub_hx711_weight_kg() {
    return 0.0f;
}

void maybe_init_i2c() {
    i2c_config_t conf = {};
    conf.mode = I2C_MODE_MASTER;
    conf.sda_io_num = static_cast<gpio_num_t>(MX_PIN_I2C_SDA);
    conf.scl_io_num = static_cast<gpio_num_t>(MX_PIN_I2C_SCL);
    conf.sda_pullup_en = GPIO_PULLUP_ENABLE;
    conf.scl_pullup_en = GPIO_PULLUP_ENABLE;
    conf.master.clk_speed = 400000;
    i2c_param_config(I2C_NUM_0, &conf);
    i2c_driver_install(I2C_NUM_0, conf.mode, 0, 0, 0);
}

void maybe_init_uart(int uart_num, int tx_pin, int rx_pin, int baud) {
    uart_config_t conf = {};
    conf.baud_rate = baud;
    conf.data_bits = UART_DATA_8_BITS;
    conf.parity = UART_PARITY_DISABLE;
    conf.stop_bits = UART_STOP_BITS_1;
    conf.flow_ctrl = UART_HW_FLOWCTRL_DISABLE;
    conf.source_clk = UART_SCLK_DEFAULT;
    uart_param_config(uart_num, &conf);
    uart_set_pin(uart_num, tx_pin, rx_pin, UART_PIN_NO_CHANGE, UART_PIN_NO_CHANGE);
    uart_driver_install(uart_num, 1024, 0, 0, nullptr, 0);
}

void store_snapshot(const SensorSnapshot &next) {
    xSemaphoreTake(s_snapshot_mutex, portMAX_DELAY);
    s_snapshot = next;
    xSemaphoreGive(s_snapshot_mutex);
}
}  // namespace

void sensors_init() {
    if (!s_snapshot_mutex) {
        s_snapshot_mutex = xSemaphoreCreateMutexStatic(&s_snapshot_mutex_storage);
    }
    maybe_init_i2c();
    maybe_init_uart(MX_UART_LD2410, MX_PIN_LD2410_UART_TX, MX_PIN_LD2410_UART_RX, MX_LD2410_BAUD);
    maybe_init_uart(MX_UART_LD2450, MX_PIN_LD2450_UART_TX, MX_PIN_LD2450_UART_RX, MX_LD2450_BAUD);
    ESP_LOGI(kTag, "Sensor stubs initialized");
}

SensorSnapshot sensors_get_snapshot() {
    SensorSnapshot snapshot;
    xSemaphoreTake(s_snapshot_mutex, portMAX_DELAY);
    snapshot = s_snapshot;
    xSemaphoreGive(s_snapshot_mutex);
    return snapshot;
}

void sensors_task(void *arg) {
    (void)arg;
    sensors_init();
    ESP_LOGI(kTag, "Sensors task pinned to core %d", xPortGetCoreID());

    SensorSnapshot current{};
    current.updated_ms = static_cast<uint32_t>(esp_timer_get_time() / 1000ULL);
    float smoothed_lux = current.lux;

    TickType_t last_wake = xTaskGetTickCount();
    uint32_t tick_100ms = 0;

    while (true) {
        const uint64_t now_ms = static_cast<uint64_t>(esp_timer_get_time() / 1000ULL);

        if (tick_100ms % 10 == 0) {
            const float raw_lux = stub_lux(now_ms);
            smoothed_lux = (1.0f - kLuxAlpha) * smoothed_lux + kLuxAlpha * raw_lux;
            if (fabsf(smoothed_lux - current.lux) >= kLuxHysteresis) {
                current.lux = smoothed_lux;
            }
        }

        if (tick_100ms % 100 == 0) {
            std::array<float, 3> temp_samples = {
                stub_temperature(now_ms),
                stub_temperature(now_ms + 200),
                stub_temperature(now_ms + 400),
            };
            std::sort(temp_samples.begin(), temp_samples.end());
            current.temperature_c = temp_samples[1];
            current.humidity_pct = stub_humidity(now_ms);
        }

        const bool room_candidate = stub_ld2410_presence();
        if (room_candidate) {
            ++s_room_assert_count;
            if (s_room_assert_count >= 3) {
                s_room_presence_state = true;
            }
            s_room_last_true_ms = now_ms;
        } else {
            s_room_assert_count = 0;
            if (s_room_presence_state && (now_ms - s_room_last_true_ms) >= 30'000) {
                s_room_presence_state = false;
            }
        }
        current.presence_room = s_room_presence_state;

        if (tick_100ms % 5 == 0) {
            const bool bed_candidate = stub_hx711_weight_kg() >= 15.0f;
            if (bed_candidate != s_bed_candidate_state) {
                s_bed_candidate_state = bed_candidate;
                s_bed_candidate_since_ms = now_ms;
            } else if ((now_ms - s_bed_candidate_since_ms) >= 5'000) {
                s_bed_presence_state = s_bed_candidate_state;
            }
            current.presence_bed = s_bed_presence_state;
        }

        current.tapped = false;
        current.updated_ms = static_cast<uint32_t>(now_ms);
        store_snapshot(current);
        homespan_panel_publish(current);

        ++tick_100ms;
        vTaskDelayUntil(&last_wake, pdMS_TO_TICKS(100));
    }
}
