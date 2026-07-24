import { Link } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import {
  ArrowRight,
  Bot,
  FileSignature,
  Network,
  Radio,
  Radar,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LandingFooter, LandingHeader } from '@/components/landing/LandingSections';
import { cn } from '@/lib/utils';

type Solution = {
  id: string;
  name: string;
  role: string;
  icon: LucideIcon;
  problem: string;
  does: string[];
  feeds: string;
  highlight?: boolean;
  note?: string;
};

const SOLUTIONS: Solution[] = [
  {
    id: 'chasseur',
    name: 'Chasseur IA',
    role: 'Prospection & qualification',
    icon: Radio,
    problem: 'Trouver de nouveaux clients potentiels prend du temps et la qualification manuelle est fastidieuse.',
    does: [
      'Recherche des entreprises ciblées selon vos critères (secteur, zone géographique)',
      'Attribue un score de qualification automatique à chaque prospect',
      'Rédige des messages de prospection personnalisés, prêts à envoyer',
      'Peut automatiser la recherche périodiquement — sans relancer manuellement',
    ],
    feeds: 'Chaque prospect crée une fiche contact ; messages et réponses enrichissent l’historique visible par tous les agents.',
  },
  {
    id: 'assistant',
    name: 'Assistant IA (Copilot)',
    role: 'Le cœur du produit',
    icon: Bot,
    highlight: true,
    problem:
      'Les conversations commerciales (appels, WhatsApp) sont vite oubliées ou mal exploitées, et personne n’a le temps de tout noter.',
    does: [
      'Transcrit appels et WhatsApp — en français, arabe et dialectes',
      'Génère un résumé : besoin, objections, budget, échéance',
      'Attribue un score de qualification adapté à votre secteur',
      'Suggère les prochaines actions',
      'Briefing quotidien et chat pour interroger votre activité',
      'Prédit le chiffre d’affaires de fin d’année à partir des tendances',
    ],
    feeds: 'Chaque conversation devient un événement rattaché au contact — consultable par tous les autres agents.',
  },
  {
    id: 'veilleur',
    name: 'Veilleur IA',
    role: "Veille & détection d'opportunités",
    icon: Radar,
    problem: "Les appels d'offres et opportunités de marché passent souvent inaperçus, faute de temps pour les surveiller.",
    does: [
      "Recherche activement les appels d'offres pertinents",
      'Détecte événements et salons dans votre secteur',
      'Analyse les résultats et évalue leur pertinence',
      'Analyse le contenu d’une URL',
      'Sauvegarde les opportunités pour suivi',
    ],
    feeds: 'Si l’opportunité est liée à un contact identifiable, elle enrichit la fiche — sinon elle reste une veille pure.',
  },
  {
    id: 'redacteur',
    name: "Rédacteur d'offres",
    role: "Préparation d'offres commerciales",
    icon: FileSignature,
    problem:
      'Rédiger une proposition personnalisée à chaque fois prend du temps et manque souvent de cohérence avec ce qui a été discuté.',
    does: [
      'Génère une offre personnalisée à partir des données client / affaire',
      'Permet de personnaliser le ton',
      'Ajoute automatiquement les conditions générales',
      'Exporte l’offre en texte',
      'Régénère une section sans tout refaire',
    ],
    feeds: 'S’appuie sur l’historique réel analysé par Assistant IA — l’offre reflète ce qui a vraiment été dit.',
  },
];

export function Solutions() {
  return (
    <div className="min-h-screen bg-white">
      <LandingHeader />

      <main>
        <section className="relative overflow-hidden border-b border-[#BED6F6]/30 bg-gradient-to-b from-[#f7faff] to-white">
          <div className="pointer-events-none absolute -left-16 top-10 h-64 w-64 rounded-full bg-[#016AEB]/10 blur-3xl" />
          <div className="relative mx-auto max-w-3xl px-4 py-16 text-center sm:px-6 md:py-24">
            <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#BED6F6]/70 bg-white/80 px-3 py-1 text-sm font-medium text-[#1E72B9]">
              <Sparkles size={14} className="text-[#016AEB]" /> Solutions
            </p>
            <h1 className="mb-5 font-serif text-3xl font-bold tracking-tight text-foreground sm:text-4xl md:text-5xl">
              Les 4 solutions, en détail
            </h1>
            <p className="text-lg leading-relaxed text-muted-foreground md:text-xl">
              Chaque agent résout un problème concret — et alimente la même mémoire. Voici ce qu’ils font, un par un.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-2">
              {SOLUTIONS.map((s) => (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  className="rounded-full border border-[#BED6F6]/60 bg-white px-3 py-1.5 text-xs font-semibold text-[#0071DD] transition hover:border-[#016AEB]/40 hover:bg-[#eef4fc]"
                >
                  {s.name}
                </a>
              ))}
            </div>
          </div>
        </section>

        <div className="mx-auto max-w-3xl space-y-10 px-4 py-14 sm:px-6 md:py-20">
          {SOLUTIONS.map((s, index) => (
            <article
              key={s.id}
              id={s.id}
              className={cn(
                'scroll-mt-28 rounded-3xl border p-6 sm:p-8',
                s.highlight
                  ? 'border-[#016AEB]/25 bg-gradient-to-br from-[#f7faff] to-white shadow-sm ring-1 ring-[#016AEB]/10'
                  : 'border-[#BED6F6]/40 bg-white'
              )}
            >
              <div className="mb-5 flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#eef4fc] text-[#016AEB]">
                  <s.icon size={22} />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#1E72B9]">
                    {index + 1}. {s.role}
                  </p>
                  <h2 className="font-serif text-2xl font-bold tracking-tight text-foreground">{s.name}</h2>
                </div>
              </div>

              <div className="mb-5 rounded-2xl bg-[#f7faff] px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#1E72B9]">Le problème</p>
                <p className="mt-1 text-sm leading-relaxed text-foreground/80">{s.problem}</p>
              </div>

              <h3 className="mb-3 text-sm font-semibold text-foreground">Ce qu’il fait concrètement</h3>
              <ul className="mb-5 space-y-2">
                {s.does.map((item) => (
                  <li key={item} className="flex gap-2.5 text-sm leading-relaxed text-muted-foreground">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#016AEB]" />
                    {item}
                  </li>
                ))}
              </ul>

              <div className="rounded-2xl border border-[#BED6F6]/50 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#1E72B9]">En coulisses</p>
                <p className="mt-1 text-sm leading-relaxed text-foreground/80">{s.feeds}</p>
                {s.note ? <p className="mt-2 text-sm italic text-muted-foreground">{s.note}</p> : null}
              </div>
            </article>
          ))}
        </div>

        <section className="border-y border-[#BED6F6]/30 bg-[#f7faff] py-16 md:py-20">
          <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-[#016AEB] shadow-sm">
              <Network size={22} />
            </div>
            <h2 className="mb-4 font-serif text-2xl font-bold tracking-tight md:text-3xl">
              Ce qui relie les 6 solutions
            </h2>
            <p className="leading-relaxed text-muted-foreground">
              Aucun agent ne fonctionne en silo. Un prospect trouvé par Chasseur IA, analysé en appel par Assistant IA,
              puis suivi dans votre pipeline,{' '}
              <strong className="font-semibold text-foreground">reste le même contact</strong> avec un historique unique —
              sans saisie manuelle. Gmail se branche à part via Connecteurs. C’est cette mémoire commune qui constitue la
              vraie valeur de Ciblix.
            </p>
          </div>
        </section>

        <section className="bg-gradient-to-br from-[#0a2540] via-[#016AEB] to-[#1E72B9] py-16 text-white md:py-20">
          <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
            <h2 className="mb-4 font-serif text-2xl font-bold tracking-tight md:text-3xl">
              Testez l’effet réseau en 7 jours
            </h2>
            <p className="mb-8 text-white/80">
              L’essai gratuit active Chasseur IA, Assistant IA et Rédacteur d’offres — pour voir la mémoire commune en
              action, pas un agent isolé.
            </p>
            <div className="flex flex-col justify-center gap-3 sm:flex-row">
              <Link to="/register?trial=7">
                <Button size="lg" className="w-full bg-white px-8 text-[#016AEB] hover:bg-white/90 sm:w-auto">
                  Commencer l’essai <ArrowRight size={18} className="ml-2" />
                </Button>
              </Link>
              <Link to="/fonctionnalites">
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full border-white/40 bg-transparent px-8 text-white hover:bg-white/10 sm:w-auto"
                >
                  Voir comment ça fonctionne
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <LandingFooter />
    </div>
  );
}
