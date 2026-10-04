import {
  VALID_CATEGORIES, VALID_PROJECT_STATUS, VALID_PIPELINE_STAGE, VALID_JOURNAL_CATEGORY,
} from "../types";
import type { ProjectInput, JournalPostInput, ServiceTierInput } from "../types";
import { VALID_TIER_GROUP } from "../types";

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
  for (const [nama, v] of [["tenggat preview", input.deadlinePreview], ["tenggat final", input.deadlineFinal]] as const) {
    if (v !== undefined && v !== null && v !== "" && !/^\d{4}-\d{2}-\d{2}$/.test(v)) {
      throw new ValidationError(`${nama} harus berformat YYYY-MM-DD`);
    }
  }
  if (input.deadlinePreview && input.deadlineFinal && input.deadlineFinal < input.deadlinePreview) {
    throw new ValidationError("tenggat final tidak boleh sebelum tenggat preview");
  }
  if (input.scopeOfWork !== undefined && input.scopeOfWork !== null && input.scopeOfWork.length > 2000) {
    throw new ValidationError("lingkup kerja paling panjang 2000 karakter");
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
  /* Sampul harus di folder jurnal/ — CHECK di database menjaga hal yang sama.
   * Yang di sini ada supaya pesannya jelas, bukan "check violation". */
  if (input.coverKey !== undefined && input.coverKey !== null) {
    if (typeof input.coverKey !== "string" || !/^jurnal\/[A-Za-z0-9._-]+$/.test(input.coverKey)) {
      return "sampul harus berkas yang diunggah ke folder jurnal/";
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

/**
 * Paket layanan. Batas-batasnya sama dengan CHECK di migrasi 20260929000025 —
 * yang di sini ada supaya pesannya menyebut sebabnya, bukan "check violation".
 *
 * `fee` diperiksa berpasangan kalau keduanya dikirim; kalau cuma satu yang
 * berubah, perbandingannya dengan nilai lama dijaga CHECK di database.
 */
export function checkTierInput(input: ServiceTierInput, wajibLengkap: boolean): string | null {
  const ada = (v: unknown) => typeof v === "string" && v.trim().length > 0;
  const teks = (v: unknown, maks: number) => v === undefined || (typeof v === "string" && v.length <= maks);

  if (wajibLengkap || input.group !== undefined) {
    if (!VALID_TIER_GROUP.has(input.group ?? "")) return "kelompok paket harus kafe atau rumah";
  }
  if (wajibLengkap || input.slug !== undefined) {
    if (!ada(input.slug)) return "kode paket wajib diisi";
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(input.slug!) || input.slug!.length > 40) {
      return "kode paket hanya huruf kecil, angka, dan tanda hubung (maks. 40)";
    }
  }
  if (wajibLengkap || input.name !== undefined) {
    if (!ada(input.name)) return "nama paket wajib diisi";
    if (input.name!.trim().length > 60) return "nama paket maksimal 60 karakter";
  }
  if (wajibLengkap || input.feeMin !== undefined) {
    if (!Number.isInteger(input.feeMin) || input.feeMin! < 0) return "fee terendah harus bilangan bulat, dalam juta";
  }
  if (wajibLengkap || input.feeMax !== undefined) {
    if (!Number.isInteger(input.feeMax) || input.feeMax! < 0) return "fee tertinggi harus bilangan bulat, dalam juta";
  }
  if (input.feeMin !== undefined && input.feeMax !== undefined && input.feeMax < input.feeMin) {
    return "fee tertinggi tidak boleh lebih kecil dari fee terendah";
  }
  if (!teks(input.summary, 240)) return "ringkasan maksimal 240 karakter";
  if (!teks(input.forWhom, 160)) return "keterangan 'untuk siapa' maksimal 160 karakter";
  if (!teks(input.includesHeading, 80)) return "judul daftar isi maksimal 80 karakter";
  if (input.includes !== undefined) {
    if (!Array.isArray(input.includes) || input.includes.some((b) => typeof b !== "string")) {
      return "isi paket harus daftar teks";
    }
    if (input.includes.some((b) => b.includes("\n"))) return "satu butir isi paket tidak boleh berisi baris baru";
    if (input.includes.join("\n").length > 2000) return "isi paket terlalu panjang (maks. 2000 karakter)";
  }
  if (input.sortOrder !== undefined && !Number.isInteger(input.sortOrder)) return "urutan harus bilangan bulat";
  if (input.highlighted !== undefined && typeof input.highlighted !== "boolean") return "sorotan harus ya/tidak";
  if (input.active !== undefined && typeof input.active !== "boolean") return "status aktif harus ya/tidak";
  return null;
}
