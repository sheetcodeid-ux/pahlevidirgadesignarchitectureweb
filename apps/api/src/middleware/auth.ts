import { jwtVerify } from "jose";
import type { MiddlewareHandler } from "hono";
import type { Env } from "../types";

/**
 * Memverifikasi access token yang diterbitkan Supabase Auth.
 *
 * Ini mengasumsikan project memakai JWT secret simetris (HS256) — default
 * Supabase. Kalau nanti signing key diganti asimetris (ES256/RS256),
 * verifikasi harus diganti ke pengambilan JWKS dari
 * {SUPABASE_URL}/auth/v1/.well-known/jwks.json.
 */
export function requireSupabaseAuth(): MiddlewareHandler<{ Bindings: Env; Variables: { userID: string; userEmail?: string } }> {
  return async (c, next) => {
    const raw = c.req.header("Authorization")?.trim() ?? "";
    if (!raw.toLowerCase().startsWith("bearer ")) {
      return c.json({ error: { status: 401, message: "token tidak ada" } }, 401);
    }

    const token = raw.slice("bearer ".length).trim();
    const secret = new TextEncoder().encode(c.env.SUPABASE_JWT_SECRET);

    try {
      const { payload } = await jwtVerify(token, secret, {
        algorithms: ["HS256"],
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
