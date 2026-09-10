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
 * Kredit proyek yang terakhir menyusul: kontraktor, lighting, dan fotografer
 * kini punya kolomnya sendiri di public.projects dan diisi per proyek dari tab
 * Detail — memang harus per proyek, karena fotografernya berganti dari satu
 * karya ke karya berikutnya.
 *
 * Yang TERSISA di sini cuma kalimat penandanya. Ia bukan data yang diisi
 * pemilik melainkan bagian dari rancangan — satu kalimat, satu tempat, supaya
 * tidak ada dua versi berbeda di halaman berbeda.
 */

/* ── Kalimat penanda ─────────────────────────────────────────────────────── */

/** Dipakai di mana pun sebuah nama belum diberikan. */
export const BELUM_ADA = "Name to be credited";

/** Dipakai di mana pun sebuah tahun belum diberikan. */
export const TAHUN_BELUM = "YEAR?";
