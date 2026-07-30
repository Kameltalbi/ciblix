/** Mock prospecting autorisé uniquement en test / flag explicite — jamais en prod silencieux. */
export function allowMockProspecting(): boolean {
  return process.env.PROSPECTING_ALLOW_MOCK === '1' || process.env.NODE_ENV === 'test';
}
