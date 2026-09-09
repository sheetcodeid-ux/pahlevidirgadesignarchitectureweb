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
 *  tonggak pertama garis waktu /studio. Diberikan pemilik. */
export const TAHUN_BERDIRI: number | null = 2025;

/** Tahun proyek komersial pertama. Tonggak kedua garis waktu /studio.
 *  Diberikan pemilik — tahun yang sama dengan berdirinya studio. */
export const TAHUN_KOMERSIAL_PERTAMA: number | null = 2025;

/* ── Marquee "materials & partners we specify" di beranda ────────────────── */

/**
 * Nama-nama yang berjalan di pita marquee beranda.
 *
 * PENTING — pemilik mengirim NAMA KLIEN (kedai kopi), bukan merek material.
 * Judul pita karena itu diubah jadi "SELECTED CLIENTS"; membiarkannya
 * berbunyi "materials & partners we specify" berarti mencetak pernyataan
 * yang tidak benar. Kalau kata "clients" kurang tepat — misalnya sebagian
 * belum jadi klien — sebutkan, judulnya satu baris di index.astro.
 *
 * Delapan-delapannya sudah masuk. Urut abjad, bukan urut kirim — supaya
 * tidak terbaca sebagai peringkat.
 */
export const MITRA: string[] = [
  "Cano Coffee",
  "Cattu Coffee",
  "Elsana Coffee",
  "Kopi Nomor Dua",
  "Tropic Coffee",
  "Twenty Vee",
  "Two People",
  "Weng Coffee",
];

/** True selama daftar di atas masih berisi penanda, bukan nama sungguhan. */
export const MITRA_MASIH_PENANDA = MITRA.length > 0 && MITRA.every((m) => /^BRAND \d\d$/.test(m));

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

/* ── Halaman privasi ─────────────────────────────────────────────────────── */

/**
 * Empat hal yang harus diisi sebelum halaman privasi benar-benar lengkap.
 * Saya sengaja tidak mengarangnya: halaman privasi yang SALAH lebih buruk
 * daripada halaman privasi yang belum lengkap, karena ia berbunyi seperti
 * janji hukum. Selama kosong, halamannya tetap tayang dan bagian yang belum
 * ada ditandai apa adanya, bukan disembunyikan.
 *
 * Kalau perlu, tunjukkan halaman itu ke notaris Anda — isinya sudah benar
 * secara teknis; yang kurang hanya keempat keterangan di bawah.
 */
export const BADAN_USAHA: string | null = null;
export const ALAMAT_RESMI: string | null = null;

/** Berapa lama pesan yang tidak jadi proyek disimpan sebelum dihapus.
 *  Contoh isian: "12 bulan". */
export const SIMPAN_PESAN: string | null = null;

/** Berapa lama dokumen proyek yang sudah selesai disimpan.
 *  Contoh isian: "10 tahun". */
export const SIMPAN_DOKUMEN: string | null = null;

/** Hukum negara mana yang berlaku. Contoh isian: "the laws of Indonesia". */
export const HUKUM_BERLAKU: string | null = null;
