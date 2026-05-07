import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Building2, Mail, Phone, FileBadge, MapPin, FileText } from 'lucide-react';
import { api } from '@/lib/api';
import { fmtDT } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Badge,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/form-controls';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { StatutBadge } from './Dashboard';
import type { Activite, Affaire, Client } from '@/types';

type ClientDetailData = Client & {
  affaires: Affaire[];
};

type ClientInteraction = Activite & {
  affaireTitle: string;
  affaireId: string;
  clientName: string;
};

export function ClientDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [addInteractionOpen, setAddInteractionOpen] = useState(false);
  const [selectedAffaireId, setSelectedAffaireId] = useState('');

  const { data: client, isLoading } = useQuery<ClientDetailData>({
    queryKey: ['client', id],
    queryFn: () => api.get(`/clients/${id}`).then((r) => r.data),
    enabled: !!id,
  });

  const interactions = useMemo(() => {
    if (!client?.affaires) return [] as ClientInteraction[];
    return client.affaires
      .flatMap((affaire) =>
        (affaire.activites || []).map((activite) => ({
          ...activite,
          affaireTitle: affaire.title,
          affaireId: affaire.id,
          clientName: client.name,
        }))
      )
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [client]);

  if (isLoading) return <p className="text-muted-foreground">Chargement...</p>;
  if (!client) return <p className="text-muted-foreground">Client introuvable.</p>;

  return (
    <div className="space-y-5 px-2 md:px-0">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => navigate('/clients')}>
          <ArrowLeft size={16} className="mr-2" />
          Retour clients
        </Button>
        <Button
          size="sm"
          onClick={() => {
            if (!client.affaires.length) return;
            setSelectedAffaireId(client.affaires[0].id);
            setAddInteractionOpen(true);
          }}
          disabled={!client.affaires.length}
        >
          Ajouter interaction
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-2xl md:text-3xl font-serif">{client.name}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Building2 size={15} />
            <span>{client.contactName || 'Contact non renseigné'}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Mail size={15} />
            <span>{client.email || 'Email non renseigné'}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Phone size={15} />
            <span>{client.phone || 'Téléphone non renseigné'}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <FileBadge size={15} />
            <span>{client.matricule || 'Matricule non renseigné'}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground md:col-span-2">
            <MapPin size={15} />
            <span>{client.address || 'Adresse non renseignée'}</span>
          </div>
          {client.notes && (
            <div className="text-sm md:col-span-2">
              <p className="font-medium mb-1">Notes</p>
              <p className="text-muted-foreground whitespace-pre-wrap">{client.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Opportunités du client ({client.affaires.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {client.affaires.length === 0 && (
              <p className="text-sm text-muted-foreground">Aucune opportunité.</p>
            )}
            {client.affaires.map((affaire) => (
              <button
                key={affaire.id}
                type="button"
                onClick={() => navigate(`/affaires/${affaire.id}`)}
                className="w-full text-left border rounded-lg p-3 hover:bg-muted/40 transition-colors"
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <p className="font-medium text-sm">{affaire.title}</p>
                  <StatutBadge statut={affaire.statut} />
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>{fmtDT(Number(affaire.montantHT || 0))}</span>
                  <span>•</span>
                  <span>{affaire.type || 'Sans catégorie'}</span>
                  <span>•</span>
                  <span>
                    {affaire.moisPrevu}/{affaire.anneePrevue}
                  </span>
                  <Badge variant="outline">{affaire._count?.activites || 0} interaction(s)</Badge>
                </div>
              </button>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Interactions ({interactions.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-[60vh] overflow-y-auto">
            {interactions.length === 0 && (
              <p className="text-sm text-muted-foreground">Aucune interaction enregistrée.</p>
            )}
            {interactions.map((interaction) => (
              <button
                key={interaction.id}
                type="button"
                onClick={() => navigate(`/affaires/${interaction.affaireId}`)}
                className="w-full text-left border rounded-lg p-3 hover:bg-muted/40 transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium text-sm">{interaction.title}</p>
                  <span className="text-xs text-muted-foreground">
                    {new Date(interaction.createdAt).toLocaleString('fr-FR')}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  <FileText size={12} />
                  <span>{interaction.affaireTitle}</span>
                </div>
                {interaction.content && (
                  <p className="text-xs text-muted-foreground mt-2 line-clamp-3">
                    {interaction.content}
                  </p>
                )}
              </button>
            ))}
          </CardContent>
        </Card>
      </div>

      <Dialog open={addInteractionOpen} onOpenChange={setAddInteractionOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Ajouter une interaction</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Choisir l'opportunité liée</Label>
            <Select value={selectedAffaireId} onValueChange={setSelectedAffaireId}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner une opportunité" />
              </SelectTrigger>
              <SelectContent>
                {client.affaires.map((affaire) => (
                  <SelectItem key={affaire.id} value={affaire.id}>
                    {affaire.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddInteractionOpen(false)}>
              Annuler
            </Button>
            <Button
              disabled={!selectedAffaireId}
              onClick={() => {
                if (!selectedAffaireId) return;
                navigate(`/affaires/${selectedAffaireId}?addActivity=1`);
              }}
            >
              Continuer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
