/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CMS_URL?: string
  readonly VITE_REVEALUI_PUBLIC_SERVER_URL?: string
  readonly NODE_ENV?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
