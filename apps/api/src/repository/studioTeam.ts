import type { Sql } from "postgres";
import type { StudioPerson, StudioPersonInput } from "../types";
import { NotFoundError } from "./projects";

interface Row {
  id: string;
  name: string | null;
  role: string;
  bio: string | null;
  photo_key: string | null;
  slot_label: string;
  sort_order: number;
}

function url(assetBase: string, key: string | null): string | null {
  if (!key) return null;
  return `${assetBase.replace(/\/$/, "")}/${key.replace(/^\//, "")}`;
}

function rowToMember(row: Row, assetBase: string): StudioPerson {
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    bio: row.bio,
    photoUrl: url(assetBase, row.photo_key),
    slotLabel: row.slot_label,
    sortOrder: row.sort_order,
  };
}

/**
 * Urutannya sort_order lebih dulu, created_at sebagai pemecah seri — tanpa
 * pemecah itu, dua orang ber-sort_order sama bisa bertukar posisi antar-build
 * dan susunan halaman /studio terlihat acak tiap deploy.
 */
export async function list(sql: Sql, assetBase: string): Promise<StudioPerson[]> {
  const rows = await sql<Row[]>`
    select id, name, role, bio, photo_key, slot_label, sort_order
    from public.studio_team
    order by sort_order, created_at`;
  return rows.map((r) => rowToMember(r, assetBase));
}

export async function create(sql: Sql, input: StudioPersonInput): Promise<string> {
  const rows = await sql<{ id: string }[]>`
    insert into public.studio_team (name, role, bio, photo_key, slot_label, sort_order)
    values (${input.name ?? null}, ${input.role ?? ""}, ${input.bio ?? null},
            ${input.photoKey ?? null}, ${input.slotLabel ?? "STAFF"},
            ${input.sortOrder ?? 0})
    returning id`;
  return rows[0].id;
}

export async function update(sql: Sql, id: string, input: StudioPersonInput): Promise<void> {
  type Fragment = ReturnType<Sql>;
  const fragments: Fragment[] = [];

  // `null` di sini BERARTI sesuatu — kosongkan namanya, hapus fotonya — jadi
  // yang diperiksa `!== undefined`, bukan kebenaran nilainya.
  if (input.name !== undefined) fragments.push(sql`name = ${input.name}`);
  if (input.role !== undefined) fragments.push(sql`role = ${input.role}`);
  if (input.bio !== undefined) fragments.push(sql`bio = ${input.bio}`);
  if (input.photoKey !== undefined) fragments.push(sql`photo_key = ${input.photoKey}`);
  if (input.slotLabel !== undefined) fragments.push(sql`slot_label = ${input.slotLabel}`);
  if (input.sortOrder !== undefined) fragments.push(sql`sort_order = ${input.sortOrder}`);

  if (fragments.length === 0) return;

  let setClause = fragments[0];
  for (let i = 1; i < fragments.length; i++) setClause = sql`${setClause}, ${fragments[i]}`;

  const result = await sql`update public.studio_team set ${setClause} where id = ${id}::uuid`;
  if (result.count === 0) throw new NotFoundError();
}

export async function remove(sql: Sql, id: string): Promise<void> {
  const result = await sql`delete from public.studio_team where id = ${id}::uuid`;
  if (result.count === 0) throw new NotFoundError();
}
