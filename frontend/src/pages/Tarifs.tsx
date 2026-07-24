import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Check, CheckCircle2, Minus, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LandingFooter, LandingHeader } from '@/components/landing/LandingSections';
import { cn } from '@/lib/utils';

type Currency = 'TND' | 'EUR' | 'USD';
type BillingInterval = 'month' | 'year';
type TierId = 'DECOUVERTE' | 'CROISSANCE' | 'PRO';
type TierKey = 'essentiel' | 'croissance' | 'pro';

const CURRENCY_KEY = 'ciblix_pricing_currency';
const INTERVAL_KEY = 'ciblix_pricing_interval';

const TIER_META: Array<{
  id: TierId;
  key: TierKey;
  monthly: Record<Currency, number>;
  yearly: Record<Currency, number>;
  highlight?: boolean;
}> = [
  {
    id: 'DECOUVERTE',
    key: 'essentiel',
    monthly: { TND: 65, EUR: 20, USD: 22 },
    yearly: { TND: 650, EUR: 200, USD: 220 },
  },
  {
    id: 'CROISSANCE',
    key: 'croissance',
    monthly: { TND: 89, EUR: 28, USD: 30 },
    yearly: { TND: 890, EUR: 280, USD: 300 },
    highlight: true,
  },
  {
    id: 'PRO',
    key: 'pro',
    monthly: { TND: 129, EUR: 40, USD: 44 },
    yearly: { TND: 1290, EUR: 400, USD: 440 },
  },
];

type Cell = boolean | string;

function detectDefaultCurrency(): Currency {
  try {
    const stored = localStorage.getItem(CURRENCY_KEY) as Currency | null;
    if (stored === 'TND' || stored === 'EUR' || stored === 'USD') return stored;
  } catch {
    /* ignore */
  }
  return 'TND';
}

function CompareCell({
  value,
  includedLabel,
  notIncludedLabel,
}: {
  value: Cell;
  includedLabel: string;
  notIncludedLabel: string;
}) {
  if (value === true) {
    return <Check size={18} className="mx-auto text-[#016AEB]" aria-label={includedLabel} />;
  }
  if (value === false) {
    return <Minus size={16} className="mx-auto text-neutral-300" aria-label={notIncludedLabel} />;
  }
  return <span className="text-xs font-medium text-foreground/80">{value}</span>;
}

export function Tarifs() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [currency, setCurrency] = useState<Currency>('TND');
  const [interval, setInterval] = useState<BillingInterval>('month');
  const [openFaq, setOpenFaq] = useState<number>(0);

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

  const agents = useMemo(
    () =>
      (['prospecteur', 'veilleur', 'analyste', 'assistant'] as const).map((k) =>
        t(`tarifs.agents.${k}`)
      ),
    [t]
  );

  const reassurance = t('tarifs.reassurance', { returnObjects: true }) as string[];
  const faq = t('tarifs.faq', { returnObjects: true }) as Array<{ q: string; a: string }>;

  const compareRows: Array<{ label: string; values: [Cell, Cell, Cell] }> = useMemo(
    () => [
      { label: t('tarifs.compare.fullSolution'), values: [true, true, true] },
      { label: t('tarifs.compare.gmail'), values: [false, true, true] },
      {
        label: t('tarifs.compare.actionsPerMonth'),
        values: [
          t('tarifs.compare.actions100'),
          t('tarifs.compare.actions300'),
          t('tarifs.compare.actions1000'),
        ],
      },
      { label: t('tarifs.compare.softCap'), values: [false, false, true] },
      { label: t('tarifs.compare.sharedMemory'), values: [true, true, true] },
      { label: t('tarifs.compare.webhook'), values: [false, false, true] },
      {
        label: t('tarifs.compare.support'),
        values: [
          t('tarifs.compare.supportEmail'),
          t('tarifs.compare.supportEmailChat'),
          t('tarifs.compare.supportPriority'),
        ],
      },
      { label: t('tarifs.compare.users'), values: ['1', '3', '10'] },
    ],
    [t]
  );

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
              <Sparkles size={14} /> {t('tarifs.badge')}
            </div>
            <h1 className="mb-4 font-serif text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
              {t('tarifs.title')}
            </h1>
            <p className="mx-auto max-w-2xl text-lg text-muted-foreground">{t('tarifs.subtitle')}</p>
          </div>

          <div className="flex flex-col items-center gap-3 pb-10">
            <div className="inline-flex rounded-full bg-white p-1 ring-1 ring-[#BED6F6]">
              {(
                [
                  { id: 'month' as const, label: t('tarifs.monthly') },
                  { id: 'year' as const, label: t('tarifs.yearly') },
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
            {TIER_META.map((tier) => {
              const price = interval === 'year' ? tier.yearly[currency] : tier.monthly[currency];
              const periodLabel =
                interval === 'year'
                  ? ` ${t('tarifs.perYear', { symbol })}`
                  : ` ${t('tarifs.perMonth', { symbol })}`;
              const monthlyEquiv =
                interval === 'year' ? Math.round((tier.yearly[currency] / 12) * 10) / 10 : null;
              const name = t(`tarifs.tiers.${tier.key}.name`);
              const users = t(`tarifs.tiers.${tier.key}.users`);
              const actions = t(`tarifs.tiers.${tier.key}.actions`);
              const features = t(`tarifs.tiers.${tier.key}.features`, {
                returnObjects: true,
              }) as string[];

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
                      {t('tarifs.popular')}
                    </span>
                  ) : null}
                  <h2 className="mb-2 text-xl font-bold">{name}</h2>
                  <p className="mb-1">
                    <span className="text-4xl font-bold tracking-tight">{price}</span>
                    <span className="text-sm text-muted-foreground">{periodLabel}</span>
                  </p>
                  {monthlyEquiv != null ? (
                    <p className="mb-2 text-xs text-muted-foreground">
                      {t('tarifs.monthlyEquiv', { price: monthlyEquiv, symbol })}
                    </p>
                  ) : (
                    <p className="mb-2 text-xs text-transparent">.</p>
                  )}
                  <p className="mb-3 inline-flex w-fit rounded-full bg-[#eef5ff] px-3 py-1 text-xs font-semibold text-[#016AEB]">
                    {users} · {actions}
                  </p>
                  <div className="mb-5 rounded-2xl border border-[#BED6F6]/60 bg-[#f7faff] p-3">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#1E72B9]">
                      {t('tarifs.includesTitle')}
                    </p>
                    <ul className="space-y-1.5">
                      {agents.map((item) => (
                        <li key={item} className="flex gap-2 text-sm text-foreground/80">
                          <Check size={14} className="mt-0.5 shrink-0 text-[#016AEB]" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <ul className="mb-8 flex-1 space-y-2 text-sm text-muted-foreground">
                    {(Array.isArray(features) ? features : []).map((f) => (
                      <li key={f} className="flex gap-2">
                        <Check size={16} className="mt-0.5 shrink-0 text-[#016AEB]" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Button className="w-full rounded-xl" onClick={() => startTrial(tier.id)}>
                    {t('tarifs.ctaTrial')}
                    <ArrowRight size={16} className="ml-2" />
                  </Button>
                  <p className="mt-3 text-center text-xs text-muted-foreground">{t('tarifs.noCard')}</p>
                </div>
              );
            })}
          </div>
          <p className="mx-auto mt-8 max-w-2xl text-center text-sm text-muted-foreground">
            {t('tarifs.trialFootnote')}
          </p>
        </section>

        <section className="border-y border-[#BED6F6]/30 bg-[#f7faff] py-14 md:py-16">
          <div className="mx-auto max-w-5xl px-4 sm:px-6">
            <h2 className="mb-2 text-center font-serif text-2xl font-bold md:text-3xl">
              {t('tarifs.compareTitle')}
            </h2>
            <p className="mb-8 text-center text-sm text-muted-foreground">{t('tarifs.compareSubtitle')}</p>
            <div className="overflow-x-auto rounded-2xl border border-[#BED6F6]/50 bg-white">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-[#BED6F6]/40 bg-white">
                    <th className="px-4 py-3 text-left font-semibold text-foreground">
                      {t('tarifs.featureColumn')}
                    </th>
                    {TIER_META.map((tier) => (
                      <th key={tier.id} className="px-3 py-3 text-center font-semibold text-foreground">
                        {t(`tarifs.tiers.${tier.key}.name`)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {compareRows.map((row) => (
                    <tr key={row.label} className="border-b border-[#BED6F6]/30 last:border-0">
                      <td className="px-4 py-3 text-left text-muted-foreground">{row.label}</td>
                      {row.values.map((v, i) => (
                        <td key={`${row.label}-${i}`} className="px-3 py-3 text-center">
                          <CompareCell
                            value={v}
                            includedLabel={t('tarifs.includedAria')}
                            notIncludedLabel={t('tarifs.notIncludedAria')}
                          />
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
            {(Array.isArray(reassurance) ? reassurance : []).map((r) => (
              <li key={r} className="flex items-start gap-2 text-sm text-muted-foreground">
                <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-[#016AEB]" />
                {r}
              </li>
            ))}
          </ul>
          <h2 className="mb-6 text-center font-serif text-2xl font-bold">{t('tarifs.faqTitle')}</h2>
          <div className="space-y-3">
            {(Array.isArray(faq) ? faq : []).map((item, idx) => {
              const open = openFaq === idx;
              return (
                <button
                  key={item.q}
                  type="button"
                  onClick={() => setOpenFaq(open ? -1 : idx)}
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
