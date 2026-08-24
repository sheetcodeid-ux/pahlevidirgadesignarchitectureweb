import { describe, expect, it } from "vitest";
import { isValidSlug, isValidEmail, checkProjectInput, checkInquiry, ValidationError } from "../src/lib/validate";

describe("isValidSlug", () => {
  it("menerima huruf kecil, angka, dan tanda hubung", () => {
    expect(isValidSlug("rumah-tropis-2025")).toBe(true);
  });

  it("menolak string kosong", () => {
    expect(isValidSlug("")).toBe(false);
  });

  it("menolak yang diawali atau diakhiri tanda hubung", () => {
    expect(isValidSlug("-rumah")).toBe(false);
    expect(isValidSlug("rumah-")).toBe(false);
  });

  it("menolak huruf besar dan karakter lain", () => {
    expect(isValidSlug("Rumah Tropis")).toBe(false);
    expect(isValidSlug("rumah_tropis")).toBe(false);
  });

  it("menolak yang lebih dari 120 karakter", () => {
    expect(isValidSlug("a".repeat(121))).toBe(false);
  });
});

describe("isValidEmail", () => {
  it("menerima email wajar", () => {
    expect(isValidEmail("klien@example.com")).toBe(true);
  });

  it("menolak yang tanpa @ atau tanpa domain", () => {
    expect(isValidEmail("bukan-email")).toBe(false);
    expect(isValidEmail("klien@")).toBe(false);
  });
});

describe("checkProjectInput", () => {
  it("menolak proyek baru tanpa slug atau judul", () => {
    expect(() => checkProjectInput({}, true)).toThrow(ValidationError);
  });

  it("menerima update tanpa slug/judul (tidak wajib saat menyunting)", () => {
    expect(() => checkProjectInput({ summary: "ringkasan" }, false)).not.toThrow();
  });

  it("menolak kategori yang tidak dikenal", () => {
    expect(() => checkProjectInput({ slug: "a", title: "b", category: "bukan-kategori" }, true)).toThrow(
      ValidationError,
    );
  });

  it("menolak tahun di luar rentang wajar", () => {
    expect(() => checkProjectInput({ year: 1500 }, false)).toThrow(ValidationError);
    expect(() => checkProjectInput({ year: 2200 }, false)).toThrow(ValidationError);
  });

  it("menerima input yang lengkap dan valid", () => {
    expect(() =>
      checkProjectInput({ slug: "rumah-baru", title: "Rumah Baru", category: "residential", status: "draft", year: 2025 }, true),
    ).not.toThrow();
  });
});

describe("checkInquiry", () => {
  const valid = { name: "Rangga", email: "rangga@example.com", phone: "08123456789", message: "Halo, saya tertarik konsultasi desain rumah." };

  it("menerima input valid", () => {
    expect(() => checkInquiry(valid)).not.toThrow();
  });

  it("menolak nama terlalu pendek", () => {
    expect(() => checkInquiry({ ...valid, name: "A" })).toThrow(ValidationError);
  });

  it("menolak pesan terlalu pendek", () => {
    expect(() => checkInquiry({ ...valid, message: "pendek" })).toThrow(ValidationError);
  });

  it("menolak email tidak valid", () => {
    expect(() => checkInquiry({ ...valid, email: "bukan-email" })).toThrow(ValidationError);
  });

  it("menolak nomor telepon terlalu panjang", () => {
    expect(() => checkInquiry({ ...valid, phone: "0".repeat(33) })).toThrow(ValidationError);
  });
});
