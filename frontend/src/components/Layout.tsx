import { NavLink, useNavigate, useLocation } from 'react-router-dom';
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
  Sparkles,
  Target,
  Globe,
  MessageSquare,
  Radio,
  ChevronDown,
  LayoutGrid,
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

type NavChild = { to: string; labelKey: string; icon: LucideIcon; page: string; requiresEnterprise?: boolean };
type NavGroup = { type: 'group'; id: string; labelKey: string; icon: LucideIcon; children: NavChild[] };
type NavLinkItem = { type: 'link'; to: string; labelKey: string; icon: LucideIcon; page: string };
type NavItem = NavLinkItem | NavGroup;

const NAV_STRUCTURE: NavItem[] = [
  { type: 'link', to: '/dashboard', labelKey: 'nav.viewIA', icon: LayoutDashboard, page: 'dashboard' },
  { type: 'link', to: '/prospection-ia', labelKey: 'nav.prospection', icon: Radio, page: 'prospection-ia' },
  { type: 'link', to: '/affaires', labelKey: 'nav.affaires', icon: Briefcase, page: 'affaires' },
  {
    type: 'group',
    id: 'contacts',
    labelKey: 'nav.sectionContacts',
    icon: Users,
    children: [
      { to: '/clients', labelKey: 'nav.clients', icon: Users, page: 'clients' },
      { to: '/leads', labelKey: 'nav.prospects', icon: UserCheck, page: 'leads' },
    ],
  },
  {
    type: 'group',
    id: 'tools',
    labelKey: 'nav.sectionTools',
    icon: LayoutGrid,
    children: [
      { to: '/calendar', labelKey: 'nav.calendar', icon: CalendarIcon, page: 'calendar' },
      { to: '/activites', labelKey: 'nav.activities', icon: FileText, page: 'activites' },
      { to: '/email-templates', labelKey: 'nav.emailTemplates', icon: Mail, page: 'email-templates' },
      { to: '/objectifs', labelKey: 'nav.objectives', icon: Target, page: 'objectifs' },
      { to: '/expenses', labelKey: 'nav.expenses', icon: Receipt, page: 'expenses', requiresEnterprise: true },
      { to: '/support', labelKey: 'nav.support', icon: MessageSquare, page: 'support' },
    ],
  },
];

const TOOLS_PATH_PREFIXES = [
  '/calendar',
  '/activites',
  '/email-templates',
  '/objectifs',
  '/expenses',
  '/support',
] as const;

export function Layout({ children }: { children: React.ReactNode }) {
  const CONSENT_VERSION = 'v1';
  const CONSENT_STORAGE_KEY = `ciblix-privacy-consent-${CONSENT_VERSION}`;
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { i18n, t } = useTranslation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [navGroupsOpen, setNavGroupsOpen] = useState<Record<string, boolean>>({ contacts: false, tools: false });
  const prevInContactsSection = useRef(false);
  const prevInToolsSection = useRef(false);
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
        if (page === 'prospection-ia') {
          const prospecting = permissionsData?.find((p) => p.page === 'prospection-ia');
          const assistant = permissionsData?.find((p) => p.page === 'ai-assistant');
          return Boolean(prospecting?.canView || assistant?.canView);
        }
        const permission = permissionsData?.find((p) => p.page === page);
        return permission?.canView ?? false;
      }
      return true;
    },
    [user, permissionsData],
  );

  const expensesAccessible = currentPlan === 'ENTERPRISE';

  const filteredNav = useMemo(() => {
    const out: NavItem[] = [];
    for (const item of NAV_STRUCTURE) {
      if (item.type === 'link') {
        if (canViewPage(item.page)) out.push(item);
        continue;
      }
      const children = item.children.filter(
        (ch) => (!ch.requiresEnterprise || expensesAccessible) && canViewPage(ch.page),
      );
      if (children.length > 0) out.push({ ...item, children });
    }
    return out;
  }, [canViewPage, expensesAccessible]);

  const showAssistantFab = canViewPage('ai-assistant');

  useEffect(() => {
    const p = location.pathname;
    const inContacts = p.startsWith('/clients') || p.startsWith('/leads');
    const inTools = TOOLS_PATH_PREFIXES.some((prefix) => p === prefix || p.startsWith(`${prefix}/`));

    setNavGroupsOpen((prev) => {
      const next = { ...prev };
      if (inContacts && !prevInContactsSection.current) next.contacts = true;
      if (!inContacts) next.contacts = false;
      if (inTools && !prevInToolsSection.current) next.tools = true;
      if (!inTools) next.tools = false;
      return next;
    });
    prevInContactsSection.current = inContacts;
    prevInToolsSection.current = inTools;
  }, [location.pathname]);

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
            {filteredNav.map((entry) => {
              if (entry.type === 'link') {
                const { to, labelKey, icon: Icon, page } = entry;
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
                        'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-smooth',
                        isDisabled
                          ? 'cursor-not-allowed text-white/35'
                          : isActive
                            ? 'bg-white/16 text-white shadow-nav-active'
                            : 'text-white/78 hover:bg-white/10 hover:text-white',
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {isActive && !isDisabled ? (
                          <span
                            className="pointer-events-none absolute inset-y-1.5 start-1 w-1 rounded-full bg-[#BED6F6] shadow-[0_0_12px_rgba(190,214,246,0.9)]"
                            aria-hidden
                          />
                        ) : null}
                        <Icon
                          size={18}
                          className={cn(
                            'relative z-[1] shrink-0 transition-transform duration-200 group-hover:scale-[1.03]',
                            isDisabled && 'opacity-50',
                          )}
                          strokeWidth={isActive ? 2.25 : 2}
                        />
                        <span className="relative z-[1] flex-1">{sidebarNavText(page, labelKey)}</span>
                        {isDisabled && (
                          <span className="ms-2 rounded-full bg-[#BED6F6]/95 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#1E72B9]">
                            Pro
                          </span>
                        )}
                      </>
                    )}
                  </NavLink>
                );
              }

              const open = navGroupsOpen[entry.id] ?? false;
              const GroupIcon = entry.icon;
              const anyChildActive = entry.children.some(
                (c) => location.pathname === c.to || location.pathname.startsWith(`${c.to}/`),
              );

              return (
                <div key={entry.id} className="flex flex-col gap-0.5">
                  <button
                    type="button"
                    aria-expanded={open}
                    onClick={() => setNavGroupsOpen((s) => ({ ...s, [entry.id]: !open }))}
                    className={cn(
                      'group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-start text-sm font-medium transition-smooth',
                      anyChildActive && !open
                        ? 'bg-white/10 text-white'
                        : 'text-white/78 hover:bg-white/10 hover:text-white',
                    )}
                  >
                    {anyChildActive ? (
                      <span
                        className="pointer-events-none absolute inset-y-1.5 start-1 w-1 rounded-full bg-[#BED6F6]/70 shadow-[0_0_10px_rgba(190,214,246,0.6)]"
                        aria-hidden
                      />
                    ) : null}
                    <GroupIcon size={18} className="relative z-[1] shrink-0" strokeWidth={2} />
                    <span className="relative z-[1] flex-1">{t(entry.labelKey)}</span>
                    <ChevronDown
                      size={16}
                      className={cn(
                        'relative z-[1] shrink-0 text-white/70 transition-transform duration-200',
                        open && 'rotate-180',
                      )}
                      aria-hidden
                    />
                  </button>
                  {open ? (
                    <div className="ms-1 flex flex-col gap-0.5 border-s border-white/15 ps-2">
                      {entry.children.map((child) => {
                        const isExpenses = child.page === 'expenses';
                        const isDisabled = isExpenses && !expensesAccessible;
                        const ChildIcon = child.icon;

                        return (
                          <NavLink
                            key={child.to}
                            to={isDisabled ? '#' : child.to}
                            onClick={(e) => {
                              if (isDisabled) {
                                e.preventDefault();
                                return;
                              }
                              closeSidebarOnMobile();
                            }}
                            className={({ isActive }) =>
                              cn(
                                'group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-smooth',
                                isDisabled
                                  ? 'cursor-not-allowed text-white/35'
                                  : isActive
                                    ? 'bg-white/16 text-white shadow-nav-active'
                                    : 'text-white/75 hover:bg-white/10 hover:text-white',
                              )
                            }
                          >
                            {({ isActive }) => (
                              <>
                                {isActive && !isDisabled ? (
                                  <span
                                    className="pointer-events-none absolute inset-y-1 start-1 w-1 rounded-full bg-[#BED6F6] shadow-[0_0_12px_rgba(190,214,246,0.9)]"
                                    aria-hidden
                                  />
                                ) : null}
                                <ChildIcon
                                  size={17}
                                  className={cn(
                                    'relative z-[1] shrink-0 transition-transform duration-200 group-hover:scale-[1.03]',
                                    isDisabled && 'opacity-50',
                                  )}
                                  strokeWidth={isActive ? 2.25 : 2}
                                />
                                <span className="relative z-[1] flex-1">{sidebarNavText(child.page, child.labelKey)}</span>
                                {isDisabled && (
                                  <span className="ms-1 shrink-0 rounded-full bg-[#BED6F6]/95 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#1E72B9]">
                                    Pro
                                  </span>
                                )}
                              </>
                            )}
                          </NavLink>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
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
                        : 'text-white/78 hover:bg-white/10 hover:text-white',
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      {isActive ? (
                        <span
                          className="pointer-events-none absolute inset-y-1.5 start-1 w-1 rounded-full bg-[#BED6F6] shadow-[0_0_12px_rgba(190,214,246,0.9)]"
                          aria-hidden
                        />
                      ) : null}
                      <span
                        className={cn(
                          'relative z-[1] flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-smooth',
                          isActive ? 'bg-white/20 text-white' : 'bg-transparent text-white/85 group-hover:bg-white/12 group-hover:text-white',
                        )}
                      >
                        <Settings size={18} strokeWidth={2} />
                      </span>
                      <span className="relative z-[1] truncate">{t('nav.settings')}</span>
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
