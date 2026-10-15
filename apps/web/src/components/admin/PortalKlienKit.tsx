import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent,
  type KeyboardEvent,
  type PointerEvent as PointerEventReact,
} from "react";
import { GagalMuat } from "./gagalMuat";
import { IsianTanggal, IsianPanjang, Lampiran, PilihMenu } from "../kit/Formulir";
import { RequireAuth } from "./RequireAuth";
import { ToastProvider, useToast } from "../kit/Toast";
import { AlertDialog } from "../kit/Overlay";
import { Tombol } from "../kit/Tombol";
import { Isian } from "../kit/Isian";
import { Gelembung } from "../kit/Item";
import { GulirPesan, RangkaBaris } from "../kit/Tampilan";
import { Ikon } from "../kit/Ikon";
import { Icon } from "../ui/Icon";
import {
  ArrowClockwise,
  ArrowRight,
  CaretDown,
  ChatTeardropDots,
  CopySimple,
  Eye,
  FilePdf,
  FileText,
  Globe,
  Plus,
  Trash,
} from "../kit/ikon";
import { PemutarSuaraKit, PerekamSuaraKit } from "../kit/Suara";
import { formatDurasi } from "../ui/misc/VoiceNote";
import { usePilihProyek } from "./pilihProyekKit";
import { geraknya, Hitung } from "./hitung";
import { kodeProyek } from "../../lib/nomorDokumen";
import { CATEGORY_LABELS } from "../../lib/api";
import {
  ambilBrief,
  ubahBrief,
  daftarDokumen,
  tambahDokumen,
  ubahDokumen,
  hapusDokumen,
  daftarKomentarDokumen,
  tambahKomentarDokumen,
  ambilProgress,
  ubahFaseProgress,
  buatUlangTokenProgress,
  tambahCatatanProgress,
  hapusCatatanProgress,
  mintaUrlUnggah,
  ambilSettings,
  bacaCache,
  tulisCache,
  MAKS_BYTE_DOKUMEN,
  type Proyek,
  type BriefProyek,
  type DokumenProyek,
  type KomentarDokumen,
  type ProjectProgress,
  type StudioSettings,
} from "../../lib/admin";
import { useCegahPindah } from "../../lib/cegahPindah";
import { tanya } from "../../lib/tanya";
import { bukaLightbox } from "../../lib/lightbox";

/* =============================================================================
   Portal Klien = MAP PRESENTASI KLIEN.

   Semua yang dilihat klien lewat tautan /progres?t=… Di studio arsitek, gambar
   yang diserahkan ke klien dibawa dalam MAP PRESENTASI: tas kulit beritsleting
   yang dibuka di meja klien — di kanan lembar-lembar gambar, di sayap kiri
   kartu nama studio dan kantong plastik berisi catatan asistensi, kerangka
   acuan, dan kabar. Halaman ini benda itu.

   1. KOP di tutup map — nomor map, judul proyek (sekaligus pemilih), baris
      Pemilik · Lokasi · Jenis · Perencana (Info Studio, dibaca saja) · Jadwal,
      dan LINTASAN TAHAP yang dilihat klien (enam stasiun, sekaligus pengubah
      fase).
   2. LEMBAR GAMBAR besar — satu dokumen di atas tumpukan: bidang gambar
      berbingkai rangkap (gambar utuh, lembar PDF, atau pesan suara) dengan
      STEMPEL tanggapan dan AWAN REVISI, dan KOP GAMBAR di tepi kanan seperti
      gambar kerja sungguhan: perencana, proyek, pemilik, judul gambar,
      nomor lembar {KODE}-NN (urutan kirim), tanggal kirim, jenis/ukuran,
      kotak STATUS (lima kotak centang — sekaligus pengubah status), dan
      asistensi (jumlah komentar, merah kalau klien menunggu balasan).
   3. TUMPUKAN — tab tiap lembar di bawah lembar besar: muka kecil, nomor,
      keadaan, dan titik merah "perlu dibalas". Diklik = lembarnya DITARIK ke
      atas tumpukan.
   4. SAYAP KIRI — KARTU NAMA di celah sayap (tautan portal: salin, buka
      seperti klien, buat ulang) dan KANTONG berindeks: Asistensi (utas
      lembar yang terbuka), Kerangka acuan (brief, disimpan hanya kolom yang
      berubah), Kabar (linimasa portal), Kirim (unggah banyak + rekam suara).

   Isi kantong tetap terpasang selagi tersembunyi — brief yang setengah
   diketik atau rekaman yang belum dikirim tidak hilang karena staf melirik
   isi kantong lain.

   Gerak, hanya karena perbuatan (jebakan #74), seketika bila gerak
   dikurangi: lembar yang dipilih DITARIK dari tabnya ke atas tumpukan sambil
   lembar lama turun kembali ke tumpukan; status diganti = stempel MENGHANTAM
   dan kotak status tercentang; fase diganti = cincin MELUNCUR; lembar baru
   DISELIPKAN ke map dari tepi kanan. Disentuh tetikus: tab lembar terangkat,
   dan LUP pembesar mengikuti kursor di atas gambar.
   ============================================================================= */

/* Sama persis dengan allowlist R2 di Worker API. Kalau berbeda, staf bisa
   memilih berkas yang lalu ditolak saat diunggah — dan penolakannya datang
   dari penyimpanan, bukan dari halaman ini. */
const TIPE_SAH = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "audio/mpeg",
  "audio/mp4",
  "audio/webm",
  "audio/ogg",
];
const TIPE_DOKUMEN = TIPE_SAH.join(",");

/* Urutan dan nama sama dengan yang dilihat klien di /progres. */
const FASE: [string, string][] = [
  ["konsultasi", "Konsultasi"],
  ["konsep", "Konsep"],
  ["ded", "DED"],
  ["perizinan", "Perizinan"],
  ["konstruksi", "Konstruksi"],
  ["selesai", "Selesai"],
];

/* Cap status. Warna mengikuti aturan situs: amber = menunggu pihak lain,
   merah = perlu tindakan, hijau = beres, abu = draf. */
const STATUS: { nilai: string; label: string; cap: string; meter: string }[] = [
  { nilai: "draft", label: "Draf", cap: "Draf", meter: "draf" },
  { nilai: "menunggu_klien", label: "Menunggu klien", cap: "Menunggu", meter: "menunggu" },
  { nilai: "revisi_diminta", label: "Revisi diminta", cap: "Revisi", meter: "revisi" },
  { nilai: "disetujui", label: "Disetujui", cap: "Disetujui", meter: "disetujui" },
  { nilai: "final", label: "Final", cap: "Final", meter: "final" },
];
const CAP = Object.fromEntries(STATUS.map((s) => [s.nilai, s])) as Record<string, (typeof STATUS)[number]>;
const capDari = (status: string) => CAP[status] ?? { nilai: status, label: status, cap: status, meter: status };
/* Ringkasan tumpukan: yang perlu tindakan lebih dulu. */
const URUT_METER = ["revisi_diminta", "menunggu_klien", "draft", "disetujui", "final"];

type Kantong = "asistensi" | "acuan" | "kabar" | "kirim";
const KANTONG: { k: Kantong; label: string }[] = [
  { k: "asistensi", label: "Asistensi" },
  { k: "acuan", label: "Kerangka acuan" },
  { k: "kabar", label: "Kabar" },
  { k: "kirim", label: "Kirim" },
];

const BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const HARI = 86_400_000;
const LEMBUT = "cubic-bezier(0.22, 0.7, 0.2, 1)";
const keTanggal = (iso: string) => new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
const tanggal = (iso: string) => {
  const d = keTanggal(iso);
  return `${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}`;
};
const tanggalPendek = (iso: string) => {
  const d = keTanggal(iso);
  return `${d.getDate()} ${BULAN[d.getMonth()]}`;
};
const tanggalTahun = (iso: string) => {
  const d = keTanggal(iso);
  return `${d.getDate()} ${BULAN[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`;
};
/** Tanggal di stempel: "14.10.26", seperti cap tanggal karet. */
const tanggalCap = (iso: string) => {
  const d = keTanggal(iso);
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getFullYear()).slice(2)}`;
};
const tanggalJam = (iso: string) =>
  new Date(iso).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
/** Hari kalender sejak `iso` (0 = hari ini). */
function hariSejak(iso: string): number {
  const a = keTanggal(iso);
  const b = new Date();
  a.setHours(0, 0, 0, 0);
  b.setHours(0, 0, 0, 0);
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / HARI));
}

function ukuranBerkas(b: number): string {
  if (b >= 1_048_576) return `${(b / 1_048_576).toFixed(1).replace(".", ",")} MB`;
  return `${Math.max(1, Math.round(b / 1024))} KB`;
}

/** "DED Rev.2.pdf" → "DED Rev.2". Mengetik judul sepuluh kali untuk sepuluh
 *  berkas bukan alur yang masuk akal. */
function judulDariNama(nama: string): string {
  const titik = nama.lastIndexOf(".");
  const dasar = titik > 0 ? nama.slice(0, titik) : nama;
  return dasar.trim().slice(0, 120) || nama;
}

const jenisBerkas = (d: DokumenProyek) =>
  d.kind === "suara" ? "suara" : d.mimeType?.startsWith("image/") ? "gambar" : d.mimeType === "application/pdf" ? "pdf" : "berkas";

/** Lembar yang paling perlu dilihat: revisi yang diminta klien, lalu yang
    menunggu klien, lalu yang terbaru. */
function lembarBawaan(d: DokumenProyek[]): DokumenProyek | null {
  const terbaru = (l: DokumenProyek[]) => l.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  return (
    terbaru(d.filter((x) => x.status === "revisi_diminta")) ??
    terbaru(d.filter((x) => x.status === "menunggu_klien")) ??
    terbaru(d) ??
    null
  );
}

/** Umur keadaan lembar. Status berganti = `updatedAt` bergeser, jadi
 *  "menunggu 4 hr" dihitung dari saat cap itu dibubuhkan. */
function umurLembar(d: DokumenProyek): { teks: string; nada: string } {
  const n = hariSejak(d.updatedAt);
  const lama = n === 0 ? "hari ini" : `${n} hr`;
  switch (d.status) {
    case "menunggu_klien":
      return { teks: `menunggu ${lama}`, nada: "amber" };
    case "revisi_diminta":
      return { teks: `revisi ${lama}`, nada: "merah" };
    case "disetujui":
      return { teks: `disetujui ${tanggalPendek(d.updatedAt)}`, nada: "hijau" };
    case "final":
      return { teks: `final ${tanggalPendek(d.updatedAt)}`, nada: "hijau" };
    default:
      return { teks: `dibuat ${tanggalPendek(d.createdAt)}`, nada: "" };
  }
}

const perluDibalas = (k: KomentarDokumen[] | undefined) => Boolean(k?.length && k[k.length - 1]!.author === "klien");

/* Gelombang tetap untuk muka pesan suara — tinggi batang diturunkan dari
   id dokumennya, jadi tiap rekaman punya bentuk sendiri tapi tidak berubah
   antar-render. */
function gelombang(id: string, n = 18): number[] {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return Array.from({ length: n }, (_, i) => {
    h = (h * 1103515245 + 12345) >>> 0;
    return 0.28 + ((h >>> 8) % 1000) / 1000 * 0.72 * (0.6 + 0.4 * Math.sin((i / n) * Math.PI));
  });
}

/** Awan revisi: busur-busur yang menggembung KELUAR di sekeliling persegi,
 *  seperti tanda revisi di gambar kerja. Inset 5 = gembung terbesar busur
 *  (r = 1,15 × setengah langkah), jadi garisnya tidak pernah keluar kotak. */
function jalurAwan(w: number, h: number): string {
  const m = 5;
  const langkah = 16;
  const lw = w - 2 * m;
  const lh = h - 2 * m;
  if (lw < langkah || lh < langkah) return "";
  const busur = (dx: number, dy: number, n: number) => {
    const px = dx / n;
    const py = dy / n;
    const r = ((Math.hypot(px, py) / 2) * 1.15).toFixed(2);
    const seg = `a${r} ${r} 0 0 1 ${px.toFixed(2)} ${py.toFixed(2)}`;
    return seg.repeat(n);
  };
  const nx = Math.max(2, Math.round(lw / langkah));
  const ny = Math.max(2, Math.round(lh / langkah));
  return `M${m} ${m}${busur(lw, 0, nx)}${busur(0, lh, ny)}${busur(-lw, 0, nx)}${busur(0, -lh, ny)}Z`;
}

/** Awan revisi selebar kotaknya sendiri — diukur ResizeObserver (bukan saat
 *  menggulir), karena busurnya harus berjarak tetap, bukan direntangkan. */
function AwanRevisi() {
  const ref = useRef<HTMLSpanElement>(null);
  const [uk, setUk] = useState<[number, number] | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      const w = Math.round(e!.contentRect.width);
      const h = Math.round(e!.contentRect.height);
      setUk((l) => (l && l[0] === w && l[1] === h ? l : [w, h]));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <span ref={ref} className="mpk__awan" aria-hidden="true">
      {uk && (
        <svg viewBox={`0 0 ${uk[0]} ${uk[1]}`} width={uk[0]} height={uk[1]}>
          <path d={jalurAwan(uk[0], uk[1])} />
        </svg>
      )}
    </span>
  );
}

function Isi() {
  const { semua, asli, galat, id, pilih } = usePilihProyek();

  if (galat) return <GagalMuat apa="Proyek" galat={galat} />;
  if (!semua) return <Rangka />;
  if (!asli) {
    return (
      <div className="mpk">
        <p className="mpk__tanpa">
          {id ? "Proyek ini tidak ditemukan — mungkin sudah dihapus." : "Belum ada proyek."}{" "}
          <a href="/admin/proyek">Buka Semua Proyek</a>
        </p>
      </div>
    );
  }
  /* `key`: berpindah proyek memasang ulang seluruh map, jadi tidak ada sisa
     brief, lembar, atau kabar proyek sebelumnya yang sempat tergambar di
     bawah judul proyek yang baru. */
  return <Map key={asli.id} proyek={asli} semua={semua} onPilih={pilih} />;
}

function Map({ proyek, semua, onPilih }: { proyek: Proyek; semua: Proyek[]; onPilih: (id: string) => void }) {
  const toast = useToast();
  const [brief, setBrief] = useState<BriefProyek | null>(() => bacaCache<BriefProyek>(`brief:${proyek.id}`));
  const [dokumen, setDokumen] = useState<DokumenProyek[] | null>(() =>
    bacaCache<DokumenProyek[]>(`dokumen:${proyek.id}`),
  );
  const [progres, setProgres] = useState<ProjectProgress | null>(() =>
    bacaCache<ProjectProgress>(`progres:${proyek.id}`),
  );
  /* Nama studio untuk Perencana — dibaca saja; kunci `settings` milik Info
     Studio (jebakan #8). */
  const [setelan, setSetelan] = useState<StudioSettings | null>(() => bacaCache<StudioSettings>("settings"));
  /* Utas per lembar: jumlah komentar dan "perlu dibalas" di tab tiap lembar,
     sekaligus isi kantong Asistensi. */
  const [utas, setUtas] = useState<Record<string, KomentarDokumen[]>>({});
  const [briefBerubah, setBriefBerubah] = useState(0);
  const [pilihanDok, setPilihanDok] = useState<string | null>(null);
  const [kantong, setKantong] = useState<Kantong | null>(null);
  /* Lembar yang statusnya baru berganti (stempelnya menghantam sekali). */
  const [tercap, setTercap] = useState<string | null>(null);
  /* Transisi ringkasan dan lintasan tahap baru menyala sesudah perbuatan
     pertama — tidak saat data segar menggantikan cache (jebakan #74). */
  const [bertindak, setBertindak] = useState(false);
  const [faseTiba, setFaseTiba] = useState<string | null>(null);
  const [antre, setAntre] = useState<{ selesai: number; total: number } | null>(null);
  const [judulKirim, setJudulKirim] = useState("");
  const [seret, setSeret] = useState(false);
  const gerakRef = useRef<{ jenis: "tarik"; dari: DOMRect | null; lama: HTMLElement | null } | { jenis: "selip" } | null>(null);
  const alasRef = useRef<HTMLDivElement>(null);
  const lapisRef = useRef<HTMLDivElement>(null);
  const sayapRef = useRef<HTMLElement>(null);
  const waktu = useRef<number[]>([]);
  useEffect(() => () => waktu.current.forEach((t) => clearTimeout(t)), []);
  const nanti = (f: () => void, ms: number) => waktu.current.push(window.setTimeout(f, ms));

  useEffect(() => {
    ambilBrief(proyek.id)
      .then((d) => {
        tulisCache(`brief:${proyek.id}`, d);
        setBrief(d);
      })
      .catch(() => setBrief((l) => l ?? {}));
    void muatDokumen();
    ambilProgress(proyek.id)
      .then((d) => {
        tulisCache(`progres:${proyek.id}`, d);
        setProgres(d);
      })
      .catch((e) => toast({ judul: "Gagal memuat progres", keterangan: (e as Error).message, nada: "gagal" }));
    ambilSettings()
      .then(setSetelan)
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proyek.id]);

  async function muatDokumen(): Promise<DokumenProyek[] | null> {
    try {
      const d = await daftarDokumen(proyek.id);
      tulisCache(`dokumen:${proyek.id}`, d);
      setDokumen(d);
      return d;
    } catch {
      setDokumen((l) => l ?? []);
      return null;
    }
  }

  async function muatUtas(documentId: string): Promise<void> {
    try {
      const k = await daftarKomentarDokumen(documentId);
      setUtas((u) => ({ ...u, [documentId]: k }));
    } catch {
      setUtas((u) => (u[documentId] ? u : { ...u, [documentId]: [] }));
    }
  }
  /* Satu permintaan per lembar, serentak — map proyek berisi belasan lembar
     paling banyak. */
  const idDokumen = (dokumen ?? []).map((d) => d.id).join(",");
  useEffect(() => {
    for (const d of dokumen ?? []) void muatUtas(d.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idDokumen]);

  /* Lembar di atas tumpukan dihitung, bukan disimpan, sampai staf memilih
     sendiri: yang paling perlu dilihat. */
  const daftar = dokumen ?? [];
  const bawaan = lembarBawaan(daftar);
  const dokKini = (pilihanDok ? daftar.find((d) => d.id === pilihanDok) : null) ?? bawaan;
  const kantongKini: Kantong = kantong ?? (dokumen && daftar.length === 0 ? "acuan" : "asistensi");

  /** Menarik lembar ke atas tumpukan. `dari`: tab yang diklik — lembar besar
   *  tumbuh dari kotak tab itu. Lembar lama disalin dan turun ke tumpukan. */
  function tarik(id: string, dari?: Element | null) {
    if (id === dokKini?.id) return;
    const sempit = matchMedia("(max-width: 1288px)").matches;
    if (geraknya()) {
      const lama = alasRef.current?.querySelector<HTMLElement>(":scope > .mpk__gambar") ?? null;
      gerakRef.current = { jenis: "tarik", dari: !sempit && dari ? dari.getBoundingClientRect() : null, lama };
      if (lama && lapisRef.current) {
        /* Salinan lembar lama di lapisan tetap — React tidak pernah
           merendernya, jadi tidak ada id ganda maupun state yang ikut. */
        const r = lama.getBoundingClientRect();
        const salin = lama.cloneNode(true) as HTMLElement;
        salin.querySelectorAll("[id]").forEach((x) => x.removeAttribute("id"));
        salin.removeAttribute("id");
        salin.setAttribute("inert", "");
        salin.classList.add("is-salinan");
        salin.style.cssText = `position:fixed;left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px;margin:0`;
        lapisRef.current.appendChild(salin);
        const a = salin.animate(
          [
            { transform: "none", opacity: 1 },
            { transform: "translateY(46px) scale(0.94)", opacity: 0 },
          ],
          { duration: 460, easing: "cubic-bezier(0.4, 0, 0.7, 0.4)", fill: "forwards" },
        );
        const buang = () => salin.remove();
        a.onfinish = buang;
        a.oncancel = buang;
      }
    }
    setPilihanDok(id);
    /* Di layar sempit lembar besar ada di atas tumpukan tab: bawa ke sana. */
    if (sempit)
      requestAnimationFrame(() => alasRef.current?.scrollIntoView({ block: "start", behavior: geraknya() ? "smooth" : "auto" }));
  }

  /* Lembar yang baru ditarik tumbuh dari tabnya, terangkat sedikit di tengah
     jalan, lalu rebah di atas tumpukan. Lembar yang baru diselipkan (unggahan)
     masuk dari tepi kanan map. */
  const kunciLembar = dokKini?.id ?? "";
  useLayoutEffect(() => {
    const g = gerakRef.current;
    gerakRef.current = null;
    if (!g) return;
    const el = alasRef.current?.querySelector<HTMLElement>(":scope > .mpk__gambar");
    if (!el) return;
    if (g.jenis === "selip") {
      el.animate(
        [
          { transform: "translateX(70px) rotate(1.2deg)", opacity: 0 },
          { transform: "none", opacity: 1 },
        ],
        { duration: 560, easing: LEMBUT },
      );
      return;
    }
    const ke = el.getBoundingClientRect();
    if (g.dari && ke.width > 1 && ke.height > 1) {
      const sx = g.dari.width / ke.width;
      const sy = g.dari.height / ke.height;
      const dx = g.dari.left - ke.left;
      const dy = g.dari.top - ke.top;
      el.animate(
        [
          { transformOrigin: "0 0", transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`, opacity: 1 },
          {
            transformOrigin: "0 0",
            transform: `translate(${dx * 0.3}px, ${dy * 0.3 - 24}px) scale(${0.3 * sx + 0.7}, ${0.3 * sy + 0.7}) rotate(-0.6deg)`,
            opacity: 1,
            offset: 0.6,
          },
          { transformOrigin: "0 0", transform: "none", opacity: 1 },
        ],
        { duration: 600, easing: "cubic-bezier(0.3, 0.7, 0.2, 1)" },
      );
      return;
    }
    el.animate([{ transform: "translateY(30px) scale(0.97)", opacity: 0.3 }, { transform: "none", opacity: 1 }], {
      duration: 420,
      easing: LEMBUT,
    });
  }, [kunciLembar]);

  function bukaKantong(k: Kantong) {
    setKantong(k);
    /* Di layar sempit sayap ada di bawah lembar: bawa ke sana. */
    if (matchMedia("(max-width: 1288px)").matches)
      requestAnimationFrame(() => sayapRef.current?.scrollIntoView({ block: "start", behavior: geraknya() ? "smooth" : "auto" }));
  }

  /* ---- Tautan portal ---- */
  const tautan = progres ? `${import.meta.env.PUBLIC_SITE_URL || location.origin}/progres?t=${progres.accessToken}` : "";
  async function salin() {
    try {
      await navigator.clipboard.writeText(tautan);
      toast({ judul: "Tautan disalin", keterangan: "Tempel ke WhatsApp atau email klien.", nada: "sukses" });
    } catch {
      toast({ judul: "Tidak bisa menyalin otomatis", keterangan: tautan, nada: "netral" });
    }
  }
  async function buatUlang() {
    if (!progres) return;
    try {
      const { accessToken } = await buatUlangTokenProgress(proyek.id);
      setProgres({ ...progres, accessToken });
      toast({ judul: "Tautan baru dibuat", keterangan: "Tautan lama sudah tidak berlaku.", nada: "sukses" });
    } catch (e) {
      toast({ judul: "Gagal membuat tautan baru", keterangan: (e as Error).message, nada: "gagal" });
    }
  }

  /* ---- Tahap ---- */
  const faseKe = progres ? Math.max(0, FASE.findIndex(([v]) => v === progres.phase)) : -1;
  async function ubahFase(fase: string) {
    if (!progres || fase === progres.phase) return;
    const sebelum = progres.phase;
    setBertindak(true);
    setFaseTiba(fase);
    nanti(() => setFaseTiba(null), 1000);
    setProgres({ ...progres, phase: fase });
    try {
      await ubahFaseProgress(proyek.id, fase);
    } catch (e) {
      setProgres((p) => (p ? { ...p, phase: sebelum } : p));
      toast({ judul: "Gagal mengubah fase", keterangan: (e as Error).message, nada: "gagal" });
    }
  }
  function tombolTahap(e: KeyboardEvent<HTMLElement>) {
    if (faseKe < 0) return;
    let j = faseKe;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") j = Math.min(FASE.length - 1, faseKe + 1);
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") j = Math.max(0, faseKe - 1);
    else if (e.key === "Home") j = 0;
    else if (e.key === "End") j = FASE.length - 1;
    else return;
    e.preventDefault();
    if (j === faseKe) return;
    void ubahFase(FASE[j]![0]);
    requestAnimationFrame(() => document.querySelector<HTMLElement>(`.mpk__tahap [data-fase="${FASE[j]![0]}"]`)?.focus());
  }

  async function gantiProyek(baruId: string) {
    if (baruId === proyek.id) return;
    if (
      briefBerubah > 0 &&
      !(await tanya({ judul: "Pindah proyek?", isi: `Ada ${briefBerubah} perubahan kerangka acuan yang belum disimpan.`, ya: "Tinggalkan", bahaya: true }))
    )
      return;
    onPilih(baruId);
  }

  /* ---- Dokumen: unggah, rekam, status, hapus ---- */
  const mengunggah = antre !== null;

  /** Satu berkas: minta URL → PUT langsung ke penyimpanan → catat barisnya. */
  async function unggahSatu(f: File, j: string) {
    const target = await mintaUrlUnggah(proyek.slug, f.type);
    const res = await fetch(target.uploadUrl, { method: "PUT", headers: { "Content-Type": f.type }, body: f });
    if (!res.ok) throw new Error(`Penyimpanan menolak berkas (${res.status})`);
    await tambahDokumen(proyek.id, {
      title: j,
      fileKey: target.key,
      kind: "berkas",
      fileName: f.name,
      fileSize: f.size,
      mimeType: f.type,
    });
  }

  async function sesudahUnggah(sebelum: Set<string>) {
    const d = await muatDokumen();
    const masuk = (d ?? []).filter((x) => !sebelum.has(x.id)).map((x) => x.id);
    if (masuk.length) {
      setBertindak(true);
      if (geraknya()) gerakRef.current = { jenis: "selip" };
      setPilihanDok(masuk[masuk.length - 1]!);
    }
  }

  async function unggahBanyak(berkas: File[]) {
    if (berkas.length === 0 || mengunggah) return;
    /* Yang kebesaran dilewati, bukan membatalkan antrean: kalau sembilan
       dari sepuluh sah, sembilan itu tetap naik. */
    const kebesaran = berkas.filter((f) => f.size > MAKS_BYTE_DOKUMEN);
    const sah = berkas.filter((f) => f.size <= MAKS_BYTE_DOKUMEN && TIPE_SAH.includes(f.type));
    const ditolak = berkas.length - sah.length - kebesaran.length;
    if (kebesaran.length > 0) {
      toast({
        judul:
          kebesaran.length === 1 ? `“${kebesaran[0]!.name}” lebih dari 100 MB` : `${kebesaran.length} berkas lebih dari 100 MB`,
        keterangan: "Dilewati. Batasnya 100 MB per berkas.",
        nada: "gagal",
      });
    }
    if (ditolak > 0) {
      toast({ judul: `${ditolak} berkas dilewati`, keterangan: "Yang diterima: PDF, gambar, dan rekaman suara.", nada: "gagal" });
    }
    if (sah.length === 0) return;

    /* Judul yang diketik hanya dipakai kalau berkasnya satu. */
    const manual = judulKirim.trim();
    const pakaiManual = sah.length === 1 && manual.length >= 2;
    const sebelum = new Set(daftar.map((d) => d.id));
    setAntre({ selesai: 0, total: sah.length });
    let gagal = 0;
    for (let i = 0; i < sah.length; i++) {
      try {
        await unggahSatu(sah[i]!, pakaiManual ? manual : judulDariNama(sah[i]!.name));
      } catch (e) {
        gagal++;
        toast({ judul: `Gagal mengunggah ${sah[i]!.name}`, keterangan: (e as Error).message, nada: "gagal" });
      }
      setAntre({ selesai: i + 1, total: sah.length });
    }
    setAntre(null);
    setJudulKirim("");
    await sesudahUnggah(sebelum);
    const berhasil = sah.length - gagal;
    if (berhasil > 0) {
      toast({
        judul: berhasil === 1 ? "Lembar diselipkan ke map" : `${berhasil} lembar diselipkan ke map`,
        keterangan: "Langsung terlihat di portal klien.",
        nada: "sukses",
      });
    }
  }

  async function kirimSuara(blob: Blob, durasiMs: number, mime: string) {
    const sebelum = new Set(daftar.map((d) => d.id));
    try {
      const target = await mintaUrlUnggah(proyek.slug, mime);
      const res = await fetch(target.uploadUrl, { method: "PUT", headers: { "Content-Type": mime }, body: blob });
      if (!res.ok) throw new Error(`Penyimpanan menolak rekaman (${res.status})`);
      await tambahDokumen(proyek.id, {
        title: `Pesan suara ${formatDurasi(durasiMs)}`,
        fileKey: target.key,
        kind: "suara",
        fileSize: blob.size,
        mimeType: mime,
        durationMs: Math.round(durasiMs),
      });
      await sesudahUnggah(sebelum);
      toast({ judul: "Pesan suara terkirim", nada: "sukses" });
    } catch (e) {
      toast({ judul: "Gagal mengirim pesan suara", keterangan: (e as Error).message, nada: "gagal" });
    }
  }

  async function ubahStatus(d: DokumenProyek, status: string) {
    if (!dokumen || d.status === status) return;
    const sebelum = dokumen;
    /* Tanggal cap ikut bergeser seketika — Worker juga menyetel ulang
       `updated_at` saat status diganti. */
    const kini = new Date().toISOString();
    setBertindak(true);
    /* Lembar yang dicap tetap di atas tumpukan — tanpa ini pilihan bawaan
       ("yang paling perlu dilihat") dihitung ulang dari status barunya dan
       lembar lain yang tiba-tiba naik. */
    setPilihanDok(d.id);
    setDokumen(dokumen.map((x) => (x.id === d.id ? { ...x, status, updatedAt: kini } : x)));
    setTercap(d.id);
    nanti(() => setTercap((t) => (t === d.id ? null : t)), 1000);
    try {
      await ubahDokumen(d.id, { status });
    } catch (e) {
      setDokumen(sebelum);
      toast({ judul: "Gagal mengubah status", keterangan: (e as Error).message, nada: "gagal" });
    }
  }

  async function hapus(d: DokumenProyek) {
    try {
      await hapusDokumen(d.id);
      setBertindak(true);
      const sisa = daftar.filter((x) => x.id !== d.id);
      const i = daftar.findIndex((x) => x.id === d.id);
      const lanjut = sisa[i] ?? sisa[i - 1] ?? null;
      setDokumen(sisa);
      setPilihanDok(lanjut?.id ?? null);
      toast({ judul: "Lembar dikeluarkan dari map", keterangan: d.title, nada: "sukses" });
      /* Tombol hapusnya ikut lenyap bersama lembarnya; fokus pindah ke tab
         lembar yang kini di atas (jebakan #39). */
      requestAnimationFrame(() =>
        document.querySelector<HTMLElement>(".mpk__tab.is-pilih button, .mpk__kosong, .mpk__tabkirim")?.focus(),
      );
    } catch (e) {
      toast({ judul: "Gagal menghapus dokumen", keterangan: (e as Error).message, nada: "gagal" });
    }
  }

  /* Berkas yang dijatuhkan ke lembar langsung naik — kebiasaan yang sama
     dengan zona unggah di kantong Kirim. */
  function jatuh(e: DragEvent<HTMLElement>) {
    if (!e.dataTransfer?.files?.length) return;
    e.preventDefault();
    setSeret(false);
    void unggahBanyak(Array.from(e.dataTransfer.files));
  }

  const kode = kodeProyek(proyek.title);
  const nomor = new globalThis.Map(
    daftar
      .slice()
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map((d, i) => [d.id, `${kode}-${String(i + 1).padStart(2, "0")}`]),
  );

  /* Papan ketik di deret tab: panah memindah lembar di atas tumpukan. */
  function tombolTumpuk(e: KeyboardEvent<HTMLElement>) {
    if (!dokKini) return;
    const i = daftar.findIndex((d) => d.id === dokKini.id);
    let j = i;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") j = Math.min(daftar.length - 1, i + 1);
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") j = Math.max(0, i - 1);
    else if (e.key === "Home") j = 0;
    else if (e.key === "End") j = daftar.length - 1;
    else return;
    e.preventDefault();
    if (j === i) return;
    const tujuan = daftar[j]!.id;
    tarik(tujuan, document.querySelector(`[data-lembar="${tujuan}"]`));
    requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-lembar="${tujuan}"] button`)?.focus());
  }

  const hitung = Object.fromEntries(URUT_METER.map((s) => [s, daftar.filter((d) => d.status === s).length])) as Record<
    string,
    number
  >;
  const balas = daftar.filter((d) => perluDibalas(utas[d.id])).length;
  const statusTercap = tercap ? daftar.find((d) => d.id === tercap)?.status ?? null : null;
  const jenis = CATEGORY_LABELS[proyek.category as keyof typeof CATEGORY_LABELS] ?? proyek.category;
  const studio = setelan?.studioName?.trim() || "—";
  const jadwal =
    brief?.startDate || brief?.endDate
      ? `${brief?.startDate ? tanggalTahun(brief.startDate) : "?"} → ${brief?.endDate ? tanggalTahun(brief.endDate) : "?"}`
      : proyek.deadlineFinal
        ? `final ${tanggalTahun(proyek.deadlineFinal)}`
        : brief?.timeline || "—";

  /* Lencana indeks kantong: data sungguhan, bukan hiasan. */
  const kDok = dokKini ? utas[dokKini.id] : undefined;
  const lencana: Record<Kantong, { teks: string; nada?: string } | null> = {
    asistensi: dokKini ? (kDok ? { teks: String(kDok.length), nada: perluDibalas(kDok) ? "merah" : undefined } : null) : null,
    acuan: briefBerubah > 0 ? { teks: "•", nada: "amber" } : brief && !brief.submittedAt ? { teks: "!", nada: "amber" } : null,
    kabar: progres?.updates.length ? { teks: String(progres.updates.length) } : null,
    kirim: antre ? { teks: `${antre.selesai}/${antre.total}`, nada: "amber" } : null,
  };
  const indeks = useRef<(HTMLButtonElement | null)[]>([]);
  function tombolIndeks(e: KeyboardEvent, i: number) {
    const arah = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!arah && e.key !== "Home" && e.key !== "End") return;
    e.preventDefault();
    const j = e.key === "Home" ? 0 : e.key === "End" ? KANTONG.length - 1 : (i + arah + KANTONG.length) % KANTONG.length;
    setKantong(KANTONG[j]!.k);
    indeks.current[j]?.focus();
  }

  return (
    <div className="mpk">
      <div className="mpk__map">
        {/* ---- Kop di tutup map ---------------------------------------- */}
        <header className="mpk__kop">
          <div className="mpk__kopjudul">
            <p>
              Map presentasi · No. <b>{kode}</b>
            </p>
            <PilihMenu
              label="Pilih proyek"
              nilai={proyek.id}
              opsi={semua.map((p) => ({ nilai: p.id, label: p.title }))}
              onUbah={(v) => void gantiProyek(v)}
              pemicu={
                <button type="button" className="mpk__proyek">
                  <h2>{proyek.title}</h2>
                  <Ikon ikon={CaretDown} ukuran={16} />
                </button>
              }
            />
            <dl className="mpk__nama">
              <div>
                <dt>Pemilik</dt>
                <dd>{proyek.client || "—"}</dd>
              </div>
              <div>
                <dt>Lokasi</dt>
                <dd>{proyek.city || proyek.location || "—"}</dd>
              </div>
              <div>
                <dt>Jenis</dt>
                <dd>{jenis}</dd>
              </div>
              <div className="is-mengalah">
                <dt>Perencana</dt>
                <dd>{studio}</dd>
              </div>
              <div>
                <dt>Jadwal</dt>
                <dd>{jadwal}</dd>
              </div>
            </dl>
          </div>
          <div className="mpk__tahapkop">
            <p id="mpk-tahap">
              <Ikon ikon={Eye} ukuran={13} />
              Tahap dilihat klien
              <b>{faseKe >= 0 ? `${faseKe + 1}/${FASE.length} · ${FASE[faseKe]![1]}` : "—"}</b>
            </p>
            <div
              className={`mpk__tahap${bertindak ? " is-hidup" : ""}`}
              role="radiogroup"
              aria-labelledby="mpk-tahap"
              onKeyDown={tombolTahap}
              style={{ "--mpk-fase": faseKe > 0 ? faseKe / (FASE.length - 1) : 0 } as CSSProperties}
            >
              <span className="mpk__lintas" aria-hidden="true">
                <i className="mpk__lintasisi" />
                {faseKe >= 0 && <i className="mpk__cincin" />}
              </span>
              {FASE.map(([nilai, label], i) => (
                <button
                  key={nilai}
                  type="button"
                  role="radio"
                  data-fase={nilai}
                  aria-checked={i === faseKe}
                  tabIndex={i === faseKe || (faseKe < 0 && i === 0) ? 0 : -1}
                  disabled={!progres}
                  className={`${i < faseKe ? "is-lewat" : ""}${i === faseKe ? " is-kini" : ""}${faseTiba === nilai ? " is-tiba" : ""}`}
                  onClick={() => void ubahFase(nilai)}
                >
                  <i aria-hidden="true">{i + 1}</i>
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>
        </header>

        {/* ---- Sayap kiri: kartu nama + kantong berindeks ----------------- */}
        <aside className="mpk__sayap" ref={sayapRef} aria-label="Sayap map">
          <div className="mpk__slotkartu">
            <div className="mpk__kartunama">
              <span className="mpk__kartuteks">
                <small>Portal klien · {studio}</small>
                <b title={tautan || undefined}>{tautan ? tautan.replace(/^https?:\/\//, "") : "Memuat tautan…"}</b>
              </span>
              <span className="mpk__kartualat">
                <button type="button" disabled={!tautan} onClick={salin} title="Salin tautan">
                  <Ikon ikon={CopySimple} ukuran={14} />
                  <span>Salin</span>
                </button>
                {tautan ? (
                  <a href={tautan} target="_blank" rel="noreferrer" title="Buka seperti klien">
                    <Ikon ikon={Globe} ukuran={14} />
                    <span>Buka</span>
                  </a>
                ) : (
                  <span className="mpk__kartumati" aria-hidden="true">
                    <Ikon ikon={Globe} ukuran={14} />
                    <span>Buka</span>
                  </span>
                )}
                <AlertDialog
                  destructive
                  title="Buat tautan baru?"
                  description="Tautan lama langsung berhenti bekerja. Pakai kalau tautannya telanjur sampai ke orang yang salah."
                  confirmLabel="Ya, buat baru"
                  onConfirm={buatUlang}
                  trigger={
                    <button type="button" disabled={!progres} title="Buat ulang tautan" aria-label="Buat ulang tautan">
                      <Ikon ikon={ArrowClockwise} ukuran={14} />
                    </button>
                  }
                />
              </span>
            </div>
          </div>

          <div className="mpk__kantong">
            <div className="mpk__indeks" role="tablist" aria-label="Isi kantong">
              {KANTONG.map((t, i) => {
                const aktif = kantongKini === t.k;
                const l = lencana[t.k];
                return (
                  <button
                    key={t.k}
                    ref={(el) => {
                      indeks.current[i] = el;
                    }}
                    type="button"
                    role="tab"
                    id={`mpk-tab-${t.k}`}
                    aria-selected={aktif}
                    aria-controls={`mpk-kantong-${t.k}`}
                    tabIndex={aktif ? 0 : -1}
                    className={`mpk__indekstab${aktif ? " is-aktif" : ""}`}
                    onClick={() => setKantong(t.k)}
                    onKeyDown={(e) => tombolIndeks(e, i)}
                  >
                    {t.label}
                    {l && <em className={l.nada ? `is-${l.nada}` : undefined}>{l.teks}</em>}
                  </button>
                );
              })}
            </div>
            <div className="mpk__lembarkantong">
              <div id="mpk-kantong-asistensi" role="tabpanel" aria-labelledby="mpk-tab-asistensi" className="mpk__panel" hidden={kantongKini !== "asistensi"}>
                {dokKini ? (
                  <Asistensi
                    key={dokKini.id}
                    d={dokKini}
                    nomor={nomor.get(dokKini.id) ?? ""}
                    komentar={utas[dokKini.id]}
                    onMuat={() => muatUtas(dokKini.id)}
                  />
                ) : (
                  <p className="mpk__kosongteks">{dokumen === null ? "Memuat lembar…" : "Belum ada lembar di map — asistensi dengan klien muncul di sini per lembar."}</p>
                )}
              </div>
              <div id="mpk-kantong-acuan" role="tabpanel" aria-labelledby="mpk-tab-acuan" className="mpk__panel" hidden={kantongKini !== "acuan"}>
                {brief ? (
                  <KerangkaAcuan projectId={proyek.id} brief={brief} onTersimpan={setBrief} onBerubah={setBriefBerubah} />
                ) : (
                  <RangkaBaris jumlah={4} label="Memuat kerangka acuan…" />
                )}
              </div>
              <div id="mpk-kantong-kabar" role="tabpanel" aria-labelledby="mpk-tab-kabar" className="mpk__panel" hidden={kantongKini !== "kabar"}>
                <Kabar projectId={proyek.id} progres={progres} setProgres={setProgres} />
              </div>
              <div id="mpk-kantong-kirim" role="tabpanel" aria-labelledby="mpk-tab-kirim" className="mpk__panel mpk__kirim" hidden={kantongKini !== "kirim"}>
                <header className="mpk__pkop">
                  <p className="mpk__plabel">Lembar berikutnya · {kode}-{String(daftar.length + 1).padStart(2, "0")}</p>
                  <h3 className="mpk__pjudul">Selipkan lembar ke map</h3>
                </header>
                <Isian
                  label="Judul lembar (opsional)"
                  placeholder="mis. DED Rev.2"
                  value={judulKirim}
                  disabled={mengunggah}
                  onChange={(e) => setJudulKirim(e.currentTarget.value)}
                />
                {/* Lampiran kit sebagai zona unggah langsung: berkas yang
                    dijatuhkan langsung diunggah, jadi daftar pilihannya selalu
                    kosong. */}
                <Lampiran
                  banyak
                  berkas={[]}
                  onUbah={(f) => void unggahBanyak(f)}
                  terima={TIPE_DOKUMEN}
                  mati={mengunggah}
                  label="Pilih dokumen untuk diunggah"
                  judul={antre ? `Mengunggah ${antre.selesai}/${antre.total}…` : "Tarik berkas ke sini, atau klik untuk memilih"}
                  ket="PDF, JPG, PNG, WebP, atau rekaman — maks 100 MB per berkas, boleh beberapa sekaligus."
                />
                <PerekamSuaraKit onKirim={kirimSuara} disabled={mengunggah} />
                <p className="mpk__catatkirim">Lembar yang diselipkan langsung terlihat klien di portalnya.</p>
              </div>
            </div>
          </div>
        </aside>

        <span className="mpk__punggung" aria-hidden="true" />

        {/* ---- Lembar gambar + tumpukan --------------------------------- */}
        <section
          className={`mpk__isimap${seret ? " is-seret" : ""}`}
          aria-label="Lembar di map"
          onDragOver={(e) => {
            if (e.dataTransfer?.types?.includes("Files")) {
              e.preventDefault();
              setSeret(true);
            }
          }}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setSeret(false);
          }}
          onDrop={jatuh}
        >
          <div className="mpk__alas" ref={alasRef}>
            {dokumen === null ? (
              <div className="mpk__gambar is-rangka">
                <RangkaBaris jumlah={3} label="Memuat lembar…" />
              </div>
            ) : dokKini ? (
              <LembarGambar
                key={dokKini.id}
                d={dokKini}
                nomor={nomor.get(dokKini.id) ?? ""}
                proyek={proyek}
                studio={studio}
                semuaGambar={daftar.filter((x) => jenisBerkas(x) === "gambar")}
                tercap={tercap === dokKini.id}
                komentar={utas[dokKini.id]}
                onStatus={(s) => void ubahStatus(dokKini, s)}
                onHapus={() => hapus(dokKini)}
                onAsistensi={() => bukaKantong("asistensi")}
              />
            ) : (
              <button type="button" className="mpk__gambar mpk__kosong" onClick={() => bukaKantong("kirim")}>
                <Ikon ikon={Plus} ukuran={26} />
                <b>Map masih kosong</b>
                <small>Selipkan gambar, PDF, atau pesan suara untuk klien — atau jatuhkan berkasnya ke sini.</small>
              </button>
            )}
          </div>

          <div className="mpk__tumpukkop">
            <p>
              Isi map ·{" "}
              <Hitung nilai={daftar.length} hidup={bertindak} format={(v) => String(Math.round(v))} /> lembar
            </p>
            {daftar.length > 0 && (
              <ul className="mpk__meter" aria-label="Lembar per tanggapan klien">
                {URUT_METER.filter((s) => hitung[s]! > 0).map((s) => (
                  <li key={s} className={`is-${s}${statusTercap === s ? " is-naik" : ""}`}>
                    <i aria-hidden="true" />
                    <Hitung nilai={hitung[s]!} hidup={bertindak} format={(v) => String(Math.round(v))} /> {capDari(s).meter}
                  </li>
                ))}
              </ul>
            )}
            {balas > 0 && (
              <em className="mpk__perlubalas">
                <Ikon ikon={ChatTeardropDots} ukuran={12} />
                {balas} perlu dibalas
              </em>
            )}
            {antre && (
              <span className="mpk__antre" role="status">
                Menyelipkan {antre.selesai}/{antre.total}…
              </span>
            )}
          </div>
          <ol className="mpk__tumpuk" onKeyDown={tombolTumpuk} aria-label="Lembar di map — urutan sama dengan yang dilihat klien">
            {daftar.map((d) => {
              const j = jenisBerkas(d);
              const pilih = d.id === dokKini?.id;
              const k = utas[d.id];
              const minta = perluDibalas(k);
              const umur = umurLembar(d);
              return (
                <li key={d.id} data-lembar={d.id} className={`mpk__tab is-${d.status}${pilih ? " is-pilih" : ""}`}>
                  <button
                    type="button"
                    aria-pressed={pilih}
                    tabIndex={pilih ? 0 : -1}
                    title={d.title}
                    aria-label={`${nomor.get(d.id)} ${d.title}, ${capDari(d.status).label}, ${umur.teks}${k ? `, ${k.length} komentar${minta ? ", perlu dibalas" : ""}` : ""}`}
                    onClick={(e) => tarik(d.id, e.currentTarget)}
                  >
                    <span className={`mpk__tabmuka is-${j}`} aria-hidden="true">
                      {j === "gambar" ? (
                        <img src={d.fileUrl} alt="" loading="lazy" />
                      ) : j === "suara" ? (
                        <span className="mpk__tabgel">
                          {gelombang(d.id, 7).map((t, i) => (
                            <i key={i} style={{ height: `${Math.round(t * 100)}%` }} />
                          ))}
                        </span>
                      ) : (
                        <b>{j === "pdf" ? "PDF" : "Berkas"}</b>
                      )}
                    </span>
                    <span className="mpk__tabteks">
                      <b>{nomor.get(d.id)}</b>
                      <small className={umur.nada ? `is-${umur.nada}` : undefined}>{umur.teks}</small>
                    </span>
                    {minta && <i className="mpk__tabbalas" aria-hidden="true" />}
                  </button>
                </li>
              );
            })}
            <li className="mpk__tab is-kirim">
              <button type="button" className="mpk__tabkirim" onClick={() => bukaKantong("kirim")}>
                <Ikon ikon={Plus} ukuran={15} />
                <span>Selipkan</span>
              </button>
            </li>
          </ol>
        </section>
        <div className="mpk__lapis" ref={lapisRef} aria-hidden="true" />
      </div>
    </div>
  );
}

/* --- Lembar gambar besar: bidang gambar + kop gambar ------------------------------- */

function LembarGambar({
  d,
  nomor,
  proyek,
  studio,
  semuaGambar,
  tercap,
  komentar,
  onStatus,
  onHapus,
  onAsistensi,
}: {
  d: DokumenProyek;
  nomor: string;
  proyek: Proyek;
  studio: string;
  semuaGambar: DokumenProyek[];
  tercap: boolean;
  komentar: KomentarDokumen[] | undefined;
  onStatus: (s: string) => void;
  onHapus: () => void;
  onAsistensi: () => void;
}) {
  const j = jenisBerkas(d);
  const i = STATUS.findIndex((s) => s.nilai === d.status);
  const lupRef = useRef<HTMLSpanElement>(null);
  const kotakLup = useRef<{ x: number; y: number; w: number; h: number; ox: number; oy: number } | null>(null);
  const minta = perluDibalas(komentar);

  function tombolStatus(e: KeyboardEvent<HTMLElement>) {
    let k = i;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") k = Math.min(STATUS.length - 1, i + 1);
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") k = Math.max(0, i - 1);
    else if (e.key === "Home") k = 0;
    else if (e.key === "End") k = STATUS.length - 1;
    else return;
    e.preventDefault();
    if (k === i) return;
    onStatus(STATUS[k]!.nilai);
    requestAnimationFrame(() => document.querySelector<HTMLElement>(`.mpk__status [data-status="${STATUS[k]!.nilai}"]`)?.focus());
  }

  /* LUP: lingkaran pembesar 2,6× yang mengikuti tetikus di atas gambar.
     Kotak gambar yang benar-benar tergambar (object-fit: contain) dibaca
     sekali saat kursor masuk (jebakan #21); tiap gerak cuma menulis gaya. */
  function masukLup(e: PointerEventReact<HTMLButtonElement>) {
    if (e.pointerType !== "mouse") return;
    const img = e.currentTarget.querySelector("img");
    const wadah = e.currentTarget.parentElement;
    if (!img || !wadah) return;
    const r = img.getBoundingClientRect();
    const s = img.naturalWidth && img.naturalHeight ? Math.min(r.width / img.naturalWidth, r.height / img.naturalHeight) : 0;
    const w = s ? img.naturalWidth * s : r.width;
    const h = s ? img.naturalHeight * s : r.height;
    const o = wadah.getBoundingClientRect();
    kotakLup.current = { x: r.left + (r.width - w) / 2, y: r.top + (r.height - h) / 2, w, h, ox: o.left, oy: o.top };
  }
  function geserLup(e: PointerEventReact<HTMLButtonElement>) {
    const k = kotakLup.current;
    const lup = lupRef.current;
    if (!k || !lup || e.pointerType !== "mouse") return;
    const px = e.clientX - k.x;
    const py = e.clientY - k.y;
    if (px < 0 || py < 0 || px > k.w || py > k.h) {
      lup.classList.remove("is-nyala");
      return;
    }
    const Z = 2.6;
    const R = lup.offsetWidth / 2 || 64;
    lup.style.backgroundImage = `url("${d.fileUrl}")`;
    lup.style.backgroundSize = `${k.w * Z}px ${k.h * Z}px`;
    lup.style.backgroundPosition = `${R - px * Z}px ${R - py * Z}px`;
    lup.style.transform = `translate(${e.clientX - k.ox - R}px, ${e.clientY - k.oy - R}px)`;
    lup.classList.add("is-nyala");
  }
  function keluarLup() {
    kotakLup.current = null;
    lupRef.current?.classList.remove("is-nyala");
  }

  const jenisLabel = j === "suara" ? "Pesan suara" : j === "pdf" ? "PDF" : j === "gambar" ? "Gambar" : "Berkas";
  const ukuran =
    j === "suara" && d.durationMs ? formatDurasi(d.durationMs) : typeof d.fileSize === "number" ? ukuranBerkas(d.fileSize) : "—";
  const umur = umurLembar(d);

  return (
    <article className={`mpk__gambar is-${d.status}`} aria-labelledby="mpk-judulgambar">
      <div className={`mpk__bidang is-${j}${tercap ? " is-hentak" : ""}`}>
        {j === "gambar" ? (
          <button
            type="button"
            className="mpk__perbesar"
            aria-label={`Perbesar ${d.title}`}
            onPointerEnter={masukLup}
            onPointerMove={geserLup}
            onPointerLeave={keluarLup}
            onClick={() =>
              bukaLightbox(
                semuaGambar.map((g) => ({ url: g.fileUrl, caption: g.title })),
                Math.max(0, semuaGambar.findIndex((g) => g.id === d.id)),
              )
            }
          >
            <img src={d.fileUrl} alt="" />
          </button>
        ) : j === "suara" ? (
          <div className="mpk__suara">
            <span className="mpk__gel" aria-hidden="true">
              {gelombang(d.id, 34).map((t, k) => (
                <i key={k} style={{ height: `${Math.round(t * 100)}%` }} />
              ))}
            </span>
            <span className="mpk__putar">
              <Icon name="mic" size={20} />
              <PemutarSuaraKit url={d.fileUrl} durationMs={d.durationMs} label={d.title} className="mpk__pemutar" />
            </span>
          </div>
        ) : (
          <a className="mpk__bukaberkas" href={d.fileUrl} target="_blank" rel="noreferrer">
            <span className="mpk__pdfmuka" aria-hidden="true">
              <Ikon ikon={j === "pdf" ? FilePdf : FileText} ukuran={34} />
            </span>
            <b>{d.fileName || d.title}</b>
            <span>
              Buka {j === "pdf" ? "PDF" : "berkas"}
              <Ikon ikon={ArrowRight} ukuran={13} />
            </span>
          </a>
        )}
        {d.status === "revisi_diminta" && <AwanRevisi />}
        <span key={`cap-${d.status}`} className={`mpk__stempel is-${d.status}${tercap ? " is-tercap" : ""}`} aria-hidden="true">
          <b>{capDari(d.status).cap}</b>
          <small>
            {nomor} · {tanggalCap(d.updatedAt)}
          </small>
        </span>
        {j === "gambar" && <span className="mpk__lup" ref={lupRef} aria-hidden="true" />}
      </div>

      {/* Kop gambar di tepi kanan, seperti gambar kerja sungguhan. */}
      <aside className="mpk__kopgambar" aria-label="Kop gambar">
        <div className="mpk__kg is-studio">
          <small>Perencana</small>
          <b>{studio}</b>
        </div>
        <div className="mpk__kg">
          <small>Proyek</small>
          <b>{proyek.title}</b>
          <span>
            Pemilik <em>{proyek.client || "—"}</em>
          </span>
        </div>
        <div className="mpk__kg is-judul">
          <small>Judul gambar</small>
          <h3 id="mpk-judulgambar" title={d.title}>
            {d.title}
          </h3>
          <span>
            {jenisLabel} · {ukuran}
          </span>
        </div>
        <div className="mpk__kg is-dua">
          <div>
            <small>No. lembar</small>
            <b className="is-nomor">{nomor}</b>
          </div>
          <div>
            <small>Dikirim</small>
            <b>{tanggalTahun(d.createdAt)}</b>
          </div>
        </div>
        <div className="mpk__kg is-status">
          <small id="mpk-status">Status · tanggapan klien</small>
          <div className="mpk__status" role="radiogroup" aria-labelledby="mpk-status" onKeyDown={tombolStatus}>
            {STATUS.map((s) => {
              const ya = d.status === s.nilai;
              return (
                <button
                  key={s.nilai}
                  type="button"
                  role="radio"
                  data-status={s.nilai}
                  aria-checked={ya}
                  tabIndex={ya || (i < 0 && s.nilai === "draft") ? 0 : -1}
                  aria-label={s.label}
                  className={`mpk__statusbaris is-${s.nilai}${ya ? " is-ya" : ""}${ya && tercap ? " is-tercap" : ""}`}
                  onClick={() => onStatus(s.nilai)}
                >
                  <span className="mpk__kotakcentang" aria-hidden="true">
                    {ya && (
                      <svg viewBox="0 0 16 16" width="12" height="12">
                        <path d="M3.5 8.4l3 3 6-6.6" />
                      </svg>
                    )}
                  </span>
                  {s.cap}
                </button>
              );
            })}
          </div>
          <span className={`mpk__umur${umur.nada ? ` is-${umur.nada}` : ""}`}>{umur.teks}</span>
        </div>
        <button type="button" className={`mpk__kg is-asistensi${minta ? " is-balas" : ""}`} onClick={onAsistensi}>
          <small>Asistensi</small>
          <span>
            <Ikon ikon={ChatTeardropDots} ukuran={13} />
            {komentar === undefined ? "memuat…" : komentar.length === 0 ? "belum ada komentar" : `${komentar.length} komentar${minta ? " · perlu dibalas" : ""}`}
          </span>
        </button>
        <div className="mpk__kgaksi">
          {j !== "suara" && (
            <a href={d.fileUrl} target="_blank" rel="noreferrer">
              Berkas asli
            </a>
          )}
          <AlertDialog
            destructive
            title={`Hapus ${d.title}?`}
            description="Beserta seluruh komentarnya. Klien tidak lagi melihatnya."
            confirmLabel="Ya, hapus"
            onConfirm={onHapus}
            trigger={
              <button type="button" className="mpk__hapus" aria-label={`Hapus ${d.title}`}>
                <Ikon ikon={Trash} ukuran={13} />
                Hapus
              </button>
            }
          />
        </div>
      </aside>
    </article>
  );
}

/* --- Kantong: asistensi satu lembar ----------------------------------------------------- */

function Asistensi({
  d,
  nomor,
  komentar,
  onMuat,
}: {
  d: DokumenProyek;
  nomor: string;
  komentar: KomentarDokumen[] | undefined;
  onMuat: () => Promise<void>;
}) {
  const toast = useToast();
  const [isi, setIsi] = useState("");
  const [mengirim, setMengirim] = useState(false);
  useCegahPindah(isi.trim() !== "");

  async function kirim(e: { preventDefault: () => void }) {
    e.preventDefault();
    const bersih = isi.trim();
    if (!bersih) return;
    setMengirim(true);
    try {
      await tambahKomentarDokumen(d.id, bersih);
      setIsi("");
      await onMuat();
    } catch (err) {
      toast({ judul: "Gagal mengirim balasan", keterangan: (err as Error).message, nada: "gagal" });
    } finally {
      setMengirim(false);
    }
  }

  const terakhir = komentar?.[komentar.length - 1];
  return (
    <section className="mpk__utas" aria-labelledby={`mpk-utas-${d.id}`}>
      <header className="mpk__pkop">
        <p className="mpk__plabel">Asistensi lembar {nomor}</p>
        <div className="mpk__utaskop">
          <h3 id={`mpk-utas-${d.id}`} className="mpk__pjudul" title={d.title}>
            {d.title}
          </h3>
          {terakhir &&
            (terakhir.author === "klien" ? (
              <em className="mpk__utasstatus is-balas">perlu dibalas</em>
            ) : (
              <em className="mpk__utasstatus">dibalas {tanggalPendek(terakhir.createdAt)}</em>
            ))}
        </div>
      </header>
      {d.status === "revisi_diminta" && d.clientNote && (
        <p className="mpk__catatanklien">
          <b>Catatan revisi klien</b>
          {d.clientNote}
        </p>
      )}
      <div className="mpk__utasisi">
        {komentar === undefined ? (
          <RangkaBaris jumlah={2} label="Memuat komentar…" />
        ) : komentar.length === 0 ? (
          <p className="mpk__kosongteks">Belum ada komentar. Balasan di sini terlihat klien di bawah lembarnya.</p>
        ) : (
          /* Menempel di bawah: balasan baru menggeser ke bawah hanya kalau
             staf memang sedang di bawah. */
          <GulirPesan tinggi="100%" jumlah={komentar.length}>
            {komentar.map((k) => (
              <Gelembung key={k.id} sendiri={k.author === "staf"} nama={k.author === "staf" ? "Studio" : "Klien"} waktu={tanggalJam(k.createdAt)}>
                {k.body}
              </Gelembung>
            ))}
          </GulirPesan>
        )}
      </div>
      <form className="mpk__balas" onSubmit={kirim}>
        <span className="k-isian__kotak">
          <input
            className="k-isian__input"
            aria-label="Tulis balasan"
            placeholder="Tulis balasan untuk klien…"
            maxLength={2000}
            value={isi}
            onChange={(e) => setIsi(e.currentTarget.value)}
          />
        </span>
        <Tombol memuat={mengirim} ukuran="medium" jenis="primary" tipeHtml="submit" disabled={!isi.trim() || mengirim}>
          {mengirim ? "Mengirim…" : "Kirim"}
        </Tombol>
      </form>
    </section>
  );
}

/* --- Kantong: kerangka acuan (brief) ---------------------------------------------------- */

type KunciBrief = "budgetAmount" | "stylePreference" | "startDate" | "endDate" | "requirements" | "internalNotes";
const KUNCI_BRIEF: KunciBrief[] = ["budgetAmount", "stylePreference", "startDate", "endDate", "requirements", "internalNotes"];
/* "" dan null sama-sama "kosong" — tanpa ini, mengetik lalu menghapus satu
   huruf terhitung sebagai perubahan. */
const kosongkan = (v: unknown) => (v === "" || v === undefined ? null : v);

function KerangkaAcuan({
  projectId,
  brief,
  onTersimpan,
  onBerubah,
}: {
  projectId: string;
  brief: BriefProyek;
  onTersimpan: (b: BriefProyek) => void;
  onBerubah: (n: number) => void;
}) {
  const toast = useToast();
  const [draf, setDraf] = useState<Partial<Pick<BriefProyek, KunciBrief>>>({});
  const [menyimpan, setMenyimpan] = useState(false);

  const nilai = <K extends KunciBrief>(k: K) => (k in draf ? draf[k] : brief[k]) as BriefProyek[K];
  const berubah = KUNCI_BRIEF.filter((k) => k in draf && kosongkan(draf[k]) !== kosongkan(brief[k]));
  const n = berubah.length;
  useCegahPindah(n > 0);
  useEffect(() => onBerubah(n), [n, onBerubah]);

  const set = <K extends KunciBrief>(k: K, v: BriefProyek[K]) => setDraf((d) => ({ ...d, [k]: v }));
  const mulai = nilai("startDate") ?? "";
  const selesai = nilai("endDate") ?? "";
  /* Dijaga juga di API dan database — ini lapis pertama, supaya penolakan
     datang sebagai kalimat, bukan galat Postgres. */
  const tanggalTerbalik = Boolean(mulai && selesai && selesai < mulai);

  async function simpan() {
    if (n === 0 || tanggalTerbalik) return;
    setMenyimpan(true);
    try {
      /* Hanya yang berubah — brief juga diisi KLIEN dari portalnya, dan
         mengirim ulang semua kolom akan menimpa isian klien yang masuk
         selagi staf mengetik. */
      const patch: Partial<BriefProyek> = {};
      for (const k of berubah) (patch as Record<string, unknown>)[k] = kosongkan(draf[k]);
      await ubahBrief(projectId, patch);
      onTersimpan({ ...brief, ...patch });
      setDraf({});
      toast({ judul: "Kerangka acuan disimpan", nada: "sukses" });
    } catch (e) {
      toast({ judul: "Gagal menyimpan kerangka acuan", keterangan: (e as Error).message, nada: "gagal" });
    } finally {
      setMenyimpan(false);
    }
  }

  const anggaran = nilai("budgetAmount");
  /* Isian bentuk lama (teks bebas) masih dikirim API untuk brief yang diisi
     sebelum formulirnya berubah. Tidak bisa disunting lagi, tapi juga tidak
     boleh hilang dari pandangan. */
  const lama = [brief.budgetRange && `anggaran “${brief.budgetRange}”`, brief.timeline && `jadwal “${brief.timeline}”`].filter(Boolean);

  return (
    <div className="mpk__acuan">
      <header className="mpk__pkop">
        <p className="mpk__plabel">Kerangka acuan · brief klien</p>
        <small className={brief.submittedAt ? "is-ada" : "is-belum"}>
          {brief.submittedAt
            ? `Dikirim klien ${tanggal(brief.submittedAt)} — perubahan di sini ikut terlihat di portalnya.`
            : "Klien belum mengisi — staf bisa mengisikannya di sini."}
        </small>
      </header>
      <div className="mpk__acuanisi">
        <div className="mpk__kisi">
          <Isian
            label="Anggaran (Rp)"
            inputMode="numeric"
            placeholder="0"
            value={anggaran == null ? "" : anggaran.toLocaleString("id-ID")}
            onChange={(e) => {
              const angka = e.currentTarget.value.replace(/\D/g, "");
              set("budgetAmount", angka ? Number(angka) : null);
            }}
          />
          <Isian
            label="Preferensi gaya"
            placeholder="mis. tropis modern"
            value={nilai("stylePreference") ?? ""}
            onChange={(e) => set("stylePreference", e.currentTarget.value)}
          />
          <IsianTanggal label="Mulai" nilai={mulai} onUbah={(v) => set("startDate", v || null)} />
          <IsianTanggal
            label="Selesai"
            min={mulai || undefined}
            className={tanggalTerbalik ? "mpk__peringatan" : undefined}
            bantu={tanggalTerbalik ? "Mendahului tanggal mulai." : undefined}
            nilai={selesai}
            onUbah={(v) => set("endDate", v || null)}
          />
        </div>
        <label className="k-isian">
          <span className="k-isian__label">Kebutuhan ruang dan fungsi</span>
          <IsianPanjang
            rows={3}
            placeholder="mis. 3 kamar tidur, ruang kerja, carport 2 mobil"
            value={nilai("requirements") ?? ""}
            onChange={(e) => set("requirements", e.currentTarget.value)}
          />
        </label>
        {lama.length > 0 && <p className="mpk__lama">Isian bentuk lama dari klien: {lama.join(", ")}.</p>}
        <label className="k-isian">
          <span className="k-isian__label">Catatan internal · hanya staf</span>
          <IsianPanjang
            rows={2}
            placeholder="mis. sudah ditelepon, minta contoh referensi tambahan"
            value={nilai("internalNotes") ?? ""}
            onChange={(e) => set("internalNotes", e.currentTarget.value)}
          />
        </label>
      </div>
      <footer className="mpk__pkaki">
        <p className={`mpk__tanda${n > 0 || tanggalTerbalik ? " is-belum" : ""}`}>
          {tanggalTerbalik ? "Tanggal selesai mendahului tanggal mulai." : n > 0 ? `${n} perubahan belum disimpan` : "Semua perubahan tersimpan"}
        </p>
        {n > 0 && (
          <Tombol ukuran="medium" jenis="ghost" disabled={menyimpan} onClick={() => setDraf({})}>
            Batalkan
          </Tombol>
        )}
        <Tombol memuat={menyimpan} ukuran="medium" jenis="primary" disabled={n === 0 || tanggalTerbalik || menyimpan} onClick={simpan}>
          {menyimpan ? "Menyimpan…" : "Simpan"}
        </Tombol>
      </footer>
    </div>
  );
}

/* --- Kantong: kabar ke klien (linimasa progres) ----------------------------------------- */

function Kabar({
  projectId,
  progres,
  setProgres,
}: {
  projectId: string;
  progres: ProjectProgress | null;
  setProgres: React.Dispatch<React.SetStateAction<ProjectProgress | null>>;
}) {
  const toast = useToast();
  const [judul, setJudul] = useState("");
  const [catatan, setCatatan] = useState("");
  const [sibuk, setSibuk] = useState(false);
  useCegahPindah(judul.trim() !== "" || catatan.trim() !== "");

  async function tambah(e: { preventDefault: () => void }) {
    e.preventDefault();
    const j = judul.trim();
    if (j.length < 2) return;
    setSibuk(true);
    try {
      await tambahCatatanProgress(projectId, j, catatan.trim() || null);
      setJudul("");
      setCatatan("");
      setProgres(await ambilProgress(projectId));
      toast({ judul: "Kabar ditambahkan", keterangan: "Langsung terlihat di portal klien.", nada: "sukses" });
    } catch (err) {
      toast({ judul: "Gagal menambah kabar", keterangan: (err as Error).message, nada: "gagal" });
    } finally {
      setSibuk(false);
    }
  }

  async function hapus(id: string) {
    try {
      await hapusCatatanProgress(id);
      setProgres((p) => (p ? { ...p, updates: p.updates.filter((u) => u.id !== id) } : p));
    } catch (err) {
      toast({ judul: "Gagal menghapus kabar", keterangan: (err as Error).message, nada: "gagal" });
    }
  }

  return (
    <div className="mpk__kabar">
      <header className="mpk__pkop">
        <p className="mpk__plabel">Kabar ke klien · linimasa portal</p>
        <small>Terbaru di atas — persis urutan yang dibaca klien.</small>
      </header>
      <form className="mpk__kabarform" onSubmit={tambah}>
        <Isian label="Judul kabar" placeholder="mis. Fondasi selesai dicor" maxLength={160} value={judul} onChange={(e) => setJudul(e.currentTarget.value)} />
        <label className="k-isian">
          <span className="k-isian__label">Catatan (opsional)</span>
          <IsianPanjang
            rows={2}
            placeholder="Satu-dua kalimat yang menjelaskan apa artinya bagi klien."
            value={catatan}
            onChange={(e) => setCatatan(e.currentTarget.value)}
          />
        </label>
        <div className="mpk__kabaraksi">
          {judul.trim().length < 2 && <span className="mpk__alasan">Isi judulnya dulu, minimal 2 huruf.</span>}
          <Tombol ukuran="medium" jenis="primary" tipeHtml="submit" disabled={judul.trim().length < 2 || sibuk}>
            {sibuk ? "Menambah…" : "Tambah ke linimasa"}
          </Tombol>
        </div>
      </form>
      {progres === null ? (
        <RangkaBaris jumlah={3} label="Memuat kabar…" />
      ) : progres.updates.length === 0 ? (
        <p className="mpk__kosongteks">Belum ada kabar. Kabar pertama langsung tampil di portal klien.</p>
      ) : (
        <ol className="mpk__lini">
          {progres.updates.map((u) => (
            <li key={u.id}>
              <i aria-hidden="true" />
              <time dateTime={u.createdAt}>{tanggalPendek(u.createdAt)}</time>
              <span>
                <b>{u.title}</b>
                {u.note && <small>{u.note}</small>}
              </span>
              <AlertDialog
                destructive
                title={`Hapus “${u.title}”?`}
                description="Hilang dari linimasa klien."
                confirmLabel="Ya, hapus"
                onConfirm={() => hapus(u.id)}
                trigger={
                  <button type="button" className="mpk__hapuskecil" aria-label={`Hapus kabar ${u.title}`}>
                    <Ikon ikon={Trash} ukuran={13} />
                  </button>
                }
              />
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/* Kerangka memuat berbentuk map dan setinggi map aslinya. */
function Rangka() {
  return (
    <div className="mpk" aria-busy="true">
      <div className="mpk__map">
        <div className="mpk__kop mpk__kop--rangka" />
        <div className="mpk__sayap">
          <div className="mpk__slotkartu" />
          <div className="mpk__kantong" />
        </div>
        <span className="mpk__punggung" />
        <div className="mpk__isimap">
          <div className="mpk__alas">
            <div className="mpk__gambar is-rangka" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function PortalKlienKit() {
  return (
    <RequireAuth skeleton={<Rangka />}>
      <ToastProvider>
        <Isi />
      </ToastProvider>
    </RequireAuth>
  );
}
