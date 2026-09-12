/**
 * Tier layanan — sumber tunggal untuk seksi tarif di beranda.
 *
 * Angkanya datang dari dokumen strategi studio (§3.1 dan §3.2), bukan dikarang
 * di sini. Kalau pemilik menaikkan harga — dokumen itu menyebut aturannya:
 * setiap 3 proyek selesai pada satu tier, naikkan 10–15% untuk klien baru —
 * yang diubah cuma berkas ini, dan beranda ikut.
 *
 * Kenapa angkanya DITERBITKAN, padahal FAQ sebelumnya menyatakan sebaliknya:
 * itu keputusan pemilik, dan jawaban FAQ soal tarif sudah ikut diubah supaya
 * situsnya tidak membantah dirinya sendiri. Dua tempat yang menyebut harga
 * harus selalu sepakat.
 *
 * Yang TIDAK diterbitkan dan tetap "ditanyakan": persentase uang muka, lama
 * tiap tahap, dan jadwal kunjungan lokasi. Ketiganya memang berubah per
 * proyek, dan dokumen strategi tidak menetapkannya.
 */

export interface Tier {
  kunci: string;
  nama: string;
  ringkas: string;
  /** Rentang fee TANPA satuan — "15–25". Satuannya ("juta") sama untuk
   *  keenam tier, jadi ia dicetak sekali oleh markup dengan ukuran huruf
   *  yang lebih kecil. Dipisah supaya angkanya bisa dibuat besar dan
   *  sejajar antar-kartu; satu string "Rp 15–25 juta" tidak bisa. */
  fee: string;
  /** Untuk siapa tier ini. Tampil sebagai baris terakhir kartu. */
  untuk: string;
  isi: string[];
  /** Satu per kelompok. Kartunya diberi lencana dan bingkai teal. */
  sorot?: boolean;
  /** Kalimat kecil di atas daftar isi. */
  isiKop: string;
}

export interface KelompokTier {
  kunci: string;
  /** Nama tab. Pendek — ia harus muat di satu baris di ponsel. */
  tab: string;
  ket: string;
  tier: Tier[];
}

export const TIER: KelompokTier[] = [
  {
    kunci: "kafe",
    tab: "Coffee shop & F&B",
    ket: "Vertikal yang kami spesialisasi. Sebuah kafe adalah portofolio yang dilewati ratusan orang tiap hari.",
    tier: [
      {
        kunci: "starter",
        nama: "Starter",
        ringkas: "Untuk coffee shop pertama, dengan anggaran yang apa adanya.",
        fee: "15–25",
        untuk: "Coffee shop pertama, budget terbatas",
        isiKop: "Yang Anda dapat",
        isi: [
          "Konsep desain",
          "Denah dan tata ruang",
          "Visualisasi 3D dasar",
        ],
      },
      {
        kunci: "signature",
        nama: "Signature",
        ringkas: "Untuk pemilik yang sudah punya gambaran jelas soal ruang yang ingin dikenang.",
        fee: "45–80",
        untuk: "Visi kuat, target ikonik",
        sorot: true,
        isiKop: "Semua di Starter, ditambah",
        isi: [
          "Gambar kerja lengkap (DED)",
          "Branding ruang dan palet material",
          "Pengarahan dan pendampingan kontraktor",
          "Perencanaan alur bar dan dapur",
        ],
      },
      {
        kunci: "flagship",
        nama: "Flagship",
        ringkas: "Layanan penuh, dari sketsa pertama sampai foto pembukaan.",
        fee: "100–180",
        untuk: "Grup F&B yang siap membuka cabang",
        isiKop: "Semua di Signature, ditambah",
        isi: [
          "Supervisi konstruksi",
          "Desain furnitur custom",
          "Dokumentasi foto profesional",
        ],
      },
    ],
  },
  {
    kunci: "rumah",
    tab: "Rumah tinggal",
    ket: "Rumah tropis yang dirancang untuk panas, hujan, dan lembap — bukan diadaptasi dari denah yang digambar untuk tempat yang lebih dingin.",
    tier: [
      {
        kunci: "konsultasi",
        nama: "Konsultasi",
        ringkas: "Untuk pemilik yang akan membangun sendiri bersama tukangnya.",
        fee: "10–20",
        untuk: "Membangun sendiri, dengan tukang",
        isiKop: "Yang Anda dapat",
        isi: [
          "Konsep desain",
          "Denah skematik",
          "Saran orientasi dan ventilasi",
        ],
      },
      {
        kunci: "standar",
        nama: "Standar",
        ringkas: "Dari konsep sampai gambar yang bisa dibangun kontraktor tanpa menelepon kami.",
        fee: "35–70",
        untuk: "100–200 m², budget bangun Rp 500 juta–1,5 miliar",
        sorot: true,
        isiKop: "Semua di Konsultasi, ditambah",
        isi: [
          "Gambar kerja lengkap (DED)",
          "Gambar kerja siap kontraktor",
          "Daftar material dan finishing",
        ],
      },
      {
        kunci: "premium",
        nama: "Premium",
        ringkas: "Rumahnya, isinya, dan tanah tempat ia berdiri — diurus sebagai satu proyek.",
        fee: "80–200",
        untuk: "Di atas 200 m², budget bangun di atas Rp 2 miliar",
        isiKop: "Semua di Standar, ditambah",
        isi: [
          "Supervisi konstruksi",
          "Desain interior",
          "Desain lanskap",
          "Dokumentasi foto saat serah terima",
        ],
      },
    ],
  },
];
