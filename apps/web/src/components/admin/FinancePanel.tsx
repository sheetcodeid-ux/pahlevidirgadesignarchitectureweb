import { useEffect, useMemo, useState } from "react";
import { Icon } from "../ui/Icon";
import { KartuAngka } from "../ui/data/KartuAngka";
import { ChartArusKas, type TitikArus } from "../ui/data/ChartArusKas";
import { KartuDonat, type IrisDonat } from "../ui/data/KartuDonat";
import { ChartBandingTahun, type TitikBanding } from "../ui/data/ChartBandingTahun";
import { DataTable, type Kolom } from "../ui/data/DataTable";
import { RequireAuth } from "./RequireAuth";
import {
  ambilRingkasanKeuangan, ambilBulanan, bacaCache, tulisCache,
  type BarisBulanan, type FinanceOverview, type FinanceOverviewRow,
} from "../../lib/admin";
import { proyekAktif, onProyekAktif } from "../../lib/proyekAktif";
import { formatRupiah } from "../../lib/format";

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

function unduhCsv(nama: string, baris: string[][]) {
  const isi = baris
    .map((r) => r.map((sel) => `"${String(sel).replace(/"/g, '""')}"`).join(";"))
    .join("\r\n");
  // BOM supaya Excel berbahasa Indonesia membaca UTF-8 dengan benar; tanpa
  // ini "Rp" dan tanda minus tipografis tampil sebagai sampah.
  const blob = new Blob([`﻿${isi}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nama;
  a.click();
  URL.revokeObjectURL(url);
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

type Tab = "ringkasan" | "proyek";

function Isi() {
  const [proyekId, setProyekId] = useState<string | null>(() => proyekAktif());
  const [tab, setTab] = useState<Tab>("ringkasan");
  const [rentang, setRentang] = useState("12");

  const kunci = `keuangan:${proyekId ?? "semua"}`;
  const kunciBulan = `keuangan-bulan:${proyekId ?? "semua"}`;

  const [ringkas, setRingkas] = useState<FinanceOverview | null>(() => bacaCache<FinanceOverview>(kunci));
  const [bulanan, setBulanan] = useState<BarisBulanan[] | null>(() => bacaCache<BarisBulanan[]>(kunciBulan));

  useEffect(() => onProyekAktif(setProyekId), []);

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
    { judul: "Marjin", kelas: "table__num", lebar: "5rem",
      render: (b) => (b.marginPct === null ? "—" : `${b.marginPct.toFixed(1).replace(".", ",")}%`) },
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
        </div>
        <button type="button" className="btn btn--secondary keu__ekspor" onClick={ekspor}>
          <Icon name="download" size={15} />Export
        </button>
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

          <p className="keu__catatan">
            Tiga kartu pertama membandingkan <b>bulan ini dengan bulan lalu</b>; angka besarnya
            sendiri adalah total sejak awal. Laba bersih dihitung dari kas yang benar-benar
            masuk, bukan nilai kontrak.
          </p>

          <div className="keu__baris2">
            <ChartArusKas
              judul="Analisis Arus Kas"
              seri={[
                { kunci: "kas", label: "Kas masuk", warna: "var(--success)", gaya: "penuh", isi: true },
                { kunci: "beban", label: "Beban", warna: "var(--brand)", gaya: "putus" },
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
      ) : (
        <DataTable
          data={ringkas.proyek}
          kunci={(b) => b.projectId}
          kolom={kolom}
          cariPada={(b) => [b.projectTitle]}
          placeholderCari="Cari proyek…"
          labelCari="Cari proyek"
          satuan="proyek"
          barisSkeleton={5}
          kosong={{
            ikon: "finance",
            judul: "Belum ada proyek berkontrak",
            keterangan: "Isi Nilai Kontrak di halaman proyek supaya angkanya muncul di sini.",
          }}
        />
      )}
    </div>
  );
}

export function FinancePanel() {
  return (
    <RequireAuth skeleton={<Rangka />}>
      <Isi />
    </RequireAuth>
  );
}
