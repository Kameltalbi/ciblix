import type { FicheEntrepriseData, FicheEtat } from './types.js';

export type ExitCheck = {
  ok: boolean;
  etatCible: FicheEtat | null;
  raison: string;
};

const DEFAULT_SCORE_SEUIL = 55;

function hasIdentite(data: FicheEntrepriseData): boolean {
  return Boolean(data.identite_entreprise?.nom_legal?.trim());
}

function hasCanalOuDecideur(data: FicheEntrepriseData): boolean {
  const d = data.decideur;
  if (!d) return false;
  if (d.nom?.trim() && d.source?.trim()) return true;
  if (d.canal_prefere) return true;
  return false;
}

/** Conditions de sortie par agent — si non remplies → bloquee_humain / archivee / pas de fiche. */
export function checkProspecteurExit(data: FicheEntrepriseData): ExitCheck {
  if (!hasIdentite(data)) {
    return { ok: false, etatCible: null, raison: 'identite_entreprise manquante — fiche non créée' };
  }
  if (!data.critere_de_match?.trim()) {
    return { ok: false, etatCible: null, raison: 'aucun critère ICP matché — fiche non créée' };
  }
  return {
    ok: true,
    etatCible: 'decouverte',
    raison: `Entreprise découverte : ${data.identite_entreprise!.nom_legal}`,
  };
}

export function checkAnalysteExit(
  data: FicheEntrepriseData,
  scoreSeuil = DEFAULT_SCORE_SEUIL
): ExitCheck {
  const score = typeof data.score_fit === 'number' ? data.score_fit : null;
  if (score == null || !data.raison_du_score?.trim()) {
    return {
      ok: false,
      etatCible: 'bloquee_humain',
      raison: 'score_fit ou raison_du_score manquant',
    };
  }
  if (score < scoreSeuil) {
    return {
      ok: false,
      etatCible: 'archivee',
      raison: `Score ${score}/${scoreSeuil} — sous le seuil tenant`,
    };
  }
  if (!hasCanalOuDecideur(data)) {
    return {
      ok: false,
      etatCible: 'bloquee_humain',
      raison: 'Aucun décideur sourcé ni canal fiable — ne pas inventer',
    };
  }
  return {
    ok: true,
    etatCible: 'qualifiee',
    raison: data.raison_du_score,
  };
}

export function checkRedacteurExit(data: FicheEntrepriseData): ExitCheck {
  if (!data.message_brouillon?.trim()) {
    return {
      ok: false,
      etatCible: 'bloquee_humain',
      raison: 'message_brouillon vide',
    };
  }
  if (data.validation_separation?.erreur_detectee) {
    return {
      ok: false,
      etatCible: 'bloquee_humain',
      raison: data.validation_separation.details || 'confusion rôles tenant/cible',
    };
  }
  if (data.validation_qualite && !data.validation_qualite.conforme) {
    return {
      ok: false,
      etatCible: 'bloquee_humain',
      raison: (data.validation_qualite.problemes || []).join('; ') || 'qualité non conforme',
    };
  }
  // contactee uniquement après envoi humain — ici on marque "prêt"
  return {
    ok: true,
    etatCible: null, // reste qualifiee jusqu’à confirmation d’envoi
    raison: 'Brouillon validé — en attente d’envoi humain',
  };
}

/** Après envoi confirmé par l’utilisateur. */
export function checkRedacteurSentExit(data: FicheEntrepriseData): ExitCheck {
  const base = checkRedacteurExit(data);
  if (!base.ok) return base;
  return {
    ok: true,
    etatCible: 'contactee',
    raison: 'Message envoyé — fiche contactée',
  };
}

export function checkScribeExit(data: FicheEntrepriseData): ExitCheck {
  if (!data.statut_deal?.trim() || !data.prochaine_action?.trim()) {
    return {
      ok: false,
      etatCible: 'bloquee_humain',
      raison: 'statut_deal ou prochaine_action manquant — proposer 2 options à l’humain',
    };
  }
  const deal = data.statut_deal.toLowerCase();
  let etat: FicheEtat = 'en_discussion';
  if (/(gagn|won|clos[ée]e?\s*gagn)/i.test(deal)) etat = 'gagnee';
  else if (/(perdu|lost|refus|pas_interesse)/i.test(deal)) etat = 'perdue';
  else if (/(contactee|a_recontacter|interesse|sans_reponse)/i.test(deal)) etat = 'en_discussion';

  return {
    ok: true,
    etatCible: etat,
    raison: `Deal « ${data.statut_deal} » — prochaine action : ${data.prochaine_action}`,
  };
}
