import { describe, expect, it } from "vitest";
import { hashIP } from "../src/lib/ipHash";

describe("hashIP", () => {
  it("mengembalikan string kosong tanpa salt", async () => {
    expect(await hashIP("1.2.3.4", undefined)).toBe("");
  });

  it("mengembalikan string kosong tanpa IP", async () => {
    expect(await hashIP("", "salt-rahasia")).toBe("");
  });

  it("menghasilkan hash hex 64 karakter (SHA-256) yang konsisten untuk input sama", async () => {
    const a = await hashIP("1.2.3.4", "salt-rahasia");
    const b = await hashIP("1.2.3.4", "salt-rahasia");
    expect(a).toHaveLength(64);
    expect(a).toBe(b);
  });

  it("menghasilkan hash berbeda untuk salt berbeda — tidak bisa dibalik tanpa tahu salt-nya", async () => {
    const a = await hashIP("1.2.3.4", "salt-satu");
    const b = await hashIP("1.2.3.4", "salt-dua");
    expect(a).not.toBe(b);
  });
});
