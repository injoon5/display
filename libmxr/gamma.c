#include "mxr.h"

#include <math.h>

const uint16_t *mxr_gamma12_lut(void) {
    static uint16_t lut[256];
    static int ready = 0;
    int i;
    if (!ready) {
        for (i = 0; i < 256; ++i) {
            double n = (double)i / 255.0;
            double g = pow(n, 2.2) * 4095.0 + 0.5;
            if (g < 0.0) {
                g = 0.0;
            }
            if (g > 4095.0) {
                g = 4095.0;
            }
            lut[i] = (uint16_t)g;
        }
        ready = 1;
    }
    return lut;
}

uint16_t mxr_gamma12(uint8_t value) {
    return mxr_gamma12_lut()[value];
}
