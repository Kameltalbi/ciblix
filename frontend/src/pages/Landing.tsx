import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { TrendingUp, Shield, Zap, Users, BarChart3, CheckCircle2, ArrowRight, Mail, Phone, MapPin, Menu, X, Target, Lock, DollarSign, PieChart, Award, Globe, Radio, Bot, Radar, FileSignature, ShieldCheck, Megaphone, Sparkles, ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const SOFTFACTURE_BANNER_SLIDE_MS = 500;

export function Landing() {
  const { i18n, t } = useTranslation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [agentsDropdownOpen, setAgentsDropdownOpen] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const [popupEntered, setPopupEntered] = useState(false);
  const [popupExiting, setPopupExiting] = useState(false);
  const popupExitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const popupUnmountTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const today = new Date().toDateString();
    const storageKey = 'softfacture_popup_count';
    const storageDateKey = 'softfacture_popup_date';

    const storedDate = localStorage.getItem(storageDateKey);
    const storedCount = parseInt(localStorage.getItem(storageKey) || '0', 10);

    if (storedDate !== today) {
      localStorage.setItem(storageKey, '0');
      localStorage.setItem(storageDateKey, today);
    }

    const currentCount = storedDate === today ? storedCount : 0;

    if (currentCount < 2) {
      const timer = setTimeout(() => {
        setShowPopup(true);
        localStorage.setItem(storageKey, String(currentCount + 1));
        localStorage.setItem(storageDateKey, today);
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    if (!showPopup) return;

    setPopupEntered(false);
    setPopupExiting(false);
    const enterDelayMs = 30;
    const slideMs = SOFTFACTURE_BANNER_SLIDE_MS;
    const enterTimer = setTimeout(() => setPopupEntered(true), enterDelayMs);

    // 5 s affichées une fois la barre ouverte, puis fermeture
    const visibleMs = 5000;
    popupExitTimerRef.current = setTimeout(
      () => setPopupExiting(true),
      enterDelayMs + slideMs + visibleMs,
    );
    popupUnmountTimerRef.current = setTimeout(() => {
      setShowPopup(false);
      setPopupExiting(false);
      setPopupEntered(false);
    }, enterDelayMs + slideMs + visibleMs + slideMs);

    return () => {
      clearTimeout(enterTimer);
      if (popupExitTimerRef.current) clearTimeout(popupExitTimerRef.current);
      if (popupUnmountTimerRef.current) clearTimeout(popupUnmountTimerRef.current);
    };
  }, [showPopup]);

  const dismissSoftfactureBanner = () => {
    if (popupExitTimerRef.current) clearTimeout(popupExitTimerRef.current);
    if (popupUnmountTimerRef.current) clearTimeout(popupUnmountTimerRef.current);
    setPopupExiting(true);
    popupUnmountTimerRef.current = setTimeout(() => {
      setShowPopup(false);
      setPopupExiting(false);
      setPopupEntered(false);
    }, SOFTFACTURE_BANNER_SLIDE_MS);
  };
  
  return (
    <div className="min-h-screen bg-kt-mesh">
      {/* Header — même ADN que l’app (bleu structure) */}
      <header className="sticky top-0 z-50 border-b border-[#BED6F6]/40 bg-white/90 shadow-sm backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex min-h-[4.25rem] items-center justify-between py-2 sm:min-h-20 sm:py-0">
            <Link to="/" className="flex items-center gap-2 transition-opacity hover:opacity-80">
              <img
                src="/logo-ciblix.png"
                alt="CIBLIX"
                className="h-[3.9rem] w-auto max-w-[min(16rem,72vw)] object-contain sm:h-16 md:h-[4.5rem] md:max-w-[16rem]"
              />
            </Link>
            <nav className="hidden md:flex items-center gap-5 flex-1 justify-center">
              <a href="#features" className="text-[15px] font-semibold text-foreground/80 transition-colors hover:text-[#0071DD]">
                {t('landing.navFeatures')}
              </a>
              <a href="#why" className="text-[15px] font-semibold text-foreground/80 transition-colors hover:text-[#0071DD]">
                {t('landing.navWhy')}
              </a>
              <div
                className="relative"
                onMouseEnter={() => setAgentsDropdownOpen(true)}
                onMouseLeave={() => setAgentsDropdownOpen(false)}
              >
                <a
                  href="#agents"
                  className="flex items-center gap-1 text-[15px] font-semibold text-foreground/80 transition-colors hover:text-[#0071DD]"
                >
                  <Sparkles size={15} className="text-[#016AEB]" />
                  Agents IA
                  <ChevronDown size={14} className={cn('transition-transform', agentsDropdownOpen && 'rotate-180')} />
                </a>
                {agentsDropdownOpen && (
                  <div className="absolute left-1/2 top-full z-50 w-[340px] -translate-x-1/2 pt-2">
                    <div className="rounded-2xl border border-[#BED6F6]/40 bg-white p-3 shadow-xl">
                    {[
                      { icon: Radio, nameKey: 'agents.huntAi.name', descKey: 'agents.huntAi.desc', color: 'text-orange-600', bg: 'bg-orange-50', to: '/agent/hunt-ai' },
                      { icon: Bot, nameKey: 'agents.copilotIa.name', descKey: 'agents.copilotIa.desc', color: 'text-blue-600', bg: 'bg-blue-50', to: '/agent/copilot-ia' },
                      { icon: Radar, nameKey: 'agents.scoutAi.name', descKey: 'agents.scoutAi.desc', color: 'text-indigo-600', bg: 'bg-indigo-50', to: '/agent/scout-ai' },
                      { icon: FileSignature, nameKey: 'agents.offreBot.name', descKey: 'agents.offreBot.desc', color: 'text-violet-600', bg: 'bg-violet-50', to: '/agent/offre-bot' },
                      { icon: ShieldCheck, nameKey: 'agents.factCheckAi.name', descKey: 'agents.factCheckAi.desc', color: 'text-emerald-600', bg: 'bg-emerald-50', to: '/agent/factcheck-ai' },
                      { icon: Megaphone, nameKey: 'agents.brandPulse.name', descKey: 'agents.brandPulse.desc', color: 'text-rose-600', bg: 'bg-rose-50', to: '/agent/brand-pulse' },
                    ].map((agent) => (
                        <Link
                          key={agent.nameKey}
                          to={agent.to}
                          onClick={() => setAgentsDropdownOpen(false)}
                          className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-[#f4f8fd]"
                        >
                          <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', agent.bg)}>
                            <agent.icon size={18} className={agent.color} />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-foreground">{t(agent.nameKey)}</p>
                            <p className="text-xs text-muted-foreground">{t(agent.descKey)}</p>
                          </div>
                        </Link>
                      ))}
                      <div className="mt-2 border-t border-gray-100 pt-2">
                        <Link
                          to="/register"
                          onClick={() => setAgentsDropdownOpen(false)}
                          className="flex items-center justify-center gap-2 rounded-xl bg-[#0071DD] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#016AEB]"
                        >
                          Essayer gratuitement <ArrowRight size={14} />
                        </Link>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <Link to="/pricing" className="text-[15px] font-semibold text-foreground/80 transition-colors hover:text-[#0071DD]">
                {t('landing.navPricing')}
              </Link>
              <a href="#contact" className="text-[15px] font-semibold text-foreground/80 transition-colors hover:text-[#0071DD]">
                {t('landing.navContact')}
              </a>
            </nav>
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  const languages = ['fr', 'en', 'ar'];
                  const currentIndex = languages.indexOf(i18n.language);
                  const nextIndex = (currentIndex + 1) % languages.length;
                  i18n.changeLanguage(languages[nextIndex]);
                }}
                className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-[#eef4fc] hover:text-[#1E72B9]"
                title="Change language"
              >
                <Globe size={18} className="text-[#016AEB]" />
                <span className="font-semibold text-[#0071DD]">{i18n.language.toUpperCase()}</span>
              </button>
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden rounded-xl p-2 text-[#1E72B9] transition-colors hover:bg-[#eef4fc]"
              >
                {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
              <div className="hidden md:flex items-center gap-3">
                <Link to="/login">
                  <Button
                    variant="outline"
                    size="lg"
                    className="border-[#BED6F6] bg-white text-[#0071DD] hover:bg-[#e8f1fc]"
                  >
                    {t('auth.signIn')}
                  </Button>
                </Link>
                <Link to="/register">
                  <Button size="lg" className="shadow-glow">
                    {t('auth.signUp')}
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
        
        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t bg-white">
            <div className="px-4 py-4 space-y-3">
              <a href="#features" className="block text-lg text-muted-foreground transition-colors hover:text-[#0071DD]" onClick={() => setMobileMenuOpen(false)}>
                {t('landing.navFeatures')}
              </a>
              <a href="#agents" className="flex items-center gap-2 text-lg text-muted-foreground transition-colors hover:text-[#0071DD]" onClick={() => setMobileMenuOpen(false)}>
                <Sparkles size={16} className="text-[#016AEB]" /> Agents IA
              </a>
              <div className="ml-6 space-y-2">
                {[
                  { icon: Radio, nameKey: 'agents.huntAi.name', color: 'text-orange-600', to: '/agent/hunt-ai' },
                  { icon: Bot, nameKey: 'agents.copilotIa.name', color: 'text-blue-600', to: '/agent/copilot-ia' },
                  { icon: Radar, nameKey: 'agents.scoutAi.name', color: 'text-indigo-600', to: '/agent/scout-ai' },
                  { icon: FileSignature, nameKey: 'agents.offreBot.name', color: 'text-violet-600', to: '/agent/offre-bot' },
                  { icon: ShieldCheck, nameKey: 'agents.factCheckAi.name', color: 'text-emerald-600', to: '/agent/factcheck-ai' },
                  { icon: Megaphone, nameKey: 'agents.brandPulse.name', color: 'text-rose-600', to: '/agent/brand-pulse' },
                ].map((agent) => (
                  <Link key={agent.nameKey} to={agent.to} onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-2 text-sm text-muted-foreground hover:text-[#0071DD]">
                    <agent.icon size={14} className={agent.color} /> {t(agent.nameKey)}
                  </Link>
                ))}
              </div>
              <a href="#why" className="block text-lg text-muted-foreground transition-colors hover:text-[#0071DD]" onClick={() => setMobileMenuOpen(false)}>
                {t('landing.navWhy')}
              </a>
              <Link to="/pricing" className="block text-lg text-muted-foreground transition-colors hover:text-[#0071DD]" onClick={() => setMobileMenuOpen(false)}>
                {t('landing.navPricing')}
              </Link>
              <a href="#contact" className="block text-lg text-muted-foreground transition-colors hover:text-[#0071DD]" onClick={() => setMobileMenuOpen(false)}>
                {t('landing.navContact')}
              </a>
              <div className="pt-4 space-y-2">
                <Link to="/login" onClick={() => setMobileMenuOpen(false)}>
                  <Button
                    variant="outline"
                    size="lg"
                    className="w-full border-[#BED6F6] bg-white text-[#0071DD] hover:bg-[#e8f1fc]"
                  >
                    {t('auth.signIn')}
                  </Button>
                </Link>
                <Link to="/register" onClick={() => setMobileMenuOpen(false)}>
                  <Button size="lg" className="w-full shadow-glow">
                    {t('auth.signUp')}
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Hero — palette KTOptima uniquement (plus de vert / arc-en-ciel) */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white via-[#f4f8fd] to-[#e8f1fc]/80" aria-hidden />
        <div className="pointer-events-none absolute -top-24 left-1/2 h-[32rem] w-[min(100vw,56rem)] -translate-x-1/2 rounded-full bg-[#BED6F6]/35 blur-3xl" aria-hidden />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-32">
          <div className="text-center max-w-4xl mx-auto">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#BED6F6]/70 bg-white/90 px-4 py-2 text-lg font-medium text-[#1E72B9] shadow-sm backdrop-blur-sm">
              <TrendingUp size={24} className="text-[#016AEB]" />
              {t('landing.badge')}
            </div>
            <h1 className="mb-6 text-5xl font-serif font-bold tracking-tight text-foreground md:text-7xl lg:text-8xl">
              {t('landing.heroTitle1')}{' '}
              <span className="bg-gradient-to-r from-[#0071DD] to-[#016AEB] bg-clip-text text-transparent">
                {t('landing.heroTitle2')}
              </span>
            </h1>
            <p className="mb-6 max-w-2xl mx-auto text-xl text-muted-foreground md:text-2xl">
              {t('landing.heroSubtitle')}
            </p>
            <p className="mb-10 inline-flex flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-full border border-[#BED6F6]/60 bg-white/80 px-4 py-2 text-sm font-medium text-[#1E72B9] shadow-sm">
              {t('landing.heroHighlights', { defaultValue: 'CRM · 6 agents IA · Pipeline · Offres · Veille TUNEPS' })}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/register">
                <Button size="lg" className="px-8 text-lg shadow-glow">
                  {t('landing.cta')}
                  <ArrowRight size={20} className="ml-2" />
                </Button>
              </Link>
              <Link to="/login">
                <Button size="lg" variant="outline" className="border-[#BED6F6] px-8 text-lg text-[#0071DD] hover:bg-[#e8f1fc]">
                  {t('landing.demo')}
                </Button>
              </Link>
            </div>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-base text-muted-foreground">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={18} className="shrink-0 text-[#016AEB]" />
                {t('landing.noCommitment')}
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 size={18} className="shrink-0 text-[#016AEB]" />
                {t('landing.localSupport')}
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 size={18} className="shrink-0 text-[#016AEB]" />
                {t('landing.secure')}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Agents IA Section */}
      <section id="agents" className="relative overflow-hidden bg-gradient-to-b from-[#0a2540] to-[#0f3460] py-20 text-white">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(0,113,221,0.25),transparent_70%)]" aria-hidden />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-[#BED6F6] backdrop-blur-sm">
              <Sparkles size={16} /> {t('landing.agentsBadge', { defaultValue: '6 agents IA spécialisés' })}
            </div>
            <h2 className="mb-4 text-4xl font-serif font-bold tracking-tight md:text-5xl">
              Vos collaborateurs IA,{' '}
              <span className="bg-gradient-to-r from-[#BED6F6] to-white bg-clip-text text-transparent">
                disponibles 24/7
              </span>
            </h2>
            <p className="mx-auto max-w-2xl text-lg text-white/70">
              Chaque agent est un expert spécialisé dans une tâche métier. Ils travaillent ensemble pour booster votre activité commerciale.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: Radio, nameKey: 'agents.huntAi.name', descKey: 'agents.huntAi.desc', to: '/agent/hunt-ai',
                color: 'from-orange-500 to-amber-500', iconBg: 'bg-orange-500/20',
                features: ['Recherche multi-sources', 'Lead scoring IA', 'Enrichissement automatique'],
              },
              {
                icon: Bot, nameKey: 'agents.copilotIa.name', descKey: 'agents.copilotIa.desc', to: '/agent/copilot-ia',
                color: 'from-blue-500 to-cyan-500', iconBg: 'bg-blue-500/20',
                features: ['Questions en langage naturel', 'Analyse temps réel', 'Recommandations actions'],
              },
              {
                icon: Radar, nameKey: 'agents.scoutAi.name', descKey: 'agents.scoutAi.desc', to: '/agent/scout-ai',
                color: 'from-indigo-500 to-violet-500', iconBg: 'bg-indigo-500/20',
                features: ["Appels d'offres TUNEPS", 'Événements sectoriels', 'Signaux faibles & news'],
              },
              {
                icon: FileSignature, nameKey: 'agents.offreBot.name', descKey: 'agents.offreBot.desc', to: '/agent/offre-bot',
                color: 'from-violet-500 to-purple-500', iconBg: 'bg-violet-500/20',
                features: ['Génération automatique', 'Personnalisation client', 'Export professionnel'],
              },
              {
                icon: ShieldCheck, nameKey: 'agents.factCheckAi.name', descKey: 'agents.factCheckAi.desc', to: '/agent/factcheck-ai',
                color: 'from-emerald-500 to-teal-500', iconBg: 'bg-emerald-500/20',
                features: ['Vérification multi-sources', 'Score de fiabilité', 'Analyse de pages web'],
              },
              {
                icon: Megaphone, nameKey: 'agents.brandPulse.name', descKey: 'agents.brandPulse.desc', to: '/agent/brand-pulse',
                color: 'from-rose-500 to-pink-600', iconBg: 'bg-rose-500/20',
                features: ['Score marque /100', 'Audit SEO', 'Pipeline blog IA'],
              },
            ].map((agent) => (
              <Link
                key={agent.nameKey}
                to={agent.to}
                className="group relative rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm transition-all hover:border-white/20 hover:bg-white/10"
              >
                <div className={cn('mb-4 flex h-12 w-12 items-center justify-center rounded-xl', agent.iconBg)}>
                  <agent.icon size={24} className="text-white" />
                </div>
                <div className="mb-1 flex items-center gap-2">
                  <h3 className="text-xl font-bold">{t(agent.nameKey)}</h3>
                </div>
                <p className="mb-4 text-sm leading-relaxed text-white/65">{t(agent.descKey)}</p>
                <ul className="mb-4 space-y-1.5">
                  {agent.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-xs text-white/50">
                      <CheckCircle2 size={12} className="shrink-0 text-[#BED6F6]" /> {f}
                    </li>
                  ))}
                </ul>
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#BED6F6] transition-colors group-hover:text-white">
                  En savoir plus <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            ))}
            {/* CTA card */}
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/20 p-6 text-center">
              <Sparkles size={32} className="mb-3 text-[#BED6F6]" />
              <h3 className="mb-2 text-lg font-bold">Activez vos agents</h3>
              <p className="mb-5 text-sm text-white/60">
                Choisissez les agents adaptés à votre métier depuis le marketplace intégré.
              </p>
              <Link to="/register">
                <Button size="lg" className="bg-white text-[#016AEB] hover:bg-white/90 shadow-glow">
                  Démarrer gratuitement <ArrowRight size={16} className="ml-2" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="bg-[#f7faff] py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="mb-4 text-4xl font-serif font-bold tracking-tight text-[#0071DD] md:text-5xl">
              Vendez plus, vendez mieux
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              L'IA travaille pour vous à chaque étape du cycle de vente — de la prospection à la signature.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="rounded-2xl border border-[#BED6F6]/35 bg-white p-6 shadow-card transition-shadow hover:shadow-card-hover">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[#eef4fc] ring-1 ring-[#BED6F6]/50">
                <Radio size={24} className="text-[#016AEB]" />
              </div>
              <h3 className="text-xl font-semibold mb-2 text-foreground">Trouvez vos prospects automatiquement</h3>
              <p className="text-base text-muted-foreground">
                Le Chasseur IA recherche des entreprises cibles selon vos critères : secteur, zone, activité. Des prospects qualifiés sans effort.
              </p>
            </div>
            <div className="rounded-2xl border border-[#BED6F6]/35 bg-white p-6 shadow-card transition-shadow hover:shadow-card-hover">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[#eef4fc] ring-1 ring-[#BED6F6]/50">
                <Radar size={24} className="text-[#1E72B9]" />
              </div>
              <h3 className="text-xl font-semibold mb-2 text-foreground">Ne ratez aucune opportunité</h3>
              <p className="text-base text-muted-foreground">
                Le Veilleur IA surveille les appels d'offres, événements et actualités pour détecter les opportunités qui correspondent à votre activité.
              </p>
            </div>
            <div className="rounded-2xl border border-[#BED6F6]/35 bg-white p-6 shadow-card transition-shadow hover:shadow-card-hover">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[#e8f1fc] ring-1 ring-[#016AEB]/20">
                <FileSignature size={24} className="text-[#0071DD]" />
              </div>
              <h3 className="text-xl font-semibold mb-2 text-foreground">Rédigez vos offres en 30 secondes</h3>
              <p className="text-base text-muted-foreground">
                Le Rédacteur d'offres génère des propositions commerciales personnalisées à partir de vos données CRM. Prêtes à envoyer.
              </p>
            </div>
            <div className="rounded-2xl border border-[#BED6F6]/35 bg-white p-6 shadow-card transition-shadow hover:shadow-card-hover">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[#eef4fc] ring-1 ring-[#BED6F6]/50">
                <Bot size={24} className="text-[#1E72B9]" />
              </div>
              <h3 className="text-xl font-semibold mb-2 text-foreground">Pilotez votre activité en une question</h3>
              <p className="text-base text-muted-foreground">
                L'Assistant IA répond instantanément à vos questions : CA du mois, top clients, pipeline, prévisions. Pas de tableaux à lire, que de l'utile.
              </p>
            </div>
            <div className="rounded-2xl border border-[#BED6F6]/35 bg-white p-6 shadow-card transition-shadow hover:shadow-card-hover">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[#eef4fc] ring-1 ring-[#BED6F6]/50">
                <ShieldCheck size={24} className="text-[#016AEB]" />
              </div>
              <h3 className="text-xl font-semibold mb-2 text-foreground">Vérifiez avant de décider</h3>
              <p className="text-base text-muted-foreground">
                Le Vérificateur IA croise les sources pour valider la fiabilité des informations. Prenez des décisions commerciales basées sur des données vérifiées.
              </p>
            </div>
            <div className="rounded-2xl border border-[#BED6F6]/35 bg-white p-6 shadow-card transition-shadow hover:shadow-card-hover">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-rose-50 ring-1 ring-rose-200/60">
                <Megaphone size={24} className="text-rose-600" />
              </div>
              <h3 className="text-xl font-semibold mb-2 text-foreground">Publiez sans agence marketing</h3>
              <p className="text-base text-muted-foreground">
                BrandPulse AI mesure votre marque sur 6 canaux, propose des sujets d'articles et rédige le contenu blog — pour améliorer votre visibilité sans recruter une équipe marketing.
              </p>
            </div>
            <div className="rounded-2xl border border-[#BED6F6]/35 bg-white p-6 shadow-card transition-shadow hover:shadow-card-hover md:col-span-2 lg:col-span-1">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[#eef4fc] ring-1 ring-[#BED6F6]/50">
                <BarChart3 size={24} className="text-[#0071DD]" />
              </div>
              <h3 className="text-xl font-semibold mb-2 text-foreground">Un CRM conçu pour conclure</h3>
              <p className="text-base text-muted-foreground">
                Pipeline visuel, suivi des affaires, gestion des contacts, objectifs de vente et calendrier — tout ce qu'il faut pour transformer vos prospects en clients.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Why Use Section */}
      <section id="why" className="bg-gradient-to-b from-white via-[#f4f8fd] to-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="mb-6 text-4xl font-serif font-bold tracking-tight text-[#0071DD] md:text-5xl">
                {t('landing.whyTitle')}
              </h2>
              <p className="mb-8 text-xl text-muted-foreground">
                {t('landing.whySubtitle')}
              </p>
              <div className="space-y-4">
                <div className="flex items-start gap-4">
                  <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#eef4fc] ring-1 ring-[#BED6F6]/60">
                    <CheckCircle2 size={16} className="text-[#016AEB]" />
                  </div>
                  <div>
                    <h4 className="font-semibold mb-1">{t('landing.whyLocal')}</h4>
                    <p className="text-base text-muted-foreground">
                      {t('landing.whyLocalDesc')}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#eef4fc] ring-1 ring-[#BED6F6]/60">
                    <CheckCircle2 size={16} className="text-[#016AEB]" />
                  </div>
                  <div>
                    <h4 className="font-semibold mb-1">{t('landing.whyEasy')}</h4>
                    <p className="text-base text-muted-foreground">
                      {t('landing.whyEasyDesc')}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#eef4fc] ring-1 ring-[#BED6F6]/60">
                    <CheckCircle2 size={16} className="text-[#016AEB]" />
                  </div>
                  <div>
                    <h4 className="font-semibold mb-1">{t('landing.whySupport')}</h4>
                    <p className="text-base text-muted-foreground">
                      {t('landing.whySupportDesc')}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#eef4fc] ring-1 ring-[#BED6F6]/60">
                    <CheckCircle2 size={16} className="text-[#016AEB]" />
                  </div>
                  <div>
                    <h4 className="font-semibold mb-1">{t('landing.whyPrice')}</h4>
                    <p className="text-base text-muted-foreground">
                      {t('landing.whyPriceDesc')}
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div className="relative">
              <div className="rounded-3xl bg-gradient-to-br from-[#016AEB] to-[#1E72B9] p-8 text-white shadow-glow">
                <h3 className="mb-4 text-2xl font-bold">{t('landing.ctaTitle')}</h3>
                <p className="mb-6 text-white/85">
                  {t('landing.ctaSubtitle')}
                </p>
                <Link to="/register">
                  <Button size="lg" className="w-full bg-white text-[#016AEB] hover:bg-white/90">
                    {t('landing.ctaButton')}
                    <ArrowRight size={20} className="ml-2" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer id="contact" className="bg-gradient-to-b from-[#1E72B9] to-[#0a2540] py-16 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8 mb-12">
            <div className="md:col-span-2">
              <div className="flex items-center gap-2 mb-4">
                <img
                  src="/logo-ciblix.png"
                  alt="CIBLIX"
                  className="h-12 w-auto max-w-[min(12rem,70vw)] object-contain brightness-0 invert drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)] sm:h-14"
                />
              </div>
              <p className="text-white/75 mb-4 max-w-md text-base">
                {t('landing.footerDesc')}
              </p>
              <div className="flex items-center gap-4">
                <a href="#" className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 transition-colors hover:bg-white/20">
                  <Mail size={20} />
                </a>
                <a href="#" className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 transition-colors hover:bg-white/20">
                  <Phone size={20} />
                </a>
              </div>
            </div>
            <div>
              <h4 className="font-semibold mb-4 text-lg text-[#BED6F6]">{t('landing.footerLinks')}</h4>
              <ul className="space-y-2 text-base text-white/80">
                <li>
                  <a href="#features" className="transition-colors hover:text-white">
                    {t('landing.navFeatures')}
                  </a>
                </li>
                <li>
                  <a href="#why" className="transition-colors hover:text-white">
                    {t('landing.navWhy')}
                  </a>
                </li>
                <li>
                  <Link to="/login" className="transition-colors hover:text-white">
                    {t('auth.signIn')}
                  </Link>
                </li>
                <li>
                  <Link to="/register" className="transition-colors hover:text-white">
                    {t('auth.signUp')}
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4 text-lg text-[#BED6F6]">{t('landing.footerContact')}</h4>
              <ul className="space-y-2 text-base text-white/80">
                <li className="flex items-center gap-2">
                  <Mail size={16} />
                  contact@ciblix.com
                </li>
                <li className="flex items-center gap-2">
                  <Phone size={16} />
                  +216 55 053 505
                </li>
                <li className="flex items-center gap-2">
                  <MapPin size={16} />
                  Tunis, Tunisie
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t border-white/15 pt-8 text-center text-base text-white/65">
            <p>{t('landing.footerRights')}</p>
          </div>
        </div>
      </footer>

      {/* Softfacture — bandeau latéral gauche */}
      {showPopup && (
        <div
          className={cn(
            'fixed inset-y-0 left-0 z-[100] w-[min(19rem,88vw)] flex flex-col shadow-2xl',
            'bg-gradient-to-b from-[#0071DD] via-[#016AEB] to-[#0a2540]',
            'ring-2 ring-brand-soft/40 border-r border-white/20',
            'transition-transform duration-500 ease-out',
            popupExiting || !popupEntered ? '-translate-x-full' : 'translate-x-0',
          )}
          role="complementary"
          aria-label="Softfacture"
        >
          <div className="relative flex flex-1 flex-col justify-center px-5 py-8 text-white">
            <button
              type="button"
              onClick={dismissSoftfactureBanner}
              className="absolute top-3 right-3 rounded-md p-1.5 text-white/80 hover:bg-white/15 hover:text-white transition-colors"
              aria-label="Fermer"
            >
              <X size={18} />
            </button>
            <a
              href="https://softfacture.com"
              target="_blank"
              rel="noopener noreferrer"
              className="group flex flex-col gap-4 pr-6 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80 rounded-md"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm ring-1 ring-white/30">
                <TrendingUp size={24} className="text-white" aria-hidden />
              </div>
              <div>
                <h3 className="text-lg font-bold tracking-tight drop-shadow-sm">Softfacture</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/95">
                  Facturation intelligente et automatisée
                </p>
              </div>
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-[#BED6F6] transition-colors group-hover:text-white drop-shadow-sm">
                Découvrir
                <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
              </span>
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
