#include "watcher.hpp"
#include <iostream>
#include <string>
#include <vector>
#include <unistd.h>
#include <sys/wait.h>
#include <filesystem>
#include <fstream>
#include <ctime>
#include <cstdlib>
#include <efsw/efsw.hpp>
#include <nlohmann/json.hpp>
#include <cpr/cpr.h>

namespace fs = std::filesystem;
using json = nlohmann::json;

// --- Helper Functions ---

void print_usage() {
    std::cout << "swacn - Interactive terminal recording\n\n";
    std::cout << "Usage:\n";
    std::cout << "  swacn auth login <K> # Verify and save your API key\n";
    std::cout << "  swacn record         # Initialize and start recording (output + fs changes)\n";
    std::cout << "  swacn record --keys  # Start recording and capture keystrokes\n";
    std::cout << "  swacn upload         # Upload the recording\n";
}

fs::path get_credentials_path() {
    const char* home = getenv("HOME");
    if (!home) return "";
    return fs::path(home) / ".config" / "swacn" / "credentials.json";
}

std::string get_api_base_url() {
    const char* env_url = getenv("SWACN_API_URL");
    std::string base_url;
    
    if (env_url) {
        base_url = env_url; // Use local dev server if provided
    } else {
        base_url = "https://api.swacn.io"; // PRODUCTION FALLBACK
    }

    // Clean up trailing slash if the user accidentally adds one
    if (!base_url.empty() && base_url.back() == '/') {
        base_url.pop_back();
    }
    
    return base_url;
}

void login_user(const std::string& api_key) {
    std::string api_endpoint = get_api_base_url() + "/v1/users/me";
    
    std::cout << "[swacn] Verifying credentials with server...\n";
    
    cpr::Response r = cpr::Get(cpr::Url{api_endpoint}, 
                               cpr::Header{{"Authorization", "Bearer " + api_key}});

    if (r.status_code == 200) {
        json user_data = json::parse(r.text);
        
        fs::path cred_path = get_credentials_path();
        fs::create_directories(cred_path.parent_path());

        json config;
        config["api_key"] = api_key;
        config["username"] = user_data["username"];
        config["email"] = user_data["email"];
        
        std::ofstream cred_file(cred_path);
        cred_file << config.dump(4); // Pretty print with 4 spaces
        
        std::cout << "[swacn] Successfully logged in as " << user_data["username"].get<std::string>() << ".\n";
    } else {
        std::cerr << "[swacn] Error: Invalid API key or server unreachable (HTTP " << r.status_code << ").\n";
    }
}

std::string get_api_key() {
    fs::path cred_path = get_credentials_path();
    if (!fs::exists(cred_path)) return "";
    
    try {
        std::ifstream cred_file(cred_path);
        json config;
        cred_file >> config;
        return config.value("api_key", "");
    } catch (...) {
        return ""; // Return empty if JSON is corrupted
    }
}

// --- Command Logic ---

bool prepare_recording_environment() {
    fs::path swacn_dir = ".swacn";
    fs::path config_file = "swacn.json";

    std::cout << "[swacn] Initializing recording environment...\n";

    if (!fs::exists(swacn_dir)) {
        if (!fs::create_directory(swacn_dir)) {
            std::cerr << "[swacn] Error: Could not create " << swacn_dir << " directory.\n";
            return false;
        }
    }

    // Capture baseline tarball
    std::string tar_cmd = "tar -czf .swacn/baseline.tar.gz "
                          "--exclude='.swacn' "
                          "--exclude='.git' "
                          "--exclude='node_modules' "
                          "--exclude='target' " 
                          "--exclude='build' "  
                          ".";
    
    std::cout << "[swacn] Capturing baseline filesystem state...\n";
    int result = std::system(tar_cmd.c_str());

    if (result != 0) {
        std::cerr << "[swacn] Error: Failed to create baseline archive.\n";
        return false;
    }

    // Create Manifest
    json manifest_json;
    manifest_json["version"] = "0.1.0";
    manifest_json["timestamp"] = std::time(nullptr);
    manifest_json["baseline"] = "baseline.tar.gz";
    manifest_json["recording"] = "demo.cast";

    if (fs::exists(config_file)) {
        try {
            std::ifstream config_stream(config_file);
            manifest_json["environment"] = json::parse(config_stream);
        } catch (...) {}
    }

    std::ofstream manifest(".swacn/manifest.json");
    if (manifest.is_open()) {
        manifest << manifest_json.dump(2);
        std::cout << "[swacn] Manifest generated successfully.\n";
    }
    return true;
}

void upload_project() {
    std::string api_key = get_api_key();
    if (api_key.empty()) {
        std::cerr << "[swacn] Error: You are not logged in. Run `swacn auth login <api-key>` first.\n";
        return;
    }

    fs::path manifest_path = ".swacn/manifest.json";
    fs::path baseline_path = ".swacn/baseline.tar.gz";
    fs::path cast_path = ".swacn/demo.cast";

    if (!fs::exists(manifest_path) || !fs::exists(baseline_path) || !fs::exists(cast_path)) {
        std::cerr << "[swacn] Error: Incomplete or missing recording assets in .swacn/\n";
        return;
    }

    std::string api_endpoint = get_api_base_url() + "/v1/casts/upload";

    cpr::Multipart multipart_data{
        {"manifest", cpr::File{manifest_path.string()}},
        {"baseline", cpr::File{baseline_path.string()}},
        {"recording", cpr::File{cast_path.string()}}
    };

    cpr::Header headers{{"Authorization", "Bearer " + api_key}};

    std::cout << "[swacn] Uploading to " << api_endpoint << "...\n";
    cpr::Response r = cpr::Post(cpr::Url{api_endpoint}, multipart_data, headers);

    if (r.status_code >= 200 && r.status_code < 300) {
        std::cout << "[swacn] Upload successful!\n" << "Server response: " << r.text << "\n";
    } else {
        std::cerr << "[swacn] Upload failed with HTTP Status: " << r.status_code << "\n" << r.text << "\n";
    }
}

void launch_asciinema(const std::string& output_file, bool capture_keys) {
    pid_t pid = fork();

    if (pid < 0) {
        std::cerr << "[swacn] Error: Failed to fork process.\n";
        return;
    }

    if (pid == 0) {
        // Child: Run asciinema
        std::vector<const char*> args = {"asciinema", "rec"};
        if (capture_keys) args.push_back("--stdin");
        args.push_back(output_file.c_str());
        args.push_back(nullptr);
        
        execvp(args[0], const_cast<char* const*>(args.data()));
        exit(1); 
    } else {
        // Parent: File watcher
        efsw::FileWatcher fileWatcher;
        SwacnUpdateListener listener(output_file);
        efsw::WatchID watchID = fileWatcher.addWatch(".", &listener, true);
        fileWatcher.watch();

        waitpid(pid, nullptr, 0);
        fileWatcher.removeWatch(watchID);
        std::cout << "[swacn] Recording finished and fs watcher terminated.\n";
    }
}

void list_projects() {
    std::string api_key = get_api_key();
    if (api_key.empty()) {
        std::cerr << "[swacn] Error: You are not logged in. Run `swacn auth login <api-key>` first.\n";
        return;
    }

    std::string api_endpoint = get_api_base_url() + "/v1/casts";
    std::cout << "[swacn] Fetching your recordings...\n";

    cpr::Response r = cpr::Get(cpr::Url{api_endpoint}, 
                               cpr::Header{{"Authorization", "Bearer " + api_key}});

    if (r.status_code == 200) {
        json casts = json::parse(r.text);
        if (casts.empty()) {
            std::cout << "No recordings found. Try running `swacn record` first.\n";
            return;
        }

        std::cout << "\nYour SWACN Recordings:\n";
        std::cout << "--------------------------------------------------\n";
        for (const auto& cast : casts) {
            std::cout << "ID:      " << cast["id"].get<std::string>() << "\n";
            std::cout << "Date:    " << cast["created_at"].get<std::string>() << "\n";
            std::cout << "URL:     " << cast["url"].get<std::string>() << "\n";
            std::cout << "--------------------------------------------------\n";
        }
    } else {
        std::cerr << "[swacn] Error fetching recordings (HTTP " << r.status_code << ").\n";
    }
}

// --- Main Router ---

int main(int argc, char* argv[]) {
    if (argc < 2) {
        print_usage();
        return 1;
    }

    std::string command = argv[1];

    if (command == "auth") {
        if (argc >= 4 && std::string(argv[2]) == "login") {
            login_user(argv[3]);
        } else {
            std::cerr << "Usage: swacn auth login <api_key>\n";
        }
    }
    else if (command == "record") {
        // Auto-initialize project directory and baseline before recording
        if (!prepare_recording_environment()) {
            return 1; // Exit early if setup fails
        }

        bool capture_keys = (argc >= 3 && std::string(argv[2]) == "--keys");
        launch_asciinema(".swacn/demo.cast", capture_keys);
    }
    else if (command == "upload") {
        upload_project();
    }
    else if (command == "list") {
        list_projects();
    }
    else {
        std::cerr << "Unknown command: " << command << "\n";
        print_usage();
        return 1;
    }

    return 0;
}