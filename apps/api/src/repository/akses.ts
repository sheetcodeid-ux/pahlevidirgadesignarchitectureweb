import type { Sql } from "postgres";
import { adalahFiturPaket } from "../lib/fitur";

/* =============================================================================
   Pengguna, paket langganan, dan buku log audit (migrasi 20261021000032).
   Tabelnya hanya disentuh Worker — tidak ada policy RLS untuk siapa pun.
   ============================================================================= */

const tanggal = (d: Date | string | null): string | null =>
  d === null ? null : typeof d === "string" ? d.slice(0, 10) : new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
const iso = (d: Date | string | null): string | null => (d === null ? null : new Date(d).toISOString());

/* --- Akses satu akun --------------------------------------------------------- */

export interface BarisAkses {
  role: string;
  nama: string | null;
  avatarKey: string | null;
  isSuspended: boolean;
  accessUntil: string | null;
  planId: string | null;
  planName: string | null;
  fiturPaket: string[];
}

/** Satu kueri untuk setiap permintaan panel: peran, langganan, dan fitur paketnya. */
export async function muatAkses(sql: Sql, userID: string): Promise<BarisAkses | null> {
  const rows = await sql<{
    role: string; full_name: string | null; avatar_key: string | null; is_suspended: boolean;
    access_until: Date | string | null; plan_id: string | null; plan_name: string | null; fitur: string[] | null;
  }[]>`
    select p.role, p.full_name, p.avatar_key, p.is_suspended, p.access_until, p.plan_id,
           ap.name as plan_name,
           -- jsonb, bukan array_agg: koneksi Hyperdrive (fetch_types: false) tidak
           -- mengurai array Postgres — yang datang teks "{a,b}" (saudara jebakan #16).
           coalesce((select jsonb_agg(f.feature order by f.feature) from public.plan_features f
                     where f.plan_id = p.plan_id and ap.is_active), '[]'::jsonb) as fitur
    from public.profiles p
    left join public.access_plans ap on ap.id = p.plan_id
    where p.id = ${userID}::uuid`;
  const r = rows[0];
  if (!r) return null;
  return {
    role: r.role, nama: r.full_name, avatarKey: r.avatar_key, isSuspended: r.is_suspended,
    accessUntil: tanggal(r.access_until), planId: r.plan_id, planName: r.plan_name, fiturPaket: r.fitur ?? [],
  };
}

/* --- Pengguna ---------------------------------------------------------------- */

export interface Pengguna {
  id: string;
  email: string | null;
  nama: string | null;
  role: string;
  planId: string | null;
  planName: string | null;
  accessUntil: string | null;
  isSuspended: boolean;
  dibuat: string;
  terakhirMasuk: string | null;
  /** Jumlah perubahan yang tercatat 30 hari terakhir — dasar kolom "aktif". */
  perubahan30: number;
}

export async function daftarPengguna(sql: Sql): Promise<Pengguna[]> {
  const rows = await sql<{
    id: string; email: string | null; full_name: string | null; role: string; plan_id: string | null; plan_name: string | null;
    access_until: Date | string | null; is_suspended: boolean; created_at: Date; last_sign_in_at: Date | null; perubahan30: number;
  }[]>`
    select p.id, u.email, p.full_name, p.role, p.plan_id, ap.name as plan_name, p.access_until, p.is_suspended,
           p.created_at, u.last_sign_in_at,
           (select count(*)::int from public.audit_log a
             where a.actor_id = p.id and a.at > now() - interval '30 days'
               and a.action in ('buat', 'ubah', 'hapus')) as perubahan30
    from public.profiles p
    left join auth.users u on u.id = p.id
    left join public.access_plans ap on ap.id = p.plan_id
    order by case p.role when 'admin' then 0 when 'editor' then 1 else 2 end, p.created_at`;
  return rows.map((r) => ({
    id: r.id, email: r.email, nama: r.full_name, role: r.role, planId: r.plan_id, planName: r.plan_name,
    accessUntil: tanggal(r.access_until), isSuspended: r.is_suspended, dibuat: iso(r.created_at)!,
    terakhirMasuk: iso(r.last_sign_in_at), perubahan30: r.perubahan30,
  }));
}

export interface PenggunaPatch {
  nama?: string | null;
  role?: "admin" | "editor" | "pelanggan";
  planId?: string | null;
  accessUntil?: string | null;
  isSuspended?: boolean;
}

export async function buatProfil(sql: Sql, id: string, p: PenggunaPatch): Promise<void> {
  await sql`
    insert into public.profiles (id, full_name, role, plan_id, access_until)
    values (${id}::uuid, ${p.nama ?? null}, ${p.role ?? "pelanggan"}, ${p.planId ?? null}, ${p.accessUntil ?? null})`;
}

/** Hanya kolom yang dikirim yang ditulis. */
export async function ubahPengguna(sql: Sql, id: string, p: PenggunaPatch): Promise<boolean> {
  const kolom: Record<string, unknown> = {};
  if ("nama" in p) kolom.full_name = p.nama ?? null;
  if (p.role !== undefined) kolom.role = p.role;
  if ("planId" in p) kolom.plan_id = p.planId ?? null;
  if ("accessUntil" in p) kolom.access_until = p.accessUntil ?? null;
  if (p.isSuspended !== undefined) kolom.is_suspended = p.isSuspended;
  if (!Object.keys(kolom).length) return true;
  kolom.updated_at = new Date();
  const res = await sql`update public.profiles set ${sql(kolom)} where id = ${id}::uuid`;
  return res.count > 0;
}

/** Owner aktif yang tersisa SELAIN akun ini — owner terakhir tidak boleh turun peran atau dinonaktifkan. */
export async function ownerLain(sql: Sql, kecuali: string): Promise<number> {
  const rows = await sql<{ n: number }[]>`
    select count(*)::int as n from public.profiles
    where role = 'admin' and not is_suspended and id <> ${kecuali}::uuid`;
  return rows[0]?.n ?? 0;
}

/** Sesi akun yang dinonaktifkan langsung dicabut; token akses yang tersisa ditolak penjagaan per permintaan. */
export async function cabutSemuaSesi(sql: Sql, id: string): Promise<void> {
  await sql`delete from auth.sessions where user_id = ${id}::uuid`;
}

/* --- Paket langganan ---------------------------------------------------------- */

export interface PaketAkses {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  priceMonth: number | null;
  sortOrder: number;
  isActive: boolean;
  fitur: string[];
  pengguna: number;
}

export async function daftarPaketAkses(sql: Sql): Promise<PaketAkses[]> {
  const rows = await sql<{
    id: string; slug: string; name: string; description: string | null; price_month: number | null;
    sort_order: number; is_active: boolean; fitur: string[] | null; pengguna: number;
  }[]>`
    select ap.*, coalesce((select jsonb_agg(f.feature order by f.feature) from public.plan_features f where f.plan_id = ap.id), '[]'::jsonb) as fitur,
           (select count(*)::int from public.profiles p where p.plan_id = ap.id and p.role = 'pelanggan') as pengguna
    from public.access_plans ap
    order by ap.sort_order, ap.created_at`;
  return rows.map((r) => ({
    id: r.id, slug: r.slug, name: r.name, description: r.description, priceMonth: r.price_month,
    sortOrder: r.sort_order, isActive: r.is_active, fitur: r.fitur ?? [], pengguna: r.pengguna,
  }));
}

export interface PaketAksesInput {
  name?: string;
  description?: string | null;
  priceMonth?: number | null;
  isActive?: boolean;
}

export async function buatPaketAkses(sql: Sql, p: PaketAksesInput & { name: string }): Promise<string> {
  const dasar = p.name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 32) || "paket";
  const rows = await sql<{ id: string }[]>`
    insert into public.access_plans (slug, name, description, price_month, sort_order)
    values (
      ${dasar} || case when exists (select 1 from public.access_plans where slug = ${dasar})
                       then '-' || substr(md5(random()::text), 1, 4) else '' end,
      ${p.name.trim()}, ${p.description ?? null}, ${p.priceMonth ?? null},
      (select coalesce(max(sort_order), 0) + 1 from public.access_plans))
    returning id`;
  return rows[0]!.id;
}

export async function ubahPaketAkses(sql: Sql, id: string, p: PaketAksesInput): Promise<boolean> {
  const kolom: Record<string, unknown> = {};
  if (p.name !== undefined) kolom.name = p.name.trim();
  if ("description" in p) kolom.description = p.description ?? null;
  if ("priceMonth" in p) kolom.price_month = p.priceMonth ?? null;
  if (p.isActive !== undefined) kolom.is_active = p.isActive;
  if (!Object.keys(kolom).length) return true;
  const res = await sql`update public.access_plans set ${sql(kolom)} where id = ${id}::uuid`;
  return res.count > 0;
}

/** Paket yang masih dipakai pelanggan tidak bisa dihapus — dinonaktifkan saja. */
export async function hapusPaketAkses(sql: Sql, id: string): Promise<"terhapus" | "dipakai" | "tidak-ada"> {
  const dipakai = await sql<{ n: number }[]>`select count(*)::int as n from public.profiles where plan_id = ${id}::uuid`;
  if ((dipakai[0]?.n ?? 0) > 0) return "dipakai";
  const res = await sql`delete from public.access_plans where id = ${id}::uuid`;
  return res.count > 0 ? "terhapus" : "tidak-ada";
}

export async function aturFitur(sql: Sql, planId: string, fitur: string, nyala: boolean): Promise<void> {
  if (!adalahFiturPaket(fitur)) throw new Error("fitur tidak dikenal");
  if (nyala) {
    await sql`insert into public.plan_features (plan_id, feature) values (${planId}::uuid, ${fitur}) on conflict do nothing`;
  } else {
    await sql`delete from public.plan_features where plan_id = ${planId}::uuid and feature = ${fitur}`;
  }
}

/* --- Buku log audit ------------------------------------------------------------ */

export interface EntriAudit {
  actorId?: string | null;
  actorEmail?: string | null;
  actorRole?: string | null;
  action: "masuk" | "gagal_masuk" | "keluar" | "buat" | "ubah" | "hapus" | "ditolak";
  method?: string | null;
  path?: string | null;
  entity?: string | null;
  entityId?: string | null;
  status?: number | null;
  detail?: unknown;
  ipHash?: string | null;
  userAgent?: string | null;
}

export async function catatAudit(sql: Sql, e: EntriAudit): Promise<void> {
  await sql`
    insert into public.audit_log
      (actor_id, actor_email, actor_role, action, method, path, entity, entity_id, status, detail, ip_hash, user_agent)
    values (${e.actorId ?? null}, ${e.actorEmail ?? null}, ${e.actorRole ?? null}, ${e.action}, ${e.method ?? null},
            ${e.path ?? null}, ${e.entity ?? null}, ${e.entityId ?? null}, ${e.status ?? null},
            ${e.detail === undefined ? null : sql.json(e.detail as never)}, ${e.ipHash || null}, ${e.userAgent?.slice(0, 300) ?? null})`;
}

export interface BarisAudit {
  id: number;
  at: string;
  actorId: string | null;
  actorEmail: string | null;
  actorRole: string | null;
  actorNama: string | null;
  action: string;
  method: string | null;
  path: string | null;
  entity: string | null;
  entityId: string | null;
  status: number | null;
  detail: unknown;
}

export async function daftarAudit(
  sql: Sql,
  q: { sebelum?: number; batas?: number; aktor?: string; aksi?: string },
): Promise<BarisAudit[]> {
  const batas = Math.min(Math.max(q.batas ?? 60, 1), 200);
  const rows = await sql<{
    id: string; at: Date; actor_id: string | null; actor_email: string | null; actor_role: string | null; actor_nama: string | null;
    action: string; method: string | null; path: string | null; entity: string | null; entity_id: string | null;
    status: number | null; detail: unknown;
  }[]>`
    select a.id, a.at, a.actor_id, a.actor_email, a.actor_role, p.full_name as actor_nama, a.action, a.method, a.path,
           a.entity, a.entity_id, a.status, a.detail
    from public.audit_log a
    left join public.profiles p on p.id = a.actor_id
    where true
      ${q.sebelum ? sql`and a.id < ${q.sebelum}` : sql``}
      ${q.aktor ? sql`and a.actor_id = ${q.aktor}::uuid` : sql``}
      ${q.aksi ? sql`and a.action = ${q.aksi}` : sql``}
    order by a.id desc
    limit ${batas}`;
  return rows.map((r) => ({
    id: Number(r.id), at: iso(r.at)!, actorId: r.actor_id, actorEmail: r.actor_email, actorRole: r.actor_role,
    actorNama: r.actor_nama, action: r.action, method: r.method, path: r.path, entity: r.entity, entityId: r.entity_id,
    status: r.status, detail: r.detail,
  }));
}

/* Tabel di balik tiap kelompok rute — dipakai untuk memotret baris SEBELUM
   dan SESUDAH diubah. Rute yang tidak terdaftar tetap tercatat, hanya tanpa
   potret (cukup isi kirimannya). */
export const TABEL_RUTE: Record<string, string> = {
  projects: "projects",
  invoices: "invoices",
  costs: "project_costs",
  tasks: "project_tasks",
  directory: "directory_contacts",
  team: "team_members",
  testimonials: "testimonials",
  ledger: "studio_ledger",
  payroll: "payroll",
  "project-team": "project_team",
  inquiries: "inquiries",
  documents: "project_documents",
  "access-plans": "access_plans",
  users: "profiles",
};

/** Satu baris sebagai JSON. Nama tabel hanya dari TABEL_RUTE di atas, tidak pernah dari masukan. */
export async function potretBaris(sql: Sql, tabel: string, id: string): Promise<unknown> {
  if (!Object.values(TABEL_RUTE).includes(tabel)) return null;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const rows = await sql<{ j: unknown }[]>`select to_jsonb(t) as j from ${sql("public." + tabel)} t where t.id = ${id}::uuid`;
  return rows[0]?.j ?? null;
}
