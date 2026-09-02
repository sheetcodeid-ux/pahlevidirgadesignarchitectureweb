import { useEffect, useState } from "react";
import { Icon } from "../ui/Icon";
import { SkeletonKartu, SkeletonStat } from "../ui/Skeleton";
import { DataTable, type Kolom } from "../ui/data/DataTable";
import {
  AreaChart, Delta, Gauge, KartuMini, KartuPapan, Sparkline, StripMetrik,
  bandingkan, type Metrik, type Perubahan,
} from "../ui/data/Dashboard";
import { RequireAuth } from "./RequireAuth";
import {
  ambilRingkasanKeuangan, ambilBulanan, type FinanceOverview, type BarisBulanan,
  bacaCache, tulisCache,
} from "../../lib/admin";
import { proyekAktif, onProyekAktif } from "../../lib/proyekAktif";
import { formatRupiah } from "../../lib/format";

type BarisProyek = FinanceOverview["proyek"][number];

/** Rupiah minus ditulis dengan tanda minus di depan Rp, bukan di tengah. */
function rupiah(n: number) {
  return n < 0 ? `−${formatRupiah(Math.abs(n))}` : formatRupiah(n);
}

/** Bentuk pendek untuk sumbu grafik: Rp92 jt, Rp1,4 M. */
function rupiahRingkas(n: number) {
  const tanda = n < 0 ? "−" : "";
  const a = Math.abs(n);
  if (a >= 1_000_000_000) return `${tanda}Rp${(a / 1_000_000_000).toFixed(1).replace(".", ",")} M`;
  if (a >= 1_000_000) return `${tanda}Rp${Math.round(a / 1_000_000)} jt`;
  if (a >= 1_000) return `${tanda}Rp${Math.round(a / 1_000)} rb`;
  return `${tanda}Rp${a}`;
}

function namaBulan(iso: string) {
  const [th, bl] = iso.split("-");
  return `${new Date(Number(th), Number(bl) - 1, 1).toLocaleDateString("id-ID", { month: "short" })} ${th}`;
}

/** Bulan terakhir dibanding bulan sebelumnya. null kalau tidak ada pembanding. */
function delta(baris: BarisBulanan[] | null, ambil: (b: BarisBulanan) => number): Perubahan | null {
  if (!baris || baris.length < 2) return null;
  return bandingkan(ambil(baris[baris.length - 1]), ambil(baris[baris.length - 2]));
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
    judul: "Laba bersih",
    kelas: "table__num",
    lebar: "7rem",
    render: (p) => <span className={p.labaBersih < 0 ? "angka-minus" : undefined}>{rupiah(p.labaBersih)}</span>,
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

/** Deret yang bisa dipilih di kaki grafik besar. */
const DERET = [
  { id: "laba", label: "Laba bersih", ambil: (b: BarisBulanan) => b.labaBersih, warna: "var(--chart-3)" },
  { id: "kas", label: "Kas masuk", ambil: (b: BarisBulanan) => b.kasMasuk, warna: "var(--chart-1)" },
  { id: "biaya", label: "Biaya", ambil: (b: BarisBulanan) => b.biaya, warna: "var(--chart-2)" },
] as const;

function Isi() {
  // Proyek aktif dibaca setelah mount — localStorage tidak ada saat build, dan
  // membacanya saat render membuat hidrasi pertama beda dari HTML-nya.
  const [aktif, setAktif] = useState<string | null>(null);
  const [siap, setSiap] = useState(false);
  const [data, setData] = useState<FinanceOverview | null>(null);
  const [bulan, setBulan] = useState<BarisBulanan[] | null>(null);
  const [deret, setDeret] = useState<string>("laba");
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
    const k = aktif ?? "semua";
    setData(bacaCache<FinanceOverview>(`keuangan:${k}`) ?? null);
    setBulan(bacaCache<BarisBulanan[]>(`bulanan:${k}:12`) ?? null);

    ambilRingkasanKeuangan(aktif)
      .then((d) => { tulisCache(`keuangan:${k}`, d); setData(d); })
      .catch((e) => setGalat((e as Error).message));
    // Deret bulanan dipakai dua kali: grafik besarnya, dan angka perubahan di
    // strip metrik. Tanpa ini, delta tidak punya pembanding sama sekali.
    ambilBulanan(aktif, 12)
      .then((d) => { tulisCache(`bulanan:${k}:12`, d); setBulan(d); })
      .catch(() => setBulan([]));
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
      <div className="stack" style={{ gap: "var(--space-5)" }}>
        <SkeletonStat jumlah={4} />
        <SkeletonKartu ikon="finance" />
      </div>
    );
  }

  const judul = aktif ? data.proyek.find((p) => p.projectId === aktif)?.projectTitle : null;
  const pilih = DERET.find((d) => d.id === deret) ?? DERET[0];
  const titik = (bulan ?? []).map(pilih.ambil);
  const labelBulan = (bulan ?? []).map((b) => namaBulan(b.bulan));

  const metrik: Metrik[] = [
    { label: "Kas masuk", nilai: formatRupiah(data.kasMasuk), delta: delta(bulan, (b) => b.kasMasuk), deltaFormat: rupiahRingkas },
    { label: "Biaya (HPP)", nilai: formatRupiah(data.totalBiaya), delta: delta(bulan, (b) => b.biaya), deltaTerbalik: true, deltaFormat: rupiahRingkas },
    {
      label: "Laba bersih",
      nilai: rupiah(data.labaBersih),
      minus: data.labaBersih < 0,
      delta: delta(bulan, (b) => b.labaBersih),
      deltaFormat: rupiahRingkas,
    },
    {
      label: "Terkumpul dari kontrak",
      nilai: data.totalKontrak > 0 ? `${Math.round((data.kasMasuk / data.totalKontrak) * 100)}%` : "—",
      sisipan: (
        <BilahTerkumpul
          nilai={data.kasMasuk}
          maks={data.totalKontrak}
        />
      ),
    },
  ];

  const margin = data.marginRataRata;
  const rasioTertagih = data.totalKontrak > 0 ? (data.kasMasuk / data.totalKontrak) * 100 : 0;

  return (
    <div className="stack" style={{ gap: "var(--space-5)" }}>
      {/* Pil lingkup menggantikan spanduk peringatan: lingkup bukan
          peringatan, ia keadaan — dan keadaan ditulis sebaris, bukan dalam
          kotak biru yang menuntut perhatian setiap kali halaman dibuka. */}
      <div className="lingkup">
        <span className="lingkup__nama">
          <Icon name={aktif ? "project" : "dashboard"} size={15} />
          {judul ?? "Semua Proyek"}
        </span>
        <span className="lingkup__nilai">{rupiah(data.labaBersih)}</span>
        <Delta ubah={delta(bulan, (b) => b.labaBersih)} format={rupiahRingkas} />
        <span className="lingkup__dorong t-muted" style={{ fontSize: "var(--text-xs)" }}>
          Ganti lewat pemilih proyek di bilah atas
        </span>
      </div>

      <StripMetrik metrik={metrik} />

      <KartuPapan
        judul="Arus uang per bulan"
        ke="/admin/keuangan/bulanan"
        nilai={titik.length > 0 ? rupiah(titik[titik.length - 1]) : "—"}
        delta={delta(bulan, pilih.ambil)}
        deltaTerbalik={pilih.id === "biaya"}
        deltaFormat={rupiahRingkas}
        kanan={<span className="t-muted" style={{ fontSize: "var(--text-xs)" }}>12 bulan terakhir</span>}
        anak={
          titik.length >= 2 ? (
            <AreaChart titik={titik} label={labelBulan} judulNilai={pilih.label}
              format={rupiahRingkas} warna={pilih.warna} />
          ) : (
            <div className="empty empty--sm">
              <span className="t-muted">Belum cukup bulan berdata untuk digambar.</span>
            </div>
          )
        }
        tab={
          <div className="segmented segmented--block" role="group" aria-label="Deret yang ditampilkan">
            {DERET.map((d) => (
              <button key={d.id} type="button" className="segmented__opt"
                aria-pressed={deret === d.id} onClick={() => setDeret(d.id)}>
                {d.label}
              </button>
            ))}
          </div>
        }
      />

      <div className="spec-grid spec-grid--dua">
        <KartuPapan
          judul="Margin proyeksi"
          anak={
            <>
              <Gauge nilai={margin ?? 0} judul="Margin proyeksi"
                keterangan={margin === null ? "—" : margin >= 35 ? "Sehat" : margin >= 20 ? "Tipis" : "Rugi"} />
              <p className="field__help" style={{ textAlign: "center" }}>
                Berapa untungnya kalau seluruh kontrak dibayar penuh — janji, bukan kas.
              </p>
            </>
          }
        />

        <KartuPapan
          judul="Laba bersih 12 bulan"
          nilai={rupiah((bulan ?? []).reduce((s, b) => s + b.labaBersih, 0))}
          delta={delta(bulan, (b) => b.labaBersih)}
          deltaFormat={rupiahRingkas}
          anak={
            <>
              <Sparkline titik={(bulan ?? []).map((b) => b.labaBersih)} label="Laba bersih per bulan" />
              <p className="field__help">
                Bentuknya yang bercerita, bukan angkanya. Angka per bulan ada di Analisis Bulanan.
              </p>
            </>
          }
        />
      </div>

      <div className="spec-grid spec-grid--tiga-tetap">
        <KartuMini
          judul="Tertagih"
          keterangan="Kas masuk dibanding nilai kontrak"
          nilai={`${Math.round(rasioTertagih)}%`}
          sisipan={<BilahTerkumpul nilai={data.kasMasuk} maks={data.totalKontrak} />}
        />
        <KartuMini
          judul="Piutang"
          keterangan="Invoice terbit, belum dibayar"
          nilai={formatRupiah(data.piutang)}
          badge={data.piutang > 0 ? "Menunggu" : "Bersih"}
          badgeKelas={data.piutang > 0 ? "badge--warn" : "badge--success"}
        />
        <KartuMini
          judul="Belum ditagih"
          keterangan="Kontrak dikurangi kas masuk dan piutang"
          nilai={formatRupiah(Math.max(0, data.totalKontrak - data.kasMasuk - data.piutang))}
          badge={data.totalKontrak - data.kasMasuk - data.piutang > 0 ? "Ada sisa" : "Habis"}
          badgeKelas={data.totalKontrak - data.kasMasuk - data.piutang > 0 ? "badge--info" : "badge--success"}
        />
      </div>

      <DataTable
        data={data.proyek}
        kunci={(p) => p.projectId}
        kolom={KOLOM}
        cariPada={(p) => [p.projectTitle]}
        placeholderCari="Cari proyek…"
        labelCari="Cari proyek"
        satuan="proyek"
        barisSkeleton={Math.max(data.proyek.length, 1)}
        kosong={{
          ikon: "finance",
          judul: "Belum ada proyek dengan nilai kontrak",
          keterangan: "Isi nilai kontrak di tab Keuangan pada halaman tiap proyek.",
        }}
      />
    </div>
  );
}

/** Bilah "berapa dari kontrak yang sudah jadi uang". */
function BilahTerkumpul({ nilai, maks }: { nilai: number; maks: number }) {
  const rasio = maks > 0 ? Math.min(nilai / maks, 1) : 0;
  return (
    <span className="kemajuan" role="img"
      aria-label={`${Math.round(rasio * 100)} persen dari nilai kontrak sudah diterima`}>
      <span className="kemajuan__isi" style={{ inlineSize: `${rasio * 100}%` }} />
      <span className="kemajuan__titik" style={{ insetInlineStart: `${rasio * 100}%` }} />
    </span>
  );
}

export function FinancePanel() {
  return <RequireAuth skeleton={
      <div className="stack" style={{ gap: "var(--space-5)" }}>
        <SkeletonStat jumlah={4} />
        <SkeletonKartu ikon="finance" />
      </div>
    }><Isi /></RequireAuth>;
}
