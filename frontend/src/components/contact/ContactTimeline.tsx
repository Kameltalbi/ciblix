import { getAgentSourceStyle } from '@/constants/agentSourceStyle';

export interface AgentEventItem {
  id: string;
  source: string;
  type: string;
  resume?: string | null;
  score?: number | null;
  actionsSuggerees?: string[];
  createdAt: string;
}

function formatRelativeDate(iso: string): string {
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "à l'instant";
  if (mins < 60) return `il y a ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `il y a ${days} j`;
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function ScoreBadge({
  score,
  previousScore,
}: {
  score: number;
  previousScore?: number | null;
}) {
  const delta =
    previousScore != null && Number.isFinite(previousScore) ? score - previousScore : null;

  return (
    <div className="inline-flex items-center gap-1.5 text-xs mt-1.5">
      <span className="font-semibold tabular-nums">{score}/100</span>
      {delta != null && delta !== 0 ? (
        <span className={delta > 0 ? 'text-emerald-600' : 'text-rose-600'}>
          {delta > 0 ? '↗' : '↘'} {previousScore} → {score}
        </span>
      ) : null}
    </div>
  );
}

export function CrossAgentBanner({ events }: { events: AgentEventItem[] }) {
  const uniqueSources = [...new Set(events.map((e) => e.source))];
  if (uniqueSources.length < 2) return null;

  const sourceLabels = uniqueSources.map((s) => getAgentSourceStyle(s).label);

  return (
    <div className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900 mb-4">
      Ce contact a été enrichi par {uniqueSources.length} agents différents :{' '}
      {sourceLabels.join(', ')}. Toutes les informations sont automatiquement reliées, sans saisie
      manuelle.
    </div>
  );
}

export function ContactTimeline({ events }: { events: AgentEventItem[] }) {
  if (events.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Aucune interaction enregistrée pour ce contact pour l&apos;instant.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {events.map((event, index) => {
        const style = getAgentSourceStyle(event.source);
        const Icon = style.Icon;
        const previousScore = events[index + 1]?.score;

        return (
          <div key={event.id} className="flex gap-3">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
              style={{ backgroundColor: `${style.color}20`, color: style.color }}
            >
              <Icon size={16} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-medium" style={{ color: style.color }}>
                  {style.label}
                </span>
                <span className="text-muted-foreground text-xs">{event.type}</span>
                <span className="text-muted-foreground text-xs">
                  {formatRelativeDate(event.createdAt)}
                </span>
              </div>
              <p className="text-sm text-foreground/90 mt-1 whitespace-pre-wrap">
                {event.resume || '—'}
              </p>
              {event.score != null ? (
                <ScoreBadge score={event.score} previousScore={previousScore} />
              ) : null}
              {(event.actionsSuggerees?.length ?? 0) > 0 ? (
                <ul className="text-xs text-muted-foreground mt-1.5 list-disc list-inside space-y-0.5">
                  {event.actionsSuggerees!.map((action) => (
                    <li key={action}>{action}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
