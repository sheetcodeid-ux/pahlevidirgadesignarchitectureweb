/* Repository tugas (halaman Tugas = Rak Baki Gambar) — diuji terhadap
   Postgres SUNGGUHAN dengan setelan koneksi yang SAMA PERSIS dengan
   src/db.ts (`fetch_types: false`, jebakan #16).

   Yang dijaga: daftar tugas membawa `createdAt`/`updatedAt` (riwayat di
   Lembar Disposisi dan hitungan "selesai 7 hari terakhir"), `updatedAt`
   bergeser saat statusnya diubah, dan tugas tanpa tenggat tetap di
   BELAKANG. Dilewati kalau Postgres lokal belum dinyalakan
   (./scripts/rls-lokal.sh). */
import { it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import postgres from "postgres";
import * as tasks from "../src/repository/tasks";
import * as team from "../src/repository/team";

const DIR_PG = "/var/lib/postgresql/uji";
const adaPostgres = existsSync(`${DIR_PG}/sock/.s.PGSQL.55432`);

it.skipIf(!adaPostgres)("tugas membawa waktu dibuat & diubah dengan setelan koneksi produksi", { timeout: 60_000 }, async () => {
  /* Database SENDIRI (jebakan #64): tes repository lain membangun ulang
     skema di database mereka masing-masing secara paralel. */
  const induk = postgres({ host: `${DIR_PG}/sock`, port: 55432, user: "postgres", database: "postgres", max: 1 });
  await induk.unsafe("drop database if exists uji_tugas with (force)");
  await induk.unsafe("create database uji_tugas");
  await induk.end();

  const sql = postgres({
    host: `${DIR_PG}/sock`, port: 55432, user: "postgres", database: "uji_tugas",
    fetch_types: false, prepare: false, max: 1,
  });

  try {
    await sql.unsafe("drop schema if exists public cascade; create schema public;");
    await sql.unsafe("drop schema if exists auth cascade;");
    const baca = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");
    await sql.unsafe(baca("../../../supabase/tests/shim-lokal.sql"));
    await sql.unsafe(baca("../../../supabase/bootstrap.sql"));

    const [kopi] = await sql<{ id: string }[]>`
      insert into public.projects (slug, title, category, contract_value)
      values ('kopi-senja', 'Kopi Senja', 'coffeeshop', 60000000) returning id`;
    const sari = await team.create(sql, { name: "Sari", kind: "inti" });

    const denah = await tasks.create(sql, kopi.id, {
      title: "Denah lantai 2", stage: "desain_1", assigneeId: sari, dueDate: "2026-10-12",
    });
    const rab = await tasks.create(sql, kopi.id, { title: "RAB", stage: "desain_2" });

    const semua = await tasks.listAll(sql);
    expect(semua.map((t) => t.title)).toEqual(["Denah lantai 2", "RAB"]); // tanpa tenggat di belakang
    const d = semua.find((t) => t.id === denah)!;
    expect(d.projectTitle).toBe("Kopi Senja");
    expect(d.assigneeName).toBe("Sari");
    expect(d.stage).toBe("desain_1");
    expect(d.status).toBe("belum_mulai");
    expect(Number.isNaN(Date.parse(String(d.createdAt)))).toBe(false);
    expect(Number.isNaN(Date.parse(String(d.updatedAt)))).toBe(false);

    /* updated_at digeser trigger saat status diubah — itu yang dibaca
       baki arsip "selesai 7 hari terakhir". */
    /* Trigger yang sama akan menimpa nilai yang dimundurkan, jadi ia
       dimatikan sesaat hanya untuk menyiapkan keadaan "diubah 3 hari lalu". */
    await sql.unsafe("alter table public.project_tasks disable trigger project_tasks_touch_updated_at");
    await sql`update public.project_tasks set updated_at = now() - interval '3 days' where id = ${rab}::uuid`;
    await sql.unsafe("alter table public.project_tasks enable trigger project_tasks_touch_updated_at");
    const sebelum = (await tasks.listAll(sql)).find((t) => t.id === rab)!;
    await tasks.update(sql, rab, { status: "selesai" });
    const sesudah = (await tasks.listAll(sql)).find((t) => t.id === rab)!;
    expect(sesudah.status).toBe("selesai");
    expect(Date.parse(String(sesudah.updatedAt))).toBeGreaterThan(Date.parse(String(sebelum.updatedAt)));

    const perProyek = await tasks.listForProject(sql, kopi.id);
    expect(perProyek).toHaveLength(2);
    expect(perProyek.every((t) => t.createdAt && t.updatedAt)).toBe(true);
  } finally {
    await sql.end();
  }
});
