import type { Sql } from "postgres";
import type { Testimonial, TestimonialInput, PublicTestimonial } from "../types";
import { NotFoundError } from "./projects";

interface Row {
  id: string;
  project_id: string | null;
  project_title: string | null;
  client_name: string;
  quote: string;
  rating: number | null;
  status: string;
  is_featured: boolean;
  created_at: string;
  updated_at: string;
}

function rowToTestimonial(row: Row): Testimonial {
  return {
    id: row.id,
    projectId: row.project_id,
    projectTitle: row.project_title,
    clientName: row.client_name,
    quote: row.quote,
    rating: row.rating,
    status: row.status,
    isFeatured: row.is_featured,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Seluruh testimoni termasuk yang menunggu moderasi — dilihat staf. */
export async function listAll(sql: Sql): Promise<Testimonial[]> {
  const rows = await sql<Row[]>`
    select t.id, t.project_id, p.title as project_title, t.client_name, t.quote, t.rating,
           t.status, t.is_featured, t.created_at, t.updated_at
    from public.testimonials t
    left join public.projects p on p.id = t.project_id
    order by t.created_at desc`;
  return rows.map(rowToTestimonial);
}

export async function update(sql: Sql, id: string, input: TestimonialInput): Promise<void> {
  type Fragment = ReturnType<Sql>;
  const fragments: Fragment[] = [];

  if (input.status !== undefined) fragments.push(sql`status = ${input.status}::public.testimonial_status`);
  if (input.isFeatured !== undefined) fragments.push(sql`is_featured = ${input.isFeatured}`);
  if (input.clientName !== undefined) fragments.push(sql`client_name = ${input.clientName}`);
  if (input.quote !== undefined) fragments.push(sql`quote = ${input.quote}`);
  if (input.rating !== undefined) fragments.push(sql`rating = ${input.rating}`);

  if (fragments.length === 0) return;

  let setClause = fragments[0];
  for (let i = 1; i < fragments.length; i++) setClause = sql`${setClause}, ${fragments[i]}`;

  const result = await sql`update public.testimonials set ${setClause} where id = ${id}::uuid`;
  if (result.count === 0) throw new NotFoundError();
}

export async function remove(sql: Sql, id: string): Promise<void> {
  const result = await sql`delete from public.testimonials where id = ${id}::uuid`;
  if (result.count === 0) throw new NotFoundError();
}

/** Ditampilkan di situs publik saat build — hanya yang sudah disetujui staf. */
export async function listPublic(sql: Sql, featuredOnly: boolean): Promise<PublicTestimonial[]> {
  const rows = await sql<{ client_name: string; quote: string; rating: number | null }[]>`
    select client_name, quote, rating
    from public.testimonials
    where status = 'disetujui' and (${featuredOnly} = false or is_featured)
    order by updated_at desc
    limit 24`;
  return rows.map((r) => ({ clientName: r.client_name, quote: r.quote, rating: r.rating }));
}

/** Klien mengirim testimoni lewat portal token — selalu masuk sebagai 'menunggu' moderasi staf. */
export async function submitByProjectID(
  sql: Sql, projectID: string, clientName: string, quote: string, rating: number | null,
): Promise<string> {
  const namaBersih = clientName.trim();
  const kutipanBersih = quote.trim();
  if (namaBersih.length < 2) throw new Error("nama wajib diisi");
  if (kutipanBersih.length < 2) throw new Error("testimoni wajib diisi");

  const rows = await sql<{ id: string }[]>`
    insert into public.testimonials (project_id, client_name, quote, rating)
    values (${projectID}::uuid, ${namaBersih}, ${kutipanBersih}, ${rating})
    returning id`;
  return rows[0].id;
}
