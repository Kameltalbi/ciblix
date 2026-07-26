import type {
  BrandTone,
  CommercialMessageParams,
  TargetProfile,
  TenantProfile,
} from './types.js';

function fill(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? '');
}

/** System + user pour génération — balises XML strictes tenant / cible. */
export function buildGenerationPrompts(
  tenant: TenantProfile,
  target: TargetProfile,
  params: CommercialMessageParams,
  retryFeedback?: string
): { system: string; user: string } {
  const services =
    tenant.services_offerts.length > 0
      ? tenant.services_offerts.join(' · ')
      : '(non renseigné en Mission — reste très général, n’invente AUCUN produit)';

  const system = `Tu es un assistant de rédaction commerciale professionnel. Ton unique rôle est de rédiger 
un message de prospection AU NOM d'une entreprise (le "tenant") DESTINÉ à un prospect cible.

=== RÈGLE ABSOLUE — NE JAMAIS ENFREINDRE ===
Tu écris DEPUIS <notre_entreprise> VERS <prospect_cible>.
- Les informations dans <notre_entreprise> décrivent CE QUE NOUS VENDONS. 
  Tu dois les présenter comme "nos services", "notre offre", "nous proposons".
- Les informations dans <prospect_cible> décrivent UNIQUEMENT le contexte du destinataire 
  (son secteur, son activité, son besoin). Tu ne dois JAMAIS les reformuler comme si 
  c'était nos propres services. Elles servent uniquement à personnaliser l'accroche 
  et montrer que nous comprenons son métier.
- Si un mot-clé apparaît dans les deux blocs (ex: le tenant et la cible sont dans le même 
  secteur), tu dois quand même respecter strictement qui est l'expéditeur et qui est le 
  destinataire dans chaque phrase.
- Les services listés viennent d'une fiche VALIDÉE par le client. N'invente JAMAIS un produit 
  qui n'y figure pas (ex. événementiel, développement SaaS sur-mesure si absents de la liste).

=== FEW-SHOT — EXEMPLE CORRECT ===
notre_entreprise: TechSoft Tunisie, éditeur de logiciels de gestion RH
prospect_cible: Société Al Amana, secteur textile, 200 employés, besoin: gestion des congés manuelle

✅ BON exemple:
"Bonjour M. Trabelsi,

Je vois qu'Al Amana gère une équipe de 200 personnes dans le textile — un secteur où la 
gestion des plannings et congés devient vite complexe à gérer manuellement.

Chez TechSoft, nous accompagnons justement les entreprises industrielles tunisiennes avec 
un logiciel RH qui automatise ces process et fait gagner plusieurs heures par semaine aux 
équipes RH.

Seriez-vous disponible pour un échange de 15 minutes cette semaine ?

Cordialement,
[Signature TechSoft]"

=== FEW-SHOT — EXEMPLE INCORRECT (à ne jamais reproduire) ===
❌ MAUVAIS exemple (confusion des rôles):
"Bonjour M. Trabelsi,

Nous sommes ravis de voir qu'Al Amana propose des solutions RH innovantes pour le textile..."
→ ERREUR: attribue au PROSPECT (Al Amana) l'activité qui est en réalité celle du TENANT 
  (TechSoft). Al Amana n'est pas dans le RH, c'est le textile.

Autre erreur fréquente (Softfacture → prospect marketplace):
❌ "Chez Softfacture, nous proposons des solutions événementielles / le développement de votre place de marché..."
→ Softfacture vend de la FACTURATION, pas le métier du prospect.

=== FORMAT DE SORTIE ===
Réponds UNIQUEMENT avec le message final, sans préambule, sans "Voici le message:", 
sans commentaire. Si canal = email, la première ligne doit être "Objet: ..." suivie 
d'une ligne vide puis le corps du message.`;

  const user = fill(
    `=== DONNÉES (deux blocs distincts — ne pas fusionner) ===

<notre_entreprise>
Nom: {{tenant_nom}}
Secteur d'activité: {{tenant_secteur}}
Services/produits proposés (à présenter comme LES NÔTRES — fiche validée uniquement): {{tenant_services}}
Proposition de valeur: {{tenant_value_prop}}
Ton de marque souhaité: {{tenant_ton}}
Signature à utiliser: {{tenant_signature}}
</notre_entreprise>

<prospect_cible>
Nom de l'entreprise: {{target_nom}}
Secteur d'activité (CONTEXTE UNIQUEMENT — jamais à présenter comme nos services): {{target_secteur}}
Décideur / interlocuteur: {{target_decideur}}
Besoin détecté / signal d'intérêt: {{target_besoin}}
Contexte de la dernière interaction (si relance): {{target_historique}}
</prospect_cible>

=== PARAMÈTRES DU MESSAGE ===
Canal: {{canal}}
Langue: {{langue}}
Objectif du message: {{objectif}}

=== ADAPTATION SELON LE CANAL ===
- Si canal = "email": inclure un objet court et clair, formule d'appel adaptée au ton, 
  structure en 3 paragraphes max (accroche personnalisée / valeur proposée / appel à l'action), 
  signature complète.
- Si canal = "whatsapp": pas d'objet, message court (max 60-80 mots), ton plus direct mais 
  respectueux, un seul call-to-action clair.
- Si canal = "linkedin": ton semi-formel, pas de signature complète, message court.

=== OBJECTIF RÉDACTIONNEL ===
OBJECTIF : rédiger un message de prospection de {{tenant_nom}} vers {{target_nom}}.
CE QUE NOUS VENDONS (à mentionner): {{tenant_services}}
CE QUE FAIT LE PROSPECT (contexte uniquement, jamais à présenter comme nôtre): {{target_secteur}} — {{target_besoin}}

Le message doit :
- Présenter NOS services en lien avec LEUR besoin détecté
- Ne jamais décrire nos produits en utilisant le vocabulaire du secteur du prospect comme si c'était le nôtre
- Rester {{tenant_ton}}, en {{langue}}

{{retry_block}}

Rédige maintenant le message.`,
    {
      tenant_nom: tenant.nom_entreprise,
      tenant_secteur: tenant.secteur_activite || '—',
      tenant_services: services,
      tenant_value_prop: tenant.value_proposition || '—',
      tenant_ton: tenant.ton_de_marque,
      tenant_signature: tenant.signature,
      target_nom: target.nom_entreprise,
      target_secteur: target.secteur_activite || '—',
      target_decideur: target.decideur || '—',
      target_besoin: target.besoin_detecte || '—',
      target_historique: target.contexte_derniere_interaction || '—',
      canal: params.canal,
      langue: params.langue,
      objectif: params.objectif,
      retry_block: retryFeedback
        ? `=== CORRECTION OBLIGATOIRE (échec audit précédent) ===\n${retryFeedback}\nCorrige UNIQUEMENT ces points.`
        : '',
    }
  );

  return { system, user };
}

/** Validateur rôles — ne reçoit PAS le prompt de génération, seulement draft + données brutes. */
export function buildRoleSeparationValidatorPrompt(
  tenant: TenantProfile,
  target: TargetProfile,
  draftText: string
): { system: string; user: string } {
  const system = `Tu es un vérificateur strict et impartial. Tu n'as pas généré ce message — ton seul rôle 
est de l'auditer pour une seule chose précise : la confusion entre l'expéditeur et le 
destinataire.

Ne juge PAS le style, le ton, la longueur, ou la qualité rédactionnelle — uniquement 
cette confusion de rôles.

Réponds STRICTEMENT en JSON valide, sans aucun texte avant ou après :
{
  "erreur_detectee": true ou false,
  "type_erreur": "confusion_services" | "confusion_secteur" | "inversion_sens" | "aucune",
  "phrase_problematique": "citation exacte de la phrase en erreur, ou chaîne vide",
  "details": "explication en une phrase courte, ou chaîne vide"
}`;

  const user = `=== CONTEXTE DE RÉFÉRENCE ===
Expéditeur (celui qui envoie le message):
- Nom: ${tenant.nom_entreprise}
- Services qu'il vend réellement: ${tenant.services_offerts.join(' · ') || '(non renseigné)'}

Destinataire (celui qui reçoit le message):
- Nom: ${target.nom_entreprise}
- Secteur d'activité réel: ${target.secteur_activite || '—'}

=== MESSAGE À AUDITER ===
"""
${draftText}
"""

=== TA MISSION ===
Vérifie uniquement si le message commet une ou plusieurs de ces erreurs :
1. Il attribue au destinataire (${target.nom_entreprise}) des services qui appartiennent en 
   réalité à l'expéditeur (${tenant.services_offerts.join(', ') || 'services émetteur'})
2. Il attribue à l'expéditeur (${tenant.nom_entreprise}) le secteur d'activité du destinataire 
   (${target.secteur_activite || 'secteur cible'}) comme si c'était sa propre activité
3. Il inverse le sens du message (comme si le destinataire vendait quelque chose à 
   l'expéditeur plutôt que l'inverse)`;

  return { system, user };
}

export function buildQualityValidatorPrompt(
  draftText: string,
  tenant: TenantProfile,
  params: CommercialMessageParams
): { system: string; user: string } {
  const system = `Tu es un relecteur qualité pour des messages commerciaux professionnels destinés au 
marché tunisien/africain (contexte multilingue français/arabe/anglais).

Réponds STRICTEMENT en JSON valide :
{
  "conforme": true ou false,
  "problemes": ["liste des problèmes détectés, vide si conforme"],
  "suggestion_correction": "courte suggestion si non conforme, sinon chaîne vide"
}`;

  const user = `=== MESSAGE À ÉVALUER ===
"""
${draftText}
"""

=== CRITÈRES ATTENDUS ===
- Ton demandé: ${tenant.ton_de_marque}
- Canal: ${params.canal}
- Langue: ${params.langue}, sans fautes grammaticales ou orthographiques
- Aucune promesse chiffrée qui ne soit pas fournie dans les données source
- Longueur adaptée: email 80-150 mots, whatsapp 40-80 mots, linkedin 50-100 mots
- Un seul appel à l'action, pas plusieurs demandes simultanées
- Pas de formulation qui pourrait sembler insistante ou agressive`;

  return { system, user };
}

export function mapToneToBrand(tone: string | undefined | null): BrandTone {
  if (tone === 'doux' || tone === 'chaleureux' || tone === 'friendly') return 'chaleureux';
  if (tone === 'ferme' || tone === 'formel' || tone === 'formal') return 'formel';
  return 'direct';
}
