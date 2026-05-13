import { useState } from 'react';
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
  Link2,
  Ban,
  KanbanSquare,
  Bot,
  AlertTriangle,
} from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input, Label } from '@/components/ui/form-controls';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

type Potential = 'TRES_FORT' | 'MOYEN' | 'FAIBLE' | string | null;

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

function potentialLabel(p: Potential | undefined) {
  if (p === 'TRES_FORT') return { text: 'Très fort potentiel', emoji: '🔥', cls: 'bg-orange-500/15 text-orange-800 border-orange-200' };
  if (p === 'MOYEN') return { text: 'Potentiel moyen', emoji: '🟡', cls: 'bg-amber-500/15 text-amber-900 border-amber-200' };
  if (p === 'FAIBLE') return { text: 'Faible potentiel', emoji: '❄️', cls: 'bg-sky-500/10 text-sky-900 border-sky-200' };
  return { text: 'À qualifier', emoji: '◆', cls: 'bg-muted text-muted-foreground border-border' };
}

export function ProspectionIA() {
  const qc = useQueryClient();
  const [sector, setSector] = useState('');
  const [country, setCountry] = useState('Tunisie');
  const [city, setCity] = useState('');
  const [companySize, setCompanySize] = useState('');
  const [keywords, setKeywords] = useState('');
  const [results, setResults] = useState<AiProspectRow[]>([]);
  const [preview, setPreview] = useState<{
    open: boolean;
    title: string;
    body: string;
    disclaimer?: string;
  }>({ open: false, title: '', body: '' });

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
        .then((r) => r.data as { prospects: AiProspectRow[]; providerUsed: string }),
    onSuccess: (data) => {
      setResults(data.prospects || []);
      void qc.invalidateQueries({ queryKey: ['prospecting-dashboard'] });
    },
    onError: (e: any) => {
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
            Trouvez des entreprises cibles, qualifiez-les, générez des messages personnalisés — puis ajoutez au pipeline en un clic.
            Toujours valider le contenu avant envoi.
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
            Mots-clés + zone géographique suffisent pour lancer une première vague (démo sans API payante).
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
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Résultats</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {results.map((p) => {
              const pot = potentialLabel(p.potentialLevel);
              const ignored = p.status === 'IGNORED';
              const inPipe = Boolean(p.leadId) || p.status === 'IN_PIPELINE';
              return (
                <Card
                  key={p.id}
                  className={cn(
                    'border-border/70 shadow-sm transition-all hover:shadow-md',
                    ignored && 'opacity-50'
                  )}
                >
                  <CardContent className="p-5 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-lg leading-tight truncate">{p.companyName}</p>
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

                    <div className="flex flex-wrap gap-2 text-xs">
                      {p.website && (
                        <a
                          href={p.website}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-foreground hover:bg-muted/80"
                        >
                          <Link2 size={12} /> Site web
                        </a>
                      )}
                      {p.linkedin && (
                        <a
                          href={p.linkedin}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-foreground hover:bg-muted/80"
                        >
                          LinkedIn
                        </a>
                      )}
                      <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 text-violet-800 px-2 py-1 font-semibold">
                        Score IA {p.score}
                        {p.interestProbability != null ? ` · ~${p.interestProbability}% intérêt` : ''}
                      </span>
                    </div>

                    {p.aiSummary && (
                      <p className="text-sm text-foreground/90 leading-relaxed border-l-2 border-violet-200 pl-3">{p.aiSummary}</p>
                    )}
                    {p.commercialAngle && (
                      <p className="text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">Angle conseillé : </span>
                        {p.commercialAngle}
                      </p>
                    )}

                    <div className="flex flex-wrap gap-2 pt-1">
                      <Button
                        size="sm"
                        disabled={ignored || inPipe || addPipeline.isPending}
                        onClick={() => addPipeline.mutate(p.id)}
                        className="gap-1"
                      >
                        <KanbanSquare size={14} />
                        {inPipe ? 'Dans le pipeline' : 'Ajouter au pipeline'}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={ignored}
                        onClick={() => messageMutation.mutate({ id: p.id, messageType: 'FIRST_CONTACT', tone: 'commercial' })}
                      >
                        <Mail size={14} className="mr-1" />
                        Email IA
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={ignored}
                        onClick={() => messageMutation.mutate({ id: p.id, messageType: 'LINKEDIN', tone: 'doux' })}
                      >
                        LinkedIn
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={ignored}
                        onClick={() => messageMutation.mutate({ id: p.id, messageType: 'WHATSAPP', tone: 'commercial' })}
                      >
                        <MessageCircle size={14} className="mr-1" />
                        WhatsApp
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={ignored}
                        onClick={() => scheduleMutation.mutate({ id: p.id, dayOffset: 7 })}
                      >
                        <CalendarClock size={14} className="mr-1" />
                        Relance J+7
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-muted-foreground"
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

      <Dialog open={preview.open} onOpenChange={(o) => setPreview((p) => ({ ...p, open: o }))}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{preview.title}</DialogTitle>
          </DialogHeader>
          {preview.disclaimer && <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2">{preview.disclaimer}</p>}
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
