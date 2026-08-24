import type { Sql } from "postgres";
import type { InquiryInput } from "../types";

/** Menyimpan satu submission form kontak dan mengembalikan id-nya. */
export async function create(sql: Sql, input: InquiryInput): Promise<string> {
  const rows = await sql<{ id: string }[]>`
    insert into public.inquiries
      (name, email, phone, project_type, budget_range, message, source, ip_hash, user_agent)
    values (
      ${input.name}, ${input.email}, ${input.phone ?? null},
      ${input.projectType ?? null}::public.project_category, ${input.budgetRange ?? null},
      ${input.message}, ${input.source ?? null}, ${input.ipHash}, ${input.userAgent}
    )
    returning id`;
  return rows[0].id;
}
