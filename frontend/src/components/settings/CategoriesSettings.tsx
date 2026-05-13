import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Tag, ArrowDownCircle, ArrowUpCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/form-controls';

type CustomCategory = {
  id: string;
  name: string;
  type: string;
  createdAt: string;
};

export function CategoriesSettings() {
  const qc = useQueryClient();
  const [newExpense, setNewExpense] = useState('');
  const [newRevenue, setNewRevenue] = useState('');

  const { data: categories = [], error } = useQuery<CustomCategory[]>({
    queryKey: ['categories'],
    queryFn: () => api.get('/categories').then((r) => r.data),
  });

  const normalizedCategories = categories.map((c) => ({
    ...c,
    type: String(c.type || '').toUpperCase(),
  }));

  const expenseCategories = normalizedCategories.filter((c) => c.type === 'EXPENSE');
  const revenueCategories = normalizedCategories.filter((c) => c.type === 'REVENUE');

  const createMutation = useMutation({
    mutationFn: (data: { name: string; type: string }) => api.post('/categories', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/categories/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
  });

  const addExpense = () => {
    if (!newExpense.trim()) return;
    createMutation.mutate({ name: newExpense.trim(), type: 'EXPENSE' }, {
      onSuccess: () => setNewExpense(''),
    });
  };

  const addRevenue = () => {
    if (!newRevenue.trim()) return;
    createMutation.mutate({ name: newRevenue.trim(), type: 'REVENUE' }, {
      onSuccess: () => setNewRevenue(''),
    });
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Catégories Dépenses */}
      <Card className="border-red-200 bg-red-50/30">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
              <ArrowDownCircle className="text-red-600" size={20} />
            </div>
            <div className="flex-1">
              <CardTitle className="text-lg">Catégories Dépenses</CardTitle>
              <CardDescription>Gérer les catégories de dépenses</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {error && (
            <p className="text-xs text-destructive">
              Impossible de charger les catégories ({(error as any)?.response?.status || 'erreur réseau'})
            </p>
          )}
          <div className="flex gap-2">
            <Input
              value={newExpense}
              onChange={(e) => setNewExpense(e.target.value)}
              placeholder="Nouvelle catégorie..."
              onKeyDown={(e) => e.key === 'Enter' && addExpense()}
            />
            <Button size="sm" onClick={addExpense} disabled={createMutation.isPending}>
              <Plus size={16} />
            </Button>
          </div>
          <div className="space-y-1">
            {expenseCategories.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">Aucune catégorie personnalisée</p>
            ) : (
              expenseCategories.map((cat) => (
                <div key={cat.id} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-red-100/50">
                  <div className="flex items-center gap-2">
                    <Tag size={14} className="text-red-500" />
                    <span className="text-sm">{cat.name}</span>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => deleteMutation.mutate(cat.id)}
                    className="h-7 w-7 p-0"
                  >
                    <Trash2 size={14} className="text-red-500" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Catégories Revenus */}
      <Card className="border-sky-200 bg-sky-50/30">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-sky-100 flex items-center justify-center">
              <ArrowUpCircle className="text-sky-600" size={20} />
            </div>
            <div className="flex-1">
              <CardTitle className="text-lg">Catégories Revenus</CardTitle>
              <CardDescription>Gérer les catégories de revenus</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {error && (
            <p className="text-xs text-destructive">
              Impossible de charger les catégories ({(error as any)?.response?.status || 'erreur réseau'})
            </p>
          )}
          <div className="flex gap-2">
            <Input
              value={newRevenue}
              onChange={(e) => setNewRevenue(e.target.value)}
              placeholder="Nouvelle catégorie..."
              onKeyDown={(e) => e.key === 'Enter' && addRevenue()}
            />
            <Button size="sm" onClick={addRevenue} disabled={createMutation.isPending}>
              <Plus size={16} />
            </Button>
          </div>
          <div className="space-y-1">
            {revenueCategories.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">Aucune catégorie personnalisée</p>
            ) : (
              revenueCategories.map((cat) => (
                <div key={cat.id} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-sky-100/50">
                  <div className="flex items-center gap-2">
                    <Tag size={14} className="text-sky-500" />
                    <span className="text-sm">{cat.name}</span>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => deleteMutation.mutate(cat.id)}
                    className="h-7 w-7 p-0"
                  >
                    <Trash2 size={14} className="text-red-500" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
