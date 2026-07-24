import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Users,
  Target,
  Handshake,
  Banknote,
  Loader2,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Crosshair,
  Radar,
  Search,
  Bot,
  ChevronRight,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { TrialEndingBanner } from '@/components/TrialEndingBanner';
import { cn } from '@/lib/utils';

type PerformancePayload = {
  generatedAt: string;
  kpis: Array<{
    key: string;
    label: string;
    value: number;
    deltaPct: number | null;
  }>;
  evolution: {
    days: Array<{
      date: string;
      prospects: number;
      opportunities: number;
      proposals: number;
    }>;
    insight: string;
    growthPct: number | null;
  };
  funnel: Array<{
    key: string;
    label: string;
    count: number;
    conversionPct: number | null;
  }>;
  opportunitySources: Array<{ name: string; value: number; pct: number }>;
  agentActivity: Array<{
    slug: string;
    name: string;
    actions: number;
    active: boolean;
  }>;
  todaysActions: Array<{
    id: string;
    label: string;
    count: number;
    cta: string;
    href: string;
  }>;
  timeline: Array<{
    id: string;
    at: string;
    source: string;
    agentLabel: string;
    resume: string | null;
    contactId: string | null;
    contactName: string | null;
  }>;
  team: Array<{
    slug: string;
    name: string;
    role: string;
    metric: string;
    href: string;
    active: boolean;
  }>;
};

const KPI_ICONS: Record<string, LucideIcon> = {
  prospects: Users,
  opportunities: Target,
  proposals: Handshake,
  won: Banknote,
};

const AGENT_ICONS: Record<string, LucideIcon> = {
  'hunt-ai': Crosshair,
  'scout-ai': Radar,
  'analyste-ai': Search,
  'copilot-ia': Bot,
};

/** Couleurs variées saturées — contraste fort, pas de pastels. */
const CHART = {
  blue: '#016AEB',
  teal: '#0D9488',
  amber: '#D97706',
  violet: '#7C3AED',
  rose: '#E11D48',
} as const;

const SOURCE_COLORS = [CHART.blue, CHART.teal, CHART.amber, CHART.violet, CHART.rose];

const SERIES = [
  { key: 'prospects' as const, label: 'Prospects trouvés', color: CHART.blue },
  { key: 'opportunities' as const, label: 'Opportunités détectées', color: CHART.teal },
  { key: 'proposals' as const, label: 'Propositions envoyées', color: CHART.amber },
];

function formatDay(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function DeltaBadge({ delta }: { delta: number | null }) {
  if (delta == null) {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs font-medium text-slate-400">
        <Minus size={12} /> —
      </span>
    );
  }
  const up = delta >= 0;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 text-xs font-semibold',
        up ? 'text-emerald-600' : 'text-rose-600'
      )}
    >
      {up ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
      {up ? '+' : ''}
      {delta}%
    </span>
  );
}

function Surface({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]',
        className
      )}
    >
      {children}
    </div>
  );
}

export function Dashboard() {
  const [visibleSeries, setVisibleSeries] = useState<Record<(typeof SERIES)[number]['key'], boolean>>({
    prospects: true,
    opportunities: true,
    proposals: true,
  });

  const { data, isPending, isError, refetch, isFetching } = useQuery<PerformancePayload>({
    queryKey: ['ops-performance'],
    queryFn: () => api.get('/ops/performance').then((r) => r.data),
    refetchInterval: 60_000,
    retry: 1,
  });

  const chartData = useMemo(
    () =>
      (data?.evolution.days || []).map((d) => ({
        ...d,
        label: formatDay(d.date),
      })),
    [data?.evolution.days]
  );

  const maxFunnel = Math.max(...(data?.funnel.map((f) => f.count) || [1]), 1);
  const maxAgentActions = Math.max(...(data?.agentActivity.map((a) => a.actions) || [1]), 1);

  if (isPending) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-slate-400">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Chargement de la performance…
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="mx-auto max-w-md space-y-4 py-24 text-center">
        <p className="text-sm text-slate-500">Impossible de charger la performance commerciale.</p>
        <Button variant="outline" size="sm" disabled={isFetching} onClick={() => void refetch()}>
          {isFetching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Réessayer
        </Button>
      </div>
    );
  }

  return (
    <div className="-mx-5 -my-6 min-h-[calc(100vh-4rem)] bg-[#F7F8FA] px-5 py-6 md:-mx-8 md:-my-8 md:px-8 md:py-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <TrialEndingBanner />
        {/* Header */}
        <header className="max-w-3xl">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            Performance commerciale
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-500 sm:text-[15px]">
            Suivez en temps réel les opportunités détectées, les prospects qualifiés, les actions
            commerciales réalisées et leur impact sur votre développement.
          </p>
        </header>

        {/* 1. KPIs */}
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {data.kpis.map((kpi) => {
            const Icon = KPI_ICONS[kpi.key] || Target;
            return (
              <Surface
                key={kpi.key}
                className="group transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(15,23,42,0.06)]"
              >
                <div className="flex items-start justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 text-slate-600 ring-1 ring-slate-100">
                    <Icon size={18} strokeWidth={1.75} />
                  </div>
                  <DeltaBadge delta={kpi.deltaPct} />
                </div>
                <p className="mt-4 text-3xl font-semibold tracking-tight text-slate-900 tabular-nums sm:text-4xl">
                  {kpi.value}
                </p>
                <p className="mt-1 text-sm text-slate-500">{kpi.label}</p>
              </Surface>
            );
          })}
        </section>

        {/* 2. Evolution */}
        <Surface className="p-5 sm:p-6">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Évolution commerciale</h2>
              <p className="mt-0.5 text-xs text-slate-500">30 derniers jours</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {SERIES.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() =>
                    setVisibleSeries((prev) => ({ ...prev, [s.key]: !prev[s.key] }))
                  }
                  className={cn(
                    'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                    visibleSeries[s.key]
                      ? 'border-slate-200 bg-white text-slate-800 shadow-sm'
                      : 'border-transparent bg-slate-100 text-slate-400'
                  )}
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: visibleSeries[s.key] ? s.color : '#CBD5E1' }}
                  />
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          <div className="h-[280px] w-full sm:h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <defs>
                  {SERIES.map((s) => (
                    <linearGradient key={s.key} id={`grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={s.color} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={s.color} stopOpacity={0} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: '#94A3B8', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  minTickGap={28}
                />
                <YAxis
                  tick={{ fill: '#94A3B8', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: 12,
                    border: '1px solid #E2E8F0',
                    boxShadow: '0 8px 24px rgba(15,23,42,0.08)',
                    fontSize: 12,
                  }}
                />
                {SERIES.map(
                  (s) =>
                    visibleSeries[s.key] && (
                      <Area
                        key={s.key}
                        type="monotone"
                        dataKey={s.key}
                        name={s.label}
                        stroke={s.color}
                        strokeWidth={2.75}
                        fill={`url(#grad-${s.key})`}
                        dot={false}
                        activeDot={{ r: 4, strokeWidth: 0 }}
                      />
                    )
                )}
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-3 text-sm font-medium text-slate-600">{data.evolution.insight}</p>
        </Surface>

        {/* 3 + 4 : Funnel + Donut */}
        <section className="grid gap-4 lg:grid-cols-5">
          <Surface className="lg:col-span-3">
            <h2 className="mb-5 text-base font-semibold text-slate-900">Transformation commerciale</h2>
            <div className="space-y-3">
              {data.funnel.map((stage, idx) => {
                const widthPct = Math.max(12, Math.round((stage.count / maxFunnel) * 100));
                return (
                  <div key={stage.key} className="relative">
                    {idx > 0 ? (
                      <div className="mb-2 flex justify-center">
                        <div className="h-3 w-px bg-slate-200" />
                      </div>
                    ) : null}
                    <div className="flex items-center gap-3">
                      <div className="w-full">
                        <div
                          className="relative overflow-hidden rounded-xl bg-gradient-to-r from-[#016AEB] to-[#0D9488] px-4 py-3 text-white shadow-sm transition-all duration-500"
                          style={{ width: `${widthPct}%`, minWidth: '9rem' }}
                        >
                          <div className="flex flex-wrap items-baseline justify-between gap-2">
                            <span className="text-sm font-medium opacity-95">{stage.label}</span>
                            <span className="text-lg font-semibold tabular-nums">{stage.count}</span>
                          </div>
                        </div>
                      </div>
                      {stage.conversionPct != null ? (
                        <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold tabular-nums text-slate-600">
                          {stage.conversionPct}%
                        </span>
                      ) : (
                        <span className="w-12 shrink-0" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Surface>

          <Surface className="lg:col-span-2">
            <h2 className="mb-1 text-base font-semibold text-slate-900">Origine des opportunités</h2>
            <p className="mb-4 text-xs text-slate-500">Répartition ce mois</p>
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.opportunitySources}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={58}
                    outerRadius={86}
                    paddingAngle={3}
                    stroke="none"
                  >
                    {data.opportunitySources.map((_, i) => (
                      <Cell key={i} fill={SOURCE_COLORS[i % SOURCE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number, name: string) => [`${value}`, name]}
                    contentStyle={{
                      borderRadius: 12,
                      border: '1px solid #E2E8F0',
                      fontSize: 12,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="mt-2 space-y-2">
              {data.opportunitySources.map((s, i) => (
                <li key={s.name} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-slate-600">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: SOURCE_COLORS[i % SOURCE_COLORS.length] }}
                    />
                    {s.name}
                  </span>
                  <span className="font-semibold tabular-nums text-slate-900">{s.pct}%</span>
                </li>
              ))}
            </ul>
          </Surface>
        </section>

        {/* 5 + 6 : Agent activity + Actions */}
        <section className="grid gap-4 lg:grid-cols-2">
          <Surface>
            <h2 className="mb-4 text-base font-semibold text-slate-900">
              Activité de votre équipe IA
            </h2>
            <div className="h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={data.agentActivity}
                  layout="vertical"
                  margin={{ top: 0, right: 16, left: 8, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" horizontal={false} />
                  <XAxis type="number" hide domain={[0, Math.max(maxAgentActions, 5)]} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={88}
                    tick={{ fill: '#475569', fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    formatter={(value: number) => [`${value} actions`, 'Activité']}
                    contentStyle={{
                      borderRadius: 12,
                      border: '1px solid #E2E8F0',
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="actions" radius={[0, 8, 8, 0]} barSize={22} fill={CHART.blue}>
                    {data.agentActivity.map((_, i) => (
                      <Cell
                        key={i}
                        fill={[CHART.blue, CHART.teal, CHART.amber, CHART.violet][i % 4]}
                        fillOpacity={1}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Surface>

          <Surface>
            <h2 className="mb-4 text-base font-semibold text-slate-900">
              Actions à réaliser aujourd&apos;hui
            </h2>
            {data.todaysActions.length === 0 ? (
              <p className="rounded-xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                Rien d&apos;urgent pour le moment — vos agents travaillent.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {data.todaysActions.map((action) => (
                  <li
                    key={action.id}
                    className="flex items-center justify-between gap-3 py-3.5 first:pt-0 last:pb-0"
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-900">
                        <span className="tabular-nums text-[#016AEB]">{action.count}</span>{' '}
                        {action.label}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      className="rounded-xl bg-[#016AEB] px-3.5 text-white hover:bg-[#0158c7]"
                      asChild
                    >
                      <Link to={action.href}>{action.cta}</Link>
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </Surface>
        </section>

        {/* 7. Timeline */}
        <Surface>
          <h2 className="mb-4 text-base font-semibold text-slate-900">Activité récente</h2>
          {data.timeline.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">
              Aucune action récente — lancez une recherche ou une veille pour démarrer.
            </p>
          ) : (
            <ol className="relative space-y-0 border-l border-slate-200 ml-3">
              {data.timeline.map((item) => (
                <li key={item.id} className="relative pb-5 pl-6 last:pb-0">
                  <span className="absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full bg-[#016AEB] ring-4 ring-white" />
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                    <span className="text-xs font-semibold tabular-nums text-slate-400">
                      {formatTime(item.at)}
                    </span>
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {item.agentLabel}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-700">
                    {item.resume || 'Action enregistrée'}
                    {item.contactName ? (
                      <span className="text-slate-400"> · {item.contactName}</span>
                    ) : null}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </Surface>

        {/* 8. Team */}
        <section>
          <h2 className="mb-3 text-base font-semibold text-slate-900">Votre équipe IA</h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {data.team.map((agent) => {
              const Icon = AGENT_ICONS[agent.slug] || Bot;
              return (
                <Surface
                  key={agent.slug}
                  className="flex flex-col transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(15,23,42,0.06)]"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-50 text-slate-600 ring-1 ring-slate-100">
                      <Icon size={16} strokeWidth={1.75} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{agent.name}</p>
                      <p className="text-xs text-slate-500">{agent.role}</p>
                    </div>
                  </div>
                  <p className="mt-4 flex-1 text-sm font-medium text-slate-700">{agent.metric}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4 w-full justify-between rounded-xl border-slate-200"
                    asChild
                  >
                    <Link to={agent.href}>
                      Ouvrir
                      <ChevronRight size={14} />
                    </Link>
                  </Button>
                </Surface>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
