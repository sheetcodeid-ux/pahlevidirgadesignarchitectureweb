import type { MiddlewareHandler } from "hono";
import type { Env } from "../types";
import { withDb } from "../db";
import { isStaff } from "../repository/profile";

/**
 * Menolak user yang tokennya sah tapi bukan staf studio.
 *
 * Harus dipasang SETELAH requireSupabaseAuth. Token Supabase yang valid
 * hanya membuktikan "orang ini punya akun di project ini" — dan itu belum
 * tentu berarti berhak mengelola konten. Backend terhubung ke Postgres
 * dengan kredensial yang melewati RLS, jadi policy is_staff() di database
 * TIDAK melindungi endpoint admin — pengecekan ini wajib diulang di sini.
 */
export function requireStaff(): MiddlewareHandler<{ Bindings: Env; Variables: { userID: string } }> {
  return async (c, next) => {
    const userID = c.get("userID");
    if (!userID) {
      return c.json({ error: { status: 401, message: "token tidak ada" } }, 401);
    }

    const staf = await withDb(c.env, c.executionCtx, (sql) => isStaff(sql, userID));
    if (!staf) {
      return c.json({ error: { status: 403, message: "akun ini tidak berhak mengelola konten" } }, 403);
    }

    await next();
  };
}
