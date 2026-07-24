#include "mxr.h"

#include <string.h>

static uint16_t blend_tint(uint16_t src, uint16_t tint) {
    unsigned sr = (src >> 11) & 0x1F;
    unsigned sg = (src >> 5) & 0x3F;
    unsigned sb = src & 0x1F;
    unsigned tr = (tint >> 11) & 0x1F;
    unsigned tg = (tint >> 5) & 0x3F;
    unsigned tb = tint & 0x1F;
    sr = (sr * tr) / 31u;
    sg = (sg * tg) / 63u;
    sb = (sb * tb) / 31u;
    return (uint16_t)((sr << 11) | (sg << 5) | sb);
}

static uint16_t lerp565(uint16_t a, uint16_t b, int t, int d) {
    if (d <= 0) {
        return b;
    }
    int ar = (a >> 11) & 0x1F;
    int ag = (a >> 5) & 0x3F;
    int ab = a & 0x1F;
    int br = (b >> 11) & 0x1F;
    int bg = (b >> 5) & 0x3F;
    int bb = b & 0x1F;
    int rr = ar + ((br - ar) * t) / d;
    int rg = ag + ((bg - ag) * t) / d;
    int rb = ab + ((bb - ab) * t) / d;
    return (uint16_t)(((rr & 0x1F) << 11) | ((rg & 0x3F) << 5) | (rb & 0x1F));
}

static uint16_t read_u16le(const uint8_t *p) {
    return (uint16_t)(p[0] | ((uint16_t)p[1] << 8));
}

static int mask1_get(const mxr_asset_t *asset, uint8_t frame, int x, int y) {
    size_t pixels_per_frame = (size_t)asset->w * (size_t)asset->h;
    size_t bit_index = (size_t)frame * pixels_per_frame + (size_t)y * asset->w + (size_t)x;
    size_t byte_index = bit_index >> 3;
    if (byte_index >= asset->data_len) {
        return 0;
    }
    return (asset->data[byte_index] >> (7u - (bit_index & 7u))) & 1u;
}

mxr_rect_t mxr_rect_make(int x, int y, int w, int h) {
    mxr_rect_t r;
    r.x0 = x;
    r.y0 = y;
    r.x1 = x + (w < 0 ? 0 : w);
    r.y1 = y + (h < 0 ? 0 : h);
    return r;
}

mxr_rect_t mxr_rect_full(void) {
    return mxr_rect_make(0, 0, MXR_WIDTH, MXR_HEIGHT);
}

mxr_rect_t mxr_rect_intersect(mxr_rect_t a, mxr_rect_t b) {
    mxr_rect_t r;
    r.x0 = a.x0 > b.x0 ? a.x0 : b.x0;
    r.y0 = a.y0 > b.y0 ? a.y0 : b.y0;
    r.x1 = a.x1 < b.x1 ? a.x1 : b.x1;
    r.y1 = a.y1 < b.y1 ? a.y1 : b.y1;
    if (r.x1 < r.x0) {
        r.x1 = r.x0;
    }
    if (r.y1 < r.y0) {
        r.y1 = r.y0;
    }
    return r;
}

int mxr_rect_empty(const mxr_rect_t *r) {
    return !r || r->x0 >= r->x1 || r->y0 >= r->y1;
}

uint16_t mxr_dim_color(uint16_t color, uint8_t pct) {
    unsigned r = (color >> 11) & 0x1F;
    unsigned g = (color >> 5) & 0x3F;
    unsigned b = color & 0x1F;
    if (pct > 100u) {
        pct = 100u;
    }
    r = (r * pct) / 100u;
    g = (g * pct) / 100u;
    b = (b * pct) / 100u;
    return (uint16_t)((r << 11) | (g << 5) | b);
}

void mxr_raster_clear(uint16_t *fb, uint16_t color) {
    size_t i;
    if (!fb) {
        return;
    }
    for (i = 0; i < MXR_FB_PIXELS; ++i) {
        fb[i] = color;
    }
}

void mxr_raster_pixel(uint16_t *fb, const mxr_rect_t *clip, int x, int y, uint16_t color) {
    if (!fb || !clip) {
        return;
    }
    if (x < clip->x0 || x >= clip->x1 || y < clip->y0 || y >= clip->y1) {
        return;
    }
    if (x < 0 || x >= MXR_WIDTH || y < 0 || y >= MXR_HEIGHT) {
        return;
    }
    fb[(size_t)y * MXR_WIDTH + (size_t)x] = color;
}

void mxr_raster_frect(uint16_t *fb, const mxr_rect_t *clip, int x, int y, int w, int h, uint16_t color) {
    int yy;
    mxr_rect_t r;
    if (!fb || !clip || w <= 0 || h <= 0) {
        return;
    }
    r = mxr_rect_intersect(*clip, mxr_rect_make(x, y, w, h));
    if (mxr_rect_empty(&r)) {
        return;
    }
    for (yy = r.y0; yy < r.y1; ++yy) {
        int xx;
        size_t row = (size_t)yy * MXR_WIDTH;
        for (xx = r.x0; xx < r.x1; ++xx) {
            fb[row + (size_t)xx] = color;
        }
    }
}

void mxr_raster_rect(uint16_t *fb, const mxr_rect_t *clip, int x, int y, int w, int h, uint16_t color) {
    if (w <= 0 || h <= 0) {
        return;
    }
    mxr_raster_frect(fb, clip, x, y, w, 1, color);
    mxr_raster_frect(fb, clip, x, y + h - 1, w, 1, color);
    if (h > 2) {
        mxr_raster_frect(fb, clip, x, y + 1, 1, h - 2, color);
        mxr_raster_frect(fb, clip, x + w - 1, y + 1, 1, h - 2, color);
    }
}

void mxr_raster_line(uint16_t *fb, const mxr_rect_t *clip, int x0, int y0, int x1, int y1, uint16_t color) {
    int dx = x1 > x0 ? x1 - x0 : x0 - x1;
    int sx = x0 < x1 ? 1 : -1;
    int dy = y1 > y0 ? y0 - y1 : y1 - y0;
    int sy = y0 < y1 ? 1 : -1;
    int err = dx + dy;
    while (1) {
        mxr_raster_pixel(fb, clip, x0, y0, color);
        if (x0 == x1 && y0 == y1) {
            break;
        }
        int e2 = err << 1;
        if (e2 >= dy) {
            err += dy;
            x0 += sx;
        }
        if (e2 <= dx) {
            err += dx;
            y0 += sy;
        }
    }
}

void mxr_raster_gradv(uint16_t *fb, const mxr_rect_t *clip, int x, int y, int w, int h, uint16_t c0, uint16_t c1) {
    int yy;
    mxr_rect_t r;
    if (!fb || !clip || w <= 0 || h <= 0) {
        return;
    }
    r = mxr_rect_intersect(*clip, mxr_rect_make(x, y, w, h));
    if (mxr_rect_empty(&r)) {
        return;
    }
    for (yy = r.y0; yy < r.y1; ++yy) {
        int xx;
        uint16_t c = lerp565(c0, c1, yy - y, h > 1 ? h - 1 : 1);
        size_t row = (size_t)yy * MXR_WIDTH;
        for (xx = r.x0; xx < r.x1; ++xx) {
            fb[row + (size_t)xx] = c;
        }
    }
}

void mxr_raster_blit(uint16_t *fb, const mxr_rect_t *clip, int x, int y, const mxr_asset_t *asset, uint8_t frame) {
    int yy;
    if (!fb || !clip || !asset || !asset->data || asset->w == 0 || asset->h == 0 || asset->frames == 0) {
        return;
    }
    frame %= asset->frames;
    for (yy = 0; yy < asset->h; ++yy) {
        int xx;
        for (xx = 0; xx < asset->w; ++xx) {
            if (asset->format == MXR_ASSET_MASK1) {
                if (mask1_get(asset, frame, xx, yy)) {
                    mxr_raster_pixel(fb, clip, x + xx, y + yy, 0xFFFFu);
                }
            } else {
                size_t px_index = ((size_t)frame * asset->w * asset->h) + (size_t)yy * asset->w + (size_t)xx;
                size_t byte_index = px_index * 2u;
                if (byte_index + 1u < asset->data_len) {
                    uint16_t c = read_u16le(asset->data + byte_index);
                    mxr_raster_pixel(fb, clip, x + xx, y + yy, c);
                }
            }
        }
    }
}

void mxr_raster_blit_tint(uint16_t *fb, const mxr_rect_t *clip, int x, int y, const mxr_asset_t *asset, uint16_t tint, uint8_t frame) {
    int yy;
    if (!fb || !clip || !asset || !asset->data || asset->w == 0 || asset->h == 0 || asset->frames == 0) {
        return;
    }
    frame %= asset->frames;
    for (yy = 0; yy < asset->h; ++yy) {
        int xx;
        for (xx = 0; xx < asset->w; ++xx) {
            if (asset->format == MXR_ASSET_MASK1) {
                if (mask1_get(asset, frame, xx, yy)) {
                    mxr_raster_pixel(fb, clip, x + xx, y + yy, tint);
                }
            } else {
                size_t px_index = ((size_t)frame * asset->w * asset->h) + (size_t)yy * asset->w + (size_t)xx;
                size_t byte_index = px_index * 2u;
                if (byte_index + 1u < asset->data_len) {
                    uint16_t c = read_u16le(asset->data + byte_index);
                    mxr_raster_pixel(fb, clip, x + xx, y + yy, blend_tint(c, tint));
                }
            }
        }
    }
}
