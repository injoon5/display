#include "mxr.h"

#include <stdio.h>
#include <string.h>

static void wr16(uint8_t *p, uint16_t v) {
    p[0] = (uint8_t)(v & 0xFFu);
    p[1] = (uint8_t)(v >> 8);
}

static void wr32(uint8_t *p, uint32_t v) {
    p[0] = (uint8_t)(v & 0xFFu);
    p[1] = (uint8_t)((v >> 8) & 0xFFu);
    p[2] = (uint8_t)((v >> 16) & 0xFFu);
    p[3] = (uint8_t)((v >> 24) & 0xFFu);
}

static void write_ppm(const char *path, const uint16_t *fb) {
    FILE *fp = fopen(path, "wb");
    int y;
    if (!fp) {
        fprintf(stderr, "failed to open %s\n", path);
        return;
    }
    fprintf(fp, "P6\n%d %d\n255\n", MXR_WIDTH, MXR_HEIGHT);
    for (y = 0; y < MXR_HEIGHT; ++y) {
        int x;
        for (x = 0; x < MXR_WIDTH; ++x) {
            uint16_t p = fb[y * MXR_WIDTH + x];
            unsigned char rgb[3];
            rgb[0] = (unsigned char)((((p >> 11) & 0x1Fu) * 255u) / 31u);
            rgb[1] = (unsigned char)((((p >> 5) & 0x3Fu) * 255u) / 63u);
            rgb[2] = (unsigned char)(((p & 0x1Fu) * 255u) / 31u);
            fwrite(rgb, 1, 3, fp);
        }
    }
    fclose(fp);
}

int main(void) {
    uint8_t program[160];
    uint16_t fb[MXR_FB_PIXELS];
    mxr_ctx_t ctx;
    mxr_diag_t diag;
    const char message[] = "HELLO MXR";
    uint8_t code[64];
    size_t string_len = sizeof(message);
    size_t code_len = 0;
    size_t total_len;

    memset(program, 0, sizeof(program));
    memset(fb, 0, sizeof(fb));

    memcpy(program, "MXR1", 4);
    wr16(program + 4, MXR_VERSION);
    wr16(program + 6, 0);
    program[8] = 0;
    program[9] = 0;
    wr16(program + 10, MXR_HEADER_SIZE);
    memcpy(program + MXR_HEADER_SIZE, message, string_len);
    wr16(program + 12, (uint16_t)(MXR_HEADER_SIZE + string_len));

    code[code_len++] = MXR_OP_CLEAR;
    wr16(code + code_len, 0x0000u);
    code_len += 2;

    code[code_len++] = MXR_OP_FRECT;
    code[code_len++] = 1;
    code[code_len++] = 1;
    code[code_len++] = 62;
    code[code_len++] = 30;
    wr16(code + code_len, 0x0013u);
    code_len += 2;

    code[code_len++] = MXR_OP_RECT;
    code[code_len++] = 0;
    code[code_len++] = 0;
    code[code_len++] = 64;
    code[code_len++] = 32;
    wr16(code + code_len, 0xFFE0u);
    code_len += 2;

    code[code_len++] = MXR_OP_TEXT;
    code[code_len++] = 5;
    code[code_len++] = 4;
    code[code_len++] = 1;
    wr16(code + code_len, 0xFFFFu);
    code_len += 2;
    code[code_len++] = 0;

    code[code_len++] = MXR_OP_TEXT;
    code[code_len++] = 8;
    code[code_len++] = 18;
    code[code_len++] = 0;
    wr16(code + code_len, 0x07FFu);
    code_len += 2;
    code[code_len++] = 0;

    code[code_len++] = MXR_OP_HALT;

    memcpy(program + MXR_HEADER_SIZE + string_len, code, code_len);
    wr16(program + 14, (uint16_t)code_len);
    total_len = MXR_HEADER_SIZE + string_len + code_len;
    wr32(program + 16, mxr_crc32(program + MXR_HEADER_SIZE, total_len - MXR_HEADER_SIZE));

    if (mxr_validate(program, total_len, &diag) != 0) {
        fprintf(stderr, "validate failed at %u: %s\n", diag.offset, diag.message);
        return 1;
    }

    memset(&ctx, 0, sizeof(ctx));
    ctx.fb = fb;
    ctx.program = program;
    ctx.program_len = total_len;
    ctx.t_ms = 0;

    if (mxr_render(&ctx) != 0) {
        fprintf(stderr, "render failed\n");
        return 1;
    }

    write_ppm("test_native.ppm", fb);
    printf("Rendered native test to test_native.ppm\n");
    printf("Estimated current: %.3f A\n", mxr_estimate_amps(fb, MXR_FB_PIXELS, 0.10f, 0.0000040f));
    return 0;
}
