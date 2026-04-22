cmake_minimum_required(VERSION 3.14)
project(swacn_server CXX)

set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Find Drogon (assuming installed via system package manager or vcpkg)
find_package(Drogon CONFIG REQUIRED)

set(SRC
    src/main.cpp
    src/controllers/AuthController.cpp
    src/controllers/CastController.cpp
    src/controllers/ProxyController.cpp
)

add_executable(${PROJECT_NAME} ${SRC})
target_link_libraries(${PROJECT_NAME} PRIVATE Drogon::Drogon)