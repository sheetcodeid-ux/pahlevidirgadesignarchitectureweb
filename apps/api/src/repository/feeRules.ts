import type { Sql } from "postgres";
import type { FeeRules, FeeRulesInput, RingkasanAturanFee, TeamRole } from "../types";

/**
 * Aturan persen bayaran tim — satu baris untuk seluruh studio.
 *
 * Leader dan Estimator bawaannya KOSONG: pemilik menjawab "belum ditentukan,
 * buat bisa disetting nanti". Kosong dan nol dibedakan dengan sengaja — nol
 * berarti peran itu memang tidak dibayar dari proyek, kosong berarti belum
 * diputuskan, dan laporan bayaran menyebut keduanya dengan kalimat berbeda.
 */

interface Row {
  pct_leader: string | null;
  pct_drafter: string | null;
  pct_render: string | null;
  pct_estimator: string | null;
  pool_pct: string;
  first_tranche_pct: string;
}

const angka = (v: string | null) => (v === null ? null : Number(v));

export async function get(sql: Sql): Promise<FeeRules> {
  const [r] = await sql<Row[]>`
    select pct_leader, pct_drafter, pct_render, pct_estimator, pool_pct, first_tranche_pct
      from public.studio_fee_settings
     where id`;
  // Barisnya dibuat migrasi dan tidak bisa dihapus siapa pun selain pemilik
  // database. Kalau tetap hilang, itu kerusakan — bukan keadaan kosong yang
  // boleh ditambal diam-diam dengan angka karangan.
  if (!r) throw new Error("aturan fee studio tidak ditemukan");
  return {
    pctLeader: angka(r.pct_leader),
    pctDrafter: angka(r.pct_drafter),
    pctRender: angka(r.pct_render),
    pctEstimator: angka(r.pct_estimator),
    poolPct: Number(r.pool_pct),
    firstTranchePct: Number(r.first_tranche_pct),
  };
}

/** Persen bawaan untuk satu peran; null = belum ditentukan. */
export function pctPeran(aturan: FeeRules, peran: TeamRole): number | null {
  switch (peran) {
    case "leader": return aturan.pctLeader;
    case "drafter": return aturan.pctDrafter;
    case "render": return aturan.pctRender;
    case "estimator": return aturan.pctEstimator;
  }
}

function persen(v: unknown, nama: string, bolehKosong: boolean): number | null {
  if (v === null) {
    if (!bolehKosong) throw new Error(`${nama} wajib diisi`);
    return null;
  }
  if (typeof v !== "number" || !Number.isFinite(v)) throw new Error(`${nama} harus angka`);
  if (v < 0 || v > 100) throw new Error(`${nama} harus di antara 0 dan 100`);
  // numeric(5,2): dua angka di belakang koma. Dibulatkan di sini, bukan
  // dibiarkan dibulatkan Postgres, supaya yang dikembalikan sama dengan yang
  // tersimpan.
  return Math.round(v * 100) / 100;
}

/**
 * Kop dan dampak untuk halaman Aturan Fee Tim:
 * - kapan aturan terakhir diubah dan oleh siapa (nama tampilan, atau bagian
 *   depan email kalau nama belum diisi — sama dengan kartu akun di rel);
 * - per peran, berapa penugasan BERJALAN yang persennya masih kosong dan
 *   karena itu ikut berubah begitu persen peran itu diubah. Yang persennya
 *   sudah dibekukan tidak ikut — dihitung terpisah supaya kalimatnya jujur;
 * - berapa penugasan yang masih punya tahap belum dibayar — yang ikut
 *   berubah kalau bagian tahap awal diubah.
 */
export async function ringkasan(sql: Sql): Promise<RingkasanAturanFee> {
  const [kop] = await sql<{ diubah_pada: Date; oleh: string | null }[]>`
    select s.updated_at as diubah_pada,
           coalesce(nullif(trim(p.full_name), ''), nullif(split_part(u.email, '@', 1), '')) as oleh
      from public.studio_fee_settings s
      left join public.profiles p on p.id = s.updated_by
      left join auth.users u on u.id = s.updated_by
     where s.id`;
  if (!kop) throw new Error("aturan fee studio tidak ditemukan");
  const peran = await sql<{ role: TeamRole; ikut: number; tetap: number }[]>`
    select role::text as role,
           count(*) filter (where pct is null)::int as ikut,
           count(*) filter (where pct is not null)::int as tetap
      from public.project_team
     group by role`;
  const [belum] = await sql<{ n: number }[]>`
    select count(*)::int as n
      from public.project_team t
     where (select count(*) from public.project_costs c where c.project_team_id = t.id) < 2`;
  const kosong = { ikutAturan: 0, persenTetap: 0 };
  const perPeran: RingkasanAturanFee["perPeran"] = {
    leader: { ...kosong }, drafter: { ...kosong }, render: { ...kosong }, estimator: { ...kosong },
  };
  for (const r of peran) perPeran[r.role] = { ikutAturan: r.ikut, persenTetap: r.tetap };
  return {
    diubahPada: new Date(kop.diubah_pada).toISOString(),
    diubahOleh: kop.oleh,
    perPeran,
    belumLunas: belum?.n ?? 0,
  };
}

/** Hanya kolom yang dikirim yang diubah. `oleh` = id akun yang menyimpan. */
export async function update(sql: Sql, input: FeeRulesInput, oleh?: string): Promise<void> {
  type Fragment = ReturnType<Sql>;
  const f: Fragment[] = [];
  if (input.pctLeader !== undefined) f.push(sql`pct_leader = ${persen(input.pctLeader, "persen Leader", true)}`);
  if (input.pctDrafter !== undefined) f.push(sql`pct_drafter = ${persen(input.pctDrafter, "persen Drafter", true)}`);
  if (input.pctRender !== undefined) f.push(sql`pct_render = ${persen(input.pctRender, "persen Render", true)}`);
  if (input.pctEstimator !== undefined) f.push(sql`pct_estimator = ${persen(input.pctEstimator, "persen Estimator", true)}`);
  if (input.poolPct !== undefined) f.push(sql`pool_pct = ${persen(input.poolPct, "jatah bonus tim", false)}`);
  if (input.firstTranchePct !== undefined) {
    f.push(sql`first_tranche_pct = ${persen(input.firstTranchePct, "bagian tahap awal", false)}`);
  }
  if (f.length === 0) return;

  if (oleh) f.push(sql`updated_by = ${oleh}::uuid`);

  let set = f[0];
  for (let i = 1; i < f.length; i++) set = sql`${set}, ${f[i]}`;
  await sql`update public.studio_fee_settings set ${set} where id`;
}
