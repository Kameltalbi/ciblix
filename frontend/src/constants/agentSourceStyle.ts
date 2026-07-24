import type { LucideIcon } from 'lucide-react';
import { Bot, Crosshair, FileText, Mail, Radar, Search, ShieldCheck } from 'lucide-react';

/** Aligné sur la flotte commerciale : Prospecteur · Veilleur · Analyste · Assistant. */
export const AGENT_SOURCE_STYLE: Record<
  string,
  { label: string; color: string; Icon: LucideIcon }
> = {
  HUNT: { label: 'Prospecteur', color: '#0EA5E9', Icon: Crosshair },
  COPILOT: { label: 'Assistant', color: '#8B5CF6', Icon: Bot },
  GMAIL: { label: 'Gmail', color: '#EF4444', Icon: Mail },
  SCOUT: { label: 'Veilleur', color: '#3B82F6', Icon: Radar },
  ANALYSTE: { label: 'Analyste', color: '#1E72B9', Icon: Search },
  OFFREBOT: { label: 'Propositions', color: '#F59E0B', Icon: FileText },
  FACTCHECK: { label: 'Vérificateur', color: '#10B981', Icon: ShieldCheck },
};

export function getAgentSourceStyle(source: string) {
  return (
    AGENT_SOURCE_STYLE[source] || {
      label: source,
      color: '#64748B',
      Icon: Bot,
    }
  );
}
