import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Building2, Plus, Pencil, Trash2, X } from 'lucide-react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input, Label, Textarea } from '@/components/ui/form-controls';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import type { Organization } from '@/types';

const EMPTY: FormData = { name: '', email: '', phone: '', address: '', tva: '', logoUrl: '' };

type FormData = {
  name: string;
  email: string;
  phone: string;
  address: string;
  tva: string;
  logoUrl: string;
};

export function Organizations() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormData>(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);

  const { data: organizationsData } = useQuery<Organization | Organization[]>({
    queryKey: ['organizations'],
    queryFn: () => api.get('/organizations').then((r) => r.data),
  });

  // Show only the user's organization (API returns a single object or a legacy array)
  const userOrganization = Array.isArray(organizationsData)
    ? organizationsData[0] ?? null
    : organizationsData ?? null;

  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      let finalData = { ...data };
      if (logoFile) {
        const formData = new FormData();
        formData.append('file', logoFile);
        const uploadRes = await api.post('/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        finalData.logoUrl = uploadRes.data.url;
      }
      return api.post('/organizations', finalData).then((r) => r.data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['organizations'] });
      setOpen(false);
      setForm(EMPTY);
      setLogoFile(null);
    },
    onError: (error) => {
      console.error('Create error:', error);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: FormData }) => {
      let finalData = { ...data };
      if (logoFile) {
        const formData = new FormData();
        formData.append('file', logoFile);
        const uploadRes = await api.post('/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        finalData.logoUrl = uploadRes.data.url;
      }
      return api.put(`/organizations/${id}`, finalData).then((r) => r.data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['organizations'] });
      setOpen(false);
      setForm(EMPTY);
      setEditingId(null);
      setLogoFile(null);
    },
    onError: (error) => {
      console.error('Update error:', error);
      alert('Erreur lors de la mise à jour: ' + (error as any).message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/organizations/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['organizations'] }),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: form });
    } else {
      createMutation.mutate(form);
    }
  };

  const openEdit = (org: Organization) => {
    setForm({
      name: org.name,
      email: org.email || '',
      phone: org.phone || '',
      address: org.address || '',
      tva: org.tva || '',
      logoUrl: org.logoUrl || '',
    });
    setEditingId(org.id);
    setOpen(true);
  };

  const openCreate = () => {
    setForm(EMPTY);
    setEditingId(null);
    setLogoFile(null);
    setOpen(true);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t('organizations.title')}</h1>
        <p className="text-muted-foreground">{t('organizations.subtitle')}</p>
      </div>

      <div className="max-w-2xl">
        {userOrganization ? (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  {userOrganization.logoUrl ? (
                    <img src={userOrganization.logoUrl} alt={userOrganization.name} className="w-24 h-24 rounded-lg object-contain" />
                  ) : (
                    <div className="w-24 h-24 rounded-lg bg-muted flex items-center justify-center">
                      <Building2 size={48} className="text-muted-foreground" />
                    </div>
                  )}
                  <div>
                    <CardTitle className="text-xl">{userOrganization.name}</CardTitle>
                    {userOrganization.email && <p className="text-sm text-muted-foreground">{userOrganization.email}</p>}
                  </div>
                </div>
                <Button size="sm" variant="ghost" onClick={() => openEdit(userOrganization)}>
                  <Pencil size={16} />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {userOrganization.phone && <p className="text-muted-foreground">📞 {userOrganization.phone}</p>}
              {userOrganization.address && <p className="text-muted-foreground">📍 {userOrganization.address}</p>}
              {userOrganization.tva && <p className="text-muted-foreground">🧾 {t('organizations.vatLabel')}: {userOrganization.tva}</p>}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              {t('organizations.noneFound')}
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('organizations.editDialogTitle')}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="name">{t('organizations.fields.name')} *</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="email">{t('common.email')}</Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="phone">{t('organizations.fields.phone')}</Label>
                <Input
                  id="phone"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="address">{t('organizations.fields.address')}</Label>
              <Textarea
                id="address"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                rows={2}
              />
            </div>
            <div>
              <Label htmlFor="tva">{t('organizations.fields.vatNumber')}</Label>
              <Input
                id="tva"
                value={form.tva}
                onChange={(e) => setForm({ ...form, tva: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="logo">{t('organizations.fields.logo')}</Label>
              <div className="flex items-center gap-4">
                {form.logoUrl && (
                  <img src={form.logoUrl} alt="Logo" className="w-16 h-16 rounded-lg object-cover" />
                )}
                <div className="flex-1">
                  <Input
                    id="logo"
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setLogoFile(file);
                        setForm({ ...form, logoUrl: URL.createObjectURL(file) });
                      }
                    }}
                  />
                </div>
                {form.logoUrl && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setForm({ ...form, logoUrl: '' });
                      setLogoFile(null);
                    }}
                  >
                    <X size={16} />
                  </Button>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {createMutation.isPending || updateMutation.isPending ? t('organizations.saving') : t('common.save')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
