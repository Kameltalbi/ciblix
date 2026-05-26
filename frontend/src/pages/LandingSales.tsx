import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Check, Zap, Shield, DollarSign, BarChart, Users, ArrowRight, Mail, Phone, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export function LandingSales() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');

  const plans = [
    {
      name: 'Basic',
      price: '480 DT',
      period: '/an',
      sub: '(40 DT/mois)',
      features: [
        'Prospects illimités',
        'Jusqu\'à 5 utilisateurs',
        'Opportunités IA & objectifs de vente',
        'Reporting de base',
      ],
      cta: 'Voir les tarifs',
      popular: false,
    },
    {
      name: 'Business',
      price: '980 DT',
      period: '/an',
      sub: '(98 DT/mois)',
      features: [
        'Tout Basic',
        'Jusqu\'à 20 utilisateurs',
        'Reporting avancé',
        'Support prioritaire',
      ],
      cta: 'Voir les tarifs',
      popular: true,
    },
    {
      name: 'Professionnel',
      price: '2100 DT',
      period: '/an',
      sub: '(175 DT/mois)',
      features: [
        'Tout Business',
        'Jusqu\'à 50 utilisateurs',
        'Dépenses, IA, primes, Softfacture',
      ],
      cta: 'Voir les tarifs',
      popular: false,
    },
  ];

  const features = [
    {
      icon: Zap,
      title: 'Assistant IA',
      description: 'Posez vos questions en langage naturel et obtenez des réponses instantanées sur votre CA, opportunités et clients.',
    },
    {
      icon: BarChart,
      title: 'Lead Scoring',
      description: 'Score automatique 0-100 basé sur montant, probabilité et historique pour prioriser vos opportunités.',
    },
    {
      icon: Shield,
      title: '100% Tunisien',
      description: 'Adapté à la législation tunisienne (matricule fiscal, TVA) avec support local en français.',
    },
    {
      icon: DollarSign,
      title: 'Intégration Softfacture',
      description: 'Générez vos devis et factures automatiquement via Softfacture, la solution de facturation tunisienne.',
    },
    {
      icon: Users,
      title: 'Contacts & suivi',
      description: 'Centralisez vos contacts, opportunités et activités dans une interface simple, orientée résultats.',
    },
    {
      icon: Mail,
      title: 'Email Templates',
      description: 'Créez des modèles d\'emails personnalisables avec variables automatiques pour gagner du temps.',
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
      {/* Hero */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="font-serif text-2xl font-bold text-leaf">CIBLIX</div>
          <div className="flex gap-4">
            <Button variant="ghost" onClick={() => navigate('/login')}>{t('common.login')}</Button>
            <Button onClick={() => navigate('/register')}>{t('landing.cta')}</Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="font-serif text-5xl md:text-6xl font-bold text-gray-900 mb-6">
            La prospection intelligente pour les TPE et PME tunisiennes
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            Gérez vos opportunités, contacts et relances avec un assistant IA. 
            Simple, local, et adapté à votre business.
          </p>
          <div className="flex gap-4 justify-center">
            <Button size="lg" onClick={() => navigate('/register')} className="text-lg px-8">
              Essai gratuit 14 jours <ArrowRight className="ml-2" size={20} />
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
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {plans.map((plan, idx) => (
              <Card key={idx} className={`border-2 ${plan.popular ? 'border-leaf shadow-lg' : ''}`}>
                <CardContent className="p-6">
                  {plan.popular && (
                    <div className="bg-leaf text-white text-sm font-semibold text-center py-1 rounded mb-4">
                      Plus populaire
                    </div>
                  )}
                  <h3 className="font-semibold text-2xl mb-2">{plan.name}</h3>
                  <div className="mb-6">
                    <span className="text-4xl font-bold">{plan.price}</span>
                    <span className="text-gray-600">{plan.period}</span>
                    {plan.sub && <p className="text-xs text-muted-foreground mt-1">{plan.sub}</p>}
                  </div>
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
                    onClick={() => navigate('/pricing')}
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
            Prêt à accélérer votre prospection avec l'IA ?
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
      <footer className="bg-gray-900 text-white py-12 px-4">
        <div className="max-w-7xl mx-auto grid md:grid-cols-4 gap-8">
          <div>
            <h3 className="font-serif text-2xl font-bold mb-4">CIBLIX</h3>
            <p className="text-gray-400">Plateforme de prospection intelligente pour les TPE et PME tunisiennes.</p>
          </div>
          <div>
            <h4 className="font-semibold mb-4">Produit</h4>
            <ul className="space-y-2 text-gray-400">
              <li>Fonctionnalités</li>
              <li>Tarifs</li>
              <li>Intégrations</li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-4">Support</h4>
            <ul className="space-y-2 text-gray-400">
              <li>Centre d'aide</li>
              <li>Contact</li>
              <li>FAQ</li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-4">Contact</h4>
            <ul className="space-y-2 text-gray-400">
              <li className="flex items-center gap-2"><Mail size={16} /> contact@ciblix.com</li>
              <li className="flex items-center gap-2"><Phone size={16} /> +216 XX XXX XXX</li>
              <li className="flex items-center gap-2"><MapPin size={16} /> Tunis, Tunisie</li>
            </ul>
          </div>
        </div>
        <div className="max-w-7xl mx-auto mt-8 pt-8 border-t border-gray-800 text-center text-gray-400">
          <p>© 2026 CIBLIX. Tous droits réservés.</p>
        </div>
      </footer>
    </div>
  );
}
