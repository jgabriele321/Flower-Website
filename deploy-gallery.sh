#!/bin/bash
# Deploy script for Chichester with Gallery feature
# Run this on the SERVER after uploading files

set -e

echo "=== Chichester Gallery Deployment ==="

# Create gallery directory
echo "Creating gallery directory..."
sudo mkdir -p /var/www/chichester/gallery
sudo chown defibeats:defibeats /var/www/chichester/gallery

# Install server dependencies
echo "Installing server dependencies..."
cd /var/www/chichester/server
npm install --production

# Install systemd service
echo "Installing systemd service..."
sudo cp /var/www/chichester/server/chichester-gallery.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable chichester-gallery
sudo systemctl restart chichester-gallery

echo "Gallery server status:"
sudo systemctl status chichester-gallery --no-pager

echo ""
echo "=== Deployment complete! ==="
echo ""
echo "IMPORTANT: You still need to update Caddy config manually:"
echo ""
echo "1. Edit /etc/caddy/Caddyfile"
echo "2. Replace the :8086 block with:"
echo ""
echo ":8086 {"
echo "    handle /api/* {"
echo "        reverse_proxy localhost:3086"
echo "    }"
echo "    handle /gallery/* {"
echo "        root * /var/www/chichester"
echo "        file_server"
echo "    }"
echo "    handle {"
echo "        root * /var/www/chichester"
echo "        file_server"
echo "    }"
echo "}"
echo ""
echo "3. Run: sudo systemctl reload caddy"
