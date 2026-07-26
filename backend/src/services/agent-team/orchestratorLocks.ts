/**
 * Verrou anti-collision orchestrateur — module sans Prisma (testable à vide).
 */
export const runningMissions = new Set<string>();

export function missionLockKey(organizationId: string, kind: string): string {
  return `${organizationId}:${kind}`;
}

export function tryAcquireMissionLock(organizationId: string, kind: string): boolean {
  const key = missionLockKey(organizationId, kind);
  if (runningMissions.has(key)) return false;
  runningMissions.add(key);
  return true;
}

export function releaseMissionLock(organizationId: string, kind: string): void {
  runningMissions.delete(missionLockKey(organizationId, kind));
}

export function hasMissionLock(organizationId: string, kind: string): boolean {
  return runningMissions.has(missionLockKey(organizationId, kind));
}
