import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import {
  Input,
  Label,
  Textarea,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/form-controls';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import type { Client } from '@/types';

export type ClientFormValues = {
  id?: string;
  name: string;
  contactName: string;
  email: string;
  phone: string;
  address: string;
  matricule: string;
  qualificatif: string;
  notes: string;
};

const EMPTY: ClientFormValues = {
  id: '',
  name: '',
  contactName: '',
  email: '',
  phone: '',
  address: '',
  matricule: '',
  qualificatif: 'NON_SPECIFIE',
  notes: '',
};

type ClientFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client?: Client | null;
  initialName?: string;
  onSuccess?: (client: Client) => void;
};

export function ClientFormDialog({
  open,
  onOpenChange,
  client,
  initialName,
  onSuccess,
}: ClientFormDialogProps) {
  const qc = useQueryClient();
  const [form, setForm] = useState<ClientFormValues>(EMPTY);

  useEffect(() => {
    if (!open) return;
    if (client) {
      setForm({
        id: client.id,
        name: client.name,
        contactName: client.contactName || '',
        email: client.email || '',
        phone: client.phone || '',
        address: client.address || '',
        matricule: client.matricule || '',
        qualificatif: client.qualificatif || 'NON_SPECIFIE',
        notes: client.notes || '',
      });
    } else {
      setForm({ ...EMPTY, name: initialName ?? '' });
    }
  }, [open, client, initialName]);

  const saveMutation = useMutation({
    mutationFn: async (data: ClientFormValues): Promise<Client> => {
      const payload = { ...data };
      delete (payload as Partial<ClientFormValues>).id;
      const res = data.id
        ? await api.put(`/clients/${data.id}`, payload)
        : await api.post('/clients', payload);
      return res.data as Client;
    },
    onSuccess: async (saved) => {
      await qc.invalidateQueries({ queryKey: ['clients'], refetchType: 'all' });
      onOpenChange(false);
      onSuccess?.(saved);
    },
    onError: (error: unknown) => {
      const err = error as {
        response?: { status?: number; data?: { error?: string } };
        message?: string;
      };
      const msg = err.response?.data?.error || err.message || 'Erreur inconnue';
      alert(msg);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{form.id ? 'Modifier' : 'Nouveau'} client</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 space-y-1.5">
            <Label>Raison sociale *</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label>Contact</Label>
            <Input
              value={form.contactName}
              onChange={(e) => setForm({ ...form, contactName: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Matricule fiscal</Label>
            <Input
              value={form.matricule}
              onChange={(e) => setForm({ ...form, matricule: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Qualificatif</Label>
            <Select
              value={form.qualificatif}
              onValueChange={(v) => setForm({ ...form, qualificatif: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="NON_SPECIFIE">Non spécifié</SelectItem>
                <SelectItem value="PROSPECT">🔍 Prospect</SelectItem>
                <SelectItem value="CLIENT">🤝 Client</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Téléphone</Label>
            <Input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label>Adresse</Label>
            <Input
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label>Notes</Label>
            <Textarea
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button
            onClick={() => saveMutation.mutate(form)}
            disabled={!form.name || saveMutation.isPending}
          >
            {saveMutation.isPending ? 'Enregistrement…' : '💾 Enregistrer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
