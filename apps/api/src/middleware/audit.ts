import type { MiddlewareHandler } from "hono";
import type { Env } from "../types";
import { withDb } from "../db";
import { catatAudit, potretBaris, TABEL_RUTE, type EntriAudit } from "../repository/akses";
import { hashIP } from "../lib/ipHash";
import type { VarsAkses } from "./akses";

/* =============================================================================
   Buku log audit: setiap permintaan yang MENGUBAH data (POST/PATCH/PUT/DELETE)
   dicatat — siapa, kapan, rute, status, isi kiriman, dan untuk rute yang
   tabelnya dikenal (TABEL_RUTE), potret baris SEBELUM dan SESUDAH.

   Dua aturan:
   - Pencatatan tidak boleh menggagalkan permintaannya. Kalau log gagal
     ditulis, perubahan pemakai tetap jalan; galatnya cuma ke konsol Worker.
   - Rahasia tidak pernah masuk log: kunci yang terdengar seperti kata sandi
     atau token dibuang dari kiriman SEBELUM disimpan.
   ============================================================================= */

const RAHASIA = /(password|sandi|token|secret|rahasia|apikey)/i;

export function bersihkan(v: unknown, dalam = 0): unknown {
  if (dalam > 6) return "…";
  if (Array.isArray(v)) return v.slice(0, 50).map((x) => bersihkan(x, dalam + 1));
  if (v && typeof v === "object") {
    const hasil: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
      hasil[k] = RAHASIA.test(k) ? "[disembunyikan]" : bersihkan(x, dalam + 1);
    }
    return hasil;
  }
  if (typeof v === "string" && v.length > 2000) return `${v.slice(0, 2000)}…`;
  return v;
}

/** Aksi + entitas dari metode dan jalur relatif /api/v1/admin. */
export function uraiRute(metode: string, jalur: string): Pick<EntriAudit, "action" | "entity" | "entityId"> {
  const bagian = jalur.split("/").filter(Boolean);
  const action: EntriAudit["action"] =
    jalur === "/account/logout" ? "keluar" : metode === "DELETE" ? "hapus" : metode === "POST" ? "buat" : "ubah";
  // /projects/:id/invoices → entitas "invoices" milik proyek :id; /tasks/:id → "tasks" :id
  if (bagian.length >= 3 && bagian[0] === "projects") return { action, entity: bagian[2], entityId: bagian[3] ?? bagian[1] };
  return { action, entity: bagian[0] ?? null, entityId: bagian[1] ?? null };
}

export function catatPerubahan(): MiddlewareHandler<{ Bindings: Env; Variables: VarsAkses }> {
  return async (c, next) => {
    const metode = c.req.method;
    if (metode === "GET" || metode === "HEAD" || metode === "OPTIONS") return next();

    const jalur = new URL(c.req.url).pathname.replace(/^\/api\/v1\/admin/, "") || "/";
    const { action, entity, entityId } = uraiRute(metode, jalur);
    const tabel = entity ? TABEL_RUTE[entity] : undefined;
    const bisaDipotret = Boolean(tabel && entityId && metode !== "POST");

    let kiriman: unknown = null;
    try {
      const teks = await c.req.raw.clone().text();
      kiriman = teks ? bersihkan(JSON.parse(teks)) : null;
    } catch {
      kiriman = null;
    }

    let sebelum: unknown = null;
    if (bisaDipotret) {
      sebelum = await withDb(c.env, c.executionCtx, (sql) => potretBaris(sql, tabel!, entityId!)).catch(() => null);
    }

    await next();

    try {
      const status = c.res.status;
      let sesudah: unknown = null;
      if (bisaDipotret && metode !== "DELETE" && status < 400) {
        sesudah = await withDb(c.env, c.executionCtx, (sql) => potretBaris(sql, tabel!, entityId!)).catch(() => null);
      }
      const p = c.get("profilAkses");
      const ip = c.req.header("CF-Connecting-IP") ?? "";
      await withDb(c.env, c.executionCtx, async (sql) =>
        catatAudit(sql, {
          actorId: c.get("userID") ?? null,
          actorEmail: c.get("userEmail") ?? null,
          actorRole: p?.role ?? null,
          action: status === 403 ? "ditolak" : action,
          method: metode,
          path: jalur,
          entity,
          entityId,
          status,
          detail: { kiriman, sebelum: bersihkan(sebelum), sesudah: bersihkan(sesudah) },
          ipHash: await hashIP(ip, c.env.IP_HASH_SALT),
          userAgent: c.req.header("User-Agent") ?? null,
        }),
      );
    } catch (e) {
      console.error("audit gagal dicatat", (e as Error).message);
    }
  };
}
