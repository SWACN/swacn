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

namespace fs = std::filesystem;

void print_usage() {
    std::cout << "swacn - Interactive terminal recording\n\n";
    std::cout << "Usage:\n";
    std::cout << "  swacn init    # Snapshot current directory\n";
    std::cout << "  swacn record  # Start asciinema + fs watcher\n";
}

void initialize_project() {
    fs::path swacn_dir = ".swacn";

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

    // 3. Create a manifest file for `swacn upload`
    // This will eventually hold info like the cast file hash, timings, etc.
    std::ofstream manifest(".swacn/manifest.json");
    if (manifest.is_open()) {
        manifest << "{\n";
        manifest << "  \"version\": \"0.1.0\",\n";
        manifest << "  \"timestamp\": " << std::time(nullptr) << ",\n";
        manifest << "  \"baseline\": \"baseline.tar.gz\",\n";
        manifest << "  \"recording\": \"demo.cast\"\n";
        manifest << "}\n";
        manifest.close();
        std::cout << "[swacn] Manifest generated.\n";
    }

    std::cout << "[swacn] Initialization complete. You can now run `swacn record`.\n";
}

void launch_asciinema(const std::string& output_file) {
    std::cout << "[swacn] Launching asciinema to record: " << output_file << "\n";

    pid_t pid = fork();

    if (pid < 0) {
        std::cerr << "[swacn] Error: Failed to fork process.\n";
        return;
    }

    if (pid == 0) {
        // --- CHILD PROCESS (Asciinema) ---
        std::vector<const char*> args = {"asciinema", "rec", output_file.c_str(), nullptr};
        if (execvp(args[0], const_cast<char* const*>(args.data())) == -1) {
            std::cerr << "[swacn] Error: Failed to launch asciinema.\n";
            exit(1); 
        }
    } else {
        // --- PARENT PROCESS (Watcher) ---
        
        // Initialize the OS-level file watcher
        efsw::FileWatcher fileWatcher;
        SwacnUpdateListener listener(output_file);

        // Add the current directory to be watched recursively
        efsw::WatchID watchID = fileWatcher.addWatch(".", &listener, true);

        // Start watching asynchronously in the background
        fileWatcher.watch();

        // Wait for the user to finish the asciinema recording
        int status;
        waitpid(pid, &status, 0);

        // Stop the watcher now that recording is done
        fileWatcher.removeWatch(watchID);
        
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
        // We will save the cast file inside .swacn so everything is bundled
        std::string target_file = ".swacn/demo.cast"; 
        launch_asciinema(target_file);
    } 
    else {
        std::cerr << "Unknown command: " << command << "\n";
        print_usage();
        return 1;
    }

    return 0;
}