#pragma once

#include <efsw/efsw.hpp>
#include <string>
#include <chrono>
#include <unordered_map>
#include <mutex>

class SwacnUpdateListener : public efsw::FileWatchListener {
private:
    std::string cast_file_path;
    std::chrono::time_point<std::chrono::steady_clock> start_time;
    
    // Debouncing state
    std::unordered_map<std::string, std::chrono::time_point<std::chrono::steady_clock>> last_processed;
    std::mutex state_mutex;

    double get_current_timestamp();
    std::string read_file_base64(const std::string& path);

public:
    SwacnUpdateListener(const std::string& cast_file);

    void handleFileAction(efsw::WatchID watchid, const std::string& dir, 
                          const std::string& filename, efsw::Action action, 
                          std::string oldFilename) override;
};