import { useEffect, useLayoutEffect, useRef, useState, type DragEvent, type KeyboardEvent } from "react";
import { GagalMuat } from "./gagalMuat";
import { IsianTanggal, IsianPanjang, Lampiran, PilihMenu } from "../kit/Formulir";
import { RequireAuth } from "./RequireAuth";
import { ToastProvider, useToast } from "../kit/Toast";
import { AlertDialog } from "../kit/Overlay";
import { Icon } from "../ui/Icon";
import { Tombol } from "../kit/Tombol";
import { Isian } from "../kit/Isian";
import { Gelembung } from "../kit/Item";
import { GulirPesan, RangkaBaris } from "../kit/Tampilan";
import { Ikon } from "../kit/Ikon";
import { ArrowRight, CaretDown, CopySimple, FilePdf, FileText, Globe, Plus, Trash } from "../kit/ikon";
import { PemutarSuaraKit, PerekamSuaraKit } from "../kit/Suara";
import { formatDurasi } from "../ui/misc/VoiceNote";
import { usePilihProyek } from "./pilihProyekKit";
import { geraknya } from "./hitung";
import { kodeProyek } from "../../lib/nomorDokumen";
import { CATEGORY_LABELS } from "../../lib/api";
import { formatRupiahRingkas } from "../../lib/format";
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
  bacaCache,
  tulisCache,
  MAKS_BYTE_DOKUMEN,
  type Proyek,
  type BriefProyek,
  type DokumenProyek,
  type KomentarDokumen,
  type ProjectProgress,
} from "../../lib/admin";
import { useCegahPindah } from "../../lib/cegahPindah";
import { tanya } from "../../lib/tanya";
import { bukaLightbox } from "../../lib/lightbox";

/* =============================================================================
   Portal Klien = PAPAN PRESENTASI + LEMBAR TINJAUAN.

   Semua yang dilihat klien lewat tautan /progres?t=… Di studio, gambar yang
   diserahkan ke klien dipajang di PAPAN PRESENTASI (sesi pin-up): lembar
   demi lembar dijepit rapi, dan tiap lembar akhirnya membawa CAP tanggapan
   klien — menunggu, revisi, disetujui. Halaman ini benda itu, di papan
   hijau berjahit (`--kas-bidang`).

   1. KOP — judul proyek (sekaligus pemilih proyek), klien · kota · jenis, dan
      TAHAP yang dilihat klien di atas portalnya: enam langkah yang sekaligus
      pengubah fase (tersimpan seketika).
   2. PAPAN PRESENTASI — satu lembar per dokumen yang dikirim (urutan sama
      dengan yang dilihat klien), dijepit klip di lis atasnya: muka lembar
      (gambar, muka PDF, atau gelombang pesan suara), kop mini bernomor
      {KODE}-NN (urutan kirim), dan CAP status. Slot terakhir "Kirim lembar"
      membuka lembar kirim; berkas yang dijatuhkan ke papan langsung naik.
   3. BRIEF KLIEN dan KABAR KE KLIEN — dua kartu ringkas di bawah papan.
   4. LEMBAR di kanan — kertas putih tetap yang berganti menurut pilihan:
      LEMBAR TINJAUAN satu dokumen (pratinjau besar, deret cap tanggapan yang
      sekaligus pengubah status, catatan revisi klien, utas komentar),
      KERANGKA ACUAN (brief, disimpan hanya kolom yang berubah), KABAR (tambah
      dan hapus), atau LEMBAR KIRIM (unggah berkas, rekam suara).
   5. KAKI — tautan portal: salin, buka seperti klien, buat ulang.

   Lembar brief, kabar, dan kirim tetap terpasang selagi tersembunyi, supaya
   brief yang setengah diketik atau rekaman yang belum dikirim tidak hilang
   karena staf melirik lembar lain.

   Gerak, hanya karena perbuatan (jebakan #74), seketika bila gerak
   dikurangi: lembar kanan DITURUNKAN dari papan ke meja saat pilihan
   berganti; mengubah status MENCAP ulang cap lembar itu saja, di papan dan
   di lembar tinjauan; lembar baru DIJEPIT ke papan sesudah diunggah.
   Disentuh tetikus, lembar di papan terangkat dari klipnya.
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
const STATUS: { nilai: string; label: string; cap: string }[] = [
  { nilai: "draft", label: "Draf", cap: "Draf" },
  { nilai: "menunggu_klien", label: "Menunggu klien", cap: "Menunggu" },
  { nilai: "revisi_diminta", label: "Revisi diminta", cap: "Revisi" },
  { nilai: "disetujui", label: "Disetujui", cap: "Disetujui" },
  { nilai: "final", label: "Final", cap: "Final" },
];
const CAP = Object.fromEntries(STATUS.map((s) => [s.nilai, s])) as Record<string, (typeof STATUS)[number]>;

type Pilihan = { jenis: "dok"; id: string } | { jenis: "brief" } | { jenis: "kabar" } | { jenis: "kirim" };

const BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const tanggal = (iso: string) => {
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  return `${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}`;
};
const tanggalPendek = (iso: string) => {
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  return `${d.getDate()} ${BULAN[d.getMonth()]}`;
};
const tanggalJam = (iso: string) =>
  new Date(iso).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

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

function Isi() {
  const { semua, asli, galat, id, pilih } = usePilihProyek();

  if (galat) return <GagalMuat apa="Proyek" galat={galat} />;
  if (!semua) return <Rangka />;
  if (!asli) {
    return (
      <div className="ppr">
        <p className="ppr__tanpa">
          {id ? "Proyek ini tidak ditemukan — mungkin sudah dihapus." : "Belum ada proyek."}{" "}
          <a href="/admin/proyek">Buka Semua Proyek</a>
        </p>
      </div>
    );
  }
  /* `key`: berpindah proyek memasang ulang seluruh papan, jadi tidak ada
     sisa brief, lembar, atau kabar proyek sebelumnya yang sempat tergambar
     di bawah judul proyek yang baru. */
  return <Papan key={asli.id} proyek={asli} semua={semua} onPilih={pilih} />;
}

function Papan({ proyek, semua, onPilih }: { proyek: Proyek; semua: Proyek[]; onPilih: (id: string) => void }) {
  const toast = useToast();
  const [brief, setBrief] = useState<BriefProyek | null>(() => bacaCache<BriefProyek>(`brief:${proyek.id}`));
  const [dokumen, setDokumen] = useState<DokumenProyek[] | null>(() =>
    bacaCache<DokumenProyek[]>(`dokumen:${proyek.id}`),
  );
  const [progres, setProgres] = useState<ProjectProgress | null>(() =>
    bacaCache<ProjectProgress>(`progres:${proyek.id}`),
  );
  const [briefBerubah, setBriefBerubah] = useState(0);
  const [pilihan, setPilihan] = useState<Pilihan | null>(null);
  /* Lembar yang statusnya baru berganti (dicap ulang sekali) dan yang baru
     diunggah (dijepit ke papan sekali). */
  const [tercap, setTercap] = useState<string | null>(null);
  const [baru, setBaru] = useState<string[]>([]);
  const [antre, setAntre] = useState<{ selesai: number; total: number } | null>(null);
  const [judulKirim, setJudulKirim] = useState("");
  const [seret, setSeret] = useState(false);
  const turunRef = useRef(false);
  const mejaRef = useRef<HTMLDivElement>(null);
  const waktu = useRef<number[]>([]);
  useEffect(() => () => waktu.current.forEach((t) => clearTimeout(t)), []);

  useEffect(() => {
    ambilBrief(proyek.id)
      .then((d) => {
        tulisCache(`brief:${proyek.id}`, d);
        setBrief(d);
      })
      .catch(() => setBrief((l) => l ?? {}));
    muatDokumen();
    ambilProgress(proyek.id)
      .then((d) => {
        tulisCache(`progres:${proyek.id}`, d);
        setProgres(d);
      })
      .catch((e) => toast({ judul: "Gagal memuat progres", keterangan: (e as Error).message, nada: "gagal" }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proyek.id]);

  function muatDokumen(): Promise<DokumenProyek[] | null> {
    return daftarDokumen(proyek.id)
      .then((d) => {
        tulisCache(`dokumen:${proyek.id}`, d);
        setDokumen(d);
        return d;
      })
      .catch(() => {
        setDokumen((l) => l ?? []);
        return null;
      });
  }

  /* Pilihan bawaan dihitung, bukan disimpan, sampai staf memilih sendiri:
     lembar yang paling perlu dilihat, atau brief kalau papan masih kosong. */
  const bawaan: Pilihan | null = dokumen
    ? (() => {
        const l = lembarBawaan(dokumen);
        return l ? { jenis: "dok", id: l.id } : { jenis: "brief" };
      })()
    : null;
  const kini: Pilihan | null =
    pilihan && (pilihan.jenis !== "dok" || dokumen?.some((d) => d.id === pilihan.id)) ? pilihan : bawaan;
  const dokKini = kini?.jenis === "dok" ? dokumen?.find((d) => d.id === kini.id) ?? null : null;
  const kunciKini = kini ? (kini.jenis === "dok" ? `dok:${kini.id}` : kini.jenis) : "";

  function pilihLembar(p: Pilihan) {
    const k = p.jenis === "dok" ? `dok:${p.id}` : p.jenis;
    if (k === kunciKini) return;
    turunRef.current = geraknya();
    setPilihan(p);
    /* Di layar sempit lembar kanan ada di bawah papan: bawa ke sana. */
    if (matchMedia("(max-width: 1288px)").matches)
      requestAnimationFrame(() => mejaRef.current?.scrollIntoView({ block: "start", behavior: geraknya() ? "smooth" : "auto" }));
  }

  /* Lembar kanan DITURUNKAN dari papan: datang dari arah papan, sedikit
     miring, lalu rebah di meja. */
  useLayoutEffect(() => {
    if (!turunRef.current) return;
    turunRef.current = false;
    mejaRef.current
      ?.querySelector<HTMLElement>(":scope > .ppr__lembar:not([hidden])")
      ?.animate(
        [{ transform: "translate(-22px, -10px) rotate(-1.2deg) scale(0.975)", opacity: 0.4 }, { transform: "none", opacity: 1 }],
        { duration: 380, easing: "cubic-bezier(0.22, 0.7, 0.2, 1)" },
      );
  }, [kunciKini]);

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
    requestAnimationFrame(() => document.querySelector<HTMLElement>(`.ppr__tahap [data-fase="${FASE[j]![0]}"]`)?.focus());
  }

  async function gantiProyek(baruId: string) {
    if (baruId === proyek.id) return;
    if (
      briefBerubah > 0 &&
      !(await tanya({ judul: "Pindah proyek?", isi: `Ada ${briefBerubah} perubahan brief yang belum disimpan.`, ya: "Tinggalkan", bahaya: true }))
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
    if (masuk.length && geraknya()) {
      setBaru(masuk);
      waktu.current.push(window.setTimeout(() => setBaru([]), 900));
    }
    if (masuk.length) {
      turunRef.current = geraknya();
      setPilihan({ jenis: "dok", id: masuk[masuk.length - 1]! });
    }
  }

  async function unggahBanyak(daftar: File[]) {
    if (daftar.length === 0 || mengunggah) return;
    /* Yang kebesaran dilewati, bukan membatalkan antrean: kalau sembilan
       dari sepuluh sah, sembilan itu tetap naik. */
    const kebesaran = daftar.filter((f) => f.size > MAKS_BYTE_DOKUMEN);
    const sah = daftar.filter((f) => f.size <= MAKS_BYTE_DOKUMEN && TIPE_SAH.includes(f.type));
    const ditolak = daftar.length - sah.length - kebesaran.length;
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
    const sebelum = new Set((dokumen ?? []).map((d) => d.id));
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
        judul: berhasil === 1 ? "Lembar dipasang di papan" : `${berhasil} lembar dipasang di papan`,
        keterangan: "Langsung terlihat di portal klien.",
        nada: "sukses",
      });
    }
  }

  async function kirimSuara(blob: Blob, durasiMs: number, mime: string) {
    const sebelum = new Set((dokumen ?? []).map((d) => d.id));
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
    setDokumen(dokumen.map((x) => (x.id === d.id ? { ...x, status } : x)));
    setTercap(d.id);
    waktu.current.push(window.setTimeout(() => setTercap(null), 800));
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
      setDokumen((l) => l?.filter((x) => x.id !== d.id) ?? l);
      setPilihan(null);
      toast({ judul: "Lembar diturunkan dari papan", keterangan: d.title, nada: "sukses" });
      /* Tombol hapusnya ikut lenyap bersama lembarnya; fokus pindah ke
         lembar yang kini terbuka (jebakan #39). */
      requestAnimationFrame(() =>
        document.querySelector<HTMLElement>(".ppr__lbr.is-pilih .ppr__lbrbuka, .ppr__slot, .ppr__kirim")?.focus(),
      );
    } catch (e) {
      toast({ judul: "Gagal menghapus dokumen", keterangan: (e as Error).message, nada: "gagal" });
    }
  }

  /* Berkas yang dijatuhkan ke papan langsung naik — kebiasaan yang sama
     dengan zona unggah di lembar kirim. */
  function jatuh(e: DragEvent<HTMLElement>) {
    if (!e.dataTransfer?.files?.length) return;
    e.preventDefault();
    setSeret(false);
    void unggahBanyak(Array.from(e.dataTransfer.files));
  }

  /* Papan ketik di papan: panah memindah lembar terpilih. */
  const daftar = dokumen ?? [];
  const nomor = new Map(
    daftar
      .slice()
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map((d, i) => [d.id, `${kodeProyek(proyek.title)}-${String(i + 1).padStart(2, "0")}`]),
  );
  function tombolPapan(e: KeyboardEvent<HTMLElement>) {
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
    pilihLembar({ jenis: "dok", id: daftar[j]!.id });
    requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-lembar="${daftar[j]!.id}"] .ppr__lbrbuka`)?.focus());
  }

  const menunggu = daftar.filter((d) => d.status === "menunggu_klien").length;
  const revisi = daftar.filter((d) => d.status === "revisi_diminta").length;
  const jenis = CATEGORY_LABELS[proyek.category as keyof typeof CATEGORY_LABELS] ?? proyek.category;

  /* ---- Lembar di papan (fungsi, bukan komponen — jebakan #80) ---- */
  const lembarPapan = (d: DokumenProyek) => {
    const j = jenisBerkas(d);
    const dipilih = dokKini?.id === d.id;
    const cap = CAP[d.status] ?? { nilai: d.status, label: d.status, cap: d.status };
    return (
      <li
        key={d.id}
        data-lembar={d.id}
        className={`ppr__lbr is-${d.status}${dipilih ? " is-pilih" : ""}${baru.includes(d.id) ? " is-baru" : ""}`}
      >
        <button
          type="button"
          className="ppr__lbrbuka"
          tabIndex={dipilih || (!dokKini && d === daftar[0]) ? 0 : -1}
          aria-pressed={dipilih}
          aria-label={`${nomor.get(d.id)} ${d.title}, ${cap.label}`}
          onClick={() => pilihLembar({ jenis: "dok", id: d.id })}
        />
        <span className={`ppr__muka is-${j}`} aria-hidden="true">
          {j === "gambar" ? (
            <img src={d.fileUrl} alt="" loading="lazy" />
          ) : j === "suara" ? (
            <>
              <span className="ppr__gel">
                {gelombang(d.id).map((t, i) => (
                  <i key={i} style={{ height: `${Math.round(t * 100)}%` }} />
                ))}
              </span>
              <b>{d.durationMs ? formatDurasi(d.durationMs) : "Suara"}</b>
            </>
          ) : (
            <>
              <Ikon ikon={j === "pdf" ? FilePdf : FileText} ukuran={26} />
              <b>{j === "pdf" ? "PDF" : "Berkas"}</b>
              {typeof d.fileSize === "number" && <small>{ukuranBerkas(d.fileSize)}</small>}
            </>
          )}
        </span>
        <span className="ppr__kopmini" aria-hidden="true">
          <span>
            <b>{d.title}</b>
            <small>{nomor.get(d.id)}</small>
          </span>
          <i key={d.status} className={`ppr__cap is-${d.status}${tercap === d.id ? " is-tercap" : ""}`}>
            {cap.cap}
          </i>
        </span>
      </li>
    );
  };

  const kabarTerbaru = progres?.updates.slice(0, 3) ?? [];

  return (
    <div className="ppr">
      <div className="ppr__papan">
        {/* ---- Kop ---------------------------------------------------- */}
        <header className="ppr__kop">
          <div className="ppr__kopjudul">
            <p>Portal klien · papan presentasi</p>
            <PilihMenu
              label="Pilih proyek"
              nilai={proyek.id}
              opsi={semua.map((p) => ({ nilai: p.id, label: p.title }))}
              onUbah={(v) => void gantiProyek(v)}
              pemicu={
                <button type="button" className="ppr__proyek">
                  <h2>{proyek.title}</h2>
                  <Ikon ikon={CaretDown} ukuran={16} />
                </button>
              }
            />
            <small>{[proyek.client && `Klien ${proyek.client}`, proyek.city, jenis].filter(Boolean).join(" · ")}</small>
          </div>
          <div className="ppr__tahapkop">
            <p id="ppr-tahap">
              Tahap yang dilihat klien <b>{faseKe >= 0 ? `${faseKe + 1}/${FASE.length}` : "—"}</b>
            </p>
            <div className="ppr__tahap" role="radiogroup" aria-labelledby="ppr-tahap" onKeyDown={tombolTahap}>
              {FASE.map(([nilai, label], i) => (
                <button
                  key={nilai}
                  type="button"
                  role="radio"
                  data-fase={nilai}
                  aria-checked={i === faseKe}
                  tabIndex={i === faseKe || (faseKe < 0 && i === 0) ? 0 : -1}
                  disabled={!progres}
                  className={`${i < faseKe ? "is-lewat" : ""}${i === faseKe ? " is-kini" : ""}`}
                  onClick={() => void ubahFase(nilai)}
                >
                  <i aria-hidden="true">{i + 1}</i>
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>
        </header>

        {/* ---- Papan presentasi -------------------------------------- */}
        <section
          className={`ppr__pajang${seret ? " is-seret" : ""}`}
          aria-labelledby="ppr-pajang"
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
          <div className="ppr__pajangkop">
            <h3 id="ppr-pajang">Papan presentasi</h3>
            <p>
              {dokumen === null
                ? "memuat…"
                : `${daftar.length} lembar dikirim${menunggu ? ` · ${menunggu} menunggu klien` : ""}${revisi ? ` · ` : ""}`}
              {revisi > 0 && <em>{revisi} revisi diminta</em>}
            </p>
            {antre && (
              <span className="ppr__antre" role="status">
                Memasang {antre.selesai}/{antre.total}…
              </span>
            )}
            <button
              type="button"
              className={`ppr__kirim${kini?.jenis === "kirim" ? " is-pilih" : ""}`}
              aria-pressed={kini?.jenis === "kirim"}
              onClick={() => pilihLembar({ jenis: "kirim" })}
            >
              <Ikon ikon={Plus} ukuran={13} />
              Kirim lembar
            </button>
          </div>
          <div className="ppr__lis" onKeyDown={tombolPapan}>
            {dokumen === null ? (
              <RangkaBaris jumlah={2} label="Memuat lembar…" />
            ) : (
              <ol className={`ppr__lembaran${daftar.length === 0 ? " is-kosong" : ""}`}>
                {daftar.map(lembarPapan)}
                {/* Papan kosong: satu slot selebar papan, supaya halaman
                    pertama proyek baru menunjuk pekerjaan berikutnya. */}
                {daftar.length === 0 && (
                  <li className="ppr__lbrslot">
                    <button type="button" className="ppr__slot" onClick={() => pilihLembar({ jenis: "kirim" })}>
                      <Ikon ikon={Plus} ukuran={22} />
                      <b>Belum ada lembar di papan</b>
                      <small>Kirim gambar, PDF, atau pesan suara — atau jatuhkan berkasnya ke sini.</small>
                    </button>
                  </li>
                )}
              </ol>
            )}
          </div>
        </section>

        {/* ---- Brief dan kabar --------------------------------------- */}
        <div className="ppr__bawah">
          <button
            type="button"
            className={`ppr__kartu${kini?.jenis === "brief" ? " is-pilih" : ""}`}
            aria-pressed={kini?.jenis === "brief"}
            onClick={() => pilihLembar({ jenis: "brief" })}
          >
            <span className="ppr__kartukop">
              <b>Brief klien</b>
              <small className={brief?.submittedAt ? "is-ada" : "is-belum"}>
                {brief === null ? "memuat…" : brief.submittedAt ? `dikirim klien ${tanggalPendek(brief.submittedAt)}` : "belum diisi klien"}
              </small>
              {briefBerubah > 0 && <em>{briefBerubah} belum disimpan</em>}
            </span>
            <dl className="ppr__ringkas">
              <div>
                <dt>Anggaran</dt>
                <dd>{brief?.budgetAmount ? formatRupiahRingkas(brief.budgetAmount) : brief?.budgetRange || "—"}</dd>
              </div>
              <div>
                <dt>Gaya</dt>
                <dd>{brief?.stylePreference || "—"}</dd>
              </div>
              <div>
                <dt>Jadwal</dt>
                <dd>
                  {brief?.startDate || brief?.endDate
                    ? `${brief?.startDate ? tanggalPendek(brief.startDate) : "?"} → ${brief?.endDate ? tanggalPendek(brief.endDate) : "?"}`
                    : brief?.timeline || "—"}
                </dd>
              </div>
              <div className="ppr__butuh">
                <dt>Kebutuhan</dt>
                <dd>{brief?.requirements || "—"}</dd>
              </div>
            </dl>
          </button>
          <button
            type="button"
            className={`ppr__kartu${kini?.jenis === "kabar" ? " is-pilih" : ""}`}
            aria-pressed={kini?.jenis === "kabar"}
            onClick={() => pilihLembar({ jenis: "kabar" })}
          >
            <span className="ppr__kartukop">
              <b>Kabar ke klien</b>
              <small>{progres ? `${progres.updates.length} kabar di linimasa` : "memuat…"}</small>
              <span className="ppr__tambah" aria-hidden="true">
                <Ikon ikon={Plus} ukuran={12} />
                Kabar
              </span>
            </span>
            {kabarTerbaru.length ? (
              <ol className="ppr__kabarringkas">
                {kabarTerbaru.map((u) => (
                  <li key={u.id}>
                    <time dateTime={u.createdAt}>{tanggalPendek(u.createdAt)}</time>
                    <span>{u.title}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="ppr__kosongkartu">{progres ? "Belum ada kabar untuk klien." : ""}</p>
            )}
          </button>
        </div>

        {/* ---- Lembar di meja ---------------------------------------- */}
        <div className="ppr__meja" ref={mejaRef}>
          {kini?.jenis === "dok" && dokKini && (
            <LembarTinjauan
              key={dokKini.id}
              d={dokKini}
              nomor={nomor.get(dokKini.id) ?? ""}
              semuaGambar={daftar.filter((x) => jenisBerkas(x) === "gambar")}
              tercap={tercap === dokKini.id}
              onStatus={(s) => void ubahStatus(dokKini, s)}
              onHapus={() => hapus(dokKini)}
            />
          )}
          <div className="ppr__lembar ppr__lembar--brief" hidden={kini?.jenis !== "brief"}>
            {brief ? (
              <LembarBrief projectId={proyek.id} brief={brief} onTersimpan={setBrief} onBerubah={setBriefBerubah} />
            ) : (
              <RangkaBaris jumlah={4} label="Memuat brief…" />
            )}
          </div>
          <div className="ppr__lembar ppr__lembar--kabar" hidden={kini?.jenis !== "kabar"}>
            <LembarKabar projectId={proyek.id} progres={progres} setProgres={setProgres} />
          </div>
          <div className="ppr__lembar ppr__lembar--kirim" hidden={kini?.jenis !== "kirim"}>
            <p className="ppr__dlabel">Lembar kirim · {kodeProyek(proyek.title)}-{String(daftar.length + 1).padStart(2, "0")}</p>
            <h3 className="ppr__djudul">Kirim lembar ke klien</h3>
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
            <p className="ppr__catatkirim">Lembar yang dikirim langsung terlihat klien di portalnya.</p>
          </div>
        </div>

        {/* ---- Kaki: tautan portal ----------------------------------- */}
        <footer className="ppr__kaki" aria-label="Tautan portal klien">
          <span className="ppr__kakilabel">Tautan portal</span>
          <span className="ppr__tautan" title={tautan || undefined}>
            {tautan || "Memuat…"}
          </span>
          <button type="button" className="ppr__salin" disabled={!tautan} onClick={salin}>
            <Ikon ikon={CopySimple} ukuran={14} />
            Salin tautan
          </button>
          {tautan && (
            <a className="ppr__buka" href={tautan} target="_blank" rel="noreferrer">
              <Ikon ikon={Globe} ukuran={14} />
              Buka seperti klien
            </a>
          )}
          <AlertDialog
            destructive
            title="Buat tautan baru?"
            description="Tautan lama langsung berhenti bekerja. Pakai kalau tautannya telanjur sampai ke orang yang salah."
            confirmLabel="Ya, buat baru"
            onConfirm={buatUlang}
            trigger={
              <button type="button" className="ppr__ulang" disabled={!progres}>
                Buat ulang tautan
              </button>
            }
          />
        </footer>
      </div>
    </div>
  );
}

/* --- Lembar tinjauan satu dokumen ------------------------------------------ */

function LembarTinjauan({
  d,
  nomor,
  semuaGambar,
  tercap,
  onStatus,
  onHapus,
}: {
  d: DokumenProyek;
  nomor: string;
  semuaGambar: DokumenProyek[];
  tercap: boolean;
  onStatus: (s: string) => void;
  onHapus: () => void;
}) {
  const j = jenisBerkas(d);
  const cap = CAP[d.status] ?? { nilai: d.status, label: d.status, cap: d.status };
  const meta = [
    j === "suara" ? "Pesan suara" : j === "pdf" ? "PDF" : j === "gambar" ? "Gambar" : "Berkas",
    j === "suara" && d.durationMs ? formatDurasi(d.durationMs) : typeof d.fileSize === "number" && ukuranBerkas(d.fileSize),
    `dikirim ${tanggal(d.createdAt)}`,
  ].filter(Boolean);
  const i = STATUS.findIndex((s) => s.nilai === d.status);

  function tombolCap(e: KeyboardEvent<HTMLElement>) {
    let k = i;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") k = Math.min(STATUS.length - 1, i + 1);
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") k = Math.max(0, i - 1);
    else if (e.key === "Home") k = 0;
    else if (e.key === "End") k = STATUS.length - 1;
    else return;
    e.preventDefault();
    if (k === i) return;
    onStatus(STATUS[k]!.nilai);
    requestAnimationFrame(() => document.querySelector<HTMLElement>(`.ppr__deretcap [data-status="${STATUS[k]!.nilai}"]`)?.focus());
  }

  return (
    <article className="ppr__lembar ppr__lembar--tinjau" aria-labelledby="ppr-tinjau">
      <header className="ppr__dkop">
        <div>
          <p className="ppr__dlabel">Lembar tinjauan · {nomor}</p>
          <h3 id="ppr-tinjau" className="ppr__djudul">
            {d.title}
          </h3>
          <small>{meta.join(" · ")}</small>
        </div>
        <span key={d.status} className={`ppr__capbesar is-${d.status}${tercap ? " is-tercap" : ""}`}>
          <b>{cap.cap}</b>
          <small>{cap.nilai === "draft" ? "belum ditinjau" : "tanggapan"}</small>
        </span>
      </header>

      <div className={`ppr__pratinjau is-${j}`}>
        {j === "gambar" ? (
          <button
            type="button"
            className="ppr__perbesar"
            aria-label={`Perbesar ${d.title}`}
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
          <div className="ppr__putar">
            <Icon name="mic" size={22} />
            <PemutarSuaraKit url={d.fileUrl} durationMs={d.durationMs} label={d.title} className="ppr__pemutar" />
          </div>
        ) : (
          <a className="ppr__bukaberkas" href={d.fileUrl} target="_blank" rel="noreferrer">
            <Ikon ikon={j === "pdf" ? FilePdf : FileText} ukuran={34} />
            <b>{d.fileName || d.title}</b>
            <span>
              Buka {j === "pdf" ? "PDF" : "berkas"}
              <Ikon ikon={ArrowRight} ukuran={13} />
            </span>
          </a>
        )}
      </div>

      <section className="ppr__tanggap" aria-labelledby="ppr-cap">
        <h4 id="ppr-cap" className="ppr__dlabel">
          Cap tanggapan
        </h4>
        <div className="ppr__deretcap" role="radiogroup" aria-labelledby="ppr-cap" onKeyDown={tombolCap}>
          {STATUS.map((s) => (
            <button
              key={s.nilai}
              type="button"
              role="radio"
              data-status={s.nilai}
              aria-checked={d.status === s.nilai}
              tabIndex={d.status === s.nilai || (i < 0 && s.nilai === "draft") ? 0 : -1}
              className={`is-${s.nilai}`}
              onClick={() => onStatus(s.nilai)}
            >
              {s.cap}
            </button>
          ))}
        </div>
        {d.status === "revisi_diminta" && d.clientNote && (
          <p className="ppr__catatanklien">
            <b>Catatan klien</b>
            {d.clientNote}
          </p>
        )}
      </section>

      <Komentar documentId={d.id} />

      <footer className="ppr__dkaki">
        {j !== "suara" && (
          <a href={d.fileUrl} target="_blank" rel="noreferrer">
            Buka berkas asli
          </a>
        )}
        <AlertDialog
          destructive
          title={`Hapus ${d.title}?`}
          description="Beserta seluruh komentarnya. Klien tidak lagi melihatnya."
          confirmLabel="Ya, hapus"
          onConfirm={onHapus}
          trigger={
            <button type="button" className="ppr__hapus" aria-label={`Hapus ${d.title}`}>
              <Ikon ikon={Trash} ukuran={13} />
              Hapus lembar
            </button>
          }
        />
      </footer>
    </article>
  );
}

function Komentar({ documentId }: { documentId: string }) {
  const toast = useToast();
  const [komentar, setKomentar] = useState<KomentarDokumen[] | null>(null);
  const [isi, setIsi] = useState("");
  const [mengirim, setMengirim] = useState(false);

  function muat() {
    daftarKomentarDokumen(documentId)
      .then(setKomentar)
      .catch(() => setKomentar([]));
  }
  useEffect(muat, [documentId]);

  async function kirim(e: React.FormEvent) {
    e.preventDefault();
    const bersih = isi.trim();
    if (!bersih) return;
    setMengirim(true);
    try {
      await tambahKomentarDokumen(documentId, bersih);
      setIsi("");
      muat();
    } catch (err) {
      toast({ judul: "Gagal mengirim balasan", keterangan: (err as Error).message, nada: "gagal" });
    } finally {
      setMengirim(false);
    }
  }

  return (
    <section className="ppr__utas" aria-labelledby={`ppr-utas-${documentId}`}>
      <h4 id={`ppr-utas-${documentId}`} className="ppr__dlabel">
        Utas dengan klien{komentar && komentar.length > 0 ? ` · ${komentar.length}` : ""}
      </h4>
      <div className="ppr__utasisi">
        {komentar === null ? (
          <RangkaBaris jumlah={2} label="Memuat komentar…" />
        ) : komentar.length === 0 ? (
          <p className="ppr__utaskosong">Belum ada komentar. Balasan di sini terlihat klien di bawah lembarnya.</p>
        ) : (
          /* Menempel di bawah: balasan baru menggeser ke bawah hanya kalau
             staf memang sedang di bawah. */
          <GulirPesan tinggi="100%" jumlah={komentar.length}>
            {komentar.map((k) => (
              <Gelembung
                key={k.id}
                sendiri={k.author === "staf"}
                nama={k.author === "staf" ? "Studio" : "Klien"}
                waktu={tanggalJam(k.createdAt)}
              >
                {k.body}
              </Gelembung>
            ))}
          </GulirPesan>
        )}
      </div>
      <form className="ppr__balas" onSubmit={kirim}>
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

/* --- Kerangka acuan (brief) ------------------------------------------------- */

type KunciBrief = "budgetAmount" | "stylePreference" | "startDate" | "endDate" | "requirements" | "internalNotes";
const KUNCI_BRIEF: KunciBrief[] = ["budgetAmount", "stylePreference", "startDate", "endDate", "requirements", "internalNotes"];
/* "" dan null sama-sama "kosong" — tanpa ini, mengetik lalu menghapus satu
   huruf terhitung sebagai perubahan. */
const kosongkan = (v: unknown) => (v === "" || v === undefined ? null : v);

function LembarBrief({
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
      toast({ judul: "Brief disimpan", nada: "sukses" });
    } catch (e) {
      toast({ judul: "Gagal menyimpan brief", keterangan: (e as Error).message, nada: "gagal" });
    } finally {
      setMenyimpan(false);
    }
  }

  const anggaran = nilai("budgetAmount");
  /* Isian bentuk lama (teks bebas) masih dikirim API untuk brief yang
     diisi sebelum formulirnya berubah. Tidak bisa disunting lagi, tapi juga
     tidak boleh hilang dari pandangan. */
  const lama = [brief.budgetRange && `anggaran “${brief.budgetRange}”`, brief.timeline && `jadwal “${brief.timeline}”`].filter(
    Boolean,
  );

  return (
    <div className="ppr__brief">
      <header className="ppr__dkop">
        <div>
          <p className="ppr__dlabel">Kerangka acuan · brief klien</p>
          <h3 className="ppr__djudul">Brief</h3>
          <small className={brief.submittedAt ? "is-ada" : "is-belum"}>
            {brief.submittedAt
              ? `Dikirim klien ${tanggal(brief.submittedAt)} — perubahan di sini ikut terlihat di portalnya.`
              : "Klien belum mengisi brief — staf bisa mengisikannya di sini."}
          </small>
        </div>
      </header>
      <div className="ppr__briefisi">
        <div className="ppr__kisi">
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
            className={tanggalTerbalik ? "ppr__peringatan" : undefined}
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
        {lama.length > 0 && <p className="ppr__lama">Isian bentuk lama dari klien: {lama.join(", ")}.</p>}
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
      <footer className="ppr__dkaki">
        <p className={`ppr__penanda${n > 0 || tanggalTerbalik ? " is-belum" : ""}`}>
          {tanggalTerbalik
            ? "Tanggal selesai mendahului tanggal mulai."
            : n > 0
              ? `${n} perubahan belum disimpan`
              : "Semua perubahan tersimpan"}
        </p>
        {n > 0 && (
          <Tombol ukuran="medium" jenis="ghost" disabled={menyimpan} onClick={() => setDraf({})}>
            Batalkan
          </Tombol>
        )}
        <Tombol memuat={menyimpan} ukuran="medium" jenis="primary" disabled={n === 0 || tanggalTerbalik || menyimpan} onClick={simpan}>
          {menyimpan ? "Menyimpan…" : "Simpan brief"}
        </Tombol>
      </footer>
    </div>
  );
}

/* --- Kabar ke klien (linimasa progres) -------------------------------------- */

function LembarKabar({
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

  async function tambah(e: React.FormEvent) {
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
    <div className="ppr__kabar">
      <header className="ppr__dkop">
        <div>
          <p className="ppr__dlabel">Kabar ke klien · linimasa portal</p>
          <h3 className="ppr__djudul">Kabar</h3>
          <small>Terbaru di atas — persis urutan yang dibaca klien.</small>
        </div>
      </header>
      <form className="ppr__kabarform" onSubmit={tambah}>
        <Isian
          label="Judul kabar"
          placeholder="mis. Fondasi selesai dicor"
          maxLength={160}
          value={judul}
          onChange={(e) => setJudul(e.currentTarget.value)}
        />
        <label className="k-isian">
          <span className="k-isian__label">Catatan (opsional)</span>
          <IsianPanjang
            rows={2}
            placeholder="Satu-dua kalimat yang menjelaskan apa artinya bagi klien."
            value={catatan}
            onChange={(e) => setCatatan(e.currentTarget.value)}
          />
        </label>
        <div className="ppr__kabaraksi">
          {judul.trim().length < 2 && <span className="ppr__alasan">Isi judulnya dulu, minimal 2 huruf.</span>}
          <Tombol ukuran="medium" jenis="primary" tipeHtml="submit" disabled={judul.trim().length < 2 || sibuk}>
            {sibuk ? "Menambah…" : "Tambah ke linimasa"}
          </Tombol>
        </div>
      </form>
      {progres === null ? (
        <RangkaBaris jumlah={3} label="Memuat kabar…" />
      ) : progres.updates.length === 0 ? (
        <p className="ppr__utaskosong">Belum ada kabar. Kabar pertama langsung tampil di portal klien.</p>
      ) : (
        <ol className="ppr__lini">
          {progres.updates.map((u) => (
            <li key={u.id}>
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
                  <button type="button" className="ppr__hapuskecil" aria-label={`Hapus kabar ${u.title}`}>
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

/* Kerangka memuat berbentuk papan dan setinggi papan aslinya. */
function Rangka() {
  return (
    <div className="ppr" aria-busy="true">
      <div className="ppr__papan">
        <div className="ppr__kop ppr__kop--rangka" />
        <div className="ppr__pajang ppr__pajang--rangka" />
        <div className="ppr__bawah ppr__bawah--rangka" />
        <div className="ppr__meja">
          <div className="ppr__lembar ppr__lembar--rangka" />
        </div>
        <div className="ppr__kaki ppr__kaki--rangka" />
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
