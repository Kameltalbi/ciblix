import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Mail, Phone, FileBadge, Search, TrendingUp, MoreVertical, Upload } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input, Label, DropdownMenu, DropdownMenuTriggerButton, DropdownMenuContentWrapper, DropdownMenuItem } from '@/components/ui/form-controls';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ClientFormDialog } from '@/components/clients/ClientFormDialog';
import type { Client } from '@/types';
import * as XLSX from 'xlsx';

type ImportClient = {
  name: string;
  contactName: string;
  email: string;
  phone: string;
  address: string;
  matricule: string;
  qualificatif: string;
  notes: string;
};

export function Clients() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [search, setSearch] = useState('');
  const [importFile, setImportFile] = useState<File | null>(null);

  const [page, setPage] = useState(1);

  const {
    data: clientsData,
    error: clientsError,
    isError: clientsQueryError,
    isFetching: clientsFetching,
    refetch: refetchClients,
  } = useQuery<{ data: Client[], pagination: any }>({
    queryKey: ['clients', page],
    queryFn: () => api.get('/clients', { params: { page, limit: 50 } }).then((r) => r.data),
  });
  const clients = clientsData?.data || [];
  const pagination = clientsData?.pagination;

  const q = search.trim().toLowerCase();
  const filteredClients = clients.filter((c) => {
    const name = (c.name ?? '').toLowerCase();
    const contact = (c.contactName ?? '').toLowerCase();
    const email = (c.email ?? '').toLowerCase();
    return !q || name.includes(q) || contact.includes(q) || email.includes(q);
  });

  const totalListed = pagination?.total ?? clients.length;
  const totalAffairesOnPage = clients.reduce((sum, c) => sum + (c._count?.affaires || 0), 0);
  const avgAffairesPerClient =
    clients.length > 0 ? (totalAffairesOnPage / clients.length).toFixed(1) : '0';

  const handleClientSaved = () => {
    if (!editingClient) {
      setPage(1);
      setSearch('');
    }
    void qc.invalidateQueries({ queryKey: ['clients'], refetchType: 'all' });
    setEditingClient(null);
  };

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/clients/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['clients'], refetchType: 'all' }),
  });

  const importMutation = useMutation({
    mutationFn: (clients: ImportClient[]) => api.post('/clients/import', { clients }),
    onSuccess: async () => {
      setPage(1);
      setSearch('');
      await qc.invalidateQueries({ queryKey: ['clients'], refetchType: 'all' });
      setImportOpen(false);
      setImportFile(null);
    },
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImportFile(file);
    }
  };

  const handleImport = () => {
    if (!importFile) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const data = e.target?.result;
      if (data) {
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(sheet) as any[];

        const clientsToImport = jsonData.map((row: any) => ({
          name: row.name || row.Raison_sociale || row['Raison sociale'] || '',
          contactName: row.contactName || row.Contact || '',
          email: row.email || row.Email || '',
          phone: row.phone || row.Téléphone || row.Telephone || '',
          address: row.address || row.Adresse || '',
          matricule: row.matricule || row.Matricule || '',
          qualificatif: row.qualificatif || row.Qualificatif || 'NON_SPECIFIE',
          notes: row.notes || row.Notes || '',
        }));

        importMutation.mutate(clientsToImport);
      }
    };
    reader.readAsBinaryString(importFile);
  };

  const openEdit = (c: Client) => {
    setEditingClient(c);
    setOpen(true);
  };

  const openCreate = () => {
    setEditingClient(null);
    setOpen(true);
  };

  return (
    <div className="space-y-6 px-2 md:px-0">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl md:text-3xl">{t('clients.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('clients.manageClients')}</p>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <Button onClick={() => setImportOpen(true)} variant="outline" className="w-full sm:w-auto">
            <Upload size={16} />{t('common.import')} Excel
          </Button>
          <Button onClick={openCreate} className="w-full sm:w-auto">
            <Plus size={16} />{t('clients.addClient')}
          </Button>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <Card className="border-2">
          <CardContent className="p-2">
            <div className="flex items-center gap-1.5">
              <div className="p-1.5 bg-gray-100 rounded-lg">
                <TrendingUp className="w-3 h-3 md:w-4 md:h-4 text-gray-600" />
              </div>
              <div>
                <p className="text-[9px] md:text-[10px] text-muted-foreground">{t('clients.totalClients')}</p>
                <p className="text-sm md:text-lg font-bold">{totalListed}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-2 border-sky-200 bg-sky-50/30">
          <CardContent className="p-2">
            <div className="flex items-center gap-1.5">
              <div className="p-1.5 bg-sky-100 rounded-lg">
                <TrendingUp className="w-3 h-3 md:w-4 md:h-4 text-sky-600" />
              </div>
              <div>
                <p className="text-[9px] md:text-[10px] text-muted-foreground">{t('clients.totalAffaires')}</p>
                <p className="text-sm md:text-lg font-bold text-sky-600">{totalAffairesOnPage}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-2 border-blue-200 bg-blue-50/30">
          <CardContent className="p-2">
            <div className="flex items-center gap-1.5">
              <div className="p-1.5 bg-blue-100 rounded-lg">
                <TrendingUp className="w-3 h-3 md:w-4 md:h-4 text-blue-600" />
              </div>
              <div>
                <p className="text-[9px] md:text-[10px] text-muted-foreground">{t('clients.avgPerClient')}</p>
                <p className="text-sm md:text-lg font-bold text-blue-600">{avgAffairesPerClient}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {clientsQueryError && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="flex flex-col gap-2 p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
            <p className="text-destructive">
              {(clientsError as { response?: { data?: { error?: string } } })?.response?.data?.error
                ?? 'Impossible de charger la liste des clients (réseau ou droits d’accès).'}
            </p>
            <Button type="button" variant="outline" size="sm" onClick={() => refetchClients()}>
              Réessayer
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Search */}
      <Card>
        <CardContent className="p-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder={t('clients.searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
            {clientsFetching && !clientsQueryError && (
              <p className="mt-2 text-xs text-muted-foreground">Mise à jour de la liste…</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* List View */}
      <Card>
        <CardContent className="p-0">
          <div className="md:hidden space-y-3 p-3">
            {filteredClients.map((c) => (
              <Card
                key={c.id}
                className="border cursor-pointer hover:bg-sage/40 transition-colors"
                onClick={() => navigate(`/clients/${c.id}`)}
              >
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{c.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{c.contactName || '—'}</p>
                    </div>
                    <span className="bg-sage text-leaf px-2 py-0.5 rounded-full text-xs font-medium">
                      {c._count?.affaires || 0}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-1 text-xs">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Mail size={12} /> <span className="truncate">{c.email || '—'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Phone size={12} /> <span>{c.phone || '—'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <FileBadge size={12} />
                      <span>{c.qualificatif === 'PROSPECT' ? '🔍 Prospect' : c.qualificatif === 'CLIENT' ? '🤝 Client' : '—'}</span>
                    </div>
                    <div className="text-muted-foreground">Matricule: {c.matricule || '—'}</div>
                  </div>

                  <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTriggerButton asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-gray-100" title="Actions">
                          <MoreVertical size={16} />
                        </Button>
                      </DropdownMenuTriggerButton>
                      <DropdownMenuContentWrapper align="end">
                        <DropdownMenuItem onClick={() => openEdit(c)}>
                          <Pencil size={16} className="mr-2 text-muted-foreground" /> Modifier
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => confirm('Supprimer ce client ?') && deleteMutation.mutate(c.id)} className="text-destructive">
                          <Trash2 size={16} className="mr-2" /> Supprimer
                        </DropdownMenuItem>
                      </DropdownMenuContentWrapper>
                    </DropdownMenu>
                  </div>
                </CardContent>
              </Card>
            ))}
            {filteredClients.length === 0 && (
              <Card>
                <CardContent className="p-6 text-center text-muted-foreground text-sm">
                  Aucun client trouvé
                </CardContent>
              </Card>
            )}
          </div>

          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-sage">
                  <th className="text-left p-3 uppercase tracking-wider text-leaf font-semibold">Client</th>
                  <th className="text-left p-3 uppercase tracking-wider text-leaf font-semibold">Contact</th>
                  <th className="text-left p-3 uppercase tracking-wider text-leaf font-semibold">Email</th>
                  <th className="text-left p-3 uppercase tracking-wider text-leaf font-semibold">Téléphone</th>
                  <th className="text-left p-3 uppercase tracking-wider text-leaf font-semibold">Qualificatif</th>
                  <th className="text-left p-3 uppercase tracking-wider text-leaf font-semibold">Matricule</th>
                  <th className="text-center p-3 uppercase tracking-wider text-leaf font-semibold">Affaires</th>
                  <th className="text-right p-3 uppercase tracking-wider text-leaf font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredClients.map((c) => (
                  <tr
                    key={c.id}
                    className="border-b hover:bg-sage/50 cursor-pointer"
                    onClick={() => navigate(`/clients/${c.id}`)}
                  >
                    <td className="p-3 font-medium">{c.name}</td>
                    <td className="p-3 text-muted-foreground">{c.contactName || '—'}</td>
                    <td className="p-3 text-muted-foreground">{c.email || '—'}</td>
                    <td className="p-3 text-muted-foreground">{c.phone || '—'}</td>
                    <td className="p-3 text-muted-foreground">
                      {c.qualificatif === 'PROSPECT' ? '🔍 Prospect' : c.qualificatif === 'CLIENT' ? '🤝 Client' : '—'}
                    </td>
                    <td className="p-3 text-muted-foreground">{c.matricule || '—'}</td>
                    <td className="p-3 text-center">
                      <span className="bg-sage text-leaf px-2 py-0.5 rounded-full text-xs font-medium">
                        {c._count?.affaires || 0}
                      </span>
                    </td>
                    <td className="p-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTriggerButton asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 hover:bg-gray-100"
                            title="Actions"
                          >
                            <MoreVertical size={16} />
                          </Button>
                        </DropdownMenuTriggerButton>
                        <DropdownMenuContentWrapper align="end">
                          <DropdownMenuItem onClick={() => openEdit(c)}>
                            <Pencil size={16} className="mr-2 text-muted-foreground" /> Modifier
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => confirm('Supprimer ce client ?') && deleteMutation.mutate(c.id)} className="text-destructive">
                            <Trash2 size={16} className="mr-2" /> Supprimer
                          </DropdownMenuItem>
                        </DropdownMenuContentWrapper>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
                {filteredClients.length === 0 && (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-muted-foreground">
                      Aucun client trouvé
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
        {pagination && pagination.totalPages > 1 && (
          <CardContent className="border-t pt-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {pagination.total} clients
              </p>
              <div className="flex items-center gap-1 flex-wrap justify-end">
                <Button
                  size="sm"
                  variant={page === 1 ? 'ghost' : 'default'}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-2 sm:px-3"
                >
                  ← Précédent
                </Button>
                {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((p) => (
                  <Button
                    key={p}
                    size="sm"
                    variant={p === page ? 'default' : 'outline'}
                    onClick={() => setPage(p)}
                    className={`w-7 h-7 sm:w-8 sm:h-8 p-0 ${p === page ? 'font-bold' : ''}`}
                  >
                    {p}
                  </Button>
                ))}
                <Button
                  size="sm"
                  variant={page === pagination.totalPages ? 'ghost' : 'default'}
                  onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                  disabled={page === pagination.totalPages}
                  className="px-2 sm:px-3"
                >
                  Suivant →
                </Button>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      <ClientFormDialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) setEditingClient(null);
        }}
        client={editingClient}
        onSuccess={handleClientSaved}
      />

      {/* Import Dialog */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Importer clients depuis Excel</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Fichier Excel (.xlsx, .xls)</Label>
              <Input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileUpload}
              />
            </div>
            {importFile && (
              <div className="text-sm text-muted-foreground">
                Fichier sélectionné: {importFile.name}
              </div>
            )}
            <div className="text-xs text-muted-foreground">
              Les colonnes Excel doivent être: name (ou Raison sociale), contactName (ou Contact), email, phone (ou Téléphone), address (ou Adresse), matricule (ou Matricule), qualificatif, notes
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setImportOpen(false); setImportFile(null); }}>Annuler</Button>
            <Button onClick={handleImport} disabled={!importFile || importMutation.isPending}>
              {importMutation.isPending ? 'Importation...' : 'Importer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
