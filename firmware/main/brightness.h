#pragma once

#include <stdint.h>

extern uint8_t global_brightness;
extern int homekit_ceiling;

uint8_t brightness_from_lux(float lux);
void panel_set_power(bool on);
bool panel_get_power();
void panel_set_brightness_ceiling(int percent);
int panel_get_brightness_ceiling();
uint8_t panel_compute_brightness(float lux);
