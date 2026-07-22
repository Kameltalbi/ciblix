import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, useInView } from 'framer-motion';
import { useRef, type ReactNode } from 'react';
import {
  ArrowDown,
  ArrowRight,
  Briefcase,
  Building2,
  CheckCircle2,
  ClipboardList,
  FileSignature,
  Lock,
  Mail,
  MessageCircle,
  PhoneCall,
  Play,
  Radar,
  Scale,
  Shield,
  ShieldCheck,
  Sparkles,
  Trash2,
  Users,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export const DEMO_URL = (import.meta.env.VITE_DEMO_VIDEO_URL as string | undefined) || '#demo';
export const EXPERT_MAIL = 'mailto:contact@ciblix.com?subject=Parler%20%C3%A0%20un%20expert%20Ciblix';

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
  const steps = [1, 2, 3, 4, 5, 6].map((n) => ({
    title: t(`landingHome.timeline${n}Title`),
    body: t(`landingHome.timeline${n}Body`),
  }));

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

const PRICING_TIERS = [
  {
    id: 'DECOUVERTE',
    nameKey: 'landingHome.tierDecouverte',
    priceTnd: '49',
    priceEur: '19',
    highlight: false,
    featuresKeys: ['landingHome.tierDecouverteF1', 'landingHome.tierDecouverteF2', 'landingHome.tierDecouverteF3'] as const,
    ctaKey: 'landingHome.tierDecouverteCta',
    to: '/register',
  },
  {
    id: 'CROISSANCE',
    nameKey: 'landingHome.tierCroissance',
    priceTnd: '149',
    priceEur: '49',
    highlight: true,
    featuresKeys: ['landingHome.tierCroissanceF1', 'landingHome.tierCroissanceF2', 'landingHome.tierCroissanceF3'] as const,
    ctaKey: 'landingHome.tierCroissanceCta',
    to: '/register',
  },
  {
    id: 'PRO',
    nameKey: 'landingHome.tierPro',
    priceTnd: '299',
    priceEur: '99',
    highlight: false,
    featuresKeys: ['landingHome.tierProF1', 'landingHome.tierProF2', 'landingHome.tierProF3'] as const,
    ctaKey: 'landingHome.tierProCta',
    to: '/register',
  },
  {
    id: 'ENTERPRISE',
    nameKey: 'landingHome.tierEnterprise',
    priceTnd: null as string | null,
    priceEur: null as string | null,
    highlight: false,
    featuresKeys: ['landingHome.tierEnterpriseF1', 'landingHome.tierEnterpriseF2', 'landingHome.tierEnterpriseF3'] as const,
    ctaKey: 'landingHome.tierEnterpriseCta',
    to: EXPERT_MAIL,
    external: true,
  },
] as const;

export function LandingPricing() {
  const { t } = useTranslation();

  return (
    <section id="pricing" className="bg-[#0a2540] py-20 text-white md:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <Reveal>
          <h2 className="mb-4 text-center font-serif text-3xl font-bold tracking-tight md:text-5xl">
            {t('landingHome.pricingTitle')}
          </h2>
          <p className="mx-auto mb-14 max-w-xl text-center text-white/70">{t('landingHome.pricingSubtitle')}</p>
        </Reveal>
        <div className="grid items-stretch gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {PRICING_TIERS.map((tier, i) => (
            <Reveal key={tier.id} delay={i * 0.06} className={tier.highlight ? 'lg:-mt-4 lg:mb-4' : undefined}>
              <div
                className={cn(
                  'relative flex h-full flex-col rounded-3xl border p-6 transition',
                  tier.highlight
                    ? 'border-[#BED6F6] bg-white/15 shadow-2xl ring-2 ring-[#BED6F6]/40'
                    : 'border-white/10 bg-white/5 hover:bg-white/10'
                )}
              >
                {tier.highlight ? (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#016AEB] px-3 py-1 text-xs font-semibold shadow-lg">
                    {t('landingHome.tierPopular')}
                  </span>
                ) : null}
                <h3 className="mb-2 text-xl font-bold">{t(tier.nameKey)}</h3>
                {tier.priceTnd ? (
                  <p className="mb-5">
                    <span className="text-4xl font-bold tracking-tight">{tier.priceTnd}</span>
                    <span className="text-sm text-white/70"> TND/mois</span>
                    <span className="mt-1 block text-sm text-white/50">({tier.priceEur} €)</span>
                  </p>
                ) : (
                  <p className="mb-5 text-3xl font-bold">{t('landingHome.tierCustom')}</p>
                )}
                <ul className="mb-8 flex-1 space-y-2.5 text-sm text-white/80">
                  {tier.featuresKeys.map((fk) => (
                    <li key={fk} className="flex gap-2">
                      <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-[#BED6F6]" />
                      {t(fk)}
                    </li>
                  ))}
                </ul>
                {'external' in tier && tier.external ? (
                  <a href={tier.to} className="mt-auto block">
                    <Button className="w-full bg-white text-[#016AEB] hover:bg-white/90">{t(tier.ctaKey)}</Button>
                  </a>
                ) : (
                  <Link to={tier.to} className="mt-auto block">
                    <Button
                      className={cn(
                        'w-full',
                        tier.highlight ? 'bg-white text-[#016AEB] hover:bg-white/90' : 'bg-[#016AEB] hover:bg-[#0071DD]'
                      )}
                    >
                      {t(tier.ctaKey)}
                    </Button>
                  </Link>
                )}
              </div>
            </Reveal>
          ))}
        </div>
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
    <section id="security" className="bg-white py-20 md:py-28">
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
