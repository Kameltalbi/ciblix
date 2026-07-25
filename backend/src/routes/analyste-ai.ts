import { Router, type NextFunction, type Response } from 'express';
import { z } from 'zod';
import auth, { AuthRequest, requirePaymentApproved } from '../middleware/auth.js';
import { checkAgentAccess } from '../middleware/planRestrictions.js';
import { tryConsumeAgentQuota } from '../services/agentUsage.js';
import { requireMissionForMutations } from '../middleware/requireMissionMutations.js';

export const analysteAiRoutes = Router();

analysteAiRoutes.use(auth);
analysteAiRoutes.use(requirePaymentApproved);
analysteAiRoutes.use(checkAgentAccess('analyste-ai'));
analysteAiRoutes.use(requireMissionForMutations);

async function callOpenAI(prompt: string, systemPrompt: string): Promise<string> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY manquant');
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      temperature: 0.3,
      max_tokens: 2000,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenAI ${res.status}: ${errText.slice(0, 200)}`);
  }
  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return data.choices?.[0]?.message?.content?.trim() || '';
}

const analyzeSchema = z.object({
  companyName: z.string().min(2).max(200),
  website: z.string().url().optional().or(z.literal('')),
  sector: z.string().max(120).optional(),
  notes: z.string().max(2000).optional(),
});

/**
 * POST /api/analyste-ai/analyze
 * Brief d'approche commerciale sur une entreprise cible.
 */
analysteAiRoutes.post('/analyze', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const body = analyzeSchema.parse(req.body);
    const organizationId = req.organizationId!;

    const ok = await tryConsumeAgentQuota(organizationId, 'analyste-ai', res, 1);
    if (!ok) return;

    const systemPrompt = `Tu es l'Analyste Ciblix. Tu prépares des briefs commerciaux concis et actionnables.
Réponds UNIQUEMENT en JSON valide avec exactement ces clés :
{
  "summary": "2-3 phrases sur l'entreprise et son positionnement",
  "activity": "activité principale et offre",
  "decisionMakers": ["rôles / profils décideurs utiles"],
  "competitors": ["concurrents ou alternatives probables"],
  "potential": "potentiel commercial (faible/moyen/élevé) + pourquoi",
  "approachAngles": ["3 angles d'approche concrets"],
  "nextActions": ["3 prochaines actions recommandées"]
}
Langue : français. Pas de markdown.`;

    const prompt = [
      `Entreprise : ${body.companyName}`,
      body.website ? `Site : ${body.website}` : null,
      body.sector ? `Secteur indiqué : ${body.sector}` : null,
      body.notes ? `Notes : ${body.notes}` : null,
      "Produis un brief d'analyse pour préparer une approche commerciale.",
    ]
      .filter(Boolean)
      .join('\n');

    const raw = await callOpenAI(prompt, systemPrompt);
    let parsed: Record<string, unknown>;
    try {
      const cleaned = raw.replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = {
        summary: raw.slice(0, 500),
        activity: '',
        decisionMakers: [],
        competitors: [],
        potential: '',
        approachAngles: [],
        nextActions: [],
      };
    }

    res.json({
      companyName: body.companyName,
      website: body.website || null,
      ...parsed,
    });
  } catch (err) {
    next(err);
  }
});
