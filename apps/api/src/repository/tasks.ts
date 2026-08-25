import type { Sql } from "postgres";
import type { ProjectTask, ProjectTaskInput } from "../types";
import { NotFoundError } from "./projects";

interface Row {
  id: string;
  project_id: string;
  project_title?: string;
  title: string;
  stage: string | null;
  assignee_id: string | null;
  assignee_name?: string | null;
  status: string;
  due_date: string | null;
  sort_order: number;
}

function rowToTask(row: Row): ProjectTask {
  return {
    id: row.id,
    projectId: row.project_id,
    projectTitle: row.project_title,
    title: row.title,
    stage: row.stage,
    assigneeId: row.assignee_id,
    assigneeName: row.assignee_name,
    status: row.status,
    dueDate: row.due_date,
    sortOrder: row.sort_order,
  };
}

/** Seluruh tugas lintas proyek — untuk halaman List Kerjaan. */
export async function listAll(sql: Sql): Promise<ProjectTask[]> {
  const rows = await sql<Row[]>`
    select t.id, t.project_id, p.title as project_title, t.title, t.stage,
           t.assignee_id, m.name as assignee_name, t.status, t.due_date, t.sort_order
    from public.project_tasks t
    join public.projects p on p.id = t.project_id
    left join public.team_members m on m.id = t.assignee_id
    order by t.due_date nulls last, t.sort_order`;
  return rows.map(rowToTask);
}

export async function listForProject(sql: Sql, projectID: string): Promise<ProjectTask[]> {
  const rows = await sql<Row[]>`
    select t.id, t.project_id, t.title, t.stage,
           t.assignee_id, m.name as assignee_name, t.status, t.due_date, t.sort_order
    from public.project_tasks t
    left join public.team_members m on m.id = t.assignee_id
    where t.project_id = ${projectID}::uuid
    order by t.sort_order, t.created_at`;
  return rows.map(rowToTask);
}

export async function create(sql: Sql, projectID: string, input: ProjectTaskInput): Promise<string> {
  const title = (input.title ?? "").trim();
  if (title.length < 2) throw new Error("judul tugas wajib diisi");

  const rows = await sql<{ id: string }[]>`
    insert into public.project_tasks (project_id, title, stage, assignee_id, due_date, sort_order)
    values (
      ${projectID}::uuid, ${title},
      ${input.stage ?? null}::public.pipeline_stage,
      ${input.assigneeId ?? null}::uuid,
      ${input.dueDate ?? null}::date,
      ${input.sortOrder ?? 0}
    )
    returning id`;
  return rows[0].id;
}

export async function update(sql: Sql, id: string, input: ProjectTaskInput): Promise<void> {
  type Fragment = ReturnType<Sql>;
  const fragments: Fragment[] = [];

  if (input.title !== undefined) fragments.push(sql`title = ${input.title}`);
  if (input.stage !== undefined) fragments.push(sql`stage = ${input.stage}::public.pipeline_stage`);
  if (input.assigneeId !== undefined) fragments.push(sql`assignee_id = ${input.assigneeId}::uuid`);
  if (input.status !== undefined) fragments.push(sql`status = ${input.status}::public.task_status`);
  if (input.dueDate !== undefined) fragments.push(sql`due_date = ${input.dueDate}::date`);
  if (input.sortOrder !== undefined) fragments.push(sql`sort_order = ${input.sortOrder}`);

  if (fragments.length === 0) return;

  let setClause = fragments[0];
  for (let i = 1; i < fragments.length; i++) setClause = sql`${setClause}, ${fragments[i]}`;

  const result = await sql`update public.project_tasks set ${setClause} where id = ${id}::uuid`;
  if (result.count === 0) throw new NotFoundError();
}

export async function remove(sql: Sql, id: string): Promise<void> {
  const result = await sql`delete from public.project_tasks where id = ${id}::uuid`;
  if (result.count === 0) throw new NotFoundError();
}
