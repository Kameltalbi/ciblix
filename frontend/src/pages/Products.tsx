import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Plus, Pencil, Trash2, Package } from 'lucide-react';
import { api } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/form-controls';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import type { Product } from '@/types';

type RevenueCategory = { id: string; name: string; type: string };

const EMPTY = {
  id: '',
  name: '',
  description: '',
  price: 0,
  categoryId: '',
  active: true,
};

export function Products() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);

  const { data: productsData, error, isLoading } = useQuery<{ data: Product[]; pagination: any }>({
    queryKey: ['products'],
    queryFn: () => api.get('/products').then((r) => r.data),
  });
  const products = productsData?.data || [];

  const { data: categories = [] } = useQuery<RevenueCategory[]>({
    queryKey: ['categories', 'REVENUE'],
    queryFn: () => api.get('/categories?type=REVENUE').then((r) => r.data),
  });

  const saveMutation = useMutation({
    mutationFn: (data: typeof EMPTY) => {
      const payload: any = {
        name: data.name,
        description: data.description,
        price: data.price,
        categoryId: data.categoryId || null,
        active: data.active,
      };
      return data.id ? api.put(`/products/${data.id}`, payload) : api.post('/products', payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] });
      setOpen(false);
    },
    onError: (err) => {
      console.error('Error saving product:', err);
      alert(t('productsPage.saveError'));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/products/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] });
    },
  });

  const openEdit = (p: Product) => {
    setForm({
      id: p.id,
      name: p.name,
      description: p.description || '',
      price: Number(p.price),
      categoryId: p.categoryId || '',
      active: p.active,
    });
    setOpen(true);
  };

  return (
    <div className="space-y-6 px-2 md:px-0">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl md:text-3xl">{t('productsPage.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('productsPage.subtitle')}</p>
        </div>
        <Button onClick={() => { setForm(EMPTY); setOpen(true); }} className="w-full sm:w-auto">
          <Plus size={16} />{t('productsPage.newProduct')}
        </Button>
      </div>

      {isLoading && <p className="text-muted-foreground">{t('common.loading')}</p>}
      {error && <p className="text-destructive">{t('productsPage.error')}: {String(error)}</p>}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {products.map((p) => (
          <Card key={p.id} className={`hover:shadow-md transition-shadow ${!p.active ? 'opacity-60' : ''}`}>
            <CardContent className="p-4">
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-sky-100">
                    <Package size={16} className="text-sky-600" />
                  </div>
                  <h3 className="font-semibold">{p.name}</h3>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${p.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                  {p.active ? t('productsPage.active') : t('productsPage.inactive')}
                </span>
              </div>
              {p.category?.name && (
                <span className="inline-block text-xs px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200 mb-2">
                  {p.category.name}
                </span>
              )}
              {p.description && <p className="text-sm text-muted-foreground mb-2 line-clamp-2">{p.description}</p>}
              <p className="text-lg font-bold text-sky-600 mb-3">{Number(p.price).toLocaleString('fr-TN')} DT</p>
              <div className="flex gap-1 justify-end">
                <Button size="sm" variant="outline" onClick={() => openEdit(p)}><Pencil size={12} /></Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => confirm(t('productsPage.confirmDelete')) && deleteMutation.mutate(p.id)}
                >
                  <Trash2 size={12} />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {!isLoading && products.length === 0 && (
        <p className="text-muted-foreground text-center py-8">{t('productsPage.none')}</p>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{form.id ? t('productsPage.editProduct') : t('productsPage.newProduct')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>{t('common.name')} *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>{t('calendarPage.description')}</Label>
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>{t('productsPage.price')} (DT) *</Label>
              <Input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} />
            </div>
            <div className="space-y-1.5">
              <Label>Catégorie *</Label>
              {categories.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Aucune catégorie de revenu. Crée-en d'abord dans Paramètres → Catégories.
                </p>
              ) : (
                <Select
                  value={form.categoryId}
                  onValueChange={(v) => setForm({ ...form, categoryId: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choisir une catégorie" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="active"
                checked={form.active}
                onChange={(e) => setForm({ ...form, active: e.target.checked })}
                className="w-4 h-4"
              />
              <Label htmlFor="active">{t('productsPage.active')}</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t('common.cancel')}</Button>
            <Button
              onClick={() => saveMutation.mutate(form)}
              disabled={!form.name || form.price < 0 || !form.categoryId}
            >
              {t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
