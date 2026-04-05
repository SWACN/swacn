# SWACN (Software Without Any Cool Name)

## Overview

SWACN is a next-generation terminal recording and sharing platform designed to be the interactive successor to asciinema. 

Traditional terminal recorders capture a passive stream of standard output. While efficient, the viewer is limited to observation. SWACN bridges the gap between documentation and active exploration by pairing a highly optimized terminal recording with a synchronized, background WebAssembly Virtual Machine (WebVM). 

When a user watches a SWACN embed, they see standard, high-performance terminal playback. However, at any moment, the user can pause the recording and seamlessly transition into a fully interactive terminal session. The environment will perfectly mirror the exact filesystem and state of the recording at that specific timestamp, allowing the user to experiment, run commands, and test the software live in their browser.

## Architecture: How It Works

SWACN solves the "terminal state hydration" problem without relying on non-deterministic command replay. Instead, it utilizes an Event Sourcing model for the filesystem.

### 1. The Recording Phase (Native C++)
The SWACN CLI acts as a wrapper around the standard `asciinema` recording process, augmented by a high-performance, OS-level filesystem watcher.

* **Baseline Capture (`swacn init`):** Before recording, the CLI captures a lightweight tarball of the current project directory. This serves as the `T=0` state for the WebVM.
* **Side-Effect Injection (`swacn record`):** As the user records their terminal session, a background C++ thread monitors the directory for file modifications, creations, and deletions using OS interrupts (`FSEvents` on macOS, `inotify` on Linux via `efsw`). 
* **Custom Cast Events:** File changes are debounced, Base64 encoded, and injected seamlessly into the asciinema `.cast` file (NDJSON format) as custom `fs` events, strictly timestamped to match the visual output.

### 2. The Playback Phase (Browser/WASM)
The frontend player utilizes `xterm.js` to render the passive recording.

* **Background Boot:** Upon loading the embed, a WebVM (e.g., BrowserFS or a WASI runtime) initializes in a Web Worker and unpacks the baseline tarball.
* **Real-time Hydration:** As the video plays, the player parses the custom `fs` events from the `.cast` file. It applies these base64-encoded file diffs directly to the hidden WebVM's virtual filesystem exactly as the timestamps dictate.

### 3. The Interactive Phase (Pause & Play)
* **Instant Transition:** Because the WebVM's filesystem is constantly updated in the background, pausing the video requires zero load time. Control is instantly handed over to the user via the `xterm.js` canvas.
* **Snapshot Restoration:** Before the user interacts, a snapshot of the WebVM state is stored. Once the user resumes playback, the temporary interactive changes are wiped, the snapshot is restored, and the recording continues flawlessly.

---

## Project Roadmap

To bring SWACN to production, the architecture is divided into three primary domains. Below is the comprehensive list of components that must be built.

### Phase 1: The Native Core (C++ CLI)
*Status: In Progress*

The CLI is responsible for capturing the environment and multiplexing the recording streams.

* [x] **Project Scaffolding:** CMake integration with C++17 filesystem support.
* [x] **Subprocess Management:** Forking and executing `asciinema rec` as a blocking child process.
* [x] **Baseline Initialization:** Implementation of `swacn init` to generate `.swacn/baseline.tar.gz` and `manifest.json`.
* [x] **Filesystem Watcher:** Integration of the `efsw` library for cross-platform, non-polling directory monitoring.
* [x] **Event Processor:** Debouncing logic, binary-to-Base64 encoding, and thread-safe appending of custom JSON events to the `.cast` file.
* [ ] **Upload Mechanism:** Implementation of `swacn upload` to compress the `.swacn` directory and securely transmit it to the backend via REST API.

### Phase 2: The Web Player (TypeScript / WebAssembly)
*Status: Pending*

The embeddable frontend component that handles playback and virtualization.

* [ ] **Cast Parser:** A custom parser capable of reading asciinema `.cast` v2 files, separating standard `o`/`i` events for rendering from custom `fs` events for state management.
* [ ] **WebVM Integration:** Selection and implementation of an in-browser runtime environment capable of executing standard CLI tools (e.g., integrating a WASI runtime or a lightweight x86 emulator like v86).
* [ ] **Virtual Filesystem Manager:** An abstraction layer to mount the `baseline.tar.gz` into the WebVM and apply Base64 file diffs in real-time.
* [ ] **State Snapshotting:** Memory/FS snapshotting logic to save the state on pause and revert the state on resume.
* [ ] **UI/UX Wrapper:** The interactive overlay featuring standard video controls (play, pause, timeline scrub) integrated closely with the `xterm.js` canvas.

### Phase 3: The Backend Infrastructure
*Status: Pending*

The central hub for storing recordings and serving the embeds.

* [ ] **Storage Layer:** S3-compatible object storage to host the `.cast` files and baseline tarballs.
* [ ] **Ingestion API:** Authentication and upload endpoints to receive packages from the `swacn` CLI.
* [ ] **Embed Provider:** A lightweight serving layer that generates the standard `<iframe>` codes and configures CORS properly so the Web Player can stream the assets from storage.

---

## Getting Started (Development)

The native CLI is built using C++17 and CMake.

### Prerequisites
* CMake (3.14 or higher)
* A modern C++ compiler (Clang/GCC)
* `asciinema` installed and available in your system PATH.

### Building the CLI

```bash
# Clone the repository
git clone <repository_url>
cd swacn

# Create build directory
mkdir build && cd build

# Configure and compile
cmake ..
make
```

### Usage

1. Navigate to the project directory you wish to record.
2. Run initialization to capture the baseline state:
   ```bash
   ./swacn init
   ```
3. Start recording your interactive session:
   ```bash
   ./swacn record
   ```
4. Type `exit` or press `Ctrl+D` to end the recording. The resulting assets will be stored in the local `.swacn` directory.