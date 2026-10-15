import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent,
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
   Halaman Publik (/admin/proyek/publik) — MAJALAH KARYA.

   Halaman /proyek/<slug> di situs adalah artikel majalah arsitektur: foto
   pembuka, judul besar, fakta proyek, cerita, galeri, kredit. Jadi halaman
   admin-nya MAJALAH YANG TERBUKA di meja, tiga spread yang dibalik:

   1. Pembuka (hlm 1–2) — kiri: foto sampul selebar halaman dalam potongan
      16:9 yang sama dengan situs, kicker jenis · kota, JUDUL besar, dek
      (subjudul), empat sel fakta persis baris LOKASI · SELESAI · JENIS ·
      LUAS di situs. Kanan: "Tentang proyek" — ringkasan sebagai kutipan
      besar, cerita dua kolom bercapital awal (diklik = disunting), dan
      kotak MATERIAL berisi sampel bahan.
   2. Galeri (hlm 3–4) — sepuluh foto dalam urutan situs: satu foto utama
      dan empat foto kecil per halaman, keterangan di bawah tiap foto.
   3. Kredit & pencarian (hlm 5–6) — kredit dengan kalimat cadangan yang
      dilihat pengunjung, data internal, alamat halaman, cuplikan hasil
      pencarian, dan kartu bagikan.

   Di kanan LEMBAR PERIKSA CETAK (proof): keputusan cetak = status terbit
   (Koreksi = draf, ACC cetak = terbit, Ditarik = arsip) sebagai cap,
   "Sampul depan" = diunggulkan di beranda, dan daftar PERIKSA SEBELUM
   CETAK yang dihitung dari isinya — tiap baris membawa ke tempatnya.

   Isian yang diubah ditulis PENSIL sampai disimpan, lalu jadi tinta.
   Logika lama dibawa apa adanya: hanya kolom yang berubah yang dikirim,
   unggahan dikecilkan dulu lalu naik tiga sekaligus, sepuluh foto per
   jenis, sampul wajib sebelum terbit.

   Gerak — hanya karena perbuatan, seketika bila gerak dikurangi: spread
   DIBALIK (satu-satunya 3D: halaman terangkat di lipatan, View
   Transitions), cap keputusan menghantam, foto yang diseret melayang lalu
   semuanya bergeser ke tempat barunya, "Jadikan sampul" menerbangkan foto
   ke miniatur pembuka di daftar isi, foto baru jatuh ke halaman.
   ============================================================================= */

const MAKS = 10;
/* Rasio foto di seluruh situs publik — `--rasio-foto: 16 / 9` (publik.css). */
const RASIO = 16 / 9;
/* Kartu bagikan (og:image) dipotong platform ke 1200x630. */
const RASIO_BAGIKAN = 1200 / 630;
const DOMAIN = "pahlevidirgaarchitecture.com";
const LEMBUT = "cubic-bezier(0.22, 0.7, 0.2, 1)";

const KATEGORI = KATEGORI_LABEL as Record<string, string>;

type Draf = Partial<Proyek> & { coverImageKey?: string };
type Spread = "pembuka" | "galeri" | "kredit";
type Toast = ReturnType<typeof useToast>;

const SPREAD: { s: Spread; hal: [number, number]; label: string }[] = [
  { s: "pembuka", hal: [1, 2], label: "Pembuka" },
  { s: "galeri", hal: [3, 4], label: "Galeri" },
  { s: "kredit", hal: [5, 6], label: "Kredit & pencarian" },
];
const URUT_SPREAD: Record<Spread, number> = { pembuka: 0, galeri: 1, kredit: 2 };

const STATUS: { nilai: string; cap: string; label: string; ket: string }[] = [
  { nilai: "draft", cap: "Koreksi", label: "Draf", ket: "Draf — hanya terlihat oleh staf studio" },
  { nilai: "published", cap: "ACC cetak", label: "Terbit", ket: "Terbit — tampil di situs setelah situs diterbitkan lagi" },
  { nilai: "archived", cap: "Ditarik", label: "Arsip", ket: "Arsip — disembunyikan dari situs tanpa dihapus" },
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
/** Tanggal di cap karet: "14.10.26". */
const tanggalCap = (d: Date) =>
  `${dua(d.getDate())}.${dua(d.getMonth() + 1)}.${String(d.getFullYear()).slice(2)}`;

function pindahkan<T>(a: T[], dari: number, ke: number): T[] {
  const b = a.slice();
  const [x] = b.splice(dari, 1);
  b.splice(ke, 0, x!);
  return b;
}

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
          /* Yang baru muncul sesudah unggahan "jatuh" ke halaman — bukan yang
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

/* ---- Gerak urutan sampel material: FLIP + seret di satu daftar ----------------------- */

/* Butir yang berpindah tempat meluncur dari posisi lamanya — hanya sesudah
   perbuatan (`izin`), tidak saat data datang (jebakan #74). Butir yang baru
   diunggah jatuh ke halaman. Posisi dibaca dari offsetLeft/Top: nilai tata
   letak, tidak ikut transform yang sedang berjalan. */
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
              { transform: "translateY(-18px) scale(1.06)", opacity: 0 },
              { transform: "none", opacity: 1 },
            ],
            { duration: 460, easing: LEMBUT },
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

/* Sampel material diangkat lalu diletakkan di tempat lain di daftar yang
   sama; yang lain bergeser memberi tempat. Baru dianggap menyeret sesudah
   bergeser 6px, jadi klik biasa tetap memilih. Kotak tiap slot dibaca SEKALI
   saat mulai. Escape membatalkan. */
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
    st.el.style.transform = `translate(${st.asal.left + st.dx - slot.left}px, ${st.asal.top + st.dy - slot.top}px) rotate(-1.5deg) scale(1.04)`;
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
        document.documentElement.classList.add("mjl-menyeret");
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
      document.documentElement.classList.remove("mjl-menyeret");
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
        st.el.animate([{ transform: `translate(${tx}px, ${ty}px) rotate(-1.5deg) scale(1.04)` }, { transform: "none" }], {
          duration: 320,
          easing: LEMBUT,
        });
      }
    }
    window.addEventListener("pointermove", gerak, { passive: false });
    window.addEventListener("pointerup", naik);
    window.addEventListener("pointercancel", batal);
    window.addEventListener("keydown", tombol, true);
  }

  return { seret, turun, tahanKlik };
}

/* ---- Gerak foto galeri: dua halaman, satu urutan ------------------------------------ */

/* Galeri tersebar di DUA halaman (dua wadah), jadi FLIP-nya membaca kotak
   layar (getBoundingClientRect), bukan offsetLeft: foto yang pindah halaman
   dipasang ulang oleh React di wadah lain, dan offsetParent-nya berganti.
   `catat()` dipanggil SEBELUM urutan berubah; sesudah tergambar, tiap foto
   meluncur dari kotak lamanya (termasuk perubahan ukuran utama ↔ kecil). */
function useFlipKotak(akar: RefObject<HTMLElement | null>, kunci: string, baru: RefObject<Set<string>>) {
  const sebelum = useRef<Map<string, DOMRect> | null>(null);
  const pertama = useRef(true);
  const catat = () => {
    if (!geraknya()) return;
    const m = new Map<string, DOMRect>();
    akar.current?.querySelectorAll<HTMLElement>("[data-urut]").forEach((el) => {
      el.getAnimations().forEach((a) => a.cancel());
      m.set(el.dataset.urut!, el.getBoundingClientRect());
    });
    sebelum.current = m;
  };
  useLayoutEffect(() => {
    const lama = sebelum.current;
    sebelum.current = null;
    const w = akar.current;
    if (!w) return;
    if (pertama.current || !geraknya()) {
      pertama.current = false;
      baru.current.clear();
      return;
    }
    w.querySelectorAll<HTMLElement>("[data-urut]").forEach((el) => {
      const id = el.dataset.urut!;
      if (baru.current.has(id)) {
        baru.current.delete(id);
        el.animate(
          [
            { transform: "translateY(-26px) rotate(-1.5deg) scale(1.04)", opacity: 0 },
            { transform: "none", opacity: 1 },
          ],
          { duration: 520, easing: LEMBUT },
        );
        return;
      }
      const a = lama?.get(id);
      if (!a) return;
      const b = el.getBoundingClientRect();
      if (!b.width) return;
      const dx = a.left - b.left;
      const dy = a.top - b.top;
      const s = a.width / b.width;
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5 && Math.abs(s - 1) < 0.01) return;
      el.animate(
        [
          { transformOrigin: "0 0", transform: `translate(${dx}px, ${dy}px) scale(${s})` },
          { transformOrigin: "0 0", transform: "none" },
        ],
        { duration: 440, easing: LEMBUT },
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kunci]);
  return catat;
}

/* Foto galeri diangkat dan diletakkan di slot lain — juga lintas halaman.
   Selama diseret, susunan TIDAK berubah (foto lain diam, slot tujuan
   menyala); begitu dilepas semuanya meluncur serentak ke tempat barunya.
   Kotak slot dibaca sekali saat mulai menyeret. Escape membatalkan. */
function useSeretFoto(akar: RefObject<HTMLElement | null>, ids: string[], onLepas: (dari: number, ke: number) => void) {
  const [sasaran, setSasaran] = useState<{ id: string; ke: number } | null>(null);
  const aktif = useRef(false);
  const tahanKlik = useRef(false);
  const lepas = useRef(onLepas);
  lepas.current = onLepas;
  const daftarId = useRef(ids);
  daftarId.current = ids;

  function turun(e: RPointerEvent<HTMLElement>, id: string) {
    if (e.button !== 0 || aktif.current) return;
    if ((e.target as HTMLElement).closest("input, textarea, a, .mjl__ftalat")) return;
    const dari = daftarId.current.indexOf(id);
    if (dari < 0) return;
    const el = e.currentTarget;
    const x0 = e.clientX;
    const y0 = e.clientY;
    const pid = e.pointerId;
    const asal = el.getBoundingClientRect();
    let kotak: DOMRect[] = [];
    let mulai = false;
    let ke = dari;
    let dx = 0;
    let dy = 0;
    aktif.current = true;

    const gerak = (ev: PointerEvent) => {
      if (ev.pointerId !== pid) return;
      dx = ev.clientX - x0;
      dy = ev.clientY - y0;
      if (!mulai) {
        if (Math.hypot(dx, dy) < 6) return;
        mulai = true;
        const w = akar.current;
        kotak = w ? daftarId.current.map((i) => w.querySelector<HTMLElement>(`[data-urut="${CSS.escape(i)}"]`)!.getBoundingClientRect()) : [];
        el.classList.add("is-diangkat");
        document.documentElement.classList.add("mjl-menyeret");
        setSasaran({ id, ke: dari });
      }
      ev.preventDefault();
      const cx = asal.left + asal.width / 2 + dx;
      const cy = asal.top + asal.height / 2 + dy;
      let terdekat = ke;
      let jarak = Infinity;
      kotak.forEach((r, i) => {
        const d = (r.left + r.width / 2 - cx) ** 2 + (r.top + r.height / 2 - cy) ** 2;
        if (d < jarak) {
          jarak = d;
          terdekat = i;
        }
      });
      if (terdekat !== ke) {
        ke = terdekat;
        setSasaran({ id, ke });
      }
      el.style.transform = `translate(${dx}px, ${dy}px) rotate(-1.5deg) scale(1.03)`;
    };
    const naik = (ev: PointerEvent) => {
      if (ev.pointerId === pid) selesai(false);
    };
    const batal = () => selesai(true);
    const tombol = (ev: globalThis.KeyboardEvent) => {
      if (ev.key === "Escape" && mulai) {
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
      aktif.current = false;
      if (!mulai) return;
      tahanKlik.current = true;
      window.setTimeout(() => (tahanKlik.current = false), 0);
      document.documentElement.classList.remove("mjl-menyeret");
      if (dibatalkan || ke === dari) {
        const t = el.style.transform;
        el.classList.remove("is-diangkat");
        el.style.transform = "";
        setSasaran(null);
        if (geraknya()) el.animate([{ transform: t }, { transform: "none" }], { duration: 320, easing: LEMBUT });
        return;
      }
      /* Kotak SEKARANG (dengan transform seret) dicatat dulu, jadi foto yang
         dilepas meluncur dari tempat jari melepasnya. */
      flushSync(() => {
        lepas.current(dari, ke);
        setSasaran(null);
      });
    }
    window.addEventListener("pointermove", gerak, { passive: false });
    window.addEventListener("pointerup", naik);
    window.addEventListener("pointercancel", batal);
    window.addEventListener("keydown", tombol, true);
  }

  return { sasaran, turun, tahanKlik };
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
      <div className="mjl">
        <div className="mjl__papan mjl__papan--kosong">
          <p className="mjl__tanpa">
            {id ? "Proyek ini tidak ditemukan — mungkin sudah dihapus." : "Belum ada proyek."}{" "}
            <a href="/admin/proyek">Buka Semua Proyek</a>
          </p>
        </div>
      </div>
    );
  }
  /* key: pindah proyek = majalah baru — draf, pilihan, dan spread dari
     proyek lain tidak boleh terbawa. */
  return <Majalah key={asli.id} asli={asli} semua={semua} setSemua={setSemua} pilih={pilih} dibangunPada={dibangunPada} />;
}

type Periksa = {
  id: "sampul" | "judul" | "ringkasan" | "cerita" | "material" | "galeri" | "kredit" | "cari";
  label: string;
  nilai: string;
  nada: "ok" | "catat" | "wajib" | "lewat";
};

/** Semua yang dibutuhkan ketiga spread dan lembar periksa — satu benda, supaya
 *  komponen spread (didefinisikan di luar, jebakan #80) tidak butuh 40 prop. */
interface Kit {
  asli: Proyek;
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
  urlSampul: string | null;
  rasioSampul: number | undefined;
  potongSampul: ReturnType<typeof potong>;
  potongBagikan: ReturnType<typeof potong>;
  slideSampul: GambarProyek | undefined;
  rasio: Record<string, number>;
  onRasio: (url: string, r: number) => void;
  mengunggahSampul: boolean;
  diseret: "sampul" | "galeri" | "bahan" | null;
  seretMasuk: (t: "sampul" | "galeri" | "bahan") => (e: DragEvent) => void;
  seretKeluar: (e: DragEvent) => void;
  lepasBerkas: (t: "sampul" | "galeri" | "bahan") => (e: DragEvent) => void;
  pilihSampul: () => void;
  pilihGaleri: () => void;
  pilihBahan: () => void;
  galeri: Foto;
  bahan: Foto;
  terpilih: string | null;
  setTerpilih: (id: string | null) => void;
  terpilihBahan: string | null;
  setTerpilihBahan: (id: string | null) => void;
  sunting: boolean;
  setSunting: (v: boolean) => void;
  jadikanSampul: (g: GambarProyek, el: HTMLElement | null) => void;
  hapusFoto: (g: GambarProyek, jenis: "galeri" | "material") => void;
  balik: (s: Spread, lalu?: () => void) => void;
  dicari: string | null;
}

function Majalah({
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
  const [spread, setSpread] = useState<Spread>("pembuka");
  const [setelan, setSetelan] = useState<StudioSettings | null>(() => bacaCache<StudioSettings>("settings"));
  const [rasio, setRasio] = useState<Record<string, number>>({});
  const [diseret, setDiseret] = useState<"sampul" | "galeri" | "bahan" | null>(null);
  const [terpilih, setTerpilih] = useState<string | null>(null);
  const [terpilihBahan, setTerpilihBahan] = useState<string | null>(null);
  const [sunting, setSunting] = useState(false);
  /* Cap keputusan yang baru dibubuhkan (menghantam sekali) dan isian yang
     baru dituju dari daftar periksa (berkedip sekali). */
  const [tercap, setTercap] = useState(false);
  const [tinta, setTinta] = useState(false);
  const [dicari, setDicari] = useState<string | null>(null);
  const [miniBaru, setMiniBaru] = useState(false);

  const galeri = useFoto(asli, "galeri", toast);
  const bahan = useFoto(asli, "material", toast);

  const masukGaleri = useRef<HTMLInputElement>(null);
  const masukBahan = useRef<HTMLInputElement>(null);
  const masukSampul = useRef<HTMLInputElement>(null);
  const miniRef = useRef<HTMLSpanElement>(null);
  const waktu = useRef<number[]>([]);
  useEffect(() => () => waktu.current.forEach((t) => clearTimeout(t)), []);
  const nanti = (f: () => void, ms: number) => waktu.current.push(window.setTimeout(f, ms));

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
  const menyusul = kredit.filter((c) => !teks(c.k).trim()).filter((c) => c.tunggu && c.kosong === BELUM_ADA).length;

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
  const onRasio = useCallback((u: string, r: number) => setRasio((m) => (m[u] === r ? m : { ...m, [u]: r })), []);

  /* ---- Daftar periksa sebelum cetak ---------------------------------------- */
  const kataRingkasan = jumlahKata(teks("summary"));
  const cariPanjang = teks("seoTitle").length > 60 || teks("seoDescription").length > 160;
  const periksa: Periksa[] = [
    {
      id: "sampul",
      label: "Sampul 16:9",
      ...(!adaSampul
        ? { nilai: "belum ada", nada: "wajib" as const }
        : rasioSampul === undefined
          ? { nilai: "mengukur…", nada: "ok" as const }
          : potongSampul.buang < 0.02
            ? { nilai: "pas", nada: "ok" as const }
            : { nilai: `−${persen(potongSampul.buang)} ${potongSampul.sisi}`, nada: potongSampul.buang > 0.25 ? ("catat" as const) : ("ok" as const) }),
    },
    {
      id: "judul",
      label: "Judul & dek",
      ...(subjudulSama ? { nilai: "dek = judul", nada: "catat" as const } : { nilai: teks("subtitle").trim() ? "lengkap" : "tanpa dek", nada: "ok" as const }),
    },
    {
      id: "ringkasan",
      label: "Ringkasan",
      ...(kataRingkasan ? { nilai: `${kataRingkasan} kata`, nada: "ok" as const } : { nilai: "kosong", nada: "catat" as const }),
    },
    {
      id: "cerita",
      label: "Tentang proyek",
      ...(paragraf.length ? { nilai: `${paragraf.length} paragraf`, nada: "ok" as const } : { nilai: "tidak tampil", nada: "catat" as const }),
    },
    {
      id: "material",
      label: "Material",
      ...(daftarBahan.length ? { nilai: `${daftarBahan.length} sampel`, nada: "ok" as const } : { nilai: "tidak tampil", nada: "lewat" as const }),
    },
    {
      id: "galeri",
      label: "Galeri",
      ...(daftarGaleri.length ? { nilai: `${daftarGaleri.length}/${MAKS} foto`, nada: "ok" as const } : { nilai: "tidak tampil", nada: "catat" as const }),
    },
    {
      id: "kredit",
      label: "Kredit",
      ...(menyusul ? { nilai: `${menyusul} menyusul`, nada: "catat" as const } : { nilai: "lengkap", nada: "ok" as const }),
    },
    {
      id: "cari",
      label: "Pencarian",
      ...(cariPanjang ? { nilai: "terlalu panjang", nada: "catat" as const } : { nilai: "siap", nada: "ok" as const }),
    },
  ];

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
      if (baru.status === "published" && asli.status !== "published" && !baru.publishedAt) baru.publishedAt = new Date().toISOString();
      setSemua((s) => s?.map((p) => (p.id === asli.id ? baru : p)) ?? s);
      setDraf({});
      setTinta(true);
      nanti(() => setTinta(false), 900);
      toast({ judul: "Perubahan disimpan", keterangan: "Situs publik baru berubah setelah Terbitkan ditekan.", nada: "sukses" });
    } catch (e) {
      toast({ judul: "Gagal menyimpan", keterangan: (e as Error).message, nada: "gagal" });
    } finally {
      setMenyimpan(false);
    }
  }

  function putuskan(v: string) {
    if (v === "published" && !adaSampul) {
      toast({ judul: "Belum bisa ACC cetak", keterangan: "Pasang sampul dulu — proyek tanpa sampul tidak bisa terbit.", nada: "gagal" });
      return;
    }
    if (v === status) return;
    set("status", v);
    setTercap(true);
    nanti(() => setTercap(false), 700);
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
      toast({ judul: "Sampul terunggah", keterangan: "Tekan Simpan untuk memasangnya.", nada: "sukses" });
    } catch (e) {
      toast({ judul: "Gagal mengunggah sampul", keterangan: (e as Error).message, nada: "gagal" });
    } finally {
      setMengunggahSampul(false);
    }
  }

  /* "Jadikan sampul" dari galeri: fotonya TERBANG ke miniatur pembuka di
     daftar isi (sampulnya sendiri ada di spread lain). Salinan gambar
     ditempel di lapisan tetap, jadi tidak ada yang dirender React. */
  function jadikanSampul(g: GambarProyek, dariEl: HTMLElement | null) {
    set("coverImageKey", g.storageKey);
    setPratinjauSampul((l) => {
      if (l && l.startsWith("blob:")) URL.revokeObjectURL(l);
      return g.url;
    });
    const ke = miniRef.current;
    if (!dariEl || !ke || !geraknya()) {
      setMiniBaru(true);
      nanti(() => setMiniBaru(false), 900);
      return;
    }
    const a = dariEl.getBoundingClientRect();
    const b = ke.getBoundingClientRect();
    const terbang = document.createElement("img");
    terbang.src = g.thumbUrl ?? g.url;
    terbang.alt = "";
    terbang.className = "mjl__terbang";
    terbang.style.cssText = `left:${a.left}px;top:${a.top}px;width:${a.width}px;height:${a.height}px`;
    document.body.appendChild(terbang);
    const sx = b.width / a.width;
    const sy = b.height / a.height;
    const dx = b.left - a.left;
    const dy = b.top - a.top;
    const anim = terbang.animate(
      [
        { transformOrigin: "0 0", transform: "none", opacity: 1 },
        { transformOrigin: "0 0", transform: `translate(${dx * 0.5}px, ${dy * 0.5 - 40}px) scale(${(sx + 1) / 2}, ${(sy + 1) / 2}) rotate(-3deg)`, opacity: 1, offset: 0.55 },
        { transformOrigin: "0 0", transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`, opacity: 0.9 },
      ],
      { duration: 680, easing: "cubic-bezier(0.3, 0.6, 0.2, 1)" },
    );
    const selesai = () => {
      terbang.remove();
      setMiniBaru(true);
      nanti(() => setMiniBaru(false), 900);
    };
    anim.onfinish = selesai;
    anim.oncancel = () => terbang.remove();
  }

  async function hapusFoto(g: GambarProyek, jenis: "galeri" | "material") {
    const daftar = jenis === "galeri" ? daftarGaleri : daftarBahan;
    const nama = jenis === "galeri" ? `foto ${dua(daftar.indexOf(g) + 1)}` : `sampel "${g.caption || "tanpa nama"}"`;
    if (!(await tanya({ judul: `Hapus ${nama}?`, isi: "Tidak bisa dikembalikan.", ya: "Ya, hapus", bahaya: true }))) return;
    const el = document.querySelector<HTMLElement>(`[data-urut="${CSS.escape(g.id)}"]`);
    if (el && geraknya()) {
      await el
        .animate([{ transform: "none", opacity: 1 }, { transform: "translateY(-12px) scale(0.97)", opacity: 0 }], {
          duration: 200,
          easing: "ease-in",
          fill: "forwards",
        })
        .finished.catch(() => {});
    }
    const i = daftar.indexOf(g);
    const lanjut = daftar[i + 1] ?? daftar[i - 1] ?? null;
    if (jenis === "galeri") {
      setTerpilih(lanjut?.id ?? null);
      await galeri.hapus(g);
    } else {
      setTerpilihBahan(lanjut?.id ?? null);
      await bahan.hapus(g);
    }
    /* Tombol hapusnya ikut lenyap (jebakan #39): fokus ke foto yang kini
       terpilih, atau ke kotak tambah. */
    window.requestAnimationFrame(() => {
      const sel = lanjut
        ? `[data-urut="${CSS.escape(lanjut.id)}"] button`
        : jenis === "galeri"
          ? ".mjl__fttambah"
          : ".mjl__tambahbahan";
      document.querySelector<HTMLElement>(sel)?.focus();
    });
  }

  /* ---- Seret berkas dari komputer ------------------------------------------ */
  const adaBerkas = (e: DragEvent) => [...e.dataTransfer.types].includes("Files");
  const seretMasuk = (tempat: "sampul" | "galeri" | "bahan") => (e: DragEvent) => {
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
  const lepasBerkas = (tempat: "sampul" | "galeri" | "bahan") => (e: DragEvent) => {
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

  /* ---- Membalik spread ------------------------------------------------------
     Satu-satunya 3D halaman ini. Maju: halaman KANAN terangkat di lipatan
     sampai tegak, lalu halaman kiri spread baru turun menutupi kiri yang
     lama. Mundur: kebalikannya. View Transitions dengan nama hanya selama
     satu pembalikan (kelas di <html>), jadi kop dan lembar periksa berganti
     seketika. Peramban tanpa API ini, atau gerak dikurangi: seketika. */
  function balik(tujuan: Spread, lalu?: () => void) {
    const jalan = () => lalu && window.requestAnimationFrame(lalu);
    if (tujuan === spread) {
      jalan();
      return;
    }
    const ganti = () =>
      flushSync(() => {
        setSpread(tujuan);
        setTerpilih(null);
        setTerpilihBahan(null);
        setSunting(false);
      });
    const dok = document as Document & {
      startViewTransition?: (ubah: () => void) => { finished: Promise<void>; updateCallbackDone: Promise<void> };
    };
    if (!dok.startViewTransition || !geraknya()) {
      ganti();
      jalan();
      return;
    }
    const akar = document.documentElement;
    const arah = URUT_SPREAD[tujuan] > URUT_SPREAD[spread] ? "mjl-maju" : "mjl-mundur";
    akar.classList.add("mjl-balik", arah);
    const vt = dok.startViewTransition(ganti);
    vt.updateCallbackDone.then(jalan, () => {});
    vt.finished.finally(() => akar.classList.remove("mjl-balik", "mjl-maju", "mjl-mundur"));
  }

  /* PageUp/PageDown membalik di mana saja, kecuali di isian, dialog, dan menu. */
  const balikRef = useRef(balik);
  balikRef.current = balik;
  const spreadRef = useRef(spread);
  spreadRef.current = spread;
  useEffect(() => {
    const tombol = (e: globalThis.KeyboardEvent) => {
      if (e.key !== "PageUp" && e.key !== "PageDown") return;
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || e.defaultPrevented) return;
      const t = e.target as HTMLElement | null;
      if (t?.closest("input, textarea, select, [contenteditable], [role=dialog], [role=menu], [role=listbox]")) return;
      const i = URUT_SPREAD[spreadRef.current] + (e.key === "PageDown" ? 1 : -1);
      const ke = SPREAD[i];
      if (!ke) return;
      e.preventDefault();
      balikRef.current(ke.s);
    };
    window.addEventListener("keydown", tombol);
    return () => window.removeEventListener("keydown", tombol);
  }, []);

  /* Daftar periksa: membalik ke spread tempat isian itu, lalu memfokusnya —
     dan tempatnya berkedip sekali supaya mata langsung menemukannya. */
  function lompat(p: Periksa["id"]) {
    const fokus = (sel: string) => () => {
      const el = document.querySelector<HTMLElement>(sel);
      el?.focus();
      setDicari(p);
      nanti(() => setDicari((d) => (d === p ? null : d)), 1300);
    };
    switch (p) {
      case "sampul":
        return balik("pembuka", fokus("#mjl-sampul"));
      case "judul":
        return balik("pembuka", fokus(subjudulSama ? "#mjl-dek" : "#mjl-judul"));
      case "ringkasan":
        return balik("pembuka", fokus("#mjl-ringkasan"));
      case "cerita":
        return balik("pembuka", () => {
          setSunting(true);
          setDicari(p);
          nanti(() => setDicari((d) => (d === p ? null : d)), 1300);
        });
      case "material":
        return balik("pembuka", fokus(".mjl__bahanlist .mjl__bahanbtn, .mjl__tambahbahan"));
      case "galeri":
        return balik("galeri", fokus(".mjl__ft .mjl__ftgambar, .mjl__fttambah"));
      case "kredit": {
        const kosong = kredit.find((c) => c.tunggu && !teks(c.k).trim());
        return balik("kredit", fokus(`#mjl-kredit-${kosong?.k ?? "leadArchitect"}`));
      }
      case "cari":
        return balik("kredit", fokus("#mjl-seojudul"));
    }
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

  const k: Kit = {
    asli,
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
    urlSampul,
    rasioSampul,
    potongSampul,
    potongBagikan,
    slideSampul,
    rasio,
    onRasio,
    mengunggahSampul,
    diseret,
    seretMasuk,
    seretKeluar,
    lepasBerkas,
    pilihSampul: () => masukSampul.current?.click(),
    pilihGaleri: () => masukGaleri.current?.click(),
    pilihBahan: () => masukBahan.current?.click(),
    galeri,
    bahan,
    terpilih,
    setTerpilih,
    terpilihBahan,
    setTerpilihBahan,
    sunting,
    setSunting,
    jadikanSampul,
    hapusFoto: (g, j) => void hapusFoto(g, j),
    balik,
    dicari,
  };

  const iSpread = URUT_SPREAD[spread];
  const tab = useRef<(HTMLButtonElement | null)[]>([]);
  function tombolTab(e: KeyboardEvent, i: number) {
    const arah = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!arah && e.key !== "Home" && e.key !== "End") return;
    e.preventDefault();
    const j = e.key === "Home" ? 0 : e.key === "End" ? SPREAD.length - 1 : Math.max(0, Math.min(SPREAD.length - 1, i + arah));
    balik(SPREAD[j]!.s);
    tab.current[j]?.focus();
  }

  /* Lencana daftar isi: berapa catatan periksa yang tinggal di spread itu. */
  const catatSpread: Record<Spread, number> = {
    pembuka: periksa.filter((p) => ["sampul", "judul", "ringkasan", "cerita"].includes(p.id) && (p.nada === "catat" || p.nada === "wajib")).length,
    galeri: periksa.filter((p) => p.id === "galeri" && p.nada === "catat").length,
    kredit: periksa.filter((p) => (p.id === "kredit" || p.id === "cari") && p.nada === "catat").length,
  };
  const pensilSpread: Record<Spread, boolean> = {
    pembuka: (["title", "subtitle", "location", "year", "category", "areaSqm", "summary", "description", "coverImageKey"] as (keyof Draf)[]).some(pensil),
    galeri: false,
    kredit: (["leadArchitect", "photographer", "contractor", "lightingDesigner", "client", "city", "clientWhatsapp", "slug", "seoTitle", "seoDescription"] as (keyof Draf)[]).some(pensil),
  };

  return (
    <div className="mjl">
      <div className={`mjl__papan${tinta ? " is-tinta" : ""}`}>
        {/* ---- Kop: nama karya + daftar isi + simpan ------------------------ */}
        <header className="mjl__kop">
          <div className="mjl__kopjudul">
            <p>
              Majalah karya · No. <b>{kode}</b>
            </p>
            <PilihMenu
              label="Pilih proyek"
              nilai={asli.id}
              opsi={semua.map((p) => ({ nilai: p.id, label: p.title }))}
              onUbah={(v) => void gantiProyek(v)}
              pemicu={
                <button type="button" className={`mjl__proyek${pensil("title") ? " is-pensil" : ""}`}>
                  <h2>{judul}</h2>
                  <Ikon ikon={CaretDown} ukuran={16} />
                </button>
              }
            />
          </div>

          <div className="mjl__daftarisi" role="tablist" aria-label="Daftar isi majalah">
            {SPREAD.map((d, i) => {
              const aktif = spread === d.s;
              return (
                <button
                  key={d.s}
                  ref={(el) => {
                    tab.current[i] = el;
                  }}
                  type="button"
                  role="tab"
                  id={`mjl-tab-${d.s}`}
                  aria-selected={aktif}
                  aria-controls="mjl-spread"
                  tabIndex={aktif ? 0 : -1}
                  className={`mjl__isitab${aktif ? " is-aktif" : ""}${pensilSpread[d.s] ? " is-pensil" : ""}`}
                  onClick={() => balik(d.s)}
                  onKeyDown={(e) => tombolTab(e, i)}
                >
                  <Miniatur
                    s={d.s}
                    urlSampul={urlSampul}
                    galeri={daftarGaleri}
                    miniRef={d.s === "pembuka" ? miniRef : undefined}
                    baru={d.s === "pembuka" && miniBaru}
                  />
                  <span className="mjl__isiteks">
                    <small>
                      hlm {d.hal[0]}–{d.hal[1]}
                    </small>
                    <b>{d.label}</b>
                  </span>
                  {catatSpread[d.s] > 0 && (
                    <em className="mjl__isicatat" title={`${catatSpread[d.s]} catatan periksa di spread ini`}>
                      {catatSpread[d.s]}
                      <span className="sr-only"> catatan periksa</span>
                    </em>
                  )}
                </button>
              );
            })}
          </div>

          <div className={`mjl__simpan${tinta ? " is-tinta" : ""}`}>
            <Tombol
              memuat={menyimpan}
              ukuran="medium"
              jenis="primary"
              kiri={adaPerubahan || menyimpan ? undefined : Check}
              disabled={!adaPerubahan || menyimpan}
              onClick={() => void simpan()}
              title={adaPerubahan ? `${berubah.length} koreksi ditulis pensil — simpan supaya jadi tinta` : "Semua isian sudah tinta"}
            >
              {menyimpan ? "Menyimpan…" : adaPerubahan ? `Simpan ${berubah.length} koreksi` : "Tersimpan"}
            </Tombol>
          </div>

          <DropdownMenu
            sections={menu}
            trigger={
              <button type="button" className="mjl__menu" aria-label="Menu proyek">
                <Ikon ikon={DotsThree} ukuran={20} />
              </button>
            }
          />
        </header>

        {/* ---- Majalah terbuka -------------------------------------------- */}
        <section className="mjl__meja" aria-label="Majalah karya">
          <div
            id="mjl-spread"
            role="tabpanel"
            aria-labelledby={`mjl-tab-${spread}`}
            className={`mjl__buka is-${spread}`}
          >
            {spread === "pembuka" && <Pembuka k={k} />}
            {spread === "galeri" && <Galeri k={k} />}
            {spread === "kredit" && <Kredit k={k} />}
          </div>
          <input
            ref={masukGaleri}
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

        {/* ---- Lembar periksa cetak ------------------------------------------ */}
        <Slip
          kode={kode}
          status={status}
          pensilStatus={pensil("status")}
          tercap={tercap}
          adaSampul={adaSampul}
          onPutus={putuskan}
          tanggalTerbit={asli.status === "published" && asli.publishedAt && !pensil("status") ? new Date(asli.publishedAt) : new Date()}
          unggulan={unggulan}
          pensilUnggulan={pensil("isFeatured")}
          onUnggulan={() => set("isFeatured", !unggulan)}
          ketUnggulan={
            status !== "published"
              ? "tampil sesudah ACC cetak"
              : `${unggulan ? "diunggulkan · " : ""}urutan ke-${urutBeranda + 1} dari ${terbitan.length}${unggulan || !unggulanLain ? "" : ` · ${unggulanLain} lain diunggulkan`}`
          }
          keadaan={keadaan}
          bisaDilihat={bisaDilihat}
          slug={asli.slug}
          periksa={periksa}
          onLompat={lompat}
          koreksi={berubah.length}
          spread={iSpread}
        />
      </div>
    </div>
  );
}

/* ---- Miniatur spread di daftar isi — isinya gambar sungguhan ------------------------ */

function Miniatur({
  s,
  urlSampul,
  galeri,
  miniRef,
  baru,
}: {
  s: Spread;
  urlSampul: string | null;
  galeri: GambarProyek[];
  miniRef?: RefObject<HTMLSpanElement | null>;
  baru?: boolean;
}) {
  if (s === "pembuka") {
    return (
      <span className={`mjl__mini is-pembuka${baru ? " is-baru" : ""}`} aria-hidden="true">
        <span className="mjl__minihal">
          <span ref={miniRef} className="mjl__minifoto">
            {urlSampul && <img src={urlSampul} alt="" decoding="async" />}
          </span>
          <i />
          <i />
        </span>
        <span className="mjl__minihal">
          <i />
          <i />
          <i />
          <i />
        </span>
      </span>
    );
  }
  if (s === "galeri") {
    const kiri = galeri.slice(0, 5);
    const kanan = galeri.slice(5, 10);
    const hal = (l: GambarProyek[]) => (
      <span className="mjl__minihal is-galeri">
        {l.map((g, i) => (
          <span key={g.id} className={i === 0 ? "is-utama" : undefined}>
            <img src={g.thumbUrl ?? g.url} alt="" loading="lazy" decoding="async" />
          </span>
        ))}
      </span>
    );
    return (
      <span className="mjl__mini is-galeri" aria-hidden="true">
        {hal(kiri)}
        {hal(kanan)}
      </span>
    );
  }
  return (
    <span className="mjl__mini is-kredit" aria-hidden="true">
      <span className="mjl__minihal">
        <i />
        <i />
        <i />
        <i />
        <i />
      </span>
      <span className="mjl__minihal">
        <b />
        <i />
        <i />
        <b />
      </span>
    </span>
  );
}

/* ---- Bagian umum halaman majalah --------------------------------------------------- */

/** Kaki halaman: nomor halaman di sisi luar, judul berjalan, dan sudut halaman
 *  yang bisa diklik untuk membalik ke spread tetangga. */
function Folio({ k, hal, sisi, teks }: { k: Kit; hal: number; sisi: "kiri" | "kanan"; teks: string }) {
  const i = URUT_SPREAD[(SPREAD.find((d) => d.hal.includes(hal)) ?? SPREAD[0]!).s];
  const tetangga = sisi === "kiri" ? SPREAD[i - 1] : SPREAD[i + 1];
  return (
    <footer className={`mjl__folio is-${sisi}`}>
      {tetangga ? (
        <button
          type="button"
          className={`mjl__sudut is-${sisi}`}
          aria-label={`Balik ke halaman ${sisi === "kiri" ? tetangga.hal[1] : tetangga.hal[0]} — ${tetangga.label}`}
          title={`${sisi === "kiri" ? "←" : "→"} ${tetangga.label} (PageUp/PageDown)`}
          onClick={() => k.balik(tetangga.s)}
        >
          <Ikon ikon={sisi === "kiri" ? CaretLeft : CaretRight} ukuran={11} />
        </button>
      ) : (
        <span className="mjl__sudut is-kosong" aria-hidden="true" />
      )}
      <b>{hal}</b>
      <span>{teks}</span>
    </footer>
  );
}

/* ---- Spread 1: pembuka ----------------------------------------------------------------- */

function Pembuka({ k }: { k: Kit }) {
  const [rusak, setRusak] = useState<string | null>(null);
  /* Judul setinggi isinya (satu atau dua baris) — dibaca sekali tiap judul
     berubah, bukan saat menggulir. */
  const judulRef = useRef<HTMLTextAreaElement>(null);
  const judulTeks = k.teks("title");
  useLayoutEffect(() => {
    const el = judulRef.current;
    if (!el) return;
    el.style.height = "auto";
    const garis = parseFloat(getComputedStyle(el).lineHeight) || 36;
    el.style.height = `${Math.min(el.scrollHeight, Math.ceil(garis * 2) + 2)}px`;
  }, [judulTeks]);
  const url = k.urlSampul && rusak !== k.urlSampul ? k.urlSampul : null;
  const jenis = KATEGORI[k.teks("category")] ?? (k.teks("category") || "Hunian");
  const kota = k.teks("city");
  const fotografer = k.teks("photographer").trim();
  const asalSampul = k.pensil("coverImageKey")
    ? "belum disimpan"
    : k.slideSampul
      ? `dari galeri ${dua((k.galeri.daftar ?? []).indexOf(k.slideSampul) + 1)}`
      : "unggahan terpisah";
  const potongTeks =
    k.rasioSampul === undefined
      ? "16:9"
      : k.potongSampul.buang < 0.02
        ? "16:9 pas"
        : `16:9 −${persen(k.potongSampul.buang)} ${k.potongSampul.sisi}`;
  const dicari = (id: string) => (k.dicari === id ? " is-dicari" : "");

  return (
    <>
      <article className="mjl__hal is-kiri is-pembuka" aria-label="Halaman 1 — pembuka">
        <div
          className={`mjl__sampul${k.diseret === "sampul" ? " is-seret" : ""}${k.pensil("coverImageKey") ? " is-pensil" : ""}${dicari("sampul")}`}
          onDragOver={k.seretMasuk("sampul")}
          onDragLeave={k.seretKeluar}
          onDrop={k.lepasBerkas("sampul")}
        >
          {url ? (
            <>
              <button
                type="button"
                id="mjl-sampul"
                className="mjl__sampulfoto"
                aria-label="Lihat sampul besar"
                onClick={() => bukaLightbox([{ url, caption: `Sampul — ${k.judul}`, altText: k.judul }], 0)}
              >
                <img
                  src={url}
                  alt={`Sampul ${k.judul}`}
                  decoding="async"
                  onLoad={(e) => {
                    const im = e.currentTarget;
                    if (im.naturalWidth && im.naturalHeight) k.onRasio(url, im.naturalWidth / im.naturalHeight);
                  }}
                  onError={() => setRusak(url)}
                />
              </button>
              <button type="button" className="mjl__gantisampul" onClick={k.pilihSampul} disabled={k.mengunggahSampul}>
                <Ikon ikon={k.mengunggahSampul ? SpinnerGap : ImageSquare} ukuran={13} />
                {k.mengunggahSampul ? "Mengunggah…" : "Ganti sampul"}
              </button>
            </>
          ) : (
            <button type="button" id="mjl-sampul" className="mjl__sampulkosong" onClick={k.pilihSampul} disabled={k.mengunggahSampul}>
              <Ikon ikon={k.mengunggahSampul ? SpinnerGap : ImageSquare} ukuran={28} />
              <b>
                {k.mengunggahSampul
                  ? "Mengunggah sampul…"
                  : rusak
                    ? "Sampul tidak bisa dimuat — letakkan foto baru"
                    : "Letakkan foto sampul di sini"}
              </b>
              <small>Wajib sebelum ACC cetak · dipotong 16:9 seperti di situs</small>
            </button>
          )}
        </div>
        <p className="mjl__ketfoto">
          <span className={k.pensil("coverImageKey") ? "is-pensil" : undefined}>{asalSampul}</span>
          <span className={url && k.potongSampul.buang > 0.25 ? "is-amber" : undefined} title="Semua foto di situs dipotong 16:9">
            {url ? potongTeks : "—"}
          </span>
        </p>

        <p className="mjl__kicker">
          Karya · {jenis}
          {kota ? ` · ${kota}` : ""}
        </p>
        <label className={`mjl__judulwadah${k.pensil("title") ? " is-pensil" : ""}${dicari("judul")}`}>
          <span className="sr-only">Nama karya</span>
          <textarea
            ref={judulRef}
            id="mjl-judul"
            className="mjl__judul"
            rows={1}
            value={k.teks("title")}
            onChange={(e) => k.set("title", e.currentTarget.value.replace(/\s*\n\s*/g, " "))}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.preventDefault();
            }}
          />
        </label>
        <label className={`mjl__dekwadah${k.pensil("subtitle") ? " is-pensil" : ""}${k.subjudulSama ? " is-amber" : ""}`}>
          <span className="sr-only">Dek (subjudul)</span>
          <input
            id="mjl-dek"
            className="mjl__dek"
            value={k.teks("subtitle")}
            placeholder="Tulis dek — mis. Rumah yang menjaga kebunnya"
            onChange={(e) => k.set("subtitle", e.currentTarget.value)}
          />
          {k.subjudulSama && <em>sama dengan judul — tidak ditampilkan</em>}
        </label>
        {/* Baris nama seperti di majalah — dari kredit, dengan kalimat cadangan
            yang sama dengan situs. */}
        <p className="mjl__byline">
          Arsitektur <b>{k.teks("leadArchitect").trim() || k.studio}</b>
          <span aria-hidden="true">·</span>
          Foto <b className={fotografer ? undefined : "is-amber"}>{fotografer || BELUM_ADA}</b>
        </p>

        {/* Empat sel fakta — persis baris LOKASI · SELESAI · JENIS · LUAS di situs. */}
        <div className="mjl__fakta">
          <label className={`mjl__sel${k.pensil("location") ? " is-pensil" : ""}`}>
            <span>Lokasi</span>
            <input
              id="mjl-lokasi"
              value={k.teks("location")}
              placeholder={kota || "—"}
              onChange={(e) => k.set("location", e.currentTarget.value)}
            />
          </label>
          <label className={`mjl__sel${k.pensil("year") ? " is-pensil" : ""}`}>
            <span>Selesai</span>
            <input
              inputMode="numeric"
              maxLength={4}
              value={k.teks("year")}
              placeholder="—"
              onChange={(e) => {
                const v = e.currentTarget.value.replace(/\D/g, "");
                k.set("year", v ? Number(v) : undefined);
              }}
            />
          </label>
          <div className={`mjl__sel${k.pensil("category") ? " is-pensil" : ""}`}>
            <span id="mjl-jenis-label">Jenis</span>
            <PilihMenu
              label="Jenis proyek"
              nilai={k.teks("category") || "residential"}
              onUbah={(v) => k.set("category", v)}
              opsi={[
                ...Object.entries(KATEGORI).map(([v, l]) => ({ nilai: v, label: l })),
                ...(!KATEGORI[k.teks("category")] && k.teks("category") ? [{ nilai: k.teks("category"), label: k.teks("category") }] : []),
              ]}
              pemicu={
                <button type="button" className="mjl__pilih" aria-labelledby="mjl-jenis-label">
                  <span>{jenis}</span>
                  <Ikon ikon={CaretDown} ukuran={11} />
                </button>
              }
            />
          </div>
          <label className={`mjl__sel${k.pensil("areaSqm") ? " is-pensil" : ""}`}>
            <span>Luas</span>
            <span className="mjl__akhiran">
              <input
                inputMode="numeric"
                value={k.teks("areaSqm")}
                placeholder="—"
                onChange={(e) => {
                  const v = e.currentTarget.value.replace(/[^\d]/g, "");
                  k.set("areaSqm", v ? Number(v) : undefined);
                }}
              />
              m²
            </span>
          </label>
        </div>

        <Folio k={k} hal={1} sisi="kiri" teks={`${k.studio} · Karya ${k.kode}`} />
      </article>

      <article className="mjl__hal is-kanan is-pembuka" aria-label="Halaman 2 — tentang proyek">
        <p className="mjl__kicker">
          Tentang proyek
          <em>
            {k.paragraf.length} paragraf · {jumlahKata(k.teks("description"))} kata
          </em>
        </p>
        <label className={`mjl__kutip${k.pensil("summary") ? " is-pensil" : ""}${dicari("ringkasan")}`}>
          <span className="sr-only">Ringkasan — tampil di beranda, daftar karya, dan pencarian</span>
          <i aria-hidden="true">“</i>
          <textarea
            id="mjl-ringkasan"
            rows={3}
            value={k.teks("summary")}
            placeholder="Ringkasan satu-dua kalimat — tampil di beranda, daftar karya, dan pencarian."
            onChange={(e) => k.set("summary", e.currentTarget.value)}
          />
        </label>
        <Badan k={k} />
        <Bahan k={k} />
        <Folio k={k} hal={2} sisi="kanan" teks={`${k.judul}${k.teks("year") ? ` · ${k.teks("year")}` : ""}`} />
      </article>
    </>
  );
}

/** Cerita dua kolom bercapital awal. Diklik = jadi kotak sunting di tempat yang
 *  sama; keluar = kembali jadi kolom. Kalau ceritanya lebih panjang dari
 *  halamannya, kaki kolom menulis "bersambung di situs". */
function Badan({ k }: { k: Kit }) {
  const kolomRef = useRef<HTMLDivElement>(null);
  const [lebih, setLebih] = useState(false);
  const deskripsi = k.teks("description");
  useLayoutEffect(() => {
    const el = kolomRef.current;
    if (!el) return;
    const ukur = () => setLebih(el.scrollWidth > el.clientWidth + 2 || el.scrollHeight > el.clientHeight + 2);
    ukur();
    const ro = new ResizeObserver(ukur);
    ro.observe(el);
    return () => ro.disconnect();
  }, [deskripsi, k.sunting]);

  const kelas = `mjl__badan${k.pensil("description") ? " is-pensil" : ""}${k.dicari === "cerita" ? " is-dicari" : ""}`;
  if (k.sunting) {
    return (
      <div className={`${kelas} is-sunting`}>
        <label className="sr-only" htmlFor="mjl-deskripsi">
          Tentang proyek
        </label>
        <textarea
          id="mjl-deskripsi"
          autoFocus
          value={deskripsi}
          placeholder="Pisahkan paragraf dengan satu baris kosong."
          onChange={(e) => k.set("description", e.currentTarget.value)}
          onBlur={() => k.setSunting(false)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              e.currentTarget.blur();
            }
          }}
        />
        <small className="mjl__badanket">Paragraf dipisah baris kosong · Esc = selesai</small>
      </div>
    );
  }
  return (
    <div className={kelas}>
      <div
        ref={kolomRef}
        className={`mjl__kolom${k.paragraf.length ? "" : " is-kosong"}`}
        role="button"
        tabIndex={0}
        aria-label={`Sunting tentang proyek — ${k.paragraf.length} paragraf`}
        onClick={() => k.setSunting(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            k.setSunting(true);
          }
        }}
      >
        {k.paragraf.length ? (
          k.paragraf.map((p, i) => <p key={i}>{p}</p>)
        ) : (
          <p className="mjl__kolomkosong">
            Belum ada cerita — bagian "Tentang proyek" tidak tampil di situs. Klik untuk menulis.
          </p>
        )}
      </div>
      {lebih && <small className="mjl__bersambung">bersambung di situs ›</small>}
    </div>
  );
}

/** Kotak MATERIAL: sampel bahan berderet dua kolom, urutan = urutan di situs. */
function Bahan({ k }: { k: Kit }) {
  const foto = k.bahan;
  const daftar = foto.daftar ?? [];
  const ids = daftar.map((g) => g.id);
  const listRef = useRef<HTMLOListElement>(null);
  const { seret, turun, tahanKlik } = useSeret(listRef, ids, foto.izin, (dari, ke) => void foto.pindah(dari, ke));
  const tampil = seret ? pindahkan(daftar, seret.dari, seret.ke) : daftar;
  useFlip(listRef, tampil.map((g) => g.id).join("|"), foto.izin, foto.baru, seret?.id ?? null);
  const tombol = useRef(new Map<string, HTMLButtonElement>());
  const iSampel = daftar.findIndex((g) => g.id === k.terpilihBahan);
  const sampel = iSampel >= 0 ? daftar[iSampel]! : null;
  const [nama, setNama] = useState(sampel?.caption ?? "");
  const [untuk, setUntuk] = useState(sampel?.id ?? null);
  if ((sampel?.id ?? null) !== untuk) {
    setUntuk(sampel?.id ?? null);
    setNama(sampel?.caption ?? "");
  }
  const fokusId = k.terpilihBahan && ids.includes(k.terpilihBahan) ? k.terpilihBahan : ids[0];
  const penuh = daftar.length + foto.mengunggah >= MAKS;

  function papanKetik(e: KeyboardEvent, i: number) {
    if (e.key === "Escape") return k.setTerpilihBahan(null);
    const d = e.key === "ArrowUp" || e.key === "ArrowLeft" ? -1 : e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : 0;
    if (!d) return;
    e.preventDefault();
    if (e.altKey) {
      const ke = Math.max(0, Math.min(daftar.length - 1, i + d));
      if (ke !== i) void foto.pindah(i, ke).then(() => tombol.current.get(daftar[i]!.id)?.focus());
      return;
    }
    const g = daftar[Math.max(0, Math.min(daftar.length - 1, i + d))];
    if (g) {
      k.setTerpilihBahan(g.id);
      tombol.current.get(g.id)?.focus();
    }
  }

  return (
    <section
      className={`mjl__bahan${k.diseret === "bahan" ? " is-seret" : ""}${k.dicari === "material" ? " is-dicari" : ""}`}
      aria-labelledby="mjl-bahan-judul"
      onDragOver={k.seretMasuk("bahan")}
      onDragLeave={k.seretKeluar}
      onDrop={k.lepasBerkas("bahan")}
    >
      <header className="mjl__bahankop">
        <p className="mjl__kicker" id="mjl-bahan-judul">
          Material <em>{daftar.length}/{MAKS}</em>
        </p>
        {sampel ? (
          <div className="mjl__alat">
            <button type="button" title="Naikkan (Alt+↑)" aria-label="Naikkan sampel" disabled={iSampel <= 0} onClick={() => void foto.pindah(iSampel, iSampel - 1)}>
              <Ikon ikon={CaretUp} ukuran={13} />
            </button>
            <button
              type="button"
              title="Turunkan (Alt+↓)"
              aria-label="Turunkan sampel"
              disabled={iSampel >= daftar.length - 1}
              onClick={() => void foto.pindah(iSampel, iSampel + 1)}
            >
              <Ikon ikon={CaretDown} ukuran={13} />
            </button>
            <button type="button" className="is-bahaya" title="Hapus sampel" aria-label="Hapus sampel" onClick={() => k.hapusFoto(sampel, "material")}>
              <Ikon ikon={Trash} ukuran={13} />
            </button>
            <button type="button" title="Lepas pilihan (Esc)" aria-label="Lepas pilihan sampel" onClick={() => k.setTerpilihBahan(null)}>
              <Ikon ikon={X} ukuran={13} />
            </button>
          </div>
        ) : (
          <button type="button" className="mjl__tambahbahan" onClick={k.pilihBahan} disabled={penuh}>
            <Ikon ikon={foto.mengunggah ? SpinnerGap : Plus} ukuran={12} />
            {foto.mengunggah ? `Mengunggah ${foto.mengunggah}…` : penuh ? "Penuh" : "Tambah sampel"}
          </button>
        )}
      </header>
      {foto.daftar !== null && daftar.length === 0 && foto.mengunggah === 0 ? (
        <p className="mjl__bahankosong">Belum ada sampel — bagian Material tidak tampil di situs.</p>
      ) : (
        <ol ref={listRef} className="mjl__bahanlist">
          {tampil.map((g, i) => {
            const pilih = g.id === k.terpilihBahan;
            return (
              <li
                key={g.id}
                data-urut={g.id}
                className={`mjl__bahanbaris${pilih ? " is-terpilih" : ""}${seret?.id === g.id ? " is-diangkat" : ""}`}
                onPointerDown={(e) => turun(e, g.id)}
              >
                <button
                  ref={(el) => {
                    if (el) tombol.current.set(g.id, el);
                    else tombol.current.delete(g.id);
                  }}
                  type="button"
                  className="mjl__bahanbtn"
                  aria-pressed={pilih}
                  tabIndex={g.id === fokusId ? 0 : -1}
                  aria-label={`Sampel ${i + 1}: ${g.caption || "tanpa nama"}`}
                  onClick={() => {
                    if (tahanKlik.current) return;
                    k.setTerpilihBahan(pilih ? null : g.id);
                  }}
                  onKeyDown={(e) => papanKetik(e, daftar.indexOf(g))}
                >
                  <span className="mjl__keping">
                    <img src={g.thumbUrl ?? g.url} alt="" loading="lazy" decoding="async" draggable={false} />
                  </span>
                  {!pilih && <span className={`mjl__bahannama${g.caption ? "" : " is-kosong"}`}>{g.caption || "tanpa nama"}</span>}
                </button>
                {pilih && (
                  <input
                    className="mjl__bahanisian"
                    value={nama}
                    aria-label="Nama material"
                    placeholder="Nama material"
                    maxLength={80}
                    onChange={(e) => setNama(e.currentTarget.value)}
                    onBlur={() => void foto.keterangan(g, nama.trim())}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") e.currentTarget.blur();
                      if (e.key === "Escape") {
                        setNama(g.caption ?? "");
                        window.requestAnimationFrame(() => (e.target as HTMLInputElement).blur());
                      }
                    }}
                  />
                )}
              </li>
            );
          })}
          {Array.from({ length: Math.min(foto.mengunggah, MAKS - tampil.length) }, (_, i) => (
            <li key={`unggah-${i}`} className="mjl__bahanbaris is-unggah" aria-hidden="true">
              <span className="mjl__keping">
                <Ikon ikon={SpinnerGap} ukuran={12} />
              </span>
              <span className="mjl__bahannama is-kosong">mengunggah…</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

/* ---- Spread 2: galeri -------------------------------------------------------------------- */

type Butir = { jenis: "foto"; g: GambarProyek } | { jenis: "unggah"; n: number } | { jenis: "tambah" };

function Galeri({ k }: { k: Kit }) {
  const foto = k.galeri;
  const daftar = foto.daftar ?? [];
  const ids = daftar.map((g) => g.id);
  const akarRef = useRef<HTMLDivElement>(null);
  const kunci = ids.join("|");
  const catat = useFlipKotak(akarRef, kunci, foto.baru);
  const { sasaran, turun, tahanKlik } = useSeretFoto(akarRef, ids, (dari, ke) => {
    catat();
    void foto.pindah(dari, ke);
  });
  const tombol = useRef(new Map<string, HTMLButtonElement>());
  const [rusak, setRusak] = useState<Set<string>>(() => new Set());
  const iPilih = daftar.findIndex((g) => g.id === k.terpilih);
  const [ket, setKet] = useState(iPilih >= 0 ? daftar[iPilih]!.caption ?? "" : "");
  const [untuk, setUntuk] = useState(k.terpilih);
  if (k.terpilih !== untuk) {
    setUntuk(k.terpilih);
    setKet(iPilih >= 0 ? daftar[iPilih]!.caption ?? "" : "");
  }

  const butir: Butir[] = [
    ...daftar.map((g) => ({ jenis: "foto" as const, g })),
    ...Array.from({ length: Math.min(foto.mengunggah, MAKS - daftar.length) }, (_, n) => ({ jenis: "unggah" as const, n })),
  ];
  if (butir.length < MAKS && foto.daftar !== null) butir.push({ jenis: "tambah" });

  const geser = (dari: number, ke: number) => {
    if (ke < 0 || ke >= daftar.length || ke === dari) return;
    catat();
    const id = daftar[dari]!.id;
    void foto.pindah(dari, ke).then(() => tombol.current.get(id)?.focus());
  };

  /* Satu tab-stop untuk seluruh galeri: panah memindah pilihan menurut urutan,
     Alt+panah memindah fotonya, Home/End ke ujung, Esc melepas. */
  function papanKetik(e: KeyboardEvent, i: number) {
    if (e.key === "Escape") {
      k.setTerpilih(null);
      return;
    }
    let j = i;
    if (e.key === "ArrowLeft" || e.key === "ArrowUp") j = i - 1;
    else if (e.key === "ArrowRight" || e.key === "ArrowDown") j = i + 1;
    else if (e.key === "Home") j = 0;
    else if (e.key === "End") j = daftar.length - 1;
    else return;
    e.preventDefault();
    j = Math.max(0, Math.min(daftar.length - 1, j));
    if (e.altKey && e.key !== "Home" && e.key !== "End") {
      geser(i, j);
      return;
    }
    const g = daftar[j];
    if (g) {
      k.setTerpilih(g.id);
      tombol.current.get(g.id)?.focus();
    }
  }

  const fokusId = k.terpilih && ids.includes(k.terpilih) ? k.terpilih : ids[0];

  const ubin = (b: Butir, i: number) => {
    const utama = i % 5 === 0;
    if (b.jenis === "unggah") {
      return (
        <li key={`unggah-${b.n}`} className={`mjl__ft is-unggah${utama ? " is-utama" : ""}`} aria-hidden="true">
          <span className="mjl__ftgambar">
            <Ikon ikon={SpinnerGap} ukuran={18} />
            <small>mengunggah…</small>
          </span>
          <span className="mjl__ftket">
            <b>{dua(i + 1)}</b>
          </span>
        </li>
      );
    }
    if (b.jenis === "tambah") {
      return (
        <li key="tambah" className={`mjl__ft is-tambah${utama ? " is-utama" : ""}`}>
          <button type="button" className="mjl__fttambah" onClick={k.pilihGaleri}>
            <Ikon ikon={Plus} ukuran={utama ? 22 : 16} />
            <b>{daftar.length === 0 ? "Letakkan foto galeri" : "Tambah foto"}</b>
            <small>
              {daftar.length === 0 ? "galeri tidak tampil di situs tanpa foto" : `${MAKS - daftar.length - foto.mengunggah} slot tersisa`}
            </small>
          </button>
          <span className="mjl__ftket">
            <b>{dua(i + 1)}</b>
          </span>
        </li>
      );
    }
    const g = b.g;
    const a = k.rasio[g.url];
    const c = a ? potong(a, RASIO) : null;
    const dipotong = c && c.buang >= 0.04 ? c : null;
    const pilih = g.id === k.terpilih;
    const sampul = g.id === k.slideSampul?.id;
    const jadiSasaran = sasaran && sasaran.ke === i && sasaran.id !== g.id;
    return (
      <li
        key={g.id}
        data-urut={g.id}
        className={`mjl__ft${utama ? " is-utama" : ""}${pilih ? " is-terpilih" : ""}${jadiSasaran ? " is-sasaran" : ""}${sasaran?.id === g.id ? " is-diangkat" : ""}`}
        onPointerDown={(e) => turun(e, g.id)}
      >
        <button
          ref={(el) => {
            if (el) tombol.current.set(g.id, el);
            else tombol.current.delete(g.id);
          }}
          type="button"
          className="mjl__ftgambar"
          aria-pressed={pilih}
          aria-label={`Foto ${dua(i + 1)}${g.caption ? ` — ${g.caption}` : ""}${sampul ? ", dipakai sebagai sampul" : ""}${dipotong ? `, dipotong ${persen(dipotong.buang)} ${dipotong.sisi} di situs` : ""}`}
          tabIndex={g.id === fokusId ? 0 : -1}
          onClick={() => {
            if (tahanKlik.current) return;
            k.setTerpilih(pilih ? null : g.id);
          }}
          onDoubleClick={() =>
            bukaLightbox(
              daftar.map((x) => ({ url: x.url, caption: x.caption, altText: x.altText })),
              daftar.indexOf(g),
            )
          }
          onKeyDown={(e) => papanKetik(e, daftar.indexOf(g))}
        >
          {rusak.has(g.id) ? (
            <span className="mjl__ftrusak">tidak bisa dimuat</span>
          ) : (
            <img
              src={utama ? g.url : g.thumbUrl ?? g.url}
              alt=""
              loading="lazy"
              decoding="async"
              draggable={false}
              onLoad={(e) => {
                const im = e.currentTarget;
                if (im.naturalWidth && im.naturalHeight) k.onRasio(g.url, im.naturalWidth / im.naturalHeight);
              }}
              onError={() => setRusak((s) => new Set(s).add(g.id))}
            />
          )}
          {sampul && <span className={`mjl__ftsampul${k.pensil("coverImageKey") ? " is-pensil" : ""}`}>Sampul</span>}
        </button>
        {pilih && (
          <div className="mjl__ftalat" role="toolbar" aria-label={`Alat foto ${dua(i + 1)}`}>
            <button type="button" title="Majukan (Alt+←)" aria-label="Majukan foto" disabled={i <= 0} onClick={() => geser(i, i - 1)}>
              <Ikon ikon={CaretLeft} ukuran={13} />
            </button>
            <button type="button" title="Mundurkan (Alt+→)" aria-label="Mundurkan foto" disabled={i >= daftar.length - 1} onClick={() => geser(i, i + 1)}>
              <Ikon ikon={CaretRight} ukuran={13} />
            </button>
            <button
              type="button"
              className="mjl__ftjadikan"
              disabled={sampul}
              onClick={(e) => k.jadikanSampul(g, e.currentTarget.closest(".mjl__ft")?.querySelector<HTMLElement>(".mjl__ftgambar") ?? null)}
            >
              <Ikon ikon={ImageSquare} ukuran={13} />
              <span>{sampul ? "Sampul" : "Jadikan sampul"}</span>
            </button>
            <button
              type="button"
              title="Perbesar"
              aria-label="Perbesar foto"
              onClick={() =>
                bukaLightbox(
                  daftar.map((x) => ({ url: x.url, caption: x.caption, altText: x.altText })),
                  i,
                )
              }
            >
              <Ikon ikon={CornersOut} ukuran={13} />
            </button>
            <button type="button" className="is-bahaya" title="Hapus foto" aria-label={`Hapus foto ${dua(i + 1)}`} onClick={() => k.hapusFoto(g, "galeri")}>
              <Ikon ikon={Trash} ukuran={13} />
            </button>
          </div>
        )}
        <span className="mjl__ftket">
          <b>{dua(i + 1)}</b>
          {pilih ? (
            <input
              value={ket}
              aria-label={`Keterangan foto ${dua(i + 1)}`}
              placeholder="Tulis keterangan…"
              maxLength={160}
              onChange={(e) => setKet(e.currentTarget.value)}
              onBlur={() => void foto.keterangan(g, ket.trim())}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
                if (e.key === "Escape") {
                  setKet(g.caption ?? "");
                  window.requestAnimationFrame(() => (e.target as HTMLInputElement).blur());
                }
              }}
            />
          ) : (
            <span className={g.caption ? undefined : "is-kosong"}>{g.caption || "tanpa keterangan"}</span>
          )}
          {dipotong && (
            <em title={`Di situs dipotong ${persen(dipotong.buang)} ${dipotong.sisi} (16:9)`}>−{persen(dipotong.buang)}</em>
          )}
        </span>
      </li>
    );
  };

  const kiri = butir.slice(0, 5);
  const kanan = butir.slice(5, 10);
  return (
    <div
      ref={akarRef}
      className={`mjl__galeri${k.diseret === "galeri" ? " is-seret" : ""}${sasaran ? " is-menyeret" : ""}${k.dicari === "galeri" ? " is-dicari" : ""}`}
      onDragOver={k.seretMasuk("galeri")}
      onDragLeave={k.seretKeluar}
      onDrop={k.lepasBerkas("galeri")}
    >
      <article className="mjl__hal is-kiri is-galeri" aria-label="Halaman 3 — galeri">
        <p className="mjl__kicker">
          Galeri
          <em>
            {daftar.length}/{MAKS} foto · urutan = urutan di situs
          </em>
        </p>
        <ol className="mjl__fotolist" aria-label="Foto 1 sampai 5">
          {kiri.map((b, i) => ubin(b, i))}
        </ol>
        <Folio k={k} hal={3} sisi="kiri" teks={`${k.studio} · Galeri`} />
      </article>
      <article className="mjl__hal is-kanan is-galeri" aria-label="Halaman 4 — galeri lanjutan">
        <p className="mjl__kicker">
          {k.judul}
          <em>seret = ubah urutan</em>
        </p>
        <ol className="mjl__fotolist" aria-label="Foto 6 sampai 10">
          {kanan.map((b, i) => ubin(b, i + 5))}
        </ol>
        <Folio k={k} hal={4} sisi="kanan" teks={`${k.judul} · Galeri`} />
      </article>
    </div>
  );
}

/* ---- Spread 3: kredit & pencarian -------------------------------------------------------- */

function Kredit({ k }: { k: Kit }) {
  const judulCari = k.teks("seoTitle").trim() || k.judul;
  const ketCari = k.teks("seoDescription").trim() || k.teks("summary").trim();
  const ketCariTampil = ketCari.length > 158 ? `${ketCari.slice(0, 155).trimEnd()}…` : ketCari;
  const panjangJudul = `${judulCari} — ${k.studio}`.length;
  const slug = k.teks("slug") || k.asli.slug;
  const dicari = (id: string) => (k.dicari === id ? " is-dicari" : "");

  return (
    <>
      <article className="mjl__hal is-kiri is-kredit" aria-label="Halaman 5 — kredit">
        <p className="mjl__kicker">
          Kredit
          {k.menyusul > 0 && <em className="is-amber">{k.menyusul} menyusul</em>}
        </p>
        <div className={`mjl__kredit${dicari("kredit")}`}>
          {k.kredit.map((c) => {
            const kosong = !k.teks(c.k).trim();
            return (
              <label key={c.k} className={`mjl__kbaris${k.pensil(c.k) ? " is-pensil" : ""}${kosong && c.kosong === BELUM_ADA ? " is-tunggu" : ""}`}>
                <span>{c.label}</span>
                <input id={`mjl-kredit-${c.k}`} value={k.teks(c.k)} placeholder={c.kosong} onChange={(e) => k.set(c.k, e.currentTarget.value)} />
              </label>
            );
          })}
        </div>
        <section className="mjl__internal" aria-labelledby="mjl-internal-judul">
          <p className="mjl__kicker" id="mjl-internal-judul">
            Data internal <em className="is-amber">tidak tampil di situs</em>
          </p>
          <div className="mjl__internalisi">
            <label className={`mjl__ibaris${k.pensil("city") ? " is-pensil" : ""}`}>
              <span>Kota</span>
              <input value={k.teks("city")} placeholder="Pontianak" onChange={(e) => k.set("city", e.currentTarget.value)} />
            </label>
            <label
              className={`mjl__ibaris${k.pensil("clientWhatsapp") ? " is-pensil" : ""}`}
              title="Dipakai tombol WhatsApp di bukti pembayaran"
            >
              <span>WA klien</span>
              <input
                type="tel"
                inputMode="tel"
                value={k.teks("clientWhatsapp")}
                placeholder="628123456789"
                onChange={(e) => k.set("clientWhatsapp", e.currentTarget.value)}
              />
            </label>
          </div>
          <p className="mjl__internalket">Kota dipakai sebagai lokasi kalau sel Lokasi di pembuka kosong.</p>
        </section>
        <Folio k={k} hal={5} sisi="kiri" teks={`${k.studio} · Kredit`} />
      </article>

      <article className="mjl__hal is-kanan is-kredit" aria-label="Halaman 6 — pencarian">
        <p className="mjl__kicker">Di mesin pencari</p>
        <label className={`mjl__alamat${k.pensil("slug") ? " is-pensil" : ""}`}>
          <span>Alamat halaman</span>
          <span className="mjl__alamatisi">
            {DOMAIN}/proyek/
            <input value={k.teks("slug")} spellCheck={false} onChange={(e) => k.set("slug", e.currentTarget.value)} />
          </span>
        </label>
        <figure className="mjl__serp" aria-label="Pratinjau hasil pencarian">
          <p className="mjl__serpalamat">
            {DOMAIN} › proyek › {slug}
          </p>
          <p className={`mjl__serpjudul${panjangJudul > 60 ? " is-potong" : ""}`}>
            {judulCari} — {k.studio}
          </p>
          <p className="mjl__serpket">{ketCariTampil || "Deskripsi bawaan studio dipakai — ringkasan dan deskripsi pencarian kosong."}</p>
        </figure>
        <label className={`mjl__seo${k.pensil("seoTitle") ? " is-pensil" : ""}${k.teks("seoTitle").length > 60 ? " is-amber" : ""}${dicari("cari")}`}>
          <span>
            Judul di pencarian
            <em>{k.teks("seoTitle").length || k.judul.length}/60</em>
          </span>
          <input id="mjl-seojudul" value={k.teks("seoTitle")} placeholder={k.judul} onChange={(e) => k.set("seoTitle", e.currentTarget.value)} />
        </label>
        <label className={`mjl__seo is-area${k.pensil("seoDescription") ? " is-pensil" : ""}${k.teks("seoDescription").length > 160 ? " is-amber" : ""}`}>
          <span>
            Deskripsi di pencarian
            <em>{k.teks("seoDescription").length}/200</em>
          </span>
          <textarea
            rows={2}
            maxLength={200}
            value={k.teks("seoDescription")}
            placeholder={k.teks("summary") || "Satu kalimat di bawah judul pada hasil pencarian."}
            onChange={(e) => k.set("seoDescription", e.currentTarget.value)}
          />
        </label>
        <figure className="mjl__bagikan" aria-label="Pratinjau kartu bagikan">
          <span className="mjl__bagikanfoto" style={{ "--mjl-a": String(k.rasioSampul ?? RASIO) } as CSSProperties}>
            {k.urlSampul ? <img src={k.urlSampul} alt="" decoding="async" /> : <Ikon ikon={ImageSquare} ukuran={18} />}
          </span>
          <figcaption>
            <small>{DOMAIN}</small>
            <b>{judulCari}</b>
            <span>{ketCari || "—"}</span>
            {k.urlSampul && k.potongBagikan.buang >= 0.02 && <em>foto dipotong {persen(k.potongBagikan.buang)}</em>}
          </figcaption>
        </figure>
        <Folio k={k} hal={6} sisi="kanan" teks={`${k.judul} · Pencarian`} />
      </article>
    </>
  );
}

/* ---- Lembar periksa cetak ---------------------------------------------------------------- */

const IKON_PERIKSA: Record<Periksa["nada"], ReactNode> = {
  ok: (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <path d="M3.5 8.4l3 3 6-6.6" />
    </svg>
  ),
  catat: (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <path d="M8 3.5v5.5M8 11.6v.4" />
    </svg>
  ),
  wajib: (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <path d="M8 3.5v5.5M8 11.6v.4" />
    </svg>
  ),
  lewat: (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <path d="M4.5 8h7" />
    </svg>
  ),
};

function Slip({
  kode,
  status,
  pensilStatus,
  tercap,
  adaSampul,
  onPutus,
  tanggalTerbit,
  unggulan,
  pensilUnggulan,
  onUnggulan,
  ketUnggulan,
  keadaan,
  bisaDilihat,
  slug,
  periksa,
  onLompat,
  koreksi,
  spread,
}: {
  kode: string;
  status: string;
  pensilStatus: boolean;
  tercap: boolean;
  adaSampul: boolean;
  onPutus: (v: string) => void;
  tanggalTerbit: Date;
  unggulan: boolean;
  pensilUnggulan: boolean;
  onUnggulan: () => void;
  ketUnggulan: string;
  keadaan: { nada: string; teks: string };
  bisaDilihat: boolean;
  slug: string;
  periksa: Periksa[];
  onLompat: (id: Periksa["id"]) => void;
  koreksi: number;
  spread: number;
}) {
  const tuts = useRef<(HTMLButtonElement | null)[]>([]);
  /* Pola radio ARIA: satu tab-stop, panah memindah DAN memilih. ACC cetak
     tanpa sampul dilewati. */
  function tombol(e: KeyboardEvent, i: number) {
    const arah = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!arah && e.key !== "Home" && e.key !== "End") return;
    e.preventDefault();
    let j = e.key === "Home" ? 0 : e.key === "End" ? STATUS.length - 1 : (i + arah + STATUS.length) % STATUS.length;
    if (STATUS[j]!.nilai === "published" && !adaSampul) j = (j + (arah || 1) + STATUS.length) % STATUS.length;
    onPutus(STATUS[j]!.nilai);
    tuts.current[j]?.focus();
  }
  const beres = periksa.filter((p) => p.nada === "ok" || p.nada === "lewat").length;
  const wajib = periksa.some((p) => p.nada === "wajib");

  return (
    <aside className="mjl__slip" aria-label="Lembar periksa cetak">
      <div className="mjl__slipkertas">
        <header className="mjl__slipkop">
          <p>
            Cetak coba <span>proof</span>
          </p>
          <b>No. {kode}</b>
        </header>
        <div className={`mjl__tayang is-${keadaan.nada}`}>
          <span>
            <i aria-hidden="true" />
            {keadaan.teks}
          </span>
          {bisaDilihat ? (
            <a href={`/proyek/${slug}`} target="_blank" rel="noreferrer">
              /proyek/{slug}
              <Ikon ikon={Globe} ukuran={11} />
            </a>
          ) : (
            <small>/proyek/{slug}</small>
          )}
        </div>

        <p className="mjl__sliplabel" id="mjl-putus">
          Keputusan
        </p>
        <div className={`mjl__putus${pensilStatus ? " is-pensil" : ""}`} role="radiogroup" aria-labelledby="mjl-putus">
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
                data-status={s.nilai}
                className={`mjl__kotakcap is-${s.nilai}${pilih ? " is-pilih" : ""}${mati ? " is-mati" : ""}`}
                title={mati ? "Pasang sampul dulu — proyek tanpa sampul tidak bisa terbit" : s.ket}
                onClick={() => onPutus(s.nilai)}
                onKeyDown={(e) => tombol(e, i)}
              >
                <span className="mjl__kotaklabel">{s.cap}</span>
                <small>
                  <i aria-hidden="true" />
                  {s.label}
                </small>
                <span className="mjl__ruangcap" aria-hidden="true">
                  {pilih && (
                    <span key={`${s.nilai}-${pensilStatus}`} className={`mjl__segel${tercap ? " is-tercap" : ""}`}>
                      <b>{s.cap}</b>
                      <small>{s.nilai === "published" ? tanggalCap(tanggalTerbit) : kode}</small>
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          aria-pressed={unggulan}
          className={`mjl__beranda${unggulan ? " is-nyala" : ""}${pensilUnggulan ? " is-pensil" : ""}`}
          onClick={onUnggulan}
        >
          <span className="mjl__centang" aria-hidden="true">
            {unggulan && (
              <svg viewBox="0 0 16 16" width="12" height="12">
                <path d="M3.5 8.4l3 3 6-6.6" />
              </svg>
            )}
          </span>
          <span className="mjl__berandateks">
            <b>Sampul depan · beranda</b>
            <small>{ketUnggulan}</small>
          </span>
        </button>

        <section className={`mjl__periksa${wajib ? " is-wajib" : ""}`} aria-labelledby="mjl-periksa-judul">
          <header>
            <p className="mjl__sliplabel" id="mjl-periksa-judul">
              Periksa sebelum cetak
            </p>
            <b>
              {beres}/{periksa.length}
            </b>
          </header>
          <ol>
            {periksa.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className={`mjl__cek is-${p.nada}${p.id === "galeri" ? (spread === 1 ? " is-sini" : "") : ["kredit", "cari"].includes(p.id) ? (spread === 2 ? " is-sini" : "") : spread === 0 ? " is-sini" : ""}`}
                  data-periksa={p.id}
                  onClick={() => onLompat(p.id)}
                >
                  <span className="mjl__cektanda">{IKON_PERIKSA[p.nada]}</span>
                  <span className="mjl__ceklabel">{p.label}</span>
                  <span className="mjl__ceknilai">{p.nilai}</span>
                </button>
              </li>
            ))}
          </ol>
        </section>

        <footer className={`mjl__slipkaki${koreksi ? " is-pensil" : ""}`}>
          {koreksi ? `${koreksi} koreksi masih pensil — tekan Simpan` : "Semua koreksi sudah tinta"}
        </footer>
      </div>
    </aside>
  );
}

/* ---- Kerangka memuat: papan yang sama, setinggi aslinya ------------------------------ */

function Rangka() {
  return (
    <div className="mjl" aria-busy="true">
      <div className="mjl__papan mjl__papan--rangka">
        <div className="mjl__kop">
          <div className="mjl__kopjudul">
            <p>Majalah karya</p>
            <span className="mjl__rangkabar" />
          </div>
        </div>
        <div className="mjl__meja">
          <div className="mjl__buka">
            <div className="mjl__hal is-kiri" />
            <div className="mjl__hal is-kanan" />
          </div>
        </div>
        <div className="mjl__slip">
          <div className="mjl__slipkertas" />
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
