import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PublicHero, PublicPageShell, PublicSection } from '@/components/landing/PublicPageShell';
import { cn } from '@/lib/utils';

const FAQ: Array<{ theme: string; items: Array<{ q: string; a: string }> }> = [
  {
    theme: 'Objections fréquentes',
    items: [
      {
        q: 'On a déjà un CRM.',
        a: 'Parfait, gardez-le. Ciblix ne le remplace pas — il le remplit. Vos commerciaux dictent, l’information arrive chez vous.',
      },
      {
        q: 'L’IA va écrire n’importe quoi à mes clients.',
        a: 'Rien ne part sans votre validation. Avant de vous montrer un message, le système vérifie deux fois qu’il décrit correctement ce que VOUS vendez. Nous n’inventons jamais votre offre : elle vient de la fiche que vous validez à l’inscription.',
      },
      {
        q: 'Vous avez les données des entreprises tunisiennes ?',
        a: 'Oui, et elles s’enrichissent chaque jour. À l’inscription, on vous dit immédiatement combien d’entreprises correspondent à votre profil — avec un chiffre réel, pas une promesse creuse.',
      },
      {
        q: 'Mes commerciaux ne vont pas s’en servir.',
        a: 'C’est exactement le problème qu’on résout. On ne leur demande rien de plus : pas de formulaire, pas de formation. Ils reçoivent une liste, ils appellent, ils dictent quinze secondes. C’est moins de travail qu’aujourd’hui, pas plus.',
      },
      {
        q: 'C’est cher.',
        a: 'Combien coûte une journée de commercial chez vous ? Si Ciblix en récupère une par semaine et par personne, le calcul se fait tout seul. On facture par commercial actif et par mois — pas des « crédits IA ».',
      },
      {
        q: 'Mes données vont où ?',
        a: 'Vos échanges, vos contacts, vos notes vous appartiennent et ne sortent jamais de votre compte. Un autre client de Ciblix ne verra jamais rien de votre travail commercial.',
      },
    ],
  },
  {
    theme: 'Essai & démarrage',
    items: [
      {
        q: 'Ai-je besoin d’une carte bancaire ?',
        a: 'Non pour démarrer l’essai. L’objectif : voir votre première liste pertinente en moins de cinq minutes.',
      },
      {
        q: 'Que vois-je le premier matin ?',
        a: 'L’écran Aujourd’hui : jusqu’à cinq entreprises à contacter, chacune avec la raison de les contacter et un message déjà écrit.',
      },
    ],
  },
  {
    theme: 'Produit',
    items: [
      {
        q: 'Ciblix est-il un CRM ?',
        a: 'Non. Les fiches sont écrites par les agents et lues par l’humain. Il n’existe pas d’écran pour éditer des champs ou remplir un pipeline à la main.',
      },
      {
        q: 'Qu’est-ce que la dictée de quinze secondes ?',
        a: 'Après un appel, vous dictez. Le résumé, l’objection et la date de relance s’écrivent tout seuls. Le 1er septembre, la fiche remonte avec le contexte — personne n’oublie plus rien.',
      },
    ],
  },
];

export function Faq() {
  const [open, setOpen] = useState<string | null>(FAQ[0]?.items[0]?.q ?? null);

  return (
    <PublicPageShell>
      <PublicHero
        eyebrow="FAQ"
        title="Les questions qu’on nous pose vraiment."
        subtitle="Réponses tirées de l’argumentaire commercial — pas du jargon produit."
        cta={{ label: 'Essayer gratuitement', to: '/register' }}
      />

      <PublicSection className="space-y-10">
        {FAQ.map((block) => (
          <div key={block.theme}>
            <h2 className="mb-4 font-serif text-xl font-bold">{block.theme}</h2>
            <div className="space-y-2">
              {block.items.map((item) => {
                const isOpen = open === item.q;
                return (
                  <div key={item.q} className="rounded-xl border border-neutral-200 bg-white">
                    <button
                      type="button"
                      className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left text-sm font-semibold"
                      onClick={() => setOpen(isOpen ? null : item.q)}
                      aria-expanded={isOpen}
                    >
                      {item.q}
                      <span className="text-muted-foreground">{isOpen ? '−' : '+'}</span>
                    </button>
                    <div className={cn('px-4 pb-4 text-sm leading-relaxed text-muted-foreground', !isOpen && 'hidden')}>
                      {item.a}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        <p className="text-sm text-muted-foreground">
          Autre question ?{' '}
          <Link to="/contact" className="font-semibold text-[#016AEB] hover:underline">
            Contactez-nous
          </Link>
          .
        </p>
      </PublicSection>
    </PublicPageShell>
  );
}
