#pragma once

#include <stdint.h>

struct SensorSnapshot {
    float lux = 10.0f;
    float temperature_c = 24.0f;
    float humidity_pct = 50.0f;
    bool presence_room = false;
    bool presence_bed = false;
    bool tapped = false;
    uint32_t updated_ms = 0;
};

void sensors_init();
SensorSnapshot sensors_get_snapshot();
void sensors_task(void *arg);
