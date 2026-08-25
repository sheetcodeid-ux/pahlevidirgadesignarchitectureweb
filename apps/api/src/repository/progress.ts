import type { Sql } from "postgres";
import type { ProjectProgress, ProjectProgressUpdate, ClientProgressView } from "../types";
import { NotFoundError } from "./projects";

function url(assetBase: string, key: string | null): string | null {
  if (!key) return null;
  return `${assetBase.replace(/\/$/, "")}/${key.replace(/^\//, "")}`;
}

interface UpdateRow {
  id: string;
  title: string;
  note: string | null;
  photo_key: string | null;
  created_at: string;
}

function rowToUpdate(row: UpdateRow, assetBase: string): ProjectProgressUpdate {
  return {
    id: row.id,
    title: row.title,
    note: row.note,
    photoUrl: url(assetBase, row.photo_key),
    createdAt: row.created_at,
  };
}

async function listUpdates(sql: Sql, assetBase: string, projectID: string): Promise<ProjectProgressUpdate[]> {
  const rows = await sql<UpdateRow[]>`
    select id, title, note, photo_key, created_at
    from public.project_progress_updates
    where project_id = ${projectID}::uuid
    order by created_at desc`;
  return rows.map((r) => rowToUpdate(r, assetBase));
}

/**
 * Baris project_progress dibuat lewat lazy upsert saat pertama kali diminta,
 * bukan otomatis saat proyek dibuat — proyek yang belum pernah dibuka
 * panel progresnya tidak perlu baris kosong.
 */
export async function getForAdmin(sql: Sql, assetBase: string, projectID: string): Promise<ProjectProgress> {
  const rows = await sql<{ phase: string; access_token: string }[]>`
    insert into public.project_progress (project_id)
    values (${projectID}::uuid)
    on conflict (project_id) do update set project_id = excluded.project_id
    returning phase, access_token`;

  const updates = await listUpdates(sql, assetBase, projectID);
  return { phase: rows[0].phase, accessToken: rows[0].access_token, updates };
}

export async function setPhase(sql: Sql, projectID: string, phase: string): Promise<void> {
  await sql`
    insert into public.project_progress (project_id, phase)
    values (${projectID}::uuid, ${phase}::public.project_phase)
    on conflict (project_id) do update set phase = ${phase}::public.project_phase`;
}

export async function regenerateToken(sql: Sql, projectID: string): Promise<string> {
  const rows = await sql<{ access_token: string }[]>`
    insert into public.project_progress (project_id)
    values (${projectID}::uuid)
    on conflict (project_id) do update
      set access_token = encode(gen_random_bytes(20), 'hex')
    returning access_token`;
  return rows[0].access_token;
}

export async function addUpdate(
  sql: Sql,
  projectID: string,
  title: string,
  note: string | null,
  photoKey: string | null,
): Promise<string> {
  const rows = await sql<{ id: string }[]>`
    insert into public.project_progress_updates (project_id, title, note, photo_key)
    values (${projectID}::uuid, ${title}, ${note}, ${photoKey})
    returning id`;
  return rows[0].id;
}

export async function removeUpdate(sql: Sql, id: string): Promise<void> {
  const result = await sql`delete from public.project_progress_updates where id = ${id}::uuid`;
  if (result.count === 0) throw new NotFoundError();
}

interface ClientRow {
  title: string;
  cover_image_key: string | null;
  phase: string;
}

/**
 * Dilihat klien lewat link publik. Tokennya sendiri 40 karakter hex acak
 * (160-bit) — tidak butuh autentikasi tambahan, tidak tertebak lewat
 * enumerasi wajar. Endpoint ini yang jadi satu-satunya jalur baca publik;
 * tabelnya sendiri sengaja tertutup total dari anon lewat RLS+GRANT.
 */
export async function getByToken(sql: Sql, assetBase: string, token: string): Promise<ClientProgressView | null> {
  const rows = await sql<ClientRow[]>`
    select p.title, p.cover_image_key, pr.phase
    from public.project_progress pr
    join public.projects p on p.id = pr.project_id
    where pr.access_token = ${token}`;

  if (!rows[0]) return null;

  const updates = await sql<UpdateRow[]>`
    select pu.id, pu.title, pu.note, pu.photo_key, pu.created_at
    from public.project_progress_updates pu
    join public.project_progress pr on pr.project_id = pu.project_id
    where pr.access_token = ${token}
    order by pu.created_at desc`;

  return {
    projectTitle: rows[0].title,
    coverImageUrl: url(assetBase, rows[0].cover_image_key),
    phase: rows[0].phase,
    updates: updates.map((r) => rowToUpdate(r, assetBase)),
  };
}
