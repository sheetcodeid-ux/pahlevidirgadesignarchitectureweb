/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly PUBLIC_API_BASE_URL: string;
  readonly PUBLIC_SITE_URL: string;
  readonly PUBLIC_TURNSTILE_SITE_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Disuntikkan oleh script Turnstile; opsional karena widget hanya dimuat
// kalau site key sudah dikonfigurasi.
interface Window {
  turnstile?: {
    reset: (widgetId?: string) => void;
  };
}
