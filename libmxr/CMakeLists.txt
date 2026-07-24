cmake_minimum_required(VERSION 3.16)

set(MXR_SOURCES
    vm.c
    raster.c
    text.c
    fonts.c
    anim.c
    gamma.c
    effects.c
)

if(COMMAND idf_component_register)
    idf_component_register(
        SRCS ${MXR_SOURCES}
        INCLUDE_DIRS "."
    )
else()
    project(libmxr LANGUAGES C)
    add_library(mxr STATIC ${MXR_SOURCES})
    target_include_directories(mxr PUBLIC ${CMAKE_CURRENT_LIST_DIR})
    set_target_properties(mxr PROPERTIES C_STANDARD 99 C_STANDARD_REQUIRED YES)
    if(NOT MSVC)
        target_link_libraries(mxr PUBLIC m)
    endif()
endif()
