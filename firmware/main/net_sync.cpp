#include "net_sync.h"

#include <algorithm>
#include <array>
#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <string>
#include <vector>
#include <strings.h>

#include "brightness.h"
#include "cJSON.h"
#include "config.h"
#include "esp_err.h"
#include "esp_heap_caps.h"
#include "esp_http_client.h"
#include "esp_log.h"
#include "esp_random.h"
#include "esp_system.h"
#include "esp_timer.h"
#include "esp_wifi.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "offline.h"
#include "ota.h"
#include "power_governor.h"
#include "renderer_task.h"
#include "sensors.h"

namespace {
constexpr char kTag[] = "net_sync";

struct HttpBuffer {
    std::vector<uint8_t> body;
    std::string etag;
    std::string content_type;
};

char s_program_etag[MX_HTTP_ETAG_BYTES] = {};
char s_data_etag[MX_HTTP_ETAG_BYTES] = {};
char s_bearer_token[128] = {};
uint32_t s_program_version = 0;
uint32_t s_data_version = 0;
uint64_t s_last_success_ms = 0;
uint64_t s_failure_since_ms = 0;
uint64_t s_last_heartbeat_ms = 0;
bool s_synced_once = false;

uint64_t now_ms() {
    return static_cast<uint64_t>(esp_timer_get_time() / 1000ULL);
}

esp_err_t http_event_handler(esp_http_client_event_t *event) {
    auto *buffer = static_cast<HttpBuffer *>(event->user_data);
    if (!buffer) {
        return ESP_OK;
    }

    switch (event->event_id) {
        case HTTP_EVENT_ON_HEADER:
            if (event->header_key && event->header_value) {
                if (strcasecmp(event->header_key, "ETag") == 0) {
                    buffer->etag = event->header_value;
                } else if (strcasecmp(event->header_key, "Content-Type") == 0) {
                    buffer->content_type = event->header_value;
                }
            }
            break;
        case HTTP_EVENT_ON_DATA:
            if (event->data && event->data_len > 0) {
                const auto *start = static_cast<const uint8_t *>(event->data);
                buffer->body.insert(buffer->body.end(), start, start + event->data_len);
            }
            break;
        default:
            break;
    }
    return ESP_OK;
}

bool perform_request(
    const char *url,
    esp_http_client_method_t method,
    HttpBuffer *response,
    const char *if_none_match,
    const char *post_body,
    bool use_bearer,
    int *status_code_out,
    int timeout_ms = 15'000) {
    if (!url || !response || !status_code_out) {
        return false;
    }

    response->body.clear();
    response->etag.clear();
    response->content_type.clear();

    esp_http_client_config_t config = {};
    config.url = url;
    config.timeout_ms = timeout_ms;
    config.event_handler = http_event_handler;
    config.user_data = response;
    config.keep_alive_enable = true;

    esp_http_client_handle_t client = esp_http_client_init(&config);
    if (!client) {
        return false;
    }

    esp_http_client_set_method(client, method);
    if (use_bearer) {
        char auth_header[192];
        snprintf(auth_header, sizeof(auth_header), "Bearer %s", s_bearer_token[0] ? s_bearer_token : "UNPROVISIONED");
        esp_http_client_set_header(client, "Authorization", auth_header);
    }
    esp_http_client_set_header(client, "Accept", "application/cbor, application/json");
    if (if_none_match && if_none_match[0] != '\0') {
        esp_http_client_set_header(client, "If-None-Match", if_none_match);
    }
    if (post_body) {
        esp_http_client_set_header(client, "Content-Type", "application/json");
        esp_http_client_set_post_field(client, post_body, strlen(post_body));
    }

    const esp_err_t err = esp_http_client_perform(client);
    if (err != ESP_OK) {
        ESP_LOGW(kTag, "HTTP request failed for %s: %s", url, esp_err_to_name(err));
        esp_http_client_cleanup(client);
        return false;
    }

    *status_code_out = esp_http_client_get_status_code(client);
    esp_http_client_cleanup(client);
    return true;
}

uint32_t compute_backoff_ms(uint32_t failure_count) {
    static constexpr std::array<uint32_t, 6> kSteps = {1000, 2000, 4000, 8000, 16000, 30000};
    const uint32_t index = failure_count == 0 ? 0 : std::min<uint32_t>(failure_count, kSteps.size()) - 1;
    const float base = static_cast<float>(kSteps[index]);
    const float jitter = (static_cast<float>(esp_random() % 401) / 1000.0f) - 0.20f;
    return static_cast<uint32_t>(base * (1.0f + jitter));
}

bool parse_wait_flags(const std::vector<uint8_t> &body, bool *program_changed, bool *data_changed) {
    if (!program_changed || !data_changed) {
        return false;
    }

    *program_changed = false;
    *data_changed = false;
    cJSON *root = cJSON_ParseWithLength(reinterpret_cast<const char *>(body.data()), body.size());
    if (!root) {
        return false;
    }

    const cJSON *program = cJSON_GetObjectItemCaseSensitive(root, "program");
    const cJSON *data = cJSON_GetObjectItemCaseSensitive(root, "data");
    *program_changed = cJSON_IsTrue(program);
    *data_changed = cJSON_IsTrue(data);
    cJSON_Delete(root);
    return true;
}

bool fetch_binary_url(const char *url, std::vector<uint8_t> *bytes) {
    if (!url || !bytes) {
        return false;
    }

    HttpBuffer response;
    int status_code = 0;
    if (!perform_request(url, HTTP_METHOD_GET, &response, nullptr, nullptr, false, &status_code)) {
        return false;
    }
    if (status_code != 200) {
        ESP_LOGW(kTag, "Binary fetch returned %d for %s", status_code, url);
        return false;
    }
    *bytes = std::move(response.body);
    return true;
}

void append_etag_query(char *dst, size_t dst_len, const char *key, const char *etag) {
    if (!dst || dst_len == 0 || !key) {
        return;
    }

    const size_t used = strnlen(dst, dst_len);
    if (used >= dst_len - 1) {
        return;
    }

    const bool has_query = strchr(dst, '?') != nullptr;
    char *out = dst + used;
    size_t remaining = dst_len - used;
    const int wrote = snprintf(out, remaining, "%c%s=", has_query ? '&' : '?', key);
    if (wrote <= 0 || static_cast<size_t>(wrote) >= remaining) {
        dst[used] = '\0';
        return;
    }
    out += wrote;
    remaining -= static_cast<size_t>(wrote);

    if (!etag) {
        return;
    }

    // Strip surrounding quotes and percent-encode reserved query characters.
    const char *start = etag;
    size_t len = strlen(etag);
    if (len >= 2 && start[0] == '"' && start[len - 1] == '"') {
        ++start;
        len -= 2;
    }

    for (size_t i = 0; i < len && remaining > 1; ++i) {
        const unsigned char c = static_cast<unsigned char>(start[i]);
        const bool safe =
            (c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') ||
            c == '-' || c == '_' || c == '.' || c == '~';
        if (safe) {
            *out++ = static_cast<char>(c);
            --remaining;
        } else if (remaining > 3) {
            snprintf(out, remaining, "%%%02X", c);
            out += 3;
            remaining -= 3;
        } else {
            break;
        }
    }
    *out = '\0';
}

bool sync_program() {
    char url[MX_HTTP_URL_BYTES];
    snprintf(url, sizeof(url), "%s/device/sync", MX_API_BASE_URL);

    HttpBuffer response;
    int status_code = 0;
    if (!perform_request(url, HTTP_METHOD_GET, &response, s_program_etag, nullptr, true, &status_code)) {
        return false;
    }

    if (status_code == 304) {
        return true;
    }
    if (status_code != 200) {
        ESP_LOGW(kTag, "/device/sync returned %d", status_code);
        return false;
    }

    cJSON *root = cJSON_ParseWithLength(reinterpret_cast<const char *>(response.body.data()), response.body.size());
    if (!root) {
        return false;
    }

    const cJSON *program_version = cJSON_GetObjectItemCaseSensitive(root, "programVersion");
    const cJSON *bytecode_url = cJSON_GetObjectItemCaseSensitive(root, "bytecodeUrl");
    if (!cJSON_IsNumber(program_version) || !cJSON_IsString(bytecode_url)) {
        cJSON_Delete(root);
        return false;
    }

    const uint32_t version = static_cast<uint32_t>(program_version->valuedouble);
    std::vector<uint8_t> bytecode;
    const bool bytecode_ok = fetch_binary_url(bytecode_url->valuestring, &bytecode);
    cJSON_Delete(root);
    if (!bytecode_ok) {
        return false;
    }

    if (!renderer_set_program_blob(bytecode.data(), bytecode.size(), version)) {
        return false;
    }

    s_program_version = version;
    if (!response.etag.empty()) {
        strlcpy(s_program_etag, response.etag.c_str(), sizeof(s_program_etag));
    }
    offline_store_program(bytecode.data(), bytecode.size(), s_program_etag, version);
    renderer_set_synced(true);
    s_synced_once = true;
    return true;
}

bool parse_slot_frame_json(const std::vector<uint8_t> &body, SlotFrame *frame) {
    if (!frame) {
        return false;
    }

    *frame = {};
    cJSON *root = cJSON_ParseWithLength(reinterpret_cast<const char *>(body.data()), body.size());
    if (!root) {
        return false;
    }

    const cJSON *version = cJSON_GetObjectItemCaseSensitive(root, "v");
    const cJSON *server_ts = cJSON_GetObjectItemCaseSensitive(root, "t");
    const cJSON *slots = cJSON_GetObjectItemCaseSensitive(root, "s");
    const cJSON *ages = cJSON_GetObjectItemCaseSensitive(root, "a");
    if (!cJSON_IsNumber(version) || !cJSON_IsNumber(server_ts) || !cJSON_IsObject(slots)) {
        cJSON_Delete(root);
        return false;
    }

    frame->data_version = static_cast<uint32_t>(version->valuedouble);
    frame->server_ms = static_cast<uint64_t>(server_ts->valuedouble * 1000.0);

    cJSON *slot_entry = nullptr;
    cJSON_ArrayForEach(slot_entry, slots) {
        if (!slot_entry->string) {
            continue;
        }
        const int index = atoi(slot_entry->string);
        if (index < 0 || index >= static_cast<int>(MX_SLOT_CAPACITY)) {
            continue;
        }

        SlotValue &slot = frame->slots[index];
        if (cJSON_IsString(slot_entry)) {
            slot.kind = SlotValueType::String;
            strlcpy(slot.string_value.data(), slot_entry->valuestring, slot.string_value.size());
        } else if (cJSON_IsBool(slot_entry)) {
            slot.kind = SlotValueType::Bool;
            slot.bool_value = cJSON_IsTrue(slot_entry);
        } else if (cJSON_IsNumber(slot_entry)) {
            const double v = slot_entry->valuedouble;
            if (fabs(v - round(v)) < 0.0001) {
                slot.kind = SlotValueType::Int;
                slot.int_value = static_cast<int32_t>(v);
            } else {
                slot.kind = SlotValueType::Float;
                slot.float_value = static_cast<float>(v);
            }
        } else {
            slot.kind = SlotValueType::Null;
        }

        if (ages && cJSON_IsObject(ages)) {
            const cJSON *updated = cJSON_GetObjectItemCaseSensitive(ages, slot_entry->string);
            if (cJSON_IsNumber(updated)) {
                slot.updated_ms = static_cast<uint32_t>(updated->valuedouble * 1000.0);
            }
        }
        frame->count = std::max<uint16_t>(frame->count, static_cast<uint16_t>(index + 1));
    }

    cJSON_Delete(root);
    return true;
}

// Minimal CBOR decoder for the backend slot-frame shape produced by convex/lib/cbor.ts:
// map { "v": uint, "t": uint, "s": map(string -> string|int|float|bool|null), "a": map(string -> number) }
struct CborCursor {
    const uint8_t *data = nullptr;
    size_t size = 0;
    size_t pos = 0;
};

bool cbor_read_bytes(CborCursor *c, size_t n, const uint8_t **out) {
    if (!c || c->pos + n > c->size) {
        return false;
    }
    if (out) {
        *out = c->data + c->pos;
    }
    c->pos += n;
    return true;
}

bool cbor_read_header(CborCursor *c, uint8_t *major, uint64_t *argument) {
    if (!c || !major || !argument || c->pos >= c->size) {
        return false;
    }

    const uint8_t initial = c->data[c->pos++];
    *major = initial >> 5;
    const uint8_t additional = initial & 0x1fu;

    // Major type 7 (simple/float): additional 25/26/27 leave a float payload for the caller.
    // additional 24 consumes one simple-value byte; 0-23 are immediates.
    if (*major == 7) {
        if (additional < 24) {
            *argument = additional;
            return true;
        }
        if (additional == 24) {
            const uint8_t *bytes = nullptr;
            if (!cbor_read_bytes(c, 1, &bytes)) {
                return false;
            }
            *argument = bytes[0];
            return true;
        }
        if (additional == 25 || additional == 26 || additional == 27) {
            *argument = additional;
            return true;
        }
        return false;
    }

    if (additional < 24) {
        *argument = additional;
        return true;
    }
    if (additional == 24) {
        const uint8_t *bytes = nullptr;
        if (!cbor_read_bytes(c, 1, &bytes)) {
            return false;
        }
        *argument = bytes[0];
        return true;
    }
    if (additional == 25) {
        const uint8_t *bytes = nullptr;
        if (!cbor_read_bytes(c, 2, &bytes)) {
            return false;
        }
        *argument = (static_cast<uint64_t>(bytes[0]) << 8) | bytes[1];
        return true;
    }
    if (additional == 26) {
        const uint8_t *bytes = nullptr;
        if (!cbor_read_bytes(c, 4, &bytes)) {
            return false;
        }
        *argument = (static_cast<uint64_t>(bytes[0]) << 24) | (static_cast<uint64_t>(bytes[1]) << 16) |
                    (static_cast<uint64_t>(bytes[2]) << 8) | bytes[3];
        return true;
    }
    if (additional == 27) {
        const uint8_t *bytes = nullptr;
        if (!cbor_read_bytes(c, 8, &bytes)) {
            return false;
        }
        *argument = (static_cast<uint64_t>(bytes[0]) << 56) | (static_cast<uint64_t>(bytes[1]) << 48) |
                    (static_cast<uint64_t>(bytes[2]) << 40) | (static_cast<uint64_t>(bytes[3]) << 32) |
                    (static_cast<uint64_t>(bytes[4]) << 24) | (static_cast<uint64_t>(bytes[5]) << 16) |
                    (static_cast<uint64_t>(bytes[6]) << 8) | bytes[7];
        return true;
    }
    // Indefinite lengths / reserved additional info are not used by the backend encoder.
    return false;
}

bool cbor_skip_value(CborCursor *c);

bool cbor_skip_n_values(CborCursor *c, uint64_t count) {
    for (uint64_t i = 0; i < count; ++i) {
        if (!cbor_skip_value(c)) {
            return false;
        }
    }
    return true;
}

bool cbor_skip_value(CborCursor *c) {
    uint8_t major = 0;
    uint64_t argument = 0;
    if (!cbor_read_header(c, &major, &argument)) {
        return false;
    }

    switch (major) {
        case 0:  // unsigned
        case 1:  // negative
            return true;
        case 2:  // byte string
        case 3:  // text string
            return cbor_read_bytes(c, static_cast<size_t>(argument), nullptr);
        case 4:  // array
            return cbor_skip_n_values(c, argument);
        case 5:  // map
            return cbor_skip_n_values(c, argument * 2);
        case 7:
            if (argument == 25) {
                return cbor_read_bytes(c, 2, nullptr);
            }
            if (argument == 26) {
                return cbor_read_bytes(c, 4, nullptr);
            }
            if (argument == 27) {
                return cbor_read_bytes(c, 8, nullptr);
            }
            // false / true / null / undefined and other simple values have no payload.
            return true;
        default:
            return false;
    }
}

bool cbor_read_text(CborCursor *c, std::string *out) {
    if (!out) {
        return false;
    }
    uint8_t major = 0;
    uint64_t argument = 0;
    if (!cbor_read_header(c, &major, &argument) || major != 3) {
        return false;
    }
    const uint8_t *bytes = nullptr;
    if (!cbor_read_bytes(c, static_cast<size_t>(argument), &bytes)) {
        return false;
    }
    out->assign(reinterpret_cast<const char *>(bytes), static_cast<size_t>(argument));
    return true;
}

bool cbor_read_float64_payload(CborCursor *c, double *out) {
    const uint8_t *bytes = nullptr;
    if (!cbor_read_bytes(c, 8, &bytes) || !out) {
        return false;
    }
    uint64_t bits = (static_cast<uint64_t>(bytes[0]) << 56) | (static_cast<uint64_t>(bytes[1]) << 48) |
                    (static_cast<uint64_t>(bytes[2]) << 40) | (static_cast<uint64_t>(bytes[3]) << 32) |
                    (static_cast<uint64_t>(bytes[4]) << 24) | (static_cast<uint64_t>(bytes[5]) << 16) |
                    (static_cast<uint64_t>(bytes[6]) << 8) | bytes[7];
    static_assert(sizeof(double) == sizeof(uint64_t), "unexpected double size");
    memcpy(out, &bits, sizeof(double));
    return true;
}

bool cbor_read_number(CborCursor *c, double *out, bool *is_integer) {
    if (!c || !out || !is_integer || c->pos >= c->size) {
        return false;
    }

    const uint8_t initial = c->data[c->pos];
    const uint8_t major = initial >> 5;
    const uint8_t additional = initial & 0x1fu;

    if (major == 0 || major == 1) {
        uint8_t read_major = 0;
        uint64_t argument = 0;
        if (!cbor_read_header(c, &read_major, &argument)) {
            return false;
        }
        if (read_major == 0) {
            *out = static_cast<double>(argument);
        } else {
            *out = -1.0 - static_cast<double>(argument);
        }
        *is_integer = true;
        return true;
    }

    if (major == 7 && additional == 27) {
        uint8_t read_major = 0;
        uint64_t argument = 0;
        if (!cbor_read_header(c, &read_major, &argument) || argument != 27) {
            return false;
        }
        if (!cbor_read_float64_payload(c, out)) {
            return false;
        }
        *is_integer = false;
        return true;
    }

    return false;
}

bool cbor_apply_slot_value(CborCursor *c, SlotValue *slot) {
    if (!c || !slot || c->pos >= c->size) {
        return false;
    }

    const uint8_t initial = c->data[c->pos];
    const uint8_t major = initial >> 5;
    const uint8_t additional = initial & 0x1fu;

    if (major == 7 && additional == 22) {
        // null
        ++c->pos;
        slot->kind = SlotValueType::Null;
        return true;
    }
    if (major == 7 && (additional == 20 || additional == 21)) {
        ++c->pos;
        slot->kind = SlotValueType::Bool;
        slot->bool_value = additional == 21;
        return true;
    }
    if (major == 3) {
        std::string text;
        if (!cbor_read_text(c, &text)) {
            return false;
        }
        slot->kind = SlotValueType::String;
        strlcpy(slot->string_value.data(), text.c_str(), slot->string_value.size());
        return true;
    }

    double number = 0.0;
    bool is_integer = false;
    if (!cbor_read_number(c, &number, &is_integer)) {
        return false;
    }
    if (is_integer || fabs(number - round(number)) < 0.0001) {
        slot->kind = SlotValueType::Int;
        slot->int_value = static_cast<int32_t>(number);
    } else {
        slot->kind = SlotValueType::Float;
        slot->float_value = static_cast<float>(number);
    }
    return true;
}

bool parse_slot_frame_cbor(const std::vector<uint8_t> &body, SlotFrame *frame) {
    if (!frame || body.empty()) {
        return false;
    }

    *frame = {};
    CborCursor cursor{body.data(), body.size(), 0};

    uint8_t major = 0;
    uint64_t map_len = 0;
    if (!cbor_read_header(&cursor, &major, &map_len) || major != 5) {
        return false;
    }

    bool saw_version = false;
    bool saw_server_ts = false;
    bool saw_slots = false;

    for (uint64_t i = 0; i < map_len; ++i) {
        std::string key;
        if (!cbor_read_text(&cursor, &key)) {
            return false;
        }

        if (key == "v") {
            double number = 0.0;
            bool is_integer = false;
            if (!cbor_read_number(&cursor, &number, &is_integer)) {
                return false;
            }
            frame->data_version = static_cast<uint32_t>(number);
            saw_version = true;
        } else if (key == "t") {
            double number = 0.0;
            bool is_integer = false;
            if (!cbor_read_number(&cursor, &number, &is_integer)) {
                return false;
            }
            frame->server_ms = static_cast<uint64_t>(number * 1000.0);
            saw_server_ts = true;
        } else if (key == "s") {
            uint8_t slots_major = 0;
            uint64_t slots_len = 0;
            if (!cbor_read_header(&cursor, &slots_major, &slots_len) || slots_major != 5) {
                return false;
            }
            for (uint64_t s = 0; s < slots_len; ++s) {
                std::string index_key;
                if (!cbor_read_text(&cursor, &index_key)) {
                    return false;
                }
                const int index = atoi(index_key.c_str());
                if (index < 0 || index >= static_cast<int>(MX_SLOT_CAPACITY)) {
                    if (!cbor_skip_value(&cursor)) {
                        return false;
                    }
                    continue;
                }
                if (!cbor_apply_slot_value(&cursor, &frame->slots[index])) {
                    return false;
                }
                frame->count = std::max<uint16_t>(frame->count, static_cast<uint16_t>(index + 1));
            }
            saw_slots = true;
        } else if (key == "a") {
            uint8_t ages_major = 0;
            uint64_t ages_len = 0;
            if (!cbor_read_header(&cursor, &ages_major, &ages_len) || ages_major != 5) {
                return false;
            }
            for (uint64_t a = 0; a < ages_len; ++a) {
                std::string index_key;
                if (!cbor_read_text(&cursor, &index_key)) {
                    return false;
                }
                double number = 0.0;
                bool is_integer = false;
                if (!cbor_read_number(&cursor, &number, &is_integer)) {
                    return false;
                }
                const int index = atoi(index_key.c_str());
                if (index < 0 || index >= static_cast<int>(MX_SLOT_CAPACITY)) {
                    continue;
                }
                frame->slots[index].updated_ms = static_cast<uint32_t>(number * 1000.0);
                frame->count = std::max<uint16_t>(frame->count, static_cast<uint16_t>(index + 1));
            }
        } else if (!cbor_skip_value(&cursor)) {
            return false;
        }
    }

    return saw_version && saw_server_ts && saw_slots;
}

bool content_type_has_json(const std::string &content_type) {
    return content_type.find("json") != std::string::npos;
}

bool body_starts_with_json_object(const std::vector<uint8_t> &body) {
    for (uint8_t byte : body) {
        if (byte == ' ' || byte == '\t' || byte == '\n' || byte == '\r') {
            continue;
        }
        return byte == '{';
    }
    return false;
}

bool sync_data() {
    char url[MX_HTTP_URL_BYTES];
    snprintf(url, sizeof(url), "%s/device/data", MX_API_BASE_URL);

    HttpBuffer response;
    int status_code = 0;
    if (!perform_request(url, HTTP_METHOD_GET, &response, s_data_etag, nullptr, true, &status_code)) {
        return false;
    }

    if (status_code == 304) {
        return true;
    }
    if (status_code != 200) {
        ESP_LOGW(kTag, "/device/data returned %d", status_code);
        return false;
    }

    SlotFrame frame{};
    const bool prefer_json =
        content_type_has_json(response.content_type) || body_starts_with_json_object(response.body);
    const bool parsed = prefer_json ? parse_slot_frame_json(response.body, &frame)
                                    : parse_slot_frame_cbor(response.body, &frame);
    if (!parsed) {
        ESP_LOGW(
            kTag,
            "/device/data returned invalid slot frame (%s)",
            prefer_json ? "json" : "cbor");
        return false;
    }
    if (!response.etag.empty()) {
        strlcpy(s_data_etag, response.etag.c_str(), sizeof(s_data_etag));
    }

    s_data_version = frame.data_version;
    renderer_apply_slot_frame(frame);
    renderer_mark_data_fresh();
    offline_store_slot_frame(frame, s_data_etag, response.body.data(), response.body.size());
    renderer_set_synced(true);
    s_synced_once = true;
    return true;
}

bool send_heartbeat() {
    char url[MX_HTTP_URL_BYTES];
    snprintf(url, sizeof(url), "%s/device/heartbeat", MX_API_BASE_URL);

    const SensorSnapshot sensors = sensors_get_snapshot();
    wifi_ap_record_t ap_info = {};
    int rssi = -127;
    if (esp_wifi_sta_get_ap_info(&ap_info) == ESP_OK) {
        rssi = ap_info.rssi;
    }

    cJSON *root = cJSON_CreateObject();
    cJSON_AddStringToObject(root, "fw", MX_FW_VERSION);
    cJSON_AddNumberToObject(root, "programVersion", renderer_get_program_version());
    cJSON_AddNumberToObject(root, "uptime", now_ms());
    cJSON_AddNumberToObject(root, "rssi", rssi);
    cJSON_AddNumberToObject(root, "heapFree", esp_get_free_heap_size());
    cJSON_AddNumberToObject(root, "psramFree", heap_caps_get_free_size(MALLOC_CAP_SPIRAM));
    cJSON_AddNumberToObject(root, "brightness", global_brightness);
    cJSON_AddNumberToObject(root, "lux", sensors.lux);
    cJSON_AddNumberToObject(root, "tempC", sensors.temperature_c);
    cJSON_AddNumberToObject(root, "humidity", sensors.humidity_pct);
    cJSON_AddBoolToObject(root, "presenceRoom", sensors.presence_room);
    cJSON_AddBoolToObject(root, "presenceBed", sensors.presence_bed);
    cJSON_AddNumberToObject(root, "estAmps", power_governor_last_estimate_amps());
    cJSON_AddBoolToObject(root, "governorActive", power_governor_active());
    cJSON_AddNullToObject(root, "lastError");

    char *payload = cJSON_PrintUnformatted(root);
    cJSON_Delete(root);
    if (!payload) {
        return false;
    }

    HttpBuffer response;
    int status_code = 0;
    const bool ok = perform_request(url, HTTP_METHOD_POST, &response, nullptr, payload, true, &status_code);
    cJSON_free(payload);
    return ok && status_code == 204;
}
}  // namespace

void net_sync_seed_cache(const char *program_etag, const char *data_etag, uint32_t program_version, uint32_t data_version) {
    if (program_etag) {
        strlcpy(s_program_etag, program_etag, sizeof(s_program_etag));
    }
    if (data_etag) {
        strlcpy(s_data_etag, data_etag, sizeof(s_data_etag));
    }
    s_program_version = program_version;
    s_data_version = data_version;
}

void net_sync_set_bearer_token(const char *token) {
    if (token) {
        strlcpy(s_bearer_token, token, sizeof(s_bearer_token));
    }
}

void net_sync_task(void *arg) {
    (void)arg;
    ESP_LOGI(kTag, "net_sync task pinned to core %d", xPortGetCoreID());

    uint32_t consecutive_failures = 0;
    bool need_program_sync = true;
    bool need_data_sync = true;

    while (true) {
        bool cycle_ok = true;
        if (need_program_sync) {
            cycle_ok = sync_program();
            need_program_sync = false;
        }
        if (cycle_ok && need_data_sync) {
            cycle_ok = sync_data();
            need_data_sync = false;
        }

        if (cycle_ok && (now_ms() - s_last_heartbeat_ms) >= MX_HEARTBEAT_INTERVAL_MS) {
            cycle_ok = send_heartbeat();
            if (cycle_ok) {
                s_last_heartbeat_ms = now_ms();
            }
        }

        bool program_changed = false;
        bool data_changed = false;
        if (cycle_ok) {
            char wait_url[MX_HTTP_URL_BYTES];
            snprintf(wait_url, sizeof(wait_url), "%s/device/wait", MX_API_BASE_URL);
            append_etag_query(wait_url, sizeof(wait_url), "program", s_program_etag);
            append_etag_query(wait_url, sizeof(wait_url), "data", s_data_etag);

            HttpBuffer response;
            int status_code = 0;
            cycle_ok = perform_request(
                wait_url,
                HTTP_METHOD_GET,
                &response,
                nullptr,
                nullptr,
                true,
                &status_code,
                MX_LONG_POLL_TIMEOUT_MS + 5'000);

            if (cycle_ok && status_code == 200) {
                cycle_ok = parse_wait_flags(response.body, &program_changed, &data_changed);
            } else if (cycle_ok && status_code == 204) {
                program_changed = false;
                data_changed = false;
            } else if (cycle_ok) {
                ESP_LOGW(kTag, "/device/wait returned %d", status_code);
                cycle_ok = false;
            }
        }

        if (cycle_ok && program_changed) {
            cycle_ok = sync_program();
        }
        if (cycle_ok && data_changed) {
            cycle_ok = sync_data();
        }

        if (cycle_ok) {
            consecutive_failures = 0;
            s_last_success_ms = now_ms();
            s_failure_since_ms = 0;
            if (s_synced_once) {
                renderer_set_synced(true);
            }
            continue;
        }

        renderer_set_synced(false);
        if (s_failure_since_ms == 0) {
            s_failure_since_ms = now_ms();
        }
        ++consecutive_failures;

        if ((now_ms() - s_failure_since_ms) >= MX_HARD_REBOOT_AFTER_MS) {
            ESP_LOGE(kTag, "Network failure exceeded 10 minutes, rebooting");
            esp_restart();
        }

        need_program_sync = true;
        need_data_sync = true;
        const uint32_t backoff_ms = compute_backoff_ms(consecutive_failures);
        ESP_LOGW(kTag, "sync failed; backing off for %u ms", static_cast<unsigned>(backoff_ms));
        vTaskDelay(pdMS_TO_TICKS(backoff_ms));
    }
}
