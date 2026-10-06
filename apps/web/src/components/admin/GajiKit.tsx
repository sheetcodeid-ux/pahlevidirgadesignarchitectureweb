import { IsianTempel, PilihMenu, IsianTanggal } from "../kit/Formulir";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { RequireAuth } from "./RequireAuth";
import { LencanaTren } from "../kit/Ukuran";
import { Tombol, TombolIkon } from "../kit/Tombol";
import { Isian } from "../kit/Isian";
import { ArrowClockwise, Check, CopySimple, DownloadSimple, Plus } from "../kit/ikon";
import { Ikon } from "../kit/Ikon";
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
  type StudioSettings,
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

/* Lembar REKAPITULASI = halaman depan jilid, sebelum Januari. Kuncinya
   "YYYY-00", jadi urutan string tetap urutan buku (rekap < Jan < … < Des)
   dan arah balik halamannya ikut benar tanpa kasus khusus. */
const adalahRekap = (period: string) => period.endsWith("-00");
const kunciRekap = (tahun: number) => `${tahun}-00`;
const namaBulan = (period: string) => (adalahRekap(period) ? "Rekapitulasi" : BULAN[Number(period.slice(5, 7)) - 1]!);
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

/** "Dirga Pahlevi Architecture" → "DPA"; "Sari Ningsih" → "SN". */
const inisial = (nama: string, n = 2) =>
  nama
    .split(/\s+/)
    .filter(Boolean)
    .map((k) => k[0]!.toUpperCase())
    .slice(0, n)
    .join("");

const hariDalamBulan = (period: string) => {
  const [y, m] = period.split("-").map(Number);
  return new Date(y!, m!, 0).getDate();
};

/** Bulan dari `?bulan=YYYY-MM` — tautan dari halaman lain mendarat di lembar
 *  bulan itu. Bulan yang belum datang tidak bisa dibuka. */
function bulanDariAlamat(): string {
  if (typeof location === "undefined") return BULAN_INI;
  const b = new URLSearchParams(location.search).get("bulan");
  return b && /^\d{4}-\d{2}$/.test(b) && b <= BULAN_INI ? b : BULAN_INI;
}


interface Baris extends BarisGajiBulan {
  no: number;
  /** Jumlah semua baris SEBELUM baris ini, dalam urutan lembar — untuk
   *  penggaris yang mengukur kumulatif. */
  kumSebelum: number;
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
  /* Sampul: nama dan logo studio dari Info Studio. Kunci cache `settings`
     milik Info Studio — di sini dibaca saja (jebakan #8). */
  const [studio, setStudio] = useState<{ nama: string; logo: string | null } | null>(() => {
    const s = bacaCache<StudioSettings>("settings");
    return s?.studioName ? { nama: s.studioName, logo: s.logoUrl ?? null } : null;
  });
  /* Cap yang baru saja dibubuhkan: hanya dia yang "tercap" (geraknya sekali,
     sebagai jawaban atas klik — bukan animasi masuk halaman). */
  const [capBaru, setCapBaru] = useState<string | null>(null);

  function muatBuku(y = tahun) {
    setGalat(null);
    bukuGaji(y)
      .then((d) => {
        setBuku(d);
        tulisCache(`gaji-buku-${y}`, d);
      })
      .catch((e) => setGalat((e as Error).message));
  }
  /* Lembar yang sudah pernah diambil, per bulan — di MEMORI halaman saja,
     bukan sessionStorage. Gunanya satu: saat halaman dibalik, lembar baru
     sudah berisi, bukan kerangka. Setiap penulisan mengosongkannya (aturan
     yang sama dengan cache panel: menebak bulan mana yang berubah adalah
     cara paling mudah menampilkan angka basi). */
  const simpanan = useRef(new Map<string, BarisGajiBulan[]>());
  function ambilBulan(k: string): Promise<BarisGajiBulan[]> {
    const ada = simpanan.current.get(k);
    if (ada) return Promise.resolve(ada);
    return gajiBulan(k).then((d) => {
      simpanan.current.set(k, d);
      return d;
    });
  }
  /* Diambil lebih dulu saat kursor/fokus mendekati tab bulan itu. */
  function siapkan(k: string) {
    if (k <= BULAN_INI && !simpanan.current.has(k)) ambilBulan(k).catch(() => {});
  }
  function muatBulan() {
    const k = period;
    if (adalahRekap(k)) return; // halaman depan dihitung dari buku, bukan daftar bulan
    gajiBulan(k)
      .then((d) => {
        simpanan.current.set(k, d);
        setBaris(d);
      })
      .catch(() => setBaris((l) => l ?? []));
    /* Diam-diam: kalau gagal, tombol salin sekadar tidak muncul. */
    ambilBulan(bulanSebelum(k)).then(setBulanLalu).catch(() => setBulanLalu([]));
  }
  function muatUlang() {
    simpanan.current.clear();
    muatBulan();
    muatBuku();
  }

  useEffect(() => {
    daftarTim().then(setTim).catch(() => setTim([]));
    ambilSettings()
      .then((d) => setStudio(d.studioName ? { nama: d.studioName, logo: d.logoUrl ?? null } : null))
      .catch(() => {});
  }, []);
  useEffect(() => {
    /* Jilid lain: yang lama tetap tergambar (rak dan sampulnya tidak
       berkedip) sampai jilid barunya tiba; indeksnya kosong sebentar. */
    setBuku((b) => bacaCache(`gaji-buku-${tahun}`) ?? b);
    muatBuku(tahun);
  }, [tahun]);
  useEffect(() => {
    if (adalahRekap(period)) {
      setBaris([]);
      setBulanLalu([]);
      siapkan(`${period.slice(0, 4)}-01`);
      return;
    }
    /* Lembar yang sudah tersimpan tampil seketika (dan sudah tergambar oleh
       balikHalaman); permintaan segar tetap jalan di belakang. */
    setBaris(simpanan.current.get(period) ?? null);
    muatBulan();
    /* Bulan di kiri-kanannya disiapkan: membalik satu halaman ke depan atau
       ke belakang hampir selalu tidak menunggu jaringan. */
    siapkan(bulanSebelum(period));
    const [y, m] = period.split("-").map(Number);
    siapkan(kunciBulan(new Date(y!, m!, 1)));
  }, [period]);

  /* ---- Balik halaman --------------------------------------------------------
     Pindah bulan = membalik lembar buku (View Transitions): lembar lama
     berputar di engsel jilidnya; ke depan ia terangkat ke kiri, ke belakang
     lembar baru turun dari kiri menutupi yang lama. Lembar tujuan disiapkan
     dulu (paling lama 350 ms) supaya yang terbuka berisi, bukan kerangka.
     Hanya lembarnya yang bergerak — sampul, indeks, dan pita berganti
     seketika. Peramban tanpa API ini, atau gerak dikurangi: seketika. */
  const giliran = useRef(0);
  async function balikHalaman(tujuan: string) {
    kabar.current?.(null);
    if (tujuan === period) return;
    const ke = ++giliran.current;
    let isi = adalahRekap(tujuan) ? [] : simpanan.current.get(tujuan) ?? null;
    if (!isi) {
      isi = await Promise.race([
        ambilBulan(tujuan).catch(() => null),
        new Promise<null>((r) => window.setTimeout(() => r(null), 350)),
      ]);
    }
    if (ke !== giliran.current) return; // sudah ada klik yang lebih baru
    const ganti = () =>
      flushSync(() => {
        setGaris(null);
        setPeriod(tujuan);
        setBaris(isi);
      });
    const dok = document as Document & {
      startViewTransition?: (ubah: () => void) => { finished: Promise<void> };
    };
    if (!dok.startViewTransition || matchMedia("(prefers-reduced-motion: reduce)").matches) {
      ganti();
      return;
    }
    const akar = document.documentElement;
    const arah = tujuan > period ? "gji-maju" : "gji-mundur";
    akar.classList.add("gji-balik", arah);
    const vt = dok.startViewTransition(ganti);
    vt.finished.finally(() => akar.classList.remove("gji-balik", "gji-maju", "gji-mundur"));
  }

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
    /* Bulan yang sama tahun lalu: takik hantu di tepi atas tiap tab. Skala
       memuat KEDUA tahun, supaya takik dan tab bisa dibandingkan. */
    const lalu = semua.filter((m) => m.period.startsWith(`${tahun - 1}-`));
    const maks = Math.max(1, ...ini.map((m) => m.total), ...lalu.map((m) => m.total));
    /* Panjang tab = dasar (cukup untuk "Agu" dan titik amber) + rentang ×
       bagian bulan itu dari bulan tertinggi — mulai dari NOL, jadi bulan
       setengahnya memang tergambar setengahnya. Dasar dan rentangnya di CSS
       (`--gji-tab0`, `--gji-tabr`), karena ikut lebar layar. */
    return ini.map((m, i) => ({
      ...m,
      mendatang: m.period > BULAN_INI,
      rasio: m.total / maks,
      lalu: lalu[i]?.total ?? 0,
      rasioLalu: (lalu[i]?.total ?? 0) / maks,
    }));
  }, [buku, tahun]);

  const bulanBuku = (k: string) => buku?.months.find((m) => m.period === k) ?? null;
  const rekap = adalahRekap(period);
  const sekarang = rekap ? null : bulanBuku(period);
  const sebelum = rekap ? null : bulanBuku(bulanSebelum(period));
  /* Bulan yang disorot di halaman rekap (baris, ruas sampul, cap bulan). */
  const [sorotBulan, setSorotBulan] = useState<string | null>(null);

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

  /* ---- Halaman depan: rekapitulasi jilid ----------------------------------
     Semua dari buku (24 bulan) — tanpa permintaan baru. Rata-rata dibagi
     bulan BERJALAN (bulan kosong ikut), skala batang sama dengan tab indeks
     (kedua tahun), jadi takik tahun lalu di sini dan di tab sepakat. */
  const rekapJilid = useMemo(() => {
    const bulan = indeks.map((m, i) => ({ ...m, ke: i + 1, lunas: m.salaryCount > 0 && m.salaryUnpaid === 0 }));
    const berjalan = bulan.filter((m) => !m.mendatang);
    const gaji = berjalan.reduce((n, m) => n + m.salary, 0);
    const fee = berjalan.reduce((n, m) => n + m.fee, 0);
    const maks = Math.max(1, ...bulan.map((m) => Math.max(m.total, m.lalu)));
    return {
      bulan,
      berjalan,
      gaji,
      fee,
      total: gaji + fee,
      rata: berjalan.length ? (gaji + fee) / berjalan.length : 0,
      maks,
      bergajiBulan: berjalan.filter((m) => m.salaryCount > 0).length,
      lunas: berjalan.filter((m) => m.lunas).length,
      belum: berjalan.filter((m) => m.salaryUnpaid > 0).length,
    };
  }, [indeks]);

  /* ---- Lembar bulan terpilih --------------------------------------------- */
  const kelompok = useMemo(() => {
    let no = 0;
    let kum = 0;
    return JENIS.map((j) => {
      const isi = (baris ?? []).filter((b) => b.kind === j).sort((a, z) => a.name.localeCompare(z.name, "id"));
      return {
        jenis: j,
        label: LABEL_JENIS_ANGGOTA[j],
        jumlah: isi.reduce((n, b) => n + b.total, 0),
        baris: isi.map((b): Baris => {
          const r = { ...b, no: ++no, kumSebelum: kum };
          kum += b.total;
          return r;
        }),
      };
    }).filter((k) => k.baris.length > 0);
  }, [baris]);
  /* Urutan lembar, rata — dipakai batang penerima di label dan cap kecil. */
  const urut = useMemo(() => kelompok.flatMap((k) => k.baris), [kelompok]);

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
    if (dibayar) {
      const id = b.salaryId;
      setCapBaru(id);
      window.setTimeout(() => setCapBaru((c) => (c === id ? null : c)), 700);
    }
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
  const barisRef = useRef(new Map<string, HTMLTableRowElement>());
  const [garis, setGaris] = useState<{ y: number; id: string; bagian: number; kumA: number; kumB: number } | null>(null);
  function ukurGaris(tr: HTMLElement, b: Baris) {
    const w = wadahRef.current;
    if (!w) return;
    const y = tr.getBoundingClientRect().bottom - w.getBoundingClientRect().top + w.scrollTop;
    setGaris({
      y,
      id: b.teamMemberId,
      bagian: persen(b.total, ringkas.total),
      kumA: persen(b.kumSebelum, ringkas.total),
      kumB: persen(b.kumSebelum + b.total, ringkas.total),
    });
  }
  /* Menyorot dari luar lembar (batang penerima, cap kecil di sampul): baris
     yang sama dicari lewat ref, digulir bila perlu, lalu diukur. */
  function sorotkan(b: Baris, gulir = false) {
    const tr = barisRef.current.get(b.teamMemberId);
    if (!tr) return;
    if (gulir) tr.scrollIntoView({ block: "nearest" });
    ukurGaris(tr, b);
  }
  const sorot = garis?.id ?? null;
  const kelasSorot = (id: string) => (sorot ? (sorot === id ? " is-sorot" : " is-redup") : "");

  /* ---- Papan ketik di indeks: panah atas/bawah, Home, End ---------------- */
  const tabRef = useRef<(HTMLButtonElement | null)[]>([]);
  const rekapRef = useRef<HTMLButtonElement | null>(null);
  const indeksRef = useRef<HTMLDivElement>(null);
  const tabUntuk = (k: string) => (adalahRekap(k) ? rekapRef.current : tabRef.current[Number(k.slice(5, 7)) - 1]);
  /* Urutan lembar jilid ini yang bisa dibuka: halaman depan, lalu bulan yang
     sudah tiba. */
  const urutLembar = [kunciRekap(tahun), ...indeks.filter((m) => !m.mendatang).map((m) => m.period)];
  /* Di ponsel indeksnya pita mendatar: tab bulan terpilih digeser ke
     tengah. Dibaca sekali per pergantian bulan, bukan saat digulir. Di
     desktop pita itu tidak bisa digulir, jadi ini tidak berbuat apa-apa. */
  useEffect(() => {
    const pita = indeksRef.current;
    const tab = tabUntuk(period);
    if (!pita || !tab || pita.scrollWidth <= pita.clientWidth) return;
    pita.scrollLeft = tab.offsetLeft - (pita.clientWidth - tab.offsetWidth) / 2;
  }, [period, buku !== null]);
  function tombolIndeks(e: React.KeyboardEvent, k: string) {
    const i = urutLembar.indexOf(k);
    let j: number | null = null;
    if (e.key === "ArrowDown") j = Math.min(i + 1, urutLembar.length - 1);
    else if (e.key === "ArrowUp") j = Math.max(i - 1, 0);
    else if (e.key === "Home") j = 0;
    else if (e.key === "End") j = urutLembar.length - 1;
    if (j === null) return;
    e.preventDefault();
    e.stopPropagation();
    const tujuan = urutLembar[j]!;
    tabUntuk(tujuan)?.focus();
    void balikHalaman(tujuan);
  }

  /* Membalik dengan papan ketik di mana saja di halaman: ← / PageUp ke
     belakang, → / PageDown ke depan. Tidak menyala di isian, di dalam dialog
     atau menu, atau bersama tombol pengubah — itu milik kontrolnya sendiri. */
  const langkah = useRef<(arah: -1 | 1) => void>(() => {});
  langkah.current = (arah) => {
    const i = urutLembar.indexOf(period);
    const j = i + arah;
    if (i < 0 || j < 0 || j >= urutLembar.length) return;
    void balikHalaman(urutLembar[j]!);
  };
  useEffect(() => {
    const tekan = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      const arah = e.key === "ArrowLeft" || e.key === "PageUp" ? -1 : e.key === "ArrowRight" || e.key === "PageDown" ? 1 : 0;
      if (!arah) return;
      const t = e.target as HTMLElement | null;
      if (t?.closest?.('input, textarea, select, [contenteditable="true"], [role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"], [role="slider"]')) return;
      if (document.querySelector('[role="dialog"], [role="alertdialog"]')) return;
      e.preventDefault();
      langkah.current(arah);
    };
    document.addEventListener("keydown", tekan);
    return () => document.removeEventListener("keydown", tekan);
  }, []);

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
  const jumlahBaris = urut.length;
  const bergaji = urut.filter((b) => b.salaryId);
  const namaStudio = studio?.nama ?? "Studio";
  const inisialStudio = inisial(namaStudio, 3);
  const bulanKe = Number(period.slice(5, 7));
  /* Tanggal bayar terakhir bulan ini — untuk cap LUNAS di baris Jumlah. */
  const bayarTerakhir = bergaji.reduce<string | null>((t, b) => (b.salaryPaidOn && (!t || b.salaryPaidOn > t) ? b.salaryPaidOn : t), null);
  const lunasBulan = ringkas.bergaji > 0 && ringkas.diterima === ringkas.bergaji;
  const kelasBulan = (k: string) => (sorotBulan ? (sorotBulan === k ? " is-sorot" : " is-redup") : "");
  const keteranganBulan = (m: (typeof rekapJilid.bulan)[number]) => ({
    judul: labelBulan(m.period),
    baris: [
      { warna: "var(--ramp-1)", label: "Gaji", nilai: formatRupiah(m.salary) },
      { warna: "var(--ramp-2)", label: "Fee proyek", nilai: formatRupiah(m.fee) },
      { label: `Jumlah · ${m.people} orang`, nilai: formatRupiah(m.total) },
      ...(m.lalu > 0 ? [{ label: `${BULAN_PENDEK[m.ke - 1]} ${tahun - 1}`, nilai: formatRupiah(m.lalu) }] : []),
      ...(m.salaryUnpaid ? [{ warna: "var(--warn)", label: "Belum dibayar", nilai: `${m.salaryUnpaid} gaji` }] : []),
    ],
  });
  function eksporRekap() {
    unduhCsv(`gaji-rekap-${tahun}.csv`, [
      ["Bulan", "Gaji", "Fee proyek", "Jumlah", "Penerima", "Gaji belum dibayar", `Jumlah ${tahun - 1}`],
      ...rekapJilid.bulan
        .filter((m) => !m.mendatang)
        .map((m) => [labelBulan(m.period), String(m.salary), String(m.fee), String(m.total), String(m.people), String(m.salaryUnpaid), String(m.lalu)]),
    ]);
  }

  return (
    <div className="gji">
      <Keterangan kabar={kabar} />
      <div className="gji__papan">
        {/* Pita pembatas buku: selalu menandai lembar BULAN BERJALAN. Dari
            lembar lain, menariknya membuka kembali bulan ini. Ia tergantung di
            lipatan antara sampul dan lembar — ruang kosong 16px yang tidak
            dilewati tulisan apa pun, juga saat ia berayun (±2,5°). */}
        <button
          type="button"
          className={`gji__pita${period === BULAN_INI ? " is-di-sini" : ""}`}
          aria-label={
            period === BULAN_INI
              ? `Pita pembatas di lembar bulan ini, ${labelBulan(BULAN_INI)}`
              : `Kembali ke lembar bulan ini, ${labelBulan(BULAN_INI)}`
          }
          onClick={() => void balikHalaman(BULAN_INI)}
          {...ket(() => ({
            judul: "Pita pembatas",
            baris: [
              { label: "Menandai", nilai: labelBulan(BULAN_INI) },
              ...(period === BULAN_INI ? [] : [{ label: "Tarik untuk", nilai: "kembali ke sini" }]),
            ],
          }))}
        >
          <span className="gji__pitateks">{BULAN_PENDEK[Number(BULAN_INI.slice(5, 7)) - 1]}</span>
        </button>

        {/* ==== SAMPUL DALAM ================================================ */}
        <aside className="gji__sampul" aria-label="Rekap buku gaji">
          <header className="gji__judulbuku">
            <span className="gji__judulatas">Buku gaji · Jilid</span>
            <div className="gji__judulbaris">
              {/* Tahun jilid timbul di sampul — angka yang sama dengan rak. */}
              <b className="gji__tahunbesar">{tahun}</b>
              <span className="gji__monogram" aria-hidden="true">
                {studio?.logo ? <img src={studio.logo} alt="" /> : inisialStudio}
              </span>
            </div>
            <strong className="gji__studio">{namaStudio}</strong>
          </header>

          {/* Label tempel: rekap lembar yang sedang dibuka — satu bulan, atau
              seluruh jilid bila yang dibuka halaman depan. */}
          {rekap ? (
            <section className="gji__label" aria-label={`Rekap jilid ${tahun}`}>
              <p className="gji__labelatas">
                <span>Keluar untuk orang</span>
                <span>
                  Jilid {tahun}
                  {tahun === TAHUN_INI ? ` s.d. ${BULAN_PENDEK[banding.batas - 1]}` : ""}
                </span>
              </p>
              <p className="gji__total">{formatRupiah(rekapJilid.total)}</p>
              {trenJilid !== null && (
                <p className="gji__beda">
                  <LencanaTren naik={trenJilid >= 0} baik>
                    {teksPersen(Math.abs(trenJilid))}
                  </LencanaTren>
                  <span>
                    <b>
                      {tanda(banding.kini - banding.lalu)}
                      {formatRupiah(Math.abs(banding.kini - banding.lalu))}
                    </b>{" "}
                    dari {tahun - 1}
                  </span>
                </p>
              )}
              <div className="gji__pecah">
                <p>
                  <i className="gji__kotak gji__kotak--gaji" />
                  <span>Gaji</span>
                  <b>{formatRupiah(rekapJilid.gaji)}</b>
                </p>
                <p>
                  <i className="gji__kotak gji__kotak--fee" />
                  <span>Fee proyek</span>
                  <b>{formatRupiah(rekapJilid.fee)}</b>
                </p>
                {/* Satu ruas per BULAN di halaman depan. */}
                <span
                  className={`gji__pecahbatang${sorotBulan ? " is-menyorot" : ""}`}
                  role="img"
                  aria-label={`${rekapJilid.berjalan.length} bulan, gaji ${teksPersen(persen(rekapJilid.gaji, rekapJilid.total))}`}
                >
                  {rekapJilid.berjalan
                    .filter((m) => m.total > 0)
                    .map((m) => {
                      const kp = ket(() => keteranganBulan(m));
                      return (
                        <span
                          key={m.period}
                          className={`gji__ruas${kelasBulan(m.period)}`}
                          style={{ flexGrow: m.total }}
                          {...kp}
                          onPointerEnter={(e) => {
                            kp.onPointerEnter(e);
                            if (e.pointerType === "mouse") setSorotBulan(m.period);
                          }}
                          onPointerLeave={(e) => {
                            kp.onPointerLeave(e);
                            if (e.pointerType === "mouse") setSorotBulan(null);
                          }}
                        >
                          {m.salary > 0 && <i className="gji__kotak--gaji" style={{ flexGrow: m.salary }} />}
                          {m.fee > 0 && <i className="gji__kotak--fee" style={{ flexGrow: m.fee }} />}
                        </span>
                      );
                    })}
                </span>
              </div>
            </section>
          ) : (
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
              {/* Satu ruas per penerima (urutan lembar), tiap ruas dibelah gaji
                  dan fee-nya — jumlah gelapnya tetap terbaca sebagai gaji vs fee.
                  Menyentuh ruas menyorot barisnya di lembar, dan sebaliknya. */}
              <span
                className={`gji__pecahbatang${sorot ? " is-menyorot" : ""}`}
                role="img"
                aria-label={`Gaji ${teksPersen(pctGaji)}, fee proyek ${teksPersen(100 - pctGaji)}, ${jumlahBaris} penerima`}
              >
                {urut.map((b) => {
                  const kp = ket(() => ({
                    judul: `${String(b.no).padStart(2, "0")} · ${b.name}`,
                    baris: [
                      ...((b.salaryAmount ?? 0) > 0 ? [{ warna: "var(--ramp-1)", label: "Gaji", nilai: formatRupiah(b.salaryAmount ?? 0) }] : []),
                      ...(b.feeAmount > 0 ? [{ warna: "var(--ramp-2)", label: "Fee proyek", nilai: formatRupiah(b.feeAmount) }] : []),
                      { label: `${teksPersen(Math.round(persen(b.total, ringkas.total) * 10) / 10)} dari ${nBulan}`, nilai: formatRupiah(b.total) },
                    ],
                  }));
                  return (
                    <span
                      key={b.teamMemberId}
                      className={`gji__ruas${kelasSorot(b.teamMemberId)}`}
                      style={{ flexGrow: b.total }}
                      {...kp}
                      onPointerEnter={(e) => {
                        kp.onPointerEnter(e);
                        if (e.pointerType === "mouse") sorotkan(b);
                      }}
                      onPointerLeave={(e) => {
                        kp.onPointerLeave(e);
                        if (e.pointerType === "mouse") setGaris(null);
                      }}
                    >
                      {(b.salaryAmount ?? 0) > 0 && <i className="gji__kotak--gaji" style={{ flexGrow: b.salaryAmount ?? 0 }} />}
                      {b.feeAmount > 0 && <i className="gji__kotak--fee" style={{ flexGrow: b.feeAmount }} />}
                    </span>
                  );
                })}
              </span>
            </div>
          </section>

          )}

          {/* Tanda terima: berapa gaji tetap bulan ini yang sudah diterima —
              atau, di halaman depan, bulan mana yang sudah lunas. */}
          {rekap ? (
            <section className="gji__terima" aria-label="Bulan lunas">
              <p className="gji__terimaatas">
                <span>Bulan lunas</span>
                <b>
                  {rekapJilid.lunas} dari {rekapJilid.bergajiBulan}
                </b>
              </p>
              <ul className="gji__capderet gji__capderet--bulan">
                {rekapJilid.bulan.map((m) => {
                  const keadaan = m.mendatang
                    ? "is-kosong"
                    : m.lunas
                      ? "is-terima"
                      : m.salaryUnpaid > 0
                        ? "is-belum"
                        : "is-kosong";
                  return (
                    <li key={m.period}>
                      <button
                        type="button"
                        className={`gji__capkecil gji__capkecil--bulan ${keadaan}${kelasBulan(m.period)}`}
                        disabled={m.mendatang}
                        aria-label={`${labelBulan(m.period)}: ${m.mendatang ? "belum tiba" : m.lunas ? "lunas" : m.salaryUnpaid ? `${m.salaryUnpaid} gaji belum dibayar` : "tanpa gaji tetap"}`}
                        onClick={() => void balikHalaman(m.period)}
                        {...(m.mendatang ? {} : ket(() => keteranganBulan(m)))}
                      >
                        {BULAN_PENDEK[m.ke - 1]}
                      </button>
                    </li>
                  );
                })}
              </ul>
              <p className={`gji__terimaket${rekapJilid.belum > 0 ? " gji__terimaket--belum" : ""}`}>
                {rekapJilid.belum > 0
                  ? `${rekapJilid.belum} bulan masih ada gaji belum dibayar`
                  : rekapJilid.bergajiBulan > 0
                    ? "Semua bulan berjalan sudah lunas"
                    : "Belum ada gaji tetap di jilid ini"}
              </p>
            </section>
          ) : (
          <section className="gji__terima" aria-label="Tanda terima gaji">
            <p className="gji__terimaatas">
              <span>Tanda terima gaji</span>
              <b>
                {ringkas.diterima} dari {ringkas.bergaji}
              </b>
            </p>
            {/* Satu cap kecil per orang bergaji — bentuk yang sama dengan cap
                DITERIMA di lembar. Mint bercincin rangkap = sudah diterima;
                amber putus-putus = belum. Menekannya membuka barisnya. */}
            {bergaji.length > 0 && (
              <ul className="gji__capderet">
                {bergaji.map((b) => {
                  const terima = Boolean(b.salaryPaidOn);
                  return (
                    <li key={b.teamMemberId}>
                      <button
                        type="button"
                        className={`gji__capkecil ${terima ? "is-terima" : "is-belum"}${kelasSorot(b.teamMemberId)}`}
                        aria-label={`${b.name}: ${terima ? `diterima ${tanggalPendek(b.salaryPaidOn!)}` : "belum dibayar"}`}
                        onClick={() => sorotkan(b, true)}
                        {...ket(() => ({
                          judul: b.name,
                          baris: [
                            { label: "Gaji", nilai: formatRupiah(b.salaryAmount ?? 0) },
                            terima
                              ? { warna: "var(--brand-mint)", label: "Diterima", nilai: tanggalPendek(b.salaryPaidOn!) }
                              : { warna: "var(--warn)", label: "Status", nilai: "Belum dibayar" },
                          ],
                        }))}
                      >
                        {inisial(b.name)}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
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

          )}

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
                  aria-label={`Jilid ${j.year}: ${formatRupiah(j.total)}${j.year === tahun ? ", sedang dibuka — buka rekapitulasinya" : ""}`}
                  onClick={() => {
                    kabar.current?.(null);
                    /* Menyentuh punggung jilid yang sedang dibuka = membuka
                       halaman depannya. */
                    if (j.year === tahun) {
                      if (!rekap) void balikHalaman(kunciRekap(tahun));
                      return;
                    }
                    /* Jilid berjalan dibuka di bulan ini; jilid lama di
                       Desember — lembar terakhir yang ditutup. */
                    void balikHalaman(j.year === TAHUN_INI ? BULAN_INI : `${j.year}-12`);
                  }}
                  {...ket(() => ({
                    judul: `Jilid ${j.year}${j.year === tahun ? " · sedang dibuka" : j.year === TAHUN_INI ? " · berjalan" : ""}`,
                    baris: [
                      { warna: "var(--ramp-1)", label: "Gaji", nilai: formatRupiah(j.salary) },
                      { warna: "var(--ramp-2)", label: "Fee proyek", nilai: formatRupiah(j.fee) },
                      { label: "Jumlah", nilai: formatRupiah(j.total) },
                    ],
                  }))}
                >
                  {/* Jilid yang sedang dibuka meninggalkan RUANG KOSONG di rak:
                      bukunya sedang terbuka di meja, di sebelahnya. */}
                  <span className="gji__jilidpita" aria-hidden="true" />
                  <span className="gji__jilidlabel">
                    <span className="gji__jilidtahun">{j.year}</span>
                  </span>
                  <span className="gji__jilidkaki" aria-hidden="true" />
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

        {/* Tumpukan lembar di bawah lembar yang terbuka — dua tepi kertas
            yang mengintip 3px dan 6px di bawahnya. */}
        <div className="gji__tumpuk" aria-hidden="true" />

        {/* ==== LEMBAR ====================================================== */}
        <section className="gji__lembar" id="gji-lembar" aria-labelledby="gji-judul">
          {rekap ? (
            <>
              <header className="gji__kop">
                <div className="gji__kopkiri">
                  <p className="gji__kopatas">Rekapitulasi gaji · Januari–Desember {tahun}</p>
                  <p className="gji__kopjudul">
                    <span id="gji-judul" role="heading" aria-level={2} className="gji__judulbulan">
                      Ikhtisar <b className="gji__judultahun">{tahun}</b>
                    </span>
                    <span className="gji__kopbawah">
                      {rekapJilid.berjalan.length} bulan · rata-rata {formatRupiah(Math.round(rekapJilid.rata))}/bulan
                      {rekapJilid.belum > 0 && <span className="gji__kopbelum"> · {rekapJilid.belum} belum lunas</span>}
                    </span>
                  </p>
                </div>
                <div className="gji__kopaksi">
                  <TombolIkon ikon={DownloadSimple} jenis="ghost" ukuran="small" judul="Unduh CSV rekap" onClick={eksporRekap} />
                  <span className="gji__folio" aria-label="Folio rekapitulasi, halaman depan jilid">
                    <small>Folio</small>
                    <b>
                      R<i>/12</i>
                    </b>
                  </span>
                </div>
              </header>
              <div
                className="gji__wadah"
                onPointerLeave={(e) => {
                  if (e.pointerType === "mouse") setSorotBulan(null);
                }}
              >
                <table className="gji__daftar gji__daftar--rekap">
                  <colgroup>
                    <col className="gji__c-bln" />
                    <col />
                    <col className="gji__c-uang" />
                    <col className="gji__c-uang" />
                    <col className="gji__c-jumlah" />
                    <col className="gji__c-status" />
                  </colgroup>
                  <thead>
                    <tr>
                      <th scope="col">Bulan</th>
                      <th scope="col">Gaji · fee</th>
                      <th scope="col" className="gji__angka gji__k-gaji">Gaji</th>
                      <th scope="col" className="gji__angka gji__k-fee">Fee proyek</th>
                      <th scope="col" className="gji__angka gji__k-jumlah">Jumlah</th>
                      <th scope="col" className="gji__ttdkepala gji__k-ttd">Tanda terima</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rekapJilid.bulan.map((m) => (
                      <tr
                        key={m.period}
                        className={`gji__rekap${m.mendatang ? " is-mendatang" : ""}${kelasBulan(m.period)}`}
                        onPointerEnter={(e) => {
                          if (e.pointerType === "mouse" && !m.mendatang) {
                            setSorotBulan(m.period);
                            siapkan(m.period);
                          }
                        }}
                      >
                        <th scope="row">
                          {m.mendatang ? (
                            <span className="gji__rekapbln">
                              <i>{String(m.ke).padStart(2, "0")}</i>
                              {BULAN[m.ke - 1]}
                            </span>
                          ) : (
                            /* Nama bulan = pintu ke lembarnya (halaman membalik). */
                            <button
                              type="button"
                              className="gji__rekapbln"
                              onClick={() => void balikHalaman(m.period)}
                              onFocus={() => {
                                setSorotBulan(m.period);
                                siapkan(m.period);
                              }}
                              onBlur={() => setSorotBulan(null)}
                            >
                              <i>{String(m.ke).padStart(2, "0")}</i>
                              {BULAN[m.ke - 1]}
                            </button>
                          )}
                        </th>
                        <td className="gji__rekapgrafik">
                          {/* Batang sebulan pada skala jilid; takik = bulan yang
                              sama tahun lalu; garis putus = rata-rata per bulan.
                              Sel ini tidak berisi tulisan apa pun. */}
                          <span
                            className="gji__rekapbatang"
                            style={{ "--gji-rata": rekapJilid.rata / rekapJilid.maks } as React.CSSProperties}
                            {...(m.mendatang ? {} : ket(() => keteranganBulan(m)))}
                          >
                            {m.total > 0 && (
                              <span className="gji__rekapisi" style={{ width: `${(m.total / rekapJilid.maks) * 100}%` }}>
                                {m.salary > 0 && <i className="gji__kotak--gaji" style={{ flexGrow: m.salary }} />}
                                {m.fee > 0 && <i className="gji__kotak--fee" style={{ flexGrow: m.fee }} />}
                              </span>
                            )}
                            {m.lalu > 0 && (
                              <i className="gji__rekaphantu" style={{ left: `${(m.lalu / rekapJilid.maks) * 100}%` }} />
                            )}
                          </span>
                        </td>
                        <td className="gji__angka gji__k-gaji">
                          {m.mendatang ? "" : m.salary ? formatRupiah(m.salary) : <span className="gji__redup">—</span>}
                        </td>
                        <td className="gji__angka gji__k-fee">
                          {m.mendatang ? "" : m.fee ? formatRupiah(m.fee) : <span className="gji__redup">—</span>}
                        </td>
                        <td className="gji__angka gji__jumlah gji__k-jumlah">{m.mendatang ? "" : formatRupiah(m.total)}</td>
                        <td className="gji__k-ttd gji__rekapstatus">
                          {m.mendatang ? (
                            <span className="gji__redup">belum tiba</span>
                          ) : m.lunas ? (
                            <span className="gji__segel">Lunas</span>
                          ) : m.salaryUnpaid > 0 ? (
                            <span className="gji__rekapbelum">{m.salaryUnpaid} gaji belum</span>
                          ) : (
                            <span className="gji__redup">{m.total > 0 ? "fee saja" : "kosong"}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <th scope="row">Jumlah</th>
                      {/* Legenda kolom batang, tepat di bawah batangnya. */}
                      <td className="gji__rekapket">
                        <span className="gji__rekaplegenda">
                          <i className="gji__legrata" aria-hidden="true" />
                          rata-rata
                          <i className="gji__leghantu" aria-hidden="true" />
                          {tahun - 1}
                        </span>
                      </td>
                      <td className="gji__angka gji__k-gaji">{formatRupiah(rekapJilid.gaji)}</td>
                      <td className="gji__angka gji__k-fee">{formatRupiah(rekapJilid.fee)}</td>
                      <td className="gji__angka gji__jumlah gji__k-jumlah">
                        <span className="gji__ganda">{formatRupiah(rekapJilid.total)}</span>
                      </td>
                      <td className="gji__ttdjumlah gji__k-ttd">
                        {rekapJilid.lunas}/{rekapJilid.bergajiBulan} lunas
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              <p className="gji__terbilang">
                <span>Terbilang</span>
                <em>
                  <i aria-hidden="true"># </i>
                  {terbilang(rekapJilid.total)}
                  <i aria-hidden="true"> #</i>
                </em>
              </p>
            </>
          ) : (
          <>
          <header className="gji__kop">
            <div className="gji__kopkiri">
              <p className="gji__kopatas">
                Daftar penerimaan gaji · 1–{hariDalamBulan(period)} {nBulan}
              </p>
              <p className="gji__kopjudul">
                <span id="gji-judul" role="heading" aria-level={2} className="gji__judulbulan">
                  {nBulan} <b className="gji__judultahun">{tahun}</b>
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
              {/* Nomor halaman buku besar: lembar ke berapa dari dua belas. */}
              <span className="gji__folio" aria-label={`Folio ${bulanKe} dari 12`}>
                <small>Folio</small>
                <b>
                  {bulanKe}
                  <i>/12</i>
                </b>
              </span>
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
                    <th scope="col" className="gji__angka gji__k-gaji">Gaji</th>
                    <th scope="col" className="gji__angka gji__k-fee">Fee proyek</th>
                    <th scope="col" className="gji__angka gji__k-jumlah">Jumlah</th>
                    <th scope="col" className="gji__ttdkepala gji__k-ttd">Tanda terima</th>
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
                      {/* Garis kolom buku besar menembus kepala kelompok: sel
                          kosong per kolom, bukan satu sel yang membentang. */}
                      <tr className="gji__grup">
                        <th scope="rowgroup" colSpan={2}>
                          {k.label}
                        </th>
                        <td className="gji__k-gaji" />
                        <td className="gji__k-fee" />
                        <td className="gji__angka gji__k-jumlah">{formatRupiah(k.jumlah)}</td>
                        <td className="gji__k-ttd" />
                      </tr>
                      {k.baris.map((b) => (
                        <tr
                          key={b.teamMemberId}
                          ref={(el) => {
                            if (el) barisRef.current.set(b.teamMemberId, el);
                            else barisRef.current.delete(b.teamMemberId);
                          }}
                          className={`gji__baris${sorot === b.teamMemberId ? " is-sorot" : ""}`}
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
                          <td className="gji__angka gji__k-gaji">
                            {b.salaryAmount === null || b.salaryAmount === undefined ? (
                              <span className="gji__redup">—</span>
                            ) : (
                              formatRupiah(b.salaryAmount)
                            )}
                          </td>
                          <td className="gji__angka gji__k-fee">
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
                          <td className="gji__angka gji__jumlah gji__k-jumlah">{formatRupiah(b.total)}</td>
                          <td className={`gji__ttd gji__ttd--${b.no % 2 ? "kiri" : "kanan"} gji__k-ttd`}>
                            <span className="gji__ttdslot">
                              <span className="gji__ttdno">{b.no}.</span>
                              <TandaTerima
                                b={b}
                                bulan={nBulan}
                                studio={inisialStudio}
                                baru={capBaru !== null && capBaru === b.salaryId}
                                onTandai={(v) => tandaiDibayar(b, v)}
                              />
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
                      <td className="gji__angka gji__k-gaji">{formatRupiah(ringkas.gaji)}</td>
                      <td className="gji__angka gji__k-fee">{formatRupiah(ringkas.fee)}</td>
                      <td className="gji__angka gji__jumlah gji__k-jumlah">
                        {/* Garis bawah ganda: tanda jumlah akhir di buku besar. */}
                        <span className="gji__ganda">{formatRupiah(ringkas.total)}</span>
                      </td>
                      <td className="gji__ttdjumlah gji__k-ttd">
                        {/* Semua gaji bulan ini sudah diterima: lembarnya dicap LUNAS
                            dengan tanggal bayar terakhir. */}
                        {lunasBulan ? (
                          <span className="gji__segel">Lunas{bayarTerakhir ? ` · ${tanggalPendek(bayarTerakhir)}` : ""}</span>
                        ) : ringkas.bergaji > 0 ? (
                          `${ringkas.diterima}/${ringkas.bergaji} diterima`
                        ) : (
                          ""
                        )}
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
                {/* Skala 0–100% jumlah bulan. Ruas pekat = orang ini; ruas pucat
                    di kirinya = semua baris sebelumnya, jadi menyusuri daftar ke
                    bawah membuat ruasnya berjalan dari 0 sampai tepat 100%. */}
                <span className="gji__penggarisbadan">
                  <i className="gji__penggariskum" style={{ width: `${garis.kumA}%` }} />
                  <i className="gji__penggarisini" style={{ left: `${garis.kumA}%`, width: `${garis.bagian}%` }} />
                </span>
                <span className="gji__penggarisket">
                  <b>{teksPersen(Math.round(garis.bagian * 10) / 10)}</b> · s.d. sini {teksPersen(Math.round(garis.kumB * 10) / 10)}
                </span>
              </span>
            )}
          </div>

          {baris !== null && jumlahBaris > 0 && (
            <p className="gji__terbilang">
              <span>Terbilang</span>
              {/* Tanda pagar di kedua ujung, seperti di kuitansi: tidak ada
                  ruang untuk menambah kata sesudah ditulis. */}
              <em>
                <i aria-hidden="true"># </i>
                {terbilang(ringkas.total)}
                <i aria-hidden="true"> #</i>
              </em>
            </p>
          )}
          </>
          )}
        </section>

        {/* ==== INDEKS BULAN ================================================ */}
        <div className="gji__indeks" ref={indeksRef} role="tablist" aria-orientation="vertical" aria-label={`Lembar di jilid ${tahun}`}>
          {/* Halaman depan jilid: tab pertama, selalu penuh (bukan grafik). */}
          <button
            ref={rekapRef}
            type="button"
            role="tab"
            aria-selected={rekap}
            aria-controls="gji-lembar"
            tabIndex={rekap ? 0 : -1}
            className={`gji__tab gji__tab--rekap${rekap ? " is-aktif" : ""}`}
            aria-label={`Rekapitulasi jilid ${tahun}: ${formatRupiah(rekapJilid.total)}`}
            onClick={() => void balikHalaman(kunciRekap(tahun))}
            onKeyDown={(e) => tombolIndeks(e, kunciRekap(tahun))}
            {...ket(() => ({
              judul: `Rekapitulasi ${tahun}`,
              baris: [
                { label: `${rekapJilid.berjalan.length} bulan`, nilai: formatRupiah(rekapJilid.total) },
                { label: "Bulan lunas", nilai: `${rekapJilid.lunas} dari ${rekapJilid.bergajiBulan}` },
              ],
            }))}
          >
            <span className="gji__tablabel">Rekap</span>
          </button>
          {indeks.map((m, i) => {
            const aktif = m.period === period;
            const kp = m.mendatang
              ? null
              : ket(() => ({
                  judul: labelBulan(m.period),
                  baris: [
                    { warna: "var(--ramp-1)", label: "Gaji", nilai: formatRupiah(m.salary) },
                    { warna: "var(--ramp-2)", label: "Fee proyek", nilai: formatRupiah(m.fee) },
                    { label: `Jumlah · ${m.people} orang`, nilai: formatRupiah(m.total) },
                    ...(m.lalu > 0 ? [{ label: `${BULAN_PENDEK[i]} ${tahun - 1}`, nilai: formatRupiah(m.lalu) }] : []),
                    ...(m.salaryUnpaid ? [{ warna: "var(--warn)", label: "Belum dibayar", nilai: `${m.salaryUnpaid} gaji` }] : []),
                  ],
                }));
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
                style={{ "--gji-t": m.mendatang ? 0 : m.rasio, "--gji-tl": m.rasioLalu } as React.CSSProperties}
                aria-label={`${labelBulan(m.period)}${m.mendatang ? ", belum tiba" : `: ${formatRupiah(m.total)}`}${m.salaryUnpaid ? `, ${m.salaryUnpaid} gaji belum dibayar` : m.salaryCount ? ", semua gaji diterima" : ""}`}
                onClick={() => void balikHalaman(m.period)}
                onFocus={() => siapkan(m.period)}
                onKeyDown={(e) => tombolIndeks(e, m.period)}
                {...(kp ?? {})}
                onPointerEnter={(e) => {
                  kp?.onPointerEnter(e);
                  /* Lembarnya disiapkan selagi kursor masih di atas tab. */
                  if (e.pointerType === "mouse") siapkan(m.period);
                }}
              >
                <span className="gji__tablabel">{BULAN_PENDEK[i]}</span>
                {m.salaryUnpaid > 0 && <i className="gji__tabtitik" aria-hidden="true" />}
                {/* Semua gaji bulan itu sudah diterima: lembarnya "ditutup". */}
                {m.salaryCount > 0 && m.salaryUnpaid === 0 && <Ikon ikon={Check} ukuran={10} className="gji__tabcentang" />}
                {/* Dasar tab: belahan gaji/fee bulan itu. */}
                {m.total > 0 && (
                  <span className="gji__tabpita" aria-hidden="true">
                    <i className="gji__tabgaji" style={{ flexGrow: m.salary }} />
                    <i className="gji__tabfee" style={{ flexGrow: m.fee }} />
                  </span>
                )}
                {/* Takik hantu di tepi atas: bulan yang sama tahun lalu, pada
                    skala yang sama — bisa jatuh di luar ujung tab. */}
                {m.lalu > 0 && <i className="gji__tabhantu" aria-hidden="true" />}
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
function TandaTerima({
  b,
  bulan,
  studio,
  baru,
  onTandai,
}: {
  b: BarisGajiBulan;
  bulan: string;
  /** Inisial studio di busur bawah cap. */
  studio: string;
  /** Baru saja dibubuhkan: geraknya "tercap" sekali. */
  baru: boolean;
  onTandai: (dibayar: boolean) => void;
}) {
  if (!b.salaryId) {
    return <span className="gji__ttdfee">fee proyek</span>;
  }
  if (b.salaryPaidOn) {
    const [, m, h] = b.salaryPaidOn.split("-");
    /* Geometri cap 48×48: cincin rangkap di r 22,6 & 21; "DITERIMA" di busur
       atas (alas r 15, huruf ke luar sampai ±r 20); inisial studio di busur
       bawah (alas r 17,5, huruf ke dalam sampai ±r 13); tanggal di tengah
       (y 23–31). Tidak ada garis yang melintas di belakang huruf mana pun. */
    return (
      <button
        type="button"
        className={`gji__cap${baru ? " is-baru" : ""}`}
        aria-label={`Gaji ${bulan} diterima ${tanggalPendek(b.salaryPaidOn)}. Tekan untuk membatalkan tanda.`}
        title={`Diterima ${tanggalPendek(b.salaryPaidOn)} — klik untuk membatalkan`}
        onClick={() => onTandai(false)}
      >
        <svg viewBox="0 0 48 48" width="46" height="46" aria-hidden="true">
          <defs>
            <path id={`gji-atas-${b.salaryId}`} d="M 9 24 A 15 15 0 0 1 39 24" />
            <path id={`gji-bawah-${b.salaryId}`} d="M 6.5 24 A 17.5 17.5 0 0 0 41.5 24" />
          </defs>
          <circle cx="24" cy="24" r="22.6" className="gji__capluar" />
          <circle cx="24" cy="24" r="21" className="gji__capdalam" />
          <text className="gji__capbusur">
            <textPath href={`#gji-atas-${b.salaryId}`} startOffset="50%" textAnchor="middle">
              DITERIMA
            </textPath>
          </text>
          <text className="gji__capbusur gji__capbusur--bawah">
            <textPath href={`#gji-bawah-${b.salaryId}`} startOffset="50%" textAnchor="middle">
              {studio}
            </textPath>
          </text>
          <text x="24" y="31" textAnchor="middle" className="gji__captgl">
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
