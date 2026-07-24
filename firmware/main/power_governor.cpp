#include "power_governor.h"

#include <algorithm>

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
    // estimate_amps() is calibrated at full OE. Scale by the current brightness
    // duty so we don't over-throttle frames that are already dim.
    const float duty = static_cast<float>(global_brightness) / 100.0f;
    float a = CAL_IDLE_A + (estimate_amps(fb, n) - CAL_IDLE_A) * duty;
    s_last_estimate_amps = a;
    s_governor_active = false;
    if (a > BUDGET_A && global_brightness > 0) {
        const float scale = BUDGET_A / a;
        global_brightness = static_cast<uint8_t>(std::max(1.0f, global_brightness * scale));
        s_governor_active = true;
    }
}

float power_governor_last_estimate_amps() {
    return s_last_estimate_amps;
}

bool power_governor_active() {
    return s_governor_active;
}
