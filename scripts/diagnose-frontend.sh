#!/usr/bin/env bash
# À lancer sur le VPS (racine du dépôt /var/www/crm) pour comprendre pourquoi
# le site affiche encore l’ancienne version après un build.
set -u

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT" || exit 1

echo "========== 1) Build local (hôte) =========="
if [ -f frontend/dist/index.html ]; then
  ls -la frontend/dist/index.html
  echo "--- Références JS dans index.html (1ères lignes) :"
  grep -oE 'assets/[^"]+\.(js|css)' frontend/dist/index.html | head -5
else
  echo "(!) frontend/dist/index.html absent — lancez : cd frontend && npm run build"
fi

echo ""
echo "========== 2) Docker (compose prod) =========="
if command -v docker >/dev/null 2>&1; then
  if [ -f docker-compose.prod.yml ]; then
    docker compose -f docker-compose.prod.yml ps 2>/dev/null || echo "(!) docker compose ps a échoué (droits .env ?)"
    echo "--- Image du service frontend (si tourne) :"
    CID=$(docker compose -f docker-compose.prod.yml ps -q frontend 2>/dev/null || true)
    if [ -n "${CID:-}" ]; then
      docker inspect -f '{{.Image}}' "$CID" 2>/dev/null || true
      echo "--- index.html DANS le conteneur (hash assets) :"
      docker compose -f docker-compose.prod.yml exec -T frontend sh -c 'grep -oE "assets/[^\"]+\\.(js|css)" /usr/share/nginx/html/index.html | head -5' 2>/dev/null || echo "(!) exec frontend impossible"
    else
      echo "(!) Aucun conteneur frontend pour ce compose — le trafic ne passe peut‑être PAS par Docker."
    fi
  else
    echo "(!) docker-compose.prod.yml introuvable"
  fi
else
  echo "(!) docker absent"
fi

echo ""
echo "========== 3) Nginx sur l’hôte (souvent la vraie cause) =========="
if command -v nginx >/dev/null 2>&1; then
  nginx -T 2>/dev/null | grep -E 'server_name|root |proxy_pass|listen' | head -40 || echo "(!) nginx -T impossible (lancer en root)"
else
  echo "(!) binaire nginx absent sur ce serveur"
fi

echo ""
echo "========== 4) Processus sur 80 / 443 =========="
ss -tlnp 2>/dev/null | grep -E ':80 |:443 ' || netstat -tlnp 2>/dev/null | grep -E ':80|:443' || true

echo ""
echo "========== Que faire ensuite =========="
echo "• Si le site utilise Docker (Caddy → frontend) : MODE=docker ./scripts/deploy-frontend.sh"
echo "• Si nginx sert un dossier root=... : MODE=static DEPLOY_ROOT=CE_CHEMIN sudo ./scripts/deploy-frontend.sh"
echo "• Comparez les lignes « assets/… » entre (1) et (2) : si différentes, le conteneur n’est pas à jour ou n’est pas utilisé."
