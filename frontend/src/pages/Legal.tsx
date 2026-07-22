import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function Legal() {
  const { t } = useTranslation();
  const { type } = useParams<{ type: 'cgu' | 'privacy' | 'terms' }>();

  const content = {
    cgu: {
      title: 'Conditions Générales d\'Utilisation',
      sections: [
        {
          title: '1. Acceptation des CGU',
          content: 'En utilisant la plateforme CIBLIX, vous acceptez les présentes conditions générales d\'utilisation.',
        },
        {
          title: '2. Description du service',
          content: 'CIBLIX est une plateforme d\'intelligence commerciale et de prospection assistée par IA, destinée aux entreprises tunisiennes. Elle permet de suivre contacts, opportunités, relances et activités liées à la vente.',
        },
        {
          title: '3. Compte utilisateur',
          content: 'L\'utilisateur est responsable de la confidentialité de ses identifiants de connexion. Toute utilisation du compte par un tiers est sous la responsabilité de l\'utilisateur.',
        },
        {
          title: '4. Données personnelles',
          content: 'Les données personnelles sont traitées conformément à notre politique de confidentialité et à la législation applicable. Ciblix fournit les mécanismes techniques de consentement et d\'effacement ; le client reste responsable de l\'obtention du consentement auprès de ses propres contacts (WhatsApp, enregistrement d\'appels).',
        },
        {
          title: '5. Paiements',
          content: 'Les paiements sont effectués via notre partenaire de paiement sécurisé. Les abonnements sont renouvelables automatiquement sauf annulation.',
        },
        {
          title: '6. Limitation de responsabilité',
          content: 'CIBLIX ne peut être tenu responsable des dommages directs ou indirects résultant de l\'utilisation ou de l\'impossibilité d\'utiliser le service.',
        },
        {
          title: '7. Propriété intellectuelle',
          content: 'Tous les éléments du service (logiciel, design, contenu) sont la propriété exclusive de CIBLIX.',
        },
        {
          title: '8. Résiliation',
          content: 'L\'utilisateur peut résilier son compte à tout moment. CIBLIX se réserve le droit de suspendre ou résilier un compte en cas de violation des CGU.',
        },
      ],
    },
    privacy: {
      title: 'Politique de Confidentialité',
      sections: [
        {
          title: '1. Collecte des données',
          content: 'Nous collectons les données nécessaires à l\'utilisation du service : informations de compte, données clients, opportunités commerciales, et données d\'utilisation.',
        },
        {
          title: '2. Utilisation des données',
          content: 'Vos données sont utilisées pour : fournir le service, améliorer l\'expérience utilisateur, assurer la sécurité, et respecter nos obligations légales.',
        },
        {
          title: '3. Partage des données',
          content: 'Nous ne partageons pas vos données avec des tiers, sauf : (a) avec votre consentement, (b) pour fournir le service, (c) obligation légale.',
        },
        {
          title: '4. Sécurité des données',
          content: 'Nous mettons en œuvre des mesures de sécurité techniques et organisationnelles pour protéger vos données (encryption, backups, contrôles d\'accès).',
        },
        {
          title: '5. Vos droits',
          content: 'Vous avez le droit d\'accéder, rectifier, supprimer vos données personnelles. Contactez-nous pour exercer ces droits.',
        },
        {
          title: '6. Conservation des données',
          content: 'Vos données sont conservées tant que votre compte est actif. Après résiliation, elles sont supprimées conformément à la législation tunisienne.',
        },
        {
          title: '7. Cookies',
          content: 'Nous utilisons des cookies pour améliorer l\'expérience utilisateur. Vous pouvez configurer votre navigateur pour refuser les cookies.',
        },
        {
          title: '8. Contact',
          content: 'Pour toute question sur vos données personnelles : contact@crmtunisie.tn',
        },
      ],
    },
    terms: {
      title: 'Mentions Légales',
      sections: [
        {
          title: '1. Éditeur du service',
          content: 'CIBLIX - [Adresse légale] - [Matricule fiscal] - [Registre commerce]',
        },
        {
          title: '2. Contact',
          content: 'Email : contact@crmtunisie.tn - Téléphone : +216 55 053 505',
        },
        {
          title: '3. Hébergement',
          content: 'Le service est hébergé sur des serveurs situés en Tunisie.',
        },
        {
          title: '4. Propriété intellectuelle',
          content: 'CIBLIX est une marque déposée. Tous droits réservés.',
        },
      ],
    },
  };

  const currentContent = content[type as keyof typeof content] || content.cgu;

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="text-3xl">{currentContent.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {currentContent.sections.map((section, idx) => (
                <div key={idx}>
                  <h3 className="text-xl font-semibold mb-2">{section.title}</h3>
                  <p className="text-gray-600 whitespace-pre-line">{section.content}</p>
                </div>
              ))}
            </div>
            <div className="mt-8 pt-8 border-t text-sm text-gray-500">
              <p>{t('legal.lastUpdated', { defaultValue: 'Dernière mise à jour : Mai 2026' })}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
