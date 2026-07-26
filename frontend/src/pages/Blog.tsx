import { Link, useParams } from 'react-router-dom';
import { PublicHero, PublicPageShell, PublicSection } from '@/components/landing/PublicPageShell';

type Article = {
  slug: string;
  title: string;
  excerpt: string;
  body: string[];
};

const ARTICLES: Article[] = [
  {
    slug: 'zero-saisie',
    title: 'Zéro saisie : le seul bénéfice vérifiable en trente secondes',
    excerpt: 'Vos commerciaux ne remplissent plus rien. Ils parlent, le suivi s’écrit.',
    body: [
      'C’est le seul bénéfice qu’un prospect peut constater en trente secondes de démonstration. Tous les autres demandent de la confiance. Celui-ci se prouve.',
      'Après un appel, le commercial dicte quinze secondes. Le résumé, l’objection, la date de relance s’écrivent. Le 1er septembre, la fiche remonte toute seule avec le contexte.',
      'C’est l’argument d’entrée à mettre partout en premier — avant l’ancrage local, avant la mémoire, avant l’apprentissage.',
    ],
  },
  {
    slug: 'ancrage-local',
    title: 'Conçu pour la Tunisie et l’Afrique francophone',
    excerpt: 'Français, arabe, dialecte. WhatsApp comme canal principal, pas comme option.',
    body: [
      'Les outils d’intelligence commerciale existants sont bâtis pour les États-Unis et l’Europe. Ils ignorent le tissu économique tunisien et africain.',
      'Un concurrent international ne viendra pas facilement sur ce terrain : le marché est trop petit pour eux et la donnée trop coûteuse à constituer. C’est la protection durable de Ciblix.',
    ],
  },
  {
    slug: 'memoire-qui-reveille',
    title: 'La mémoire qui réveille les dossiers oubliés',
    excerpt:
      'Vous les aviez contactés en novembre. Ils viennent de recruter douze personnes.',
    body: [
      'Aucun commercial ne croise manuellement, chaque matin, ses dossiers dormants avec les signaux du marché.',
      'Quand un signal (recrutement, appel d’offres, investissement) concerne une entreprise déjà connue, Ciblix peut remonter la fiche avec la mise en perspective du passé et du présent.',
      'C’est le moment de démonstration le plus spectaculaire du produit — celui qui fait comprendre en dix secondes ce que l’IA apporte qu’un humain ne fera jamais.',
    ],
  },
  {
    slug: 'whatsapp-canal-principal',
    title: 'WhatsApp n’est pas une option',
    excerpt: 'Sur ce marché, c’est le canal où se font réellement les ventes.',
    body: [
      'Traiter WhatsApp comme un add-on, c’est ignorer comment se concluent les affaires en Tunisie et en Afrique francophone.',
      'Ciblix intègre ce canal dans le flux commercial : préparer, suivre, dicter — sans transformer le commercial en opérateur de saisie.',
    ],
  },
  {
    slug: 'pas-un-crm',
    title: 'Pourquoi Ciblix n’est pas un CRM',
    excerpt: 'Les fiches sont écrites par les agents et lues par l’humain.',
    body: [
      'S’il existe un écran où l’utilisateur édite un champ, configure une étape de vente ou remplit un formulaire, la contrainte produit est violée.',
      'Ciblix remplit (ou s’ajoute à) votre CRM existant. On ne demande jamais d’abandonner un outil dans lequel vous avez investi.',
    ],
  },
];

export function Blog() {
  const { slug } = useParams<{ slug?: string }>();
  const article = slug ? ARTICLES.find((a) => a.slug === slug) : null;

  if (article) {
    return (
      <PublicPageShell>
        <PublicHero eyebrow="Blog" title={article.title} subtitle={article.excerpt} />
        <PublicSection className="max-w-3xl">
          <div className="space-y-4 text-base leading-relaxed text-muted-foreground">
            {article.body.map((p) => (
              <p key={p.slice(0, 40)}>{p}</p>
            ))}
          </div>
          <p className="mt-10">
            <Link to="/blog" className="text-sm font-semibold text-[#016AEB] hover:underline">
              ← Tous les articles
            </Link>
          </p>
        </PublicSection>
      </PublicPageShell>
    );
  }

  return (
    <PublicPageShell>
      <PublicHero
        eyebrow="Blog"
        title="Ce qui fait vraiment la différence."
        subtitle="Des textes issus du positionnement Ciblix — concrets, démontrables, sans phrases à bannir."
      />
      <PublicSection className="max-w-3xl">
        <ul className="space-y-4">
          {ARTICLES.map((a) => (
            <li key={a.slug}>
              <Link
                to={`/blog/${a.slug}`}
                className="block rounded-xl border border-neutral-200 bg-white px-5 py-4 transition hover:border-[#016AEB]/40 hover:bg-[#f7faff]"
              >
                <h2 className="font-serif text-lg font-bold text-foreground">{a.title}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{a.excerpt}</p>
              </Link>
            </li>
          ))}
        </ul>
      </PublicSection>
    </PublicPageShell>
  );
}
