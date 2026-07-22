import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type TrialAgentRow = {
  slug: string;
  label: string;
  usageCount: number;
  summary: string;
};

export function ChooseDiscoveryAgent() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['billing-trial-agents'],
    queryFn: () =>
      api.get('/billing/trial-agents').then(
        (r) =>
          r.data as {
            tier: string;
            status: string;
            selectedDiscoveryAgent: string | null;
            canSelect: boolean;
            agents: TrialAgentRow[];
          }
      ),
  });

  const save = useMutation({
    mutationFn: (agentSlug: string) =>
      api.post('/billing/select-discovery-agent', { agentSlug }).then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['billing-status'] });
      void qc.invalidateQueries({ queryKey: ['billing-trial-agents'] });
      void qc.invalidateQueries({ queryKey: ['agents-marketplace'] });
      navigate('/settings');
    },
    onError: (e: { response?: { data?: { error?: string } } }) => {
      alert(e?.response?.data?.error || 'Impossible d’enregistrer le choix');
    },
  });

  const current = selected || data?.selectedDiscoveryAgent || null;

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-2 md:px-0">
      <Link
        to="/settings"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft size={14} /> Retour aux paramètres
      </Link>

      <div>
        <h1 className="font-serif text-2xl md:text-3xl">Choisir mon agent</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Le palier Découverte inclut 1 agent. Choisissez lequel garder après l’essai — vous pourrez
          modifier ce choix plus tard.
        </p>
      </div>

      {isLoading ? <p className="text-sm text-muted-foreground">Chargement…</p> : null}
      {error ? <p className="text-sm text-destructive">Impossible de charger les agents d’essai.</p> : null}

      {data && !data.canSelect ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Cette sélection est réservée au palier Découverte. Votre palier actuel : {data.tier}.
        </p>
      ) : null}

      <div className="space-y-3">
        {(data?.agents || []).map((agent) => {
          const isSelected = current === agent.slug;
          return (
            <button
              key={agent.slug}
              type="button"
              disabled={!data?.canSelect}
              onClick={() => setSelected(agent.slug)}
              className={cn(
                'w-full rounded-xl border p-4 text-left transition-colors',
                isSelected ? 'border-leaf bg-leaf/5 ring-1 ring-leaf/30' : 'border-border hover:bg-muted/40',
                !data?.canSelect && 'opacity-60'
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-foreground">{agent.label}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{agent.summary}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{agent.usageCount} actions ce mois</p>
                </div>
                {isSelected ? <CheckCircle2 className="h-5 w-5 shrink-0 text-leaf" /> : null}
              </div>
            </button>
          );
        })}
      </div>

      <Button
        disabled={!current || !data?.canSelect || save.isPending}
        onClick={() => current && save.mutate(current)}
      >
        {save.isPending ? 'Enregistrement…' : 'Confirmer mon choix'}
      </Button>
    </div>
  );
}
