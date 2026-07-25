import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/form-controls';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SoftfactureSettings } from '@/components/settings/SoftfactureSettings';

type IntegrationsConfig = {
  whatsapp: {
    businessAccountId: string | null;
    phoneNumberId: string | null;
    webhookTokenSet: boolean;
    sessionTimeoutMinutes: number;
    webhookUrl: string;
  };
  telephony: {
    webhookSecretSet: boolean;
    consentMode: 'DISABLED' | 'CLIENT_RESPONSIBLE';
    consentConfirmedAt: string | null;
    webhookUrl: string;
  };
  zoom: { configured: boolean; webhookUrl: string };
  outboundWebhook: {
    targetUrl: string;
    enabled: boolean;
    eventTypes: string[];
    secretSet: boolean;
  } | null;
};

const EVENT_TYPES = ['APPEL', 'WHATSAPP', 'EMAIL', 'NOTE', 'OPPORTUNITE'] as const;

export function IntegrationsSettings() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<IntegrationsConfig>({
    queryKey: ['integrations-config'],
    queryFn: () => api.get('/integrations/config').then((r) => r.data),
  });

  const [waAccount, setWaAccount] = useState('');
  const [waPhone, setWaPhone] = useState('');
  const [waTimeout, setWaTimeout] = useState('30');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [webhookEnabled, setWebhookEnabled] = useState(false);
  const [webhookTypes, setWebhookTypes] = useState<string[]>([]);
  const [telSecret, setTelSecret] = useState('');
  const [telMode, setTelMode] = useState<'DISABLED' | 'CLIENT_RESPONSIBLE'>('DISABLED');
  const [telConfirm, setTelConfirm] = useState(false);
  const [zoomToken, setZoomToken] = useState('');

  useEffect(() => {
    if (!data) return;
    setWaAccount(data.whatsapp.businessAccountId || '');
    setWaPhone(data.whatsapp.phoneNumberId || '');
    setWaTimeout(String(data.whatsapp.sessionTimeoutMinutes));
    setWebhookUrl(data.outboundWebhook?.targetUrl || '');
    setWebhookEnabled(data.outboundWebhook?.enabled || false);
    setWebhookTypes(data.outboundWebhook?.eventTypes || []);
    setTelMode(data.telephony.consentMode);
  }, [data]);

  const saveWa = useMutation({
    mutationFn: () =>
      api
        .put('/integrations/config/whatsapp', {
          whatsappBusinessAccountId: waAccount.trim() || null,
          whatsappPhoneNumberId: waPhone.trim() || null,
          whatsappSessionTimeoutMinutes: Number(waTimeout) || 30,
        })
        .then((r) => r.data),
    onSuccess: (data: {
      businessAccountId?: string | null;
      phoneNumberId?: string | null;
      webhookToken?: string | null;
      webhookTokenCreated?: boolean;
      sessionTimeoutMinutes?: number;
    }) => {
      void qc.invalidateQueries({ queryKey: ['integrations-config'] });
      if (data.webhookTokenCreated && data.webhookToken) {
        alert(
          `Configuration WhatsApp enregistrée.\n\nVerify token Meta (à coller une fois) :\n${data.webhookToken}`
        );
      } else {
        alert('Configuration WhatsApp enregistrée');
      }
    },
  });

  const saveWebhook = useMutation({
    mutationFn: () => {
      if (!webhookUrl.trim()) throw new Error('URL cible requise');
      if (!webhookSecret.trim() && !data?.outboundWebhook?.secretSet) {
        throw new Error('Secret webhook requis');
      }
      return api
        .put('/integrations/config/outbound-webhook', {
          targetUrl: webhookUrl.trim(),
          ...(webhookSecret.trim() ? { secret: webhookSecret.trim() } : {}),
          enabled: webhookEnabled,
          eventTypes: webhookTypes,
        })
        .then((r) => r.data);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['integrations-config'] });
      alert('Webhook sortant enregistré');
    },
    onError: (e: Error) => alert(e.message),
  });

  const saveTel = useMutation({
    mutationFn: () =>
      api
        .put('/integrations/config/telephony', {
          telephonyWebhookSecret: telSecret.trim() || null,
          telephonyRecordingConsentMode: telMode,
          confirmClientResponsible: telConfirm,
        })
        .then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['integrations-config'] });
      alert('Configuration téléphonie enregistrée');
    },
    onError: (e: { response?: { data?: { error?: string } } }) => {
      alert(e?.response?.data?.error || 'Erreur');
    },
  });

  const saveZoom = useMutation({
    mutationFn: () =>
      api.put('/integrations/config/zoom', { zoomOAuthToken: zoomToken.trim() || null }).then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['integrations-config'] });
      alert('Token Zoom enregistré');
    },
  });

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Chargement des intégrations…</p>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="text-base">WhatsApp Business</CardTitle>
            {data?.whatsapp.phoneNumberId && data.whatsapp.webhookTokenSet ? (
              <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase text-emerald-700">
                Configuré
              </span>
            ) : (
              <span className="rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-800">
                Non connecté
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Pour synchroniser automatiquement les messages Meta WhatsApp Business Cloud API. Sans ça, l’Assistant IA
            analyse seulement le texte WhatsApp que vous collez manuellement. Consentement one-shot requis par contact.
            Le client reste responsable de l&apos;obtention légale du consentement.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label>Business Account ID (Meta)</Label>
            <Input
              value={waAccount}
              onChange={(e) => setWaAccount(e.target.value)}
              placeholder="Ex. 123456789012345"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Phone Number ID (Meta)</Label>
            <Input
              value={waPhone}
              onChange={(e) => setWaPhone(e.target.value)}
              placeholder="Ex. 109876543210987"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Timeout session (minutes)</Label>
            <Input type="number" value={waTimeout} onChange={(e) => setWaTimeout(e.target.value)} />
          </div>
          {data?.whatsapp.webhookUrl ? (
            <div className="space-y-1 rounded-md border border-border/60 bg-muted/30 p-3">
              <p className="text-xs font-medium text-foreground">Webhook à coller dans Meta</p>
              <p className="break-all font-mono text-[11px] text-muted-foreground">{data.whatsapp.webhookUrl}</p>
              <p className="text-[11px] text-muted-foreground">
                Après enregistrement, le verify token est renvoyé une fois — conservez-le pour Meta.
              </p>
            </div>
          ) : null}
          <Button type="button" onClick={() => saveWa.mutate()} disabled={saveWa.isPending}>
            {saveWa.isPending ? 'Enregistrement…' : 'Enregistrer WhatsApp'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Webhook CRM externe</CardTitle>
          <p className="text-xs text-muted-foreground">
            Pousse les AgentEvent vers HubSpot, Zoho, Salesforce… Signature HMAC dans{' '}
            <code>X-Ciblix-Signature</code>. Désactivé par défaut.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label>URL cible</Label>
            <Input value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)} placeholder="https://..." />
          </div>
          <div className="space-y-1.5">
            <Label>Secret HMAC</Label>
            <Input
              type="password"
              value={webhookSecret}
              onChange={(e) => setWebhookSecret(e.target.value)}
              placeholder={data?.outboundWebhook?.secretSet ? '••••••••' : 'secret'}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={webhookEnabled} onChange={(e) => setWebhookEnabled(e.target.checked)} />
            Activer le webhook sortant
          </label>
          <div className="flex flex-wrap gap-2">
            {EVENT_TYPES.map((t) => (
              <label key={t} className="flex items-center gap-1 text-xs border rounded px-2 py-1">
                <input
                  type="checkbox"
                  checked={webhookTypes.includes(t)}
                  onChange={(e) => {
                    setWebhookTypes((prev) =>
                      e.target.checked ? [...prev, t] : prev.filter((x) => x !== t)
                    );
                  }}
                />
                {t}
              </label>
            ))}
          </div>
          <Button type="button" onClick={() => saveWebhook.mutate()} disabled={saveWebhook.isPending}>
            Enregistrer webhook
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Téléphonie / Visio (Zoom)</CardTitle>
          <p className="text-xs text-muted-foreground">
            Désactivé par défaut. Mode <strong>CLIENT_RESPONSIBLE</strong> : le client atteste gérer le consentement
            d&apos;enregistrement à chaque appel.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label>Secret webhook téléphonie</Label>
            <Input type="password" value={telSecret} onChange={(e) => setTelSecret(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Mode consentement</Label>
            <select
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={telMode}
              onChange={(e) => setTelMode(e.target.value as 'DISABLED' | 'CLIENT_RESPONSIBLE')}
            >
              <option value="DISABLED">Désactivé</option>
              <option value="CLIENT_RESPONSIBLE">Client responsable (activé)</option>
            </select>
          </div>
          {telMode === 'CLIENT_RESPONSIBLE' ? (
            <label className="flex items-start gap-2 text-xs text-muted-foreground">
              <input type="checkbox" checked={telConfirm} onChange={(e) => setTelConfirm(e.target.checked)} />
              J&apos;atteste que mon organisation gère le consentement d&apos;enregistrement des appels conformément à la
              réglementation applicable.
            </label>
          ) : null}
          {data?.telephony.webhookUrl ? (
            <p className="text-xs text-muted-foreground break-all">Webhook téléphonie : {data.telephony.webhookUrl}</p>
          ) : null}
          <Button type="button" onClick={() => saveTel.mutate()} disabled={saveTel.isPending}>
            Enregistrer téléphonie
          </Button>

          <hr className="my-4" />

          <div className="space-y-1.5">
            <Label>Zoom OAuth token</Label>
            <Input type="password" value={zoomToken} onChange={(e) => setZoomToken(e.target.value)} />
          </div>
          {data?.zoom.webhookUrl ? (
            <p className="text-xs text-muted-foreground break-all">Webhook Zoom : {data.zoom.webhookUrl}</p>
          ) : null}
          <Button type="button" variant="outline" onClick={() => saveZoom.mutate()} disabled={saveZoom.isPending}>
            Enregistrer Zoom
          </Button>
        </CardContent>
      </Card>

      <SoftfactureSettings />
    </div>
  );
}
