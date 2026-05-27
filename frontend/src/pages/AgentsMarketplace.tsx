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
  Sparkles,
  CheckCircle2,
  Lock,
  Megaphone,
} from 'lucide-react';
import { api } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

interface Agent {
  slug: string;
  name: string;
  role: string;
  description: string;
  icon: string;
  color: string;
  features: string[];
  route: string;
  defaultActive: boolean;
  active: boolean;
  activatedAt: string | null;
  includedInPlan: boolean;
  canActivate: boolean;
  requiredPlan: string | null;
  requiredPlanLabel: string | null;
}

const ICON_MAP: Record<string, LucideIcon> = {
  Radio,
  Bot,
  Radar,
  FileSignature,
  ShieldCheck,
  Megaphone,
};

const COLOR_MAP: Record<string, { bg: string; text: string; border: string; accent: string; ring: string }> = {
  sky: { bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200', accent: 'bg-sky-100', ring: 'ring-sky-300' },
  violet: { bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200', accent: 'bg-violet-100', ring: 'ring-violet-300' },
  blue: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', accent: 'bg-blue-100', ring: 'ring-blue-300' },
  amber: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', accent: 'bg-amber-100', ring: 'ring-amber-300' },
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', accent: 'bg-emerald-100', ring: 'ring-emerald-300' },
  rose: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', accent: 'bg-rose-100', ring: 'ring-rose-300' },
};

function AgentCard({ agent, onToggle, isToggling }: { agent: Agent; onToggle: () => void; isToggling: boolean }) {
  const Icon = ICON_MAP[agent.icon] || Bot;
  const colors = COLOR_MAP[agent.color] || COLOR_MAP.blue;
  const locked = !agent.includedInPlan;

  return (
    <Card className={cn(
      'group relative overflow-hidden transition-all duration-200 hover:shadow-lg',
      agent.active ? `border-2 ${colors.border}` : 'border border-gray-200 opacity-80 hover:opacity-100',
      locked && 'opacity-70',
    )}>
      {agent.active && (
        <div className={cn('absolute right-3 top-3 flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase', colors.accent, colors.text)}>
          <CheckCircle2 size={10} /> Actif
        </div>
      )}
      {locked && (
        <div className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold uppercase text-gray-600">
          <Lock size={10} /> Plan {agent.requiredPlanLabel}
        </div>
      )}

      <CardContent className="flex flex-col p-0">
        <div className={cn('p-6 pb-4', agent.active ? colors.bg : 'bg-gray-50/50')}>
          <div className={cn('mb-4 flex h-12 w-12 items-center justify-center rounded-xl', colors.accent, colors.text)}>
            <Icon size={24} strokeWidth={2} />
          </div>
          <h3 className="text-lg font-bold text-foreground">{agent.name}</h3>
          <p className={cn('mt-0.5 text-sm font-medium', colors.text)}>{agent.role}</p>
        </div>

        <div className="flex flex-1 flex-col p-6 pt-3">
          <p className="text-sm leading-relaxed text-muted-foreground">{agent.description}</p>

          <div className="mt-4 space-y-1.5">
            {agent.features.map((f, i) => (
              <div key={i} className="flex items-start gap-2">
                <Sparkles size={12} className={cn('mt-0.5 shrink-0', colors.text)} />
                <span className="text-xs text-muted-foreground">{f}</span>
              </div>
            ))}
          </div>

          <div className="mt-auto flex items-center gap-2 pt-5">
            {locked ? (
              <Link to="/pricing" className="flex-1">
                <Button variant="outline" size="sm" className="w-full gap-1.5">
                  Passer au plan {agent.requiredPlanLabel}
                </Button>
              </Link>
            ) : (
              <Button
                variant={agent.active ? 'outline' : 'default'}
                size="sm"
                onClick={onToggle}
                disabled={isToggling}
                className={cn('flex-1 gap-1.5', agent.active && 'border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700')}
              >
                {isToggling ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : agent.active ? (
                  <><PowerOff size={14} /> Désactiver</>
                ) : (
                  <><Power size={14} /> Activer</>
                )}
              </Button>
            )}

            {agent.active && !locked && (
              <Link to={agent.route}>
                <Button variant="outline" size="sm" className="gap-1.5">
                  Ouvrir <ArrowRight size={14} />
                </Button>
              </Link>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function AgentsMarketplace() {
  const queryClient = useQueryClient();

  const { data, isPending } = useQuery<{ agents: Agent[]; plan: string; planLabel: string }>({
    queryKey: ['agents-marketplace'],
    queryFn: () => api.get('/agents').then((r) => r.data),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ slug, active }: { slug: string; active: boolean }) =>
      api.post(`/agents/${slug}/${active ? 'deactivate' : 'activate'}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents-marketplace'] });
      queryClient.invalidateQueries({ queryKey: ['agents-active-slugs'] });
    },
  });

  const agents = data?.agents || [];
  const activeCount = agents.filter((a) => a.active).length;
  const includedCount = agents.filter((a) => a.includedInPlan).length;

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-violet-600 text-white">
            <Sparkles size={20} strokeWidth={2} />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Agents IA</h1>
            <p className="text-sm text-muted-foreground">
              Plan {data?.planLabel ?? '…'} · {activeCount} actif{activeCount > 1 ? 's' : ''} sur {includedCount} inclus
            </p>
          </div>
        </div>
      </div>

      {isPending ? (
        <div className="py-20 text-center text-muted-foreground">
          <Loader2 size={24} className="mx-auto mb-2 animate-spin" />
          Chargement des agents...
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {agents.map((agent) => (
            <AgentCard
              key={agent.slug}
              agent={agent}
              onToggle={() => toggleMutation.mutate({ slug: agent.slug, active: agent.active })}
              isToggling={toggleMutation.isPending && toggleMutation.variables?.slug === agent.slug}
            />
          ))}
        </div>
      )}
    </div>
  );
}
