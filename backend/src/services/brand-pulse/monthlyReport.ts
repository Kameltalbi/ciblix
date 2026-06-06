import { prisma } from '../../db/prisma.js';
import { getActiveBrandProfile } from './brandProfile.js';

/** Phase 7 — rapport mensuel HTML (export PDF via navigateur). */
export async function buildMonthlyReportHtml(organizationId: string, brandProfileId?: string): Promise<string> {
  const profile = brandProfileId
    ? await prisma.brandProfile.findFirst({ where: { id: brandProfileId, organizationId } })
    : await getActiveBrandProfile(organizationId);
  if (!profile) throw Object.assign(new Error('Profil marque introuvable'), { statusCode: 404 });

  const scope = { organizationId, brandProfileId: profile.id };
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [channels, articles, recommendations, alerts] = await Promise.all([
    prisma.brandScoreSnapshot.findMany({
      where: { ...scope, computedAt: { gte: monthStart } },
      orderBy: { computedAt: 'desc' },
      take: 30,
    }),
    prisma.brandArticle.findMany({
      where: { ...scope, createdAt: { gte: monthStart } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.brandRecommendation.findMany({
      where: { ...scope, active: true },
      take: 6,
    }),
    prisma.brandAlert.findMany({
      where: { ...scope, createdAt: { gte: monthStart } },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
  ]);

  const global = channels.find((c) => c.channel === 'GLOBAL');

  const channelRows = ['SEO', 'SOCIAL', 'REVIEWS', 'PRESS', 'LLM', 'WEBSITE']
    .map((ch) => {
      const row = channels.find((c) => c.channel === ch);
      return `<tr><td>${ch}</td><td>${row?.score ?? '—'}/100</td></tr>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <title>Rapport BrandPulse — ${profile.brandName}</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 800px; margin: 2rem auto; color: #111; }
    h1 { color: #e11d48; }
    table { width: 100%; border-collapse: collapse; margin: 1rem 0; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background: #fdf2f8; }
    @media print { body { margin: 1cm; } }
  </style>
</head>
<body>
  <h1>BrandPulse AI — Rapport mensuel</h1>
  <p><strong>Marque :</strong> ${profile.brandName}<br>
  <strong>Période :</strong> ${monthStart.toLocaleDateString('fr-FR')} → ${now.toLocaleDateString('fr-FR')}</p>
  <h2>Score global</h2>
  <p style="font-size:2rem;font-weight:bold;">${global?.score ?? '—'}/100</p>
  <h2>Scores par canal</h2>
  <table><thead><tr><th>Canal</th><th>Score</th></tr></thead><tbody>${channelRows}</tbody></table>
  <h2>Articles (${articles.length})</h2>
  <ul>${articles.map((a) => `<li>${a.title || 'Sans titre'} — ${a.status}</li>`).join('') || '<li>Aucun</li>'}</ul>
  <h2>Recommandations</h2>
  <ul>${recommendations.map((r) => `<li>${r.action} (+${r.estimatedImpact} pts)</li>`).join('') || '<li>Aucune</li>'}</ul>
  <h2>Alertes du mois</h2>
  <ul>${alerts.map((a) => `<li>[${a.severity}] ${a.message}</li>`).join('') || '<li>Aucune</li>'}</ul>
  <p style="margin-top:2rem;color:#666;font-size:0.85rem;">Généré par CIBLIX BrandPulse AI</p>
</body>
</html>`;
}
