import { useEffect } from "react";
import { navigate } from "astro:transitions/client";
import { tanya } from "./tanya";

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
 * - `astro:before-preparation` menahan klik menu di dalam panel — ditanyakan
 *   lewat dialog kit (`lib/tanya`), lalu dijalankan ulang kalau disetujui.
 * - `beforeunload` menahan tutup tab, muat ulang, dan tautan keluar. Router
 *   sisi klien tidak pernah melihat ketiganya, dan di sini peramban SELALU
 *   memakai kotaknya sendiri — tidak ada cara mengganti tampilannya.
 */
export function useCegahPindah(adaPerubahan: boolean, pesan = "Ada isian yang belum disimpan. Tinggalkan halaman ini?") {
  useEffect(() => {
    if (!adaPerubahan) return;

    let lolos = false;
    const cegahNavigasi = (e: Event) => {
      if (lolos) return;
      // Perpindahannya dihentikan dulu, lalu ditanyakan lewat dialog kit
      // (bukan confirm() bawaan peramban). Kalau dijawab "Tinggalkan",
      // perpindahan yang sama dijalankan ulang.
      e.preventDefault();
      const ke = (e as Event & { to?: URL }).to;
      tanya({ judul: "Tinggalkan halaman ini?", isi: pesan, ya: "Tinggalkan", tidak: "Tetap di sini", bahaya: true }).then((ya) => {
        if (!ya || !ke) return;
        lolos = true;
        navigate(ke.href);
      });
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
