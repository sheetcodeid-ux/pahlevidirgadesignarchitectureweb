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

  /* "1" = akun berperan pelanggan boleh masuk. Bawaan tertutup: di tahap 1
     datanya masih satu studio, jadi pelanggan yang masuk akan melihat
     proyek dan keuangan studio pemilik. Baru dibuka sesudah pemisahan data
     per studio selesai. */
  PELANGGAN_DIIZINKAN?: string;
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
  /* Kredit proyek. Ketiganya per proyek, bukan per studio: fotografer dan
     kontraktor hampir selalu berganti dari satu karya ke karya berikutnya. */
  contractor?: string | null;
  lightingDesigner?: string | null;
  photographer?: string | null;
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
  /** Lingkup kerja yang disepakati studio — internal, tidak pernah ke situs publik. */
  scopeOfWork?: string | null;
  /** Tenggat preview untuk klien (YYYY-MM-DD). */
  deadlinePreview?: string | null;
  /** Tenggat desain final (YYYY-MM-DD). */
  deadlineFinal?: string | null;
  /** Paket layanan proyek ini (service_tiers.id) — boleh kosong. */
  tierId?: string | null;
  /** Jumlah uang yang BENAR-BENAR sudah diterima proyek ini. Dipakai tabel
   *  untuk memutuskan antara "Belum Bayar", DP berjalan, dan "Lunas". */
  paidTotal?: number;
}

export interface Image {
  id: string;
  url: string;
  /** URL versi kecil foto ini, untuk rel pemilih foto. Kosong pada foto yang
   *  diunggah sebelum kolom thumb_key ada — pemakainya memakai `url`. */
  thumbUrl?: string | null;
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
  contractor?: string | null;
  lightingDesigner?: string | null;
  photographer?: string | null;
  coverImageKey?: string | null;
  isFeatured?: boolean;
  seoTitle?: string | null;
  seoDescription?: string | null;
  pipelineStage?: string;
  contractValue?: number | null;
  clientWhatsapp?: string | null;
  /** Lingkup kerja yang disepakati studio — internal, tidak pernah ke situs publik. */
  scopeOfWork?: string | null;
  /** Tenggat preview untuk klien (YYYY-MM-DD). */
  deadlinePreview?: string | null;
  /** Tenggat desain final (YYYY-MM-DD). */
  deadlineFinal?: string | null;
  /** Paket layanan; null/"" = lepaskan tautan. */
  tierId?: string | null;
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
  /** Ikut terbawa oleh daftar LINTAS proyek, tidak oleh daftar per proyek —
   *  sama persis dengan `ProjectCost.projectTitle`. */
  projectTitle?: string;
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
  /** Key R2 versi kecil. Kosong = panel tidak berhasil membuatnya; pemakainya
   *  jatuh kembali ke foto penuh. */
  thumbKey?: string | null;
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

  /* --- Isi halaman publik (migrasi 20260910000021) ------------------------
   *
   * Semuanya boleh null, dan halaman publik memang dirancang untuk itu:
   * bagian yang datanya belum ada tetap dirender dengan penanda "menunggu"
   * yang ikut dirancang, supaya bentuk halamannya tidak berubah begitu
   * datanya masuk. */

  /** Dipakai di eyebrow beranda ("SINCE ...") dan garis waktu /studio. */
  foundedYear?: number | null;
  firstCommercialYear?: number | null;
  /** Pembanding sebelum/sesudah di /studio. URL siap pakai, dibalas server. */
  beforeUrl?: string | null;
  afterUrl?: string | null;
  /** Empat keterangan halaman privasi. Tidak boleh dikarang. */
  legalEntity?: string | null;
  legalAddress?: string | null;
  retentionMessages?: string | null;
  retentionDocuments?: string | null;
  governingLaw?: string | null;
  /** Empat angka di FAQ. Teks, bukan bilangan — jawabannya sebuah kalimat. */
  faqTarif?: string | null;
  faqUangMuka?: string | null;
  faqLamaKerja?: string | null;
  faqKunjungan?: string | null;
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

  foundedYear?: number | null;
  firstCommercialYear?: number | null;
  /** Kunci R2 dari unggahan terbaru — dikirim saat menyimpan, bukan dibaca. */
  beforeKey?: string | null;
  afterKey?: string | null;
  legalEntity?: string | null;
  legalAddress?: string | null;
  retentionMessages?: string | null;
  retentionDocuments?: string | null;
  governingLaw?: string | null;
  faqTarif?: string | null;
  faqUangMuka?: string | null;
  faqLamaKerja?: string | null;
  faqKunjungan?: string | null;
}

/**
 * Satu orang di halaman /studio.
 *
 * BUKAN `TeamMember` — nama itu sudah dipakai fitur Tim & Freelancer yang
 * mengurus siapa dibayar berapa untuk proyek mana. Yang ini murni isi
 * halaman publik: nama, peran, dan potret yang dilihat calon klien.
 */
export interface StudioPerson {
  id: string;
  /** Boleh kosong: kartunya tetap tampil beserta perannya, bertanda menunggu. */
  name: string | null;
  role: string;
  bio: string | null;
  photoUrl: string | null;
  /** Label di slot foto yang masih kosong ("PRINCIPAL", "STAFF"). */
  slotLabel: string;
  sortOrder: number;
}

export interface StudioPersonInput {
  name?: string | null;
  role?: string;
  bio?: string | null;
  photoKey?: string | null;
  slotLabel?: string;
  sortOrder?: number;
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
  createdAt?: string;
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
  /* Tiga hal berikut sudah ada di tabel projects dan tidak menambah apa pun
     yang belum boleh dilihat klien: kategori dan kota tercetak di kepala
     halaman proyeknya sendiri, dan nilai kontrak adalah nilai kontrak DIA.
     Tanpa contractValue panel "uang sejauh ini" tidak bisa menghitung sisa —
     dan sisa itulah satu-satunya angka yang benar-benar dicari klien. */
  category: string;
  city?: string | null;
  contractValue: number | null;
  /* Kapan halaman ini terakhir berubah. Diambil dari pembaruan terbaru, jadi
     ia menjawab "apakah ada yang baru sejak terakhir saya buka" tanpa klien
     harus membandingkan daftar sendiri. */
  updatedAt?: string | null;
  updates: ProjectProgressUpdate[];
  documents: ClientDocument[];
  invoices: ClientInvoice[];
  brief: ClientBrief;
}

/* ── Jurnal ──────────────────────────────────────────────────────────────
 *
 * Isi tulisan disimpan sebagai MARKDOWN dan dirender saat build oleh situs,
 * bukan di sini: API tidak pernah mengirim HTML yang perlu dibersihkan lagi
 * di sisi penerima.
 */
export type JournalCategory = "site" | "money" | "permit" | "build";

/** Dilihat staf: termasuk tulisan berencana yang belum punya isi. */
export interface JournalPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  body?: string | null;
  category: JournalCategory;
  readMinutes: number;
  /** null = masih rencana. Tanggal di masa depan = terjadwal. */
  publishedAt?: string | null;
  /** Kunci R2 sampulnya (folder jurnal/). Kosong = belum bersampul. */
  coverKey?: string | null;
  coverUrl?: string | null;
  createdAt: string;
  updatedAt: string;
}

/** undefined = jangan diubah. null pada publishedAt = kembalikan jadi rencana. */
export interface JournalPostInput {
  slug?: string;
  title?: string;
  excerpt?: string;
  body?: string | null;
  category?: JournalCategory;
  readMinutes?: number;
  publishedAt?: string | null;
  /** null = buang sampulnya. */
  coverKey?: string | null;
}

/* ── Logo klien ──────────────────────────────────────────────────────────
 *
 * Dipakai marquee "SELECTED CLIENTS" di beranda. logoUrl kosong berarti
 * logonya belum diunggah — halaman menampilkan namanya sebagai teks, jadi
 * barisnya tidak pernah bolong.
 */
export interface ClientLogo {
  id: string;
  name: string;
  logoUrl?: string | null;
  sortOrder: number;
}

/** undefined = jangan diubah. null pada logoKey = hapus logonya. */
export interface ClientLogoInput {
  name?: string;
  logoKey?: string | null;
  sortOrder?: number;
}

/** Dua kelompok paket di beranda. Kelompoknya sendiri (nama tab, kalimat
 *  pengantar) hidup di kode web — lihat migrasi 20260929000025. */
export type TierGroup = "kafe" | "rumah";
export const VALID_TIER_GROUP: ReadonlySet<string> = new Set(["kafe", "rumah"]);

/** Satu paket layanan. Fee dalam JUTA rupiah. */
export interface ServiceTier {
  id: string;
  group: TierGroup;
  slug: string;
  name: string;
  summary: string;
  feeMin: number;
  feeMax: number;
  forWhom: string;
  includesHeading: string;
  /** Satu butir per elemen — di database satu butir per baris. */
  includes: string[];
  highlighted: boolean;
  active: boolean;
  sortOrder: number;
  updatedAt: string;
}

/**
 * Pemakaian satu paket — HANYA untuk panel (tidak pernah ke beranda).
 * §3.3 dokumen strategi: tiap 3 proyek selesai pada satu tier, harga naik
 * 10–15% untuk klien baru. "Sejak harga" = proyek berpaket ini yang dibuat
 * sesudah fee paketnya terakhir diubah, yaitu yang dijual dengan harga
 * sekarang.
 */
export interface TierUsage {
  tierId: string;
  priceChangedAt: string;
  proyek: number;
  selesai: number;
  selesaiSejakHarga: number;
  /** selesaiSejakHarga >= 3. */
  saatnyaNaik: boolean;
}

/** undefined = jangan diubah. */
export interface ServiceTierInput {
  group?: string;
  slug?: string;
  name?: string;
  summary?: string;
  feeMin?: number;
  feeMax?: number;
  forWhom?: string;
  includesHeading?: string;
  includes?: string[];
  highlighted?: boolean;
  active?: boolean;
  sortOrder?: number;
}

/**
 * Empat jenis, diturunkan dari §5.2 dan §5.3 dokumen strategi. Yang
 * menentukan siapa muncul di halaman Gaji dan siapa dibayar per proyek.
 */
export type MemberKind = "partner" | "inti" | "proyek" | "staf";

export const VALID_MEMBER_KIND: ReadonlySet<string> = new Set([
  "partner", "inti", "proyek", "staf",
]);

export interface TeamMember {
  id: string;
  name: string;
  role?: string | null;
  kind: MemberKind;
  /** Tarif acuan, bukan nominal yang mengikat. Yang dibayar diketik per proyek. */
  rate?: number | null;
  phone?: string | null;
  /** Freelancer yang tidak dipakai lagi disembunyikan, bukan dihapus. */
  active: boolean;
}

export interface TeamMemberInput {
  name?: string;
  role?: string | null;
  kind?: string;
  rate?: number | null;
  phone?: string | null;
  active?: boolean;
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
  /** Kapan tugas dibuat dan terakhir diubah (trigger `touch_updated_at`).
      Riwayat di Lembar Disposisi dan hitungan "selesai 7 hari terakhir". */
  createdAt?: string;
  updatedAt?: string;
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
  /** Ikut terbawa oleh daftar LINTAS proyek, tidak oleh daftar per proyek —
   *  sama persis dengan `ProjectCost.projectTitle` dan `Payment.projectTitle`. */
  projectTitle?: string;
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
  /**
   * Siapa yang dibayar. BOLEH KOSONG: biaya operasional memang bukan milik
   * siapa pun, dan baris lama yang dicatat sebelum kolom ini ada tidak punya
   * nama. Halaman Fee menghitung yang tertaut saja.
   */
  teamMemberId?: string | null;
  teamMemberName?: string | null;
  /** Kalau biaya ini bayaran satu tahap dari penugasan tim — lihat `TeamPayout`. */
  projectTeamId?: string | null;
  payoutStage?: PayoutStage | null;
  /** Ikut dibawa oleh daftar lintas proyek supaya tabelnya tidak perlu join kedua. */
  projectTitle?: string;
}

export interface ProjectCostInput {
  label?: string;
  category?: string;
  amount?: number;
  incurredOn?: string;
  teamMemberId?: string | null;
  /** Dipakai halaman Kas & Biaya: satu pintu, proyeknya dipilih dari dropdown. */
  projectId?: string;
}

/* ── Gaji dan fee ─────────────────────────────────────────────────────────
 *
 * Satu aturan yang membuat keduanya tidak mungkin bentrok: SATU NOMINAL HANYA
 * BOLEH DIKETIK DI SATU TEMPAT. Bayaran yang lahir dari proyek diketik sebagai
 * biaya proyek; gaji bulanan tetap diketik di payroll. Baris fee di halaman
 * Gaji DITURUNKAN dari biaya proyek — tidak pernah diketik ulang di sana.
 */

export interface PayrollEntry {
  id: string;
  teamMemberId: string;
  teamMemberName?: string;
  /** Tanggal 1 bulan yang bersangkutan (YYYY-MM-01). */
  period: string;
  amount: number;
  /** Kosong = belum dibayar. Tidak ada kolom status terpisah yang bisa berselisih. */
  paidOn?: string | null;
  note?: string | null;
}

export interface PayrollInput {
  teamMemberId?: string;
  period?: string;
  amount?: number;
  paidOn?: string | null;
  note?: string | null;
}

/** Satu orang dalam satu bulan: gaji yang diketik + fee yang dijumlahkan. */
export interface PayrollMonthRow {
  teamMemberId: string;
  name: string;
  kind: MemberKind;
  role?: string | null;
  /** Baris gaji bulanan, kalau ada. Inilah yang diketik di halaman Gaji. */
  salaryId?: string | null;
  salaryAmount?: number | null;
  salaryPaidOn?: string | null;
  salaryNote?: string | null;
  /** Dijumlahkan dari biaya proyek bulan itu. Dibaca, bukan ditulis. */
  feeAmount: number;
  feeCount: number;
  total: number;
}

/**
 * Slip satu orang untuk satu bulan — pengganti sheet "GAJI <nama>" di Excel.
 * Isinya diturunkan dari data yang sama dengan halaman Gaji (`bulan()`), jadi
 * total slip dan kolom Total di sana tidak bisa berbeda.
 */
export interface PaySlipFee {
  costId: string;
  projectId: string;
  projectTitle: string;
  label: string;
  amount: number;
  incurredOn: string;
  /** Terisi kalau biaya ini satu tahap bayaran tim (dibayar dari Tim & Bayaran). */
  role: TeamRole | null;
  pct: number | null;
  payoutStage: PayoutStage | null;
}

export interface PaySlip {
  teamMemberId: string;
  name: string;
  kind: MemberKind;
  role: string | null;
  phone: string | null;
  /** 'YYYY-MM-01' */
  period: string;
  salary: { id: string; amount: number; paidOn: string | null; note: string | null } | null;
  fees: PaySlipFee[];
  salaryAmount: number;
  feeAmount: number;
  total: number;
}

/**
 * Satu bulan di riwayat slip — jumlah yang sama dengan `slip()` untuk bulan
 * itu (gaji di `payroll`, fee di `project_costs` atas nama orang itu).
 */
export interface PaySlipMonth {
  /** 'YYYY-MM' */
  period: string;
  salary: number;
  /** null = tidak ada gaji bulan itu; false = ada tapi belum dibayar. */
  salaryPaid: boolean | null;
  fee: number;
  feeCount: number;
  total: number;
}

/**
 * Satu bulan di buku gaji: gaji dan fee SELURUH orang, dengan saringan yang
 * sama dengan `payroll.bulan()` — jadi jumlahnya selalu sama dengan baris
 * Jumlah di daftar bulan itu.
 */
export interface PayrollLedgerMonth {
  /** 'YYYY-MM' */
  period: string;
  salary: number;
  /** Banyaknya baris gaji bulan itu. */
  salaryCount: number;
  /** Baris gaji yang belum bertanggal bayar. */
  salaryUnpaid: number;
  fee: number;
  feeCount: number;
  /** Orang berbeda yang menerima gaji ATAU fee. */
  people: number;
  total: number;
}

/** Satu jilid (tahun) buku gaji. */
export interface PayrollLedgerYear {
  year: number;
  salary: number;
  fee: number;
  total: number;
}

export interface PayrollLedger {
  /** Dua puluh empat bulan: Januari tahun SEBELUMNYA sampai Desember tahun
   *  yang diminta — tahun lalu ikut untuk pembanding periode yang sama. */
  months: PayrollLedgerMonth[];
  /** Setiap tahun yang punya gaji atau fee bernama, terlama lebih dulu. */
  years: PayrollLedgerYear[];
}

/** Fee satu proyek, dipecah per orang. */
export interface FeeProject {
  projectId: string;
  projectTitle: string;
  contractValue: number | null;
  /** Jumlah biaya yang TERTAUT ke orang. */
  feeTotal: number;
  /** Biaya kategori freelancer/prinsipal yang belum punya nama. */
  feeTanpaNama: number;
  /** feeTotal terhadap nilai kontrak, null kalau kontraknya belum diisi. */
  feeShare: number | null;
  orang: { teamMemberId: string; name: string; kind: MemberKind; amount: number }[];
}

/** Rekap satu orang lintas proyek dalam satu rentang tanggal. */
export interface FeePerson {
  teamMemberId: string;
  name: string;
  kind: MemberKind;
  role?: string | null;
  total: number;
  projectCount: number;
  lastOn: string | null;
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
  "coffeeshop",
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
export const VALID_JOURNAL_CATEGORY = new Set(["site", "money", "permit", "build"]);

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

/* ── Tim per peran, bayaran bertahap, kas studio, target ─────────────────
 *
 * Fase 1 dari alur Excel pemilik. Satu aturan lama tetap berlaku: bayaran ke
 * orang hanya tercatat di SATU tempat — project_costs. Penugasan tim menyimpan
 * PERSEN, bukan nominal; nominalnya dihitung dari fee design proyek, dan yang
 * sudah dibayar adalah biaya proyek yang tertaut ke penugasannya. */

export type TeamRole = "leader" | "drafter" | "render" | "estimator";
export const VALID_TEAM_ROLE: ReadonlySet<string> = new Set(["leader", "drafter", "render", "estimator"]);

export type PayoutStage = "awal" | "akhir";
export const VALID_PAYOUT_STAGE: ReadonlySet<string> = new Set(["awal", "akhir"]);

/** Aturan persen studio. `null` = belum ditentukan (bukan nol). */
/** Kop dan dampak halaman Aturan Fee Tim — lihat feeRules.ringkasan(). */
export interface RingkasanAturanFee {
  diubahPada: string;
  diubahOleh: string | null;
  perPeran: Record<TeamRole, { ikutAturan: number; persenTetap: number }>;
  belumLunas: number;
}

export interface FeeRules {
  pctLeader: number | null;
  pctDrafter: number | null;
  pctRender: number | null;
  pctEstimator: number | null;
  /** Jatah bonus tim satu proyek ("FEE BONUS 10%"), sebagai acuan pembanding. */
  poolPct: number;
  /** Bagian hak yang dibayar saat DP klien masuk; sisanya saat desain selesai. */
  firstTranchePct: number;
}

export type FeeRulesInput = Partial<FeeRules>;

/** Keadaan satu tahap bayaran. */
export type TahapKeadaan =
  /** Sudah tercatat sebagai biaya proyek. */
  | "dibayar"
  /** Syaratnya sudah terpenuhi (DP masuk / desain selesai), belum dibayar. */
  | "jatuh_tempo"
  /** Syaratnya belum terpenuhi. */
  | "menunggu"
  /** Persen atau fee design-nya belum ada, jadi nominalnya belum bisa dihitung. */
  | "belum_ditentukan";

export interface TahapBayaran {
  tahap: PayoutStage;
  /** Nominal yang seharusnya; null kalau belum bisa dihitung. */
  nominal: number | null;
  keadaan: TahapKeadaan;
  /** Biaya proyek yang mencatat pembayarannya, kalau sudah dibayar. */
  costId: string | null;
  dibayar: number | null;
  dibayarPada: string | null;
}

export interface ProjectTeamMember {
  id: string;
  projectId: string;
  projectTitle: string;
  teamMemberId: string;
  teamMemberName: string;
  teamMemberKind: MemberKind;
  role: TeamRole;
  /** Persen yang tersimpan di penugasan; null = ikut aturan studio. */
  pct: number | null;
  /** Persen yang benar-benar dipakai menghitung (tersimpan, atau aturan studio). */
  pctBerlaku: number | null;
  note: string | null;
  /** Fee design proyek (nilai kontrak). */
  feeDesign: number | null;
  /** Hak = fee design × persen berlaku. null kalau salah satunya belum ada. */
  hak: number | null;
  dibayar: number;
  /** hak − dibayar; null kalau hak belum bisa dihitung. */
  terutang: number | null;
  tahap: TahapBayaran[];
}

export interface ProjectTeamInput {
  teamMemberId?: string;
  role?: string;
  /** Kosong = ambil dari aturan studio saat ditambahkan. `null` eksplisit = ikut aturan studio selamanya. */
  pct?: number | null;
  note?: string | null;
}

/** Ringkasan per orang: total hak, dibayar, terutang, dan yang sudah jatuh tempo. */
export interface TeamPayoutPerson {
  teamMemberId: string;
  teamMemberName: string;
  teamMemberKind: MemberKind;
  proyek: number;
  hak: number;
  dibayar: number;
  terutang: number;
  jatuhTempo: number;
  /** Penugasan yang persennya belum ditentukan, jadi belum terhitung. */
  belumDitentukan: number;
}

export interface PayoutInput {
  projectTeamId?: string;
  tahap?: string;
  /** Kosong = nominal yang dihitung. Diisi kalau dibulatkan atau disepakati lain. */
  amount?: number | null;
  /** Kosong = hari ini. */
  paidOn?: string | null;
}

export type LedgerDirection = "masuk" | "keluar";
export type LedgerCategory =
  | "penjualan_material" | "bagi_hasil" | "pembelian_material" | "operasional" | "konsumsi" | "lainnya";

/** Kategori yang sah per arus — cermin constraint studio_ledger_kategori_searah. */
export const LEDGER_KATEGORI: Record<LedgerDirection, readonly LedgerCategory[]> = {
  masuk: ["penjualan_material", "bagi_hasil", "lainnya"],
  keluar: ["pembelian_material", "operasional", "konsumsi", "lainnya"],
};

export interface LedgerEntry {
  id: string;
  direction: LedgerDirection;
  category: LedgerCategory;
  label: string;
  counterparty: string | null;
  amount: number;
  occurredOn: string;
  projectId: string | null;
  projectTitle: string | null;
  note: string | null;
}

export interface LedgerInput {
  direction?: string;
  category?: string;
  label?: string;
  counterparty?: string | null;
  amount?: number;
  occurredOn?: string | null;
  projectId?: string | null;
  note?: string | null;
}

export interface RevenueTarget {
  /** 'YYYY-01-01' atau 'YYYY-07-01'. */
  semesterStart: string;
  amount: number;
  note: string | null;
}

export interface RevenueTargetInput {
  semesterStart?: string;
  amount?: number;
  note?: string | null;
}

/** Kemajuan target satu semester. */
export interface TargetProgress {
  semesterStart: string;
  /** Hari terakhir semester (30 Juni / 31 Desember). */
  semesterEnd: string;
  /** null kalau belum pernah ada target sama sekali. */
  target: number | null;
  /** "ditetapkan" = ada baris untuk semester ini; "diteruskan" = memakai target semester sebelumnya. */
  asal: "ditetapkan" | "diteruskan" | null;
  /** Uang masuk dari pembayaran klien di semester ini. */
  pembayaranKlien: number;
  /** Uang masuk dari kas studio (penjualan material, bagi hasil, lainnya). */
  kasLain: number;
  tercapai: number;
  /** target − tercapai, tidak pernah negatif; null kalau tidak ada target. */
  kurang: number | null;
  /** Hari kalender yang tersisa termasuk hari ini; 0 kalau semesternya sudah lewat. */
  sisaHari: number;
  /** Kekurangan dibagi sisa bulan (dibulatkan ke atas); null kalau tidak ada target atau sudah tercapai. */
  perBulanDibutuhkan: number | null;
}

/** KPI dokumen strategi §8 (fase 4, H8). Dihitung, tidak pernah diketik. */
export interface KpiStrategi {
  hariIni: string;
  tahun: number;
  kuartal: number;
  target: {
    rataKontrakMin: number;
    rataKontrakMaks: number;
    marginMin: number;
    leadKuartalMin: number;
    leadKuartalMaks: number;
    signatureMin: number;
    cadanganBulan: number;
  };
  /** Rata-rata nilai kontrak proyek yang dibuat tahun ini. */
  rataKontrak: { nilai: number | null; proyek: number };
  /** Margin kontrak = (kontrak − biaya tercatat) / kontrak, tertimbang. */
  margin: {
    rata: number | null;
    proyek: number;
    dibawah: { projectId: string; title: string; kontrak: number; biaya: number; margin: number }[];
  };
  /** Pesan masuk kuartal ini; `ditindaklanjuti` = berstatus dihubungi/berpotensi. */
  lead: {
    kuartalIni: number;
    ditindaklanjuti: number;
    /** Status SEKARANG pesan-pesan kuartal ini (tidak ada riwayat status). */
    status: { new: number; contacted: number; qualified: number; closed: number };
    /** Bulan-bulan kuartal berjalan yang sudah tiba, termasuk yang kosong. */
    perBulan: { bulan: string; jumlah: number }[];
  };
  /** Proyek tahun ini berpaket urutan 2 ke atas (Signature, Flagship, Standar, Premium). */
  signature: { jumlah: number; proyek: { projectId: string; title: string; tier: string }[] };
  /** Saldo dari catatan panel ÷ rata-rata uang keluar per bulan (enam bulan penuh terakhir). */
  cadangan: {
    saldo: number;
    keluarPerBulan: number | null;
    bulanBerdata: number;
    bulan: number | null;
    /** Uang keluar enam bulan penuh terakhir (yang dibagi), termasuk bulan kosong. */
    bulanan: { bulan: string; keluar: number }[];
  };
  /** Laba kas per kategori proyek, tahun ini. */
  segmen: { kategori: string; proyek: number; diterima: number; biaya: number; laba: number }[];
  /** Proyek berkontrak tahun ini — sumber §8.1, §8.2, dan §8.4. */
  proyek: {
    projectId: string;
    title: string;
    kategori: string;
    tier: string | null;
    signature: boolean;
    kontrak: number;
    biaya: number;
    margin: number;
    dibuat: string;
  }[];
  /** Semua paket aktif + berapa proyek tahun ini memakainya. */
  paket: { nama: string; kelompok: string; urutan: number; jumlah: number }[];
  /** Lima angka yang sama per akhir tiga kuartal sebelumnya, tertua dulu. */
  jejak: KpiJejak[];
}

/** Potret KPI di satu akhir kuartal. */
export interface KpiJejak {
  tanggal: string;
  tahun: number;
  kuartal: number;
  rataKontrak: number | null;
  margin: number | null;
  lead: number;
  signature: number;
  cadangan: number | null;
}
