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
  Megaphone,
  Headphones,
  PieChart,
  Bot,
  ChevronDown,
  ChevronRight,
  Plus,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
    to: '/agents/comm-bot',
    labelKey: 'nav.agentCommBot',
    icon: Megaphone,
    page: 'comm-bot',
    section: 'AGENTS',
    comingSoon: true,
  },
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

  const [sidebarHoveredSection, setSidebarHoveredSection] = useState<string | null>(null);
  const [sidebarPinnedSection, setSidebarPinnedSection] = useState<string | null>(null);
  const sidebarSectionLeaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const toggleSidebarSectionPin = useCallback((section: string) => {
    setSidebarPinnedSection((prev) => (prev === section ? null : section));
  }, []);

  const clearSidebarSectionLeaveTimer = useCallback(() => {
    if (sidebarSectionLeaveTimerRef.current) {
      clearTimeout(sidebarSectionLeaveTimerRef.current);
      sidebarSectionLeaveTimerRef.current = null;
    }
  }, []);

  const onSidebarSectionEnter = useCallback(
    (section: string) => {
      clearSidebarSectionLeaveTimer();
      setSidebarHoveredSection(section);
    },
    [clearSidebarSectionLeaveTimer],
  );

  const onSidebarSectionLeave = useCallback(() => {
    clearSidebarSectionLeaveTimer();
    sidebarSectionLeaveTimerRef.current = setTimeout(() => {
      setSidebarHoveredSection(null);
    }, 240);
  }, [clearSidebarSectionLeaveTimer]);

  useEffect(() => () => clearSidebarSectionLeaveTimer(), [clearSidebarSectionLeaveTimer]);

  const [sidebarExpandAllSections, setSidebarExpandAllSections] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(hover: none)');
    const sync = () => setSidebarExpandAllSections(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  const sidebarSectionsWithActiveLink = useMemo(() => {
    const active = new Set<string>();
    for (const item of filteredNav) {
      if (!item.section) continue;
      if (pathMatchesNav(item.to, location.pathname)) {
        active.add(item.section);
      }
    }
    return active;
  }, [filteredNav, location.pathname]);

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
        {/* Sidebar — sections Accueil / Agents IA / CRM / Workspace / Finance / Aide */}
        <aside
          className={cn(
            'fixed z-40 flex h-screen flex-col overflow-hidden border-r border-neutral-200 bg-white text-neutral-700 shadow-sm transition-[width,transform] duration-300 ease-out',
            sidebarOpen
              ? 'w-56 translate-x-0 lg:relative lg:z-0 lg:h-auto lg:flex-shrink-0'
              : 'w-56 -translate-x-full lg:relative lg:z-0 lg:h-auto lg:w-56 lg:flex-shrink-0 lg:translate-x-0'
          )}
        >
          <div className="flex items-center gap-1 border-b border-neutral-200 px-2 py-3">
            <button
              type="button"
              onClick={() => {
                if (user?.role === 'OWNER') navigate('/settings');
              }}
              className={cn(
                'flex min-w-0 flex-1 items-center gap-2 rounded-xl px-2 py-2 text-left transition-colors hover:bg-neutral-100',
                user?.role !== 'OWNER' && 'cursor-default hover:bg-transparent',
              )}
              aria-label={organization?.name ?? 'Workspace'}
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-700">
                <Building2 size={16} strokeWidth={2} />
              </div>
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-neutral-900">
                {organization?.name ?? 'CIBLIX'}
              </span>
              <ChevronDown size={16} className="shrink-0 text-neutral-400" aria-hidden />
            </button>
            <Link
              to="/affaires"
              onClick={closeSidebarOnMobile}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-neutral-600 transition-colors hover:bg-neutral-100"
              title={t('nav.affaires')}
              aria-label={t('nav.affaires')}
            >
              <Plus size={18} strokeWidth={2} />
            </Link>
          </div>
          <nav className="flex flex-1 flex-col gap-2 overflow-y-auto px-3 py-4">
            {SIDEBAR_SECTION_ORDER.map((section) => {
              const sectionItems = filteredNav.filter((item) => item.section === section);
              if (sectionItems.length === 0) return null;

              const sectionHeading = SECTION_LABEL_KEYS[section] ? t(SECTION_LABEL_KEYS[section]) : section;
              const hideSectionHeading = section === 'OVERVIEW' && sectionItems.length <= 1;
              const collapsible = !hideSectionHeading && !sidebarExpandAllSections;
              const expanded =
                !collapsible ||
                hideSectionHeading ||
                sidebarHoveredSection === section ||
                sidebarSectionsWithActiveLink.has(section) ||
                sidebarPinnedSection === section;

              return (
                <div
                  key={section}
                  role={collapsible ? 'group' : undefined}
                  aria-label={collapsible ? sectionHeading : undefined}
                  className="flex flex-col gap-2 rounded-xl"
                  onMouseEnter={() => collapsible && onSidebarSectionEnter(section)}
                  onMouseLeave={() => collapsible && onSidebarSectionLeave()}
                >
                  {!hideSectionHeading &&
                    (collapsible ? (
                      <button
                        type="button"
                        className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left transition-colors hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
                        aria-expanded={expanded}
                        onClick={() => toggleSidebarSectionPin(section)}
                      >
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                          {sectionHeading}
                        </span>
                        <ChevronRight
                          size={16}
                          strokeWidth={2}
                          className={cn(
                            'shrink-0 text-neutral-400 transition-transform duration-200',
                            expanded && 'rotate-90',
                          )}
                          aria-hidden
                        />
                      </button>
                    ) : (
                      <div className="flex w-full items-center justify-between px-3 py-2">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                          {sectionHeading}
                        </span>
                      </div>
                    ))}
                  <div
                    className={cn('flex flex-col gap-2', collapsible && !expanded && 'hidden')}
                    aria-hidden={collapsible ? !expanded : undefined}
                  >
                    {sectionItems.map((item) => {
                      const { to, labelKey, icon: Icon, page, comingSoon } = item;
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
                              return;
                            }
                            closeSidebarOnMobile();
                          }}
                          className={({ isActive }) =>
                            cn(
                              'group relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors duration-200',
                              isDisabled
                                ? 'cursor-not-allowed opacity-40'
                                : isActive
                                  ? 'bg-neutral-100 text-neutral-900'
                                  : comingSoon
                                    ? 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900'
                                    : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900',
                            )
                          }
                        >
                          {({ isActive }) => (
                            <>
                              {isActive && (
                                <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-primary/90" />
                              )}
                              <Icon
                                size={18}
                                className={cn(
                                  'shrink-0',
                                  isDisabled && 'opacity-50',
                                  comingSoon && !isActive && 'opacity-80',
                                )}
                                strokeWidth={isActive ? 2.25 : 2}
                              />
                              <span className={cn('flex-1', comingSoon && !isActive && 'text-neutral-500')}>
                                {sidebarNavText(page, labelKey)}
                              </span>
                              {comingSoon && (
                                <span className="shrink-0 rounded-full bg-neutral-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-neutral-500 ring-1 ring-neutral-200/80">
                                  {t('nav.comingSoon')}
                                </span>
                              )}
                              {isDisabled && (
                                <span className="ml-2 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                                  Pro
                                </span>
                              )}
                            </>
                          )}
                        </NavLink>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            {user?.role === 'OWNER' && (
              <>
                <div className="my-2 border-t border-neutral-200" />
                <NavLink
                  to="/settings"
                  onClick={closeSidebarOnMobile}
                  className={({ isActive }) =>
                    cn(
                      'group relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors duration-200',
                      isActive
                        ? 'bg-neutral-100 text-neutral-900'
                        : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900',
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      {isActive && (
                        <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-primary/90" />
                      )}
                      <Settings size={18} strokeWidth={2} />
                      <span className="flex-1">{t('nav.settings')}</span>
                    </>
                  )}
                </NavLink>
              </>
            )}
          </nav>

          {/* User profile at bottom */}
          <div className="border-t border-neutral-200 p-3">
            <div className="flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-neutral-50">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-sm font-semibold text-neutral-800">
                {user?.name?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div className="flex min-w-0 flex-1 flex-col">
                <p className="truncate text-sm font-medium text-neutral-900">{user?.name}</p>
                <p className="truncate text-xs text-neutral-500">{user?.email}</p>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
                title="Déconnexion"
              >
                <LogOut size={16} strokeWidth={2} />
              </button>
            </div>
          </div>
        </aside>

        {/* Overlay for mobile */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-30 bg-black/45 backdrop-blur-[2px] lg:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-hidden
          />
        )}

        <main className="min-h-0 flex-1 overflow-auto bg-background">
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
