#pragma once

#include "sensors.h"

void homespan_panel_publish(const SensorSnapshot &snapshot);
void homespan_task(void *arg);
