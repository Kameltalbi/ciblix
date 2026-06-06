import { markdownToBasicHtml } from '../markdown.js';

/** Phase 4 — publication Wix Blog API. */
export async function publishToWix(params: {
  apiKey: string;
  siteId: string;
  title: string;
  content: string;
  publish?: boolean;
}): Promise<{ postId: string }> {
  const html = markdownToBasicHtml(params.content);
  const res = await fetch('https://www.wixapis.com/blog/v3/posts', {
    method: 'POST',
    headers: {
      Authorization: params.apiKey,
      'Content-Type': 'application/json',
      'wix-site-id': params.siteId,
    },
    body: JSON.stringify({
      post: {
        title: params.title,
        richContent: { nodes: [{ type: 'HTML', htmlData: { html } }] },
        publishStatus: params.publish ? 'PUBLISHED' : 'DRAFT',
      },
    }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`Wix publish failed: ${await res.text()}`);
  const json = (await res.json()) as { post?: { id?: string } };
  if (!json.post?.id) throw new Error('Wix: réponse invalide');
  return { postId: json.post.id };
}
