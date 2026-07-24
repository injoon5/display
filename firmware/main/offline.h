#pragma once

#include <stdint.h>

#include <string>
#include <vector>

#include "renderer_task.h"

struct OfflineCache {
    std::vector<uint8_t> program_bytes;
    SlotFrame slot_frame{};
    std::string program_etag;
    std::string data_etag;
    uint32_t program_version = 0;
    bool has_program = false;
    bool has_data = false;
};

bool offline_init();
bool offline_load_last_good(OfflineCache *cache);
bool offline_store_program(const uint8_t *program, size_t len, const char *etag, uint32_t version);
bool offline_store_slot_frame(const SlotFrame &frame, const char *etag, const uint8_t *raw, size_t raw_len);
bool offline_should_dim(uint64_t last_data_ms, uint32_t stale_after_ms);
void offline_apply_overlay(uint16_t *fb, bool stale, bool synced);
