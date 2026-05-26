import { Bot, MessageSquare, BarChart3, TrendingUp, Zap, Brain, Search, FileText, PieChart, Target, Users, Clock } from 'lucide-react';
import { AgentPublicPage } from '../AgentPublicPage';

export function CopilotIAPage() {
  return (
    <AgentPublicPage
      name="Assistant IA"
      subtitle="Votre assistant commercial conversationnel"
      heroDescription="Posez vos questions en langage naturel et obtenez des réponses instantanées. CA du mois, top clients, analyse pipeline, prévisions — l'Assistant IA transforme vos données CRM en insights actionnables."
      icon={Bot}
      gradient="bg-gradient-to-br from-[#0071DD] via-[#016AEB] to-[#0a2540]"
      iconBg="bg-white/20"
      stats={[
        { value: '< 3s', label: 'Temps de réponse moyen' },
        { value: '∞', label: 'Questions possibles' },
        { value: '2h/sem', label: 'Temps gagné en reporting' },
        { value: '100%', label: 'Basé sur vos données' },
      ]}
      features={[
        {
          icon: MessageSquare,
          title: 'Questions en langage naturel',
          description: "Demandez \"Quel est mon CA ce trimestre ?\" ou \"Quelles affaires risquent d'être perdues ?\" — Copilot comprend et répond instantanément.",
        },
        {
          icon: BarChart3,
          title: 'Analyse temps réel',
          description: "Accédez à des analyses actualisées de votre pipeline, taux de conversion, performance commerciale et tendances sans ouvrir un seul rapport.",
        },
        {
          icon: Brain,
          title: 'Recommandations intelligentes',
          description: "Copilot détecte les opportunités à risque, suggère des actions prioritaires et vous alerte sur les affaires nécessitant votre attention.",
        },
        {
          icon: PieChart,
          title: 'Rapports automatiques',
          description: "Générez des rapports commerciaux structurés en une phrase. Export possible pour vos réunions et présentations.",
        },
        {
          icon: Target,
          title: 'Suivi des objectifs',
          description: "\"Où en suis-je par rapport à mes objectifs ?\" — Copilot affiche votre progression en temps réel avec des projections.",
        },
        {
          icon: Clock,
          title: 'Historique conversationnel',
          description: "Retrouvez toutes vos conversations précédentes. Copilot se souvient du contexte pour des réponses toujours plus pertinentes.",
        },
      ]}
      howItWorks={[
        {
          step: '1',
          title: 'Posez votre question',
          description: "Tapez votre question comme vous le feriez à un collègue. \"Quels sont mes 5 plus gros clients ?\" ou \"Combien d'affaires en cours ce mois-ci ?\".",
        },
        {
          step: '2',
          title: "L'IA analyse vos données",
          description: "Copilot interroge votre base CRM en temps réel, croise les informations et prépare une réponse claire et structurée.",
        },
        {
          step: '3',
          title: 'Obtenez une réponse actionnable',
          description: "Recevez une réponse précise avec chiffres, graphiques et recommandations. Pas de jargon technique, que de l'utile.",
        },
        {
          step: '4',
          title: 'Agissez immédiatement',
          description: "Depuis la réponse, accédez directement aux fiches clients, affaires ou contacts concernés. De l'insight à l'action en un clic.",
        },
      ]}
      useCases={[
        {
          title: 'Préparation de réunion',
          description: "\"Résume-moi l'activité commerciale de la semaine\" — préparez vos réunions en 30 secondes au lieu de 30 minutes.",
        },
        {
          title: 'Pilotage quotidien',
          description: "Chaque matin, demandez à Copilot les actions prioritaires du jour. Il analyse votre pipeline et vous guide.",
        },
        {
          title: 'Reporting direction',
          description: "Générez un rapport mensuel complet en une seule question. CA, pipeline, conversion, prévisions — tout y est.",
        },
        {
          title: 'Formation nouveau commercial',
          description: "Un nouveau dans l'équipe ? Copilot l'aide à comprendre rapidement le portefeuille, les process et les priorités.",
        },
      ]}
    />
  );
}
