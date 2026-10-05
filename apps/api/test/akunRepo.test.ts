/* Halaman Akun: nama tampilan, info akun, dan daftar sesi — diuji terhadap
   Postgres SUNGGUHAN dengan setelan koneksi yang SAMA PERSIS dengan src/db.ts
   (`fetch_types: false`, jebakan #16). Database sendiri (`uji_akun`, jebakan
   #64). Dilewati kalau Postgres lokal belum dinyalakan (./scripts/rls-lokal.sh).

   `auth.sessions` dan dua kolom `auth.users` ditambahkan di sini dengan TIPE
   PRODUKSI (dibaca dari information_schema proyek): `refreshed_at` memang
   `timestamp` tanpa zona, sementara kolom lainnya `timestamptz`. */
import { it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import postgres from "postgres";
import * as akun from "../src/repository/akun";

const DIR_PG = "/var/lib/postgresql/uji";
const adaPostgres = existsSync(`${DIR_PG}/sock/.s.PGSQL.55432`);

it.skipIf(!adaPostgres)("nama, info akun, dan sesi dengan setelan koneksi produksi", { timeout: 60_000 }, async () => {
  const induk = postgres({ host: `${DIR_PG}/sock`, port: 55432, user: "postgres", database: "postgres", max: 1 });
  await induk.unsafe("drop database if exists uji_akun with (force)");
  await induk.unsafe("create database uji_akun");
  await induk.end();

  const sql = postgres({
    host: `${DIR_PG}/sock`, port: 55432, user: "postgres", database: "uji_akun",
    fetch_types: false, prepare: false, max: 1,
  });

  const gagal: string[] = [];
  const cek = (nama: string, benar: boolean, dapat?: unknown) => {
    if (benar) console.log("  ok:", nama);
    else { gagal.push(nama); console.log("  GAGAL:", nama, "→", JSON.stringify(dapat)); }
  };

  const baca = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");
  await sql.unsafe(baca("../../../supabase/tests/shim-lokal.sql"));
  await sql.unsafe(baca("../../../supabase/bootstrap.sql"));
  await sql.unsafe(`
    alter table auth.users add column if not exists created_at timestamptz default now(),
                           add column if not exists last_sign_in_at timestamptz;
    create table auth.sessions (
      id uuid primary key, user_id uuid not null references auth.users (id) on delete cascade,
      created_at timestamptz, updated_at timestamptz, refreshed_at timestamp without time zone,
      user_agent text);
    set time zone 'Asia/Jakarta';`);

  const dirga = "11111111-1111-4111-8111-111111111111";
  const lain = "22222222-2222-4222-8222-222222222222";
  await sql`insert into auth.users (id, email, last_sign_in_at) values
    (${dirga}, 'dirga@contoh.id', '2026-10-05T02:00:00Z'), (${lain}, 'staf@contoh.id', null)`;
  await sql`insert into public.profiles (id, role, created_at) values
    (${dirga}, 'admin', '2026-08-18T00:00:00Z'), (${lain}, 'editor', '2026-09-01T00:00:00Z')`;

  console.log("\n── profil & nama ──");
  cek("profil tanpa nama: peran ada, nama null",
    JSON.stringify(await akun.profil(sql, dirga)) === JSON.stringify({ role: "admin", nama: null }));
  cek("bukan staf → null", (await akun.profil(sql, "33333333-3333-4333-8333-333333333333")) === null);
  cek("nama dirapikan: spasi ganda dan tepi dibuang", akun.rapikanNama("  Dirga   Pahlevi ") === "Dirga Pahlevi");
  cek("nama kosong → null (kembali ke turunan email)", akun.rapikanNama("   ") === null && akun.rapikanNama(undefined) === null);
  let galat = "";
  try { akun.rapikanNama("x".repeat(61)); } catch (e) { galat = (e as Error).message; }
  cek("nama 61 karakter ditolak", galat === "nama maksimal 60 karakter", galat);
  await akun.ubahNama(sql, dirga, "Dirga Pahlevi");
  cek("nama tersimpan dan terbaca profil()", (await akun.profil(sql, dirga))?.nama === "Dirga Pahlevi");
  cek("nama akun lain tidak ikut berubah", (await akun.profil(sql, lain))?.nama === null);

  console.log("\n── info ──");
  const i = await akun.info(sql, dirga);
  cek("staf sejak & terakhir masuk sebagai ISO UTC",
    i?.stafSejak === "2026-08-18T00:00:00.000Z" && i?.terakhirMasuk === "2026-10-05T02:00:00.000Z", i);
  cek("terakhir masuk kosong tetap null", (await akun.info(sql, lain))?.terakhirMasuk === null);

  console.log("\n── sesi ──");
  // s1 = sesi yang sedang dipakai. s6 dibuat paling awal tapi DISEGARKAN 2 jam
  // lalu, jadi harus di depan s5 (dibuat 5 jam lalu). refreshed_at tanpa zona =
  // UTC; dengan zona sesi Asia/Jakarta, membacanya tanpa `at time zone 'UTC'`
  // menggeser 7 jam dan membalik urutannya.
  const ID = (n: number) => `aaaaaaaa-0000-4000-8000-00000000000${n}`;
  await sql`insert into auth.sessions (id, user_id, created_at, updated_at, refreshed_at, user_agent) values
    (${ID(1)}, ${dirga}, now() - interval '30 days', now() - interval '30 days', (now() at time zone 'UTC') - interval '1 hour', 'Mozilla/5.0 (Macintosh)'),
    (${ID(2)}, ${dirga}, now() - interval '3 hours', now() - interval '3 hours', null, ''),
    (${ID(3)}, ${dirga}, now() - interval '10 days', now() - interval '10 days', null, 'quic-go HTTP/3'),
    (${ID(5)}, ${dirga}, now() - interval '5 hours', now() - interval '5 hours', null, 'Mozilla/5.0 (Windows NT 10.0)'),
    (${ID(6)}, ${dirga}, now() - interval '2 days', now() - interval '2 days', (now() at time zone 'UTC') - interval '2 hours', 'Mozilla/5.0 (iPhone)'),
    (${ID(4)}, ${lain},  now(), now(), null, 'Mozilla/5.0 (iPhone)')`;
  const s = await akun.sesi(sql, dirga, ID(1));
  const ujung = (x: { id: string }[]) => x.map((d) => d.id.slice(-1)).join("");
  cek("jumlah hanya sesi akun ini, termasuk yang sedang dipakai", s.jumlah === 5, s);
  cek("aktif 24 jam: s1, s2, s5, s6", s.aktif24j === 4, s);
  cek("sesi ini dikenali dari session_id", s.ini?.id === ID(1) && s.ini.userAgent === "Mozilla/5.0 (Macintosh)", s.ini);
  cek("lain: hanya yang berperamban, tanpa sesi ini, urut aktif (refreshed_at sebagai UTC)", ujung(s.lain) === "65",
    s.lain.map((d) => [d.id.slice(-1), d.terakhirAktif]));
  cek("tanpa nama: agen kosong dan quic-go dirangkum", s.tanpaNama === 2, s);
  cek("tanpa nama terakhir aktif = s2 (3 jam lalu)",
    Math.abs(Date.parse(s.tanpaNamaTerakhir ?? "") - (Date.now() - 3 * 3600e3)) < 120_000, s.tanpaNamaTerakhir);
  const tanpaIni = await akun.sesi(sql, dirga, null);
  cek("token tanpa session_id: ini null, s1 ikut di daftar lain", tanpaIni.ini === null && ujung(tanpaIni.lain) === "165",
    ujung(tanpaIni.lain));
  cek("batas daftar dipatuhi, jumlah tetap total", (await akun.sesi(sql, dirga, ID(1), 1)).lain.length === 1);

  await sql.end();
  if (gagal.length) throw new Error(`${gagal.length} assertion gagal: ${gagal.join("; ")}`);
});
