import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  FileSignature,
  MessageCircle,
  Network,
  Radio,
  Radar,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LandingFooter, LandingHeader } from '@/components/landing/LandingSections';

const AGENTS = [
  {
    name: 'Chasseur IA',
    icon: Radio,
    desc: 'Trouve des prospects ciblés par secteur/zone, les qualifie, envoie des messages de prospection personnalisés.',
  },
  {
    name: 'Assistant IA (Copilot)',
    icon: Bot,
    desc: 'Écoute et analyse vos conversations (appels, WhatsApp) — transcription multilingue, résumé, score et actions. Cœur du produit.',
    highlight: true,
  },
  {
    name: 'Veilleur IA',
    icon: Radar,
    desc: "Surveille les appels d'offres et détecte les opportunités pertinentes.",
  },
  {
    name: "Rédacteur d'offres",
    icon: FileSignature,
    desc: 'Génère des propositions commerciales personnalisées à partir de l’historique réel des échanges.',
  },
] as const;

const JOURNEY = [
  'Chasseur IA trouve un prospect → une fiche contact apparaît automatiquement',
  'Assistant IA analyse un appel ou WhatsApp → résumé, score, actions générés',
  'Le contact affiche tout son historique, quel que soit l’agent qui a capté chaque info',
  "Rédacteur d'offres génère une proposition en un clic à partir du besoin exprimé",
] as const;

const DIFFS = [
  {
    title: 'Multilingue natif',
    body: 'Transcription et analyse en français, arabe et dialectes — pas seulement en anglais.',
  },
  {
    title: 'WhatsApp comme canal natif',
    body: 'Capte et analyse les conversations là où elles se passent réellement.',
  },
  {
    title: 'Zéro CRM requis pour démarrer',
    body: 'Le pipeline existe dès le premier agent activé — sans kanban à remplir.',
  },
  {
    title: 'Configurable par secteur',
    body: 'Lexique métier et grille de qualification adaptables (BTP, assurance, immobilier…).',
  },
] as const;

export function Fonctionnalites() {
  return (
    <div className="min-h-screen bg-white">
      <LandingHeader />

      <main>
        {/* Intro */}
        <section className="relative overflow-hidden border-b border-[#BED6F6]/30 bg-gradient-to-b from-[#f7faff] to-white">
          <div className="pointer-events-none absolute -right-20 top-0 h-72 w-72 rounded-full bg-[#016AEB]/10 blur-3xl" />
          <div className="relative mx-auto max-w-3xl px-4 py-16 text-center sm:px-6 md:py-24">
            <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#BED6F6]/70 bg-white/80 px-3 py-1 text-sm font-medium text-[#1E72B9]">
              <Sparkles size={14} className="text-[#016AEB]" /> Fonctionnalités
            </p>
            <h1 className="mb-5 font-serif text-3xl font-bold tracking-tight text-foreground sm:text-4xl md:text-5xl">
              Comment ça fonctionne
            </h1>
            <p className="text-lg leading-relaxed text-muted-foreground md:text-xl">
              Ciblix est une plateforme de 6 agents IA pour PME et équipes de vente qui, contrairement à un CRM
              classique ou à des outils isolés,{' '}
              <strong className="font-semibold text-foreground">partagent automatiquement ce qu’ils apprennent</strong>{' '}
              — sans saisie manuelle, sans pipeline à remplir à la main.
            </p>
          </div>
        </section>

        {/* Mémoire commune */}
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-20">
          <div className="mb-10 max-w-2xl">
            <h2 className="mb-3 font-serif text-2xl font-bold tracking-tight md:text-3xl">
              Une mémoire commune, pas 6 outils séparés
            </h2>
            <p className="text-muted-foreground">
              Chaque agent alimente une mémoire partagée. Peu importe qui capte l’info en premier — tout converge sur
              la même fiche grâce à une déduplication automatique (téléphone, email, WhatsApp).
            </p>
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            <div className="rounded-2xl border border-[#BED6F6]/50 bg-[#f7faff] p-6">
              <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-white text-[#016AEB] shadow-sm">
                <Network size={22} />
              </div>
              <h3 className="mb-2 text-base font-semibold">Contact</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Fiche minimale d’une personne ou entreprise (téléphone, email, WhatsApp, nom) — créée automatiquement,
                jamais saisie à la main.
              </p>
            </div>
            <div className="rounded-2xl border border-[#BED6F6]/50 bg-[#f7faff] p-6">
              <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-white text-[#016AEB] shadow-sm">
                <MessageCircle size={22} />
              </div>
              <h3 className="mb-2 text-base font-semibold">AgentEvent</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Chaque interaction captée (appel, WhatsApp, email, opportunité) — avec résumé, score et actions
                suggérées, générés par IA.
              </p>
            </div>
          </div>
          <p className="mt-6 text-sm font-medium text-[#0071DD]">
            Résultat : un pipeline commercial qui se construit tout seul.
          </p>
        </section>

        {/* 6 agents */}
        <section className="bg-[#f7faff] py-16 md:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 className="mb-8 font-serif text-2xl font-bold tracking-tight md:text-3xl">Les 6 agents</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {AGENTS.map((agent) => (
                <div
                  key={agent.name}
                  className={
                    'highlight' in agent && agent.highlight
                      ? 'rounded-2xl border border-[#016AEB]/30 bg-white p-5 shadow-sm ring-1 ring-[#016AEB]/10'
                      : 'rounded-2xl border border-[#BED6F6]/40 bg-white p-5'
                  }
                >
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-[#eef4fc] text-[#016AEB]">
                    <agent.icon size={20} />
                  </div>
                  <h3 className="mb-1.5 font-semibold text-foreground">{agent.name}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">{agent.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Parcours */}
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-20">
          <h2 className="mb-3 font-serif text-2xl font-bold tracking-tight md:text-3xl">Un parcours concret</h2>
          <p className="mb-8 max-w-2xl text-muted-foreground">
            Aucune étape de saisie manuelle. Le statut du prospect (chaud, à relancer, froid) est{' '}
            <strong className="font-semibold text-foreground">inféré automatiquement</strong> — pas de kanban à
            glisser-déposer.
          </p>
          <ol className="space-y-4">
            {JOURNEY.map((step, i) => (
              <li key={step} className="flex gap-4 rounded-2xl border border-[#BED6F6]/40 bg-white p-4 sm:p-5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#016AEB] text-sm font-bold text-white">
                  {i + 1}
                </span>
                <p className="pt-1 text-sm leading-relaxed text-foreground sm:text-base">{step}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Pourquoi pas CRM */}
        <section className="border-y border-[#BED6F6]/30 bg-[#f7faff] py-16 md:py-20">
          <div className="mx-auto max-w-3xl px-4 sm:px-6">
            <h2 className="mb-4 font-serif text-2xl font-bold tracking-tight md:text-3xl">
              Pourquoi pas un CRM classique
            </h2>
            <p className="mb-4 leading-relaxed text-muted-foreground">
              Sur des marchés où le CRM n’est pas encore une habitude, la saisie manuelle est le principal frein.
              Ciblix inverse la logique : au lieu de « remplissez d’abord un CRM »,{' '}
              <strong className="font-semibold text-foreground">
                les agents alimentent automatiquement la mémoire commune en travaillant
              </strong>{' '}
              — le CRM devient un sous-produit invisible.
            </p>
            <p className="leading-relaxed text-muted-foreground">
              Déjà un HubSpot, Zoho ou Salesforce ? Ciblix peut pousser les infos via webhook — couche
              d’intelligence par-dessus, pas un remplacement forcé.
            </p>
          </div>
        </section>

        {/* Différenciateurs */}
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-20">
          <h2 className="mb-8 font-serif text-2xl font-bold tracking-tight md:text-3xl">Différenciateurs</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {DIFFS.map((d) => (
              <div key={d.title} className="flex gap-3 rounded-2xl border border-[#BED6F6]/40 p-5">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#016AEB]" />
                <div>
                  <h3 className="mb-1 font-semibold">{d.title}</h3>
                  <p className="text-sm text-muted-foreground">{d.body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Commercial + CTA */}
        <section className="bg-gradient-to-br from-[#0a2540] via-[#016AEB] to-[#1E72B9] py-16 text-white md:py-20">
          <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
            <h2 className="mb-4 font-serif text-2xl font-bold tracking-tight md:text-3xl">
              Essai 7 jours — 3 agents en réseau
            </h2>
            <p className="mb-8 text-white/80">
              Paliers Découverte, Croissance, Pro, Enterprise — la valeur vient de l’effet réseau. L’essai active
              Chasseur IA, Assistant IA et Rédacteur d’offres pour le démontrer dès le premier jour.
            </p>
            <div className="flex flex-col justify-center gap-3 sm:flex-row">
              <Link to="/register?trial=7">
                <Button size="lg" className="w-full bg-white px-8 text-[#016AEB] hover:bg-white/90 sm:w-auto">
                  Commencer l’essai gratuit <ArrowRight size={18} className="ml-2" />
                </Button>
              </Link>
              <Link to="/tarifs">
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full border-white/40 bg-transparent px-8 text-white hover:bg-white/10 sm:w-auto"
                >
                  Voir les tarifs
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
