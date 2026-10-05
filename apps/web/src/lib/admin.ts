/**
 * Klien API admin.
 *
 * Seluruh panggilan lewat backend Go; frontend tidak pernah bicara langsung ke
 * Supabase. Token akses disimpan di localStorage dan disegarkan otomatis saat
 * kedaluwarsa, sehingga staf tidak terlempar ke halaman masuk di tengah
 * penyuntingan.
 */

const API = (import.meta.env.PUBLIC_API_BASE_URL ?? "http://localhost:8787").replace(/\/$/, "");

const KUNCI_AKSES = "pd-access-token";
const KUNCI_SEGAR = "pd-refresh-token";
const KUNCI_PROFIL = "pd-profil";

export interface Profil {
  email: string;
  role: string;
  isMasterAdmin: boolean;
  /** Nama tampilan dari `profiles.full_name`; kosong = diturunkan dari email. */
  nama?: string | null;
}

/** Nama yang ditampilkan untuk sebuah profil: nama tampilannya kalau diisi,
 *  kalau tidak bagian depan email ("dirga.pahlevi@…" → "Dirga Pahlevi"). */
export function namaTampilan(p: Pick<Profil, "email" | "nama">): string {
  if (p.nama?.trim()) return p.nama.trim();
  const depan = (p.email.split("@")[0] || "Akun").replace(/[._-]+/g, " ").trim();
  return depan.replace(/\b\p{L}/gu, (h) => h.toUpperCase());
}

/** Dikirim setiap kali profil tersimpan berubah (nama diganti di halaman
 *  Akun, atau /me membawa nama yang lebih baru) — kartu akun di rel
 *  ber-`transition:persist` dan tidak pernah dipasang ulang. */
export const PERISTIWA_PROFIL = "pd:profil";

/**
 * Sesi boleh disimpan di dua tempat, dan halaman masuk yang memilih:
 *
 * - localStorage  — "Tetap masuk di perangkat ini" dicentang. Bertahan setelah
 *                   peramban ditutup.
 * - sessionStorage — tidak dicentang. Hilang begitu tabnya ditutup, yang
 *                   memang yang diinginkan orang di komputer bersama.
 *
 * `baca` memeriksa sessionStorage LEBIH DULU: kalau seseorang masuk tanpa
 * mencentang di perangkat yang sebelumnya pernah dicentang, sesi baru itu yang
 * harus berlaku, bukan token lama yang tertinggal. `simpanSesi` juga membuang
 * salinan di penyimpanan satunya, supaya tidak pernah ada dua token hidup.
 */
function baca(kunci: string): string | null {
  try {
    return sessionStorage.getItem(kunci) ?? localStorage.getItem(kunci);
  } catch {
    return null;
  }
}

/** Di penyimpanan mana sesi yang sedang berjalan berada. Dipakai saat token
 *  disegarkan: menulis balik ke localStorage secara buta akan MENAIKKAN sesi
 *  yang sengaja dibuat tidak permanen, dan pemakainya tidak akan pernah tahu. */
function sesiPermanen(): boolean {
  try {
    return sessionStorage.getItem(KUNCI_AKSES) === null;
  } catch {
    return true;
  }
}

function tulis(kunci: string, nilai: string, tetap: boolean) {
  try {
    (tetap ? localStorage : sessionStorage).setItem(kunci, nilai);
    (tetap ? sessionStorage : localStorage).removeItem(kunci);
  } catch { /* penyimpanan diblokir */ }
}

function simpanSesi(
  d: { accessToken: string; refreshToken: string; email: string; role: string; isMasterAdmin: boolean; nama?: string | null },
  tetap = true,
) {
  tulis(KUNCI_AKSES, d.accessToken, tetap);
  tulis(KUNCI_SEGAR, d.refreshToken, tetap);
  tulis(KUNCI_PROFIL, JSON.stringify({ email: d.email, role: d.role, isMasterAdmin: d.isMasterAdmin, nama: d.nama ?? null }), tetap);
}

/**
 * Menyamakan profil tersimpan dengan yang baru diketahui (nama yang baru
 * disimpan, atau /me yang membawa nama dari perangkat lain). Ditulis ke
 * penyimpanan TEMPAT SESI ITU BERADA — menulis ke localStorage secara buta
 * akan menaikkan sesi yang sengaja dibuat tidak permanen.
 */
export function sinkronkanProfil(baru: Partial<Profil>) {
  const lama = profilTersimpan();
  if (!lama) return;
  const gabung = { ...lama, ...baru };
  if ((lama.nama ?? null) === (gabung.nama ?? null) && lama.role === gabung.role && lama.isMasterAdmin === gabung.isMasterAdmin) return;
  tulis(KUNCI_PROFIL, JSON.stringify({ email: gabung.email, role: gabung.role, isMasterAdmin: gabung.isMasterAdmin, nama: gabung.nama ?? null }), sesiPermanen());
  try { window.dispatchEvent(new CustomEvent(PERISTIWA_PROFIL, { detail: gabung })); } catch { /* di luar peramban */ }
}

/** Sesi ini disimpan permanen ("tetap masuk") atau hanya selama tab terbuka. */
export function sesiTetap(): boolean {
  return sesiPermanen();
}

/**
 * Waktu sesi ini dimulai, dibaca dari klaim `amr` token akses (JWT dari
 * Supabase). Hanya DIBACA untuk ditampilkan — keabsahannya diperiksa backend
 * di setiap permintaan, bukan di sini. Token yang bukan JWT → null.
 */
export function waktuMasukSesi(): Date | null {
  const token = baca(KUNCI_AKSES);
  const bagian = token?.split(".")[1];
  if (!bagian) return null;
  try {
    const json = JSON.parse(atob(bagian.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(bagian.length / 4) * 4, "=")));
    const stempel = (json.amr as { timestamp?: number }[] | undefined)?.map((a) => a.timestamp ?? 0).sort((a, b) => b - a)[0];
    return stempel ? new Date(stempel * 1000) : null;
  } catch {
    return null;
  }
}

export function hapusSesi() {
  [KUNCI_AKSES, KUNCI_SEGAR, KUNCI_PROFIL].forEach((k) => {
    // Kedua penyimpanan dibersihkan: keluar harus benar-benar keluar, tak
    // peduli sesinya dulu disimpan dengan atau tanpa "tetap masuk".
    try { localStorage.removeItem(k); } catch { /* abaikan */ }
    try { sessionStorage.removeItem(k); } catch { /* abaikan */ }
  });
  // Data proyek dan keuangan tidak boleh tertinggal untuk akun berikutnya
  // yang masuk di tab yang sama.
  buangCache();
}

export function profilTersimpan(): Profil | null {
  const raw = baca(KUNCI_PROFIL);
  if (!raw) return null;
  try { return JSON.parse(raw) as Profil; } catch { return null; }
}

/* --- Cache antar-halaman ---------------------------------------------------
 *
 * Panel admin adalah situs STATIS tanpa router sisi klien: tiap klik menu
 * adalah muat-halaman penuh, dan konteks JS-nya mati total. Artinya tanpa
 * cache, setiap kali staf berpindah halaman — bahkan kembali ke halaman yang
 * baru saja dibuka — sesinya diperiksa ulang dan datanya diambil ulang dari
 * nol. Itu sebabnya skeleton halaman muncul lagi dan lagi.
 *
 * Cache-nya sessionStorage, bukan memori: memori tidak selamat dari muat
 * ulang. sessionStorage, bukan localStorage: isinya data proyek dan
 * keuangan, jadi ia ikut hilang begitu tab ditutup.
 *
 * Polanya stale-while-revalidate. Yang tersimpan ditampilkan SEKETIKA, lalu
 * permintaan segar tetap jalan di belakang dan menimpanya begitu tiba. Jadi
 * halaman kedua yang dibuka tidak pernah kosong, dan angkanya tetap benar
 * satu putaran jaringan kemudian.
 */

const PREFIKS_CACHE = "pd-cache:";

/**
 * Dikirim ke window setiap kali panel MENULIS sesuatu (metode non-GET).
 *
 * Yang mendengarkannya adalah bagian panel yang tidak ikut dipasang ulang
 * saat pindah halaman — topbar — dan karena itu tidak punya cara lain untuk
 * tahu bahwa datanya sudah bergerak.
 */
export const PERISTIWA_TULIS = "pd:tulis";

export function bacaCache<T>(kunci: string): T | null {
  try {
    const raw = sessionStorage.getItem(PREFIKS_CACHE + kunci);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function tulisCache(kunci: string, nilai: unknown) {
  try {
    sessionStorage.setItem(PREFIKS_CACHE + kunci, JSON.stringify(nilai));
  } catch {
    /* Kuota penuh atau penyimpanan diblokir — cache memang boleh gagal. */
  }
}

/**
 * Membuang cache. Tanpa argumen: semuanya (dipakai saat keluar). Dengan
 * awalan: hanya yang cocok — dipakai setelah menulis, supaya halaman lain
 * tidak menampilkan angka sebelum perubahan.
 */
function buangCache(awalan?: string) {
  // Saat keluar, sisa "pd-jumlah:*" ikut dibersihkan: panjang daftar yang
  // dulu diingat untuk skeleton panel lama. Tak ada lagi yang menulisnya,
  // tapi peramban yang sudah memakai panel itu masih menyimpannya.
  if (!awalan) {
    try {
      const buang: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith("pd-jumlah:")) buang.push(k);
      }
      buang.forEach((k) => localStorage.removeItem(k));
    } catch { /* abaikan */ }
  }

  try {
    const buang: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (!k || !k.startsWith(PREFIKS_CACHE)) continue;
      if (awalan && !k.startsWith(PREFIKS_CACHE + awalan)) continue;
      buang.push(k);
    }
    buang.forEach((k) => sessionStorage.removeItem(k));
  } catch {
    /* abaikan */
  }
}

export class GagalAuth extends Error {}

/* Penyegaran yang sedang berjalan, kalau ada.
 *
 * Satu halaman admin memuat beberapa panel sekaligus, dan begitu token
 * kedaluwarsa SEMUANYA menerima 401 dalam milidetik yang sama. Tanpa
 * penampung ini masing-masing menembak /auth/refresh sendiri dengan refresh
 * token YANG SAMA. Sudah terlihat di log produksi: tiga POST berbarengan
 * dalam rentang 45 milidetik dari satu perangkat.
 *
 * Ketiganya kebetulan berhasil karena Supabase memberi tenggang beberapa
 * detik untuk pemakaian ulang. Di luar tenggang itu, refresh token yang
 * dipakai dua kali dibaca sebagai token dicuri dan SELURUH sesi dicabut —
 * gejalanya "tiba-tiba logout sendiri" yang nyaris mustahil dilacak.
 *
 * Jadi yang bersamaan ikut menunggu permintaan yang sudah jalan, bukan
 * memulai permintaan kedua. */
let penyegaranJalan: Promise<boolean> | null = null;

function segarkan(): Promise<boolean> {
  if (!penyegaranJalan) {
    penyegaranJalan = jalankanPenyegaran().finally(() => {
      penyegaranJalan = null;
    });
  }
  return penyegaranJalan;
}

async function jalankanPenyegaran(): Promise<boolean> {
  const refreshToken = baca(KUNCI_SEGAR);
  if (!refreshToken) return false;

  const res = await fetch(`${API}/api/v1/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });
  if (!res.ok) return false;

  const { data } = await res.json();
  // Token baru menggantikan yang lama DI TEMPAT YANG SAMA.
  const tetap = sesiPermanen();
  tulis(KUNCI_AKSES, data.accessToken, tetap);
  tulis(KUNCI_SEGAR, data.refreshToken, tetap);
  return true;
}

/**
 * Memanggil endpoint admin dengan token.
 *
 * Kalau token ditolak, sekali dicoba disegarkan lalu permintaan diulang. Kalau
 * penyegaran juga gagal, sesi dibersihkan dan pemanggil menerima GagalAuth —
 * itu sinyal untuk mengarahkan ke halaman masuk.
 */
/* GET yang SAMA dan sedang berjalan dipakai bersama, bukan dikirim ulang.
 *
 * Kerangka kit memuat beberapa pembaca data sekaligus saat halaman dibuka:
 * isi halaman, lonceng dan tombol pesan di kepala, tombol Terbitkan. Terukur
 * sebelum ini: /admin/projects terkirim TIGA kali dalam satu muat Dashboard,
 * dan settings/inquiries/tasks/testimonials dua kali — 17 permintaan untuk
 * data yang sama. Hanya yang sedang berjalan yang dibagi; begitu selesai,
 * permintaan berikutnya tetap segar (keputusan cache ada di bacaCache/
 * tulisCache, bukan di sini). Tiap pemanggil menerima SALINANnya sendiri,
 * supaya halaman yang mengurutkan daftarnya di tempat tidak mengubah daftar
 * milik komponen lain. */
const sedangBerjalan = new Map<string, Promise<unknown>>();

function panggil<T>(path: string, init: RequestInit = {}, ulang = true): Promise<T> {
  const hanyaMembaca = !init.method || init.method === "GET";
  if (!hanyaMembaca || init.body) return panggilSungguh<T>(path, init, ulang);
  let janji = sedangBerjalan.get(path);
  if (!janji) {
    janji = panggilSungguh<unknown>(path, init, ulang).finally(() => sedangBerjalan.delete(path));
    sedangBerjalan.set(path, janji);
  }
  return janji.then((d) => (d === null || typeof d !== "object" ? d : structuredClone(d)) as T);
}

async function panggilSungguh<T>(path: string, init: RequestInit = {}, ulang = true): Promise<T> {
  const token = baca(KUNCI_AKSES);
  if (!token) throw new GagalAuth("belum masuk");

  const res = await fetch(`${API}/api/v1${path}`, {
    ...init,
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
      Authorization: `Bearer ${token}`,
    },
  });

  if (res.status === 401 && ulang) {
    if (await segarkan()) return panggilSungguh<T>(path, init, false);
    hapusSesi();
    throw new GagalAuth("sesi berakhir");
  }

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error?.message ?? `Permintaan gagal (${res.status})`);
  }

  // Setiap penulisan membatalkan SELURUH cache, bukan cuma kunci yang
  // kelihatan berkaitan. Alasannya: satu perubahan sering merembet ke
  // beberapa daftar sekaligus — menerbitkan proyek mengubah daftar proyek,
  // angka Dashboard, dan lonceng notifikasi. Menebak mana yang terpengaruh
  // adalah cara paling mudah menampilkan angka basi tanpa sadar.
  //
  // Biayanya kecil dan sepadan: studio ini menulis beberapa kali sehari dan
  // membaca puluhan kali, jadi yang dikorbankan cuma satu kali muat setelah
  // menyimpan — bukan setiap kali berpindah halaman.
  if (init.method && init.method !== "GET") {
    buangCache();
    // Topbar memakai transition:persist — ia TIDAK dipasang ulang saat staf
    // pindah halaman, jadi tidak ada satu pun momen alami baginya untuk tahu
    // bahwa ada yang baru saja ditulis. Penanda "ada perubahan yang belum
    // tayang" di sana bergantung pada kabar ini.
    try { window.dispatchEvent(new CustomEvent(PERISTIWA_TULIS)); } catch { /* di luar peramban */ }
  }

  const body = await res.json();
  return body.data as T;
}

// --- Autentikasi ----------------------------------------------------------

export async function masuk(email: string, password: string, tetap = true) {
  const res = await fetch(`${API}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.error?.message ?? "Gagal masuk");

  simpanSesi(body.data, tetap);
  return body.data as Profil;
}

export const ambilProfil = () => panggil<Profil & { id: string }>("/admin/me");

// --- Proyek ---------------------------------------------------------------

export interface Proyek {
  id: string;
  slug: string;
  title: string;
  subtitle?: string;
  summary?: string;
  description?: string;
  category: string;
  status: string;
  location?: string;
  city?: string;
  year?: number;
  client?: string;
  areaSqm?: number;
  leadArchitect?: string;
  /* Kredit proyek — tampil di blok CREDITS halaman proyek publik. */
  contractor?: string;
  lightingDesigner?: string;
  photographer?: string;
  coverImageUrl?: string;
  /* Foto galeri ikut di daftar proyek — dipakai tabel pemilih untuk
     menampilkan tumpukan thumbnail tanpa satu permintaan per baris. */
  images?: GambarProyek[];
  isFeatured: boolean;
  seoTitle?: string;
  seoDescription?: string;
  publishedAt?: string;
  pipelineStage?: string;
  /** Fase yang dilihat KLIEN di portal token — kolom project_progress.phase,
   *  bukan projects.pipeline_stage. Ikut di daftar supaya tabel bisa
   *  menampilkannya tanpa satu permintaan tambahan per baris. */
  phase?: string | null;
  contractValue?: number | null;
  clientWhatsapp?: string | null;
  /** Lingkup kerja yang disepakati — internal, tidak tampil di situs. */
  scopeOfWork?: string | null;
  /** Tenggat preview untuk klien dan desain final (YYYY-MM-DD). */
  deadlinePreview?: string | null;
  deadlineFinal?: string | null;
  /** Paket layanan yang dijual untuk proyek ini — boleh kosong. */
  tierId?: string | null;
  /** Uang yang BENAR-BENAR sudah diterima. Nol berarti belum dibayar sama
   *  sekali — itulah yang memunculkan tombol Bayar Pertama di tabel. */
  paidTotal?: number;
}

/** Satu uang masuk. Beda dari Tagihan (invoice), yang cuma janji. */
export interface Pembayaran {
  id: string;
  projectId: string;
  amount: number;
  kind: string;
  method: string;
  receiver?: string | null;
  note?: string | null;
  paidAt: string;
  receiptToken: string;
  /** Ikut terbawa oleh daftar LINTAS proyek, tidak oleh daftar per proyek —
   *  sama persis dengan `BiayaProyek.projectTitle`. */
  projectTitle?: string;
}

export const daftarPembayaran = (projectId: string) =>
  panggil<Pembayaran[]>(`/admin/projects/${projectId}/payments`);

/** Uang MASUK lintas proyek — pasangan dari `semuaBiaya()`. */
export const semuaPembayaran = () => panggil<Pembayaran[]>("/admin/payments");

export const catatPembayaran = (
  projectId: string,
  /* `note` memang diterima endpoint-nya — `PaymentInput` di apps/api
     memuatnya dan `paymentsRepo.create` menulisnya ke kolom `note`. Yang
     kurang cuma tipe di sisi klien ini, jadi kolomnya tidak pernah bisa
     diisi dari panel sampai sekarang. */
  isi: { amount: number; kind: string; method: string; receiver?: string | null; note?: string | null },
) =>
  panggil<Pembayaran>(`/admin/projects/${projectId}/payments`, {
    method: "POST",
    body: JSON.stringify(isi),
  });

export const daftarProyek = () => panggil<Proyek[]>("/admin/projects");

export const buatProyek = (slug: string, title: string, category: string) =>
  panggil<{ id: string }>("/admin/projects", {
    method: "POST",
    body: JSON.stringify({ slug, title, category }),
  });

export const simpanProyek = (id: string, patch: Partial<Proyek>) =>
  panggil<{ updated: boolean }>(`/admin/projects/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });

export const hapusProyek = (id: string) =>
  panggil<{ deleted: boolean }>(`/admin/projects/${id}`, { method: "DELETE" });

// --- Pesan masuk ----------------------------------------------------------

export interface Pesan {
  id: string;
  name: string;
  email: string;
  phone?: string;
  projectType?: string;
  budgetRange?: string;
  message: string;
  status: string;
  createdAt: string;
}

export const daftarPesan = (status = "") =>
  panggil<Pesan[]>(`/admin/inquiries${status ? `?status=${status}` : ""}`);

export const ubahStatusPesan = (id: string, status: string) =>
  panggil<{ updated: boolean }>(`/admin/inquiries/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });

// --- Paket layanan -------------------------------------------------------

/** Bentuknya sama dengan yang dibaca beranda — satu tipe untuk keduanya. */
export type { Paket } from "./api";
import type { Paket as PaketApi } from "./api";

/** undefined = jangan diubah. Fee dalam juta. */
export type PaketInput = Partial<Omit<PaketApi, "id" | "updatedAt">>;

/** Semua paket, TERMASUK yang dihentikan — beranda cuma melihat yang aktif. */
export const daftarPaket = () => panggil<PaketApi[]>("/admin/tiers");
export const ambilPaket = (id: string) => panggil<PaketApi>(`/admin/tiers/${encodeURIComponent(id)}`);
export const buatPaket = (p: PaketInput) =>
  panggil<{ id: string }>("/admin/tiers", { method: "POST", body: JSON.stringify(p) });
export const ubahPaket = (id: string, p: PaketInput) =>
  panggil<{ updated: boolean }>(`/admin/tiers/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(p),
  });
export const hapusPaket = (id: string) =>
  panggil<{ deleted: boolean }>(`/admin/tiers/${encodeURIComponent(id)}`, { method: "DELETE" });

/**
 * Pemakaian tiap paket — dasar pengingat §3.3 ("tiap 3 proyek selesai pada
 * satu tier, harga naik 10–15% untuk klien baru"). Panel saja, tidak pernah
 * ke beranda.
 */
export interface PemakaianPaket {
  tierId: string;
  priceChangedAt: string;
  proyek: number;
  selesai: number;
  selesaiSejakHarga: number;
  saatnyaNaik: boolean;
}
export const pemakaianPaket = () => panggil<PemakaianPaket[]>("/admin/tiers/usage");

/** KPI dokumen strategi §8 — dihitung API, tidak pernah diketik. */
export interface KpiStrategi {
  hariIni: string;
  tahun: number;
  kuartal: number;
  target: {
    rataKontrakMin: number;
    rataKontrakMaks: number;
    marginMin: number;
    leadKuartalMin: number;
    leadKuartalMaks: number;
    signatureMin: number;
    cadanganBulan: number;
  };
  rataKontrak: { nilai: number | null; proyek: number };
  margin: {
    rata: number | null;
    proyek: number;
    dibawah: { projectId: string; title: string; kontrak: number; biaya: number; margin: number }[];
  };
  lead: { kuartalIni: number; ditindaklanjuti: number };
  signature: { jumlah: number; proyek: { projectId: string; title: string; tier: string }[] };
  cadangan: { saldo: number; keluarPerBulan: number | null; bulanBerdata: number; bulan: number | null };
  segmen: { kategori: string; proyek: number; diterima: number; biaya: number; laba: number }[];
}
export const ambilKpi = () => panggil<KpiStrategi>("/admin/kpi");

// --- Unggahan -------------------------------------------------------------

export const mintaUrlUnggah = (projectSlug: string, contentType: string) =>
  panggil<{ key: string; uploadUrl: string; expiresAt: string }>("/admin/uploads", {
    method: "POST",
    body: JSON.stringify({ projectSlug, contentType }),
  });

/** Aset tingkat studio (logo) — bukan milik satu proyek, jadi tanpa slug. */
export const mintaUrlUnggahLogo = (contentType: string) =>
  panggil<{ key: string; uploadUrl: string; expiresAt: string }>("/admin/uploads", {
    method: "POST",
    body: JSON.stringify({ scope: "logo", contentType }),
  });

// --- Info studio ------------------------------------------------------

export interface StudioSettings {
  studioName: string;
  tagline?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  instagramUrl?: string | null;
  /** URL siap-pakai, dibalas server. Bukan yang dikirim balik saat menyimpan. */
  logoUrl?: string | null;
  /** Key R2 dari unggahan terbaru — dikirim saat menyimpan, bukan dibaca dari server. */
  logoKey?: string | null;
  /** Bukan kolom database: keadaan rahasia Worker, dibalas server saja. */
  notifikasiEmailAktif?: boolean;
  /** Apakah Worker punya token GitHub untuk memicu build ulang situs. */
  terbitSitusAktif?: boolean;
  /** Nama zona IANA (Asia/Jakarta | Asia/Makassar | Asia/Jayapura). */
  timezone?: string;

  /* --- Isi halaman publik ------------------------------------------------
   * Semuanya boleh kosong, dan halaman publik memang dirancang untuk itu:
   * bagian yang datanya belum ada tetap dirender dengan penanda "menunggu"
   * yang ikut dirancang. */
  foundedYear?: number | null;
  firstCommercialYear?: number | null;
  /** URL siap pakai, dibalas server. */
  beforeUrl?: string | null;
  afterUrl?: string | null;
  /** Key R2 dari unggahan terbaru — dikirim saat menyimpan, bukan dibaca. */
  beforeKey?: string | null;
  afterKey?: string | null;
  legalEntity?: string | null;
  legalAddress?: string | null;
  retentionMessages?: string | null;
  retentionDocuments?: string | null;
  governingLaw?: string | null;
  faqTarif?: string | null;
  faqUangMuka?: string | null;
  faqLamaKerja?: string | null;
  faqKunjungan?: string | null;
}

/** Satu orang di halaman /studio. Bukan Tim & Freelancer — itu urusan lain. */
export interface OrangStudio {
  id: string;
  /** Boleh kosong: kartunya tetap tampil beserta peran, bertanda menunggu. */
  name: string | null;
  role: string;
  bio: string | null;
  photoUrl: string | null;
  slotLabel: string;
  sortOrder: number;
}

export interface OrangStudioInput {
  name?: string | null;
  role?: string;
  bio?: string | null;
  photoKey?: string | null;
  slotLabel?: string;
  sortOrder?: number;
}

export const daftarOrangStudio = () => panggil<OrangStudio[]>("/admin/studio-team");

export const buatOrangStudio = (input: OrangStudioInput) =>
  panggil<{ id: string }>("/admin/studio-team", { method: "POST", body: JSON.stringify(input) });

export const ubahOrangStudio = (id: string, input: OrangStudioInput) =>
  panggil<{ updated: boolean }>(`/admin/studio-team/${id}`, {
    method: "PATCH", body: JSON.stringify(input),
  });

export const hapusOrangStudio = (id: string) =>
  panggil<{ deleted: boolean }>(`/admin/studio-team/${id}`, { method: "DELETE" });

/** Aset tingkat studio yang BUKAN logo: potret tim, foto sebelum/sesudah. */
export const mintaUrlUnggahStudio = (contentType: string) =>
  panggil<{ key: string; uploadUrl: string; expiresAt: string }>("/admin/uploads", {
    method: "POST", body: JSON.stringify({ scope: "studio", contentType }),
  });

/** Tiga zona Indonesia beserta singkatan yang dibaca manusia. */
export const ZONA_WAKTU: { id: string; label: string; nama: string; utc: string }[] = [
  { id: "Asia/Jakarta", label: "WIB", nama: "Waktu Indonesia Barat", utc: "UTC+7" },
  { id: "Asia/Makassar", label: "WITA", nama: "Waktu Indonesia Tengah", utc: "UTC+8" },
  { id: "Asia/Jayapura", label: "WIT", nama: "Waktu Indonesia Timur", utc: "UTC+9" },
];

/** Singkatan untuk sebuah nama zona IANA; jatuh ke WIB kalau tidak dikenal. */
export function singkatanZona(id?: string | null): string {
  return ZONA_WAKTU.find((z) => z.id === id)?.label ?? "WIB";
}

export const ambilSettings = () => panggil<StudioSettings>("/admin/settings");

export const simpanSettings = (patch: Partial<StudioSettings>) =>
  panggil<{ updated: boolean }>("/admin/settings", { method: "PATCH", body: JSON.stringify(patch) });

/**
 * Bita logo studio untuk kop PDF, lewat Worker API — bukan langsung dari
 * media.pahlevidirga... Pustaka PDF butuh berkasnya, dan mengambilnya
 * langsung dari bucket berarti bergantung pada aturan CORS yang disetel
 * untuk keperluan lain.
 *
 * Membalas null kalau studio belum punya logo; itu keadaan wajar, bukan
 * kesalahan — PDF-nya tetap terbit dengan kop tanpa gambar.
 */
export async function ambilLogoStudio(): Promise<{ bita: Uint8Array; tipe: string } | null> {
  const token = baca(KUNCI_AKSES);
  if (!token) throw new GagalAuth("belum masuk");

  const res = await fetch(`${API}/api/v1/admin/settings/logo`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 404) return null;
  if (!res.ok) return null;

  return {
    bita: new Uint8Array(await res.arrayBuffer()),
    tipe: res.headers.get("content-type") ?? "",
  };
}

// --- Akun ---------------------------------------------------------------

interface SesiAkun {
  id: string;
  dibuat: string;
  terakhirAktif: string;
  userAgent: string | null;
}

export interface InfoAkun {
  email: string;
  role: string;
  isMasterAdmin: boolean;
  nama: string | null;
  stafSejak: string;
  terakhirMasuk: string | null;
  sesi: {
    /** Semua sesi hidup, termasuk yang sedang dipakai. */
    jumlah: number;
    aktif24j: number;
    ini: SesiAkun | null;
    /** Sesi lain berperamban — paling banyak empat, terbaru lebih dulu. */
    lain: SesiAkun[];
    /** Sesi lain tanpa nama perangkat (tercatat sebelum login meneruskannya). */
    tanpaNama: number;
    tanpaNamaTerakhir: string | null;
  };
}

export const ambilAkun = () => panggil<InfoAkun>("/admin/account");

export async function ubahNamaAkun(nama: string): Promise<string | null> {
  const r = await panggil<{ nama: string | null }>("/admin/account/profile", {
    method: "PATCH",
    body: JSON.stringify({ nama }),
  });
  sinkronkanProfil({ nama: r.nama });
  return r.nama;
}

export const ubahPassword = (currentPassword: string, newPassword: string) =>
  panggil<{ updated: boolean; lainKeluar: boolean }>("/admin/account/password", {
    method: "PATCH",
    body: JSON.stringify({ currentPassword, newPassword }),
  });

/** Mencabut semua sesi akun ini KECUALI yang sedang dipakai. */
export const keluarkanPerangkatLain = () =>
  panggil<{ scope: string }>("/admin/account/logout", { method: "POST", body: JSON.stringify({ scope: "others" }) });

/**
 * Keluar: cabut sesi ini di Supabase, lalu hapus token di peramban.
 *
 * Dulu keluar cuma menghapus token lokal, jadi refresh token-nya tetap hidup
 * di Supabase — produksi menumpuk 88 sesi. Pencabutannya usaha-terbaik dan
 * dibatasi 2,5 detik: jaringan yang mati tidak boleh membuat orang tidak
 * bisa keluar.
 */
export async function keluar(): Promise<void> {
  await Promise.race([
    panggil("/admin/account/logout", { method: "POST", body: JSON.stringify({ scope: "local" }) }, false).catch(() => null),
    new Promise((r) => setTimeout(r, 2500)),
  ]);
  hapusSesi();
}

// --- Progres proyek (dilihat klien lewat link token) --------------------

export interface ProgressUpdate {
  id: string;
  title: string;
  note?: string | null;
  photoUrl?: string | null;
  createdAt: string;
}

export interface ProjectProgress {
  phase: string;
  accessToken: string;
  updates: ProgressUpdate[];
}

export const ambilProgress = (projectId: string) =>
  panggil<ProjectProgress>(`/admin/projects/${projectId}/progress`);

export const ubahFaseProgress = (projectId: string, phase: string) =>
  panggil<{ updated: boolean }>(`/admin/projects/${projectId}/progress`, {
    method: "PATCH",
    body: JSON.stringify({ phase }),
  });

export const buatUlangTokenProgress = (projectId: string) =>
  panggil<{ accessToken: string }>(`/admin/projects/${projectId}/progress/token`, { method: "POST" });

export const tambahCatatanProgress = (projectId: string, title: string, note: string | null) =>
  panggil<{ id: string }>(`/admin/projects/${projectId}/progress/updates`, {
    method: "POST",
    body: JSON.stringify({ title, note }),
  });

export const hapusCatatanProgress = (id: string) =>
  panggil<{ deleted: boolean }>(`/admin/progress-updates/${id}`, { method: "DELETE" });

// --- Tim & freelancer -----------------------------------------------------

/** Empat jenis dari §5.2 dan §5.3 dokumen strategi. */
export type JenisAnggota = "partner" | "inti" | "proyek" | "staf";

export const LABEL_JENIS_ANGGOTA: Record<JenisAnggota, string> = {
  partner: "Partner",
  inti: "Freelancer inti",
  proyek: "Freelancer proyek",
  staf: "Staf tetap",
};

export interface AnggotaTim {
  id: string;
  name: string;
  role?: string | null;
  kind: JenisAnggota;
  /** Tarif acuan, bukan nominal yang mengikat. */
  rate?: number | null;
  phone?: string | null;
  active: boolean;
}

export const daftarTim = () => panggil<AnggotaTim[]>("/admin/team");

/* Menerima seluruh kolom, bukan cuma nama dan peran. Migrasi Fase 01 sudah
   menambahkan jenis, tarif, telepon, dan aktif — dan API sudah menerimanya
   sejak saat itu; yang menyempitkannya cuma tanda tangan fungsi ini, sehingga
   keempatnya hanya bisa diubah lewat database. */
export const tambahAnggotaTim = (a: {
  name: string; role?: string | null; kind?: JenisAnggota;
  rate?: number | null; phone?: string | null; active?: boolean;
}) => panggil<{ id: string }>("/admin/team", { method: "POST", body: JSON.stringify(a) });

export const ubahAnggotaTim = (id: string, patch: Partial<AnggotaTim>) =>
  panggil<{ updated: boolean }>(`/admin/team/${id}`, { method: "PATCH", body: JSON.stringify(patch) });

export const hapusAnggotaTim = (id: string) =>
  panggil<{ deleted: boolean }>(`/admin/team/${id}`, { method: "DELETE" });

// --- List Kerjaan (tugas) ---------------------------------------------------

export interface Tugas {
  id: string;
  projectId: string;
  projectTitle?: string;
  title: string;
  stage?: string | null;
  assigneeId?: string | null;
  assigneeName?: string | null;
  status: string;
  dueDate?: string | null;
  sortOrder: number;
}

export const daftarTugas = () => panggil<Tugas[]>("/admin/tasks");

export const daftarTugasProyek = (projectId: string) => panggil<Tugas[]>(`/admin/projects/${projectId}/tasks`);

export const tambahTugas = (
  projectId: string,
  input: { title: string; stage?: string | null; assigneeId?: string | null; dueDate?: string | null },
) => panggil<{ id: string }>(`/admin/projects/${projectId}/tasks`, { method: "POST", body: JSON.stringify(input) });

export const ubahTugas = (id: string, patch: Partial<Tugas>) =>
  panggil<{ updated: boolean }>(`/admin/tasks/${id}`, { method: "PATCH", body: JSON.stringify(patch) });

export const hapusTugas = (id: string) =>
  panggil<{ deleted: boolean }>(`/admin/tasks/${id}`, { method: "DELETE" });

// --- Keuangan --------------------------------------------------------------
//
// Tampilan Keuangan dihapus seluruhnya atas permintaan pemilik dan akan
// dirancang ulang dari nol. Yang tersisa di sini SENGAJA: tipe dan pemanggil
// di bawah memetakan endpoint API yang masih hidup dan tidak ikut dihapus,
// jadi layar baru nanti tinggal memakainya kembali. Tidak ada satu pun bidang
// karangan di sini — semuanya benar-benar dikirim API.

export interface FinanceOverviewRow {
  projectId: string;
  projectTitle: string;
  contractValue: number | null;
  received: number;
  costsTotal: number;
  /** Proyeksi kalau seluruh kontrak dibayar. Janji, bukan uang. */
  marginPct: number | null;
  /** Kenyataan kas: diterima - biaya. Boleh minus, dan itu memang datanya. */
  labaBersih: number;
  belumDiterima: number | null;
}

/** Satu kategori biaya, untuk donat Rincian Beban. Nilainya dari API. */
export interface BebanKategori {
  /** Nilai enum public.cost_category: freelancer, operasional, prinsipal, lainnya. */
  kategori: string;
  nilai: number;
}

export interface FinanceOverview {
  kasMasuk: number;
  piutang: number;
  marginRataRata: number | null;
  labaBersih: number;
  totalBiaya: number;
  totalKontrak: number;
  proyek: FinanceOverviewRow[];
  /** Selalu keempat kategori, termasuk yang nol. */
  bebanKategori: BebanKategori[];
}

/** Satu bulan dari endpoint /admin/finance/monthly. */
export interface BarisBulanan {
  /** YYYY-MM. */
  bulan: string;
  kasMasuk: number;
  biaya: number;
  labaBersih: number;
  proyekAktif: number;
}

/**
 * Memicu build ulang situs statis.
 *
 * Halaman proyek publik dibekukan saat build, jadi menerbitkan proyek di
 * panel admin tidak mengubah situs sampai ini dijalankan. Tokennya hidup di
 * Worker API — halaman ini tidak pernah memegangnya.
 */
export const terbitkanSitus = () => panggil<{ dimulai: boolean }>("/admin/publish", { method: "POST" });

/**
 * Kapan isi publik terakhir berubah, menurut database.
 *
 * Pembandingnya BUKAN dari sini: waktu build dipanggang ke dalam halaman
 * panel saat situsnya dibangun (lihat AdminLayout.astro). Halaman panel ini
 * sendiri hasil build yang sama dengan situs publiknya, jadi stempel di
 * dalamnya persis waktu yang dipakai halaman publik yang sedang tayang.
 */
export const statusTerbit = () => panggil<{ terakhirBerubah: string | null }>("/admin/publish-status");

/** Tanpa projectId berarti "Semua" — seluruh proyek studio. */
export const ambilRingkasanKeuangan = (projectId?: string | null) =>
  panggil<FinanceOverview>(`/admin/finance/overview${projectId ? `?projectId=${projectId}` : ""}`);

export const ambilBulanan = (projectId?: string | null, bulan = 12) =>
  panggil<BarisBulanan[]>(
    `/admin/finance/monthly?bulan=${bulan}${projectId ? `&projectId=${projectId}` : ""}`,
  );

export interface Invoice {
  id: string;
  projectId: string;
  label: string;
  amount: number;
  status: string;
  dueDate?: string | null;
  paidAt?: string | null;
  sortOrder: number;
  /** Ikut terbawa oleh daftar LINTAS proyek, tidak oleh daftar per proyek. */
  projectTitle?: string;
}

export const daftarInvoice = (projectId: string) => panggil<Invoice[]>(`/admin/projects/${projectId}/invoices`);

/** Tagihan LINTAS proyek — pasangan dari `semuaBiaya()` dan `semuaPembayaran()`. */
export const semuaTagihan = () => panggil<Invoice[]>("/admin/invoices");

/** `sortOrder` wajib dikirim pemanggil: API menyimpannya apa adanya dengan
 *  bawaan 0, dan termin baru bernilai 0 tersusun DI DEPAN termin lama —
 *  "Termin 1 dari 4" jadi milik termin yang baru ditambahkan. */
export const tambahInvoice = (projectId: string, label: string, amount: number, dueDate: string | null, sortOrder?: number) =>
  panggil<{ id: string }>(`/admin/projects/${projectId}/invoices`, {
    method: "POST",
    body: JSON.stringify({ label, amount, dueDate, sortOrder }),
  });

export const ubahInvoice = (id: string, patch: Partial<Invoice>) =>
  panggil<{ updated: boolean }>(`/admin/invoices/${id}`, { method: "PATCH", body: JSON.stringify(patch) });

export const hapusInvoice = (id: string) =>
  panggil<{ deleted: boolean }>(`/admin/invoices/${id}`, { method: "DELETE" });

export interface BiayaProyek {
  id: string;
  projectId: string;
  /** Ikut terbawa oleh daftar lintas proyek, tidak oleh daftar per proyek. */
  projectTitle?: string;
  label: string;
  category: string;
  amount: number;
  /** Tanggal biaya benar-benar terjadi (YYYY-MM-DD), bukan kapan diketik. */
  incurredOn: string;
  /** Siapa yang dibayar. Kosong untuk biaya operasional yang bukan milik orang. */
  teamMemberId?: string | null;
  teamMemberName?: string | null;
}

/** Satu orang dalam satu bulan: gaji yang diketik + fee yang dijumlahkan. */
export interface BarisGajiBulan {
  teamMemberId: string;
  name: string;
  kind: JenisAnggota;
  role?: string | null;
  salaryId?: string | null;
  salaryAmount?: number | null;
  salaryPaidOn?: string | null;
  salaryNote?: string | null;
  feeAmount: number;
  feeCount: number;
  total: number;
}

export interface FeeProyek {
  projectId: string;
  projectTitle: string;
  contractValue: number | null;
  feeTotal: number;
  feeTanpaNama: number;
  feeShare: number | null;
  orang: { teamMemberId: string; name: string; kind: JenisAnggota; amount: number }[];
}

export interface FeeOrang {
  teamMemberId: string;
  name: string;
  kind: JenisAnggota;
  role?: string | null;
  total: number;
  projectCount: number;
  lastOn: string | null;
}

export const daftarBiaya = (projectId: string) => panggil<BiayaProyek[]>(`/admin/projects/${projectId}/costs`);

export const hapusBiaya = (id: string) =>
  panggil<{ deleted: boolean }>(`/admin/costs/${id}`, { method: "DELETE" });

/* ── Satu pintu: biaya lintas proyek ──────────────────────────────────────
 *
 * Sejak "Kerja Internal" dibuang, halaman Kas & Biaya adalah SATU-SATUNYA
 * tempat mencatat pengeluaran. Proyeknya dipilih dari dropdown di dialog,
 * bukan ditentukan oleh halaman mana staf kebetulan berada. */

export const semuaBiaya = () => panggil<BiayaProyek[]>("/admin/costs");

export const catatBiaya = (b: {
  projectId: string; label: string; category: string;
  amount: number; incurredOn?: string; teamMemberId?: string | null;
}) => panggil<{ id: string }>("/admin/costs", { method: "POST", body: JSON.stringify(b) });

/* ── Fee proyek ───────────────────────────────────────────────────────── */

export const feePerProyek = (r: { dari?: string; sampai?: string } = {}) =>
  panggil<FeeProyek[]>(`/admin/fee/projects${kueri(r)}`);

export const feePerOrang = (r: { dari?: string; sampai?: string } = {}) =>
  panggil<FeeOrang[]>(`/admin/fee/people${kueri(r)}`);

/* ── Gaji ─────────────────────────────────────────────────────────────── */

/** Satu baris gaji yang diketik — tanpa fee. `period` = tanggal 1 bulannya. */
export interface EntriGaji {
  id: string;
  teamMemberId: string;
  teamMemberName: string;
  period: string;
  amount: number;
  paidOn: string | null;
  note: string | null;
}

/** Seluruh riwayat gaji, semua bulan — untuk grafik bulanan dan tahunan. */
export const riwayatGaji = () => panggil<EntriGaji[]>("/admin/payroll");

export const gajiBulan = (period: string) =>
  panggil<BarisGajiBulan[]>(`/admin/payroll/month?period=${encodeURIComponent(period)}`);

export const catatGaji = (g: {
  teamMemberId: string; period: string; amount: number; paidOn?: string | null; note?: string | null;
}) => panggil<{ id: string }>("/admin/payroll", { method: "POST", body: JSON.stringify(g) });

export const ubahGaji = (
  id: string, g: { amount?: number; paidOn?: string | null; note?: string | null },
) => panggil<{ updated: boolean }>(`/admin/payroll/${id}`, { method: "PATCH", body: JSON.stringify(g) });

export const hapusGaji = (id: string) =>
  panggil<{ deleted: boolean }>(`/admin/payroll/${id}`, { method: "DELETE" });

/* ── Tim per peran & bayaran bertahap (fase 1 alur Excel pemilik) ───────
 *
 * Penugasan menyimpan PERSEN; rupiahnya dihitung API dari fee design. Yang
 * sudah dibayar adalah biaya proyek bertaut tahapnya — jadi Fee, Gaji, dan
 * laba proyek membaca angka yang sama. */

export type PeranTim = "leader" | "drafter" | "render" | "estimator";
export type TahapBayar = "awal" | "akhir";

export const LABEL_PERAN: Record<PeranTim, string> = {
  leader: "Leader",
  drafter: "Drafter",
  render: "Render",
  estimator: "Estimator",
};
export const URUTAN_PERAN: PeranTim[] = ["leader", "drafter", "render", "estimator"];

/** Aturan persen studio. null = belum ditentukan (bukan nol). */
export interface AturanFee {
  pctLeader: number | null;
  pctDrafter: number | null;
  pctRender: number | null;
  pctEstimator: number | null;
  poolPct: number;
  firstTranchePct: number;
}

export function pctBawaan(a: AturanFee, p: PeranTim): number | null {
  return { leader: a.pctLeader, drafter: a.pctDrafter, render: a.pctRender, estimator: a.pctEstimator }[p];
}

export interface TahapBayaran {
  tahap: TahapBayar;
  nominal: number | null;
  keadaan: "dibayar" | "jatuh_tempo" | "menunggu" | "belum_ditentukan";
  costId: string | null;
  dibayar: number | null;
  dibayarPada: string | null;
}

export interface PenugasanTim {
  id: string;
  projectId: string;
  projectTitle: string;
  teamMemberId: string;
  teamMemberName: string;
  teamMemberKind: string;
  role: PeranTim;
  pct: number | null;
  pctBerlaku: number | null;
  note: string | null;
  feeDesign: number | null;
  hak: number | null;
  dibayar: number;
  terutang: number | null;
  tahap: TahapBayaran[];
}

export const ambilAturanFee = () => panggil<AturanFee>("/admin/fee-rules");
export const simpanAturanFee = (a: Partial<AturanFee>) =>
  panggil<AturanFee>("/admin/fee-rules", { method: "PATCH", body: JSON.stringify(a) });

export const daftarTimProyek = (projectId: string) =>
  panggil<PenugasanTim[]>(`/admin/projects/${projectId}/team`);
/** `pct` tidak dikirim = ambil dari aturan studio dan dibekukan. */
export const tambahTimProyek = (
  projectId: string,
  t: { teamMemberId: string; role: PeranTim; pct?: number | null; note?: string | null },
) => panggil<{ id: string }>(`/admin/projects/${projectId}/team`, { method: "POST", body: JSON.stringify(t) });
export const ubahTimProyek = (id: string, t: { pct?: number | null; note?: string | null; teamMemberId?: string }) =>
  panggil<{ updated: boolean }>(`/admin/project-team/${id}`, { method: "PATCH", body: JSON.stringify(t) });
export const hapusTimProyek = (id: string) =>
  panggil<{ deleted: boolean }>(`/admin/project-team/${id}`, { method: "DELETE" });

/** Mencatat satu tahap sebagai biaya proyek. Nominal kosong = yang dihitung. */
export const bayarTahap = (b: { projectTeamId: string; tahap: TahapBayar; amount?: number | null; paidOn?: string | null }) =>
  panggil<{ id: string }>("/admin/team-payouts", { method: "POST", body: JSON.stringify(b) });

/** Ringkasan hak per orang lintas proyek — kolom "TOTAL BONUS" sheet GAJI. */
export interface RingkasanBayaranOrang {
  teamMemberId: string;
  teamMemberName: string;
  teamMemberKind: JenisAnggota;
  proyek: number;
  hak: number;
  dibayar: number;
  /** Hak yang belum dibayar, termasuk yang belum jatuh tempo. */
  terutang: number;
  /** Bagian terutang yang SUDAH jatuh tempo — yang perlu dibayar sekarang. */
  jatuhTempo: number;
  /** Penugasan yang persennya belum ditentukan (tidak ikut dijumlah). */
  belumDitentukan: number;
}
export const ringkasanBayaranTim = () => panggil<RingkasanBayaranOrang[]>("/admin/team-payouts/people");
export const penugasanOrang = (teamMemberId: string) =>
  panggil<PenugasanTim[]>(`/admin/team-payouts?teamMemberId=${encodeURIComponent(teamMemberId)}`);

/** Slip satu orang satu bulan — pengganti sheet "GAJI <nama>". */
export interface BarisSlip {
  costId: string;
  projectId: string;
  projectTitle: string;
  label: string;
  amount: number;
  incurredOn: string;
  role: PeranTim | null;
  pct: number | null;
  payoutStage: TahapBayar | null;
}
export interface SlipGaji {
  teamMemberId: string;
  name: string;
  kind: JenisAnggota;
  role: string | null;
  phone: string | null;
  period: string;
  salary: { id: string; amount: number; paidOn: string | null; note: string | null } | null;
  fees: BarisSlip[];
  salaryAmount: number;
  feeAmount: number;
  total: number;
}
/** `period` = 'YYYY-MM'. */
export const ambilSlip = (teamMemberId: string, period: string) =>
  panggil<SlipGaji>(`/admin/payroll/slip?teamMemberId=${encodeURIComponent(teamMemberId)}&period=${period}`);

/* --- Kas studio & target semester (sheet "KELUAR MASUK") -------------------
   Uang di luar proyek: penjualan material, bagi hasil, konsumsi, operasional.
   Pembayaran klien, bayaran tim, dan gaji TIDAK dicatat di sini. */

export type ArusKas = "masuk" | "keluar";
export type KategoriKas =
  | "penjualan_material" | "bagi_hasil" | "pembelian_material" | "operasional" | "konsumsi" | "lainnya";
/** Kategori yang sah per arus — cermin constraint studio_ledger_kategori_searah. */
export const KATEGORI_KAS: Record<ArusKas, KategoriKas[]> = {
  masuk: ["penjualan_material", "bagi_hasil", "lainnya"],
  keluar: ["pembelian_material", "operasional", "konsumsi", "lainnya"],
};
export const LABEL_KATEGORI_KAS: Record<KategoriKas, string> = {
  penjualan_material: "Penjualan material",
  bagi_hasil: "Bagi hasil",
  pembelian_material: "Pembelian material",
  operasional: "Operasional",
  konsumsi: "Konsumsi",
  lainnya: "Lainnya",
};
export interface EntriKas {
  id: string;
  direction: ArusKas;
  category: KategoriKas;
  label: string;
  counterparty: string | null;
  amount: number;
  occurredOn: string;
  projectId: string | null;
  projectTitle: string | null;
  note: string | null;
}
export interface IsianKas {
  direction?: ArusKas;
  category?: KategoriKas;
  label?: string;
  counterparty?: string | null;
  amount?: number;
  occurredOn?: string | null;
  projectId?: string | null;
  note?: string | null;
}
export const daftarKas = (r: { dari?: string; sampai?: string } = {}) =>
  panggil<EntriKas[]>(`/admin/ledger${kueri({ dari: r.dari, sampai: r.sampai, limit: "500" })}`);
export const catatKas = (k: IsianKas) =>
  panggil<{ id: string }>("/admin/ledger", { method: "POST", body: JSON.stringify(k) });
export const ubahKas = (id: string, k: IsianKas) =>
  panggil<{ updated: boolean }>(`/admin/ledger/${id}`, { method: "PATCH", body: JSON.stringify(k) });
export const hapusKas = (id: string) => panggil<{ deleted: boolean }>(`/admin/ledger/${id}`, { method: "DELETE" });

export interface KemajuanTarget {
  semesterStart: string;
  semesterEnd: string;
  target: number | null;
  asal: "ditetapkan" | "diteruskan" | null;
  pembayaranKlien: number;
  kasLain: number;
  tercapai: number;
  kurang: number | null;
  sisaHari: number;
  perBulanDibutuhkan: number | null;
}
export interface TargetSemester {
  semesterStart: string;
  amount: number;
  note: string | null;
}
/** Tanpa argumen: semester yang sedang berjalan. */
export const kemajuanTarget = (semester?: string) =>
  panggil<KemajuanTarget>(`/admin/targets/progress${kueri({ semester })}`);
export const daftarTarget = () => panggil<TargetSemester[]>("/admin/targets");
export const simpanTarget = (t: { semesterStart: string; amount: number; note?: string | null }) =>
  panggil<{ saved: boolean }>("/admin/targets", { method: "PUT", body: JSON.stringify(t) });

/** Rentang opsional jadi query string; yang kosong tidak ikut dikirim. */
function kueri(r: Record<string, string | undefined>): string {
  const q = Object.entries(r).filter(([, v]) => v).map(
    ([k, v]) => `${k}=${encodeURIComponent(v as string)}`);
  return q.length ? `?${q.join("&")}` : "";
}

// --- Dokumen proyek (dilihat & disetujui klien lewat link token) ----------

/** 'berkas' = lampiran biasa, 'suara' = pesan suara rekaman staf. */
export type JenisDokumen = "berkas" | "suara";

/** 100 MB per berkas — angka yang sama dijaga di API dan di CHECK database. */
export const MAKS_BYTE_DOKUMEN = 104857600;

export interface DokumenProyek {
  id: string;
  projectId: string;
  title: string;
  fileUrl: string;
  kind: JenisDokumen;
  status: string;
  clientNote?: string | null;
  fileName?: string | null;
  fileSize?: number | null;
  mimeType?: string | null;
  /** Hanya terisi untuk pesan suara. */
  durationMs?: number | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface DokumenBaru {
  title: string;
  fileKey: string;
  kind?: JenisDokumen;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  durationMs?: number;
}

export const daftarDokumen = (projectId: string) =>
  panggil<DokumenProyek[]>(`/admin/projects/${projectId}/documents`);

export const tambahDokumen = (projectId: string, dokumen: DokumenBaru) =>
  panggil<{ id: string }>(`/admin/projects/${projectId}/documents`, {
    method: "POST",
    body: JSON.stringify(dokumen),
  });

export const ubahDokumen = (id: string, patch: { title?: string; status?: string; fileKey?: string }) =>
  panggil<{ updated: boolean }>(`/admin/documents/${id}`, { method: "PATCH", body: JSON.stringify(patch) });

export const hapusDokumen = (id: string) =>
  panggil<{ deleted: boolean }>(`/admin/documents/${id}`, { method: "DELETE" });

// --- Galeri proyek --------------------------------------------------------

export interface GambarProyek {
  id: string;
  /** Kunci berkas di penyimpanan — dipakai saat menjadikan gambar ini cover. */
  storageKey: string;
  url: string;
  /** URL versi kecil. Kosong pada foto yang diunggah sebelum thumbnail ada. */
  thumbUrl?: string | null;
  altText?: string | null;
  caption?: string | null;
  width?: number | null;
  height?: number | null;
  sortOrder: number;
}

/** Foto galeri dan foto material tinggal di tabel yang sama, dibedakan kind. */
export type JenisGambar = "galeri" | "material";

export const daftarGambar = (projectId: string, kind: JenisGambar = "galeri") =>
  panggil<GambarProyek[]>(`/admin/projects/${projectId}/images?kind=${kind}`);

export const tambahGambar = (
  projectId: string,
  storageKey: string,
  sortOrder: number,
  kind: JenisGambar = "galeri",
  /* Kosong kalau panel gagal membuat versi kecilnya — bukan galat: situsnya
     jatuh kembali ke foto penuh, persis seperti sebelum kolomnya ada. */
  thumbKey?: string | null,
) =>
  panggil<{ id: string }>(`/admin/projects/${projectId}/images`, {
    method: "POST",
    body: JSON.stringify({ storageKey, sortOrder, kind, thumbKey: thumbKey ?? null }),
  });

export const ubahGambar = (id: string, patch: { altText?: string | null; caption?: string | null; sortOrder?: number }) =>
  panggil<{ updated: boolean }>(`/admin/images/${id}`, { method: "PATCH", body: JSON.stringify(patch) });

export const hapusGambar = (id: string) =>
  panggil<{ deleted: boolean }>(`/admin/images/${id}`, { method: "DELETE" });

// --- Direktori (klien, kontraktor, supplier) ------------------------------

export interface KontakDirektori {
  id: string;
  name: string;
  category: string;
  company?: string | null;
  phone?: string | null;
  email?: string | null;
  note?: string | null;
  createdAt: string;
  updatedAt: string;
}

export const daftarKontak = () => panggil<KontakDirektori[]>("/admin/directory");

export const tambahKontak = (input: {
  name: string; category: string; company?: string | null; phone?: string | null; email?: string | null; note?: string | null;
}) => panggil<{ id: string }>("/admin/directory", { method: "POST", body: JSON.stringify(input) });

export const ubahKontak = (id: string, patch: Partial<KontakDirektori>) =>
  panggil<{ updated: boolean }>(`/admin/directory/${id}`, { method: "PATCH", body: JSON.stringify(patch) });

export const hapusKontak = (id: string) =>
  panggil<{ deleted: boolean }>(`/admin/directory/${id}`, { method: "DELETE" });

// --- Brief proyek (diisi klien lewat link token) --------------------------

export interface BriefProyek {
  /* budgetRange dan timeline peninggalan bentuk lama (teks bebas). Masih
     dikirim API, tapi form memakai tiga field di bawahnya. */
  budgetRange?: string | null;
  budgetAmount?: number | null;
  /** Format ISO yyyy-mm-dd, sama dengan <input type="date">. */
  startDate?: string | null;
  endDate?: string | null;
  timeline?: string | null;
  stylePreference?: string | null;
  requirements?: string | null;
  internalNotes?: string | null;
  submittedAt?: string | null;
}

export const ambilBrief = (projectId: string) => panggil<BriefProyek>(`/admin/projects/${projectId}/brief`);

export const ubahBrief = (projectId: string, patch: Partial<BriefProyek>) =>
  panggil<{ updated: boolean }>(`/admin/projects/${projectId}/brief`, { method: "PATCH", body: JSON.stringify(patch) });

// --- Komentar dokumen (thread staf + klien) -------------------------------

export interface KomentarDokumen {
  id: string;
  documentId: string;
  author: string;
  body: string;
  createdAt: string;
}

export const daftarKomentarDokumen = (documentId: string) =>
  panggil<KomentarDokumen[]>(`/admin/documents/${documentId}/comments`);

export const tambahKomentarDokumen = (documentId: string, body: string) =>
  panggil<{ id: string }>(`/admin/documents/${documentId}/comments`, { method: "POST", body: JSON.stringify({ body }) });

// --- Testimoni (dikirim klien, dimoderasi staf) ---------------------------

export interface TestimoniAdmin {
  id: string;
  projectId?: string | null;
  projectTitle?: string | null;
  clientName: string;
  quote: string;
  rating?: number | null;
  status: string;
  isFeatured: boolean;
  createdAt: string;
  updatedAt: string;
}

export const daftarTestimoni = () => panggil<TestimoniAdmin[]>("/admin/testimonials");

export const ubahTestimoni = (id: string, patch: Partial<TestimoniAdmin>) =>
  panggil<{ updated: boolean }>(`/admin/testimonials/${id}`, { method: "PATCH", body: JSON.stringify(patch) });

export const hapusTestimoni = (id: string) =>
  panggil<{ deleted: boolean }>(`/admin/testimonials/${id}`, { method: "DELETE" });

// --- Jurnal ---------------------------------------------------------------

export type KategoriJurnal = "site" | "money" | "permit" | "build";

export interface TulisanAdmin {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  body?: string | null;
  category: KategoriJurnal;
  readMinutes: number;
  /** null = masih rencana. Tanggal di masa depan = terjadwal. */
  publishedAt?: string | null;
  /** Kunci R2 sampul (folder jurnal/); null = belum bersampul. */
  coverKey?: string | null;
  coverUrl?: string | null;
  createdAt: string;
  updatedAt: string;
}

/** URL unggah sampul tulisan — folder jurnal/ di R2. */
export const mintaUrlUnggahSampul = (contentType: string) =>
  panggil<{ key: string; uploadUrl: string; expiresAt: string }>("/admin/uploads", {
    method: "POST",
    body: JSON.stringify({ scope: "jurnal", contentType }),
  });

export const daftarTulisan = () => panggil<TulisanAdmin[]>("/admin/journal");

export const ambilTulisan = (id: string) => panggil<TulisanAdmin>(`/admin/journal/${id}`);

export const buatTulisan = (isi: Partial<TulisanAdmin>) =>
  panggil<{ id: string }>("/admin/journal", { method: "POST", body: JSON.stringify(isi) });

export const ubahTulisan = (id: string, patch: Partial<TulisanAdmin>) =>
  panggil<{ updated: boolean }>(`/admin/journal/${id}`, { method: "PATCH", body: JSON.stringify(patch) });

export const hapusTulisan = (id: string) =>
  panggil<{ deleted: boolean }>(`/admin/journal/${id}`, { method: "DELETE" });

/**
 * Judul jadi slug. Dijalankan di klien supaya pemilik melihat alamatnya
 * SEBELUM menyimpan — slug ikut ke URL yang dibagikan, dan mengubahnya
 * setelah tulisan tersebar berarti mematikan setiap tautan yang sudah ada.
 */
export function slugDariJudul(judul: string): string {
  return judul
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")   // buang aksen
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120)
    .replace(/-+$/g, "");
}

// --- Logo klien -----------------------------------------------------------

export interface KlienAdmin {
  id: string;
  name: string;
  /** URL siap-pakai, dibalas server. Kosong = logonya belum diunggah. */
  logoUrl?: string | null;
  sortOrder: number;
}

/** Yang DIKIRIM saat menyimpan. logoKey null berarti "hapus logonya". */
export interface KlienPatch {
  name?: string;
  logoKey?: string | null;
  sortOrder?: number;
}

export const daftarKlien = () => panggil<KlienAdmin[]>("/admin/clients");

export const buatKlien = (isi: KlienPatch) =>
  panggil<{ id: string }>("/admin/clients", { method: "POST", body: JSON.stringify(isi) });

export const ubahKlien = (id: string, patch: KlienPatch) =>
  panggil<{ updated: boolean }>(`/admin/clients/${id}`, { method: "PATCH", body: JSON.stringify(patch) });

export const hapusKlien = (id: string) =>
  panggil<{ deleted: boolean }>(`/admin/clients/${id}`, { method: "DELETE" });

export const mintaUrlUnggahLogoKlien = (contentType: string) =>
  panggil<{ key: string; uploadUrl: string; expiresAt: string }>("/admin/uploads", {
    method: "POST",
    body: JSON.stringify({ scope: "klien", contentType }),
  });
