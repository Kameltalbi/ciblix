/** Phase 3 — test connexion WordPress REST API. */
export async function testWordPressConnection(params: {
  siteUrl: string;
  username: string;
  appPassword: string;
}): Promise<boolean> {
  if (!params.siteUrl || !params.username || !params.appPassword) return false;
  const base = params.siteUrl.replace(/\/$/, '');
  const auth = Buffer.from(`${params.username}:${params.appPassword}`).toString('base64');
  try {
    const res = await fetch(`${base}/wp-json/wp/v2/users/me`, {
      headers: { Authorization: `Basic ${auth}` },
      signal: AbortSignal.timeout(15000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Phase 3 — publication WordPress REST API. */
export async function publishToWordPress(_params: {
  siteUrl: string;
  username: string;
  appPassword: string;
  title: string;
  content: string;
  status: 'draft' | 'publish';
}): Promise<{ url: string; postId: number }> {
  throw new Error('Publication WordPress disponible en Phase 3');
}
