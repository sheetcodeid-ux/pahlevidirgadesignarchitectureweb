import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { navigate } from "astro:transitions/client";
import { RequireAuth } from "./RequireAuth";
import { ToastProvider, useToast, titipToast } from "../kit/Toast";
import { PilihMenu, PilihTanggal } from "../kit/Formulir";
import { Ikon } from "../kit/Ikon";
import { CaretDown, ImageSquare, Plus, X } from "../kit/ikon";
import { Keterangan, pemberiKet, type InfoKartu } from "../kit/kartuGrafik";
import {
  ambilAturanFee, ambilSettings, bacaCache, buatProyek, daftarPaket, daftarProyek, daftarTim, mintaUrlUnggah,
  namaTampilan, pctBawaan, profilTersimpan, simpanProyek, tambahTimProyek,
  LABEL_PERAN, URUTAN_PERAN,
  type AnggotaTim, type AturanFee, type Paket, type PeranTim, type Proyek, type StudioSettings,
} from "../../lib/admin";
import { opsiPaket } from "./pilihPaket";
import { IsiPunggung, RONA, bandingRak, tahunProyek } from "./punggungOrdner";
import { TAHAP } from "../../lib/tahap";
import { formatRupiah } from "../../lib/format";
import { terbilang } from "../../lib/terbilang";
import { inisial, kodeProyek } from "../../lib/nomorDokumen";
import { useCegahPindah } from "../../lib/cegahPindah";
import { setProyekAktif } from "../../lib/proyekAktif";

/* =============================================================================
   Proyek Baru (/admin/proyek/baru) — SURAT PERJANJIAN JASA PERENCANAAN, dan
   ORDNER BARU yang menunggu suratnya.

   Benda dunia nyatanya: proyek studio lahir dari surat perjanjian (atau
   surat penawaran, kalau kliennya belum meneken). Isian halaman ini adalah
   titik-titik di pasal-pasal surat itu — para pihak, pekerjaan, nilai jasa,
   jangka waktu, tim perencana — dan begitu diteken, suratnya masuk ordner
   proyek yang berdiri di rak Semua Proyek. Jadi kolom kanan bukan ringkasan
   karangan: ia punggung ordner yang PERSIS akan berdiri di rak (komponen
   `IsiPunggung` yang sama), di antara tetangga yang sungguhan, ditambah
   pembagian fee design yang dihitung saat diketik.

   Logika penyimpanan tidak berubah dari form pekerjaan sebelumnya: endpoint
   pembuatan cuma menerima slug, judul, dan kategori; sisanya satu patch
   susulan berisi yang benar-benar diisi, lalu penugasan tim satu per satu.
   Yang baru: KEADAAN SURAT. "Sudah diteken" membuat proyek mulai di tahap
   Deal Kontrak; "Masih penawaran" di Proposal (bawaan database).

   Gerak hanya karena perbuatan: sesudah tersimpan, cap studio dan meterai
   dibubuhkan, tanda tangan tergambar, suratnya terbang ke kantong label
   ordner, lalu ordnernya turun ke deret rak. Seketika bila gerak dikurangi.
   ============================================================================= */

/* Sesudah dibuat, yang dibuka SATU PROYEK — langsung ke alamatnya, bukan
   lewat /admin/proyek/edit yang mengalihkan sendiri dan ikut membuang toast
   titipan (jebakan #40). */
async function bukaSatuProyek(id: string) {
  setProyekAktif(id);
  await navigate(`/admin/proyek/satu?id=${encodeURIComponent(id)}`);
}

/* Persis enum `project_category` di database. "Hospitality" di peta label
   halaman lain TIDAK termasuk: database menolaknya. */
const KATEGORI: Record<string, string> = {
  residential: "Hunian",
  commercial: "Komersial",
  coffeeshop: "Coffee shop",
  interior: "Interior",
  landscape: "Lanskap",
  masterplan: "Masterplan",
  renovation: "Renovasi",
};

const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const BULAN_PENDEK = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

/** Mengubah judul jadi slug: huruf kecil, tanpa aksen, dipisah tanda hubung. */
function keSlug(judul: string) {
  return judul
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

const KOSONG = {
  client: "",
  title: "",
  category: "coffeeshop",
  city: "",
  location: "",
  scopeOfWork: "",
  tierId: "",
  fee: "",
  deadlinePreview: "",
  deadlineFinal: "",
  subtitle: "",
  summary: "",
  year: "",
  areaSqm: "",
};
type Kunci = keyof typeof KOSONG;

interface BarisTim {
  kunci: string;
  role: PeranTim;
  orang: string;
  pct: string;
  /** Baris tambahan (peran dibagi dua orang) bisa dibuang; empat baris dasar tidak. */
  tambahan: boolean;
  /** Persen sudah disentuh staf — jangan ditimpa saat aturan studio tiba. */
  disentuh: boolean;
}

const barisDasar = (): BarisTim[] =>
  URUTAN_PERAN.map((role) => ({ kunci: role, role, orang: "", pct: "", tambahan: false, disentuh: false }));

/** "12.000.000" ↔ 12000000. Titik ribuan ditulis saat mengetik, seperti di Excel pemilik. */
const angkaDari = (v: string) => Number(v.replace(/\D/g, "")) || 0;
const titikRibuan = (v: string) => {
  const n = v.replace(/\D/g, "");
  return n ? Number(n).toLocaleString("id-ID") : "";
};
const pctTeks = (n: number) => n.toLocaleString("id-ID", { maximumFractionDigits: 2 });
const pctAturan = (a: AturanFee | null, r: PeranTim) => (a ? pctBawaan(a, r)?.toString().replace(".", ",") ?? "" : "");

const HARI = 86_400_000;
const keTgl = (iso: string) => new Date(`${iso}T00:00:00`);
const tglPanjang = (d: Date) => `${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}`;
const tglPendek = (iso: string) => {
  const d = keTgl(iso);
  return `${d.getDate()} ${BULAN_PENDEK[d.getMonth()]} ${d.getFullYear()}`;
};

const tunggu = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const geraknya = () =>
  typeof window !== "undefined" && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Satu pasal surat: nomor + judul di kiri, kalimatnya di kanan. Didefinisikan
    di luar komponen halaman supaya tidak dipasang ulang tiap render (jebakan #80). */
function Pasal({ no, judul, sorot, children }: { no: number; judul: string; sorot: string; children: ReactNode }) {
  return (
    <section className="spk__pasal" data-sorot-ke={sorot} aria-labelledby={`spk-pasal-${no}`}>
      <h3 className="spk__pasaljudul" id={`spk-pasal-${no}`}>
        <small>Pasal {no}</small>
        {judul}
      </h3>
      <div className="spk__pasalisi">{children}</div>
    </section>
  );
}

/** Pemicu PilihMenu yang tampil sebagai TULISAN di titik-titik surat. Radix
    menempelkan ref dan penangannya lewat `asChild`, jadi semua prop diteruskan. */
function Tulis({ teks, kosong, ...p }: { teks: string; kosong?: boolean } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" {...p} className={`spk__tulis${kosong ? " is-pensil" : ""}`}>
      <span>{teks}</span>
      <Ikon ikon={CaretDown} ukuran={11} />
    </button>
  );
}

function Isi() {
  const toast = useToast();
  const [f, setF] = useState({ ...KOSONG });
  const [tim, setTim] = useState<BarisTim[]>(barisDasar);
  const [orangTim, setOrangTim] = useState<AnggotaTim[]>([]);
  const [aturan, setAturan] = useState<AturanFee | null>(null);
  const [paket, setPaket] = useState<Paket[]>([]);
  const [proyek, setProyek] = useState<Proyek[] | null>(() => bacaCache<Proyek[]>("proyek"));
  const [studio, setStudio] = useState<Pick<StudioSettings, "studioName" | "city" | "logoUrl"> | null>(null);
  const [penanda, setPenanda] = useState("");
  const [sampul, setSampul] = useState<{ key: string; url: string } | null>(null);
  const [mengunggah, setMengunggah] = useState(false);
  const [menyimpan, setMenyimpan] = useState(false);
  const [keadaan, setKeadaan] = useState<"teken" | "penawaran">("teken");
  const [lembar, setLembar] = useState<"surat" | "lampiran">("surat");
  const [sorot, setSorot] = useState<string | null>(null);
  /** Upacara sesudah tersimpan: cap & meterai, lalu ordner turun ke rak. */
  const [diteken, setDiteken] = useState(false);
  const [masuk, setMasuk] = useState(false);
  const kini = useMemo(() => new Date(), []);

  const kertasRef = useRef<HTMLDivElement>(null);
  const ordnerRef = useRef<HTMLDivElement>(null);
  const lapisRef = useRef<HTMLDivElement>(null);
  const tabRef = useRef<(HTMLButtonElement | null)[]>([]);
  const kabar = useRef<((i: InfoKartu | null) => void) | null>(null);
  const ket = pemberiKet(kabar);

  useEffect(() => {
    daftarTim().then((d) => setOrangTim(d.filter((o) => o.active))).catch(() => setOrangTim([]));
    daftarPaket().then(setPaket).catch(() => setPaket([]));
    ambilAturanFee()
      .then((a) => {
        setAturan(a);
        /* Persen bawaan baru diketahui sekarang. Baris yang sudah disentuh
           staf dibiarkan — mengetik lebih cepat dari jaringan bukan salah. */
        setTim((t) => t.map((b) => (b.disentuh ? b : { ...b, pct: pctAturan(a, b.role) })));
      })
      .catch(() => setAturan(null));
    /* Kunci `proyek` milik Semua Proyek dan `settings` milik Info Studio —
       di sini cuma DIBACA (jebakan #8). */
    let hidup = true;
    daftarProyek()
      .then((d) => hidup && setProyek(d))
      .catch(() => hidup && setProyek((p) => p ?? []));
    const st = bacaCache<StudioSettings>("settings");
    if (st) setStudio(st);
    else ambilSettings().then((s) => hidup && setStudio(s)).catch(() => {});
    const pr = profilTersimpan();
    if (pr) setPenanda(namaTampilan(pr));
    return () => {
      hidup = false;
    };
  }, []);

  const adaIsian =
    sampul !== null ||
    tim.some((b) => b.orang) ||
    (Object.keys(KOSONG) as Kunci[]).some((k) => f[k] !== KOSONG[k]);
  useCegahPindah(adaIsian && !menyimpan);

  const set = (k: Kunci, v: string) => setF((x) => ({ ...x, [k]: v }));
  const setBaris = (kunci: string, patch: Partial<BarisTim>) =>
    setTim((t) => t.map((b) => (b.kunci === kunci ? { ...b, ...patch } : b)));

  /* ---- Hitungan ---------------------------------------------------------- */
  const fee = angkaDari(f.fee);
  const persen = (b: BarisTim) => {
    const v = b.pct.replace(",", ".").trim();
    return v === "" ? null : Number(v);
  };
  const rupiahBaris = (b: BarisTim) => {
    const p = persen(b);
    return b.orang && fee > 0 && p !== null && Number.isFinite(p) ? Math.round((fee * p) / 100) : null;
  };
  const terisi = tim.filter((b) => b.orang);
  const berpersen = terisi.filter((b) => {
    const p = persen(b);
    return p !== null && Number.isFinite(p) && p > 0 && p <= 100;
  });
  const pctTim = berpersen.reduce((n, b) => n + (persen(b) ?? 0), 0);
  const bagianTim = terisi.reduce((n, b) => n + (rupiahBaris(b) ?? 0), 0);
  const belumDitentukan = terisi.filter((b) => persen(b) === null);
  const jatah = aturan?.poolPct ?? null;

  const judul = (f.title.trim() || f.client.trim()).slice(0, 120);
  const slug = keSlug(judul);
  const kode = judul ? kodeProyek(judul) : "···";
  const yymm = `${String(kini.getFullYear()).slice(2)}${String(kini.getMonth() + 1).padStart(2, "0")}`;
  const nomor = `${keadaan === "teken" ? "SPK" : "SPH"}-${yymm}-${kode}`;
  const namaStudio = studio?.studioName?.trim() || "Studio";
  const kotaStudio = studio?.city?.trim() || "";
  const tahapBaru = keadaan === "teken" ? "deal_kontrak" : "proposal";
  const labelTahap = TAHAP.find((t) => t.value === tahapBaru)?.label ?? "—";

  const pctSalah = tim.some((b) => {
    const p = persen(b);
    return p !== null && (!Number.isFinite(p) || p < 0 || p > 100);
  });
  const urutanSalah = !!(f.deadlinePreview && f.deadlineFinal && f.deadlineFinal < f.deadlinePreview);
  const tahunSalah = f.year.trim() !== "" && !/^\d{4}$/.test(f.year.trim());
  /* Tombol yang mati selalu menyebut sebabnya — sama dengan editor Jurnal. */
  const alasan =
    f.client.trim().length < 2
      ? "Tulis nama Pihak Kedua (klien) di Pasal 1, minimal 2 huruf."
      : slug.length < 2
        ? "Nama pekerjaan butuh minimal 2 huruf atau angka."
        : pctSalah
          ? "Bagian tiap peran di Pasal 5 harus angka 0–100."
          : urutanSalah
            ? "Gambar final di Pasal 4 tidak boleh sebelum preview."
            : tahunSalah
              ? "Tahun di Lampiran I harus empat angka."
              : mengunggah
                ? "Tunggu sampulnya selesai terunggah."
                : null;
  const bisaSimpan = !alasan && !menyimpan;

  /* Orang yang sudah dipilih di peran yang sama tidak ditawarkan lagi di
     baris tambahan peran itu — database menolak pasangan yang sama dua kali. */
  const pilihanOrang = (b: BarisTim) =>
    orangTim.filter((o) => o.id === b.orang || !tim.some((x) => x !== b && x.role === b.role && x.orang === o.id));

  const paketDipilih = paket.find((p) => p.id === f.tierId) ?? null;
  /* Peringatan, bukan penolakan: harga di luar rentang paket memang terjadi
     (diskon klien lama, lingkup tambahan). Paket disimpan dalam JUTA. */
  const luarRentang =
    !!paketDipilih && fee > 0 && (fee < paketDipilih.feeMin * 1e6 || fee > paketDipilih.feeMax * 1e6);

  /* ---- Rak: di mana ordner baru ini akan berdiri ------------------------- */
  const tahunBaru = /^\d{4}$/.test(f.year.trim()) ? Number(f.year.trim()) : null;
  const rak = useMemo(() => {
    /* Urutan yang SAMA dengan rak Semua Proyek (`bandingRak`). Proyek baru
       belum terbit, jadi tahunnya cuma dari isian Tahun. */
    const baru = { id: "__baru__", year: tahunBaru, publishedAt: null } as unknown as Proyek;
    const urut = [...(proyek ?? []), baru].sort(bandingRak);
    const out: ({ jenis: "tahun"; tahun: number | null } | { jenis: "ordner"; p: Proyek })[] = [];
    let akhir: number | null | undefined;
    for (const p of urut) {
      const t = tahunProyek(p);
      if (t !== akhir) {
        out.push({ jenis: "tahun", tahun: t });
        akhir = t;
      }
      out.push({ jenis: "ordner", p });
    }
    const i = out.findIndex((r) => r.jenis === "ordner" && r.p.id === "__baru__");
    const ke = urut.findIndex((p) => p.id === "__baru__");
    return {
      kiri: out.slice(Math.max(0, i - 3), i),
      kanan: out.slice(i + 1, i + 4),
      sebelum: ke > 0 ? urut[ke - 1]! : null,
      sesudah: urut[ke + 1] ?? null,
      ke: ke + 1,
      jumlah: urut.length,
    };
  }, [proyek, tahunBaru]);

  /* ---- Jangka waktu ------------------------------------------------------- */
  const hariIni = new Date(kini.getFullYear(), kini.getMonth(), kini.getDate()).getTime();
  const tPrev = f.deadlinePreview ? keTgl(f.deadlinePreview).getTime() : null;
  const tFin = f.deadlineFinal ? keTgl(f.deadlineFinal).getTime() : null;
  const awal = Math.min(hariIni, tPrev ?? hariIni, tFin ?? hariIni);
  const ujung = Math.max(hariIni + 30 * HARI, tPrev ?? 0, tFin ?? 0);
  const posLini = (t: number) => ((t - awal) / Math.max(HARI, ujung - awal)) * 100;
  const hariKe = (t: number) => Math.round((t - hariIni) / HARI);
  const kalimatWaktu =
    tPrev === null && tFin === null
      ? "Tenggat boleh ditulis nanti dari halaman proyek."
      : [
          tPrev !== null &&
            (hariKe(tPrev) >= 0 ? `preview ${hariKe(tPrev)} hari sejak surat ini` : `preview ${-hariKe(tPrev)} hari sebelum surat ini`),
          tFin !== null && tPrev !== null
            ? `final ${Math.round((tFin - tPrev) / HARI)} hari sesudah preview`
            : tFin !== null && `final ${hariKe(tFin)} hari sejak surat ini`,
        ]
          .filter(Boolean)
          .join(" · ");

  function kosongkan() {
    setF({ ...KOSONG });
    setTim(barisDasar().map((b) => ({ ...b, pct: pctAturan(aturan, b.role) })));
    setSampul((s) => {
      if (s) URL.revokeObjectURL(s.url);
      return null;
    });
  }

  async function unggah(berkas: File) {
    /* Kunci penyimpanannya dikelompokkan per proyek, jadi sampul butuh slug
       — yang belum ada kalau nama dan kliennya belum diketik. */
    setMengunggah(true);
    try {
      const target = await mintaUrlUnggah(slug || "tanpa-slug", berkas.type);
      const res = await fetch(target.uploadUrl, { method: "PUT", headers: { "Content-Type": berkas.type }, body: berkas });
      if (!res.ok) throw new Error(`Penyimpanan menolak berkas (${res.status})`);
      setSampul((s) => {
        if (s) URL.revokeObjectURL(s.url);
        return { key: target.key, url: URL.createObjectURL(berkas) };
      });
    } catch (e) {
      toast({ judul: "Gagal mengunggah sampul", keterangan: (e as Error).message, nada: "gagal" });
    } finally {
      setMengunggah(false);
    }
  }

  /** Surat diteken, terbang ke kantong ordner, ordner turun ke rak. */
  async function upacara() {
    setLembar("surat");
    setDiteken(true);
    if (!geraknya()) return;
    await tunggu(820);
    const kertas = kertasRef.current;
    const kantong = ordnerRef.current?.querySelector<HTMLElement>(".ord__kantong");
    const lapis = lapisRef.current;
    if (!kertas || !kantong || !lapis) return;
    const a = kertas.getBoundingClientRect();
    const b = kantong.getBoundingClientRect();
    const salinan = kertas.cloneNode(true) as HTMLElement;
    /* Salinan tanpa id (label dan aria tidak boleh ganda) dan dengan isi
       isian yang sedang tertulis — cloneNode tidak membawa nilai textarea. */
    salinan.querySelectorAll("[id]").forEach((el) => el.removeAttribute("id"));
    salinan.removeAttribute("id");
    const asli = kertas.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("input, textarea");
    salinan.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("input, textarea").forEach((el, i) => {
      el.value = asli[i]?.value ?? "";
    });
    salinan.inert = true;
    salinan.classList.add("spk__salinan");
    Object.assign(salinan.style, { left: `${a.left}px`, top: `${a.top}px`, width: `${a.width}px`, height: `${a.height}px` });
    lapis.append(salinan);
    kertas.style.visibility = "hidden";
    const s = b.width / a.width;
    const dx = b.left + b.width / 2 - (a.left + a.width / 2);
    const dy = b.top + b.height / 2 - (a.top + a.height / 2);
    const terbang = salinan.animate(
      [
        { transform: "none", opacity: 1 },
        { transform: `translate(${dx * 0.18}px, ${dy * 0.18 - 26}px) scale(0.64) rotate(-2.5deg)`, opacity: 1, offset: 0.34 },
        { transform: `translate(${dx}px, ${dy}px) scale(${s}) rotate(0deg)`, opacity: 0.2 },
      ],
      { duration: 780, easing: "cubic-bezier(0.45, 0, 0.2, 1)" },
    );
    await terbang.finished.catch(() => {});
    salinan.remove();
    setMasuk(true);
    await tunggu(520);
  }

  async function simpan(e: React.FormEvent) {
    e.preventDefault();
    if (!bisaSimpan) return;
    setMenyimpan(true);
    try {
      const { id } = await buatProyek(slug, judul, f.category);
      const patch: Partial<Proyek> & { coverImageKey?: string } = { client: f.client.trim() };
      if (keadaan === "teken") patch.pipelineStage = "deal_kontrak";
      if (f.city.trim()) patch.city = f.city.trim();
      if (f.location.trim()) patch.location = f.location.trim();
      if (f.scopeOfWork.trim()) patch.scopeOfWork = f.scopeOfWork.trim();
      if (f.tierId) patch.tierId = f.tierId;
      if (fee > 0) patch.contractValue = fee;
      if (f.deadlinePreview) patch.deadlinePreview = f.deadlinePreview;
      if (f.deadlineFinal) patch.deadlineFinal = f.deadlineFinal;
      if (f.subtitle.trim()) patch.subtitle = f.subtitle.trim();
      if (f.summary.trim()) patch.summary = f.summary.trim();
      if (f.year.trim()) patch.year = Number(f.year);
      if (f.areaSqm.trim()) patch.areaSqm = Number(f.areaSqm);
      if (sampul) patch.coverImageKey = sampul.key;

      /* Proyeknya SUDAH terbuat. Yang gagal sesudahnya tidak membatalkan
         apa pun — dikumpulkan, disebut di toast, dan bisa dilengkapi di
         Satu Proyek. */
      const gagal: string[] = [];
      try {
        await simpanProyek(id, patch);
      } catch (err) {
        gagal.push(`detail proyek (${(err as Error).message})`);
      }
      for (const b of terisi) {
        const p = persen(b);
        const bawaan = aturan ? pctBawaan(aturan, b.role) : null;
        try {
          /* Persen yang sama dengan bawaan TIDAK dikirim: API mengambilnya
             sendiri dari aturan studio, dan peran yang belum ditentukan
             tersimpan kosong supaya ikut aturan begitu pemilik mengisinya. */
          await tambahTimProyek(id, {
            teamMemberId: b.orang,
            role: b.role,
            ...(p !== null && p !== bawaan ? { pct: p } : {}),
          });
        } catch (err) {
          const nama = orangTim.find((o) => o.id === b.orang)?.name ?? "anggota";
          gagal.push(`${LABEL_PERAN[b.role]} ${nama} (${(err as Error).message})`);
        }
      }

      /* Dititipkan: toast() di sini lenyap bersama halamannya (jebakan #40). */
      titipToast(
        gagal.length
          ? {
              judul: "Proyek dibuat, sebagian belum tersimpan",
              keterangan: `Gagal: ${gagal.join("; ")}. Lengkapi di halaman ini.`,
              nada: "gagal",
            }
          : {
              judul: keadaan === "teken" ? "Surat diteken, proyek dibuat" : "Penawaran dicatat, proyek dibuat",
              keterangan: terisi.length
                ? `${terisi.length} orang ditugaskan. Bayaran tahap awal jatuh tempo begitu DP klien masuk.`
                : "Tugaskan tim perencananya di seksi Personil.",
              nada: "sukses",
            },
      );
      await upacara();
      await bukaSatuProyek(id);
    } catch (err) {
      toast({ judul: "Gagal membuat proyek", keterangan: (err as Error).message, nada: "gagal" });
      setMenyimpan(false);
    }
  }

  /* ---- Tab lembar (Surat / Lampiran I) ---------------------------------- */
  const LEMBAR = [
    { id: "surat" as const, label: "Surat" },
    { id: "lampiran" as const, label: "Lampiran I" },
  ];
  function tabKunci(e: React.KeyboardEvent, i: number) {
    let j = i;
    if (e.key === "ArrowDown" || e.key === "ArrowRight") j = (i + 1) % LEMBAR.length;
    else if (e.key === "ArrowUp" || e.key === "ArrowLeft") j = (i + LEMBAR.length - 1) % LEMBAR.length;
    else if (e.key === "Home") j = 0;
    else if (e.key === "End") j = LEMBAR.length - 1;
    else return;
    e.preventDefault();
    setLembar(LEMBAR[j]!.id);
    tabRef.current[j]?.focus();
  }

  /* ---- Pembagian fee design (dalam persen; rupiah kalau fee sudah ada) --- */
  const ruas = berpersen.map((b) => ({
    b,
    pct: persen(b) ?? 0,
    nama: orangTim.find((o) => o.id === b.orang)?.name ?? "—",
  }));
  const lewat = jatah !== null && pctTim > jatah;
  const lebarBatang = Math.max(100, pctTim);
  const pctStudio = Math.max(0, 100 - pctTim);

  const kiriNama = rak.sebelum?.title;
  const kananNama = rak.sesudah?.title;
  const kalimatRak =
    proyek === null
      ? "Membaca rak…"
      : tahunBaru === null
        ? `Tanpa tahun · berdiri di ujung kanan rak${kiriNama ? `, sesudah ${kiriNama}` : ""}.`
        : `Rak ${tahunBaru} · ordner ke-${rak.ke} dari ${rak.jumlah}${kiriNama || kananNama ? `, di antara ${kiriNama ?? "ujung rak"} dan ${kananNama ?? "ujung rak"}` : ""}.`;

  const jiran = (r: (typeof rak.kiri)[number], i: number) =>
    r.jenis === "tahun" ? (
      <li key={`t-${r.tahun}-${i}`} className="ord__slot ord__pembatas" aria-hidden="true">
        <span>{r.tahun ?? "—"}</span>
      </li>
    ) : (
      <li key={r.p.id} className="ord__slot" aria-hidden="true">
        <span
          className="ord__ordner spk__jiran"
          style={
            {
              "--ord-rona": RONA[r.p.category] ?? 0,
              "--ord-isi": ((r.p.contractValue ?? 0) > 0 ? Math.min(1, (r.p.paidTotal ?? 0) / (r.p.contractValue ?? 1)) : 0).toFixed(3),
            } as CSSProperties
          }
        >
          <IsiPunggung
            kode={kodeProyek(r.p.title)}
            judul={r.p.title}
            tahap={TAHAP.find((t) => t.value === r.p.pipelineStage)?.label ?? "—"}
            sampulUrl={r.p.coverImageUrl}
            huruf={(KATEGORI[r.p.category] ?? r.p.category ?? "P").slice(0, 1)}
          />
        </span>
      </li>
    );

  /* Baris di bawah judul daftar /proyek: kategori · tempat · tahun, hanya
     bagian yang terisi (sama dengan `meta()` di pages/proyek/index.astro). */
  const metaKarya = [KATEGORI[f.category], f.location.trim() || f.city.trim(), f.year.trim()]
    .filter(Boolean)
    .join(" · ")
    .toUpperCase();

  const tglPreview = f.deadlinePreview ? tglPendek(f.deadlinePreview) : "";
  const tglFinal = f.deadlineFinal ? tglPendek(f.deadlineFinal) : "";

  return (
    <div
      className={`spk${diteken ? " is-diteken" : ""}${masuk ? " is-masuk" : ""}`}
      data-sorot={sorot ?? undefined}
      data-keadaan={keadaan}
      onFocusCapture={(e) => setSorot((e.target as HTMLElement).closest<HTMLElement>("[data-sorot-ke]")?.dataset.sorotKe ?? null)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setSorot(null);
      }}
    >
      <div className="spk__papan">
        {/* ================= KIRI: surat di meja ================= */}
        <form className="spk__meja" id="form-proyek-baru" onSubmit={simpan}>
          <div className="spk__tumpuk">
            {/* ---------- Lembar 1: surat perjanjian ---------- */}
            <div
              className="spk__kertas"
              ref={kertasRef}
              role="tabpanel"
              id="spk-lembar-surat"
              aria-labelledby="spk-tab-surat"
              hidden={lembar !== "surat"}
            >
              <header className="spk__kop">
                <span className="spk__studio">
                  <span className="spk__monogram" aria-hidden="true">
                    {studio?.logoUrl ? <img src={studio.logoUrl} alt="" /> : inisial(namaStudio)}
                  </span>
                  <span className="spk__studionama">
                    <b>{namaStudio}</b>
                    <small>Perencana{kotaStudio ? ` · ${kotaStudio}` : ""}</small>
                  </span>
                </span>
                <span className="spk__judulsurat">
                  <h2>{keadaan === "teken" ? "Surat Perjanjian" : "Surat Penawaran"} Jasa Perencanaan</h2>
                  <small>
                    Nomor <b>{nomor}</b>
                  </small>
                </span>
                <span className="spk__tempat">
                  <small>
                    {kotaStudio ? `${kotaStudio}, ` : ""}
                    {tglPanjang(kini)}
                  </small>
                  <small>Hal. 1 dari 2</small>
                </span>
              </header>

              <div className="spk__badan">
                <Pasal no={1} judul="Para pihak" sorot="judul">
                  <p className="spk__kalimat">
                    <b className="spk__pihak">Pihak Pertama</b>
                    <span className="spk__cetak">{namaStudio}</span> selaku perencana.
                  </p>
                  <p className="spk__kalimat">
                    <b className="spk__pihak">Pihak Kedua</b>
                    <input
                      id="spk-klien"
                      className="spk__isi spk__isi--klien"
                      aria-label="Nama klien (Pihak Kedua)"
                      maxLength={120}
                      placeholder="nama klien"
                      value={f.client}
                      onChange={(e) => set("client", e.currentTarget.value)}
                    />
                    selaku pemilik pekerjaan.
                  </p>
                </Pasal>

                <Pasal no={2} judul="Pekerjaan" sorot="judul">
                  <p className="spk__kalimat">
                    Perencanaan
                    <PilihMenu
                      label="Jenis proyek"
                      nilai={f.category}
                      onUbah={(v) => set("category", v)}
                      opsi={Object.entries(KATEGORI).map(([v, l]) => ({ nilai: v, label: l }))}
                      pemicu={<Tulis teks={KATEGORI[f.category] ?? f.category} />}
                    />
                    bernama
                    <input
                      id="spk-nama"
                      className="spk__isi spk__isi--nama"
                      aria-label="Nama proyek"
                      maxLength={120}
                      placeholder={f.client.trim() || "sama dengan nama klien"}
                      value={f.title}
                      onChange={(e) => set("title", e.currentTarget.value)}
                    />
                  </p>
                  <p className="spk__kalimat">
                    di kota
                    <input
                      id="spk-kota"
                      className="spk__isi spk__isi--kota"
                      aria-label="Kota"
                      maxLength={80}
                      placeholder="kota"
                      value={f.city}
                      onChange={(e) => set("city", e.currentTarget.value)}
                    />
                    , beralamat di
                    <input
                      id="spk-alamat"
                      className="spk__isi spk__isi--alamat"
                      aria-label="Alamat lokasi"
                      maxLength={200}
                      placeholder="jalan dan nomor — untuk kunjungan lokasi"
                      value={f.location}
                      onChange={(e) => set("location", e.currentTarget.value)}
                    />
                  </p>
                  <label className="spk__lingkup">
                    <span>Lingkup kerja</span>
                    <textarea
                      id="spk-lingkup"
                      rows={2}
                      maxLength={2000}
                      placeholder="mis. desain interior berkonsep pop art; studio berisi layanan nail art dan eyelash."
                      value={f.scopeOfWork}
                      onChange={(e) => set("scopeOfWork", e.currentTarget.value)}
                    />
                  </label>
                </Pasal>

                <Pasal no={3} judul="Nilai jasa" sorot="fee">
                  <p className="spk__kalimat">
                    Sebesar <span className="spk__rp">Rp</span>
                    <input
                      id="spk-fee"
                      className="spk__isi spk__isi--fee"
                      aria-label="Fee design (nilai kontrak)"
                      inputMode="numeric"
                      placeholder={paketDipilih ? `${paketDipilih.feeMin}.000.000` : "0"}
                      value={f.fee}
                      onChange={(e) => set("fee", titikRibuan(e.currentTarget.value))}
                    />
                    menurut paket
                    <PilihMenu
                      label="Paket layanan"
                      nilai={f.tierId}
                      onUbah={(v) => set("tierId", v)}
                      opsi={opsiPaket(paket, f.tierId)}
                      pemicu={<Tulis teks={paketDipilih?.name ?? "tanpa paket"} kosong={!paketDipilih} />}
                    />
                    {paketDipilih && (
                      <small className={`spk__rentang${luarRentang ? " is-luar" : ""}`}>
                        {luarRentang ? "di luar rentang " : "rentang "}Rp{paketDipilih.feeMin}–{paketDipilih.feeMax} jt
                      </small>
                    )}
                  </p>
                  <p className={`spk__terbilang${fee > 0 ? "" : " is-pensil"}`}>
                    {fee > 0 ? `# ${terbilang(fee)} #` : "terbilang muncul begitu nilainya ditulis"}
                  </p>
                </Pasal>

                <Pasal no={4} judul="Jangka waktu" sorot="waktu">
                  <p className="spk__kalimat">
                    Gambar preview diserahkan
                    <span className="spk__tgl">
                      <PilihTanggal
                        id="spk-preview"
                        label="Tenggat gambar preview"
                        nilai={f.deadlinePreview}
                        onUbah={(v) => set("deadlinePreview", v)}
                        placeholder="tanggal"
                      />
                    </span>
                    dan gambar final
                    <span className="spk__tgl">
                      <PilihTanggal
                        id="spk-final"
                        label="Tenggat gambar final"
                        nilai={f.deadlineFinal}
                        onUbah={(v) => set("deadlineFinal", v)}
                        min={f.deadlinePreview || undefined}
                        placeholder="tanggal"
                      />
                    </span>
                  </p>
                  <div className="spk__waktu">
                    <div
                      className={`spk__lini${tPrev === null && tFin === null ? " is-kosong" : ""}${urutanSalah ? " is-salah" : ""}`}
                    >
                      <i
                        className="spk__lini-isi"
                        aria-hidden="true"
                        style={{ width: `${posLini(Math.max(tPrev ?? hariIni, tFin ?? hariIni))}%` }}
                      />
                      <b
                        className="spk__lini-teken"
                        aria-hidden="true"
                        style={{ left: `${posLini(hariIni)}%` }}
                        {...ket(() => ({ judul: "Surat ini", baris: [{ label: "Tanggal", nilai: tglPanjang(kini) }] }))}
                      />
                      {tPrev !== null && (
                        <b
                          className="spk__lini-tanda"
                          aria-hidden="true"
                          style={{ left: `${posLini(tPrev)}%` }}
                          {...ket(() => ({
                            judul: "Gambar preview",
                            baris: [
                              { label: "Tenggat", nilai: tglPreview },
                              { label: "Sejak surat", nilai: `${hariKe(tPrev)} hari` },
                            ],
                          }))}
                        />
                      )}
                      {tFin !== null && (
                        <b
                          className="spk__lini-tanda is-final"
                          aria-hidden="true"
                          style={{ left: `${posLini(tFin)}%` }}
                          {...ket(() => ({
                            judul: "Gambar final",
                            baris: [
                              { label: "Tenggat", nilai: tglFinal },
                              { label: "Sejak surat", nilai: `${hariKe(tFin)} hari` },
                            ],
                          }))}
                        />
                      )}
                    </div>
                    <small className={urutanSalah ? "spk__amber" : undefined}>
                      {urutanSalah ? "Final jatuh sebelum preview — tukar tanggalnya." : kalimatWaktu}
                    </small>
                  </div>
                </Pasal>

                <Pasal no={5} judul="Tim perencana" sorot="fee">
                  <div className="spk__tim" role="table" aria-label="Tim perencana dan bagiannya">
                    <div className="spk__timbaris spk__timbaris--kepala" role="row">
                      <span role="columnheader">Peran</span>
                      <span role="columnheader">Dikerjakan oleh</span>
                      <span role="columnheader" className="spk__kanan">
                        Bagian
                      </span>
                      <span role="columnheader" className="spk__kanan">
                        Rupiah
                      </span>
                      <span role="columnheader" className="sr-only">
                        Buang
                      </span>
                    </div>
                    {tim.map((b) => {
                      const rp = rupiahBaris(b);
                      const p = persen(b);
                      const nama = orangTim.find((o) => o.id === b.orang)?.name;
                      return (
                        <div className={`spk__timbaris${b.orang ? "" : " is-kosong"}`} role="row" key={b.kunci}>
                          <span role="cell" className="spk__peran">
                            <i className={`spk__peranwarna spk__p-${b.role}`} aria-hidden="true" />
                            {b.tambahan ? (
                              <PilihMenu
                                label="Peran"
                                nilai={b.role}
                                onUbah={(v) => {
                                  const role = v as PeranTim;
                                  setBaris(b.kunci, { role, pct: pctAturan(aturan, role), disentuh: false });
                                }}
                                opsi={URUTAN_PERAN.map((r) => ({ nilai: r, label: LABEL_PERAN[r] }))}
                                pemicu={<Tulis teks={LABEL_PERAN[b.role]} />}
                              />
                            ) : (
                              LABEL_PERAN[b.role]
                            )}
                          </span>
                          <span role="cell" className="spk__orang">
                            <PilihMenu
                              label={`Orang untuk peran ${LABEL_PERAN[b.role]}`}
                              nilai={b.orang}
                              onUbah={(v) => setBaris(b.kunci, { orang: v })}
                              opsi={[{ nilai: "", label: "— Belum ada —" }, ...pilihanOrang(b).map((o) => ({ nilai: o.id, label: o.name }))]}
                              pemicu={<Tulis teks={nama ?? "belum ada"} kosong={!nama} />}
                            />
                          </span>
                          <span role="cell" className="spk__kanan spk__bagian">
                            <input
                              className="spk__isi spk__isi--pct"
                              aria-label={`Bagian ${LABEL_PERAN[b.role]} dalam persen`}
                              inputMode="decimal"
                              placeholder="—"
                              value={b.pct}
                              onChange={(e) => setBaris(b.kunci, { pct: e.currentTarget.value.replace(/[^\d.,]/g, ""), disentuh: true })}
                            />
                            <span className="spk__satuan">%</span>
                          </span>
                          <span role="cell" className={`spk__kanan spk__rupiah${b.orang && p === null ? " spk__amber" : ""}`}>
                            {rp !== null ? formatRupiah(rp) : b.orang && p === null ? "belum ditentukan" : "—"}
                          </span>
                          <span role="cell" className="spk__buang">
                            {b.tambahan && (
                              <button
                                type="button"
                                aria-label={`Buang baris ${LABEL_PERAN[b.role]}`}
                                onClick={() => setTim((t) => t.filter((x) => x.kunci !== b.kunci))}
                              >
                                <Ikon ikon={X} ukuran={12} />
                              </button>
                            )}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <p className="spk__timkaki">
                    <button
                      type="button"
                      className="spk__tambah"
                      onClick={() =>
                        setTim((t) => [
                          ...t,
                          {
                            kunci: `tambah-${Date.now()}`,
                            role: "render",
                            orang: "",
                            pct: pctAturan(aturan, "render"),
                            tambahan: true,
                            disentuh: false,
                          },
                        ])
                      }
                    >
                      <Ikon ikon={Plus} ukuran={11} />
                      Bagi peran ke orang kedua
                    </button>
                    <small>
                      {orangTim.length === 0 ? (
                        <>
                          Belum ada anggota tim — <a href="/admin/tim">tambahkan di Tim &amp; Freelancer</a>.
                        </>
                      ) : (
                        <>
                          Dibayar dua tahap: {aturan?.firstTranchePct ?? 50}% saat DP klien masuk, sisanya saat desain selesai ·{" "}
                          <a href="/admin/pengaturan/fee">atur persen peran</a>
                        </>
                      )}
                    </small>
                  </p>
                </Pasal>
              </div>

              <footer className="spk__ttd" aria-label="Tanda tangan">
                <div className="spk__pihakttd">
                  <small>Pihak Pertama</small>
                  <span className="spk__ruang">
                    <svg className="spk__paraf" viewBox="0 0 120 34" aria-hidden="true">
                      <path pathLength={1} d="M4 24c10-14 18-20 22-14s-8 16-2 15 14-22 20-18-4 16 3 15 10-10 16-11 4 8 10 7 16-9 26-12" />
                    </svg>
                    <span className="spk__cap" aria-hidden="true">
                      <b>{inisial(namaStudio)}</b>
                      <small>{kotaStudio || "perencana"}</small>
                    </span>
                  </span>
                  <b className="spk__namattd">{penanda || namaStudio}</b>
                  <small className="spk__jabatan">untuk {namaStudio}</small>
                </div>
                <div className="spk__pihakttd">
                  <small>Pihak Kedua{keadaan === "penawaran" ? " · menyetujui" : ""}</small>
                  <span className="spk__ruang">
                    {keadaan === "teken" ? (
                      <>
                        <span className="spk__meterai" aria-hidden="true">
                          <small>Meterai</small>
                          <b>10.000</b>
                        </span>
                        <svg className="spk__paraf spk__paraf--klien" viewBox="0 0 120 34" aria-hidden="true">
                          <path pathLength={1} d="M6 22c8-2 12-16 18-14s-4 18 4 16 10-16 16-15-2 14 6 12 8-12 14-11 2 10 10 8 14-6 30-10" />
                        </svg>
                      </>
                    ) : (
                      <span className="spk__nanti">diteken saat kontrak</span>
                    )}
                  </span>
                  <b className={`spk__namattd${f.client.trim() ? "" : " is-pensil"}`}>{f.client.trim() || "nama klien"}</b>
                  <small className="spk__jabatan">pemilik pekerjaan</small>
                </div>
              </footer>
            </div>

            {/* ---------- Lembar 2: lampiran halaman publik ---------- */}
            <div
              className="spk__kertas spk__kertas--lampiran"
              role="tabpanel"
              id="spk-lembar-lampiran"
              aria-labelledby="spk-tab-lampiran"
              hidden={lembar !== "lampiran"}
              data-sorot-ke="lampiran"
            >
              <header className="spk__kop spk__kop--lampiran">
                <span className="spk__judulsurat">
                  <h2>Lampiran I</h2>
                  <small>
                    Surat <b>{nomor}</b> · data untuk halaman publik
                  </small>
                </span>
                <span className="spk__tempat">
                  <small>Boleh diisi nanti</small>
                  <small>Hal. 2 dari 2</small>
                </span>
              </header>
              <div className="spk__lampiran">
                <div className="spk__lampirkiri">
                <div className={`spk__sampul${sampul ? "" : " is-kosong"}`}>
                  {sampul ? (
                    <img src={sampul.url} alt="Sampul proyek" />
                  ) : (
                    <span className="spk__sampulkosong">
                      <Ikon ikon={ImageSquare} ukuran={24} />
                      <b>Gambar sampul 16:9</b>
                      <small>Tampil di jendela punggung ordner dan di situs.</small>
                    </span>
                  )}
                  <label className="spk__unggah">
                    {mengunggah ? "Mengunggah…" : sampul ? "Ganti sampul" : "Pilih gambar"}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/avif"
                      aria-label="Pilih gambar sampul proyek"
                      disabled={mengunggah}
                      onChange={(e) => {
                        const berkas = e.currentTarget.files?.[0];
                        if (berkas) unggah(berkas);
                        e.currentTarget.value = "";
                      }}
                    />
                  </label>
                </div>
                {/* Baris yang sama dengan daftar /proyek di situs: kategori ·
                    tempat · tahun, judul, ringkasan — ikut berubah saat diketik. */}
                <div className="spk__karya">
                  <small className="spk__karyalabel">Barisnya di halaman Karya</small>
                  <div className="spk__karyaisi">
                    <span className={`spk__karyafoto${sampul ? "" : " is-kosong"}`}>
                      {sampul ? <img src={sampul.url} alt="" /> : "Belum ada sampul"}
                    </span>
                    <span className="spk__karyateks">
                      <small>{metaKarya}</small>
                      <b className={judul ? undefined : "is-pensil"}>{judul || "Nama proyek"}</b>
                      {f.summary.trim() && <span>{f.summary.trim()}</span>}
                    </span>
                  </div>
                </div>
                </div>
                <div className="spk__lampirisi">
                  <label className="spk__butir">
                    <span>Subjudul</span>
                    <input
                      id="spk-subjudul"
                      className="spk__isi"
                      maxLength={160}
                      placeholder="satu baris penjelas di bawah judul"
                      value={f.subtitle}
                      onChange={(e) => set("subtitle", e.currentTarget.value)}
                    />
                  </label>
                  <div className="spk__butirdua">
                    <label className="spk__butir">
                      <span>Tahun</span>
                      <input
                        id="spk-tahun"
                        className="spk__isi"
                        inputMode="numeric"
                        maxLength={4}
                        placeholder={String(kini.getFullYear())}
                        value={f.year}
                        onChange={(e) => set("year", e.currentTarget.value.replace(/\D/g, ""))}
                      />
                    </label>
                    <label className="spk__butir">
                      <span>Luas (m²)</span>
                      <input
                        id="spk-luas"
                        className="spk__isi"
                        inputMode="numeric"
                        maxLength={7}
                        placeholder="240"
                        value={f.areaSqm}
                        onChange={(e) => set("areaSqm", e.currentTarget.value.replace(/\D/g, ""))}
                      />
                    </label>
                  </div>
                  <label className="spk__butir spk__butir--ringkas">
                    <span>Ringkasan singkat</span>
                    <textarea
                      id="spk-ringkasan"
                      rows={3}
                      placeholder="dua sampai tiga kalimat yang muncul di kartu proyek"
                      value={f.summary}
                      onChange={(e) => set("summary", e.currentTarget.value)}
                    />
                  </label>
                  <p className="spk__lampirket">Tahun menentukan deret rak ordner: tanpa tahun, ordner berdiri di ujung kanan rak.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Tab indeks di tepi kanan tumpukan kertas. */}
          <div className="spk__tab" role="tablist" aria-orientation="vertical" aria-label="Lembar surat">
            {LEMBAR.map((t, i) => (
              <button
                key={t.id}
                ref={(el) => {
                  tabRef.current[i] = el;
                }}
                type="button"
                role="tab"
                id={`spk-tab-${t.id}`}
                aria-controls={`spk-lembar-${t.id}`}
                aria-selected={lembar === t.id}
                tabIndex={lembar === t.id ? 0 : -1}
                onClick={() => setLembar(t.id)}
                onKeyDown={(e) => tabKunci(e, i)}
              >
                <span>{t.label}</span>
              </button>
            ))}
          </div>
        </form>

        {/* ================= KANAN: ordner, pembagian, teken ================= */}
        <aside className="spk__samping" aria-label="Ordner baru dan pembagian fee">
          <section className="spk__rak" aria-labelledby="spk-rak-judul">
            <p className="spk__alis" id="spk-rak-judul">
              Ordner baru <span>· {labelTahap}</span>
            </p>
            <div className="ord spk__ord">
              <div className="spk__jendela">
                <ol className="spk__deret spk__deret--kiri">{rak.kiri.map(jiran)}</ol>
                <div
                  ref={ordnerRef}
                  className={`ord__ordner spk__baru${masuk ? "" : " is-buka"}`}
                  style={{ "--ord-rona": RONA[f.category] ?? 0, "--ord-isi": 0 } as CSSProperties}
                  role="img"
                  aria-label={`Punggung ordner ${judul || "proyek baru"}, kode ${kode}, tahap ${labelTahap}`}
                >
                  <IsiPunggung
                    kode={kode}
                    judul={judul || "Nama proyek"}
                    judulKosong={!judul}
                    tahap={labelTahap}
                    sampulUrl={sampul?.url}
                    huruf={(KATEGORI[f.category] ?? "P").slice(0, 1)}
                  />
                </div>
                <ol className="spk__deret spk__deret--kanan">{rak.kanan.map(jiran)}</ol>
              </div>
              <span className="ord__papanrak" aria-hidden="true" />
            </div>
            <p className="spk__rakket">{kalimatRak}</p>
          </section>

          <section className="spk__bagi" aria-labelledby="spk-bagi-judul">
            <p className="spk__alis" id="spk-bagi-judul">
              Pembagian fee design
            </p>
            <div className="spk__bagiangka">
              <span>
                <small>Tim · {pctTeks(pctTim)}%</small>
                <b>{fee > 0 ? formatRupiah(bagianTim) : "—"}</b>
              </span>
              <span>
                <small>Studio · {pctTeks(pctStudio)}%</small>
                <b>{fee > 0 ? formatRupiah(Math.max(0, fee - bagianTim)) : "—"}</b>
              </span>
            </div>
            <div
              className="spk__batang"
              role="img"
              aria-label={`Tim ${pctTeks(pctTim)} persen, studio ${pctTeks(pctStudio)} persen${jatah !== null ? `, jatah tim ${pctTeks(jatah)} persen` : ""}`}
            >
              {ruas.map((r) => (
                <i
                  key={r.b.kunci}
                  className={`spk__ruas spk__p-${r.b.role}`}
                  style={{ width: `${(r.pct / lebarBatang) * 100}%` }}
                  {...ket(() => ({
                    judul: `${LABEL_PERAN[r.b.role]} · ${r.nama}`,
                    baris: [
                      { label: "Bagian", nilai: `${pctTeks(r.pct)}%` },
                      { label: "Rupiah", nilai: fee > 0 ? formatRupiah(Math.round((fee * r.pct) / 100)) : "fee belum ditulis" },
                    ],
                  }))}
                />
              ))}
              <i
                className="spk__ruas spk__ruas--studio"
                style={{ width: `${(pctStudio / lebarBatang) * 100}%` }}
                {...ket(() => ({
                  judul: `Untuk studio · ${namaStudio}`,
                  baris: [
                    { label: "Bagian", nilai: `${pctTeks(pctStudio)}%` },
                    { label: "Rupiah", nilai: fee > 0 ? formatRupiah(Math.max(0, fee - bagianTim)) : "fee belum ditulis" },
                  ],
                }))}
              />
              {jatah !== null && lewat && (
                <u
                  className="spk__lewat"
                  style={{ left: `${(jatah / lebarBatang) * 100}%`, width: `${((pctTim - jatah) / lebarBatang) * 100}%` }}
                  aria-hidden="true"
                />
              )}
              {jatah !== null && <s className="spk__jatah" style={{ left: `${(jatah / lebarBatang) * 100}%` }} aria-hidden="true" />}
            </div>
            <p className={`spk__bagiket${lewat || belumDitentukan.length ? " is-lewat" : ""}`}>
              {jatah === null
                ? "Jatah tim belum terbaca dari Aturan Fee Tim."
                : terisi.length === 0
                  ? `Jatah tim ${pctTeks(jatah)}% · tulis timnya di Pasal 5.`
                  : lewat
                    ? `Melewati jatah tim ${pctTeks(jatah)}% sebanyak ${pctTeks(pctTim - jatah)}%.`
                    : `Di dalam jatah tim ${pctTeks(jatah)}%.`}
              {belumDitentukan.length > 0 && ` Persen ${belumDitentukan.map((b) => LABEL_PERAN[b.role]).join(" dan ")} belum ditentukan.`}
            </p>
          </section>

          <fieldset className="spk__keadaan" disabled={menyimpan}>
            <legend>Keadaan surat</legend>
            <div className="spk__pilihanwadah">
            {(
              [
                { v: "teken", label: "Sudah diteken", ket: "tahap Deal Kontrak" },
                { v: "penawaran", label: "Masih penawaran", ket: "tahap Proposal" },
              ] as const
            ).map((o) => (
              <label key={o.v} className={`spk__pilihan${keadaan === o.v ? " is-pilih" : ""}`}>
                <input type="radio" name="spk-keadaan" value={o.v} checked={keadaan === o.v} onChange={() => setKeadaan(o.v)} />
                <i aria-hidden="true" />
                <span>
                  <b>{o.label}</b>
                  <small>{o.ket}</small>
                </span>
              </label>
            ))}
            </div>
          </fieldset>

          <div className="spk__aksi">
            <button type="submit" form="form-proyek-baru" className="spk__teken" disabled={!bisaSimpan}>
              {menyimpan
                ? keadaan === "teken"
                  ? "Menandatangani…"
                  : "Mencatat…"
                : keadaan === "teken"
                  ? "Tandatangani & buat proyek"
                  : "Catat penawaran & buat proyek"}
            </button>
            <p className={`spk__alasan${alasan ? " is-mati" : ""}`} aria-live="polite">
              {alasan ?? "Tersimpan sebagai draf — belum tampil di situs sampai diterbitkan."}
            </p>
            <p className="spk__aksilain">
              <button type="button" onClick={() => navigate("/admin/proyek")} disabled={menyimpan}>
                Batal
              </button>
              {adaIsian && (
                <button type="button" onClick={kosongkan} disabled={menyimpan}>
                  Kosongkan surat
                </button>
              )}
            </p>
          </div>
        </aside>
      </div>
      {/* Lapisan salinan surat yang terbang — tidak pernah dirender React. */}
      <div className="spk__lapis" ref={lapisRef} aria-hidden="true" />
      <Keterangan kabar={kabar} />
    </div>
  );
}

export function ProyekBaruKit() {
  return (
    <RequireAuth
      skeleton={
        <div className="spk spk--rangka">
          <div className="spk__papan" />
        </div>
      }
    >
      <ToastProvider>
        <Isi />
      </ToastProvider>
    </RequireAuth>
  );
}
