/**
 * Klien untuk backend Go.
 *
 * Dipakai saat build (generate halaman statis) dan dari browser (form kontak).
 */

const API_BASE_URL = (
  import.meta.env.PUBLIC_API_BASE_URL ?? "http://localhost:8080"
).replace(/\/$/, "");

export type ProjectCategory =
  | "residential"
  | "commercial"
  | "interior"
  | "landscape"
  | "masterplan"
  | "renovation";

export const CATEGORY_LABELS: Record<ProjectCategory, string> = {
  residential: "Hunian",
  commercial: "Komersial",
  interior: "Interior",
  landscape: "Lanskap",
  masterplan: "Masterplan",
  renovation: "Renovasi",
};

export interface ProjectImage {
  id: string;
  url: string;
  altText?: string;
  caption?: string;
  width?: number;
  height?: number;
  blurDataUrl?: string;
  sortOrder: number;
}

export interface Project {
  id: string;
  slug: string;
  title: string;
  subtitle?: string;
  summary?: string;
  description?: string;
  category: ProjectCategory;
  location?: string;
  city?: string;
  year?: number;
  client?: string;
  areaSqm?: number;
  leadArchitect?: string;
  coverImageUrl?: string;
  isFeatured: boolean;
  seoTitle?: string;
  seoDescription?: string;
  publishedAt?: string;
  images?: ProjectImage[];
}

interface Envelope<T> {
  data: T;
}

async function request<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`API ${path} membalas ${response.status}`);
  }

  const body = (await response.json()) as Envelope<T>;
  return body.data;
}

/**
 * Build tidak boleh gagal total hanya karena backend sedang tidak bisa
 * dihubungi — situs lama tetap tayang, dan halaman yang gagal di-generate
 * akan terisi pada deploy berikutnya.
 */
async function safely<T>(path: string, fallback: T): Promise<T> {
  try {
    return await request<T>(path);
  } catch (error) {
    console.warn(`[api] gagal mengambil ${path}:`, (error as Error).message);
    return fallback;
  }
}

export function listProjects(options: {
  category?: ProjectCategory;
  featured?: boolean;
  limit?: number;
} = {}): Promise<Project[]> {
  const params = new URLSearchParams();
  if (options.category) params.set("category", options.category);
  if (options.featured) params.set("featured", "true");
  params.set("limit", String(options.limit ?? 48));

  return safely<Project[]>(`/api/v1/projects?${params}`, []);
}

export function getProject(slug: string): Promise<Project | null> {
  return safely<Project | null>(`/api/v1/projects/${encodeURIComponent(slug)}`, null);
}

export interface InquiryPayload {
  name: string;
  email: string;
  phone?: string;
  projectType?: string;
  budgetRange?: string;
  message: string;
  turnstileToken: string;
  website?: string;
}

export async function submitInquiry(payload: InquiryPayload): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/v1/inquiries`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, source: "website" }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error?.message ?? "Pesan gagal dikirim.");
  }
}
