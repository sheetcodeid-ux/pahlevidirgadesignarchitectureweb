import { navigate } from "astro:transitions/client";
import { useEffect, useMemo, useState } from "react";
import { RequireAuth } from "./RequireAuth";
import { ToastProvider, useToast } from "../kit/Toast";
import { DropdownMenu, Menubar as BilahMenu } from "../kit/Overlay";
import { Pemisah } from "../kit/Tampilan";
import { unduhRincianBiaya, unduhDaftarTagihan } from "../../lib/pdfProyek";
import { KepalaSeksi } from "../kit/Item";
import { KartuStatistikLebar, BarKemajuan, GrafikArea } from "../kit/Ukuran";
import { Tabel, useUrutTabel, type KolomTabel } from "../kit/Tabel";
import { Lencana } from "../kit/Lencana";
import { Tombol, TombolIkon } from "../kit/Tombol";
import { Ikon, type DataIkon } from "../kit/Ikon";
import { CaretDown, CheckCircle, CoinIn, CoinOut, FileText, FilePdf, Globe, NotePencil, Plus, Ruler, SpecialHandshake, SpecialSealCheck, NavReceipt, CurrencyCircleDollar, SpecialCheckSquare, UserCircle } from "../kit/ikon";
import { PilihTombol } from "../kit/Formulir";
import {
  daftarProyek,
  daftarTugasProyek,
  ambilBulanan,
  semuaPembayaran,
  semuaBiaya,
  bacaCache,
  tulisCache,
  type Proyek,
  type Tugas,
  type BarisBulanan,
  type Pembayaran,
  type BiayaProyek,
} from "../../lib/admin";
import { formatRupiah, formatRupiahRingkas } from "../../lib/format";
import { TAHAP, PilihTeks } from "./ProyekKit";
import { LingkupTenggat, TimDanBayaran } from "./timProyekKit";

/* =============================================================================
   Satu Proyek — frame Figma "22. Saving Plans".

   Coinest memakai halaman ini untuk RENCANA TABUNGAN: daftar rencana di
   kiri, masing-masing dengan capaian terhadap target, lalu rincian satu
   rencana di kanan. Bentuk yang sama persis ada di studio ini, satu tingkat
   di bawah proyek: TAHAP PIPELINE, masing-masing dengan tugas yang sudah
   selesai terhadap seluruh tugasnya.

     Coinest                     Halaman ini
     --------------------------  --------------------------------------------
     Total Savings / Target /    Sudah diterima / Nilai kontrak / Tugas
       Plans                       selesai — dari proyek yang dibuka
     Saving Plans (6 kartu)      tahap pipeline (7), tugas selesai / semua
     Add Plan                    Tambah tugas (di editor proyek)
     Vacation Fund               tahap terpilih: capaian, status, persen
       Member                    orang yang memegang tugas di tahap itu
       Due Date / Remaining      tenggat tugas terakhirnya, sisa hari
     Saving Tips                 tugas di tahap itu, yang berikutnya tebal
     Balance                     kas masuk kumulatif proyek, 12 bulan
     Transactions                transaksi proyek ini (masuk dan keluar)

   Proyeknya dipilih lewat `?id=` — tautan "Buka" di Semua Proyek — dan bisa
   ditukar dari judul daftar tahap. Tahap yang terbuka pertama kali adalah
   tahap proyek SAAT INI, bukan tahap pertama: itu yang sedang dikerjakan.
   ============================================================================= */

const IKON_TAHAP: Record<string, DataIkon> = {
  proposal: FileText,
  deal_kontrak: SpecialHandshake,
  dp_50: CoinIn,
  desain_1: Ruler,
  desain_2: NotePencil,
  finish: CheckCircle,
  pelunasan: SpecialSealCheck,
};

const BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const BULAN_PANJANG = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];
const HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

const RENTANG = [
  { nilai: "1", label: "Bulan ini" },
  { nilai: "3", label: "3 bulan" },
  { nilai: "12", label: "12 bulan" },
  { nilai: "0", label: "Semua" },
];

function batasRentang(bulan: number): number | null {
  if (bulan <= 0) return null;
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  d.setMonth(d.getMonth() - (bulan - 1));
  return d.getTime();
}

function waktuKe(iso: string, akhirHari = true): number {
  return new Date(iso.length === 10 ? iso + (akhirHari ? "T23:59:59" : "T00:00:00") : iso).getTime();
}

/** Hari tersisa sampai tanggal kalender itu; negatif berarti sudah lewat. */
function sisaHari(iso: string): number | null {
  const [t, b, h] = iso.slice(0, 10).split("-").map(Number);
  if (!t || !b || !h) return null;
  const k = new Date();
  return Math.round((Date.UTC(t, b - 1, h) - Date.UTC(k.getFullYear(), k.getMonth(), k.getDate())) / 86_400_000);
}

function tanggalPanjang(iso: string): string {
  const [t, b, h] = iso.slice(0, 10).split("-").map(Number);
  return `${h} ${BULAN_PANJANG[(b ?? 1) - 1]} ${t}`;
}

interface RingkasTahap {
  nilai: string;
  label: string;
  tugas: Tugas[];
  selesai: number;
  persen: number;
  keadaan: string;
}

/* Halaman /proyek/<slug> baru ada sesudah build berikutnya: proyek yang
   diterbitkan sesudah build terakhir belum punya halaman, dan tautannya
   berujung 404 sampai Terbitkan ditekan. Stempel build dioper dari .astro
   (lihat JurnalSatuKit). */
/* Tanggal terbit yang KOSONG dianggap sudah dibangun: proyek lama bisa
   saja terbit tanpa published_at, dan menyembunyikan tautannya selamanya
   lebih buruk daripada sesekali 404. Yang disembunyikan cuma yang PASTI
   terbit sesudah build. */
const sudahDibangun = (terbitPada: string | null | undefined, dibangunPada?: string) =>
  !dibangunPada || !terbitPada || terbitPada <= dibangunPada;

function Isi({ dibangunPada }: { dibangunPada?: string }) {
  const [proyek, setProyek] = useState<Proyek[] | null>(() => bacaCache<Proyek[]>("proyek"));
  const [id, setId] = useState<string | null>(() => {
    try {
      return new URLSearchParams(location.search).get("id");
    } catch {
      return null;
    }
  });
  const [tugas, setTugas] = useState<Tugas[] | null>(null);
  const [bulanan, setBulanan] = useState<BarisBulanan[] | null>(null);
  const [bayar, setBayar] = useState<Pembayaran[] | null>(() => bacaCache<Pembayaran[]>("bayar-semua"));
  const [biaya, setBiaya] = useState<BiayaProyek[] | null>(() => bacaCache<BiayaProyek[]>("biaya-semua"));
  const [tahapPilih, setTahapPilih] = useState<string | null>(null);
  const [rentangTrx, setRentangTrx] = useState("0");
  const [rentangKas, setRentangKas] = useState(12);

  useEffect(() => {
    daftarProyek()
      .then((d) => {
        tulisCache("proyek", d);
        setProyek(d);
      })
      .catch(() => setProyek((l) => l ?? []));
    semuaPembayaran()
      .then((d) => {
        tulisCache("bayar-semua", d);
        setBayar(d);
      })
      .catch(() => setBayar((l) => l ?? []));
    semuaBiaya()
      .then((d) => {
        tulisCache("biaya-semua", d);
        setBiaya(d);
      })
      .catch(() => setBiaya((l) => l ?? []));
  }, []);

  const kini = (proyek ?? []).find((p) => p.id === id) ?? proyek?.[0] ?? null;
  const segarkanProyek = () =>
    daftarProyek()
      .then((d) => {
        tulisCache("proyek", d);
        setProyek(d);
      })
      .catch(() => {});
  const segarkanUang = () => {
    semuaBiaya()
      .then((d) => {
        tulisCache("biaya-semua", d);
        setBiaya(d);
      })
      .catch(() => {});
  };
  const toast = useToast();
  const [membuatPdf, setMembuatPdf] = useState(false);
  const [timJatuhTempo, setTimJatuhTempo] = useState(0);
  async function pdf(buat: (p: Proyek) => Promise<string>) {
    if (!kini || membuatPdf) return;
    setMembuatPdf(true);
    try {
      const nama = await buat(kini);
      toast({ judul: "PDF diunduh", keterangan: nama, nada: "sukses" });
    } catch (e) {
      toast({ judul: "Gagal membuat PDF", keterangan: (e as Error).message, nada: "gagal" });
    } finally {
      setMembuatPdf(false);
    }
  }

  useEffect(() => {
    if (!kini) return;
    let batal = false;
    const kT = `tugas-proyek:${kini.id}`;
    const kB = `proyek-bulan:${kini.id}:${rentangKas}`;
    setTugas(bacaCache<Tugas[]>(kT));
    setBulanan(bacaCache<BarisBulanan[]>(kB));
    daftarTugasProyek(kini.id)
      .then((d) => {
        if (batal) return;
        tulisCache(kT, d);
        setTugas(d);
      })
      .catch(() => !batal && setTugas((l) => l ?? []));
    ambilBulanan(kini.id, rentangKas)
      .then((d) => {
        if (batal) return;
        tulisCache(kB, d);
        setBulanan(d);
      })
      .catch(() => !batal && setBulanan((l) => l ?? []));
    return () => {
      batal = true;
    };
  }, [kini?.id, rentangKas]);

  function gantiProyek(baru: string) {
    setId(baru);
    setTahapPilih(null);
    try {
      const u = new URL(location.href);
      u.searchParams.set("id", baru);
      history.replaceState(history.state, "", u);
    } catch {
      /* alamat tidak bisa diubah — pilihannya tetap jalan */
    }
  }

  /* --- Tahap ---------------------------------------------------------------- */
  const tahap = useMemo<RingkasTahap[]>(
    () =>
      TAHAP.map((t) => {
        const isi = (tugas ?? []).filter((x) => x.stage === t.value);
        const selesai = isi.filter((x) => x.status === "selesai").length;
        const lewat = isi.some((x) => x.status !== "selesai" && x.dueDate && (sisaHari(x.dueDate) ?? 0) < 0);
        const keadaan =
          isi.length === 0
            ? "Belum ada tugas"
            : selesai === isi.length
              ? "Selesai"
              : lewat
                ? "Terlambat"
                : selesai > 0 || isi.some((x) => x.status !== "belum_mulai")
                  ? "Berjalan"
                  : "Belum mulai";
        return {
          nilai: t.value,
          label: t.label,
          tugas: isi,
          selesai,
          persen: isi.length ? Math.round((selesai / isi.length) * 100) : 0,
          keadaan,
        };
      }),
    [tugas],
  );
  const aktif =
    tahap.find((t) => t.nilai === tahapPilih) ??
    tahap.find((t) => t.nilai === kini?.pipelineStage) ??
    tahap[0]!;

  /* Tim tahap ini: pemegang tugasnya, tanpa kembar, urut kemunculan. */
  const tim = [...new Set(aktif.tugas.map((t) => t.assigneeName).filter((n): n is string => !!n))];
  const tenggat = aktif.tugas
    .map((t) => t.dueDate)
    .filter((d): d is string => !!d)
    .sort()
    .at(-1);
  const sisa = tenggat ? sisaHari(tenggat) : null;
  /* Yang belum selesai lebih dulu — daftar ini jawaban atas "apa berikutnya". */
  const daftarTugas = [...aktif.tugas].sort(
    (a, b) => Number(a.status === "selesai") - Number(b.status === "selesai") || a.sortOrder - b.sortOrder,
  );

  const totalTugas = (tugas ?? []).length;
  const tugasSelesai = (tugas ?? []).filter((t) => t.status === "selesai").length;
  const kontrak = kini?.contractValue ?? 0;
  const diterima = kini?.paidTotal ?? 0;

  /* --- Kas masuk kumulatif --------------------------------------------------- */
  const deret = (bulanan ?? []).slice(-rentangKas);
  const kumulatif = deret.reduce<number[]>((a, b) => [...a, (a.at(-1) ?? 0) + b.kasMasuk], []);
  const puncak = Math.max(1, ...kumulatif);
  const pangkat = 10 ** Math.floor(Math.log10(puncak));
  const maks = Math.ceil(puncak / pangkat) * pangkat;
  const singkat = (n: number) =>
    n >= 1e9 ? `${(n / 1e9).toFixed(1).replace(".", ",")} M` : n >= 1e6 ? `${Math.round(n / 1e6)} jt` : `${Math.round(n / 1e3)} rb`;
  /* Yang disorot bulan dengan kas masuk TERBESAR — di framenya pun yang
     disorot bukan bulan terakhir, melainkan titik yang layak dibicarakan.
     Kartunya dipusatkan di atas titik; di dua bulan pertama/terakhir ia
     ditambatkan ke sisi titik supaya tidak keluar widget — kartu yang
     menjorok keluar sempat mendorong halaman 54px ke samping. */
  const iSorot = deret.length
    ? deret.reduce((m, b, i) => (b.kasMasuk > (deret[m]?.kasMasuk ?? 0) ? i : m), deret.length - 1)
    : -1;
  const tepi = iSorot < 2 ? " sat__kas--awal" : iSorot >= deret.length - 2 ? " sat__kas--balik" : "";

  /* --- Transaksi proyek ------------------------------------------------------ */
  const transaksi = useMemo(() => {
    if (!kini) return [];
    const batas = batasRentang(Number(rentangTrx));
    const cocok = (projectId: string, w: string) =>
      projectId === kini.id && (batas === null || waktuKe(w, false) >= batas);
    const masuk = (bayar ?? [])
      .filter((b) => cocok(b.projectId, b.paidAt))
      .map((b) => ({
        kunci: `p:${b.id}`,
        masuk: true,
        orang: b.receiver || "—",
        waktu: b.paidAt,
        nominal: b.amount,
        catatan: b.note || "—",
      }));
    const keluar = (biaya ?? [])
      .filter((k) => cocok(k.projectId, k.incurredOn))
      .map((k) => ({
        kunci: `b:${k.id}`,
        masuk: false,
        orang: k.teamMemberName || "—",
        waktu: k.incurredOn,
        nominal: k.amount,
        catatan: k.label,
      }));
    /* Empat — sebanyak baris framenya. */
    return [...masuk, ...keluar].sort((a, b) => waktuKe(b.waktu) - waktuKe(a.waktu)).slice(0, 4);
  }, [kini, bayar, biaya, rentangTrx]);

  /* Jangkar tinta framenya (tabel 655..1380 = 725, pad 16): jenis 671,4,
     tanggal 906,6, nominal 1085,4, catatan 1198,6. */
  const kolom: KolomTabel[] = [
    { judul: "Jenis", lebar: 235.2, urut: true },
    { judul: "Tanggal", lebar: 178.8, urut: true },
    { judul: "Nominal", lebar: 113.2, urut: true },
    { judul: "Catatan", lebar: 197.8, urut: true },
  ];
  const urutTrx = useUrutTabel(transaksi, [
    (t) => (t.masuk ? "Masuk" : "Keluar"),
    (t) => waktuKe(t.waktu),
    (t) => (t.masuk ? t.nominal : -t.nominal),
    (t) => (t.catatan === "—" ? null : t.catatan),
  ]);
  const baris = urutTrx.terurut.map((t) => {
    const d = new Date(t.waktu.length === 10 ? t.waktu + "T00:00:00" : t.waktu);
    return [
      <span className="sat__jenis">
        <span className={`sat__jenisubin${t.masuk ? "" : " sat__jenisubin--keluar"}`}>
          <Ikon ikon={t.masuk ? CoinIn : CoinOut} ukuran={14} />
        </span>
        <b>{t.masuk ? "Masuk" : "Keluar"}</b>
        <i>-</i>
        <span className="sat__redup">{t.orang}</span>
      </span>,
      <span className="sat__jenis">
        {`${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}`}
        <i>-</i>
        <span className="sat__redup">{HARI[d.getDay()]}</span>
      </span>,
      <span className={t.masuk ? "sat__masuk" : "sat__keluar"} title={formatRupiah(t.nominal)}>
        {t.masuk ? "+" : "−"}
        {formatRupiahRingkas(t.nominal)}
      </span>,
      <span className="sat__catatan">{t.catatan}</span>,
    ];
  });

  if (proyek !== null && !kini) {
    return (
      <p className="sat__kosong">
        Belum ada proyek. <a href="/admin/proyek/baru">Buat proyek pertama</a>.
      </p>
    );
  }

  const idKini = kini ? encodeURIComponent(kini.id) : "";
  return (
    <div className="sat">
      {/* ---- Bilah menu: semua yang bisa dikerjakan pada proyek ini -------
          Satu tempat untuk pindah ke halaman milik proyek ini (ubah data,
          halaman publik, portal klien), mencatat uangnya, dan mengunduh
          dokumennya — dulu tersebar di ikon-ikon kecil kepala seksi. */}
      {kini && (
        <div className="sat__alat">
          {/* Seksi Tim & Bayaran duduk di bawah lipatan kartu rincian, jadi
              utang ke tim yang sudah jatuh tempo diberi pintu di sini. */}
          {timJatuhTempo > 0 && (
            <Tombol
              ukuran="small"
              jenis="secondary"
              kiri={CoinOut}
              className="sat__tempo"
              onClick={() => document.getElementById("tim-bayaran")?.scrollIntoView({ block: "start", behavior: "smooth" })}
            >
              {timJatuhTempo} bayaran tim jatuh tempo
            </Tombol>
          )}
          <BilahMenu
            label="Aksi proyek"
            menus={[
              {
                label: "Proyek",
                sections: [
                  {
                    items: [
                      { label: "Ubah data proyek", ikon: NotePencil, onSelect: () => navigate(`/admin/proyek/edit?id=${idKini}`) },
                      { label: "Halaman publik", ikon: Globe, onSelect: () => navigate(`/admin/proyek/publik?id=${idKini}`) },
                      { label: "Portal klien", ikon: UserCircle, onSelect: () => navigate(`/admin/proyek/klien?id=${idKini}`) },
                    ],
                  },
                ],
              },
              {
                label: "Keuangan",
                sections: [
                  {
                    items: [
                      { label: "Terima pembayaran", ikon: CoinIn, onSelect: () => navigate(`/admin/keuangan/terima?proyek=${idKini}`) },
                      { label: "Catat pengeluaran", ikon: CoinOut, onSelect: () => navigate("/admin/keuangan/keluar") },
                      { label: "Tagihan & termin", ikon: NavReceipt, onSelect: () => navigate(`/admin/keuangan/tagihan?proyek=${idKini}`) },
                    ],
                  },
                ],
              },
              {
                label: "Dokumen",
                sections: [
                  {
                    label: "Unduh PDF",
                    items: [
                      { label: "Daftar tagihan — untuk klien", ikon: FilePdf, disabled: membuatPdf, onSelect: () => pdf(unduhDaftarTagihan) },
                      { label: "Rincian biaya — internal", ikon: FilePdf, disabled: membuatPdf, onSelect: () => pdf(unduhRincianBiaya) },
                    ],
                  },
                ],
              },
            ]}
          />
        </div>
      )}

      {/* ---- Tiga kartu statistik --------------------------------------- */}
      <div className="sat__stat">
        <KartuStatistikLebar
          judul="Sudah diterima"
          nilai={<span title={formatRupiah(diterima)}>{formatRupiahRingkas(diterima)}</span>}
          tren={
            kontrak > 0 ? (
              <Lencana bentuk="pejalkecil" nada="menunggu">
                {Math.round((diterima / kontrak) * 100)}%
              </Lencana>
            ) : undefined
          }
          ikon={CurrencyCircleDollar}
        />
        <KartuStatistikLebar
          judul="Nilai kontrak"
          nilai={<span title={formatRupiah(kontrak)}>{kontrak ? formatRupiahRingkas(kontrak) : "—"}</span>}
          ikon={NavReceipt}
        />
        <KartuStatistikLebar
          judul="Tugas selesai"
          nilai={`${tugasSelesai} / ${totalTugas}`}
          tren={
            totalTugas > 0 ? (
              <Lencana bentuk="pejalkecil" nada="menunggu">
                {Math.round((tugasSelesai / totalTugas) * 100)}%
              </Lencana>
            ) : undefined
          }
          ikon={SpecialCheckSquare}
        />
      </div>

      <Pemisah className="sat__garis" />

      <div className="sat__utama">
        {/* ---- Tahap proyek (slot "Saving Plans") ------------------------- */}
        <section className="sat__w sat__tahap" aria-label="Tahap proyek">
          <KepalaSeksi
            judul={
              kini ? (
                <PilihTeks
                  judul="Pilih proyek"
                  nilai={kini.id}
                  opsi={(proyek ?? []).map((p) => ({ value: p.id, label: p.title }))}
                  onUbah={async (v) => gantiProyek(v)}
                />
              ) : (
                "Memuat…"
              )
            }
            kanan={
              kini ? (
                <span className="sat__aksikepala">
                  {/* Dua PDF berkop studio — sempat hilang sejak Keuangan
                      pindah ke kit; lihat lib/pdfProyek.ts. */}
                  <DropdownMenu
                    trigger={
                      <TombolIkon
                        ikon={FilePdf}
                        jenis="transparent"
                        ukuran="small"
                        judul={membuatPdf ? "Menyusun PDF…" : "Unduh PDF proyek ini"}
                        disabled={membuatPdf}
                      />
                    }
                    sections={[
                      {
                        label: "Unduh PDF",
                        items: [
                          { label: "Daftar tagihan — untuk klien", ikon: NavReceipt, onSelect: () => pdf(unduhDaftarTagihan) },
                          { label: "Rincian biaya — internal", ikon: FilePdf, onSelect: () => pdf(unduhRincianBiaya) },
                        ],
                      },
                    ]}
                  />
                  {kini.status === "published" && sudahDibangun(kini.publishedAt, dibangunPada) && (
                    <TombolIkon
                      ikon={Globe}
                      jenis="transparent"
                      ukuran="small"
                      judul="Lihat halaman publik proyek ini"
                      href={`/proyek/${kini.slug}`}
                    />
                  )}
                </span>
              ) : undefined
            }
          />
          <div className="sat__daftar">
            {tahap.map((t) => (
              <button
                key={t.nilai}
                type="button"
                className="sat__kartu"
                aria-pressed={t.nilai === aktif.nilai}
                onClick={() => setTahapPilih(t.nilai)}
              >
                <span className="sat__kartuatas">
                  <span className="sat__ubin">
                    <Ikon ikon={IKON_TAHAP[t.nilai] ?? FileText} ukuran={20} />
                  </span>
                  <span className="sat__kartuinfo">
                    <b>{t.label}</b>
                    <span>
                      {t.selesai} <i>/</i> {t.tugas.length} tugas
                    </span>
                  </span>
                  <span className="sat__kartukanan">
                    <b>{t.persen}%</b>
                    <span>{t.keadaan}</span>
                  </span>
                </span>
                <BarKemajuan persen={t.persen} tinggi={12} celah={4} judul={`Tahap ${t.label}`} />
              </button>
            ))}
          </div>
          {kini && (
            <a className="sat__tambah" href={`/admin/proyek/edit?id=${kini.id}`}>
              <Ikon ikon={Plus} ukuran={14} />
              Tambah Tugas
            </a>
          )}
        </section>

        {/* ---- Rincian tahap terpilih --------------------------------------- */}
        <section className="sat__w sat__rinci" aria-label={`Tahap ${aktif.label}`}>
          <div className="sat__atas">
            <article className="sat__info">
              <p className="sat__infojudul">
                <span className="sat__ubin sat__ubin--putih">
                  <Ikon ikon={IKON_TAHAP[aktif.nilai] ?? FileText} ukuran={20} />
                </span>
                {aktif.label}
              </p>
              <p className="sat__infonilai">
                <b>{aktif.selesai}</b>
                <span>/{aktif.tugas.length} tugas</span>
              </p>
              <BarKemajuan persen={aktif.persen} tinggi={51} bentuk="tumpuk" judul={`Kemajuan tahap ${aktif.label}`} />
              <p className="sat__infokaki">
                <span>{aktif.keadaan}</span>
                <b>{aktif.persen}%</b>
              </p>
              <hr className="sat__infogaris" />
              <dl className="sat__fakta">
                <div>
                  <dt>Tim</dt>
                  <dd>
                    {tim.length === 0 && <span className="sat__redup">Belum ada</span>}
                    {tim.slice(0, 3).map((n) => (
                      <span key={n} className="sat__orang">
                        <span className="sat__avatar" aria-hidden="true">
                          {n.slice(0, 1)}
                        </span>
                        {n}
                      </span>
                    ))}
                    {tim.length > 3 && <span className="sat__redup">+{tim.length - 3} lainnya</span>}
                  </dd>
                </div>
                <div>
                  <dt>Tenggat</dt>
                  <dd>{tenggat ? tanggalPanjang(tenggat) : "—"}</dd>
                </div>
                <div>
                  <dt>Sisa</dt>
                  <dd>
                    {sisa === null ? "—" : sisa < 0 ? `lewat ${-sisa} hari` : sisa === 0 ? "hari ini" : `${sisa} hari`}
                  </dd>
                </div>
              </dl>
            </article>

            <div className="sat__kanan">
              <article className="sat__w sat__tips">
                <h2 className="sat__judul">Tugas Tahap Ini</h2>
                {daftarTugas.length === 0 ? (
                  <p className="sat__redup sat__tipskosong">Belum ada tugas di tahap ini.</p>
                ) : (
                  <ul className="sat__tipsdaftar">
                    {daftarTugas.slice(0, 4).map((t, i) => (
                      <li
                        key={t.id}
                        className={
                          t.status === "selesai" ? "is-selesai" : i === 0 ? "is-berikut" : undefined
                        }
                      >
                        {i === 0 && t.status !== "selesai" ? `Berikutnya: ${t.title}` : t.title}
                        {t.assigneeName && <span className="sat__redup"> · {t.assigneeName}</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </article>

              <article className={`sat__w sat__kas${tepi}`}>
                <KepalaSeksi
                  judul="Kas Masuk"
                  kanan={
                    <PilihTombol
                      judul="Rentang kas masuk"
                      jenis="ghost"
                      nilai={String(rentangKas)}
                      opsi={[
                        { nilai: "12", label: "12 bulan" },
                        { nilai: "24", label: "24 bulan" },
                      ]}
                      onPilih={(v) => setRentangKas(Number(v))}
                    />
                  }
                />
                <GrafikArea
                  deret={[{ titik: kumulatif }]}
                  labelX={deret.map((b) => BULAN[Number(b.bulan.slice(5, 7)) - 1])}
                  labelY={[singkat(maks), singkat(maks * 0.75), singkat(maks * 0.5), singkat(maks * 0.25), "0"]}
                  maks={maks}
                  tinggi={132}
                  jarakLabelX={11.8}
                  keterangan={(i) => ({
                    judul: `${BULAN_PANJANG[Number(deret[i]!.bulan.slice(5, 7)) - 1]} ${deret[i]!.bulan.slice(0, 4)}`,
                    nilai: formatRupiahRingkas(kumulatif[i]!),
                    ket: `bulan itu +${formatRupiahRingkas(deret[i]!.kasMasuk)}`,
                  })}
                  sorot={
                    iSorot >= 0
                      ? {
                          indeks: iSorot,
                          judul: `${BULAN_PANJANG[Number(deret[iSorot]!.bulan.slice(5, 7)) - 1]} ${deret[iSorot]!.bulan.slice(0, 4)}`,
                          nilai: formatRupiahRingkas(kumulatif[iSorot]!),
                        }
                      : undefined
                  }
                />
              </article>
            </div>
          </div>

          {/* ---- Pekerjaan: lingkup, tenggat, tim per peran ------------------
              Kolom LIST PROJECT dan TEAM DESIGN di Excel pemilik. Membayar satu
              tahap mencatat biaya proyek, jadi Transaksi di bawahnya ikut
              diambil ulang. */}
          {kini && <LingkupTenggat proyek={kini} onBerubah={segarkanProyek} />}
          {kini && <TimDanBayaran proyek={kini} onBerubah={segarkanUang} onJatuhTempo={setTimJatuhTempo} />}

          {/* ---- Transaksi proyek ------------------------------------------ */}
          <article className="sat__w sat__trx">
            <KepalaSeksi
              judul="Transaksi"
              kanan={
                <PilihTombol judul="Rentang transaksi" jenis="ghost" nilai={rentangTrx} opsi={RENTANG} onPilih={setRentangTrx} />
              }
            />
            {baris.length > 0 ? (
              <div className="sat__tabel">
                <Tabel
                  kolom={kolom}
                  baris={baris}
                  urutan={urutTrx.urutan}
                  onUrut={urutTrx.onUrut}
                  kepala="mint"
                  pad={16}
                  tinggiKepala={37}
                  tinggiBaris={56}
                  fontBaris={12}
                />
              </div>
            ) : (
              <p className="sat__kosong">
                {bayar === null || biaya === null ? "Memuat transaksi…" : "Belum ada transaksi pada rentang ini."}
              </p>
            )}
          </article>
        </section>
      </div>
    </div>
  );
}

export function SatuProyekKit({ dibangunPada }: { dibangunPada?: string }) {
  return (
    <RequireAuth skeleton={<div className="sat sat--rangka" />}>
      <ToastProvider>
        <Isi dibangunPada={dibangunPada} />
      </ToastProvider>
    </RequireAuth>
  );
}
