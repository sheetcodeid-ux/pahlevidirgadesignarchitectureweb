import type { Sql } from "postgres";
import type { ClientLogo, ClientLogoInput } from "../types";
import { NotFoundError } from "./projects";

interface Row {
  id: string;
  name: string;
  logo_key: string | null;
  sort_order: number;
}

function url(assetBase: string, key: string | null): string | null {
  if (!key) return null;
  return `${assetBase.replace(/\/$/, "")}/${key.replace(/^\//, "")}`;
}

function rowToLogo(row: Row, assetBase: string): ClientLogo {
  return {
    id: row.id,
    name: row.name,
    logoUrl: url(assetBase, row.logo_key),
    sortOrder: row.sort_order,
  };
}

/**
 * Urutannya sort_order lebih dulu, lalu created_at sebagai pemecah seri —
 * tanpa pemecah itu, dua klien ber-sort_order sama bisa bertukar posisi
 * antar-build dan marquee-nya terlihat acak tiap deploy.
 */
export async function list(sql: Sql, assetBase: string): Promise<ClientLogo[]> {
  const rows = await sql<Row[]>`
    select id, name, logo_key, sort_order
    from public.client_logos
    order by sort_order, created_at`;
  return rows.map((r) => rowToLogo(r, assetBase));
}

export async function create(sql: Sql, input: ClientLogoInput): Promise<string> {
  const rows = await sql<{ id: string }[]>`
    insert into public.client_logos (name, logo_key, sort_order)
    values (${input.name ?? ""}, ${input.logoKey ?? null},
            ${input.sortOrder ?? 0})
    returning id`;
  return rows[0].id;
}

export async function update(sql: Sql, id: string, input: ClientLogoInput): Promise<void> {
  type Fragment = ReturnType<Sql>;
  const fragments: Fragment[] = [];

  if (input.name !== undefined) fragments.push(sql`name = ${input.name}`);
  // null di sini BERARTI sesuatu — hapus logonya — jadi yang diperiksa
  // `!== undefined`, bukan kebenaran nilainya.
  if (input.logoKey !== undefined) fragments.push(sql`logo_key = ${input.logoKey}`);
  if (input.sortOrder !== undefined) fragments.push(sql`sort_order = ${input.sortOrder}`);

  if (fragments.length === 0) return;

  let setClause = fragments[0];
  for (let i = 1; i < fragments.length; i++) setClause = sql`${setClause}, ${fragments[i]}`;

  const result = await sql`update public.client_logos set ${setClause} where id = ${id}::uuid`;
  if (result.count === 0) throw new NotFoundError();
}

export async function remove(sql: Sql, id: string): Promise<void> {
  const result = await sql`delete from public.client_logos where id = ${id}::uuid`;
  if (result.count === 0) throw new NotFoundError();
}
