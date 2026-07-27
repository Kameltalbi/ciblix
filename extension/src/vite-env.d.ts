/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CIBLIX_API?: string;
  readonly VITE_CIBLIX_FRONTEND?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
