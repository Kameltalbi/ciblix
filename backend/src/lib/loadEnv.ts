import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Charge `.env` sans paquet `dotenv` (évite ERR_MODULE_NOT_FOUND en prod si
 * node_modules workspace est uniquement à la racine du monorepo).
 * Ne remplace pas une variable déjà définie dans l’environnement.
 */
export function loadEnvFromFile(): void {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    resolve(here, '../../.env'),
    resolve(here, '../../../.env'),
    resolve(here, '../.env'),
    resolve(process.cwd(), '.env'),
  ];
  for (const p of candidates) {
    if (!existsSync(p)) continue;
    applyEnvFile(readFileSync(p, 'utf8'));
    return;
  }
}

function applyEnvFile(raw: string): void {
  for (let line of raw.split('\n')) {
    line = line.replace(/\r$/, '');
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    let val = line.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}
