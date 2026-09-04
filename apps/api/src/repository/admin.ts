import type { Sql } from "postgres";
import type { Project, ProjectInput, ImageInput, ImagePatch, Image, InquiryRecord } from "../types";
import { NotFoundError } from "./projects";

function url(assetBase: string, key: string | null): string | null {
  if (!key) return null;
  return `${assetBase.replace(/\/$/, "")}/${key.replace(/^\//, "")}`;
}

interface AdminRow {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  summary: string | null;
  description: string | null;
  category: string;
  status: string;
  location: string | null;
  city: string | null;
  year: number | null;
  client: string | null;
  area_sqm: string | null;
  lead_architect: string | null;
  cover_image_key: string | null;
  is_featured: boolean;
  seo_title: string | null;
  seo_description: string | null;
  published_at: string | null;
  pipeline_stage: string;
  contract_value: string | null;
  client_whatsapp: string | null;
  phase: string | null;
}

function rowToProject(row: AdminRow, assetBase: string): Project {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    subtitle: row.subtitle,
    summary: row.summary,
    description: row.description,
    category: row.category,
    status: row.status,
    location: row.location,
    city: row.city,
    year: row.year,
    client: row.client,
    areaSqm: row.area_sqm !== null ? Number(row.area_sqm) : null,
    leadArchitect: row.lead_architect,
    coverImageUrl: url(assetBase, row.cover_image_key),
    isFeatured: row.is_featured,
    seoTitle: row.seo_title,
    seoDescription: row.seo_description,
    publishedAt: row.published_at,
    pipelineStage: row.pipeline_stage,
    phase: row.phase,
    contractValue: row.contract_value !== null ? Number(row.contract_value) : null,
    clientWhatsapp: row.client_whatsapp,
  };
}

/** Seluruh proyek, termasuk draft dan arsip — dilihat staf, bukan pengunjung. */
export async function listAll(sql: Sql, assetBase: string): Promise<Project[]> {
  const rows = await sql<AdminRow[]>`
    select p.id, p.slug, p.title, p.subtitle, p.summary, p.description, p.category,
           p.status, p.location, p.city, p.year, p.client, p.area_sqm,
           p.lead_architect, p.cover_image_key, p.is_featured, p.seo_title,
           p.seo_description, p.published_at, p.pipeline_stage, p.contract_value,
           p.client_whatsapp,
           -- LEFT join: proyek yang belum pernah dibuatkan portal klien belum
           -- punya baris project_progress, dan itu sah. Tanpa LEFT, proyek
           -- seperti itu hilang dari daftar admin tanpa satu pun galat.
           pr.phase
    from public.projects p
    left join public.project_progress pr on pr.project_id = p.id
    order by p.sort_order, p.created_at desc`;
  return rows.map((r) => rowToProject(r, assetBase));
}

/** Slug dan judul wajib; sisanya menyusul saat disunting. */
export async function create(sql: Sql, input: ProjectInput): Promise<string> {
  if (!input.slug || !input.title) throw new Error("slug dan judul wajib diisi");

  const rows = await sql<{ id: string }[]>`
    insert into public.projects (slug, title, category, status)
    values (${input.slug}, ${input.title}, coalesce(${input.category ?? null}, 'residential')::public.project_category, 'draft')
    returning id`;
  return rows[0].id;
}

// Daftar putih kolom yang boleh ditulis lewat API — sadar dan eksplisit,
// bukan daftar hitam. Kolom baru harus didaftarkan di sini sebelum bisa
// disunting dari luar. Nama kolom ditulis langsung sebagai teks SQL (bukan
// dari data), jadi tidak butuh escaping identifier dinamis.
type Fragment = ReturnType<Sql>;

const PLAIN_COLUMNS: [string, keyof ProjectInput][] = [
  ["slug", "slug"],
  ["title", "title"],
  ["subtitle", "subtitle"],
  ["summary", "summary"],
  ["description", "description"],
  ["location", "location"],
  ["city", "city"],
  ["year", "year"],
  ["client", "client"],
  ["area_sqm", "areaSqm"],
  ["lead_architect", "leadArchitect"],
  ["cover_image_key", "coverImageKey"],
  ["is_featured", "isFeatured"],
  ["seo_title", "seoTitle"],
  ["seo_description", "seoDescription"],
  ["contract_value", "contractValue"],
];

/** Menulis hanya field yang dikirim. published_at diisi otomatis saat proyek pertama kali diterbitkan. */
export async function update(sql: Sql, id: string, input: ProjectInput): Promise<void> {
  const fragments: Fragment[] = [];

  for (const [column, key] of PLAIN_COLUMNS) {
    const value = input[key];
    if (value === undefined || value === null) continue;
    switch (column) {
      case "slug": fragments.push(sql`slug = ${value as string}`); break;
      case "title": fragments.push(sql`title = ${value as string}`); break;
      case "subtitle": fragments.push(sql`subtitle = ${value as string}`); break;
      case "summary": fragments.push(sql`summary = ${value as string}`); break;
      case "description": fragments.push(sql`description = ${value as string}`); break;
      case "location": fragments.push(sql`location = ${value as string}`); break;
      case "city": fragments.push(sql`city = ${value as string}`); break;
      case "year": fragments.push(sql`year = ${value as number}`); break;
      case "client": fragments.push(sql`client = ${value as string}`); break;
      case "area_sqm": fragments.push(sql`area_sqm = ${value as number}`); break;
      case "lead_architect": fragments.push(sql`lead_architect = ${value as string}`); break;
      case "cover_image_key": fragments.push(sql`cover_image_key = ${value as string}`); break;
      case "is_featured": fragments.push(sql`is_featured = ${value as boolean}`); break;
      case "seo_title": fragments.push(sql`seo_title = ${value as string}`); break;
      case "seo_description": fragments.push(sql`seo_description = ${value as string}`); break;
      case "contract_value": fragments.push(sql`contract_value = ${value as number}`); break;
    }
  }

  if (input.category !== undefined && input.category !== null) {
    fragments.push(sql`category = ${input.category}::public.project_category`);
  }
  if (input.status !== undefined && input.status !== null) {
    fragments.push(sql`status = ${input.status}::public.project_status`);
  }
  if (input.pipelineStage !== undefined && input.pipelineStage !== null) {
    fragments.push(sql`pipeline_stage = ${input.pipelineStage}::public.pipeline_stage`);
  }

  // Nomor WhatsApp DINORMALKAN di sini, bukan ditolak. Pemilik akan menempel
  // "+62 812-3456-789" dari kontak ponselnya, sementara CHECK di database cuma
  // menerima angka — tanpa langkah ini penyimpanan gagal dengan galat yang
  // tidak berarti apa-apa baginya. Nomor terlalu pendek dianggap kosong,
  // supaya tombol WA tidak pernah merangkai tautan yang mati.
  if (input.clientWhatsapp !== undefined) {
    const angka = (input.clientWhatsapp ?? "").replace(/\D/g, "");
    fragments.push(sql`client_whatsapp = ${angka.length >= 8 ? angka : null}`);
  }
  if (input.status === "published") {
    fragments.push(sql`published_at = coalesce(published_at, now())`);
  }

  if (fragments.length === 0) return;

  let setClause = fragments[0];
  for (let i = 1; i < fragments.length; i++) setClause = sql`${setClause}, ${fragments[i]}`;

  const result = await sql`update public.projects set ${setClause} where id = ${id}::uuid`;
  if (result.count === 0) throw new NotFoundError();
}

export async function remove(sql: Sql, id: string): Promise<void> {
  const result = await sql`delete from public.projects where id = ${id}::uuid`;
  if (result.count === 0) throw new NotFoundError();
}

/** Mencatat gambar yang berkasnya sudah sampai di R2. */
export async function addImage(sql: Sql, projectID: string, input: ImageInput): Promise<string> {
  // Bawaannya 'galeri' — sama dengan default kolomnya, jadi pemanggil lama
  // yang tidak menyebut kind tetap berperilaku persis seperti sebelumnya.
  const kind = input.kind === "material" ? "material" : "galeri";
  const rows = await sql<{ id: string }[]>`
    insert into public.project_images (project_id, storage_key, alt_text, caption, width, height, sort_order, kind)
    values (${projectID}::uuid, ${input.storageKey}, ${input.altText ?? null}, ${input.caption ?? null}, ${input.width ?? null}, ${input.height ?? null}, ${input.sortOrder}, ${kind})
    returning id`;
  return rows[0].id;
}

/**
 * Gambar galeri satu proyek, urut tampil.
 *
 * Dipisah dari imagesFor() milik repository publik karena yang ini juga
 * mengembalikan storageKey — panel admin butuh itu untuk menjadikan salah
 * satu gambar sebagai cover tanpa mengunggah ulang berkasnya.
 */
export async function listImages(
  sql: Sql,
  assetBase: string,
  projectID: string,
  kind: "galeri" | "material" = "galeri",
): Promise<(Image & { storageKey: string })[]> {
  const rows = await sql<
    { id: string; storage_key: string; alt_text: string | null; caption: string | null;
      width: number | null; height: number | null; sort_order: number }[]
  >`
    select id, storage_key, alt_text, caption, width, height, sort_order
    from public.project_images
    where project_id = ${projectID}::uuid and kind = ${kind}
    order by sort_order, created_at`;

  return rows.map((r) => ({
    id: r.id,
    storageKey: r.storage_key,
    url: url(assetBase, r.storage_key) ?? "",
    altText: r.alt_text,
    caption: r.caption,
    width: r.width,
    height: r.height,
    sortOrder: r.sort_order,
  }));
}

/**
 * Ubah keterangan atau urutan satu gambar.
 *
 * Setiap kolom ditulis dengan pola "kalau tidak dikirim, pakai nilai lama"
 * supaya patch sebagian tidak diam-diam mengosongkan kolom lain.
 */
export async function updateImage(sql: Sql, id: string, patch: ImagePatch): Promise<void> {
  const result = await sql`
    update public.project_images set
      alt_text   = ${patch.altText === undefined ? sql`alt_text` : patch.altText},
      caption    = ${patch.caption === undefined ? sql`caption` : patch.caption},
      sort_order = ${patch.sortOrder === undefined ? sql`sort_order` : patch.sortOrder}
    where id = ${id}::uuid`;
  if (result.count === 0) throw new NotFoundError();
}

export async function removeImage(sql: Sql, id: string): Promise<void> {
  const result = await sql`delete from public.project_images where id = ${id}::uuid`;
  if (result.count === 0) throw new NotFoundError();
}

/** Pesan masuk, terbaru lebih dulu. */
export async function listInquiries(sql: Sql, status: string): Promise<InquiryRecord[]> {
  const rows = await sql<InquiryRecord[]>`
    select id, name, email, phone, project_type as "projectType", budget_range as "budgetRange",
           message, status, created_at as "createdAt"
    from public.inquiries
    where (${status} = '' or status::text = ${status})
    order by created_at desc
    limit 200`;
  return rows;
}

export async function setInquiryStatus(sql: Sql, id: string, status: string): Promise<void> {
  const result = await sql`
    update public.inquiries set status = ${status}::public.inquiry_status where id = ${id}::uuid`;
  if (result.count === 0) throw new NotFoundError();
}
