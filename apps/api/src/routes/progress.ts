import { Hono } from "hono";
import type { Env } from "../types";
import { withDb } from "../db";
import * as progressRepo from "../repository/progress";

export const progress = new Hono<{ Bindings: Env }>();

/**
 * GET /api/v1/progress/:token — dilihat klien lewat link, tanpa login.
 *
 * Tokennya 40 karakter hex acak (160-bit) yang dibagikan staf lewat WA/email,
 * bukan sesuatu yang bisa ditebak lewat enumerasi wajar — itu sebabnya cukup
 * jadi satu-satunya "kredensial" tanpa perlu sistem akun klien terpisah.
 * Tabel di baliknya sengaja tertutup total dari anon lewat RLS+GRANT; jalur
 * baca publik satu-satunya ya endpoint ini.
 */
progress.get("/progress/:token", async (c) => {
  const token = c.req.param("token");
  if (!/^[0-9a-f]{40}$/.test(token)) {
    return c.json({ error: { status: 404, message: "link tidak ditemukan" } }, 404);
  }

  const assetBase = c.env.R2_PUBLIC_BASE_URL ?? "";
  const data = await withDb(c.env, c.executionCtx, (sql) => progressRepo.getByToken(sql, assetBase, token));

  if (!data) {
    return c.json({ error: { status: 404, message: "link tidak ditemukan" } }, 404);
  }

  return c.json({ data });
});

/**
 * POST /api/v1/progress/:token/documents/:documentId/approve
 * POST /api/v1/progress/:token/documents/:documentId/revise
 *
 * Satu-satunya tulis yang klien bisa lakukan lewat portal token — menyetujui
 * atau meminta revisi dokumen yang sedang menunggu mereka. Kepemilikan
 * dokumen atas token dicek di repository, langsung di klausa WHERE.
 */
progress.post("/progress/:token/documents/:documentId/approve", async (c) => {
  const token = c.req.param("token");
  if (!/^[0-9a-f]{40}$/.test(token)) {
    return c.json({ error: { status: 404, message: "link tidak ditemukan" } }, 404);
  }

  try {
    await withDb(c.env, c.executionCtx, (sql) =>
      progressRepo.approveDocument(sql, token, c.req.param("documentId")),
    );
    return c.json({ data: { updated: true } });
  } catch (err) {
    if (err instanceof progressRepo.DocumentActionError) {
      return c.json({ error: { status: 422, message: err.message } }, 422);
    }
    throw err;
  }
});

progress.post("/progress/:token/documents/:documentId/revise", async (c) => {
  const token = c.req.param("token");
  if (!/^[0-9a-f]{40}$/.test(token)) {
    return c.json({ error: { status: 404, message: "link tidak ditemukan" } }, 404);
  }

  type Body = { note?: string };
  const body = await c.req.json<Body>().catch((): Body => ({}));
  const note = (body.note ?? "").trim();
  if (note.length < 2 || note.length > 2000) {
    return c.json({ error: { status: 422, message: "catatan revisi harus 2-2000 karakter" } }, 422);
  }

  try {
    await withDb(c.env, c.executionCtx, (sql) =>
      progressRepo.requestDocumentRevision(sql, token, c.req.param("documentId"), note),
    );
    return c.json({ data: { updated: true } });
  } catch (err) {
    if (err instanceof progressRepo.DocumentActionError) {
      return c.json({ error: { status: 422, message: err.message } }, 422);
    }
    throw err;
  }
});
