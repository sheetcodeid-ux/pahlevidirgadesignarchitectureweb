import type { Sql } from "postgres";
import type { BebanKategori, FinanceMonthRow, FinanceOverview, FinanceOverviewRow } from "../types";

interface ProjectRow {
  project_id: string;
  project_title: string;
  contract_value: string | null;
  received: string;
  costs_total: string;
}

/**
 * Ringkasan keuangan lintas proyek.
 *
 * Dua angka yang sengaja hidup berdampingan, karena keduanya menjawab
 * pertanyaan berbeda:
 *
 * - **Margin** proyeksi: (kontrak - biaya) / kontrak. Ini JANJI — berapa untung
 *   proyek ini kalau seluruh kontraknya benar-benar dibayar.
 * - **Laba bersih** kenyataan kas: diterima - biaya. Keputusan pemilik, dengan
 *   alasannya sendiri: "uang belum diterima dengan full". Proyek yang baru DP
 *   50% akan tampak minus di sini kalau biayanya sudah keluar duluan, dan itu
 *   memang keadaan kasnya — bukan salah hitung.
 *
 * "Diterima" hanya menghitung invoice berstatus lunas; draft dan terbit belum
 * pernah jadi uang.
 *
 * @param projectID kalau diisi, seluruh angka hanya mencakup proyek itu.
 */
export async function overview(sql: Sql, projectID?: string | null): Promise<FinanceOverview> {
  // Satu query dengan filter opsional, bukan dua query bercabang: cabang yang
  // dipakai jarang adalah cabang yang paling mudah hanyut berbeda.
  const rows = await sql<ProjectRow[]>`
    select
      p.id as project_id,
      p.title as project_title,
      p.contract_value,
      coalesce((
        select sum(i.amount) from public.invoices i
        where i.project_id = p.id and i.status = 'lunas'
      ), 0) as received,
      coalesce((
        select sum(c.amount) from public.project_costs c
        where c.project_id = p.id
      ), 0) as costs_total
    from public.projects p
    where p.contract_value is not null
      and (${projectID ?? null}::uuid is null or p.id = ${projectID ?? null}::uuid)
    order by p.created_at desc`;

  // Piutang ikut disaring: kalau satu proyek dipilih, angka di kartunya harus
  // membicarakan proyek itu juga — bukan piutang seluruh studio.
  const piutangRows = await sql<{ total: string }[]>`
    select coalesce(sum(amount), 0) as total
    from public.invoices
    where status = 'terbit'
      and (${projectID ?? null}::uuid is null or project_id = ${projectID ?? null}::uuid)`;

  const proyek: FinanceOverviewRow[] = rows.map((r) => {
    const kontrak = r.contract_value === null ? null : Number(r.contract_value);
    const biaya = Number(r.costs_total);
    const diterima = Number(r.received);
    return {
      projectId: r.project_id,
      projectTitle: r.project_title,
      contractValue: kontrak,
      received: diterima,
      costsTotal: biaya,
      marginPct: kontrak && kontrak > 0 ? ((kontrak - biaya) / kontrak) * 100 : null,
      labaBersih: diterima - biaya,
      belumDiterima: kontrak === null ? null : kontrak - diterima,
    };
  });

  // Biaya dipecah per kategori, untuk donat Rincian Beban. Query terpisah,
  // bukan diturunkan dari `proyek` di atas, karena baris di sana sudah
  // terlanjur dijumlahkan per proyek dan kategorinya hilang di situ.
  const kategoriRows = await sql<{ kategori: string; total: string }[]>`
    select c.category as kategori, coalesce(sum(c.amount), 0) as total
    from public.project_costs c
    join public.projects p on p.id = c.project_id
    where p.contract_value is not null
      and (${projectID ?? null}::uuid is null or c.project_id = ${projectID ?? null}::uuid)
    group by c.category`;

  // Keempat kategori selalu ikut, termasuk yang nol — lihat catatan di
  // FinanceOverview.bebanKategori.
  const urutan = ["freelancer", "operasional", "prinsipal", "lainnya"] as const;
  const peta = new Map(kategoriRows.map((r) => [r.kategori, Number(r.total)]));
  const bebanKategori: BebanKategori[] = urutan.map((k) => ({ kategori: k, nilai: peta.get(k) ?? 0 }));

  const kasMasuk = proyek.reduce((sum, p) => sum + p.received, 0);
  const totalKontrak = proyek.reduce((sum, p) => sum + (p.contractValue ?? 0), 0);
  const totalBiaya = proyek.reduce((sum, p) => sum + p.costsTotal, 0);

  return {
    kasMasuk,
    piutang: Number(piutangRows[0]?.total ?? 0),
    marginRataRata: totalKontrak > 0 ? ((totalKontrak - totalBiaya) / totalKontrak) * 100 : null,
    labaBersih: kasMasuk - totalBiaya,
    totalBiaya,
    totalKontrak,
    proyek,
    bebanKategori,
  };
}

interface MonthRow {
  bulan: string;
  kas_masuk: string;
  biaya: string;
  proyek_aktif: string;
}

/**
 * Kas masuk, biaya, dan laba bersih per bulan.
 *
 * Tanggalnya diambil dari kejadiannya, bukan dari kapan barisnya diketik:
 * invoices.paid_at untuk kas masuk, project_costs.incurred_on untuk biaya.
 * Kalau memakai created_at, satu sore mengetik nota tiga bulan ke belakang
 * akan menumpuk semuanya ke bulan ini dan grafiknya berbohong.
 *
 * Bulan tanpa kas masuk MAUPUN biaya tidak muncul sebagai baris kosong — ia
 * memang tidak ada datanya, dan garis nol yang dikarang lebih menyesatkan
 * daripada jeda. Yang mengisi jeda itu tugas grafiknya, bukan query ini.
 *
 * @param bulanTerakhir berapa bulan ke belakang yang disapu.
 */
export async function monthly(
  sql: Sql,
  projectID?: string | null,
  bulanTerakhir = 12,
): Promise<FinanceMonthRow[]> {
  const batas = Math.min(Math.max(Math.trunc(bulanTerakhir) || 12, 1), 60);

  const rows = await sql<MonthRow[]>`
    with kas as (
      select
        to_char(i.paid_at, 'YYYY-MM') as bulan,
        i.project_id,
        i.amount as masuk,
        0::numeric as keluar
      from public.invoices i
      where i.status = 'lunas'
        and i.paid_at is not null
        and i.paid_at >= date_trunc('month', current_date) - make_interval(months => ${batas - 1})
        and (${projectID ?? null}::uuid is null or i.project_id = ${projectID ?? null}::uuid)
      union all
      select
        to_char(c.incurred_on, 'YYYY-MM') as bulan,
        c.project_id,
        0::numeric as masuk,
        c.amount as keluar
      from public.project_costs c
      where c.incurred_on >= date_trunc('month', current_date)::date - make_interval(months => ${batas - 1})
        and (${projectID ?? null}::uuid is null or c.project_id = ${projectID ?? null}::uuid)
    )
    select
      bulan,
      coalesce(sum(masuk), 0) as kas_masuk,
      coalesce(sum(keluar), 0) as biaya,
      count(distinct project_id) as proyek_aktif
    from kas
    group by bulan
    order by bulan`;

  return rows.map((r) => {
    const kasMasuk = Number(r.kas_masuk);
    const biaya = Number(r.biaya);
    return {
      bulan: r.bulan,
      kasMasuk,
      biaya,
      labaBersih: kasMasuk - biaya,
      proyekAktif: Number(r.proyek_aktif),
    };
  });
}
