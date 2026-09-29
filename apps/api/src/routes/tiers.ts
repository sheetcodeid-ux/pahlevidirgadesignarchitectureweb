import { Hono } from "hono";
import type { Env } from "../types";
import { withDb } from "../db";
import * as tiersRepo from "../repository/tiers";

export const tiers = new Hono<{ Bindings: Env }>();

/**
 * GET /api/v1/tiers — seksi tarif beranda dan jawaban harga di /faq, dibaca
 * situs statis saat build. Hanya paket AKTIF; yang dihentikan cuma untuk
 * arsip panel.
 */
tiers.get("/tiers", async (c) => {
  const data = await withDb(c.env, c.executionCtx, (sql) => tiersRepo.list(sql, false));
  c.header("Cache-Control", "public, max-age=60, s-maxage=300, stale-while-revalidate=86400");
  return c.json({ data });
});
