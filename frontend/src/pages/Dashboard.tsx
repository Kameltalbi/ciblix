import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
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
    growthPct: number | null;
  };
  funnel: Array<{
    key: string;
    count: number;
    conversionPct: number | null;
  }>;
  opportunitySources: Array<{ key: string; value: number; pct: number }>;
  agentActivity: Array<{
    slug: string;
    actions: number;
    active: boolean;
  }>;
  todaysActions: Array<{
    id: string;
    count: number;
    href: string;
  }>;
  timeline: Array<{
    id: string;
    at: string;
    source: string;
    resume: string | null;
    contactId: string | null;
    contactName: string | null;
  }>;
  team: Array<{
    slug: string;
    metricKey: string;
    metricCount: number;
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

const CHART = {
  blue: '#016AEB',
  teal: '#0D9488',
  amber: '#D97706',
  violet: '#7C3AED',
  rose: '#E11D48',
} as const;

const SOURCE_COLORS = [CHART.blue, CHART.teal, CHART.amber, CHART.violet, CHART.rose];

const SERIES_KEYS = ['prospects', 'opportunities', 'proposals'] as const;
const SERIES_COLORS: Record<(typeof SERIES_KEYS)[number], string> = {
  prospects: CHART.blue,
  opportunities: CHART.teal,
  proposals: CHART.amber,
};

function dateLocale(lang: string) {
  if (lang.startsWith('ar')) return 'ar-TN';
  if (lang.startsWith('en')) return 'en-GB';
  return 'fr-FR';
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

const LAST_VISIT_KEY = 'ciblix-last-dashboard-visit';

function OvernightTeamStrip() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const sinceIso = useMemo(() => {
    const raw = localStorage.getItem(LAST_VISIT_KEY);
    if (raw) {
      const d = new Date(raw);
      if (!Number.isNaN(d.getTime())) return d.toISOString();
    }
    return new Date(Date.now() - 24 * 3600_000).toISOString();
  }, []);

  const { data, isPending } = useQuery({
    queryKey: ['agent-team-overnight', sinceIso],
    queryFn: () =>
      api.get('/agent-team/overnight', { params: { since: sinceIso } }).then((r) => r.data),
    staleTime: 60_000,
  });

  useEffect(() => {
    return () => {
      localStorage.setItem(LAST_VISIT_KEY, new Date().toISOString());
    };
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      localStorage.setItem(LAST_VISIT_KEY, new Date().toISOString());
    }, 4000);
    return () => clearTimeout(timer);
  }, []);

  if (isPending) {
    return (
      <Surface className="border-[#BED6F6]/80 bg-gradient-to-br from-white to-[#F0F7FF]">
        <p className="text-sm text-slate-500">{t('agentTeam.overnightLoading')}</p>
      </Surface>
    );
  }

  if (!data?.teamConfigured) {
    return (
      <Surface className="border-amber-200/80 bg-gradient-to-br from-amber-50/50 to-white">
        <h2 className="text-lg font-semibold text-slate-900">{t('agentTeam.setupTitle')}</h2>
        <p className="mt-1 max-w-2xl text-sm text-slate-600">{t('agentTeam.setupBody')}</p>
          <Button className="mt-4 rounded-xl" onClick={() => navigate('/mission')}>
            {t('agentTeam.setupCta')}
          </Button>
      </Surface>
    );
  }

  const items = [
    { value: data.companiesDetected ?? data.scoutSignals ?? 0, label: t('agentTeam.statDetected') },
    { value: data.opportunitiesAnalyzed ?? data.priorityOpportunities ?? 0, label: t('agentTeam.statOpps') },
    { value: data.priorityOpportunities ?? 0, label: t('agentTeam.statPriority') },
    { value: data.scoutSignals ?? 0, label: t('agentTeam.statTenders') },
    { value: data.companiesEnriched ?? 0, label: t('agentTeam.statEnriched') },
    { value: data.messagesPrepared ?? 0, label: t('agentTeam.statMessages') },
  ];

  const hasActivity = items.some((i) => i.value > 0);

  return (
    <Surface className="border-[#BED6F6]/80 bg-gradient-to-br from-white to-[#F0F7FF]">
      <div className="mb-1 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[#016AEB]">
            {t('agentTeam.overnightEyebrow')}
          </p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
            {t('agentTeam.overnightTitle')}
          </h2>
          <p className="mt-1 text-sm text-slate-500">{t('agentTeam.overnightSubtitle')}</p>
        </div>
        {data.teamWorking ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-100">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
            {t('agentTeam.teamWorking')}
          </span>
        ) : null}
      </div>

      {hasActivity ? (
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {items.map((item) => (
            <div key={item.label} className="rounded-xl bg-white/90 px-3 py-3 ring-1 ring-slate-100">
              <p className="text-2xl font-semibold tabular-nums text-[#016AEB]">{item.value}</p>
              <p className="mt-1 text-xs leading-snug text-slate-500">{item.label}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-5 rounded-xl bg-white/80 px-4 py-6 text-center ring-1 ring-slate-100">
          <p className="text-sm font-medium text-slate-800">{t('agentTeam.emptyTitle')}</p>
          <p className="mt-1 text-sm text-slate-500">{t('agentTeam.emptyBody')}</p>
        </div>
      )}
    </Surface>
  );
}

export function Dashboard() {
  const { t, i18n } = useTranslation();
  const locale = dateLocale(i18n.resolvedLanguage || i18n.language || 'fr');

  const [visibleSeries, setVisibleSeries] = useState<Record<(typeof SERIES_KEYS)[number], boolean>>({
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

  const series = useMemo(
    () =>
      SERIES_KEYS.map((key) => ({
        key,
        label: t(`performance.series.${key}`),
        color: SERIES_COLORS[key],
      })),
    [t]
  );

  const chartData = useMemo(
    () =>
      (data?.evolution.days || []).map((d) => ({
        ...d,
        label: new Date(d.date).toLocaleDateString(locale, { day: 'numeric', month: 'short' }),
      })),
    [data?.evolution.days, locale]
  );

  const maxFunnel = Math.max(...(data?.funnel.map((f) => f.count) || [1]), 1);
  const maxAgentActions = Math.max(...(data?.agentActivity.map((a) => a.actions) || [1]), 1);

  const agentActivityChart = useMemo(
    () =>
      (data?.agentActivity || []).map((a) => ({
        ...a,
        name: t(`performance.agents.${a.slug}.name`, { defaultValue: a.slug }),
      })),
    [data?.agentActivity, t]
  );

  if (isPending) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-slate-400">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> {t('performance.loading')}
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="mx-auto max-w-md space-y-4 py-24 text-center">
        <p className="text-sm text-slate-500">{t('performance.loadError')}</p>
        <Button variant="outline" size="sm" disabled={isFetching} onClick={() => void refetch()}>
          {isFetching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {t('performance.retry')}
        </Button>
      </div>
    );
  }

  const growth = data.evolution.growthPct;
  const insight =
    growth == null
      ? t('performance.insightNeutral')
      : growth >= 0
        ? t('performance.insightUp', { pct: growth })
        : t('performance.insightDown', { pct: Math.abs(growth) });

  return (
    <div className="-mx-5 -my-6 min-h-[calc(100vh-4rem)] bg-[#F7F8FA] px-5 py-6 md:-mx-8 md:-my-8 md:px-8 md:py-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <TrialEndingBanner />

        <OvernightTeamStrip />

        <header className="max-w-3xl">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            {t('performance.title')}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-500 sm:text-[15px]">
            {t('performance.subtitleLiving')}
          </p>
        </header>

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
                <p className="mt-1 text-sm text-slate-500">{t(`performance.kpis.${kpi.key}`)}</p>
              </Surface>
            );
          })}
        </section>

        <Surface className="p-5 sm:p-6">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">{t('performance.evolutionTitle')}</h2>
              <p className="mt-0.5 text-xs text-slate-500">{t('performance.last30Days')}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {series.map((s) => (
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
                  {series.map((s) => (
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
                {series.map(
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
          <p className="mt-3 text-sm font-medium text-slate-600">{insight}</p>
        </Surface>

        <section className="grid gap-4 lg:grid-cols-5">
          <Surface className="lg:col-span-3">
            <h2 className="mb-5 text-base font-semibold text-slate-900">{t('performance.funnelTitle')}</h2>
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
                            <span className="text-sm font-medium opacity-95">
                              {t(`performance.funnel.${stage.key}`)}
                            </span>
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
            <h2 className="mb-1 text-base font-semibold text-slate-900">{t('performance.sourcesTitle')}</h2>
            <p className="mb-4 text-xs text-slate-500">{t('performance.sourcesSubtitle')}</p>
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.opportunitySources.map((s) => ({
                      ...s,
                      name: t(`performance.sources.${s.key}`, { defaultValue: s.key }),
                    }))}
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
                <li key={s.key} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-slate-600">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: SOURCE_COLORS[i % SOURCE_COLORS.length] }}
                    />
                    {t(`performance.sources.${s.key}`, { defaultValue: s.key })}
                  </span>
                  <span className="font-semibold tabular-nums text-slate-900">{s.pct}%</span>
                </li>
              ))}
            </ul>
          </Surface>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <Surface>
            <h2 className="mb-4 text-base font-semibold text-slate-900">
              {t('performance.agentActivityTitle')}
            </h2>
            <div className="h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={agentActivityChart}
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
                    formatter={(value: number) => [t('performance.activityTooltip', { count: value }), '']}
                    contentStyle={{
                      borderRadius: 12,
                      border: '1px solid #E2E8F0',
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="actions" radius={[0, 8, 8, 0]} barSize={22} fill={CHART.blue}>
                    {agentActivityChart.map((_, i) => (
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
              {t('performance.actionsTitle')}
            </h2>
            {data.todaysActions.length === 0 ? (
              <p className="rounded-xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                {t('performance.actionsEmpty')}
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
                        {t(`performance.todaysActions.${action.id}.label`)}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      className="rounded-xl bg-[#016AEB] px-3.5 text-white hover:bg-[#0158c7]"
                      asChild
                    >
                      <Link to={action.href}>{t(`performance.todaysActions.${action.id}.cta`)}</Link>
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </Surface>
        </section>

        <Surface>
          <h2 className="mb-4 text-base font-semibold text-slate-900">{t('performance.timelineTitle')}</h2>
          {data.timeline.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">{t('performance.timelineEmpty')}</p>
          ) : (
            <ol className="relative space-y-0 border-l border-slate-200 ml-3">
              {data.timeline.map((item) => (
                <li key={item.id} className="relative pb-5 pl-6 last:pb-0">
                  <span className="absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full bg-[#016AEB] ring-4 ring-white" />
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                    <span className="text-xs font-semibold tabular-nums text-slate-400">
                      {new Date(item.at).toLocaleTimeString(locale, {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {t(`performance.sourcesAgents.${item.source}`, { defaultValue: item.source })}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-700">
                    {item.resume || t('performance.actionLogged')}
                    {item.contactName ? (
                      <span className="text-slate-400"> · {item.contactName}</span>
                    ) : null}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </Surface>

        <section>
          <h2 className="mb-3 text-base font-semibold text-slate-900">{t('performance.teamTitle')}</h2>
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
                      <p className="text-sm font-semibold text-slate-900">
                        {t(`performance.agents.${agent.slug}.name`)}
                      </p>
                      <p className="text-xs text-slate-500">
                        {t(`performance.agents.${agent.slug}.role`)}
                      </p>
                    </div>
                  </div>
                  <p className="mt-4 flex-1 text-sm font-medium text-slate-700">
                    {t(`performance.metrics.${agent.metricKey}`, { count: agent.metricCount })}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4 w-full justify-between rounded-xl border-slate-200"
                    asChild
                  >
                    <Link to={agent.href}>
                      {t('performance.open')}
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
