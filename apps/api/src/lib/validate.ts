import {
  VALID_CATEGORIES, VALID_PROJECT_STATUS, VALID_PIPELINE_STAGE, VALID_JOURNAL_CATEGORY,
} from "../types";
import type { ProjectInput, JournalPostInput } from "../types";

/** Slug hanya huruf kecil, angka, dan tanda hubung — aman dipakai di URL. */
export function isValidSlug(s: string): boolean {
  if (!s || s.length > 120 || s.startsWith("-") || s.endsWith("-")) return false;
  return /^[a-z0-9-]+$/.test(s);
}

export function isValidEmail(s: string): boolean {
  // Pengecekan longgar yang cukup untuk menyaring input jelas keliru — bukan
  // RFC 5322 penuh. Verifikasi sungguhan ada di Supabase Auth / Resend.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

export class ValidationError extends Error {
  status: number;
  constructor(message: string, status = 422) {
    super(message);
    this.status = status;
  }
}

/** Menegakkan aturan yang tidak bisa dijaga tipe data saat membuat/menyunting proyek. */
export function checkProjectInput(input: ProjectInput, isNew: boolean): void {
  if (isNew && (!input.slug || !input.title)) {
    throw new ValidationError("slug dan judul wajib diisi");
  }
  if (input.category !== undefined && !VALID_CATEGORIES.has(input.category)) {
    throw new ValidationError("kategori tidak dikenal");
  }
  if (input.status !== undefined && !VALID_PROJECT_STATUS.has(input.status)) {
    throw new ValidationError("status tidak dikenal");
  }
  if (input.pipelineStage !== undefined && !VALID_PIPELINE_STAGE.has(input.pipelineStage)) {
    throw new ValidationError("tahap pipeline tidak dikenal");
  }
  if (input.slug !== undefined && !isValidSlug(input.slug)) {
    throw new ValidationError("slug hanya boleh huruf kecil, angka, dan tanda hubung");
  }
  if (input.year !== undefined && input.year !== null && (input.year < 1900 || input.year > 2100)) {
    throw new ValidationError("tahun di luar rentang wajar");
  }
  // Panjangnya saja yang diperiksa. Tanda baca TIDAK ditolak di sini —
  // repository yang membuang non-angka, supaya pemilik boleh menempel nomor
  // apa adanya dari kontak ponselnya.
  if (input.clientWhatsapp !== undefined && input.clientWhatsapp !== null) {
    const angka = input.clientWhatsapp.replace(/\D/g, "");
    if (angka.length > 0 && (angka.length < 8 || angka.length > 15)) {
      throw new ValidationError("nomor WhatsApp harus 8-15 angka");
    }
  }
}

export interface InquiryRequest {
  name: string;
  email: string;
  phone: string;
  message: string;
}

/** Memangkas whitespace dan menegakkan batas panjang seperti versi Go. */
export function checkInquiry(req: InquiryRequest): void {
  if (req.name.length < 2 || req.name.length > 120) {
    throw new ValidationError("nama harus 2-120 karakter");
  }
  if (req.message.length < 10 || req.message.length > 5000) {
    throw new ValidationError("pesan harus 10-5000 karakter");
  }
  if (req.phone.length > 32) {
    throw new ValidationError("nomor telepon terlalu panjang");
  }
  if (!isValidEmail(req.email)) {
    throw new ValidationError("format email tidak valid");
  }
}

/* Aturan isian dipusatkan di sini supaya create dan update tidak menyimpang.
 * Database sudah memaksakan hal yang sama lewat CHECK — ini lapisan yang
 * memberi PESAN yang bisa dibaca, bukan pengganti penjagaan di database. */
export function checkJournalInput(
  input: JournalPostInput,
  wajibLengkap: boolean,
): string | null {
  const ada = (v: unknown) => typeof v === "string" && v.trim().length > 0;

  if (wajibLengkap || input.slug !== undefined) {
    if (!ada(input.slug)) return "slug wajib diisi";
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(input.slug!)) {
      return "slug hanya boleh huruf kecil, angka, dan tanda hubung";
    }
    if (input.slug!.length < 3 || input.slug!.length > 120) return "panjang slug 3–120 karakter";
  }
  if (wajibLengkap || input.title !== undefined) {
    if (!ada(input.title)) return "judul wajib diisi";
    if (input.title!.trim().length > 200) return "judul maksimal 200 karakter";
  }
  if (wajibLengkap || input.excerpt !== undefined) {
    if (!ada(input.excerpt)) return "kalimat pembuka wajib diisi";
    const n = input.excerpt!.trim().length;
    if (n < 10 || n > 600) return "panjang kalimat pembuka 10–600 karakter";
  }
  if (input.category !== undefined && !VALID_JOURNAL_CATEGORY.has(input.category)) {
    return "kategori tulisan tidak dikenal";
  }
  if (input.readMinutes !== undefined) {
    if (!Number.isInteger(input.readMinutes) || input.readMinutes < 1 || input.readMinutes > 90) {
      return "lama baca 1–90 menit";
    }
  }
  /* Menerbitkan yang kosong ditolak di sini DAN oleh CHECK di database. Yang
   * di sini ada supaya pesannya menyebut sebabnya, bukan "check violation". */
  if (input.publishedAt) {
    const isi = (input.body ?? "").trim();
    if (isi.length < 200) return "tulisan yang diterbitkan harus punya isi minimal 200 karakter";
    if (Number.isNaN(Date.parse(input.publishedAt))) return "tanggal terbit tidak sah";
  }
  return null;
}
