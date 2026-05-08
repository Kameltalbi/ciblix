import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Check, CreditCard, Wallet, ArrowRight, X, Phone, Mail, MapPin, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api';
import { useMutation } from '@tanstack/react-query';
import { Link } from 'react-router-dom';

type PricingPlanRow = {
  slug: string;
  name: string;
  monthlyPrice: number;
  annualPrice: number;
  features: string[];
  cta: string;
  popular?: boolean;
};

const plans: PricingPlanRow[] = [
  {
    slug: 'FREE',
    name: 'Gratuit',
    monthlyPrice: 0,
    annualPrice: 0,
    features: [
      'Jusqu\'à 20 prospects',
      '1 utilisateur',
      'Pipeline Kanban',
      'Gestion des clients',
      'Support inclus',
    ],
    cta: 'Commencer gratuitement',
  },
  {
    slug: 'BASIC',
    name: 'Basic',
    monthlyPrice: 40,
    annualPrice: 480,
    features: [
      'Prospects illimités',
      'Jusqu\'à 5 utilisateurs',
      'Pipeline Kanban',
      'Objectifs de vente',
      'Reporting de base',
    ],
    cta: 'Choisir Basic',
  },
  {
    slug: 'BUSINESS',
    name: 'Business',
    monthlyPrice: 98,
    annualPrice: 980,
    features: [
      'Tout le plan Basic',
      'Jusqu\'à 20 utilisateurs',
      'Reporting avancé',
      'Support prioritaire',
    ],
    cta: 'Choisir Business',
    popular: true,
  },
  {
    slug: 'ENTERPRISE',
    name: 'Professionnel',
    monthlyPrice: 175,
    annualPrice: 2100,
    features: [
      'Tout le plan Business',
      'Jusqu\'à 50 utilisateurs',
      'Gestion des dépenses',
      'Assistant IA & scoring leads',
      'Commissions & Softfacture',
    ],
    cta: 'Choisir Professionnel',
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
    if (plan.slug === 'FREE') {
      navigate('/register');
      return;
    }
    setSelectedPlanSlug(plan.slug);
    setDialogOpen(true);
  };

  const handleConfirmSubscribe = () => {
    subscribeMutation.mutate();
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2">
              <img src="/logo.png" alt="ktOptima" className="h-8 w-auto" />
              <span className="text-xl font-bold text-foreground">CRM</span>
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
            <h1 className="font-serif text-4xl md:text-5xl font-bold text-gray-900 mb-4">
              Choisissez votre plan
            </h1>
            
            {/* Toggle Monthly/Annual */}
            <div className="flex items-center justify-center gap-4 mb-6">
              <span className={`text-lg ${!isAnnual ? 'font-semibold text-leaf' : 'text-gray-600'}`}>Mensuel</span>
              <button
                onClick={() => setIsAnnual(!isAnnual)}
                className={`relative w-16 h-8 rounded-full transition-colors ${isAnnual ? 'bg-leaf' : 'bg-gray-300'}`}
              >
                <div
                  className={`absolute top-1 left-1 w-6 h-6 rounded-full bg-white transition-transform ${isAnnual ? 'translate-x-8' : 'translate-x-0'}`}
                />
              </button>
              <span className={`text-lg ${isAnnual ? 'font-semibold text-leaf' : 'text-gray-600'}`}>Annuel</span>
              {isAnnual && (
                <span className="text-sm bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full font-medium">
                  {t('pricingPage.saveTwoMonths', { defaultValue: 'Économisez 2 mois' })}
                </span>
              )}
            </div>
            
            <p className="text-sm text-gray-500">
              Sans engagement – support inclus – mise en place rapide
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-[1200px] mx-auto">
            {plans.map((plan) => (
              <Card 
                key={plan.slug} 
                className={`border-2 transition-all hover:shadow-xl ${
                  plan.popular 
                    ? 'border-leaf shadow-xl relative scale-105 z-10' 
                    : 'border-gray-200'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-leaf text-white text-sm font-semibold px-4 py-1 rounded-full shadow-md">
                    Plus populaire
                  </div>
                )}
                <CardHeader className="pt-8">
                  <CardTitle className="text-2xl font-bold">{plan.name}</CardTitle>
                  {plan.slug !== 'FREE' && (
                    <p className="text-xs text-muted-foreground mt-1">Facturation hors TVA</p>
                  )}
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <p className="text-4xl font-bold text-gray-900">
                      {isAnnual ? plan.annualPrice : plan.monthlyPrice} DT
                    </p>
                    <p className="text-sm text-gray-500">
                      {isAnnual ? t('pricingPage.perYear', { defaultValue: 'par an' }) : t('pricingPage.perMonth', { defaultValue: 'par mois' })}
                    </p>
                    {plan.annualPrice > 0 && (
                      <p className="text-xs text-gray-400">
                        {isAnnual 
                          ? `${plan.monthlyPrice} DT/mois` 
                          : `${plan.annualPrice} DT/an`}
                      </p>
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
                    {plan.cta}
                  </Button>
                </CardContent>
              </Card>
            ))}
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
                <img src="/logo.png" alt="ktOptima" className="h-8 w-auto" />
                <span className="text-xl font-bold">CRM</span>
              </div>
              <p className="text-gray-400 text-sm">
                Le CRM simple et puissant pour gérer vos ventes et vos clients.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Contact</h3>
              <div className="space-y-2 text-sm text-gray-400">
                <div className="flex items-center gap-2">
                  <Phone size={16} />
                  <span>+216 XX XXX XXX</span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail size={16} />
                  <span>contact@ktoptima.com</span>
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
            <p>© 2026 ktOptima CRM. Tous droits réservés.</p>
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
                  {plans.find((p) => p.slug === selectedPlanSlug)?.name}
                </p>
                <p className="text-2xl font-bold">
                  {isAnnual
                    ? `${plans.find((p) => p.slug === selectedPlanSlug)?.annualPrice ?? '—'} DT/an`
                    : `${plans.find((p) => p.slug === selectedPlanSlug)?.monthlyPrice ?? '—'} DT/mois`}
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
                  <p>Reference : CRM-{selectedPlanSlug}-{Date.now()}</p>
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
