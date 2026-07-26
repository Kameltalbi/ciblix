/**
 * Heartbeats process — pour /api/health et alerting uptime.
 * Mis à jour par les schedulers (pas de Redis requis).
 */

type HeartbeatKey =
  | 'agentMemory'
  | 'agentOrchestrator'
  | 'prospectingAutomation'
  | 'scout'
  | 'relanceResurface';

const beats = new Map<HeartbeatKey, { at: number; detail?: string }>();

export function bumpHeartbeat(key: HeartbeatKey, detail?: string): void {
  beats.set(key, { at: Date.now(), detail });
}

export function getHeartbeats(now = Date.now()): Record<
  string,
  { ageSec: number | null; detail?: string; stale: boolean }
> {
  const out: Record<string, { ageSec: number | null; detail?: string; stale: boolean }> = {};
  const keys: HeartbeatKey[] = [
    'agentMemory',
    'agentOrchestrator',
    'prospectingAutomation',
    'scout',
    'relanceResurface',
  ];
  for (const k of keys) {
    const b = beats.get(k);
    if (!b) {
      out[k] = { ageSec: null, stale: true };
      continue;
    }
    const ageSec = Math.floor((now - b.at) / 1000);
    // stale si > 15 min sans tick (schedulers 60s / daily)
    out[k] = { ageSec, detail: b.detail, stale: ageSec > 15 * 60 };
  }
  return out;
}
