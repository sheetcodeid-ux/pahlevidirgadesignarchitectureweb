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
