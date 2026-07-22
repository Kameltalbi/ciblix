import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Users, Search, ChevronRight } from 'lucide-react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/form-controls';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type PipelineStatus = 'NOUVEAU' | 'CHAUD' | 'TIEDE' | 'A_RELANCER' | 'FROID' | 'ARCHIVE';

interface ContactRow {
  id: string;
  name?: string | null;
  companyName?: string | null;
  email?: string | null;
  phone?: string | null;
  pipelineStatus: PipelineStatus;
  pipelineStatusScore?: number | null;
  pipelineStatusAt?: string | null;
}

const STATUS_LABELS: Record<PipelineStatus, string> = {
  NOUVEAU: 'Nouveau',
  CHAUD: 'Chaud',
  TIEDE: 'Tiède',
  A_RELANCER: 'À relancer',
  FROID: 'Froid',
  ARCHIVE: 'Archivé',
};

const STATUS_CLASS: Record<PipelineStatus, string> = {
  NOUVEAU: 'bg-slate-100 text-slate-700',
  CHAUD: 'bg-emerald-100 text-emerald-800',
  TIEDE: 'bg-sky-100 text-sky-800',
  A_RELANCER: 'bg-amber-100 text-amber-800',
  FROID: 'bg-rose-100 text-rose-800',
  ARCHIVE: 'bg-gray-100 text-gray-600',
};

const FILTERS: Array<PipelineStatus | 'ALL'> = [
  'ALL',
  'CHAUD',
  'A_RELANCER',
  'TIEDE',
  'FROID',
  'NOUVEAU',
  'ARCHIVE',
];

export function Contacts() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<PipelineStatus | 'ALL'>('ALL');

  const { data, isPending } = useQuery({
    queryKey: ['contacts', search, status],
    queryFn: () =>
      api
        .get('/contacts', {
          params: {
            limit: 100,
            search: search.trim() || undefined,
            status: status === 'ALL' ? undefined : status,
            sort: 'pipelineStatusAt',
            sortDir: 'desc',
          },
        })
        .then((r) => r.data as { items: ContactRow[]; total: number }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
          <Users size={22} />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Contacts</h1>
          <p className="text-sm text-muted-foreground">
            Pipeline inféré par l&apos;IA — lecture seule, mis à jour automatiquement.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filtres</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher nom, entreprise, email…"
              className="pl-9"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((f) => (
              <Button
                key={f}
                size="sm"
                variant={status === f ? 'default' : 'outline'}
                onClick={() => setStatus(f)}
              >
                {f === 'ALL' ? 'Tous' : STATUS_LABELS[f]}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0 divide-y">
          {isPending ? (
            <p className="p-6 text-sm text-muted-foreground">Chargement…</p>
          ) : (data?.items || []).length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">Aucun contact pour le moment.</p>
          ) : (
            data!.items.map((c) => (
              <Link
                key={c.id}
                to={`/contacts/${c.id}`}
                className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/40 transition-colors"
              >
                <div className="min-w-0">
                  <p className="font-medium truncate">{c.name || c.companyName || 'Sans nom'}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {[c.companyName, c.email, c.phone].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={cn(
                      'text-xs font-medium px-2 py-0.5 rounded-full',
                      STATUS_CLASS[c.pipelineStatus]
                    )}
                    title="Statut inféré automatiquement"
                  >
                    {STATUS_LABELS[c.pipelineStatus]}
                    {c.pipelineStatusScore != null ? ` · ${Math.round(c.pipelineStatusScore)}` : ''}
                  </span>
                  <ChevronRight size={16} className="text-muted-foreground" />
                </div>
              </Link>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
