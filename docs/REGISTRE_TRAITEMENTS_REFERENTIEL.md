# Registre des traitements — Référentiel entreprises Ciblix

> Document à faire relire par un conseil juridique local (Tunisie / marchés ciblés) avant mise en production élargie.
> Nature : description technique des traitements — ne constitue pas un avis juridique.

## Finalités

1. **Référentiel mutualisé** : constituer et maintenir une base de faits publics vérifiables sur des entreprises (raison sociale, secteur, adresse de siège, contacts génériques, sources).
2. **Intelligence tenant** : permettre à chaque organisation cliente de gérer son pipeline commercial (scores, décideurs, historiques) de façon cloisonnée.
3. **Amélioration collective contrôlée** : intégrer des corrections factuelles publiques (ex. entreprise fermée) après validation, sans partager le travail commercial d’un tenant.

## Catégories de données

| Couche | Données | Base légale / note |
|--------|---------|-------------------|
| Référentiel | Faits d’entreprise publics (registre, site, annuaires) | Traitement de données d’entreprises ; pas de personnes physiques identifiées |
| Tenant | Décideurs, emails nominatifs, scores, notes, historique | Données personnelles / relation commerciale — isolées par `organizationId` |

## Interdictions structurelles

- Aucun nom de personne physique, email nominatif, téléphone mobile personnel dans `entreprises_referentiel`.
- Aucun `score_fit`, besoin détecté, historique d’interaction dans le référentiel.
- Un tenant ne bénéficie jamais du travail commercial d’un autre tenant.

## Sous-traitance / hébergement

- Base PostgreSQL (VPS / hébergeur du déploiement Ciblix).
- Enrichissements optionnels via APIs tierces (Places, Firecrawl, OpenAI) — scopes limités, logs applicatifs sans cross-tenant.

## Droits et conservation

- Conservation du référentiel : tant que pertinent pour la finalité + politique de fraîcheur (re-vérification périodique).
- Données tenant : selon contrat client / droit d’effacement (`erasedAt` Contact).
- Corrections remontantes : journalisées (auteur, avant/après, mode de validation), revert possible.

## Mesures de sécurité

- Isolation applicative systématique par `organizationId` (injecté depuis l’auth).
- Row Level Security PostgreSQL sur `contacts` et `referentiel_corrections` (GUC `app.current_tenant_id`).
- Tests automatisés : champs interdits référentiel + filtre tenant obligatoire.

## Contact DPO / responsable

À compléter par Ciblix avant audit client : identité du responsable de traitement, canal INPDP / équivalent local.
