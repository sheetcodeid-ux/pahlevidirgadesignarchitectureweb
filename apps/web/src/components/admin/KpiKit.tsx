import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
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
   KPI Strategi = TABEL KESESUAIAN — dokumen STRATEGI_BISNIS §8.

   Di dunia arsitektur, rencana selalu diperiksa terhadap KETENTUAN: tabel
   intensitas di gambar izin bangunan menulis ketentuan KRK (KDB maks, KDH
   min, garis sempadan) di sebelah angka rencananya, lalu satu kolom
   "Memenuhi / Tidak". Halaman ini tabel yang sama untuk studionya sendiri:
   ketentuannya lima target dokumen strategi §8, rencananya angka studio yang
   dihitung API dari catatan panel.

   1. TABEL — satu baris per PASAL (§8.1–8.5): uraian + ketentuan, GARIS
      UKUR (mistar berskala dengan ZONA ketentuan berarsir — seperti garis
      sempadan — penanda realisasi, dan TAKIK potret sebelumnya), angka
      realisasi + selisihnya, dan CAP MEMENUHI / MELAMPAUI / BELUM.
   2. DIPERIKSA PER — potret akhir K1/K2/K3 dan hari ini (`jejak` API: angka
      yang SAMA dengan yang terbaca di halaman ini pada hari itu). Memilih
      potret menggeser penanda, menghitung angka, dan mengecap ulang pasal
      yang keadaannya berubah.
   3. LAMPIRAN — rincian pasal yang dipilih (tab), dari data yang sama:
      sebaran kontrak, biaya per proyek, status pesan, tangga paket, landasan
      kas; dengan tautan ke LEMBAR SUMBERNYA (nomor set gambar rel).

   Gerak hanya karena perbuatan, tidak saat dimuat, diam bila gerak
   dikurangi. Warna: hijau = memenuhi, amber = belum. Merah tidak dipakai —
   angka di bawah target bukan perbuatan destruktif.
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
  ketentuan: (k: KpiStrategi) => string;
  min: number;
  maks: number | null;
  /** Bilangan bulat (lead, proyek): skala bertangga 1. */
  bulat?: boolean;
  besar: (v: number) => string;
  selisih: (d: number) => string;
  skala: (v: number) => string;
  sumber: string;
}

/** Cap dibubuhkan tangan — tiap baris miring sedikit berbeda, tetap. */
const PUTAR_CAP = [-5, -3, -6, -4, -2];
/** Cap yang keadaannya berubah dibubuhkan ulang sesudah penanda tiba (ms). */
const CAP_SESUDAH = 160;

const koma = (v: number, d = 1) => v.toLocaleString("id-ID", { maximumFractionDigits: d });
const jt = (v: number) => `${koma(v / 1e6, 0)} jt`;

function pasalDari(k: KpiStrategi): Pasal[] {
  const t = k.target;
  return [
    {
      kunci: "kontrak",
      no: "8.1",
      judul: "Rata-rata nilai kontrak",
      ketentuan: (x) => `Rp${koma(t.rataKontrakMin / 1e6, 0)}–${koma(t.rataKontrakMaks / 1e6, 0)} jt per proyek · ${x.rataKontrak.proyek} proyek`,
      min: t.rataKontrakMin,
      maks: t.rataKontrakMaks,
      besar: (v) => formatRupiahRingkas(v),
      selisih: (d) => formatRupiahRingkas(Math.abs(d)),
      skala: (v) => (v === 0 ? "0" : jt(v)),
      sumber: "/admin/proyek",
    },
    {
      kunci: "margin",
      no: "8.2",
      judul: "Margin kontrak",
      ketentuan: () => `≥${t.marginMin}% sesudah biaya proyek, tertimbang`,
      min: t.marginMin,
      maks: null,
      besar: (v) => `${koma(v)}%`,
      selisih: (d) => `${koma(Math.abs(d))} poin`,
      skala: (v) => `${koma(v, 0)}%`,
      sumber: "/admin/keuangan/keluar",
    },
    {
      kunci: "lead",
      no: "8.3",
      judul: "Pesan masuk per kuartal",
      ketentuan: (x) => `${t.leadKuartalMin}–${t.leadKuartalMaks} pesan · ${x.lead.ditindaklanjuti} ditindaklanjuti`,
      min: t.leadKuartalMin,
      maks: t.leadKuartalMaks,
      bulat: true,
      besar: (v) => `${koma(v, 0)} pesan`,
      selisih: (d) => `${koma(Math.abs(d), 0)} pesan`,
      skala: (v) => koma(v, 0),
      sumber: "/admin/pesan",
    },
    {
      kunci: "signature",
      no: "8.4",
      judul: "Proyek Signature ke atas",
      ketentuan: () => `≥${t.signatureMin} proyek setahun, paket urutan 2 ke atas`,
      min: t.signatureMin,
      maks: null,
      bulat: true,
      besar: (v) => `${koma(v, 0)} proyek`,
      selisih: (d) => `${koma(Math.abs(d), 0)} proyek`,
      skala: (v) => koma(v, 0),
      sumber: "/admin/paket",
    },
    {
      kunci: "cadangan",
      no: "8.5",
      judul: "Cadangan kas",
      ketentuan: () => `≥${t.cadanganBulan} bulan pengeluaran studio`,
      min: t.cadanganBulan,
      maks: null,
      besar: (v) => `${koma(v)} bulan`,
      selisih: (d) => `${koma(Math.abs(d))} bulan`,
      skala: (v) => `${koma(v, 0)} bln`,
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

/** Nama potret seperti di tombolnya ("K1", "Kini"). */
const namaPotret = (p: Potret) => (p.kini ? "Kini" : p.kode);
/** Lulus/tidak — melampaui dihitung lulus, seperti di kotak skor. */
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
  return `sejak ${namaPotret(potret[a]!)} · ${idx - a + 1} potret`;
}

/* ---- Ruang aman / yang dibutuhkan ----------------------------------------------
   Pemeriksa izin tidak berhenti di "tidak memenuhi" — ia menulis apa yang
   harus diubah. Di sini angkanya dihitung dari data yang SAMA dengan
   lampiran (per hari ini): pasal yang belum memenuhi mendapat kebutuhannya,
   yang memenuhi mendapat ruang amannya sebelum jatuh ke bawah ketentuan. */
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
          ket: `Satu proyek baru senilai ini mengangkat rata-rata ${n} proyek ke Rp${koma(t.rataKontrakMin / 1e6, 0)} jt.`,
        };
      }
      return {
        jenis: "aman",
        label: "Ruang aman",
        angka: formatRupiahRingkas(v - t.rataKontrakMin),
        ket: `Rata-rata boleh turun sebesar ini sebelum di bawah Rp${koma(t.rataKontrakMin / 1e6, 0)} jt per proyek.`,
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
            ket: `Biaya proyek boleh bertambah sebesar ini sebelum margin di bawah ${t.marginMin}%.`,
          }
        : {
            jenis: "butuh",
            label: "Yang dibutuhkan",
            angka: formatRupiahRingkas(-ruang),
            ket: `Biaya proyek perlu ditekan sebesar ini supaya margin kembali ${t.marginMin}%.`,
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
        return {
          jenis: "butuh",
          label: "Yang dibutuhkan",
          angka: `${t.leadKuartalMin - v} pesan`,
          ket: `lagi dalam ${total - ke} hari tersisa kuartal ${k.kuartal}.`,
          laju,
        };
      }
      return {
        jenis: "aman",
        label: "Batas bawah tercapai",
        angka: `hari ke-${ke}`,
        ket: `dari ${total} hari kuartal ${k.kuartal} · ${v} pesan masuk.`,
        laju,
      };
    }
    case "signature": {
      const awal = Date.UTC(k.tahun, 0, 1);
      const total = Math.round((Date.UTC(k.tahun + 1, 0, 1) - awal) / HARI);
      const ke = Math.min(total, Math.round((hariIni - awal) / HARI) + 1);
      const v = k.signature.jumlah;
      const laju = { waktu: (ke / total) * 100, capaian: Math.min(100, (v / t.signatureMin) * 100), periode: `Tahun ${k.tahun}` };
      if (v < t.signatureMin) {
        return {
          jenis: "butuh",
          label: "Yang dibutuhkan",
          angka: `${t.signatureMin - v} proyek`,
          ket: `Signature ke atas lagi dalam ${total - ke} hari tersisa tahun ini.`,
          laju,
        };
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
      if (c.keluarPerBulan === null || c.bulan === null)
        return { jenis: "kosong", label: "Belum bisa dihitung", angka: "—", ket: "Belum ada catatan uang keluar." };
      const wajib = t.cadanganBulan * c.keluarPerBulan;
      if (c.saldo < wajib) {
        return {
          jenis: "butuh",
          label: "Yang dibutuhkan",
          angka: formatRupiahRingkas(wajib - c.saldo),
          ket: `tambahan saldo — atau tekan uang keluar ke ${formatRupiahRingkas(Math.max(0, c.saldo) / t.cadanganBulan)}/bln.`,
        };
      }
      return {
        jenis: "aman",
        label: "Ruang aman",
        angka: formatRupiahRingkas(c.saldo - wajib),
        ket: `di atas cadangan ${t.cadanganBulan} bulan pengeluaran.`,
      };
    }
  }
}

function KotakKebutuhan({ b }: { b: Kebutuhan }) {
  return (
    <div className={`tks__butuh is-${b.jenis}`}>
      <p className="tks__butuhlabel">{b.label}</p>
      <p className="tks__butuhisi">
        <b>{b.angka}</b> <span>{b.ket}</span>
      </p>
      {b.laju && (
        <div className="tks__laju" aria-label={`${b.laju.periode}: waktu ${koma(b.laju.waktu, 0)}%, capaian ${koma(b.laju.capaian, 0)}%`}>
          <span>
            <small>{b.laju.periode} berjalan</small>
            <i style={{ "--tks-laju": `${b.laju.waktu}%` } as CSSProperties} />
            <b>{koma(b.laju.waktu, 0)}%</b>
          </span>
          <span className="is-capaian">
            <small>Capaian ketentuan</small>
            <i style={{ "--tks-laju": `${b.laju.capaian}%` } as CSSProperties} />
            <b>{koma(b.laju.capaian, 0)}%</b>
          </span>
        </div>
      )}
    </div>
  );
}

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
  langkah: number;
  pos: (v: number) => number;
  dari: (persen: number) => number;
}

/** Satu skala per pasal, cukup lebar untuk SEMUA potret dan ketentuannya —
    jadi penanda tidak pernah keluar mistar saat potret berganti. */
function skalaDari(p: Pasal, nilai: (number | null)[]): Skala {
  const ada = nilai.filter((v): v is number => v !== null);
  const puncak = Math.max(...ada, (p.maks ?? p.min) * 1.25);
  const dasar = Math.min(0, ...ada);
  const l = langkah(puncak - dasar, !!p.bulat);
  const atas = Math.ceil(puncak / l) * l;
  const bawah = Math.floor(dasar / l) * l;
  const rentang = atas - bawah || 1;
  return {
    bawah,
    atas,
    langkah: l,
    pos: (v) => Math.min(100, Math.max(0, ((v - bawah) / rentang) * 100)),
    dari: (persen) => bawah + (persen / 100) * rentang,
  };
}

const TGL = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", timeZone: "UTC" });
const TGL_PANJANG = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const BLN = new Intl.DateTimeFormat("id-ID", { month: "short", timeZone: "UTC" });
const tglPendek = (t: string) => TGL.format(new Date(`${t}T00:00:00Z`));
const tglPanjang = (t: string) => TGL_PANJANG.format(new Date(`${t}T00:00:00Z`));
const blnPendek = (b: string) => BLN.format(new Date(`${b}-01T00:00:00Z`));

/* ---- Garis ukur --------------------------------------------------------------
   Mistar berskala tiga pita: GARIS DIMENSI di pita atas (garis bertakik
   miring 45° di kedua ujung, seperti dimensi di gambar kerja, dengan jarak
   realisasi ke ketentuan tertulis di atasnya), REL di tengah (zona
   ketentuan berarsir mint, BATANG REALISASI pejal dari nol, arsir amber
   KEKURANGAN dari realisasi sampai batas ketentuan, garis batas putus-
   putus, takik potret sebelumnya, penanda realisasi), dan angka skala di
   pita bawah. Pembacaan tetikus memakai pita atas; selama tetikus di atas
   mistar, garis dimensinya mengalah. Tidak ada tulisan di dalam rel
   (jebakan #70). */
interface Dimensi {
  a: number;
  b: number;
  jenis: "kurang" | "lebih";
  teks: string;
}

function dimensiDari(pasal: Pasal, skala: Skala, nilai: number | null): Dimensi | null {
  if (nilai === null) return null;
  const x = skala.pos(nilai);
  const minX = skala.pos(pasal.min);
  if (nilai < pasal.min) return { a: x, b: minX, jenis: "kurang", teks: `kurang ${pasal.selisih(pasal.min - nilai)}` };
  if (pasal.maks !== null && nilai > pasal.maks) {
    const maksX = skala.pos(pasal.maks);
    return { a: maksX, b: x, jenis: "lebih", teks: `+${pasal.selisih(nilai - pasal.maks)} di atas rentang` };
  }
  if (nilai === pasal.min) return { a: minX, b: minX, jenis: "lebih", teks: "tepat ketentuan" };
  return { a: minX, b: x, jenis: "lebih", teks: `+${pasal.selisih(nilai - pasal.min)} dari ketentuan` };
}

function GarisUkur({
  pasal,
  skala,
  nilai,
  keadaan,
  takik,
  takikKode,
  jejak,
  diukur,
  ket,
}: {
  pasal: Pasal;
  skala: Skala;
  nilai: number | null;
  keadaan: Keadaan;
  takik: number | null;
  takikKode: string | null;
  /** Potret lain (selain yang sedang dibaca) — titiknya muncul saat baris disentuh. */
  jejak: { kode: string; tanggal: string; v: number }[];
  diukur: boolean;
  ket: ReturnType<typeof pemberiKet>;
}) {
  const baca = useRef<HTMLSpanElement>(null);
  const bacaTeks = useRef<HTMLElement>(null);
  const kotak = useRef<DOMRect | null>(null);
  const nol = skala.pos(Math.max(0, skala.bawah));
  const zonaA = skala.pos(pasal.min);
  const zonaB = pasal.maks === null ? 100 : skala.pos(pasal.maks);
  const ticks: number[] = [];
  for (let v = skala.bawah; v <= skala.atas + skala.langkah / 1000; v += skala.langkah) ticks.push(Math.round(v * 1000) / 1000);
  const x = nilai === null ? null : skala.pos(nilai);
  const isiDari = Math.min(nol, x ?? nol);
  const isiLebar = x === null ? 0 : Math.abs(x - nol);
  const dim = dimensiDari(pasal, skala, nilai);
  const langkahPersen = (skala.langkah / (skala.atas - skala.bawah || 1)) * 100;
  const bagi = pasal.bulat ? (skala.langkah > 1 && skala.langkah <= 10 ? skala.langkah : 1) : 5;
  const mm = langkahPersen / bagi;
  /* Tulisan dimensi berpusat di tengah garisnya, dijepit CSS supaya tidak
     pernah keluar mistar (lihat `.tks__dimteks`). */
  const tengah = dim ? (dim.a + dim.b) / 2 : 50;

  /* Pembacaan skala mengikuti TETIKUS (jebakan #9): kotak mistar dibaca
     sekali saat masuk, lalu tiap gerak cuma menulis transform + teks lewat
     ref — tanpa render ulang, tanpa membaca geometri di tengah gerak. */
  const masuk = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse") return;
    kotak.current = e.currentTarget.getBoundingClientRect();
    gerak(e);
  };
  const gerak = (e: React.PointerEvent<HTMLDivElement>) => {
    const k = kotak.current;
    if (e.pointerType !== "mouse" || !k || !baca.current || !bacaTeks.current) return;
    const persen = Math.min(100, Math.max(0, ((e.clientX - k.left) / k.width) * 100));
    baca.current.style.setProperty("--tks-baca", `${persen}%`);
    baca.current.dataset.tampak = "";
    baca.current.parentElement?.setAttribute("data-membaca", "");
    bacaTeks.current.textContent = pasal.skala(skala.dari(persen));
  };
  const keluar = () => {
    kotak.current = null;
    if (baca.current) {
      delete baca.current.dataset.tampak;
      baca.current.parentElement?.removeAttribute("data-membaca");
    }
  };

  return (
    <div className="tks__mistar" onPointerEnter={masuk} onPointerMove={gerak} onPointerLeave={keluar} aria-hidden="true">
      <span ref={baca} className="tks__baca">
        <b ref={bacaTeks} />
      </span>
      {dim && (
        <span className={`tks__dim is-${dim.jenis}`}>
          {dim.b - dim.a > 0.01 && <i className="tks__dimgaris" style={{ left: `${dim.a}%`, width: `${dim.b - dim.a}%` }} />}
          <b className="tks__dimteks" style={{ "--tks-x": tengah.toFixed(2) } as CSSProperties}>
            {dim.teks}
          </b>
        </span>
      )}
      <div className="tks__rel">
        <i className="tks__zona" style={{ left: `${zonaA}%`, width: `${zonaB - zonaA}%` }} />
        {x !== null && keadaan === "belum" && <i className="tks__kurang" style={{ left: `${x}%`, width: `${zonaA - x}%` }} />}
        {x !== null && (
          <i
            className={`tks__isi is-${keadaan}${diukur ? " is-diukur" : ""}`}
            style={{ left: `${isiDari}%`, width: `${isiLebar}%`, transformOrigin: x >= nol ? "left" : "right" }}
          />
        )}
        <i className="tks__batas" style={{ left: `${zonaA}%` }} />
        {pasal.maks !== null && <i className="tks__batas" style={{ left: `${zonaB}%` }} />}
        {takik !== null && (
          /* Bayangan potret sebelumnya: berlian berongga di nilainya, jadi
             arah perubahan terbaca dari jarak dua berlian. */
          <i
            className="tks__takik"
            style={{ left: `${skala.pos(takik)}%` }}
            {...ket(() => ({ judul: `Potret ${takikKode}`, baris: [{ label: pasal.judul, nilai: pasal.besar(takik) }] }))}
          />
        )}
        {jejak.map((j) => (
          <i
            key={j.kode + j.tanggal}
            className={`tks__jejakrel is-${keadaanDari(pasal, j.v)}`}
            style={{ left: `${skala.pos(j.v)}%` }}
            {...ket(() => ({
              judul: `${j.kode} · ${tglPanjang(j.tanggal)}`,
              baris: [
                { label: pasal.judul, nilai: pasal.besar(j.v) },
                { label: "Pemeriksaan", nilai: TEKS_CAP[keadaanDari(pasal, j.v)] },
              ],
            }))}
          />
        ))}
        {x !== null && nilai !== null && (
          <b
            className="tks__penanda"
            style={{ left: `${x}%` }}
            {...ket(() => ({ judul: "Realisasi", baris: [{ label: pasal.judul, nilai: pasal.besar(nilai) }] }))}
          />
        )}
      </div>
      <div className="tks__skala">
        {/* Takik kecil di antara angka skala — mistar bermilimeter. Skala
            bilangan bulat yang langkahnya 1 tidak punya takik antara. */}
        {mm < langkahPersen - 0.01 && <i className="tks__mm" style={{ "--tks-mm": `${mm}%` } as CSSProperties} />}
        {ticks.map((v, i) => {
          const pos = skala.pos(v);
          /* Takik tetap ada, tulisannya mengalah: label tengah yang terlalu
             dekat ke label ujung (rata kiri/kanan) akan bertindih di mistar
             yang sempit. */
          const ujung = i === 0 || i === ticks.length - 1;
          const bisu = !ujung && (pos < 14 || pos > 78);
          return (
            <span
              key={v}
              className={i === 0 ? "is-awal" : i === ticks.length - 1 ? "is-akhir" : bisu ? "is-bisu" : undefined}
              style={{ left: `${pos}%` }}
            >
              {bisu ? "" : pasal.skala(v)}
            </span>
          );
        })}
      </div>
    </div>
  );
}

/* ---- Tren empat potret (kolom Realisasi) -------------------------------------
   Garis K1 → K2 → K3 → Kini, pita ketentuan berarsir di belakangnya, titik amber untuk potret yang belum
   memenuhi. Berlian pejal = potret yang sedang dibaca; ia meluncur di
   sepanjang garis saat potret berganti. Tanpa tulisan di dalamnya. */
function Tren({
  pasal,
  potret,
  pilih,
  ket,
}: {
  pasal: Pasal;
  potret: Potret[];
  pilih: number;
  ket: ReturnType<typeof pemberiKet>;
}) {
  const ada = potret.map((p, i) => ({ p, i, v: p.nilai[pasal.kunci] })).filter((t): t is { p: Potret; i: number; v: number } => t.v !== null);
  /* Skala LOKAL (rentang keempat potret): di skala mistar perubahan
     antarkuartal cuma 2–3px dan garisnya terbaca datar. Pita ketentuan
     dipotong ke rentang itu — seluruhnya berarsir = semua potret di dalam
     ketentuan, tanpa arsir = semua di luar. Titik dijaga di dalam
     7–93% × 14–86% kotaknya: berlian terpilih tidak pernah keluar ke celah
     kolom atau ke tulisan di atasnya. */
  const vs = ada.map((t) => t.v);
  const lo = Math.min(...vs);
  const hi = Math.max(...vs);
  const rentang = hi - lo || Math.abs(hi) || 1;
  const x = (i: number) => 7 + (i / Math.max(1, potret.length - 1)) * 86;
  const y = (v: number) => (hi === lo ? 50 : 14 + 72 * (1 - (v - lo) / rentang));
  const zAtas = pasal.maks === null || pasal.maks >= hi ? 14 : pasal.maks <= lo ? 86 : y(pasal.maks);
  const zBawah = pasal.min <= lo ? 86 : pasal.min >= hi ? 14 : y(pasal.min);
  const kini = ada.find((t) => t.i === pilih);
  return (
    <span className="tks__tren">
      {zBawah - zAtas > 0.5 && (
        <i className="tks__trenzona" style={{ top: `${zAtas === 14 ? 0 : zAtas}%`, height: `${(zBawah === 86 ? 100 : zBawah) - (zAtas === 14 ? 0 : zAtas)}%` }} />
      )}
      {ada.length > 1 && (
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <polyline points={ada.map((t) => `${x(t.i)},${y(t.v)}`).join(" ")} vectorEffect="non-scaling-stroke" />
        </svg>
      )}
      {ada.map((t) => (
        <i
          key={t.p.kode}
          className={`tks__trentitik is-${keadaanDari(pasal, t.v)}`}
          style={{ left: `${x(t.i)}%`, top: `${y(t.v)}%` }}
          {...ket(() => ({
            judul: `${namaPotret(t.p)} · ${tglPanjang(t.p.tanggal)}`,
            baris: [
              { label: pasal.judul, nilai: pasal.besar(t.v) },
              { label: "Pemeriksaan", nilai: TEKS_CAP[keadaanDari(pasal, t.v)] },
            ],
          }))}
        />
      ))}
      {kini && <b className={`tks__trenpilih is-${keadaanDari(pasal, kini.v)}`} style={{ left: `${x(kini.i)}%`, top: `${y(kini.v)}%` }} />}
    </span>
  );
}

/* ---- Cap pemeriksaan -------------------------------------------------------- */
function Cap({ keadaan, no, kode, tercap, mini }: { keadaan: Keadaan; no: string; kode: string; tercap: boolean; mini?: boolean }) {
  return (
    <span className={`tks__cap is-${keadaan}${tercap ? " is-tercap" : ""}${mini ? " tks__cap--mini" : ""}`}>
      <b>{TEKS_CAP[keadaan]}</b>
      <small>
        §{no} · {kode}
      </small>
    </span>
  );
}

/* ---- Lampiran per pasal ------------------------------------------------------ */
function Jejak({
  baru,
  pasal,
  skala,
  potret,
  pilih,
  onPilih,
}: {
  baru: boolean;
  pasal: Pasal;
  skala: Skala;
  potret: Potret[];
  pilih: number;
  onPilih: (i: number) => void;
}) {
  const zonaA = skala.pos(pasal.min);
  const zonaB = pasal.maks === null ? 100 : skala.pos(pasal.maks);
  const nol = skala.pos(Math.max(0, skala.bawah));
  /* Garis tren di atas puncak tiang. Kolom-kolomnya berjarak PERSEN
     (`--tks-jg`), jadi pusat tiap kolom bisa dihitung tanpa mengukur DOM. */
  const jg = 2.75;
  const lebar = (100 - jg * (potret.length - 1)) / potret.length;
  const titik = potret
    .map((p, i) => ({ i, v: p.nilai[pasal.kunci] }))
    .filter((t): t is { i: number; v: number } => t.v !== null)
    .map((t) => `${(t.i * (lebar + jg) + lebar / 2).toFixed(2)},${(100 - skala.pos(t.v)).toFixed(2)}`);
  return (
    <div className={baru ? "tks__jejak is-baru" : "tks__jejak"} style={{ "--tks-jg": `${jg}%` } as CSSProperties}>
      <div className="tks__jejakbidang" aria-hidden="true">
        <i className="tks__jejakzona" style={{ bottom: `${zonaA}%`, height: `${zonaB - zonaA}%` }} />
      </div>
      {potret.map((p, i) => {
        const v = p.nilai[pasal.kunci];
        const y = v === null ? nol : skala.pos(v);
        return (
          <button
            key={p.kode}
            type="button"
            className={i === pilih ? "tks__jejakkolom is-pilih" : "tks__jejakkolom"}
            style={{ "--j": i } as CSSProperties}
            aria-pressed={i === pilih}
            aria-label={`${p.kode} ${tglPendek(p.tanggal)}: ${v === null ? "belum ada data" : pasal.besar(v)}`}
            onClick={() => onPilih(i)}
          >
            <span className="tks__jejaktiang" aria-hidden="true">
              <i style={{ bottom: `${Math.min(nol, y)}%`, height: `${Math.abs(y - nol)}%` }} />
            </span>
            <b>{v === null ? "—" : pasal.besar(v)}</b>
            <small>{p.kini ? `Kini · ${tglPendek(p.tanggal)}` : `${p.kode} · ${tglPendek(p.tanggal)}`}</small>
          </button>
        );
      })}
      {titik.length > 1 && (
        <svg className="tks__jejakgaris" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <polyline points={titik.join(" ")} vectorEffect="non-scaling-stroke" pathLength={1} />
        </svg>
      )}
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
      <h4 className="tks__sub">Sebaran kontrak {k.tahun}</h4>
      <div className="tks__sebaran" aria-hidden="true">
        <i className="tks__zona" style={{ left: `${skala.pos(t.rataKontrakMin)}%`, width: `${skala.pos(t.rataKontrakMaks) - skala.pos(t.rataKontrakMin)}%` }} />
        {urut.map((p) => (
          <i
            key={p.projectId}
            className="tks__titik"
            style={{ left: `${skala.pos(p.kontrak)}%` }}
            {...ket(() => ({ judul: p.title, baris: [{ label: "Nilai kontrak", nilai: formatRupiah(p.kontrak) }] }))}
          />
        ))}
        {k.rataKontrak.nilai !== null && <b className="tks__penanda" style={{ left: `${skala.pos(k.rataKontrak.nilai)}%` }} />}
      </div>
      <div className="tks__sebaranskala" aria-hidden="true">
        <span>{skala.bawah === 0 ? "0" : jt(skala.bawah)}</span>
        <span>{jt(skala.atas)}</span>
      </div>
      <ol className="tks__daftar">
        {urut.map((p) => (
          <li key={p.projectId}>
            <span className="tks__kode">{kodeProyek(p.title)}</span>
            <a href={`/admin/proyek/satu?id=${encodeURIComponent(p.projectId)}`}>{p.title}</a>
            <small>{p.tier ?? "Tanpa paket"}</small>
            <b className={p.kontrak < t.rataKontrakMin ? "is-belum" : undefined}>{formatRupiahRingkas(p.kontrak)}</b>
          </li>
        ))}
        {!urut.length && <li className="tks__kosong">Belum ada proyek berkontrak tahun ini.</li>}
      </ol>
    </>
  );
}

function LampiranMargin({ k, ket }: { k: KpiStrategi; ket: ReturnType<typeof pemberiKet> }) {
  const min = k.target.marginMin;
  const urut = [...k.proyek].sort((a, b) => a.margin - b.margin);
  return (
    <>
      <h4 className="tks__sub">
        Biaya terhadap kontrak <span>batas biaya {100 - min}%</span>
      </h4>
      <ol className="tks__daftar tks__daftar--batang">
        {urut.map((p) => {
          const biaya = Math.min(100, (p.biaya / p.kontrak) * 100);
          return (
            <li key={p.projectId}>
              <a href={`/admin/proyek/satu?id=${encodeURIComponent(p.projectId)}`}>{p.title}</a>
              <b className={p.margin < min ? "is-belum" : undefined}>{koma(p.margin)}%</b>
              <span
                className={p.biaya > p.kontrak ? "tks__batangbiaya is-lebih" : "tks__batangbiaya"}
                style={{ "--tks-biaya": `${biaya}%`, "--tks-garisbatas": `${100 - min}%` } as CSSProperties}
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
        {!urut.length && <li className="tks__kosong">Belum ada proyek berkontrak tahun ini.</li>}
      </ol>
      {k.segmen.length > 0 && (
        <>
          <h4 className="tks__sub">Laba kas per segmen</h4>
          <dl className="tks__segmen">
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
      <h4 className="tks__sub">Status pesan kuartal {k.kuartal}</h4>
      <ol className="tks__daftar tks__daftar--status">
        {STATUS_LEAD.map((s) => (
          <li key={s.kunci}>
            <span>{s.label}</span>
            <span className="tks__batangpenuh" aria-hidden="true">
              <i
                className={s.kunci === "contacted" || s.kunci === "qualified" ? "is-lanjut" : undefined}
                style={{ width: `${(k.lead.status[s.kunci] / total) * 100}%` }}
              />
            </span>
            <b>{k.lead.status[s.kunci]}</b>
          </li>
        ))}
      </ol>
      <h4 className="tks__sub">
        Per bulan <span>laju ketentuan {koma(perBulanMin)}–{koma(perBulanMaks)}</span>
      </h4>
      <div className="tks__bulan" aria-label="Pesan masuk per bulan kuartal ini">
        <div className="tks__bidangtiang" aria-hidden="true">
          <i className="tks__bulanzona" style={{ bottom: `${(perBulanMin / puncak) * 100}%`, height: `${((perBulanMaks - perBulanMin) / puncak) * 100}%` }} />
        </div>
        {k.lead.perBulan.map((b) => (
          <div key={b.bulan} className="tks__bulankolom">
            <span className="tks__bulantiang" aria-hidden="true">
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
      <h4 className="tks__sub">
        Tangga paket {k.tahun} <span>arsir = Signature ke atas</span>
      </h4>
      <div className="tks__tangga">
        {kelompok
          .filter((g) => g.anak.length)
          .map((g) => (
            <div key={g.kunci} className="tks__tanggakelompok">
              <p>{g.label}</p>
              <ol>
                {g.anak.map((t, i) => (
                  <li
                    key={t.nama}
                    className={t.urutan >= 2 ? "is-atas" : undefined}
                    style={{ "--tks-anak": i + 1, "--tks-anak-n": g.anak.length } as CSSProperties}
                  >
                    <span className="tks__tanggajumlah">{t.jumlah}</span>
                    <span className="tks__tanggaanak" aria-hidden="true" />
                    <small>{t.nama}</small>
                  </li>
                ))}
              </ol>
            </div>
          ))}
      </div>
      <ol className="tks__daftar">
        {k.signature.proyek.map((p) => (
          <li key={p.projectId}>
            <span className="tks__kode">{kodeProyek(p.title)}</span>
            <a href={`/admin/proyek/satu?id=${encodeURIComponent(p.projectId)}`}>{p.title}</a>
            <small>{p.tier}</small>
          </li>
        ))}
        {!k.signature.proyek.length && <li className="tks__kosong">Belum ada proyek Signature ke atas tahun ini.</li>}
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
      <p className="tks__hasil">
        <b className={c.bulan !== null && c.bulan < target ? "is-belum" : undefined}>
          {c.bulan === null ? "—" : c.saldo <= 0 ? "Saldo minus" : `${koma(c.bulan)} bulan`}
        </b>
        <span>dari {target} bulan ketentuan</span>
      </p>
      <p className="tks__rumus">
        {formatRupiah(c.saldo)} <em>÷</em> {c.keluarPerBulan === null ? "—" : `${formatRupiah(c.keluarPerBulan)}/bln`}
      </p>
      <p className="tks__rumusket">Saldo catatan panel ÷ rata-rata keluar {c.bulanBerdata} bulan berdata</p>
      <div className="tks__landasan" aria-label={`Cadangan ${c.bulan === null ? "belum ada data" : koma(c.bulan)} dari ${target} bulan`}>
        {Array.from({ length: n }, (_, i) => {
          const isi = c.bulan === null ? 0 : Math.min(1, Math.max(0, c.bulan - i));
          return (
            <span
              key={i}
              className={`tks__landasanbulan${i < target ? " is-wajib" : ""}${i + 1 === target ? " is-batas" : ""}`}
            >
              <i style={{ width: `${isi * 100}%` }} />
              <small>{i + 1}</small>
            </span>
          );
        })}
      </div>
      <h4 className="tks__sub">
        Keluar per bulan <span>putus = rata-rata</span>
      </h4>
      <div className="tks__keluar">
        <div className="tks__bidangtiang" aria-hidden="true">
          {c.keluarPerBulan !== null && <i className="tks__rata" style={{ bottom: `${(c.keluarPerBulan / puncak) * 100}%` }} />}
        </div>
        {bulanan.map((b) => (
          <div
            key={b.bulan}
            className="tks__keluarkolom"
            {...ket(() => ({ judul: blnPendek(b.bulan), baris: [{ label: "Uang keluar", nilai: formatRupiah(b.keluar) }] }))}
          >
            <span className="tks__bulantiang" aria-hidden="true">
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
      <div className="tks">
        <div className="tks__papan tks__papan--galat">
          <p>KPI tidak bisa dimuat: {galat}</p>
        </div>
      </div>
    ) : (
      <Rangka />
    );
  }
  return <Tabel k={k} studio={studio} />;
}

function Rangka() {
  return (
    <div className="tks" aria-busy="true">
      <div className="tks__papan">
        <div className="tks__kertas tks__kertas--rangka" />
        <div className="tks__kertas tks__kertas--rangka tks__lampiran" />
      </div>
    </div>
  );
}

function Tabel({ k, studio }: { k: KpiStrategi; studio: StudioSettings | null }) {
  const pasal = useMemo(() => pasalDari(k), [k]);
  const potret = useMemo(() => potretDari(k), [k]);
  const skala = useMemo(
    () => Object.fromEntries(pasal.map((p) => [p.kunci, skalaDari(p, potret.map((x) => x.nilai[p.kunci]))])) as Record<Kunci, Skala>,
    [pasal, potret],
  );
  /* Keadaan tiap pasal di TIAP potret — dipakai pip tombol potret, kotak
     skor, riwayat cap, dan kesimpulan. */
  const keadaanPer = useMemo(
    () => potret.map((x) => Object.fromEntries(pasal.map((p) => [p.kunci, keadaanDari(p, x.nilai[p.kunci])])) as Record<Kunci, Keadaan>),
    [pasal, potret],
  );
  const kini = potret.length - 1;
  const [pilihPotret, setPilihPotret] = useState(kini);
  /* Bawaan: pasal pertama yang BELUM memenuhi — halaman membuka yang perlu
     diperhatikan. */
  const [pilihPasal, setPilihPasal] = useState<Kunci>(
    () => pasal.find((p) => keadaanDari(p, potret[kini]!.nilai[p.kunci]) === "belum")?.kunci ?? "kontrak",
  );
  /* Gerak hanya sesudah perbuatan (jebakan #74): `hidup` menyala sesudah
     bingkai pertama, `diukur` dan `tercap` hanya dipasang oleh klik. */
  const [hidup, setHidup] = useState(false);
  const [diukur, setDiukur] = useState<Kunci | null>(null);
  const [tercap, setTercap] = useState<{ kunci: Set<Kunci>; putaran: number }>({ kunci: new Set(), putaran: 0 });
  const [lampiranBaru, setLampiranBaru] = useState(0);
  const waktu = useRef<number[]>([]);
  const kabar: KabarKartu = useRef(null);
  const ket = pemberiKet(kabar);
  const idLampiran = useId();
  const tabRef = useRef<(HTMLButtonElement | null)[]>([]);
  const papanRef = useRef<HTMLDivElement>(null);
  const tabelRef = useRef<HTMLElement>(null);
  const lampiranRef = useRef<HTMLElement>(null);
  const [tunjuk, setTunjuk] = useState<{ x: number; y: number; w: number } | null>(null);

  useEffect(() => {
    let b2 = 0;
    const b1 = requestAnimationFrame(() => (b2 = requestAnimationFrame(() => setHidup(true))));
    return () => {
      cancelAnimationFrame(b1);
      cancelAnimationFrame(b2);
      waktu.current.forEach((w) => window.clearTimeout(w));
    };
  }, []);

  /* Penunjuk lampiran: garis penunjuk dari tepi kanan baris yang dipilih ke
     lembar lampiran, seperti garis penunjuk detail di gambar kerja. Letaknya
     diukur saat pilihan atau ukuran papan berubah — tidak pernah saat
     menggulir (jebakan #21). Hanya kalau lampiran DI SAMPING tabel. */
  useLayoutEffect(() => {
    const papan = papanRef.current;
    if (!papan) return;
    const ukur = () => {
      const tb = tabelRef.current?.getBoundingClientRect();
      const lp = lampiranRef.current?.getBoundingClientRect();
      const baris = tabRef.current[pasal.findIndex((p) => p.kunci === pilihPasal)]?.parentElement?.getBoundingClientRect();
      const pp = papan.getBoundingClientRect();
      if (!tb || !lp || !baris || lp.left < tb.right) return setTunjuk(null);
      setTunjuk({ x: tb.right - pp.left, y: baris.top + baris.height / 2 - pp.top, w: lp.left - tb.right });
    };
    ukur();
    const ro = new ResizeObserver(ukur);
    ro.observe(papan);
    return () => ro.disconnect();
  }, [pilihPasal, pasal]);

  const tunda = (f: () => void, ms: number) => {
    waktu.current.push(window.setTimeout(f, ms));
  };

  /* Memilih potret = pemeriksaan ulang. Semua bergerak SERENTAK — penanda,
     batang, garis dimensi, angka, tren — lalu hanya pasal yang keadaannya
     BERUBAH yang dicap ulang. */
  const pilihSnap = (i: number) => {
    if (i === pilihPotret) return;
    const berubah = new Set(pasal.filter((p) => keadaanPer[i]![p.kunci] !== keadaanPer[pilihPotret]![p.kunci]).map((p) => p.kunci));
    setPilihPotret(i);
    if (geraknya() && berubah.size) {
      setTercap((c) => ({ kunci: berubah, putaran: c.putaran + 1 }));
      tunda(() => setTercap((c) => ({ kunci: new Set(), putaran: c.putaran })), CAP_SESUDAH + 700);
    }
  };

  const pilihP = (kunci: Kunci) => {
    if (kunci === pilihPasal) return;
    setPilihPasal(kunci);
    if (geraknya()) {
      setDiukur(kunci);
      setLampiranBaru((n) => n + 1);
      tunda(() => setDiukur((d) => (d === kunci ? null : d)), 800);
    }
  };

  const tombolTab = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const n = pasal.length;
    const ke =
      e.key === "ArrowDown" ? (i + 1) % n : e.key === "ArrowUp" ? (i - 1 + n) % n : e.key === "Home" ? 0 : e.key === "End" ? n - 1 : null;
    if (ke === null) return;
    e.preventDefault();
    pilihP(pasal[ke]!.kunci);
    tabRef.current[ke]?.focus();
  };

  const tombolSnap = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const n = potret.length;
    const ke =
      e.key === "ArrowRight" ? Math.min(n - 1, i + 1) : e.key === "ArrowLeft" ? Math.max(0, i - 1) : e.key === "Home" ? 0 : e.key === "End" ? n - 1 : null;
    if (ke === null) return;
    e.preventDefault();
    pilihSnap(ke);
    (e.currentTarget.parentElement?.children[ke] as HTMLElement | undefined)?.focus();
  };

  const snap = potret[pilihPotret]!;
  const sebelum = pilihPotret > 0 ? potret[pilihPotret - 1]! : null;
  const keadaan = keadaanPer[pilihPotret]!;
  const hitungLulus = (kd: Record<Kunci, Keadaan>) => pasal.filter((p) => lulus(kd[p.kunci])).length;
  const memenuhi = hitungLulus(keadaan);
  const bedaSkor = sebelum ? memenuhi - hitungLulus(keadaanPer[pilihPotret - 1]!) : null;
  const belum = pasal.filter((p) => keadaan[p.kunci] === "belum");
  const kosong = pasal.filter((p) => keadaan[p.kunci] === "kosong");
  const daftar = daftarLembar().halaman;
  const aktif = pasal.find((p) => p.kunci === pilihPasal)!;
  const sumber = lembarUntuk(aktif.sumber, daftar)?.lembar ?? null;
  const kodeCap = snap.kini ? `K${snap.kuartal}` : snap.kode;
  const nama = studio?.studioName ?? "studio";
  const paraf = nama
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]!.toUpperCase())
    .join("");

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

  /* Pip keadaan per potret — dipakai di tombol potret dan salinannya. */
  const pip = (i: number) => (
    <span className="tks__pip" aria-hidden="true">
      {pasal.map((p) => (
        <i key={p.kunci} className={`is-${keadaanPer[i]![p.kunci]}`} />
      ))}
    </span>
  );

  return (
    <div className={hidup ? "tks is-hidup" : "tks"}>
      <div className="tks__papan" ref={papanRef}>
        <section className="tks__kertas tks__tabel" aria-labelledby="tks-judul" ref={tabelRef}>
          <header className="tks__kop">
            <div className="tks__kopjudul">
              <p>Dokumen strategi bisnis · Pasal 8</p>
              <h2 id="tks-judul">Tabel kesesuaian</h2>
              <p className="tks__kopsub">Ketentuan strategi studio terhadap realisasi {snap.tahun}</p>
            </div>
            <div className="tks__periksa">
              <p id="tks-periksa">Diperiksa per</p>
              <div
                className="tks__potret"
                role="radiogroup"
                aria-labelledby="tks-periksa"
                style={{ "--tks-n": potret.length, "--tks-ke": pilihPotret } as CSSProperties}
              >
                {potret.map((p, i) => (
                  <button
                    key={p.kode}
                    type="button"
                    role="radio"
                    aria-checked={i === pilihPotret}
                    tabIndex={i === pilihPotret ? 0 : -1}
                    className={i === pilihPotret ? "is-pilih" : undefined}
                    onClick={() => pilihSnap(i)}
                    onKeyDown={(e) => tombolSnap(e, i)}
                  >
                    <b>{p.kini ? "Kini" : `${p.kode} ${String(p.tahun).slice(2)}`}</b>
                    <small>{tglPendek(p.tanggal)}</small>
                    {pip(i)}
                    <span className="sr-only">, {hitungLulus(keadaanPer[i]!)} dari {pasal.length} pasal memenuhi</span>
                  </button>
                ))}
                {/* Sesudah tombol-tombolnya: indeks anak = indeks potret (papan ketik).
                    Pita pilihan MEMBAWA salinan label bertinta kertas yang diam
                    di tempatnya, jadi tulisan di bawah pita selalu terbaca —
                    juga selama pita meluncur dan baru separuh menutupi tombol. */}
                <i className="tks__potretgeser" aria-hidden="true">
                  <span className="tks__potretsalin">
                    {potret.map((p, i) => (
                      <span key={p.kode}>
                        <b>{p.kini ? "Kini" : `${p.kode} ${String(p.tahun).slice(2)}`}</b>
                        <small>{tglPendek(p.tanggal)}</small>
                        {pip(i)}
                      </span>
                    ))}
                  </span>
                </i>
              </div>
            </div>
            <div
              className="tks__tally"
              aria-label={`${memenuhi} dari ${pasal.length} pasal memenuhi${
                bedaSkor ? `, ${bedaSkor > 0 ? "naik" : "turun"} ${Math.abs(bedaSkor)} dari ${namaPotret(sebelum!)}` : ""
              }`}
            >
              <span className="tks__tallyangka">
                <Hitung nilai={memenuhi} hidup={hidup} format={(v) => koma(Math.round(v), 0)} />
                <em>/{pasal.length}</em>
                {bedaSkor !== null && bedaSkor !== 0 && (
                  <i className={bedaSkor > 0 ? "tks__tallybeda is-naik" : "tks__tallybeda is-turun"} aria-hidden="true">
                    {bedaSkor > 0 ? "▲" : "▼"}
                    {Math.abs(bedaSkor)}
                  </i>
                )}
              </span>
              <span className="tks__tallyket">
                <small>pasal memenuhi</small>
                {/* Satu sel per pasal, berwarna keadaannya. */}
                <span className="tks__tallysel" aria-hidden="true">
                  {pasal.map((p) => (
                    <i
                      key={p.kunci}
                      className={`is-${keadaan[p.kunci]}`}
                      {...ket(() => ({
                        judul: `§${p.no} ${p.judul}`,
                        baris: [
                          { label: "Realisasi", nilai: snap.nilai[p.kunci] === null ? "—" : p.besar(snap.nilai[p.kunci]!) },
                          { label: "Pemeriksaan", nilai: TEKS_CAP[keadaan[p.kunci]] },
                        ],
                      }))}
                    />
                  ))}
                </span>
              </span>
            </div>
          </header>

          {/* Tabel bergaris kolom seperti tabel cetak: kepala bernomor (1)–(5)
              dan garis tegak di tengah tiap celah kolom, menembus kepala dan
              kelima baris — garisnya hidup di lapisan sendiri, di celah yang
              tidak memuat tulisan (jebakan #70). */}
          <div className="tks__lajur">
            <div className="tks__kolomgaris" aria-hidden="true">
              {[0, 1, 2, 3, 4].map((i) => (
                <i key={i} />
              ))}
            </div>
            <div className="tks__kepala" aria-hidden="true">
              {["Pasal", "Uraian & ketentuan", "Garis ukur", "Realisasi", "Pemeriksaan"].map((judul, i) => (
                <span key={judul}>
                  <i>{i + 1}</i>
                  {judul}
                </span>
              ))}
            </div>

            <div className="tks__pasal" role="tablist" aria-orientation="vertical" aria-label="Pasal KPI">
              {pasal.map((p, i) => {
                const v = snap.nilai[p.kunci];
                const lalu = sebelum?.nilai[p.kunci] ?? null;
                const beda = v !== null && lalu !== null ? v - lalu : null;
                const dipilih = p.kunci === pilihPasal;
                const riwayat = riwayatDari(p, potret, pilihPotret);
                return (
                  <div key={p.kunci} className={`tks__baris is-${keadaan[p.kunci]}${dipilih ? " is-pilih" : ""}`}>
                    <button
                      ref={(el) => {
                        tabRef.current[i] = el;
                      }}
                      type="button"
                      role="tab"
                      id={`tks-tab-${p.kunci}`}
                      aria-selected={dipilih}
                      aria-controls={idLampiran}
                      tabIndex={dipilih ? 0 : -1}
                      className="tks__pilih"
                      onClick={() => pilihP(p.kunci)}
                      onKeyDown={(e) => tombolTab(e, i)}
                    >
                      <span className="sr-only">
                        §{p.no} {p.judul}: {v === null ? "belum ada data" : p.besar(v)}, {TEKS_CAP[keadaan[p.kunci]]}
                        {riwayat ? ` (${riwayat})` : ""}
                      </span>
                    </button>
                    <span className="tks__no" aria-hidden="true">
                      <b>§{p.no}</b>
                      <small>{lembarUntuk(p.sumber, daftar)?.lembar.kode ?? ""}</small>
                    </span>
                    <span className="tks__uraian" aria-hidden="true">
                      <b>{p.judul}</b>
                      <small>{p.ketentuan(k)}</small>
                    </span>
                    <div className="tks__ukur" onClick={() => pilihP(p.kunci)}>
                      <GarisUkur
                        pasal={p}
                        skala={skala[p.kunci]}
                        nilai={v}
                        keadaan={keadaan[p.kunci]}
                        takik={lalu}
                        takikKode={sebelum ? namaPotret(sebelum) : null}
                        jejak={potret
                          .filter((x, j) => j !== pilihPotret && x.nilai[p.kunci] !== null)
                          .map((x) => ({ kode: namaPotret(x), tanggal: x.tanggal, v: x.nilai[p.kunci]! }))}
                        diukur={diukur === p.kunci}
                        ket={ket}
                      />
                    </div>
                    <span className="tks__nilai" aria-hidden="true">
                      {v === null ? <b>—</b> : <Hitung nilai={v} hidup={hidup} format={p.besar} className="tks__angka" />}
                      <small className={beda === null ? undefined : beda > 0 ? "is-naik" : beda < 0 ? "is-turun" : undefined}>
                        {beda === null
                          ? sebelum
                            ? `—`
                            : `per ${tglPendek(snap.tanggal)}`
                          : beda === 0
                            ? `tetap dari ${namaPotret(sebelum!)}`
                            : `${beda > 0 ? "▲" : "▼"} ${p.selisih(beda)} dari ${namaPotret(sebelum!)}`}
                      </small>
                      <Tren pasal={p} potret={potret} pilih={pilihPotret} ket={ket} />
                    </span>
                    <span
                      className="tks__periksasel"
                      aria-hidden="true"
                      style={{ "--tks-putar": `${PUTAR_CAP[i % PUTAR_CAP.length]}deg` } as CSSProperties}
                    >
                      <Cap
                        key={`${keadaan[p.kunci]}-${tercap.kunci.has(p.kunci) ? tercap.putaran : 0}`}
                        keadaan={keadaan[p.kunci]}
                        no={p.no}
                        kode={kodeCap}
                        tercap={tercap.kunci.has(p.kunci)}
                      />
                      {riwayat && <small className={riwayat.startsWith("baru") ? "tks__riwayat is-baru" : "tks__riwayat"}>{riwayat}</small>}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <footer className="tks__kaki">
            {/* Kesimpulan pemeriksaan — tabel kesesuaian di gambar izin selalu
                ditutup satu kalimat putusan. Pasal yang belum memenuhi bisa
                diklik untuk membuka lampirannya. */}
            <p className={belum.length ? "tks__simpul is-belum" : "tks__simpul"}>
              <b>Kesimpulan</b>
              {belum.length === 0 && kosong.length === 0 ? (
                <span>seluruh {pasal.length} pasal memenuhi ketentuan.</span>
              ) : (
                <span>
                  {memenuhi} dari {pasal.length} pasal memenuhi
                  {belum.length > 0 && (
                    <>
                      {" · perlu tindakan "}
                      {belum.map((p, j) => (
                        <span key={p.kunci}>
                          {j > 0 && ", "}
                          <button type="button" className="tks__simpulpasal" onClick={() => pilihP(p.kunci)}>
                            §{p.no}
                            {belum.length === 1 ? ` ${p.judul}` : ""}
                          </button>
                        </span>
                      ))}
                    </>
                  )}
                  {kosong.length > 0 && ` · ${kosong.length} belum ada data`}
                </span>
              )}
            </p>
            <span className="tks__diperiksa">
              <i className="tks__paraf" aria-hidden="true">
                {paraf || "—"}
              </i>
              Diperiksa {nama} · {tglPanjang(snap.tanggal)}
            </span>
            <span className="tks__legendabaris">
              <span className="tks__legenda">
                <i className="tks__lg-zona" /> zona ketentuan
              </span>
              <span className="tks__legenda">
                <i className="tks__lg-penanda" /> realisasi
              </span>
              {sebelum && (
                <span className="tks__legenda">
                  <i className="tks__lg-takik" /> potret {namaPotret(sebelum)}
                </span>
              )}
              {pasal.some((p) => keadaan[p.kunci] === "belum") && (
                <span className="tks__legenda">
                  <i className="tks__lg-kurang" /> kekurangan
                </span>
              )}
              <span className="tks__legenda">
                <i className="tks__lg-dim" /> jarak ke ketentuan
              </span>
              <span className="tks__legenda">
                <svg className="tks__lg-tren" width="18" height="8" viewBox="0 0 18 8" aria-hidden="true">
                  <polyline points="1,6.5 6,3.5 11,5 17,1.5" />
                </svg>
                tren {namaPotret(potret[0]!)}–Kini
              </span>
            </span>
          </footer>
        </section>

        {tunjuk && (
          <i
            className={`tks__tunjuk is-${keadaan[aktif.kunci]}`}
            style={{ left: tunjuk.x, top: tunjuk.y, width: tunjuk.w } as CSSProperties}
            aria-hidden="true"
          />
        )}

        <section
          className="tks__kertas tks__lampiran"
          id={idLampiran}
          role="tabpanel"
          aria-labelledby={`tks-tab-${aktif.kunci}`}
          ref={lampiranRef}
        >
          <header className="tks__lampirankop">
            <div className="tks__lampiranatas">
              <p>Lampiran §{aktif.no}</p>
              <Cap key={`${aktif.kunci}-${keadaan[aktif.kunci]}`} keadaan={keadaan[aktif.kunci]} no={aktif.no} kode={kodeCap} tercap={false} mini />
            </div>
            <h3>{aktif.judul}</h3>
            {sumber && (
              <a className="tks__sumber" href={sumber.href}>
                Sumber · <b>{sumber.kode}</b> {sumber.label}
              </a>
            )}
          </header>
          <Jejak
            key={`jejak-${aktif.kunci}-${lampiranBaru}`}
            baru={lampiranBaru > 0}
            pasal={aktif}
            skala={skala[aktif.kunci]}
            potret={potret}
            pilih={pilihPotret}
            onPilih={pilihSnap}
          />
          <KotakKebutuhan b={kebutuhanDari(aktif, k)} />
          {/* Kunci BERBEDA dari jejak di atasnya: dua saudara berkunci sama
              membuat React tidak pernah membuang yang lama — lampiran
              sempat memuat dua blok jejak sesudah pasal diganti. */}
          <div key={`isi-${aktif.kunci}-${lampiranBaru}`} className={lampiranBaru ? "tks__lampiranisi is-baru" : "tks__lampiranisi"}>
            {lampiran}
          </div>
          <p className="tks__lampirankaki">Rincian per {tglPanjang(k.hariIni)}</p>
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
