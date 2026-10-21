/* Aturan akses (lib/fitur.ts) — siapa boleh memanggil rute apa. Inilah yang
   menolak sungguhan; menu yang disembunyikan panel cuma tampilan. */
import { describe, it, expect } from "vitest";
import { bolehRute, hitungAkses, hariIniWIB, FITUR_PAKET, ATURAN_RUTE } from "../src/lib/fitur";
import { bersihkan, uraiRute } from "../src/middleware/audit";

const HARI = "2026-10-21";
const pelanggan = (fiturPaket: string[], accessUntil: string | null = "2026-11-30", isSuspended = false) =>
  hitungAkses({ role: "pelanggan", isSuspended, accessUntil, fiturPaket }, HARI);

describe("hitungAkses", () => {
  it("owner mendapat semua kunci, staf semua kecuali milik pemilik", () => {
    const owner = hitungAkses({ role: "admin", isSuspended: false, accessUntil: null, fiturPaket: [] }, HARI);
    expect(owner.status).toBe("pemilik");
    expect(owner.fitur).toEqual(expect.arrayContaining([...FITUR_PAKET, "pengguna", "info-studio", "akun"]));
    const staf = hitungAkses({ role: "editor", isSuspended: false, accessUntil: null, fiturPaket: [] }, HARI);
    expect(staf.status).toBe("staf");
    expect(staf.fitur).toEqual(expect.arrayContaining([...FITUR_PAKET]));
    expect(staf.fitur).not.toContain("pengguna");
  });

  it("pelanggan: hanya fitur paket + yang selalu ada, selama masa aktif", () => {
    const a = pelanggan(["proyek", "tugas", "fitur-palsu"]);
    expect(a.status).toBe("aktif");
    expect(a.fitur.sort()).toEqual(["akun", "notifikasi", "panduan", "proyek", "tugas"]);
  });

  it("masa aktif inklusif: hari terakhir masih aktif, sehari sesudahnya habis", () => {
    expect(pelanggan(["proyek"], HARI).status).toBe("aktif");
    expect(pelanggan(["proyek"], "2026-10-20").status).toBe("habis");
    expect(pelanggan(["proyek"], "2026-10-20").fitur).not.toContain("proyek");
    expect(pelanggan(["proyek"], null).status).toBe("belum");
  });

  it("akun dinonaktifkan tidak punya fitur sama sekali, apa pun perannya", () => {
    expect(pelanggan(["proyek"], "2027-01-01", true).fitur).toEqual([]);
    expect(hitungAkses({ role: "admin", isSuspended: true, accessUntil: null, fiturPaket: [] }, HARI).status).toBe("nonaktif");
  });

  it("hari dihitung menurut WIB, bukan UTC", () => {
    // 21 Okt 20.00 UTC = 22 Okt 03.00 WIB.
    expect(hariIniWIB(new Date("2026-10-21T20:00:00Z"))).toBe("2026-10-22");
  });
});

describe("bolehRute", () => {
  const owner = hitungAkses({ role: "admin", isSuspended: false, accessUntil: null, fiturPaket: [] }, HARI);
  const staf = hitungAkses({ role: "editor", isSuspended: false, accessUntil: null, fiturPaket: [] }, HARI);

  it("pengaturan aplikasi khusus owner — staf pun ditolak", () => {
    for (const j of ["/users", "/users/x", "/access-plans", "/audit"]) {
      expect(bolehRute(owner, "GET", j).boleh).toBe(true);
      expect(bolehRute(staf, "GET", j)).toEqual({ boleh: false, alasan: "pemilik" });
    }
  });

  it("staf studio tetap boleh semua yang dulu boleh (Terbitkan, pengaturan studio)", () => {
    expect(bolehRute(staf, "POST", "/publish").boleh).toBe(true);
    expect(bolehRute(staf, "PATCH", "/settings").boleh).toBe(true);
    expect(bolehRute(staf, "DELETE", "/invoices/x").boleh).toBe(true);
  });

  it("pelanggan dengan paket Dasar: proyek boleh, keuangan dan gaji tidak", () => {
    const a = pelanggan(["dashboard", "proyek", "tugas"]);
    expect(bolehRute(a, "GET", "/projects").boleh).toBe(true);
    expect(bolehRute(a, "PATCH", "/projects/abc").boleh).toBe(true);
    expect(bolehRute(a, "GET", "/projects/abc/tasks").boleh).toBe(true);
    expect(bolehRute(a, "POST", "/projects/abc/invoices")).toEqual({ boleh: false, alasan: "fitur" });
    expect(bolehRute(a, "GET", "/payroll/month")).toEqual({ boleh: false, alasan: "fitur" });
    expect(bolehRute(a, "GET", "/kpi")).toEqual({ boleh: false, alasan: "fitur" });
  });

  it("rute khusus menang atas rute umum: tagihan proyek butuh fitur tagihan, bukan proyek", () => {
    const hanyaProyek = pelanggan(["proyek"]);
    expect(bolehRute(hanyaProyek, "GET", "/projects/abc/invoices").boleh).toBe(true); // membaca: proyek menampilkannya
    expect(bolehRute(hanyaProyek, "PATCH", "/projects/abc/invoices").boleh).toBe(false);
    expect(bolehRute(pelanggan(["tagihan"]), "POST", "/projects/abc/invoices").boleh).toBe(true);
  });

  it("pelanggan tidak pernah menyentuh situs studio pemilik maupun pengaturan aplikasi", () => {
    const pro = pelanggan([...FITUR_PAKET]);
    for (const [m, j] of [["POST", "/publish"], ["PATCH", "/settings"], ["GET", "/journal"], ["GET", "/users"], ["POST", "/tiers"]] as const) {
      expect(bolehRute(pro, m, j)).toEqual({ boleh: false, alasan: "pemilik" });
    }
    expect(bolehRute(pro, "GET", "/settings").boleh).toBe(true); // nama studio dibaca semua halaman
  });

  it("rute yang tidak terdaftar ditolak untuk pelanggan (gagal-tertutup)", () => {
    expect(bolehRute(pelanggan([...FITUR_PAKET]), "GET", "/rute-baru-yang-lupa-didaftar")).toEqual({ boleh: false, alasan: "fitur" });
  });

  it("langganan habis: hanya /me dan /account yang tetap terbuka", () => {
    const habis = pelanggan(["proyek"], "2026-01-01");
    expect(bolehRute(habis, "GET", "/me").boleh).toBe(true);
    expect(bolehRute(habis, "POST", "/account/logout").boleh).toBe(true);
    expect(bolehRute(habis, "GET", "/projects")).toEqual({ boleh: false, alasan: "langganan" });
  });

  it("akun nonaktif ditolak bahkan untuk /me", () => {
    expect(bolehRute(pelanggan(["proyek"], "2027-01-01", true), "GET", "/me")).toEqual({ boleh: false, alasan: "nonaktif" });
  });

  it("setiap kunci di ATURAN_RUTE adalah fitur paket yang sah", () => {
    for (const a of ATURAN_RUTE) {
      for (const d of [a.baca, a.tulis]) {
        if (typeof d === "string") continue;
        for (const f of d) expect(f === "*" || (FITUR_PAKET as readonly string[]).includes(f)).toBe(true);
      }
    }
  });
});

describe("buku log audit", () => {
  it("kunci rahasia dibuang dari kiriman, di kedalaman mana pun", () => {
    expect(bersihkan({ email: "a@b.c", password: "Rahasia123!", lapis: { refreshToken: "x", nama: "Dirga" } })).toEqual({
      email: "a@b.c", password: "[disembunyikan]", lapis: { refreshToken: "[disembunyikan]", nama: "Dirga" },
    });
  });

  it("aksi dan entitas dibaca dari rute", () => {
    expect(uraiRute("PATCH", "/invoices/i1")).toEqual({ action: "ubah", entity: "invoices", entityId: "i1" });
    expect(uraiRute("POST", "/projects/p1/invoices")).toEqual({ action: "buat", entity: "invoices", entityId: "p1" });
    expect(uraiRute("DELETE", "/projects/p1/payments/b2")).toEqual({ action: "hapus", entity: "payments", entityId: "b2" });
    expect(uraiRute("POST", "/account/logout").action).toBe("keluar");
    expect(uraiRute("PATCH", "/projects/p1")).toEqual({ action: "ubah", entity: "projects", entityId: "p1" });
  });
});
