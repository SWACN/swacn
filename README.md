# SWACN (Software Without Any Cool Name)

SWACN is a next-generation interactive terminal recording and sharing platform. Unlike traditional recorders that only capture passive standard output, SWACN bridges the gap between passive observation and active experimentation. 

By syncing high-performance `.cast` video playback with an in-browser **v86 Virtual Machine (x86 WASM Emulator)** running in a Web Worker, SWACN allows viewers to pause the video at any timestamp and instantly spin up an interactive terminal sandbox. The sandbox is pre-hydrated with the exact directory state and files of the workspace at that exact moment.

---

## Repository Architecture

The codebase is structured into three primary subdirectories:

1. **`/server` (High-Performance C++ Backend)**
   * Built on the highly optimized asynchronous **Drogon C++ Web Framework**.
   * Integrates with a **PostgreSQL** database for user, project, and session management.
   * Handles user authentication (Google & GitHub OAuth), CLI upload routes, subscription management via **Dodo Payments** webhooks, and oEmbed providers.

2. **`/web` (Modern React Client)**
   * Built with **React 19**, **Vite**, **TypeScript**, and styled using **Tailwind CSS v4** (incorporating a bold, warm neo-brutalist theme).
   * Employs **xterm.js** with fit addons to handle interactive terminal input.
   * Integrates **v86** hardware emulation to mount and execute Linux/x86 statically-linked binaries directly inside the browser.
   * Features custom terminal recording visualizers, a tactile **Keystroke HUD**, and dynamic dashboard controls.

3. **`/infrastructure` (Production Configuration)**
   * Configuration for production servers using **Caddy** (with automated HTTPS/SSL).
   * Scripting (`provision-vm.sh`) for rapid deployment on cloud virtual machines.
   * Systemd service file (`swacn.service`) to run the compiled C++ application server.

---

## Key Features

* **Interactive Sandbox Player**: Pause a recording to take over the console. Run code, inspect logs, and debug workspace files live in-browser.
* **OAuth Integrations**: Seamless login flows via Google and GitHub OAuth.
* **Enterprise Seat Management**: Auto-provisions Pro tier access to users signing up with approved enterprise domains.
* **Subscription & Billing**: Integrates with Dodo Payments to manage subscriptions and support upgrade options directly from the dashboard.
* **Keyboard HUD (Keystroke Visualizer)**: Overlays live keyboard shortcuts and typing counts during replay, capturing the input using the CLI's `--stdin` logging.
* **Project Dashboard**: A single panel where users can delete recordings, rename projects, toggle public/private visibility, customize display themes (including Catppuccin variants), and manage download rights.

---

## Database Model (`schema.sql`)

The database is built on PostgreSQL with the following core entities:
* `enterprises`: Manages enterprise subscription seats and license domains.
* `users`: Stores user credentials, OAuth ids, API keys (used by the CLI), and subscription tier state.
* `projects`: Represents workspaces, housing their styling preferences (e.g., custom themes), visibility toggle, and remote paths to baseline tarballs (`baseline_url`).
* `casts`: Records individual terminal recordings associated with projects and files.

---

## Local Development Setup

### 1. Database Setup
Ensure PostgreSQL is running locally, create a database, and initialize it:
```bash
createdb swacn_db
psql -d swacn_db -f server/schema.sql
```

### 2. Running the Drogon Server (`/server`)

#### Prerequisites
* CMake (3.14 or higher)
* GCC/Clang with C++17 support
* Drogon Framework (installed globally or via package managers like `vcpkg`/`apt`)
* OpenSSL developer libraries

#### Compilation
From the project root:
```bash
cd server
mkdir build && cd build
cmake ..
make
```

#### Environment Configuration
Create a `.env` file in the `/server` directory:
```env
DB_HOST=127.0.0.1
DB_PORT=5432
DB_NAME=swacn_db
DB_USER=postgres
DB_PASS=your_password
LISTEN_ADDR=127.0.0.1
LISTEN_PORT=8080
APP_URL=http://localhost:3000
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
DODO_PAYMENTS_API_KEY=your_dodo_api_key
DODO_PAYMENTS_API_URL=https://sandbox.dodopayments.com
DODO_PAYMENTS_WEBHOOK_SECRET=your_webhook_secret
DODO_PRO_PRODUCT_ID=your_pro_id
LOG_PATH=./logs
LOG_LEVEL=DEBUG
```
Start the compiled binary:
```bash
./swacn_server
```

### 3. Running the React Client (`/web`)

#### Prerequisites
* Node.js (v20+ recommended)
* npm or yarn

#### Running the Dev Server
From the project root:
```bash
cd web
npm install
npm run dev
```
The client will be running on `http://localhost:3000`.

#### Building for Production
```bash
npm run build
```

---

## 🚀 Production Deployment

We maintain comprehensive setup sheets for deploying the application on various cloud providers:
* For general droplet setups (Ubuntu, PostgreSQL, Caddy, Systemd): Check out the [Production Deployment Guide](deployment.md).
* For cost-effective Microsoft Azure deployments (~$6.86/month): Refer to the [Azure Deployment Guide](azure_deployment.md).
