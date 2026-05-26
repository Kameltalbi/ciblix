import { Link, NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Briefcase,
  Users,
  Settings,
  LogOut,
  Menu,
  X,
  FileText,
  Building2,
  UserCheck,
  Calendar as CalendarIcon,
  Receipt,
  Mail,
  Target,
  Globe,
  MessageSquare,
  Radio,
  Sparkles,

  Headphones,
  PieChart,
  Bot,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { api } from '@/lib/api';
import { useOrganizationLogoSrc } from '@/hooks/useOrganizationLogoSrc';
import type { Organization } from '@/types';
import { Notifications } from './Notifications';
import { useTranslation } from 'react-i18next';
import { OnboardingChatbot } from './OnboardingChatbot';
import type { LucideIcon } from 'lucide-react';

type NavItem = {
  to: string;
  labelKey: string;
  icon: LucideIcon;
  page: string;
  requiresEnterprise?: boolean;
  /** Ordre d’affichage des blocs sidebar (voir SIDEBAR_SECTION_ORDER). */
  section?: string;
  comingSoon?: boolean;
};

/**
 * Sidebar — périmètre par lien (audit produit / droits page=… dans Users → permissions commercial)
 *
 * Accueil · tableau de bord (/dashboard)
 * Agents IA · Hunt, Copilot, CommBot, CareBot, CFO (/agents/*)
 * CRM & pipeline · leads, opportunités, contacts
 * Espace de travail · calendrier, activités, emails, objectifs
 * Performance & finance · dépenses (Enterprise)
 * Aide · support
 */
const NAV_STRUCTURE: NavItem[] = [
  /* Accueil */
  { to: '/dashboard', labelKey: 'nav.dashboard', icon: LayoutDashboard, page: 'dashboard', section: 'OVERVIEW' },

  /* Agents IA (automatisations) */
  { to: '/prospection-ia', labelKey: 'nav.agentHunt', icon: Radio, page: 'prospection-ia', section: 'AGENTS' },
  { to: '/ai-assistant', labelKey: 'nav.agentAssistant', icon: Bot, page: 'ai-assistant', section: 'AGENTS' },
  {
    to: '/agents/care-bot',
    labelKey: 'nav.agentCareBot',
    icon: Headphones,
    page: 'care-bot',
    section: 'AGENTS',
    comingSoon: true,
  },
  {
    to: '/agents/cfo-ai',
    labelKey: 'nav.agentCfo',
    icon: PieChart,
    page: 'cfo-ai',
    section: 'AGENTS',
    comingSoon: true,
  },

  /* CRM & pipeline — ordre funnel */
  { to: '/leads', labelKey: 'nav.prospects', icon: UserCheck, page: 'leads', section: 'CRM' },
  { to: '/affaires', labelKey: 'nav.affaires', icon: Briefcase, page: 'affaires', section: 'CRM' },
  { to: '/clients', labelKey: 'nav.clients', icon: Users, page: 'clients', section: 'CRM' },

  { to: '/calendar', labelKey: 'nav.calendar', icon: CalendarIcon, page: 'calendar', section: 'WORKSPACE' },
  { to: '/activites', labelKey: 'nav.activities', icon: FileText, page: 'activites', section: 'WORKSPACE' },
  { to: '/email-templates', labelKey: 'nav.emailTemplates', icon: Mail, page: 'email-templates', section: 'WORKSPACE' },
  { to: '/objectifs', labelKey: 'nav.objectives', icon: Target, page: 'objectifs', section: 'WORKSPACE' },

  { to: '/expenses', labelKey: 'nav.expenses', icon: Receipt, page: 'expenses', requiresEnterprise: true, section: 'ENTERPRISE' },
  { to: '/support', labelKey: 'nav.support', icon: MessageSquare, page: 'support', section: 'SUPPORT' },
];

/** Ordre d’affichage des blocs sidebar (libellés i18n : nav.section*). */
const SIDEBAR_SECTION_ORDER = [
  'OVERVIEW',
  'AGENTS',
  'CRM',
  'WORKSPACE',
  'ENTERPRISE',
  'SUPPORT',
] as const;

const SECTION_LABEL_KEYS: Record<string, string> = {
  OVERVIEW: 'nav.sectionOverview',
  AGENTS: 'nav.sectionAgents',
  CRM: 'nav.sectionCrm',
  WORKSPACE: 'nav.sectionWorkspace',
  ENTERPRISE: 'nav.sectionEnterprise',
  SUPPORT: 'nav.sectionSupport',
};

/** Route courante correspond au lien sidebar (sous-routes incluses sauf `/`). */
function pathMatchesNav(to: string, pathname: string): boolean {
  if (to === '/') return pathname === '/';
  return pathname === to || pathname.startsWith(`${to}/`);
}

export function Layout({ children }: { children: React.ReactNode }) {
  const CONSENT_VERSION = 'v1';
  const CONSENT_STORAGE_KEY = `ciblix-privacy-consent-${CONSENT_VERSION}`;
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { i18n, t } = useTranslation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
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

  const sidebarNavText = (_page: string, labelKey: string) => t(labelKey);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60_000);
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
  }, [location.pathname]);

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

  const canViewPage = useCallback(
    (page: string) => {
      if (!user) return false;
      if (user.role === 'OWNER' || user.role === 'SUPERADMIN' || user.role === 'PARTNER') return true;
      if (user.role === 'COMMERCIAL') {
        if (page === 'support') return true;
        // Tant que l’API des droits n’a pas encore répondu, ne pas masquer toute la nav (sinon sidebar vide).
        // Une fois `[]` ou une liste renvoyée, on applique les `canView` normalement — l’API reste authoritative.
        if (permissionsData === undefined) return true;
        if (
          page === 'prospection-ia' ||
          page === 'ai-assistant' ||
          page === 'comm-bot' ||
          page === 'care-bot' ||
          page === 'cfo-ai'
        ) {
          const prospecting = permissionsData.find((p) => p.page === 'prospection-ia');
          const assistant = permissionsData.find((p) => p.page === 'ai-assistant');
          return Boolean(prospecting?.canView || assistant?.canView);
        }
        const permission = permissionsData.find((p) => p.page === page);
        return permission?.canView ?? false;
      }
      return true;
    },
    [user, permissionsData],
  );

  const expensesAccessible = currentPlan === 'ENTERPRISE';

  const filteredNav = useMemo(() => {
    return NAV_STRUCTURE.filter(
      (item) => (!item.requiresEnterprise || expensesAccessible) && canViewPage(item.page),
    );
  }, [canViewPage, expensesAccessible]);

  const showAssistantFab = canViewPage('ai-assistant');


  return (
    <div
      className={`flex h-screen flex-col bg-background ${isRTL ? 'rtl' : 'ltr'}`}
    >
      {/* Topbar - white, clean, sticky */}
      <header className="relative z-[999] flex h-16 flex-shrink-0 items-center justify-between border-b border-border bg-white px-4 sticky top-0 md:px-6">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <button
            type="button"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted"
            title={sidebarOpen ? 'Fermer la sidebar' : 'Ouvrir la sidebar'}
          >
            {sidebarOpen ? <X size={20} strokeWidth={2} /> : <Menu size={20} strokeWidth={2} />}
          </button>
          <div className="flex min-w-0 items-center gap-3">
            {organization && orgLogoSrc ? (
              <img
                src={orgLogoSrc}
                alt={organization.name}
                className="h-8 max-h-8 w-auto max-w-[200px] object-contain"
              />
            ) : organization ? (
              <div className="flex min-w-0 items-center gap-2">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Building2 size={18} strokeWidth={2} />
                </div>
                <span className="truncate font-semibold text-foreground">{organization.name}</span>
              </div>
            ) : (
              <span className="font-bold text-xl text-foreground">CIBLIX</span>
            )}
          </div>
        </div>
        <div className="hidden flex-1 justify-center px-4 md:flex">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/50 px-4 py-1.5 text-xs font-medium text-muted-foreground">
            <span>
              {currentTime.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
            </span>
            <span className="h-1 w-1 rounded-full bg-border" aria-hidden />
            <span className="text-foreground">
              {currentTime.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={cycleAppLanguage}
            className="flex h-9 items-center gap-2 rounded-lg border border-border px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted"
            title="Langue / Language / اللغة"
            aria-label="Changer la langue de l'interface"
          >
            <Globe size={14} strokeWidth={2} />
            <span>{appLangLabel}</span>
          </button>
          <Notifications />
          <div className="flex items-center gap-3 border-l border-border pl-3">
            <div className="hidden text-right sm:block">
              <div className="max-w-[140px] truncate text-sm font-medium text-foreground">{user?.name}</div>
              <div className="max-w-[140px] truncate text-xs text-muted-foreground">{user?.email}</div>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              title="Déconnexion"
            >
              <LogOut size={18} strokeWidth={2} />
            </button>
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Sidebar — bleu profond, fermée par défaut (icônes), ouvre au hover */}
        <aside
          onMouseEnter={() => setSidebarExpanded(true)}
          onMouseLeave={() => setSidebarExpanded(false)}
          className={cn(
            'hidden lg:relative lg:z-0 lg:flex lg:flex-shrink-0 lg:flex-col lg:overflow-hidden',
            'bg-[#0f1b2d] text-slate-300 transition-[width] duration-300 ease-in-out',
            sidebarExpanded ? 'lg:w-60' : 'lg:w-[68px]',
          )}
        >
          {/* Org header */}
          <div className={cn('flex items-center border-b border-white/10 px-3 py-3', sidebarExpanded ? 'gap-2' : 'justify-center')}>
            <button
              type="button"
              onClick={() => { if (user?.role === 'OWNER') navigate('/settings'); }}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 text-white"
              aria-label={organization?.name ?? 'Workspace'}
              title={organization?.name ?? 'CIBLIX'}
            >
              <Building2 size={18} strokeWidth={2} />
            </button>
            {sidebarExpanded && (
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-white">
                {organization?.name ?? 'CIBLIX'}
              </span>
            )}
          </div>

          {/* Nav links */}
          <nav className="flex flex-1 flex-col gap-1 overflow-y-auto overflow-x-hidden px-2 py-3">
            {SIDEBAR_SECTION_ORDER.map((section) => {
              const sectionItems = filteredNav.filter((item) => item.section === section);
              if (sectionItems.length === 0) return null;
              const sectionHeading = SECTION_LABEL_KEYS[section] ? t(SECTION_LABEL_KEYS[section]) : section;
              const hideSectionHeading = section === 'OVERVIEW' && sectionItems.length <= 1;

              return (
                <div key={section} className="flex flex-col gap-0.5">
                  {!hideSectionHeading && sidebarExpanded && (
                    <div className="px-2 pb-1 pt-3">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                        {sectionHeading}
                      </span>
                    </div>
                  )}
                  {!hideSectionHeading && !sidebarExpanded && section !== 'OVERVIEW' && (
                    <div className="my-1.5 mx-2 border-t border-white/10" />
                  )}
                  {sectionItems.map((item) => {
                    const { to, labelKey, icon: Icon, page, comingSoon } = item;
                    const isExpenses = page === 'expenses';
                    const isDisabled = isExpenses && !expensesAccessible;

                    return (
                      <NavLink
                        key={to}
                        to={isDisabled ? '#' : to}
                        end={to === '/'}
                        onClick={(e) => { if (isDisabled) { e.preventDefault(); return; } }}
                        title={!sidebarExpanded ? t(labelKey) : undefined}
                        className={({ isActive }) =>
                          cn(
                            'group relative flex items-center rounded-lg transition-colors duration-150',
                            sidebarExpanded ? 'gap-3 px-3 py-2' : 'justify-center px-0 py-2',
                            isDisabled
                              ? 'cursor-not-allowed opacity-30'
                              : isActive
                                ? 'bg-white/15 text-white'
                                : 'text-slate-400 hover:bg-white/10 hover:text-white',
                          )
                        }
                      >
                        {({ isActive }) => (
                          <>
                            {isActive && (
                              <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-blue-400" />
                            )}
                            <Icon
                              size={20}
                              className="shrink-0"
                              strokeWidth={isActive ? 2.25 : 1.75}
                            />
                            {sidebarExpanded && (
                              <span className={cn('flex-1 truncate text-sm font-medium', comingSoon && !isActive && 'text-slate-500')}>
                                {sidebarNavText(page, labelKey)}
                              </span>
                            )}
                            {sidebarExpanded && comingSoon && (
                              <span className="shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-slate-500">
                                {t('nav.comingSoon')}
                              </span>
                            )}
                          </>
                        )}
                      </NavLink>
                    );
                  })}
                </div>
              );
            })}
            {user?.role === 'OWNER' && (
              <>
                <div className="my-1.5 mx-2 border-t border-white/10" />
                <NavLink
                  to="/settings"
                  title={!sidebarExpanded ? t('nav.settings') : undefined}
                  className={({ isActive }) =>
                    cn(
                      'group relative flex items-center rounded-lg transition-colors duration-150',
                      sidebarExpanded ? 'gap-3 px-3 py-2' : 'justify-center px-0 py-2',
                      isActive ? 'bg-white/15 text-white' : 'text-slate-400 hover:bg-white/10 hover:text-white',
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      {isActive && <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-blue-400" />}
                      <Settings size={20} strokeWidth={isActive ? 2.25 : 1.75} />
                      {sidebarExpanded && <span className="flex-1 text-sm font-medium">{t('nav.settings')}</span>}
                    </>
                  )}
                </NavLink>
              </>
            )}
          </nav>

          {/* User profile at bottom */}
          <div className="border-t border-white/10 p-2">
            <div className={cn('flex items-center rounded-lg px-2 py-2 transition-colors hover:bg-white/10', sidebarExpanded ? 'gap-3' : 'justify-center')}>
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-semibold text-white">
                {user?.name?.charAt(0).toUpperCase() || 'U'}
              </div>
              {sidebarExpanded && (
                <>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <p className="truncate text-sm font-medium text-white">{user?.name}</p>
                    <p className="truncate text-xs text-slate-500">{user?.email}</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
                    title="Déconnexion"
                  >
                    <LogOut size={16} strokeWidth={2} />
                  </button>
                </>
              )}
            </div>
          </div>
        </aside>

        {/* Mobile sidebar — overlay plein */}
        <aside
          className={cn(
            'fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-[#0f1b2d] text-slate-300 transition-transform duration-300 ease-in-out lg:hidden',
            sidebarOpen ? 'translate-x-0' : '-translate-x-full',
          )}
        >
          <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 text-white">
              <Building2 size={18} strokeWidth={2} />
            </div>
            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-white">
              {organization?.name ?? 'CIBLIX'}
            </span>
            <button type="button" onClick={() => setSidebarOpen(false)} className="text-slate-400 hover:text-white">
              <X size={20} />
            </button>
          </div>
          <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-3">
            {SIDEBAR_SECTION_ORDER.map((section) => {
              const sectionItems = filteredNav.filter((item) => item.section === section);
              if (sectionItems.length === 0) return null;
              const sectionHeading = SECTION_LABEL_KEYS[section] ? t(SECTION_LABEL_KEYS[section]) : section;
              const hideSectionHeading = section === 'OVERVIEW' && sectionItems.length <= 1;

              return (
                <div key={section} className="flex flex-col gap-0.5">
                  {!hideSectionHeading && (
                    <div className="px-2 pb-1 pt-3">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{sectionHeading}</span>
                    </div>
                  )}
                  {sectionItems.map((item) => {
                    const { to, labelKey, icon: Icon, page, comingSoon } = item;
                    const isExpenses = page === 'expenses';
                    const isDisabled = isExpenses && !expensesAccessible;
                    return (
                      <NavLink
                        key={to}
                        to={isDisabled ? '#' : to}
                        end={to === '/'}
                        onClick={(e) => { if (isDisabled) { e.preventDefault(); return; } closeSidebarOnMobile(); }}
                        className={({ isActive }) =>
                          cn(
                            'group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150',
                            isDisabled ? 'cursor-not-allowed opacity-30'
                              : isActive ? 'bg-white/15 text-white'
                              : 'text-slate-400 hover:bg-white/10 hover:text-white',
                          )
                        }
                      >
                        {({ isActive }) => (
                          <>
                            {isActive && <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-blue-400" />}
                            <Icon size={20} strokeWidth={isActive ? 2.25 : 1.75} />
                            <span className={cn('flex-1 truncate', comingSoon && !isActive && 'text-slate-500')}>
                              {sidebarNavText(page, labelKey)}
                            </span>
                            {comingSoon && (
                              <span className="shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-[9px] font-bold uppercase text-slate-500">
                                {t('nav.comingSoon')}
                              </span>
                            )}
                          </>
                        )}
                      </NavLink>
                    );
                  })}
                </div>
              );
            })}
            {user?.role === 'OWNER' && (
              <>
                <div className="my-1.5 mx-2 border-t border-white/10" />
                <NavLink
                  to="/settings"
                  onClick={closeSidebarOnMobile}
                  className={({ isActive }) =>
                    cn(
                      'group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150',
                      isActive ? 'bg-white/15 text-white' : 'text-slate-400 hover:bg-white/10 hover:text-white',
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      {isActive && <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-blue-400" />}
                      <Settings size={20} strokeWidth={isActive ? 2.25 : 1.75} />
                      <span className="flex-1">{t('nav.settings')}</span>
                    </>
                  )}
                </NavLink>
              </>
            )}
          </nav>
          <div className="border-t border-white/10 p-3">
            <div className="flex items-center gap-3 rounded-lg px-2 py-2">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-semibold text-white">
                {user?.name?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div className="flex min-w-0 flex-1 flex-col">
                <p className="truncate text-sm font-medium text-white">{user?.name}</p>
                <p className="truncate text-xs text-slate-500">{user?.email}</p>
              </div>
              <button type="button" onClick={handleLogout} className="text-slate-400 hover:text-white" title="Déconnexion">
                <LogOut size={16} strokeWidth={2} />
              </button>
            </div>
          </div>
        </aside>

        {/* Overlay for mobile */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm lg:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-hidden
          />
        )}

        <main className="min-h-0 flex-1 overflow-auto bg-slate-50">
          <div className="mx-auto max-w-[1600px] px-6 py-8 md:px-8 md:py-10 lg:px-10">{children}</div>
        </main>
      </div>

      {showAssistantFab ? (
        <button
          type="button"
          className="fixed bottom-24 end-5 z-[130] flex h-14 w-14 items-center justify-center rounded-full border border-[#BED6F6]/60 bg-white text-[#1E72B9] shadow-xl shadow-[#1E72B9]/25 transition-smooth hover:scale-[1.04] hover:bg-[#eef4fc] sm:bottom-28 sm:end-6"
          title={t('nav.floatingAssistant')}
          aria-label={t('nav.floatingAssistant')}
          onClick={() => {
            void navigate('/ai-assistant');
            closeSidebarOnMobile();
          }}
        >
          <Sparkles size={24} strokeWidth={2} className="text-[#0071DD]" />
        </button>
      ) : null}

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
              Vos donnees sont utilisees uniquement pour fournir les fonctionnalites de la plateforme CIBLIX (prospection et opportunites assistees par IA), la securite du compte et
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
