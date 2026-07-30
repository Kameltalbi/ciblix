import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Bot,
  Calendar,
  CheckCircle2,
  Crosshair,
  Link2,
  Mic,
  Settings,
  Shield,
  Sun,
  Target,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type Section = {
  id: string;
  title: string;
  icon: typeof Sun;
  content: ReactNode;
};

function DocTable({ headers, rows }: { headers: [string, string, string?]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-neutral-200">
      <table className="w-full min-w-[520px] text-left text-sm">
        <thead className="bg-[#f7faff]">
          <tr>
            {headers.map((h) => (
              <th key={h} className="px-4 py-3 font-semibold text-foreground">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {rows.map((row, i) => (
            <tr key={i} className="bg-white">
              {row.map((cell, j) => (
                <td key={j} className="px-4 py-3 align-top text-muted-foreground">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StepList({ steps }: { steps: Array<{ title: string; body: string }> }) {
  return (
    <ol className="space-y-4">
      {steps.map((step, i) => (
        <li key={step.title} className="flex gap-4">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#016AEB] text-sm font-bold text-white">
            {i + 1}
          </span>
          <div>
            <p className="font-semibold text-foreground">{step.title}</p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

function CheckList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item} className="flex gap-2 text-sm leading-relaxed text-muted-foreground">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#016AEB]" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

const SECTIONS: Section[] = [
  {
    id: 'introduction',
    title: 'Ciblix en 30 secondes',
    icon: Target,
    content: (
      <>
        <p className="leading-relaxed text-muted-foreground">
          Ciblix est un copilote commercial IA. Il trouve les entreprises à contacter, prépare le
          message, note vos appels après une dictée de quinze secondes, et vous rappelle qui
          relancer — sans formulaire CRM à remplir.
        </p>
        <p className="mt-4 leading-relaxed text-muted-foreground">
          <strong className="text-foreground">Principe clé :</strong> vous décidez, Ciblix exécute.
          Rien n’est envoyé à un client sans votre validation.
        </p>
      </>
    ),
  },
  {
    id: 'demarrage',
    title: 'Premiers pas (5 minutes)',
    icon: Sun,
    content: (
      <>
        <p className="mb-6 text-sm text-muted-foreground">
          À l’inscription, l’assistant <strong className="text-foreground">Mission</strong> vous guide.
          Sans cette étape, les agents ne connaissent pas votre activité.
        </p>
        <StepList
          steps={[
            {
              title: 'Votre entreprise',
              body: 'Indiquez votre site web, page Facebook, LinkedIn ou un bref descriptif. Ciblix en extrait votre activité et vos services.',
            },
            {
              title: 'Vos meilleurs clients',
              body: 'Citez 3 à 5 clients actuels. L’IA en déduit le profil type à rechercher (secteur, taille, zone).',
            },
            {
              title: 'Validez votre cible (ICP)',
              body: 'Relisez le profil client idéal proposé. Corrigez si besoin — c’est la base de toutes les recherches.',
            },
            {
              title: 'Validez votre offre',
              body: 'Vérifiez que les services listés correspondent à ce que vous vendez vraiment. Les messages IA s’appuient sur cette fiche.',
            },
            {
              title: 'Activation',
              body: 'Cliquez sur Activer. Vous arrivez sur Prospection IA avec vos premières pistes.',
            },
          ]}
        />
        <p className="mt-6 text-sm text-muted-foreground">
          Vous pouvez relancer ou modifier la Mission à tout moment via{' '}
          <strong className="text-foreground">Mission</strong> dans le menu ou{' '}
          <strong className="text-foreground">Paramètres → Organisation</strong>.
        </p>
      </>
    ),
  },
  {
    id: 'roles',
    title: 'Les rôles : qui fait quoi ?',
    icon: Users,
    content: (
      <>
        <DocTable
          headers={['Rôle', 'Qui c’est', 'Accès']}
          rows={[
            [
              'Propriétaire (OWNER)',
              'Le responsable du compte entreprise',
              'Tout : équipe, facturation, intégrations, paramètres org, tous les agents',
            ],
            [
              'Partenaire (PARTNER)',
              'Manager ou associé',
              'Tous les écrans commerciaux. Pas la gestion des utilisateurs ni la facturation org',
            ],
            [
              'Commercial (COMMERCIAL)',
              'Vendeur sur le terrain',
              'Écrans autorisés par le propriétaire (Aujourd’hui, Contacts, agents…). Permissions par page',
            ],
          ]}
        />
        <p className="mt-4 text-sm text-muted-foreground">
          Le propriétaire définit, pour chaque commercial, quelles pages il voit et s’il peut créer
          ou modifier des contacts. Chemin : <strong className="text-foreground">Paramètres → Utilisateurs</strong>.
        </p>
      </>
    ),
  },
  {
    id: 'admin',
    title: 'Checklist administrateur',
    icon: Settings,
    content: (
      <>
        <p className="mb-4 text-sm text-muted-foreground">
          À faire une fois (ou quand l’équipe ou l’offre change). Comptez 15 à 30 minutes la première
          fois.
        </p>
        <CheckList
          items={[
            'Terminer la Mission (ICP + offre validés)',
            'Compléter Paramètres → Organisation : nom, logo, secteur, site web',
            'Inviter l’équipe : Paramètres → Utilisateurs → Ajouter un utilisateur',
            'Attribuer le rôle (Commercial / Partenaire) et cocher les pages autorisées',
            'Connecter Gmail si vous utilisez l’agent email : Connecteurs ou Paramètres → Gmail',
            'Configurer WhatsApp (webhook) si c’est votre canal principal : Connecteurs',
            'Régler la veille Scout : mots-clés, secteurs, zones géographiques',
            'Optionnel — automatiser la prospection : Prospection IA → panneau Automatisation',
            'Vérifier le plan et les sièges : Paramètres → Organisation → Facturation',
          ]}
        />
        <div className="mt-6 rounded-xl border border-amber-200/80 bg-amber-50/80 px-4 py-3 text-sm text-amber-950">
          <strong>Important :</strong> tant que l’offre n’est pas validée dans la Mission, les
          messages IA peuvent être bloqués ou moins pertinents. C’est la seule chose que Ciblix ne
          devine jamais à votre place.
        </div>
      </>
    ),
  },
  {
    id: 'commercial',
    title: 'Journée type d’un commercial',
    icon: Calendar,
    content: (
      <>
        <p className="mb-6 text-sm text-muted-foreground">
          Pas de formation longue. Trois gestes suffisent au quotidien.
        </p>
        <StepList
          steps={[
            {
              title: 'Le matin — ouvrir Aujourd’hui',
              body: 'Jusqu’à 5 contacts à relancer aujourd’hui, avec la raison et le message déjà rédigé. Cliquez sur une fiche pour agir.',
            },
            {
              title: 'Contacter le prospect',
              body: 'Depuis la fiche : copier le message, ouvrir WhatsApp, email ou LinkedIn. Vous envoyez — Ciblix ne envoie jamais seul.',
            },
            {
              title: 'Après l’appel — dicter 15 secondes',
              body: 'Bouton « Dicter une note » sur la fiche. Ex. : « Intéressé mais budget bloqué jusqu’en septembre, je rappelle à la rentrée. » Le résumé, l’objection et la date de relance s’écrivent seuls.',
            },
          ]}
        />
        <p className="mt-6 text-sm font-medium text-foreground">
          C’est tout. Pas de case CRM à remplir. Le 1er septembre, la fiche remonte toute seule dans
          Aujourd’hui.
        </p>
      </>
    ),
  },
  {
    id: 'ecrans',
    title: 'Les écrans principaux',
    icon: Sun,
    content: (
      <div className="space-y-5">
        {[
          {
            name: 'Aujourd’hui',
            path: '/aujourdhui',
            desc: 'Votre to-do du jour : relances dues, message prêt, raison du contact.',
          },
          {
            name: 'Contacts',
            path: '/contacts',
            desc: 'Toutes vos fiches entreprise. Filtrez par agent source (Hunt, Scout, Gmail…).',
          },
          {
            name: 'Fiche contact',
            path: '/contacts/:id',
            desc: 'Vue complète : décideur, actualités, historique, message IA, dictée vocale.',
          },
          {
            name: 'Dashboard',
            path: '/dashboard',
            desc: 'Performance du mois : entonnoir, activité des agents, actions du jour.',
          },
          {
            name: 'Mission',
            path: '/mission',
            desc: 'Votre brief commercial : cible, offre, zones. À jour = messages pertinents.',
          },
        ].map((screen) => (
          <div
            key={screen.name}
            className="rounded-xl border border-neutral-200 bg-white px-4 py-3"
          >
            <p className="font-semibold text-foreground">{screen.name}</p>
            <p className="mt-1 text-sm text-muted-foreground">{screen.desc}</p>
            <p className="mt-1 font-mono text-xs text-[#016AEB]">{screen.path}</p>
          </div>
        ))}
      </div>
    ),
  },
  {
    id: 'agents',
    title: 'Prospecteur & fiche client',
    icon: Bot,
    content: (
      <div className="space-y-4">
        {[
          {
            Icon: Crosshair,
            name: 'Prospecteur',
            path: '/prospection-ia',
            role: 'Trouve des entreprises qui correspondent à votre cible. Qualifie et ajoute au pipeline (Contacts).',
          },
          {
            Icon: Users,
            name: 'Fiche contact (le centre)',
            path: '/contacts',
            role: 'Tout converge ici : enrichissement web, actualités, salons, interviews, message, dictée après appel. Les recherches périodiques mettent la fiche à jour.',
          },
          {
            Icon: Mic,
            name: 'Scribe (sur la fiche)',
            path: '/contacts/:id',
            role: 'Après un échange : dictez 15 secondes. En continu : le système relance des recherches sur le client pour enrichir la fiche.',
          },
        ].map(({ Icon, name, path, role }) => (
          <div key={name} className="flex gap-3 rounded-xl border border-neutral-200 px-4 py-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#f7faff] text-[#016AEB]">
              <Icon size={20} />
            </div>
            <div>
              <p className="font-semibold text-foreground">{name}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">{role}</p>
              <p className="mt-1 font-mono text-xs text-neutral-400">{path}</p>
            </div>
          </div>
        ))}
        <p className="text-sm text-muted-foreground">
          Scout, Analyste, Assistant et LinkedIn ne sont plus dans le menu — leur valeur utile
          alimente la <strong className="text-foreground">fiche contact</strong>.
        </p>
      </div>
    ),
  },
  {
    id: 'fiche',
    title: 'La fiche contact en détail',
    icon: Mic,
    content: (
      <>
        <p className="mb-4 leading-relaxed text-muted-foreground">
          Chaque entreprise a une fiche unique. C’est votre centre d’action — pas un formulaire à
          remplir champ par champ.
        </p>
        <CheckList
          items={[
            'Message recommandé : généré par l’IA, modifiable, boutons + Site web / + Signature',
            'Copier le message : un clic pour WhatsApp, email ou LinkedIn',
            'Modifier sans regénérer : le bouton Modifier édite le texte existant',
            'Dicter une note : après un appel, 15 secondes de voix → compte rendu structuré',
            'Onglets : Aperçu, Décideurs, Actualités, Historique, Notes',
            'Statuts pipeline : Découverte → Qualifiée → Contactée → En discussion → Gagnée / Perdue',
          ]}
        />
        <div className="mt-5 rounded-xl bg-[#f7faff] px-4 py-3 text-sm text-muted-foreground">
          <strong className="text-foreground">Astuce :</strong> si le message contient votre site ou
          une signature générique, vérifiez que votre site web est renseigné dans Paramètres →
          Organisation → Métier.
        </div>
      </>
    ),
  },
  {
    id: 'connecteurs',
    title: 'Connecteurs & intégrations',
    icon: Link2,
    content: (
      <>
        <p className="mb-4 text-sm text-muted-foreground">
          Menu <strong className="text-foreground">Connecteurs</strong> — branchez Ciblix à vos outils
          existants.
        </p>
        <DocTable
          headers={['Connecteur', 'Statut', 'Usage']}
          rows={[
            ['Gmail', 'Disponible', 'Brouillons email depuis votre boîte'],
            ['WhatsApp (webhook)', 'Disponible', 'Canal principal de prospection dans la région'],
            ['Webhook CRM', 'Disponible', 'Envoie les fiches vers votre CRM existant'],
            ['Softfacture', 'Disponible', 'Sync clients / facturation'],
            ['Outlook, Calendar, LinkedIn OAuth', 'Bientôt', 'Annoncés dans Connecteurs'],
          ]}
        />
        <p className="mt-4 text-sm text-muted-foreground">
          Vous gardez votre CRM ? Parfait. Ciblix le remplit — vos commerciaux ne l’ouvrent plus.
        </p>
      </>
    ),
  },
  {
    id: 'parametres',
    title: 'Paramètres utiles',
    icon: Settings,
    content: (
      <DocTable
        headers={['Onglet', 'Qui', 'Contenu']}
        rows={[
          ['Organisation', 'Propriétaire', 'Identité, métier, facturation, conformité, règles pipeline'],
          ['Gmail', 'Tous', 'Connexion OAuth à votre compte Google'],
          ['Utilisateurs', 'Propriétaire', 'Invitations, rôles, permissions par page'],
          ['Sécurité', 'Tous', 'Mot de passe, sessions actives'],
        ]}
      />
    ),
  },
  {
    id: 'aide',
    title: 'Besoin d’aide ?',
    icon: Shield,
    content: (
      <>
        <ul className="space-y-3 text-sm">
          {[
            { label: 'FAQ', href: '/faq', desc: 'Questions fréquentes' },
            { label: 'Support', href: '/contact', desc: 'Ouvrir un ticket (menu Support une fois connecté)' },
            { label: 'Contact', href: '/contact', desc: 'Nous écrire' },
            { label: 'Sécurité', href: '/securite', desc: 'Données, RGPD, cloisonnement' },
          ].map((link) => (
            <li key={link.href}>
              <Link
                to={link.href}
                className="group flex items-center justify-between rounded-xl border border-neutral-200 px-4 py-3 transition hover:border-[#016AEB]/40 hover:bg-[#f7faff]"
              >
                <span>
                  <span className="font-semibold text-foreground group-hover:text-[#016AEB]">
                    {link.label}
                  </span>
                  <span className="ml-2 text-muted-foreground">— {link.desc}</span>
                </span>
                <ArrowRight className="h-4 w-4 text-neutral-300 group-hover:text-[#016AEB]" />
              </Link>
            </li>
          ))}
        </ul>
        <div className="mt-6 text-center">
          <Link
            to="/register"
            className="inline-flex items-center gap-2 rounded-lg bg-[#016AEB] px-6 py-3 text-sm font-semibold text-white hover:bg-[#0159c4]"
          >
            Créer mon compte <ArrowRight size={16} />
          </Link>
        </div>
      </>
    ),
  },
];

export function DocumentationGuide() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-10 sm:px-6 lg:flex-row lg:gap-12 lg:px-8 lg:py-14">
      <nav
        aria-label="Sommaire"
        className="lg:sticky lg:top-24 lg:w-56 lg:shrink-0 lg:self-start"
      >
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-neutral-400">
          Sommaire
        </p>
        <ul className="flex flex-wrap gap-2 lg:flex-col lg:gap-0.5">
          {SECTIONS.map((s) => (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                className="block rounded-lg px-3 py-2 text-sm font-medium text-neutral-600 transition hover:bg-[#f7faff] hover:text-[#016AEB] lg:text-[13px]"
              >
                {s.title}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="min-w-0 flex-1 space-y-14">
        {SECTIONS.map((section) => {
          const Icon = section.icon;
          return (
            <section key={section.id} id={section.id} className="scroll-mt-24">
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#016AEB]/10 text-[#016AEB]">
                  <Icon size={20} />
                </div>
                <h2 className="font-serif text-2xl font-bold tracking-tight text-foreground">
                  {section.title}
                </h2>
              </div>
              <div className={cn('prose prose-neutral max-w-none')}>{section.content}</div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
