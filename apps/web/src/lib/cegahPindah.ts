import { useEffect } from "react";

/**
 * Menahan perpindahan halaman selama masih ada isian yang belum disimpan.
 *
 * Sejak panel admin memakai router sisi klien, berpindah halaman jadi murah —
 * satu klik, tanpa jeda, tanpa halaman berkedip. Justru itu bahayanya: isian
 * yang sedang diketik hilang tanpa suara, dan karena perpindahannya mulus,
 * staf sering tidak sadar sudah kehilangan apa pun.
 *
 * Dua jalur ditahan, karena keduanya jalur yang berbeda:
 *
 * - `astro:before-preparation` menahan klik menu di dalam panel.
 * - `beforeunload` menahan tutup tab, muat ulang, dan tautan keluar. Router
 *   sisi klien tidak pernah melihat ketiganya.
 */
export function useCegahPindah(adaPerubahan: boolean, pesan = "Ada isian yang belum disimpan. Tinggalkan halaman ini?") {
  useEffect(() => {
    if (!adaPerubahan) return;

    const cegahNavigasi = (e: Event) => {
      // confirm() bawaan, bukan dialog sendiri: pertanyaan ini harus
      // menghentikan perpindahan SEBELUM halaman berganti, dan dialog React
      // yang dirender setelahnya sudah terlambat.
      if (!window.confirm(pesan)) e.preventDefault();
    };

    const cegahTutup = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Browser modern mengabaikan teksnya dan memakai kalimatnya sendiri;
      // returnValue tetap diisi karena sebagian browser lama memerlukannya.
      e.returnValue = pesan;
    };

    document.addEventListener("astro:before-preparation", cegahNavigasi);
    window.addEventListener("beforeunload", cegahTutup);
    return () => {
      document.removeEventListener("astro:before-preparation", cegahNavigasi);
      window.removeEventListener("beforeunload", cegahTutup);
    };
  }, [adaPerubahan, pesan]);
}
