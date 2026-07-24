#include "renderer_task.h"

#include <algorithm>
#include <cstring>

#include "brightness.h"
#include "esp_log.h"
#include "esp_timer.h"
#include "freertos/FreeRTOS.h"
#include "freertos/semphr.h"
#include "freertos/task.h"
#include "matrix_refresh.h"
#include "mxr.h"
#include "offline.h"
#include "power_governor.h"
#include "sensors.h"

namespace {
constexpr char kTag[] = "renderer";
constexpr char kBootMessage[] = "MX PANEL";

StaticSemaphore_t s_mutex_storage;
SemaphoreHandle_t s_mutex = nullptr;

uint16_t s_front_fb[MXR_FB_PIXELS];
uint16_t s_back_fb[MXR_FB_PIXELS];
uint8_t s_program[MX_MAX_PROGRAM_BYTES];
size_t s_program_len = 0;
uint32_t s_program_version = 0;
SlotFrame s_slot_frame{};
mxr_slot_t s_runtime_slots[MX_SLOT_CAPACITY];
bool s_synced = false;
int s_scene_identifier = 1;
uint64_t s_last_data_ms = 0;
portMUX_TYPE s_fb_lock = portMUX_INITIALIZER_UNLOCKED;

void wr16(uint8_t *p, uint16_t value) {
    p[0] = static_cast<uint8_t>(value & 0xFFu);
    p[1] = static_cast<uint8_t>(value >> 8);
}

void wr32(uint8_t *p, uint32_t value) {
    p[0] = static_cast<uint8_t>(value & 0xFFu);
    p[1] = static_cast<uint8_t>((value >> 8) & 0xFFu);
    p[2] = static_cast<uint8_t>((value >> 16) & 0xFFu);
    p[3] = static_cast<uint8_t>((value >> 24) & 0xFFu);
}

void rebuild_runtime_slots_locked() {
    for (size_t i = 0; i < MX_SLOT_CAPACITY; ++i) {
        memset(&s_runtime_slots[i], 0, sizeof(s_runtime_slots[i]));
        const SlotValue &slot = s_slot_frame.slots[i];
        s_runtime_slots[i].updated_ms = slot.updated_ms;
        switch (slot.kind) {
            case SlotValueType::Null:
                s_runtime_slots[i].kind = MXR_SLOT_NULL;
                break;
            case SlotValueType::Int:
                s_runtime_slots[i].kind = MXR_SLOT_INT;
                s_runtime_slots[i].as.i = slot.int_value;
                break;
            case SlotValueType::Float:
                s_runtime_slots[i].kind = MXR_SLOT_FLOAT;
                s_runtime_slots[i].as.f = slot.float_value;
                break;
            case SlotValueType::String:
                s_runtime_slots[i].kind = MXR_SLOT_STR;
                s_runtime_slots[i].as.s = slot.string_value.data();
                break;
            case SlotValueType::Color:
                s_runtime_slots[i].kind = MXR_SLOT_COLOR;
                s_runtime_slots[i].as.color = slot.color_value;
                break;
            case SlotValueType::Bool:
                s_runtime_slots[i].kind = MXR_SLOT_BOOL;
                s_runtime_slots[i].as.b = slot.bool_value ? 1 : 0;
                break;
        }
    }
}

bool build_fallback_program_locked() {
    uint8_t code[64];
    mxr_diag_t diag{};
    const char *boot = kBootMessage;
    const size_t text_len = strlen(boot);
    // length-prefixed string table: u16 count + u16 len + bytes
    const size_t string_len = 2u + 2u + text_len;
    size_t code_len = 0;
    const size_t total_len = MXR_HEADER_SIZE + string_len + 21;

    if (total_len > sizeof(s_program)) {
        return false;
    }

    memset(s_program, 0, sizeof(s_program));
    memcpy(s_program, "MXR1", 4);
    wr16(s_program + 4, MXR_VERSION);
    wr16(s_program + 6, 0);
    s_program[8] = 0;
    s_program[9] = 0;
    wr16(s_program + 10, MXR_HEADER_SIZE);
    wr16(s_program + MXR_HEADER_SIZE, 1);                         // count
    wr16(s_program + MXR_HEADER_SIZE + 2, static_cast<uint16_t>(text_len));
    memcpy(s_program + MXR_HEADER_SIZE + 4, boot, text_len);
    wr16(s_program + 12, static_cast<uint16_t>(MXR_HEADER_SIZE + string_len));

    code[code_len++] = MXR_OP_CLEAR;
    wr16(code + code_len, 0x0000u);
    code_len += 2;

    code[code_len++] = MXR_OP_RECT;
    code[code_len++] = 0;
    code[code_len++] = 0;
    code[code_len++] = MXR_WIDTH;
    code[code_len++] = MXR_HEIGHT;
    wr16(code + code_len, 0x07FFu);
    code_len += 2;

    code[code_len++] = MXR_OP_TEXT;
    code[code_len++] = 8;
    code[code_len++] = 11;
    code[code_len++] = 1;
    wr16(code + code_len, 0xFFFFu);
    code_len += 2;
    code[code_len++] = 0;

    code[code_len++] = MXR_OP_HALT;

    memcpy(s_program + MXR_HEADER_SIZE + string_len, code, code_len);
    wr16(s_program + 14, static_cast<uint16_t>(code_len));
    wr32(s_program + 16, mxr_crc32(s_program + MXR_HEADER_SIZE, string_len + code_len));

    s_program_len = MXR_HEADER_SIZE + string_len + code_len;
    if (mxr_validate(s_program, s_program_len, &diag) != 0) {
        ESP_LOGE(kTag, "Fallback program invalid at %u: %s", diag.offset, diag.message);
        return false;
    }

    s_program_version = 0;
    return true;
}
}  // namespace

void renderer_init() {
    if (!s_mutex) {
        s_mutex = xSemaphoreCreateMutexStatic(&s_mutex_storage);
    }
    memset(s_front_fb, 0, sizeof(s_front_fb));
    memset(s_back_fb, 0, sizeof(s_back_fb));
}

bool renderer_load_fallback_program() {
    if (!s_mutex) {
        renderer_init();
    }
    xSemaphoreTake(s_mutex, portMAX_DELAY);
    const bool ok = build_fallback_program_locked();
    xSemaphoreGive(s_mutex);
    return ok;
}

bool renderer_set_program_blob(const uint8_t *program, size_t len, uint32_t version) {
    if (!program || len == 0 || len > sizeof(s_program)) {
        return false;
    }

    mxr_diag_t diag{};
    if (mxr_validate(program, len, &diag) != 0) {
        ESP_LOGE(kTag, "Program validation failed at %u: %s", diag.offset, diag.message);
        return false;
    }

    xSemaphoreTake(s_mutex, portMAX_DELAY);
    memcpy(s_program, program, len);
    s_program_len = len;
    s_program_version = version;
    xSemaphoreGive(s_mutex);
    ESP_LOGI(kTag, "Installed program version %lu (%u bytes)", static_cast<unsigned long>(version), static_cast<unsigned>(len));
    return true;
}

bool renderer_apply_slot_frame(const SlotFrame &frame) {
    xSemaphoreTake(s_mutex, portMAX_DELAY);
    s_slot_frame = frame;
    s_last_data_ms = frame.server_ms;
    rebuild_runtime_slots_locked();
    xSemaphoreGive(s_mutex);
    return true;
}

bool renderer_snapshot_framebuffer(uint16_t *out_fb, size_t pixel_count, uint8_t *out_brightness) {
    if (!out_fb || pixel_count < MXR_FB_PIXELS) {
        return false;
    }

    taskENTER_CRITICAL(&s_fb_lock);
    memcpy(out_fb, s_front_fb, sizeof(s_front_fb));
    const uint8_t brightness = global_brightness;
    taskEXIT_CRITICAL(&s_fb_lock);

    if (out_brightness) {
        *out_brightness = brightness;
    }
    return true;
}

uint32_t renderer_get_program_version() {
    return s_program_version;
}

uint64_t renderer_get_last_data_ms() {
    return s_last_data_ms;
}

void renderer_set_synced(bool synced) {
    s_synced = synced;
}

bool renderer_is_synced() {
    return s_synced;
}

void scene_select(int identifier) {
    s_scene_identifier = identifier;
    ESP_LOGI(kTag, "Scene selected: %d", identifier);
}

int renderer_active_scene() {
    return s_scene_identifier;
}

void renderer_task(void *arg) {
    (void)arg;
    renderer_init();
    if (s_program_len == 0) {
        renderer_load_fallback_program();
    }

    ESP_LOGI(kTag, "Renderer task pinned to core %d", xPortGetCoreID());
    TickType_t last_wake = xTaskGetTickCount();

    while (true) {
        const SensorSnapshot sensors = sensors_get_snapshot();
        panel_compute_brightness(sensors.lux);

        xSemaphoreTake(s_mutex, portMAX_DELAY);
        mxr_ctx_t ctx{};
        ctx.fb = s_back_fb;
        ctx.program = s_program;
        ctx.program_len = s_program_len;
        ctx.slots = s_runtime_slots;
        ctx.assets = nullptr;
        ctx.t_ms = static_cast<uint32_t>(esp_timer_get_time() / 1000ULL);

        const int render_rc = mxr_render(&ctx);
        const bool stale = offline_should_dim(s_last_data_ms, MX_DEFAULT_STALE_AFTER_MS);
        const bool synced = s_synced;
        xSemaphoreGive(s_mutex);

        if (render_rc != 0) {
            ESP_LOGW(kTag, "mxr_render failed, keeping previous frame");
            vTaskDelay(pdMS_TO_TICKS(100));
            continue;
        }

        offline_apply_overlay(s_back_fb, stale, synced);
        apply_power_governor(s_back_fb, MXR_FB_PIXELS);

        taskENTER_CRITICAL(&s_fb_lock);
        memcpy(s_front_fb, s_back_fb, sizeof(s_front_fb));
        taskEXIT_CRITICAL(&s_fb_lock);
        matrix_refresh_submit_frame(s_front_fb, global_brightness);

        vTaskDelayUntil(&last_wake, pdMS_TO_TICKS(16));
    }
}
