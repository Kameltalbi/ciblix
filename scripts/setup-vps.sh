#!/usr/bin/env bash
set -euo pipefail
# Préparation initiale Ubuntu (sans Docker) : pare-feu, Node 20, PM2.
# À lancer une fois ; les commandes sudo concernent les paquets système.

echo "🚀 Setup VPS (PM2, sans Docker) — Bilan CRM"
echo "══════════════════════════════════════════"

echo ""
echo "📦 Mise à jour paquets…"
sudo apt update && sudo apt upgrade -y

echo ""
echo "🔧 Paquets de base…"
sudo apt install -y git curl ufw fail2ban ca-certificates gnupg

echo ""
echo "📗 Node.js 20.x (NodeSource)…"
if ! command -v node >/dev/null 2>&1 || ! node -v | grep -q '^v20\.'; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt install -y nodejs
fi
node -v
npm -v

echo ""
echo "⚙️  PM2 global…"
sudo npm install -g pm2
pm2 --version

echo ""
echo "🔒 Pare-feu (SSH + HTTP/S)…"
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable || true

echo ""
echo "🛡️  fail2ban…"
sudo systemctl enable --now fail2ban

echo ""
echo "📁 Dossier applicatif…"
APP_DIR="${APP_DIR:-/var/www/ciblix}"
sudo mkdir -p "$APP_DIR"
sudo chown "${SUDO_USER:-$USER}:${SUDO_USER:-$USER}" "$APP_DIR"

echo ""
echo "✅ Prêt."
echo "   1. cd $APP_DIR"
echo "   2. git clone <votre-repo-git> ."
echo "   3. cp .env.example .env && nano .env"
echo "   4. npm ci && cd backend && npm run build && npx prisma migrate deploy && pm2 start ecosystem.config.cjs"
echo "   5. cd .. && npm run build -w bilan-crm-frontend"
echo "   6. Configurer Nginx/Caddy (root → frontend/dist, /api → backend)"
echo "   Mises à jour ensuite : bash scripts/deploy-pm2.sh"
