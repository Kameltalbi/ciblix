import { Router, type NextFunction, type Response } from 'express';
import { z } from 'zod';
import auth, { AuthRequest, requirePaymentApproved } from '../middleware/auth.js';
import { checkAgentAccess } from '../middleware/planRestrictions.js';
import { prisma } from '../db/prisma.js';
import { tryConsumeAgentQuota } from '../services/agentUsage.js';

export const offreBotRoutes = Router();

offreBotRoutes.get('/ping', (_req, res) => {
  res.status(200).json({ ok: true, module: 'offre-bot', at: new Date().toISOString() });
});

offreBotRoutes.use(auth);
offreBotRoutes.use(requirePaymentApproved);
offreBotRoutes.use(checkAgentAccess('offre-bot'));

// ─── Helpers ────────────────────────────────────────────────

async function callOpenAI(prompt: string, systemPrompt: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OpenAI API key not configured');

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      max_tokens: 3000,
      temperature: 0.4,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${error}`);
  }

  const data = (await response.json()) as any;
  return data.choices?.[0]?.message?.content?.trim() || '';
}

// ─── Routes ─────────────────────────────────────────────────

/**
 * GET /api/offre-bot/affaires
 * Liste les affaires disponibles pour generer une offre.
 */
offreBotRoutes.get('/affaires', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const affaires = await prisma.affaire.findMany({
      where: {
        organizationId: req.organizationId!,
        deletedAt: null,
      },
      include: {
        client: { select: { id: true, name: true, contactName: true, email: true, phone: true, address: true, matricule: true } },
        product: { select: { id: true, name: true, description: true, price: true, type: true } },
        assignedTo: { select: { id: true, name: true, email: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });
    res.json({ affaires });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/offre-bot/organization
 * Infos de l'organisation pour l'en-tête de l'offre.
 */
offreBotRoutes.get('/organization', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const org = await prisma.organization.findUnique({
      where: { id: req.organizationId! },
      select: { id: true, name: true, email: true, phone: true, address: true, logoUrl: true },
    });
    res.json({ organization: org });
  } catch (err) {
    next(err);
  }
});

const briefSchema = z.object({
  clientName: z.string().min(1),
  contactName: z.string().optional().default(''),
  need: z.string().min(1),
  context: z.string().optional().default(''),
  budgetHT: z.number().nonnegative().optional(),
  productService: z.string().optional().default(''),
});

const generateSchema = z.object({
  affaireId: z.string().min(1).optional(),
  brief: briefSchema.optional(),
  tone: z.enum(['formal', 'friendly', 'concise']).optional().default('formal'),
  includeConditions: z.boolean().optional().default(true),
  customNotes: z.string().optional().default(''),
  language: z.enum(['fr', 'en', 'ar']).optional().default('fr'),
}).refine((d) => Boolean(d.affaireId || d.brief), {
  message: 'affaireId or brief is required',
});

/**
 * POST /api/offre-bot/generate
 * Genere une proposition commerciale (brief libre ou affaire legacy).
 */
offreBotRoutes.post('/generate', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!(await tryConsumeAgentQuota(req.organizationId!, 'offre-bot', res))) return;

    const { affaireId, brief, tone, includeConditions, customNotes, language } = generateSchema.parse(req.body);

    const org = await prisma.organization.findUnique({
      where: { id: req.organizationId! },
      select: { name: true, email: true, phone: true, address: true },
    });

    let clientName = brief?.clientName || '';
    let contactName = brief?.contactName || '';
    let clientEmail = 'N/A';
    let clientPhone = 'N/A';
    let clientAddress = 'N/A';
    let clientMatricule = 'N/A';
    let title = brief?.need || '';
    let type = 'BRIEF';
    let description = [brief?.need, brief?.context].filter(Boolean).join('\n\n') || 'N/A';
    let productBlock = brief?.productService
      ? `PRODUIT/SERVICE:\n- Nom: ${brief.productService}`
      : '';
    let assignedTo = 'N/A';
    let affaireMeta: { id?: string; title: string | null; type: string } = {
      title: brief?.need || null,
      type: 'BRIEF',
    };
    let montantHT = Number(brief?.budgetHT ?? 0);

    if (affaireId) {
      const affaire = await prisma.affaire.findFirst({
        where: {
          id: affaireId,
          organizationId: req.organizationId!,
          deletedAt: null,
        },
        include: {
          client: true,
          product: true,
          assignedTo: { select: { name: true, email: true, phone: true } },
        },
      });

      if (!affaire) {
        res.status(404).json({ error: 'Affaire not found' });
        return;
      }

      clientName = affaire.client.name;
      contactName = affaire.client.contactName || '';
      clientEmail = affaire.client.email || 'N/A';
      clientPhone = affaire.client.phone || 'N/A';
      clientAddress = affaire.client.address || 'N/A';
      clientMatricule = affaire.client.matricule || 'N/A';
      title = affaire.title || affaire.type;
      type = affaire.type;
      description = affaire.description || 'N/A';
      montantHT = Number(affaire.montantHT);
      assignedTo = affaire.assignedTo?.name || 'N/A';
      affaireMeta = { id: affaire.id, title: affaire.title, type: affaire.type };
      productBlock = affaire.product
        ? `PRODUIT/SERVICE:
- Nom: ${affaire.product.name}
- Description: ${affaire.product.description || 'N/A'}
- Prix unitaire: ${Number(affaire.product.price).toFixed(3)} DT`
        : productBlock;
    }

    const tva = montantHT * 0.19;
    const montantTTC = montantHT + tva;

    const toneInstructions: Record<string, string> = {
      formal: 'Ton professionnel et formel, vouvoiement systématique.',
      friendly: 'Ton professionnel mais chaleureux, reste au vouvoiement mais plus convivial.',
      concise: 'Ton direct et concis, va à l\'essentiel sans fioritures.',
    };

    const langInstructions: Record<string, string> = {
      fr: 'Rédige en français.',
      en: 'Rédige en anglais.',
      ar: 'Rédige en arabe.',
    };

    const systemPrompt = `Tu es OffreBot, un expert en rédaction de propositions commerciales pour des entreprises de conseil en Tunisie.
${toneInstructions[tone]}
${langInstructions[language]}

Tu génères des propositions commerciales structurées au format JSON avec les sections suivantes:
{
  "reference": "REF-YYYY-NNN",
  "date": "DD/MM/YYYY",
  "validite": "30 jours",
  "objet": "Objet de la proposition",
  "introduction": "Paragraphe d'introduction personnalisé",
  "contexte": "Description du contexte et des besoins du client",
  "prestations": [
    {
      "titre": "Titre de la prestation",
      "description": "Description détaillée",
      "livrables": ["livrable 1", "livrable 2"],
      "delai": "Délai estimé"
    }
  ],
  "montantHT": number,
  "tva": number,
  "montantTTC": number,
  "conditions": ["condition 1", "condition 2"] ou null,
  "conclusion": "Paragraphe de conclusion",
  "signatureBlock": "Nom et fonction du signataire"
}

Adapte le contenu au type de prestation et au secteur du client. Sois précis et professionnel.`;

    const prompt = `Génère une proposition commerciale pour:

ENTREPRISE ÉMETTRICE:
- Nom: ${org?.name || 'N/A'}
- Email: ${org?.email || 'N/A'}
- Tél: ${org?.phone || 'N/A'}
- Adresse: ${org?.address || 'N/A'}

CLIENT:
- Entreprise: ${clientName}
- Contact: ${contactName || 'N/A'}
- Email: ${clientEmail}
- Tél: ${clientPhone}
- Adresse: ${clientAddress}
- Matricule fiscal: ${clientMatricule}

AFFAIRE / BRIEF:
- Titre: ${title}
- Type: ${type}
- Description: ${description}
- Montant HT: ${montantHT > 0 ? `${montantHT.toFixed(3)} DT` : 'À estimer'}
- TVA (19%): ${montantHT > 0 ? `${tva.toFixed(3)} DT` : 'À estimer'}
- Montant TTC: ${montantHT > 0 ? `${montantTTC.toFixed(3)} DT` : 'À estimer'}

${productBlock}

COMMERCIAL ASSIGNÉ: ${assignedTo}

${includeConditions ? 'Inclure les conditions générales (paiement, validité, propriété intellectuelle).' : 'Ne pas inclure de conditions générales.'}
${customNotes ? `NOTES SUPPLÉMENTAIRES: ${customNotes}` : ''}`;

    const aiResponse = await callOpenAI(prompt, systemPrompt);
    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);

    let proposal: any = null;
    if (jsonMatch) {
      try {
        proposal = JSON.parse(jsonMatch[0]);
        if (montantHT > 0) {
          proposal.montantHT = montantHT;
          proposal.tva = tva;
          proposal.montantTTC = montantTTC;
        }
      } catch {
        proposal = { raw: aiResponse };
      }
    } else {
      proposal = { raw: aiResponse };
    }

    res.json({
      proposal,
      affaire: {
        id: affaireMeta.id,
        title: affaireMeta.title,
        type: affaireMeta.type,
        montantHT: proposal?.montantHT ?? montantHT,
        tva: proposal?.tva ?? tva,
        montantTTC: proposal?.montantTTC ?? montantTTC,
      },
      client: {
        name: clientName,
        contactName: contactName || null,
      },
      organization: org,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/offre-bot/regenerate-section
 * Regenere une section specifique de l'offre.
 */
const regenerateSchema = z.object({
  section: z.string().min(1),
  currentContent: z.string(),
  instruction: z.string().min(1),
  context: z.string().optional().default(''),
});

offreBotRoutes.post('/regenerate-section', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!(await tryConsumeAgentQuota(req.organizationId!, 'offre-bot', res))) return;

    const { section, currentContent, instruction, context } = regenerateSchema.parse(req.body);

    const systemPrompt = `Tu es OffreBot. On te demande de réécrire une section d'une proposition commerciale.
Réponds uniquement avec le nouveau contenu de la section, sans JSON ni balise.`;

    const prompt = `Section: ${section}
Contenu actuel: ${currentContent}
Instruction: ${instruction}
${context ? `Contexte: ${context}` : ''}

Réécris cette section en suivant l'instruction.`;

    const newContent = await callOpenAI(prompt, systemPrompt);
    res.json({ section, content: newContent });
  } catch (err) {
    next(err);
  }
});
