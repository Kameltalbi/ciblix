/** Phase 3 — test connexion Ghost Admin API. */
export async function testGhostConnection(params: {
  adminApiUrl: string;
  adminApiKey: string;
}): Promise<boolean> {
  if (!params.adminApiUrl || !params.adminApiKey) return false;
  const base = params.adminApiUrl.replace(/\/$/, '');
  try {
    const res = await fetch(`${base}/ghost/api/admin/site/`, {
      headers: {
        Authorization: `Ghost ${params.adminApiKey}`,
        'Accept-Version': 'v5.0',
      },
      signal: AbortSignal.timeout(15000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Phase 3 — publication Ghost Admin API. */
export async function publishToGhost(_params: {
  adminApiUrl: string;
  adminApiKey: string;
  title: string;
  content: string;
  status: 'draft' | 'published';
}): Promise<{ url: string; postId: string }> {
  throw new Error('Publication Ghost disponible en Phase 3');
}
