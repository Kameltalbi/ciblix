import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Send } from 'lucide-react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/form-controls';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

type Ticket = {
  id: string;
  subject: string;
  description: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'WAITING_USER' | 'RESOLVED' | 'CLOSED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  category: 'BUG' | 'BILLING' | 'FEATURE' | 'OTHER';
  createdAt: string;
  updatedAt: string;
  _count?: { messages: number };
};

export function SupportTickets() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'>('MEDIUM');
  const [category, setCategory] = useState<'BUG' | 'BILLING' | 'FEATURE' | 'OTHER'>('OTHER');
  const [reply, setReply] = useState('');
  const subjectLength = subject.trim().length;
  const descriptionLength = description.trim().length;

  const { data: ticketsData } = useQuery<{ data: Ticket[] }>({
    queryKey: ['support-tickets', 'me'],
    queryFn: () => api.get('/support-tickets', { params: { mineOnly: 1, limit: 50 } }).then((r) => r.data),
  });
  const tickets = ticketsData?.data || [];

  const { data: selectedTicket } = useQuery<any>({
    queryKey: ['support-ticket', selectedTicketId],
    queryFn: () => api.get(`/support-tickets/${selectedTicketId}`).then((r) => r.data),
    enabled: Boolean(selectedTicketId),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      api.post('/support-tickets', {
        subject,
        description,
        priority,
        category,
      }),
    onSuccess: ({ data: createdTicket }: { data: Ticket }) => {
      qc.setQueryData<{ data: Ticket[] } | undefined>(['support-tickets', 'me'], (current) => {
        const currentData = current?.data || [];
        const alreadyExists = currentData.some((ticket) => ticket.id === createdTicket.id);
        if (alreadyExists) return current;
        return { data: [createdTicket, ...currentData] };
      });
      qc.invalidateQueries({ queryKey: ['support-tickets', 'me'] });
      setSelectedTicketId(createdTicket.id);
      setOpen(false);
      setSubject('');
      setDescription('');
      setPriority('MEDIUM');
      setCategory('OTHER');
    },
  });

  const replyMutation = useMutation({
    mutationFn: () => api.post(`/support-tickets/${selectedTicketId}/messages`, { body: reply }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['support-ticket', selectedTicketId] });
      qc.invalidateQueries({ queryKey: ['support-tickets'] });
      setReply('');
    },
  });

  const closeMutation = useMutation({
    mutationFn: () => api.patch(`/support-tickets/${selectedTicketId}`, { status: 'CLOSED' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['support-ticket', selectedTicketId] });
      qc.invalidateQueries({ queryKey: ['support-tickets'] });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl md:text-4xl font-bold tracking-tight">Support</h1>
          <p className="text-sm text-muted-foreground mt-1">Créez un ticket et échangez avec le support.</p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus size={16} className="mr-2" />
          Nouveau ticket
        </Button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Card className="xl:col-span-1">
          <CardHeader>
            <CardTitle>Mes tickets</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {tickets.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun ticket pour le moment.</p>
            ) : (
              tickets.map((ticket) => (
                <button
                  key={ticket.id}
                  onClick={() => setSelectedTicketId(ticket.id)}
                  className={`w-full text-left p-3 rounded-lg border transition ${
                    selectedTicketId === ticket.id ? 'border-primary bg-primary/5' : 'hover:bg-muted/40'
                  }`}
                >
                  <p className="font-medium truncate">{ticket.subject}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {ticket.status} - {ticket.priority} - {ticket._count?.messages || 0} msg
                  </p>
                </button>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>{selectedTicket ? selectedTicket.subject : 'Sélectionnez un ticket'}</CardTitle>
          </CardHeader>
          <CardContent>
            {!selectedTicket ? (
              <div className="text-sm text-muted-foreground">Sélectionnez un ticket à gauche pour voir l’historique.</div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>
                    Statut: <strong>{selectedTicket.status}</strong> - Priorité: <strong>{selectedTicket.priority}</strong>
                  </span>
                  {selectedTicket.status !== 'CLOSED' && (
                    <Button size="sm" variant="outline" onClick={() => closeMutation.mutate()} disabled={closeMutation.isPending}>
                      Clôturer
                    </Button>
                  )}
                </div>
                <div className="space-y-2 max-h-[380px] overflow-auto pr-1">
                  {selectedTicket.messages?.map((m: any) => (
                    <div key={m.id} className="rounded-lg border p-3">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{m.author?.name || m.author?.email}</span>
                        <span>{new Date(m.createdAt).toLocaleString()}</span>
                      </div>
                      <p className="text-sm mt-2 whitespace-pre-wrap">{m.body}</p>
                    </div>
                  ))}
                </div>
                {selectedTicket.status !== 'CLOSED' && (
                  <div className="space-y-2">
                    <Label>Votre réponse</Label>
                    <Input value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Écrivez votre message..." />
                    <Button onClick={() => replyMutation.mutate()} disabled={replyMutation.isPending || !reply.trim()}>
                      <Send size={14} className="mr-2" />
                      Envoyer
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouveau ticket support</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Sujet</Label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Ex: Problème de connexion" />
              {subjectLength > 0 && subjectLength < 3 && (
                <p className="text-xs text-destructive">Le sujet doit contenir au moins 3 caractères.</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <textarea
                className="w-full min-h-[120px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Décrivez votre problème en détail..."
              />
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">Minimum 10 caractères.</p>
                <p className={`text-xs ${descriptionLength < 10 ? 'text-destructive' : 'text-muted-foreground'}`}>
                  {descriptionLength}/10
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Priorité</Label>
                <Select value={priority} onValueChange={(v: any) => setPriority(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LOW">LOW</SelectItem>
                    <SelectItem value="MEDIUM">MEDIUM</SelectItem>
                    <SelectItem value="HIGH">HIGH</SelectItem>
                    <SelectItem value="URGENT">URGENT</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Catégorie</Label>
                <Select value={category} onValueChange={(v: any) => setCategory(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BUG">BUG</SelectItem>
                    <SelectItem value="BILLING">BILLING</SelectItem>
                    <SelectItem value="FEATURE">FEATURE</SelectItem>
                    <SelectItem value="OTHER">OTHER</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending || subjectLength < 3 || descriptionLength < 10}
            >
              Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
