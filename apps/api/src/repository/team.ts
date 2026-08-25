import type { Sql } from "postgres";
import type { TeamMember, TeamMemberInput } from "../types";
import { NotFoundError } from "./projects";

export async function list(sql: Sql): Promise<TeamMember[]> {
  return sql<TeamMember[]>`
    select id, name, role
    from public.team_members
    order by name`;
}

export async function create(sql: Sql, input: TeamMemberInput): Promise<string> {
  const name = (input.name ?? "").trim();
  if (!name) throw new Error("nama wajib diisi");

  const rows = await sql<{ id: string }[]>`
    insert into public.team_members (name, role)
    values (${name}, ${input.role ?? null})
    returning id`;
  return rows[0].id;
}

export async function update(sql: Sql, id: string, input: TeamMemberInput): Promise<void> {
  type Fragment = ReturnType<Sql>;
  const fragments: Fragment[] = [];

  if (input.name !== undefined) fragments.push(sql`name = ${input.name}`);
  if (input.role !== undefined) fragments.push(sql`role = ${input.role}`);

  if (fragments.length === 0) return;

  let setClause = fragments[0];
  for (let i = 1; i < fragments.length; i++) setClause = sql`${setClause}, ${fragments[i]}`;

  const result = await sql`update public.team_members set ${setClause} where id = ${id}::uuid`;
  if (result.count === 0) throw new NotFoundError();
}

export async function remove(sql: Sql, id: string): Promise<void> {
  const result = await sql`delete from public.team_members where id = ${id}::uuid`;
  if (result.count === 0) throw new NotFoundError();
}
