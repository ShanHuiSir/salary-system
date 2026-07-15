/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_TITLE: string
  readonly VITE_APP_VERSION: string
  readonly VITE_BASE_PATH: string
  readonly VITE_ENABLE_ANALYSIS: string
  readonly VITE_API_BASE_URL?: string
  readonly VITE_API_TIMEOUT?: string
  readonly VITE_AUTH_API_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
