import type { Sql } from "postgres";

/** Apakah sebuah user berhak mengelola konten. */
export async function isStaff(sql: Sql, userID: string): Promise<boolean> {
  const rows = await sql<{ ada: boolean }[]>`
    select exists (select 1 from public.profiles where id = ${userID}::uuid) as ada`;
  return rows[0]?.ada ?? false;
}

/** Peran staf: "admin" (master admin) atau "editor". String kosong berarti bukan staf. */
export async function role(sql: Sql, userID: string): Promise<string> {
  const rows = await sql<{ role: string }[]>`
    select role from public.profiles where id = ${userID}::uuid`;
  return rows[0]?.role ?? "";
}
