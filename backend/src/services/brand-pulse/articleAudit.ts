import { runSeoAudit } from './seoAudit.js';
import { seoScoreFromAudit } from './seoAudit.js';

/** Phase 4 — audit d'articles existants (liste d'URLs). */
export async function auditExistingArticles(urls: string[]): Promise<
  Array<{
    url: string;
    score: number;
    before: number;
    issues: string[];
    ok: boolean;
  }>
> {
  const unique = [...new Set(urls.map((u) => u.trim()).filter(Boolean))].slice(0, 20);
  const results = [];

  for (const url of unique) {
    try {
      const audit = await runSeoAudit(url);
      const score = seoScoreFromAudit(audit);
      results.push({
        url,
        score,
        before: score,
        issues: audit.issues,
        ok: true,
      });
    } catch {
      results.push({
        url,
        score: 0,
        before: 0,
        issues: ['URL inaccessible'],
        ok: false,
      });
    }
  }

  return results;
}
