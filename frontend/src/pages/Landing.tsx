import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  CheckCircle2,
  ArrowRight,
  Mail,
  Menu,
  X,
  Globe,
  Radio,
  Bot,
  Radar,
  FileSignature,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Play,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  DEMO_URL,
  LandingProofStats,
  LandingProblem,
  LandingSolution,
  LandingVideo,
  LandingCompare,
  LandingUseCases,
  LandingPricing,
  LandingDataTrust,
  LandingFinalCta,
  LandingFooter,
} from '@/components/landing/LandingSections';

const LANDING_AGENTS = [
  {
    icon: Radio,
    nameKey: 'agents.huntAi.name',
    descKey: 'agents.huntAi.desc',
    memoryKey: 'landingHome.agentMemoryHunt',
    iconBg: 'bg-orange-500/20',
    iconColor: 'text-orange-600',
    to: '/agent/hunt-ai',
  },
  {
    icon: Bot,
    nameKey: 'agents.copilotIa.name',
    descKey: 'agents.copilotIa.desc',
    memoryKey: 'landingHome.agentMemoryCopilot',
    iconBg: 'bg-blue-500/20',
    iconColor: 'text-blue-600',
    to: '/agent/copilot-ia',
  },
  {
    icon: Radar,
    nameKey: 'agents.scoutAi.name',
    descKey: 'agents.scoutAi.desc',
    memoryKey: 'landingHome.agentMemoryScout',
    iconBg: 'bg-indigo-500/20',
    iconColor: 'text-indigo-600',
    to: '/agent/scout-ai',
  },
  {
    icon: FileSignature,
    nameKey: 'agents.offreBot.name',
    descKey: 'agents.offreBot.desc',
    memoryKey: 'landingHome.agentMemoryOffre',
    iconBg: 'bg-violet-500/20',
    iconColor: 'text-violet-600',
    to: '/agent/offre-bot',
  },
  {
    icon: Mail,
    nameKey: 'agents.gmailAi.name',
    descKey: 'agents.gmailAi.desc',
    memoryKey: 'landingHome.agentMemoryGmail',
    iconBg: 'bg-sky-500/20',
    iconColor: 'text-sky-600',
    to: '/register',
  },
  {
    icon: ShieldCheck,
    nameKey: 'agents.factCheckAi.name',
    descKey: 'agents.factCheckAi.desc',
    memoryKey: 'landingHome.agentMemoryFact',
    iconBg: 'bg-emerald-500/20',
    iconColor: 'text-emerald-600',
    to: '/agent/factcheck-ai',
  },
] as const;

const SOFTFACTURE_BANNER_SLIDE_MS = 500;

const SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Ciblix',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  description:
    'Plateforme d’agents IA collaboratifs : vos agents trouvent, qualifient et suivent vos prospects — le pipeline se construit automatiquement.',
  url: 'https://ciblix.com',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'TND',
    description: 'Essai Découverte',
  },
  inLanguage: ['fr', 'ar', 'en'],
};

export function Landing() {
  const { i18n, t } = useTranslation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const [popupEntered, setPopupEntered] = useState(false);
  const [popupExiting, setPopupExiting] = useState(false);
  const popupExitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const popupUnmountTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    document.title = t('landing.seoTitle');
    const desc = t('landing.seoDescription');
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'description');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', desc);

    let script = document.getElementById('ciblix-schema') as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement('script');
      script.id = 'ciblix-schema';
      script.type = 'application/ld+json';
      document.head.appendChild(script);
    }
    script.textContent = JSON.stringify(SCHEMA);
  }, [t, i18n.language]);

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
    const visibleMs = 5000;
    popupExitTimerRef.current = setTimeout(() => setPopupExiting(true), enterDelayMs + slideMs + visibleMs);
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

  const demoIsExternal = DEMO_URL.startsWith('http');

  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-50 border-b border-[#BED6F6]/40 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex min-h-[4.25rem] items-center justify-between py-2 sm:min-h-20">
            <Link to="/" className="transition-opacity hover:opacity-80">
              <img
                src="/logo-ciblix.png"
                alt="CIBLIX"
                className="h-[3.9rem] w-auto max-w-[min(16rem,72vw)] object-contain sm:h-16 md:h-[4.5rem]"
              />
            </Link>
            <nav className="ml-auto hidden items-center gap-7 md:flex">
              <a href="#how-it-works" className="text-sm font-semibold text-foreground/70 hover:text-[#0071DD]">
                {t('landing.navFeatures')}
              </a>
              <a href="#use-cases" className="text-sm font-semibold text-foreground/70 hover:text-[#0071DD]">
                {t('landing.navSolutions')}
              </a>
              <a href="#pricing" className="text-sm font-semibold text-foreground/70 hover:text-[#0071DD]">
                {t('landing.navPricing')}
              </a>
              <a href="#resources" className="text-sm font-semibold text-foreground/70 hover:text-[#0071DD]">
                {t('landing.navResources')}
              </a>
            </nav>
            <div className="flex items-center gap-2 sm:gap-3 md:ml-6">
              <button
                type="button"
                onClick={() => {
                  const languages = ['fr', 'en', 'ar'];
                  const currentIndex = languages.indexOf(i18n.language);
                  i18n.changeLanguage(languages[(currentIndex + 1) % languages.length]);
                }}
                className="flex items-center gap-1.5 rounded-xl px-2 py-2 text-sm font-medium text-muted-foreground hover:bg-[#eef4fc]"
              >
                <Globe size={18} className="text-[#016AEB]" />
                <span className="font-semibold text-[#0071DD]">{i18n.language.toUpperCase()}</span>
              </button>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="rounded-xl p-2 text-[#1E72B9] hover:bg-[#eef4fc] md:hidden"
              >
                {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
              <div className="hidden items-center gap-2 md:flex">
                <Link to="/login">
                  <Button variant="outline" className="border-[#BED6F6] text-[#0071DD] hover:bg-[#e8f1fc]">
                    {t('auth.signIn')}
                  </Button>
                </Link>
                <Link to="/register">
                  <Button className="shadow-glow">{t('landing.cta')}</Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
        {mobileMenuOpen && (
          <div className="border-t bg-white md:hidden">
            <div className="space-y-3 px-4 py-4">
              <a href="#how-it-works" className="block text-lg text-muted-foreground" onClick={() => setMobileMenuOpen(false)}>
                {t('landing.navFeatures')}
              </a>
              <a href="#use-cases" className="block text-lg text-muted-foreground" onClick={() => setMobileMenuOpen(false)}>
                {t('landing.navSolutions')}
              </a>
              <a href="#pricing" className="block text-lg text-muted-foreground" onClick={() => setMobileMenuOpen(false)}>
                {t('landing.navPricing')}
              </a>
              <a href="#resources" className="block text-lg text-muted-foreground" onClick={() => setMobileMenuOpen(false)}>
                {t('landing.navResources')}
              </a>
              <Link to="/login" onClick={() => setMobileMenuOpen(false)}>
                <Button variant="outline" className="mt-2 w-full border-[#BED6F6] text-[#0071DD]">
                  {t('auth.signIn')}
                </Button>
              </Link>
              <Link to="/register" onClick={() => setMobileMenuOpen(false)}>
                <Button className="w-full shadow-glow">{t('landing.cta')}</Button>
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#f7faff] via-white to-[#e8f1fc]/60" />
        <div className="pointer-events-none absolute -left-32 top-0 h-[28rem] w-[28rem] rounded-full bg-[#BED6F6]/40 blur-3xl" />
        <div className="pointer-events-none absolute -right-20 bottom-0 h-[24rem] w-[24rem] rounded-full bg-[#016AEB]/10 blur-3xl" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 py-16 sm:px-6 md:py-24 lg:grid-cols-2 lg:gap-16 lg:px-8">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }}>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#BED6F6]/70 bg-white/80 px-3.5 py-1.5 text-sm font-medium text-[#1E72B9] shadow-sm backdrop-blur-md">
              <Sparkles size={16} className="text-[#016AEB]" />
              {t('landing.badge')}
            </div>
            <h1 className="mb-5 font-serif text-4xl font-bold leading-[1.1] tracking-tight text-foreground sm:text-5xl lg:text-[3.25rem]">
              {t('landing.heroTitle')}
            </h1>
            <p className="mb-8 max-w-xl text-lg leading-relaxed text-muted-foreground md:text-xl">
              {t('landing.heroSubtitle')}
            </p>
            <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link to="/register">
                <Button size="lg" className="w-full px-8 text-base shadow-glow sm:w-auto">
                  {t('landing.cta')}
                  <ArrowRight size={18} className="ml-2" />
                </Button>
              </Link>
              <a href={DEMO_URL} target={demoIsExternal ? '_blank' : undefined} rel="noreferrer">
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full border-[#BED6F6] px-8 text-base text-[#0071DD] hover:bg-[#e8f1fc] sm:w-auto"
                >
                  <Play size={16} className="mr-2 fill-current" />
                  {t('landing.demo')}
                </Button>
              </a>
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
              {[t('landing.noCommitment'), t('landing.localSupport'), t('landing.secure'), t('landing.multilingual')].map(
                (label) => (
                  <div key={label} className="flex items-center gap-1.5">
                    <CheckCircle2 size={15} className="text-[#016AEB]" />
                    {label}
                  </div>
                )
              )}
            </div>
          </motion.div>
          <motion.div
            className="flex justify-center lg:justify-end"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.15 }}
          >
            <img
              src="/hero-dashboard.png"
              alt="Tableau de bord Ciblix — pipeline commercial et agents IA"
              className="h-auto w-full max-w-[560px] object-contain drop-shadow-xl lg:max-w-none"
              width={1024}
              height={1024}
              decoding="async"
              fetchPriority="high"
            />
          </motion.div>
        </div>
      </section>

      <LandingProofStats />
      <LandingProblem />
      <LandingSolution />
      <LandingVideo />

      {/* Agents team */}
      <section id="agents" className="relative overflow-hidden bg-gradient-to-b from-[#0a2540] to-[#0f3460] py-20 text-white md:py-28">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(0,113,221,0.28),transparent_65%)]" />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-14 text-center">
            <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-[#BED6F6]">{t('landing.agentsBadge')}</p>
            <h2 className="mb-4 font-serif text-3xl font-bold tracking-tight md:text-5xl">{t('landing.agentsSectionTitle')}</h2>
            <p className="mx-auto max-w-2xl text-lg text-white/70">{t('landing.agentsIntro')}</p>
          </div>
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {LANDING_AGENTS.map((agent) => (
              <Link
                key={agent.nameKey}
                to={agent.to}
                className="group rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm transition hover:-translate-y-1 hover:border-white/25 hover:bg-white/10 hover:shadow-xl"
              >
                <div className={cn('mb-4 flex h-12 w-12 items-center justify-center rounded-2xl', agent.iconBg)}>
                  <agent.icon size={22} className="text-white" />
                </div>
                <h3 className="mb-1 text-xl font-bold">{t(agent.nameKey)}</h3>
                <p className="mb-2 text-sm text-white/65">{t(agent.descKey)}</p>
                <p className="mb-5 text-xs leading-relaxed text-[#BED6F6]">{t(agent.memoryKey)}</p>
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#BED6F6] group-hover:text-white">
                  {t('landing.learnMore')}
                  <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            ))}
          </div>
          <div className="mt-12 text-center">
            <Link to="/register">
              <Button size="lg" className="bg-white text-[#016AEB] shadow-glow hover:bg-white/90">
                {t('landing.cta')}
                <ArrowRight size={16} className="ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <LandingCompare />
      <LandingUseCases />
      <LandingPricing />
      <LandingDataTrust />
      <LandingFinalCta />
      <LandingFooter />

      {showPopup && (
        <div
          className={cn(
            'fixed inset-y-0 left-0 z-[100] flex w-[min(19rem,88vw)] flex-col shadow-2xl',
            'bg-gradient-to-b from-[#0071DD] via-[#016AEB] to-[#0a2540]',
            'border-r border-white/20 ring-2 ring-brand-soft/40',
            'transition-transform duration-500 ease-out',
            popupExiting || !popupEntered ? '-translate-x-full' : 'translate-x-0'
          )}
          role="complementary"
          aria-label="Softfacture"
        >
          <div className="relative flex flex-1 flex-col justify-center px-5 py-8 text-white">
            <button
              type="button"
              onClick={dismissSoftfactureBanner}
              className="absolute right-3 top-3 rounded-md p-1.5 text-white/80 hover:bg-white/15"
              aria-label="Fermer"
            >
              <X size={18} />
            </button>
            <a
              href="https://softfacture.com"
              target="_blank"
              rel="noopener noreferrer"
              className="group flex flex-col gap-4 pr-6"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 ring-1 ring-white/30">
                <TrendingUp size={24} />
              </div>
              <div>
                <h3 className="text-lg font-bold">Softfacture</h3>
                <p className="mt-2 text-sm text-white/95">Facturation intelligente et automatisée</p>
              </div>
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-[#BED6F6] group-hover:text-white">
                Découvrir <ArrowRight size={16} />
              </span>
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
