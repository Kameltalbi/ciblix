import { Link, Navigate, useParams } from 'react-router-dom';
import { Radar, FileSignature, ShieldCheck, ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { LucideIcon } from 'lucide-react';

const AGENT_META: Record<string, { icon: LucideIcon; titleKey: string; roleKey: string; descKey: string }> = {
  'scout-ai': {
    icon: Radar,
    titleKey: 'agentsComingSoon.scoutAi.name',
    roleKey: 'agentsComingSoon.scoutAi.role',
    descKey: 'agentsComingSoon.scoutAi.description',
  },
  'offre-bot': {
    icon: FileSignature,
    titleKey: 'agentsComingSoon.offreBot.name',
    roleKey: 'agentsComingSoon.offreBot.role',
    descKey: 'agentsComingSoon.offreBot.description',
  },
  'factcheck-ai': {
    icon: ShieldCheck,
    titleKey: 'agentsComingSoon.factCheckAi.name',
    roleKey: 'agentsComingSoon.factCheckAi.role',
    descKey: 'agentsComingSoon.factCheckAi.description',
  },
};

export function AgentComingSoon() {
  const { agentId } = useParams<{ agentId: string }>();
  const { t } = useTranslation();

  if (!agentId || !AGENT_META[agentId]) {
    return <Navigate to="/dashboard" replace />;
  }

  const meta = AGENT_META[agentId];
  const Icon = meta.icon;

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <Link
        to="/dashboard"
        className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft size={16} strokeWidth={2} />
        {t('agentsComingSoon.back')}
      </Link>

      <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Icon size={28} strokeWidth={2} />
          </div>
          <div className="min-w-0 flex-1 space-y-4">
            <div>
              <span className="inline-flex rounded-full bg-muted px-3 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t('agentsComingSoon.badge')}
              </span>
              <h1 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">{t(meta.titleKey)}</h1>
              <p className="mt-1 text-sm font-medium text-primary">{t(meta.roleKey)}</p>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">{t(meta.descKey)}</p>
            <p className="text-xs text-muted-foreground/90">{t('agentsComingSoon.footnote')}</p>
            <Link
              to="/prospection-ia"
              className="inline-flex text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              {t('agentsComingSoon.ctaHunt')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
