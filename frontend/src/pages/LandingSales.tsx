import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Check, Zap, Shield, DollarSign, BarChart, Users, ArrowRight, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { LandingFooter, LandingHeader } from '@/components/landing/LandingSections';

export function LandingSales() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');

  const plans = [
    {
      name: 'Découverte',
      price: '29 TND',
      period: '/mois',
      sub: '1 utilisateur',
      agents: '1 agent au choix parmi les 6',
      features: [
        '1 utilisateur inclus',
        'Quota découverte (50 actions/mois)',
        'Essai 7 jours inclus',
      ],
      cta: 'Voir les tarifs',
      popular: false,
    },
    {
      name: 'Croissance',
      price: '85 TND',
      period: '/mois',
      sub: '3 utilisateurs',
      agents: 'Chasseur IA · Assistant IA · Gmail IA',
      features: [
        'Jusqu’à 3 utilisateurs',
        'Mémoire partagée & pipeline',
        'Essai 7 jours inclus',
      ],
      cta: 'Voir les tarifs',
      popular: true,
    },
    {
      name: 'Pro',
      price: '149 TND',
      period: '/mois',
      sub: '10 utilisateurs',
      agents: 'Les 6 agents (Chasseur, Assistant, Gmail, Veilleur, Rédacteur, Vérificateur)',
      features: [
        'Jusqu’à 10 utilisateurs',
        'Scoring avancé & webhook CRM',
        'Essai 7 jours inclus',
      ],
      cta: 'Voir les tarifs',
      popular: false,
    },
    {
      name: 'Entreprise',
      price: 'Sur devis',
      period: '',
      sub: 'Utilisateurs illimités',
      agents: 'Tous les agents Pro + BrandPulse / config sectorielle',
      features: [
        'Utilisateurs illimités',
        'Tout Pro + multi-équipes',
        'SLA dédié',
      ],
      cta: 'Nous contacter',
      popular: false,
    },
  ];

  const features = [
    {
      icon: Zap,
      title: 'Copilot IA',
      description: 'Posez vos questions en langage naturel et obtenez des réponses instantanées sur vos priorités, prospects et signaux.',
    },
    {
      icon: BarChart,
      title: 'Hunt AI',
      description: 'Prospection multi-sources avec lead scoring IA pour prioriser les meilleurs prospects automatiquement.',
    },
    {
      icon: Shield,
      title: '100% Tunisien',
      description: 'Adapté au marché tunisien avec support local en français et en arabe.',
    },
    {
      icon: DollarSign,
      title: 'OffreBot',
      description: 'Générez des propositions commerciales personnalisées en quelques secondes, prêtes à envoyer.',
    },
    {
      icon: Users,
      title: '6 agents IA',
      description: 'Hunt, Copilot, Scout, OffreBot, FactCheck et BrandPulse — une plateforme d\'agents, pas un CRM.',
    },
    {
      icon: Mail,
      title: 'Scout & BrandPulse',
      description: 'Veille d\'opportunités (TUNEPS, événements) et présence de marque en ligne avec blog SEO assisté.',
    },
  ];

  const testimonials = [
    {
      name: 'Ahmed Ben Ali',
      company: 'Tech Solutions Tunis',
      text: 'L\'assistant IA m\'a fait gagner 2h par semaine sur mes analyses. Excellent investissement !',
    },
    {
      name: 'Fatma Trabelsi',
      company: 'Conseil & Stratégie',
      text: 'Le lead scoring m\'a permis de prioriser mes opportunités et d\'augmenter mon taux de conversion de 30%.',
    },
    {
      name: 'Mohamed Kaddour',
      company: 'Services Pro',
      text: 'Support réactif et interface intuitive. J\'ai abandonné Excel en 2 jours.',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50">
      <LandingHeader />

      {/* Hero Section */}
      <section className="py-20 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="font-serif text-5xl md:text-6xl font-bold text-gray-900 mb-6">
            Une plateforme de 6 agents IA pour les TPE et PME tunisiennes
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            Hunt, Copilot, Scout, OffreBot, FactCheck et BrandPulse travaillent pour vous.
            Simple, local, et adapté à votre business.
          </p>
          <div className="flex gap-4 justify-center">
            <Button size="lg" onClick={() => navigate('/register')} className="text-lg px-8">
              Essai gratuit 7 jours <ArrowRight className="ml-2" size={20} />
            </Button>
            <Button size="lg" variant="outline" onClick={() => navigate('/login')}>
              Démo vidéo
            </Button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-4 bg-white">
        <div className="max-w-7xl mx-auto">
          <h2 className="font-serif text-4xl font-bold text-center mb-12">
            Pourquoi choisir CIBLIX ?
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            {features.map((feature, idx) => (
              <Card key={idx} className="border-2 hover:border-leaf transition-colors">
                <CardContent className="p-6">
                  <feature.icon className="text-leaf mb-4" size={32} />
                  <h3 className="font-semibold text-xl mb-2">{feature.title}</h3>
                  <p className="text-gray-600">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-20 px-4 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <h2 className="font-serif text-4xl font-bold text-center mb-4">
            {t('pricingPage.simplePricing', { defaultValue: 'Tarifs simples et transparents' })}
          </h2>
          <p className="text-center text-gray-600 mb-12">{t('pricingPage.noCommitmentAnytime', { defaultValue: 'Sans engagement, annulation à tout moment' })}</p>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 max-w-6xl mx-auto">
            {plans.map((plan, idx) => (
              <Card key={idx} className={`border-2 ${plan.popular ? 'border-leaf shadow-lg' : ''}`}>
                <CardContent className="p-6">
                  {plan.popular && (
                    <div className="bg-leaf text-white text-sm font-semibold text-center py-1 rounded mb-4">
                      Plus populaire
                    </div>
                  )}
                  <h3 className="font-semibold text-2xl mb-2">{plan.name}</h3>
                  <div className="mb-2">
                    <span className="text-3xl font-bold">{plan.price}</span>
                    {plan.period ? <span className="text-gray-600">{plan.period}</span> : null}
                  </div>
                  {plan.sub ? (
                    <p className="mb-2 inline-flex rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-800">
                      {plan.sub}
                    </p>
                  ) : null}
                  <p className="mb-6 text-xs font-medium text-sky-900/80 leading-relaxed">{plan.agents}</p>
                  <ul className="space-y-3 mb-6">
                    {plan.features.map((feature, fidx) => (
                      <li key={fidx} className="flex items-start gap-2">
                        <Check className="text-leaf flex-shrink-0 mt-0.5" size={16} />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Button 
                    className="w-full" 
                    variant={plan.popular ? 'default' : 'outline'}
                    onClick={() =>
                      plan.name === 'Entreprise'
                        ? (window.location.href = 'mailto:contact@ciblix.com?subject=Ciblix%20Entreprise')
                        : navigate('/pricing')
                    }
                  >
                    {plan.cta}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 px-4 bg-white">
        <div className="max-w-7xl mx-auto">
          <h2 className="font-serif text-4xl font-bold text-center mb-12">
            Ce que disent nos clients
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, idx) => (
              <Card key={idx}>
                <CardContent className="p-6">
                  <p className="text-gray-600 mb-4 italic">"{testimonial.text}"</p>
                  <div>
                    <p className="font-semibold">{testimonial.name}</p>
                    <p className="text-sm text-gray-500">{testimonial.company}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 bg-leaf text-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="font-serif text-4xl font-bold mb-6">
            Prêt à activer vos agents IA ?
          </h2>
          <p className="text-xl mb-8 opacity-90">
            Rejoignez les équipes tunisiennes qui font confiance à CIBLIX
          </p>
          <Button size="lg" onClick={() => navigate('/register')} className="bg-white text-leaf hover:bg-gray-100 text-lg px-8">
            Démarrer gratuitement <ArrowRight className="ml-2" size={20} />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <LandingFooter />
    </div>
  );
}
