import { ShieldCheck, Search, Globe, FileText, AlertTriangle, CheckCircle2, Scale, Eye, BarChart3, Link2, Database, Zap } from 'lucide-react';
import { AgentPublicPage } from '../AgentPublicPage';

export function FactCheckAIPage() {
  return (
    <AgentPublicPage
      name="Vérificateur IA"
      subtitle="Vérification et fiabilité des informations"
      heroDescription="Le Vérificateur IA vérifie la fiabilité des informations, articles et sources web en croisant plusieurs sources. Protégez vos décisions commerciales avec des données vérifiées."
      icon={ShieldCheck}
      gradient="bg-gradient-to-br from-[#016AEB] via-[#0071DD] to-[#0a2540]"
      iconBg="bg-white/20"
      stats={[
        { value: '10+', label: 'Sources croisées par vérification' },
        { value: '0-100', label: 'Score de fiabilité' },
        { value: '< 15s', label: 'Temps de vérification' },
        { value: '2 modes', label: 'Vérification affirmation + URL' },
      ]}
      features={[
        {
          icon: Search,
          title: "Vérification d'affirmations",
          description: "Soumettez une affirmation ou une information. FactCheck AI la confronte à des sources fiables et vous donne un verdict clair : vrai, faux, partiellement vrai.",
        },
        {
          icon: Globe,
          title: 'Analyse de pages web',
          description: "Collez une URL et FactCheck AI analyse le contenu : fiabilité de la source, qualité de l'information, biais potentiels et cohérence.",
        },
        {
          icon: BarChart3,
          title: 'Score de fiabilité',
          description: "Chaque vérification produit un score 0-100 accompagné d'une explication détaillée et d'une liste de sources consultées.",
        },
        {
          icon: Link2,
          title: 'Sources traçables',
          description: "Chaque verdict est accompagné de liens vers les sources utilisées. Vérifiez par vous-même, en toute transparence.",
        },
        {
          icon: Scale,
          title: 'Analyse des biais',
          description: "FactCheck AI identifie les biais potentiels dans les articles : ton partisan, sources non citées, données obsolètes.",
        },
        {
          icon: AlertTriangle,
          title: 'Alertes fiabilité',
          description: "Détection automatique des signaux d'alerte : site récent, absence de mentions légales, informations contradictoires.",
        },
      ]}
      howItWorks={[
        {
          step: '1',
          title: 'Soumettez une information',
          description: "Tapez une affirmation à vérifier ou collez l'URL d'un article. FactCheck AI accepte les deux modes.",
        },
        {
          step: '2',
          title: "L'IA recherche et croise",
          description: "FactCheck AI consulte des sources fiables, croise les informations et analyse la cohérence des données trouvées.",
        },
        {
          step: '3',
          title: 'Recevez un verdict détaillé',
          description: "Un score de fiabilité, une analyse complète, les points confirmés, les points contestés et les sources consultées.",
        },
        {
          step: '4',
          title: 'Prenez des décisions éclairées',
          description: "Utilisez le verdict pour valider vos décisions commerciales, vérifier un prospect ou confirmer une information marché.",
        },
      ]}
      useCases={[
        {
          title: 'Due diligence prospect',
          description: "Vérifiez les informations communiquées par un prospect : chiffres annoncés, références clients, historique. Sécurisez vos décisions.",
        },
        {
          title: 'Veille informationnelle',
          description: "Un article annonce un gros budget ou une nouvelle réglementation ? Vérifiez sa fiabilité avant de baser votre stratégie dessus.",
        },
        {
          title: 'Analyse concurrentielle',
          description: "Vérifiez les affirmations de vos concurrents : parts de marché annoncées, certifications revendiquées, références client.",
        },
        {
          title: "Préparation d'offres",
          description: "Avant de répondre à un appel d'offres, vérifiez les informations sur l'organisme, le budget disponible et les conditions.",
        },
      ]}
    />
  );
}
