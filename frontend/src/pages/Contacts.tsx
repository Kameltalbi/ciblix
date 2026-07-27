import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronRight, Crosshair, Mail, Phone, Search } from 'lucide-react';
import { api } from '@/lib/api';
import { Input } from '@/components/ui/form-controls';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { initialsFromName } from '@/components/fiche-entreprise/ficheDisplay';
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

function companyLabel(c: ContactRow): string {
  return c.companyName || c.ficheData?.identite_entreprise?.nom_legal || c.name || 'Sans nom';
}

function metaLine(c: ContactRow): string {
  const f = c.ficheData || {};
  return [f.secteur_declare, f.zone_geographique, f.taille_estimee].filter(Boolean).join(' · ');
}

function etatLabel(etat?: string | null): string | null {
  if (!etat) return null;
  const map: Record<string, string> = {
    DECOUVERTE: 'Découverte',
    QUALIFIEE: 'Qualifiée',
    CONTACTEE: 'Contactée',
    EN_DISCUSSION: 'En discussion',
    GAGNEE: 'Gagnée',
    PERDUE: 'Perdue',
    ARCHIVEE: 'Archivée',
    BLOQUEE_HUMAIN: 'Bloquée',
  };
  return map[etat] || etat;
}

export function Contacts() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [agent, setAgent] = useState<AgentFilter>('ALL');

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

  const items = data?.items || [];

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
            {t('contactsPage.title')}
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            {data?.total != null
              ? t(data.total === 1 ? 'contactsPage.results_one' : 'contactsPage.results_other', {
                  count: data.total,
                })
              : t('contactsPage.eyebrow')}
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link to="/prospection-ia" className="gap-1.5">
            <Crosshair size={14} /> {t('contactsPage.launchHunt')}
          </Link>
        </Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1.5" role="tablist">
          {AGENT_TABS.map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={agent === key}
              onClick={() => setAgent(key)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-sm transition-colors',
                agent === key
                  ? 'bg-[#016AEB] font-medium text-white'
                  : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
              )}
            >
              {key === 'ALL'
                ? t('contactsPage.filters.all')
                : t(`contactsPage.sources.${key}`, { defaultValue: key })}
            </button>
          ))}
        </div>
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={16} />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('contactsPage.searchPlaceholder')}
            className="h-10 pl-9"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-neutral-200/80 bg-white shadow-sm">
        {/* En-tête colonnes — desktop */}
        <div className="hidden grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1.1fr)_88px_40px] gap-3 border-b border-neutral-100 bg-neutral-50/80 px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-neutral-400 md:grid">
          <span>Entreprise / Contact</span>
          <span>Secteur & lieu</span>
          <span>Coordonnées</span>
          <span className="text-right">Score</span>
          <span />
        </div>

        {isPending ? (
          <p className="px-4 py-12 text-center text-sm text-neutral-500">{t('contactsPage.loading')}</p>
        ) : items.length === 0 ? (
          <p className="px-4 py-12 text-center text-sm text-neutral-500">
            {agent === 'HUNT' ? t('contactsPage.emptyHunt') : t('contactsPage.empty')}
          </p>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {items.map((c) => {
              const company = companyLabel(c);
              const contactName = c.name && c.name !== company ? c.name : null;
              const meta = metaLine(c);
              const score =
                typeof c.ficheData?.score_fit === 'number' ? Math.round(c.ficheData.score_fit) : null;
              const etat = etatLabel(c.ficheEtat);
              const decideur = c.ficheData?.decideur?.nom;

              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => navigate(`/contacts/${c.id}`)}
                    className="grid w-full grid-cols-1 gap-2 px-4 py-3.5 text-left transition-colors hover:bg-[#F5F9FF] focus-visible:bg-[#F5F9FF] focus-visible:outline-none md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1.1fr)_88px_40px] md:items-center md:gap-3"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#016AEB] to-[#1E72B9] text-sm font-semibold text-white">
                        {initialsFromName(company)}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-neutral-900">{company}</p>
                        <p className="truncate text-xs text-neutral-500">
                          {[contactName || decideur, etat].filter(Boolean).join(' · ') || '—'}
                        </p>
                      </div>
                    </div>

                    <div className="min-w-0 pl-[52px] md:pl-0">
                      <p className="truncate text-sm text-neutral-700">{meta || '—'}</p>
                      {c.createdVia ? (
                        <p className="mt-0.5 text-xs text-neutral-400">
                          {t(`contactsPage.sources.${c.createdVia}`, { defaultValue: c.createdVia })}
                        </p>
                      ) : null}
                    </div>

                    <div className="min-w-0 space-y-1 pl-[52px] text-sm md:pl-0">
                      {c.phone ? (
                        <span className="flex items-center gap-1.5 truncate text-neutral-700">
                          <Phone size={12} className="shrink-0 text-neutral-400" />
                          {c.phone}
                        </span>
                      ) : null}
                      {c.email ? (
                        <span className="flex items-center gap-1.5 truncate text-neutral-700">
                          <Mail size={12} className="shrink-0 text-neutral-400" />
                          {c.email}
                        </span>
                      ) : null}
                      {!c.phone && !c.email ? (
                        <span className="text-xs text-neutral-400">Pas de coordonnées</span>
                      ) : null}
                    </div>

                    <div className="flex items-center justify-between pl-[52px] md:justify-end md:pl-0">
                      {score != null ? (
                        <span
                          className={cn(
                            'inline-flex rounded-lg px-2 py-1 text-xs font-semibold',
                            score >= 80
                              ? 'bg-emerald-50 text-emerald-700'
                              : score >= 60
                                ? 'bg-[#EEF5FF] text-[#016AEB]'
                                : 'bg-neutral-100 text-neutral-600'
                          )}
                        >
                          {score}/100
                        </span>
                      ) : (
                        <span className="text-xs text-neutral-300">—</span>
                      )}
                      <ChevronRight size={16} className="text-neutral-300 md:hidden" />
                    </div>

                    <div className="hidden justify-end md:flex">
                      <ChevronRight size={16} className="text-neutral-300" />
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
