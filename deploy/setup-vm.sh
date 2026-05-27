#!/bin/bash
# GolfGVSunday — one-shot VM setup script for Ubuntu 22.04 (ARM Ampere or AMD).
# Run as `ubuntu` user:    bash setup-vm.sh
# Then `pm2 logs golfgv` to tail.

set -e
APP_DIR="/home/ubuntu/golfgvsunday"
APP_PORT="3000"

echo "═══ 1/6 · System packages ════════════════════════════════"
sudo apt-get update -y
sudo apt-get install -y curl git build-essential python3 ufw

echo "═══ 2/6 · Node.js 20 (NodeSource) ═════════════════════════"
if ! command -v node >/dev/null 2>&1 || [[ $(node -v) != v20* ]]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi
node -v
npm -v

echo "═══ 3/6 · PM2 (process manager) ═══════════════════════════"
sudo npm install -g pm2

echo "═══ 4/6 · App install ═════════════════════════════════════"
cd "$APP_DIR"
npm ci --omit=optional       # rebuilds better-sqlite3 native module for this arch
npm run build

echo "═══ 5/6 · Start with PM2 ══════════════════════════════════"
pm2 delete golfgv 2>/dev/null || true
PORT=$APP_PORT pm2 start npm --name golfgv -- start
pm2 save
pm2 startup systemd -u ubuntu --hp /home/ubuntu | tail -n 1 | sudo bash

echo "═══ 6/6 · Local firewall ══════════════════════════════════"
sudo ufw allow OpenSSH || true
sudo ufw allow 80/tcp  || true
sudo ufw allow 443/tcp || true
sudo ufw allow ${APP_PORT}/tcp || true
echo "y" | sudo ufw enable || true

# Forward 80 -> 3000 so app is reachable without :3000 in URL
sudo iptables -t nat -A PREROUTING -i ens3 -p tcp --dport 80 -j REDIRECT --to-port ${APP_PORT}
sudo apt-get install -y iptables-persistent
sudo netfilter-persistent save

PUBLIC_IP=$(curl -s ifconfig.me)
echo ""
echo "═══════════════════════════════════════════════════════════"
echo "✅ DONE.  App is at:"
echo "   http://${PUBLIC_IP}      (forwarded to :${APP_PORT})"
echo "   http://${PUBLIC_IP}:${APP_PORT}"
echo ""
echo "Useful commands:"
echo "   pm2 logs golfgv          # tail logs"
echo "   pm2 restart golfgv       # restart"
echo "   pm2 status               # see process"
echo "   sqlite3 ~/golfgvsunday/data/golfgvsunday.db   # inspect DB"
echo "═══════════════════════════════════════════════════════════"
