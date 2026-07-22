import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Mail, Users, Lock, Building2 } from 'lucide-react';
import { GmailSettings } from '@/components/settings/GmailSettings';
import { UsersSettings } from '@/components/settings/UsersSettings';
import { OrganizationHub } from '@/components/settings/OrganizationHub';
import { SecuritySettings } from '@/components/settings/SecuritySettings';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/form-controls';
import { useAuth } from '@/lib/auth';

type Tab = 'organization' | 'gmail' | 'users' | 'security';

const ALL_TABS: { id: Tab; label: string; icon: typeof Building2; ownerOnly?: boolean }[] = [
  { id: 'organization', label: 'Organisation', icon: Building2, ownerOnly: true },
  { id: 'gmail', label: 'Gmail', icon: Mail },
  { id: 'users', label: 'Utilisateurs & permissions', icon: Users, ownerOnly: true },
  { id: 'security', label: 'Sécurité', icon: Lock },
];

export function Settings() {
  const { t } = useTranslation();
  const user = useAuth((s) => s.user);
  const isOwner = user?.role === 'OWNER' || user?.role === 'SUPERADMIN';

  const tabs = useMemo(
    () => ALL_TABS.filter((tab) => isOwner || !tab.ownerOnly),
    [isOwner]
  );

  const [activeTab, setActiveTab] = useState<Tab>(() => (isOwner ? 'organization' : 'security'));

  const visibleTab = tabs.some((tab) => tab.id === activeTab) ? activeTab : tabs[0]?.id ?? 'security';

  return (
    <div className="space-y-6 px-2 md:px-0">
      <div>
        <h1 className="font-serif text-2xl md:text-3xl">{t('settings.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('settings.integrationsSubtitle')}</p>
      </div>

      {/* Mobile: menu déroulant */}
      <div className="md:hidden">
        <Select value={visibleTab} onValueChange={(v) => setActiveTab(v as Tab)}>
          <SelectTrigger className="h-11 w-full justify-between gap-2 text-left font-medium [&>span]:min-w-0">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              {(() => {
                const tab = tabs.find((x) => x.id === visibleTab);
                if (!tab) return <SelectValue placeholder={t('settings.title')} />;
                const Icon = tab.icon;
                return (
                  <>
                    <Icon size={18} className="shrink-0 text-muted-foreground" />
                    <SelectValue>{t(`settings.tabs.${tab.id}`)}</SelectValue>
                  </>
                );
              })()}
            </div>
          </SelectTrigger>
          <SelectContent position="item-aligned" className="max-h-[min(70vh,24rem)] w-[var(--radix-select-trigger-width)]">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <SelectItem key={tab.id} value={tab.id} className="cursor-pointer">
                  <span className="flex items-center gap-2 py-0.5">
                    <Icon size={16} className="shrink-0 text-muted-foreground" />
                    <span>{t(`settings.tabs.${tab.id}`)}</span>
                  </span>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>

      {/* Desktop / tablette: onglets horizontaux */}
      <div className="hidden md:flex border-b overflow-x-auto overscroll-x-contain scroll-smooth [-webkit-overflow-scrolling:touch]">
        <div className="flex min-w-min flex-nowrap gap-0">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex shrink-0 items-center gap-2 whitespace-nowrap px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  visibleTab === tab.id
                    ? 'border-leaf text-leaf'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon size={16} className="shrink-0" />
                {t(`settings.tabs.${tab.id}`)}
              </button>
            );
          })}
        </div>
      </div>

      <div className="pt-4">
        {visibleTab === 'organization' && isOwner && <OrganizationHub />}
        {visibleTab === 'gmail' && <GmailSettings />}
        {visibleTab === 'users' && isOwner && <UsersSettings />}
        {visibleTab === 'security' && <SecuritySettings />}
      </div>
    </div>
  );
}
