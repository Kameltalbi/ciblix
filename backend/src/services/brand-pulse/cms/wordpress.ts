import { markdownToBasicHtml } from '../markdown.js';

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

export async function publishToWordPress(params: {
  siteUrl: string;
  username: string;
  appPassword: string;
  title: string;
  content: string;
  status: 'draft' | 'publish';
  slug?: string;
}): Promise<{ url: string; postId: number }> {
  const base = params.siteUrl.replace(/\/$/, '');
  const auth = Buffer.from(`${params.username}:${params.appPassword}`).toString('base64');
  const html = markdownToBasicHtml(params.content);

  const res = await fetch(`${base}/wp-json/wp/v2/posts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${auth}`,
    },
    body: JSON.stringify({
      title: params.title,
      content: html,
      status: params.status,
      slug: params.slug,
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) {
    throw new Error(`WordPress publish failed: ${await res.text()}`);
  }

  const json = (await res.json()) as { id: number; link?: string };
  return { postId: json.id, url: json.link || `${base}/?p=${json.id}` };
}
