import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Briefcase, Users, Settings, LogOut, Menu, X, FileText, Building2, UserCheck, Calendar as CalendarIcon, Receipt, Mail, Sparkles, Target, Globe, MessageSquare, Radio } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { useOrganizationLogoSrc } from '@/hooks/useOrganizationLogoSrc';
import type { Organization } from '@/types';
import { Notifications } from './Notifications';
import { useTranslation } from 'react-i18next';
import { OnboardingChatbot } from './OnboardingChatbot';

const nav = [
  { to: '/dashboard',     label: 'nav.dashboard',     icon: LayoutDashboard, page: 'dashboard' },
  { to: '/prospection-ia', label: 'nav.prospectionIa', icon: Radio, page: 'prospection-ia' },
  { to: '/ai-assistant', label: 'nav.aiAssistant',  icon: Sparkles, page: 'ai-assistant' },
  { to: '/affaires',     label: 'nav.affaires',      icon: Briefcase,       page: 'affaires' },
  { to: '/clients',      label: 'nav.clients',       icon: Users,           page: 'clients' },
  { to: '/leads',        label: 'nav.prospects',     icon: UserCheck,       page: 'leads' },
  { to: '/calendar',     label: 'nav.calendar',      icon: CalendarIcon,    page: 'calendar' },
  { to: '/expenses',     label: 'nav.expenses',      icon: Receipt,         page: 'expenses' },
  { to: '/activites',    label: 'nav.activities',    icon: FileText,        page: 'activites' },
  { to: '/email-templates', label: 'nav.emailTemplates', icon: Mail, page: 'email-templates' },
  { to: '/objectifs',    label: 'nav.objectives',    icon: Target,          page: 'objectifs' },
  { to: '/support',      label: 'nav.support',       icon: MessageSquare,   page: 'support' },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const CONSENT_VERSION = 'v1';
  const CONSENT_STORAGE_KEY = `ciblix-privacy-consent-${CONSENT_VERSION}`;
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { i18n, t } = useTranslation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [consentOpen, setConsentOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const isRTL = i18n.language === 'ar';

  const cycleAppLanguage = () => {
    const order = ['fr', 'en', 'ar'] as const;
    const raw = i18n.resolvedLanguage || i18n.language || 'fr';
    const current = order.find((l) => raw.startsWith(l)) ?? 'fr';
    const idx = order.indexOf(current);
    void i18n.changeLanguage(order[(idx + 1) % order.length]);
  };

  const rawLang = i18n.resolvedLanguage || i18n.language || 'fr';
  const appLangLabel = rawLang.startsWith('ar') ? 'AR' : rawLang.startsWith('en') ? 'EN' : 'FR';

  const sidebarNavText = (page: string, labelKey: string) => {
    if (page === 'clients') {
      const lng = i18n.resolvedLanguage || i18n.language || '';
      if (lng.startsWith('ar')) return 'العملاء';
      return 'Clients';
    }
    return t(labelKey);
  };

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem(CONSENT_STORAGE_KEY);
    setConsentOpen(!stored);
  }, []);

  // Télécharge le chunk Dashboard en parallèle (ex. bandeau RGPD) pour réduire l’attente après acceptation
  useEffect(() => {
    if (user) void import('../pages/Dashboard');
  }, [user]);

  useEffect(() => {
    setSidebarOpen(false);
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

  const acceptConsent = () => {
    localStorage.setItem(
      CONSENT_STORAGE_KEY,
      JSON.stringify({
        accepted: true,
        acceptedAt: new Date().toISOString(),
      })
    );
    setConsentOpen(false);
  };

  const rejectConsent = async () => {
    localStorage.removeItem(CONSENT_STORAGE_KEY);
    setConsentOpen(false);
    await logout();
    navigate('/login');
  };

  // Filter nav items based on user permissions
  const filteredNav = nav.filter(item => {
    // Propriétaire org ou superadmin : menu complet
    if (user?.role === 'OWNER' || user?.role === 'SUPERADMIN') return true;

    // PARTNER has access to everything (read-only)
    if (user?.role === 'PARTNER') return true;
    
    // COMMERCIAL: check specific permissions
    if (user?.role === 'COMMERCIAL') {
      if (item.page === 'support') return true;
      // Prospection IA : même famille que l’assistant ; les anciens profils n’avaient souvent que « ai-assistant »
      if (item.page === 'prospection-ia') {
        const prospecting = permissionsData?.find((p) => p.page === 'prospection-ia');
        const assistant = permissionsData?.find((p) => p.page === 'ai-assistant');
        return Boolean(prospecting?.canView || assistant?.canView);
      }
      const permission = permissionsData?.find(p => p.page === item.page);
      return permission?.canView ?? false;
    }
    
    return true;
  });

  // Check if expenses is accessible
  const expensesAccessible = currentPlan === 'ENTERPRISE';

  return (
    <div
      className={`flex h-screen flex-col bg-kt-mesh ${isRTL ? 'rtl' : 'ltr'}`}
    >
      {/* Topbar structurelle */}
      <header className="relative z-[999] flex h-[3.75rem] flex-shrink-0 items-center justify-between border-b border-white/10 bg-[#1E72B9] px-4 text-white shadow-[0_1px_0_rgba(255,255,255,0.08)] md:px-6">
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/10 text-white shadow-sm transition-smooth hover:bg-white/18 hover:shadow-glow"
            title={sidebarOpen ? 'Fermer la sidebar' : 'Ouvrir la sidebar'}
          >
            {sidebarOpen ? <X size={20} strokeWidth={2} /> : <Menu size={20} strokeWidth={2} />}
          </button>
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            {organization && orgLogoSrc ? (
              <img
                src={orgLogoSrc}
                alt={organization.name}
                className="h-12 max-h-12 w-auto max-w-[min(300px,50vw)] object-contain drop-shadow-sm"
              />
            ) : organization ? (
              <div className="flex min-w-0 items-center gap-2.5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/25">
                  <Building2 size={20} className="text-white" strokeWidth={2} />
                </div>
                <span className="truncate font-semibold tracking-tight text-white sm:text-lg">{organization.name}</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <img src="/logo-ciblix.png" alt="CIBLIX" className="h-24 w-auto sm:h-28" />
              </div>
            )}
          </div>
        </div>
        <div className="hidden flex-1 justify-center px-4 md:flex">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-1.5 text-xs font-medium tabular-nums text-white/90 shadow-sm backdrop-blur-sm">
            <span className="text-white">
              {currentTime.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
            </span>
            <span className="h-1 w-1 rounded-full bg-white/35" aria-hidden />
            <span className="text-white/85">
              {currentTime.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          </div>
        </div>
        <div className="flex flex-shrink-0 items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={cycleAppLanguage}
            className="flex h-10 items-center gap-1.5 rounded-xl border border-white/15 bg-white/10 px-2.5 text-xs font-semibold text-white/90 shadow-sm transition-smooth hover:bg-white/18"
            title="Langue / Language / اللغة"
            aria-label="Changer la langue de l'interface"
          >
            <Globe size={16} strokeWidth={2} className="shrink-0 text-[#BED6F6]" />
            <span className="tabular-nums">{appLangLabel}</span>
          </button>
          <Notifications />
          <div className="flex items-center gap-2 border-l border-white/15 pl-2 sm:pl-3">
            <div className="hidden text-right sm:block">
              <div className="max-w-[140px] truncate text-sm font-semibold leading-tight text-white md:max-w-[200px]">
                {user?.name}
              </div>
              <div className="max-w-[140px] truncate text-xs text-white/70 md:max-w-[220px]">{user?.email}</div>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="flex h-10 w-10 items-center justify-center rounded-xl text-white/80 transition-smooth hover:bg-white/12 hover:text-white"
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
            'fixed z-40 flex h-screen flex-col overflow-hidden border-r border-white/10 bg-[#1E72B9] bg-gradient-to-b from-[#2288c4] via-[#1E72B9] to-[#185f9e] text-white shadow-[6px_0_32px_-8px_rgba(1,106,235,0.35)] transition-[width,transform] duration-300 ease-out',
            // Mobile : tiroir selon sidebarOpen ; desktop (lg+) : barre toujours visible (éviter lg:w-0 qui masquait tout le menu)
            sidebarOpen
              ? 'w-64 translate-x-0 lg:relative lg:z-0 lg:h-auto lg:flex-shrink-0'
              : 'w-64 -translate-x-full lg:relative lg:z-0 lg:h-auto lg:w-64 lg:flex-shrink-0 lg:translate-x-0'
          )}
        >
          <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-5">
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
                      'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-smooth',
                      isDisabled
                        ? 'cursor-not-allowed text-white/35'
                        : isActive
                          ? 'bg-white/16 text-white shadow-nav-active'
                          : 'text-white/78 hover:bg-white/10 hover:text-white'
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      {isActive && !isDisabled ? (
                        <span
                          className="pointer-events-none absolute inset-y-1.5 left-1 w-1 rounded-full bg-[#BED6F6] shadow-[0_0_12px_rgba(190,214,246,0.9)]"
                          aria-hidden
                        />
                      ) : null}
                      <Icon
                        size={18}
                        className={cn(
                          'relative z-[1] shrink-0 transition-transform duration-200 group-hover:scale-[1.03]',
                          isDisabled && 'opacity-50'
                        )}
                        strokeWidth={isActive ? 2.25 : 2}
                      />
                      <span className="relative z-[1] flex-1">{sidebarNavText(page, label)}</span>
                      {isDisabled && (
                        <span className="ml-2 rounded-full bg-[#BED6F6]/95 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#1E72B9]">
                          Pro
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
                      'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-smooth',
                      isActive
                        ? 'bg-white/16 text-white shadow-nav-active'
                        : 'text-white/78 hover:bg-white/10 hover:text-white'
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      {isActive ? (
                        <span
                          className="pointer-events-none absolute inset-y-1.5 left-1 w-1 rounded-full bg-[#BED6F6] shadow-[0_0_12px_rgba(190,214,246,0.9)]"
                          aria-hidden
                        />
                      ) : null}
                      <span
                        className={cn(
                          'relative z-[1] flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-smooth',
                          isActive ? 'bg-white/20 text-white' : 'bg-transparent text-white/85 group-hover:bg-white/12 group-hover:text-white'
                        )}
                      >
                        <Settings size={18} strokeWidth={2} />
                      </span>
                      <span className="relative z-[1] truncate">Paramètres</span>
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

        <main className="min-h-0 flex-1 overflow-auto bg-transparent">
          <div className="mx-auto max-w-[1600px] px-4 py-8 sm:px-6 md:px-10 md:py-10">{children}</div>
        </main>
      </div>

      <OnboardingChatbot />

      {/* Privacy consent (RGPD + Tunisian law) */}
      {consentOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="w-full max-w-2xl rounded-2xl border border-border bg-white p-5 shadow-2xl sm:p-6">
            <h2 className="text-base font-semibold text-foreground sm:text-lg">
              Consentement au traitement des donnees personnelles
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Afin d'utiliser CIBLIX, vous devez donner votre consentement pour le traitement de vos donnees
              personnelles conformement au RGPD et a la loi tunisienne relative a la protection des donnees
              personnelles (notamment la loi organique ndeg2004-63).
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Vos donnees sont utilisees uniquement pour fournir les fonctionnalites CRM, la securite du compte et
              l'amelioration du service.
            </p>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={rejectConsent}
                className="inline-flex h-10 items-center justify-center rounded-lg border border-border px-4 text-sm font-medium text-foreground hover:bg-muted"
              >
                Je refuse
              </button>
              <button
                type="button"
                onClick={acceptConsent}
                className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-95"
              >
                J'accepte
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
