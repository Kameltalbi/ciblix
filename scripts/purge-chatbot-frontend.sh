#!/usr/bin/env bash
# Supprime le chatbot de la home en prod : pull + build + vérif + sync Nginx si besoin.
# Usage sur le VPS : cd /var/www/ciblix && sudo bash scripts/purge-chatbot-frontend.sh
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

echo "=== 1. Code à jour ==="
git fetch origin
git pull origin main
echo "Commit: $(git log -1 --oneline)"

echo ""
echo "=== 2. Build frontend ==="
npm run build -w bilan-crm-frontend

DIST="$REPO_ROOT/frontend/dist"
if grep -rq "Chatbot onboarding" "$DIST" 2>/dev/null; then
  echo "ERREUR: le build contient encore « Chatbot onboarding »." >&2
  exit 1
fi
echo "OK: aucun chatbot dans $DIST"

echo ""
echo "=== 3. Dossier servi par Nginx ==="
NGINX_ROOT=""
if command -v nginx >/dev/null 2>&1; then
  NGINX_ROOT=$(nginx -T 2>/dev/null | grep -E '^\s*root\s+' | grep -v internal | head -1 | awk '{print $2}' | tr -d ';' || true)
fi
echo "Nginx root détecté : ${NGINX_ROOT:-non trouvé}"

SERVE_ROOT="${NGINX_ROOT:-$DIST}"
if [ "$SERVE_ROOT" != "$DIST" ] && [ -d "$SERVE_ROOT" ]; then
  echo ""
  echo "=== 4. Copie dist → $SERVE_ROOT (Nginx ne lit pas frontend/dist) ==="
  rsync -a --delete "$DIST/" "$SERVE_ROOT/"
  if grep -rq "Chatbot onboarding" "$SERVE_ROOT" 2>/dev/null; then
    echo "ERREUR: $SERVE_ROOT contient encore le chatbot." >&2
    exit 1
  fi
  echo "OK: fichiers copiés vers $SERVE_ROOT"
else
  echo ""
  echo "=== 4. Pas de copie (Nginx pointe vers frontend/dist ou root inconnu) ==="
fi

if command -v nginx >/dev/null 2>&1; then
  nginx -t
  systemctl reload nginx 2>/dev/null || service nginx reload 2>/dev/null || true
fi

echo ""
echo "=== 5. Test en ligne (doit afficher NOT_FOUND) ==="
JS=$(curl -sfL "https://ciblix.com/" | grep -oE 'assets/index-[^"]+\.js' | head -1 || true)
if [ -n "$JS" ]; then
  if curl -sfL "https://ciblix.com/$JS" | grep -q "Chatbot onboarding"; then
    echo "ATTENTION: le site public sert ENCORE l’ancien JS ($JS)."
    echo "Videz le cache CDN/navigateur ou vérifiez un autre serveur derrière le domaine."
  else
    echo "OK: https://ciblix.com/$JS — chatbot absent."
  fi
fi

echo ""
echo "Terminé. Sur votre Mac : navigation privée ou Ctrl+Shift+R sur ciblix.com"
