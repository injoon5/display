CC ?= gcc
CFLAGS ?= -std=c99 -Wall -Wextra -Wpedantic -O2
LDFLAGS ?= -lm

LIBMXR_SRCS := vm.c raster.c text.c fonts.c anim.c gamma.c
NATIVE_BIN := test_native
VALIDATE_BIN := validate_file
WASM_DIR := build

.PHONY: native run-native validate wasm clean

native: $(NATIVE_BIN) $(VALIDATE_BIN)

$(NATIVE_BIN): $(LIBMXR_SRCS) test_native.c mxr.h
	$(CC) $(CFLAGS) -I. -o $@ $(LIBMXR_SRCS) test_native.c $(LDFLAGS)

$(VALIDATE_BIN): $(LIBMXR_SRCS) validate_file.c mxr.h
	$(CC) $(CFLAGS) -I. -o $@ $(LIBMXR_SRCS) validate_file.c $(LDFLAGS)

run-native: native
	./$(NATIVE_BIN)

validate: $(VALIDATE_BIN)
	@test -n "$(FILE)" || (echo "usage: make -C libmxr validate FILE=path.mxr" && exit 2)
	./$(VALIDATE_BIN) "$(FILE)"

wasm:
	@if command -v emcc >/dev/null 2>&1; then \
		mkdir -p $(WASM_DIR); \
		emcc $(LIBMXR_SRCS) -I. -O3 \
			-sEXPORTED_FUNCTIONS='["_mxr_render","_mxr_validate","_mxr_measure_text","_mxr_estimate_amps","_malloc","_free"]' \
			-sEXPORTED_RUNTIME_METHODS='["ccall","cwrap","HEAPU8","HEAPU16"]' \
			-sMODULARIZE -sENVIRONMENT=web \
			-o $(WASM_DIR)/mxr.js; \
		echo "WASM written to $(WASM_DIR)/mxr.js"; \
	else \
		echo "emcc not found; install Emscripten to build build/mxr.js"; \
	fi

clean:
	rm -rf $(NATIVE_BIN) $(VALIDATE_BIN) $(WASM_DIR) test_native.ppm
