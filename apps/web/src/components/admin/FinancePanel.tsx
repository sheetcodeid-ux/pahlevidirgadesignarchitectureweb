import { useEffect, useState } from "react";
import { Icon } from "../ui/Icon";
import { SkeletonKartu, SkeletonStat } from "../ui/Skeleton";
import { BarChart } from "../ui/data/Chart";
import { DataTable, type Kolom } from "../ui/data/DataTable";
import { RequireAuth } from "./RequireAuth";
import { ambilRingkasanKeuangan, type FinanceOverview, bacaCache, tulisCache} from "../../lib/admin";
import { proyekAktif, onProyekAktif } from "../../lib/proyekAktif";
import { formatRupiah } from "../../lib/format";

type BarisProyek = FinanceOverview["proyek"][number];

/** Rupiah minus ditulis dengan tanda minus di depan Rp, bukan di tengah. */
function rupiahBertanda(n: number) {
  return n < 0 ? `−${formatRupiah(Math.abs(n))}` : formatRupiah(n);
}

const KOLOM: Kolom<BarisProyek>[] = [
  {
    judul: "Proyek",
    render: (p) => (
      <a href={`/admin/proyek/edit?id=${p.projectId}`} className="item__title" style={{ textDecoration: "none" }}>
        {p.projectTitle}
      </a>
    ),
  },
  { judul: "Kontrak", kelas: "table__num", lebar: "7rem", render: (p) => (p.contractValue !== null ? formatRupiah(p.contractValue) : "—") },
  { judul: "Diterima", kelas: "table__num", lebar: "7rem", render: (p) => formatRupiah(p.received) },
  { judul: "Biaya (HPP)", kelas: "table__num", lebar: "7rem", render: (p) => formatRupiah(p.costsTotal) },
  {
    // Inilah angka yang diminta pemilik: kas yang benar-benar masuk dikurangi
    // biaya. Yang minus diberi warna merah — bukan supaya dramatis, tapi
    // karena "−Rp92.000.000" dan "Rp92.000.000" terlalu mirip saat dipindai.
    judul: "Laba bersih",
    kelas: "table__num",
    lebar: "7rem",
    render: (p) => (
      <span className={p.labaBersih < 0 ? "angka-minus" : undefined}>{rupiahBertanda(p.labaBersih)}</span>
    ),
  },
  {
    judul: "Margin",
    kelas: "table__num",
    lebar: "3.5rem",
    render: (p) =>
      p.marginPct !== null ? (
        <span className={`badge ${p.marginPct >= 35 ? "badge--success" : "badge--warn"}`}>
          {p.marginPct.toFixed(0)}%
        </span>
      ) : "—",
  },
];

function Kartu({ label, nilai, ikon, nada, catatan }: {
  label: string; nilai: string; ikon: Parameters<typeof Icon>[0]["name"];
  nada?: "minus"; catatan?: string;
}) {
  return (
    <div className="card stat">
      <div className="stat__head">
        <span className="icon-tile"><Icon name={ikon} size={18} /></span>
        <span className="t-label">{label}</span>
      </div>
      <span className={`t-numeral stat__nilai${nada === "minus" ? " angka-minus" : ""}`}>{nilai}</span>
      {catatan && <span className="t-muted">{catatan}</span>}
    </div>
  );
}

function Isi() {
  // Proyek aktif dibaca setelah mount — localStorage tidak ada saat build,
  // dan membacanya saat render membuat hidrasi pertama beda dari HTML-nya.
  const [aktif, setAktif] = useState<string | null>(null);
  const [siap, setSiap] = useState(false);
  const [data, setData] = useState<FinanceOverview | null>(null);
  const [galat, setGalat] = useState<string | null>(null);

  useEffect(() => {
    setAktif(proyekAktif());
    setSiap(true);
    return onProyekAktif(setAktif);
  }, []);

  useEffect(() => {
    if (!siap) return;
    // Kunci cache ikut proyeknya: "Semua" dan satu proyek adalah dua angka
    // berbeda, dan menyatukannya menampilkan angka proyek lain sepersekian
    // detik sebelum yang benar tiba.
    const kunci = `keuangan:${aktif ?? "semua"}`;
    const tersimpan = bacaCache<FinanceOverview>(kunci);
    if (tersimpan) setData(tersimpan);
    else setData(null);

    ambilRingkasanKeuangan(aktif)
      .then((d) => { tulisCache(kunci, d); setData(d); })
      .catch((e) => setGalat((e as Error).message));
  }, [aktif, siap]);

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
        <SkeletonStat jumlah={4} />
        <SkeletonKartu ikon="finance" />
      </div>
    );
  }

  const judul = aktif ? data.proyek.find((p) => p.projectId === aktif)?.projectTitle : null;

  return (
    <div className="stack" style={{ gap: "var(--space-6)" }}>
      {/* Spanduk lingkup: tanpa ini, angka satu proyek mudah terbaca sebagai
          angka seluruh studio — dan itu salah baca yang mahal. */}
      <div className="alert alert--info" role="status">
        <span className="alert__icon"><Icon name="info" size={18} /></span>
        <span className="alert__body">
          <span className="alert__title">
            {judul ? `Angka di bawah hanya untuk ${judul}` : "Angka di bawah mencakup seluruh proyek studio"}
          </span>
          <span className="alert__text">
            Ganti lingkupnya lewat pemilih proyek di bilah atas — pilih “Semua Proyek” untuk kembali ke seluruh studio.
          </span>
        </span>
      </div>

      <div className="spec-grid spec-grid--empat">
        <Kartu label="Kas masuk" nilai={formatRupiah(data.kasMasuk)} ikon="finance"
          catatan="Invoice berstatus lunas" />
        <Kartu label="Biaya (HPP)" nilai={formatRupiah(data.totalBiaya)} ikon="checklist"
          catatan="Seluruh biaya tercatat" />
        <Kartu label="Laba bersih" nilai={rupiahBertanda(data.labaBersih)} ikon="finance"
          nada={data.labaBersih < 0 ? "minus" : undefined}
          catatan="Kas masuk dikurangi biaya" />
        <Kartu label="Piutang" nilai={formatRupiah(data.piutang)} ikon="clock"
          catatan="Invoice terbit, belum dibayar" />
      </div>

      {/* Margin proyeksi dipisah dari kartu kas: ia menjawab pertanyaan lain
          ("kalau semuanya dibayar"), dan menaruhnya sebaris dengan angka kas
          membuat keduanya terbaca sebagai satu jenis angka. */}
      <div className="spec-grid spec-grid--tiga-tetap">
        <Kartu label="Margin rata-rata (proyeksi)" ikon="finance"
          nilai={data.marginRataRata !== null ? `${data.marginRataRata.toFixed(0)}%` : "—"}
          catatan="Kalau seluruh kontrak dibayar penuh" />
        <Kartu label="Nilai kontrak" nilai={formatRupiah(data.totalKontrak)} ikon="document"
          catatan="Total yang disepakati" />
        <Kartu label="Belum diterima" nilai={formatRupiah(Math.max(0, data.totalKontrak - data.kasMasuk))} ikon="clock"
          catatan="Kontrak dikurangi kas masuk" />
      </div>

      {data.proyek.length === 0 ? (
        <div className="empty">
          <span className="icon-tile"><Icon name="finance" size={20} /></span>
          <span className="t-subheading">Belum ada proyek dengan nilai kontrak</span>
          <p className="t-muted">Isi nilai kontrak di tab Keuangan pada halaman tiap proyek.</p>
        </div>
      ) : (
        <>
          {/* Dua grafik, jadi dua kolom. .spec-grid bawaan menghitung
              berapa yang MUAT dan memberi tiga di lebar ini — kolom ketiganya
              kosong dan kedua grafik jadi menggantung di kiri. */}
          <div className="spec-grid spec-grid--dua">
            <div className="spec-demo">
              <BarChart
                title="Kas diterima per proyek"
                unit=" jt"
                data={data.proyek.map((p) => ({ label: p.projectTitle, value: Math.round(p.received / 1_000_000) }))}
              />
            </div>
            <div className="spec-demo">
              <BarChart
                title="Laba bersih per proyek"
                unit=" jt"
                data={data.proyek.map((p) => ({ label: p.projectTitle, value: Math.round(p.labaBersih / 1_000_000) }))}
              />
            </div>
          </div>

          <DataTable
            data={data.proyek}
            kunci={(p) => p.projectId}
            kolom={KOLOM}
            cariPada={(p) => [p.projectTitle]}
            placeholderCari="Cari proyek…"
            labelCari="Cari proyek"
            satuan="proyek"
            barisSkeleton={data.proyek.length}
            kosong={{
              ikon: "finance",
              judul: "Belum ada proyek dengan nilai kontrak",
              keterangan: "Isi nilai kontrak di tab Keuangan pada halaman tiap proyek.",
            }}
          />
        </>
      )}
    </div>
  );
}

export function FinancePanel() {
  return <RequireAuth skeleton={
      <div className="stack" style={{ gap: "var(--space-6)" }}>
        <SkeletonStat jumlah={4} />
        <SkeletonKartu ikon="finance" />
      </div>
    }><Isi /></RequireAuth>;
}
