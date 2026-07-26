# TODO — Tests & alertes (à faire)

Objectif : éviter les crashs / erreurs en prod et être alerté rapidement.

## Priorité (ordre)

1. [ ] **Sentry prod** — vérifier `SENTRY_DSN` (backend) + DSN frontend ; alertes email/Slack sur nouvelles erreurs / spikes
2. [ ] **Uptime** — moniteur externe (UptimeRobot / Better Stack) sur `GET /api/health` + page d’accueil (1–5 min)
3. [ ] **CI GitHub Actions** — sur push/PR `main` : `frontend typecheck` + `backend test:unit` + builds
4. [ ] **Vitest** — tests manquants sur chemins critiques : auth/org APPROVED, trial expire/prolonger, overview superadmin
5. [ ] **Playwright** — 3 scénarios smoke : login → dashboard ; inscription essai ; `/admin` superadmin
6. [ ] (plus tard) load / cron léger avant gros releases (`scripts/load/…`)

## Déjà en place

- Sentry code (`@sentry/node`, `@sentry/react`) — no-op si DSN absent
- Vitest backend (billing, webhooks, pipeline…)
- `GET /api/health` (DB + latence + **heartbeats schedulers**)
- RLS : `setTenantRlsContext` posé à chaque auth JWT
- PM2 + ErrorBoundary front
- Observabilité superadmin (amorcée)

## Notes

- Les tests évitent les régressions connues ; Sentry + uptime attrapent le reste (DB down, OOM, bug non couvert).
- Ne pas committer de secrets ; DSN via env VPS / GitHub Secrets.
