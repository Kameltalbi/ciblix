import { useState } from 'react';
import { OrganizationSettings } from '@/components/settings/OrganizationSettings';
import { CopilotOrgSettings } from '@/components/settings/CopilotOrgSettings';
import { PipelineSettings } from '@/components/settings/PipelineSettings';
import { IntegrationsSettings } from '@/components/settings/IntegrationsSettings';
import { ComplianceSettings } from '@/components/settings/ComplianceSettings';
import { BillingSettings } from '@/components/settings/BillingSettings';
import { cn } from '@/lib/utils';

type OrgTab = 'general' | 'metier' | 'pipeline' | 'integrations' | 'compliance' | 'billing';

const TABS: Array<{ id: OrgTab; label: string }> = [
  { id: 'general', label: 'Général' },
  { id: 'metier', label: 'Métier' },
  { id: 'pipeline', label: 'Pipeline' },
  { id: 'integrations', label: 'Intégrations' },
  { id: 'compliance', label: 'Conformité' },
  { id: 'billing', label: 'Facturation' },
];

export function OrganizationHub() {
  const [tab, setTab] = useState<OrgTab>('general');

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1 border-b pb-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              'px-3 py-1.5 text-sm rounded-md transition-colors',
              tab === t.id ? 'bg-leaf/10 text-leaf font-medium' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'general' && <OrganizationSettings />}
      {tab === 'metier' && <CopilotOrgSettings />}
      {tab === 'pipeline' && <PipelineSettings />}
      {tab === 'integrations' && <IntegrationsSettings />}
      {tab === 'compliance' && <ComplianceSettings />}
      {tab === 'billing' && <BillingSettings />}
    </div>
  );
}
