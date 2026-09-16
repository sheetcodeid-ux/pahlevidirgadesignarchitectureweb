import type { Sql } from "postgres";
import type { FeeProject, FeePerson, MemberKind } from "../types";

/**
 * Fee proyek: berapa yang dibayarkan studio kepada orang, dipecah per proyek
 * dan per orang.
 *
 * Sumbernya `project_costs` — bukan tabel baru. Biaya yang tertaut ke seorang
 * anggota tim ADALAH fee-nya; tidak ada nominal kedua yang diketik di tempat
 * lain dan karena itu tidak ada yang bisa menyimpang.
 *
 * Yang tidak tertaut ke siapa pun tidak dibuang dari laporan, melainkan
 * dijumlahkan sendiri sebagai `feeTanpaNama`. Itu bukan hiasan: kolom
 * penautnya baru ada sekarang, jadi seluruh biaya lama memang tidak bernama —
 * dan laporan yang diam-diam menghilangkannya akan terbaca seolah studio
 * hampir tidak pernah membayar siapa-siapa.
 */

/* Rentang tanggal opsional. Keduanya dikirim sebagai satu parameter date yang
   boleh null — BUKAN dirangkai jadi string SQL, dan bukan array (jebakan #16
   di CLAUDE.md: array JavaScript tidak bisa jadi parameter query di Worker). */
interface Rentang {
  dari?: string | null;
  sampai?: string | null;
}

function sahTanggal(v?: string | null): string | null {
  const t = (v ?? "").trim();
  if (!t) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) throw new Error("tanggal tidak sah");
  return t;
}

export async function perProyek(sql: Sql, r: Rentang = {}): Promise<FeeProject[]> {
  const dari = sahTanggal(r.dari);
  const sampai = sahTanggal(r.sampai);

  interface P {
    project_id: string;
    title: string;
    contract_value: string | null;
    fee_total: string;
    fee_tanpa_nama: string;
  }
  interface O {
    project_id: string;
    team_member_id: string;
    name: string;
    kind: MemberKind;
    amount: string;
  }

  /* Biaya yang DIANGGAP fee: yang kategorinya freelancer atau prinsipal.
     Operasional dan lainnya memang bukan bayaran ke orang, dan memasukkannya
     akan membuat "fee terhadap nilai kontrak" berbohong ke atas. */
  const [proyek, orang] = await Promise.all([
    sql<P[]>`
      select p.id as project_id, p.title, p.contract_value,
             coalesce(sum(b.amount) filter (where b.team_member_id is not null), 0) as fee_total,
             coalesce(sum(b.amount) filter (where b.team_member_id is null), 0)     as fee_tanpa_nama
        from public.projects p
        join public.project_costs b on b.project_id = p.id
       where b.category in ('freelancer', 'prinsipal')
         and (${dari}::date   is null or b.incurred_on >= ${dari}::date)
         and (${sampai}::date is null or b.incurred_on <= ${sampai}::date)
       group by p.id, p.title, p.contract_value
       order by p.created_at desc`,
    sql<O[]>`
      select b.project_id, b.team_member_id, t.name, t.kind, sum(b.amount) as amount
        from public.project_costs b
        join public.team_members t on t.id = b.team_member_id
       where b.category in ('freelancer', 'prinsipal')
         and (${dari}::date   is null or b.incurred_on >= ${dari}::date)
         and (${sampai}::date is null or b.incurred_on <= ${sampai}::date)
       group by b.project_id, b.team_member_id, t.name, t.kind
       order by sum(b.amount) desc`,
  ]);

  const perId = new Map<string, FeeProject["orang"]>();
  for (const o of orang) {
    const daftar = perId.get(o.project_id) ?? [];
    daftar.push({
      teamMemberId: o.team_member_id, name: o.name, kind: o.kind, amount: Number(o.amount),
    });
    perId.set(o.project_id, daftar);
  }

  return proyek.map((p) => {
    const kontrak = p.contract_value === null ? null : Number(p.contract_value);
    const total = Number(p.fee_total);
    return {
      projectId: p.project_id,
      projectTitle: p.title,
      contractValue: kontrak,
      feeTotal: total,
      feeTanpaNama: Number(p.fee_tanpa_nama),
      /* null kalau kontraknya belum diisi — BUKAN 0. Nol berarti "tidak ada
         fee sama sekali", dan itu jawaban yang berbeda dari "belum bisa
         dihitung". */
      feeShare: kontrak && kontrak > 0 ? total / kontrak : null,
      orang: perId.get(p.project_id) ?? [],
    };
  });
}

export async function perOrang(sql: Sql, r: Rentang = {}): Promise<FeePerson[]> {
  const dari = sahTanggal(r.dari);
  const sampai = sahTanggal(r.sampai);

  interface Row {
    team_member_id: string;
    name: string;
    kind: MemberKind;
    role: string | null;
    total: string;
    project_count: string;
    last_on: string | null;
  }

  const rows = await sql<Row[]>`
    select t.id as team_member_id, t.name, t.kind, t.role,
           sum(b.amount)                 as total,
           count(distinct b.project_id)  as project_count,
           max(b.incurred_on)::text      as last_on
      from public.project_costs b
      join public.team_members t on t.id = b.team_member_id
     where b.category in ('freelancer', 'prinsipal')
       and (${dari}::date   is null or b.incurred_on >= ${dari}::date)
       and (${sampai}::date is null or b.incurred_on <= ${sampai}::date)
     group by t.id, t.name, t.kind, t.role
     order by sum(b.amount) desc`;

  return rows.map((x) => ({
    teamMemberId: x.team_member_id,
    name: x.name,
    kind: x.kind,
    role: x.role,
    total: Number(x.total),
    projectCount: Number(x.project_count),
    lastOn: x.last_on,
  }));
}
