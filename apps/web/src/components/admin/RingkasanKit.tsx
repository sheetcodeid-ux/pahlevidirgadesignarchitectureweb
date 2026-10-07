import { createContext, memo, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { RequireAuth } from "./RequireAuth";
import { PilihTombol } from "../kit/Formulir";
import { Segmen } from "../kit/Segmen";
import { useUrutTabel, type Urutan } from "../kit/Tabel";
import { Ikon } from "../kit/Ikon";
import { Keterangan, pemberiKet, type KabarKartu } from "../kit/kartuGrafik";
import { Sliders } from "../kit/ikon";
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
import { formatRupiah, formatRupiahRingkas } from "../../lib/format";
import { kodeProyek } from "../../lib/nomorDokumen";

/* =============================================================================
   Keuangan — Ringkasan = PAPAN BURSA STUDIO.

   Benda dunia nyata yang memang dibuat untuk MERINGKAS keadaan keuangan
   dalam sekali lihat adalah papan kurs mekanis — papan split-flap di lantai
   bursa dan di money changer. Halaman ini papan itu, dan berperilaku
   seperti papan itu:

   1. INDEKS — LABA BERSIH dalam keping besar (seperti indeks gabungan),
      perubahannya dari bulan sebelumnya, dan empat sub-indeks: kas masuk,
      beban, piutang, marjin kas.
   2. GRAFIK LILIN saldo kas kumulatif per bulan, seperti terminal saham.
      Lilinnya JUJUR: buka = saldo awal bulan, tutup = saldo akhir, sumbu
      atas = buka + kas masuk (kalau semua uang masuk lebih dulu), sumbu
      bawah = buka − beban (kalau semua biaya keluar lebih dulu) — rentang
      yang memang mungkin dilalui saldo bulan itu. Saldo dihitung sejak
      bulan pertama di jendela grafik. Klik lilin = papan menampilkan bulan
      itu.
   3. KURS PROYEK — satu baris per proyek, kode proyek sebagai kode saham:
      masuk, beban, laba, dan panah naik/turun.
   4. TRANSAKSI dan JATUH TEMPO — papan jadwal: tanggal, kode, keterangan,
      nominal; tenggat tagihan dengan status (LEWAT n HR, BESOK, …).

   SATU-SATUNYA gerak (3D): saat periode berganti, setiap keping yang isinya
   berubah BERPUTAR melewati beberapa huruf di drumnya sampai berhenti di
   isi barunya — daun atas jatuh ke depan (`rotateX` 0 → −90°), daun bawah
   isi baru turun menutup (90° → 0). Berderet: indeks dulu, lalu sub-indeks,
   kurs baris demi baris, papan jadwal; dalam satu deret dari kiri ke kanan.
   Baris papan berkunci URUTAN (slot fisik), jadi slot yang berganti proyek
   ikut berputar. Tidak berputar saat dimuat, dan seketika bila gerak
   dikurangi. Tiap keping memegang pewaktunya sendiri dan berhenti begitu
   sampai — tidak ada animasi abadi (jebakan #22).

   Datanya tidak berubah dari versi sebelumnya: ringkasan, bulanan (24
   bulan), tagihan, biaya, dan pembayaran dari kunci cache yang sama.
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

const RENTANG = [
  { nilai: "1", label: "Bulan ini" },
  { nilai: "3", label: "3 bulan" },
  { nilai: "12", label: "12 bulan" },
  { nilai: "0", label: "Semua" },
];

/** Lebar slot keping untuk rupiah bertanda — angka rata kanan seperti papan kurs. */
const LEBAR_RP = 14;
/** Satu langkah putaran keping, dan jeda antarkeping dalam satu deret. */
const LANGKAH_MS = 74;
const JEDA_KEPING = 22;
/** Urutan huruf di drum keping angka. Huruf di luar drum langsung berganti. */
const DRUM = " 0123456789";

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

const kunciBulanDari = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const namaBulan = (k: string) => `${BULAN[Number(k.slice(5, 7)) - 1]} ${k.slice(0, 4)}`;
const pendekBulan = (k: string) => BULAN_PENDEK[Number(k.slice(5, 7)) - 1] ?? k;
const tglPendek = (iso: string) => {
  const d = new Date(iso.length === 10 ? iso + "T00:00:00" : iso);
  return `${String(d.getDate()).padStart(2, "0")} ${BULAN_PENDEK[d.getMonth()]!.toUpperCase()}`;
};

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

function tren(kini?: number, lalu?: number) {
  if (kini === undefined || lalu === undefined || !lalu) return null;
  const p = ((kini - lalu) / Math.abs(lalu)) * 100;
  return { naik: p >= 0, teks: `${p >= 0 ? "▲" : "▼"} ${Math.abs(p).toFixed(1).replace(".", ",")}%` };
}

/** Langkah sumbu yang enak dibaca: 1/2/2,5/5 × 10^k. */
function langkahRapi(rentang: number, banyak: number): number {
  const kasar = rentang / Math.max(1, banyak);
  const pangkat = Math.pow(10, Math.floor(Math.log10(kasar || 1)));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * pangkat >= kasar) return m * pangkat;
  return 10 * pangkat;
}

const geraknya = () =>
  typeof window !== "undefined" && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Huruf-huruf yang dilewati drum dari `dari` ke `ke` (termasuk `ke`),
 *  paling banyak lima — keping yang jauh "melompat" dulu, seperti papan
 *  sungguhan yang drumnya berputar cepat. */
function langkahDrum(dari: string, ke: string): string[] {
  const a = DRUM.indexOf(dari);
  const b = DRUM.indexOf(ke);
  if (a < 0 || b < 0) return [ke];
  const jarak = (b - a + DRUM.length) % DRUM.length;
  const n = Math.min(jarak, 5);
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) out.push(DRUM[(b - i + DRUM.length) % DRUM.length]!);
  return out;
}

/** Keping baru boleh berputar sesudah data pertama tampil — tanpa ini papan
 *  berputar dari "Rp0" ke angka sungguhan tiap halaman dibuka. */
const PapanHidup = createContext(false);

/* -----------------------------------------------------------------------------
   Satu keping papan: dua daun diam (atas = isi kini, bawah = isi sebelumnya
   selama berputar) dan dua daun gerak (atas lama yang jatuh, bawah baru
   yang menutup). Diputar LANGSUNG di DOM lewat Web Animations — React tidak
   merender ulang per langkah. Versi pertama memakai state per keping: ±2.000
   render dalam 1,5 detik saat satu bulan dipilih, dan main thread tertahan
   sampai tangkapan layar pun menunggu setengah detik. Animasinya hanya
   `transform`, jadi dikerjakan compositor. `tunda` dibaca lewat ref — kalau
   ia ikut jadi dependensi efek, perubahan tunda saja memotong putaran di
   tengah dan kepingnya berhenti di huruf antara.
   -------------------------------------------------------------------------- */
/* Saat diam daun atas gerak cuma TIDAK TAMPAK (opacity 0), bukan terlipat:
   `rotateX` yang menetap — dan `backface-visibility` — memaksa satu lapisan
   compositor per keping, ±1.300 lapisan terus-menerus, dan seluruh papan
   tersendat. Transform 3D hanya ada selama daunnya berputar. */
const JATUH: Keyframe[] = [
  { transform: "rotateX(0deg)", opacity: 1 },
  { transform: "rotateX(-90deg)", opacity: 1, offset: 0.5 },
  { transform: "rotateX(-90deg)", opacity: 0 },
];
const TUTUP: Keyframe[] = [{ transform: "rotateX(90deg)" }, { transform: "rotateX(90deg)", offset: 0.5 }, { transform: "rotateX(0deg)" }];

const Keping = memo(function Keping({ c, tunda, kata }: { c: string; tunda: number; kata?: boolean }) {
  const atas = useRef<HTMLElement>(null);
  const bawah = useRef<HTMLElement>(null);
  const daunA = useRef<HTMLSpanElement>(null);
  const daunB = useRef<HTMLSpanElement>(null);
  const tampil = useRef(c);
  const tujuan = useRef(c);
  const tundaRef = useRef(tunda);
  tundaRef.current = tunda;
  const hidup = useContext(PapanHidup);
  const hidupRef = useRef(hidup);
  hidupRef.current = hidup;

  const tulis = (el: HTMLElement | null | undefined, t: string) => {
    if (el && el.textContent !== t) el.textContent = t;
  };
  /* Isi pertama ditulis sebelum dilukis; sesudahnya React tidak pernah
     menyentuh teks keping. */
  useLayoutEffect(() => {
    tulis(atas.current, c);
    tulis(bawah.current, c);
    tulis(daunA.current?.firstElementChild as HTMLElement, c);
    tulis(daunB.current?.firstElementChild as HTMLElement, c);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (c === tujuan.current) return;
    tujuan.current = c;
    const diam = (t: string) => {
      tampil.current = t;
      tulis(atas.current, t);
      tulis(bawah.current, t);
      tulis(daunA.current?.firstElementChild as HTMLElement, t);
      tulis(daunB.current?.firstElementChild as HTMLElement, t);
      daunA.current?.getAnimations().forEach((a) => a.cancel());
      daunB.current?.getAnimations().forEach((a) => a.cancel());
    };
    if (!geraknya() || !hidupRef.current || !daunA.current?.animate) {
      diam(c);
      return;
    }
    const urut = kata ? [c] : langkahDrum(tampil.current, c);
    const putar = (ch: string) => {
      const lama = tampil.current;
      tampil.current = ch;
      tulis(atas.current, ch);
      tulis(bawah.current, lama);
      tulis(daunA.current?.firstElementChild as HTMLElement, lama);
      tulis(daunB.current?.firstElementChild as HTMLElement, ch);
      daunA.current?.getAnimations().forEach((x) => x.cancel());
      daunB.current?.getAnimations().forEach((x) => x.cancel());
      daunA.current?.animate(JATUH, { duration: LANGKAH_MS, easing: "ease-in" });
      const b = daunB.current?.animate(TUTUP, { duration: LANGKAH_MS, easing: "ease-out" });
      /* Sampai: animasi selesai tanpa `fill` — daunnya kembali ke rupa diam
         CSS (atas terlipat, bawah menutup), yang isinya sudah huruf baru.
         Animasi yang dibiarkan menahan rupa akhirnya menumpuk ratusan. */
      if (b) b.onfinish = () => tampil.current === ch && tulis(bawah.current, ch);
    };
    const pw = urut.map((ch, i) => window.setTimeout(() => putar(ch), tundaRef.current + i * LANGKAH_MS));
    /* Terpotong di tengah (isi berganti lagi): putaran berikutnya mulai
       dari huruf yang sedang tampil, jadi keping tetap berakhir di isinya. */
    return () => pw.forEach(clearTimeout);
  }, [c, kata]);

  return (
    <span className={kata ? "bsr__k bsr__k--kata" : "bsr__k"}>
      <span className="bsr__kd bsr__kd--a">
        <i ref={atas} />
      </span>
      <span className="bsr__kd bsr__kd--b">
        <i ref={bawah} />
      </span>
      <span ref={daunA} className="bsr__kd bsr__kd--a bsr__daun-a">
        <i />
      </span>
      <span ref={daunB} className="bsr__kd bsr__kd--b bsr__daun-b">
        <i />
      </span>
    </span>
  );
});

/** Satu deret keping untuk sebuah teks, rata kanan dalam `lebar` slot. */
function Deret({ teks, lebar, tunda = 0, kelas = "", label }: { teks: string; lebar?: number; tunda?: number; kelas?: string; label?: string }) {
  const isi = lebar ? teks.padStart(lebar, " ") : teks;
  return (
    <span className={`bsr__deret ${kelas}`}>
      <span className="sr-only">{label ?? teks}</span>
      <span className="bsr__keping" aria-hidden="true">
        {[...isi].map((ch, i) => (
          <Keping key={i} c={ch} tunda={tunda + i * JEDA_KEPING} />
        ))}
      </span>
    </span>
  );
}

/** Keping selebar kata — seperti keping nama kota di papan stasiun. */
function Kata({ teks, tunda = 0, kelas = "" }: { teks: string; tunda?: number; kelas?: string }) {
  return (
    <span className={`bsr__deret bsr__deret--kata ${kelas}`} title={teks || undefined}>
      <span className="sr-only">{teks}</span>
      <span className="bsr__keping" aria-hidden="true">
        <Keping c={teks} tunda={tunda} kata />
      </span>
    </span>
  );
}

/** Kepala kolom yang bisa mengurutkan (pola Tabel kit). */
function KepalaUrut({ label, i, urutan, onUrut, kanan }: { label: string; i: number; urutan: Urutan | null; onUrut: (u: Urutan | null) => void; kanan?: boolean }) {
  const arah = urutan?.kolom === i ? urutan.arah : null;
  return (
    <span role="columnheader" aria-sort={arah === "naik" ? "ascending" : arah === "turun" ? "descending" : "none"} className={kanan ? "is-kanan" : undefined}>
      <button
        type="button"
        className="bsr__urut"
        data-arah={arah ?? undefined}
        onClick={() => onUrut(arah === null ? { kolom: i, arah: "naik" } : arah === "naik" ? { kolom: i, arah: "turun" } : null)}
      >
        {label}
        <svg viewBox="0 0 8 12" width="8" height="12" aria-hidden="true">
          <path className="bsr__urutnaik" d="M4 1 7 5H1z" />
          <path className="bsr__urutturun" d="M4 11 1 7h6z" />
        </svg>
      </button>
    </span>
  );
}

interface Lilin {
  bulan: string;
  buka: number;
  tutup: number;
  atas: number;
  bawah: number;
  masuk: number;
  beban: number;
  laba: number;
}

/* -----------------------------------------------------------------------------
   Grafik lilin saldo kas kumulatif. Digambar dalam piksel sebenarnya
   (ukurannya dibaca ResizeObserver, bukan saat menggulir — jebakan #21),
   jadi garis dan angka sumbu tajam. Tombol per bulan di atasnya untuk klik,
   papan ketik, dan kartu keterangan; menyentuhnya (tetikus) memasang garis
   silang dan label harga di sumbu.
   -------------------------------------------------------------------------- */
function GrafikLilin({
  lilin,
  pilih,
  onPilih,
  ket,
}: {
  lilin: Lilin[];
  pilih: string;
  onPilih: (b: string) => void;
  ket: ReturnType<typeof pemberiKet>;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [uk, setUk] = useState({ w: 600, h: 200 });
  const [sorot, setSorot] = useState<number | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setUk({ w: Math.round(e.contentRect.width), h: Math.round(e.contentRect.height) }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const SUMBU = 70;
  const BAWAH = 20;
  const ATAS = 10;
  const lebarPlot = Math.max(40, uk.w - SUMBU);
  const tinggiPlot = Math.max(40, uk.h - BAWAH - ATAS);
  const min = Math.min(0, ...lilin.map((l) => l.bawah));
  const maks = Math.max(1, ...lilin.map((l) => l.atas));
  const langkah = langkahRapi(maks - min, 4);
  const bawahSumbu = Math.floor(min / langkah) * langkah;
  const atasSumbu = Math.ceil(maks / langkah) * langkah;
  const y = (v: number) => ATAS + tinggiPlot - ((v - bawahSumbu) / (atasSumbu - bawahSumbu || 1)) * tinggiPlot;
  const kol = lebarPlot / Math.max(1, lilin.length);
  const x = (i: number) => (i + 0.5) * kol;
  const lebarBadan = Math.max(3, Math.min(18, kol * 0.5));
  const garis: number[] = [];
  for (let v = bawahSumbu; v <= atasSumbu + langkah / 2; v += langkah) garis.push(v);
  const iPilih = lilin.findIndex((l) => l.bulan === pilih);
  const iTanda = sorot ?? (iPilih >= 0 ? iPilih : null);
  const tanda = iTanda !== null ? lilin[iTanda] : undefined;
  const yTanda = tanda ? y(tanda.tutup) : null;
  const jarangLabel = lilin.length > 14;

  return (
    <div className="bsr__lilin" ref={ref}>
      <svg width={uk.w} height={uk.h} aria-hidden="true">
        {garis.map((v) => (
          <g key={v}>
            <line className={v === 0 ? "bsr__lilinnol" : "bsr__lilinkisi"} x1={0} x2={lebarPlot} y1={y(v)} y2={y(v)} />
            {(yTanda === null || Math.abs(y(v) - yTanda) > 12) && (
              <text className="bsr__lilinsumbu" x={lebarPlot + 10} y={y(v)} dominantBaseline="central">
                {formatRupiahRingkas(v)}
              </text>
            )}
          </g>
        ))}
        {iTanda !== null && tanda && yTanda !== null && (
          <g className={iTanda !== iPilih ? "bsr__silang is-sorot" : "bsr__silang"}>
            <rect className="bsr__silangkolom" x={iTanda * kol} y={ATAS} width={kol} height={tinggiPlot} />
            <line x1={0} x2={lebarPlot} y1={yTanda} y2={yTanda} />
            <rect className="bsr__silangtag" x={lebarPlot + 3} y={yTanda - 8.5} width={SUMBU - 5} height={17} rx={3} />
            <text className="bsr__silangteks" x={lebarPlot + 10} y={yTanda} dominantBaseline="central">
              {formatRupiahRingkas(tanda.tutup)}
            </text>
          </g>
        )}
        {lilin.map((l, i) => {
          const naik = l.tutup >= l.buka;
          const yb = y(Math.max(l.buka, l.tutup));
          const tb = Math.max(1.5, Math.abs(y(l.buka) - y(l.tutup)));
          return (
            <g key={l.bulan} className={`bsr__batang${naik ? " is-naik" : " is-turun"}${l.bulan === pilih ? " is-pilih" : ""}`}>
              <line x1={x(i)} x2={x(i)} y1={y(l.atas)} y2={y(l.bawah)} />
              <rect x={x(i) - lebarBadan / 2} y={yb} width={lebarBadan} height={tb} rx={1.5} />
            </g>
          );
        })}
        {lilin.map((l, i) =>
          jarangLabel && i % 2 === 1 && i !== lilin.length - 1 ? null : (
            <text key={l.bulan} className={`bsr__lilinbulan${l.bulan === pilih ? " is-pilih" : ""}`} x={x(i)} y={uk.h - 5} textAnchor="middle">
              {pendekBulan(l.bulan)}
            </text>
          ),
        )}
      </svg>
      <ol className="bsr__lilintombol" style={{ width: lebarPlot, "--bsr-n": lilin.length } as CSSProperties}>
        {lilin.map((l, i) => {
          const k = ket(() => ({
            judul: namaBulan(l.bulan),
            baris: [
              { label: "Saldo awal", nilai: formatRupiah(l.buka) },
              { label: "Kas masuk", nilai: formatRupiah(l.masuk) },
              { label: "Beban", nilai: formatRupiah(l.beban) },
              { label: "Saldo akhir", nilai: formatRupiah(l.tutup) },
            ],
          }));
          return (
            <li key={l.bulan}>
              <button
                type="button"
                className="bsr__lilinb"
                aria-pressed={l.bulan === pilih}
                aria-label={`${namaBulan(l.bulan)}: kas masuk ${formatRupiah(l.masuk)}, beban ${formatRupiah(l.beban)}, saldo akhir ${formatRupiah(l.tutup)}`}
                onClick={() => onPilih(l.bulan)}
                {...k}
                onPointerEnter={(e) => {
                  k.onPointerEnter(e);
                  if (e.pointerType === "mouse") setSorot(i);
                }}
                onPointerLeave={(e) => {
                  k.onPointerLeave(e);
                  if (e.pointerType === "mouse") setSorot(null);
                }}
              />
            </li>
          );
        })}
      </ol>
    </div>
  );
}

interface Kurs {
  kunci: string;
  kode: string;
  nama: string;
  masuk: number;
  beban: number;
  laba: number;
  sisa: number | null;
  id: string | null;
}

interface Transaksi {
  kunci: string;
  masuk: boolean;
  nama: string;
  kode: string;
  proyek: string;
  waktu: string;
  nominal: number;
}

const kode3 = (k: string) => k.padEnd(3, " ").slice(0, 3);
/** Kode proyek, atau tanda pisah untuk catatan tanpa proyek (kas studio). */
const kodeDari = (judul?: string | null) => (judul ? kodeProyek(judul) : "—");

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
  const [diperbarui, setDiperbarui] = useState<Date | null>(null);
  const [rentangTrx, setRentangTrx] = useState("1");
  const [daftarAktif, setDaftarAktif] = useState<"trx" | "tenggat">("trx");
  /* Yang ditampilkan papan: seluruh catatan, atau satu bulan (YYYY-MM). */
  const [periode, setPeriode] = useState<string>("semua");
  const kabar: KabarKartu = useRef(null);
  const ket = pemberiKet(kabar);
  const [hidup, setHidup] = useState(false);
  const lengkap = ringkas !== null && bulanan !== null && biaya !== null && bayar !== null && tagihan !== null;
  /* Dua bingkai sesudah data lengkap pertama tergambar, baru keping boleh
     berputar — perubahan berikutnya (periode, proyek, data segar) berputar. */
  useEffect(() => {
    if (!lengkap || hidup) return;
    let b2 = 0;
    const b1 = requestAnimationFrame(() => (b2 = requestAnimationFrame(() => setHidup(true))));
    return () => {
      cancelAnimationFrame(b1);
      cancelAnimationFrame(b2);
    };
  }, [lengkap, hidup]);

  useEffect(() => onProyekAktif(setProyekId), []);

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
          setDiperbarui(new Date());
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

  const petaBulan = useMemo(() => new Map((bulanan ?? []).map((b) => [b.bulan, b])), [bulanan]);

  /* --- Lilin: saldo kas kumulatif sejak bulan pertama di jendela ---------- */
  const lilin = useMemo<Lilin[]>(() => {
    let saldo = 0;
    return deretBulan(rentang).map((k) => {
      const b = petaBulan.get(k);
      const masuk = b?.kasMasuk ?? 0;
      const beban = b?.biaya ?? 0;
      const buka = saldo;
      saldo = buka + masuk - beban;
      return { bulan: k, buka, tutup: saldo, atas: buka + masuk, bawah: buka - beban, masuk, beban, laba: masuk - beban };
    });
  }, [rentang, petaBulan]);

  /* --- Indeks periode --------------------------------------------------------- */
  const bp = periode === "semua" ? null : petaBulan.get(periode);
  const masuk = periode === "semua" ? ringkas?.kasMasuk ?? 0 : bp?.kasMasuk ?? 0;
  const beban = periode === "semua" ? ringkas?.totalBiaya ?? 0 : bp?.biaya ?? 0;
  const laba = masuk - beban;
  const marjinKas = masuk > 0 ? (laba / masuk) * 100 : null;
  const marjinKontrak = ringkas?.marginRataRata ?? null;

  /* Tren: bulan yang dipilih (atau bulan berjalan) lawan bulan berdata
     sebelumnya. */
  const kunciKini = periode === "semua" ? kunciBulanDari(new Date()) : periode;
  const iKini = (bulanan ?? []).findIndex((b) => b.bulan === kunciKini);
  const bKini = iKini >= 0 ? bulanan![iKini] : undefined;
  const bLalu = iKini > 0 ? bulanan![iKini - 1] : undefined;
  const tKas = tren(bKini?.kasMasuk, bLalu?.kasMasuk);
  const tBeban = tren(bKini?.biaya, bLalu?.biaya);
  const tLaba = tren(bKini?.labaBersih, bLalu?.labaBersih);

  /* --- Kurs proyek ------------------------------------------------------------ */
  const kurs = useMemo<Kurs[]>(() => {
    if (periode === "semua") {
      return (ringkas?.proyek ?? [])
        .map((p) => ({
          kunci: p.projectId,
          id: p.projectId,
          kode: kodeProyek(p.projectTitle),
          nama: p.projectTitle,
          masuk: p.received,
          beban: p.costsTotal,
          laba: p.received - p.costsTotal,
          sisa: p.belumDiterima,
        }))
        .sort((a, b) => b.masuk - a.masuk || b.beban - a.beban);
    }
    const cocok = (id: string) => !proyekId || id === proyekId;
    const peta = new Map<string, Kurs>();
    const ambil = (id: string, nama: string) => {
      let r = peta.get(id);
      if (!r) {
        r = { kunci: id, id, kode: kodeProyek(nama), nama, masuk: 0, beban: 0, laba: 0, sisa: null };
        peta.set(id, r);
      }
      return r;
    };
    for (const t of tagihan ?? []) {
      if (t.status !== "lunas" || !t.paidAt || t.paidAt.slice(0, 7) !== periode || !cocok(t.projectId)) continue;
      ambil(t.projectId, t.projectTitle ?? "—").masuk += t.amount;
    }
    for (const c of biaya ?? []) {
      if (c.incurredOn.slice(0, 7) !== periode || !cocok(c.projectId)) continue;
      ambil(c.projectId, c.projectTitle ?? "—").beban += c.amount;
    }
    const baris = [...peta.values()];
    /* Selisih terhadap catatan bulanan jadi baris "tak terinci", supaya
       jumlah papan sama dengan indeksnya. */
    const sm = masuk - baris.reduce((n, r) => n + r.masuk, 0);
    const sk = beban - baris.reduce((n, r) => n + r.beban, 0);
    if (sm > 0 || sk > 0) baris.push({ kunci: "lain", id: null, kode: "LN", nama: "Tak terinci", masuk: Math.max(0, sm), beban: Math.max(0, sk), laba: 0, sisa: null });
    for (const r of baris) r.laba = r.masuk - r.beban;
    return baris.sort((a, b) => b.masuk - a.masuk || b.beban - a.beban);
  }, [periode, ringkas, tagihan, biaya, proyekId, masuk, beban]);

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
        kode: kodeDari(b.projectTitle),
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
        kode: kodeDari(c.projectTitle),
        proyek: `${c.projectTitle ?? "—"} · ${KATEGORI[c.category] ?? c.category}`,
        waktu: c.incurredOn,
        nominal: c.amount,
      }));
    return [...m, ...k].sort((x, y) => waktuKe(y.waktu) - waktuKe(x.waktu)).slice(0, 8);
  }, [bayar, biaya, proyekId, rentangTrx]);
  const urutTrx = useUrutTabel(transaksi, [
    (t) => new Date(t.waktu.length === 10 ? t.waktu + "T00:00:00" : t.waktu).getTime(),
    (t) => t.nama,
    (t) => (t.masuk ? t.nominal : -t.nominal),
  ]);

  /* --- Jatuh tempo ------------------------------------------------------------ */
  const tenggat = useMemo(() => {
    return (tagihan ?? [])
      .filter((t) => t.status === "terbit" && t.dueDate && (!proyekId || t.projectId === proyekId))
      .map((t) => ({ t, sisa: sisaHari(t.dueDate!) }))
      .filter((x): x is { t: Invoice; sisa: number } => x.sisa !== null)
      .sort((x, y) => x.sisa - y.sisa)
      .map(({ t, sisa }) => ({
        kunci: t.id,
        status: sisa < 0 ? `LEWAT ${-sisa} HR` : sisa === 0 ? "HARI INI" : sisa === 1 ? "BESOK" : tglPendek(t.dueDate!),
        kode: kodeDari(t.projectTitle),
        teks: `${t.projectTitle ?? "—"} · ${t.label}`,
        nominal: t.amount,
        lewat: sisa < 0,
        dekat: sisa >= 0 && sisa <= 3,
      }));
  }, [tagihan, proyekId]);

  function pilihPeriode(p: string) {
    setPeriode((l) => (l === p ? "semua" : p));
  }

  const judulPeriode = periode === "semua" ? "SELURUH CATATAN" : namaBulan(periode).toUpperCase();
  const jam = diperbarui ? `${String(diperbarui.getHours()).padStart(2, "0")}.${String(diperbarui.getMinutes()).padStart(2, "0")}` : null;
  const persen = (v: number | null) => (v === null ? "—" : `${v.toFixed(1).replace(".", ",")}%`);
  const BARIS_KURS = Math.max(8, kurs.length);
  const sub = [
    { label: "Kas masuk", nilai: formatRupiah(masuk), t: tKas, baik: tKas?.naik, kelas: "", tunda: 140 },
    { label: "Beban", nilai: formatRupiah(beban), t: tBeban, baik: tBeban ? !tBeban.naik : undefined, kelas: "", tunda: 200 },
    { label: "Piutang kini", nilai: formatRupiah(ringkas?.piutang ?? 0), t: null, baik: undefined, kelas: "", tunda: 260 },
    {
      label: "Marjin kas",
      nilai: persen(marjinKas),
      t: null,
      baik: undefined,
      kelas: marjinKas === null ? "" : marjinKas >= 30 ? "is-naik" : marjinKas < 15 ? "is-turun" : "",
      tunda: 320,
    },
  ];

  return (
    <PapanHidup.Provider value={hidup}>
    <div className="bsr">
      <div className="bsr__papan">
        <div className="bsr__bursa">
          <i className="bsr__paku bsr__paku--1" aria-hidden="true" />
          <i className="bsr__paku bsr__paku--2" aria-hidden="true" />
          <i className="bsr__paku bsr__paku--3" aria-hidden="true" />
          <i className="bsr__paku bsr__paku--4" aria-hidden="true" />

          {/* ---- Kepala papan ------------------------------------------------ */}
          <header className="bsr__kepala">
            <div className="bsr__merek">
              <b>Bursa studio</b>
              <span>Ringkasan keuangan · {studio}</span>
            </div>
            <div className="bsr__periode">
              <span className="bsr__label">Periode</span>
              <Kata teks={judulPeriode} kelas="bsr__deret--periode" />
            </div>
            <div className="bsr__kepalakanan">
              {jam && (
                <span className="bsr__hidup">
                  <i aria-hidden="true" />
                  Diperbarui {jam}
                </span>
              )}
              {periode !== "semua" && (
                <button type="button" className="bsr__tombol" onClick={() => setPeriode("semua")}>
                  Seluruh catatan
                </button>
              )}
            </div>
          </header>

          {/* ---- Indeks ------------------------------------------------------ */}
          <section className="bsr__indeks" aria-label="Indeks laba bersih">
            <p className="bsr__label">
              Indeks laba bersih
              {tLaba && bLalu && (
                <span className={tLaba.naik ? "is-naik" : "is-turun"}>
                  {tLaba.teks} dari {pendekBulan(bLalu.bulan)}
                </span>
              )}
            </p>
            <Deret teks={formatRupiah(laba)} lebar={LEBAR_RP} kelas={`bsr__deret--besar ${laba < 0 ? "is-turun" : "is-naik"}`} />
            <div className="bsr__sub">
              {sub.map((s) => (
                <div key={s.label} className="bsr__subkotak">
                  <p className="bsr__label">
                    {s.label}
                    {s.t && <span className={s.baik ? "is-naik" : "is-turun"}>{s.t.teks}</span>}
                  </p>
                  <Deret teks={s.nilai} lebar={LEBAR_RP} tunda={s.tunda} kelas={`bsr__deret--sedang ${s.kelas}`} />
                </div>
              ))}
            </div>
          </section>

          {/* ---- Grafik lilin -------------------------------------------------- */}
          <section className="bsr__grafik" aria-label="Grafik saldo kas kumulatif">
            <header className="bsr__panelkepala">
              <p className="bsr__label">
                Saldo kas kumulatif <span>· sejak {namaBulan(lilin[0]?.bulan ?? kunciKini)} · klik lilin untuk membuka bulannya</span>
              </p>
              <p className="bsr__legenda" aria-hidden="true">
                <span>
                  <i className="is-naik" />
                  untung
                </span>
                <span>
                  <i className="is-turun" />
                  rugi
                </span>
              </p>
              <button type="button" className="bsr__tombol" onClick={() => setRentang((r) => (r === 12 ? 24 : 12))}>
                {rentang} bulan
              </button>
            </header>
            <GrafikLilin lilin={lilin} pilih={periode} onPilih={pilihPeriode} ket={ket} />
          </section>

          {/* ---- Kurs proyek ---------------------------------------------------- */}
          <section className="bsr__kurs" aria-label="Kurs proyek">
            <header className="bsr__panelkepala">
              <p className="bsr__label">
                Kurs proyek <span>· {periode === "semua" ? "seluruh catatan" : namaBulan(periode)}</span>
              </p>
              {marjinKontrak !== null && (
                <p className="bsr__label bsr__marjin">
                  Marjin kontrak <b>{Math.round(marjinKontrak)}%</b>
                </p>
              )}
            </header>
            <div className="bsr__tabel" role="table" aria-label="Kurs proyek">
              <div className="bsr__kursbaris bsr__kursbaris--kepala" role="row">
                <span role="columnheader">
                  <span className="sr-only">Arah</span>
                </span>
                <span role="columnheader">Kode</span>
                <span role="columnheader">Proyek</span>
                <span role="columnheader" className="is-kanan">
                  Masuk
                </span>
                <span role="columnheader" className="is-kanan">
                  Beban
                </span>
                <span role="columnheader" className="is-kanan">
                  Laba
                </span>
              </div>
              {Array.from({ length: BARIS_KURS }, (_, i) => {
                const r = kurs[i];
                const tunda = 380 + i * 55;
                const naik = r ? r.laba >= 0 : true;
                return (
                  <div
                    key={i}
                    className={`bsr__kursbaris${r ? "" : " is-kosong"}`}
                    role="row"
                    {...(r
                      ? ket(() => ({
                          judul: r.nama,
                          baris: [
                            { label: "Kas masuk", nilai: formatRupiah(r.masuk) },
                            { label: "Beban", nilai: formatRupiah(r.beban) },
                            { label: "Laba", nilai: formatRupiah(r.laba) },
                            ...(r.sisa ? [{ label: "Sisa piutang", nilai: formatRupiah(r.sisa) }] : []),
                          ],
                        }))
                      : {})}
                  >
                    <span role="cell">
                      <Deret teks={r ? (naik ? "▲" : "▼") : " "} tunda={tunda} kelas={naik ? "is-naik" : "is-turun"} label={r ? (naik ? "naik" : "turun") : ""} />
                    </span>
                    <span role="cell">
                      <Deret teks={kode3(r?.kode ?? "")} tunda={tunda + 20} kelas="bsr__deret--kode" label={r?.kode ?? ""} />
                    </span>
                    <span role="cell" className="bsr__sel-kata">
                      {r?.id ? (
                        <a href={`/admin/proyek/satu?id=${encodeURIComponent(r.id)}`} className="bsr__kurstaut">
                          <Kata teks={r.nama} tunda={tunda + 60} />
                        </a>
                      ) : (
                        <Kata teks={r?.nama ?? ""} tunda={tunda + 60} />
                      )}
                    </span>
                    <span role="cell" className="is-kanan">
                      <Deret teks={r ? formatRupiah(r.masuk) : ""} lebar={13} tunda={tunda + 90} />
                    </span>
                    <span role="cell" className="is-kanan">
                      <Deret teks={r ? formatRupiah(r.beban) : ""} lebar={13} tunda={tunda + 120} kelas="bsr__deret--redup" />
                    </span>
                    <span role="cell" className="is-kanan">
                      <Deret teks={r ? formatRupiah(r.laba) : ""} lebar={LEBAR_RP} tunda={tunda + 150} kelas={naik ? "is-naik" : "is-turun"} />
                    </span>
                  </div>
                );
              })}
            </div>
          </section>

          {/* ---- Transaksi & jatuh tempo ------------------------------------------ */}
          <section className="bsr__jadwal" aria-label="Transaksi dan jatuh tempo">
            <header className="bsr__panelkepala">
              <Segmen
                judul="Papan jadwal"
                className="bsr__segmen"
                nilai={daftarAktif}
                onPilih={(v) => setDaftarAktif(v as "trx" | "tenggat")}
                segmen={[
                  { nilai: "trx", label: "Transaksi" },
                  { nilai: "tenggat", label: `Jatuh tempo${tenggat.length ? ` · ${tenggat.length}` : ""}` },
                ]}
              />
              {daftarAktif === "trx" ? (
                <>
                  <PilihTombol judul="Rentang transaksi" jenis="ghost" ukuran="small" className="bsr__rentang" nilai={rentangTrx} opsi={RENTANG} onPilih={setRentangTrx} />
                  <a className="bsr__ikontaut" href="/admin/keuangan/transaksi" aria-label="Saring lebih rinci di Semua Transaksi">
                    <Ikon ikon={Sliders} ukuran={16} />
                  </a>
                </>
              ) : (
                <a className="bsr__taut" href="/admin/keuangan/tagihan">
                  Tagihan &amp; termin
                </a>
              )}
            </header>
            {daftarAktif === "trx" ? (
              <div className="bsr__tabel" role="table" aria-label="Transaksi terbaru">
                <div className="bsr__jadwalbaris bsr__jadwalbaris--kepala" role="row">
                  <KepalaUrut label="Tgl" i={0} urutan={urutTrx.urutan} onUrut={urutTrx.onUrut} />
                  <span role="columnheader">Kode</span>
                  <KepalaUrut label="Keterangan" i={1} urutan={urutTrx.urutan} onUrut={urutTrx.onUrut} />
                  <KepalaUrut label="Nominal" i={2} urutan={urutTrx.urutan} onUrut={urutTrx.onUrut} kanan />
                </div>
                {urutTrx.terurut.map((t, i) => {
                  const tunda = 520 + i * 55;
                  return (
                    <div
                      key={i}
                      className="bsr__jadwalbaris"
                      role="row"
                      {...ket(() => ({ judul: t.nama, baris: [{ label: "Proyek", nilai: t.proyek }, { label: t.masuk ? "Masuk" : "Keluar", nilai: formatRupiah(t.nominal) }] }))}
                    >
                      <span role="cell">
                        <Deret teks={tglPendek(t.waktu)} tunda={tunda} kelas="bsr__deret--redup" />
                      </span>
                      <span role="cell">
                        <Deret teks={kode3(t.kode)} tunda={tunda + 30} kelas="bsr__deret--kode" />
                      </span>
                      <span role="cell" className="bsr__sel-kata">
                        <Kata teks={t.nama} tunda={tunda + 60} />
                      </span>
                      <span role="cell" className="is-kanan">
                        <Deret
                          teks={`${t.masuk ? "+" : "-"}${formatRupiah(t.nominal)}`}
                          lebar={LEBAR_RP}
                          tunda={tunda + 90}
                          kelas={t.masuk ? "is-naik" : ""}
                          label={`${t.masuk ? "+" : "−"}${formatRupiah(t.nominal)}`}
                        />
                      </span>
                    </div>
                  );
                })}
                {transaksi.length === 0 && (
                  <p className="bsr__kosong">{bayar === null || biaya === null ? "Memuat transaksi…" : "Belum ada transaksi pada rentang ini."}</p>
                )}
              </div>
            ) : (
              <div className="bsr__tabel" role="table" aria-label="Jatuh tempo tagihan">
                <div className="bsr__jadwalbaris bsr__jadwalbaris--tempo bsr__jadwalbaris--kepala" role="row">
                  <span role="columnheader">Status</span>
                  <span role="columnheader">Kode</span>
                  <span role="columnheader">Tagihan</span>
                  <span role="columnheader" className="is-kanan">
                    Nominal
                  </span>
                </div>
                {tenggat.map((t, i) => (
                  <div key={i} className="bsr__jadwalbaris bsr__jadwalbaris--tempo" role="row">
                    <span role="cell" className="bsr__sel-kata">
                      <Kata teks={t.status} tunda={i * 55} kelas={t.lewat ? "is-turun" : t.dekat ? "is-dekat" : ""} />
                    </span>
                    <span role="cell">
                      <Deret teks={kode3(t.kode)} tunda={i * 55 + 30} kelas="bsr__deret--kode" />
                    </span>
                    <span role="cell" className="bsr__sel-kata">
                      <Kata teks={t.teks} tunda={i * 55 + 60} />
                    </span>
                    <span role="cell" className="is-kanan">
                      <Deret teks={formatRupiah(t.nominal)} lebar={13} tunda={i * 55 + 90} />
                    </span>
                  </div>
                ))}
                {tenggat.length === 0 && (
                  <p className="bsr__kosong">{tagihan === null ? "Memuat tagihan…" : "Tidak ada tagihan terbit yang menunggu dibayar."}</p>
                )}
              </div>
            )}
          </section>
        </div>
      </div>
      <Keterangan kabar={kabar} />
    </div>
    </PapanHidup.Provider>
  );
}

export function RingkasanKit() {
  return (
    <RequireAuth
      skeleton={
        <div className="bsr bsr--rangka">
          <div className="bsr__papan">
            <div className="bsr__bursa" />
          </div>
        </div>
      }
    >
      <Isi />
    </RequireAuth>
  );
}
