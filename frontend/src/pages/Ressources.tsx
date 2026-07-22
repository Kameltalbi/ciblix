import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BookOpen,
  Building2,
  CircleHelp,
  FileText,
  HardHat,
  Home,
  Newspaper,
  Shield,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LandingFooter, LandingHeader } from '@/components/landing/LandingSections';
import { cn } from '@/lib/utils';

type TabId = 'guides' | 'usecases' | 'docs' | 'blog' | 'faq';

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'guides', label: 'Guides' },
  { id: 'usecases', label: "Cas d'usage" },
  { id: 'docs', label: 'Documentation' },
  { id: 'blog', label: 'Blog' },
  { id: 'faq', label: 'FAQ' },
];

const GUIDES = [
  {
    title: "Pourquoi votre PME n'a pas besoin d'un CRM pour vendre mieux",
    body: 'Explique la logique du pipeline automatique et l’argumentaire zéro saisie manuelle.',
  },
  {
    title: 'Comment transformer vos conversations WhatsApp en pipeline commercial',
    body: 'Pertinent là où WhatsApp est le canal n°1 — de la conversation à la fiche contact.',
  },
  {
    title: 'Guide : configurer votre premier agent en 5 minutes',
    body: 'Onboarding rapide pour réduire la friction de l’essai gratuit.',
  },
  {
    title: 'Comprendre le scoring de vos prospects',
    body: 'Comment le statut chaud / tiède / froid est calculé — pour faire confiance à l’automatisation.',
  },
  {
    title: 'Multilingue et dialectes : comment Ciblix comprend vos conversations',
    body: 'Le différenciateur technique : français, arabe et dialectes, pas seulement l’anglais.',
  },
];

const USE_CASES = [
  {
    sector: 'BTP / Construction',
    icon: HardHat,
    problem: 'Appels d’offres manqués, suivi de chantiers et relances dispersés.',
    agents: 'Veilleur IA + Assistant IA + Rédacteur d’offres',
    result: 'Opportunités détectées et offres alignées sur les échanges réels.',
  },
  {
    sector: 'Assurance',
    icon: Shield,
    problem: 'Qualifications longues, conversations WhatsApp difficiles à capitaliser.',
    agents: 'Chasseur IA + Assistant IA + Gmail IA',
    result: 'Pipeline inféré automatiquement à partir des échanges clients.',
  },
  {
    sector: 'Immobilier',
    icon: Home,
    problem: 'Visites et appels oubliés, suivi prospect incohérent.',
    agents: 'Assistant IA + Chasseur IA + Rédacteur d’offres',
    result: 'Historique unique par prospect, propositions plus rapides.',
  },
  {
    sector: 'Services / conseil',
    icon: Building2,
    problem: 'CRM peu utilisé, expertise client captée uniquement à l’oral.',
    agents: 'Assistant IA + Gmail IA + Vérificateur IA',
    result: 'Mémoire commerciale sans saisie, offres et réponses plus fiables.',
  },
];

const DOCS = [
  { title: 'Démarrage rapide — Chasseur IA', href: '/agent/hunt-ai' },
  { title: 'Démarrage rapide — Assistant IA', href: '/agent/copilot-ia' },
  { title: 'Démarrage rapide — Veilleur IA', href: '/agent/scout-ai' },
  { title: "Démarrage rapide — Rédacteur d'offres", href: '/agent/offre-bot' },
  { title: 'Démarrage rapide — Gmail IA', href: '/register' },
  { title: 'Démarrage rapide — Vérificateur IA', href: '/agent/factcheck-ai' },
  { title: 'Connecter WhatsApp Business', href: 'mailto:contact@ciblix.com?subject=WhatsApp%20Business' },
  { title: 'Connecter Zoom', href: 'mailto:contact@ciblix.com?subject=Connexion%20Zoom' },
  { title: 'Configurer un webhook CRM externe', href: 'mailto:contact@ciblix.com?subject=Webhook%20CRM' },
  { title: 'Facturation et paliers', href: '/tarifs' },
  { title: 'Politique de confidentialité', href: '/legal/privacy' },
  { title: "Conditions d'utilisation", href: '/legal/cgu' },
];

const BLOG = [
  {
    title: 'Annonces produit',
    body: 'Nouvelles fonctionnalités et évolutions de la plateforme.',
    status: 'Bientôt',
  },
  {
    title: 'Vente & digitalisation PME (Tunisie / MENA)',
    body: 'Tendances, WhatsApp commercial, adoption des outils IA.',
    status: 'Bientôt',
  },
  {
    title: 'Ciblix vs CRM classique',
    body: 'Comparatif argumenté — sans dénigrer, avec le vrai différenciateur : la mémoire partagée.',
    status: 'Bientôt',
  },
];

const FAQ: Array<{ theme: string; items: Array<{ q: string; a: string }> }> = [
  {
    theme: "Sur l'essai gratuit",
    items: [
      {
        q: "Ai-je besoin d'une carte bancaire ?",
        a: 'Non. L’essai de 7 jours démarre sans carte bancaire.',
      },
      {
        q: 'Quels agents sont inclus dans l’essai ?',
        a: 'Toujours les 3 mêmes : Chasseur IA, Assistant IA et Rédacteur d’offres — pour démontrer l’effet réseau.',
      },
      {
        q: 'Que se passe-t-il à la fin des 7 jours ?',
        a: 'Avec un moyen de paiement, le palier choisi passe en actif. Sinon, accès en lecture seule jusqu’à reprise de l’abonnement.',
      },
    ],
  },
  {
    theme: 'Sur les données et la confidentialité',
    items: [
      {
        q: 'Mes conversations sont-elles stockées ?',
        a: 'Les événements utiles (résumés, scores, actions) sont conservés pour alimenter la mémoire contact. Les contenus bruts sensibles peuvent être limités dans le temps selon la configuration.',
      },
      {
        q: 'Puis-je supprimer les données d’un contact ?',
        a: 'Oui. Les mécanismes de consentement et d’effacement sont prévus ; le client reste responsable du consentement auprès de ses propres contacts.',
      },
      {
        q: 'Où sont hébergées mes données ?',
        a: 'Sur une infrastructure sécurisée, avec une politique de confidentialité transparente — voir /legal/privacy.',
      },
    ],
  },
  {
    theme: 'Sur le fonctionnement',
    items: [
      {
        q: "Ai-je besoin d'un CRM pour utiliser Ciblix ?",
        a: 'Non. Le pipeline se construit dès le premier agent. Un CRM externe est optionnel via webhook.',
      },
      {
        q: 'Comment les agents partagent-ils l’information ?',
        a: 'Via une mémoire commune (Contact + AgentEvent) et une déduplication automatique (téléphone, email, WhatsApp).',
      },
      {
        q: 'Puis-je connecter HubSpot, Zoho ou Salesforce ?',
        a: 'Oui, via webhook sortant : Ciblix agit comme couche d’intelligence par-dessus votre CRM.',
      },
    ],
  },
  {
    theme: 'Sur la facturation',
    items: [
      {
        q: 'Puis-je changer de palier à tout moment ?',
        a: 'Oui. Les paliers Découverte, Croissance, Pro et Enterprise sont gérés depuis les paramètres de facturation.',
      },
      {
        q: 'Facturez-vous en TND ou en devise étrangère ?',
        a: 'Les trois devises sont prévues : TND, EUR et USD — selon votre choix à l’inscription / sur /tarifs.',
      },
    ],
  },
];

export function Ressources() {
  const [tab, setTab] = useState<TabId>('faq');
  const [openFaq, setOpenFaq] = useState<string | null>(FAQ[0]?.items[0]?.q ?? null);

  const tabIntro = useMemo(() => {
    switch (tab) {
      case 'guides':
        return 'Pédagogie pour lever les objections avant qu’elles soient posées.';
      case 'usecases':
        return 'Scénarios types par secteur (illustratifs) — problème → agents → résultat.';
      case 'docs':
        return 'Aide opérationnelle pour démarrer et connecter vos outils.';
      case 'blog':
        return 'Actualité produit et contenus de fond — en cours de publication.';
      case 'faq':
        return 'Les réponses aux questions les plus fréquentes avant et pendant l’essai.';
    }
  }, [tab]);

  return (
    <div className="min-h-screen bg-white">
      <LandingHeader />

      <main>
        <section className="border-b border-[#BED6F6]/30 bg-gradient-to-b from-[#f7faff] to-white">
          <div className="mx-auto max-w-3xl px-4 py-14 text-center sm:px-6 md:py-20">
            <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#BED6F6]/70 bg-white/80 px-3 py-1 text-sm font-medium text-[#1E72B9]">
              <Sparkles size={14} className="text-[#016AEB]" /> Ressources
            </p>
            <h1 className="mb-4 font-serif text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
              Preuves, guides et réponses
            </h1>
            <p className="text-lg text-muted-foreground">
              Pour les prospects qui hésitent encore — et pour les équipes qui utilisent déjà Ciblix.
            </p>
          </div>

          <div className="mx-auto max-w-5xl px-4 pb-6 sm:px-6">
            <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={cn(
                    'shrink-0 rounded-full px-4 py-2 text-sm font-bold transition',
                    tab === t.id
                      ? 'bg-[#016AEB] text-white'
                      : 'border border-[#BED6F6]/60 bg-white text-foreground/70 hover:text-[#0071DD]'
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <p className="mt-4 text-sm text-muted-foreground">{tabIntro}</p>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6 md:py-16">
          {tab === 'guides' && (
            <div className="grid gap-4 md:grid-cols-2">
              {GUIDES.map((g) => (
                <article key={g.title} className="rounded-2xl border border-[#BED6F6]/40 bg-white p-5">
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-[#eef4fc] text-[#016AEB]">
                    <BookOpen size={18} />
                  </div>
                  <h2 className="mb-2 text-base font-semibold leading-snug">{g.title}</h2>
                  <p className="text-sm text-muted-foreground">{g.body}</p>
                  <p className="mt-3 text-xs font-medium text-[#1E72B9]">Article à venir</p>
                </article>
              ))}
            </div>
          )}

          {tab === 'usecases' && (
            <div className="space-y-4">
              <p className="rounded-xl border border-amber-200/80 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                Scénarios types illustratifs — pas encore d’études de cas clients nommées publiquement.
              </p>
              <div className="grid gap-4 md:grid-cols-2">
                {USE_CASES.map((c) => (
                  <article key={c.sector} className="rounded-2xl border border-[#BED6F6]/40 bg-white p-5">
                    <div className="mb-3 flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#eef4fc] text-[#016AEB]">
                        <c.icon size={18} />
                      </div>
                      <h2 className="font-semibold">{c.sector}</h2>
                    </div>
                    <p className="mb-2 text-sm">
                      <span className="font-semibold text-foreground">Problème : </span>
                      <span className="text-muted-foreground">{c.problem}</span>
                    </p>
                    <p className="mb-2 text-sm">
                      <span className="font-semibold text-foreground">Agents : </span>
                      <span className="text-muted-foreground">{c.agents}</span>
                    </p>
                    <p className="text-sm">
                      <span className="font-semibold text-foreground">Résultat : </span>
                      <span className="text-muted-foreground">{c.result}</span>
                    </p>
                  </article>
                ))}
              </div>
            </div>
          )}

          {tab === 'docs' && (
            <ul className="divide-y divide-[#BED6F6]/40 overflow-hidden rounded-2xl border border-[#BED6F6]/40 bg-white">
              {DOCS.map((d) => {
                const isMailOrHttp = d.href.startsWith('mailto:') || d.href.startsWith('http');
                return (
                  <li key={d.title}>
                    {isMailOrHttp ? (
                      <a
                        href={d.href}
                        className="flex items-center gap-3 px-4 py-3.5 text-sm font-medium text-foreground/80 transition hover:bg-[#f7faff] hover:text-[#0071DD]"
                      >
                        <FileText size={16} className="shrink-0 text-[#016AEB]" />
                        {d.title}
                      </a>
                    ) : (
                      <Link
                        to={d.href}
                        className="flex items-center gap-3 px-4 py-3.5 text-sm font-medium text-foreground/80 transition hover:bg-[#f7faff] hover:text-[#0071DD]"
                      >
                        <FileText size={16} className="shrink-0 text-[#016AEB]" />
                        {d.title}
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {tab === 'blog' && (
            <div className="grid gap-4 md:grid-cols-3">
              {BLOG.map((b) => (
                <article key={b.title} className="rounded-2xl border border-[#BED6F6]/40 bg-white p-5">
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-[#eef4fc] text-[#016AEB]">
                    <Newspaper size={18} />
                  </div>
                  <h2 className="mb-2 font-semibold">{b.title}</h2>
                  <p className="mb-3 text-sm text-muted-foreground">{b.body}</p>
                  <span className="inline-flex rounded-full bg-[#eef4fc] px-2.5 py-0.5 text-xs font-semibold text-[#1E72B9]">
                    {b.status}
                  </span>
                </article>
              ))}
            </div>
          )}

          {tab === 'faq' && (
            <div className="space-y-8">
              {FAQ.map((group) => (
                <div key={group.theme}>
                  <h2 className="mb-3 flex items-center gap-2 font-serif text-xl font-bold">
                    <CircleHelp size={18} className="text-[#016AEB]" />
                    {group.theme}
                  </h2>
                  <div className="space-y-2">
                    {group.items.map((item) => {
                      const open = openFaq === item.q;
                      return (
                        <div key={item.q} className="rounded-2xl border border-[#BED6F6]/40 bg-white">
                          <button
                            type="button"
                            className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left text-sm font-semibold"
                            onClick={() => setOpenFaq(open ? null : item.q)}
                          >
                            {item.q}
                            <span className="text-[#016AEB]">{open ? '−' : '+'}</span>
                          </button>
                          {open ? (
                            <p className="border-t border-[#BED6F6]/30 px-4 py-3 text-sm leading-relaxed text-muted-foreground">
                              {item.a}
                            </p>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="bg-gradient-to-br from-[#0a2540] via-[#016AEB] to-[#1E72B9] py-14 text-white md:py-16">
          <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
            <h2 className="mb-3 font-serif text-2xl font-bold md:text-3xl">Prêt à tester sans carte bancaire ?</h2>
            <p className="mb-7 text-white/80">Essai 7 jours — Chasseur IA, Assistant IA et Rédacteur d’offres.</p>
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
                  Comment ça fonctionne
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
