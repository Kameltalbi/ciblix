import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, DropdownMenu, DropdownMenuTriggerButton, DropdownMenuContentWrapper, DropdownMenuItemStyled } from '@/components/ui/form-controls';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Users, Building2, CreditCard, Activity, CheckCircle, Clock, AlertTriangle, LogOut, LayoutDashboard, Receipt, Shield, DollarSign, TrendingUp, TrendingDown, Eye, EyeOff, Settings as SettingsIcon, Key, UserCheck, UserX, Plus, Edit, Trash2, MessageSquare, Send } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'organizations', label: 'Entreprises', icon: Building2 },
  { id: 'subscriptions', label: 'Abonnements', icon: CreditCard },
  { id: 'payments', label: 'Paiements', icon: Receipt },
  { id: 'users', label: 'Utilisateurs', icon: Users },
  { id: 'tickets', label: 'Tickets', icon: MessageSquare },
  { id: 'settings', label: 'Paramètres', icon: SettingsIcon },
];

export function AdminDashboard() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('dashboard');
  const navigate = useNavigate();
  const logout = useAuth((s) => s.logout);
  const queryClient = useQueryClient();

  const handleLogout = async () => { await logout(); navigate('/login'); };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <Shield className="text-leaf" size={24} />
              <span className="text-xl font-bold">SuperAdmin</span>
            </div>
            <button onClick={handleLogout} className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg">
              <LogOut size={16} /> {t('common.logout')}
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {TABS.map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${activeTab === tab.id ? 'bg-leaf text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}`}>
              <tab.icon size={16} /> {t(`admin.tabs.${tab.id}`, { defaultValue: tab.label })}
            </button>
          ))}
        </div>

        {activeTab === 'dashboard' && <DashboardTab />}
        {activeTab === 'organizations' && <OrganizationsTab />}
        {activeTab === 'subscriptions' && <SubscriptionsTab />}
        {activeTab === 'payments' && <PaymentsTab queryClient={queryClient} />}
        {activeTab === 'users' && <UsersTab />}
        {activeTab === 'tickets' && <SupportTicketsTab />}
        {activeTab === 'settings' && <SettingsTab />}
      </div>
    </div>
  );
}

function DashboardTab() {
  const { data: stats } = useQuery({ queryKey: ['superadmin-stats'], queryFn: () => api.get('/superadmin/stats').then(r => r.data) });

  // Dummy data for charts
  const revenueData = [
    { month: 'Jan', revenue: 12000 },
    { month: 'Fév', revenue: 19000 },
    { month: 'Mar', revenue: 15000 },
    { month: 'Avr', revenue: 22000 },
    { month: 'Mai', revenue: 28000 },
    { month: 'Juin', revenue: 32000 },
  ];

  const clientsData = [
    { month: 'Jan', clients: 5 },
    { month: 'Fév', clients: 8 },
    { month: 'Mar', clients: 12 },
    { month: 'Avr', clients: 15 },
    { month: 'Mai', clients: 20 },
    { month: 'Juin', clients: 25 },
  ];

  const kpiCards = [
    { label: 'MRR Mensuel', value: `${stats?.mrr || 32000} DT`, icon: DollarSign, color: 'text-purple-600', trend: '+12%', trendUp: true },
    { label: 'Clients Actifs', value: stats?.organizations?.approved || 25, icon: Building2, color: 'text-blue-600', trend: '+5', trendUp: true },
    { label: 'Nouveaux Clients', value: stats?.newClientsThisMonth || 5, icon: Users, color: 'text-green-600', trend: '+2', trendUp: true },
    { label: 'Taux de Churn', value: `${stats?.churnRate || 2.5}%`, icon: TrendingDown, color: 'text-red-600', trend: '-0.5%', trendUp: true },
    { label: 'Paiements en attente', value: stats?.organizations?.pending || 3, icon: Clock, color: 'text-yellow-600', trend: '+1', trendUp: false },
    { label: 'Utilisateurs Actifs (30j)', value: stats?.activeUsers || 45, icon: Activity, color: 'text-sky-600', trend: '+8', trendUp: true },
  ];

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Dashboard</h2>
      
      {/* KPI Cards */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {kpiCards.map((card) => (
          <Card key={card.label}>
            <CardContent className="flex items-center gap-4 p-6">
              <card.icon className={`${card.color} flex-shrink-0`} size={28} />
              <div className="flex-1">
                <p className="text-2xl font-bold">{card.value}</p>
                <p className="text-sm text-muted-foreground">{card.label}</p>
              </div>
              <div className={`flex items-center gap-1 text-xs ${card.trendUp ? 'text-green-600' : 'text-red-600'}`}>
                {card.trendUp ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                {card.trend}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <div className="grid md:grid-cols-2 gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Évolution du Revenu (MRR)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Croissance des Nouveaux Clients</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={clientsData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="clients" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* System Info */}
      <Card>
        <CardHeader><CardTitle className="text-lg">Informations Système</CardTitle></CardHeader>
        <CardContent className="grid md:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Total Utilisateurs</p>
            <p className="text-lg font-bold">{stats?.users || 0}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Total Clients</p>
            <p className="text-lg font-bold">{stats?.clients || 0}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Total Opportunités</p>
            <p className="text-lg font-bold">{stats?.affaires || 0}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function OrganizationsTab() {
  const { data: orgs } = useQuery({
    queryKey: ['admin-organizations'],
    queryFn: () => api.get('/superadmin/organizations').then(r => r.data),
    refetchInterval: 15000,
  });
  const queryClient = useQueryClient();

  const updateOrganizationCache = (organization: any) => {
    queryClient.setQueryData(['admin-organizations'], (current: any) => {
      if (!Array.isArray(current)) return current;
      return current.map((org) =>
        org.id === organization.id
          ? {
              ...org,
              plan: organization.plan ?? org.plan,
              paymentStatus: organization.paymentStatus ?? org.paymentStatus,
              suspended: organization.suspended ?? org.suspended,
            }
          : org
      );
    });
  };

  const refreshOrganizations = () => {
    queryClient.refetchQueries({ queryKey: ['admin-organizations'], type: 'all' });
    queryClient.refetchQueries({ queryKey: ['superadmin-payments'], type: 'all' });
    queryClient.refetchQueries({ queryKey: ['superadmin-subscriptions'], type: 'all' });
    queryClient.refetchQueries({ queryKey: ['superadmin-stats'], type: 'all' });
  };

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, paymentStatus }: { id: string; paymentStatus: 'PENDING' | 'APPROVED' | 'REJECTED' }) =>
      api.put(`/superadmin/organizations/${id}/payment-status`, { paymentStatus }),
    onSuccess: ({ data }) => {
      updateOrganizationCache(data);
      refreshOrganizations();
    },
    onError: (error: any) => {
      refreshOrganizations();
      alert(error.response?.data?.error || error.message || 'Impossible de mettre à jour le statut paiement');
    },
  });

  const updatePlanMutation = useMutation({
    mutationFn: ({ id, plan }: { id: string; plan: 'FREE' | 'BASIC' | 'BUSINESS' | 'ENTERPRISE' }) =>
      api.put(`/superadmin/organizations/${id}/plan`, { plan }),
    onSuccess: ({ data }) => {
      updateOrganizationCache(data);
      refreshOrganizations();
    },
    onError: (error: any) => {
      refreshOrganizations();
      alert(error.response?.data?.error || error.message || 'Impossible de mettre à jour le plan');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/superadmin/organizations/${id}`),
    onSuccess: () => {
      refreshOrganizations();
    },
    onError: (error: any) => {
      refreshOrganizations();
      alert(
        error.response?.data?.error ||
        error.message ||
        'Impossible de supprimer cette organisation. La liste a été rafraîchie.'
      );
    },
  });

  const toggleSuspendMutation = useMutation({
    mutationFn: ({ id, suspended }: { id: string; suspended: boolean }) =>
      api.put(`/superadmin/organizations/${id}/suspend`, { suspended: !suspended }),
    onSuccess: ({ data }) => {
      updateOrganizationCache(data);
      refreshOrganizations();
    },
    onError: (error: any) => {
      refreshOrganizations();
      alert(
        error.response?.data?.error ||
        error.message ||
        'Impossible de suspendre cette organisation. La liste a été rafraîchie.'
      );
    },
  });

  const impersonateMutation = useMutation({
    mutationFn: (userId: string) => api.post('/superadmin/impersonate', { userId }),
    onSuccess: (data) => {
      localStorage.setItem('accessToken', data.data.accessToken);
      localStorage.setItem('refreshToken', data.data.refreshToken);
      localStorage.setItem('user', JSON.stringify(data.data.user));
      localStorage.setItem('impersonating', 'true');
      useAuth.setState({
        accessToken: data.data.accessToken,
        refreshToken: data.data.refreshToken,
        user: data.data.user,
      });
      window.location.href = '/';
    },
    onError: (error: any) => {
      alert(error.response?.data?.error || error.message || 'Impossible de se connecter à cette organisation');
    },
  });

  const paymentStatusBadge = (status: string) => {
    const colors: any = { PENDING: 'bg-yellow-100 text-yellow-700', APPROVED: 'bg-green-100 text-green-700', REJECTED: 'bg-red-100 text-red-700' };
    const labels: any = { PENDING: 'En attente', APPROVED: 'Approuvé', REJECTED: 'Refusé' };
    return <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[status] || 'bg-gray-100 text-gray-600'}`}>{labels[status] || status}</span>;
  };

  const planBadge = (plan: string) => {
    const colors: any = {
      FREE: 'bg-gray-100 text-gray-700',
      BASIC: 'bg-sky-100 text-sky-800',
      BUSINESS: 'bg-blue-100 text-blue-700',
      ENTERPRISE: 'bg-purple-100 text-purple-700',
    };
    const labels: any = {
      FREE: 'Gratuit',
      BASIC: 'Basic',
      BUSINESS: 'Business',
      ENTERPRISE: 'Professionnel',
    };
    return <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[plan] || 'bg-gray-100 text-gray-600'}`}>{labels[plan] || plan}</span>;
  };

  const suspendedBadge = (suspended: boolean) => {
    if (suspended) {
      return <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">Suspendu</span>;
    }
    return null;
  };

  const renderOrganizationActions = (org: any) => {
    const ownerId = org.users?.[0]?.id;
    const itemClassName = 'flex w-full items-center gap-2 whitespace-nowrap px-3 py-2 text-sm';
    const iconClassName = 'h-4 w-4 shrink-0 text-muted-foreground';

    return (
      <DropdownMenu>
        <DropdownMenuTriggerButton aria-label={`Actions ${org.name}`} />
        <DropdownMenuContentWrapper align="end" sideOffset={6} className="w-56">
          {ownerId && (
            <DropdownMenuItemStyled
              onClick={() => impersonateMutation.mutate(ownerId)}
              disabled={impersonateMutation.isPending}
              className={itemClassName}
            >
              <UserCheck className={iconClassName} />
              <span>Se connecter</span>
            </DropdownMenuItemStyled>
          )}
          {org.plan !== 'FREE' && (
            <DropdownMenuItemStyled
              onClick={() => updatePlanMutation.mutate({ id: org.id, plan: 'FREE' })}
              disabled={updatePlanMutation.isPending}
              className={itemClassName}
            >
              <Building2 className={iconClassName} />
              <span>Passer Gratuit</span>
            </DropdownMenuItemStyled>
          )}
          {org.plan !== 'BASIC' && (
            <DropdownMenuItemStyled
              onClick={() => updatePlanMutation.mutate({ id: org.id, plan: 'BASIC' })}
              disabled={updatePlanMutation.isPending}
              className={itemClassName}
            >
              <Building2 className={iconClassName} />
              <span>Passer Basic</span>
            </DropdownMenuItemStyled>
          )}
          {org.plan !== 'BUSINESS' && (
            <DropdownMenuItemStyled
              onClick={() => updatePlanMutation.mutate({ id: org.id, plan: 'BUSINESS' })}
              disabled={updatePlanMutation.isPending}
              className={itemClassName}
            >
              <Building2 className={iconClassName} />
              <span>Passer Business</span>
            </DropdownMenuItemStyled>
          )}
          {org.plan !== 'ENTERPRISE' && (
            <DropdownMenuItemStyled
              onClick={() => updatePlanMutation.mutate({ id: org.id, plan: 'ENTERPRISE' })}
              disabled={updatePlanMutation.isPending}
              className={itemClassName}
            >
              <Building2 className={iconClassName} />
              <span>Passer Professionnel</span>
            </DropdownMenuItemStyled>
          )}
          {org.paymentStatus !== 'APPROVED' && (
            <DropdownMenuItemStyled
              onClick={() => updateStatusMutation.mutate({ id: org.id, paymentStatus: 'APPROVED' })}
              disabled={updateStatusMutation.isPending}
              className={itemClassName}
            >
              <CheckCircle className="h-4 w-4 shrink-0 text-green-600" />
              <span>Approuver</span>
            </DropdownMenuItemStyled>
          )}
          <DropdownMenuItemStyled
            onClick={() => toggleSuspendMutation.mutate({ id: org.id, suspended: org.suspended })}
            disabled={toggleSuspendMutation.isPending}
            className={itemClassName}
          >
            {org.suspended ? (
              <UserCheck className="h-4 w-4 shrink-0 text-green-600" />
            ) : (
              <UserX className="h-4 w-4 shrink-0 text-amber-600" />
            )}
            <span>{org.suspended ? 'Réactiver' : 'Suspendre'}</span>
          </DropdownMenuItemStyled>
          <DropdownMenuItemStyled
            onClick={() => {
              if (confirm(`Supprimer définitivement l'organisation "${org.name}" et toutes ses données ?`)) {
                deleteMutation.mutate(org.id);
              }
            }}
            disabled={deleteMutation.isPending}
            className={`${itemClassName} text-red-600 focus:text-red-600`}
          >
            <Trash2 className="h-4 w-4 shrink-0 text-red-600" />
            <span>Supprimer</span>
          </DropdownMenuItemStyled>
        </DropdownMenuContentWrapper>
      </DropdownMenu>
    );
  };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Entreprises</h2>
      <Card>
        <CardContent className="p-0">
          <div className="md:hidden space-y-3 p-3">
            {orgs?.map((org: any) => (
              <Card key={org.id}>
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{org.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{org.email || '-'}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {planBadge(org.plan || 'FREE')}
                      {paymentStatusBadge(org.paymentStatus)}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    <p>Tél: {org.phone || '-'}</p>
                    <p>Utilisateurs: {org._count.users} • Clients: {org._count.clients} • Affaires: {org._count.affaires}</p>
                    <p>Activité: {new Date(org.createdAt).toLocaleDateString('fr-FR')}</p>
                    {org.suspended ? <span className="text-red-600 font-medium">Suspendu</span> : null}
                  </div>
                  <div className="flex justify-end">
                    {renderOrganizationActions(org)}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left p-4 font-medium">Entreprise</th>
                  <th className="text-left p-4 font-medium">Email</th>
                  <th className="text-left p-4 font-medium">Téléphone</th>
                  <th className="text-left p-4 font-medium">Plan</th>
                  <th className="text-left p-4 font-medium">Statut paiement</th>
                  <th className="text-left p-4 font-medium">Statut</th>
                  <th className="text-center p-4 font-medium">Utilisateurs</th>
                  <th className="text-center p-4 font-medium">Clients</th>
                  <th className="text-center p-4 font-medium">Affaires</th>
                  <th className="text-left p-4 font-medium">Dernière activité</th>
                  <th className="text-right p-4 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {orgs?.map((org: any) => (
                  <tr key={org.id} className="hover:bg-gray-50">
                    <td className="p-4 font-medium">{org.name}</td>
                    <td className="p-4">{org.email || '-'}</td>
                    <td className="p-4">{org.phone || '-'}</td>
                    <td className="p-4">{planBadge(org.plan || 'FREE')}</td>
                    <td className="p-4">{paymentStatusBadge(org.paymentStatus)}</td>
                    <td className="p-4">{suspendedBadge(org.suspended)}</td>
                    <td className="p-4 text-center">{org._count.users}</td>
                    <td className="p-4 text-center">{org._count.clients}</td>
                    <td className="p-4 text-center">{org._count.affaires}</td>
                    <td className="p-4 text-muted-foreground">{new Date(org.createdAt).toLocaleDateString('fr-FR')}</td>
                    <td className="p-4 flex justify-end">
                      {renderOrganizationActions(org)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SubscriptionsTab() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSubscription, setEditingSubscription] = useState<any>(null);
  const [formData, setFormData] = useState({
    organizationId: '',
    plan: 'BASIC',
    price: '',
    billingPeriod: 'YEARLY' as 'MONTHLY' | 'YEARLY',
    paymentMethod: 'VIREMENT',
    startDate: '',
    endDate: '',
  });
  const queryClient = useQueryClient();
  const refreshSubscriptions = () => {
    queryClient.invalidateQueries({ queryKey: ['superadmin-subscriptions'], refetchType: 'all' });
    queryClient.invalidateQueries({ queryKey: ['superadmin-payments'], refetchType: 'all' });
    queryClient.invalidateQueries({ queryKey: ['admin-organizations'], refetchType: 'all' });
    queryClient.invalidateQueries({ queryKey: ['superadmin-stats'], refetchType: 'all' });
  };

  const { data: orgs } = useQuery({
    queryKey: ['admin-organizations'],
    queryFn: () => api.get('/superadmin/organizations').then(r => r.data),
    refetchInterval: 15000,
  });
  const { data: subs } = useQuery({
    queryKey: ['superadmin-subscriptions'],
    queryFn: () => api.get('/superadmin/subscriptions').then(r => r.data),
    refetchInterval: 15000,
  });

  const syncSubscriptionsMutation = useMutation({
    mutationFn: () => api.post('/superadmin/subscriptions/sync-plans'),
    onSuccess: () => {
      refreshSubscriptions();
      alert('Abonnements synchronisés avec succès !');
    },
    onError: (error: any) => {
      alert(error.response?.data?.error || error.message || 'Impossible de synchroniser les abonnements');
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post('/superadmin/subscriptions', data),
    onSuccess: () => {
      refreshSubscriptions();
      setIsDialogOpen(false);
      setFormData({
        organizationId: '',
        plan: 'BASIC',
        price: '',
        billingPeriod: 'YEARLY',
        paymentMethod: 'VIREMENT',
        startDate: '',
        endDate: '',
      });
    },
    onError: (error: any) => {
      alert(error.response?.data?.error || error.message || 'Impossible de créer cet abonnement');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.put(`/superadmin/subscriptions/${id}`, data),
    onSuccess: () => {
      refreshSubscriptions();
      setIsDialogOpen(false);
      setEditingSubscription(null);
    },
    onError: (error: any) => {
      refreshSubscriptions();
      alert(error.response?.data?.error || error.message || 'Impossible de modifier cet abonnement');
    },
  });

  const deleteSubscriptionMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/superadmin/subscriptions/${id}`),
    onSuccess: () => {
      refreshSubscriptions();
    },
    onError: (error: any) => {
      refreshSubscriptions();
      alert(error.response?.data?.error || error.message || 'Impossible de supprimer cet abonnement');
    },
  });

  const statusBadge = (status: string) => {
    const colors: any = { actif: 'bg-green-100 text-green-700', en_attente: 'bg-yellow-100 text-yellow-700', expiré: 'bg-red-100 text-red-700', refusé: 'bg-red-100 text-red-700' };
    return <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[status] || 'bg-gray-100 text-gray-600'}`}>{status}</span>;
  };

  const handleSubmit = () => {
    if (editingSubscription) {
      updateMutation.mutate({ id: editingSubscription.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const openDialog = (sub?: any) => {
    if (sub) {
      setEditingSubscription(sub);
      setFormData({
        organizationId: sub.organizationId,
        plan: sub.plan,
        price: String(sub.price),
        billingPeriod: (sub.billingPeriod === 'MONTHLY' ? 'MONTHLY' : 'YEARLY'),
        paymentMethod: sub.paymentMethod,
        startDate: sub.startDate?.split('T')[0] || '',
        endDate: sub.endDate?.split('T')[0] || '',
      });
    } else {
      setEditingSubscription(null);
      setFormData({
        organizationId: '',
        plan: 'BASIC',
        price: '',
        billingPeriod: 'YEARLY',
        paymentMethod: 'VIREMENT',
        startDate: '',
        endDate: '',
      });
    }
    setIsDialogOpen(true);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Abonnements</h2>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => syncSubscriptionsMutation.mutate()} disabled={syncSubscriptionsMutation.isPending}>
            {syncSubscriptionsMutation.isPending ? 'Synchronisation...' : 'Synchroniser entreprises'}
          </Button>
          <Button onClick={() => openDialog()}>
            <Plus size={16} className="mr-2" /> Nouvel Abonnement
          </Button>
        </div>
      </div>
      <Card>
        <CardContent className="p-0">
          <div className="md:hidden space-y-3 p-3">
            {subs?.map((s: any) => (
              <Card key={s.id}>
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{s.organizationName}</p>
                      <p className="text-xs text-muted-foreground">{s.plan} • {s.price} DT</p>
                    </div>
                    {statusBadge(s.status)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    <p>Début: {new Date(s.startDate).toLocaleDateString('fr-FR')}</p>
                    <p>Fin: {new Date(s.endDate).toLocaleDateString('fr-FR')}</p>
                    <p>Paiement: {s.paymentMethod}</p>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="outline" onClick={() => openDialog(s)}>
                      <Edit size={14} />
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => {
                      if (confirm('Supprimer cet abonnement ?')) {
                        deleteSubscriptionMutation.mutate(s.id);
                      }
                    }} disabled={deleteSubscriptionMutation.isPending}>
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left p-4 font-medium">Entreprise</th>
                  <th className="text-left p-4 font-medium">Plan</th>
                  <th className="text-left p-4 font-medium">Montant</th>
                  <th className="text-left p-4 font-medium">Début</th>
                  <th className="text-left p-4 font-medium">Fin</th>
                  <th className="text-left p-4 font-medium">Statut</th>
                  <th className="text-left p-4 font-medium">Mode paiement</th>
                  <th className="text-right p-4 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {subs?.map((s: any) => (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="p-4 font-medium">{s.organizationName}</td>
                    <td className="p-4">{s.plan}</td>
                    <td className="p-4">{s.price} DT</td>
                    <td className="p-4">{new Date(s.startDate).toLocaleDateString('fr-FR')}</td>
                    <td className="p-4">{new Date(s.endDate).toLocaleDateString('fr-FR')}</td>
                    <td className="p-4">{statusBadge(s.status)}</td>
                    <td className="p-4">{s.paymentMethod}</td>
                    <td className="p-4 flex gap-2 justify-end">
                      <Button size="sm" variant="outline" onClick={() => openDialog(s)}>
                        <Edit size={14} />
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => {
                        if (confirm('Supprimer cet abonnement ?')) {
                          deleteSubscriptionMutation.mutate(s.id);
                        }
                      }} disabled={deleteSubscriptionMutation.isPending}>
                        <Trash2 size={14} />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingSubscription ? 'Modifier l\'Abonnement' : 'Nouvel Abonnement'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Entreprise</Label>
              <Select value={formData.organizationId} onValueChange={(v) => setFormData({ ...formData, organizationId: v })}>
                <SelectTrigger><SelectValue placeholder="Sélectionner une entreprise" /></SelectTrigger>
                <SelectContent>
                  {orgs?.map((org: any) => (
                    <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Plan</Label>
              <Select value={formData.plan} onValueChange={(v) => setFormData({ ...formData, plan: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="FREE">Gratuit</SelectItem>
                  <SelectItem value="BASIC">Basic</SelectItem>
                  <SelectItem value="BUSINESS">Business</SelectItem>
                  <SelectItem value="ENTERPRISE">Professionnel</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Facturation</Label>
              <Select value={formData.billingPeriod} onValueChange={(v) => setFormData({ ...formData, billingPeriod: v as 'MONTHLY' | 'YEARLY' })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="MONTHLY">Mensuel</SelectItem>
                  <SelectItem value="YEARLY">Annuel</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Prix (DT)</Label>
              <Input type="number" value={formData.price} onChange={(e) => setFormData({ ...formData, price: e.target.value })} />
            </div>
            <div>
              <Label>Mode de paiement</Label>
              <Select value={formData.paymentMethod} onValueChange={(v) => setFormData({ ...formData, paymentMethod: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="VIREMENT">Virement</SelectItem>
                  <SelectItem value="ESPECES">Espèces</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Date de début</Label>
              <Input type="date" value={formData.startDate} onChange={(e) => setFormData({ ...formData, startDate: e.target.value })} />
            </div>
            <div>
              <Label>Date de fin</Label>
              <Input type="date" value={formData.endDate} onChange={(e) => setFormData({ ...formData, endDate: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Annuler</Button>
            <Button onClick={handleSubmit}>{editingSubscription ? 'Modifier' : 'Créer'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PaymentsTab({ queryClient }: { queryClient: any }) {
  const { data: payments } = useQuery({
    queryKey: ['superadmin-payments'],
    queryFn: () => api.get('/superadmin/payments').then(r => r.data),
    refetchInterval: 15000,
  });

  const validateMutation = useMutation({
    mutationFn: (id: string) => api.post(`/superadmin/payments/${id}/validate`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['superadmin-payments'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['admin-organizations'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['superadmin-subscriptions'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['superadmin-stats'], refetchType: 'all' });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => api.post(`/superadmin/payments/${id}/reject`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['superadmin-payments'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['admin-organizations'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['superadmin-subscriptions'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['superadmin-stats'], refetchType: 'all' });
    },
  });

  const statusBadge = (status: string) => {
    const colors: any = { PAID: 'bg-green-100 text-green-700', PENDING: 'bg-yellow-100 text-yellow-700', REFUSED: 'bg-red-100 text-red-700' };
    const labels: any = { PAID: 'Validé', PENDING: 'En attente', REFUSED: 'Refusé' };
    return <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[status] || 'bg-gray-100 text-gray-600'}`}>{labels[status] || status}</span>;
  };

  const canValidatePayment = (payment: any) =>
    payment.paymentStatus !== 'PAID' || payment.organizationPaymentStatus !== 'APPROVED';

  const paymentActions = (payment: any) => {
    const canValidate = canValidatePayment(payment);
    const canReject = payment.paymentStatus === 'PENDING';

    if (!canValidate && !canReject) {
      return <span className="text-xs text-muted-foreground">Aucune action</span>;
    }

    return (
      <>
        {canValidate && (
          <Button
            size="sm"
            onClick={() => validateMutation.mutate(payment.id)}
            disabled={validateMutation.isPending}
          >
            <CheckCircle size={14} className="mr-1" />
            {payment.paymentStatus === 'PAID' ? 'Approuver accès' : 'Valider'}
          </Button>
        )}
        {canReject && (
          <Button
            size="sm"
            variant="destructive"
            onClick={() => rejectMutation.mutate(payment.id)}
            disabled={rejectMutation.isPending}
          >
            <AlertTriangle size={14} className="mr-1" /> Refuser
          </Button>
        )}
      </>
    );
  };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Paiements</h2>
      <Card>
        <CardContent className="p-0">
          <div className="md:hidden space-y-3 p-3">
            {payments?.map((p: any) => (
              <Card key={p.id}>
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{p.organizationName}</p>
                      <p className="text-xs text-muted-foreground">{p.plan} • {p.price} DT</p>
                    </div>
                    {statusBadge(p.paymentStatus)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    <p>Mode: {p.paymentMethod}</p>
                    <p>Demande: {new Date(p.createdAt).toLocaleDateString('fr-FR')}</p>
                  </div>
                  <div className="flex flex-wrap gap-2 justify-end">
                    {paymentActions(p)}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left p-4 font-medium">Entreprise</th>
                  <th className="text-left p-4 font-medium">Plan</th>
                  <th className="text-left p-4 font-medium">Montant</th>
                  <th className="text-left p-4 font-medium">Mode</th>
                  <th className="text-left p-4 font-medium">Statut</th>
                  <th className="text-left p-4 font-medium">Date demande</th>
                  <th className="text-left p-4 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {payments?.map((p: any) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="p-4 font-medium">{p.organizationName}</td>
                    <td className="p-4">{p.plan}</td>
                    <td className="p-4">{p.price} DT</td>
                    <td className="p-4">{p.paymentMethod}</td>
                    <td className="p-4">{statusBadge(p.paymentStatus)}</td>
                    <td className="p-4">{new Date(p.createdAt).toLocaleDateString('fr-FR')}</td>
                    <td className="p-4">
                      <div className="flex flex-wrap gap-2">
                        {paymentActions(p)}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function UsersTab() {
  const { data: users } = useQuery({ queryKey: ['admin-users'], queryFn: () => api.get('/superadmin/users').then(r => r.data) });
  const queryClient = useQueryClient();

  const blockMutation = useMutation({
    mutationFn: (userId: string) => api.post(`/superadmin/users/${userId}/block`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
  });

  const unblockMutation = useMutation({
    mutationFn: (userId: string) => api.post(`/superadmin/users/${userId}/unblock`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
  });

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Utilisateurs Globaux</h2>
      <Card>
        <CardContent className="p-0">
          <div className="md:hidden space-y-3 p-3">
            {users?.map((u: any) => (
              <Card key={u.id}>
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{u.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${u.role === 'OWNER' ? 'bg-purple-100 text-purple-700' : u.role === 'SUPERADMIN' ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-600'}`}>{u.role}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    <p>Entreprise: {u.organizationName}</p>
                    <p>Dernière connexion: {u.lastLogin ? new Date(u.lastLogin).toLocaleDateString('fr-FR') : 'Jamais'}</p>
                    <p>
                      {u.blocked ? (
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">Bloqué</span>
                      ) : (
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">Actif</span>
                      )}
                    </p>
                  </div>
                  <div className="flex justify-end">
                    {u.blocked ? (
                      <Button size="sm" variant="outline" onClick={() => unblockMutation.mutate(u.id)}>
                        <UserCheck size={14} className="mr-1" /> Débloquer
                      </Button>
                    ) : (
                      <Button size="sm" variant="destructive" onClick={() => blockMutation.mutate(u.id)}>
                        <UserX size={14} className="mr-1" /> Bloquer
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left p-4 font-medium">Nom</th>
                  <th className="text-left p-4 font-medium">Email</th>
                  <th className="text-left p-4 font-medium">Entreprise</th>
                  <th className="text-left p-4 font-medium">Rôle</th>
                  <th className="text-left p-4 font-medium">Statut</th>
                  <th className="text-left p-4 font-medium">Dernière connexion</th>
                  <th className="text-right p-4 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {users?.map((u: any) => (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="p-4 font-medium">{u.name}</td>
                    <td className="p-4">{u.email}</td>
                    <td className="p-4">{u.organizationName}</td>
                    <td className="p-4"><span className={`px-2 py-1 rounded-full text-xs font-medium ${u.role === 'OWNER' ? 'bg-purple-100 text-purple-700' : u.role === 'SUPERADMIN' ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-600'}`}>{u.role}</span></td>
                    <td className="p-4">
                      {u.blocked ? (
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">Bloqué</span>
                      ) : (
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">Actif</span>
                      )}
                    </td>
                    <td className="p-4 text-muted-foreground">{u.lastLogin ? new Date(u.lastLogin).toLocaleDateString('fr-FR') : 'Jamais'}</td>
                    <td className="p-4 flex gap-2 justify-end">
                      {u.blocked ? (
                        <Button size="sm" variant="outline" onClick={() => unblockMutation.mutate(u.id)}>
                          <UserCheck size={14} className="mr-1" /> Débloquer
                        </Button>
                      ) : (
                        <Button size="sm" variant="destructive" onClick={() => blockMutation.mutate(u.id)}>
                          <UserX size={14} className="mr-1" /> Bloquer
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SupportTicketsTab() {
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [reply, setReply] = useState('');
  const queryClient = useQueryClient();

  const { data: ticketsData } = useQuery({
    queryKey: ['superadmin-support-tickets'],
    queryFn: () => api.get('/support-tickets', { params: { limit: 100 } }).then((r) => r.data),
    refetchInterval: 15000,
  });
  const tickets = ticketsData?.data || [];

  const { data: ticketDetail } = useQuery({
    queryKey: ['superadmin-support-ticket', selectedTicketId],
    queryFn: () => api.get(`/support-tickets/${selectedTicketId}`).then((r) => r.data),
    enabled: Boolean(selectedTicketId),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.patch(`/support-tickets/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['superadmin-support-tickets'] });
      if (selectedTicketId) {
        queryClient.invalidateQueries({ queryKey: ['superadmin-support-ticket', selectedTicketId] });
      }
    },
  });

  const replyMutation = useMutation({
    mutationFn: () => api.post(`/support-tickets/${selectedTicketId}/messages`, { body: reply }),
    onSuccess: () => {
      setReply('');
      queryClient.invalidateQueries({ queryKey: ['superadmin-support-tickets'] });
      if (selectedTicketId) {
        queryClient.invalidateQueries({ queryKey: ['superadmin-support-ticket', selectedTicketId] });
      }
    },
  });

  const badgeClass = (status: string) => {
    if (status === 'OPEN') return 'bg-yellow-100 text-yellow-700';
    if (status === 'IN_PROGRESS') return 'bg-blue-100 text-blue-700';
    if (status === 'WAITING_USER') return 'bg-purple-100 text-purple-700';
    if (status === 'RESOLVED') return 'bg-sky-100 text-sky-700';
    if (status === 'CLOSED') return 'bg-gray-100 text-gray-700';
    return 'bg-gray-100 text-gray-700';
  };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Tickets support</h2>
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Card className="xl:col-span-1">
          <CardHeader>
            <CardTitle>File des tickets</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-[70vh] overflow-auto">
            {tickets.map((ticket: any) => (
              <button
                key={ticket.id}
                onClick={() => setSelectedTicketId(ticket.id)}
                className={`w-full rounded-lg border p-3 text-left ${selectedTicketId === ticket.id ? 'border-leaf bg-leaf/5' : 'hover:bg-muted/40'}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium truncate">{ticket.subject}</p>
                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${badgeClass(ticket.status)}`}>{ticket.status}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {ticket.priority} - {ticket.category} - {ticket.createdBy?.email}
                </p>
              </button>
            ))}
            {tickets.length === 0 && <p className="text-sm text-muted-foreground">Aucun ticket.</p>}
          </CardContent>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>{ticketDetail?.subject || 'Sélectionnez un ticket'}</CardTitle>
          </CardHeader>
          <CardContent>
            {!ticketDetail ? (
              <p className="text-sm text-muted-foreground">Choisissez un ticket pour afficher la conversation.</p>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Select
                    value={ticketDetail.status}
                    onValueChange={(status) => updateMutation.mutate({ id: ticketDetail.id, data: { status } })}
                  >
                    <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="OPEN">OPEN</SelectItem>
                      <SelectItem value="IN_PROGRESS">IN_PROGRESS</SelectItem>
                      <SelectItem value="WAITING_USER">WAITING_USER</SelectItem>
                      <SelectItem value="RESOLVED">RESOLVED</SelectItem>
                      <SelectItem value="CLOSED">CLOSED</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select
                    value={ticketDetail.priority}
                    onValueChange={(priority) => updateMutation.mutate({ id: ticketDetail.id, data: { priority } })}
                  >
                    <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LOW">LOW</SelectItem>
                      <SelectItem value="MEDIUM">MEDIUM</SelectItem>
                      <SelectItem value="HIGH">HIGH</SelectItem>
                      <SelectItem value="URGENT">URGENT</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2 max-h-[420px] overflow-auto pr-1">
                  {ticketDetail.messages?.map((m: any) => (
                    <div key={m.id} className="rounded-lg border p-3">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{m.author?.name || m.author?.email} ({m.author?.role})</span>
                        <span>{new Date(m.createdAt).toLocaleString('fr-FR')}</span>
                      </div>
                      <p className="text-sm mt-2 whitespace-pre-wrap">{m.body}</p>
                    </div>
                  ))}
                </div>

                {ticketDetail.status !== 'CLOSED' && (
                  <div className="space-y-2">
                    <Label>Répondre</Label>
                    <Input value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Réponse au client..." />
                    <Button onClick={() => replyMutation.mutate()} disabled={!reply.trim() || replyMutation.isPending}>
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
    </div>
  );
}

function SettingsTab() {
  const [formData, setFormData] = useState({
    currency: 'TND',
    language: 'fr',
    vatRate: '19',
    smtpHost: '',
    smtpPort: '587',
    smtpUser: '',
    smtpPassword: '',
  });
  const queryClient = useQueryClient();

  const { data: settings } = useQuery({ queryKey: ['admin-settings'], queryFn: () => api.get('/superadmin/settings').then(r => r.data) });

  const updateMutation = useMutation({
    mutationFn: (data: any) => api.put('/superadmin/settings', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-settings'] });
    },
  });

  const handleSubmit = () => {
    updateMutation.mutate(formData);
  };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Paramètres Système</h2>
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Paramètres Généraux</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Devise par défaut</Label>
              <Select value={formData.currency} onValueChange={(v) => setFormData({ ...formData, currency: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="TND">TND (Dinar Tunisien)</SelectItem>
                  <SelectItem value="EUR">EUR (Euro)</SelectItem>
                  <SelectItem value="USD">USD (Dollar US)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Langue par défaut</Label>
              <Select value={formData.language} onValueChange={(v) => setFormData({ ...formData, language: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="fr">Français</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="ar">العربية</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Taux TVA (%)</Label>
              <Input type="number" value={formData.vatRate} onChange={(e) => setFormData({ ...formData, vatRate: e.target.value })} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Configuration SMTP</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Hôte SMTP</Label>
              <Input value={formData.smtpHost} onChange={(e) => setFormData({ ...formData, smtpHost: e.target.value })} placeholder="smtp.gmail.com" />
            </div>
            <div>
              <Label>Port SMTP</Label>
              <Input type="number" value={formData.smtpPort} onChange={(e) => setFormData({ ...formData, smtpPort: e.target.value })} />
            </div>
            <div>
              <Label>Utilisateur SMTP</Label>
              <Input value={formData.smtpUser} onChange={(e) => setFormData({ ...formData, smtpUser: e.target.value })} />
            </div>
            <div>
              <Label>Mot de passe SMTP</Label>
              <Input type="password" value={formData.smtpPassword} onChange={(e) => setFormData({ ...formData, smtpPassword: e.target.value })} />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 flex justify-end">
        <Button onClick={handleSubmit}>
          <SettingsIcon size={16} className="mr-2" /> Sauvegarder
        </Button>
      </div>
    </div>
  );
}
