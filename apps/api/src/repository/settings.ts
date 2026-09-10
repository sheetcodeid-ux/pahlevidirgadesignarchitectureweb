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
  founded_year: number | null;
  first_commercial_year: number | null;
  before_key: string | null;
  after_key: string | null;
  legal_entity: string | null;
  legal_address: string | null;
  retention_messages: string | null;
  retention_documents: string | null;
  governing_law: string | null;
  faq_tarif: string | null;
  faq_uang_muka: string | null;
  faq_lama_kerja: string | null;
  faq_kunjungan: string | null;
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
    foundedYear: row.founded_year,
    firstCommercialYear: row.first_commercial_year,
    beforeUrl: url(assetBase, row.before_key),
    afterUrl: url(assetBase, row.after_key),
    legalEntity: row.legal_entity,
    legalAddress: row.legal_address,
    retentionMessages: row.retention_messages,
    retentionDocuments: row.retention_documents,
    governingLaw: row.governing_law,
    faqTarif: row.faq_tarif,
    faqUangMuka: row.faq_uang_muka,
    faqLamaKerja: row.faq_lama_kerja,
    faqKunjungan: row.faq_kunjungan,
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
    select studio_name, tagline, email, phone, address, city, instagram_url, logo_key, timezone,
           founded_year, first_commercial_year, before_key, after_key,
           legal_entity, legal_address, retention_messages, retention_documents, governing_law,
           faq_tarif, faq_uang_muka, faq_lama_kerja, faq_kunjungan
    from public.studio_settings
    where id = true`;
  return rowToSettings(rows[0], assetBase);
}

/**
 * Peta kolom database -> field yang dikirim panel. Daftar ini SATU-SATUNYA
 * tempat yang perlu disentuh saat menambah isian baru.
 *
 * Sebelumnya di bawah ada `switch` sepanjang daftar ini yang menuliskan
 * fragmen SQL per kolom satu per satu. Itu bekerja, tapi berarti setiap kolom
 * baru harus didaftarkan DUA kali — dan gelombang ini menambah tiga belas
 * sekaligus. Kolom yang terdaftar di sini tapi terlupa di switch akan diam
 * saja: isiannya tersimpan di panel, tidak pernah sampai ke database, dan
 * tidak ada satu pun galat.
 *
 * Penggantinya `sql(nama)` milik postgres.js, yang meng-escape nama kolom
 * sebagai identifier. Nilainya tetap lewat parameter terpisah seperti
 * sebelumnya, dan namanya tidak pernah datang dari pengguna — hanya dari
 * daftar tetap di bawah ini.
 */
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
  // Isi halaman publik — lihat migrasi 20260910000021.
  ["founded_year", "foundedYear"],
  ["first_commercial_year", "firstCommercialYear"],
  ["before_key", "beforeKey"],
  ["after_key", "afterKey"],
  ["legal_entity", "legalEntity"],
  ["legal_address", "legalAddress"],
  ["retention_messages", "retentionMessages"],
  ["retention_documents", "retentionDocuments"],
  ["governing_law", "governingLaw"],
  ["faq_tarif", "faqTarif"],
  ["faq_uang_muka", "faqUangMuka"],
  ["faq_lama_kerja", "faqLamaKerja"],
  ["faq_kunjungan", "faqKunjungan"],
];

/** Menulis hanya field yang dikirim. */
export async function update(sql: Sql, input: StudioSettingsInput): Promise<void> {
  type Fragment = ReturnType<Sql>;
  const fragments: Fragment[] = [];

  for (const [column, key] of PLAIN_COLUMNS) {
    const value = input[key];
    // `undefined` berarti "jangan sentuh"; `null` berarti "kosongkan", dan itu
    // perbedaan yang berarti — mengosongkan tahun berdiri harus mungkin.
    if (value === undefined) continue;
    fragments.push(sql`${sql(column)} = ${value as string | number | null}`);
  }

  if (fragments.length === 0) return;

  let setClause = fragments[0];
  for (let i = 1; i < fragments.length; i++) setClause = sql`${setClause}, ${fragments[i]}`;

  await sql`update public.studio_settings set ${setClause} where id = true`;
}
