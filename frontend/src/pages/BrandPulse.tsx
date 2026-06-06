import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Check,
  Copy,
  FileText,
  Loader2,
  Megaphone,
  RefreshCw,
  Sparkles,
  X,
} from 'lucide-react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input, Label, Textarea, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/form-controls';
import { cn } from '@/lib/utils';

type ChannelRow = {
  channel: string;
  score: number;
  weight: number;
  details?: { comingSoon?: boolean; interpretation?: string };
  computedAt?: string;
};

type BrandArticle = {
  id: string;
  status: string;
  format: string;
  title: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  contentMarkdown: string | null;
  estimatedSeoScore: number | null;
  estimatedImpact: number | null;
};

function scoreColor(score: number): string {
  if (score >= 80) return 'text-emerald-600 bg-emerald-50';
  if (score >= 60) return 'text-amber-600 bg-amber-50';
  if (score >= 40) return 'text-orange-600 bg-orange-50';
  return 'text-red-600 bg-red-50';
}

const CHANNEL_LABELS: Record<string, string> = {
  SEO: 'SEO & Site Web',
  SOCIAL: 'Réseaux sociaux',
  REVIEWS: 'Avis clients',
  PRESS: 'Presse & blogs',
  LLM: 'LLMs / IA',
  WEBSITE: 'Site web global',
  GLOBAL: 'Score global',
};

function OnboardingWizard({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(0);
  const [brandName, setBrandName] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [sector, setSector] = useState('');
  const [competitorName, setCompetitorName] = useState('');
  const [keywords, setKeywords] = useState('');
  const [tone, setTone] = useState('professionnel');

  const saveMutation = useMutation({
    mutationFn: () =>
      api.put('/brand-pulse/profile', {
        brandName,
        websiteUrl,
        sector: sector || null,
        competitorName: competitorName || null,
        brandKeywords: keywords.split(',').map((k) => k.trim()).filter(Boolean),
        editorialTone: tone,
        onboardingDone: false,
      }),
  });

  const auditMutation = useMutation({
    mutationFn: () => api.post('/brand-pulse/audit'),
    onSuccess: () => onComplete(),
  });

  const steps = ['Marque', 'Secteur', 'Concurrent', 'Ton', 'Audit'];

  const canNext =
    (step === 0 && brandName.length >= 2 && websiteUrl.length >= 4) ||
    step === 1 ||
    step === 2 ||
    step === 3;

  const handleFinish = async () => {
    await saveMutation.mutateAsync();
    await auditMutation.mutateAsync();
  };

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Configurer BrandPulse AI</CardTitle>
        <p className="text-sm text-muted-foreground">Étape {step + 1} / {steps.length} — {steps[step]}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {step === 0 && (
          <>
            <div className="space-y-1.5">
              <Label>Nom de la marque *</Label>
              <Input value={brandName} onChange={(e) => setBrandName(e.target.value)} placeholder="CIBLIX" />
            </div>
            <div className="space-y-1.5">
              <Label>URL du site web *</Label>
              <Input value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} placeholder="https://ciblix.com" />
            </div>
          </>
        )}
        {step === 1 && (
          <>
            <div className="space-y-1.5">
              <Label>Secteur d&apos;activité</Label>
              <Input value={sector} onChange={(e) => setSector(e.target.value)} placeholder="CRM B2B, industrie..." />
            </div>
            <div className="space-y-1.5">
              <Label>Mots-clés marque (séparés par des virgules)</Label>
              <Input value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="crm, ventes, ia" />
            </div>
          </>
        )}
        {step === 2 && (
          <div className="space-y-1.5">
            <Label>Concurrent principal</Label>
            <Input value={competitorName} onChange={(e) => setCompetitorName(e.target.value)} placeholder="Nom du concurrent" />
          </div>
        )}
        {step === 3 && (
          <div className="space-y-1.5">
            <Label>Ton éditorial</Label>
            <Select value={tone} onValueChange={setTone}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="professionnel">Professionnel</SelectItem>
                <SelectItem value="expert">Expert</SelectItem>
                <SelectItem value="accessible">Accessible</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
        {step === 4 && (
          <p className="text-sm text-muted-foreground">
            Lancez le premier audit SEO. Les autres canaux seront estimés puis connectés en Phase 2.
          </p>
        )}
        <div className="flex justify-between pt-2">
          <Button variant="outline" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>Retour</Button>
          {step < 4 ? (
            <Button disabled={!canNext} onClick={() => setStep((s) => s + 1)}>Suivant</Button>
          ) : (
            <Button
              className="bg-rose-600 hover:bg-rose-700"
              disabled={auditMutation.isPending || saveMutation.isPending}
              onClick={() => void handleFinish()}
            >
              {(auditMutation.isPending || saveMutation.isPending) && <Loader2 size={16} className="animate-spin mr-2" />}
              Lancer l&apos;audit
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function BrandPulse() {
  const queryClient = useQueryClient();
  const [reviewArticle, setReviewArticle] = useState<BrandArticle | null>(null);
  const [editContent, setEditContent] = useState('');

  const { data: dashboard, isLoading } = useQuery({
    queryKey: ['brand-pulse-dashboard'],
    queryFn: () => api.get('/brand-pulse/dashboard').then((r) => r.data),
  });

  const auditMutation = useMutation({
    mutationFn: () => api.post('/brand-pulse/audit'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['brand-pulse-dashboard'] }),
  });

  const topicsMutation = useMutation({
    mutationFn: () => api.post('/brand-pulse/topics/generate'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['brand-pulse-dashboard'] }),
  });

  const generateMutation = useMutation({
    mutationFn: (id: string) => api.post(`/brand-pulse/articles/${id}/generate`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['brand-pulse-dashboard'] }),
  });

  const reviewMutation = useMutation({
    mutationFn: ({ id, action, contentMarkdown }: { id: string; action: 'approve' | 'reject' | 'edit'; contentMarkdown?: string }) =>
      api.patch(`/brand-pulse/articles/${id}/review`, {
        action,
        contentMarkdown,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brand-pulse-dashboard'] });
      setReviewArticle(null);
    },
  });

  const profile = dashboard?.profile;
  const channels: ChannelRow[] = dashboard?.channels || [];
  const articles: BrandArticle[] = dashboard?.articles || [];
  const globalScore = dashboard?.globalScore as number | null;
  const recommendations = dashboard?.recommendations || [];
  const alerts = dashboard?.alerts || [];

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-rose-500" size={32} />
      </div>
    );
  }

  if (!profile?.onboardingDone) {
    return (
      <div className="space-y-6">
        <Header />
        <OnboardingWizard onComplete={() => queryClient.invalidateQueries({ queryKey: ['brand-pulse-dashboard'] })} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Header
        actions={
          <>
            <Button variant="outline" size="sm" disabled={auditMutation.isPending} onClick={() => auditMutation.mutate()}>
              <RefreshCw size={14} className="mr-1" /> Ré-auditer
            </Button>
            <Button size="sm" className="bg-rose-600 hover:bg-rose-700" disabled={topicsMutation.isPending} onClick={() => topicsMutation.mutate()}>
              <Sparkles size={14} className="mr-1" /> Proposer 3 sujets
            </Button>
          </>
        }
      />

      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.slice(0, 3).map((a: { id: string; message: string; severity: string }) => (
            <div key={a.id} className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm">
              <AlertTriangle size={16} className="text-amber-600 mt-0.5 shrink-0" />
              {a.message}
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Score global marque</CardTitle>
          </CardHeader>
          <CardContent>
            <p className={cn('text-4xl font-bold tabular-nums', globalScore != null ? scoreColor(globalScore).split(' ')[0] : '')}>
              {globalScore ?? '—'}<span className="text-lg text-muted-foreground">/100</span>
            </p>
            <p className="text-xs text-muted-foreground mt-1">{profile.brandName}</p>
          </CardContent>
        </Card>
        {channels.filter((c) => c.channel !== 'GLOBAL').map((ch) => (
          <Card key={ch.channel}>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                {CHANNEL_LABELS[ch.channel] || ch.channel}
                {ch.details?.comingSoon && (
                  <span className="rounded bg-slate-100 px-1 text-[9px] text-slate-500">bientôt</span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className={cn('text-2xl font-bold', scoreColor(ch.score).split(' ')[0])}>{ch.score}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 size={18} /> Recommandations prioritaires
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {recommendations.length === 0 && (
              <p className="text-sm text-muted-foreground">Lancez un audit pour obtenir des recommandations.</p>
            )}
            {recommendations.map((r: { id: string; action: string; estimatedImpact: number; channel: string }) => (
              <div key={r.id} className="rounded-lg border p-3 text-sm">
                <p>{r.action}</p>
                <p className="text-xs text-muted-foreground mt-1">+{r.estimatedImpact} pts estimés — {r.channel}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Activity size={18} /> Pipeline blog
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 text-sm mb-4">
              <span>Proposés: <strong>{dashboard?.pipeline?.proposed ?? 0}</strong></span>
              <span>À valider: <strong>{dashboard?.pipeline?.pendingReview ?? 0}</strong></span>
              <span>Publiés: <strong>{dashboard?.pipeline?.published ?? 0}</strong></span>
            </div>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {articles.map((art) => (
                <div key={art.id} className="flex items-center justify-between gap-2 rounded-lg border p-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{art.title || 'Sans titre'}</p>
                    <p className="text-xs text-muted-foreground">{art.format} — {art.status}</p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    {art.status === 'PROPOSED' && (
                      <Button size="sm" variant="outline" disabled={generateMutation.isPending} onClick={() => generateMutation.mutate(art.id)}>
                        Rédiger
                      </Button>
                    )}
                    {art.status === 'PENDING_REVIEW' && (
                      <Button size="sm" onClick={() => { setReviewArticle(art); setEditContent(art.contentMarkdown || ''); }}>
                        Relire
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base text-muted-foreground">Bientôt — Phases 4 à 7</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground grid sm:grid-cols-3 gap-2">
          <p>Publication CMS (WordPress, Ghost)</p>
          <p>Benchmark concurrent & radar</p>
          <p>Rapport PDF mensuel</p>
        </CardContent>
      </Card>

      {reviewArticle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <Card className="max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">{reviewArticle.title}</CardTitle>
              <button type="button" onClick={() => setReviewArticle(null)}><X size={18} /></button>
            </CardHeader>
            <CardContent className="overflow-y-auto flex-1 space-y-3">
              {reviewArticle.metaDescription && (
                <p className="text-xs text-muted-foreground">Meta: {reviewArticle.metaDescription}</p>
              )}
              {reviewArticle.estimatedSeoScore != null && (
                <p className="text-sm">Score SEO estimé: <strong>{reviewArticle.estimatedSeoScore}/100</strong></p>
              )}
              <Textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} rows={16} className="font-mono text-xs" />
            </CardContent>
            <div className="flex flex-wrap gap-2 p-4 border-t">
              <Button variant="outline" className="gap-1" onClick={() => navigator.clipboard.writeText(editContent)}>
                <Copy size={14} /> Copier
              </Button>
              <Button variant="destructive" onClick={() => reviewMutation.mutate({ id: reviewArticle.id, action: 'reject' })}>Rejeter</Button>
              <Button variant="outline" onClick={() => reviewMutation.mutate({ id: reviewArticle.id, action: 'edit', contentMarkdown: editContent })}>Enregistrer</Button>
              <Button className="bg-emerald-600 hover:bg-emerald-700 gap-1" onClick={() => reviewMutation.mutate({ id: reviewArticle.id, action: 'approve', contentMarkdown: editContent })}>
                <Check size={14} /> Approuver
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

function Header({ actions }: { actions?: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500 to-pink-600 text-white">
          <Megaphone size={24} />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">BrandPulse AI</h1>
          <p className="text-sm text-muted-foreground">
            Score marque, audit SEO et pipeline blog avec validation
          </p>
          <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold uppercase text-rose-700 ring-1 ring-rose-200">
            Exclusif plan Professionnel
          </span>
        </div>
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
