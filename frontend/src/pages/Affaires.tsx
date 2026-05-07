import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, FileText, Receipt, Mail, Eye, Upload, MoreVertical, Search, Copy, SlidersHorizontal, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import { cn, fmtDT, MOIS } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input, Label, Textarea, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Badge, DropdownMenu, DropdownMenuTrigger, DropdownMenuTriggerButton, DropdownMenuContentWrapper, DropdownMenuItemStyled } from '@/components/ui/form-controls';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ClientFormDialog } from '@/components/clients/ClientFormDialog';
import { StatutBadge } from './Dashboard';
import type { Affaire, Client, Product, AffaireType, StatutAffaire, User } from '@/types';

type FormData = {
  id?: string;
  clientId: string;
  productId: string;
  type: AffaireType;
  montantHT: string;
  statut: StatutAffaire;
  probabilite: string;
  moisPrevu: string;
  anneePrevue: string;
  viaPartenaire: boolean;
  tauxCommission: string;
  assignedToId: string;
  notes: string;
  prochaineAction: string;
  dateProchaineAction: string;
};

const NO_ASSIGNEE_VALUE = '__none__';

const EMPTY: FormData = {
  clientId: '', productId: '', type: '', montantHT: '',
  statut: 'PROSPECT', probabilite: '50',
  moisPrevu: String(new Date().getMonth() + 1), anneePrevue: '2026',
  viaPartenaire: false, tauxCommission: '40', assignedToId: '', notes: '',
  prochaineAction: '', dateProchaineAction: '',
};

export function Affaires() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [filters, setFilters] = useState({ statut: '', type: '', annee: '2026', mois: String(new Date().getMonth() + 1), viaPartenaire: '', sortBy: 'score' });
  const [page, setPage] = useState(1);
  const [view, setView] = useState<'table' | 'kanban'>('table');
  const [open, setOpen] = useState(false);
  const [duplicateOpen, setDuplicateOpen] = useState(false);
  const [duplicateAffaireId, setDuplicateAffaireId] = useState<string>('');
  const [duplicateDate, setDuplicateDate] = useState({ mois: String(new Date().getMonth() + 1), annee: '2026' });
  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY);
  const [clientSearch, setClientSearch] = useState('');
  const [clientDialogOpen, setClientDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [draggedAffaireId, setDraggedAffaireId] = useState<string | null>(null);
  const [dropTargetStatus, setDropTargetStatus] = useState<StatutAffaire | null>(null);

  const { data: affairesData } = useQuery<{ data: Affaire[], pagination: any }>({
    queryKey: ['affaires', filters, page],
    queryFn: () => api.get('/affaires', { params: { ...filters, page } }).then((r) => r.data),
  });
  const affaires = affairesData?.data || [];
  const pagination = affairesData?.pagination;

  // Fetch all affaires (unfiltered) for KPI calculations
  const { data: allAffairesData } = useQuery<{ data: Affaire[], pagination: any }>({
    queryKey: ['affaires', 'all', filters],
    queryFn: () => api.get('/affaires', { params: { ...filters, limit: 9999 } }).then((r) => r.data),
  });
  const allAffaires = allAffairesData?.data || [];

  // Filter affaires by search term
  const filteredAffaires = searchTerm ? affaires.filter(a =>
    a.client?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.client?.contactName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.product?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.type?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.montantHT?.toString().includes(searchTerm) ||
    a.statut?.toLowerCase().includes(searchTerm) ||
    a.notes?.toLowerCase().includes(searchTerm.toLowerCase())
  ) : affaires;

  // Sort affaires based on sortBy filter
  const sortedAffaires = [...filteredAffaires].sort((a, b) => {
    if (filters.sortBy === 'score') {
      return (b.score || 0) - (a.score || 0);
    } else if (filters.sortBy === 'montant') {
      return Number(b.montantHT) - Number(a.montantHT);
    } else if (filters.sortBy === 'date') {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
    return 0;
  });
  const filteredAllAffaires = searchTerm ? allAffaires.filter(a =>
    a.client?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.client?.contactName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.product?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.type?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.montantHT?.toString().includes(searchTerm) ||
    a.statut?.toLowerCase().includes(searchTerm) ||
    a.notes?.toLowerCase().includes(searchTerm.toLowerCase())
  ) : allAffaires;

  const sortedAllAffaires = [...filteredAllAffaires].sort((a, b) => {
    if (filters.sortBy === 'score') {
      return (b.score || 0) - (a.score || 0);
    } else if (filters.sortBy === 'montant') {
      return Number(b.montantHT) - Number(a.montantHT);
    } else if (filters.sortBy === 'date') {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
    return 0;
  });
  const { data: clientsData } = useQuery<{ data: Client[], pagination: any }>({
    queryKey: ['clients', 'all'],
    queryFn: () => api.get('/clients', { params: { limit: 9999 } }).then((r) => r.data),
  });
  const clients = clientsData?.data || [];
  const filteredClients = clients.filter(c =>
    c.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
    (c.contactName && c.contactName.toLowerCase().includes(clientSearch.toLowerCase()))
  );
  const { data: productsData } = useQuery<{ data: Product[], pagination: any }>({
    queryKey: ['products', 'all'],
    queryFn: () => api.get('/products', { params: { limit: 9999 } }).then((r) => r.data),
  });
  const products = productsData?.data || [];

  const { data: usersData } = useQuery<{ data: User[], pagination: any }>({
    queryKey: ['users', 'all'],
    queryFn: () => api.get('/users', { params: { limit: 9999 } }).then((r) => r.data),
  });
  const users = usersData?.data || [];
  const { data: revenueCategories = [] } = useQuery<any[]>({
    queryKey: ['categories', 'REVENUE'],
    queryFn: () => api.get('/categories', { params: { type: 'REVENUE' } }).then((r) => r.data),
  });

  const saveMutation = useMutation({
    mutationFn: (data: FormData) => {
      const payload = {
        clientId: data.clientId,
        productId: data.productId || null,
        type: data.type,
        montantHT: Number(data.montantHT),
        statut: data.statut,
        probabilite: Number(data.probabilite),
        moisPrevu: Number(data.moisPrevu),
        anneePrevue: Number(data.anneePrevue),
        viaPartenaire: data.viaPartenaire,
        tauxCommission: Number(data.tauxCommission),
        assignedToId: data.assignedToId || null,
        notes: data.notes,
        prochaineAction: data.prochaineAction || null,
        dateProchaineAction: data.dateProchaineAction || null,
      };
      delete (payload as any).id;
      return data.id ? api.put(`/affaires/${data.id}`, payload) : api.post('/affaires', payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['affaires'] });
      qc.invalidateQueries({ queryKey: ['kpis'] });
      setOpen(false);
    },
    onError: (error: any) => {
      console.error('Save error:', error);
      const raw = error.response?.data?.error || error.message || 'Erreur inconnue';
      const friendlyMap: Record<string, string> = {
        clientId: 'Client',
        productId: 'Produit',
        type: 'Catégorie',
        montantHT: 'Montant HT',
        statut: 'Statut',
        moisPrevu: 'Mois prévu',
        anneePrevue: 'Année',
        probabilite: 'Probabilité',
      };
      let friendly = raw;
      const match = String(raw).match(/^Validation échouée:\s*(.+)$/);
      if (match) {
        const issues = match[1]
          .split(/,\s*/)
          .map((part) => {
            const [field] = part.split(':');
            const label = friendlyMap[field?.trim()] || field?.trim() || 'champ';
            return `• ${label} : champ requis ou invalide`;
          })
          .join('\n');
        friendly = `Merci de compléter les champs suivants :\n${issues}`;
      }
      alert(friendly);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/affaires/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['affaires'] });
      qc.invalidateQueries({ queryKey: ['kpis'] });
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: ({ id, mois, annee }: { id: string; mois: string; annee: string }) =>
      api.post(`/affaires/${id}/duplicate`, { moisPrevu: mois, anneePrevue: annee }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['affaires'] });
      qc.invalidateQueries({ queryKey: ['kpis'] });
      setDuplicateOpen(false);
      setDuplicateAffaireId('');
      alert('Affaire dupliquée avec succès !');
    },
  });

  const createDevisMutation = useMutation({
    mutationFn: (id: string) => api.post(`/softfacture/devis/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['affaires'] }),
  });

  const createFactureMutation = useMutation({
    mutationFn: (id: string) => api.post(`/softfacture/facture/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['affaires'] }),
  });

  const importMutation = useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      return api.post('/affaires/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['affaires'] });
      qc.invalidateQueries({ queryKey: ['clients'] });
      qc.invalidateQueries({ queryKey: ['products'] });
      setImportOpen(false);
      setImportFile(null);
      alert(`Import réussi ! ${data.data.created} affaires créées, ${data.data.updated} mises à jour.`);
    },
    onError: (error: any) => {
      console.error('Import error:', error);
      alert(`Erreur d'import : ${error.response?.data?.error || error.message || 'Erreur inconnue'}`);
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, statut }: { id: string; statut: StatutAffaire }) =>
      api.put(`/affaires/${id}`, { statut }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['affaires'] });
      qc.invalidateQueries({ queryKey: ['kpis'] });
    },
  });

  const handleEdit = (a: Affaire) => {
    setForm({
      id: a.id,
      clientId: a.clientId,
      productId: a.productId || '',
      type: a.type,
      montantHT: String(a.montantHT),
      statut: a.statut,
      probabilite: String(a.probabilite),
      moisPrevu: String(a.moisPrevu),
      anneePrevue: String(a.anneePrevue),
      viaPartenaire: a.viaPartenaire,
      tauxCommission: String(a.tauxCommission),
      assignedToId: a.assignedToId || '',
      notes: a.notes || '',
      prochaineAction: a.prochaineAction || '',
      dateProchaineAction: a.dateProchaineAction ? a.dateProchaineAction.split('T')[0] : '',
    });
    setClientSearch(a.client?.name || '');
    setOpen(true);
  };

  const handleDelete = (id: string, clientId: string) => {
    // Check if client has other opportunities
    const clientAffaires = affaires.filter(a => a.clientId === clientId);
    if (clientAffaires.length > 1) {
      const otherAffaires = clientAffaires.filter(a => a.id !== id);
      const confirmMsg = `Ce client a ${otherAffaires.length} autre(s) opportunité(s).\n\nÊtes-vous sûr de vouloir supprimer celle-ci ?`;
      if (!confirm(confirmMsg)) return;
    } else {
      if (!confirm('Supprimer cette affaire ?')) return;
    }
    deleteMutation.mutate(id);
  };

  const handleDuplicate = (id: string) => {
    setDuplicateAffaireId(id);
    setDuplicateOpen(true);
  };

  const handleDuplicateSubmit = () => {
    duplicateMutation.mutate({
      id: duplicateAffaireId,
      mois: duplicateDate.mois,
      annee: duplicateDate.annee,
    });
  };

  const handleDragStart = (id: string) => {
    setDraggedAffaireId(id);
  };

  const handleDragEnd = () => {
    setDraggedAffaireId(null);
    setDropTargetStatus(null);
  };

  const handleDropOnStatus = (targetStatus: StatutAffaire) => {
    if (!draggedAffaireId) return;
    const current = sortedAllAffaires.find((a) => a.id === draggedAffaireId);
    if (!current || current.statut === targetStatus) {
      handleDragEnd();
      return;
    }
    updateStatusMutation.mutate({ id: draggedAffaireId, statut: targetStatus });
    handleDragEnd();
  };

  const openNew = () => {
    setForm(EMPTY);
    setClientSearch('');
    setOpen(true);
  };

  const ht = Number(form.montantHT) || 0;
  const comm = form.viaPartenaire ? Math.round(ht * Number(form.tauxCommission) / 100) : 0;
  const net = ht - comm;

  // Calculate summary KPIs from all affaires matching current filters (not paginated)
  const totalCA = allAffaires.reduce((sum, a) => sum + Number(a.montantHT), 0);
  const pipelineCA = allAffaires.filter(a => ['QUALIFIE', 'PROPOSITION', 'NEGOCIATION'].includes(a.statut)).reduce((sum, a) => sum + Number(a.montantHT), 0);
  const realiseCA = allAffaires.filter(a => a.statut === 'GAGNE').reduce((sum, a) => sum + Number(a.montantHT), 0);
  const prospectionCA = allAffaires.filter(a => a.statut === 'PROSPECT').reduce((sum, a) => sum + Number(a.montantHT), 0);
  const winRate = allAffaires.filter(a => a.statut === 'GAGNE' || a.statut === 'PERDU').length > 0
    ? Math.round((allAffaires.filter(a => a.statut === 'GAGNE').length / allAffaires.filter(a => a.statut === 'GAGNE' || a.statut === 'PERDU').length) * 100)
    : 0;

  return (
    <div className="space-y-5 px-2 md:px-0">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl md:text-4xl font-bold tracking-tight">{t('affaires.title')}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t('affaires.subtitle')}</p>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <div className="grid grid-cols-2 gap-1 w-full sm:w-auto">
            <Button
              variant={view === 'table' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setView('table')}
              className="w-full"
            >
              {t('affaires.tableView')}
            </Button>
            <Button
              variant={view === 'kanban' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setView('kanban')}
              className="w-full"
            >
              {t('affaires.kanbanView')}
            </Button>
          </div>
          <Button onClick={() => setImportOpen(true)} variant="outline" size="sm" className="flex-1 sm:flex-none min-w-[140px]">
            <Upload size={16} className="mr-2" />{t('common.import')}
          </Button>
          <Button onClick={openNew} size="sm" className="flex-1 sm:flex-none min-w-[170px]">
            <Plus size={16} className="mr-2" />{t('affaires.addAffaire')}
          </Button>
        </div>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-2">
          <CardContent className="p-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">CA Total</p>
            <p className="text-lg md:text-2xl font-bold text-gray-900 mt-1">{fmtDT(totalCA)}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{allAffaires.length} affaires</p>
          </CardContent>
        </Card>
        <Card className="border-2 border-blue-200 bg-blue-50/30">
          <CardContent className="p-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">En cours</p>
            <p className="text-lg md:text-2xl font-bold text-blue-600 mt-1">{fmtDT(pipelineCA)}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{allAffaires.filter(a => ['QUALIFIE', 'PROPOSITION', 'NEGOCIATION'].includes(a.statut)).length} en cours</p>
          </CardContent>
        </Card>
        <Card className="border-2 border-emerald-200 bg-emerald-50/30">
          <CardContent className="p-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Gagné</p>
            <p className="text-lg md:text-2xl font-bold text-emerald-600 mt-1">{fmtDT(realiseCA)}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{allAffaires.filter(a => a.statut === 'GAGNE').length} gagnées</p>
          </CardContent>
        </Card>
        <Card className="border-2 border-violet-200 bg-violet-50/30">
          <CardContent className="p-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Taux conversion</p>
            <p className="text-lg md:text-2xl font-bold text-violet-600 mt-1">{winRate}%</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{allAffaires.filter(a => a.statut === 'PERDU').length} perdues</p>
          </CardContent>
        </Card>
      </div>

      {/* Toolbar de filtres */}
      {(() => {
        const advancedActiveCount =
          (filters.type ? 1 : 0) +
          (filters.viaPartenaire ? 1 : 0) +
          (filters.mois ? 1 : 0) +
          (filters.sortBy && filters.sortBy !== 'score' ? 1 : 0);
        const resetAdvanced = () =>
          setFilters({ ...filters, type: '', viaPartenaire: '', mois: '', sortBy: 'score' });

        return (
          <Card>
            <CardContent className="pt-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <div className="relative flex-1 min-w-[180px]">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    placeholder="Rechercher..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 h-8 w-full text-xs"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Select
                    value={filters.statut || 'all'}
                    onValueChange={(v) => setFilters({ ...filters, statut: v === 'all' ? '' : v })}
                  >
                    <SelectTrigger className="h-8 w-[150px] text-xs">
                      <SelectValue placeholder="Tous statuts" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous statuts</SelectItem>
                      <SelectItem value="PROSPECT">🟡 Prospect</SelectItem>
                      <SelectItem value="QUALIFIE">🔵 Qualifié</SelectItem>
                      <SelectItem value="PROPOSITION">🟠 Proposition</SelectItem>
                      <SelectItem value="NEGOCIATION">🟣 Négociation</SelectItem>
                      <SelectItem value="GAGNE">✅ Gagné</SelectItem>
                      <SelectItem value="PERDU">❌ Perdu</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={filters.annee} onValueChange={(v) => setFilters({ ...filters, annee: v })}>
                    <SelectTrigger className="h-8 w-[100px] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="2026">2026</SelectItem>
                      <SelectItem value="2027">2027</SelectItem>
                      <SelectItem value="2028">2028</SelectItem>
                    </SelectContent>
                  </Select>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
                        <SlidersHorizontal size={14} />
                        Filtres
                        {advancedActiveCount > 0 && (
                          <span className="ml-1 inline-flex items-center justify-center rounded-full bg-leaf text-white text-[10px] h-4 min-w-[16px] px-1">
                            {advancedActiveCount}
                          </span>
                        )}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContentWrapper align="end" className="w-72 p-3 space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          Filtres avancés
                        </p>
                        {advancedActiveCount > 0 && (
                          <button
                            type="button"
                            onClick={resetAdvanced}
                            className="text-xs text-leaf hover:underline inline-flex items-center gap-1"
                          >
                            <X size={12} />
                            Réinitialiser
                          </button>
                        )}
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs">Catégorie</Label>
                        <Select
                          value={filters.type || 'all'}
                          onValueChange={(v) => setFilters({ ...filters, type: v === 'all' ? '' : v })}
                        >
                          <SelectTrigger className="h-8 w-full text-xs">
                            <SelectValue placeholder="Toutes catégories" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Toutes catégories</SelectItem>
                            {revenueCategories.map((cat: any) => (
                              <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs">Mois</Label>
                        <Select
                          value={filters.mois || 'all'}
                          onValueChange={(v) => setFilters({ ...filters, mois: v === 'all' ? '' : v })}
                        >
                          <SelectTrigger className="h-8 w-full text-xs">
                            <SelectValue placeholder="Tous mois" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Tous mois</SelectItem>
                            {MOIS.map((label, idx) => (
                              <SelectItem key={idx} value={String(idx + 1)}>{label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs">Apport</Label>
                        <Select
                          value={filters.viaPartenaire || 'all'}
                          onValueChange={(v) =>
                            setFilters({ ...filters, viaPartenaire: v === 'all' ? '' : v })
                          }
                        >
                          <SelectTrigger className="h-8 w-full text-xs">
                            <SelectValue placeholder="Tous apports" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Tous apports</SelectItem>
                            <SelectItem value="true">🤝 Partenaire</SelectItem>
                            <SelectItem value="false">👤 Direct</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs">Trier par</Label>
                        <Select
                          value={filters.sortBy || 'score'}
                          onValueChange={(v) => setFilters({ ...filters, sortBy: v })}
                        >
                          <SelectTrigger className="h-8 w-full text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="score">📊 Score ↓</SelectItem>
                            <SelectItem value="montant">💰 Montant ↓</SelectItem>
                            <SelectItem value="date">📅 Date ↓</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </DropdownMenuContentWrapper>
                  </DropdownMenu>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {/* Table View */}
      {view === 'table' && (
        <Card>
          <CardHeader className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
            <CardTitle className="text-base">{sortedAffaires.length} affaires</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="md:hidden space-y-3 p-3">
              {sortedAffaires.map((a) => {
                const ht = Number(a.montantHT);
                const c = a.viaPartenaire ? Math.round(ht * Number(a.tauxCommission) / 100) : 0;
                return (
                  <Card
                    key={a.id}
                    className={`border ${a.viaPartenaire ? 'bg-purple-light/20' : ''}`}
                  >
                    <CardContent className="p-3 space-y-2">
                      <div
                        className="flex items-start justify-between gap-2 cursor-pointer"
                        onClick={() => navigate(`/affaires/${a.id}`)}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold truncate">{a.client?.name || 'N/A'}</p>
                            {affaires.filter(aff => aff.clientId === a.clientId).length > 1 && (
                              <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-medium">
                                {affaires.filter(aff => aff.clientId === a.clientId).length}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground truncate">{a.title}</p>
                        </div>
                        <StatutBadge statut={a.statut} />
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <p className="text-muted-foreground">HT</p>
                          <p className="font-mono font-semibold">{fmtDT(ht)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">TTC</p>
                          <p className="font-mono font-semibold">{fmtDT(Math.round(ht * 1.19))}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Probabilité</p>
                          <p className="font-semibold">{a.probabilite}%</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Mon net</p>
                          <p className="font-mono font-semibold text-leaf">{fmtDT(ht - c)}</p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">{a.type || 'N/A'} • {MOIS[a.moisPrevu]}</span>
                        <div className="flex gap-1">
                          {a.devisNumero && <Badge variant="outline">D {a.devisNumero}</Badge>}
                          {a.factureNumero && <Badge className="bg-leaf text-white">F {a.factureNumero}</Badge>}
                        </div>
                      </div>

                      <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTriggerButton asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-gray-100" title="Actions">
                              <MoreVertical size={16} />
                            </Button>
                          </DropdownMenuTriggerButton>
                          <DropdownMenuContentWrapper align="end" className="w-48">
                            <DropdownMenuItemStyled onClick={() => navigate(`/affaires/${a.id}`)}>
                              <Eye size={16} className="mr-2 text-muted-foreground" /> Voir détails
                            </DropdownMenuItemStyled>
                            {!a.devisId && (
                              <DropdownMenuItemStyled onClick={() => createDevisMutation.mutate(a.id)}>
                                <FileText size={16} className="mr-2 text-muted-foreground" /> Créer devis
                              </DropdownMenuItemStyled>
                            )}
                            {!a.factureId && (
                              <DropdownMenuItemStyled onClick={() => createFactureMutation.mutate(a.id)}>
                                <Receipt size={16} className="mr-2 text-muted-foreground" /> Créer facture
                              </DropdownMenuItemStyled>
                            )}
                            {(a.devisPdfUrl || a.facturePdfUrl) && (
                              <DropdownMenuItemStyled onClick={() => {
                                const url = a.devisPdfUrl || a.facturePdfUrl;
                                if (url) window.open(url, '_blank');
                              }}>
                                <Mail size={16} className="mr-2 text-muted-foreground" /> Voir PDF
                              </DropdownMenuItemStyled>
                            )}
                            <DropdownMenuItemStyled onClick={() => handleEdit(a)}>
                              <Pencil size={16} className="mr-2 text-muted-foreground" /> Modifier
                            </DropdownMenuItemStyled>
                            <DropdownMenuItemStyled onClick={() => handleDuplicate(a.id)}>
                              <Copy size={16} className="mr-2 text-muted-foreground" /> Dupliquer
                            </DropdownMenuItemStyled>
                            <DropdownMenuItemStyled onClick={() => handleDelete(a.id, a.clientId)} className="text-destructive">
                              <Trash2 size={16} className="mr-2" /> Supprimer
                            </DropdownMenuItemStyled>
                          </DropdownMenuContentWrapper>
                        </DropdownMenu>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-xs min-w-[800px]">
                <thead>
                  <tr className="border-b bg-sage">
                    <th className="text-left p-2 md:p-2.5 uppercase tracking-wider text-leaf font-semibold">Client / Titre</th>
                    <th className="text-right p-2 md:p-2.5 uppercase tracking-wider text-leaf font-semibold">Probabilité</th>
                    <th className="text-right p-2 md:p-2.5 uppercase tracking-wider text-leaf font-semibold">HT (DT)</th>
                    <th className="text-right p-2 md:p-2.5 uppercase tracking-wider text-leaf font-semibold">TTC</th>
                    <th className="text-left p-2 md:p-2.5 uppercase tracking-wider text-leaf font-semibold">Statut</th>
                    <th className="text-left p-2 md:p-2.5 uppercase tracking-wider text-leaf font-semibold">Catégorie</th>
                    <th className="text-left p-2 md:p-2.5 uppercase tracking-wider text-leaf font-semibold">Prochaine action</th>
                    <th className="text-right p-2 md:p-2.5 uppercase tracking-wider text-leaf font-semibold">Mon net</th>
                    <th className="text-right p-2 md:p-2.5 uppercase tracking-wider text-leaf font-semibold">Mois</th>
                    <th className="text-right p-2 md:p-2.5 uppercase tracking-wider text-leaf font-semibold">Devis/Fac</th>
                    <th className="text-right p-2 md:p-2.5 uppercase tracking-wider text-leaf font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedAffaires.map((a) => {
                    const ht = Number(a.montantHT);
                    const c = a.viaPartenaire ? Math.round(ht * Number(a.tauxCommission) / 100) : 0;
                    return (
                      <tr key={a.id} className={`border-b hover:bg-sage/50 cursor-pointer ${a.viaPartenaire ? 'bg-purple-light/20' : ''}`} onClick={() => navigate(`/affaires/${a.id}`)}>
                        <td className="p-2.5">
                          <div className="flex items-center gap-2">
                            <div className="font-semibold">{a.client?.name || 'N/A'}</div>
                            {affaires.filter(aff => aff.clientId === a.clientId).length > 1 && (
                              <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-medium">
                                {affaires.filter(aff => aff.clientId === a.clientId).length}
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-muted-foreground">{a.title}</div>
                        </td>
                        <td className="p-2.5 text-right font-semibold">{a.probabilite}%</td>
                        <td className="p-2.5 text-right font-mono">{fmtDT(ht)}</td>
                        <td className="p-2.5 text-right font-mono font-semibold">{fmtDT(Math.round(ht * 1.19))}</td>
                        <td className="p-2.5"><StatutBadge statut={a.statut} /></td>
                        <td className="p-2.5 text-xs font-medium">{a.type || 'N/A'}</td>
                        <td className="p-2.5">
                          {a.prochaineAction && (
                            <div className="text-xs">
                              <div className="font-medium">{a.prochaineAction}</div>
                              {a.dateProchaineAction && (
                                <div className="text-muted-foreground">{new Date(a.dateProchaineAction).toLocaleDateString('fr-FR')}</div>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="p-2.5 text-right font-mono font-semibold text-leaf">{fmtDT(ht - c)}</td>
                        <td className="p-2.5 text-muted-foreground">{MOIS[a.moisPrevu]}</td>
                        <td className="p-2.5">
                          <div className="flex gap-1 text-[10px]">
                            {a.devisNumero && <Badge variant="outline">D {a.devisNumero}</Badge>}
                            {a.factureNumero && <Badge className="bg-leaf text-white">F {a.factureNumero}</Badge>}
                          </div>
                        </td>
                        <td className="p-2.5 text-right" onClick={(e) => e.stopPropagation()}>
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
                            <DropdownMenuContentWrapper align="end" className="w-48">
                              <DropdownMenuItemStyled onClick={() => navigate(`/affaires/${a.id}`)}>
                                <Eye size={16} className="mr-2 text-muted-foreground" /> Voir détails
                              </DropdownMenuItemStyled>
                              {!a.devisId && (
                                <DropdownMenuItemStyled onClick={() => createDevisMutation.mutate(a.id)}>
                                  <FileText size={16} className="mr-2 text-muted-foreground" /> Créer devis
                                </DropdownMenuItemStyled>
                              )}
                              {!a.factureId && (
                                <DropdownMenuItemStyled onClick={() => createFactureMutation.mutate(a.id)}>
                                  <Receipt size={16} className="mr-2 text-muted-foreground" /> Créer facture
                                </DropdownMenuItemStyled>
                              )}
                              {(a.devisPdfUrl || a.facturePdfUrl) && (
                                <DropdownMenuItemStyled onClick={() => {
                                  const url = a.devisPdfUrl || a.facturePdfUrl;
                                  if (url) window.open(url, '_blank');
                                }}>
                                  <Mail size={16} className="mr-2 text-muted-foreground" /> Voir PDF
                                </DropdownMenuItemStyled>
                              )}
                              <DropdownMenuItemStyled onClick={() => handleEdit(a)}>
                                <Pencil size={16} className="mr-2 text-muted-foreground" /> Modifier
                              </DropdownMenuItemStyled>
                              <DropdownMenuItemStyled onClick={() => handleDuplicate(a.id)}>
                                <Copy size={16} className="mr-2 text-muted-foreground" /> Dupliquer
                              </DropdownMenuItemStyled>
                              <DropdownMenuItemStyled onClick={() => handleDelete(a.id, a.clientId)} className="text-destructive">
                                <Trash2 size={16} className="mr-2" /> Supprimer
                              </DropdownMenuItemStyled>
                            </DropdownMenuContentWrapper>
                          </DropdownMenu>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
          {pagination && pagination.totalPages > 1 && (
            <CardContent className="border-t pt-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {fmtDT(allAffaires.reduce((sum, a) => sum + Number(a.montantHT), 0))} HT total ({allAffaires.length} affaires)
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
      )}

      {/* Kanban View */}
      {view === 'kanban' && (
        <div className="overflow-x-auto pb-2">
          <div className="grid grid-cols-6 gap-4 min-w-[1320px]">
          {(['PROSPECT', 'QUALIFIE', 'PROPOSITION', 'NEGOCIATION', 'GAGNE', 'PERDU'] as const).map((statut) => {
            const statutAffaires = sortedAllAffaires.filter(a => a.statut === statut);
            const statutCA = statutAffaires.reduce((sum, a) => sum + Number(a.montantHT), 0);
            const statutLabels = {
              PROSPECT: { label: t('affaires.status.prospect'), color: 'bg-yellow-50 border-yellow-200' },
              QUALIFIE: { label: t('affaires.status.qualified'), color: 'bg-blue-50 border-blue-200' },
              PROPOSITION: { label: t('affaires.status.proposal'), color: 'bg-orange-50 border-orange-200' },
              NEGOCIATION: { label: t('affaires.status.negotiation'), color: 'bg-purple-50 border-purple-200' },
              GAGNE: { label: t('affaires.status.won'), color: 'bg-green-50 border-green-200' },
              PERDU: { label: t('affaires.status.lost'), color: 'bg-red-50 border-red-200' },
            };
            const statutInfo = statutLabels[statut];
            return (
              <Card key={statut} className={`flex flex-col ${statutInfo.color}`}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold">{statutInfo.label}</CardTitle>
                  <p className="text-xs text-muted-foreground">{statutAffaires.length} affaires • {fmtDT(statutCA)}</p>
                </CardHeader>
                <CardContent
                  className={cn(
                    'flex-1 space-y-2 overflow-y-auto max-h-[68vh] rounded-b-lg transition-colors',
                    dropTargetStatus === statut ? 'bg-primary/5 ring-1 ring-primary/20' : ''
                  )}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDropTargetStatus(statut);
                  }}
                  onDragLeave={() => {
                    if (dropTargetStatus === statut) setDropTargetStatus(null);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    handleDropOnStatus(statut);
                  }}
                >
                  {statutAffaires.map((a) => {
                    const ht = Number(a.montantHT);
                    return (
                      <Card
                        key={a.id}
                        draggable
                        onDragStart={() => handleDragStart(a.id)}
                        onDragEnd={handleDragEnd}
                        className={cn(
                          'p-3 hover:shadow-md transition-shadow cursor-pointer',
                          draggedAffaireId === a.id ? 'opacity-60' : ''
                        )}
                        onClick={() => navigate(`/affaires/${a.id}`)}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div className="font-semibold text-sm">{a.client?.name || 'N/A'}</div>
                          <div className="text-sm font-bold">{fmtDT(ht)}</div>
                        </div>
                        <div className="text-xs text-muted-foreground mb-2">{a.title}</div>
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">{MOIS[a.moisPrevu]}</span>
                          <span>{a.probabilite}%</span>
                        </div>
                      </Card>
                    );
                  })}
                  {statutAffaires.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-4">Aucune affaire</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
          </div>
        </div>
      )}

      {/* Modal create/edit */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{form.id ? 'Modifier' : 'Nouvelle'} opportunité</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Client *</Label>
              <Input
                placeholder="Rechercher un client..."
                value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)}
                className="mb-2"
              />
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <Select value={form.clientId} onValueChange={(v) => setForm({ ...form, clientId: v })}>
                    <SelectTrigger><SelectValue placeholder="Choisir un client" /></SelectTrigger>
                    <SelectContent>
                      {filteredClients.length > 0 ? (
                        filteredClients.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name} {c.contactName ? `(${c.contactName})` : ''}
                          </SelectItem>
                        ))
                      ) : (
                        <div className="p-2 text-sm text-muted-foreground">Aucun client trouvé</div>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="shrink-0"
                  title="Créer un nouveau client"
                  onClick={() => setClientDialogOpen(true)}
                >
                  <Plus size={16} />
                </Button>
              </div>
              {filteredClients.length === 0 && clientSearch.trim().length > 0 && (
                <button
                  type="button"
                  onClick={() => setClientDialogOpen(true)}
                  className="mt-1 text-xs text-leaf hover:underline inline-flex items-center gap-1"
                >
                  <Plus size={12} />
                  Créer le client « {clientSearch.trim()} »
                </button>
              )}
              {form.clientId && affaires.filter(a => a.clientId === form.clientId && a.id !== form.id).length > 0 && (
                <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded">
                  <p className="text-xs font-semibold text-blue-700">
                    {affaires.filter(a => a.clientId === form.clientId && a.id !== form.id).length} autre(s) opportunité(s) pour ce client
                  </p>
                  <div className="mt-1 text-xs text-blue-600">
                    {affaires.filter(a => a.clientId === form.clientId && a.id !== form.id).map(a => (
                      <div key={a.id} className="truncate">
                        • {a.title} ({Number(a.montantHT).toLocaleString('fr-TN')} DT) - {a.statut}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Produit *</Label>
              <Select
                value={form.productId}
                onValueChange={(v) => {
                  const picked = products.find((p) => p.id === v) as any;
                  const autoCategory = picked?.category?.name || form.type;
                  setForm({ ...form, productId: v, type: autoCategory as AffaireType });
                }}
              >
                <SelectTrigger><SelectValue placeholder="Choisir un produit" /></SelectTrigger>
                <SelectContent>
                  {products.filter(p => p.active).map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Catégorie *</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as AffaireType })}>
                <SelectTrigger><SelectValue placeholder="Choisir une catégorie" /></SelectTrigger>
                <SelectContent>
                  {revenueCategories.map((cat: any) => (
                    <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.productId && (
                <p className="text-xs text-muted-foreground">
                  Catégorie reprise automatiquement du produit sélectionné — modifiable si besoin.
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Montant HT (DT) *</Label>
              <Input
                type="number"
                value={form.montantHT}
                onChange={(e) => setForm({ ...form, montantHT: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Statut *</Label>
              <Select value={form.statut} onValueChange={(v) => setForm({ ...form, statut: v as StatutAffaire })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PROSPECT">🟡 Prospect</SelectItem>
                  <SelectItem value="QUALIFIE">🔵 Qualifié</SelectItem>
                  <SelectItem value="PROPOSITION">� Proposition</SelectItem>
                  <SelectItem value="NEGOCIATION">🟣 Négociation</SelectItem>
                  <SelectItem value="GAGNE">✅ Gagné</SelectItem>
                  <SelectItem value="PERDU">❌ Perdu</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Probabilité (%)</Label>
              <Input type="number" min="0" max="100" value={form.probabilite} onChange={(e) => setForm({ ...form, probabilite: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Mois prévu</Label>
              <Select value={form.moisPrevu} onValueChange={(v) => setForm({ ...form, moisPrevu: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MOIS.slice(1).map((m, i) => <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Année</Label>
              <Select value={form.anneePrevue} onValueChange={(v) => setForm({ ...form, anneePrevue: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="2026">2026</SelectItem>
                  <SelectItem value="2027">2027</SelectItem>
                  <SelectItem value="2028">2028</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Partenaire toggle */}
          <label className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${form.viaPartenaire ? 'border-purple bg-purple-light' : 'border-border'}`}>
            <input
              type="checkbox"
              checked={form.viaPartenaire}
              onChange={(e) => setForm({ ...form, viaPartenaire: e.target.checked })}
              className="w-4 h-4 accent-purple"
            />
            <span className="text-sm font-medium">🤝 Commission tiers</span>
          </label>

          {form.viaPartenaire && (
            <div className="space-y-1.5">
              <Label>Taux commission (%)</Label>
              <Input
                type="number"
                min="0"
                max="100"
                value={form.tauxCommission}
                onChange={(e) => setForm({ ...form, tauxCommission: e.target.value })}
                placeholder="40"
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Commercial assigné</Label>
            <Select
              value={form.assignedToId || NO_ASSIGNEE_VALUE}
              onValueChange={(v) => setForm({ ...form, assignedToId: v === NO_ASSIGNEE_VALUE ? '' : v })}
            >
              <SelectTrigger><SelectValue placeholder="Aucun" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_ASSIGNEE_VALUE}>Aucun</SelectItem>
                {users.map((user) => (
                  <SelectItem key={user.id} value={user.id}>{user.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {form.viaPartenaire && ht > 0 && (
            <div className="bg-purple-light border border-purple/30 rounded-lg p-3 space-y-1 text-sm">
              <div className="text-[10px] uppercase text-purple font-bold">Détail commission</div>
              <div className="flex justify-between"><span>Montant HT</span><span className="font-mono">{fmtDT(ht)}</span></div>
              <div className="flex justify-between text-purple"><span>Commission ({form.tauxCommission}%)</span><span className="font-mono font-semibold">{fmtDT(comm)}</span></div>
              <div className="flex justify-between font-bold border-t border-purple/30 pt-1 mt-1"><span>Mon net HT</span><span className="font-mono">{fmtDT(net)}</span></div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Contacts, prochaine étape..."
            />
          </div>

          <div className="space-y-1.5">
            <Label>Prochaine action</Label>
            <Input
              value={form.prochaineAction}
              onChange={(e) => setForm({ ...form, prochaineAction: e.target.value })}
              placeholder="Ex: Appeler client, Envoyer devis..."
            />
          </div>

          <div className="space-y-1.5">
            <Label>Date de la prochaine action</Label>
            <Input
              type="date"
              value={form.dateProchaineAction}
              onChange={(e) => setForm({ ...form, dateProchaineAction: e.target.value })}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button
              onClick={() => saveMutation.mutate(form)}
              disabled={saveMutation.isPending || !form.clientId || !form.productId || !form.type || !form.montantHT}
            >
              💾 Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Inline client creation - keeps the user inside the opportunity dialog */}
      <ClientFormDialog
        open={clientDialogOpen}
        onOpenChange={setClientDialogOpen}
        initialName={clientSearch}
        onSuccess={(created) => {
          setForm((prev) => ({ ...prev, clientId: created.id }));
          setClientSearch(created.name);
        }}
      />

      {/* Import Dialog */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Importer des affaires depuis Excel</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="importFile">Fichier Excel (.xlsx, .xls)</Label>
              <Input
                id="importFile"
                type="file"
                accept=".xlsx,.xls"
                onChange={(e) => setImportFile(e.target.files?.[0] || null)}
              />
            </div>
            <div className="text-sm text-muted-foreground bg-muted p-3 rounded-lg">
              <p className="font-semibold mb-2">Colonnes acceptées (toutes optionnelles) :</p>
              <ul className="list-disc pl-4 space-y-1">
                <li>clientName / Nom du client / Client</li>
                <li>clientEmail / Email client / Email</li>
                <li>clientPhone / Téléphone client / Téléphone</li>
                <li>productName / Produit / Product</li>
                <li>title / Titre / Affaire</li>
                <li>type / Type</li>
                <li>montantHT / Montant HT / Montant / Prix</li>
                <li>statut / Statut</li>
                <li>probabilite / Probabilité</li>
                <li>moisPrevu / Mois prévu / Mois</li>
                <li>anneePrevue / Année prévue / Année</li>
              </ul>
              <p className="mt-2 text-xs">Des valeurs par défaut seront utilisées si les colonnes sont manquantes.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportOpen(false)}>Annuler</Button>
            <Button onClick={() => importFile && importMutation.mutate(importFile)} disabled={importMutation.isPending || !importFile}>
              {importMutation.isPending ? 'Import...' : 'Importer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Duplicate Dialog */}
      <Dialog open={duplicateOpen} onOpenChange={setDuplicateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Dupliquer l'opportunité</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Mois prévu</Label>
              <Select value={duplicateDate.mois} onValueChange={(v) => setDuplicateDate({ ...duplicateDate, mois: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MOIS.map((label, idx) => (
                    <SelectItem key={idx} value={String(idx + 1)}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Année prévue</Label>
              <Select value={duplicateDate.annee} onValueChange={(v) => setDuplicateDate({ ...duplicateDate, annee: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="2026">2026</SelectItem>
                  <SelectItem value="2027">2027</SelectItem>
                  <SelectItem value="2028">2028</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDuplicateOpen(false)}>Annuler</Button>
            <Button onClick={handleDuplicateSubmit} disabled={duplicateMutation.isPending}>
              {duplicateMutation.isPending ? 'Duplication...' : 'Dupliquer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
