import { Hono } from "hono";
import type { Env } from "../types";
import { withDb } from "../db";
import { create } from "../repository/inquiries";
import { checkInquiry, ValidationError } from "../lib/validate";
import { verifyTurnstile } from "../lib/turnstile";
import { hashIP } from "../lib/ipHash";
import { sendInquiryNotification } from "../lib/mailer";
import { VALID_CATEGORIES } from "../types";

export const inquiries = new Hono<{ Bindings: Env }>();

interface InquiryBody {
  name?: string;
  email?: string;
  phone?: string;
  projectType?: string;
  budgetRange?: string;
  message?: string;
  source?: string;
  turnstileToken?: string;
  /** Honeypot: field tersembunyi di form. Manusia tidak pernah mengisinya. */
  website?: string;
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) : s;
}

function optional(s: string | undefined): string | null {
  const trimmed = s?.trim();
  return trimmed ? trimmed : null;
}

// POST /api/v1/inquiries — dari form kontak.
inquiries.post("/inquiries", async (c) => {
  const body = (await c.req.json<InquiryBody>().catch(() => ({}))) as InquiryBody;

  // Jawab 202 seolah berhasil supaya bot tidak belajar bahwa jebakannya
  // terdeteksi, tapi jangan simpan apa pun.
  if ((body.website ?? "").trim() !== "") {
    return c.json({ data: { received: true } }, 202);
  }

  const req = {
    name: (body.name ?? "").trim(),
    email: (body.email ?? "").trim(),
    phone: (body.phone ?? "").trim(),
    message: (body.message ?? "").trim(),
  };

  try {
    checkInquiry(req);
  } catch (err) {
    if (err instanceof ValidationError) {
      return c.json({ error: { status: err.status, message: err.message } }, err.status as 422);
    }
    throw err;
  }

  const ip = c.req.header("CF-Connecting-IP") ?? "";
  try {
    await verifyTurnstile(c.env.TURNSTILE_SECRET_KEY, body.turnstileToken ?? "", ip);
  } catch {
    return c.json({ error: { status: 403, message: "verifikasi anti-bot gagal" } }, 403);
  }

  const projectType = body.projectType && VALID_CATEGORIES.has(body.projectType) ? body.projectType : null;

  const ipHash = await hashIP(ip, c.env.IP_HASH_SALT);

  const id = await withDb(c.env, c.executionCtx, (sql) =>
    create(sql, {
      name: req.name,
      email: req.email,
      phone: optional(body.phone),
      projectType,
      budgetRange: optional(body.budgetRange),
      message: req.message,
      source: optional(body.source),
      ipHash,
      userAgent: truncate(c.req.header("User-Agent") ?? "", 512),
    }),
  );

  // Calon klien sudah tersimpan; kegagalan email tidak boleh menggagalkan
  // request, jadi dijadwalkan lewat waitUntil alih-alih ditunggu.
  if (c.env.RESEND_API_KEY && c.env.INQUIRY_NOTIFY_TO) {
    c.executionCtx.waitUntil(
      sendInquiryNotification(c.env.RESEND_API_KEY, c.env.INQUIRY_FROM, {
        to: c.env.INQUIRY_NOTIFY_TO,
        name: req.name,
        email: req.email,
        phone: body.phone,
        projectType: body.projectType,
        budgetRange: body.budgetRange,
        message: req.message,
      }).catch((err) =>
        console.error(`notifikasi inquiry gagal dikirim: ${err instanceof Error ? err.message : String(err)}`),
      ),
    );
  }

  return c.json({ data: { id, received: true } }, 201);
});
