/**
 * Terjemahan untuk kalimat yang ditulis JAVASCRIPT, bukan yang sudah ada di
 * markup.
 *
 * Pengalih bahasa di BaseLayout bekerja dengan menukar isi elemen ber-
 * `data-t`. Itu cukup untuk teks yang dirender saat build — tapi tidak untuk
 * kalimat yang dirakit di browser: "6 projects" saat menyaring kategori,
 * nama kategori yang pindah ke judul panel, pesan galat form kontak. Elemen
 * itu ditulis ulang SESUDAH kamus dijalankan, jadi isinya kembali Inggris
 * dan tidak pernah ditukar lagi.
 *
 * Yang TIDAK dilakukan di sini: menyalin kamusnya. Kamus halaman sudah ada di
 * DOM sebagai <script type="application/json" id="kamus-halaman"> — berkas
 * yang sama yang dipakai pengalih. Penolong ini membacanya dari situ, jadi
 * satu kalimat tetap punya satu terjemahan di satu tempat. Kalimat Inggrisnya
 * tetap tinggal di kode pemanggil, persis seperti ia tinggal di markup.
 */

type Kamus = Record<string, string>;

function bacaKamus(): Kamus {
  const el = document.getElementById("kamus-halaman");
  if (!el || !el.textContent) return {};
  try {
    return JSON.parse(el.textContent) as Kamus;
  } catch {
    /* JSON rusak: halaman tetap jalan, seluruhnya Inggris. */
    return {};
  }
}

export interface Penerjemah {
  /** Bahasa yang sedang dipakai. */
  bhs: () => "en" | "id";
  /**
   * Terjemahan `kunci`, atau `en` kalau bahasanya Inggris — atau kalau
   * kuncinya belum ada di kamus. Yang belum diterjemahkan tampil Inggris,
   * bukan hilang atau tampil sebagai nama kunci.
   */
  t: (kunci: string, en: string) => string;
  /** Dipanggil setiap kali bahasa ditukar, supaya isinya digambar ulang. */
  saatTukar: (gambar: () => void) => void;
}

export function penerjemah(): Penerjemah {
  const kamus = bacaKamus();
  const bhs = () => (document.documentElement.lang === "id" ? "id" : "en");
  return {
    bhs,
    t: (kunci, en) => (bhs() === "id" ? (kamus[kunci] ?? en) : en),
    saatTukar: (gambar) => addEventListener("situs:bahasa", () => gambar()),
  };
}
