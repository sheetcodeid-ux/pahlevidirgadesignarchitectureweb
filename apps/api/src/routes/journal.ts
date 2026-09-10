import { Hono } from "hono";
import type { Env } from "../types";
import { withDb } from "../db";
import * as journalRepo from "../repository/journal";

export const journal = new Hono<{ Bindings: Env }>();

/**
 * GET /api/v1/journal — indeks tulisan, dibaca situs statis saat build.
 *
 * Yang berencana IKUT terkirim, tanpa isinya: rancangan yang di-ACC memang
 * menampilkan tulisan yang belum ditulis sebagai "RENCANA" bertanda tegas,
 * supaya indeksnya jujur alih-alih diisi judul palsu yang tidak bisa dibuka.
 * Yang tidak ikut cuma body-nya — draf tidak perlu sampai ke halaman publik.
 */
journal.get("/journal", async (c) => {
  const data = await withDb(c.env, c.executionCtx, (sql) => journalRepo.listForIndex(sql));
  c.header("Cache-Control", "public, max-age=60, s-maxage=300, stale-while-revalidate=86400");
  return c.json({ data });
});

/** GET /api/v1/journal/:slug — satu tulisan yang sudah terbit. */
journal.get("/journal/:slug", async (c) => {
  const slug = c.req.param("slug");
  // Bentuk slug diperiksa sebelum menyentuh database, alasan yang sama seperti
  // /receipt/:token: setiap karakter sampah yang orang tempel jadi satu query,
  // dan kuota koneksi Hyperdrive tidak layak dihabiskan untuk itu.
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) || slug.length > 120) {
    return c.json({ error: { status: 404, message: "tulisan tidak ditemukan" } }, 404);
  }

  const data = await withDb(c.env, c.executionCtx, (sql) => journalRepo.getPublishedBySlug(sql, slug));
  if (!data) return c.json({ error: { status: 404, message: "tulisan tidak ditemukan" } }, 404);

  c.header("Cache-Control", "public, max-age=60, s-maxage=300, stale-while-revalidate=86400");
  return c.json({ data });
});
