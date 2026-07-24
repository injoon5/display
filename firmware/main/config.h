#pragma once

#include <stddef.h>
#include <stdint.h>

#include "driver/gpio.h"
#include "esp_wifi.h"
#include "freertos/FreeRTOS.h"

// Matrix Portal S3 firmware identity.
#define MX_FW_VERSION "0.1.0"
#define HOMEKIT_SETUP_CODE "466-37-726"

// Cloud endpoints. Replace at provisioning time or override at build time.
#ifndef MX_API_BASE_URL
#define MX_API_BASE_URL "https://example.invalid"
#endif

// Main board policy from the plan.
static constexpr wifi_ps_type_t MX_WIFI_PS_MODE = WIFI_PS_NONE;
static constexpr float BUDGET_A = 2.5f;
static constexpr float CAL_IDLE_A = 0.10f;
static constexpr float CAL_K = 0.0000040f;
static constexpr uint8_t NIGHT_FLOOR = 5;
static constexpr uint8_t MX_NOT_SYNCED_PIXEL_PCT = 20;
static constexpr uint8_t MX_STALE_DIM_PCT = 50;
static constexpr uint32_t MX_LONG_POLL_TIMEOUT_MS = 25'000;
static constexpr uint32_t MX_HEARTBEAT_INTERVAL_MS = 60'000;
static constexpr uint32_t MX_HARD_REBOOT_AFTER_MS = 10 * 60 * 1000;
static constexpr uint32_t MX_DEFAULT_STALE_AFTER_MS = 90'000;

// Cache locations on SPIFFS.
static constexpr const char *MX_PATH_LAST_PROGRAM = "/spiffs/last_program.bin";
static constexpr const char *MX_PATH_LAST_PROGRAM_META = "/spiffs/last_program.meta";
static constexpr const char *MX_PATH_LAST_SLOTS = "/spiffs/last_slots.bin";
static constexpr const char *MX_PATH_LAST_SLOTS_RAW = "/spiffs/last_slots.raw";

// Task topology from plan §8.1.
static constexpr BaseType_t MX_CORE_REFRESH = 0;
static constexpr BaseType_t MX_CORE_RENDERER = 0;
static constexpr BaseType_t MX_CORE_HOMESPAN = 1;
static constexpr BaseType_t MX_CORE_NET_SYNC = 1;
static constexpr BaseType_t MX_CORE_SENSORS = 1;
static constexpr BaseType_t MX_CORE_OTA = 1;

static constexpr UBaseType_t MX_PRIO_REFRESH = 24;
static constexpr UBaseType_t MX_PRIO_RENDERER = 10;
static constexpr UBaseType_t MX_PRIO_HOMESPAN = 8;
static constexpr UBaseType_t MX_PRIO_NET_SYNC = 6;
static constexpr UBaseType_t MX_PRIO_SENSORS = 5;
static constexpr UBaseType_t MX_PRIO_OTA = 4;

static constexpr uint32_t MX_STACK_REFRESH = 4096;
static constexpr uint32_t MX_STACK_RENDERER = 8192;
static constexpr uint32_t MX_STACK_HOMESPAN = 8192;
static constexpr uint32_t MX_STACK_NET_SYNC = 12288;
static constexpr uint32_t MX_STACK_SENSORS = 6144;
static constexpr uint32_t MX_STACK_OTA = 8192;

// Matrix Portal S3 pin map (Adafruit board / CircuitPython pins.c).
// HUB75 owns GPIO 2,14,21,35-42,45,47,48 — never reuse those.
// STEMMA QT I²C is GPIO16/17 (shared with onboard LIS3DH @ 0x19).
static constexpr int MX_PIN_I2C_SDA = 16;
static constexpr int MX_PIN_I2C_SCL = 17;
static constexpr int MX_PIN_LIS3DH_INT = 15;
// Labeled UART header: MCU TXO=GPIO18, RXI=GPIO8.
static constexpr int MX_PIN_LD2410_UART_TX = 18;
static constexpr int MX_PIN_LD2410_UART_RX = 8;
// Spare analog breakout pins for the optional LD2450.
static constexpr int MX_PIN_LD2450_UART_TX = 12;  // A0
static constexpr int MX_PIN_LD2450_UART_RX = 3;   // A1
// HX711 on A2 / A3.
static constexpr int MX_PIN_HX711_DOUT = 9;   // A2
static constexpr int MX_PIN_HX711_SCK = 10;   // A3

static constexpr int MX_UART_LD2410 = 1;
static constexpr int MX_UART_LD2450 = 2;
static constexpr uint32_t MX_LD2410_BAUD = 256000;
static constexpr uint32_t MX_LD2450_BAUD = 256000;

// BLE provisioning proof-of-possession (WIFI_PROV_SECURITY_1).
#ifndef MX_PROV_POP
#define MX_PROV_POP "mxpanel"
#endif

static constexpr size_t MX_MAX_PROGRAM_BYTES = 32 * 1024;
static constexpr size_t MX_SLOT_CAPACITY = 64;
static constexpr size_t MX_SLOT_STRING_BYTES = 48;
static constexpr size_t MX_HTTP_BUFFER_BYTES = 16 * 1024;
static constexpr size_t MX_HTTP_URL_BYTES = 512;
static constexpr size_t MX_HTTP_ETAG_BYTES = 96;

static constexpr uint32_t MX_DOUBLE_TAP_WINDOW_MS = 600;
