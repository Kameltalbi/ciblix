import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, Mic } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { DEMO_URL } from './LandingSections';

/** Sections 2–13 du prompt landing — ordre volontaire. */

export function LandingProof() {
  const hasVideo = DEMO_URL.startsWith('http');

  return (
    <section id="demo" className="border-y border-neutral-100 bg-white py-16 md:py-24">
      <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
        <h2 className="font-serif text-3xl font-bold tracking-tight text-foreground md:text-4xl">
          Il a raccroché. Il n’a rien tapé.
        </h2>
        <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
          Regardez : quinze secondes de note vocale après un appel. Le résumé, l’objection, la date
          de relance — tout s’écrit tout seul.
        </p>
      </div>

      <div className="mx-auto mt-10 max-w-3xl px-4 sm:px-6">
        {hasVideo ? (
          <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-950 shadow-lg">
            <video
              className="aspect-video w-full"
              autoPlay
              muted
              loop
              playsInline
              controls={false}
              src={DEMO_URL}
            />
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-[#0b1220] px-5 py-8 text-left shadow-lg sm:px-8">
            <p className="text-xs font-medium uppercase tracking-wide text-white/50">Démo 30 s</p>
            <ol className="mt-6 space-y-5 text-[15px] leading-relaxed text-white/90">
              <li>
                <span className="text-white/40">1.</span> Le commercial parle :{' '}
                <em className="text-white">
                  « J’ai eu Trabelsi, intéressé mais le budget est bloqué jusqu’en septembre, je dois
                  rappeler à la rentrée. »
                </em>
              </li>
              <li>
                <span className="text-white/40">2.</span> La fiche se remplit : résumé · objection ·
                date de relance.
              </li>
              <li>
                <span className="text-white/40">3.</span>{' '}
                <strong className="text-white">
                  « Le 1er septembre, cette fiche remontera toute seule. »
                </strong>
              </li>
            </ol>
            <div className="mt-8 flex items-center gap-2 rounded-xl bg-white/10 px-4 py-3 text-sm text-white/80">
              <Mic size={16} className="text-[#38bdf8]" /> Note vocale · 15 secondes · zéro clavier
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

export function LandingProblemPrompt() {
  const blocks = [
    {
      title: 'Chercher qui appeler',
      body: 'Fouiller LinkedIn, les annuaires, les appels d’offres. Vérifier si l’entreprise existe encore. Trouver le bon interlocuteur. Recommencer demain.',
    },
    {
      title: 'Rédiger, relancer, oublier',
      body: 'Écrire chaque message à la main. Se souvenir de qui rappeler et quand. Les ventes ne se perdent pas sur un refus — elles se perdent sur un oubli.',
    },
    {
      title: 'Remplir des cases',
      body: 'Le CRM a transformé le commercial en agent de saisie. Plus l’outil réclame, moins il est rempli. Et l’information disparaît.',
    },
  ];

  return (
    <section className="bg-[#FAFAFC] py-16 md:py-24">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <h2 className="mx-auto max-w-2xl text-center font-serif text-3xl font-bold tracking-tight md:text-4xl">
          Vos commerciaux passent plus de temps à chercher et à saisir qu’à vendre.
        </h2>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {blocks.map((b) => (
            <div key={b.title} className="border-t border-neutral-300 pt-5">
              <h3 className="text-base font-semibold text-foreground">{b.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{b.body}</p>
            </div>
          ))}
        </div>
        <p className="mt-12 text-center text-lg font-medium text-foreground">
          Sur cinq jours de travail, combien restent pour vendre réellement ?
        </p>
      </div>
    </section>
  );
}

export function LandingAnswer() {
  return (
    <section className="bg-white py-16 md:py-24">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <h2 className="font-serif text-3xl font-bold tracking-tight md:text-4xl">
          Ciblix ne vous demande rien. Il travaille.
        </h2>
        <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
          Vous configurez une fois votre activité et votre marché. Ensuite, une équipe d’agents IA
          prend le relais : elle identifie les entreprises qui comptent pour vous, les qualifie,
          repère le bon interlocuteur, prépare le message — et écrit elle-même le suivi après chaque
          échange.
        </p>
        <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
          Ce n’est pas un CRM. Un CRM est un outil que vous remplissez. Ciblix est un outil qui vous
          remplit.
        </p>
        <p className="mt-8 text-xl font-semibold text-foreground">Vous décidez. Ils exécutent.</p>
      </div>
    </section>
  );
}

export function LandingAgents() {
  const agents = [
    {
      name: 'Prospecteur',
      deliverable: 'Vingt entreprises qui correspondent à votre cible, chaque matin.',
      body: 'Il surveille les registres officiels, les appels d’offres, les annonces légales et les réseaux professionnels pour repérer les entreprises de votre marché.',
      highlight: false,
    },
    {
      name: 'Analyste',
      deliverable: 'Celles qui méritent votre temps, avec le nom du décideur.',
      body: 'Il qualifie chaque entreprise, identifie l’interlocuteur et vous explique en une phrase pourquoi elle vaut un appel.',
      highlight: false,
    },
    {
      name: 'Rédacteur',
      deliverable: 'Le message prêt à envoyer, en français ou en arabe.',
      body: 'Email ou WhatsApp, adapté au ton de votre maison. Rien ne part sans votre accord.',
      highlight: false,
    },
    {
      name: 'Scribe',
      deliverable: 'Vous ne saisissez rien. Jamais.',
      body: 'Après chaque appel, vous dictez quinze secondes. Il écrit le compte rendu, note l’objection et programme la relance.',
      highlight: true,
    },
  ];

  return (
    <section className="border-t border-neutral-100 bg-[#f7faff] py-16 md:py-24">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <h2 className="text-center font-serif text-3xl font-bold tracking-tight md:text-4xl">
          Quatre agents. Un seul objectif : que vous vendiez.
        </h2>
        <div className="mt-12 grid gap-5 sm:grid-cols-2">
          {agents.map((a) => (
            <article
              key={a.name}
              className={cn(
                'rounded-2xl border bg-white p-6',
                a.highlight ? 'border-[#016AEB]/45 shadow-[0_0_0_1px_rgba(1,106,235,0.12)]' : 'border-neutral-200'
              )}
            >
              <h3 className="text-lg font-semibold text-foreground">{a.name}</h3>
              <p className="mt-2 text-[15px] font-medium leading-snug text-[#016AEB]">{a.deliverable}</p>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{a.body}</p>
            </article>
          ))}
        </div>
        <div className="mt-8 rounded-2xl border border-amber-200/80 bg-amber-50/80 px-5 py-4 text-sm leading-relaxed text-amber-950 md:px-6">
          <strong>Et en permanence, en arrière-plan :</strong> vos agents surveillent le marché. Un
          appel d’offres publié, une levée de fonds, un recrutement massif — l’information remonte
          vers le bon dossier, au bon moment.
        </div>
      </div>
    </section>
  );
}

export function LandingMemoryWake() {
  return (
    <section className="bg-white py-16 md:py-24">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <h2 className="text-center font-serif text-3xl font-bold tracking-tight md:text-4xl">
          Vous les aviez oubliés. Pas Ciblix.
        </h2>

        <div className="mx-auto mt-10 max-w-md rounded-2xl border border-neutral-200 bg-[#FAFAFC] p-5 shadow-sm">
          <p className="text-xs text-neutral-500">Notification · Aujourd’hui</p>
          <p className="mt-3 text-base font-semibold text-foreground">
            Société Al Amana — Textile, Sfax
          </p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Vous les aviez contactés en novembre. Réponse : « pas maintenant, pas de budget ».
          </p>
          <p className="mt-2 text-sm font-semibold text-foreground">
            Ils viennent de recruter douze personnes.
          </p>
          <Button className="mt-4 h-11 w-full bg-[#016AEB] hover:bg-[#0159c4]" asChild>
            <Link to="/register">Reprendre le contact</Link>
          </Button>
        </div>

        <p className="mt-8 text-center text-base leading-relaxed text-muted-foreground">
          Une entreprise vous dit « rappelez-moi en septembre » ? Le 1er septembre, le dossier
          remonte tout seul, avec le contexte de votre dernier échange. Vous n’avez rien noté, rien
          retenu, rien cherché.
        </p>
        <p className="mt-4 text-center text-base font-medium text-foreground">
          Les ventes ne se perdent pas sur un refus. Elles se perdent sur un oubli.
        </p>
      </div>
    </section>
  );
}

export function LandingMarket() {
  const points = [
    {
      title: 'Le tissu économique local',
      body: 'Registres tunisiens et africains, appels d’offres régionaux, annonces légales. Là où les bases internationales sont vides.',
    },
    {
      title: 'Français, arabe, dialecte',
      body: 'Vos messages sont écrits dans la langue de votre interlocuteur, avec les codes qui conviennent.',
    },
    {
      title: 'WhatsApp d’abord',
      body: 'Ici, on vend sur WhatsApp. Ce n’est pas une option secondaire chez nous : c’est le canal principal.',
    },
    {
      title: 'Support local',
      body: 'Une équipe qui connaît votre marché, joignable dans votre fuseau horaire.',
    },
  ];

  return (
    <section className="bg-[#FAFAFC] py-16 md:py-24">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <h2 className="text-center font-serif text-3xl font-bold tracking-tight md:text-4xl">
          Les outils américains ne connaissent pas vos entreprises.
        </h2>
        <div className="mt-12 grid gap-8 sm:grid-cols-2">
          {points.map((p) => (
            <div key={p.title}>
              <h3 className="text-base font-semibold text-foreground">{p.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{p.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function LandingStartFast() {
  const steps = [
    {
      time: '1 minute',
      title: 'Votre entreprise',
      body: 'Donnez l’adresse de votre site — ou votre page Facebook, ou votre plaquette. Nous en extrayons votre activité et vos services.',
    },
    {
      time: '2 minutes',
      title: 'Vos meilleurs clients',
      body: 'Citez trois à cinq clients actuels. Nous analysons ce qu’ils ont en commun et nous en déduisons qui chercher.',
      quote:
        '« Vos meilleurs clients sont des PME industrielles de 50 à 200 employés dans le Grand Tunis. On cherche ce profil ? »',
    },
    {
      time: '2 minutes',
      title: 'Vous validez ce que vous vendez',
      body: 'Nous vous montrons vos services tels que nous les avons compris. Vous corrigez si besoin. C’est la seule chose que nous ne devinons jamais à votre place.',
    },
  ];

  return (
    <section className="bg-white py-16 md:py-24">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <h2 className="text-center font-serif text-3xl font-bold tracking-tight md:text-4xl">
          Cinq minutes pour votre première liste.
        </h2>
        <ol className="mt-12 space-y-8">
          {steps.map((s, i) => (
            <li key={s.title} className="border-l-2 border-[#016AEB]/30 pl-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#1E72B9]">
                Étape {i + 1} — {s.time}
              </p>
              <h3 className="mt-1 text-lg font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
              {s.quote ? (
                <p className="mt-3 text-sm italic leading-relaxed text-foreground/80">{s.quote}</p>
              ) : null}
            </li>
          ))}
        </ol>
        <p className="mt-10 text-center font-medium text-foreground">
          Aucun formulaire à remplir. Vous corrigez, vous ne saisissez pas.
        </p>
      </div>
    </section>
  );
}

export function LandingYourData() {
  return (
    <section className="border-y border-neutral-100 bg-[#FAFAFC] py-16 md:py-20">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <h2 className="font-serif text-3xl font-bold tracking-tight md:text-4xl">
          Votre travail commercial reste le vôtre.
        </h2>
        <p className="mt-5 text-base leading-relaxed text-muted-foreground">
          Vos contacts, vos échanges, vos notes et vos analyses n’appartiennent qu’à vous. Aucun
          autre client de Ciblix n’y aura jamais accès — même s’il opère dans votre secteur.
        </p>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground">
          Nous mutualisons uniquement l’information publique sur les entreprises : raison sociale,
          secteur, adresse. Jamais votre relation client.
        </p>
        <p className="mt-6">
          <Link to="/securite" className="text-sm font-semibold text-[#016AEB] hover:underline">
            En savoir plus sur la sécurité →
          </Link>
        </p>
      </div>
    </section>
  );
}

export function LandingKeepCrm() {
  return (
    <section className="bg-white py-16 md:py-20">
      <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
        <h2 className="font-serif text-3xl font-bold tracking-tight md:text-4xl">
          Vous avez déjà un CRM ? Gardez-le.
        </h2>
        <p className="mt-5 text-lg leading-relaxed text-muted-foreground">
          Ciblix ne le remplace pas — il le remplit. Vos commerciaux dictent, l’information arrive
          chez vous, structurée. Ils n’ouvrent plus jamais un formulaire.
        </p>
      </div>
    </section>
  );
}

export function LandingPricingPrompt() {
  const tiers = [
    {
      name: 'Découverte',
      audience: 'Indépendants et TPE',
      body: 'Prospecteur et Analyste. Vos opportunités chaque matin. Volume adapté à une personne.',
      cta: 'Commencer',
      to: '/register?tier=DECOUVERTE',
      popular: false,
    },
    {
      name: 'Équipe',
      audience: 'PME, 2 à 10 commerciaux',
      body: 'Tout Découverte, plus le Scribe (zéro saisie), messages WhatsApp et email prêts à envoyer, réveil automatique des dossiers dormants.',
      cta: 'Essayer 14 jours',
      to: '/register?tier=CROISSANCE',
      popular: true,
    },
    {
      name: 'Direction',
      audience: 'Structures avec management',
      body: 'Tout Équipe, plus vision consolidée, plusieurs marchés et langues, connexion à votre CRM existant.',
      cta: 'Nous contacter',
      to: '/contact',
      popular: false,
    },
  ];

  return (
    <section id="tarifs" className="bg-[#f7faff] py-16 md:py-24">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <h2 className="text-center font-serif text-3xl font-bold tracking-tight md:text-4xl">
          Combien coûte une journée de commercial chez vous ?
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-center text-lg text-muted-foreground">
          Si Ciblix en récupère une par semaine et par personne, le calcul est vite fait.
        </p>
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {tiers.map((t) => (
            <div
              key={t.name}
              className={cn(
                'flex flex-col rounded-2xl border bg-white p-6',
                t.popular ? 'border-[#016AEB] shadow-md' : 'border-neutral-200'
              )}
            >
              {t.popular ? (
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#016AEB]">
                  Le plus choisi
                </p>
              ) : null}
              <h3 className="text-xl font-semibold">{t.name}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{t.audience}</p>
              <p className="mt-4 flex-1 text-sm leading-relaxed text-foreground/80">{t.body}</p>
              <Button
                asChild
                className={cn(
                  'mt-6 h-11 w-full',
                  t.popular ? 'bg-[#016AEB] hover:bg-[#0159c4]' : ''
                )}
                variant={t.popular ? 'default' : 'outline'}
              >
                <Link to={t.to}>{t.cta}</Link>
              </Button>
            </div>
          ))}
        </div>
        <p className="mt-8 text-center">
          <Link to="/tarifs" className="text-sm font-semibold text-[#016AEB] hover:underline">
            Voir le détail des tarifs →
          </Link>
        </p>
      </div>
    </section>
  );
}

const FAQ_ITEMS = [
  {
    q: 'Mes commerciaux ne vont pas s’en servir, comme le CRM.',
    a: 'C’est exactement le problème que nous résolvons. Nous ne leur demandons rien de plus : pas de formulaire, pas de formation. Ils reçoivent une liste, ils appellent, ils dictent quinze secondes. C’est moins de travail qu’aujourd’hui, pas plus.',
  },
  {
    q: 'L’IA va-t-elle écrire n’importe quoi à mes clients ?',
    a: 'Rien ne part sans votre validation. Et avant de vous proposer un message, le système vérifie deux fois qu’il décrit correctement ce que vous vendez. Nous n’inventons jamais votre offre : elle vient de la fiche que vous validez vous-même au démarrage.',
  },
  {
    q: 'Avez-vous les données des entreprises tunisiennes ?',
    a: 'Oui, et elles s’enrichissent chaque jour. Dès votre inscription, nous vous indiquons combien d’entreprises correspondent à votre profil.',
  },
  {
    q: 'Que se passe-t-il si je m’arrête ?',
    a: 'Votre historique vous appartient et reste exportable. Vous ne perdez rien.',
  },
  {
    q: 'Ça marche en arabe ?',
    a: 'Oui — interface, recherche et messages. Y compris en dialecte pour les notes vocales.',
  },
  {
    q: 'Et si une entreprise n’existe plus ?',
    a: 'Nous vérifions régulièrement les informations et signalons celles qui datent. Si vous constatez une erreur, un signalement suffit.',
  },
];

export function LandingFaqPrompt() {
  const [open, setOpen] = useState<string | null>(FAQ_ITEMS[0]?.q ?? null);

  return (
    <section className="bg-white py-16 md:py-24">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <h2 className="text-center font-serif text-3xl font-bold tracking-tight md:text-4xl">
          Questions fréquentes
        </h2>
        <div className="mt-10 space-y-2">
          {FAQ_ITEMS.map((item) => {
            const isOpen = open === item.q;
            return (
              <div key={item.q} className="rounded-xl border border-neutral-200">
                <button
                  type="button"
                  className="flex w-full items-start justify-between gap-3 px-4 py-3.5 text-left text-sm font-semibold"
                  onClick={() => setOpen(isOpen ? null : item.q)}
                  aria-expanded={isOpen}
                >
                  {item.q}
                  <span className="text-muted-foreground">{isOpen ? '−' : '+'}</span>
                </button>
                {isOpen ? (
                  <p className="px-4 pb-4 text-sm leading-relaxed text-muted-foreground">{item.a}</p>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function LandingFinalCtaPrompt() {
  return (
    <section className="bg-[#016AEB] py-16 text-white md:py-20">
      <div className="mx-auto max-w-2xl px-4 text-center sm:px-6">
        <h2 className="font-serif text-3xl font-bold tracking-tight md:text-4xl">
          Demain matin, votre liste sera prête.
        </h2>
        <p className="mt-4 text-lg leading-relaxed text-white/85">
          Cinq entreprises à contacter, avec la raison. Les messages écrits. Et plus jamais un
          formulaire à remplir.
        </p>
        <Button
          asChild
          size="lg"
          className="mt-8 h-12 bg-white px-10 text-base font-semibold text-[#016AEB] hover:bg-white/95"
        >
          <Link to="/register">
            Commencer gratuitement <ArrowRight size={18} className="ml-2" />
          </Link>
        </Button>
        <p className="mt-4 text-sm text-white/75">Sans carte bancaire · Première liste en cinq minutes</p>
      </div>
    </section>
  );
}

/** Mini phone mock — écran Aujourd’hui (hero). */
export function LandingHeroPhone() {
  const rows = [
    { name: 'Textile Sfax SARL', why: 'Recrute 12 personnes. Aucun logiciel RH détecté.' },
    { name: 'Industrie Médina', why: 'AO publié le 3 juillet — équipement.' },
    { name: 'Agro Delta', why: 'Ouvre un second site à Sousse.' },
    { name: 'Services Atlas', why: 'Budget débloqué en septembre.' },
    { name: 'LogiTunis', why: 'Changement de dirigeant annoncé.' },
  ];

  return (
    <div className="relative mx-auto w-full max-w-[280px]">
      <div className="rounded-[2rem] border-[10px] border-neutral-900 bg-neutral-900 shadow-2xl">
        <div className="overflow-hidden rounded-[1.35rem] bg-white">
          <div className="bg-[#016AEB] px-4 pb-4 pt-6 text-white">
            <p className="text-[11px] font-medium text-white/80">Aujourd’hui</p>
            <p className="mt-1 text-lg font-semibold">5 à contacter</p>
          </div>
          <ul className="divide-y divide-neutral-100 px-3 py-2">
            {rows.map((r) => (
              <li key={r.name} className="py-2.5">
                <p className="text-[13px] font-medium text-neutral-900">{r.name}</p>
                <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-neutral-500">{r.why}</p>
              </li>
            ))}
          </ul>
          <div className="border-t border-neutral-100 px-3 py-2.5">
            <p className="flex items-center gap-1.5 text-[11px] text-neutral-500">
              <Check size={12} className="text-[#016AEB]" /> Message déjà écrit
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
