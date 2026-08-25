import type { Sql } from "postgres";
import type { DocumentComment } from "../types";

interface Row {
  id: string;
  document_id: string;
  author: string;
  body: string;
  created_at: string;
}

function rowToComment(row: Row): DocumentComment {
  return { id: row.id, documentId: row.document_id, author: row.author, body: row.body, createdAt: row.created_at };
}

export async function listForDocument(sql: Sql, documentID: string): Promise<DocumentComment[]> {
  const rows = await sql<Row[]>`
    select id, document_id, author, body, created_at
    from public.document_comments
    where document_id = ${documentID}::uuid
    order by created_at`;
  return rows.map(rowToComment);
}

export async function create(sql: Sql, documentID: string, author: "staf" | "klien", body: string): Promise<string> {
  const bersih = body.trim();
  if (bersih.length < 1) throw new Error("komentar tidak boleh kosong");

  const rows = await sql<{ id: string }[]>`
    insert into public.document_comments (document_id, author, body)
    values (${documentID}::uuid, ${author}::public.comment_author, ${bersih})
    returning id`;
  return rows[0].id;
}
