import type { Sql } from "postgres";
import type { DirectoryContact, DirectoryContactInput } from "../types";
import { NotFoundError } from "./projects";

interface Row {
  id: string;
  name: string;
  category: string;
  company: string | null;
  phone: string | null;
  email: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
}

function rowToContact(row: Row): DirectoryContact {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    company: row.company,
    phone: row.phone,
    email: row.email,
    note: row.note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function list(sql: Sql): Promise<DirectoryContact[]> {
  const rows = await sql<Row[]>`
    select id, name, category, company, phone, email, note, created_at, updated_at
    from public.directory_contacts
    order by category, name`;
  return rows.map(rowToContact);
}

export async function create(sql: Sql, input: DirectoryContactInput): Promise<string> {
  const name = (input.name ?? "").trim();
  if (name.length < 2) throw new Error("nama kontak wajib diisi");

  const rows = await sql<{ id: string }[]>`
    insert into public.directory_contacts (name, category, company, phone, email, note)
    values (
      ${name},
      coalesce(${input.category ?? null}, 'lainnya')::public.contact_category,
      ${input.company ?? null}, ${input.phone ?? null}, ${input.email ?? null}, ${input.note ?? null}
    )
    returning id`;
  return rows[0].id;
}

export async function update(sql: Sql, id: string, input: DirectoryContactInput): Promise<void> {
  type Fragment = ReturnType<Sql>;
  const fragments: Fragment[] = [];

  if (input.name !== undefined) fragments.push(sql`name = ${input.name}`);
  if (input.category !== undefined) fragments.push(sql`category = ${input.category}::public.contact_category`);
  if (input.company !== undefined) fragments.push(sql`company = ${input.company}`);
  if (input.phone !== undefined) fragments.push(sql`phone = ${input.phone}`);
  if (input.email !== undefined) fragments.push(sql`email = ${input.email}`);
  if (input.note !== undefined) fragments.push(sql`note = ${input.note}`);

  if (fragments.length === 0) return;

  let setClause = fragments[0];
  for (let i = 1; i < fragments.length; i++) setClause = sql`${setClause}, ${fragments[i]}`;

  const result = await sql`update public.directory_contacts set ${setClause} where id = ${id}::uuid`;
  if (result.count === 0) throw new NotFoundError();
}

export async function remove(sql: Sql, id: string): Promise<void> {
  const result = await sql`delete from public.directory_contacts where id = ${id}::uuid`;
  if (result.count === 0) throw new NotFoundError();
}
