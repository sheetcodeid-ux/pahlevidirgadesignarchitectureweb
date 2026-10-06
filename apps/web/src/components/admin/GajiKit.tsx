import { IsianTempel, PilihMenu, IsianTanggal } from "../kit/Formulir";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { RequireAuth } from "./RequireAuth";
import { LencanaTren } from "../kit/Ukuran";
import { Tombol, TombolIkon } from "../kit/Tombol";
import { Isian } from "../kit/Isian";
import { ArrowClockwise, CopySimple, DownloadSimple, Plus } from "../kit/ikon";
import { Dialog, AlertDialog } from "../kit/Overlay";
import { ToastProvider, useToast } from "../kit/Toast";
import { Keterangan, pemberiKet, type KabarKartu } from "../kit/kartuGrafik";
import { BULAN, BULAN_PENDEK, JENIS } from "./frame25";
import {
  ambilSettings,
  bukuGaji,
  gajiBulan,
  catatGaji,
  ubahGaji,
  hapusGaji,
  daftarTim,
  bacaCache,
  tulisCache,
  LABEL_JENIS_ANGGOTA,
  type BarisGajiBulan,
  type BulanBuku,
  type JilidGaji,
  type AnggotaTim,
} from "../../lib/admin";
import { formatRupiah } from "../../lib/format";
import { terbilang } from "../../lib/terbilang";
import { unduhCsv } from "../../lib/csv";

/* =============================================================================
   Gaji — BUKU GAJI yang terbuka di meja.

   Benda dunia nyatanya: buku daftar penerimaan gaji. Bayaran Tim sudah
   menjawab "orang ini menerima berapa" (amplop per orang); halaman ini
   menjawab "bulan ini studio membayar siapa saja, dan siapa yang sudah
   menerima" — jadi bentuknya DAFTAR per bulan, bukan amplop.

     Sampul dalam (bidang uang)   rekap bulan, tanda terima, rak jilid/tahun
     Lembar                       Daftar Penerimaan Gaji: nomor, penerima,
                                  gaji, fee, jumlah, tanda terima ZIG-ZAG
                                  (nomor ganjil di kiri, genap di kanan —
                                  konvensi formulir tanda terima kantor)
     Indeks di tepi lembar        satu tab per bulan; PANJANG tab = jumlah
                                  bulan itu, jadi tepi buku sekaligus grafik
     Penggaris baca               benda yang disentuh: meluncur ke baris di
                                  bawah kursor dan mengukur bagian orang itu
                                  dari jumlah bulan

   Aturannya tetap satu kalimat dan dijaga di lapisan data: FEE MENULIS, GAJI
   MEMBACA. Kolom Gaji diketik di sini; kolom Fee dijumlahkan SQL dari biaya
   proyek bernama yang dicatat di Keuangan, dan tidak bisa diketik di sini.
   ============================================================================= */

const kunciBulan = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const BULAN_INI = kunciBulan(new Date());
const TAHUN_INI = new Date().getFullYear();

function bulanSebelum(period: string): string {
  const [y, m] = period.split("-").map(Number);
  // Date(y, m - 2) sudah benar melewati pergantian tahun.
  return kunciBulan(new Date(y!, m! - 2, 1));
}

const namaBulan = (period: string) => BULAN[Number(period.slice(5, 7)) - 1]!;
const labelBulan = (period: string) => `${namaBulan(period)} ${period.slice(0, 4)}`;

function tanggalPendek(iso: string): string {
  const [, b, h] = iso.slice(0, 10).split("-").map(Number);
  return `${h} ${BULAN_PENDEK[(b ?? 1) - 1]}`;
}

const HARI_INI = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const persen = (n: number, dari: number) => (dari > 0 ? (n / dari) * 100 : 0);
const teksPersen = (p: number) => `${p.toLocaleString("id-ID", { maximumFractionDigits: 1 })}%`;
const tanda = (n: number) => (n >= 0 ? "+" : "−");

/** Bulan dari `?bulan=YYYY-MM` — tautan dari halaman lain mendarat di lembar
 *  bulan itu. Bulan yang belum datang tidak bisa dibuka. */
function bulanDariAlamat(): string {
  if (typeof location === "undefined") return BULAN_INI;
  const b = new URLSearchParams(location.search).get("bulan");
  return b && /^\d{4}-\d{2}$/.test(b) && b <= BULAN_INI ? b : BULAN_INI;
}


interface Baris extends BarisGajiBulan {
  no: number;
}

function Isi() {
  const toast = useToast();
  const kabar: KabarKartu = useRef(null);
  const ket = pemberiKet(kabar);

  const [period, setPeriod] = useState(bulanDariAlamat);
  const tahun = Number(period.slice(0, 4));

  /* Buku satu tahun. Kuncinya membawa tahunnya — cache tanpa tahun di kunci
     adalah cara paling mudah menampilkan jilid lain sebagai jilid ini. */
  const [buku, setBuku] = useState<{ months: BulanBuku[]; years: JilidGaji[] } | null>(() =>
    bacaCache(`gaji-buku-${Number(bulanDariAlamat().slice(0, 4))}`),
  );
  const [galat, setGalat] = useState<string | null>(null);
  /* TIDAK di-cache: isinya milik satu bulan tertentu. */
  const [baris, setBaris] = useState<BarisGajiBulan[] | null>(null);
  const [bulanLalu, setBulanLalu] = useState<BarisGajiBulan[]>([]);
  const [tim, setTim] = useState<AnggotaTim[]>([]);
  const [menyalin, setMenyalin] = useState(false);
  /* Kop lembar: nama studio dari Info Studio. Kunci cache `settings` milik
     Info Studio — di sini dibaca saja (jebakan #8). */
  const [studio, setStudio] = useState<string | null>(() => bacaCache<{ studioName?: string }>("settings")?.studioName ?? null);

  function muatBuku(y = tahun) {
    setGalat(null);
    bukuGaji(y)
      .then((d) => {
        setBuku(d);
        tulisCache(`gaji-buku-${y}`, d);
      })
      .catch((e) => setGalat((e as Error).message));
  }
  function muatBulan() {
    gajiBulan(period).then(setBaris).catch(() => setBaris((l) => l ?? []));
    /* Diam-diam: kalau gagal, tombol salin sekadar tidak muncul. */
    gajiBulan(bulanSebelum(period)).then(setBulanLalu).catch(() => setBulanLalu([]));
  }
  function muatUlang() {
    muatBulan();
    muatBuku();
  }

  useEffect(() => {
    daftarTim().then(setTim).catch(() => setTim([]));
    ambilSettings().then((d) => setStudio(d.studioName || null)).catch(() => {});
  }, []);
  useEffect(() => {
    /* Jilid lain: yang lama tetap tergambar (rak dan sampulnya tidak
       berkedip) sampai jilid barunya tiba; indeksnya kosong sebentar. */
    setBuku((b) => bacaCache(`gaji-buku-${tahun}`) ?? b);
    muatBuku(tahun);
  }, [tahun]);
  useEffect(() => {
    setBaris(null);
    muatBulan();
  }, [period]);

  /* Ketukan jari di luar benda berketerangan menutup kartunya. */
  useEffect(() => {
    const tutup = (e: PointerEvent) => {
      if (e.pointerType === "mouse") return;
      if (!(e.target as Element).closest?.("[data-ket]")) kabar.current?.(null);
    };
    document.addEventListener("pointerdown", tutup);
    return () => document.removeEventListener("pointerdown", tutup);
  }, []);

  /* ---- Indeks bulan (12 tab jilid terpilih) ------------------------------ */
  const indeks = useMemo(() => {
    const semua = buku?.months ?? [];
    const ada = semua.filter((m) => m.period.startsWith(`${tahun}-`));
    const ini: BulanBuku[] = ada.length
      ? ada
      : Array.from({ length: 12 }, (_, i) => ({
          period: `${tahun}-${String(i + 1).padStart(2, "0")}`,
          salary: 0, salaryCount: 0, salaryUnpaid: 0, fee: 0, feeCount: 0, people: 0, total: 0,
        }));
    const maks = Math.max(1, ...ini.map((m) => m.total));
    /* Panjang tab = dasar (cukup untuk "Agu" dan titik amber) + rentang ×
       bagian bulan itu dari bulan tertinggi jilidnya — mulai dari NOL, jadi
       bulan setengahnya memang tergambar setengahnya. Dasar dan rentangnya
       di CSS (`--gji-tab0`, `--gji-tabr`), karena ikut lebar layar. */
    return ini.map((m) => ({ ...m, mendatang: m.period > BULAN_INI, rasio: m.total / maks }));
  }, [buku, tahun]);

  const bulanBuku = (k: string) => buku?.months.find((m) => m.period === k) ?? null;
  const sekarang = bulanBuku(period);
  const sebelum = bulanBuku(bulanSebelum(period));

  /* ---- Rak jilid: tiap tahun berdata, ditambah tahun ini ----------------- */
  const jilid = useMemo(() => {
    const per = new Map<number, JilidGaji>((buku?.years ?? []).map((y) => [y.year, y]));
    for (const y of [TAHUN_INI, tahun]) if (!per.has(y)) per.set(y, { year: y, salary: 0, fee: 0, total: 0 });
    const daftar = [...per.values()].sort((a, z) => a.year - z.year).slice(-5);
    const maks = Math.max(1, ...daftar.map((j) => j.total));
    return daftar.map((j) => ({ ...j, rasio: j.total / maks }));
  }, [buku, tahun]);

  /* Pembanding jilid: periode yang SAMA tahun lalu — sampai bulan ini untuk
     jilid berjalan, setahun penuh untuk jilid lama. */
  const banding = useMemo(() => {
    const batas = tahun === TAHUN_INI ? Number(BULAN_INI.slice(5, 7)) : 12;
    const jumlah = (y: number) =>
      (buku?.months ?? [])
        .filter((m) => m.period.startsWith(`${y}-`) && Number(m.period.slice(5, 7)) <= batas)
        .reduce((n, m) => n + m.total, 0);
    return { batas, kini: jumlah(tahun), lalu: jumlah(tahun - 1) };
  }, [buku, tahun]);

  /* ---- Lembar bulan terpilih --------------------------------------------- */
  const kelompok = useMemo(() => {
    let no = 0;
    return JENIS.map((j) => {
      const isi = (baris ?? []).filter((b) => b.kind === j).sort((a, z) => a.name.localeCompare(z.name, "id"));
      return {
        jenis: j,
        label: LABEL_JENIS_ANGGOTA[j],
        jumlah: isi.reduce((n, b) => n + b.total, 0),
        baris: isi.map((b): Baris => ({ ...b, no: ++no })),
      };
    }).filter((k) => k.baris.length > 0);
  }, [baris]);

  const ringkas = useMemo(() => {
    const d = baris ?? [];
    const bergaji = d.filter((b) => b.salaryId);
    return {
      gaji: d.reduce((a, b) => a + (b.salaryAmount ?? 0), 0),
      fee: d.reduce((a, b) => a + b.feeAmount, 0),
      total: d.reduce((a, b) => a + b.total, 0),
      bergaji: bergaji.length,
      diterima: bergaji.filter((b) => b.salaryPaidOn).length,
      gajiDiterima: bergaji.filter((b) => b.salaryPaidOn).reduce((a, b) => a + (b.salaryAmount ?? 0), 0),
    };
  }, [baris]);

  /* Yang disalin HANYA nominalnya, dan selalu sebagai BELUM DIBAYAR — menyalin
     tanggal bayar bulan lalu berarti menandai gaji bulan ini lunas padahal
     uangnya belum keluar. Orang yang bulan ini sudah punya baris dilewati,
     bukan ditimpa. */
  const bisaDisalin = bulanLalu.filter(
    (l) => l.salaryId && !baris?.some((b) => b.teamMemberId === l.teamMemberId && b.salaryId),
  );

  async function salinBulanLalu() {
    if (bisaDisalin.length === 0) return;
    setMenyalin(true);
    let berhasil = 0;
    const gagal: string[] = [];
    for (const l of bisaDisalin) {
      try {
        await catatGaji({
          teamMemberId: l.teamMemberId,
          period,
          amount: l.salaryAmount as number,
          paidOn: null,
          note: l.salaryNote ?? null,
        });
        berhasil++;
      } catch (e) {
        gagal.push(`${l.name}: ${(e as Error).message}`);
      }
    }
    setMenyalin(false);
    muatUlang();
    /* Dilaporkan apa adanya, termasuk yang gagal. */
    if (gagal.length === 0) {
      toast({ judul: `${berhasil} gaji disalin`, keterangan: "Semuanya ditandai belum dibayar.", nada: "sukses" });
    } else {
      toast({ judul: `${berhasil} tersalin, ${gagal.length} gagal`, keterangan: gagal.join("; "), nada: "gagal" });
    }
  }

  async function tandaiDibayar(b: BarisGajiBulan, dibayar: boolean) {
    if (!b.salaryId || !baris) return;
    const sebelumnya = baris;
    const tgl = dibayar ? HARI_INI() : null;
    setBaris(baris.map((x) => (x.salaryId === b.salaryId ? { ...x, salaryPaidOn: tgl } : x)));
    try {
      await ubahGaji(b.salaryId, { paidOn: tgl });
      muatBuku();
    } catch (e) {
      setBaris(sebelumnya);
      toast({ judul: "Gagal mengubah status", keterangan: (e as Error).message, nada: "gagal" });
    }
  }

  function ekspor() {
    unduhCsv(`gaji-${period}.csv`, [
      ["No", "Nama", "Jenis", "Peran", "Gaji", "Fee bulan ini", "Jumlah", "Dibayar pada", "Catatan"],
      ...kelompok.flatMap((k) =>
        k.baris.map((b) => [
          String(b.no),
          b.name,
          LABEL_JENIS_ANGGOTA[b.kind],
          b.role ?? "",
          b.salaryAmount === null || b.salaryAmount === undefined ? "" : String(b.salaryAmount),
          String(b.feeAmount),
          String(b.total),
          b.salaryPaidOn ?? "",
          b.salaryNote ?? "",
        ]),
      ),
    ]);
  }

  /* ---- Penggaris baca -----------------------------------------------------
     Satu benda yang meluncur ke baris di bawah kursor (atau baris yang
     sedang difokus papan ketik). Letak barisnya dibaca SEKALI saat kursor
     masuk ke baris itu, bukan di penangan gulir (jebakan #21). Ia duduk di
     PITA kosong di bawah isi baris, jadi tidak pernah lewat di belakang
     tulisan (jebakan #70). */
  const wadahRef = useRef<HTMLDivElement>(null);
  const [garis, setGaris] = useState<{ y: number; bagian: number } | null>(null);
  function ukurGaris(tr: HTMLElement, b: Baris) {
    const w = wadahRef.current;
    if (!w) return;
    const y = tr.getBoundingClientRect().bottom - w.getBoundingClientRect().top + w.scrollTop;
    setGaris({ y, bagian: persen(b.total, ringkas.total) });
  }

  /* ---- Papan ketik di indeks: panah atas/bawah, Home, End ---------------- */
  const tabRef = useRef<(HTMLButtonElement | null)[]>([]);
  const indeksRef = useRef<HTMLDivElement>(null);
  /* Di ponsel indeksnya pita mendatar: tab bulan terpilih digeser ke
     tengah. Dibaca sekali per pergantian bulan, bukan saat digulir. Di
     desktop pita itu tidak bisa digulir, jadi ini tidak berbuat apa-apa. */
  useEffect(() => {
    const pita = indeksRef.current;
    const tab = tabRef.current[Number(period.slice(5, 7)) - 1];
    if (!pita || !tab || pita.scrollWidth <= pita.clientWidth) return;
    pita.scrollLeft = tab.offsetLeft - (pita.clientWidth - tab.offsetWidth) / 2;
  }, [period, buku !== null]);
  function tombolIndeks(e: React.KeyboardEvent, i: number) {
    const hidup = indeks.map((m, j) => (m.mendatang ? -1 : j)).filter((j) => j >= 0);
    const posisi = hidup.indexOf(i);
    let tujuan: number | null = null;
    if (e.key === "ArrowDown") tujuan = hidup[Math.min(posisi + 1, hidup.length - 1)]!;
    else if (e.key === "ArrowUp") tujuan = hidup[Math.max(posisi - 1, 0)]!;
    else if (e.key === "Home") tujuan = hidup[0]!;
    else if (e.key === "End") tujuan = hidup[hidup.length - 1]!;
    if (tujuan === null) return;
    e.preventDefault();
    setPeriod(indeks[tujuan]!.period);
    tabRef.current[tujuan]?.focus();
  }

  if (galat && !buku) {
    return (
      <div className="gji gji--galat" role="alert">
        <div className="gji__papan">
          <div className="gji__galat">
            <b>Buku gaji tidak bisa dibuka</b>
            <span>{galat}</span>
            <Tombol jenis="secondary" ukuran="small" kiri={ArrowClockwise} onClick={() => muatBuku()}>
              Coba lagi
            </Tombol>
          </div>
        </div>
      </div>
    );
  }
  if (!buku) return <Kerangka />;

  const nBulan = namaBulan(period);
  const nBulanLalu = namaBulan(bulanSebelum(period));
  const selisihBulan = sekarang && sebelum ? sekarang.total - sebelum.total : null;
  const trenBulan = sekarang && sebelum && sebelum.total > 0 ? ((sekarang.total - sebelum.total) / sebelum.total) * 100 : null;
  const trenJilid = banding.lalu > 0 ? ((banding.kini - banding.lalu) / banding.lalu) * 100 : null;
  const belumDibayar = ringkas.gaji - ringkas.gajiDiterima;
  const pctGaji = persen(ringkas.gaji, ringkas.total);
  const jumlahBaris = kelompok.reduce((n, k) => n + k.baris.length, 0);

  return (
    <div className="gji">
      <Keterangan kabar={kabar} />
      <div className="gji__papan">
        {/* ==== SAMPUL DALAM ================================================ */}
        <aside className="gji__sampul" aria-label="Rekap buku gaji">
          <header className="gji__judulbuku">
            <span>Buku gaji · Jilid {tahun}</span>
            <b>{studio ?? "Studio"}</b>
          </header>

          {/* Label tempel: rekap bulan yang sedang dibuka. */}
          <section className="gji__label" aria-label={`Rekap ${labelBulan(period)}`}>
            <p className="gji__labelatas">
              <span>Keluar untuk orang</span>
              <span>{labelBulan(period)}</span>
            </p>
            <p className="gji__total">{baris === null ? "…" : formatRupiah(ringkas.total)}</p>
            {selisihBulan !== null && (
              <p className="gji__beda">
                {trenBulan !== null && (
                  /* Naik bukan kabar buruk: orang yang sama dibayar lebih
                     wajar. Arah dibawa ikonnya, bukan warnanya. */
                  <LencanaTren naik={trenBulan >= 0} baik>
                    {teksPersen(Math.abs(trenBulan))}
                  </LencanaTren>
                )}
                <span>
                  <b>
                    {tanda(selisihBulan)}
                    {formatRupiah(Math.abs(selisihBulan))}
                  </b>{" "}
                  dari {nBulanLalu}
                </span>
              </p>
            )}
            <div className="gji__pecah">
              <p>
                <i className="gji__kotak gji__kotak--gaji" />
                <span>Gaji</span>
                <b>{formatRupiah(ringkas.gaji)}</b>
              </p>
              <p>
                <i className="gji__kotak gji__kotak--fee" />
                <span>Fee proyek</span>
                <b>{formatRupiah(ringkas.fee)}</b>
              </p>
              <span
                className="gji__pecahbatang"
                role="img"
                aria-label={`Gaji ${teksPersen(pctGaji)}, fee proyek ${teksPersen(100 - pctGaji)}`}
              >
                <i className="gji__kotak--gaji" style={{ width: `${pctGaji}%` }} />
                <i className="gji__kotak--fee" style={{ width: `${ringkas.total > 0 ? 100 - pctGaji : 0}%` }} />
              </span>
            </div>
          </section>

          {/* Tanda terima: berapa gaji tetap bulan ini yang sudah diterima. */}
          <section className="gji__terima" aria-label="Tanda terima gaji">
            <p className="gji__terimaatas">
              <span>Tanda terima gaji</span>
              <b>
                {ringkas.diterima} dari {ringkas.bergaji}
              </b>
            </p>
            <span
              className="gji__meter"
              role="img"
              aria-label={`Diterima ${formatRupiah(ringkas.gajiDiterima)}, belum ${formatRupiah(belumDibayar)}`}
            >
              <i className="gji__meter--terima" style={{ width: `${persen(ringkas.gajiDiterima, ringkas.gaji)}%` }} />
              <i className="gji__meter--belum" style={{ width: `${persen(belumDibayar, ringkas.gaji)}%` }} />
            </span>
            <p className={`gji__terimaket${belumDibayar > 0 ? " gji__terimaket--belum" : ""}`}>
              {baris === null
                ? "Memuat…"
                : ringkas.bergaji === 0
                  ? `Tidak ada gaji tetap di ${nBulan}`
                  : belumDibayar > 0
                    ? `${formatRupiah(belumDibayar)} belum dibayar`
                    : `Semua gaji ${nBulan} sudah diterima`}
            </p>
          </section>

          {/* Rak jilid: satu buku per tahun, tingginya = jumlah tahun itu. */}
          <section className="gji__rak" aria-label="Arsip jilid per tahun">
            <p className="gji__rakjudul">Arsip jilid</p>
            <div className="gji__rakisi" role="group" aria-label="Pilih jilid">
              {jilid.map((j) => (
                <button
                  key={j.year}
                  type="button"
                  className={`gji__jilid${j.year === tahun ? " is-aktif" : ""}${j.total === 0 ? " gji__jilid--kosong" : ""}`}
                  /* Tinggi = 52px + sisa rak × bagian jilid ini dari jilid
                     tertinggi; raknya sendiri mengisi sisa tinggi sampul. */
                  style={{ "--gji-r": j.rasio } as React.CSSProperties}
                  aria-pressed={j.year === tahun}
                  aria-label={`Jilid ${j.year}: ${formatRupiah(j.total)}`}
                  onClick={() => {
                    kabar.current?.(null);
                    if (j.year === tahun) return;
                    /* Jilid berjalan dibuka di bulan ini; jilid lama di
                       Desember — lembar terakhir yang ditutup. */
                    setPeriod(j.year === TAHUN_INI ? BULAN_INI : `${j.year}-12`);
                  }}
                  {...ket(() => ({
                    judul: `Jilid ${j.year}${j.year === TAHUN_INI ? " · berjalan" : ""}`,
                    baris: [
                      { warna: "var(--ramp-1)", label: "Gaji", nilai: formatRupiah(j.salary) },
                      { warna: "var(--ramp-2)", label: "Fee proyek", nilai: formatRupiah(j.fee) },
                      { label: "Jumlah", nilai: formatRupiah(j.total) },
                    ],
                  }))}
                >
                  <span className="gji__jilidpita" aria-hidden="true" />
                  <span className="gji__jilidtahun">{j.year}</span>
                </button>
              ))}
            </div>
            <p className="gji__rakket">
              <span>
                {tahun}
                {tahun === TAHUN_INI ? ` s.d. ${BULAN_PENDEK[banding.batas - 1]}` : ""}
              </span>
              <b>{formatRupiah(banding.kini)}</b>
              {trenJilid !== null && (
                <em>
                  {tanda(trenJilid)}
                  {teksPersen(Math.abs(trenJilid))} dari periode sama {tahun - 1}
                </em>
              )}
            </p>
          </section>
        </aside>

        {/* ==== LEMBAR ====================================================== */}
        <section className="gji__lembar" id="gji-lembar" aria-labelledby="gji-judul">
          <header className="gji__kop">
            <div className="gji__kopkiri">
              <p className="gji__kopatas">
                Daftar penerimaan gaji · Lembar {Number(period.slice(5, 7))}
              </p>
              <p className="gji__kopjudul">
                <span id="gji-judul" role="heading" aria-level={2}>
                  {labelBulan(period)}
                </span>
                <span className="gji__kopbawah">
                  {baris === null ? "Memuat…" : `${jumlahBaris} penerima`}
                  {sekarang && sekarang.salaryUnpaid > 0 && (
                    <span className="gji__kopbelum"> · {sekarang.salaryUnpaid} belum menerima gaji</span>
                  )}
                </span>
              </p>
            </div>
            <div className="gji__kopaksi">
              {/* Muncul HANYA kalau ada yang bisa disalin: tombol yang sering
                  tidak melakukan apa-apa mengajari staf mengabaikannya. */}
              {bisaDisalin.length > 0 && (
                <Tombol jenis="secondary" ukuran="small" kiri={CopySimple} memuat={menyalin} onClick={salinBulanLalu}>
                  Salin {bisaDisalin.length} dari {nBulanLalu}
                </Tombol>
              )}
              <DialogGaji
                tim={tim}
                period={period}
                onSelesai={muatUlang}
                pemicu={
                  <Tombol jenis="primary" ukuran="small" kiri={Plus}>
                    Catat gaji
                  </Tombol>
                }
              />
              <TombolIkon ikon={DownloadSimple} jenis="ghost" ukuran="small" judul="Unduh CSV" onClick={ekspor} />
            </div>
          </header>

          <div
            className="gji__wadah"
            ref={wadahRef}
            onPointerLeave={(e) => {
              if (e.pointerType === "mouse") setGaris(null);
            }}
          >
            {baris !== null && jumlahBaris === 0 ? (
              <p className="gji__kosong">
                Belum ada gaji atau fee di {labelBulan(period)}. Catat gaji bulanan dengan tombol di atas — fee
                freelancer muncul sendiri dari pengeluaran proyek yang dicatat di Keuangan.
              </p>
            ) : (
              <table className="gji__daftar">
                <colgroup>
                  <col className="gji__c-no" />
                  <col />
                  <col className="gji__c-uang" />
                  <col className="gji__c-uang" />
                  <col className="gji__c-jumlah" />
                  <col className="gji__c-ttd" />
                </colgroup>
                <thead>
                  <tr>
                    <th scope="col">No</th>
                    <th scope="col">Penerima</th>
                    <th scope="col" className="gji__angka">Gaji</th>
                    <th scope="col" className="gji__angka">Fee proyek</th>
                    <th scope="col" className="gji__angka">Jumlah</th>
                    <th scope="col" className="gji__ttdkepala">Tanda terima</th>
                  </tr>
                </thead>
                {baris === null ? (
                  <tbody>
                    {[0, 1, 2].map((i) => (
                      <tr key={i} className="gji__baris gji__baris--muat">
                        <td colSpan={6}>
                          <span className="rk" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                ) : (
                  kelompok.map((k) => (
                    <tbody key={k.jenis}>
                      <tr className="gji__grup">
                        <th scope="rowgroup" colSpan={4}>
                          {k.label}
                        </th>
                        <td className="gji__angka">{formatRupiah(k.jumlah)}</td>
                        <td />
                      </tr>
                      {k.baris.map((b) => (
                        <tr
                          key={b.teamMemberId}
                          className="gji__baris"
                          onPointerEnter={(e) => {
                            if (e.pointerType === "mouse") ukurGaris(e.currentTarget, b);
                          }}
                          onFocus={(e) => ukurGaris(e.currentTarget, b)}
                        >
                          <td className="gji__no">{String(b.no).padStart(2, "0")}</td>
                          <td className="gji__penerima">
                            {/* Nama = pintu ubah/hapus: satu kolom ikon pensil
                                untuk tiap orang memakan ruang angkanya. */}
                            <DialogGaji
                              tim={tim}
                              period={period}
                              awal={b}
                              onSelesai={muatUlang}
                              pemicu={
                                <button type="button" className="gji__nama">
                                  {b.name}
                                </button>
                              }
                            />
                            <span className="gji__peran">
                              {b.role ?? LABEL_JENIS_ANGGOTA[b.kind]}
                              {/* Slip orang ini di Bayaran Tim — sheet "GAJI
                                  <nama>" yang dulu disalin tangan. */}
                              <a href={`/admin/gaji/tim?orang=${encodeURIComponent(b.teamMemberId)}&bulan=${period}`}>Slip</a>
                            </span>
                          </td>
                          <td className="gji__angka">
                            {b.salaryAmount === null || b.salaryAmount === undefined ? (
                              <span className="gji__redup">—</span>
                            ) : (
                              formatRupiah(b.salaryAmount)
                            )}
                          </td>
                          <td className="gji__angka">
                            {b.feeAmount === 0 ? (
                              <span className="gji__redup">—</span>
                            ) : (
                              /* Tidak bisa diketik di sini; keterangannya
                                 menjawab "kenapa" di tempat pertanyaan itu muncul. */
                              <span
                                className="gji__fee"
                                {...ket(() => ({
                                  judul: `Fee ${b.name} · ${nBulan}`,
                                  baris: [
                                    { label: `${b.feeCount} biaya proyek`, nilai: formatRupiah(b.feeAmount) },
                                    { label: "Diubah di", nilai: "Keuangan" },
                                  ],
                                }))}
                              >
                                {formatRupiah(b.feeAmount)}
                              </span>
                            )}
                          </td>
                          <td className="gji__angka gji__jumlah">{formatRupiah(b.total)}</td>
                          <td className={`gji__ttd gji__ttd--${b.no % 2 ? "kiri" : "kanan"}`}>
                            <span className="gji__ttdslot">
                              <span className="gji__ttdno">{b.no}.</span>
                              <TandaTerima b={b} bulan={nBulan} onTandai={(v) => tandaiDibayar(b, v)} />
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  ))
                )}
                {baris !== null && jumlahBaris > 0 && (
                  <tfoot>
                    <tr>
                      <th scope="row" colSpan={2}>
                        Jumlah
                      </th>
                      <td className="gji__angka">{formatRupiah(ringkas.gaji)}</td>
                      <td className="gji__angka">{formatRupiah(ringkas.fee)}</td>
                      <td className="gji__angka gji__jumlah">{formatRupiah(ringkas.total)}</td>
                      <td className="gji__ttdjumlah">
                        {ringkas.bergaji > 0 ? `${ringkas.diterima}/${ringkas.bergaji} diterima` : ""}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            )}
            {garis && (
              /* Dipasang hanya selama kursor di atas daftar: penggaris yang
                 baru muncul langsung berdiri di barisnya, dan transisi
                 `transform` hanya berlaku saat ia pindah baris. */
              <span
                className="gji__penggaris"
                style={{ transform: `translateY(${garis.y}px)` }}
                aria-hidden="true"
              >
                <span className="gji__penggarisbadan">
                  <i style={{ width: `${garis.bagian}%` }} />
                </span>
                <span className="gji__penggarisket">
                  {teksPersen(Math.round(garis.bagian * 10) / 10)} dari {nBulan}
                </span>
              </span>
            )}
          </div>

          {baris !== null && jumlahBaris > 0 && (
            <p className="gji__terbilang">
              <span>Terbilang</span>
              <em>{terbilang(ringkas.total)}</em>
            </p>
          )}
        </section>

        {/* ==== INDEKS BULAN ================================================ */}
        <div className="gji__indeks" ref={indeksRef} role="tablist" aria-orientation="vertical" aria-label={`Bulan di jilid ${tahun}`}>
          {indeks.map((m, i) => {
            const aktif = m.period === period;
            return (
              <button
                key={m.period}
                ref={(el) => {
                  tabRef.current[i] = el;
                }}
                type="button"
                role="tab"
                aria-selected={aktif}
                aria-controls="gji-lembar"
                tabIndex={aktif ? 0 : -1}
                disabled={m.mendatang}
                className={`gji__tab${aktif ? " is-aktif" : ""}${m.total === 0 && !m.mendatang ? " gji__tab--kosong" : ""}`}
                style={{ "--gji-t": m.mendatang ? 0 : m.rasio } as React.CSSProperties}
                aria-label={`${labelBulan(m.period)}${m.mendatang ? ", belum tiba" : `: ${formatRupiah(m.total)}`}${m.salaryUnpaid ? `, ${m.salaryUnpaid} gaji belum dibayar` : ""}`}
                onClick={() => setPeriod(m.period)}
                onKeyDown={(e) => tombolIndeks(e, i)}
                {...(m.mendatang
                  ? {}
                  : ket(() => ({
                      judul: labelBulan(m.period),
                      baris: [
                        { warna: "var(--ramp-1)", label: "Gaji", nilai: formatRupiah(m.salary) },
                        { warna: "var(--ramp-2)", label: "Fee proyek", nilai: formatRupiah(m.fee) },
                        { label: `Jumlah · ${m.people} orang`, nilai: formatRupiah(m.total) },
                        ...(m.salaryUnpaid
                          ? [{ warna: "var(--warn)", label: "Belum dibayar", nilai: `${m.salaryUnpaid} gaji` }]
                          : []),
                      ],
                    })))}
              >
                <span className="gji__tablabel">{BULAN_PENDEK[i]}</span>
                {m.salaryUnpaid > 0 && <i className="gji__tabtitik" aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ── Tanda terima ────────────────────────────────────────────────────────────
 * Tiga keadaan, sama dengan formulir kertasnya:
 *   - gaji sudah dibayar → CAP bulat "DITERIMA" bertanggal (klik = batalkan)
 *   - gaji belum dibayar → garis tanda tangan kosong + tombol "Tandai dibayar"
 *   - hanya fee          → tanpa tanda terima: fee proyek sudah uang yang
 *                          keluar saat dicatat, bukan janji yang menunggu
 */
function TandaTerima({ b, bulan, onTandai }: { b: BarisGajiBulan; bulan: string; onTandai: (dibayar: boolean) => void }) {
  if (!b.salaryId) {
    return <span className="gji__ttdfee">fee proyek</span>;
  }
  if (b.salaryPaidOn) {
    const [, m, h] = b.salaryPaidOn.split("-");
    return (
      <button
        type="button"
        className="gji__cap"
        aria-label={`Gaji ${bulan} diterima ${tanggalPendek(b.salaryPaidOn)}. Tekan untuk membatalkan tanda.`}
        title={`Diterima ${tanggalPendek(b.salaryPaidOn)} — klik untuk membatalkan`}
        onClick={() => onTandai(false)}
      >
        <svg viewBox="0 0 48 48" width="46" height="46" aria-hidden="true">
          <defs>
            <path id={`gji-busur-${b.salaryId}`} d="M 8.5 25 A 15.5 15.5 0 0 1 39.5 25" />
          </defs>
          <circle cx="24" cy="24" r="22.5" className="gji__capluar" />
          <circle cx="24" cy="24" r="19.5" className="gji__capdalam" />
          <text className="gji__capbusur">
            <textPath href={`#gji-busur-${b.salaryId}`} startOffset="50%" textAnchor="middle">
              DITERIMA
            </textPath>
          </text>
          <text x="24" y="33" textAnchor="middle" className="gji__captgl">
            {`${Number(h)}/${Number(m)}`}
          </text>
        </svg>
      </button>
    );
  }
  return (
    <button type="button" className="gji__tandai" onClick={() => onTandai(true)}>
      Tandai dibayar
    </button>
  );
}

/* ── Kerangka memuat: berbentuk buku, setinggi buku aslinya ───────────────── */
function Kerangka(): ReactNode {
  return (
    <div className="gji gji--rangka" aria-busy="true">
      <div className="gji__papan">
        <aside className="gji__sampul">
          <span className="rk rk--gelap" style={{ width: "60%", height: 12 }} />
          <span className="rk rk--gelap" style={{ width: "80%", height: 16 }} />
          <div className="gji__label">
            <span className="rk" style={{ width: "70%", height: 12 }} />
            <span className="rk" style={{ width: "85%", height: 26 }} />
            <span className="rk" style={{ width: "60%", height: 12 }} />
          </div>
        </aside>
        <section className="gji__lembar">
          <header className="gji__kop">
            <div className="gji__kopkiri">
              <span className="rk" style={{ width: 180, height: 10 }} />
              <span className="rk" style={{ width: 160, height: 22 }} />
            </div>
          </header>
        </section>
        <div className="gji__indeks">
          {Array.from({ length: 12 }, (_, i) => (
            <span key={i} className="gji__tab gji__tab--rangka" style={{ "--gji-t": 0.25 } as React.CSSProperties} />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Dialog catat / ubah gaji ────────────────────────────────────────────
 * Satu dialog untuk dua hal, dan hapus tinggal di dalamnya: nama orang di
 * daftar adalah pintunya. */
function DialogGaji({
  tim,
  period,
  awal,
  pemicu,
  onSelesai,
}: {
  tim: AnggotaTim[];
  period: string;
  awal?: BarisGajiBulan;
  pemicu: React.ReactNode;
  onSelesai: () => void;
}) {
  const toast = useToast();
  const [buka, setBuka] = useState(false);
  const [orang, setOrang] = useState("");
  const [nominal, setNominal] = useState<number | null>(null);
  const [dibayar, setDibayar] = useState("");
  const [catatan, setCatatan] = useState("");
  const [kirim, setKirim] = useState(false);

  const ubah = Boolean(awal?.salaryId);
  const alasan = !orang ? "Pilih orangnya dulu." : !nominal || nominal <= 0 ? "Isi nominal gajinya." : null;

  /* Nilai awal disetel ulang tiap dialog dibuka: komponennya tetap hidup di
     antara pembukaan, jadi tanpa ini isian membawa sisa ketikan yang batal. */
  function saatBuka(b: boolean) {
    setBuka(b);
    if (b) {
      setOrang(awal?.teamMemberId ?? "");
      setNominal(awal?.salaryAmount ?? null);
      setDibayar(awal?.salaryPaidOn ?? "");
      setCatatan(awal?.salaryNote ?? "");
    }
  }

  /* Freelancer dibayar per proyek. Tidak disaring — seorang freelancer inti
     bisa saja diberi retainer — tapi diingatkan. */
  const jenisTerpilih = tim.find((t) => t.id === orang)?.kind;
  const perluIngat = jenisTerpilih === "proyek" || jenisTerpilih === "inti";

  async function simpan() {
    if (alasan) return;
    setKirim(true);
    try {
      if (ubah && awal?.salaryId) {
        await ubahGaji(awal.salaryId, { amount: nominal as number, paidOn: dibayar || null, note: catatan.trim() || null });
      } else {
        await catatGaji({
          teamMemberId: orang,
          period,
          amount: nominal as number,
          paidOn: dibayar || null,
          note: catatan.trim() || null,
        });
      }
      setBuka(false);
      onSelesai();
      toast({ judul: ubah ? "Gaji diperbarui" : "Gaji tercatat", nada: "sukses" });
    } catch (e) {
      toast({ judul: "Gagal menyimpan", keterangan: (e as Error).message, nada: "gagal" });
    } finally {
      setKirim(false);
    }
  }

  async function hapus() {
    if (!awal?.salaryId) return;
    try {
      await hapusGaji(awal.salaryId);
      setBuka(false);
      onSelesai();
      toast({ judul: "Baris gaji dihapus", nada: "sukses" });
    } catch (e) {
      toast({ judul: "Gagal menghapus", keterangan: (e as Error).message, nada: "gagal" });
    }
  }

  return (
    <Dialog
      open={buka}
      onOpenChange={saatBuka}
      title={awal ? (ubah ? `Ubah gaji ${awal.name}` : `Catat gaji ${awal.name}`) : "Catat gaji"}
      description={labelBulan(period)}
      trigger={pemicu}
      footer={
        <div className="gaji__kaki">
          {ubah && (
            <AlertDialog
              destructive
              title="Hapus baris gaji ini?"
              description={`${awal!.name} — ${labelBulan(period)}`}
              confirmLabel="Ya, hapus"
              onConfirm={hapus}
              trigger={
                <button type="button" className="pas__hapus">
                  Hapus gaji
                </button>
              }
            />
          )}
          {alasan && <small className="gaji__alasan">{alasan}</small>}
          <Tombol memuat={kirim} ukuran="large" jenis="primary" disabled={Boolean(alasan) || kirim} onClick={simpan}>
            {kirim ? "Menyimpan…" : "Simpan"}
          </Tombol>
        </div>
      }
    >
      <div className="gaji__form">
        <div className="k-isian">
          <label className="k-isian__label" htmlFor="gj-orang">
            Orang
          </label>
          <PilihMenu
            id="gj-orang"
            nilai={orang}
            placeholder="Pilih orang…"
            /* Saat mengubah, orangnya dikunci: memindahkan baris ke nama
               lain bisa menabrak baris yang sudah ada di bulan itu. */
            disabled={Boolean(awal)}
            onUbah={setOrang}
            opsi={tim
              .filter((t) => t.active || t.id === orang)
              .map((t) => ({ nilai: t.id, label: t.role ? `${t.name} — ${t.role}` : t.name }))}
          />
          {perluIngat && !ubah && (
            <p className="k-isian__bantu">Freelancer — fee proyeknya sudah otomatis masuk kolom Fee.</p>
          )}
        </div>
        <div className="gaji__dua">
          <IsianTempel
            label="Nominal"
            kiri="Rp"
            inputMode="numeric"
            placeholder="0"
            value={nominal === null ? "" : nominal.toLocaleString("id-ID")}
            onChange={(e) => {
              const angka = e.currentTarget.value.replace(/\D/g, "");
              setNominal(angka ? Number(angka) : null);
            }}
          />
          <IsianTanggal label="Dibayar pada" nilai={dibayar} onUbah={setDibayar} placeholder="Belum dibayar" />
        </div>
        <Isian
          label="Catatan"
          maxLength={400}
          placeholder="Opsional — mis. termasuk tunjangan transport"
          value={catatan}
          onChange={(e) => setCatatan(e.currentTarget.value)}
        />
      </div>
    </Dialog>
  );
}

export function GajiKit() {
  return (
    <RequireAuth skeleton={<Kerangka />}>
      <ToastProvider>
        <Isi />
      </ToastProvider>
    </RequireAuth>
  );
}
