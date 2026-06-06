import PDFDocument from 'pdfkit';
import { prisma } from '../../db/prisma.js';
import { getActiveBrandProfile } from './brandProfile.js';

/** Rapport mensuel PDF brandé (génération serveur). */
export async function buildMonthlyReportPdf(
  organizationId: string,
  brandProfileId?: string,
): Promise<Buffer> {
  const profile = brandProfileId
    ? await prisma.brandProfile.findFirst({ where: { id: brandProfileId, organizationId } })
    : await getActiveBrandProfile(organizationId);
  if (!profile) throw Object.assign(new Error('Profil marque introuvable'), { statusCode: 404 });

  const scope = { organizationId, brandProfileId: profile.id };
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [channels, articles, recommendations, alerts, globalRow] = await Promise.all([
    prisma.brandScoreSnapshot.findMany({
      where: { ...scope, computedAt: { gte: monthStart } },
      orderBy: { computedAt: 'desc' },
      take: 30,
    }),
    prisma.brandArticle.findMany({
      where: { ...scope, createdAt: { gte: monthStart } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.brandRecommendation.findMany({ where: { ...scope, active: true }, take: 6 }),
    prisma.brandAlert.findMany({
      where: { ...scope, createdAt: { gte: monthStart } },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
    prisma.brandScoreSnapshot.findFirst({
      where: { ...scope, channel: 'GLOBAL' },
      orderBy: { computedAt: 'desc' },
    }),
  ]);

  const publishedWithImpact = articles.filter((a) => a.status === 'PUBLISHED' && a.impactSeoDelta != null);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (c) => chunks.push(c as Buffer));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fillColor('#e11d48').fontSize(22).text('BrandPulse AI', { align: 'left' });
    doc.fillColor('#111').fontSize(14).text('Rapport mensuel', { align: 'left' });
    doc.moveDown(0.5);
    doc.fontSize(11).fillColor('#444');
    doc.text(`Marque : ${profile.brandName}`);
    doc.text(`Période : ${monthStart.toLocaleDateString('fr-FR')} → ${now.toLocaleDateString('fr-FR')}`);
    doc.moveDown();

    doc.fillColor('#e11d48').fontSize(16).text('Score global');
    doc.fillColor('#111').fontSize(28).text(`${globalRow?.score ?? '—'}/100`);
    doc.moveDown();

    doc.fillColor('#e11d48').fontSize(14).text('Scores par canal');
    doc.fontSize(10).fillColor('#111');
    for (const ch of ['SEO', 'SOCIAL', 'REVIEWS', 'PRESS', 'LLM', 'WEBSITE']) {
      const row = channels.find((c) => c.channel === ch);
      doc.text(`${ch} : ${row?.score ?? '—'}/100`);
    }
    doc.moveDown();

    doc.fillColor('#e11d48').fontSize(14).text(`Articles du mois (${articles.length})`);
    doc.fontSize(10).fillColor('#111');
    if (articles.length === 0) {
      doc.text('Aucun article ce mois-ci.');
    } else {
      for (const a of articles.slice(0, 12)) {
        const impact =
          a.impactSeoDelta != null
            ? ` — impact SEO ${a.impactSeoDelta >= 0 ? '+' : ''}${a.impactSeoDelta} pts`
            : '';
        doc.text(`• ${a.title || 'Sans titre'} [${a.status}]${impact}`);
      }
    }
    doc.moveDown();

    if (publishedWithImpact.length > 0) {
      doc.fillColor('#e11d48').fontSize(14).text('Impact SEO des publications');
      doc.fontSize(10).fillColor('#111');
      for (const a of publishedWithImpact) {
        doc.text(`• ${a.title}: ${(a.impactSeoDelta ?? 0) >= 0 ? '+' : ''}${a.impactSeoDelta} pts`);
      }
      doc.moveDown();
    }

    doc.fillColor('#e11d48').fontSize(14).text('Recommandations');
    doc.fontSize(10).fillColor('#111');
    if (recommendations.length === 0) {
      doc.text('Aucune recommandation active.');
    } else {
      for (const r of recommendations) {
        doc.text(`• ${r.action} (+${r.estimatedImpact} pts)`);
      }
    }
    doc.moveDown();

    doc.fillColor('#e11d48').fontSize(14).text('Alertes du mois');
    doc.fontSize(10).fillColor('#111');
    if (alerts.length === 0) {
      doc.text('Aucune alerte.');
    } else {
      for (const a of alerts) {
        doc.text(`• [${a.severity}] ${a.message}`);
      }
    }

    doc.moveDown(2);
    doc.fontSize(8).fillColor('#888').text('Généré par CIBLIX BrandPulse AI — confidentiel', { align: 'center' });

    doc.end();
  });
}
