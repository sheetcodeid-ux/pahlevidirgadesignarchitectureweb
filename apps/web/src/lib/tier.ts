import type { Paket } from "./api";

/**
 * Tier layanan — bentuk yang dirender seksi tarif di beranda.
 *
 * Angkanya SEKARANG DI DATABASE (tabel service_tiers, migrasi
 * 20260929000025), isinya di tabel service_tiers (halaman panelnya dibuang Okt 2026), dan dibaca saat build
 * lewat `listTiers()`. Isi awalnya enam paket dari dokumen strategi (§3.1
 * dan §3.2). Aturan kenaikannya tetap: setiap 3 proyek selesai pada satu
 * tier, naikkan 10–15% untuk klien baru — sekarang lewat panel, bukan kode.
 *
 * Yang TETAP di sini: dua kelompok (nama tab dan kalimat pengantarnya).
 * Keduanya positioning studio, bukan daftar yang berubah tiap kuartal.
 *
 * Kenapa angkanya DITERBITKAN, padahal FAQ sebelumnya menyatakan sebaliknya:
 * itu keputusan pemilik, dan jawaban FAQ soal tarif sudah ikut diubah supaya
 * situsnya tidak membantah dirinya sendiri. Dua tempat yang menyebut harga
 * harus selalu sepakat — karena itu jawaban FAQ soal tarif sekarang disusun
 * dari data yang sama lewat `kalimatTarif()`.
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

/** Kelompok di beranda. Urutannya urutan tab. */
export const KELOMPOK: { kunci: "kafe" | "rumah"; tab: string; ket: string }[] = [
  {
    kunci: "kafe",
    tab: "Coffee shop & F&B",
    ket: "Vertikal yang kami spesialisasi. Sebuah kafe adalah portofolio yang dilewati ratusan orang tiap hari.",
  },
  {
    kunci: "rumah",
    tab: "Rumah tinggal",
    ket: "Rumah tropis yang dirancang untuk panas, hujan, dan lembap — bukan diadaptasi dari denah yang digambar untuk tempat yang lebih dingin.",
  },
];

/** "15–25" — tanpa satuan; lihat catatan `Tier.fee`. */
export const rentangFee = (p: Pick<Paket, "feeMin" | "feeMax">) =>
  p.feeMin === p.feeMax ? String(p.feeMin) : `${p.feeMin}–${p.feeMax}`;

/**
 * Paket dari API → kelompok untuk beranda. Kelompok tanpa satu pun paket
 * aktif dibuang: tab yang isinya kosong lebih buruk daripada tidak ada tab.
 */
export function kelompokkan(paket: Paket[]): KelompokTier[] {
  return KELOMPOK.map((k) => ({
    ...k,
    tier: paket
      .filter((p) => p.group === k.kunci && p.active)
      .map((p) => ({
        kunci: p.slug,
        nama: p.name,
        ringkas: p.summary,
        fee: rentangFee(p),
        untuk: p.forWhom,
        isi: p.includes,
        sorot: p.highlighted,
        isiKop: p.includesHeading,
      })),
  })).filter((k) => k.tier.length > 0);
}

const ANGKA = ["nol", "satu", "dua", "tiga", "empat", "lima", "enam", "tujuh", "delapan", "sembilan"];
const sebut = (n: number) => ANGKA[n] ?? String(n);
const NAMA_KELOMPOK: Record<string, string> = { kafe: "coffee shop", rumah: "rumah" };

/**
 * Paragraf pertama jawaban FAQ "Berapa tarif Anda?", disusun dari paket yang
 * SAMA dengan seksi tarif beranda. Sebelumnya angkanya ditulis tangan di
 * lib/faq.ts — dan begitu harga bisa diubah dari panel, salinan tangan itu
 * pasti tertinggal.
 */
export function kalimatTarif(kelompok: KelompokTier[]): string {
  if (kelompok.length === 0) {
    return "<p><strong>Rentangnya diumumkan di beranda</strong> begitu paket layanan kami terbit.</p>";
  }
  /* "tiga tier untuk coffee shop dan tiga untuk rumah" — kata "tier" cuma
     sekali, seperti kalimat aslinya. */
  const jumlah = kelompok
    .map((k, i) => `${sebut(k.tier.length)}${i === 0 ? " tier" : ""} untuk ${NAMA_KELOMPOK[k.kunci]}`)
    .join(" dan ");
  const rentang = kelompok
    .map((k) => {
      const a = k.tier[0]!;
      const z = k.tier[k.tier.length - 1]!;
      const awal = `Rp ${a.fee} juta (${a.nama})`;
      const nama = NAMA_KELOMPOK[k.kunci]!;
      return k.tier.length === 1
        ? `${nama} ${awal}`
        : `${nama} mulai ${awal} sampai Rp ${z.fee} juta (${z.nama})`;
    })
    .join("; ");
  const kalimat = rentang.charAt(0).toUpperCase() + rentang.slice(1);
  return `<p><strong>Rentangnya diumumkan di beranda</strong>, dibagi ${jumlah}. ${kalimat}.</p>`;
}
