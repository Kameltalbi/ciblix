import { AlertCircle, Check, Clock, Loader2, Radar, RefreshCw, Search } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type DossierIntelligenceView = {
  scores: {
    completude: number;
    fiabilite: number;
    fraicheur: number;
    sources: number;
    confianceIa: number;
  };
  derniereAnalyse: string | null;
  infosManquantes: Array<{
    id: string;
    label: string;
    categorie: string;
  }>;
  updatesToday: Array<{
    id: string;
    at: string;
    agent: string | null;
    label: string;
    kind: 'change' | 'noop';
  }>;
  todaySummary: {
    date: string;
    hasChanges: boolean;
    message: string;
  };
};

function ScoreBar({ label, value, suffix }: { label: string; value: number; suffix?: string }) {
  const tone =
    value >= 75 ? 'bg-emerald-500' : value >= 50 ? 'bg-[#016AEB]' : value >= 30 ? 'bg-amber-500' : 'bg-rose-400';
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs">
        <span className="text-slate-600">{label}</span>
        <span className="font-semibold tabular-nums text-slate-800">
          {value}
          {suffix || '/100'}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div className={cn('h-full rounded-full transition-all', tone)} style={{ width: `${Math.min(100, value)}%` }} />
      </div>
    </div>
  );
}

function formatAnalyse(iso: string | null): string {
  if (!iso) return 'Jamais';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (days <= 0) return "Aujourd'hui";
  if (days === 1) return 'Hier';
  if (days < 30) return `Il y a ${days} j`;
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

export function DossierQualitePanel({
  intelligence,
  contactId,
}: {
  intelligence: DossierIntelligenceView;
  contactId?: string;
}) {
  const qc = useQueryClient();
  const enrich = useMutation({
    mutationFn: () =>
      api.post('/agent-team/scribe/enrich', { contactId }).then((r) => r.data as {
        changed: boolean;
        raison: string;
        signalsAdded: number;
      }),
    onSuccess: () => {
      if (contactId) void qc.invalidateQueries({ queryKey: ['contact', contactId] });
    },
  });

  const s = intelligence.scores;
  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Qualité du dossier</h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Le Scribe revisite les sources et enrichit ce dossier en continu.
          </p>
        </div>
        <div className="rounded-xl bg-[#E8F1FE] px-3 py-2 text-center">
          <p className="text-[10px] font-medium uppercase tracking-wide text-[#016AEB]">Confiance IA</p>
          <p className="text-lg font-bold tabular-nums text-[#016AEB]">{s.confianceIa}</p>
        </div>
      </div>
      <div className="space-y-3">
        <ScoreBar label="Complétude" value={s.completude} />
        <ScoreBar label="Fiabilité" value={s.fiabilite} />
        <ScoreBar label="Fraîcheur" value={s.fraicheur} />
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-3 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1.5">
          <Radar className="h-3.5 w-3.5" />
          {s.sources} source{s.sources === 1 ? '' : 's'}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5" />
          Dernière analyse · {formatAnalyse(intelligence.derniereAnalyse)}
        </span>
        {contactId ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="ml-auto h-8 rounded-lg text-xs"
            disabled={enrich.isPending}
            onClick={() => enrich.mutate()}
          >
            {enrich.isPending ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            )}
            Analyser maintenant
          </Button>
        ) : null}
      </div>
      {enrich.isSuccess ? (
        <p className="mt-2 text-xs text-emerald-700">
          {enrich.data.changed
            ? enrich.data.raison
            : 'Analyse terminée. Aucune modification détectée.'}
        </p>
      ) : null}
      {enrich.isError ? (
        <p className="mt-2 text-xs text-red-600">Impossible de lancer l’analyse Scribe.</p>
      ) : null}
    </section>
  );
}

export function DossierFilDuJourPanel({ intelligence }: { intelligence: DossierIntelligenceView }) {
  const { todaySummary, updatesToday } = intelligence;
  const changes = updatesToday.filter((u) => u.kind === 'change');
  const show = changes.length > 0 ? changes : updatesToday.slice(0, 3);

  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <h3 className="text-sm font-semibold capitalize text-slate-900">{todaySummary.date}</h3>
      </div>
      <p
        className={cn(
          'mb-3 text-sm',
          todaySummary.hasChanges ? 'font-medium text-slate-800' : 'text-slate-500'
        )}
      >
        {todaySummary.message}
      </p>
      {show.length > 0 ? (
        <ul className="space-y-2">
          {show.map((u) => (
            <li key={u.id} className="flex items-start gap-2 text-sm text-slate-700">
              {u.kind === 'change' ? (
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              ) : (
                <Clock className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
              )}
              <span>
                {u.label}
                {u.agent ? (
                  <span className="mt-0.5 block text-[11px] capitalize text-slate-400">{u.agent}</span>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500">
          Analyse terminée. Aucune modification détectée.
        </p>
      )}
    </section>
  );
}

export function DossierManquesPanel({ intelligence }: { intelligence: DossierIntelligenceView }) {
  const items = intelligence.infosManquantes;
  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <Search className="h-4 w-4 text-amber-600" />
        <h3 className="text-sm font-semibold text-slate-900">Recherche active</h3>
        {items.length > 0 ? (
          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
            {items.length}
          </span>
        ) : null}
      </div>
      <p className="mb-3 text-xs text-slate-500">
        Le Scribe cherche encore ces éléments — rien n’est inventé.
      </p>
      {items.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-emerald-700">
          <Check className="h-4 w-4" />
          Aucune lacune prioritaire détectée.
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((m) => (
            <li
              key={m.id}
              className="flex items-start gap-2 rounded-xl border border-amber-100 bg-amber-50/50 px-3 py-2 text-sm text-amber-950"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              {m.label}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
