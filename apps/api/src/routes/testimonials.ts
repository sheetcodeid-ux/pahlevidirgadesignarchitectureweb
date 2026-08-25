import { Hono } from "hono";
import type { Env } from "../types";
import { withDb } from "../db";
import * as testimonialsRepo from "../repository/testimonials";

export const testimonials = new Hono<{ Bindings: Env }>();

// GET /api/v1/testimonials — dibaca situs statis saat build, hanya yang disetujui staf.
testimonials.get("/testimonials", async (c) => {
  const featuredOnly = c.req.query("featured") === "true";
  const data = await withDb(c.env, c.executionCtx, (sql) => testimonialsRepo.listPublic(sql, featuredOnly));
  c.header("Cache-Control", "public, max-age=60, s-maxage=300, stale-while-revalidate=86400");
  return c.json({ data });
});
