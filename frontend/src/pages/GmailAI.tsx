import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  Mail,
  RefreshCw,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Link2,
  Inbox,
  Zap,
  Clock,
  ExternalLink,
  Power,
  PowerOff,
} from 'lucide-react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/form-controls';
import { cn } from '@/lib/utils';

interface GmailAiStatus {
  connected: boolean;
  email: string | null;
  labelName: string;
  syncReady: boolean;
  enabled: boolean;
  lastSyncAt: string | null;
  activatedAt: string | null;
  replyLanguage: string;
  replyTone: string;
  signature: string | null;
  ignoreNewsletters: boolean;
  ignorePromotions: boolean;
  ignoreSocial: boolean;
  neverAutoSend: boolean;
  today?: {
    processed: number;
    drafts: number;
    errors: number;
    pendingDrafts: number;
  };
}

interface ProcessedItem {
  id: string;
  providerMessageId: string;
  threadId: string;
  subject: string | null;
  fromEmail: string | null;
  summary: string | null;
  actionRequested: string | null;
  analysis: string | null;
  priority: 'HIGH' | 'MEDIUM' | 'LOW' | null;
  draftId: string | null;
  status: 'PROCESSED' | 'SKIPPED' | 'ERROR';
  errorMessage: string | null;
  createdAt: string;
}

interface GmailStats {
  today: {
    emailsRead: number;
    draftsCreated: number;
    errors: number;
    successRate: number;
    minutesSaved: number;
  };
  totals: {
    drafts: number;
    processed: number;
    highPriority: number;
  };
}

function Counter({
  title,
  value,
  hint,
  icon,
  iconClass,
}: {
  title: string;
  value: string;
  hint?: string;
  icon: React.ReactNode;
  iconClass: string;
}) {
  return (
    <Card className="border-0 shadow-sm ring-1 ring-black/5">
      <CardContent className="flex items-start gap-3 p-4">
        <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl', iconClass)}>{icon}</div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{title}</p>
          <p className="text-xl font-bold tracking-tight">{value}</p>
          {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

function priorityBadge(priority: ProcessedItem['priority']) {
  if (priority === 'HIGH') return { label: 'Haute', className: 'bg-rose-50 text-rose-700' };
  if (priority === 'LOW') return { label: 'Basse', className: 'bg-slate-100 text-slate-600' };
  return { label: 'Moyenne', className: 'bg-amber-50 text-amber-700' };
}

export function GmailAI() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [params] = useSearchParams();
  const [toast, setToast] = useState<string | null>(null);
  const [language, setLanguage] = useState('fr');
  const [tone, setTone] = useState('professionnel');
  const [signature, setSignature] = useState('');
  const [ignoreNewsletters, setIgnoreNewsletters] = useState(true);
  const [ignorePromotions, setIgnorePromotions] = useState(true);
  const [ignoreSocial, setIgnoreSocial] = useState(true);

  const { data: status, isLoading: statusLoading } = useQuery<GmailAiStatus>({
    queryKey: ['gmail-ai-status'],
    queryFn: () => api.get('/gmail-ai/status').then((r) => r.data),
  });

  const { data: stats } = useQuery<GmailStats>({
    queryKey: ['gmail-ai-statistics'],
    queryFn: () => api.get('/gmail-ai/statistics').then((r) => r.data),
  });

  const { data: processed, isLoading: listLoading } = useQuery<{ items: ProcessedItem[] }>({
    queryKey: ['gmail-ai-processed'],
    queryFn: () => api.get('/gmail-ai/messages?limit=40').then((r) => r.data),
  });

  useEffect(() => {
    if (!status) return;
    setLanguage(status.replyLanguage || 'fr');
    setTone(status.replyTone || 'professionnel');
    setSignature(status.signature || '');
    setIgnoreNewsletters(status.ignoreNewsletters ?? true);
    setIgnorePromotions(status.ignorePromotions ?? true);
    setIgnoreSocial(status.ignoreSocial ?? true);
  }, [status]);

  useEffect(() => {
    if (params.get('gmail') === 'connected') {
      setToast(t('gmailAi.toastConnected'));
      qc.invalidateQueries({ queryKey: ['gmail-ai-status'] });
      qc.invalidateQueries({ queryKey: ['gmail-status'] });
      setTimeout(() => setToast(null), 4000);
    }
  }, [params, qc, t]);

  const connectGmail = async () => {
    try {
      const { data } = await api.post('/gmail-ai/connect');
      window.location.href = data.url;
    } catch {
      const { data } = await api.get('/gmail/auth');
      window.location.href = data.url;
    }
  };

  const activate = useMutation({
    mutationFn: () =>
      api
        .post('/gmail-ai/activate', {
          replyLanguage: language,
          replyTone: tone,
          signature: signature || null,
          ignoreNewsletters,
          ignorePromotions,
          ignoreSocial,
        })
        .then((r) => r.data),
    onSuccess: () => {
      setToast(t('gmailAi.toastSyncReady'));
      qc.invalidateQueries({ queryKey: ['gmail-ai-status'] });
      setTimeout(() => setToast(null), 4000);
    },
  });

  const syncNow = useMutation({
    mutationFn: () => api.post('/gmail-ai/sync').then((r) => r.data),
    onSuccess: (data) => {
      setToast(
        t('gmailAi.toastSyncDone', {
          processed: data.processed ?? 0,
          skipped: data.skipped ?? 0,
        })
      );
      qc.invalidateQueries({ queryKey: ['gmail-ai-status'] });
      qc.invalidateQueries({ queryKey: ['gmail-ai-processed'] });
      qc.invalidateQueries({ queryKey: ['gmail-ai-statistics'] });
      setTimeout(() => setToast(null), 5000);
    },
  });

  const saveSettings = useMutation({
    mutationFn: () =>
      api
        .post('/gmail-ai/settings', {
          enabled: true,
          replyLanguage: language,
          replyTone: tone,
          signature: signature || null,
          ignoreNewsletters,
          ignorePromotions,
          ignoreSocial,
        })
        .then((r) => r.data),
    onSuccess: () => {
      setToast(t('gmailAi.toastSettingsSaved'));
      qc.invalidateQueries({ queryKey: ['gmail-ai-status'] });
      setTimeout(() => setToast(null), 3000);
    },
  });

  const toggleEnabled = useMutation({
    mutationFn: (enabled: boolean) => api.post('/gmail-ai/settings', { enabled }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['gmail-ai-status'] }),
  });

  const items = processed?.items || [];
  const pending = items.filter((i) => i.status === 'PROCESSED');
  const activity = items.slice(0, 8);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">
            <Mail size={14} />
            {t('gmailAi.badge')}
          </div>
          <h1 className="text-2xl font-bold tracking-tight">{t('gmailAi.title')}</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{t('gmailAi.subtitle')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {status?.enabled ? (
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => toggleEnabled.mutate(false)}
              disabled={toggleEnabled.isPending}
            >
              <PowerOff size={16} /> Pause
            </Button>
          ) : (
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => (status?.syncReady ? toggleEnabled.mutate(true) : activate.mutate())}
              disabled={activate.isPending || toggleEnabled.isPending}
            >
              <Power size={16} /> Activer
            </Button>
          )}
          <Button onClick={() => syncNow.mutate()} disabled={!status?.connected || syncNow.isPending} className="gap-2">
            {syncNow.isPending ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
            {t('gmailAi.syncNow')}
          </Button>
        </div>
      </div>

      {toast && <div className="rounded-lg bg-leaf px-4 py-2 text-sm text-white">{toast}</div>}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <Counter
          title="Gmail"
          value={status?.connected ? 'Connecté' : 'Non connecté'}
          hint={status?.email || undefined}
          icon={status?.connected ? <CheckCircle2 size={18} className="text-emerald-600" /> : <Link2 size={18} className="text-slate-500" />}
          iconClass={status?.connected ? 'bg-emerald-50' : 'bg-slate-100'}
        />
        <Counter
          title="Synchronisation"
          value={status?.enabled ? 'Active' : 'Pause'}
          hint={status?.lastSyncAt ? new Date(status.lastSyncAt).toLocaleString() : 'Jamais'}
          icon={<RefreshCw size={18} className="text-blue-600" />}
          iconClass="bg-blue-50"
        />
        <Counter
          title="Emails aujourd'hui"
          value={String(stats?.today.emailsRead ?? status?.today?.processed ?? 0)}
          icon={<Inbox size={18} className="text-sky-600" />}
          iconClass="bg-sky-50"
        />
        <Counter
          title="Brouillons créés"
          value={String(stats?.today.draftsCreated ?? 0)}
          icon={<Mail size={18} className="text-red-600" />}
          iconClass="bg-red-50"
        />
        <Counter
          title="Temps gagné"
          value={`${stats?.today.minutesSaved ?? 0} min`}
          hint="~4 min / brouillon"
          icon={<Clock size={18} className="text-violet-600" />}
          iconClass="bg-violet-50"
        />
        <Counter
          title="Taux succès"
          value={`${stats?.today.successRate ?? 100} %`}
          hint={`${stats?.today.errors ?? 0} erreur(s)`}
          icon={<Zap size={18} className="text-amber-600" />}
          iconClass="bg-amber-50"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        <Card className="border-0 shadow-sm ring-1 ring-black/5 xl:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Emails en attente de validation</CardTitle>
            <CardDescription>Brouillons sous le libellé « {status?.labelName || 'Réponse à valider'} »</CardDescription>
          </CardHeader>
          <CardContent>
            {listLoading || statusLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 size={16} className="animate-spin" /> Chargement…
              </div>
            ) : pending.length === 0 ? (
              <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                Aucun brouillon en attente. Envoyez un nouvel email de test après activation.
              </div>
            ) : (
              <ul className="divide-y rounded-xl border">
                {pending.slice(0, 12).map((item) => {
                  const p = priorityBadge(item.priority);
                  return (
                    <li key={item.id} className="space-y-2 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium">{item.subject || '(sans objet)'}</p>
                          <p className="text-xs text-muted-foreground">
                            {item.fromEmail || '—'} · {new Date(item.createdAt).toLocaleString()}
                          </p>
                        </div>
                        <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold uppercase', p.className)}>
                          {p.label}
                        </span>
                      </div>
                      {item.summary && <p className="text-sm text-muted-foreground">{item.summary}</p>}
                      {item.actionRequested && (
                        <p className="text-xs font-medium text-foreground">Action : {item.actionRequested}</p>
                      )}
                      <a
                        href={`https://mail.google.com/mail/u/0/#all/${item.threadId}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline"
                      >
                        Ouvrir dans Gmail <ExternalLink size={12} />
                      </a>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm ring-1 ring-black/5 xl:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Activité récente</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {activity.length === 0 ? (
              <p className="text-sm text-muted-foreground">Pas encore d’activité.</p>
            ) : (
              activity.map((item) => (
                <div key={item.id} className="flex gap-3">
                  <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-muted/60">
                    {item.status === 'ERROR' ? (
                      <AlertCircle size={14} className="text-rose-600" />
                    ) : item.status === 'SKIPPED' ? (
                      <ShieldCheck size={14} className="text-slate-500" />
                    ) : (
                      <Mail size={14} className="text-red-600" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">
                      {item.status === 'PROCESSED'
                        ? 'Brouillon créé + label ajouté'
                        : item.status === 'SKIPPED'
                          ? 'Email ignoré'
                          : 'Erreur de traitement'}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {item.status === 'ERROR' && item.errorMessage
                        ? item.errorMessage
                        : item.subject || item.fromEmail || '—'}
                    </p>
                  </div>
                  <span className="text-[10px] text-muted-foreground">{new Date(item.createdAt).toLocaleTimeString()}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="border-0 shadow-sm ring-1 ring-black/5">
          <CardHeader>
            <CardTitle className="text-base">Connexion Gmail</CardTitle>
            <CardDescription>Reconnectez pour accorder lecture + brouillons (scopes mis à jour).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {status?.connected ? (
              <>
                <p className="text-sm font-medium text-leaf">Connecté : {status.email}</p>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={connectGmail}>
                    Reconnecter Gmail
                  </Button>
                  {!status.syncReady && (
                    <Button onClick={() => activate.mutate()} disabled={activate.isPending}>
                      {activate.isPending && <Loader2 size={16} className="mr-2 animate-spin" />}
                      Activer Gmail IA
                    </Button>
                  )}
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Connectez Gmail une fois. Ciblix ne crée que des brouillons — jamais d’envoi automatique.
                </p>
                <Button onClick={connectGmail}>Connecter Gmail</Button>
              </>
            )}
            <p className="text-xs text-muted-foreground">
              Sécurité : validation humaine obligatoire via le libellé « Réponse à valider ».
            </p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm ring-1 ring-black/5">
          <CardHeader>
            <CardTitle className="text-base">Paramètres</CardTitle>
            <CardDescription>Langue, ton, signature et filtres.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Langue</Label>
                <Select value={language} onValueChange={setLanguage}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fr">Français</SelectItem>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="ar">العربية</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Ton</Label>
                <Select value={tone} onValueChange={setTone}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="professionnel">Professionnel</SelectItem>
                    <SelectItem value="chaleureux">Chaleureux</SelectItem>
                    <SelectItem value="concis">Concis</SelectItem>
                    <SelectItem value="creatif">Créatif</SelectItem>
                    <SelectItem value="commercial">Commercial</SelectItem>
                    <SelectItem value="technique">Technique</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Signature</Label>
              <Input
                value={signature}
                onChange={(e) => setSignature(e.target.value)}
                placeholder="Cordialement,&#10;Kamel Talbi"
              />
            </div>
            <div className="space-y-2 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={ignoreNewsletters} onChange={(e) => setIgnoreNewsletters(e.target.checked)} />
                Ignorer newsletters / updates
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={ignorePromotions} onChange={(e) => setIgnorePromotions(e.target.checked)} />
                Ignorer promotions
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={ignoreSocial} onChange={(e) => setIgnoreSocial(e.target.checked)} />
                Ignorer réseaux sociaux
              </label>
            </div>
            <Button variant="outline" onClick={() => saveSettings.mutate()} disabled={saveSettings.isPending}>
              {saveSettings.isPending ? <Loader2 size={16} className="animate-spin" /> : 'Enregistrer'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default GmailAI;
