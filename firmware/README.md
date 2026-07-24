# Matrix Portal S3 firmware skeleton

ESP-IDF firmware scaffold for the wall matrix panel plan:

- Matrix Portal S3 / ESP32-S3
- `libmxr` shared renderer from `/workspace/libmxr`
- task affinity and priorities from plan §8.1
- offline cache and stale overlay from plan §8.5
- A/B OTA skeleton from plan §8.6
- HomeSpan accessory skeleton from plan §9

## Layout

```text
firmware/
  CMakeLists.txt
  Kconfig.projbuild
  partitions.csv
  sdkconfig.defaults
  main/
  components/libmxr/
  host_sim/
  scripts/release.sh
```

## Build

This project targets ESP-IDF v5.x.

```bash
cd /workspace/firmware
idf.py set-target esp32s3
idf.py build
```

Flash and monitor:

```bash
idf.py -p /dev/ttyACM0 flash monitor
```

## Notes

### `libmxr`

`components/libmxr/CMakeLists.txt` points directly at `/workspace/libmxr`, so the firmware and the host simulator both link the same renderer sources.

### HomeSpan

HomeSpan is guarded with:

```cpp
#ifdef CONFIG_MX_HOMESPAN
```

That means the tree still compiles when HomeSpan is not installed. To enable it, add Arduino-as-component plus HomeSpan to your ESP-IDF checkout, then turn on:

```bash
idf.py menuconfig
# Matrix Panel firmware -> Enable HomeSpan integration
```

### OTA / partitions

`partitions.csv` keeps:

- `factory`: 1 MB
- `ota_0`: 2 MB
- `ota_1`: 2 MB
- `spiffs`: 2 MB
- `nvs`: preserved across OTA

NVS must survive OTA because it stores Wi-Fi credentials, the device token, calibration, and HomeKit pairing.

### Offline behavior

On boot the firmware:

1. mounts SPIFFS
2. loads last-good program and slot cache
3. renders immediately (cached data starts dim until a live sync)
4. connects Wi-Fi in the background (`esp_wifi_connect` when already provisioned)

If sync has not completed, the renderer overlays a dim 1px status marker at `(63,0)`. If data is stale, the frame is dimmed to 50%.

Staleness is measured from the device uptime clock at the moment a live `/device/data` frame arrives — not from the server timestamp — so it stays correct without NTP/RTC.

### Pins (Matrix Portal S3)

| Function | GPIO | Notes |
|---|---|---|
| I²C SDA / SCL | 16 / 17 | STEMMA QT + onboard LIS3DH |
| LIS3DH INT1 | 15 | Double-tap edge stub |
| LD2410C UART TX / RX | 18 / 8 | Labeled TXO / RXI header |
| LD2450 UART TX / RX | 12 / 3 | A0 / A1 |
| HX711 DOUT / SCK | 9 / 10 | A2 / A3 |

Do not reuse HUB75 pins (`2,14,21,35–42,45,47,48`).

### Net sync status

`main/net_sync.cpp` implements the planned endpoint flow:

- `GET /device/wait`
- `GET /device/sync`
- `GET /device/data`
- `POST /device/heartbeat`

The retry policy is `1 → 2 → 4 → 8 → 16 → 30s` with ±20% jitter and a hard reboot after 10 minutes of continuous failure.

The slot-frame decoder currently accepts JSON directly and preserves the previous slot frame when the backend serves raw CBOR; that keeps the transport logic live while the final CBOR decoder is still a TODO.

## Host simulator

An optional native simulator lives in `host_sim/`:

```bash
cmake -S host_sim -B host_sim/build
cmake --build host_sim/build
./host_sim/build/mx_host_sim
```

It links the same `libmxr` C sources and writes a PPM framebuffer output while simulating the device sync loop at a high level.
