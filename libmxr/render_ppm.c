#include "mxr.h"

#include <ctype.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define MAX_SLOTS 64
#define MAX_SLOT_STR 256

typedef struct {
    mxr_slot_t slots[MAX_SLOTS];
    char strings[MAX_SLOTS][MAX_SLOT_STR];
    uint8_t count;
} slot_table_t;

static void wr_ppm(const char *path, const uint16_t *fb) {
    FILE *fp = fopen(path, "wb");
    if (!fp) {
        perror(path);
        exit(1);
    }

    fprintf(fp, "P6\n%d %d\n255\n", MXR_WIDTH, MXR_HEIGHT);
    for (int y = 0; y < MXR_HEIGHT; ++y) {
        for (int x = 0; x < MXR_WIDTH; ++x) {
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

static char *trim(char *s) {
    while (*s && isspace((unsigned char)*s)) {
        s += 1;
    }
    char *end = s + strlen(s);
    while (end > s && isspace((unsigned char)end[-1])) {
        *--end = '\0';
    }
    return s;
}

static int load_slots(const char *path, slot_table_t *table) {
    FILE *fp = fopen(path, "r");
    char line[512];
    if (!fp) {
        perror(path);
        return -1;
    }

    memset(table, 0, sizeof(*table));
    for (int i = 0; i < MAX_SLOTS; ++i) {
        table->slots[i].kind = MXR_SLOT_NULL;
    }

    while (fgets(line, sizeof(line), fp)) {
        char *p = trim(line);
        unsigned index;
        char kind[16];
        unsigned long updated_ms;
        char *value;

        if (p[0] == '\0' || p[0] == '#') {
            continue;
        }

        if (sscanf(p, "%u %15s %lu", &index, kind, &updated_ms) < 3) {
            fprintf(stderr, "bad slots line: %s\n", p);
            fclose(fp);
            return -1;
        }
        if (index >= MAX_SLOTS) {
            fprintf(stderr, "slot index out of range: %u\n", index);
            fclose(fp);
            return -1;
        }

        value = p;
        /* skip index */
        while (*value && !isspace((unsigned char)*value)) {
            value += 1;
        }
        while (*value && isspace((unsigned char)*value)) {
            value += 1;
        }
        /* skip kind */
        while (*value && !isspace((unsigned char)*value)) {
            value += 1;
        }
        while (*value && isspace((unsigned char)*value)) {
            value += 1;
        }
        /* skip updated_ms */
        while (*value && !isspace((unsigned char)*value)) {
            value += 1;
        }
        while (*value && isspace((unsigned char)*value)) {
            value += 1;
        }

        table->slots[index].updated_ms = (uint32_t)updated_ms;
        if (strcmp(kind, "null") == 0) {
            table->slots[index].kind = MXR_SLOT_NULL;
        } else if (strcmp(kind, "int") == 0) {
            table->slots[index].kind = MXR_SLOT_INT;
            table->slots[index].as.i = (int32_t)strtol(value, NULL, 10);
        } else if (strcmp(kind, "float") == 0) {
            table->slots[index].kind = MXR_SLOT_FLOAT;
            table->slots[index].as.f = strtof(value, NULL);
        } else if (strcmp(kind, "bool") == 0) {
            table->slots[index].kind = MXR_SLOT_BOOL;
            table->slots[index].as.b = (uint8_t)(strcmp(value, "1") == 0 || strcmp(value, "true") == 0);
        } else if (strcmp(kind, "color") == 0) {
            table->slots[index].kind = MXR_SLOT_COLOR;
            table->slots[index].as.color = (uint16_t)strtoul(value, NULL, 0);
        } else if (strcmp(kind, "str") == 0) {
            table->slots[index].kind = MXR_SLOT_STR;
            snprintf(table->strings[index], MAX_SLOT_STR, "%s", value);
            table->slots[index].as.s = table->strings[index];
        } else {
            fprintf(stderr, "unknown slot kind: %s\n", kind);
            fclose(fp);
            return -1;
        }

        if (index + 1 > table->count) {
            table->count = (uint8_t)(index + 1);
        }
    }

    fclose(fp);
    return 0;
}

static void usage(const char *argv0) {
    fprintf(stderr, "usage: %s <file.mxr> [out.ppm] [--slots slots.txt] [--t-ms N]\n", argv0);
}

int main(int argc, char **argv) {
    const char *mxr_path = NULL;
    const char *out_path = "frame.ppm";
    const char *slots_path = NULL;
    uint32_t t_ms = 0;
    FILE *fp;
    long size;
    uint8_t *buf;
    uint16_t fb[MXR_FB_PIXELS];
    mxr_diag_t diag;
    mxr_ctx_t ctx;
    slot_table_t table;
    int rc;

    for (int i = 1; i < argc; ++i) {
        if (strcmp(argv[i], "--slots") == 0) {
            if (i + 1 >= argc) {
                usage(argv[0]);
                return 2;
            }
            slots_path = argv[++i];
        } else if (strcmp(argv[i], "--t-ms") == 0) {
            if (i + 1 >= argc) {
                usage(argv[0]);
                return 2;
            }
            t_ms = (uint32_t)strtoul(argv[++i], NULL, 10);
        } else if (argv[i][0] == '-') {
            usage(argv[0]);
            return 2;
        } else if (!mxr_path) {
            mxr_path = argv[i];
        } else {
            out_path = argv[i];
        }
    }

    if (!mxr_path) {
        usage(argv[0]);
        return 2;
    }

    memset(&table, 0, sizeof(table));
    if (slots_path) {
        if (load_slots(slots_path, &table) != 0) {
            return 1;
        }
    }

    fp = fopen(mxr_path, "rb");
    if (!fp) {
        perror(mxr_path);
        return 1;
    }
    if (fseek(fp, 0, SEEK_END) != 0) {
        perror("fseek");
        fclose(fp);
        return 1;
    }
    size = ftell(fp);
    if (size < 0) {
        perror("ftell");
        fclose(fp);
        return 1;
    }
    rewind(fp);
    buf = (uint8_t *)malloc((size_t)size);
    if (!buf) {
        fprintf(stderr, "oom\n");
        fclose(fp);
        return 1;
    }
    if (fread(buf, 1, (size_t)size, fp) != (size_t)size) {
        fprintf(stderr, "short read\n");
        free(buf);
        fclose(fp);
        return 1;
    }
    fclose(fp);

    rc = mxr_validate(buf, (size_t)size, &diag);
    if (rc != 0) {
        fprintf(stderr, "validate failed (%d) at %u: %s\n", rc, diag.offset, diag.message);
        free(buf);
        return 1;
    }

    memset(fb, 0, sizeof(fb));
    memset(&ctx, 0, sizeof(ctx));
    ctx.fb = fb;
    ctx.program = buf;
    ctx.program_len = (size_t)size;
    ctx.t_ms = t_ms;
    if (table.count > 0) {
        ctx.slots = table.slots;
    }

    if (mxr_render(&ctx) != 0) {
        fprintf(stderr, "render failed\n");
        free(buf);
        return 1;
    }

    wr_ppm(out_path, fb);
    printf("ok %s -> %s (%.3f A)\n", mxr_path, out_path, mxr_estimate_amps(fb, MXR_FB_PIXELS, 0.10f, 0.0000040f));
    free(buf);
    return 0;
}
