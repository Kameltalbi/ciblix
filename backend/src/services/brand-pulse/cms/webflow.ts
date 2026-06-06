import { markdownToBasicHtml } from '../markdown.js';

/** Phase 4 — publication Webflow CMS API. */
export async function publishToWebflow(params: {
  apiToken: string;
  collectionId: string;
  title: string;
  content: string;
  slug?: string;
  isDraft?: boolean;
}): Promise<{ itemId: string }> {
  const html = markdownToBasicHtml(params.content);
  const res = await fetch(`https://api.webflow.com/v2/collections/${params.collectionId}/items`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${params.apiToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      isArchived: false,
      isDraft: params.isDraft ?? true,
      fieldData: {
        name: params.title,
        slug: params.slug || params.title.toLowerCase().replace(/\s+/g, '-'),
        'post-body': html,
      },
    }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`Webflow publish failed: ${await res.text()}`);
  const json = (await res.json()) as { id?: string };
  if (!json.id) throw new Error('Webflow: réponse invalide');
  return { itemId: json.id };
}
