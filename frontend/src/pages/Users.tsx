import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Plus, Pencil, Trash2, Shield, User as UserIcon, Settings, Eye, EyeOff } from 'lucide-react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/form-controls';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import type { User, UserRole } from '@/types';

const EMPTY = { id: '', email: '', name: '', password: '', confirmPassword: '', role: 'PARTNER' as UserRole };

const PAGES = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'agents-marketplace', label: 'Agents IA' },
  { key: 'contacts', label: 'Contacts' },
  { key: 'prospection-ia', label: 'Chasseur IA' },
  { key: 'ai-assistant', label: 'Assistant IA' },
  { key: 'scout-ai', label: 'Veilleur IA' },
  { key: 'offre-bot', label: "Rédacteur d'offres" },
  { key: 'gmail-ai', label: 'Gmail IA' },
  { key: 'factcheck-ai', label: 'Vérificateur IA' },
  { key: 'brand-pulse', label: 'BrandPulse' },
  { key: 'settings', label: 'Paramètres' },
  { key: 'support', label: 'Support' },
];

type PermissionState = { page: string; canView: boolean; canCreate: boolean; canEdit: boolean; canDelete: boolean };

export function Users({ embedded = false }: { embedded?: boolean }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [permissionsOpen, setPermissionsOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formError, setFormError] = useState('');
  const [permissions, setPermissions] = useState<PermissionState[]>(
    PAGES.map(p => ({ page: p.key, canView: true, canCreate: false, canEdit: false, canDelete: false }))
  );

  const { data: usersData } = useQuery<{ data: User[], pagination: any }>({
    queryKey: ['users'],
    queryFn: () => api.get('/users').then((r) => r.data),
  });
  const users = usersData?.data || [];

  const { data: currentUser } = useQuery<User>({
    queryKey: ['me'],
    queryFn: () => api.get('/auth/me').then((r) => r.data.user),
  });

  const saveMutation = useMutation({
    mutationFn: (data: typeof EMPTY) => {
      const payload: any = { email: data.email, name: data.name, role: data.role };
      if (data.password) payload.password = data.password;
      delete (payload as any).id;
      return data.id ? api.put(`/users/${data.id}`, payload) : api.post('/users', payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      setOpen(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/users/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
    },
  });

  const { data: userPermissionsData } = useQuery<any[]>({
    queryKey: ['user-permissions', selectedUser?.id],
    queryFn: () => selectedUser ? api.get(`/user-permissions/user/${selectedUser.id}`).then((r) => r.data) : Promise.resolve([]),
    enabled: !!selectedUser,
  });

  const savePermissionsMutation = useMutation({
    mutationFn: (data: { userId: string; permissions: PermissionState[] }) =>
      api.post('/user-permissions/bulk', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['user-permissions'] });
      setPermissionsOpen(false);
    },
  });

  const openPermissions = async (user: User) => {
    setSelectedUser(user);
    const perms = await api.get(`/user-permissions/user/${user.id}`).then((r) => r.data);
    if (perms.length > 0) {
      setPermissions(perms);
    } else {
      setPermissions(PAGES.map(p => ({ page: p.key, canView: true, canCreate: false, canEdit: false, canDelete: false })));
    }
    setPermissionsOpen(true);
  };

  const savePermissions = () => {
    if (!selectedUser) return;
    savePermissionsMutation.mutate({
      userId: selectedUser.id,
      permissions,
    });
  };

  const openEdit = (u: User) => {
    setForm({
      id: u.id,
      email: u.email,
      name: u.name,
      password: '',
      confirmPassword: '',
      role: u.role,
    });
    setShowPassword(false);
    setShowConfirmPassword(false);
    setFormError('');
    setOpen(true);
  };

  const isOwner = currentUser?.role === 'OWNER' || currentUser?.role === 'SUPERADMIN';

  return (
    <div className={embedded ? 'space-y-4' : 'space-y-6 px-2 md:px-0'}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          {!embedded && <h1 className="font-serif text-2xl md:text-3xl">{t('usersPage.title')}</h1>}
          {embedded ? (
            <>
              <h2 className="text-lg font-semibold">{t('usersPage.settingsTitle')}</h2>
              <p className="text-sm text-muted-foreground">{t('usersPage.settingsSubtitle')}</p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">{t('usersPage.subtitle')}</p>
          )}
        </div>
        {isOwner && (
          <Button onClick={() => { setForm(EMPTY); setShowPassword(false); setShowConfirmPassword(false); setFormError(''); setOpen(true); }} className="w-full sm:w-auto">
            <Plus size={16} />{t('usersPage.newUser')}
          </Button>
        )}
      </div>

      {!isOwner && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4">
            <p className="text-sm text-amber-800">
              {t('usersPage.noPermission')}
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {users.map((u) => (
          <Card key={u.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-gray-100 rounded-lg">
                    <UserIcon size={16} />
                  </div>
                  <h3 className="font-semibold">{u.name}</h3>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  u.role === 'OWNER' ? 'bg-purple-100 text-purple-700' :
                  u.role === 'COMMERCIAL' ? 'bg-green-100 text-green-700' :
                  'bg-blue-100 text-blue-700'
                }`}>
                  {u.role === 'OWNER' ? t('usersPage.roles.owner') : u.role === 'COMMERCIAL' ? t('usersPage.roles.commercial') : t('usersPage.roles.partner')}
                </span>
              </div>
              <p className="text-sm text-muted-foreground mb-3">{u.email}</p>
              {isOwner && (
                <div className="flex gap-1 justify-end">
                  <Button size="sm" variant="outline" onClick={() => openEdit(u)}><Pencil size={12} /></Button>
                  {(u.role === 'COMMERCIAL' || u.role === 'PARTNER') && (
                    <Button size="sm" variant="outline" onClick={() => openPermissions(u)} title={t('usersPage.managePermissions')}>
                      <Settings size={12} />
                    </Button>
                  )}
                  {u.id !== currentUser?.id && (
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => confirm(t('usersPage.confirmDelete')) && deleteMutation.mutate(u.id)}
                    >
                      <Trash2 size={12} />
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{form.id ? t('usersPage.editUser') : t('usersPage.newUser')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>{t('common.email')} *</Label>
              <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>{t('common.name')} *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>{form.id ? t('usersPage.passwordOptional') : t('usersPage.passwordRequired')}</Label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{t('auth.confirmPassword')}</Label>
              <div className="relative">
                <Input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={form.confirmPassword}
                  onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{t('usersPage.role')} *</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as UserRole })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="OWNER">{t('usersPage.roleOwner')}</SelectItem>
                  <SelectItem value="PARTNER">{t('usersPage.rolePartner')}</SelectItem>
                  <SelectItem value="COMMERCIAL">{t('usersPage.roleCommercial')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {formError && (
              <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
                {formError}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t('common.cancel')}</Button>
            <Button
              onClick={() => {
                setFormError('');
                if (form.password || form.confirmPassword) {
                  if (form.password !== form.confirmPassword) {
                    setFormError(t('auth.passwordsDoNotMatch'));
                    return;
                  }
                }
                saveMutation.mutate(form);
              }}
              disabled={!form.email || !form.name || (!form.id && !form.password)}
            >
              {t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={permissionsOpen} onOpenChange={setPermissionsOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('usersPage.permissionsTitle')} - {selectedUser?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">{t('usersPage.page')}</th>
                  <th className="text-center p-2">{t('usersPage.view')}</th>
                  <th className="text-center p-2">{t('usersPage.create')}</th>
                  <th className="text-center p-2">{t('common.edit')}</th>
                  <th className="text-center p-2">{t('common.delete')}</th>
                </tr>
              </thead>
              <tbody>
                {permissions.map((perm, idx) => {
                  const pageLabel = PAGES.find(p => p.key === perm.page)?.label || perm.page;
                  return (
                    <tr key={perm.page} className="border-b">
                      <td className="p-2 font-medium">{pageLabel}</td>
                      <td className="p-2 text-center">
                        <input
                          type="checkbox"
                          checked={perm.canView}
                          onChange={(e) => {
                            const newPerms = [...permissions];
                            newPerms[idx] = { ...perm, canView: e.target.checked };
                            setPermissions(newPerms);
                          }}
                        />
                      </td>
                      <td className="p-2 text-center">
                        <input
                          type="checkbox"
                          checked={perm.canCreate}
                          onChange={(e) => {
                            const newPerms = [...permissions];
                            newPerms[idx] = { ...perm, canCreate: e.target.checked };
                            setPermissions(newPerms);
                          }}
                          disabled={!perm.canView}
                        />
                      </td>
                      <td className="p-2 text-center">
                        <input
                          type="checkbox"
                          checked={perm.canEdit}
                          onChange={(e) => {
                            const newPerms = [...permissions];
                            newPerms[idx] = { ...perm, canEdit: e.target.checked };
                            setPermissions(newPerms);
                          }}
                          disabled={!perm.canView}
                        />
                      </td>
                      <td className="p-2 text-center">
                        <input
                          type="checkbox"
                          checked={perm.canDelete}
                          onChange={(e) => {
                            const newPerms = [...permissions];
                            newPerms[idx] = { ...perm, canDelete: e.target.checked };
                            setPermissions(newPerms);
                          }}
                          disabled={!perm.canView}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPermissionsOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={savePermissions} disabled={savePermissionsMutation.isPending}>
              {savePermissionsMutation.isPending ? t('organizations.saving') : t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
