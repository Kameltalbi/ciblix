/**
 * Point d’entrée PM2 / production : charge `.env` avant tout autre module
 * (Prisma, Sentry, routes) — évite les problèmes d’ordre ESM + paquet dotenv.
 */
import { loadEnvFromFile } from './lib/loadEnv.js';

loadEnvFromFile();
await import('./index.js');
