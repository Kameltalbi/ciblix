import { Lock, ShieldCheck, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PublicHero, PublicPageShell, PublicSection } from '@/components/landing/PublicPageShell';

const POINTS = [
  {
    icon: Users,
    title: 'Vos données commerciales ne sortent jamais de votre compte',
    body: 'Vos échanges, vos contacts, vos notes vous appartiennent. Un autre client de Ciblix ne verra jamais rien de votre travail commercial — même s’il prospecte le même marché que vous.',
  },
  {
    icon: ShieldCheck,
    title: 'Cloisonnement technique, pas seulement une promesse',
    body: 'Chaque fiche, suggestion et historique est isolé par organisation. Les faits publics d’entreprise (registre, adresse, site) peuvent enrichir un référentiel mutualisé ; l’intelligence de vente reste privée.',
  },
  {
    icon: Lock,
    title: 'Rien ne part sans votre validation',
    body: 'Les messages préparés par les agents restent des brouillons jusqu’à votre accord. Nous n’inventons jamais votre offre : elle vient de la fiche que vous validez à l’inscription.',
  },
] as const;

export function Securite() {
  return (
    <PublicPageShell>
      <PublicHero
        eyebrow="Sécurité & confidentialité"
        title="Votre travail commercial reste le vôtre."
        subtitle="Face à un concurrent aussi client de Ciblix, la confiance repose sur une règle simple : aucun tenant ne bénéficie du travail d’un autre."
        cta={{ label: 'Lire la politique de confidentialité', to: '/legal/privacy' }}
      />

      <PublicSection className="max-w-5xl">
        <div className="grid gap-6 md:grid-cols-3">
          {POINTS.map((p) => (
            <div key={p.title} className="rounded-2xl border border-[#BED6F6]/50 bg-[#f7faff] p-6">
              <p.icon className="mb-3 h-5 w-5 text-[#016AEB]" />
              <h2 className="mb-2 text-base font-semibold text-foreground">{p.title}</h2>
              <p className="text-sm leading-relaxed text-muted-foreground">{p.body}</p>
            </div>
          ))}
        </div>
      </PublicSection>

      <PublicSection>
        <h2 className="mb-4 font-serif text-2xl font-bold">Ce que nous protégeons en priorité</h2>
        <ul className="list-disc space-y-2 pl-5 text-muted-foreground">
          <li>Historique d’interactions et notes dictées</li>
          <li>Décideurs, emails nominatifs, téléphones personnels</li>
          <li>Scores, objections, montants, statut de deal</li>
          <li>Messages et brouillons préparés pour vos clients</li>
        </ul>
        <p className="mt-6 text-sm text-muted-foreground">
          Détail juridique :{' '}
          <Link to="/legal/privacy" className="font-semibold text-[#016AEB] hover:underline">
            Politique de confidentialité
          </Link>{' '}
          ·{' '}
          <Link to="/legal/cgu" className="font-semibold text-[#016AEB] hover:underline">
            Conditions d’utilisation
          </Link>
          .
        </p>
      </PublicSection>
    </PublicPageShell>
  );
}
