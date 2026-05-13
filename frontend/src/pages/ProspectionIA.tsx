import { useMemo, useState } from 'react';
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
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input, Label } from '@/components/ui/form-controls';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

type Potential = 'TRES_FORT' | 'MOYEN' | 'FAIBLE' | string | null;

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
      emoji: '🔥',
      cls: 'bg-gradient-to-r from-orange-500/20 to-amber-500/15 text-orange-900 border-orange-200/80',
    };
  if (p === 'MOYEN')
    return {
      text: 'Potentiel moyen',
      emoji: '🟡',
      cls: 'bg-violet-500/10 text-violet-900 border-violet-200/80',
    };
  if (p === 'FAIBLE')
    return { text: 'Faible potentiel', emoji: '❄️', cls: 'bg-slate-500/10 text-slate-800 border-slate-200/80' };
  return { text: 'À qualifier', emoji: '◆', cls: 'bg-muted text-muted-foreground border-border' };
}

function cardHeatClass(score: number) {
  if (score >= 72) return 'border-orange-400/70 shadow-md shadow-orange-500/10 hover:shadow-orange-500/20';
  if (score >= 48) return 'border-violet-300/80 shadow-md shadow-violet-500/10 hover:shadow-violet-500/15';
  return 'border-border/80 hover:border-muted-foreground/25';
}

function ScoreRing({ score }: { score: number }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  const pct = Math.min(100, Math.max(0, score)) / 100;
  const offset = c * (1 - pct);
  const stroke =
    score >= 72 ? 'stroke-orange-500' : score >= 48 ? 'stroke-violet-600' : 'stroke-slate-400';
  return (
    <svg width="76" height="76" viewBox="0 0 80 80" className="shrink-0" aria-hidden>
      <circle cx="40" cy="40" r={r} fill="none" className="stroke-muted/30" strokeWidth="7" />
      <circle
        cx="40"
        cy="40"
        r={r}
        fill="none"
        className={cn('transition-all duration-500', stroke)}
        strokeWidth="7"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={offset}
        transform="rotate(-90 40 40)"
      />
      <text x="40" y="44" textAnchor="middle" className="fill-foreground text-sm font-bold">
        {score}
      </text>
    </svg>
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
            <Clock size={18} className="text-violet-600" />
            Activité — {companyName}
          </DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <div className="flex justify-center py-8 text-muted-foreground text-sm">
            <Loader2 className="animate-spin h-6 w-6" />
          </div>
        ) : (
          <ul className="space-y-3 text-sm border-l-2 border-violet-200 pl-4 ml-1">
            {(data?.events || []).map((ev, i) => (
              <li key={`${ev.at}-${i}`} className="relative">
                <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-violet-500 ring-4 ring-white" />
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
  const qc = useQueryClient();
  const [sector, setSector] = useState('');
  const [country, setCountry] = useState('Tunisie');
  const [city, setCity] = useState('');
  const [companySize, setCompanySize] = useState('');
  const [keywords, setKeywords] = useState('');
  const [results, setResults] = useState<AiProspectRow[]>([]);
  const [fromCache, setFromCache] = useState(false);
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
  }>({ open: false, title: '', body: '' });

  const filtered = useMemo(() => applyFilters(results, filters), [results, filters]);

  const { data: dash } = useQuery<DashboardPayload>({
    queryKey: ['prospecting-dashboard'],
    queryFn: () => api.get('/prospecting/dashboard').then((r) => r.data),
    staleTime: 45_000,
  });

  const searchMutation = useMutation({
    mutationFn: () =>
      api
        .post('/prospecting/search', {
          sector: sector || undefined,
          country: country || undefined,
          city: city || undefined,
          companySize: companySize || undefined,
          keywords: keywords || undefined,
        })
        .then((r) => r.data as SearchResponse),
    onSuccess: (data) => {
      setResults(data.prospects || []);
      setFromCache(Boolean(data.fromCache));
      void qc.invalidateQueries({ queryKey: ['prospecting-dashboard'] });
    },
    onError: (e: { response?: { data?: { error?: string } }; message?: string }) => {
      window.alert(e?.response?.data?.error || e?.message || 'Erreur lors de la recherche');
    },
  });

  const addPipeline = useMutation({
    mutationFn: (id: string) => api.post(`/prospecting/prospects/${id}/add-to-pipeline`).then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['prospecting-dashboard'] });
      void qc.invalidateQueries({ queryKey: ['leads'] });
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

  const messageMutation = useMutation({
    mutationFn: (args: { id: string; messageType: string; tone?: string }) =>
      api.post(`/prospecting/prospects/${args.id}/generate-message`, args).then((r) => r.data),
    onSuccess: (data: { body: string; disclaimer?: string; messageType?: string }) => {
      setPreview({
        open: true,
        title: 'Aperçu du message (validation humaine)',
        body: data.body,
        disclaimer: data.disclaimer,
      });
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
    <div className="mx-auto max-w-6xl space-y-8 pb-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-serif text-3xl md:text-4xl font-bold tracking-tight flex items-center gap-2">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-500/25">
              <Sparkles className="h-5 w-5" strokeWidth={2.2} />
            </span>
            Prospection IA
          </h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-xl">
            Recherche ciblée, enrichissement web automatique, scoring et angles commerciaux — copilote premium pour
            équipes PME. Toujours valider avant envoi.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/leads">
            <Button variant="outline" size="sm">
              Prospects (Leads)
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="border-violet-200/60 bg-gradient-to-br from-violet-50/80 to-white shadow-sm">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Trouvés / qualifiés</p>
              <p className="text-2xl font-bold tabular-nums">{dash.prospectsFound}</p>
            </CardContent>
          </Card>
          <Card className="border-orange-200/60 shadow-sm">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Flame size={14} className="text-orange-500" /> Leads chauds
              </p>
              <p className="text-2xl font-bold tabular-nums">{dash.hotLeads}</p>
            </CardContent>
          </Card>
          <Card className="shadow-sm">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Dans le pipeline</p>
              <p className="text-2xl font-bold tabular-nums">{dash.inPipeline}</p>
            </CardContent>
          </Card>
          <Card className="shadow-sm">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Leads source IA</p>
              <p className="text-2xl font-bold tabular-nums">{dash.opportunitiesFromAi}</p>
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

      <Card className="overflow-hidden border-border/70 shadow-md">
        <div className="h-1 w-full bg-gradient-to-r from-violet-500 via-indigo-500 to-sky-500" />
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Search className="text-violet-600" size={20} />
            Recherche prospects
          </CardTitle>
          <p className="text-xs text-muted-foreground font-normal">
            Les résultats identiques sont mis en cache 7 jours (moins d&apos;appels Google). Les sites sont analysés
            automatiquement pour enrichir la fiche.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>Secteur d&apos;activité</Label>
              <Input value={sector} onChange={(e) => setSector(e.target.value)} placeholder="ex. BTP, agroalimentaire…" />
            </div>
            <div className="space-y-1.5">
              <Label>Pays</Label>
              <Input value={country} onChange={(e) => setCountry(e.target.value)} placeholder="Tunisie" />
            </div>
            <div className="space-y-1.5">
              <Label>Ville</Label>
              <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Tunis, Casablanca…" />
            </div>
            <div className="space-y-1.5">
              <Label>Taille entreprise</Label>
              <Input value={companySize} onChange={(e) => setCompanySize(e.target.value)} placeholder="11-50, 50-200…" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Mots-clés</Label>
              <Input
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                placeholder="ex. architecture Tunisie, bureaux d’études, industriels…"
              />
            </div>
          </div>
          <Button
            size="lg"
            className={cn(
              'w-full sm:w-auto min-w-[220px] gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-500/30 transition-transform hover:scale-[1.01] active:scale-[0.99]',
              searchMutation.isPending && 'opacity-90'
            )}
            disabled={searchMutation.isPending}
            onClick={() => searchMutation.mutate()}
          >
            {searchMutation.isPending ? (
              <>
                <Loader2 className="animate-spin" size={20} /> Recherche en cours…
              </>
            ) : (
              <>
                <Sparkles size={20} /> Trouver prospects IA
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {results.length > 0 && (
        <section className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              <Filter size={16} />
              Résultats ({filtered.length}/{results.length})
            </h2>
            {fromCache ? (
              <span className="text-xs rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-900">
                Liste depuis cache (économie API)
              </span>
            ) : null}
          </div>

          <Card className="border-dashed border-violet-200/80 bg-violet-50/30">
            <CardContent className="p-4 space-y-3">
              <p className="text-xs font-medium text-violet-900">Filtres avancés (session courante)</p>
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl">
                <div className="space-y-1">
                  <Label className="text-xs">Filtrer secteur (libre)</Label>
                  <Input
                    placeholder="ex. BTP"
                    value={filters.sector}
                    onChange={(e) => setFilters((f) => ({ ...f, sector: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Filtrer ville</Label>
                  <Input
                    placeholder="ex. Tunis"
                    value={filters.city}
                    onChange={(e) => setFilters((f) => ({ ...f, city: e.target.value }))}
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

              return (
                <Card
                  key={p.id}
                  className={cn(
                    'border-2 bg-card/95 backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5',
                    cardHeatClass(p.score),
                    ignored && 'opacity-50 pointer-events-none'
                  )}
                >
                  <CardContent className="p-5 space-y-4">
                    <div className="flex gap-4">
                      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl border border-border/60 bg-muted/40 shadow-inner">
                        {p.faviconUrl ? (
                          <img src={p.faviconUrl} alt="" className="h-full w-full object-contain p-1.5" loading="lazy" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                            <Building2 size={26} />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-semibold text-lg leading-tight">{p.companyName}</p>
                            {p.websiteTitle ? (
                              <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{p.websiteTitle}</p>
                            ) : null}
                            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                              <Building2 size={12} />
                              {(p.industry || '—') + (p.city ? ` · ${p.city}` : '') + (p.country ? `, ${p.country}` : '')}
                            </p>
                          </div>
                          <span
                            className={cn(
                              'shrink-0 inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium',
                              pot.cls
                            )}
                          >
                            {pot.emoji} {pot.text}
                          </span>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {p.digitalPresenceLevel ? (
                            <span className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                              Digital {p.digitalPresenceLevel}
                            </span>
                          ) : null}
                          {p.seoScore != null ? (
                            <span className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                              SEO {p.seoScore}/100
                            </span>
                          ) : null}
                          {p.hasSsl ? (
                            <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                              HTTPS
                            </span>
                          ) : null}
                          {p.hasResponsiveWebsite ? (
                            <span className="rounded-md bg-sky-500/10 px-2 py-0.5 text-[10px] font-semibold text-sky-900">
                              Mobile
                            </span>
                          ) : null}
                          {techs.map((t) => (
                            <span key={t} className="rounded-md border border-border/60 px-2 py-0.5 text-[10px] text-foreground/80">
                              {t}
                            </span>
                          ))}
                        </div>
                      </div>
                      <ScoreRing score={p.score} />
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {tel ? (
                        <Button size="sm" variant="outline" className="gap-1 rounded-full" asChild>
                          <a href={`tel:${tel}`}>
                            <Phone size={14} /> Appeler
                          </a>
                        </Button>
                      ) : null}
                      {p.website ? (
                        <Button size="sm" variant="outline" className="gap-1 rounded-full" asChild>
                          <a href={p.website} target="_blank" rel="noreferrer">
                            <Globe size={14} /> Site web
                          </a>
                        </Button>
                      ) : null}
                      {p.linkedin ? (
                        <Button size="sm" variant="outline" className="gap-1 rounded-full" asChild>
                          <a href={p.linkedin} target="_blank" rel="noreferrer">
                            <ExternalLink size={14} /> LinkedIn
                          </a>
                        </Button>
                      ) : null}
                      {p.facebookUrl ? (
                        <Button size="sm" variant="ghost" className="rounded-full px-2 text-xs" asChild>
                          <a href={p.facebookUrl} target="_blank" rel="noreferrer">
                            FB
                          </a>
                        </Button>
                      ) : null}
                      {p.instagramUrl ? (
                        <Button size="sm" variant="ghost" className="rounded-full px-2 text-xs" asChild>
                          <a href={p.instagramUrl} target="_blank" rel="noreferrer">
                            IG
                          </a>
                        </Button>
                      ) : null}
                      {mainEmail ? (
                        <Button size="sm" variant="secondary" className="gap-1 rounded-full text-xs font-normal" asChild>
                          <a href={`mailto:${mainEmail}`}>
                            <Mail size={14} /> {mainEmail}
                          </a>
                        </Button>
                      ) : null}
                    </div>

                    {p.aiSummary ? (
                      <p className="text-sm leading-relaxed text-foreground border-l-4 border-violet-400/80 pl-3 py-0.5">
                        {p.aiSummary}
                      </p>
                    ) : null}

                    {p.probableBusinessProblem ? (
                      <div className="rounded-lg bg-amber-50/80 border border-amber-100 px-3 py-2 text-xs">
                        <span className="font-semibold text-amber-950">Problème probable : </span>
                        {p.probableBusinessProblem}
                      </div>
                    ) : null}
                    {p.suggestedOffer ? (
                      <div className="rounded-lg bg-violet-50/80 border border-violet-100 px-3 py-2 text-xs">
                        <span className="font-semibold text-violet-950">Offre adaptée : </span>
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
                        className="gap-1 rounded-full"
                      >
                        <KanbanSquare size={14} />
                        {inPipe ? 'Dans le pipeline' : 'Ajouter au pipeline'}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={ignored}
                        className="rounded-full gap-1"
                        onClick={() => messageMutation.mutate({ id: p.id, messageType: 'FIRST_CONTACT', tone: 'commercial' })}
                      >
                        <Mail size={14} /> Email IA
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-full"
                        disabled={ignored}
                        onClick={() => messageMutation.mutate({ id: p.id, messageType: 'LINKEDIN', tone: 'doux' })}
                      >
                        Message LinkedIn
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-full gap-1"
                        disabled={ignored}
                        onClick={() => messageMutation.mutate({ id: p.id, messageType: 'WHATSAPP', tone: 'commercial' })}
                      >
                        <MessageCircle size={14} /> WhatsApp
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-full gap-1"
                        disabled={ignored}
                        onClick={() => scheduleMutation.mutate({ id: p.id, dayOffset: 7 })}
                      >
                        <CalendarClock size={14} /> Relance J+7
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-full gap-1"
                        disabled={ignored}
                        onClick={() => setTimeline({ open: true, id: p.id, name: p.companyName })}
                      >
                        <Clock size={14} /> Activité
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-muted-foreground rounded-full"
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
    </div>
  );
}
