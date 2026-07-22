import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Check, CheckCircle2, Minus, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LandingFooter, LandingHeader } from '@/components/landing/LandingSections';
import { cn } from '@/lib/utils';

type Currency = 'TND' | 'EUR' | 'USD';
type TierId = 'DECOUVERTE' | 'CROISSANCE' | 'PRO' | 'ENTERPRISE';

const CURRENCY_KEY = 'ciblix_pricing_currency';
const EXPERT_MAIL = 'mailto:contact@ciblix.com?subject=Parler%20%C3%A0%20un%20expert%20Ciblix%20%E2%80%94%20Tarifs';

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
    features: ['1 agent au choix', 'Quota découverte', 'Essai 7 jours inclus'],
    cta: 'Essai gratuit',
  },
  {
    id: 'CROISSANCE',
    name: 'Croissance',
    prices: { TND: 149, EUR: 49, USD: 55 },
    highlight: true,
    features: [
      '3 agents cœur (Chasseur, Assistant, Gmail)',
      'Mémoire partagée active',
      'Pipeline inféré',
      'Essai 7 jours inclus',
    ],
    cta: 'Essai gratuit',
  },
  {
    id: 'PRO',
    name: 'Pro',
    prices: { TND: 299, EUR: 99, USD: 109 },
    features: ['Les 6 agents complets', 'Scoring avancé', 'Webhook CRM externe', 'Essai 7 jours inclus'],
    cta: 'Essai gratuit',
  },
  {
    id: 'ENTERPRISE',
    name: 'Enterprise',
    prices: { TND: null, EUR: null, USD: null },
    features: ['Tout Pro + multi-users', 'SLA dédié', 'Config sectorielle dédiée'],
    cta: 'Nous contacter',
  },
];

type Cell = boolean | 'choice' | string;

const COMPARE_ROWS: Array<{ label: string; values: [Cell, Cell, Cell, Cell] }> = [
  { label: 'Chasseur IA', values: ['choice', true, true, true] },
  { label: 'Assistant IA (Copilot)', values: ['choice', true, true, true] },
  { label: 'Veilleur IA', values: ['choice', false, true, true] },
  { label: "Rédacteur d'offres", values: ['choice', false, true, true] },
  { label: 'Gmail IA', values: ['choice', true, true, true] },
  { label: 'Vérificateur IA', values: ['choice', false, true, true] },
  { label: 'Mémoire partagée entre agents', values: [false, true, true, true] },
  { label: 'Webhook CRM externe', values: [false, false, true, true] },
  { label: 'Scoring personnalisé', values: [false, 'basique', 'avancé', 'avancé'] },
  { label: 'Support', values: ['email', 'email + chat', 'prioritaire', 'dédié'] },
  { label: 'Utilisateurs', values: ['1', '3', '10', 'illimité'] },
];

const REASSURANCE = [
  'Sans engagement — changez ou annulez à tout moment',
  "Sans carte bancaire pour l'essai",
  'Données hébergées de façon sécurisée',
  'Support en français et arabe',
];

const FAQ = [
  {
    q: 'Puis-je changer de palier à tout moment ?',
    a: 'Oui, vous pouvez passer à un palier supérieur ou inférieur depuis vos paramètres, à tout moment.',
  },
  {
    q: "Que se passe-t-il si je dépasse mon quota d'actions IA ?",
    a: 'En mode soft-cap, vous êtes notifié du dépassement sans coupure brutale. Les paliers Pro et Enterprise peuvent autoriser le dépassement selon votre configuration.',
  },
  {
    q: 'Puis-je payer en TND ?',
    a: 'Oui, les tarifs sont disponibles en TND, EUR et USD — utilisez le sélecteur en haut de page.',
  },
  {
    q: "Que contient exactement l'essai gratuit de 7 jours ?",
    a: "L'essai active toujours 3 agents (Chasseur IA, Assistant IA, Rédacteur d'offres), quel que soit le palier choisi au départ — pour montrer comment ils fonctionnent ensemble.",
  },
  {
    q: "Ai-je besoin d'un CRM existant pour utiliser Ciblix ?",
    a: "Non. Ciblix construit votre pipeline automatiquement dès le premier agent. Vous pouvez connecter un CRM externe plus tard, mais ce n'est jamais obligatoire.",
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

function CompareCell({ value }: { value: Cell }) {
  if (value === true) {
    return <Check size={18} className="mx-auto text-[#016AEB]" aria-label="Inclus" />;
  }
  if (value === false) {
    return <Minus size={16} className="mx-auto text-neutral-300" aria-label="Non inclus" />;
  }
  if (value === 'choice') {
    return (
      <span className="text-xs font-medium text-muted-foreground" title="1 agent au choix parmi les 6">
        ○*
      </span>
    );
  }
  return <span className="text-xs font-medium text-foreground/80">{value}</span>;
}

export function Tarifs() {
  const navigate = useNavigate();
  const [currency, setCurrency] = useState<Currency>('TND');
  const [openFaq, setOpenFaq] = useState<string | null>(FAQ[0]?.q ?? null);

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
    <div className="min-h-screen bg-white">
      <LandingHeader />

      <main>
        <section className="border-b border-[#BED6F6]/30 bg-gradient-to-b from-[#f7faff] to-white">
          <div className="mx-auto max-w-3xl px-4 py-14 text-center sm:px-6 md:py-20">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#BED6F6] bg-white px-3 py-1 text-sm font-medium text-[#1E72B9]">
              <Sparkles size={14} /> Essai 7 jours · sans carte bancaire
            </div>
            <h1 className="mb-4 font-serif text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
              Un palier pour chaque étape de votre croissance
            </h1>
            <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
              Commencez avec 3 agents connectés pendant 7 jours, sans carte bancaire. Passez au palier suivant quand
              vous êtes prêt.
            </p>
          </div>

          <div className="flex justify-center gap-2 pb-10">
            {(['TND', 'EUR', 'USD'] as Currency[]).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setAndPersist(c)}
                className={cn(
                  'rounded-full px-4 py-1.5 text-sm font-bold transition',
                  currency === c ? 'bg-[#016AEB] text-white' : 'bg-white text-foreground/70 ring-1 ring-[#BED6F6]'
                )}
              >
                {c}
              </button>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 md:py-16">
          <div className="grid items-stretch gap-6 md:grid-cols-2 lg:grid-cols-4">
            {TIERS.map((tier) => (
              <div
                key={tier.id}
                className={cn(
                  'relative flex flex-col rounded-3xl border bg-white p-6',
                  tier.highlight
                    ? 'border-[#016AEB] shadow-lg ring-2 ring-[#BED6F6] lg:-mt-2 lg:mb-2'
                    : 'border-[#BED6F6]/50 shadow-sm'
                )}
              >
                {tier.highlight ? (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#016AEB] px-3 py-1 text-xs font-semibold text-white">
                    Le plus choisi
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
          <p className="mx-auto mt-8 max-w-2xl text-center text-sm text-muted-foreground">
            Votre essai de 7 jours inclut toujours Chasseur IA, Assistant IA et Rédacteur d&apos;offres, quel que soit
            le palier choisi ici.
          </p>
        </section>

        {/* Tableau comparatif */}
        <section className="border-y border-[#BED6F6]/30 bg-[#f7faff] py-14 md:py-16">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 className="mb-2 text-center font-serif text-2xl font-bold md:text-3xl">Comparatif détaillé</h2>
            <p className="mb-8 text-center text-sm text-muted-foreground">○* = 1 agent au choix parmi les 6</p>
            <div className="overflow-x-auto rounded-2xl border border-[#BED6F6]/50 bg-white">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-[#BED6F6]/40 bg-white">
                    <th className="px-4 py-3 text-left font-semibold text-foreground">Fonctionnalité</th>
                    {TIERS.map((t) => (
                      <th key={t.id} className="px-3 py-3 text-center font-semibold text-foreground">
                        {t.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {COMPARE_ROWS.map((row) => (
                    <tr key={row.label} className="border-b border-[#BED6F6]/30 last:border-0">
                      <td className="px-4 py-3 font-medium text-foreground/80">{row.label}</td>
                      {row.values.map((v, i) => (
                        <td key={`${row.label}-${i}`} className="px-3 py-3 text-center">
                          <CompareCell value={v} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Réassurance */}
        <section className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
          <div className="grid gap-3 sm:grid-cols-2">
            {REASSURANCE.map((item) => (
              <div
                key={item}
                className="flex items-start gap-2.5 rounded-2xl border border-[#BED6F6]/40 bg-white px-4 py-3 text-sm"
              >
                <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-[#016AEB]" />
                <span className="font-medium text-foreground/80">{item}</span>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section className="mx-auto max-w-3xl px-4 pb-14 sm:px-6 md:pb-20">
          <h2 className="mb-6 text-center font-serif text-2xl font-bold md:text-3xl">Questions fréquentes</h2>
          <div className="space-y-2">
            {FAQ.map((item) => {
              const open = openFaq === item.q;
              return (
                <div key={item.q} className="rounded-2xl border border-[#BED6F6]/40 bg-white">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left text-sm font-semibold"
                    onClick={() => setOpenFaq(open ? null : item.q)}
                  >
                    {item.q}
                    <span className="text-[#016AEB]">{open ? '−' : '+'}</span>
                  </button>
                  {open ? (
                    <p className="border-t border-[#BED6F6]/30 px-4 py-3 text-sm leading-relaxed text-muted-foreground">
                      {item.a}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>

        {/* CTA fin */}
        <section className="bg-gradient-to-br from-[#0a2540] via-[#016AEB] to-[#1E72B9] py-14 text-white md:py-16">
          <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
            <h2 className="mb-3 font-serif text-2xl font-bold md:text-3xl">Une question avant de choisir ?</h2>
            <p className="mb-7 text-white/80">Parlez à un expert — ou explorez comment les agents travaillent ensemble.</p>
            <div className="flex flex-col justify-center gap-3 sm:flex-row">
              <a href={EXPERT_MAIL}>
                <Button size="lg" className="w-full bg-white px-8 text-[#016AEB] hover:bg-white/90 sm:w-auto">
                  Parler à un expert <ArrowRight size={18} className="ml-2" />
                </Button>
              </a>
              <Link to="/fonctionnalites">
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full border-white/40 bg-transparent px-8 text-white hover:bg-white/10 sm:w-auto"
                >
                  Comment ça fonctionne
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <LandingFooter />
    </div>
  );
}
