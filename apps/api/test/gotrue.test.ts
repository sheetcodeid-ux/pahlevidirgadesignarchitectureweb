import { afterEach, describe, expect, it, vi } from "vitest";
import { cabutSesi, gantiSandi, periksaSandi, pesanGalatSandi, tukarToken } from "../src/lib/gotrue";
import type { Env } from "../src/types";

const env = { SUPABASE_URL: "https://x.supabase.co/", SUPABASE_ANON_KEY: "anon" } as Env;

afterEach(() => vi.unstubAllGlobals());

/** fetch tiruan yang mencatat permintaannya. */
function pasangFetch(status: number, badan: unknown = {}) {
  const panggilan: { url: string; init: RequestInit }[] = [];
  vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
    panggilan.push({ url, init });
    return new Response(status === 204 ? null : JSON.stringify(badan), { status });
  });
  return panggilan;
}

describe("periksaSandi — cermin aturan Supabase proyek ini", () => {
  it("menerima 12 karakter dengan keempat jenis", () => {
    expect(periksaSandi("Arsitek-2026")).toBeNull();
  });

  it("menyebut SEMUA yang kurang, bukan cuma yang pertama", () => {
    expect(periksaSandi("abc")).toBe("kata sandi belum memenuhi: minimal 12 karakter, huruf besar, angka, simbol");
  });

  it("menolak 8–11 karakter yang dulu lolos dari batas lama", () => {
    expect(periksaSandi("Arsi-2026")).toMatch(/minimal 12 karakter/);
  });

  it("menolak lebih dari 72 karakter (batas bcrypt GoTrue)", () => {
    expect(periksaSandi(`Aa1!${"x".repeat(70)}`)).toBe("kata sandi maksimal 72 karakter");
  });
});

describe("pesanGalatSandi", () => {
  it("menerjemahkan error_code GoTrue jadi kalimat yang bisa ditindaklanjuti", () => {
    expect(pesanGalatSandi({ error_code: "same_password" })).toBe("kata sandi baru sama dengan yang sekarang");
    expect(pesanGalatSandi({ error_code: "weak_password", weak_password: { reasons: ["pwned"] } })).toMatch(/bocor/);
    expect(pesanGalatSandi({ error_code: "weak_password", weak_password: { reasons: ["length"] } })).toMatch(/panjang/);
    expect(pesanGalatSandi({ error_code: "reauthentication_needed" })).toMatch(/masuk lagi/);
  });

  it("jatuh ke kalimat umum untuk yang tidak dikenal, termasuk badan kosong", () => {
    expect(pesanGalatSandi(null)).toBe("gagal mengubah kata sandi");
    expect(pesanGalatSandi({ error_code: "lain" })).toBe("gagal mengubah kata sandi");
  });
});

describe("panggilan ke GoTrue", () => {
  it("tukarToken meneruskan User-Agent peramban supaya sesinya bernama", async () => {
    const p = pasangFetch(200, { access_token: "a", refresh_token: "r", expires_in: 3600, user: { id: "u", email: "e" } });
    await tukarToken(env, "password", { email: "e", password: "p" }, "Mozilla/5.0 (Macintosh)");
    expect(p[0]!.url).toBe("https://x.supabase.co/auth/v1/token?grant_type=password");
    expect((p[0]!.init.headers as Record<string, string>)["User-Agent"]).toBe("Mozilla/5.0 (Macintosh)");
  });

  it("tukarToken tanpa User-Agent tidak mengirim header kosong", async () => {
    const p = pasangFetch(200, { access_token: "a", refresh_token: "r", expires_in: 3600, user: { id: "u", email: "e" } });
    await tukarToken(env, "refresh_token", { refresh_token: "r" });
    expect("User-Agent" in (p[0]!.init.headers as Record<string, string>)).toBe(false);
  });

  it("tukarToken yang ditolak melempar galat", async () => {
    pasangFetch(400, { error_code: "invalid_credentials" });
    await expect(tukarToken(env, "password", { email: "e", password: "salah" })).rejects.toThrow();
  });

  it("cabutSesi memakai token pemanggil dan scope yang diminta; 404 dianggap sudah keluar", async () => {
    const p = pasangFetch(204);
    expect(await cabutSesi(env, "tok", "others")).toBe(true);
    expect(p[0]!.url).toBe("https://x.supabase.co/auth/v1/logout?scope=others");
    expect((p[0]!.init.headers as Record<string, string>).Authorization).toBe("Bearer tok");
    pasangFetch(404);
    expect(await cabutSesi(env, "tok", "local")).toBe(true);
    pasangFetch(500);
    expect(await cabutSesi(env, "tok", "local")).toBe(false);
  });

  it("gantiSandi mengembalikan null kalau berhasil, kalimat galat kalau ditolak", async () => {
    pasangFetch(200, {});
    expect(await gantiSandi(env, "tok", "Arsitek-2026")).toBeNull();
    pasangFetch(422, { error_code: "same_password" });
    expect(await gantiSandi(env, "tok", "Arsitek-2026")).toBe("kata sandi baru sama dengan yang sekarang");
  });
});
