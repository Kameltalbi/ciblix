import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Search,
  ChevronRight,
  Mail,
  FileSignature,
  Radio,
  Download,
} from 'lucide-react';
import { api } from '@/lib/api';
import { Input } from '@/components/ui/form-controls';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ContactRow {
  id: string;
  name?: string | null;
  companyName?: string | null;
  email?: string | null;
  phone?: string | null;
  createdVia?: string;
  pipelineStatusScore?: number | null;
  createdAt?: string;
}

const SOURCE_LABELS: Record<string, string> = {
  HUNT: 'Chasseur IA',
  COPILOT: 'Assistant IA',
  GMAIL: 'Gmail IA',
  SCOUT: 'Veilleur IA',
  OFFREBOT: "Rédacteur d'offres",
  MANUAL_IMPORT: 'Import',
};

export function Contacts() {
  const [search, setSearch] = useState('');

  const { data, isPending } = useQuery({
    queryKey: ['contacts', search],
    queryFn: () =>
      api
        .get('/contacts', {
          params: {
            limit: 100,
            search: search.trim() || undefined,
            sort: 'createdAt',
            sortDir: 'desc',
          },
        })
        .then((r) => r.data as { items: ContactRow[]; total: number }),
  });

  const items = data?.items || [];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Résultats agents
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">Contacts</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Entreprises et personnes détectées par vos agents — pas un pipeline commercial.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" disabled title="Bientôt">
            <Download size={14} /> Exporter
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to="/prospection-ia" className="gap-1.5">
              <Radio size={14} /> Lancer Chasseur IA
            </Link>
          </Button>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher entreprise, contact, email…"
          className="pl-9 h-10"
        />
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3 font-medium">Entreprise</th>
                <th className="px-4 py-3 font-medium">Contact</th>
                <th className="px-4 py-3 font-medium">Score IA</th>
                <th className="px-4 py-3 font-medium">Téléphone</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Source</th>
                <th className="px-4 py-3 font-medium">Détecté</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isPending ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                    Chargement…
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                    Aucun résultat pour le moment. Lancez le Chasseur IA pour en détecter.
                  </td>
                </tr>
              ) : (
                items.map((c) => (
                  <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <Link
                        to={`/contacts/${c.id}`}
                        className="font-medium text-foreground hover:underline"
                      >
                        {c.companyName || '—'}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{c.name || '—'}</td>
                    <td className="px-4 py-3">
                      {c.pipelineStatusScore != null ? (
                        <span
                          className={cn(
                            'inline-flex rounded-md px-1.5 py-0.5 text-xs font-semibold tabular-nums',
                            c.pipelineStatusScore >= 70
                              ? 'bg-emerald-50 text-emerald-700'
                              : c.pipelineStatusScore >= 40
                                ? 'bg-amber-50 text-amber-700'
                                : 'bg-slate-100 text-slate-600'
                          )}
                        >
                          {Math.round(c.pipelineStatusScore)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground tabular-nums">{c.phone || '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground truncate max-w-[160px]">
                      {c.email || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-muted-foreground">
                        {SOURCE_LABELS[c.createdVia || ''] || c.createdVia || 'Agent'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {c.createdAt
                        ? new Date(c.createdAt).toLocaleDateString('fr-FR', {
                            day: 'numeric',
                            month: 'short',
                          })
                        : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {c.email ? (
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" asChild title="Gmail IA">
                            <Link to={`/agents/gmail-ai`}>
                              <Mail size={14} />
                            </Link>
                          </Button>
                        ) : null}
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" asChild title="Offre">
                          <Link to={`/agents/offre-bot?contactId=${c.id}`}>
                            <FileSignature size={14} />
                          </Link>
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" asChild title="Fiche">
                          <Link to={`/contacts/${c.id}`}>
                            <ChevronRight size={14} />
                          </Link>
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {data?.total != null ? (
          <div className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
            {data.total} résultat{data.total > 1 ? 's' : ''}
          </div>
        ) : null}
      </div>
    </div>
  );
}
