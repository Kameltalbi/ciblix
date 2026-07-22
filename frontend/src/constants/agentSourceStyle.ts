import type { LucideIcon } from 'lucide-react';
import { Bot, FileText, Mail, Radar, ShieldCheck, Target } from 'lucide-react';

/** Aligné sur AgentsMarketplace COLOR_MAP (sky / violet / red / blue / amber / emerald). */
export const AGENT_SOURCE_STYLE: Record<
  string,
  { label: string; color: string; Icon: LucideIcon }
> = {
  HUNT: { label: 'Chasseur IA', color: '#0EA5E9', Icon: Radar },
  COPILOT: { label: 'Assistant IA', color: '#8B5CF6', Icon: Bot },
  GMAIL: { label: 'Gmail IA', color: '#EF4444', Icon: Mail },
  SCOUT: { label: 'Veilleur IA', color: '#3B82F6', Icon: Target },
  OFFREBOT: { label: "Rédacteur d'offres", color: '#F59E0B', Icon: FileText },
  FACTCHECK: { label: 'Vérificateur IA', color: '#10B981', Icon: ShieldCheck },
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
