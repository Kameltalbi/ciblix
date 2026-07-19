import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  TrendingUp,
  TrendingDown,
  Bot,
  Radio,
  Radar,
  FileSignature,
  ShieldCheck,
  Megaphone,
  Mail,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Clock,
  Loader2,
  HelpCircle,
  Settings,
  Users,
  Zap,
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
  Legend,
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

const COLOR_MAP: Record<string, { bg: string; text: string; bar: string; soft: string }> = {
  sky: { bg: 'bg-sky-50', text: 'text-sky-700', bar: '#0ea5e9', soft: 'bg-sky-100' },
  violet: { bg: 'bg-violet-50', text: 'text-violet-700', bar: '#8b5cf6', soft: 'bg-violet-100' },
  blue: { bg: 'bg-blue-50', text: 'text-blue-700', bar: '#2563eb', soft: 'bg-blue-100' },
  amber: { bg: 'bg-amber-50', text: 'text-amber-700', bar: '#f59e0b', soft: 'bg-amber-100' },
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-700', bar: '#10b981', soft: 'bg-emerald-100' },
  rose: { bg: 'bg-rose-50', text: 'text-rose-700', bar: '#f43f5e', soft: 'bg-rose-100' },
  red: { bg: 'bg-red-50', text: 'text-red-700', bar: '#ef4444', soft: 'bg-red-100' },
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

function relativeTime(iso: string | null | undefined, locale: string): string {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return locale.startsWith('fr') ? "à l'instant" : 'just now';
  if (mins < 60) return locale.startsWith('fr') ? `il y a ${mins} min` : `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return locale.startsWith('fr') ? `il y a ${hours} h` : `${hours} h ago`;
  const days = Math.floor(hours / 24);
  return locale.startsWith('fr') ? `il y a ${days} j` : `${days} d ago`;
}

function CounterCard({
  title,
  value,
  trend,
  trendUp,
  icon,
  iconClass,
}: {
  title: string;
  value: string;
  trend?: string;
  trendUp?: boolean;
  icon: React.ReactNode;
  iconClass: string;
}) {
  return (
    <Card className="border-0 shadow-sm ring-1 ring-black/5 transition-shadow hover:shadow-md">
      <CardContent className="flex items-start gap-4 p-5">
        <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', iconClass)}>
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-muted-foreground">{title}</p>
          <p className="mt-1 truncate text-2xl font-bold tracking-tight text-foreground">{value}</p>
          {trend && (
            <p
              className={cn(
                'mt-1.5 flex items-center gap-1 text-xs font-medium',
                trendUp === undefined
                  ? 'text-muted-foreground'
                  : trendUp
                    ? 'text-emerald-600'
                    : 'text-rose-600'
              )}
            >
              {trendUp === true && <TrendingUp size={12} />}
              {trendUp === false && <TrendingDown size={12} />}
              {trend}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function Dashboard() {
  const { t, i18n } = useTranslation();
  const user = useAuth((s) => s.user);
  const firstName = (user?.name || '').split(' ')[0] || 'là';
  const locale = i18n.language || 'fr';

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
  const activeAgents = agents.filter((a) => a.active && a.includedInPlan);
  const usageRows = usageData?.usage || [];
  const usageBySlug = useMemo(
    () => new Map(usageRows.map((r) => [r.agentSlug, r])),
    [usageRows]
  );

  const totalUsage = usageRows.reduce((s, r) => s + r.usage, 0);
  const gmailItems = gmailProcessed?.items || [];
  const draftsToValidate = gmailItems.filter((i) => i.status === 'PROCESSED');
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
  const totalResults = Object.values(resultBySlug).reduce((sum, value) => sum + value, 0);

  const performanceData = useMemo(
    () =>
      agents
        .filter((a) => a.includedInPlan)
        .map((a) => {
          const usage = usageBySlug.get(a.slug);
          return {
            name: AGENT_LABELS[a.slug] || a.name,
            actions: usage?.usage ?? 0,
            results: resultBySlug[a.slug] ?? 0,
          };
        }),
    [agents, usageBySlug, prospects, scoutOpportunities, draftsToValidate.length, publishedArticles, pendingArticles]
  );

  const recentActivity = useMemo(() => {
    const items: Array<{ id: string; title: string; meta: string; at: string; icon: LucideIcon; color: string }> = [];

    for (const item of draftsToValidate.slice(0, 5)) {
      items.push({
        id: `gmail-${item.id}`,
        title: 'Gmail IA a préparé un brouillon',
        meta: item.subject || item.fromEmail || 'Réponse à valider',
        at: item.createdAt,
        icon: Mail,
        color: 'text-red-600',
      });
    }

    for (const agent of activeAgents.slice(0, 4)) {
      const usage = usageBySlug.get(agent.slug);
      if (!usage || usage.usage === 0) continue;
      items.push({
        id: `usage-${agent.slug}`,
        title: `${agent.name} — ${usage.usage} action${usage.usage > 1 ? 's' : ''} ce mois`,
        meta: `${resultBySlug[agent.slug] ?? 0} résultat${(resultBySlug[agent.slug] ?? 0) > 1 ? 's' : ''} produit${(resultBySlug[agent.slug] ?? 0) > 1 ? 's' : ''}`,
        at: agent.activatedAt || new Date().toISOString(),
        icon: ICON_MAP[agent.icon] || Bot,
        color: (COLOR_MAP[agent.color] || COLOR_MAP.blue).text,
      });
    }

    if (prospects > 0) {
      items.push({
        id: 'hunt-prospects',
        title: 'Hunt AI a détecté des prospects',
        meta: `${prospects} prospect${prospects > 1 ? 's' : ''} IA`,
        at: new Date().toISOString(),
        icon: Radio,
        color: 'text-sky-600',
      });
    }

    if (scoutOpportunities > 0) {
      items.push({
        id: 'scout-results',
        title: 'Scout AI a détecté des opportunités',
        meta: `${scoutOpportunities} résultat${scoutOpportunities > 1 ? 's' : ''}`,
        at: scoutStats?.lastScanAt || new Date().toISOString(),
        icon: Radar,
        color: 'text-blue-600',
      });
    }

    return items.slice(0, 8);
  }, [draftsToValidate, activeAgents, usageBySlug, prospects, scoutOpportunities, scoutStats?.lastScanAt]);

  const shortcuts = [
    { to: '/agents', label: 'Centre Agents', icon: Sparkles },
    { to: '/agents/gmail-ai', label: 'Gmail IA', icon: Mail },
    { to: '/prospection-ia', label: 'Hunt AI', icon: Radio },
    { to: '/ai-assistant', label: 'Copilot', icon: Bot },
    { to: '/agents/offre-bot', label: 'OffreBot', icon: FileSignature },
    { to: '/support', label: "Centre d'aide", icon: HelpCircle },
  ];

  if (agentsPending) {
    return (
      <div className="flex h-[50vh] items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="animate-spin" size={18} />
        {t('common.loading')}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {t('dashboard.hello', { name: firstName })} 👋
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('dashboard.agentsOverviewSubtitle', {
              defaultValue: "Voici l'état de vos agents IA aujourd'hui",
            })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
            Plan {agentsPayload?.planLabel || '—'}
          </span>
          <Link to="/agents">
            <Button className="gap-2 shadow-sm">
              <Sparkles size={16} />
              {t('dashboard.openAgents', { defaultValue: 'Mes agents IA' })}
            </Button>
          </Link>
        </div>
      </div>

      {/* Counters */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <CounterCard
          title="Actions exécutées"
          value={String(totalUsage)}
          trend="Tous agents · ce mois"
          trendUp
          icon={<Zap size={20} className="text-violet-600" />}
          iconClass="bg-violet-50"
        />
        <CounterCard
          title="Résultats produits"
          value={String(totalResults)}
          trend="Prospects, analyses, offres et contenus"
          trendUp
          icon={<Sparkles size={20} className="text-blue-600" />}
          iconClass="bg-blue-50"
        />
        <CounterCard
          title="Prospects détectés"
          value={String(prospects)}
          trend={`${prospectingDash?.hotLeads ?? 0} à fort potentiel`}
          trendUp
          icon={<Users size={20} className="text-sky-600" />}
          iconClass="bg-sky-50"
        />
        <CounterCard
          title="Opportunités détectées"
          value={String(scoutOpportunities)}
          trend={`${scoutStats?.newCount ?? 0} nouvelles · Scout AI`}
          trendUp
          icon={<Radar size={20} className="text-emerald-600" />}
          iconClass="bg-emerald-50"
        />
        <CounterCard
          title="Brouillons à valider"
          value={String(draftsToValidate.length)}
          trend="Gmail IA · validation humaine"
          trendUp={draftsToValidate.length > 0}
          icon={<Mail size={20} className="text-red-600" />}
          iconClass="bg-red-50"
        />
      </div>

      {/* Agents overview + drafts */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        <Card className="border-0 shadow-sm ring-1 ring-black/5 xl:col-span-3">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base font-semibold">Vue d’ensemble des agents</CardTitle>
            <Link to="/agents" className="text-xs font-medium text-blue-600 hover:underline">
              Tout voir
            </Link>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="pb-2 font-medium">Agent</th>
                  <th className="pb-2 font-medium">Statut</th>
                  <th className="pb-2 font-medium">Actions</th>
                  <th className="pb-2 font-medium">Résultats</th>
                  <th className="pb-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {agents.map((agent) => {
                  const Icon = ICON_MAP[agent.icon] || Bot;
                  const colors = COLOR_MAP[agent.color] || COLOR_MAP.blue;
                  const usage = usageBySlug.get(agent.slug);
                  const locked = !agent.includedInPlan;
                  return (
                    <tr key={agent.slug} className="border-b border-border/60 last:border-0">
                      <td className="py-3">
                        <div className="flex items-center gap-3">
                          <div className={cn('flex h-9 w-9 items-center justify-center rounded-xl', colors.soft, colors.text)}>
                            <Icon size={16} />
                          </div>
                          <div>
                            <p className="font-medium text-foreground">{agent.name}</p>
                            <p className="text-xs text-muted-foreground">{agent.role}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3">
                        {locked ? (
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold uppercase text-gray-600">
                            Plan {agent.requiredPlanLabel}
                          </span>
                        ) : agent.active ? (
                          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-700">
                            Actif
                          </span>
                        ) : (
                          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-700">
                            Inactif
                          </span>
                        )}
                      </td>
                      <td className="py-3 text-muted-foreground">
                        {usage?.usage ?? 0}
                      </td>
                      <td className="py-3 text-muted-foreground">
                        <span className="font-semibold text-foreground">
                          {resultBySlug[agent.slug] ?? 0}
                        </span>
                        <span className="ms-1 text-xs">
                          {agent.slug === 'hunt-ai'
                            ? 'prospects'
                            : agent.slug === 'scout-ai'
                              ? 'opportunités'
                              : agent.slug === 'gmail-ai'
                                ? 'brouillons'
                                : agent.slug === 'brand-pulse-ai'
                                  ? 'contenus'
                                  : agent.slug === 'offre-bot'
                                    ? 'offres'
                                    : agent.slug === 'factcheck-ai'
                                      ? 'vérifications'
                                      : 'réponses'}
                        </span>
                      </td>
                      <td className="py-3 text-right">
                        {!locked && (
                          <Link to={agent.route}>
                            <Button variant="ghost" size="sm" className="gap-1 text-blue-600">
                              Ouvrir <ArrowRight size={14} />
                            </Button>
                          </Link>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm ring-1 ring-black/5 xl:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base font-semibold">Brouillons à valider</CardTitle>
            <Link to="/agents/gmail-ai" className="text-xs font-medium text-blue-600 hover:underline">
              Gmail IA
            </Link>
          </CardHeader>
          <CardContent className="space-y-2">
            {draftsToValidate.length === 0 ? (
              <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                Aucun brouillon en attente. Les réponses Gmail IA apparaîtront ici.
              </div>
            ) : (
              draftsToValidate.slice(0, 6).map((item) => (
                <div
                  key={item.id}
                  className="flex items-start gap-3 rounded-xl border bg-white px-3 py-2.5"
                >
                  <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-red-50 text-red-600">
                    <Mail size={14} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {item.subject || 'Réponse à valider'}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {item.fromEmail || '—'} · Gmail IA
                    </p>
                    {item.summary && (
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{item.summary}</p>
                    )}
                  </div>
                  <span className="shrink-0 text-[10px] text-muted-foreground">
                    {relativeTime(item.createdAt, locale)}
                  </span>
                </div>
              ))
            )}
            <p className="pt-1 text-[11px] text-muted-foreground">
              Validation = envoi manuel dans Gmail (libellé « Réponse à valider »).
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Activity + performance + shortcuts */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="border-0 shadow-sm ring-1 ring-black/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Activité récente</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentActivity.length === 0 ? (
              <p className="text-sm text-muted-foreground">Pas encore d’activité agents.</p>
            ) : (
              recentActivity.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.id} className="flex items-start gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted/60">
                      <Icon size={14} className={item.color} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground">{item.title}</p>
                      <p className="truncate text-xs text-muted-foreground">{item.meta}</p>
                    </div>
                    <span className="shrink-0 text-[10px] text-muted-foreground">
                      {relativeTime(item.at, locale)}
                    </span>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm ring-1 ring-black/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Performance des agents</CardTitle>
            <p className="text-xs text-muted-foreground">Actions exécutées et résultats réellement produits</p>
          </CardHeader>
          <CardContent>
            {performanceData.every((d) => d.actions === 0 && d.results === 0) ? (
              <div className="flex h-[220px] flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
                <Clock size={18} />
                Aucune action ni résultat pour le moment
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={performanceData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="name" stroke="#6b7280" fontSize={10} interval={0} angle={-20} textAnchor="end" height={60} />
                  <YAxis stroke="#6b7280" fontSize={11} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="actions" name="Actions exécutées" fill="#2563eb" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="results" name="Résultats produits" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm ring-1 ring-black/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Raccourcis</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2">
              {shortcuts.map((s) => {
                const Icon = s.icon;
                return (
                  <Link
                    key={s.to}
                    to={s.to}
                    className="flex flex-col items-start gap-2 rounded-xl border bg-white p-3 transition hover:border-blue-200 hover:bg-blue-50/40"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                      <Icon size={15} />
                    </div>
                    <span className="text-xs font-semibold text-foreground">{s.label}</span>
                  </Link>
                );
              })}
              <Link
                to="/settings"
                className="flex flex-col items-start gap-2 rounded-xl border bg-white p-3 transition hover:border-blue-200 hover:bg-blue-50/40"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                  <Settings size={15} />
                </div>
                <span className="text-xs font-semibold text-foreground">Paramètres</span>
              </Link>
              <Link
                to="/agents/scout-ai"
                className="flex flex-col items-start gap-2 rounded-xl border bg-white p-3 transition hover:border-blue-200 hover:bg-blue-50/40"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                  <Radar size={15} />
                </div>
                <span className="text-xs font-semibold text-foreground">Scout AI</span>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default Dashboard;
