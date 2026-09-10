/**
 * Sisa data yang masih ditunggu dari pemilik DAN belum punya tempat di panel.
 *
 * Berkas ini dulu memuat semuanya: tahun berdiri, daftar klien, tim studio,
 * foto sebelum/sesudah, empat isian halaman privasi. Semuanya sudah pindah ke
 * database dan diurus pemilik sendiri lewat kelompok **Situs Publik** di
 * sidebar panel admin — karena satu-satunya cara mengisi berkas ini adalah
 * menyunting repo, dan pemilik tidak pernah menyentuh repo. Akibatnya
 * bagian-bagian itu berbulan menampilkan penanda "menunggu" di situs yang
 * tayang tanpa ada yang mengingatkan siapa pun.
 *
 * Yang TERSISA di sini cuma dua hal, dan keduanya sengaja:
 *
 * 1. Kalimat penanda yang dipakai di banyak halaman. Ia bukan data yang diisi
 *    pemilik melainkan bagian dari rancangan — satu kalimat, satu tempat,
 *    supaya tidak ada dua versi berbeda di halaman berbeda.
 * 2. Kredit proyek, yang skema database-nya memang belum punya kolomnya.
 */

/* ── Kredit proyek ───────────────────────────────────────────────────────── */

/**
 * Peran yang selalu ditampilkan di blok kredit halaman proyek, walau namanya
 * belum ada. Kredit fotografer WAJIB kalau fotonya bukan milik studio —
 * selain soal etika, itu juga yang membuat fotografer arsitektur mau memotret
 * proyek Anda berikutnya.
 *
 * Skema proyek belum punya kolom untuk nama-nama ini; selama belum ada, tiap
 * barisnya tampil sebagai "Name to be credited". Kalau suatu saat dibuatkan
 * kolomnya, tempatnya di tab Halaman Publik pada editor proyek — per proyek,
 * bukan satu daftar untuk seluruh studio, karena fotografernya bisa berbeda.
 */
export const KREDIT_MENUNGGU = [
  { peran: "Photography", nama: null as string | null },
  { peran: "Contractor", nama: null as string | null },
  { peran: "Lighting", nama: null as string | null },
];

/* ── Kalimat penanda ─────────────────────────────────────────────────────── */

/** Dipakai di mana pun sebuah nama belum diberikan. */
export const BELUM_ADA = "Name to be credited";

/** Dipakai di mana pun sebuah tahun belum diberikan. */
export const TAHUN_BELUM = "YEAR?";
