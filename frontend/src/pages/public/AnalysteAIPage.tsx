import { Search, Building2, Users, Target, Swords, ListChecks, Crosshair } from 'lucide-react';
import { AgentPublicPage } from '../AgentPublicPage';

export function AnalysteAIPage() {
  return (
    <AgentPublicPage
      name="Analyste"
      subtitle="Analyser les entreprises avant de contacter"
      heroDescription="L’Analyste étudie les entreprises cibles — activité, décideurs, concurrents et potentiel — pour préparer chaque approche commerciale."
      icon={Search}
      gradient="bg-gradient-to-br from-[#1E72B9] via-[#016AEB] to-[#0a2540]"
      iconBg="bg-white/20"
      stats={[
        { value: '1 brief', label: 'Avant chaque premier contact' },
        { value: 'Décideurs', label: 'Profils utiles identifiés' },
        { value: 'Angles', label: 'Approches personnalisées' },
        { value: 'Équipe', label: 'Complète Prospecteur & Veilleur' },
      ]}
      features={[
        {
          icon: Building2,
          title: 'Cartographie d’activité',
          description: 'Comprenez l’offre, le positionnement et le contexte de la cible en quelques minutes.',
        },
        {
          icon: Users,
          title: 'Décideurs utiles',
          description: 'Identifiez les rôles à contacter pour accélérer le cycle commercial.',
        },
        {
          icon: Swords,
          title: 'Concurrents & alternatives',
          description: 'Anticipez les objections et affinez votre différenciation.',
        },
        {
          icon: Target,
          title: 'Angles d’approche',
          description: 'Recevez des pistes concrètes pour ouvrir la conversation.',
        },
        {
          icon: ListChecks,
          title: 'Prochaines actions',
          description: 'Un plan court pour passer du brief à la première relance.',
        },
        {
          icon: Crosshair,
          title: 'Mémoire partagée',
          description: 'Travaille avec le Prospecteur, le Veilleur et l’Assistant sur la même cible.',
        },
      ]}
      howItWorks={[
        {
          step: '1',
          title: 'Indiquez la cible',
          description: 'Nom d’entreprise, site et quelques notes de contexte.',
        },
        {
          step: '2',
          title: 'L’Analyste produit le brief',
          description: 'Synthèse, décideurs, concurrents, potentiel et angles d’approche.',
        },
        {
          step: '3',
          title: 'Préparez le contact',
          description: 'L’Assistant peut enchaîner avec un email ou une proposition.',
        },
        {
          step: '4',
          title: 'Agissez avec l’équipe',
          description: 'Prospecteur et Veilleur alimentent la même mémoire pour la suite.',
        },
      ]}
      useCases={[
        {
          title: 'Premier rendez-vous',
          description: 'Arrivez préparé avec un brief clair plutôt qu’une fiche vide.',
        },
        {
          title: 'Compte stratégique',
          description: 'Cartographiez décideurs et angles avant une campagne ciblée.',
        },
        {
          title: 'Réponse à une alerte Veilleur',
          description: 'Une opportunité détectée ? Analysez l’émetteur avant de répondre.',
        },
        {
          title: 'Équipe commerciale',
          description: 'Standardisez la préparation des approches dans l’équipe.',
        },
      ]}
    />
  );
}
