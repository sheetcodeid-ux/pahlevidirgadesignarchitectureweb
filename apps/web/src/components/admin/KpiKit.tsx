import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent as PointerEventReact,
  type ReactNode,
} from "react";
import { RequireAuth } from "./RequireAuth";
import { Keterangan, pemberiKet, type KabarKartu } from "../kit/kartuGrafik";
import {
  ambilKpi,
  ambilSettings,
  bacaCache,
  tulisCache,
  type KpiStrategi,
  type StudioSettings,
} from "../../lib/admin";
import { CATEGORY_LABELS, type ProjectCategory } from "../../lib/api";
import { formatRupiah, formatRupiahRingkas } from "../../lib/format";
import { kodeProyek } from "../../lib/nomorDokumen";
import { daftarLembar, lembarUntuk } from "../../lib/navAdmin";
import { Hitung, geraknya } from "./hitung";

/* =============================================================================
   KPI Strategi = MAWAR STRATEGI — dokumen STRATEGI_BISNIS §8.

   Sebelum menggambar, arsitek menganalisis tapaknya: MAWAR ANGIN (seberapa
   kuat tiap arah) dan LINTASAN MATAHARI (letak matahari sepanjang tahun).
   Halaman ini lembar analisis yang sama untuk STRATEGI studio:

   1. MAWAR — satu kelopak per pasal §8.1–8.5. Panjang kelopak = realisasi ÷
      ketentuan minimum (cincin putus-putus = 100%, tepi = 200%). Kelopaknya
      BERPITA tiap 50% seperti kelas kecepatan di mawar angin sungguhan;
      kekurangan sampai cincin ketentuan diarsir amber, rentang ketentuan
      (kontrak, pesan) diarsir mint, bidang dan KONTUR titik-titik = letak
      kelopak di potret sebelumnya. Di pangkal kelopak CINCIN PUTUSAN (warna
      = putusan potret terpilih), di pusat hitungan pasal yang memenuhi.
   2. CINCIN RIWAYAT — di luar 200%, satu lintasan per potret (dalam =
      tertua). Busurnya = capaian terhadap ketentuan (penuh = memenuhi),
      warnanya = putusan; lintasan potret terpilih menyala.
   3. CATATAN — balon bermeteran capaian (nomor pasal / nomor lembar
      sumbernya di set gambar rel) dengan GARIS PENUNJUK ke kelopaknya:
      realisasi, ketentuan, persen, selisih, dan TREN empat potret. Satu
      catatan = satu tab; lampirannya di kertas kanan. Kop bersel menyebut
      pasal terkuat, yang paling perlu perhatian, dan arah sejak potret
      sebelumnya.
   4. LINTASAN KUARTAL — busur matahari dengan stasiun potret akhir K1/K2/K3
      dan hari ini (`jejak` API: angka yang SAMA dengan yang terbaca di
      halaman ini pada hari itu), lima pip putusan per stasiun. Matahari
      diseret atau diklik: kelopak BERUBAH BENTUK mengikuti letaknya di
      antara dua potret, cahaya dan bayangannya ikut arah matahari, dan
      tanggal "Diperiksa per" berjalan.
   5. LAMPIRAN — rincian pasal terpilih dari data yang sama: kunci mawar,
      cap pemeriksaan, riwayat putusan, jejak bergaris tren, dan catatan
      pemeriksa dengan RUANG AMAN / YANG DIBUTUHKAN per hari ini.

   Gerak hanya karena perbuatan (seret, klik, papan ketik) — tidak saat
   dimuat, seketika bila gerak dikurangi — dan SERENTAK, mendarat lembut
   tanpa pantulan. Warna: hijau = memenuhi, amber = belum. Merah tidak
   dipakai: angka di bawah target bukan perbuatan destruktif. Tidak ada
   tulisan di dalam mawar selain label skala dan label cincin riwayat di
   celah puncaknya, dan cincinnya terputus tepat di label itu (jebakan #70).
   ============================================================================= */

type Kunci = "kontrak" | "margin" | "lead" | "signature" | "cadangan";
type Keadaan = "memenuhi" | "lampaui" | "belum" | "kosong";

interface Potret {
  kode: string; // "K1" … "Kini"
  tanggal: string;
  tahun: number;
  kuartal: number;
  kini: boolean;
  nilai: Record<Kunci, number | null>;
}

interface Pasal {
  kunci: Kunci;
  no: string;
  judul: string;
  /** Ketentuan lengkap (kop lampiran). */
  ketentuan: (k: KpiStrategi) => string;
  /** Ketentuan ringkas (catatan, keterangan kelopak). */
  pendek: string;
  min: number;
  maks: number | null;
  /** Bilangan bulat (lead, proyek): skala bertangga 1. */
  bulat?: boolean;
  besar: (v: number) => string;
  selisih: (d: number) => string;
  sumber: string;
}

const koma = (v: number, d = 1) => v.toLocaleString("id-ID", { maximumFractionDigits: d });
const jt = (v: number) => `${koma(v / 1e6, 0)} jt`;

function pasalDari(k: KpiStrategi): Pasal[] {
  const t = k.target;
  return [
    {
      kunci: "kontrak",
      no: "8.1",
      judul: "Rata-rata nilai kontrak",
      ketentuan: (x) => `Rp${koma(t.rataKontrakMin / 1e6, 0)}–${koma(t.rataKontrakMaks / 1e6, 0)} jt per proyek · ${x.rataKontrak.proyek} proyek`,
      pendek: `Rp${koma(t.rataKontrakMin / 1e6, 0)}–${koma(t.rataKontrakMaks / 1e6, 0)} jt`,
      min: t.rataKontrakMin,
      maks: t.rataKontrakMaks,
      besar: (v) => formatRupiahRingkas(v),
      selisih: (d) => formatRupiahRingkas(Math.abs(d)),
      sumber: "/admin/proyek",
    },
    {
      kunci: "margin",
      no: "8.2",
      judul: "Margin kontrak",
      ketentuan: () => `≥${t.marginMin}% sesudah biaya proyek, tertimbang`,
      pendek: `≥${t.marginMin}%`,
      min: t.marginMin,
      maks: null,
      besar: (v) => `${koma(v)}%`,
      selisih: (d) => `${koma(Math.abs(d))} poin`,
      sumber: "/admin/keuangan/keluar",
    },
    {
      kunci: "lead",
      no: "8.3",
      judul: "Pesan masuk per kuartal",
      ketentuan: (x) => `${t.leadKuartalMin}–${t.leadKuartalMaks} pesan · ${x.lead.ditindaklanjuti} ditindaklanjuti`,
      pendek: `${t.leadKuartalMin}–${t.leadKuartalMaks} pesan`,
      min: t.leadKuartalMin,
      maks: t.leadKuartalMaks,
      bulat: true,
      besar: (v) => `${koma(v, 0)} pesan`,
      selisih: (d) => `${koma(Math.abs(d), 0)} pesan`,
      sumber: "/admin/pesan",
    },
    {
      kunci: "signature",
      no: "8.4",
      judul: "Proyek Signature ke atas",
      ketentuan: () => `≥${t.signatureMin} proyek setahun, paket urutan 2 ke atas`,
      pendek: `≥${t.signatureMin} proyek`,
      min: t.signatureMin,
      maks: null,
      bulat: true,
      besar: (v) => `${koma(v, 0)} proyek`,
      selisih: (d) => `${koma(Math.abs(d), 0)} proyek`,
      sumber: "/admin/paket",
    },
    {
      kunci: "cadangan",
      no: "8.5",
      judul: "Cadangan kas",
      ketentuan: () => `≥${t.cadanganBulan} bulan pengeluaran studio`,
      pendek: `≥${t.cadanganBulan} bulan`,
      min: t.cadanganBulan,
      maks: null,
      besar: (v) => `${koma(v)} bulan`,
      selisih: (d) => `${koma(Math.abs(d))} bulan`,
      sumber: "/admin/keuangan/kas",
    },
  ];
}

function potretDari(k: KpiStrategi): Potret[] {
  const lalu: Potret[] = k.jejak.map((j) => ({
    kode: `K${j.kuartal}`,
    tanggal: j.tanggal,
    tahun: j.tahun,
    kuartal: j.kuartal,
    kini: false,
    nilai: { kontrak: j.rataKontrak, margin: j.margin, lead: j.lead, signature: j.signature, cadangan: j.cadangan },
  }));
  return [
    ...lalu,
    {
      kode: "Kini",
      tanggal: k.hariIni,
      tahun: k.tahun,
      kuartal: k.kuartal,
      kini: true,
      nilai: {
        kontrak: k.rataKontrak.nilai,
        margin: k.margin.rata,
        lead: k.lead.kuartalIni,
        signature: k.signature.jumlah,
        cadangan: k.cadangan.bulan,
      },
    },
  ];
}

function keadaanDari(p: Pasal, v: number | null): Keadaan {
  if (v === null) return "kosong";
  if (v < p.min) return "belum";
  if (p.maks !== null && v > p.maks) return "lampaui";
  return "memenuhi";
}

const TEKS_CAP: Record<Keadaan, string> = {
  memenuhi: "Memenuhi",
  lampaui: "Melampaui",
  belum: "Belum",
  kosong: "Belum ada data",
};

/** Langkah skala "rapi": 1 / 2 / 2,5 / 5 × 10^n, sekitar lima ruas. */
function langkah(rentang: number, bulat: boolean): number {
  const kasar = Math.max(rentang, 1e-9) / 5;
  const p = Math.pow(10, Math.floor(Math.log10(kasar)));
  let l = 10 * p;
  for (const k of [1, 2, 2.5, 5, 10]) {
    if (k * p >= kasar) {
      l = k * p;
      break;
    }
  }
  return bulat ? Math.max(1, Math.ceil(l)) : l;
}

interface Skala {
  bawah: number;
  atas: number;
  pos: (v: number) => number;
}

/** Satu skala per pasal untuk jejak dan sebaran di lampiran, cukup lebar
    untuk SEMUA potret dan ketentuannya. */
function skalaDari(p: Pasal, nilai: (number | null)[]): Skala {
  const ada = nilai.filter((v): v is number => v !== null);
  const puncak = Math.max(...ada, (p.maks ?? p.min) * 1.25);
  const dasar = Math.min(0, ...ada);
  const l = langkah(puncak - dasar, !!p.bulat);
  const atas = Math.ceil(puncak / l) * l;
  const bawah = Math.floor(dasar / l) * l;
  const rentang = atas - bawah || 1;
  return { bawah, atas, pos: (v) => Math.min(100, Math.max(0, ((v - bawah) / rentang) * 100)) };
}

const TGL = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", timeZone: "UTC" });
const TGL_PANJANG = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const BLN = new Intl.DateTimeFormat("id-ID", { month: "short", timeZone: "UTC" });
const tglPendek = (t: string) => TGL.format(new Date(`${t}T00:00:00Z`));
const tglPanjang = (t: string) => TGL_PANJANG.format(new Date(`${t}T00:00:00Z`));
const blnPendek = (b: string) => BLN.format(new Date(`${b}-01T00:00:00Z`));

/* ---- Geometri mawar (satuan viewBox 0–400) ------------------------------------
   Kelopak ke-i berpusat di 36° + 72°·i (searah jarum jam dari atas), jadi
   CELAH di puncak — tempat label skala dan label cincin riwayat — tidak
   pernah ditumpangi kelopak.

   Dari dalam ke luar: lingkar pusat (HUB) → cincin putusan → kelopak
   (PANGKAL … R200 = 200% ketentuan) → panah "lewat 200%" → CINCIN RIWAYAT
   (satu lintasan per potret, dalam = tertua) → cincin pinggir bertakik. */
const PUSAT = 200;
const HUB = 32;
const PUTUSAN = 36.5;
const PANGKAL = 42;
const R200 = 145;
const RIW0 = 158;
const RIW_RUANG = 31;
const RIM = 190.5;
const UJUNG_PENUNJUK = 198;
const LEBAR = 22; // setengah lebar kelopak, derajat
/** Kelopak pasal terpilih terangkat sejauh ini di sumbunya. */
const ANGKAT = 6;
const sudut = (i: number) => 36 + 72 * i;
const jari = (q: number) => PANGKAL + ((R200 - PANGKAL) * Math.min(2, Math.max(0, q))) / 2;
const bulat2 = (n: number) => Math.round(n * 100) / 100;
function titik(r: number, deg: number): [number, number] {
  const a = (deg * Math.PI) / 180;
  return [PUSAT + r * Math.sin(a), PUSAT - r * Math.cos(a)];
}
function busur(r: number, a1: number, a2: number): string {
  const [x1, y1] = titik(r, a1);
  const [x2, y2] = titik(r, a2);
  return `M${bulat2(x1)} ${bulat2(y1)}A${bulat2(r)} ${bulat2(r)} 0 ${a2 - a1 > 180 ? 1 : 0} 1 ${bulat2(x2)} ${bulat2(y2)}`;
}
function sektor(r1: number, r2: number, a1: number, a2: number): string {
  if (r2 - r1 < 0.05 || a2 - a1 < 0.05) return "";
  const [x1, y1] = titik(r2, a1);
  const [x2, y2] = titik(r2, a2);
  const [x3, y3] = titik(r1, a2);
  const [x4, y4] = titik(r1, a1);
  const b = a2 - a1 > 180 ? 1 : 0;
  return `M${bulat2(x1)} ${bulat2(y1)}A${bulat2(r2)} ${bulat2(r2)} 0 ${b} 1 ${bulat2(x2)} ${bulat2(y2)}L${bulat2(x3)} ${bulat2(y3)}A${bulat2(r1)} ${bulat2(r1)} 0 ${b} 0 ${bulat2(x4)} ${bulat2(y4)}Z`;
}
/** Panah kecil di antara 200% dan cincin riwayat untuk kelopak yang
    melewati tepi skala. */
function panahLebih(i: number): string {
  const s = sudut(i);
  const [ax, ay] = titik(R200 + 2, s - 3.4);
  const [bx, by] = titik(R200 + 8.5, s);
  const [cx, cy] = titik(R200 + 2, s + 3.4);
  return `M${bulat2(ax)} ${bulat2(ay)}L${bulat2(bx)} ${bulat2(by)}L${bulat2(cx)} ${bulat2(cy)}Z`;
}

/** Label skala di celah puncak; cincinnya terputus selebar labelnya. */
const CINCIN: { q: number; label: string; celah: number }[] = [
  { q: 0.5, label: "50%", celah: 13.5 },
  { q: 1, label: "100%", celah: 11.5 },
  { q: 1.5, label: "150%", celah: 8.5 },
  { q: 2, label: "200%", celah: 6.8 },
];

/** Pita capaian kelopak — seperti kelas kecepatan di mawar angin
    sungguhan: tiap 50% ketentuan satu pita, makin ke luar makin pekat. */
const PITA = [0.5, 1, 1.5];

/** Lintasan cincin riwayat ke-j dari n potret: [jari dalam, jari luar]. */
function lintasRiwayat(j: number, n: number): [number, number] {
  const jarak = RIW_RUANG / Math.max(n, 4);
  const r1 = RIW0 + jarak * j;
  return [r1, r1 + jarak - 2];
}

/* ---- Lintasan kuartal (satuan 1000 × 100, direntang selebar lajurnya) -------- */
const LX0 = 110;
const LX1 = 890;
const LTINGGI = 74;
const lintasX = (t: number) => LX0 + (LX1 - LX0) * t;
const lintasY = (x: number) => 100 - LTINGGI * Math.sqrt(Math.max(0, 1 - Math.pow((x - 500) / 500, 2)));
function jalurLintas(t0: number, t1: number): string {
  const n = Math.max(2, Math.round(Math.abs(t1 - t0) * 48));
  let d = "";
  for (let j = 0; j <= n; j++) {
    const x = lintasX(t0 + ((t1 - t0) * j) / n);
    d += `${j ? "L" : "M"}${bulat2(x)} ${bulat2(lintasY(x))}`;
  }
  return d;
}
const BUSUR_LANGIT = (() => {
  let d = "";
  for (let j = 0; j <= 60; j++) {
    const x = (1000 * j) / 60;
    d += `${j ? "L" : "M"}${bulat2(x)} ${bulat2(lintasY(x))}`;
  }
  return d;
})();

/** Letak catatan di kiri/kanan mawar, mengikuti arah kelopaknya. Kiri baris
    3 sengaja kosong: tempat kotak keterangan. */
const LETAK: Record<Kunci, { sisi: "kiri" | "kanan"; baris: number; rata: "start" | "center" | "end" }> = {
  kontrak: { sisi: "kanan", baris: 2, rata: "start" },
  margin: { sisi: "kanan", baris: 3, rata: "center" },
  lead: { sisi: "kanan", baris: 4, rata: "end" },
  signature: { sisi: "kiri", baris: 4, rata: "start" },
  cadangan: { sisi: "kiri", baris: 2, rata: "start" },
};

/** Nama potret seperti di lintasan ("K1", "Kini"). */
const namaPotret = (p: Potret) => (p.kini ? "Kini" : p.kode);
/** Lulus/tidak — melampaui rentang tetap dihitung lulus. */
const lulus = (k: Keadaan) => k === "memenuhi" || k === "lampaui";

/** Riwayat keadaan satu pasal sampai potret terpilih: sejak potret mana ia
    lulus/belum tanpa putus, atau "baru" kalau keadaannya baru berganti. */
function riwayatDari(pasal: Pasal, potret: Potret[], idx: number): string | null {
  const kelas = (i: number) => {
    const k = keadaanDari(pasal, potret[i]!.nilai[pasal.kunci]);
    return k === "kosong" ? "kosong" : lulus(k) ? "lulus" : "belum";
  };
  if (idx === 0 || kelas(idx) === "kosong") return null;
  let a = idx;
  while (a > 0 && kelas(a - 1) === kelas(idx)) a--;
  if (a === idx) {
    const lalu = kelas(idx - 1);
    return `baru · ${namaPotret(potret[idx - 1]!)} ${lalu === "lulus" ? "lulus" : lalu === "belum" ? "belum" : "kosong"}`;
  }
  return `${kelas(idx) === "lulus" ? "lulus" : "belum"} sejak ${namaPotret(potret[a]!)} · ${idx - a + 1} potret`;
}

/** Kalimat pemeriksa: seberapa jauh realisasi dari ketentuannya. */
function catatanPemeriksa(p: Pasal, v: number | null): { teks: string; kurang: boolean } {
  if (v === null) return { teks: "Belum ada data untuk potret ini.", kurang: false };
  if (v < p.min) return { teks: `Kurang ${p.selisih(p.min - v)} dari ketentuan minimum.`, kurang: true };
  if (p.maks !== null && v > p.maks) return { teks: `${p.selisih(v - p.maks)} di atas batas atas rentang ketentuan.`, kurang: false };
  if (v === p.min) return { teks: p.maks !== null ? "Tepat di batas bawah rentang ketentuan." : "Tepat di ketentuan minimum.", kurang: false };
  if (p.maks !== null) return { teks: `Di dalam rentang — ${p.selisih(p.maks - v)} lagi sampai batas atasnya.`, kurang: false };
  return { teks: `${p.selisih(v - p.min)} di atas ketentuan minimum.`, kurang: false };
}

/* ---- Ruang aman / yang dibutuhkan ----------------------------------------------
   Pemeriksa tidak berhenti di "belum memenuhi" — ia menulis apa yang harus
   diubah. Angkanya dari data yang SAMA dengan lampiran (per hari ini):
   pasal yang belum memenuhi mendapat kebutuhannya, yang memenuhi mendapat
   ruang amannya sebelum jatuh ke bawah ketentuan. */
interface Kebutuhan {
  jenis: "aman" | "butuh" | "kosong";
  label: string;
  angka: string;
  ket: string;
  /** Waktu periode yang sudah berjalan lawan capaian terhadap ketentuan (0–100). */
  laju?: { waktu: number; capaian: number; periode: string };
}

const HARI = 86_400_000;
const hariDari = (t: string) => Date.parse(`${t}T00:00:00Z`);

function kebutuhanDari(pasal: Pasal, k: KpiStrategi): Kebutuhan {
  const t = k.target;
  const hariIni = hariDari(k.hariIni);
  switch (pasal.kunci) {
    case "kontrak": {
      const v = k.rataKontrak.nilai;
      const n = k.rataKontrak.proyek;
      if (v === null || n === 0) return { jenis: "kosong", label: "Belum bisa dihitung", angka: "—", ket: "Belum ada proyek berkontrak tahun ini." };
      if (v < t.rataKontrakMin) {
        const satu = t.rataKontrakMin * (n + 1) - v * n;
        return {
          jenis: "butuh",
          label: "Yang dibutuhkan",
          angka: formatRupiahRingkas(satu),
          ket: `satu proyek baru senilai ini mengangkat rata-rata ${n} proyek ke Rp${koma(t.rataKontrakMin / 1e6, 0)} jt.`,
        };
      }
      return {
        jenis: "aman",
        label: "Ruang aman",
        angka: formatRupiahRingkas(v - t.rataKontrakMin),
        ket: `rata-rata boleh turun sebesar ini sebelum di bawah Rp${koma(t.rataKontrakMin / 1e6, 0)} jt.`,
      };
    }
    case "margin": {
      const kontrak = k.proyek.reduce((s, p) => s + p.kontrak, 0);
      const biaya = k.proyek.reduce((s, p) => s + p.biaya, 0);
      if (!kontrak) return { jenis: "kosong", label: "Belum bisa dihitung", angka: "—", ket: "Belum ada proyek berkontrak tahun ini." };
      const ruang = kontrak * (1 - t.marginMin / 100) - biaya;
      return ruang >= 0
        ? {
            jenis: "aman",
            label: "Ruang aman",
            angka: formatRupiahRingkas(ruang),
            ket: `biaya proyek boleh bertambah sebesar ini sebelum margin di bawah ${t.marginMin}%.`,
          }
        : {
            jenis: "butuh",
            label: "Yang dibutuhkan",
            angka: formatRupiahRingkas(-ruang),
            ket: `biaya proyek perlu ditekan sebesar ini supaya margin kembali ${t.marginMin}%.`,
          };
    }
    case "lead": {
      const awal = Date.UTC(k.tahun, (k.kuartal - 1) * 3, 1);
      const akhir = Date.UTC(k.tahun, k.kuartal * 3, 1);
      const total = Math.round((akhir - awal) / HARI);
      const ke = Math.min(total, Math.round((hariIni - awal) / HARI) + 1);
      const v = k.lead.kuartalIni;
      const laju = { waktu: (ke / total) * 100, capaian: Math.min(100, (v / t.leadKuartalMin) * 100), periode: `Kuartal ${k.kuartal}` };
      if (v < t.leadKuartalMin) {
        return { jenis: "butuh", label: "Yang dibutuhkan", angka: `${t.leadKuartalMin - v} pesan`, ket: `lagi dalam ${total - ke} hari tersisa kuartal ${k.kuartal}.`, laju };
      }
      return { jenis: "aman", label: "Batas bawah tercapai", angka: `hari ke-${ke}`, ket: `dari ${total} hari kuartal ${k.kuartal} · ${v} pesan masuk.`, laju };
    }
    case "signature": {
      const awal = Date.UTC(k.tahun, 0, 1);
      const total = Math.round((Date.UTC(k.tahun + 1, 0, 1) - awal) / HARI);
      const ke = Math.min(total, Math.round((hariIni - awal) / HARI) + 1);
      const v = k.signature.jumlah;
      const laju = { waktu: (ke / total) * 100, capaian: Math.min(100, (v / t.signatureMin) * 100), periode: `Tahun ${k.tahun}` };
      if (v < t.signatureMin) {
        return { jenis: "butuh", label: "Yang dibutuhkan", angka: `${t.signatureMin - v} proyek`, ket: `Signature ke atas lagi dalam ${total - ke} hari tersisa tahun ini.`, laju };
      }
      return {
        jenis: "aman",
        label: "Ruang aman",
        angka: v === t.signatureMin ? "tepat" : `+${v - t.signatureMin} proyek`,
        ket: v === t.signatureMin ? `${v} dari ${t.signatureMin} proyek — yang berikutnya jadi cadangan.` : "di atas ketentuan tahun ini.",
        laju,
      };
    }
    case "cadangan": {
      const c = k.cadangan;
      if (c.keluarPerBulan === null || c.bulan === null) return { jenis: "kosong", label: "Belum bisa dihitung", angka: "—", ket: "Belum ada catatan uang keluar." };
      const wajib = t.cadanganBulan * c.keluarPerBulan;
      if (c.saldo < wajib) {
        return {
          jenis: "butuh",
          label: "Yang dibutuhkan",
          angka: formatRupiahRingkas(wajib - c.saldo),
          ket: `tambahan saldo — atau tekan uang keluar ke ${formatRupiahRingkas(Math.max(0, c.saldo) / t.cadanganBulan)}/bln.`,
        };
      }
      return { jenis: "aman", label: "Ruang aman", angka: formatRupiahRingkas(c.saldo - wajib), ket: `di atas cadangan ${t.cadanganBulan} bulan pengeluaran.` };
    }
  }
}

/* ---- Cap pemeriksaan -------------------------------------------------------- */
function Cap({ keadaan, no, kode, tercap }: { keadaan: Keadaan; no: string; kode: string; tercap: boolean }) {
  return (
    <span className={`mws__cap is-${keadaan}${tercap ? " is-tercap" : ""}`}>
      <b>{TEKS_CAP[keadaan]}</b>
      <small>
        §{no} · {kode}
      </small>
    </span>
  );
}

/* ---- Tren empat potret di tiap catatan ------------------------------------------
   Skala LOKAL per pasal (di skala mawar, beda antarkuartal cuma beberapa
   piksel): garis empat potret di atas pita ketentuan, dan PENANDA potret
   terpilih yang meluncur di garis itu saat potret berganti. Tanpa tulisan. */
function TrenCatatan({ pasal, potret, pilih }: { pasal: Pasal; potret: Potret[]; pilih: number }) {
  const nilai = potret.map((s) => s.nilai[pasal.kunci]);
  const ada = nilai.filter((v): v is number => v !== null);
  if (ada.length < 2) return null;
  const rendah = Math.min(...ada, pasal.min);
  const tinggi = Math.max(...ada, pasal.maks ?? pasal.min);
  const tepi = (tinggi - rendah) * 0.16 || 1;
  const bawah = rendah - tepi;
  const atas = tinggi + tepi;
  const y = (v: number) => 100 - ((v - bawah) / (atas - bawah)) * 100;
  const n = potret.length;
  const x = (i: number) => (n === 1 ? 50 : 6 + (i / (n - 1)) * 88);
  const zonaAtas = pasal.maks === null ? 0 : y(pasal.maks);
  const zonaBawah = y(pasal.min);
  const titikGaris = nilai
    .map((v, i) => (v === null ? null : `${bulat2(x(i))},${bulat2(y(v))}`))
    .filter(Boolean)
    .join(" ");
  const vPilih = nilai[pilih];
  return (
    <span className="mws__tren" aria-hidden="true">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none">
        <rect className="mws__trenzona" x="0" width="100" y={bulat2(zonaAtas)} height={bulat2(Math.max(0, zonaBawah - zonaAtas))} />
        <path className="mws__trenbatas" d={`M0 ${bulat2(zonaBawah)}H100`} />
        <polyline className="mws__trengaris" points={titikGaris} />
      </svg>
      {nilai.map((v, i) =>
        v === null ? null : (
          <i
            key={i}
            className={keadaanDari(pasal, v) === "belum" ? "mws__trentitik is-belum" : "mws__trentitik"}
            style={{ left: `${x(i)}%`, top: `${y(v)}%` }}
          />
        ),
      )}
      {vPilih !== null && vPilih !== undefined && (
        <b
          className={keadaanDari(pasal, vPilih) === "belum" ? "mws__trenpilih is-belum" : "mws__trenpilih"}
          style={{ left: `${x(pilih)}%`, top: `${y(vPilih)}%` }}
        />
      )}
    </span>
  );
}

/* ---- Meteran capaian di balon catatan -------------------------------------------
   Lingkar di sekeliling balon: busurnya = capaian ÷ 200% (penuh = 200%),
   takik di bawah = 100% ketentuan. Panjangnya bergeser saat potret berganti. */
function MeteranBalon({ q, belum }: { q: number | null; belum: boolean }) {
  const isi = q === null ? 0 : Math.min(1, Math.max(0, q / 2));
  return (
    <svg className="mws__meteran" viewBox="0 0 44 44" aria-hidden="true">
      <circle className="mws__meteranalur" cx="22" cy="22" r="20.25" />
      <circle
        className={belum ? "mws__meteranisi is-belum" : "mws__meteranisi"}
        cx="22"
        cy="22"
        r="20.25"
        pathLength={1}
        style={{ strokeDasharray: `${bulat2(isi)} 1` }}
        transform="rotate(-90 22 22)"
      />
      <path className="mws__meterantakik" d="M22 39.5V44" />
    </svg>
  );
}

/* ---- Kunci mawar (kunci denah lampiran) ------------------------------------------
   Seperti kunci denah di pojok gambar detail: mawar kecil dengan bentuk
   potret terpilih, dan kelopak yang sedang dirinci dihitamkan. */
function KunciMawar({ qs, pasal, pilih }: { qs: (number | null)[]; pasal: Pasal[]; pilih: Kunci }) {
  return (
    <svg className="mws__kunci" viewBox="0 0 400 400" aria-hidden="true">
      <circle className="mws__kuncibatas" cx={PUSAT} cy={PUSAT} r={jari(1)} />
      {pasal.map((p, i) => {
        const v = qs[i];
        const a1 = sudut(i) - LEBAR;
        const a2 = sudut(i) + LEBAR;
        return (
          <path
            key={p.kunci}
            className={`mws__kuncikelopak${p.kunci === pilih ? " is-pilih" : ""}${v !== null && v !== undefined && v < 1 ? " is-belum" : ""}`}
            d={sektor(PANGKAL, v === null || v === undefined ? jari(1) : jari(v), a1, a2)}
          />
        );
      })}
      <circle className="mws__kuncipusat" cx={PUSAT} cy={PUSAT} r={HUB} />
    </svg>
  );
}

/* ---- Kotak kebutuhan (di catatan pemeriksa) ---------------------------------------- */
function KotakKebutuhan({ b, kini }: { b: Kebutuhan; kini: boolean }) {
  return (
    <div className={`mws__butuh is-${b.jenis}`}>
      <p className="mws__butuhlabel">
        {b.label}
        {!kini && b.jenis !== "kosong" ? " · per hari ini" : ""}
      </p>
      <p className="mws__butuhisi">
        <b>{b.angka}</b> <span>{b.ket}</span>
      </p>
      {b.laju && (
        <div className="mws__laju" aria-label={`${b.laju.periode}: waktu ${koma(b.laju.waktu, 0)}%, capaian ${koma(b.laju.capaian, 0)}%`}>
          <span>
            <small>{b.laju.periode} berjalan</small>
            <i style={{ "--mws-laju": `${b.laju.waktu}%` } as CSSProperties} />
            <b>{koma(b.laju.waktu, 0)}%</b>
          </span>
          <span className="is-capaian">
            <small>Capaian ketentuan</small>
            <i style={{ "--mws-laju": `${b.laju.capaian}%` } as CSSProperties} />
            <b>{koma(b.laju.capaian, 0)}%</b>
          </span>
        </div>
      )}
    </div>
  );
}

/* ---- Lampiran per pasal ------------------------------------------------------ */
function Jejak({
  pasal,
  skala,
  potret,
  pilih,
  onPilih,
}: {
  pasal: Pasal;
  skala: Skala;
  potret: Potret[];
  pilih: number;
  onPilih: (i: number) => void;
}) {
  const zonaA = skala.pos(pasal.min);
  const zonaB = pasal.maks === null ? 100 : skala.pos(pasal.maks);
  const nol = skala.pos(Math.max(0, skala.bawah));
  const n = potret.length;
  /* Kolom tanpa celah grid (jarak lewat padding), jadi pusat kolom ke-i
     tepat di (i + ½) ÷ n — garis tren tidak perlu mengukur DOM. */
  const garis = potret
    .map((p, i) => {
      const v = p.nilai[pasal.kunci];
      return v === null ? null : `${bulat2(((i + 0.5) / n) * 100)},${bulat2(100 - skala.pos(v))}`;
    })
    .filter(Boolean)
    .join(" ");
  return (
    <div className="mws__jejak" style={{ "--mws-jejak-n": n } as CSSProperties}>
      <div className="mws__jejakbidang" aria-hidden="true">
        <i className="mws__jejakzona" style={{ bottom: `${zonaA}%`, height: `${zonaB - zonaA}%` }} />
        <svg viewBox="0 0 100 100" preserveAspectRatio="none">
          <polyline className="mws__jejakgaris" points={garis} />
        </svg>
      </div>
      {potret.map((p, i) => {
        const v = p.nilai[pasal.kunci];
        const y = v === null ? nol : skala.pos(v);
        return (
          <button
            key={p.kode}
            type="button"
            className={i === pilih ? "mws__jejakkolom is-pilih" : "mws__jejakkolom"}
            aria-pressed={i === pilih}
            aria-label={`${p.kode} ${tglPendek(p.tanggal)}: ${v === null ? "belum ada data" : pasal.besar(v)}`}
            onClick={() => onPilih(i)}
          >
            <span className="mws__jejaktiang" aria-hidden="true">
              <i
                className={keadaanDari(pasal, v) === "belum" ? "is-belum" : undefined}
                style={{ bottom: `${Math.min(nol, y)}%`, height: `${Math.abs(y - nol)}%` }}
              />
            </span>
            <b>{v === null ? "—" : pasal.besar(v)}</b>
            <small>{p.kini ? `Kini · ${tglPendek(p.tanggal)}` : `${p.kode} · ${tglPendek(p.tanggal)}`}</small>
          </button>
        );
      })}
    </div>
  );
}

const PERAN_SEGMEN: Partial<Record<string, string>> = {
  coffeeshop: "mesin reputasi",
  residential: "pilar margin",
};

function LampiranKontrak({ k, skala, ket }: { k: KpiStrategi; skala: Skala; ket: ReturnType<typeof pemberiKet> }) {
  const t = k.target;
  const urut = [...k.proyek].sort((a, b) => b.kontrak - a.kontrak);
  return (
    <>
      <h4 className="mws__sub">Sebaran kontrak {k.tahun}</h4>
      <div className="mws__sebaran" aria-hidden="true">
        <i
          className="mws__sebaranzona"
          style={{ left: `${skala.pos(t.rataKontrakMin)}%`, width: `${skala.pos(t.rataKontrakMaks) - skala.pos(t.rataKontrakMin)}%` }}
        />
        {urut.map((p) => (
          <i
            key={p.projectId}
            className="mws__titik"
            style={{ left: `${skala.pos(p.kontrak)}%` }}
            {...ket(() => ({ judul: p.title, baris: [{ label: "Nilai kontrak", nilai: formatRupiah(p.kontrak) }] }))}
          />
        ))}
        {k.rataKontrak.nilai !== null && <b className="mws__sebaranrata" style={{ left: `${skala.pos(k.rataKontrak.nilai)}%` }} />}
      </div>
      <div className="mws__sebaranskala" aria-hidden="true">
        <span>{skala.bawah === 0 ? "0" : jt(skala.bawah)}</span>
        <span>{jt(skala.atas)}</span>
      </div>
      <ol className="mws__daftar">
        {urut.map((p) => (
          <li key={p.projectId}>
            <span className="mws__kode">{kodeProyek(p.title)}</span>
            <a href={`/admin/proyek/satu?id=${encodeURIComponent(p.projectId)}`}>{p.title}</a>
            <small>{p.tier ?? "Tanpa paket"}</small>
            <b className={p.kontrak < t.rataKontrakMin ? "is-belum" : undefined}>{formatRupiahRingkas(p.kontrak)}</b>
          </li>
        ))}
        {!urut.length && <li className="mws__kosong">Belum ada proyek berkontrak tahun ini.</li>}
      </ol>
    </>
  );
}

function LampiranMargin({ k, ket }: { k: KpiStrategi; ket: ReturnType<typeof pemberiKet> }) {
  const min = k.target.marginMin;
  const urut = [...k.proyek].sort((a, b) => a.margin - b.margin);
  return (
    <>
      <h4 className="mws__sub">
        Biaya terhadap kontrak <span>batas biaya {100 - min}%</span>
      </h4>
      <ol className="mws__daftar mws__daftar--batang">
        {urut.map((p) => {
          const biaya = Math.min(100, (p.biaya / p.kontrak) * 100);
          return (
            <li key={p.projectId}>
              <a href={`/admin/proyek/satu?id=${encodeURIComponent(p.projectId)}`}>{p.title}</a>
              <b className={p.margin < min ? "is-belum" : undefined}>{koma(p.margin)}%</b>
              <span
                className={p.biaya > p.kontrak ? "mws__batangbiaya is-lebih" : "mws__batangbiaya"}
                style={{ "--mws-biaya": `${biaya}%`, "--mws-garisbatas": `${100 - min}%` } as CSSProperties}
                {...ket(() => ({
                  judul: p.title,
                  baris: [
                    { label: "Kontrak", nilai: formatRupiah(p.kontrak) },
                    { label: "Biaya tercatat", nilai: formatRupiah(p.biaya) },
                    { label: "Margin", nilai: `${koma(p.margin)}%` },
                  ],
                }))}
              />
            </li>
          );
        })}
        {!urut.length && <li className="mws__kosong">Belum ada proyek berkontrak tahun ini.</li>}
      </ol>
      {k.segmen.length > 0 && (
        <>
          <h4 className="mws__sub">Laba kas per segmen</h4>
          <dl className="mws__segmen">
            {[...k.segmen]
              .sort((a, b) => b.laba - a.laba)
              .map((g) => (
                <div key={g.kategori}>
                  <dt>
                    {CATEGORY_LABELS[g.kategori as ProjectCategory] ?? g.kategori}
                    {PERAN_SEGMEN[g.kategori] && <small> · {PERAN_SEGMEN[g.kategori]}</small>}
                  </dt>
                  <dd className={g.laba < 0 ? "is-belum" : undefined}>{formatRupiahRingkas(g.laba)}</dd>
                </div>
              ))}
          </dl>
        </>
      )}
    </>
  );
}

const STATUS_LEAD: { kunci: keyof KpiStrategi["lead"]["status"]; label: string }[] = [
  { kunci: "new", label: "Baru" },
  { kunci: "contacted", label: "Dihubungi" },
  { kunci: "qualified", label: "Prospek" },
  { kunci: "closed", label: "Selesai" },
];

function LampiranLead({ k }: { k: KpiStrategi }) {
  const t = k.target;
  const total = Math.max(1, k.lead.kuartalIni);
  const perBulanMin = t.leadKuartalMin / 3;
  const perBulanMaks = t.leadKuartalMaks / 3;
  const puncak = Math.max(perBulanMaks * 1.25, ...k.lead.perBulan.map((b) => b.jumlah));
  return (
    <>
      <h4 className="mws__sub">Status pesan kuartal {k.kuartal}</h4>
      <ol className="mws__daftar mws__daftar--status">
        {STATUS_LEAD.map((s) => (
          <li key={s.kunci}>
            <span>{s.label}</span>
            <span className="mws__batangpenuh" aria-hidden="true">
              <i
                className={s.kunci === "contacted" || s.kunci === "qualified" ? "is-lanjut" : undefined}
                style={{ width: `${(k.lead.status[s.kunci] / total) * 100}%` }}
              />
            </span>
            <b>{k.lead.status[s.kunci]}</b>
          </li>
        ))}
      </ol>
      <h4 className="mws__sub">
        Per bulan <span>laju ketentuan {koma(perBulanMin)}–{koma(perBulanMaks)}</span>
      </h4>
      <div className="mws__bulan" aria-label="Pesan masuk per bulan kuartal ini">
        <div className="mws__bidangtiang" aria-hidden="true">
          <i
            className="mws__bulanzona"
            style={{ bottom: `${(perBulanMin / puncak) * 100}%`, height: `${((perBulanMaks - perBulanMin) / puncak) * 100}%` }}
          />
        </div>
        {k.lead.perBulan.map((b) => (
          <div key={b.bulan} className="mws__bulankolom">
            <span className="mws__bulantiang" aria-hidden="true">
              <i style={{ height: `${(b.jumlah / puncak) * 100}%` }} />
            </span>
            <b>{b.jumlah}</b>
            <small>{blnPendek(b.bulan)}</small>
          </div>
        ))}
      </div>
    </>
  );
}

function LampiranSignature({ k }: { k: KpiStrategi }) {
  const kelompok = [
    { kunci: "kafe", label: "Coffee shop" },
    { kunci: "rumah", label: "Rumah tinggal" },
  ].map((g) => ({ ...g, anak: k.paket.filter((t) => t.kelompok === g.kunci).sort((a, b) => a.urutan - b.urutan) }));
  return (
    <>
      <h4 className="mws__sub">
        Tangga paket {k.tahun} <span>arsir = Signature ke atas</span>
      </h4>
      <div className="mws__tangga">
        {kelompok
          .filter((g) => g.anak.length)
          .map((g) => (
            <div key={g.kunci} className="mws__tanggakelompok">
              <p>{g.label}</p>
              <ol>
                {g.anak.map((t, i) => (
                  <li
                    key={t.nama}
                    className={t.urutan >= 2 ? "is-atas" : undefined}
                    style={{ "--mws-anak": i + 1, "--mws-anak-n": g.anak.length } as CSSProperties}
                  >
                    <span className="mws__tanggajumlah">{t.jumlah}</span>
                    <span className="mws__tanggaanak" aria-hidden="true" />
                    <small>{t.nama}</small>
                  </li>
                ))}
              </ol>
            </div>
          ))}
      </div>
      <ol className="mws__daftar">
        {k.signature.proyek.map((p) => (
          <li key={p.projectId}>
            <span className="mws__kode">{kodeProyek(p.title)}</span>
            <a href={`/admin/proyek/satu?id=${encodeURIComponent(p.projectId)}`}>{p.title}</a>
            <small>{p.tier}</small>
          </li>
        ))}
        {!k.signature.proyek.length && <li className="mws__kosong">Belum ada proyek Signature ke atas tahun ini.</li>}
      </ol>
    </>
  );
}

function LampiranCadangan({ k, ket }: { k: KpiStrategi; ket: ReturnType<typeof pemberiKet> }) {
  const c = k.cadangan;
  const target = k.target.cadanganBulan;
  const n = Math.max(target, Math.ceil(Math.max(0, c.bulan ?? 0))) + 1;
  const bulanan = c.bulanan;
  const puncak = Math.max(1, ...bulanan.map((b) => b.keluar));
  return (
    <>
      <p className="mws__rumus">
        {formatRupiah(c.saldo)} <em>÷</em> {c.keluarPerBulan === null ? "—" : `${formatRupiah(c.keluarPerBulan)}/bln`}
      </p>
      <p className="mws__rumusket">Saldo catatan panel ÷ rata-rata keluar {c.bulanBerdata} bulan berdata</p>
      <div className="mws__landasan" aria-label={`Cadangan ${c.bulan === null ? "belum ada data" : koma(c.bulan)} dari ${target} bulan`}>
        {Array.from({ length: n }, (_, i) => {
          const isi = c.bulan === null ? 0 : Math.min(1, Math.max(0, c.bulan - i));
          return (
            <span key={i} className={`mws__landasanbulan${i < target ? " is-wajib" : ""}${i + 1 === target ? " is-batas" : ""}`}>
              <i style={{ width: `${isi * 100}%` }} />
              <small>{i + 1}</small>
            </span>
          );
        })}
      </div>
      <h4 className="mws__sub">
        Keluar per bulan <span>putus = rata-rata</span>
      </h4>
      <div className="mws__keluar">
        <div className="mws__bidangtiang" aria-hidden="true">
          {c.keluarPerBulan !== null && <i className="mws__rata" style={{ bottom: `${(c.keluarPerBulan / puncak) * 100}%` }} />}
        </div>
        {bulanan.map((b) => (
          <div
            key={b.bulan}
            className="mws__keluarkolom"
            {...ket(() => ({ judul: blnPendek(b.bulan), baris: [{ label: "Uang keluar", nilai: formatRupiah(b.keluar) }] }))}
          >
            <span className="mws__bulantiang" aria-hidden="true">
              <i style={{ height: `${(b.keluar / puncak) * 100}%` }} />
            </span>
            <small>{blnPendek(b.bulan)}</small>
          </div>
        ))}
      </div>
    </>
  );
}

/* ---- Halaman ------------------------------------------------------------------ */
function Isi() {
  const [k, setK] = useState<KpiStrategi | null>(() => bacaCache<KpiStrategi>("kpi"));
  const [galat, setGalat] = useState<string | null>(null);
  /* Info Studio — kunci `settings` milik halaman itu, di sini cuma dibaca
     (jebakan #8). */
  const [studio, setStudio] = useState<StudioSettings | null>(() => bacaCache<StudioSettings>("settings"));

  useEffect(() => {
    ambilKpi()
      .then((d) => {
        tulisCache("kpi", d);
        setK(d);
      })
      .catch((e) => setGalat((e as Error).message));
    ambilSettings()
      .then(setStudio)
      .catch(() => {});
  }, []);

  if (!k) {
    return galat ? (
      <div className="mws">
        <div className="mws__papan mws__papan--galat">
          <p>KPI tidak bisa dimuat: {galat}</p>
        </div>
      </div>
    ) : (
      <Rangka />
    );
  }
  return <Mawar k={k} studio={studio} />;
}

function Rangka() {
  return (
    <div className="mws" aria-busy="true">
      <div className="mws__papan">
        <div className="mws__panggung mws__panggung--rangka">
          <div className="mws__sel">
            <div className="mws__mawar">
              <i className="mws__rangkacincin" />
            </div>
          </div>
        </div>
        <div className="mws__kertas mws__lampiran mws__kertas--rangka" />
      </div>
    </div>
  );
}

interface Elemen {
  bayang: SVGPathElement | null;
  cahaya: SVGPathElement | null;
  isi: SVGPathElement | null;
  kurang: SVGPathElement | null;
  ujung: SVGPathElement | null;
  garis: SVGPathElement | null;
  lebih: SVGPathElement | null;
  kosong: SVGPathElement | null;
}
interface Penunjuk {
  kunci: Kunci;
  d: string;
  x: number;
  y: number;
}

const TEKS_ARAH: Record<Keadaan, string> = {
  memenuhi: "memenuhi",
  lampaui: "melampaui",
  belum: "belum",
  kosong: "kosong",
};

function Mawar({ k, studio }: { k: KpiStrategi; studio: StudioSettings | null }) {
  const pasal = useMemo(() => pasalDari(k), [k]);
  const potret = useMemo(() => potretDari(k), [k]);
  const skala = useMemo(
    () => Object.fromEntries(pasal.map((p) => [p.kunci, skalaDari(p, potret.map((x) => x.nilai[p.kunci]))])) as Record<Kunci, Skala>,
    [pasal, potret],
  );
  /* q = realisasi ÷ ketentuan minimum, per potret per pasal. */
  const q = useMemo(
    () =>
      potret.map((s) =>
        pasal.map((p) => {
          const v = s.nilai[p.kunci];
          return v === null ? null : v / p.min;
        }),
      ),
    [potret, pasal],
  );
  const keadaanPer = useMemo(
    () => potret.map((s) => Object.fromEntries(pasal.map((p) => [p.kunci, keadaanDari(p, s.nilai[p.kunci])])) as Record<Kunci, Keadaan>),
    [potret, pasal],
  );
  const n = potret.length;
  const kini = n - 1;
  const tDari = (i: number) => (n > 1 ? i / (n - 1) : 0);

  const [pilihPotret, setPilihPotret] = useState(kini);
  const pilihRef = useRef(kini);
  /* Bawaan: pasal pertama yang BELUM memenuhi — halaman membuka yang perlu
     diperhatikan. */
  const [pilihPasal, setPilihPasal] = useState<Kunci>(
    () => pasal.find((p) => keadaanDari(p, potret[kini]!.nilai[p.kunci]) === "belum")?.kunci ?? "kontrak",
  );
  const [sorot, setSorot] = useState<Kunci | null>(null);
  /* Gerak hanya sesudah perbuatan (jebakan #74): `hidup` menyala sesudah
     bingkai kedua; `ditarik` dan `tercap` hanya dipasang oleh perbuatan. */
  const [hidup, setHidup] = useState(false);
  const [ditarik, setDitarik] = useState<Kunci | null>(null);
  const [tercap, setTercap] = useState({ n: 0, nyala: false });
  const [lampiranBaru, setLampiranBaru] = useState(0);
  const [penunjuk, setPenunjuk] = useState<Penunjuk[]>([]);
  const waktu = useRef<number[]>([]);
  const kabar: KabarKartu = useRef(null);
  const ket = pemberiKet(kabar);
  const idLampiran = useId();
  const idPola = `mws${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const tabRef = useRef<Partial<Record<Kunci, HTMLButtonElement | null>>>({});
  const balonRef = useRef<Partial<Record<Kunci, HTMLSpanElement | null>>>({});
  const panggungRef = useRef<HTMLElement>(null);
  const mawarRef = useRef<HTMLDivElement>(null);
  const lapisRef = useRef<SVGSVGElement>(null);
  const el = useRef<Elemen[]>(pasal.map(() => ({ bayang: null, cahaya: null, isi: null, kurang: null, ujung: null, garis: null, lebih: null, kosong: null })));
  const matahariRef = useRef<HTMLSpanElement>(null);
  const bayangRef = useRef<SVGGElement>(null);
  const sinarRef = useRef<SVGRadialGradientElement>(null);
  const jalurRef = useRef<SVGPathElement>(null);
  const basuhRef = useRef<SVGPathElement>(null);
  const tglRef = useRef<HTMLElement>(null);
  const tKini = useRef(tDari(kini));
  const raf = useRef(0);
  const seret = useRef<{ kiri: number; lebar: number; x0: number; geser: boolean } | null>(null);

  /* Bentuk kelopak di letak t (0 = potret pertama, 1 = hari ini): di antara
     dua stasiun, kelopak ditarik lurus dari bentuk yang satu ke yang lain. */
  const qPada = (t: number): (number | null)[] => {
    if (n === 1) return q[0]!;
    const f = Math.min(n - 1, Math.max(0, t * (n - 1)));
    const i0 = Math.min(n - 2, Math.floor(f));
    const u = f - i0;
    return pasal.map((_, j) => {
      const a = q[i0]![j]!;
      const b = q[i0 + 1]![j]!;
      if (a === null || b === null) return u < 0.5 ? a : b;
      return a + (b - a) * u;
    });
  };
  /* Tanggal di letak t — tanggal "Diperiksa per" ikut berjalan selama
     matahari diseret, dan tepat tanggal potretnya saat diam. */
  const tanggalPada = (t: number) => {
    if (n === 1) return tglPanjang(potret[0]!.tanggal);
    const f = Math.min(n - 1, Math.max(0, t * (n - 1)));
    const i0 = Math.min(n - 2, Math.floor(f));
    const u = f - i0;
    const a = hariDari(potret[i0]!.tanggal);
    const b = hariDari(potret[i0 + 1]!.tanggal);
    return TGL_PANJANG.format(new Date(Math.round((a + (b - a) * u) / HARI) * HARI));
  };

  /* Seluruh bagian mawar yang bergerak ditulis LANGSUNG ke DOM: seret dan
     perjalanan matahari tidak menggambar ulang halaman. React tidak pernah
     memegang atribut `d` elemen-elemen ini. */
  const gambar = (qs: (number | null)[]) => {
    const tulis = (x: SVGPathElement | null, d: string) => {
      if (x && x.getAttribute("d") !== d) x.setAttribute("d", d);
    };
    qs.forEach((v, i) => {
      const e = el.current[i];
      if (!e) return;
      const a1 = sudut(i) - LEBAR;
      const a2 = sudut(i) + LEBAR;
      if (v === null) {
        tulis(e.bayang, "");
        tulis(e.cahaya, "");
        tulis(e.isi, "");
        tulis(e.garis, "");
        tulis(e.kurang, "");
        tulis(e.ujung, "");
        tulis(e.lebih, "");
        tulis(e.kosong, sektor(PANGKAL, jari(1), a1, a2));
        return;
      }
      const r = jari(v);
      tulis(e.kosong, "");
      tulis(e.bayang, sektor(PANGKAL, r, a1, a2));
      tulis(e.isi, sektor(PANGKAL, r, a1, a2));
      tulis(e.cahaya, sektor(Math.max(PANGKAL, r - 7), r, a1, a2));
      tulis(e.garis, sektor(PANGKAL, r, a1, a2));
      tulis(e.kurang, v < 1 ? sektor(r, jari(1), a1, a2) : "");
      tulis(e.ujung, busur(r, a1, a2));
      e.ujung?.classList.toggle("is-kurang", v < 1);
      tulis(e.lebih, v > 2 ? panahLebih(i) : "");
    });
  };

  const taruh = (t: number) => {
    const x = lintasX(t);
    /* Bayangan kelopak jatuh berlawanan dengan matahari dan memendek saat
       matahari tinggi; CAHAYA-nya datang dari arah matahari — studi
       bayangan, cuma lewat satu transform dan dua atribut gradien. */
    const tinggi = (100 - lintasY(x)) / LTINGGI;
    bayangRef.current?.setAttribute("transform", `translate(${bulat2((-(x - 500) / 390) * 7)} ${bulat2(3 + (1 - tinggi) * 10)})`);
    const g = sinarRef.current;
    if (g) {
      const [sx, sy] = titik(170 + (1 - tinggi) * 70, ((x - 500) / 390) * 64);
      g.setAttribute("cx", String(bulat2(sx)));
      g.setAttribute("cy", String(bulat2(sy)));
      g.setAttribute("fx", String(bulat2(sx)));
      g.setAttribute("fy", String(bulat2(sy)));
    }
    const m = matahariRef.current;
    if (m) {
      m.style.left = `${x / 10}%`;
      m.style.top = `${lintasY(x)}%`;
    }
    const jalur = t > 0.001 ? jalurLintas(0, t) : "";
    jalurRef.current?.setAttribute("d", jalur);
    basuhRef.current?.setAttribute("d", jalur ? `${jalur}L${bulat2(x)} 100L${LX0} 100Z` : "");
    const tg = tglRef.current;
    if (tg) {
      const teks = tanggalPada(t);
      if (tg.textContent !== teks) tg.textContent = teks;
    }
  };

  useLayoutEffect(() => {
    gambar(qPada(tKini.current));
    taruh(tKini.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  useEffect(() => {
    let b2 = 0;
    const b1 = requestAnimationFrame(() => (b2 = requestAnimationFrame(() => setHidup(true))));
    return () => {
      cancelAnimationFrame(b1);
      cancelAnimationFrame(b2);
      cancelAnimationFrame(raf.current);
      waktu.current.forEach((w) => window.clearTimeout(w));
    };
  }, []);

  /* Garis penunjuk: dibaca dari kotak balon dan kotak mawar HANYA saat
     ukurannya berubah (ResizeObserver), tidak pernah saat menggeser. */
  useLayoutEffect(() => {
    const pg = panggungRef.current;
    const sq = mawarRef.current;
    const lapis = lapisRef.current;
    if (!pg || !sq || !lapis) return;
    const hitung = () => {
      if (getComputedStyle(lapis).display === "none") {
        setPenunjuk((s) => (s.length ? [] : s));
        return;
      }
      const P = pg.getBoundingClientRect();
      const S = sq.getBoundingClientRect();
      const sk = S.width / 400;
      const baru = pasal.map((p, i): Penunjuk => {
        const b = balonRef.current[p.kunci]!.getBoundingClientRect();
        const kanan = LETAK[p.kunci].sisi === "kanan";
        const ax = Math.round((kanan ? b.left : b.right) - P.left) + (kanan ? -0.5 : 0.5);
        const ay = Math.round(b.top + b.height / 2 - P.top) + 0.5;
        const bahu = ax + (kanan ? -12 : 12);
        const [ux, uy] = titik(UJUNG_PENUNJUK, sudut(i));
        const x = bulat2(S.left - P.left + ux * sk);
        const y = bulat2(S.top - P.top + uy * sk);
        return { kunci: p.kunci, d: `M${ax} ${ay}H${bahu}L${x} ${y}`, x, y };
      });
      setPenunjuk((s) => (JSON.stringify(s) === JSON.stringify(baru) ? s : baru));
    };
    hitung();
    const ro = new ResizeObserver(hitung);
    ro.observe(pg);
    ro.observe(sq);
    Object.values(tabRef.current).forEach((t) => t && ro.observe(t));
    return () => ro.disconnect();
  }, [pasal]);

  const tunda = (f: () => void, ms: number) => {
    waktu.current.push(window.setTimeout(f, ms));
  };

  /* Matahari berjalan sepanjang busurnya; kelopak ikut berubah bentuk
     melewati potret-potret di antaranya. */
  const jalan = (ke: number) => {
    cancelAnimationFrame(raf.current);
    const t0 = tKini.current;
    const t1 = tDari(ke);
    if (!geraknya() || Math.abs(t1 - t0) < 1e-4) {
      tKini.current = t1;
      gambar(qPada(t1));
      taruh(t1);
      return;
    }
    const lama = 380 + 420 * Math.abs(t1 - t0);
    const mulai = performance.now();
    const langkahi = (sekarang: number) => {
      const p = Math.min(1, (sekarang - mulai) / lama);
      /* Mendarat lembut tanpa pantulan. */
      const e = 1 - Math.pow(1 - p, 3);
      const t = p < 1 ? t0 + (t1 - t0) * e : t1;
      tKini.current = t;
      gambar(qPada(t));
      taruh(t);
      if (p < 1) raf.current = requestAnimationFrame(langkahi);
    };
    raf.current = requestAnimationFrame(langkahi);
  };

  const pilihSnap = (i: number, berjalan = true) => {
    const lama = pilihRef.current;
    if (i !== lama) {
      pilihRef.current = i;
      setPilihPotret(i);
      /* Cap lampiran dibubuhkan ulang hanya kalau keadaan pasal yang sedang
         diperiksa memang berubah. */
      const p = pasal.find((x) => x.kunci === pilihPasal)!;
      if (geraknya() && keadaanDari(p, potret[i]!.nilai[p.kunci]) !== keadaanDari(p, potret[lama]!.nilai[p.kunci])) {
        setTercap((c) => ({ n: c.n + 1, nyala: true }));
        tunda(() => setTercap((c) => ({ ...c, nyala: false })), 700);
      }
    }
    if (berjalan) jalan(i);
  };

  const pilihP = (kunci: Kunci) => {
    if (kunci === pilihPasal) return;
    setPilihPasal(kunci);
    if (geraknya()) {
      setDitarik(kunci);
      setLampiranBaru((x) => x + 1);
      tunda(() => setDitarik((d) => (d === kunci ? null : d)), 900);
    }
  };

  /* ---- Lintasan: seret, klik, papan ketik ---- */
  const tDariX = (clientX: number, kiri: number, lebar: number) => {
    const x = ((clientX - kiri) / lebar) * 1000;
    return Math.min(1, Math.max(0, (x - LX0) / (LX1 - LX0)));
  };
  const tekan = (e: PointerEventReact<HTMLDivElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const kotak = e.currentTarget.getBoundingClientRect();
    seret.current = { kiri: kotak.left, lebar: kotak.width, x0: e.clientX, geser: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const geser = (e: PointerEventReact<HTMLDivElement>) => {
    const s = seret.current;
    if (!s) return;
    if (!s.geser && Math.abs(e.clientX - s.x0) < 4) return;
    s.geser = true;
    cancelAnimationFrame(raf.current);
    const t = tDariX(e.clientX, s.kiri, s.lebar);
    tKini.current = t;
    gambar(qPada(t));
    taruh(t);
    const i = Math.round(t * (n - 1));
    if (i !== pilihRef.current) pilihSnap(i, false);
  };
  const lepas = (e: PointerEventReact<HTMLDivElement>) => {
    const s = seret.current;
    seret.current = null;
    if (!s) return;
    const t = s.geser ? tKini.current : tDariX(e.clientX, s.kiri, s.lebar);
    pilihSnap(Math.round(t * (n - 1)));
  };
  const batal = () => {
    if (!seret.current) return;
    seret.current = null;
    jalan(pilihRef.current);
  };
  const tombolLintas = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = pilihRef.current;
    const ke =
      e.key === "ArrowRight" || e.key === "ArrowUp" || e.key === "PageUp"
        ? Math.min(n - 1, i + 1)
        : e.key === "ArrowLeft" || e.key === "ArrowDown" || e.key === "PageDown"
          ? Math.max(0, i - 1)
          : e.key === "Home"
            ? 0
            : e.key === "End"
              ? n - 1
              : null;
    if (ke === null) return;
    e.preventDefault();
    pilihSnap(ke);
  };

  const tombolTab = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const m = pasal.length;
    const ke =
      e.key === "ArrowDown" || e.key === "ArrowRight"
        ? (i + 1) % m
        : e.key === "ArrowUp" || e.key === "ArrowLeft"
          ? (i - 1 + m) % m
          : e.key === "Home"
            ? 0
            : e.key === "End"
              ? m - 1
              : null;
    if (ke === null) return;
    e.preventDefault();
    pilihP(pasal[ke]!.kunci);
    tabRef.current[pasal[ke]!.kunci]?.focus();
  };

  const snap = potret[pilihPotret]!;
  const sebelum = pilihPotret > 0 ? potret[pilihPotret - 1]! : null;
  const keadaan = keadaanPer[pilihPotret]!;
  const memenuhi = pasal.filter((p) => lulus(keadaan[p.kunci])).length;
  const daftar = daftarLembar().halaman;
  const aktif = pasal.find((p) => p.kunci === pilihPasal)!;
  const iAktif = pasal.indexOf(aktif);
  const sumber = lembarUntuk(aktif.sumber, daftar)?.lembar ?? null;
  const kodeSnap = snap.kini ? `K${snap.kuartal}` : snap.kode;
  const nama = studio?.studioName ?? "studio";
  const paraf = nama
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]!.toUpperCase())
    .join("");

  /* Kop bersel: pasal terkuat, pasal yang paling perlu perhatian, dan arah
     kelima pasal sejak potret sebelumnya — semuanya dari potret terpilih. */
  const qSnap = q[pilihPotret]!;
  let iKuat = -1;
  let iLemah = -1;
  pasal.forEach((p, i) => {
    const v = qSnap[i];
    if (v === null || v === undefined) return;
    if (iKuat < 0 || v > qSnap[iKuat]!) iKuat = i;
    if (keadaan[p.kunci] === "belum" && (iLemah < 0 || v < qSnap[iLemah]!)) iLemah = i;
  });
  let naik = 0;
  let turun = 0;
  if (sebelum) {
    pasal.forEach((p) => {
      const a = sebelum.nilai[p.kunci];
      const b = snap.nilai[p.kunci];
      if (a === null || b === null) return;
      if (b > a) naik++;
      else if (b < a) turun++;
    });
  }
  const tetap = sebelum ? pasal.length - naik - turun : 0;

  let lampiran: ReactNode;
  switch (aktif.kunci) {
    case "kontrak":
      lampiran = <LampiranKontrak k={k} skala={skala.kontrak} ket={ket} />;
      break;
    case "margin":
      lampiran = <LampiranMargin k={k} ket={ket} />;
      break;
    case "lead":
      lampiran = <LampiranLead k={k} />;
      break;
    case "signature":
      lampiran = <LampiranSignature k={k} />;
      break;
    case "cadangan":
      lampiran = <LampiranCadangan k={k} ket={ket} />;
      break;
  }

  /* Kelopak menjawab "berapa" di tiap kuartal (titik warna = putusan
     kuartal itu), dan menyorot catatannya — tetikus saja (jebakan #9). */
  const warnaKeadaan = (kd: Keadaan) => (kd === "belum" ? "var(--warn)" : kd === "kosong" ? "var(--kas-dalam)" : "var(--brand-mint)");
  const keteranganKelopak = (p: Pasal) => {
    const h = ket(() => ({
      judul: `§${p.no} ${p.judul}`,
      baris: [
        ...potret.map((s, j) => {
          const v = s.nilai[p.kunci];
          return {
            warna: warnaKeadaan(keadaanPer[j]![p.kunci]),
            label: s.kini ? `Kini · ${tglPendek(s.tanggal)}` : `${s.kode} · ${tglPendek(s.tanggal)}`,
            nilai: v === null ? "—" : `${p.besar(v)} · ${koma(Math.round((v / p.min) * 100), 0)}%`,
          };
        }),
        { label: "Ketentuan", nilai: p.pendek },
      ],
    }));
    return {
      ...h,
      onPointerEnter: (e: PointerEventReact) => {
        h.onPointerEnter(e);
        if (e.pointerType === "mouse") setSorot(p.kunci);
      },
      onPointerLeave: (e: PointerEventReact) => {
        h.onPointerLeave(e);
        if (e.pointerType === "mouse") setSorot(null);
      },
    };
  };

  const adaZona = pasal.some((p) => p.maks !== null);
  const kelasPilih = (p: Pasal) => `${p.kunci === pilihPasal ? " is-pilih" : ""}${sorot === p.kunci ? " is-sorot" : ""}`;
  /* Gradien pita capaian: warna rata per pita dan garis pemisah setipis
     satu satuan di tiap batas — seperti kelas angin yang bertumpuk. */
  const hentiPita = (() => {
    const out: { o: number; k: string }[] = [{ o: PANGKAL / R200, k: "mws__pita-1" }];
    PITA.forEach((b, j) => {
      const o = jari(b) / R200;
      out.push({ o: o - 0.005, k: `mws__pita-${j + 1}` });
      out.push({ o: o - 0.005, k: "mws__pita-sela" });
      out.push({ o: o + 0.003, k: "mws__pita-sela" });
      out.push({ o: o + 0.003, k: `mws__pita-${j + 2}` });
    });
    out.push({ o: 1, k: "mws__pita-4" });
    return out;
  })();

  return (
    <div className={hidup ? "mws is-hidup" : "mws"}>
      <div className="mws__papan">
        <section ref={panggungRef} className="mws__panggung" aria-labelledby="mws-judul">
          <header className="mws__kop">
            <div className="mws__kopjudul">
              <p>Dokumen strategi bisnis · Pasal 8 · {snap.tahun}</p>
              <h2 id="mws-judul">Mawar strategi</h2>
            </div>
            <div className="mws__ringkas">
              <button
                type="button"
                className={iKuat >= 0 && pasal[iKuat]!.kunci === pilihPasal ? "mws__rk is-pilih" : "mws__rk"}
                disabled={iKuat < 0}
                onClick={() => iKuat >= 0 && pilihP(pasal[iKuat]!.kunci)}
              >
                <small>Terkuat</small>
                {iKuat >= 0 ? (
                  <b>
                    §{pasal[iKuat]!.no} ·{" "}
                    <Hitung nilai={qSnap[iKuat]! * 100} hidup={hidup} format={(x) => `${koma(Math.round(x), 0)}%`} />
                  </b>
                ) : (
                  <b>—</b>
                )}
                <span>{iKuat >= 0 ? pasal[iKuat]!.judul : "belum ada data"}</span>
              </button>
              <button
                type="button"
                className={`mws__rk${iLemah >= 0 ? " is-belum" : " is-aman"}${iLemah >= 0 && pasal[iLemah]!.kunci === pilihPasal ? " is-pilih" : ""}`}
                disabled={iLemah < 0}
                onClick={() => iLemah >= 0 && pilihP(pasal[iLemah]!.kunci)}
              >
                <small>Perlu perhatian</small>
                {iLemah >= 0 ? (
                  <b>
                    §{pasal[iLemah]!.no} ·{" "}
                    <Hitung nilai={qSnap[iLemah]! * 100} hidup={hidup} format={(x) => `${koma(Math.round(x), 0)}%`} />
                  </b>
                ) : (
                  <b>Tidak ada</b>
                )}
                <span>{iLemah >= 0 ? pasal[iLemah]!.judul : "kelima pasal memenuhi"}</span>
              </button>
              <div className="mws__rk mws__rk--arah">
                <small>{sebelum ? `Arah sejak ${namaPotret(sebelum)}` : "Arah"}</small>
                {sebelum ? (
                  <b>
                    <span className="is-naik">▲{naik}</span> <span className="is-turun">▼{turun}</span>
                    {tetap > 0 && <span className="is-tetap"> ={tetap}</span>}
                  </b>
                ) : (
                  <b>—</b>
                )}
                <span>{sebelum ? "pasal naik · turun" : "potret pertama"}</span>
              </div>
            </div>
          </header>

          <div className="mws__sel">
            <div ref={mawarRef} className="mws__mawar">
              <svg className="mws__gambar" viewBox="0 0 400 400" aria-hidden="true">
                <defs>
                  <radialGradient id={`${idPola}-isi`} gradientUnits="userSpaceOnUse" cx={PUSAT} cy={PUSAT} r={R200}>
                    {hentiPita.map((h, j) => (
                      <stop key={j} offset={bulat2(h.o * 1000) / 1000} className={h.k} />
                    ))}
                  </radialGradient>
                  <radialGradient id={`${idPola}-pijar`} gradientUnits="userSpaceOnUse" cx={PUSAT} cy={PUSAT} r={RIM}>
                    <stop offset="0" className="mws__pijar-a" />
                    <stop offset="1" className="mws__pijar-b" />
                  </radialGradient>
                  {/* Cahaya dari arah matahari: pusatnya ditulis `taruh()`. */}
                  <radialGradient ref={sinarRef} id={`${idPola}-sinar`} gradientUnits="userSpaceOnUse" cx={PUSAT} cy={0} r={300}>
                    <stop offset="0" className="mws__sinar-a" />
                    <stop offset="0.55" className="mws__sinar-b" />
                    <stop offset="1" className="mws__sinar-c" />
                  </radialGradient>
                  <pattern id={`${idPola}-kurang`} patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
                    <rect width="2.2" height="6" className="mws__arsir-amber" />
                  </pattern>
                  {/* Bayangan hanya jatuh di lajur kelopak, tidak pernah ke celah
                      puncak tempat label skala, dan tidak ke cincin riwayat. */}
                  <clipPath id={`${idPola}-lajur`}>
                    {pasal.map((p, i) => (
                      <path key={p.kunci} d={sektor(PANGKAL, R200 + 1, sudut(i) - LEBAR - 3, sudut(i) + LEBAR + 3)} />
                    ))}
                  </clipPath>
                  <clipPath id={`${idPola}-dalam`}>
                    <circle cx={PUSAT} cy={PUSAT} r={R200 + 1} />
                  </clipPath>
                  <pattern id={`${idPola}-zona`} patternUnits="userSpaceOnUse" width="5" height="5" patternTransform="rotate(-45)">
                    <rect width="1.6" height="5" className="mws__arsir-mint" />
                  </pattern>
                </defs>

                <circle className="mws__pijar" cx={PUSAT} cy={PUSAT} r={RIM} fill={`url(#${idPola}-pijar)`} />

                {/* Lajur kelopak: sektor 0–200% tiap pasal. */}
                {pasal.map((p, i) => (
                  <path key={`lajur-${p.kunci}`} className={`mws__lajur${kelasPilih(p)}`} d={sektor(PANGKAL, R200, sudut(i) - LEBAR, sudut(i) + LEBAR)} />
                ))}

                <g clipPath={`url(#${idPola}-lajur)`}>
                  <g ref={bayangRef} className="mws__bayang">
                    {pasal.map((p, i) => (
                      <path
                        key={p.kunci}
                        ref={(x) => {
                          el.current[i]!.bayang = x;
                        }}
                      />
                    ))}
                  </g>
                </g>

                {/* Bidang kuartal sebelumnya: kelopak yang menyusut
                    memperlihatkan bidang ini di luar ujungnya. */}
                {sebelum &&
                  pasal.map((p, i) => {
                    const v = q[pilihPotret - 1]![i];
                    if (v === null || v === undefined) return null;
                    return (
                      <path
                        key={`hantu-${p.kunci}`}
                        className="mws__hantu"
                        d={sektor(PANGKAL, jari(v), sudut(i) - LEBAR + 1.5, sudut(i) + LEBAR - 1.5)}
                      />
                    );
                  })}

                {/* Rentang ketentuan (kontrak, pesan). */}
                {pasal.map((p, i) =>
                  p.maks === null ? null : (
                    <g key={`zona-${p.kunci}`}>
                      <path
                        className="mws__zona"
                        fill={`url(#${idPola}-zona)`}
                        d={sektor(jari(1), jari(p.maks / p.min), sudut(i) - LEBAR, sudut(i) + LEBAR)}
                      />
                      <path className="mws__zonabatas" d={busur(jari(p.maks / p.min), sudut(i) - LEBAR, sudut(i) + LEBAR)} />
                    </g>
                  ),
                )}

                {/* Cincin skala, terputus di celah puncak tempat labelnya. */}
                {CINCIN.map((c) => (
                  <path key={c.q} className={c.q === 1 ? "mws__cincin is-batas" : "mws__cincin"} d={busur(jari(c.q), c.celah, 360 - c.celah)} />
                ))}

                {/* Kelopak berpita, kekurangan berarsir amber, garis tepi
                    (terpilih), ujung, panah lewat 200%. Kelopak terpilih
                    TERANGKAT di sumbunya. */}
                {pasal.map((p, i) => {
                  const [dx, dy] = titik(ANGKAT, sudut(i)).map((v) => v - PUSAT) as [number, number];
                  return (
                    <g
                      key={`kelopak-${p.kunci}`}
                      className={`mws__kelopak${kelasPilih(p)}`}
                      style={{ "--mws-angkat": `translate(${bulat2(dx)}px, ${bulat2(dy)}px)` } as CSSProperties}
                    >
                      <path
                        ref={(x) => {
                          el.current[i]!.isi = x;
                        }}
                        className="mws__isi"
                        fill={`url(#${idPola}-isi)`}
                      />
                      <path
                        ref={(x) => {
                          el.current[i]!.cahaya = x;
                        }}
                        className="mws__cahaya"
                      />
                      <path
                        ref={(x) => {
                          el.current[i]!.kurang = x;
                        }}
                        className="mws__kurang"
                        fill={`url(#${idPola}-kurang)`}
                      />
                      <path
                        ref={(x) => {
                          el.current[i]!.kosong = x;
                        }}
                        className="mws__kosongkelopak"
                      />
                      <path
                        ref={(x) => {
                          el.current[i]!.garis = x;
                        }}
                        className="mws__garistepi"
                      />
                      <path
                        ref={(x) => {
                          el.current[i]!.ujung = x;
                        }}
                        className="mws__ujung"
                      />
                      <path
                        ref={(x) => {
                          el.current[i]!.lebih = x;
                        }}
                        className="mws__lebih"
                      />
                    </g>
                  );
                })}

                {/* Kontur kuartal-kuartal sebelum potret terpilih. */}
                {pasal.map((p, i) =>
                  potret.slice(0, pilihPotret).map((s, j) => {
                    const v = q[j]![i];
                    if (v === null || v === undefined) return null;
                    return (
                      <path
                        key={`kontur-${p.kunci}-${s.kode}`}
                        className={j === pilihPotret - 1 ? "mws__kontur is-dekat" : "mws__kontur"}
                        d={busur(jari(v), sudut(i) - LEBAR + 3, sudut(i) + LEBAR - 3)}
                      />
                    );
                  }),
                )}

                {/* Cahaya matahari di seluruh bidang dalam mawar. */}
                <circle className="mws__sinar" cx={PUSAT} cy={PUSAT} r={R200 + 1} fill={`url(#${idPola}-sinar)`} clipPath={`url(#${idPola}-dalam)`} />

                {/* CINCIN RIWAYAT: satu lintasan per potret (dalam = tertua).
                    Busurnya = capaian terhadap ketentuan (penuh = memenuhi),
                    warnanya = putusan potret itu. */}
                {potret.map((s, j) => {
                  const [r1, r2] = lintasRiwayat(j, n);
                  return (
                    <g key={`riw-${s.kode}`} className={j === pilihPotret ? "mws__riw is-pilih" : "mws__riw"}>
                      {pasal.map((p, i) => {
                        const a1 = sudut(i) - LEBAR;
                        const a2 = sudut(i) + LEBAR;
                        const v = q[j]![i];
                        const kd = keadaanPer[j]![p.kunci];
                        return (
                          <g key={p.kunci}>
                            <path className={v === null ? "mws__riwalur is-kosong" : "mws__riwalur"} d={sektor(r1, r2, a1, a2)} />
                            {v !== null && v !== undefined && (
                              <path className={`mws__riwisi is-${kd}`} d={sektor(r1, r2, a1, a1 + (a2 - a1) * Math.min(1, v))} />
                            )}
                          </g>
                        );
                      })}
                    </g>
                  );
                })}

                {/* Cincin pinggir bertakik: tiap 6°, panjang di sumbu kelopak. */}
                <circle className="mws__rim" cx={PUSAT} cy={PUSAT} r={RIM} />
                <path
                  className="mws__takik"
                  d={Array.from({ length: 60 }, (_, j) => {
                    const deg = j * 6;
                    const sumbu = (deg - 36) % 72 === 0;
                    const celah = deg % 72 === 0;
                    const [x1, y1] = titik(RIM, deg);
                    const [x2, y2] = titik(RIM + (sumbu ? 6 : celah ? 4 : 2.5), deg);
                    return `M${bulat2(x1)} ${bulat2(y1)}L${bulat2(x2)} ${bulat2(y2)}`;
                  }).join("")}
                />

                {/* Lingkar pusat + CINCIN PUTUSAN: satu busur per pasal di
                    pangkal kelopaknya, warna = putusan potret terpilih. */}
                <circle className="mws__hub" cx={PUSAT} cy={PUSAT} r={HUB} />
                {pasal.map((p, i) => (
                  <path key={`putus-${p.kunci}`} className={`mws__putusan is-${keadaan[p.kunci]}`} d={busur(PUTUSAN, sudut(i) - LEBAR + 2, sudut(i) + LEBAR - 2)} />
                ))}

                {/* Bidang sentuh: seluruh lajur sampai cincin pinggir. */}
                {pasal.map((p, i) => (
                  <path
                    key={`sentuh-${p.kunci}`}
                    className="mws__sentuh"
                    d={sektor(HUB, RIM, sudut(i) - LEBAR - 4, sudut(i) + LEBAR + 4)}
                    onClick={() => pilihP(p.kunci)}
                    {...keteranganKelopak(p)}
                  />
                ))}
              </svg>

              {CINCIN.map((c) => (
                <span
                  key={c.q}
                  className={c.q === 1 ? "mws__skala is-batas" : "mws__skala"}
                  style={{ top: `${((PUSAT - jari(c.q)) / 400) * 100}%` }}
                  aria-hidden="true"
                >
                  {c.label}
                </span>
              ))}
              {(() => {
                const [r1, r2] = lintasRiwayat(pilihPotret, n);
                return (
                  <span className="mws__riwlabel" style={{ top: `${((PUSAT - (r1 + r2) / 2) / 400) * 100}%` }} aria-hidden="true">
                    {namaPotret(snap)}
                  </span>
                );
              })()}

              <span className="mws__pusat" aria-hidden="true">
                <b>
                  <Hitung nilai={memenuhi} hidup={hidup} format={(v) => koma(Math.round(v), 0)} />
                  <em>/{pasal.length}</em>
                </b>
                <small>memenuhi</small>
              </span>
            </div>
          </div>

          <div className="mws__catatandaftar" role="tablist" aria-label="Pasal KPI" aria-orientation="vertical">
            {pasal.map((p, i) => {
              const v = snap.nilai[p.kunci];
              const lalu = sebelum?.nilai[p.kunci] ?? null;
              const beda = v !== null && lalu !== null ? v - lalu : null;
              const dipilih = p.kunci === pilihPasal;
              const letak = LETAK[p.kunci];
              const lembar = lembarUntuk(p.sumber, daftar)?.lembar.kode ?? "";
              return (
                <button
                  key={p.kunci}
                  ref={(x) => {
                    tabRef.current[p.kunci] = x;
                  }}
                  type="button"
                  role="tab"
                  id={`mws-tab-${p.kunci}`}
                  aria-selected={dipilih}
                  aria-controls={idLampiran}
                  tabIndex={dipilih ? 0 : -1}
                  className={`mws__catatan is-${letak.sisi} is-${keadaan[p.kunci]}${kelasPilih(p)}`}
                  data-baris={letak.baris}
                  data-rata={letak.rata}
                  onClick={() => pilihP(p.kunci)}
                  onKeyDown={(e) => tombolTab(e, i)}
                  onPointerEnter={(e) => e.pointerType === "mouse" && setSorot(p.kunci)}
                  onPointerLeave={(e) => e.pointerType === "mouse" && setSorot(null)}
                >
                  <span
                    ref={(x) => {
                      balonRef.current[p.kunci] = x;
                    }}
                    className="mws__balon"
                    aria-hidden="true"
                  >
                    <MeteranBalon q={qSnap[i] ?? null} belum={keadaan[p.kunci] === "belum"} />
                    <b>{p.no}</b>
                    <small>{lembar}</small>
                  </span>
                  <span className="mws__catatanisi">
                    <span className="mws__cjudul">{p.judul}</span>
                    {v === null ? <b className="mws__cangka">—</b> : <Hitung nilai={v} hidup={hidup} format={p.besar} className="mws__cangka" />}
                    <span className="mws__cket">ketentuan {p.pendek}</span>
                    <span className="mws__cpersen">
                      {v === null ? (
                        "belum ada data"
                      ) : (
                        <>
                          <Hitung nilai={(v / p.min) * 100} hidup={hidup} format={(x) => `${koma(Math.round(x), 0)}%`} className="mws__cpersenangka" />
                          {" dari ketentuan"}
                        </>
                      )}
                    </span>
                    <span className={`mws__cbeda${beda === null ? "" : beda > 0 ? " is-naik" : beda < 0 ? " is-turun" : ""}`}>
                      {beda === null
                        ? sebelum
                          ? "—"
                          : `potret pertama · ${tglPendek(snap.tanggal)}`
                        : beda === 0
                          ? `tetap dari ${sebelum!.kode}`
                          : `${beda > 0 ? "▲" : "▼"} ${p.selisih(beda)} dari ${sebelum!.kode}`}
                    </span>
                    <TrenCatatan pasal={p} potret={potret} pilih={pilihPotret} />
                    <span className="sr-only">, {TEKS_CAP[keadaan[p.kunci]]}</span>
                  </span>
                </button>
              );
            })}
          </div>

          {/* Keterangan gambar — seperti legenda kelas angin di lembar
              analisis tapak. */}
          <div className="mws__keterangan" aria-hidden="true">
            <p>Keterangan</p>
            <small className="mws__ketjudul">Capaian terhadap ketentuan</small>
            <span className="mws__ramp">
              <i />
              <i />
              <i />
              <i />
            </span>
            <span className="mws__rampskala">
              <small style={{ left: "0%" }}>0</small>
              <small style={{ left: "25%" }}>50</small>
              <small style={{ left: "50%" }}>100</small>
              <small style={{ left: "75%" }}>150</small>
              <small style={{ left: "100%" }}>200%</small>
            </span>
            <ul>
              <li>
                <i className="mws__lg-batas" /> ketentuan minimum
              </li>
              {adaZona && (
                <li>
                  <i className="mws__lg-zona" /> rentang ketentuan
                </li>
              )}
              <li>
                <i className="mws__lg-kurang" /> kekurangan
              </li>
              {sebelum && (
                <li>
                  <i className="mws__lg-kontur" /> potret {namaPotret(sebelum)}
                </li>
              )}
              <li>
                <i className="mws__lg-riwayat" /> riwayat · dalam {namaPotret(potret[0]!)} → luar {namaPotret(potret[kini]!)}
              </li>
            </ul>
          </div>

          <svg ref={lapisRef} className="mws__penunjuklapis" aria-hidden="true">
            {penunjuk.map((g) => (
              <g key={g.kunci} className={`mws__penunjuk is-${keadaan[g.kunci]}${kelasPilih(pasal.find((p) => p.kunci === g.kunci)!)}`}>
                <path
                  key={ditarik === g.kunci ? "tarik" : "diam"}
                  className={ditarik === g.kunci ? "mws__penunjukgaris is-ditarik" : "mws__penunjukgaris"}
                  d={g.d}
                  pathLength={1}
                />
                <circle cx={g.x} cy={g.y} r={2.5} />
              </g>
            ))}
          </svg>

          <div className="mws__lintasanket">
            <p>Lintasan kuartal</p>
            <small>Seret matahari, atau ← →</small>
          </div>

          <div
            className="mws__lintasan"
            role="slider"
            tabIndex={0}
            aria-label="Potret kuartal"
            aria-valuemin={0}
            aria-valuemax={n - 1}
            aria-valuenow={pilihPotret}
            aria-valuetext={`${snap.kini ? "Kini" : `${snap.kode} ${snap.tahun}`}, ${tglPanjang(snap.tanggal)}: ${memenuhi} dari ${pasal.length} pasal memenuhi`}
            onPointerDown={tekan}
            onPointerMove={geser}
            onPointerUp={lepas}
            onPointerCancel={batal}
            onKeyDown={tombolLintas}
          >
            <div className="mws__langit">
              <svg viewBox="0 0 1000 100" preserveAspectRatio="none" aria-hidden="true">
                <path ref={basuhRef} className="mws__basuh" />
                <path className="mws__busurlangit" d={BUSUR_LANGIT} />
                {potret.map((s, i) => {
                  const x = lintasX(tDari(i));
                  return <path key={s.kode} className="mws__tegak" d={`M${bulat2(x)} ${bulat2(lintasY(x))}V100`} />;
                })}
                <path ref={jalurRef} className="mws__jalur" />
                <path className="mws__cakrawalagaris" d="M0 99.5H1000" />
              </svg>
              {potret.map((s, i) => {
                const x = lintasX(tDari(i));
                return (
                  <i
                    key={s.kode}
                    className={`mws__stasiun${i <= pilihPotret ? " is-lewat" : ""}${i === pilihPotret ? " is-pilih" : ""}`}
                    style={{ left: `${x / 10}%`, top: `${lintasY(x)}%` }}
                  />
                );
              })}
              <span ref={matahariRef} className="mws__matahari" aria-hidden="true">
                <svg viewBox="-14 -14 28 28">
                  <path
                    className="mws__sinarmatahari"
                    d={Array.from({ length: 8 }, (_, j) => {
                      const a = (j * Math.PI) / 4;
                      return `M${bulat2(Math.cos(a) * 9)} ${bulat2(Math.sin(a) * 9)}L${bulat2(Math.cos(a) * 13)} ${bulat2(Math.sin(a) * 13)}`;
                    }).join("")}
                  />
                  <circle className="mws__inti" r="6.5" />
                </svg>
              </span>
            </div>
            <div className="mws__cakrawala" aria-hidden="true">
              {potret.map((s, i) => (
                <span key={s.kode} className={i === pilihPotret ? "is-pilih" : undefined} style={{ left: `${lintasX(tDari(i)) / 10}%` }}>
                  <b>{s.kini ? "Kini" : `${s.kode} ’${String(s.tahun).slice(2)}`}</b>
                  <small>{tglPendek(s.tanggal)}</small>
                  <span className="mws__pip">
                    {pasal.map((p) => (
                      <i key={p.kunci} className={`is-${keadaanPer[i]![p.kunci]}`} />
                    ))}
                  </span>
                </span>
              ))}
            </div>
          </div>

          <div className="mws__periksa">
            <span className="mws__paraf" aria-hidden="true">
              {paraf || "—"}
            </span>
            <span className="mws__periksaisi">
              <p>Diperiksa per</p>
              <b ref={tglRef} />
              <small>
                {snap.kini ? `hari ini · kuartal ${snap.kuartal}` : `akhir ${snap.kode} ${snap.tahun}`}
              </small>
            </span>
          </div>
        </section>

        <section className="mws__kertas mws__lampiran" id={idLampiran} role="tabpanel" aria-labelledby={`mws-tab-${aktif.kunci}`}>
          <header className="mws__lampirankop">
            <div>
              <p>Lampiran §{aktif.no}</p>
              <h3>{aktif.judul}</h3>
              <small>{aktif.ketentuan(k)}</small>
            </div>
            <Cap key={`${aktif.kunci}-${tercap.n}`} keadaan={keadaan[aktif.kunci]} no={aktif.no} kode={kodeSnap} tercap={tercap.nyala} />
          </header>
          <div className="mws__kuncibaris">
            <KunciMawar qs={qSnap} pasal={pasal} pilih={aktif.kunci} />
            <span className="mws__kunciisi">
              <small>
                Kelopak {iAktif + 1} dari {pasal.length} · {TEKS_ARAH[keadaan[aktif.kunci]]}
              </small>
              {sumber && (
                <a className="mws__sumber" href={sumber.href}>
                  Sumber · <b>{sumber.kode}</b> {sumber.label}
                </a>
              )}
              {(() => {
                const r = riwayatDari(aktif, potret, pilihPotret);
                return r ? <small className={r.startsWith("baru") ? "mws__riwayat is-baru" : "mws__riwayat"}>{r}</small> : null;
              })()}
            </span>
          </div>
          <Jejak pasal={aktif} skala={skala[aktif.kunci]} potret={potret} pilih={pilihPotret} onPilih={(i) => pilihSnap(i)} />
          <div key={`isi-${aktif.kunci}-${lampiranBaru}`} className={lampiranBaru ? "mws__lampiranisi is-baru" : "mws__lampiranisi"}>
            {lampiran}
          </div>
          {(() => {
            const c = catatanPemeriksa(aktif, snap.nilai[aktif.kunci]);
            return (
              <div className={c.kurang ? "mws__pemeriksa is-kurang" : "mws__pemeriksa"}>
                <p>
                  Catatan pemeriksa · {kodeSnap} {snap.tahun}
                </p>
                <span>{c.teks}</span>
                <KotakKebutuhan b={kebutuhanDari(aktif, k)} kini={snap.kini} />
              </div>
            );
          })()}
          <p className="mws__lampirankaki">
            Diperiksa {nama} · rincian per {tglPanjang(k.hariIni)}
          </p>
        </section>
      </div>
      <Keterangan kabar={kabar} />
    </div>
  );
}

export function KpiKit() {
  return (
    <RequireAuth skeleton={<Rangka />}>
      <Isi />
    </RequireAuth>
  );
}
