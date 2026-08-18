// @ts-check
import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";

const site = process.env.PUBLIC_SITE_URL ?? "https://pahlevidirga.com";

export default defineConfig({
  site,

  // Static: seluruh halaman proyek di-render saat build, lalu disajikan dari
  // edge Cloudflare. Backend Go hanya disentuh saat build dan saat form
  // kontak dikirim, jadi instance-nya nyaris selalu idle.
  output: "static",

  integrations: [sitemap()],

  build: {
    inlineStylesheets: "auto",
  },

  image: {
    // Gambar proyek dilayani dari R2 lewat CDN Cloudflare.
    remotePatterns: [{ protocol: "https" }],
  },
});
