#pragma once

#include <stdint.h>

void matrix_refresh_submit_frame(const uint16_t *fb, uint8_t brightness_pct);
void matrix_refresh_task(void *arg);
