import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Mic,
  Moon,
  Search,
  Sparkles,
  Sunrise,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PublicHero, PublicPageShell, PublicSection } from '@/components/landing/PublicPageShell';

const PILLARS = [
  {
    id: 'aujourdhui',
    icon: Sunrise,
    title: 'Chaque matin : cinq entreprises à contacter',
    body: 'Avec la raison de les contacter et le message déjà écrit. Pas une liste de noms — une liste d’entreprises avec le pourquoi.',
  },
  {
    id: 'scribe',
    icon: Mic,
    title: 'Après l’appel : quinze secondes de dictée',
    body: 'Le résumé, l’objection, la date de relance s’écrivent tout seuls. Vous ne saisissez rien. Jamais.',
  },
  {
    id: 'memoire',
    icon: Moon,
    title: 'La mémoire qui réveille les dossiers oubliés',
    body: 'Vous les aviez contactés en novembre. Ils viennent de recruter. La fiche remonte avec le contexte — sans que vous ayez rien cherché.',
  },
  {
    id: 'local',
    icon: Search,
    title: 'Ancré sur votre marché',
    body: 'Tunisie et Afrique francophone. Français, arabe, dialecte. WhatsApp comme canal principal.',
  },
] as const;

export function Fonctionnalites() {
  return (
    <PublicPageShell>
      <PublicHero
        eyebrow="Fonctionnalités"
        title="Le commercial qui ne dort jamais."
        subtitle="Pendant que votre équipe vend, les agents IA passent le marché au peigne fin. Vous ouvrez Ciblix : cinq entreprises, la raison, le message."
        cta={{ label: 'Essayer gratuitement', to: '/register' }}
      />

      <PublicSection className="max-w-5xl">
        <div className="mb-10 max-w-2xl">
          <p className="mb-2 inline-flex items-center gap-2 text-sm font-semibold text-[#1E72B9]">
            <Sparkles size={14} /> Ce qui compte vraiment
          </p>
          <h2 className="font-serif text-2xl font-bold tracking-tight md:text-3xl">
            Zéro saisie d’abord. Le reste suit.
          </h2>
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          {PILLARS.map((p) => (
            <div
              key={p.id}
              id={p.id}
              className="scroll-mt-28 rounded-2xl border border-[#BED6F6]/50 bg-[#f7faff] p-6"
            >
              <p.icon className="mb-3 h-5 w-5 text-[#016AEB]" />
              <h3 className="mb-2 text-base font-semibold">{p.title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{p.body}</p>
            </div>
          ))}
        </div>
      </PublicSection>

      <PublicSection className="max-w-3xl border-t border-neutral-100">
        <h2 className="mb-4 font-serif text-2xl font-bold">Comment ça s’enchaîne</h2>
        <ol className="space-y-4 text-muted-foreground">
          <li>
            <strong className="text-foreground">1. Vous configurez une fois</strong> votre activité et
            votre cible.
          </li>
          <li>
            <strong className="text-foreground">2. Les agents travaillent en continu</strong> —
            entreprises, qualification, interlocuteur, message.
          </li>
          <li>
            <strong className="text-foreground">3. Vous décidez et vous vendez</strong> — puis vous
            dictez quinze secondes.
          </li>
          <li>
            <strong className="text-foreground">4. Le système apprend</strong> : pertinent / pas pour
            moi. Au bout de quelques dizaines de fiches, les propositions sont taillées pour vous.
          </li>
        </ol>
        <div className="mt-10 flex flex-wrap gap-3">
          <Button asChild className="gap-2 bg-[#016AEB] hover:bg-[#0159c4]">
            <Link to="/solutions">
              Voir les solutions <ArrowRight size={16} />
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/tarifs">Tarifs</Link>
          </Button>
        </div>
      </PublicSection>
    </PublicPageShell>
  );
}
