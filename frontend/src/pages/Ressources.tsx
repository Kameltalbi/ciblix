import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, CircleHelp, FileText, Newspaper, Shield } from 'lucide-react';
import { PublicHero, PublicPageShell, PublicSection } from '@/components/landing/PublicPageShell';

const HUB = [
  {
    title: 'FAQ',
    body: 'Objections réelles et réponses commerciales.',
    href: '/faq',
    icon: CircleHelp,
  },
  {
    title: 'Documentation',
    body: 'Démarrer, Aujourd’hui, Scribe, sécurité, facturation.',
    href: '/documentation',
    icon: BookOpen,
  },
  {
    title: 'Blog',
    body: 'Zéro saisie, ancrage local, mémoire qui réveille.',
    href: '/blog',
    icon: Newspaper,
  },
  {
    title: 'Sécurité',
    body: 'Cloisonnement tenant et validation humaine.',
    href: '/securite',
    icon: Shield,
  },
  {
    title: 'À propos',
    body: 'Vision longue : pourquoi Ciblix existe.',
    href: '/a-propos',
    icon: FileText,
  },
  {
    title: 'Contact',
    body: 'Parler à l’équipe — Tunisie.',
    href: '/contact',
    icon: ArrowRight,
  },
] as const;

export function Ressources() {
  return (
    <PublicPageShell>
      <PublicHero
        eyebrow="Ressources"
        title="Tout ce qu’il faut pour décider — sans jargon."
        subtitle="FAQ, docs, blog et sécurité. Alignés sur le même argumentaire : résultat démontrable, pas promesses vagues."
      />

      <PublicSection className="max-w-4xl">
        <div className="grid gap-4 sm:grid-cols-2">
          {HUB.map((item) => (
            <Link
              key={item.href}
              to={item.href}
              className="group rounded-2xl border border-[#BED6F6]/50 bg-[#f7faff] p-6 transition hover:border-[#016AEB]/40"
            >
              <item.icon className="mb-3 h-5 w-5 text-[#016AEB]" />
              <h2 className="mb-1 font-semibold group-hover:text-[#016AEB]">{item.title}</h2>
              <p className="text-sm text-muted-foreground">{item.body}</p>
            </Link>
          ))}
        </div>
      </PublicSection>
    </PublicPageShell>
  );
}
