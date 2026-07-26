import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen } from 'lucide-react';
import { PublicHero, PublicPageShell, PublicSection } from '@/components/landing/PublicPageShell';

const DOCS = [
  {
    title: 'Démarrer en 5 minutes',
    body: 'Configurer votre activité et votre cible. Voir votre première liste pertinente.',
    href: '/register',
  },
  {
    title: 'L’écran Aujourd’hui',
    body: 'Cinq entreprises à contacter, la raison, le message déjà écrit.',
    href: '/fonctionnalites#aujourdhui',
  },
  {
    title: 'Dictée après appel (Scribe)',
    body: 'Quinze secondes de voix → résumé, objection, date de relance.',
    href: '/fonctionnalites#scribe',
  },
  {
    title: 'Prospecteur, Analyste, Rédacteur, Veilleur',
    body: 'Qui fait quoi — sans jargon technique.',
    href: '/solutions',
  },
  {
    title: 'WhatsApp comme canal principal',
    body: 'Pourquoi Ciblix traite WhatsApp comme le canal n°1, pas une option.',
    href: '/blog/whatsapp-canal-principal',
  },
  {
    title: 'Facturation par commercial actif',
    body: 'Découverte, Équipe, Direction — ce que chaque niveau inclut.',
    href: '/tarifs',
  },
  {
    title: 'Sécurité & cloisonnement',
    body: 'Ce qui reste privé à votre compte, ce qui peut être mutualisé.',
    href: '/securite',
  },
  {
    title: 'Politique de confidentialité',
    body: 'Traitements, conservation, droits.',
    href: '/legal/privacy',
  },
  {
    title: 'Conditions d’utilisation',
    body: 'Cadre d’usage de la plateforme.',
    href: '/legal/cgu',
  },
] as const;

export function Documentation() {
  return (
    <PublicPageShell>
      <PublicHero
        eyebrow="Documentation"
        title="Comprendre Ciblix sans mode d’emploi CRM."
        subtitle="Guides courts, orientés résultat. Pas de configuration d’étapes de vente."
      />

      <PublicSection className="max-w-3xl">
        <ul className="space-y-3">
          {DOCS.map((d) => (
            <li key={d.title}>
              <Link
                to={d.href}
                className="group flex items-start gap-3 rounded-xl border border-neutral-200 bg-white px-4 py-4 transition hover:border-[#016AEB]/40 hover:bg-[#f7faff]"
              >
                <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-[#016AEB]" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-foreground group-hover:text-[#016AEB]">{d.title}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">{d.body}</p>
                </div>
                <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-neutral-300 group-hover:text-[#016AEB]" />
              </Link>
            </li>
          ))}
        </ul>
      </PublicSection>
    </PublicPageShell>
  );
}
