import type { Sql } from "postgres";
import type { ProjectBrief, ProjectBriefInput, ClientBrief, ClientBriefInput } from "../types";

interface Row {
  budget_range: string | null;
  budget_amount: string | number | null;
  start_date: string | null;
  end_date: string | null;
  timeline: string | null;
  style_preference: string | null;
  requirements: string | null;
  internal_notes: string | null;
  submitted_at: string | null;
}

function rowToBrief(row: Row): ProjectBrief {
  return {
    budgetRange: row.budget_range,
    // bigint dibaca driver sebagai string supaya angka di atas 2^53 tidak
    // kehilangan presisi. Rupiah di sini jauh di bawah itu, jadi aman
    // dikembalikan sebagai number — tapi konversinya tetap eksplisit.
    budgetAmount: row.budget_amount === null ? null : Number(row.budget_amount),
    startDate: row.start_date,
    endDate: row.end_date,
    timeline: row.timeline,
    stylePreference: row.style_preference,
    requirements: row.requirements,
    internalNotes: row.internal_notes,
    submittedAt: row.submitted_at,
  };
}

/**
 * Lazy upsert seperti project_progress — proyek yang belum pernah dibuka
 * tab Briefnya tidak perlu baris kosong tersendiri.
 */
export async function getForAdmin(sql: Sql, projectID: string): Promise<ProjectBrief> {
  const rows = await sql<Row[]>`
    insert into public.project_briefs (project_id)
    values (${projectID}::uuid)
    on conflict (project_id) do update set project_id = excluded.project_id
    returning budget_range, budget_amount, start_date, end_date, timeline,
              style_preference, requirements, internal_notes, submitted_at`;
  return rowToBrief(rows[0]);
}

/** Staf menyunting field apa pun termasuk internal_notes. undefined = jangan diubah. */
export async function update(sql: Sql, projectID: string, input: ProjectBriefInput): Promise<void> {
  type Fragment = ReturnType<Sql>;
  const fragments: Fragment[] = [];

  if (input.budgetRange !== undefined) fragments.push(sql`budget_range = ${input.budgetRange}`);
  if (input.budgetAmount !== undefined) fragments.push(sql`budget_amount = ${input.budgetAmount}`);
  if (input.startDate !== undefined) fragments.push(sql`start_date = ${input.startDate}`);
  if (input.endDate !== undefined) fragments.push(sql`end_date = ${input.endDate}`);
  if (input.timeline !== undefined) fragments.push(sql`timeline = ${input.timeline}`);
  if (input.stylePreference !== undefined) fragments.push(sql`style_preference = ${input.stylePreference}`);
  if (input.requirements !== undefined) fragments.push(sql`requirements = ${input.requirements}`);
  if (input.internalNotes !== undefined) fragments.push(sql`internal_notes = ${input.internalNotes}`);

  if (fragments.length === 0) return;

  let setClause = fragments[0];
  for (let i = 1; i < fragments.length; i++) setClause = sql`${setClause}, ${fragments[i]}`;

  // Baris selalu ada di sini karena getForAdmin sudah lazy-upsert saat tab
  // Brief pertama kali dibuka — tapi jaga-jaga kalau belum, insert dulu.
  await sql`
    insert into public.project_briefs (project_id)
    values (${projectID}::uuid)
    on conflict (project_id) do nothing`;
  await sql`update public.project_briefs set ${setClause} where project_id = ${projectID}::uuid`;
}

/** Dilihat klien lewat token: object kosong (semua null) kalau proyek belum pernah punya brief. */
export async function getByProjectID(sql: Sql, projectID: string): Promise<ClientBrief> {
  const rows = await sql<Row[]>`
    select budget_range, timeline, style_preference, requirements, internal_notes, submitted_at
    from public.project_briefs
    where project_id = ${projectID}::uuid`;

  if (!rows[0]) {
    return { budgetRange: null, timeline: null, stylePreference: null, requirements: null, submittedAt: null };
  }
  const { internalNotes: _internalNotes, ...clientFields } = rowToBrief(rows[0]);
  return clientFields;
}

/** Klien mengisi/mengubah briefnya sendiri — internal_notes tidak pernah disentuh jalur ini. */
export async function submitByProjectID(sql: Sql, projectID: string, input: ClientBriefInput): Promise<void> {
  await sql`
    insert into public.project_briefs (project_id, budget_range, timeline, style_preference, requirements, submitted_at)
    values (${projectID}::uuid, ${input.budgetRange ?? null}, ${input.timeline ?? null}, ${input.stylePreference ?? null}, ${input.requirements ?? null}, now())
    on conflict (project_id) do update set
      budget_range     = ${input.budgetRange ?? null},
      timeline         = ${input.timeline ?? null},
      style_preference = ${input.stylePreference ?? null},
      requirements     = ${input.requirements ?? null},
      submitted_at     = now()`;
}
