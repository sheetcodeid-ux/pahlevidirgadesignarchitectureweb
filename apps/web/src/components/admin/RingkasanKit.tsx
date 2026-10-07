import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { RequireAuth } from "./RequireAuth";
import { PilihMenu } from "../kit/Formulir";
import { Keterangan, pemberiKet, type KabarKartu } from "../kit/kartuGrafik";
import {
  ambilRingkasanKeuangan,
  ambilBulanan,
  ambilSettings,
  semuaBiaya,
  semuaTagihan,
  bacaCache,
  tulisCache,
  type FinanceOverview,
  type BarisBulanan,
  type BiayaProyek,
  type Invoice,
  type StudioSettings,
} from "../../lib/admin";
import { proyekAktif, onProyekAktif } from "../../lib/proyekAktif";
import { formatRupiah, formatRupiahRingkas } from "../../lib/format";
import { kodeProyek } from "../../lib/nomorDokumen";
import { terbilang } from "../../lib/terbilang";

/* =============================================================================
   Keuangan — Ringkasan = MEJA GAMBAR: lembar KURVA S + REKAPITULASI.

   Di dunia arsitektur dan konstruksi, keadaan keuangan sebuah pekerjaan
   diringkas dalam dua lembar yang selalu berdampingan: KURVA S (time
   schedule: tiap butir pekerjaan satu baris berbobot, batang per bulan, dan
   kurva kumulatif RENCANA lawan REALISASI yang membentuk huruf S) dan
   REKAPITULASI anggaran (bagian akhir RAB: A, B, jumlah, terbilang).
   Halaman ini kedua lembar itu — kertas berbingkai cetak ganda di atas
   tumpukan lembar laporan sebelumnya — di papan gambar hijau:

   1. KURVA S — butirnya PROYEK (atau TERMIN, kalau satu proyek dipilih).
      Bobot = nilai kontrak ÷ jumlah kontrak di lembar. Rencana = tagihan
      menurut TENGGATNYA (yang lunas tanpa tenggat memakai tanggal lunasnya),
      realisasi = tagihan LUNAS menurut tanggal lunas — sumber yang sama
      dengan "kas masuk" Worker (`financeRepo.monthly`). Kurvanya mulai dari
      bagian yang sudah ditagih/dibayar sebelum 1 Januari, jadi ia jujur
      untuk proyek yang menyeberang tahun. Selisih keduanya = DEVIASI;
      bagian yang terlambat diarsir amber. Di bawahnya baris rekap per bulan:
      rencana & realisasi kumulatif, deviasi, kas masuk, beban (dari catatan
      bulanan), laba.
   2. TANGGAL LAPORAN — laporan Kurva S selalu "s.d. bulan ke-n". Bulan yang
      dipilih menentukan sampai mana realisasi DITINTA; sesudahnya (kalau
      ada) tinggal garis pensil. Rekapitulasi di kiri ikut menghitung s.d.
      bulan itu.
   3. REKAPITULASI — A penerimaan (per proyek), B pengeluaran (per kategori
      biaya, selisih terhadap catatan bulanan jadi "tanpa rincian"), C laba
      bersih (angka besar, NERACA BATANG: penerimaan terbagi jadi beban dan
      laba) + terbilang, lalu tertunggak dan piutang. Tiap butir A/B membawa
      garis PORSI-nya dari jumlah kelompoknya.
   4. ARUS KAS — pita batang per bulan di bawah mistar: kas masuk naik dari
      garis tengah, beban turun.

   Menyentuh satu butir (baris kurva atau butir A rekap) menggambar KURVA S
   MILIK BUTIR ITU SENDIRI (0–100% nilainya) di atas kurva gabungan yang
   meredup. Angka laporan terbaca juga di SUMBU (tag realisasi pejal,
   rencana bergaris) dengan garis penunjuk dari titiknya.

   Benda yang disentuh: SEGITIGA (penggaris 30/60) yang berdiri di atas
   MISTAR dan meluncur ke bulan yang ditunjuk tetikus; tepi tegaknya adalah
   garis baca bulan itu. Gerak: PENA RAPIDO menarik garis realisasi sampai
   tanggal laporan yang baru — hanya saat tanggal laporan maju atau tahun
   berganti, tidak saat dimuat, seketika bila gerak dikurangi. Bersamaan,
   angka progres dan rekapitulasi BERHITUNG ke nilai barunya (`Hitung`) dan
   neraca batang serta garis porsi bergeser. Pena dan
   segitiga hidup di dalam bidang bulan, yang tidak memuat satu tulisan pun
   (jebakan #70); keduanya dipotong tepi bidang itu.
   ============================================================================= */

const BULAN_PENDEK = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const KATEGORI: [string, string][] = [
  ["freelancer", "Freelancer & tim"],
  ["operasional", "Operasional"],
  ["prinsipal", "Prinsipal"],
  ["lainnya", "Lain-lain"],
];
/** Butir rekap penerimaan sebelum sisanya digabung jadi "lainnya". */
const MAKS_A = 4;
/** Baris kurva sebelum sisanya digabung — satu layar. */
const MAKS_BARIS = 8;
/** Lama pena menarik satu bulan, dan batasnya. */
const PENA_PER_BULAN = 150;

const geraknya = () =>
  typeof window !== "undefined" && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const desimal = (v: number, d = 1) => v.toLocaleString("id-ID", { minimumFractionDigits: d, maximumFractionDigits: d });
/** Juta rupiah untuk sel bulan yang sempit; tabelnya menyebut satuannya. */
const juta = (v: number) => {
  const j = v / 1_000_000;
  return Math.abs(j) >= 1000 ? desimal(j, 0) : desimal(j, 1);
};
const persen = (v: number) => desimal(v, 1);
const tanggalPendek = (d: Date) => `${d.getDate()} ${BULAN_PENDEK[d.getMonth()]} ${d.getFullYear()}`;

interface Baris {
  kunci: string;
  judul: string;
  sub: string;
  href: string | null;
  nilai: number;
  rencana: number[];
  realisasi: number[];
  sebelumRencana: number;
  sebelumRealisasi: number;
}

interface Lembar {
  baris: Baris[];
  total: number;
  /** Kumulatif dalam persen dari `total`, satu per bulan. */
  kumRencana: number[];
  kumRealisasi: number[];
  awalRencana: number;
  awalRealisasi: number;
  /** Rupiah per bulan. */
  masuk: number[];
  beban: number[];
  /** Bulan terakhir yang realisasinya sudah terjadi (−1 = belum ada). */
  akhirNyata: number;
  maksSel: number;
  tanpaJadwal: { n: number; jumlah: number };
}

/** Tanggal rencana sebuah tagihan: tenggatnya, atau tanggal lunasnya bila
 *  tenggatnya kosong. Draf/terbit tanpa tenggat belum berjadwal. */
const tglRencana = (t: Invoice) => t.dueDate ?? (t.status === "lunas" && t.paidAt ? t.paidAt.slice(0, 10) : null);
const tglNyata = (t: Invoice) => (t.status === "lunas" && t.paidAt ? t.paidAt.slice(0, 10) : null);

function susunLembar(
  tahun: number,
  tagihan: Invoice[],
  ringkas: FinanceOverview | null,
  bulanan: BarisBulanan[],
  proyekId: string | null,
  kini: Date,
): Lembar {
  const awalTahun = `${tahun}-01-01`;
  const dalamTahun = (iso: string | null) => (iso && iso.slice(0, 4) === String(tahun) ? Number(iso.slice(5, 7)) - 1 : null);
  const kontrak = new Map((ringkas?.proyek ?? []).map((p) => [p.projectId, p]));
  const isi = tagihan.filter((t) => !proyekId || t.projectId === proyekId);
  let baris: Baris[] = [];
  let tanpaJadwal = { n: 0, jumlah: 0 };

  const kosong = (): Pick<Baris, "rencana" | "realisasi" | "sebelumRencana" | "sebelumRealisasi"> => ({
    rencana: Array(12).fill(0),
    realisasi: Array(12).fill(0),
    sebelumRencana: 0,
    sebelumRealisasi: 0,
  });
  const masukkan = (b: Pick<Baris, "rencana" | "realisasi" | "sebelumRencana" | "sebelumRealisasi">, t: Invoice) => {
    const r = tglRencana(t);
    const n = tglNyata(t);
    const br = dalamTahun(r);
    const bn = dalamTahun(n);
    if (br !== null) b.rencana[br] += t.amount;
    else if (r && r < awalTahun) b.sebelumRencana += t.amount;
    if (bn !== null) b.realisasi[bn] += t.amount;
    else if (n && n < awalTahun) b.sebelumRealisasi += t.amount;
  };

  if (proyekId) {
    /* Satu proyek: butirnya TERMIN — Kurva S dalam bentuk aslinya. */
    const p = kontrak.get(proyekId);
    for (const t of [...isi].sort((a, b) => a.sortOrder - b.sortOrder)) {
      const b: Baris = { kunci: t.id, judul: t.label, sub: formatRupiahRingkas(t.amount), href: null, nilai: t.amount, ...kosong() };
      masukkan(b, t);
      if (!tglRencana(t)) tanpaJadwal = { n: tanpaJadwal.n + 1, jumlah: tanpaJadwal.jumlah + t.amount };
      baris.push(b);
    }
    const jumlahTermin = baris.reduce((n, b) => n + b.nilai, 0);
    const total = Math.max(p?.contractValue ?? 0, jumlahTermin);
    baris = baris.filter((b) => b.rencana.some(Boolean) || b.realisasi.some(Boolean) || b.sebelumRealisasi < b.nilai);
    return hitung(baris, total);
  }

  const peta = new Map<string, Baris>();
  for (const t of isi) {
    const r = tglRencana(t);
    const n = tglNyata(t);
    if (!r) tanpaJadwal = { n: tanpaJadwal.n + 1, jumlah: tanpaJadwal.jumlah + t.amount };
    const aktif = dalamTahun(r) !== null || dalamTahun(n) !== null;
    let b = peta.get(t.projectId);
    if (!b) {
      const judul = t.projectTitle ?? kontrak.get(t.projectId)?.projectTitle ?? "—";
      b = {
        kunci: t.projectId,
        judul,
        sub: kodeProyek(judul),
        href: `/admin/proyek/satu?id=${encodeURIComponent(t.projectId)}`,
        nilai: 0,
        ...kosong(),
      };
      peta.set(t.projectId, b);
    }
    masukkan(b, t);
    if (aktif) (b as Baris & { aktif?: boolean }).aktif = true;
  }
  baris = [...peta.values()].filter((b) => (b as Baris & { aktif?: boolean }).aktif);
  for (const b of baris) {
    const jumlahTagihan = isi.filter((t) => t.projectId === b.kunci).reduce((n, t) => n + t.amount, 0);
    b.nilai = Math.max(kontrak.get(b.kunci)?.contractValue ?? 0, jumlahTagihan);
    b.sub = `${b.sub} · ${formatRupiahRingkas(b.nilai)}`;
  }
  baris.sort((a, b) => b.nilai - a.nilai);
  if (baris.length > MAKS_BARIS) {
    const sisa = baris.splice(MAKS_BARIS - 1);
    const g: Baris = { kunci: "lain", judul: `Proyek lain (${sisa.length})`, sub: "digabung", href: null, nilai: 0, ...kosong() };
    for (const s of sisa) {
      g.nilai += s.nilai;
      g.sebelumRencana += s.sebelumRencana;
      g.sebelumRealisasi += s.sebelumRealisasi;
      s.rencana.forEach((v, i) => (g.rencana[i] += v));
      s.realisasi.forEach((v, i) => (g.realisasi[i] += v));
    }
    g.sub = `digabung · ${formatRupiahRingkas(g.nilai)}`;
    baris.push(g);
  }
  return hitung(baris, baris.reduce((n, b) => n + b.nilai, 0));

  function hitung(baris: Baris[], total: number): Lembar {
    const t = total || 1;
    const awalRencana = (baris.reduce((n, b) => n + b.sebelumRencana, 0) / t) * 100;
    const awalRealisasi = (baris.reduce((n, b) => n + b.sebelumRealisasi, 0) / t) * 100;
    const kumRencana: number[] = [];
    const kumRealisasi: number[] = [];
    const masuk: number[] = [];
    let r = awalRencana;
    let n = awalRealisasi;
    for (let i = 0; i < 12; i++) {
      r += (baris.reduce((s, b) => s + b.rencana[i]!, 0) / t) * 100;
      const m = baris.reduce((s, b) => s + b.realisasi[i]!, 0);
      n += (m / t) * 100;
      kumRencana.push(r);
      kumRealisasi.push(n);
      masuk.push(m);
    }
    const petaBulan = new Map(bulanan.map((b) => [b.bulan, b]));
    const beban = Array.from({ length: 12 }, (_, i) => petaBulan.get(`${tahun}-${String(i + 1).padStart(2, "0")}`)?.biaya ?? 0);
    const akhirNyata = tahun < kini.getFullYear() ? 11 : tahun > kini.getFullYear() ? -1 : kini.getMonth();
    const maksSel = Math.max(1, ...baris.flatMap((b) => [...b.rencana, ...b.realisasi]));
    return { baris, total, kumRencana, kumRealisasi, awalRencana, awalRealisasi, masuk, beban, akhirNyata, maksSel, tanpaJadwal };
  }
}

/* -----------------------------------------------------------------------------
   Bidang bulan: kurva, arsiran deviasi, segitiga, dan pena. Ukurannya dibaca
   ResizeObserver (bukan saat menggulir — jebakan #21). Tinta realisasi,
   arsiran, dan titiknya dibuka lewat SATU lebar potongan yang ditulis
   langsung ke DOM selama pena bergerak, jadi React tidak merender ulang per
   bingkai. Panjang garis dihitung dari titiknya sendiri, bukan dibaca dari
   SVG.
   -------------------------------------------------------------------------- */
function BidangKurva({
  lembar,
  laporan,
  sorot,
  tahun,
  hidup,
  onSorot,
  onPilih,
  ket,
  proyek,
}: {
  lembar: Lembar;
  laporan: number;
  sorot: number | null;
  tahun: number;
  hidup: boolean;
  /** Butir yang sedang disentuh: kurva S miliknya sendiri digambar di atas. */
  proyek: Baris | null;
  onSorot: (i: number | null) => void;
  onPilih: (i: number) => void;
  ket: ReturnType<typeof pemberiKet>;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const tinta = useRef<SVGPolylineElement>(null);
  const potong = useRef<SVGRectElement>(null);
  const pena = useRef<SVGGElement>(null);
  const [uk, setUk] = useState({ w: 520, h: 280 });
  const id = useId().replace(/:/g, "");
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setUk({ w: Math.round(e!.contentRect.width), h: Math.round(e!.contentRect.height) }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { w, h } = uk;
  const kol = w / 12;
  const ATAS = 10;
  const BAWAH = 4;
  const skala = Math.max(100, Math.ceil(Math.max(...lembar.kumRencana, ...lembar.kumRealisasi, lembar.awalRencana) / 25) * 25);
  const y = (p: number) => ATAS + (1 - p / skala) * (h - ATAS - BAWAH);
  const x = (i: number) => (i + 1) * kol;
  const titikRencana: [number, number][] = [[0, y(lembar.awalRencana)], ...lembar.kumRencana.map((p, i) => [x(i), y(p)] as [number, number])];
  const nyata = lembar.akhirNyata;
  const titikNyata: [number, number][] =
    nyata < 0 ? [] : [[0, y(lembar.awalRealisasi)], ...lembar.kumRealisasi.slice(0, nyata + 1).map((p, i) => [x(i), y(p)] as [number, number])];
  const garis = (t: [number, number][]) => t.map(([a, b]) => `${a.toFixed(1)},${b.toFixed(1)}`).join(" ");
  /* Panjang tinta sampai tanggal laporan, dari jumlah ruas garisnya. */
  const panjangSampai = (k: number) => {
    let L = 0;
    for (let i = 1; i <= Math.min(k + 1, titikNyata.length - 1); i++) {
      const [a, b] = titikNyata[i - 1]!;
      const [c, d] = titikNyata[i]!;
      L += Math.hypot(c - a, d - b);
    }
    return L;
  };
  const titikPada = (L: number): [number, number] => {
    let sisa = L;
    for (let i = 1; i < titikNyata.length; i++) {
      const [a, b] = titikNyata[i - 1]!;
      const [c, d] = titikNyata[i]!;
      const r = Math.hypot(c - a, d - b);
      if (sisa <= r || i === titikNyata.length - 1) {
        const f = r ? Math.min(1, sisa / r) : 1;
        return [a + (c - a) * f, b + (d - b) * f];
      }
      sisa -= r;
    }
    return titikNyata[0] ?? [0, h];
  };
  const tinggiKe = (i: number) => (i < 0 ? 0 : x(Math.min(i, nyata)));

  /* Bidang di bawah tiap kurva — dasar arsiran terlambat/maju. */
  const bawahRencana = `0,${h} ${garis(titikRencana)} ${w},${h}`;
  const ujungNyata = titikNyata[titikNyata.length - 1];
  const bawahNyata = titikNyata.length ? `0,${h} ${garis(titikNyata)} ${ujungNyata![0]},${h}` : "";

  const tujuan = useRef<{ kunci: string; L: number } | null>(null);
  /* Pena berjalan di luar siklus efek: perubahan ukuran bidang (yang ikut
     memicu efek ini) tidak boleh memotongnya di tengah. Begitu sampai, ia
     menulis keadaan akhir menurut geometri TERBARU. */
  const gerak = useRef(0);
  const akhir = useRef({ L: 0, x: 0 });
  useEffect(() => () => cancelAnimationFrame(gerak.current), []);
  const tulisTinta = (L: number, xPotong: number, titikPena: [number, number] | null) => {
    tinta.current?.setAttribute("stroke-dasharray", `${L.toFixed(1)} 100000`);
    potong.current?.setAttribute("width", String(Math.max(0, xPotong)));
    if (pena.current) {
      if (titikPena) {
        pena.current.setAttribute("transform", `translate(${titikPena[0].toFixed(1)} ${titikPena[1].toFixed(1)}) rotate(32) scale(1.18)`);
        pena.current.style.opacity = "1";
      } else pena.current.style.opacity = "0";
    }
  };

  useLayoutEffect(() => {
    const kunci = `${tahun}:${laporan}`;
    const k = Math.min(laporan, nyata);
    const L1 = panjangSampai(k);
    const x1 = tinggiKe(k);
    akhir.current = { L: L1, x: x1 };
    const lalu = tujuan.current;
    tujuan.current = { kunci, L: L1 };
    const ganti = lalu !== null && lalu.kunci !== kunci;
    if (!ganti) {
      /* Cuma geometri yang berubah: pena yang sedang berjalan dibiarkan. */
      if (!gerak.current) tulisTinta(L1, x1, null);
      return;
    }
    cancelAnimationFrame(gerak.current);
    gerak.current = 0;
    const tahunGanti = lalu.kunci.split(":")[0] !== String(tahun);
    const L0 = tahunGanti ? 0 : lalu.L;
    if (!hidup || !geraknya() || L1 <= L0 + 0.5) {
      tulisTinta(L1, x1, null);
      return;
    }
    /* Pena menarik dari ujung tinta lama ke tanggal laporan baru. */
    const bulanJalan = Math.max(1, Math.round(((L1 - L0) / Math.max(1, L1)) * (k + 1)));
    const lama = Math.min(1100, Math.max(360, bulanJalan * PENA_PER_BULAN));
    const mulai = performance.now();
    const titik = titikPada;
    const langkah = (t: number) => {
      const f = Math.min(1, (t - mulai) / lama);
      const e = f < 0.5 ? 2 * f * f : 1 - Math.pow(-2 * f + 2, 2) / 2;
      if (f < 1) {
        const L = L0 + (L1 - L0) * e;
        const p = titik(L);
        tulisTinta(L, p[0], p);
        gerak.current = requestAnimationFrame(langkah);
      } else {
        gerak.current = 0;
        tulisTinta(akhir.current.L, akhir.current.x, null);
      }
    };
    tulisTinta(L0, titik(L0)[0], titik(L0));
    gerak.current = requestAnimationFrame(langkah);
    // Geometri ikut berubah saat ukuran berubah; itu bukan alasan menarik ulang.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [laporan, tahun, w, h, lembar]);

  /* Segitiga 30/60: tepi tegaknya di akhir bulan yang ditunjuk. Alasnya ke
     KANAN — ke bulan yang belum dibaca, supaya kurva yang sedang dibaca
     tidak tertutup akrilik — kecuali di ujung kanan, tempat ia terpotong. */
  const iSegitiga = sorot ?? laporan;
  const xs = x(iSegitiga);
  const tinggiS = Math.max(60, (h - 2) * 0.62);
  const alas = tinggiS * 0.5774;
  const balik = xs + alas <= w;
  const r = Math.min(16, tinggiS * 0.16);
  const dalam = (() => {
    /* Lubang segitiga: sejajar sisi luar, masuk r piksel. */
    const a = alas - r * 2.9;
    const t = tinggiS - r * 4.1;
    return a > 8 && t > 14 ? `M ${-r} ${-r} L ${-r - a} ${-r} L ${-r} ${-r - t} Z` : "";
  })();
  const segitiga = `M 0 0 L ${-alas} 0 L 0 ${-tinggiS} Z ${dalam}`;
  const tanda = lembar.kumRencana[iSegitiga]!;
  const tandaNyata = iSegitiga <= nyata ? lembar.kumRealisasi[iSegitiga]! : null;

  const garisSkala: number[] = [];
  for (let v = 0; v <= skala; v += 25) garisSkala.push(v);

  /* Kurva S satu butir, dalam persen nilai butir itu sendiri (0–100). */
  const kurvaProyek = (() => {
    if (!proyek || !proyek.nilai) return null;
    const n = proyek.nilai;
    let r = proyek.sebelumRencana;
    let q = proyek.sebelumRealisasi;
    const rencana: [number, number][] = [[0, y((r / n) * 100)]];
    const nyataP: [number, number][] = nyata < 0 ? [] : [[0, y((q / n) * 100)]];
    for (let i = 0; i < 12; i++) {
      r += proyek.rencana[i]!;
      q += proyek.realisasi[i]!;
      rencana.push([x(i), y(Math.min(skala, (r / n) * 100))]);
      if (i <= nyata) nyataP.push([x(i), y(Math.min(skala, (q / n) * 100))]);
    }
    return { rencana, nyata: nyataP };
  })();

  /* Angka di sumbu: realisasi dan rencana pada tanggal laporan, ditulis di
     kolom skala (bukan di bidang). Label skala yang terlalu dekat disembunyikan. */
  const kLap = Math.min(laporan, nyata);
  const tagNyata = kLap >= 0 ? lembar.kumRealisasi[kLap]! : null;
  const tagRencana = lembar.kumRencana[laporan]!;
  const tampilRencana = tagNyata === null || Math.abs(y(tagRencana) - y(tagNyata)) >= 15;
  const dekat = (v: number) =>
    (tagNyata !== null && Math.abs(y(v) - y(tagNyata)) < 12) || (tampilRencana && Math.abs(y(v) - y(tagRencana)) < 12);
  const titikLap = kLap >= 0 ? titikNyata[kLap + 1] : undefined;

  return (
    <div className="kvs__bidang" ref={ref}>
      <svg className={proyek ? "kvs__svg is-redup" : "kvs__svg"} width={w} height={h} aria-hidden="true">
        <defs>
          <pattern id={`${id}-arsir`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="6" className="kvs__arsirgaris" />
          </pattern>
          <linearGradient id={`${id}-basuh`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" className="kvs__basuh-atas" />
            <stop offset="1" className="kvs__basuh-bawah" />
          </linearGradient>
          <clipPath id={`${id}-tinta`}>
            <rect ref={potong} x="0" y="0" width="0" height={h} />
          </clipPath>
          <mask id={`${id}-telat`}>
            <rect width={w} height={h} fill="white" />
            {bawahNyata && <polygon points={bawahNyata} fill="black" />}
          </mask>
          <mask id={`${id}-maju`}>
            <rect width={w} height={h} fill="white" />
            <polygon points={bawahRencana} fill="black" />
          </mask>
        </defs>
        {/* Kisi skala persen (tanpa tulisan — angkanya di kolom skala). */}
        {garisSkala.map((v) => (
          <line key={v} className={v === 100 ? "kvs__kisi kvs__kisi--100" : "kvs__kisi"} x1={0} x2={w} y1={y(v)} y2={y(v)} />
        ))}
        {/* Arsiran deviasi s.d. tanggal laporan. */}
        <g clipPath={`url(#${id}-tinta)`} className="kvs__utama">
          {bawahNyata && <polygon className="kvs__basuh" points={bawahNyata} fill={`url(#${id}-basuh)`} />}
          <polygon className="kvs__telat" points={bawahRencana} mask={`url(#${id}-telat)`} fill={`url(#${id}-arsir)`} />
          {bawahNyata && <polygon className="kvs__maju" points={bawahNyata} mask={`url(#${id}-maju)`} />}
        </g>
        {/* Rencana: garis cetak putus. */}
        {titikLap && <line className="kvs__penunjuk" x1={titikLap[0]} x2={w} y1={titikLap[1]} y2={titikLap[1]} />}
        <polyline className="kvs__rencana" points={garis(titikRencana)} />
        {titikRencana.slice(1).map(([a, b], i) => (
          <circle key={i} className="kvs__titikrencana" cx={a} cy={b} r={2.2} />
        ))}
        {/* Realisasi: pensil di bawah, tinta di atasnya sampai tanggal laporan. */}
        {titikNyata.length > 1 && (
          <>
            <polyline className="kvs__pensil" points={garis(titikNyata)} />
            <polyline ref={tinta} className="kvs__tinta" points={garis(titikNyata)} strokeDasharray="0 100000" />
            <g clipPath={`url(#${id}-tinta)`}>
              {titikLap && <circle className="kvs__halo" cx={titikLap[0]} cy={titikLap[1]} r={11} />}
              {titikNyata.slice(1).map(([a, b], i) => (
                <circle key={i} className={i === Math.min(laporan, nyata) ? "kvs__titik kvs__titik--laporan" : "kvs__titik"} cx={a} cy={b} r={i === Math.min(laporan, nyata) ? 4.5 : 2.6} />
              ))}
            </g>
          </>
        )}
        {kurvaProyek && (
          <g className="kvs__proyek">
            <polyline className="kvs__proyek-rencana" points={garis(kurvaProyek.rencana)} />
            {kurvaProyek.nyata.length > 1 && (
              <>
                <polyline className="kvs__proyek-alas" points={garis(kurvaProyek.nyata)} />
                <polyline className="kvs__proyek-nyata" points={garis(kurvaProyek.nyata)} />
              </>
            )}
          </g>
        )}
        {/* Segitiga di atas mistar, meluncur ke bulan yang ditunjuk. */}
        <g className={sorot !== null && sorot !== laporan ? "kvs__segitiga is-sorot" : "kvs__segitiga"} style={{ transform: `translate(${xs}px, ${h}px) scaleX(${balik ? -1 : 1})` }}>
          <path d={segitiga} fillRule="evenodd" />
          <line className="kvs__segitigatepi" x1={0} x2={0} y1={0} y2={-tinggiS} />
        </g>
        <circle className="kvs__baca kvs__baca--rencana" cx={xs} cy={y(tanda)} r={4} />
        {tandaNyata !== null && <circle className="kvs__baca" cx={xs} cy={y(tandaNyata)} r={4} />}
        {/* Pena rapido: ujung jarum di (0,0), badan miring ke kanan atas. */}
        <g ref={pena} className="kvs__pena" style={{ opacity: 0 }}>
          <line className="kvs__pena-jarum" x1="0" y1="0" x2="0" y2="-9" />
          <path className="kvs__pena-kerucut" d="M -1.6 -8 L 1.6 -8 L 4.2 -17 L -4.2 -17 Z" />
          <rect className="kvs__pena-cincin" x="-4.6" y="-21" width="9.2" height="4" rx="1" />
          <rect className="kvs__pena-badan" x="-4.2" y="-62" width="8.4" height="41" rx="2.2" />
          <line className="kvs__pena-kilap" x1="-1.8" x2="-1.8" y1="-58" y2="-25" />
        </g>
      </svg>
      {/* Lajur bulan untuk tetikus & kartu keterangan. Papan ketik memakai
          tombol bulan di kepala tabel, jadi lajur ini tidak bisa difokus. */}
      <ol className="kvs__lajur" aria-hidden="true">
        {Array.from({ length: 12 }, (_, i) => {
          const k = ket(() => {
            const telat = i <= nyata ? lembar.kumRencana[i]! - lembar.kumRealisasi[i]! : null;
            return {
              judul: `${BULAN[i]} ${tahun}`,
              baris: [
                { label: "Rencana kumulatif", nilai: `${persen(lembar.kumRencana[i]!)}%` },
                ...(i <= nyata
                  ? [
                      { label: "Realisasi kumulatif", nilai: `${persen(lembar.kumRealisasi[i]!)}%` },
                      { label: telat! > 0.05 ? "Terlambat" : "Deviasi", nilai: `${telat! > 0.05 ? "−" : "+"}${persen(Math.abs(telat!))}%` },
                      { label: "Kas masuk", nilai: formatRupiah(lembar.masuk[i]!) },
                    ]
                  : [{ label: "Realisasi", nilai: "belum tiba" }]),
              ],
            };
          });
          return (
            <li
              key={i}
              {...k}
              onClick={() => onPilih(i)}
              onPointerEnter={(e) => {
                k.onPointerEnter(e);
                if (e.pointerType === "mouse") onSorot(i);
              }}
              onPointerLeave={(e) => {
                k.onPointerLeave(e);
                if (e.pointerType === "mouse") onSorot(null);
              }}
            />
          );
        })}
      </ol>
      <ol className="kvs__skala" aria-hidden="true">
        {garisSkala.map((v) => (
          <li key={v} style={{ top: y(v) }} className={dekat(v) ? "is-sembunyi" : undefined}>
            {v}
          </li>
        ))}
        {tampilRencana && (
          <li className="kvs__tag kvs__tag--rencana" style={{ top: y(tagRencana) }}>
            {Math.round(tagRencana)}
          </li>
        )}
        {tagNyata !== null && (
          <li className="kvs__tag" style={{ top: y(tagNyata) }}>
            {Math.round(tagNyata)}
          </li>
        )}
      </ol>
    </div>
  );
}

/* -----------------------------------------------------------------------------
   Angka yang BERHITUNG ke nilai barunya saat tanggal laporan berganti (560 ms).
   Teksnya ditulis langsung ke DOM per bingkai, jadi halaman tidak dirender
   ulang. Tidak berhitung saat pertama tampil, seketika bila gerak dikurangi.
   -------------------------------------------------------------------------- */
function Hitung({ nilai, hidup, format, className }: { nilai: number; hidup: boolean; format: (v: number) => string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const kini = useRef<number | null>(null);
  const fmt = useRef(format);
  fmt.current = format;
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const tulis = (v: number) => {
      const t = fmt.current(v);
      if (el.textContent !== t) el.textContent = t;
    };
    const dari = kini.current;
    if (dari === null || !hidup || !geraknya() || Math.abs(nilai - dari) < 0.005) {
      kini.current = nilai;
      tulis(nilai);
      return;
    }
    const mulai = performance.now();
    let r = 0;
    const f = (t: number) => {
      const p = Math.min(1, (t - mulai) / 560);
      const v = p < 1 ? dari + (nilai - dari) * (1 - Math.pow(1 - p, 3)) : nilai;
      kini.current = v;
      tulis(v);
      if (p < 1) r = requestAnimationFrame(f);
    };
    r = requestAnimationFrame(f);
    return () => {
      cancelAnimationFrame(r);
      kini.current = nilai;
      tulis(nilai);
    };
  }, [nilai, hidup]);
  return <span ref={ref} className={className} />;
}

const ribuan = (v: number) => Math.round(v).toLocaleString("id-ID");
const ribuanBertanda = (v: number) => `${Math.round(v) < 0 ? "−" : ""}${Math.abs(Math.round(v)).toLocaleString("id-ID")}`;

function Isi() {
  const kini = useMemo(() => new Date(), []);
  const [proyekId, setProyekId] = useState<string | null>(() => proyekAktif());
  const kunci = `keuangan:${proyekId ?? "semua"}`;
  const kunciBulan = `keuangan-bulan:${proyekId ?? "semua"}`;
  const [ringkas, setRingkas] = useState<FinanceOverview | null>(() => bacaCache<FinanceOverview>(kunci));
  const [bulanan, setBulanan] = useState<BarisBulanan[] | null>(() => bacaCache<BarisBulanan[]>(kunciBulan));
  const [biaya, setBiaya] = useState<BiayaProyek[] | null>(() => bacaCache<BiayaProyek[]>("biaya-semua"));
  const [tagihan, setTagihan] = useState<Invoice[] | null>(() => bacaCache<Invoice[]>("tagihan-semua"));
  /* Info Studio — kunci `settings` milik halaman itu, di sini cuma dibaca
     (jebakan #8). */
  const [studio, setStudio] = useState<StudioSettings | null>(() => bacaCache<StudioSettings>("settings"));
  const [tahun, setTahun] = useState(kini.getFullYear());
  /* Tanggal laporan per tahun: null = bawaan (bulan berjalan / Desember). */
  const [laporanPilih, setLaporanPilih] = useState<number | null>(null);
  const [sorot, setSorot] = useState<number | null>(null);
  const [sorotBaris, setSorotBaris] = useState<string | null>(null);
  const kabar: KabarKartu = useRef(null);
  const ket = pemberiKet(kabar);
  const [hidup, setHidup] = useState(false);
  const lengkap = ringkas !== null && bulanan !== null && biaya !== null && tagihan !== null;
  /* Pena baru boleh bergerak sesudah data lengkap pertama tergambar. */
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
    semuaTagihan()
      .then((d) => {
        tulisCache("tagihan-semua", d);
        setTagihan(d);
      })
      .catch(() => setTagihan((l) => l ?? []));
    ambilSettings()
      .then(setStudio)
      .catch(() => {});
  }, []);
  useEffect(() => {
    let batal = false;
    setRingkas(bacaCache<FinanceOverview>(kunci));
    setBulanan(bacaCache<BarisBulanan[]>(kunciBulan));
    ambilRingkasanKeuangan(proyekId)
      .then((d) => {
        if (batal) return;
        tulisCache(kunci, d);
        setRingkas(d);
      })
      .catch(() => setRingkas((l) => l ?? null));
    ambilBulanan(proyekId, 24)
      .then((d) => {
        if (batal) return;
        tulisCache(kunciBulan, d);
        setBulanan(d);
      })
      .catch(() => setBulanan((l) => l ?? []));
    return () => {
      batal = true;
    };
  }, [proyekId, kunci, kunciBulan]);

  /* Tahun yang punya catatan: tagihan berjadwal/lunas atau catatan bulanan. */
  const daftarTahun = useMemo(() => {
    const s = new Set<number>([kini.getFullYear()]);
    for (const t of tagihan ?? []) {
      if (proyekId && t.projectId !== proyekId) continue;
      for (const d of [tglRencana(t), tglNyata(t)]) if (d) s.add(Number(d.slice(0, 4)));
    }
    for (const b of bulanan ?? []) if (b.kasMasuk || b.biaya) s.add(Number(b.bulan.slice(0, 4)));
    return [...s].filter((t) => t <= kini.getFullYear() + 1).sort((a, b) => a - b).slice(-4);
  }, [tagihan, bulanan, proyekId, kini]);

  const lembar = useMemo(
    () => susunLembar(tahun, tagihan ?? [], ringkas, bulanan ?? [], proyekId, kini),
    [tahun, tagihan, ringkas, bulanan, proyekId, kini],
  );
  const bawaan = lembar.akhirNyata < 0 ? 0 : lembar.akhirNyata;
  const laporan = laporanPilih === null ? bawaan : Math.min(laporanPilih, 11);
  const nyataLaporan = Math.min(laporan, lembar.akhirNyata);
  const proyekDipilih = proyekId ? ringkas?.proyek.find((p) => p.projectId === proyekId) : undefined;

  function gantiTahun(t: number) {
    if (t === tahun) return;
    setTahun(t);
    setLaporanPilih(null);
  }
  function pilihBulan(i: number) {
    setLaporanPilih(i === bawaan && laporanPilih !== null ? null : i);
  }
  function tombolBulan(e: KeyboardEvent<HTMLButtonElement>, i: number) {
    const ke = e.key === "ArrowRight" ? i + 1 : e.key === "ArrowLeft" ? i - 1 : e.key === "Home" ? 0 : e.key === "End" ? 11 : null;
    if (ke === null) return;
    e.preventDefault();
    const j = Math.max(0, Math.min(11, ke));
    pilihBulan(j);
    (e.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>(".kvs__bln")[j])?.focus();
  }

  /* --- Rekapitulasi s.d. tanggal laporan --------------------------------- */
  const rekap = useMemo(() => {
    const k = nyataLaporan;
    const penerimaan = lembar.baris
      .map((b) => ({ kunci: b.kunci, judul: b.judul, href: b.href, jumlah: k < 0 ? 0 : b.realisasi.slice(0, k + 1).reduce((n, v) => n + v, 0) }))
      .filter((r) => r.jumlah > 0)
      .sort((a, b) => b.jumlah - a.jumlah);
    let a = penerimaan;
    if (penerimaan.length > MAKS_A) {
      const sisa = penerimaan.slice(MAKS_A - 1);
      a = [
        ...penerimaan.slice(0, MAKS_A - 1),
        { kunci: "lain", judul: `Proyek lain (${sisa.length})`, href: null, jumlah: sisa.reduce((n, r) => n + r.jumlah, 0) },
      ];
    }
    const jumlahA = penerimaan.reduce((n, r) => n + r.jumlah, 0);
    const batas = k < 0 ? "" : `${tahun}-${String(k + 1).padStart(2, "0")}`;
    const kat = new Map<string, number>();
    for (const c of biaya ?? []) {
      const b = c.incurredOn.slice(0, 7);
      if (!batas || b.slice(0, 4) !== String(tahun) || b > batas || (proyekId && c.projectId !== proyekId)) continue;
      kat.set(c.category, (kat.get(c.category) ?? 0) + c.amount);
    }
    const jumlahB = k < 0 ? 0 : lembar.beban.slice(0, k + 1).reduce((n, v) => n + v, 0);
    const b = KATEGORI.map(([kode, label]) => ({ kunci: kode, judul: label, jumlah: kat.get(kode) ?? 0 }));
    for (const [kode, v] of kat) if (!KATEGORI.some(([x]) => x === kode)) b[3]!.jumlah += v;
    /* Daftar biaya dibatasi API; yang tidak terinci tetap dihitung dari
       catatan bulanan supaya jumlah B sama dengan baris beban kurva. */
    const terinci = b.reduce((n, r) => n + r.jumlah, 0);
    if (jumlahB - terinci > 0.5) b.push({ kunci: "tanpa", judul: "Tanpa rincian", jumlah: jumlahB - terinci });
    const jumlahBTampil = Math.max(jumlahB, terinci);
    const laba = jumlahA - jumlahBTampil;
    const rencanaRp = k < 0 ? 0 : ((lembar.kumRencana[k]! - lembar.kumRealisasi[k]!) / 100) * lembar.total;
    return {
      a,
      b,
      jumlahA,
      jumlahB: jumlahBTampil,
      laba,
      marjin: jumlahA > 0 ? (laba / jumlahA) * 100 : null,
      tertunggak: Math.max(0, rencanaRp),
      deviasi: k < 0 ? null : lembar.kumRealisasi[k]! - lembar.kumRencana[k]!,
    };
  }, [lembar, nyataLaporan, biaya, tahun, proyekId]);

  const judulLaporan = `${BULAN[laporan]} ${tahun}`;
  const kolomAktif = sorot ?? laporan;
  const sebutTerbilang = (v: number) => (v === 0 ? "nol rupiah" : `${v < 0 ? "minus " : ""}${terbilang(Math.abs(Math.round(v)))}`);
  const sel = (
    i: number,
    isi: string | null,
    kelas = "",
  ) => (
    <span
      key={i}
      role="cell"
      className={`kvs__sel${i === kolomAktif ? " is-kolom" : ""}${i === laporan ? " is-laporan" : ""}${i > lembar.akhirNyata ? " is-depan" : ""}${kelas ? ` ${kelas}` : ""}`}
    >
      {isi ?? "·"}
    </span>
  );

  const ringkasan: { label: string; satuan: string; isi: (i: number) => [string | null, string?] }[] = [
    { label: "Rencana kumulatif", satuan: "%", isi: (i) => [persen(lembar.kumRencana[i]!)] },
    { label: "Realisasi kumulatif", satuan: "%", isi: (i) => [i <= lembar.akhirNyata ? persen(lembar.kumRealisasi[i]!) : null, "is-tinta"] },
    {
      label: "Deviasi",
      satuan: "%",
      isi: (i) => {
        if (i > lembar.akhirNyata) return [null];
        const d = lembar.kumRealisasi[i]! - lembar.kumRencana[i]!;
        if (Math.abs(d) < 0.05) return ["0,0"];
        return [`${d > 0 ? "+" : "−"}${persen(Math.abs(d))}`, d < 0 ? "is-telat" : "is-maju"];
      },
    },
    { label: "Kas masuk", satuan: "jt", isi: (i) => [i <= lembar.akhirNyata ? (lembar.masuk[i] ? juta(lembar.masuk[i]!) : "–") : null] },
    { label: "Beban", satuan: "jt", isi: (i) => [i <= lembar.akhirNyata ? (lembar.beban[i] ? juta(lembar.beban[i]!) : "–") : null] },
    {
      label: "Laba bersih",
      satuan: "jt",
      isi: (i) => {
        if (i > lembar.akhirNyata) return [null];
        const v = lembar.masuk[i]! - lembar.beban[i]!;
        if (!lembar.masuk[i] && !lembar.beban[i]) return ["–"];
        return [`${v < 0 ? "−" : ""}${juta(Math.abs(v))}`, v < 0 ? "is-telat is-tebal" : "is-tebal"];
      },
    },
  ];

  const maksArus = Math.max(1, ...lembar.masuk.map((m, i) => (i <= lembar.akhirNyata ? Math.max(m, lembar.beban[i]!) : 0)));
  const butirSorot = sorotBaris ? lembar.baris.find((b) => b.kunci === sorotBaris) ?? null : null;
  const kota = studio?.city?.trim();
  const nama = studio?.studioName || "Studio";

  return (
    <div className="kvs">
      <div className="kvs__meja">
        {/* ---- REKAPITULASI ---------------------------------------------- */}
        <section className="kvs__kertas kvs__rekap" aria-label="Rekapitulasi arus kas">
          <header className="kvs__rekapkop">
            <p className="kvs__alis">Daftar rekapitulasi</p>
            <h2>Arus kas studio</h2>
            <p className="kvs__rekapket">
              1 Januari s.d. akhir {judulLaporan}
              {proyekDipilih ? ` · ${proyekDipilih.projectTitle}` : ""}
            </p>
          </header>
          <div className="kvs__rab" role="table" aria-label="Rekapitulasi penerimaan dan pengeluaran">
            <div className="kvs__rabkepala" role="row">
              <span role="columnheader">No</span>
              <span role="columnheader">Uraian</span>
              <span role="columnheader">Jumlah (Rp)</span>
            </div>
            <div className="kvs__rabbagian" role="row">
              <span role="cell">A</span>
              <span role="cell">Penerimaan</span>
              <span role="cell" />
            </div>
            {rekap.a.map((r, i) => (
              <div
                key={r.kunci}
                role="row"
                className={`kvs__rabbaris${sorotBaris === r.kunci ? " is-sorot" : ""}`}
                onPointerEnter={(e) => e.pointerType === "mouse" && setSorotBaris(r.kunci)}
                onPointerLeave={(e) => e.pointerType === "mouse" && setSorotBaris(null)}
              >
                <span role="cell">{i + 1}</span>
                <span role="cell" title={r.judul}>
                  {r.href ? <a href={r.href}>{r.judul}</a> : r.judul}
                  <i className="kvs__porsi" style={{ width: `${(r.jumlah / (rekap.jumlahA || 1)) * 100}%` }} aria-hidden="true" />
                </span>
                <span role="cell">{r.jumlah.toLocaleString("id-ID")}</span>
              </div>
            ))}
            {rekap.a.length === 0 && (
              <div role="row" className="kvs__rabbaris kvs__rabbaris--kosong">
                <span role="cell" />
                <span role="cell">Belum ada termin lunas</span>
                <span role="cell">0</span>
              </div>
            )}
            <div className="kvs__rabjumlah" role="row">
              <span role="cell" />
              <span role="cell">Jumlah A</span>
              <span role="cell">
                <Hitung nilai={rekap.jumlahA} hidup={hidup} format={ribuan} />
              </span>
            </div>
            <div className="kvs__rabbagian" role="row">
              <span role="cell">B</span>
              <span role="cell">Pengeluaran</span>
              <span role="cell" />
            </div>
            {rekap.b.map((r, i) => (
              <div key={r.kunci} role="row" className={`kvs__rabbaris${r.jumlah ? "" : " is-nol"}`}>
                <span role="cell">{i + 1}</span>
                <span role="cell">
                  {r.judul}
                  <i className="kvs__porsi kvs__porsi--b" style={{ width: `${(r.jumlah / (rekap.jumlahB || 1)) * 100}%` }} aria-hidden="true" />
                </span>
                <span role="cell">{r.jumlah ? r.jumlah.toLocaleString("id-ID") : "–"}</span>
              </div>
            ))}
            <div className="kvs__rabjumlah" role="row">
              <span role="cell" />
              <span role="cell">Jumlah B</span>
              <span role="cell">
                <Hitung nilai={rekap.jumlahB} hidup={hidup} format={ribuan} />
              </span>
            </div>
          </div>

          {/* C — laba bersih: angka akhir rekapitulasi, dengan neraca batang
              penerimaan yang terbagi jadi beban dan laba. */}
          <section className={`kvs__laba${rekap.laba < 0 ? " is-rugi" : ""}`} aria-label="Laba bersih">
            <p className="kvs__labakop">
              <b>C</b>
              <span>Laba bersih (A − B)</span>
              <em>s.d. {BULAN_PENDEK[laporan]} {tahun}</em>
            </p>
            <p className="kvs__labaangka">
              <small>Rp</small>
              <Hitung nilai={rekap.laba} hidup={hidup} format={ribuanBertanda} />
            </p>
            {rekap.jumlahA + rekap.jumlahB > 0 && (
              <div className="kvs__neraca">
                <div className="kvs__neracabatang" aria-hidden="true">
                  <i className="is-beban" style={{ width: `${(Math.min(rekap.jumlahA, rekap.jumlahB) / Math.max(rekap.jumlahA, rekap.jumlahB)) * 100}%` }} />
                  <i
                    className={rekap.laba >= 0 ? "is-untung" : "is-rugi"}
                    style={{ width: `${(Math.abs(rekap.laba) / Math.max(rekap.jumlahA, rekap.jumlahB)) * 100}%` }}
                  />
                </div>
                <p className="kvs__neracaket">
                  <span>
                    <i className="is-beban" aria-hidden="true" />
                    Beban {rekap.jumlahA > 0 ? `${persen((rekap.jumlahB / rekap.jumlahA) * 100)}%` : "—"}
                  </span>
                  <span>
                    <i className={rekap.laba >= 0 ? "is-untung" : "is-rugi"} aria-hidden="true" />
                    {rekap.laba >= 0 ? "Laba" : "Rugi"} {rekap.marjin === null ? "—" : `${persen(Math.abs(rekap.marjin))}%`}
                  </span>
                </p>
              </div>
            )}
            <p className="kvs__terbilang">
              <span>Terbilang</span># {sebutTerbilang(rekap.laba)} #
            </p>
          </section>
          <dl className="kvs__catatan">
            <div className={rekap.tertunggak > 0 ? "is-telat" : undefined}>
              <dt>Tertunggak</dt>
              <dd>{formatRupiah(rekap.tertunggak)}</dd>
            </div>
            <div>
              <dt>Piutang kini</dt>
              <dd>{formatRupiah(ringkas?.piutang ?? 0)}</dd>
            </div>
          </dl>
          <p className="kvs__tandatangan">
            <span>
              {kota ? `${kota}, ` : ""}
              {tanggalPendek(kini)}
            </span>
            <b>{nama}</b>
          </p>
        </section>

        {/* ---- KURVA S --------------------------------------------------- */}
        <section className="kvs__kertas kvs__lembar" aria-label={`Kurva S tahun ${tahun}`}>
          <header className="kvs__kop">
            <div className="kvs__judul">
              <p className="kvs__alis">Time schedule</p>
              <h2>
                Kurva S{" "}
                {daftarTahun.length > 1 ? (
                  <PilihMenu
                    label="Tahun anggaran"
                    nilai={String(tahun)}
                    onUbah={(v) => gantiTahun(Number(v))}
                    opsi={[...daftarTahun].reverse().map((t) => ({ nilai: String(t), label: String(t), ket: t === kini.getFullYear() ? "tahun berjalan" : t > kini.getFullYear() ? "rencana" : undefined }))}
                    pemicu={
                      <button type="button" className="kvs__tahunpicu">
                        {tahun}
                        <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">
                          <path d="M2.5 4.5 6 8l3.5-3.5" />
                        </svg>
                      </button>
                    }
                  />
                ) : (
                  <span>{tahun}</span>
                )}
              </h2>
              <p className="kvs__judulket">Rencana penagihan &amp; realisasi penerimaan</p>
            </div>
            <dl className="kvs__progres" aria-label={`Progres s.d. ${judulLaporan}`}>
              <div className="is-utama">
                <dt>Realisasi</dt>
                <dd>
                  {nyataLaporan < 0 ? "—" : <Hitung nilai={lembar.kumRealisasi[nyataLaporan]!} hidup={hidup} format={persen} />}
                  <small>%</small>
                </dd>
              </div>
              <div>
                <dt>Rencana</dt>
                <dd>
                  <Hitung nilai={lembar.kumRencana[laporan]!} hidup={hidup} format={persen} />
                  <small>%</small>
                </dd>
              </div>
              <div className={rekap.deviasi !== null && rekap.deviasi < -0.05 ? "is-telat" : rekap.deviasi !== null && rekap.deviasi > 0.05 ? "is-maju" : undefined}>
                <dt>{rekap.deviasi !== null && rekap.deviasi < -0.05 ? "Terlambat" : "Deviasi"}</dt>
                <dd>
                  {rekap.deviasi === null ? "—" : `${rekap.deviasi > 0.05 ? "+" : rekap.deviasi < -0.05 ? "−" : ""}${persen(Math.abs(rekap.deviasi))}`}
                  <small>%</small>
                </dd>
              </div>
            </dl>
            <dl className="kvs__kopisi">
              <div>
                <dt>Pekerjaan</dt>
                <dd>{proyekDipilih ? proyekDipilih.projectTitle : `${lembar.baris.length} proyek`}</dd>
              </div>
              <div>
                <dt>Nilai kontrak</dt>
                <dd>{formatRupiah(lembar.total)}</dd>
              </div>
              <div>
                <dt>Laporan s.d.</dt>
                <dd>{judulLaporan}</dd>
              </div>
              <div>
                <dt>Perencana</dt>
                <dd title={nama}>{nama}</dd>
              </div>
            </dl>
          </header>

          <div className="kvs__geser">
          <div className="kvs__tabel" role="table" aria-label={`Kurva S ${tahun}`}>
            <div className="kvs__kepala" role="row">
              <span role="columnheader">No</span>
              <span role="columnheader">Uraian pekerjaan</span>
              <span role="columnheader" className="is-kanan">
                Bobot
              </span>
              {BULAN_PENDEK.map((b, i) => (
                <button
                  key={b}
                  type="button"
                  role="columnheader"
                  className={`kvs__bln${i === laporan ? " is-laporan" : ""}${i === kolomAktif ? " is-kolom" : ""}${i > lembar.akhirNyata ? " is-depan" : ""}`}
                  aria-pressed={i === laporan}
                  aria-label={`${BULAN[i]} ${tahun}${i === laporan ? ", tanggal laporan" : ""}`}
                  tabIndex={i === laporan ? 0 : -1}
                  onClick={() => pilihBulan(i)}
                  onKeyDown={(e) => tombolBulan(e, i)}
                  onPointerEnter={(e) => e.pointerType === "mouse" && setSorot(i)}
                  onPointerLeave={(e) => e.pointerType === "mouse" && setSorot(null)}
                  onFocus={() => setSorot(i)}
                  onBlur={() => setSorot(null)}
                >
                  {b}
                </button>
              ))}
              <span role="columnheader" className="is-kanan">
                %
              </span>
            </div>

            <div className="kvs__isi" style={{ "--kvs-n": Math.max(1, lembar.baris.length) } as CSSProperties}>
              {lembar.baris.map((b, n) => (
                <div
                  key={b.kunci}
                  role="row"
                  className={`kvs__baris${sorotBaris === b.kunci ? " is-sorot" : ""}`}
                  onPointerEnter={(e) => e.pointerType === "mouse" && setSorotBaris(b.kunci)}
                  onPointerLeave={(e) => e.pointerType === "mouse" && setSorotBaris(null)}
                >
                  <span role="cell" className="kvs__no">
                    {n + 1}
                  </span>
                  <span role="cell" className="kvs__uraian">
                    {b.href ? (
                      <a href={b.href} title={b.judul}>
                        {b.judul}
                      </a>
                    ) : (
                      <b title={b.judul}>{b.judul}</b>
                    )}
                    <small>{b.sub}</small>
                  </span>
                  <span role="cell" className="kvs__bobot">
                    {persen((b.nilai / (lembar.total || 1)) * 100)}
                  </span>
                  {b.rencana.map((r, i) => {
                    const q = b.realisasi[i]!;
                    const lebar = (v: number) => `${Math.round(34 + (66 * v) / lembar.maksSel)}%`;
                    return (
                      <span role="cell" key={i} className={`kvs__blnsel${i === kolomAktif ? " is-kolom" : ""}`}>
                        {r > 0 && <i className="kvs__batang kvs__batang--rencana" style={{ width: lebar(r) }} />}
                        {q > 0 && <i className={`kvs__batang kvs__batang--nyata${i > laporan ? " is-pensil" : ""}`} style={{ width: lebar(q) }} />}
                        <span className="sr-only">
                          {r > 0 ? `rencana ${formatRupiah(r)}` : ""}
                          {q > 0 ? ` realisasi ${formatRupiah(q)}` : ""}
                        </span>
                      </span>
                    );
                  })}
                  <span role="cell" />
                </div>
              ))}
              {lembar.baris.length === 0 && (
                <p className="kvs__kosong">{tagihan === null ? "Memuat termin…" : `Belum ada termin berjadwal di ${tahun}.`}</p>
              )}
              <BidangKurva
                lembar={lembar}
                laporan={laporan}
                sorot={sorot}
                tahun={tahun}
                hidup={hidup}
                onSorot={setSorot}
                onPilih={pilihBulan}
                ket={ket}
                proyek={butirSorot}
              />
            </div>

            <div className="kvs__mistar" aria-hidden="true">
              <i />
            </div>

            <div role="row" className="kvs__arus">
              <span role="rowheader">
                Arus kas
                <small>
                  <i className="is-masuk" aria-hidden="true" />
                  masuk
                  <i className="is-beban" aria-hidden="true" />
                  beban
                </small>
              </span>
              {BULAN_PENDEK.map((_, i) => {
                const ada = i <= lembar.akhirNyata;
                const m = lembar.masuk[i]!;
                const b = lembar.beban[i]!;
                return (
                  <span
                    key={i}
                    role="cell"
                    className={`kvs__aruskol${i === kolomAktif ? " is-kolom" : ""}${i === laporan ? " is-laporan" : ""}`}
                    {...(ada
                      ? ket(() => ({
                          judul: `${BULAN[i]} ${tahun}`,
                          baris: [
                            { label: "Kas masuk", nilai: formatRupiah(m) },
                            { label: "Beban", nilai: formatRupiah(b) },
                            { label: m - b < 0 ? "Rugi" : "Laba", nilai: formatRupiah(m - b) },
                          ],
                        }))
                      : {})}
                  >
                    {ada && m > 0 && <i className="kvs__arusmasuk" style={{ height: `${(m / maksArus) * 46}%` }} />}
                    {ada && b > 0 && <i className="kvs__arusbeban" style={{ height: `${(b / maksArus) * 46}%` }} />}
                    <span className="sr-only">{ada ? `masuk ${formatRupiah(m)}, beban ${formatRupiah(b)}` : "belum tiba"}</span>
                  </span>
                );
              })}
              <span role="cell" className="kvs__satuan" />
            </div>

            {ringkasan.map((r) => (
              <div key={r.label} role="row" className="kvs__ringkas">
                <span role="rowheader">{r.label}</span>
                {BULAN_PENDEK.map((_, i) => {
                  const [teks, kelas] = r.isi(i);
                  return sel(i, teks, kelas);
                })}
                <span role="cell" className="kvs__satuan">
                  {r.satuan}
                </span>
              </div>
            ))}
          </div>
          </div>

          <footer className="kvs__kaki">
            <span className="kvs__legenda">
              <i className="is-rencana" aria-hidden="true" />
              Rencana · tagihan menurut tenggat
            </span>
            <span className="kvs__legenda">
              <i className="is-tinta" aria-hidden="true" />
              Realisasi · tagihan lunas
            </span>
            {laporan < lembar.akhirNyata && (
              <span className="kvs__legenda">
                <i className="is-pensil" aria-hidden="true" />
                sesudah tanggal laporan
              </span>
            )}
            <span className="kvs__legenda">
              <i className="is-arsir" aria-hidden="true" />
              terlambat
            </span>
            {lembar.tanpaJadwal.n > 0 && (
              <span className="kvs__legenda is-catatan">
                {lembar.tanpaJadwal.n} termin belum berjadwal · {formatRupiahRingkas(lembar.tanpaJadwal.jumlah)}
              </span>
            )}
          </footer>
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
        <div className="kvs kvs--rangka">
          <div className="kvs__meja">
            <div className="kvs__kertas kvs__rekap" />
            <div className="kvs__kertas kvs__lembar" />
          </div>
        </div>
      }
    >
      <Isi />
    </RequireAuth>
  );
}
