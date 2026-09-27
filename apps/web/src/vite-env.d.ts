/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_APP_NAME?: string;
  readonly VITE_SUPPORT_EMAIL?: string;
  readonly VITE_ACTIVITY_POLL_MS?: string;
  readonly VITE_VIDEO_MODE?: 'demo' | 'youtube';
  /** Simulated player fallback toggle (see VideoPage). */
  readonly VITE_DEMO_MODE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
