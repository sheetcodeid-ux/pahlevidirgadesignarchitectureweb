import type { Sql } from "postgres";

/* =============================================================================
   Akun staf yang sedang masuk — untuk halaman Akun.

   Nama disimpan di `profiles.full_name`, kolom yang sudah ada sejak skema
   pertama tapi tidak pernah diisi dari panel: kartu akun di rel menurunkan
   namanya dari bagian depan email ("d@…" → "D").

   Sesi dibaca dari `auth.sessions` milik Supabase. Hanya DIBACA — mencabut
   sesi lewat GoTrue (`cabutSesi`), bukan dengan menghapus baris di skema
   auth, yang bukan milik aplikasi ini.
   ============================================================================= */

export interface ProfilStaf {
  role: string;
  nama: string | null;
  /** Kunci R2 foto pribadi (`akun/…`); rute mengubahnya jadi URL. */
  avatarKey: string | null;
}

export interface InfoAkun extends ProfilStaf {
  stafSejak: string;
  terakhirMasuk: string | null;
}

export interface SesiAkun {
  id: string;
  dibuat: string;
  terakhirAktif: string;
  userAgent: string | null;
}

/** URL publik foto akun (domain media R2), atau null. */
export function urlFoto(assetBase: string, kunci: string | null): string | null {
  if (!kunci) return null;
  return `${assetBase.replace(/\/$/, "")}/${kunci}`;
}

/** Peran + nama, untuk /me dan masuk. Kosong = bukan staf. */
export async function profil(sql: Sql, userID: string): Promise<ProfilStaf | null> {
  const rows = await sql<{ role: string; full_name: string | null; avatar_key: string | null }[]>`
    select role, full_name, avatar_key from public.profiles where id = ${userID}::uuid`;
  const r = rows[0];
  return r ? { role: r.role, nama: r.full_name, avatarKey: r.avatar_key } : null;
}

export async function info(sql: Sql, userID: string): Promise<InfoAkun | null> {
  const rows = await sql<{
    role: string; full_name: string | null; avatar_key: string | null; staf_sejak: Date; terakhir_masuk: Date | null;
  }[]>`
    select p.role, p.full_name, p.avatar_key, p.created_at as staf_sejak, u.last_sign_in_at as terakhir_masuk
    from public.profiles p
    left join auth.users u on u.id = p.id
    where p.id = ${userID}::uuid`;
  const r = rows[0];
  if (!r) return null;
  return {
    role: r.role,
    nama: r.full_name,
    avatarKey: r.avatar_key,
    stafSejak: new Date(r.staf_sejak).toISOString(),
    terakhirMasuk: r.terakhir_masuk ? new Date(r.terakhir_masuk).toISOString() : null,
  };
}

/** Nama tampilan. Kosong menghapusnya (kembali ke turunan email). */
export function rapikanNama(nama: unknown): string | null {
  if (nama === null || nama === undefined) return null;
  if (typeof nama !== "string") throw new Error("nama harus teks");
  const bersih = nama.replace(/\s+/g, " ").trim();
  if (bersih.length > 60) throw new Error("nama maksimal 60 karakter");
  return bersih || null;
}

export async function ubahNama(sql: Sql, userID: string, nama: string | null): Promise<void> {
  await sql`update public.profiles set full_name = ${nama} where id = ${userID}::uuid`;
}

/** Kunci foto dari panel: null = hapus foto, selain itu WAJIB di folder
 *  `akun/` — aturan yang sama dengan CHECK di migrasi 20261006000030, diulang
 *  di sini supaya galatnya terbaca, bukan pelanggaran constraint mentah. */
export function rapikanKunciFoto(kunci: unknown): string | null {
  if (kunci === null) return null;
  if (typeof kunci !== "string" || !/^akun\/[A-Za-z0-9._-]+$/.test(kunci)) {
    throw new Error("kunci foto harus berkas di folder akun/");
  }
  return kunci;
}

export async function ubahFoto(sql: Sql, userID: string, kunci: string | null): Promise<void> {
  await sql`update public.profiles set avatar_key = ${kunci} where id = ${userID}::uuid`;
}

export interface RingkasSesi {
  /** Semua sesi hidup akun ini, termasuk yang sedang dipakai. */
  jumlah: number;
  aktif24j: number;
  /** Sesi yang sedang dipakai pemanggil — null kalau token lama tanpa session_id. */
  ini: SesiAkun | null;
  /** Sesi LAIN yang agennya peramban, paling baru aktif lebih dulu. */
  lain: SesiAkun[];
  /** Sesi lain yang tidak bisa dinamai: tercatat sebelum login meneruskan
   *  agen peramban ("quic-go HTTP/3", kosong). Dirangkum, bukan dideretkan. */
  tanpaNama: number;
  tanpaNamaTerakhir: string | null;
}

/* `refreshed_at` di GoTrue bertipe `timestamp` TANPA zona (UTC), sementara
   dua kolom lainnya `timestamptz` — jadi ia dibaca eksplisit sebagai UTC
   sebelum di-coalesce, bukan diserahkan ke zona waktu sesi koneksi. */
const AKTIF = "coalesce(refreshed_at at time zone 'UTC', updated_at, created_at)";

type BarisSesi = { id: string; dibuat: Date; aktif: Date; user_agent: string | null };
const keSesi = (r: BarisSesi): SesiAkun => ({
  id: r.id,
  dibuat: new Date(r.dibuat).toISOString(),
  terakhirAktif: new Date(r.aktif).toISOString(),
  userAgent: r.user_agent || null,
});

export async function sesi(sql: Sql, userID: string, sesiIni: string | null, batas = 4): Promise<RingkasSesi> {
  const aktif = sql.unsafe(AKTIF);
  const [h] = await sql<{ jumlah: number; aktif24j: number; tanpa_nama: number; tanpa_nama_terakhir: Date | null }[]>`
    select count(*)::int as jumlah,
           count(*) filter (where ${aktif} > now() - interval '1 day')::int as aktif24j,
           count(*) filter (
             where id is distinct from ${sesiIni}::uuid and coalesce(user_agent, '') not like 'Mozilla/%'
           )::int as tanpa_nama,
           max(${aktif}) filter (
             where id is distinct from ${sesiIni}::uuid and coalesce(user_agent, '') not like 'Mozilla/%'
           ) as tanpa_nama_terakhir
    from auth.sessions where user_id = ${userID}::uuid`;
  const ini = sesiIni
    ? await sql<BarisSesi[]>`
        select id, created_at as dibuat, ${aktif} as aktif, user_agent
        from auth.sessions where user_id = ${userID}::uuid and id = ${sesiIni}::uuid`
    : [];
  const lain = await sql<BarisSesi[]>`
    select id, created_at as dibuat, ${aktif} as aktif, user_agent
    from auth.sessions
    where user_id = ${userID}::uuid
      and id is distinct from ${sesiIni}::uuid
      and user_agent like 'Mozilla/%'
    order by aktif desc
    limit ${batas}`;
  return {
    jumlah: h?.jumlah ?? 0,
    aktif24j: h?.aktif24j ?? 0,
    ini: ini[0] ? keSesi(ini[0]) : null,
    lain: lain.map(keSesi),
    tanpaNama: h?.tanpa_nama ?? 0,
    tanpaNamaTerakhir: h?.tanpa_nama_terakhir ? new Date(h.tanpa_nama_terakhir).toISOString() : null,
  };
}
