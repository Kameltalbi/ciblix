import type { ExtractedTenantProfile, InverseIcp } from './types.js';

async function callOpenAiJson(system: string, user: string): Promise<Record<string, unknown> | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        temperature: 0.2,
        max_tokens: 900,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const raw = data.choices?.[0]?.message?.content?.trim() || '';
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function asList(v: unknown): string[] {
  return Array.isArray(v) ? v.map(String).map((s) => s.trim()).filter(Boolean).slice(0, 12) : [];
}

function fallbackIcpFromOffer(
  clients: string[],
  geo: string[],
  extracted: ExtractedTenantProfile | null
): InverseIcp {
  const secteur = extracted?.secteur_activite.value;
  const services = extracted?.services_et_produits.value || [];
  const zones = geo.length ? geo : ['Tunisie'];
  const texte = secteur
    ? `Profil de départ (à affiner) : entreprises proches de votre secteur « ${secteur} »${
        services[0] ? `, intéressées par ${services[0]}` : ''
      }, principalement en ${zones.join(', ')}. On cherche ce profil ?`
    : `Profil de départ (à affiner avec vos premiers retours) : PME en ${zones.join(
        ', '
      )} susceptibles d’acheter votre offre. On cherche ce profil ?`;

  return {
    secteurs_cibles: secteur ? [secteur] : [],
    taille_min: 10,
    taille_max: 200,
    zones,
    type_acheteur: 'prive',
    signaux_positifs: ['croissance', 'digitalisation'],
    confiance: 0.35,
    fonde_sur: clients.slice(0, 2),
    clients_atypiques_exclus: [],
    texte_naturel: texte,
    fallback_from_offer: true,
  };
}

/**
 * ICP inversé : partir des clients cités, pas d’une déclaration « qui ciblez-vous ? ».
 */
export async function buildInverseIcp(opts: {
  referenceClients: string[];
  geoZones: string[];
  extracted: ExtractedTenantProfile | null;
}): Promise<InverseIcp> {
  const clients = opts.referenceClients.map((c) => c.trim()).filter(Boolean).slice(0, 8);
  const identifiable = clients.length >= 3;

  if (!identifiable) {
    return fallbackIcpFromOffer(clients, opts.geoZones, opts.extracted);
  }

  const system = `Tu construis un ICP (Ideal Customer Profile) à partir de clients RÉELS cités.
Ne demande rien au tenant. Déduis les points communs dominants.
Si un client est atypique (secteur isolé), mets-le dans clients_atypiques_exclus.
Réponds JSON :
{
  "secteurs_cibles": [],
  "taille_min": number|null,
  "taille_max": number|null,
  "zones": [],
  "type_acheteur": "prive"|"public"|"mixte"|"informel",
  "signaux_positifs": [],
  "confiance": 0-1,
  "fonde_sur": [],
  "clients_atypiques_exclus": [],
  "texte_naturel": "2 phrases FR, style oral, termine par une question Oui/Ajuster"
}`;

  const parsed = await callOpenAiJson(
    system,
    JSON.stringify({
      clients,
      geo_saisie: opts.geoZones,
      offre_tenant: {
        secteur: opts.extracted?.secteur_activite.value,
        services: opts.extracted?.services_et_produits.value,
      },
    })
  );

  if (!parsed) {
    const zones = opts.geoZones.length ? opts.geoZones : ['Tunisie'];
    return {
      secteurs_cibles: [],
      taille_min: 20,
      taille_max: 250,
      zones,
      type_acheteur: 'prive',
      signaux_positifs: [],
      confiance: 0.45,
      fonde_sur: clients.slice(0, 3),
      clients_atypiques_exclus: [],
      texte_naturel: `Vos clients cités (${clients.slice(0, 3).join(', ')}) ressemblent à des PME en ${zones.join(
        ', '
      )}. On cherche ce profil ?`,
      fallback_from_offer: false,
    };
  }

  return {
    secteurs_cibles: asList(parsed.secteurs_cibles),
    taille_min: typeof parsed.taille_min === 'number' ? parsed.taille_min : null,
    taille_max: typeof parsed.taille_max === 'number' ? parsed.taille_max : null,
    zones: asList(parsed.zones).length ? asList(parsed.zones) : opts.geoZones,
    type_acheteur: typeof parsed.type_acheteur === 'string' ? parsed.type_acheteur : 'prive',
    signaux_positifs: asList(parsed.signaux_positifs),
    confiance: typeof parsed.confiance === 'number' ? parsed.confiance : 0.6,
    fonde_sur: asList(parsed.fonde_sur).length ? asList(parsed.fonde_sur) : clients.slice(0, 4),
    clients_atypiques_exclus: asList(parsed.clients_atypiques_exclus),
    texte_naturel:
      typeof parsed.texte_naturel === 'string' && parsed.texte_naturel.trim()
        ? parsed.texte_naturel.trim()
        : `Vos meilleurs clients ressemblent à des entreprises en ${opts.geoZones.join(', ') || 'Tunisie'}. On cherche ce profil ?`,
    fallback_from_offer: false,
  };
}
