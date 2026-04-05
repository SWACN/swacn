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

void print_usage() {
    std::cout << "swacn - Interactive terminal recording\n\n";
    std::cout << "Usage:\n";
    std::cout << "  swacn init           # Snapshot current directory\n";
    std::cout << "  swacn record         # Start recording (output + fs changes)\n";
    std::cout << "  swacn record --keys  # Start recording and capture keystrokes\n";
    std::cout << "  swacn upload         # Upload the recording\n";
}

void initialize_project() {
    fs::path swacn_dir = ".swacn";
    fs::path config_file = "swacn.json";

    std::cout << "[swacn] Initializing project...\n";

    // 1. Create the hidden .swacn state directory
    if (!fs::exists(swacn_dir)) {
        if (fs::create_directory(swacn_dir)) {
            std::cout << "[swacn] Created " << swacn_dir << " directory.\n";
        } else {
            std::cerr << "[swacn] Error: Could not create " << swacn_dir << " directory.\n";
            return;
        }
    } else {
        std::cout << "[swacn] Directory " << swacn_dir << " already exists. Overwriting baseline...\n";
    }

    // 2. Create the baseline tarball
    // We explicitly exclude .swacn, .git, and common heavy build/dependency directories
    // to keep the WebVM payload as light as possible.
    std::string tar_cmd = "tar -czf .swacn/baseline.tar.gz "
                          "--exclude='.swacn' "
                          "--exclude='.git' "
                          "--exclude='node_modules' "
                          "--exclude='target' " // Rust
                          "--exclude='build' "  // C/C++ CMake
                          ".";
    
    std::cout << "[swacn] Capturing baseline filesystem state...\n";
    int result = std::system(tar_cmd.c_str());

    if (result == 0) {
        std::cout << "[swacn] Baseline state saved to .swacn/baseline.tar.gz\n";
    } else {
        std::cerr << "[swacn] Error: Failed to create baseline archive. Tar exited with code " << result << ".\n";
        return;
    }

    // 3. Create the manifest and merge developer config
    json manifest_json;
    manifest_json["version"] = "0.1.0";
    manifest_json["timestamp"] = std::time(nullptr);
    manifest_json["baseline"] = "baseline.tar.gz";
    manifest_json["recording"] = "demo.cast";

    // If the developer provided a swacn.json, inject its data into our manifest
    if (fs::exists(config_file)) {
        std::cout << "[swacn] Found swacn.json, merging configurations...\n";
        try {
            std::ifstream config_stream(config_file);
            json dev_config = json::parse(config_stream);
            manifest_json["environment"] = dev_config;
        } catch (const json::parse_error& e) {
            std::cerr << "[swacn] Warning: Failed to parse swacn.json. " << e.what() << "\n";
        }
    } else {
        std::cout << "[swacn] No swacn.json found. WebVM will run with default tools.\n";
    }

    std::ofstream manifest(".swacn/manifest.json");
    if (manifest.is_open()) {
        manifest << manifest_json.dump(2); // Dump with 2-space indentation
        manifest.close();
        std::cout << "[swacn] Manifest generated successfully.\n";
    }
}

void upload_project() {
    fs::path manifest_path = ".swacn/manifest.json";
    fs::path baseline_path = ".swacn/baseline.tar.gz";
    fs::path cast_path = ".swacn/demo.cast";

    // 1. Validation
    if (!fs::exists(manifest_path) || !fs::exists(baseline_path) || !fs::exists(cast_path)) {
        std::cerr << "[swacn] Error: Incomplete or missing recording.\n";
        std::cerr << "Make sure you run `swacn init` and `swacn record` first.\n";
        return;
    }

    std::cout << "[swacn] Packaging assets for upload...\n";

    // 2. Define the target endpoint
    // This is the URL where your Node/Go/Python backend receives the upload.
    std::string api_endpoint = "https://api.swacn.io/v1/casts/upload";

    // 3. Construct Multipart Payload
    // CPR safely handles file streaming, memory boundaries, and MIME types under the hood.
    cpr::Multipart multipart_data{
        {"manifest", cpr::File{manifest_path.string()}},
        {"baseline", cpr::File{baseline_path.string()}},
        {"recording", cpr::File{cast_path.string()}}
    };

    // Optional: If you implement authentication later, you add headers like this:
    // cpr::Header headers{{"Authorization", "Bearer YOUR_CLI_TOKEN"}};

    std::cout << "[swacn] Uploading to server...\n";

    // 4. Execute POST Request
    cpr::Response r = cpr::Post(cpr::Url{api_endpoint}, multipart_data);

    // 5. Handle the Response
    if (r.status_code == 0) {
        std::cerr << "[swacn] Network Error: Could not connect to the server.\n";
        std::cerr << "Details: " << r.error.message << "\n";
    } 
    else if (r.status_code >= 200 && r.status_code < 300) {
        std::cout << "[swacn] Upload successful!\n";
        
        // Assuming your backend returns a JSON payload with the new embed URL
        // e.g., {"status": "success", "url": "https://swacn.io/embed/abc123xyz"}
        try {
            json response_json = json::parse(r.text);
            if (response_json.contains("url")) {
                std::cout << "View your interactive cast at: " << response_json["url"].get<std::string>() << "\n";
            } else {
                std::cout << "Server response: " << r.text << "\n";
            }
        } catch (...) {
            std::cout << "Server response: " << r.text << "\n";
        }
    } 
    else {
        std::cerr << "[swacn] Upload failed with HTTP Status: " << r.status_code << "\n";
        std::cerr << "[swacn] Server message: " << r.text << "\n";
    }
}

void launch_asciinema(const std::string& output_file, bool capture_keys) {
    std::cout << "[swacn] Launching asciinema to record: " << output_file << "\n";
    if (capture_keys) {
        std::cout << "[swacn] WARNING: Keystroke capture enabled. Be careful with passwords.\n";
    }

    pid_t pid = fork();

    if (pid < 0) {
        std::cerr << "[swacn] Error: Failed to fork process.\n";
        return;
    }

    if (pid == 0) {
        // --- CHILD PROCESS ---
        signal(SIGINT, SIG_DFL); 
        
        // Dynamically build the argument list
        std::vector<const char*> args;
        args.push_back("asciinema");
        args.push_back("rec");
        
        if (capture_keys) {
            args.push_back("--stdin");
        }
        
        args.push_back(output_file.c_str());
        args.push_back(nullptr); // execvp requires a null-terminated array
        
        if (execvp(args[0], const_cast<char* const*>(args.data())) == -1) {
            std::cerr << "[swacn] Error: Failed to launch asciinema.\n";
            exit(1); 
        }
    } else {
        // --- PARENT PROCESS ---
        signal(SIGINT, SIG_IGN); 
        
        efsw::FileWatcher fileWatcher;
        SwacnUpdateListener listener(output_file);
        efsw::WatchID watchID = fileWatcher.addWatch(".", &listener, true);
        fileWatcher.watch();

        int status;
        waitpid(pid, &status, 0);

        fileWatcher.removeWatch(watchID);
        signal(SIGINT, SIG_DFL); 
        
        std::cout << "[swacn] Recording finished and fs watcher terminated.\n";
    }
}

int main(int argc, char* argv[]) {
    if (argc < 2) {
        print_usage();
        return 1;
    }

    std::string command = argv[1];

    if (command == "init") {
        initialize_project();
    } 
    else if (command == "record") {
        bool capture_keys = false;
        
        // Check if the --keys flag was passed as the third argument
        if (argc >= 3) {
            std::string flag = argv[2];
            if (flag == "--keys") {
                capture_keys = true;
            } else {
                std::cerr << "Unknown flag for record: " << flag << "\n";
                print_usage();
                return 1;
            }
        }

        std::string target_file = ".swacn/demo.cast"; 
        launch_asciinema(target_file, capture_keys);
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