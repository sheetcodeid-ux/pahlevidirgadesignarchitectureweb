/**
 * Pengalih bahasa situs publik.
 *
 * Bentuknya sengaja sama dengan yang sudah dipakai portal klien (`/progres`):
 * elemen ditandai `data-t="kunci"`, dan satu kamus menukar isinya. Tidak ada
 * rute /id terpisah, tidak ada halaman kembar.
 *
 * Alasannya bukan kemalasan. Rute kembar berarti dua berkas berisi kalimat
 * yang sama, dan dua berkas yang harus diubah bersamaan PASTI menyimpang
 * suatu saat — pola bug yang sudah berkali-kali memakan waktu di proyek ini.
 * Dengan satu markup, kalimat Inggrisnya tetap satu-satunya sumber struktur;
 * yang disimpan di sini hanya terjemahannya.
 *
 * Konsekuensi yang harus diketahui: mesin pencari melihat versi INGGRIS.
 * Itu memang pasar situs ini; Indonesia disediakan untuk kenyamanan tamu
 * lokal, bukan untuk diindeks terpisah.
 */

/** Kunci → kalimat Indonesia. Yang Inggris tidak ditulis di sini: ia sudah
 *  ada di markup, dan skrip menyimpannya sendiri sebelum menukar. */
export type Kamus = Record<string, string>;

/** Dipakai di SETIAP halaman: bilah nav, laci, dan kaki halaman. */
export const KAMUS_UMUM: Kamus = {
  navWork: "Karya",
  navStudio: "Studio",
  navJournal: "Jurnal",
  navContact: "Kontak",
  mulaiProyek: "Mulai proyek",
  mulaiProyekPanah: "Mulai proyek →",
  /* Dipakai di beranda DAN /proyek. Di kamus umum, bukan disalin ke dua
     kamus halaman — dua salinan pasti menyimpang suatu saat. */
  ajakEmail: "Kirim email saja",
  lompat: "Lewati ke konten",

  kakiStudio: "Studio arsitektur",
  kakiSitus: "SITUS",
  kakiKlien: "KLIEN",
  kakiKontak: "KONTAK",
  kakiPortal: "Portal proyek",
  kakiBukti: "Bukti pembayaran",
  kakiFaq: "Tanya jawab",
  kakiKontakKosong: "Detail kontak diatur di panel studio.",
  kakiPrivasi: "Privasi",
};
