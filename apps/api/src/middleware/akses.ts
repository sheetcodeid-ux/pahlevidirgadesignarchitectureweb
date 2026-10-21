import type { MiddlewareHandler } from "hono";
import type { Env } from "../types";
import { withDb } from "../db";
import { muatAkses, type BarisAkses } from "../repository/akses";
import { bolehRute, hitungAkses, type Akses } from "../lib/fitur";

export type VarsAkses = {
  userID: string;
  userEmail?: string;
  accessToken: string;
  sessionID?: string;
  akses: Akses;
  profilAkses: BarisAkses;
};

const PESAN: Record<string, string> = {
  pemilik: "halaman ini khusus pemilik aplikasi",
  fitur: "fitur ini tidak termasuk paket langganan Anda",
  langganan: "masa langganan Anda sudah berakhir",
  nonaktif: "akun ini dinonaktifkan",
};

/**
 * Pengganti requireStaff untuk panel: SATU kueri memuat peran, langganan,
 * dan fitur paket, lalu memutuskan permintaan ini boleh atau tidak.
 *
 * Gagal-tertutup seperti pendahulunya: tanpa profil = 403, rute yang tidak
 * terdaftar di ATURAN_RUTE = 403 untuk pelanggan. Penjagaan di panel cuma
 * menyembunyikan menu — yang menolak sungguhan di sini.
 *
 * Pelanggan ditolak seluruhnya selama PELANGGAN_DIIZINKAN bukan "1": di
 * tahap 1 datanya masih satu studio, jadi pelanggan yang masuk akan melihat
 * proyek dan keuangan studio pemilik.
 */
export function requireAkses(): MiddlewareHandler<{ Bindings: Env; Variables: VarsAkses }> {
  return async (c, next) => {
    const userID = c.get("userID");
    if (!userID) return c.json({ error: { status: 401, message: "token tidak ada" } }, 401);

    const p = await withDb(c.env, c.executionCtx, (sql) => muatAkses(sql, userID));
    if (!p) return c.json({ error: { status: 403, message: "akun ini tidak berhak mengelola konten" } }, 403);

    if (p.role === "pelanggan" && c.env.PELANGGAN_DIIZINKAN !== "1") {
      return c.json({ error: { status: 403, message: "akun pelanggan belum bisa masuk — pemisahan data per studio belum selesai", kode: "pelanggan_ditahan" } }, 403);
    }

    const akses = hitungAkses(p);
    const jalur = new URL(c.req.url).pathname.replace(/^\/api\/v1\/admin/, "") || "/";
    const putusan = bolehRute(akses, c.req.method, jalur);
    if (!putusan.boleh) {
      return c.json({ error: { status: 403, message: PESAN[putusan.alasan], kode: putusan.alasan } }, 403);
    }

    c.set("akses", akses);
    c.set("profilAkses", p);
    await next();
  };
}
