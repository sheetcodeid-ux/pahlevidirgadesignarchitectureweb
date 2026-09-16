import type { Sql } from "postgres";
import type { ProjectCost, ProjectCostInput } from "../types";
import { NotFoundError } from "./projects";

interface Row {
  id: string;
  project_id: string;
  label: string;
  category: string;
  amount: string;
  incurred_on: string;
  team_member_id: string | null;
  team_member_name: string | null;
}

function rowToCost(row: Row): ProjectCost {
  return {
    id: row.id,
    projectId: row.project_id,
    label: row.label,
    category: row.category,
    amount: Number(row.amount),
    incurredOn: row.incurred_on,
    teamMemberId: row.team_member_id,
    teamMemberName: row.team_member_name,
  };
}

export async function listForProject(sql: Sql, projectID: string): Promise<ProjectCost[]> {
  const rows = await sql<Row[]>`
    select b.id, b.project_id, b.label, b.category, b.amount, b.incurred_on,
           b.team_member_id, t.name as team_member_name
      from public.project_costs b
      left join public.team_members t on t.id = b.team_member_id
     where b.project_id = ${projectID}::uuid
     order by b.incurred_on, b.created_at`;
  return rows.map(rowToCost);
}

/**
 * Seluruh biaya lintas proyek — yang dibaca halaman Kas & Biaya.
 *
 * Halaman itu satu-satunya pintu untuk mencatat pengeluaran sejak "Kerja
 * Internal" dibuang, jadi ia butuh daftar yang tidak terikat satu proyek.
 * Judul proyeknya ikut dibawa supaya tabelnya tidak perlu permintaan kedua
 * untuk menerjemahkan id jadi nama.
 */
export async function listAll(sql: Sql, limit = 200): Promise<ProjectCost[]> {
  const rows = await sql<(Row & { project_title: string })[]>`
    select b.id, b.project_id, b.label, b.category, b.amount, b.incurred_on,
           b.team_member_id, t.name as team_member_name, p.title as project_title
      from public.project_costs b
      join public.projects p on p.id = b.project_id
      left join public.team_members t on t.id = b.team_member_id
     order by b.incurred_on desc, b.created_at desc
     limit ${Math.min(Math.max(limit, 1), 500)}`;
  return rows.map((r) => ({ ...rowToCost(r), projectTitle: r.project_title }));
}

export async function create(sql: Sql, projectID: string, input: ProjectCostInput): Promise<string> {
  const label = (input.label ?? "").trim();
  if (label.length < 2) throw new Error("label biaya wajib diisi");
  if (!input.amount || input.amount <= 0) throw new Error("nominal biaya harus lebih dari nol");

  // Tanggal kosong berarti hari ini — staf yang mencatat nota hari ini tidak
  // perlu mengetik tanggalnya lagi, dan yang mencatat nota lama tinggal
  // menggantinya.
  const tanggal = (input.incurredOn ?? "").trim() || null;
  if (tanggal && !/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) throw new Error("tanggal biaya tidak sah");

  // Kosong berarti biaya ini memang bukan milik siapa pun (sewa, cetak,
  // perizinan). Yang dikirim string kosong disamakan dengan null supaya
  // dropdown yang dibiarkan di pilihan pertama tidak jadi uuid tidak sah.
  const orang = (input.teamMemberId ?? "").trim() || null;

  const rows = await sql<{ id: string }[]>`
    insert into public.project_costs (project_id, label, category, amount, incurred_on, team_member_id)
    values (
      ${projectID}::uuid, ${label},
      ${(input.category ?? "lainnya") as string}::public.cost_category,
      ${input.amount},
      coalesce(${tanggal}::date, current_date),
      ${orang}::uuid
    )
    returning id`;
  return rows[0].id;
}

export async function remove(sql: Sql, id: string): Promise<void> {
  const result = await sql`delete from public.project_costs where id = ${id}::uuid`;
  if (result.count === 0) throw new NotFoundError();
}
