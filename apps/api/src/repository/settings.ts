import type { Sql } from "postgres";
import type { StudioSettings, StudioSettingsInput } from "../types";

interface Row {
  studio_name: string;
  tagline: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  instagram_url: string | null;
  logo_key: string | null;
  timezone: string;
}

function url(assetBase: string, key: string | null): string | null {
  if (!key) return null;
  return `${assetBase.replace(/\/$/, "")}/${key.replace(/^\//, "")}`;
}

function rowToSettings(row: Row, assetBase: string): StudioSettings {
  return {
    studioName: row.studio_name,
    tagline: row.tagline,
    email: row.email,
    phone: row.phone,
    address: row.address,
    city: row.city,
    instagramUrl: row.instagram_url,
    logoUrl: url(assetBase, row.logo_key),
    timezone: row.timezone,
  };
}

/**
 * Kunci penyimpanan logo, mentah — bukan URL publiknya.
 *
 * Dipakai satu-satunya oleh endpoint yang menyajikan bita logo untuk kop
 * PDF, yang membaca bucket lewat binding R2. Fungsi sendiri, bukan
 * memanggil get() dengan assetBase kosong lalu mengupas garis miringnya:
 * yang kedua bekerja, tapi baru masuk akal setelah membaca tiga fungsi.
 */
export async function logoKey(sql: Sql): Promise<string | null> {
  const rows = await sql<{ logo_key: string | null }[]>`
    select logo_key from public.studio_settings where id = true`;
  return rows[0]?.logo_key ?? null;
}

/** Baris tunggal (id selalu true) — dibuat lewat migrasi, tidak pernah dihapus. */
export async function get(sql: Sql, assetBase = ""): Promise<StudioSettings> {
  const rows = await sql<Row[]>`
    select studio_name, tagline, email, phone, address, city, instagram_url, logo_key, timezone
    from public.studio_settings
    where id = true`;
  return rowToSettings(rows[0], assetBase);
}

const PLAIN_COLUMNS: [string, keyof StudioSettingsInput][] = [
  ["studio_name", "studioName"],
  ["tagline", "tagline"],
  ["email", "email"],
  ["phone", "phone"],
  ["address", "address"],
  ["city", "city"],
  ["instagram_url", "instagramUrl"],
  ["logo_key", "logoKey"],
  ["timezone", "timezone"],
];

/** Menulis hanya field yang dikirim. */
export async function update(sql: Sql, input: StudioSettingsInput): Promise<void> {
  type Fragment = ReturnType<Sql>;
  const fragments: Fragment[] = [];

  for (const [column, key] of PLAIN_COLUMNS) {
    const value = input[key];
    if (value === undefined) continue;
    switch (column) {
      case "studio_name": fragments.push(sql`studio_name = ${value as string}`); break;
      case "tagline": fragments.push(sql`tagline = ${value as string | null}`); break;
      case "email": fragments.push(sql`email = ${value as string | null}`); break;
      case "phone": fragments.push(sql`phone = ${value as string | null}`); break;
      case "address": fragments.push(sql`address = ${value as string | null}`); break;
      case "city": fragments.push(sql`city = ${value as string | null}`); break;
      case "instagram_url": fragments.push(sql`instagram_url = ${value as string | null}`); break;
      case "logo_key": fragments.push(sql`logo_key = ${value as string | null}`); break;
      case "timezone": fragments.push(sql`timezone = ${value as string}`); break;
    }
  }

  if (fragments.length === 0) return;

  let setClause = fragments[0];
  for (let i = 1; i < fragments.length; i++) setClause = sql`${setClause}, ${fragments[i]}`;

  await sql`update public.studio_settings set ${setClause} where id = true`;
}
