import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle2, ArrowRight, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  DEMO_URL,
  LandingHeader,
  LandingProblem,
  LandingSolution,
  LandingDifferentiation,
  LandingPricing,
  LandingDataTrust,
  LandingFinalCta,
  LandingFooter,
} from '@/components/landing/LandingSections';

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

  return (
    <div className="min-h-screen bg-white">
      <LandingHeader />

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
            <h1 className="mb-5 font-serif text-4xl font-bold leading-[1.12] tracking-tight sm:text-5xl lg:text-[3.25rem]">
              <span className="block bg-gradient-to-r from-[#0a66c2] via-[#016AEB] to-[#38bdf8] bg-clip-text text-transparent drop-shadow-sm">
                {t('landing.heroTitle1')}
              </span>
              <span className="mt-1 block text-foreground">{t('landing.heroTitle2')}</span>
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
              <a
                href={DEMO_URL}
                target={DEMO_URL.startsWith('http') ? '_blank' : undefined}
                rel={DEMO_URL.startsWith('http') ? 'noreferrer' : undefined}
              >
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full border-[#BED6F6] px-8 text-base text-[#0071DD] hover:bg-[#e8f1fc] sm:w-auto"
                >
                  {t('landing.ctaDemo')}
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

      <LandingSolution />
      <LandingProblem />

      <LandingDifferentiation />
      <LandingPricing />
      <LandingDataTrust />
      <LandingFinalCta />
      <LandingFooter />
    </div>
  );
}
