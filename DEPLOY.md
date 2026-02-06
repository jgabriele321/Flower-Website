# Deploying Chichester Bouquet to chichesteriloveyou.com

## Overview
- **Domain**: chichesteriloveyou.com (root)
- **Port**: 8084 (next available after 8083)
- **Type**: Static Vite build
- **Location**: /var/www/chichester

---

## Step 1: Upload the dist folder to server

From your **local machine** (in the Chichester project directory):

```bash
# Create a tarball of the dist folder
cd /Users/giovannigabriele/Documents/Code/Chichester
tar -czvf chichester-dist.tar.gz dist/

# Upload to server (replace with your actual SSH connection)
scp chichester-dist.tar.gz defibeats@YOUR_SERVER_IP:/tmp/
```

---

## Step 2: Set up the app directory (ON SERVER)

SSH into your server and run:

```bash
# Create directory
sudo mkdir -p /var/www/chichester
sudo chown defibeats:defibeats /var/www/chichester

# Extract the uploaded files
cd /var/www/chichester
tar -xzvf /tmp/chichester-dist.tar.gz --strip-components=1

# Verify files are there
ls -la
# Should see: index.html, assets/, flowers/, vases/, backgrounds/

# Clean up
rm /tmp/chichester-dist.tar.gz
```

---

## Step 3: Update Cloudflare Tunnel config (ON SERVER)

```bash
sudo nano /etc/cloudflared/config.yml
```

Add this ingress rule **BEFORE** the `http_status:404` catch-all:

```yaml
  - hostname: chichesteriloveyou.com
    service: http://localhost:8084
  - hostname: www.chichesteriloveyou.com
    service: http://localhost:8084
```

Your full ingress section should look like:

```yaml
ingress:
  - hostname: sunmap.dwings.app
    service: http://localhost:8080
  - hostname: youup.dwings.app
    service: http://localhost:8081
  - hostname: weather.dwings.app
    service: http://localhost:8082
  # ... other existing rules ...
  - hostname: chichesteriloveyou.com
    service: http://localhost:8084
  - hostname: www.chichesteriloveyou.com
    service: http://localhost:8084
  # IMPORTANT: catch-all must ALWAYS be last
  - service: http_status:404
```

---

## Step 4: Update Caddy config (ON SERVER)

```bash
sudo nano /etc/caddy/Caddyfile
```

Add this block:

```
:8084 {
    root * /var/www/chichester
    file_server
    try_files {path} /index.html
    
    # Cache images for better performance
    @images {
        path *.webp *.png *.jpg
    }
    header @images Cache-Control "public, max-age=31536000"
}
```

---

## Step 5: Add DNS records in Cloudflare Dashboard

Go to https://dash.cloudflare.com → Select **chichesteriloveyou.com** → DNS → Records

**Add two CNAME records:**

| Type | Name | Target | Proxy |
|------|------|--------|-------|
| CNAME | @ | `<your-tunnel-id>.cfargotunnel.com` | ON (orange) |
| CNAME | www | `<your-tunnel-id>.cfargotunnel.com` | ON (orange) |

To find your tunnel ID:
```bash
cat /etc/cloudflared/config.yml | grep tunnel:
```

---

## Step 6: Reload services (ON SERVER)

```bash
# Reload Caddy
sudo systemctl reload caddy

# Restart Cloudflare Tunnel
sudo systemctl restart cloudflared

# Verify services are running
sudo systemctl status caddy
sudo systemctl status cloudflared
```

---

## Step 7: Verify deployment

```bash
# Test locally on server
curl -I http://localhost:8084

# Test externally (wait 1-2 minutes for DNS propagation)
curl -I https://chichesteriloveyou.com
```

Then open in browser: **https://chichesteriloveyou.com**

---

## Troubleshooting

### Check logs
```bash
sudo journalctl -u caddy -f
sudo journalctl -u cloudflared -f
```

### Check what's running on ports
```bash
sudo lsof -i -P -n | grep LISTEN | grep 8084
```

### If DNS isn't working
- Verify CNAME records are proxied (orange cloud ON)
- Wait 5 minutes for propagation
- Try clearing browser cache or use incognito

### If images aren't loading
```bash
# Check files exist
ls /var/www/chichester/flowers/
ls /var/www/chichester/vases/

# Check permissions
ls -la /var/www/chichester/
```

---

## Future Updates

To update the site after making changes:

**On local machine:**
```bash
cd /Users/giovannigabriele/Documents/Code/Chichester
npm run build
tar -czvf chichester-dist.tar.gz dist/
scp chichester-dist.tar.gz defibeats@YOUR_SERVER_IP:/tmp/
```

**On server:**
```bash
cd /var/www/chichester
rm -rf assets flowers vases backgrounds index.html
tar -xzvf /tmp/chichester-dist.tar.gz --strip-components=1
rm /tmp/chichester-dist.tar.gz
```

No need to restart services for static file updates!
