#include "mxr.h"

int mxr_anim_marquee_offset(int text_width, int box_width, uint8_t speed, uint32_t t_ms) {
    int gap;
    uint32_t px;
    if (text_width <= box_width) {
        return 0;
    }
    if (speed == 0) {
        speed = 18;
    }
    gap = mxr_text_tabular_advance(1) + 2;
    px = (uint32_t)(((uint64_t)t_ms * speed) / 1000u);
    return (int)(px % (uint32_t)(text_width + gap));
}

int mxr_anim_blink(uint32_t t_ms, uint16_t rate_ms, uint8_t duty_pct) {
    uint32_t on_ms;
    if (rate_ms == 0) {
        return 1;
    }
    if (duty_pct > 100u) {
        duty_pct = 100u;
    }
    on_ms = ((uint32_t)rate_ms * duty_pct) / 100u;
    if (on_ms == 0 && duty_pct > 0) {
        on_ms = 1;
    }
    return (t_ms % rate_ms) < on_ms;
}

uint8_t mxr_anim_fade(uint32_t t_ms, uint8_t from_pct, uint8_t to_pct, uint16_t dur_ms) {
    uint32_t phase;
    int diff;
    if (dur_ms == 0) {
        return to_pct;
    }
    phase = t_ms % dur_ms;
    diff = (int)to_pct - (int)from_pct;
    return (uint8_t)((int)from_pct + (diff * (int)phase) / (int)dur_ms);
}

void mxr_anim_slide(uint32_t t_ms, uint8_t dir, uint16_t dur_ms, int8_t dx, int8_t dy, int *out_x, int *out_y) {
    int base_x = dx;
    int base_y = dy;
    uint32_t phase;
    if (!out_x || !out_y) {
        return;
    }
    if (dur_ms == 0) {
        *out_x = 0;
        *out_y = 0;
        return;
    }
    if (base_x == 0 && base_y == 0) {
        switch (dir & 0x3u) {
            case 0: base_x = MXR_WIDTH; break;
            case 1: base_x = -MXR_WIDTH; break;
            case 2: base_y = MXR_HEIGHT; break;
            default: base_y = -MXR_HEIGHT; break;
        }
    }
    phase = t_ms % dur_ms;
    *out_x = base_x - (int)((base_x * (int32_t)phase) / (int32_t)dur_ms);
    *out_y = base_y - (int)((base_y * (int32_t)phase) / (int32_t)dur_ms);
}
