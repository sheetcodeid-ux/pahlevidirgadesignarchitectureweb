import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { navigate } from "astro:transitions/client";
import { RequireAuth } from "./RequireAuth";
import { DialogBukti } from "./buktiKit";
import { CapLunas } from "./capLunas";
import { PilihMenu } from "../kit/Formulir";
import { DropdownMenu } from "../kit/Overlay";
import { Cari } from "../kit/Isian";
import { Tombol } from "../kit/Tombol";
import { Ikon } from "../kit/Ikon";
import { TombolBulat } from "../kit/Item";
import { ToastProvider, useToast } from "../kit/Toast";
import { DotsThree, Sliders, Plus, CaretDown, NavReceipt, NavArrowsLeftRight, ChartBar } from "../kit/ikon";
import {
  daftarProyek,
  daftarPembayaran,
  semuaPembayaran,
  catatPembayaran,
  ambilSettings,
  bacaCache,
  tulisCache,
  type Proyek,
  type Pembayaran,
  type StudioSettings,
} from "../../lib/admin";
import { CATEGORY_LABELS, type ProjectCategory } from "../../lib/api";
import { proyekAktif, setProyekAktif, onProyekAktif } from "../../lib/proyekAktif";
import { formatRupiah } from "../../lib/format";
import { terbilang } from "../../lib/terbilang";
import { kodeProyek, inisial } from "../../lib/nomorDokumen";
import { BULAN_PENDEK } from "./frame25";

/* =============================================================================
   Terima Pembayaran — KOTAK KARTU PEMBAYARAN KLIEN.

   Benda dunia nyatanya: di meja administrasi studio ada sebuah kotak berisi
   satu KARTU PEMBAYARAN per proyek — kartu karton bergaris seperti kartu
   angsuran atau kartu SPP. Saat klien membayar, petugas menarik kartunya
   dari kotak, menaruhnya di meja, menulis satu baris (tanggal, uraian,
   jumlah diterima, sisa), lalu memarafnya. Sengaja berbeda dari tetangganya
   di Keuangan — Gaji (buku), Fee (kuitansi), Tagihan (papan jepit), Kas
   (mesin kas), Semua Transaksi (rekening koran), Catat Pengeluaran (nota +
   paku).

   Satu papan `--kas-bidang` berjahit, dua bagian:

   1. KOTAK KARTU — puncak kartu tiap proyek berdiri berurutan abjad, tab
      indeksnya berselang kiri/tengah/kanan seperti kartu indeks sungguhan,
      dengan sisa yang belum dibayar. Kartu yang sedang di meja meninggalkan
      KARTU PENGGANTI bermint ("di meja") di slotnya — kebiasaan arsip
      sungguhan supaya tempatnya tidak hilang. Muka kotak memuat label
      berbingkai: banyaknya kartu dan seluruh piutang di dalamnya.
   2. KARTU di meja — kop (No. KP-KODE, nama studio dari Info Studio, nilai
      kontrak), identitas klien, BUKU BARIS: tiap pembayaran satu baris
      berurut waktu dengan SISA BERJALAN dan paraf penerima; baris berikutnya
      yang sedang DITULIS (jumlah diketik di kolom Diterima, sisanya ikut
      bergerak); kotak centang tercetak "Pembayaran ini" (DP / Termin /
      Pelunasan — yang ditebak dicentang PENSIL, yang dipilih staf TINTA) dan
      "Lewat" (empat metode), diterima oleh + catatan; kaki berisi jumlah
      diterima, mistar kontrak, sisa, dan cap LUNAS saat kontraknya habis.

   SATU-SATUNYA gerak 3D: kartu yang diklik di kotak DITARIK keluar — mulai
   berdiri di tempatnya di kotak, lalu rebah di meja (`rotateX` dari tepi
   bawah). Jaraknya dibaca SEKALI saat diklik. Sesudah mencatat, baris baru
   tertulis dari kiri ke kanan dan parafnya tercap (2D); bila kontraknya
   habis, cap LUNAS dibubuhkan. Semuanya diam bila gerak dikurangi.

   Semua fitur versi frame 07 dibawa: metode (empat), jenis yang DITEBAK dari
   angkanya (aturan lama), `?proyek=` lebih dulu lalu proyek aktif, cari
   proyek, Saring → Semua Proyek, Proyek Baru, ringkasan kontrak, diterima
   oleh, catatan, Kosongkan, bukti pembayaran yang terbuka sendiri sesudah
   mencatat dan dari tiap baris, Lihat semua, menu ⋯. Tetap tanpa isian
   tanggal: `paid_at` diisi database (lihat `repository/payments.ts`).
   ============================================================================= */

const METODE = [
  { nilai: "tunai", label: "Tunai" },
  { nilai: "transfer", label: "Transfer" },
  { nilai: "qris", label: "QRIS" },
  { nilai: "lainnya", label: "Lainnya" },
];

const JENIS = [
  { nilai: "dp", label: "DP" },
  { nilai: "termin", label: "Termin" },
  { nilai: "pelunasan", label: "Pelunasan" },
];

const LABEL_METODE: Record<string, string> = Object.fromEntries(METODE.map((m) => [m.nilai, m.label]));
const LABEL_JENIS: Record<string, string> = Object.fromEntries(JENIS.map((j) => [j.nilai, j.label]));

/** Waktu baris baru "ditulis" sebelum bukti dibuka. */
const TULIS_MS = 1100;
const TARIK_MS = 860;

/**
 * Jenis DITEBAK dari angkanya, dengan aturan yang sama seperti dialog
 * pembayaran lama — staf yang terbiasa dengan tebakan lama mendapat tebakan
 * yang sama. Lunas oleh pembayaran ini = pelunasan; yang pertama = DP;
 * sisanya termin. Staf tetap bisa mengubahnya.
 */
function tebakJenis(nilai: number, kontrak: number, sudah: number): string {
  if (kontrak > 0 && sudah + nilai >= kontrak) return "pelunasan";
  return sudah === 0 ? "dp" : "termin";
}

/** "12.500.000" / "Rp12.500.000" / "12500000" -> 12500000. */
function keAngka(teks: string): number {
  const bersih = teks.replace(/[^\d]/g, "");
  return bersih ? Number(bersih) : 0;
}

/** Ditulis ulang dengan titik ribuan saat diketik, seperti di nota. */
function rapikan(teks: string): string {
  const n = keAngka(teks);
  return n ? n.toLocaleString("id-ID") : "";
}

function tanggalPendek(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.getDate()} ${BULAN_PENDEK[d.getMonth()]}`;
}

const tahunDari = (iso: string) => new Date(iso).getFullYear();

/** Angka yang berhitung ke nilai barunya (600 ms); seketika bila gerak
 *  dikurangi, dan seketika saat `kunci` berganti (kartu lain di meja —
 *  angka proyek lain bukan "bertambah"). */
function useHitung(nilai: number, kunci: string): number {
  const [tampil, setTampil] = useState(nilai);
  const kini = useRef(nilai);
  const kunciLama = useRef(kunci);
  useEffect(() => {
    const awal = kini.current;
    if (awal === nilai) {
      kunciLama.current = kunci;
      return;
    }
    if (kunciLama.current !== kunci || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      kunciLama.current = kunci;
      kini.current = nilai;
      setTampil(nilai);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const langkah = (t: number) => {
      const p = Math.min(1, (t - t0) / 600);
      const v = Math.round(awal + (nilai - awal) * (1 - Math.pow(1 - p, 3)));
      kini.current = v;
      setTampil(v);
      if (p < 1) raf = requestAnimationFrame(langkah);
    };
    raf = requestAnimationFrame(langkah);
    return () => cancelAnimationFrame(raf);
  }, [nilai, kunci]);
  /* Saat kartu berganti, nilai lama tidak boleh tergambar satu frame pun. */
  return kunciLama.current !== kunci ? nilai : tampil;
}

const geraknya = () =>
  typeof window !== "undefined" && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Centang tangan: tinta untuk pilihan staf, pensil putus untuk tebakan. */
function Centang() {
  return (
    <svg className="kpb__centang" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
      <path d="M2.6 8.6 6.2 12.2 13.6 3.2" />
    </svg>
  );
}

function Kotak({
  pilih,
  pensil,
  label,
  onPilih,
}: {
  pilih: boolean;
  pensil?: boolean;
  label: string;
  onPilih: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={pilih}
      tabIndex={pilih ? 0 : -1}
      className={`kpb__kotak${pilih ? " is-pilih" : ""}${pilih && pensil ? " is-pensil" : ""}`}
      onClick={onPilih}
    >
      <span className="kpb__kotakbox">{pilih && <Centang />}</span>
      {label}
    </button>
  );
}

/** Kelompok kotak centang bergaya radio: panah berpindah pilihan. */
function KelompokKotak({
  label,
  opsi,
  nilai,
  pensil,
  onPilih,
}: {
  label: string;
  opsi: { nilai: string; label: string }[];
  nilai: string;
  pensil?: boolean;
  onPilih: (v: string) => void;
}) {
  return (
    <div
      className="kpb__kelompok"
      role="radiogroup"
      aria-label={label}
      onKeyDown={(e) => {
        const i = opsi.findIndex((o) => o.nilai === nilai);
        const geser = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
        if (!geser) return;
        e.preventDefault();
        const j = (i + geser + opsi.length) % opsi.length;
        onPilih(opsi[j].nilai);
        e.currentTarget.querySelectorAll<HTMLButtonElement>("button")[j]?.focus();
      }}
    >
      <span className="kpb__kelompoklabel">{label}</span>
      {opsi.map((o) => (
        <Kotak key={o.nilai} label={o.label} pilih={o.nilai === nilai} pensil={pensil} onPilih={() => onPilih(o.nilai)} />
      ))}
    </div>
  );
}

function Isi() {
  const toast = useToast();

  const [proyek, setProyek] = useState<Proyek[] | null>(() => bacaCache<Proyek[]>("proyek"));
  /* `?proyek=` lebih dulu — dipakai tombol "Terima Bayar" di Semua Proyek
     dan menu Satu Proyek, supaya proyek yang sedang dibuka di sana langsung
     terpilih tanpa mengubah proyek aktif GLOBAL. */
  const [pilih, setPilih] = useState<string | null>(() => {
    try {
      return new URLSearchParams(location.search).get("proyek") ?? proyekAktif();
    } catch {
      return proyekAktif();
    }
  });
  const [cari, setCari] = useState("");
  const [metode, setMetode] = useState("transfer");
  const [jenis, setJenis] = useState<string | null>(null);
  const [nominal, setNominal] = useState("");
  const [penerima, setPenerima] = useState("");
  const [catatan, setCatatan] = useState("");
  const [kirim, setKirim] = useState(false);
  const [bayar, setBayar] = useState<Pembayaran[] | null>(null);
  /* Bukti yang sedang dibuka: otomatis sesudah pembayaran tercatat (itu
     saatnya tautan dikirim ke klien), atau dari baris di kartu. */
  const [bukti, setBukti] = useState<Pembayaran | null>(null);
  /* Pembayaran lintas proyek — untuk baris "terakhir dibayar" yang tampak
     saat puncak kartu di kotak diangkat. Kunci `bayar-semua` milik
     halaman lain; di sini cuma dibaca (jebakan #8). */
  const [semua, setSemua] = useState<Pembayaran[] | null>(() => bacaCache<Pembayaran[]>("bayar-semua"));
  /* Nama studio dari Info Studio — kunci `settings` milik halaman itu,
     di sini cuma dibaca (jebakan #8). */
  const [studio, setStudio] = useState(() => bacaCache<StudioSettings>("settings")?.studioName || "Studio");
  /* Gerak: kartu yang sedang ditarik dari kotak, baris yang baru ditulis,
     dan cap LUNAS yang baru dibubuhkan. */
  const [tarik, setTarik] = useState<{ id: string; n: number } | null>(null);
  const [baruId, setBaruId] = useState<string | null>(null);
  const [lunasBaru, setLunasBaru] = useState(false);
  const kartuRef = useRef<HTMLElement>(null);
  const barisRef = useRef<HTMLOListElement>(null);
  /* Lapisan tempat salinan kartu lama dikembalikan ke kotak. React tidak
     pernah merender anak di sini, jadi salinan DOM-nya aman ditempel. */
  const lapisRef = useRef<HTMLDivElement>(null);
  const deretRef = useRef<HTMLOListElement>(null);
  /* Jarak tarik dibaca saat diklik, dipasang sesudah kartu baru terpasang. */
  const jarak = useRef<{ dx: number; dy: number; sk: number } | null>(null);

  useEffect(() => onProyekAktif(setPilih), []);

  useEffect(() => {
    daftarProyek()
      .then((d) => {
        tulisCache("proyek", d);
        setProyek(d);
      })
      .catch(() => setProyek((l) => l ?? []));
    ambilSettings()
      .then((s) => setStudio(s.studioName || "Studio"))
      .catch(() => {});
    semuaPembayaran()
      .then(setSemua)
      .catch(() => {});
  }, []);

  /* Kartu urut abjad, seperti kotak kartu sungguhan. Posisi tab indeks
     (kiri/tengah/kanan) mengikuti urutan itu, dan tab kartu di meja memakai
     posisi yang SAMA dengan slotnya di kotak. */
  const urut = useMemo(
    () => [...(proyek ?? [])].sort((a, b) => a.title.localeCompare(b.title, "id")),
    [proyek],
  );

  /* Proyek terpilih: yang dipilih staf, kalau tidak ada yang pertama. */
  const aktif = useMemo(() => urut.find((p) => p.id === pilih) ?? urut[0] ?? null, [pilih, urut]);
  const posisiTab = aktif ? urut.indexOf(aktif) % 3 : 0;

  useEffect(() => {
    if (!aktif) return;
    let batal = false;
    setBayar(bacaCache<Pembayaran[]>(`bayar:${aktif.id}`));
    daftarPembayaran(aktif.id)
      .then((d) => {
        if (batal) return;
        tulisCache(`bayar:${aktif.id}`, d);
        setBayar(d);
      })
      .catch(() => {});
    return () => {
      batal = true;
    };
  }, [aktif?.id]);

  const tersaring = useMemo(() => {
    const q = cari.trim().toLowerCase();
    if (!q) return urut;
    return urut.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        (p.client ?? "").toLowerCase().includes(q) ||
        (p.city ?? "").toLowerCase().includes(q),
    );
  }, [urut, cari]);

  /* Pembayaran terakhir dan banyaknya per proyek. */
  const riwayat = useMemo(() => {
    const m = new Map<string, { akhir: Pembayaran; n: number }>();
    for (const b of semua ?? []) {
      const l = m.get(b.projectId);
      if (!l) m.set(b.projectId, { akhir: b, n: 1 });
      else {
        l.n += 1;
        if (b.paidAt > l.akhir.paidAt) l.akhir = b;
      }
    }
    return m;
  }, [semua]);

  /* Isi kotak: kartu pemisah huruf (seperti kotak kartu indeks sungguhan)
     sebelum kartu pertama tiap huruf awal — hanya saat tidak mencari. */
  const deret = useMemo(() => {
    const out: ({ jenis: "huruf"; huruf: string } | { jenis: "kartu"; p: Proyek })[] = [];
    let akhir = "";
    for (const p of tersaring) {
      const h = (p.title.trim()[0] ?? "#").toUpperCase();
      if (!cari.trim() && h !== akhir) {
        out.push({ jenis: "huruf", huruf: h });
        akhir = h;
      }
      out.push({ jenis: "kartu", p });
    }
    return out;
  }, [tersaring, cari]);

  const piutang = useMemo(
    () => urut.reduce((n, p) => n + Math.max(0, (p.contractValue ?? 0) - (p.paidTotal ?? 0)), 0),
    [urut],
  );

  const kontrak = aktif?.contractValue ?? 0;
  const angka = keAngka(nominal);

  /* Baris kartu: berurut waktu, dengan sisa berjalan. "Sudah diterima"
     diambil dari barisnya sendiri bila sudah ada, supaya jumlah di kaki
     kartu = jumlah kolom Diterima. */
  const baris = useMemo(() => {
    const d = [...(bayar ?? [])].sort((a, b) => a.paidAt.localeCompare(b.paidAt) || a.id.localeCompare(b.id));
    let kum = 0;
    return d.map((b, i) => {
      kum += b.amount;
      return { b, no: i + 1, sisa: kontrak - kum };
    });
  }, [bayar, kontrak]);
  const sudah = bayar ? baris.reduce((n, r) => n + r.b.amount, 0) : aktif?.paidTotal ?? 0;
  const sisa = kontrak - sudah;
  const lunas = kontrak > 0 && sisa <= 0;
  const sisaSesudah = kontrak - sudah - angka;

  /* Jenis yang BERLAKU: yang dipilih staf kalau ia sudah menyentuhnya,
     kalau belum hasil tebakan. Disimpan sebagai null-dan-tebakan supaya
     tebakan tidak menimpa pilihan staf satu ketukan setelah ia memilih. */
  const jenisBerlaku = jenis ?? tebakJenis(angka, kontrak, sudah);
  const bisaKirim = Boolean(aktif) && angka > 0 && !kirim;

  const sudahTampil = useHitung(sudah, aktif?.id ?? "");
  const sisaTampil = useHitung(Math.max(0, sisa), aktif?.id ?? "");
  const persen = kontrak > 0 ? Math.min(100, (sudah / kontrak) * 100) : 0;
  const persenKetik = kontrak > 0 ? Math.min(100 - persen, (angka / kontrak) * 100) : 0;
  const tglLunas = lunas ? baris[baris.length - 1]?.b.paidAt : undefined;

  /* Baris yang ditulis selalu tampak: gulungan baris turun ke dasarnya
     saat kartu berganti atau barisnya bertambah. Dibaca sekali per
     perubahan, bukan di handler gulir (jebakan #21). */
  useLayoutEffect(() => {
    const el = barisRef.current;
    if (el && el.scrollHeight > el.clientHeight) el.scrollTop = el.scrollHeight;
  }, [aktif?.id, baris.length]);

  /* Kotak dilihat dari DEPAN: kalau kartunya lebih banyak dari tingginya,
     yang tampak kartu paling depan (dasar deret), bukan yang paling
     belakang — tanpa ini kartu depan tertutup muka kotak. Kartu pengganti
     "Di meja" tetap dijaga kelihatan. Sekali per perubahan isi kotak. */
  useLayoutEffect(() => {
    const el = deretRef.current;
    if (!el || el.scrollHeight <= el.clientHeight) return;
    el.scrollTop = el.scrollHeight;
    const meja = el.querySelector<HTMLElement>(".is-meja");
    if (meja && meja.offsetTop - 18 < el.scrollTop) el.scrollTop = meja.offsetTop - 18;
  }, [deret.length]);

  /* Kartu baru terpasang (key = id proyek): pasang jarak tariknya. */
  useLayoutEffect(() => {
    const kartu = kartuRef.current;
    const j = jarak.current;
    if (!kartu || !j || !tarik) return;
    kartu.style.setProperty("--kpb-dx", `${j.dx}px`);
    kartu.style.setProperty("--kpb-dy", `${j.dy}px`);
    kartu.style.setProperty("--kpb-sk", j.sk.toFixed(3));
    jarak.current = null;
  }, [tarik]);

  useEffect(() => {
    if (!tarik) return;
    const t = setTimeout(() => setTarik(null), TARIK_MS + 60);
    return () => clearTimeout(t);
  }, [tarik]);

  const alasan = !aktif
    ? "Pilih kartu proyek dulu."
    : angka <= 0
      ? "Tulis jumlah yang diterima di baris kartu."
      : `Siap dicatat — ${formatRupiah(angka)}, ${LABEL_JENIS[jenisBerlaku]} lewat ${LABEL_METODE[metode]}.`;

  function kosongkan() {
    setNominal("");
    setPenerima("");
    setCatatan("");
    setJenis(null);
  }

  function pilihProyek(p: Proyek, dari?: HTMLElement) {
    if (p.id === aktif?.id) return;
    /* Kartu ditarik dari slotnya: jarak slot → meja dibaca SEKALI di sini. */
    const kartu = kartuRef.current;
    if (dari && kartu && geraknya()) {
      const a = dari.getBoundingClientRect();
      const b = kartu.getBoundingClientRect();
      kembalikan(kartu, b);
      /* Dari tengah-bawah ke tengah-bawah: kartu berporos di tepi bawahnya. */
      jarak.current = {
        dx: Math.round(a.left + a.width / 2 - (b.left + b.width / 2)),
        dy: Math.round(a.bottom - b.bottom),
        sk: a.width / Math.max(1, b.width),
      };
      setTarik((t) => ({ id: p.id, n: (t?.n ?? 0) + 1 }));
    } else {
      jarak.current = null;
      setTarik(null);
    }
    /* Baris kartu baru langsung dari cache-nya, di render yang SAMA dengan
       pergantian kartu — tanpa ini satu frame menggambar baris proyek lama
       di bawah kop proyek baru. */
    setBayar(bacaCache<Pembayaran[]>(`bayar:${p.id}`));
    setProyekAktif(p.id);
    setPilih(p.id);
    setJenis(null);
    setBaruId(null);
    setLunasBaru(false);
  }

  /* Kartu lama DIKEMBALIKAN ke slotnya (kartu pengganti "Di meja") sambil
     kartu baru ditarik keluar: salinan DOM-nya terbang ke slot itu, berdiri,
     lalu hilang di baliknya. Dibaca sekali, saat diklik. */
  function kembalikan(kartu: HTMLElement, b: DOMRect) {
    const lapis = lapisRef.current;
    const slot = document.querySelector<HTMLElement>(".kpb__slot.is-meja .kpb__puncak");
    if (!lapis || !slot) return;
    const l = lapis.getBoundingClientRect();
    const t = slot.getBoundingClientRect();
    const klon = kartu.cloneNode(true) as HTMLElement;
    klon.classList.remove("is-tarik");
    klon.classList.add("kpb__kartu--kembali");
    klon.setAttribute("inert", "");
    klon.setAttribute("aria-hidden", "true");
    klon.querySelectorAll("[id]").forEach((e) => e.removeAttribute("id"));
    klon.style.left = `${b.left - l.left}px`;
    klon.style.top = `${b.top - l.top}px`;
    klon.style.width = `${b.width}px`;
    klon.style.height = `${b.height}px`;
    klon.style.setProperty("--kpb-dx", `${Math.round(t.left + t.width / 2 - (b.left + b.width / 2))}px`);
    klon.style.setProperty("--kpb-dy", `${Math.round(t.bottom - b.bottom)}px`);
    klon.style.setProperty("--kpb-sk", (t.width / Math.max(1, b.width)).toFixed(3));
    lapis.replaceChildren(klon);
    const buang = () => klon.remove();
    klon.addEventListener("animationend", buang, { once: true });
    setTimeout(buang, 700);
  }

  async function simpan() {
    if (!aktif || angka <= 0) return;
    setKirim(true);
    const proyekId = aktif.id;
    const jadiLunas = !lunas && kontrak > 0 && sisaSesudah <= 0;
    try {
      const baru = await catatPembayaran(proyekId, {
        amount: angka,
        kind: jenisBerlaku,
        method: metode,
        receiver: penerima.trim() || null,
        note: catatan.trim() || null,
      });
      toast({
        judul: "Pembayaran tercatat",
        keterangan: `${formatRupiah(angka)} — ${LABEL_JENIS[jenisBerlaku]} lewat ${LABEL_METODE[metode]}.`,
        nada: "sukses",
      });
      /* Baris baru langsung tertulis di kartu; daftar segar menggantinya. */
      if (baru?.id) {
        setBayar((l) => [...(l ?? []).filter((x) => x.id !== baru.id), baru]);
        setBaruId(baru.id);
      }
      setLunasBaru(jadiLunas);
      setNominal("");
      setCatatan("");
      setJenis(null);
      /* Daftar proyek ikut disegarkan: `paidTotal` di kotak kartu baru saja
         berubah, dan angka basi di layar persis keluhan yang membuat tombol
         Terbitkan ada. */
      semuaPembayaran()
        .then(setSemua)
        .catch(() => {});
      const [b, d] = await Promise.all([daftarPembayaran(proyekId), daftarProyek()]);
      tulisCache(`bayar:${proyekId}`, b);
      tulisCache("proyek", d);
      setBayar(b);
      setProyek(d);
      /* Endpoint membalas baris yang baru dibuat beserta receiptToken-nya;
         kalau suatu saat tidak, cari di daftar yang baru diambil. Bukti
         dibuka sesudah barisnya selesai ditulis. */
      const untukBukti = baru?.receiptToken ? baru : b.find((x) => x.id === baru?.id) ?? null;
      setTimeout(() => setBukti(untukBukti), geraknya() ? TULIS_MS : 0);
    } catch (e) {
      toast({
        judul: "Gagal mencatat",
        keterangan: e instanceof Error ? e.message : "Coba lagi.",
        nada: "gagal",
      });
    } finally {
      setKirim(false);
    }
  }

  const kode = aktif ? kodeProyek(aktif.title) : "—";
  const studioInisial = inisial(studio) || "ST";
  const kategori = aktif ? CATEGORY_LABELS[aktif.category as ProjectCategory] ?? aktif.category : "";
  const hariIni = tanggalPendek(new Date().toISOString());

  return (
    <div className="kpb">
      <div className="kpb__papan">
        {/* ---- Kotak kartu -------------------------------------------------- */}
        <section className="kpb__kiri" aria-label="Kotak kartu pembayaran">
          <p className="kpb__alis">
            Kotak kartu pembayaran <span>· {urut.length} kartu</span>
          </p>
          <div className="kpb__cari">
            <Cari
              className="kpb__carikotak"
              ukuran="small"
              judul="Cari kartu"
              placeholder="Cari proyek, klien, kota"
              value={cari}
              onChange={(e) => setCari(e.currentTarget.value)}
            />
            {/* Ke tempat penyaringan yang sebenarnya, Semua Proyek. */}
            <TombolBulat className="kpb__bulat" ikon={Sliders} judul="Saring di Semua Proyek" onClick={() => navigate("/admin/proyek")} />
          </div>

          <div className="kpb__kotakkartu">
            {/* Dinding samping kotak — makin dekat makin lebar. */}
            <i className="kpb__dinding kpb__dinding--kiri" aria-hidden="true" />
            <i className="kpb__dinding kpb__dinding--kanan" aria-hidden="true" />
            <ol className="kpb__deret" ref={deretRef}>
              {deret.map((d, j) => {
                /* Kedalaman: kartu paling depan 0; yang di belakang sedikit
                   lebih sempit dan lebih gelap (dibatasi 6). */
                const dalam = Math.min(6, deret.length - 1 - j);
                if (d.jenis === "huruf") {
                  return (
                    <li
                      key={`huruf-${d.huruf}`}
                      className="kpb__slot kpb__pemisah"
                      style={{ "--kpb-dalam": dalam, zIndex: j + 1 } as CSSProperties}
                      aria-hidden="true"
                    >
                      <span className="kpb__tab">{d.huruf}</span>
                    </li>
                  );
                }
                const p = d.p;
                const i = urut.indexOf(p);
                const k = p.contractValue ?? 0;
                const s = Math.max(0, k - (p.paidTotal ?? 0));
                const gaya = { "--kpb-tab": i % 3, "--kpb-dalam": dalam, zIndex: j + 1 } as CSSProperties;
                if (aktif?.id === p.id) {
                  return (
                    <li key={p.id} className="kpb__slot is-meja" style={gaya} aria-current="true">
                      <span className="kpb__tab">Di meja</span>
                      <div className="kpb__puncak">
                        <span className="kpb__puncaknama">{kodeProyek(p.title)} · {p.title}</span>
                        <small>kartunya sedang ditulis</small>
                      </div>
                    </li>
                  );
                }
                const r = riwayat.get(p.id);
                return (
                  <li key={p.id} className={`kpb__slot${k > 0 && s === 0 ? " is-lunas" : ""}${k ? "" : " is-polos"}`} style={gaya}>
                    <button type="button" className="kpb__tarik" onClick={(e) => pilihProyek(p, e.currentTarget)}>
                      <span className="kpb__tab">{kodeProyek(p.title)}</span>
                      <span className="kpb__puncak">
                        <span className="kpb__puncaknama">{p.title}</span>
                        <small>{p.client || p.city || "—"}</small>
                        <b>
                          {!k ? (
                            "tanpa kontrak"
                          ) : s === 0 ? (
                            "lunas"
                          ) : (
                            <>
                              <small>sisa</small> {formatRupiah(s)}
                            </>
                          )}
                        </b>
                        {k > 0 && (
                          <i className="kpb__puncakmeter" aria-hidden="true">
                            <i style={{ width: `${Math.min(100, ((k - s) / k) * 100)}%` }} />
                          </i>
                        )}
                      </span>
                      {/* Badan kartu yang tampak saat puncaknya diangkat. */}
                      <span className="kpb__intip">
                        {r ? (
                          <>
                            terakhir <b>{tanggalPendek(r.akhir.paidAt)}</b> · {formatRupiah(r.akhir.amount)} · {r.n}× bayar
                          </>
                        ) : (
                          "belum ada pembayaran"
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}
              {tersaring.length === 0 && (
                <li className="kpb__kosong">{proyek === null ? "Memuat kartu…" : "Tidak ada kartu yang cocok."}</li>
              )}
            </ol>
            {/* Muka kotak: label berbingkai logam dengan data sungguhan. */}
            <div className="kpb__muka">
              <div className="kpb__label">
                <i className="kpb__sekrup" aria-hidden="true" />
                <i className="kpb__sekrup kpb__sekrup--kanan" aria-hidden="true" />
                <span>Pembayaran klien</span>
                <b>{formatRupiah(piutang)}</b>
                <small>belum dibayar · {urut.length} kartu</small>
              </div>
              <i className="kpb__pegangan" aria-hidden="true" />
            </div>
          </div>

          <Tombol ukuran="medium" jenis="secondary" kiri={Plus} onClick={() => navigate("/admin/proyek/baru")}>
            Proyek Baru
          </Tombol>
        </section>

        {/* ---- Meja: kartu yang sedang ditulis -------------------------------- */}
        <section className="kpb__meja" aria-label="Kartu pembayaran di meja">
          <div className="kpb__lapis" ref={lapisRef} aria-hidden="true" />
          <article
            ref={kartuRef}
            key={aktif?.id ?? "kosong"}
            className={`kpb__kartu${tarik && tarik.id === aktif?.id ? " is-tarik" : ""}`}
            style={{ "--kpb-tab": posisiTab } as CSSProperties}
          >
            <span className="kpb__tab kpb__tab--kartu" aria-hidden="true">{kode}</span>

            <header className="kpb__kop">
              <div className="kpb__judul">
                <h3>Kartu pembayaran</h3>
                <p>{studio} · kartu klien, disimpan di kotak kartu</p>
              </div>
              <dl className="kpb__nilai kpb__nomor">
                <dt>No. kartu</dt>
                <dd>KP-{kode}</dd>
              </dl>
              <dl className="kpb__nilai">
                <dt>Nilai kontrak</dt>
                <dd>{kontrak ? formatRupiah(kontrak) : "belum berkontrak"}</dd>
              </dl>
            </header>

            <div className="kpb__identitas">
              <div className="kpb__isian kpb__isian--proyek">
                <span>Proyek</span>
                <PilihMenu
                  id="kpb-proyek"
                  label="Proyek"
                  nilai={aktif?.id ?? ""}
                  onUbah={(v) => {
                    const p = urut.find((x) => x.id === v);
                    if (p) pilihProyek(p);
                  }}
                  opsi={urut.map((p) => ({ nilai: p.id, label: p.title, ket: kodeProyek(p.title) }))}
                  pemicu={
                    <button type="button" className="kpb__tulis">
                      <span>{aktif?.title ?? "Pilih proyek"}</span>
                      <Ikon ikon={CaretDown} ukuran={12} className="kpb__tuliscaret" />
                    </button>
                  }
                />
              </div>
              <div className="kpb__isian">
                <span>Klien</span>
                <b>{aktif?.client || "—"}</b>
              </div>
              <div className="kpb__isian">
                <span>Kota · jenis</span>
                <b>{[aktif?.city, kategori].filter(Boolean).join(" · ") || "—"}</b>
              </div>
            </div>

            <div className="kpb__buku" role="table" aria-label="Pembayaran yang diterima">
              {/* Garis kolom tercetak: satu lapis di atas seluruh tinggi buku,
                  jadi baris kosong di bawahnya tetap berkolom. */}
              <div className="kpb__kolom" aria-hidden="true">
                <i />
                <i />
                <i />
                <i />
                <i />
                <i />
              </div>
              <div className="kpb__bkepala" role="row">
                <span role="columnheader">No.</span>
                <span role="columnheader">Tanggal</span>
                <span role="columnheader">Uraian</span>
                <span role="columnheader">Diterima (Rp)</span>
                <span role="columnheader">Sisa (Rp)</span>
                <span role="columnheader">Paraf</span>
              </div>
              <ol className="kpb__baris" ref={barisRef} role="rowgroup">
                {baris.map(({ b, no, sisa: s }) => (
                  <li key={b.id} className={`kpb__bbaris${b.id === baruId ? " is-baru" : ""}`} role="row">
                    <span role="cell" className="kpb__no">{no}</span>
                    <span role="cell" className="kpb__tgl">
                      {tanggalPendek(b.paidAt)}
                      {tahunDari(b.paidAt) !== new Date().getFullYear() && <small>{tahunDari(b.paidAt)}</small>}
                    </span>
                    <span role="cell" className="kpb__uraian">
                      {/* Seluruh baris bisa diklik lewat ::after tombol ini. */}
                      <button
                        type="button"
                        className="kpb__bukabukti"
                        onClick={() => setBukti(b)}
                        aria-label={`Bukti pembayaran ke-${no}, ${formatRupiah(b.amount)}, ${tanggalPendek(b.paidAt)}`}
                      >
                        {LABEL_JENIS[b.kind] ?? b.kind} · {LABEL_METODE[b.method] ?? b.method}
                      </button>
                      {b.note && <small>{b.note}</small>}
                    </span>
                    <span role="cell" className="kpb__rp">{b.amount.toLocaleString("id-ID")}</span>
                    <span role="cell" className="kpb__rp kpb__rp--sisa">
                      {kontrak ? (s >= 0 ? s.toLocaleString("id-ID") : `lebih ${(-s).toLocaleString("id-ID")}`) : "—"}
                    </span>
                    <span role="cell" className="kpb__paraf">
                      {b.receiver ? (
                        <i className="kpb__parafcap" data-judul={`Diterima ${b.receiver}`}>{inisial(b.receiver)}</i>
                      ) : (
                        <i className="kpb__parafkosong">—</i>
                      )}
                    </span>
                  </li>
                ))}

                {/* Baris berikutnya — yang sedang DITULIS. */}
                {aktif && (
                  <li className="kpb__bbaris kpb__bbaris--tulis" role="row">
                    <span role="cell" className="kpb__no">{baris.length + 1}</span>
                    <span role="cell" className="kpb__tgl">{hariIni}</span>
                    <span role="cell" className="kpb__uraian">
                      <b>{LABEL_JENIS[jenisBerlaku]} · {LABEL_METODE[metode]}</b>
                      <small className={catatan.trim() ? "" : "is-kosong"}>{catatan.trim() || "catatan di bawah"}</small>
                    </span>
                    <span role="cell" className="kpb__rp kpb__rp--isi">
                      {/* `inputMode`, bukan `type=number`: type=number menolak
                          titik pemisah ribuan. */}
                      <input
                        id="kpb-nominal"
                        inputMode="numeric"
                        autoComplete="off"
                        aria-label="Jumlah diterima (rupiah)"
                        placeholder="0"
                        value={nominal}
                        onChange={(e) => setNominal(rapikan(e.currentTarget.value))}
                      />
                    </span>
                    <span role="cell" className={`kpb__rp kpb__rp--sisa${angka && kontrak && sisaSesudah < 0 ? " is-lebih" : ""}`}>
                      {!kontrak
                        ? "—"
                        : !angka
                          ? Math.max(0, sisa).toLocaleString("id-ID")
                          : sisaSesudah >= 0
                            ? sisaSesudah.toLocaleString("id-ID")
                            : `lebih ${(-sisaSesudah).toLocaleString("id-ID")}`}
                    </span>
                    <span role="cell" className="kpb__paraf">
                      {penerima.trim() ? (
                        <i className="kpb__parafcap is-pensil">{inisial(penerima)}</i>
                      ) : (
                        <i className="kpb__paraftunggu" aria-hidden="true" />
                      )}
                    </span>
                  </li>
                )}
                <li className="kpb__bkosong" aria-hidden="true" />
              </ol>
            </div>

            <div className="kpb__formulir">
              <div className="kpb__formbaris">
                <KelompokKotak
                  label="Pembayaran ini"
                  opsi={JENIS}
                  nilai={jenisBerlaku}
                  pensil={jenis === null}
                  onPilih={setJenis}
                />
                <KelompokKotak label="Lewat" opsi={METODE} nilai={metode} onPilih={setMetode} />
              </div>
              <div className="kpb__formbaris">
                <label className="kpb__garis kpb__garis--siapa" htmlFor="kpb-penerima">
                  <span>Diterima oleh</span>
                  <input
                    id="kpb-penerima"
                    autoComplete="off"
                    placeholder="nama staf"
                    value={penerima}
                    onChange={(e) => setPenerima(e.currentTarget.value)}
                  />
                </label>
                <label className="kpb__garis" htmlFor="kpb-catatan">
                  <span>Catatan</span>
                  <input
                    id="kpb-catatan"
                    autoComplete="off"
                    placeholder="mis. termin kedua, setelah gambar kerja"
                    value={catatan}
                    onChange={(e) => setCatatan(e.currentTarget.value)}
                  />
                </label>
              </div>
              <p className="kpb__terbilang">
                <span>Terbilang</span>
                <i>{angka ? `# ${terbilang(angka)} #` : ""}</i>
              </p>
            </div>

            <footer className="kpb__kaki">
              <div className="kpb__jumlah">
                <span>Jumlah diterima · {baris.length}×</span>
                <b>{formatRupiah(sudahTampil)}</b>
              </div>
              <div className="kpb__mistar" aria-hidden="true">
                {kontrak > 0 && (
                  <span className="kpb__penanda" style={{ "--kpb-pos": `${persen + persenKetik}%` } as CSSProperties}>
                    {Math.round(persen + persenKetik)}%{persenKetik > 0 && <small> sesudah ini</small>}
                  </span>
                )}
                <div className="kpb__mistarlintas">
                  <span className="kpb__mistarisi" style={{ width: `${persen}%` }} />
                  <span className="kpb__mistarketik" style={{ left: `${persen}%`, width: `${persenKetik}%` }} />
                </div>
                <i className="kpb__gerigi" />
                <div className="kpb__mistarangka">
                  <span>0</span>
                  <span>25</span>
                  <span>50</span>
                  <span>75</span>
                  <span>100%</span>
                </div>
              </div>
              <div className="kpb__jumlah kpb__jumlah--sisa">
                <span>Sisa kontrak{kontrak ? "" : " · tanpa kontrak"}</span>
                <b>{kontrak ? formatRupiah(sisaTampil) : "—"}</b>
              </div>
              <div className={`kpb__capslot${lunasBaru ? " is-baru" : ""}`}>
                {lunas && tglLunas ? (
                  <CapLunas tanggal={tglLunas} studio={studioInisial} id={`kpb-${aktif?.id}`} kelas="kpb" ukuran={60} />
                ) : (
                  <span className="kpb__capkosong">cap lunas</span>
                )}
              </div>
            </footer>
            <i className="kpb__lubang" aria-hidden="true" />
          </article>

          <div className="kpb__aksi">
            <DropdownMenu
              /* Tombol polos, bukan TombolBulat: petunjuk (tooltip) di dalam
                 TombolBulat jadi lapisan teratas, dan Escape pertama menutup
                 petunjuknya, bukan menunya. */
              trigger={
                <button type="button" className="kpb__menu" aria-label="Buka halaman lain">
                  <Ikon ikon={DotsThree} ukuran={20} />
                </button>
              }
              sections={[
                {
                  label: "Buka",
                  items: (
                    [
                      ["Semua transaksi", NavArrowsLeftRight, "/admin/keuangan/transaksi"],
                      ["Tagihan & termin", NavReceipt, "/admin/keuangan/tagihan"],
                      ["Ringkasan keuangan", ChartBar, "/admin/keuangan"],
                    ] as const
                  ).map(([label, ikon, ke]) => ({ label, ikon, onSelect: () => navigate(ke) })),
                },
              ]}
            />
            <a className="kpb__semua" href="/admin/keuangan/transaksi?jenis=masuk">
              Semua uang masuk
            </a>
            <p className="kpb__alasan" aria-live="polite">{alasan}</p>
            <Tombol ukuran="medium" jenis="secondary" onClick={kosongkan}>
              Kosongkan
            </Tombol>
            <Tombol memuat={kirim} ukuran="medium" disabled={!bisaKirim} onClick={simpan}>
              {kirim ? "Mencatat…" : "Catat pembayaran"}
            </Tombol>
          </div>
        </section>
      </div>

      <DialogBukti
        bayar={bukti}
        judulProyek={aktif?.title ?? ""}
        whatsapp={aktif?.clientWhatsapp}
        jenis={bukti ? LABEL_JENIS[bukti.kind] ?? bukti.kind : ""}
        metode={bukti ? LABEL_METODE[bukti.method] ?? bukti.method : ""}
        open={bukti !== null}
        onOpenChange={(b) => !b && setBukti(null)}
      />
    </div>
  );
}

export function TerimaKit() {
  /* ToastProvider dipasang DI SINI: bawaan konteksnya `() => {}`, jadi tanpa
     penyedia setiap toast hilang tanpa jejak. */
  return (
    <ToastProvider>
      <RequireAuth
        skeleton={
          <div className="kpb kpb--rangka">
            <div className="kpb__papan" />
          </div>
        }
      >
        <Isi />
      </RequireAuth>
    </ToastProvider>
  );
}
