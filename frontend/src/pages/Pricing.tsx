import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Check,
  CreditCard,
  Wallet,
  X,
  Phone,
  Mail,
  MapPin,
  Menu,
  Sparkles,
  Minus,
  Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api';
import { useMutation } from '@tanstack/react-query';
import { Link } from 'react-router-dom';

type PricingPlanRow = {
  slug: string;
  name: string;
  packKey: string;
  packDescKey: string;
  monthlyPrice: number;
  annualPrice: number;
  features: string[];
  cta: string;
  popular?: boolean;
};

const AGENT_MATRIX = [
  { nameKey: 'agents.huntAi.name', basic: true, business: true, pro: true },
  { nameKey: 'agents.copilotIa.name', basic: true, business: true, pro: true },
  { nameKey: 'agents.scoutAi.name', basic: false, business: true, pro: true },
  { nameKey: 'agents.offreBot.name', basic: false, business: true, pro: true },
  { nameKey: 'agents.commBot.name', basic: false, business: false, pro: true },
  { nameKey: 'agents.factCheckAi.name', basic: false, business: false, pro: true },
] as const;

const QUOTA_ROWS = [
  {
    planKey: 'pricingPage.planBasic',
    hunt: 150,
    copilot: 80,
    scout: null,
    offre: null,
    comm: null,
    fact: null,
  },
  {
    planKey: 'pricingPage.planBusiness',
    hunt: 400,
    copilot: 200,
    scout: 30,
    offre: 25,
    comm: null,
    fact: null,
  },
  {
    planKey: 'pricingPage.planPro',
    hunt: 800,
    copilot: 400,
    scout: 60,
    offre: 50,
    comm: 40,
    fact: 25,
  },
] as const;

const PACK_CARDS = [
  { titleKey: 'pricingPage.packEssentiel', descKey: 'pricingPage.packEssentielDesc', slug: 'BASIC', color: 'border-sky-200 bg-sky-50' },
  { titleKey: 'pricingPage.packBusiness', descKey: 'pricingPage.packBusinessDesc', slug: 'BUSINESS', color: 'border-emerald-200 bg-emerald-50 ring-2 ring-emerald-100' },
  { titleKey: 'pricingPage.packPro', descKey: 'pricingPage.packProDesc', slug: 'ENTERPRISE', color: 'border-violet-200 bg-violet-50' },
] as const;

const PAID_PLANS: PricingPlanRow[] = [
  {
    slug: 'BASIC',
    name: 'Basic',
    packKey: 'pricingPage.packEssentiel',
    packDescKey: 'pricingPage.packEssentielDesc',
    monthlyPrice: 40,
    annualPrice: 480,
    features: [
      'Prospects illimités',
      'Jusqu\'à 5 utilisateurs',
      'Pipeline Kanban & objectifs',
      'Chasseur IA — prospection intelligente',
      'Assistant IA — copilote commercial',
    ],
    cta: 'Démarrer l\'essai gratuit',
  },
  {
    slug: 'BUSINESS',
    name: 'Business',
    packKey: 'pricingPage.packBusiness',
    packDescKey: 'pricingPage.packBusinessDesc',
    monthlyPrice: 98,
    annualPrice: 980,
    features: [
      'Tout le plan Basic',
      'Jusqu\'à 20 utilisateurs',
      'Reporting avancé & support prioritaire',
      'Veilleur IA — veille d\'opportunités',
      'Rédacteur d\'offres — propositions commerciales',
    ],
    cta: 'Démarrer l\'essai gratuit',
    popular: true,
  },
  {
    slug: 'ENTERPRISE',
    name: 'Professionnel',
    packKey: 'pricingPage.packPro',
    packDescKey: 'pricingPage.packProDesc',
    monthlyPrice: 175,
    annualPrice: 2100,
    features: [
      'Tout le plan Business',
      'Jusqu\'à 50 utilisateurs',
      'CommBot — marketing & contenu B2B',
      'Vérificateur IA — contrôle des informations',
      'Dépenses, commissions & Softfacture',
    ],
    cta: 'Démarrer l\'essai gratuit',
  },
];

export function Pricing() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [selectedPlanSlug, setSelectedPlanSlug] = useState<string>('');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'VIREMENT' | 'ESPECES'>('VIREMENT');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isAnnual, setIsAnnual] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const subscribeMutation = useMutation({
    mutationFn: () =>
      api
        .post('/subscriptions', {
          plan: selectedPlanSlug,
          paymentMethod: selectedPaymentMethod,
          billingPeriod: isAnnual ? 'YEARLY' : 'MONTHLY',
        })
        .then((r) => r.data),
    onSuccess: () => {
      alert(t('pricingPage.requestSent', { defaultValue: "Demande d'abonnement envoyée ! Nous vous contacterons pour confirmer le paiement." }));
      setDialogOpen(false);
      navigate('/dashboard');
    },
  });

  const handleSubscribe = (plan: PricingPlanRow) => {
    navigate(`/register?plan=${plan.slug.toLowerCase()}&trial=14`);
  };

  const handleConfirmSubscribe = () => {
    subscribeMutation.mutate();
  };

  const renderPaidPlanCard = (plan: PricingPlanRow, opts?: { wrapClass?: string }) => (
    <Card
      className={`border-2 transition-all hover:shadow-xl ${
        plan.popular ? 'border-leaf shadow-xl relative scale-[1.02] z-10 lg:scale-105' : 'border-gray-200'
      } ${opts?.wrapClass ?? ''}`}
    >
      {plan.popular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-leaf text-white text-sm font-semibold px-4 py-1 rounded-full shadow-md">
          Plus populaire
        </div>
      )}
      <CardHeader className="pt-8">
        <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
          <Sparkles size={12} />
          {t('pricingPage.trialBadge', { defaultValue: '14 jours d\'essai gratuit' })}
        </div>
        <CardTitle className="text-2xl font-bold text-sky-700">{plan.name}</CardTitle>
        <p className="text-sm font-medium text-sky-600">{t(plan.packKey)}</p>
        <p className="text-xs text-muted-foreground">{t(plan.packDescKey)}</p>
        <p className="text-xs text-muted-foreground mt-1">
          {t('pricingPage.billingNote', { defaultValue: 'Facturation hors TVA · 0 DT pendant 14 jours' })}
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <p className="text-4xl font-bold text-gray-900">
            {isAnnual ? plan.annualPrice : plan.monthlyPrice} DT
          </p>
          <p className="text-sm text-gray-500">
            {isAnnual
              ? t('pricingPage.perYearAfterTrial', { defaultValue: 'par an après l\'essai' })
              : t('pricingPage.perMonthAfterTrial', { defaultValue: 'par mois après l\'essai' })}
          </p>
          {plan.annualPrice > 0 && (
            <p className="text-xs text-gray-400">
              {isAnnual ? `${plan.monthlyPrice} DT/mois` : `${plan.annualPrice} DT/an`}
            </p>
          )}
          {plan.slug === 'BASIC' && (
            <span className="inline-block mt-3 rounded-full bg-sky-100 text-sky-900 text-xs font-medium px-3 py-1">
              Jusqu&apos;à 5 utilisateurs
            </span>
          )}
        </div>

        <ul className="space-y-4">
          {plan.features.map((feature, idx) => (
            <li key={idx} className="flex items-start gap-3">
              <Check className="text-leaf flex-shrink-0 mt-0.5" size={20} />
              <span className="text-sm text-gray-700">{feature}</span>
            </li>
          ))}
        </ul>

        <Button
          className="w-full"
          variant={plan.popular ? 'default' : 'outline'}
          onClick={() => handleSubscribe(plan)}
          size="lg"
        >
          {t('pricingPage.ctaTrial', { defaultValue: plan.cta })}
        </Button>
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex min-h-[4.25rem] items-center justify-between py-2 sm:min-h-20 sm:py-0">
            <Link to="/" className="flex items-center gap-2">
              <img
                src="/logo-ciblix.png"
                alt="CIBLIX"
                className="h-[3.35rem] w-auto max-w-[min(14rem,58vw)] object-contain sm:h-16 md:h-[4.5rem] md:max-w-[16rem]"
              />
            </Link>
            <nav className="hidden md:flex items-center gap-6">
              <Link to="/#features" className="text-lg text-muted-foreground hover:text-foreground transition-colors">
                Fonctionnalités
              </Link>
              <Link to="/#why" className="text-lg text-muted-foreground hover:text-foreground transition-colors">
                Pourquoi nous ?
              </Link>
              <Link to="/pricing" className="text-lg text-foreground font-semibold">
                Tarifs
              </Link>
              <Link to="/#contact" className="text-lg text-muted-foreground hover:text-foreground transition-colors">
                Contact
              </Link>
            </nav>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
              >
                {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
              <div className="hidden md:flex items-center gap-3">
                <Link to="/login">
                  <Button variant="ghost" size="lg" className="bg-[#d1fae4] hover:bg-[#c1ebe0]">
                    {t('common.login')}
                  </Button>
                </Link>
                <Link to="/register">
                  <Button size="lg" className="bg-leaf hover:bg-leaf/90">
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
              <Link to="/#features" className="block text-lg text-muted-foreground hover:text-foreground transition-colors" onClick={() => setMobileMenuOpen(false)}>
                {t('landing.navFeatures')}
              </Link>
              <Link to="/#why" className="block text-lg text-muted-foreground hover:text-foreground transition-colors" onClick={() => setMobileMenuOpen(false)}>
                {t('landing.navWhy')}
              </Link>
              <Link to="/pricing" className="block text-lg text-foreground font-semibold" onClick={() => setMobileMenuOpen(false)}>
                {t('landing.navPricing')}
              </Link>
              <Link to="/#contact" className="block text-lg text-muted-foreground hover:text-foreground transition-colors" onClick={() => setMobileMenuOpen(false)}>
                {t('landing.navContact')}
              </Link>
              <div className="pt-4 space-y-2">
                <Link to="/login" onClick={() => setMobileMenuOpen(false)}>
                  <Button variant="ghost" size="lg" className="w-full bg-[#d1fae4] hover:bg-[#c1ebe0]">
                    Connexion
                  </Button>
                </Link>
                <Link to="/register" onClick={() => setMobileMenuOpen(false)}>
                  <Button size="lg" className="w-full bg-leaf hover:bg-leaf/90">
                    S'inscrire
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        )}
      </header>

      <div className="py-12 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800">
              <Sparkles size={16} />
              {t('pricingPage.heroTrial', { defaultValue: '14 jours d\'essai gratuit — sans carte bancaire' })}
            </div>
            <h1 className="font-serif text-4xl md:text-5xl font-bold text-gray-900 mb-4">
              {t('pricingPage.title', { defaultValue: 'Choisissez votre plan' })}
            </h1>
            
            {/* Toggle Monthly/Annual — segmented control (contraste garanti) */}
            <div className="flex flex-wrap items-center justify-center gap-3 mb-6">
              <div
                className="inline-flex rounded-full border-2 border-slate-300 bg-slate-100 p-1 shadow-sm"
                role="group"
                aria-label="Période de facturation"
              >
                <button
                  type="button"
                  onClick={() => setIsAnnual(false)}
                  className={`rounded-full px-5 py-2.5 text-sm font-semibold transition-all ${
                    !isAnnual
                      ? 'bg-white text-slate-900 shadow-md ring-1 ring-slate-200'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Mensuel
                </button>
                <button
                  type="button"
                  onClick={() => setIsAnnual(true)}
                  className={`rounded-full px-5 py-2.5 text-sm font-semibold transition-all ${
                    isAnnual
                      ? 'bg-emerald-600 text-white shadow-md'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Annuel
                </button>
              </div>
              {isAnnual && (
                <span className="text-sm bg-sky-100 text-sky-700 px-3 py-1 rounded-full font-medium">
                  {t('pricingPage.saveTwoMonths', { defaultValue: 'Économisez 2 mois' })}
                </span>
              )}
            </div>
            
            <p className="text-sm text-gray-500">
              {t('pricingPage.subtitle', { defaultValue: 'Sans engagement · sans carte bancaire · support inclus' })}
            </p>
            <p className="mt-2 text-xs text-gray-400">
              {t('pricingPage.trialNote', { defaultValue: 'Testez toutes les fonctionnalités pendant 14 jours. Paiement uniquement si vous continuez.' })}
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 max-w-[1280px] mx-auto">
            {PAID_PLANS.map((plan) => (
              <div
                key={plan.slug}
                className={`min-w-0 ${plan.popular ? 'sm:col-span-2 lg:col-span-1 lg:pt-2' : ''}`}
              >
                {renderPaidPlanCard(plan, { wrapClass: 'rounded-2xl h-full' })}
              </div>
            ))}
          </div>

          {/* Packs commerciaux */}
          <div className="mt-16 mb-10 text-center">
            <h2 className="text-2xl font-bold text-gray-900">{t('pricingPage.packsTitle')}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{t('pricingPage.packsSubtitle')}</p>
          </div>
          <div className="grid gap-4 md:grid-cols-3 max-w-4xl mx-auto mb-16">
            {PACK_CARDS.map((pack) => (
              <div key={pack.slug} className={`rounded-2xl border p-5 text-left ${pack.color}`}>
                <p className="font-bold text-gray-900">{t(pack.titleKey)}</p>
                <p className="mt-1 text-sm text-gray-600">{t(pack.descKey)}</p>
              </div>
            ))}
          </div>

          {/* Comparatif agents */}
          <div className="mb-16">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-900">{t('pricingPage.agentsTitle')}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{t('pricingPage.agentsSubtitle')}</p>
            </div>
            <div className="overflow-x-auto rounded-2xl border bg-white shadow-sm">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">{t('pricingPage.agentColumn')}</th>
                    <th className="px-4 py-3 text-center font-semibold text-gray-700">{t('pricingPage.planBasic')}</th>
                    <th className="px-4 py-3 text-center font-semibold text-gray-700">{t('pricingPage.planBusiness')}</th>
                    <th className="px-4 py-3 text-center font-semibold text-gray-700">{t('pricingPage.planPro')}</th>
                  </tr>
                </thead>
                <tbody>
                  {AGENT_MATRIX.map((row) => (
                    <tr key={row.nameKey} className="border-b last:border-0">
                      <td className="px-4 py-3 font-medium text-gray-800">{t(row.nameKey)}</td>
                      {[row.basic, row.business, row.pro].map((included, i) => (
                        <td key={i} className="px-4 py-3 text-center">
                          {included ? (
                            <span className="inline-flex items-center gap-1 text-emerald-700">
                              <Check size={16} className="text-leaf" />
                              <span className="sr-only">{t('pricingPage.included')}</span>
                            </span>
                          ) : (
                            <Minus size={16} className="mx-auto text-gray-300" />
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Quotas mensuels */}
          <div className="mb-16">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-900">{t('pricingPage.quotasTitle')}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{t('pricingPage.quotasSubtitle')}</p>
            </div>
            <div className="overflow-x-auto rounded-2xl border bg-white shadow-sm">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Plan</th>
                    <th className="px-3 py-3 text-center font-semibold text-gray-700">{t('agents.huntAi.name')}</th>
                    <th className="px-3 py-3 text-center font-semibold text-gray-700">{t('agents.copilotIa.name')}</th>
                    <th className="px-3 py-3 text-center font-semibold text-gray-700">{t('agents.scoutAi.name')}</th>
                    <th className="px-3 py-3 text-center font-semibold text-gray-700">{t('agents.offreBot.name')}</th>
                    <th className="px-3 py-3 text-center font-semibold text-gray-700">{t('agents.commBot.name')}</th>
                    <th className="px-3 py-3 text-center font-semibold text-gray-700">{t('agents.factCheckAi.name')}</th>
                  </tr>
                </thead>
                <tbody>
                  {QUOTA_ROWS.map((row) => (
                    <tr key={row.planKey} className="border-b last:border-0">
                      <td className="px-4 py-3 font-medium">{t(row.planKey)}</td>
                      {[row.hunt, row.copilot, row.scout, row.offre, row.comm, row.fact].map((val, i) => (
                        <td key={i} className="px-3 py-3 text-center text-gray-600">
                          {val ?? '—'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-center text-xs text-muted-foreground">{t('pricingPage.quotasNote')}</p>
          </div>

          {/* Add-ons bientôt */}
          <div className="mb-16">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-900">{t('pricingPage.addonsTitle')}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{t('pricingPage.addonsSubtitle')}</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2 max-w-3xl mx-auto">
              <Card className="relative overflow-hidden">
                <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-700 ring-1 ring-amber-200">
                  <Clock size={10} />
                  {t('pricingPage.comingSoon')}
                </span>
                <CardHeader>
                  <CardTitle className="text-lg">{t('pricingPage.addonEnricher')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{t('pricingPage.addonEnricherDesc')}</p>
                  <p className="mt-3 font-semibold text-sky-700">{t('pricingPage.addonEnricherPrice')}</p>
                </CardContent>
              </Card>
              <Card className="relative overflow-hidden">
                <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-700 ring-1 ring-amber-200">
                  <Clock size={10} />
                  {t('pricingPage.comingSoon')}
                </span>
                <CardHeader>
                  <CardTitle className="text-lg">{t('pricingPage.addonNba')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{t('pricingPage.addonNbaDesc')}</p>
                  <p className="mt-3 font-semibold text-sky-700">{t('pricingPage.addonNbaPrice')}</p>
                </CardContent>
              </Card>
            </div>
          </div>

          <div className="mt-12 max-w-2xl mx-auto">
            <Card>
              <CardHeader>
                <CardTitle>{t('pricingPage.acceptedPayments', { defaultValue: 'Modes de paiement acceptés' })}</CardTitle>
              </CardHeader>
              <CardContent className="grid md:grid-cols-2 gap-4">
                <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
                  <CreditCard className="text-leaf" size={32} />
                  <div>
                    <p className="font-semibold">{t('pricingPage.bankTransfer', { defaultValue: 'Virement bancaire' })}</p>
                    <p className="text-sm text-gray-600">Détails fournis après inscription</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
                  <Wallet className="text-leaf" size={32} />
                  <div>
                    <p className="font-semibold">{t('pricingPage.cash', { defaultValue: 'Espèces' })}</p>
                    <p className="text-sm text-gray-600">Paiement en main propre</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <img
                  src="/logo-ciblix.png"
                  alt="CIBLIX"
                  className="h-12 w-auto max-w-[min(12rem,70vw)] object-contain brightness-0 invert drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)] sm:h-14"
                />
              </div>
              <p className="text-gray-400 text-sm">
                Plateforme simple et puissante pour la prospection, les opportunités et vos contacts.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Contact</h3>
              <div className="space-y-2 text-sm text-gray-400">
                <div className="flex items-center gap-2">
                  <Phone size={16} />
                  <span>+216 55 053 505</span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail size={16} />
                  <span>contact@ciblix.com</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin size={16} />
                  <span>Tunisie</span>
                </div>
              </div>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Liens rapides</h3>
              <div className="space-y-2 text-sm text-gray-400">
                <Link to="/" className="block hover:text-white transition-colors">Accueil</Link>
                <Link to="/pricing" className="block hover:text-white transition-colors">Tarifs</Link>
                <Link to="/legal/privacy" className="block hover:text-white transition-colors">Politique de confidentialité</Link>
                <Link to="/legal/terms" className="block hover:text-white transition-colors">Conditions d'utilisation</Link>
              </div>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-sm text-gray-400">
            <p>© 2026 CIBLIX. Tous droits réservés.</p>
          </div>
        </div>
      </footer>

      {/* Subscription Dialog */}
      {dialogOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Confirmer l'abonnement</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-gray-500">Plan sélectionné</p>
                <p className="font-semibold text-lg">
                  {PAID_PLANS.find((p) => p.slug === selectedPlanSlug)?.name}
                </p>
                <p className="text-2xl font-bold">
                  {isAnnual
                    ? `${PAID_PLANS.find((p) => p.slug === selectedPlanSlug)?.annualPrice ?? '—'} DT/an`
                    : `${PAID_PLANS.find((p) => p.slug === selectedPlanSlug)?.monthlyPrice ?? '—'} DT/mois`}
                </p>
              </div>

              <div>
                <p className="text-sm text-gray-500 mb-2">Mode de paiement</p>
                <div className="flex gap-2">
                  <Button
                    variant={selectedPaymentMethod === 'VIREMENT' ? 'default' : 'outline'}
                    onClick={() => setSelectedPaymentMethod('VIREMENT')}
                    className="flex-1"
                  >
                    Virement
                  </Button>
                  <Button
                    variant={selectedPaymentMethod === 'ESPECES' ? 'default' : 'outline'}
                    onClick={() => setSelectedPaymentMethod('ESPECES')}
                    className="flex-1"
                  >
                    Espèces
                  </Button>
                </div>
              </div>

              {selectedPaymentMethod === 'VIREMENT' && (
                <div className="p-3 bg-blue-50 rounded text-sm">
                  <p className="font-semibold mb-1">Informations de virement :</p>
                  <p>RIB : XX XXX XXX XXX XXX XXX XX</p>
                  <p>Banque : BIAT</p>
                  <p>Reference : CIBLIX-{selectedPlanSlug}-{Date.now()}</p>
                </div>
              )}

              {selectedPaymentMethod === 'ESPECES' && (
                <div className="p-3 bg-green-50 rounded text-sm">
                  <p className="font-semibold">Paiement en espèces :</p>
                  <p>Notre équipe vous contactera pour organiser le paiement.</p>
                </div>
              )}

              <div className="flex gap-2 pt-4">
                <Button variant="outline" onClick={() => setDialogOpen(false)} className="flex-1">
                  Annuler
                </Button>
                <Button onClick={handleConfirmSubscribe} disabled={subscribeMutation.isPending} className="flex-1">
                  {subscribeMutation.isPending ? 'Envoi...' : 'Confirmer'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
