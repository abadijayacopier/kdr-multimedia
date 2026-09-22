cmake_minimum_required(VERSION 3.28)

project(kdr-camera VERSION 1.0.0 LANGUAGES C CXX)

find_package(libobs REQUIRED)

add_library(kdr-camera MODULE
    src/plugin-main.cpp
    src/kdr-camera-source.cpp
)

target_compile_features(kdr-camera PRIVATE cxx_std_17)
target_link_libraries(kdr-camera PRIVATE OBS::libobs)

set_target_properties(kdr-camera PROPERTIES
    PREFIX ""
    OUTPUT_NAME "kdr-camera"
)

install(TARGETS kdr-camera
    LIBRARY DESTINATION obs-plugins/64bit
    RUNTIME DESTINATION obs-plugins/64bit
)

install(DIRECTORY data/
    DESTINATION data/obs-plugins/kdr-camera
)
