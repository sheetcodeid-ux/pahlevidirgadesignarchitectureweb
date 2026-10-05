import type { Sql } from "postgres";

/** Apakah sebuah user berhak mengelola konten. */
export async function isStaff(sql: Sql, userID: string): Promise<boolean> {
  const rows = await sql<{ ada: boolean }[]>`
    select exists (select 1 from public.profiles where id = ${userID}::uuid) as ada`;
  return rows[0]?.ada ?? false;
}
