#include "brightness.h"

#include <algorithm>
#include <cmath>

#include "config.h"

uint8_t global_brightness = 60;
int homekit_ceiling = 60;

namespace {
bool s_panel_power = true;
}

uint8_t brightness_from_lux(float lux) {
    float b = 5.0f + 95.0f * powf(fminf(lux, 1000.0f) / 1000.0f, 0.35f);
    return (uint8_t)fmaxf(NIGHT_FLOOR, fminf(b, homekit_ceiling));
}

void panel_set_power(bool on) {
    s_panel_power = on;
}

bool panel_get_power() {
    return s_panel_power;
}

void panel_set_brightness_ceiling(int percent) {
    homekit_ceiling = std::clamp(percent, 0, 100);
}

int panel_get_brightness_ceiling() {
    return homekit_ceiling;
}

uint8_t panel_compute_brightness(float lux) {
    if (!s_panel_power) {
        global_brightness = 0;
        return global_brightness;
    }

    global_brightness = brightness_from_lux(lux);
    return global_brightness;
}
