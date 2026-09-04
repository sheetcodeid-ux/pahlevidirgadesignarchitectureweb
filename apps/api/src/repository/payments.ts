import type { Sql } from "postgres";
import type { Payment, PaymentInput, Receipt } from "../types";

interface Row {
  id: string;
  project_id: string;
  amount: string;
  kind: string;
  method: string;
  receiver: string | null;
  note: string | null;
  paid_at: string;
  receipt_token: string;
}

function rowToPayment(row: Row): Payment {
  return {
    id: row.id,
    projectId: row.project_id,
    amount: Number(row.amount),
    kind: row.kind,
    method: row.method,
    receiver: row.receiver,
    note: row.note,
    paidAt: row.paid_at,
    receiptToken: row.receipt_token,
  };
}

/** Seluruh pembayaran satu proyek, terbaru dulu. */
export async function listByProject(sql: Sql, projectID: string): Promise<Payment[]> {
  const rows = await sql<Row[]>`
    select id, project_id, amount, kind, method, receiver, note, paid_at, receipt_token
    from public.project_payments
    where project_id = ${projectID}::uuid
    order by paid_at desc`;
  return rows.map(rowToPayment);
}

/**
 * Mencatat satu uang masuk.
 *
 * receipt_token TIDAK diisi di sini — biarkan default kolomnya yang membuat
 * (encode(gen_random_bytes(16), 'hex')). Membangkitkannya di Worker berarti
 * mengandalkan crypto.getRandomValues lewat jaringan, dan kalau dua permintaan
 * mendarat bersamaan tidak ada yang menjamin keunikannya selain UNIQUE di
 * database — yang toh sudah ada, jadi biarkan database saja yang mengurus.
 */
export async function create(sql: Sql, projectID: string, input: PaymentInput): Promise<Payment> {
  const rows = await sql<Row[]>`
    insert into public.project_payments (project_id, amount, kind, method, receiver, note)
    values (
      ${projectID}::uuid,
      ${input.amount},
      ${input.kind ?? "dp"}::public.payment_kind,
      ${input.method ?? "tunai"}::public.payment_method,
      ${input.receiver ?? null},
      ${input.note ?? null}
    )
    returning id, project_id, amount, kind, method, receiver, note, paid_at, receipt_token`;
  return rowToPayment(rows[0]);
}

export async function remove(sql: Sql, projectID: string, paymentID: string): Promise<boolean> {
  const rows = await sql<{ id: string }[]>`
    delete from public.project_payments
    where id = ${paymentID}::uuid and project_id = ${projectID}::uuid
    returning id`;
  return rows.length > 0;
}

/**
 * Bukti pembayaran yang dibuka klien lewat tautan WhatsApp.
 *
 * Tanpa login, jadi tokennya yang jadi kunci — dicocokkan langsung di klausa
 * WHERE, bukan disaring setelah baris terambil. Nama studio ikut diambil di
 * sini supaya halaman buktinya tidak perlu permintaan kedua.
 */
export async function getByToken(sql: Sql, token: string): Promise<Receipt | null> {
  const rows = await sql<{
    id: string; amount: string; kind: string; method: string;
    receiver: string | null; paid_at: string; receipt_token: string;
    project_title: string; contract_value: string | null; studio_name: string;
  }[]>`
    select pay.id, pay.amount, pay.kind, pay.method, pay.receiver, pay.paid_at,
           pay.receipt_token, p.title as project_title, p.contract_value,
           coalesce(s.studio_name, 'Dirga Pahlevi Architecture') as studio_name
    from public.project_payments pay
    join public.projects p on p.id = pay.project_id
    left join public.studio_settings s on s.id = true
    where pay.receipt_token = ${token}`;

  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    id: r.id,
    receiptToken: r.receipt_token,
    amount: Number(r.amount),
    kind: r.kind,
    method: r.method,
    receiver: r.receiver,
    paidAt: r.paid_at,
    projectTitle: r.project_title,
    contractValue: r.contract_value !== null ? Number(r.contract_value) : null,
    studioName: r.studio_name,
  };
}
