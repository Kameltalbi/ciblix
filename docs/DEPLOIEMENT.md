# Guide de déploiement — Bilan CRM (VPS, PM2, sans Docker)

Production sur **Ubuntu** avec **Node.js 20**, **PM2** pour l’API, **build Vite** du frontend servi par **Nginx** ou **Caddy**.  
**Docker** n’est pas utilisé en production ; `docker-compose*.yml` sert au **développement local** uniquement.

## Prérequis

- VPS avec SSH, Ubuntu 22.04 / 24.04 recommandé  
- Nom de domaine (ex. `crm.example.com`) en **A** vers l’IP du VPS  
- **PostgreSQL** installé sur le VPS (ou base managée), accès URL + utilisateur  
- Repo cloné sur le serveur (ex. `/var/www/ciblix`)

---

## 1. Première installation sur le VPS

### Option A — Script système (une fois)

Sur le serveur :

```bash
bash scripts/setup-vps.sh
```

Installe Node 20 (NodeSource), PM2, UFW, fail2ban et crée `/var/www/ciblix`. Reconnectez-vous si besoin après les paquets.

### Option B — À la main

Installez Node 20 LTS, `npm`, puis `sudo npm i -g pm2`. Ouvrez les ports **22**, **80**, **443** dans le pare-feu.

### Cloner le projet et variables d’environnement

```bash
sudo mkdir -p /var/www/ciblix
sudo chown $USER:$USER /var/www/ciblix
cd /var/www/ciblix
git clone git@github.com:VOTRE_ORG/ciblix.git .

cp .env.example .env
nano .env
```

Renseignez au minimum : PostgreSQL (`DATABASE_URL`), `JWT_SECRET`, `FRONTEND_URL`, URLs API si besoin, Softfacture, Google OAuth ([GMAIL.md](GMAIL.md)).

Secret JWT :

```bash
openssl rand -base64 32
```

Le backend charge `.env` depuis **`backend/.env`** ou **`.env` à la racine du dépôt** (monorepo).

### Dépendances et build (monorepo)

À la **racine** du clone :

```bash
npm ci
```

### Backend (build + Prisma + PM2)

```bash
cd /var/www/ciblix/backend
npm run build
npx prisma migrate deploy
pm2 start ecosystem.config.cjs
pm2 save
sudo env PATH=$PATH pm2 startup systemd -u $USER --hp $HOME
```

Le process PM2 s’appelle **`backend`** (voir `backend/ecosystem.config.cjs`). Le `cwd` est `backend/` ; les `node_modules` du workspace sont à installer depuis la **racine** avec `npm ci` (déjà fait ci-dessus).

### Frontend (build statique)

```bash
cd /var/www/ciblix
npm run build -w bilan-crm-frontend
```

Les fichiers de prod sont dans **`frontend/dist/`**. Configurez le vhost pour servir ce dossier et proxy `/api` vers l’API Node (port défini dans votre `.env`, souvent **4000** — vérifier `PORT` / `backend`).

### Exemple Nginx (indicatif)

Voir aussi `deploy/nginx-ciblix.conf.example` (redirection **www → apex** + proxy `/api` sans headers CORS Nginx).

```nginx
# www → domaine canonique
server {
  listen 443 ssl http2;
  server_name www.ciblix.com;
  return 301 https://ciblix.com$request_uri;
}

server {
  listen 443 ssl http2;
  server_name ciblix.com;
  root /var/www/ciblix/frontend/dist;
  index index.html;
  location / { try_files $uri $uri/ /index.html; }
  location /api/ {
    proxy_pass http://127.0.0.1:4000/api/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    # Ne pas ajouter Access-Control-* ici — Express gère CORS
  }
}
```

**Env backend (canonique unique) :**

```bash
FRONTEND_URL=https://ciblix.com
# CORS autorise aussi https://www.ciblix.com automatiquement
```

Adaptez le port backend et les certificats TLS (Let’s Encrypt, etc.).

---

## 2. Mises à jour après un `git push`

Sur le VPS, à la racine du dépôt :

```bash
cd /var/www/ciblix && npm run deploy
```

Équivalent :

```bash
bash scripts/deploy-pm2.sh
```

Le script exécute : `git pull`, `npm ci`, build backend + `prisma migrate deploy`, build frontend, `pm2 restart backend`.

---

## 3. Commandes utiles (PM2)

```bash
pm2 status
pm2 logs backend
pm2 restart backend
```

---

## 4. Déploiement du frontend seul (optionnel)

Si vous copiez `dist/` vers un autre répertoire servi par Nginx :

```bash
MODE=static DEPLOY_ROOT=/usr/share/nginx/html bash scripts/deploy-frontend.sh
```

Pour un build local sans copie :

```bash
MODE=build bash scripts/deploy-frontend.sh
```

(`MODE=docker` reste possible uniquement si vous utilisez encore Docker en local ou ailleurs.)

---

## 5. Déploiement Docker (non utilisé pour ce guide)

Pour un environnement basé sur `docker-compose.prod.yml` :

```bash
npm run deploy:docker
```

---

## 6. Sécurité et sauvegardes

- Changer le mot de passe admin après la première connexion.  
- Sauvegardes PostgreSQL : `pg_dump` (cron quotidien, stockage hors serveur si possible).

---

## 7. Dépannage

- **Page blanche / ancien bundle** : `npm run build -w bilan-crm-frontend`, vider cache navigateur, vérifier que `root` Nginx pointe bien vers `frontend/dist`.  
- **Erreurs API** : `pm2 logs backend`, `.env`, `npx prisma migrate deploy`.  
- **SSL** : DNS, ports 80/443, configuration du reverse proxy.

---

## Développement local (Docker)

```bash
docker compose up -d
```

Voir le [README](../README.md). Ce n’est **pas** le flux de production décrit ci-dessus.
