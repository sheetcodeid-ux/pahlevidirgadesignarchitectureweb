import type { Sql } from "postgres";

/**
 * Kapan isi publik terakhir berubah.
 *
 * Situs publik dibekukan saat build, jadi panel admin perlu bisa menjawab
 * satu pertanyaan: apakah yang sedang tayang masih sama dengan yang ada di
 * database? Angka inilah setengah jawabannya — setengah lagi adalah waktu
 * build, yang dipanggang ke dalam halaman panel itu sendiri.
 *
 * Dicap oleh trigger di enam tabel yang dibaca saat build. Termasuk saat
 * MENGHAPUS, yang justru tidak bisa dilihat dari max(updated_at) mana pun.
 */
export async function terakhirBerubah(sql: Sql): Promise<string | null> {
  const rows = await sql<{ changed_at: Date }[]>`
    select changed_at from public.content_revision where id = 1`;
  return rows[0] ? rows[0].changed_at.toISOString() : null;
}
