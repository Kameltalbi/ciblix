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
    `1) Mission — définissez à qui vendre (secteur, zone).\n` +
    `2) Les agents cherchent — Dashboard : nouveaux prospects & signaux Veilleur.\n` +
    `3) Contacts — liste des entreprises ; cliquez une ligne pour ouvrir la fiche.\n` +
    `4) Sur la fiche — bloc « Message recommandé par IA » : Copier / envoyer.\n` +
    `5) L’envoi (WhatsApp, email, appel) reste manuel — les agents préparent, vous contactez.\n\n` +
    `Parcours : Mission → Prospects trouvés → Contacts → Fiche → Message → Envoi.`,
  en:
    `CIBLIX quick start\n\n` +
    `1) Mission — define who you sell to.\n` +
    `2) Agents search — Dashboard: new prospects & Watcher signals.\n` +
    `3) Contacts — company list; click a row to open the file.\n` +
    `4) On the file — “AI recommended message”: Copy / send.\n` +
    `5) Sending stays manual — agents prepare, you reach out.\n\n` +
    `Flow: Mission → Prospects → Contacts → File → Message → Send.`,
  ar:
    `دليل البدء السريع في CIBLIX\n\n` +
    `1) المهمة — حدّد لمن تبيع.\n` +
    `2) الوكلاء يبحثون — لوحة الأداء: عملاء جدد وإشارات المراقبة.\n` +
    `3) Contacts — قائمة الشركات؛ انقر سطراً لفتح البطاقة.\n` +
    `4) في البطاقة — « رسالة مقترحة »: انسخ / أرسل.\n` +
    `5) الإرسال يدوي — الوكلاء يجهّزون وأنت تتواصل.`,
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
      'prospecteur',
      'trouver client',
      'premiers prospects',
      'nouveaux prospects',
      'عملاء محتمل',
    ])
  ) {
    const t: Record<Lang, string> = {
      fr:
        'Les « Nouveaux prospects » du Dashboard = entreprises trouvées par le Prospecteur ce mois.\n' +
        'Ensuite (auto) : qualification, fiche Contact, message préparé.\n' +
        'Pour agir : menu Contacts → ouvrir une fiche → Message recommandé par IA.',
      en:
        'Dashboard “New prospects” = companies found by the Hunter this month.\n' +
        'Next (auto): qualify, Contact file, draft message.\n' +
        'To act: Contacts → open a file → AI recommended message.',
      ar:
        '« محتملون جدد » في لوحة الأداء = شركات وجدها المستكشف هذا الشهر.\n' +
        'بعدها تلقائياً: تأهيل، بطاقة Contact، مسودة رسالة.\n' +
        'للعمل: Contacts ← افتح بطاقة ← الرسالة المقترحة.',
    };
    return t[language];
  }

  if (
    match([
      'message',
      'envoyer',
      'whatsapp',
      'brouillon',
      'recommande',
      'recommande',
      'recommandé',
      'copier',
      'où trouver le message',
      'ou trouver',
      'رسالة',
      'إرسال',
    ])
  ) {
    const t: Record<Lang, string> = {
      fr:
        'Le message à envoyer est sur la fiche client :\n' +
        '1) Contacts → cliquez une entreprise\n' +
        '2) Onglet Aperçu\n' +
        '3) Bloc « Message recommandé par IA » → Copier\n' +
        'Si vide : bouton « Voir le message » / « Planifier l’action » en bas de fiche.',
      en:
        'The message to send is on the company file:\n' +
        '1) Contacts → click a company\n' +
        '2) Overview tab\n' +
        '3) “AI recommended message” → Copy\n' +
        'If empty: use “View message” at the bottom of the file.',
      ar:
        'الرسالة في بطاقة الشركة:\n' +
        '1) Contacts ← انقر شركة\n' +
        '2) تبويب النظرة العامة\n' +
        '3) « رسالة مقترحة » ← انسخ\n' +
        'إن كانت فارغة: زر « عرض الرسالة » أسفل البطاقة.',
    };
    return t[language];
  }

  if (match(['contact', 'contacts', 'liste', 'fiche', 'بطاقة'])) {
    const t: Record<Lang, string> = {
      fr:
        'Contacts = la liste de vos entreprises / prospects.\n' +
        'Cliquez une ligne pour ouvrir la fiche (score, décideurs, message IA, actions WhatsApp / appel / email).',
      en:
        'Contacts = your companies / prospects list.\n' +
        'Click a row to open the file (score, decision makers, AI message, WhatsApp / call / email).',
      ar:
        'Contacts = قائمة شركاتك / العملاء المحتملين.\n' +
        'انقر سطراً لفتح البطاقة (درجة، صناع القرار، رسالة، واتساب / اتصال).',
    };
    return t[language];
  }

  if (
    match([
      'signal',
      'veilleur',
      'scout',
      'opportunite detect',
      'watcher',
      'appel d\'offre',
      'إشارة',
      'مراقبة',
    ])
  ) {
    const t: Record<Lang, string> = {
      fr:
        '« Signaux Veilleur » = alertes (appels d’offres, news, événements).\n' +
        'Ce ne sont PAS des deals ni des messages à envoyer.\n' +
        'Pour contacter : utilisez Contacts + message recommandé.',
      en:
        '“Watcher signals” = alerts (tenders, news, events).\n' +
        'They are NOT deals or messages to send.\n' +
        'To reach out: use Contacts + AI recommended message.',
      ar:
        '« إشارات المراقبة » = تنبيهات (مناقصات، أخبار، فعاليات).\n' +
        'ليست صفقات ولا رسائل للإرسال.\n' +
        'للتواصل: Contacts + الرسالة المقترحة.',
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
    'Je peux vous guider sur : démarrage, Contacts, message à envoyer, signaux Veilleur.\n' +
    'Exemple : « Où trouver le message ? » ou « Comment démarrer ? »',
  en:
    'I can help with: getting started, Contacts, message to send, Watcher signals.\n' +
    'Try: "Where is the message?" or "How do I start?"',
  ar:
    'يمكنني مساعدتك في: البدء، Contacts، الرسالة، إشارات المراقبة.\n' +
    'مثال: « أين الرسالة؟ » أو « كيف أبدأ؟ »',
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
    'You are an onboarding chatbot for CIBLIX (sales AI agents CRM).',
    'Explain product usage only. Current product flow:',
    'Mission → Prospecteur finds companies → Contacts list → company file → AI recommended message → user sends manually (WhatsApp/email/call).',
    'Watcher signals = tender/news/event alerts, NOT deals.',
    'Do not invent features. Keep answers short and actionable.',
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
