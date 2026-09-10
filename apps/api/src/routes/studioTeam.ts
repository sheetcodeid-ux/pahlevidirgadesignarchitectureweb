import { Hono } from "hono";
import type { Env } from "../types";
import { withDb } from "../db";
import * as teamRepo from "../repository/studioTeam";

export const studioTeam = new Hono<{ Bindings: Env }>();

/**
 * GET /api/v1/team — bagian "siapa kami" di /studio, dibaca situs statis
 * saat build.
 *
 * Orang yang namanya belum diisi tetap ikut: rancangan yang di-ACC
 * menampilkan kartunya beserta peran, dengan penanda "menunggu". Menyaringnya
 * di sini akan mengubah bentuk halaman setiap kali seorang staf datang atau
 * pergi — dan itu justru yang dihindari rancangannya.
 */
studioTeam.get("/team", async (c) => {
  const assetBase = c.env.R2_PUBLIC_BASE_URL ?? "";
  const data = await withDb(c.env, c.executionCtx, (sql) => teamRepo.list(sql, assetBase));
  c.header("Cache-Control", "public, max-age=60, s-maxage=300, stale-while-revalidate=86400");
  return c.json({ data });
});
