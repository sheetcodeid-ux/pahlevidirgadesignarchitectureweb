import { Hono } from "hono";
import type { Env, ImagePatch } from "../types";
import { withDb } from "../db";
import { requireSupabaseAuth } from "../middleware/auth";
import { requireStaff } from "../middleware/staff";
import { role } from "../repository/profile";
import * as adminRepo from "../repository/admin";
import * as settingsRepo from "../repository/settings";
import * as progressRepo from "../repository/progress";
import * as teamRepo from "../repository/team";
import * as tasksRepo from "../repository/tasks";
import * as invoicesRepo from "../repository/invoices";
import * as costsRepo from "../repository/costs";
import * as financeRepo from "../repository/finance";
import * as documentsRepo from "../repository/documents";
import * as directoryRepo from "../repository/directory";
import * as briefRepo from "../repository/brief";
import * as commentsRepo from "../repository/documentComments";
import * as testimonialsRepo from "../repository/testimonials";
import { NotFoundError } from "../repository/projects";
import { presignUpload, sanitizeSlug } from "../lib/r2";
import { checkProjectInput, ValidationError } from "../lib/validate";
import type {
  ProjectInput, ImageInput, StudioSettingsInput, TeamMemberInput, ProjectTaskInput,
  InvoiceInput, ProjectCostInput, ProjectDocumentInput, DirectoryContactInput,
  ProjectBriefInput, TestimonialInput,
} from "../types";
import {
  VALID_INQUIRY_STATUS, VALID_PROJECT_PHASE, VALID_TASK_STATUS, VALID_PIPELINE_STAGE,
  VALID_INVOICE_STATUS, VALID_COST_CATEGORY, VALID_DOCUMENT_STATUS, VALID_CONTACT_CATEGORY,
  VALID_TESTIMONIAL_STATUS,
} from "../types";

type Vars = { userID: string; userEmail?: string; accessToken: string };

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

  type UploadBody = { projectSlug?: string; scope?: string; contentType?: string };
  const body = await c.req.json<UploadBody>().catch((): UploadBody => ({}));

  let folder: string;
  if (body.scope === "logo") {
    // Aset tingkat studio, bukan proyek — satu folder tetap, tidak perlu slug.
    folder = "studio";
  } else {
    const projectSlug = (body.projectSlug ?? "").trim();
    if (!projectSlug) {
      return c.json({ error: { status: 422, message: "projectSlug wajib diisi" } }, 422);
    }
    folder = `projects/${sanitizeSlug(projectSlug)}`;
  }

  try {
    const target = await presignUpload(
      { accountId: R2_ACCOUNT_ID, accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY, bucket: R2_BUCKET },
      folder,
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

/**
 * GET /api/v1/admin/projects/:id/images?kind=galeri|material
 *
 * Satu endpoint untuk dua jenis, bukan dua endpoint: yang berbeda cuma
 * penyaringnya, dan dua endpoint berarti dua tempat yang harus diingat
 * setiap kali bentuk gambar berubah. Nilai selain kedua itu ditolak, bukan
 * diam-diam dianggap galeri.
 */
admin.get("/projects/:id/images", async (c) => {
  const kind = c.req.query("kind") ?? "galeri";
  if (kind !== "galeri" && kind !== "material") {
    return c.json({ error: { status: 422, message: "kind harus galeri atau material" } }, 422);
  }
  const list = await withDb(c.env, c.executionCtx, (sql) =>
    adminRepo.listImages(sql, assetBase(c.env), c.req.param("id"), kind));
  return c.json({ data: list });
});

admin.post("/projects/:id/images", async (c) => {
  const input = await c.req.json<ImageInput>().catch(() => ({}) as ImageInput);
  if (!input.storageKey) {
    return c.json({ error: { status: 422, message: "storageKey wajib diisi" } }, 422);
  }
  if (input.kind !== undefined && input.kind !== "galeri" && input.kind !== "material") {
    return c.json({ error: { status: 422, message: "kind harus galeri atau material" } }, 422);
  }

  try {
    const id = await withDb(c.env, c.executionCtx, (sql) => adminRepo.addImage(sql, c.req.param("id"), input));
    return c.json({ data: { id } }, 201);
  } catch (err) {
    return c.json({ error: { status: 422, message: (err as Error).message } }, 422);
  }
});

admin.patch("/images/:imageId", async (c) => {
  const patch = await c.req.json<ImagePatch>().catch(() => ({}) as ImagePatch);
  try {
    await withDb(c.env, c.executionCtx, (sql) => adminRepo.updateImage(sql, c.req.param("imageId"), patch));
    return c.json({ data: { updated: true } });
  } catch (err) {
    if (err instanceof NotFoundError) return c.json({ error: { status: 404, message: "gambar tidak ditemukan" } }, 404);
    throw err;
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

// PATCH /api/v1/admin/account/password
//
// Meneruskan ke Supabase Auth dengan token akses milik pemanggil sendiri
// (bukan service_role) — GoTrue yang memverifikasi sesi itu benar-benar sah
// sebelum mengganti password, kita tidak perlu menduplikasi logika itu.
admin.patch("/account/password", async (c) => {
  const body = await c.req.json<{ newPassword?: string }>().catch((): { newPassword?: string } => ({}));
  const newPassword = body.newPassword ?? "";
  if (newPassword.length < 8) {
    return c.json({ error: { status: 422, message: "kata sandi minimal 8 karakter" } }, 422);
  }

  const supabaseUrl = (c.env.SUPABASE_URL ?? "").replace(/\/$/, "");
  const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      apikey: c.env.SUPABASE_ANON_KEY ?? "",
      Authorization: `Bearer ${c.get("accessToken")}`,
    },
    body: JSON.stringify({ password: newPassword }),
  });

  if (!res.ok) {
    return c.json({ error: { status: 422, message: "gagal mengubah kata sandi" } }, 422);
  }

  return c.json({ data: { updated: true } });
});

// GET /api/v1/admin/team
admin.get("/team", async (c) => {
  const data = await withDb(c.env, c.executionCtx, (sql) => teamRepo.list(sql));
  return c.json({ data });
});

admin.post("/team", async (c) => {
  const input = await c.req.json<TeamMemberInput>().catch(() => ({}) as TeamMemberInput);
  try {
    const id = await withDb(c.env, c.executionCtx, (sql) => teamRepo.create(sql, input));
    return c.json({ data: { id } }, 201);
  } catch (err) {
    return c.json({ error: { status: 422, message: (err as Error).message } }, 422);
  }
});

admin.patch("/team/:id", async (c) => {
  const input = await c.req.json<TeamMemberInput>().catch(() => ({}) as TeamMemberInput);
  try {
    await withDb(c.env, c.executionCtx, (sql) => teamRepo.update(sql, c.req.param("id"), input));
    return c.json({ data: { updated: true } });
  } catch (err) {
    if (err instanceof NotFoundError) return c.json({ error: { status: 404, message: "anggota tim tidak ditemukan" } }, 404);
    throw err;
  }
});

admin.delete("/team/:id", async (c) => {
  try {
    await withDb(c.env, c.executionCtx, (sql) => teamRepo.remove(sql, c.req.param("id")));
    return c.json({ data: { deleted: true } });
  } catch (err) {
    if (err instanceof NotFoundError) return c.json({ error: { status: 404, message: "anggota tim tidak ditemukan" } }, 404);
    throw err;
  }
});

// GET /api/v1/admin/tasks — seluruh tugas lintas proyek, untuk List Kerjaan.
admin.get("/tasks", async (c) => {
  const data = await withDb(c.env, c.executionCtx, (sql) => tasksRepo.listAll(sql));
  return c.json({ data });
});

admin.patch("/tasks/:id", async (c) => {
  const input = await c.req.json<ProjectTaskInput>().catch(() => ({}) as ProjectTaskInput);
  if (input.status !== undefined && !VALID_TASK_STATUS.has(input.status)) {
    return c.json({ error: { status: 422, message: "status tugas tidak dikenal" } }, 422);
  }
  if (input.stage !== undefined && input.stage !== null && !VALID_PIPELINE_STAGE.has(input.stage)) {
    return c.json({ error: { status: 422, message: "tahap pipeline tidak dikenal" } }, 422);
  }

  try {
    await withDb(c.env, c.executionCtx, (sql) => tasksRepo.update(sql, c.req.param("id"), input));
    return c.json({ data: { updated: true } });
  } catch (err) {
    if (err instanceof NotFoundError) return c.json({ error: { status: 404, message: "tugas tidak ditemukan" } }, 404);
    throw err;
  }
});

admin.delete("/tasks/:id", async (c) => {
  try {
    await withDb(c.env, c.executionCtx, (sql) => tasksRepo.remove(sql, c.req.param("id")));
    return c.json({ data: { deleted: true } });
  } catch (err) {
    if (err instanceof NotFoundError) return c.json({ error: { status: 404, message: "tugas tidak ditemukan" } }, 404);
    throw err;
  }
});

// GET /api/v1/admin/projects/:id/tasks
admin.get("/projects/:id/tasks", async (c) => {
  const data = await withDb(c.env, c.executionCtx, (sql) => tasksRepo.listForProject(sql, c.req.param("id")));
  return c.json({ data });
});

admin.post("/projects/:id/tasks", async (c) => {
  const input = await c.req.json<ProjectTaskInput>().catch(() => ({}) as ProjectTaskInput);
  if (input.stage !== undefined && input.stage !== null && !VALID_PIPELINE_STAGE.has(input.stage)) {
    return c.json({ error: { status: 422, message: "tahap pipeline tidak dikenal" } }, 422);
  }

  try {
    const id = await withDb(c.env, c.executionCtx, (sql) => tasksRepo.create(sql, c.req.param("id"), input));
    return c.json({ data: { id } }, 201);
  } catch (err) {
    return c.json({ error: { status: 422, message: (err as Error).message } }, 422);
  }
});

// GET /api/v1/admin/finance/overview?projectId=…
admin.get("/finance/overview", async (c) => {
  // Tanpa projectId berarti "Semua" — seluruh proyek studio, sama seperti
  // sebelum penyaring ini ada.
  const projectID = c.req.query("projectId") || null;
  const data = await withDb(c.env, c.executionCtx, (sql) => financeRepo.overview(sql, projectID));
  return c.json({ data });
});

// GET /api/v1/admin/finance/monthly?projectId=…&bulan=12
admin.get("/finance/monthly", async (c) => {
  const projectID = c.req.query("projectId") || null;
  const bulan = Number(c.req.query("bulan") ?? 12);
  const data = await withDb(c.env, c.executionCtx, (sql) => financeRepo.monthly(sql, projectID, bulan));
  return c.json({ data });
});

// GET /api/v1/admin/projects/:id/invoices
admin.get("/projects/:id/invoices", async (c) => {
  const data = await withDb(c.env, c.executionCtx, (sql) => invoicesRepo.listForProject(sql, c.req.param("id")));
  return c.json({ data });
});

admin.post("/projects/:id/invoices", async (c) => {
  const input = await c.req.json<InvoiceInput>().catch(() => ({}) as InvoiceInput);
  try {
    const id = await withDb(c.env, c.executionCtx, (sql) => invoicesRepo.create(sql, c.req.param("id"), input));
    return c.json({ data: { id } }, 201);
  } catch (err) {
    return c.json({ error: { status: 422, message: (err as Error).message } }, 422);
  }
});

admin.patch("/invoices/:id", async (c) => {
  const input = await c.req.json<InvoiceInput>().catch(() => ({}) as InvoiceInput);
  if (input.status !== undefined && !VALID_INVOICE_STATUS.has(input.status)) {
    return c.json({ error: { status: 422, message: "status invoice tidak dikenal" } }, 422);
  }

  try {
    await withDb(c.env, c.executionCtx, (sql) => invoicesRepo.update(sql, c.req.param("id"), input));
    return c.json({ data: { updated: true } });
  } catch (err) {
    if (err instanceof NotFoundError) return c.json({ error: { status: 404, message: "invoice tidak ditemukan" } }, 404);
    throw err;
  }
});

admin.delete("/invoices/:id", async (c) => {
  try {
    await withDb(c.env, c.executionCtx, (sql) => invoicesRepo.remove(sql, c.req.param("id")));
    return c.json({ data: { deleted: true } });
  } catch (err) {
    if (err instanceof NotFoundError) return c.json({ error: { status: 404, message: "invoice tidak ditemukan" } }, 404);
    throw err;
  }
});

// GET /api/v1/admin/projects/:id/costs
admin.get("/projects/:id/costs", async (c) => {
  const data = await withDb(c.env, c.executionCtx, (sql) => costsRepo.listForProject(sql, c.req.param("id")));
  return c.json({ data });
});

admin.post("/projects/:id/costs", async (c) => {
  const input = await c.req.json<ProjectCostInput>().catch(() => ({}) as ProjectCostInput);
  if (input.category !== undefined && !VALID_COST_CATEGORY.has(input.category)) {
    return c.json({ error: { status: 422, message: "kategori biaya tidak dikenal" } }, 422);
  }

  try {
    const id = await withDb(c.env, c.executionCtx, (sql) => costsRepo.create(sql, c.req.param("id"), input));
    return c.json({ data: { id } }, 201);
  } catch (err) {
    return c.json({ error: { status: 422, message: (err as Error).message } }, 422);
  }
});

admin.delete("/costs/:id", async (c) => {
  try {
    await withDb(c.env, c.executionCtx, (sql) => costsRepo.remove(sql, c.req.param("id")));
    return c.json({ data: { deleted: true } });
  } catch (err) {
    if (err instanceof NotFoundError) return c.json({ error: { status: 404, message: "biaya tidak ditemukan" } }, 404);
    throw err;
  }
});

// GET /api/v1/admin/projects/:id/documents
admin.get("/projects/:id/documents", async (c) => {
  const data = await withDb(c.env, c.executionCtx, (sql) =>
    documentsRepo.listForProject(sql, assetBase(c.env), c.req.param("id")),
  );
  return c.json({ data });
});

admin.post("/projects/:id/documents", async (c) => {
  const input = await c.req.json<ProjectDocumentInput>().catch(() => ({}) as ProjectDocumentInput);
  try {
    const id = await withDb(c.env, c.executionCtx, (sql) => documentsRepo.create(sql, c.req.param("id"), input));
    return c.json({ data: { id } }, 201);
  } catch (err) {
    return c.json({ error: { status: 422, message: (err as Error).message } }, 422);
  }
});

admin.patch("/documents/:id", async (c) => {
  const input = await c.req.json<ProjectDocumentInput>().catch(() => ({}) as ProjectDocumentInput);
  if (input.status !== undefined && !VALID_DOCUMENT_STATUS.has(input.status)) {
    return c.json({ error: { status: 422, message: "status dokumen tidak dikenal" } }, 422);
  }

  try {
    await withDb(c.env, c.executionCtx, (sql) => documentsRepo.update(sql, c.req.param("id"), input));
    return c.json({ data: { updated: true } });
  } catch (err) {
    if (err instanceof NotFoundError) return c.json({ error: { status: 404, message: "dokumen tidak ditemukan" } }, 404);
    throw err;
  }
});

admin.delete("/documents/:id", async (c) => {
  try {
    await withDb(c.env, c.executionCtx, (sql) => documentsRepo.remove(sql, c.req.param("id")));
    return c.json({ data: { deleted: true } });
  } catch (err) {
    if (err instanceof NotFoundError) return c.json({ error: { status: 404, message: "dokumen tidak ditemukan" } }, 404);
    throw err;
  }
});

// GET /api/v1/admin/directory
admin.get("/directory", async (c) => {
  const data = await withDb(c.env, c.executionCtx, (sql) => directoryRepo.list(sql));
  return c.json({ data });
});

admin.post("/directory", async (c) => {
  const input = await c.req.json<DirectoryContactInput>().catch(() => ({}) as DirectoryContactInput);
  if (input.category !== undefined && !VALID_CONTACT_CATEGORY.has(input.category)) {
    return c.json({ error: { status: 422, message: "kategori kontak tidak dikenal" } }, 422);
  }

  try {
    const id = await withDb(c.env, c.executionCtx, (sql) => directoryRepo.create(sql, input));
    return c.json({ data: { id } }, 201);
  } catch (err) {
    return c.json({ error: { status: 422, message: (err as Error).message } }, 422);
  }
});

admin.patch("/directory/:id", async (c) => {
  const input = await c.req.json<DirectoryContactInput>().catch(() => ({}) as DirectoryContactInput);
  if (input.category !== undefined && !VALID_CONTACT_CATEGORY.has(input.category)) {
    return c.json({ error: { status: 422, message: "kategori kontak tidak dikenal" } }, 422);
  }

  try {
    await withDb(c.env, c.executionCtx, (sql) => directoryRepo.update(sql, c.req.param("id"), input));
    return c.json({ data: { updated: true } });
  } catch (err) {
    if (err instanceof NotFoundError) return c.json({ error: { status: 404, message: "kontak tidak ditemukan" } }, 404);
    throw err;
  }
});

admin.delete("/directory/:id", async (c) => {
  try {
    await withDb(c.env, c.executionCtx, (sql) => directoryRepo.remove(sql, c.req.param("id")));
    return c.json({ data: { deleted: true } });
  } catch (err) {
    if (err instanceof NotFoundError) return c.json({ error: { status: 404, message: "kontak tidak ditemukan" } }, 404);
    throw err;
  }
});

// GET /api/v1/admin/projects/:id/brief
admin.get("/projects/:id/brief", async (c) => {
  const data = await withDb(c.env, c.executionCtx, (sql) => briefRepo.getForAdmin(sql, c.req.param("id")));
  return c.json({ data });
});

admin.patch("/projects/:id/brief", async (c) => {
  const input = await c.req.json<ProjectBriefInput>().catch(() => ({}) as ProjectBriefInput);

  // Divalidasi di sini juga, bukan cuma di database: constraint database
  // membalas galat Postgres mentah yang tidak bisa ditampilkan ke staf.
  if (input.budgetAmount != null && (!Number.isFinite(input.budgetAmount) || input.budgetAmount < 0)) {
    return c.json({ error: { status: 422, message: "anggaran tidak boleh negatif" } }, 422);
  }
  if (input.startDate && input.endDate && input.endDate < input.startDate) {
    return c.json({ error: { status: 422, message: "tanggal selesai tidak boleh mendahului tanggal mulai" } }, 422);
  }

  await withDb(c.env, c.executionCtx, (sql) => briefRepo.update(sql, c.req.param("id"), input));
  return c.json({ data: { updated: true } });
});

// GET /api/v1/admin/documents/:id/comments
admin.get("/documents/:id/comments", async (c) => {
  const data = await withDb(c.env, c.executionCtx, (sql) => commentsRepo.listForDocument(sql, c.req.param("id")));
  return c.json({ data });
});

admin.post("/documents/:id/comments", async (c) => {
  const body = await c.req.json<{ body?: string }>().catch((): { body?: string } => ({}));
  try {
    const id = await withDb(c.env, c.executionCtx, (sql) =>
      commentsRepo.create(sql, c.req.param("id"), "staf", body.body ?? ""),
    );
    return c.json({ data: { id } }, 201);
  } catch (err) {
    return c.json({ error: { status: 422, message: (err as Error).message } }, 422);
  }
});

// GET /api/v1/admin/testimonials — termasuk yang menunggu moderasi.
admin.get("/testimonials", async (c) => {
  const data = await withDb(c.env, c.executionCtx, (sql) => testimonialsRepo.listAll(sql));
  return c.json({ data });
});

admin.patch("/testimonials/:id", async (c) => {
  const input = await c.req.json<TestimonialInput>().catch(() => ({}) as TestimonialInput);
  if (input.status !== undefined && !VALID_TESTIMONIAL_STATUS.has(input.status)) {
    return c.json({ error: { status: 422, message: "status testimoni tidak dikenal" } }, 422);
  }

  try {
    await withDb(c.env, c.executionCtx, (sql) => testimonialsRepo.update(sql, c.req.param("id"), input));
    return c.json({ data: { updated: true } });
  } catch (err) {
    if (err instanceof NotFoundError) return c.json({ error: { status: 404, message: "testimoni tidak ditemukan" } }, 404);
    throw err;
  }
});

admin.delete("/testimonials/:id", async (c) => {
  try {
    await withDb(c.env, c.executionCtx, (sql) => testimonialsRepo.remove(sql, c.req.param("id")));
    return c.json({ data: { deleted: true } });
  } catch (err) {
    if (err instanceof NotFoundError) return c.json({ error: { status: 404, message: "testimoni tidak ditemukan" } }, 404);
    throw err;
  }
});

// GET /api/v1/admin/settings
admin.get("/settings", async (c) => {
  const data = await withDb(c.env, c.executionCtx, (sql) => settingsRepo.get(sql, assetBase(c.env)));
  // Bukan kolom database, melainkan keadaan rahasia Worker: dipakai panel
  // Pesan Masuk untuk memperingatkan kalau pemberitahuan email mati. Yang
  // dikirim hanya benar/salah — nilai rahasianya tidak pernah ikut.
  const notifikasiEmailAktif = Boolean(c.env.RESEND_API_KEY && c.env.INQUIRY_NOTIFY_TO);
  // Sama alasannya: panel perlu tahu apakah tombol "Terbitkan situs" ada
  // gunanya, tanpa pernah melihat tokennya.
  const terbitSitusAktif = Boolean(c.env.GITHUB_DISPATCH_TOKEN);
  return c.json({ data: { ...data, notifikasiEmailAktif, terbitSitusAktif } });
});

/**
 * GET /api/v1/admin/settings/logo — bita logo studio, dibaca dari binding R2.
 *
 * Kop PDF butuh logonya sebagai bita, bukan sebagai URL: pustaka PDF harus
 * menyisipkan berkasnya. Mengambilnya langsung dari media.pahlevidirga...
 * di browser berarti bergantung pada aturan CORS bucket, yang disetel untuk
 * unggahan presigned dan bisa berubah tanpa ada yang sadar sampai kop PDF
 * mendadak kosong.
 *
 * Lewat sini tidak ada CORS baru yang perlu dipikirkan — Worker ini sudah
 * punya ALLOWED_ORIGINS untuk panel admin, dan bucket dibaca lewat binding,
 * bukan lewat jaringan.
 */
admin.get("/settings/logo", async (c) => {
  const key = await withDb(c.env, c.executionCtx, (sql) => settingsRepo.logoKey(sql));
  if (!key) return c.json({ error: { status: 404, message: "studio belum punya logo" } }, 404);

  const objek = await c.env.MEDIA.get(key);
  if (!objek) return c.json({ error: { status: 404, message: "berkas logo tidak ada di penyimpanan" } }, 404);

  const header = new Headers();
  objek.writeHttpMetadata(header);
  header.set("etag", objek.httpEtag);
  // Tanpa cache: logo bisa diganti kapan saja dari Info Studio, dan satu-
  // satunya pemakainya adalah pembuatan PDF yang jarang dijalankan.
  header.set("cache-control", "no-store");
  if (!header.has("content-type")) header.set("content-type", "application/octet-stream");
  return new Response(objek.body, { headers: header });
});

/**
 * POST /api/v1/admin/publish — memicu build ulang situs statis.
 *
 * Halaman proyek publik dibekukan saat build (getStaticPaths), jadi
 * menerbitkan proyek di panel ini tidak mengubah situs sampai ada build
 * ulang. Itu keputusan yang disengaja — pengunjung tidak pernah menunggu
 * Worker API — tapi selama ini tidak ada cara memicunya dari panel, dan
 * staf tidak punya alasan untuk tahu soal GitHub Actions.
 *
 * Tokennya hidup di Worker, TIDAK pernah sampai ke browser. Itu sebabnya
 * ini endpoint sendiri, bukan panggilan langsung dari frontend ke GitHub.
 */
admin.post("/publish", async (c) => {
  const token = c.env.GITHUB_DISPATCH_TOKEN;
  if (!token) {
    return c.json({
      error: { status: 503, message: "tombol terbitkan situs belum dikonfigurasi" },
    }, 503);
  }

  const repo = c.env.GITHUB_REPO ?? "sheetcodeid-ux/pahlevidirgadesignarchitectureweb";
  const workflow = c.env.GITHUB_WORKFLOW ?? "deploy.yml";
  const branch = c.env.GITHUB_BRANCH ?? "claude/stack-setup-supabase-cloudflare-kdwlkk";

  const res = await fetch(
    `https://api.github.com/repos/${repo}/actions/workflows/${workflow}/dispatches`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        // GitHub menolak permintaan tanpa User-Agent dengan 403 yang
        // pesannya tidak menyebut sebabnya sama sekali.
        "User-Agent": "pahlevidirga-api",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ref: branch }),
    },
  );

  // 204 = diterima. Isi badan galatnya diteruskan apa adanya supaya staf
  // melihat sebab yang sebenarnya (token kedaluwarsa, cakupan kurang),
  // bukan "gagal" tanpa keterangan.
  if (res.status !== 204) {
    const teks = await res.text().catch(() => "");
    return c.json({
      error: { status: 502, message: `GitHub menolak permintaan build (${res.status}) ${teks}`.trim() },
    }, 502);
  }

  return c.json({ data: { dimulai: true } });
});

/** Tiga zona Indonesia, sama persis dengan check constraint di database. */
const ZONA_SAH = ["Asia/Jakarta", "Asia/Makassar", "Asia/Jayapura"];

admin.patch("/settings", async (c) => {
  const input = await c.req.json<StudioSettingsInput>().catch(() => ({}) as StudioSettingsInput);

  // Diperiksa di sini juga, bukan hanya diserahkan ke check constraint:
  // constraint yang dilanggar keluar sebagai kegagalan database, dan panel
  // admin menampilkannya sebagai "Permintaan gagal (500)" — tidak memberi tahu
  // penggunanya apa yang salah.
  if (input.timezone !== undefined && !ZONA_SAH.includes(input.timezone)) {
    return c.json({ error: { status: 422, message: "zona waktu harus salah satu dari WIB, WITA, atau WIT" } }, 422);
  }

  await withDb(c.env, c.executionCtx, (sql) => settingsRepo.update(sql, input));
  return c.json({ data: { updated: true } });
});

// GET /api/v1/admin/projects/:id/progress — fase, link klien, dan linimasa.
admin.get("/projects/:id/progress", async (c) => {
  const data = await withDb(c.env, c.executionCtx, (sql) =>
    progressRepo.getForAdmin(sql, assetBase(c.env), c.req.param("id")),
  );
  return c.json({ data });
});

admin.patch("/projects/:id/progress", async (c) => {
  const body = await c.req.json<{ phase?: string }>().catch((): { phase?: string } => ({}));
  const phase = body.phase ?? "";
  if (!VALID_PROJECT_PHASE.has(phase)) {
    return c.json({ error: { status: 422, message: "fase tidak dikenal" } }, 422);
  }

  await withDb(c.env, c.executionCtx, (sql) => progressRepo.setPhase(sql, c.req.param("id"), phase));
  return c.json({ data: { updated: true } });
});

// POST /api/v1/admin/projects/:id/progress/token — buat ulang link klien,
// misalnya kalau link lama sudah terlanjur tersebar ke pihak yang salah.
admin.post("/projects/:id/progress/token", async (c) => {
  const accessToken = await withDb(c.env, c.executionCtx, (sql) =>
    progressRepo.regenerateToken(sql, c.req.param("id")),
  );
  return c.json({ data: { accessToken } });
});

admin.post("/projects/:id/progress/updates", async (c) => {
  type Body = { title?: string; note?: string | null; photoKey?: string | null };
  const body = await c.req.json<Body>().catch((): Body => ({}));
  const title = (body.title ?? "").trim();
  if (title.length < 2 || title.length > 160) {
    return c.json({ error: { status: 422, message: "judul catatan harus 2-160 karakter" } }, 422);
  }

  const id = await withDb(c.env, c.executionCtx, (sql) =>
    progressRepo.addUpdate(sql, c.req.param("id"), title, body.note ?? null, body.photoKey ?? null),
  );
  return c.json({ data: { id } }, 201);
});

admin.delete("/progress-updates/:id", async (c) => {
  try {
    await withDb(c.env, c.executionCtx, (sql) => progressRepo.removeUpdate(sql, c.req.param("id")));
    return c.json({ data: { deleted: true } });
  } catch (err) {
    if (err instanceof NotFoundError) return c.json({ error: { status: 404, message: "catatan tidak ditemukan" } }, 404);
    throw err;
  }
});
