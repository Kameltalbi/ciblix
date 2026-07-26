import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, MessageCircle, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PublicHero, PublicPageShell, PublicSection } from '@/components/landing/PublicPageShell';

const EXPERT_MAIL = 'mailto:contact@ciblix.com?subject=Demande%20Ciblix';

export function ContactPublic() {
  const [sent, setSent] = useState(false);

  return (
    <PublicPageShell>
      <PublicHero
        eyebrow="Contact"
        title="Parlons de votre équipe commerciale."
        subtitle="Essai, démo, ou question sur le cloisonnement de vos données — on répond vite, depuis la Tunisie."
      />

      <PublicSection className="max-w-5xl">
        <div className="grid gap-8 md:grid-cols-2">
          <div className="space-y-6">
            <div className="rounded-2xl border border-[#BED6F6]/50 bg-[#f7faff] p-6">
              <Mail className="mb-3 h-5 w-5 text-[#016AEB]" />
              <h2 className="mb-1 text-base font-semibold">Email</h2>
              <a href={EXPERT_MAIL} className="text-[#016AEB] hover:underline">
                contact@ciblix.com
              </a>
            </div>
            <div className="rounded-2xl border border-[#BED6F6]/50 bg-[#f7faff] p-6">
              <Phone className="mb-3 h-5 w-5 text-[#016AEB]" />
              <h2 className="mb-1 text-base font-semibold">Téléphone</h2>
              <a href="tel:+21655053505" className="text-[#016AEB] hover:underline">
                +216 55 053 505
              </a>
            </div>
            <div className="rounded-2xl border border-[#BED6F6]/50 bg-[#f7faff] p-6">
              <MessageCircle className="mb-3 h-5 w-5 text-[#016AEB]" />
              <h2 className="mb-1 text-base font-semibold">WhatsApp</h2>
              <p className="text-sm text-muted-foreground">
                Canal principal de nos clients — et le nôtre aussi. Écrivez-nous à{' '}
                <a href={EXPERT_MAIL} className="font-medium text-[#016AEB] hover:underline">
                  contact@ciblix.com
                </a>{' '}
                pour obtenir le lien WhatsApp Business.
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
            <h2 className="mb-2 font-serif text-xl font-bold">Envoyer un message</h2>
            <p className="mb-6 text-sm text-muted-foreground">
              Pas de formulaire CRM. Un email direct ouvre le dialogue.
            </p>
            {sent ? (
              <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                Merci. Ouvrez votre client mail — le message est prêt à envoyer.
              </p>
            ) : (
              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  const name = String(fd.get('name') || '').trim();
                  const company = String(fd.get('company') || '').trim();
                  const body = String(fd.get('message') || '').trim();
                  const subject = encodeURIComponent(`Contact Ciblix — ${company || name || 'Demande'}`);
                  const text = encodeURIComponent(
                    `Nom : ${name}\nEntreprise : ${company}\n\n${body}`
                  );
                  window.location.href = `mailto:contact@ciblix.com?subject=${subject}&body=${text}`;
                  setSent(true);
                }}
              >
                <label className="block text-sm font-medium">
                  Nom
                  <input
                    name="name"
                    required
                    className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-[#016AEB]"
                  />
                </label>
                <label className="block text-sm font-medium">
                  Entreprise
                  <input
                    name="company"
                    className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-[#016AEB]"
                  />
                </label>
                <label className="block text-sm font-medium">
                  Message
                  <textarea
                    name="message"
                    required
                    rows={5}
                    className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-[#016AEB]"
                    placeholder="Combien de commerciaux ? Quel marché ?"
                  />
                </label>
                <Button type="submit" className="w-full bg-[#016AEB] hover:bg-[#0159c4]">
                  Ouvrir mon email
                </Button>
              </form>
            )}
            <p className="mt-6 text-center text-sm text-muted-foreground">
              Ou{' '}
              <Link to="/register" className="font-semibold text-[#016AEB] hover:underline">
                démarrer l’essai gratuit
              </Link>{' '}
              — première liste en quelques minutes.
            </p>
          </div>
        </div>
      </PublicSection>
    </PublicPageShell>
  );
}
