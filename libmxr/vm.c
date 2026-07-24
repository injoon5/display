#include "mxr.h"

#include <stdio.h>
#include <string.h>

enum {
    MXR_OK = 0,
    MXR_ERR_ARG = -1,
    MXR_ERR_HEADER = -2,
    MXR_ERR_BOUNDS = -3,
    MXR_ERR_CRC = -4,
    MXR_ERR_OPCODE = -5,
    MXR_ERR_JUMP = -6,
    MXR_ERR_LIMIT = -7,
    MXR_ERR_STACK = -8,
};

typedef struct {
    const uint8_t *program;
    size_t len;
    uint16_t version;
    uint16_t flags;
    uint8_t slot_count;
    uint8_t asset_count;
    uint16_t string_off;
    uint16_t code_off;
    uint16_t code_len;
    uint32_t crc32;
    const uint8_t *strings;
    const uint8_t *strings_end;
    const uint8_t *code;
    const uint8_t *code_end;
} mxr_program_view_t;

typedef struct {
    uint16_t end;
    int dx;
    int dy;
} mxr_slide_state_t;

static uint16_t rd16(const uint8_t *p) {
    return (uint16_t)(p[0] | ((uint16_t)p[1] << 8));
}

static int32_t rd32s(const uint8_t *p) {
    return (int32_t)((uint32_t)p[0] |
                     ((uint32_t)p[1] << 8) |
                     ((uint32_t)p[2] << 16) |
                     ((uint32_t)p[3] << 24));
}

static uint32_t rd32u(const uint8_t *p) {
    return (uint32_t)p[0] |
           ((uint32_t)p[1] << 8) |
           ((uint32_t)p[2] << 16) |
           ((uint32_t)p[3] << 24);
}

static void set_diag(mxr_diag_t *out, int code, uint16_t offset, uint16_t op, const char *msg) {
    if (!out) {
        return;
    }
    out->code = code;
    out->offset = offset;
    out->op = op;
    out->message[0] = '\0';
    if (msg) {
        snprintf(out->message, sizeof(out->message), "%s", msg);
    }
}

uint32_t mxr_crc32(const void *data, size_t len) {
    const uint8_t *p = (const uint8_t *)data;
    uint32_t crc = 0xFFFFFFFFu;
    size_t i;
    for (i = 0; i < len; ++i) {
        int bit;
        crc ^= p[i];
        for (bit = 0; bit < 8; ++bit) {
            uint32_t mask = (uint32_t)-(int)(crc & 1u);
            crc = (crc >> 1) ^ (0xEDB88320u & mask);
        }
    }
    return ~crc;
}

static int signature_is_zero(const uint8_t *program) {
    unsigned i;
    for (i = 20; i < MXR_HEADER_SIZE; ++i) {
        if (program[i] != 0u) {
            return 0;
        }
    }
    return 1;
}

static int parse_view(const uint8_t *program, size_t len, int require_len, mxr_program_view_t *out, mxr_diag_t *diag) {
    if (!program || !out) {
        set_diag(diag, MXR_ERR_ARG, 0, 0, "null program");
        return MXR_ERR_ARG;
    }
    if (require_len && len < MXR_HEADER_SIZE) {
        set_diag(diag, MXR_ERR_HEADER, 0, 0, "program shorter than MXR header");
        return MXR_ERR_HEADER;
    }
    if (memcmp(program, "MXR1", 4) != 0) {
        set_diag(diag, MXR_ERR_HEADER, 0, 0, "bad magic, expected MXR1");
        return MXR_ERR_HEADER;
    }
    out->program = program;
    out->len = len;
    out->version = rd16(program + 4);
    out->flags = rd16(program + 6);
    out->slot_count = program[8];
    out->asset_count = program[9];
    out->string_off = rd16(program + 10);
    out->code_off = rd16(program + 12);
    out->code_len = rd16(program + 14);
    out->crc32 = rd32u(program + 16);
    if (out->version != MXR_VERSION) {
        set_diag(diag, MXR_ERR_HEADER, 4, 0, "unsupported MXR version");
        return MXR_ERR_HEADER;
    }
    if (out->string_off < MXR_HEADER_SIZE || out->code_off < out->string_off) {
        set_diag(diag, MXR_ERR_HEADER, 10, 0, "invalid string/code offsets");
        return MXR_ERR_HEADER;
    }
    if (require_len) {
        if ((size_t)out->string_off > len || (size_t)out->code_off > len || (size_t)out->code_off + out->code_len > len) {
            set_diag(diag, MXR_ERR_BOUNDS, 12, 0, "string or code section out of bounds");
            return MXR_ERR_BOUNDS;
        }
        if (mxr_crc32(program + MXR_HEADER_SIZE, len - MXR_HEADER_SIZE) != out->crc32) {
            set_diag(diag, MXR_ERR_CRC, 16, 0, "crc32 mismatch");
            return MXR_ERR_CRC;
        }
    }
    (void)signature_is_zero(program);
    out->strings = program + out->string_off;
    out->strings_end = program + out->code_off;
    out->code = program + out->code_off;
    out->code_end = out->code + out->code_len;
    return MXR_OK;
}

static size_t string_count(const mxr_program_view_t *view) {
    size_t count = 0;
    const uint8_t *p = view->strings;
    int have_bytes = 0;
    while (p < view->strings_end) {
        have_bytes = 1;
        if (*p == 0) {
            ++count;
            have_bytes = 0;
        }
        ++p;
    }
    if (have_bytes) {
        ++count;
    }
    return count;
}

static const char *string_at(const mxr_program_view_t *view, uint8_t index) {
    const char *s = (const char *)view->strings;
    const char *end = (const char *)view->strings_end;
    uint8_t current = 0;
    while (s < end) {
        const char *start = s;
        while (s < end && *s != '\0') {
            ++s;
        }
        if (current == index) {
            return start;
        }
        ++current;
        if (s < end) {
            ++s;
        }
    }
    return "";
}

static int current_dim(const uint8_t *dims, int depth) {
    int i;
    int pct = 100;
    for (i = 0; i < depth; ++i) {
        pct = (pct * dims[i]) / 100;
    }
    if (pct < 0) {
        pct = 0;
    }
    if (pct > 100) {
        pct = 100;
    }
    return pct;
}

static int slot_truthy(const mxr_slot_t *slot) {
    if (!slot) {
        return 0;
    }
    switch (slot->kind) {
        case MXR_SLOT_INT: return slot->as.i != 0;
        case MXR_SLOT_FLOAT: return slot->as.f != 0.0f;
        case MXR_SLOT_STR: return slot->as.s && slot->as.s[0] != '\0';
        case MXR_SLOT_COLOR: return slot->as.color != 0;
        case MXR_SLOT_BOOL: return slot->as.b != 0;
        default: return 0;
    }
}

static int slot_to_i32(const mxr_slot_t *slot, int *out) {
    if (!slot || !out) {
        return 0;
    }
    switch (slot->kind) {
        case MXR_SLOT_INT:
            *out = slot->as.i;
            return 1;
        case MXR_SLOT_FLOAT:
            *out = (int)slot->as.f;
            return 1;
        case MXR_SLOT_COLOR:
            *out = slot->as.color;
            return 1;
        case MXR_SLOT_BOOL:
            *out = slot->as.b ? 1 : 0;
            return 1;
        default:
            return 0;
    }
}

static const char *slot_to_text(const mxr_slot_t *slot, char *buf, size_t buf_sz) {
    if (!slot) {
        return "";
    }
    switch (slot->kind) {
        case MXR_SLOT_INT:
            snprintf(buf, buf_sz, "%d", slot->as.i);
            return buf;
        case MXR_SLOT_FLOAT: {
            char *dot;
            snprintf(buf, buf_sz, "%.2f", (double)slot->as.f);
            dot = strchr(buf, '.');
            if (dot) {
                char *end = buf + strlen(buf) - 1;
                while (end > dot && *end == '0') {
                    *end-- = '\0';
                }
                if (end == dot) {
                    *end = '\0';
                }
            }
            return buf;
        }
        case MXR_SLOT_STR:
            return slot->as.s ? slot->as.s : "";
        case MXR_SLOT_COLOR:
            snprintf(buf, buf_sz, "#%04X", slot->as.color);
            return buf;
        case MXR_SLOT_BOOL:
            return slot->as.b ? "true" : "false";
        default:
            return "";
    }
}

static void slot_to_digits(const mxr_slot_t *slot, uint8_t pad, char *buf, size_t buf_sz) {
    int value = 0;
    if (!slot || slot->kind == MXR_SLOT_NULL) {
        snprintf(buf, buf_sz, "--");
        return;
    }
    if (!slot_to_i32(slot, &value)) {
        snprintf(buf, buf_sz, "%s", slot_to_text(slot, buf, buf_sz));
        return;
    }
    if (pad > 0 && pad < (uint8_t)(buf_sz - 1u)) {
        snprintf(buf, buf_sz, "%0*d", pad, value);
    } else {
        snprintf(buf, buf_sz, "%d", value);
    }
}

static void scratch_store(mxr_ctx_t *ctx, uint8_t index, int32_t value) {
    size_t off;
    if (!ctx || index >= MXR_SCRATCH_SLOTS) {
        return;
    }
    off = (size_t)index * sizeof(int32_t);
    memcpy(ctx->scratch + off, &value, sizeof(value));
}

static int valid_target(const uint16_t *bounds, size_t n, uint16_t target) {
    size_t i;
    for (i = 0; i < n; ++i) {
        if (bounds[i] == target) {
            return 1;
        }
    }
    return 0;
}

static int validate_code(const mxr_program_view_t *view, mxr_diag_t *diag) {
    const uint8_t *pc = view->code;
    uint16_t bounds[MXR_MAX_OPS + 1u];
    size_t op_count = 0;
    size_t strings = string_count(view);
    uint8_t op = 0;
    uint16_t rel = 0;

    while (pc < view->code_end) {
        op = *pc++;
        size_t remain = (size_t)(view->code_end - pc);
        rel = (uint16_t)((pc - 1) - view->code);
        bounds[op_count++] = rel;
        if (op_count > MXR_MAX_OPS) {
            set_diag(diag, MXR_ERR_LIMIT, rel, op, "program exceeds 2048 op limit");
            return MXR_ERR_LIMIT;
        }
        switch (op) {
            case MXR_OP_CLEAR:
                if (remain < 2u) goto bad_bounds;
                pc += 2;
                break;
            case MXR_OP_FRECT:
            case MXR_OP_RECT:
                if (remain < 6u) goto bad_bounds;
                pc += 6;
                break;
            case MXR_OP_LINE:
            case MXR_OP_GRADV:
                if (remain < (op == MXR_OP_LINE ? 6u : 8u)) goto bad_bounds;
                pc += (op == MXR_OP_LINE ? 6u : 8u);
                break;
            case MXR_OP_PIXEL:
                if (remain < 4u) goto bad_bounds;
                pc += 4;
                break;
            case MXR_OP_TEXT:
                if (remain < 6u) goto bad_bounds;
                if ((pc[5] & 0x80u) != 0u) {
                    if ((pc[5] & 0x7Fu) >= view->slot_count) {
                        set_diag(diag, MXR_ERR_BOUNDS, rel, op, "TEXT slot reference out of range");
                        return MXR_ERR_BOUNDS;
                    }
                } else if ((pc[5] & 0x7Fu) >= strings) {
                    set_diag(diag, MXR_ERR_BOUNDS, rel, op, "TEXT string reference out of range");
                    return MXR_ERR_BOUNDS;
                }
                pc += 6;
                break;
            case MXR_OP_MARQUEE:
                if (remain < 8u) goto bad_bounds;
                if ((pc[7] & 0x80u) != 0u) {
                    if ((pc[7] & 0x7Fu) >= view->slot_count) {
                        set_diag(diag, MXR_ERR_BOUNDS, rel, op, "MARQUEE slot reference out of range");
                        return MXR_ERR_BOUNDS;
                    }
                } else if ((pc[7] & 0x7Fu) >= strings) {
                    set_diag(diag, MXR_ERR_BOUNDS, rel, op, "MARQUEE string reference out of range");
                    return MXR_ERR_BOUNDS;
                }
                pc += 8;
                break;
            case MXR_OP_DIGITS:
                if (remain < 7u) goto bad_bounds;
                if (pc[5] >= view->slot_count) {
                    set_diag(diag, MXR_ERR_BOUNDS, rel, op, "DIGITS slot out of range");
                    return MXR_ERR_BOUNDS;
                }
                pc += 7;
                break;
            case MXR_OP_MEASURE:
                if (remain < 3u) goto bad_bounds;
                if (pc[0] >= view->slot_count || pc[2] >= MXR_SCRATCH_SLOTS) {
                    set_diag(diag, MXR_ERR_BOUNDS, rel, op, "MEASURE slot or scratch index out of range");
                    return MXR_ERR_BOUNDS;
                }
                pc += 3;
                break;
            case MXR_OP_BLIT:
            case MXR_OP_SPRITE: {
                uint16_t asset;
                if (remain < (op == MXR_OP_BLIT ? 4u : 5u)) goto bad_bounds;
                asset = rd16(pc + 2);
                if (asset >= view->asset_count) {
                    set_diag(diag, MXR_ERR_BOUNDS, rel, op, "asset index out of range");
                    return MXR_ERR_BOUNDS;
                }
                pc += (op == MXR_OP_BLIT ? 4u : 5u);
                break;
            }
            case MXR_OP_BLITC: {
                uint16_t asset;
                if (remain < 6u) goto bad_bounds;
                asset = rd16(pc + 2);
                if (asset >= view->asset_count) {
                    set_diag(diag, MXR_ERR_BOUNDS, rel, op, "asset index out of range");
                    return MXR_ERR_BOUNDS;
                }
                pc += 6;
                break;
            }
            case MXR_OP_JMP:
            case MXR_OP_JMPZ:
            case MXR_OP_JMPCMP:
            case MXR_OP_JMPSTALE:
            case MXR_OP_BLINK:
            case MXR_OP_FADE:
            case MXR_OP_SLIDE: {
                uint16_t target = 0;
                if (op == MXR_OP_JMP) {
                    if (remain < 2u) goto bad_bounds;
                    target = rd16(pc);
                    pc += 2;
                } else if (op == MXR_OP_JMPZ) {
                    if (remain < 3u) goto bad_bounds;
                    if (pc[0] >= view->slot_count) {
                        set_diag(diag, MXR_ERR_BOUNDS, rel, op, "JMPZ slot out of range");
                        return MXR_ERR_BOUNDS;
                    }
                    target = rd16(pc + 1);
                    pc += 3;
                } else if (op == MXR_OP_JMPCMP) {
                    if (remain < 8u) goto bad_bounds;
                    if (pc[0] >= view->slot_count || pc[1] > 5u) {
                        set_diag(diag, MXR_ERR_BOUNDS, rel, op, "JMPCMP operand out of range");
                        return MXR_ERR_BOUNDS;
                    }
                    target = rd16(pc + 6);
                    pc += 8;
                } else if (op == MXR_OP_JMPSTALE) {
                    if (remain < 5u) goto bad_bounds;
                    if (pc[0] >= view->slot_count) {
                        set_diag(diag, MXR_ERR_BOUNDS, rel, op, "JMPSTALE slot out of range");
                        return MXR_ERR_BOUNDS;
                    }
                    target = rd16(pc + 3);
                    pc += 5;
                } else if (op == MXR_OP_BLINK) {
                    if (remain < 5u) goto bad_bounds;
                    target = rd16(pc + 3);
                    pc += 5;
                } else if (op == MXR_OP_FADE) {
                    if (remain < 6u) goto bad_bounds;
                    target = rd16(pc + 4);
                    pc += 6;
                } else {
                    if (remain < 7u) goto bad_bounds;
                    target = rd16(pc + 5);
                    pc += 7;
                }
                if (target >= view->code_len || target <= rel) {
                    set_diag(diag, MXR_ERR_JUMP, rel, op, "backward or out-of-range jump target");
                    return MXR_ERR_JUMP;
                }
                break;
            }
            case MXR_OP_PUSHCLIP:
                if (remain < 4u) goto bad_bounds;
                pc += 4;
                break;
            case MXR_OP_POPCLIP:
            case MXR_OP_POPDIM:
            case MXR_OP_NOP:
            case MXR_OP_HALT:
                break;
            case MXR_OP_PUSHDIM:
                if (remain < 1u) goto bad_bounds;
                pc += 1;
                break;
            default:
                set_diag(diag, MXR_ERR_OPCODE, rel, op, "unknown opcode");
                return MXR_ERR_OPCODE;
        }
    }
    bounds[op_count] = view->code_len;

    pc = view->code;
    while (pc < view->code_end) {
        op = *pc++;
        rel = (uint16_t)((pc - 1) - view->code);
        uint16_t target;
        switch (op) {
            case MXR_OP_JMP:
                target = rd16(pc);
                if (!valid_target(bounds, op_count + 1u, target)) goto bad_target;
                pc += 2;
                break;
            case MXR_OP_JMPZ:
                target = rd16(pc + 1);
                if (!valid_target(bounds, op_count + 1u, target)) goto bad_target;
                pc += 3;
                break;
            case MXR_OP_JMPCMP:
                target = rd16(pc + 6);
                if (!valid_target(bounds, op_count + 1u, target)) goto bad_target;
                pc += 8;
                break;
            case MXR_OP_JMPSTALE:
                target = rd16(pc + 3);
                if (!valid_target(bounds, op_count + 1u, target)) goto bad_target;
                pc += 5;
                break;
            case MXR_OP_BLINK:
                target = rd16(pc + 3);
                if (!valid_target(bounds, op_count + 1u, target)) goto bad_target;
                pc += 5;
                break;
            case MXR_OP_FADE:
                target = rd16(pc + 4);
                if (!valid_target(bounds, op_count + 1u, target)) goto bad_target;
                pc += 6;
                break;
            case MXR_OP_SLIDE:
                target = rd16(pc + 5);
                if (!valid_target(bounds, op_count + 1u, target)) goto bad_target;
                pc += 7;
                break;
            case MXR_OP_CLEAR: pc += 2; break;
            case MXR_OP_FRECT: case MXR_OP_RECT: pc += 6; break;
            case MXR_OP_LINE: pc += 6; break;
            case MXR_OP_PIXEL: pc += 4; break;
            case MXR_OP_GRADV: pc += 8; break;
            case MXR_OP_TEXT: pc += 6; break;
            case MXR_OP_MARQUEE: pc += 8; break;
            case MXR_OP_DIGITS: pc += 7; break;
            case MXR_OP_MEASURE: pc += 3; break;
            case MXR_OP_BLIT: pc += 4; break;
            case MXR_OP_BLITC: pc += 6; break;
            case MXR_OP_SPRITE: pc += 5; break;
            case MXR_OP_PUSHCLIP: pc += 4; break;
            case MXR_OP_PUSHDIM: pc += 1; break;
            default: break;
        }
    }
    return MXR_OK;

bad_bounds:
    set_diag(diag, MXR_ERR_BOUNDS, rel, op, "opcode payload extends past code section");
    return MXR_ERR_BOUNDS;

bad_target:
    set_diag(diag, MXR_ERR_JUMP, rel, op, "jump target does not land on an opcode boundary");
    return MXR_ERR_JUMP;
}

int mxr_validate(const uint8_t *program, size_t len, mxr_diag_t *out) {
    mxr_program_view_t view;
    int rc;
    if (out) {
        memset(out, 0, sizeof(*out));
    }
    rc = parse_view(program, len, 1, &view, out);
    if (rc != MXR_OK) {
        return rc;
    }
    return validate_code(&view, out);
}

float mxr_estimate_amps(const uint16_t *fb, size_t n, float cal_idle, float cal_k) {
    uint32_t sum = 0;
    size_t i;
    if (!fb) {
        return cal_idle;
    }
    for (i = 0; i < n; ++i) {
        uint16_t p = fb[i];
        sum += (uint32_t)(((p >> 11) & 0x1F) * 8u);
        sum += (uint32_t)(((p >> 5) & 0x3F) * 4u);
        sum += (uint32_t)((p & 0x1F) * 8u);
    }
    return cal_idle + (float)sum * cal_k;
}

int mxr_render(mxr_ctx_t *ctx) {
    mxr_program_view_t view;
    const uint8_t *pc;
    mxr_rect_t clip_stack[MXR_MAX_CLIP_DEPTH];
    uint8_t dim_stack[MXR_MAX_DIM_DEPTH];
    uint16_t fade_end[MXR_MAX_DIM_DEPTH];
    mxr_slide_state_t slides[MXR_MAX_CLIP_DEPTH];
    int clip_depth = 1;
    int dim_depth = 1;
    int fade_depth = 0;
    int slide_depth = 0;
    int ops = 0;
    int rc;

    if (!ctx || !ctx->fb || !ctx->program) {
        return MXR_ERR_ARG;
    }
    rc = parse_view(ctx->program, ctx->program_len, ctx->program_len != 0u, &view, NULL);
    if (rc != MXR_OK) {
        return rc;
    }
    memset(ctx->scratch, 0, sizeof(ctx->scratch));
    clip_stack[0] = mxr_rect_full();
    dim_stack[0] = 100u;
    pc = view.code;

    while (pc < view.code_end && ops < (int)MXR_MAX_OPS) {
        uint16_t rel = (uint16_t)(pc - view.code);
        uint8_t op = *pc++;
        int tx = 0;
        int ty = 0;
        int i;
        ++ops;

        while (fade_depth > 0 && rel >= fade_end[fade_depth - 1]) {
            if (dim_depth > 1) {
                --dim_depth;
            }
            --fade_depth;
        }
        while (slide_depth > 0 && rel >= slides[slide_depth - 1].end) {
            --slide_depth;
        }
        for (i = 0; i < slide_depth; ++i) {
            tx += slides[i].dx;
            ty += slides[i].dy;
        }

        switch (op) {
            case MXR_OP_CLEAR: {
                uint16_t color = mxr_dim_color(rd16(pc), (uint8_t)current_dim(dim_stack, dim_depth));
                mxr_raster_clear(ctx->fb, color);
                pc += 2;
                break;
            }
            case MXR_OP_FRECT: {
                uint16_t color = mxr_dim_color(rd16(pc + 4), (uint8_t)current_dim(dim_stack, dim_depth));
                mxr_raster_frect(ctx->fb, &clip_stack[clip_depth - 1], tx + pc[0], ty + pc[1], pc[2], pc[3], color);
                pc += 6;
                break;
            }
            case MXR_OP_RECT: {
                uint16_t color = mxr_dim_color(rd16(pc + 4), (uint8_t)current_dim(dim_stack, dim_depth));
                mxr_raster_rect(ctx->fb, &clip_stack[clip_depth - 1], tx + pc[0], ty + pc[1], pc[2], pc[3], color);
                pc += 6;
                break;
            }
            case MXR_OP_LINE: {
                uint16_t color = mxr_dim_color(rd16(pc + 4), (uint8_t)current_dim(dim_stack, dim_depth));
                mxr_raster_line(ctx->fb, &clip_stack[clip_depth - 1], tx + pc[0], ty + pc[1], tx + pc[2], ty + pc[3], color);
                pc += 6;
                break;
            }
            case MXR_OP_PIXEL: {
                uint16_t color = mxr_dim_color(rd16(pc + 2), (uint8_t)current_dim(dim_stack, dim_depth));
                mxr_raster_pixel(ctx->fb, &clip_stack[clip_depth - 1], tx + pc[0], ty + pc[1], color);
                pc += 4;
                break;
            }
            case MXR_OP_GRADV: {
                uint16_t c0 = mxr_dim_color(rd16(pc + 4), (uint8_t)current_dim(dim_stack, dim_depth));
                uint16_t c1 = mxr_dim_color(rd16(pc + 6), (uint8_t)current_dim(dim_stack, dim_depth));
                mxr_raster_gradv(ctx->fb, &clip_stack[clip_depth - 1], tx + pc[0], ty + pc[1], pc[2], pc[3], c0, c1);
                pc += 8;
                break;
            }
            case MXR_OP_TEXT:
            case MXR_OP_MARQUEE: {
                char buf[48];
                uint8_t x = pc[0];
                uint8_t y = pc[1];
                uint8_t font = pc[2];
                uint16_t color = mxr_dim_color(rd16(pc + 3), (uint8_t)current_dim(dim_stack, dim_depth));
                const char *s;
                uint8_t src = (op == MXR_OP_TEXT) ? pc[5] : pc[7];
                if (src & 0x80u) {
                    uint8_t slot_idx = src & 0x7Fu;
                    s = slot_to_text(slot_idx < view.slot_count ? &ctx->slots[slot_idx] : NULL, buf, sizeof(buf));
                } else {
                    s = string_at(&view, src & 0x7Fu);
                }
                if (op == MXR_OP_TEXT) {
                    mxr_text_draw(ctx->fb, &clip_stack[clip_depth - 1], tx + x, ty + y, font, color, s);
                    pc += 6;
                } else {
                    int text_w = 0;
                    int text_h = 0;
                    int box_w = pc[2];
                    mxr_rect_t clip = mxr_rect_intersect(clip_stack[clip_depth - 1], mxr_rect_make(tx + x, ty + y, box_w, (int)mxr_font_info(font)->height));
                    mxr_text_measure(font, s, &text_w, &text_h);
                    if (text_w <= box_w) {
                        mxr_text_draw(ctx->fb, &clip, tx + x, ty + y, font, color, s);
                    } else {
                        int gap = mxr_text_tabular_advance(font) + 2;
                        int off = mxr_anim_marquee_offset(text_w, box_w, pc[6], ctx->t_ms);
                        mxr_text_draw(ctx->fb, &clip, tx + x - off, ty + y, font, color, s);
                        mxr_text_draw(ctx->fb, &clip, tx + x - off + text_w + gap, ty + y, font, color, s);
                    }
                    pc += 8;
                }
                break;
            }
            case MXR_OP_DIGITS: {
                char buf[32];
                uint8_t font = pc[2];
                uint16_t color = mxr_dim_color(rd16(pc + 3), (uint8_t)current_dim(dim_stack, dim_depth));
                uint8_t slot_idx = pc[5];
                slot_to_digits(slot_idx < view.slot_count ? &ctx->slots[slot_idx] : NULL, pc[6], buf, sizeof(buf));
                mxr_text_draw_digits(ctx->fb, &clip_stack[clip_depth - 1], tx + pc[0], ty + pc[1], font, color, buf);
                pc += 7;
                break;
            }
            case MXR_OP_MEASURE: {
                char buf[48];
                const char *s = slot_to_text(pc[0] < view.slot_count ? &ctx->slots[pc[0]] : NULL, buf, sizeof(buf));
                int w = 0;
                mxr_text_measure(pc[1], s, &w, NULL);
                scratch_store(ctx, pc[2], (int32_t)w);
                pc += 3;
                break;
            }
            case MXR_OP_BLIT: {
                const mxr_asset_t *asset = (ctx->assets && rd16(pc + 2) < view.asset_count) ? &ctx->assets[rd16(pc + 2)] : NULL;
                mxr_raster_blit(ctx->fb, &clip_stack[clip_depth - 1], tx + pc[0], ty + pc[1], asset, 0);
                pc += 4;
                break;
            }
            case MXR_OP_BLITC: {
                const mxr_asset_t *asset = (ctx->assets && rd16(pc + 2) < view.asset_count) ? &ctx->assets[rd16(pc + 2)] : NULL;
                uint16_t tint = mxr_dim_color(rd16(pc + 4), (uint8_t)current_dim(dim_stack, dim_depth));
                mxr_raster_blit_tint(ctx->fb, &clip_stack[clip_depth - 1], tx + pc[0], ty + pc[1], asset, tint, 0);
                pc += 6;
                break;
            }
            case MXR_OP_SPRITE: {
                const mxr_asset_t *asset = (ctx->assets && rd16(pc + 2) < view.asset_count) ? &ctx->assets[rd16(pc + 2)] : NULL;
                uint8_t frame = 0;
                if (asset && asset->frames > 1 && pc[4] > 0) {
                    frame = (uint8_t)(((ctx->t_ms * pc[4]) / 1000u) % asset->frames);
                }
                mxr_raster_blit(ctx->fb, &clip_stack[clip_depth - 1], tx + pc[0], ty + pc[1], asset, frame);
                pc += 5;
                break;
            }
            case MXR_OP_JMP:
                pc = view.code + rd16(pc);
                break;
            case MXR_OP_JMPZ: {
                uint8_t slot_idx = pc[0];
                uint16_t target = rd16(pc + 1);
                if (!slot_truthy(slot_idx < view.slot_count ? &ctx->slots[slot_idx] : NULL)) {
                    pc = view.code + target;
                } else {
                    pc += 3;
                }
                break;
            }
            case MXR_OP_JMPCMP: {
                uint8_t slot_idx = pc[0];
                uint8_t cmp = pc[1];
                int32_t imm = rd32s(pc + 2);
                uint16_t target = rd16(pc + 6);
                int value = 0;
                int jump = 0;
                if (slot_to_i32(slot_idx < view.slot_count ? &ctx->slots[slot_idx] : NULL, &value)) {
                    switch (cmp) {
                        case 0: jump = value == imm; break;
                        case 1: jump = value != imm; break;
                        case 2: jump = value < imm; break;
                        case 3: jump = value <= imm; break;
                        case 4: jump = value > imm; break;
                        case 5: jump = value >= imm; break;
                        default: jump = 0; break;
                    }
                }
                if (jump) {
                    pc = view.code + target;
                } else {
                    pc += 8;
                }
                break;
            }
            case MXR_OP_JMPSTALE: {
                uint8_t slot_idx = pc[0];
                uint16_t stale_ms = rd16(pc + 1);
                uint16_t target = rd16(pc + 3);
                const mxr_slot_t *slot = slot_idx < view.slot_count ? &ctx->slots[slot_idx] : NULL;
                if (slot && ctx->t_ms > slot->updated_ms && (ctx->t_ms - slot->updated_ms) > stale_ms) {
                    pc = view.code + target;
                } else {
                    pc += 5;
                }
                break;
            }
            case MXR_OP_PUSHCLIP: {
                if (clip_depth >= (int)MXR_MAX_CLIP_DEPTH) {
                    return MXR_ERR_STACK;
                }
                clip_stack[clip_depth] = mxr_rect_intersect(clip_stack[clip_depth - 1], mxr_rect_make(tx + pc[0], ty + pc[1], pc[2], pc[3]));
                ++clip_depth;
                pc += 4;
                break;
            }
            case MXR_OP_POPCLIP:
                if (clip_depth > 1) {
                    --clip_depth;
                }
                break;
            case MXR_OP_PUSHDIM:
                if (dim_depth >= (int)MXR_MAX_DIM_DEPTH) {
                    return MXR_ERR_STACK;
                }
                dim_stack[dim_depth++] = pc[0] > 100u ? 100u : pc[0];
                ++pc;
                break;
            case MXR_OP_POPDIM:
                if (dim_depth > 1) {
                    --dim_depth;
                }
                break;
            case MXR_OP_BLINK: {
                uint16_t rate = rd16(pc);
                uint8_t duty = pc[2];
                uint16_t end = rd16(pc + 3);
                if (!mxr_anim_blink(ctx->t_ms, rate, duty)) {
                    pc = view.code + end;
                } else {
                    pc += 5;
                }
                break;
            }
            case MXR_OP_FADE: {
                uint8_t pct;
                if (dim_depth >= (int)MXR_MAX_DIM_DEPTH || fade_depth >= (int)MXR_MAX_DIM_DEPTH) {
                    return MXR_ERR_STACK;
                }
                pct = mxr_anim_fade(ctx->t_ms, pc[0], pc[1], rd16(pc + 2));
                dim_stack[dim_depth++] = pct;
                fade_end[fade_depth++] = rd16(pc + 4);
                pc += 6;
                break;
            }
            case MXR_OP_SLIDE: {
                int dx;
                int dy;
                if (slide_depth >= (int)MXR_MAX_CLIP_DEPTH) {
                    return MXR_ERR_STACK;
                }
                mxr_anim_slide(ctx->t_ms, pc[0], rd16(pc + 1), (int8_t)pc[3], (int8_t)pc[4], &dx, &dy);
                slides[slide_depth].end = rd16(pc + 5);
                slides[slide_depth].dx = dx;
                slides[slide_depth].dy = dy;
                ++slide_depth;
                pc += 7;
                break;
            }
            case MXR_OP_NOP:
                break;
            case MXR_OP_HALT:
                return MXR_OK;
            default:
                return MXR_ERR_OPCODE;
        }
    }
    return MXR_OK;
}
