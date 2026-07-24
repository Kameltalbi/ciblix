import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const TIERS = [
  {
    id: 'DECOUVERTE',
    label: 'Essentiel',
    priceMonth: 65,
    priceYear: 650,
    users: 1,
    limit: 100,
    blurb: 'Solution complète · 100 actions IA / mois',
  },
  {
    id: 'CROISSANCE',
    label: 'Croissance',
    priceMonth: 89,
    priceYear: 890,
    users: 3,
    limit: 300,
    blurb: 'Solution complète · 300 actions IA / mois',
  },
  {
    id: 'PRO',
    label: 'Pro',
    priceMonth: 129,
    priceYear: 1290,
    users: 10,
    limit: 1000,
    blurb: 'Solution complète · 1 000 actions IA / mois',
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

        <div className="grid gap-2 sm:grid-cols-3">
          {TIERS.map((t) => (
            <div key={t.id} className="border rounded-lg p-3 text-sm">
              <p className="font-semibold">{t.label}</p>
              <p className="text-muted-foreground">
                {t.priceMonth} TND/mois · {t.priceYear} TND/an
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {t.users} user{t.users > 1 ? 's' : ''} · {t.limit} actions
              </p>
              <p className="text-xs text-muted-foreground mt-1">{t.blurb}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {data?.tier !== t.id ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={changeTier.isPending}
                    onClick={() => changeTier.mutate(t.id)}
                  >
                    Choisir
                  </Button>
                ) : (
                  <span className="text-xs text-leaf font-medium self-center">Actuel</span>
                )}
                <Button size="sm" disabled={checkout.isPending} onClick={() => checkout.mutate(t.id)}>
                  Payer
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
