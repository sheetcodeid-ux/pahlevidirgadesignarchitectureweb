import { Hono } from "hono";
import type { Env } from "../types";
import { withDb } from "../db";
import * as settingsRepo from "../repository/settings";

export const settings = new Hono<{ Bindings: Env }>();

// GET /api/v1/settings — dibaca situs statis saat build untuk footer/kontak.
settings.get("/settings", async (c) => {
  const assetBase = c.env.R2_PUBLIC_BASE_URL ?? "";
  const data = await withDb(c.env, c.executionCtx, (sql) => settingsRepo.get(sql, assetBase));
  c.header("Cache-Control", "public, max-age=60, s-maxage=300, stale-while-revalidate=86400");
  return c.json({ data });
});
