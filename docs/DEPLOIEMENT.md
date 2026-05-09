# Guide de déploiement — Bilan CRM

Déploiement sur VPS (Ubuntu) via **Git**, build **Vite** du frontend et **PM2**.  
Les fichiers `docker-compose*.yml` à la racine servent au **développement local** uniquement ; ce guide ne les utilise pas pour la mise en production.

## Prérequis

- VPS avec accès SSH
- Nom de domaine pointé vers le VPS (ex. `crm.tondomaine.com`)
- **Node.js** LTS (ex. 20.x), **npm**, **PM2** (`npm i -g pm2`)
- Repo cloné sur le serveur (exemple ci-dessous : `/var/www/crm`)
- Variables d’environnement (`.env`) pour le backend et le build frontend si besoin
- OAuth Gmail configuré si tu l’utilises : [GMAIL.md](GMAIL.md)

---

## 1. Première installation sur le VPS

### Connexion et dépôt

```bash
ssh tonuser@ton-ip-vps
sudo mkdir -p /var/www/crm
sudo chown $USER:$USER /var/www/crm
cd /var/www/crm
git clone git@github.com:TON-USER/crm.git .
# ou adapte l’URL / le dossier à ton organisation
```

### Variables d’environnement

```bash
cp .env.example .env
nano .env
```

Renseigne au minimum ce qui concerne PostgreSQL, JWT, URLs (`FRONTEND_URL`, domaine API), Softfacture, Google OAuth si applicable (voir [GMAIL.md](GMAIL.md)).

Générer un secret :

```bash
openssl rand -base64 32
```

### Backend (Node + Prisma)

À adapter selon la façon dont tu lances l’API sur le serveur (PM2, systemd, etc.) :

```bash
cd /var/www/crm/backend
npm ci
npx prisma migrate deploy
# pm2 start ecosystem.config.cjs   # si tu utilises PM2 pour le backend
```

### Frontend (build statique + PM2)

```bash
cd /var/www/crm/frontend
npm ci
npm run build
# pm2 start …   # une première fois, selon ta config (nom du process : souvent « frontend »)
```

Configure **Caddy** ou **Nginx** devant le front (fichiers servis depuis `frontend/dist`) et le reverse proxy vers l’API ; obtention du certificat TLS selon ton choix (Let’s Encrypt, etc.).

---

## 2. DNS

Chez ton registrar, enregistrement **A** :

```text
crm.tondomaine.com  →  IP-du-VPS
```

Vérification :

```bash
dig crm.tondomaine.com
```

---

## 3. Mises à jour (production)

Après un `git push` sur `main`, sur le VPS :

```bash
cd /var/www/crm && git pull origin main && cd frontend && npm run build && pm2 restart frontend
```

Si le backend a changé (dépendances, migrations, code), après le même `git pull` à la racine :

```bash
cd /var/www/crm/backend
npm ci
npx prisma migrate deploy
pm2 restart backend   # adapte le nom du processus PM2
```

---

## 4. Commandes utiles (PM2)

```bash
pm2 status
pm2 logs frontend
pm2 restart frontend
```

---

## 5. Sécurité et sauvegardes

- Changer le mot de passe admin après la première connexion.
- Sauvegardes PostgreSQL : `pg_dump` (cron quotidien vers un répertoire dédié, idéalement hors du serveur).

---

## 6. Dépannage

- **Page blanche / ancien bundle** : revérifier `npm run build` dans `frontend/` et `pm2 restart frontend`.
- **Erreurs API** : logs PM2 du process backend, variables `.env`, migrations Prisma à jour.
- **SSL** : vérifier DNS, ports 80/443 ouverts, configuration du reverse proxy.

---

## Développement local (Docker)

Pour lancer **tout l’environnement en local** sans installer Node/Postgres sur ta machine, tu peux utiliser à la racine du repo :

```bash
docker compose up -d
```

Voir le [README](../README.md) section Quick start. Ce n’est **pas** le flux de déploiement VPS décrit ci-dessus.
