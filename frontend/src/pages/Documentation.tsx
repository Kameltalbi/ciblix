import { PublicHero, PublicPageShell } from '@/components/landing/PublicPageShell';
import { DocumentationGuide } from '@/components/landing/DocumentationGuide';

export function Documentation() {
  return (
    <PublicPageShell>
      <PublicHero
        eyebrow="Documentation"
        title="Comment utiliser Ciblix — guide complet"
        subtitle="Prise en main, rôles admin et commercial, écrans et agents. Tout ce qu’il faut pour que l’équipe soit opérationnelle en une journée."
        cta={{ label: 'Créer mon compte', to: '/register' }}
      />
      <DocumentationGuide />
    </PublicPageShell>
  );
}
