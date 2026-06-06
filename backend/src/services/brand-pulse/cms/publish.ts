import { decryptJson } from '../../../lib/encryption.js';
import { publishToWordPress } from './wordpress.js';
import { publishToGhost } from './ghost.js';
import { publishToWebflow } from './webflow.js';
import { publishToShopifyBlog } from './shopify.js';
import { publishToWix } from './wix.js';

type CmsRow = {
  platform: string;
  encryptedConfig: string;
  defaultStatus: string;
};

export async function publishArticleToCms(
  connection: CmsRow,
  article: { title: string; contentMarkdown: string; slug?: string | null },
): Promise<{ url: string; platform: string; externalId: string }> {
  const config = decryptJson<Record<string, string>>(connection.encryptedConfig);
  const title = article.title;
  const content = article.contentMarkdown;
  const slug = article.slug || undefined;

  switch (connection.platform) {
    case 'WORDPRESS': {
      const status = connection.defaultStatus === 'publish' ? 'publish' : 'draft';
      const r = await publishToWordPress({
        siteUrl: config.siteUrl || '',
        username: config.username || '',
        appPassword: config.appPassword || '',
        title,
        content,
        status,
        slug,
      });
      return { url: r.url, platform: 'WORDPRESS', externalId: String(r.postId) };
    }
    case 'GHOST': {
      const status = connection.defaultStatus === 'publish' ? 'published' : 'draft';
      const r = await publishToGhost({
        adminApiUrl: config.adminApiUrl || '',
        adminApiKey: config.adminApiKey || '',
        title,
        content,
        status,
        slug,
      });
      return { url: r.url, platform: 'GHOST', externalId: r.postId };
    }
    case 'WEBFLOW': {
      const r = await publishToWebflow({
        apiToken: config.apiToken || '',
        collectionId: config.collectionId || '',
        title,
        content,
        slug,
        isDraft: connection.defaultStatus !== 'publish',
      });
      return { url: '', platform: 'WEBFLOW', externalId: r.itemId };
    }
    case 'SHOPIFY': {
      const r = await publishToShopifyBlog({
        shopDomain: config.shopDomain || '',
        accessToken: config.accessToken || '',
        blogId: config.blogId || '',
        title,
        content,
        published: connection.defaultStatus === 'publish',
      });
      return { url: r.url, platform: 'SHOPIFY', externalId: String(r.articleId) };
    }
    case 'WIX': {
      const r = await publishToWix({
        apiKey: config.apiKey || '',
        siteId: config.siteId || '',
        title,
        content,
        publish: connection.defaultStatus === 'publish',
      });
      return { url: '', platform: 'WIX', externalId: r.postId };
    }
    case 'MANUAL': {
      const note = config.note || 'Publication manuelle';
      return { url: config.websiteUrl || '', platform: 'MANUAL', externalId: note };
    }
    default:
      throw new Error(`Plateforme CMS non supportée: ${connection.platform}`);
  }
}
