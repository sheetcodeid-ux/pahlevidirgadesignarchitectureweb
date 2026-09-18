import { useEffect, useMemo, useState } from "react";
import { Icon } from "../ui/Icon";
import { KartuAngka } from "../ui/data/KartuAngka";
import { ChartArusKas, type TitikArus } from "../ui/data/ChartArusKas";
import { KartuDonat, type IrisDonat } from "../ui/data/KartuDonat";
import { ChartBandingTahun, type TitikBanding } from "../ui/data/ChartBandingTahun";
import { DataTable, type Kolom } from "../ui/data/DataTable";
import { Select } from "../ui/overlay/Select";
import { AlertDialog, Dialog } from "../ui/overlay/Dialog";
import { InputRupiah } from "../ui/InputRupiah";
import { ToastProvider, useToast } from "../ui/overlay/Toast";
import { RequireAuth } from "./RequireAuth";
import { PanelKeuangan } from "./ProjectEditor";
import {
  ambilRingkasanKeuangan, ambilBulanan, bacaCache, tulisCache,
  semuaBiaya, catatBiaya, hapusBiaya, daftarProyek, daftarTim,
  type BarisBulanan, type FinanceOverview, type FinanceOverviewRow,
  type BiayaProyek, type Proyek, type AnggotaTim,
} from "../../lib/admin";
import { proyekAktif, onProyekAktif } from "../../lib/proyekAktif";
import { formatRupiah } from "../../lib/format";
import { unduhCsv } from "../../lib/csv";

/* =============================================================================
   Halaman Keuangan.

   Dirakit dari empat komponen yang sudah disetujui pemilik satu per satu:
   KartuAngka, ChartArusKas, KartuDonat, ChartBandingTahun. Susunannya
   mengikuti wireframe yang juga sudah disetujui — empat kartu angka, lalu
   dua kolom 67,4% / 31,2%, lalu satu kartu selebar penuh.

   Tidak ada satu pun angka di halaman ini yang dikarang. Semuanya turun dari
   dua endpoint yang sudah ada: /admin/finance/overview dan
   /admin/finance/monthly. Kalau sebuah angka tidak tersedia, kartunya
   menampilkan keadaan kosongnya sendiri — bukan nilai contoh.
   ============================================================================= */

const BULAN_PENDEK = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const BULAN_PANJANG = ["Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

/** Nama tampilan dan warna tiap kategori biaya di enum public.cost_category. */
const KATEGORI: Record<string, { label: string; warna: string }> = {
  freelancer:  { label: "Freelancer & render", warna: "var(--chart-cat-1)" },
  operasional: { label: "Operasional harian",  warna: "var(--chart-cat-2)" },
  prinsipal:   { label: "Prinsipal",           warna: "var(--chart-cat-3)" },
  lainnya:     { label: "Lainnya",             warna: "var(--chart-cat-4)" },
};

/**
 * Deret bulan yang RAPAT, dari data API yang berlubang.
 *
 * Query bulanan sengaja tidak memancarkan bulan tanpa kejadian sama sekali —
 * baris nol yang dikarang di sisi database lebih menyesatkan daripada jeda.
 * Tapi grafik butuh dua belas titik berurutan, jadi jedanya diisi di SINI,
 * di tempat yang tahu bahwa nol berarti "tidak ada kejadian".
 */
function deretBulan(data: BarisBulanan[], jumlah: number): BarisBulanan[] {
  const peta = new Map(data.map((d) => [d.bulan, d]));
  const keluar: BarisBulanan[] = [];
  const kini = new Date();
  for (let i = jumlah - 1; i >= 0; i -= 1) {
    const d = new Date(kini.getFullYear(), kini.getMonth() - i, 1);
    const kunci = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    keluar.push(peta.get(kunci) ?? { bulan: kunci, kasMasuk: 0, biaya: 0, labaBersih: 0, proyekAktif: 0 });
  }
  return keluar;
}

/** '2026-09-08' → '8 Sep 2026'. Tanggal biaya selalu tanggal kejadiannya. */
function tanggalPendek(iso: string): string {
  const [t, b, h] = iso.split("-");
  return `${Number(h)} ${BULAN_PENDEK[Number(b) - 1]} ${t}`;
}

function namaBulan(kunci: string, panjang = false) {
  const n = Number(kunci.slice(5, 7)) - 1;
  return (panjang ? BULAN_PANJANG : BULAN_PENDEK)[n] ?? kunci;
}

/** Persentase perubahan. Null kalau basisnya nol — pembagian nol bukan "naik tak hingga". */
function delta(kini: number, lalu: number): { teks: string; arah: "naik" | "turun" } | null {
  if (lalu === 0) return null;
  const p = ((kini - lalu) / Math.abs(lalu)) * 100;
  if (!Number.isFinite(p)) return null;
  const bulat = Math.abs(p) >= 100 ? Math.round(p) : Math.round(p * 10) / 10;
  return {
    teks: `${p >= 0 ? "+" : "−"}${Math.abs(bulat).toLocaleString("id-ID")}%`,
    arah: p >= 0 ? "naik" : "turun",
  };
}


/* --- Kerangka muat ---------------------------------------------------------- */

function Rangka() {
  return (
    <div className="keu" aria-hidden="true">
      <div className="kangka-deret">
        {[0, 1, 2, 3].map((i) => <div key={i} className="skeleton skeleton--tunda keu__rangka-kartu" />)}
      </div>
      <div className="keu__baris2">
        <div className="skeleton skeleton--tunda keu__rangka-besar" />
        <div className="skeleton skeleton--tunda keu__rangka-besar" />
      </div>
      <div className="skeleton skeleton--tunda keu__rangka-lebar" />
    </div>
  );
}

/* --- Isi -------------------------------------------------------------------- */

type Tab = "ringkasan" | "proyek" | "biaya" | "tagihan";

/**
 * Margin minimum yang direkomendasikan dokumen strategi §6.3: 35-45% setelah
 * biaya freelancer dan overhead, dengan saran menolak proyek di bawahnya.
 *
 * Di sini ia MENANDAI, bukan memblokir. Panel ini mencatat apa yang sudah
 * terjadi; menolak proyek adalah keputusan pemilik, dan angka yang sudah
 * telanjur tercatat tidak bisa ditolak oleh sebuah tabel.
 */
const MARGIN_MINIMUM = 35;

function Isi() {
  const [proyekId, setProyekId] = useState<string | null>(() => proyekAktif());
  const [tab, setTab] = useState<Tab>("ringkasan");
  const [rentang, setRentang] = useState("12");

  const kunci = `keuangan:${proyekId ?? "semua"}`;
  const kunciBulan = `keuangan-bulan:${proyekId ?? "semua"}`;

  const [ringkas, setRingkas] = useState<FinanceOverview | null>(() => bacaCache<FinanceOverview>(kunci));
  const [bulanan, setBulanan] = useState<BarisBulanan[] | null>(() => bacaCache<BarisBulanan[]>(kunciBulan));

  useEffect(() => onProyekAktif(setProyekId), []);

  /* Satu pintu: daftar biaya lintas proyek, plus dua daftar yang mengisi
     dropdown dialognya. Ketiganya tidak bergantung pada proyek yang sedang
     dipilih di topbar — halaman ini memang tidak lagi terikat satu proyek. */
  const [biaya, setBiaya] = useState<BiayaProyek[] | null>(() => bacaCache<BiayaProyek[]>("biaya-semua"));
  const [proyek, setProyek] = useState<Proyek[]>(() => bacaCache<Proyek[]>("proyek") ?? []);
  const [tim, setTim] = useState<AnggotaTim[]>(() => bacaCache<AnggotaTim[]>("tim") ?? []);

  function muatBiaya() {
    semuaBiaya()
      .then((d) => { tulisCache("biaya-semua", d); setBiaya(d); })
      .catch(() => setBiaya((l) => l ?? []));
  }

  useEffect(() => {
    muatBiaya();
    /* MEMBACA saja, tidak menulis. Halaman ini bukan pemilik daftar proyek
       maupun daftar tim — ia cuma butuh keduanya untuk dropdown di dialog.
       Aturan jebakan #8 di CLAUDE.md: yang boleh memanggil tulisCache(kunci)
       hanya halaman pemilik daftar itu, karena tulisCache ikut menyimpan
       PANJANG daftar, dan panjang itu dibaca saat render oleh skeleton
       halaman lain. Pelanggarannya saya sendiri yang tulis di Fase 02. */
    daftarProyek().then(setProyek).catch(() => {});
    daftarTim().then(setTim).catch(() => {});
  }, []);

  useEffect(() => {
    let batal = false;
    setRingkas(bacaCache<FinanceOverview>(kunci));
    setBulanan(bacaCache<BarisBulanan[]>(kunciBulan));

    ambilRingkasanKeuangan(proyekId)
      .then((d) => { if (!batal) { tulisCache(kunci, d); setRingkas(d); } })
      .catch(() => { if (!batal) setRingkas((l) => l ?? null); });

    // 24 bulan sekali ambil: dua belas untuk grafik arus kas, dua belas lagi
    // untuk pembanding tahun lalu. Satu permintaan, bukan dua.
    ambilBulanan(proyekId, 24)
      .then((d) => { if (!batal) { tulisCache(kunciBulan, d); setBulanan(d); } })
      .catch(() => { if (!batal) setBulanan((l) => l ?? null); });

    return () => { batal = true; };
  }, [proyekId, kunci, kunciBulan]);

  const proyekTerpilih = useMemo(
    () => proyek.find((p) => p.id === proyekId) ?? null, [proyek, proyekId]);

  const rapat24 = useMemo(() => deretBulan(bulanan ?? [], 24), [bulanan]);
  const rapat = useMemo(
    () => rapat24.slice(24 - Number(rentang)),
    [rapat24, rentang],
  );

  const arus: TitikArus[] = useMemo(() => rapat.map((b) => ({
    label: namaBulan(b.bulan),
    labelPanjang: `${namaBulan(b.bulan, true)} ${b.bulan.slice(0, 4)}`,
    nilai: { kas: b.kasMasuk, beban: b.biaya, laba: b.labaBersih },
  })), [rapat]);

  /* Dua belas bulan terakhir disandingkan dengan dua belas bulan sebelumnya,
     bulan demi bulan — Januari lawan Januari, bukan lawan Januari geser. */
  const banding: TitikBanding[] = useMemo(() => {
    const kini = rapat24.slice(12);
    const lalu = rapat24.slice(0, 12);
    return kini.map((b, i) => ({
      label: namaBulan(b.bulan),
      labelPanjang: namaBulan(b.bulan, true),
      kini: b.kasMasuk,
      lalu: lalu[i]?.kasMasuk ?? 0,
    }));
  }, [rapat24]);

  const iris: IrisDonat[] = useMemo(() => (ringkas?.bebanKategori ?? []).map((k) => ({
    label: KATEGORI[k.kategori]?.label ?? k.kategori,
    nilai: k.nilai,
    warna: KATEGORI[k.kategori]?.warna ?? "var(--chart-cat-5)",
  })), [ringkas]);

  if (!ringkas) return <Rangka />;

  const bulanIni = rapat24[23];
  const bulanLalu = rapat24[22];
  const dKas = delta(bulanIni.kasMasuk, bulanLalu.kasMasuk);
  const dBeban = delta(bulanIni.biaya, bulanLalu.biaya);
  const dLaba = delta(bulanIni.labaBersih, bulanLalu.labaBersih);

  const tahunKini = new Date().getFullYear();

  const kolom: Kolom<FinanceOverviewRow>[] = [
    { judul: "Proyek", render: (b) => <span className="t-strong">{b.projectTitle}</span> },
    { judul: "Nilai kontrak", kelas: "table__num", lebar: "8rem",
      render: (b) => (b.contractValue === null ? "—" : formatRupiah(b.contractValue)) },
    { judul: "Diterima", kelas: "table__num", lebar: "8rem", render: (b) => formatRupiah(b.received) },
    { judul: "Biaya", kelas: "table__num", lebar: "8rem", render: (b) => formatRupiah(b.costsTotal) },
    { judul: "Laba bersih", kelas: "table__num", lebar: "8rem",
      render: (b) => <span className={b.labaBersih < 0 ? "angka-minus" : undefined}>{formatRupiah(b.labaBersih)}</span> },
    /* Dokumen strategi §6.3 menyarankan margin minimum 35-45%. Yang di bawah
       ambang ditandai amber — bukan merah: proyeknya tidak rusak, ia cuma
       lebih tipis dari yang direkomendasikan, dan merah di sistem warna ini
       berarti brand dan destruktif. */
    { judul: "Marjin", kelas: "table__num", lebar: "6rem",
      render: (b) => {
        if (b.marginPct === null) return "—";
        const teks = `${b.marginPct.toFixed(1).replace(".", ",")}%`;
        return b.marginPct < MARGIN_MINIMUM
          ? <span className="badge badge--warn" title={`Di bawah margin minimum ${MARGIN_MINIMUM}% (strategi §6.3)`}>{teks}</span>
          : teks;
      } },
  ];

  const kolomBiaya: Kolom<BiayaProyek>[] = [
    { judul: "Tanggal", lebar: "7rem",
      render: (b) => <span className="t-num t-muted">{tanggalPendek(b.incurredOn)}</span> },
    { judul: "Proyek", render: (b) => <span className="t-strong">{b.projectTitle ?? "—"}</span> },
    { judul: "Keterangan", render: (b) => b.label },
    { judul: "Kategori", lebar: "10rem",
      render: (b) => <span className="badge">{KATEGORI[b.category]?.label ?? b.category}</span> },
    /* Kolom yang membuat halaman Fee mungkin. Yang kosong ditulis apa adanya —
       biaya operasional memang bukan milik siapa pun, dan baris lama dicatat
       sebelum kolomnya ada. */
    { judul: "Untuk", lebar: "10rem",
      render: (b) => (b.teamMemberName
        ? <span className="row" style={{ gap: "var(--space-1)" }}><Icon name="user" size={13} />{b.teamMemberName}</span>
        : <span className="t-faint">—</span>) },
    { judul: "Nominal", kelas: "table__num", lebar: "8rem",
      render: (b) => formatRupiah(b.amount) },
    /* "Aksi" dan .table__actions, sama seperti kolom terakhir di Halaman
       Proyek: kelasnya yang memberi rata-tengah dan ukuran tombol 28px,
       dan .table__aksi yang dipakai sebelumnya tidak ada di satu pun
       stylesheet — jadi selama ini kolomnya memang tanpa aturan sama sekali. */
    { judul: "Aksi", lebar: "3rem", kelas: "table__actions",
      render: (b) => (
        <AlertDialog
          destructive
          title="Hapus biaya ini?"
          description={`${b.label} — ${formatRupiah(b.amount)}. Laba bersih proyeknya ikut berubah.`}
          confirmLabel="Ya, hapus"
          onConfirm={async () => { await hapusBiaya(b.id); muatBiaya(); }}
          trigger={
            <button type="button" className="btn btn--ghost btn--icon btn--sm btn--hapus"
              aria-label={`Hapus ${b.label}`}>
              <Icon name="trash" size={14} />
            </button>
          }
        />
      ) },
  ];

  function ekspor() {
    unduhCsv(`keuangan-${new Date().toISOString().slice(0, 10)}.csv`, [
      ["Proyek", "Nilai kontrak", "Diterima", "Biaya", "Laba bersih", "Marjin %"],
      ...(ringkas?.proyek ?? []).map((b) => [
        b.projectTitle,
        b.contractValue === null ? "" : String(b.contractValue),
        String(b.received),
        String(b.costsTotal),
        String(b.labaBersih),
        b.marginPct === null ? "" : b.marginPct.toFixed(2),
      ]),
    ]);
  }

  return (
    <div className="keu">
      <div className="keu__bar">
        <div className="segmented segmented--kotak" role="group" aria-label="Tampilan Keuangan">
          <button type="button" className="segmented__opt" aria-pressed={tab === "ringkasan"}
            onClick={() => setTab("ringkasan")}>
            <Icon name="dashboard" size={16} />Ringkasan
          </button>
          <button type="button" className="segmented__opt" aria-pressed={tab === "proyek"}
            onClick={() => setTab("proyek")}>
            <Icon name="project" size={16} />Per Proyek
          </button>
          <button type="button" className="segmented__opt" aria-pressed={tab === "biaya"}
            onClick={() => setTab("biaya")}>
            <Icon name="receipt" size={16} />Kas &amp; Biaya
          </button>
          <button type="button" className="segmented__opt" aria-pressed={tab === "tagihan"}
            onClick={() => setTab("tagihan")}>
            <Icon name="cash" size={16} />Tagihan
          </button>
        </div>
      </div>

      {tab === "ringkasan" ? (
        <>
          <div className="kangka-deret">
            <KartuAngka
              label="Kas masuk diterima" nilai={formatRupiah(ringkas.kasMasuk)} ikon="finance"
              delta={dKas?.teks ?? "bulan lalu belum ada kas masuk"}
              deltaArah={dKas?.arah} deltaNada={dKas ? undefined : "netral"}
            />
            <KartuAngka
              label="Beban operasional" nilai={formatRupiah(ringkas.totalBiaya)} ikon="coffee"
              delta={dBeban?.teks ?? "bulan lalu belum ada biaya"}
              deltaArah={dBeban?.arah}
              /* Beban yang TURUN adalah kabar baik, meski panahnya ke bawah. */
              deltaNada={!dBeban ? "netral" : dBeban.arah === "turun" ? "baik" : "buruk"}
            />
            <KartuAngka
              label="Laba bersih dari kas" nilai={formatRupiah(ringkas.labaBersih)} ikon="check"
              minus={ringkas.labaBersih < 0}
              delta={dLaba?.teks ?? "belum bisa dibandingkan"}
              deltaArah={dLaba?.arah} deltaNada={dLaba ? undefined : "netral"}
            />
            <KartuAngka
              label="Piutang belum dibayar" nilai={formatRupiah(ringkas.piutang)} ikon="clock"
              delta={ringkas.marginRataRata === null
                ? "belum ada proyek berkontrak"
                : `marjin rata-rata ${ringkas.marginRataRata.toFixed(1).replace(".", ",")}%`}
              deltaNada="netral"
            />
          </div>


          <div className="keu__baris2">
            <ChartArusKas
              judul="Analisis Arus Kas"
              /* Hijau, merah, amber — bukan palet --chart-*.
                 Sempat ditukar ke palet grafik situs supaya seragam dengan
                 Chart.tsx dan Dashboard.tsx, lalu pemilik memintanya kembali:
                 versi ini lebih menyala. Keputusan dia, dan ini halaman yang
                 dia baca tiap hari.
                 Warnanya di sini kebetulan juga masuk akal maknanya: hijau
                 untuk uang masuk, merah untuk uang keluar, amber untuk
                 sisanya. */
              seri={[
                { kunci: "kas", label: "Kas masuk", warna: "var(--success)", gaya: "penuh", isi: true },
                /* --danger, bukan --brand: sejak merek jadi teal, beban yang memakai
                     --brand tergambar teal — warna yang sama dengan kas masuk,
                     dan dua garis sewarna di satu grafik tidak menjawab apa pun. */
                { kunci: "beban", label: "Beban", warna: "var(--danger)", gaya: "putus" },
                { kunci: "laba", label: "Laba bersih", warna: "var(--warn)", gaya: "putus" },
              ]}
              data={arus}
              periode={rentang}
              opsiPeriode={[
                { nilai: "12", label: "12 bulan" },
                { nilai: "24", label: "24 bulan" },
              ]}
              onPeriode={setRentang}
            />
            <KartuDonat
              judul="Rincian Beban"
              subjudul={proyekId ? "Proyek terpilih" : "Seluruh proyek"}
              iris={iris}
              format={(n) => formatRupiah(n)}
              kakiLabel="Total beban"
              kakiNilai={formatRupiah(ringkas.totalBiaya)}
            />
          </div>

          <ChartBandingTahun
            judul="Perbandingan Kas Masuk"
            labelKini={String(tahunKini)}
            labelLalu={String(tahunKini - 1)}
            data={banding}
          />
        </>
      ) : tab === "proyek" ? (
        <DataTable
          data={ringkas.proyek}
          kunci={(b) => b.projectId}
          kolom={kolom}
          cariPada={(b) => [b.projectTitle]}
          placeholderCari="Cari proyek…"
          labelCari="Cari proyek"
          satuan="proyek"
          barisSkeleton={5}
          bentuk="kartu"
          /* Tombolnya duduk DI DALAM bilah tabelnya, bukan di bilah tab —
             bentuk yang sama dengan "Proyek Baru" di Halaman Proyek, yang
             jadi acuan pemilik. Sekalian jadi benar maknanya: Export
             menurunkan tabel INI, jadi ia milik tabel ini. */
          aksi={
            <button type="button" className="btn btn--secondary keu__ekspor" onClick={ekspor}>
              <Icon name="download" size={15} />Export
            </button>
          }
          kosong={{
            ikon: "finance",
            judul: "Belum ada proyek berkontrak",
            keterangan: "Isi Nilai Kontrak di halaman proyek supaya angkanya muncul di sini.",
          }}
        />
      ) : tab === "tagihan" ? (
        /* Tagihan dan nilai kontrak TERIKAT pada satu proyek — tidak seperti
           biaya, yang proyeknya cukup dipilih di dialog. Jadi tab ini memakai
           proyek yang sedang dipilih di bilah atas, dan mengatakannya kalau
           belum ada yang dipilih. */
        proyekTerpilih ? (
          <PanelKeuangan
            proyek={proyekTerpilih}
            onUbahKontrak={(v) => setProyek((l) =>
              l.map((x) => (x.id === proyekTerpilih.id ? { ...x, contractValue: v } : x)))}
          />
        ) : (
          <div className="empty">
            <span className="icon-tile"><Icon name="cash" size={22} /></span>
            <span className="t-subheading">Pilih proyeknya dulu</span>
            <p className="t-muted">
              Tagihan dan nilai kontrak milik satu proyek. Pilih proyek di
              pemilih proyek pada bilah atas, lalu kembali ke tab ini.
            </p>
          </div>
        )
      ) : (
        <DataTable
          data={biaya}
          kolom={kolomBiaya}
          kunci={(b) => b.id}
          cariPada={(b) => [b.label, b.projectTitle, b.teamMemberName]}
          placeholderCari="Cari biaya, proyek, atau nama…"
          labelCari="Cari biaya"
          satuan="biaya"
          barisSkeleton={6}
          bentuk="kartu"
          /* Satu-satunya pintu mencatat pengeluaran sejak "Kerja Internal"
             dibuang, dan sekarang ia berdiri tepat di atas daftar yang
             ditambahnya. Proyeknya dipilih di dalam dialog — staf tidak
             perlu berpindah halaman dulu. */
          aksi={<DialogBiaya proyek={proyek} tim={tim} onSelesai={muatBiaya} />}
          kosong={{
            ikon: "receipt",
            judul: "Belum ada pengeluaran tercatat",
            keterangan: "Tekan Catat pengeluaran di atas. Proyeknya dipilih di dalam dialog.",
          }}
        />
      )}
    </div>
  );
}

/* ── Dialog catat pengeluaran ─────────────────────────────────────────────
 *
 * Inti dari "satu pintu": proyeknya DIPILIH DI SINI, bukan ditentukan oleh
 * halaman mana staf kebetulan berada. Sebelumnya pengeluaran hanya bisa
 * dicatat dari "Kerja Internal" milik satu proyek — jadi mencatat tiga nota
 * untuk tiga proyek berarti tiga kali berpindah halaman.
 */
function DialogBiaya(
  { proyek, tim, onSelesai }: { proyek: Proyek[]; tim: AnggotaTim[]; onSelesai: () => void },
) {
  const toast = useToast();
  const [idProyek, setIdProyek] = useState("");
  const [label, setLabel] = useState("");
  const [kategori, setKategori] = useState("freelancer");
  const [orang, setOrang] = useState("");
  const [nominal, setNominal] = useState<number | null>(null);
  const [tanggal, setTanggal] = useState("");
  const [kirim, setKirim] = useState(false);
  /* Dialog dikendalikan, bukan dibiarkan Radix yang mengurus sendiri: footer
     `Dialog` dirender apa adanya tanpa RDialog.Close, jadi tombol Simpan
     menyimpan TAPI dialognya tetap terbuka. Di halaman uang akibatnya bukan
     cuma canggung — staf yang mengira belum tersimpan menekan Simpan sekali
     lagi dan pengeluarannya tercatat dua kali, lalu laba bersih proyeknya
     salah. Pola ini sama dengan Direktori dan Tim. */
  const [buka, setBuka] = useState(false);

  /* Kategori yang memang bayaran ke ORANG. Di luar keduanya, dropdown nama
     disembunyikan — menanyakan "untuk siapa" pada tagihan listrik cuma
     membuat isian yang selalu dikosongkan. */
  const perluOrang = kategori === "freelancer" || kategori === "prinsipal";
  const siap = idProyek && label.trim().length >= 2 && (nominal ?? 0) > 0;

  async function simpan() {
    if (!siap) return;
    setKirim(true);
    try {
      await catatBiaya({
        projectId: idProyek, label: label.trim(), category: kategori,
        amount: nominal as number, incurredOn: tanggal || undefined,
        teamMemberId: perluOrang ? (orang || null) : null,
      });
      setLabel(""); setNominal(null); setTanggal(""); setOrang(""); setIdProyek("");
      setBuka(false);
      onSelesai();
      toast({ judul: "Pengeluaran tercatat", nada: "sukses" });
    } catch (e) {
      toast({ judul: "Gagal mencatat", keterangan: (e as Error).message, nada: "gagal" });
    } finally {
      setKirim(false);
    }
  }

  return (
    <Dialog
      open={buka}
      onOpenChange={setBuka}
      title="Catat pengeluaran"
      description="Pilih proyeknya di sini — tidak perlu membuka halaman proyeknya dulu."
      trigger={
        <button type="button" className="btn btn--primary btn--lift">
          <Icon name="plus" size={15} />Catat pengeluaran
        </button>
      }
      footer={
        <button type="button" className="btn btn--primary" disabled={!siap || kirim} onClick={simpan}>
          {kirim && <span className="spinner spinner--sm spinner--on-action" />}Simpan
        </button>
      }
    >
      <div className="stack">
        <div className="field">
          <label className="field__label" htmlFor="bi-proyek">
            Proyek<span className="field__req" aria-hidden="true">*</span>
          </label>
          <Select
            id="bi-proyek"
            ariaLabel="Proyek"
            value={idProyek}
            onValueChange={setIdProyek}
            placeholder="Pilih proyek…"
            options={proyek.map((p) => ({ value: p.id, label: p.title }))}
          />
        </div>

        <div className="spec-grid spec-grid--rapat spec-grid--tiga">
          <div className="field">
            <label className="field__label" htmlFor="bi-label">Label</label>
            <input id="bi-label" className="input" value={label}
              onChange={(e) => setLabel(e.target.value)} placeholder="Contoh: Fee gambar kerja" />
          </div>
          <div className="field">
            <label className="field__label" htmlFor="bi-kategori">Kategori</label>
            <Select id="bi-kategori" ariaLabel="Kategori biaya" value={kategori}
              onValueChange={setKategori}
              options={Object.entries(KATEGORI).map(([value, k]) => ({ value, label: k.label }))} />
          </div>
          <div className="field">
            <label className="field__label" htmlFor="bi-nominal">Nominal</label>
            <InputRupiah id="bi-nominal" value={nominal} onChange={setNominal} />
          </div>
        </div>

        {perluOrang && (
          <div className="field">
            <label className="field__label" htmlFor="bi-orang">Untuk siapa</label>
            <Select
              id="bi-orang"
              ariaLabel="Penerima fee"
              value={orang}
              onValueChange={setOrang}
              placeholder="Belum ditentukan"
              /* Yang sudah tidak aktif tidak ditawarkan lagi, TAPI namanya
                 tetap tercetak di biaya lama — disembunyikan dari dropdown,
                 bukan dihapus dari riwayat. */
              options={tim.filter((t) => t.active).map((t) => ({
                value: t.id, label: t.role ? `${t.name} — ${t.role}` : t.name,
              }))}
            />
            <p className="field__help">
              Inilah yang membuat halaman Fee bisa menjawab “orang ini sudah
              terima berapa”. Boleh dikosongkan.
            </p>
          </div>
        )}

        <div className="field">
          <label className="field__label" htmlFor="bi-tanggal">Tanggal biaya</label>
          <input id="bi-tanggal" className="input input--ringkas" type="date" value={tanggal}
            onChange={(e) => setTanggal(e.target.value)}
            max={new Date().toISOString().slice(0, 10)} />
          <p className="field__help">Kosongkan kalau hari ini.</p>
        </div>
      </div>
    </Dialog>
  );
}

export function FinancePanel() {
  return (
    <RequireAuth skeleton={<Rangka />}>
      <ToastProvider><Isi /></ToastProvider>
    </RequireAuth>
  );
}
