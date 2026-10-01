/**
 * Akses token sesi admin.
 *
 * Token diterbitkan Supabase Auth saat login dan disimpan di localStorage.
 * Semua panggilan ke endpoint admin membawanya sebagai Bearer token; backend
 * Go yang memverifikasi tanda tangannya. Frontend tidak pernah memegang
 * service_role key.
 */

const KUNCI = "pd-access-token";

function ambilToken(): string | null {
  try {
    return localStorage.getItem(KUNCI);
  } catch {
    return null;
  }
}

export interface SesiAdmin {
  id: string;
  email?: string;
  role: string;
  isMasterAdmin: boolean;
}

const API = (import.meta.env.PUBLIC_API_BASE_URL ?? "http://localhost:8787").replace(/\/$/, "");

/**
 * Menanyakan identitas pemilik token ke backend.
 *
 * Mengembalikan null kalau tidak ada token atau tokennya ditolak — pemanggil
 * memperlakukan keduanya sama: belum login.
 */
export async function ambilSesi(): Promise<SesiAdmin | null> {
  const token = ambilToken();
  if (!token) return null;

  try {
    const res = await fetch(`${API}/api/v1/admin/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const body = await res.json();
    return body.data as SesiAdmin;
  } catch {
    return null;
  }
}
