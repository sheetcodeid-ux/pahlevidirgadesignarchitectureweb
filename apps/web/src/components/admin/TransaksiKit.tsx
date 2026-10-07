import { SorotTeks } from "../kit/Tampilan";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { RequireAuth } from "./RequireAuth";
import { ToastProvider, useToast } from "../kit/Toast";
import { DialogBukti } from "./buktiKit";
import { DialogBiaya } from "./biayaKit";
import { urutkan, type Urutan } from "../kit/Tabel";
import { Cari } from "../kit/Isian";
import { PilihMenu } from "../kit/Formulir";
import { Ikon } from "../kit/Ikon";
import { Keterangan, pemberiKet, type KabarKartu } from "../kit/kartuGrafik";
import { CaretDown, CaretLeft, CaretRight, CopySimple, DownloadSimple } from "../kit/ikon";
import {
  ambilSettings,
  semuaPembayaran,
  semuaBiaya,
  daftarProyek,
  daftarKas,
  LABEL_KATEGORI_KAS,
  type EntriKas,
  bacaCache,
  tulisCache,
  type Pembayaran,
  type BiayaProyek,
  type Proyek,
  type StudioSettings,
} from "../../lib/admin";
import { formatRupiah, formatRupiahRingkas } from "../../lib/format";

/* =============================================================================
   Semua Transaksi — REKENING KORAN STUDIO.

   Halaman ini menggabungkan TIGA tabel jadi satu daftar berurut waktu:
   `project_payments` (pembayaran klien, uang masuk), `project_costs` (biaya
   proyek, uang keluar), dan `studio_ledger` (kas studio di luar proyek, dua
   arah). Benda dunia nyata untuk "semua uang yang keluar-masuk, berurut,
   dengan saldonya" adalah REKENING KORAN: cetakan printer dot-matrix di
   kertas continuous form bergaris hijau, berlubang traktor di kedua tepi,
   terlipat zig-zag per lembar. Halamannya berperilaku seperti benda itu:

   - SALDO BERJALAN di tiap baris (seluruh catatan, ketiga sumber), saldo
     awal periode di puncak lembar pertama dan SALDO AKHIR bergaris ganda
     di dasar lembar terakhir. Mutasi ditulis seperti bank: angka + CR/DB.
   - Urutannya KRONOLOGIS naik seperti rekening koran sungguhan, dipotong
     per lembar DARI BELAKANG supaya lembar terbaru selalu penuh, dan yang
     dibuka lembar terbaru. Lembar sebelumnya terlipat di atas (ujungnya
     mengintip), lembar sesudahnya bertumpuk di bawah.
   - Banyaknya baris per lembar = ruang yang ada (diukur sekali per
     perubahan ukuran), bukan angka tetap — satu layar tetap satu layar.
   - Kolom CENTANG di tepi kiri = centang pena saat rekonsiliasi. Yang
     memakainya tombol Unduh/Salin: kosong = semua baris tersaring.
   - SATU-SATUNYA gerak 3D: berganti lembar. Maju = lembar ini terangkat
     dan terlipat ke belakang di perforasi atasnya; mundur = lembar
     sebelumnya terlipat turun menutupinya. Diam bila gerak dikurangi.

   Kiri, di papan: TUMPUKAN LIPATAN — seluruh cetakan terlipat zig-zag,
   satu lipatan per lembar dengan rentang tanggal, batang kredit/debet, dan
   saldo akhirnya; yang terbuka tertarik keluar ke arah kertas, mengklik
   lipatan membuka lembarnya — lalu saringan (periode, CR/DB, sumber,
   proyek, cari) + ekspor. Ringkasan periode DICETAK di kop kertas.

   Mencentang baris = menyapukan STABILO di baris itu (sekali, saat
   dicentang), seperti menandai rekening koran saat rekonsiliasi.

   Nama pembayaran membuka BUKTI pembayarannya, biaya membuka RINCIANNYA
   (hapus ada di sana), kas studio menautkan ke halaman Kas Studio.
   Kunci cache `kas-studio` dan `settings` milik halaman lain — di sini
   cuma DIBACA (jebakan #8).
   ============================================================================= */

type Sumber = "klien" | "biaya" | "kas";

interface Mutasi {
  kunci: string;
  sumber: Sumber;
  kredit: boolean;
  nama: string;
  sub: string;
  proyek: string | null;
  orang: string | null;
  waktu: string;
  /** Milidetik untuk MENGURUTKAN — tanggal tanpa jam dianggap akhir hari,
      supaya ia tidak selalu kalah dari stempel waktu di hari yang sama. */
  ms: number;
  /** Milidetik awal hari — untuk menyaring rentang dan mengelompokkan. */
  hari: number;
  nominal: number;
  catatan: string | null;
  bayar?: Pembayaran;
  biaya?: BiayaProyek;
  kas?: EntriKas;
}

const LABEL_JENIS: Record<string, string> = { dp: "DP", termin: "Termin", pelunasan: "Pelunasan" };
const LABEL_METODE: Record<string, string> = { tunai: "Tunai", transfer: "Transfer", qris: "QRIS", lainnya: "Lainnya" };
const LABEL_KATEGORI: Record<string, string> = {
  freelancer: "Freelancer",
  operasional: "Operasional",
  prinsipal: "Prinsipal",
  lainnya: "Lainnya",
};
const SANDI: Record<Sumber, string> = { klien: "KLIEN", biaya: "BIAYA", kas: "KAS" };
const LABEL_SUMBER: Record<Sumber, string> = { klien: "Pembayaran klien", biaya: "Biaya proyek", kas: "Kas studio" };

const HARI = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
const BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

const RENTANG = [
  { nilai: "1", label: "Bulan ini" },
  { nilai: "3", label: "3 bulan" },
  { nilai: "12", label: "12 bulan" },
  { nilai: "0", label: "Semua" },
];

/** Batas bawah rentang, atau null untuk "semua waktu". */
function batasRentang(bulan: number): number | null {
  if (bulan <= 0) return null;
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  d.setMonth(d.getMonth() - (bulan - 1));
  return d.getTime();
}

function keMs(iso: string, akhirHari: boolean): number {
  return new Date(iso.length === 10 ? iso + (akhirHari ? "T23:59:59" : "T00:00:00") : iso).getTime();
}
const tglPendek = (ms: number) => {
  const d = new Date(ms);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
};
const tglPanjang = (ms: number) => {
  const d = new Date(ms);
  return `${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}`;
};
/** Angka rekening koran: tanpa "Rp" (kolomnya sudah menyebut mata uang). */
const angka = (n: number) => Math.abs(n).toLocaleString("id-ID");
const saldoTeks = (n: number) => `${n < 0 ? "−" : ""}${angka(n)}`;
/** Saldo ringkas di lipatan: "−87 jt", spasi tak-terputus (jebakan #55). */
const ringkasSaldo = (n: number) => `${n < 0 ? "−" : ""}${formatRupiahRingkas(Math.abs(n))}`;
const rupiahSaldo = (n: number) => (n < 0 ? `−${formatRupiah(-n)}` : formatRupiah(n));

const pakaiGerak = () =>
  typeof window !== "undefined" && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Satu sel CSV. Tanda kutip DIGANDAKAN, bukan dibuang (nama proyek memuat
 * tanda kutip sesekali); pemisahnya titik koma karena Excel berlokal
 * Indonesia membaca koma sebagai desimal.
 */
function selCsv(v: string | number): string {
  const t = String(v);
  return /[";\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
}

/** Lembar diukur hanya saat kerangka satu-layar berlaku; di bawahnya isi
    halaman menggulir, dan tinggi wadah baris mengikuti isinya sendiri. */
const SATU_LAYAR = "(min-width: 1288.02px) and (min-height: 600px)";
const BARIS_TETAP = 12;

function Isi() {
  const toast = useToast();
  const kabar: KabarKartu = useRef(null);
  const ket = pemberiKet(kabar);
  const [bayar, setBayar] = useState<Pembayaran[] | null>(() => bacaCache<Pembayaran[]>("bayar-semua"));
  const [biaya, setBiaya] = useState<BiayaProyek[] | null>(() => bacaCache<BiayaProyek[]>("biaya-semua"));
  const [proyek, setProyek] = useState<Proyek[] | null>(() => bacaCache<Proyek[]>("proyek"));
  const [kas, setKas] = useState<EntriKas[] | null>(() => bacaCache<EntriKas[]>("kas-studio"));
  const [studio, setStudio] = useState(() => bacaCache<StudioSettings>("settings")?.studioName || "Studio");

  const [cari, setCari] = useState("");
  const [arah, setArah] = useState<"semua" | "masuk" | "keluar">("semua");
  const [sumber, setSumber] = useState<"semua" | Sumber>("semua");
  const [filterProyek, setFilterProyek] = useState("semua");
  const [rentang, setRentang] = useState("12");
  const [urutan, setUrutan] = useState<Urutan | null>(null);
  const [terpilih, setTerpilih] = useState<string[]>([]);
  const [bukti, setBukti] = useState<Pembayaran | null>(null);
  const [rinci, setRinci] = useState<BiayaProyek | null>(null);
  /** Baris yang BARU dicentang — stabilonya disapukan sekali ("*" = semua). */
  const [coret, setCoret] = useState<string | null>(null);

  /* "Lihat semua" dari Terima Pembayaran / Catat Pengeluaran membawa
     ?jenis=masuk|keluar. Dibaca di efek: halaman dirender tanpa URL. */
  useEffect(() => {
    const j = new URLSearchParams(window.location.search).get("jenis");
    if (j === "masuk" || j === "keluar") setArah(j);
  }, []);

  const muatBiaya = () =>
    semuaBiaya()
      .then((d) => {
        tulisCache("biaya-semua", d);
        setBiaya(d);
      })
      .catch(() => setBiaya((l) => l ?? []));

  useEffect(() => {
    semuaPembayaran()
      .then((d) => {
        tulisCache("bayar-semua", d);
        setBayar(d);
      })
      .catch(() => setBayar((l) => l ?? []));
    muatBiaya();
    daftarProyek()
      .then((d) => {
        tulisCache("proyek", d);
        setProyek(d);
      })
      .catch(() => setProyek((l) => l ?? []));
    daftarKas()
      .then(setKas)
      .catch(() => setKas((l) => l ?? []));
    ambilSettings()
      .then((s) => setStudio(s.studioName || "Studio"))
      .catch(() => {});
  }, []);

  /* ---- Seluruh mutasi, kronologis naik, dengan saldo berjalan --------------- */
  const buku = useMemo(() => {
    const semua: Mutasi[] = [
      ...(bayar ?? []).map<Mutasi>((b) => ({
        kunci: `p:${b.id}`,
        sumber: "klien",
        kredit: true,
        nama: `Pembayaran ${LABEL_JENIS[b.kind] ?? b.kind}`,
        sub: LABEL_METODE[b.method] ?? b.method,
        proyek: b.projectTitle ?? null,
        orang: b.receiver || null,
        waktu: b.paidAt,
        ms: keMs(b.paidAt, true),
        hari: keMs(b.paidAt.slice(0, 10), false),
        nominal: b.amount,
        catatan: b.note || null,
        bayar: b,
      })),
      ...(biaya ?? []).map<Mutasi>((k) => ({
        kunci: `b:${k.id}`,
        sumber: "biaya",
        kredit: false,
        nama: k.label,
        sub: LABEL_KATEGORI[k.category] ?? k.category,
        proyek: k.projectTitle ?? null,
        orang: k.teamMemberName || null,
        waktu: k.incurredOn,
        ms: keMs(k.incurredOn, true),
        hari: keMs(k.incurredOn, false),
        nominal: k.amount,
        catatan: null,
        biaya: k,
      })),
      ...(kas ?? []).map<Mutasi>((k) => ({
        kunci: `k:${k.id}`,
        sumber: "kas",
        kredit: k.direction === "masuk",
        nama: k.label,
        sub: LABEL_KATEGORI_KAS[k.category],
        /* Yang tidak terkait proyek dikelompokkan sebagai "Kas studio",
           supaya saringan proyek bisa memisahkannya. */
        proyek: k.projectTitle ?? "Kas studio",
        orang: k.counterparty || null,
        waktu: k.occurredOn,
        ms: keMs(k.occurredOn, true),
        hari: keMs(k.occurredOn, false),
        nominal: k.amount,
        catatan: k.note || null,
        kas: k,
      })),
    ];
    /* Dibandingkan sebagai ANGKA: `paid_at` timestamptz dan `incurred_on`
       date tidak bisa diurutkan bersama sebagai teks. Seri = kunci, supaya
       urutannya stabil antarmuat. */
    const naik = semua.sort((a, b) => a.ms - b.ms || a.kunci.localeCompare(b.kunci));
    const saldo = new Map<string, number>();
    let s = 0;
    for (const m of naik) {
      s += m.kredit ? m.nominal : -m.nominal;
      saldo.set(m.kunci, s);
    }
    return { naik, saldo, total: s };
  }, [bayar, biaya, kas]);

  const batas = batasRentang(Number(rentang));
  const dalamRentang = useMemo(
    () => buku.naik.filter((m) => batas === null || !Number.isFinite(m.hari) || m.hari >= batas),
    [buku, batas],
  );
  /** Saldo seluruh catatan sebelum periode dibuka. */
  const saldoAwal = useMemo(() => {
    if (batas === null) return 0;
    let s = 0;
    for (const m of buku.naik) if (m.hari < batas) s = buku.saldo.get(m.kunci)!;
    return s;
  }, [buku, batas]);

  const tersaring = useMemo(() => {
    const q = cari.trim().toLowerCase();
    return dalamRentang.filter((m) => {
      if (arah === "masuk" && !m.kredit) return false;
      if (arah === "keluar" && m.kredit) return false;
      if (sumber !== "semua" && m.sumber !== sumber) return false;
      if (filterProyek !== "semua" && m.proyek !== filterProyek) return false;
      if (!q) return true;
      return [m.nama, m.sub, m.proyek, m.orang, m.catatan, SANDI[m.sumber]].some((v) => v?.toLowerCase().includes(q));
    });
  }, [dalamRentang, cari, arah, sumber, filterProyek]);

  /* Urutan klik-judul berlaku pada SELURUH hasil saringan sebelum dipotong
     per lembar. Tanpa urutan: kronologis naik, seperti rekening koran. */
  const terurut = useMemo(
    () =>
      urutkan(tersaring, urutan, [
        (m) => m.ms,
        (m) => SANDI[m.sumber],
        (m) => m.nama,
        (m) => m.proyek,
        (m) => (m.kredit ? m.nominal : -m.nominal),
      ]),
    [tersaring, urutan],
  );

  const kredit = tersaring.filter((m) => m.kredit);
  const debet = tersaring.filter((m) => !m.kredit);
  const jmlKredit = kredit.reduce((n, m) => n + m.nominal, 0);
  const jmlDebet = debet.reduce((n, m) => n + m.nominal, 0);
  const akhirRentang = dalamRentang.length ? buku.saldo.get(dalamRentang[dalamRentang.length - 1]!.kunci)! : saldoAwal;
  const awalMs = batas ?? (buku.naik[0]?.hari ?? Date.now());
  const labelPeriode = `${tglPanjang(awalMs)} – ${tglPanjang(Date.now())}`;

  /* ---- Lembar ------------------------------------------------------------------ */
  const wadahRef = useRef<HTMLDivElement>(null);
  const siap = bayar !== null && biaya !== null;
  const [perLembar, setPerLembar] = useState(BARIS_TETAP);
  useLayoutEffect(() => {
    const el = wadahRef.current;
    if (!el) return;
    const mq = window.matchMedia(SATU_LAYAR);
    const ukur = () => {
      if (!mq.matches) return setPerLembar(BARIS_TETAP);
      const tinggiBaris = parseFloat(getComputedStyle(el).getPropertyValue("--rko-baris")) || 40;
      setPerLembar(Math.max(4, Math.floor(el.clientHeight / tinggiBaris)));
    };
    ukur();
    const ro = new ResizeObserver(ukur);
    ro.observe(el);
    mq.addEventListener("change", ukur);
    return () => {
      ro.disconnect();
      mq.removeEventListener("change", ukur);
    };
  }, [siap]);

  const kronologis = urutan === null;
  const nLembar = Math.max(1, Math.ceil(terurut.length / perLembar));
  /** Potongan lembar ke-h (0-based). Kronologis: dipotong dari BELAKANG,
      jadi lembar terbaru penuh dan yang pertama memuat sisanya. */
  const potong = (h: number) => {
    if (!kronologis) return terurut.slice(h * perLembar, (h + 1) * perLembar);
    const akhir = terurut.length - (nLembar - 1 - h) * perLembar;
    return terurut.slice(Math.max(0, akhir - perLembar), Math.max(0, akhir));
  };
  const lembarAwal = () => (kronologis ? nLembar - 1 : 0);

  /* Tumpukan lipatan: satu lipatan per lembar, membawa rentang tanggal,
     kredit/debet, dan saldo akhirnya. Dihitung dari potongan yang SAMA
     dengan lembarnya, jadi lipatan dan lembar tidak bisa menyimpang. */
  const lipatan = Array.from({ length: nLembar }, (_, i) => {
    const isi = potong(i);
    const cr = isi.filter((m) => m.kredit).reduce((n, m) => n + m.nominal, 0);
    const db = isi.filter((m) => !m.kredit).reduce((n, m) => n + m.nominal, 0);
    const hari = isi.map((m) => m.hari);
    const akhir = isi[isi.length - 1];
    return {
      cr,
      db,
      n: isi.length,
      dari: hari.length ? Math.min(...hari) : null,
      sampai: hari.length ? Math.max(...hari) : null,
      saldo: kronologis && akhir ? buku.saldo.get(akhir.kunci)! : null,
    };
  });
  const puncakLipat = Math.max(1, ...lipatan.flatMap((l) => [l.cr, l.db]));

  const kunciSaring = `${cari}|${arah}|${sumber}|${filterProyek}|${rentang}|${urutan ? `${urutan.kolom}${urutan.arah}` : ""}|${perLembar}|${terurut.length}`;
  const [lembar, setLembar] = useState<{ h: number; kunci: string }>({ h: lembarAwal(), kunci: kunciSaring });
  /* Saringan berubah → kembali ke lembar bawaan. Dibandingkan saat RENDER,
     bukan di efek, supaya tidak ada satu frame lembar yang salah. */
  let h = lembar.h;
  if (lembar.kunci !== kunciSaring) {
    h = lembarAwal();
    setLembar({ h, kunci: kunciSaring });
  }
  h = Math.min(Math.max(0, h), nLembar - 1);

  /* Tumpukan yang lebih tinggi dari tempatnya menggulir sendiri — lipatan
     yang terbuka dijaga tetap kelihatan. */
  const lipatanRef = useRef<HTMLOListElement>(null);
  useEffect(() => {
    const ol = lipatanRef.current;
    const li = ol?.children[h] as HTMLElement | undefined;
    if (!ol || !li) return;
    ol.classList.toggle("is-gulir", ol.scrollHeight > ol.clientHeight + 1);
    if (li.offsetTop < ol.scrollTop || li.offsetTop + li.offsetHeight > ol.scrollTop + ol.clientHeight)
      ol.scrollTop = li.offsetTop - (ol.clientHeight - li.offsetHeight) / 2;
  }, [h, nLembar]);

  /** Pergantian lembar yang sedang terlipat. */
  const [lipat, setLipat] = useState<{ dari: number; ke: number } | null>(null);
  function keLembar(ke: number) {
    if (ke < 0 || ke >= nLembar || ke === h) return;
    if (pakaiGerak()) setLipat({ dari: lipat ? lipat.ke : h, ke });
    setLembar({ h: ke, kunci: kunciSaring });
  }
  const maju = lipat ? lipat.ke > lipat.dari : false;
  /* Maju: lembar baru di dasar, lembar lama terlipat ke atas-belakang.
     Mundur: lembar lama tetap di dasar sampai lembar sebelumnya selesai
     terlipat turun menutupinya. */
  const hDasar = lipat && !maju ? lipat.dari : h;

  const langkah = useRef<(a: -1 | 1) => void>(() => {});
  langkah.current = (a) => keLembar(h + a);
  useEffect(() => {
    const tekan = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      const a = e.key === "PageUp" ? -1 : e.key === "PageDown" ? 1 : 0;
      if (!a) return;
      const t = e.target as HTMLElement | null;
      if (t?.closest?.('input, textarea, select, [contenteditable="true"], [role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"]')) return;
      if (document.querySelector('[role="dialog"], [role="alertdialog"]')) return;
      e.preventDefault();
      langkah.current(a);
    };
    document.addEventListener("keydown", tekan);
    return () => document.removeEventListener("keydown", tekan);
  }, []);

  /* ---- Ekspor ------------------------------------------------------------------ */
  function barisEkspor(): (string | number)[][] {
    const set = new Set(terpilih);
    const isi = terpilih.length ? terurut.filter((m) => set.has(m.kunci)) : terurut;
    return [
      ["Tanggal", "Arah", "Keterangan", "Jenis", "Proyek", "Orang", "Nominal", "Catatan"],
      ...isi.map((m) => [
        m.waktu.slice(0, 10),
        m.kredit ? "Masuk" : "Keluar",
        m.nama,
        m.sub,
        m.proyek ?? "—",
        m.orang ?? "—",
        m.kredit ? m.nominal : -m.nominal,
        m.catatan ?? "—",
      ]),
    ];
  }
  function unduh() {
    const baris = barisEkspor().map((b) => b.map(selCsv).join(";"));
    /* BOM di depan: tanpa itu Excel membaca berkasnya sebagai Windows-1252. */
    const teks = "﻿" + baris.join("\r\n");
    const url = URL.createObjectURL(new Blob([teks], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `transaksi-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
  async function salin() {
    const teks = barisEkspor()
      .map((b) => b.map((v) => String(v).replace(/[\t\n]/g, " ")).join("\t"))
      .join("\n");
    try {
      await navigator.clipboard.writeText(teks);
      toast({ judul: "Transaksi disalin", keterangan: `${barisEkspor().length - 1} baris — tempel di Excel atau Google Sheets.`, nada: "sukses" });
    } catch {
      toast({ judul: "Tidak bisa menyalin", keterangan: "Peramban menolak akses papan klip. Pakai Unduh CSV.", nada: "gagal" });
    }
  }

  const judulProyek = useMemo(() => {
    const dari = new Set((proyek ?? []).map((p) => p.title));
    for (const m of buku.naik) if (m.proyek) dari.add(m.proyek);
    return [...dari].sort((a, b) => a.localeCompare(b, "id"));
  }, [proyek, buku]);

  const nSumber = (s: Sumber) => dalamRentang.filter((m) => m.sumber === s).length;
  const setTerpilihSet = new Set(terpilih);
  const semuaTercentang = terurut.length > 0 && terurut.every((m) => setTerpilihSet.has(m.kunci));
  const sebagianTercentang = !semuaTercentang && terurut.some((m) => setTerpilihSet.has(m.kunci));
  const adaSaring = Boolean(cari.trim() || arah !== "semua" || sumber !== "semua" || filterProyek !== "semua");

  function urutKolom(i: number) {
    setUrutan((u) =>
      !u || u.kolom !== i ? { kolom: i, arah: "naik" } : u.arah === "naik" ? { kolom: i, arah: "turun" } : null,
    );
  }

  if (bayar === null || biaya === null) return <Kerangka />;

  const lembarProps = {
    nLembar,
    kronologis,
    studio,
    labelPeriode,
    saldoAwal,
    akhirRentang,
    buku,
    cari,
    urutan,
    onUrut: urutKolom,
    terpilih: setTerpilihSet,
    onCentang: (k: string) => {
      setCoret(terpilih.includes(k) ? null : k);
      setTerpilih((t) => (t.includes(k) ? t.filter((x) => x !== k) : [...t, k]));
    },
    semuaTercentang,
    sebagianTercentang,
    onCentangSemua: () => {
      setCoret(semuaTercentang ? null : "*");
      setTerpilih(semuaTercentang ? [] : terurut.map((m) => m.kunci));
    },
    coret,
    onCoretSelesai: () => setCoret(null),
    ringkas: { saldoAwal, akhirRentang, jmlKredit, jmlDebet, nKredit: kredit.length, nDebet: debet.length },
    onBuka: (m: Mutasi) => {
      if (m.bayar) setBukti(m.bayar);
      else if (m.biaya) setRinci(m.biaya);
    },
    kosong: semuaCatatanKosong(buku.naik.length, adaSaring),
  };

  return (
    <div className="rko">
      <Keterangan kabar={kabar} />
      <div className="rko__papan">
        {/* ---- Ringkasan + saringan ------------------------------------------ */}
        <section className="rko__sampul" aria-label="Ringkasan dan saringan rekening">
          <header className="rko__sampulkop">
            <p className="rko__alis">Tumpukan lembar</p>
            <p className="rko__periode">
              {nLembar} lembar · {terurut.length} mutasi
            </p>
          </header>

          {/* Tumpukan lipatan: seluruh cetakan, satu lipatan per lembar. Yang
              terbuka tertarik keluar ke arah kertasnya. */}
          <nav className="rko__lipatan" aria-label="Tumpukan lembar rekening">
            <ol ref={lipatanRef}>
              {lipatan.map((l, i) => {
                const kk = ket(() => ({
                  judul: `Lembar ${i + 1}${l.dari !== null ? ` · ${tglPanjang(l.dari)} – ${tglPanjang(l.sampai!)}` : ""}`,
                  baris: [
                    { label: `Kredit`, nilai: `+${formatRupiah(l.cr)}` },
                    { label: `Debet`, nilai: `−${formatRupiah(l.db)}` },
                    ...(l.saldo !== null ? [{ label: "Saldo akhir lembar", nilai: rupiahSaldo(l.saldo) }] : []),
                  ],
                }));
                return (
                  <li key={i}>
                    <button
                      type="button"
                      {...kk}
                      className={`rko__lipat${i % 2 ? " is-genap" : ""}${i === h ? " is-aktif" : ""}`}
                      aria-current={i === h ? "page" : undefined}
                      aria-label={`Lembar ${i + 1}${l.dari !== null ? `, ${tglPanjang(l.dari)} sampai ${tglPanjang(l.sampai!)}` : ""}, ${l.n} mutasi`}
                      onClick={() => keLembar(i)}
                    >
                      <span className="rko__lipatno">{i + 1}</span>
                      <span className="rko__lipattgl">
                        {l.dari !== null ? (l.dari === l.sampai ? tglPendek(l.dari) : `${tglPendek(l.dari)}–${tglPendek(l.sampai!)}`) : "—"}
                      </span>
                      <span className="rko__lipatbatang" aria-hidden="true">
                        <i className="is-cr" style={{ width: `${(l.cr / puncakLipat) * 100}%` }} />
                        <i className="is-db" style={{ width: `${(l.db / puncakLipat) * 100}%` }} />
                      </span>
                      <span className={`rko__lipatsaldo${l.saldo !== null && l.saldo < 0 ? " is-minus" : ""}`}>
                        {l.saldo !== null ? ringkasSaldo(l.saldo) : `${l.n}×`}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </nav>

          <Cari
            ukuran="medium"
            judul="Cari di rekening"
            placeholder="Cari di rekening"
            className="rko__cari"
            value={cari}
            onChange={(e) => setCari(e.currentTarget.value)}
          />

          <div className="rko__saringan">
            <BarisPil
              judul="Periode"
              nilai={rentang}
              onPilih={setRentang}
              opsi={RENTANG}
            />
            <BarisPil
              judul="Mutasi"
              nilai={arah}
              onPilih={(v) => setArah(v as typeof arah)}
              opsi={[
                { nilai: "semua", label: "Semua" },
                { nilai: "masuk", label: "Kredit · CR" },
                { nilai: "keluar", label: "Debet · DB" },
              ]}
            />
            <BarisPil
              judul="Sumber"
              nilai={sumber}
              onPilih={(v) => setSumber(v as typeof sumber)}
              opsi={[
                { nilai: "semua", label: "Semua" },
                ...(["klien", "biaya", "kas"] as Sumber[]).map((s) => ({
                  nilai: s,
                  label: `${SANDI[s][0]}${SANDI[s].slice(1).toLowerCase()} ${nSumber(s)}`,
                  judul: `${LABEL_SUMBER[s]} — ${nSumber(s)} mutasi pada periode ini`,
                })),
              ]}
            />
            <div className="rko__pilbaris">
              <span className="rko__piljudul">Proyek</span>
              <PilihMenu
                label="Saring proyek"
                nilai={filterProyek}
                onUbah={setFilterProyek}
                opsi={[{ nilai: "semua", label: "Semua proyek" }, ...judulProyek.map((j) => ({ nilai: j, label: j }))]}
                pemicu={
                  <button type="button" className="rko__proyek">
                    <span>{filterProyek === "semua" ? "Semua proyek" : filterProyek}</span>
                    <Ikon ikon={CaretDown} ukuran={12} />
                  </button>
                }
              />
            </div>
          </div>

          <div className="rko__ekspor">
            <span className="rko__eksporket" aria-live="polite">
              {terpilih.length ? (
                <>
                  {terpilih.length} dicentang ·{" "}
                  <button type="button" onClick={() => setTerpilih([])}>
                    lepas
                  </button>
                </>
              ) : (
                `${terurut.length} mutasi`
              )}
            </span>
            <button type="button" className="rko__tombol" onClick={unduh} disabled={terurut.length === 0}>
              <Ikon ikon={DownloadSimple} ukuran={14} />
              Unduh CSV
            </button>
            <button type="button" className="rko__tombol" onClick={salin} disabled={terurut.length === 0}>
              <Ikon ikon={CopySimple} ukuran={14} />
              Salin
            </button>
          </div>
        </section>

        {/* ---- Kertas continuous form ---------------------------------------- */}
        <section className="rko__rol" aria-label="Rekening koran">
          <div className={`rko__intipatas${hDasar > 0 ? "" : " is-kosong"}`} aria-hidden="true" />
          <div className="rko__tumpuk">
            <Lembar {...lembarProps} h={hDasar} baris={potong(hDasar)} wadahRef={wadahRef} />
            {lipat && (
              <Lembar
                key={`${lipat.dari}-${lipat.ke}`}
                {...lembarProps}
                h={maju ? lipat.dari : lipat.ke}
                baris={potong(maju ? lipat.dari : lipat.ke)}
                lipat={maju ? "naik" : "turun"}
                onSelesaiLipat={() => setLipat(null)}
              />
            )}
          </div>
          <div className={`rko__intipbawah${hDasar < nLembar - 1 ? "" : " is-kosong"}`} aria-hidden="true">
            <i />
            <i />
          </div>
          <nav className="rko__umpan" aria-label="Lembar rekening">
            <button type="button" className="rko__umpantombol" onClick={() => keLembar(h - 1)} disabled={h === 0}>
              <Ikon ikon={CaretLeft} ukuran={14} />
              <span className="rko__panjang">Lembar </span>sebelumnya
            </button>
            <span className="rko__halaman" aria-live="polite">
              Lembar {h + 1} / {nLembar}
            </span>
            <button type="button" className="rko__umpantombol" onClick={() => keLembar(h + 1)} disabled={h >= nLembar - 1}>
              <span className="rko__panjang">Lembar </span>berikutnya
              <Ikon ikon={CaretRight} ukuran={14} />
            </button>
          </nav>
        </section>
      </div>

      <DialogBukti
        bayar={bukti}
        judulProyek={bukti?.projectTitle ?? ""}
        whatsapp={(proyek ?? []).find((p) => p.id === bukti?.projectId)?.clientWhatsapp}
        jenis={bukti ? LABEL_JENIS[bukti.kind] ?? bukti.kind : ""}
        metode={bukti ? LABEL_METODE[bukti.method] ?? bukti.method : ""}
        open={bukti !== null}
        onOpenChange={(b) => !b && setBukti(null)}
      />
      <DialogBiaya
        biaya={rinci}
        kategori={rinci ? LABEL_KATEGORI[rinci.category] ?? rinci.category : ""}
        open={rinci !== null}
        onOpenChange={(b) => !b && setRinci(null)}
        onDihapus={muatBiaya}
      />
    </div>
  );
}

function semuaCatatanKosong(n: number, adaSaring: boolean) {
  return n === 0 ? "*** belum ada mutasi tercatat ***" : adaSaring ? "*** tidak ada mutasi pada saringan ini ***" : "*** tidak ada mutasi pada periode ini ***";
}

/* Satu baris pilihan bertombol di papan (periode, mutasi, sumber). */
function BarisPil({
  judul,
  nilai,
  onPilih,
  opsi,
}: {
  judul: string;
  nilai: string;
  onPilih: (v: string) => void;
  opsi: { nilai: string; label: string; judul?: string }[];
}) {
  return (
    <div className="rko__pilbaris" role="group" aria-label={judul}>
      <span className="rko__piljudul">{judul}</span>
      <span className="rko__pil">
        {opsi.map((o) => (
          <button
            key={o.nilai}
            type="button"
            className={nilai === o.nilai ? "is-aktif" : ""}
            aria-pressed={nilai === o.nilai}
            title={o.judul}
            onClick={() => onPilih(o.nilai)}
          >
            {o.label}
          </button>
        ))}
      </span>
    </div>
  );
}

const KOLOM: { judul: string; kelas: string; urut: boolean }[] = [
  { judul: "Tgl", kelas: "tgl", urut: true },
  { judul: "Sandi", kelas: "sandi", urut: true },
  { judul: "Keterangan", kelas: "ket", urut: true },
  { judul: "Proyek", kelas: "proyek", urut: true },
  { judul: "Mutasi (Rp)", kelas: "mutasi", urut: true },
  { judul: "Saldo (Rp)", kelas: "saldo", urut: false },
];

function Lembar({
  h,
  nLembar,
  baris,
  kronologis,
  studio,
  labelPeriode,
  saldoAwal,
  akhirRentang,
  buku,
  cari,
  urutan,
  onUrut,
  terpilih,
  onCentang,
  semuaTercentang,
  sebagianTercentang,
  onCentangSemua,
  coret,
  onCoretSelesai,
  ringkas,
  onBuka,
  kosong,
  wadahRef,
  lipat,
  onSelesaiLipat,
}: {
  h: number;
  nLembar: number;
  baris: Mutasi[];
  kronologis: boolean;
  studio: string;
  labelPeriode: string;
  saldoAwal: number;
  akhirRentang: number;
  buku: { saldo: Map<string, number> };
  cari: string;
  urutan: Urutan | null;
  onUrut: (i: number) => void;
  terpilih: Set<string>;
  onCentang: (k: string) => void;
  semuaTercentang: boolean;
  sebagianTercentang: boolean;
  onCentangSemua: () => void;
  coret: string | null;
  onCoretSelesai: () => void;
  ringkas: { saldoAwal: number; akhirRentang: number; jmlKredit: number; jmlDebet: number; nKredit: number; nDebet: number };
  onBuka: (m: Mutasi) => void;
  kosong: string;
  wadahRef?: React.RefObject<HTMLDivElement | null>;
  lipat?: "naik" | "turun";
  onSelesaiLipat?: () => void;
}) {
  const semuaRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (semuaRef.current) semuaRef.current.indeterminate = sebagianTercentang;
  }, [sebagianTercentang]);
  const pertama = h === 0;
  const terakhir = h === nLembar - 1;
  /* Saldo pindahan = saldo baris sebelum baris pertama lembar ini. */
  const awalLembar = baris[0];
  const pindahan = awalLembar ? buku.saldo.get(awalLembar.kunci)! - (awalLembar.kredit ? awalLembar.nominal : -awalLembar.nominal) : saldoAwal;
  const cr = baris.filter((m) => m.kredit).reduce((n, m) => n + m.nominal, 0);
  const db = baris.filter((m) => !m.kredit).reduce((n, m) => n + m.nominal, 0);

  return (
    <article
      className={`rko__lembar${lipat ? ` is-lipat is-lipat--${lipat}` : ""}`}
      aria-hidden={lipat ? true : undefined}
      inert={lipat ? true : undefined}
      onAnimationEnd={(e) => {
        if (e.target === e.currentTarget) onSelesaiLipat?.();
      }}
    >
      <header className="rko__kop">
        <div className="rko__kopkiri">
          <span className="rko__kopstudio">{studio}</span>
          <h2 className="rko__kopjudul">Rekening koran</h2>
        </div>
        <dl className="rko__kopinfo">
          <div>
            <dt>Periode</dt>
            <dd>{labelPeriode}</dd>
          </div>
          <div>
            <dt>Lembar</dt>
            <dd>
              {h + 1} dari {nLembar}
            </dd>
          </div>
          <div>
            <dt>Mata uang</dt>
            <dd>IDR</dd>
          </div>
        </dl>
      </header>
      {/* Kotak ringkasan tercetak, seperti di kepala rekening koran bank.
          Saldo = seluruh catatan; kredit/debet = mutasi yang tersaring. */}
      <dl className="rko__ringkas" aria-label="Ringkasan periode">
        <div>
          <dt>Saldo awal</dt>
          <dd>{saldoTeks(ringkas.saldoAwal)}</dd>
        </div>
        <div>
          <dt>Mutasi kredit · {ringkas.nKredit}×</dt>
          <dd>
            {angka(ringkas.jmlKredit)} <em className="is-cr">CR</em>
          </dd>
        </div>
        <div>
          <dt>Mutasi debet · {ringkas.nDebet}×</dt>
          <dd>
            {angka(ringkas.jmlDebet)} <em>DB</em>
          </dd>
        </div>
        <div className="rko__ringkasakhir">
          <dt>Saldo akhir</dt>
          <dd className={ringkas.akhirRentang < 0 ? "is-minus" : ""}>{saldoTeks(ringkas.akhirRentang)}</dd>
        </div>
      </dl>

      <div className="rko__tabel" role="table" aria-label={`Rekening koran, lembar ${h + 1} dari ${nLembar}`}>
        <div className="rko__kepala" role="row">
          <span className="rko__c-centang" role="columnheader">
            <input
              ref={semuaRef}
              type="checkbox"
              className="k-centang rko__centang"
              checked={semuaTercentang}
              onChange={onCentangSemua}
              aria-label="Centang semua mutasi tersaring"
            />
          </span>
          {KOLOM.map((k, i) => {
            const aktif = urutan?.kolom === i ? urutan.arah : null;
            return (
              <span
                key={k.kelas}
                role="columnheader"
                className={`rko__c-${k.kelas}`}
                aria-sort={aktif === "naik" ? "ascending" : aktif === "turun" ? "descending" : undefined}
              >
                {k.urut ? (
                  <button type="button" className={`rko__urut${aktif ? ` is-${aktif}` : ""}`} onClick={() => onUrut(i)}>
                    {k.judul}
                    <i aria-hidden="true" />
                  </button>
                ) : (
                  k.judul
                )}
              </span>
            );
          })}
        </div>

        {/* Baris pembuka ada di SETIAP lembar dengan tinggi yang sama —
            saldo awal, saldo pindahan, atau urutan yang berlaku — supaya
            ruang baris yang diukur sama di lembar mana pun. */}
        <div className="rko__baris rko__baris--saldo" role="row">
          <span className="rko__c-centang" role="cell" />
          <span className="rko__c-tgl" role="cell" />
          <span className="rko__c-sandi" role="cell" />
          <span className="rko__c-ket" role="cell">
            <b>{kronologis ? (pertama ? "Saldo awal" : `Pindahan dari lembar ${h}`) : `Diurutkan menurut ${KOLOM[urutan!.kolom]!.judul.replace(" (Rp)", "").toLowerCase()}`}</b>
          </span>
          <span className="rko__c-mutasi" role="cell" />
          <span className="rko__c-saldo" role="cell">
            {kronologis ? saldoTeks(pertama ? saldoAwal : pindahan) : ""}
          </span>
        </div>

        <div className="rko__isi" ref={wadahRef} role="rowgroup">
          {baris.length === 0 ? (
            <p className="rko__kosong">{kosong}</p>
          ) : (
            baris.map((m) => {
              const saldo = buku.saldo.get(m.kunci)!;
              const kelas = [
                "rko__baris",
                m.kredit ? "is-cr" : "is-db",
                terpilih.has(m.kunci) ? "is-centang" : "",
                terpilih.has(m.kunci) && !lipat && (coret === "*" || coret === m.kunci) ? "is-coret" : "",
              ]
                .filter(Boolean)
                .join(" ");
              const label = `${tglPanjang(m.hari)}, ${m.nama}, ${m.kredit ? "kredit" : "debet"} ${formatRupiah(m.nominal)}, saldo ${rupiahSaldo(saldo)}`;
              const isiKet = (
                <>
                  <b>
                    <SorotTeks teks={m.nama} cari={cari} />
                  </b>
                  <small>
                    <SorotTeks teks={[m.sub, m.orang, m.catatan].filter(Boolean).join(" · ")} cari={cari} />
                  </small>
                </>
              );
              return (
                <div
                  key={m.kunci}
                  className={kelas}
                  role="row"
                  onAnimationEnd={(e) => {
                    if (e.animationName === "rko-stabilo") onCoretSelesai();
                  }}
                >
                  <span className="rko__c-centang" role="cell">
                    <input
                      type="checkbox"
                      className="k-centang rko__centang"
                      checked={terpilih.has(m.kunci)}
                      onChange={() => onCentang(m.kunci)}
                      aria-label={`Centang ${m.nama} ${tglPanjang(m.hari)}`}
                    />
                  </span>
                  <span className="rko__c-tgl" role="cell">
                    <b>{tglPendek(m.hari)}</b>
                    <small>{HARI[new Date(m.hari).getDay()]}</small>
                  </span>
                  <span className="rko__c-sandi" role="cell">
                    <span className={`rko__sandi is-${m.sumber}`}>{SANDI[m.sumber]}</span>
                  </span>
                  <span className="rko__c-ket" role="cell">
                    {m.bayar || m.biaya ? (
                      <button
                        type="button"
                        className="rko__buka"
                        aria-label={`${label}. ${m.bayar ? "Buka bukti pembayaran" : "Buka rincian biaya"}`}
                        onClick={() => onBuka(m)}
                      >
                        {isiKet}
                      </button>
                    ) : m.kas ? (
                      <a className="rko__buka" href="/admin/keuangan/kas" aria-label={`${label}. Ubah di Kas Studio`}>
                        {isiKet}
                      </a>
                    ) : (
                      isiKet
                    )}
                  </span>
                  <span className="rko__c-proyek" role="cell">
                    <SorotTeks teks={m.proyek ?? "—"} cari={cari} />
                  </span>
                  <span className="rko__c-mutasi" role="cell">
                    {angka(m.nominal)}
                    <em>{m.kredit ? "CR" : "DB"}</em>
                  </span>
                  <span className={`rko__c-saldo${saldo < 0 ? " is-minus" : ""}`} role="cell">
                    {saldoTeks(saldo)}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>

      <footer className="rko__kaki">
        <span className="rko__kakimutasi">
          Lembar ini · CR +{angka(cr)} · DB −{angka(db)}
        </span>
        {kronologis && terakhir ? (
          <span className="rko__saldoakhir">
            Saldo akhir <b>{saldoTeks(akhirRentang)}</b>
          </span>
        ) : (
          <span className="rko__bersambung">{terakhir ? "*** akhir rekening ***" : `bersambung ke lembar ${h + 2}`}</span>
        )}
      </footer>
    </article>
  );
}

function Kerangka() {
  return (
    <div className="rko rko--rangka" aria-busy="true">
      <div className="rko__papan">
        <section className="rko__sampul">
          <span className="rk" style={{ height: 30 }} />
          <span className="rk" style={{ height: 120 }} />
          <span className="rk" style={{ height: 96 }} />
          <span className="rk" style={{ flex: 1 }} />
        </section>
        <section className="rko__rol">
          <div className="rko__intipatas is-kosong" />
          <div className="rko__tumpuk">
            <article className="rko__lembar" />
          </div>
        </section>
      </div>
    </div>
  );
}

export function TransaksiKit() {
  return (
    <RequireAuth skeleton={<Kerangka />}>
      <ToastProvider>
        <Isi />
      </ToastProvider>
    </RequireAuth>
  );
}
