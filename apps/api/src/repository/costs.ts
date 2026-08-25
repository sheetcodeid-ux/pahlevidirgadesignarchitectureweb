import type { Sql } from "postgres";
import type { ProjectCost, ProjectCostInput } from "../types";
import { NotFoundError } from "./projects";

interface Row {
  id: string;
  project_id: string;
  label: string;
  category: string;
  amount: string;
}

function rowToCost(row: Row): ProjectCost {
  return {
    id: row.id,
    projectId: row.project_id,
    label: row.label,
    category: row.category,
    amount: Number(row.amount),
  };
}

export async function listForProject(sql: Sql, projectID: string): Promise<ProjectCost[]> {
  const rows = await sql<Row[]>`
    select id, project_id, label, category, amount
    from public.project_costs
    where project_id = ${projectID}::uuid
    order by created_at`;
  return rows.map(rowToCost);
}

export async function create(sql: Sql, projectID: string, input: ProjectCostInput): Promise<string> {
  const label = (input.label ?? "").trim();
  if (label.length < 2) throw new Error("label biaya wajib diisi");
  if (!input.amount || input.amount <= 0) throw new Error("nominal biaya harus lebih dari nol");

  const rows = await sql<{ id: string }[]>`
    insert into public.project_costs (project_id, label, category, amount)
    values (${projectID}::uuid, ${label}, ${(input.category ?? "lainnya") as string}::public.cost_category, ${input.amount})
    returning id`;
  return rows[0].id;
}

export async function remove(sql: Sql, id: string): Promise<void> {
  const result = await sql`delete from public.project_costs where id = ${id}::uuid`;
  if (result.count === 0) throw new NotFoundError();
}
