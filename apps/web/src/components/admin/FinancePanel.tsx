import { useEffect, useState } from "react";
import { Icon } from "../ui/Icon";
import { SkeletonKartu, SkeletonStat } from "../ui/Skeleton";
import { DataTable, type Kolom } from "../ui/data/DataTable";
import {
  BilahKategori, BusurTarget, ChartBanding, CincinDistribusi, KartuData, PilLive, PitaMetrik,
  type IrisKategori, type PitaCincin, type SelPita,
} from "../ui/data/Keuangan";
import { RequireAuth } from "./RequireAuth";
import {
  ambilRingkasanKeuangan, ambilBulanan, type AktivitasKeuangan, type FinanceOverview,
  type BarisBulanan, bacaCache, tulisCache,
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

/** Persen bergaya Indonesia: koma desimal, satu angka di belakangnya. */
function persen(n: number | null) {
  if (n === null || !Number.isFinite(n)) return "—";
  return `${n.toFixed(1).replace(".", ",")}%`;
}

/** Porsi sebuah komponen terhadap nilai kontrak. */
function porsiKontrak(nilai: number, kontrak: number) {
  return kontrak > 0 ? (nilai / kontrak) * 100 : null;
}

function namaBulanPendek(iso: string) {
  const [th, bl] = iso.split("-");
  return new Date(Number(th), Number(bl) - 1, 1).toLocaleDateString("id-ID", { month: "short" });
}

/**
 * Margin satu proyek = laba bersih terhadap KAS YANG BENAR-BENAR MASUK.
 *
 * Bukan terhadap nilai kontrak: proyek yang baru DP 50% akan terlihat
 * bermargin tipis padahal uangnya memang belum ditagih. Kalau belum ada kas
 * masuk sama sekali, marginnya tidak bisa dihitung — dan proyek itu tidak
 * dimasukkan ke pita mana pun, bukan dilempar ke "kritis".
 */
function marginProyek(p: BarisProyek): number | null {
  return p.received > 0 ? (p.labaBersih / p.received) * 100 : null;
}

/* Ambang pita margin. 35% diambil dari dokumen strategi pemilik ("target
   margin minimum 35–45%", KPI "margin rata-rata minimal 35%"). Batas bawah
   pita tengah menyambung tepat ke batas atas pita kritis — tidak ada nilai
   margin yang jatuh di luar ketiganya. */
const AMBANG_SEHAT = 35;
const AMBANG_KRITIS = 15;

const KOLOM_IKON: Record<AktivitasKeuangan["jenis"], { ikon: Parameters<typeof Icon>[0]["name"]; warna: string; lembut: string }> = {
  invoice_lunas: { ikon: "check", warna: "var(--success)", lembut: "var(--success-soft)" },
  invoice_terbit: { ikon: "finance", warna: "var(--chart-1)", lembut: "var(--info-soft)" },
  biaya: { ikon: "alert", warna: "var(--warn)", lembut: "var(--warn-soft)" },
  dokumen: { ikon: "document", warna: "var(--text-muted)", lembut: "var(--surface-hover)" },
  progres: { ikon: "clock", warna: "var(--upgrade)", lembut: "var(--upgrade-soft)" },
};

/**
 * Baris angka pendamping di kaki kartu.
 *
 * Ada bukan sebagai pengisi: kartu yang isinya cuma satu gambar menyisakan
 * rongga di bawahnya, dan rongga itu terbaca sebagai halaman yang belum jadi.
 * Angka di sini menjawab pertanyaan lanjutan yang wajar muncul setelah melihat
 * gambarnya — "kurang berapa", "berapa per bulan".
 */
function BarisAngka({ stat }: { stat: { label: string; nilai: string; minus?: boolean }[] }) {
  return (
    <div className="kaki-angka">
      {stat.map((s) => (
        <div key={s.label} className="kaki-angka__sel">
          <span className="kaki-angka__label">{s.label}</span>
          <span className={`kaki-angka__nilai${s.minus ? " angka-minus" : ""}`}>{s.nilai}</span>
        </div>
      ))}
    </div>
  );
}

/** Kartu yang sumber datanya belum ada — dijelaskan, bukan dibiarkan kosong. */
function BelumAdaSumber({ judul, keterangan }: { judul: string; keterangan: string }) {
  return (
    <div className="belum">
      <span className="belum__ikon"><Icon name="alert" size={22} /></span>
      <span className="belum__judul">{judul}</span>
      <p className="belum__ket">{keterangan}</p>
    </div>
  );
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
  {
    judul: "Nilai kontrak",
    kelas: "table__num",
    lebar: "8rem",
    render: (p) => (p.contractValue !== null ? formatRupiah(p.contractValue) : "—"),
  },
  {
    judul: "Kas masuk",
    kelas: "table__num",
    lebar: "8.5rem",
    render: (p) => (
      <span className="sel-angka">
        {formatRupiah(p.received)}
        <span className="sel-porsi">{persen(porsiKontrak(p.received, p.contractValue ?? 0))}</span>
      </span>
    ),
  },
  {
    judul: "Biaya operasional",
    kelas: "table__num",
    lebar: "8.5rem",
    render: (p) => (
      <span className="sel-angka">
        {formatRupiah(p.costsTotal)}
        <span className="sel-porsi">{persen(porsiKontrak(p.costsTotal, p.contractValue ?? 0))}</span>
      </span>
    ),
  },
  {
    judul: "Laba bersih",
    kelas: "table__num",
    lebar: "8.5rem",
    render: (p) => (
      <span className="sel-angka">
        <span className={p.labaBersih < 0 ? "angka-minus" : undefined}>{rupiah(p.labaBersih)}</span>
        <span className="sel-porsi">{persen(porsiKontrak(p.labaBersih, p.contractValue ?? 0))}</span>
      </span>
    ),
  },
  {
    judul: "Margin",
    kelas: "table__num",
    lebar: "4.5rem",
    render: (p) => {
      const m = marginProyek(p);
      if (m === null) return <span className="t-muted">—</span>;
      const kelas = m >= AMBANG_SEHAT ? "badge--success" : m >= AMBANG_KRITIS ? "badge--warn" : "badge--brand";
      return <span className={`badge ${kelas}`}>{persen(m)}</span>;
    },
  },
];

function Isi() {
  // Proyek aktif dibaca setelah mount — localStorage tidak ada saat build, dan
  // membacanya saat render membuat hidrasi pertama beda dari HTML-nya.
  const [aktif, setAktif] = useState<string | null>(null);
  const [siap, setSiap] = useState(false);
  const [data, setData] = useState<FinanceOverview | null>(null);
  const [bulan, setBulan] = useState<BarisBulanan[] | null>(null);
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
    setBulan(bacaCache<BarisBulanan[]>(`bulanan:${k}:24`) ?? null);

    ambilRingkasanKeuangan(aktif)
      .then((d) => { tulisCache(`keuangan:${k}`, d); setData(d); })
      .catch((e) => setGalat((e as Error).message));
    // 24 bulan, bukan 12: grafik Nilai Proyek membandingkan tahun ini dengan
    // tahun lalu, jadi ia butuh dua tahun penuh sekaligus.
    ambilBulanan(aktif, 24)
      .then((d) => { tulisCache(`bulanan:${k}:24`, d); setBulan(d); })
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
      <div className="papan-stack">
        <SkeletonStat jumlah={4} />
        <SkeletonKartu ikon="finance" />
      </div>
    );
  }

  const judul = aktif ? data.proyek.find((p) => p.projectId === aktif)?.projectTitle : null;

  /* --- Pita metrik: enam angka, masing-masing dengan porsinya ------------- */

  const marginKas = data.kasMasuk > 0 ? (data.labaBersih / data.kasMasuk) * 100 : null;

  const sel: SelPita[] = [
    { label: "Nilai kontrak", nilai: formatRupiah(data.totalKontrak), persen: "100%", arah: "netral" },
    {
      label: "Kas masuk", nilai: formatRupiah(data.kasMasuk),
      persen: persen(porsiKontrak(data.kasMasuk, data.totalKontrak)), arah: "naik",
    },
    {
      label: "Piutang", nilai: formatRupiah(data.piutang),
      persen: persen(porsiKontrak(data.piutang, data.totalKontrak)), arah: "netral",
    },
    {
      label: "Biaya ops", nilai: formatRupiah(data.totalBiaya),
      persen: persen(porsiKontrak(data.totalBiaya, data.totalKontrak)), arah: "turun",
    },
    {
      label: "Laba bersih", nilai: rupiah(data.labaBersih), minus: data.labaBersih < 0,
      persen: persen(porsiKontrak(data.labaBersih, data.totalKontrak)),
      arah: data.labaBersih < 0 ? "turun" : "naik",
    },
    {
      label: "Margin", nilai: persen(marginKas), minus: (marginKas ?? 0) < 0,
      persen: "dari kas masuk", arah: (marginKas ?? 0) >= AMBANG_SEHAT ? "naik" : "turun",
    },
  ];

  /* --- Distribusi margin -------------------------------------------------- */

  const terukur = data.proyek.map(marginProyek).filter((m): m is number => m !== null);
  const pita: PitaCincin[] = [
    {
      label: "Sehat", keterangan: `Margin ≥ ${AMBANG_SEHAT}%`, ikon: "check",
      warna: "var(--success)", lembut: "var(--success-soft)",
      jumlah: terukur.filter((m) => m >= AMBANG_SEHAT).length,
    },
    {
      label: "Cukup", keterangan: `Margin ${AMBANG_KRITIS}–${AMBANG_SEHAT - 1}%`, ikon: "clock",
      warna: "var(--warn)", lembut: "var(--warn-soft)",
      jumlah: terukur.filter((m) => m >= AMBANG_KRITIS && m < AMBANG_SEHAT).length,
    },
    {
      label: "Kritis", keterangan: `Margin < ${AMBANG_KRITIS}%`, ikon: "alert",
      warna: "var(--brand)", lembut: "var(--brand-soft)",
      jumlah: terukur.filter((m) => m < AMBANG_KRITIS).length,
    },
  ];

  /* --- Nilai proyek: tahun ini vs tahun lalu ------------------------------ */

  // Dua belas bulan terakhir, dan dua belas bulan sebelum itu, dipetakan ke
  // sumbu bulan yang sama. Deretnya sudah urut dari API, jadi cukup dipotong.
  const deret = bulan ?? [];
  const tahunIni = deret.slice(-12);
  const tahunLalu = deret.slice(-24, -12);
  const cukupUntukBanding = tahunIni.length >= 2;
  const labelBulan = tahunIni.map((b) => namaBulanPendek(b.bulan));
  const nilaiKini = tahunIni.map((b) => b.kasMasuk);
  // Kalau tahun lalu belum punya data, dibandingkan dengan nol — bukan
  // disembunyikan. Batang kosong adalah jawaban yang benar untuk "tahun lalu
  // belum ada apa-apa".
  const nilaiLalu = tahunIni.map((_, i) => tahunLalu[i]?.kasMasuk ?? 0);

  const totalKini = tahunIni.reduce((a, b) => a + b.kasMasuk, 0);
  const totalLalu = tahunLalu.reduce((a, b) => a + b.kasMasuk, 0);

  /* Sisa bulan dalam semester target. Dihitung dari bulan mulainya, bukan dari
     kalender berjalan — semester bisa dimulai bulan apa saja. */
  const sisaBulan = (() => {
    const t = data.targetSemester;
    if (!t) return 0;
    const [th, bl] = t.mulai.split("-").map(Number);
    const kini = new Date();
    const lewat = (kini.getFullYear() - th) * 12 + (kini.getMonth() + 1 - bl);
    return Math.max(6 - lewat, 0);
  })();

  /* --- Beban operasional -------------------------------------------------- */

  const NAMA_BEBAN: Record<string, { nama: string; warna: string }> = {
    tenaga_kerja: { nama: "Tenaga kerja & render", warna: "var(--chart-1)" },
    management_fee: { nama: "Management fee 10%", warna: "var(--chart-2)" },
    operasional: { nama: "Operasional harian", warna: "var(--chart-3)" },
    lainnya: { nama: "Lainnya", warna: "var(--tray)" },
  };

  const iris: IrisKategori[] | null = data.bebanKategori
    ? data.bebanKategori.map((b) => ({
        nama: NAMA_BEBAN[b.kategori]?.nama ?? b.kategori,
        warna: NAMA_BEBAN[b.kategori]?.warna ?? "var(--tray)",
        nilai: b.nilai,
      }))
    : null;

  return (
    <div className="papan-stack">
      {/* Pil lingkup: lingkup bukan peringatan, ia keadaan — dan keadaan
          ditulis sebaris, bukan dalam kotak yang menuntut perhatian. */}
      <div className="lingkup">
        <span className="lingkup__nama">
          <Icon name={aktif ? "project" : "dashboard"} size={15} />
          {judul ?? "Semua Proyek"}
        </span>
        <span className="lingkup__nilai">{rupiah(data.labaBersih)}</span>
        <span className="lingkup__dorong t-muted" style={{ fontSize: "var(--text-xs)" }}>
          {data.proyek.length} proyek berkontrak
        </span>
      </div>

      <PitaMetrik sel={sel} />

      <div className="papan-grid papan-grid--1-2-1">
        <KartuData
          judul="Target Semester"
          keterangan="Kas masuk vs target 6 bulan"
          kanan={data.targetSemester ? <PilLive /> : undefined}>
          {data.targetSemester ? (
            <>
              <BusurTarget
                judul="Target semester"
                nilai={data.kasMasuk}
                target={data.targetSemester.nilai}
                format={rupiahRingkas}
                labelTengah="Target Semester"
              />
              <BarisAngka
                stat={[
                  { label: "Sisa ke target", nilai: rupiahRingkas(Math.max(data.targetSemester.nilai - data.kasMasuk, 0)) },
                  {
                    label: `Butuh / bulan · ${sisaBulan} bln`,
                    nilai: sisaBulan > 0
                      ? rupiahRingkas(Math.max(data.targetSemester.nilai - data.kasMasuk, 0) / sisaBulan)
                      : "—",
                  },
                ]}
              />
            </>
          ) : (
            <BelumAdaSumber
              judul="Target belum disetel"
              keterangan="Butuh tabel target di database supaya angkanya bisa diatur dari Info Studio, bukan ditulis tetap di kode."
            />
          )}
        </KartuData>

        <KartuData
          judul="Nilai Proyek"
          keterangan={`Kas masuk per bulan · ${tahunIni.length} bulan terakhir${
            tahunLalu.length > 0 ? " vs periode sebelumnya" : ""
          }`}>
          {cukupUntukBanding ? (
            <>
              <BarisAngka
                stat={[
                  { label: "Periode ini", nilai: rupiahRingkas(totalKini) },
                  { label: "Periode sebelumnya", nilai: rupiahRingkas(totalLalu) },
                  { label: "Selisih", nilai: rupiahRingkas(totalKini - totalLalu), minus: totalKini < totalLalu },
                ]}
              />
              <ChartBanding
              label={labelBulan}
              kini={nilaiKini}
              lalu={nilaiLalu}
              namaKini="Periode ini"
              namaLalu="Periode sebelumnya"
                format={rupiahRingkas}
              />
            </>
          ) : (
            <BelumAdaSumber
              judul="Belum cukup bulan berdata"
              keterangan="Grafik terisi begitu ada minimal dua bulan dengan pergerakan uang."
            />
          )}
        </KartuData>

        <KartuData judul="Distribusi Margin" keterangan="Sebaran kesehatan margin per proyek">
          <CincinDistribusi judul="Distribusi margin" pita={pita} />
        </KartuData>
      </div>

      <div className="papan-grid papan-grid--dua">
        <KartuData judul="Beban Operasional" keterangan="Rincian beban studio menurut kategori">
          {iris ? (
            <>
              <BarisAngka
                stat={[
                  { label: "Total beban", nilai: formatRupiah(iris.reduce((a, i) => a + i.nilai, 0)) },
                  { label: "Kategori tercatat", nilai: String(iris.filter((i) => i.nilai > 0).length) },
                ]}
              />
              <BilahKategori iris={iris} format={formatRupiah} />
            </>
          ) : (
            <BelumAdaSumber
              judul="Rincian kategori belum tersedia"
              keterangan="Biaya sudah tersimpan berkategori, tapi ringkasan keuangan belum mengelompokkannya. Butuh satu perubahan di repository API."
            />
          )}
        </KartuData>

        <KartuData
          judul="Aktivitas Terkini"
          keterangan="Pergerakan uang dan dokumen terbaru"
          kanan={data.aktivitas ? <PilLive /> : undefined}>
          {data.aktivitas && data.aktivitas.length > 0 ? (
            <ul className="akt">
              {data.aktivitas.map((a) => {
                const gaya = KOLOM_IKON[a.jenis];
                return (
                  <li key={a.id} className="akt__baris">
                    <span className="akt__ikon" style={{ background: gaya.lembut, color: gaya.warna }}>
                      <Icon name={gaya.ikon} size={15} />
                    </span>
                    <span className="akt__teks">
                      <span className="akt__judul">{a.judul}</span>
                      <span className="akt__ket">{a.keterangan}</span>
                    </span>
                    <span className="akt__waktu">{a.waktu}</span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <BelumAdaSumber
              judul="Belum ada sumber aktivitas"
              keterangan="Butuh endpoint gabungan yang menyatukan invoice lunas, biaya baru, dokumen terunggah, dan perubahan progres."
            />
          )}
        </KartuData>
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
          judul: "Belum ada proyek berkontrak",
          keterangan: "Isi nilai kontrak di halaman proyek supaya angkanya ikut terhitung di sini.",
        }}
      />
    </div>
  );
}

export function FinancePanel() {
  return (
    <RequireAuth skeleton={
      <div className="papan-stack">
        <SkeletonStat jumlah={4} />
        <SkeletonKartu ikon="finance" />
      </div>
    }><Isi /></RequireAuth>
  );
}
