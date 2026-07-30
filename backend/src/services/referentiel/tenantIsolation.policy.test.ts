import { describe, expect, it } from 'vitest';

/**
 * Spec des politiques RLS (logique testée sans Postgres).
 * Fail-closed : pas de tenant + pas de bypass → refus.
 */
function rlsAllows(opts: {
  bypass: boolean;
  tenantId: string | null;
  rowOrgId: string;
}): boolean {
  if (opts.bypass) return true;
  if (!opts.tenantId) return false;
  return opts.rowOrgId === opts.tenantId;
}

function rlsNullableAllows(opts: {
  bypass: boolean;
  tenantId: string | null;
  rowOrgId: string | null;
}): boolean {
  if (opts.bypass) return true;
  if (opts.rowOrgId == null) return true; // template global
  if (!opts.tenantId) return false;
  return opts.rowOrgId === opts.tenantId;
}

describe('RLS tenant isolation policy logic', () => {
  it('refuse sans tenant ni bypass', () => {
    expect(rlsAllows({ bypass: false, tenantId: null, rowOrgId: 'org-a' })).toBe(false);
    expect(rlsAllows({ bypass: false, tenantId: '', rowOrgId: 'org-a' })).toBe(false);
  });

  it('autorise uniquement le tenant courant', () => {
    expect(rlsAllows({ bypass: false, tenantId: 'org-a', rowOrgId: 'org-a' })).toBe(true);
    expect(rlsAllows({ bypass: false, tenantId: 'org-a', rowOrgId: 'org-b' })).toBe(false);
  });

  it('bypass superadmin / worker', () => {
    expect(rlsAllows({ bypass: true, tenantId: null, rowOrgId: 'org-b' })).toBe(true);
  });

  it('templates globaux (organizationId null) lisibles', () => {
    expect(rlsNullableAllows({ bypass: false, tenantId: 'org-a', rowOrgId: null })).toBe(true);
    expect(rlsNullableAllows({ bypass: false, tenantId: 'org-a', rowOrgId: 'org-b' })).toBe(false);
  });
});
