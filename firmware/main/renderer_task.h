#pragma once

#include <stddef.h>
#include <stdint.h>

#include <array>
#include <type_traits>
#include <vector>

#include "config.h"

enum class SlotValueType : uint8_t {
    Null = 0,
    Int = 1,
    Float = 2,
    String = 3,
    Color = 4,
    Bool = 5,
};

struct SlotValue {
    SlotValueType kind = SlotValueType::Null;
    uint32_t updated_ms = 0;
    int32_t int_value = 0;
    float float_value = 0.0f;
    uint16_t color_value = 0;
    bool bool_value = false;
    std::array<char, MX_SLOT_STRING_BYTES> string_value{};
};

struct SlotFrame {
    uint16_t count = 0;
    uint32_t data_version = 0;
    uint64_t server_ms = 0;
    std::array<SlotValue, MX_SLOT_CAPACITY> slots{};
};

static_assert(std::is_trivially_copyable_v<SlotFrame>, "SlotFrame must be cacheable");

void renderer_init();
bool renderer_load_fallback_program();
bool renderer_set_program_blob(const uint8_t *program, size_t len, uint32_t version);
bool renderer_apply_slot_frame(const SlotFrame &frame);
void renderer_mark_data_fresh();
bool renderer_snapshot_framebuffer(uint16_t *out_fb, size_t pixel_count, uint8_t *out_brightness);
uint32_t renderer_get_program_version();
uint64_t renderer_get_last_data_ms();
void renderer_set_synced(bool synced);
bool renderer_is_synced();
void scene_select(int identifier);
int renderer_active_scene();
void renderer_task(void *arg);
