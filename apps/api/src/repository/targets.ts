import type { Sql } from "postgres";
import type { RevenueTarget, RevenueTargetInput, TargetProgress } from "../types";
import { NotFoundError } from "./projects";

/**
 * Target pemasukan per semester — "TARGET 1 MILIAR DALAM 6 BULAN".
 *
 * Pemilik: "6 bulan itu per semester, target 1 M itu pemasukan", dan
 * penjualan PVC ikut dihitung. Jadi yang dibandingkan dengan target adalah
 * SELURUH uang yang masuk — pembayaran klien ditambah kas studio arah masuk —
 * bukan laba seperti rumus "KURANG = TARGET − PROFIT" di Excel.
 *
 * Pembayaran klien dibaca dari project_payments (uang yang benar-benar
 * diterima, per tanggal terimanya), bukan dari invoice lunas: DP 50% yang
 * sudah di rekening adalah pemasukan walau tagihannya belum lunas.
 */

function sahSemester(v: string | null | undefined): string {
  const t = (v ?? "").trim();
  if (!/^\d{4}-(01|07)-01$/.test(t)) throw new Error("semester harus dimulai 1 Januari atau 1 Juli (YYYY-01-01 / YYYY-07-01)");
  return t;
}

export async function list(sql: Sql): Promise<RevenueTarget[]> {
  const rows = await sql<{ semester_start: string; amount: string; note: string | null }[]>`
    select semester_start::text, amount, note from public.revenue_targets order by semester_start desc`;
  return rows.map((r) => ({ semesterStart: r.semester_start, amount: Number(r.amount), note: r.note }));
}

/** Menetapkan (atau mengganti) target satu semester. */
export async function simpan(sql: Sql, input: RevenueTargetInput): Promise<void> {
  const semester = sahSemester(input.semesterStart);
  if (!input.amount || !(input.amount > 0)) throw new Error("target harus lebih dari nol");
  const note = (input.note ?? "").trim() || null;
  if (note && note.length > 200) throw new Error("catatan paling panjang 200 karakter");
  await sql`
    insert into public.revenue_targets (semester_start, amount, note)
    values (${semester}::date, ${input.amount}, ${note})
    on conflict (semester_start) do update set amount = excluded.amount, note = excluded.note`;
}

export async function remove(sql: Sql, semesterStart: string): Promise<void> {
  const result = await sql`delete from public.revenue_targets where semester_start = ${sahSemester(semesterStart)}::date`;
  if (result.count === 0) throw new NotFoundError();
}

interface Row {
  hari_ini: string;
  mulai: string;
  akhir: string;
  target_sendiri: string | null;
  target_lama: string | null;
  pembayaran_klien: string;
  kas_lain: string;
}

/**
 * Kemajuan satu semester. Tanpa argumen: semester yang sedang berjalan
 * menurut zona waktu studio (bukan UTC — 1 Juli pukul 03.00 WIB masih 30 Juni
 * di UTC, dan pembayaran pagi itu akan jatuh ke semester yang salah).
 */
export async function kemajuan(sql: Sql, semesterStart?: string | null): Promise<TargetProgress> {
  const diminta = semesterStart ? sahSemester(semesterStart) : null;

  const [r] = await sql<Row[]>`
    with zona as (
      select coalesce((select timezone from public.studio_settings where id), 'Asia/Jakarta') as tz
    ), hari as (
      select (now() at time zone (select tz from zona))::date as hari_ini
    ), sem as (
      select h.hari_ini,
             coalesce(${diminta}::date,
                      make_date(extract(year from h.hari_ini)::int,
                                case when extract(month from h.hari_ini) <= 6 then 1 else 7 end, 1)) as mulai
        from hari h
    )
    select s.hari_ini::text,
           s.mulai::text,
           ((s.mulai + interval '6 months')::date - 1)::text as akhir,
           (select amount from public.revenue_targets where semester_start = s.mulai) as target_sendiri,
           (select amount from public.revenue_targets where semester_start < s.mulai
             order by semester_start desc limit 1) as target_lama,
           coalesce((select sum(pp.amount) from public.project_payments pp
                      where (pp.paid_at at time zone (select tz from zona))::date
                            between s.mulai and (s.mulai + interval '6 months')::date - 1), 0) as pembayaran_klien,
           coalesce((select sum(k.amount) from public.studio_ledger k
                      where k.direction = 'masuk'
                        and k.occurred_on between s.mulai and (s.mulai + interval '6 months')::date - 1), 0) as kas_lain
      from sem s`;

  const target = r.target_sendiri !== null ? Number(r.target_sendiri) : r.target_lama !== null ? Number(r.target_lama) : null;
  const pembayaranKlien = Number(r.pembayaran_klien);
  const kasLain = Number(r.kas_lain);
  const tercapai = pembayaranKlien + kasLain;
  const kurang = target === null ? null : Math.max(target - tercapai, 0);

  // Sisa hari dan bulan dihitung dari tanggal kalender studio, bukan dari Date
  // milik Worker yang berjalan dalam UTC.
  const hariIni = r.hari_ini;
  let sisaHari = 0;
  let sisaBulan = 0;
  if (hariIni > r.akhir) {
    sisaHari = 0;
  } else {
    const dari = hariIni < r.mulai ? r.mulai : hariIni;
    sisaHari = Math.round((Date.parse(`${r.akhir}T00:00:00Z`) - Date.parse(`${dari}T00:00:00Z`)) / 86_400_000) + 1;
    sisaBulan = Number(r.akhir.slice(5, 7)) - Number(dari.slice(5, 7)) + 1;
  }

  return {
    semesterStart: r.mulai,
    semesterEnd: r.akhir,
    target,
    asal: r.target_sendiri !== null ? "ditetapkan" : r.target_lama !== null ? "diteruskan" : null,
    pembayaranKlien,
    kasLain,
    tercapai,
    kurang,
    sisaHari,
    perBulanDibutuhkan: kurang && sisaBulan > 0 ? Math.ceil(kurang / sisaBulan) : null,
  };
}
