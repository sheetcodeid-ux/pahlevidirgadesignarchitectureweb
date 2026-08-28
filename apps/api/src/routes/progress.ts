import { Hono } from "hono";
import type { ClientBriefInput, Env } from "../types";
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

// POST /api/v1/progress/:token/documents/:documentId/comments — klien menambah
// balasan di thread dokumen, di luar alur setujui/revisi yang sudah ada.
progress.post("/progress/:token/documents/:documentId/comments", async (c) => {
  const token = c.req.param("token");
  if (!/^[0-9a-f]{40}$/.test(token)) {
    return c.json({ error: { status: 404, message: "link tidak ditemukan" } }, 404);
  }

  type Body = { body?: string };
  const body = await c.req.json<Body>().catch((): Body => ({}));
  const isi = (body.body ?? "").trim();
  if (isi.length < 1 || isi.length > 2000) {
    return c.json({ error: { status: 422, message: "komentar harus 1-2000 karakter" } }, 422);
  }

  try {
    const id = await withDb(c.env, c.executionCtx, (sql) =>
      progressRepo.addDocumentComment(sql, token, c.req.param("documentId"), isi),
    );
    return c.json({ data: { id } }, 201);
  } catch (err) {
    if (err instanceof progressRepo.DocumentActionError) {
      return c.json({ error: { status: 422, message: err.message } }, 422);
    }
    throw err;
  }
});

// POST /api/v1/progress/:token/brief — klien mengisi atau memperbarui briefnya sendiri.
progress.post("/progress/:token/brief", async (c) => {
  const token = c.req.param("token");
  if (!/^[0-9a-f]{40}$/.test(token)) {
    return c.json({ error: { status: 404, message: "link tidak ditemukan" } }, 404);
  }

  const body = await c.req.json<ClientBriefInput>().catch((): ClientBriefInput => ({}));

  // Validasi yang sama dengan jalur staf. Endpoint ini terbuka untuk siapa
  // pun yang memegang token, jadi ia tidak boleh lebih longgar dari panel
  // admin — constraint database memang menjaganya, tapi galat Postgres
  // mentah bukan sesuatu yang boleh sampai ke layar klien.
  if (body.budgetAmount != null && (!Number.isFinite(body.budgetAmount) || body.budgetAmount < 0)) {
    return c.json({ error: { status: 422, message: "anggaran tidak boleh negatif" } }, 422);
  }
  if (body.startDate && body.endDate && body.endDate < body.startDate) {
    return c.json({ error: { status: 422, message: "tanggal selesai tidak boleh mendahului tanggal mulai" } }, 422);
  }

  try {
    await withDb(c.env, c.executionCtx, (sql) => progressRepo.submitBrief(sql, token, body));
    return c.json({ data: { updated: true } });
  } catch (err) {
    if (err instanceof progressRepo.TokenTidakDitemukan) {
      return c.json({ error: { status: 404, message: "link tidak ditemukan" } }, 404);
    }
    throw err;
  }
});

// POST /api/v1/progress/:token/testimonial — selalu masuk sebagai "menunggu"
// moderasi staf sebelum tampil di situs publik.
progress.post("/progress/:token/testimonial", async (c) => {
  const token = c.req.param("token");
  if (!/^[0-9a-f]{40}$/.test(token)) {
    return c.json({ error: { status: 404, message: "link tidak ditemukan" } }, 404);
  }

  type Body = { clientName?: string; quote?: string; rating?: number | null };
  const body = await c.req.json<Body>().catch((): Body => ({}));
  const clientName = (body.clientName ?? "").trim();
  const quote = (body.quote ?? "").trim();
  if (clientName.length < 2 || quote.length < 2) {
    return c.json({ error: { status: 422, message: "nama dan testimoni wajib diisi" } }, 422);
  }
  if (body.rating !== undefined && body.rating !== null && (body.rating < 1 || body.rating > 5)) {
    return c.json({ error: { status: 422, message: "rating harus 1-5" } }, 422);
  }

  try {
    const id = await withDb(c.env, c.executionCtx, (sql) =>
      progressRepo.submitTestimonial(sql, token, clientName, quote, body.rating ?? null),
    );
    return c.json({ data: { id } }, 201);
  } catch (err) {
    if (err instanceof progressRepo.TokenTidakDitemukan) {
      return c.json({ error: { status: 404, message: "link tidak ditemukan" } }, 404);
    }
    throw err;
  }
});
