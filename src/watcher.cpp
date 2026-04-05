#include "watcher.hpp"
#include <iostream>
#include <fstream>
#include <filesystem>
#include <vector>

namespace fs = std::filesystem;

// --- Production Base64 Encoder ---
static const std::string base64_chars = 
             "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
             "abcdefghijklmnopqrstuvwxyz"
             "0123456789+/";

std::string base64_encode(const std::vector<unsigned char>& buf) {
    std::string ret;
    int i = 0, j = 0;
    unsigned char char_array_3[3], char_array_4[4];
    for (unsigned char c : buf) {
        char_array_3[i++] = c;
        if (i == 3) {
            char_array_4[0] = (char_array_3[0] & 0xfc) >> 2;
            char_array_4[1] = ((char_array_3[0] & 0x03) << 4) + ((char_array_3[1] & 0xf0) >> 4);
            char_array_4[2] = ((char_array_3[1] & 0x0f) << 2) + ((char_array_3[2] & 0xc0) >> 6);
            char_array_4[3] = char_array_3[2] & 0x3f;
            for(i = 0; (i <4) ; i++) ret += base64_chars[char_array_4[i]];
            i = 0;
        }
    }
    if (i) {
        for(j = i; j < 3; j++) char_array_3[j] = '\0';
        char_array_4[0] = (char_array_3[0] & 0xfc) >> 2;
        char_array_4[1] = ((char_array_3[0] & 0x03) << 4) + ((char_array_3[1] & 0xf0) >> 4);
        char_array_4[2] = ((char_array_3[1] & 0x0f) << 2) + ((char_array_3[2] & 0xc0) >> 6);
        char_array_4[3] = char_array_3[2] & 0x3f;
        for (j = 0; (j < i + 1); j++) ret += base64_chars[char_array_4[j]];
        while((i++ < 3)) ret += '=';
    }
    return ret;
}

// --- Class Implementation ---

SwacnUpdateListener::SwacnUpdateListener(const std::string& cast_file) : cast_file_path(cast_file) {
    start_time = std::chrono::steady_clock::now();
}

double SwacnUpdateListener::get_current_timestamp() {
    auto now = std::chrono::steady_clock::now();
    std::chrono::duration<double> diff = now - start_time;
    return diff.count();
}

std::string SwacnUpdateListener::read_file_base64(const std::string& path) {
    std::ifstream file(path, std::ios::binary);
    if (!file) return "";
    std::vector<unsigned char> buffer(std::istreambuf_iterator<char>(file), {});
    return base64_encode(buffer);
}

void SwacnUpdateListener::handleFileAction(efsw::WatchID watchid, const std::string& dir, 
                                           const std::string& filename, efsw::Action action, 
                                           std::string oldFilename) {
    
    std::string full_path = fs::path(dir) / filename;
    std::string rel_path = fs::relative(full_path, fs::current_path()).string();

    if (rel_path.find(".swacn") == 0 || rel_path.find(".git") == 0) {
        return; 
    }

    auto now = std::chrono::steady_clock::now();

    {
        std::lock_guard<std::mutex> lock(state_mutex);
        if (last_processed.find(rel_path) != last_processed.end()) {
            auto time_since_last = std::chrono::duration_cast<std::chrono::milliseconds>(now - last_processed[rel_path]);
            if (time_since_last.count() < 150) { 
                return; 
            }
        }
        last_processed[rel_path] = now;
    }

    std::string action_str;
    std::string b64_content = "";

    switch (action) {
        case efsw::Actions::Add:
            action_str = "create";
            b64_content = read_file_base64(full_path);
            break;
        case efsw::Actions::Modified:
            action_str = "modify";
            b64_content = read_file_base64(full_path);
            break;
        case efsw::Actions::Delete:
            action_str = "delete";
            break;
        case efsw::Actions::Moved:
            action_str = "move"; 
            return; 
        default:
            return;
    }

    double timestamp = get_current_timestamp();
    
    std::string event_json = "[" + std::to_string(timestamp) + ", \"fs\", {"
                             "\"action\": \"" + action_str + "\", "
                             "\"path\": \"" + rel_path + "\", "
                             "\"content\": \"" + b64_content + "\"}]\n";

    std::ofstream cast_file(cast_file_path, std::ios::app | std::ios::binary);
    if (cast_file.is_open()) {
        cast_file << event_json;
    }
}