import postgres, { type Sql } from "postgres";
import type { ExecutionContext } from "hono";
import type { Env } from "./types";

/**
 * Menjalankan satu unit kerja dengan koneksi Postgres lewat Hyperdrive.
 *
 * Worker tidak menyimpan state antar-request seperti pgxpool.Pool di versi
 * Go, jadi klien dibuat per-request. Penutupannya dijadwalkan lewat
 * `ctx.waitUntil` supaya tidak menunda respons ke klien — pola yang
 * didokumentasikan Cloudflare sendiri untuk postgres.js + Hyperdrive.
 */
export async function withDb<T>(
  env: Env,
  ctx: ExecutionContext,
  fn: (sql: Sql) => Promise<T>,
): Promise<T> {
  const sql = postgres(env.DB.connectionString, {
    max: 5,
    fetch_types: false,
    prepare: false,
  });

  try {
    return await fn(sql);
  } finally {
    ctx.waitUntil(sql.end());
  }
}
