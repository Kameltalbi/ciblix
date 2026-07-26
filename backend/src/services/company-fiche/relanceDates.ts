/** Helpers purs — date_relance → Aujourd’hui (sans Prisma). */

export function todayIso(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

/** true si date_relance (YYYY-MM-DD) est due (≤ aujourd’hui). */
export function isRelanceDue(dateRelance: string | null | undefined, today = todayIso()): boolean {
  if (!dateRelance || !/^\d{4}-\d{2}-\d{2}/.test(dateRelance)) return false;
  return dateRelance.slice(0, 10) <= today;
}

export function formatRelanceFr(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}
