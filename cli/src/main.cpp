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
    std::cout << "  swacn init           # Snapshot current directory\n";
    std::cout << "  swacn auth login <K> # Save your API key\n";
    std::cout << "  swacn record         # Start recording (output + fs changes)\n";
    std::cout << "  swacn record --keys  # Start recording and capture keystrokes\n";
    std::cout << "  swacn upload         # Upload the recording\n";
}

void save_credentials(const std::string& api_key) {
    fs::path home_dir = getenv("HOME");
    fs::path cred_dir = home_dir / ".config" / "swacn";
    fs::create_directories(cred_dir);

    std::ofstream cred_file(cred_dir / "credentials");
    cred_file << api_key;
    std::cout << "[swacn] Successfully logged in. Credentials saved.\n";
}

std::string get_api_key() {
    char* home = getenv("HOME");
    if (!home) return "";
    fs::path cred_path = fs::path(home) / ".config" / "swacn" / "credentials";
    if (!fs::exists(cred_path)) return "";
    
    std::ifstream cred_file(cred_path);
    std::string key;
    std::getline(cred_file, key);
    return key;
}

// --- Command Logic ---

void initialize_project() {
    fs::path swacn_dir = ".swacn";
    fs::path config_file = "swacn.json";

    std::cout << "[swacn] Initializing project...\n";

    if (!fs::exists(swacn_dir)) {
        if (!fs::create_directory(swacn_dir)) {
            std::cerr << "[swacn] Error: Could not create " << swacn_dir << " directory.\n";
            return;
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
        return;
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

    std::string api_endpoint = "http://localhost:8080/v1/casts/upload";

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

// --- Main Router ---

int main(int argc, char* argv[]) {
    if (argc < 2) {
        print_usage();
        return 1;
    }

    std::string command = argv[1];

    if (command == "init") {
        initialize_project();
    } 
    else if (command == "auth") {
        if (argc >= 4 && std::string(argv[2]) == "login") {
            save_credentials(argv[3]);
        } else {
            std::cerr << "Usage: swacn auth login <api_key>\n";
        }
    }
    else if (command == "record") {
        bool capture_keys = (argc >= 3 && std::string(argv[2]) == "--keys");
        launch_asciinema(".swacn/demo.cast", capture_keys);
    }
    else if (command == "upload") {
        upload_project();
    }
    else {
        std::cerr << "Unknown command: " << command << "\n";
        print_usage();
        return 1;
    }

    return 0;
}