import { Hono } from "hono";
import type { Env } from "../types";
import { withDb } from "../db";
import { urlFoto } from "../repository/akun";
import { catatAudit, muatAkses } from "../repository/akses";
import { hitungAkses } from "../lib/fitur";
import { hashIP } from "../lib/ipHash";
import { tukarToken, type TokenSupabase } from "../lib/gotrue";

export const auth = new Hono<{ Bindings: Env }>();

function authConfigured(env: Env): boolean {
  return Boolean(env.SUPABASE_URL && env.SUPABASE_ANON_KEY);
}

// POST /api/v1/auth/login
//
// Permintaannya diteruskan dari sini, bukan dari browser, karena invarian
// proyek ini: frontend tidak pernah bicara langsung ke Supabase. Anon key
// tidak pernah ikut terkirim ke halaman.
auth.post("/auth/login", async (c) => {
  if (!authConfigured(c.env)) {
    return c.json({ error: { status: 503, message: "autentikasi belum dikonfigurasi" } }, 503);
  }

  const body = await c.req.json<{ email?: string; password?: string }>().catch(() => null);
  const email = body?.email?.trim() ?? "";
  const password = body?.password ?? "";
  if (!email || !password) {
    return c.json({ error: { status: 422, message: "email dan kata sandi wajib diisi" } }, 422);
  }

  const ua = c.req.header("User-Agent") ?? null;
  const ipHash = await hashIP(c.req.header("CF-Connecting-IP") ?? "", c.env.IP_HASH_SALT);
  /* Setiap upaya masuk masuk buku log audit — yang gagal juga, dengan email
     yang DICOBA. Pencatatan tidak boleh menggagalkan masuknya. */
  const catat = (action: "masuk" | "gagal_masuk", status: number, actorId: string | null, role: string | null, alasan?: string) =>
    withDb(c.env, c.executionCtx, (sql) =>
      catatAudit(sql, {
        actorId, actorEmail: email.toLowerCase(), actorRole: role, action, method: "POST", path: "/auth/login",
        status, detail: alasan ? { alasan } : null, ipHash, userAgent: ua,
      })).catch((e) => console.error("audit masuk gagal dicatat", (e as Error).message));

  let tok: TokenSupabase;
  try {
    tok = await tukarToken(c.env, "password", { email, password }, c.req.header("User-Agent"));
  } catch {
    await catat("gagal_masuk", 401, null, null, "kredensial salah");
    // Pesan tunggal untuk email tidak dikenal maupun kata sandi salah —
    // membedakannya memberi tahu penyerang alamat mana yang terdaftar.
    return c.json({ error: { status: 401, message: "email atau kata sandi salah" } }, 401);
  }

  // Punya akun belum berarti berhak masuk panel.
  const p = await withDb(c.env, c.executionCtx, (sql) => muatAkses(sql, tok.user.id));
  const peran = p?.role ?? "";
  if (!p || !peran) {
    await catat("gagal_masuk", 403, tok.user.id, null, "bukan pengguna panel");
    return c.json({ error: { status: 403, message: "akun ini tidak berhak mengelola konten" } }, 403);
  }
  if (p.isSuspended) {
    await catat("gagal_masuk", 403, tok.user.id, peran, "akun dinonaktifkan");
    return c.json({ error: { status: 403, message: "akun ini dinonaktifkan — hubungi pemilik aplikasi" } }, 403);
  }
  if (peran === "pelanggan" && c.env.PELANGGAN_DIIZINKAN !== "1") {
    await catat("gagal_masuk", 403, tok.user.id, peran, "pelanggan belum diizinkan");
    return c.json({ error: { status: 403, message: "akun pelanggan belum bisa masuk — pemisahan data per studio belum selesai" } }, 403);
  }
  const akses = hitungAkses(p);
  await catat("masuk", 200, tok.user.id, peran);

  return c.json({
    data: {
      accessToken: tok.access_token,
      refreshToken: tok.refresh_token,
      expiresIn: tok.expires_in,
      email: tok.user.email,
      role: peran,
      isMasterAdmin: peran === "admin",
      nama: p.nama,
      avatarUrl: urlFoto(c.env.R2_PUBLIC_BASE_URL ?? "", p.avatarKey),
      fitur: akses.fitur,
      langganan: { status: akses.status, planId: p.planId, planName: p.planName, accessUntil: p.accessUntil },
    },
  });
});

// POST /api/v1/auth/refresh
auth.post("/auth/refresh", async (c) => {
  if (!authConfigured(c.env)) {
    return c.json({ error: { status: 503, message: "autentikasi belum dikonfigurasi" } }, 503);
  }

  const body = await c.req.json<{ refreshToken?: string }>().catch(() => null);
  const refreshToken = body?.refreshToken ?? "";
  if (!refreshToken) {
    return c.json({ error: { status: 400, message: "refresh token tidak ada" } }, 400);
  }

  let tok: TokenSupabase;
  try {
    tok = await tukarToken(c.env, "refresh_token", { refresh_token: refreshToken });
  } catch {
    return c.json({ error: { status: 401, message: "sesi sudah berakhir, masuk kembali" } }, 401);
  }

  return c.json({
    data: {
      accessToken: tok.access_token,
      refreshToken: tok.refresh_token,
      expiresIn: tok.expires_in,
    },
  });
});
