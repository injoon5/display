#include "offline.h"

#include <cstdio>
#include <cstring>

#include "config.h"
#include "esp_log.h"
#include "esp_spiffs.h"
#include "esp_timer.h"
#include "mxr.h"

namespace {
constexpr char kTag[] = "offline";

struct CacheMeta {
    char program_etag[MX_HTTP_ETAG_BYTES];
    char data_etag[MX_HTTP_ETAG_BYTES];
    uint32_t program_version;
};

bool load_meta(CacheMeta *meta) {
    if (!meta) {
        return false;
    }

    memset(meta, 0, sizeof(*meta));
    FILE *fp = fopen(MX_PATH_LAST_PROGRAM_META, "rb");
    if (!fp) {
        return false;
    }

    const bool ok = fread(meta, sizeof(*meta), 1, fp) == 1;
    fclose(fp);
    return ok;
}

bool save_meta(const CacheMeta &meta) {
    FILE *fp = fopen(MX_PATH_LAST_PROGRAM_META, "wb");
    if (!fp) {
        ESP_LOGE(kTag, "Failed to open meta cache for write");
        return false;
    }

    const bool ok = fwrite(&meta, sizeof(meta), 1, fp) == 1;
    fclose(fp);
    return ok;
}
}  // namespace

bool offline_init() {
    esp_vfs_spiffs_conf_t conf = {
        .base_path = "/spiffs",
        .partition_label = nullptr,
        .max_files = 8,
        .format_if_mount_failed = true,
    };

    const esp_err_t err = esp_vfs_spiffs_register(&conf);
    if (err != ESP_OK && err != ESP_ERR_INVALID_STATE) {
        ESP_LOGE(kTag, "SPIFFS mount failed: %s", esp_err_to_name(err));
        return false;
    }

    size_t total = 0;
    size_t used = 0;
    if (esp_spiffs_info(nullptr, &total, &used) == ESP_OK) {
        ESP_LOGI(kTag, "SPIFFS mounted: %u / %u bytes used", static_cast<unsigned>(used), static_cast<unsigned>(total));
    }
    return true;
}

bool offline_load_last_good(OfflineCache *cache) {
    if (!cache) {
        return false;
    }

    cache->program_bytes.clear();
    cache->slot_frame = {};
    cache->program_etag.clear();
    cache->data_etag.clear();
    cache->program_version = 0;
    cache->has_program = false;
    cache->has_data = false;

    CacheMeta meta{};
    if (load_meta(&meta)) {
        cache->program_etag = meta.program_etag;
        cache->data_etag = meta.data_etag;
        cache->program_version = meta.program_version;
    }

    FILE *program_fp = fopen(MX_PATH_LAST_PROGRAM, "rb");
    if (program_fp) {
        fseek(program_fp, 0, SEEK_END);
        const long size = ftell(program_fp);
        rewind(program_fp);
        if (size > 0) {
            cache->program_bytes.resize(static_cast<size_t>(size));
            if (fread(cache->program_bytes.data(), 1, cache->program_bytes.size(), program_fp) == cache->program_bytes.size()) {
                cache->has_program = true;
            }
        }
        fclose(program_fp);
    }

    FILE *slots_fp = fopen(MX_PATH_LAST_SLOTS, "rb");
    if (slots_fp) {
        if (fread(&cache->slot_frame, sizeof(cache->slot_frame), 1, slots_fp) == 1) {
            cache->has_data = true;
        }
        fclose(slots_fp);
    }

    ESP_LOGI(kTag, "Loaded offline cache: program=%d data=%d", cache->has_program, cache->has_data);
    return cache->has_program || cache->has_data;
}

bool offline_store_program(const uint8_t *program, size_t len, const char *etag, uint32_t version) {
    if (!program || len == 0) {
        return false;
    }

    FILE *fp = fopen(MX_PATH_LAST_PROGRAM, "wb");
    if (!fp) {
        ESP_LOGE(kTag, "Failed to open program cache for write");
        return false;
    }
    const bool write_ok = fwrite(program, 1, len, fp) == len;
    fclose(fp);
    if (!write_ok) {
        return false;
    }

    CacheMeta meta{};
    load_meta(&meta);
    meta.program_version = version;
    if (etag) {
        strlcpy(meta.program_etag, etag, sizeof(meta.program_etag));
    }
    return save_meta(meta);
}

bool offline_store_slot_frame(const SlotFrame &frame, const char *etag, const uint8_t *raw, size_t raw_len) {
    FILE *slots_fp = fopen(MX_PATH_LAST_SLOTS, "wb");
    if (!slots_fp) {
        ESP_LOGE(kTag, "Failed to open slot cache for write");
        return false;
    }
    const bool slots_ok = fwrite(&frame, sizeof(frame), 1, slots_fp) == 1;
    fclose(slots_fp);
    if (!slots_ok) {
        return false;
    }

    if (raw && raw_len > 0) {
        FILE *raw_fp = fopen(MX_PATH_LAST_SLOTS_RAW, "wb");
        if (raw_fp) {
            fwrite(raw, 1, raw_len, raw_fp);
            fclose(raw_fp);
        }
    }

    CacheMeta meta{};
    load_meta(&meta);
    if (etag) {
        strlcpy(meta.data_etag, etag, sizeof(meta.data_etag));
    }
    return save_meta(meta);
}

bool offline_should_dim(uint64_t last_data_ms, uint32_t stale_after_ms) {
    if (last_data_ms == 0) {
        return true;
    }

    const uint64_t now_ms = static_cast<uint64_t>(esp_timer_get_time() / 1000ULL);
    return now_ms > last_data_ms && (now_ms - last_data_ms) >= stale_after_ms;
}

void offline_apply_overlay(uint16_t *fb, bool stale, bool synced) {
    if (!fb) {
        return;
    }

    if (stale) {
        for (size_t i = 0; i < MXR_FB_PIXELS; ++i) {
            fb[i] = mxr_dim_color(fb[i], MX_STALE_DIM_PCT);
        }
    }

    if (!synced) {
        const mxr_rect_t clip = mxr_rect_full();
        mxr_raster_pixel(fb, &clip, MXR_WIDTH - 1, 0, mxr_dim_color(0xFFFFu, MX_NOT_SYNCED_PIXEL_PCT));
    }
}
