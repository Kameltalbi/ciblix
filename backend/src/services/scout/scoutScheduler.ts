import { prisma } from '../../db/prisma.js';
import { runWithRlsContextAsync } from '../../db/rlsContext.js';

const TICK_MS = 15 * 60_000;
const MAX_ORGS_PER_TICK = 3;

let intervalId: ReturnType<typeof setInterval> | null = null;
let running = false;

async function processDueProfiles(): Promise<void> {
  if (running) return;
  running = true;
  try {
    const due = await runWithRlsContextAsync({ type: 'bypass' }, async () => {
      const profiles = await prisma.scoutProfile.findMany({
        where: {
          autoScanEnabled: true,
          organization: {
            suspended: false,
            targetingProfile: {
              missionStatus: 'ACTIVE',
              missionCompletedAt: { not: null },
              orchestratorEnabled: true,
            },
          },
        },
        take: 40,
        orderBy: { lastScanAt: 'asc' },
      });

      return profiles
        .filter((p) => {
          const intervalH = Math.max(6, Math.min(168, p.scanIntervalH || 24));
          if (!p.lastScanAt) return true;
          return Date.now() - p.lastScanAt.getTime() >= intervalH * 3600_000;
        })
        .slice(0, MAX_ORGS_PER_TICK);
    });

    if (due.length === 0) return;

    const { executeScoutScanAll, notifyScoutHighScores } = await import('../../routes/scout-ai.js');
    const { handoffScoutSignalsToHunt } = await import('../agent-team/scoutHandoff.js');

    for (const profile of due) {
      try {
        await runWithRlsContextAsync(
          { type: 'tenant', organizationId: profile.organizationId },
          async () => {
            console.log(`[scout-scheduler] scan auto org=${profile.organizationId}`);
            const result = await executeScoutScanAll(profile.organizationId);
            await notifyScoutHighScores(profile.organizationId, result.newOpportunities);
            await handoffScoutSignalsToHunt(profile.organizationId, result.newOpportunities);
            console.log(
              `[scout-scheduler] org=${profile.organizationId} new=${result.newOpportunities.length} raw=${result.totalRaw}`
            );
          }
        );
      } catch (err) {
        console.warn('[scout-scheduler] scan failed', profile.organizationId, err);
      }
    }
  } catch (err) {
    console.warn('[scout-scheduler] tick failed', err);
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
