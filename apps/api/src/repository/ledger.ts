import type { Sql } from "postgres";
import type { LedgerCategory, LedgerDirection, LedgerEntry, LedgerInput } from "../types";
import { LEDGER_KATEGORI } from "../types";
import { NotFoundError } from "./projects";

/**
 * Kas studio di luar proyek — sheet "KELUAR MASUK" untuk uang yang tidak
 * lahir dari satu proyek desain: penjualan material, bagi hasil, konsumsi,
 * operasional kantor.
 *
 * Pembayaran klien TIDAK dicatat di sini (itu project_payments), bayaran tim
 * tidak (project_costs), dan gaji tidak (payroll). Satu nominal, satu tempat.
 */

interface Row {
  id: string;
  direction: LedgerDirection;
  category: LedgerCategory;
  label: string;
  counterparty: string | null;
  amount: string;
  occurred_on: string;
  project_id: string | null;
  project_title: string | null;
  note: string | null;
}

const keEntri = (r: Row): LedgerEntry => ({
  id: r.id,
  direction: r.direction,
  category: r.category,
  label: r.label,
  counterparty: r.counterparty,
  amount: Number(r.amount),
  occurredOn: r.occurred_on,
  projectId: r.project_id,
  projectTitle: r.project_title,
  note: r.note,
});

function sahTanggal(v: string | null | undefined, nama: string): string | null {
  const t = (v ?? "").trim();
  if (!t) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) throw new Error(`${nama} tidak sah`);
  return t;
}

export async function list(
  sql: Sql,
  r: { dari?: string | null; sampai?: string | null; limit?: number } = {},
): Promise<LedgerEntry[]> {
  const dari = sahTanggal(r.dari, "tanggal awal");
  const sampai = sahTanggal(r.sampai, "tanggal akhir");
  const batas = Math.min(Math.max(Math.trunc(r.limit ?? 200) || 200, 1), 500);
  const rows = await sql<Row[]>`
    select k.id, k.direction, k.category, k.label, k.counterparty, k.amount,
           k.occurred_on::text, k.project_id, p.title as project_title, k.note
      from public.studio_ledger k
      left join public.projects p on p.id = k.project_id
     where (${dari}::date   is null or k.occurred_on >= ${dari}::date)
       and (${sampai}::date is null or k.occurred_on <= ${sampai}::date)
     order by k.occurred_on desc, k.created_at desc
     limit ${batas}`;
  return rows.map(keEntri);
}

function teks(v: string | null | undefined, nama: string, maks: number): string | null {
  if (v === null || v === undefined) return null;
  const t = v.trim();
  if (t.length > maks) throw new Error(`${nama} paling panjang ${maks} karakter`);
  return t || null;
}

/** Kategori harus searah arusnya — pesan yang terbaca, bukan check_violation Postgres. */
function sahArusKategori(arah: string, kategori: string): void {
  if (arah !== "masuk" && arah !== "keluar") throw new Error("arus kas harus masuk atau keluar");
  if (!(LEDGER_KATEGORI[arah] as readonly string[]).includes(kategori)) {
    throw new Error(`kategori "${kategori}" tidak cocok untuk uang ${arah}`);
  }
}

export async function create(sql: Sql, input: LedgerInput): Promise<string> {
  const arah = (input.direction ?? "").trim();
  const kategori = (input.category ?? "lainnya").trim();
  sahArusKategori(arah, kategori);

  const label = (input.label ?? "").trim();
  if (label.length < 2) throw new Error("keterangan wajib diisi");
  if (label.length > 160) throw new Error("keterangan paling panjang 160 karakter");
  if (!input.amount || !(input.amount > 0)) throw new Error("nominal harus lebih dari nol");

  const [r] = await sql<{ id: string }[]>`
    insert into public.studio_ledger (direction, category, label, counterparty, amount, occurred_on, project_id, note)
    values (
      ${arah}::public.ledger_direction, ${kategori}::public.ledger_category, ${label},
      ${teks(input.counterparty, "dari/untuk", 120)}, ${input.amount},
      coalesce(${sahTanggal(input.occurredOn, "tanggal")}::date, current_date),
      ${(input.projectId ?? "").trim() || null}::uuid,
      ${teks(input.note, "catatan", 400)}
    )
    returning id`;
  return r.id;
}

export async function update(sql: Sql, id: string, input: LedgerInput): Promise<void> {
  // Arus dan kategori diperiksa BERDUA: mengganti arusnya saja bisa
  // meninggalkan kategori yang tidak lagi cocok.
  if (input.direction !== undefined || input.category !== undefined) {
    const [lama] = await sql<{ direction: string; category: string }[]>`
      select direction, category from public.studio_ledger where id = ${id}::uuid`;
    if (!lama) throw new NotFoundError();
    sahArusKategori(input.direction ?? lama.direction, input.category ?? lama.category);
  }

  type Fragment = ReturnType<Sql>;
  const f: Fragment[] = [];
  if (input.direction !== undefined) f.push(sql`direction = ${input.direction}::public.ledger_direction`);
  if (input.category !== undefined) f.push(sql`category = ${input.category}::public.ledger_category`);
  if (input.label !== undefined) {
    const label = (input.label ?? "").trim();
    if (label.length < 2 || label.length > 160) throw new Error("keterangan harus 2–160 karakter");
    f.push(sql`label = ${label}`);
  }
  if (input.counterparty !== undefined) f.push(sql`counterparty = ${teks(input.counterparty, "dari/untuk", 120)}`);
  if (input.amount !== undefined) {
    if (!input.amount || !(input.amount > 0)) throw new Error("nominal harus lebih dari nol");
    f.push(sql`amount = ${input.amount}`);
  }
  if (input.occurredOn !== undefined) {
    const t = sahTanggal(input.occurredOn, "tanggal");
    if (!t) throw new Error("tanggal wajib diisi");
    f.push(sql`occurred_on = ${t}::date`);
  }
  if (input.projectId !== undefined) f.push(sql`project_id = ${(input.projectId ?? "").trim() || null}::uuid`);
  if (input.note !== undefined) f.push(sql`note = ${teks(input.note, "catatan", 400)}`);
  if (f.length === 0) return;

  let set = f[0];
  for (let i = 1; i < f.length; i++) set = sql`${set}, ${f[i]}`;
  const result = await sql`update public.studio_ledger set ${set} where id = ${id}::uuid`;
  if (result.count === 0) throw new NotFoundError();
}

export async function remove(sql: Sql, id: string): Promise<void> {
  const result = await sql`delete from public.studio_ledger where id = ${id}::uuid`;
  if (result.count === 0) throw new NotFoundError();
}
