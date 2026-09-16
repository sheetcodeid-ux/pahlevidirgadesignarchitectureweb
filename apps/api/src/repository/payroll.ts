import type { Sql } from "postgres";
import type { PayrollEntry, PayrollInput, PayrollMonthRow, MemberKind } from "../types";
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
