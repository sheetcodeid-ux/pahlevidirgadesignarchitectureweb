import type { Sql } from "postgres";
import type { Invoice, InvoiceInput } from "../types";
import { NotFoundError } from "./projects";

interface Row {
  id: string;
  project_id: string;
  label: string;
  amount: string;
  status: string;
  due_date: string | null;
  paid_at: string | null;
  sort_order: number;
}

function rowToInvoice(row: Row): Invoice {
  return {
    id: row.id,
    projectId: row.project_id,
    label: row.label,
    amount: Number(row.amount),
    status: row.status,
    dueDate: row.due_date,
    paidAt: row.paid_at,
    sortOrder: row.sort_order,
  };
}

export async function listForProject(sql: Sql, projectID: string): Promise<Invoice[]> {
  const rows = await sql<Row[]>`
    select id, project_id, label, amount, status, due_date, paid_at, sort_order
    from public.invoices
    where project_id = ${projectID}::uuid
    order by sort_order, created_at`;
  return rows.map(rowToInvoice);
}

export async function create(sql: Sql, projectID: string, input: InvoiceInput): Promise<string> {
  const label = (input.label ?? "").trim();
  if (label.length < 2) throw new Error("label invoice wajib diisi");
  if (!input.amount || input.amount <= 0) throw new Error("nominal invoice harus lebih dari nol");

  const rows = await sql<{ id: string }[]>`
    insert into public.invoices (project_id, label, amount, due_date, sort_order)
    values (${projectID}::uuid, ${label}, ${input.amount}, ${input.dueDate ?? null}::date, ${input.sortOrder ?? 0})
    returning id`;
  return rows[0].id;
}

export async function update(sql: Sql, id: string, input: InvoiceInput): Promise<void> {
  type Fragment = ReturnType<Sql>;
  const fragments: Fragment[] = [];

  if (input.label !== undefined) fragments.push(sql`label = ${input.label}`);
  if (input.amount !== undefined) fragments.push(sql`amount = ${input.amount}`);
  if (input.dueDate !== undefined) fragments.push(sql`due_date = ${input.dueDate}::date`);
  if (input.status !== undefined) {
    fragments.push(sql`status = ${input.status}::public.invoice_status`);
    // paid_at mengikuti status: diisi otomatis saat lunas, dikosongkan kalau
    // statusnya ditarik mundur — supaya tidak ada invoice "lunas" tanpa
    // tanggal, atau "draft" yang masih menyimpan tanggal lunas lama.
    fragments.push(sql`paid_at = case when ${input.status} = 'lunas' then coalesce(paid_at, now()) else null end`);
  }

  if (fragments.length === 0) return;

  let setClause = fragments[0];
  for (let i = 1; i < fragments.length; i++) setClause = sql`${setClause}, ${fragments[i]}`;

  const result = await sql`update public.invoices set ${setClause} where id = ${id}::uuid`;
  if (result.count === 0) throw new NotFoundError();
}

export async function remove(sql: Sql, id: string): Promise<void> {
  const result = await sql`delete from public.invoices where id = ${id}::uuid`;
  if (result.count === 0) throw new NotFoundError();
}
