import { describe, expect, it } from "vitest";
import { checkTierInput } from "../src/lib/validate";
import type { ServiceTierInput } from "../src/types";

/** Paket lengkap yang sah — titik awal tiap kasus. */
const sah = (): ServiceTierInput => ({
  group: "kafe",
  slug: "starter",
  name: "Starter",
  summary: "Untuk coffee shop pertama.",
  feeMin: 15,
  feeMax: 25,
  forWhom: "Coffee shop pertama",
  includesHeading: "Yang Anda dapat",
  includes: ["Konsep desain", "Denah dan tata ruang"],
});

describe("checkTierInput — paket baru", () => {
  it("menerima paket yang lengkap", () => {
    expect(checkTierInput(sah(), true)).toBeNull();
  });
  it("menolak kelompok di luar kafe/rumah", () => {
    expect(checkTierInput({ ...sah(), group: "kantor" }, true)).toMatch(/kafe atau rumah/);
  });
  it("menolak kode paket berspasi", () => {
    expect(checkTierInput({ ...sah(), slug: "paket baru" }, true)).toMatch(/huruf kecil/);
  });
  it("menolak nama kosong", () => {
    expect(checkTierInput({ ...sah(), name: "   " }, true)).toMatch(/nama paket wajib/);
  });
  it("menolak fee pecahan — satuannya juta, bilangan bulat", () => {
    expect(checkTierInput({ ...sah(), feeMin: 12.5 }, true)).toMatch(/bilangan bulat/);
  });
  it("menolak batas atas di bawah batas bawah", () => {
    expect(checkTierInput({ ...sah(), feeMin: 50, feeMax: 20 }, true)).toMatch(/tidak boleh lebih kecil/);
  });
  it("menolak butir isi yang memuat baris baru — disimpan satu butir per baris", () => {
    expect(checkTierInput({ ...sah(), includes: ["dua\nbaris"] }, true)).toMatch(/baris baru/);
  });
  it("menolak isi yang bukan daftar teks", () => {
    expect(checkTierInput({ ...sah(), includes: "Konsep" as unknown as string[] }, true)).toMatch(/daftar teks/);
  });
});

describe("checkTierInput — mengubah sebagian", () => {
  it("menerima perubahan satu kolom saja", () => {
    expect(checkTierInput({ feeMax: 30 }, false)).toBeNull();
  });
  it("menerima menonaktifkan paket", () => {
    expect(checkTierInput({ active: false }, false)).toBeNull();
  });
  it("menolak status aktif yang bukan ya/tidak", () => {
    expect(checkTierInput({ active: "tidak" as unknown as boolean }, false)).toMatch(/ya\/tidak/);
  });
});
