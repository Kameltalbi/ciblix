import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import {
  Check,
  CheckCircle2,
  ChevronRight,
  Plug,
  Plus,
  Settings2,
  Unplug,
} from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { CONNECTOR_CATALOG } from '@/lib/connectors/catalog';
import { ConnectorBrandIcon } from '@/lib/connectors/icons';
import {
  CONNECTOR_CATEGORY_ORDER,
  type ConnectorDefinition,
  type ConnectorRuntime,
  type ConnectorStatus,
} from '@/lib/connectors/types';

type GmailStatus = { connected: boolean; email?: string | null };
type GmailStats = {
  today?: { emailsRead?: number; draftsCreated?: number };
  totals?: { processed?: number; drafts?: number };
};
type IntegrationsConfig = {
  whatsapp: {
    businessAccountId: string | null;
    phoneNumberId: string | null;
    webhookTokenSet: boolean;
  };
  outboundWebhook: { targetUrl: string; enabled: boolean } | null;
};
type SoftfactureStatus = {
  configured: boolean;
  baseUrl: string | null;
  website: string;
};

function dateLocale(lang: string) {
  if (lang.startsWith('ar')) return 'ar-TN';
  if (lang.startsWith('en')) return 'en-GB';
  return 'fr-FR';
}

function formatRelative(iso: string | null | undefined, t: TFunction, locale: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const diff = Date.now() - d.getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return t('connectorsPage.justNow');
  if (mins < 60) return t('connectorsPage.minutesAgo', { count: mins });
  const hours = Math.round(mins / 60);
  if (hours < 24) return t('connectorsPage.hoursAgo', { count: hours });
  return d.toLocaleDateString(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function connectorCopy(t: TFunction, id: string, fallback: ConnectorDefinition) {
  const base = `connectorsPage.items.${id}`;
  const capabilities = t(`${base}.capabilities`, { returnObjects: true, defaultValue: fallback.capabilities });
  const permissions = t(`${base}.permissions`, { returnObjects: true, defaultValue: fallback.permissions });
  return {
    description: t(`${base}.description`, { defaultValue: fallback.description }),
    capabilities: Array.isArray(capabilities) ? (capabilities as string[]) : fallback.capabilities,
    permissions: Array.isArray(permissions) ? (permissions as string[]) : fallback.permissions,
  };
}

function StatusBadge({ status }: { status: ConnectorStatus }) {
  const { t } = useTranslation();
  if (status === 'connected') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-100">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        {t('connectorsPage.connected')}
      </span>
    );
  }
  if (status === 'expired') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800 ring-1 ring-amber-100">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
        {t('connectorsPage.expired')}
      </span>
    );
  }
  if (status === 'coming_soon') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-500 ring-1 ring-neutral-200/80">
        {t('connectorsPage.comingSoon')}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-xs font-medium text-neutral-500 ring-1 ring-neutral-200">
      <span className="h-1.5 w-1.5 rounded-full bg-neutral-300" />
      {t('connectorsPage.disconnected')}
    </span>
  );
}

function resolveConnectors(
  t: TFunction,
  locale: string,
  gmail?: GmailStatus,
  gmailStats?: GmailStats,
  integrations?: IntegrationsConfig,
  softfacture?: SoftfactureStatus
): ConnectorRuntime[] {
  return CONNECTOR_CATALOG.map((def) => {
    if (def.comingSoon) {
      return { ...def, status: 'coming_soon' as const };
    }

    if (def.id === 'gmail') {
      const connected = !!gmail?.connected;
      const emails = gmailStats?.totals?.processed ?? gmailStats?.today?.emailsRead;
      return {
        ...def,
        status: connected ? 'connected' : 'disconnected',
        accountLabel: gmail?.email ?? null,
        lastSyncAt: connected ? new Date().toISOString() : null,
        stats: connected
          ? [
              {
                label: t('connectorsPage.stats.emailsProcessed'),
                value: emails != null ? emails.toLocaleString(locale) : '—',
              },
              {
                label: t('connectorsPage.stats.draftsToday'),
                value: String(gmailStats?.today?.draftsCreated ?? 0),
              },
            ]
          : undefined,
      };
    }

    if (def.id === 'whatsapp') {
      const connected = !!(
        integrations?.whatsapp.phoneNumberId && integrations?.whatsapp.webhookTokenSet
      );
      return {
        ...def,
        status: connected ? 'connected' : 'disconnected',
        accountLabel: integrations?.whatsapp.phoneNumberId || null,
        lastSyncAt: connected ? new Date().toISOString() : null,
        stats: connected
          ? [
              { label: t('connectorsPage.stats.businessAccount'), value: t('connectorsPage.stats.configured') },
              { label: t('connectorsPage.stats.webhookMeta'), value: t('connectorsPage.stats.active') },
            ]
          : undefined,
      };
    }

    if (def.id === 'crm') {
      const connected = !!(integrations?.outboundWebhook?.enabled && integrations.outboundWebhook.targetUrl);
      return {
        ...def,
        status: connected ? 'connected' : 'disconnected',
        accountLabel: integrations?.outboundWebhook?.targetUrl || null,
        lastSyncAt: connected ? new Date().toISOString() : null,
        stats: connected
          ? [{ label: t('connectorsPage.stats.webhook'), value: t('connectorsPage.stats.active') }]
          : undefined,
      };
    }

    if (def.id === 'softfacture') {
      const connected = !!softfacture?.configured;
      return {
        ...def,
        status: connected ? 'connected' : 'disconnected',
        accountLabel: softfacture?.baseUrl || softfacture?.website || 'www.softfacture.com',
        lastSyncAt: connected ? new Date().toISOString() : null,
        stats: connected
          ? [
              { label: t('connectorsPage.stats.api'), value: t('connectorsPage.stats.configured') },
              { label: t('connectorsPage.stats.billing'), value: t('connectorsPage.stats.active') },
            ]
          : undefined,
      };
    }

    return { ...def, status: 'disconnected' as const };
  });
}

function ConnectorCard({
  connector,
  onConnect,
  onConfigure,
}: {
  connector: ConnectorRuntime;
  onConnect: (c: ConnectorRuntime) => void;
  onConfigure: (c: ConnectorRuntime) => void;
}) {
  const { t, i18n } = useTranslation();
  const locale = dateLocale(i18n.resolvedLanguage || i18n.language || 'fr');
  const syncLabel = formatRelative(connector.lastSyncAt, t, locale);
  const copy = connectorCopy(t, connector.id, connector);

  return (
    <article className="flex h-full flex-col rounded-2xl border border-neutral-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition hover:border-neutral-300 hover:shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div
          className="flex h-11 w-11 items-center justify-center rounded-xl ring-1 ring-black/5"
          style={{ backgroundColor: `${connector.accent}14` }}
        >
          <ConnectorBrandIcon id={connector.id} className="h-6 w-6" />
        </div>
        <StatusBadge status={connector.status} />
      </div>

      <h3 className="text-[15px] font-semibold tracking-tight text-neutral-900">{connector.name}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-neutral-500">{copy.description}</p>

      {connector.status === 'connected' && connector.accountLabel ? (
        <p className="mt-3 truncate text-xs text-neutral-400">{connector.accountLabel}</p>
      ) : null}

      {connector.status === 'connected' && (syncLabel || connector.stats?.length) ? (
        <div className="mt-4 space-y-2 rounded-xl bg-neutral-50/80 px-3 py-2.5">
          {syncLabel ? (
            <p className="text-[11px] font-medium uppercase tracking-wide text-neutral-400">
              {t('connectorsPage.lastSync', { when: syncLabel })}
            </p>
          ) : null}
          {connector.stats?.length ? (
            <ul className="space-y-1">
              {connector.stats.map((s) => (
                <li key={s.label} className="flex justify-between text-sm text-neutral-600">
                  <span>{s.label}</span>
                  <span className="font-semibold tabular-nums text-neutral-900">{s.value}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <ul className="mt-4 space-y-1.5">
        {copy.capabilities.map((cap) => (
          <li key={cap} className="flex items-start gap-2 text-[13px] text-neutral-600">
            <Check size={14} className="mt-0.5 shrink-0 text-[#016AEB]" strokeWidth={2.5} />
            {cap}
          </li>
        ))}
      </ul>

      <div className="mt-auto flex flex-wrap gap-2 pt-5">
        {connector.status === 'coming_soon' ? (
          <Button variant="outline" size="sm" disabled className="rounded-xl">
            {t('connectorsPage.soonAvailable')}
          </Button>
        ) : connector.status === 'connected' || connector.status === 'expired' ? (
          <>
            <Button variant="outline" size="sm" className="rounded-xl" onClick={() => onConfigure(connector)}>
              <Settings2 size={14} className="mr-1.5" />
              {t('connectorsPage.configure')}
            </Button>
            {connector.id === 'gmail' ? (
              <Button variant="ghost" size="sm" className="rounded-xl text-neutral-500" onClick={() => onConnect(connector)}>
                <Unplug size={14} className="mr-1.5" />
                {t('connectorsPage.reconnect')}
              </Button>
            ) : null}
          </>
        ) : (
          <Button size="sm" className="rounded-xl" onClick={() => onConnect(connector)}>
            {t('connectorsPage.connect')}
            <ChevronRight size={14} className="ml-1" />
          </Button>
        )}
      </div>
    </article>
  );
}

function ConnectWizard({
  open,
  connector,
  onOpenChange,
}: {
  open: boolean;
  connector: ConnectorDefinition | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [success, setSuccess] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setStep(1);
      setSuccess(false);
      setBusy(false);
      setError(null);
    }
  }, [open, connector?.id]);

  if (!connector) return null;

  const copy = connectorCopy(t, connector.id, connector);

  const finishConnect = async () => {
    setBusy(true);
    setError(null);
    try {
      if (connector.id === 'gmail') {
        const { data } = await api.get<{ url: string }>('/gmail/auth');
        setSuccess(true);
        setTimeout(() => {
          window.location.href = data.url;
        }, 700);
        return;
      }
      if (connector.externalUrl) {
        setSuccess(true);
        setTimeout(() => {
          window.open(connector.externalUrl, '_blank', 'noopener,noreferrer');
          onOpenChange(false);
        }, 700);
        return;
      }
      if (connector.configureHref) {
        setSuccess(true);
        setTimeout(() => {
          onOpenChange(false);
          navigate(connector.configureHref!);
        }, 900);
        return;
      }
      setSuccess(true);
      setTimeout(() => onOpenChange(false), 1200);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('connectorsPage.connectFailed'));
    } finally {
      setBusy(false);
    }
  };

  const authBody =
    connector.authType === 'oauth'
      ? t('connectorsPage.authOauth', { name: connector.name })
      : connector.authType === 'webhook'
        ? t('connectorsPage.authWebhook', { name: connector.name })
        : t('connectorsPage.authApi', { name: connector.name });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-2xl border-neutral-200 bg-white p-0 sm:rounded-2xl">
        {success ? (
          <div className="flex flex-col items-center px-8 py-12 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 animate-in zoom-in-50 duration-300">
              <CheckCircle2 size={36} />
            </div>
            <p className="text-lg font-semibold text-neutral-900">
              {t('connectorsPage.ready', { name: connector.name })}
            </p>
            <p className="mt-1 text-sm text-neutral-500">
              {connector.id === 'gmail' ? t('connectorsPage.redirectGoogle') : t('connectorsPage.openConfig')}
            </p>
          </div>
        ) : (
          <>
            <DialogHeader className="border-b border-neutral-100 px-6 py-5">
              <div className="flex items-center gap-3">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-xl"
                  style={{ backgroundColor: `${connector.accent}14` }}
                >
                  <ConnectorBrandIcon id={connector.id} />
                </div>
                <div>
                  <DialogTitle className="text-base font-semibold">
                    {t('connectorsPage.connectName', { name: connector.name })}
                  </DialogTitle>
                  <p className="text-xs text-neutral-500">{t('connectorsPage.wizardSteps')}</p>
                </div>
              </div>
              <div className="mt-4 flex gap-1.5">
                {[1, 2, 3].map((s) => (
                  <div
                    key={s}
                    className={cn(
                      'h-1 flex-1 rounded-full transition-colors',
                      s <= step ? 'bg-[#016AEB]' : 'bg-neutral-150 bg-neutral-200'
                    )}
                  />
                ))}
              </div>
            </DialogHeader>

            <div className="px-6 py-5">
              {step === 1 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-neutral-900">{t('connectorsPage.stepConnect')}</h4>
                  <p className="text-sm leading-relaxed text-neutral-500">{authBody}</p>
                  <div className="rounded-xl border border-neutral-100 bg-neutral-50 px-3 py-2.5 text-xs text-neutral-500">
                    {t('connectorsPage.authType')} ·{' '}
                    <span className="font-semibold uppercase text-neutral-700">
                      {connector.authType.replace('_', ' ')}
                    </span>
                  </div>
                </div>
              )}
              {step === 2 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-neutral-900">{t('connectorsPage.stepPerms')}</h4>
                  <p className="text-sm text-neutral-500">{t('connectorsPage.permsIntro')}</p>
                  <ul className="space-y-2">
                    {copy.permissions.map((p) => (
                      <li
                        key={p}
                        className="flex items-start gap-2 rounded-xl border border-neutral-100 bg-white px-3 py-2 text-sm text-neutral-700"
                      >
                        <Check size={14} className="mt-0.5 shrink-0 text-[#016AEB]" />
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {step === 3 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-neutral-900">{t('connectorsPage.stepConfirm')}</h4>
                  <p className="text-sm leading-relaxed text-neutral-500">
                    {t('connectorsPage.confirmBody', { name: connector.name })}
                  </p>
                  {error ? <p className="text-sm text-red-600">{error}</p> : null}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-2 border-t border-neutral-100 px-6 py-4">
              <Button
                variant="ghost"
                size="sm"
                className="rounded-xl"
                disabled={busy || step === 1}
                onClick={() => setStep((s) => Math.max(1, s - 1))}
              >
                {t('connectorsPage.back')}
              </Button>
              {step < 3 ? (
                <Button size="sm" className="rounded-xl" onClick={() => setStep((s) => s + 1)}>
                  {t('connectorsPage.continue')}
                </Button>
              ) : (
                <Button size="sm" className="rounded-xl" disabled={busy} onClick={() => void finishConnect()}>
                  {busy
                    ? t('connectorsPage.connecting')
                    : t('connectorsPage.connectName', { name: connector.name })}
                </Button>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function Connecteurs() {
  const { t, i18n } = useTranslation();
  const locale = dateLocale(i18n.resolvedLanguage || i18n.language || 'fr');
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [wizardOpen, setWizardOpen] = useState(false);
  const [active, setActive] = useState<ConnectorDefinition | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const { data: gmailStatus } = useQuery<GmailStatus>({
    queryKey: ['gmail-status'],
    queryFn: () => api.get('/gmail/status').then((r) => r.data),
  });

  const { data: gmailStats } = useQuery<GmailStats>({
    queryKey: ['gmail-ai-statistics'],
    queryFn: () => api.get('/gmail-ai/statistics').then((r) => r.data),
    enabled: !!gmailStatus?.connected,
  });

  const { data: integrations } = useQuery<IntegrationsConfig>({
    queryKey: ['integrations-config'],
    queryFn: () => api.get('/integrations/config').then((r) => r.data),
  });

  const { data: softfactureStatus } = useQuery<SoftfactureStatus>({
    queryKey: ['softfacture-status'],
    queryFn: () => api.get('/softfacture/status').then((r) => r.data),
  });

  useEffect(() => {
    if (params.get('gmail') === 'connected') {
      setToast(t('connectorsPage.gmailConnected'));
      void qc.invalidateQueries({ queryKey: ['gmail-status'] });
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [params, qc, t]);

  const connectors = useMemo(
    () => resolveConnectors(t, locale, gmailStatus, gmailStats, integrations, softfactureStatus),
    [t, locale, gmailStatus, gmailStats, integrations, softfactureStatus]
  );

  const byCategory = useMemo(() => {
    return CONNECTOR_CATEGORY_ORDER.map((cat) => ({
      id: cat,
      label: t(`connectorsPage.categories.${cat}`),
      items: connectors.filter((c) => c.category === cat),
    })).filter((g) => g.items.length > 0);
  }, [connectors, t]);

  const availableToConnect = connectors.filter(
    (c) => c.status === 'disconnected' || c.status === 'expired'
  );

  const openWizard = (c: ConnectorDefinition) => {
    setActive(c);
    setWizardOpen(true);
  };

  const onConfigure = (c: ConnectorRuntime) => {
    if (c.externalUrl) {
      window.open(c.externalUrl, '_blank', 'noopener,noreferrer');
      return;
    }
    if (c.configureHref) navigate(c.configureHref);
    else openWizard(c);
  };

  return (
    <div className="min-h-full bg-[#FAFBFC]">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {toast ? (
          <div className="mb-6 flex items-center gap-2 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
            <CheckCircle2 size={16} />
            {toast}
          </div>
        ) : null}

        <header className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs font-medium text-neutral-500">
              <Plug size={12} className="text-[#016AEB]" />
              {t('connectorsPage.openPlatform')}
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-neutral-900 sm:text-[2rem]">
              {t('connectorsPage.title')}
            </h1>
            <p className="mt-2 text-base leading-relaxed text-neutral-500">{t('connectorsPage.subtitle')}</p>
          </div>
          <Button
            className="shrink-0 rounded-xl shadow-sm"
            onClick={() => setPickerOpen(true)}
            disabled={availableToConnect.length === 0}
          >
            <Plus size={16} className="mr-1.5" />
            {t('connectorsPage.connectTool')}
          </Button>
        </header>

        <div className="space-y-12">
          {byCategory.map((group) => (
            <section key={group.id}>
              <div className="mb-4 flex items-baseline justify-between gap-3">
                <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-neutral-400">
                  {group.label}
                </h2>
                <span className="text-xs text-neutral-400">{group.items.length}</span>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {group.items.map((c) => (
                  <ConnectorCard
                    key={c.id}
                    connector={c}
                    onConnect={openWizard}
                    onConfigure={onConfigure}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>

        <p className="mt-14 max-w-2xl text-sm leading-relaxed text-neutral-400">
          {t('connectorsPage.footer')}
        </p>
      </div>

      <ConnectWizard open={wizardOpen} connector={active} onOpenChange={setWizardOpen} />

      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="max-w-md rounded-2xl sm:rounded-2xl">
          <DialogHeader>
            <DialogTitle>{t('connectorsPage.pickTool')}</DialogTitle>
          </DialogHeader>
          <ul className="max-h-[60vh] space-y-1 overflow-y-auto py-1">
            {availableToConnect.map((c) => {
              const copy = connectorCopy(t, c.id, c);
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-neutral-50"
                    onClick={() => {
                      setPickerOpen(false);
                      openWizard(c);
                    }}
                  >
                    <div
                      className="flex h-9 w-9 items-center justify-center rounded-lg"
                      style={{ backgroundColor: `${c.accent}14` }}
                    >
                      <ConnectorBrandIcon id={c.id} className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-neutral-900">{c.name}</p>
                      <p className="truncate text-xs text-neutral-500">{copy.description}</p>
                    </div>
                    <ChevronRight size={16} className="shrink-0 text-neutral-300" />
                  </button>
                </li>
              );
            })}
            {availableToConnect.length === 0 ? (
              <li className="px-3 py-6 text-center text-sm text-neutral-500">
                {t('connectorsPage.allConnected')}
              </li>
            ) : null}
          </ul>
        </DialogContent>
      </Dialog>
    </div>
  );
}
