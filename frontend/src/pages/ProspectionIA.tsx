import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Sparkles,
  Search,
  Building2,
  Mail,
  MessageCircle,
  CalendarClock,
  Copy,
  Loader2,
  Flame,
  Ban,
  KanbanSquare,
  Bot,
  AlertTriangle,
  Phone,
  Globe,
  ExternalLink,
  Filter,
  Clock,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input, Label } from '@/components/ui/form-controls';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import {
  CHANNEL_UNAVAILABLE_HINTS,
  getChannelAvailability,
} from '@/lib/prospectChannelAvailability';

type Potential = 'TRES_FORT' | 'MOYEN' | 'FAIBLE' | string | null;

type ProspectingAutomationDTO = {
  active: boolean;
  intervalHours: number;
  refreshCache: boolean;
  qualifyAfterSearch: boolean;
  maxNewPerRun: number;
  nextRunAt: string;
  lastRunAt: string | null;
  lastRunImported: number | null;
  lastRunQualified: number | null;
  lastRunError: string | null;
};

const AUTOMATION_INTERVALS_H = [6, 12, 24, 48, 72, 168];

function parseEmailList(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.filter((x): x is string => typeof x === 'string');
  if (typeof raw === 'string') {
    try {
      const j = JSON.parse(raw) as unknown;
      return Array.isArray(j) ? j.filter((x): x is string => typeof x === 'string') : [];
    } catch {
      return [];
    }
  }
  return [];
}

interface AiProspectRow {
  id: string;
  companyName: string;
  website?: string | null;
  linkedin?: string | null;
  phone?: string | null;
  email?: string | null;
  city?: string | null;
  country?: string | null;
  industry?: string | null;
  companySize?: string | null;
  score: number;
  scoreReason?: string | null;
  suggestedPitch?: string | null;
  commercialAngle?: string | null;
  contactId?: string | null;
  aiSummary?: string | null;
  potentialLevel?: Potential;
  interestProbability?: number | null;
  status: string;
  leadId?: string | null;
  websiteTitle?: string | null;
  websiteDescription?: string | null;
  detectedEmails?: unknown;
  facebookUrl?: string | null;
  instagramUrl?: string | null;
  faviconUrl?: string | null;
  hasResponsiveWebsite?: boolean | null;
  hasSsl?: boolean | null;
  seoScore?: number | null;
  digitalPresenceLevel?: string | null;
  technologiesDetected?: unknown;
  probableBusinessProblem?: string | null;
  suggestedOffer?: string | null;
  googleMapsUrl?: string | null;
  commercialProfile?: {
    productsServices?: string[];
    targetSectors?: string[];
    clienteleType?: string;
    companySizeEstimate?: string;
    saleOpportunities?: string[];
    importantPages?: string[];
  } | null;
  emailOpenedAt?: string | null;
  linkClickedAt?: string | null;
  lastReplyAt?: string | null;
  lastContactAt?: string | null;
}

interface DashboardPayload {
  prospectsFound: number;
  hotLeads: number;
  prospectsContacted: number;
  inPipeline: number;
  opportunitiesFromAi: number;
  responseRate: number | null;
  responseRateNote?: string;
  recentProspects: { id: string; companyName: string; score: number; potentialLevel?: Potential; status: string }[];
  alerts: { type: string; message: string }[];
}

interface SearchResponse {
  prospects: AiProspectRow[];
  providerUsed: string;
  fromCache?: boolean;
  rawHits?: number;
}

interface TimelinePayload {
  events: { at: string; type: string; title: string; meta?: Record<string, unknown> }[];
}

export type ProspectFilters = {
  withWebsite: boolean;
  withoutLinkedin: boolean;
  hotOnly: boolean;
  sector: string;
  city: string;
  exporters: boolean;
  industrial: boolean;
  lowDigital: boolean;
};

const defaultFilters: ProspectFilters = {
  withWebsite: false,
  withoutLinkedin: false,
  hotOnly: false,
  sector: '',
  city: '',
  exporters: false,
  industrial: false,
  lowDigital: false,
};

function potentialLabel(p: Potential | undefined) {
  if (p === 'TRES_FORT')
    return {
      text: 'Très fort potentiel',
      emoji: '●',
      cls: 'border-brand-soft/80 bg-gradient-to-r from-[#016AEB]/12 to-[#BED6F6]/40 text-[#0b3d7a]',
    };
  if (p === 'MOYEN')
    return {
      text: 'Potentiel moyen',
      emoji: '◆',
      cls: 'border-brand-soft/60 bg-[#BED6F6]/25 text-[#1E72B9]',
    };
  if (p === 'FAIBLE')
    return {
      text: 'Faible potentiel',
      emoji: '○',
      cls: 'bg-slate-100/90 text-slate-700 border-slate-200/90',
    };
  return { text: 'À qualifier', emoji: '◇', cls: 'bg-muted/80 text-muted-foreground border-border' };
}

function cardHeatClass(score: number) {
  if (score >= 72)
    return 'border-brand-soft/90 shadow-card hover:shadow-glow hover:border-[#016AEB]/35';
  if (score >= 48) return 'border-[#BED6F6]/80 shadow-card hover:shadow-card-hover';
  return 'border-border/70 hover:border-brand-soft/50 hover:shadow-sm';
}

function mergeProspectUpdates(prev: AiProspectRow[], updates: AiProspectRow[]): AiProspectRow[] {
  const byId = new Map(updates.map((u) => [u.id, u]));
  return prev.map((p) => {
    const next = byId.get(p.id);
    if (!next) return p;
    return {
      ...p,
      ...next,
      contactId: next.contactId ?? p.contactId ?? null,
    };
  });
}

function ScoreRing({ score, pending }: { score: number; pending?: boolean }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  const pct = pending ? 0 : Math.min(100, Math.max(0, score)) / 100;
  const offset = c * (1 - pct);
  const stroke = pending
    ? 'stroke-muted'
    : score >= 72
      ? 'stroke-[#016AEB]'
      : score >= 48
        ? 'stroke-[#0071DD]'
        : 'stroke-slate-400';
  return (
    <div className="relative shrink-0">
      <div className="pointer-events-none absolute inset-0 rounded-full bg-gradient-to-br from-[#BED6F6]/50 to-transparent blur-md" aria-hidden />
      <svg width="76" height="76" viewBox="0 0 80 80" className="relative shrink-0 drop-shadow-sm" aria-hidden>
        <circle cx="40" cy="40" r={r} fill="none" className="stroke-muted/35" strokeWidth="7" />
        <circle
          cx="40"
          cy="40"
          r={r}
          fill="none"
          className={cn('transition-all duration-700 ease-out', stroke)}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          transform="rotate(-90 40 40)"
        />
        <text
          x="40"
          y="44"
          textAnchor="middle"
          className={cn('text-sm font-bold', pending ? 'fill-muted-foreground' : 'fill-[#0071DD]')}
        >
          {pending ? '…' : score}
        </text>
      </svg>
      <span className="sr-only">
        {pending ? 'Qualification IA en cours' : `Score IA ${score} sur 100`}
      </span>
    </div>
  );
}

function techList(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.filter((x): x is string => typeof x === 'string').slice(0, 6);
  return [];
}

function applyFilters(rows: AiProspectRow[], f: ProspectFilters): AiProspectRow[] {
  return rows.filter((p) => {
    if (f.withWebsite && !p.website) return false;
    if (f.withoutLinkedin && p.linkedin) return false;
    if (f.hotOnly && !(p.score >= 72 || p.potentialLevel === 'TRES_FORT')) return false;
    if (f.sector.trim()) {
      const s = f.sector.trim().toLowerCase();
      if (!(`${p.industry || ''} ${p.companyName}`).toLowerCase().includes(s)) return false;
    }
    if (f.city.trim()) {
      const s = f.city.trim().toLowerCase();
      if (!(`${p.city || ''}`).toLowerCase().includes(s)) return false;
    }
    if (f.exporters) {
      const t = `${p.scoreReason || ''} ${p.aiSummary || ''}`.toLowerCase();
      if (!t.includes('export')) return false;
    }
    if (f.industrial) {
      const t = `${p.industry || ''}`.toLowerCase();
      if (!/industr|manufact|usine|production|agro/i.test(t)) return false;
    }
    if (f.lowDigital && p.digitalPresenceLevel !== 'FAIBLE') return false;
    return true;
  });
}

function TimelineDialog({
  prospectId,
  open,
  onOpenChange,
  companyName,
}: {
  prospectId: string | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  companyName: string;
}) {
  const { data, isLoading } = useQuery<TimelinePayload>({
    queryKey: ['prospecting-timeline', prospectId],
    queryFn: () => api.get(`/prospecting/prospects/${prospectId}/timeline`).then((r) => r.data),
    enabled: open && !!prospectId,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock size={18} className="text-[#0071DD]" />
            Activité — {companyName}
          </DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <div className="flex justify-center py-8 text-muted-foreground text-sm">
            <Loader2 className="animate-spin h-6 w-6" />
          </div>
        ) : (
          <ul className="ml-1 space-y-3 border-l-2 border-[#BED6F6] pl-4 text-sm">
            {(data?.events || []).map((ev, i) => (
              <li key={`${ev.at}-${i}`} className="relative">
                <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-[#016AEB] ring-4 ring-white shadow-[0_0_0_3px_rgba(190,214,246,0.5)]" />
                <p className="text-xs text-muted-foreground tabular-nums">
                  {new Date(ev.at).toLocaleString('fr-FR')}
                </p>
                <p className="font-medium text-foreground">{ev.title}</p>
                <p className="text-xs text-muted-foreground">{ev.type}</p>
              </li>
            ))}
          </ul>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Fermer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ProspectionIA() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [sector, setSector] = useState('');
  const [country, setCountry] = useState('Tunisie');
  const [city, setCity] = useState('');
  const [companySize, setCompanySize] = useState('');
  const [keywords, setKeywords] = useState('');
  const [results, setResults] = useState<AiProspectRow[]>([]);
  const [fromCache, setFromCache] = useState(false);
  const [qualifyRunning, setQualifyRunning] = useState(false);
  const [filters, setFilters] = useState<ProspectFilters>(defaultFilters);
  const [timeline, setTimeline] = useState<{ open: boolean; id: string | null; name: string }>({
    open: false,
    id: null,
    name: '',
  });
  const [preview, setPreview] = useState<{
    open: boolean;
    title: string;
    body: string;
    disclaimer?: string;
    signatureWarning?: string;
  }>({ open: false, title: '', body: '' });
  const [fiche, setFiche] = useState<{ open: boolean; prospect: AiProspectRow | null }>({
    open: false,
    prospect: null,
  });

  const [autoActive, setAutoActive] = useState(false);
  const [autoInterval, setAutoInterval] = useState(24);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [autoQualify, setAutoQualify] = useState(true);

  const filtered = useMemo(() => applyFilters(results, filters), [results, filters]);

  const { data: dash } = useQuery<DashboardPayload>({
    queryKey: ['prospecting-dashboard'],
    queryFn: () => api.get('/prospecting/dashboard').then((r) => r.data),
    staleTime: 45_000,
  });

  const { data: automationRes } = useQuery<{ automation: ProspectingAutomationDTO | null }>({
    queryKey: ['prospecting-automation'],
    queryFn: () => api.get('/prospecting/automation').then((r) => r.data),
    staleTime: 30_000,
  });

  useEffect(() => {
    const row = automationRes?.automation;
    if (!row) return;
    setAutoActive(row.active);
    setAutoInterval(row.intervalHours);
    setAutoRefresh(row.refreshCache);
    setAutoQualify(row.qualifyAfterSearch);
  }, [automationRes?.automation]);

  const drainQualifyAfterSearch = async (data: SearchResponse) => {
    const ids = (data.prospects ?? []).filter((p) => p.status === 'FOUND').map((p) => p.id);
    if (ids.length === 0) return;
    setQualifyRunning(true);
    let noProgress = 0;
    try {
      for (let i = 0; i < 50; i++) {
        const { data: qb } = await api.post<{
          qualified: number;
          prospects: AiProspectRow[];
          remainingFound: number;
        }>('/prospecting/qualify-batch', { prospectIds: ids, limit: 20 });
        if (qb.prospects?.length) {
          setResults((prev) => mergeProspectUpdates(prev, qb.prospects));
        }
        if (!qb.remainingFound) break;
        if (!qb.qualified) {
          noProgress++;
          if (noProgress >= 3) break;
        } else noProgress = 0;
      }
    } finally {
      setQualifyRunning(false);
      void qc.invalidateQueries({ queryKey: ['prospecting-dashboard'] });
    }
  };

  const searchMutation = useMutation({
    mutationFn: () =>
      api
        .post('/prospecting/search', {
          sector: sector || undefined,
          country: country || undefined,
          city: city || undefined,
          companySize: companySize || undefined,
          keywords: keywords || undefined,
          refresh: true,
        })
        .then((r) => r.data as SearchResponse),
    onSuccess: (data) => {
      setResults(data.prospects || []);
      setFromCache(Boolean(data.fromCache));
      void qc.invalidateQueries({ queryKey: ['prospecting-dashboard'] });
      void drainQualifyAfterSearch(data);
    },
    onError: (e: { response?: { data?: { error?: string } }; message?: string }) => {
      window.alert(e?.response?.data?.error || e?.message || 'Erreur lors de la recherche');
    },
  });

  const addPipeline = useMutation({
    mutationFn: (id: string) => api.post(`/prospecting/prospects/${id}/add-to-pipeline`).then((r) => r.data),
    onSuccess: (data: { contactId?: string | null }, id) => {
      setResults((prev) =>
        prev.map((p) =>
          p.id === id
            ? { ...p, status: 'IN_PIPELINE' as const, contactId: data.contactId ?? p.contactId }
            : p
        )
      );
      void qc.invalidateQueries({ queryKey: ['prospecting-dashboard'] });
    },
  });

  const ignoreMutation = useMutation({
    mutationFn: (id: string) => api.post(`/prospecting/prospects/${id}/ignore`).then((r) => r.data),
    onSuccess: (_, id) => {
      setResults((prev) => prev.map((p) => (p.id === id ? { ...p, status: 'IGNORED' } : p)));
      void qc.invalidateQueries({ queryKey: ['prospecting-dashboard'] });
    },
  });

  const scheduleMutation = useMutation({
    mutationFn: ({ id, dayOffset }: { id: string; dayOffset: 3 | 7 | 15 }) =>
      api.post(`/prospecting/prospects/${id}/schedule-followup`, { dayOffset }).then((r) => r.data),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['calendar'] }),
  });

  const saveAutomationMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.put('/prospecting/automation', body).then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['prospecting-automation'] });
      void qc.invalidateQueries({ queryKey: ['prospecting-dashboard'] });
      window.alert(t('prospectionIA.automationSaved'));
    },
    onError: (e: { response?: { data?: { error?: string } }; message?: string }) => {
      window.alert(e?.response?.data?.error || e?.message || 'Erreur');
    },
  });

  const messageMutation = useMutation({
    mutationFn: (args: { id: string; messageType: string; tone?: string }) =>
      api.post(`/prospecting/prospects/${args.id}/generate-message`, args).then((r) => r.data),
    onSuccess: (
      data: {
        body: string;
        disclaimer?: string;
        messageType?: string;
        signatureWarning?: boolean;
        signatureWarningText?: string;
        contactId?: string | null;
      },
      args
    ) => {
      if (data.contactId) {
        setResults((prev) =>
          prev.map((p) => (p.id === args.id ? { ...p, contactId: data.contactId } : p))
        );
      }
      setPreview({
        open: true,
        title: 'Aperçu du message (validation humaine)',
        body: data.body,
        disclaimer: data.disclaimer,
        signatureWarning: data.signatureWarning ? data.signatureWarningText : undefined,
      });
    },
    onError: (e: { response?: { data?: { error?: string } }; message?: string }) => {
      window.alert(e?.response?.data?.error || e?.message || 'Génération impossible pour ce canal');
    },
  });

  const copyPreview = async () => {
    await navigator.clipboard.writeText(preview.body);
  };

  const toggleFilter = (key: keyof ProspectFilters) => {
    setFilters((f) => {
      const cur = f[key];
      if (typeof cur === 'boolean') return { ...f, [key]: !cur };
      return f;
    });
  };

  return (
    <div className="relative mx-auto max-w-6xl space-y-10 pb-16">
      {/* Halo IA — fond premium */}
      <div
        className="pointer-events-none absolute -left-24 -top-32 h-[28rem] w-[28rem] rounded-full bg-gradient-to-br from-[#BED6F6]/50 via-[#016AEB]/8 to-transparent blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-20 top-40 h-[22rem] w-[22rem] rounded-full bg-gradient-to-bl from-[#0071DD]/10 to-transparent blur-3xl"
        aria-hidden
      />

      <div className="relative flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-serif text-3xl font-bold tracking-tight text-[#0071DD] md:text-4xl flex items-center gap-3">
            <span className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#016AEB] to-[#1E72B9] text-white shadow-glow">
              <Sparkles className="h-5 w-5" strokeWidth={2.2} />
              <span className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-white/25" aria-hidden />
            </span>
            {t('nav.agentHunt')}
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
            Recherche ciblée, enrichissement web automatique, scoring et angles commerciaux — copilote premium pour
            équipes PME. Toujours valider avant envoi.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/all-prospects">
            <Button variant="outline" size="sm">
              Tous les prospects IA
            </Button>
          </Link>
          <Link to="/ai-assistant">
            <Button variant="outline" size="sm" className="gap-1.5">
              <Bot size={16} /> Assistant IA
            </Button>
          </Link>
        </div>
      </div>

      {dash && (
        <div className="relative grid grid-cols-2 gap-4 md:grid-cols-4">
          <Card className="border-border bg-card shadow-card transition-all duration-300 hover:shadow-card-hover hover:-translate-y-0.5">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Trouvés / qualifiés</p>
                  <p className="mt-2 text-3xl font-bold tabular-nums tracking-tight text-foreground">{dash.prospectsFound}</p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Building2 size={20} strokeWidth={2} />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border bg-card shadow-card transition-all duration-300 hover:shadow-card-hover hover:-translate-y-0.5">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Prospects chauds</p>
                  <p className="mt-2 text-3xl font-bold tabular-nums tracking-tight text-primary">{dash.hotLeads}</p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-100 text-orange-600">
                  <Flame size={20} strokeWidth={2} />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border bg-card shadow-card transition-all duration-300 hover:shadow-card-hover hover:-translate-y-0.5">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('prospectionIA.inOpportunitiesLabel')}</p>
                  <p className="mt-2 text-3xl font-bold tabular-nums tracking-tight text-foreground">{dash.inPipeline}</p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-100 text-purple-600">
                  <KanbanSquare size={20} strokeWidth={2} />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border bg-card shadow-card transition-all duration-300 hover:shadow-card-hover hover:-translate-y-0.5">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Prospects source IA</p>
                  <p className="mt-2 text-3xl font-bold tabular-nums tracking-tight text-foreground">{dash.opportunitiesFromAi}</p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 text-accent">
                  <Sparkles size={20} strokeWidth={2} />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {dash?.alerts?.length ? (
        <div className="flex flex-col gap-2">
          {dash.alerts.map((a, i) => (
            <div
              key={i}
              className="flex items-center gap-2 rounded-xl border border-amber-200/70 bg-amber-50/60 px-3 py-2 text-sm text-amber-950"
            >
              <AlertTriangle size={16} className="shrink-0" />
              {a.message}
            </div>
          ))}
        </div>
      ) : null}

      <Card className="border-border bg-card shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl font-semibold text-foreground">
            <Clock className="text-primary" size={22} />
            {t('prospectionIA.automationTitle')}
          </CardTitle>
          <p className="text-sm text-muted-foreground">{t('prospectionIA.automationSubtitle')}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border/60 bg-muted/20 p-3">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 rounded border-border"
              checked={autoActive}
              onChange={(e) => setAutoActive(e.target.checked)}
            />
            <span className="text-sm font-medium">{t('prospectionIA.automationActive')}</span>
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>{t('prospectionIA.automationInterval')}</Label>
              <select
                className="flex h-11 w-full rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={autoInterval}
                onChange={(e) => setAutoInterval(Number(e.target.value))}
              >
                {AUTOMATION_INTERVALS_H.map((h) => (
                  <option key={h} value={h}>
                    {h === 168 ? t('prospectionIA.days7') : t('prospectionIA.hours', { n: h })}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-3 sm:pt-7">
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-border"
                  checked={autoQualify}
                  onChange={(e) => setAutoQualify(e.target.checked)}
                />
                {t('prospectionIA.qualifyAfter')}
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-border"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                />
                {t('prospectionIA.refreshCache')}
              </label>
            </div>
          </div>
          {automationRes?.automation ? (
            <div className="rounded-lg border border-border/60 bg-muted/10 p-3 text-xs text-muted-foreground space-y-1">
              <p>
                <span className="font-semibold text-foreground">{t('prospectionIA.nextRun')} : </span>
                {new Date(automationRes.automation.nextRunAt).toLocaleString()}
              </p>
              {automationRes.automation.lastRunAt ? (
                <p>
                  <span className="font-semibold text-foreground">{t('prospectionIA.lastRun')} : </span>
                  {new Date(automationRes.automation.lastRunAt).toLocaleString()} — {t('prospectionIA.lastStats')}:{' '}
                  {automationRes.automation.lastRunImported ?? '—'} / {automationRes.automation.lastRunQualified ?? '—'}
                </p>
              ) : null}
              {automationRes.automation.lastRunError ? (
                <p className="text-destructive">
                  {t('prospectionIA.errorRun')} : {automationRes.automation.lastRunError.slice(0, 200)}
                </p>
              ) : null}
            </div>
          ) : null}
          <Button
            type="button"
            variant="secondary"
            className="gap-2"
            disabled={saveAutomationMutation.isPending}
            onClick={() =>
              saveAutomationMutation.mutate({
                active: autoActive,
                criteria: {
                  sector: sector || undefined,
                  country: country || undefined,
                  city: city || undefined,
                  companySize: companySize || undefined,
                  keywords: keywords || undefined,
                },
                intervalHours: autoInterval,
                refreshCache: autoRefresh,
                qualifyAfterSearch: autoQualify,
              })
            }
          >
            {saveAutomationMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {t('prospectionIA.saveAutomation')}
          </Button>
        </CardContent>
      </Card>

      <Card className="relative overflow-hidden border-border bg-card shadow-card">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-50" aria-hidden />
        <CardHeader className="relative">
          <CardTitle className="flex items-center gap-2 text-xl font-semibold text-foreground">
            <Search className="text-primary" size={22} />
            Recherche prospects IA
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Recherche intelligente avec scoring automatique et enrichissement web
          </p>
        </CardHeader>
        <CardContent className="relative space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Secteur d&apos;activité</Label>
              <Input
                value={sector}
                onChange={(e) => setSector(e.target.value)}
                placeholder="ex. BTP, agroalimentaire…"
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Pays</Label>
              <Input
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                placeholder="Tunisie"
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Ville</Label>
              <Input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Tunis, Casablanca…"
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Taille entreprise</Label>
              <Input
                value={companySize}
                onChange={(e) => setCompanySize(e.target.value)}
                placeholder="11-50, 50-200…"
                className="h-11"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label className="text-sm font-medium">Mots-clés</Label>
              <Input
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                placeholder="ex. architecture Tunisie, bureaux d'études, industriels…"
                className="h-11"
              />
            </div>
          </div>
          <Button
            size="lg"
            className={cn(
              'w-full min-w-[220px] gap-2 rounded-xl bg-primary text-primary-foreground shadow-sm transition-all duration-200 hover:bg-primary/90 hover:shadow-md sm:w-auto',
              searchMutation.isPending && 'opacity-90'
            )}
            disabled={searchMutation.isPending}
            onClick={() => searchMutation.mutate()}
          >
            {searchMutation.isPending ? (
              <>
                <Loader2 className="animate-spin" size={18} /> Recherche en cours…
              </>
            ) : (
              <>
                <Sparkles size={18} /> Rechercher avec l'IA
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {results.length > 0 && (
        <section className="space-y-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-foreground">
              <Filter size={18} />
              Résultats ({filtered.length}/{results.length})
            </h2>
            {fromCache ? (
              <span className="rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
                Cache API (économie)
              </span>
            ) : null}
            {qualifyRunning ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                Qualification IA…
              </span>
            ) : null}
          </div>

          <Card className="border-border bg-card shadow-card">
            <CardContent className="space-y-4 p-6">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Filtres avancés</p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={filters.withWebsite ? 'default' : 'outline'}
                  className="rounded-full text-xs"
                  onClick={() => toggleFilter('withWebsite')}
                >
                  Avec site web
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={filters.withoutLinkedin ? 'default' : 'outline'}
                  className="rounded-full text-xs"
                  onClick={() => toggleFilter('withoutLinkedin')}
                >
                  Sans LinkedIn
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={filters.hotOnly ? 'default' : 'outline'}
                  className="rounded-full text-xs"
                  onClick={() => toggleFilter('hotOnly')}
                >
                  Fort potentiel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={filters.exporters ? 'default' : 'outline'}
                  className="rounded-full text-xs"
                  onClick={() => toggleFilter('exporters')}
                >
                  Signaux export
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={filters.industrial ? 'default' : 'outline'}
                  className="rounded-full text-xs"
                  onClick={() => toggleFilter('industrial')}
                >
                  Industriel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={filters.lowDigital ? 'default' : 'outline'}
                  className="rounded-full text-xs"
                  onClick={() => toggleFilter('lowDigital')}
                >
                  Présence digitale faible
                </Button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Filtrer secteur</Label>
                  <Input
                    placeholder="ex. BTP"
                    value={filters.sector}
                    onChange={(e) => setFilters((f) => ({ ...f, sector: e.target.value }))}
                    className="h-10"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Filtrer ville</Label>
                  <Input
                    placeholder="ex. Tunis"
                    value={filters.city}
                    onChange={(e) => setFilters((f) => ({ ...f, city: e.target.value }))}
                    className="h-10"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {filtered.map((p) => {
              const pot = potentialLabel(p.potentialLevel);
              const ignored = p.status === 'IGNORED';
              const inPipe = Boolean(p.leadId) || p.status === 'IN_PIPELINE';
              const emails = [p.email, ...parseEmailList(p.detectedEmails)].filter(Boolean);
              const mainEmail = emails[0];
              const techs = techList(p.technologiesDetected);
              const tel = p.phone?.replace(/\s/g, '') || '';
              const channels = getChannelAvailability(p);

              return (
                <Card
                  key={p.id}
                  className={cn(
                    'group/card border-border bg-card shadow-card transition-all duration-300 hover:shadow-card-hover hover:-translate-y-0.5',
                    p.score >= 72 && 'border-primary/30',
                    ignored && 'pointer-events-none opacity-50'
                  )}
                >
                  <CardContent className="p-6 space-y-5">
                    <div className="flex gap-4">
                      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-border bg-muted/50">
                        {p.faviconUrl ? (
                          <img src={p.faviconUrl} alt="" className="h-full w-full object-contain p-2" loading="lazy" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                            <Building2 size={24} strokeWidth={1.5} />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-semibold text-base leading-tight">{p.companyName}</p>
                            {p.websiteTitle ? (
                              <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">{p.websiteTitle}</p>
                            ) : null}
                            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                              <Building2 size={12} />
                              {(p.industry || '—') + (p.city ? ` · ${p.city}` : '') + (p.country ? `, ${p.country}` : '')}
                            </p>
                          </div>
                          <span
                            className={cn(
                              'shrink-0 inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium',
                              p.potentialLevel === 'TRES_FORT' ? 'border-primary/20 bg-primary/5 text-primary' : pot.cls
                            )}
                          >
                            {p.potentialLevel === 'TRES_FORT' ? <Flame size={12} className="text-primary" /> : pot.emoji} {p.potentialLevel === 'TRES_FORT' ? 'Hot' : pot.text}
                          </span>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {p.digitalPresenceLevel ? (
                            <span className="rounded-lg bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                              Digital {p.digitalPresenceLevel}
                            </span>
                          ) : null}
                          {p.seoScore != null ? (
                            <span className="rounded-lg bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                              SEO {p.seoScore}/100
                            </span>
                          ) : null}
                          {p.hasSsl ? (
                            <span className="rounded-lg border border-primary/20 bg-primary/5 px-2 py-0.5 text-[10px] font-semibold text-primary">
                              HTTPS
                            </span>
                          ) : null}
                          {p.hasResponsiveWebsite ? (
                            <span className="rounded-lg border border-accent/20 bg-accent/5 px-2 py-0.5 text-[10px] font-semibold text-accent">
                              Mobile
                            </span>
                          ) : null}
                          {techs.map((t) => (
                            <span key={t} className="rounded-lg border border-border/60 bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                              {t}
                            </span>
                          ))}
                        </div>
                      </div>
                      <ScoreRing score={p.score} pending={p.status === 'FOUND'} />
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <span title={channels.canCall ? undefined : CHANNEL_UNAVAILABLE_HINTS.call} className="inline-flex">
                        {channels.canCall ? (
                          <Button size="sm" variant="outline" className="gap-1.5 rounded-lg" asChild>
                            <a href={`tel:${tel}`}>
                              <Phone size={14} /> Appeler
                            </a>
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1.5 rounded-lg opacity-50 cursor-not-allowed"
                            disabled
                          >
                            <Phone size={14} /> Appeler
                          </Button>
                        )}
                      </span>
                      {p.website ? (
                        <Button size="sm" variant="outline" className="gap-1.5 rounded-lg" asChild>
                          <a href={p.website} target="_blank" rel="noreferrer">
                            <Globe size={14} /> Site web
                          </a>
                        </Button>
                      ) : null}
                      {mainEmail ? (
                        <Button size="sm" variant="outline" className="gap-1.5 rounded-lg" asChild>
                          <a href={`mailto:${mainEmail}`}>
                            <Mail size={14} /> {mainEmail}
                          </a>
                        </Button>
                      ) : null}
                      <span title={channels.canLinkedIn ? undefined : CHANNEL_UNAVAILABLE_HINTS.linkedin} className="inline-flex">
                        {channels.canLinkedIn && p.linkedin ? (
                          <Button size="sm" variant="outline" className="gap-1.5 rounded-lg" asChild>
                            <a href={p.linkedin} target="_blank" rel="noreferrer">
                              <ExternalLink size={14} /> LinkedIn
                            </a>
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1.5 rounded-lg opacity-50 cursor-not-allowed"
                            disabled
                          >
                            <ExternalLink size={14} /> LinkedIn
                          </Button>
                        )}
                      </span>
                      {p.facebookUrl ? (
                        <Button size="sm" variant="ghost" className="rounded-lg px-2 text-xs" asChild>
                          <a href={p.facebookUrl} target="_blank" rel="noreferrer">
                            FB
                          </a>
                        </Button>
                      ) : null}
                      {p.instagramUrl ? (
                        <Button size="sm" variant="ghost" className="rounded-lg px-2 text-xs" asChild>
                          <a href={p.instagramUrl} target="_blank" rel="noreferrer">
                            IG
                          </a>
                        </Button>
                      ) : null}
                    </div>

                    {p.aiSummary ? (
                      <p className="border-l-4 border-primary/50 py-0.5 pl-3 text-sm leading-relaxed text-foreground bg-muted/30 rounded-r-lg">
                        {p.aiSummary}
                      </p>
                    ) : null}

                    {(() => {
                      const profile = p.commercialProfile;
                      if (!profile) return null;
                      const products = profile.productsServices || [];
                      const sectors = profile.targetSectors || [];
                      const opps = profile.saleOpportunities || [];
                      if (!products.length && !sectors.length && !opps.length && !profile.companySizeEstimate) {
                        return null;
                      }
                      return (
                        <div className="grid gap-2 rounded-xl border border-border/60 bg-white p-3 text-xs sm:grid-cols-2">
                          {profile.companySizeEstimate ? (
                            <div>
                              <p className="font-semibold text-foreground">Taille estimée</p>
                              <p className="text-muted-foreground">{profile.companySizeEstimate}</p>
                            </div>
                          ) : null}
                          {profile.clienteleType && profile.clienteleType !== 'INCONNU' ? (
                            <div>
                              <p className="font-semibold text-foreground">Clientèle</p>
                              <p className="text-muted-foreground">{profile.clienteleType}</p>
                            </div>
                          ) : null}
                          {products.length ? (
                            <div className="sm:col-span-2">
                              <p className="font-semibold text-foreground">Produits & services</p>
                              <p className="text-muted-foreground">{products.join(' · ')}</p>
                            </div>
                          ) : null}
                          {sectors.length ? (
                            <div className="sm:col-span-2">
                              <p className="font-semibold text-foreground">Secteurs</p>
                              <p className="text-muted-foreground">{sectors.join(' · ')}</p>
                            </div>
                          ) : null}
                          {opps.length ? (
                            <div className="sm:col-span-2">
                              <p className="mb-1 font-semibold text-foreground">Opportunités détectées</p>
                              <ul className="list-disc space-y-0.5 pl-4 text-muted-foreground">
                                {opps.map((o) => (
                                  <li key={o}>{o}</li>
                                ))}
                              </ul>
                            </div>
                          ) : null}
                        </div>
                      );
                    })()}

                    {p.probableBusinessProblem ? (
                      <div className="rounded-lg bg-amber-50/80 border border-amber-200 px-3 py-2 text-xs">
                        <span className="font-semibold text-amber-900">Problème probable : </span>
                        {p.probableBusinessProblem}
                      </div>
                    ) : null}
                    {p.suggestedOffer ? (
                      <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs">
                        <span className="font-semibold text-primary">Offre adaptée : </span>
                        {p.suggestedOffer}
                      </div>
                    ) : null}
                    {p.commercialAngle ? (
                      <p className="text-xs text-muted-foreground">
                        <span className="font-semibold text-foreground">Angle : </span>
                        {p.commercialAngle}
                      </p>
                    ) : null}

                    {p.scoreReason ? (
                      <details className="group rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-xs">
                        <summary className="cursor-pointer font-medium text-foreground list-none flex items-center justify-between">
                          Pourquoi ce score ?
                          <span className="text-muted-foreground group-open:rotate-180 transition">▼</span>
                        </summary>
                        <pre className="mt-2 whitespace-pre-wrap font-sans text-muted-foreground leading-relaxed">{p.scoreReason}</pre>
                      </details>
                    ) : null}

                    <div className="flex flex-wrap gap-2 pt-1 border-t border-border/50">
                      <Button
                        size="sm"
                        disabled={ignored || inPipe || addPipeline.isPending}
                        onClick={() => addPipeline.mutate(p.id)}
                        className="gap-1.5 rounded-lg"
                      >
                        <KanbanSquare size={14} />
                        {inPipe ? t('prospectionIA.inOpportunitiesLabel') : t('prospectionIA.addToOpportunities')}
                      </Button>

                      {!channels.hasAnyChannel ? (
                        <p className="w-full text-xs text-muted-foreground py-1">
                          {CHANNEL_UNAVAILABLE_HINTS.none}
                        </p>
                      ) : (
                        <>
                          <span title={channels.canEmail ? undefined : CHANNEL_UNAVAILABLE_HINTS.email} className="inline-flex">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={ignored || !channels.canEmail || messageMutation.isPending}
                              className={cn('rounded-lg gap-1.5', !channels.canEmail && 'opacity-50 cursor-not-allowed')}
                              onClick={() =>
                                channels.canEmail &&
                                messageMutation.mutate({ id: p.id, messageType: 'FIRST_CONTACT', tone: 'commercial' })
                              }
                            >
                              <Mail size={14} /> Email IA
                            </Button>
                          </span>
                          <span title={channels.canLinkedIn ? undefined : CHANNEL_UNAVAILABLE_HINTS.linkedin} className="inline-flex">
                            <Button
                              size="sm"
                              variant="outline"
                              className={cn('rounded-lg', !channels.canLinkedIn && 'opacity-50 cursor-not-allowed')}
                              disabled={ignored || !channels.canLinkedIn || messageMutation.isPending}
                              onClick={() =>
                                channels.canLinkedIn &&
                                messageMutation.mutate({ id: p.id, messageType: 'LINKEDIN', tone: 'doux' })
                              }
                            >
                              Message LinkedIn
                            </Button>
                          </span>
                          <span title={channels.canWhatsApp ? undefined : CHANNEL_UNAVAILABLE_HINTS.whatsapp} className="inline-flex">
                            <Button
                              size="sm"
                              variant="outline"
                              className={cn('rounded-lg gap-1.5', !channels.canWhatsApp && 'opacity-50 cursor-not-allowed')}
                              disabled={ignored || !channels.canWhatsApp || messageMutation.isPending}
                              onClick={() =>
                                channels.canWhatsApp &&
                                messageMutation.mutate({ id: p.id, messageType: 'WHATSAPP', tone: 'commercial' })
                              }
                            >
                              <MessageCircle size={14} /> WhatsApp
                            </Button>
                          </span>
                        </>
                      )}

                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-lg gap-1.5"
                        disabled={ignored}
                        onClick={() => scheduleMutation.mutate({ id: p.id, dayOffset: 7 })}
                      >
                        <CalendarClock size={14} /> Relance J+7
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-lg gap-1.5"
                        disabled={ignored}
                        onClick={() => setTimeline({ open: true, id: p.id, name: p.companyName })}
                      >
                        <Clock size={14} /> Activité
                      </Button>
                      {p.contactId ? (
                        <Button size="sm" variant="secondary" className="rounded-lg gap-1.5" asChild>
                          <Link to={`/contacts/${p.contactId}`}>
                            <ExternalLink size={14} /> Voir la fiche complète
                          </Link>
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="secondary"
                          className="rounded-lg gap-1.5"
                          onClick={() =>
                            setFiche({
                              open: true,
                              prospect: p,
                            })
                          }
                        >
                          <ExternalLink size={14} /> Voir la fiche complète
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-muted-foreground rounded-lg"
                        disabled={ignored}
                        onClick={() => ignoreMutation.mutate(p.id)}
                      >
                        <Ban size={14} className="mr-1" />
                        Ignorer
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      )}

      <TimelineDialog
        prospectId={timeline.id}
        open={timeline.open}
        onOpenChange={(o) => setTimeline((t) => ({ ...t, open: o }))}
        companyName={timeline.name}
      />

      <Dialog open={preview.open} onOpenChange={(o) => setPreview((p) => ({ ...p, open: o }))}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{preview.title}</DialogTitle>
          </DialogHeader>
          {preview.disclaimer ? (
            <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2">{preview.disclaimer}</p>
          ) : null}
          {preview.signatureWarning ? (
            <p className="text-xs font-medium text-red-800 bg-red-50 border border-red-200 rounded-lg p-2">
              {preview.signatureWarning}
            </p>
          ) : null}
          <div className="rounded-lg border bg-muted/30 p-3 text-sm whitespace-pre-wrap max-h-[50vh] overflow-y-auto">{preview.body}</div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={copyPreview} className="gap-1.5">
              <Copy size={16} /> Copier
            </Button>
            <Button type="button" onClick={() => setPreview((x) => ({ ...x, open: false }))}>
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={fiche.open}
        onOpenChange={(o) => setFiche((f) => ({ ...f, open: o, prospect: o ? f.prospect : null }))}
      >
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{fiche.prospect?.companyName || 'Fiche commerciale'}</DialogTitle>
          </DialogHeader>
          {fiche.prospect ? (
            <div className="space-y-3 text-sm">
              <p>
                <span className="font-semibold">Activité : </span>
                {fiche.prospect.industry || '—'}
              </p>
              <p>
                <span className="font-semibold">Adresse : </span>
                {[fiche.prospect.city, fiche.prospect.country].filter(Boolean).join(', ') || '—'}
              </p>
              <p>
                <span className="font-semibold">Téléphone : </span>
                {fiche.prospect.phone || '—'}
              </p>
              <p>
                <span className="font-semibold">Site : </span>
                {fiche.prospect.website || '—'}
              </p>
              <p>
                <span className="font-semibold">Emails : </span>
                {[fiche.prospect.email, ...parseEmailList(fiche.prospect.detectedEmails)]
                  .filter(Boolean)
                  .join(', ') || '—'}
              </p>
              {fiche.prospect.aiSummary ? (
                <p>
                  <span className="font-semibold">Description : </span>
                  {fiche.prospect.aiSummary}
                </p>
              ) : null}
              {fiche.prospect.commercialProfile?.productsServices?.length ? (
                <p>
                  <span className="font-semibold">Produits & services : </span>
                  {fiche.prospect.commercialProfile.productsServices.join(' · ')}
                </p>
              ) : null}
              {fiche.prospect.commercialProfile?.companySizeEstimate ? (
                <p>
                  <span className="font-semibold">Taille estimée : </span>
                  {fiche.prospect.commercialProfile.companySizeEstimate}
                </p>
              ) : null}
              {fiche.prospect.commercialProfile?.targetSectors?.length ? (
                <p>
                  <span className="font-semibold">Secteurs : </span>
                  {fiche.prospect.commercialProfile.targetSectors.join(' · ')}
                </p>
              ) : null}
              <p>
                <span className="font-semibold">Score commercial : </span>
                {fiche.prospect.score}/100
              </p>
              {fiche.prospect.commercialProfile?.saleOpportunities?.length ? (
                <div>
                  <p className="font-semibold">Opportunités détectées</p>
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-muted-foreground">
                    {fiche.prospect.commercialProfile.saleOpportunities.map((o) => (
                      <li key={o}>{o}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {fiche.prospect.googleMapsUrl ? (
                <Button size="sm" variant="outline" asChild>
                  <a href={fiche.prospect.googleMapsUrl} target="_blank" rel="noreferrer">
                    Google Maps
                  </a>
                </Button>
              ) : null}
            </div>
          ) : null}
          <DialogFooter>
            <Button type="button" onClick={() => setFiche({ open: false, prospect: null })}>
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
