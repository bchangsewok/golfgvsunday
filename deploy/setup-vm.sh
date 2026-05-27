#!/bin/bash
# GolfGVSunday — one-shot VM setup script for Ubuntu 22.04 / Debian on any cloud.
# Works for any Linux user (uses $HOME / $USER, not hardcoded "ubuntu").
# Run as your normal user (not root):    bash ~/golfgvsunday/deploy/setup-vm.sh

set -e
APP_DIR="$HOME/golfgvsunday"
APP_PORT="3000"
RUN_USER="$(whoami)"
[ -d "$APP_DIR" ] || { echo "ERROR: $APP_DIR not found. Did you git clone first?"; exit 1; }

echo "═══ 1/6 · System packages ════════════════════════════════"
sudo apt-get update -y
sudo apt-get install -y curl git build-essential python3 ufw iptables-persistent

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
# Set pm2 to start on boot — uses the actual current user/home
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u "$RUN_USER" --hp "$HOME"

echo "═══ 6/6 · Firewall + port 80 forward ══════════════════════"
sudo ufw allow OpenSSH || true
sudo ufw allow 80/tcp  || true
sudo ufw allow 443/tcp || true
sudo ufw allow ${APP_PORT}/tcp || true
echo "y" | sudo ufw enable || true

# Detect primary network interface (varies between clouds: eth0, ens3, ens4, enp0s3...)
IFACE=$(ip route get 1.1.1.1 2>/dev/null | awk '{print $5; exit}')
[ -z "$IFACE" ] && IFACE="$(ip -o link show | awk -F': ' 'NR==2{print $2}')"
echo "Detected primary interface: $IFACE"

# Add iptables forward 80 -> 3000 (idempotent — remove first if it exists)
sudo iptables -t nat -D PREROUTING -i "$IFACE" -p tcp --dport 80 -j REDIRECT --to-port ${APP_PORT} 2>/dev/null || true
sudo iptables -t nat -A PREROUTING -i "$IFACE" -p tcp --dport 80 -j REDIRECT --to-port ${APP_PORT}
sudo netfilter-persistent save

PUBLIC_IP=$(curl -s ifconfig.me || echo "<your-public-ip>")
echo ""
echo "═══════════════════════════════════════════════════════════"
echo "✅ DONE.  App is at:"
echo "   http://${PUBLIC_IP}              (port 80 → ${APP_PORT})"
echo "   http://${PUBLIC_IP}:${APP_PORT}"
echo ""
echo "Useful commands:"
echo "   pm2 logs golfgv          # tail logs"
echo "   pm2 restart golfgv       # restart after code change"
echo "   pm2 status               # see process"
echo "   sqlite3 $APP_DIR/data/golfgvsunday.db   # inspect DB"
echo ""
echo "To update after pushing new code to GitHub:"
echo "   cd $APP_DIR && git pull && bash deploy/update-app.sh"
echo "═══════════════════════════════════════════════════════════"
