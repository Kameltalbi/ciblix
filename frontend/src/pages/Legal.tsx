import { useParams } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { PublicHero, PublicPageShell, PublicSection } from '@/components/landing/PublicPageShell';

type Section = { title: string; content: string };

const CONTENT: Record<string, { title: string; sections: Section[] }> = {
  cgu: {
    title: "Conditions Générales d'Utilisation",
    sections: [
      {
        title: '1. Acceptation',
        content:
          'En utilisant la plateforme Ciblix, vous acceptez les présentes conditions. Si vous n’acceptez pas ces conditions, n’utilisez pas le service.',
      },
      {
        title: '2. Description du service',
        content:
          'Ciblix est une plateforme d’agents IA pour le développement commercial, destinée aux PME en Tunisie et en Afrique francophone. Elle aide à identifier des entreprises à contacter, préparer des messages, et capturer le suivi après échange (notamment par dictée). Ciblix n’est pas un CRM classique : les fiches sont principalement écrites par les agents et lues par l’humain.',
      },
      {
        title: '3. Compte utilisateur',
        content:
          'Vous êtes responsable de la confidentialité de vos identifiants. Toute activité réalisée via votre compte est réputée effectuée sous votre responsabilité.',
      },
      {
        title: '4. Données et cloisonnement',
        content:
          'Vos échanges, contacts et notes appartiennent à votre organisation et ne sont pas partagés avec d’autres clients. Les faits publics d’entreprise (ex. raison sociale, secteur) peuvent alimenter un référentiel mutualisé distinct de votre intelligence commerciale. Voir la Politique de confidentialité.',
      },
      {
        title: '5. Contenu généré par IA',
        content:
          'Les messages et suggestions générés sont des aides à la décision. Rien n’est envoyé à vos clients sans votre validation lorsque le produit le prévoit. Vous restez responsable du contenu finalement transmis.',
      },
      {
        title: '6. Paiements',
        content:
          'Les abonnements sont facturés selon les tarifs en vigueur (notamment par commercial actif). Les modalités de renouvellement et d’essai sont indiquées lors de l’inscription et dans l’espace facturation.',
      },
      {
        title: '7. Limitation de responsabilité',
        content:
          'Ciblix ne peut être tenu responsable des dommages indirects résultant de l’usage du service, dans les limites autorisées par la loi applicable.',
      },
      {
        title: '8. Résiliation',
        content:
          'Vous pouvez cesser d’utiliser le service selon les modalités de votre abonnement. Ciblix peut suspendre un compte en cas de violation des présentes conditions.',
      },
    ],
  },
  privacy: {
    title: 'Politique de Confidentialité',
    sections: [
      {
        title: '1. Responsable',
        content: 'Pour toute question relative aux données : contact@ciblix.com',
      },
      {
        title: '2. Données collectées',
        content:
          'Compte (identité, email), données d’organisation, fiches commerciales et historiques d’interaction liés à votre usage, données techniques de connexion et d’usage nécessaires au service.',
      },
      {
        title: '3. Finalités',
        content:
          'Fournir le service (prospection assistée, qualification, préparation de messages, suivi dicté), améliorer la pertinence des propositions pour votre organisation, assurer la sécurité, et respecter les obligations légales.',
      },
      {
        title: '4. Cloisonnement multi-client',
        content:
          'L’intelligence commerciale de votre organisation (historique, décideurs, scores, notes) est isolée. Un autre client ne peut pas y accéder. Les faits publics d’entreprise peuvent être traités séparément dans un référentiel mutualisé.',
      },
      {
        title: '5. Partage',
        content:
          'Pas de vente de vos données commerciales. Partage limité aux prestataires nécessaires au fonctionnement (hébergement, paiement, APIs IA) sous contrat, ou obligation légale.',
      },
      {
        title: '6. Conservation',
        content:
          'Les fiches et historiques commerciaux sont conservés pour la durée utile du service et de la relation contractuelle, sauf demande d’effacement ou obligation légale contraire. Certains contenus bruts sensibles peuvent être soumis à une durée de rétention limitée.',
      },
      {
        title: '7. Vos droits',
        content:
          'Selon la législation applicable (notamment en Tunisie), vous pouvez demander l’accès, la rectification ou l’effacement de données personnelles. Contact : contact@ciblix.com',
      },
      {
        title: '8. Cookies',
        content:
          'Des cookies techniques sont utilisés pour le fonctionnement du service (session, préférences). Vous pouvez configurer votre navigateur pour les limiter.',
      },
    ],
  },
  terms: {
    title: 'Mentions légales',
    sections: [
      {
        title: '1. Éditeur',
        content:
          'Ciblix — plateforme d’agents IA pour le développement commercial. Contact : contact@ciblix.com — Téléphone : +216 55 053 505.',
      },
      {
        title: '2. Hébergement',
        content:
          'Le service est hébergé sur une infrastructure sécurisée opérée pour Ciblix. Les détails d’hébergement peuvent être communiqués sur demande légitime.',
      },
      {
        title: '3. Propriété intellectuelle',
        content:
          'Ciblix, le logiciel, le design et les contenus éditoriaux sont protégés. Toute reproduction non autorisée est interdite.',
      },
      {
        title: '4. Documents liés',
        content: 'CGU : /legal/cgu — Confidentialité : /legal/privacy — Sécurité : /securite',
      },
    ],
  },
};

export function Legal() {
  const { type } = useParams<{ type: string }>();
  const current = CONTENT[type || ''] || CONTENT.cgu;

  return (
    <PublicPageShell>
      <PublicHero eyebrow="Légal" title={current.title} subtitle="Dernière mise à jour : juillet 2026" />
      <PublicSection>
        <div className="space-y-8">
          {current.sections.map((section) => (
            <div key={section.title}>
              <h2 className="mb-2 text-lg font-semibold">{section.title}</h2>
              <p className="whitespace-pre-line text-muted-foreground leading-relaxed">{section.content}</p>
            </div>
          ))}
        </div>
        <p className="mt-10 text-sm text-muted-foreground">
          <Link to="/securite" className="font-semibold text-[#016AEB] hover:underline">
            Page Sécurité
          </Link>
          {' · '}
          <Link to="/contact" className="font-semibold text-[#016AEB] hover:underline">
            Contact
          </Link>
        </p>
      </PublicSection>
    </PublicPageShell>
  );
}
