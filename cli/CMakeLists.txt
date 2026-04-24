cmake_minimum_required(VERSION 3.14) # FetchContent requires 3.14+
project(swacn VERSION 1.0)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED True)

# 1. Include the FetchContent module
include(FetchContent)



message(STATUS "[swacn] Fetching nlohmann/json...")
FetchContent_Declare(
    json
    GIT_REPOSITORY https://github.com/nlohmann/json.git
    GIT_TAG        v3.11.3
)
FetchContent_MakeAvailable(json)

message(STATUS "[swacn] Fetching cpr (C++ Requests)...")
FetchContent_Declare(
    cpr
    GIT_REPOSITORY https://github.com/libcpr/cpr.git
    GIT_TAG        1.10.5 # Stable release
)
FetchContent_MakeAvailable(cpr)

# Add your source files
set(SOURCES
    src/main.cpp
)

add_executable(swacn ${SOURCES})

# 4. Link libraries to our swacn executable
target_link_libraries(swacn PRIVATE nlohmann_json::nlohmann_json cpr::cpr)