/**
 * PM2 : `cwd` = dossier `backend/` (dist + .env ici).
 *
 * Monorepo npm : installer les deps à la RACINE du repo, sinon des modules
 * peuvent manquer (workspaces → node_modules au parent).
 *
 *   cd /var/www/ciblix && npm ci
 *   cd /var/www/ciblix/backend && npm run build && npx prisma migrate deploy
 *   pm2 start ecosystem.config.cjs
 *   # ou : pm2 restart backend --update-env
 */
module.exports = {
  apps: [
    {
      name: 'backend',
      cwd: __dirname,
      script: 'dist/bootstrap.js',
      interpreter: 'node',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
    },
  ],
};
