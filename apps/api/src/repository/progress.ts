import type { Sql } from "postgres";
import type {
  ProjectProgress, ProjectProgressUpdate, ClientProgressView, ClientDocument, ClientInvoice,
  ClientBriefInput, DocumentComment,
} from "../types";
import { NotFoundError } from "./projects";
import * as briefRepo from "./brief";
import * as commentsRepo from "./documentComments";
import * as testimonialsRepo from "./testimonials";

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
  project_id: string;
  title: string;
  cover_image_key: string | null;
  phase: string;
}

interface DocumentRow {
  id: string;
  title: string;
  file_key: string;
  status: string;
  client_note: string | null;
}

function rowToClientDocument(row: DocumentRow, assetBase: string, comments: DocumentComment[]): ClientDocument {
  return {
    id: row.id,
    title: row.title,
    fileUrl: `${assetBase.replace(/\/$/, "")}/${row.file_key.replace(/^\//, "")}`,
    status: row.status,
    clientNote: row.client_note,
    comments,
  };
}

interface InvoiceRow {
  id: string;
  label: string;
  amount: string;
  status: string;
  due_date: string | null;
}

function rowToClientInvoice(row: InvoiceRow): ClientInvoice {
  return { id: row.id, label: row.label, amount: Number(row.amount), status: row.status, dueDate: row.due_date };
}

/**
 * Dilihat klien lewat link publik. Tokennya sendiri 40 karakter hex acak
 * (160-bit) — tidak butuh autentikasi tambahan, tidak tertebak lewat
 * enumerasi wajar. Endpoint ini yang jadi satu-satunya jalur baca publik;
 * tabelnya sendiri sengaja tertutup total dari anon lewat RLS+GRANT.
 *
 * project_costs (HPP internal) sengaja TIDAK disertakan di sini — klien
 * boleh melihat status tagihannya sendiri, tidak pernah rincian biaya/margin
 * internal studio.
 */
export async function getByToken(sql: Sql, assetBase: string, token: string): Promise<ClientProgressView | null> {
  const rows = await sql<ClientRow[]>`
    select p.id as project_id, p.title, p.cover_image_key, pr.phase
    from public.project_progress pr
    join public.projects p on p.id = pr.project_id
    where pr.access_token = ${token}`;

  if (!rows[0]) return null;

  const projectID = rows[0].project_id;

  const updates = await sql<UpdateRow[]>`
    select id, title, note, photo_key, created_at
    from public.project_progress_updates
    where project_id = ${projectID}::uuid
    order by created_at desc`;

  const documents = await sql<DocumentRow[]>`
    select id, title, file_key, status, client_note
    from public.project_documents
    where project_id = ${projectID}::uuid
    order by sort_order, created_at`;

  const documentsWithComments: ClientDocument[] = [];
  for (const d of documents) {
    const comments = await commentsRepo.listForDocument(sql, d.id);
    documentsWithComments.push(rowToClientDocument(d, assetBase, comments));
  }

  const invoices = await sql<InvoiceRow[]>`
    select id, label, amount, status, due_date
    from public.invoices
    where project_id = ${projectID}::uuid
    order by sort_order, created_at`;

  const brief = await briefRepo.getByProjectID(sql, projectID);

  return {
    projectTitle: rows[0].title,
    coverImageUrl: url(assetBase, rows[0].cover_image_key),
    phase: rows[0].phase,
    updates: updates.map((r) => rowToUpdate(r, assetBase)),
    documents: documentsWithComments,
    invoices: invoices.map(rowToClientInvoice),
    brief,
  };
}

/** Resolve project_id dari token — dipakai submisi klien (brief, testimoni, komentar). */
async function resolveProjectID(sql: Sql, token: string): Promise<string | null> {
  const rows = await sql<{ project_id: string }[]>`
    select project_id from public.project_progress where access_token = ${token}`;
  return rows[0]?.project_id ?? null;
}

export class TokenTidakDitemukan extends Error {}

export async function submitBrief(sql: Sql, token: string, input: ClientBriefInput): Promise<void> {
  const projectID = await resolveProjectID(sql, token);
  if (!projectID) throw new TokenTidakDitemukan();
  await briefRepo.submitByProjectID(sql, projectID, input);
}

export async function submitTestimonial(
  sql: Sql, token: string, clientName: string, quote: string, rating: number | null,
): Promise<string> {
  const projectID = await resolveProjectID(sql, token);
  if (!projectID) throw new TokenTidakDitemukan();
  return testimonialsRepo.submitByProjectID(sql, projectID, clientName, quote, rating);
}

/**
 * Sama seperti approve/revise: kepemilikan dokumen atas token dicek langsung
 * lewat subquery project_id, bukan query terpisah.
 */
export async function addDocumentComment(sql: Sql, token: string, documentID: string, body: string): Promise<string> {
  const rows = await sql<{ id: string }[]>`
    select d.id from public.project_documents d
    where d.id = ${documentID}::uuid
      and d.project_id = (select project_id from public.project_progress where access_token = ${token})`;
  if (!rows[0]) throw new DocumentActionError("dokumen tidak ditemukan");

  return commentsRepo.create(sql, documentID, "klien", body);
}

export class DocumentActionError extends Error {}

/**
 * Klien hanya bisa bertindak atas dokumen yang statusnya "menunggu_klien",
 * dan hanya atas dokumen milik proyek yang tokennya cocok — dua syarat itu
 * dicek langsung di klausa WHERE, bukan lewat query terpisah, supaya tidak
 * ada celah antara pengecekan dan penulisan.
 */
export async function approveDocument(sql: Sql, token: string, documentID: string): Promise<void> {
  const result = await sql`
    update public.project_documents
    set status = 'disetujui', client_note = null
    where id = ${documentID}::uuid
      and status = 'menunggu_klien'
      and project_id = (select project_id from public.project_progress where access_token = ${token})`;
  if (result.count === 0) throw new DocumentActionError("dokumen tidak ditemukan atau belum bisa disetujui");
}

export async function requestDocumentRevision(sql: Sql, token: string, documentID: string, note: string): Promise<void> {
  const result = await sql`
    update public.project_documents
    set status = 'revisi_diminta', client_note = ${note}
    where id = ${documentID}::uuid
      and status = 'menunggu_klien'
      and project_id = (select project_id from public.project_progress where access_token = ${token})`;
  if (result.count === 0) throw new DocumentActionError("dokumen tidak ditemukan atau belum bisa diminta revisi");
}
