cmake_minimum_required(VERSION 3.14) # FetchContent requires 3.14+
project(swacn VERSION 1.0)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED True)

# 1. Include the FetchContent module
include(FetchContent)

# 2. Tell CMake where to download efsw from
message(STATUS "[swacn] Fetching efsw (Entropia File System Watcher)...")
FetchContent_Declare(
    efsw
    GIT_REPOSITORY https://github.com/SpartanJ/efsw.git
    GIT_TAG        1.5.1 # Pinning to a stable release
)

# 3. Make the library available to our build
FetchContent_MakeAvailable(efsw)

# Add your source files
set(SOURCES
    src/main.cpp
    src/watcher.cpp
)

add_executable(swacn ${SOURCES})

# 4. Link the efsw library to our swacn executable
target_link_libraries(swacn PRIVATE efsw)