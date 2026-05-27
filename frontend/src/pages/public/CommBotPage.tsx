import { Megaphone, Search, Linkedin, Mail, Package, Globe, PenLine } from 'lucide-react';
import { AgentPublicPage } from '../AgentPublicPage';

export function CommBotPage() {
  return (
    <AgentPublicPage
      name="CommBot"
      subtitle="Marketing & contenu B2B"
      heroDescription="CommBot aide votre entreprise à produire des contenus SEO, posts LinkedIn, newsletters, fiches produits et pages services — sans recruter une équipe marketing complète."
      icon={Megaphone}
      gradient="bg-gradient-to-br from-[#e11d48] via-[#be123c] to-[#0a2540]"
      iconBg="bg-white/20"
      stats={[
        { value: '5', label: 'Formats de contenu' },
        { value: '< 1 min', label: 'Par génération' },
        { value: 'B2B', label: 'Orienté PME tunisiennes' },
        { value: 'Pro', label: 'Exclusif plan Professionnel' },
      ]}
      features={[
        {
          icon: Search,
          title: 'Articles SEO',
          description: "Générez des contenus optimisés pour le référencement : titre, meta description, structure H2 et corps d'article prêt à publier.",
        },
        {
          icon: Linkedin,
          title: 'Posts LinkedIn',
          description: 'Créez des publications B2B avec accroche, corps structuré et hashtags — adaptées à votre audience professionnelle.',
        },
        {
          icon: Mail,
          title: 'Newsletters',
          description: "Rédigez des emails clients ou prospects : objet, sections thématiques et appel à l'action, en quelques clics.",
        },
        {
          icon: Package,
          title: 'Fiches produits',
          description: "Structurez vos offres : bénéfices, fonctionnalités, cas d'usage et argumentaire commercial, à partir de vos produits CRM.",
        },
        {
          icon: Globe,
          title: 'Pages services',
          description: 'Produisez le contenu de vos pages web : proposition de valeur, sections détaillées, FAQ et CTA.',
        },
        {
          icon: PenLine,
          title: 'Génération assistée',
          description: 'Vous gardez le contrôle : CommBot propose, vous relisez, ajustez et publiez. Pas de publication automatique.',
        },
      ]}
      howItWorks={[
        {
          step: '1',
          title: 'Choisissez le format',
          description: 'Article SEO, post LinkedIn, newsletter, fiche produit ou page service — selon votre objectif de visibilité.',
        },
        {
          step: '2',
          title: 'Décrivez votre sujet',
          description: "Indiquez le thème, l'audience cible et éventuellement un produit ou service de votre CRM.",
        },
        {
          step: '3',
          title: 'CommBot rédige',
          description: "L'IA produit un contenu structuré, crédible et adapté au marché B2B tunisien.",
        },
        {
          step: '4',
          title: 'Relisez et publiez',
          description: 'Copiez le résultat, ajustez si besoin et diffusez sur votre site, LinkedIn ou newsletter.',
        },
      ]}
      useCases={[
        {
          title: 'Visibilité sans équipe marketing',
          description: 'Une PME de 5 personnes produit chaque semaine un post LinkedIn et un article SEO sans freelance.',
        },
        {
          title: 'Lancement de service',
          description: "Vous lancez une nouvelle prestation ? CommBot génère la page service et la newsletter d'annonce.",
        },
        {
          title: 'Catalogue produits en ligne',
          description: 'Transformez vos fiches CRM en contenus web professionnels pour votre site ou vos supports commerciaux.',
        },
      ]}
    />
  );
}
