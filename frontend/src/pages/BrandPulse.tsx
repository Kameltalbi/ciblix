import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Check,
  Copy,
  Globe,
  Link2,
  Loader2,
  Megaphone,
  RefreshCw,
  Sparkles,
  Upload,
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
  slug: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  contentMarkdown: string | null;
  estimatedSeoScore: number | null;
  estimatedImpact: number | null;
};

function slugify(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function downloadMarkdown(article: BrandArticle, content: string): void {
  const slug = article.slug || slugify(article.title || 'article');
  const frontmatter = [
    '---',
    `title: "${(article.title || '').replace(/"/g, '\\"')}"`,
    article.metaDescription ? `description: "${article.metaDescription.replace(/"/g, '\\"')}"` : null,
    `date: ${new Date().toISOString().slice(0, 10)}`,
    '---',
    '',
  ].filter(Boolean).join('\n');
  const blob = new Blob([frontmatter + content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${slug}.md`;
  a.click();
  URL.revokeObjectURL(url);
}

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
  const [competitorUrl, setCompetitorUrl] = useState('');
  const [keywords, setKeywords] = useState('');
  const [tone, setTone] = useState('professionnel');

  const saveMutation = useMutation({
    mutationFn: () =>
      api.put('/brand-pulse/profile', {
        brandName,
        websiteUrl,
        sector: sector || null,
        competitorName: competitorName || null,
        competitorUrl: competitorUrl || null,
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
          <>
            <div className="space-y-1.5">
              <Label>Concurrent principal</Label>
              <Input value={competitorName} onChange={(e) => setCompetitorName(e.target.value)} placeholder="Nom du concurrent" />
            </div>
            <div className="space-y-1.5">
              <Label>URL du concurrent (benchmark Phase 6)</Label>
              <Input value={competitorUrl} onChange={(e) => setCompetitorUrl(e.target.value)} placeholder="https://concurrent.com" />
            </div>
          </>
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
            Lancez le premier audit SEO. Les canaux social et avis pourront être connectés ensuite.
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
  const [reviewsQuery, setReviewsQuery] = useState('');
  const [cmsPlatform, setCmsPlatform] = useState('WORDPRESS');
  const [cmsSiteUrl, setCmsSiteUrl] = useState('');
  const [cmsUser, setCmsUser] = useState('');
  const [cmsPassword, setCmsPassword] = useState('');
  const [auditUrls, setAuditUrls] = useState('');
  const [scheduleArticleId, setScheduleArticleId] = useState<string | null>(null);
  const [scheduleDate, setScheduleDate] = useState('');
  const [apiKeyLabel, setApiKeyLabel] = useState('');
  const [createdApiKey, setCreatedApiKey] = useState<string | null>(null);
  const [newBrandName, setNewBrandName] = useState('');
  const [newBrandUrl, setNewBrandUrl] = useState('');

  const { data: dashboard, isLoading } = useQuery({
    queryKey: ['brand-pulse-dashboard'],
    queryFn: () => api.get('/brand-pulse/dashboard').then((r) => r.data),
  });

  const { data: brandsData } = useQuery({
    queryKey: ['brand-pulse-brands'],
    queryFn: () => api.get('/brand-pulse/brands').then((r) => r.data),
    enabled: !!dashboard?.profile?.onboardingDone,
  });

  const { data: apiKeysData, refetch: refetchApiKeys } = useQuery({
    queryKey: ['brand-pulse-api-keys'],
    queryFn: () => api.get('/brand-pulse/api-keys').then((r) => r.data),
    enabled: !!dashboard?.profile?.onboardingDone,
  });

  const auditMutation = useMutation({
    mutationFn: () => api.post('/brand-pulse/audit'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['brand-pulse-dashboard'] }),
  });

  const [topicsError, setTopicsError] = useState<string | null>(null);
  const [topicsSuccess, setTopicsSuccess] = useState<string | null>(null);

  const topicsMutation = useMutation({
    mutationFn: () => api.post('/brand-pulse/topics/generate'),
    onSuccess: (res) => {
      setTopicsError(null);
      setTopicsSuccess((res.data as { message?: string }).message || '3 sujets ajoutés au pipeline.');
      queryClient.invalidateQueries({ queryKey: ['brand-pulse-dashboard'] });
    },
    onError: (err: { response?: { data?: { error?: string; message?: string } } }) => {
      setTopicsSuccess(null);
      const data = err.response?.data;
      const msg = data?.message || data?.error || 'Impossible de générer les sujets (quota, paiement ou clé OpenAI).';
      setTopicsError(msg);
    },
  });

  const generateMutation = useMutation({
    mutationFn: (id: string) => api.post(`/brand-pulse/articles/${id}/generate`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['brand-pulse-dashboard'] }),
  });

  const channelSyncMutation = useMutation({
    mutationFn: () => api.post('/brand-pulse/channels/sync'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['brand-pulse-dashboard'] }),
  });

  const socialDetectMutation = useMutation({
    mutationFn: () => api.post('/brand-pulse/channels/social/detect'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['brand-pulse-dashboard'] }),
  });

  const reviewsConnectMutation = useMutation({
    mutationFn: () => api.put('/brand-pulse/channels/reviews', { searchQuery: reviewsQuery }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['brand-pulse-dashboard'] }),
  });

  const buildCmsConfig = () => {
    switch (cmsPlatform) {
      case 'MANUAL':
        return { websiteUrl: cmsSiteUrl || dashboard?.profile?.websiteUrl || '', note: 'Publication manuelle' };
      case 'GHOST':
        return { adminApiUrl: cmsSiteUrl, adminApiKey: cmsPassword };
      case 'WEBFLOW':
        return { apiToken: cmsPassword, collectionId: cmsUser };
      case 'SHOPIFY':
        return { shopDomain: cmsSiteUrl, accessToken: cmsPassword, blogId: cmsUser };
      case 'WIX':
        return { apiKey: cmsPassword, siteId: cmsUser };
      default:
        return { siteUrl: cmsSiteUrl, username: cmsUser, appPassword: cmsPassword };
    }
  };

  const cmsConnectMutation = useMutation({
    mutationFn: () =>
      api.post('/brand-pulse/cms-connections', {
        platform: cmsPlatform,
        config: buildCmsConfig(),
        defaultStatus: 'draft',
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['brand-pulse-dashboard'] }),
  });

  const cmsTestMutation = useMutation({
    mutationFn: (id: string) => api.post(`/brand-pulse/cms-connections/${id}/test`),
  });

  const cmsDeleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/brand-pulse/cms-connections/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['brand-pulse-dashboard'] }),
  });

  const scheduleMutation = useMutation({
    mutationFn: ({ id, scheduledAt }: { id: string; scheduledAt: string }) =>
      api.patch(`/brand-pulse/articles/${id}/schedule`, { scheduledAt: new Date(scheduledAt).toISOString() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brand-pulse-dashboard'] });
      setScheduleArticleId(null);
      setScheduleDate('');
    },
  });

  const apiKeyMutation = useMutation({
    mutationFn: () => api.post('/brand-pulse/api-keys', { label: apiKeyLabel || undefined }),
    onSuccess: (res) => {
      setCreatedApiKey(res.data.key as string);
      setApiKeyLabel('');
      void refetchApiKeys();
    },
  });

  const apiKeyDeleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/brand-pulse/api-keys/${id}`),
    onSuccess: () => void refetchApiKeys(),
  });

  const createBrandMutation = useMutation({
    mutationFn: () =>
      api.post('/brand-pulse/brands', {
        brandName: newBrandName,
        websiteUrl: newBrandUrl,
        brandKeywords: [],
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brand-pulse-brands'] });
      setNewBrandName('');
      setNewBrandUrl('');
    },
  });

  const publishMutation = useMutation({
    mutationFn: (id: string) => api.post(`/brand-pulse/articles/${id}/publish`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['brand-pulse-dashboard'] }),
  });

  const benchmarkMutation = useMutation({
    mutationFn: () => api.post('/brand-pulse/competitor/benchmark'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['brand-pulse-dashboard'] }),
  });

  const auditExistingMutation = useMutation({
    mutationFn: () =>
      api.post('/brand-pulse/articles/audit-existing', {
        urls: auditUrls.split('\n').map((u) => u.trim()).filter(Boolean),
      }),
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
  const channelStatus = dashboard?.channelStatus;
  const cmsConnections = dashboard?.cmsConnections || [];
  const competitorHistory = dashboard?.competitorHistory || [];
  const competitorRadar = dashboard?.competitorRadar || [];
  const brands = brandsData?.brands || [];
  const apiKeys = apiKeysData?.keys || [];

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
            <Button size="sm" className="bg-rose-600 hover:bg-rose-700" disabled={topicsMutation.isPending} onClick={() => { setTopicsSuccess(null); setTopicsError(null); topicsMutation.mutate(); }}>
              {topicsMutation.isPending ? <Loader2 size={14} className="mr-1 animate-spin" /> : <Sparkles size={14} className="mr-1" />}
              {topicsMutation.isPending ? 'Génération…' : 'Proposer 3 sujets'}
            </Button>
          </>
        }
      />

      {topicsSuccess && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {topicsSuccess}
        </div>
      )}

      {topicsError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {topicsError}
        </div>
      )}

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
              {articles.length === 0 && (
                <p className="text-sm text-muted-foreground rounded-lg border border-dashed p-4 text-center">
                  Aucun article pour l&apos;instant. Cliquez sur <strong>Proposer 3 sujets</strong> en haut à droite pour démarrer le pipeline.
                </p>
              )}
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
                    {art.status === 'APPROVED' && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => setScheduleArticleId(art.id)}>
                          Planifier
                        </Button>
                        {cmsConnections.length > 0 && (
                          <Button size="sm" variant="outline" disabled={publishMutation.isPending} onClick={() => publishMutation.mutate(art.id)}>
                            <Upload size={12} className="mr-1" />
                            {cmsConnections.some((c: { platform: string }) => c.platform === 'MANUAL') ? 'Marquer publié' : 'Publier'}
                          </Button>
                        )}
                      </>
                    )}
                    {art.status === 'SCHEDULED' && cmsConnections.length > 0 && (
                      <Button size="sm" variant="outline" disabled={publishMutation.isPending} onClick={() => publishMutation.mutate(art.id)}>
                        Publier now
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Link2 size={18} /> Canaux — Phase 2</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" disabled={socialDetectMutation.isPending} onClick={() => socialDetectMutation.mutate()}>
                Détecter réseaux sociaux
              </Button>
              <Button size="sm" variant="outline" disabled={channelSyncMutation.isPending} onClick={() => channelSyncMutation.mutate()}>
                Synchroniser tous les canaux
              </Button>
            </div>
            <div className="flex gap-2">
              <Input placeholder="Rechercher établissement Google..." value={reviewsQuery} onChange={(e) => setReviewsQuery(e.target.value)} />
              <Button size="sm" disabled={!reviewsQuery || reviewsConnectMutation.isPending} onClick={() => reviewsConnectMutation.mutate()}>
                Avis Google
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Social: {channelStatus?.social?.connected ? `connecté (${channelStatus.social.score}/100)` : 'non connecté'}
              {' · '}
              Avis: {channelStatus?.reviews?.connected ? `connecté (${channelStatus.reviews.score}/100)` : 'non connecté'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Globe size={18} /> CMS — Phase 3/4</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Select value={cmsPlatform} onValueChange={setCmsPlatform}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="WORDPRESS">WordPress</SelectItem>
                <SelectItem value="GHOST">Ghost</SelectItem>
                <SelectItem value="WEBFLOW">Webflow</SelectItem>
                <SelectItem value="SHOPIFY">Shopify Blog</SelectItem>
                <SelectItem value="WIX">Wix</SelectItem>
                <SelectItem value="MANUAL">Vite / site statique (fichier .md)</SelectItem>
              </SelectContent>
            </Select>
            {cmsPlatform === 'MANUAL' ? (
              <p className="text-xs text-muted-foreground rounded-lg border border-dashed p-3">
                Site Vite, React, Astro, etc. : après validation, téléchargez le fichier <code>.md</code> et placez-le dans votre projet
                (ex. <code>src/content/blog/</code> ou <code>content/posts/</code>), puis rebuild / redeploy. Activez ci-dessous pour suivre le statut « publié » dans BrandPulse.
              </p>
            ) : null}
            <Input
              placeholder={
                cmsPlatform === 'MANUAL' ? 'URL de votre site (optionnel)'
                  : cmsPlatform === 'SHOPIFY' ? 'boutique.myshopify.com'
                    : cmsPlatform === 'GHOST' ? 'URL admin Ghost'
                      : 'URL du site'
              }
              value={cmsSiteUrl}
              onChange={(e) => setCmsSiteUrl(e.target.value)}
            />
            {cmsPlatform !== 'MANUAL' && (cmsPlatform === 'WORDPRESS' || cmsPlatform === 'WEBFLOW' || cmsPlatform === 'SHOPIFY' || cmsPlatform === 'WIX') && (
              <Input
                placeholder={
                  cmsPlatform === 'WEBFLOW' ? 'Collection ID'
                    : cmsPlatform === 'SHOPIFY' ? 'Blog ID'
                      : cmsPlatform === 'WIX' ? 'Site ID'
                        : 'Utilisateur WP'
                }
                value={cmsUser}
                onChange={(e) => setCmsUser(e.target.value)}
              />
            )}
            {cmsPlatform !== 'MANUAL' && (
              <Input
                placeholder={
                  cmsPlatform === 'GHOST' ? 'Admin API Key (id:secret)'
                    : cmsPlatform === 'WEBFLOW' ? 'API Token'
                      : cmsPlatform === 'SHOPIFY' ? 'Access Token'
                        : cmsPlatform === 'WIX' ? 'API Key'
                          : 'Application Password'
                }
                type="password"
                value={cmsPassword}
                onChange={(e) => setCmsPassword(e.target.value)}
              />
            )}
            <Button size="sm" className="w-full" disabled={cmsConnectMutation.isPending} onClick={() => cmsConnectMutation.mutate()}>
              {cmsPlatform === 'MANUAL' ? 'Activer export Vite / statique' : 'Connecter CMS'}
            </Button>
            {cmsConnections.length > 0 && (
              <ul className="space-y-1 text-xs">
                {cmsConnections.map((c: { id: string; platform: string; label: string | null; active: boolean }) => (
                  <li key={c.id} className="flex items-center justify-between gap-2 rounded border px-2 py-1">
                    <span>{c.platform}{c.active ? '' : ' (inactif)'}</span>
                    <span className="flex gap-1">
                      <Button size="sm" variant="ghost" className="h-6 px-2" onClick={() => cmsTestMutation.mutate(c.id)}>Test</Button>
                      <Button size="sm" variant="ghost" className="h-6 px-2 text-red-600" onClick={() => cmsDeleteMutation.mutate(c.id)}>×</Button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Benchmark concurrent — Phase 6</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Button size="sm" variant="outline" disabled={benchmarkMutation.isPending} onClick={() => benchmarkMutation.mutate()}>
              Lancer le benchmark
            </Button>
            {competitorRadar.length > 0 && (
              <table className="w-full text-xs mt-2">
                <thead>
                  <tr className="text-muted-foreground">
                    <th className="text-left py-1">Canal</th>
                    <th className="text-right">Vous</th>
                    <th className="text-right">Concurrent</th>
                    <th className="text-right">Δ</th>
                  </tr>
                </thead>
                <tbody>
                  {competitorRadar.map((r: { channel: string; brand: number | null; competitor: number | null; delta: number | null }) => (
                    <tr key={r.channel}>
                      <td className="py-0.5">{CHANNEL_LABELS[r.channel] || r.channel}</td>
                      <td className="text-right">{r.brand ?? '—'}</td>
                      <td className="text-right">{r.competitor ?? '—'}</td>
                      <td className={cn('text-right', r.delta != null && r.delta >= 0 ? 'text-emerald-600' : 'text-red-600')}>
                        {r.delta != null ? (r.delta > 0 ? `+${r.delta}` : r.delta) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {competitorHistory.length > 0 && (
              <ul className="text-xs text-muted-foreground space-y-1 mt-2">
                {competitorHistory.map((h: { computedAt: string; globalScore: number; competitorName: string }) => (
                  <li key={h.computedAt}>{h.competitorName}: {h.globalScore}/100 — {new Date(h.computedAt).toLocaleDateString('fr-FR')}</li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Rapport & audit — Phases 4/7</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                const r = await api.get('/brand-pulse/report/monthly?format=html', { responseType: 'text' });
                const w = window.open('', '_blank');
                if (w) {
                  w.document.write(r.data as string);
                  w.document.close();
                }
              }}
            >
              Rapport mensuel (PDF via impression)
            </Button>
            <Textarea rows={3} placeholder="URLs articles existants (une par ligne)" value={auditUrls} onChange={(e) => setAuditUrls(e.target.value)} />
            <Button size="sm" variant="outline" disabled={auditExistingMutation.isPending} onClick={() => auditExistingMutation.mutate()}>
              Auditer articles existants
            </Button>
            {auditExistingMutation.data?.data?.results && (
              <ul className="text-xs space-y-1 max-h-24 overflow-y-auto">
                {(auditExistingMutation.data.data.results as Array<{ url: string; score: number }>).map((r) => (
                  <li key={r.url}>{r.url}: {r.score}/100</li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Multi-marques</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {brands.map((b: { id: string; brandName: string; slug: string; isPrimary: boolean }) => (
              <p key={b.id} className="text-xs">{b.brandName}{b.isPrimary ? ' (principale)' : ` — ${b.slug}`}</p>
            ))}
            <Input placeholder="Nouvelle marque" value={newBrandName} onChange={(e) => setNewBrandName(e.target.value)} />
            <Input placeholder="URL site" value={newBrandUrl} onChange={(e) => setNewBrandUrl(e.target.value)} />
            <Button size="sm" variant="outline" disabled={!newBrandName || !newBrandUrl || createBrandMutation.isPending} onClick={() => createBrandMutation.mutate()}>
              Ajouter une marque
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">API publique</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex gap-2">
              <Input placeholder="Label clé (optionnel)" value={apiKeyLabel} onChange={(e) => setApiKeyLabel(e.target.value)} />
              <Button size="sm" disabled={apiKeyMutation.isPending} onClick={() => apiKeyMutation.mutate()}>Créer</Button>
            </div>
            {createdApiKey && (
              <p className="text-xs break-all rounded bg-amber-50 border border-amber-200 p-2">
                Clé (copiez maintenant) : <code>{createdApiKey}</code>
              </p>
            )}
            <ul className="text-xs space-y-1">
              {apiKeys.map((k: { id: string; keyPrefix: string; label: string | null; active: boolean }) => (
                <li key={k.id} className="flex justify-between">
                  <span>{k.label || k.keyPrefix}{!k.active ? ' (révoquée)' : ''}</span>
                  {k.active && (
                    <button type="button" className="text-red-600" onClick={() => apiKeyDeleteMutation.mutate(k.id)}>Révoquer</button>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      {scheduleArticleId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <Card className="max-w-sm w-full">
            <CardHeader><CardTitle className="text-base">Planifier la publication</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Input type="datetime-local" value={scheduleDate} onChange={(e) => setScheduleDate(e.target.value)} />
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setScheduleArticleId(null)}>Annuler</Button>
                <Button
                  disabled={!scheduleDate || scheduleMutation.isPending}
                  onClick={() => scheduleMutation.mutate({ id: scheduleArticleId, scheduledAt: scheduleDate })}
                >
                  Planifier
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

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
              <Button variant="outline" className="gap-1" onClick={() => reviewArticle && downloadMarkdown(reviewArticle, editContent)}>
                Télécharger .md
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
