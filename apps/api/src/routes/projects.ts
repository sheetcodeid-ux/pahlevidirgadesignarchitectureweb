import { Hono } from "hono";
import type { Env } from "../types";
import { withDb } from "../db";
import * as projectsRepo from "../repository/projects";
import { NotFoundError } from "../repository/projects";
import { VALID_CATEGORIES } from "../types";

const DEFAULT_PAGE_SIZE = 12;
const MAX_PAGE_SIZE = 48;

export const projects = new Hono<{ Bindings: Env }>();

// GET /api/v1/projects
projects.get("/projects", async (c) => {
  const category = c.req.query("category") ?? "";
  if (category !== "" && !VALID_CATEGORIES.has(category)) {
    return c.json({ error: { status: 400, message: "kategori tidak dikenal" } }, 400);
  }

  let limit = Number.parseInt(c.req.query("limit") ?? "", 10);
  if (!Number.isFinite(limit) || limit < 1) limit = DEFAULT_PAGE_SIZE;
  if (limit > MAX_PAGE_SIZE) limit = MAX_PAGE_SIZE;

  let offset = Number.parseInt(c.req.query("offset") ?? "", 10);
  if (!Number.isFinite(offset) || offset < 0) offset = 0;

  const featured = c.req.query("featured") === "true";
  const assetBase = c.env.R2_PUBLIC_BASE_URL ?? "";

  const list = await withDb(c.env, c.executionCtx, (sql) =>
    projectsRepo.list(sql, assetBase, { category, featured, limit, offset }),
  );

  // Konten portfolio jarang berubah; biarkan Cloudflare menyimpannya di edge.
  c.header("Cache-Control", "public, max-age=60, s-maxage=300, stale-while-revalidate=86400");
  return c.json({ data: list, meta: { limit, offset, count: list.length } });
});

// GET /api/v1/projects/:slug
projects.get("/projects/:slug", async (c) => {
  const assetBase = c.env.R2_PUBLIC_BASE_URL ?? "";
  try {
    const project = await withDb(c.env, c.executionCtx, (sql) =>
      projectsRepo.getBySlug(sql, assetBase, c.req.param("slug")),
    );
    c.header("Cache-Control", "public, max-age=60, s-maxage=300, stale-while-revalidate=86400");
    return c.json({ data: project });
  } catch (err) {
    if (err instanceof NotFoundError) {
      return c.json({ error: { status: 404, message: "proyek tidak ditemukan" } }, 404);
    }
    throw err;
  }
});
