import { Radar, FileText, PartyPopper, Newspaper, Search, Bell, TrendingUp, Globe, Filter, Calendar, MapPin, BarChart3 } from 'lucide-react';
import { AgentPublicPage } from '../AgentPublicPage';

export function ScoutAIPage() {
  return (
    <AgentPublicPage
      name="Scout AI"
      subtitle="Veille & détection d'opportunités"
      heroDescription="Scout AI surveille en continu les appels d'offres, événements sectoriels et actualités pour détecter automatiquement les opportunités pertinentes. Ne ratez plus jamais une opportunité."
      icon={Radar}
      gradient="bg-gradient-to-br from-indigo-600 via-violet-600 to-indigo-700"
      iconBg="bg-white/20"
      stats={[
        { value: '3', label: 'Piliers de veille (AO, Events, News)' },
        { value: '100+', label: 'Sources surveillées' },
        { value: '0-100', label: 'Score de pertinence IA' },
        { value: '24/7', label: 'Surveillance continue' },
      ]}
      features={[
        {
          icon: FileText,
          title: "Appels d'offres (Tender Watch)",
          description: "Détecte les appels d'offres sur TUNEPS, marchés publics et plateformes spécialisées. Filtrage par mots-clés, secteurs et zones géographiques.",
        },
        {
          icon: PartyPopper,
          title: 'Événements (Event Radar)',
          description: "Repère les salons, conférences, forums d'affaires et webinaires pertinents pour votre secteur. Calendrier enrichi avec recommandations.",
        },
        {
          icon: Newspaper,
          title: 'Actualités (News Intelligence)',
          description: "Surveille la presse spécialisée, les publications officielles et les réseaux sociaux. Détecte les changements réglementaires et signaux faibles.",
        },
        {
          icon: Filter,
          title: 'Profil de veille personnalisé',
          description: "Configurez vos mots-clés, secteurs et zones géographiques. Scout AI apprend de vos préférences pour affiner ses résultats.",
        },
        {
          icon: BarChart3,
          title: 'Score de pertinence',
          description: "Chaque opportunité reçoit un score 0-100 calculé par l'IA selon la correspondance avec votre profil. Concentrez-vous sur l'essentiel.",
        },
        {
          icon: Bell,
          title: 'Résumés IA',
          description: "Chaque opportunité est accompagnée d'un résumé actionnable : objet, montant estimé, deadline, lieu et recommandation.",
        },
      ]}
      howItWorks={[
        {
          step: '1',
          title: 'Configurez votre profil de veille',
          description: "Définissez vos mots-clés métier, secteurs d'activité et zones géographiques. Activez les catégories qui vous intéressent.",
        },
        {
          step: '2',
          title: 'Scout AI scanne les sources',
          description: "L'IA parcourt des dizaines de sources, déduplique les résultats et élimine le bruit pour ne garder que les opportunités réelles.",
        },
        {
          step: '3',
          title: "L'IA analyse et score",
          description: "Chaque résultat est analysé : extraction de dates limites, budgets, lieux. Un score de pertinence est calculé selon votre profil.",
        },
        {
          step: '4',
          title: 'Agissez sur les meilleures opportunités',
          description: "Sauvegardez, marquez comme traité ou ignorez. Accédez directement aux sources. Exportez vers votre CRM.",
        },
      ]}
      useCases={[
        {
          title: "Réponse aux appels d'offres",
          description: "Détectez les AO pertinents dès leur publication sur TUNEPS et les plateformes publiques. Ne ratez plus jamais une deadline.",
        },
        {
          title: 'Networking événementiel',
          description: "Identifiez les salons et conférences où vos prospects seront présents. Planifiez votre présence avec un calendrier enrichi.",
        },
        {
          title: 'Veille concurrentielle',
          description: "Suivez l'actualité de vos concurrents, les mouvements du marché et les changements réglementaires qui impactent votre secteur.",
        },
        {
          title: 'Détection de signaux faibles',
          description: "Un budget voté + un recrutement + un appel à manifestation = opportunité imminente. Scout AI connecte les signaux pour vous.",
        },
      ]}
    />
  );
}
