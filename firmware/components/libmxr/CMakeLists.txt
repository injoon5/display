set(LIBMXR_ROOT "${CMAKE_CURRENT_LIST_DIR}/../../../libmxr")

if(NOT EXISTS "${LIBMXR_ROOT}/mxr.h")
    message(FATAL_ERROR "libmxr was not found at ${LIBMXR_ROOT}")
endif()

set(LIBMXR_SOURCES
    "${LIBMXR_ROOT}/vm.c"
    "${LIBMXR_ROOT}/raster.c"
    "${LIBMXR_ROOT}/text.c"
    "${LIBMXR_ROOT}/fonts.c"
    "${LIBMXR_ROOT}/anim.c"
    "${LIBMXR_ROOT}/gamma.c"
    "${LIBMXR_ROOT}/effects.c"
)

idf_component_register(
    SRCS ${LIBMXR_SOURCES}
    INCLUDE_DIRS "${LIBMXR_ROOT}"
)
