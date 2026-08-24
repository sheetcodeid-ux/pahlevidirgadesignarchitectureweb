import { describe, expect, it } from "vitest";
import { sanitizeSlug } from "../src/lib/r2";

describe("sanitizeSlug", () => {
  it("mengubah huruf besar jadi kecil", () => {
    expect(sanitizeSlug("Rumah-Tropis")).toBe("rumah-tropis");
  });

  it("mengganti karakter tak dikenal dengan tanda hubung", () => {
    expect(sanitizeSlug("rumah tropis!")).toBe("rumah-tropis");
  });

  it("memangkas tanda hubung di awal/akhir", () => {
    expect(sanitizeSlug("--rumah--")).toBe("rumah");
  });

  it("mengembalikan 'untitled' kalau hasilnya kosong", () => {
    expect(sanitizeSlug("!!!")).toBe("untitled");
  });

  it("memotong sampai 80 karakter", () => {
    expect(sanitizeSlug("a".repeat(200)).length).toBe(80);
  });
});
