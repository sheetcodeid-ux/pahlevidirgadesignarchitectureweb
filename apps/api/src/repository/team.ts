import type { Sql } from "postgres";
import type { TeamMember, TeamMemberInput } from "../types";
import { VALID_MEMBER_KIND } from "../types";
import { NotFoundError } from "./projects";

/**
 * Yang TIDAK aktif tetap ikut terbawa, dan itu disengaja: namanya masih
 * menempel di biaya proyek yang sudah tercatat, jadi laporan fee harus tetap
 * bisa menyebutnya. Yang menyembunyikannya dari dropdown adalah pemanggilnya,
 * bukan permintaan ini — menyaringnya di sini berarti nama hilang dari
 * laporan tahun lalu begitu seseorang berhenti dipakai.
 */
export async function list(sql: Sql): Promise<TeamMember[]> {
  const rows = await sql<{
    id: string; name: string; role: string | null;
    kind: TeamMember["kind"]; rate: string | null; phone: string | null; active: boolean;
  }[]>`
    select id, name, role, kind, rate, phone, active
    from public.team_members
    order by active desc, name`;
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    role: r.role,
    kind: r.kind,
    rate: r.rate === null ? null : Number(r.rate),
    phone: r.phone,
    active: r.active,
  }));
}

export async function create(sql: Sql, input: TeamMemberInput): Promise<string> {
  const name = (input.name ?? "").trim();
  if (!name) throw new Error("nama wajib diisi");

  const kind = input.kind ?? "proyek";
  if (!VALID_MEMBER_KIND.has(kind)) throw new Error("jenis anggota tim tidak sah");
  if (input.rate !== undefined && input.rate !== null && input.rate <= 0) {
    throw new Error("tarif harus lebih dari nol");
  }

  const rows = await sql<{ id: string }[]>`
    insert into public.team_members (name, role, kind, rate, phone)
    values (${name}, ${input.role ?? null}, ${kind}::public.member_kind,
            ${input.rate ?? null}, ${input.phone ?? null})
    returning id`;
  return rows[0].id;
}

export async function update(sql: Sql, id: string, input: TeamMemberInput): Promise<void> {
  type Fragment = ReturnType<Sql>;
  const fragments: Fragment[] = [];

  if (input.name !== undefined) fragments.push(sql`name = ${input.name}`);
  if (input.role !== undefined) fragments.push(sql`role = ${input.role}`);
  if (input.kind !== undefined) {
    if (!VALID_MEMBER_KIND.has(input.kind)) throw new Error("jenis anggota tim tidak sah");
    fragments.push(sql`kind = ${input.kind}::public.member_kind`);
  }
  if (input.rate !== undefined) {
    if (input.rate !== null && input.rate <= 0) throw new Error("tarif harus lebih dari nol");
    fragments.push(sql`rate = ${input.rate}`);
  }
  if (input.phone !== undefined) fragments.push(sql`phone = ${input.phone}`);
  if (input.active !== undefined) fragments.push(sql`active = ${input.active}`);

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
