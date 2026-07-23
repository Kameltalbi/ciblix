import { prisma } from '../../db/prisma.js';

const TICK_MS = 15 * 60_000; // toutes les 15 min
const MAX_ORGS_PER_TICK = 3;

let intervalId: ReturnType<typeof setInterval> | null = null;
let running = false;

async function processDueProfiles(): Promise<void> {
  if (running) return;
  running = true;
  try {
    const profiles = await prisma.scoutProfile.findMany({
      where: { autoScanEnabled: true },
      take: 40,
      orderBy: { lastScanAt: 'asc' },
    });

    const due = profiles
      .filter((p) => {
        const intervalH = Math.max(6, Math.min(168, p.scanIntervalH || 24));
        if (!p.lastScanAt) return true;
        return Date.now() - p.lastScanAt.getTime() >= intervalH * 3600_000;
      })
      .slice(0, MAX_ORGS_PER_TICK);

    if (due.length === 0) return;

    const { executeScoutScanAll, notifyScoutHighScores } = await import('../../routes/scout-ai.js');

    for (const profile of due) {
      try {
        console.log(`[scout-scheduler] scan auto org=${profile.organizationId}`);
        const result = await executeScoutScanAll(profile.organizationId);
        await notifyScoutHighScores(profile.organizationId, result.newOpportunities);
        console.log(
          `[scout-scheduler] org=${profile.organizationId} new=${result.newOpportunities.length} raw=${result.totalRaw}`,
        );
      } catch (err) {
        console.warn('[scout-scheduler] scan failed', profile.organizationId, err);
      }
    }
  } finally {
    running = false;
  }
}

export function startScoutScheduler(): void {
  if (process.env.SCOUT_SCHEDULER_DISABLED === '1') return;
  if (intervalId) return;
  console.log('[scout-scheduler] actif (tick 15 min)');
  void processDueProfiles();
  intervalId = setInterval(() => void processDueProfiles(), TICK_MS);
}
