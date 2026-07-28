import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  History,
  FileText,
  Settings2,
  Loader2,
  BookOpen,
  Trash2,
  RefreshCw,
  Globe,
  Upload,
  ExternalLink,
} from 'lucide-react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

type Tab = 'overview' | 'history' | 'knowledge' | 'settings';

const TABS: { id: Tab; labelKey: string; icon: typeof BookOpen }[] = [
  { id: 'overview', labelKey: 'connectAi.tabs.overview', icon: BookOpen },
  { id: 'history', labelKey: 'connectAi.tabs.history', icon: History },
  { id: 'knowledge', labelKey: 'connectAi.tabs.knowledge', icon: FileText },
  { id: 'settings', labelKey: 'connectAi.tabs.settings', icon: Settings2 },
];

const TONES = ['professionnel', 'amical', 'premium'] as const;

export function ConnectAI() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>('overview');
  const qc = useQueryClient();

  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ['connect-ai', 'history'],
    queryFn: async () => (await api.get('/connect-ai/history')).data,
    enabled: tab === 'history' || tab === 'overview',
  });

  const { data: settingsData } = useQuery({
    queryKey: ['connect-ai', 'settings'],
    queryFn: async () => (await api.get('/connect-ai/settings')).data,
    enabled: tab === 'settings',
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
    <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t('connectAi.title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('connectAi.subtitle')}</p>
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
          <Card>
            <CardContent className="space-y-5 p-6">
              <div>
                <h2 className="text-lg font-semibold">{t('connectAi.overview.installTitle')}</h2>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  {t('connectAi.overview.installIntro')}
                </p>
              </div>

              <Button asChild className="w-full sm:w-auto">
                <a href="/downloads/ciblix-linkedin.zip" download>
                  {t('connectAi.overview.ctaDownload')}
                </a>
              </Button>

              <ol className="list-decimal space-y-3 pl-5 text-sm">
                <li>{t('connectAi.overview.installStep1')}</li>
                <li>{t('connectAi.overview.installStep2')}</li>
                <li>{t('connectAi.overview.installStep3')}</li>
              </ol>

              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={() => window.open('https://www.linkedin.com/feed/', '_blank', 'noopener')}
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  {t('connectAi.extension.testCta')}
                </Button>
              </div>
            </CardContent>
          </Card>

          {(historyData?.history?.length ?? 0) > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t('connectAi.overview.recent')}</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  {(historyData?.history ?? []).slice(0, 5).map(
                    (m: { id: string; content: string; createdAt: string; channel?: { name: string } }) => (
                      <li key={m.id} className="rounded-lg border p-3">
                        <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                          <span>{m.channel?.name}</span>
                          <span>{new Date(m.createdAt).toLocaleDateString('fr-FR')}</span>
                        </div>
                        <p className="line-clamp-2">{m.content}</p>
                      </li>
                    )
                  )}
                </ul>
              </CardContent>
            </Card>
          ) : null}
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
