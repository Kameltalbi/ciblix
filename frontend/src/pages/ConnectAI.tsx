import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  BarChart3,
  History,
  FileText,
  Puzzle,
  Settings2,
  Loader2,
  Sparkles,
  Copy,
  MousePointerClick,
  BookOpen,
  Trash2,
  RefreshCw,
  Globe,
  Upload,
  Target,
  MessageSquare,
  Brain,
  Package,
  ExternalLink,
  Circle,
} from 'lucide-react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/lib/auth';

type Tab = 'overview' | 'history' | 'templates' | 'knowledge' | 'analytics' | 'extension' | 'settings';

const TABS: { id: Tab; labelKey: string; icon: typeof Sparkles }[] = [
  { id: 'overview', labelKey: 'connectAi.tabs.overview', icon: Sparkles },
  { id: 'history', labelKey: 'connectAi.tabs.history', icon: History },
  { id: 'templates', labelKey: 'connectAi.tabs.templates', icon: FileText },
  { id: 'knowledge', labelKey: 'connectAi.tabs.knowledge', icon: BookOpen },
  { id: 'analytics', labelKey: 'connectAi.tabs.analytics', icon: BarChart3 },
  { id: 'extension', labelKey: 'connectAi.tabs.extension', icon: Puzzle },
  { id: 'settings', labelKey: 'connectAi.tabs.settings', icon: Settings2 },
];

const TONES = ['professionnel', 'amical', 'premium'] as const;

function detectBrowser(): string {
  const ua = navigator.userAgent;
  if (ua.includes('Edg/')) return 'edge';
  if (ua.includes('Firefox/')) return 'firefox';
  if (ua.includes('Safari/') && !ua.includes('Chrome')) return 'safari';
  if (ua.includes('OPR/') || ua.includes('Opera')) return 'opera';
  if (ua.includes('Chrome/')) return 'chrome';
  return 'unknown';
}

export function ConnectAI() {
  const { t } = useTranslation();
  const user = useAuth((s) => s.user);
  const [tab, setTab] = useState<Tab>('overview');
  const qc = useQueryClient();
  const browser = detectBrowser();

  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ['connect-ai', 'analytics'],
    queryFn: async () => (await api.get('/connect-ai/analytics')).data,
    enabled: tab === 'overview' || tab === 'analytics',
  });

  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ['connect-ai', 'history'],
    queryFn: async () => (await api.get('/connect-ai/history')).data,
    enabled: tab === 'history' || tab === 'overview',
  });

  const { data: templatesData } = useQuery({
    queryKey: ['connect-ai', 'templates'],
    queryFn: async () => (await api.get('/connect-ai/templates')).data,
    enabled: tab === 'templates',
  });

  const { data: settingsData } = useQuery({
    queryKey: ['connect-ai', 'settings'],
    queryFn: async () => (await api.get('/connect-ai/settings')).data,
    enabled: tab === 'settings' || tab === 'extension',
  });

  const { data: knowledgeData, isLoading: knowledgeLoading } = useQuery({
    queryKey: ['connect-ai', 'knowledge'],
    queryFn: async () => (await api.get('/connect-ai/knowledge/sources')).data,
    enabled: tab === 'knowledge',
  });

  const settingsMutation = useMutation({
    mutationFn: async (body: Record<string, unknown>) =>
      (await api.patch('/connect-ai/settings', body)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['connect-ai', 'settings'] }),
  });

  const invalidateKnowledge = () => qc.invalidateQueries({ queryKey: ['connect-ai', 'knowledge'] });

  const textIngestMutation = useMutation({
    mutationFn: async (body: { name: string; content: string; type?: string }) =>
      (await api.post('/connect-ai/knowledge/sources/text', body)).data,
    onSuccess: invalidateKnowledge,
  });

  const urlIngestMutation = useMutation({
    mutationFn: async (body: { url: string; name?: string }) =>
      (await api.post('/connect-ai/knowledge/sources/url', body)).data,
    onSuccess: invalidateKnowledge,
  });

  const deleteKnowledgeMutation = useMutation({
    mutationFn: async (sourceId: string) =>
      (await api.delete(`/connect-ai/knowledge/sources/${sourceId}`)).data,
    onSuccess: invalidateKnowledge,
  });

  const reindexMutation = useMutation({
    mutationFn: async (sourceId: string) =>
      (await api.post(`/connect-ai/knowledge/sources/${sourceId}/reindex`)).data,
    onSuccess: invalidateKnowledge,
  });

  const [tone, setTone] = useState<'professionnel' | 'amical' | 'premium'>('professionnel');

  const [urlForm, setUrlForm] = useState({ url: '', name: '' });
  const [textForm, setTextForm] = useState({ name: '', content: '', type: 'TEXT' });
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: productsData } = useQuery({
    queryKey: ['connect-ai', 'products'],
    queryFn: async () => (await api.get('/connect-ai/products')).data,
    enabled: tab === 'overview',
  });

  useEffect(() => {
    if (settingsData?.tone && TONES.includes(settingsData.tone)) {
      setTone(settingsData.tone);
    }
  }, [settingsData?.tone]);

  async function handleFileUpload(file: File) {
    setUploadError(null);
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('name', file.name);
      await api.post('/connect-ai/knowledge/sources/upload', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      invalidateKnowledge();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : t('connectAi.knowledge.uploadError'));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#016AEB] to-sky-400 text-white shadow-sm">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-[#016AEB]">{t('connectAi.badge')}</p>
            <h1 className="text-2xl font-semibold tracking-tight">{t('connectAi.title')}</h1>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">{t('connectAi.subtitle')}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setTab('knowledge')}>
            <BookOpen className="mr-1.5 h-4 w-4" />
            {t('connectAi.cta.knowledge')}
          </Button>
          <Button size="sm" onClick={() => setTab('extension')}>
            <Puzzle className="mr-1.5 h-4 w-4" />
            {t('connectAi.cta.extension')}
          </Button>
        </div>
      </header>

      <nav className="flex flex-wrap gap-1 rounded-xl border bg-muted/30 p-1">
        {TABS.map(({ id, labelKey, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition',
              tab === id ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Icon className="h-4 w-4" />
            {t(labelKey)}
          </button>
        ))}
      </nav>

      {tab === 'overview' && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { icon: Target, title: t('connectAi.capabilities.qualifyTitle'), desc: t('connectAi.capabilities.qualifyDesc') },
              { icon: Brain, title: t('connectAi.capabilities.contextTitle'), desc: t('connectAi.capabilities.contextDesc') },
              { icon: MessageSquare, title: t('connectAi.capabilities.chatTitle'), desc: t('connectAi.capabilities.chatDesc') },
              { icon: History, title: t('connectAi.capabilities.memoryTitle'), desc: t('connectAi.capabilities.memoryDesc') },
              { icon: Package, title: t('connectAi.capabilities.productsTitle'), desc: t('connectAi.capabilities.productsDesc') },
              { icon: BookOpen, title: t('connectAi.capabilities.knowledgeTitle'), desc: t('connectAi.capabilities.knowledgeDesc') },
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-xl border border-slate-200/80 bg-gradient-to-br from-white to-slate-50/80 p-4 dark:border-slate-800 dark:from-slate-950 dark:to-slate-900/60"
              >
                <item.icon className="mb-2 h-5 w-5 text-[#016AEB]" />
                <p className="text-sm font-medium">{item.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: t('connectAi.stats.generated'), value: analytics?.messagesGenerated ?? '—', icon: Sparkles },
              { label: t('connectAi.stats.copied'), value: analytics?.messagesCopied ?? '—', icon: Copy },
              { label: t('connectAi.stats.inserted'), value: analytics?.messagesInserted ?? '—', icon: MousePointerClick },
              {
                label: t('connectAi.stats.avgTime'),
                value: analytics?.avgGenerationMs ? `${analytics.avgGenerationMs} ms` : '—',
                icon: BarChart3,
              },
            ].map((stat) => (
              <Card key={stat.label}>
                <CardContent className="flex items-center gap-3 p-4">
                  <stat.icon className="h-8 w-8 text-[#016AEB] opacity-80" />
                  <div>
                    <p className="text-2xl font-semibold">{analyticsLoading ? '…' : stat.value}</p>
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {(productsData?.products?.length ?? 0) > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t('connectAi.overview.products')}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {(productsData.products as Array<{ id: string; name: string; description?: string }>).map((p) => (
                  <div key={p.id} className="max-w-sm rounded-lg border px-3 py-2 text-sm">
                    <span className="font-medium">{p.name}</span>
                    {p.description && (
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{p.description}</p>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('connectAi.overview.recent')}</CardTitle>
            </CardHeader>
            <CardContent>
              {historyLoading ? (
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              ) : (
                <ul className="space-y-2 text-sm">
                  {(historyData?.history ?? []).slice(0, 5).map((m: { id: string; content: string; createdAt: string; channel?: { name: string } }) => (
                    <li key={m.id} className="rounded-lg border p-3">
                      <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                        <span>{m.channel?.name}</span>
                        <span>{new Date(m.createdAt).toLocaleDateString('fr-FR')}</span>
                      </div>
                      <p className="line-clamp-2">{m.content}</p>
                    </li>
                  ))}
                  {!historyData?.history?.length && (
                    <p className="text-sm text-muted-foreground">{t('connectAi.overview.empty')}</p>
                  )}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {tab === 'history' && (
        <Card>
          <CardHeader><CardTitle>{t('connectAi.tabs.history')}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {historyLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              (historyData?.history ?? []).map((m: { id: string; content: string; strategy: string; product: string; createdAt: string }) => (
                <div key={m.id} className="rounded-lg border p-4">
                  <div className="mb-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span>{m.strategy}</span>
                    <span>·</span>
                    <span>{m.product}</span>
                    <span>·</span>
                    <span>{new Date(m.createdAt).toLocaleString('fr-FR')}</span>
                  </div>
                  <p className="whitespace-pre-wrap text-sm">{m.content}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      )}

      {tab === 'templates' && (
        <Card>
          <CardHeader><CardTitle>{t('connectAi.tabs.templates')}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {(templatesData?.templates ?? []).map((tpl: { id: string; name: string; slug: string; strategy: string; versions: { version: number }[] }) => (
              <div key={tpl.id} className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="font-medium">{tpl.name}</p>
                  <p className="text-xs text-muted-foreground">{tpl.slug} · {tpl.strategy}</p>
                </div>
                <span className="text-xs text-muted-foreground">v{tpl.versions[0]?.version ?? 1}</span>
              </div>
            ))}
            {!templatesData?.templates?.length && (
              <p className="text-sm text-muted-foreground">{t('connectAi.templates.defaultOnly')}</p>
            )}
          </CardContent>
        </Card>
      )}

      {tab === 'analytics' && (
        <Card>
          <CardHeader><CardTitle>{t('connectAi.tabs.analytics')}</CardTitle></CardHeader>
          <CardContent>
            {analyticsLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <div className="space-y-6">
                <div>
                  <h3 className="mb-3 text-sm font-medium">{t('connectAi.analytics.funnel')}</h3>
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    {[
                      { label: t('connectAi.stats.generated'), value: analytics?.funnel?.generated ?? 0 },
                      { label: t('connectAi.stats.inserted'), value: analytics?.funnel?.inserted ?? 0 },
                      { label: t('connectAi.analytics.sent'), value: analytics?.funnel?.sent ?? 0 },
                      { label: t('connectAi.analytics.replies'), value: analytics?.funnel?.replies ?? 0 },
                      { label: t('connectAi.analytics.meetings'), value: analytics?.funnel?.meetings ?? 0 },
                    ].map((step, i, arr) => (
                      <span key={step.label} className="flex items-center gap-2">
                        <span className="rounded-lg border px-3 py-2">
                          <span className="block text-lg font-semibold">{step.value}</span>
                          <span className="text-xs text-muted-foreground">{step.label}</span>
                        </span>
                        {i < arr.length - 1 && <span className="text-muted-foreground">→</span>}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <h3 className="mb-2 text-sm font-medium">{t('connectAi.analytics.byChannel')}</h3>
                  <ul className="space-y-1 text-sm">
                    {Object.entries(analytics?.byChannel ?? {}).map(([k, v]) => (
                      <li key={k} className="flex justify-between"><span>{k}</span><span>{v as number}</span></li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3 className="mb-2 text-sm font-medium">{t('connectAi.analytics.byProduct')}</h3>
                  <ul className="space-y-1 text-sm">
                    {Object.entries(analytics?.byProduct ?? {}).map(([k, v]) => (
                      <li key={k} className="flex justify-between"><span>{k}</span><span>{v as number}</span></li>
                    ))}
                  </ul>
                </div>
              </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {tab === 'extension' && (
        <div className="space-y-4">
          <Card className="overflow-hidden">
            <CardHeader className="border-b bg-gradient-to-r from-[#016AEB]/5 to-sky-50/50">
              <CardTitle>{t('connectAi.extension.pageTitle')}</CardTitle>
              <p className="text-sm text-muted-foreground">{t('connectAi.extension.betaNote')}</p>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              <div className="flex items-center gap-3 rounded-xl border p-4">
                <Circle
                  className={cn(
                    'h-3 w-3 fill-current',
                    settingsData?.session ? 'text-emerald-500' : 'text-amber-500'
                  )}
                />
                <div>
                  <p className="text-sm font-medium">
                    {settingsData?.session
                      ? t('connectAi.extension.statusInstalled')
                      : t('connectAi.extension.statusPending')}
                  </p>
                  <p className="text-xs text-muted-foreground">{t('connectAi.extension.channelsNote')}</p>
                </div>
              </div>

              <dl className="grid gap-4 sm:grid-cols-2">
                {[
                  { label: t('connectAi.extension.version'), value: settingsData?.extensionVersion ?? '0.2.0' },
                  { label: t('connectAi.extension.browser'), value: browser },
                  {
                    label: t('connectAi.extension.lastSync'),
                    value: settingsData?.session?.lastSyncAt
                      ? new Date(settingsData.session.lastSyncAt).toLocaleString('fr-FR')
                      : t('connectAi.extension.never'),
                  },
                  {
                    label: t('connectAi.extension.account'),
                    value: user?.name || user?.email || '—',
                  },
                ].map((row) => (
                  <div key={row.label} className="rounded-lg border px-4 py-3">
                    <dt className="text-xs text-muted-foreground">{row.label}</dt>
                    <dd className="mt-1 text-sm font-semibold capitalize">{row.value}</dd>
                  </div>
                ))}
              </dl>

              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => window.open('https://www.linkedin.com/feed/', '_blank', 'noopener')}
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  {t('connectAi.extension.testCta')}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => document.getElementById('extension-install')?.scrollIntoView({ behavior: 'smooth' })}
                >
                  {t('connectAi.extension.reinstallCta')}
                </Button>
                <Button variant="ghost" onClick={() => setTab('overview')}>
                  {t('connectAi.extension.newsCta')}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card id="extension-install">
            <CardHeader>
              <CardTitle className="text-base">{t('connectAi.extension.installTitle')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <ol className="list-decimal space-y-2 pl-5">
                <li>{t('connectAi.extension.installStep1')}</li>
                <li>{t('connectAi.extension.installStep2')}</li>
                <li>{t('connectAi.extension.installStep3')}</li>
                <li>{t('connectAi.extension.installStep4')}</li>
              </ol>
              <p className="text-xs">{t('connectAi.extension.installHint')}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {tab === 'knowledge' && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('connectAi.knowledge.title')}</CardTitle>
              <p className="text-sm text-muted-foreground">{t('connectAi.knowledge.hint')}</p>
            </CardHeader>
            <CardContent className="grid gap-6 lg:grid-cols-3">
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Globe className="h-4 w-4" />
                  {t('connectAi.knowledge.addUrl')}
                </div>
                <input
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  placeholder="https://…"
                  value={urlForm.url}
                  onChange={(e) => setUrlForm((s) => ({ ...s, url: e.target.value }))}
                />
                <input
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  placeholder={t('connectAi.knowledge.nameOptional')}
                  value={urlForm.name}
                  onChange={(e) => setUrlForm((s) => ({ ...s, name: e.target.value }))}
                />
                <Button
                  size="sm"
                  disabled={!urlForm.url || urlIngestMutation.isPending}
                  onClick={() =>
                    urlIngestMutation.mutate({
                      url: urlForm.url,
                      name: urlForm.name || undefined,
                    })
                  }
                >
                  {urlIngestMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : t('connectAi.knowledge.indexUrl')}
                </Button>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Upload className="h-4 w-4" />
                  {t('connectAi.knowledge.addFile')}
                </div>
                <p className="text-xs text-muted-foreground">{t('connectAi.knowledge.fileFormats')}</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.txt,.md,.csv,.html,.htm,application/pdf,text/*"
                  className="block w-full text-sm"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handleFileUpload(file);
                  }}
                />
                {uploading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                {uploadError && <p className="text-xs text-destructive">{uploadError}</p>}
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <FileText className="h-4 w-4" />
                  {t('connectAi.knowledge.addText')}
                </div>
                <input
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  placeholder={t('connectAi.knowledge.name')}
                  value={textForm.name}
                  onChange={(e) => setTextForm((s) => ({ ...s, name: e.target.value }))}
                />
                <select
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  value={textForm.type}
                  onChange={(e) => setTextForm((s) => ({ ...s, type: e.target.value }))}
                >
                  <option value="TEXT">{t('connectAi.knowledge.typeText')}</option>
                  <option value="FAQ">{t('connectAi.knowledge.typeFaq')}</option>
                  <option value="PRICING">{t('connectAi.knowledge.typePricing')}</option>
                </select>
                <textarea
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  rows={4}
                  placeholder={t('connectAi.knowledge.contentPlaceholder')}
                  value={textForm.content}
                  onChange={(e) => setTextForm((s) => ({ ...s, content: e.target.value }))}
                />
                <Button
                  size="sm"
                  disabled={textForm.name.length < 2 || textForm.content.length < 40 || textIngestMutation.isPending}
                  onClick={() =>
                    textIngestMutation.mutate({
                      name: textForm.name,
                      content: textForm.content,
                      type: textForm.type,
                    })
                  }
                >
                  {textIngestMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : t('connectAi.knowledge.saveText')}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>{t('connectAi.knowledge.sources')}</CardTitle></CardHeader>
            <CardContent>
              {knowledgeLoading ? (
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              ) : !(knowledgeData?.sources?.length) ? (
                <p className="text-sm text-muted-foreground">{t('connectAi.knowledge.empty')}</p>
              ) : (
                <ul className="divide-y">
                  {(knowledgeData.sources as Array<{
                    id: string;
                    name: string;
                    type: string;
                    status: string;
                    chunkCount: number;
                    error?: string | null;
                    updatedAt: string;
                    sourceUrl?: string | null;
                  }>).map((s) => (
                    <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{s.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {s.type} · {s.status} · {s.chunkCount} {t('connectAi.knowledge.chunks')}
                          {s.sourceUrl ? ` · ${s.sourceUrl}` : ''}
                        </p>
                        {s.error && <p className="text-xs text-destructive">{s.error}</p>}
                      </div>
                      <div className="flex gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          title={t('connectAi.knowledge.reindex')}
                          disabled={reindexMutation.isPending}
                          onClick={() => reindexMutation.mutate(s.id)}
                        >
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          title={t('connectAi.knowledge.delete')}
                          disabled={deleteKnowledgeMutation.isPending}
                          onClick={() => deleteKnowledgeMutation.mutate(s.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {tab === 'settings' && (
        <Card>
          <CardHeader>
            <CardTitle>{t('connectAi.settings.toneTitle')}</CardTitle>
            <p className="text-sm text-muted-foreground">{t('connectAi.settings.toneHint')}</p>
          </CardHeader>
          <CardContent className="max-w-md space-y-4">
            <div className="space-y-2">
              {TONES.map((value) => (
                <label
                  key={value}
                  className={cn(
                    'flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm transition',
                    tone === value ? 'border-[#016AEB] bg-[#016AEB]/5' : 'hover:bg-muted/40'
                  )}
                >
                  <input
                    type="radio"
                    name="tone"
                    className="accent-[#016AEB]"
                    checked={tone === value}
                    onChange={() => setTone(value)}
                  />
                  <span className="font-medium">{t(`connectAi.settings.tones.${value}`)}</span>
                </label>
              ))}
            </div>
            <Button
              onClick={() => settingsMutation.mutate({ tone })}
              disabled={settingsMutation.isPending}
            >
              {settingsMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : t('connectAi.settings.save')}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
