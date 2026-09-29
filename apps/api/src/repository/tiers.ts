import type { Sql } from "postgres";
import type { ServiceTier, ServiceTierInput, TierGroup } from "../types";
import { NotFoundError } from "./projects";

interface Row {
  id: string;
  group_key: TierGroup;
  slug: string;
  name: string;
  summary: string;
  fee_min: number;
  fee_max: number;
  for_whom: string;
  includes_heading: string;
  includes: string;
  is_highlighted: boolean;
  is_active: boolean;
  sort_order: number;
  updated_at: Date | string;
}

/** Galat khusus: slug sudah dipakai paket lain. */
export class SlugTakenError extends Error {}

function rowToTier(r: Row): ServiceTier {
  return {
    id: r.id,
    group: r.group_key,
    slug: r.slug,
    name: r.name,
    summary: r.summary,
    feeMin: r.fee_min,
    feeMax: r.fee_max,
    forWhom: r.for_whom,
    includesHeading: r.includes_heading,
    // Satu butir per baris di database; baris kosong dibuang supaya enter
    // berlebih di akhir isian tidak jadi butir kosong di beranda.
    includes: r.includes.split("\n").map((b) => b.trim()).filter(Boolean),
    highlighted: r.is_highlighted,
    active: r.is_active,
    sortOrder: r.sort_order,
    updatedAt: new Date(r.updated_at).toISOString(),
  };
}

const KOLOM = "id, group_key, slug, name, summary, fee_min, fee_max, for_whom, includes_heading, includes, is_highlighted, is_active, sort_order, updated_at";

/**
 * `semua` false = hanya yang aktif (beranda). Urutannya kelompok, lalu
 * sort_order, lalu created_at sebagai pemecah seri — tanpa itu dua paket
 * ber-urutan sama bisa bertukar tempat antar-build.
 */
export async function list(sql: Sql, semua: boolean): Promise<ServiceTier[]> {
  const rows = semua
    ? await sql<Row[]>`select ${sql.unsafe(KOLOM)} from public.service_tiers
        order by group_key, sort_order, created_at`
    : await sql<Row[]>`select ${sql.unsafe(KOLOM)} from public.service_tiers
        where is_active order by group_key, sort_order, created_at`;
  return rows.map(rowToTier);
}

export async function get(sql: Sql, id: string): Promise<ServiceTier> {
  const rows = await sql<Row[]>`select ${sql.unsafe(KOLOM)} from public.service_tiers where id = ${id}::uuid`;
  if (rows.length === 0) throw new NotFoundError();
  return rowToTier(rows[0]);
}

function unik(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === "23505";
}

export async function create(sql: Sql, input: ServiceTierInput): Promise<string> {
  try {
    const rows = await sql<{ id: string }[]>`
      insert into public.service_tiers
        (group_key, slug, name, summary, fee_min, fee_max, for_whom,
         includes_heading, includes, is_highlighted, is_active, sort_order)
      values (${input.group ?? ""}, ${input.slug ?? ""}, ${(input.name ?? "").trim()},
              ${input.summary ?? ""}, ${input.feeMin ?? 0}, ${input.feeMax ?? 0},
              ${input.forWhom ?? ""}, ${input.includesHeading ?? "Yang Anda dapat"},
              ${(input.includes ?? []).join("\n")}, ${input.highlighted ?? false},
              ${input.active ?? true},
              ${input.sortOrder ?? 0})
      returning id`;
    return rows[0].id;
  } catch (err) {
    if (unik(err)) throw new SlugTakenError();
    throw err;
  }
}

export async function update(sql: Sql, id: string, input: ServiceTierInput): Promise<void> {
  type Fragment = ReturnType<Sql>;
  const f: Fragment[] = [];
  if (input.group !== undefined) f.push(sql`group_key = ${input.group}`);
  if (input.slug !== undefined) f.push(sql`slug = ${input.slug}`);
  if (input.name !== undefined) f.push(sql`name = ${input.name.trim()}`);
  if (input.summary !== undefined) f.push(sql`summary = ${input.summary}`);
  if (input.feeMin !== undefined) f.push(sql`fee_min = ${input.feeMin}`);
  if (input.feeMax !== undefined) f.push(sql`fee_max = ${input.feeMax}`);
  if (input.forWhom !== undefined) f.push(sql`for_whom = ${input.forWhom}`);
  if (input.includesHeading !== undefined) f.push(sql`includes_heading = ${input.includesHeading}`);
  if (input.includes !== undefined) f.push(sql`includes = ${input.includes.join("\n")}`);
  if (input.highlighted !== undefined) f.push(sql`is_highlighted = ${input.highlighted}`);
  if (input.active !== undefined) f.push(sql`is_active = ${input.active}`);
  if (input.sortOrder !== undefined) f.push(sql`sort_order = ${input.sortOrder}`);
  if (f.length === 0) return;

  let set = f[0];
  for (let i = 1; i < f.length; i++) set = sql`${set}, ${f[i]}`;
  try {
    const r = await sql`update public.service_tiers set ${set} where id = ${id}::uuid`;
    if (r.count === 0) throw new NotFoundError();
  } catch (err) {
    if (unik(err)) throw new SlugTakenError();
    throw err;
  }
}

export async function remove(sql: Sql, id: string): Promise<void> {
  const r = await sql`delete from public.service_tiers where id = ${id}::uuid`;
  if (r.count === 0) throw new NotFoundError();
}
