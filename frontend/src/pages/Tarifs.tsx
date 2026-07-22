import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CheckCircle2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type Currency = 'TND' | 'EUR' | 'USD';
type TierId = 'DECOUVERTE' | 'CROISSANCE' | 'PRO' | 'ENTERPRISE';

const CURRENCY_KEY = 'ciblix_pricing_currency';

const TIERS: Array<{
  id: TierId;
  name: string;
  prices: Record<Currency, number | null>;
  highlight?: boolean;
  features: string[];
  cta: string;
}> = [
  {
    id: 'DECOUVERTE',
    name: 'Découverte',
    prices: { TND: 49, EUR: 19, USD: 21 },
    features: ['1 agent au choix (Chasseur IA)', 'Quota découverte (50 actions/mois)', 'Essai 7 jours inclus'],
    cta: "Commencer l'essai gratuit de 7 jours",
  },
  {
    id: 'CROISSANCE',
    name: 'Croissance',
    prices: { TND: 149, EUR: 49, USD: 55 },
    highlight: true,
    features: ['3 agents cœur', 'Mémoire partagée active', 'Pipeline inféré', 'Essai 7 jours inclus'],
    cta: "Commencer l'essai gratuit de 7 jours",
  },
  {
    id: 'PRO',
    name: 'Pro',
    prices: { TND: 299, EUR: 99, USD: 109 },
    features: ['Les 6 agents', 'Scoring avancé', 'Webhook CRM externe', 'Essai 7 jours inclus'],
    cta: "Commencer l'essai gratuit de 7 jours",
  },
  {
    id: 'ENTERPRISE',
    name: 'Enterprise',
    prices: { TND: null, EUR: null, USD: null },
    features: ['Multi-utilisateurs', 'SLA dédié', 'Personnalisation sectorielle'],
    cta: 'Nous contacter',
  },
];

function detectDefaultCurrency(): Currency {
  try {
    const stored = localStorage.getItem(CURRENCY_KEY) as Currency | null;
    if (stored === 'TND' || stored === 'EUR' || stored === 'USD') return stored;
  } catch {
    /* ignore */
  }
  const lang = navigator.language?.toLowerCase() || '';
  if (lang.includes('tn') || lang.endsWith('-tn')) return 'TND';
  if (lang.startsWith('fr')) return 'EUR';
  return 'EUR';
}

export function Tarifs() {
  const navigate = useNavigate();
  const [currency, setCurrency] = useState<Currency>('TND');

  useEffect(() => {
    setCurrency(detectDefaultCurrency());
  }, []);

  const symbol = useMemo(() => (currency === 'TND' ? 'TND' : currency === 'EUR' ? '€' : '$'), [currency]);

  const setAndPersist = (c: Currency) => {
    setCurrency(c);
    try {
      localStorage.setItem(CURRENCY_KEY, c);
    } catch {
      /* ignore */
    }
  };

  const startTrial = (tier: TierId) => {
    if (tier === 'ENTERPRISE') {
      window.location.href = 'mailto:contact@ciblix.com?subject=Ciblix%20Enterprise';
      return;
    }
    navigate(`/register?tier=${tier}&currency=${currency}&trial=7`);
  };

  return (
    <div className="min-h-screen bg-[#f7faff]">
      <div className="border-b border-[#BED6F6]/40 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <Link to="/" className="inline-flex items-center gap-2 text-sm font-medium text-[#0071DD] hover:underline">
            <ArrowLeft size={16} /> Accueil
          </Link>
          <img src="/logo-ciblix.png" alt="CIBLIX" className="h-10 object-contain" />
          <Link to="/login" className="text-sm font-semibold text-foreground/70 hover:text-[#0071DD]">
            Connexion
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="mb-10 text-center">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#BED6F6] bg-white px-3 py-1 text-sm font-medium text-[#1E72B9]">
            <Sparkles size={14} /> Essai 7 jours · sans carte bancaire
          </div>
          <h1 className="mb-3 font-serif text-4xl font-bold tracking-tight md:text-5xl">
            Un palier pour chaque étape de votre croissance
          </h1>
          <p className="mx-auto max-w-2xl text-muted-foreground">
            Choisissez un palier, démarrez l&apos;essai gratuit. Activez vos agents IA immédiatement.
          </p>
        </div>

        <div className="mb-10 flex justify-center gap-2">
          {(['TND', 'EUR', 'USD'] as Currency[]).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setAndPersist(c)}
              className={cn(
                'rounded-full px-4 py-1.5 text-sm font-semibold transition',
                currency === c ? 'bg-[#0071DD] text-white' : 'bg-white text-foreground/70 ring-1 ring-[#BED6F6]'
              )}
            >
              {c}
            </button>
          ))}
        </div>

        <div className="grid items-stretch gap-6 md:grid-cols-2 lg:grid-cols-4">
          {TIERS.map((tier) => (
            <div
              key={tier.id}
              className={cn(
                'relative flex flex-col rounded-3xl border bg-white p-6 shadow-sm',
                tier.highlight
                  ? 'border-[#016AEB] ring-2 ring-[#BED6F6] lg:-mt-3 lg:mb-3 lg:shadow-xl'
                  : 'border-[#BED6F6]/50'
              )}
            >
              {tier.highlight ? (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#016AEB] px-3 py-1 text-xs font-semibold text-white">
                  Le plus populaire
                </span>
              ) : null}
              <h2 className="mb-2 text-xl font-bold">{tier.name}</h2>
              {tier.prices[currency] != null ? (
                <p className="mb-5">
                  <span className="text-4xl font-bold tracking-tight">{tier.prices[currency]}</span>
                  <span className="text-sm text-muted-foreground"> {symbol}/mois</span>
                </p>
              ) : (
                <p className="mb-5 text-3xl font-bold">Sur devis</p>
              )}
              <ul className="mb-8 flex-1 space-y-2 text-sm text-muted-foreground">
                {tier.features.map((f) => (
                  <li key={f} className="flex gap-2">
                    <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-[#016AEB]" />
                    {f}
                  </li>
                ))}
              </ul>
              <Button
                className={cn('w-full', tier.highlight ? 'shadow-glow' : '')}
                variant={tier.highlight ? 'default' : 'outline'}
                onClick={() => startTrial(tier.id)}
              >
                {tier.cta}
                <ArrowRight size={16} className="ml-2" />
              </Button>
              {tier.id !== 'ENTERPRISE' ? (
                <p className="mt-3 text-center text-xs text-muted-foreground">Aucune carte bancaire requise</p>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
