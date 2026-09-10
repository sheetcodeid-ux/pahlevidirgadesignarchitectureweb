// @ts-check
import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import react from "@astrojs/react";

const site = process.env.PUBLIC_SITE_URL ?? "https://pahlevidirgaarchitecture.com";

export default defineConfig({
  // /tentang diganti /studio. Alamat lama tetap hidup sebagai pengalihan:
  // membiarkannya mati membuang tautan yang sudah pernah dibagikan dan
  // peringkat apa pun yang sudah dikumpulkannya.
  redirects: {
    "/tentang": "/studio",
    // Pindah ke kelompok Situs Publik di sidebar. Alamat lama tetap hidup:
    // panel admin sering dibuka dari tab yang sudah dibookmark, dan halaman
    // yang mendadak 404 terbaca sebagai fitur yang dihapus.
    "/admin/klien": "/admin/halaman/klien",
  },
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

  /* Halaman berikutnya diambil SEBELUM diklik.
   *
   * Panel admin memakai ClientRouter, jadi pindah halaman berarti mengambil
   * HTML halaman tujuan lalu menukarnya. Tanpa prefetch, pengambilan itu baru
   * mulai saat menu diklik — terukur menambah sekitar 250 ms pada tiap
   * perpindahan, padahal datanya sendiri sudah ada di cache.
   *
   * Strategi "hover": diambil begitu kursor menyentuh menunya, biasanya
   * beberapa ratus milidetik sebelum kliknya terjadi. Bukan "viewport", yang
   * akan menarik SELURUH halaman admin sekaligus begitu sidebar tampil —
   * boros untuk panel yang cuma dipakai dua orang. */
  prefetch: {
    prefetchAll: true,
    defaultStrategy: "hover",
  },

  build: {
    inlineStylesheets: "auto",
  },

  image: {
    // Gambar proyek dilayani dari R2 lewat CDN Cloudflare.
    remotePatterns: [{ protocol: "https" }],
  },
});
