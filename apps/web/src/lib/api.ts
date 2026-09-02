/**
 * Klien untuk Worker API.
 *
 * Dipakai saat build (generate halaman statis) dan dari browser (form kontak).
 */

const API_BASE_URL = (
  import.meta.env.PUBLIC_API_BASE_URL ?? "http://localhost:8787"
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
  /** Bahan yang dipakai di proyek ini. Tabel yang sama dengan images,
   *  dibedakan kolom kind — lihat repository/projects.ts di API. */
  materials?: ProjectImage[];
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

  const body = (await response.json()) as Partial<Envelope<T>>;

  // Balasan tanpa field `data` bukan balasan yang sah. Tanpa pemeriksaan ini
  // ia lolos sebagai `undefined` dan baru meledak jauh di halaman yang
  // memakainya — padahal maksud safely() justru menahan kegagalan API di
  // sini. Dilempar supaya nilai cadangan yang dipakai.
  if (!body || typeof body !== "object" || !("data" in body)) {
    throw new Error(`API ${path} membalas tanpa field data`);
  }

  return body.data as T;
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

// Gambar cadangan untuk kartu bagikan halaman yang tidak punya gambarnya
// sendiri (/kontak, /tentang, /faq). Foto proyek unggulan dipilih lebih dulu;
// kalau belum ada yang diunggulkan, proyek terbit mana pun. Sama seperti
// setelan studio, hasilnya ditampung supaya satu build tidak menembak API
// berulang kali untuk jawaban yang sama.
let gambarTersimpan: Promise<string | undefined> | null = null;

export function gambarBagikan(): Promise<string | undefined> {
  if (!gambarTersimpan) {
    gambarTersimpan = (async () => {
      const proyek = await listProjects({ limit: 12 });
      if (!Array.isArray(proyek)) return undefined;
      const unggulan = proyek.find((p) => p.isFeatured && p.coverImageUrl);
      return (unggulan ?? proyek.find((p) => p.coverImageUrl))?.coverImageUrl;
    })();
  }
  return gambarTersimpan;
}

export interface StudioSettings {
  studioName: string;
  tagline?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  instagramUrl?: string | null;
  logoUrl?: string | null;
}

const FALLBACK_SETTINGS: StudioSettings = {
  studioName: "Dirga Pahlevi Architecture",
  email: "studio@pahlevidirgaarchitecture.com",
};

// Header, Footer, dan BaseLayout sama-sama butuh setelan studio, jadi tanpa
// penampung ini satu build 26 halaman menembak /api/v1/settings 78 kali untuk
// jawaban yang sama persis. Yang disimpan promise-nya, bukan hasilnya —
// panggilan berbarengan ikut menunggu permintaan yang sudah jalan, bukan
// memulai permintaan kedua.
let setelanTersimpan: Promise<StudioSettings> | null = null;

export function getSettings(): Promise<StudioSettings> {
  if (!setelanTersimpan) {
    setelanTersimpan = safely<StudioSettings>("/api/v1/settings", FALLBACK_SETTINGS);
  }
  return setelanTersimpan;
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

export interface PublicTestimonial {
  clientName: string;
  quote: string;
  rating?: number | null;
}

export function listTestimonials(featuredOnly = false): Promise<PublicTestimonial[]> {
  return safely<PublicTestimonial[]>(`/api/v1/testimonials${featuredOnly ? "?featured=true" : ""}`, []);
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
