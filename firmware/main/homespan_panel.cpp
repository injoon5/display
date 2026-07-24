#include "homespan_panel.h"

#include <cstdio>

#include "brightness.h"
#include "config.h"
#include "esp_log.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "renderer_task.h"

#ifdef CONFIG_MX_HOMESPAN
#include "HomeSpan.h"

namespace {
constexpr char kTag[] = "homespan";

struct PanelLight : Service::LightBulb {
    SpanCharacteristic *power = new Characteristic::On(true);
    SpanCharacteristic *bright = new Characteristic::Brightness(60);

    PanelLight() : Service::LightBulb() {
        bright->setRange(0, 100, 1);
    }

    boolean update() override {
        panel_set_power(power->getNewVal<bool>());
        // HomeKit sets the ceiling; the lux sensor scales beneath it.
        panel_set_brightness_ceiling(bright->getNewVal<int>());
        return true;
    }
};

struct SceneTV : Service::Television {
    SpanCharacteristic *active = new Characteristic::Active(1);
    SpanCharacteristic *input = new Characteristic::ActiveIdentifier(1);

    SceneTV() : Service::Television() {
        new Characteristic::ConfiguredName("Matrix Panel Scenes");
        new Characteristic::SleepDiscoveryMode(0);
    }

    boolean update() override {
        if (input->updated()) {
            scene_select(input->getNewVal<int>());
        }
        if (active->updated()) {
            panel_set_power(active->getNewVal<bool>());
        }
        return true;
    }
};

struct OccupancyBridge : Service::OccupancySensor {
    SpanCharacteristic *occupancy = new Characteristic::OccupancyDetected(0);

    explicit OccupancyBridge() : Service::OccupancySensor() {}

    void publish(bool detected) {
        occupancy->setVal(detected ? 1 : 0);
    }
};

struct TemperatureBridge : Service::TemperatureSensor {
    SpanCharacteristic *temperature = new Characteristic::CurrentTemperature(24.0f);

    explicit TemperatureBridge() : Service::TemperatureSensor() {}

    void publish(float celsius) {
        temperature->setVal(celsius);
    }
};

struct HumidityBridge : Service::HumiditySensor {
    SpanCharacteristic *humidity = new Characteristic::CurrentRelativeHumidity(50.0f);

    explicit HumidityBridge() : Service::HumiditySensor() {}

    void publish(float percent) {
        humidity->setVal(percent);
    }
};

struct LightSensorBridge : Service::LightSensor {
    SpanCharacteristic *lux = new Characteristic::CurrentAmbientLightLevel(10.0f);

    explicit LightSensorBridge() : Service::LightSensor() {}

    void publish(float ambient_lux) {
        const float clamped = ambient_lux < 0.0001f ? 0.0001f : ambient_lux;
        lux->setVal(clamped);
    }
};

struct SceneSwitch : Service::StatelessProgrammableSwitch {
    SpanCharacteristic *event = new Characteristic::ProgrammableSwitchEvent(0);
    int identifier;

    explicit SceneSwitch(int id) : Service::StatelessProgrammableSwitch(), identifier(id) {
        event->setVal(0);
    }

    void fire() {
        event->setVal(0);
        scene_select(identifier);
    }
};

OccupancyBridge *s_room_sensor = nullptr;
OccupancyBridge *s_bed_sensor = nullptr;
TemperatureBridge *s_temp_sensor = nullptr;
HumidityBridge *s_humidity_sensor = nullptr;
LightSensorBridge *s_light_sensor = nullptr;
SceneSwitch *s_switches[6] = {};

void add_accessory_info(const char *name) {
    new Service::AccessoryInformation();
    new Characteristic::Identify();
    new Characteristic::Name(name);
    new Characteristic::Manufacturer("Homebrew");
    new Characteristic::FirmwareRevision(MX_FW_VERSION);
}

void add_scene_input(int identifier, const char *name) {
    new Service::InputSource();
    new Characteristic::ConfiguredName(name);
    new Characteristic::Identifier(identifier);
    new Characteristic::InputSourceType(3);
}
}  // namespace

void homespan_panel_publish(const SensorSnapshot &snapshot) {
    if (s_room_sensor) {
        s_room_sensor->publish(snapshot.presence_room);
    }
    if (s_bed_sensor) {
        s_bed_sensor->publish(snapshot.presence_bed);
    }
    if (s_temp_sensor) {
        s_temp_sensor->publish(snapshot.temperature_c);
    }
    if (s_humidity_sensor) {
        s_humidity_sensor->publish(snapshot.humidity_pct);
    }
    if (s_light_sensor) {
        s_light_sensor->publish(snapshot.lux);
    }
}

void homespan_task(void *arg) {
    (void)arg;
    ESP_LOGI(kTag, "HomeSpan task pinned to core %d", xPortGetCoreID());

    homeSpan.setControlPin(0);
#ifdef LED_BUILTIN
    homeSpan.setStatusPin(LED_BUILTIN);
#endif
    homeSpan.setPairingCode(HOMEKIT_SETUP_CODE);
    homeSpan.begin(Category::Bridges, "Matrix Panel");

    new SpanAccessory();
    add_accessory_info("Matrix Panel");
    new PanelLight();
    new SceneTV();
    add_scene_input(1, "Morning");
    add_scene_input(2, "Day");
    add_scene_input(3, "Evening");
    add_scene_input(4, "Night");
    add_scene_input(5, "Away");
    add_scene_input(6, "Pinned");

    new SpanAccessory();
    add_accessory_info("Bedroom Presence");
    s_room_sensor = new OccupancyBridge();

    new SpanAccessory();
    add_accessory_info("Bed Presence");
    s_bed_sensor = new OccupancyBridge();

    new SpanAccessory();
    add_accessory_info("Bedroom Temperature");
    s_temp_sensor = new TemperatureBridge();

    new SpanAccessory();
    add_accessory_info("Bedroom Humidity");
    s_humidity_sensor = new HumidityBridge();

    new SpanAccessory();
    add_accessory_info("Bedroom Light");
    s_light_sensor = new LightSensorBridge();

    for (int i = 0; i < 6; ++i) {
        new SpanAccessory();
        char name[24];
        snprintf(name, sizeof(name), "Scene Switch %d", i + 1);
        add_accessory_info(name);
        s_switches[i] = new SceneSwitch(i + 1);
    }

    while (true) {
        homeSpan.poll();
        vTaskDelay(pdMS_TO_TICKS(10));
    }
}

#else

namespace {
constexpr char kTag[] = "homespan_stub";
}

void homespan_panel_publish(const SensorSnapshot &snapshot) {
    (void)snapshot;
}

void homespan_task(void *arg) {
    (void)arg;
    ESP_LOGI(kTag, "CONFIG_MX_HOMESPAN is disabled; HomeSpan task is a stub");
    while (true) {
        vTaskDelay(pdMS_TO_TICKS(1000));
    }
}

#endif
