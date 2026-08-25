import { createRemoteJWKSet, jwtVerify } from "jose";
import type { MiddlewareHandler } from "hono";
import type { Env } from "../types";

/**
 * Memverifikasi access token yang diterbitkan Supabase Auth.
 *
 * Supabase menandatangani token lewat JWT Signing Keys (ES256, kunci publik
 * via JWKS) — bukan lagi JWT secret simetris (HS256) yang dulu jadi default.
 * Legacy HS256 secret cuma tersisa untuk memverifikasi token lama yang belum
 * expired, jadi verifikasi di sini pakai JWKS supaya otomatis ikut kunci
 * mana pun yang sedang aktif di Supabase.
 *
 * JWKSet di-cache per-URL di scope modul supaya tidak fetch ulang tiap
 * request dalam isolate yang sama.
 */
const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function getJWKS(supabaseUrl: string) {
  let jwks = jwksCache.get(supabaseUrl);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(`${supabaseUrl.replace(/\/$/, "")}/auth/v1/.well-known/jwks.json`));
    jwksCache.set(supabaseUrl, jwks);
  }
  return jwks;
}

export function requireSupabaseAuth(): MiddlewareHandler<{ Bindings: Env; Variables: { userID: string; userEmail?: string } }> {
  return async (c, next) => {
    const raw = c.req.header("Authorization")?.trim() ?? "";
    if (!raw.toLowerCase().startsWith("bearer ")) {
      return c.json({ error: { status: 401, message: "token tidak ada" } }, 401);
    }

    const token = raw.slice("bearer ".length).trim();

    try {
      const jwks = getJWKS(c.env.SUPABASE_URL ?? "");
      const { payload } = await jwtVerify(token, jwks, {
        audience: "authenticated",
        requiredClaims: ["exp"],
      });

      const sub = payload.sub;
      if (!sub) throw new Error("token tanpa subject");

      c.set("userID", sub);
      if (typeof payload.email === "string") c.set("userEmail", payload.email);
    } catch {
      return c.json({ error: { status: 401, message: "token tidak valid" } }, 401);
    }

    await next();
  };
}
