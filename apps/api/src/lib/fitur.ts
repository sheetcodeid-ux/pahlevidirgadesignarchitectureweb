/* =============================================================================
   Katalog fitur panel — SATU sumber untuk API dan panel.

   Panel (apps/web) mengimpor berkas ini langsung: rel samping, palet, dan
   halaman Pengguna & Akses membaca kunci yang sama dengan penjagaan API.
   Dua daftar berisi hal yang sama pasti menyimpang (jebakan #32).

   Tiga jenis kunci:
   - PAKET   — bisa dipetakan ke paket langganan (sel di matriks akses).
   - SELALU  — milik setiap akun yang boleh masuk: Akun, Panduan, Notifikasi.
   - PEMILIK — hanya owner: urusan studio pemilik sendiri (Info Studio,
               Terbitkan situs) dan pengaturan aplikasi (Pengguna & Akses,
               UI Component). Tidak pernah bisa dijual.

   Peran:
   - admin     = owner: semua kunci.
   - editor    = staf studio pemilik: PAKET + SELALU (seperti sebelum ada
                 langganan), tanpa PEMILIK.
   - pelanggan = hanya PAKET yang dipetakan ke paketnya, selama masa aktifnya
                 belum lewat; plus SELALU.
   ============================================================================= */

export const FITUR_PAKET = [
  "dashboard",
  "kpi",
  "tugas",
  "pesan",
  "proyek",
  "portal-klien",
  "keuangan",
  "terima",
  "keluar",
  "transaksi",
  "kas",
  "tagihan",
  "fee",
  "gaji",
  "bayaran-tim",
  "direktori",
  "tim",
  "testimoni",
  "aturan-fee",
] as const;

export const FITUR_SELALU = ["akun", "panduan", "notifikasi"] as const;
export const FITUR_PEMILIK = ["info-studio", "pengguna", "ui-kit"] as const;

export type FiturPaket = (typeof FITUR_PAKET)[number];
export type KunciFitur = FiturPaket | (typeof FITUR_SELALU)[number] | (typeof FITUR_PEMILIK)[number];

export type Peran = "admin" | "editor" | "pelanggan";

export const adalahFiturPaket = (k: string): k is FiturPaket => (FITUR_PAKET as readonly string[]).includes(k);

/* --- Keadaan langganan ------------------------------------------------------ */

export type StatusLangganan = "pemilik" | "staf" | "aktif" | "habis" | "belum" | "nonaktif";

export interface Akses {
  peran: Peran;
  status: StatusLangganan;
  /** Kunci yang boleh dibuka akun ini, sudah termasuk SELALU (dan PEMILIK untuk owner). */
  fitur: KunciFitur[];
}

/** Tanggal `YYYY-MM-DD` hari ini menurut zona studio — masa aktif dihitung per hari, bukan per jam UTC. */
export function hariIniWIB(sekarang = new Date()): string {
  return new Date(sekarang.getTime() + 7 * 3600_000).toISOString().slice(0, 10);
}

/**
 * Menghitung akses dari baris profil. Murni (tanpa database), jadi bisa
 * diuji di sini dan dipakai ulang di mana pun.
 *
 * `masaAktif` inklusif: langganan "sampai 30 Nov" masih aktif sepanjang
 * 30 Nov. Pelanggan tanpa paket atau tanpa masa aktif belum membayar.
 */
export function hitungAkses(
  p: { role: string; isSuspended: boolean; accessUntil: string | null; fiturPaket: string[] },
  hariIni = hariIniWIB(),
): Akses {
  const selalu = [...FITUR_SELALU] as KunciFitur[];
  if (p.role === "admin") {
    return { peran: "admin", status: p.isSuspended ? "nonaktif" : "pemilik", fitur: p.isSuspended ? [] : [...FITUR_PAKET, ...selalu, ...FITUR_PEMILIK] };
  }
  if (p.role === "editor") {
    return { peran: "editor", status: p.isSuspended ? "nonaktif" : "staf", fitur: p.isSuspended ? [] : [...FITUR_PAKET, ...selalu] };
  }
  const peran: Peran = "pelanggan";
  if (p.isSuspended) return { peran, status: "nonaktif", fitur: [] };
  if (!p.accessUntil) return { peran, status: "belum", fitur: selalu };
  if (p.accessUntil < hariIni) return { peran, status: "habis", fitur: selalu };
  const fitur = p.fiturPaket.filter(adalahFiturPaket);
  return { peran, status: "aktif", fitur: [...fitur, ...selalu] };
}

/* --- Penjagaan rute API ------------------------------------------------------
   Satu baris per kelompok rute. Membaca boleh kalau akun punya SALAH SATU
   fitur di `baca`; menulis kalau punya salah satu di `tulis`. "*" = fitur
   paket apa pun (data dasar yang dipakai hampir semua halaman: daftar
   proyek, nama studio). Rute yang tidak cocok satu baris pun DITOLAK untuk
   pelanggan — gagal-tertutup, seperti requireStaff.

   Urutan penting: baris pertama yang cocok yang dipakai, jadi rute yang
   lebih khusus (`/projects/:id/invoices`) ditulis sebelum yang umum. */

/** "pemilik" = owner saja (pengaturan aplikasi). "studio" = owner dan staf
    studio pemilik — urusan situs pemilik sendiri, tidak pernah untuk pelanggan. */
type Daftar = readonly (FiturPaket | "*")[] | "pemilik" | "studio";

interface Aturan {
  cocok: RegExp;
  baca: Daftar;
  tulis: Daftar;
}

const KEUANGAN_BACA = ["keuangan", "terima", "keluar", "transaksi", "kas", "tagihan", "fee", "gaji", "bayaran-tim", "dashboard", "kpi", "proyek"] as const;

export const ATURAN_RUTE: Aturan[] = [
  // Pengaturan aplikasi: owner saja.
  { cocok: /^\/(users|access-plans|audit)(\/|$)/, baca: "pemilik", tulis: "pemilik" },
  // Situs studio pemilik sendiri: owner dan stafnya, tidak pernah pelanggan.
  { cocok: /^\/(clients|journal|studio-team|publish|publish-status)(\/|$)/, baca: "studio", tulis: "studio" },
  { cocok: /^\/settings(\/|$)/, baca: ["*"], tulis: "studio" },
  { cocok: /^\/tiers(\/|$)/, baca: ["proyek", "kpi", "aturan-fee"], tulis: "studio" },

  // Proyek dan turunannya.
  { cocok: /^\/projects\/[^/]+\/(brief|documents|progress)(\/|$)/, baca: ["portal-klien", "proyek"], tulis: ["portal-klien"] },
  { cocok: /^\/(documents|progress-updates)(\/|$)/, baca: ["portal-klien", "proyek"], tulis: ["portal-klien"] },
  { cocok: /^\/projects\/[^/]+\/invoices(\/|$)/, baca: KEUANGAN_BACA, tulis: ["tagihan"] },
  { cocok: /^\/projects\/[^/]+\/payments(\/|$)/, baca: KEUANGAN_BACA, tulis: ["terima", "transaksi"] },
  { cocok: /^\/projects\/[^/]+\/costs(\/|$)/, baca: KEUANGAN_BACA, tulis: ["keluar", "proyek"] },
  { cocok: /^\/projects\/[^/]+\/tasks(\/|$)/, baca: ["tugas", "proyek", "dashboard"], tulis: ["tugas", "proyek"] },
  { cocok: /^\/projects\/[^/]+\/team(\/|$)/, baca: ["proyek", "bayaran-tim", "fee", "gaji"], tulis: ["proyek"] },
  { cocok: /^\/projects\/[^/]+\/images(\/|$)/, baca: ["proyek"], tulis: ["proyek"] },
  { cocok: /^\/projects(\/|$)/, baca: ["*"], tulis: ["proyek"] },
  { cocok: /^\/images(\/|$)/, baca: ["proyek"], tulis: ["proyek"] },
  { cocok: /^\/uploads$/, baca: ["proyek", "portal-klien"], tulis: ["proyek", "portal-klien"] },

  // Keuangan.
  { cocok: /^\/invoices(\/|$)/, baca: KEUANGAN_BACA, tulis: ["tagihan"] },
  { cocok: /^\/payments(\/|$)/, baca: KEUANGAN_BACA, tulis: ["terima", "transaksi"] },
  { cocok: /^\/costs(\/|$)/, baca: KEUANGAN_BACA, tulis: ["keluar", "transaksi"] },
  { cocok: /^\/finance(\/|$)/, baca: ["keuangan", "dashboard", "kpi", "transaksi"], tulis: [] },
  { cocok: /^\/ledger(\/|$)/, baca: ["kas", "transaksi", "keuangan"], tulis: ["kas"] },
  { cocok: /^\/targets(\/|$)/, baca: ["kas", "dashboard", "kpi"], tulis: ["kas"] },
  { cocok: /^\/fee-rules(\/|$)/, baca: ["aturan-fee", "proyek", "bayaran-tim"], tulis: ["aturan-fee"] },
  { cocok: /^\/fee(\/|$)/, baca: ["fee"], tulis: [] },
  { cocok: /^\/payroll(\/|$)/, baca: ["gaji", "bayaran-tim"], tulis: ["gaji"] },
  { cocok: /^\/(project-team|team-payouts)(\/|$)/, baca: ["proyek", "bayaran-tim", "fee", "gaji"], tulis: ["proyek", "bayaran-tim"] },
  { cocok: /^\/kpi(\/|$)/, baca: ["kpi"], tulis: [] },

  // Kerja harian dan relasi.
  { cocok: /^\/tasks(\/|$)/, baca: ["tugas", "dashboard", "proyek"], tulis: ["tugas"] },
  { cocok: /^\/inquiries(\/|$)/, baca: ["pesan", "dashboard"], tulis: ["pesan"] },
  { cocok: /^\/directory(\/|$)/, baca: ["direktori", "proyek"], tulis: ["direktori"] },
  { cocok: /^\/team(\/|$)/, baca: ["tim", "gaji", "bayaran-tim", "proyek", "tugas", "keluar"], tulis: ["tim"] },
  { cocok: /^\/testimonials(\/|$)/, baca: ["testimoni", "dashboard"], tulis: ["testimoni"] },
];

/** Rute milik setiap akun yang boleh masuk — termasuk yang langganannya habis,
    supaya panel tetap bisa menampilkan statusnya dan akun bisa keluar. */
const RUTE_SELALU = /^\/(me|account)(\/|$)/;

export type Putusan = { boleh: true } | { boleh: false; alasan: "pemilik" | "fitur" | "langganan" | "nonaktif" };

/**
 * Bolehkah akun ini memanggil rute ini? `jalur` relatif terhadap /api/v1/admin.
 */
export function bolehRute(akses: Akses, metode: string, jalur: string): Putusan {
  if (akses.status === "nonaktif") return { boleh: false, alasan: "nonaktif" };
  if (RUTE_SELALU.test(jalur)) return { boleh: true };
  if (akses.peran === "admin") return { boleh: true };

  const aturan = ATURAN_RUTE.find((a) => a.cocok.test(jalur));
  const tulis = metode !== "GET" && metode !== "HEAD";
  const daftar = aturan ? (tulis ? aturan.tulis : aturan.baca) : null;

  if (daftar === "pemilik") return { boleh: false, alasan: "pemilik" };
  // Staf studio pemilik: semua yang dulu boleh, seperti sebelum ada langganan.
  if (akses.peran === "editor") return { boleh: true };
  if (daftar === "studio") return { boleh: false, alasan: "pemilik" };

  if (akses.status === "habis" || akses.status === "belum") return { boleh: false, alasan: "langganan" };
  if (!daftar || daftar.length === 0) return { boleh: false, alasan: "fitur" };
  const punya = new Set<string>(akses.fitur);
  const ok = daftar.some((f) => (f === "*" ? akses.fitur.some(adalahFiturPaket) : punya.has(f)));
  return ok ? { boleh: true } : { boleh: false, alasan: "fitur" };
}
