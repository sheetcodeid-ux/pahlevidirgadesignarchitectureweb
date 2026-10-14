import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { RequireAuth } from "./RequireAuth";
import { ToastProvider, useToast } from "../kit/Toast";
import { Dialog } from "../kit/Overlay";
import { Bidang, IsianTanggal, Kombo, Pilih, PilihMenu, PilihTanggal } from "../kit/Formulir";
import { Cari, Isian } from "../kit/Isian";
import { Tombol } from "../kit/Tombol";
import { Ikon } from "../kit/Ikon";
import { CaretDown, Check, Plus } from "../kit/ikon";
import { HapusBaris, Inisial } from "./daftarKit";
import { Hitung, geraknya } from "./hitung";
import { kodeProyek } from "../../lib/nomorDokumen";
import { TAHAP_PROYEK } from "../../lib/notifikasi";
import {
  daftarTugas,
  tambahTugas,
  ubahTugas,
  hapusTugas,
  daftarProyek,
  daftarTim,
  bacaCache,
  tulisCache,
  type Tugas,
  type Proyek,
  type AnggotaTim,
} from "../../lib/admin";

/* =============================================================================
   Tugas = RAK BAKI GAMBAR + LEMBAR DISPOSISI.

   Di studio, pekerjaan gambar BERPINDAH MEJA: drafter mengerjakannya, kepala
   studio memeriksanya, lalu gambarnya dikirim ke klien dan menunggu
   tanggapan sebelum diarsip. Benda yang memegang alur itu rak baki dokumen
   bertingkat di meja studio — satu baki per tahap pemeriksaan — dan tiap
   lembar kerja membawa LEMBAR DISPOSISI: kepada siapa, sampai kapan, dan
   sudah sampai mana.

   1. RAK — empat baki menurut `task_status`: Belum mulai → Berjalan →
      Review internal → Ke klien (menunggu_klien). Isinya lembar kerja
      berkode proyek (`kodeProyek`, sama dengan kuitansi dan tagihan) dan
      tahap pipeline, urut tenggat (yang jatuh tempo paling atas, tanpa
      tenggat paling bawah). Tebal tumpukan di dasar baki = banyaknya lembar.
      Centang di tiap lembar = selesai dalam satu klik (dibawa dari halaman
      lama, pekerjaan yang paling sering).
   2. BAKI ARSIP — lembar yang selesai 7 hari terakhir (dibaca dari
      `updatedAt`), atau seluruh arsip.
   3. LEMBAR DISPOSISI — kertas putih tetap: nomor TG-{KODE}-{NN} (urutan
      dibuat di proyek itu), ALUR lima stasiun yang sekaligus pemilih status,
      Proyek / Tahap / PIC / Tenggat yang diubah di tempat, tombol teruskan
      dan kembalikan, cap SELESAI, riwayat (dibuat, terakhir diubah), hapus.
   4. KOP — Jatuh tempo (aturan yang SAMA dengan lonceng: tenggat ≤ hari
      ini), Berjalan, Ke klien, Selesai 7 hari. Jatuh tempo bisa diklik
      untuk menyaring.

   SATU-SATUNYA gerak: lembar yang dipindah status MELUNCUR dari bakinya ke
   baki tujuan (salinan di lapisan `fixed`, supaya tidak terpotong baki yang
   menggulir) — hanya karena perbuatan, tidak saat dimuat (jebakan #74),
   seketika bila gerak dikurangi. Disentuh tetikus, lembar terangkat 2px.
   ============================================================================= */

interface Langkah {
  nilai: string;
  label: string;
  /** Nama di pelat baki (pelatnya cuma ±170px). */
  pelat: string;
  pendek: string;
  ket: string;
}

const ALUR: Langkah[] = [
  { nilai: "belum_mulai", label: "Belum mulai", pelat: "Belum mulai", pendek: "Belum", ket: "menunggu dikerjakan" },
  { nilai: "berjalan", label: "Berjalan", pelat: "Berjalan", pendek: "Jalan", ket: "di meja gambar" },
  { nilai: "review_internal", label: "Review internal", pelat: "Review", pendek: "Review", ket: "diperiksa studio" },
  { nilai: "menunggu_klien", label: "Ke klien", pelat: "Ke klien", pendek: "Klien", ket: "menunggu tanggapan" },
  { nilai: "selesai", label: "Selesai", pelat: "Selesai", pendek: "Selesai", ket: "diarsip" },
];
const BAKI = ALUR.slice(0, 4);
const LANGKAH = Object.fromEntries(ALUR.map((l, i) => [l.nilai, i])) as Record<string, number>;
const LABEL = Object.fromEntries(ALUR.map((l) => [l.nilai, l.label])) as Record<string, string>;

/** Kode tahap pipeline di pojok lembar kerja. */
const KODE_TAHAP: Record<string, string> = {
  proposal: "PRP",
  deal_kontrak: "KTR",
  dp_50: "DP",
  desain_1: "D1",
  desain_2: "D2",
  finish: "FIN",
  pelunasan: "LNS",
};
const URUT_TAHAP = Object.keys(KODE_TAHAP);

const BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const tglPendek = (iso: string) => {
  const [, m, d] = iso.slice(0, 10).split("-").map(Number);
  return `${d} ${BULAN[(m ?? 1) - 1]}`;
};
/** Tanggal waktu (createdAt/updatedAt) menurut zona peramban. */
const tglWaktu = (iso: string) => {
  const d = new Date(iso);
  return `${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}`;
};

const HARI = 864e5;
/* Hari ini dengan rumus yang SAMA dengan lib/notifikasi, supaya angka "Jatuh
   tempo" di kop sama dengan angka TENGGAT di lonceng. */
const hariIni = () => new Date().toISOString().slice(0, 10);
const selisihHari = (iso: string, kini: string) => Math.round((Date.parse(iso.slice(0, 10)) - Date.parse(kini)) / HARI);

function kataTenggat(t: Tugas, kini: string): { teks: string; nada: "lewat" | "dekat" | "biasa" | "kosong" } {
  if (!t.dueDate) return { teks: "tanpa tenggat", nada: "kosong" };
  if (t.status === "selesai") return { teks: tglPendek(t.dueDate), nada: "biasa" };
  const s = selisihHari(t.dueDate, kini);
  if (s < 0) return { teks: `lewat ${-s} hr`, nada: "lewat" };
  if (s === 0) return { teks: "hari ini", nada: "lewat" };
  if (s === 1) return { teks: "besok", nada: "dekat" };
  if (s < 7) return { teks: `${s} hr lagi`, nada: "dekat" };
  return { teks: tglPendek(t.dueDate), nada: "biasa" };
}

const jatuhTempo = (t: Tugas, kini: string) => t.status !== "selesai" && Boolean(t.dueDate) && t.dueDate!.slice(0, 10) <= kini;

/** Urutan di dalam baki: tenggat terdekat dulu, tanpa tenggat di dasar. */
function urutBaki(a: Tugas, b: Tugas) {
  const da = a.dueDate?.slice(0, 10);
  const db = b.dueDate?.slice(0, 10);
  if (da !== db) {
    if (!da) return 1;
    if (!db) return -1;
    return da < db ? -1 : 1;
  }
  return a.sortOrder - b.sortOrder || a.title.localeCompare(b.title, "id");
}

/** Lima stasiun alur; menurunkan "teruskan ke" dan "kembalikan ke". */
function berikut(status: string): Langkah | null {
  const i = LANGKAH[status] ?? 0;
  return i < ALUR.length - 1 ? ALUR[i + 1]! : null;
}
function sebelum(status: string): Langkah | null {
  /* Review dan Ke klien yang dikembalikan berarti revisi: kembali ke meja
     gambar (Berjalan), bukan ke baki tepat di kirinya. */
  if (status === "review_internal" || status === "menunggu_klien" || status === "selesai") return ALUR[1]!;
  if (status === "berjalan") return ALUR[0]!;
  return null;
}

function Isi() {
  const toast = useToast();
  const [tugas, setTugas] = useState<Tugas[] | null>(() => bacaCache<Tugas[]>("tugas"));
  /* Dipakai dialog tambah, saringan, dan pemilih PIC/tahap. Pelengkap —
     halaman tetap berguna kalau salah satunya gagal. */
  const [proyek, setProyek] = useState<Proyek[]>([]);
  const [tim, setTim] = useState<AnggotaTim[]>([]);
  const [galat, setGalat] = useState(false);
  const [cari, setCari] = useState("");
  const [saringProyek, setSaringProyek] = useState("semua");
  const [pic, setPic] = useState("semua");
  const [hanyaTempo, setHanyaTempo] = useState(false);
  const [arsipSemua, setArsipSemua] = useState(false);
  const [pilih, setPilih] = useState<string | null>(null);
  const [tercap, setTercap] = useState(0);
  const [baru, setBaru] = useState<string | null>(null);
  const kini = hariIni();

  const lapisRef = useRef<HTMLDivElement>(null);
  /* Lembar yang sedang diterbangkan: kotak asalnya dan salinannya, dibaca
     SEKALI saat perbuatan (bukan saat menggulir). */
  const terbang = useRef<{ id: string; dari: DOMRect; salinan: HTMLElement } | null>(null);
  const fokusKe = useRef<string | null>(null);
  const waktu = useRef<number[]>([]);

  function muat(pilihId?: string) {
    daftarTugas()
      .then((d) => {
        tulisCache("tugas", d);
        setTugas(d);
        setGalat(false);
        if (pilihId) setPilih(pilihId);
      })
      .catch(() => {
        setGalat(true);
        setTugas((l) => l ?? []);
      });
  }
  useEffect(() => {
    muat();
    daftarProyek()
      .then(setProyek)
      .catch(() => setProyek([]));
    daftarTim()
      .then(setTim)
      .catch(() => setTim([]));
    const q = new URLSearchParams(location.search).get("tugas");
    if (q) setPilih(q);
    const w = waktu.current;
    return () => w.forEach((x) => window.clearTimeout(x));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---- Saringan ---- */
  const cocok = (t: Tugas) => {
    const q = cari.trim().toLowerCase();
    if (saringProyek !== "semua" && t.projectId !== saringProyek) return false;
    if (pic !== "semua" && (pic === "tanpa" ? Boolean(t.assigneeName) : t.assigneeName !== pic)) return false;
    if (q && ![t.title, t.projectTitle, t.assigneeName, LABEL[t.status], KODE_TAHAP[t.stage ?? ""]].some((v) => (v ?? "").toLowerCase().includes(q)))
      return false;
    return true;
  };

  const semua = tugas ?? [];
  const isiBaki = useMemo(
    () =>
      Object.fromEntries(
        BAKI.map((b) => [
          b.nilai,
          semua.filter((t) => t.status === b.nilai && cocok(t) && (!hanyaTempo || jatuhTempo(t, kini))).sort(urutBaki),
        ]),
      ) as Record<string, Tugas[]>,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tugas, cari, saringProyek, pic, hanyaTempo, kini],
  );
  const tujuhHari = Date.now() - 7 * HARI;
  const selesaiBaru = (t: Tugas) => t.status === "selesai" && Boolean(t.updatedAt) && Date.parse(t.updatedAt!) >= tujuhHari;
  const arsip = useMemo(
    () =>
      semua
        .filter((t) => t.status === "selesai" && cocok(t) && (arsipSemua || selesaiBaru(t)))
        .sort((a, b) => Date.parse(b.updatedAt ?? "0") - Date.parse(a.updatedAt ?? "0")),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tugas, cari, saringProyek, pic, arsipSemua],
  );

  const angka = useMemo(() => {
    const aktif = semua.filter((t) => t.status !== "selesai");
    return {
      aktif: aktif.length,
      tempo: aktif.filter((t) => jatuhTempo(t, kini)).length,
      berjalan: aktif.filter((t) => t.status === "berjalan").length,
      klien: aktif.filter((t) => t.status === "menunggu_klien").length,
      selesai7: semua.filter(selesaiBaru).length,
      arsipTotal: semua.filter((t) => t.status === "selesai").length,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tugas, kini]);

  /* Nomor disposisi: urutan dibuat di proyek itu (createdAt, lalu id) —
     diturunkan dari data seperti nomor kuitansi, bukan nomor karangan. */
  const nomor = useMemo(() => {
    const per: Record<string, Tugas[]> = {};
    for (const t of semua) (per[t.projectId] ??= []).push(t);
    const out: Record<string, string> = {};
    for (const daftar of Object.values(per)) {
      daftar
        .slice()
        .sort((a, b) => (a.createdAt ?? "").localeCompare(b.createdAt ?? "") || a.sortOrder - b.sortOrder || a.id.localeCompare(b.id))
        .forEach((t, i) => (out[t.id] = `TG-${kodeProyek(t.projectTitle ?? "")}-${String(i + 1).padStart(2, "0")}`));
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tugas]);

  /* Lembar terpilih: pilihan staf kalau masih ada, kalau tidak yang paling
     mendesak — tenggat terdekat di antara yang belum selesai. */
  const terlihatAktif = BAKI.flatMap((b) => isiBaki[b.nilai] ?? []).sort(urutBaki);
  const aktifUrut = semua.filter((t) => t.status !== "selesai").sort(urutBaki);
  const terpilih = semua.find((t) => t.id === pilih) ?? terlihatAktif[0] ?? aktifUrut[0] ?? arsip[0] ?? null;

  const daftarPic = useMemo(
    () => [...new Set(semua.map((t) => t.assigneeName).filter((n): n is string => Boolean(n)))].sort((a, b) => a.localeCompare(b, "id")),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tugas],
  );

  /* ---- Perbuatan ---- */
  const tunda = (f: () => void, ms: number) => waktu.current.push(window.setTimeout(f, ms));

  function catatTerbang(id: string) {
    if (!geraknya()) return;
    const el = document.querySelector<HTMLElement>(`[data-lembar="${CSS.escape(id)}"]`);
    if (!el) return;
    const dari = el.getBoundingClientRect();
    const salinan = el.cloneNode(true) as HTMLElement;
    salinan.removeAttribute("id");
    salinan.querySelectorAll("[id]").forEach((x) => x.removeAttribute("id"));
    salinan.setAttribute("inert", "");
    salinan.setAttribute("aria-hidden", "true");
    terbang.current = { id, dari, salinan };
  }

  async function ubah(t: Tugas, patch: Partial<Tugas>, pesan?: string) {
    const lama = t;
    setTugas((l) => l?.map((x) => (x.id === t.id ? { ...x, ...patch, updatedAt: new Date().toISOString() } : x)) ?? l);
    try {
      /* Nama PIC cuma untuk tampilan lokal — Worker menurunkannya dari id. */
      const kirim = { ...patch };
      delete kirim.assigneeName;
      await ubahTugas(t.id, kirim);
      if (pesan) toast({ judul: pesan, keterangan: t.title, nada: "sukses" });
    } catch (e) {
      setTugas((l) => l?.map((x) => (x.id === t.id ? lama : x)) ?? l);
      toast({ judul: "Gagal menyimpan perubahan", keterangan: (e as Error).message, nada: "gagal" });
    }
  }

  function pindah(t: Tugas, status: string) {
    if (status === t.status) return;
    catatTerbang(t.id);
    setPilih(t.id);
    if (status === "selesai" && geraknya()) {
      setTercap((n) => n + 1);
    }
    void ubah(t, { status }, status === "selesai" ? "Tugas selesai" : `Dipindah ke ${LABEL[status]}`);
  }

  async function hapus(t: Tugas) {
    /* Lembar berikutnya di baki yang sama jadi pilihan — fokus papan ketik
       dijaga `HapusBaris` (lib/fokus). */
    const baki = t.status === "selesai" ? arsip : isiBaki[t.status] ?? [];
    const i = baki.findIndex((x) => x.id === t.id);
    const ganti = baki[i + 1] ?? baki[i - 1] ?? null;
    setTugas((l) => l?.filter((x) => x.id !== t.id) ?? l);
    setPilih(ganti?.id ?? null);
    try {
      await hapusTugas(t.id);
      toast({ judul: "Tugas dihapus", keterangan: t.title, nada: "sukses" });
    } catch (e) {
      muat();
      toast({ judul: "Gagal menghapus", keterangan: (e as Error).message, nada: "gagal" });
    }
  }

  /* Terbangkan salinan dari kotak asal ke kotak lembar di tempat barunya.
     Salinannya di lapisan `fixed` di luar baki — kalau lembar aslinya yang
     digeser, baki tujuan yang menggulir memotongnya separuh jalan. */
  useLayoutEffect(() => {
    const f = terbang.current;
    const lapis = lapisRef.current;
    if (!f || !lapis) return;
    terbang.current = null;
    const tujuan = document.querySelector<HTMLElement>(`[data-lembar="${CSS.escape(f.id)}"]`);
    const s = f.salinan;
    s.classList.add("rbg__salinan");
    Object.assign(s.style, {
      left: `${f.dari.left}px`,
      top: `${f.dari.top}px`,
      width: `${f.dari.width}px`,
      height: `${f.dari.height}px`,
    });
    lapis.appendChild(s);
    if (!tujuan) {
      s.animate([{ opacity: 1 }, { opacity: 0, transform: "translateY(8px)" }], { duration: 320, easing: "ease-out" }).onfinish = () => s.remove();
      return;
    }
    tujuan.scrollIntoView({ block: "nearest", inline: "nearest" });
    const ke = tujuan.getBoundingClientRect();
    tujuan.style.visibility = "hidden";
    const dx = ke.left - f.dari.left;
    const dy = ke.top - f.dari.top;
    const sx = ke.width / f.dari.width;
    const sy = ke.height / f.dari.height;
    const a = s.animate(
      [
        { transform: "translate(0, 0) scale(1, 1)", boxShadow: "0 0 0 0 transparent" },
        { transform: `translate(${dx * 0.5}px, ${dy * 0.5 - 18}px) scale(${(1 + sx) / 2}, ${(1 + sy) / 2}) rotate(-1.5deg)`, offset: 0.5 },
        { transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})` },
      ],
      { duration: 560, easing: "cubic-bezier(0.22, 0.7, 0.2, 1)" },
    );
    a.onfinish = a.oncancel = () => {
      s.remove();
      tujuan.style.visibility = "";
    };
  }, [tugas]);

  /* Fokus papan ketik mengikuti pilihan yang dipindah lewat panah. */
  useLayoutEffect(() => {
    const id = fokusKe.current;
    if (!id) return;
    fokusKe.current = null;
    const el = document.querySelector<HTMLElement>(`[data-lembar="${CSS.escape(id)}"] .rbg__lbuka`);
    el?.focus();
    el?.scrollIntoView({ block: "nearest" });
  }, [pilih]);

  /* Panah di rak: ↑/↓ di dalam baki, ←/→ ke baki tetangga (urutan sama
     atau yang terakhir), Home/End di dalam baki. */
  function tombolRak(e: KeyboardEvent<HTMLElement>) {
    if (!terpilih) return;
    const kolom = BAKI.map((b) => isiBaki[b.nilai] ?? []);
    const k = kolom.findIndex((c) => c.some((t) => t.id === terpilih.id));
    if (k < 0) return;
    const i = kolom[k]!.findIndex((t) => t.id === terpilih.id);
    let tuju: Tugas | undefined;
    if (e.key === "ArrowDown") tuju = kolom[k]![i + 1];
    else if (e.key === "ArrowUp") tuju = kolom[k]![i - 1];
    else if (e.key === "Home") tuju = kolom[k]![0];
    else if (e.key === "End") tuju = kolom[k]![kolom[k]!.length - 1];
    else if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      const arah = e.key === "ArrowRight" ? 1 : -1;
      for (let j = k + arah; j >= 0 && j < kolom.length; j += arah) {
        if (kolom[j]!.length) {
          tuju = kolom[j]![Math.min(i, kolom[j]!.length - 1)];
          break;
        }
      }
    } else return;
    e.preventDefault();
    if (tuju) {
      fokusKe.current = tuju.id;
      setPilih(tuju.id);
    }
  }

  /* ---- Lembar kerja di baki ---- */
  /* Fungsi biasa, BUKAN komponen: komponen yang didefinisikan di dalam
     render jadi jenis baru tiap render, dan React memasang ulang semua
     lembar — fokus papan ketik hilang dan lembar tujuan terbang ikut lenyap. */
  const lembar = (t: Tugas, kecil?: boolean) => {
    const tg = kataTenggat(t, kini);
    const dipilih = terpilih?.id === t.id;
    return (
      <li
        key={t.id}
        className={`rbg__lembar${dipilih ? " is-pilih" : ""}${tg.nada === "lewat" ? " is-tempo" : ""}${kecil ? " is-arsip" : ""}${baru === t.id ? " is-baru" : ""}`}
        data-lembar={t.id}
      >
        <button
          type="button"
          className="rbg__lbuka"
          tabIndex={dipilih ? 0 : -1}
          aria-pressed={dipilih}
          aria-label={`${nomor[t.id] ?? ""} ${t.title}, ${t.projectTitle ?? ""}, ${LABEL[t.status]}, ${tg.teks}${t.assigneeName ? `, PIC ${t.assigneeName}` : ""}`}
          onClick={() => {
            setPilih(t.id);
            /* Di ponsel disposisi ada jauh di bawah rak: bawa ke sana. */
            if (matchMedia("(max-width: 47.99rem)").matches)
              requestAnimationFrame(() => document.querySelector(".rbg__disposisi")?.scrollIntoView({ block: "start", behavior: geraknya() ? "smooth" : "auto" }));
          }}
        />
        <span className="rbg__lkop" aria-hidden="true">
          <b className="rbg__kode">{kodeProyek(t.projectTitle ?? "")}</b>
          {t.stage && <span className="rbg__tahap">{KODE_TAHAP[t.stage] ?? t.stage}</span>}
          {!kecil && <span className={`rbg__tgl is-${tg.nada}`}>{tg.teks}</span>}
        </span>
        <span className="rbg__ljudul" aria-hidden="true">
          {t.title}
        </span>
        {!kecil && (
          <span className="rbg__lkaki" aria-hidden="true">
            <span className="rbg__lproyek">{t.projectTitle}</span>
            {t.assigneeName ? <Inisial nama={t.assigneeName} /> : <span className="rbg__tanpapic">tanpa PIC</span>}
          </span>
        )}
        {!kecil && t.status !== "selesai" && (
          <button type="button" className="rbg__centang" aria-label={`Tandai ${t.title} selesai`} onClick={() => pindah(t, "selesai")}>
            <Ikon ikon={Check} ukuran={13} />
          </button>
        )}
      </li>
    );
  };

  if (tugas === null) return <Rangka />;

  const adaSaring = cari.trim() !== "" || saringProyek !== "semua" || pic !== "semua" || hanyaTempo;

  return (
    <div className="rbg">
      <div className="rbg__papan">
        <header className="rbg__kop">
          <div className="rbg__kopjudul">
            <p>Rak baki gambar · {angka.aktif} lembar di meja</p>
            <h2>Tugas studio</h2>
          </div>
          <div className="rbg__ringkas">
            <button
              type="button"
              className={`rbg__rk${angka.tempo ? " is-tempo" : ""}`}
              aria-pressed={hanyaTempo}
              onClick={() => setHanyaTempo((v) => !v)}
            >
              <small>Jatuh tempo</small>
              <b>
                <Hitung nilai={angka.tempo} hidup format={(v) => String(Math.round(v))} />
              </b>
              <span>{hanyaTempo ? "disaring · klik lepas" : "tenggat s.d. hari ini"}</span>
            </button>
            <div className="rbg__rk">
              <small>Berjalan</small>
              <b>
                <Hitung nilai={angka.berjalan} hidup format={(v) => String(Math.round(v))} />
              </b>
              <span>di meja gambar</span>
            </div>
            <div className="rbg__rk">
              <small>Ke klien</small>
              <b>
                <Hitung nilai={angka.klien} hidup format={(v) => String(Math.round(v))} />
              </b>
              <span>menunggu tanggapan</span>
            </div>
            <div className="rbg__rk">
              <small>Selesai 7 hari</small>
              <b>
                <Hitung nilai={angka.selesai7} hidup format={(v) => String(Math.round(v))} />
              </b>
              <span>dari {angka.arsipTotal} diarsip</span>
            </div>
          </div>
        </header>

        <div className="rbg__alat">
          <Cari
            ukuran="small"
            judul="Cari tugas"
            placeholder="Cari lembar, proyek, PIC"
            value={cari}
            onChange={(e) => setCari(e.currentTarget.value)}
            className="rbg__cari"
          />
          <PilihMenu
            label="Saring proyek"
            nilai={saringProyek}
            onUbah={setSaringProyek}
            opsi={[{ nilai: "semua", label: "Semua proyek" }, ...proyek.map((p) => ({ nilai: p.id, label: p.title, ket: kodeProyek(p.title) }))]}
            pemicu={
              <button type="button" className={`rbg__pilih${saringProyek !== "semua" ? " is-aktif" : ""}`}>
                <span>{saringProyek === "semua" ? "Semua proyek" : (proyek.find((p) => p.id === saringProyek)?.title ?? "Proyek")}</span>
                <Ikon ikon={CaretDown} ukuran={12} />
              </button>
            }
          />
          <PilihMenu
            label="Saring PIC"
            nilai={pic}
            onUbah={setPic}
            opsi={[
              { nilai: "semua", label: "Semua PIC" },
              ...daftarPic.map((n) => ({ nilai: n, label: n })),
              { nilai: "tanpa", label: "Tanpa PIC" },
            ]}
            pemicu={
              <button type="button" className={`rbg__pilih${pic !== "semua" ? " is-aktif" : ""}`}>
                <span>{pic === "semua" ? "Semua PIC" : pic === "tanpa" ? "Tanpa PIC" : pic}</span>
                <Ikon ikon={CaretDown} ukuran={12} />
              </button>
            }
          />
          {adaSaring && (
            <button
              type="button"
              className="rbg__lepas"
              onClick={() => {
                setCari("");
                setSaringProyek("semua");
                setPic("semua");
                setHanyaTempo(false);
              }}
            >
              Lepas saringan
            </button>
          )}
          {galat && (
            <button type="button" className="rbg__lepas is-galat" onClick={() => muat()}>
              Gagal memuat · coba lagi
            </button>
          )}
          <DialogTugas
            proyek={proyek}
            tim={tim}
            onSelesai={(id) => {
              muat(id);
              if (geraknya()) {
                setBaru(id);
                tunda(() => setBaru((b) => (b === id ? null : b)), 900);
              }
            }}
          />
        </div>

        <div className="rbg__meja">
          <div className="rbg__rak" role="group" aria-label="Rak baki gambar" onKeyDown={tombolRak}>
            {BAKI.map((b, k) => {
              const isi = isiBaki[b.nilai] ?? [];
              const lewat = isi.filter((t) => jatuhTempo(t, kini)).length;
              return (
                <section key={b.nilai} className={`rbg__baki is-${b.nilai}`} aria-labelledby={`rbg-baki-${b.nilai}`}>
                  <header className="rbg__plat">
                    <i aria-hidden="true">{k + 1}</i>
                    <h3 id={`rbg-baki-${b.nilai}`}>{b.pelat}</h3>
                    <small>
                      <b>{isi.length}</b> lembar
                      {lewat > 0 && <span className="rbg__plewat"> · {lewat} lewat</span>}
                    </small>
                  </header>
                  <ul className="rbg__isi">
                    {isi.map((t) => lembar(t))}
                    {!isi.length && <li className="rbg__kosong">{adaSaring ? "Tidak ada yang cocok" : "Baki kosong"}</li>}
                  </ul>
                  {/* Tebal tumpukan = banyaknya lembar di baki (maks. 8 garis). */}
                  <span className="rbg__tumpuk" style={{ "--rbg-tumpuk": Math.min(8, isi.length) } as CSSProperties} aria-hidden="true" />
                </section>
              );
            })}
          </div>

          <section className="rbg__arsip" aria-labelledby="rbg-arsip">
            <header className="rbg__arsipkop">
              <i aria-hidden="true">5</i>
              <h3 id="rbg-arsip">Baki arsip · selesai</h3>
              <span>{arsipSemua ? `${arsip.length} lembar` : `${arsip.length} lembar · 7 hari terakhir`}</span>
              <button type="button" className="rbg__arsiptuas" aria-pressed={arsipSemua} onClick={() => setArsipSemua((v) => !v)}>
                {arsipSemua ? "7 hari terakhir" : `Semua arsip (${angka.arsipTotal})`}
              </button>
            </header>
            <ul className="rbg__arsipisi">
              {arsip.map((t) => lembar(t, true))}
              {!arsip.length && <li className="rbg__kosong">{arsipSemua ? "Belum ada yang selesai" : "Belum ada yang selesai minggu ini"}</li>}
            </ul>
          </section>
        </div>

        <Disposisi
          t={terpilih}
          nomor={nomor}
          sekerja={terpilih ? semua.filter((x) => x.projectId === terpilih.projectId) : []}
          onPilih={setPilih}
          kini={kini}
          tim={tim}
          tercap={tercap}
          onPindah={pindah}
          onUbah={ubah}
          onHapus={hapus}
        />
      </div>
      {/* Lapisan salinan lembar yang sedang terbang — tidak pernah dirender React. */}
      <div ref={lapisRef} className="rbg__lapis" aria-hidden="true" />
    </div>
  );
}

/* ---- Lembar disposisi ---------------------------------------------------------- */
function Disposisi({
  t,
  nomor,
  sekerja,
  onPilih,
  kini,
  tim,
  tercap,
  onPindah,
  onUbah,
  onHapus,
}: {
  t: Tugas | null;
  nomor: Record<string, string>;
  /** Semua lembar kerja di proyek yang sama, termasuk lembar ini. */
  sekerja: Tugas[];
  onPilih: (id: string) => void;
  kini: string;
  tim: AnggotaTim[];
  tercap: number;
  onPindah: (t: Tugas, status: string) => void;
  onUbah: (t: Tugas, patch: Partial<Tugas>, pesan?: string) => void;
  onHapus: (t: Tugas) => Promise<void>;
}) {
  /* Cap SELESAI "tercap" hanya kalau dibubuhkan di depan mata: `tercap`
     naik hanya oleh perbuatan, dan kuncinya ikut tugasnya. */
  const capAwal = useRef(tercap);
  const [capHidup, setCapHidup] = useState(false);
  useEffect(() => {
    if (tercap !== capAwal.current) {
      capAwal.current = tercap;
      setCapHidup(true);
      const w = window.setTimeout(() => setCapHidup(false), 700);
      return () => window.clearTimeout(w);
    }
  }, [tercap]);

  if (!t) {
    return (
      <aside className="rbg__kertas rbg__disposisi is-kosong" aria-label="Lembar disposisi">
        <p className="rbg__dlabel">Lembar disposisi</p>
        <p className="rbg__dkosong">Belum ada lembar kerja. Tekan Tambah tugas untuk menaruh yang pertama di baki.</p>
      </aside>
    );
  }
  const i = LANGKAH[t.status] ?? 0;
  const maju = berikut(t.status);
  const mundur = sebelum(t.status);
  const tg = kataTenggat(t, kini);
  const sisa = t.dueDate && t.status !== "selesai" ? selisihHari(t.dueDate, kini) : null;
  const opsiPic = [
    { nilai: "-", label: "Tanpa PIC" },
    ...tim.filter((m) => m.active || m.id === t.assigneeId).map((m) => ({ nilai: m.id, label: m.name, ket: m.role || undefined })),
  ];
  /* Nama PIC lama yang anggotanya tidak ada di daftar tim tetap tertulis. */
  const namaPic = t.assigneeName ?? "Tanpa PIC";

  return (
    <aside className="rbg__kertas rbg__disposisi" aria-labelledby="rbg-djudul">
      <header className="rbg__dkop">
        <div>
          <p className="rbg__dlabel">Lembar disposisi</p>
          <h3 id="rbg-djudul">{t.title}</h3>
          <small>
            No. <b>{nomor[t.id] ?? "—"}</b> · {t.projectTitle ?? "—"}
          </small>
        </div>
        {t.status === "selesai" && (
          <span key={`cap-${t.id}`} className={`rbg__cap${capHidup ? " is-tercap" : ""}`} aria-label="Selesai">
            <b>Selesai</b>
            <small>{t.updatedAt ? tglWaktu(t.updatedAt) : ""}</small>
          </span>
        )}
      </header>

      {/* Alur pemeriksaan: lima stasiun, sekaligus pemilih status. */}
      <div className="rbg__alur" role="radiogroup" aria-label="Status lembar kerja">
        {ALUR.map((l, j) => (
          <button
            key={l.nilai}
            type="button"
            role="radio"
            aria-checked={j === i}
            tabIndex={j === i ? 0 : -1}
            className={`rbg__stasiun${j < i ? " is-lewat" : ""}${j === i ? " is-kini" : ""}`}
            onClick={() => onPindah(t, l.nilai)}
            onKeyDown={(e) => {
              const ke = e.key === "ArrowRight" || e.key === "ArrowDown" ? j + 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? j - 1 : null;
              if (ke === null || ke < 0 || ke >= ALUR.length) return;
              e.preventDefault();
              /* Dibaca SEKARANG: React mengosongkan currentTarget sesudah penangan selesai. */
              const grup = e.currentTarget.parentElement;
              onPindah(t, ALUR[ke]!.nilai);
              requestAnimationFrame(() => (grup?.children[ke] as HTMLElement | undefined)?.focus());
            }}
          >
            <i aria-hidden="true">{j < i ? <Ikon ikon={Check} ukuran={11} /> : j + 1}</i>
            <span>{l.pendek}</span>
          </button>
        ))}
      </div>
      <p className="rbg__alurket">
        {LABEL[t.status]} · {ALUR[i]!.ket}
      </p>

      <dl className="rbg__isian">
        <div>
          <dt>Proyek</dt>
          <dd>
            <a href={`/admin/proyek/satu?id=${encodeURIComponent(t.projectId)}`}>{t.projectTitle ?? "—"}</a>
            <span className="rbg__dkode">{kodeProyek(t.projectTitle ?? "")}</span>
          </dd>
        </div>
        <div>
          <dt>Tahap</dt>
          <dd>
            <PilihMenu
              label={`Tahap ${t.title}`}
              nilai={t.stage ?? "-"}
              onUbah={(v) => onUbah(t, { stage: v === "-" ? null : v })}
              opsi={[{ nilai: "-", label: "Tanpa tahap" }, ...URUT_TAHAP.map((s) => ({ nilai: s, label: TAHAP_PROYEK[s] ?? s, ket: KODE_TAHAP[s] }))]}
              pemicu={
                <button type="button" className="rbg__dpilih">
                  <span>{t.stage ? (TAHAP_PROYEK[t.stage] ?? t.stage) : "Tanpa tahap"}</span>
                  <Ikon ikon={CaretDown} ukuran={12} />
                </button>
              }
            />
          </dd>
        </div>
        <div>
          <dt>PIC</dt>
          <dd>
            <PilihMenu
              label={`PIC ${t.title}`}
              nilai={t.assigneeId ?? "-"}
              onUbah={(v) => onUbah(t, { assigneeId: v === "-" ? null : v, assigneeName: v === "-" ? null : (tim.find((m) => m.id === v)?.name ?? null) })}
              opsi={opsiPic}
              pemicu={
                <button type="button" className="rbg__dpilih">
                  {t.assigneeName && <Inisial nama={t.assigneeName} />}
                  <span>{namaPic}</span>
                  <Ikon ikon={CaretDown} ukuran={12} />
                </button>
              }
            />
          </dd>
        </div>
        <div>
          <dt>Tenggat</dt>
          <dd className="rbg__dtenggat">
            <PilihTanggal
              label={`Tenggat ${t.title}`}
              nilai={t.dueDate?.slice(0, 10) ?? ""}
              onUbah={(iso) => onUbah(t, { dueDate: iso || null })}
              placeholder="Tanpa tenggat"
            />
            {sisa !== null && <span className={`rbg__sisa is-${tg.nada}`}>{sisa < 0 ? `lewat ${-sisa} hari` : sisa === 0 ? "hari ini" : `${sisa} hari lagi`}</span>}
          </dd>
        </div>
      </dl>

      <div className="rbg__tindak">
        {maju && t.status !== "menunggu_klien" && (
          <Tombol ukuran="medium" jenis="primary" onClick={() => onPindah(t, maju.nilai)}>
            {maju.nilai === "menunggu_klien" ? "Kirim ke klien →" : `Teruskan ke ${maju.pelat} →`}
          </Tombol>
        )}
        {t.status === "menunggu_klien" && (
          <Tombol ukuran="medium" jenis="primary" kiri={Check} onClick={() => onPindah(t, "selesai")}>
            Klien setuju · cap selesai
          </Tombol>
        )}
        {mundur && (
          <Tombol ukuran="medium" jenis="secondary" onClick={() => onPindah(t, mundur.nilai)}>
            {t.status === "selesai" ? "Buka lagi ke Berjalan" : t.status === "berjalan" ? "← Kembalikan ke Belum mulai" : "← Revisi ke Berjalan"}
          </Tombol>
        )}
      </div>

      <Sekerja t={t} sekerja={sekerja} nomor={nomor} kini={kini} onPilih={onPilih} />

      <footer className="rbg__dkaki">
        {/* Riwayat lembar: kapan ditaruh di rak dan kapan terakhir disentuh. */}
        <dl className="rbg__riwayat">
          {t.createdAt && (
            <div>
              <dt>Dibuat</dt>
              <dd>{tglWaktu(t.createdAt)}</dd>
            </div>
          )}
          {t.updatedAt && (
            <div>
              <dt>Diubah</dt>
              <dd>{tglWaktu(t.updatedAt)}</dd>
            </div>
          )}
        </dl>
        <a href={`/admin/proyek/satu?id=${encodeURIComponent(t.projectId)}`}>Buka proyek</a>
        <HapusBaris
          judul="Hapus lembar kerja ini?"
          keterangan={`${t.title}${t.projectTitle ? ` — ${t.projectTitle}` : ""}. Tugas yang dihapus tidak bisa dikembalikan.`}
          label={`Hapus ${t.title}`}
          onHapus={() => onHapus(t)}
        />
      </footer>
    </aside>
  );
}

/* ---- Lembar kerja proyek yang sama -----------------------------------------------
   Seperti daftar lembar di map proyek: pita sebaran status (tangga hijau
   berurut alur — makin tua makin jauh) dan tiap lembar dengan nomor dan
   keadaannya. Lembar ini ditandai; yang lain bisa dibuka dari sini. */
function Sekerja({
  t,
  sekerja,
  nomor,
  kini,
  onPilih,
}: {
  t: Tugas;
  sekerja: Tugas[];
  nomor: Record<string, string>;
  kini: string;
  onPilih: (id: string) => void;
}) {
  const urut = sekerja.slice().sort((a, b) => (LANGKAH[a.status] ?? 0) - (LANGKAH[b.status] ?? 0) || urutBaki(a, b));
  /* Butir "lembar ini" dijaga tampak di daftarnya sendiri (hanya daftarnya
     yang digeser, bukan halaman) — dibaca sekali per pergantian lembar. */
  const daftar = useRef<HTMLOListElement>(null);
  useLayoutEffect(() => {
    const ol = daftar.current;
    const ini = ol?.querySelector<HTMLElement>("li.is-ini");
    if (!ol || !ini) return;
    const atas = ini.offsetTop - ol.offsetTop;
    if (atas < ol.scrollTop || atas + ini.offsetHeight > ol.scrollTop + ol.clientHeight) ol.scrollTop = Math.max(0, atas - 4);
  }, [t.id, t.status]);
  const jumlah = ALUR.map((l) => sekerja.filter((x) => x.status === l.nilai).length);
  const selesai = jumlah[ALUR.length - 1] ?? 0;
  return (
    <section className="rbg__sekerja" aria-label={`Lembar kerja ${t.projectTitle ?? "proyek ini"}`}>
      <p className="rbg__dlabel">
        Map proyek · {sekerja.length} lembar · {selesai} selesai
      </p>
      <span className="rbg__sebaran" aria-hidden="true">
        {ALUR.map((l, j) => (jumlah[j] ? <i key={l.nilai} className={`is-${l.nilai}`} style={{ flexGrow: jumlah[j] }} /> : null))}
      </span>
      <ol ref={daftar}>
        {urut.map((x) => {
          const tg = kataTenggat(x, kini);
          const ini = x.id === t.id;
          return (
            <li key={x.id} className={ini ? "is-ini" : undefined}>
              <button type="button" aria-current={ini || undefined} onClick={() => onPilih(x.id)}>
                <i className={`rbg__stitik is-${x.status}`} aria-hidden="true" />
                <span className="rbg__snomor">{(nomor[x.id] ?? "").slice(-2)}</span>
                <span className="rbg__sjudul">{x.title}</span>
                <small className={`is-${x.status === "selesai" ? "biasa" : tg.nada}`}>{x.status === "selesai" ? "selesai" : tg.nada === "kosong" ? LABEL[x.status] : tg.teks}</small>
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function Rangka() {
  return (
    <div className="rbg" aria-busy="true">
      <div className="rbg__papan">
        <div className="rbg__kop rbg__kop--rangka" />
        <div className="rbg__meja">
          <div className="rbg__rak">
            {BAKI.map((b) => (
              <section key={b.nilai} className="rbg__baki rbg__baki--rangka" />
            ))}
          </div>
        </div>
        <aside className="rbg__kertas rbg__disposisi rbg__kertas--rangka" />
      </div>
    </div>
  );
}

/* Satu-satunya pintu membuat tugas. Proyeknya dipilih DI SINI, bukan
   ditentukan oleh halaman mana staf kebetulan berada — bentuk yang sama
   dengan Catat Pengeluaran. Tahapnya bawaan = tahap pipeline proyek itu. */
function DialogTugas({ proyek, tim, onSelesai }: { proyek: Proyek[]; tim: AnggotaTim[]; onSelesai: (id: string) => void }) {
  const toast = useToast();
  const [buka, setBuka] = useState(false);
  const [idProyek, setIdProyek] = useState("");
  const [judul, setJudul] = useState("");
  const [tahap, setTahap] = useState("-");
  const [orang, setOrang] = useState("");
  const [tenggat, setTenggat] = useState("");
  const [kirim, setKirim] = useState(false);
  const alasan = !idProyek ? "Pilih proyeknya dulu." : judul.trim().length < 2 ? "Isi judul tugas, minimal 2 huruf." : null;

  function saatBuka(b: boolean) {
    setBuka(b);
    if (b) {
      setIdProyek("");
      setJudul("");
      setTahap("-");
      setOrang("");
      setTenggat("");
    }
  }

  async function simpan() {
    if (alasan) return;
    setKirim(true);
    try {
      const { id } = await tambahTugas(idProyek, {
        title: judul.trim(),
        stage: tahap === "-" ? null : tahap,
        assigneeId: orang || null,
        dueDate: tenggat || null,
      });
      setBuka(false);
      onSelesai(id);
      toast({ judul: "Tugas ditambahkan", keterangan: `${judul.trim()} · baki Belum mulai`, nada: "sukses" });
    } catch (e) {
      toast({ judul: "Gagal menambah tugas", keterangan: (e as Error).message, nada: "gagal" });
    } finally {
      setKirim(false);
    }
  }

  return (
    <Dialog
      open={buka}
      onOpenChange={saatBuka}
      title="Tambah tugas"
      trigger={
        <Tombol ukuran="medium" jenis="primary" kiri={Plus} className="rbg__tambah">
          Tambah tugas
        </Tombol>
      }
      footer={
        <div className="kd-form__kaki">
          {alasan && <small className="kd-form__alasan">{alasan}</small>}
          <Tombol memuat={kirim} ukuran="large" jenis="primary" disabled={Boolean(alasan) || kirim} onClick={simpan}>
            {kirim ? "Menyimpan…" : "Simpan"}
          </Tombol>
        </div>
      }
    >
      <div className="kd-form">
        <Bidang label="Proyek">
          {(b) => (
            <Kombo
              id={b.id}
              opsi={proyek.map((p) => ({ nilai: p.id, label: p.title, ket: p.client || undefined }))}
              nilai={idProyek || undefined}
              onUbah={(v) => {
                setIdProyek(v);
                /* Tahap bawaan = tahap pipeline proyek itu sekarang. */
                const st = proyek.find((p) => p.id === v)?.pipelineStage;
                if (st && KODE_TAHAP[st]) setTahap(st);
              }}
              placeholder="Pilih proyek…"
              cariPlaceholder="Cari proyek atau klien…"
            />
          )}
        </Bidang>
        <Isian label="Tugas" placeholder="mis. Gambar kerja denah" maxLength={200} value={judul} onChange={(e) => setJudul(e.currentTarget.value)} />
        <div className="kd-form__dua">
          <Bidang label="Tahap">
            {(b) => (
              <Pilih
                id={b.id}
                nilai={tahap}
                onUbah={setTahap}
                opsi={[{ nilai: "-", label: "Tanpa tahap" }, ...URUT_TAHAP.map((s) => ({ nilai: s, label: TAHAP_PROYEK[s] ?? s, ket: KODE_TAHAP[s] }))]}
              />
            )}
          </Bidang>
          {/* Yang nonaktif tidak ditawarkan lagi, tapi namanya tetap
              tercetak di tugas lama. */}
          <Bidang label="Penanggung jawab">
            {(b) => (
              <Pilih
                id={b.id}
                nilai={orang || "-"}
                onUbah={(v) => setOrang(v === "-" ? "" : v)}
                opsi={[
                  { nilai: "-", label: "Belum ditentukan" },
                  ...tim.filter((t) => t.active).map((t) => ({ nilai: t.id, label: t.name, ket: t.role || undefined })),
                ]}
              />
            )}
          </Bidang>
        </div>
        {/* TANPA batas maksimum hari ini, beda dari tanggal biaya: biaya
            mencatat yang sudah terjadi, tenggat menunjuk yang belum. */}
        <IsianTanggal label="Tenggat" nilai={tenggat} onUbah={setTenggat} placeholder="Tanpa tenggat" />
      </div>
    </Dialog>
  );
}

export function TugasKit() {
  return (
    <RequireAuth skeleton={<Rangka />}>
      <ToastProvider>
        <Isi />
      </ToastProvider>
    </RequireAuth>
  );
}
