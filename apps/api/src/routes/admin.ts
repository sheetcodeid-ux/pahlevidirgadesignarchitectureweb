import { Hono } from "hono";
import type { Env } from "../types";
import { withDb } from "../db";
import { requireSupabaseAuth } from "../middleware/auth";
import { requireStaff } from "../middleware/staff";
import { role } from "../repository/profile";
import * as adminRepo from "../repository/admin";
import { NotFoundError } from "../repository/projects";
import { presignUpload } from "../lib/r2";
import { checkProjectInput, ValidationError } from "../lib/validate";
import type { ProjectInput, ImageInput } from "../types";
import { VALID_INQUIRY_STATUS } from "../types";

type Vars = { userID: string; userEmail?: string };

export const admin = new Hono<{ Bindings: Env; Variables: Vars }>();

// Dua lapis: token harus sah, DAN pemiliknya harus terdaftar sebagai staf.
// Lapis kedua tidak bisa didelegasikan ke RLS, karena koneksi backend
// memakai kredensial yang melewatinya.
admin.use("*", requireSupabaseAuth(), requireStaff());

function assetBase(env: Env): string {
  return env.R2_PUBLIC_BASE_URL ?? "";
}

// GET /api/v1/admin/me
admin.get("/me", async (c) => {
  const userID = c.get("userID");
  const peran = await withDb(c.env, c.executionCtx, (sql) => role(sql, userID));
  return c.json({
    data: { id: userID, email: c.get("userEmail"), role: peran, isMasterAdmin: peran === "admin" },
  });
});

// POST /api/v1/admin/uploads — presigned PUT URL, upload langsung ke R2.
admin.post("/uploads", async (c) => {
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET } = c.env;
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET) {
    return c.json({ error: { status: 503, message: "penyimpanan objek belum dikonfigurasi" } }, 503);
  }

  type UploadBody = { projectSlug?: string; contentType?: string };
  const body = await c.req.json<UploadBody>().catch((): UploadBody => ({}));
  const projectSlug = (body.projectSlug ?? "").trim();
  if (!projectSlug) {
    return c.json({ error: { status: 422, message: "projectSlug wajib diisi" } }, 422);
  }

  try {
    const target = await presignUpload(
      { accountId: R2_ACCOUNT_ID, accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY, bucket: R2_BUCKET },
      projectSlug,
      body.contentType ?? "",
    );
    return c.json({ data: target });
  } catch (err) {
    return c.json({ error: { status: 422, message: (err as Error).message } }, 422);
  }
});

// GET /api/v1/admin/projects — termasuk draft.
admin.get("/projects", async (c) => {
  const list = await withDb(c.env, c.executionCtx, (sql) => adminRepo.listAll(sql, assetBase(c.env)));
  return c.json({ data: list });
});

admin.post("/projects", async (c) => {
  const input = await c.req.json<ProjectInput>().catch(() => ({}) as ProjectInput);
  try {
    checkProjectInput(input, true);
  } catch (err) {
    if (err instanceof ValidationError) return c.json({ error: { status: err.status, message: err.message } }, err.status as 422);
    throw err;
  }

  try {
    const id = await withDb(c.env, c.executionCtx, (sql) => adminRepo.create(sql, input));
    return c.json({ data: { id } }, 201);
  } catch (err) {
    return c.json({ error: { status: 422, message: (err as Error).message } }, 422);
  }
});

admin.patch("/projects/:id", async (c) => {
  const input = await c.req.json<ProjectInput>().catch(() => ({}) as ProjectInput);
  try {
    checkProjectInput(input, false);
  } catch (err) {
    if (err instanceof ValidationError) return c.json({ error: { status: err.status, message: err.message } }, err.status as 422);
    throw err;
  }

  try {
    await withDb(c.env, c.executionCtx, (sql) => adminRepo.update(sql, c.req.param("id"), input));
    return c.json({ data: { updated: true } });
  } catch (err) {
    if (err instanceof NotFoundError) return c.json({ error: { status: 404, message: "proyek tidak ditemukan" } }, 404);
    throw err;
  }
});

admin.delete("/projects/:id", async (c) => {
  try {
    await withDb(c.env, c.executionCtx, (sql) => adminRepo.remove(sql, c.req.param("id")));
    return c.json({ data: { deleted: true } });
  } catch (err) {
    if (err instanceof NotFoundError) return c.json({ error: { status: 404, message: "proyek tidak ditemukan" } }, 404);
    throw err;
  }
});

admin.post("/projects/:id/images", async (c) => {
  const input = await c.req.json<ImageInput>().catch(() => ({}) as ImageInput);
  if (!input.storageKey) {
    return c.json({ error: { status: 422, message: "storageKey wajib diisi" } }, 422);
  }

  try {
    const id = await withDb(c.env, c.executionCtx, (sql) => adminRepo.addImage(sql, c.req.param("id"), input));
    return c.json({ data: { id } }, 201);
  } catch (err) {
    return c.json({ error: { status: 422, message: (err as Error).message } }, 422);
  }
});

admin.delete("/images/:imageId", async (c) => {
  try {
    await withDb(c.env, c.executionCtx, (sql) => adminRepo.removeImage(sql, c.req.param("imageId")));
    return c.json({ data: { deleted: true } });
  } catch (err) {
    if (err instanceof NotFoundError) return c.json({ error: { status: 404, message: "gambar tidak ditemukan" } }, 404);
    throw err;
  }
});

admin.get("/inquiries", async (c) => {
  const status = c.req.query("status") ?? "";
  if (status !== "" && !VALID_INQUIRY_STATUS.has(status)) {
    return c.json({ error: { status: 400, message: "status tidak dikenal" } }, 400);
  }

  const list = await withDb(c.env, c.executionCtx, (sql) => adminRepo.listInquiries(sql, status));
  return c.json({ data: list });
});

admin.patch("/inquiries/:id", async (c) => {
  const body = await c.req.json<{ status?: string }>().catch((): { status?: string } => ({}));
  const status = body.status ?? "";
  if (!VALID_INQUIRY_STATUS.has(status)) {
    return c.json({ error: { status: 422, message: "status tidak dikenal" } }, 422);
  }

  try {
    await withDb(c.env, c.executionCtx, (sql) => adminRepo.setInquiryStatus(sql, c.req.param("id"), status));
    return c.json({ data: { updated: true } });
  } catch (err) {
    if (err instanceof NotFoundError) return c.json({ error: { status: 404, message: "pesan tidak ditemukan" } }, 404);
    throw err;
  }
});
