import type { APIRoute } from "astro";
import { CAP_BUILD } from "../lib/capBuild";

/**
 * Berkas statis berisi stempel build. Panel admin menjatuhkannya setiap
 * beberapa detik selagi menunggu build selesai: begitu isinya berbeda dari
 * stempel yang dipanggang ke HTML panel, build yang baru sudah tayang.
 *
 * Workers Static Assets MENGGANTI seluruh aset saat deploy, jadi berkas ini
 * ikut berganti pada saat yang sama persis dengan halaman-halamannya —
 * tidak ada jeda antara "berkasnya bilang sudah" dan "situsnya memang sudah".
 */
export const GET: APIRoute = () =>
  new Response(JSON.stringify({ dibangunPada: CAP_BUILD }), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      // Tidak boleh disimpan di mana pun: seluruh gunanya adalah menjawab
      // "sekarang versi berapa", dan jawaban yang di-cache selalu salah.
      "cache-control": "no-store",
    },
  });
