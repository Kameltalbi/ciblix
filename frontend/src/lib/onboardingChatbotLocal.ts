export type OnboardingLang = 'fr' | 'en' | 'ar';

function normalizeForMatch(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

const ONBOARDING_GUIDE: Record<OnboardingLang, string> = {
  fr:
    'Guide rapide CIBLIX\n\n' +
    '1) Prospects — ajoutez et qualifiez vos leads.\n' +
    '2) Conversion — lead → client + opportunité.\n' +
    '3) Affaires — pipeline Kanban et relances.\n' +
    '4) Exécution — calendrier, activités, e-mails.\n' +
    '5) Pilotage — tableau de bord et Assistant IA.\n\n' +
    'Workflow : Prospect → Conversion → Affaire → Relance → Clôture.',
  en:
    'CIBLIX quick start\n\n' +
    '1) Prospects — add and qualify leads.\n' +
    '2) Convert to client + deal.\n' +
    '3) Deals — Kanban pipeline.\n' +
    '4) Calendar, activities, emails.\n' +
    '5) Dashboard and AI Assistant.',
  ar:
    'دليل CIBLIX:\n' +
    '1) العملاء المحتملون\n' +
    '2) التحويل\n' +
    '3) الفرص — Kanban\n' +
    '4) التقويم والأنشطة\n' +
    '5) لوحة التحكم والمساعد الذكي',
};

/** Réponses immédiates sans appel serveur (home publique). */
export function getLocalOnboardingAnswer(message: string, language: OnboardingLang): string | null {
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
    ])
  ) {
    return ONBOARDING_GUIDE[language];
  }

  if (match(['prospect', 'lead', 'chasseur', 'premiers prospects', 'trouver', 'ia ?', 'عملاء'])) {
    const t: Record<OnboardingLang, string> = {
      fr:
        'Premiers prospects :\n' +
        '• Menu Prospects → ajoutez vos leads.\n' +
        '• Qualifiez (source, score, notes).\n' +
        '• Chasseur IA (selon offre) pour cibler secteur/zone.\n' +
        '• Convertissez les leads chauds en client + affaire.',
      en:
        'First prospects:\n' +
        '• Prospects menu → add leads.\n' +
        '• Qualify with source, score, notes.\n' +
        '• Hunt AI (on eligible plans) for targeting.\n' +
        '• Convert hot leads to client + deal.',
      ar: 'أضف العملاء في Prospects، قيّمهم، ثم حوّل الأفضل إلى عميل + فرصة.',
    };
    return t[language];
  }

  if (match(['difference', 'différence', 'lead,', 'contact', 'opportun', 'الفرق'])) {
    const t: Record<OnboardingLang, string> = {
      fr:
        '• Lead : contact en qualification.\n' +
        '• Client : compte validé.\n' +
        '• Affaire : vente en cours (montant, étape Kanban, prochaine action).',
      en: '• Lead: being qualified.\n• Client: validated account.\n• Deal: active sale on Kanban.',
      ar: '• Lead: تأهيل\n• Client: حساب\n• Affaire: صفقة جارية',
    };
    return t[language];
  }

  if (match(['convertir', 'transformer', 'conversion', 'convert', 'تحويل'])) {
    const t: Record<OnboardingLang, string> = {
      fr:
        'Convertir un lead :\n' +
        '1) Ouvrez le lead qualifié.\n' +
        '2) Action « convertir ».\n' +
        '3) Client + affaire créés.\n' +
        '4) Suivez sur le Kanban.',
      en: 'Convert a lead:\n1) Open qualified lead.\n2) Convert.\n3) Client + deal created.\n4) Track on Kanban.',
      ar: 'افتح lead مؤهلاً → تحويل → عميل + فرصة → Kanban.',
    };
    return t[language];
  }

  if (match(['kanban', 'tableau', 'pipeline', 'étape', 'etape', 'suivre mes', 'لوحة'])) {
    const t: Record<OnboardingLang, string> = {
      fr:
        'Kanban affaires :\n' +
        '• Menu Affaires → colonnes par étape.\n' +
        '• Glissez-déposez les cartes.\n' +
        '• Renseignez montant et prochaine action.',
      en: 'Deals Kanban:\n• Deals menu → stages.\n• Drag cards.\n• Set amount and next action.',
      ar: 'Affaires → Kanban → اسحب الفرص بين المراحل.',
    };
    return t[language];
  }

  if (match(['tarif', 'prix', 'offre', 'plan', 'pricing', 'inscription', 'essai'])) {
    const t: Record<OnboardingLang, string> = {
      fr: 'Voir la page Tarifs : packs Essentiel, Business, Professionnel avec agents IA inclus. Inscription gratuite puis activation de l’espace.',
      en: 'See Pricing: Essential, Business, Professional plans with AI agents. Free signup then workspace activation.',
      ar: 'راجع صفحة الأسعار والتسجيل المجاني.',
    };
    return t[language];
  }

  return null;
}

export function getLocalOnboardingFallback(language: OnboardingLang): string {
  const t: Record<OnboardingLang, string> = {
    fr: 'Posez par ex. « Comment démarrer ? », « convertir un lead », ou « Kanban ». Page Tarifs pour les offres.',
    en: 'Try "How do I get started?", "convert a lead", or "Kanban". See Pricing for plans.',
    ar: 'جرّب « كيف أبدأ؟ » أو « Kanban ».',
  };
  return t[language];
}

export function resolveOnboardingLang(i18nLanguage: string): OnboardingLang {
  if (i18nLanguage === 'ar') return 'ar';
  if (i18nLanguage === 'en') return 'en';
  return 'fr';
}
