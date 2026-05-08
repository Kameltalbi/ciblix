/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** `true` = afficher « Continuer avec Google » sur login / inscription */
  readonly VITE_ENABLE_GOOGLE_AUTH?: string;
  readonly VITE_SENTRY_DSN?: string;
  readonly VITE_SENTRY_ENVIRONMENT?: string;
  readonly VITE_SENTRY_RELEASE?: string;
  readonly VITE_SENTRY_TRACES_SAMPLE_RATE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
