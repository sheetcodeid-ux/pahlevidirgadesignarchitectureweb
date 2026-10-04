import { KartuMelayang } from "../kit/Overlay";
import { useEffect, useMemo, useRef, useState } from "react";
import { RequireAuth } from "./RequireAuth";
import { useKemajuanTarget, persenTarget, kalimatSisa, labelSemester } from "./targetKit";
import { KepalaSeksi, BarisLog, BarisBeban } from "../kit/Item";
import { Tren } from "../kit/Kartu";
import { Kilau, KolomGrafik, LabelYGrafik } from "../kit/Grafik";
import { BarKemajuan, Cincin, Donat } from "../kit/Ukuran";
import { Segmen } from "../kit/Segmen";
import { Lencana, type NadaLencana } from "../kit/Lencana";
import { Ikon, type DataIkon } from "../kit/Ikon";
import { PilihTombol } from "./frame25";
import {
  CheckCircle,
  CoinIn,
  CoinOut,
  NavReceipt,
  Plus,
  Ruler,
  SpecialArmchair,
  SpecialHouseLine,
  SpecialLeaf,
  SpecialPath,
  SpecialPintGlass,
  SpecialWarehouse,
  SpecialWrench,
  Wallet,
} from "../kit/ikon";
import {
  ambilSettings,
  ambilRingkasanKeuangan,
  ambilBulanan,
  semuaBiaya,
  semuaPembayaran,
  bacaCache,
  tulisCache,
  type FinanceOverview,
  type FinanceOverviewRow,
  type BarisBulanan,
  type BiayaProyek,
  type Pembayaran,
  type Proyek,
} from "../../lib/admin";
import { ambilNotifikasi, TAHAP_PROYEK, type IsiNotifikasi } from "../../lib/notifikasi";
import { kepalaHari, waktuButir, ikonButir } from "./linimasaNotif";
import { formatRupiah, formatRupiahRingkas } from "../../lib/format";

/* =============================================================================
   Dashboard — "meja kerja" studio. Dirancang ulang atas permintaan pemilik
   ("upgrade halaman dashboard … kebebasan mau custom ui, pokoknya harus
   bagus"); tata letak frame 01 Coinest tidak lagi diikuti di halaman ini.

   Yang dipegang dari rancangan lama: SETIAP angka dan fitur tetap ada —
   jebakan #38 (rombak yang diam-diam menghapus fitur). Pemetaannya:

     dulu                          sekarang
     ---------------------------   -----------------------------------------
     kartu kas (nama studio,       sorotan: nama studio di atas sapaan;
       kas masuk, proyek, piutang)   kas masuk & piutang di kartu Proyek
     aksi cepat (4 tombol)         sorotan: empat tombol di bawah sapaan
     Target Semester               sorotan: cincin capaian + kalimat sisa
     3 kartu statistik + kilau     sorotan: tiga baris "bulan ini" + kilau
     Arus Kas (kolom 12 bulan)     kartu Arus Kas, tampilan "Arus"
     Statistik (donat masuk/beban) kartu Arus Kas, tampilan "Komposisi"
     Proyek Berjalan + Laba per    kartu Proyek: satu daftar — tahap, kas
       Proyek                        diterima / kontrak, laba; urutannya
                                     dipilih (berjalan, laba, piutang)
     Perlu Ditangani               kartu Perlu Ditangani, digulir di
                                     dalam kartunya alih-alih dipangkas

   Satu layar di laptop: sorotan setinggi isinya, baris kedua mengisi sisa
   tinggi, dan grafik arus kas mengukur tinggi bidangnya sendiri.
   ============================================================================= */

const BULAN = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];
const BULAN_PENDEK = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

const LABEL_BEBAN: Record<string, string> = {
  freelancer: "Freelancer",
  operasional: "Operasional",
  prinsipal: "Prinsipal",
  lainnya: "Lainnya",
};

/**
 * Nama kategori yang tidak ada di peta di atas TETAP harus terbaca. Kolomnya
 * enum Postgres, dan enum bertambah lebih sering daripada peta ini
 * diperbarui — tanpa ini legenda menuliskan nama kolom mentah seperti
 * "tenaga_kerja".
 */
function labelBeban(kategori: string): string {
  const tahu = LABEL_BEBAN[kategori];
  if (tahu) return tahu;
  const rapi = kategori.replace(/[_-]+/g, " ").trim();
  return rapi.charAt(0).toUpperCase() + rapi.slice(1);
}

/* Ubin proyek: ikon jenis proyek dari pustaka ikon "Special" Coinest. Jenis
   yang tidak dikenal jatuh ke penggaris, ikon Proyek di rel samping. */
const IKON_KATEGORI: Record<string, DataIkon> = {
  residential: SpecialHouseLine,
  commercial: SpecialWarehouse,
  coffeeshop: SpecialPintGlass,
  interior: SpecialArmchair,
  landscape: SpecialLeaf,
  masterplan: SpecialPath,
  renovation: SpecialWrench,
};

/** Urutan tahap pipeline — untuk mengurutkan proyek berjalan dari yang
 *  paling jauh. Kuncinya sama dengan TAHAP_PROYEK. */
const URUT_TAHAP = Object.keys(TAHAP_PROYEK);

/** "YYYY-MM" untuk bulan ke-`mundur` sebelum bulan ini, waktu setempat. */
function kunciBulan(mundur = 0): string {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - mundur);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Batas bawah rentang (awal bulan ke-n ke belakang), atau null untuk semua.
 *  Sama dengan halaman Keuangan, supaya "3 bulan" berarti hal yang sama di
 *  kedua halaman. */
function batasRentang(bulan: number): number | null {
  if (bulan <= 0) return null;
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  d.setMonth(d.getMonth() - (bulan - 1));
  return d.getTime();
}

/** `paid_at` timestamptz ATAU `incurred_on` date -> milidetik, awal harinya. */
function waktuKe(iso: string): number {
  return new Date(iso.length === 10 ? iso + "T00:00:00" : iso).getTime();
}

/** Rupiah dipendekkan untuk sumbu grafik: 12.500.000 -> "12,5 jt". */
function singkat(n: number): string {
  const a = Math.abs(n);
  const t = n < 0 ? "−" : "";
  if (a >= 1_000_000_000) return `${t}${(a / 1_000_000_000).toFixed(1).replace(".", ",")} M`;
  if (a >= 1_000_000) return `${t}${Math.round(a / 1_000_000)} jt`;
  if (a >= 1_000) return `${t}${Math.round(a / 1_000)} rb`;
  return `${t}${a}`;
}

/** Selisih terhadap bulan lalu: "+ 1,8 %". Null kalau bulan lalu nol —
 *  pembagian dengan nol melahirkan "+Infinity %". */
function selisih(kini: number, lalu: number): { naik: boolean; teks: string } | null {
  if (!lalu) return null;
  const p = ((kini - lalu) / Math.abs(lalu)) * 100;
  return { naik: p >= 0, teks: `${p >= 0 ? "+" : "−"} ${Math.abs(p).toFixed(1).replace(".", ",")} %` };
}

/** Sapaan menurut jam setempat — pagi sampai 11, siang sampai 15, sore
 *  sampai 18, sesudahnya malam. */
function sapaanJam(jam: number): string {
  if (jam < 11) return "Selamat pagi";
  if (jam < 15) return "Selamat siang";
  if (jam < 18) return "Selamat sore";
  return "Selamat malam";
}

const RENTANG_ARUS = [
  { nilai: "12", label: "12 bulan" },
  { nilai: "tahun", label: "Tahun ini" },
];

const RENTANG_STAT = [
  { nilai: "1", label: "Bulan ini" },
  { nilai: "3", label: "3 bulan" },
  { nilai: "12", label: "12 bulan" },
  { nilai: "0", label: "Semua" },
];

const URUT_PROYEK = [
  { nilai: "jalan", label: "Sedang berjalan" },
  { nilai: "laba", label: "Laba terbesar" },
  { nilai: "rugi", label: "Laba terkecil" },
  { nilai: "piutang", label: "Piutang terbesar" },
];

const AKSI: { label: string; ikon: DataIkon; href: string; utama?: boolean }[] = [
  { label: "Terima bayaran", ikon: CoinIn, href: "/admin/keuangan/terima", utama: true },
  { label: "Catat biaya", ikon: CoinOut, href: "/admin/keuangan/keluar" },
  { label: "Tagihan", ikon: NavReceipt, href: "/admin/keuangan/tagihan" },
];
/* "Proyek baru" tidak ikut di sini: tombol + di kepala kartu Proyek sudah
   mengerjakannya, dan tombol keempat tidak muat sebaris pada 1366. */

interface Irisan {
  kunci: string;
  label: string;
  nilai: number;
}

/** Kelompokkan lalu ambil lima terbesar; sisanya dilipat jadi "Lainnya"
 *  supaya donatnya tetap berjumlah 100% dan tangga warnanya cukup. */
function limaTerbesar(peta: Map<string, { label: string; nilai: number }>): Irisan[] {
  const urut = [...peta.entries()]
    .map(([kunci, v]) => ({ kunci, ...v }))
    .filter((x) => x.nilai > 0)
    .sort((a, b) => b.nilai - a.nilai);
  if (urut.length <= 5) return urut;
  const sisa = urut.slice(4).reduce((a, b) => a + b.nilai, 0);
  return [...urut.slice(0, 4), { kunci: "lainnya", label: "Lainnya", nilai: sisa }];
}

/** Satu baris "bulan ini" di sorotan: ubin ikon, nilai, tren, garis mungil. */
function BarisKpi({
  ikon,
  label,
  nilai,
  penuh,
  tren,
  grafik,
  href,
}: {
  ikon: DataIkon;
  label: string;
  nilai: string;
  penuh: string;
  tren: React.ReactNode;
  grafik?: React.ReactNode;
  href: string;
}) {
  return (
    <a className="dsb__kpi" href={href}>
      <span className="dsb__kpiubin">
        <Ikon ikon={ikon} ukuran={16} />
      </span>
      <span className="dsb__kpiteks">
        <span className="dsb__kpilabel">{label}</span>
        <b className="dsb__kpinilai" title={penuh}>
          {nilai}
        </b>
      </span>
      <span className="dsb__kpitren">{tren}</span>
      <span className="dsb__kpikilau">{grafik}</span>
    </a>
  );
}

function Isi() {
  const [nama, setNama] = useState<string | null>(
    () => bacaCache<{ studioName?: string }>("settings")?.studioName ?? null,
  );
  /* Kunci cache yang SAMA dengan halaman Keuangan dan Semua Transaksi: isinya
     data yang sama persis, dan membaginya membuat perpindahan antarhalaman
     itu tidak mengambil ulang apa pun. Tiap halaman ini cuma satu island
     data, jadi menulisnya tidak bisa merusak hidrasi island lain
     (jebakan #8). */
  const [keu, setKeu] = useState<FinanceOverview | null>(() => bacaCache<FinanceOverview>("keuangan:semua"));
  const [target] = useKemajuanTarget();
  const [bulanan, setBulanan] = useState<BarisBulanan[] | null>(() =>
    bacaCache<BarisBulanan[]>("keuangan-bulan:semua"),
  );
  const [biaya, setBiaya] = useState<BiayaProyek[] | null>(() => bacaCache<BiayaProyek[]>("biaya-semua"));
  const [bayar, setBayar] = useState<Pembayaran[] | null>(() => bacaCache<Pembayaran[]>("bayar-semua"));
  const [notif, setNotif] = useState<IsiNotifikasi | null>(() => bacaCache<IsiNotifikasi>("dasbor-notif"));

  const [mode, setMode] = useState<"arus" | "komposisi">("arus");
  const [rentangArus, setRentangArus] = useState("12");
  const [rentangStat, setRentangStat] = useState("1");
  const [tabStat, setTabStat] = useState<"masuk" | "beban">("beban");
  const [urutProyek, setUrutProyek] = useState("jalan");
  const [sorot, setSorot] = useState<number | null>(null);

  /* Sapaan dan nama bulan dihitung SESUDAH dipasang: halaman ini hasil
     build, jadi jam yang dirender server bukan jam pembacanya (jebakan #8). */
  const [sapaan, setSapaan] = useState("Selamat datang");
  const [namaBulan, setNamaBulan] = useState("Bulan");

  useEffect(() => {
    const kini = new Date();
    setSapaan(sapaanJam(kini.getHours()));
    setNamaBulan(BULAN[kini.getMonth()]!);
    /* Tiap permintaan menyalakan bagiannya sendiri. Satu yang gagal tidak
       boleh mengosongkan seluruh halaman — dashboard yang separuh terisi
       masih berguna. */
    ambilSettings()
      .then((s) => setNama(s.studioName))
      .catch(() => setNama((l) => l ?? "Dirga Pahlevi Architecture"));
    ambilRingkasanKeuangan(null)
      .then((d) => {
        tulisCache("keuangan:semua", d);
        setKeu(d);
      })
      .catch(() => {});
    /* 24 bulan, bukan 12: kuncinya dipakai bersama halaman Keuangan yang
       memintanya 24. Menulis 12 ke kunci yang sama akan memotong grafik
       halaman itu setiap kali Dashboard dibuka lebih dulu. */
    ambilBulanan(null, 24)
      .then((d) => {
        tulisCache("keuangan-bulan:semua", d);
        setBulanan(d);
      })
      .catch(() => setBulanan((l) => l ?? []));
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
    ambilNotifikasi()
      .then((d) => {
        tulisCache("dasbor-notif", d);
        setNotif(d);
      })
      .catch(() => setNotif((l) => l ?? { notifikasi: [], milestone: [], proyekAktif: 0, proyek: [] }));
  }, []);

  /* ---- Angka bulanan -------------------------------------------------------- */

  const perBulan = useMemo(() => new Map((bulanan ?? []).map((b) => [b.bulan, b])), [bulanan]);
  const bulanIni = perBulan.get(kunciBulan(0));
  const bulanLalu = perBulan.get(kunciBulan(1));
  const kasKini = bulanIni?.kasMasuk ?? 0;
  const bebanKini = bulanIni?.biaya ?? 0;
  const labaKini = bulanIni?.labaBersih ?? kasKini - bebanKini;
  const tKas = selisih(kasKini, bulanLalu?.kasMasuk ?? 0);
  const tBeban = selisih(bebanKini, bulanLalu?.biaya ?? 0);
  const tLaba = selisih(labaKini, bulanLalu?.labaBersih ?? 0);

  /* Enam bulan terakhir untuk garis mungil — dari data arus kas yang sudah
     dimuat, tanpa permintaan baru. Kosong sampai datanya tiba: garis datar
     nol akan terbaca sebagai "tidak ada uang", bukan "belum dimuat". */
  const enam = useMemo(() => {
    if (!bulanan) return null;
    const b = Array.from({ length: 6 }, (_, i) => perBulan.get(kunciBulan(5 - i)));
    return {
      kas: b.map((x) => x?.kasMasuk ?? 0),
      beban: b.map((x) => x?.biaya ?? 0),
      laba: b.map((x) => x?.labaBersih ?? (x ? x.kasMasuk - x.biaya : 0)),
    };
  }, [bulanan, perBulan]);
  const kilau = (titik: number[] | undefined, buruk: boolean) =>
    titik ? (
      <Kilau
        titik={titik}
        turun={buruk}
        lebar={72}
        tinggi={30}
        keterangan={(i) => {
          const k = kunciBulan(5 - i);
          return { judul: `${BULAN_PENDEK[Number(k.slice(5, 7)) - 1]} ${k.slice(0, 4)}`, nilai: formatRupiahRingkas(titik[i] ?? 0) };
        }}
      />
    ) : undefined;
  const tren = (t: { naik: boolean; teks: string } | null, baik?: boolean) =>
    t ? (
      <Tren naik={t.naik} baik={baik}>
        {t.teks}
      </Tren>
    ) : (
      <span className="dsb__kpikosong">—</span>
    );

  /* ---- Arus kas ------------------------------------------------------------- */

  /* Dua belas kolom di kedua rentang. "Tahun ini" = Januari sampai Desember
     tahun berjalan — bulan yang belum datang tetap punya kolomnya, cuma
     tanpa batang. */
  const deret = useMemo(() => {
    const kini = new Date();
    return Array.from({ length: 12 }, (_, i) => {
      let kunci: string;
      let depan = false;
      if (rentangArus === "tahun") {
        kunci = `${kini.getFullYear()}-${String(i + 1).padStart(2, "0")}`;
        depan = i > kini.getMonth();
      } else {
        kunci = kunciBulan(11 - i);
      }
      const b = perBulan.get(kunci);
      return { kunci, kasMasuk: b?.kasMasuk ?? 0, biaya: b?.biaya ?? 0, depan };
    });
  }, [perBulan, rentangArus]);

  const maks = useMemo(() => {
    const t = Math.max(1, ...deret.flatMap((b) => [b.kasMasuk, b.biaya]));
    /* Dibulatkan ke atas ke kelipatan yang enak dibaca, supaya label sumbu
       tidak jadi "13.748.211". Sama dengan halaman Keuangan. */
    const pangkat = 10 ** Math.floor(Math.log10(t));
    return Math.ceil(t / pangkat) * pangkat;
  }, [deret]);

  const kasBersih = deret.reduce((a, b) => a + b.kasMasuk - b.biaya, 0);
  const bSorot = sorot !== null ? deret[sorot] : undefined;

  /* Bidang plot MENGUKUR dirinya: kartunya mengisi sisa tinggi layar, jadi
     tinggi grafiknya baru diketahui sesudah tata letak. ResizeObserver
     mengirim ukuran sesudah tata letak — tidak memaksa layout apa pun.
     Nilai awalnya kira-kira ukuran pada 1440x790. */
  const plot = useRef<HTMLDivElement>(null);
  const [ukPlot, setUkPlot] = useState({ w: 360, h: 170 });
  useEffect(() => {
    const el = plot.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      if (!e) return;
      const w = Math.round(e.contentRect.width);
      /* Label bulan di bawah batang memakan 26px dari tinggi wadah. */
      const h = Math.max(90, Math.round(e.contentRect.height) - 26);
      setUkPlot((l) => (l.w === w && l.h === h ? l : { w, h }));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [mode]);
  const tinggiPlot = ukPlot.h;
  const lebarBatang = Math.max(4, Math.min(22, (ukPlot.w / 12) * 0.55));

  /* ---- Komposisi (donat) ---------------------------------------------------- */

  const irisan = useMemo(() => {
    const batas = batasRentang(Number(rentangStat));
    const masuk = new Map<string, { label: string; nilai: number }>();
    for (const b of bayar ?? []) {
      if (batas !== null && waktuKe(b.paidAt) < batas) continue;
      const l = masuk.get(b.projectId) ?? { label: b.projectTitle ?? "—", nilai: 0 };
      l.nilai += b.amount;
      masuk.set(b.projectId, l);
    }
    const beban = new Map<string, { label: string; nilai: number }>();
    for (const k of biaya ?? []) {
      if (batas !== null && waktuKe(k.incurredOn) < batas) continue;
      const l = beban.get(k.category) ?? { label: labelBeban(k.category), nilai: 0 };
      l.nilai += k.amount;
      beban.set(k.category, l);
    }
    return { masuk: limaTerbesar(masuk), beban: limaTerbesar(beban) };
  }, [bayar, biaya, rentangStat]);

  const totalMasuk = irisan.masuk.reduce((a, b) => a + b.nilai, 0);
  const totalBeban = irisan.beban.reduce((a, b) => a + b.nilai, 0);
  const irisAktif = tabStat === "masuk" ? irisan.masuk : irisan.beban;
  const totalAktif = tabStat === "masuk" ? totalMasuk : totalBeban;

  /* ---- Proyek ---------------------------------------------------------------- */

  const barisKeu = useMemo(() => new Map((keu?.proyek ?? []).map((r) => [r.projectId, r])), [keu]);
  /* "Berjalan" = belum sampai pelunasan. Definisi yang sama dengan penghitung
     proyek di lib/notifikasi.ts — dua angka yang mengaku menghitung hal yang
     sama tapi berbeda isinya membuat panel tidak dipercaya. */
  const jalan = useMemo(
    () => (notif?.proyek ?? []).filter((p) => p.pipelineStage && p.pipelineStage !== "pelunasan"),
    [notif],
  );
  const kontrakJalan = jalan.reduce((a, p) => a + (p.contractValue ?? barisKeu.get(p.id)?.contractValue ?? 0), 0);

  const daftarProyek = useMemo(() => {
    type Baris = { p?: Proyek; r?: FinanceOverviewRow; id: string; judul: string };
    const semua: Baris[] = [];
    const lewat = new Set<string>();
    for (const p of notif?.proyek ?? []) {
      semua.push({ p, r: barisKeu.get(p.id), id: p.id, judul: p.title });
      lewat.add(p.id);
    }
    for (const r of keu?.proyek ?? []) if (!lewat.has(r.projectId)) semua.push({ r, id: r.projectId, judul: r.projectTitle });
    const laba = (x: Baris) => x.r?.labaBersih ?? 0;
    if (urutProyek === "jalan") {
      /* Tahap paling jauh di atas: yang hampir selesai yang paling dekat
         dengan uang pelunasan. */
      return semua
        .filter((x) => x.p?.pipelineStage && x.p.pipelineStage !== "pelunasan")
        .sort((a, b) => URUT_TAHAP.indexOf(b.p!.pipelineStage!) - URUT_TAHAP.indexOf(a.p!.pipelineStage!));
    }
    const ada = semua.filter((x) => x.r);
    if (urutProyek === "rugi") return ada.sort((a, b) => laba(a) - laba(b));
    if (urutProyek === "piutang") return ada.sort((a, b) => (b.r!.belumDiterima ?? 0) - (a.r!.belumDiterima ?? 0));
    return ada.sort((a, b) => laba(b) - laba(a));
  }, [notif, keu, barisKeu, urutProyek]);

  /* Di urutan "Sedang berjalan" lencananya TAHAP proyek. Di urutan uang
     lencananya keadaan kas — dan "Rugi" hanya untuk proyek yang SUDAH lunas:
     laba di panel ini dihitung dari kas yang benar-benar masuk, jadi proyek
     yang baru DP selalu tampak minus, dan menandainya rugi membunyikan
     alarm palsu di hampir setiap proyek yang sedang berjalan. */
  const lencanaProyek = (r: FinanceOverviewRow | undefined, tahap?: string): { teks: string; nada: NadaLencana } => {
    if (tahap && TAHAP_PROYEK[tahap]) return { teks: TAHAP_PROYEK[tahap]!, nada: "netral" };
    if (!r) return { teks: "—", nada: "netral" };
    const lunas = (r.contractValue ?? 0) > 0 && (r.belumDiterima ?? 0) <= 0;
    if (lunas) return r.labaBersih < 0 ? { teks: "Rugi", nada: "gagal" } : { teks: "Lunas", nada: "selesai" };
    if (r.received <= 0) return { teks: "Belum DP", nada: "menunggu" };
    return { teks: "Berjalan", nada: "menunggu" };
  };

  /* ---- Perlu ditangani ------------------------------------------------------- */

  const butir = useMemo(() => {
    const semua = [...(notif?.notifikasi ?? [])];
    /* Terbaru di atas. Yang tidak bertanggal di paling bawah. */
    semua.sort((a, b) => (b.tanggal ? waktuKe(b.tanggal) : 0) - (a.tanggal ? waktuKe(a.tanggal) : 0));
    return semua.slice(0, 20).map((n) => ({ n, kepala: n.tanggal ? kepalaHari(n.tanggal) : "Tanpa tanggal" }));
  }, [notif]);

  /* Keping keadaan di bawah sapaan — yang nol tidak ditampilkan, kecuali
     jumlah proyek berjalan (nol proyek pun keadaan yang perlu terbaca). */
  const hitung = (awalan: string) => (notif?.notifikasi ?? []).filter((n) => n.id.startsWith(awalan)).length;
  const keping = notif
    ? [
        { n: jalan.length, teks: "proyek berjalan", href: "/admin/proyek", nada: "hijau", tetap: true },
        { n: hitung("pesan-"), teks: "pesan baru", href: "/admin/pesan", nada: "merah" },
        { n: hitung("tugas-"), teks: "tenggat lewat", href: "/admin/list-kerjaan", nada: "amber" },
        { n: hitung("testimoni-"), teks: "testimoni menunggu", href: "/admin/testimoni", nada: "amber" },
      ].filter((k) => k.n > 0 || k.tetap)
    : [];

  const pTarget = target ? persenTarget(target) : null;

  /* ---- Halaman -------------------------------------------------------------- */

  return (
    <div className="dsb">
      {/* ---- Sorotan --------------------------------------------------------- */}
      <section className="dsb__sorot" aria-label="Ringkasan hari ini">
        <div className="dsb__sapa">
          <p className="dsb__studio">{nama ?? " "}</p>
          <h2 className="dsb__salam">{sapaan}.</h2>
          <ul className="dsb__keping" aria-label="Keadaan studio">
            {keping.map((k) => (
              <li key={k.teks}>
                <a className={`dsb__kep dsb__kep--${k.nada}`} href={k.href}>
                  <b>{k.n}</b> {k.teks}
                </a>
              </li>
            ))}
            {notif && notif.notifikasi.length === 0 && (
              <li className="dsb__kepberes">
                <Ikon ikon={CheckCircle} ukuran={14} /> Tidak ada yang menunggu
              </li>
            )}
          </ul>
          <nav className="dsb__aksi" aria-label="Aksi cepat">
            {AKSI.map((a) => (
              <a
                key={a.href}
                href={a.href}
                className={`k-tombol k-tombol--small k-tombol--ikonkiri ${a.utama ? "k-tombol--primary" : "k-tombol--secondary"} dsb__aksib`}
              >
                <Ikon ikon={a.ikon} ukuran={14} className="k-tombol__ikonkiri" />
                {a.label}
              </a>
            ))}
          </nav>
        </div>

        <a className="dsb__target" href="/admin/keuangan/kas">
          <div className="dsb__cincin">
            <Cincin
              luar={56}
              lubang={45}
              iris={[
                {
                  persen: Math.min(100, pTarget ?? 0),
                  warna: "var(--dsb-cincin)",
                  label: "Tercapai",
                  ket: target ? formatRupiah(target.tercapai) : "—",
                },
              ]}
            />
            <span className="dsb__cincintengah" aria-hidden="true">
              {pTarget === null ? "—" : `${Math.round(pTarget)}%`}
            </span>
          </div>
          <div className="dsb__targetteks">
            <span className="dsb__eyebrow">Target {target ? labelSemester(target.semesterStart) : "semester"}</span>
            <b className="dsb__targetnilai" title={target ? formatRupiah(target.tercapai) : undefined}>
              {target ? formatRupiahRingkas(target.tercapai) : "—"}
            </b>
            <span className="dsb__targetdari">dari {target?.target ? formatRupiahRingkas(target.target) : "—"}</span>
            <span className="dsb__targetsisa">{target ? kalimatSisa(target) : "Memuat…"}</span>
          </div>
        </a>

        <div className="dsb__kpis">
          <span className="dsb__eyebrow">{namaBulan} ini</span>
          <BarisKpi
            ikon={CoinIn}
            label="Kas masuk"
            nilai={formatRupiahRingkas(kasKini)}
            penuh={formatRupiah(kasKini)}
            tren={tren(tKas)}
            grafik={kilau(enam?.kas, Boolean(tKas && !tKas.naik))}
            href="/admin/keuangan/transaksi"
          />
          <BarisKpi
            ikon={CoinOut}
            label="Beban"
            nilai={formatRupiahRingkas(bebanKini)}
            penuh={formatRupiah(bebanKini)}
            /* Beban yang naik bukan kabar baik — arah dan penilaian dipisah. */
            tren={tren(tBeban, tBeban ? !tBeban.naik : undefined)}
            grafik={kilau(enam?.beban, Boolean(tBeban?.naik))}
            href="/admin/keuangan/keluar"
          />
          <BarisKpi
            ikon={Wallet}
            label="Laba bersih"
            nilai={formatRupiahRingkas(labaKini)}
            penuh={formatRupiah(labaKini)}
            tren={tren(tLaba)}
            grafik={kilau(enam?.laba, Boolean(tLaba && !tLaba.naik))}
            href="/admin/keuangan"
          />
        </div>
      </section>

      {/* ---- Baris kerja ----------------------------------------------------- */}
      <div className="dsb__kerja">
        <article className="dsb__kartu dsb__arus">
          <KepalaSeksi
            judul={mode === "arus" ? "Arus Kas" : "Komposisi"}
            kanan={
              <>
                <Segmen
                  judul="Tampilan"
                  className="dsb__mode"
                  nilai={mode}
                  onPilih={(v) => setMode(v as "arus" | "komposisi")}
                  segmen={[
                    { nilai: "arus", label: "Arus" },
                    { nilai: "komposisi", label: "Komposisi" },
                  ]}
                />
                {mode === "arus" ? (
                  <PilihTombol judul="Rentang arus kas" nilai={rentangArus} opsi={RENTANG_ARUS} onUbah={setRentangArus} />
                ) : (
                  <PilihTombol judul="Rentang komposisi" nilai={rentangStat} opsi={RENTANG_STAT} onUbah={setRentangStat} />
                )}
              </>
            }
          />
          {mode === "arus" ? (
            <>
              <div className="dsb__arusinfo">
                <div>
                  <p className="dsb__totalket">Kas bersih {rentangArus === "tahun" ? "tahun ini" : "12 bulan terakhir"}</p>
                  <p className={`dsb__totalnilai${kasBersih < 0 ? " dsb__minus" : ""}`}>
                    {bulanan ? formatRupiah(kasBersih) : "—"}
                  </p>
                </div>
                <ul className="dsb__legenda">
                  <li>
                    <span className="dsb__kotak dsb__kotak--tua" />
                    Kas masuk
                  </li>
                  <li>
                    <span className="dsb__kotak dsb__kotak--mint" />
                    Beban
                  </li>
                </ul>
              </div>
              <div className="dsb__grafik" style={{ "--dsb-plot-h": `${tinggiPlot}px` } as React.CSSProperties}>
                <LabelYGrafik
                  tinggi={tinggiPlot}
                  nilai={[singkat(maks), singkat(maks / 2), "0", singkat(-maks / 2), singkat(-maks)]}
                />
                <div className="dsb__plot" ref={plot} onPointerLeave={() => setSorot(null)}>
                  {deret.map((b, i) => {
                    const nyala = i === sorot && !b.depan;
                    const atas = 50 - (b.kasMasuk / maks) * 50;
                    const bawah = 50 + (b.biaya / maks) * 50;
                    const bln = BULAN[Number(b.kunci.slice(5, 7)) - 1];
                    return (
                      <div
                        key={b.kunci}
                        className={`dsb__kolom${nyala ? " is-sorot" : ""}`}
                        tabIndex={b.depan ? -1 : 0}
                        aria-label={
                          b.depan
                            ? `${bln} ${b.kunci.slice(0, 4)}: belum berjalan`
                            : `${bln} ${b.kunci.slice(0, 4)}: kas masuk ${formatRupiah(b.kasMasuk)}, beban ${formatRupiah(b.biaya)}`
                        }
                        onPointerEnter={() => !b.depan && setSorot(i)}
                        onFocus={() => !b.depan && setSorot(i)}
                      >
                        <KolomGrafik
                          tinggi={tinggiPlot}
                          lebarBatang={lebarBatang}
                          tumpuk
                          label={BULAN_PENDEK[Number(b.kunci.slice(5, 7)) - 1]}
                          batang={[
                            ...(b.kasMasuk > 0 ? [{ atas, bawah: 50, nada: "tua" as const, radiusAtas: 5 }] : []),
                            ...(b.biaya > 0 ? [{ atas: 50, bawah, nada: "mint" as const, radiusBawah: 5 }] : []),
                          ]}
                        />
                      </div>
                    );
                  })}
                  {bSorot && sorot !== null && !bSorot.depan && (
                    <div
                      className={`dsb__tip${sorot <= 1 ? " dsb__tip--kiri" : sorot >= deret.length - 2 ? " dsb__tip--kanan" : ""}`}
                      style={
                        {
                          "--tip-f": (sorot + 0.5) / deret.length,
                          "--tip-p": Math.min(50, 50 - (bSorot.kasMasuk / maks) * 50) / 100,
                        } as React.CSSProperties
                      }
                      aria-hidden="true"
                    >
                      <p className="dsb__tipjudul">
                        {BULAN[Number(bSorot.kunci.slice(5, 7)) - 1]} {bSorot.kunci.slice(0, 4)}
                      </p>
                      <p className="dsb__tipbaris">
                        <span>Kas masuk</span>
                        <b>{formatRupiahRingkas(bSorot.kasMasuk)}</b>
                      </p>
                      <p className="dsb__tipbaris">
                        <span>Beban</span>
                        <b>{formatRupiahRingkas(bSorot.biaya)}</b>
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="dsb__komposisi">
              <div className="dsb__tab" role="tablist" aria-label="Pilih rincian">
                <button
                  type="button"
                  role="tab"
                  aria-selected={tabStat === "masuk"}
                  className="dsb__tabb"
                  onClick={() => setTabStat("masuk")}
                >
                  Kas masuk <small>{formatRupiahRingkas(totalMasuk)}</small>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={tabStat === "beban"}
                  className="dsb__tabb"
                  onClick={() => setTabStat("beban")}
                >
                  Beban <small>{formatRupiahRingkas(totalBeban)}</small>
                </button>
              </div>
              <div className="dsb__komposisiisi">
                <div className="dsb__donat">
                  {totalAktif > 0 ? (
                    <Donat
                      label={tabStat === "masuk" ? "Total kas masuk" : "Total beban"}
                      nilai={formatRupiahRingkas(totalAktif)}
                      /* Tangga hijau ke abu berurut besaran — irisan terbesar
                         paling gelap. */
                      iris={irisAktif.map((s, i) => ({ nilai: s.nilai, warna: `var(--ramp-${i + 1})`, label: s.label, ket: formatRupiah(s.nilai) }))}
                    />
                  ) : (
                    <p className="dsb__kosong">
                      {(tabStat === "masuk" ? bayar : biaya) === null
                        ? "Memuat…"
                        : tabStat === "masuk"
                          ? "Belum ada kas masuk pada rentang ini."
                          : "Belum ada beban pada rentang ini."}
                    </p>
                  )}
                </div>
                <div className="dsb__rincian">
                  {irisAktif.map((s, i) => (
                    <BarisBeban
                      key={s.kunci}
                      warna={`var(--ramp-${i + 1})`}
                      tinta={`var(--ramp-${i + 1}-ink)`}
                      persen={`${Math.round((s.nilai / (totalAktif || 1)) * 100)}%`}
                      kategori={s.label}
                      nominal={<span title={formatRupiah(s.nilai)}>{formatRupiahRingkas(s.nilai)}</span>}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </article>

        <article className="dsb__kartu dsb__proyek">
          <KepalaSeksi
            judul="Proyek"
            kanan={
              <>
                <PilihTombol judul="Urutan proyek" nilai={urutProyek} opsi={URUT_PROYEK} onUbah={setUrutProyek} />
                <a className="dsb__tambah" href="/admin/proyek/baru" title="Proyek baru">
                  <Ikon ikon={Plus} ukuran={14} />
                </a>
              </>
            }
          />
          <dl className="dsb__ringkasproyek">
            <div>
              <dt>Kontrak berjalan</dt>
              <dd title={notif ? formatRupiah(kontrakJalan) : undefined}>{notif ? formatRupiahRingkas(kontrakJalan) : "—"}</dd>
            </div>
            <div>
              <dt>Piutang</dt>
              <dd title={keu ? formatRupiah(keu.piutang) : undefined}>{keu ? formatRupiahRingkas(keu.piutang) : "—"}</dd>
            </div>
            <div>
              <dt>Kas masuk</dt>
              <dd title={keu ? formatRupiah(keu.kasMasuk) : undefined}>{keu ? formatRupiahRingkas(keu.kasMasuk) : "—"}</dd>
            </div>
          </dl>
          <ul className="dsb__pdaftar">
            {daftarProyek.map(({ p, r, id, judul }) => {
              const nilai = p?.contractValue ?? r?.contractValue ?? 0;
              const masuk = r?.received ?? p?.paidTotal ?? 0;
              const pct = nilai > 0 ? Math.min(100, (masuk / nilai) * 100) : 0;
              const st = lencanaProyek(r, urutProyek === "jalan" ? p?.pipelineStage : undefined);
              const tautan = (
                <a className="dsb__tautan dsb__pnama" href={`/admin/proyek/satu?id=${encodeURIComponent(id)}`}>
                  {judul}
                </a>
              );
              return (
                <li key={id} className="dsb__pbaris">
                  <span className="dsb__pubin">
                    <Ikon ikon={(p && IKON_KATEGORI[p.category]) ?? Ruler} ukuran={16} />
                  </span>
                  <div className="dsb__pisi">
                    <div className="dsb__patas">
                      {/* Kursor yang DIAM di nama proyek memunculkan ringkasan
                          kas — "sudah dibayar berapa?" tanpa meninggalkan
                          Dashboard. */}
                      {r ? (
                        <KartuMelayang pemicu={tautan}>
                          <RingkasProyek r={r} />
                        </KartuMelayang>
                      ) : (
                        tautan
                      )}
                      <Lencana nada={st.nada}>{st.teks}</Lencana>
                    </div>
                    <BarKemajuan bentuk="tumpuk" persen={pct} tinggi={6} judul={`Pembayaran ${judul}`} />
                    <p className="dsb__pkaki">
                      <span>
                        <b title={formatRupiah(masuk)}>{formatRupiahRingkas(masuk)}</b>{" "}
                        <i>dari {nilai ? formatRupiahRingkas(nilai) : "—"}</i>
                      </span>
                      {r && (
                        <span className={r.labaBersih < 0 ? "dsb__plaba dsb__minus" : "dsb__plaba"} title={formatRupiah(r.labaBersih)}>
                          laba {formatRupiahRingkas(r.labaBersih)}
                        </span>
                      )}
                    </p>
                  </div>
                </li>
              );
            })}
            {notif && daftarProyek.length === 0 && (
              <li className="dsb__kosong">
                {urutProyek === "jalan" ? "Belum ada proyek yang sedang berjalan." : "Belum ada proyek yang punya angka."}
              </li>
            )}
          </ul>
        </article>

        <article className="dsb__kartu dsb__aktivitas">
          <KepalaSeksi
            judul="Perlu Ditangani"
            kanan={
              <a className="dsb__lihat" href="/admin/notifikasi">
                Semua
              </a>
            }
          />
          <div className="dsb__log">
            {notif && butir.length === 0 && (
              <p className="dsb__beres">
                <Ikon ikon={CheckCircle} ukuran={16} />
                Tidak ada yang menunggu. Semua sudah ditangani.
              </p>
            )}
            {butir.map(({ n, kepala }, i) => {
              const baru = i === 0 || butir[i - 1]!.kepala !== kepala;
              const akhir = i === butir.length - 1 || butir[i + 1]!.kepala !== kepala;
              return (
                <div key={n.id} className={baru && i > 0 ? "dsb__logbaru" : undefined}>
                  {baru && <p className="dsb__loghari">{kepala}</p>}
                  <a className="dsb__logbutir" href={n.ke}>
                    <BarisLog ikon={ikonButir(n)} ikonPx={16} waktu={waktuButir(n)} akhir={akhir}>
                      <b>{n.judul}:</b> {n.detail}
                    </BarisLog>
                  </a>
                </div>
              );
            })}
          </div>
        </article>
      </div>
    </div>
  );
}

export function DashboardKit() {
  return (
    <RequireAuth skeleton={<div className="dsb dsb--rangka" />}>
      <Isi />
    </RequireAuth>
  );
}

/* Isi kartu melayang di daftar proyek: kontrak, kas masuk dan kemajuannya,
   biaya, laba. Angka penuh — daftarnya memakai angka ringkas. */
function RingkasProyek({ r }: { r: FinanceOverviewRow }) {
  const persen = r.contractValue ? Math.round((r.received / r.contractValue) * 100) : 0;
  return (
    <div className="dsb-melayang">
      <b className="dsb-melayang__judul">{r.projectTitle}</b>
      {r.contractValue ? (
        <>
          <BarKemajuan persen={persen} judul={`Diterima ${persen}% dari kontrak`} />
          <p className="dsb-melayang__ket">
            Diterima <b>{formatRupiah(r.received)}</b> dari {formatRupiah(r.contractValue)} ({persen}%)
          </p>
        </>
      ) : (
        <p className="dsb-melayang__ket">Belum berkontrak.</p>
      )}
      <dl className="dsb-melayang__dl">
        <dt>Biaya</dt>
        <dd>{formatRupiah(r.costsTotal)}</dd>
        <dt>Laba bersih</dt>
        <dd>{formatRupiah(r.labaBersih)}</dd>
      </dl>
    </div>
  );
}
