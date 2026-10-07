import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { RequireAuth } from "./RequireAuth";
import { PilihTombol } from "../kit/Formulir";
import { Segmen } from "../kit/Segmen";
import { LencanaTren } from "../kit/Ukuran";
import { useUrutTabel, type Urutan } from "../kit/Tabel";
import { Ikon } from "../kit/Ikon";
import { Keterangan, pemberiKet, type KabarKartu } from "../kit/kartuGrafik";
import { CoinIn, CoinOut, HourglassHigh, NavCalendarDots, Sliders } from "../kit/ikon";
import {
  ambilRingkasanKeuangan,
  ambilBulanan,
  ambilSettings,
  semuaBiaya,
  semuaPembayaran,
  semuaTagihan,
  bacaCache,
  tulisCache,
  type FinanceOverview,
  type BarisBulanan,
  type BiayaProyek,
  type Pembayaran,
  type Invoice,
  type StudioSettings,
} from "../../lib/admin";
import { proyekAktif, onProyekAktif } from "../../lib/proyekAktif";
import { formatRupiah } from "../../lib/format";
import { kodeProyek, inisial } from "../../lib/nomorDokumen";

/* =============================================================================
   Keuangan — Ringkasan = NERACA STUDIO.

   "Neraca" dalam bahasa Indonesia berarti dua hal sekaligus: laporan
   keuangan yang menimbang yang masuk lawan yang keluar, dan TIMBANGAN. Halaman
   ini memakai keduanya secara harfiah, dan BERPERILAKU seperti timbangan:

   1. TIMBANGAN PRESISI — alas bertingkat, tiang berpelat LABA BERSIH, medali
      studio di puncak poros, lengan tirus, dan MUKA JARUM bundar di tiang
      yang membaca MARJIN KAS (laba ÷ kas masuk) dari yang sedang ditimbang.
      Piringan kiri memuat KAS MASUK (satu anak timbangan silinder per
      proyek), piringan kanan BEBAN (satu per kategori), masing-masing di
      mangkuk bersanggurdi. Lengan miring ke sisi yang lebih berat.
      Menyentuh satu anak timbangan (tetikus saja) memperlihatkan neraca
      TANPA dia.
   2. LEMBAR NERACA — bentuk T akuntansi, saldo bergaris ganda, cap marjin
      KONTRAK, dan piutang yang "belum ditimbang".
   3. PITA PENCATAT — kertas milimeter di antara dua gulungan: per bulan kas
      masuk ke atas, beban ke bawah, jejak tinta LABA, pena di bulan
      berjalan. Mengklik bulan = MENIMBANG bulan itu.
   4. Transaksi terbaru dan tenggat tagihan.

   SATU-SATUNYA gerak besar (2D, fisika): saat menimbang, piringan
   dikosongkan dan lengan kembali datar; anak timbangan jatuh satu per satu
   (terbesar dulu), tiap hentakan membuat piringannya memantul dan berayun,
   dan lengan miring SEBANYAK yang sudah mendarat, lalu berayun teredam
   sampai diam. Angka laba, label piringan, dan jarum marjin ikut berhitung.
   Lengan dan piringan digerakkan pegas teredam di rAF (transform langsung ke
   DOM, bukan state React per frame) yang berhenti sendiri begitu diam —
   tidak ada animasi abadi (jebakan #22). Gerak dikurangi = seketika.

   Datanya tidak berubah: `kasMasuk` = jumlah `received` per proyek (tagihan
   lunas) dan beban per kategori = `totalBiaya`, jadi jumlah anak timbangan
   pasti sama dengan angka di lembar. Untuk satu bulan, pecahannya dihitung
   dari tagihan lunas & biaya bulan itu; selisih terhadap angka bulanan API
   jadi anak timbangan "tak terinci", supaya jumlahnya tetap sama dengan
   catatan bulanannya.
   ============================================================================= */

const BULAN_PENDEK = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

const KATEGORI: Record<string, string> = {
  freelancer: "Freelancer",
  operasional: "Operasional",
  prinsipal: "Prinsipal",
  lainnya: "Lainnya",
};
const LABEL_JENIS: Record<string, string> = { dp: "DP", termin: "Termin", pelunasan: "Pelunasan" };
const LABEL_METODE: Record<string, string> = { tunai: "Tunai", transfer: "Transfer", qris: "QRIS", lainnya: "Lainnya" };

const RENTANG = [
  { nilai: "1", label: "Bulan ini" },
  { nilai: "3", label: "3 bulan" },
  { nilai: "12", label: "12 bulan" },
  { nilai: "0", label: "Semua" },
];

/** Sudut lengan paling miring. */
const SUDUT_MAKS = 10;
/** Tinggi tumpukan anak timbangan untuk sisi yang lebih berat. */
const TUMPUK_MAKS = 140;
const ANAK_MIN = 24;
/** Jatuhnya satu anak timbangan; ia menyentuh piringan di 72%. */
const JATUH_MS = 560;
const JEDA_ANAK = 140;
const MENDARAT_MS = Math.round(JATUH_MS * 0.72);

/* Pegas teredam lengan (sudut, derajat), ayun piringan, dan pantul piringan. */
const PEGAS = { k: 40, c: 4, kAyun: 52, cAyun: 3.3, kPantul: 260, cPantul: 15 };

/* Skala muka jarum: marjin −40%..80% pada busur 240°. */
const JARUM_MIN = -40;
const JARUM_MAKS = 80;
const sudutJarum = (v: number) => -120 + ((Math.max(JARUM_MIN, Math.min(JARUM_MAKS, v)) - JARUM_MIN) / (JARUM_MAKS - JARUM_MIN)) * 240;

function batasRentang(bulan: number): number | null {
  if (bulan <= 0) return null;
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  d.setMonth(d.getMonth() - (bulan - 1));
  return d.getTime();
}

function waktuKe(iso: string, akhirHari = true): number {
  return new Date(iso.length === 10 ? iso + (akhirHari ? "T23:59:59" : "T00:00:00") : iso).getTime();
}

/** Hari tersisa sampai tenggat (UTC, sama dengan Tagihan & Termin). */
function sisaHari(iso: string): number | null {
  const [t, b, h] = iso.slice(0, 10).split("-").map(Number);
  if (!t || !b || !h) return null;
  const kini = new Date();
  const hariIni = Date.UTC(kini.getFullYear(), kini.getMonth(), kini.getDate());
  return Math.round((Date.UTC(t, b - 1, h) - hariIni) / 86_400_000);
}

function hariTenggat(sisa: number, iso: string): string {
  if (sisa === 0) return "Hari ini";
  if (sisa === 1) return "Besok";
  const [, b, h] = iso.slice(0, 10).split("-").map(Number);
  return `${h} ${BULAN_PENDEK[(b ?? 1) - 1]}`;
}

const kunciBulanDari = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const namaBulan = (k: string) => `${BULAN[Number(k.slice(5, 7)) - 1]} ${k.slice(0, 4)}`;
const pendekBulan = (k: string) => BULAN_PENDEK[Number(k.slice(5, 7)) - 1] ?? k;

/** n bulan terakhir, berurutan, termasuk yang tanpa data (nol). */
function deretBulan(n: number): string[] {
  const d = new Date();
  d.setDate(1);
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const x = new Date(d.getFullYear(), d.getMonth() - i, 1);
    out.push(kunciBulanDari(x));
  }
  return out;
}

interface Anak {
  kunci: string;
  kode: string;
  label: string;
  nilai: number;
  sisa?: boolean;
}

interface Transaksi {
  kunci: string;
  masuk: boolean;
  nama: string;
  sub: string;
  proyek: string;
  waktu: string;
  nominal: number;
}

/** Empat terbesar + sisanya digabung — piringan tidak muat lebih. */
function ringkasAnak(daftar: Anak[], labelSisa: string): Anak[] {
  const urut = [...daftar].filter((a) => a.nilai > 0).sort((a, b) => b.nilai - a.nilai);
  if (urut.length <= 4) return urut;
  const sisa = urut.slice(3).reduce((n, a) => n + a.nilai, 0);
  return [...urut.slice(0, 3), { kunci: "sisa", kode: `+${urut.length - 3} lain`, label: `${labelSisa} (${urut.length - 3})`, nilai: sisa, sisa: true }];
}

function tren(kini?: number, lalu?: number) {
  if (kini === undefined || lalu === undefined || !lalu) return null;
  const p = ((kini - lalu) / Math.abs(lalu)) * 100;
  return { naik: p >= 0, teks: `${Math.abs(p).toFixed(1).replace(".", ",")} %` };
}

/** Sudut lengan untuk dua beban: miring ke yang lebih berat. */
function sudutUntuk(masuk: number, keluar: number): number {
  const berat = Math.max(masuk, keluar);
  if (berat <= 0) return 0;
  return Math.max(-SUDUT_MAKS, Math.min(SUDUT_MAKS, ((keluar - masuk) / berat) * SUDUT_MAKS));
}

const geraknya = () =>
  typeof window !== "undefined" && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Angka yang berhitung ke nilai barunya; seketika saat pertama tampil dan
 *  bila gerak dikurangi. */
function useHitung(nilai: number, ms = 420): number {
  const [tampil, setTampil] = useState(nilai);
  const kini = useRef(nilai);
  useEffect(() => {
    const awal = kini.current;
    if (awal === nilai) return;
    if (!geraknya()) {
      kini.current = nilai;
      setTampil(nilai);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const langkah = (t: number) => {
      const p = Math.min(1, (t - t0) / ms);
      const v = Math.round(awal + (nilai - awal) * (1 - Math.pow(1 - p, 3)));
      kini.current = v;
      setTampil(v);
      if (p < 1) raf = requestAnimationFrame(langkah);
    };
    raf = requestAnimationFrame(langkah);
    return () => cancelAnimationFrame(raf);
  }, [nilai, ms]);
  return tampil;
}

/* -----------------------------------------------------------------------------
   Fisika timbangan. Satu pegas teredam untuk sudut lengan, satu bandul untuk
   ayun tiap piringan (berporos di kaitnya), satu pegas untuk pantul piringan
   saat anak timbangan mendarat. Transform ditulis langsung ke DOM; React
   tidak pernah menulis `transform` ketiga jenis elemen itu, jadi keduanya
   tidak berebut. Lingkarannya berhenti sendiri begitu semuanya diam.
   -------------------------------------------------------------------------- */
interface Keadaan {
  th: number;
  w: number;
  ph: [number, number];
  pw: [number, number];
  y: [number, number];
  yv: [number, number];
}

const diamPada = (th: number): Keadaan => ({ th, w: 0, ph: [0, 0], pw: [0, 0], y: [0, 0], yv: [0, 0] });

function useTimbangan(target: number, setengah: number, siap: boolean) {
  const lengan = useRef<HTMLDivElement | null>(null);
  const piring = useRef<(HTMLDivElement | null)[]>([null, null]);
  const gantung = useRef<(HTMLDivElement | null)[]>([null, null]);
  const s = useRef<Keadaan>(diamPada(target));
  const tgt = useRef(target);
  const pjg = useRef(setengah);
  const raf = useRef(0);

  const pasang = useCallback(() => {
    const k = s.current;
    const dy = pjg.current * Math.sin((k.th * Math.PI) / 180);
    if (lengan.current) lengan.current.style.transform = `translateX(-50%) rotate(${k.th.toFixed(3)}deg)`;
    for (const i of [0, 1] as const) {
      const p = piring.current[i];
      const g = gantung.current[i];
      if (p) p.style.transform = `translateY(${((i === 0 ? -dy : dy) + k.y[i]).toFixed(2)}px)`;
      if (g) g.style.transform = `rotate(${k.ph[i].toFixed(3)}deg)`;
    }
  }, []);

  const jalan = useCallback(() => {
    if (raf.current) return;
    let lalu = performance.now();
    const langkah = (t: number) => {
      const dt = Math.max(0, Math.min(1 / 30, (t - lalu) / 1000));
      lalu = t;
      const k = s.current;
      for (let n = 0; n < 4; n++) {
        const h = dt / 4;
        const a = -PEGAS.k * (k.th - tgt.current) - PEGAS.c * k.w;
        k.w += a * h;
        k.th += k.w * h;
        for (const i of [0, 1] as const) {
          k.pw[i] += (-PEGAS.kAyun * k.ph[i] - PEGAS.cAyun * k.pw[i]) * h;
          k.ph[i] += k.pw[i] * h;
          k.yv[i] += (-PEGAS.kPantul * k.y[i] - PEGAS.cPantul * k.yv[i]) * h;
          k.y[i] += k.yv[i] * h;
        }
      }
      const diam =
        /* Di bawah ambang ini getarannya kurang dari sepersepuluh piksel. */
        Math.abs(k.th - tgt.current) < 0.03 &&
        Math.abs(k.w) < 0.08 &&
        ([0, 1] as const).every((i) => Math.abs(k.ph[i]) < 0.03 && Math.abs(k.pw[i]) < 0.1 && Math.abs(k.y[i]) < 0.08 && Math.abs(k.yv[i]) < 0.4);
      if (diam) {
        s.current = diamPada(tgt.current);
        pasang();
        raf.current = 0;
        return;
      }
      pasang();
      raf.current = requestAnimationFrame(langkah);
    };
    raf.current = requestAnimationFrame(langkah);
  }, [pasang]);

  useLayoutEffect(() => {
    tgt.current = target;
    pjg.current = setengah;
    if (!siap || !geraknya()) {
      cancelAnimationFrame(raf.current);
      raf.current = 0;
      s.current = diamPada(target);
      pasang();
    } else if (raf.current === 0 && Math.abs(s.current.th - target) < 0.03) {
      pasang();
    } else {
      jalan();
    }
  }, [target, setengah, siap, jalan, pasang]);

  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  /** Hentakan anak timbangan yang mendarat di piringan `sisi` (0 kiri). */
  const hentak = useCallback(
    (sisi: 0 | 1, kuat: number) => {
      if (!geraknya()) return;
      const k = s.current;
      k.yv[sisi] += 70 + 110 * kuat;
      k.pw[sisi] += (sisi === 0 ? -1 : 1) * (9 + 15 * kuat);
      k.w += (sisi === 0 ? -1 : 1) * (8 + 16 * kuat);
      jalan();
    },
    [jalan],
  );

  return { lengan, piring, gantung, hentak };
}

/** Kepala kolom yang bisa mengurutkan (pola Tabel kit). */
function KepalaUrut({ label, i, urutan, onUrut, kanan }: { label: string; i: number; urutan: Urutan | null; onUrut: (u: Urutan | null) => void; kanan?: boolean }) {
  const arah = urutan?.kolom === i ? urutan.arah : null;
  return (
    <span role="columnheader" aria-sort={arah === "naik" ? "ascending" : arah === "turun" ? "descending" : "none"} className={kanan ? "is-kanan" : undefined}>
      <button
        type="button"
        className="nrc__urut"
        data-arah={arah ?? undefined}
        onClick={() => onUrut(arah === null ? { kolom: i, arah: "naik" } : arah === "naik" ? { kolom: i, arah: "turun" } : null)}
      >
        {label}
        <svg viewBox="0 0 8 12" width="8" height="12" aria-hidden="true">
          <path className="nrc__urutnaik" d="M4 1 7 5H1z" />
          <path className="nrc__urutturun" d="M4 11 1 7h6z" />
        </svg>
      </button>
    </span>
  );
}

/** Anak timbangan silinder di piringan. */
function AnakTimbangan({
  a,
  sisi,
  tinggi,
  urutan,
  jatuh,
  redup,
  ket,
  onSentuh,
}: {
  a: Anak;
  sisi: "masuk" | "keluar";
  tinggi: number;
  urutan: number;
  jatuh: boolean;
  redup: boolean;
  ket: ReturnType<typeof pemberiKet>;
  onSentuh: (k: string | null) => void;
}) {
  const sentuh = ket(() => ({
    judul: a.label,
    baris: [{ label: sisi === "masuk" ? "Kas masuk" : "Beban", nilai: formatRupiah(a.nilai) }],
  }));
  return (
    <li
      className={`nrc__anak nrc__anak--${sisi}${jatuh ? " is-jatuh" : ""}${redup ? " is-redup" : ""}${a.sisa ? " is-sisa" : ""}`}
      style={{ height: tinggi, animationDelay: jatuh ? `${urutan * JEDA_ANAK}ms` : undefined }}
      {...sentuh}
      onPointerEnter={(e) => {
        sentuh.onPointerEnter(e);
        if (e.pointerType === "mouse") onSentuh(a.kunci);
      }}
      onPointerLeave={(e) => {
        sentuh.onPointerLeave(e);
        if (e.pointerType === "mouse") onSentuh(null);
      }}
    >
      <b>{a.kode}</b>
      <span>{formatRupiah(a.nilai)}</span>
    </li>
  );
}

/** Muka jarum marjin kas: busur 240°, −40..80%. */
function MukaJarum({ marjin }: { marjin: number | null }) {
  const nada = marjin === null ? "kosong" : marjin >= 30 ? "sehat" : marjin >= 15 ? "cukup" : "tipis";
  const kata = marjin === null ? "" : marjin >= 30 ? "sehat" : marjin >= 15 ? "cukup" : "tipis";
  const garis: { v: number; besar: boolean }[] = [];
  for (let v = JARUM_MIN; v <= JARUM_MAKS; v += 10) garis.push({ v, besar: v % 20 === 0 });
  const titik = (v: number, r: number) => {
    const rad = (sudutJarum(v) * Math.PI) / 180;
    return [70 + r * Math.sin(rad), 70 - r * Math.cos(rad)] as const;
  };
  const busur = (dari: number, ke: number, r: number) => {
    const [x1, y1] = titik(dari, r);
    const [x2, y2] = titik(ke, r);
    const besar = sudutJarum(ke) - sudutJarum(dari) > 180 ? 1 : 0;
    return `M${x1.toFixed(2)} ${y1.toFixed(2)} A${r} ${r} 0 ${besar} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
  };
  return (
    <div className={`nrc__dial is-${nada}`}>
      <svg viewBox="0 0 140 140" aria-hidden="true">
        <path className="nrc__dialzona nrc__dialzona--tipis" d={busur(JARUM_MIN, 15, 42)} />
        <path className="nrc__dialzona nrc__dialzona--sehat" d={busur(30, JARUM_MAKS, 42)} />
        {garis.map(({ v, besar }) => {
          const [x1, y1] = titik(v, 46);
          const [x2, y2] = titik(v, besar ? 53 : 50);
          return <line key={v} className={besar ? "nrc__dialgaris is-besar" : "nrc__dialgaris"} x1={x1} y1={y1} x2={x2} y2={y2} />;
        })}
        {garis
          .filter((g) => g.besar)
          .map(({ v }) => {
            const [x, y] = titik(v, 64.5);
            return (
              <text key={v} x={x} y={y} className="nrc__dialangka" textAnchor="middle" dominantBaseline="central">
                {v}
              </text>
            );
          })}
        <g className="nrc__jarum" style={{ transform: `rotate(${marjin === null ? -128 : sudutJarum(marjin)}deg)` }}>
          <path d="M70 24 L72.4 68 L70 79 L67.6 68 Z" />
        </g>
        <circle cx="70" cy="70" r="6.5" className="nrc__jarumporos" />
      </svg>
      <p className="nrc__dialbaca">
        <b>{marjin === null ? "—" : `${Math.round(marjin)}%`}</b>
        <span>{marjin === null ? "marjin kas" : `marjin kas · ${kata}`}</span>
      </p>
    </div>
  );
}

function Isi() {
  const [proyekId, setProyekId] = useState<string | null>(() => proyekAktif());
  const [rentang, setRentang] = useState(12);
  const kunci = `keuangan:${proyekId ?? "semua"}`;
  const kunciBulan = `keuangan-bulan:${proyekId ?? "semua"}`;

  const [ringkas, setRingkas] = useState<FinanceOverview | null>(() => bacaCache<FinanceOverview>(kunci));
  const [bulanan, setBulanan] = useState<BarisBulanan[] | null>(() => bacaCache<BarisBulanan[]>(kunciBulan));
  const [biaya, setBiaya] = useState<BiayaProyek[] | null>(() => bacaCache<BiayaProyek[]>("biaya-semua"));
  const [bayar, setBayar] = useState<Pembayaran[] | null>(() => bacaCache<Pembayaran[]>("bayar-semua"));
  const [tagihan, setTagihan] = useState<Invoice[] | null>(() => bacaCache<Invoice[]>("tagihan-semua"));
  /* Nama studio dari Info Studio — kunci `settings` milik halaman itu, di
     sini cuma dibaca (jebakan #8). */
  const [studio, setStudio] = useState(() => bacaCache<StudioSettings>("settings")?.studioName || "Studio");
  const [rentangTrx, setRentangTrx] = useState("1");
  const [daftarAktif, setDaftarAktif] = useState<"trx" | "tenggat">("trx");
  /* Yang ditimbang: seluruh catatan, atau satu bulan (YYYY-MM). */
  const [periode, setPeriode] = useState<string>("semua");
  /* Kunci gerak: berganti tiap menimbang, supaya anak timbangan jatuh lagi. */
  const [timbang, setTimbang] = useState(0);
  /* Banyaknya anak timbangan per sisi (dari yang terbesar) yang sudah
     mendarat. Tak hingga = semuanya, keadaan diam. */
  const [mendarat, setMendarat] = useState(Number.POSITIVE_INFINITY);
  const pewaktu = useRef<number[]>([]);
  const [tanpa, setTanpa] = useState<string | null>(null);
  const kabar: KabarKartu = useRef(null);
  const ket = pemberiKet(kabar);
  const lenganUkur = useRef<HTMLDivElement | null>(null);
  const [lebarLengan, setLebarLengan] = useState(400);
  /* Lengan baru boleh berayun SESUDAH lebarnya terukur — tanpa ini ia
     berayun dari tebakan ke lebar sebenarnya tiap halaman dibuka. */
  const [siap, setSiap] = useState(false);

  useEffect(() => onProyekAktif(setProyekId), []);
  useEffect(() => () => pewaktu.current.forEach(clearTimeout), []);

  useEffect(() => {
    semuaBiaya()
      .then((d) => {
        tulisCache("biaya-semua", d);
        setBiaya(d);
      })
      .catch(() => setBiaya((l) => l ?? []));
    semuaPembayaran()
      .then((d) => {
        tulisCache("bayar-semua", d);
        setBayar(d);
      })
      .catch(() => setBayar((l) => l ?? []));
    semuaTagihan()
      .then((d) => {
        tulisCache("tagihan-semua", d);
        setTagihan(d);
      })
      .catch(() => setTagihan((l) => l ?? []));
    ambilSettings()
      .then((s) => setStudio(s.studioName || "Studio"))
      .catch(() => {});
  }, []);

  useEffect(() => {
    let batal = false;
    setRingkas(bacaCache<FinanceOverview>(kunci));
    setBulanan(bacaCache<BarisBulanan[]>(kunciBulan));
    ambilRingkasanKeuangan(proyekId)
      .then((d) => {
        if (!batal) {
          tulisCache(kunci, d);
          setRingkas(d);
        }
      })
      .catch(() => {});
    ambilBulanan(proyekId, 24)
      .then((d) => {
        if (!batal) {
          tulisCache(kunciBulan, d);
          setBulanan(d);
        }
      })
      .catch(() => {});
    return () => {
      batal = true;
    };
  }, [proyekId, kunci, kunciBulan]);

  /* Panjang lengan (lebar tata letaknya, sebelum diputar) — turun-naiknya
     piringan dihitung darinya. Diukur saat ukurannya berubah, bukan saat
     menggulir (jebakan #21). Persennya milik CSS. */
  useEffect(() => {
    const el = lenganUkur.current;
    if (!el) return;
    let bingkai = 0;
    const ro = new ResizeObserver(([e]) => {
      setLebarLengan(e.contentRect.width);
      if (!bingkai) bingkai = requestAnimationFrame(() => requestAnimationFrame(() => setSiap(true)));
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(bingkai);
    };
  }, []);

  /* --- Catatan bulanan (pita pencatat) -------------------------------------- */
  const petaBulan = useMemo(() => new Map((bulanan ?? []).map((b) => [b.bulan, b])), [bulanan]);
  const pita = useMemo(
    () =>
      deretBulan(rentang).map((k) => {
        const b = petaBulan.get(k);
        return { bulan: k, kasMasuk: b?.kasMasuk ?? 0, biaya: b?.biaya ?? 0, labaBersih: b?.labaBersih ?? 0 };
      }),
    [rentang, petaBulan],
  );
  const puncakPita = Math.max(1, ...pita.flatMap((t) => [t.kasMasuk, t.biaya, Math.abs(t.labaBersih)]));
  /* Jejak laba: titik per bulan dalam persen bidang plot (garis nol di 50). */
  const jejak = pita.map((t, i) => ({ x: ((i + 0.5) / pita.length) * 100, y: 50 - (t.labaBersih / puncakPita) * 50, rugi: t.labaBersih < 0 }));

  /* --- Anak timbangan --------------------------------------------------------- */
  const { masuk, keluar } = useMemo(() => {
    if (periode === "semua") {
      const m: Anak[] = (ringkas?.proyek ?? []).map((p) => ({
        kunci: p.projectId,
        kode: kodeProyek(p.projectTitle),
        label: p.projectTitle,
        nilai: p.received,
      }));
      const k: Anak[] = (ringkas?.bebanKategori ?? []).map((b) => ({
        kunci: b.kategori,
        kode: KATEGORI[b.kategori] ?? b.kategori,
        label: KATEGORI[b.kategori] ?? b.kategori,
        nilai: b.nilai,
      }));
      return { masuk: ringkasAnak(m, "Proyek lain"), keluar: ringkasAnak(k, "Kategori lain") };
    }
    const b = petaBulan.get(periode);
    const cocokProyek = (id: string) => !proyekId || id === proyekId;
    const perProyek = new Map<string, Anak>();
    for (const t of tagihan ?? []) {
      if (t.status !== "lunas" || !t.paidAt || t.paidAt.slice(0, 7) !== periode || !cocokProyek(t.projectId)) continue;
      const l = perProyek.get(t.projectId);
      if (l) l.nilai += t.amount;
      else perProyek.set(t.projectId, { kunci: t.projectId, kode: kodeProyek(t.projectTitle ?? "—"), label: t.projectTitle ?? "—", nilai: t.amount });
    }
    const perKategori = new Map<string, Anak>();
    for (const c of biaya ?? []) {
      if (c.incurredOn.slice(0, 7) !== periode || !cocokProyek(c.projectId)) continue;
      const l = perKategori.get(c.category);
      if (l) l.nilai += c.amount;
      else perKategori.set(c.category, { kunci: c.category, kode: KATEGORI[c.category] ?? c.category, label: KATEGORI[c.category] ?? c.category, nilai: c.amount });
    }
    const m = [...perProyek.values()];
    const k = [...perKategori.values()];
    /* Selisih terhadap angka bulanan API jadi "tak terinci" — jumlahnya
       harus sama dengan catatan bulan itu. */
    const sm = (b?.kasMasuk ?? 0) - m.reduce((n, a) => n + a.nilai, 0);
    const sk = (b?.biaya ?? 0) - k.reduce((n, a) => n + a.nilai, 0);
    if (sm > 0) m.push({ kunci: "tak-masuk", kode: "Tak terinci", label: "Tak terinci", nilai: sm, sisa: true });
    if (sk > 0) k.push({ kunci: "tak-keluar", kode: "Tak terinci", label: "Tak terinci", nilai: sk, sisa: true });
    return { masuk: ringkasAnak(m, "Proyek lain"), keluar: ringkasAnak(k, "Kategori lain") };
  }, [periode, ringkas, petaBulan, tagihan, biaya, proyekId]);
  const anakRef = useRef({ masuk, keluar });
  anakRef.current = { masuk, keluar };

  const totalMasuk = masuk.reduce((n, a) => n + a.nilai, 0);
  const totalKeluar = keluar.reduce((n, a) => n + a.nilai, 0);
  /* Yang sedang di piringan: yang sudah mendarat, tanpa yang disentuh. */
  const diPiring = (daftar: Anak[]) => daftar.reduce((n, a, i) => (i < mendarat && a.kunci !== tanpa ? n + a.nilai : n), 0);
  const tampakMasuk = diPiring(masuk);
  const tampakKeluar = diPiring(keluar);
  const laba = tampakMasuk - tampakKeluar;
  const { lengan, piring, gantung, hentak } = useTimbangan(sudutUntuk(tampakMasuk, tampakKeluar), lebarLengan / 2, siap);
  const hitMasuk = useHitung(tampakMasuk);
  const hitKeluar = useHitung(tampakKeluar);
  const hitLaba = useHitung(laba);

  const skala = TUMPUK_MAKS / Math.max(totalMasuk, totalKeluar, 1);
  const tinggiAnak = (a: Anak) => Math.max(ANAK_MIN, Math.round(a.nilai * skala));

  /* Marjin kas dari yang sedang ditimbang; marjin KONTRAK di cap lembar. */
  const marjinKas = tampakMasuk > 0 ? (laba / tampakMasuk) * 100 : null;
  const marjinKontrak = ringkas?.marginRataRata ?? null;

  function pilihPeriode(p: string) {
    if (p === periode) return;
    setPeriode(p);
    setTanpa(null);
    pewaktu.current.forEach(clearTimeout);
    pewaktu.current = [];
    if (!geraknya()) {
      setMendarat(Number.POSITIVE_INFINITY);
      return;
    }
    /* Piringan dikosongkan, lalu anak timbangan mendarat satu per satu. */
    setTimbang((n) => n + 1);
    setMendarat(0);
    for (let i = 0; i < 4; i++) {
      pewaktu.current.push(
        window.setTimeout(() => {
          setMendarat(i + 1);
          const { masuk: m, keluar: k } = anakRef.current;
          const puncak = Math.max(1, ...m.map((a) => a.nilai), ...k.map((a) => a.nilai));
          if (m[i]) hentak(0, m[i]!.nilai / puncak);
          if (k[i]) hentak(1, k[i]!.nilai / puncak);
        }, MENDARAT_MS + i * JEDA_ANAK),
      );
    }
    pewaktu.current.push(window.setTimeout(() => setMendarat(Number.POSITIVE_INFINITY), MENDARAT_MS + 4 * JEDA_ANAK));
  }

  /* Tren: bulan yang ditimbang (atau bulan terakhir) lawan sebelumnya. */
  const kunciKini = periode === "semua" ? kunciBulanDari(new Date()) : periode;
  const iKini = (bulanan ?? []).findIndex((b) => b.bulan === kunciKini);
  const bKini = iKini >= 0 ? bulanan![iKini] : undefined;
  const bLalu = iKini > 0 ? bulanan![iKini - 1] : undefined;
  const tKas = tren(bKini?.kasMasuk, bLalu?.kasMasuk);
  const tBeban = tren(bKini?.biaya, bLalu?.biaya);
  const tLaba = tren(bKini?.labaBersih, bLalu?.labaBersih);

  /* --- Belum ditimbang: piutang per proyek -------------------------------- */
  const belum = useMemo(
    () =>
      (ringkas?.proyek ?? [])
        .filter((p) => (p.contractValue ?? 0) > 0 && (p.belumDiterima ?? 0) > 0)
        .sort((a, b) => (b.belumDiterima ?? 0) - (a.belumDiterima ?? 0))
        .slice(0, 3),
    [ringkas],
  );

  /* --- Transaksi terbaru ---------------------------------------------------- */
  const transaksi = useMemo<Transaksi[]>(() => {
    const batas = batasRentang(Number(rentangTrx));
    const cocok = (projectId: string, waktu: string) =>
      (!proyekId || projectId === proyekId) && (batas === null || waktuKe(waktu, false) >= batas);
    const m = (bayar ?? [])
      .filter((b) => cocok(b.projectId, b.paidAt))
      .map<Transaksi>((b) => ({
        kunci: `p:${b.id}`,
        masuk: true,
        nama: `Pembayaran ${LABEL_JENIS[b.kind] ?? b.kind}`,
        sub: LABEL_METODE[b.method] ?? b.method,
        proyek: b.projectTitle ?? "—",
        waktu: b.paidAt,
        nominal: b.amount,
      }));
    const k = (biaya ?? [])
      .filter((c) => cocok(c.projectId, c.incurredOn))
      .map<Transaksi>((c) => ({
        kunci: `b:${c.id}`,
        masuk: false,
        nama: c.label,
        sub: KATEGORI[c.category] ?? c.category,
        proyek: c.projectTitle ?? "—",
        waktu: c.incurredOn,
        nominal: c.amount,
      }));
    return [...m, ...k].sort((x, y) => waktuKe(y.waktu) - waktuKe(x.waktu)).slice(0, 6);
  }, [bayar, biaya, proyekId, rentangTrx]);
  const urutTrx = useUrutTabel(transaksi, [
    (t) => new Date(t.waktu.length === 10 ? t.waktu + "T00:00:00" : t.waktu).getTime(),
    (t) => t.nama,
    (t) => (t.masuk ? t.nominal : -t.nominal),
  ]);

  /* --- Tenggat tagihan ------------------------------------------------------ */
  const tenggat = useMemo(() => {
    return (tagihan ?? [])
      .filter((t) => t.status === "terbit" && t.dueDate && (!proyekId || t.projectId === proyekId))
      .map((t) => ({ t, sisa: sisaHari(t.dueDate!) }))
      .filter((x): x is { t: Invoice; sisa: number } => x.sisa !== null)
      .sort((x, y) => x.sisa - y.sisa)
      .map(({ t, sisa }) => ({
        kunci: t.id,
        kepala: sisa < 0 ? "Lewat tenggat" : hariTenggat(sisa, t.dueDate!),
        nominal: t.amount,
        keterangan: sisa < 0 ? `lewat ${-sisa} hari` : null,
        teks: `${t.projectTitle ?? "—"} · ${t.label}`,
        lewat: sisa < 0,
      }));
  }, [tagihan, proyekId]);

  const judulPeriode = periode === "semua" ? "Seluruh catatan" : namaBulan(periode);
  /* Kode, bukan nama: kode itulah yang tertulis di anak timbangan yang
     disentuh, dan nama proyek terpotong di pelat laba. */
  const nTanpa = tanpa ? [...masuk, ...keluar].find((a) => a.kunci === tanpa)?.kode : null;
  const kosong = totalMasuk === 0 && totalKeluar === 0;
  const bulanKini = kunciBulanDari(new Date());
  const ujung = jejak[jejak.length - 1];

  return (
    <div className="nrc">
      <div className="nrc__papan">
        {/* ---- Timbangan ------------------------------------------------------ */}
        <section className="nrc__timbang" aria-label="Neraca studio">
          <header className="nrc__kepala">
            <p className="nrc__alis">
              Neraca studio <span>· {judulPeriode}</span>
              {bLalu && (tKas || tBeban || tLaba) && (
                <span className="nrc__alistren">
                  {" "}
                  · panah: {pendekBulan(kunciKini)} dibanding {pendekBulan(bLalu.bulan)}
                </span>
              )}
            </p>
            {periode !== "semua" && (
              <button type="button" className="nrc__kembali" onClick={() => pilihPeriode("semua")}>
                Timbang seluruh catatan
              </button>
            )}
          </header>

          <div className="nrc__alat" aria-describedby="nrc-ringkas">
            {/* Alas bertingkat, tiang, muka jarum, pelat laba. */}
            <i className="nrc__bayang" aria-hidden="true" />
            <i className="nrc__alas" aria-hidden="true" />
            <i className="nrc__tiang nrc__tiang--atas" aria-hidden="true" />
            <i className="nrc__tiang nrc__tiang--bawah" aria-hidden="true" />
            <MukaJarum marjin={marjinKas} />
            <div className={`nrc__laba${hitLaba < 0 ? " is-rugi" : ""}`}>
              <span>
                {nTanpa ? `Laba tanpa ${nTanpa}` : "Laba bersih"}
                {!nTanpa && tLaba && (
                  <LencanaTren panah naik={tLaba.naik}>
                    {tLaba.teks}
                  </LencanaTren>
                )}
              </span>
              <b>{formatRupiah(hitLaba)}</b>
            </div>

            {/* Lengan, poros, medali studio. */}
            <div
              className="nrc__lengan"
              ref={(el) => {
                lengan.current = el;
                lenganUkur.current = el;
              }}
              aria-hidden="true"
            >
              <i className="nrc__lenganujung" />
              <i className="nrc__lenganujung nrc__lenganujung--kanan" />
            </div>
            <i className="nrc__poros" aria-hidden="true" />
            <span className="nrc__medali" aria-label={studio}>
              {inisial(studio) || "S"}
            </span>

            {/* Piringan. */}
            {(["masuk", "keluar"] as const).map((sisi, si) => {
              const anak = sisi === "masuk" ? masuk : keluar;
              const total = sisi === "masuk" ? hitMasuk : hitKeluar;
              const t = sisi === "masuk" ? tKas : tBeban;
              return (
                <div
                  key={sisi}
                  className={`nrc__piring nrc__piring--${sisi}`}
                  ref={(el) => {
                    piring.current[si] = el;
                  }}
                >
                  <div
                    className="nrc__gantung"
                    ref={(el) => {
                      gantung.current[si] = el;
                    }}
                  >
                    <i className="nrc__kait" aria-hidden="true" />
                    <i className="nrc__busur" aria-hidden="true" />
                    <ol className="nrc__tumpuk" key={`${sisi}-${timbang}`} aria-label={sisi === "masuk" ? "Kas masuk per proyek" : "Beban per kategori"}>
                      {anak.length === 0 && <li className="nrc__anakkosong">{kosong ? "belum ada catatan" : "kosong"}</li>}
                      {anak.map((a, i) => (
                        <AnakTimbangan
                          key={a.kunci}
                          a={a}
                          sisi={sisi}
                          tinggi={tinggiAnak(a)}
                          urutan={i}
                          jatuh={timbang > 0}
                          redup={tanpa === a.kunci}
                          ket={ket}
                          onSentuh={setTanpa}
                        />
                      ))}
                    </ol>
                    <i className="nrc__pinggan" aria-hidden="true" />
                  </div>
                  <p className="nrc__piringlabel">
                    <span>
                      {sisi === "masuk" ? "Kas masuk" : "Beban"}
                      {t && (
                        <LencanaTren panah naik={t.naik} baik={sisi === "masuk" ? t.naik : !t.naik}>
                          {t.teks}
                        </LencanaTren>
                      )}
                    </span>
                    <b>{formatRupiah(total)}</b>
                  </p>
                </div>
              );
            })}
            <p id="nrc-ringkas" className="sr-only">
              {`${judulPeriode}: kas masuk ${formatRupiah(tampakMasuk)}, beban ${formatRupiah(tampakKeluar)}, laba bersih ${formatRupiah(laba)}${marjinKas === null ? "" : `, marjin kas ${Math.round(marjinKas)}%`}.`}
            </p>
          </div>
        </section>

        {/* ---- Lembar neraca (bentuk T) --------------------------------------- */}
        <section className="nrc__lembar" aria-label="Lembar neraca">
          <header className="nrc__lembarkop">
            <div className="nrc__lembarjudul">
              <h3>Neraca</h3>
              <p>{judulPeriode}</p>
            </div>
            {marjinKontrak !== null && (
              <p className={`nrc__cap is-${marjinKontrak >= 30 ? "sehat" : marjinKontrak >= 15 ? "cukup" : "tipis"}`}>
                <span>Marjin kontrak</span>
                <b>{Math.round(marjinKontrak)}%</b>
              </p>
            )}
          </header>
          <div className="nrc__t">
            <div className="nrc__tsisi">
              <p className="nrc__tjudul">Masuk</p>
              <ul>
                {masuk.map((a) => (
                  <li key={a.kunci} className={tanpa === a.kunci ? "is-sorot" : undefined}>
                    <span>{a.label}</span>
                    <b>{formatRupiah(a.nilai)}</b>
                  </li>
                ))}
                {masuk.length === 0 && <li className="nrc__tkosong">—</li>}
              </ul>
              <p className="nrc__tjumlah">
                <span>Jumlah</span>
                <b>{formatRupiah(totalMasuk)}</b>
              </p>
            </div>
            <div className="nrc__tsisi">
              <p className="nrc__tjudul">Keluar</p>
              <ul>
                {keluar.map((a) => (
                  <li key={a.kunci} className={tanpa === a.kunci ? "is-sorot" : undefined}>
                    <span>{a.label}</span>
                    <b>{formatRupiah(a.nilai)}</b>
                  </li>
                ))}
                {keluar.length === 0 && <li className="nrc__tkosong">—</li>}
              </ul>
              <p className="nrc__tjumlah">
                <span>Jumlah</span>
                <b>{formatRupiah(totalKeluar)}</b>
              </p>
            </div>
          </div>
          <p className={`nrc__saldo${totalMasuk - totalKeluar < 0 ? " is-rugi" : ""}`}>
            <span>Saldo · laba bersih</span>
            <b>{formatRupiah(totalMasuk - totalKeluar)}</b>
          </p>
          <div className="nrc__belum">
            <p className="nrc__belumkepala">
              <span>Belum ditimbang · piutang</span>
              <b>{formatRupiah(ringkas?.piutang ?? 0)}</b>
            </p>
            <ul>
              {belum.map((p) => {
                const pct = Math.min(100, (p.received / (p.contractValue || 1)) * 100);
                return (
                  <li key={p.projectId}>
                    <span className="nrc__belumnama">{p.projectTitle}</span>
                    <span className="nrc__belumbar" aria-hidden="true">
                      <i style={{ width: `${pct}%` }} />
                    </span>
                    <b>{formatRupiah(p.belumDiterima ?? 0)}</b>
                  </li>
                );
              })}
              {belum.length === 0 && <li className="nrc__tkosong">Semua kontrak sudah masuk.</li>}
            </ul>
            <p className="nrc__belumkaki">
              dari nilai kontrak {formatRupiah(ringkas?.totalKontrak ?? 0)} ·{" "}
              <a href="/admin/keuangan/tagihan">Tagihan &amp; termin</a>
            </p>
          </div>
        </section>

        {/* ---- Pita pencatat bulanan --------------------------------------------- */}
        <section className="nrc__catatan" aria-label="Pita pencatat per bulan">
          <header className="nrc__kepala">
            <p className="nrc__alis">
              Pita pencatat <span>· klik bulan untuk menimbangnya</span>
            </p>
            <p className="nrc__legenda" aria-hidden="true">
              <span>
                <i className="is-masuk" />
                kas masuk
              </span>
              <span>
                <i className="is-beban" />
                beban
              </span>
              <span>
                <i className="is-laba" />
                laba
              </span>
            </p>
            <button type="button" className="nrc__kembali" onClick={() => setRentang((r) => (r === 12 ? 24 : 12))}>
              {rentang} bulan
            </button>
          </header>
          <div className="nrc__pita">
            <i className="nrc__rol nrc__rol--kiri" aria-hidden="true" />
            <div className="nrc__grafik">
              <i className="nrc__kisi" aria-hidden="true" />
              <ol className="nrc__bulan" style={{ "--nrc-n": pita.length } as CSSProperties}>
                {pita.map((t) => {
                  const pilih = periode === t.bulan;
                  const kosongT = !t.kasMasuk && !t.biaya;
                  return (
                    <li key={t.bulan}>
                      <button
                        type="button"
                        className={`nrc__tiketb${pilih ? " is-pilih" : ""}${kosongT ? " is-kosong" : ""}${t.bulan === bulanKini ? " is-kini" : ""}`}
                        aria-pressed={pilih}
                        aria-label={`${namaBulan(t.bulan)}: kas masuk ${formatRupiah(t.kasMasuk)}, beban ${formatRupiah(t.biaya)}`}
                        onClick={() => pilihPeriode(pilih ? "semua" : t.bulan)}
                        {...ket(() => ({
                          judul: namaBulan(t.bulan),
                          baris: [
                            { label: "Kas masuk", nilai: formatRupiah(t.kasMasuk) },
                            { label: "Beban", nilai: formatRupiah(t.biaya) },
                            { label: "Laba", nilai: formatRupiah(t.labaBersih) },
                          ],
                        }))}
                      >
                        <span className="nrc__tiketatas">
                          <i style={{ height: `${(t.kasMasuk / puncakPita) * 100}%` }} />
                        </span>
                        <span className="nrc__tiketbawah">
                          <i style={{ height: `${(t.biaya / puncakPita) * 100}%` }} />
                        </span>
                        <small>{pendekBulan(t.bulan)}</small>
                      </button>
                    </li>
                  );
                })}
              </ol>
              {/* Jejak tinta laba + pena di bulan berjalan. */}
              <div className="nrc__jejak" aria-hidden="true">
                <svg viewBox="0 0 100 100" preserveAspectRatio="none">
                  <polyline points={jejak.map((j) => `${j.x.toFixed(2)},${j.y.toFixed(2)}`).join(" ")} />
                </svg>
                {jejak.map((j, i) => (
                  <i
                    key={pita[i]!.bulan}
                    className={`nrc__jejaktitik${j.rugi ? " is-rugi" : ""}${periode === pita[i]!.bulan ? " is-pilih" : ""}`}
                    style={{ left: `${j.x}%`, top: `${j.y}%` }}
                  />
                ))}
                {ujung && (
                  <span className="nrc__pena" style={{ left: `${ujung.x}%`, top: `${ujung.y}%` }}>
                    <svg viewBox="0 0 40 12" width="40" height="12">
                      <path className="nrc__penaujung" d="M0 6 L10 2.5 L10 9.5 Z" />
                      <rect className="nrc__penabatang" x="10" y="2.5" width="30" height="7" rx="1.5" />
                    </svg>
                  </span>
                )}
              </div>
            </div>
            <i className="nrc__rol nrc__rol--kanan" aria-hidden="true" />
          </div>
        </section>

        {/* ---- Transaksi & tenggat ---------------------------------------------- */}
        <section className="nrc__daftar" aria-label="Transaksi dan tenggat">
          <header className="nrc__daftarkepala">
            <Segmen
              judul="Daftar"
              className="nrc__segmen"
              nilai={daftarAktif}
              onPilih={(v) => setDaftarAktif(v as "trx" | "tenggat")}
              segmen={[
                { nilai: "trx", label: "Transaksi" },
                { nilai: "tenggat", label: `Tenggat${tenggat.length ? ` · ${tenggat.length}` : ""}` },
              ]}
            />
            {daftarAktif === "trx" ? (
              <>
                <PilihTombol judul="Rentang transaksi" jenis="ghost" ukuran="small" className="nrc__rentang" nilai={rentangTrx} opsi={RENTANG} onPilih={setRentangTrx} />
                <a className="nrc__ikontaut" href="/admin/keuangan/transaksi" aria-label="Saring lebih rinci di Semua Transaksi">
                  <Ikon ikon={Sliders} ukuran={16} />
                </a>
              </>
            ) : (
              <a className="nrc__taut" href="/admin/keuangan/tagihan">
                Tagihan &amp; termin
              </a>
            )}
          </header>
          {daftarAktif === "trx" ? (
            <div className="nrc__trx" role="table" aria-label="Transaksi terbaru">
              <div className="nrc__trxkepala" role="row">
                <KepalaUrut label="Tanggal" i={0} urutan={urutTrx.urutan} onUrut={urutTrx.onUrut} />
                <KepalaUrut label="Transaksi" i={1} urutan={urutTrx.urutan} onUrut={urutTrx.onUrut} />
                <KepalaUrut label="Nominal" i={2} urutan={urutTrx.urutan} onUrut={urutTrx.onUrut} kanan />
              </div>
              {urutTrx.terurut.map((t) => {
                const d = new Date(t.waktu.length === 10 ? t.waktu + "T00:00:00" : t.waktu);
                return (
                  <div key={t.kunci} className="nrc__trxbaris" role="row">
                    <span role="cell" className="nrc__trxtgl">
                      {d.getDate()} {BULAN_PENDEK[d.getMonth()]}
                    </span>
                    <span role="cell" className="nrc__trxnama">
                      <span className={`nrc__trxubin${t.masuk ? "" : " is-keluar"}`}>
                        <Ikon ikon={t.masuk ? CoinIn : CoinOut} ukuran={14} />
                      </span>
                      <span>
                        <b>{t.nama}</b>
                        <small>
                          {t.sub} · {t.proyek}
                        </small>
                      </span>
                    </span>
                    <span role="cell" className={`nrc__trxrp${t.masuk ? " is-masuk" : ""}`}>
                      {t.masuk ? "+" : "−"}
                      {formatRupiah(t.nominal)}
                    </span>
                  </div>
                );
              })}
              {transaksi.length === 0 && (
                <p className="nrc__kosong">{bayar === null || biaya === null ? "Memuat transaksi…" : "Belum ada transaksi pada rentang ini."}</p>
              )}
            </div>
          ) : (
            <div className="nrc__tenggat">
              {tenggat.map((t, i) => (
                <div key={t.kunci} className="nrc__tenggatbaris">
                  {(i === 0 || tenggat[i - 1]!.kepala !== t.kepala) && (
                    <p className={`nrc__harilabel${t.lewat ? " is-lewat" : ""}`}>{t.kepala}</p>
                  )}
                  <p className="nrc__tenggatisi">
                    <span className={`nrc__trxubin${t.lewat ? " is-lewat" : ""}`}>
                      <Ikon ikon={t.lewat ? HourglassHigh : NavCalendarDots} ukuran={14} />
                    </span>
                    <span>
                      <b>
                        {formatRupiah(t.nominal)}
                        {t.keterangan && <em> · {t.keterangan}</em>}
                      </b>
                      <small>{t.teks}</small>
                    </span>
                  </p>
                </div>
              ))}
              {tenggat.length === 0 && (
                <p className="nrc__kosong">{tagihan === null ? "Memuat tagihan…" : "Tidak ada tagihan terbit yang menunggu dibayar."}</p>
              )}
            </div>
          )}
        </section>
      </div>
      <Keterangan kabar={kabar} />
    </div>
  );
}

export function RingkasanKit() {
  return (
    <RequireAuth
      skeleton={
        <div className="nrc nrc--rangka">
          <div className="nrc__papan" />
        </div>
      }
    >
      <Isi />
    </RequireAuth>
  );
}
