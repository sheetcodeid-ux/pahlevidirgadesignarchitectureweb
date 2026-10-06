import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { RequireAuth } from "./RequireAuth";
import { ToastProvider, useToast } from "../kit/Toast";
import { Tombol } from "../kit/Tombol";
import { Busur, type IrisBusur } from "../kit/Ukuran";
import { KartuGrafik, type BarisKartu } from "../kit/kartuGrafik";
import { Ikon, type DataIkon } from "../kit/Ikon";
import { Medal, NavReceipt, NavSquaresFour, Ruler, SpecialCube, SpecialListNumbers } from "../kit/ikon";
import { PenandaSimpan } from "./situsKit";
import { SelTahap } from "./timProyekKit";
import {
  ambilAturanFee,
  ambilSettings,
  bacaCache,
  daftarPaket,
  simpanAturanFee,
  tulisCache,
  LABEL_PERAN,
  URUTAN_PERAN,
  type AturanFee,
  type BarisSlip,
  type PenugasanTim,
  type PeranTim,
  type TahapBayaran,
} from "../../lib/admin";
import type { Paket } from "../../lib/api";
import { formatRupiah } from "../../lib/format";
import { useCegahPindah } from "../../lib/cegahPindah";
import { keteranganFee } from "../../lib/pdfProyek";

/* =============================================================================
   Aturan Fee Tim — PAPAN ALIRAN FEE.

   Halaman ini menjawab satu pertanyaan: "uang fee design satu proyek
   mengalir ke siapa, berapa, dan kapan?" Jadi bentuknya diagram aliran
   (Sankey) di bidang hijau tua — bidang uang kit, sama dengan kartu kas:

     fee design ──▶ tiap peran ──▶ saat DP masuk / saat Finish

   Lebar tiap pita = uangnya. Persen peran DIKETIK di kartu perannya di
   tengah diagram, dan belahan DP/Finish DISERET di kolom kanan — aturan dan
   akibatnya ada di satu gambar. Di bawahnya: jatah bonus (Busur kit), lalu
   dua tempat aturan ini benar-benar muncul, digambar dengan kode ASLINYA:
   baris Tim & Bayaran di Satu Proyek (`SelTahap`) dan baris fee slip gaji
   (`keteranganFee`).

   Kerangka lembar Akun/Info Studio SENGAJA tidak dipakai — lihat
   "Selera pemilik" di CLAUDE.md.

   Angka di Excel pemilik: Drafter 10%, Render 5%, "FEE BONUS 10%", dan "5%
   dulu, sisa tunggu design selesai". Leader dan Estimator SENGAJA kosong —
   jawaban pemilik "belum ditentukan". Kosong BUKAN nol: nol berarti "peran
   ini tidak dibayar", kosong berarti "belum diputuskan".

   Siapa yang terpengaruh kalau angkanya diubah:
   - persen peran → penugasan BARU, dan penugasan lama yang persennya kosong.
     Persen yang sudah ditentukan dibekukan saat orang ditugaskan.
   - bagian tahap awal → semua tahap yang BELUM dibayar.
   - jatah bonus → pembanding saja, tidak membatasi apa pun.
   ============================================================================= */

const KUNCI_PCT: Record<PeranTim, "pctLeader" | "pctDrafter" | "pctRender" | "pctEstimator"> = {
  leader: "pctLeader",
  drafter: "pctDrafter",
  render: "pctRender",
  estimator: "pctEstimator",
};

const IKON_PERAN: Record<PeranTim, DataIkon> = {
  leader: Medal,
  drafter: Ruler,
  render: SpecialCube,
  estimator: SpecialListNumbers,
};

/* Warna peran di kartu PUTIH (Busur, pratinjau) — tangga donat kit, urutan
   yang sama dengan ubin peran di Satu Proyek. Di bidang hijau tua warnanya
   tangga sendiri (`--atf-<peran>` di CSS), karena hijau tua di atas hijau
   tua tidak kelihatan. */
const RAMP: Record<PeranTim, string> = {
  leader: "var(--ramp-1)",
  drafter: "var(--ramp-2)",
  render: "var(--ramp-5)",
  estimator: "var(--ramp-4)",
};

type Isi = Record<PeranTim | "pool" | "awal", string>;

const keTeks = (n: number | null) => (n === null ? "" : String(n).replace(".", ","));
/** "" → null; teks yang bukan angka → NaN (ditolak sebelum dikirim). */
function keAngka(s: string): number | null {
  const t = s.trim();
  if (!t) return null;
  const n = Number(t.replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
}
const pctTampil = (n: number) => n.toLocaleString("id-ID", { maximumFractionDigits: 2 });
const sah = (n: number | null): n is number => n !== null && !Number.isNaN(n);
const rupiahDari = (s: string) => Number(s.replace(/\D/g, "")) || 0;
const titik = (n: number) => (n ? n.toLocaleString("id-ID") : "");

function dariAturan(a: AturanFee): Isi {
  return {
    leader: keTeks(a.pctLeader),
    drafter: keTeks(a.pctDrafter),
    render: keTeks(a.pctRender),
    estimator: keTeks(a.pctEstimator),
    pool: keTeks(a.poolPct),
    awal: keTeks(a.firstTranchePct),
  };
}

/* --- Geometri diagram ----------------------------------------------------------
   Satu tempat menghitung letak SEMUA bagian — kartu peran (HTML) dan pita
   (SVG) membaca angka yang sama, jadi keduanya mustahil meleset satu sama
   lain dan tidak ada yang perlu diukur dari DOM. */
const T = 248; // tinggi bidang diagram, px
const CELAH_PERAN = 8;
const MIN_PERAN = 44; // kartu peran terpendek: nama + rupiah + isian
const CELAH_TAHAP = 12;

interface Blok { r: PeranTim; v: number | null; y: number; h: number }

/** Kartu peran: tiap kartu minimal 44px, sisanya dibagi menurut persen.
 *  Pemetaannya afin, bukan sebanding murni — kartu 0,5% tetap harus muat
 *  isiannya. Yang sebanding PERSIS adalah irisan di batang fee dan di node
 *  tahap; pitanya menyempit-melebar di antara keduanya. */
function tataPeran(nilai: Record<PeranTim, number | null>, total: number): Blok[] {
  const n = URUTAN_PERAN.length;
  const sisa = T - CELAH_PERAN * (n - 1) - MIN_PERAN * n;
  const tinggi = URUTAN_PERAN.map((r) => MIN_PERAN + (nilai[r] !== null && total > 0 ? (sisa * nilai[r]!) / total : 0));
  const pakai = tinggi.reduce((a, b) => a + b, 0) + CELAH_PERAN * (n - 1);
  let y = Math.max(0, (T - pakai) / 2);
  return URUTAN_PERAN.map((r, i) => {
    const b = { r, v: nilai[r], y, h: tinggi[i]! };
    y += tinggi[i]! + CELAH_PERAN;
    return b;
  });
}

/** Pita dari [a0,a1] di kiri ke [b0,b1] di kanan, di kotak 100×T yang
 *  direntangkan (`preserveAspectRatio="none"`) — cuma isian, tanpa garis,
 *  jadi rentangan mendatarnya tidak merusak apa pun. */
const pita = (a0: number, a1: number, b0: number, b1: number) =>
  `M0 ${a0}C50 ${a0} 50 ${b0} 100 ${b0}L100 ${b1}C50 ${b1} 50 ${a1} 0 ${a1}Z`;

/** Penugasan contoh untuk pratinjau — bentuk data yang SAMA dengan yang
 *  dipakai Satu Proyek, jadi `SelTahap` menggambarnya persis seperti di sana:
 *  tahap awal jatuh tempo (DP sudah masuk), tahap akhir menunggu Finish. */
function penugasanContoh(r: PeranTim, pct: number | null, fee: number, awal: number): PenugasanTim {
  const hak = pct === null ? null : Math.round((fee * pct) / 100);
  const t1 = hak === null ? null : Math.round((hak * awal) / 100);
  const tahap = (jenis: TahapBayaran["tahap"], nominal: number | null, keadaan: TahapBayaran["keadaan"]): TahapBayaran => ({
    tahap: jenis, nominal, keadaan, costId: null, dibayar: null, dibayarPada: null,
  });
  return {
    id: `contoh-${r}`, projectId: "contoh", projectTitle: "Contoh", teamMemberId: "", teamMemberName: LABEL_PERAN[r],
    teamMemberKind: "", role: r, pct, pctBerlaku: pct, note: null, feeDesign: fee, hak, dibayar: 0, terutang: hak,
    tahap: hak === null
      ? [tahap("awal", null, "belum_ditentukan"), tahap("akhir", null, "belum_ditentukan")]
      : [tahap("awal", t1, "jatuh_tempo"), tahap("akhir", hak - t1!, "menunggu")],
  };
}

/** Garis tengah sebuah pita — jalur titik "uang mengalir" saat disorot. */
const alir = (a: number, b: number) => `M0 ${a}C50 ${a} 50 ${b} 100 ${b}`;

/* Kartu keterangan pita. State-nya milik komponen kecil ini sendiri, bukan
   milik Halaman: kursor yang bergerak di atas pita memperbarui posisinya
   tiap gerakan, dan yang perlu digambar ulang cuma kartu ini — bukan seluruh
   diagram beserta tabel pratinjaunya. Halaman memanggilnya lewat ref. */
interface InfoPita { x: number; y: number; judul: string; baris: BarisKartu[] }
type KabarPita = RefObject<((i: InfoPita | null) => void) | null>;

function KartuPita({ kabar }: { kabar: KabarPita }) {
  const [info, setInfo] = useState<InfoPita | null>(null);
  useEffect(() => {
    kabar.current = setInfo;
    return () => { kabar.current = null; };
  }, [kabar]);
  return info ? <KartuGrafik x={info.x} y={info.y} judul={info.judul} baris={info.baris} /> : null;
}

/** Isian persen kecil: angka tebal, "%" di kanan. */
function IsianPersen({ label, nilai, onUbah, kosong = "—", kelas }: {
  label: string; nilai: string; onUbah: (v: string) => void; kosong?: string; kelas?: string;
}) {
  return (
    <span className={`atf__pct${kelas ? ` ${kelas}` : ""}`}>
      <input aria-label={label} inputMode="decimal" placeholder={kosong} value={nilai} onChange={(e) => onUbah(e.currentTarget.value)} />
      <span aria-hidden="true">%</span>
    </span>
  );
}

/** Belahan DP/Finish: penanda yang diseret naik-turun di antara dua node.
 *  role="slider" sungguhan — panah, PageUp/PageDown, Home/End — dan tetikus
 *  maupun jari lewat pointer capture. Kotaknya dibaca SEKALI saat ditekan,
 *  bukan di tiap gerakan (jebakan #21). */
function PembagiTahap({ awal, onUbah }: { awal: number; onUbah: (v: number) => void }) {
  const tarik = useRef<{ atas: number } | null>(null);
  const dari = (clientY: number) => {
    const t = tarik.current;
    if (!t) return;
    const v = ((clientY - t.atas - CELAH_TAHAP / 2) / (T - CELAH_TAHAP)) * 100;
    onUbah(Math.min(100, Math.max(0, Math.round(v / 5) * 5)));
  };
  const y = (awal / 100) * (T - CELAH_TAHAP) + CELAH_TAHAP / 2;
  return (
    <div
      className="atf__seret"
      onPointerDown={(e) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        tarik.current = { atas: e.currentTarget.getBoundingClientRect().top };
        e.currentTarget.querySelector<HTMLElement>("[role=slider]")?.focus();
        dari(e.clientY);
      }}
      onPointerMove={(e) => dari(e.clientY)}
      onPointerUp={() => { tarik.current = null; }}
      onPointerCancel={() => { tarik.current = null; }}
    >
      <span
        role="slider"
        tabIndex={0}
        className="atf__pegangan"
        style={{ top: y }}
        aria-label="Bagian tahap awal, geser"
        aria-orientation="vertical"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={awal}
        aria-valuetext={`${pctTampil(awal)} persen saat DP masuk, ${pctTampil(100 - awal)} persen saat Finish`}
        onKeyDown={(e) => {
          const langkah: Record<string, number> = { ArrowDown: 5, ArrowRight: 5, ArrowUp: -5, ArrowLeft: -5, PageDown: 10, PageUp: -10 };
          let v: number | null = null;
          if (e.key in langkah) v = awal + langkah[e.key]!;
          else if (e.key === "Home") v = 0;
          else if (e.key === "End") v = 100;
          if (v === null) return;
          e.preventDefault();
          onUbah(Math.min(100, Math.max(0, v)));
        }}
      >
        <i /><i /><i />
      </span>
    </div>
  );
}

function Halaman() {
  const toast = useToast();
  const [aturan, setAturan] = useState<AturanFee | null>(() => bacaCache<AturanFee>("aturan-fee"));
  const [isi, setIsi] = useState<Isi | null>(() => (aturan ? dariAturan(aturan) : null));
  const [fee, setFee] = useState("12.000.000");
  const [paket, setPaket] = useState<Paket[]>([]);
  const [paketDipilih, setPaketDipilih] = useState("");
  const [menyimpan, setMenyimpan] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);
  // "semua" = seluruh aliran tim disorot (kursor di angka utama atau batang).
  const [sorot, setSorot] = useState<PeranTim | "semua" | null>(null);
  const kabar: KabarPita = useRef(null);
  // Nama studio di kop slip — dibaca saja; kuncinya milik Info Studio (jebakan #8).
  const [studio, setStudio] = useState<string | null>(() => bacaCache<{ studioName?: string }>("settings")?.studioName ?? null);

  useEffect(() => {
    ambilAturanFee()
      .then((a) => {
        tulisCache("aturan-fee", a);
        setAturan(a);
        setIsi((l) => l ?? dariAturan(a));
      })
      .catch((e) => setGalat((e as Error).message));
    // Paket cuma jalan pintas fee contoh; gagal memuatnya tidak mengganggu.
    daftarPaket().then((p) => setPaket(p.filter((x) => x.active))).catch(() => {});
    ambilSettings().then((d) => setStudio(d.studioName || null)).catch(() => {});
  }, []);

  const asal = aturan ? dariAturan(aturan) : null;
  const berubahKunci = isi && asal ? (Object.keys(isi) as (keyof Isi)[]).filter((k) => isi[k].trim() !== asal[k]) : [];
  const berubah = berubahKunci.length > 0;
  useCegahPindah(berubah && !menyimpan);

  if (!isi || !aturan) {
    return galat ? <p className="atf__galat">Aturan fee tidak bisa dimuat: {galat}</p> : <Kerangka />;
  }

  const n = (k: keyof Isi) => keAngka(isi[k]);
  const awal = n("awal");
  const pool = n("pool");

  /* Alasan tombol Simpan mati — syarat yang sama dengan feeRules.persen(). */
  const salah: string[] = [];
  for (const r of URUTAN_PERAN) {
    const v = n(r);
    if (v !== null && (Number.isNaN(v) || v < 0 || v > 100)) salah.push(`persen ${LABEL_PERAN[r]}`);
  }
  if (!sah(pool) || pool < 0 || pool > 100) salah.push("jatah bonus tim");
  if (!sah(awal) || awal < 0 || awal > 100) salah.push("bagian tahap awal");
  const galatIsi = salah.length
    ? `Periksa ${salah.join(", ")} — isi angka 0 sampai 100${salah.some((s) => s.startsWith("persen")) ? ", atau kosongkan persen peran" : ""}.`
    : null;

  /* Nilai yang DIGAMBAR: persen yang tidak sah digambar sebagai "belum". */
  const nilai = Object.fromEntries(
    URUTAN_PERAN.map((r) => {
      const v = n(r);
      return [r, sah(v) && v >= 0 && v <= 100 ? v : null];
    }),
  ) as Record<PeranTim, number | null>;
  const total = URUTAN_PERAN.reduce((s, r) => s + (nilai[r] ?? 0), 0);
  const awalAman = sah(awal) ? Math.min(100, Math.max(0, awal)) : aturan.firstTranchePct;
  const poolAman = sah(pool) ? Math.min(100, Math.max(0, pool)) : aturan.poolPct;
  const lewat = total > poolAman ? total - poolAman : 0;
  const feeAngka = rupiahDari(fee);
  const rp = (pct: number) => Math.round((feeAngka * pct) / 100);
  const awalRp = (pct: number) => Math.round((rp(pct) * awalAman) / 100);
  const timTotal = URUTAN_PERAN.reduce((s, r) => s + (nilai[r] !== null ? rp(nilai[r]!) : 0), 0);
  const timAwal = URUTAN_PERAN.reduce((s, r) => s + (nilai[r] !== null ? awalRp(nilai[r]!) : 0), 0);
  const sorotPeran = sorot && sorot !== "semua" ? sorot : null;
  const slipPeran = (sorotPeran && nilai[sorotPeran] !== null ? sorotPeran : URUTAN_PERAN.find((r) => nilai[r] !== null)) ?? null;

  /* --- Letak diagram ---------------------------------------------------- */
  const blok = tataPeran(nilai, total);
  // Batang fee: 0–100% setinggi bidang. Kalau persen peran menjumlah lebih
  // dari 100, batangnya diisi penuh oleh tim (bagian studio 0).
  const skala = T / Math.max(100, total);
  const irisFee: Partial<Record<PeranTim, [number, number]>> = {};
  {
    let y = 0;
    for (const r of URUTAN_PERAN) {
      const v = nilai[r];
      if (v === null || v <= 0) continue;
      irisFee[r] = [y, y + v * skala];
      y += v * skala;
    }
  }
  const timY = Math.min(T, total * skala);
  const jatahY = Math.min(T, poolAman * skala);
  // Node tahap: DP di atas, Finish di bawah, dibelah di persen tahap awal.
  const dpH = (awalAman / 100) * (T - CELAH_TAHAP);
  const finY = dpH + CELAH_TAHAP;
  const irisTahap: Partial<Record<PeranTim, { dp: [number, number]; fin: [number, number] }>> = {};
  {
    let a = 0;
    let b = finY;
    for (const r of URUTAN_PERAN) {
      const v = nilai[r];
      if (v === null || v <= 0 || total <= 0) continue;
      const ha = (v / total) * dpH;
      const hb = (v / total) * (T - finY);
      irisTahap[r] = { dp: [a, a + ha], fin: [b, b + hb] };
      a += ha;
      b += hb;
    }
  }
  // Label tahap dipusatkan pada node-nya, dijepit di dalam bidang dan tidak
  // boleh saling menimpa (DP mengalah ke atas, Finish ke bawah).
  const LABEL_T = 50;
  const jepit = (tengah: number) => Math.min(T - LABEL_T, Math.max(0, tengah - LABEL_T / 2));
  let labelDp = jepit(dpH / 2);
  let labelFin = jepit(finY + (T - finY) / 2);
  if (labelFin - labelDp < LABEL_T + 4) {
    const tengah = (labelDp + labelFin) / 2;
    labelDp = Math.max(0, tengah - (LABEL_T + 4) / 2);
    labelFin = Math.min(T - LABEL_T, labelDp + LABEL_T + 4);
    labelDp = labelFin - LABEL_T - 4;
  }

  function set(k: keyof Isi, v: string) {
    setIsi((l) => (l ? { ...l, [k]: v.replace(/[^\d.,]/g, "") } : l));
  }

  async function simpan() {
    if (galatIsi || !berubah || !isi || !asal) return;
    const ubah: Partial<AturanFee> = {};
    for (const r of URUTAN_PERAN) if (isi[r].trim() !== asal[r]) ubah[KUNCI_PCT[r]] = n(r);
    if (isi.pool.trim() !== asal.pool) ubah.poolPct = n("pool")!;
    if (isi.awal.trim() !== asal.awal) ubah.firstTranchePct = n("awal")!;
    setMenyimpan(true);
    try {
      const a = await simpanAturanFee(ubah);
      tulisCache("aturan-fee", a);
      setAturan(a);
      setIsi(dariAturan(a));
      toast({ judul: "Aturan fee disimpan", keterangan: "Berlaku untuk penugasan baru dan tahap yang belum dibayar.", nada: "sukses" });
    } catch (err) {
      toast({ judul: "Gagal menyimpan aturan fee", keterangan: (err as Error).message, nada: "gagal" });
    } finally {
      setMenyimpan(false);
    }
  }

  // Menyorot satu peran (tetikus saja, jebakan #9) menyalakan kartunya,
  // kedua pitanya, irisannya di batang dan node, baris pratinjaunya, dan
  // mengganti slip ke peran itu — satu aturan, semua akibatnya.
  const sorotan = (r: PeranTim | "semua") => ({
    onPointerEnter: (e: React.PointerEvent) => { if (e.pointerType === "mouse") setSorot(r); },
    onPointerLeave: () => setSorot(null),
  });
  const disorot = (r: PeranTim) => sorot === r || (sorot === "semua" && nilai[r] !== null);
  const warna = (r: PeranTim) => `atf__w--${r}${disorot(r) ? " is-sorot" : ""}`;
  // Pita dan irisan menjawab "berapa" di bawah kursor (aturan semua grafik
  // kit), sekaligus menyorot perannya. Tetikus saja — jebakan #9.
  const keterangan = (r: PeranTim | "semua" | null, judul: string, baris: BarisKartu[]) => ({
    onPointerEnter: (e: React.PointerEvent) => { if (e.pointerType === "mouse") setSorot(r); },
    onPointerMove: (e: React.PointerEvent) => {
      if (e.pointerType === "mouse") kabar.current?.({ x: e.clientX, y: e.clientY, judul, baris });
    },
    onPointerLeave: () => { setSorot(null); kabar.current?.(null); },
  });
  const ketPeran = (r: PeranTim) => {
    const v = nilai[r]!;
    return keterangan(r, `${LABEL_PERAN[r]} · ${pctTampil(v)}% dari fee design`, [
      { warna: RAMP[r], label: "Hak per proyek", nilai: formatRupiah(rp(v)) },
      { label: `Saat DP masuk · ${pctTampil(awalAman)}%`, nilai: formatRupiah(awalRp(v)) },
      { label: `Saat Finish · ${pctTampil(100 - awalAman)}%`, nilai: formatRupiah(rp(v) - awalRp(v)) },
    ]);
  };
  const ketTahap = (r: PeranTim, tahap: "dp" | "fin") => {
    const v = nilai[r]!;
    const dp = tahap === "dp";
    return keterangan(r, `${LABEL_PERAN[r]} → ${dp ? "saat DP masuk" : "saat Finish"}`, [
      { warna: RAMP[r], label: `${pctTampil(dp ? awalAman : 100 - awalAman)}% dari hak`, nilai: formatRupiah(dp ? awalRp(v) : rp(v) - awalRp(v)) },
    ]);
  };
  // Mistar batang fee: 0–100 menurut skala batang yang sama.
  const mistar = [0, 25, 50, 75, 100].filter((p) => p * skala <= T + 0.5);

  /* Busur jatah: skalanya jatah atau jumlah persen, mana yang lebih besar.
     Bagian yang melewati jatah digambar amber; sisa jatah abu. */
  const irisJatah: IrisBusur[] = [];
  {
    let c = 0;
    for (const r of URUTAN_PERAN) {
      const v = nilai[r];
      if (v === null || v <= 0) continue;
      const dalam = Math.max(0, Math.min(v, poolAman - c));
      if (dalam > 0) irisJatah.push({ nilai: dalam, warna: RAMP[r], label: LABEL_PERAN[r], ket: `${pctTampil(dalam)}%` });
      if (v - dalam > 0) irisJatah.push({ nilai: v - dalam, warna: "var(--warn)", label: `${LABEL_PERAN[r]} · lewat jatah`, ket: `${pctTampil(v - dalam)}%` });
      c += v;
    }
    if (total < poolAman) irisJatah.push({ nilai: poolAman - total, warna: "var(--atf-sisa)", label: "Sisa jatah", ket: `${pctTampil(poolAman - total)}%` });
  }

  const bulan = new Date().toLocaleDateString("id-ID", { month: "long", year: "numeric" });

  return (
    <div className="atf">
      {/* ─── Papan aliran ──────────────────────────────────────────────────── */}
      <section className={`atf__aliran${sorot ? " is-menyorot" : ""}`} aria-labelledby="atf-judul">
        <header className="atf__kepala">
          <div className="atf__kepalajudul">
            <h2 id="atf-judul">Aliran fee satu proyek</h2>
            <p>Berlaku untuk penugasan baru dan tahap yang belum dibayar.</p>
          </div>
          <div className="atf__simpan">
            <PenandaSimpan n={galatIsi ? 1 : berubahKunci.length} teks={galatIsi ?? undefined} />
            {berubah && <Tombol jenis="ghost" ukuran="medium" disabled={menyimpan} onClick={() => asal && setIsi(asal)}>Batalkan</Tombol>}
            <Tombol jenis="primary" ukuran="medium" memuat={menyimpan} disabled={!!galatIsi || !berubah || menyimpan} onClick={() => void simpan()}>
              Simpan aturan
            </Tombol>
          </div>
        </header>

        <div className="atf__badan">
          {/* Sumber: fee design contoh — alat bantu baca, tidak disimpan. */}
          <div className="atf__sumber">
            <label className="atf__fee">
              <span>Fee design contoh</span>
              <span className="atf__feeisian">
                <small aria-hidden="true">Rp</small>
                <input
                  inputMode="numeric"
                  value={fee}
                  onChange={(e) => { setFee(titik(rupiahDari(e.currentTarget.value))); setPaketDipilih(""); }}
                />
              </span>
            </label>
            {paket.length > 0 && (
              <div className="atf__paketlist" role="group" aria-label="Pakai fee paket">
                {paket.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className="atf__paket"
                    aria-pressed={paketDipilih === p.id}
                    // Batas bawah paket — angka yang dipakai saat diklik, dan
                    // yang langsung tampil di isian fee di atasnya.
                    title={`Mulai Rp${p.feeMin} jt`}
                    onClick={() => {
                      setPaketDipilih(p.id);
                      // Fee paket disimpan dalam JUTA (Starter 15 → Rp15.000.000).
                      setFee(titik(p.feeMin * 1e6));
                    }}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            )}
            {/* Angka utama halaman: berapa yang sampai ke tim. Menyentuhnya
                menyalakan seluruh aliran tim. */}
            <p className={`atf__hasil${sorot === "semua" ? " is-sorot" : ""}`} {...sorotan("semua")}>
              <span>Tim menerima <em>{pctTampil(total)}%</em></span>
              <b>{formatRupiah(timTotal)}</b>
            </p>
            <dl className="atf__legenda">
              <div>
                <dt><i className="atf__kotak atf__kotak--studio" />Studio</dt>
                <dd><b>{pctTampil(Math.max(0, 100 - total))}%</b><span>{formatRupiah(Math.max(0, feeAngka - timTotal))}</span></dd>
              </div>
              <div className={lewat > 0 ? "is-lewat" : undefined}>
                <dt><i className="atf__kotak atf__kotak--jatah" />Jatah bonus</dt>
                <dd><b>{pctTampil(poolAman)}%</b><span>{lewat > 0 ? `lewat ${pctTampil(lewat)} poin` : `sisa ${pctTampil(poolAman - total)} poin`}</span></dd>
              </div>
            </dl>
          </div>

          {/* Diagram. Di ponsel digulir mendatar di dalam bidangnya sendiri. */}
          <div className="atf__petagulir">
            <div className="atf__peta" style={{ ["--atf-t" as string]: `${T}px` }}>
              <span className="atf__kol atf__kol--fee">Fee<span className="atf__kolsisa"> design</span></span>
              <span className="atf__sela" aria-hidden="true" />
              <span className="atf__kol atf__kol--peran">Tiap peran</span>
              <span className="atf__sela" aria-hidden="true" />
              <span className="atf__kol atf__kol--tahap">Dibayar</span>

              {/* Batang fee design 0–100%: irisan tim di atas, studio di bawah. */}
              <div className="atf__batang">
                <svg viewBox={`0 0 44 ${T}`} width={44} height={T} aria-hidden="true">
                  <defs>
                    <pattern id="atf-arsir" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                      <rect width="2.5" height="6" className="atf__arsir" />
                    </pattern>
                    <clipPath id="atf-batang"><rect width="44" height={T} rx="10" /></clipPath>
                    {/* Gradien pita: pekat di kedua ujung (tempat ia menempel),
                        menerawang di tengah. Dipakai kedua kolom pita. */}
                    {URUTAN_PERAN.map((r) => (
                      <linearGradient key={r} id={`atf-g-${r}`} x1="0" x2="1" y1="0" y2="0">
                        <stop offset="0" className={`atf__stop atf__w--${r}`} stopOpacity="0.62" />
                        <stop offset="0.5" className={`atf__stop atf__w--${r}`} stopOpacity="0.2" />
                        <stop offset="1" className={`atf__stop atf__w--${r}`} stopOpacity="0.62" />
                      </linearGradient>
                    ))}
                  </defs>
                  <g clipPath="url(#atf-batang)">
                    <rect
                      width="44"
                      height={T}
                      className="atf__studio"
                      {...keterangan(null, "Studio", [{ label: `${pctTampil(Math.max(0, 100 - total))}% dari fee design`, nilai: formatRupiah(Math.max(0, feeAngka - timTotal)) }])}
                    />
                    {URUTAN_PERAN.map((r) => {
                      const s = irisFee[r];
                      return s ? <rect key={r} y={s[0]} width="44" height={Math.max(0, s[1] - s[0])} className={`atf__iris ${warna(r)}`} {...ketPeran(r)} /> : null;
                    })}
                    {timY > jatahY && <rect y={jatahY} width="44" height={timY - jatahY} fill="url(#atf-arsir)" className="atf__arsirisi" />}
                  </g>
                  <line x1="0" x2="44" y1={jatahY} y2={jatahY} className={`atf__jatahgaris${lewat > 0 ? " is-lewat" : ""}`} />
                  {mistar.map((p) => (
                    <line key={p} x1="-6" x2="-2" y1={Math.min(T - 0.5, Math.max(0.5, p * skala))} y2={Math.min(T - 0.5, Math.max(0.5, p * skala))} className="atf__mistar" />
                  ))}
                </svg>
                {mistar.map((p) => (
                  <span key={p} className="atf__mistarlabel" style={{ top: Math.min(T - 5, Math.max(5, p * skala)) }}>{p}</span>
                ))}
                <span className="atf__studiolabel">
                  Studio<b>{pctTampil(Math.max(0, 100 - total))}%</b>
                </span>
              </div>

              {/* Pita fee → peran. */}
              <div className="atf__pitasel atf__pitasel--a">
                <svg viewBox={`0 0 100 ${T}`} preserveAspectRatio="none" aria-hidden="true">
                  {blok.map((b) => {
                    const s = irisFee[b.r];
                    return s ? <path key={b.r} d={pita(s[0], s[1], b.y, b.y + b.h)} className={`atf__pita ${warna(b.r)}`} {...ketPeran(b.r)} /> : null;
                  })}
                  {blok.map((b) => {
                    const s = irisFee[b.r];
                    return s && disorot(b.r) ? <path key={b.r} d={alir((s[0] + s[1]) / 2, b.y + b.h / 2)} className="atf__alir" /> : null;
                  })}
                </svg>
                <span className={`atf__jatahlabel${lewat > 0 ? " is-lewat" : ""}`} style={{ top: jatahY }}>
                  jatah {pctTampil(poolAman)}%
                </span>
              </div>

              {/* Kartu peran — persen diketik DI SINI. */}
              <ul className="atf__peran">
                {blok.map((b) => {
                  const mentah = n(b.r);
                  const belum = b.v === null;
                  return (
                    <li
                      key={b.r}
                      className={`atf__blok ${warna(b.r)}${belum ? " is-belum" : ""}`}
                      style={{ top: b.y, height: b.h }}
                      {...sorotan(b.r)}
                    >
                      <span className="atf__ubin" aria-hidden="true"><Ikon ikon={IKON_PERAN[b.r]} ukuran={14} /></span>
                      <span className="atf__nama">
                        <b>{LABEL_PERAN[b.r]}</b>
                        {belum ? (
                          <small className="atf__belum">{mentah === null ? "Belum ditentukan" : "Bukan angka 0–100"}</small>
                        ) : (
                          <small>{formatRupiah(rp(b.v!))}</small>
                        )}
                      </span>
                      <IsianPersen label={`Persen ${LABEL_PERAN[b.r]}`} nilai={isi[b.r]} onUbah={(x) => set(b.r, x)} />
                    </li>
                  );
                })}
              </ul>

              {/* Pita peran → tahap: bagian atas tiap kartu ke DP, bawah ke Finish. */}
              <div className="atf__pitasel atf__pitasel--b">
                <svg viewBox={`0 0 100 ${T}`} preserveAspectRatio="none" aria-hidden="true">
                  {blok.map((b) => {
                    const s = irisTahap[b.r];
                    if (!s) return null;
                    const belah = b.y + (b.h * awalAman) / 100;
                    return (
                      <g key={b.r} className={`atf__pita ${warna(b.r)}`}>
                        {s.dp[1] > s.dp[0] && <path d={pita(b.y, belah, s.dp[0], s.dp[1])} {...ketTahap(b.r, "dp")} />}
                        {s.fin[1] > s.fin[0] && <path d={pita(belah, b.y + b.h, s.fin[0], s.fin[1])} {...ketTahap(b.r, "fin")} />}
                        {disorot(b.r) && s.dp[1] > s.dp[0] && <path d={alir((b.y + belah) / 2, (s.dp[0] + s.dp[1]) / 2)} className="atf__alir" />}
                        {disorot(b.r) && s.fin[1] > s.fin[0] && <path d={alir((belah + b.y + b.h) / 2, (s.fin[0] + s.fin[1]) / 2)} className="atf__alir" />}
                      </g>
                    );
                  })}
                </svg>
              </div>

              {/* Node tahap + label + pembagi yang diseret. */}
              <div className="atf__tahap">
                <svg viewBox={`0 0 14 ${T}`} width={14} height={T} aria-hidden="true">
                  {dpH > 0 && <rect width="14" height={dpH} rx="4" className="atf__node" />}
                  {T - finY > 0 && <rect y={finY} width="14" height={T - finY} rx="4" className="atf__node" />}
                  {URUTAN_PERAN.map((r) => {
                    const s = irisTahap[r];
                    if (!s) return null;
                    return (
                      <g key={r} className={`atf__iris ${warna(r)}`}>
                        <rect y={s.dp[0]} width="14" height={Math.max(0, s.dp[1] - s.dp[0])} />
                        <rect y={s.fin[0]} width="14" height={Math.max(0, s.fin[1] - s.fin[0])} />
                      </g>
                    );
                  })}
                </svg>
                <PembagiTahap awal={awalAman} onUbah={(v) => set("awal", String(v))} />
                <div className="atf__tahaplabel" style={{ top: labelDp }}>
                  <small>Saat DP masuk</small>
                  <span>
                    <IsianPersen label="Bagian tahap awal" nilai={isi.awal} onUbah={(x) => set("awal", x)} kosong="0" />
                    <b>{formatRupiah(timAwal)}</b>
                  </span>
                </div>
                <div className="atf__tahaplabel" style={{ top: labelFin }}>
                  <small>Saat Finish</small>
                  <span>
                    <em>{pctTampil(100 - awalAman)}%</em>
                    <b>{formatRupiah(timTotal - timAwal)}</b>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <KartuPita kabar={kabar} />

      {/* ─── Jatah bonus ───────────────────────────────────────────────────── */}
      <section className="atf__kartu atf__jatah" aria-labelledby="atf-jatah">
        <div className="atf__kartukepala">
          <h3 id="atf-jatah">Jatah bonus tim</h3>
          <IsianPersen label="Jatah bonus tim per proyek" nilai={isi.pool} onUbah={(x) => set("pool", x)} kosong="0" kelas="atf__pct--terang" />
        </div>
        <Busur
          iris={irisJatah}
          className={`atf__busur${lewat > 0 ? " is-lewat" : ""}`}
          label="Bagian tim"
          nilai={`${pctTampil(total)}%`}
          ket={`dari jatah ${pctTampil(poolAman)}% per proyek`}
        />
        <p className={`atf__status${lewat > 0 ? " is-lewat" : ""}`}>
          {lewat > 0
            ? `Lewat ${pctTampil(lewat)} poin. Belum diputuskan — bayaran tetap dihitung dari persen peran.`
            : `Di dalam jatah, sisa ${pctTampil(poolAman - total)} poin.`}
        </p>
      </section>

      {/* ─── Tampil di Satu Proyek ─────────────────────────────────────────── */}
      <section className="atf__kartu atf__tampil" aria-labelledby="atf-tampil">
        <div className="atf__kartukepala">
          <h3 id="atf-tampil"><Ikon ikon={NavSquaresFour} ukuran={15} />Tampil di Satu Proyek</h3>
          {/* Kepala kartu ini bergaya bilah judul layar: yang di bawahnya
              memang potongan layar Satu Proyek. */}
          <small>Proyek contoh <i>/</i> <b>Tim &amp; Bayaran</b></small>
        </div>
        {/* Komponen tahapnya ASLI; `inert` supaya tombol contohnya tidak bisa
            ditekan atau difokus. Sorotan datang dari kartu peran di diagram. */}
        <table className="atf__tabel" inert>
          <thead>
            <tr><th>Peran</th><th>Saat DP masuk</th><th>Saat Finish</th></tr>
          </thead>
          <tbody>
            {URUTAN_PERAN.map((r) => {
              const v = nilai[r];
              const p = penugasanContoh(r, v, feeAngka, awalAman);
              return (
                <tr key={r} data-sorot={disorot(r) || undefined}>
                  <td>
                    <span className="atf__peranteks">
                      <i style={{ background: RAMP[r] }} />
                      {LABEL_PERAN[r]}
                      <small>{v !== null ? `${pctTampil(v)}%` : "—"}</small>
                    </span>
                  </td>
                  <td><SelTahap p={p} jenis="awal" onBayar={() => {}} /></td>
                  <td><SelTahap p={p} jenis="akhir" onBayar={() => {}} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {/* ─── Tampil di slip gaji ───────────────────────────────────────────── */}
      <section className="atf__kartu atf__slip" aria-labelledby="atf-slip">
        <div className="atf__kartukepala">
          <h3 id="atf-slip"><Ikon ikon={NavReceipt} ukuran={15} />Tampil di slip gaji</h3>
          <small>{slipPeran ? `baris fee ${LABEL_PERAN[slipPeran]}` : "—"}</small>
        </div>
        {slipPeran ? (
          <div className="atf__kertas">
            {/* Kop: nama studio dari Info Studio — sama dengan kop slip PDF. */}
            <div className="atf__kertaskop">
              <b>{studio ?? "Slip gaji"}</b>
              <span>{bulan}</span>
            </div>
            <p className="atf__kertasnama">{studio ? "Slip gaji · anggota tim contoh" : "Anggota tim contoh"}</p>
            <ul>
              {(["awal", "akhir"] as const).map((t) => {
                const v = nilai[slipPeran]!;
                const t1 = awalRp(v);
                const baris: BarisSlip = {
                  costId: t, projectId: "contoh", projectTitle: "Proyek contoh", label: "", amount: t === "awal" ? t1 : rp(v) - t1,
                  incurredOn: "", role: slipPeran, pct: v, payoutStage: t,
                };
                return (
                  <li key={t}>
                    <span>{keteranganFee(baris)}</span>
                    <b>{formatRupiah(baris.amount)}</b>
                  </li>
                );
              })}
            </ul>
            <p className="atf__kertasjumlah"><span>Fee proyek ini</span><b>{formatRupiah(rp(nilai[slipPeran]!))}</b></p>
          </div>
        ) : (
          <p className="atf__kosong">Belum ada peran berpersen — slip tidak memuat baris fee.</p>
        )}
      </section>
    </div>
  );
}

function Kerangka(): ReactNode {
  return <div className="atf atf--rangka" aria-hidden="true"><i /><i /><i /><i /></div>;
}

export function AturanFeeKit() {
  return (
    <RequireAuth skeleton={<Kerangka />}>
      <ToastProvider>
        <Halaman />
      </ToastProvider>
    </RequireAuth>
  );
}
