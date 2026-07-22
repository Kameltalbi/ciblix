import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';

type TrialBanner = {
  daysLeft: number;
  tier: string;
  tierLabel: string;
  needsDiscoveryChoice: boolean;
  trialAgents: Array<{ slug: string; label: string }>;
};

export function TrialEndingBanner() {
  const { data } = useQuery({
    queryKey: ['billing-status'],
    queryFn: () =>
      api.get('/billing/status').then(
        (r) =>
          r.data as {
            status: string;
            trialBanner: TrialBanner | null;
          }
      ),
    staleTime: 60_000,
  });

  const banner = data?.trialBanner;
  if (!banner) return null;

  const agentNames = banner.trialAgents.map((a) => a.label).join(', ');
  const dayLabel =
    banner.daysLeft <= 0
      ? "aujourd'hui"
      : banner.daysLeft === 1
        ? 'dans 1 jour'
        : `dans ${banner.daysLeft} jours`;

  return (
    <div className="mb-6 rounded-2xl border border-amber-200/80 bg-gradient-to-r from-amber-50 to-sky-50 px-4 py-3 sm:px-5">
      <p className="text-sm font-medium text-foreground">
        Votre essai se termine {dayLabel}. Vous testez actuellement {agentNames}.
      </p>
      {banner.needsDiscoveryChoice ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <p className="text-sm text-muted-foreground">
            Le palier Découverte inclut 1 agent. Choisissez lequel garder avant la fin de l’essai.
          </p>
          <Button asChild size="sm" variant="outline">
            <Link to="/settings/billing/choose-agent">Choisir mon agent →</Link>
          </Button>
        </div>
      ) : (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <p className="text-sm text-muted-foreground">
            Passez au palier {banner.tierLabel} pour garder ces agents actifs sans interruption.
          </p>
          <Button asChild size="sm" variant="outline">
            <Link to="/settings">Ajouter un moyen de paiement →</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
