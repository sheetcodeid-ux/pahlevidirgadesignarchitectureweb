import type { Sql } from "postgres";
import type {
  MemberKind, PayoutStage, PaySlip, PaySlipMonth, PayrollEntry, PayrollInput, PayrollMonthRow, TeamRole,
} from "../types";
import { NotFoundError } from "./projects";

/**
 * Gaji bulanan — dan HANYA gaji bulanan.
 *
 * Bayaran freelancer tidak dicatat di tabel ini. Ia sudah tercatat sebagai
 * biaya proyek, dan `bulan()` di bawah menjumlahkannya dari sana. Aturannya
 * satu kalimat: satu nominal hanya boleh diketik di satu tempat. Kalau
 * seorang freelancer diketik di dua tempat, beban studio tercatat dua kali
 * dan laba bersihnya salah — kesalahan yang baru terlihat saat tutup buku.
 */

/** 'YYYY-MM' atau 'YYYY-MM-DD' → tanggal 1 bulan itu. */
function awalBulan(v: string): string {
  const t = v.trim();
  if (/^\d{4}-\d{2}$/.test(t)) return `${t}-01`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return `${t.slice(0, 7)}-01`;
  throw new Error("periode gaji tidak sah");
}

interface Row {
  id: string;
  team_member_id: string;
  nama: string;
  period: string;
  amount: string;
  paid_on: string | null;
  note: string | null;
}

const keEntry = (r: Row): PayrollEntry => ({
  id: r.id,
  teamMemberId: r.team_member_id,
  teamMemberName: r.nama,
  period: r.period,
  amount: Number(r.amount),
  paidOn: r.paid_on,
  note: r.note,
});

export async function list(sql: Sql, period?: string | null): Promise<PayrollEntry[]> {
  const bulan = period ? awalBulan(period) : null;
  const rows = await sql<Row[]>`
    select g.id, g.team_member_id, t.name as nama, g.period::text, g.amount,
           g.paid_on::text, g.note
      from public.payroll g
      join public.team_members t on t.id = g.team_member_id
     where ${bulan}::date is null or g.period = ${bulan}::date
     order by g.period desc, t.name`;
  return rows.map(keEntry);
}

/**
 * Satu bulan penuh: tiap orang yang PUNYA gaji bulan itu atau MENERIMA fee
 * proyek bulan itu, dengan kedua angkanya dipisah.
 *
 * `full join` dua agregat, bukan dua permintaan yang digabung di frontend:
 * orang bisa muncul hanya di salah satunya (partner yang bulan ini tidak
 * mengerjakan proyek, freelancer yang tidak digaji), dan menggabungnya di
 * frontend berarti dua tempat lagi yang bisa menyimpang.
 */
export async function bulan(sql: Sql, period: string): Promise<PayrollMonthRow[]> {
  const awal = awalBulan(period);

  interface B {
    team_member_id: string;
    name: string;
    kind: MemberKind;
    role: string | null;
    salary_id: string | null;
    salary_amount: string | null;
    salary_paid_on: string | null;
    salary_note: string | null;
    fee_amount: string;
    fee_count: string;
  }

  const rows = await sql<B[]>`
    with fee as (
      select b.team_member_id, sum(b.amount) as jumlah, count(*) as banyak
        from public.project_costs b
       where b.team_member_id is not null
         and b.incurred_on >= ${awal}::date
         and b.incurred_on <  (${awal}::date + interval '1 month')
       group by b.team_member_id
    ),
    gaji as (
      select g.team_member_id, g.id, g.amount, g.paid_on, g.note
        from public.payroll g
       where g.period = ${awal}::date
    )
    select t.id           as team_member_id,
           t.name,
           t.kind,
           t.role,
           gaji.id        as salary_id,
           gaji.amount    as salary_amount,
           gaji.paid_on::text as salary_paid_on,
           gaji.note      as salary_note,
           coalesce(fee.jumlah, 0) as fee_amount,
           coalesce(fee.banyak, 0) as fee_count
      from public.team_members t
      left join fee  on fee.team_member_id  = t.id
      left join gaji on gaji.team_member_id = t.id
     where gaji.id is not null or fee.jumlah is not null
     order by t.kind, t.name`;

  return rows.map((r) => {
    const gaji = r.salary_amount === null ? null : Number(r.salary_amount);
    const fee = Number(r.fee_amount);
    return {
      teamMemberId: r.team_member_id,
      name: r.name,
      kind: r.kind,
      role: r.role,
      salaryId: r.salary_id,
      salaryAmount: gaji,
      salaryPaidOn: r.salary_paid_on,
      salaryNote: r.salary_note,
      feeAmount: fee,
      feeCount: Number(r.fee_count),
      total: (gaji ?? 0) + fee,
    };
  });
}

/**
 * Slip satu orang satu bulan: gaji bulan itu + setiap biaya proyek atas
 * namanya yang TERJADI bulan itu — saringan yang sama persis dengan `bulan()`,
 * supaya total slip selalu sama dengan kolom Total di halaman Gaji.
 *
 * Fee yang dibayar lewat Tim & Bayaran membawa peran, persen, dan tahapnya;
 * fee yang diketik tangan di Catat Pengeluaran tetap ikut, cuma tanpa itu.
 */
export async function slip(sql: Sql, teamMemberId: string, period: string): Promise<PaySlip | null> {
  const awal = awalBulan(period);
  const id = teamMemberId.trim();
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("orang tidak sah");

  interface O { name: string; kind: MemberKind; role: string | null; phone: string | null }
  interface G { id: string; amount: string; paid_on: string | null; note: string | null }
  interface F {
    id: string; project_id: string; title: string; label: string; amount: string; incurred_on: string;
    role: TeamRole | null; pct: string | null; payout_stage: PayoutStage | null;
  }

  const [[orang], [gaji], fee, [aturan]] = await Promise.all([
    sql<O[]>`select name, kind, role, phone from public.team_members where id = ${id}::uuid`,
    sql<G[]>`
      select id, amount, paid_on::text, note from public.payroll
       where team_member_id = ${id}::uuid and period = ${awal}::date`,
    sql<F[]>`
      select b.id, b.project_id, p.title, b.label, b.amount, b.incurred_on::text,
             pt.role, pt.pct, b.payout_stage
        from public.project_costs b
        join public.projects p on p.id = b.project_id
        left join public.project_team pt on pt.id = b.project_team_id
       where b.team_member_id = ${id}::uuid
         and b.incurred_on >= ${awal}::date
         and b.incurred_on <  (${awal}::date + interval '1 month')
       order by b.incurred_on, b.created_at`,
    // Persen penugasan yang KOSONG ikut aturan studio — sama dengan Tim & Bayaran.
    sql<{ pct_leader: string | null; pct_drafter: string | null; pct_render: string | null; pct_estimator: string | null }[]>`
      select pct_leader, pct_drafter, pct_render, pct_estimator from public.studio_fee_settings`,
  ]);
  if (!orang) return null;

  const bawaan = (r: TeamRole | null): number | null => {
    if (!r || !aturan) return null;
    const v = { leader: aturan.pct_leader, drafter: aturan.pct_drafter, render: aturan.pct_render, estimator: aturan.pct_estimator }[r];
    return v === null ? null : Number(v);
  };

  const fees = fee.map((f) => ({
    costId: f.id,
    projectId: f.project_id,
    projectTitle: f.title,
    label: f.label,
    amount: Number(f.amount),
    incurredOn: f.incurred_on,
    role: f.role,
    pct: f.role === null ? null : f.pct !== null ? Number(f.pct) : bawaan(f.role),
    payoutStage: f.payout_stage,
  }));
  const salaryAmount = gaji ? Number(gaji.amount) : 0;
  const feeAmount = fees.reduce((n, f) => n + f.amount, 0);
  return {
    teamMemberId: id,
    name: orang.name,
    kind: orang.kind,
    role: orang.role,
    phone: orang.phone,
    period: awal,
    salary: gaji ? { id: gaji.id, amount: salaryAmount, paidOn: gaji.paid_on, note: gaji.note } : null,
    fees,
    salaryAmount,
    feeAmount,
    total: salaryAmount + feeAmount,
  };
}

/**
 * Riwayat slip satu orang: `jumlah` bulan berakhir di `sampai` (termasuk),
 * terlama lebih dulu. Saringannya SAMA dengan `slip()` — gaji dari `payroll`
 * pada bulan itu, fee dari `project_costs` atas nama orang itu yang terjadi
 * di bulan itu — jadi batang riwayat dan total slip bulan yang sama tidak
 * bisa berbeda (dijaga tes). Bulan tanpa apa pun tetap dikirim sebagai 0:
 * yang menggambar butuh dua belas kolom, bukan hanya bulan yang berisi.
 */
export async function riwayatSlip(sql: Sql, teamMemberId: string, sampai: string, jumlah = 12): Promise<PaySlipMonth[]> {
  const akhir = awalBulan(sampai);
  const id = teamMemberId.trim();
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("orang tidak sah");
  const n = Math.min(Math.max(Math.trunc(jumlah), 1), 24);
  const rows = await sql<{ period: string; gaji: string; gaji_ada: number; gaji_belum: number; fee: string; fee_n: number }[]>`
    with bulan as (
      select (${akhir}::date - make_interval(months => i))::date as awal
        from generate_series(0, ${n - 1}::int) as i
    )
    select to_char(b.awal, 'YYYY-MM') as period,
           coalesce(g.jumlah, 0) as gaji,
           coalesce(g.ada, 0)::int as gaji_ada,
           coalesce(g.belum, 0)::int as gaji_belum,
           coalesce(f.jumlah, 0) as fee,
           coalesce(f.n, 0)::int as fee_n
      from bulan b
      left join lateral (
        select sum(amount) as jumlah, count(*) as ada, count(*) filter (where paid_on is null) as belum
          from public.payroll
         where team_member_id = ${id}::uuid and period = b.awal
      ) g on true
      left join lateral (
        select sum(c.amount) as jumlah, count(*) as n
          from public.project_costs c
          join public.projects p on p.id = c.project_id
         where c.team_member_id = ${id}::uuid
           and c.incurred_on >= b.awal
           and c.incurred_on <  (b.awal + interval '1 month')
      ) f on true
     order by b.awal`;
  return rows.map((r) => {
    const salary = Number(r.gaji);
    const fee = Number(r.fee);
    return {
      period: r.period,
      salary,
      salaryPaid: r.gaji_ada === 0 ? null : r.gaji_belum === 0,
      fee,
      feeCount: r.fee_n,
      total: salary + fee,
    };
  });
}

export async function create(sql: Sql, input: PayrollInput): Promise<string> {
  const orang = (input.teamMemberId ?? "").trim();
  if (!orang) throw new Error("orang wajib dipilih");
  if (!input.period) throw new Error("periode wajib diisi");
  if (!input.amount || input.amount <= 0) throw new Error("nominal gaji harus lebih dari nol");

  const rows = await sql<{ id: string }[]>`
    insert into public.payroll (team_member_id, period, amount, paid_on, note)
    values (${orang}::uuid, ${awalBulan(input.period)}::date, ${input.amount},
            ${input.paidOn ?? null}::date, ${input.note ?? null})
    returning id`;
  return rows[0].id;
}

export async function update(sql: Sql, id: string, input: PayrollInput): Promise<void> {
  type Fragment = ReturnType<Sql>;
  const bagian: Fragment[] = [];

  if (input.amount !== undefined) {
    if (!input.amount || input.amount <= 0) throw new Error("nominal gaji harus lebih dari nol");
    bagian.push(sql`amount = ${input.amount}`);
  }
  // `paidOn` null adalah nilai yang SAH dan berarti "batalkan tanda dibayar",
  // jadi yang diperiksa `undefined`, bukan falsy.
  if (input.paidOn !== undefined) bagian.push(sql`paid_on = ${input.paidOn}::date`);
  if (input.note !== undefined) bagian.push(sql`note = ${input.note}`);
  if (bagian.length === 0) return;

  let set = bagian[0];
  for (let i = 1; i < bagian.length; i++) set = sql`${set}, ${bagian[i]}`;

  const hasil = await sql`update public.payroll set ${set} where id = ${id}::uuid`;
  if (hasil.count === 0) throw new NotFoundError();
}

export async function remove(sql: Sql, id: string): Promise<void> {
  const hasil = await sql`delete from public.payroll where id = ${id}::uuid`;
  if (hasil.count === 0) throw new NotFoundError();
}
