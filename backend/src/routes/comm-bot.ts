import { Router, type NextFunction, type Response } from 'express';
import { z } from 'zod';
import auth, { AuthRequest, requirePaymentApproved } from '../middleware/auth.js';
import { checkAgentAccess } from '../middleware/planRestrictions.js';
import { prisma } from '../db/prisma.js';
import { tryConsumeAgentQuota } from '../services/agentUsage.js';

export const commBotRoutes = Router();

commBotRoutes.get('/ping', (_req, res) => {
  res.status(200).json({ ok: true, module: 'comm-bot', at: new Date().toISOString() });
});

commBotRoutes.use(auth);
commBotRoutes.use(requirePaymentApproved);
commBotRoutes.use(checkAgentAccess('comm-bot'));

const CONTENT_TYPES = ['seo', 'linkedin', 'newsletter', 'product_sheet', 'service_page'] as const;

async function callOpenAI(prompt: string, systemPrompt: string, maxTokens = 2800): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OpenAI API key not configured');

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      max_tokens: maxTokens,
      temperature: 0.55,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${error}`);
  }

  const data = (await response.json()) as { choices?: { message?: { content?: string } }[] };
  return data.choices?.[0]?.message?.content?.trim() || '';
}

function parseJsonContent(raw: string): Record<string, unknown> | null {
  const trimmed = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
  try {
    return JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    return null;
  }
}

commBotRoutes.get('/context', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.organizationId!;
    const [organization, products, recentWins] = await Promise.all([
      prisma.organization.findUnique({
        where: { id: orgId },
        select: { id: true, name: true, email: true, phone: true, address: true },
      }),
      prisma.product.findMany({
        where: { organizationId: orgId },
        select: { id: true, name: true, description: true, type: true, price: true },
        orderBy: { name: 'asc' },
        take: 50,
      }),
      prisma.affaire.findMany({
        where: { organizationId: orgId, deletedAt: null, statut: 'GAGNE' },
        select: { title: true, type: true, client: { select: { name: true } } },
        orderBy: { updatedAt: 'desc' },
        take: 5,
      }),
    ]);

    res.json({ organization, products, recentWins, contentTypes: CONTENT_TYPES });
  } catch (err) {
    next(err);
  }
});

const generateSchema = z.object({
  contentType: z.enum(CONTENT_TYPES),
  topic: z.string().min(3).max(500),
  targetAudience: z.string().max(300).optional().default(''),
  keywords: z.string().max(300).optional().default(''),
  tone: z.enum(['professional', 'friendly', 'expert']).optional().default('professional'),
  language: z.enum(['fr', 'en', 'ar']).optional().default('fr'),
  productId: z.string().optional(),
  serviceName: z.string().max(200).optional(),
  includeCta: z.boolean().optional().default(true),
  extraNotes: z.string().max(1000).optional().default(''),
});

commBotRoutes.post('/generate', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.organizationId!;
    if (!(await tryConsumeAgentQuota(orgId, 'comm-bot', res))) return;

    const body = generateSchema.parse(req.body);

    const organization = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { name: true, email: true, phone: true, address: true },
    });

    if (!organization) {
      res.status(404).json({ error: 'Organisation introuvable' });
      return;
    }

    let productContext = '';
    if (body.productId) {
      const product = await prisma.product.findFirst({
        where: { id: body.productId, organizationId: orgId },
        select: { name: true, description: true, type: true, price: true },
      });
      if (product) {
        productContext = `Produit: ${product.name}\nType: ${product.type || '—'}\nPrix: ${product.price ?? '—'} DT\nDescription: ${product.description || '—'}`;
      }
    }

    const langLabel = body.language === 'ar' ? 'arabe' : body.language === 'en' ? 'anglais' : 'français';
    const toneLabel =
      body.tone === 'friendly' ? 'accessible et chaleureux' :
      body.tone === 'expert' ? 'expert et crédible' :
      'professionnel B2B';

    const baseContext = `
Entreprise: ${organization.name}
${organization.address ? `Adresse: ${organization.address}` : ''}
${organization.email ? `Email: ${organization.email}` : ''}
${organization.phone ? `Téléphone: ${organization.phone}` : ''}
Sujet / angle: ${body.topic}
${body.targetAudience ? `Audience cible: ${body.targetAudience}` : ''}
${body.keywords ? `Mots-clés SEO: ${body.keywords}` : ''}
${body.serviceName ? `Service: ${body.serviceName}` : ''}
${productContext}
${body.extraNotes ? `Notes: ${body.extraNotes}` : ''}
Langue: ${langLabel}
Ton: ${toneLabel}
Marché: Tunisie / B2B PME
`.trim();

    const systemPrompt = `Tu es CommBot, agent marketing B2B pour CIBLIX. Tu rédiges des contenus clairs, crédibles et orientés visibilité pour des PME tunisiennes. Pas de promesses exagérées. Réponds UNIQUEMENT en JSON valide, sans markdown autour.`;

    const typePrompts: Record<(typeof CONTENT_TYPES)[number], string> = {
      seo: `Génère un article SEO B2B structuré.
JSON attendu:
{
  "title": "titre H1 accrocheur",
  "metaDescription": "155 caractères max",
  "slug": "url-slug",
  "keywords": ["mot1", "mot2"],
  "outline": ["H2...", "H2..."],
  "body": "article complet en markdown avec ## pour les H2",
  "cta": "appel à l'action"
}`,
      linkedin: `Génère un post LinkedIn B2B prêt à publier.
JSON attendu:
{
  "hook": "accroche 1-2 lignes",
  "body": "corps du post avec sauts de ligne",
  "hashtags": ["#tag1", "#tag2"],
  "cta": "appel à l'action",
  "charCount": nombre
}`,
      newsletter: `Génère une newsletter email B2B.
JSON attendu:
{
  "subject": "objet email",
  "preheader": "preheader",
  "intro": "introduction",
  "sections": [{"title": "...", "content": "..."}],
  "cta": "appel à l'action",
  "footer": "formule de clôture"
}`,
      product_sheet: `Génère une fiche produit B2B professionnelle.
JSON attendu:
{
  "productName": "nom",
  "tagline": "slogan court",
  "summary": "résumé",
  "benefits": ["..."],
  "features": ["..."],
  "useCases": ["..."],
  "pricingHint": "indication prix ou sur devis",
  "cta": "appel à l'action"
}`,
      service_page: `Génère le contenu d'une page service web B2B.
JSON attendu:
{
  "headline": "titre principal",
  "subheadline": "sous-titre",
  "valueProposition": "proposition de valeur",
  "sections": [{"title": "...", "content": "..."}],
  "proofPoints": ["..."],
  "faq": [{"question": "...", "answer": "..."}],
  "cta": "appel à l'action"
}`,
    };

    const raw = await callOpenAI(baseContext, `${systemPrompt}\n\n${typePrompts[body.contentType]}`);
    const parsed = parseJsonContent(raw);

    res.json({
      contentType: body.contentType,
      content: parsed ?? { raw },
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
});
