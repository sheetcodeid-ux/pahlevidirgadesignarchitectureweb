import { describe, expect, it } from "vitest";
import { checkJournalInput } from "../src/lib/validate";
import type { JournalPostInput } from "../src/types";

/** Tulisan lengkap yang sah — dipakai sebagai titik awal tiap kasus. */
const sah = (): JournalPostInput => ({
  slug: "sembilan-pertanyaan-tapak",
  title: "Sembilan pertanyaan sebelum membeli tanah",
  excerpt: "Orientasi, akses, air, dan tembok tetangga menentukan lebih banyak daripada gambar.",
  body: "x".repeat(250),
  category: "site",
  readMinutes: 6,
});

describe("checkJournalInput — membuat tulisan baru", () => {
  it("menerima tulisan yang lengkap", () => {
    expect(checkJournalInput(sah(), true)).toBeNull();
  });

  it("menolak tanpa slug", () => {
    expect(checkJournalInput({ ...sah(), slug: undefined }, true)).toMatch(/slug wajib/);
  });

  it("menolak slug berspasi — ia dipakai langsung di URL", () => {
    expect(checkJournalInput({ ...sah(), slug: "dengan spasi" }, true)).toMatch(/huruf kecil/);
  });

  it("menolak slug berhuruf besar", () => {
    expect(checkJournalInput({ ...sah(), slug: "Judul-Besar" }, true)).toMatch(/huruf kecil/);
  });

  it("menolak slug berujung tanda hubung", () => {
    expect(checkJournalInput({ ...sah(), slug: "tapak-" }, true)).toMatch(/huruf kecil/);
  });

  it("menolak kalimat pembuka yang terlalu pendek", () => {
    expect(checkJournalInput({ ...sah(), excerpt: "pendek" }, true)).toMatch(/10–600/);
  });

  it("menolak kategori yang tidak dikenal", () => {
    expect(checkJournalInput({ ...sah(), category: "cuaca" as never }, true))
      .toMatch(/kategori tulisan/);
  });

  it("menolak lama baca di luar 1–90 menit", () => {
    expect(checkJournalInput({ ...sah(), readMinutes: 0 }, true)).toMatch(/1–90/);
    expect(checkJournalInput({ ...sah(), readMinutes: 91 }, true)).toMatch(/1–90/);
    expect(checkJournalInput({ ...sah(), readMinutes: 6.5 }, true)).toMatch(/1–90/);
  });
});

describe("checkJournalInput — menyunting sebagian", () => {
  it("menerima patch kosong: yang tidak disebut memang tidak diubah", () => {
    expect(checkJournalInput({}, false)).toBeNull();
  });

  it("menerima patch satu medan saja", () => {
    expect(checkJournalInput({ readMinutes: 8 }, false)).toBeNull();
  });

  it("tetap memeriksa medan yang DISEBUT walau patch sebagian", () => {
    expect(checkJournalInput({ slug: "Salah Besar" }, false)).toMatch(/huruf kecil/);
  });
});

describe("checkJournalInput — menerbitkan", () => {
  /* Satu klik "terbitkan" pada draf kosong menayangkan halaman kosong yang
     langsung terindeks mesin pencari. Dijaga di sini DAN oleh CHECK di
     database; yang di sini memberi pesan yang bisa dibaca. */
  it("menolak menerbitkan tulisan tanpa isi", () => {
    expect(checkJournalInput({ ...sah(), body: null, publishedAt: "2026-09-09T00:00:00Z" }, true))
      .toMatch(/minimal 200 karakter/);
  });

  it("menolak menerbitkan tulisan yang isinya terlalu pendek", () => {
    expect(checkJournalInput({ ...sah(), body: "x".repeat(199), publishedAt: "2026-09-09T00:00:00Z" }, true))
      .toMatch(/minimal 200 karakter/);
  });

  it("menerima menerbitkan tulisan yang isinya cukup", () => {
    expect(checkJournalInput({ ...sah(), publishedAt: "2026-09-09T00:00:00Z" }, true)).toBeNull();
  });

  it("menolak tanggal terbit yang tidak sah", () => {
    expect(checkJournalInput({ ...sah(), publishedAt: "kemarin" }, true)).toMatch(/tidak sah/);
  });

  /* null pada publishedAt BERARTI sesuatu: kembalikan tulisan jadi rencana.
     Ia tidak boleh ikut kena syarat "harus berisi". */
  it("mengembalikan tulisan jadi rencana tidak menuntut isi", () => {
    expect(checkJournalInput({ publishedAt: null }, false)).toBeNull();
  });
});
