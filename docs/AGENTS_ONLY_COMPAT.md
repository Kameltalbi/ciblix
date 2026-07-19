# Ciblix Agents IA — couche de compatibilité CRM

## Statut

Depuis le cutover « Agents only », l’interface utilisateur n’expose plus le CRM
(nav, pages, marketing). Les tables et routes CRM restent montées côté API car
certains agents y lisent encore des données en interne.

## Accueil produit

- Post-login / onboarding / paiement approuvé → `/agents`
- Anciennes URL CRM (`/dashboard`, `/affaires`, `/clients`, `/leads`, …) → redirect `/agents`

## Agents et dépendances CRM (temporaires)

| Agent | Dépendance CRM | Notes |
|-------|----------------|-------|
| Hunt AI | Optionnelle (écriture Lead / Calendar) | UI orientée `AiProspect` ; bouton « Enregistrer le prospect IA » |
| Copilot | Lecture Affaire/Client/Lead… | Briefing encore basé sur ces modèles ; liens UI vers CRM retirés |
| OffreBot | Optionnelle | Brief libre prioritaire ; `affaireId` encore accepté en API |
| Scout / FactCheck / BrandPulse | Aucune | Tables propres |
| Gmail IA | Aucune (Gmail OAuth) | Lit inbox via History API ; brouillons + libellé « Réponse à valider » ; jamais d’envoi auto |

## Routes API CRM à conserver (non exposées UI)

`/api/clients`, `/api/leads`, `/api/affaires`, `/api/products`, `/api/activites`,
`/api/calendar`, `/api/expenses`, `/api/sales-objectives`, `/api/kpis`, …

## Suppression future

Ne dropper aucune table tant que Hunt / Copilot / OffreBot ne sont pas
entièrement découplés, et après backup prod validé.
