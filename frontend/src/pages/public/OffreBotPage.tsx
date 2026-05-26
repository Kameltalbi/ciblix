import { FileSignature, FileText, Users, Palette, Download, Zap, RefreshCw, Settings, BarChart3, Target, Clock, CheckCircle2 } from 'lucide-react';
import { AgentPublicPage } from '../AgentPublicPage';

export function OffreBotPage() {
  return (
    <AgentPublicPage
      name="Rédacteur d'offres"
      subtitle="Génération automatique de propositions commerciales"
      heroDescription="Le Rédacteur d'offres crée des propositions commerciales professionnelles en quelques secondes à partir de vos données CRM. Personnalisées, structurées et prêtes à envoyer."
      icon={FileSignature}
      gradient="bg-gradient-to-br from-[#0071DD] via-[#016AEB] to-[#0a2540]"
      iconBg="bg-white/20"
      stats={[
        { value: '30s', label: 'Pour générer une offre' },
        { value: '5x', label: 'Plus rapide que manuellement' },
        { value: '100%', label: 'Personnalisée au client' },
        { value: '+25%', label: "Taux d'acceptation moyen" },
      ]}
      features={[
        {
          icon: Zap,
          title: 'Génération instantanée',
          description: "Sélectionnez une affaire et OffreBot génère une proposition complète en 30 secondes. Introduction, détail produits/services, conditions et conclusion.",
        },
        {
          icon: Users,
          title: 'Personnalisation client',
          description: "Chaque offre est adaptée au client : historique de la relation, besoins spécifiques, contexte de l'affaire. L'IA personnalise le ton et le contenu.",
        },
        {
          icon: Palette,
          title: 'Ton configurable',
          description: "Choisissez le style : formel, professionnel, commercial dynamique ou technique. OffreBot adapte le vocabulaire et la structure.",
        },
        {
          icon: RefreshCw,
          title: 'Régénération par section',
          description: "Pas satisfait d'un paragraphe ? Régénérez uniquement la section concernée sans perdre le reste. Affinez jusqu'à la perfection.",
        },
        {
          icon: FileText,
          title: 'Structure professionnelle',
          description: "Introduction contextualisée, détail de l'offre avec prix, conditions générales, planning et conclusion avec appel à l'action.",
        },
        {
          icon: Settings,
          title: 'Options avancées',
          description: "Incluez ou excluez les prix, ajoutez des conditions de garantie, des modalités de paiement ou des clauses spécifiques.",
        },
      ]}
      howItWorks={[
        {
          step: '1',
          title: 'Sélectionnez une affaire',
          description: "Choisissez l'affaire en cours dans votre CRM. OffreBot récupère automatiquement toutes les informations : client, produits, montant, contexte.",
        },
        {
          step: '2',
          title: 'Configurez le ton et les options',
          description: "Choisissez le style de rédaction, incluez ou excluez les prix, ajoutez des options spécifiques. Un clic suffit.",
        },
        {
          step: '3',
          title: "L'IA rédige la proposition",
          description: "OffreBot analyse les données, structure le document et rédige chaque section avec un style professionnel adapté au contexte tunisien.",
        },
        {
          step: '4',
          title: 'Relisez, ajustez, envoyez',
          description: "Prévisualisez la proposition, régénérez les sections si nécessaire, puis copiez ou exportez. Prêt à envoyer au client.",
        },
      ]}
      useCases={[
        {
          title: 'Réponse rapide à un prospect',
          description: "Un prospect demande un devis ? Générez une proposition personnalisée en 30 secondes au lieu de 2 heures.",
        },
        {
          title: 'Proposition complexe multi-produits',
          description: "Combinez plusieurs produits et services avec descriptions détaillées, prix unitaires et remises. OffreBot structure tout automatiquement.",
        },
        {
          title: 'Standardisation des offres',
          description: "Assurez une qualité constante dans toutes vos propositions. Même ton, même structure, même niveau de professionnalisme.",
        },
        {
          title: 'Équipe commerciale junior',
          description: "Aidez vos nouveaux commerciaux à produire des offres de qualité senior dès le premier jour. OffreBot fait le travail rédactionnel.",
        },
      ]}
    />
  );
}
