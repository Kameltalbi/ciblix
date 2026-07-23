import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Bot, ExternalLink } from 'lucide-react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  ContactTimeline,
  CrossAgentBanner,
  type AgentEventItem,
} from '@/components/contact/ContactTimeline';
import { SuggestionBanner, type SuggestionItem } from '@/components/contact/SuggestionBanner';

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

  const { contact, events, suggestions } = data as {
    contact: {
      id: string;
      name?: string | null;
      companyName?: string | null;
      email?: string | null;
      phone?: string | null;
      whatsappId?: string | null;
      whatsappConsentAt?: string | null;
      createdVia?: string;
      pipelineStatusScore?: number | null;
      createdAt?: string;
    };
    events: AgentEventItem[];
    suggestions?: SuggestionItem[];
  };
  const timelineEvents = events || [];
  const pendingSuggestions = suggestions || [];
  const score = contact.pipelineStatusScore;
  const whyDetected = timelineEvents.find((e) => e.resume)?.resume;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
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
            <span>{contact.companyName || contact.name || 'Résultat agent'}</span>
            {score != null ? (
              <span
                className={cn(
                  'text-xs font-semibold px-2 py-0.5 rounded-md tabular-nums',
                  score >= 70
                    ? 'bg-emerald-50 text-emerald-700'
                    : score >= 40
                      ? 'bg-amber-50 text-amber-700'
                      : 'bg-slate-100 text-slate-600'
                )}
              >
                Score IA {Math.round(score)}
              </span>
            ) : null}
          </CardTitle>
          {whyDetected ? (
            <p className="text-xs text-muted-foreground line-clamp-2">
              Pourquoi détecté : {whyDetected}
            </p>
          ) : null}
        </CardHeader>
        <CardContent className="text-sm space-y-1 text-muted-foreground">
          {contact.name ? <p>Contact : {contact.name}</p> : null}
          {contact.companyName ? <p>Entreprise : {contact.companyName}</p> : null}
          {contact.email ? <p>Email : {contact.email}</p> : null}
          {contact.phone ? <p>Téléphone : {contact.phone}</p> : null}
          {contact.createdVia ? <p>Source : {contact.createdVia}</p> : null}
          {contact.createdAt ? (
            <p>
              Détecté le{' '}
              {new Date(contact.createdAt).toLocaleDateString('fr-FR', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </p>
          ) : null}
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
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
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
        <Link to="/agents/gmail-ai">
          <Button variant="outline" size="sm" className="gap-1.5">
            <ExternalLink size={14} /> Gmail IA
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Historique</CardTitle>
        </CardHeader>
        <CardContent>
          <SuggestionBanner contactId={contact.id} suggestions={pendingSuggestions} />
          <CrossAgentBanner events={timelineEvents} />
          <ContactTimeline events={timelineEvents} />
        </CardContent>
      </Card>
    </div>
  );
}
