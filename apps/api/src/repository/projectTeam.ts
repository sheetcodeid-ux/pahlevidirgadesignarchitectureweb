import type { Sql } from "postgres";
import type {
  FeeRules, MemberKind, PayoutInput, PayoutStage, ProjectTeamInput, ProjectTeamMember,
  TahapBayaran, TeamPayoutPerson, TeamRole,
} from "../types";
import { VALID_PAYOUT_STAGE, VALID_TEAM_ROLE } from "../types";
import * as feeRules from "./feeRules";
import { NotFoundError } from "./projects";

/**
 * Tim per proyek, berdasarkan PERAN — kolom "TEAM DESIGN" dan "TEAM DESIGN
 * FEE" di Excel pemilik, dihitung alih-alih diketik.
 *
 * Yang disimpan di penugasan cuma PERSEN. Nominalnya selalu dihitung dari fee
 * design proyek (nilai kontrak), jadi fee proyek hanya ada di satu tempat dan
 * tidak bisa lagi tercatat Rp12 jt di satu sheet dan Rp8 jt di sheet lain.
 *
 * Yang SUDAH dibayar tidak disimpan di sini: ia biaya proyek yang tertaut ke
 * penugasannya (project_costs.project_team_id + payout_stage). Aturan lama
 * "satu bayaran hanya diketik di satu tempat" tetap utuh — laba proyek,
 * halaman Fee, dan halaman Gaji membaca biaya yang sama.
 */

/** Label peran untuk teks biaya yang tercatat. */
const LABEL_PERAN: Record<TeamRole, string> = {
  leader: "Leader",
  drafter: "Drafter",
  render: "Render",
  estimator: "Estimator",
};

interface Row {
  id: string;
  project_id: string;
  project_title: string;
  contract_value: string | null;
  dp_masuk: boolean;
  desain_selesai: boolean;
  team_member_id: string;
  nama: string;
  kind: MemberKind;
  role: TeamRole;
  pct: string | null;
  note: string | null;
}

interface BayarRow {
  id: string;
  project_team_id: string;
  payout_stage: PayoutStage;
  amount: string;
  incurred_on: string;
}

interface Saring {
  projectId?: string | null;
  teamMemberId?: string | null;
  id?: string | null;
}

/**
 * Penugasan beserta hak, yang sudah dibayar, dan keadaan kedua tahapnya.
 *
 * "DP masuk" = proyek sudah punya pembayaran berjenis DP, ATAU tahap
 * pipeline-nya sudah melewati "DP 50%" — studio yang menerima DP tunai tanpa
 * mencatatnya sebagai pembayaran tetap memajukan tahapnya, dan bayaran tim
 * tidak boleh tertahan karena itu.
 * "Desain selesai" = tahap pipeline sudah "Finish" atau sesudahnya.
 */
export async function list(sql: Sql, s: Saring = {}): Promise<ProjectTeamMember[]> {
  const pid = s.projectId ?? null;
  const tid = s.teamMemberId ?? null;
  const id = s.id ?? null;

  // Dua query dengan saringan yang SAMA, bukan "ambil penugasan lalu kirim
  // daftar id-nya": array JavaScript tidak bisa jadi parameter query di Worker
  // (jebakan #16 di CLAUDE.md).
  const [aturan, baris, bayar] = await Promise.all([
    feeRules.get(sql),
    sql<Row[]>`
      select pt.id, pt.project_id, p.title as project_title, p.contract_value,
             (p.pipeline_stage >= 'dp_50'
               or exists (select 1 from public.project_payments pp
                           where pp.project_id = p.id and pp.kind = 'dp')) as dp_masuk,
             p.pipeline_stage >= 'finish' as desain_selesai,
             pt.team_member_id, t.name as nama, t.kind, pt.role, pt.pct, pt.note
        from public.project_team pt
        join public.projects p on p.id = pt.project_id
        join public.team_members t on t.id = pt.team_member_id
       where (${pid}::uuid is null or pt.project_id = ${pid}::uuid)
         and (${tid}::uuid is null or pt.team_member_id = ${tid}::uuid)
         and (${id}::uuid is null or pt.id = ${id}::uuid)
       order by p.created_at desc, pt.role, pt.sort_order, t.name`,
    sql<BayarRow[]>`
      select c.id, c.project_team_id, c.payout_stage, c.amount, c.incurred_on::text
        from public.project_costs c
        join public.project_team pt on pt.id = c.project_team_id
       where (${pid}::uuid is null or pt.project_id = ${pid}::uuid)
         and (${tid}::uuid is null or pt.team_member_id = ${tid}::uuid)
         and (${id}::uuid is null or pt.id = ${id}::uuid)`,
  ]);

  const perPenugasan = new Map<string, BayarRow[]>();
  for (const b of bayar) {
    const daftar = perPenugasan.get(b.project_team_id) ?? [];
    daftar.push(b);
    perPenugasan.set(b.project_team_id, daftar);
  }

  return baris.map((r) => hitung(r, aturan, perPenugasan.get(r.id) ?? []));
}

function hitung(r: Row, aturan: FeeRules, bayar: BayarRow[]): ProjectTeamMember {
  const pct = r.pct === null ? null : Number(r.pct);
  const pctBerlaku = pct ?? feeRules.pctPeran(aturan, r.role);
  const feeDesign = r.contract_value === null ? null : Number(r.contract_value);
  const hak = feeDesign !== null && pctBerlaku !== null ? Math.round((feeDesign * pctBerlaku) / 100) : null;

  // Tahap awal dibulatkan, tahap akhir adalah SISANYA — bukan dibulatkan
  // sendiri — supaya keduanya selalu berjumlah persis sebesar hak.
  const awal = hak === null ? null : Math.round((hak * aturan.firstTranchePct) / 100);
  const nominal: Record<PayoutStage, number | null> = {
    awal,
    akhir: hak === null || awal === null ? null : hak - awal,
  };
  const syarat: Record<PayoutStage, boolean> = { awal: r.dp_masuk, akhir: r.desain_selesai };

  const tahap: TahapBayaran[] = (["awal", "akhir"] as const)
    // Tahap bernominal nol (mis. bagian tahap awal 0%) tidak pernah perlu
    // dibayar, dan menampilkannya hanya menambah baris "jatuh tempo Rp0".
    .filter((t) => nominal[t] !== 0 || bayar.some((b) => b.payout_stage === t))
    .map((t) => {
      const b = bayar.find((x) => x.payout_stage === t);
      if (b) {
        return {
          tahap: t, nominal: nominal[t], keadaan: "dibayar" as const,
          costId: b.id, dibayar: Number(b.amount), dibayarPada: b.incurred_on,
        };
      }
      return {
        tahap: t,
        nominal: nominal[t],
        keadaan: nominal[t] === null ? "belum_ditentukan" as const : syarat[t] ? "jatuh_tempo" as const : "menunggu" as const,
        costId: null, dibayar: null, dibayarPada: null,
      };
    });

  const dibayar = bayar.reduce((n, b) => n + Number(b.amount), 0);
  return {
    id: r.id,
    projectId: r.project_id,
    projectTitle: r.project_title,
    teamMemberId: r.team_member_id,
    teamMemberName: r.nama,
    teamMemberKind: r.kind,
    role: r.role,
    pct,
    pctBerlaku,
    note: r.note,
    feeDesign,
    hak,
    dibayar,
    terutang: hak === null ? null : hak - dibayar,
    tahap,
  };
}

/** Ringkasan per orang, untuk slip dan halaman Gaji. */
export async function perOrang(sql: Sql): Promise<TeamPayoutPerson[]> {
  const semua = await list(sql);
  const peta = new Map<string, TeamPayoutPerson>();
  for (const p of semua) {
    const o = peta.get(p.teamMemberId) ?? {
      teamMemberId: p.teamMemberId,
      teamMemberName: p.teamMemberName,
      teamMemberKind: p.teamMemberKind,
      proyek: 0, hak: 0, dibayar: 0, terutang: 0, jatuhTempo: 0, belumDitentukan: 0,
    };
    o.proyek += 1;
    o.dibayar += p.dibayar;
    if (p.hak === null) {
      o.belumDitentukan += 1;
    } else {
      o.hak += p.hak;
      o.terutang += p.hak - p.dibayar;
    }
    for (const t of p.tahap) if (t.keadaan === "jatuh_tempo" && t.nominal) o.jatuhTempo += t.nominal;
    peta.set(p.teamMemberId, o);
  }
  return [...peta.values()].sort((a, b) => b.terutang - a.terutang || a.teamMemberName.localeCompare(b.teamMemberName));
}

function sahPersen(v: unknown): number | null {
  if (v === null) return null;
  if (typeof v !== "number" || !Number.isFinite(v)) throw new Error("persen harus angka");
  if (v < 0 || v > 100) throw new Error("persen harus di antara 0 dan 100");
  return Math.round(v * 100) / 100;
}

function sahCatatan(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const t = String(v).trim();
  if (t.length > 200) throw new Error("catatan paling panjang 200 karakter");
  return t || null;
}

function pesanDuplikat(err: unknown): never {
  if (/duplicate key|unique/i.test((err as Error).message)) {
    throw new Error("orang ini sudah memegang peran itu di proyek ini");
  }
  throw err;
}

/**
 * Menugaskan satu orang ke satu peran.
 *
 * Persen yang tidak dikirim DIAMBIL dari aturan studio saat ini dan
 * dibekukan di penugasan — menaikkan persen bawaan bulan depan tidak boleh
 * diam-diam mengubah hak orang di proyek yang sudah berjalan. Kalau aturan
 * studio untuk peran itu belum ditentukan (Leader, Estimator), yang tersimpan
 * kosong, dan penugasannya ikut terhitung begitu pemilik mengisi aturannya.
 */
export async function add(sql: Sql, projectID: string, input: ProjectTeamInput): Promise<string> {
  const orang = (input.teamMemberId ?? "").trim();
  if (!orang) throw new Error("anggota tim wajib dipilih");
  const peran = (input.role ?? "").trim();
  if (!VALID_TEAM_ROLE.has(peran)) throw new Error("peran tidak sah");

  let pct: number | null;
  if (input.pct === undefined) {
    pct = feeRules.pctPeran(await feeRules.get(sql), peran as TeamRole);
  } else {
    pct = sahPersen(input.pct);
  }

  try {
    const [r] = await sql<{ id: string }[]>`
      insert into public.project_team (project_id, team_member_id, role, pct, note, sort_order)
      values (
        ${projectID}::uuid, ${orang}::uuid, ${peran}::public.team_role, ${pct}, ${sahCatatan(input.note)},
        coalesce((select max(sort_order) + 1 from public.project_team where project_id = ${projectID}::uuid), 0)
      )
      returning id`;
    return r.id;
  } catch (err) {
    pesanDuplikat(err);
  }
}

export async function update(sql: Sql, id: string, input: ProjectTeamInput): Promise<void> {
  type Fragment = ReturnType<Sql>;
  const f: Fragment[] = [];
  if (input.pct !== undefined) f.push(sql`pct = ${sahPersen(input.pct)}`);
  if (input.note !== undefined) f.push(sql`note = ${sahCatatan(input.note)}`);
  if (input.role !== undefined) {
    if (!VALID_TEAM_ROLE.has(input.role)) throw new Error("peran tidak sah");
    f.push(sql`role = ${input.role}::public.team_role`);
  }
  if (input.teamMemberId !== undefined) f.push(sql`team_member_id = ${input.teamMemberId}::uuid`);
  if (f.length === 0) return;

  let set = f[0];
  for (let i = 1; i < f.length; i++) set = sql`${set}, ${f[i]}`;
  try {
    const result = await sql`update public.project_team set ${set} where id = ${id}::uuid`;
    if (result.count === 0) throw new NotFoundError();
  } catch (err) {
    if (err instanceof NotFoundError) throw err;
    pesanDuplikat(err);
  }
}

/** Galat khusus: penugasan yang sudah dibayar tidak boleh hilang. */
export class SudahDibayarError extends Error {
  constructor() {
    super("penugasan ini sudah punya bayaran tercatat — hapus bayarannya dulu kalau memang salah catat");
  }
}

export async function remove(sql: Sql, id: string): Promise<void> {
  try {
    const result = await sql`delete from public.project_team where id = ${id}::uuid`;
    if (result.count === 0) throw new NotFoundError();
  } catch (err) {
    if (err instanceof NotFoundError) throw err;
    if (/foreign key|violates/i.test((err as Error).message)) throw new SudahDibayarError();
    throw err;
  }
}

/**
 * Mencatat satu tahap bayaran sebagai biaya proyek.
 *
 * Tidak menolak tahap yang syaratnya belum terpenuhi: studio kadang membayar
 * lebih awal, dan aturan "5% dulu" adalah kebiasaan, bukan hukum. Yang
 * dicegah cuma membayar tahap yang SAMA dua kali — oleh indeks unik di
 * database, bukan oleh pemeriksaan di sini yang bisa kalah balapan.
 */
export async function bayar(sql: Sql, input: PayoutInput): Promise<string> {
  const id = (input.projectTeamId ?? "").trim();
  if (!id) throw new Error("penugasan wajib dipilih");
  const tahap = (input.tahap ?? "").trim();
  if (!VALID_PAYOUT_STAGE.has(tahap)) throw new Error("tahap bayaran tidak sah");

  const [p] = await list(sql, { id });
  if (!p) throw new NotFoundError();

  const seharusnya = p.tahap.find((t) => t.tahap === tahap)?.nominal ?? null;
  const nominal = input.amount ?? seharusnya;
  if (nominal === null) {
    throw new Error("persen peran atau fee design proyek ini belum ditentukan — isi nominalnya sendiri");
  }
  if (!(nominal > 0)) throw new Error("nominal bayaran harus lebih dari nol");

  const tanggal = (input.paidOn ?? "").trim() || null;
  if (tanggal && !/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) throw new Error("tanggal bayar tidak sah");

  // Partner (Dirga, Adji) dicatat sebagai fee prinsipal, sisanya freelancer —
  // pembagian yang sudah dipakai halaman Fee dan donat Rincian Beban.
  const kategori = p.teamMemberKind === "partner" ? "prinsipal" : "freelancer";
  const label = `${LABEL_PERAN[p.role]} ${p.projectTitle} — tahap ${tahap === "awal" ? "awal (DP masuk)" : "akhir (desain selesai)"}`
    .slice(0, 160);

  try {
    const [r] = await sql<{ id: string }[]>`
      insert into public.project_costs
        (project_id, label, category, amount, incurred_on, team_member_id, project_team_id, payout_stage)
      values (
        ${p.projectId}::uuid, ${label}, ${kategori}::public.cost_category, ${nominal},
        coalesce(${tanggal}::date, current_date), ${p.teamMemberId}::uuid,
        ${id}::uuid, ${tahap}::public.payout_stage
      )
      returning id`;
    return r.id;
  } catch (err) {
    if (/duplicate key|unique/i.test((err as Error).message)) throw new Error("tahap ini sudah dibayar");
    throw err;
  }
}
