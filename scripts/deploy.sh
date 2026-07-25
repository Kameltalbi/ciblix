#!/bin/bash
set -e

# ═══════════════════════════════════════════════════════════════
#  SCRIPT DE DÉPLOIEMENT — Bilan CRM
#  Usage : cd /var/www/ciblix && bash scripts/deploy.sh
#  (autrefois documenté sous /opt/bilan-crm)
# ═══════════════════════════════════════════════════════════════

cd "$(dirname "$0")/.."

COMPOSE_FILE="docker-compose.prod.yml"

run_compose() {
  if docker compose version >/dev/null 2>&1; then
    docker compose -f "$COMPOSE_FILE" "$@"
  elif command -v docker-compose >/dev/null 2>&1; then
    docker-compose -f "$COMPOSE_FILE" "$@"
  else
    echo "❌ Docker Compose introuvable." >&2
    echo "   Installez le plugin : apt install docker-compose-plugin (Ubuntu)" >&2
    echo "   Ou le paquet legacy : apt install docker-compose" >&2
    exit 1
  fi
}

echo "🚀 Déploiement Bilan CRM"
echo "════════════════════════════"

# 1. Pull du code
echo ""
echo "📥 Pull Git..."
git pull origin main

# 2. Vérifier .env
if [ ! -f .env ]; then
  echo "❌ Fichier .env manquant. Copie .env.example → .env et remplis-le."
  exit 1
fi

# 3. Build et redémarrer
echo ""
echo "🔨 Build Docker..."
run_compose build --pull

echo ""
echo "🔄 Redémarrage..."
run_compose up -d

# 4. Migrations Prisma (au cas où le schéma a changé)
echo ""
echo "🗄️  Migrations Prisma..."
sleep 5  # Attendre postgres
run_compose exec -T backend npx prisma migrate deploy

# 5. Nettoyer les vieilles images
echo ""
echo "🧹 Nettoyage..."
docker image prune -f

echo ""
echo "✅ Déploiement terminé !"
echo "   Vérifier : (docker compose OU docker-compose) -f $COMPOSE_FILE ps"
