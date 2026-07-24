import { Crosshair, Search, UserCheck, TrendingUp, Globe, Database, Filter, BarChart3, Zap, Target, Users, Mail } from 'lucide-react';
import { AgentPublicPage } from '../AgentPublicPage';

export function HuntAIPage() {
  return (
    <AgentPublicPage
      name="Prospecteur"
      subtitle="Trouver de nouveaux clients"
      heroDescription="Le Prospecteur identifie les entreprises correspondant à vos critères, enrichit les contacts, qualifie les prospects et prépare vos campagnes de prospection."
      icon={Crosshair}
      gradient="bg-gradient-to-br from-[#016AEB] via-[#0071DD] to-[#0a2540]"
      iconBg="bg-white/20"
      stats={[
        { value: '10x', label: 'Plus rapide que la recherche manuelle' },
        { value: '85%', label: 'Précision du scoring' },
        { value: '24/7', label: 'Prospection continue' },
        { value: '+40%', label: "Taux de conversion moyen" },
      ]}
      features={[
        {
          icon: Search,
          title: 'Recherche multi-sources',
          description: "Recherche dans des milliers de sources professionnelles pour trouver des prospects qualifiés dans votre secteur et zone géographique.",
        },
        {
          icon: BarChart3,
          title: 'Lead scoring IA',
          description: "Chaque prospect reçoit un score 0-100 basé sur la pertinence métier, la taille de l'entreprise, le secteur et les signaux d'achat détectés.",
        },
        {
          icon: Database,
          title: 'Enrichissement automatique',
          description: "Complète automatiquement les fiches prospect avec email, téléphone, site web, effectif, chiffre d'affaires et informations légales.",
        },
        {
          icon: Filter,
          title: 'Filtres avancés',
          description: "Filtrez par secteur, zone géographique, taille d'entreprise, chiffre d'affaires et mots-clés métier pour cibler exactement votre marché.",
        },
        {
          icon: UserCheck,
          title: 'Détection de doublons',
          description: "Identifie automatiquement les doublons et fusions possibles pour garder votre base CRM propre et à jour.",
        },
        {
          icon: TrendingUp,
          title: 'Suggestions intelligentes',
          description: "Analyse votre portefeuille clients existant pour recommander des prospects similaires à forte probabilité de conversion.",
        },
      ]}
      howItWorks={[
        {
          step: '1',
          title: 'Définissez votre cible',
          description: "Précisez votre secteur, zone géographique et les critères de votre client idéal. Hunt AI comprend votre marché.",
        },
        {
          step: '2',
          title: "L'IA recherche pour vous",
          description: "Hunt AI scanne des dizaines de sources en parallèle, analyse les résultats et élimine le bruit pour ne garder que les prospects pertinents.",
        },
        {
          step: '3',
          title: 'Recevez des prospects qualifiés',
          description: "Chaque prospect est présenté avec un score de pertinence, des informations enrichies et une recommandation d'action.",
        },
        {
          step: '4',
          title: 'Convertissez plus vite',
          description: "Importez directement les prospects dans votre CRM, planifiez vos actions et suivez votre pipeline. Le tout en quelques clics.",
        },
      ]}
      useCases={[
        {
          title: 'PME en croissance',
          description: "Vous cherchez à développer votre portefeuille clients mais n'avez pas de commercial dédié à la prospection. Hunt AI fait ce travail 24/7.",
        },
        {
          title: 'Bureau de conseil',
          description: "Identifiez les entreprises qui ont besoin de vos services en détectant les signaux faibles : recrutements, levées de fonds, changements réglementaires.",
        },
        {
          title: 'Équipe commerciale',
          description: "Alimentez vos commerciaux avec des leads qualifiés et scorés. Ils se concentrent sur la vente, pas la recherche.",
        },
        {
          title: 'Expansion géographique',
          description: "Vous ciblez une nouvelle région ? Hunt AI cartographie le tissu économique local et identifie vos prospects prioritaires.",
        },
      ]}
    />
  );
}
