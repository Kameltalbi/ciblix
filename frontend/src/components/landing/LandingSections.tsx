import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, useInView } from 'framer-motion';
import { useRef, useState, type ReactNode } from 'react';
import {
  ArrowDown,
  ArrowRight,
  Briefcase,
  Building2,
  CheckCircle2,
  ClipboardList,
  FileSignature,
  Globe,
  Globe2,
  Lock,
  Mail,
  Menu,
  MessageCircle,
  PhoneCall,
  Play,
  Radar,
  Rocket,
  Scale,
  Shield,
  ShieldCheck,
  Sparkles,
  Trash2,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export const DEMO_URL = (import.meta.env.VITE_DEMO_VIDEO_URL as string | undefined) || '#demo';
export const EXPERT_MAIL = 'mailto:contact@ciblix.com?subject=Parler%20%C3%A0%20un%20expert%20Ciblix';

const NAV_LINKS = [
  { to: '/fonctionnalites', labelKey: 'landing.navFeatures' },
  { to: '/solutions', labelKey: 'landing.navSolutions' },
  { to: '/tarifs', labelKey: 'landing.navPricing' },
  { to: '/ressources', labelKey: 'landing.navResources' },
] as const;

/** Shared marketing header (home + Fonctionnalités / Solutions / Tarifs / Ressources) */
export function LandingHeader() {
  const { i18n, t } = useTranslation();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const linkClass = (to: string) =>
    cn(
      'text-sm font-bold transition-colors hover:text-[#0071DD]',
      location.pathname === to || location.pathname.startsWith(`${to}/`)
        ? 'text-[#0071DD]'
        : 'text-foreground/80'
    );

  return (
    <header className="sticky top-0 z-50 border-b border-[#BED6F6]/40 bg-white/80 backdrop-blur-xl">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex min-h-[4.25rem] items-center justify-between py-2 sm:min-h-20">
          <div className="flex min-w-0 items-center gap-8 lg:gap-10">
            <Link to="/" className="shrink-0 transition-opacity hover:opacity-80">
              <img
                src="/logo-ciblix.png"
                alt="CIBLIX"
                className="h-[3.9rem] w-auto max-w-[min(16rem,72vw)] object-contain sm:h-16 md:h-[4.5rem]"
              />
            </Link>
            <nav className="hidden items-center gap-6 md:flex lg:gap-8">
              {NAV_LINKS.map((link) => (
                <Link key={link.to} to={link.to} className={linkClass(link.to)}>
                  {t(link.labelKey)}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
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
              aria-expanded={mobileMenuOpen}
              aria-label="Menu"
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            <div className="hidden items-center gap-2 md:flex">
              <Link to="/login">
                <Button variant="outline" className="border-[#BED6F6] text-[#0071DD] hover:bg-[#e8f1fc]">
                  {t('landing.headerLogin')}
                </Button>
              </Link>
              <Link to="/register">
                <Button className="shadow-glow">{t('landing.headerRegister')}</Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
      {mobileMenuOpen ? (
        <div className="border-t bg-white md:hidden">
          <div className="space-y-3 px-4 py-4">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={cn('block text-lg font-bold', linkClass(link.to))}
                onClick={() => setMobileMenuOpen(false)}
              >
                {t(link.labelKey)}
              </Link>
            ))}
            <Link to="/login" onClick={() => setMobileMenuOpen(false)}>
              <Button variant="outline" className="mt-2 w-full border-[#BED6F6] text-[#0071DD]">
                {t('landing.headerLogin')}
              </Button>
            </Link>
            <Link to="/register" onClick={() => setMobileMenuOpen(false)}>
              <Button className="w-full shadow-glow">{t('landing.headerRegister')}</Button>
            </Link>
          </div>
        </div>
      ) : null}
    </header>
  );
}

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0 },
};

function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });
  return (
    <motion.div
      ref={ref}
      className={className}
      initial="hidden"
      animate={inView ? 'visible' : 'hidden'}
      variants={fadeUp}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay }}
    >
      {children}
    </motion.div>
  );
}

export function LandingProofStats() {
  const { t } = useTranslation();
  const stats = [
    { label: t('landingHome.statAgents'), icon: Sparkles },
    { label: t('landingHome.statPipeline'), icon: ClipboardList },
    { label: t('landingHome.statChannels'), icon: MessageCircle },
    { label: t('landingHome.statLang'), icon: Users },
  ];

  return (
    <section className="relative -mt-8 pb-8 md:-mt-12" aria-label={t('landingHome.statsAria')}>
      <div className="mx-auto grid max-w-6xl gap-4 px-4 sm:grid-cols-2 lg:grid-cols-4 sm:px-6">
        {stats.map((stat, i) => (
          <Reveal key={stat.label} delay={i * 0.06}>
            <div className="group rounded-2xl border border-white/60 bg-white/70 p-5 shadow-[0_8px_30px_rgba(1,106,235,0.08)] backdrop-blur-xl transition hover:-translate-y-1 hover:shadow-[0_16px_40px_rgba(1,106,235,0.14)]">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-[#eef4fc] text-[#016AEB] transition group-hover:scale-105">
                <stat.icon size={20} />
              </div>
              <p className="text-sm font-semibold leading-snug text-foreground md:text-base">{stat.label}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

export function LandingProblem() {
  const { t } = useTranslation();
  const pains = [
    { title: t('landingHome.problemCard1Title'), body: t('landingHome.problemCard1Body'), icon: ClipboardList },
    { title: t('landingHome.problemCard2Title'), body: t('landingHome.problemCard2Body'), icon: PhoneCall },
    { title: t('landingHome.problemCard3Title'), body: t('landingHome.problemCard3Body'), icon: XCircle },
  ];

  return (
    <section id="problem" className="bg-white py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Reveal>
          <h2 className="mx-auto mb-4 max-w-2xl text-center font-serif text-3xl font-bold tracking-tight text-foreground md:text-5xl">
            {t('landingHome.problemTitle')}
          </h2>
          <p className="mx-auto mb-14 max-w-xl text-center text-muted-foreground md:text-lg">
            {t('landingHome.problemLead')}
          </p>
        </Reveal>
        <div className="grid gap-6 md:grid-cols-3">
          {pains.map((p, i) => (
            <Reveal key={p.title} delay={i * 0.08}>
              <div className="h-full rounded-3xl border border-[#BED6F6]/40 bg-[#f7faff] p-7 transition hover:border-[#016AEB]/30 hover:bg-white hover:shadow-lg">
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-500">
                  <p.icon size={22} />
                </div>
                <h3 className="mb-2 text-lg font-semibold text-foreground">{p.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{p.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

export function LandingSolution() {
  const { t } = useTranslation();
  const steps = [1, 2, 3, 4].map((n) => ({
    title: t(`landingHome.timeline${n}Title`),
    body: t(`landingHome.timeline${n}Body`),
  }));
  const isExternal = DEMO_URL.startsWith('http');

  return (
    <section id="how-it-works" className="bg-[#f7faff] py-20 md:py-28">
      <div className="mx-auto max-w-4xl px-4 sm:px-6">
        <Reveal>
          <h2 className="mb-4 text-center font-serif text-3xl font-bold tracking-tight md:text-5xl">
            {t('landingHome.howTitle')}
          </h2>
          <p className="mx-auto mb-14 max-w-2xl text-center text-muted-foreground md:text-lg">
            {t('landingHome.howLead')}
          </p>
        </Reveal>
        <div className="relative space-y-0">
          {steps.map((step, i) => (
            <Reveal key={step.title} delay={i * 0.05}>
              <div className="relative flex gap-4 pb-2 md:gap-6">
                <div className="flex flex-col items-center">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#0071DD] text-sm font-bold text-white shadow-glow">
                    {i + 1}
                  </div>
                  {i < steps.length - 1 ? (
                    <div className="my-1 flex flex-1 flex-col items-center text-[#BED6F6]">
                      <div className="h-full min-h-[28px] w-px bg-gradient-to-b from-[#016AEB] to-[#BED6F6]" />
                      <ArrowDown size={16} className="text-[#016AEB]" />
                    </div>
                  ) : null}
                </div>
                <div className="mb-6 flex-1 rounded-2xl border border-[#BED6F6]/50 bg-white/80 p-5 shadow-sm backdrop-blur-sm transition hover:shadow-md md:p-6">
                  <h3 className="mb-1 text-base font-semibold md:text-lg">{step.title}</h3>
                  <p className="text-sm text-muted-foreground">{step.body}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
        <Reveal delay={0.2}>
          <div className="mt-4 text-center">
            <a
              href={DEMO_URL}
              target={isExternal ? '_blank' : undefined}
              rel={isExternal ? 'noreferrer' : undefined}
              className="inline-flex items-center gap-2 text-base font-semibold text-[#0071DD] transition hover:text-[#016AEB]"
            >
              {t('landingHome.howCta')}
              <ArrowRight size={16} />
            </a>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export function LandingDifferentiation() {
  const { t } = useTranslation();
  const points = [
    { title: t('landingHome.diff1Title'), body: t('landingHome.diff1Body'), icon: Globe2 },
    { title: t('landingHome.diff2Title'), body: t('landingHome.diff2Body'), icon: MessageCircle },
    { title: t('landingHome.diff3Title'), body: t('landingHome.diff3Body'), icon: Rocket },
  ];

  return (
    <section id="differentiation" className="bg-white py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Reveal>
          <h2 className="mx-auto mb-14 max-w-3xl text-center font-serif text-3xl font-bold tracking-tight md:text-5xl">
            {t('landingHome.diffTitle')}
          </h2>
        </Reveal>
        <div className="grid gap-6 md:grid-cols-3">
          {points.map((p, i) => (
            <Reveal key={p.title} delay={i * 0.08}>
              <div className="h-full rounded-3xl border border-[#BED6F6]/40 bg-[#f7faff] p-7 transition hover:border-[#016AEB]/30 hover:bg-white hover:shadow-lg">
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#eef4fc] text-[#016AEB]">
                  <p.icon size={22} />
                </div>
                <h3 className="mb-2 text-lg font-semibold text-foreground">{p.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{p.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

export function LandingVideo() {
  const { t } = useTranslation();
  const isExternal = DEMO_URL.startsWith('http');

  return (
    <section id="demo" className="bg-white py-20 md:py-28">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <Reveal>
          <h2 className="mb-4 text-center font-serif text-3xl font-bold tracking-tight md:text-5xl">
            {t('landingHome.videoTitle')}
          </h2>
          <p className="mx-auto mb-10 max-w-xl text-center text-muted-foreground">
            {t('landingHome.videoLead')}
          </p>
        </Reveal>
        <Reveal delay={0.1}>
          <a
            href={DEMO_URL}
            target={isExternal ? '_blank' : undefined}
            rel={isExternal ? 'noreferrer' : undefined}
            className="group relative block overflow-hidden rounded-3xl border border-[#BED6F6]/50 bg-gradient-to-br from-[#0a2540] via-[#016AEB] to-[#1E72B9] shadow-2xl aspect-video"
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(190,214,246,0.35),transparent_55%)]" />
            <div className="relative flex h-full flex-col items-center justify-center gap-4 p-8 text-center text-white">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/40 backdrop-blur-md transition group-hover:scale-110 group-hover:bg-white/25">
                <Play size={32} className="ml-1 fill-white" />
              </div>
              <p className="text-lg font-semibold md:text-xl">{t('landingHome.videoCta')}</p>
              <p className="text-sm text-white/70">{t('landingHome.videoHint')}</p>
            </div>
          </a>
        </Reveal>
      </div>
    </section>
  );
}

export function LandingCompare() {
  const { t } = useTranslation();
  const rows = [
    { classic: t('landingHome.compare1Classic'), ciblix: t('landingHome.compare1Ciblix') },
    { classic: t('landingHome.compare2Classic'), ciblix: t('landingHome.compare2Ciblix') },
    { classic: t('landingHome.compare3Classic'), ciblix: t('landingHome.compare3Ciblix') },
    { classic: t('landingHome.compare4Classic'), ciblix: t('landingHome.compare4Ciblix') },
  ];

  return (
    <section id="compare" className="bg-[#f7faff] py-20 md:py-28">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <Reveal>
          <h2 className="mb-4 text-center font-serif text-3xl font-bold tracking-tight md:text-5xl">
            {t('landingHome.compareTitle')}
          </h2>
          <p className="mx-auto mb-12 max-w-xl text-center text-muted-foreground">
            {t('landingHome.compareLead')}
          </p>
        </Reveal>
        <Reveal>
          <div className="overflow-hidden rounded-3xl border border-[#BED6F6]/50 bg-white shadow-lg">
            <div className="grid grid-cols-2 border-b border-[#BED6F6]/40 bg-[#f4f8fd]">
              <div className="p-4 text-center text-sm font-semibold text-muted-foreground md:p-5 md:text-base">
                {t('landingHome.compareCrm')}
              </div>
              <div className="border-l border-[#BED6F6]/40 bg-[#0071DD] p-4 text-center text-sm font-semibold text-white md:p-5 md:text-base">
                Ciblix
              </div>
            </div>
            {rows.map((row) => (
              <div key={row.classic} className="grid grid-cols-2 border-b border-[#BED6F6]/30 last:border-0">
                <div className="flex items-start gap-2 p-4 text-sm text-muted-foreground md:p-5">
                  <XCircle size={16} className="mt-0.5 shrink-0 text-rose-400" />
                  {row.classic}
                </div>
                <div className="flex items-start gap-2 border-l border-[#BED6F6]/30 bg-[#eef4fc]/50 p-4 text-sm font-medium text-foreground md:p-5">
                  <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-[#016AEB]" />
                  {row.ciblix}
                </div>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export function LandingUseCases() {
  const { t } = useTranslation();
  const cases = [
    { title: t('landingHome.use1Title'), body: t('landingHome.use1Body'), icon: Scale },
    { title: t('landingHome.use2Title'), body: t('landingHome.use2Body'), icon: Building2 },
    { title: t('landingHome.use3Title'), body: t('landingHome.use3Body'), icon: Sparkles },
    { title: t('landingHome.use4Title'), body: t('landingHome.use4Body'), icon: Briefcase },
  ];

  return (
    <section id="use-cases" className="bg-white py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Reveal>
          <h2 className="mb-14 text-center font-serif text-3xl font-bold tracking-tight md:text-5xl">
            {t('landingHome.useTitle')}
          </h2>
        </Reveal>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {cases.map((c, i) => (
            <Reveal key={c.title} delay={i * 0.07}>
              <div className="group h-full rounded-3xl border border-[#BED6F6]/40 bg-gradient-to-b from-white to-[#f7faff] p-6 transition hover:-translate-y-1 hover:border-[#016AEB]/35 hover:shadow-xl">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#eef4fc] text-[#016AEB] transition group-hover:scale-105">
                  <c.icon size={26} />
                </div>
                <h3 className="mb-2 text-lg font-semibold">{c.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{c.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

export function LandingPricing() {
  const { t } = useTranslation();

  return (
    <section id="pricing" className="bg-[#0a2540] py-20 text-white md:py-28">
      <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
        <Reveal>
          <h2 className="mb-6 font-serif text-3xl font-bold tracking-tight md:text-5xl">
            {t('landingHome.pricingTitle')}
          </h2>
          <p className="mb-4 text-lg text-white/80 md:text-xl">{t('landingHome.pricingTeaser')}</p>
          <p className="mx-auto mb-10 max-w-xl text-base text-[#BED6F6]">{t('landingHome.pricingPopular')}</p>
          <Link to="/tarifs">
            <Button size="lg" className="bg-white px-8 text-base text-[#016AEB] shadow-glow hover:bg-white/90">
              {t('landingHome.pricingCta')}
              <ArrowRight size={18} className="ml-2" />
            </Button>
          </Link>
        </Reveal>
      </div>
    </section>
  );
}

export function LandingDataTrust() {
  const { t } = useTranslation();
  const points = [
    { title: t('landingHome.trust1Title'), body: t('landingHome.trust1'), icon: ShieldCheck },
    { title: t('landingHome.trust2Title'), body: t('landingHome.trust2'), icon: Trash2 },
    { title: t('landingHome.trust3Title'), body: t('landingHome.trust3'), icon: Lock },
    { title: t('landingHome.trust4Title'), body: t('landingHome.trust4'), icon: Shield },
  ];

  return (
    <section id="resources" className="bg-white py-20 md:py-28">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <Reveal>
          <h2 className="mb-4 text-center font-serif text-3xl font-bold tracking-tight md:text-4xl">
            {t('landingHome.trustTitle')}
          </h2>
          <p className="mx-auto mb-12 max-w-xl text-center text-muted-foreground">{t('landingHome.trustLead')}</p>
        </Reveal>
        <div className="grid gap-5 sm:grid-cols-2">
          {points.map((p, i) => (
            <Reveal key={p.title} delay={i * 0.06}>
              <div className="flex gap-4 rounded-2xl border border-[#BED6F6]/40 bg-[#f7faff] p-5 transition hover:bg-white hover:shadow-md">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-[#016AEB] shadow-sm">
                  <p.icon size={20} />
                </div>
                <div>
                  <h3 className="mb-1 font-semibold">{p.title}</h3>
                  <p className="text-sm text-muted-foreground">{p.body}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

export function LandingFinalCta() {
  const { t } = useTranslation();

  return (
    <section className="relative overflow-hidden py-24 md:py-32">
      <div className="absolute inset-0 bg-gradient-to-br from-[#0071DD] via-[#016AEB] to-[#0a2540]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(190,214,246,0.25),transparent_60%)]" />
      <div className="relative mx-auto max-w-3xl px-4 text-center text-white sm:px-6">
        <Reveal>
          <h2 className="mb-8 font-serif text-3xl font-bold tracking-tight md:text-5xl">{t('landingHome.finalTitle')}</h2>
          <div className="flex flex-col justify-center gap-4 sm:flex-row">
            <Link to="/register">
              <Button size="lg" className="bg-white px-10 text-base text-[#016AEB] shadow-glow hover:bg-white/90">
                {t('landing.cta')}
                <ArrowRight size={18} className="ml-2" />
              </Button>
            </Link>
            <a href={EXPERT_MAIL}>
              <Button
                size="lg"
                variant="outline"
                className="border-white/40 bg-transparent px-10 text-base text-white hover:bg-white/10"
              >
                {t('landingHome.finalExpert')}
              </Button>
            </a>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

const footerLinkClass =
  'text-[14px] font-medium text-neutral-500 transition-colors hover:text-neutral-900';

export function LandingFooter() {
  const { t } = useTranslation();

  const product = [
    { label: t('landing.navFeatures'), href: '/fonctionnalites', isRoute: true },
    { label: t('landing.navSolutions'), href: '/solutions', isRoute: true },
    { label: t('landing.navPricing'), href: '/tarifs', isRoute: true },
    { label: t('landing.footerSecurity'), href: '#resources' },
  ];
  const resources = [
    { label: t('landing.navResources'), href: '/ressources', isRoute: true },
    { label: t('landing.footerBlog'), href: '/ressources', isRoute: true },
    { label: t('landing.footerDocs'), href: '/ressources', isRoute: true },
    { label: t('landing.footerFaq'), href: '/ressources', isRoute: true },
  ];
  const company = [
    { label: t('landing.footerAbout'), href: 'mailto:contact@ciblix.com?subject=%C3%80%20propos%20de%20Ciblix' },
    { label: t('landing.footerContact'), href: 'mailto:contact@ciblix.com' },
    { label: t('landing.footerPrivacy'), to: '/legal/privacy' },
    { label: t('landing.footerTerms'), to: '/legal/cgu' },
  ];

  return (
    <footer className="border-t border-neutral-200/80 bg-[#FAFAFC]">
      <div className="mx-auto max-w-[1280px] px-6 py-14 sm:px-8">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-12">
          <div className="sm:col-span-2 lg:col-span-1">
            <Link to="/" className="inline-block">
              <img
                src="/logo-ciblix.png"
                alt="CIBLIX"
                className="mb-4 h-9 w-auto max-w-[9.5rem] object-contain"
              />
            </Link>
            <p className="max-w-xs text-[14px] leading-relaxed text-neutral-500">{t('landing.footerDesc')}</p>
          </div>

          <div>
            <h3 className="mb-4 text-base font-semibold text-neutral-900">{t('landing.footerProduct')}</h3>
            <ul className="space-y-3">
              {product.map((item) => (
                <li key={item.label}>
                  {'isRoute' in item && item.isRoute ? (
                    <Link to={item.href} className={footerLinkClass}>
                      {item.label}
                    </Link>
                  ) : (
                    <a href={item.href} className={footerLinkClass}>
                      {item.label}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="mb-4 text-base font-semibold text-neutral-900">{t('landing.footerResources')}</h3>
            <ul className="space-y-3">
              {resources.map((item) => (
                <li key={item.label}>
                  {'isRoute' in item && item.isRoute ? (
                    <Link to={item.href} className={footerLinkClass}>
                      {item.label}
                    </Link>
                  ) : (
                    <a href={item.href} className={footerLinkClass}>
                      {item.label}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="mb-4 text-base font-semibold text-neutral-900">{t('landing.footerCompany')}</h3>
            <ul className="space-y-3">
              {company.map((item) => (
                <li key={item.label}>
                  {'to' in item && item.to ? (
                    <Link to={item.to} className={footerLinkClass}>
                      {item.label}
                    </Link>
                  ) : (
                    <a href={'href' in item ? item.href : '#'} className={footerLinkClass}>
                      {item.label}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <p className="mt-12 text-center text-[13px] font-medium tracking-wide text-neutral-500">
          🇹🇳 {t('landing.footerCredibility')}
        </p>

        <div className="mt-6 flex flex-col items-center justify-between gap-4 border-t border-neutral-200/80 pt-6 sm:flex-row">
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[13px] text-neutral-500">
            <span>{t('landing.footerRights')}</span>
            <span className="hidden text-neutral-300 sm:inline" aria-hidden>
              ·
            </span>
            <span>
              {t('landing.footerMadeIn')} 🇹🇳
            </span>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="https://www.linkedin.com/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="LinkedIn"
              className="rounded-md p-1.5 text-neutral-400 transition-colors hover:text-neutral-800"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden>
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
              </svg>
            </a>
            <a
              href="https://www.youtube.com/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="YouTube"
              className="rounded-md p-1.5 text-neutral-400 transition-colors hover:text-neutral-800"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden>
                <path d="M23.498 6.186a2.997 2.997 0 00-2.11-2.122C19.505 3.546 12 3.546 12 3.546s-7.505 0-9.388.518A2.997 2.997 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a2.997 2.997 0 002.11 2.122c1.883.518 9.388.518 9.388.518s7.505 0 9.388-.518a2.997 2.997 0 002.11-2.122C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
              </svg>
            </a>
            <a
              href="https://x.com/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="X"
              className="rounded-md p-1.5 text-neutral-400 transition-colors hover:text-neutral-800"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden>
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

/** Decorative hero illustration — agents around a shared pipeline */
export function HeroPipelineIllustration({ className }: { className?: string }) {
  const nodes = [
    { label: 'Chasseur', x: 18, y: 22, Icon: Sparkles },
    { label: 'Assistant', x: 82, y: 22, Icon: MessageCircle },
    { label: 'Veilleur', x: 12, y: 58, Icon: Radar },
    { label: 'Gmail', x: 88, y: 58, Icon: Mail },
    { label: 'Offres', x: 28, y: 88, Icon: FileSignature },
    { label: 'Vérif.', x: 72, y: 88, Icon: ShieldCheck },
  ];

  return (
    <div className={cn('relative aspect-square w-full max-w-lg', className)}>
      <div className="absolute inset-0 rounded-[2rem] bg-gradient-to-br from-white/80 to-[#e8f1fc]/90 shadow-2xl ring-1 ring-[#BED6F6]/50 backdrop-blur-xl" />
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" aria-hidden>
        {nodes.map((n) => (
          <line
            key={`line-${n.label}`}
            x1={n.x}
            y1={n.y}
            x2={50}
            y2={50}
            stroke="#BED6F6"
            strokeWidth="0.6"
            strokeDasharray="1.5 1.5"
          />
        ))}
        <circle cx="50" cy="50" r="14" fill="#0071DD" opacity="0.95" />
        <circle cx="50" cy="50" r="18" fill="none" stroke="#BED6F6" strokeWidth="0.5" opacity="0.8" />
      </svg>
      <div className="absolute left-1/2 top-1/2 z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center text-center text-white">
        <ClipboardList size={22} className="mb-1" />
        <span className="text-[10px] font-bold uppercase tracking-wider">Pipeline</span>
      </div>
      {nodes.map((n, i) => (
        <motion.div
          key={n.label}
          className="absolute z-20 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
          style={{ left: `${n.x}%`, top: `${n.y}%` }}
          animate={{ y: [0, -4, 0] }}
          transition={{ duration: 3 + i * 0.2, repeat: Infinity, ease: 'easeInOut' }}
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/70 bg-white/90 text-[#016AEB] shadow-lg backdrop-blur-md">
            <n.Icon size={18} />
          </div>
          <span className="mt-1 rounded-full bg-white/90 px-2 py-0.5 text-[9px] font-semibold text-[#0a2540] shadow-sm">
            {n.label}
          </span>
        </motion.div>
      ))}
    </div>
  );
}
