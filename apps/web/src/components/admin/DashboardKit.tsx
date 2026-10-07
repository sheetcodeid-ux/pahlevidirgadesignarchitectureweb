import { KartuMelayang } from "../kit/Overlay";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { RequireAuth } from "./RequireAuth";
import { RingkasTarget, useKemajuanTarget } from "./targetKit";
import { KepalaSeksi, BarisLog, BarisBeban } from "../kit/Item";
import { KartuStatistik, Tren } from "../kit/Kartu";
import { Kilau } from "../kit/Grafik";
import { KolomGrafik, LabelYGrafik } from "../kit/Grafik";
import { BarKemajuan, Donat } from "../kit/Ukuran";
import { Tabel, SelDua, useUrutTabel, type KolomTabel } from "../kit/Tabel";
import { TombolIkon } from "../kit/Tombol";
import { KelompokTab } from "../kit/Segmen";
import { Lencana, type NadaLencana } from "../kit/Lencana";
import { Ikon, type DataIkon } from "../kit/Ikon";
import { PilihTombol, PilihTeks } from "./frame25";
import {
  CheckCircle,
  Clock,
  X,
  CoinIn,
  CoinOut,
  DotsThreeVertical,
  NavReceipt,
  Plus,
  Ruler,
  Sliders,
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
  profilTersimpan,
  bacaCache,
  tulisCache,
  type FinanceOverview,
  type FinanceOverviewRow,
  type BarisBulanan,
  type BiayaProyek,
  type Pembayaran,
  type Profil,
} from "../../lib/admin";
import { ambilNotifikasi, type IsiNotifikasi, type BarisNotifikasi } from "../../lib/notifikasi";
import { kepalaHari, waktuButir, ikonButir } from "./linimasaNotif";
import { formatRupiah } from "../../lib/format";
import { Hitung, geraknya } from "./hitung";

/* =============================================================================
   Dashboard — frame Figma "01. Dashboard (v1)" (node 3:1069), di kerangka kit.

   Pengganti DashboardHome, yang dulu meniru frame yang sama di dalam kerangka
   LAMA (AdminLayout) dengan komponennya sendiri. Yang ini dirakit dari
   pustaka kit seperti tiga belas halaman lainnya.

   TATA LETAKNYA milik frame, ISINYA milik studio — keputusan yang sama
   dengan frame 04 (RingkasanKit). Pemetaan slotnya:

     Coinest                    Halaman ini
     ------------------------   -----------------------------------------------
     Widget Card (kartu debit)  kas masuk studio, proyek berjalan, piutang
     Button Group               Tagihan / Terima / Biaya / Riwayat — empat
                                pekerjaan uang yang paling sering dimulai
     Daily Limit                laba bersih terhadap kas yang masuk
     Saving Plans               proyek berjalan: termin diterima / kontrak
     Card Statistic x3          kas masuk, beban, laba bersih BULAN INI,
                                lencananya selisih terhadap bulan lalu
     Cashflow                   kas masuk ke atas, beban ke bawah, 12 bulan
     Recent Transactions        laba per proyek — rekap yang sengaja
                                ditinggalkan RingkasanKit di sini, karena
                                "Transaksi Terbaru" sudah ada di Keuangan
     Statistic                  rincian kas masuk (per proyek) dan beban
                                (per kategori) pada rentang terpilih
     Recent Activity            yang belum ditangani — daftar yang SAMA
                                dengan lonceng, dari lib/notifikasi.ts

   Ukuran kerangkanya, dari metadata framenya: badan 1192 dibagi tiga kolom
   283 / 586 / 283 dengan celah 20, dan ketiganya berakhir di y968:

     kiri    kartu kas 174 · aksi 72 · laba 107 · proyek 475
     tengah  statistik 174 · arus kas 321 · tabel 353
     kanan   statistik 460 · aktivitas 408
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

/* Ubin kartu proyek: di Coinest ikon tujuan tabungan (rumah, pesawat), di
   sini ikon jenis proyek — pustaka ikon "Special" Coinest sendiri, bukan
   gambaran baru. Jenis yang tidak dikenal jatuh ke penggaris, ikon Proyek di
   rel samping. */
const IKON_KATEGORI: Record<string, DataIkon> = {
  residential: SpecialHouseLine,
  commercial: SpecialWarehouse,
  coffeeshop: SpecialPintGlass,
  interior: SpecialArmchair,
  landscape: SpecialLeaf,
  masterplan: SpecialPath,
  renovation: SpecialWrench,
};

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

/** Selisih terhadap bulan lalu, ejaan framenya: "+ 1,78 %". Null kalau
 *  bulan lalu nol — pembagian dengan nol melahirkan "+Infinity %". */
function selisih(kini: number, lalu: number): { naik: boolean; teks: string } | null {
  if (!lalu) return null;
  const p = ((kini - lalu) / Math.abs(lalu)) * 100;
  return { naik: p >= 0, teks: `${p >= 0 ? "+" : "−"} ${Math.abs(p).toFixed(2).replace(".", ",")} %` };
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

const URUT_LABA = [
  { nilai: "laba", label: "Laba terbesar" },
  { nilai: "rugi", label: "Laba terkecil" },
  { nilai: "piutang", label: "Piutang terbesar" },
];

/* --- Kartu kas (slot "Widget Card") ------------------------------------------ */

/* Lambang di pojok kiri kartu. Di Coinest lambang aplikasinya dalam mint;
   di sini lambang STUDIO — huruf D yang sama dengan favicon, digambar
   sebagai garis — dalam warna yang sama. Bukan gambaran ikon baru. */
function TandaStudio() {
  return (
    <svg className="dsb__kastanda" width="23" height="23" viewBox="14 14 36 36" fill="none" aria-hidden="true">
      <path
        d="M21 17 V47 M21 17 H28 A15 15 0 0 1 28 47 H21"
        stroke="currentColor"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function KartuKas({
  nama,
  profil,
  keu,
  jumlahJalan,
  hidup,
}: {
  nama: string | null;
  profil: Profil | null;
  keu: FinanceOverview | null;
  jumlahJalan: number | null;
  hidup: boolean;
}) {
  /* Satu-satunya benda yang "disentuh" di halaman ini: kartu kas MIRING
     mengikuti tetikus (±7°) dan bayangannya bergeser ke arah sebaliknya,
     seperti kartu yang diangkat dari meja. Tetikus saja (jebakan #9), diam
     bila gerak dikurangi. Sudutnya ditulis ke variabel CSS lewat ref, bukan
     state — tidak ada render ulang per gerakan. Kotaknya dibaca sekali saat
     kursor masuk. */
  const ref = useRef<HTMLElement>(null);
  const kotak = useRef<DOMRect | null>(null);
  const miring = (rx: number, ry: number) => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty("--kas-rx", `${rx.toFixed(2)}deg`);
    el.style.setProperty("--kas-ry", `${ry.toFixed(2)}deg`);
  };
  const masuk = keu?.kasMasuk ?? 0;
  const piutang = keu?.piutang ?? 0;
  const pctMasuk = masuk + piutang > 0 ? (masuk / (masuk + piutang)) * 100 : 0;
  return (
    <article
      ref={ref}
      className="dsb__kas"
      aria-label="Kas studio"
      onPointerEnter={(e) => {
        if (e.pointerType !== "mouse" || !geraknya()) return;
        kotak.current = e.currentTarget.getBoundingClientRect();
        e.currentTarget.classList.add("is-angkat");
      }}
      onPointerMove={(e) => {
        const k = kotak.current;
        if (e.pointerType !== "mouse" || !k) return;
        const fx = (e.clientX - k.left) / k.width - 0.5;
        const fy = (e.clientY - k.top) / k.height - 0.5;
        miring(-fy * 14, fx * 14);
      }}
      onPointerLeave={(e) => {
        kotak.current = null;
        e.currentTarget.classList.remove("is-angkat");
        miring(0, 0);
      }}
    >
      <div className="dsb__kasatas">
        <TandaStudio />
        {/* Slot "Union" (lambang nirkontak) di framenya. Dengan dua akun
            penulis, yang lebih berguna di sudut ini adalah akun mana yang
            sedang dipakai — kepala kit tidak menuliskannya di mana pun. */}
        <span className="dsb__kasperan">{profil?.isMasterAdmin ? "Master admin" : profil ? "Staf" : ""}</span>
      </div>
      <p className="dsb__kasnama">{nama ?? "—"}</p>
      <div className="dsb__kaskaki">
        <div className="dsb__kasblok">
          <p className="dsb__kasket">
            <i className="dsb__kastitik" aria-hidden="true" />
            Kas masuk
          </p>
          <p className="dsb__kasnilai">
            {keu ? <Hitung nilai={keu.kasMasuk} hidup={hidup} format={formatRupiah} /> : "—"}
          </p>
        </div>
        <div className="dsb__kaskanan">
          <div className="dsb__kasblok">
            <p className="dsb__kasket">Proyek</p>
            <p className="dsb__kasisi">{jumlahJalan ?? "—"}</p>
          </div>
          <div className="dsb__kasblok">
            <p className="dsb__kasket">
              <i className="dsb__kastitik dsb__kastitik--piutang" aria-hidden="true" />
              Piutang
            </p>
            <p className="dsb__kasisi">
              {keu ? formatRupiah(keu.piutang) : "—"}
            </p>
          </div>
        </div>
      </div>
      {/* Meteran: dari seluruh tagihan yang sudah diterbitkan dan lunas,
          bagian yang sudah jadi uang. */}
      {keu && masuk + piutang > 0 && (
        <div className="dsb__kasmeter" role="img" aria-label={`${pctMasuk.toFixed(0)}% tagihan sudah masuk`}>
          <i style={{ width: `${pctMasuk}%` }} />
          <span>{Math.round(pctMasuk)}% tagihan sudah masuk</span>
        </div>
      )}
    </article>
  );
}

/* --- Isi halaman ------------------------------------------------------------- */

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

function Isi() {
  const [nama, setNama] = useState<string | null>(
    () => bacaCache<{ studioName?: string }>("settings")?.studioName ?? null,
  );
  const [profil, setProfil] = useState<Profil | null>(null);
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

  const [rentangArus, setRentangArus] = useState("12");
  const [rentangStat, setRentangStat] = useState("1");
  const [tabStat, setTabStat] = useState<"masuk" | "beban">("beban");
  const [urutLaba, setUrutLaba] = useState("laba");
  const [sorot, setSorot] = useState<number | null>(null);
  /* Bulan yang sedang DIBACA: diklik di Arus Kas, dibaca ketiga kartu
     statistik. Null = bulan berjalan. */
  const [pilih, setPilih] = useState<string | null>(null);
  const [hidup, setHidup] = useState(false);
  const lengkap = keu !== null && bulanan !== null;
  useEffect(() => {
    if (!lengkap || hidup) return;
    let b2 = 0;
    const b1 = requestAnimationFrame(() => (b2 = requestAnimationFrame(() => setHidup(true))));
    return () => {
      cancelAnimationFrame(b1);
      cancelAnimationFrame(b2);
    };
  }, [lengkap, hidup]);

  useEffect(() => {
    setProfil(profilTersimpan());
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
  const kunciBaca = pilih ?? kunciBulan(0);
  const geserBulan = (k: string, n: number) => {
    const d = new Date(Number(k.slice(0, 4)), Number(k.slice(5, 7)) - 1 - n, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  };
  const namaBaca = pilih ? `${BULAN[Number(pilih.slice(5, 7)) - 1]}` : "bulan ini";
  const bulanIni = perBulan.get(kunciBaca);
  const bulanLalu = perBulan.get(geserBulan(kunciBaca, 1));
  const kasKini = bulanIni?.kasMasuk ?? 0;
  const bebanKini = bulanIni?.biaya ?? 0;
  const labaKini = bulanIni?.labaBersih ?? kasKini - bebanKini;
  const tKas = selisih(kasKini, bulanLalu?.kasMasuk ?? 0);
  const tBeban = selisih(bebanKini, bulanLalu?.biaya ?? 0);
  const tLaba = selisih(labaKini, bulanLalu?.labaBersih ?? 0);

  /* Enam bulan terakhir untuk garis mungil di kartu statistik — dari data
     arus kas yang sudah dimuat halaman ini, tanpa permintaan baru. Kosong
     sampai datanya tiba: garis datar nol akan terbaca sebagai "tidak ada
     uang", bukan "belum dimuat". */
  const enam = useMemo(() => {
    if (!bulanan) return null;
    const b = Array.from({ length: 6 }, (_, i) => perBulan.get(geserBulan(kunciBaca, 5 - i)));
    return {
      kas: b.map((x) => x?.kasMasuk ?? 0),
      beban: b.map((x) => x?.biaya ?? 0),
      laba: b.map((x) => x?.labaBersih ?? (x ? x.kasMasuk - x.biaya : 0)),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bulanan, perBulan, kunciBaca]);
  const kilau = (titik: number[] | undefined, buruk: boolean) =>
    titik ? (
      <Kilau
        titik={titik}
        turun={buruk}
        lebar={76}
        tinggi={34}
        tandaAkhir
        keterangan={(i) => {
          const k = geserBulan(kunciBaca, 5 - i);
          return { judul: `${BULAN_PENDEK[Number(k.slice(5, 7)) - 1]} ${k.slice(0, 4)}`, nilai: formatRupiah(titik[i] ?? 0) };
        }}
      />
    ) : undefined;

  /* Dua belas kolom di kedua rentang. "Tahun ini" = Januari sampai Desember
     tahun berjalan, persis framenya ("This Year", Jan..Dec) — bulan yang
     belum datang tetap punya kolomnya, cuma tanpa batang. */
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

  /* Sumbu dihitung dari DATA, tidak simetris. Permintaan pemilik: batang
     harus panjang, "ambil dari nilai terendah". Dulu sumbunya ±maks yang
     dibulatkan ke pangkat sepuluh berikutnya — kas tertinggi 110 jt jadi
     sumbu ±200 jt, dan batangnya cuma seperempat bidang plot. Sekarang:
     - langkah tick dibulatkan ke 1/2/2,5/3/4/5 × 10^k, kira-kira seperlima
       rentang (tertinggi kas masuk + tertinggi beban);
     - bagian atas cuma setinggi kas masuk tertinggi (dibulatkan ke atas ke
       satu langkah), bagian bawah setinggi beban tertinggi — jadi garis nol
       duduk sesuai datanya, bukan selalu di tengah;
     - nol tetap nol: batang tidak pernah dimulai dari angka selain nol,
       karena batang yang dipotong melebih-lebihkan selisih. */
  const sumbu = useMemo(() => {
    const atasMaks = Math.max(0, ...deret.map((b) => b.kasMasuk));
    const bawahMaks = Math.max(0, ...deret.map((b) => b.biaya));
    const kasar = Math.max(1, (atasMaks + bawahMaks) / 5);
    const p = 10 ** Math.floor(Math.log10(kasar));
    const f = kasar / p;
    /* 3 dan 4 ikut sebagai langkah: dengan 1/2/2,5/5 saja, kas 110 jt +
       beban 60 jt melompat ke langkah 50 dan sumbu 150 jt; dengan 4 sumbunya
       120 jt dan batang tertingginya 88% bagian atas. */
    const langkah = ([1, 2, 2.5, 3, 4, 5, 10].find((c) => f <= c) ?? 10) * p;
    const nAtas = Math.max(1, Math.ceil(atasMaks / langkah));
    const nBawah = bawahMaks > 0 ? Math.ceil(bawahMaks / langkah) : 0;
    const n = nAtas + nBawah;
    const total = n * langkah;
    return {
      n,
      total,
      /** Letak garis nol, persen dari atas bidang plot. */
      nol: (nAtas / n) * 100,
      label: Array.from({ length: n + 1 }, (_, i) => (nAtas - i) * langkah),
    };
  }, [deret]);

  const kasBersih = deret.reduce((a, b) => a + b.kasMasuk - b.biaya, 0);
  /* Garis LABA BERSIH per bulan di atas batang: titik di tengah kolom, pada
     skala sumbu yang sama. Persen bidang plot (x dari lebar kolom-kolom,
     y dari atas). */
  const garisLaba = deret.map((b, i) => ({
    i,
    x: ((i + 0.5) / deret.length) * 100,
    y: sumbu.nol - ((b.kasMasuk - b.biaya) / sumbu.total) * 100,
    laba: b.kasMasuk - b.biaya,
    depan: b.depan,
  }));
  const titikGaris = garisLaba.filter((t) => !t.depan);
  /* Garisnya DIGAMBAR ulang saat rentang berganti — tidak saat dimuat. */
  const rentangAwal = useRef(rentangArus);
  const gambarUlang = hidup && rentangAwal.current !== rentangArus;
  /* Kartu keterangan cuma muncul saat sebuah kolom disentuh atau difokus —
     bukan menyala sejak awal seperti di framenya. Framenya menaruhnya di
     Juni, di tengah grafik; di sini kolom yang wajar dinyalakan adalah
     bulan INI, yang selalu di ujung kanan, dan di sana kartunya menutupi
     legenda. Angka bulan ini sudah dibawa tiga kartu statistik di atasnya. */
  const iSorot = sorot;
  const iPilih = pilih ? deret.findIndex((b) => b.kunci === pilih) : -1;
  const bSorot = iSorot !== null ? deret[iSorot] : undefined;

  /* Lebar batang = 60% kolomnya, persis framenya (Bar Chart inset 20% kiri
     dan kanan). Kolomnya lentur, jadi lebar bidang plotnya diukur —
     ResizeObserver mengirim ukuran SESUDAH tata letak, jadi ia tidak
     memaksa layout apa pun. Nilai awalnya lebar bidang pada 1440. */
  const plot = useRef<HTMLDivElement>(null);
  const [lebarPlot, setLebarPlot] = useState(515);
  useEffect(() => {
    const el = plot.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => e && setLebarPlot(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const lebarBatang = Math.max(4, (lebarPlot / 12) * 0.6);

  /* ---- Proyek berjalan ------------------------------------------------------ */

  const barisKeu = useMemo(
    () => new Map((keu?.proyek ?? []).map((r) => [r.projectId, r])),
    [keu],
  );
  /* "Berjalan" = belum sampai pelunasan. Definisi yang sama dengan penghitung
     proyek di lib/notifikasi.ts — dua angka yang mengaku menghitung hal yang
     sama tapi berbeda isinya membuat panel tidak dipercaya. */
  const jalan = useMemo(
    () => (notif?.proyek ?? []).filter((p) => p.pipelineStage && p.pipelineStage !== "pelunasan"),
    [notif],
  );
  const kontrakJalan = jalan.reduce(
    (a, p) => a + (p.contractValue ?? barisKeu.get(p.id)?.contractValue ?? 0),
    0,
  );

  /* ---- Tabel laba per proyek ------------------------------------------------ */

  const barisLaba = useMemo(() => {
    const semua = [...(keu?.proyek ?? [])];
    if (urutLaba === "rugi") semua.sort((a, b) => a.labaBersih - b.labaBersih);
    else if (urutLaba === "piutang") semua.sort((a, b) => (b.belumDiterima ?? 0) - (a.belumDiterima ?? 0));
    else semua.sort((a, b) => b.labaBersih - a.labaBersih);
    return semua.slice(0, 5);
  }, [keu, urutLaba]);

  /* Lebar kolom dari framenya: judul kolom 146 / 68 / 48 / 130 / 62 dengan
     pad 10 di kiri-kanan tiap sel — jadi 166 / 88 / 68 / 150 / 82, tepat
     554 kotak-dalam kartu 586. */
  const kolom: KolomTabel[] = [
    /* Angka penuh (Rp170.000.000) tidak muat di 68 milik frame — lebarnya
       digeser dari Proyek dan Status, jumlahnya tetap 554 (jebakan #63). */
    { judul: "Proyek", lebar: 150, urut: true },
    { judul: "Laba Bersih", lebar: 92, urut: true },
    { judul: "Diterima", lebar: 84, urut: true },
    { judul: "Catatan", lebar: 150, urut: true, redup: true },
    { judul: "Status", lebar: 78, urut: true },
  ];

  const statusLaba = (r: FinanceOverviewRow): { teks: string; nada: NadaLencana } => {
    const lunas = (r.contractValue ?? 0) > 0 && (r.belumDiterima ?? 0) <= 0;
    /* "Rugi" hanya untuk proyek yang SUDAH lunas. Laba di panel ini dihitung
       dari kas yang benar-benar masuk, jadi proyek yang baru DP selalu
       tampak minus — menandainya rugi akan membunyikan alarm palsu di
       hampir setiap proyek yang sedang berjalan. */
    if (lunas) return r.labaBersih < 0 ? { teks: "Rugi", nada: "gagal" } : { teks: "Lunas", nada: "selesai" };
    if (r.received <= 0) return { teks: "Belum DP", nada: "menunggu" };
    return { teks: "Berjalan", nada: "menunggu" };
  };

  /* Klik judul kolom mengurutkan kelima baris yang tampil; pemilih
     "Laba terbesar/terkecil/Piutang" tetap memilih LIMA yang mana. */
  const laba = useUrutTabel(barisLaba, [
    (r) => r.projectTitle,
    (r) => r.labaBersih,
    (r) => r.received,
    (r) => r.belumDiterima ?? null,
    (r) => statusLaba(r).teks,
  ]);
  const baris = laba.terurut.map((r) => {
    const st = statusLaba(r);
    const marjin = r.received > 0 ? `marjin ${Math.round((r.labaBersih / r.received) * 100)}%` : "belum ada kas";
    const sisa = r.belumDiterima ?? null;
    const catatan =
      r.contractValue == null
        ? "belum berkontrak"
        : sisa && sisa > 0
          ? `sisa ${formatRupiah(sisa)} belum diterima`
          : "kontrak sudah lunas";
    return [
      <SelDua
        atas={
          /* Nama proyek = tautan ke Satu Proyek, dan kursor yang DIAM di
             atasnya memunculkan ringkasan kas — menjawab "proyek ini sudah
             dibayar berapa?" tanpa meninggalkan Dashboard. */
          <KartuMelayang
            pemicu={
              <a className="dsb__tautan" href={`/admin/proyek/satu?id=${encodeURIComponent(r.projectId)}`}>
                {r.projectTitle}
              </a>
            }
          >
            <RingkasProyek r={r} />
          </KartuMelayang>
        }
        bawah={`kontrak ${r.contractValue ? formatRupiah(r.contractValue) : "—"}`}
      />,
      <span>
        <SelDua atas={formatRupiah(r.labaBersih)} bawah={marjin} />
      </span>,
      <span className="dsb__nominal">
        {formatRupiah(r.received)}
        {r.contractValue ? (
          <i className="dsb__terima" aria-hidden="true">
            <i style={{ width: `${Math.min(100, (r.received / r.contractValue) * 100)}%` }} />
          </i>
        ) : null}
      </span>,
      <span className="dsb__catatan">
        Biaya {formatRupiah(r.costsTotal)}, {catatan}
      </span>,
      <Lencana nada={st.nada}>{st.teks}</Lencana>,
    ];
  });

  /* ---- Statistik (donat) ---------------------------------------------------- */

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

  /* ---- Linimasa "Perlu Ditangani" ------------------------------------------- */

  const butir = useMemo(() => {
    const semua = [...(notif?.notifikasi ?? [])];
    /* Terbaru di atas, seperti framenya ("Today" lalu "Yesterday"). Yang
       tidak bertanggal di paling bawah. */
    semua.sort((a, b) => (b.tanggal ? waktuKe(b.tanggal) : 0) - (a.tanggal ? waktuKe(a.tanggal) : 0));
    return semua.slice(0, 8).map((n) => ({ n, kepala: n.tanggal ? kepalaHari(n.tanggal) : "Tanpa tanggal" }));
  }, [notif]);

  /* Jumlah butir dibatasi RUANG, bukan angka tetap: kalimatnya boleh
     terlipat dua baris (framenya juga), jadi tinggi tiap butir baru
     diketahui setelah tergambar. Semua dirender dulu, yang melewati dasar
     kartu dipangkas sebelum paint (useLayoutEffect) — tanpa itu butir
     terakhir terpotong di tepi kartu. Pembacaan geometrinya sekali per
     perubahan data atau ukuran, bukan di handler gulir (jebakan #21). */
  const wadahLog = useRef<HTMLDivElement>(null);
  const SEMUA = 99;
  const [muat, setMuat] = useState(SEMUA);
  useLayoutEffect(() => setMuat(SEMUA), [butir]);
  useLayoutEffect(() => {
    const w = wadahLog.current;
    if (!w || muat !== SEMUA) return;
    const batas = w.clientHeight;
    let k = 0;
    for (const el of w.querySelectorAll<HTMLElement>("[data-butir]")) {
      if (el.offsetTop + el.offsetHeight > batas + 0.5) break;
      k++;
    }
    setMuat(k);
  }, [muat, butir]);
  useEffect(() => {
    const w = wadahLog.current;
    if (!w) return;
    let lebar = w.clientWidth;
    let tinggi = w.clientHeight;
    const ro = new ResizeObserver(([e]) => {
      if (!e) return;
      const { width, height } = e.contentRect;
      if (Math.abs(width - lebar) < 0.5 && Math.abs(height - tinggi) < 0.5) return;
      lebar = width;
      tinggi = height;
      setMuat(SEMUA);
    });
    ro.observe(w);
    return () => ro.disconnect();
  }, []);
  const tampak = butir.slice(0, muat);

  /* ---- Halaman -------------------------------------------------------------- */

  /* 18x18, bukan 24 milik TombolIkon xsmall: "Button Icon" di frame ini
     cuma ikonnya sendiri tanpa ruang di sekelilingnya (lihat .dsb__titik). */
  const titikTiga = (href: string, judul: string) => (
    <TombolIkon
      ikon={DotsThreeVertical}
      jenis="transparent"
      ukuran="xsmall"
      ikonPx={18}
      judul={judul}
      href={href}
      className="dsb__titik"
    />
  );

  return (
    <div className="dsb">
      {/* ---- Kolom kiri ------------------------------------------------------ */}
      <div className="dsb__kol dsb__kol--kiri">
        <KartuKas nama={nama} profil={profil} keu={keu} jumlahJalan={notif ? jalan.length : null} hidup={hidup} />

        <KelompokTab
          judul="Aksi cepat"
          className="dsb__aksi"
          tab={[
            { nilai: "tagihan", label: "Tagihan", ikon: NavReceipt, href: "/admin/keuangan/tagihan" },
            { nilai: "terima", label: "Terima", ikon: CoinIn, href: "/admin/keuangan/terima" },
            { nilai: "biaya", label: "Biaya", ikon: CoinOut, href: "/admin/keuangan/keluar" },
            { nilai: "riwayat", label: "Riwayat", ikon: Clock, href: "/admin/keuangan/transaksi" },
          ]}
        />

        {/* Slot "Daily Limit": target pemasukan semester — "TARGET 1 MILIAR
            DALAM 6 BULAN" di sheet KELUAR MASUK pemilik. Dulu laba bersih
            kumulatif; angka itu tetap ada di Keuangan → Ringkasan, sementara
            target tidak punya tempat lain yang terlihat setiap buka panel. */}
        <article className="dsb__kartu dsb__laba">
          <KepalaSeksi judul="Target Semester" kanan={titikTiga("/admin/keuangan/kas", "Buka Kas Studio")} />
          <RingkasTarget k={target} />
        </article>

        {/* Slot "Saving Plans": target = nilai kontrak, capaian = termin
            yang sudah diterima. Bentuk angkanya sama persis. */}
        <article className="dsb__kartu dsb__proyek">
          <KepalaSeksi
            judul="Proyek Berjalan"
            kanan={
              <a className="dsb__tambah" href="/admin/proyek/baru">
                <Ikon ikon={Plus} ukuran={12} />
                Proyek Baru
              </a>
            }
          />
          <div className="dsb__total">
            <p className="dsb__totalket">Nilai kontrak berjalan</p>
            <p className="dsb__totalnilai">{notif ? formatRupiah(kontrakJalan) : "—"}</p>
          </div>
          <ul className="dsb__pdaftar">
            {jalan.slice(0, 3).map((p) => {
              const r = barisKeu.get(p.id);
              const nilai = p.contractValue ?? r?.contractValue ?? 0;
              const masuk = r?.received ?? p.paidTotal ?? 0;
              const pct = nilai > 0 ? Math.min(100, (masuk / nilai) * 100) : 0;
              return (
                <li key={p.id} className="dsb__pkartu">
                  <div className="dsb__pkepala">
                    <span className="dsb__pjudul">
                      <span className="dsb__pubin">
                        <Ikon ikon={IKON_KATEGORI[p.category] ?? Ruler} ukuran={16} />
                      </span>
                      <span className="dsb__pnama">{p.title}</span>
                    </span>
                    {titikTiga(`/admin/proyek/satu?id=${p.id}`, `Buka ${p.title}`)}
                  </div>
                  <BarKemajuan bentuk="tumpuk" persen={pct} tinggi={8} judul={`Pembayaran ${p.title}`} />
                  <p className="dsb__pkaki">
                    <span>
                      <b>{formatRupiah(masuk)}</b>{" "}
                      <i>{nilai > 0 ? `${pct.toFixed(pct % 1 ? 1 : 0).replace(".", ",")}%` : "—"}</i>
                    </span>
                    <span>
                      <i>Kontrak</i> <b>{nilai ? formatRupiah(nilai) : "belum ada"}</b>
                    </span>
                  </p>
                </li>
              );
            })}
            {notif && jalan.length === 0 && <li className="dsb__kosong">Belum ada proyek yang sedang berjalan.</li>}
          </ul>
        </article>
      </div>

      {/* ---- Kolom tengah ---------------------------------------------------- */}
      <div className="dsb__kol dsb__kol--tengah">
        <div className="dsb__stat">
          <KartuStatistik
            ikon={CoinIn}
            judul={`Kas masuk ${namaBaca}`}
            grafik={kilau(enam?.kas, Boolean(tKas && !tKas.naik))}
            nilai={<Hitung nilai={kasKini} hidup={hidup} format={formatRupiah} />}
            tren={tKas ? <Tren naik={tKas.naik}>{tKas.teks}</Tren> : <span className="k-tren dsb__trenkosong" />}
            menuHref="/admin/keuangan/transaksi"
            menuJudul="Lihat uang masuk di Semua Transaksi"
          />
          <KartuStatistik
            ikon={CoinOut}
            judul={`Beban ${namaBaca}`}
            grafik={kilau(enam?.beban, Boolean(tBeban?.naik))}
            nilai={<Hitung nilai={bebanKini} hidup={hidup} format={formatRupiah} />}
            /* Beban yang naik bukan kabar baik — arah dan penilaian dipisah. */
            tren={
              tBeban ? (
                <Tren naik={tBeban.naik} baik={!tBeban.naik}>
                  {tBeban.teks}
                </Tren>
              ) : (
                <span className="k-tren dsb__trenkosong" />
              )
            }
            menuHref="/admin/keuangan/keluar"
            menuJudul="Catat pengeluaran"
          />
          <KartuStatistik
            ikon={Wallet}
            judul={`Laba bersih ${namaBaca}`}
            grafik={kilau(enam?.laba, Boolean(tLaba && !tLaba.naik))}
            nilai={<Hitung nilai={labaKini} hidup={hidup} format={formatRupiah} className={labaKini < 0 ? "dsb__minus" : undefined} />}
            tren={tLaba ? <Tren naik={tLaba.naik}>{tLaba.teks}</Tren> : <span className="k-tren dsb__trenkosong" />}
            menuHref="/admin/keuangan"
            menuJudul="Buka ringkasan Keuangan"
          />
        </div>

        <article className="dsb__kartu dsb__arus">
          <KepalaSeksi
            judul="Arus Kas"
            kanan={
              <>
                {pilih && (
                  <button type="button" className="dsb__baca" onClick={() => setPilih(null)} title="Kembali ke bulan ini">
                    Membaca {BULAN_PENDEK[Number(pilih.slice(5, 7)) - 1]} {pilih.slice(0, 4)}
                    <Ikon ikon={X} ukuran={12} />
                  </button>
                )}
                <PilihTombol judul="Rentang arus kas" nilai={rentangArus} opsi={RENTANG_ARUS} onUbah={setRentangArus} />
              </>
            }
          />
          <div className="dsb__arusinfo">
            <div>
              <p className="dsb__totalket">
                Kas bersih {rentangArus === "tahun" ? "tahun ini" : "12 bulan terakhir"}
              </p>
              <p className={`dsb__totalnilai${kasBersih < 0 ? " dsb__minus" : ""}`}>
                {bulanan ? <Hitung nilai={kasBersih} hidup={hidup} format={formatRupiah} /> : "—"}
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
              <li>
                <span className="dsb__kotak dsb__kotak--garis" />
                Laba bersih
              </li>
            </ul>
          </div>
          <div className="dsb__grafik">
            <LabelYGrafik tinggi={140} nilai={sumbu.label.map((v) => (v === 0 ? "0" : singkat(v)))} />
            <div
              className="dsb__plot"
              ref={plot}
              onPointerLeave={() => setSorot(null)}
              /* Garis kisi bidang plot (menjulur melewati kolom pertama dan
                 terakhir) mengikuti jumlah tick sumbu; garis nol lebih tegas. */
              style={{
                background: sumbu.label
                  .map((v, i) => {
                    const w = v === 0 ? "var(--border-strong)" : "var(--border)";
                    return `linear-gradient(${w}, ${w}) 0 calc(var(--dsb-plot-h) * ${i / sumbu.n}) / 100% 1px no-repeat`;
                  })
                  .join(", "),
              }}
            >
              {deret.map((b, i) => {
                const nyala = i === iSorot && !b.depan;
                const atas = sumbu.nol - (b.kasMasuk / sumbu.total) * 100;
                const bawah = sumbu.nol + (b.biaya / sumbu.total) * 100;
                const bln = BULAN[Number(b.kunci.slice(5, 7)) - 1];
                return (
                  <div
                    key={b.kunci}
                    className={`dsb__kolom${nyala ? " is-sorot" : ""}${i === iPilih ? " is-pilih" : ""}`}
                    tabIndex={b.depan ? -1 : 0}
                    role="button"
                    aria-pressed={i === iPilih}
                    onClick={() => !b.depan && setPilih((l) => (l === b.kunci || b.kunci === kunciBulan(0) ? null : b.kunci))}
                    onKeyDown={(e) => {
                      if ((e.key === "Enter" || e.key === " ") && !b.depan) {
                        e.preventDefault();
                        setPilih((l) => (l === b.kunci || b.kunci === kunciBulan(0) ? null : b.kunci));
                      }
                    }}
                    aria-label={
                      b.depan
                        ? `${bln} ${b.kunci.slice(0, 4)}: belum berjalan`
                        : `${bln} ${b.kunci.slice(0, 4)}: kas masuk ${formatRupiah(b.kasMasuk)}, beban ${formatRupiah(b.biaya)}`
                    }
                    onPointerEnter={() => !b.depan && setSorot(i)}
                    onFocus={() => !b.depan && setSorot(i)}
                  >
                    <KolomGrafik
                      tinggi={140}
                      garis={sumbu.n}
                      lebarBatang={lebarBatang}
                      tumpuk
                      label={BULAN_PENDEK[Number(b.kunci.slice(5, 7)) - 1]}
                      batang={[
                        ...(b.kasMasuk > 0 ? [{ atas, bawah: sumbu.nol, nada: "tua" as const, radiusAtas: 4 }] : []),
                        ...(b.biaya > 0 ? [{ atas: sumbu.nol, bawah, nada: "mint" as const, radiusBawah: 4 }] : []),
                      ]}
                    />
                  </div>
                );
              })}
              {bulanan && titikGaris.length > 1 && (
                <div className="dsb__labagaris" aria-hidden="true">
                  <svg viewBox="0 0 100 100" preserveAspectRatio="none" key={rentangArus}>
                    <polyline className="dsb__labagaris-alas" points={titikGaris.map((t) => `${t.x},${t.y}`).join(" ")} />
                    <polyline
                      className={`dsb__labagaris-garis${gambarUlang ? " is-gambar" : ""}`}
                      points={titikGaris.map((t) => `${t.x},${t.y}`).join(" ")}
                      pathLength={1}
                    />
                  </svg>
                  {titikGaris.map((t, j) => (
                    <i
                      key={j}
                      className={`dsb__labatitik${t.laba < 0 ? " is-rugi" : ""}${t.i === iPilih ? " is-pilih" : ""}`}
                      style={{ left: `${t.x}%`, top: `${t.y}%` }}
                    />
                  ))}
                </div>
              )}
              {bSorot && iSorot !== null && !bSorot.depan && (
                <div
                  className={`dsb__tip${iSorot === 0 ? " dsb__tip--kiri" : iSorot === deret.length - 1 ? " dsb__tip--kanan" : ""}`}
                  style={
                    {
                      "--tip-f": (iSorot + 0.5) / deret.length,
                      /* Pecahan tinggi plot, bukan piksel: tinggi plotnya --dsb-plot-h,
                         yang mengecil di layar satu-layar. */
                      "--tip-p": (sumbu.nol - (bSorot.kasMasuk / sumbu.total) * 100) / 100,
                    } as React.CSSProperties
                  }
                  aria-hidden="true"
                >
                  <p className="dsb__tipjudul">
                    {BULAN[Number(bSorot.kunci.slice(5, 7)) - 1]} {bSorot.kunci.slice(0, 4)}
                  </p>
                  <p className="dsb__tipbaris">
                    <span>Kas masuk</span>
                    <b>{formatRupiah(bSorot.kasMasuk)}</b>
                  </p>
                  <p className="dsb__tipbaris">
                    <span>Beban</span>
                    <b>{formatRupiah(bSorot.biaya)}</b>
                  </p>
                  <p className="dsb__tipbaris">
                    <span>Laba bersih</span>
                    <b className={bSorot.kasMasuk - bSorot.biaya < 0 ? "dsb__minus" : undefined}>{formatRupiah(bSorot.kasMasuk - bSorot.biaya)}</b>
                  </p>
                </div>
              )}
            </div>
          </div>
        </article>

        <article className="dsb__kartu dsb__tabel">
          <KepalaSeksi
            judul="Laba per Proyek"
            kanan={
              <>
                <PilihTombol judul="Urutan tabel laba" nilai={urutLaba} opsi={URUT_LABA} onUbah={setUrutLaba} />
                <TombolIkon ikon={Sliders} jenis="ghost" judul="Rincian lengkap di Keuangan" href="/admin/keuangan" />
              </>
            }
          />
          {baris.length > 0 ? (
            <div className="dsb__tabelisi">
              <Tabel
                kolom={kolom}
                baris={baris}
                urutan={laba.urutan}
                onUrut={laba.onUrut}
                kepala="mint"
                pad={10}
                tinggiKepala={33}
                tinggiBaris={48}
                fontBaris={10}
              />
            </div>
          ) : (
            <p className="dsb__kosong">{keu === null ? "Memuat angka proyek…" : "Belum ada proyek yang punya angka."}</p>
          )}
        </article>
      </div>

      {/* ---- Kolom kanan ----------------------------------------------------- */}
      <div className="dsb__kol dsb__kol--kanan">
        <article className="dsb__kartu dsb__statistik">
          <KepalaSeksi
            judul="Statistik"
            kanan={<PilihTeks judul="Rentang statistik" nilai={rentangStat} opsi={RENTANG_STAT} onUbah={setRentangStat} className="dsb__pilihteks" />}
          />
          <div className="dsb__tab" role="tablist" aria-label="Pilih rincian">
            <button
              type="button"
              role="tab"
              aria-selected={tabStat === "masuk"}
              className="dsb__tabb"
              onClick={() => setTabStat("masuk")}
            >
              <span>Kas masuk</span> <small>{formatRupiah(totalMasuk)}</small>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tabStat === "beban"}
              className="dsb__tabb"
              onClick={() => setTabStat("beban")}
            >
              <span>Beban</span> <small>{formatRupiah(totalBeban)}</small>
            </button>
          </div>
          <div className="dsb__donat">
            {totalAktif > 0 ? (
              <Donat
                label={tabStat === "masuk" ? "Total kas masuk" : "Total beban"}
                nilai={formatRupiah(totalAktif)}
                /* Tangga hijau ke abu berurut besaran — irisan terbesar
                   paling gelap, persis framenya. */
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
                nominal={<span>{formatRupiah(s.nilai)}</span>}
              />
            ))}
          </div>
        </article>

        <article className="dsb__kartu dsb__aktivitas">
          <KepalaSeksi judul="Perlu Ditangani" kanan={titikTiga("/admin/notifikasi", "Buka semua pemberitahuan")} />
          <div className="dsb__log" ref={wadahLog}>
            {notif && butir.length === 0 && (
              <p className="dsb__beres">
                <Ikon ikon={CheckCircle} ukuran={16} />
                Tidak ada yang menunggu. Semua sudah ditangani.
              </p>
            )}
            {tampak.map(({ n, kepala }, i) => {
              const baru = i === 0 || tampak[i - 1]!.kepala !== kepala;
              const akhir = i === tampak.length - 1 || tampak[i + 1]!.kepala !== kepala;
              return (
                <div key={n.id} className={baru && i > 0 ? "dsb__logbaru" : undefined}>
                  {baru && <p className="dsb__loghari">{kepala}</p>}
                  <a className="dsb__logbutir" href={n.ke} data-butir="">
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

/* Isi kartu melayang di tabel laba: kontrak, kas masuk dan kemajuannya,
   biaya, laba. Angka penuh — tabelnya sudah memakai angka ringkas. */
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
