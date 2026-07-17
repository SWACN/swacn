# SWACN Deployment Guide: From Scratch to Production

This guide covers the end-to-end process of deploying SWACN using **Cloudflare for DNS & Email**, **DigitalOcean for Hosting**, and **GitHub for CI/CD**.

> [!NOTE]
> **Hosting on Azure?**
> If you prefer to host on Microsoft Azure at the lowest cost (~$6.86/month), we have a dedicated [Azure Deployment Guide](file:///Users/karthikey/swacn/azure_deployment.md) that leverages a single Standard_B2ats_v2 Virtual Machine with Caddy and PostgreSQL.

---

## 1. Domain & Email Setup (`swacn.com`)

We recommend using Cloudflare as your DNS provider because it offers **Free Professional Email Routing** (e.g., `hello@swacn.com` -> your personal email).

### A. Point Namecheap to Cloudflare
1. Log in to your **Namecheap** account.
2. Go to your **Domain List** and click **Manage** next to `swacn.com`.
3. Find the **Nameservers** section.
4. Select **Custom DNS** and enter the two nameservers provided by Cloudflare (e.g., `ashley.ns.cloudflare.com` and `oliver.ns.cloudflare.com`).
5. Click the green checkmark to save.

### B. Configure DNS in Cloudflare
1. Log in to **Cloudflare** and add your site `swacn.com`.
2. Go to the **DNS** tab.
3. Create the following records:
   - **A Record**: Name `@`, points to your **DigitalOcean Droplet IP**. (Proxy: Enabled/Orange Cloud).
   - **A Record**: Name `www`, points to your **DigitalOcean Droplet IP**. (Proxy: Enabled/Orange Cloud).
4. Go to the **SSL/TLS** tab and set the mode to **Full** or **Full (strict)**.

### C. Setup Zoho Mail (Free Professional Inbox)
If you want to **send** and **receive** emails from a professional inbox for free:

1. Sign up for the **Zoho Mail "Forever Free" Plan**.
2. Verify your domain by adding the `TXT` record Zoho provides to your Cloudflare DNS.
3. Add the following **MX Records** in Cloudflare (delete any existing MX records first):
   - Type: `MX`, Name: `@`, Value: `mx.zoho.com`, Priority: `10`
   - Type: `MX`, Name: `@`, Value: `mx2.zoho.com`, Priority: `20`
   - Type: `MX`, Name: `@`, Value: `mx3.zoho.com`, Priority: `50`
4. Add the **SPF Record** (Type: `TXT`, Name: `@`, Value: `v=spf1 include:zoho.com ~all`).
5. Enable **DKIM** in your Zoho Control Panel and add the resulting `TXT` record to Cloudflare to ensure your emails don't go to spam.

---

## 2. External Service Setup (OAuth & Payments)

### A. GitHub OAuth (Production)
1. Go to your GitHub **Developer Settings > OAuth Apps > New OAuth App**.
2. **Application Name**: `SWACN Production`
3. **Homepage URL**: `https://swacn.com`
4. **Authorization callback URL**: `https://swacn.com/api/auth/callback`
5. Generate a **Client Secret** and save it.

### B. Google OAuth (Production)
1. Go to [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project.
3. Go to **APIs & Services > Credentials > Create Credentials > OAuth client ID**.
4. **Application type**: Web application.
5. **Authorized redirect URIs**: `https://swacn.com/api/auth/google/callback`
6. Save the **Client ID** and **Client Secret**.

### C. Dodo Payments (Production)
1. Log in to your Dodo Payments dashboard.
2. Go to **Developers > API Keys** and generate a live key.
3. Go to **Webhooks** and add your production URL: `https://swacn.com/webhooks/dodopayments`
4. Select the following events: `payment.succeeded`, `payment.failed`, `subscription.active`, `subscription.renewed`, `subscription.cancelled`, `subscription.expired`.
5. Save the **Webhook Secret**.

---

## 3. DigitalOcean Droplet Setup

### A. Create a Droplet
1. Click **Create > Droplets**.
2. **OS**: Ubuntu 22.04 LTS (x64).
3. **Size**: Basic (Regular SSD) - $6 or $12/mo plan is sufficient.
4. **Authentication**: Choose **SSH Key**. (If you don't have one, follow the "New SSH Key" prompt).
5. **Finalize**: Hostname `swacn-prod`.

### B. Server Preparation (via SSH)
SSH into your droplet:
```bash
ssh root@your_droplet_ip
```

Run these commands to install Caddy and PostgreSQL:
```bash
sudo apt update
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install caddy postgresql postgresql-contrib
sudo mkdir -p /var/log/caddy
sudo chown caddy:caddy /var/log/caddy
```

### C. Database Initialization
```bash
sudo -u postgres psql
```
```sql
CREATE DATABASE swacn_db;
CREATE USER swacn_user WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE swacn_db TO swacn_user;
\q
```

### D. Application Environment
```bash
mkdir -p /opt/swacn
nano /opt/swacn/.env
```
Paste and fill with your **Production** values:
```bash
DB_HOST=127.0.0.1
DB_PORT=5432
DB_NAME=swacn_db
DB_USER=swacn_user
DB_PASS=your_secure_password
LISTEN_ADDR=127.0.0.1
LISTEN_PORT=8080
APP_URL=https://swacn.com
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

### A. Generate Deployment SSH Key
On your **local machine**:
```bash
ssh-keygen -t rsa -b 4096 -f ~/.ssh/id_rsa_swacn
ssh-copy-id -i ~/.ssh/id_rsa_swacn.pub root@your_droplet_ip
cat ~/.ssh/id_rsa_swacn # Copy this private key
```

### B. Add GitHub Secrets
In your Repo **Settings > Secrets > Actions**, add:
- `SSH_HOST`: Droplet IP
- `SSH_USER`: `root`
- `SSH_KEY`: [The private key you just copied]
- `DB_PASSWORD`: [Your Postgres password]

---

## 5. Deployment Workflow

1. Commit and push your code to `main`.
2. Push a version tag to trigger the build:
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```
3. GitHub Actions will:
   - Build the React frontend.
   - Compile the C++ backend (in a Linux container).
   - Sync files to `/opt/swacn`.
   - Start the `swacn` systemd service.
   - Configure Caddy for `swacn.com` with **Automatic SSL**.

---

## 6. Verification & Troubleshooting

- **Check App Status**: `systemctl status swacn`
- **View App Logs (Real-time)**: `journalctl -u swacn -f`
- **Check Backend Log Files**: `tail -f /opt/swacn/logs/swacn.log`
- **Check Caddy Access Logs**: `tail -f /var/log/caddy/swacn.access.log`
- **Check Web Server**: `systemctl status caddy`
- **Initial DB Schema**: Run `psql -U swacn_user -d swacn_db -f /opt/swacn/schema.sql` on the server once after the first deploy.

---

## 7. Log Management

The system is configured to use rotating file-based logs. If you need to set them up or check them manually:

### A. Manual Directory Setup
If the directories are not created automatically, run:
```bash
# Backend logs
sudo mkdir -p /opt/swacn/logs
sudo chmod 755 /opt/swacn/logs

# Caddy logs
sudo mkdir -p /var/log/caddy
sudo chown caddy:caddy /var/log/caddy
```

### B. Viewing Logs
```bash
# Watch backend activity (real-time)
tail -f /opt/swacn/logs/swacn.log

# Watch web traffic (real-time)
tail -f /var/log/caddy/swacn.access.log

# View system service logs (journald)
journalctl -u swacn -f
```

---

## 8. Database Migrations (Updating the Schema)

**IMPORTANT:** Never run your full `schema.sql` on a production database after the first time, as it may contain `DROP TABLE` commands that wipe your data.

### To make changes to an existing database:
1. SSH into your Droplet.
2. Connect to the database: `psql -U swacn_user -d swacn_db`
3. Run an `ALTER` command. For example, to add a new column:
   ```sql
   ALTER TABLE users ADD COLUMN bio TEXT;
   ```
4. If you have many changes, create a new `.sql` file for just those changes and run it:
   ```bash
   psql -U swacn_user -d swacn_db -f /opt/swacn/migrations/002_update.sql
   ```

---

## 9. Security Notes
- Caddy automatically handles SSL (HTTPS) for `swacn.com`.
- Ensure your Droplet's firewall (UFW) allows 80, 443, and 22.
  ```bash
  ufw allow 80/tcp
  ufw allow 443/tcp
  ufw allow 22/tcp
  ufw enable
  ```
