import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Bot,
  Radio,
  Radar,
  FileSignature,
  ShieldCheck,
  Megaphone,
  Mail,
  Sparkles,
  Zap,
  Target,
  CheckCircle2,
  Loader2,
  ArrowRight,
  Activity,
  Leaf,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from 'recharts';

interface Agent {
  slug: string;
  name: string;
  role: string;
  description: string;
  icon: string;
  color: string;
  route: string;
  active: boolean;
  activatedAt: string | null;
  includedInPlan: boolean;
  requiredPlanLabel: string | null;
}

interface AgentUsageRow {
  agentSlug: string;
  usage: number;
  limit: number;
  monthKey: string;
}

interface GmailProcessedItem {
  id: string;
  subject: string | null;
  fromEmail: string | null;
  summary: string | null;
  status: 'PROCESSED' | 'SKIPPED' | 'ERROR';
  createdAt: string;
}

interface ProspectingDashboard {
  prospectsFound: number;
  hotLeads: number;
  prospectsContacted: number;
  inPipeline: number;
  opportunitiesFromAi: number;
}

interface ScoutStats {
  total: number;
  newCount: number;
  savedCount: number;
  lastScanAt: string | null;
}

interface BrandPulseDashboard {
  globalScore: number | null;
  pipeline: {
    proposed: number;
    pendingReview: number;
    published: number;
  };
}

const ICON_MAP: Record<string, LucideIcon> = {
  Radio,
  Bot,
  Radar,
  FileSignature,
  ShieldCheck,
  Megaphone,
  Mail,
};

const AGENT_COLORS: Record<string, string> = {
  'hunt-ai': '#0ea5e9',
  'copilot-ia': '#2563eb',
  'scout-ai': '#0284c7',
  'offre-bot': '#f59e0b',
  'gmail-ai': '#ef4444',
  'factcheck-ai': '#10b981',
  'brand-pulse-ai': '#64748b',
};

const AGENT_LABELS: Record<string, string> = {
  'hunt-ai': 'Hunt AI',
  'copilot-ia': 'Copilot',
  'scout-ai': 'Scout AI',
  'offre-bot': 'OffreBot',
  'gmail-ai': 'Gmail IA',
  'factcheck-ai': 'FactCheck',
  'brand-pulse-ai': 'BrandPulse',
};

function MetricTile({
  title,
  value,
  hint,
  icon,
  iconWrap,
}: {
  title: string;
  value: string;
  hint?: string;
  icon: React.ReactNode;
  iconWrap: string;
}) {
  return (
    <div className="rounded-2xl border border-black/[0.04] bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-foreground">{value}</p>
          {hint && <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>}
        </div>
        <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', iconWrap)}>
          {icon}
        </div>
      </div>
    </div>
  );
}

export function Dashboard() {
  const { t } = useTranslation();
  const user = useAuth((s) => s.user);
  const firstName = (user?.name || '').split(' ')[0] || 'là';

  const { data: agentsPayload, isPending: agentsPending } = useQuery<{
    agents: Agent[];
    plan: string;
    planLabel: string;
  }>({
    queryKey: ['agents-marketplace'],
    queryFn: () => api.get('/agents').then((r) => r.data),
  });

  const { data: usageData } = useQuery<{ usage: AgentUsageRow[] }>({
    queryKey: ['agents-usage'],
    queryFn: () => api.get('/agents/usage').then((r) => r.data),
  });

  const { data: gmailProcessed } = useQuery<{ items: GmailProcessedItem[] }>({
    queryKey: ['gmail-ai-processed-dash'],
    queryFn: () => api.get('/gmail-ai/processed?limit=40').then((r) => r.data),
    retry: false,
  });

  const { data: prospectingDash } = useQuery<ProspectingDashboard>({
    queryKey: ['prospecting-dashboard'],
    queryFn: () => api.get('/prospecting/dashboard').then((r) => r.data),
    retry: false,
  });

  const { data: scoutStats } = useQuery<ScoutStats>({
    queryKey: ['scout-ai-stats-dashboard'],
    queryFn: () => api.get('/scout-ai/stats').then((r) => r.data),
    retry: false,
  });

  const { data: brandPulse } = useQuery<BrandPulseDashboard>({
    queryKey: ['brand-pulse-dashboard-summary'],
    queryFn: () => api.get('/brand-pulse/dashboard').then((r) => r.data),
    retry: false,
  });

  const agents = agentsPayload?.agents || [];
  const includedAgents = agents.filter((a) => a.includedInPlan);
  const activeAgents = includedAgents.filter((a) => a.active);
  const usageRows = usageData?.usage || [];
  const usageBySlug = useMemo(
    () => new Map(usageRows.map((r) => [r.agentSlug, r])),
    [usageRows]
  );

  const draftsToValidate = (gmailProcessed?.items || []).filter((i) => i.status === 'PROCESSED');
  const prospects = prospectingDash?.prospectsFound ?? 0;
  const scoutOpportunities = scoutStats?.total ?? 0;
  const publishedArticles = brandPulse?.pipeline.published ?? 0;
  const pendingArticles = brandPulse?.pipeline.pendingReview ?? 0;

  const resultBySlug: Record<string, number> = {
    'hunt-ai': prospects,
    'copilot-ia': usageBySlug.get('copilot-ia')?.usage ?? 0,
    'scout-ai': scoutOpportunities,
    'offre-bot': usageBySlug.get('offre-bot')?.usage ?? 0,
    'gmail-ai': draftsToValidate.length,
    'factcheck-ai': usageBySlug.get('factcheck-ai')?.usage ?? 0,
    'brand-pulse-ai': publishedArticles + pendingArticles,
  };

  const totalActions = usageRows.reduce((s, r) => s + r.usage, 0);
  const totalLimit = usageRows.reduce((s, r) => s + (r.limit > 0 ? r.limit : 0), 0);
  const totalResults = Object.values(resultBySlug).reduce((sum, value) => sum + value, 0);
  const quotaPct = totalLimit > 0 ? Math.min(100, Math.round((totalActions / totalLimit) * 100)) : 0;

  const distributionData = useMemo(() => {
    return includedAgents
      .map((a) => {
        const actions = usageBySlug.get(a.slug)?.usage ?? 0;
        const results = resultBySlug[a.slug] ?? 0;
        const value = Math.max(actions, results);
        return {
          slug: a.slug,
          name: AGENT_LABELS[a.slug] || a.name,
          value,
          color: AGENT_COLORS[a.slug] || '#2563eb',
          icon: a.icon,
          route: a.route,
        };
      })
      .filter((d) => d.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [includedAgents, usageBySlug, prospects, scoutOpportunities, draftsToValidate.length, publishedArticles, pendingArticles]);

  const distributionTotal = distributionData.reduce((s, d) => s + d.value, 0);

  const topGisements = useMemo(() => {
    const rows = includedAgents.map((a) => {
      const actions = usageBySlug.get(a.slug)?.usage ?? 0;
      const results = resultBySlug[a.slug] ?? 0;
      return {
        slug: a.slug,
        name: AGENT_LABELS[a.slug] || a.name,
        score: actions + results * 2,
        actions,
        results,
        color: AGENT_COLORS[a.slug] || '#2563eb',
        Icon: ICON_MAP[a.icon] || Bot,
        route: a.route,
      };
    });
    return rows.sort((a, b) => b.score - a.score).slice(0, 5);
  }, [includedAgents, usageBySlug, prospects, scoutOpportunities, draftsToValidate.length, publishedArticles, pendingArticles]);

  const maxTopScore = Math.max(1, ...topGisements.map((r) => r.score));

  const cumulativeData = useMemo(() => {
    let running = 0;
    const points = [{ label: 'Départ', name: 'Départ', value: 0, fill: '#94a3b8' }];
    topGisements.forEach((row, idx) => {
      running += row.score;
      points.push({
        label: `#${idx + 1}`,
        name: row.name,
        value: running,
        fill: row.color,
      });
    });
    return points;
  }, [topGisements]);

  const demoDistribution =
    distributionData.length > 0
      ? distributionData
      : includedAgents.slice(0, 5).map((a, i) => ({
          slug: a.slug,
          name: AGENT_LABELS[a.slug] || a.name,
          value: [37, 28, 19, 10, 6][i] || 5,
          color: AGENT_COLORS[a.slug] || '#2563eb',
          icon: a.icon,
          route: a.route,
        }));

  const demoTotal = demoDistribution.reduce((s, d) => s + d.value, 0);
  const hasRealActivity = totalActions > 0 || totalResults > 0;

  if (agentsPending) {
    return (
      <div className="flex h-[50vh] items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="animate-spin" size={18} />
        {t('common.loading')}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Focus agents — activité du mois
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Bonjour {firstName}. Vue opérationnelle sans CA — actions, résultats et priorités.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3.5 py-1.5 text-sm font-semibold text-emerald-700">
            <Sparkles size={14} />
            {hasRealActivity ? `${totalResults} résultats` : `${activeAgents.length} agents actifs`}
          </span>
          <Link to="/agents">
            <Button className="gap-2 shadow-sm">
              Centre agents <ArrowRight size={16} />
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <MetricTile
          title="Actions exécutées"
          value={String(totalActions)}
          hint="Tous agents · ce mois"
          icon={<Activity size={20} className="text-sky-600" />}
          iconWrap="bg-sky-50"
        />
        <MetricTile
          title="Résultats produits"
          value={String(totalResults)}
          hint="Prospects, brouillons, contenus…"
          icon={<Leaf size={20} className="text-emerald-600" />}
          iconWrap="bg-emerald-50"
        />
        <MetricTile
          title="Potentiel restant"
          value={String(Math.max(0, totalLimit - totalActions))}
          hint={totalLimit > 0 ? `sur ${totalLimit} actions plan` : 'Quotas selon votre plan'}
          icon={<Target size={20} className="text-amber-600" />}
          iconWrap="bg-amber-50"
        />
      </div>

      {/* Progress */}
      <div className="rounded-2xl border border-black/[0.04] bg-white px-5 py-4 shadow-sm">
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="text-sm font-medium text-foreground">Progression sur le quota mensuel</p>
          <span className="text-sm font-semibold text-emerald-700">{quotaPct}%</span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-sky-500 transition-all duration-700"
            style={{ width: `${quotaPct}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {totalActions} / {totalLimit || '—'} actions consommées · Plan {agentsPayload?.planLabel || '—'}
        </p>
      </div>

      {/* Middle: donut + top 5 */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card className="border-0 shadow-sm ring-1 ring-black/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Répartition de l’activité par agent</CardTitle>
            <p className="text-xs text-muted-foreground">
              {hasRealActivity ? 'Actions + résultats réels' : 'Répartition illustrative (aucune activité encore)'}
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 items-center gap-4 sm:grid-cols-[1fr_1.1fr]">
              <div className="relative mx-auto h-[220px] w-full max-w-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={demoDistribution}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={62}
                      outerRadius={88}
                      paddingAngle={2}
                      stroke="#fff"
                      strokeWidth={2}
                    >
                      {demoDistribution.map((entry) => (
                        <Cell key={entry.slug} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number, name: string) => [
                        hasRealActivity ? value : `${value}%`,
                        name,
                      ]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <p className="text-2xl font-bold tracking-tight text-foreground">
                    {hasRealActivity ? distributionTotal : demoTotal}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {hasRealActivity ? 'points activité' : '% illustratif'}
                  </p>
                </div>
              </div>
              <ul className="space-y-2.5">
                {demoDistribution.map((d) => {
                  const pct = Math.round((d.value / (hasRealActivity ? distributionTotal || 1 : demoTotal)) * 1000) / 10;
                  return (
                    <li key={d.slug} className="flex items-center gap-2.5 text-sm">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: d.color }} />
                      <span className="min-w-0 flex-1 truncate text-foreground">{d.name}</span>
                      <span className="tabular-nums text-muted-foreground">{pct}%</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm ring-1 ring-black/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Top 5 des leviers agents</CardTitle>
            <p className="text-xs text-muted-foreground">Classés par actions + résultats (sans CA)</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {topGisements.map((row, idx) => {
              const Icon = row.Icon;
              const width = Math.max(8, Math.round((row.score / maxTopScore) * 100));
              return (
                <Link
                  key={row.slug}
                  to={row.route}
                  className="group flex items-center gap-3 rounded-xl px-1 py-1.5 transition hover:bg-slate-50"
                >
                  <span className="w-5 text-sm font-semibold tabular-nums text-slate-400">#{idx + 1}</span>
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                    style={{ background: `${row.color}18`, color: row.color }}
                  >
                    <Icon size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-medium text-foreground group-hover:text-primary">
                        {row.name}
                      </p>
                      <p className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
                        {row.score}
                        <span className="ml-1 text-xs font-normal text-muted-foreground">pts</span>
                      </p>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${width}%`, background: row.color }}
                      />
                    </div>
                  </div>
                </Link>
              );
            })}
            {topGisements.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Aucun agent inclus dans votre plan pour le moment.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bottom: cumulative + impact */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card className="border-0 shadow-sm ring-1 ring-black/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Potentiel d’activité cumulé</CardTitle>
            <p className="text-xs text-muted-foreground">Contribution successive des top leviers</p>
          </CardHeader>
          <CardContent>
            <div className="h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={cumulativeData} margin={{ top: 12, right: 12, left: 0, bottom: 28 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="label"
                    stroke="#94a3b8"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} width={36} />
                  <Tooltip
                    formatter={(value: number) => [`${value} pts`, 'Cumul']}
                    labelFormatter={(_, payload) => payload?.[0]?.payload?.name || ''}
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="#10b981"
                    strokeWidth={3}
                    dot={{ r: 5, fill: '#10b981', stroke: '#fff', strokeWidth: 2 }}
                    activeDot={{ r: 7 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-1 flex flex-wrap gap-2">
              {cumulativeData.slice(1).map((p, i) => (
                <span
                  key={p.label}
                  className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-2 py-1 text-[11px] text-muted-foreground"
                >
                  <span className="font-semibold text-foreground">{p.label}</span>
                  {topGisements[i]?.name}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm ring-1 ring-black/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Impact global estimé</CardTitle>
            <p className="text-xs text-muted-foreground">Synthèse opérationnelle du mois</p>
          </CardHeader>
          <CardContent className="space-y-5 pt-2">
            <div className="rounded-2xl bg-gradient-to-br from-emerald-50 to-sky-50 p-5">
              <p className="text-sm text-muted-foreground">Score d’activité</p>
              <p className="mt-1 text-4xl font-bold tracking-tight text-emerald-700">
                {totalActions + totalResults}
                <span className="ml-2 text-base font-medium text-emerald-600/80">pts</span>
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border bg-white p-4">
                <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-sky-50 text-sky-600">
                  <Zap size={16} />
                </div>
                <p className="text-2xl font-bold tabular-nums">{totalActions}</p>
                <p className="text-xs text-muted-foreground">Actions</p>
              </div>
              <div className="rounded-xl border bg-white p-4">
                <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                  <CheckCircle2 size={16} />
                </div>
                <p className="text-2xl font-bold tabular-nums">{totalResults}</p>
                <p className="text-xs text-muted-foreground">Résultats</p>
              </div>
              <div className="rounded-xl border bg-white p-4">
                <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-red-50 text-red-600">
                  <Mail size={16} />
                </div>
                <p className="text-2xl font-bold tabular-nums">{draftsToValidate.length}</p>
                <p className="text-xs text-muted-foreground">Brouillons Gmail</p>
              </div>
              <div className="rounded-xl border bg-white p-4">
                <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                  <Bot size={16} />
                </div>
                <p className="text-2xl font-bold tabular-nums">{activeAgents.length}</p>
                <p className="text-xs text-muted-foreground">Agents actifs</p>
              </div>
            </div>
            <Link to="/agents/gmail-ai" className="block">
              <Button variant="outline" className="w-full gap-2">
                <Mail size={16} />
                Ouvrir Gmail IA
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Compact bar chart for actions vs results */}
      {hasRealActivity && (
        <Card className="border-0 shadow-sm ring-1 ring-black/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Actions vs résultats par agent</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={includedAgents.map((a) => ({
                    name: AGENT_LABELS[a.slug] || a.name,
                    actions: usageBySlug.get(a.slug)?.usage ?? 0,
                    results: resultBySlug[a.slug] ?? 0,
                  }))}
                  margin={{ top: 8, right: 8, left: 0, bottom: 40 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} interval={0} angle={-18} textAnchor="end" height={50} />
                  <YAxis stroke="#94a3b8" fontSize={11} width={32} />
                  <Tooltip />
                  <Bar dataKey="actions" name="Actions" fill="#2563eb" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="results" name="Résultats" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default Dashboard;
