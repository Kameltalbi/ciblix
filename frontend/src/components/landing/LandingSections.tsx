import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowRight,
  CheckCircle2,
  Globe,
  MessageCircle,
  Rocket,
  Shield,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const DEMO_URL = import.meta.env.VITE_DEMO_VIDEO_URL || '#how-it-works';
const EXPERT_MAIL = 'mailto:contact@ciblix.com?subject=Parler%20à%20un%20expert%20Ciblix';

export function LandingProblem() {
  const { t } = useTranslation();
  const pains = [
    t('landingHome.problem1'),
    t('landingHome.problem2'),
    t('landingHome.problem3'),
  ];

  return (
    <section id="problem" className="bg-white py-20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
        <h2 className="text-3xl md:text-4xl font-serif font-bold text-foreground mb-10 leading-tight">
          {t('landingHome.problemTitle')}
        </h2>
        <div className="space-y-4 text-left max-w-2xl mx-auto mb-10">
          {pains.map((p) => (
            <div key={p} className="flex gap-3 text-muted-foreground">
              <XCircle className="shrink-0 text-rose-500 mt-0.5" size={20} />
              <p>{p}</p>
            </div>
          ))}
        </div>
        <p className="text-lg font-medium text-[#0071DD]">{t('landingHome.problemTransition')}</p>
      </div>
    </section>
  );
}

export function LandingHowItWorks() {
  const { t } = useTranslation();
  const steps = [1, 2, 3, 4].map((n) => ({
    title: t(`landingHome.step${n}Title`),
    body: t(`landingHome.step${n}Body`),
  }));

  return (
    <section id="how-it-works" className="bg-[#f7faff] py-20">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <h2 className="text-center text-3xl md:text-4xl font-serif font-bold mb-4">
          {t('landingHome.howTitle')}
        </h2>
        <div className="grid md:grid-cols-2 gap-6 mt-12">
          {steps.map((step, i) => (
            <div
              key={step.title}
              className="rounded-2xl border border-[#BED6F6]/40 bg-white p-6 shadow-sm"
            >
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#0071DD] text-white text-sm font-bold mb-3">
                {i + 1}
              </span>
              <h3 className="font-semibold text-lg mb-2">{step.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{step.body}</p>
            </div>
          ))}
        </div>
        <div className="text-center mt-10">
          <a href={DEMO_URL} target={DEMO_URL.startsWith('http') ? '_blank' : undefined} rel="noreferrer">
            <Button variant="outline" size="lg" className="border-[#BED6F6] text-[#0071DD]">
              {t('landingHome.howCta')}
              <ArrowRight size={18} className="ml-2" />
            </Button>
          </a>
        </div>
      </div>
    </section>
  );
}

export function LandingDifferentiation() {
  const { t } = useTranslation();
  const items = [
    { icon: Globe, title: t('landingHome.diff1Title'), body: t('landingHome.diff1Body') },
    { icon: MessageCircle, title: t('landingHome.diff2Title'), body: t('landingHome.diff2Body') },
    { icon: Rocket, title: t('landingHome.diff3Title'), body: t('landingHome.diff3Body') },
  ];

  return (
    <section className="py-20 bg-gradient-to-b from-white to-[#f4f8fd]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <h2 className="text-center text-3xl md:text-4xl font-serif font-bold mb-12 max-w-3xl mx-auto">
          {t('landingHome.diffTitle')}
        </h2>
        <div className="grid md:grid-cols-3 gap-8">
          {items.map((item) => (
            <div key={item.title} className="text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#eef4fc]">
                <item.icon className="text-[#016AEB]" size={28} />
              </div>
              <h3 className="font-semibold text-lg mb-2">{item.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{item.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const PRICING_TIERS = [
  {
    id: 'DECOUVERTE',
    name: 'Découverte',
    priceTnd: '49',
    priceEur: '19',
    highlight: false,
    features: ['1 agent au choix', 'Quota découverte', 'Sans carte bancaire'],
    cta: 'Commencer gratuitement',
    to: '/register',
  },
  {
    id: 'CROISSANCE',
    name: 'Croissance',
    priceTnd: '149',
    priceEur: '49',
    highlight: true,
    features: ['3 agents cœur', 'Mémoire partagée active', 'Pipeline inféré'],
    cta: 'Choisir Croissance',
    to: '/register',
  },
  {
    id: 'PRO',
    name: 'Pro',
    priceTnd: '299',
    priceEur: '99',
    highlight: false,
    features: ['Les 6 agents', 'Scoring avancé', 'Webhook CRM externe'],
    cta: 'Choisir Pro',
    to: '/register',
  },
  {
    id: 'ENTERPRISE',
    name: 'Enterprise',
    priceTnd: null,
    priceEur: null,
    highlight: false,
    features: ['Multi-utilisateurs', 'SLA', 'Personnalisation sectorielle'],
    cta: 'Nous contacter',
    to: EXPERT_MAIL,
    external: true,
  },
] as const;

export function LandingPricing() {
  const { t } = useTranslation();

  return (
    <section id="pricing" className="py-20 bg-[#0a2540] text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <h2 className="text-center text-3xl md:text-4xl font-serif font-bold mb-4">
          {t('landingHome.pricingTitle')}
        </h2>
        <p className="text-center text-white/70 mb-12 max-w-xl mx-auto">
          {t('landingHome.pricingSubtitle')}
        </p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {PRICING_TIERS.map((tier) => (
            <div
              key={tier.id}
              className={cn(
                'relative rounded-2xl border p-6 flex flex-col',
                tier.highlight
                  ? 'border-[#BED6F6] bg-white/10 shadow-lg scale-[1.02]'
                  : 'border-white/10 bg-white/5'
              )}
            >
              {tier.highlight ? (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#016AEB] px-3 py-0.5 text-xs font-semibold">
                  ⭐ Le plus populaire
                </span>
              ) : null}
              <h3 className="text-xl font-bold mb-2">{tier.name}</h3>
              {tier.priceTnd ? (
                <p className="mb-4">
                  <span className="text-3xl font-bold">{tier.priceTnd}</span>
                  <span className="text-sm text-white/70"> TND/mois</span>
                  <span className="block text-sm text-white/50">({tier.priceEur} €)</span>
                </p>
              ) : (
                <p className="text-2xl font-bold mb-4">Sur devis</p>
              )}
              <ul className="space-y-2 mb-6 flex-1 text-sm text-white/75">
                {tier.features.map((f) => (
                  <li key={f} className="flex gap-2">
                    <CheckCircle2 size={14} className="shrink-0 mt-0.5 text-[#BED6F6]" />
                    {f}
                  </li>
                ))}
              </ul>
              {'external' in tier && tier.external ? (
                <a href={tier.to}>
                  <Button className="w-full bg-white text-[#016AEB] hover:bg-white/90">{tier.cta}</Button>
                </a>
              ) : (
                <Link to={tier.to}>
                  <Button
                    className={cn(
                      'w-full',
                      tier.highlight ? 'bg-white text-[#016AEB] hover:bg-white/90' : 'bg-[#016AEB] hover:bg-[#0071DD]'
                    )}
                  >
                    {tier.cta}
                  </Button>
                </Link>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function LandingDataTrust() {
  const { t } = useTranslation();
  const points = [
    t('landingHome.trust1'),
    t('landingHome.trust2'),
    t('landingHome.trust3'),
  ];

  return (
    <section className="py-16 bg-white">
      <div className="max-w-3xl mx-auto px-4 text-center">
        <Shield className="mx-auto mb-4 text-[#016AEB]" size={36} />
        <h2 className="text-2xl md:text-3xl font-serif font-bold mb-8">{t('landingHome.trustTitle')}</h2>
        <ul className="space-y-3 text-left max-w-md mx-auto text-muted-foreground">
          {points.map((p) => (
            <li key={p} className="flex gap-2">
              <CheckCircle2 size={18} className="shrink-0 text-emerald-600" />
              {p}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function LandingFinalCta() {
  const { t } = useTranslation();

  return (
    <section className="py-20 bg-gradient-to-r from-[#0071DD] to-[#016AEB] text-white">
      <div className="max-w-3xl mx-auto px-4 text-center">
        <h2 className="text-3xl md:text-4xl font-serif font-bold mb-8">{t('landingHome.finalTitle')}</h2>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link to="/register">
            <Button size="lg" className="bg-white text-[#016AEB] hover:bg-white/90 px-8">
              {t('landing.cta')}
              <ArrowRight size={18} className="ml-2" />
            </Button>
          </Link>
          <a href={EXPERT_MAIL}>
            <Button size="lg" variant="outline" className="border-white/40 text-white hover:bg-white/10 px-8">
              {t('landingHome.finalExpert')}
            </Button>
          </a>
        </div>
      </div>
    </section>
  );
}
