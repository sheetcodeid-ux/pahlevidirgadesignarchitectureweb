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
}

function baca(kunci: string): string | null {
  try { return localStorage.getItem(kunci); } catch { return null; }
}

function tulis(kunci: string, nilai: string) {
  try { localStorage.setItem(kunci, nilai); } catch { /* penyimpanan diblokir */ }
}

export function simpanSesi(d: { accessToken: string; refreshToken: string; email: string; role: string; isMasterAdmin: boolean }) {
  tulis(KUNCI_AKSES, d.accessToken);
  tulis(KUNCI_SEGAR, d.refreshToken);
  tulis(KUNCI_PROFIL, JSON.stringify({ email: d.email, role: d.role, isMasterAdmin: d.isMasterAdmin }));
}

export function hapusSesi() {
  [KUNCI_AKSES, KUNCI_SEGAR, KUNCI_PROFIL].forEach((k) => {
    try { localStorage.removeItem(k); } catch { /* abaikan */ }
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
  // Panjang daftar diingat terpisah — lihat jumlahDiingat().
  if (Array.isArray(nilai)) {
    try { localStorage.setItem(PREFIKS_JUMLAH + kunci, String(nilai.length)); } catch { /* abaikan */ }
  }
}

/* --- Jumlah baris yang diingat --------------------------------------------
 *
 * Skeleton menggambar sejumlah baris tetap, dan angka itu tebakan. Studio ini
 * punya dua proyek: menggambar enam baris lalu menyusut jadi dua membuat
 * halaman melompat persis saat isinya tiba — kebalikan dari gunanya skeleton.
 *
 * Panjang daftar terakhir disimpan di localStorage, BUKAN sessionStorage
 * seperti cache datanya. Bedanya disengaja: cache data ikut hilang saat tab
 * ditutup karena isinya data proyek dan keuangan, sementara yang ini cuma
 * satu angka — dan justru pada tab yang baru dibuka, saat cache datanya
 * kosong dan skeleton pasti tampil, angka itu paling dibutuhkan.
 */
const PREFIKS_JUMLAH = "pd-jumlah:";

export function jumlahDiingat(kunci: string, bawaan: number): number {
  try {
    const n = Number(localStorage.getItem(PREFIKS_JUMLAH + kunci));
    // Dibatasi 1..8: daftar kosong tetap butuh satu baris supaya bentuknya
    // terbaca, dan daftar panjang tidak perlu digambar seluruhnya — yang
    // terlihat sebelum digulir cuma beberapa baris pertama.
    if (Number.isFinite(n) && n > 0) return Math.min(8, Math.max(1, n));
  } catch { /* abaikan */ }
  return bawaan;
}

/**
 * Membuang cache. Tanpa argumen: semuanya (dipakai saat keluar). Dengan
 * awalan: hanya yang cocok — dipakai setelah menulis, supaya halaman lain
 * tidak menampilkan angka sebelum perubahan.
 */
export function buangCache(awalan?: string) {
  // Angka jumlah baris ikut dibuang hanya saat SELURUH cache dibuang, yaitu
  // saat keluar. Pada pembatalan biasa (setelah menulis) ia justru harus
  // bertahan — panjang daftarnya nyaris tidak berubah, dan menebak ulang
  // dari nol berarti lompatan yang barusan diperbaiki muncul lagi.
  if (!awalan) {
    try {
      const buang: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(PREFIKS_JUMLAH)) buang.push(k);
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
  tulis(KUNCI_AKSES, data.accessToken);
  tulis(KUNCI_SEGAR, data.refreshToken);
  return true;
}

/**
 * Memanggil endpoint admin dengan token.
 *
 * Kalau token ditolak, sekali dicoba disegarkan lalu permintaan diulang. Kalau
 * penyegaran juga gagal, sesi dibersihkan dan pemanggil menerima GagalAuth —
 * itu sinyal untuk mengarahkan ke halaman masuk.
 */
async function panggil<T>(path: string, init: RequestInit = {}, ulang = true): Promise<T> {
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
    if (await segarkan()) return panggil<T>(path, init, false);
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
  if (init.method && init.method !== "GET") buangCache();

  const body = await res.json();
  return body.data as T;
}

// --- Autentikasi ----------------------------------------------------------

export async function masuk(email: string, password: string) {
  const res = await fetch(`${API}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.error?.message ?? "Gagal masuk");

  simpanSesi(body.data);
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
  coverImageUrl?: string;
  isFeatured: boolean;
  seoTitle?: string;
  seoDescription?: string;
  publishedAt?: string;
  pipelineStage?: string;
  contractValue?: number | null;
}

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
}

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

export const ubahPassword = (newPassword: string) =>
  panggil<{ updated: boolean }>("/admin/account/password", {
    method: "PATCH",
    body: JSON.stringify({ newPassword }),
  });

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

export interface AnggotaTim {
  id: string;
  name: string;
  role?: string | null;
}

export const daftarTim = () => panggil<AnggotaTim[]>("/admin/team");

export const tambahAnggotaTim = (name: string, role: string | null) =>
  panggil<{ id: string }>("/admin/team", { method: "POST", body: JSON.stringify({ name, role }) });

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

export interface FinanceOverview {
  kasMasuk: number;
  piutang: number;
  marginRataRata: number | null;
  labaBersih: number;
  totalBiaya: number;
  totalKontrak: number;
  proyek: FinanceOverviewRow[];
}

/** Satu bulan di halaman Analisis Bulanan. */
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
}

export const daftarInvoice = (projectId: string) => panggil<Invoice[]>(`/admin/projects/${projectId}/invoices`);

export const tambahInvoice = (projectId: string, label: string, amount: number, dueDate: string | null) =>
  panggil<{ id: string }>(`/admin/projects/${projectId}/invoices`, {
    method: "POST",
    body: JSON.stringify({ label, amount, dueDate }),
  });

export const ubahInvoice = (id: string, patch: Partial<Invoice>) =>
  panggil<{ updated: boolean }>(`/admin/invoices/${id}`, { method: "PATCH", body: JSON.stringify(patch) });

export const hapusInvoice = (id: string) =>
  panggil<{ deleted: boolean }>(`/admin/invoices/${id}`, { method: "DELETE" });

export interface BiayaProyek {
  id: string;
  projectId: string;
  label: string;
  category: string;
  amount: number;
  /** Tanggal biaya benar-benar terjadi (YYYY-MM-DD), bukan kapan diketik. */
  incurredOn: string;
}

export const daftarBiaya = (projectId: string) => panggil<BiayaProyek[]>(`/admin/projects/${projectId}/costs`);

export const tambahBiaya = (
  projectId: string, label: string, category: string, amount: number, incurredOn?: string,
) =>
  panggil<{ id: string }>(`/admin/projects/${projectId}/costs`, {
    method: "POST",
    body: JSON.stringify({ label, category, amount, incurredOn }),
  });

export const hapusBiaya = (id: string) =>
  panggil<{ deleted: boolean }>(`/admin/costs/${id}`, { method: "DELETE" });

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
) =>
  panggil<{ id: string }>(`/admin/projects/${projectId}/images`, {
    method: "POST",
    body: JSON.stringify({ storageKey, sortOrder, kind }),
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
