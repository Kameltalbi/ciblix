#!/usr/bin/env bash
set -euo pipefail
# Déploiement production VPS — PM2 (backend) + build Vite (frontend/dist).
# Sans Docker. Prérequis : Node 20 LTS, npm, pm2 global, PostgreSQL, Nginx/Caddy.
#
# Usage (ex.) :
#   cd /var/www/ciblix && bash scripts/deploy-pm2.sh
#
# Avant la 1ère fois :
#   cd /var/www/ciblix && npm ci && cd backend && npm run build && npx prisma migrate deploy
#   cd /var/www/ciblix/backend && pm2 start ecosystem.config.cjs
# Configurez le reverse proxy : root → frontend/dist, /api → http://127.0.0.1:PORT_BACKEND

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "🚀 Déploiement PM2 — Bilan CRM"
echo "════════════════════════════════"

echo ""
echo "📥 git pull…"
git pull origin main

if [ ! -f "$ROOT/.env" ] && [ ! -f "$ROOT/backend/.env" ]; then
  echo "⚠️  Aucun .env trouvé à la racine ni dans backend/. Copiez .env.example → .env (racine ou backend/)." >&2
fi

echo ""
echo "📦 npm ci (workspaces)…"
npm ci

echo ""
echo "🔨 Backend (build + migrations)…"
(
  cd "$ROOT/backend"
  npm run build
  npx prisma migrate deploy
)

echo ""
echo "🔨 Frontend (Vite build → dist/)…"
npm run build -w bilan-crm-frontend

echo ""
echo "♻️  PM2 backend (ecosystem : node dist/bootstrap.js — évite double npm / EADDRINUSE)…"
(
  cd "$ROOT/backend"
  if pm2 describe backend >/dev/null 2>&1; then
    pm2 startOrReload ecosystem.config.cjs --update-env
  else
    pm2 start ecosystem.config.cjs
  fi
)
pm2 save

echo ""
echo "✅ Terminé."
echo "   • API : vérifiez pm2 logs backend"
echo "   • Front : servez frontend/dist/ (Nginx/Caddy). Recharge forcée navigateur si besoin."
