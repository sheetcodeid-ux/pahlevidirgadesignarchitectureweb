import type { Sql } from "postgres";
import type { ProjectDocument, ProjectDocumentInput } from "../types";
import { NotFoundError } from "./projects";

function url(assetBase: string, key: string): string {
  return `${assetBase.replace(/\/$/, "")}/${key.replace(/^\//, "")}`;
}

interface Row {
  id: string;
  project_id: string;
  title: string;
  file_key: string;
  status: string;
  client_note: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

function rowToDocument(row: Row, assetBase: string): ProjectDocument {
  return {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    fileUrl: url(assetBase, row.file_key),
    status: row.status,
    clientNote: row.client_note,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listForProject(sql: Sql, assetBase: string, projectID: string): Promise<ProjectDocument[]> {
  const rows = await sql<Row[]>`
    select id, project_id, title, file_key, status, client_note, sort_order, created_at, updated_at
    from public.project_documents
    where project_id = ${projectID}::uuid
    order by sort_order, created_at`;
  return rows.map((r) => rowToDocument(r, assetBase));
}

export async function create(sql: Sql, projectID: string, input: ProjectDocumentInput): Promise<string> {
  const title = (input.title ?? "").trim();
  if (title.length < 2) throw new Error("judul dokumen wajib diisi");
  if (!input.fileKey) throw new Error("berkas dokumen wajib diunggah");

  const rows = await sql<{ id: string }[]>`
    insert into public.project_documents (project_id, title, file_key, sort_order)
    values (${projectID}::uuid, ${title}, ${input.fileKey}, ${input.sortOrder ?? 0})
    returning id`;
  return rows[0].id;
}

export async function update(sql: Sql, id: string, input: ProjectDocumentInput): Promise<void> {
  type Fragment = ReturnType<Sql>;
  const fragments: Fragment[] = [];

  if (input.title !== undefined) fragments.push(sql`title = ${input.title}`);
  if (input.fileKey !== undefined) fragments.push(sql`file_key = ${input.fileKey}`);
  if (input.sortOrder !== undefined) fragments.push(sql`sort_order = ${input.sortOrder}`);
  if (input.status !== undefined) {
    fragments.push(sql`status = ${input.status}::public.document_status`);
    // Catatan revisi klien hanya berarti selama statusnya masih "revisi
    // diminta" — begitu staf mengubah status (mis. mengunggah revisi baru,
    // menandai final), catatan lama dikosongkan supaya tidak nyangkut.
    if (input.status !== "revisi_diminta") fragments.push(sql`client_note = null`);
  }

  if (fragments.length === 0) return;

  let setClause = fragments[0];
  for (let i = 1; i < fragments.length; i++) setClause = sql`${setClause}, ${fragments[i]}`;

  const result = await sql`update public.project_documents set ${setClause} where id = ${id}::uuid`;
  if (result.count === 0) throw new NotFoundError();
}

export async function remove(sql: Sql, id: string): Promise<void> {
  const result = await sql`delete from public.project_documents where id = ${id}::uuid`;
  if (result.count === 0) throw new NotFoundError();
}
