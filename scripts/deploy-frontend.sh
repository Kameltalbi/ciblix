#!/usr/bin/env bash
# Déploie le frontend en production après un changement de code / design.
#
# Usage (à la racine du dépôt, ex. /var/www/ciblix) :
#
#   PM2 / Nginx (build seul → frontend/dist, défaut) :
#     ./scripts/deploy-frontend.sh
#     # ou explicitement : MODE=build ./scripts/deploy-frontend.sh
#
#   Copie vers un autre root Nginx :
#     MODE=static DEPLOY_ROOT=/usr/share/nginx/html ./scripts/deploy-frontend.sh
#
#   Docker (dev ou stack compose prod) :
#     MODE=docker ./scripts/deploy-frontend.sh
#
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
COMPOSE_FILE="${COMPOSE_FILE:-$REPO_ROOT/docker-compose.prod.yml}"
MODE="${MODE:-build}"
DEPLOY_ROOT="${DEPLOY_ROOT:-/usr/share/nginx/html}"

cd "$REPO_ROOT/frontend"
npm ci
npm run build

if [ "$MODE" = "build" ]; then
  echo ">>> Build terminé : $REPO_ROOT/frontend/dist/"
  echo "    Si Nginx pointe déjà vers ce dossier : rechargez le site (Ctrl+F5)."
  echo "    Sinon : MODE=static DEPLOY_ROOT=... ou utilisez npm run deploy (racine)."
  exit 0
fi

if [ "$MODE" = "docker" ]; then
  if [ ! -f "$COMPOSE_FILE" ]; then
    echo "Erreur : fichier compose introuvable : $COMPOSE_FILE" >&2
    echo "Utilisez MODE=build ou MODE=static." >&2
    exit 1
  fi
  echo ">>> Rebuild image Docker frontend (sans cache) + redémarrage..."
  echo "    Compose: $COMPOSE_FILE"
  docker compose -f "$COMPOSE_FILE" build --no-cache frontend
  docker compose -f "$COMPOSE_FILE" up -d frontend
  echo ">>> Conteneurs :"
  docker compose -f "$COMPOSE_FILE" ps frontend 2>/dev/null || true
  echo ">>> Terminé."
  exit 0
fi

if [ "$MODE" = "static" ]; then
  echo ">>> Copie de dist/ vers $DEPLOY_ROOT (rsync --delete)..."
  rsync -a --delete "$REPO_ROOT/frontend/dist/" "$DEPLOY_ROOT/"
  echo ">>> Terminé. Rechargez le site (Ctrl+F5). Si besoin : sudo systemctl reload nginx"
  exit 0
fi

echo "MODE inconnu : $MODE (attendu : build | static | docker)" >&2
exit 1
