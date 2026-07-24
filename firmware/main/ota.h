#pragma once

#include <array>

struct OtaManifest {
    std::array<char, 32> version{};
    std::array<char, 256> url{};
    std::array<char, 65> sha256{};
    std::array<char, 32> min_version{};
    std::array<char, 129> signature{};
};

void ota_mark_running_image_valid();
bool ota_request_update(const OtaManifest &manifest);
void ota_task(void *arg);
