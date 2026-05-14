# 🌿 Bilan CRM — Gestion Bilan Carbone & Formations

CRM moderne solo avec intégration Softfacture et Gmail, pour la gestion des affaires de bilan carbone et formations en Tunisie.

## 📋 Stack technique

**Frontend (même stack que Softfacture pour cohérence)**
- React 18 + TypeScript 5
- Vite 5
- Tailwind CSS v3 + shadcn/ui
- @react-pdf/renderer

**Backend**
- Node.js + Express + TypeScript
- Prisma ORM
- PostgreSQL 16
- JWT auth
- Google APIs (Gmail)

**Déploiement production (VPS, sans Docker)**  
**PM2** pour l’API Node, **build Vite** (`frontend/dist`) derrière **Nginx** ou **Caddy**. Script : `bash scripts/deploy-pm2.sh` ou `npm run deploy` à la racine du clone.  
**Docker** (`docker compose`) : **uniquement pour le développement local**, pas pour la prod décrite dans [docs/DEPLOIEMENT.md](docs/DEPLOIEMENT.md).

## 🚀 Quick start local

```bash
# 1. Cloner le repo
git clone git@github.com:TON-USER/bilan-crm.git
cd bilan-crm

# 2. Copier les variables d'environnement
cp .env.example .env
# Éditer .env avec tes valeurs

# 3. Démarrer avec Docker
docker compose up -d

# 4. Créer la base de données
docker compose exec backend npx prisma migrate deploy
docker compose exec backend npx prisma db seed

# 5. Accéder à l'app
# http://localhost:3000 (frontend)
# http://localhost:4000/api (backend)
```

## Déploiement sur VPS (PM2)

1. Première fois : `bash scripts/setup-vps.sh` puis suivre [docs/DEPLOIEMENT.md](docs/DEPLOIEMENT.md).  
2. Mises à jour : à la racine du clone, `npm run deploy` (équivalent à `bash scripts/deploy-pm2.sh`).

Pour une stack **Docker** en prod (non décrite par défaut dans ce README) : `npm run deploy:docker`.

## 📚 Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [API Softfacture](docs/API_SOFTFACTURE.md)
- [Intégration Gmail](docs/GMAIL.md)
- [Déploiement](docs/DEPLOIEMENT.md)

## 🗂 Structure du projet

```
bilan-crm/
├── frontend/              # React + Vite
│   ├── src/
│   │   ├── components/    # UI composants
│   │   ├── pages/         # Dashboard, Affaires, Devis, Prévisionnel
│   │   ├── lib/           # API client, utils
│   │   └── hooks/         # Custom hooks
│   └── Dockerfile
│
├── backend/               # Node.js + Express
│   ├── src/
│   │   ├── routes/        # Express routes
│   │   ├── controllers/   # Logique métier
│   │   ├── services/      # Softfacture, Gmail, etc.
│   │   ├── middleware/    # Auth, validation
│   │   └── db/            # Prisma client
│   ├── prisma/            # Schema + migrations
│   └── Dockerfile
│
├── docker-compose.yml     # Dev local
├── docker-compose.prod.yml # Production
├── Caddyfile              # Reverse proxy + SSL
└── docs/                  # Documentation
```

## 📝 Fonctionnalités

### ✅ Phase 1 — MVP (on le fait maintenant)
- [x] Gestion des affaires (CRUD)
- [x] Pipeline Kanban (Prospection → Pipeline → Réalisé)
- [x] Commission partenaire 40% HT
- [x] Prévisionnel mensuel sur 3 ans
- [x] KPIs temps réel
- [x] Auth JWT

### 🔄 Phase 2 — Intégrations
- [ ] API Softfacture (création devis/factures)
- [ ] Gmail (envoi de factures)

### 🎯 Phase 3 — Avancé
- [ ] Notifications
- [ ] Export Excel
- [ ] Rapports fiscaux

## 🔐 Sécurité

- JWT avec rotation
- Passwords bcrypt
- HTTPS forcé en production
- Variables sensibles en .env (jamais committées)
- Rate limiting sur l'API
