import { describe, expect, it } from 'vitest';
import {
  hasMissionLock,
  missionLockKey,
  releaseMissionLock,
  runningMissions,
  tryAcquireMissionLock,
} from './orchestratorLocks.js';

describe('orchestrator runningMissions verrou', () => {
  it('une mission déjà en cours ne peut pas être relancée', () => {
    runningMissions.clear();
    expect(tryAcquireMissionLock('org_123', 'FIND_COMPANIES')).toBe(true);
    expect(tryAcquireMissionLock('org_123', 'FIND_COMPANIES')).toBe(false);
    expect(hasMissionLock('org_123', 'FIND_COMPANIES')).toBe(true);
    expect(hasMissionLock('org_123', 'WATCH_SIGNALS')).toBe(false);
    releaseMissionLock('org_123', 'FIND_COMPANIES');
    expect(tryAcquireMissionLock('org_123', 'FIND_COMPANIES')).toBe(true);
    releaseMissionLock('org_123', 'FIND_COMPANIES');
  });

  it('clés distinctes par org et kind', () => {
    expect(missionLockKey('a', 'FIND_COMPANIES')).not.toBe(missionLockKey('b', 'FIND_COMPANIES'));
    expect(missionLockKey('a', 'FIND_COMPANIES')).not.toBe(missionLockKey('a', 'WATCH_SIGNALS'));
  });
});
