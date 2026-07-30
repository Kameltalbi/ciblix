import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Building2,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Crosshair,
  Download,
  Eye,
  Filter,
  Flame,
  Mail,
  MapPin,
  MoreHorizontal,
  Phone,
  Search,
  Sparkles,
  User,
  Users,
} from 'lucide-react';
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
  pipelineStatus?: string | null;
  pipelineStatusAt?: string | null;
  ficheData?: FicheEntrepriseDataView | null;
}

type StatusFilter = 'ALL' | 'NOUVEAU' | 'CHAUD' | 'TIEDE' | 'A_RELANCER' | 'FROID' | 'ARCHIVE';

const PAGE_SIZE = 25;

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'ALL', label: 'Tous les statuts' },
  { value: 'NOUVEAU', label: 'Nouveau' },
  { value: 'CHAUD', label: 'Chaud' },
  { value: 'TIEDE', label: 'Tiède' },
  { value: 'A_RELANCER', label: 'À relancer' },
  { value: 'FROID', label: 'Froid' },
  { value: 'ARCHIVE', label: 'Archivé' },
];

const AVATAR_COLORS = [
  'from-sky-500 to-blue-600',
  'from-violet-500 to-indigo-600',
  'from-emerald-500 to-teal-600',
  'from-amber-500 to-orange-600',
  'from-rose-500 to-pink-600',
  'from-cyan-500 to-blue-500',
];

function companyLabel(c: ContactRow): string {
  return c.companyName || c.ficheData?.identite_entreprise?.nom_legal || c.name || 'Sans nom';
}

function contactPerson(c: ContactRow): { name: string | null; role: string | null } {
  const decideur = c.ficheData?.decideur;
  const name =
    decideur?.nom?.trim() ||
    (c.name && c.name !== companyLabel(c) ? c.name : null) ||
    null;
  return { name, role: decideur?.fonction?.trim() || null };
}

function cityOf(c: ContactRow): string | null {
  const zone = c.ficheData?.zone_geographique?.trim();
  if (!zone) return null;
  return zone.split(/[,/·|]/)[0]?.trim() || zone;
}

function sectorOf(c: ContactRow): string | null {
  return c.ficheData?.secteur_declare?.trim() || null;
}

function relativeActivity(c: ContactRow): string {
  const hist = c.ficheData?.historique_interactions;
  const lastAt =
    (hist && hist.length > 0 ? hist[hist.length - 1]?.at : null) ||
    c.pipelineStatusAt ||
    c.createdAt;
  if (!lastAt) return '—';
  const d = new Date(lastAt);
  if (Number.isNaN(d.getTime())) return '—';
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (days <= 0) return "Aujourd'hui";
  if (days === 1) return 'Il y a 1 jour';
  if (days < 30) return `Il y a ${days} jours`;
  if (days < 60) return 'Il y a 1 mois';
  return `Il y a ${Math.floor(days / 30)} mois`;
}

function statusMeta(c: ContactRow): { label: string; className: string } {
  const pipe = c.pipelineStatus;
  const etat = c.ficheEtat;
  if (pipe === 'CHAUD' || etat === 'EN_DISCUSSION') {
    return { label: 'Chaud', className: 'bg-orange-50 text-orange-700 ring-orange-200' };
  }
  if (pipe === 'NOUVEAU' || etat === 'DECOUVERTE') {
    return { label: 'Nouveau', className: 'bg-sky-50 text-sky-700 ring-sky-200' };
  }
  if (etat === 'GAGNEE') {
    return { label: 'Client', className: 'bg-emerald-50 text-emerald-700 ring-emerald-200' };
  }
  if (pipe === 'A_RELANCER' || etat === 'CONTACTEE') {
    return { label: 'À relancer', className: 'bg-amber-50 text-amber-700 ring-amber-200' };
  }
  if (pipe === 'FROID' || etat === 'PERDUE' || etat === 'ARCHIVEE' || pipe === 'ARCHIVE') {
    return { label: 'Inactif', className: 'bg-slate-100 text-slate-600 ring-slate-200' };
  }
  if (pipe === 'TIEDE' || etat === 'QUALIFIEE') {
    return { label: 'Prospect', className: 'bg-violet-50 text-violet-700 ring-violet-200' };
  }
  return { label: 'Prospect', className: 'bg-orange-50 text-orange-700 ring-orange-200' };
}

function insightMeta(score: number | null): { label: string; className: string } | null {
  if (score == null) return null;
  if (score >= 80) return { label: 'Fort potentiel', className: 'text-emerald-600' };
  if (score >= 60) return { label: 'Bon potentiel', className: 'text-sky-600' };
  if (score >= 40) return { label: 'À qualifier', className: 'text-amber-600' };
  return { label: 'Faible fit', className: 'text-slate-500' };
}

function avatarTone(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h + seed.charCodeAt(i) * 17) % AVATAR_COLORS.length;
  return AVATAR_COLORS[h];
}

function exportCsv(rows: ContactRow[]) {
  const header = ['Entreprise', 'Contact', 'Email', 'Téléphone', 'Ville', 'Secteur', 'Statut', 'Score'];
  const lines = rows.map((c) => {
    const person = contactPerson(c);
    const st = statusMeta(c);
    const score =
      typeof c.ficheData?.score_fit === 'number' ? String(Math.round(c.ficheData.score_fit)) : '';
    return [
      companyLabel(c),
      person.name || '',
      c.email || '',
      c.phone || '',
      cityOf(c) || '',
      sectorOf(c) || '',
      st.label,
      score,
    ]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(',');
  });
  const blob = new Blob([[header.join(','), ...lines].join('\n')], {
    type: 'text/csv;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ciblix-contacts-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-2xl border border-slate-200/80 bg-white px-4 py-4 shadow-sm">
      <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', tone)}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-xs font-medium text-slate-500">{label}</p>
        <p className="text-xl font-semibold tracking-tight text-slate-900">{value}</p>
        {hint ? <p className="truncate text-[11px] text-slate-400">{hint}</p> : null}
      </div>
    </div>
  );
}

export function Contacts() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('ALL');
  const [city, setCity] = useState('ALL');
  const [sector, setSector] = useState('ALL');
  const [page, setPage] = useState(0);

  const { data, isPending } = useQuery({
    queryKey: ['contacts', search, status],
    queryFn: () =>
      api
        .get('/contacts', {
          params: {
            limit: 100,
            search: search.trim() || undefined,
            status: status === 'ALL' ? undefined : status,
            sort: 'createdAt',
            sortDir: 'desc',
          },
        })
        .then((r) => r.data as { items: ContactRow[]; total: number }),
  });

  const rawItems = data?.items || [];

  const cities = useMemo(() => {
    const set = new Set<string>();
    for (const c of rawItems) {
      const v = cityOf(c);
      if (v) set.add(v);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'fr'));
  }, [rawItems]);

  const sectors = useMemo(() => {
    const set = new Set<string>();
    for (const c of rawItems) {
      const v = sectorOf(c);
      if (v) set.add(v);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'fr'));
  }, [rawItems]);

  const filtered = useMemo(() => {
    return rawItems.filter((c) => {
      if (city !== 'ALL' && cityOf(c) !== city) return false;
      if (sector !== 'ALL' && sectorOf(c) !== sector) return false;
      return true;
    });
  }, [rawItems, city, sector]);

  const kpis = useMemo(() => {
    const total = data?.total ?? filtered.length;
    let clients = 0;
    let prospects = 0;
    let inactifs = 0;
    let interactions = 0;
    const since = Date.now() - 30 * 86_400_000;
    for (const c of rawItems) {
      const st = statusMeta(c).label;
      if (st === 'Client') clients += 1;
      else if (st === 'Inactif') inactifs += 1;
      else prospects += 1;
      for (const h of c.ficheData?.historique_interactions || []) {
        const t = new Date(h.at).getTime();
        if (!Number.isNaN(t) && t >= since) interactions += 1;
      }
    }
    const n = rawItems.length || 1;
    return {
      total,
      clients,
      prospects,
      inactifs,
      interactions,
      clientsPct: Math.round((clients / n) * 100),
      prospectsPct: Math.round((prospects / n) * 100),
      inactifsPct: Math.round((inactifs / n) * 100),
    };
  }, [rawItems, data?.total, filtered.length]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageItems = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  const selectClass =
    'h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 shadow-none focus:outline-none focus:ring-2 focus:ring-[#016AEB]/30';

  return (
    <div className="w-full min-w-0 space-y-5 pb-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            {t('contactsPage.title')}
          </h1>
          <span className="inline-flex items-center rounded-full bg-[#E8F1FE] px-2.5 py-1 text-xs font-semibold text-[#016AEB]">
            {(data?.total ?? 0).toLocaleString('fr-FR')}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-xl border-slate-200"
            disabled={filtered.length === 0}
            onClick={() => exportCsv(filtered)}
          >
            <Download className="mr-1.5 h-4 w-4" />
            {t('contactsPage.export')}
          </Button>
          <Button type="button" size="sm" className="rounded-xl bg-[#016AEB] hover:bg-[#0159c4]" asChild>
            <Link to="/prospection-ia" className="gap-1.5">
              <Crosshair size={14} /> {t('contactsPage.launchHunt')}
            </Link>
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
        <KpiCard
          label="Dossiers"
          value={kpis.total.toLocaleString('fr-FR')}
          hint="Base d’intelligence"
          icon={Building2}
          tone="bg-sky-50 text-sky-600"
        />
        <KpiCard
          label="Clients gagnés"
          value={kpis.clients}
          hint={`${kpis.clientsPct}% du lot`}
          icon={Users}
          tone="bg-emerald-50 text-emerald-600"
        />
        <KpiCard
          label="En enrichment"
          value={kpis.prospects}
          hint={`${kpis.prospectsPct}% — Scribe actif`}
          icon={Flame}
          tone="bg-orange-50 text-orange-600"
        />
        <KpiCard
          label="En veille"
          value={kpis.inactifs}
          hint={`${kpis.inactifsPct}% — à revisiter`}
          icon={User}
          tone="bg-rose-50 text-rose-600"
        />
        <KpiCard
          label="Signaux (30j)"
          value={kpis.interactions}
          hint="Évolutions détectées"
          icon={Sparkles}
          tone="bg-violet-50 text-violet-600"
        />
      </div>

      {/* Filtres */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-white p-3 shadow-sm sm:flex-row sm:items-center sm:p-4">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            placeholder={t('contactsPage.searchPlaceholder')}
            className="h-10 rounded-xl border-slate-200 pl-9 shadow-none"
          />
        </div>
        <select
          className={cn(selectClass, 'w-full sm:w-40')}
          value={city}
          onChange={(e) => {
            setCity(e.target.value);
            setPage(0);
          }}
          aria-label="Ville"
        >
          <option value="ALL">Ville</option>
          {cities.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          className={cn(selectClass, 'w-full sm:w-44')}
          value={sector}
          onChange={(e) => {
            setSector(e.target.value);
            setPage(0);
          }}
          aria-label="Secteur"
        >
          <option value="ALL">Secteur</option>
          {sectors.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          className={cn(selectClass, 'w-full sm:w-44')}
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as StatusFilter);
            setPage(0);
          }}
          aria-label="Statut"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <Button type="button" variant="outline" size="sm" className="h-10 rounded-xl border-slate-200 sm:shrink-0">
          <Filter className="mr-1.5 h-4 w-4" />
          Filtres
        </Button>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] border-collapse text-left">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                <th className="px-4 py-3 font-semibold">Entreprise</th>
                <th className="px-4 py-3 font-semibold">Contact</th>
                <th className="px-4 py-3 font-semibold">Email</th>
                <th className="px-4 py-3 font-semibold">Téléphone</th>
                <th className="px-4 py-3 font-semibold">Ville</th>
                <th className="px-4 py-3 font-semibold">Statut</th>
                <th className="px-4 py-3 font-semibold">Dernière activité</th>
                <th className="px-4 py-3 font-semibold">Insight IA</th>
                <th className="px-4 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isPending ? (
                <tr>
                  <td colSpan={9} className="px-4 py-16 text-center text-sm text-slate-500">
                    {t('contactsPage.loading')}
                  </td>
                </tr>
              ) : pageItems.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-16 text-center text-sm text-slate-500">
                    {t('contactsPage.empty')}
                  </td>
                </tr>
              ) : (
                pageItems.map((c) => {
                  const company = companyLabel(c);
                  const person = contactPerson(c);
                  const st = statusMeta(c);
                  const score =
                    typeof c.ficheData?.score_fit === 'number'
                      ? Math.round(c.ficheData.score_fit)
                      : null;
                  const insight = insightMeta(score);
                  const cityLabel = cityOf(c);

                  return (
                    <tr
                      key={c.id}
                      className="cursor-pointer border-b border-slate-100 last:border-0 transition-colors hover:bg-[#F5F9FF]"
                      onClick={() => navigate(`/contacts/${c.id}`)}
                    >
                      <td className="px-4 py-3.5">
                        <div className="flex min-w-0 items-center gap-3">
                          <div
                            className={cn(
                              'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-sm font-semibold text-white',
                              avatarTone(company)
                            )}
                          >
                            {initialsFromName(company)}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-slate-900">{company}</p>
                            <p className="truncate text-xs text-slate-500">{sectorOf(c) || '—'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-semibold text-slate-600">
                            {person.name ? initialsFromName(person.name) : <User className="h-3.5 w-3.5" />}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-slate-800">
                              {person.name || '—'}
                            </p>
                            <p className="truncate text-xs text-slate-500">
                              {person.role || 'Contact'}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        {c.email ? (
                          <span className="inline-flex max-w-[180px] items-center gap-1.5 truncate text-sm text-slate-700">
                            <Mail className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                            {c.email}
                          </span>
                        ) : (
                          <span className="text-sm text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {c.phone ? (
                          <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-sm text-slate-700">
                            <Phone className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                            <span className="whitespace-nowrap tabular-nums">{c.phone}</span>
                          </span>
                        ) : (
                          <span className="text-sm text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        {cityLabel ? (
                          <span className="inline-flex items-center gap-1.5 text-sm text-slate-700">
                            <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                            {cityLabel}
                          </span>
                        ) : (
                          <span className="text-sm text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className={cn(
                            'inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset',
                            st.className
                          )}
                        >
                          {st.label}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="inline-flex items-center gap-1.5 text-sm text-slate-600">
                          <Calendar className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                          {relativeActivity(c)}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        {score != null ? (
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-800">
                              Score {score}
                            </p>
                            {insight ? (
                              <p className={cn('text-xs font-medium', insight.className)}>
                                {insight.label}
                              </p>
                            ) : null}
                          </div>
                        ) : (
                          <span className="text-sm text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <div
                          className="flex items-center justify-end gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-[#016AEB]"
                            aria-label="Voir"
                            onClick={() => navigate(`/contacts/${c.id}`)}
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                            aria-label="Plus"
                            onClick={() => navigate(`/contacts/${c.id}`)}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!isPending && filtered.length > 0 ? (
          <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-500">
              Affichage {(safePage * PAGE_SIZE + 1).toLocaleString('fr-FR')} à{' '}
              {Math.min((safePage + 1) * PAGE_SIZE, filtered.length).toLocaleString('fr-FR')} sur{' '}
              {filtered.length.toLocaleString('fr-FR')}
              {data?.total != null && data.total > filtered.length
                ? ` (total ${data.total.toLocaleString('fr-FR')})`
                : ''}{' '}
              entreprises
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 rounded-lg"
                disabled={safePage <= 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="min-w-[4.5rem] text-center text-sm text-slate-600">
                {safePage + 1} / {pageCount}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 rounded-lg"
                disabled={safePage >= pageCount - 1}
                onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
