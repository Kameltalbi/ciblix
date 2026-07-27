import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronRight, Crosshair, Mail, MapPin, Phone, Search, Users } from 'lucide-react';
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

const ETAT_STYLE: Record<string, { label: string; className: string }> = {
  DECOUVERTE: { label: 'Découverte', className: 'bg-[#016AEB]/20 text-[#7EB6FF] ring-1 ring-[#016AEB]/35' },
  QUALIFIEE: { label: 'Qualifiée', className: 'bg-sky-500/15 text-sky-300 ring-1 ring-sky-400/30' },
  CONTACTEE: { label: 'Contactée', className: 'bg-amber-500/15 text-amber-300 ring-1 ring-amber-400/30' },
  EN_DISCUSSION: { label: 'En discussion', className: 'bg-violet-500/15 text-violet-300 ring-1 ring-violet-400/30' },
  GAGNEE: { label: 'Gagnée', className: 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/30' },
  PERDUE: { label: 'Perdue', className: 'bg-rose-500/15 text-rose-300 ring-1 ring-rose-400/30' },
  ARCHIVEE: { label: 'Archivée', className: 'bg-white/10 text-[#A8B4D0] ring-1 ring-white/15' },
  BLOQUEE_HUMAIN: { label: 'Bloquée', className: 'bg-orange-500/15 text-orange-300 ring-1 ring-orange-400/30' },
};

function companyLabel(c: ContactRow): string {
  return c.companyName || c.ficheData?.identite_entreprise?.nom_legal || c.name || 'Sans nom';
}

function metaParts(c: ContactRow): { secteur?: string; lieu?: string; taille?: string } {
  const f = c.ficheData || {};
  return {
    secteur: f.secteur_declare || undefined,
    lieu: f.zone_geographique || undefined,
    taille: f.taille_estimee || undefined,
  };
}

function scoreTone(score: number) {
  if (score >= 80) return 'bg-emerald-500 text-[#04120A]';
  if (score >= 60) return 'bg-[#3B6BFB] text-white';
  return 'bg-white/15 text-[#E8ECF7]';
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
  const total = data?.total ?? 0;

  return (
    <div className="relative -mx-4 -mt-4 min-h-[calc(100vh-4rem)] bg-[#0F1629] px-4 pb-10 pt-4 text-[#E8ECF7] sm:-mx-6 sm:px-6">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 70% 45% at 0% 0%, rgba(59,107,251,0.18), transparent 50%), radial-gradient(ellipse 50% 40% at 100% 10%, rgba(1,106,235,0.12), transparent 45%)',
        }}
      />

      <div className="relative mx-auto max-w-6xl space-y-5">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#3B6BFB] text-white shadow-lg shadow-[#3B6BFB]/30">
              <Users size={20} />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-white">
                {t('contactsPage.title')}
              </h1>
              <p className="mt-0.5 text-sm text-[#8B93AC]">
                {isPending
                  ? t('contactsPage.loading')
                  : `${total} prospect${total === 1 ? '' : 's'} · clic pour ouvrir la fiche`}
              </p>
            </div>
          </div>
          <Button
            asChild
            className="h-10 border-0 bg-[#3B6BFB] text-white shadow-md shadow-[#3B6BFB]/35 hover:bg-[#2F5AE8]"
          >
            <Link to="/prospection-ia" className="gap-2">
              <Crosshair size={15} /> {t('contactsPage.launchHunt')}
            </Link>
          </Button>
        </header>

        <div className="rounded-xl border border-white/[0.08] bg-[#152038] p-3 sm:p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-1.5" role="tablist">
              {AGENT_TABS.map((key) => {
                const active = agent === key;
                return (
                  <button
                    key={key}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setAgent(key)}
                    className={cn(
                      'rounded-lg px-3.5 py-2 text-sm font-medium transition-colors',
                      active
                        ? 'bg-[#3B6BFB] text-white'
                        : 'bg-white/[0.04] text-[#A8B4D0] hover:bg-white/[0.08] hover:text-white'
                    )}
                  >
                    {key === 'ALL'
                      ? t('contactsPage.filters.all')
                      : t(`contactsPage.sources.${key}`, { defaultValue: key })}
                  </button>
                );
              })}
            </div>
            <div className="relative w-full lg:max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8B93AC]" size={16} />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('contactsPage.searchPlaceholder')}
                className="h-11 border-white/10 bg-[#0F1629] pl-9 text-[#E8ECF7] placeholder:text-[#6B7690] focus-visible:border-[#3B6BFB] focus-visible:ring-[#3B6BFB]/30"
              />
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-white/[0.08] bg-[#152038]">
          <div className="hidden grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1.15fr)_100px_36px] gap-3 border-b border-white/[0.06] px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-[#8B93AC] md:grid">
            <span>Entreprise / Contact</span>
            <span>Secteur & lieu</span>
            <span>Coordonnées</span>
            <span className="text-right">Score</span>
            <span />
          </div>

          {isPending ? (
            <div>
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="animate-pulse border-b border-white/[0.05] px-4 py-4 last:border-0">
                  <div className="flex items-center gap-3">
                    <div className="h-11 w-11 rounded-xl bg-white/10" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3.5 w-48 rounded bg-white/10" />
                      <div className="h-3 w-28 rounded bg-white/[0.06]" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#3B6BFB]/20 text-[#7EB6FF]">
                <Users size={22} />
              </div>
              <p className="text-sm font-medium text-[#A8B4D0]">
                {agent === 'HUNT' ? t('contactsPage.emptyHunt') : t('contactsPage.empty')}
              </p>
            </div>
          ) : (
            <ul>
              {items.map((c) => {
                const company = companyLabel(c);
                const contactName = c.name && c.name !== company ? c.name : null;
                const decideur = c.ficheData?.decideur?.nom;
                const person = contactName || decideur;
                const meta = metaParts(c);
                const score =
                  typeof c.ficheData?.score_fit === 'number'
                    ? Math.round(c.ficheData.score_fit)
                    : null;
                const etat = c.ficheEtat ? ETAT_STYLE[c.ficheEtat] : null;
                const sourceLabel = c.createdVia
                  ? t(`contactsPage.sources.${c.createdVia}`, { defaultValue: c.createdVia })
                  : null;

                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => navigate(`/contacts/${c.id}`)}
                      className={cn(
                        'group relative grid w-full grid-cols-1 gap-2.5 border-b border-white/[0.05] px-4 py-3.5 text-left transition-colors last:border-0',
                        'hover:bg-[#1B2540] focus-visible:bg-[#1B2540] focus-visible:outline-none',
                        'md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1.15fr)_100px_36px] md:items-center md:gap-3'
                      )}
                    >
                      <span className="absolute inset-y-2 left-0 w-[3px] rounded-r-full bg-transparent transition-colors group-hover:bg-[#3B6BFB]" />

                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#3B6BFB] text-sm font-bold text-white">
                          {initialsFromName(company)}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-[15px] font-semibold text-white">{company}</p>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            {person ? (
                              <span className="truncate text-xs font-medium text-[#A8B4D0]">{person}</span>
                            ) : null}
                            {etat ? (
                              <span
                                className={cn(
                                  'inline-flex rounded-md px-1.5 py-0.5 text-[10px] font-semibold',
                                  etat.className
                                )}
                              >
                                {etat.label}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>

                      <div className="min-w-0 space-y-1 pl-[52px] md:pl-0">
                        {meta.secteur || meta.lieu || meta.taille ? (
                          <>
                            <p className="truncate text-sm font-medium text-[#D5DCEB]">
                              {[meta.secteur, meta.taille].filter(Boolean).join(' · ') || '—'}
                            </p>
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                              {meta.lieu ? (
                                <span className="inline-flex items-center gap-1 text-xs font-medium text-[#8B93AC]">
                                  <MapPin size={11} className="text-[#3B6BFB]" />
                                  {meta.lieu}
                                </span>
                              ) : null}
                              {sourceLabel ? (
                                <span className="rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-semibold text-[#A8B4D0] ring-1 ring-white/10">
                                  {sourceLabel}
                                </span>
                              ) : null}
                            </div>
                          </>
                        ) : (
                          <p className="text-sm text-[#6B7690]">Secteur non renseigné</p>
                        )}
                      </div>

                      <div className="min-w-0 space-y-1.5 pl-[52px] md:pl-0">
                        {c.phone ? (
                          <span className="flex items-center gap-1.5 truncate text-sm font-medium text-[#D5DCEB]">
                            <Phone size={13} className="shrink-0 text-[#3B6BFB]" />
                            {c.phone}
                          </span>
                        ) : null}
                        {c.email ? (
                          <span className="flex items-center gap-1.5 truncate text-sm font-medium text-[#D5DCEB]">
                            <Mail size={13} className="shrink-0 text-[#3B6BFB]" />
                            {c.email}
                          </span>
                        ) : null}
                        {!c.phone && !c.email ? (
                          <span className="text-xs text-[#6B7690]">Pas de coordonnées</span>
                        ) : null}
                      </div>

                      <div className="flex items-center justify-between pl-[52px] md:justify-end md:pl-0">
                        {score != null ? (
                          <span
                            className={cn(
                              'inline-flex min-w-[3.25rem] items-center justify-center rounded-lg px-2 py-1 text-xs font-bold tabular-nums',
                              scoreTone(score)
                            )}
                          >
                            {score}
                          </span>
                        ) : (
                          <span className="rounded-lg bg-white/[0.06] px-2 py-1 text-[10px] font-semibold text-[#8B93AC] ring-1 ring-white/10">
                            N/A
                          </span>
                        )}
                        <ChevronRight
                          size={16}
                          className="text-[#6B7690] transition group-hover:translate-x-0.5 group-hover:text-[#7EB6FF] md:hidden"
                        />
                      </div>

                      <div className="hidden justify-end md:flex">
                        <ChevronRight
                          size={18}
                          className="text-[#6B7690] transition group-hover:translate-x-0.5 group-hover:text-[#7EB6FF]"
                        />
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
