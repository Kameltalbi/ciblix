import { processDueResolutions, weeklyNeedsReviewRetry } from './contactResolution.js';
import { purgeExpiredRawContent } from './purgeRawContent.js';

const TICK_MS = 60_000;
const DAY_MS = 86_400_000;

let intervalId: ReturnType<typeof setInterval> | null = null;
let lastDailyPurge = 0;
let lastWeeklyRetry = 0;

async function tickOnce(): Promise<void> {
  try {
    await processDueResolutions(30);
  } catch (err) {
    console.warn('[agent-memory-scheduler] resolution tick', err);
  }

  const now = Date.now();
  if (now - lastDailyPurge > DAY_MS) {
    lastDailyPurge = now;
    try {
      let purged = 0;
      do {
        purged = await purgeExpiredRawContent(50);
      } while (purged === 50);
    } catch (err) {
      console.warn('[agent-memory-scheduler] purge tick', err);
    }
  }

  if (now - lastWeeklyRetry > 7 * DAY_MS) {
    lastWeeklyRetry = now;
    try {
      await weeklyNeedsReviewRetry();
    } catch (err) {
      console.warn('[agent-memory-scheduler] weekly retry', err);
    }
  }
}

export function startAgentMemoryScheduler(): void {
  if (process.env.AGENT_MEMORY_SCHEDULER_DISABLED === '1') return;
  if (intervalId) return;

  console.log('[agent-memory-scheduler] actif (tick 60s)');
  void tickOnce();
  intervalId = setInterval(() => void tickOnce(), TICK_MS);
}
