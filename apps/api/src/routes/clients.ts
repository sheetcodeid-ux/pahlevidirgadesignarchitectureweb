import { Hono } from "hono";
import type { Env } from "../types";
import { withDb } from "../db";
import * as clientLogosRepo from "../repository/clientLogos";

export const clients = new Hono<{ Bindings: Env }>();

/**
 * GET /api/v1/clients — marquee "SELECTED CLIENTS" di beranda, dibaca situs
 * statis saat build.
 *
 * Seluruh barisnya memang untuk publik; yang logonya belum diunggah tetap
 * ikut, dan halaman menampilkan namanya sebagai teks. Menyaringnya di sini
 * akan membuat klien yang baru didaftarkan hilang dari beranda sampai
 * pemilik sempat mengunggah gambarnya.
 */
clients.get("/clients", async (c) => {
  const assetBase = c.env.R2_PUBLIC_BASE_URL ?? "";
  const data = await withDb(c.env, c.executionCtx, (sql) => clientLogosRepo.list(sql, assetBase));
  c.header("Cache-Control", "public, max-age=60, s-maxage=300, stale-while-revalidate=86400");
  return c.json({ data });
});
