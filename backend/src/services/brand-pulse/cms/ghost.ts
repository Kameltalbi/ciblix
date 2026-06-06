import { createHmac } from 'crypto';
import { markdownToBasicHtml } from '../markdown.js';

async function ghostToken(adminApiKey: string): Promise<string> {
  const [id, secret] = adminApiKey.split(':');
  if (!id || !secret) throw new Error('Ghost Admin API key invalide (format id:secret)');
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', kid: id, typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 300,
    aud: '/admin/',
  })).toString('base64url');
  const sig = createHmac('sha256', Buffer.from(secret, 'hex')).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${sig}`;
}

export async function testGhostConnection(params: {
  adminApiUrl: string;
  adminApiKey: string;
}): Promise<boolean> {
  if (!params.adminApiUrl || !params.adminApiKey) return false;
  const base = params.adminApiUrl.replace(/\/$/, '');
  try {
    const token = await ghostToken(params.adminApiKey);
    const res = await fetch(`${base}/ghost/api/admin/site/`, {
      headers: {
        Authorization: `Ghost ${token}`,
        'Accept-Version': 'v5.0',
      },
      signal: AbortSignal.timeout(15000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function publishToGhost(params: {
  adminApiUrl: string;
  adminApiKey: string;
  title: string;
  content: string;
  status: 'draft' | 'published';
  slug?: string;
}): Promise<{ url: string; postId: string }> {
  const base = params.adminApiUrl.replace(/\/$/, '');
  const token = await ghostToken(params.adminApiKey);
  const html = markdownToBasicHtml(params.content);

  const res = await fetch(`${base}/ghost/api/admin/posts/?source=html`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Ghost ${token}`,
      'Accept-Version': 'v5.0',
    },
    body: JSON.stringify({
      posts: [{
        title: params.title,
        html,
        status: params.status,
        slug: params.slug,
      }],
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) {
    throw new Error(`Ghost publish failed: ${await res.text()}`);
  }

  const json = (await res.json()) as { posts?: Array<{ id: string; url?: string }> };
  const post = json.posts?.[0];
  if (!post?.id) throw new Error('Ghost: réponse invalide');
  return { postId: post.id, url: post.url || base };
}
