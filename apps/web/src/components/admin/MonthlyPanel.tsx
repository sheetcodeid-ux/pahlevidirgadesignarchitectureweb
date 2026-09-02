import { useEffect, useState } from "react";
import { Icon } from "../ui/Icon";
import { SkeletonKartu, SkeletonStat } from "../ui/Skeleton";
import { BarChart, LineChart } from "../ui/data/Chart";
import { DataTable, type Kolom } from "../ui/data/DataTable";
import { Select } from "../ui/overlay/Select";
import { RequireAuth } from "./RequireAuth";
import { ambilBulanan, type BarisBulanan, bacaCache, tulisCache } from "../../lib/admin";
import { proyekAktif, onProyekAktif } from "../../lib/proyekAktif";
import { formatRupiah } from "../../lib/format";

const RENTANG: { value: string; label: string }[] = [
  { value: "6", label: "6 bulan terakhir" },
  { value: "12", label: "12 bulan terakhir" },
  { value: "24", label: "24 bulan terakhir" },
];

function rupiahBertanda(n: number) {
  return n < 0 ? `−${formatRupiah(Math.abs(n))}` : formatRupiah(n);
}

/** "2026-08" → "Agu 2026". Bulan penuh terlalu lebar untuk sumbu grafik. */
function namaBulan(iso: string) {
  const [th, bl] = iso.split("-");
  const nama = new Date(Number(th), Number(bl) - 1, 1)
    .toLocaleDateString("id-ID", { month: "short" });
  return `${nama} ${th}`;
}

const KOLOM: Kolom<BarisBulanan>[] = [
  { judul: "Bulan", render: (b) => <span className="item__title">{namaBulan(b.bulan)}</span> },
  { judul: "Kas masuk", kelas: "table__num", lebar: "7rem", render: (b) => formatRupiah(b.kasMasuk) },
  { judul: "Biaya", kelas: "table__num", lebar: "7rem", render: (b) => formatRupiah(b.biaya) },
  {
    judul: "Laba bersih",
    kelas: "table__num",
    lebar: "7rem",
    render: (b) => (
      <span className={b.labaBersih < 0 ? "angka-minus" : undefined}>{rupiahBertanda(b.labaBersih)}</span>
    ),
  },
  {
    judul: "Proyek",
    kelas: "table__num",
    lebar: "3.5rem",
    render: (b) => b.proyekAktif,
  },
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
    const tersimpan = bacaCache<BarisBulanan[]>(kunci);
    setData(tersimpan ?? null);

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
      <div className="stack" style={{ gap: "var(--space-6)" }}>
        <SkeletonStat jumlah={3} />
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

  return (
    <div className="stack" style={{ gap: "var(--space-6)" }}>
      <div className="row row--between" style={{ flexWrap: "wrap", gap: "var(--space-3)" }}>
        <span className="t-muted">
          {aktif ? "Hanya proyek yang dipilih di bilah atas." : "Seluruh proyek studio."}
          {" "}Tanggalnya diambil dari kapan uangnya bergerak, bukan kapan barisnya diketik.
        </span>
        <div style={{ minWidth: "13rem" }}>
          <Select ariaLabel="Rentang bulan" options={RENTANG} value={rentang} onValueChange={setRentang} />
        </div>
      </div>

      {data.length === 0 ? (
        <div className="empty">
          <span className="icon-tile"><Icon name="finance" size={20} /></span>
          <span className="t-subheading">Belum ada pergerakan uang di rentang ini</span>
          <p className="t-muted">
            Analisis bulanan terisi begitu ada invoice yang ditandai lunas atau biaya yang dicatat.
          </p>
        </div>
      ) : (
        <>
          <div className="spec-grid spec-grid--empat">
            {[
              { label: "Total kas masuk", nilai: formatRupiah(totalKas), ikon: "finance" as const, catatan: `${data.length} bulan berdata` },
              { label: "Total biaya", nilai: formatRupiah(totalBiaya), ikon: "checklist" as const, catatan: "Seluruh biaya di rentang ini" },
              { label: "Laba bersih", nilai: rupiahBertanda(totalLaba), ikon: "finance" as const, catatan: `Rata-rata ${rupiahBertanda(Math.round(rerata))} per bulan`, minus: totalLaba < 0 },
              { label: "Bulan terbaik", nilai: terbaik ? namaBulan(terbaik.bulan) : "—", ikon: "star" as const, catatan: terbaik ? rupiahBertanda(terbaik.labaBersih) : undefined },
            ].map((s) => (
              <div className="card stat" key={s.label}>
                <div className="stat__head">
                  <span className="icon-tile"><Icon name={s.ikon} size={18} /></span>
                  <span className="t-label">{s.label}</span>
                </div>
                <span className={`t-numeral stat__nilai${s.minus ? " angka-minus" : ""}`}>{s.nilai}</span>
                {s.catatan && <span className="t-muted">{s.catatan}</span>}
              </div>
            ))}
          </div>

          {/* Dua grafik, jadi dua kolom. .spec-grid bawaan menghitung
              berapa yang MUAT dan memberi tiga di lebar ini — kolom ketiganya
              kosong dan kedua grafik jadi menggantung di kiri. */}
          <div className="spec-grid spec-grid--dua">
            <div className="spec-demo">
              <LineChart
                title="Kas masuk vs biaya"
                labels={data.map((b) => namaBulan(b.bulan))}
                series={[
                  { name: "Kas masuk", color: "var(--chart-1)", points: data.map((b) => Math.round(b.kasMasuk / 1_000_000)) },
                  { name: "Biaya", color: "var(--chart-2)", points: data.map((b) => Math.round(b.biaya / 1_000_000)) },
                ]}
              />
              <p className="field__help">Dalam juta rupiah. Dua deret di satu sumbu karena satuannya sama.</p>
            </div>

            <div className="spec-demo">
              <BarChart
                title="Proyek yang bergerak per bulan"
                data={data.map((b) => ({ label: namaBulan(b.bulan), value: b.proyekAktif }))}
              />
              <p className="field__help">
                Proyek yang punya kas masuk atau biaya di bulan itu — bukan yang sekadar masih terbuka.
              </p>
            </div>
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
        </>
      )}
    </div>
  );
}

export function MonthlyPanel() {
  return <RequireAuth skeleton={
      <div className="stack" style={{ gap: "var(--space-6)" }}>
        <SkeletonStat jumlah={3} />
        <SkeletonKartu ikon="finance" />
      </div>
    }><Isi /></RequireAuth>;
}
