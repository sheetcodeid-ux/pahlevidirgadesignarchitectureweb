import type { Env } from "../types";

/* =============================================================================
   Pembicaraan dengan Supabase Auth (GoTrue) — satu tempat.

   Dulu `exchangeToken` hidup di routes/auth.ts dan rute ganti kata sandi
   menulis fetch-nya sendiri. Halaman Akun menambah tiga lagi (verifikasi
   kata sandi lama, keluar, keluarkan perangkat lain), dan lima salinan
   header `apikey` + `Authorization` pasti menyimpang.

   Seluruhnya memakai ANON key + token milik pemanggil sendiri, bukan
   service_role: GoTrue yang memverifikasi sesi itu sah, kita tidak perlu
   menduplikasi logika itu.
   ============================================================================= */

export interface TokenSupabase {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user: { id: string; email: string };
}

function alamat(env: Env, jalur: string): string {
  return `${(env.SUPABASE_URL ?? "").replace(/\/$/, "")}/auth/v1${jalur}`;
}

/**
 * Menukar kredensial jadi token (grant `password` atau `refresh_token`).
 *
 * `userAgent` diteruskan dari peramban pemakai. Tanpanya GoTrue mencatat
 * agen milik Worker ("quic-go HTTP/3") di `auth.sessions`, jadi daftar sesi
 * di halaman Akun tidak bisa menyebut perangkat mana pun — terukur: 88 sesi
 * di produksi, semuanya tanpa nama perangkat.
 */
export async function tukarToken(
  env: Env,
  grant: "password" | "refresh_token",
  body: Record<string, string>,
  userAgent?: string,
): Promise<TokenSupabase> {
  const res = await fetch(alamat(env, `/token?grant_type=${grant}`), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: env.SUPABASE_ANON_KEY ?? "",
      ...(userAgent ? { "User-Agent": userAgent.slice(0, 400) } : {}),
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(`supabase menolak: status ${res.status}`);

  const tok = (await res.json()) as TokenSupabase;
  if (!tok.access_token) throw new Error("supabase tidak mengembalikan token");
  return tok;
}

/**
 * Mencabut sesi lewat GoTrue.
 *
 * - `local`  — sesi token ini saja (tombol Keluar). Dulu keluar cuma
 *              menghapus token di peramban, jadi refresh token-nya tetap
 *              hidup di Supabase selamanya.
 * - `others` — semua sesi akun ini KECUALI yang sedang dipakai.
 *
 * Token akses yang sudah terbit tetap sah sampai kedaluwarsa (≈1 jam): API
 * ini memverifikasinya lewat JWKS tanpa bertanya ke GoTrue. Yang langsung
 * mati refresh token-nya, jadi perangkat lain keluar paling lambat saat
 * token aksesnya habis.
 */
export async function cabutSesi(env: Env, accessToken: string, scope: "local" | "others"): Promise<boolean> {
  const res = await fetch(alamat(env, `/logout?scope=${scope}`), {
    method: "POST",
    headers: { apikey: env.SUPABASE_ANON_KEY ?? "", Authorization: `Bearer ${accessToken}` },
  });
  // 404 = sesinya memang sudah tidak ada; tujuan "keluar" sudah tercapai.
  return res.ok || res.status === 404;
}

/** Mengganti kata sandi pemilik token. Mengembalikan null kalau berhasil,
 *  atau kalimat galat yang bisa dibaca staf. */
export async function gantiSandi(env: Env, accessToken: string, sandi: string): Promise<string | null> {
  const res = await fetch(alamat(env, "/user"), {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      apikey: env.SUPABASE_ANON_KEY ?? "",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ password: sandi }),
  });
  if (res.ok) return null;
  return pesanGalatSandi(await res.json().catch(() => null));
}

/**
 * Galat GoTrue → kalimat staf.
 *
 * Dulu setiap penolakan jadi "gagal mengubah kata sandi" — termasuk yang
 * penyebabnya jelas dan bisa diperbaiki sendiri (kata sandinya sama dengan
 * yang lama). GoTrue menyebut sebabnya di `error_code`.
 */
export function pesanGalatSandi(body: unknown): string {
  const b = (body ?? {}) as { error_code?: string; weak_password?: { reasons?: string[] } };
  switch (b.error_code) {
    case "same_password":
      return "kata sandi baru sama dengan yang sekarang";
    case "weak_password": {
      const alasan = b.weak_password?.reasons ?? [];
      if (alasan.includes("pwned")) return "kata sandi ini pernah bocor di internet, pilih yang lain";
      if (alasan.includes("length")) return "kata sandi kurang panjang";
      return "kata sandi harus memuat huruf besar, huruf kecil, angka, dan simbol";
    }
    case "reauthentication_needed":
    case "reauthentication_not_valid":
      return "sesi ini terlalu lama, keluar lalu masuk lagi sebelum mengganti kata sandi";
    default:
      return "gagal mengubah kata sandi";
  }
}

/**
 * Aturan kata sandi proyek ini — cermin setelan Supabase (lihat CLAUDE.md:
 * minimal 12, huruf besar, kecil, angka, simbol). Diperiksa di sini juga
 * supaya penolakannya menyebut aturan mana yang dilanggar; dulu batas di
 * rute ini 8, jadi sandi 8–11 karakter lolos ke GoTrue lalu ditolak dengan
 * kalimat yang tidak menyebut apa-apa.
 */
export function periksaSandi(s: string): string | null {
  const kurang: string[] = [];
  if (s.length < 12) kurang.push("minimal 12 karakter");
  if (!/[A-Z]/.test(s)) kurang.push("huruf besar");
  if (!/[a-z]/.test(s)) kurang.push("huruf kecil");
  if (!/\d/.test(s)) kurang.push("angka");
  if (!/[^A-Za-z0-9]/.test(s)) kurang.push("simbol");
  if (s.length > 72) return "kata sandi maksimal 72 karakter";
  return kurang.length ? `kata sandi belum memenuhi: ${kurang.join(", ")}` : null;
}

/* --- Admin GoTrue (service_role) ------------------------------------------------
   HANYA untuk halaman Pengguna & Akses milik owner: membuat akun dan
   menyetel ulang kata sandinya. service_role hidup di Worker saja (invarian
   #2) dan tidak pernah keluar dari fungsi-fungsi ini. */

function kepalaAdmin(env: Env): Record<string, string> {
  const kunci = env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  return { "Content-Type": "application/json", apikey: kunci, Authorization: `Bearer ${kunci}` };
}

export class GalatAkun extends Error {
  constructor(public readonly status: number, pesan: string) {
    super(pesan);
  }
}

/** Membuat akun yang langsung terkonfirmasi. Mengembalikan id-nya. */
export async function buatAkun(env: Env, email: string, sandi: string): Promise<string> {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) throw new GalatAkun(503, "pembuatan akun belum dikonfigurasi");
  const res = await fetch(alamat(env, "/admin/users"), {
    method: "POST",
    headers: kepalaAdmin(env),
    body: JSON.stringify({ email, password: sandi, email_confirm: true }),
  });
  const body = (await res.json().catch(() => null)) as { id?: string; error_code?: string; msg?: string } | null;
  if (res.ok && body?.id) return body.id;
  if (body?.error_code === "email_exists" || res.status === 422) throw new GalatAkun(409, "email ini sudah terdaftar");
  if (body?.error_code === "weak_password") throw new GalatAkun(422, pesanGalatSandi(body));
  throw new GalatAkun(502, "Supabase menolak membuat akun");
}

/** Menyetel kata sandi akun lain (owner menyetel ulang untuk pengguna yang lupa). */
export async function setelSandiAkun(env: Env, id: string, sandi: string): Promise<void> {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) throw new GalatAkun(503, "penyetelan sandi belum dikonfigurasi");
  const res = await fetch(alamat(env, `/admin/users/${encodeURIComponent(id)}`), {
    method: "PUT",
    headers: kepalaAdmin(env),
    body: JSON.stringify({ password: sandi }),
  });
  if (!res.ok) throw new GalatAkun(502, pesanGalatSandi(await res.json().catch(() => null)));
}

/** Kata sandi sementara yang memenuhi aturan proyek (12+ dengan keempat jenis). */
export function sandiSementara(): string {
  const set = ["ABCDEFGHJKLMNPQRSTUVWXYZ", "abcdefghijkmnopqrstuvwxyz", "23456789", "!@#$%*?-"];
  const acak = (n: number) => crypto.getRandomValues(new Uint32Array(1))[0]! % n;
  const huruf = set.map((s) => s[acak(s.length)]!);
  const semua = set.join("");
  while (huruf.length < 16) huruf.push(semua[acak(semua.length)]!);
  for (let i = huruf.length - 1; i > 0; i--) {
    const j = acak(i + 1);
    [huruf[i], huruf[j]] = [huruf[j]!, huruf[i]!];
  }
  return huruf.join("");
}
