/**
 * PM2 : toujours lancer le backend avec `cwd` = ce dossier (`backend/`)
 * pour que `dist/`, `.env` et Prisma soient les bons.
 *
 *   cd /var/www/crm/backend
 *   npm run build
 *   pm2 start ecosystem.config.cjs
 *   # ou : pm2 restart backend --update-env
 */
module.exports = {
  apps: [
    {
      name: 'backend',
      cwd: __dirname,
      script: 'dist/index.js',
      interpreter: 'node',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
    },
  ],
};
