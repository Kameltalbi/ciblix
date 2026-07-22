import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Bot } from 'lucide-react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type PipelineStatus = 'NOUVEAU' | 'CHAUD' | 'TIEDE' | 'A_RELANCER' | 'FROID' | 'ARCHIVE';

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

export function ContactDetail() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();

  const { data, isPending, error } = useQuery({
    queryKey: ['contact', id],
    queryFn: () => api.get(`/contacts/${id}`).then((r) => r.data),
    enabled: Boolean(id),
  });

  const consentMutation = useMutation({
    mutationFn: () => api.post(`/integrations/whatsapp/consent/${id}`).then((r) => r.data),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['contact', id] }),
  });

  if (isPending) return <p className="text-sm text-muted-foreground p-4">Chargement…</p>;
  if (error || !data?.contact) {
    return <p className="text-sm text-destructive p-4">Contact introuvable.</p>;
  }

  const { contact, pipeline, events } = data;
  const status = contact.pipelineStatus as PipelineStatus;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/contacts">
          <Button variant="outline" size="sm" className="gap-1.5">
            <ArrowLeft size={14} /> Retour
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2">
            <span>{contact.name || contact.companyName || 'Contact'}</span>
            <span
              className={cn('text-xs font-medium px-2 py-0.5 rounded-full', STATUS_CLASS[status])}
              title={pipeline?.explanation || 'Statut inféré automatiquement'}
            >
              {STATUS_LABELS[status]}
              {contact.pipelineStatusScore != null
                ? ` · ${Math.round(contact.pipelineStatusScore)}/100`
                : ''}
            </span>
          </CardTitle>
          {pipeline?.explanation ? (
            <p className="text-xs text-muted-foreground">{pipeline.explanation}</p>
          ) : null}
        </CardHeader>
        <CardContent className="text-sm space-y-1 text-muted-foreground">
          {contact.companyName ? <p>Entreprise : {contact.companyName}</p> : null}
          {contact.email ? <p>Email : {contact.email}</p> : null}
          {contact.phone ? <p>Téléphone : {contact.phone}</p> : null}
          {contact.whatsappId ? (
            <p>
              WhatsApp : {contact.whatsappId}
              {contact.whatsappConsentAt ? (
                <span className="text-emerald-700"> · consentement OK</span>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="ml-2 h-7"
                  onClick={() => consentMutation.mutate()}
                  disabled={consentMutation.isPending}
                >
                  Enregistrer consentement WhatsApp
                </Button>
              )}
            </p>
          ) : null}
          <p className="text-xs pt-2">Statut calculé automatiquement — non modifiable.</p>
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Link to={`/agents/offre-bot?contactId=${contact.id}`}>
          <Button variant="secondary" size="sm">
            Générer une offre
          </Button>
        </Link>
        <Link to="/ai-assistant">
          <Button variant="outline" size="sm" className="gap-1.5">
            <Bot size={14} /> Ouvrir Copilot
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Historique AgentEvent</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {(events || []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun événement enregistré.</p>
          ) : (
            events.map((e: {
              id: string;
              source: string;
              type: string;
              resume?: string | null;
              score?: number | null;
              createdAt: string;
            }) => (
              <div key={e.id} className="rounded-lg border p-3 text-sm">
                <p className="text-xs text-muted-foreground mb-1">
                  {e.source} · {e.type} · {new Date(e.createdAt).toLocaleString('fr-FR')}
                  {e.score != null ? ` · score ${e.score}` : ''}
                </p>
                <p className="whitespace-pre-wrap">{e.resume || '—'}</p>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
