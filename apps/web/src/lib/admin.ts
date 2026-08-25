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
}

export function profilTersimpan(): Profil | null {
  const raw = baca(KUNCI_PROFIL);
  if (!raw) return null;
  try { return JSON.parse(raw) as Profil; } catch { return null; }
}

export class GagalAuth extends Error {}

async function segarkan(): Promise<boolean> {
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

// --- Info studio ------------------------------------------------------

export interface StudioSettings {
  studioName: string;
  tagline?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  instagramUrl?: string | null;
}

export const ambilSettings = () => panggil<StudioSettings>("/admin/settings");

export const simpanSettings = (patch: Partial<StudioSettings>) =>
  panggil<{ updated: boolean }>("/admin/settings", { method: "PATCH", body: JSON.stringify(patch) });

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
  marginPct: number | null;
}

export interface FinanceOverview {
  kasMasuk: number;
  piutang: number;
  marginRataRata: number | null;
  proyek: FinanceOverviewRow[];
}

export const ambilRingkasanKeuangan = () => panggil<FinanceOverview>("/admin/finance/overview");

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
}

export const daftarBiaya = (projectId: string) => panggil<BiayaProyek[]>(`/admin/projects/${projectId}/costs`);

export const tambahBiaya = (projectId: string, label: string, category: string, amount: number) =>
  panggil<{ id: string }>(`/admin/projects/${projectId}/costs`, {
    method: "POST",
    body: JSON.stringify({ label, category, amount }),
  });

export const hapusBiaya = (id: string) =>
  panggil<{ deleted: boolean }>(`/admin/costs/${id}`, { method: "DELETE" });

// --- Dokumen proyek (dilihat & disetujui klien lewat link token) ----------

export interface DokumenProyek {
  id: string;
  projectId: string;
  title: string;
  fileUrl: string;
  status: string;
  clientNote?: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export const daftarDokumen = (projectId: string) =>
  panggil<DokumenProyek[]>(`/admin/projects/${projectId}/documents`);

export const tambahDokumen = (projectId: string, title: string, fileKey: string) =>
  panggil<{ id: string }>(`/admin/projects/${projectId}/documents`, {
    method: "POST",
    body: JSON.stringify({ title, fileKey }),
  });

export const ubahDokumen = (id: string, patch: { title?: string; status?: string; fileKey?: string }) =>
  panggil<{ updated: boolean }>(`/admin/documents/${id}`, { method: "PATCH", body: JSON.stringify(patch) });

export const hapusDokumen = (id: string) =>
  panggil<{ deleted: boolean }>(`/admin/documents/${id}`, { method: "DELETE" });
