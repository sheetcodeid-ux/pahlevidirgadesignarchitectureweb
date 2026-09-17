/* Menjalankan repository BARU terhadap Postgres lokal dengan setelan koneksi
   yang SAMA PERSIS dengan src/db.ts — `fetch_types: false`, yang wajib untuk
   Hyperdrive dan yang menyembunyikan seluruh kelas galat kalau dipakai
   setelan bawaan (jebakan #16 di CLAUDE.md). */
import { it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import postgres from "postgres";
import * as payroll from "../src/repository/payroll";
import * as fee from "../src/repository/fee";
import * as costs from "../src/repository/costs";
import * as team from "../src/repository/team";

/**
 * Repository uang diuji terhadap Postgres SUNGGUHAN, dengan setelan koneksi
 * yang SAMA PERSIS dengan src/db.ts — `fetch_types: false`, yang wajib untuk
 * Hyperdrive. Setelan postgres.js bawaan menyembunyikan justru kelas galat
 * yang hanya muncul di produksi (jebakan #16 di CLAUDE.md: dua deploy merah
 * berturut-turut dengan seluruh tes lokal hijau).
 *
 * Dilewati kalau Postgres lokal belum dinyalakan — jalankan
 * ./scripts/rls-lokal.sh sekali, lalu tes ini ikut hidup. CI tidak punya
 * Postgres dan memang melewatinya.
 */
const DIR_PG = "/var/lib/postgresql/uji";
/* Yang diperiksa BERKAS SOKETNYA, bukan foldernya.
 *
 * Folder `sock/` tetap ada setelah Postgres lokal dimatikan, jadi penjaga
 * yang memeriksa folder membuat tes ini GAGAL dengan ECONNREFUSED alih-alih
 * melewati dirinya sendiri — merah palsu yang sudah dua kali memakan waktu
 * dalam satu sesi, dan dua-duanya di tengah merge. Berkas soketnya sendiri
 * dibuat dan dihapus oleh servernya, jadi keberadaannya memang menjawab
 * "servernya hidup atau tidak".
 *
 * CI tidak terpengaruh dua-duanya: di sana seluruh folder /var/lib/postgresql
 * memang tidak ada. Yang diperbaiki cuma keadaan mesin pengembang. */
const adaPostgres = existsSync(`${DIR_PG}/sock/.s.PGSQL.55432`);

it.skipIf(!adaPostgres)("repository uang jalan dengan setelan koneksi produksi", { timeout: 60_000 }, async () => {
  const DIR = DIR_PG;
  const sql = postgres({
    host: `${DIR}/sock`, port: 55432, user: "postgres", database: "postgres",
    fetch_types: false, prepare: false, max: 1,
  });

  const gagal: string[] = [];
  const cek = (nama: string, benar: boolean, dapat?: unknown) => {
    if (benar) console.log("  ok:", nama);
    else { gagal.push(nama); console.log("  GAGAL:", nama, "→", JSON.stringify(dapat)); }
  };

  // Skema bersih dari bootstrap (sudah memuat migrasi baru).
  await sql.unsafe("drop schema if exists public cascade; create schema public;");
  await sql.unsafe("drop schema if exists auth cascade;");
  // Relatif terhadap berkas ini, bukan path absolut: path absolut mengikat tes
  // ke satu mesin, dan container sesi ini bukan mesin pemilik.
  const baca = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");
  await sql.unsafe(baca("../../../supabase/tests/shim-lokal.sql"));
  await sql.unsafe(baca("../../../supabase/bootstrap.sql"));

  // ── Fixture ────────────────────────────────────────────────────────────────
  const [proyek] = await sql<{ id: string }[]>`
    insert into public.projects (slug, title, status, contract_value)
    values ('cano', 'CANO Coffee', 'draft', 120000000) returning id`;

  const dirga = await team.create(sql, { name: "Pahlevi Dirga", role: "Principal", kind: "partner" });
  const rian  = await team.create(sql, { name: "Rian", role: "Drafter", kind: "inti", rate: 350000 });

  console.log("\n── team.list membawa kolom baru ──");
  const anggota = await team.list(sql);
  cek("kind terbaca", anggota.find((a) => a.id === dirga)?.kind === "partner");
  cek("rate jadi angka, bukan string", anggota.find((a) => a.id === rian)?.rate === 350000);
  cek("active bawaannya true", anggota.every((a) => a.active === true));

  console.log("\n── biaya tertaut ke orang ──");
  const bulanIni = new Date().toISOString().slice(0, 7);
  await costs.create(sql, proyek.id, {
    label: "Desain konsep", category: "prinsipal", amount: 18000000,
    incurredOn: `${bulanIni}-05`, teamMemberId: dirga,
  });
  await costs.create(sql, proyek.id, {
    label: "Gambar kerja", category: "freelancer", amount: 12000000,
    incurredOn: `${bulanIni}-08`, teamMemberId: rian,
  });
  // Tanpa nama — biaya operasional yang memang bukan milik siapa pun.
  await costs.create(sql, proyek.id, {
    label: "Cetak A1", category: "operasional", amount: 400000, incurredOn: `${bulanIni}-09`,
  });
  // Kategori fee TAPI tanpa nama — meniru baris lama sebelum kolomnya ada.
  await costs.create(sql, proyek.id, {
    label: "Fee lama tanpa nama", category: "freelancer", amount: 3000000,
    incurredOn: `${bulanIni}-02`, teamMemberId: "",
  });

  const daftar = await costs.listForProject(sql, proyek.id);
  cek("nama orang ikut terbawa", daftar.find((b) => b.label === "Gambar kerja")?.teamMemberName === "Rian");
  cek("biaya operasional tetap tanpa nama",
    daftar.find((b) => b.label === "Cetak A1")?.teamMemberId === null);

  const semua = await costs.listAll(sql);
  cek("listAll membawa judul proyek", semua[0]?.projectTitle === "CANO Coffee", semua[0]);
  cek("listAll memuat empat biaya", semua.length === 4, semua.length);

  console.log("\n── fee per proyek ──");
  const fp = await fee.perProyek(sql);
  const p0 = fp[0];
  cek("fee bernama dijumlahkan benar", p0?.feeTotal === 30000000, p0?.feeTotal);
  cek("fee tanpa nama dipisah, tidak dibuang", p0?.feeTanpaNama === 3000000, p0?.feeTanpaNama);
  cek("operasional TIDAK ikut jadi fee", p0!.feeTotal + p0!.feeTanpaNama === 33000000);
  cek("porsi terhadap kontrak = 25%", p0?.feeShare === 0.25, p0?.feeShare);
  cek("dua orang terdaftar", p0?.orang.length === 2, p0?.orang.length);
  cek("urut dari nominal terbesar", p0?.orang[0]?.name === "Pahlevi Dirga", p0?.orang[0]?.name);

  console.log("\n── fee per orang ──");
  const po = await fee.perOrang(sql);
  cek("Dirga total 18 jt", po.find((x) => x.name === "Pahlevi Dirga")?.total === 18000000);
  cek("Rian menyentuh satu proyek", po.find((x) => x.name === "Rian")?.projectCount === 1);
  cek("rentang menyaring: sebelum tanggal 4 hanya sisa baris tanpa nama",
    (await fee.perOrang(sql, { sampai: `${bulanIni}-04` })).length === 0);

  console.log("\n── gaji ──");
  const gid = await payroll.create(sql, { teamMemberId: dirga, period: bulanIni, amount: 8000000 });
  cek("gaji tersimpan", typeof gid === "string");
  cek("periode 'YYYY-MM' jadi tanggal 1",
    (await payroll.list(sql, bulanIni))[0]?.period?.endsWith("-01") === true);

  let ganda = false;
  try { await payroll.create(sql, { teamMemberId: dirga, period: bulanIni, amount: 8000000 }); }
  catch { ganda = true; }
  cek("gaji ganda di bulan sama ditolak", ganda);

  console.log("\n── satu bulan: gaji diketik + fee diturunkan ──");
  const bln = await payroll.bulan(sql, bulanIni);
  const bDirga = bln.find((b) => b.name === "Pahlevi Dirga");
  const bRian  = bln.find((b) => b.name === "Rian");
  cek("Dirga muncul dengan gaji DAN fee", bDirga?.salaryAmount === 8000000 && bDirga?.feeAmount === 18000000, bDirga);
  cek("total Dirga = gaji + fee", bDirga?.total === 26000000, bDirga?.total);
  cek("Rian muncul walau tidak digaji", bRian?.salaryAmount === null && bRian?.feeAmount === 12000000, bRian);
  cek("Rian totalnya fee saja", bRian?.total === 12000000);
  cek("yang tidak digaji dan tidak dapat fee tidak muncul", bln.length === 2, bln.length);

  // Tandai dibayar lalu batalkan — `paidOn: null` harus SAH, bukan diabaikan.
  await payroll.update(sql, gid, { paidOn: `${bulanIni}-25` });
  cek("bisa ditandai dibayar", (await payroll.list(sql, bulanIni))[0]?.paidOn === `${bulanIni}-25`);
  await payroll.update(sql, gid, { paidOn: null });
  cek("tanda dibayar bisa dibatalkan", (await payroll.list(sql, bulanIni))[0]?.paidOn === null);

  await sql.end();
    expect(gagal, gagal.join("; ")).toEqual([]);
  });
