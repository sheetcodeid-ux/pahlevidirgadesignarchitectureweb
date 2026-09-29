import { useEffect, useMemo, useState } from "react";
import { RequireAuth } from "./RequireAuth";
import { KepalaSeksi, BarisLog } from "../kit/Item";
import { KartuStatistikRingkas } from "../kit/Kartu";
import { GrafikArea, BarKemajuan, Cincin, LencanaTren } from "../kit/Ukuran";
import { Tabel, SelDua, type KolomTabel } from "../kit/Tabel";
import { Tombol, TombolIkon } from "../kit/Tombol";
import { Lencana } from "../kit/Lencana";
import { Ikon } from "../kit/Ikon";
import {
  CoinIn,
  CoinOut,
  CurrencyCircleDollar,
  Hourglass,
  HourglassHigh,
  CaretDown,
  DotsThree,
  NavCalendarDots,
  NavReceipt,
  Ruler,
  Sliders,
} from "../kit/ikon";
import {
  ambilRingkasanKeuangan,
  ambilBulanan,
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
} from "../../lib/admin";
import { proyekAktif, onProyekAktif } from "../../lib/proyekAktif";
import { formatRupiah, formatRupiahRingkas } from "../../lib/format";

/* =============================================================================
   Keuangan — Ringkasan, mengikuti frame Figma "04. Dashboard (v2)".

   TATA LETAKNYA milik frame; ISINYA milik studio ini. Coinest adalah aplikasi
   keuangan pribadi, jadi empat dari delapan widget-nya tidak punya padanan di
   sini. Yang dipilih pemilik: tata letak 100% frame, slotnya diisi hal
   terdekat dari data yang memang ada — bukan dikosongkan, bukan diisi angka
   karangan.

   Pemetaannya, dan itu keputusan yang perlu diketahui siapa pun yang membaca
   berkas ini nanti:

     Coinest                   Halaman ini
     -----------------------   ----------------------------------------------
     Income / Expense /        Kas masuk / Beban operasional / Laba bersih /
     Savings / Investment      Piutang — empat kartu 284x87 yang sama
     Cashflow                  Analisis arus kas: kas masuk lawan beban
     Expense Breakdown         Rincian beban per kategori
     Finance Score             Marjin rata-rata — satu persentase berbar
     Balance                   Piutang: total, lalu dua proyek terbesar
     Recent Transactions       Transaksi terbaru — uang masuk DAN keluar
     Saving Plans              Proyek berjalan — termin diterima / kontrak
     Recent Activities         Tenggat tagihan yang sudah terbit

   Riwayat dua slot terakhir, karena keduanya sempat diisi lain:

   - Recent Transactions dulu berisi REKAP PER PROYEK — lima kolom angka.
     Sebabnya dulu API pembayaran baru ada per proyek, dan daftar biaya
     sudah dipakai slot di sebelahnya. Endpoint lintas proyek
     (`/admin/payments`) sudah ada sejak halaman Semua Transaksi, jadi slot
     ini sekarang berisi yang digambar framenya: satu daftar bertanda +/-,
     berlencana arah, dengan proyek di kolom "Account". Rekap laba per
     proyek tetap ada di Dashboard.
   - Recent Activities dulu berisi biaya terbaru. Begitu slot transaksi
     memuat biaya juga, dua widget bersebelahan menampilkan baris yang
     sama. Yang masuk sekarang pertanyaan yang TIDAK dijawab widget lain:
     tagihan mana yang sedang ditunggu, dan kapan tenggatnya.

   Ukuran kolomnya, dari framenya: 586 / 283 / 283 dengan celah 20, total
   1192 — sama dengan lebar kolom konten.
   ============================================================================= */

const BULAN_PENDEK = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

/* #1E4841, #BBF49C, #BCBEBD — terukur dari "Chart_2" di frame 04.

   Yang keempat TIDAK ada di framenya, dan tangga `--ramp-1..5` tidak bisa
   menyediakannya: `--ramp-3` (#ECF4E9) persis warna jalur cincinnya sendiri
   dan `--ramp-4` (#E5E6E6) beda 7/14/3 per kanal darinya — cincin yang
   memakai keduanya tergambar seolah kosong. Jadi yang keempat dicampur dari
   brand, yang jatuh di antara #1E4841 dan mintnya dan tetap satu keluarga.

   `--keu-tua`/`--keu-abu`, bukan `--brand`/`--ramp-5` langsung: di tema
   gelap `--brand` jadi mint (irisan pertama dan kedua tak bisa dibedakan)
   dan `--ramp-5` nyaris sewarna latar kartu. Keduanya didefinisikan di
   keuangan-kit.css. */
const WARNA_CINCIN = [
  "var(--keu-tua)",
  "var(--brand-mint)",
  "var(--keu-abu)",
  "color-mix(in srgb, var(--keu-tua) 45%, var(--brand-mint))",
];

const KATEGORI: Record<string, string> = {
  freelancer: "Freelancer",
  operasional: "Operasional",
  prinsipal: "Prinsipal",
  lainnya: "Lainnya",
};

/** Rupiah dipendekkan untuk sumbu grafik: 12.500.000 -> "12,5 jt". */
function singkat(n: number): string {
  if (Math.abs(n) >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1).replace(".", ",")} M`;
  if (Math.abs(n) >= 1_000_000) return `${Math.round(n / 1_000_000)} jt`;
  if (Math.abs(n) >= 1_000) return `${Math.round(n / 1_000)} rb`;
  return String(n);
}

/** "2026-10-03" -> "Hari ini" / "Besok" / "3 Okt" — untuk tenggat, yang
 *  arahnya ke depan. Yang sudah lewat tidak sampai ke sini: ia punya
 *  kepala sendiri, "Lewat tenggat". */
function hariTenggat(sisa: number, iso: string): string {
  if (sisa === 0) return "Hari ini";
  if (sisa === 1) return "Besok";
  const [, b, h] = iso.slice(0, 10).split("-").map(Number);
  return `${h} ${BULAN_PENDEK[(b ?? 1) - 1]}`;
}

/** Hari tersisa sampai tenggat; negatif berarti sudah lewat. Dihitung
 *  dalam UTC dari tanggal kalendernya, sama dengan halaman Tagihan &
 *  Termin — kalau keduanya menghitung beda, satu tagihan bisa "lewat" di
 *  satu halaman dan "hari ini" di halaman lain. */
function sisaHari(iso: string): number | null {
  const [t, b, h] = iso.slice(0, 10).split("-").map(Number);
  if (!t || !b || !h) return null;
  const kini = new Date();
  const hariIni = Date.UTC(kini.getFullYear(), kini.getMonth(), kini.getDate());
  return Math.round((Date.UTC(t, b - 1, h) - hariIni) / 86_400_000);
}

const LABEL_JENIS: Record<string, string> = { dp: "DP", termin: "Termin", pelunasan: "Pelunasan" };
const LABEL_METODE: Record<string, string> = {
  tunai: "Tunai",
  transfer: "Transfer",
  qris: "QRIS",
  lainnya: "Lainnya",
};

const RENTANG = [
  { nilai: "1", label: "Bulan ini" },
  { nilai: "3", label: "3 bulan" },
  { nilai: "12", label: "12 bulan" },
  { nilai: "0", label: "Semua" },
];

/** Batas bawah rentang (awal bulan ke-n ke belakang), atau null untuk semua. */
function batasRentang(bulan: number): number | null {
  if (bulan <= 0) return null;
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  d.setMonth(d.getMonth() - (bulan - 1));
  return d.getTime();
}

/** `paid_at` timestamptz ATAU `incurred_on` date -> milidetik. Tanggal
 *  telanjang dianggap akhir harinya, supaya biaya hari ini tidak kalah
 *  urutan dari pembayaran pagi tadi. */
function waktuKe(iso: string, akhirHari = true): number {
  return new Date(iso.length === 10 ? iso + (akhirHari ? "T23:59:59" : "T00:00:00") : iso).getTime();
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

function persenAman(atas: number, bawah: number): number {
  if (!bawah) return 0;
  return Math.max(0, Math.min(100, (atas / bawah) * 100));
}

function Isi() {
  const [proyekId, setProyekId] = useState<string | null>(() => proyekAktif());
  const [rentang, setRentang] = useState(12);

  const kunci = `keuangan:${proyekId ?? "semua"}`;
  const kunciBulan = `keuangan-bulan:${proyekId ?? "semua"}`;

  const [ringkas, setRingkas] = useState<FinanceOverview | null>(() =>
    bacaCache<FinanceOverview>(kunci),
  );
  const [bulanan, setBulanan] = useState<BarisBulanan[] | null>(() =>
    bacaCache<BarisBulanan[]>(kunciBulan),
  );
  const [biaya, setBiaya] = useState<BiayaProyek[] | null>(() =>
    bacaCache<BiayaProyek[]>("biaya-semua"),
  );
  const [bayar, setBayar] = useState<Pembayaran[] | null>(() =>
    bacaCache<Pembayaran[]>("bayar-semua"),
  );
  const [tagihan, setTagihan] = useState<Invoice[] | null>(() =>
    bacaCache<Invoice[]>("tagihan-semua"),
  );
  const [rentangTrx, setRentangTrx] = useState("1");

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

  const deret = useMemo(() => (bulanan ?? []).slice(-rentang), [bulanan, rentang]);

  /* Dua deret untuk grafik arus kas, urutan seperti framenya: yang mint di
     ATAS (kas masuk) dan yang gelap di bawah (beban). Di Coinest juga begitu
     — Income mint, Expense hijau tua. */
  const deretArea = useMemo(
    () => [
      { titik: deret.map((b) => b.kasMasuk), nada: "kedua" as const },
      { titik: deret.map((b) => b.biaya) },
    ],
    [deret],
  );

  const labelX = useMemo(
    () => deret.map((b) => BULAN_PENDEK[Number(b.bulan.slice(5, 7)) - 1]),
    [deret],
  );

  const maks = useMemo(() => {
    const semua = deret.flatMap((b) => [b.kasMasuk, b.biaya]);
    const t = Math.max(1, ...semua);
    /* Dibulatkan ke atas ke kelipatan yang enak dibaca, supaya label sumbu-Y
       tidak jadi angka ganjil seperti "13.748.211". */
    const pangkat = 10 ** Math.floor(Math.log10(t));
    return Math.ceil(t / pangkat) * pangkat;
  }, [deret]);

  const bulanIni = deret[deret.length - 1];
  const bulanLalu = deret[deret.length - 2];

  function tren(kini?: number, lalu?: number) {
    if (kini === undefined || lalu === undefined || !lalu) return null;
    const p = ((kini - lalu) / Math.abs(lalu)) * 100;
    return { naik: p >= 0, teks: `${Math.abs(p).toFixed(1).replace(".", ",")} %` };
  }

  const tKas = tren(bulanIni?.kasMasuk, bulanLalu?.kasMasuk);
  const tBeban = tren(bulanIni?.biaya, bulanLalu?.biaya);
  const tLaba = tren(bulanIni?.labaBersih, bulanLalu?.labaBersih);

  /* Irisan donat rincian beban. Kategori bernilai nol dibuang: irisan setebal
     nol derajat tidak tergambar, tapi ia tetap memakan satu baris legenda dan
     satu warna dari tangga. */
  const iris = useMemo(() => {
    const k = (ringkas?.bebanKategori ?? []).filter((b) => b.nilai > 0);
    const total = k.reduce((a, b) => a + b.nilai, 0) || 1;
    return k.map((b, i) => ({
      nilai: b.nilai,
      persen: (b.nilai / total) * 100,
      label: KATEGORI[b.kategori] ?? b.kategori,
      /* Warna cincinnya diambil dari framenya apa adanya: gelap, mint, abu —
         bukan tangga `--ramp-1..5` yang dipakai donat di frame Investments.
         Yang kelima dan seterusnya jatuh ke tangga itu. */
      warna: WARNA_CINCIN[i] ?? `var(--ramp-${Math.min(5, i + 1)})`,
    }));
  }, [ringkas]);

  /* Dua proyek dengan piutang terbesar — slot "Balance" di framenya, yang di
     sana berisi dua kartu kredit. Yang setara di sini bukan rekening,
     melainkan uang yang sudah dijanjikan tapi belum masuk. */
  const piutangTeratas = useMemo(
    () =>
      (ringkas?.proyek ?? [])
        .filter((p) => (p.belumDiterima ?? 0) > 0)
        .sort((a, b) => (b.belumDiterima ?? 0) - (a.belumDiterima ?? 0))
        .slice(0, 2),
    [ringkas],
  );

  /* Slot "Saving Plans": proyek berjalan, kemajuannya termin yang sudah
     diterima terhadap nilai kontrak. Bentuknya persis sama dengan yang di
     framenya — target, capaian, persen — cuma artinya berbeda. */
  const proyekBerjalan = useMemo(
    () =>
      (ringkas?.proyek ?? [])
        .filter((p) => (p.contractValue ?? 0) > 0 && p.received < (p.contractValue ?? 0))
        .sort((a, b) => (b.contractValue ?? 0) - (a.contractValue ?? 0))
        .slice(0, 3),
    [ringkas],
  );

  /* Slot "Recent Transactions": lima transaksi terbaru, uang masuk DAN
     keluar dalam satu daftar — persis yang digambar framenya (+$200.00 di
     atas -$154.20). Pola penggabungannya sama dengan halaman Semua
     Transaksi; yang ini cuma memotongnya jadi lima. */
  const transaksi = useMemo<Transaksi[]>(() => {
    const batas = batasRentang(Number(rentangTrx));
    const cocok = (projectId: string, waktu: string) =>
      (!proyekId || projectId === proyekId) && (batas === null || waktuKe(waktu, false) >= batas);
    const masuk = (bayar ?? [])
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
    const keluar = (biaya ?? [])
      .filter((k) => cocok(k.projectId, k.incurredOn))
      .map<Transaksi>((k) => ({
        kunci: `b:${k.id}`,
        masuk: false,
        nama: k.label,
        sub: KATEGORI[k.category] ?? k.category,
        proyek: k.projectTitle ?? "—",
        waktu: k.incurredOn,
        nominal: k.amount,
      }));
    return [...masuk, ...keluar].sort((x, y) => waktuKe(y.waktu) - waktuKe(x.waktu)).slice(0, 5);
  }, [bayar, biaya, proyekId, rentangTrx]);

  /* Slot "Recent Activities": tagihan yang sudah TERBIT dan belum lunas,
     urut tenggat. Yang lewat tenggat dikumpulkan di bawah satu kepala di
     paling atas — itu yang paling perlu ditagih.

     Jumlah butirnya dibatasi RUANG, bukan angka tetap. Framenya memuat lima
     butir di bawah DUA kepala hari; tiap kepala tambahan memakan 42px (57
     jarak antarkelompok lawan 15 jarak antarbutir), dan kartunya tidak
     punya sisa. Jadi anggarannya 5 x 45 + 1 x 42 = 267: lima butir dengan
     dua kepala muat, empat butir dengan tiga kepala muat, empat dengan
     empat tidak. Tanpa batas ini butir terakhir terpotong di tepi kartu. */
  const tenggat = useMemo(() => {
    const semua = (tagihan ?? [])
      .filter((t) => t.status === "terbit" && t.dueDate && (!proyekId || t.projectId === proyekId))
      .map((t) => ({ t, sisa: sisaHari(t.dueDate!) }))
      .filter((x): x is { t: Invoice; sisa: number } => x.sisa !== null)
      .sort((x, y) => x.sisa - y.sisa);
    const hasil: { kunci: string; kepala: string; atas: string; teks: string; lewat: boolean }[] = [];
    let pakai = 0;
    for (const { t, sisa } of semua) {
      const kepala = sisa < 0 ? "Lewat tenggat" : hariTenggat(sisa, t.dueDate!);
      const baru = hasil.length > 0 && hasil[hasil.length - 1]!.kepala !== kepala;
      const ongkos = 45 + (baru ? 42 : 0);
      if (hasil.length >= 5 || pakai + ongkos > 267) break;
      pakai += ongkos;
      hasil.push({
        kunci: t.id,
        kepala,
        atas: sisa < 0 ? `lewat ${-sisa} hari · ${formatRupiah(t.amount)}` : formatRupiah(t.amount),
        /* Proyeknya DULU, labelnya sesudahnya: di kolom 223 kalimatnya
           terpotong elipsis, dan "Termin 2 — gambar kerja — Kedai Ko…"
           menyisakan bagian yang sama di kelima butir sementara nama
           proyeknya — satu-satunya yang membedakan — yang hilang. */
        teks: `${t.projectTitle ?? "—"} · ${t.label}`,
        lewat: sisa < 0,
      });
    }
    return hasil;
  }, [tagihan, proyekId]);

  /* Lebar kolom dari jangkar tinta framenya (kartu 586, kotak-dalam
     16..570): judul kolom mulai di x22 / 142 / 335 / 429 / 502, dan pad sel
     6. Jumlahnya 554, persis kotak-dalamnya. */
  const kolom: KolomTabel[] = [
    { judul: "Transaksi", lebar: 120, urut: true },
    { judul: "Proyek", lebar: 193, urut: true },
    { judul: "Tanggal", lebar: 94, urut: true },
    { judul: "Nominal", lebar: 73, urut: true },
    { judul: "Status", lebar: 74, urut: true },
  ];

  const baris = transaksi.map((t) => {
    const d = new Date(t.waktu.length === 10 ? t.waktu + "T00:00:00" : t.waktu);
    return [
      <SelDua atas={t.nama} bawah={t.sub} />,
      <span className="keu__akun">
        {/* Di framenya logo kartu kredit 23x15 bergaris. Proyek tidak punya
            logo, jadi kotaknya diisi ikon penggaris — sama dengan kolom
            proyek di halaman Semua Transaksi. */}
        <span className="keu__akunlogo">
          <Ikon ikon={Ruler} ukuran={10} />
        </span>
        <span className="keu__akunnama">{t.proyek}</span>
      </span>,
      <SelDua
        atas={`${d.getDate()} ${BULAN_PENDEK[d.getMonth()]} ${d.getFullYear()}`}
        bawah={HARI[d.getDay()]}
      />,
      <span className={t.masuk ? "keu__masuk" : "keu__keluar"} title={formatRupiah(t.nominal)}>
        {t.masuk ? "+" : "−"}
        {formatRupiahRingkas(t.nominal)}
      </span>,
      <Lencana bentuk="pejalkecil" nada={t.masuk ? "selesai" : "menunggu"} className="keu__arah">
        {t.masuk ? "Masuk" : "Keluar"}
      </Lencana>,
    ];
  });

  const marjin = ringkas?.marginRataRata ?? null;
  const jumlahBelumLunas = (ringkas?.proyek ?? []).filter((p) => (p.belumDiterima ?? 0) > 0).length;
  const titikTiga = (href: string, judul: string) => (
    /* 22px, bukan 16 bawaan Medium: titik tiga di kepala seksi Coinest
       memang tergambar lebih besar — angka yang sama dengan frame 10. */
    <TombolIkon ikon={DotsThree} jenis="transparent" judul={judul} ikonPx={22} href={href} />
  );

  return (
    <div className="keu">
      {/* ---- Baris 1 ------------------------------------------------------ */}
      <section className="keu__kolomkiri">
        <div className="keu__stat">
          {/* Nominal DIPENDEKKAN di keempat kartu ("Rp532 jt"), angka
              penuhnya jadi tooltip. Kartunya 285 lebar dan dirancang untuk
              "$8,500" dengan keterangan di sebelahnya; "Rp532.000.000"
              sendirian sudah 200px. */}
          <KartuStatistikRingkas
            ikon={CoinIn}
            judul="Kas masuk"
            nilai={formatRupiahRingkas(ringkas?.kasMasuk ?? 0)}
            nilaiPenuh={formatRupiah(ringkas?.kasMasuk ?? 0)}
            tren={tKas ? <LencanaTren panah naik={tKas.naik}>{tKas.teks}</LencanaTren> : undefined}
            ket={
              bulanIni ? (
                <>
                  <b>{formatRupiahRingkas(bulanIni.kasMasuk)}</b> bulan ini
                </>
              ) : undefined
            }
          />
          <KartuStatistikRingkas
            ikon={CoinOut}
            judul="Beban"
            nilai={formatRupiahRingkas(ringkas?.totalBiaya ?? 0)}
            nilaiPenuh={formatRupiah(ringkas?.totalBiaya ?? 0)}
            /* Beban yang TURUN kabar baik, meski panahnya ke bawah — jadi
               `baik` dibalik dari `naik`, bukan mengikutinya. */
            tren={
              tBeban ? (
                <LencanaTren panah naik={tBeban.naik} baik={!tBeban.naik}>
                  {tBeban.teks}
                </LencanaTren>
              ) : undefined
            }
            ket={
              bulanIni ? (
                <>
                  <b>{formatRupiahRingkas(bulanIni.biaya)}</b> bulan ini
                </>
              ) : undefined
            }
          />
          <KartuStatistikRingkas
            ikon={CurrencyCircleDollar}
            judul="Laba bersih"
            nilai={formatRupiahRingkas(ringkas?.labaBersih ?? 0)}
            /* Tooltipnya sekalian membawa kalimat yang dulu jadi
               keterangan kartu ini: laba di sini dihitung dari kas yang
               benar-benar masuk, bukan dari nilai kontrak. */
            nilaiPenuh={`${formatRupiah(ringkas?.labaBersih ?? 0)} — dari kas yang benar-benar masuk`}
            tren={tLaba ? <LencanaTren panah naik={tLaba.naik}>{tLaba.teks}</LencanaTren> : undefined}
            ket={
              bulanIni ? (
                <>
                  <b>{formatRupiahRingkas(bulanIni.labaBersih)}</b> bulan ini
                </>
              ) : undefined
            }
          />
          <KartuStatistikRingkas
            ikon={Hourglass}
            judul="Piutang"
            nilai={formatRupiahRingkas(ringkas?.piutang ?? 0)}
            nilaiPenuh={formatRupiah(ringkas?.piutang ?? 0)}
            ket={
              <>
                <b>{jumlahBelumLunas}</b> proyek belum lunas
              </>
            }
          />
        </div>

        <article className="keu__kartu keu__arus">
          <KepalaSeksi
            judul="Arus Kas"
            kanan={
              <Tombol
                ukuran="medium"
                jenis="ghost"
                kanan={CaretDown}
                onClick={() => setRentang((r) => (r === 12 ? 24 : 12))}
              >
                {rentang} bulan
              </Tombol>
            }
          />
          <div className="keu__arusinfo">
            <div>
              <p className="keu__minilabel">Total kas masuk</p>
              <p className="keu__mininilai">{formatRupiah(ringkas?.kasMasuk ?? 0)}</p>
            </div>
            <ul className="keu__legenda">
              <li>
                <span className="keu__kotak keu__kotak--mint" />
                Kas masuk
              </li>
              <li>
                <span className="keu__kotak keu__kotak--tua" />
                Beban
              </li>
            </ul>
          </div>
          <GrafikArea
            deret={deretArea}
            labelX={labelX}
            labelY={[singkat(maks), singkat(maks * 0.75), singkat(maks * 0.5), singkat(maks * 0.25), "0"]}
            maks={maks}
            tinggi={141}
            /* 6, bukan 29,5 seperti di galeri kit. Ruang atas itu jatah
               kartu keterangan yang muncul saat kursor menunjuk sebuah
               bulan; grafik ini tidak memakai `sorot`, jadi 29,5px itu
               ruang kosong — dan justru itu yang mendorong label bulannya
               keluar dari kartu 314. */
            ruangAtas={6}
            jarakLabelX={16}
          />
        </article>
      </section>

      <article className="keu__kartu keu__beban">
        <KepalaSeksi judul="Rincian Beban" kanan={<span className="keu__ket">Seluruh proyek</span>} />
        {/* Lubang tengahnya menyempit begitu kategorinya lebih dari tiga.
            Tebal cincin = (luar - lubang) / (2n - 1), jadi kategori keempat
            menipiskan SELURUH cincin dari 14 jadi 10 kalau lubangnya tetap
            30 — dan pada 10 ia terbaca sebagai garis, bukan cincin.
            Lubang 16 mengembalikannya ke 12. Framenya sendiri tiga
            kategori, dan di angka itu keduanya memberi 14 yang sama. */}
        <Cincin className="keu__cincin" iris={iris} lubang={iris.length > 3 ? 16 : 30} />
        <p className="keu__minilabel">Total beban</p>
        <p className="keu__mininilai">{formatRupiah(ringkas?.totalBiaya ?? 0)}</p>
        {/* Jarak antar-baris legenda mengikuti jumlah kategori. Dengan empat
            baris, jarak 20,5 milik framenya melebihi ruang kartu 525 dan
            baris terakhir jadi bergulir — dan gulir di dalam kartu setinggi
            tetap terbaca sebagai potongan, bukan sebagai daftar panjang. */}
        <ul className={`keu__bebandaftar${iris.length > 3 ? " keu__bebandaftar--rapat" : ""}`}>
          {iris.map((s) => (
            <li key={s.label}>
              <span className="keu__titik" style={{ background: s.warna }} />
              <span className="keu__bebannama">
                {s.label}
                <b>{formatRupiah(s.nilai)}</b>
              </span>
              <span className="keu__bebanpersen">{Math.round(s.persen)}%</span>
            </li>
          ))}
          {iris.length === 0 && <li className="keu__kosong">Belum ada biaya tercatat.</li>}
        </ul>
      </article>

      <section className="keu__kolomkanan">
        <article className="keu__kartu keu__skor">
          <KepalaSeksi
            judul="Marjin Rata-rata"
            kanan={titikTiga("/admin", "Laba tiap proyek ada di Dashboard")}
          />
          <p className="keu__minilabel">Kualitas marjin</p>
          <div className="keu__skorbaris">
            <p className="keu__skornama">
              {marjin === null ? "Belum ada" : marjin >= 30 ? "Sehat" : marjin >= 15 ? "Cukup" : "Tipis"}
            </p>
            <p className="keu__skorpersen">{marjin === null ? "—" : `${Math.round(marjin)}%`}</p>
          </div>
          <BarKemajuan persen={marjin ?? 0} tinggi={25} celah={6} judul="Marjin rata-rata" />
        </article>

        <article className="keu__kartu keu__saldo">
          <KepalaSeksi
            judul="Piutang"
            kanan={titikTiga("/admin/keuangan/terima", "Catat pembayaran yang masuk")}
          />
          <p className="keu__minilabel">Belum diterima</p>
          <p className="keu__mininilai">{formatRupiah(ringkas?.piutang ?? 0)}</p>
          <div className="keu__saldodaftar">
            {piutangTeratas.map((p) => (
              <div className="keu__saldokartu" key={p.projectId}>
                {/* Bidang gelap di kiri kartu — di framenya tempat logo
                    jaringan kartu kredit (VISA, Mastercard). Di sini ikon
                    tagihan, karena yang dibawa kartu ini memang tagihan. */}
                <span className="keu__saldobidang" aria-hidden="true">
                  <Ikon ikon={NavReceipt} ukuran={24} />
                </span>
                <div className="keu__saldoisi">
                  <p className="keu__saldonama">{p.projectTitle}</p>
                  <p className="keu__saldonilai" title={formatRupiah(p.belumDiterima ?? 0)}>
                    {formatRupiahRingkas(p.belumDiterima ?? 0)}
                  </p>
                  <p className="keu__saldoket">
                    dari {formatRupiahRingkas(p.contractValue ?? 0)} nilai kontrak
                  </p>
                </div>
              </div>
            ))}
            {piutangTeratas.length === 0 && (
              <p className="keu__kosong">Semua termin sudah diterima.</p>
            )}
          </div>
        </article>
      </section>

      {/* ---- Baris 2 ------------------------------------------------------ */}
      <article className="keu__kartu keu__tabel">
        <KepalaSeksi
          judul="Transaksi Terbaru"
          kanan={
            <>
              {/* Pemilih ber-caret dengan <select> asli ditumpangkan
                  transparan — pola yang sama dengan halaman Semua Transaksi. */}
              <label className="k-pilihtombol keu__rentang">
                <Tombol ukuran="medium" jenis="ghost" kanan={CaretDown} tabIndex={-1}>
                  {RENTANG.find((r) => r.nilai === rentangTrx)?.label ?? "Rentang"}
                </Tombol>
                <select
                  aria-label="Rentang transaksi"
                  value={rentangTrx}
                  onChange={(e) => setRentangTrx(e.currentTarget.value)}
                >
                  {RENTANG.map((r) => (
                    <option key={r.nilai} value={r.nilai}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </label>
              <TombolIkon
                ikon={Sliders}
                jenis="ghost"
                judul="Saring lebih rinci di Semua Transaksi"
                href="/admin/keuangan/transaksi"
              />
            </>
          }
        />
        {baris.length > 0 ? (
          <div className="keu__tabelisi">
            <Tabel
              kolom={kolom}
              baris={baris}
              kepala="polos"
              pad={6}
              tinggiKepala={35}
              tinggiBaris={52}
              fontBaris={10}
            />
          </div>
        ) : (
          <p className="keu__kosong">
            {bayar === null || biaya === null ? "Memuat transaksi…" : "Belum ada transaksi pada rentang ini."}
          </p>
        )}
      </article>

      <article className="keu__kartu keu__rencana">
        <KepalaSeksi judul="Proyek Berjalan" />
        <p className="keu__minilabel">Total nilai kontrak</p>
        <p className="keu__mininilai">{formatRupiah(ringkas?.totalKontrak ?? 0)}</p>
        <ul className="keu__rencanadaftar">
          {proyekBerjalan.map((p) => {
            const pct = persenAman(p.received, p.contractValue ?? 0);
            return (
              <li key={p.projectId}>
                <p className="keu__rencananama">{p.projectTitle}</p>
                <BarKemajuan persen={pct} tinggi={8} celah={4} judul={p.projectTitle} />
                <p className="keu__rencanakaki">
                  <span>
                    {formatRupiah(p.received)} <i>/ {formatRupiah(p.contractValue ?? 0)}</i>
                  </span>
                  <b>{Math.round(pct)}%</b>
                </p>
              </li>
            );
          })}
          {proyekBerjalan.length === 0 && (
            <li className="keu__kosong">Belum ada proyek berkontrak yang berjalan.</li>
          )}
        </ul>
      </article>

      <article className="keu__kartu keu__aktivitas">
        <KepalaSeksi
          judul="Tenggat Tagihan"
          kanan={titikTiga("/admin/keuangan/tagihan", "Buka Tagihan & Termin")}
        />
        {/* `BarisLog` varian V2 (waktu DI ATAS keterangan) — bentuk yang
            digambar framenya: ubin bulat mint 30, baris kecil abu, lalu
            kalimatnya. Tanpa rel penyambung; framenya tidak punya. */}
        <div className="keu__aktivitasisi">
          {tenggat.map((t, i) => (
            <div key={t.kunci}>
              {(i === 0 || tenggat[i - 1]!.kepala !== t.kepala) && (
                <p className="keu__harilabel">{t.kepala}</p>
              )}
              <BarisLog
                ikon={t.lewat ? HourglassHigh : NavCalendarDots}
                waktu={t.atas}
                waktuDulu
                akhir
                ikonPx={16}
              >
                {t.teks}
              </BarisLog>
            </div>
          ))}
          {tenggat.length === 0 && (
            <p className="keu__kosong">
              {tagihan === null ? "Memuat tagihan…" : "Tidak ada tagihan terbit yang menunggu dibayar."}
            </p>
          )}
        </div>
      </article>
    </div>
  );
}

export function RingkasanKit() {
  return (
    <RequireAuth skeleton={<div className="keu keu--rangka" />}>
      <Isi />
    </RequireAuth>
  );
}
