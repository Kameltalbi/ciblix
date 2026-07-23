import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Radio,
  Bot,
  Radar,
  FileSignature,
  ShieldCheck,
  Power,
  PowerOff,
  ArrowRight,
  Loader2,
  Lock,
  Megaphone,
  Mail,
  Settings2,
} from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

interface Agent {
  slug: string;
  name: string;
  role: string;
  whenToUse?: string;
  description: string;
  icon: string;
  color: string;
  features: string[];
  route: string;
  active: boolean;
  activatedAt: string | null;
  includedInPlan: boolean;
  canActivate: boolean;
  requiredPlanLabel: string | null;
}

interface AgentUsageRow {
  agentSlug: string;
  usage: number;
  limit: number;
}

const ICON_MAP: Record<string, LucideIcon> = {
  Radio,
  Bot,
  Radar,
  FileSignature,
  ShieldCheck,
  Megaphone,
  Mail,
};

export function AgentsMarketplace() {
  const queryClient = useQueryClient();

  const { data, isPending } = useQuery<{ agents: Agent[]; plan: string; planLabel: string }>({
    queryKey: ['agents-marketplace'],
    queryFn: () => api.get('/agents').then((r) => r.data),
  });

  const { data: usageData } = useQuery<{ usage: AgentUsageRow[]; planLabel: string }>({
    queryKey: ['agents-usage'],
    queryFn: () => api.get('/agents/usage').then((r) => r.data),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ slug, active }: { slug: string; active: boolean }) =>
      api.post(`/agents/${slug}/${active ? 'deactivate' : 'activate'}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents-marketplace'] });
      queryClient.invalidateQueries({ queryKey: ['agents-active-slugs'] });
      queryClient.invalidateQueries({ queryKey: ['agents-usage'] });
      queryClient.invalidateQueries({ queryKey: ['ops-overview'] });
    },
  });

  const agents = data?.agents || [];
  const usageMap = Object.fromEntries((usageData?.usage || []).map((u) => [u.agentSlug, u]));
  const activeCount = agents.filter((a) => a.active).length;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Flotte
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">Agents IA</h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Chaque agent a un job précis dans le cycle de vente. Plan {data?.planLabel ?? '…'} ·{' '}
            {activeCount} actif{activeCount > 1 ? 's' : ''}.
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link to="/pricing">Plans</Link>
        </Button>
      </div>

      <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">Comment les lire</p>
        <p className="mt-1">
          <span className="text-foreground">Chasseur</span> = trouver des clients ·{' '}
          <span className="text-foreground">Veilleur</span> = opportunités marché ·{' '}
          <span className="text-foreground">Assistant / Gmail</span> = écrire & prioriser ·{' '}
          <span className="text-foreground">Rédacteur</span> = offres ·{' '}
          <span className="text-foreground">BrandPulse</span> = présence web.
        </p>
      </div>

      {isPending ? (
        <div className="py-16 text-center text-muted-foreground">
          <Loader2 size={20} className="mx-auto mb-2 animate-spin" />
          Chargement…
        </div>
      ) : (
        <div className="space-y-3">
          {agents.map((agent) => {
            const Icon = ICON_MAP[agent.icon] || Bot;
            const locked = !agent.includedInPlan;
            const usage = usageMap[agent.slug];
            const toggling =
              toggleMutation.isPending && toggleMutation.variables?.slug === agent.slug;

            return (
              <div
                key={agent.slug}
                className="rounded-lg border border-border bg-white px-4 py-4"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 gap-3">
                    <div
                      className={cn(
                        'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
                        agent.active
                          ? 'bg-primary/10 text-primary'
                          : 'bg-muted text-muted-foreground'
                      )}
                    >
                      <Icon size={18} />
                    </div>
                    <div className="min-w-0 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold tracking-tight">{agent.name}</p>
                        {locked ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground">
                            <Lock size={10} /> {agent.requiredPlanLabel}
                          </span>
                        ) : (
                          <span
                            className={cn(
                              'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase',
                              agent.active
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-slate-100 text-slate-500'
                            )}
                          >
                            <span
                              className={cn(
                                'h-1.5 w-1.5 rounded-full',
                                agent.active ? 'bg-emerald-500' : 'bg-slate-400'
                              )}
                            />
                            {agent.active ? 'Actif' : 'Inactif'}
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-medium text-foreground">{agent.role}</p>
                      {agent.whenToUse ? (
                        <p className="text-sm text-muted-foreground">
                          <span className="font-medium text-foreground/80">À utiliser : </span>
                          {agent.whenToUse}
                        </p>
                      ) : null}
                      <p className="text-sm leading-relaxed text-muted-foreground">
                        {agent.description}
                      </p>
                      {(usage || (agent.activatedAt && agent.active)) && (
                        <p className="text-xs text-muted-foreground/80">
                          {usage ? (
                            <span>
                              {usage.usage}/{usage.limit} ce mois
                            </span>
                          ) : null}
                          {usage && agent.activatedAt && agent.active ? ' · ' : null}
                          {agent.activatedAt && agent.active ? (
                            <span>
                              actif depuis{' '}
                              {new Date(agent.activatedAt).toLocaleDateString('fr-FR', {
                                day: 'numeric',
                                month: 'short',
                              })}
                            </span>
                          ) : null}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 sm:shrink-0 sm:justify-end">
                    {locked ? (
                      <Button variant="outline" size="sm" asChild>
                        <Link to="/pricing">Débloquer</Link>
                      </Button>
                    ) : (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1.5"
                          onClick={() =>
                            toggleMutation.mutate({ slug: agent.slug, active: agent.active })
                          }
                          disabled={toggling}
                        >
                          {toggling ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : agent.active ? (
                            <>
                              <PowerOff size={14} />
                              <span className="hidden sm:inline">Désactiver</span>
                            </>
                          ) : (
                            <>
                              <Power size={14} /> Activer
                            </>
                          )}
                        </Button>
                        {agent.active ? (
                          <Button size="sm" className="gap-1.5" asChild>
                            <Link to={agent.route}>
                              Ouvrir <ArrowRight size={14} />
                            </Link>
                          </Button>
                        ) : (
                          <Button variant="outline" size="sm" className="gap-1.5" disabled>
                            <Settings2 size={14} /> Ouvrir
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
