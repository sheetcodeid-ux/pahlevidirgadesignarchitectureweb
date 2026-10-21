/* Repository pengguna, paket langganan, dan buku log audit — terhadap
   Postgres SUNGGUHAN dengan setelan koneksi produksi (`fetch_types: false`,
   jebakan #16) dan database sendiri (jebakan #64). Dilewati kalau Postgres
   lokal belum dinyalakan (./scripts/rls-lokal.sh). */
import { it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import postgres from "postgres";
import * as akses from "../src/repository/akses";
import { hitungAkses } from "../src/lib/fitur";

const DIR_PG = "/var/lib/postgresql/uji";
const adaPostgres = existsSync(`${DIR_PG}/sock/.s.PGSQL.55432`);

it.skipIf(!adaPostgres)("pengguna, paket, mapping fitur, dan log audit dengan setelan koneksi produksi", { timeout: 60_000 }, async () => {
  const induk = postgres({ host: `${DIR_PG}/sock`, port: 55432, user: "postgres", database: "postgres", max: 1 });
  await induk.unsafe("drop database if exists uji_akses with (force)");
  await induk.unsafe("create database uji_akses");
  await induk.end();

  const sql = postgres({
    host: `${DIR_PG}/sock`, port: 55432, user: "postgres", database: "uji_akses",
    fetch_types: false, prepare: false, max: 1,
  });

  try {
    await sql.unsafe("drop schema if exists public cascade; create schema public;");
    await sql.unsafe("drop schema if exists auth cascade;");
    const baca = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");
    await sql.unsafe(baca("../../../supabase/tests/shim-lokal.sql"));
    await sql.unsafe(baca("../../../supabase/bootstrap.sql"));
    // Dua kolom auth.users dan auth.sessions milik Supabase, tidak ada di shim.
    await sql.unsafe(`
      alter table auth.users add column if not exists last_sign_in_at timestamptz;
      create table auth.sessions (id uuid primary key, user_id uuid not null references auth.users (id) on delete cascade);`);

    const OWNER = "aaaa0000-0000-4000-8000-0000000000a1";
    const KLIEN = "aaaa0000-0000-4000-8000-0000000000c1";
    await sql`insert into auth.users (id, email) values (${OWNER}::uuid, 'owner@contoh.id'), (${KLIEN}::uuid, 'klien@contoh.id')`;
    await sql`insert into public.profiles (id, full_name, role) values (${OWNER}::uuid, 'Dirga', 'admin')`;

    // Isi awal migrasi: tiga paket berurutan.
    const paket = await akses.daftarPaketAkses(sql);
    expect(paket.map((p) => p.slug)).toEqual(["dasar", "studio", "pro"]);
    const dasar = paket[0]!;
    expect(dasar.fitur).toContain("proyek");
    expect(dasar.fitur).not.toContain("gaji");

    // Pelanggan baru di paket Dasar, aktif sampai akhir November.
    await akses.buatProfil(sql, KLIEN, { nama: "Studio Rina", role: "pelanggan", planId: dasar.id, accessUntil: "2026-11-30" });
    let p = await akses.muatAkses(sql, KLIEN);
    expect(p?.accessUntil).toBe("2026-11-30");
    expect(p?.planName).toBe("Dasar");
    expect(hitungAkses(p!, "2026-10-21").fitur).not.toContain("gaji");

    // Satu sel matriks dinyalakan → pelanggan langsung mendapat fiturnya.
    await akses.aturFitur(sql, dasar.id, "gaji", true);
    await akses.aturFitur(sql, dasar.id, "gaji", true); // dua kali tetap satu baris
    p = await akses.muatAkses(sql, KLIEN);
    expect(p?.fiturPaket.filter((f) => f === "gaji")).toHaveLength(1);
    await akses.aturFitur(sql, dasar.id, "gaji", false);
    expect((await akses.muatAkses(sql, KLIEN))?.fiturPaket).not.toContain("gaji");
    await expect(akses.aturFitur(sql, dasar.id, "fitur-palsu", true)).rejects.toThrow();

    // Paket yang dinonaktifkan tidak memberi fitur apa pun.
    await akses.ubahPaketAkses(sql, dasar.id, { isActive: false });
    expect((await akses.muatAkses(sql, KLIEN))?.fiturPaket).toEqual([]);
    await akses.ubahPaketAkses(sql, dasar.id, { isActive: true, priceMonth: 250000 });

    // Paket yang dipakai tidak bisa dihapus; paket baru tanpa pemakai bisa.
    expect(await akses.hapusPaketAkses(sql, dasar.id)).toBe("dipakai");
    const baru = await akses.buatPaketAkses(sql, { name: "Studio" });
    expect((await akses.daftarPaketAkses(sql)).find((x) => x.id === baru)?.slug).toMatch(/^studio-[0-9a-f]{4}$/);
    expect(await akses.hapusPaketAkses(sql, baru)).toBe("terhapus");

    // PATCH hanya kolom yang dikirim.
    await akses.ubahPengguna(sql, KLIEN, { isSuspended: true });
    const daftar = await akses.daftarPengguna(sql);
    const k = daftar.find((u) => u.id === KLIEN)!;
    expect(k.isSuspended).toBe(true);
    expect(k.nama).toBe("Studio Rina");
    expect(k.planName).toBe("Dasar");
    expect(daftar[0]!.role).toBe("admin"); // owner di atas
    expect(await akses.ownerLain(sql, OWNER)).toBe(0);
    await sql`insert into auth.sessions (id, user_id) values (gen_random_uuid(), ${KLIEN}::uuid), (gen_random_uuid(), ${OWNER}::uuid)`;
    await akses.cabutSemuaSesi(sql, KLIEN);
    expect((await sql<{ user_id: string }[]>`select user_id from auth.sessions`).map((r) => r.user_id)).toEqual([OWNER]);

    // Buku log: tertulis dan terbaca terbaru dulu, dengan nama aktornya.
    await akses.catatAudit(sql, { actorId: OWNER, actorEmail: "owner@contoh.id", actorRole: "admin", action: "ubah",
      method: "PATCH", path: `/users/${KLIEN}`, entity: "users", entityId: KLIEN, status: 200,
      detail: { kiriman: { isSuspended: true } } });
    await akses.catatAudit(sql, { actorEmail: "asing@contoh.id", action: "gagal_masuk", status: 401 });
    const log = await akses.daftarAudit(sql, {});
    expect(log.map((l) => l.action)).toEqual(["gagal_masuk", "ubah"]);
    expect(log[1]!.actorNama).toBe("Dirga");
    expect(log[1]!.detail).toEqual({ kiriman: { isSuspended: true } });
    expect((await akses.daftarAudit(sql, { aksi: "ubah" }))).toHaveLength(1);
    expect((await akses.daftarAudit(sql, { sebelum: log[0]!.id }))).toHaveLength(1);
    expect(log[0]!.id).toBeGreaterThan(log[1]!.id);

    // Potret baris untuk "sebelum → sesudah": hanya tabel yang terdaftar.
    const potret = await akses.potretBaris(sql, "profiles", KLIEN) as { full_name: string };
    expect(potret.full_name).toBe("Studio Rina");
    expect(await akses.potretBaris(sql, "pg_authid", KLIEN)).toBeNull();
  } finally {
    await sql.end();
  }
});
