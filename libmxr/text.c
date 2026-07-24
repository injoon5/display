#include "mxr.h"

#include <string.h>

static unsigned char_index(char c) {
    unsigned uc = (unsigned char)c;
    if (uc < 32u || uc > 126u) {
        return (unsigned)'?';
    }
    return uc;
}

const mxr_font_info_t *mxr_font_info(uint8_t font) {
    if (font > 3u) {
        font = 1u;
    }
    return &mxr_font_infos[font];
}

static int seg7_advance_for(char c) {
    if (c == ':' || c == ' ') {
        return 6;
    }
    if (c == '-') {
        return 8;
    }
    return 12;
}

int mxr_text_tabular_advance(uint8_t font) {
    switch (font) {
        case 0: return 4;
        case 1: return 6;
        case 2: return 12;
        case 3: return 12;
        default: return 6;
    }
}

static void draw_rows(uint16_t *fb, const mxr_rect_t *clip, int x, int y, const uint8_t *rows, int width, int height, uint16_t color) {
    int yy;
    for (yy = 0; yy < height; ++yy) {
        int xx;
        uint8_t row = rows[yy];
        for (xx = 0; xx < width; ++xx) {
            if (row & (uint8_t)(1u << (width - 1 - xx))) {
                mxr_raster_pixel(fb, clip, x + xx, y + yy, color);
            }
        }
    }
}

/*
 * The large font is a clean integer 2x scale of the 5x7 bitmap: every source
 * pixel becomes a 2x2 block, so strokes are a constant 2px everywhere (no
 * uneven 1px/2px stems like a fractional upscale would produce). Result is a
 * 10x14 glyph on a 12px advance.
 */
static void draw_scaled_5x7(uint16_t *fb, const mxr_rect_t *clip, int x, int y, char c, uint16_t color) {
    unsigned idx = char_index(c) - 32u;
    int sy;
    for (sy = 0; sy < 7; ++sy) {
        uint8_t row = mxr_font5x7_rows[idx][sy];
        int sx;
        for (sx = 0; sx < 5; ++sx) {
            if (row & (uint8_t)(1u << (4 - sx))) {
                int px = x + sx * 2;
                int py = y + sy * 2;
                mxr_raster_pixel(fb, clip, px, py, color);
                mxr_raster_pixel(fb, clip, px + 1, py, color);
                mxr_raster_pixel(fb, clip, px, py + 1, color);
                mxr_raster_pixel(fb, clip, px + 1, py + 1, color);
            }
        }
    }
}

static void draw_seg7(uint16_t *fb, const mxr_rect_t *clip, int x, int y, char c, uint16_t color) {
    uint8_t mask = 0;
    if (c >= '0' && c <= '9') {
        mask = mxr_seg7_digits[(unsigned)(c - '0')];
    } else if (c == '-') {
        mask = 0x40u;
    } else if (c == ':') {
        mxr_raster_frect(fb, clip, x + 2, y + 5, 2, 2, color);
        mxr_raster_frect(fb, clip, x + 2, y + 13, 2, 2, color);
        return;
    } else {
        draw_scaled_5x7(fb, clip, x + 1, y + 2, c, color);
        return;
    }

    if (mask & 0x01u) mxr_raster_frect(fb, clip, x + 2, y + 0, 6, 2, color);
    if (mask & 0x02u) mxr_raster_frect(fb, clip, x + 8, y + 2, 2, 6, color);
    if (mask & 0x04u) mxr_raster_frect(fb, clip, x + 8, y + 10, 2, 6, color);
    if (mask & 0x08u) mxr_raster_frect(fb, clip, x + 2, y + 16, 6, 2, color);
    if (mask & 0x10u) mxr_raster_frect(fb, clip, x + 0, y + 10, 2, 6, color);
    if (mask & 0x20u) mxr_raster_frect(fb, clip, x + 0, y + 2, 2, 6, color);
    if (mask & 0x40u) mxr_raster_frect(fb, clip, x + 2, y + 8, 6, 2, color);
}

static int char_advance(uint8_t font, char c) {
    unsigned idx;
    switch (font) {
        case 0:
            idx = char_index(c) - 32u;
            return mxr_font3x5_advance[idx];
        case 1:
            return 6;
        case 2:
            return 12;
        case 3:
            return seg7_advance_for(c);
        default:
            return 6;
    }
}

static void draw_char(uint16_t *fb, const mxr_rect_t *clip, int x, int y, uint8_t font, char c, uint16_t color) {
    unsigned idx = char_index(c) - 32u;
    switch (font) {
        case 0:
            draw_rows(fb, clip, x, y, mxr_font3x5_rows[idx], 3, 6, color);
            break;
        case 1:
            draw_rows(fb, clip, x, y, mxr_font5x7_rows[idx], 5, 7, color);
            break;
        case 2:
            draw_scaled_5x7(fb, clip, x, y, c, color);
            break;
        case 3:
            draw_seg7(fb, clip, x, y, c, color);
            break;
        default:
            draw_rows(fb, clip, x, y, mxr_font5x7_rows[idx], 5, 7, color);
            break;
    }
}

void mxr_text_measure(uint8_t font, const char *s, int *w, int *h) {
    int width = 0;
    int height = 0;
    if (!s) {
        s = "";
    }
    while (*s) {
        width += char_advance(font, *s);
        ++s;
    }
    height = (int)mxr_font_info(font)->height;
    if (w) {
        *w = width;
    }
    if (h) {
        *h = height;
    }
}

void mxr_measure_text(uint8_t font, const char *s, int *w, int *h) {
    mxr_text_measure(font, s, w, h);
}

void mxr_text_draw(uint16_t *fb, const mxr_rect_t *clip, int x, int y, uint8_t font, uint16_t color, const char *s) {
    int pen_x = x;
    if (!fb || !clip || !s) {
        return;
    }
    while (*s) {
        draw_char(fb, clip, pen_x, y, font, *s, color);
        pen_x += char_advance(font, *s);
        ++s;
    }
}

void mxr_text_draw_digits(uint16_t *fb, const mxr_rect_t *clip, int x, int y, uint8_t font, uint16_t color, const char *s) {
    int pen_x = x;
    int cell = mxr_text_tabular_advance(font);
    if (!fb || !clip || !s) {
        return;
    }
    while (*s) {
        char c = *s;
        if ((c >= '0' && c <= '9') || c == '-') {
            draw_char(fb, clip, pen_x, y, font, c, color);
            pen_x += cell;
        } else {
            draw_char(fb, clip, pen_x, y, font, c, color);
            pen_x += char_advance(font, c);
        }
        ++s;
    }
}
