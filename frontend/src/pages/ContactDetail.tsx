import { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { FicheEntreprise } from '@/components/fiche-entreprise';
import type { FicheEntrepriseDataView } from '@/components/fiche-entreprise/types';

type ContactApi = {
  id: string;
  name?: string | null;
  companyName?: string | null;
  email?: string | null;
  phone?: string | null;
  whatsappId?: string | null;
  ficheEtat?: string | null;
  ficheData?: FicheEntrepriseDataView | null;
  entrepriseReferentiel?: {
    nomLegal?: string | null;
    secteur?: string | null;
    zoneGeographique?: string | null;
    adresseSiege?: string | null;
    telephoneStandard?: string | null;
    emailGenerique?: string | null;
    siteWeb?: string | null;
    identifiantNational?: string | null;
    anneeCreation?: number | null;
    tailleEstimee?: string | null;
    statutActivite?: string | null;
    scoreFraicheur?: number | null;
    dateDerniereVerification?: string | null;
  } | null;
};

export function ContactDetail() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const [dictationOpen, setDictationOpen] = useState(false);
  const [dictationText, setDictationText] = useState('');
  const [dictationPrompt, setDictationPrompt] = useState<string | null>(null);

  const { data, isPending, error } = useQuery({
    queryKey: ['contact', id],
    queryFn: () => api.get(`/contacts/${id}`).then((r) => r.data),
    enabled: Boolean(id),
  });

  useEffect(() => {
    if (!id) return;
    try {
      const raw = sessionStorage.getItem(`ciblix_outbound_${id}`);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { canal?: string; name?: string; at?: number };
      if (!parsed.at || Date.now() - parsed.at > 2 * 3600_000) {
        sessionStorage.removeItem(`ciblix_outbound_${id}`);
        return;
      }
      const who = parsed.name || 'le contact';
      const verb = parsed.canal === 'whatsapp' ? 'écrit sur WhatsApp à' : 'appelé';
      setDictationPrompt(`Vous venez d’${verb} ${who}. Dictez votre note ?`);
    } catch {
      /* ignore */
    }
  }, [id]);

  const reprendre = useMutation({
    mutationFn: () => api.post(`/contacts/${id}/reprendre`).then((r) => r.data),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['contact', id] }),
  });

  const scribe = useMutation({
    mutationFn: (texteBrut: string) =>
      api
        .post('/agent-team/scribe/ingest', {
          contactId: id,
          texteBrut,
          canal: 'vocal',
        })
        .then((r) => r.data),
    onSuccess: () => {
      setDictationOpen(false);
      setDictationText('');
      setDictationPrompt(null);
      if (id) sessionStorage.removeItem(`ciblix_outbound_${id}`);
      void qc.invalidateQueries({ queryKey: ['contact', id] });
    },
  });

  const contact = data?.contact as ContactApi | undefined;
  const fiche = (contact?.ficheData || {}) as FicheEntrepriseDataView;
  const ref = contact?.entrepriseReferentiel;

  const mapped = useMemo(() => {
    if (!contact) return null;
    const decideur = fiche.decideur
      ? {
          nom: fiche.decideur.nom,
          fonction: fiche.decideur.fonction,
          canal_prefere: fiche.decideur.canal_prefere,
          phone: contact.phone,
          email: contact.email,
          whatsapp: contact.whatsappId || contact.phone,
        }
      : contact.phone || contact.email || contact.whatsappId
        ? {
            nom: contact.name,
            phone: contact.phone,
            email: contact.email,
            whatsapp: contact.whatsappId || contact.phone,
          }
        : null;

    return {
      nomLegal:
        fiche.identite_entreprise?.nom_legal ||
        ref?.nomLegal ||
        contact.companyName ||
        contact.name ||
        'Entreprise',
      secteur: fiche.secteur_declare || ref?.secteur,
      ville: fiche.zone_geographique || ref?.zoneGeographique,
      decideur,
      besoinDetecte: fiche.besoin_detecte,
      raisonDuScore: fiche.raison_du_score,
      prochaineAction: fiche.prochaine_action,
      dateRelance: fiche.date_relance,
      messageBrouillon: fiche.message_brouillon,
      messageCanal: fiche.message_canal,
      historique: fiche.historique_interactions,
      objections: fiche.objections_detectees,
      signaux: fiche.signaux_externes,
      scoreFit: fiche.score_fit,
      ficheEtat: contact.ficheEtat,
      referentiel: ref
        ? {
            adresseSiege: ref.adresseSiege,
            telephoneStandard: ref.telephoneStandard,
            emailGenerique: ref.emailGenerique,
            siteWeb: ref.siteWeb,
            identifiantNational: ref.identifiantNational,
            anneeCreation: ref.anneeCreation,
            tailleEstimee: ref.tailleEstimee || fiche.taille_estimee,
            statutActivite: ref.statutActivite,
            scoreFraicheur: ref.scoreFraicheur,
            dateDerniereVerification: ref.dateDerniereVerification,
            sourceLabel: 'Référentiel Ciblix',
          }
        : {
            telephoneStandard: contact.phone,
            emailGenerique: contact.email,
            tailleEstimee: fiche.taille_estimee,
          },
      resurgence: Boolean(fiche.signaux_externes?.length && fiche.historique_interactions?.length),
    };
  }, [contact, fiche, ref]);

  if (isPending) return <p className="p-4 text-sm text-muted-foreground">Chargement…</p>;
  if (error || !contact || !mapped) {
    return <p className="p-4 text-sm text-destructive">Contact introuvable.</p>;
  }

  return (
    <div className="relative min-h-[70vh]">
      <div className="mx-auto mb-3 flex max-w-lg items-center gap-2 px-1">
        <Link to="/contacts">
          <Button variant="ghost" size="sm" className="h-10 gap-1.5 px-2">
            <ArrowLeft size={14} /> Retour
          </Button>
        </Link>
      </div>

      <FicheEntreprise
        contactId={contact.id}
        {...mapped}
        dictationPrompt={dictationPrompt}
        onDismissDictationPrompt={() => {
          setDictationPrompt(null);
          if (id) sessionStorage.removeItem(`ciblix_outbound_${id}`);
        }}
        onReprendre={() => reprendre.mutate()}
        onVoirMessage={() => reprendre.mutate()}
        onDicter={() => setDictationOpen(true)}
      />

      {dictationOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <h2 className="text-base font-medium">Dicter une note</h2>
            <p className="mt-1 text-xs text-neutral-500">
              Quinze secondes suffisent. Le Scribe écrit le suivi — aucun champ à remplir.
            </p>
            <textarea
              className="mt-4 min-h-[120px] w-full rounded-xl border border-neutral-200 px-3 py-2 text-[13px] outline-none focus:border-[#016AEB]"
              placeholder="J’ai eu Trabelsi, intéressé mais budget bloqué jusqu’en septembre…"
              value={dictationText}
              onChange={(e) => setDictationText(e.target.value)}
              autoFocus
            />
            <div className="mt-4 flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-11 flex-1"
                onClick={() => setDictationOpen(false)}
              >
                Annuler
              </Button>
              <Button
                type="button"
                className="h-11 flex-1 bg-[#016AEB] hover:bg-[#0159c4]"
                disabled={dictationText.trim().length < 8 || scribe.isPending}
                onClick={() => scribe.mutate(dictationText.trim())}
              >
                Envoyer au Scribe
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
