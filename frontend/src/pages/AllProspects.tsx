import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  Mail,
  MessageCircle,
  CalendarClock,
  Phone,
  Globe,
  ExternalLink,
  Edit,
  Trash2,
  CheckCircle,
  Clock,
  Loader2,
  Flame,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input, Label } from '@/components/ui/form-controls';

type Potential = 'TRES_FORT' | 'MOYEN' | 'FAIBLE' | string | null;

interface AiProspectRow {
  id: string;
  companyName: string;
  website?: string | null;
  linkedin?: string | null;
  phone?: string | null;
  email?: string | null;
  city?: string | null;
  country?: string | null;
  industry?: string | null;
  companySize?: string | null;
  score: number;
  scoreReason?: string | null;
  suggestedPitch?: string | null;
  commercialAngle?: string | null;
  aiSummary?: string | null;
  potentialLevel?: Potential;
  interestProbability?: number | null;
  status: string;
  lastContactAt?: string | null;
  emailOpenedAt?: string | null;
  lastReplyAt?: string | null;
  probableBusinessProblem?: string | null;
  suggestedOffer?: string | null;
}

export function AllProspects() {
  const { t } = useTranslation();
  const [editing, setEditing] = useState<{ open: boolean; id: string | null; data: Partial<AiProspectRow> }>({
    open: false,
    id: null,
    data: {},
  });

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['prospecting-all'],
    queryFn: async () => {
      const res = await api.get<{ prospects: AiProspectRow[] }>('/api/prospecting/all');
      return res.data.prospects;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/api/prospecting/${id}`);
    },
    onSuccess: () => refetch(),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<AiProspectRow> }) => {
      await api.patch(`/api/prospecting/${id}`, data);
    },
    onSuccess: () => {
      setEditing({ open: false, id: null, data: {} });
      refetch();
    },
  });

  const messageMutation = useMutation({
    mutationFn: async ({ id, messageType, tone }: { id: string; messageType: string; tone: string }) => {
      return await api.post('/api/prospecting/message', { id, messageType, tone });
    },
    onSuccess: () => refetch(),
  });

  const handleEdit = (prospect: AiProspectRow) => {
    setEditing({ open: true, id: prospect.id, data: { ...prospect } });
  };

  const handleDelete = (id: string) => {
    if (confirm('Supprimer ce prospect ?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleSave = () => {
    if (!editing.id) return;
    updateMutation.mutate({ id: editing.id, data: editing.data });
  };

  const hasContacted = (p: AiProspectRow) => !!p.lastContactAt;
  const hasEmailOpened = (p: AiProspectRow) => !!p.emailOpenedAt;
  const hasReplied = (p: AiProspectRow) => !!p.lastReplyAt;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="animate-spin h-8 w-8 text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">{t('prospecting.allProspects.title')}</h1>
          <p className="text-muted-foreground mt-1">
            {data?.length || 0} {t('prospecting.allProspects.subtitle')}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {data?.map((prospect) => (
          <Card key={prospect.id} className="relative hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-lg font-semibold">{prospect.companyName}</CardTitle>
                  <div className="text-sm text-muted-foreground mt-1">
                    {prospect.industry && <span>{prospect.industry}</span>}
                    {prospect.city && <span>{prospect.industry && ' • '}{prospect.city}</span>}
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleEdit(prospect)}
                    className="h-8 w-8"
                  >
                    <Edit size={14} />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleDelete(prospect.id)}
                    className="h-8 w-8 text-destructive hover:text-destructive"
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>

              <div className="flex items-center gap-2 mt-3 flex-wrap">
                {hasReplied(prospect) && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-green-100 text-green-700">
                    <CheckCircle size={12} /> Répondu
                  </span>
                )}
                {hasEmailOpened(prospect) && !hasReplied(prospect) && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-700">
                    <Clock size={12} /> Email ouvert
                  </span>
                )}
                {hasContacted(prospect) && !hasEmailOpened(prospect) && !hasReplied(prospect) && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-yellow-100 text-yellow-700">
                    <Clock size={12} /> Contacté
                  </span>
                )}
                {!hasContacted(prospect) && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-700">
                    Nouveau
                  </span>
                )}
                {prospect.potentialLevel === 'TRES_FORT' && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-red-100 text-red-700">
                    <Flame size={12} /> Hot
                  </span>
                )}
              </div>
            </CardHeader>

            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-sm">
                {prospect.email && (
                  <div className="flex items-center gap-1 truncate">
                    <Mail size={14} className="text-muted-foreground flex-shrink-0" />
                    <span className="truncate">{prospect.email}</span>
                  </div>
                )}
                {prospect.phone && (
                  <div className="flex items-center gap-1 truncate">
                    <Phone size={14} className="text-muted-foreground flex-shrink-0" />
                    <span className="truncate">{prospect.phone}</span>
                  </div>
                )}
                {prospect.website && (
                  <div className="flex items-center gap-1 truncate col-span-2">
                    <Globe size={14} className="text-muted-foreground flex-shrink-0" />
                    <a
                      href={prospect.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline truncate"
                    >
                      {prospect.website}
                    </a>
                  </div>
                )}
                {prospect.linkedin && (
                  <div className="flex items-center gap-1 truncate col-span-2">
                    <ExternalLink size={14} className="text-muted-foreground flex-shrink-0" />
                    <a
                      href={prospect.linkedin}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline truncate"
                    >
                      LinkedIn
                    </a>
                  </div>
                )}
              </div>

              {prospect.aiSummary && (
                <div className="text-sm bg-muted/50 p-2 rounded-md">
                  <span className="font-medium">IA :</span> {prospect.aiSummary}
                </div>
              )}

              {prospect.suggestedPitch && (
                <div className="text-sm bg-muted/50 p-2 rounded-md">
                  <span className="font-medium">Pitch :</span> {prospect.suggestedPitch}
                </div>
              )}

              <div className="flex flex-wrap gap-2 pt-2">
                <Button
                  size="sm"
                  variant="default"
                  className="gap-1 text-xs"
                  onClick={() => messageMutation.mutate({ id: prospect.id, messageType: 'FIRST_CONTACT', tone: 'commercial' })}
                  disabled={messageMutation.isPending}
                >
                  <Mail size={14} /> Email IA
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1 text-xs"
                  onClick={() => messageMutation.mutate({ id: prospect.id, messageType: 'LINKEDIN', tone: 'doux' })}
                  disabled={messageMutation.isPending}
                >
                  <MessageCircle size={14} /> LinkedIn
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1 text-xs"
                  onClick={() => messageMutation.mutate({ id: prospect.id, messageType: 'WHATSAPP', tone: 'commercial' })}
                  disabled={messageMutation.isPending}
                >
                  <MessageCircle size={14} /> WhatsApp
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1 text-xs"
                  onClick={() => messageMutation.mutate({ id: prospect.id, messageType: 'FOLLOW_UP', tone: 'commercial' })}
                  disabled={messageMutation.isPending}
                >
                  <CalendarClock size={14} /> Relance
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {!data || data.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          Aucun prospect pour le moment
        </div>
      )}

      <Dialog open={editing.open} onOpenChange={(open) => setEditing({ ...editing, open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier le prospect</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="companyName">Nom de l'entreprise</Label>
              <Input
                id="companyName"
                value={editing.data.companyName || ''}
                onChange={(e) => setEditing({ ...editing, data: { ...editing.data, companyName: e.target.value } })}
              />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                value={editing.data.email || ''}
                onChange={(e) => setEditing({ ...editing, data: { ...editing.data, email: e.target.value } })}
              />
            </div>
            <div>
              <Label htmlFor="phone">Téléphone</Label>
              <Input
                id="phone"
                value={editing.data.phone || ''}
                onChange={(e) => setEditing({ ...editing, data: { ...editing.data, phone: e.target.value } })}
              />
            </div>
            <div>
              <Label htmlFor="website">Site web</Label>
              <Input
                id="website"
                value={editing.data.website || ''}
                onChange={(e) => setEditing({ ...editing, data: { ...editing.data, website: e.target.value } })}
              />
            </div>
            <div>
              <Label htmlFor="linkedin">LinkedIn</Label>
              <Input
                id="linkedin"
                value={editing.data.linkedin || ''}
                onChange={(e) => setEditing({ ...editing, data: { ...editing.data, linkedin: e.target.value } })}
              />
            </div>
            <div>
              <Label htmlFor="aiSummary">Résumé IA</Label>
              <Input
                id="aiSummary"
                value={editing.data.aiSummary || ''}
                onChange={(e) => setEditing({ ...editing, data: { ...editing.data, aiSummary: e.target.value } })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing({ open: false, id: null, data: {} })}>
              Annuler
            </Button>
            <Button onClick={handleSave} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : null}
              Sauvegarder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
