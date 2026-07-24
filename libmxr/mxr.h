#ifndef MXR_H
#define MXR_H

#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

#define MXR_WIDTH 64
#define MXR_HEIGHT 32
#define MXR_FB_PIXELS (MXR_WIDTH * MXR_HEIGHT)
#define MXR_HEADER_SIZE 84u
#define MXR_MAX_OPS 2048u
#define MXR_SCRATCH_BYTES 256u
#define MXR_SCRATCH_SLOTS 64u
#define MXR_MAX_CLIP_DEPTH 4u
#define MXR_MAX_DIM_DEPTH 8u
#define MXR_VERSION 1u

typedef enum {
    MXR_SLOT_NULL = 0,
    MXR_SLOT_INT = 1,
    MXR_SLOT_FLOAT = 2,
    MXR_SLOT_STR = 3,
    MXR_SLOT_COLOR = 4,
    MXR_SLOT_BOOL = 5,
} mxr_slot_kind_t;

typedef struct {
    mxr_slot_kind_t kind;
    uint32_t updated_ms;
    union {
        int32_t i;
        float f;
        const char *s;
        uint16_t color;
        uint8_t b;
    } as;
} mxr_slot_t;

typedef enum {
    MXR_ASSET_RGB565 = 0,
    MXR_ASSET_MASK1 = 1,
} mxr_asset_fmt_t;

typedef struct {
    uint16_t id;
    uint8_t w;
    uint8_t h;
    uint8_t frames;
    uint8_t format;
    const uint8_t *data;
    size_t data_len;
} mxr_asset_t;

typedef struct {
    int code;
    uint16_t offset;
    uint16_t op;
    char message[96];
} mxr_diag_t;

typedef struct {
    uint16_t *fb;
    const uint8_t *program;
    const mxr_slot_t *slots;
    const mxr_asset_t *assets;
    uint32_t t_ms;
    size_t program_len;
    uint8_t scratch[MXR_SCRATCH_BYTES];
} mxr_ctx_t;

typedef enum {
    MXR_OP_CLEAR = 0x01,
    MXR_OP_FRECT = 0x10,
    MXR_OP_RECT = 0x11,
    MXR_OP_LINE = 0x12,
    MXR_OP_PIXEL = 0x13,
    MXR_OP_GRADV = 0x14,
    MXR_OP_TEXT = 0x20,
    MXR_OP_MARQUEE = 0x21,
    MXR_OP_DIGITS = 0x22,
    MXR_OP_MEASURE = 0x23,
    MXR_OP_BLIT = 0x30,
    MXR_OP_BLITC = 0x31,
    MXR_OP_SPRITE = 0x32,
    MXR_OP_JMP = 0x40,
    MXR_OP_JMPZ = 0x41,
    MXR_OP_JMPCMP = 0x42,
    MXR_OP_JMPSTALE = 0x43,
    MXR_OP_PUSHCLIP = 0x50,
    MXR_OP_POPCLIP = 0x51,
    MXR_OP_PUSHDIM = 0x52,
    MXR_OP_POPDIM = 0x53,
    MXR_OP_BLINK = 0x60,
    MXR_OP_FADE = 0x61,
    MXR_OP_SLIDE = 0x62,
    MXR_OP_NOP = 0xFE,
    MXR_OP_HALT = 0xFF,
} mxr_opcode_t;

typedef struct {
    int x0;
    int y0;
    int x1;
    int y1;
} mxr_rect_t;

typedef struct {
    uint8_t width;
    uint8_t height;
    uint8_t advance;
    uint8_t baseline;
    uint8_t variable_advance;
} mxr_font_info_t;

int mxr_render(mxr_ctx_t *ctx);
int mxr_validate(const uint8_t *program, size_t len, mxr_diag_t *out);
void mxr_measure_text(uint8_t font, const char *s, int *w, int *h);
float mxr_estimate_amps(const uint16_t *fb, size_t n, float cal_idle, float cal_k);
uint32_t mxr_crc32(const void *data, size_t len);
const uint16_t *mxr_gamma12_lut(void);
uint16_t mxr_gamma12(uint8_t value);

extern const mxr_font_info_t mxr_font_infos[4];
extern const uint8_t mxr_font3x5_rows[95][6];
extern const uint8_t mxr_font3x5_advance[95];
extern const uint8_t mxr_font5x7_rows[95][7];
extern const uint8_t mxr_seg7_digits[10];

const mxr_font_info_t *mxr_font_info(uint8_t font);
mxr_rect_t mxr_rect_make(int x, int y, int w, int h);
mxr_rect_t mxr_rect_full(void);
mxr_rect_t mxr_rect_intersect(mxr_rect_t a, mxr_rect_t b);
int mxr_rect_empty(const mxr_rect_t *r);
uint16_t mxr_dim_color(uint16_t color, uint8_t pct);

void mxr_raster_clear(uint16_t *fb, uint16_t color);
void mxr_raster_pixel(uint16_t *fb, const mxr_rect_t *clip, int x, int y, uint16_t color);
void mxr_raster_frect(uint16_t *fb, const mxr_rect_t *clip, int x, int y, int w, int h, uint16_t color);
void mxr_raster_rect(uint16_t *fb, const mxr_rect_t *clip, int x, int y, int w, int h, uint16_t color);
void mxr_raster_line(uint16_t *fb, const mxr_rect_t *clip, int x0, int y0, int x1, int y1, uint16_t color);
void mxr_raster_gradv(uint16_t *fb, const mxr_rect_t *clip, int x, int y, int w, int h, uint16_t c0, uint16_t c1);
void mxr_raster_blit(uint16_t *fb, const mxr_rect_t *clip, int x, int y, const mxr_asset_t *asset, uint8_t frame);
void mxr_raster_blit_tint(uint16_t *fb, const mxr_rect_t *clip, int x, int y, const mxr_asset_t *asset, uint16_t tint, uint8_t frame);

void mxr_text_measure(uint8_t font, const char *s, int *w, int *h);
void mxr_text_draw(uint16_t *fb, const mxr_rect_t *clip, int x, int y, uint8_t font, uint16_t color, const char *s);
void mxr_text_draw_digits(uint16_t *fb, const mxr_rect_t *clip, int x, int y, uint8_t font, uint16_t color, const char *s);
int mxr_text_tabular_advance(uint8_t font);

int mxr_anim_marquee_offset(int text_width, int box_width, uint8_t speed, uint32_t t_ms);
int mxr_anim_blink(uint32_t t_ms, uint16_t rate_ms, uint8_t duty_pct);
uint8_t mxr_anim_fade(uint32_t t_ms, uint8_t from_pct, uint8_t to_pct, uint16_t dur_ms);
void mxr_anim_slide(uint32_t t_ms, uint8_t dir, uint16_t dur_ms, int8_t dx, int8_t dy, int *out_x, int *out_y);

#ifdef __cplusplus
}
#endif

#endif
