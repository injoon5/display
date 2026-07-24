#include "mxr.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

/* Validates an MXR1 bytecode file produced by @matrix-panel/compiler. */
int main(int argc, char **argv) {
    FILE *fp;
    long size;
    uint8_t *buf;
    mxr_diag_t diag;
    uint16_t fb[MXR_FB_PIXELS];
    mxr_ctx_t ctx;
    int rc;

    if (argc != 2) {
        fprintf(stderr, "usage: %s <file.mxr>\n", argv[0]);
        return 2;
    }

    fp = fopen(argv[1], "rb");
    if (!fp) {
        perror(argv[1]);
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
    ctx.t_ms = 0;
    if (mxr_render(&ctx) != 0) {
        fprintf(stderr, "render failed\n");
        free(buf);
        return 1;
    }

    printf("ok %s (%ld bytes)\n", argv[1], size);
    free(buf);
    return 0;
}
