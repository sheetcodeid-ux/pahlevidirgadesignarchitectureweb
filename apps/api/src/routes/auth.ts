import { Hono } from "hono";
import type { Env } from "../types";
import { withDb } from "../db";
import { role } from "../repository/profile";

export const auth = new Hono<{ Bindings: Env }>();

interface SupabaseToken {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user: { id: string; email: string };
}

async function exchangeToken(env: Env, grant: string, body: Record<string, string>): Promise<SupabaseToken> {
  const url = `${(env.SUPABASE_URL ?? "").replace(/\/$/, "")}/auth/v1/token?grant_type=${grant}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: env.SUPABASE_ANON_KEY ?? "" },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(`supabase menolak: status ${res.status}`);

  const tok = (await res.json()) as SupabaseToken;
  if (!tok.access_token) throw new Error("supabase tidak mengembalikan token");
  return tok;
}

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

  let tok: SupabaseToken;
  try {
    tok = await exchangeToken(c.env, "password", { email, password });
  } catch {
    // Pesan tunggal untuk email tidak dikenal maupun kata sandi salah —
    // membedakannya memberi tahu penyerang alamat mana yang terdaftar.
    return c.json({ error: { status: 401, message: "email atau kata sandi salah" } }, 401);
  }

  // Punya akun belum berarti berhak masuk panel.
  const peran = await withDb(c.env, c.executionCtx, (sql) => role(sql, tok.user.id));
  if (!peran) {
    return c.json({ error: { status: 403, message: "akun ini tidak berhak mengelola konten" } }, 403);
  }

  return c.json({
    data: {
      accessToken: tok.access_token,
      refreshToken: tok.refresh_token,
      expiresIn: tok.expires_in,
      email: tok.user.email,
      role: peran,
      isMasterAdmin: peran === "admin",
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

  let tok: SupabaseToken;
  try {
    tok = await exchangeToken(c.env, "refresh_token", { refresh_token: refreshToken });
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
