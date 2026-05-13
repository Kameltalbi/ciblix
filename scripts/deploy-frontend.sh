#!/usr/bin/env bash
# Déploie le frontend en production après un changement de code / design.
#
# Problème fréquent : `npm run build` seul écrit dans frontend/dist/ mais le site
# (ktoptima.com) sert encore d'anciens fichiers si :
#   - Docker : l'image `frontend` n'a pas été rebuild + redémarrée ;
#   - Nginx seul : `root` pointe vers un autre dossier (ex. /usr/share/nginx/html)
#     et personne n'a copié dist/ vers ce dossier.
#
# Usage (à la racine du dépôt, ex. /var/www/crm) :
#
#   Docker (recommandé si vous utilisez docker-compose.prod.yml + Caddy) :
#     MODE=docker ./scripts/deploy-frontend.sh
#
#   Fichiers statiques (Nginx `root` = DEPLOY_ROOT) :
#     MODE=static DEPLOY_ROOT=/usr/share/nginx/html ./scripts/deploy-frontend.sh
#
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
COMPOSE_FILE="${COMPOSE_FILE:-$REPO_ROOT/docker-compose.prod.yml}"
MODE="${MODE:-docker}"
DEPLOY_ROOT="${DEPLOY_ROOT:-/usr/share/nginx/html}"

cd "$REPO_ROOT/frontend"
npm ci
npm run build

if [ "$MODE" = "docker" ]; then
  if [ ! -f "$COMPOSE_FILE" ]; then
    echo "Erreur : fichier compose introuvable : $COMPOSE_FILE" >&2
    echo "Utilisez MODE=static ou définissez COMPOSE_FILE=..." >&2
    exit 1
  fi
  echo ">>> Rebuild image Docker frontend + redémarrage..."
  docker compose -f "$COMPOSE_FILE" build frontend
  docker compose -f "$COMPOSE_FILE" up -d frontend
  echo ">>> Terminé. Le conteneur frontend sert la nouvelle image."
  exit 0
fi

if [ "$MODE" = "static" ]; then
  echo ">>> Copie de dist/ vers $DEPLOY_ROOT (rsync --delete)..."
  rsync -a --delete "$REPO_ROOT/frontend/dist/" "$DEPLOY_ROOT/"
  echo ">>> Terminé. Rechargez le site (Ctrl+F5). Si besoin : sudo systemctl reload nginx"
  exit 0
fi

echo "MODE inconnu : $MODE (attendu : docker | static)" >&2
exit 1
