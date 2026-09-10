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
  contractor: string | null;
  lighting_designer: string | null;
  photographer: string | null;
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
    contractor: row.contractor,
    lightingDesigner: row.lighting_designer,
    photographer: row.photographer,
    coverImageUrl: projectUrl(assetBase, row.cover_image_key),
    isFeatured: row.is_featured,
    publishedAt: row.published_at,
  };
}

/**
 * Proyek published untuk grid portfolio.
 *
 * Description sengaja tidak ikut supaya payload listing tetap ringan — tapi
 * FOTO GALERI ikut, dan itu bukan hiasan. Beranda menyusun foto besar di
 * bawah hero dan tiga foto proses dari `images` milik daftar ini; selama
 * daftar mengembalikannya kosong, seluruh bagian itu tampil tanpa satu pun
 * gambar sementara fotonya sudah lama ada di database. Sudah dilaporkan
 * pemilik: dia mengunggah sepuluh foto dan tidak satu pun muncul.
 */
export async function list(sql: Sql, assetBase: string, f: ProjectFilter): Promise<Project[]> {
  const rows = await sql<ProjectRow[]>`
    select id, slug, title, subtitle, summary, category,
           location, city, year, client, area_sqm, lead_architect,
           contractor, lighting_designer, photographer,
           cover_image_key, is_featured, published_at
    from public.projects
    where status = 'published'
      and (${f.category} = '' or category::text = ${f.category})
      and (not ${f.featured} or is_featured)
    order by is_featured desc, sort_order, published_at desc nulls last
    limit ${f.limit} offset ${f.offset}`;

  const proyek = rows.map((r) => rowToProject(r, assetBase));
  await lampirkanFoto(sql, assetBase, proyek);
  return proyek;
}

/**
 * Menempelkan foto galeri ke sekumpulan proyek dengan SATU query, bukan satu
 * query per proyek. Daftar portfolio memang pendek hari ini, tapi pola
 * per-proyek adalah pola yang diam-diam jadi dua puluh query begitu
 * karyanya bertambah.
 */
async function lampirkanFoto(sql: Sql, assetBase: string, proyek: Project[]): Promise<void> {
  if (proyek.length === 0) return;

  const ids = proyek.map((p) => p.id);

  /* `in ${sql(...)}`, BUKAN `= any(${ids}::uuid[])`.

     Worker menyambung dengan fetch_types:false (lihat src/db.ts), jadi
     postgres.js tidak punya katalog tipe dan tidak bisa menyerialkan sebuah
     ARRAY JavaScript menjadi array literal Postgres — ia mengirimkannya
     sebagai string biasa dan Postgres menolak dengan "malformed array
     literal". Bentuk `in` merender satu parameter per elemen, jadi tidak ada
     tipe array yang perlu diketahui.

     Terlewat karena uji lokal memakai setelan postgres.js BAWAAN, tempat
     fetch_types menyala dan array-nya bekerja. Deploy-nya merah, situs lama
     selamat karena listProjects() memakai wajib(). Sekarang diuji dengan
     setelan yang sama persis seperti Worker. */
  const rows = await sql<
    { project_id: string; id: string; storage_key: string; alt_text: string | null; caption: string | null; width: number | null; height: number | null; blur_data_url: string | null; sort_order: number }[]
  >`
    select project_id, id, storage_key, alt_text, caption, width, height, blur_data_url, sort_order
    from public.project_images
      where project_id in ${sql(ids)} and kind = 'galeri'
    order by sort_order, created_at`;

  const per = new Map<string, Image[]>();
  for (const r of rows) {
    const daftar = per.get(r.project_id) ?? [];
    daftar.push({
      id: r.id,
      url: projectUrl(assetBase, r.storage_key) ?? "",
      altText: r.alt_text,
      caption: r.caption,
      width: r.width,
      height: r.height,
      blurDataUrl: r.blur_data_url,
      sortOrder: r.sort_order,
    });
    per.set(r.project_id, daftar);
  }

  /* Yang tanpa foto tetap diberi array kosong, bukan dibiarkan undefined —
     pemanggil jadi tidak perlu membedakan "belum diambil" dari "memang
     tidak ada". */
  for (const p of proyek) p.images = per.get(p.id) ?? [];
}

/** Satu proyek published lengkap dengan galerinya. */
export async function getBySlug(sql: Sql, assetBase: string, slug: string): Promise<Project> {
  const rows = await sql<(ProjectRow & { description: string | null; seo_title: string | null; seo_description: string | null })[]>`
    select id, slug, title, subtitle, summary, category,
           location, city, year, client, area_sqm, lead_architect,
           contractor, lighting_designer, photographer,
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
