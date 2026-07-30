import { prisma } from '../../db/prisma.js';
import { runWithRlsContextAsync } from '../../db/rlsContext.js';
import type { CompanySearchCriteria } from './types.js';
import { importProspectsFromSearch } from './importProspectsFromSearch.js';
import { qualifyFoundBatchForOrganization } from './qualifyFoundBatchOrg.js';

const TICK_MS = 60_000;
const RUN_LOCK = new Set<string>();

function addHours(base: Date, hours: number): Date {
  return new Date(base.getTime() + hours * 3600_000);
}

/** Calcule une date de prochaine fenêtre stable (pas dans le passé trop loin si décalage). */
function scheduleNextFrom(now: Date, intervalHours: number): Date {
  return addHours(now, intervalHours);
}

async function tickOnce(): Promise<void> {
  if (
    process.env.PROSPECTING_AUTOMATION_DISABLED === '1' ||
    process.env.PROSPECTING_AUTOMATION_DISABLED === 'true'
  ) {
    return;
  }

  const { withRlsBypass } = await import('../referentiel/tenantIsolation.js');

  await withRlsBypass(async () => {
    const now = new Date();
    const jobs = await prisma.prospectingAutomation.findMany({
      where: {
        active: true,
        nextRunAt: { lte: now },
        organization: {
          suspended: false,
        },
      },
      take: 50,
      orderBy: { nextRunAt: 'asc' },
    });

    for (const job of jobs) {
      if (RUN_LOCK.has(job.id)) continue;
      RUN_LOCK.add(job.id);
      try {
        await runWithRlsContextAsync(
          { type: 'tenant', organizationId: job.organizationId },
          async () => {
            const criteria = job.criteria as unknown as CompanySearchCriteria;
            const imp = await importProspectsFromSearch(job.organizationId, criteria, {
              refresh: job.refreshCache,
              importMax: job.maxNewPerRun,
            });

            let qualifiedTotal = 0;
            if (job.qualifyAfterSearch && imp.count > 0) {
              const { qualifiedCount } = await qualifyFoundBatchForOrganization(
                job.organizationId,
                Math.min(120, Math.max(10, job.maxNewPerRun))
              );
              qualifiedTotal = qualifiedCount;
            }

            const next = scheduleNextFrom(new Date(), job.intervalHours);
            await prisma.prospectingAutomation.update({
              where: { id: job.id },
              data: {
                lastRunAt: new Date(),
                lastRunImported: imp.count,
                lastRunQualified: job.qualifyAfterSearch ? qualifiedTotal : null,
                lastRunError: null,
                nextRunAt: next,
              },
            });
          }
        );
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error('[prospecting-automation]', job.organizationId, msg);
        await prisma.prospectingAutomation.update({
          where: { id: job.id },
          data: {
            lastRunError: msg.slice(0, 4000),
            lastRunAt: new Date(),
            nextRunAt: scheduleNextFrom(new Date(), job.intervalHours),
          },
        });
      } finally {
        RUN_LOCK.delete(job.id);
      }
    }
  });
}

let intervalId: ReturnType<typeof setInterval> | null = null;

export function startProspectingAutomationScheduler(): void {
  if (intervalId) return;
  console.log('[prospecting-automation] scheduler actif (tick 60s)');
  void tickOnce();
  intervalId = setInterval(() => {
    void tickOnce();
  }, TICK_MS);
}
