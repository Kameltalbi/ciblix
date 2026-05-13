import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { TrendingUp, Plus, DollarSign, Target, Wallet, X, Sparkles, Flame, AlertTriangle, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import { fmtDT, MOIS_S } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/form-controls';
import type { KPIs } from '@/types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart as RechartsPieChart, Pie, Cell, Legend } from 'recharts';

function KpiCard({ title, subtitle, value, icon, color, ttcValue }: {
  title: string;
  subtitle: string;
  value: string;
  icon: React.ReactNode;
  color: string;
  ttcValue?: string;
}) {
  const colorClasses: Record<string, { bg: string; text: string; border: string; iconBg: string }> = {
    emerald: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', iconBg: 'bg-emerald-100' },
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

export function Dashboard() {
  const { t } = useTranslation();
  const [selectedYear, setSelectedYear] = useState<string>('2026');

  const { data: kpis, isPending: kpisPending } = useQuery<KPIs>({
    queryKey: ['kpis', selectedYear],
    queryFn: () => api.get('/kpis', { params: { annee: selectedYear } }).then((r) => r.data),
  });

  const { data: revenueCategories = [] } = useQuery<any[]>({
    queryKey: ['categories', 'REVENUE'],
    queryFn: () => api.get('/categories', { params: { type: 'REVENUE' } }).then((r) => r.data),
  });

  const { data: expenseCategories = [] } = useQuery<any[]>({
    queryKey: ['categories', 'EXPENSE'],
    queryFn: () => api.get('/categories', { params: { type: 'EXPENSE' } }).then((r) => r.data),
  });

  const { data: expensesData } = useQuery<{ data: any[], pagination: any }>({
    queryKey: ['expenses', selectedYear],
    queryFn: () => api.get('/expenses', { params: { year: selectedYear, limit: 9999 } }).then((r) => r.data),
  });
  const expenses = expensesData?.data || [];
  const totalExpenses = expenses.reduce((sum: number, e: any) => sum + Number(e.amount), 0);
  const caTotalTTC = kpis ? Number(kpis.caTotalAll) * 1.19 : 0;
  const tauxCouverture = totalExpenses > 0 ? Math.round((caTotalTTC / totalExpenses) * 100) : null;

  const { data: briefing } = useQuery({
    queryKey: ['operational-briefing'],
    queryFn: () => api.get('/ai-assistant/operational-briefing').then((r) => r.data),
    staleTime: 60_000,
  });

  if (kpisPending || !kpis) {
    return <div className="text-center py-20 text-muted-foreground">Chargement...</div>;
  }

  const affairesTotal =
    kpis.counts.gagne + kpis.counts.enCours + kpis.counts.prospect + kpis.counts.perdu;

  // Prepare chart data
  const monthlyData = Object.entries(kpis.parMois).map(([month, data]) => ({
    month: MOIS_S[parseInt(month)],
    gagne: Number(data.realise),
    enCours: Number(data.pipeline),
    prospect: Number(data.prospect),
    total: Number(data.realise) + Number(data.pipeline) + Number(data.prospect),
  }));

  // Status distribution for pie chart
  const statusDistributionData = [
    { name: 'Réalisé', value: kpis.caRealise, color: '#22c55e' },
    { name: 'Pipeline', value: kpis.caPipeline, color: '#0ea5e9' },
    { name: 'Prospection', value: kpis.caProspection, color: '#f59e0b' },
  ];

  // Opportunities per month (count)
  const opportunitiesByMonth: { month: string; count: number }[] = [];
  for (let m = 1; m <= 12; m++) {
    const monthData = kpis.parMois[m] || { realise: 0, pipeline: 0, prospect: 0 };
    const totalCount = Number(monthData.realise) + Number(monthData.pipeline) + Number(monthData.prospect);
    opportunitiesByMonth.push({
      month: MOIS_S[m],
      count: totalCount,
    });
  }

  // Revenue by category - use backend parType data
  const revenueByCategory: any[] = [];
  // Mapping for old hardcoded values to display names
  const typeMapping: Record<string, string> = {
    'BILAN_CARBONE': 'Bilan Carbone',
    'FORMATION': 'Formation',
  };
  
  // Initialize with all custom categories
  revenueCategories.forEach((cat: any) => {
    revenueByCategory.push({ name: cat.name, value: 0 });
  });
  
  // Add revenue from backend parType data
  Object.entries(kpis.parType || {}).forEach(([type, value]) => {
    const catName = typeMapping[type] || type;
    const existing = revenueByCategory.find((r) => r.name === catName);
    if (existing) {
      existing.value += Number(value);
    } else {
      revenueByCategory.push({ name: catName, value: Number(value) });
    }
  });
  
  // Filter out categories with 0 revenue
  const filteredRevenueByCategory = revenueByCategory.filter(cat => cat.value > 0);
  
  // Generate unique colors based on category name
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

  // Expenses by category
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

  const winRate = kpis.counts.gagne + kpis.counts.perdu > 0
    ? Math.round((kpis.counts.gagne / (kpis.counts.gagne + kpis.counts.perdu)) * 100)
    : 0;

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl md:text-4xl font-bold tracking-tight">{t('dashboard.title')}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t('dashboard.overview')}</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
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
            <Button className="w-full sm:w-auto shadow-lg"><Plus size={16} className="mr-2" />{t('common.add')} {t('affaires.addAffaire')}</Button>
          </Link>
        </div>
      </div>

      {briefing && (
        <Card className="border-violet-200/70 bg-gradient-to-r from-violet-50/80 via-white to-sky-50/50 shadow-sm overflow-hidden">
          <CardHeader className="pb-2 flex flex-row items-center justify-between gap-4">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Sparkles className="text-violet-600" size={22} />
                Pilotage IA
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Priorités, risques et CA pondéré du mois — mis à jour automatiquement depuis votre pipeline.
              </p>
            </div>
            <Link to="/ai-assistant">
              <Button size="sm" className="gap-1.5 shrink-0">
                Assistant IA <ChevronRight size={16} />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="rounded-xl border bg-white/80 p-3">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Flame size={12} className="text-orange-500" /> Chaudes / prioritaires
                </p>
                <p className="text-xl font-bold">{briefing.summary?.priorityOpportunities ?? 0}</p>
              </div>
              <div className="rounded-xl border bg-white/80 p-3">
                <p className="text-xs text-muted-foreground">Sans réponse 7j+</p>
                <p className="text-xl font-bold">{briefing.summary?.quotesWithoutReply7d ?? 0}</p>
              </div>
              <div className="rounded-xl border bg-white/80 p-3">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <AlertTriangle size={12} className="text-rose-500" /> À risque
                </p>
                <p className="text-xl font-bold">{briefing.summary?.atRiskCount ?? 0}</p>
              </div>
              <div className="rounded-xl border bg-white/80 p-3">
                <p className="text-xs text-muted-foreground">CA pondéré mois</p>
                <p className="text-xl font-bold">{fmtDT(briefing.summary?.monthForecastWeightedHT ?? 0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <KpiCard
          title={t('dashboard.kpis.totalCA')}
          subtitle={`${affairesTotal} ${t('affaires.title')}`}
          value={fmtDT(kpis.caTotalAll)}
          ttcValue={fmtDT(kpis.caTotalAll * 1.19)}
          icon={<DollarSign className="w-6 h-6" />}
          color="emerald"
        />
        <KpiCard
          title={t('dashboard.kpis.pipelineCA')}
          subtitle={`${kpis.counts.enCours + kpis.counts.prospect} ${t('affaires.title')}`}
          value={fmtDT(kpis.caPipeline + kpis.caProspection)}
          ttcValue={fmtDT((kpis.caPipeline + kpis.caProspection) * 1.19)}
          icon={<Target className="w-6 h-6" />}
          color="blue"
        />
        <KpiCard
          title={t('dashboard.kpis.caWon')}
          subtitle={`${kpis.counts.gagne} ${t('affaires.title')}`}
          value={fmtDT(kpis.caRealise)}
          ttcValue={fmtDT(kpis.caRealise * 1.19)}
          icon={<Wallet className="w-6 h-6" />}
          color="emerald"
        />
        <KpiCard
          title="Taux de couverture"
          subtitle="CA total TTC / Dépenses"
          value={tauxCouverture !== null ? `${tauxCouverture}%` : '—'}
          icon={<TrendingUp className="w-6 h-6" />}
          color="amber"
        />
        <KpiCard
          title="Opportunités gagnées"
          subtitle={`${kpis.counts.gagne} opportunités`}
          value={`${kpis.counts.gagne}`}
          icon={<Wallet className="w-6 h-6" />}
          color="emerald"
        />
        <KpiCard
          title="Conversion"
          subtitle={`${kpis.counts.gagne + kpis.counts.perdu} conclues`}
          value={`${winRate}%`}
          icon={<Target className="w-6 h-6" />}
          color="purple"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Évolution mensuelle du CA ({selectedYear})</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="month" stroke="#6b7280" fontSize={12} />
                <YAxis stroke="#6b7280" fontSize={12} tickFormatter={(value) => `${value / 1000}k`} />
                <Tooltip
                  formatter={(value: number) => [fmtDT(value), '']}
                  contentStyle={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '12px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Legend />
                <Line type="monotone" dataKey="gagne" stroke="#22c55e" strokeWidth={3} name="Réalisé" dot={{ r: 5 }} />
                <Line type="monotone" dataKey="enCours" stroke="#0ea5e9" strokeWidth={3} name="Pipeline" dot={{ r: 5 }} />
                <Line type="monotone" dataKey="prospect" stroke="#f59e0b" strokeWidth={3} name="Prospection" dot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Répartition du CA par statut ({affairesTotal})</CardTitle>
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

      {/* Pipeline Status Chart & Opportunities by Month */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm md:text-base">État du pipeline des opportunités ({affairesTotal})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 mb-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Réalisé</span>
                <span className="font-semibold text-emerald-600">{fmtDT(kpis.caRealise)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Pipeline</span>
                <span className="font-semibold text-blue-600">{fmtDT(kpis.caPipeline)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Prospection</span>
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
            <CardTitle className="text-sm md:text-base">Opportunités par mois ({selectedYear})</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={opportunitiesByMonth}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" stroke="#6b7280" fontSize={11} />
                <YAxis stroke="#6b7280" fontSize={11} />
                <Tooltip
                  formatter={(value: number) => [value, 'opportunité(s)']}
                  contentStyle={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '12px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Revenue and Expenses by Category */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Revenus par catégorie ({fmtDT(kpis.caTotal)})</CardTitle>
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
                  formatter={(value: number, _name: any, props: any) => [`${fmtDT(value)} TND`, `${props?.payload?.percentage?.toFixed(1) || '0'}%`]}
                  contentStyle={{ borderRadius: '10px', border: '1px solid #e5e7eb', boxShadow: '0 6px 16px rgba(0,0,0,0.08)' }}
                />
              </RechartsPieChart>
            </ResponsiveContainer>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {revenueChartData.slice(0, 6).map((entry: any, index: number) => (
                <div key={`rev-legend-${entry.name}`} className="flex items-center justify-between gap-2 rounded-md border border-border/60 px-2 py-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="inline-block w-2.5 h-2.5 rounded-sm shrink-0"
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
            <CardTitle className="text-base font-semibold">Dépenses par catégorie ({fmtDT(totalExpenses)})</CardTitle>
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
                  formatter={(value: number, _name: any, props: any) => [`${fmtDT(value)} TND`, `${props?.payload?.percentage?.toFixed(1) || '0'}%`]}
                  contentStyle={{ borderRadius: '10px', border: '1px solid #e5e7eb', boxShadow: '0 6px 16px rgba(0,0,0,0.08)' }}
                />
              </RechartsPieChart>
            </ResponsiveContainer>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {expensesChartData.slice(0, 6).map((entry: any, index: number) => (
                <div key={`exp-legend-${entry.name}`} className="flex items-center justify-between gap-2 rounded-md border border-border/60 px-2 py-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="inline-block w-2.5 h-2.5 rounded-sm shrink-0"
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

function ProfessionalKpiCard({ title, value, subtitle, icon, trend, trendUp, color }: {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ReactNode;
  trend: string;
  trendUp: boolean;
  color: string;
}) {
  const colorClasses: Record<string, { bg: string; text: string; border: string }> = {
    emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-200' },
    blue: { bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-200' },
    violet: { bg: 'bg-violet-50', text: 'text-violet-600', border: 'border-violet-200' },
    amber: { bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-200' },
  };

  const colors = colorClasses[color] || colorClasses.emerald;

  return (
    <Card className={`border-2 ${colors.border} hover:shadow-md transition-shadow`}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className={`p-2 rounded-lg ${colors.bg} ${colors.text}`}>{icon}</div>
          <div className={`flex items-center text-xs font-semibold ${trendUp ? 'text-emerald-600' : 'text-red-600'}`}>
            {trendUp ? '↑' : '↓'} {trend}
          </div>
        </div>
        <div className="mt-4">
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          <p className="text-sm font-medium text-gray-600 mt-1">{title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export function StatutBadge({ statut }: { statut: string }) {
  const map: Record<string, { cls: string; label: string }> = {
    GAGNE: { cls: 'bg-green-50 text-green-700', label: '✅ Gagné' },
    QUALIFIE: { cls: 'bg-blue-50 text-blue-700', label: '🔵 Qualifié' },
    PROPOSITION: { cls: 'bg-orange-50 text-orange-700', label: '� Proposition' },
    NEGOCIATION: { cls: 'bg-purple-50 text-purple-700', label: '🟣 Négociation' },
    PROSPECT: { cls: 'bg-yellow-50 text-yellow-700', label: '🟡 Prospect' },
    PERDU: { cls: 'bg-red-50 text-red-700', label: '❌ Perdu' },
  };
  const { cls, label } = map[statut] || map.PROSPECT;
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${cls}`}>{label}</span>;
}
