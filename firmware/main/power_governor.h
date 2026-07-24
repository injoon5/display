#pragma once

#include <stddef.h>
#include <stdint.h>

float power_governor_last_estimate_amps();
bool power_governor_active();
void apply_power_governor(uint16_t *fb, size_t n);
