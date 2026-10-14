import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent,
  type FocusEvent as RFocusEvent,
  type KeyboardEvent,
  type PointerEvent as RPointerEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { flushSync } from "react-dom";
import { navigate } from "astro:transitions/client";
import { PilihMenu } from "../kit/Formulir";
import { Ikon } from "../kit/Ikon";
import { Tombol } from "../kit/Tombol";
import { DropdownMenu } from "../kit/Overlay";
import { ToastProvider, useToast, titipToast } from "../kit/Toast";
import {
  ArsKunciRumah,
  ArsOrdner,
  CaretDown,
  CaretLeft,
  CaretRight,
  CaretUp,
  Check,
  CornersOut,
  DotsThree,
  Globe,
  ImageSquare,
  Plus,
  SpinnerGap,
  Trash,
  X,
} from "../kit/ikon";
import { GagalMuat } from "./gagalMuat";
import { RequireAuth } from "./RequireAuth";
import { usePilihProyek } from "./pilihProyekKit";
import { geraknya } from "./hitung";
import {
  simpanProyek,
  hapusProyek,
  mintaUrlUnggah,
  daftarGambar,
  tambahGambar,
  ubahGambar,
  hapusGambar,
  ambilSettings,
  bacaCache,
  tulisCache,
  type Proyek,
  type GambarProyek,
  type JenisGambar,
  type StudioSettings,
} from "../../lib/admin";
import { KATEGORI_LABEL, subjudulBerguna } from "../../lib/api";
import { BELUM_ADA } from "../../lib/menunggu";
import { kodeProyek } from "../../lib/nomorDokumen";
import { useCegahPindah } from "../../lib/cegahPindah";
import { tanya } from "../../lib/tanya";
import { kecilkanFoto, buatThumb, formatByte } from "../../lib/kecilkanFoto";
import { bukaLightbox } from "../../lib/lightbox";

/* =============================================================================
   Halaman Publik (/admin/proyek/publik) — MEJA CAHAYA studio.

   Benda dunia nyatanya meja cahaya: kaca susu yang diterangi dari bawah,
   dipakai studio arsitek untuk menjiplak gambar DAN memilih foto karya.
   Foto diletakkan sebagai slide bernomor, yang terbaik dilingkari spidol,
   dan foto sampul dibingkai dua siku potong untuk melihat bagian yang
   benar-benar tampil. Di sebelahnya PAPAN SAMPEL MATERIAL (contoh bahan
   yang ditempel berderet, berlabel) dan LEMBAR DATA KARYA — formulir yang
   dikirim studio bersama foto saat karyanya dipublikasikan.

   Tiap hiasan membawa data sungguhan:
   - Slot slide = batas 10 foto per jenis; slot putus = sisa kuota.
   - Siku potong = potongan 16:9 yang dipakai SEMUA tempat foto di situs
     (`--rasio-foto` di publik.css); persen yang terbuang ditulis di
     catatan dan di bingkai slide yang terpotong.
   - Lingkaran spidol = slide yang dipakai sebagai sampul.
   - Denah halaman di kop lembar = susunan /proyek/<slug>; bagian yang TIDAK
     akan tampil (tanpa cerita, tanpa material, tanpa galeri) digambar
     putus, persis logika halaman publiknya.
   - Placeholder kredit = kalimat yang dilihat pengunjung kalau kosong.
   - Isian yang diubah ditulis dengan PENSIL sampai disimpan, lalu jadi
     TINTA.

   Logika lama dibawa apa adanya: hanya kolom yang berubah yang dikirim,
   unggahan dikecilkan dulu lalu naik tiga sekaligus, sepuluh foto per
   jenis, sampul wajib sebelum terbit.

   Gerak — hanya karena perbuatan, diam bila gerak dikurangi: slide yang
   diseret melayang dan yang lain bergeser memberi tempat; foto baru jatuh
   ke kaca; "Jadikan sampul" menerbangkan fotonya ke selongsong sampul lalu
   melingkarinya dengan spidol; pensil jadi tinta saat disimpan.
   ============================================================================= */

const MAKS = 10;
/* Rasio foto di seluruh situs publik — `--rasio-foto: 16 / 9` (publik.css),
   dipakai sampul, galeri, beranda, dan daftar karya. */
const RASIO = 16 / 9;
/* Kartu bagikan (og:image) dipotong platform ke 1200x630. */
const RASIO_BAGIKAN = 1200 / 630;
const DOMAIN = "pahlevidirgaarchitecture.com";
const LEMBUT = "cubic-bezier(0.22, 0.7, 0.2, 1)";

const KATEGORI = KATEGORI_LABEL as Record<string, string>;

type Draf = Partial<Proyek> & { coverImageKey?: string };
type Halaman = "data" | "cerita" | "cari";
type Zona = "kepala" | "fakta" | "sampul" | "cerita" | "material" | "galeri" | "kredit";
type Toast = ReturnType<typeof useToast>;

const STATUS: { nilai: string; label: string; ket: string }[] = [
  { nilai: "draft", label: "Draf", ket: "Draf — hanya terlihat oleh staf studio" },
  { nilai: "published", label: "Terbit", ket: "Terbit — tampil di situs setelah situs diterbitkan lagi" },
  { nilai: "archived", label: "Arsip", ket: "Arsip — disembunyikan dari situs tanpa dihapus" },
];

/* Halaman /proyek/<slug> baru ada sesudah build berikutnya. Tanggal terbit
   yang KOSONG dianggap sudah dibangun: proyek lama bisa saja terbit tanpa
   published_at, dan menyembunyikan tautannya selamanya lebih buruk daripada
   sesekali 404. */
const sudahDibangun = (terbitPada: string | null | undefined, dibangunPada?: string) =>
  !dibangunPada || !terbitPada || terbitPada <= dibangunPada;

/** Kotak potong rasio `r` di dalam gambar berasio `a` (object-fit: cover, terpusat), dalam pecahan 0–1. */
function potong(a: number, r: number) {
  if (a >= r) {
    const w = r / a;
    return { x: (1 - w) / 2, y: 0, w, h: 1, buang: 1 - w, sisi: "lebar" as const };
  }
  const h = a / r;
  return { x: 0, y: (1 - h) / 2, w: 1, h, buang: 1 - h, sisi: "tinggi" as const };
}

const persen = (v: number) => `${Math.round(v * 100)}%`;
const dua = (n: number) => String(n).padStart(2, "0");
/* Sama persis dengan halaman publik: paragraf dipisah baris kosong. */
const paragrafDari = (t?: string | null) =>
  (t ?? "")
    .split(/\n\s*\n/)
    .map((s) => s.trim())
    .filter(Boolean);
const jumlahKata = (t?: string | null) => (t ?? "").trim().split(/\s+/).filter(Boolean).length;

function pindahkan<T>(a: T[], dari: number, ke: number): T[] {
  const b = a.slice();
  const [x] = b.splice(dari, 1);
  b.splice(ke, 0, x!);
  return b;
}

/* Lingkaran spidol yang digambar tangan di SEKELILING bingkai slide —
   persegi bersudut bulat yang sedikit tidak rapi, ujungnya melewati titik
   awal. Bukan elips: elips selalu memotong sudut kotak, dan sudut bingkai
   berisi nomor dan persen potongan (jebakan #70). Jalurnya di celah 8px
   antara bingkai dan tepi kotak SVG, sudutnya ±3px di luar sudut bingkai. */
const LINGKAR =
  "M14 2.6C40 1.8 66 3.2 86 2.4Q97.6 2.2 97.8 13C98.4 40 97.2 64 97.8 86Q98 97.6 86.5 97.4C62 98.2 38 97 13.5 97.6Q2.4 97.8 2.2 86C1.8 60 3 36 2.4 13.8Q2.4 2.8 16 3.2L24 3.6";

/* ---- Foto per jenis (galeri, material) ---------------------------------------------- */

interface Foto {
  daftar: GambarProyek[] | null;
  mengunggah: number;
  baru: RefObject<Set<string>>;
  izin: RefObject<boolean>;
  unggah: (files: FileList | File[]) => Promise<void>;
  pindah: (dari: number, ke: number) => Promise<void>;
  hapus: (g: GambarProyek) => Promise<void>;
  keterangan: (g: GambarProyek, caption: string) => Promise<void>;
}

function useFoto(proyek: Proyek, jenis: JenisGambar, toast: Toast): Foto {
  const kunci = `gambar:${jenis}:${proyek.id}`;
  const nama = jenis === "material" ? "Sampel material" : "Foto galeri";
  const [daftar, setDaftar] = useState<GambarProyek[] | null>(() => bacaCache<GambarProyek[]>(kunci));
  const [mengunggah, setMengunggah] = useState(0);
  const baru = useRef(new Set<string>());
  const izin = useRef(false);
  const harap = useRef(false);
  const kini = useRef(daftar);
  kini.current = daftar;

  const muat = useCallback(
    () =>
      daftarGambar(proyek.id, jenis)
        .then((d) => {
          tulisCache(kunci, d);
          /* Yang baru muncul sesudah unggahan "jatuh" ke kaca — bukan yang
             datang bersama muat pertama. */
          if (harap.current) {
            harap.current = false;
            const ada = new Set((kini.current ?? []).map((g) => g.id));
            d.forEach((g) => {
              if (!ada.has(g.id)) baru.current.add(g.id);
            });
          }
          setDaftar(d);
        })
        .catch(() => setDaftar((l) => l ?? [])),
    [proyek.id, jenis, kunci],
  );
  useEffect(() => {
    void muat();
  }, [muat]);

  async function unggahSatu(f: File, urutan: number) {
    /* Dikecilkan LEBIH DULU: yang menghabiskan waktu bukan permintaan
       presign-nya, melainkan megabyte yang naik lewat koneksi rumah. */
    const kecil = await kecilkanFoto(f);
    const target = await mintaUrlUnggah(proyek.slug, kecil.berkas.type);
    const res = await fetch(target.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": kecil.berkas.type },
      body: kecil.berkas,
    });
    if (!res.ok) throw new Error(`Penyimpanan menolak ${f.name} (${res.status})`);
    /* Versi kecil SESUDAH yang besar selamat, dan kegagalannya tidak
       menggagalkan unggahan: thumbnail percepatan, bukan syarat. */
    let thumbKey: string | null = null;
    try {
      const t = await buatThumb(kecil.berkas);
      if (t) {
        const s = await mintaUrlUnggah(proyek.slug, t.type);
        const r = await fetch(s.uploadUrl, { method: "PUT", headers: { "Content-Type": t.type }, body: t });
        if (r.ok) thumbKey = s.key;
      }
    } catch {
      /* foto besarnya sudah aman — itu yang penting */
    }
    await tambahGambar(proyek.id, target.key, urutan, jenis, thumbKey);
    return { asli: kecil.byteAsli, kirim: kecil.byteBaru };
  }

  async function unggah(files: FileList | File[]) {
    const semua = [...files].filter((f) => f.type.startsWith("image/"));
    if (semua.length === 0) return;
    const sekarang = kini.current?.length ?? 0;
    /* Dipotong, bukan ditolak seluruhnya: menolak sepuluh berkas karena yang
       kesebelas kelebihan membuang sembilan unggahan yang sah. */
    const sisa = MAKS - sekarang;
    if (sisa <= 0) {
      toast({ judul: `${nama} penuh`, keterangan: `Maksimum ${MAKS}.`, nada: "gagal" });
      return;
    }
    const daftarUnggah = semua.slice(0, sisa);
    if (semua.length > sisa) {
      toast({ judul: `${daftarUnggah.length} diunggah`, keterangan: `Sisanya dilewati — maksimum ${MAKS}.`, nada: "gagal" });
    }
    setMengunggah((n) => n + daftarUnggah.length);
    /* Urutan ditetapkan SEKARANG, jadi unggahannya boleh selesai dalam urutan
       apa pun tanpa mengacak galeri. Tiga sekaligus: satu-satu membuang waktu
       tunggu jaringan, sepuluh sekaligus berebut satu jalur unggah rumahan. */
    const antre = daftarUnggah.map((f, i) => ({ f, urutan: sekarang + i }));
    let gagal = 0;
    let byteAsli = 0;
    let byteKirim = 0;
    const pekerja = async () => {
      for (;;) {
        const t = antre.shift();
        if (!t) return;
        try {
          const u = await unggahSatu(t.f, t.urutan);
          byteAsli += u.asli;
          byteKirim += u.kirim;
        } catch (e) {
          gagal += 1;
          toast({ judul: "Gagal mengunggah", keterangan: (e as Error).message, nada: "gagal" });
        } finally {
          setMengunggah((n) => n - 1);
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(3, daftarUnggah.length) }, pekerja));
    harap.current = true;
    await muat();
    const berhasil = daftarUnggah.length - gagal;
    if (berhasil > 0) {
      toast({
        judul: `${berhasil} ${jenis === "material" ? "sampel" : "foto"} terunggah`,
        keterangan: byteKirim < byteAsli ? `${formatByte(byteAsli)} dikecilkan jadi ${formatByte(byteKirim)} sebelum dikirim.` : undefined,
        nada: "sukses",
      });
    }
  }

  /** Memindah satu foto. Yang ditulis hanya foto yang urutannya berubah — dua untuk tukar tetangga. */
  async function pindah(dari: number, ke: number) {
    const lama = kini.current;
    if (!lama || dari === ke || ke < 0 || ke >= lama.length) return;
    const urut = pindahkan(lama, dari, ke).map((g, k) => ({ ...g, sortOrder: k }));
    const posisiLama = new Map(lama.map((g) => [g.id, g.sortOrder]));
    izin.current = true;
    setDaftar(urut);
    try {
      await Promise.all(
        urut.filter((g) => posisiLama.get(g.id) !== g.sortOrder).map((g) => ubahGambar(g.id, { sortOrder: g.sortOrder })),
      );
    } catch (e) {
      izin.current = true;
      setDaftar(lama);
      toast({ judul: "Gagal mengubah urutan", keterangan: (e as Error).message, nada: "gagal" });
    }
  }

  async function hapus(g: GambarProyek) {
    const sebelum = kini.current;
    if (!sebelum) return;
    izin.current = true;
    setDaftar(sebelum.filter((x) => x.id !== g.id));
    try {
      await hapusGambar(g.id);
    } catch (e) {
      izin.current = true;
      setDaftar(sebelum);
      toast({ judul: "Gagal menghapus", keterangan: (e as Error).message, nada: "gagal" });
    }
  }

  async function keterangan(g: GambarProyek, caption: string) {
    if ((g.caption ?? "") === caption) return;
    setDaftar((a) => a?.map((x) => (x.id === g.id ? { ...x, caption } : x)) ?? a);
    try {
      await ubahGambar(g.id, { caption: caption || null });
    } catch (e) {
      setDaftar((a) => a?.map((x) => (x.id === g.id ? { ...x, caption: g.caption } : x)) ?? a);
      toast({ judul: "Gagal menyimpan", keterangan: (e as Error).message, nada: "gagal" });
    }
  }

  return { daftar, mengunggah, baru, izin, unggah, pindah, hapus, keterangan };
}

/* ---- Gerak urutan: FLIP + geser dengan tangan --------------------------------------- */

/* Butir yang berpindah tempat meluncur dari posisi lamanya — hanya sesudah
   perbuatan (`izin`), tidak saat data datang (jebakan #74). Butir yang
   baru diunggah jatuh ke kaca. Posisi dibaca dari offsetLeft/Top: nilai
   tata letak, tidak ikut transform yang sedang berjalan. */
function useFlip(
  wadah: RefObject<HTMLElement | null>,
  kunci: string,
  izin: RefObject<boolean>,
  baru: RefObject<Set<string>>,
  kecuali: string | null,
) {
  const posisi = useRef<Map<string, { x: number; y: number }> | null>(null);
  useLayoutEffect(() => {
    const w = wadah.current;
    if (!w) return;
    const kini = new Map<string, { x: number; y: number; el: HTMLElement }>();
    w.querySelectorAll<HTMLElement>(":scope > [data-urut]").forEach((el) =>
      kini.set(el.dataset.urut!, { x: el.offsetLeft, y: el.offsetTop, el }),
    );
    const lama = posisi.current;
    if (lama && geraknya()) {
      kini.forEach((p, id) => {
        if (baru.current.has(id)) {
          baru.current.delete(id);
          p.el.animate(
            [
              { transform: "translateY(-34px) rotate(-7deg) scale(1.1)", opacity: 0 },
              { transform: "translateY(-6px) rotate(1deg) scale(1.02)", opacity: 1, offset: 0.7 },
              { transform: "none", opacity: 1 },
            ],
            { duration: 520, easing: LEMBUT },
          );
          return;
        }
        if (!izin.current || id === kecuali) return;
        const q = lama.get(id);
        if (!q) return;
        const dx = q.x - p.x;
        const dy = q.y - p.y;
        if (dx || dy) p.el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }], { duration: 340, easing: LEMBUT });
      });
    } else baru.current.clear();
    posisi.current = new Map([...kini].map(([id, p]) => [id, { x: p.x, y: p.y }]));
    if (!kecuali) izin.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kunci]);
}

interface KeadaanSeret {
  id: string;
  dari: number;
  ke: number;
  diSlot: number;
  x0: number;
  y0: number;
  dx: number;
  dy: number;
  asal: DOMRect;
  kotak: DOMRect[];
  el: HTMLElement;
  mulai: boolean;
  pid: number;
}

/* Slide dan sampel material bisa diangkat lalu diletakkan di tempat lain,
   seperti di meja sungguhan. Baru dianggap menyeret sesudah bergeser 6px,
   jadi klik biasa tetap memilih. Kotak tiap slot dibaca SEKALI saat mulai;
   slot paling dekat dengan pusat benda yang diangkat jadi tujuannya.
   Escape membatalkan. Papan ketik memakai Alt+panah atau tombol di baki. */
function useSeret(
  wadah: RefObject<HTMLElement | null>,
  ids: string[],
  izin: RefObject<boolean>,
  onLepas: (dari: number, ke: number) => void,
) {
  const [seret, setSeret] = useState<{ id: string; dari: number; ke: number } | null>(null);
  const aktif = useRef<KeadaanSeret | null>(null);
  const tahanKlik = useRef(false);
  const lepas = useRef(onLepas);
  lepas.current = onLepas;
  const daftarId = useRef(ids);
  daftarId.current = ids;

  const pasang = (st: KeadaanSeret) => {
    const slot = st.kotak[st.diSlot];
    if (!slot) return;
    st.el.style.transform = `translate(${st.asal.left + st.dx - slot.left}px, ${st.asal.top + st.dy - slot.top}px) rotate(-2.5deg) scale(1.06)`;
  };

  /* Sesudah React memindah elemennya ke slot baru, letaknya dihitung ulang
     terhadap slot itu — tanpa ini benda yang diangkat meloncat satu bingkai. */
  useLayoutEffect(() => {
    const st = aktif.current;
    if (!st || !seret) return;
    st.diSlot = seret.ke;
    pasang(st);
  }, [seret?.ke]);

  function turun(e: RPointerEvent<HTMLElement>, id: string) {
    if (e.button !== 0 || aktif.current) return;
    if ((e.target as HTMLElement).closest("input, textarea, a")) return;
    const dari = daftarId.current.indexOf(id);
    if (dari < 0) return;
    const el = e.currentTarget;
    const st: KeadaanSeret = {
      id,
      dari,
      ke: dari,
      diSlot: dari,
      x0: e.clientX,
      y0: e.clientY,
      dx: 0,
      dy: 0,
      asal: el.getBoundingClientRect(),
      kotak: [],
      el,
      mulai: false,
      pid: e.pointerId,
    };
    aktif.current = st;

    const gerak = (ev: PointerEvent) => {
      if (ev.pointerId !== st.pid) return;
      st.dx = ev.clientX - st.x0;
      st.dy = ev.clientY - st.y0;
      if (!st.mulai) {
        if (Math.hypot(st.dx, st.dy) < 6) return;
        st.mulai = true;
        const w = wadah.current;
        st.kotak = w ? [...w.querySelectorAll<HTMLElement>(":scope > [data-urut]")].map((a) => a.getBoundingClientRect()) : [];
        st.el.classList.add("is-diangkat");
        document.documentElement.classList.add("mjc-menyeret");
        izin.current = true;
        setSeret({ id, dari, ke: dari });
      }
      ev.preventDefault();
      const cx = st.asal.left + st.asal.width / 2 + st.dx;
      const cy = st.asal.top + st.asal.height / 2 + st.dy;
      let ke = st.ke;
      let jarak = Infinity;
      st.kotak.forEach((r, i) => {
        const d = (r.left + r.width / 2 - cx) ** 2 + (r.top + r.height / 2 - cy) ** 2;
        if (d < jarak) {
          jarak = d;
          ke = i;
        }
      });
      if (ke !== st.ke) {
        st.ke = ke;
        setSeret({ id, dari, ke });
      }
      pasang(st);
    };
    const naik = (ev: PointerEvent) => {
      if (ev.pointerId === st.pid) selesai(false);
    };
    const batal = () => selesai(true);
    const tombol = (ev: globalThis.KeyboardEvent) => {
      if (ev.key === "Escape" && st.mulai) {
        ev.preventDefault();
        ev.stopPropagation();
        selesai(true);
      }
    };
    function selesai(dibatalkan: boolean) {
      window.removeEventListener("pointermove", gerak);
      window.removeEventListener("pointerup", naik);
      window.removeEventListener("pointercancel", batal);
      window.removeEventListener("keydown", tombol, true);
      aktif.current = null;
      if (!st.mulai) return;
      tahanKlik.current = true;
      window.setTimeout(() => (tahanKlik.current = false), 0);
      document.documentElement.classList.remove("mjc-menyeret");
      const akhir = dibatalkan ? st.dari : st.ke;
      const slot = st.kotak[akhir] ?? st.asal;
      const tx = st.asal.left + st.dx - slot.left;
      const ty = st.asal.top + st.dy - slot.top;
      st.el.classList.remove("is-diangkat");
      st.el.style.transform = "";
      flushSync(() => {
        setSeret(null);
        if (!dibatalkan && akhir !== st.dari) lepas.current(st.dari, akhir);
      });
      if (!dibatalkan) izin.current = false;
      if (geraknya()) {
        st.el.animate(
          [{ transform: `translate(${tx}px, ${ty}px) rotate(-2.5deg) scale(1.06)` }, { transform: "none" }],
          { duration: 320, easing: LEMBUT },
        );
      }
    }
    window.addEventListener("pointermove", gerak, { passive: false });
    window.addEventListener("pointerup", naik);
    window.addEventListener("pointercancel", batal);
    window.addEventListener("keydown", tombol, true);
  }

  return { seret, turun, tahanKlik };
}

/* =============================================================================
   Halaman
   ============================================================================= */

function Isi({ dibangunPada }: { dibangunPada?: string }) {
  const { semua, setSemua, id, asli, galat, pilih } = usePilihProyek();
  if (galat) return <GagalMuat apa="Proyek" galat={galat} />;
  if (!semua) return <Rangka />;
  if (!asli) {
    return (
      <div className="mjc">
        <div className="mjc__papan mjc__papan--kosong">
          <p className="mjc__tanpa">
            {id ? "Proyek ini tidak ditemukan — mungkin sudah dihapus." : "Belum ada proyek."}{" "}
            <a href="/admin/proyek">Buka Semua Proyek</a>
          </p>
        </div>
      </div>
    );
  }
  /* key: pindah proyek = meja dibereskan — draf, pilihan, dan slide dari
     proyek lain tidak boleh terbawa. */
  return <Meja key={asli.id} asli={asli} semua={semua} setSemua={setSemua} pilih={pilih} dibangunPada={dibangunPada} />;
}

function Meja({
  asli,
  semua,
  setSemua,
  pilih,
  dibangunPada,
}: {
  asli: Proyek;
  semua: Proyek[];
  setSemua: (f: (s: Proyek[] | null) => Proyek[] | null) => void;
  pilih: (id: string) => void;
  dibangunPada?: string;
}) {
  const toast = useToast();
  const [draf, setDraf] = useState<Draf>({});
  const [pratinjauSampul, setPratinjauSampul] = useState<string | null>(null);
  const [menyimpan, setMenyimpan] = useState(false);
  const [mengunggahSampul, setMengunggahSampul] = useState(false);
  const [halaman, setHalaman] = useState<Halaman>("data");
  const [halamanGerak, setHalamanGerak] = useState(0);
  /* Dua sumber sorotan: menyentuh BENDA (slide, sampul, papan sampel) hanya
     mengarsir denah; menyentuh DENAH menyalakan bendanya juga. Kalau satu
     state, kursor yang sekadar lewat di atas deret slide menyalakan cincin
     di kesepuluh slide. */
  const [sorotArah, setSorotArah] = useState<Zona | null>(null);
  const [sorotDenah, setSorotDenah] = useState<Zona | null>(null);
  const [fokusZona, setFokusZona] = useState<Zona | null>(null);
  const [setelan, setSetelan] = useState<StudioSettings | null>(() => bacaCache<StudioSettings>("settings"));
  const [rasio, setRasio] = useState<Record<string, number>>({});
  const [diseret, setDiseret] = useState<"meja" | "sampul" | "bahan" | null>(null);
  const [terpilih, setTerpilih] = useState<string | null>(null);
  const [terpilihBahan, setTerpilihBahan] = useState<string | null>(null);
  const [lingkarBaru, setLingkarBaru] = useState(false);
  const [tercap, setTercap] = useState(false);

  const galeri = useFoto(asli, "galeri", toast);
  const bahan = useFoto(asli, "material", toast);

  const kacaRef = useRef<HTMLDivElement>(null);
  const deretRef = useRef<HTMLOListElement>(null);
  const deretBahanRef = useRef<HTMLOListElement>(null);
  const bingkaiSampulRef = useRef<HTMLDivElement>(null);
  const terbangRef = useRef<DOMRect | null>(null);
  const masukBerkas = useRef<HTMLInputElement>(null);
  const masukBahan = useRef<HTMLInputElement>(null);
  const masukSampul = useRef<HTMLInputElement>(null);
  const lembarRef = useRef<HTMLDivElement>(null);

  /* Info Studio DIBACA saja — kunci cache `settings` milik halaman Info
     Studio (jebakan #8). */
  useEffect(() => {
    ambilSettings()
      .then(setSetelan)
      .catch(() => {});
  }, []);

  const berubah = (Object.keys(draf) as (keyof Draf)[]).filter((k) => draf[k] !== (asli as Draf)[k]);
  const adaPerubahan = berubah.length > 0;
  useCegahPindah(adaPerubahan);

  const set = <K extends keyof Draf>(k: K, v: Draf[K]) => setDraf((d) => ({ ...d, [k]: v }));
  const nilai = <K extends keyof Draf>(k: K): Draf[K] | undefined =>
    (k in draf ? draf[k] : (asli as Draf)[k]) as Draf[K] | undefined;
  const teks = (k: keyof Draf) => String(nilai(k) ?? "");
  const pensil = (k: keyof Draf) => berubah.includes(k);

  /* ---- Turunan ------------------------------------------------------------- */
  const studio = setelan?.studioName?.trim() || "Dirga Pahlevi Architecture";
  const kode = kodeProyek(asli.title);
  const judul = teks("title") || asli.title;
  const status = String(nilai("status") ?? "draft");
  const unggulan = Boolean(nilai("isFeatured"));
  const urlSampul = pratinjauSampul ?? ((nilai("coverImageUrl") as string | undefined) || null);
  const kunciSampul = (nilai("coverImageKey") as string | undefined) ?? null;
  const adaSampul = Boolean(urlSampul || kunciSampul);
  const daftarGaleri = galeri.daftar ?? [];
  const daftarBahan = bahan.daftar ?? [];
  const slideSampul = daftarGaleri.find((g) =>
    kunciSampul ? g.storageKey === kunciSampul : Boolean(asli.coverImageUrl && g.url === asli.coverImageUrl),
  );
  const paragraf = paragrafDari(teks("description"));
  const subjudulSama = teks("subtitle").trim() !== "" && !subjudulBerguna({ title: judul, subtitle: teks("subtitle") });
  const kredit = [
    { k: "leadArchitect" as const, label: "Arsitektur", kosong: studio, tunggu: false },
    { k: "photographer" as const, label: "Fotografi", kosong: BELUM_ADA, tunggu: true },
    { k: "contractor" as const, label: "Kontraktor", kosong: BELUM_ADA, tunggu: true },
    { k: "lightingDesigner" as const, label: "Pencahayaan", kosong: BELUM_ADA, tunggu: true },
    { k: "client" as const, label: "Klien", kosong: "Tidak disebutkan atas permintaan klien", tunggu: true },
  ];
  const menyusul = kredit.filter((c) => !teks(c.k).trim()).filter((c) => c.tunggu);
  const lokasiTampil = teks("location") || teks("city");

  /* Urutan di beranda: proyek terbit, yang diunggulkan lebih dulu, lalu
     tahun terbaru — aturan yang sama dengan `sorot` di index.astro. */
  const tahunDari = (p: Proyek) => p.year ?? (p.publishedAt ? new Date(p.publishedAt).getFullYear() : 0);
  const versiKini = { ...asli, ...draf } as Proyek;
  const terbitan = semua
    .map((p) => (p.id === asli.id ? versiKini : p))
    .filter((p) => p.status === "published")
    .sort((a, b) => Number(b.isFeatured) - Number(a.isFeatured) || tahunDari(b) - tahunDari(a));
  const urutBeranda = terbitan.findIndex((p) => p.id === asli.id);
  const unggulanLain = semua.filter((p) => p.id !== asli.id && p.isFeatured && p.status === "published").length;

  /* Keadaan TAYANG dibaca dari yang tersimpan, bukan dari draf. */
  const keadaan: { nada: string; teks: string } =
    asli.status === "published"
      ? sudahDibangun(asli.publishedAt, dibangunPada)
        ? { nada: "tayang", teks: "Tayang di situs" }
        : { nada: "tunggu", teks: "Belum tayang — tekan Terbitkan" }
      : asli.status === "archived"
        ? { nada: "mati", teks: "Arsip — disembunyikan" }
        : { nada: "mati", teks: "Draf — tidak tampil" };
  const bisaDilihat = asli.status === "published" && sudahDibangun(asli.publishedAt, dibangunPada);

  const rasioSampul = urlSampul ? rasio[urlSampul] : undefined;
  const potongSampul = potong(rasioSampul ?? RASIO, RASIO);
  const potongBagikan = potong(rasioSampul ?? RASIO, RASIO_BAGIKAN);

  const zona: Record<Zona, { ada: boolean; ket: string }> = {
    kepala: { ada: true, ket: `Judul${subjudulBerguna({ title: judul, subtitle: teks("subtitle") }) ? " dan subjudul" : ""} — juga di beranda, daftar karya, dan tab peramban` },
    fakta: { ada: true, ket: `Fakta: ${[lokasiTampil && "lokasi", teks("year") && "selesai", "jenis", teks("areaSqm") && "luas"].filter(Boolean).join(", ")}` },
    sampul: { ada: adaSampul, ket: adaSampul ? "Sampul 16:9 — juga di beranda, daftar karya, kartu bagikan" : "Sampul — belum ada, proyek tidak bisa terbit" },
    cerita: { ada: paragraf.length > 0, ket: paragraf.length ? `Tentang proyek · ${paragraf.length} paragraf` : "Tentang proyek — tidak tampil, deskripsi kosong" },
    material: { ada: daftarBahan.length > 0, ket: daftarBahan.length ? `Material · ${daftarBahan.length}` : "Material — tidak tampil, belum ada sampel" },
    galeri: { ada: daftarGaleri.length > 0, ket: daftarGaleri.length ? `Galeri · ${daftarGaleri.length} foto` : "Galeri — tidak tampil, belum ada foto" },
    kredit: { ada: true, ket: menyusul.length ? `Kredit · ${menyusul.length} tampil "${BELUM_ADA}"` : "Kredit · lengkap" },
  };
  const sorot = sorotDenah ?? sorotArah ?? fokusZona;

  /* ---- Aksi ---------------------------------------------------------------- */
  async function gantiProyek(baru: string) {
    if (baru === asli.id) return;
    if (
      adaPerubahan &&
      !(await tanya({ judul: "Pindah proyek?", isi: `Ada ${berubah.length} perubahan yang belum disimpan.`, ya: "Tinggalkan", bahaya: true }))
    )
      return;
    pilih(baru);
  }

  async function simpan() {
    if (!adaPerubahan || menyimpan) return;
    setMenyimpan(true);
    try {
      /* Hanya kolom yang berubah: selain hemat, dua orang yang menyunting
         bersamaan tidak saling menimpa kolom yang tidak mereka sentuh. */
      const patch: Record<string, unknown> = {};
      berubah.forEach((k) => {
        patch[k] = draf[k];
      });
      await simpanProyek(asli.id, patch as Partial<Proyek>);
      const baru = { ...asli, ...draf } as Proyek & { coverImageKey?: string };
      delete baru.coverImageKey;
      if (pratinjauSampul) baru.coverImageUrl = pratinjauSampul;
      setSemua((s) => s?.map((p) => (p.id === asli.id ? baru : p)) ?? s);
      setDraf({});
      setTercap(true);
      window.setTimeout(() => setTercap(false), 900);
      toast({ judul: "Perubahan disimpan", keterangan: "Situs publik baru berubah setelah Terbitkan ditekan.", nada: "sukses" });
    } catch (e) {
      toast({ judul: "Gagal menyimpan", keterangan: (e as Error).message, nada: "gagal" });
    } finally {
      setMenyimpan(false);
    }
  }

  async function unggahSampul(f: File) {
    setMengunggahSampul(true);
    try {
      const kecil = await kecilkanFoto(f);
      const target = await mintaUrlUnggah(asli.slug, kecil.berkas.type);
      const res = await fetch(target.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": kecil.berkas.type },
        body: kecil.berkas,
      });
      if (!res.ok) throw new Error(`Penyimpanan menolak berkas (${res.status})`);
      set("coverImageKey", target.key);
      setPratinjauSampul((l) => {
        if (l && l.startsWith("blob:")) URL.revokeObjectURL(l);
        return URL.createObjectURL(f);
      });
      setLingkarBaru(false);
      toast({ judul: "Sampul terunggah", keterangan: "Tekan Simpan untuk memasangnya.", nada: "sukses" });
    } catch (e) {
      toast({ judul: "Gagal mengunggah sampul", keterangan: (e as Error).message, nada: "gagal" });
    } finally {
      setMengunggahSampul(false);
    }
  }

  function jadikanSampul(g: GambarProyek) {
    /* Foto terbang dari jendela slide ke selongsong sampul: kotak asalnya
       dibaca sekarang, sebelum sampul berganti. */
    const jendela = deretRef.current?.querySelector<HTMLElement>(`[data-urut="${CSS.escape(g.id)}"] .mjc__jendela`);
    terbangRef.current = jendela && geraknya() ? jendela.getBoundingClientRect() : null;
    set("coverImageKey", g.storageKey);
    setPratinjauSampul((l) => {
      if (l && l.startsWith("blob:")) URL.revokeObjectURL(l);
      return g.url;
    });
    setLingkarBaru(true);
  }

  /* Penerbangan dijalankan sesudah sampul baru terpasang. */
  useLayoutEffect(() => {
    const dari = terbangRef.current;
    const ke = bingkaiSampulRef.current;
    terbangRef.current = null;
    if (!dari || !ke) return;
    const r = ke.getBoundingClientRect();
    if (!r.width) return;
    const s = dari.width / r.width;
    const dx = dari.left - r.left;
    const dy = dari.top + (dari.height - r.height * s) / 2 - r.top;
    ke.animate(
      [
        { transform: `translate(${dx}px, ${dy}px) scale(${s})`, boxShadow: "0 0 0 0 transparent" },
        { transform: `translate(${dx * 0.45}px, ${dy * 0.45 - 26}px) scale(${(s + 1) / 2}) rotate(-1.5deg)`, offset: 0.55 },
        { transform: "none" },
      ],
      { duration: 620, easing: LEMBUT },
    );
  }, [urlSampul]);

  /* ---- Pilihan slide & material ------------------------------------------- */
  const iTerpilih = daftarGaleri.findIndex((g) => g.id === terpilih);
  const slide = iTerpilih >= 0 ? daftarGaleri[iTerpilih]! : null;
  const iBahan = daftarBahan.findIndex((g) => g.id === terpilihBahan);
  const sampel = iBahan >= 0 ? daftarBahan[iBahan]! : null;

  async function hapusFoto(g: GambarProyek, jenis: "galeri" | "material") {
    const nama = jenis === "galeri" ? `foto ${dua(daftarGaleri.indexOf(g) + 1)}` : `sampel "${g.caption || "tanpa nama"}"`;
    if (!(await tanya({ judul: `Hapus ${nama}?`, isi: "Tidak bisa dikembalikan.", ya: "Ya, hapus", bahaya: true }))) return;
    const wadah = jenis === "galeri" ? deretRef.current : deretBahanRef.current;
    const el = wadah?.querySelector<HTMLElement>(`[data-urut="${CSS.escape(g.id)}"]`);
    if (el && geraknya()) {
      await el
        .animate([{ transform: "none", opacity: 1 }, { transform: "translateY(-14px) scale(0.96)", opacity: 0 }], { duration: 200, easing: "ease-in", fill: "forwards" })
        .finished.catch(() => {});
    }
    const daftar = jenis === "galeri" ? daftarGaleri : daftarBahan;
    const i = daftar.indexOf(g);
    const lanjut = daftar[i + 1] ?? daftar[i - 1] ?? null;
    if (jenis === "galeri") {
      setTerpilih(lanjut?.id ?? null);
      await galeri.hapus(g);
    } else {
      setTerpilihBahan(lanjut?.id ?? null);
      await bahan.hapus(g);
    }
  }

  /* ---- Seret berkas dari komputer ------------------------------------------ */
  const adaBerkas = (e: DragEvent) => [...e.dataTransfer.types].includes("Files");
  const seretMasuk = (tempat: "meja" | "sampul" | "bahan") => (e: DragEvent) => {
    if (!adaBerkas(e)) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "copy";
    if (diseret !== tempat) setDiseret(tempat);
  };
  const seretKeluar = (e: DragEvent) => {
    const ke = e.relatedTarget as Node | null;
    if (ke && (e.currentTarget as HTMLElement).contains(ke)) return;
    setDiseret(null);
  };
  const lepasBerkas = (tempat: "meja" | "sampul" | "bahan") => (e: DragEvent) => {
    if (!adaBerkas(e)) return;
    e.preventDefault();
    e.stopPropagation();
    setDiseret(null);
    const files = [...e.dataTransfer.files].filter((f) => f.type.startsWith("image/"));
    if (!files.length) return;
    if (tempat === "sampul") void unggahSampul(files[0]!);
    else if (tempat === "bahan") void bahan.unggah(files);
    else void galeri.unggah(files);
  };

  /* ---- Lembar: fokus isian menandai bagian denah --------------------------- */
  const fokusMasuk = (e: RFocusEvent) => {
    const z = (e.target as HTMLElement).closest<HTMLElement>("[data-zona]")?.dataset.zona as Zona | undefined;
    setFokusZona(z ?? null);
  };
  const fokusKeluar = (e: RFocusEvent) => {
    if (!lembarRef.current?.contains(e.relatedTarget as Node | null)) setFokusZona(null);
  };

  function gantiHalaman(h: Halaman) {
    if (h === halaman) return;
    setHalaman(h);
    setHalamanGerak((n) => n + 1);
  }

  /* Klik bagian denah = pergi ke tempat mengisinya. */
  function lompat(z: Zona) {
    const fokus = (sel: string) => window.requestAnimationFrame(() => document.querySelector<HTMLElement>(sel)?.focus());
    if (z === "sampul") return fokus(adaSampul ? "#mjc-ganti-sampul" : ".mjc__sampulkosong");
    if (z === "galeri") return fokus(".mjc__deret .mjc__slide, .mjc__taruh");
    if (z === "material") return fokus(".mjc__bahan .mjc__sampelbtn, .mjc__tambahbahan");
    if (z === "cerita") {
      gantiHalaman("cerita");
      return fokus("#mjc-deskripsi");
    }
    gantiHalaman("data");
    fokus(z === "kepala" ? "#mjc-judul" : z === "fakta" ? "#mjc-lokasi" : "#mjc-arsitek");
  }

  const menu = [
    {
      items: [
        {
          label: "Lihat di situs",
          ikon: Globe,
          disabled: !bisaDilihat,
          onSelect: () => window.open(`/proyek/${asli.slug}`, "_blank", "noopener"),
        },
        { label: "Map proyek", ikon: ArsOrdner, onSelect: () => void navigate(`/admin/proyek?id=${encodeURIComponent(asli.id)}`) },
        { label: "Portal klien", ikon: ArsKunciRumah, onSelect: () => void navigate(`/admin/proyek/klien?id=${encodeURIComponent(asli.id)}`) },
      ],
    },
    {
      items: [
        {
          label: "Hapus proyek",
          ikon: Trash,
          danger: true,
          onSelect: async () => {
            if (
              !(await tanya({
                judul: `Hapus ${asli.title}?`,
                isi: "Gambar, tagihan, pembayaran, dan biayanya ikut terhapus.",
                ya: "Ya, hapus",
                bahaya: true,
              }))
            )
              return;
            try {
              await hapusProyek(asli.id);
              /* Dititipkan ke halaman tujuan, dan pindahnya lewat router —
                 toast di halaman ini lenyap bersama islandnya (jebakan #40). */
              titipToast({
                judul: "Proyek dihapus",
                keterangan: `${asli.title} beserta gambarnya. Tekan Terbitkan supaya halamannya ikut hilang dari situs.`,
                nada: "sukses",
              });
              await navigate("/admin/proyek");
            } catch (e) {
              toast({ judul: "Gagal menghapus", keterangan: (e as Error).message, nada: "gagal" });
            }
          },
        },
      ],
    },
  ];

  const kelasPapan = ["mjc__papan", diseret ? `is-seret-${diseret}` : "", sorotDenah ? `is-sorot-${sorotDenah}` : ""].filter(Boolean).join(" ");

  return (
    <div className="mjc">
      <div className={kelasPapan}>
        {/* ---- Kop ----------------------------------------------------------- */}
        <header className="mjc__kop">
          <div className="mjc__kopjudul">
            <p>
              Meja cahaya · publikasi karya · No. <b>{kode}</b>
            </p>
            <PilihMenu
              label="Pilih proyek"
              nilai={asli.id}
              opsi={semua.map((p) => ({ nilai: p.id, label: p.title }))}
              onUbah={(v) => void gantiProyek(v)}
              pemicu={
                <button type="button" className={`mjc__proyek${pensil("title") ? " is-pensil" : ""}`}>
                  <h2>{judul}</h2>
                  <Ikon ikon={CaretDown} ukuran={16} />
                </button>
              }
            />
          </div>

          <PelatSaklar
            status={status}
            onStatus={(v) => {
              if (v === "published" && !adaSampul) {
                toast({ judul: "Belum bisa terbit", keterangan: "Pasang sampul dulu.", nada: "gagal" });
                return;
              }
              set("status", v);
            }}
            adaSampul={adaSampul}
            pensilStatus={pensil("status")}
            unggulan={unggulan}
            onUnggulan={() => set("isFeatured", !unggulan)}
            pensilUnggulan={pensil("isFeatured")}
            ketUnggulan={
              status !== "published"
                ? "Beranda — tampil sesudah proyek terbit"
                : `Beranda — urutan ke-${urutBeranda + 1} dari ${terbitan.length}${unggulan ? "" : unggulanLain ? ` · ${unggulanLain} proyek lain diunggulkan` : ""}`
            }
            urutBeranda={status === "published" ? urutBeranda + 1 : null}
          />

          <div className={`mjc__tayang is-${keadaan.nada}`}>
            {bisaDilihat ? (
              <a href={`/proyek/${asli.slug}`} target="_blank" rel="noreferrer" className="mjc__alamat">
                /proyek/{asli.slug}
                <Ikon ikon={Globe} ukuran={12} />
              </a>
            ) : (
              <span className="mjc__alamat">/proyek/{asli.slug}</span>
            )}
            <span className="mjc__keadaan">
              <i aria-hidden="true" />
              {keadaan.teks}
            </span>
          </div>

          <div className={`mjc__simpan${tercap ? " is-tercap" : ""}`}>
            <Tombol
              memuat={menyimpan}
              ukuran="medium"
              jenis="primary"
              kiri={adaPerubahan || menyimpan ? undefined : Check}
              disabled={!adaPerubahan || menyimpan}
              onClick={() => void simpan()}
              title={adaPerubahan ? `${berubah.length} isian ditulis pensil — simpan supaya jadi tinta` : "Semua isian sudah tinta"}
            >
              {menyimpan ? "Menyimpan…" : adaPerubahan ? `Simpan ${berubah.length} perubahan` : "Tersimpan"}
            </Tombol>
          </div>

          <DropdownMenu
            sections={menu}
            trigger={
              <button type="button" className="mjc__menu" aria-label="Menu proyek">
                <Ikon ikon={DotsThree} ukuran={20} />
              </button>
            }
          />
        </header>

        {/* ---- Papan sampel material --------------------------------------- */}
        <PapanSampel
          foto={bahan}
          daftarRef={deretBahanRef}
          terpilih={terpilihBahan}
          onPilih={setTerpilihBahan}
          sampel={sampel}
          iSampel={iBahan}
          diseret={diseret === "bahan"}
          onDragOver={seretMasuk("bahan")}
          onDragLeave={seretKeluar}
          onDrop={lepasBerkas("bahan")}
          onTambah={() => masukBahan.current?.click()}
          onHapus={(g) => void hapusFoto(g, "material")}
          onSorot={setSorotArah}
        />

        {/* ---- Meja cahaya ---------------------------------------------------- */}
        <section className="mjc__meja" aria-label="Meja cahaya — sampul dan galeri">
          <div
            ref={kacaRef}
            className={`mjc__kaca${diseret === "meja" ? " is-seret" : ""}`}
            onDragOver={seretMasuk("meja")}
            onDragLeave={seretKeluar}
            onDrop={lepasBerkas("meja")}
            onClick={(e) => {
              if (e.target === e.currentTarget) setTerpilih(null);
            }}
          >
            <Sampul
              url={urlSampul}
              judul={judul}
              rasio={rasioSampul}
              potongan={potongSampul}
              bagikan={potongBagikan}
              slideSampul={slideSampul ? daftarGaleri.indexOf(slideSampul) + 1 : null}
              pensilSampul={pensil("coverImageKey")}
              mengunggah={mengunggahSampul}
              diseret={diseret === "sampul"}
              bingkaiRef={bingkaiSampulRef}
              onRasio={(u, r) => setRasio((m) => (m[u] === r ? m : { ...m, [u]: r }))}
              onDragOver={seretMasuk("sampul")}
              onDragLeave={seretKeluar}
              onDrop={lepasBerkas("sampul")}
              onPilihBerkas={() => masukSampul.current?.click()}
              onSorot={setSorotArah}
            />
            <DeretSlide
              foto={galeri}
              deretRef={deretRef}
              terpilih={terpilih}
              onPilih={setTerpilih}
              rasio={rasio}
              onRasio={(u, r) => setRasio((m) => (m[u] === r ? m : { ...m, [u]: r }))}
              idSampul={slideSampul?.id ?? null}
              lingkarBaru={lingkarBaru}
              pensilSampul={pensil("coverImageKey")}
              onTaruh={() => masukBerkas.current?.click()}
              onSorot={setSorotArah}
            />
          </div>
          <BakiSlide
            slide={slide}
            i={iTerpilih}
            n={daftarGaleri.length}
            mengunggah={galeri.mengunggah}
            adalahSampul={Boolean(slide && slide.id === slideSampul?.id)}
            onSimpanKet={(g, c) => void galeri.keterangan(g, c)}
            onGeser={(arah) => {
              if (iTerpilih < 0) return;
              void galeri.pindah(iTerpilih, iTerpilih + arah);
            }}
            onJadikanSampul={() => slide && jadikanSampul(slide)}
            onPerbesar={() =>
              bukaLightbox(
                daftarGaleri.map((x) => ({ url: x.url, caption: x.caption, altText: x.altText })),
                Math.max(0, iTerpilih),
              )
            }
            onHapus={() => slide && void hapusFoto(slide, "galeri")}
            onTutup={() => setTerpilih(null)}
            onUnggah={() => masukBerkas.current?.click()}
          />
          <input
            ref={masukBerkas}
            type="file"
            multiple
            className="sr-only"
            tabIndex={-1}
            aria-label="Pilih foto galeri untuk diunggah"
            accept="image/jpeg,image/png,image/webp,image/avif"
            onChange={(e) => {
              if (e.currentTarget.files) void galeri.unggah(e.currentTarget.files);
              e.currentTarget.value = "";
            }}
          />
          <input
            ref={masukSampul}
            type="file"
            className="sr-only"
            tabIndex={-1}
            aria-label="Pilih gambar sampul proyek"
            accept="image/jpeg,image/png,image/webp,image/avif"
            onChange={(e) => {
              const b = e.currentTarget.files?.[0];
              if (b) void unggahSampul(b);
              e.currentTarget.value = "";
            }}
          />
          <input
            ref={masukBahan}
            type="file"
            multiple
            className="sr-only"
            tabIndex={-1}
            aria-label="Pilih foto sampel material untuk diunggah"
            accept="image/jpeg,image/png,image/webp,image/avif"
            onChange={(e) => {
              if (e.currentTarget.files) void bahan.unggah(e.currentTarget.files);
              e.currentTarget.value = "";
            }}
          />
        </section>

        {/* ---- Lembar data karya -------------------------------------------- */}
        <LembarData
          lembarRef={lembarRef}
          halaman={halaman}
          halamanGerak={halamanGerak}
          onHalaman={gantiHalaman}
          kode={kode}
          studio={studio}
          judul={judul}
          teks={teks}
          set={set}
          pensil={pensil}
          subjudulSama={subjudulSama}
          paragraf={paragraf}
          kredit={kredit}
          menyusul={menyusul.length}
          zona={zona}
          sorot={sorot}
          sorotDenah={sorotDenah}
          onSorot={setSorotDenah}
          onLompat={lompat}
          onFokus={fokusMasuk}
          onLepasFokus={fokusKeluar}
          urlSampul={urlSampul}
          potongBagikan={potongBagikan}
          rasioSampul={rasioSampul}
          slug={teks("slug") || asli.slug}
        />
      </div>
    </div>
  );
}

/* ---- Pelat saklar: status terbit + beranda ------------------------------------------ */

function PelatSaklar({
  status,
  onStatus,
  adaSampul,
  pensilStatus,
  unggulan,
  onUnggulan,
  pensilUnggulan,
  ketUnggulan,
  urutBeranda,
}: {
  status: string;
  onStatus: (v: string) => void;
  adaSampul: boolean;
  pensilStatus: boolean;
  unggulan: boolean;
  onUnggulan: () => void;
  pensilUnggulan: boolean;
  ketUnggulan: string;
  urutBeranda: number | null;
}) {
  const tuts = useRef<(HTMLButtonElement | null)[]>([]);
  /* Pola radio ARIA: satu tab-stop, panah memindah DAN memilih. Terbit tanpa
     sampul dilewati. */
  function tombol(e: KeyboardEvent, i: number) {
    const arah = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!arah && e.key !== "Home" && e.key !== "End") return;
    e.preventDefault();
    let j = e.key === "Home" ? 0 : e.key === "End" ? STATUS.length - 1 : (i + arah + STATUS.length) % STATUS.length;
    if (STATUS[j]!.nilai === "published" && !adaSampul) j = (j + (arah || 1) + STATUS.length) % STATUS.length;
    onStatus(STATUS[j]!.nilai);
    tuts.current[j]?.focus();
  }
  return (
    <div className="mjc__pelat">
      <div className={`mjc__saklar${pensilStatus ? " is-pensil" : ""}`} role="radiogroup" aria-label="Status terbit">
        {STATUS.map((s, i) => {
          const pilih = status === s.nilai;
          const mati = s.nilai === "published" && !adaSampul;
          return (
            <button
              key={s.nilai}
              ref={(el) => {
                tuts.current[i] = el;
              }}
              type="button"
              role="radio"
              aria-checked={pilih}
              aria-disabled={mati || undefined}
              tabIndex={pilih ? 0 : -1}
              className={`mjc__tuts is-${s.nilai}${pilih ? " is-nyala" : ""}${mati ? " is-mati" : ""}`}
              title={mati ? "Pasang sampul dulu — proyek tanpa sampul tidak bisa terbit" : s.ket}
              onClick={() => onStatus(s.nilai)}
              onKeyDown={(e) => tombol(e, i)}
            >
              <i className="mjc__lampu" aria-hidden="true" />
              <span>{s.label}</span>
            </button>
          );
        })}
      </div>
      <button
        type="button"
        aria-pressed={unggulan}
        className={`mjc__tuts mjc__tuts--beranda${unggulan ? " is-nyala" : ""}${pensilUnggulan ? " is-pensil" : ""}`}
        title={ketUnggulan}
        onClick={onUnggulan}
      >
        <i className="mjc__lampu" aria-hidden="true" />
        <span>Beranda</span>
        {urutBeranda !== null && <b aria-hidden="true">{urutBeranda}</b>}
      </button>
    </div>
  );
}

/* ---- Sampul: selongsong hitam + dua siku potong ------------------------------------- */

function Sampul({
  url,
  judul,
  rasio,
  potongan,
  bagikan,
  slideSampul,
  pensilSampul,
  mengunggah,
  diseret,
  bingkaiRef,
  onRasio,
  onDragOver,
  onDragLeave,
  onDrop,
  onPilihBerkas,
  onSorot,
}: {
  url: string | null;
  judul: string;
  rasio: number | undefined;
  potongan: ReturnType<typeof potong>;
  bagikan: ReturnType<typeof potong>;
  slideSampul: number | null;
  pensilSampul: boolean;
  mengunggah: boolean;
  diseret: boolean;
  bingkaiRef: RefObject<HTMLDivElement | null>;
  onRasio: (url: string, r: number) => void;
  onDragOver: (e: DragEvent) => void;
  onDragLeave: (e: DragEvent) => void;
  onDrop: (e: DragEvent) => void;
  onPilihBerkas: () => void;
  onSorot: (z: Zona | null) => void;
}) {
  const [rusak, setRusak] = useState<string | null>(null);
  const a = rasio ?? RASIO;
  const pas = potongan.buang < 0.02;
  const gaya = {
    "--px": persen(potongan.x),
    "--py": persen(potongan.y),
    "--pw": persen(potongan.w),
    "--ph": persen(potongan.h),
  } as CSSProperties;

  return (
    <div
      className={`mjc__sampul${diseret ? " is-seret" : ""}${pensilSampul ? " is-pensil" : ""}`}
      style={{ "--mjc-a": String(url && rusak !== url ? a : RASIO) } as CSSProperties}
      data-zona="sampul"
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onPointerEnter={(e) => e.pointerType === "mouse" && onSorot("sampul")}
      onPointerLeave={(e) => e.pointerType === "mouse" && onSorot(null)}
    >
      <div className="mjc__selongsong">
        {url && rusak !== url ? (
          <div ref={bingkaiRef} className="mjc__bingkai" style={gaya}>
            <button
              type="button"
              className="mjc__foto"
              aria-label="Lihat sampul besar"
              onClick={() => bukaLightbox([{ url, caption: `Sampul — ${judul}`, altText: judul }], 0)}
            >
              <img
                src={url}
                alt={`Sampul ${judul}`}
                decoding="async"
                onLoad={(e) => {
                  const im = e.currentTarget;
                  if (im.naturalWidth && im.naturalHeight) onRasio(url, im.naturalWidth / im.naturalHeight);
                }}
                onError={() => setRusak(url)}
              />
              {/* Bagian yang terbuang di situs diredupkan. */}
              <span className="mjc__potong" aria-hidden="true" />
            </button>
            <span className="mjc__siku mjc__siku--a" aria-hidden="true" />
            <span className="mjc__siku mjc__siku--b" aria-hidden="true" />
          </div>
        ) : (
          <button
            type="button"
            className="mjc__sampulkosong"
            onClick={onPilihBerkas}
            disabled={mengunggah}
          >
            <Ikon ikon={mengunggah ? SpinnerGap : ImageSquare} ukuran={26} />
            <b>{mengunggah ? "Mengunggah sampul…" : rusak ? "Sampul tidak bisa dimuat — letakkan foto baru" : "Letakkan foto sampul"}</b>
          </button>
        )}
      </div>

      {/* Catatan di kaca, ditulis di samping transparansinya. */}
      <div className="mjc__catatan">
        <p className="mjc__catjudul">Sampul</p>
        {url ? (
          <>
            <p className="mjc__catbaris">
              {pensilSampul ? <em>belum disimpan</em> : slideSampul ? `dari slide ${dua(slideSampul)}` : "unggahan terpisah"}
            </p>
            <p className={`mjc__catbaris${pas ? "" : " is-potong"}`} title="Semua foto di situs dipotong 16:9 (object-fit: cover)">
              {rasio === undefined ? "16:9 · mengukur…" : pas ? "16:9 · pas" : `16:9 · −${persen(potongan.buang)} ${potongan.sisi}`}
            </p>
            <p className="mjc__catbaris mjc__catbaris--redup" title="Kartu bagikan WhatsApp/X dipotong 1200x630">
              bagikan 1,91:1{bagikan.buang >= 0.02 ? ` · −${persen(bagikan.buang)}` : " · pas"}
            </p>
            <button type="button" id="mjc-ganti-sampul" className="mjc__catbtn" onClick={onPilihBerkas} disabled={mengunggah}>
              <Ikon ikon={mengunggah ? SpinnerGap : ImageSquare} ukuran={13} />
              {mengunggah ? "Mengunggah…" : "Ganti sampul"}
            </button>
          </>
        ) : (
          <>
            <p className="mjc__catbaris is-potong">belum ada — wajib sebelum terbit</p>
            <p className="mjc__catbaris mjc__catbaris--redup">atau pilih slide lalu Jadikan sampul</p>
          </>
        )}
      </div>
    </div>
  );
}

/* ---- Deret slide: sepuluh slot di kaca ---------------------------------------------- */

function DeretSlide({
  foto,
  deretRef,
  terpilih,
  onPilih,
  rasio,
  onRasio,
  idSampul,
  lingkarBaru,
  pensilSampul,
  onTaruh,
  onSorot,
}: {
  foto: Foto;
  deretRef: RefObject<HTMLOListElement | null>;
  terpilih: string | null;
  onPilih: (id: string | null) => void;
  rasio: Record<string, number>;
  onRasio: (url: string, r: number) => void;
  idSampul: string | null;
  lingkarBaru: boolean;
  pensilSampul: boolean;
  onTaruh: () => void;
  onSorot: (z: Zona | null) => void;
}) {
  const daftar = foto.daftar ?? [];
  const ids = daftar.map((g) => g.id);
  const { seret, turun, tahanKlik } = useSeret(deretRef, ids, foto.izin, (dari, ke) => void foto.pindah(dari, ke));
  const tampil = seret ? pindahkan(daftar, seret.dari, seret.ke) : daftar;
  useFlip(deretRef, tampil.map((g) => g.id).join("|"), foto.izin, foto.baru, seret?.id ?? null);
  const tombol = useRef(new Map<string, HTMLButtonElement>());
  const [rusak, setRusak] = useState<Set<string>>(() => new Set());

  /* Satu tab-stop untuk seluruh deret: panah memindah pilihan, Alt+panah
     memindah slidenya, Home/End ke ujung. */
  function papanKetik(e: KeyboardEvent, i: number) {
    const kolom = 5;
    const lompatan: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -kolom, ArrowDown: kolom };
    if (e.key === "Escape") {
      onPilih(null);
      return;
    }
    if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      const g = daftar[e.key === "Home" ? 0 : daftar.length - 1];
      if (g) {
        onPilih(g.id);
        tombol.current.get(g.id)?.focus();
      }
      return;
    }
    const d = lompatan[e.key];
    if (d === undefined) return;
    e.preventDefault();
    if (e.altKey) {
      const ke = Math.max(0, Math.min(daftar.length - 1, i + d));
      if (ke !== i) void foto.pindah(i, ke).then(() => tombol.current.get(daftar[i]!.id)?.focus());
      return;
    }
    const j = Math.max(0, Math.min(daftar.length - 1, i + d));
    const g = daftar[j];
    if (g) {
      onPilih(g.id);
      tombol.current.get(g.id)?.focus();
    }
  }

  const fokusId = terpilih && ids.includes(terpilih) ? terpilih : ids[0];
  const slotKosong = MAKS - tampil.length;
  const memuat = foto.daftar === null;

  return (
    <ol
      ref={deretRef}
      className={`mjc__deret${seret ? " is-menyeret" : ""}`}
      aria-label={`Galeri — ${daftar.length} dari ${MAKS} foto, urutan sama dengan di situs`}
      onPointerEnter={(e) => e.pointerType === "mouse" && onSorot("galeri")}
      onPointerLeave={(e) => e.pointerType === "mouse" && onSorot(null)}
    >
      {tampil.map((g, i) => {
        const a = rasio[g.url];
        const c = a ? potong(a, RASIO) : null;
        const dipotong = c && c.buang >= 0.04 ? c : null;
        const pilih = g.id === terpilih;
        const sampul = g.id === idSampul;
        return (
          <li
            key={g.id}
            data-urut={g.id}
            className={`mjc__slot${pilih ? " is-terpilih" : ""}${seret?.id === g.id ? " is-diangkat" : ""}`}
            onPointerDown={(e) => turun(e, g.id)}
          >
            <button
              ref={(el) => {
                if (el) tombol.current.set(g.id, el);
                else tombol.current.delete(g.id);
              }}
              type="button"
              className="mjc__slide"
              aria-pressed={pilih}
              aria-label={`Slide ${dua(i + 1)}${g.caption ? ` — ${g.caption}` : ""}${sampul ? ", dipakai sebagai sampul" : ""}${dipotong ? `, dipotong ${persen(dipotong.buang)} ${dipotong.sisi} di situs` : ""}`}
              tabIndex={g.id === fokusId ? 0 : -1}
              onClick={() => {
                if (tahanKlik.current) return;
                onPilih(pilih ? null : g.id);
              }}
              onDoubleClick={() =>
                bukaLightbox(
                  daftar.map((x) => ({ url: x.url, caption: x.caption, altText: x.altText })),
                  daftar.indexOf(g),
                )
              }
              onKeyDown={(e) => papanKetik(e, daftar.indexOf(g))}
            >
              <span className="mjc__nomor">{dua(i + 1)}</span>
              {dipotong && (
                <span className="mjc__terpotong" title={`Di situs dipotong ${persen(dipotong.buang)} ${dipotong.sisi} (16:9)`}>
                  −{persen(dipotong.buang)}
                </span>
              )}
              <span className="mjc__jendela">
                {rusak.has(g.id) ? (
                  <span className="mjc__rusak">tidak bisa dimuat</span>
                ) : (
                  <img
                    src={g.thumbUrl ?? g.url}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    draggable={false}
                    onLoad={(e) => {
                      const im = e.currentTarget;
                      /* Rasio dari foto PENUH: thumbnail dibuat dari foto yang
                         sama, jadi rasionya sama. */
                      if (im.naturalWidth && im.naturalHeight) onRasio(g.url, im.naturalWidth / im.naturalHeight);
                    }}
                    onError={() => setRusak((s) => new Set(s).add(g.id))}
                  />
                )}
              </span>
              <span className={`mjc__ket${g.caption ? "" : " is-kosong"}`}>{g.caption || "tanpa keterangan"}</span>
              {/* Di DALAM bingkai, supaya ikut terangkat saat slide dipilih atau
                  disentuh — di luar bingkai, tepinya menyentuh nomor dan persen. */}
              {sampul && (
                <svg
                  className={`mjc__lingkar${lingkarBaru ? " is-digambar" : ""}${pensilSampul ? " is-pensil" : ""}`}
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  <path className="mjc__lingkargaris" d={LINGKAR} pathLength={1} />
                </svg>
              )}
            </button>
          </li>
        );
      })}
      {Array.from({ length: Math.max(0, slotKosong) }, (_, k) => {
        const n = tampil.length + k + 1;
        const unggahan = k < foto.mengunggah;
        const pertama = k === foto.mengunggah;
        return (
          <li key={`kosong-${n}`} className={`mjc__slot is-kosong${unggahan ? " is-unggah" : ""}`} aria-hidden={!pertama || undefined}>
            {/* Susunannya sama dengan slide berisi, supaya tingginya sama persis. */}
            <div className="mjc__slide mjc__slide--kosong">
              <span className="mjc__nomor mjc__nomor--kosong">{dua(n)}</span>
              <span className="mjc__jendela">
                {unggahan ? (
                  <span className="mjc__unggahan">
                    <Ikon ikon={SpinnerGap} ukuran={16} />
                    mengunggah
                  </span>
                ) : pertama && !memuat ? (
                  <button type="button" className="mjc__taruh" onClick={onTaruh}>
                    <Ikon ikon={Plus} ukuran={14} />
                    Letakkan foto
                  </button>
                ) : null}
              </span>
              <span className="mjc__ket" />
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/* ---- Baki depan meja: kendali slide terpilih --------------------------------------- */

function BakiSlide({
  slide,
  i,
  n,
  mengunggah,
  adalahSampul,
  onSimpanKet,
  onGeser,
  onJadikanSampul,
  onPerbesar,
  onHapus,
  onTutup,
  onUnggah,
}: {
  slide: GambarProyek | null;
  i: number;
  n: number;
  mengunggah: number;
  adalahSampul: boolean;
  onSimpanKet: (g: GambarProyek, caption: string) => void;
  onGeser: (arah: -1 | 1) => void;
  onJadikanSampul: () => void;
  onPerbesar: () => void;
  onHapus: () => void;
  onTutup: () => void;
  onUnggah: () => void;
}) {
  const [ket, setKet] = useState(slide?.caption ?? "");
  const [untuk, setUntuk] = useState(slide?.id ?? null);
  /* Keterangan ikut slide yang dipilih — dibandingkan saat RENDER, bukan di
     efek, supaya tidak ada satu bingkai keterangan slide lain. */
  if ((slide?.id ?? null) !== untuk) {
    setUntuk(slide?.id ?? null);
    setKet(slide?.caption ?? "");
  }

  if (!slide) {
    return (
      <div className="mjc__baki">
        <p className="mjc__bakiinfo">
          <b>
            Galeri <span>{n}</span>/{MAKS}
          </b>
          <span>{n === 0 ? "belum ada foto — galeri tidak tampil di situs" : `${MAKS - n} slot kosong · urutan = urutan di situs`}</span>
        </p>
        <button type="button" className="mjc__bakibtn mjc__bakibtn--utama" onClick={onUnggah} disabled={n >= MAKS}>
          <Ikon ikon={mengunggah ? SpinnerGap : Plus} ukuran={14} />
          {mengunggah ? `Mengunggah ${mengunggah}…` : n >= MAKS ? "Galeri penuh" : "Unggah foto"}
        </button>
      </div>
    );
  }

  const simpanKet = () => onSimpanKet(slide, ket.trim());
  return (
    <div className="mjc__baki is-terpilih">
      <span className="mjc__bakino" aria-hidden="true">
        {dua(i + 1)}
      </span>
      <input
        className="mjc__bakiket"
        value={ket}
        aria-label={`Keterangan slide ${dua(i + 1)}`}
        placeholder={`Keterangan slide ${dua(i + 1)}`}
        maxLength={160}
        onChange={(e) => setKet(e.currentTarget.value)}
        onBlur={simpanKet}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") {
            setKet(slide.caption ?? "");
            window.requestAnimationFrame(() => (e.target as HTMLInputElement).blur());
          }
        }}
      />
      <div className="mjc__bakialat">
        <button type="button" className="mjc__bakiikon" title="Majukan (Alt+←)" aria-label="Majukan slide" disabled={i <= 0} onClick={() => onGeser(-1)}>
          <Ikon ikon={CaretLeft} ukuran={14} />
        </button>
        <button type="button" className="mjc__bakiikon" title="Mundurkan (Alt+→)" aria-label="Mundurkan slide" disabled={i >= n - 1} onClick={() => onGeser(1)}>
          <Ikon ikon={CaretRight} ukuran={14} />
        </button>
        <button type="button" className="mjc__bakibtn" onClick={onJadikanSampul} disabled={adalahSampul}>
          {adalahSampul ? "Sudah sampul" : "Jadikan sampul"}
        </button>
        <button type="button" className="mjc__bakiikon" title="Perbesar" aria-label="Perbesar slide" onClick={onPerbesar}>
          <Ikon ikon={CornersOut} ukuran={14} />
        </button>
        <button type="button" className="mjc__bakiikon mjc__bakiikon--bahaya" title="Hapus foto" aria-label={`Hapus slide ${dua(i + 1)}`} onClick={onHapus}>
          <Ikon ikon={Trash} ukuran={14} />
        </button>
        <button type="button" className="mjc__bakiikon" title="Lepas pilihan (Esc)" aria-label="Lepas pilihan slide" onClick={onTutup}>
          <Ikon ikon={X} ukuran={14} />
        </button>
      </div>
    </div>
  );
}

/* ---- Papan sampel material --------------------------------------------------------- */

function PapanSampel({
  foto,
  daftarRef,
  terpilih,
  onPilih,
  sampel,
  iSampel,
  diseret,
  onDragOver,
  onDragLeave,
  onDrop,
  onTambah,
  onHapus,
  onSorot,
}: {
  foto: Foto;
  daftarRef: RefObject<HTMLOListElement | null>;
  terpilih: string | null;
  onPilih: (id: string | null) => void;
  sampel: GambarProyek | null;
  iSampel: number;
  diseret: boolean;
  onDragOver: (e: DragEvent) => void;
  onDragLeave: (e: DragEvent) => void;
  onDrop: (e: DragEvent) => void;
  onTambah: () => void;
  onHapus: (g: GambarProyek) => void;
  onSorot: (z: Zona | null) => void;
}) {
  const daftar = foto.daftar ?? [];
  const ids = daftar.map((g) => g.id);
  const { seret, turun, tahanKlik } = useSeret(daftarRef, ids, foto.izin, (dari, ke) => void foto.pindah(dari, ke));
  const tampil = seret ? pindahkan(daftar, seret.dari, seret.ke) : daftar;
  useFlip(daftarRef, tampil.map((g) => g.id).join("|"), foto.izin, foto.baru, seret?.id ?? null);
  const tombol = useRef(new Map<string, HTMLButtonElement>());
  const [nama, setNama] = useState(sampel?.caption ?? "");
  const [untuk, setUntuk] = useState(sampel?.id ?? null);
  if ((sampel?.id ?? null) !== untuk) {
    setUntuk(sampel?.id ?? null);
    setNama(sampel?.caption ?? "");
  }
  const fokusId = terpilih && ids.includes(terpilih) ? terpilih : ids[0];
  const memuat = foto.daftar === null;

  function papanKetik(e: KeyboardEvent, i: number) {
    if (e.key === "Escape") return onPilih(null);
    const d = e.key === "ArrowUp" ? -1 : e.key === "ArrowDown" ? 1 : 0;
    if (!d) return;
    e.preventDefault();
    if (e.altKey) {
      const ke = Math.max(0, Math.min(daftar.length - 1, i + d));
      if (ke !== i) void foto.pindah(i, ke).then(() => tombol.current.get(daftar[i]!.id)?.focus());
      return;
    }
    const g = daftar[Math.max(0, Math.min(daftar.length - 1, i + d))];
    if (g) {
      onPilih(g.id);
      tombol.current.get(g.id)?.focus();
    }
  }

  return (
    <section
      className={`mjc__sampel${diseret ? " is-seret" : ""}`}
      aria-labelledby="mjc-sampel-judul"
      data-zona="material"
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onPointerEnter={(e) => e.pointerType === "mouse" && onSorot("material")}
      onPointerLeave={(e) => e.pointerType === "mouse" && onSorot(null)}
    >
      <header className="mjc__sampelkop">
        <h3 id="mjc-sampel-judul">Sampel material</h3>
        <span>
          {daftar.length}/{MAKS}
        </span>
      </header>
      <ol ref={daftarRef} className="mjc__bahan">
        {tampil.map((g, i) => {
          const pilih = g.id === terpilih;
          return (
            <li
              key={g.id}
              data-urut={g.id}
              className={`mjc__bahanbaris${pilih ? " is-terpilih" : ""}${seret?.id === g.id ? " is-diangkat" : ""}`}
              onPointerDown={(e) => turun(e, g.id)}
            >
              <button
                ref={(el) => {
                  if (el) tombol.current.set(g.id, el);
                  else tombol.current.delete(g.id);
                }}
                type="button"
                className="mjc__sampelbtn"
                aria-pressed={pilih}
                tabIndex={g.id === fokusId ? 0 : -1}
                aria-label={`Sampel ${i + 1}: ${g.caption || "tanpa nama"}`}
                onClick={() => {
                  if (tahanKlik.current) return;
                  onPilih(pilih ? null : g.id);
                }}
                onKeyDown={(e) => papanKetik(e, daftar.indexOf(g))}
              >
                <span className="mjc__keping">
                  <img src={g.thumbUrl ?? g.url} alt="" loading="lazy" decoding="async" draggable={false} />
                </span>
                <span className={`mjc__bahannama${g.caption ? "" : " is-kosong"}`}>{g.caption || "tanpa nama"}</span>
              </button>
            </li>
          );
        })}
        {Array.from({ length: Math.max(0, MAKS - tampil.length) }, (_, k) => {
          const unggahan = k < foto.mengunggah;
          const pertama = k === foto.mengunggah;
          return (
            <li key={`kosong-${k}`} className={`mjc__bahanbaris is-kosong${unggahan ? " is-unggah" : ""}`} aria-hidden={!pertama || undefined}>
              {unggahan ? (
                <span className="mjc__unggahan">
                  <Ikon ikon={SpinnerGap} ukuran={14} />
                  mengunggah
                </span>
              ) : pertama && !memuat ? (
                <button type="button" className="mjc__tambahbahan" onClick={onTambah}>
                  <Ikon ikon={Plus} ukuran={13} />
                  Tambah
                </button>
              ) : (
                <span className="mjc__kepingkosong" />
              )}
            </li>
          );
        })}
      </ol>
      {sampel && (
        <div className="mjc__bakibahan">
            <input
              className="mjc__bahanisian"
              value={nama}
              aria-label="Nama material"
              placeholder="Nama material"
              maxLength={80}
              onChange={(e) => setNama(e.currentTarget.value)}
              onBlur={() => void foto.keterangan(sampel, nama.trim())}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
                if (e.key === "Escape") {
                  setNama(sampel.caption ?? "");
                  window.requestAnimationFrame(() => (e.target as HTMLInputElement).blur());
                }
              }}
            />
            <div className="mjc__bakialat">
              <button type="button" className="mjc__bakiikon" title="Naikkan (Alt+↑)" aria-label="Naikkan sampel" disabled={iSampel <= 0} onClick={() => void foto.pindah(iSampel, iSampel - 1)}>
                <Ikon ikon={CaretUp} ukuran={13} />
              </button>
              <button type="button" className="mjc__bakiikon" title="Turunkan (Alt+↓)" aria-label="Turunkan sampel" disabled={iSampel >= daftar.length - 1} onClick={() => void foto.pindah(iSampel, iSampel + 1)}>
                <Ikon ikon={CaretDown} ukuran={13} />
              </button>
              <button type="button" className="mjc__bakiikon mjc__bakiikon--bahaya" title="Hapus sampel" aria-label="Hapus sampel" onClick={() => onHapus(sampel)}>
                <Ikon ikon={Trash} ukuran={13} />
              </button>
              <button type="button" className="mjc__bakiikon" title="Lepas pilihan (Esc)" aria-label="Lepas pilihan sampel" onClick={() => onPilih(null)}>
                <Ikon ikon={X} ukuran={13} />
              </button>
            </div>
        </div>
      )}
    </section>
  );
}

/* ---- Lembar data karya --------------------------------------------------------------- */

const ZONA: { z: Zona; tinggi: number }[] = [
  { z: "kepala", tinggi: 10 },
  { z: "fakta", tinggi: 5 },
  { z: "sampul", tinggi: 21 },
  { z: "cerita", tinggi: 15 },
  { z: "material", tinggi: 7 },
  { z: "galeri", tinggi: 17 },
  { z: "kredit", tinggi: 9 },
];

/* Denah kunci halaman /proyek/<slug>: tiap bagian halaman satu ruang,
   tingginya kira-kira sebanding di situs. Bagian yang tidak akan tampil
   digambar putus; bagian yang sedang disentuh diarsir. */
function Denah({
  zona,
  sorot,
  onSorot,
  onLompat,
}: {
  zona: Record<Zona, { ada: boolean; ket: string }>;
  sorot: Zona | null;
  onSorot: (z: Zona | null) => void;
  onLompat: (z: Zona) => void;
}) {
  const tampil = ZONA.filter(({ z }) => zona[z].ada).length;
  return (
    <figure className="mjc__denah" aria-label={`Denah halaman proyek: ${tampil} dari ${ZONA.length} bagian tampil di situs`}>
      <figcaption aria-hidden="true">/proyek</figcaption>
      <div className="mjc__denahisi">
        {ZONA.map(({ z, tinggi }) => (
          <button
            key={z}
            type="button"
            tabIndex={-1}
            aria-hidden="true"
            className={`mjc__zona is-${z}${zona[z].ada ? "" : " is-kosong"}${sorot === z ? " is-sorot" : ""}`}
            style={{ flexGrow: tinggi }}
            title={zona[z].ket}
            onPointerEnter={(e) => e.pointerType === "mouse" && onSorot(z)}
            onPointerLeave={(e) => e.pointerType === "mouse" && onSorot(null)}
            onClick={() => onLompat(z)}
          />
        ))}
        <span className="mjc__zona is-lain" style={{ flexGrow: 6 }} aria-hidden="true" />
      </div>
    </figure>
  );
}

function LembarData({
  lembarRef,
  halaman,
  halamanGerak,
  onHalaman,
  kode,
  studio,
  judul,
  teks,
  set,
  pensil,
  subjudulSama,
  paragraf,
  kredit,
  menyusul,
  zona,
  sorot,
  sorotDenah,
  onSorot,
  onLompat,
  onFokus,
  onLepasFokus,
  urlSampul,
  potongBagikan,
  rasioSampul,
  slug,
}: {
  lembarRef: RefObject<HTMLDivElement | null>;
  halaman: Halaman;
  halamanGerak: number;
  onHalaman: (h: Halaman) => void;
  kode: string;
  studio: string;
  judul: string;
  teks: (k: keyof Draf) => string;
  set: <K extends keyof Draf>(k: K, v: Draf[K]) => void;
  pensil: (k: keyof Draf) => boolean;
  subjudulSama: boolean;
  paragraf: string[];
  kredit: { k: keyof Draf; label: string; kosong: string; tunggu: boolean }[];
  menyusul: number;
  zona: Record<Zona, { ada: boolean; ket: string }>;
  sorot: Zona | null;
  sorotDenah: Zona | null;
  onSorot: (z: Zona | null) => void;
  onLompat: (z: Zona) => void;
  onFokus: (e: RFocusEvent) => void;
  onLepasFokus: (e: RFocusEvent) => void;
  urlSampul: string | null;
  potongBagikan: ReturnType<typeof potong>;
  rasioSampul: number | undefined;
  slug: string;
}) {
  const tab = useRef<(HTMLButtonElement | null)[]>([]);
  const DAFTAR: { h: Halaman; label: string }[] = [
    { h: "data", label: "Data" },
    { h: "cerita", label: "Cerita" },
    { h: "cari", label: "Pencarian" },
  ];
  const nomorHal = DAFTAR.findIndex((d) => d.h === halaman) + 1;
  const isian = (k: keyof Draf, tambahan = "") => `mjc__isian${pensil(k) ? " is-pensil" : ""}${tambahan ? ` ${tambahan}` : ""}`;

  const judulCari = teks("seoTitle").trim() || judul;
  const ketCari = teks("seoDescription").trim() || teks("summary").trim();
  const ketCariTampil = ketCari.length > 158 ? `${ketCari.slice(0, 155).trimEnd()}…` : ketCari;
  const panjangJudul = `${judulCari} — ${studio}`.length;
  const lencanaCari = teks("seoTitle").length > 60 || teks("seoDescription").length > 160;

  function tombolTab(e: KeyboardEvent, i: number) {
    const arah = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!arah && e.key !== "Home" && e.key !== "End") return;
    e.preventDefault();
    const j = e.key === "Home" ? 0 : e.key === "End" ? DAFTAR.length - 1 : (i + arah + DAFTAR.length) % DAFTAR.length;
    onHalaman(DAFTAR[j]!.h);
    tab.current[j]?.focus();
  }

  const lencana: Record<Halaman, ReactNode> = {
    data: menyusul ? (
      <b className="mjc__tablencana is-amber" title={`${menyusul} kredit tampil "${BELUM_ADA}" di situs`}>
        {menyusul}
      </b>
    ) : null,
    cerita: (
      <b
        className={`mjc__tablencana${paragraf.length ? "" : " is-amber"}`}
        title={paragraf.length ? `${paragraf.length} paragraf di "Tentang proyek"` : "Tentang proyek tidak tampil — deskripsi kosong"}
      >
        {paragraf.length}¶
      </b>
    ),
    cari: lencanaCari ? (
      <b className="mjc__tablencana is-amber" title="Terlalu panjang — dipotong mesin pencari">
        !
      </b>
    ) : null,
  };
  const adaPensil: Record<Halaman, boolean> = {
    data: (["title", "subtitle", "slug", "location", "year", "category", "areaSqm", "city", "clientWhatsapp", "leadArchitect", "photographer", "contractor", "lightingDesigner", "client"] as (keyof Draf)[]).some(pensil),
    cerita: pensil("summary") || pensil("description"),
    cari: pensil("seoTitle") || pensil("seoDescription"),
  };

  return (
    <section
      className={`mjc__lembar${sorotDenah ? ` is-sorot-${sorotDenah}` : ""}`}
      aria-label="Lembar data karya"
      onFocusCapture={onFokus}
      onBlurCapture={onLepasFokus}
    >
      <div className="mjc__tumpuk" aria-hidden="true">
        <i />
        <i />
      </div>
      <div ref={lembarRef} className="mjc__kertas">
        <header className="mjc__lkop">
          <div className="mjc__lkopteks">
            <p className="mjc__ljudul">Lembar data karya</p>
            <p className="mjc__lno">
              No. <b>{kode}</b> · Hal. {nomorHal} dari 3
            </p>
            <p className="mjc__lstudio">{studio}</p>
            <div className="mjc__tab" role="tablist" aria-label="Halaman lembar data">
              {DAFTAR.map((d, i) => (
                <button
                  key={d.h}
                  ref={(el) => {
                    tab.current[i] = el;
                  }}
                  type="button"
                  role="tab"
                  id={`mjc-tab-${d.h}`}
                  aria-selected={halaman === d.h}
                  aria-controls={`mjc-hal-${d.h}`}
                  tabIndex={halaman === d.h ? 0 : -1}
                  data-tab={d.h}
                  className={`mjc__tabbtn${halaman === d.h ? " is-aktif" : ""}${adaPensil[d.h] ? " is-pensil" : ""}`}
                  onClick={() => onHalaman(d.h)}
                  onKeyDown={(e) => tombolTab(e, i)}
                >
                  {d.label}
                  {lencana[d.h]}
                </button>
              ))}
            </div>
          </div>
          <Denah zona={zona} sorot={sorot} onSorot={onSorot} onLompat={onLompat} />
        </header>

        {/* ---- Hal. 1: data & kredit ---------------------------------------- */}
        <div
          key={`data-${halaman === "data" ? halamanGerak : "x"}`}
          id="mjc-hal-data"
          role="tabpanel"
          aria-labelledby="mjc-tab-data"
          className={`mjc__hal${halamanGerak && halaman === "data" ? " is-masuk" : ""}`}
          hidden={halaman !== "data"}
        >
          <label className={isian("title", "mjc__isian--judul")} data-zona="kepala">
            <span>Nama karya</span>
            <input id="mjc-judul" value={teks("title")} onChange={(e) => set("title", e.currentTarget.value)} />
          </label>
          <label className={isian("subtitle", subjudulSama ? "is-amber" : "")} data-zona="kepala">
            <span>
              Subjudul
              {subjudulSama && <em>sama dengan judul — tidak ditampilkan</em>}
            </span>
            <input
              value={teks("subtitle")}
              placeholder="mis. Rumah yang menjaga kebunnya"
              onChange={(e) => set("subtitle", e.currentTarget.value)}
            />
          </label>
          <label className={isian("slug", "mjc__isian--alamat")} data-zona="kepala">
            <span>Alamat halaman</span>
            <span className="mjc__awalan">
              /proyek/
              <input value={teks("slug")} spellCheck={false} onChange={(e) => set("slug", e.currentTarget.value)} />
            </span>
          </label>

          {/* Empat sel fakta — persis baris LOKASI · SELESAI · JENIS · LUAS di situs. */}
          <div className="mjc__fakta" data-zona="fakta">
            <label className={isian("location")}>
              <span>Lokasi</span>
              <input
                id="mjc-lokasi"
                value={teks("location")}
                placeholder={teks("city") || "—"}
                onChange={(e) => set("location", e.currentTarget.value)}
              />
            </label>
            <label className={isian("year")}>
              <span>Selesai</span>
              <input
                inputMode="numeric"
                maxLength={4}
                value={teks("year")}
                placeholder="—"
                onChange={(e) => {
                  const v = e.currentTarget.value.replace(/\D/g, "");
                  set("year", v ? Number(v) : undefined);
                }}
              />
            </label>
            <div className={isian("category")}>
              <span id="mjc-jenis-label">Jenis</span>
              <PilihMenu
                label="Jenis proyek"
                nilai={teks("category") || "residential"}
                onUbah={(v) => set("category", v)}
                opsi={[
                  ...Object.entries(KATEGORI).map(([v, l]) => ({ nilai: v, label: l })),
                  ...(!KATEGORI[teks("category")] && teks("category") ? [{ nilai: teks("category"), label: teks("category") }] : []),
                ]}
                pemicu={
                  <button type="button" className="mjc__pilih" aria-labelledby="mjc-jenis-label">
                    <span>{KATEGORI[teks("category")] ?? (teks("category") || "Hunian")}</span>
                    <Ikon ikon={CaretDown} ukuran={12} />
                  </button>
                }
              />
            </div>
            <label className={isian("areaSqm", "mjc__isian--luas")}>
              <span>Luas</span>
              <span className="mjc__akhiran">
                <input
                  inputMode="numeric"
                  value={teks("areaSqm")}
                  placeholder="—"
                  onChange={(e) => {
                    const v = e.currentTarget.value.replace(/[^\d]/g, "");
                    set("areaSqm", v ? Number(v) : undefined);
                  }}
                />
                m²
              </span>
            </label>
          </div>

          <div className="mjc__dua" data-zona="fakta">
            <label className={isian("city")}>
              <span>Kota</span>
              <input value={teks("city")} placeholder="Pontianak" onChange={(e) => set("city", e.currentTarget.value)} />
            </label>
            <label className={isian("clientWhatsapp")} title="Tidak tampil di situs — dipakai tombol WhatsApp di bukti pembayaran">
              <span>
                WA klien <em className="mjc__internal">internal</em>
              </span>
              <input
                type="tel"
                inputMode="tel"
                value={teks("clientWhatsapp")}
                placeholder="628123456789"
                onChange={(e) => set("clientWhatsapp", e.currentTarget.value)}
              />
            </label>
          </div>

          <div className="mjc__kredit" data-zona="kredit">
            <p className="mjc__kreditkop">
              Kredit
              {menyusul > 0 && <em>{menyusul} menyusul</em>}
            </p>
            {kredit.map((c) => {
              const kosong = !teks(c.k).trim();
              return (
                <label key={c.k} className={isian(c.k, `mjc__kreditbaris${kosong && c.tunggu ? " is-tunggu" : ""}`)}>
                  <span>{c.label}</span>
                  <input
                    id={c.k === "leadArchitect" ? "mjc-arsitek" : undefined}
                    value={teks(c.k)}
                    placeholder={c.kosong}
                    onChange={(e) => set(c.k, e.currentTarget.value)}
                  />
                </label>
              );
            })}
          </div>
        </div>

        {/* ---- Hal. 2: cerita ----------------------------------------------- */}
        <div
          key={`cerita-${halaman === "cerita" ? halamanGerak : "x"}`}
          id="mjc-hal-cerita"
          role="tabpanel"
          aria-labelledby="mjc-tab-cerita"
          className={`mjc__hal mjc__hal--cerita${halamanGerak && halaman === "cerita" ? " is-masuk" : ""}`}
          hidden={halaman !== "cerita"}
        >
          <label className={isian("summary", "mjc__isian--area")} data-zona="kepala">
            <span>
              Ringkasan
              <em>beranda · daftar karya · pencarian</em>
            </span>
            <textarea
              rows={3}
              value={teks("summary")}
              placeholder="mis. Rumah dua lantai di lahan 8×15 m yang mempertahankan pohon mangga di tengah tapak."
              onChange={(e) => set("summary", e.currentTarget.value)}
            />
          </label>
          <label className={isian("description", "mjc__isian--area mjc__isian--cerita")} data-zona="cerita">
            <span>
              Tentang proyek
              <em>
                {paragraf.length} paragraf · {jumlahKata(teks("description"))} kata
              </em>
            </span>
            <textarea
              id="mjc-deskripsi"
              value={teks("description")}
              placeholder="Pisahkan paragraf dengan satu baris kosong."
              onChange={(e) => set("description", e.currentTarget.value)}
            />
          </label>
        </div>

        {/* ---- Hal. 3: pencarian & kartu bagikan --------------------------- */}
        <div
          key={`cari-${halaman === "cari" ? halamanGerak : "x"}`}
          id="mjc-hal-cari"
          role="tabpanel"
          aria-labelledby="mjc-tab-cari"
          className={`mjc__hal mjc__hal--cari${halamanGerak && halaman === "cari" ? " is-masuk" : ""}`}
          hidden={halaman !== "cari"}
        >
          <label className={isian("seoTitle", teks("seoTitle").length > 60 ? "is-amber" : "")}>
            <span>
              Judul di pencarian
              <em>{teks("seoTitle").length || judul.length}/60</em>
            </span>
            <input value={teks("seoTitle")} placeholder={judul} onChange={(e) => set("seoTitle", e.currentTarget.value)} />
          </label>
          <label className={isian("seoDescription", `mjc__isian--area${teks("seoDescription").length > 160 ? " is-amber" : ""}`)}>
            <span>
              Deskripsi di pencarian
              <em>{teks("seoDescription").length}/200</em>
            </span>
            <textarea
              rows={3}
              maxLength={200}
              value={teks("seoDescription")}
              placeholder={teks("summary") || "Satu kalimat di bawah judul pada hasil pencarian."}
              onChange={(e) => set("seoDescription", e.currentTarget.value)}
            />
          </label>

          <figure className="mjc__cuplik" aria-label="Pratinjau hasil pencarian">
            <figcaption>Hasil pencarian</figcaption>
            <p className="mjc__cuplikalamat">
              {DOMAIN} › proyek › {slug}
            </p>
            <p className={`mjc__cuplikjudul${panjangJudul > 60 ? " is-potong" : ""}`}>
              {judulCari} — {studio}
            </p>
            <p className="mjc__cuplikket">{ketCariTampil || "Deskripsi bawaan studio dipakai — ringkasan dan deskripsi pencarian kosong."}</p>
          </figure>

          <figure className="mjc__bagikan" aria-label="Pratinjau kartu bagikan">
            <span className="mjc__bagikanfoto" style={{ "--mjc-a": String(rasioSampul ?? RASIO) } as CSSProperties}>
              {urlSampul ? <img src={urlSampul} alt="" decoding="async" /> : <Ikon ikon={ImageSquare} ukuran={18} />}
            </span>
            <figcaption>
              <small>{DOMAIN}</small>
              <b>{judulCari}</b>
              <span>{ketCari || "—"}</span>
              {urlSampul && potongBagikan.buang >= 0.02 && <em>foto dipotong {persen(potongBagikan.buang)}</em>}
            </figcaption>
          </figure>
        </div>
      </div>
    </section>
  );
}

/* ---- Kerangka memuat: papan yang sama, setinggi aslinya ------------------------------ */

function Rangka() {
  return (
    <div className="mjc" aria-busy="true">
      <div className="mjc__papan mjc__papan--rangka">
        <div className="mjc__kop">
          <div className="mjc__kopjudul">
            <p>Meja cahaya · publikasi karya</p>
            <span className="mjc__rangkabar" />
          </div>
        </div>
        <div className="mjc__sampel" />
        <div className="mjc__meja">
          <div className="mjc__kaca" />
          <div className="mjc__baki" />
        </div>
        <div className="mjc__lembar">
          <div className="mjc__kertas" />
        </div>
      </div>
    </div>
  );
}

export function HalamanPublikKit({ dibangunPada }: { dibangunPada?: string }) {
  return (
    <RequireAuth skeleton={<Rangka />}>
      <ToastProvider>
        <Isi dibangunPada={dibangunPada} />
      </ToastProvider>
    </RequireAuth>
  );
}
