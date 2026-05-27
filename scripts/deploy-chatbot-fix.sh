#!/usr/bin/env bash
# Déploiement ciblé chatbot home — à lancer sur le VPS : bash scripts/deploy-chatbot-fix.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "=== Chatbot home — déploiement ==="
git fetch origin
git pull origin main
echo "Commit: $(git log -1 --oneline)"

echo ""
echo "=== Backend ==="
cd "$ROOT/backend"
npm run build
pm2 restart backend --update-env
sleep 2

echo ""
echo "=== Test API (doit retourner answer, pas Token manquant) ==="
curl -sf -X POST http://127.0.0.1:4000/api/onboarding-chatbot/query \
  -H "Content-Type: application/json" \
  -d '{"message":"Comment démarrer ?","language":"fr"}' | head -c 200
echo ""

curl -sf http://127.0.0.1:4000/api/onboarding-chatbot/ping
echo ""

echo ""
echo "=== Frontend ==="
cd "$ROOT"
npm run build -w bilan-crm-frontend

if command -v nginx >/dev/null 2>&1; then
  sudo nginx -t && sudo systemctl reload nginx
fi

echo ""
echo "=== OK — videz le cache navigateur (Ctrl+Shift+R) sur la home ==="
