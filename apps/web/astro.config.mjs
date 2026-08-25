// @ts-check
import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import react from "@astrojs/react";

const site = process.env.PUBLIC_SITE_URL ?? "https://pahlevidirgaarchitecture.com";

export default defineConfig({
  site,

  // Static: seluruh halaman proyek di-render saat build, lalu disajikan dari
  // edge Cloudflare. Backend Go hanya disentuh saat build dan saat form
  // kontak dikirim, jadi instance-nya nyaris selalu idle.
  output: "static",

  integrations: [
    // Halaman admin bertanda noindex; jangan diumumkan lewat sitemap.
    sitemap({ filter: (url) => !url.includes("/admin") }),
    react(),
  ],

  build: {
    inlineStylesheets: "auto",
  },

  image: {
    // Gambar proyek dilayani dari R2 lewat CDN Cloudflare.
    remotePatterns: [{ protocol: "https" }],
  },
});
