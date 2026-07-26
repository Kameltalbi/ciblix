import { Link } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import {
  ArrowRight,
  Building2,
  Mic,
  PenLine,
  Radar,
  Search,
  UserRound,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PublicHero, PublicPageShell, PublicSection } from '@/components/landing/PublicPageShell';
import { cn } from '@/lib/utils';

type Block = {
  id: string;
  name: string;
  role: string;
  icon: LucideIcon;
  problem: string;
  does: string[];
  highlight?: boolean;
};

const SOLUTIONS: Block[] = [
  {
    id: 'prospecteur',
    name: 'Prospecteur',
    role: 'Trouver qui appeler',
    icon: Search,
    problem: 'Chercher qui contacter consomme des journées entières.',
    does: [
      'Interroge d’abord le référentiel d’entreprises, puis complète si besoin',
      'Propose des entreprises alignées sur votre cible',
      'Chaque opportunité arrive avec sa raison — pas seulement un nom',
    ],
  },
  {
    id: 'analyste',
    name: 'Analyste',
    role: 'Qualifier sans remplir de cases',
    icon: UserRound,
    problem: 'Vérifier si l’entreprise vaut le coup prend trop de temps.',
    does: [
      'Évalue le fit par rapport à votre offre',
      'Repère le besoin et les signaux utiles',
      'Archive avec motif si le score est insuffisant — jamais sans raison',
    ],
  },
  {
    id: 'redacteur',
    name: 'Rédacteur',
    role: 'Le message déjà écrit',
    icon: PenLine,
    problem: 'Chaque message rédigé à la main ralentit la prospection.',
    does: [
      'Prépare un brouillon prêt à valider',
      'Vérifie qu’il décrit votre offre — pas une invention',
      'Rien ne part sans votre accord',
    ],
  },
  {
    id: 'scribe',
    name: 'Scribe',
    role: 'Zéro saisie après l’appel',
    icon: Mic,
    highlight: true,
    problem: 'Le CRM transforme le commercial en agent de saisie.',
    does: [
      'Vous dictez quinze secondes',
      'Résumé, objection, date de relance s’écrivent',
      'La fiche remonte au bon moment avec le contexte',
    ],
  },
  {
    id: 'veilleur',
    name: 'Veilleur',
    role: 'Réveiller les dossiers dormants',
    icon: Radar,
    problem: 'Les relances se perdent ; les signaux du marché passent inaperçus.',
    does: [
      'Surveille appels d’offres, recrutements, investissements',
      'Relie un signal à une fiche déjà connue chez vous',
      'Remonte : « vous les aviez contactés… ils viennent de recruter »',
    ],
  },
];

const AUDIENCES: Array<{ title: string; body: string; icon: LucideIcon }> = [
  {
    icon: UserRound,
    title: 'Indépendant / TPE',
    body: 'Prospection + qualification. Volume adapté. Commencer sans équipe IT.',
  },
  {
    icon: Users,
    title: 'PME, 2 à 10 commerciaux',
    body: 'Tout le flux, avec le Scribe et la résurgence automatique — le levier de rétention.',
  },
  {
    icon: Building2,
    title: 'Direction commerciale',
    body: 'Vision consolidée, plusieurs marchés, connecteur vers votre CRM existant.',
  },
];

export function Solutions() {
  return (
    <PublicPageShell>
      <PublicHero
        eyebrow="Solutions"
        title="Une équipe d’agents. Un seul job : que vous vendiez."
        subtitle="Chaque agent résout une douleur concrète. Aucun ne vous demande de remplir un formulaire."
        cta={{ label: 'Essayer gratuitement', to: '/register' }}
      />

      <PublicSection className="max-w-5xl">
        <div className="mb-8 flex flex-wrap gap-2">
          {SOLUTIONS.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="rounded-full border border-[#BED6F6]/60 bg-white px-3 py-1.5 text-xs font-semibold text-[#0071DD] transition hover:bg-[#eef4fc]"
            >
              {s.name}
            </a>
          ))}
        </div>
        <div className="space-y-6">
          {SOLUTIONS.map((s) => (
            <article
              key={s.id}
              id={s.id}
              className={cn(
                'scroll-mt-28 rounded-2xl border p-6 md:p-8',
                s.highlight
                  ? 'border-[#016AEB]/40 bg-[#f0f7ff]'
                  : 'border-[#BED6F6]/50 bg-[#f7faff]'
              )}
            >
              <div className="mb-3 flex items-center gap-3">
                <s.icon className="h-5 w-5 text-[#016AEB]" />
                <div>
                  <h2 className="text-lg font-semibold">{s.name}</h2>
                  <p className="text-xs font-medium text-[#1E72B9]">{s.role}</p>
                </div>
              </div>
              <p className="mb-4 text-sm text-muted-foreground">{s.problem}</p>
              <ul className="space-y-2 text-sm text-foreground/80">
                {s.does.map((d) => (
                  <li key={d} className="flex gap-2">
                    <span className="text-[#016AEB]">•</span>
                    <span>{d}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </PublicSection>

      <PublicSection className="max-w-5xl border-t border-neutral-100">
        <h2 className="mb-6 font-serif text-2xl font-bold">Pour qui</h2>
        <div className="grid gap-5 md:grid-cols-3">
          {AUDIENCES.map((a) => (
            <div key={a.title} className="rounded-2xl border border-neutral-200 bg-white p-5">
              <a.icon className="mb-3 h-5 w-5 text-[#016AEB]" />
              <h3 className="mb-2 font-semibold">{a.title}</h3>
              <p className="text-sm text-muted-foreground">{a.body}</p>
            </div>
          ))}
        </div>
        <div className="mt-10">
          <Button asChild className="gap-2 bg-[#016AEB] hover:bg-[#0159c4]">
            <Link to="/tarifs">
              Voir les tarifs <ArrowRight size={16} />
            </Link>
          </Button>
        </div>
      </PublicSection>
    </PublicPageShell>
  );
}
