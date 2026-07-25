import { Router, type NextFunction, type Response } from 'express';
import { z } from 'zod';
import auth, { AuthRequest, requirePaymentApproved } from '../middleware/auth.js';
import { checkAgentAccess } from '../middleware/planRestrictions.js';
import { prisma } from '../db/prisma.js';
import { tryConsumeAgentQuota } from '../services/agentUsage.js';
import { getContactById } from '../services/agent-memory/contactService.js';
import { listEventsForContact } from '../services/agent-memory/agentEventService.js';
import { normalizeEmail } from '../services/agent-memory/normalize.js';
import { requireMissionForMutations } from '../middleware/requireMissionMutations.js';
import { validateOfferFidelity } from '../services/prospecting/generateOutreach.js';

export const offreBotRoutes = Router();

/** Plafond si le montant n’est pas fourni — évite les millions inventés. */
const MAX_AUTO_HT = Math.max(100, Number(process.env.OFFRE_BOT_MAX_AUTO_HT) || 25_000);

offreBotRoutes.get('/ping', (_req, res) => {
  res.status(200).json({ ok: true, module: 'offre-bot', at: new Date().toISOString() });
});

offreBotRoutes.use(auth);
offreBotRoutes.use(requirePaymentApproved);
offreBotRoutes.use(checkAgentAccess('offre-bot'));
offreBotRoutes.use(requireMissionForMutations);

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
 * GET /api/offre-bot/contacts
 * Contacts avec historique pour génération d'offre.
 */
offreBotRoutes.get('/contacts', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const contacts = await prisma.contact.findMany({
      where: { organizationId: req.organizationId!, erasedAt: null },
      orderBy: { pipelineStatusAt: 'desc' },
      take: 100,
      select: {
        id: true,
        name: true,
        companyName: true,
        email: true,
        phone: true,
        pipelineStatus: true,
        pipelineStatusScore: true,
      },
    });
    res.json({ contacts });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/offre-bot/affaires
 * @deprecated Utiliser /contacts — conservé pour compat temporaire.
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
  contactId: z.string().min(1).optional(),
  affaireId: z.string().min(1).optional(),
  brief: briefSchema.optional(),
  tone: z.enum(['formal', 'friendly', 'concise']).optional().default('formal'),
  includeConditions: z.boolean().optional().default(true),
  customNotes: z.string().optional().default(''),
  language: z.enum(['fr', 'en', 'ar']).optional().default('fr'),
}).refine((d) => Boolean(d.contactId || d.affaireId || d.brief), {
  message: 'contactId, affaireId or brief is required',
});

/**
 * POST /api/offre-bot/generate
 * Genere une proposition commerciale (brief libre ou affaire legacy).
 */
offreBotRoutes.post('/generate', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!(await tryConsumeAgentQuota(req.organizationId!, 'offre-bot', res))) return;

    const { contactId, affaireId, brief, tone, includeConditions, customNotes, language } =
      generateSchema.parse(req.body);

    const [org, targeting, catalogProducts] = await Promise.all([
      prisma.organization.findUnique({
        where: { id: req.organizationId! },
        select: { name: true, email: true, phone: true, address: true },
      }),
      prisma.orgTargetingProfile.findUnique({
        where: { organizationId: req.organizationId! },
        select: {
          activity: true,
          companyBrief: true,
          productsServices: true,
          sectors: true,
          commercialPriorities: true,
          missionSummary: true,
        },
      }),
      prisma.product.findMany({
        where: { organizationId: req.organizationId!, active: true, deletedAt: null },
        select: { name: true, description: true, price: true, type: true },
        take: 40,
        orderBy: { updatedAt: 'desc' },
      }),
    ]);

    const sellerProducts = [
      ...catalogProducts.map((p) => p.name),
      ...(targeting?.productsServices || []),
    ].filter(Boolean);
    const sellerBrief =
      targeting?.companyBrief?.trim() ||
      targeting?.activity?.trim() ||
      targeting?.missionSummary?.trim() ||
      '';
    const sellerOfferBlock = [
      sellerBrief ? `Qui nous sommes: ${sellerBrief}` : null,
      targeting?.sectors?.length ? `Secteurs: ${targeting.sectors.join(', ')}` : null,
      targeting?.commercialPriorities
        ? `Priorités commerciales: ${targeting.commercialPriorities}`
        : null,
      sellerProducts.length
        ? `OFFRE RÉELLE À VENDRE (seules prestations autorisées):\n${sellerProducts
            .map((p) => `- ${p}`)
            .join('\n')}`
        : 'OFFRE RÉELLE: non renseignée en Mission — reste général, n’invente PAS de développement sur-mesure ni d’événementiel.',
      catalogProducts.length
        ? `CATALOGUE TARIFÉ:\n${catalogProducts
            .map(
              (p) =>
                `- ${p.name}: ${Number(p.price).toFixed(3)} DT (${p.type})${
                  p.description ? ` — ${p.description.slice(0, 120)}` : ''
                }`
            )
            .join('\n')}`
        : null,
    ]
      .filter(Boolean)
      .join('\n');

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
      ? `PRODUIT/SERVICE CHOISI PAR L'UTILISATEUR:\n- Nom: ${brief.productService}`
      : '';
    let assignedTo = 'N/A';
    let affaireMeta: { id?: string; title: string | null; type: string } = {
      title: brief?.need || null,
      type: 'BRIEF',
    };
    let montantHT = Number(brief?.budgetHT ?? 0);
    let historyBlock = '';

    if (contactId) {
      const contact = await getContactById(req.organizationId!, contactId);
      if (!contact) {
        res.status(404).json({ error: 'Contact introuvable' });
        return;
      }

      const { items: events } = await listEventsForContact(req.organizationId!, contactId, {
        take: 15,
      });

      clientName = contact.companyName || contact.name || 'Client';
      contactName = contact.name || '';
      clientEmail = contact.email || 'N/A';
      clientPhone = contact.phone || 'N/A';
      title = `Proposition ${org?.name || 'Ciblix'} pour ${clientName}`;
      type = 'CONTACT';
      affaireMeta = { id: contactId, title, type: 'CONTACT' };

      historyBlock = events
        .filter((e) => e.resume)
        .slice(0, 8)
        .map(
          (e) =>
            `- [${e.source}/${e.type}] ${e.createdAt.toISOString().slice(0, 10)} — ${e.resume}${
              e.score != null ? ` (score ${e.score})` : ''
            }`
        )
        .join('\n');
      description = historyBlock
        ? `Contexte relationnel (ne pas transformer en notre offre):\n${historyBlock}`
        : description;
    } else if (affaireId) {
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
        ? `PRODUIT/SERVICE (catalogue émetteur):
- Nom: ${affaire.product.name}
- Description: ${affaire.product.description || 'N/A'}
- Prix unitaire: ${Number(affaire.product.price).toFixed(3)} DT`
        : productBlock;

      const emailNorm = normalizeEmail(affaire.client.email);
      if (emailNorm) {
        const mapped = await prisma.contact.findFirst({
          where: { organizationId: req.organizationId!, emailNormalized: emailNorm, erasedAt: null },
        });
        if (mapped) {
          const { items: events } = await listEventsForContact(req.organizationId!, mapped.id, {
            take: 10,
          });
          historyBlock = events
            .filter((e) => e.resume)
            .map((e) => `- ${e.resume}`)
            .join('\n');
          if (historyBlock) description = `${description}\n\nHISTORIQUE AGENT:\n${historyBlock}`;
        }
      }
    }

    const catalogDefaultHt = catalogProducts.reduce((s, p) => s + Number(p.price || 0), 0);
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

    const systemPrompt = `Tu es OffreBot. Tu rédiges une proposition commerciale AU NOM DE L'ÉMETTEUR pour VENDRE ses produits au CLIENT.

RÈGLES ABSOLUES — IDENTITÉ & OFFRE :
1) L'ÉMETTEUR vend UNIQUEMENT l'offre listée (Mission / catalogue). Exemple Softfacture = facturation en ligne, devis, factures — PAS du développement SaaS sur-mesure, PAS d'événementiel.
2) Le CLIENT est l'ACHETEUR. Tu ne vends JAMAIS les produits / métier / marketplace du client à lui-même.
3) Ne confonds JAMAIS l'activité du client (ex. place de marché) avec l'offre de l'émetteur.
4) Prestations = abonnements / modules / services de l'émetteur uniquement.
5) Prix : réalistes pour un SaaS / service PME. Si aucun montant fourni, estime un abonnement PME raisonnable (centaines à quelques milliers DT), JAMAIS des millions.
6) Interdit : « développement et mise en place de la solution SaaS » générique, refonte complète, 15M DT, etc. sauf si explicitement dans le catalogue émetteur.

${toneInstructions[tone]}
${langInstructions[language]}

JSON uniquement:
{
  "reference": "REF-YYYY-NNN",
  "date": "DD/MM/YYYY",
  "validite": "30 jours",
  "objet": "Objet — produits de l'émetteur pour le client",
  "introduction": "Présente l'émetteur et son offre réelle",
  "contexte": "Besoins du client (acheteur) sans lui revendre son métier",
  "prestations": [
    {
      "titre": "Titre aligné catalogue émetteur",
      "description": "Description",
      "livrables": ["..."],
      "delai": "..."
    }
  ],
  "montantHT": number,
  "tva": number,
  "montantTTC": number,
  "conditions": ["..."] ou null,
  "conclusion": "...",
  "signatureBlock": "Nom / fonction côté émetteur"
}`;

    const prompt = `Génère une proposition commerciale:

=== ÉMETTEUR (VENDEUR — ton client interne Ciblix) ===
- Nom: ${org?.name || 'N/A'}
- Email: ${org?.email || 'N/A'}
- Tél: ${org?.phone || 'N/A'}
- Adresse: ${org?.address || 'N/A'}
${sellerOfferBlock}

=== CLIENT (ACHETEUR — destinataire de l'offre) ===
- Entreprise: ${clientName}
- Contact: ${contactName || 'N/A'}
- Email: ${clientEmail}
- Tél: ${clientPhone}
- Adresse: ${clientAddress}
- Matricule fiscal: ${clientMatricule}

=== CADRAGE ===
- Titre: ${title}
- Type: ${type}
- Description / historique (contexte acheteur seulement): ${description}
- Montant HT imposé: ${montantHT > 0 ? `${montantHT.toFixed(3)} DT (utilise exactement ces montants)` : `non fourni — estime ≤ ${MAX_AUTO_HT} DT HT, cohérent catalogue`}
- TVA 19% / TTC: ${montantHT > 0 ? `${tva.toFixed(3)} / ${montantTTC.toFixed(3)} DT` : 'à calculer'}

${productBlock}

${historyBlock ? `(Historique déjà inclus dans description)\n` : ''}
COMMERCIAL ASSIGNÉ: ${assignedTo}

${includeConditions ? 'Inclure les conditions générales (paiement, validité, PI).' : 'Ne pas inclure de conditions générales.'}
${customNotes ? `NOTES SUPPLÉMENTAIRES: ${customNotes}` : ''}

Rappel final: vends ${org?.name || "l'émetteur"} au client ${clientName}, pas l'inverse.`;

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
        } else {
          let ht = Number(proposal.montantHT) || 0;
          if (!ht || ht > MAX_AUTO_HT || ht < 0) {
            ht =
              catalogDefaultHt > 0 && catalogDefaultHt <= MAX_AUTO_HT
                ? catalogDefaultHt
                : Math.min(1200, MAX_AUTO_HT);
          }
          proposal.montantHT = Math.round(ht * 1000) / 1000;
          proposal.tva = Math.round(proposal.montantHT * 0.19 * 1000) / 1000;
          proposal.montantTTC =
            Math.round((proposal.montantHT + proposal.tva) * 1000) / 1000;
        }

        // Garde-fou offre inventée (événementiel, etc.)
        const blob = [
          proposal.objet,
          proposal.introduction,
          proposal.contexte,
          ...(Array.isArray(proposal.prestations)
            ? proposal.prestations.map(
                (p: { titre?: string; description?: string }) =>
                  `${p.titre || ''} ${p.description || ''}`
              )
            : []),
        ].join('\n');
        const fidelity = validateOfferFidelity(blob, {
          organizationName: org?.name || 'Émetteur',
          organizationBrief: sellerBrief || null,
          productsServices: sellerProducts,
        });
        if (!fidelity.ok) {
          console.warn('[offre-bot] offer fidelity fail', fidelity.reason, org?.name, clientName);
          const fallbackHt =
            montantHT > 0
              ? montantHT
              : catalogDefaultHt > 0 && catalogDefaultHt <= MAX_AUTO_HT
                ? catalogDefaultHt
                : 990;
          const fallbackTva = Math.round(fallbackHt * 0.19 * 1000) / 1000;
          proposal = {
            reference: `REF-${new Date().getFullYear()}-001`,
            date: new Date().toLocaleDateString('fr-FR'),
            validite: '30 jours',
            objet: `Proposition ${org?.name || ''} — ${sellerProducts[0] || 'nos solutions'} pour ${clientName}`,
            introduction: `${org?.name || 'Notre entreprise'} propose ${
              sellerProducts.slice(0, 3).join(', ') || sellerBrief || 'ses solutions digitales pour PME'
            } à ${clientName}.`,
            contexte: `Cette proposition s’adresse à ${clientName} en tant que client potentiel de ${org?.name || 'notre offre'}, sans reprendre le métier du client comme prestation vendue.`,
            prestations: [
              {
                titre: sellerProducts[0] || 'Abonnement / solution',
                description:
                  sellerBrief ||
                  `Mise à disposition de ${sellerProducts.join(', ') || 'notre solution'} pour ${clientName}.`,
                livrables: ['Accès solution', 'Prise en main', 'Support'],
                delai: 'Sous 7 à 15 jours',
              },
            ],
            montantHT: fallbackHt,
            tva: fallbackTva,
            montantTTC: Math.round((fallbackHt + fallbackTva) * 1000) / 1000,
            conditions: includeConditions
              ? [
                  'Acompte 50% à la commande',
                  'Validité 30 jours',
                  'Facturation selon conditions Softfacture / émetteur',
                ]
              : null,
            conclusion: `Restant à votre disposition pour finaliser cette proposition.`,
            signatureBlock: org?.name || 'Émetteur',
            _fidelityFallback: fidelity.reason,
          };
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
