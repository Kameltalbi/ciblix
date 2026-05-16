import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { TrendingUp, Plus, DollarSign, Target, Wallet, Sparkles, Flame, AlertTriangle, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import { fmtDT, MOIS_S, cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/form-controls';
import type { KPIs } from '@/types';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

type DashboardHubTab = 'assistants' | 'history' | 'pilotage';

function KpiCard({
  title,
  subtitle,
  value,
  icon,
  color,
  ttcValue,
}: {
  title: string;
  subtitle: string;
  value: string;
  icon: React.ReactNode;
  color: string;
  ttcValue?: string;
}) {
  const colorClasses: Record<string, { bg: string; text: string; border: string; iconBg: string }> = {
    emerald: { bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200', iconBg: 'bg-sky-100' },
    blue: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', iconBg: 'bg-blue-100' },
    violet: { bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200', iconBg: 'bg-violet-100' },
    amber: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', iconBg: 'bg-amber-100' },
  };
  const colors = colorClasses[color] || colorClasses.emerald;
  return (
    <Card className={`border ${colors.border} hover:shadow-lg transition-all duration-200 hover:-translate-y-1`}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className={`p-3 rounded-xl ${colors.iconBg} ${colors.text}`}>{icon}</div>
        </div>
        <div className="mt-4">
          <p className="text-3xl font-bold text-gray-900">{value}</p>
          {ttcValue && <p className="text-xs text-muted-foreground mt-1">{ttcValue} TTC</p>}
          <p className="text-sm font-semibold text-gray-700 mt-1">{title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function DashboardAssistantsHub() {
  const { t } = useTranslation();

  const cards = [
    {
      id: 'hunt',
      initial: 'H',
      accent: 'bg-sky-100 text-sky-900',
      name: t('nav.agentHunt'),
      role: t('dashboard.hubHuntRole'),
      desc: t('dashboard.hubHuntDesc'),
      to: '/prospection-ia',
      comingSoon: false,
      ctaChat: false,
    },
    {
      id: 'copilot',
      initial: 'C',
      accent: 'bg-violet-100 text-violet-900',
      name: t('nav.agentAssistant'),
      role: t('dashboard.hubCopilotRole'),
      desc: t('dashboard.hubCopilotDesc'),
      to: '/ai-assistant',
      comingSoon: false,
      ctaChat: true,
    },
    {
      id: 'comm',
      initial: 'M',
      accent: 'bg-amber-100 text-amber-900',
      name: t('agentsComingSoon.commBot.name'),
      role: t('agentsComingSoon.commBot.role'),
      desc: t('agentsComingSoon.commBot.description'),
      to: '/agents/comm-bot',
      comingSoon: true,
      ctaChat: false,
    },
    {
      id: 'care',
      initial: 'S',
      accent: 'bg-emerald-100 text-emerald-900',
      name: t('agentsComingSoon.careBot.name'),
      role: t('agentsComingSoon.careBot.role'),
      desc: t('agentsComingSoon.careBot.description'),
      to: '/agents/care-bot',
      comingSoon: true,
      ctaChat: false,
    },
    {
      id: 'cfo',
      initial: 'F',
      accent: 'bg-indigo-100 text-indigo-900',
      name: t('agentsComingSoon.cfoAi.name'),
      role: t('agentsComingSoon.cfoAi.role'),
      desc: t('agentsComingSoon.cfoAi.description'),
      to: '/agents/cfo-ai',
      comingSoon: true,
      ctaChat: false,
    },
  ];

  return (
    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
      {cards.map((card) => (
        <Card
          key={card.id}
          className="flex flex-col overflow-hidden rounded-2xl border border-neutral-200/90 bg-white shadow-sm"
        >
          <CardContent className="flex flex-1 flex-col p-0">
            <div className="flex gap-3 p-5 pb-3">
              <div
                className={cn(
                  'flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold',
                  card.accent,
                )}
              >
                {card.initial}
              </div>
              <div className="min-w-0">
                <p className="truncate font-semibold text-foreground">{card.name}</p>
                <p className="truncate text-sm text-muted-foreground">{card.role}</p>
              </div>
            </div>
            <p className="flex-1 px-5 pb-4 text-sm leading-relaxed text-muted-foreground">{card.desc}</p>
            <Link
              to={card.to}
              className={cn(
                'mt-auto flex w-full items-center justify-center rounded-b-2xl border-t border-neutral-100 bg-neutral-50 px-5 py-3.5 text-center text-sm font-medium text-foreground transition-colors hover:bg-neutral-100',
              )}
            >
              {card.comingSoon
                ? t('nav.comingSoon')
                : card.ctaChat
                  ? t('dashboard.hubChatWith', { name: card.name })
                  : t('dashboard.hubOpen', { name: card.name })}
            </Link>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function DashboardHistoryHub() {
  const { t } = useTranslation();

  return (
    <Card className="max-w-lg rounded-2xl border border-neutral-200/90 bg-white shadow-sm">
      <CardContent className="space-y-4 p-8">
        <p className="text-muted-foreground">{t('dashboard.hubHistoryLead')}</p>
        <Link to="/ai-assistant" className="block">
          <Button className="w-full rounded-xl">{t('dashboard.hubHistoryCta')}</Button>
        </Link>
      </CardContent>
    </Card>
  );
}

function PilotageDashboardBody({
  kpis,
  selectedYear,
  setSelectedYear,
  revenueCategories,
  expenses,
  briefing,
}: {
  kpis: KPIs;
  selectedYear: string;
  setSelectedYear: (y: string) => void;
  revenueCategories: any[];
  expenses: any[];
  briefing: { summary?: Record<string, number | undefined>; generatedAt?: string } | undefined;
}) {
  const { t } = useTranslation();

  const totalExpenses = expenses.reduce((sum: number, e: any) => sum + Number(e.amount), 0);
  const caTotalTTC = Number(kpis.caTotalAll) * 1.19;
  const tauxCouverture = totalExpenses > 0 ? Math.round((caTotalTTC / totalExpenses) * 100) : null;

  const monthlyData = useMemo(() => {
    return Object.entries(kpis.parMois).map(([month, data]) => ({
      month: MOIS_S[parseInt(month)],
      gagne: Number(data.realise),
      enCours: Number(data.pipeline),
      prospect: Number(data.prospect),
      total: Number(data.realise) + Number(data.pipeline) + Number(data.prospect),
    }));
  }, [kpis]);

  const statusDistributionData = useMemo(() => {
    return [
      { name: t('dashboard.caStatusWon'), value: kpis.caRealise, color: '#22c55e' },
      { name: t('dashboard.caStatusActive'), value: kpis.caPipeline, color: '#0ea5e9' },
      { name: t('dashboard.caStatusNew'), value: kpis.caProspection, color: '#f59e0b' },
    ];
  }, [kpis, t]);

  const affairesTotal =
    kpis.counts.gagne + kpis.counts.enCours + kpis.counts.prospect + kpis.counts.perdu;

  const opportunitiesByMonth: { month: string; count: number }[] = [];
  for (let m = 1; m <= 12; m++) {
    const monthData = kpis.parMois[m] || { realise: 0, pipeline: 0, prospect: 0 };
    const totalCount = Number(monthData.realise) + Number(monthData.pipeline) + Number(monthData.prospect);
    opportunitiesByMonth.push({
      month: MOIS_S[m],
      count: totalCount,
    });
  }

  const revenueByCategory: any[] = [];
  const typeMapping: Record<string, string> = {
    BILAN_CARBONE: 'Bilan Carbone',
    FORMATION: 'Formation',
  };

  revenueCategories.forEach((cat: any) => {
    revenueByCategory.push({ name: cat.name, value: 0 });
  });

  Object.entries(kpis.parType || {}).forEach(([type, value]) => {
    const catName = typeMapping[type] || type;
    const existing = revenueByCategory.find((r) => r.name === catName);
    if (existing) {
      existing.value += Number(value);
    } else {
      revenueByCategory.push({ name: catName, value: Number(value) });
    }
  });

  const filteredRevenueByCategory = revenueByCategory.filter((cat) => cat.value > 0);

  const generateUniqueColor = (name: string, isRevenue: boolean): string => {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const h = Math.abs(hash) % 360;
    const s = isRevenue ? '70%' : '80%';
    const l = isRevenue ? '45%' : '50%';
    return `hsl(${h}, ${s}, ${l})`;
  };

  const revenueColors = filteredRevenueByCategory.map((cat: any) => generateUniqueColor(cat.name, true));

  const expensesByCategory: any[] = [];
  expenses.forEach((e: any) => {
    const existing = expensesByCategory.find((ex) => ex.name === e.category);
    if (existing) {
      existing.value += Number(e.amount);
    } else {
      expensesByCategory.push({ name: e.category, value: Number(e.amount) });
    }
  });
  const expenseColors = expensesByCategory.map((cat: any) => generateUniqueColor(cat.name, false));
  const revenueTotal = filteredRevenueByCategory.reduce((sum, cat) => sum + Number(cat.value), 0);
  const expensesTotal = expensesByCategory.reduce((sum, cat) => sum + Number(cat.value), 0);
  const revenueChartData = [...filteredRevenueByCategory]
    .sort((a: any, b: any) => Number(b.value) - Number(a.value))
    .map((cat: any) => ({
      ...cat,
      percentage: revenueTotal > 0 ? (Number(cat.value) / revenueTotal) * 100 : 0,
    }));
  const expensesChartData = [...expensesByCategory]
    .sort((a: any, b: any) => Number(b.value) - Number(a.value))
    .map((cat: any) => ({
      ...cat,
      percentage: expensesTotal > 0 ? (Number(cat.value) / expensesTotal) * 100 : 0,
    }));

  const winRate =
    kpis.counts.gagne + kpis.counts.perdu > 0
      ? Math.round((kpis.counts.gagne / (kpis.counts.gagne + kpis.counts.perdu)) * 100)
      : 0;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">{t('dashboard.overview')}</p>
        <div className="flex w-full gap-2 sm:w-auto">
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="2025">2025</SelectItem>
              <SelectItem value="2026">2026</SelectItem>
              <SelectItem value="2027">2027</SelectItem>
              <SelectItem value="2028">2028</SelectItem>
            </SelectContent>
          </Select>
          <Link to="/affaires" className="w-full sm:w-auto">
            <Button className="w-full shadow-lg sm:w-auto">
              <Plus size={16} className="mr-2" />
              {t('common.add')} {t('affaires.addAffaire')}
            </Button>
          </Link>
        </div>
      </div>

      {briefing && (
        <Card className="overflow-hidden border-violet-200/70 bg-gradient-to-r from-violet-50/80 via-white to-sky-50/50 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Sparkles className="text-violet-600" size={22} />
                {t('dashboard.briefingTitle')}
              </CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">{t('dashboard.briefingSubtitle')}</p>
            </div>
            <Link to="/ai-assistant">
              <Button size="sm" className="shrink-0 gap-1.5">
                {t('dashboard.assistantCta')} <ChevronRight size={16} />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <div className="rounded-xl border bg-white/80 p-3">
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Flame size={12} className="text-orange-500" /> {t('dashboard.briefKpiHot')}
                </p>
                <p className="text-xl font-bold">{briefing.summary?.priorityOpportunities ?? 0}</p>
              </div>
              <div className="rounded-xl border bg-white/80 p-3">
                <p className="text-xs text-muted-foreground">{t('dashboard.briefKpiNoReply')}</p>
                <p className="text-xl font-bold">{briefing.summary?.quotesWithoutReply7d ?? 0}</p>
              </div>
              <div className="rounded-xl border bg-white/80 p-3">
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <AlertTriangle size={12} className="text-rose-500" /> {t('dashboard.briefKpiAtRisk')}
                </p>
                <p className="text-xl font-bold">{briefing.summary?.atRiskCount ?? 0}</p>
              </div>
              <div className="rounded-xl border bg-white/80 p-3">
                <p className="text-xs text-muted-foreground">{t('dashboard.briefKpiWeighted')}</p>
                <p className="text-xl font-bold">{fmtDT(briefing.summary?.monthForecastWeightedHT ?? 0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard
          title={t('dashboard.kpis.totalCA')}
          subtitle={`${affairesTotal} ${t('affaires.title')}`}
          value={fmtDT(kpis.caTotalAll)}
          ttcValue={fmtDT(kpis.caTotalAll * 1.19)}
          icon={<DollarSign className="h-6 w-6" />}
          color="emerald"
        />
        <KpiCard
          title={t('dashboard.kpis.pipelineCA')}
          subtitle={`${kpis.counts.enCours + kpis.counts.prospect} ${t('affaires.title')}`}
          value={fmtDT(kpis.caPipeline + kpis.caProspection)}
          ttcValue={fmtDT((kpis.caPipeline + kpis.caProspection) * 1.19)}
          icon={<Target className="h-6 w-6" />}
          color="blue"
        />
        <KpiCard
          title={t('dashboard.kpis.caWon')}
          subtitle={`${kpis.counts.gagne} ${t('affaires.title')}`}
          value={fmtDT(kpis.caRealise)}
          ttcValue={fmtDT(kpis.caRealise * 1.19)}
          icon={<Wallet className="h-6 w-6" />}
          color="emerald"
        />
        <KpiCard
          title={t('dashboard.kpiCoverageTitle')}
          subtitle={t('dashboard.kpiCoverageSubtitle')}
          value={tauxCouverture !== null ? `${tauxCouverture}%` : '—'}
          icon={<TrendingUp className="h-6 w-6" />}
          color="amber"
        />
        <KpiCard
          title={t('dashboard.kpiWonOppsTitle')}
          subtitle={t('dashboard.kpiWonOppsSubtitle', { count: kpis.counts.gagne })}
          value={`${kpis.counts.gagne}`}
          icon={<Wallet className="h-6 w-6" />}
          color="emerald"
        />
        <KpiCard
          title={t('dashboard.kpiConversionTitle')}
          subtitle={t('dashboard.kpiConversionSubtitle', {
            count: kpis.counts.gagne + kpis.counts.perdu,
          })}
          value={`${winRate}%`}
          icon={<Target className="h-6 w-6" />}
          color="purple"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-semibold">
              {t('dashboard.chartEvolutionTitle', { year: selectedYear })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="month" stroke="#6b7280" fontSize={12} />
                <YAxis stroke="#6b7280" fontSize={12} tickFormatter={(value) => `${value / 1000}k`} />
                <Tooltip
                  formatter={(value: number) => [fmtDT(value), '']}
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '12px',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                  }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="gagne"
                  stroke="#22c55e"
                  strokeWidth={3}
                  name={t('dashboard.serieWon')}
                  dot={{ r: 5 }}
                />
                <Line
                  type="monotone"
                  dataKey="enCours"
                  stroke="#0ea5e9"
                  strokeWidth={3}
                  name={t('dashboard.serieActive')}
                  dot={{ r: 5 }}
                />
                <Line
                  type="monotone"
                  dataKey="prospect"
                  stroke="#f59e0b"
                  strokeWidth={3}
                  name={t('dashboard.serieNew')}
                  dot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-semibold">
              {t('dashboard.chartRepartitionTitle', { count: affairesTotal })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <RechartsPieChart>
                <Pie
                  data={statusDistributionData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {statusDistributionData.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => [fmtDT(value), '']} />
                <Legend />
              </RechartsPieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm md:text-base">
              {t('dashboard.chartByHeatTitle', { count: affairesTotal })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{t('dashboard.caStatusWon')}</span>
                <span className="font-semibold text-sky-600">{fmtDT(kpis.caRealise)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{t('dashboard.caStatusActive')}</span>
                <span className="font-semibold text-blue-600">{fmtDT(kpis.caPipeline)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{t('dashboard.caStatusNew')}</span>
                <span className="font-semibold text-amber-600">{fmtDT(kpis.caProspection)}</span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={statusDistributionData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip formatter={(value: number) => [fmtDT(value), '']} />
                <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                  {statusDistributionData.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm md:text-base">
              {t('dashboard.opportunitiesPerMonth', { year: selectedYear })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={opportunitiesByMonth}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" stroke="#6b7280" fontSize={11} />
                <YAxis stroke="#6b7280" fontSize={11} />
                <Tooltip
                  formatter={(value: number) => [value, t('dashboard.tooltipOpportunityCount')]}
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '12px',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                  }}
                />
                <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-semibold">
              {t('dashboard.revenueByCategory', { amount: fmtDT(kpis.caTotal) })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <RechartsPieChart>
                <Pie
                  data={revenueChartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={68}
                  outerRadius={98}
                  paddingAngle={2}
                  cornerRadius={6}
                  dataKey="value"
                  label={({ percent }: any) => (percent > 0.08 ? `${(percent * 100).toFixed(0)}%` : '')}
                  labelLine={false}
                  fontSize={11}
                  fill="#666"
                  stroke="#fff"
                  strokeWidth={2}
                >
                  {revenueChartData.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={revenueColors[index % revenueColors.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number, _name: any, props: any) => [
                    `${fmtDT(value)} TND`,
                    `${props?.payload?.percentage?.toFixed(1) || '0'}%`,
                  ]}
                  contentStyle={{
                    borderRadius: '10px',
                    border: '1px solid #e5e7eb',
                    boxShadow: '0 6px 16px rgba(0,0,0,0.08)',
                  }}
                />
              </RechartsPieChart>
            </ResponsiveContainer>
            <div className="mt-4 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
              {revenueChartData.slice(0, 6).map((entry: any, index: number) => (
                <div
                  key={`rev-legend-${entry.name}`}
                  className="flex items-center justify-between gap-2 rounded-md border border-border/60 px-2 py-1.5"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm"
                      style={{ backgroundColor: revenueColors[index % revenueColors.length] }}
                    />
                    <span className="truncate text-muted-foreground">{entry.name}</span>
                  </div>
                  <span className="font-medium text-foreground">{entry.percentage.toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-semibold">
              {t('dashboard.expensesByCategory', { amount: fmtDT(totalExpenses) })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <RechartsPieChart>
                <Pie
                  data={expensesChartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={68}
                  outerRadius={98}
                  paddingAngle={2}
                  cornerRadius={6}
                  dataKey="value"
                  label={({ percent }: any) => (percent > 0.08 ? `${(percent * 100).toFixed(0)}%` : '')}
                  labelLine={false}
                  fontSize={11}
                  fill="#666"
                  stroke="#fff"
                  strokeWidth={2}
                >
                  {expensesChartData.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={expenseColors[index % expenseColors.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number, _name: any, props: any) => [
                    `${fmtDT(value)} TND`,
                    `${props?.payload?.percentage?.toFixed(1) || '0'}%`,
                  ]}
                  contentStyle={{
                    borderRadius: '10px',
                    border: '1px solid #e5e7eb',
                    boxShadow: '0 6px 16px rgba(0,0,0,0.08)',
                  }}
                />
              </RechartsPieChart>
            </ResponsiveContainer>
            <div className="mt-4 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
              {expensesChartData.slice(0, 6).map((entry: any, index: number) => (
                <div
                  key={`exp-legend-${entry.name}`}
                  className="flex items-center justify-between gap-2 rounded-md border border-border/60 px-2 py-1.5"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm"
                      style={{ backgroundColor: expenseColors[index % expenseColors.length] }}
                    />
                    <span className="truncate text-muted-foreground">{entry.name}</span>
                  </div>
                  <span className="font-medium text-foreground">{entry.percentage.toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function Dashboard() {
  const { t } = useTranslation();
  const [hubTab, setHubTab] = useState<DashboardHubTab>('assistants');
  const [selectedYear, setSelectedYear] = useState<string>('2026');

  const { data: kpis, isPending: kpisPending } = useQuery<KPIs>({
    queryKey: ['kpis', selectedYear],
    queryFn: () => api.get('/kpis', { params: { annee: selectedYear } }).then((r) => r.data),
  });

  const { data: revenueCategories = [] } = useQuery<any[]>({
    queryKey: ['categories', 'REVENUE'],
    queryFn: () => api.get('/categories', { params: { type: 'REVENUE' } }).then((r) => r.data),
  });

  useQuery<any[]>({
    queryKey: ['categories', 'EXPENSE'],
    queryFn: () => api.get('/categories', { params: { type: 'EXPENSE' } }).then((r) => r.data),
  });

  const { data: expensesData } = useQuery<{ data: any[]; pagination: any }>({
    queryKey: ['expenses', selectedYear],
    queryFn: () => api.get('/expenses', { params: { year: selectedYear, limit: 9999 } }).then((r) => r.data),
  });
  const expenses = expensesData?.data || [];

  const { data: briefing } = useQuery({
    queryKey: ['operational-briefing'],
    queryFn: () => api.get('/ai-assistant/operational-briefing').then((r) => r.data),
    staleTime: 60_000,
  });

  const pilotageReady = !kpisPending && kpis;

  const hubTitle =
    hubTab === 'assistants'
      ? t('dashboard.hubTitle')
      : hubTab === 'history'
        ? t('dashboard.hubTabHistory')
        : t('dashboard.title');

  const hubTabs: { id: DashboardHubTab; label: string }[] = [
    { id: 'assistants', label: t('dashboard.hubTabAssistants') },
    { id: 'history', label: t('dashboard.hubTabHistory') },
    { id: 'pilotage', label: t('dashboard.hubTabPilotage') },
  ];

  return (
    <div className="space-y-8">
      <div className="space-y-5">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">{hubTitle}</h1>
        <div className="flex flex-wrap gap-6 border-b border-neutral-200">
          {hubTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={hubTab === tab.id}
              className={cn(
                '-mb-px border-b-2 pb-3 text-sm font-medium transition-colors',
                hubTab === tab.id
                  ? 'border-foreground text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
              onClick={() => setHubTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {hubTab === 'assistants' && <DashboardAssistantsHub />}
      {hubTab === 'history' && <DashboardHistoryHub />}
      {hubTab === 'pilotage' &&
        (pilotageReady ? (
          <PilotageDashboardBody
            kpis={kpis}
            selectedYear={selectedYear}
            setSelectedYear={setSelectedYear}
            revenueCategories={revenueCategories}
            expenses={expenses}
            briefing={briefing}
          />
        ) : (
          <div className="py-20 text-center text-muted-foreground">{t('common.loading')}</div>
        ))}
    </div>
  );
}

function ProfessionalKpiCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  trendUp,
  color,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ReactNode;
  trend: string;
  trendUp: boolean;
  color: string;
}) {
  const colorClasses: Record<string, { bg: string; text: string; border: string }> = {
    emerald: { bg: 'bg-sky-50', text: 'text-sky-600', border: 'border-sky-200' },
    blue: { bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-200' },
    violet: { bg: 'bg-violet-50', text: 'text-violet-600', border: 'border-violet-200' },
    amber: { bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-200' },
  };

  const colors = colorClasses[color] || colorClasses.emerald;

  return (
    <Card className={`border-2 ${colors.border} hover:shadow-md transition-shadow`}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className={`rounded-lg p-2 ${colors.bg} ${colors.text}`}>{icon}</div>
          <div className={`flex items-center text-xs font-semibold ${trendUp ? 'text-sky-600' : 'text-red-600'}`}>
            {trendUp ? '↑' : '↓'} {trend}
          </div>
        </div>
        <div className="mt-4">
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          <p className="mt-1 text-sm font-medium text-gray-600">{title}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export function StatutBadge({ statut }: { statut: string }) {
  const map: Record<string, { cls: string; label: string }> = {
    GAGNE: { cls: 'bg-green-50 text-green-700', label: '✅ Gagné' },
    QUALIFIE: { cls: 'bg-blue-50 text-blue-700', label: '🔵 Qualifié' },
    PROPOSITION: { cls: 'bg-orange-50 text-orange-700', label: '🟠 Proposition' },
    NEGOCIATION: { cls: 'bg-purple-50 text-purple-700', label: '🟣 Négociation' },
    PROSPECT: { cls: 'bg-yellow-50 text-yellow-700', label: '🟡 Prospect' },
    PERDU: { cls: 'bg-red-50 text-red-700', label: '❌ Perdu' },
  };
  const { cls, label } = map[statut] || map.PROSPECT;
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${cls}`}>{label}</span>
  );
}
