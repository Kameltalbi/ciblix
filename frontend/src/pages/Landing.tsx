import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle2, ArrowRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  DEMO_URL,
  LandingHeader,
  LandingFooter,
} from '@/components/landing/LandingSections';
import {
  LandingAnswer,
  LandingAgents,
  LandingFaqPrompt,
  LandingFinalCtaPrompt,
  LandingHeroPhone,
  LandingKeepCrm,
  LandingMarket,
  LandingMemoryWake,
  LandingPricingPrompt,
  LandingProblemPrompt,
  LandingProof,
  LandingStartFast,
  LandingYourData,
} from '@/components/landing/LandingHomeSections';

const SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Ciblix',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  description:
    'Chaque matin, cinq entreprises à contacter avec la raison et le message déjà écrit. Vos commerciaux ne saisissent plus rien.',
  url: 'https://ciblix.com',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'TND',
    description: 'Essai gratuit — première liste en cinq minutes',
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

  const demoExternal = DEMO_URL.startsWith('http');

  return (
    <div className="min-h-screen bg-white">
      <LandingHeader />

      {/* §1 Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#f7faff] via-white to-white" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 pb-14 pt-12 sm:px-6 md:pb-20 md:pt-16 lg:grid-cols-2 lg:gap-16 lg:px-8">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <h1 className="font-serif text-4xl font-bold leading-[1.1] tracking-tight text-foreground sm:text-5xl lg:text-[3.35rem]">
              {t('landing.heroTitle1')}
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground md:text-xl">
              {t('landing.heroSubtitle')}
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Link to="/register">
                <Button
                  size="lg"
                  className="h-12 w-full border-0 bg-gradient-to-r from-[#016AEB] via-[#0071DD] to-[#38bdf8] px-8 text-base text-white shadow-glow hover:opacity-95 sm:w-auto"
                >
                  {t('landing.cta')}
                  <ArrowRight size={18} className="ml-2" />
                </Button>
              </Link>
              {demoExternal ? (
                <a href={DEMO_URL} target="_blank" rel="noopener noreferrer">
                  <Button size="lg" variant="outline" className="h-12 w-full px-8 text-base sm:w-auto">
                    {t('landing.ctaDemo')}
                  </Button>
                </a>
              ) : (
                <a href="#demo">
                  <Button size="lg" variant="outline" className="h-12 w-full px-8 text-base sm:w-auto">
                    {t('landing.ctaDemo')}
                  </Button>
                </a>
              )}
            </div>
            <div className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
              {[
                t('landing.noCommitment'),
                t('landing.localSupport'),
                t('landing.secure'),
                t('landing.multilingual'),
              ].map((label) => (
                <div key={label} className="flex items-center gap-1.5">
                  <CheckCircle2 size={15} className="text-[#016AEB]" />
                  {label}
                </div>
              ))}
            </div>
          </motion.div>
          <motion.div
            className="flex justify-center lg:justify-end"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.1 }}
          >
            <LandingHeroPhone />
          </motion.div>
        </div>
      </section>

      <LandingProof />
      <LandingProblemPrompt />
      <LandingAnswer />
      <LandingAgents />
      <LandingMemoryWake />
      <LandingMarket />
      <LandingStartFast />
      <LandingYourData />
      <LandingKeepCrm />
      <LandingPricingPrompt />
      <LandingFaqPrompt />
      <LandingFinalCtaPrompt />
      <LandingFooter />
    </div>
  );
}
