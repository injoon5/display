#include "mxr.h"

#include <math.h>
#include <string.h>

/*
 * Procedural, mostly-stateless framebuffer effects driven by ctx->t_ms. Each
 * one fills a rect (x,y,w,h). Because they are time-parameterised they animate
 * both on device (monotonic clock) and in the still-frame preview (render at a
 * few t-ms values to get a filmstrip). Conway's Life is the one stateful effect
 * and re-simulates deterministically from a fixed seed so it stays reproducible.
 */

static uint32_t hash32(uint32_t x) {
    x ^= x >> 16;
    x *= 0x7feb352dU;
    x ^= x >> 15;
    x *= 0x846ca68bU;
    x ^= x >> 16;
    return x;
}

static uint32_t hash2(int a, int b, uint32_t s) {
    return hash32((uint32_t)a * 374761393u + (uint32_t)b * 668265263u + s * 2654435761u);
}

static float frand(uint32_t h) {
    return (float)(h & 0xffffffU) / (float)0xffffff;
}

static int clamp8(int v) {
    if (v < 0) return 0;
    if (v > 255) return 255;
    return v;
}

static uint16_t rgb565(int r, int g, int b) {
    r = clamp8(r);
    g = clamp8(g);
    b = clamp8(b);
    return (uint16_t)(((r >> 3) << 11) | ((g >> 2) << 5) | (b >> 3));
}

/* smooth value noise in [0,1] */
static float vnoise(float x, float y, uint32_t seed) {
    int xi = (int)floorf(x);
    int yi = (int)floorf(y);
    float xf = x - xi;
    float yf = y - yi;
    float u = xf * xf * (3.0f - 2.0f * xf);
    float v = yf * yf * (3.0f - 2.0f * yf);
    float a = frand(hash2(xi, yi, seed));
    float b = frand(hash2(xi + 1, yi, seed));
    float c = frand(hash2(xi, yi + 1, seed));
    float d = frand(hash2(xi + 1, yi + 1, seed));
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

static void px(uint16_t *fb, const mxr_rect_t *clip, int x, int y, uint16_t c) {
    mxr_raster_pixel(fb, clip, x, y, c);
}

/* ---- 0: starfield / warp ---- */
static void fx_starfield(uint16_t *fb, const mxr_rect_t *clip, int ox, int oy, int w, int h, uint32_t t_ms) {
    float cx = ox + w * 0.5f;
    float cy = oy + h * 0.5f;
    float t = t_ms * 0.001f;
    float maxr = (w > h ? w : h) * 0.62f;
    int N = 60;
    for (int i = 0; i < N; ++i) {
        uint32_t hs = hash2(i, 17, 3);
        float ang = (float)(hs & 2047) / 2047.0f * 6.2831853f;
        float sp = 10.0f + (float)((hs >> 11) & 63);
        float ph = (float)((hs >> 17) & 1023) / 1023.0f;
        float r = fmodf(ph * maxr + t * sp, maxr);
        float ca = cosf(ang), sa = sinf(ang);
        int bright = (int)(r / maxr * 255.0f);
        int b2i = (int)(120 + r / maxr * 135.0f);
        int steps = 1 + (int)(r / maxr * 4.0f);
        for (int s = 0; s <= steps; ++s) {
            float rr = r - s * 0.9f;
            if (rr < 0) break;
            int fade = bright - s * 40;
            px(fb, clip, (int)(cx + ca * rr), (int)(cy + sa * rr * 0.85f),
               rgb565(fade, fade, (b2i - s * 40)));
        }
    }
}

/* ---- 1: matrix digital rain ---- */
static void fx_matrix(uint16_t *fb, const mxr_rect_t *clip, int ox, int oy, int w, int h, uint32_t t_ms) {
    float t = t_ms * 0.001f;
    for (int cxp = 0; cxp < w; cxp += 2) {
        uint32_t hc = hash2(cxp, 3, 9);
        float sp = 10.0f + (float)(hc & 31);
        float len = 8.0f + (float)((hc >> 5) & 15);
        float head = fmodf(t * sp + frand(hc) * (h + len), h + len);
        for (int k = 0; k < (int)len; ++k) {
            float yy = head - k;
            if (yy < 0 || yy >= h) continue;
            int y = oy + (int)yy;
            if (k == 0) {
                px(fb, clip, ox + cxp, y, rgb565(200, 255, 210));
            } else {
                int g = (int)(230.0f * (1.0f - k / len));
                /* flicker */
                if ((hash2(cxp, (int)yy, (uint32_t)(t * 8)) & 7) == 0) g += 40;
                px(fb, clip, ox + cxp, y, rgb565(g / 6, g, g / 5));
            }
        }
    }
}

/* ---- 2: fire ---- */
static void fx_fire(uint16_t *fb, const mxr_rect_t *clip, int ox, int oy, int w, int h, uint32_t t_ms) {
    float t = t_ms * 0.001f;
    for (int yy = 0; yy < h; ++yy) {
        float by = (float)(yy) / (float)(h - 1);  /* 0 top .. 1 bottom */
        float base = powf(by, 1.7f);              /* keep the heat low and near the base */
        for (int xx = 0; xx < w; ++xx) {
            float n = vnoise(xx * 0.30f, (h - yy) * 0.30f + t * 4.5f, 5);
            float col = vnoise(xx * 0.5f + 2.0f, t * 1.8f, 8); /* per-column flicker/gaps */
            float heat = base * (0.35f + 1.1f * n) * (0.5f + 0.62f * col);
            int hv = (int)(heat * 205.0f);
            if (hv < 24) continue;                /* dark gaps between the flames */
            int r = hv * 2 + 28;
            int g = (hv - 82) * 2;
            int b = (hv - 180) * 3;
            px(fb, clip, ox + xx, oy + yy, rgb565(r, g, b));
        }
    }
}

/* ---- 3: Conway's Game of Life (stateful, deterministic re-sim) ---- */
static uint8_t life_a[MXR_WIDTH * MXR_HEIGHT];
static uint8_t life_b[MXR_WIDTH * MXR_HEIGHT];
static uint8_t life_age[MXR_WIDTH * MXR_HEIGHT];
static int life_gen = -1;
static int life_w = 0, life_h = 0;

static void life_seed(int w, int h) {
    for (int i = 0; i < w * h; ++i) {
        life_a[i] = (hash2(i, 42, 1) & 3) == 0 ? 1 : 0;
        life_age[i] = life_a[i] ? 1 : 0;
    }
    life_gen = 0;
    life_w = w;
    life_h = h;
}

static void life_step(int w, int h) {
    for (int y = 0; y < h; ++y) {
        for (int x = 0; x < w; ++x) {
            int n = 0;
            for (int dy = -1; dy <= 1; ++dy) {
                for (int dx = -1; dx <= 1; ++dx) {
                    if (!dx && !dy) continue;
                    int nx = (x + dx + w) % w;
                    int ny = (y + dy + h) % h;
                    n += life_a[ny * w + nx];
                }
            }
            int idx = y * w + x;
            int alive = life_a[idx];
            int next = (alive && (n == 2 || n == 3)) || (!alive && n == 3);
            life_b[idx] = (uint8_t)next;
            if (next) {
                life_age[idx] = (uint8_t)(life_age[idx] < 200 ? life_age[idx] + 1 : 200);
            } else {
                life_age[idx] = life_age[idx] > 0 ? (uint8_t)(life_age[idx] - 40 > 0 ? life_age[idx] - 40 : 0) : 0;
            }
        }
    }
    memcpy(life_a, life_b, (size_t)(w * h));
}

static void fx_life(uint16_t *fb, const mxr_rect_t *clip, int ox, int oy, int w, int h, uint16_t color, uint32_t t_ms) {
    int period = 150;
    int gen = (int)(t_ms / (uint32_t)period);
    if (life_gen < 0 || life_w != w || life_h != h || gen < life_gen) {
        life_seed(w, h);
    }
    while (life_gen < gen) {
        life_step(w, h);
        life_gen += 1;
    }
    int cr = (color >> 11) & 0x1f, cg = (color >> 5) & 0x3f, cb = color & 0x1f;
    for (int y = 0; y < h; ++y) {
        for (int x = 0; x < w; ++x) {
            int idx = y * w + x;
            int age = life_age[idx];
            if (life_a[idx]) {
                int bump = age > 6 ? 60 : age * 10;
                px(fb, clip, ox + x, oy + y, rgb565((cr << 3) + bump, (cg << 2) + bump, (cb << 3) + bump));
            } else if (age > 0) {
                px(fb, clip, ox + x, oy + y, rgb565((cr << 3) * age / 400, (cg << 2) * age / 400, (cb << 3) * age / 400));
            }
        }
    }
}

/* ---- 4: flow field (Perlin particle wash) ---- */
static void fx_flow(uint16_t *fb, const mxr_rect_t *clip, int ox, int oy, int w, int h, uint32_t t_ms) {
    float t = t_ms * 0.001f;
    int N = 70;
    int stepms = 55;
    for (int i = 0; i < N; ++i) {
        uint32_t hi = hash2(i, 91, 4);
        int life = 30 + (int)(hi & 45);
        int phase = (int)((t_ms / (uint32_t)stepms + (hi >> 6)) % (uint32_t)life);
        float x = frand(hi) * w;
        float y = frand(hi >> 8) * h;
        float tSlow = t * 0.15f;
        for (int s = 0; s <= phase; ++s) {
            float ang = vnoise(x * 0.09f, y * 0.09f, 4) * 6.2831853f * 2.0f + tSlow;
            x += cosf(ang);
            y += sinf(ang);
            if (x < 0 || x >= w || y < 0 || y >= h) break;
        }
        if (x < 0 || x >= w || y < 0 || y >= h) continue;
        for (int s = 0; s < 4; ++s) {
            int fade = 200 - s * 55;
            int hue = (int)(frand(hi >> 3) * 60);
            px(fb, clip, ox + (int)x, oy + (int)y, rgb565(40 + hue, 90 + fade / 3, fade));
            float ang = vnoise(x * 0.09f, y * 0.09f, 4) * 6.2831853f * 2.0f + tSlow;
            x -= cosf(ang);
            y -= sinf(ang);
        }
    }
}

/* ---- 5: rain ---- */
static void fx_rain(uint16_t *fb, const mxr_rect_t *clip, int ox, int oy, int w, int h, uint16_t color, uint8_t arg, uint32_t t_ms) {
    float t = t_ms * 0.001f;
    int drops = arg ? arg : 40;
    int cr = (color >> 11) & 0x1f, cg = (color >> 5) & 0x3f, cb = color & 0x1f;
    for (int i = 0; i < drops; ++i) {
        uint32_t hi = hash2(i, 5, 7);
        float sp = 24.0f + (float)(hi & 31);
        int len = 3 + (int)((hi >> 5) & 3);
        float x = (float)(hi % (uint32_t)w);
        float slant = 0.35f;
        float y = fmodf(t * sp + frand(hi) * (h + len), (float)(h + len));
        for (int k = 0; k < len; ++k) {
            int yy = (int)y - k;
            int xx = (int)(x + k * slant);
            if (yy < 0 || yy >= h) continue;
            int f = 255 - k * 60;
            px(fb, clip, ox + (xx % w), oy + yy, rgb565((cr << 3) * f / 255, (cg << 2) * f / 255, (cb << 3) * f / 255));
        }
    }
}

/* ---- 6: VU meter (analog needle) ---- */
static void fx_vu(uint16_t *fb, const mxr_rect_t *clip, int ox, int oy, int w, int h, uint32_t t_ms) {
    float t = t_ms * 0.001f;
    int px0 = ox + w / 2;
    int py0 = oy + h - 2;
    int radius = (h < w / 2 ? h : w / 2) - 3;
    /* synthesised audio level 0..1 (device would read a mic slot) */
    float level = 0.5f + 0.28f * sinf(t * 5.3f) + 0.16f * sinf(t * 11.7f + 1.3f) + 0.1f * (frand(hash32((uint32_t)(t * 30))) - 0.5f);
    if (level < 0.02f) level = 0.02f;
    if (level > 1.0f) level = 1.0f;
    /* scale arc from -60deg to +60deg */
    float a0 = -2.6179939f; /* -150 deg (pointing left-down) */
    float a1 = -0.5235988f; /* -30 deg */
    for (int i = 0; i <= 24; ++i) {
        float f = i / 24.0f;
        float a = a0 + (a1 - a0) * f;
        int rr = (i % 6 == 0) ? radius : radius - 2;
        int tx = px0 + (int)(cosf(a) * rr);
        int tyy = py0 + (int)(sinf(a) * rr);
        int red = f > 0.75f;
        px(fb, clip, tx, tyy, red ? rgb565(255, 60, 40) : rgb565(120, 130, 140));
    }
    float a = a0 + (a1 - a0) * level;
    float ca = cosf(a), sa = sinf(a);
    for (int r = 0; r < radius - 1; ++r) {
        int tx = px0 + (int)(ca * r);
        int tyy = py0 + (int)(sa * r);
        int col = level > 0.75f ? 1 : 0;
        px(fb, clip, tx, tyy, col ? rgb565(255, 120, 90) : rgb565(240, 235, 210));
    }
    mxr_raster_frect(fb, clip, px0 - 1, py0 - 1, 3, 3, rgb565(220, 200, 120));
}

/* ---- 7: moon phase ---- */
static void fx_moon(uint16_t *fb, const mxr_rect_t *clip, int ox, int oy, int w, int h, uint8_t arg) {
    float phase = arg / 255.0f;             /* 0 new .. 0.5 full .. 1 new */
    float cx = ox + w * 0.5f;
    float cy = oy + h * 0.5f;
    float R = (w < h ? w : h) * 0.5f - 1.0f;
    float ca = cosf(6.2831853f * phase);
    for (int y = 0; y < h; ++y) {
        float ny = (oy + y - cy) / R;
        if (ny < -1.0f || ny > 1.0f) continue;
        float hw = sqrtf(1.0f - ny * ny);
        for (int x = 0; x < w; ++x) {
            float nx = (ox + x - cx) / R;
            if (nx * nx + ny * ny > 1.0f) continue;
            float term = hw * ca;
            int lit = (phase < 0.5f) ? (nx > term) : (nx < -term);
            /* soft edge near the terminator */
            float d = (phase < 0.5f) ? (nx - term) : (-term - nx);
            if (lit) {
                int glow = (int)(30.0f * (1.0f - (nx * nx + ny * ny)));
                int soft = d < 0.14f ? 40 : 0;
                int cr = 214 + glow - soft, cg = 220 + glow - soft, cb = 190 + glow - soft;
                /* a couple of maria for character */
                float m = vnoise((nx + 1.4f) * 2.2f, (ny + 1.1f) * 2.2f, 11);
                if (m < 0.34f) { cr -= 45; cg -= 42; cb -= 40; }
                px(fb, clip, ox + x, oy + y, rgb565(cr, cg, cb));
            } else {
                px(fb, clip, ox + x, oy + y, rgb565(20, 22, 34));
            }
        }
    }
}

/* ---- 8: github contribution grass ---- */
static void fx_grass(uint16_t *fb, const mxr_rect_t *clip, int ox, int oy, int w, int h, uint16_t color, uint32_t t_ms) {
    int cell = 4;
    int cols = w / cell;
    int rows = h / cell;
    int cr = ((color >> 11) & 0x1f) << 3, cg = ((color >> 5) & 0x3f) << 2, cb = (color & 0x1f) << 3;
    for (int c = 0; c < cols; ++c) {
        for (int r = 0; r < rows; ++r) {
            float n = vnoise(c * 0.55f, r * 0.7f, 21);
            n = n * n;
            /* subtle shimmer of the freshest column */
            int level = (int)(n * 4.0f);
            if (level <= 0) {
                mxr_raster_frect(fb, clip, ox + c * cell, oy + r * cell, cell - 1, cell - 1, rgb565(24, 30, 28));
                continue;
            }
            float f = 0.28f + level * 0.24f;
            int flick = (c == cols - 1 && ((t_ms / 400 + (uint32_t)r) & 1)) ? 30 : 0;
            mxr_raster_frect(fb, clip, ox + c * cell, oy + r * cell, cell - 1, cell - 1,
                             rgb565((int)(cr * f) + flick, (int)(cg * f) + flick, (int)(cb * f)));
        }
    }
}

/* ---- 9: price line graph with gradient fill ---- */
static void fx_graph(uint16_t *fb, const mxr_rect_t *clip, int ox, int oy, int w, int h, uint16_t color, uint8_t arg) {
    int up = arg ? 1 : 0;
    int lr = up ? 60 : 240, lg = up ? 210 : 90, lb = up ? 120 : 80;
    (void)color;
    /* build a plausible series */
    float ys[128];
    int n = w;
    if (n > 128) n = 128;
    float prev = 0.5f;
    for (int i = 0; i < n; ++i) {
        float trend = up ? (i / (float)n) * 0.5f : (1.0f - i / (float)n) * 0.5f;
        float noise = vnoise(i * 0.18f, 0.0f, 31) * 0.5f;
        float v = 0.20f + trend + noise * 0.55f;
        prev = prev * 0.6f + v * 0.4f;
        ys[i] = prev;
    }
    for (int i = 0; i < n; ++i) {
        int gy = oy + h - 2 - (int)(ys[i] * (h - 5));
        if (gy < oy) gy = oy;
        /* gradient fill below the line, fading down */
        for (int y = gy; y < oy + h; ++y) {
            float f = 1.0f - (float)(y - gy) / (float)(oy + h - gy + 1);
            f *= 0.55f;
            px(fb, clip, ox + i, y, rgb565((int)(lr * f * 0.4f), (int)(lg * f), (int)(lb * f)));
        }
    }
    /* solid line on top (2px) */
    for (int i = 0; i < n; ++i) {
        int gy = oy + h - 2 - (int)(ys[i] * (h - 5));
        if (gy < oy) gy = oy;
        px(fb, clip, ox + i, gy, rgb565(lr, lg, lb));
        px(fb, clip, ox + i, gy - 1, rgb565(lr, lg, lb));
    }
}

/* ---- 10: weather icons ---- */
static void disc(uint16_t *fb, const mxr_rect_t *clip, int cx, int cy, int r, uint16_t col) {
    for (int y = -r; y <= r; ++y) {
        for (int x = -r; x <= r; ++x) {
            if (x * x + y * y <= r * r) px(fb, clip, cx + x, cy + y, col);
        }
    }
}

static void draw_cloud(uint16_t *fb, const mxr_rect_t *clip, int cx, int cy, uint16_t col) {
    disc(fb, clip, cx - 4, cy, 3, col);
    disc(fb, clip, cx + 4, cy, 3, col);
    disc(fb, clip, cx, cy - 3, 4, col);
    mxr_raster_frect(fb, clip, cx - 7, cy, 15, 4, col);
}

static void fx_wxicon(uint16_t *fb, const mxr_rect_t *clip, int ox, int oy, int w, int h, uint8_t arg) {
    int cx = ox + w / 2;
    int cy = oy + h / 2;
    uint16_t sun = rgb565(255, 200, 60);
    uint16_t cloud = rgb565(200, 210, 220);
    uint16_t dcloud = rgb565(150, 160, 172);
    uint16_t rain = rgb565(90, 150, 240);
    uint16_t snow = rgb565(220, 235, 255);
    uint16_t bolt = rgb565(255, 220, 70);
    switch (arg) {
        case 0: /* clear sun */
            for (int a = 0; a < 8; ++a) {
                float an = a * 0.7853982f;
                int rx = cx + (int)(cosf(an) * 9), ry = cy + (int)(sinf(an) * 9);
                px(fb, clip, rx, ry, sun);
                px(fb, clip, cx + (int)(cosf(an) * 11), cy + (int)(sinf(an) * 11), sun);
            }
            disc(fb, clip, cx, cy, 5, sun);
            break;
        case 1: /* partly cloudy */
            disc(fb, clip, cx - 4, cy - 4, 4, sun);
            draw_cloud(fb, clip, cx + 2, cy + 3, cloud);
            break;
        case 2: /* cloudy */
            draw_cloud(fb, clip, cx, cy - 1, cloud);
            draw_cloud(fb, clip, cx + 2, cy + 2, dcloud);
            break;
        case 3: /* rain */
            draw_cloud(fb, clip, cx, cy - 3, dcloud);
            for (int i = 0; i < 4; ++i) {
                int dx = cx - 6 + i * 4;
                mxr_raster_frect(fb, clip, dx, cy + 4, 1, 3, rain);
            }
            break;
        case 4: /* snow */
            draw_cloud(fb, clip, cx, cy - 3, cloud);
            for (int i = 0; i < 4; ++i) px(fb, clip, cx - 6 + i * 4, cy + 5, snow);
            break;
        case 5: /* thunder */
            draw_cloud(fb, clip, cx, cy - 3, dcloud);
            mxr_raster_frect(fb, clip, cx - 1, cy + 3, 2, 3, bolt);
            mxr_raster_frect(fb, clip, cx - 3, cy + 6, 2, 3, bolt);
            break;
        case 6: /* fog */
            for (int i = 0; i < 4; ++i) mxr_raster_frect(fb, clip, cx - 8, cy - 4 + i * 3, 16, 1, dcloud);
            break;
        default: /* clear night */
            disc(fb, clip, cx, cy, 5, rgb565(220, 224, 200));
            disc(fb, clip, cx + 3, cy - 2, 5, rgb565(10, 12, 24));
            break;
    }
}

void mxr_fx_render(uint16_t *fb, const mxr_rect_t *clip, uint8_t kind,
                   int x, int y, int w, int h, uint16_t color, uint8_t arg, uint32_t t_ms) {
    if (!fb || !clip || w <= 0 || h <= 0) {
        return;
    }
    switch (kind) {
        case 0: fx_starfield(fb, clip, x, y, w, h, t_ms); break;
        case 1: fx_matrix(fb, clip, x, y, w, h, t_ms); break;
        case 2: fx_fire(fb, clip, x, y, w, h, t_ms); break;
        case 3: fx_life(fb, clip, x, y, w, h, color, t_ms); break;
        case 4: fx_flow(fb, clip, x, y, w, h, t_ms); break;
        case 5: fx_rain(fb, clip, x, y, w, h, color, arg, t_ms); break;
        case 6: fx_vu(fb, clip, x, y, w, h, t_ms); break;
        case 7: fx_moon(fb, clip, x, y, w, h, arg); break;
        case 8: fx_grass(fb, clip, x, y, w, h, color, t_ms); break;
        case 9: fx_graph(fb, clip, x, y, w, h, color, arg); break;
        case 10: fx_wxicon(fb, clip, x, y, w, h, arg); break;
        default: break;
    }
}
