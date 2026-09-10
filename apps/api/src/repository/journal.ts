import type { Sql } from "postgres";
import type { JournalPost, JournalPostInput, JournalCategory } from "../types";
import { NotFoundError } from "./projects";

interface Row {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  body: string | null;
  category: string;
  read_minutes: number;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

function rowToPost(row: Row): JournalPost {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    body: row.body,
    category: row.category as JournalCategory,
    readMinutes: row.read_minutes,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const KOLOM = `id, slug, title, excerpt, body, category::text as category,
               read_minutes, published_at, created_at, updated_at`;

/**
 * Dilihat pengunjung. Yang berencana dan yang tanggalnya masih di depan tidak
 * ikut — syarat yang sama persis dengan policy RLS-nya.
 *
 * Disaring di sini JUGA, bukan hanya mengandalkan RLS: Worker API menyentuh
 * database lewat Hyperdrive sebagai peran yang MELEWATI RLS, jadi policy itu
 * tidak berlaku untuk query ini. Itu invarian keamanan nomor dua di CLAUDE.md
 * dalam bentuk yang paling gampang terlupakan — bukan endpoint admin, tapi
 * tetap query yang harus menyaring sendiri.
 */
export async function listPublished(sql: Sql): Promise<JournalPost[]> {
  const rows = await sql<Row[]>`
    select ${sql.unsafe(KOLOM)}
    from public.journal_posts
    where published_at is not null and published_at <= now()
    order by published_at desc`;
  return rows.map(rowToPost);
}

/**
 * Termasuk yang berencana — dipakai indeks /jurnal, yang di rancangan
 * memang menampilkan tulisan yang belum ditulis sebagai "RENCANA" bertanda
 * tegas. Isinya (body) SENGAJA tidak ikut: indeks tidak memakainya, dan draf
 * yang belum terbit tidak perlu ikut terkirim ke halaman publik.
 */
export async function listForIndex(sql: Sql): Promise<JournalPost[]> {
  const rows = await sql<Row[]>`
    select id, slug, title, excerpt, null as body, category::text as category,
           read_minutes, published_at, created_at, updated_at
    from public.journal_posts
    order by published_at desc nulls last, created_at desc`;
  return rows.map(rowToPost);
}

/** Satu tulisan yang sudah terbit. Draf tidak bisa dibuka lewat URL-nya. */
export async function getPublishedBySlug(sql: Sql, slug: string): Promise<JournalPost | null> {
  const rows = await sql<Row[]>`
    select ${sql.unsafe(KOLOM)}
    from public.journal_posts
    where slug = ${slug} and published_at is not null and published_at <= now()`;
  return rows[0] ? rowToPost(rows[0]) : null;
}

/** Seluruhnya, termasuk draf — dilihat staf. */
export async function listAll(sql: Sql): Promise<JournalPost[]> {
  const rows = await sql<Row[]>`
    select ${sql.unsafe(KOLOM)}
    from public.journal_posts
    order by published_at desc nulls first, updated_at desc`;
  return rows.map(rowToPost);
}

export async function getById(sql: Sql, id: string): Promise<JournalPost | null> {
  const rows = await sql<Row[]>`
    select ${sql.unsafe(KOLOM)} from public.journal_posts where id = ${id}::uuid`;
  return rows[0] ? rowToPost(rows[0]) : null;
}

export async function create(sql: Sql, input: JournalPostInput): Promise<string> {
  const rows = await sql<{ id: string }[]>`
    insert into public.journal_posts (slug, title, excerpt, body, category, read_minutes, published_at)
    values (${input.slug ?? ""}, ${input.title ?? ""}, ${input.excerpt ?? ""},
            ${input.body ?? null}, ${input.category ?? "site"}::public.journal_category,
            ${input.readMinutes ?? 5}, ${input.publishedAt ?? null})
    returning id`;
  return rows[0].id;
}

export async function update(sql: Sql, id: string, input: JournalPostInput): Promise<void> {
  type Fragment = ReturnType<Sql>;
  const fragments: Fragment[] = [];

  if (input.slug !== undefined) fragments.push(sql`slug = ${input.slug}`);
  if (input.title !== undefined) fragments.push(sql`title = ${input.title}`);
  if (input.excerpt !== undefined) fragments.push(sql`excerpt = ${input.excerpt}`);
  if (input.body !== undefined) fragments.push(sql`body = ${input.body}`);
  if (input.category !== undefined) {
    fragments.push(sql`category = ${input.category}::public.journal_category`);
  }
  if (input.readMinutes !== undefined) fragments.push(sql`read_minutes = ${input.readMinutes}`);
  // null di sini BERARTI sesuatu — kembalikan tulisan jadi rencana — jadi
  // yang diperiksa `!== undefined`, bukan kebenaran nilainya.
  if (input.publishedAt !== undefined) fragments.push(sql`published_at = ${input.publishedAt}`);

  if (fragments.length === 0) return;

  let setClause = fragments[0];
  for (let i = 1; i < fragments.length; i++) setClause = sql`${setClause}, ${fragments[i]}`;

  const result = await sql`update public.journal_posts set ${setClause} where id = ${id}::uuid`;
  if (result.count === 0) throw new NotFoundError();
}

export async function remove(sql: Sql, id: string): Promise<void> {
  const result = await sql`delete from public.journal_posts where id = ${id}::uuid`;
  if (result.count === 0) throw new NotFoundError();
}
