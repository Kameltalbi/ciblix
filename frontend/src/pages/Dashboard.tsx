import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Check,
  Circle,
  Loader2,
  Radio,
  Bot,
  Radar,
  FileSignature,
  Mail,
  Sparkles,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { TrialEndingBanner } from '@/components/TrialEndingBanner';
import { getAgentSourceStyle } from '@/constants/agentSourceStyle';

type OpsOverview = {
  generatedAt: string;
  absence: Array<{ key: string; label: string; count: number; attention?: boolean }>;
  attention: Array<{
    id: string;
    priority: 'high' | 'medium' | 'low';
    title: string;
    subtitle: string;
    href: string;
  }>;
  timeline: Array<{
    id: string;
    at: string;
    source: string;
    agentLabel: string;
    resume: string | null;
    contactId: string | null;
    contactName: string | null;
  }>;
  agentsToday: Array<{
    slug: string;
    name: string;
    active: boolean;
    metric: string;
    detail: string;
    href: string;
  }>;
};

const PRIORITY_DOT: Record<string, string> = {
  high: 'bg-rose-500',
  medium: 'bg-amber-500',
  low: 'bg-emerald-500',
};

const AGENT_ICON: Record<string, LucideIcon> = {
  'hunt-ai': Radio,
  'gmail-ai': Mail,
  'scout-ai': Radar,
  'copilot-ia': Bot,
  'offre-bot': FileSignature,
};

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

export function Dashboard() {
  const { user } = useAuth();
  const firstName = user?.name?.split(' ')[0] || 'vous';

  const { data, isPending } = useQuery<OpsOverview>({
    queryKey: ['ops-overview'],
    queryFn: () => api.get('/ops/overview').then((r) => r.data),
    refetchInterval: 60_000,
  });

  if (isPending || !data) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Chargement du centre de commandement…
      </div>
    );
  }

  const hasActivity = data.absence.some((a) => a.count > 0) || data.timeline.length > 0;

  return (
    <div className="mx-auto max-w-5xl space-y-10">
      <TrialEndingBanner />

      <header className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Centre de commandement IA
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
          Bonjour {firstName}.
        </h1>
        <p className="text-sm text-muted-foreground">
          {hasActivity
            ? 'Pendant votre absence, vos agents ont travaillé.'
            : 'Vos agents sont prêts — lancez une recherche ou activez Gmail IA.'}
        </p>
      </header>

      {/* Absence summary */}
      <section className="space-y-3">
        <h2 className="text-sm font-medium text-foreground">Synthèse des dernières 24 h</h2>
        <ul className="space-y-2">
          {data.absence.map((item) => (
            <li
              key={item.key}
              className={cn(
                'flex items-center gap-3 text-sm',
                item.count > 0 ? 'text-foreground' : 'text-muted-foreground'
              )}
            >
              {item.count > 0 ? (
                <Check size={16} className={item.attention ? 'text-rose-500' : 'text-emerald-600'} />
              ) : (
                <Circle size={14} className="text-muted-foreground/40" />
              )}
              <span>{item.label}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Attention */}
      <section className="space-y-3">
        <h2 className="text-sm font-medium text-foreground">Ce qui nécessite votre attention</h2>
        {data.attention.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
            Rien en attente — vos agents n&apos;ont pas besoin de validation pour le moment.
          </p>
        ) : (
          <div className="space-y-2">
            {data.attention.map((item) => (
              <Link
                key={item.id}
                to={item.href}
                className="group flex items-center justify-between gap-3 rounded-lg border border-border bg-white px-4 py-3 transition-colors hover:border-foreground/20 hover:bg-muted/30"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <span
                    className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', PRIORITY_DOT[item.priority])}
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{item.title}</p>
                    <p className="truncate text-xs text-muted-foreground">{item.subtitle}</p>
                  </div>
                </div>
                <ArrowRight
                  size={16}
                  className="shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
                />
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Timeline */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-medium text-foreground">Activité des agents</h2>
          <Link to="/agents" className="text-xs text-primary hover:underline">
            Gérer la flotte
          </Link>
        </div>
        {data.timeline.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune activité récente.</p>
        ) : (
          <ol className="relative space-y-0 border-s border-border ms-3">
            {data.timeline.slice(0, 12).map((ev) => {
              const style = getAgentSourceStyle(ev.source);
              const Icon = style.Icon;
              return (
                <li key={ev.id} className="mb-4 ms-6">
                  <span
                    className="absolute -start-3 flex h-6 w-6 items-center justify-center rounded-full ring-4 ring-background"
                    style={{ backgroundColor: `${style.color}22`, color: style.color }}
                  >
                    <Icon size={12} />
                  </span>
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <time className="text-xs tabular-nums text-muted-foreground">
                      {formatTime(ev.at)}
                    </time>
                    <span className="text-sm font-medium" style={{ color: style.color }}>
                      {ev.agentLabel}
                    </span>
                  </div>
                  <p className="mt-0.5 text-sm text-foreground/90 line-clamp-2">
                    {ev.resume || 'Activité enregistrée'}
                    {ev.contactName ? (
                      <span className="text-muted-foreground"> · {ev.contactName}</span>
                    ) : null}
                  </p>
                  {ev.contactId ? (
                    <Link
                      to={`/contacts/${ev.contactId}`}
                      className="mt-1 inline-block text-xs text-primary hover:underline"
                    >
                      Voir la fiche
                    </Link>
                  ) : null}
                </li>
              );
            })}
          </ol>
        )}
      </section>

      {/* Agents today */}
      <section className="space-y-3">
        <h2 className="text-sm font-medium text-foreground">Les agents aujourd&apos;hui</h2>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {data.agentsToday.map((agent) => {
            const Icon = AGENT_ICON[agent.slug] || Sparkles;
            return (
              <Link
                key={agent.slug}
                to={agent.href}
                className="flex items-center gap-3 rounded-lg border border-border bg-white px-3 py-3 transition-colors hover:border-foreground/15 hover:bg-muted/20"
              >
                <div
                  className={cn(
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
                    agent.active ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                  )}
                >
                  <Icon size={16} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium">{agent.name}</p>
                    <span
                      className={cn(
                        'h-1.5 w-1.5 shrink-0 rounded-full',
                        agent.active ? 'bg-emerald-500' : 'bg-slate-300'
                      )}
                      title={agent.active ? 'Actif' : 'Inactif'}
                    />
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {agent.metric}
                    <span className="mx-1 text-border">·</span>
                    {agent.detail}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
        <div className="pt-2">
          <Button variant="outline" size="sm" asChild>
            <Link to="/prospection-ia" className="gap-1.5">
              Lancer le Chasseur IA <ArrowRight size={14} />
            </Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
