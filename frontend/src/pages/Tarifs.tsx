import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Check, CheckCircle2, Minus, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LandingFooter, LandingHeader } from '@/components/landing/LandingSections';
import { cn } from '@/lib/utils';

type Currency = 'TND' | 'EUR' | 'USD';
type BillingInterval = 'month' | 'year';
type TierId = 'DECOUVERTE' | 'CROISSANCE' | 'PRO';

const CURRENCY_KEY = 'ciblix_pricing_currency';
const INTERVAL_KEY = 'ciblix_pricing_interval';

const SOLUTION = ['Prospecteur', 'Veilleur', 'Analyste', 'Assistant', 'Gmail (connecteur)'] as const;

const TIERS: Array<{
  id: TierId;
  name: string;
  monthly: Record<Currency, number>;
  yearly: Record<Currency, number>;
  users: string;
  actions: string;
  highlight?: boolean;
  features: string[];
}> = [
  {
    id: 'DECOUVERTE',
    name: 'Essentiel',
    monthly: { TND: 65, EUR: 20, USD: 22 },
    yearly: { TND: 650, EUR: 200, USD: 220 },
    users: '1 utilisateur',
    actions: '100 actions IA / mois',
    features: ['Solution complète (4 agents)', 'Gmail (connecteur)', 'Essai 7 jours inclus'],
  },
  {
    id: 'CROISSANCE',
    name: 'Croissance',
    monthly: { TND: 89, EUR: 28, USD: 30 },
    yearly: { TND: 890, EUR: 280, USD: 300 },
    users: '3 utilisateurs',
    actions: '300 actions IA / mois',
    highlight: true,
    features: [
      'Solution complète (4 agents)',
      'Gmail (connecteur)',
      'Mémoire partagée & pipeline',
      'Essai 7 jours inclus',
    ],
  },
  {
    id: 'PRO',
    name: 'Pro',
    monthly: { TND: 129, EUR: 40, USD: 44 },
    yearly: { TND: 1290, EUR: 400, USD: 440 },
    users: '10 utilisateurs',
    actions: '1 000 actions IA / mois',
    features: [
      'Solution complète (4 agents)',
      'Gmail (connecteur)',
      'Dépassement soft-cap autorisé',
      'Webhook CRM externe',
      'Essai 7 jours inclus',
    ],
  },
];

type Cell = boolean | string;

const COMPARE_ROWS: Array<{ label: string; values: [Cell, Cell, Cell] }> = [
  { label: 'Solution complète (4 agents)', values: [true, true, true] },
  { label: 'Gmail (connecteur)', values: [true, true, true] },
  { label: 'Actions IA / mois', values: ['100', '300', '1 000'] },
  { label: 'Dépassement soft-cap', values: [false, false, true] },
  { label: 'Mémoire partagée', values: [true, true, true] },
  { label: 'Webhook CRM externe', values: [false, false, true] },
  { label: 'Support', values: ['email', 'email + chat', 'prioritaire'] },
  { label: 'Utilisateurs inclus', values: ['1', '3', '10'] },
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
    q: 'Quelle est la différence entre mensuel et annuel ?',
    a: 'Le paiement annuel équivaut à 10 mois : vous économisez 2 mois par rapport au mensuel.',
  },
  {
    q: "Que se passe-t-il si je dépasse mon quota d'actions IA ?",
    a: 'En mode soft-cap, vous êtes notifié du dépassement sans coupure brutale. Le palier Pro peut autoriser le dépassement selon votre configuration.',
  },
  {
    q: 'Les plans incluent-ils tous les agents ?',
    a: 'Oui. Chaque palier inclut la solution complète (Prospecteur, Veilleur, Analyste, Assistant). Seuls le nombre d’utilisateurs et le quota d’actions IA changent.',
  },
  {
    q: "Que contient l'essai gratuit de 7 jours ?",
    a: "L'essai active la solution complète avec un quota dédié, quel que soit le palier choisi au départ.",
  },
];

function detectDefaultCurrency(): Currency {
  try {
    const stored = localStorage.getItem(CURRENCY_KEY) as Currency | null;
    if (stored === 'TND' || stored === 'EUR' || stored === 'USD') return stored;
  } catch {
    /* ignore */
  }
  return 'TND';
}

function CompareCell({ value }: { value: Cell }) {
  if (value === true) {
    return <Check size={18} className="mx-auto text-[#016AEB]" aria-label="Inclus" />;
  }
  if (value === false) {
    return <Minus size={16} className="mx-auto text-neutral-300" aria-label="Non inclus" />;
  }
  return <span className="text-xs font-medium text-foreground/80">{value}</span>;
}

export function Tarifs() {
  const navigate = useNavigate();
  const [currency, setCurrency] = useState<Currency>('TND');
  const [interval, setInterval] = useState<BillingInterval>('month');
  const [openFaq, setOpenFaq] = useState<string | null>(FAQ[0]?.q ?? null);

  useEffect(() => {
    setCurrency(detectDefaultCurrency());
    try {
      const stored = localStorage.getItem(INTERVAL_KEY) as BillingInterval | null;
      if (stored === 'month' || stored === 'year') setInterval(stored);
    } catch {
      /* ignore */
    }
  }, []);

  const symbol = useMemo(() => (currency === 'TND' ? 'TND' : currency === 'EUR' ? '€' : '$'), [currency]);

  const setAndPersistCurrency = (c: Currency) => {
    setCurrency(c);
    try {
      localStorage.setItem(CURRENCY_KEY, c);
    } catch {
      /* ignore */
    }
  };

  const setAndPersistInterval = (i: BillingInterval) => {
    setInterval(i);
    try {
      localStorage.setItem(INTERVAL_KEY, i);
    } catch {
      /* ignore */
    }
  };

  const startTrial = (tier: TierId) => {
    navigate(`/register?tier=${tier}&currency=${currency}&interval=${interval}&trial=7`);
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
              Trois plans. Une seule solution complète.
            </h1>
            <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
              Prospecteur, Veilleur, Analyste et Assistant inclus partout. Vous choisissez selon votre usage et le
              nombre d’utilisateurs.
            </p>
          </div>

          <div className="flex flex-col items-center gap-3 pb-10">
            <div className="inline-flex rounded-full bg-white p-1 ring-1 ring-[#BED6F6]">
              {(
                [
                  { id: 'month' as const, label: 'Mensuel' },
                  { id: 'year' as const, label: 'Annuel (−2 mois)' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setAndPersistInterval(opt.id)}
                  className={cn(
                    'rounded-full px-4 py-1.5 text-sm font-bold transition',
                    interval === opt.id ? 'bg-[#016AEB] text-white' : 'text-foreground/70'
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <div className="flex justify-center gap-2">
              {(['TND', 'EUR', 'USD'] as Currency[]).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setAndPersistCurrency(c)}
                  className={cn(
                    'rounded-full px-4 py-1.5 text-sm font-bold transition',
                    currency === c ? 'bg-[#016AEB] text-white' : 'bg-white text-foreground/70 ring-1 ring-[#BED6F6]'
                  )}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6 md:py-16">
          <div className="grid items-stretch gap-6 md:grid-cols-3">
            {TIERS.map((tier) => {
              const price = interval === 'year' ? tier.yearly[currency] : tier.monthly[currency];
              const periodLabel = interval === 'year' ? ` ${symbol}/an` : ` ${symbol}/mois`;
              const monthlyEquiv =
                interval === 'year' ? Math.round((tier.yearly[currency] / 12) * 10) / 10 : null;

              return (
                <div
                  key={tier.id}
                  className={cn(
                    'relative flex flex-col rounded-3xl border bg-white p-6',
                    tier.highlight
                      ? 'border-[#016AEB] shadow-lg ring-2 ring-[#BED6F6] md:-mt-2 md:mb-2'
                      : 'border-[#BED6F6]/50 shadow-sm'
                  )}
                >
                  {tier.highlight ? (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#016AEB] px-3 py-1 text-xs font-semibold text-white">
                      Le plus choisi
                    </span>
                  ) : null}
                  <h2 className="mb-2 text-xl font-bold">{tier.name}</h2>
                  <p className="mb-1">
                    <span className="text-4xl font-bold tracking-tight">{price}</span>
                    <span className="text-sm text-muted-foreground">{periodLabel}</span>
                  </p>
                  {monthlyEquiv != null ? (
                    <p className="mb-2 text-xs text-muted-foreground">soit ~{monthlyEquiv} {symbol}/mois</p>
                  ) : (
                    <p className="mb-2 text-xs text-transparent">.</p>
                  )}
                  <p className="mb-3 inline-flex w-fit rounded-full bg-[#eef5ff] px-3 py-1 text-xs font-semibold text-[#016AEB]">
                    {tier.users} · {tier.actions}
                  </p>
                  <div className="mb-5 rounded-2xl border border-[#BED6F6]/60 bg-[#f7faff] p-3">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#1E72B9]">
                      Inclut · Solution complète
                    </p>
                    <ul className="space-y-1.5">
                      {SOLUTION.map((item) => (
                        <li key={item} className="flex gap-2 text-sm text-foreground/80">
                          <Check size={14} className="mt-0.5 shrink-0 text-[#016AEB]" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <ul className="mb-8 flex-1 space-y-2 text-sm text-muted-foreground">
                    {tier.features.map((f) => (
                      <li key={f} className="flex gap-2">
                        <Check size={16} className="mt-0.5 shrink-0 text-[#016AEB]" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Button className="w-full rounded-xl" onClick={() => startTrial(tier.id)}>
                    Essai gratuit
                    <ArrowRight size={16} className="ml-2" />
                  </Button>
                  <p className="mt-3 text-center text-xs text-muted-foreground">Aucune carte bancaire requise</p>
                </div>
              );
            })}
          </div>
          <p className="mx-auto mt-8 max-w-2xl text-center text-sm text-muted-foreground">
            Essai 7 jours : solution complète incluse. Ensuite, votre palier définit le quota et les utilisateurs.
          </p>
        </section>

        <section className="border-y border-[#BED6F6]/30 bg-[#f7faff] py-14 md:py-16">
          <div className="mx-auto max-w-5xl px-4 sm:px-6">
            <h2 className="mb-2 text-center font-serif text-2xl font-bold md:text-3xl">Comparatif détaillé</h2>
            <p className="mb-8 text-center text-sm text-muted-foreground">
              Même solution sur les 3 plans — la différence, c’est l’usage.
            </p>
            <div className="overflow-x-auto rounded-2xl border border-[#BED6F6]/50 bg-white">
              <table className="w-full min-w-[560px] text-sm">
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
                      <td className="px-4 py-3 text-left text-muted-foreground">{row.label}</td>
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

        <section className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
          <ul className="mb-12 grid gap-3 sm:grid-cols-2">
            {REASSURANCE.map((r) => (
              <li key={r} className="flex items-start gap-2 text-sm text-muted-foreground">
                <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-[#016AEB]" />
                {r}
              </li>
            ))}
          </ul>
          <h2 className="mb-6 text-center font-serif text-2xl font-bold">FAQ</h2>
          <div className="space-y-3">
            {FAQ.map((item) => {
              const open = openFaq === item.q;
              return (
                <button
                  key={item.q}
                  type="button"
                  onClick={() => setOpenFaq(open ? null : item.q)}
                  className="w-full rounded-2xl border border-[#BED6F6]/50 bg-white p-4 text-left"
                >
                  <p className="font-semibold text-foreground">{item.q}</p>
                  {open ? <p className="mt-2 text-sm text-muted-foreground">{item.a}</p> : null}
                </button>
              );
            })}
          </div>
        </section>
      </main>

      <LandingFooter />
    </div>
  );
}
