# SWACN Azure Deployment Guide: From Scratch to Production

This guide covers the end-to-end process of deploying SWACN on **Microsoft Azure** at the lowest possible cost, using a single **Standard_B2ats_v2 VM** (~$6.86/month) to run the frontend web server (Caddy), backend service, and database (PostgreSQL).

---

## 1. Domain & DNS Setup
You will need a domain name (e.g., `swacn.com`) pointed to your Azure VM's public IP address.

1. Log in to your DNS provider (e.g., Cloudflare, Namecheap, GoDaddy).
2. Create the following records:
   - **A Record**: Name `@`, pointing to your **Azure VM Public IP**.
   - **A Record**: Name `www`, pointing to your **Azure VM Public IP**.
3. If using Cloudflare, go to the **SSL/TLS** tab and set the mode to **Full** or **Full (strict)**. Caddy on your VM will automatically fetch and renew the SSL certificates.

---

## 2. External Service Setup (OAuth & Payments)
Ensure you set up your developer accounts and configure callbacks pointing to your domain.

### A. GitHub OAuth (Production)
1. Go to **Settings > Developer Settings > OAuth Apps > New OAuth App** on GitHub.
2. **Homepage URL**: `https://swacn.com`
3. **Authorization callback URL**: `https://swacn.com/api/auth/callback`
4. Generate and save the **Client ID** and **Client Secret**.

### B. Google OAuth (Production)
1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create/select a project, go to **APIs & Services > Credentials > Create Credentials > OAuth client ID**.
3. **Application type**: Web application.
4. **Authorized redirect URIs**: `https://swacn.com/api/auth/google/callback`
5. Save the **Client ID** and **Client Secret**.

### C. Dodo Payments (Production)
1. Log in to your Dodo Payments dashboard.
2. Go to **Developers > API Keys** and generate a live key.
3. Under **Webhooks**, add your production webhook URL: `https://swacn.com/webhooks/dodopayments`
4. Select events: `payment.succeeded`, `payment.failed`, `subscription.active`, `subscription.renewed`, `subscription.cancelled`, `subscription.expired`.
5. Save the **Webhook Secret**.

---

## 3. Azure VM Setup & Configuration

### A. Provision the VM
You can provision a **Standard_B2ats_v2** (2 vCPUs, 1 GiB RAM) Ubuntu 22.04 VM using the provided automation script. By default, it provisions in `koreacentral` to comply with restricted subscription region policies and ensure unrestricted B-series v2 availability, but you can pass an alternate location as an argument:
```bash
# Defaults to koreacentral
./infrastructure/provision-vm.sh

# Or specify a custom allowed location (e.g. southeastasia, eastasia, uaenorth, malaysiawest)
./infrastructure/provision-vm.sh southeastasia
```
*Note: Make sure you have Azure CLI (`az`) installed and are logged in via `az login`.*

Alternatively, you can create it manually via the Azure Portal:
1. Choose **Ubuntu Server 22.04 LTS (x64)**.
2. Size: **Standard_B2ats_v2** (2 vCPUs, 1 GiB RAM).
3. Authentication: **SSH Public Key**. Name the user `azureuser`.
4. Under Inbound Port Rules, select **Allow selected ports** and enable **SSH (22)**, **HTTP (80)**, and **HTTPS (443)**.

### B. Access the VM
SSH into the newly created VM using the admin user (usually `azureuser`):
```bash
ssh azureuser@your_vm_public_ip
```

### C. Install Dependencies
Run these commands to update package lists and install Caddy and PostgreSQL:
```bash
sudo apt update
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl

# Add Caddy GPG Key and Repository
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list

sudo apt update
sudo apt install -y caddy postgresql postgresql-contrib

# Setup log directories
sudo mkdir -p /var/log/caddy
sudo chown caddy:caddy /var/log/caddy
```

### D. Setup Deployment Directory & Permissions
Since GitHub Actions uses `azureuser` (non-root) to deploy files, you must create `/opt/swacn` and give ownership to `azureuser`:
```bash
sudo mkdir -p /opt/swacn
sudo chown -R azureuser:azureuser /opt/swacn
```

### E. Initialize Database
Connect to PostgreSQL and set up the SWACN database and user:
```bash
sudo -u postgres psql
```
Run the following SQL queries (replace `'your_secure_password'` with a secure password):
```sql
CREATE DATABASE swacn_db;
CREATE USER swacn_user WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE swacn_db TO swacn_user;
\q
```

### F. Create Environment File
Create the configuration directory and environment file on the VM:
```bash
mkdir -p /opt/swacn/logs
nano /opt/swacn/.env
```
Paste and populate the following production environment values:
```bash
DB_HOST=127.0.0.1
DB_PORT=5432
DB_NAME=swacn_db
DB_USER=swacn_user
DB_PASS=your_secure_password
LISTEN_ADDR=127.0.0.1
LISTEN_PORT=8080
APP_URL=https://swacn.com  # Replace with your domain name
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
DODO_PAYMENTS_API_KEY=...
DODO_PAYMENTS_API_URL=https://api.dodopayments.com
DODO_PAYMENTS_WEBHOOK_SECRET=...
DODO_PRO_PRODUCT_ID=...
LOG_PATH=/opt/swacn/logs
LOG_LEVEL=INFO
```

---

## 4. GitHub CI/CD Configuration

To enable automated deployments from GitHub Actions, configure secrets in your repository settings (**Settings > Secrets and variables > Actions**):

1. **SSH_HOST**: Your Azure VM Public IP.
2. **SSH_USER**: `azureuser`
3. **SSH_KEY**: The private key corresponding to the public key used during VM creation.
   *(Usually found in `~/.ssh/id_rsa` or generated when running the script).*
4. **DB_PASSWORD**: Your Postgres user password (`your_secure_password`).

### Triggering a Deployment
1. Commit and push your changes to the `main` branch.
2. Push a version tag to trigger the workflow:
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```
The GitHub Actions workflow will:
- Build the React frontend.
- Compile the C++ backend inside a Docker container.
- Copy all build assets to the VM under `/opt/swacn/`.
- Register and restart the systemd service for the backend.
- Setup Caddy for reverse proxying and automatic SSL.

---

## 5. Verification & Monitoring

- **Check App Status**: `systemctl status swacn`
- **Check Caddy Web Server**: `systemctl status caddy`
- **View App Logs (Real-time)**: `journalctl -u swacn -f`
- **Watch Backend Filesystem Logs**: `tail -f /opt/swacn/logs/swacn.log`
- **Watch Caddy Access Traffic**: `tail -f /var/log/caddy/swacn.access.log`
- **Initial Database Schema (Run once after first deploy)**:
  ```bash
  psql -U swacn_user -d swacn_db -h 127.0.0.1 -f /opt/swacn/schema.sql
  ```
