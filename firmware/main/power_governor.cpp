#include "power_governor.h"

#include "brightness.h"
#include "config.h"

namespace {
float s_last_estimate_amps = 0.0f;
bool s_governor_active = false;

// Estimate current from the framebuffer, clamp brightness. Never brown out.
static float estimate_amps(const uint16_t *fb, size_t n) {
    uint32_t sum = 0;
    for (size_t i = 0; i < n; i++) {
        uint16_t p = fb[i];
        sum += ((p >> 11) & 0x1F) * 8       // R  -> 0..248
             + ((p >>  5) & 0x3F) * 4       // G  -> 0..252
             +  (p        & 0x1F) * 8;      // B  -> 0..248
    }
    // K calibrated once with a USB power meter against a full-white frame
    return CAL_IDLE_A + (float)sum * CAL_K;
}
}  // namespace

void apply_power_governor(uint16_t *fb, size_t n) {
    float a = estimate_amps(fb, n);
    s_last_estimate_amps = a;
    s_governor_active = false;
    if (a > BUDGET_A) {
        float scale = BUDGET_A / a;
        global_brightness = (uint8_t)(global_brightness * scale);
        s_governor_active = true;
    }
}

float power_governor_last_estimate_amps() {
    return s_last_estimate_amps;
}

bool power_governor_active() {
    return s_governor_active;
}
