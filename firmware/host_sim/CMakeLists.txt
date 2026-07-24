cmake_minimum_required(VERSION 3.16)

project(mx_host_sim LANGUAGES C)

set(CMAKE_C_STANDARD 11)
set(CMAKE_C_STANDARD_REQUIRED ON)

add_subdirectory("${CMAKE_CURRENT_LIST_DIR}/../../libmxr" "${CMAKE_CURRENT_BINARY_DIR}/libmxr")

add_executable(mx_host_sim main.c)
target_include_directories(mx_host_sim PRIVATE "${CMAKE_CURRENT_LIST_DIR}/../../libmxr")
target_link_libraries(mx_host_sim PRIVATE mxr)
