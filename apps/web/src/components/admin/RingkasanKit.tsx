import { useEffect, useMemo, useState } from "react";
import { RequireAuth } from "./RequireAuth";
import { KepalaSeksi, BarisLog } from "../kit/Item";
import { KartuStatistikRingkas } from "../kit/Kartu";
import { GrafikArea, BarKemajuan, Cincin, LencanaTren } from "../kit/Ukuran";
import { Tabel, SelDua, type KolomTabel } from "../kit/Tabel";
import { Tombol } from "../kit/Tombol";
import { Ikon } from "../kit/Ikon";
import {
  CoinIn,
  CoinOut,
  CurrencyCircleDollar,
  Hourglass,
  CaretDown,
  NavReceipt,
  Wallet,
} from "../kit/ikon";
import {
  ambilRingkasanKeuangan,
  ambilBulanan,
  semuaBiaya,
  bacaCache,
  tulisCache,
  type FinanceOverview,
  type BarisBulanan,
  type BiayaProyek,
} from "../../lib/admin";
import { proyekAktif, onProyekAktif } from "../../lib/proyekAktif";
import { formatRupiah } from "../../lib/format";

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
     Recent Transactions       Rekap per proyek
     Saving Plans              Proyek berjalan — termin diterima / kontrak
     Recent Activities         Biaya terbaru, dikelompokkan per hari

   Dua yang TIDAK dipetakan satu-ke-satu, dan sebabnya:

   - Recent Transactions di framenya daftar transaksi. Kalau diisi daftar
     biaya, ia menampilkan hal yang SAMA dengan Recent Activities di
     sebelahnya — satu halaman, dua daftar yang isinya sama. Jadi yang masuk
     rekap per proyek: lima kolom, sama seperti framenya, dan menjawab
     pertanyaan yang tidak dijawab widget lain di halaman ini.
   - Recent Activities butuh daftar pembayaran lintas proyek, dan API-nya
     baru ada per-proyek (`/admin/projects/:id/payments`). Mengambilnya
     berarti satu permintaan per proyek. Sampai endpoint lintas proyeknya ada,
     yang tampil biaya terbaru.

   Ukuran kolomnya, dari framenya: 586 / 283 / 283 dengan celah 20, total
   1192 — sama dengan lebar kolom konten.
   ============================================================================= */

const BULAN_PENDEK = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

/* #1E4841, #BBF49C, #BCBEBD — terukur dari "Chart_2" di frame 04.

   Yang keempat TIDAK ada di framenya, dan tangga `--ramp-1..5` tidak bisa
   menyediakannya: `--ramp-3` (#ECF4E9) persis warna jalur cincinnya sendiri
   dan `--ramp-4` (#E5E6E6) beda 7/14/3 per kanal darinya — cincin yang
   memakai keduanya tergambar seolah kosong. Jadi yang keempat dicampur dari
   brand, yang jatuh di antara #1E4841 dan mintnya dan tetap satu keluarga. */
const WARNA_CINCIN = [
  "var(--brand)",
  "var(--brand-mint)",
  "var(--ramp-5)",
  "color-mix(in srgb, var(--brand) 45%, var(--brand-mint))",
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

/** "2026-09-24" -> "Hari ini" / "Kemarin" / "24 Sep". */
function hari(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  const kini = new Date();
  const nol = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const beda = Math.round((nol(kini) - nol(d)) / 86_400_000);
  if (beda === 0) return "Hari ini";
  if (beda === 1) return "Kemarin";
  return `${d.getDate()} ${BULAN_PENDEK[d.getMonth()]}`;
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

  useEffect(() => onProyekAktif(setProyekId), []);

  useEffect(() => {
    semuaBiaya()
      .then((d) => {
        tulisCache("biaya-semua", d);
        setBiaya(d);
      })
      .catch(() => setBiaya((l) => l ?? []));
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

  const biayaTerbaru = useMemo(
    () =>
      [...(biaya ?? [])]
        .sort((a, b) => b.incurredOn.localeCompare(a.incurredOn))
        /* EMPAT, bukan lima seperti framenya — dan itu selisih yang disengaja.
           Framenya memuat lima Log Item dengan hanya DUA kepala hari; biaya
           studio ini menyebar satu-dua per hari, jadi lima butir berarti
           empat kepala hari dan totalnya 26px melewati kartu 380. Yang
           terlihat bukan gulir melainkan kepala hari menggantung di tepi
           bawah, dan itu terbaca sebagai cacat. */
        .slice(0, 4),
    [biaya],
  );

  /* Lebar kolomnya berjumlah 552, bukan angka bebas: kartunya 586 dan
     paddingnya 16 di dua sisi dan garisnya 1. Jumlah yang melebihi itu TIDAK membuat tabel
     bergulir — `<col>` ber-`width` cuma usulan, dan yang terjadi kolom
     terakhir terpotong di tepi kartu tanpa satu pun galat. */
  const kolom: KolomTabel[] = [
    { judul: "Proyek", lebar: 168, urut: true },
    { judul: "Nilai Kontrak", lebar: 100, urut: true, kanan: true },
    { judul: "Diterima", lebar: 98, urut: true, kanan: true, redup: true },
    { judul: "Biaya", lebar: 90, urut: true, kanan: true, redup: true },
    { judul: "Laba", lebar: 96, urut: true, kanan: true },
  ];

  const baris = (ringkas?.proyek ?? []).slice(0, 5).map((p) => [
    <SelDua atas={p.projectTitle} bawah={p.marginPct === null ? "belum berkontrak" : `marjin ${p.marginPct.toFixed(0)}%`} />,
    formatRupiah(p.contractValue ?? 0),
    formatRupiah(p.received),
    formatRupiah(p.costsTotal),
    formatRupiah(p.labaBersih),
  ]);

  const marjin = ringkas?.marginRataRata ?? null;

  return (
    <div className="keu">
      {/* ---- Baris 1 ------------------------------------------------------ */}
      <section className="keu__kolomkiri">
        <div className="keu__stat">
          <KartuStatistikRingkas
            ikon={CoinIn}
            judul="Kas masuk"
            nilai={formatRupiah(ringkas?.kasMasuk ?? 0)}
            tren={tKas ? <LencanaTren naik={tKas.naik}>{tKas.teks}</LencanaTren> : undefined}
            ket={
              bulanLalu ? (
                <>
                  <b>{formatRupiah(bulanIni?.kasMasuk ?? 0)}</b> bulan ini
                </>
              ) : (
                "bulan lalu belum ada kas masuk"
              )
            }
          />
          <KartuStatistikRingkas
            ikon={CoinOut}
            judul="Beban"
            nilai={formatRupiah(ringkas?.totalBiaya ?? 0)}
            /* Beban yang TURUN kabar baik, meski panahnya ke bawah — jadi
               `baik` dibalik dari `naik`, bukan mengikutinya. */
            tren={
              tBeban ? (
                <LencanaTren naik={tBeban.naik} baik={!tBeban.naik}>
                  {tBeban.teks}
                </LencanaTren>
              ) : undefined
            }
            ket={
              bulanLalu ? (
                <>
                  <b>{formatRupiah(bulanIni?.biaya ?? 0)}</b> bulan ini
                </>
              ) : (
                "bulan lalu belum ada biaya"
              )
            }
          />
          <KartuStatistikRingkas
            ikon={CurrencyCircleDollar}
            judul="Laba bersih"
            nilai={formatRupiah(ringkas?.labaBersih ?? 0)}
            tren={tLaba ? <LencanaTren naik={tLaba.naik}>{tLaba.teks}</LencanaTren> : undefined}
            ket={<>dari kas yang benar-benar masuk</>}
          />
          <KartuStatistikRingkas
            ikon={Hourglass}
            judul="Piutang"
            nilai={formatRupiah(ringkas?.piutang ?? 0)}
            ket={
              marjin === null ? (
                "belum ada proyek berkontrak"
              ) : (
                <>
                  <b>{marjin.toFixed(1).replace(".", ",")}%</b> marjin rata-rata
                </>
              )
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
          <KepalaSeksi judul="Marjin Rata-rata" />
          <div className="keu__skorbaris">
            <div>
              <p className="keu__minilabel">Kualitas marjin</p>
              <p className="keu__skornama">
                {marjin === null ? "Belum ada" : marjin >= 30 ? "Sehat" : marjin >= 15 ? "Cukup" : "Tipis"}
              </p>
            </div>
            <p className="keu__skorpersen">{marjin === null ? "—" : `${Math.round(marjin)}%`}</p>
          </div>
          <BarKemajuan persen={marjin ?? 0} tinggi={25} celah={6} judul="Marjin rata-rata" />
        </article>

        <article className="keu__kartu keu__saldo">
          <KepalaSeksi judul="Piutang" />
          <p className="keu__minilabel">Belum diterima</p>
          <p className="keu__mininilai">{formatRupiah(ringkas?.piutang ?? 0)}</p>
          <div className="keu__saldodaftar">
            {piutangTeratas.map((p) => (
              <div className="keu__saldokartu" key={p.projectId}>
                <span className="keu__saldoubin">
                  <Ikon ikon={NavReceipt} ukuran={24} />
                </span>
                <div className="keu__saldoisi">
                  <p className="keu__saldonama">{p.projectTitle}</p>
                  <p className="keu__saldonilai">{formatRupiah(p.belumDiterima ?? 0)}</p>
                  <p className="keu__saldoket">
                    dari {formatRupiah(p.contractValue ?? 0)} nilai kontrak
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
        <KepalaSeksi judul="Rekap per Proyek" kanan={<span className="keu__ket">Lima teratas</span>} />
        <Tabel
          kolom={kolom}
          baris={baris}
          pad={10}
          tinggiKepala={34}
          tinggiBaris={49}
          fontBaris={10}
        />
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
        <KepalaSeksi judul="Biaya Terbaru" />
        {/* `BarisLog`, BUKAN `BarisAktivitas`. Catatan lama di
            docs/wireframe/coinest-ukuran.md menyebut widget ini berisi
            Recent Activities; SVG framenya menyebut lain — "Section Plans >
            Div Logs > Div Log > Log List > Log Item", lima buah, dengan ubin
            LINGKARAN 30x30 mint di (1145, 723/768/813/901/946), jadi
            langkahnya 45 dan ada satu kepala hari di tengah. Itu bentuk Log,
            dan ubin aktivitas justru 32 bujur sangkar dengan garis penyambung.

            Teksnya satu baris ber-elipsis dengan sengaja: nama biaya di
            studio ini panjang-panjang ("Render eksterior 6 frame"), dan dua
            baris per butir membuat butir kelima terdorong keluar kartu 380.
            Nominalnya turun ke baris waktu, yang di framenya memang baris
            kedua tiap butir. */}
        <div className="keu__aktivitasisi">
          {biayaTerbaru.map((b, i) => {
            const judulHari = hari(b.incurredOn);
            const sebelumnya = i > 0 ? hari(biayaTerbaru[i - 1].incurredOn) : null;
            return (
              <div key={b.id}>
                {judulHari !== sebelumnya && <p className="keu__harilabel">{judulHari}</p>}
                <BarisLog
                  ikon={Wallet}
                  waktu={`${formatRupiah(b.amount)} · ${KATEGORI[b.category] ?? b.category}`}
                  akhir={i === biayaTerbaru.length - 1}
                >
                  {b.label}
                </BarisLog>
              </div>
            );
          })}
          {biayaTerbaru.length === 0 && <p className="keu__kosong">Belum ada biaya tercatat.</p>}
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
