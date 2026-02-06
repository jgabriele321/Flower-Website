# server-understanding

It is now time to upload this project to our onsight server. That may or may not include using Cloudflare tunnels. Here's everything you need to know, please ask any questions and then propose a next step.

## Server & Cloudflare Configuration Rule

### Architecture Overview
The home server runs on Ubuntu with the following stack:

```
Internet → Cloudflare DNS → Cloudflare Tunnel → Home Server (Caddy) → Apps
```

### Key Components:
- **DNS Provider**: Cloudflare (domain: dwings.app, transferred from Squarespace)
- **Tunnel**: Cloudflare Tunnel (cloudflared) - creates secure connection without exposing home IP
- **Web Server**: Caddy - reverse proxy that routes requests to local apps
- **Process Manager**: systemd - manages background services
- **Auto-Deploy**: webhook service - listens for GitHub pushes

### Current Services

| Subdomain | Caddy Port | App Port | Type | Location |
|-----------|------------|----------|------|----------|
| sunmap.dwings.app | 8080 | 8080 | Static (Vite build) | /var/www/sunmap |
| youup.dwings.app | 8081 | 3001 | Node.js | /var/www/youup |
| weather.dwings.app | 8082 | 8082 | Static files | /var/www/weather/output |

## Configuration Files

### 1. Cloudflare Tunnel Config
**Location**: `/etc/cloudflared/config.yml`

```yaml
tunnel: <tunnel-id>
credentials-file: /root/.cloudflared/<tunnel-id>.json
ingress:
  - hostname: sunmap.dwings.app
    service: http://localhost:8080
  - hostname: youup.dwings.app
    service: http://localhost:8081
  - hostname: weather.dwings.app
    service: http://localhost:8082
  # IMPORTANT: catch-all must ALWAYS be last
  - service: http_status:404
```

### 2. Caddy Web Server Config
**Location**: `/etc/caddy/Caddyfile`

```
:8080 {
    root * /var/www/sunmap/dist
    file_server
    try_files {path} /index.html
}

:8081 {
    reverse_proxy localhost:3001
}

:8082 {
    root * /var/www/weather/output
    file_server
    header Cache-Control "no-cache, no-store, must-revalidate"
    header Pragma "no-cache"
    header Expires "0"
}
```

### 3. Systemd Services
**Location**: `/etc/systemd/system/<service-name>.service`

Example (youup.service):
```ini
[Unit]
Description=YouUp Health Dashboard
After=network.target

[Service]
Type=simple
User=defibeats
WorkingDirectory=/var/www/youup
ExecStart=/usr/bin/node server.js
Environment=PORT=3001
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

## How to Add a New Subdomain/Service

### Step 1: Find the next available port

**IMPORTANT**: Always check which ports are already in use before choosing one!

```bash
# List all ports currently used in Caddy
grep -E "^:[0-9]+" /etc/caddy/Caddyfile | sort -t: -k2 -n
```

This will output something like:
```
:8080 {
:8081 {
:8082 {
:8083 {
:8084 {
:8085 {
```

Pick the next number (e.g., if 8085 is the highest, use **8086**).

### Step 2: Create the app directory

```bash
sudo mkdir -p /var/www/newapp
sudo chown defibeats:defibeats /var/www/newapp
```

### Step 3: Deploy your code

**Option A** - Git clone (for GitHub repos):
```bash
cd /var/www/newapp
git clone git@github.com:jgabriele321/newapp.git .
```

**Option B** - Static files:
```bash
# Copy built files to /var/www/newapp
```

### Step 4: Update Cloudflare Tunnel

```bash
sudo nano /etc/cloudflared/config.yml
```

Add new ingress rule **BEFORE** the `http_status:404` catch-all:

```yaml
  - hostname: newapp.dwings.app
    service: http://localhost:8086
```

### Step 5: Update Caddy

```bash
sudo nano /etc/caddy/Caddyfile
```

For static sites:
```
:8086 {
    root * /var/www/newapp/dist
    file_server
    try_files {path} /index.html
}
```

For Node.js/Python apps (reverse proxy):
```
:8086 {
    reverse_proxy localhost:3002
}
```

### Step 6: Create systemd service (if needed for dynamic apps)

```bash
sudo nano /etc/systemd/system/newapp.service
```

```ini
[Unit]
Description=New App
After=network.target

[Service]
Type=simple
User=defibeats
WorkingDirectory=/var/www/newapp
ExecStart=/usr/bin/node server.js
Environment=PORT=3002
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

### Step 7: Add DNS record in Cloudflare Dashboard

1. Go to https://dash.cloudflare.com
2. Select dwings.app domain
3. Go to DNS → Records
4. Add CNAME record:
   - **Name**: newapp
   - **Target**: `<tunnel-id>.cfargotunnel.com`
   - **Proxy**: ON (orange cloud)

### Step 8: Reload all services

```bash
# Reload Caddy
sudo systemctl reload caddy

# Restart Cloudflare Tunnel
sudo systemctl restart cloudflared

# Enable and start new app service (if created)
sudo systemctl enable newapp
sudo systemctl start newapp
```

### Step 9: Verify

```bash
# Check services
sudo systemctl status caddy
sudo systemctl status cloudflared
sudo systemctl status newapp

# Test externally
curl https://newapp.dwings.app
```

## Common Commands

```bash
# View logs
sudo journalctl -u cloudflared -f
sudo journalctl -u caddy -f
sudo journalctl -u <service-name> -f

# Restart services
sudo systemctl restart caddy
sudo systemctl restart cloudflared
sudo systemctl restart <service-name>

# Edit configs
sudo nano /etc/caddy/Caddyfile
sudo nano /etc/cloudflared/config.yml

# Check what's running on ports
sudo lsof -i -P -n | grep LISTEN

# Find next available Caddy port
grep -E "^:[0-9]+" /etc/caddy/Caddyfile | sort -t: -k2 -n
```

## Auto-Deploy with Webhook (Optional)

For GitHub auto-deploy on push:

1. Webhook service listens on port 9000
2. GitHub webhook sends POST to `https://webhook.dwings.app/hooks/deploy-<app>`
3. Deploy script at `/var/www/<app>/deploy.sh` runs:

```bash
#!/bin/bash
cd /var/www/<app>
git -c safe.directory=/var/www/<app> pull origin main
npm install
npm run build
```

**Note**: The `safe.directory` flag is needed because webhook runs as root but files are owned by defibeats.

## Important Notes

- **Port mapping**: Cloudflare Tunnel routes to Caddy ports, Caddy can either serve static files OR reverse proxy to app ports
- **Catch-all rule**: The `http_status:404` in cloudflared config must **ALWAYS** be the last ingress entry
- **File ownership**: App directories should be owned by `defibeats` user
- **Environment variables**: Store secrets in `/var/www/<app>/.env` (not in git)
- **Cache control**: For frequently-updated static files, add no-cache headers in Caddy
