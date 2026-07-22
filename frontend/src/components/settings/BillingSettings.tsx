import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const TIERS = [
  { id: 'DECOUVERTE', label: 'Découverte', limit: 50 },
  { id: 'CROISSANCE', label: 'Croissance', limit: 200 },
  { id: 'PRO', label: 'Pro', limit: 1000 },
  { id: 'ENTERPRISE', label: 'Enterprise', limit: 5000 },
] as const;

export function BillingSettings() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<{
    tier: string;
    tierLabel: string;
    status: string;
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
        </p>
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
