import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Search, Crosshair } from 'lucide-react';
import { api } from '@/lib/api';
import { Input } from '@/components/ui/form-controls';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { CarteOpportunite, buildPourquoiMaintenant } from '@/components/fiche-entreprise';
import type { FicheEntrepriseDataView } from '@/components/fiche-entreprise/types';

interface ContactRow {
  id: string;
  name?: string | null;
  companyName?: string | null;
  email?: string | null;
  phone?: string | null;
  createdVia?: string;
  createdAt?: string;
  ficheEtat?: string | null;
  ficheData?: FicheEntrepriseDataView | null;
}

type AgentFilter = 'HUNT' | 'SCOUT' | 'GMAIL' | 'COPILOT' | 'ALL';

const AGENT_TABS: AgentFilter[] = ['HUNT', 'SCOUT', 'GMAIL', 'COPILOT', 'ALL'];

function identityLine(c: ContactRow): string {
  const f = c.ficheData || {};
  return [f.secteur_declare, f.zone_geographique, f.taille_estimee].filter(Boolean).join(' · ');
}

function pourquoiFor(c: ContactRow): string {
  const f = c.ficheData || {};
  const histo = f.historique_interactions || [];
  const last = [...histo].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())[0];
  const sig = f.signaux_externes?.[0];
  return (
    buildPourquoiMaintenant({
      besoinDetecte: f.besoin_detecte,
      raisonDuScore: f.raison_du_score,
      prochaineAction: f.prochaine_action,
      dateRelance: f.date_relance,
      lastInteractionResume: last?.resume,
      lastSignalTitre: sig?.titre,
    }) || 'Nouvelle entreprise détectée — ouvrir pour préparer le contact.'
  );
}

export function Contacts() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [agent, setAgent] = useState<AgentFilter>('HUNT');
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set());

  const { data, isPending } = useQuery({
    queryKey: ['contacts', search, agent],
    queryFn: () =>
      api
        .get('/contacts', {
          params: {
            limit: 100,
            search: search.trim() || undefined,
            createdVia: agent === 'ALL' ? undefined : agent,
            sort: 'createdAt',
            sortDir: 'desc',
          },
        })
        .then((r) => r.data as { items: ContactRow[]; total: number }),
  });

  const feedback = useMutation({
    mutationFn: (body: { pertinent: boolean; companyName?: string | null; motif?: string }) =>
      api.post('/mission/feedback/prospect', body).then((r) => r.data),
  });

  const items = (data?.items || []).filter((c) => !dismissed.has(c.id));

  return (
    <div className="mx-auto max-w-lg space-y-6 px-1 sm:max-w-xl">
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {t('contactsPage.eyebrow')}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">{t('contactsPage.title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Tri rapide : pertinent ou pas. Toucher le texte pour ouvrir la fiche avant l’appel.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" asChild>
          <Link to="/prospection-ia" className="gap-1.5">
            <Crosshair size={14} /> {t('contactsPage.launchHunt')}
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap gap-2" role="tablist">
        {AGENT_TABS.map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={agent === key}
            onClick={() => setAgent(key)}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm transition-colors',
              agent === key
                ? 'bg-foreground text-background font-medium'
                : 'bg-muted/60 text-muted-foreground hover:bg-muted'
            )}
          >
            {key === 'ALL'
              ? t('contactsPage.filters.all')
              : t(`contactsPage.sources.${key}`, { defaultValue: key })}
          </button>
        ))}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('contactsPage.searchPlaceholder')}
          className="h-11 pl-9"
        />
      </div>

      {isPending ? (
        <p className="py-10 text-center text-sm text-muted-foreground">{t('contactsPage.loading')}</p>
      ) : items.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          {agent === 'HUNT' ? t('contactsPage.emptyHunt') : t('contactsPage.empty')}
        </p>
      ) : (
        <ul className="space-y-3">
          {items.map((c) => (
            <li key={c.id}>
              <CarteOpportunite
                companyName={c.companyName || c.name || 'Entreprise'}
                identityLine={identityLine(c)}
                pourquoi={pourquoiFor(c)}
                pending={feedback.isPending}
                onOpen={() => navigate(`/contacts/${c.id}`)}
                onPertinent={() => {
                  feedback.mutate({ pertinent: true, companyName: c.companyName });
                  setDismissed((prev) => new Set(prev).add(c.id));
                }}
                onPasPourMoi={() => {
                  feedback.mutate({
                    pertinent: false,
                    companyName: c.companyName,
                    motif: 'autre',
                  });
                  setDismissed((prev) => new Set(prev).add(c.id));
                  void qc.invalidateQueries({ queryKey: ['contacts'] });
                }}
              />
            </li>
          ))}
        </ul>
      )}

      {data?.total != null ? (
        <p className="text-center text-xs text-muted-foreground">
          {t(data.total === 1 ? 'contactsPage.results_one' : 'contactsPage.results_other', {
            count: data.total,
          })}
        </p>
      ) : null}
    </div>
  );
}
