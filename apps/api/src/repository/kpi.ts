import type { Sql } from "postgres";
import type { KpiStrategi } from "../types";

/**
 * KPI dokumen strategi (§8) — fase 4 (H8). Semua angka dihitung di sini dari
 * tabel yang sama dengan halaman lain; tidak ada angka yang diketik.
 *
 * Targetnya KONSTANTA, bukan isian: angka-angka ini keputusan strategi yang
 * berubah setahun sekali paling sering, dan membuatnya bisa disunting berarti
 * satu tabel, satu halaman pengaturan, dan satu assertion RLS lagi untuk lima
 * angka. Kalau pemilik mengubah strateginya, ubah di sini.
 */
export const TARGET_KPI = {
  rataKontrakMin: 50_000_000,
  rataKontrakMaks: 70_000_000,
  marginMin: 35,
  leadKuartalMin: 10,
  leadKuartalMaks: 15,
  signatureMin: 3,
  cadanganBulan: 6,
} as const;

interface Ringkas {
  hari_ini: string;
  rata_kontrak: string | null;
  proyek_berkontrak: string;
  lead_kuartal: string;
  lead_lanjut: string;
  saldo: string;
  keluar_6bulan: string;
  bulan_berdata: string;
}

interface Margin {
  id: string;
  title: string;
  kontrak: string;
  biaya: string;
}

interface Segmen {
  kategori: string;
  proyek: string;
  diterima: string;
  biaya: string;
}

interface Signature {
  id: string;
  title: string;
  tier: string;
}

/**
 * `tahun` = tahun kalender studio (zona waktu dari studio_settings, sama
 * dengan target semester). Proyek dihitung menurut tanggal DIBUAT di tahun
 * itu; uang menurut tanggal terjadinya.
 */
export async function hitung(sql: Sql): Promise<KpiStrategi> {
  const zona = sql`coalesce((select timezone from public.studio_settings where id), 'Asia/Jakarta')`;
  const hariIni = sql`(now() at time zone ${zona})::date`;
  const awalTahun = sql`date_trunc('year', ${hariIni})::date`;
  const awalKuartal = sql`date_trunc('quarter', ${hariIni})::date`;
  // Enam bulan PENUH terakhir, tanpa bulan berjalan: bulan yang baru berjalan
  // empat hari akan menarik rata-ratanya turun.
  const awal6 = sql`(date_trunc('month', ${hariIni}) - interval '6 months')::date`;
  const akhir6 = sql`date_trunc('month', ${hariIni})::date`;
  const proyekTahunIni = sql`p.status <> 'archived' and (p.created_at at time zone ${zona})::date >= ${awalTahun}`;

  const [[r], margin, segmen, signature] = await Promise.all([
    sql<Ringkas[]>`
      select ${hariIni}::text as hari_ini,
             (select avg(p.contract_value) from public.projects p
               where ${proyekTahunIni} and p.contract_value > 0) as rata_kontrak,
             (select count(*) from public.projects p
               where ${proyekTahunIni} and p.contract_value > 0) as proyek_berkontrak,
             (select count(*) from public.inquiries i
               where (i.created_at at time zone ${zona})::date >= ${awalKuartal}) as lead_kuartal,
             (select count(*) from public.inquiries i
               where (i.created_at at time zone ${zona})::date >= ${awalKuartal}
                 and i.status in ('contacted', 'qualified')) as lead_lanjut,
             -- Saldo dari catatan panel: masuk − keluar sepanjang masa. Gaji
             -- yang belum dibayar (paid_on kosong) belum keluar dari kas.
             (coalesce((select sum(amount) from public.project_payments), 0)
              + coalesce((select sum(amount) from public.studio_ledger where direction = 'masuk'), 0)
              - coalesce((select sum(amount) from public.project_costs), 0)
              - coalesce((select sum(amount) from public.studio_ledger where direction = 'keluar'), 0)
              - coalesce((select sum(amount) from public.payroll where paid_on is not null), 0)) as saldo,
             (coalesce((select sum(amount) from public.project_costs
                         where incurred_on >= ${awal6} and incurred_on < ${akhir6}), 0)
              + coalesce((select sum(amount) from public.studio_ledger
                           where direction = 'keluar' and occurred_on >= ${awal6} and occurred_on < ${akhir6}), 0)
              + coalesce((select sum(amount) from public.payroll
                           where paid_on is not null and period >= ${awal6} and period < ${akhir6}), 0)) as keluar_6bulan,
             -- Berapa bulan dari enam itu yang punya catatan keluar sama
             -- sekali — panel yang baru dipakai tiga bulan tidak boleh
             -- membagi dengan enam.
             (select count(distinct b) from (
                select date_trunc('month', incurred_on) as b from public.project_costs
                 where incurred_on >= ${awal6} and incurred_on < ${akhir6}
                union
                select date_trunc('month', occurred_on) from public.studio_ledger
                 where direction = 'keluar' and occurred_on >= ${awal6} and occurred_on < ${akhir6}
                union
                select date_trunc('month', period) from public.payroll
                 where paid_on is not null and period >= ${awal6} and period < ${akhir6}
              ) x) as bulan_berdata`,
    // Margin KONTRAK: (nilai kontrak − biaya tercatat) / nilai kontrak.
    // Sengaja bukan laba kas seperti di Keuangan — yang dinilai §8 apakah
    // harga yang dijual menutup biayanya, dan proyek yang baru DP selalu
    // tampak rugi kalau dihitung dari kas.
    sql<Margin[]>`
      select p.id, p.title, p.contract_value as kontrak,
             coalesce((select sum(c.amount) from public.project_costs c where c.project_id = p.id), 0) as biaya
        from public.projects p
       where ${proyekTahunIni} and p.contract_value > 0
       order by p.created_at`,
    // Laba per segmen (kategori proyek), basis kas tahun ini.
    sql<Segmen[]>`
      select p.category::text as kategori,
             count(distinct p.id) as proyek,
             coalesce(sum((select coalesce(sum(pp.amount), 0) from public.project_payments pp
                            where pp.project_id = p.id
                              and (pp.paid_at at time zone ${zona})::date >= ${awalTahun})), 0) as diterima,
             coalesce(sum((select coalesce(sum(c.amount), 0) from public.project_costs c
                            where c.project_id = p.id and c.incurred_on >= ${awalTahun})), 0) as biaya
        from public.projects p
       where p.status <> 'archived'
         and (${proyekTahunIni}
              or exists (select 1 from public.project_payments pp
                          where pp.project_id = p.id and (pp.paid_at at time zone ${zona})::date >= ${awalTahun})
              or exists (select 1 from public.project_costs c
                          where c.project_id = p.id and c.incurred_on >= ${awalTahun}))
       group by p.category
       order by p.category`,
    // "Tier Signature ke atas" = paket berurutan 2 ke atas di kelompoknya:
    // Signature dan Flagship (coffee shop), Standar dan Premium (rumah).
    sql<Signature[]>`
      select p.id, p.title, t.name as tier
        from public.projects p
        join public.service_tiers t on t.id = p.tier_id
       where ${proyekTahunIni} and t.sort_order >= 2
       order by p.created_at`,
  ]);

  const margins = margin.map((m) => {
    const kontrak = Number(m.kontrak);
    const biaya = Number(m.biaya);
    return { projectId: m.id, title: m.title, kontrak, biaya, margin: ((kontrak - biaya) / kontrak) * 100 };
  });
  const totalKontrak = margins.reduce((n, m) => n + m.kontrak, 0);
  const totalBiaya = margins.reduce((n, m) => n + m.biaya, 0);

  const bulanBerdata = Number(r.bulan_berdata);
  const keluarPerBulan = bulanBerdata > 0 ? Math.round(Number(r.keluar_6bulan) / bulanBerdata) : null;
  const saldo = Number(r.saldo);

  return {
    hariIni: r.hari_ini,
    tahun: Number(r.hari_ini.slice(0, 4)),
    kuartal: Math.floor((Number(r.hari_ini.slice(5, 7)) - 1) / 3) + 1,
    target: { ...TARGET_KPI },
    rataKontrak: {
      nilai: r.rata_kontrak === null ? null : Math.round(Number(r.rata_kontrak)),
      proyek: Number(r.proyek_berkontrak),
    },
    margin: {
      // Rata-rata TERTIMBANG nilai kontrak, bukan rata-rata persen: satu
      // proyek kecil yang rugi tidak boleh menyamai bobot proyek 300 jt.
      rata: totalKontrak > 0 ? ((totalKontrak - totalBiaya) / totalKontrak) * 100 : null,
      proyek: margins.length,
      dibawah: margins.filter((m) => m.margin < TARGET_KPI.marginMin).sort((a, b) => a.margin - b.margin),
    },
    lead: { kuartalIni: Number(r.lead_kuartal), ditindaklanjuti: Number(r.lead_lanjut) },
    signature: { jumlah: signature.length, proyek: signature.map((s) => ({ projectId: s.id, title: s.title, tier: s.tier })) },
    cadangan: {
      saldo,
      keluarPerBulan,
      bulanBerdata,
      bulan: keluarPerBulan && keluarPerBulan > 0 ? saldo / keluarPerBulan : null,
    },
    segmen: segmen.map((g) => {
      const diterima = Number(g.diterima);
      const biaya = Number(g.biaya);
      return { kategori: g.kategori, proyek: Number(g.proyek), diterima, biaya, laba: diterima - biaya };
    }),
  };
}
