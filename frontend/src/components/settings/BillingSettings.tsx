import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const TIERS = [
  {
    id: 'DECOUVERTE',
    label: 'Découverte',
    priceTnd: 29,
    users: 1,
    limit: 50,
    agents: '1 agent au choix parmi les 6',
  },
  {
    id: 'CROISSANCE',
    label: 'Croissance',
    priceTnd: 85,
    users: 3,
    limit: 200,
    agents: 'Chasseur IA, Assistant IA, Gmail IA',
  },
  {
    id: 'PRO',
    label: 'Pro',
    priceTnd: 149,
    users: 10,
    limit: 1000,
    agents: 'Les 6 agents (Chasseur, Assistant, Gmail, Veilleur, Rédacteur, Vérificateur)',
  },
  {
    id: 'ENTERPRISE',
    label: 'Entreprise',
    priceTnd: null as number | null,
    users: null as number | null,
    limit: 5000,
    agents: 'Tous les agents Pro + BrandPulse / config sectorielle',
  },
] as const;

export function BillingSettings() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<{
    tier: string;
    tierLabel: string;
    status: string;
    trialEndsAt?: string;
    readOnly?: boolean;
    selectedDiscoveryAgent?: string | null;
    usage: { used: number; limit: number; overLimit: boolean; softCap: boolean };
  }>({
    queryKey: ['billing-status'],
    queryFn: () => api.get('/billing/status').then((r) => r.data),
  });

  const changeTier = useMutation({
    mutationFn: (tier: string) => api.post('/billing/change-tier', { tier }).then((r) => r.data),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['billing-status'] }),
    onError: (e: { response?: { data?: { error?: string } } }) => {
      alert(e?.response?.data?.error || 'Erreur');
    },
  });

  const checkout = useMutation({
    mutationFn: (tier: string) =>
      api.post('/billing/checkout', { tier, currency: 'TND' }).then((r) => r.data as { url?: string; message?: string }),
    onSuccess: (result) => {
      if (result.url) window.location.href = result.url;
      else if (result.message) alert(result.message);
      void qc.invalidateQueries({ queryKey: ['billing-status'] });
    },
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Chargement…</p>;

  const pct = data ? Math.min(100, Math.round((data.usage.used / data.usage.limit) * 100)) : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Facturation</CardTitle>
        <p className="text-xs text-muted-foreground">
          Palier actuel : <strong>{data?.tierLabel}</strong> ({data?.status})
          {data?.trialEndsAt && data.status === 'TRIALING' ? (
            <> · fin d&apos;essai : {new Date(data.trialEndsAt).toLocaleDateString('fr-FR')}</>
          ) : null}
        </p>
        {data?.readOnly ? (
          <p className="text-xs text-amber-700 bg-amber-50 rounded-md px-2 py-1 mt-2">
            Essai terminé — lecture seule. Ajoutez un moyen de paiement pour relancer les agents.
          </p>
        ) : null}
        {data?.status === 'TRIALING' && data?.tier === 'DECOUVERTE' ? (
          <p className="text-xs text-sky-800 bg-sky-50 rounded-md px-2 py-1 mt-2">
            Essai Découverte : choisissez l’agent à garder après les 7 jours.{' '}
            <a href="/settings/billing/choose-agent" className="underline font-medium">
              Choisir mon agent
            </a>
            {data.selectedDiscoveryAgent ? ` · actuel : ${data.selectedDiscoveryAgent}` : ''}
          </p>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span>Actions agents ce mois</span>
            <span>
              {data?.usage.used} / {data?.usage.limit}
              {data?.usage.overLimit ? ' (dépassement — soft-cap actif)' : ''}
            </span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-leaf transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          {TIERS.map((t) => (
            <div key={t.id} className="border rounded-lg p-3 text-sm">
              <p className="font-medium">{t.label}</p>
              <p className="text-xs text-muted-foreground">
                {t.priceTnd != null ? `${t.priceTnd} TND/mois` : 'Sur devis'}
                {' · '}
                {t.users != null ? `${t.users} utilisateur${t.users > 1 ? 's' : ''}` : 'utilisateurs illimités'}
              </p>
              <p className="text-xs text-muted-foreground">{t.agents}</p>
              <p className="text-xs text-muted-foreground">{t.limit} actions / mois</p>
              <div className="flex gap-2 mt-2">
                {t.id === 'DECOUVERTE' ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={data?.tier === t.id || changeTier.isPending}
                    onClick={() => changeTier.mutate(t.id)}
                  >
                    Activer
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={checkout.isPending}
                    onClick={() => checkout.mutate(t.id)}
                  >
                    Choisir
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
