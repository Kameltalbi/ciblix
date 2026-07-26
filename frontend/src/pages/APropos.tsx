import { Link } from 'react-router-dom';
import { PublicHero, PublicPageShell, PublicSection } from '@/components/landing/PublicPageShell';

export function APropos() {
  return (
    <PublicPageShell>
      <PublicHero
        eyebrow="À propos"
        title="Le commercial qui ne dort jamais."
        subtitle="Ciblix trouve vos clients pendant que vous dormez, et écrit vos comptes rendus pendant que vous vendez."
        cta={{ label: 'Essayer gratuitement', to: '/register' }}
      />

      <PublicSection className="max-w-3xl">
        <h2 className="mb-4 font-serif text-2xl font-bold tracking-tight md:text-3xl">
          Le problème n’est pas de manquer d’outils. C’est de manquer de temps.
        </h2>
        <div className="space-y-4 text-base leading-relaxed text-muted-foreground">
          <p>
            Un commercial passe la majorité de sa semaine à faire autre chose que vendre : chercher qui
            contacter, vérifier si l’entreprise est encore active, trouver le bon interlocuteur, rédiger un
            message, et surtout — noter ce qui s’est dit après chaque échange.
          </p>
          <p>
            Les CRM ont aggravé le problème. Ils ont transformé le commercial en agent de saisie : plus
            l’outil est complet, plus il réclame de données, et plus le commercial l’évite. Résultat :
            des CRM à moitié vides, des informations perdues, et des relances oubliées qui coûtent des
            ventes.
          </p>
        </div>
      </PublicSection>

      <PublicSection className="border-t border-neutral-100 bg-[#FAFAFC] max-w-none">
        <div className="mx-auto max-w-3xl">
          <h2 className="mb-4 font-serif text-2xl font-bold tracking-tight md:text-3xl">
            Ciblix inverse la relation.
          </h2>
          <div className="space-y-4 text-base leading-relaxed text-muted-foreground">
            <p>
              Vous configurez une fois votre activité et votre cible. Ensuite, une équipe d’agents IA
              travaille en continu : ils identifient les entreprises qui correspondent à votre marché, les
              qualifient, repèrent le bon interlocuteur, préparent le message, et — c’est le point
              décisif — <strong className="text-foreground">écrivent eux-mêmes le suivi après chaque
              échange</strong>.
            </p>
            <p className="font-medium text-foreground">
              Vous ne remplissez aucun formulaire. Vous ne cherchez rien. Vous décidez et vous vendez.
            </p>
          </div>
        </div>
      </PublicSection>

      <PublicSection className="max-w-3xl">
        <h2 className="mb-4 font-serif text-2xl font-bold tracking-tight md:text-3xl">
          Et surtout : Ciblix connaît votre marché.
        </h2>
        <div className="space-y-4 text-base leading-relaxed text-muted-foreground">
          <p>
            Les outils d’intelligence commerciale existants sont bâtis pour les États-Unis et l’Europe.
            Ils ignorent le tissu économique tunisien et africain, ne parlent pas arabe, et considèrent
            WhatsApp comme un canal secondaire alors qu’il est le canal principal.
          </p>
          <p>
            Ciblix est conçu pour la Tunisie et l’Afrique francophone — pas adapté après coup. Français,
            arabe, dialecte. WhatsApp comme canal principal, pas comme option.
          </p>
        </div>
        <p className="mt-10 text-sm text-muted-foreground">
          Une question ?{' '}
          <Link to="/contact" className="font-semibold text-[#016AEB] hover:underline">
            Contactez-nous
          </Link>
          .
        </p>
      </PublicSection>
    </PublicPageShell>
  );
}
