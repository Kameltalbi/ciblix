import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Briefcase, Users, Settings, LogOut, Menu, X, FileText, Building2, UserCheck, Calendar as CalendarIcon, Receipt, Mail, Sparkles, Target, Globe, MessageSquare } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { useOrganizationLogoSrc } from '@/hooks/useOrganizationLogoSrc';
import type { Organization } from '@/types';
import { Notifications } from './Notifications';
import { useTranslation } from 'react-i18next';

const nav = [
  { to: '/dashboard',     label: 'nav.dashboard',     icon: LayoutDashboard, page: 'dashboard' },
  { to: '/affaires',     label: 'nav.affaires',      icon: Briefcase,       page: 'affaires' },
  { to: '/clients',      label: 'nav.clients',       icon: Users,           page: 'clients' },
  { to: '/leads',        label: 'nav.prospects',     icon: UserCheck,       page: 'leads' },
  { to: '/calendar',     label: 'nav.calendar',      icon: CalendarIcon,    page: 'calendar' },
  { to: '/expenses',     label: 'nav.expenses',      icon: Receipt,         page: 'expenses' },
  { to: '/activites',    label: 'nav.activities',    icon: FileText,        page: 'activites' },
  { to: '/email-templates', label: 'nav.emailTemplates', icon: Mail, page: 'email-templates' },
  { to: '/ai-assistant', label: 'nav.aiAssistant',  icon: Sparkles, page: 'ai-assistant' },
  { to: '/objectifs',    label: 'nav.objectives',    icon: Target,          page: 'objectifs' },
  { to: '/support',      label: 'nav.support',       icon: MessageSquare,   page: 'support' },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { i18n, t } = useTranslation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const isRTL = i18n.language === 'ar';

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const { data: organizationsData } = useQuery<Organization | Organization[]>({
    queryKey: ['organizations'],
    queryFn: () => api.get('/organizations').then((r) => r.data),
  });

  const { data: subscriptionData } = useQuery({
    queryKey: ['current-subscription'],
    queryFn: () => api.get('/subscriptions/current').then(r => r.data),
  });

  const { data: permissionsData } = useQuery<any[]>({
    queryKey: ['user-permissions'],
    queryFn: () => api.get('/user-permissions/me').then((r) => r.data),
  });

  const organization = Array.isArray(organizationsData) ? organizationsData[0] : organizationsData;
  const orgLogoSrc = useOrganizationLogoSrc(organization?.logoUrl);
  const currentPlan = subscriptionData?.plan || 'FREE';

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const closeSidebarOnMobile = () => {
    if (window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
  };

  // Filter nav items based on user permissions
  const filteredNav = nav.filter(item => {
    // OWNER has access to everything
    if (user?.role === 'OWNER') return true;
    
    // PARTNER has access to everything (read-only)
    if (user?.role === 'PARTNER') return true;
    
    // COMMERCIAL: check specific permissions
    if (user?.role === 'COMMERCIAL') {
      if (item.page === 'support') return true;
      const permission = permissionsData?.find(p => p.page === item.page);
      return permission?.canView ?? false;
    }
    
    return true;
  });

  // Check if expenses is accessible
  const expensesAccessible = currentPlan === 'ENTERPRISE';

  return (
    <div className={`flex h-screen flex-col bg-gradient-to-br from-background via-background to-muted/50 ${isRTL ? 'rtl' : 'ltr'}`}>
      {/* Header */}
      <header className="relative z-[999] flex h-[3.75rem] flex-shrink-0 items-center justify-between border-b border-border/60 bg-white/85 px-4 shadow-[0_1px_0_rgba(0,0,0,0.04)] backdrop-blur-md md:px-6">
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-white text-foreground shadow-sm transition-colors hover:bg-muted/80 hover:border-border"
            title={sidebarOpen ? 'Fermer la sidebar' : 'Ouvrir la sidebar'}
          >
            {sidebarOpen ? <X size={20} strokeWidth={2} /> : <Menu size={20} strokeWidth={2} />}
          </button>
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            {organization && orgLogoSrc ? (
              <img
                src={orgLogoSrc}
                alt={organization.name}
                className="h-12 max-h-12 w-auto max-w-[min(300px,50vw)] object-contain"
              />
            ) : organization ? (
              <div className="flex min-w-0 items-center gap-2.5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/12 ring-1 ring-primary/15">
                  <Building2 size={20} className="text-primary" strokeWidth={2} />
                </div>
                <span className="truncate font-semibold tracking-tight text-foreground sm:text-lg">{organization.name}</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <img src="/logo.png" alt="ktOptima" className="h-9 w-auto sm:h-10" />
                <span className="text-lg font-bold tracking-tight text-foreground sm:text-xl">CRM</span>
              </div>
            )}
          </div>
        </div>
        <div className="hidden flex-1 justify-center px-4 md:flex">
          <div className="inline-flex items-center gap-2 rounded-full border border-border/50 bg-muted/40 px-4 py-1.5 text-xs font-medium tabular-nums text-muted-foreground shadow-sm">
            <span className="text-foreground/80">
              {currentTime.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
            </span>
            <span className="h-1 w-1 rounded-full bg-border" aria-hidden />
            <span>
              {currentTime.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          </div>
        </div>
        <div className="flex flex-shrink-0 items-center gap-1.5 sm:gap-2">
          <Notifications />
          <div className="flex items-center gap-2 border-l border-border/60 pl-2 sm:pl-3">
            <div className="hidden text-right sm:block">
              <div className="max-w-[140px] truncate text-sm font-semibold leading-tight text-foreground md:max-w-[200px]">
                {user?.name}
              </div>
              <div className="max-w-[140px] truncate text-xs text-muted-foreground md:max-w-[220px]">{user?.email}</div>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="flex h-10 w-10 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
              title="Déconnexion"
            >
              <LogOut size={18} strokeWidth={2} />
            </button>
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside
          className={cn(
            'fixed z-40 flex h-screen flex-col overflow-hidden border-r border-white/10 bg-gradient-to-b from-primary via-primary to-[hsl(148,58%,17%)] text-white shadow-[4px_0_24px_-4px_rgba(0,0,0,0.12)] transition-[width,transform] duration-300 ease-out lg:relative lg:h-auto',
            sidebarOpen ? 'w-64 translate-x-0' : 'w-64 -translate-x-full lg:w-0 lg:translate-x-0'
          )}
        >
          <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 py-4">
            {filteredNav.map(({ to, label, icon: Icon, page }) => {
              const isExpenses = page === 'expenses';
              const isDisabled = isExpenses && !expensesAccessible;
              
              return (
                <NavLink
                  key={to}
                  to={isDisabled ? '#' : to}
                  end={to === '/'}
                  onClick={(e) => {
                    if (isDisabled) {
                      e.preventDefault();
                      // Optionally show upgrade dialog or redirect to pricing
                      return;
                    }
                    closeSidebarOnMobile();
                  }}
                  className={({ isActive }) =>
                    cn(
                      'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200',
                      isDisabled
                        ? 'text-white/40 cursor-not-allowed'
                        : isActive
                        ? 'bg-white/18 text-white shadow-sm ring-1 ring-white/25'
                        : 'text-white/75 hover:bg-white/10 hover:text-white'
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <Icon size={18} className={cn('shrink-0', isDisabled && 'opacity-50')} />
                      <span className="flex-1">{t(label)}</span>
                      {isDisabled && (
                        <span className="ml-2 rounded-full bg-amber-400/90 px-2 py-0.5 text-xs font-semibold text-amber-900">
                          Upgrade
                        </span>
                      )}
                    </>
                  )}
                </NavLink>
              );
            })}
            {user?.role === 'OWNER' && (
              <>
                <div className="my-3 border-t border-white/15" />
                <NavLink
                  to="/settings"
                  onClick={closeSidebarOnMobile}
                  className={({ isActive }) =>
                    cn(
                      'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200',
                      isActive
                        ? 'bg-white/18 text-white shadow-sm ring-1 ring-white/25'
                        : 'text-white/75 hover:bg-white/10 hover:text-white'
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <span
                        className={cn(
                          'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors',
                          isActive ? 'bg-white/20 text-white' : 'bg-white/0 text-white/80 group-hover:bg-white/10 group-hover:text-white'
                        )}
                      >
                        <Settings size={18} strokeWidth={2} />
                      </span>
                      <span className="truncate">Paramètres</span>
                    </>
                  )}
                </NavLink>
              </>
            )}
          </nav>
        </aside>

        {/* Overlay for mobile */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-30 bg-black/45 backdrop-blur-[2px] lg:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-hidden
          />
        )}

        <main className="min-h-0 flex-1 overflow-auto bg-muted/25">
          <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 md:px-8 md:py-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
