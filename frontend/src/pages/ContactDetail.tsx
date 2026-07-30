import { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { FicheEntrepriseDashboard } from '@/components/fiche-entreprise';
import {
  DicterNoteModal,
  type ScribeResultPreview,
} from '@/components/fiche-entreprise/DicterNoteModal';
import type { FicheEntrepriseDataView } from '@/components/fiche-entreprise/types';
import { normalizeMessageDraft } from '@/components/fiche-entreprise/ficheDisplay';
import type { DossierIntelligenceView } from '@/components/fiche-entreprise/DossierIntelligencePanels';
import { whatsappEligiblePhone } from '@/components/fiche-entreprise/ficheLinks';

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
  const user = useAuth((s) => s.user);
  const [dictationOpen, setDictationOpen] = useState(false);
  const [dictationPrompt, setDictationPrompt] = useState<string | null>(null);
  const [scribeError, setScribeError] = useState<string | null>(null);
  const [scribeResult, setScribeResult] = useState<ScribeResultPreview | null>(null);
  const [messageError, setMessageError] = useState<string | null>(null);

  const { data, isPending, error } = useQuery({
    queryKey: ['contact', id],
    queryFn: () => api.get(`/contacts/${id}`).then((r) => r.data),
    enabled: Boolean(id),
  });

  const { data: missionData } = useQuery({
    queryKey: ['mission'],
    queryFn: () => api.get('/mission').then((r) => r.data),
    staleTime: 5 * 60_000,
  });

  const { data: orgData } = useQuery({
    queryKey: ['organizations'],
    queryFn: () => api.get('/organizations').then((r) => r.data),
    staleTime: 5 * 60_000,
  });

  const senderHints = useMemo(() => {
    const profile = missionData?.profile as
      | {
          identitySourceUrl?: string | null;
          identitySourceType?: string | null;
          identitySourceLabel?: string | null;
        }
      | undefined;
    const raw =
      profile?.identitySourceUrl?.trim() ||
      (profile?.identitySourceType === 'website' ? profile?.identitySourceLabel?.trim() : null) ||
      null;
    let website = raw;
    if (website) {
      const cleaned = website.replace(/\s+/g, '').replace(/[.,;:]+$/, '');
      website = /^https?:\/\//i.test(cleaned) ? cleaned : `https://${cleaned.replace(/^\/+/, '')}`;
      website = website.replace(/\/$/, '');
    }
    return {
      website,
      companyName: (orgData as { name?: string } | undefined)?.name?.trim() || null,
      userName: user?.name || null,
    };
  }, [missionData, orgData, user]);

  const showOutboundPrompt = (canal: 'appel' | 'whatsapp', name?: string | null) => {
    const who = name || 'le contact';
    const verb = canal === 'whatsapp' ? 'écrit sur WhatsApp à' : 'appelé';
    setDictationPrompt(`Vous venez d’${verb} ${who}. Dictez votre note ?`);
  };

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
      showOutboundPrompt(
        parsed.canal === 'whatsapp' ? 'whatsapp' : 'appel',
        parsed.name
      );
    } catch {
      /* ignore */
    }
  }, [id]);

  const reprendre = useMutation({
    mutationFn: () => api.post(`/contacts/${id}/reprendre`).then((r) => r.data),
    onSuccess: () => {
      setMessageError(null);
      void qc.invalidateQueries({ queryKey: ['contact', id] });
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Impossible de préparer le message.';
      setMessageError(msg);
    },
  });

  const saveMessage = useMutation({
    mutationFn: (message: string) =>
      api.patch(`/contacts/${id}/message-brouillon`, { message }).then((r) => r.data),
    onSuccess: () => {
      setMessageError(null);
      void qc.invalidateQueries({ queryKey: ['contact', id] });
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Impossible d’enregistrer le message.';
      setMessageError(msg);
    },
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
    onSuccess: (data: {
      structured?: ScribeResultPreview;
      needsHumanChoice?: boolean;
      options?: [string, string] | null;
    }) => {
      setScribeError(null);
      setScribeResult({
        resume: data.structured?.resume,
        prochaine_action: data.structured?.prochaine_action,
        date_relance: data.structured?.date_relance,
        statut_deal: data.structured?.statut_deal,
        objections_detectees: data.structured?.objections_detectees,
        needsHumanChoice: data.needsHumanChoice,
        options: data.options,
      });
      setDictationPrompt(null);
      if (id) sessionStorage.removeItem(`ciblix_outbound_${id}`);
      void qc.invalidateQueries({ queryKey: ['contact', id] });
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Impossible d’envoyer la note au Scribe.';
      setScribeError(msg);
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
          whatsapp: whatsappEligiblePhone(contact.whatsappId || contact.phone),
        }
      : contact.phone || contact.email || contact.whatsappId
        ? {
            nom: contact.name,
            phone: contact.phone,
            email: contact.email,
            whatsapp: whatsappEligiblePhone(contact.whatsappId || contact.phone),
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
      messageBrouillon: normalizeMessageDraft(fiche.message_brouillon),

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
    return <p className="p-4 text-sm text-destructive">Dossier introuvable.</p>;
  }

  const intelligence = (data as { intelligence?: DossierIntelligenceView } | undefined)?.intelligence ?? null;

  return (
    <div className="relative min-h-[70vh]">
      <div className="mx-auto mb-4 flex max-w-7xl items-center gap-2 px-1">
        <Link to="/contacts">
          <Button variant="ghost" size="sm" className="h-10 gap-1.5 px-2">
            <ArrowLeft size={14} /> Entreprises
          </Button>
        </Link>
      </div>

      <FicheEntrepriseDashboard
        contactId={contact.id}
        contactName={contact.name}
        {...mapped}
        intelligence={intelligence}
        messagePending={reprendre.isPending}
        messageSavePending={saveMessage.isPending}
        messageError={messageError}
        senderHints={senderHints}
        dictationPrompt={dictationPrompt}
        onDismissDictationPrompt={() => {
          setDictationPrompt(null);
          if (id) sessionStorage.removeItem(`ciblix_outbound_${id}`);
        }}
        onOutbound={(canal) => showOutboundPrompt(canal, mapped.decideur?.nom || mapped.nomLegal)}
        onReprendre={() => {
          setMessageError(null);
          reprendre.mutate();
        }}
        onVoirMessage={() => {
          setMessageError(null);
          reprendre.mutate();
        }}
        onSaveMessage={async (message) => {
          setMessageError(null);
          await saveMessage.mutateAsync(message);
        }}
        onDicter={() => {
          setScribeResult(null);
          setScribeError(null);
          setDictationOpen(true);
        }}
      />

      <DicterNoteModal
        open={dictationOpen}
        pending={scribe.isPending}
        error={scribeError}
        result={scribeResult}
        onClose={() => {
          setDictationOpen(false);
          setScribeError(null);
          setScribeResult(null);
        }}
        onDone={() => {
          setDictationOpen(false);
          setScribeResult(null);
        }}
        onSubmit={(texte) => scribe.mutate(texte)}
      />
    </div>
  );
}
