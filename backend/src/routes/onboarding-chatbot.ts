import { Router } from 'express';
import { z } from 'zod';
import { optionalAuth } from '../middleware/auth.js';

export const onboardingChatbotRoutes = Router();
onboardingChatbotRoutes.use(optionalAuth);

const querySchema = z.object({
  message: z.string().min(1).max(1000),
  language: z.enum(['fr', 'en', 'ar']).optional().default('fr'),
});

type Lang = 'fr' | 'en' | 'ar';

function normalizeForMatch(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

const ONBOARDING_GUIDE: Record<Lang, string> = {
  fr:
    `Guide rapide CIBLIX\n\n` +
    `1) Prospects — ajoutez et qualifiez vos leads (Chasseur IA sur les offres concernées).\n` +
    `2) Conversion — transformez un lead en client + opportunité.\n` +
    `3) Affaires — suivez le pipeline en Kanban, prochaines actions et relances.\n` +
    `4) Exécution — calendrier, activités, modèles d’e-mails.\n` +
    `5) Pilotage — tableau de bord, KPI et Assistant IA pour prioriser.\n\n` +
    `Workflow conseillé : Prospect → Conversion → Affaire → Relance → Clôture.`,
  en:
    `CIBLIX quick start\n\n` +
    `1) Prospects — add and qualify leads.\n` +
    `2) Convert hot leads into client + deal.\n` +
    `3) Deals — Kanban pipeline, next actions, follow-ups.\n` +
    `4) Execution — calendar, activities, email templates.\n` +
    `5) Insights — dashboard, KPIs, AI Assistant for priorities.\n\n` +
    `Recommended flow: Lead → Convert → Deal → Follow-up → Won.`,
  ar:
    `دليل البدء السريع في CIBLIX\n\n` +
    `1) العملاء المحتملون — إضافة وتأهيل.\n` +
    `2) التحويل — عميل + فرصة.\n` +
    `3) الفرص — لوحة Kanban والمتابعات.\n` +
    `4) التنفيذ — التقويم والأنشطة.\n` +
    `5) المتابعة — لوحة التحكم والمساعد الذكي.`,
};

function getRuleBasedAnswer(message: string, language: Lang): string | null {
  const m = normalizeForMatch(message);

  const match = (patterns: string[]) => patterns.some((p) => m.includes(p));

  if (
    match([
      'demarrer',
      'commencer',
      'debut',
      'start',
      'onboarding',
      'prise en main',
      'comment utiliser',
      'كيف أبدأ',
      'البداية',
    ])
  ) {
    return ONBOARDING_GUIDE[language];
  }

  if (
    match([
      'prospect',
      'lead',
      'chasseur',
      'trouver client',
      'premiers prospects',
      'عملاء محتمل',
    ])
  ) {
    const t: Record<Lang, string> = {
      fr:
        'Pour vos premiers prospects :\n' +
        '• Créez des leads dans Prospects (manuel ou import).\n' +
        '• Qualifiez-les (source, score, notes).\n' +
        '• Avec Chasseur IA (selon votre offre), lancez une recherche ciblée par secteur/zone.\n' +
        '• Convertissez les leads chauds en client + opportunité.',
      en:
        'For your first prospects:\n' +
        '• Create leads in Prospects (manual or import).\n' +
        '• Qualify them (source, score, notes).\n' +
        '• Use Hunt AI (on eligible plans) for targeted search.\n' +
        '• Convert hot leads to client + deal.',
      ar:
        'لإيجاد أول العملاء المحتملين:\n' +
        '• أضف العملاء في قسم Prospects.\n' +
        '• قيّمهم (مصدر، درجة، ملاحظات).\n' +
        '• حوّل الأفضل إلى عميل + فرصة.',
    };
    return t[language];
  }

  if (
    match([
      'difference',
      'différence',
      'lead et',
      'contact et',
      'opportunite',
      'affaire',
      'الفرق',
    ])
  ) {
    const t: Record<Lang, string> = {
      fr:
        '• Lead (prospect) : contact pas encore qualifié ou en cours de qualification.\n' +
        '• Client : compte validé dans votre portefeuille.\n' +
        '• Affaire (opportunité) : vente en cours avec montant, étape Kanban et prochaine action.',
      en:
        '• Lead: contact being qualified.\n' +
        '• Client: validated account in your portfolio.\n' +
        '• Deal (opportunity): active sale with amount, Kanban stage, and next action.',
      ar:
        '• Lead: جهة اتصال قيد التأهيل.\n' +
        '• Client: حساب مؤكد.\n' +
        '• Deal: صفقة جارية مع مرحلة ومبلغ.',
    };
    return t[language];
  }

  if (match(['convertir', 'transformer', 'conversion', 'convert', 'تحويل'])) {
    const t: Record<Lang, string> = {
      fr:
        'Pour convertir un lead :\n' +
        '1) Ouvrez la fiche lead qualifiée.\n' +
        '2) Utilisez l’action de conversion.\n' +
        '3) CIBLIX crée le client et l’affaire associée.\n' +
        '4) Placez l’affaire sur le Kanban et planifiez la prochaine action.',
      en:
        'To convert a lead:\n' +
        '1) Open the qualified lead.\n' +
        '2) Run the conversion action.\n' +
        '3) CIBLIX creates client + deal.\n' +
        '4) Move the deal on Kanban and set the next action.',
      ar:
        'لتحويل lead:\n' +
        '1) افتح السجل المؤهل.\n' +
        '2) نفّذ التحويل.\n' +
        '3) يُنشأ العميل والفرصة.\n' +
        '4) ضع الفرصة على Kanban.',
    };
    return t[language];
  }

  if (match(['kanban', 'tableau', 'pipeline', 'étape', 'etape', 'لوحة'])) {
    const t: Record<Lang, string> = {
      fr:
        'Suivi Kanban des affaires :\n' +
        '• Menu Affaires → vue colonnes par étape.\n' +
        '• Glissez-déposez pour faire avancer une opportunité.\n' +
        '• Renseignez montant, probabilité et date de prochaine action.\n' +
        '• L’Assistant IA peut suggérer les relances prioritaires.',
      en:
        'Kanban deal tracking:\n' +
        '• Deals menu → column view by stage.\n' +
        '• Drag & drop to advance opportunities.\n' +
        '• Set amount, probability, and next action date.\n' +
        '• AI Assistant can suggest priority follow-ups.',
      ar:
        'متابعة Kanban:\n' +
        '• قسم Affaires → أعمدة حسب المرحلة.\n' +
        '• اسحب الفرص بين المراحل.\n' +
        '• حدّد المبلغ والإجراء التالي.',
    };
    return t[language];
  }

  if (match(['tarif', 'prix', 'offre', 'plan', 'pricing', 'سعر'])) {
    const t: Record<Lang, string> = {
      fr:
        'Les offres CIBLIX (Essentiel, Business, Professionnel) incluent des agents IA selon le pack.\n' +
        'Consultez la page Tarifs pour comparer Chasseur IA, Assistant IA, Veilleur, etc.\n' +
        'Après inscription, un essai ou validation permet d’activer votre espace.',
      en:
        'CIBLIX plans (Essential, Business, Professional) include different AI agents.\n' +
        'See the Pricing page to compare Hunt AI, Assistant, Scout, etc.\n' +
        'After signup, trial or approval activates your workspace.',
      ar:
        'باقات CIBLIX تتضمن وكلاء ذكاء اصطناعي حسب العرض.\n' +
        'راجع صفحة الأسعار للمقارنة.',
    };
    return t[language];
  }

  return null;
}

const FALLBACK_GENERIC: Record<Lang, string> = {
  fr:
    'Je peux vous guider sur : démarrage, prospects, conversion lead → affaire, Kanban et offres CIBLIX.\n' +
    'Exemple : « Comment démarrer ? » ou « Comment transformer un lead ? »',
  en:
    'I can help with: getting started, prospects, lead conversion, Kanban, and CIBLIX plans.\n' +
    'Try: "How do I get started?" or "How do I convert a lead?"',
  ar:
    'يمكنني مساعدتك في: البدء، العملاء المحتملين، التحويل، Kanban، والعروض.\n' +
    'مثال: « كيف أبدأ؟ »',
};

async function callOpenAIForOnboarding(prompt: string, language: Lang): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not configured');
  }

  const languageInstruction = {
    fr: 'Réponds en français simple, clair et concret.',
    en: 'Answer in simple, clear, practical English.',
    ar: 'أجب بلغة عربية بسيطة وواضحة وعملية.',
  }[language];

  const systemPrompt = [
    'You are an onboarding chatbot for CIBLIX CRM.',
    'You are independent from the in-app AI assistant.',
    'Your job is to explain product onboarding and app usage only.',
    'Focus on: prospects, conversion, clients, affaires pipeline, activities, calendar, support tickets, and first-week setup.',
    'Do not hallucinate unavailable features. If unsure, provide generic safe guidance.',
    'Keep responses concise and actionable (3-8 bullets max when suitable).',
    languageInstruction,
  ].join(' ');

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.3,
      max_tokens: 500,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenAI onboarding error: ${err}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() || 'Je n’ai pas pu générer une réponse pour le moment.';
}

onboardingChatbotRoutes.get('/ping', (_req, res) => {
  res.json({
    ok: true,
    hasOpenAi: Boolean(process.env.OPENAI_API_KEY?.trim()),
  });
});

onboardingChatbotRoutes.post('/query', async (req, res, next) => {
  try {
    const { message, language } = querySchema.parse(req.body ?? {});

    const ruleAnswer = getRuleBasedAnswer(message, language);
    if (ruleAnswer) {
      res.json({ type: 'onboarding_rules', answer: ruleAnswer });
      return;
    }

    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      res.json({ type: 'onboarding_rules', answer: FALLBACK_GENERIC[language] });
      return;
    }

    try {
      const answer = await callOpenAIForOnboarding(message, language);
      res.json({ type: 'onboarding_openai', answer });
    } catch (openAiErr) {
      console.warn('[onboarding-chatbot] OpenAI indisponible:', openAiErr);
      res.json({ type: 'onboarding_rules', answer: FALLBACK_GENERIC[language] });
    }
  } catch (error) {
    next(error);
  }
});
