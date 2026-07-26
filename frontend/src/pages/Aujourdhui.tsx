import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, CalendarClock, Check, Sun } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';

type TodayItem = {
  contactId: string;
  companyName: string;
  dateRelance: string;
  prochaineAction: string | null;
  pourquoi: string;
  messageBrouillon: string | null;
  messageCanal: string | null;
  ficheEtat: string | null;
};

/**
 * Aujourd’hui — jusqu’à 5 entreprises à contacter (date_relance due).
 * Les fiches sont écrites par le Scribe ; ici on lit seulement.
 */
export function Aujourdhui() {
  const { data, isPending, error } = useQuery({
    queryKey: ['contacts-today'],
    queryFn: () =>
      api.get('/contacts/today', { params: { limit: 5 } }).then(
        (r) => r.data as { items: TodayItem[]; asOf: string }
      ),
    refetchInterval: 60_000,
  });

  const items = data?.items || [];

  return (
    <div className="mx-auto max-w-lg px-1 pb-16">
      <header className="mb-6">
        <div className="flex items-center gap-2 text-[#1E72B9]">
          <Sun size={18} />
          <p className="text-xs font-semibold uppercase tracking-wide">Aujourd’hui</p>
        </div>
        <h1 className="mt-1 text-xl font-semibold tracking-tight text-neutral-900">
          {items.length === 0
            ? 'Rien à relancer pour l’instant'
            : `${items.length} à contacter`}
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          Les dossiers dont la date de relance est arrivée — notés par le Scribe, sans saisie.
        </p>
      </header>

      {isPending ? (
        <p className="text-sm text-muted-foreground">Chargement…</p>
      ) : error ? (
        <p className="text-sm text-destructive">Impossible de charger Aujourd’hui.</p>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-200 bg-neutral-50/80 px-5 py-10 text-center">
          <CalendarClock className="mx-auto text-neutral-400" size={28} />
          <p className="mt-3 text-sm text-neutral-600">
            Aucune relance due. Après un appel, dictez quinze secondes — le Scribe programme la
            suite.
          </p>
          <Button asChild variant="outline" className="mt-5 h-11">
            <Link to="/contacts">Voir les contacts</Link>
          </Button>
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={item.contactId}>
              <Link
                to={`/contacts/${item.contactId}`}
                className="block rounded-2xl border border-neutral-200 bg-white px-4 py-3.5 transition-colors hover:border-[#016AEB]/40"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[15px] font-medium text-neutral-900">{item.companyName}</p>
                    <p className="mt-1 text-[13px] leading-snug text-neutral-600">{item.pourquoi}</p>
                    {item.messageBrouillon ? (
                      <p className="mt-2 flex items-center gap-1.5 text-[11px] text-[#016AEB]">
                        <Check size={12} /> Message déjà écrit
                        {item.messageCanal ? ` · ${item.messageCanal}` : ''}
                      </p>
                    ) : null}
                  </div>
                  <ArrowRight size={16} className="mt-1 shrink-0 text-neutral-400" />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
