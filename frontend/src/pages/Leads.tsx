import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Plus, Phone, Mail, Building2, Trash2, Pencil, TrendingUp, UserCheck } from 'lucide-react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input, Label, Textarea, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/form-controls';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';

type FormData = {
  id?: string;
  name: string;
  contactName: string;
  email: string;
  phone: string;
  company: string;
  source: string;
  status: string;
  score: string;
  estimatedValue: string;
  notes: string;
  clientId?: string;
};

const EMPTY: FormData = {
  name: '',
  contactName: '',
  email: '',
  phone: '',
  company: '',
  source: 'AUTRE',
  status: 'NEW',
  score: '0',
  estimatedValue: '',
  notes: '',
};

const SOURCE_LABELS: Record<string, string> = {
  WEBSITE: 'Site web',
  REFERRAL: 'Recommandation',
  LINKEDIN: 'LinkedIn',
  EMAIL: 'Email',
  PHONE: 'Téléphone',
  EVENT: 'Événement',
  PARTNER: 'Partenaire',
  AUTRE: 'Autre',
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  NEW: { label: 'Nouveau', color: 'bg-blue-100 text-blue-700' },
  CONTACTED: { label: 'Contacté', color: 'bg-yellow-100 text-yellow-700' },
  QUALIFIED: { label: 'Qualifié', color: 'bg-green-100 text-green-700' },
  CONVERTED: { label: 'Converti', color: 'bg-purple-100 text-purple-700' },
  LOST: { label: 'Perdu', color: 'bg-red-100 text-red-700' },
};

export function Leads() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormData>(EMPTY);
  /** pipeline = liste sans convertis/perdus (défaut) ; all = tous les statuts */
  const [filterStatus, setFilterStatus] = useState<string>('pipeline');
  const [filterSource, setFilterSource] = useState<string>('all');
  const [filterMonth, setFilterMonth] = useState<string>('all');
  const [filterYear, setFilterYear] = useState<string>('2026');
  const [page, setPage] = useState(1);

  const { data: leadsData } = useQuery<{ data: any[]; pagination: any; rollup?: { estimatedValueSumHT: number } }>({
    queryKey: ['leads', filterStatus, filterSource, page],
    queryFn: () => {
      const params: Record<string, string | number> = { page };
      if (filterSource !== 'all') params.source = filterSource;
      if (filterStatus === 'all') params.listScope = 'all';
      else if (filterStatus !== 'pipeline') params.status = filterStatus;
      return api.get('/leads', { params }).then((r) => r.data);
    },
  });
  const leads = leadsData?.data || [];
  const pagination = leadsData?.pagination;

  useEffect(() => {
    setPage(1);
  }, [filterStatus, filterSource]);

  const { data: clientsData } = useQuery<{ data: any[], pagination: any }>({
    queryKey: ['clients'],
    queryFn: () => api.get('/clients').then((r) => r.data),
  });
  const clients = clientsData?.data || [];

  const { data: kpisData } = useQuery<any>({
    queryKey: ['kpis', filterYear],
    queryFn: () => api.get('/kpis', { params: { annee: filterYear } }).then((r) => r.data),
  });

  const { data: expensesData } = useQuery<{ data: any[] }>({
    queryKey: ['expenses', filterYear],
    queryFn: () => api.get('/expenses', { params: { year: filterYear, limit: 9999 } }).then((r) => r.data),
  });

  const saveMutation = useMutation({
    mutationFn: (data: FormData) => {
      const payload = { ...data };
      delete (payload as any).id;
      return data.id ? api.put(`/leads/${data.id}`, payload) : api.post('/leads', payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leads'] });
      setOpen(false);
      setForm(EMPTY);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/leads/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leads'] }),
  });

  const convertMutation = useMutation({
    mutationFn: (id: string) => api.post(`/leads/${id}/convert`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leads'] });
      qc.invalidateQueries({ queryKey: ['clients'] });
      qc.invalidateQueries({ queryKey: ['affaires'] });
    },
  });

  const openEdit = (lead: any) => {
    setForm({
      id: lead.id,
      name: lead.name,
      contactName: lead.contactName || '',
      email: lead.email || '',
      phone: lead.phone || '',
      company: lead.company || '',
      source: lead.source,
      status: lead.status,
      score: String(lead.score),
      estimatedValue: lead.estimatedValue ? String(lead.estimatedValue) : '',
      notes: lead.notes || '',
      clientId: lead.clientId || '',
    });
    setOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate(form);
  };

  const handleConvert = (id: string) => {
    if (confirm(t('leads.confirmConvert'))) {
      convertMutation.mutate(id);
    }
  };

  return (
    <div className="space-y-6 px-2 md:px-0">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl md:text-4xl font-bold tracking-tight">{t('leads.title')}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t('leads.subtitle')}</p>
        </div>
        <Button onClick={() => { setForm(EMPTY); setOpen(true); }}>
          <Plus size={16} className="mr-2" /> {t('leads.newLead')}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select value={filterStatus || 'pipeline'} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-48 min-w-[12rem]">
            <SelectValue placeholder={t('leads.pipelineStatuses')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pipeline">{t('leads.pipelineStatuses')}</SelectItem>
            <SelectItem value="all">{t('leads.allStatuses')}</SelectItem>
            {Object.entries(STATUS_LABELS).map(([key, { label }]) => (
              <SelectItem key={key} value={key}>{t(`leads.status.${key.toLowerCase()}`, { defaultValue: label })}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterSource || 'all'} onValueChange={setFilterSource}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder={t('leads.allSources')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('leads.allSources')}</SelectItem>
            {Object.entries(SOURCE_LABELS).map(([key, label]) => (
              <SelectItem key={key} value={key}>{t(`leads.sources.${key.toLowerCase()}`, { defaultValue: label })}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterMonth || 'all'} onValueChange={setFilterMonth}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder={t('expenses.allMonths')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('expenses.allMonths')}</SelectItem>
            {['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'].map((label, idx) => (
              <SelectItem key={idx} value={String(idx + 1)}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterYear} onValueChange={setFilterYear}>
          <SelectTrigger className="w-24">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="2026">2026</SelectItem>
            <SelectItem value="2027">2027</SelectItem>
            <SelectItem value="2028">2028</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary — CA : caTotalAll (API) exclut déjà uniquement les affaires PERDU */}
      {(kpisData != null || (leadsData?.rollup?.estimatedValueSumHT ?? 0) > 0 || leads.length > 0 || (pagination?.total ?? 0) > 0) && (() => {
        const totalLeadsValueHT = Number(leadsData?.rollup?.estimatedValueSumHT ?? 0);
        const totalLeadsValue = Math.round(totalLeadsValueHT * 1.19);
        const totalCA = kpisData ? Math.round(Number(kpisData.caTotalAll) * 1.19) : 0;
        const totalExpenses = (expensesData?.data || []).reduce((sum: number, e: any) => sum + (Number(e.amount) || 0), 0);
        const totalPotentiel = totalCA + totalLeadsValue;
        const tauxCouverture = totalExpenses > 0 ? Math.round((totalPotentiel / totalExpenses) * 100) : 0;
        const listTotal = pagination?.total ?? leads.length;
        const avgScore =
          leads.length > 0
            ? Math.round(leads.reduce((sum: number, l: any) => sum + (Number(l.score) || 0), 0) / leads.length)
            : null;

        return (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="py-3 px-4">
              <p className="text-xs text-muted-foreground">{t('leads.kpiTotal')}</p>
                <p className="text-xl font-bold mt-1">{listTotal}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-3 px-4">
                <p className="text-xs text-muted-foreground">{t('leads.kpiValueTTC')}</p>
                <p className="text-xl font-bold text-primary mt-1">
                  {totalLeadsValue.toLocaleString('fr-FR')} DT
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-3 px-4">
                <p className="text-xs text-muted-foreground">{t('leads.kpiAvgScore')}</p>
                <p className="text-xl font-bold mt-1">
                  {avgScore !== null ? avgScore : '—'}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-3 px-4">
                <p className="text-xs text-muted-foreground">{t('leads.kpiCoverage')}</p>
                <p className={`text-xl font-bold mt-1 ${tauxCouverture >= 100 ? 'text-primary' : 'text-orange-500'}`}>
                  {tauxCouverture}%
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {t('leads.kpiCoverageFootnote', {
                    ca: Math.round(totalCA).toLocaleString('fr-FR'),
                    leads: totalLeadsValue.toLocaleString('fr-FR'),
                    dep: Math.round(totalExpenses).toLocaleString('fr-FR'),
                  })}
                </p>
              </CardContent>
            </Card>
          </div>
        );
      })()}

      {/* Leads Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {leads.length === 0 ? (
          <Card className="col-span-full">
            <CardContent className="text-center py-12">
              <p className="text-sm text-muted-foreground">{t('leads.none')}</p>
            </CardContent>
          </Card>
        ) : (
          leads.map((lead: any) => {
            const statusInfo = STATUS_LABELS[lead.status] || STATUS_LABELS.NEW;
            return (
              <Card key={lead.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-base font-semibold">{lead.name}</CardTitle>
                      {lead.company && <p className="text-sm text-muted-foreground">{lead.company}</p>}
                    </div>
                    <Badge className={statusInfo.color}>{t(`leads.status.${lead.status.toLowerCase()}`, { defaultValue: statusInfo.label })}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="space-y-1">
                    {lead.contactName && (
                      <div className="flex items-center gap-2 text-sm">
                        <UserCheck size={14} className="text-muted-foreground" />
                        <span>{lead.contactName}</span>
                      </div>
                    )}
                    {lead.email && (
                      <div className="flex items-center gap-2 text-sm">
                        <Mail size={14} className="text-muted-foreground" />
                        <span className="truncate">{lead.email}</span>
                      </div>
                    )}
                    {lead.phone && (
                      <div className="flex items-center gap-2 text-sm">
                        <Phone size={14} className="text-muted-foreground" />
                        <span>{lead.phone}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <TrendingUp size={14} />
                      <span>{t('leads.score')}: {lead.score}</span>
                    </div>
                    {lead.estimatedValue && (
                      <div className="text-right">
                        <span className="text-sm font-semibold">{Math.round(Number(lead.estimatedValue) * 1.19).toLocaleString('fr-FR')} DT</span>
                        <p className="text-[10px] text-muted-foreground">{Number(lead.estimatedValue).toLocaleString('fr-FR')} DT HT</p>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 pt-2">
                    {lead.status !== 'CONVERTED' && lead.status !== 'LOST' && (
                      <Button size="sm" variant="outline" className="flex-1" onClick={() => handleConvert(lead.id)}>
                        <Building2 size={14} className="mr-1" /> {t('leads.convert')}
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => openEdit(lead)}>
                      <Pencil size={14} />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => deleteMutation.mutate(lead.id)}>
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {pagination.total} {t('leads.title')}
          </p>
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant={page === 1 ? 'ghost' : 'default'}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3"
            >
              {t('common.previous')}
            </Button>
            {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((p) => (
              <Button
                key={p}
                size="sm"
                variant={p === page ? 'default' : 'outline'}
                onClick={() => setPage(p)}
                className={`w-8 h-8 p-0 ${p === page ? 'font-bold' : ''}`}
              >
                {p}
              </Button>
            ))}
            <Button
              size="sm"
              variant={page === pagination.totalPages ? 'ghost' : 'default'}
              onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
              disabled={page === pagination.totalPages}
              className="px-3"
            >
              {t('common.next')}
            </Button>
          </div>
        </div>
      )}

      {/* Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{form.id ? t('leads.editLead') : t('leads.newLead')}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5 col-span-2">
                <Label>{t('common.name')} *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t('leads.leadName')} />
              </div>
              <div className="space-y-1.5">
                <Label>{t('leads.contact')}</Label>
                <Input value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} placeholder={t('leads.contactName')} />
              </div>
              <div className="space-y-1.5">
                <Label>{t('leads.company')}</Label>
                <Input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} placeholder={t('leads.companyName')} />
              </div>
              <div className="space-y-1.5">
                <Label>{t('common.email')}</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="email@example.com" />
              </div>
              <div className="space-y-1.5">
                <Label>{t('organizations.fields.phone')}</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+216 55 053 505" />
              </div>
              <div className="space-y-1.5">
                <Label>{t('leads.source')}</Label>
                <Select value={form.source} onValueChange={(v) => setForm({ ...form, source: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(SOURCE_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{t(`leads.sources.${key.toLowerCase()}`, { defaultValue: label })}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t('affaires.affaireStatus')}</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_LABELS).map(([key, { label }]) => (
                      <SelectItem key={key} value={key}>{t(`leads.status.${key.toLowerCase()}`, { defaultValue: label })}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t('leads.score')} (0-100)</Label>
                <Input type="number" min="0" max="100" value={form.score} onChange={(e) => setForm({ ...form, score: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>{t('leads.estimatedValue')} (DT)</Label>
                <Input type="number" value={form.estimatedValue} onChange={(e) => setForm({ ...form, estimatedValue: e.target.value })} placeholder="0" />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label>{t('leads.notes')}</Label>
                <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder={t('leads.notesPlaceholder')} rows={3} />
              </div>
            </div>
            <DialogFooter className="mt-6">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>{t('common.cancel')}</Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? t('organizations.saving') : t('common.save')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
