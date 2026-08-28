import type { Sql } from "postgres";
import type { Project, ProjectFilter, Image } from "../types";

export class NotFoundError extends Error {}

function projectUrl(assetBase: string, key: string | null): string | null {
  if (!key) return null;
  return `${assetBase.replace(/\/$/, "")}/${key.replace(/^\//, "")}`;
}

interface ProjectRow {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  summary: string | null;
  category: string;
  location: string | null;
  city: string | null;
  year: number | null;
  client: string | null;
  area_sqm: string | null;
  lead_architect: string | null;
  cover_image_key: string | null;
  is_featured: boolean;
  published_at: string | null;
}

function rowToProject(row: ProjectRow, assetBase: string): Project {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    subtitle: row.subtitle,
    summary: row.summary,
    category: row.category,
    location: row.location,
    city: row.city,
    year: row.year,
    client: row.client,
    areaSqm: row.area_sqm !== null ? Number(row.area_sqm) : null,
    leadArchitect: row.lead_architect,
    coverImageUrl: projectUrl(assetBase, row.cover_image_key),
    isFeatured: row.is_featured,
    publishedAt: row.published_at,
  };
}

/** Proyek published untuk grid portfolio. Description sengaja tidak ikut supaya payload listing tetap ringan. */
export async function list(sql: Sql, assetBase: string, f: ProjectFilter): Promise<Project[]> {
  const rows = await sql<ProjectRow[]>`
    select id, slug, title, subtitle, summary, category,
           location, city, year, client, area_sqm, lead_architect,
           cover_image_key, is_featured, published_at
    from public.projects
    where status = 'published'
      and (${f.category} = '' or category::text = ${f.category})
      and (not ${f.featured} or is_featured)
    order by is_featured desc, sort_order, published_at desc nulls last
    limit ${f.limit} offset ${f.offset}`;

  return rows.map((r) => rowToProject(r, assetBase));
}

/** Satu proyek published lengkap dengan galerinya. */
export async function getBySlug(sql: Sql, assetBase: string, slug: string): Promise<Project> {
  const rows = await sql<(ProjectRow & { description: string | null; seo_title: string | null; seo_description: string | null })[]>`
    select id, slug, title, subtitle, summary, category,
           location, city, year, client, area_sqm, lead_architect,
           cover_image_key, is_featured, published_at,
           description, seo_title, seo_description
    from public.projects
    where status = 'published' and slug = ${slug}`;

  const row = rows[0];
  if (!row) throw new NotFoundError();

  const project = rowToProject(row, assetBase);
  project.description = row.description;
  project.seoTitle = row.seo_title;
  project.seoDescription = row.seo_description;
  project.images = await imagesFor(sql, assetBase, row.id);
  project.materials = await imagesFor(sql, assetBase, row.id, "material");
  return project;
}

/**
 * Foto galeri saja — foto material sengaja TIDAK ikut.
 *
 * Keduanya tinggal di tabel yang sama, jadi tanpa penyaring ini seluruh
 * foto material bocor ke galeri halaman proyek publik begitu ada yang
 * mengunggahnya. Materialnya punya seksinya sendiri (materialsFor).
 */
async function imagesFor(
  sql: Sql,
  assetBase: string,
  projectID: string,
  kind: "galeri" | "material" = "galeri",
): Promise<Image[]> {
  const rows = await sql<
    { id: string; storage_key: string; alt_text: string | null; caption: string | null; width: number | null; height: number | null; blur_data_url: string | null; sort_order: number }[]
  >`
    select id, storage_key, alt_text, caption, width, height, blur_data_url, sort_order
    from public.project_images
    where project_id = ${projectID} and kind = ${kind}
    order by sort_order, created_at`;

  return rows.map((r) => ({
    id: r.id,
    url: projectUrl(assetBase, r.storage_key) ?? "",
    altText: r.alt_text,
    caption: r.caption,
    width: r.width,
    height: r.height,
    blurDataUrl: r.blur_data_url,
    sortOrder: r.sort_order,
  }));
}
