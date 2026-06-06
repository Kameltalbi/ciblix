import { Megaphone, BarChart3, FileText, CheckCircle, Globe } from 'lucide-react';
import { AgentPublicPage } from '../AgentPublicPage';

export function BrandPulsePage() {
  return (
    <AgentPublicPage
      name="BrandPulse AI"
      subtitle="Marque en ligne & blog SEO"
      heroDescription="Mesurez votre marque sur 6 canaux, recevez des sujets d'articles prioritaires, rédigez et validez le contenu avant publication sur votre CMS."
      icon={Megaphone}
      gradient="bg-gradient-to-br from-[#e11d48] via-[#be123c] to-[#0a2540]"
      iconBg="bg-white/20"
      stats={[
        { value: '/100', label: 'Score marque global' },
        { value: '6', label: 'Canaux surveillés' },
        { value: '4', label: 'Formats d\'articles' },
        { value: 'Pro', label: 'Exclusif plan Professionnel' },
      ]}
      features={[
        {
          icon: BarChart3,
          title: 'Scoring multi-canal',
          description: 'SEO, réseaux sociaux, avis, presse, LLMs et site web — un tableau de bord unique pour piloter votre visibilité.',
        },
        {
          icon: FileText,
          title: 'Pipeline blog IA',
          description: 'L\'agent propose des sujets, rédige les articles et les soumet à votre validation avant toute publication.',
        },
        {
          icon: CheckCircle,
          title: 'Workflow validation',
          description: 'Approuvez, modifiez ou rejetez chaque article. Aucune publication sans votre accord.',
        },
        {
          icon: Globe,
          title: 'Publication CMS',
          description: 'WordPress, Ghost et autres plateformes — connexion sécurisée par clé API (déploiement progressif).',
        },
      ]}
      howItWorks={[
        { step: '1', title: 'Configurez votre marque', description: 'Nom, site web, secteur et concurrent principal.' },
        { step: '2', title: 'Audit & score', description: 'Premier diagnostic SEO et score global pondéré.' },
        { step: '3', title: 'Sujets prioritaires', description: 'L\'IA propose 3 articles ciblant vos lacunes de score.' },
        { step: '4', title: 'Validez & publiez', description: 'Relisez, approuvez et publiez sur votre blog connecté.' },
      ]}
      useCases={[
        { title: 'PME sans équipe marketing', description: 'Pilotez marque et contenu depuis le CRM sans compétences SEO.' },
        { title: 'Amélioration SEO mesurable', description: 'Suivez l\'impact de chaque article sur votre score.' },
      ]}
    />
  );
}
