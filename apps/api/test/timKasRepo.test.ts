/* Fase 1 alur Excel pemilik: tim per peran, bayaran bertahap, kas studio,
   target semester — diuji terhadap Postgres SUNGGUHAN dengan setelan koneksi
   yang SAMA PERSIS dengan src/db.ts (`fetch_types: false`, jebakan #16).

   Angka-angkanya diambil dari sheet GAJI DANY dan GAJI ADJI: Weng, fee design
   Rp12 jt, Drafter 10% = Rp1,2 jt "dibayarkan 5% dulu", Render 5% = Rp600 rb.
   Dilewati kalau Postgres lokal belum dinyalakan (./scripts/rls-lokal.sh). */
import { it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import postgres from "postgres";
import * as feeRules from "../src/repository/feeRules";
import * as tim from "../src/repository/projectTeam";
import * as ledger from "../src/repository/ledger";
import * as targets from "../src/repository/targets";
import * as costs from "../src/repository/costs";
import * as fee from "../src/repository/fee";
import * as team from "../src/repository/team";
import * as adminRepo from "../src/repository/admin";
import * as payroll from "../src/repository/payroll";

const DIR_PG = "/var/lib/postgresql/uji";
const adaPostgres = existsSync(`${DIR_PG}/sock/.s.PGSQL.55432`);

it.skipIf(!adaPostgres)("tim, bayaran, kas, dan target jalan dengan setelan koneksi produksi", { timeout: 60_000 }, async () => {
  /* Database SENDIRI, bukan "postgres": uangRepo.test.ts membangun ulang
     skema di database itu, dan vitest menjalankan berkas tes paralel — dua
     tes yang saling menghapus skema menghasilkan "schema auth does not
     exist" yang tidak ada hubungannya dengan kode yang diuji. */
  const induk = postgres({ host: `${DIR_PG}/sock`, port: 55432, user: "postgres", database: "postgres", max: 1 });
  await induk.unsafe("drop database if exists uji_timkas with (force)");
  await induk.unsafe("create database uji_timkas");
  await induk.end();

  const sql = postgres({
    host: `${DIR_PG}/sock`, port: 55432, user: "postgres", database: "uji_timkas",
    fetch_types: false, prepare: false, max: 1,
  });

  const gagal: string[] = [];
  const cek = (nama: string, benar: boolean, dapat?: unknown) => {
    if (benar) console.log("  ok:", nama);
    else { gagal.push(nama); console.log("  GAGAL:", nama, "→", JSON.stringify(dapat)); }
  };
  const galat = async (f: () => Promise<unknown>) => {
    try { await f(); return null; } catch (e) { return (e as Error).message; }
  };

  await sql.unsafe("drop schema if exists public cascade; create schema public;");
  await sql.unsafe("drop schema if exists auth cascade;");
  const baca = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");
  await sql.unsafe(baca("../../../supabase/tests/shim-lokal.sql"));
  await sql.unsafe(baca("../../../supabase/bootstrap.sql"));

  // ── Fixture ──────────────────────────────────────────────────────────────
  const [weng] = await sql<{ id: string }[]>`
    insert into public.projects (slug, title, category, contract_value)
    values ('weng', 'Weng Coffee', 'coffeeshop', 12000000) returning id`;
  const [ade] = await sql<{ id: string }[]>`
    insert into public.projects (slug, title, category, contract_value)
    values ('rumah-ade', 'Rumah Ade', 'residential', 13000000) returning id`;
  const dirga = await team.create(sql, { name: "Dirga", kind: "partner" });
  const adji = await team.create(sql, { name: "Adji", kind: "partner" });
  const dany = await team.create(sql, { name: "Dany", kind: "inti" });

  console.log("\n── aturan persen bawaan ──");
  const aturan = await feeRules.get(sql);
  cek("Drafter 10, Render 5", aturan.pctDrafter === 10 && aturan.pctRender === 5, aturan);
  cek("Leader dan Estimator belum ditentukan (null, bukan 0)",
    aturan.pctLeader === null && aturan.pctEstimator === null, aturan);
  cek("jatah bonus tim 10, tahap awal 50", aturan.poolPct === 10 && aturan.firstTranchePct === 50, aturan);
  cek("persen di luar 0–100 ditolak", (await galat(() => feeRules.update(sql, { pctRender: 140 }))) !== null);

  console.log("\n── tim per peran ──");
  const aDany = await tim.add(sql, weng.id, { teamMemberId: dany, role: "drafter" });
  const aAdji = await tim.add(sql, weng.id, { teamMemberId: adji, role: "render" });
  const aDirga = await tim.add(sql, weng.id, { teamMemberId: dirga, role: "leader" });
  cek("orang yang sama di peran yang sama ditolak dengan kalimat staf",
    (await galat(() => tim.add(sql, weng.id, { teamMemberId: dany, role: "drafter" })))
      === "orang ini sudah memegang peran itu di proyek ini");
  cek("peran tak dikenal ditolak",
    (await galat(() => tim.add(sql, weng.id, { teamMemberId: dany, role: "arsitek" }))) === "peran tidak sah");

  let daftar = await tim.list(sql, { projectId: weng.id });
  const d = () => daftar.find((x) => x.id === aDany)!;
  cek("persen Drafter DIBEKUKAN di penugasan (10)", d().pct === 10, d());
  cek("hak Drafter = 12 jt × 10% = 1,2 jt", d().hak === 1_200_000, d().hak);
  cek("hak Render = 600 rb", daftar.find((x) => x.id === aAdji)?.hak === 600_000);
  cek("Leader tanpa persen: hak null, tahap belum_ditentukan",
    daftar.find((x) => x.id === aDirga)?.hak === null &&
      daftar.find((x) => x.id === aDirga)?.tahap.every((t) => t.keadaan === "belum_ditentukan") === true,
    daftar.find((x) => x.id === aDirga));
  cek("tahap awal 600 rb (\"5% dulu\"), akhir 600 rb",
    d().tahap[0].nominal === 600_000 && d().tahap[1].nominal === 600_000, d().tahap);
  cek("sebelum DP: tahap awal masih menunggu", d().tahap[0].keadaan === "menunggu", d().tahap[0]);

  console.log("\n── DP klien masuk → tahap awal jatuh tempo ──");
  await sql`insert into public.project_payments (project_id, amount, kind, paid_at)
            values (${weng.id}::uuid, 6000000, 'dp', '2026-08-10 10:00+07')`;
  daftar = await tim.list(sql, { projectId: weng.id });
  cek("tahap awal jatuh tempo", d().tahap[0].keadaan === "jatuh_tempo", d().tahap[0]);
  cek("tahap akhir masih menunggu (desain belum selesai)", d().tahap[1].keadaan === "menunggu", d().tahap[1]);

  const biayaAwal = await tim.bayar(sql, { projectTeamId: aDany, tahap: "awal", paidOn: "2026-08-12" });
  cek("tahap yang sama tidak bisa dibayar dua kali",
    (await galat(() => tim.bayar(sql, { projectTeamId: aDany, tahap: "awal" }))) === "tahap ini sudah dibayar");
  daftar = await tim.list(sql, { projectId: weng.id });
  cek("dibayar 600 rb, terutang 600 rb", d().dibayar === 600_000 && d().terutang === 600_000, d());
  cek("tahap awal tercatat dibayar beserta tanggalnya",
    d().tahap[0].keadaan === "dibayar" && d().tahap[0].dibayarPada === "2026-08-12" && d().tahap[0].costId === biayaAwal,
    d().tahap[0]);

  const biayaProyek = await costs.listForProject(sql, weng.id);
  const b = biayaProyek.find((x) => x.id === biayaAwal);
  cek("bayaran = BIAYA PROYEK bertaut penugasan dan tahapnya",
    b?.projectTeamId === aDany && b?.payoutStage === "awal" && b?.teamMemberId === dany && b?.category === "freelancer", b);

  const bAdji = await tim.bayar(sql, { projectTeamId: aAdji, tahap: "awal" });
  cek("partner dicatat sebagai fee prinsipal",
    (await costs.listForProject(sql, weng.id)).find((x) => x.id === bAdji)?.category === "prinsipal");

  console.log("\n── desain selesai → tahap akhir jatuh tempo ──");
  await sql`update public.projects set pipeline_stage = 'finish' where id = ${weng.id}::uuid`;
  daftar = await tim.list(sql, { projectId: weng.id });
  cek("tahap akhir jatuh tempo", d().tahap[1].keadaan === "jatuh_tempo", d().tahap[1]);

  console.log("\n── aturan berubah ──");
  await feeRules.update(sql, { pctLeader: 3, pctDrafter: 12 });
  daftar = await tim.list(sql, { projectId: weng.id });
  cek("Leader yang belum ditentukan IKUT aturan baru: 12 jt × 3% = 360 rb",
    daftar.find((x) => x.id === aDirga)?.hak === 360_000, daftar.find((x) => x.id === aDirga));
  cek("Drafter yang sudah berjalan TIDAK ikut berubah (tetap 10%)", d().hak === 1_200_000, d().hak);

  console.log("\n── satu peran dua orang (\"Adji&dany\" di Rumah Ade) ──");
  await tim.add(sql, ade.id, { teamMemberId: adji, role: "render", pct: 2.5 });
  await tim.add(sql, ade.id, { teamMemberId: dany, role: "render", pct: 2.5 });
  const ades = await tim.list(sql, { projectId: ade.id });
  cek("masing-masing 13 jt × 2,5% = 325 rb", ades.length === 2 && ades.every((x) => x.hak === 325_000), ades.map((x) => x.hak));

  console.log("\n── penugasan yang sudah dibayar tidak bisa dihapus ──");
  cek("ditolak dengan SudahDibayarError",
    (await galat(() => tim.remove(sql, aDany)))?.startsWith("penugasan ini sudah punya bayaran") === true);
  await costs.remove(sql, biayaAwal);
  cek("sesudah bayarannya dihapus, penugasannya bisa dihapus", (await galat(() => tim.remove(sql, aDany))) === null);

  console.log("\n── ringkasan per orang dan halaman Fee membaca biaya yang sama ──");
  const orang = await tim.perOrang(sql);
  const oAdji = orang.find((o) => o.teamMemberId === adji);
  cek("Adji: 2 proyek, hak 600 rb + 325 rb, dibayar 300 rb",
    oAdji?.proyek === 2 && oAdji?.hak === 925_000 && oAdji?.dibayar === 300_000, oAdji);
  const feeAdji = (await fee.perOrang(sql)).find((o) => o.teamMemberId === adji);
  cek("halaman Fee menghitung bayaran tahap yang sama (300 rb)", feeAdji?.total === 300_000, feeAdji);

  console.log("\n── slip gaji satu orang satu bulan (pengganti sheet GAJI) ──");
  const aDanyAde = (await tim.list(sql, { projectId: ade.id })).find((x) => x.teamMemberId === dany)!;
  await tim.bayar(sql, { projectTeamId: aDanyAde.id, tahap: "awal", paidOn: "2026-08-20" });
  await costs.create(sql, ade.id, { label: "Revisi render", category: "freelancer", amount: 250_000, incurredOn: "2026-08-25", teamMemberId: dany });
  await costs.create(sql, ade.id, { label: "Bulan lain", category: "freelancer", amount: 999_000, incurredOn: "2026-09-01", teamMemberId: dany });
  await payroll.create(sql, { teamMemberId: dany, period: "2026-08", amount: 3_000_000 });
  const slip = (await payroll.slip(sql, dany, "2026-08"))!;
  cek("slip Agustus: gaji 3 jt + tahap awal 162,5 rb + revisi 250 rb = 3.412.500",
    slip.salaryAmount === 3_000_000 && slip.feeAmount === 412_500 && slip.total === 3_412_500, slip);
  cek("biaya bulan lain TIDAK ikut", slip.fees.length === 2, slip.fees.map((f) => f.label));
  const fTahap = slip.fees.find((f) => f.payoutStage === "awal");
  cek("baris tahap membawa peran, persen, dan proyeknya",
    fTahap?.role === "render" && fTahap?.pct === 2.5 && fTahap?.projectTitle === "Rumah Ade", fTahap);
  cek("fee ketik tangan ikut, tanpa peran", slip.fees.some((f) => f.label === "Revisi render" && f.role === null));
  const barisBulan = (await payroll.bulan(sql, "2026-08")).find((r) => r.teamMemberId === dany);
  cek("total slip = kolom Total halaman Gaji", barisBulan?.total === slip.total, barisBulan);
  cek("bulan tanpa apa pun: slip kosong, total 0",
    (await payroll.slip(sql, dany, "2025-01"))?.total === 0);
  cek("orang tak dikenal: null", (await payroll.slip(sql, "00000000-0000-4000-8000-000000000000", "2026-08")) === null);

  console.log("\n── kas studio ──");
  const pvc = await ledger.create(sql, {
    direction: "masuk", category: "penjualan_material", label: "PVC 120 batang",
    counterparty: "Ko Fendy", amount: 1_440_000, occurredOn: "2026-08-11",
  });
  await ledger.create(sql, { direction: "keluar", category: "konsumsi", label: "Jajan Nisa", amount: 1_500_000, occurredOn: "2026-08-11" });
  cek("penjualan material sebagai uang keluar ditolak dengan kalimat staf",
    (await galat(() => ledger.create(sql, { direction: "keluar", category: "penjualan_material", label: "Salah", amount: 1 })))
      === 'kategori "penjualan_material" tidak cocok untuk uang keluar');
  cek("mengganti arusnya saja tanpa kategori yang cocok ditolak",
    (await galat(() => ledger.update(sql, pvc, { direction: "keluar" }))) !== null);
  const kas = await ledger.list(sql, { dari: "2026-08-01", sampai: "2026-08-31" });
  cek("dua catatan kas di Agustus, nominal jadi angka", kas.length === 2 && kas.every((k) => typeof k.amount === "number"), kas);

  console.log("\n── target semester ──");
  const sem = await targets.kemajuan(sql, "2026-07-01");
  cek("target Juli–Desember 2026 = 1 M (ditetapkan migrasi)", sem.target === 1_000_000_000 && sem.asal === "ditetapkan", sem);
  cek("tercapai = DP 6 jt + PVC 1,44 jt (uang keluar tidak mengurangi)",
    sem.pembayaranKlien === 6_000_000 && sem.kasLain === 1_440_000 && sem.tercapai === 7_440_000, sem);
  cek("kurang = 1 M − 7,44 jt", sem.kurang === 992_560_000, sem.kurang);
  cek("akhir semester 31 Desember", sem.semesterEnd === "2026-12-31", sem.semesterEnd);
  const depan = await targets.kemajuan(sql, "2027-01-01");
  cek("semester tanpa baris memakai target terakhir (diteruskan)", depan.target === 1_000_000_000 && depan.asal === "diteruskan", depan);
  cek("semester yang tidak mulai 1 Jan / 1 Jul ditolak", (await galat(() => targets.kemajuan(sql, "2026-03-01"))) !== null);
  await targets.simpan(sql, { semesterStart: "2027-01-01", amount: 1_200_000_000 });
  cek("target semester baru tersimpan", (await targets.kemajuan(sql, "2027-01-01")).target === 1_200_000_000);

  console.log("\n── lingkup kerja dan tenggat (fase 2) ──");
  await adminRepo.update(sql, weng.id, {
    scopeOfWork: "  Interior coffee shop, bar dan dapur  ", deadlinePreview: "2026-08-24", deadlineFinal: "2026-08-26",
  });
  let wengRow = (await adminRepo.listAll(sql, "")).find((p) => p.id === weng.id);
  cek("lingkup tersimpan dipangkas, tenggat terbaca sebagai YYYY-MM-DD",
    wengRow?.scopeOfWork === "Interior coffee shop, bar dan dapur" &&
      wengRow?.deadlinePreview === "2026-08-24" && wengRow?.deadlineFinal === "2026-08-26", wengRow);
  await adminRepo.update(sql, weng.id, { deadlinePreview: null, scopeOfWork: "" });
  wengRow = (await adminRepo.listAll(sql, "")).find((p) => p.id === weng.id);
  cek("tenggat dan lingkup bisa DIKOSONGKAN lagi (null / string kosong)",
    wengRow?.deadlinePreview === null && wengRow?.scopeOfWork === null && wengRow?.deadlineFinal === "2026-08-26", wengRow);

  await sql.end();
  expect(gagal, `gagal: ${gagal.join("; ")}`).toEqual([]);
});
