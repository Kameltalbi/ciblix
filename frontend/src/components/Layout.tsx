import { Link, NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Settings,
  LogOut,
  Menu,
  X,
  Building2,
  Users,
  Globe,
  MessageSquare,
  Crosshair,
  Sparkles,
  Radar,
  Search,
  Bot,
  Plug,
  Target,
  PanelLeftClose,
  PanelLeft,
  Sun,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { api } from '@/lib/api';
import { useOrganizationLogoSrc } from '@/hooks/useOrganizationLogoSrc';
import type { Organization } from '@/types';
import { Notifications } from './Notifications';
import { useMissionStatus } from './mission/MissionGate';
import { useTranslation } from 'react-i18next';
import type { LucideIcon } from 'lucide-react';

type NavItem = {
  to: string;
  labelKey: string;
  icon: LucideIcon;
  page: string;
  section?: string;
  comingSoon?: boolean;
  missionBadge?: boolean;
};

/**
 * Sidebar optimisée — Overview · Agents · Pipeline · Workspace
 * Compte une seule fois en bas ; badge Mission ; collapse manuel.
 */
const NAV_STRUCTURE: NavItem[] = [
  { to: '/aujourdhui', labelKey: 'nav.today', icon: Sun, page: 'aujourdhui', section: 'OVERVIEW' },
  { to: '/dashboard', labelKey: 'nav.dashboard', icon: LayoutDashboard, page: 'dashboard', section: 'OVERVIEW' },
  { to: '/mission', labelKey: 'nav.mission', icon: Target, page: 'mission', section: 'OVERVIEW', missionBadge: true },
  { to: '/prospection-ia', labelKey: 'nav.agentHunt', icon: Crosshair, page: 'prospection-ia', section: 'AGENTS' },
  { to: '/agents/scout-ai', labelKey: 'nav.agentScout', icon: Radar, page: 'scout-ai', section: 'AGENTS' },
  { to: '/agents/analyste-ai', labelKey: 'nav.agentAnalyste', icon: Search, page: 'analyste-ai', section: 'AGENTS' },
  { to: '/ai-assistant', labelKey: 'nav.agentCopilot', icon: Bot, page: 'ai-assistant', section: 'AGENTS' },
  { to: '/contacts', labelKey: 'nav.contacts', icon: Users, page: 'contacts', section: 'PIPELINE' },
  { to: '/connecteurs', labelKey: 'nav.connectors', icon: Plug, page: 'connectors', section: 'WORKSPACE' },
  { to: '/settings', labelKey: 'nav.settings', icon: Settings, page: 'settings', section: 'WORKSPACE' },
  { to: '/support', labelKey: 'nav.support', icon: MessageSquare, page: 'support', section: 'WORKSPACE' },
];

const SIDEBAR_SECTION_ORDER = ['OVERVIEW', 'AGENTS', 'PIPELINE', 'WORKSPACE'] as const;

const SECTION_LABEL_KEYS: Record<string, string> = {
  OVERVIEW: 'nav.sectionOverview',
  AGENTS: 'nav.sectionAgents',
  PIPELINE: 'nav.sectionPipeline',
  WORKSPACE: 'nav.sectionWorkspace',
};

const SIDEBAR_COLLAPSED_KEY = 'ciblix-sidebar-collapsed';

function userInitials(name?: string | null) {
  if (!name?.trim()) return 'U';
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || 'U';
}

export function Layout({ children }: { children: React.ReactNode }) {
  const CONSENT_VERSION = 'v1';
  const CONSENT_STORAGE_KEY = `ciblix-privacy-consent-${CONSENT_VERSION}`;
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { i18n, t } = useTranslation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [consentOpen, setConsentOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const isRTL = (i18n.resolvedLanguage || i18n.language || 'fr').startsWith('ar');
  const { data: missionStatus } = useMissionStatus();

  const cycleAppLanguage = () => {
    const order = ['fr', 'en', 'ar'] as const;
    const raw = i18n.resolvedLanguage || i18n.language || 'fr';
    const current = order.find((l) => raw.startsWith(l)) ?? 'fr';
    const idx = order.indexOf(current);
    void i18n.changeLanguage(order[(idx + 1) % order.length]);
  };

  const rawLang = i18n.resolvedLanguage || i18n.language || 'fr';
  const appLangLabel = rawLang.startsWith('ar') ? 'AR' : rawLang.startsWith('en') ? 'EN' : 'FR';

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem(CONSENT_STORAGE_KEY);
    setConsentOpen(!stored);
  }, []);

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? '1' : '0');
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const { data: organizationsData } = useQuery<Organization | Organization[]>({
    queryKey: ['organizations'],
    queryFn: () => api.get('/organizations').then((r) => r.data),
  });

  const { data: activeSlugsData } = useQuery<{ activeSlugs: string[] }>({
    queryKey: ['agents-active-slugs'],
    queryFn: () => api.get('/agents/active-slugs').then((r) => r.data),
    staleTime: 60_000,
  });

  const { data: permissionsData } = useQuery<any[]>({
    queryKey: ['user-permissions'],
    queryFn: () => api.get('/user-permissions/me').then((r) => r.data),
  });

  const organization = Array.isArray(organizationsData) ? organizationsData[0] : organizationsData;
  const orgLogoSrc = useOrganizationLogoSrc(organization?.logoUrl);

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
        if (permissionsData === undefined) return true;
        if (page === 'dashboard' || page === 'aujourdhui' || page === 'connectors' || page === 'settings' || page === 'mission') return true;
        if (!Array.isArray(permissionsData)) return true;
        const permission = permissionsData.find((p) => p.page === page);
        return permission?.canView ?? false;
      }
      return true;
    },
    [user, permissionsData],
  );

  const activeSlugs = activeSlugsData?.activeSlugs;

  const PAGE_TO_SLUG: Record<string, string> = {
    'prospection-ia': 'hunt-ai',
    contacts: 'copilot-ia',
    'ai-assistant': 'copilot-ia',
    'scout-ai': 'scout-ai',
    'analyste-ai': 'analyste-ai',
  };

  const filteredNav = useMemo(() => {
    return NAV_STRUCTURE.filter((item) => {
      if (!canViewPage(item.page)) return false;
      const slug = PAGE_TO_SLUG[item.page];
      if (slug && activeSlugs && !activeSlugs.includes(slug)) return false;
      return true;
    });
  }, [canViewPage, activeSlugs]);

  const missionBadgeLabel =
    missionStatus && !missionStatus.configured
      ? `${Math.min(7, Math.max(1, missionStatus.step || 1))}/7`
      : null;

  const showAssistantFab = canViewPage('ai-assistant');

  const renderNav = (opts: { expanded: boolean; onNavigate?: () => void }) => (
    <nav className={cn('flex flex-1 flex-col overflow-y-auto overflow-x-hidden', opts.expanded ? 'px-2.5 py-2.5' : 'px-2 py-2.5')}>
      {SIDEBAR_SECTION_ORDER.map((section) => {
        const sectionItems = filteredNav.filter((item) => item.section === section);
        if (sectionItems.length === 0) return null;
        const sectionHeading = t(SECTION_LABEL_KEYS[section]);

        return (
          <div key={section} className="mb-3 flex flex-col gap-0.5">
            {opts.expanded && sectionHeading ? (
              <div className="px-2.5 pb-1.5 pt-1">
                <span className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-[#5B637E]">
                  {sectionHeading}
                </span>
              </div>
            ) : null}
            {sectionItems.map((item) => {
              const { to, labelKey, icon: Icon, comingSoon, missionBadge } = item;
              const badge = missionBadge ? missionBadgeLabel : null;

              return (
                <NavLink
                  key={to}
                  to={to}
                  end={to === '/'}
                  title={!opts.expanded ? t(labelKey) : undefined}
                  onClick={opts.onNavigate}
                  className={({ isActive }) =>
                    cn(
                      'group relative flex items-center rounded-[9px] text-[13.5px] font-medium transition-colors duration-150',
                      opts.expanded ? 'gap-[11px] px-2.5 py-2' : 'justify-center px-0 py-2',
                      isActive
                        ? 'bg-[rgba(59,107,251,0.14)] text-white'
                        : 'text-[#8B93AC] hover:bg-[#1B2540] hover:text-[#E8ECF7]',
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      {isActive && (
                        <span className="absolute bottom-2 left-0 top-2 w-[3px] rounded-r-[3px] bg-[#3B6BFB]" />
                      )}
                      <Icon size={18} className="shrink-0" strokeWidth={isActive ? 2.25 : 1.75} />
                      {opts.expanded && (
                        <span className={cn('min-w-0 flex-1 truncate', comingSoon && !isActive && 'text-[#5B637E]')}>
                          {t(labelKey)}
                        </span>
                      )}
                      {opts.expanded && badge && (
                        <span
                          className={cn(
                            'ml-auto shrink-0 rounded-full px-1.5 py-px text-[10px]',
                            isActive ? 'bg-white/15 text-white' : 'bg-[#1B2540] text-[#8B93AC]',
                          )}
                        >
                          {badge}
                        </span>
                      )}
                      {opts.expanded && comingSoon && (
                        <span className="shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[#5B637E]">
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
    </nav>
  );

  const renderFooter = (opts: { expanded: boolean }) => (
    <div className="border-t border-white/[0.07] p-2.5">
      <div
        className={cn(
          'flex items-center rounded-[9px] px-2 py-2 transition-colors hover:bg-[#1B2540]',
          opts.expanded ? 'gap-2.5' : 'justify-center',
        )}
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#3B6BFB] text-[13px] font-semibold text-white">
          {userInitials(user?.name)}
        </div>
        {opts.expanded && (
          <>
            <div className="min-w-0 flex-1 overflow-hidden">
              <p className="truncate text-[13px] font-semibold text-[#E8ECF7]">{user?.name}</p>
              <p className="truncate text-[11px] text-[#5B637E]">{user?.email}</p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#8B93AC] transition-colors hover:bg-[#1B2540] hover:text-white"
              title={t('common.logout')}
            >
              <LogOut size={16} strokeWidth={2} />
            </button>
          </>
        )}
      </div>
      {opts.expanded && (
        <div className="flex items-center justify-center gap-1.5 px-1 pb-0.5 pt-2 text-[10px] text-[#5B637E]">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#3B6BFB]" aria-hidden />
          {t('nav.poweredBy')}
        </div>
      )}
    </div>
  );

  return (
    <div className={`flex h-screen flex-col bg-background ${isRTL ? 'rtl' : 'ltr'}`}>
      {/* Topbar — date / langue / notifs uniquement (compte = sidebar) */}
      <header className="relative z-[999] sticky top-0 flex h-14 flex-shrink-0 items-center justify-between border-b border-border bg-white px-4 md:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted lg:hidden"
            title={sidebarOpen ? 'Fermer' : 'Menu'}
          >
            {sidebarOpen ? <X size={20} strokeWidth={2} /> : <Menu size={20} strokeWidth={2} />}
          </button>
          <Link to="/dashboard" className="flex min-w-0 items-center gap-3 transition-opacity hover:opacity-80 lg:hidden">
            {organization && orgLogoSrc ? (
              <img
                src={orgLogoSrc}
                alt={organization.name}
                className="h-8 max-h-8 w-auto max-w-[180px] object-contain"
              />
            ) : (
              <span className="font-bold text-lg text-foreground">{organization?.name ?? 'CIBLIX'}</span>
            )}
          </Link>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          <div className="hidden items-center gap-1 rounded-full border border-border bg-muted/50 px-3 py-1 text-[11px] font-medium text-muted-foreground md:inline-flex">
            <span>
              {currentTime.toLocaleDateString(rawLang.startsWith('en') ? 'en-GB' : 'fr-FR', {
                weekday: 'short',
                day: '2-digit',
                month: 'short',
              })}
            </span>
            <span className="mx-1 h-1 w-1 rounded-full bg-border" aria-hidden />
            <span className="text-foreground">
              {currentTime.toLocaleTimeString(rawLang.startsWith('en') ? 'en-GB' : 'fr-FR', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>
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
        </div>
      </header>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Desktop sidebar */}
        <aside
          className={cn(
            'hidden lg:relative lg:z-0 lg:flex lg:flex-shrink-0 lg:flex-col lg:overflow-hidden',
            'border-r border-white/[0.07] bg-[#0F1629] text-[#E8ECF7] transition-[width,min-width] duration-[180ms] ease-out',
            collapsed ? 'lg:w-[72px] lg:min-w-[72px]' : 'lg:w-[264px] lg:min-w-[264px]',
          )}
        >
          <div
            className={cn(
              'flex min-h-14 items-center border-b border-white/[0.07] px-3.5 py-4',
              collapsed ? 'justify-center' : 'gap-2.5',
            )}
          >
            <button
              type="button"
              onClick={toggleCollapsed}
              className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg text-[#8B93AC] transition-colors hover:bg-[#1B2540] hover:text-[#E8ECF7]"
              title={collapsed ? t('nav.expandSidebar') : t('nav.collapseSidebar')}
            >
              {collapsed ? <PanelLeft size={16} /> : <PanelLeftClose size={16} />}
            </button>
            {!collapsed && (
              <button
                type="button"
                onClick={() => {
                  if (user?.role === 'OWNER') navigate('/settings');
                }}
                className="flex min-w-0 flex-1 flex-col overflow-hidden text-left"
              >
                <span className="truncate text-sm font-semibold text-[#E8ECF7]">
                  {organization?.name ?? 'CIBLIX'}
                </span>
                <span className="flex items-center gap-1 truncate text-[11px] text-[#5B637E]">
                  <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[#3B6BFB]" aria-hidden />
                  {t('nav.workspaceSub')}
                </span>
              </button>
            )}
          </div>

          {renderNav({ expanded: !collapsed })}
          {renderFooter({ expanded: !collapsed })}
        </aside>

        {/* Mobile sidebar */}
        <aside
          className={cn(
            'fixed inset-y-0 left-0 z-40 flex w-[264px] flex-col border-r border-white/[0.07] bg-[#0F1629] text-[#E8ECF7] transition-transform duration-300 ease-in-out lg:hidden',
            sidebarOpen ? 'translate-x-0' : '-translate-x-full',
          )}
        >
          <div className="flex min-h-14 items-center gap-2.5 border-b border-white/[0.07] px-3.5 py-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 text-white">
              <Building2 size={18} strokeWidth={2} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-[#E8ECF7]">{organization?.name ?? 'CIBLIX'}</div>
              <div className="flex items-center gap-1 text-[11px] text-[#5B637E]">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#3B6BFB]" aria-hidden />
                {t('nav.workspaceSub')}
              </div>
            </div>
            <button type="button" onClick={() => setSidebarOpen(false)} className="text-[#8B93AC] hover:text-white">
              <X size={20} />
            </button>
          </div>
          {renderNav({ expanded: true, onNavigate: closeSidebarOnMobile })}
          {renderFooter({ expanded: true })}
        </aside>

        {sidebarOpen && (
          <div
            className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm lg:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-hidden
          />
        )}

        <main className="min-h-0 flex-1 overflow-auto bg-[#EEF1F7]">
          <div className="mx-auto max-w-[1400px] px-5 py-6 md:px-8 md:py-8">{children}</div>
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
