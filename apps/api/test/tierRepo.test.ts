/* Repository paket layanan terhadap Postgres SUNGGUHAN, dengan setelan
   koneksi yang SAMA PERSIS dengan src/db.ts (`fetch_types: false`) —
   jebakan #16 di CLAUDE.md. Dilewati kalau Postgres lokal belum hidup;
   jalankan ./scripts/rls-lokal.sh sekali dan tes ini ikut jalan. */
import { it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import postgres from "postgres";
import * as tiers from "../src/repository/tiers";

const DIR = "/var/lib/postgresql/uji";
const adaPostgres = existsSync(`${DIR}/sock/.s.PGSQL.55432`);

it.skipIf(!adaPostgres)("repository paket jalan dengan setelan koneksi produksi", { timeout: 60_000 }, async () => {
  /* Database SENDIRI, bukan `postgres`: uangRepo.test.ts membongkar dan
     membangun ulang skema `public` di database itu, dan vitest menjalankan
     berkas tes berbarengan — dua tes yang saling menghapus skema merah
     acak tanpa ada yang salah di kodenya. */
  const induk = postgres({ host: `${DIR}/sock`, port: 55432, user: "postgres", database: "postgres", max: 1 });
  const ada = await induk`select 1 from pg_database where datname = 'uji_paket'`;
  if (ada.length === 0) await induk.unsafe("create database uji_paket");
  await induk.end();
  const sql = postgres({
    host: `${DIR}/sock`, port: 55432, user: "postgres", database: "uji_paket",
    fetch_types: false, prepare: false, max: 1,
  });
  const gagal: string[] = [];
  const cek = (nama: string, benar: boolean, dapat?: unknown) => {
    if (benar) console.log("  ok:", nama);
    else { gagal.push(nama); console.log("  GAGAL:", nama, "→", JSON.stringify(dapat)); }
  };

  await sql.unsafe("drop schema if exists public cascade; create schema public;");
  await sql.unsafe("drop schema if exists auth cascade;");
  const baca = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");
  await sql.unsafe(baca("../../../supabase/tests/shim-lokal.sql"));
  await sql.unsafe(baca("../../../supabase/bootstrap.sql"));

  // Isi awal dari migrasi: enam paket, urut per kelompok.
  const awal = await tiers.list(sql, false);
  cek("migrasi mengisi enam paket", awal.length === 6, awal.length);
  cek("urutan kafe dulu, lalu sort_order", awal.map((t) => t.slug).join() ===
    "starter,signature,flagship,konsultasi,standar,premium", awal.map((t) => t.slug));
  const sig = awal.find((t) => t.slug === "signature")!;
  cek("isi paket kembali sebagai daftar", sig.includes.length === 4 && sig.includes[0] === "Gambar kerja lengkap (DED)", sig.includes);
  cek("sorotan terbawa", sig.highlighted === true);

  // Tambah, dengan isi berbaris — dan baris kosong berlebih dibuang.
  const id = await tiers.create(sql, {
    group: "rumah", slug: "renovasi", name: "Renovasi", feeMin: 20, feeMax: 40,
    includes: ["Survei kondisi", "Gambar renovasi"], sortOrder: 4,
  });
  const baru = await tiers.get(sql, id);
  cek("paket baru tersimpan", baru.name === "Renovasi" && baru.includes.join("|") === "Survei kondisi|Gambar renovasi", baru);

  // Ubah sebagian; lalu nonaktifkan dan pastikan beranda tidak melihatnya.
  await tiers.update(sql, id, { feeMax: 45, includes: ["Survei kondisi"] });
  const ubah = await tiers.get(sql, id);
  cek("ubah sebagian", ubah.feeMax === 45 && ubah.feeMin === 20 && ubah.includes.length === 1, ubah);
  await tiers.update(sql, id, { active: false });
  cek("paket nonaktif hilang dari beranda", !(await tiers.list(sql, false)).some((t) => t.id === id));
  cek("paket nonaktif tetap di panel", (await tiers.list(sql, true)).some((t) => t.id === id));

  // Slug ganda → galat yang bisa dikenali, bukan 500.
  let slugGanda = false;
  try { await tiers.create(sql, { group: "kafe", slug: "starter", name: "Kembar", feeMin: 1, feeMax: 2 }); }
  catch (e) { slugGanda = e instanceof tiers.SlugTakenError; }
  cek("slug ganda dikenali", slugGanda);

  // Fee yang dikirim sendirian dan melanggar pasangannya ditolak database.
  let terbalik = "";
  try { await tiers.update(sql, id, { feeMin: 90 }); }
  catch (e) { terbalik = (e as { code?: string }).code ?? ""; }
  cek("fee terendah melampaui yang tertinggi ditolak (23514)", terbalik === "23514", terbalik);

  await tiers.remove(sql, id);
  cek("paket terhapus", !(await tiers.list(sql, true)).some((t) => t.id === id));

  await sql.end();
  expect(gagal, gagal.join("; ")).toEqual([]);
});
