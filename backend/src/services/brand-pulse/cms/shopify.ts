import { markdownToBasicHtml } from '../markdown.js';

/** Phase 4 — publication Shopify Blog API. */
export async function publishToShopifyBlog(params: {
  shopDomain: string;
  accessToken: string;
  blogId: string;
  title: string;
  content: string;
  published?: boolean;
}): Promise<{ articleId: number; url: string }> {
  const base = `https://${params.shopDomain.replace(/^https?:\/\//, '').replace(/\/$/, '')}`;
  const html = markdownToBasicHtml(params.content);
  const res = await fetch(`${base}/admin/api/2024-01/blogs/${params.blogId}/articles.json`, {
    method: 'POST',
    headers: {
      'X-Shopify-Access-Token': params.accessToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      article: {
        title: params.title,
        body_html: html,
        published: params.published ?? false,
      },
    }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`Shopify publish failed: ${await res.text()}`);
  const json = (await res.json()) as { article?: { id: number; url?: string } };
  if (!json.article?.id) throw new Error('Shopify: réponse invalide');
  return { articleId: json.article.id, url: json.article.url || base };
}
