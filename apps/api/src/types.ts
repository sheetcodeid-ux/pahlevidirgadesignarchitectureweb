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

  /* Token GitHub untuk memicu build ulang situs statis dari panel admin.
     Cakupannya cukup "actions: write" pada satu repo ini saja — bukan token
     serba bisa. Kalau kosong, tombol Terbitkan situs mengatakan dirinya
     belum dikonfigurasi, bukan diam-diam gagal. */
  GITHUB_DISPATCH_TOKEN?: string;
  GITHUB_REPO?: string;
  GITHUB_WORKFLOW?: string;
  GITHUB_BRANCH?: string;

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
  /** Foto material yang dipakai proyek — seksi tersendiri, bukan galeri. */
  materials?: Image[];
  /** Tahap alur kerja internal studio — beda dari status (draft/published/archived). */
  pipelineStage?: string;
  /** Fase yang dilihat KLIEN di portal token. Beda sumber dari pipelineStage:
   *  ini kolom project_progress.phase, bukan projects.pipeline_stage. */
  phase?: string | null;
  contractValue?: number | null;
  /** Nomor WhatsApp klien, angka saja (mis. 628123456789). */
  clientWhatsapp?: string | null;
  /** Jumlah uang yang BENAR-BENAR sudah diterima proyek ini. Dipakai tabel
   *  untuk memutuskan antara "Belum Bayar", DP berjalan, dan "Lunas". */
  paidTotal?: number;
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
  contractValue?: number | null;
  clientWhatsapp?: string | null;
}

/** Satu uang masuk yang benar-benar diterima — bukan tagihan. */
export interface Payment {
  id: string;
  projectId: string;
  amount: number;
  /** 'dp' | 'termin' | 'pelunasan' */
  kind: string;
  /** 'tunai' | 'transfer' | 'qris' | 'lainnya' */
  method: string;
  receiver?: string | null;
  note?: string | null;
  paidAt: string;
  /** Kunci tautan bukti publik. Tidak pernah sama dengan id barisnya. */
  receiptToken: string;
}

export interface PaymentInput {
  amount: number;
  kind?: string;
  method?: string;
  receiver?: string | null;
  note?: string | null;
}

/** Bukti yang dibuka klien tanpa login. Sengaja TIDAK memuat id proyek,
 *  nomor WhatsApp, atau apa pun yang tidak dicetak di kertasnya. */
export interface Receipt {
  id: string;
  receiptToken: string;
  amount: number;
  kind: string;
  method: string;
  receiver?: string | null;
  paidAt: string;
  projectTitle: string;
  contractValue: number | null;
  studioName: string;
}

/** Foto galeri dan foto material tinggal di tabel yang sama, dibedakan kind. */
export type ImageKind = "galeri" | "material";

export interface ImageInput {
  storageKey: string;
  altText?: string | null;
  caption?: string | null;
  width?: number | null;
  height?: number | null;
  sortOrder: number;
  kind?: ImageKind;
}

/** Patch sebagian untuk satu gambar galeri. */
export interface ImagePatch {
  altText?: string | null;
  caption?: string | null;
  sortOrder?: number;
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
  logoUrl?: string | null;
  /** Nama zona IANA, bukan singkatan. Lihat migrasi 20260902000012. */
  timezone: string;
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
  logoKey?: string | null;
  timezone?: string;
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

/** 'berkas' = lampiran biasa, 'suara' = pesan suara rekaman staf. */
export type DocumentKind = "berkas" | "suara";

export const VALID_DOCUMENT_KIND: ReadonlySet<string> = new Set(["berkas", "suara"]);

/** 100 MB per berkas — angka yang sama dijaga di form, di sini, dan di CHECK database. */
export const MAX_DOCUMENT_BYTES = 104857600;

export interface ProjectDocument {
  id: string;
  projectId: string;
  title: string;
  fileUrl: string;
  kind: DocumentKind;
  status: string;
  clientNote?: string | null;
  fileName?: string | null;
  fileSize?: number | null;
  mimeType?: string | null;
  /** Hanya terisi untuk pesan suara — durasi harus tampil sebelum audionya diunduh. */
  durationMs?: number | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectDocumentInput {
  title?: string;
  fileKey?: string;
  kind?: string;
  status?: string;
  sortOrder?: number;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  durationMs?: number;
}

/** Dilihat klien lewat link token: hanya field yang boleh dia lihat, tanpa catatan biaya internal. */
export interface ClientDocument {
  id: string;
  title: string;
  fileUrl: string;
  kind: DocumentKind;
  status: string;
  clientNote?: string | null;
  fileSize?: number | null;
  mimeType?: string | null;
  durationMs?: number | null;
  comments: DocumentComment[];
}

export interface ClientInvoice {
  id: string;
  label: string;
  amount: number;
  status: string;
  dueDate?: string | null;
}

/** Dilihat staf: termasuk internalNotes yang tidak pernah sampai ke klien. */
export interface ProjectBrief {
  /* budgetRange dan timeline peninggalan bentuk lama (teks bebas). Tetap
     dikirim supaya klien lama tidak pecah; yang dipakai form sekarang
     budgetAmount, startDate, dan endDate. */
  budgetRange?: string | null;
  budgetAmount?: number | null;
  startDate?: string | null;
  endDate?: string | null;
  timeline?: string | null;
  stylePreference?: string | null;
  requirements?: string | null;
  internalNotes?: string | null;
  submittedAt?: string | null;
}

/** Field yang boleh diubah staf — mencakup internalNotes. undefined = jangan diubah. */
export interface ProjectBriefInput {
  budgetRange?: string | null;
  budgetAmount?: number | null;
  startDate?: string | null;
  endDate?: string | null;
  timeline?: string | null;
  stylePreference?: string | null;
  requirements?: string | null;
  internalNotes?: string | null;
}

/** Field yang boleh dikirim klien lewat portal token — tanpa internalNotes.
 *
 *  budgetRange dan timeline masih diterima: keduanya kolom lama yang isinya
 *  belum tentu kosong, dan menolaknya akan membuat portal klien yang belum
 *  ter-deploy ulang gagal menyimpan. Yang dikirim form sekarang budgetAmount,
 *  startDate, dan endDate. */
export interface ClientBriefInput {
  budgetRange?: string | null;
  budgetAmount?: number | null;
  startDate?: string | null;
  endDate?: string | null;
  timeline?: string | null;
  stylePreference?: string | null;
  requirements?: string | null;
}

/** Dilihat klien: sama seperti ProjectBrief tapi tanpa internalNotes. */
export interface ClientBrief {
  budgetRange?: string | null;
  budgetAmount?: number | null;
  startDate?: string | null;
  endDate?: string | null;
  timeline?: string | null;
  stylePreference?: string | null;
  requirements?: string | null;
  submittedAt?: string | null;
}

export interface DocumentComment {
  id: string;
  documentId: string;
  author: string;
  body: string;
  createdAt: string;
}

export interface Testimonial {
  id: string;
  projectId?: string | null;
  projectTitle?: string | null;
  clientName: string;
  quote: string;
  rating?: number | null;
  status: string;
  isFeatured: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TestimonialInput {
  projectId?: string | null;
  clientName?: string;
  quote?: string;
  rating?: number | null;
  status?: string;
  isFeatured?: boolean;
}

/** Ditampilkan di situs publik — hanya testimoni berstatus disetujui. */
export interface PublicTestimonial {
  clientName: string;
  quote: string;
  rating?: number | null;
}

/** Dilihat klien lewat link token: tanpa data admin, tanpa token itu sendiri. */
export interface ClientProgressView {
  projectTitle: string;
  coverImageUrl?: string | null;
  phase: string;
  updates: ProjectProgressUpdate[];
  documents: ClientDocument[];
  invoices: ClientInvoice[];
  brief: ClientBrief;
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

export interface Invoice {
  id: string;
  projectId: string;
  label: string;
  amount: number;
  status: string;
  dueDate?: string | null;
  paidAt?: string | null;
  sortOrder: number;
}

export interface InvoiceInput {
  label?: string;
  amount?: number;
  status?: string;
  dueDate?: string | null;
  sortOrder?: number;
}

export interface ProjectCost {
  id: string;
  projectId: string;
  label: string;
  category: string;
  amount: number;
  /** Tanggal biaya benar-benar terjadi (YYYY-MM-DD), bukan kapan diketik. */
  incurredOn: string;
}

export interface ProjectCostInput {
  label?: string;
  category?: string;
  amount?: number;
  incurredOn?: string;
}

export interface FinanceOverviewRow {
  projectId: string;
  projectTitle: string;
  contractValue: number | null;
  received: number;
  costsTotal: number;
  /** Proyeksi: (kontrak - biaya) / kontrak. Janji, bukan uang. */
  marginPct: number | null;
  /** Kenyataan kas: diterima - biaya. Bisa minus, dan itu memang informasinya. */
  labaBersih: number;
  /** Sisa yang belum ditagih maupun belum dibayar: kontrak - diterima. */
  belumDiterima: number | null;
}

/** Satu kategori biaya, untuk donat Rincian Beban. */
export interface BebanKategori {
  /** Nilai enum public.cost_category. */
  kategori: string;
  nilai: number;
}

export interface FinanceOverview {
  kasMasuk: number;
  piutang: number;
  marginRataRata: number | null;
  /** Total kas masuk dikurangi seluruh biaya, lintas proyek yang tercakup. */
  labaBersih: number;
  totalBiaya: number;
  totalKontrak: number;
  proyek: FinanceOverviewRow[];
  /**
   * Seluruh biaya dipecah per kategori.
   *
   * Selalu memuat KEEMPAT kategori, termasuk yang nilainya nol. Kategori
   * yang hilang saat nilainya nol membuat warna irisan di donat bergeser
   * dari bulan ke bulan — "operasional" bisa biru bulan ini dan hijau bulan
   * depan hanya karena ada satu kategori yang kosong.
   */
  bebanKategori: BebanKategori[];
}

/** Satu bulan di halaman Analisis Bulanan. */
export interface FinanceMonthRow {
  /** YYYY-MM. */
  bulan: string;
  kasMasuk: number;
  biaya: number;
  labaBersih: number;
  /** Proyek yang punya kas masuk ATAU biaya di bulan itu. */
  proyekAktif: number;
}

export interface DirectoryContact {
  id: string;
  name: string;
  category: string;
  company?: string | null;
  phone?: string | null;
  email?: string | null;
  note?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DirectoryContactInput {
  name?: string;
  category?: string;
  company?: string | null;
  phone?: string | null;
  email?: string | null;
  note?: string | null;
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

export const VALID_INVOICE_STATUS = new Set(["draft", "terbit", "lunas"]);

export const VALID_COST_CATEGORY = new Set([
  "freelancer",
  "operasional",
  "prinsipal",
  "lainnya",
]);

export const VALID_DOCUMENT_STATUS = new Set([
  "draft",
  "menunggu_klien",
  "revisi_diminta",
  "disetujui",
  "final",
]);

export const VALID_CONTACT_CATEGORY = new Set([
  "klien",
  "kontraktor",
  "supplier",
  "lainnya",
]);

export const VALID_TESTIMONIAL_STATUS = new Set([
  "menunggu",
  "disetujui",
  "ditolak",
]);
