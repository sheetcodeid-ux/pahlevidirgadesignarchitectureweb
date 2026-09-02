import { useEffect, useState } from "react";
import { Icon } from "../ui/Icon";
import { SkeletonKartu, SkeletonStat } from "../ui/Skeleton";
import { DataTable, type Kolom } from "../ui/data/DataTable";
import {
  AreaChart, KartuMini, KartuPapan, StackedBarChart, StripMetrik,
  bandingkan, type DeretTumpuk, type Metrik, type Perubahan,
} from "../ui/data/Dashboard";
import { RequireAuth } from "./RequireAuth";
import { ambilBulanan, type BarisBulanan, bacaCache, tulisCache } from "../../lib/admin";
import { proyekAktif, onProyekAktif } from "../../lib/proyekAktif";
import { formatRupiah } from "../../lib/format";

const RENTANG = [
  { id: "6", label: "6 bulan" },
  { id: "12", label: "12 bulan" },
  { id: "24", label: "24 bulan" },
] as const;

function rupiah(n: number) {
  return n < 0 ? `−${formatRupiah(Math.abs(n))}` : formatRupiah(n);
}

function rupiahRingkas(n: number) {
  const tanda = n < 0 ? "−" : "";
  const a = Math.abs(n);
  if (a >= 1_000_000_000) return `${tanda}Rp${(a / 1_000_000_000).toFixed(1).replace(".", ",")} M`;
  if (a >= 1_000_000) return `${tanda}Rp${Math.round(a / 1_000_000)} jt`;
  if (a >= 1_000) return `${tanda}Rp${Math.round(a / 1_000)} rb`;
  return `${tanda}Rp${a}`;
}

/** "2026-08" → "Agu 2026". Bulan penuh terlalu lebar untuk sumbu grafik. */
function namaBulan(iso: string) {
  const [th, bl] = iso.split("-");
  return `${new Date(Number(th), Number(bl) - 1, 1).toLocaleDateString("id-ID", { month: "short" })} ${th}`;
}

/** Bulan terakhir dibanding bulan sebelumnya. null kalau tidak ada pembanding. */
function delta(baris: BarisBulanan[], ambil: (b: BarisBulanan) => number): Perubahan | null {
  if (baris.length < 2) return null;
  return bandingkan(ambil(baris[baris.length - 1]), ambil(baris[baris.length - 2]));
}

const KOLOM: Kolom<BarisBulanan>[] = [
  { judul: "Bulan", render: (b) => <span className="item__title">{namaBulan(b.bulan)}</span> },
  { judul: "Kas masuk", kelas: "table__num", lebar: "7rem", render: (b) => formatRupiah(b.kasMasuk) },
  { judul: "Biaya", kelas: "table__num", lebar: "7rem", render: (b) => formatRupiah(b.biaya) },
  {
    judul: "Laba bersih",
    kelas: "table__num",
    lebar: "7rem",
    render: (b) => <span className={b.labaBersih < 0 ? "angka-minus" : undefined}>{rupiah(b.labaBersih)}</span>,
  },
  { judul: "Proyek", kelas: "table__num", lebar: "3.5rem", render: (b) => b.proyekAktif },
];

function Isi() {
  const [aktif, setAktif] = useState<string | null>(null);
  const [siap, setSiap] = useState(false);
  const [rentang, setRentang] = useState("12");
  const [data, setData] = useState<BarisBulanan[] | null>(null);
  const [galat, setGalat] = useState<string | null>(null);

  useEffect(() => {
    setAktif(proyekAktif());
    setSiap(true);
    return onProyekAktif(setAktif);
  }, []);

  useEffect(() => {
    if (!siap) return;
    const kunci = `bulanan:${aktif ?? "semua"}:${rentang}`;
    setData(bacaCache<BarisBulanan[]>(kunci) ?? null);

    ambilBulanan(aktif, Number(rentang))
      .then((d) => { tulisCache(kunci, d); setData(d); })
      .catch((e) => setGalat((e as Error).message));
  }, [aktif, rentang, siap]);

  if (galat) {
    return (
      <div className="empty">
        <span className="icon-tile"><Icon name="alert" size={20} /></span>
        <span className="t-subheading">{galat}</span>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="stack" style={{ gap: "var(--space-5)" }}>
        <SkeletonStat jumlah={4} />
        <SkeletonKartu ikon="finance" />
      </div>
    );
  }

  const totalKas = data.reduce((s, b) => s + b.kasMasuk, 0);
  const totalBiaya = data.reduce((s, b) => s + b.biaya, 0);
  const totalLaba = totalKas - totalBiaya;
  // Rata-rata dihitung dari bulan yang PUNYA data, bukan dari panjang rentang:
  // membagi dengan 12 saat cuma 3 bulan yang terisi mengecilkan angkanya empat
  // kali lipat, dan itu bukan rata-rata apa pun.
  const rerata = data.length > 0 ? totalLaba / data.length : 0;
  const terbaik = data.reduce<BarisBulanan | null>((a, b) => (!a || b.labaBersih > a.labaBersih ? b : a), null);
  const terburuk = data.reduce<BarisBulanan | null>((a, b) => (!a || b.labaBersih < a.labaBersih ? b : a), null);
  const bulanRugi = data.filter((b) => b.labaBersih < 0).length;

  const label = data.map((b) => namaBulan(b.bulan));

  // Kas masuk NAIK, biaya TURUN dari garis nol. Menumpuk keduanya ke atas
  // akan menyembunyikan bahwa mereka berlawanan arah — dan justru selisih
  // itulah laba bersihnya.
  const deret: DeretTumpuk[] = [
    { nama: "Kas masuk", warna: "var(--chart-1)", nilai: data.map((b) => b.kasMasuk) },
    { nama: "Biaya", warna: "var(--chart-2)", nilai: data.map((b) => -b.biaya) },
  ];

  const metrik: Metrik[] = [
    { label: "Total kas masuk", nilai: formatRupiah(totalKas), delta: delta(data, (b) => b.kasMasuk), deltaFormat: rupiahRingkas },
    { label: "Total biaya", nilai: formatRupiah(totalBiaya), delta: delta(data, (b) => b.biaya), deltaTerbalik: true, deltaFormat: rupiahRingkas },
    { label: "Laba bersih", nilai: rupiah(totalLaba), minus: totalLaba < 0, delta: delta(data, (b) => b.labaBersih), deltaFormat: rupiahRingkas },
    // Dibulatkan ke ribuan: "−Rp1.857.143" menjanjikan ketelitian yang tidak
    // dimiliki angka rata-rata, dan tujuh digit sulit dibaca sekilas.
    { label: "Rata-rata per bulan", nilai: rupiah(Math.round(rerata / 1000) * 1000), minus: rerata < 0 },
  ];

  const tabRentang = (
    <div className="segmented" role="group" aria-label="Rentang bulan">
      {RENTANG.map((r) => (
        <button key={r.id} type="button" className="segmented__opt"
          aria-pressed={rentang === r.id} onClick={() => setRentang(r.id)}>
          {r.label}
        </button>
      ))}
    </div>
  );

  if (data.length === 0) {
    return (
      <div className="stack" style={{ gap: "var(--space-5)" }}>
        <div className="row row--between" style={{ flexWrap: "wrap", gap: "var(--space-3)" }}>
          <span className="t-muted">{aktif ? "Hanya proyek yang dipilih di bilah atas." : "Seluruh proyek studio."}</span>
          {tabRentang}
        </div>
        <div className="empty">
          <span className="icon-tile"><Icon name="finance" size={20} /></span>
          <span className="t-subheading">Belum ada pergerakan uang di rentang ini</span>
          <p className="t-muted">
            Analisis bulanan terisi begitu ada invoice yang ditandai lunas atau biaya yang dicatat.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="stack" style={{ gap: "var(--space-5)" }}>
      <div className="lingkup">
        <span className="lingkup__nama">
          <Icon name={aktif ? "project" : "dashboard"} size={15} />
          {aktif ? "Satu proyek" : "Semua Proyek"}
        </span>
        <span className="lingkup__nilai">{data.length} bulan berdata</span>
        <span className="lingkup__dorong">{tabRentang}</span>
      </div>

      <StripMetrik metrik={metrik} />

      <KartuPapan
        judul="Uang masuk dan keluar"
        nilai={rupiah(data[data.length - 1].labaBersih)}
        delta={delta(data, (b) => b.labaBersih)}
        deltaFormat={rupiahRingkas}
        kanan={
          <span className="chart__legend">
            {deret.map((d) => (
              <span className="chart__legend-item" key={d.nama}>
                <span className="chart__swatch" style={{ background: d.warna }} />{d.nama}
              </span>
            ))}
          </span>
        }
        anak={<StackedBarChart deret={deret} label={label} format={rupiahRingkas} />}
      />

      <div className="spec-grid spec-grid--dua">
        <KartuPapan
          judul="Laba bersih per bulan"
          anak={
            <AreaChart
              titik={data.map((b) => b.labaBersih)}
              label={label}
              judulNilai="Laba bersih"
              format={rupiahRingkas}
              warna="var(--chart-3)"
            />
          }
        />
        <KartuPapan
          judul="Proyek yang bergerak"
          anak={
            <AreaChart
              titik={data.map((b) => b.proyekAktif)}
              label={label}
              judulNilai="Proyek aktif"
              format={(v) => String(Math.round(v))}
              warna="var(--chart-1)"
            />
          }
        />
      </div>

      <div className="spec-grid spec-grid--tiga-tetap">
        <KartuMini
          judul="Bulan terbaik"
          keterangan="Laba bersih tertinggi"
          nilai={terbaik ? namaBulan(terbaik.bulan) : "—"}
          badge={terbaik ? rupiah(terbaik.labaBersih) : undefined}
          badgeKelas="badge--success"
        />
        <KartuMini
          judul="Bulan terberat"
          keterangan="Laba bersih terendah"
          nilai={terburuk ? namaBulan(terburuk.bulan) : "—"}
          badge={terburuk ? rupiah(terburuk.labaBersih) : undefined}
          badgeKelas={terburuk && terburuk.labaBersih < 0 ? "badge--brand" : "badge--warn"}
        />
        <KartuMini
          judul="Bulan rugi"
          keterangan="Biaya melebihi kas masuk"
          nilai={`${bulanRugi} dari ${data.length}`}
          badge={bulanRugi === 0 ? "Tidak ada" : bulanRugi > data.length / 2 ? "Sering" : "Sesekali"}
          badgeKelas={bulanRugi === 0 ? "badge--success" : bulanRugi > data.length / 2 ? "badge--brand" : "badge--warn"}
        />
      </div>

      <DataTable
        data={data}
        kunci={(b) => b.bulan}
        kolom={KOLOM}
        cariPada={(b) => [namaBulan(b.bulan)]}
        placeholderCari="Cari bulan…"
        labelCari="Cari bulan"
        satuan="bulan"
        barisSkeleton={data.length}
        kosong={{ ikon: "finance", judul: "Tidak ada bulan yang cocok", keterangan: "Coba kata kunci lain." }}
      />
    </div>
  );
}

export function MonthlyPanel() {
  return <RequireAuth skeleton={
      <div className="stack" style={{ gap: "var(--space-5)" }}>
        <SkeletonStat jumlah={4} />
        <SkeletonKartu ikon="finance" />
      </div>
    }><Isi /></RequireAuth>;
}
