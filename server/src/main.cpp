#include <drogon/drogon.h>
#include <fstream>
#include <string>
#include <cstdlib> // for setenv

// Lightweight .env parser
void load_env(const std::string& filepath = ".env") {
    std::ifstream file(filepath);
    if (!file.is_open()) {
        LOG_INFO << "No .env file found. Relying on system environment variables.";
        return;
    }

    std::string line;
    while (std::getline(file, line)) {
        // Skip empty lines and comments
        if (line.empty() || line[0] == '#') continue;

        auto delimiterPos = line.find('=');
        if (delimiterPos != std::string::npos) {
            std::string key = line.substr(0, delimiterPos);
            std::string value = line.substr(delimiterPos + 1);
            
            // setenv(key, value, overwrite_flag)
            setenv(key.c_str(), value.c_str(), 1); 
        }
    }
    LOG_INFO << "Loaded environment variables from .env";
}

int main() {
    // 1. Load the .env file first
    load_env();

    // 2. Load Drogon config file
    drogon::app().loadConfigFile("config.json");
    
    // Quick sanity check to ensure the env variables are actually loaded
    if (getenv("GITHUB_CLIENT_ID") == nullptr) {
        LOG_WARN << "WARNING: GITHUB_CLIENT_ID is not set!";
    }

    LOG_INFO << "Server running on 0.0.0.0:8080";
    
    // 3. Run the fully asynchronous event loop
    drogon::app().run();
    return 0;
}