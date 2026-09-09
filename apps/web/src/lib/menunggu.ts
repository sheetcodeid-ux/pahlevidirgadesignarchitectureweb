/**
 * SATU TEMPAT UNTUK SEMUA DATA YANG MASIH DITUNGGU DARI PEMILIK.
 *
 * Halaman-halaman publik dibangun persis sesuai rancangan yang sudah di-ACC,
 * termasuk bagian yang datanya belum ada. Bagian itu TIDAK dihapus — ia
 * dirender dengan penanda "menunggu" yang memang ikut dirancang, supaya
 * bentuk halamannya tidak berubah begitu datanya masuk.
 *
 * Cara mengisinya: ganti nilainya di bawah ini saja. Setiap nilai yang sudah
 * terisi otomatis mematikan penandanya sendiri; tidak ada berkas lain yang
 * perlu disentuh.
 *
 * `null` atau array kosong berarti "belum ada".
 */

/* ── Identitas studio ────────────────────────────────────────────────────── */

/** Tahun studio berdiri. Dipakai di eyebrow beranda ("SINCE …") dan di
 *  tonggak pertama garis waktu /studio. */
export const TAHUN_BERDIRI: number | null = null;

/** Tahun proyek komersial pertama. Tonggak kedua garis waktu /studio. */
export const TAHUN_KOMERSIAL_PERTAMA: number | null = null;

/* ── Marquee "materials & partners we specify" di beranda ────────────────── */

/**
 * Sepuluh nama merek material atau mitra yang studio BENAR-BENAR pakai.
 *
 * Saran saya tetap: isi dengan merek material, bukan logo klien. Logo klien
 * yang tidak bisa dibuktikan adalah cara tercepat kehilangan kepercayaan
 * klien internasional.
 *
 * Selama masih berisi penanda di bawah, pitanya tetap tampil (sesuai
 * rancangan) tetapi tiap slotnya ditandai belum terisi.
 */
export const MITRA: string[] = [
  "BRAND 01",
  "BRAND 02",
  "BRAND 03",
  "BRAND 04",
  "BRAND 05",
  "BRAND 06",
  "BRAND 07",
  "BRAND 08",
  "BRAND 09",
  "BRAND 10",
];

/** True selama daftar di atas masih berisi penanda, bukan nama sungguhan. */
export const MITRA_MASIH_PENANDA = MITRA.every((m) => /^BRAND \d\d$/.test(m));

/* ── Tim di /studio ──────────────────────────────────────────────────────── */

export interface OrangStudio {
  /** null = namanya belum diberikan; halaman menampilkan penanda. */
  nama: string | null;
  peran: string;
  ket: string;
  /** URL potret 4:5. null = kotak foto tampil sebagai slot kosong. */
  foto: string | null;
  /** Label di slot foto yang masih kosong. */
  slot: string;
}

export const TIM: OrangStudio[] = [
  {
    nama: "Pahlevi Dirga",
    peran: "Principal architect",
    ket: "Draws the building and answers the phone. Every project on this site passed through this desk.",
    foto: null,
    slot: "PRINCIPAL",
  },
  {
    nama: null,
    peran: "Project coordinator",
    ket: "Keeps the client page current — phases, documents, invoices — so that nobody has to ask for a status.",
    foto: null,
    slot: "STAFF",
  },
];

/* ── Pembanding sebelum/sesudah di /studio ───────────────────────────────── */

/** Foto lokasi sebelum dibangun dan sesudah jadi. Keduanya harus ada supaya
 *  pembandingnya berarti; kalau salah satu kosong, keduanya tampil sebagai
 *  slot berpola. */
export const BANDING_SEBELUM: string | null = null;
export const BANDING_SESUDAH: string | null = null;

/* ── Kredit proyek ───────────────────────────────────────────────────────── */

/**
 * Peran yang selalu ditampilkan di blok kredit halaman proyek, walau namanya
 * belum ada. Kredit fotografer WAJIB kalau fotonya bukan milik studio —
 * selain soal etika, itu juga yang membuat fotografer arsitektur mau memotret
 * proyek Anda berikutnya.
 *
 * Skema proyek belum punya kolom untuk nama-nama ini; selama belum ada, tiap
 * barisnya tampil sebagai "Name to be credited".
 */
export const KREDIT_MENUNGGU = [
  { peran: "Photography", nama: null as string | null },
  { peran: "Contractor", nama: null as string | null },
  { peran: "Lighting", nama: null as string | null },
];

/** Teks yang dipakai di mana pun sebuah nama belum diberikan. Satu kalimat,
 *  satu tempat — supaya tidak ada dua versi yang berbeda di halaman berbeda. */
export const BELUM_ADA = "Name to be credited";
export const TAHUN_BELUM = "YEAR?";
