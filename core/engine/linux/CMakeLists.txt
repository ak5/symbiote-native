cmake_minimum_required(VERSION 3.20)
project(symbiote_engine LANGUAGES CXX)

# Compile the same engine sources as CocoaPods and Android, with only registration platform-specific.
file(GLOB SYMBIOTE_SHARED_SOURCES CONFIGURE_DEPENDS "${CMAKE_CURRENT_SOURCE_DIR}/../cpp/*.cpp")
add_library(symbiote_engine STATIC ${SYMBIOTE_SHARED_SOURCES} SymbioteEngineModule.cpp)
target_compile_features(symbiote_engine PUBLIC cxx_std_20)
set_target_properties(symbiote_engine PROPERTIES POSITION_INDEPENDENT_CODE ON)
target_include_directories(symbiote_engine PUBLIC "${CMAKE_CURRENT_SOURCE_DIR}" "${CMAKE_CURRENT_SOURCE_DIR}/../cpp")
target_link_libraries(symbiote_engine PUBLIC jsi reactnative react_codegen_SymbioteEngineSpec)
