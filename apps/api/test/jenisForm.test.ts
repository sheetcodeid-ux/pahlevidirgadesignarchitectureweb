import { describe, expect, it } from "vitest";
import { jenisDariForm } from "../src/lib/jenisForm";

describe("jenisDariForm", () => {
  it("menerjemahkan label form kontak ke kode kategori", () => {
    expect(jenisDariForm("Rumah")).toBe("residential");
    expect(jenisDariForm("Kafe atau restoran")).toBe("coffeeshop");
    expect(jenisDariForm("Ruang kerja atau kantor")).toBe("commercial");
    expect(jenisDariForm("Ritel")).toBe("commercial");
    expect(jenisDariForm("Renovasi")).toBe("renovation");
  });

  it("tetap menerima kode kategori yang sah", () => {
    expect(jenisDariForm("interior")).toBe("interior");
    expect(jenisDariForm("coffeeshop")).toBe("coffeeshop");
  });

  it("tidak peka huruf besar dan spasi tepi", () => {
    expect(jenisDariForm("  rumah ")).toBe("residential");
  });

  it("Lainnya, kosong, dan yang tak dikenal jadi null", () => {
    expect(jenisDariForm("Lainnya")).toBeNull();
    expect(jenisDariForm("")).toBeNull();
    expect(jenisDariForm(undefined)).toBeNull();
    expect(jenisDariForm("Kastil")).toBeNull();
  });
});
