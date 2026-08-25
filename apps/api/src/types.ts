/** Binding dan environment variable Worker — cermin dari wrangler.jsonc + secrets. */
export interface Env {
  APP_ENV: string;
  ALLOWED_ORIGINS: string;
  INQUIRY_FROM: string;

  // Secrets — diisi lewat `wrangler secret put`, tidak pernah di wrangler.jsonc.
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  SUPABASE_ANON_KEY?: string;

  R2_ACCOUNT_ID?: string;
  R2_ACCESS_KEY_ID?: string;
  R2_SECRET_ACCESS_KEY?: string;
  R2_BUCKET?: string;
  R2_PUBLIC_BASE_URL?: string;

  TURNSTILE_SECRET_KEY?: string;
  IP_HASH_SALT?: string;

  RESEND_API_KEY?: string;
  INQUIRY_NOTIFY_TO?: string;

  // Bindings
  DB: Hyperdrive;
  RATE_LIMIT: KVNamespace;
  MEDIA: R2Bucket;
}

/** Konteks yang dipasang RequireSupabaseAuth ke Hono setelah token diverifikasi. */
export interface AuthContext {
  userID: string;
  userEmail?: string;
}

export interface Project {
  id: string;
  slug: string;
  title: string;
  subtitle?: string | null;
  summary?: string | null;
  description?: string | null;
  category: string;
  status?: string;
  location?: string | null;
  city?: string | null;
  year?: number | null;
  client?: string | null;
  areaSqm?: number | null;
  leadArchitect?: string | null;
  coverImageUrl?: string | null;
  isFeatured: boolean;
  seoTitle?: string | null;
  seoDescription?: string | null;
  publishedAt?: string | null;
  images?: Image[];
  /** Tahap alur kerja internal studio — beda dari status (draft/published/archived). */
  pipelineStage?: string;
}

export interface Image {
  id: string;
  url: string;
  altText?: string | null;
  caption?: string | null;
  width?: number | null;
  height?: number | null;
  blurDataUrl?: string | null;
  sortOrder: number;
}

export interface ProjectFilter {
  category: string;
  featured: boolean;
  limit: number;
  offset: number;
}

/** Field yang boleh disunting staf. undefined berarti "jangan diubah". */
export interface ProjectInput {
  slug?: string;
  title?: string;
  subtitle?: string | null;
  summary?: string | null;
  description?: string | null;
  category?: string;
  status?: string;
  location?: string | null;
  city?: string | null;
  year?: number | null;
  client?: string | null;
  areaSqm?: number | null;
  leadArchitect?: string | null;
  coverImageKey?: string | null;
  isFeatured?: boolean;
  seoTitle?: string | null;
  seoDescription?: string | null;
  pipelineStage?: string;
}

export interface ImageInput {
  storageKey: string;
  altText?: string | null;
  caption?: string | null;
  width?: number | null;
  height?: number | null;
  sortOrder: number;
}

export interface InquiryInput {
  name: string;
  email: string;
  phone?: string | null;
  projectType?: string | null;
  budgetRange?: string | null;
  message: string;
  source?: string | null;
  ipHash: string;
  userAgent: string;
}

export interface StudioSettings {
  studioName: string;
  tagline?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  instagramUrl?: string | null;
}

/** Field yang boleh diubah lewat panel admin. undefined berarti "jangan diubah". */
export interface StudioSettingsInput {
  studioName?: string;
  tagline?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  instagramUrl?: string | null;
}

export interface ProjectProgressUpdate {
  id: string;
  title: string;
  note?: string | null;
  photoUrl?: string | null;
  createdAt: string;
}

/** Dilihat staf: termasuk accessToken untuk menyalin link klien. */
export interface ProjectProgress {
  phase: string;
  accessToken: string;
  updates: ProjectProgressUpdate[];
}

/** Dilihat klien lewat link token: tanpa data admin, tanpa token itu sendiri. */
export interface ClientProgressView {
  projectTitle: string;
  coverImageUrl?: string | null;
  phase: string;
  updates: ProjectProgressUpdate[];
}

export interface TeamMember {
  id: string;
  name: string;
  role?: string | null;
}

export interface TeamMemberInput {
  name?: string;
  role?: string | null;
}

export interface ProjectTask {
  id: string;
  projectId: string;
  projectTitle?: string;
  title: string;
  stage?: string | null;
  assigneeId?: string | null;
  assigneeName?: string | null;
  status: string;
  dueDate?: string | null;
  sortOrder: number;
}

export interface ProjectTaskInput {
  title?: string;
  stage?: string | null;
  assigneeId?: string | null;
  status?: string;
  dueDate?: string | null;
  sortOrder?: number;
}

export interface InquiryRecord {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  projectType?: string | null;
  budgetRange?: string | null;
  message: string;
  status: string;
  createdAt: string;
}

export const VALID_CATEGORIES = new Set([
  "residential",
  "commercial",
  "interior",
  "landscape",
  "masterplan",
  "renovation",
]);

export const VALID_PROJECT_STATUS = new Set(["draft", "published", "archived"]);
export const VALID_INQUIRY_STATUS = new Set(["new", "contacted", "qualified", "closed"]);
export const VALID_PROJECT_PHASE = new Set([
  "konsultasi",
  "konsep",
  "ded",
  "perizinan",
  "konstruksi",
  "selesai",
]);

export const VALID_PIPELINE_STAGE = new Set([
  "proposal",
  "deal_kontrak",
  "dp_50",
  "desain_1",
  "desain_2",
  "finish",
  "pelunasan",
]);

export const VALID_TASK_STATUS = new Set([
  "belum_mulai",
  "berjalan",
  "review_internal",
  "menunggu_klien",
  "selesai",
]);
