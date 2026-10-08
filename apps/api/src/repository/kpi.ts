import type { Sql } from "postgres";
import type { KpiJejak, KpiStrategi } from "../types";

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
  kontrak: string;
  biaya: string;
  lead_kuartal: string;
  lead_lanjut: string;
  signature: string;
  saldo: string;
  keluar_6bulan: string;
  bulan_berdata: string;
}

/** Lima angka §8 per SATU tanggal — dipakai untuk "kini" dan untuk jejak. */
interface Potret {
  hariIni: string;
  rataKontrak: number | null;
  proyekBerkontrak: number;
  margin: number | null;
  leadKuartal: number;
  leadLanjut: number;
  signature: number;
  saldo: number;
  keluarPerBulan: number | null;
  bulanBerdata: number;
  cadanganBulan: number | null;
}

/**
 * Potret KPI PER TANGGAL `sampai` (kosong = hari ini menurut zona studio).
 * Tiap jumlah dibatasi tanggal itu, jadi potret akhir kuartal lalu adalah
 * angka yang SAMA dengan yang terbaca di halaman ini pada hari itu — kecuali
 * status pesan dan status arsip proyek, yang tidak punya riwayat dan dibaca
 * apa adanya sekarang.
 *
 * Tahun dan kuartal mengikuti tanggal potretnya: potret 31 Desember membaca
 * seluruh tahun itu, potret 31 Maret membaca Januari–Maret.
 */
async function potret(sql: Sql, sampai: string | null): Promise<Potret> {
  const zona = sql`coalesce((select timezone from public.studio_settings where id), 'Asia/Jakarta')`;
  const hariIni = sampai === null ? sql`(now() at time zone ${zona})::date` : sql`${sampai}::date`;
  const awalTahun = sql`date_trunc('year', ${hariIni})::date`;
  const awalKuartal = sql`date_trunc('quarter', ${hariIni})::date`;
  // Enam bulan PENUH terakhir, tanpa bulan berjalan: bulan yang baru berjalan
  // empat hari akan menarik rata-ratanya turun.
  const awal6 = sql`(date_trunc('month', ${hariIni}) - interval '6 months')::date`;
  const akhir6 = sql`date_trunc('month', ${hariIni})::date`;
  const dibuat = sql`(p.created_at at time zone ${zona})::date`;
  const proyekTahunIni = sql`p.status <> 'archived' and ${dibuat} >= ${awalTahun} and ${dibuat} <= ${hariIni}`;

  const [r] = await sql<Ringkas[]>`
    select ${hariIni}::text as hari_ini,
           (select avg(p.contract_value) from public.projects p
             where ${proyekTahunIni} and p.contract_value > 0) as rata_kontrak,
           (select count(*) from public.projects p
             where ${proyekTahunIni} and p.contract_value > 0) as proyek_berkontrak,
           -- Margin KONTRAK: (nilai kontrak − biaya tercatat) / nilai kontrak,
           -- tertimbang. Sengaja bukan laba kas seperti di Keuangan — yang
           -- dinilai §8 apakah harga yang dijual menutup biayanya, dan proyek
           -- yang baru DP selalu tampak rugi kalau dihitung dari kas.
           (select coalesce(sum(p.contract_value), 0) from public.projects p
             where ${proyekTahunIni} and p.contract_value > 0) as kontrak,
           (select coalesce(sum(c.amount), 0) from public.project_costs c
              join public.projects p on p.id = c.project_id
             where ${proyekTahunIni} and p.contract_value > 0 and c.incurred_on <= ${hariIni}) as biaya,
           (select count(*) from public.inquiries i
             where (i.created_at at time zone ${zona})::date between ${awalKuartal} and ${hariIni}) as lead_kuartal,
           (select count(*) from public.inquiries i
             where (i.created_at at time zone ${zona})::date between ${awalKuartal} and ${hariIni}
               and i.status in ('contacted', 'qualified')) as lead_lanjut,
           -- "Tier Signature ke atas" = paket berurutan 2 ke atas di
           -- kelompoknya: Signature dan Flagship (coffee shop), Standar dan
           -- Premium (rumah).
           (select count(*) from public.projects p
              join public.service_tiers t on t.id = p.tier_id
             where ${proyekTahunIni} and t.sort_order >= 2) as signature,
           -- Saldo dari catatan panel: masuk − keluar sampai tanggal potret.
           -- Gaji yang belum dibayar (paid_on kosong) belum keluar dari kas.
           (coalesce((select sum(amount) from public.project_payments
                       where (paid_at at time zone ${zona})::date <= ${hariIni}), 0)
            + coalesce((select sum(amount) from public.studio_ledger
                         where direction = 'masuk' and occurred_on <= ${hariIni}), 0)
            - coalesce((select sum(amount) from public.project_costs where incurred_on <= ${hariIni}), 0)
            - coalesce((select sum(amount) from public.studio_ledger
                         where direction = 'keluar' and occurred_on <= ${hariIni}), 0)
            - coalesce((select sum(amount) from public.payroll
                         where paid_on is not null and paid_on <= ${hariIni}), 0)) as saldo,
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
            ) x) as bulan_berdata`;

  const kontrak = Number(r.kontrak);
  const biaya = Number(r.biaya);
  const bulanBerdata = Number(r.bulan_berdata);
  const keluarPerBulan = bulanBerdata > 0 ? Math.round(Number(r.keluar_6bulan) / bulanBerdata) : null;
  const saldo = Number(r.saldo);
  return {
    hariIni: r.hari_ini,
    rataKontrak: r.rata_kontrak === null ? null : Math.round(Number(r.rata_kontrak)),
    proyekBerkontrak: Number(r.proyek_berkontrak),
    // Rata-rata TERTIMBANG nilai kontrak, bukan rata-rata persen: satu
    // proyek kecil yang rugi tidak boleh menyamai bobot proyek 300 jt.
    margin: kontrak > 0 ? ((kontrak - biaya) / kontrak) * 100 : null,
    leadKuartal: Number(r.lead_kuartal),
    leadLanjut: Number(r.lead_lanjut),
    signature: Number(r.signature),
    saldo,
    keluarPerBulan,
    bulanBerdata,
    cadanganBulan: keluarPerBulan && keluarPerBulan > 0 ? saldo / keluarPerBulan : null,
  };
}

/** Akhir kuartal sebelum tanggal `t` (YYYY-MM-DD), sebagai YYYY-MM-DD. */
export function akhirKuartalSebelum(t: string): string {
  const y = Number(t.slice(0, 4));
  const m = Number(t.slice(5, 7));
  const awalK = Math.floor((m - 1) / 3) * 3; // 0, 3, 6, 9 — bulan pertama kuartal (0-based)
  // Hari ke-0 bulan pertama kuartal = hari terakhir bulan sebelumnya.
  const d = new Date(Date.UTC(y, awalK, 0));
  return d.toISOString().slice(0, 10);
}

const kuartalDari = (t: string) => Math.floor((Number(t.slice(5, 7)) - 1) / 3) + 1;

interface Proyek {
  id: string;
  title: string;
  kategori: string;
  tier: string | null;
  tier_urut: number | null;
  kontrak: string;
  biaya: string;
  dibuat: string;
}

interface Segmen {
  kategori: string;
  proyek: string;
  diterima: string;
  biaya: string;
}

interface Paket {
  nama: string;
  kelompok: string;
  urutan: number;
  jumlah: string;
}

interface StatusLead {
  status: string;
  jumlah: string;
}

interface BulanJumlah {
  bulan: string;
  jumlah: string;
}

/**
 * KPI kini + jejak tiga akhir kuartal sebelumnya + rincian yang dibaca
 * lampiran tiap pasal. Rincian hanya untuk "kini": jejak cuma lima angka.
 */
export async function hitung(sql: Sql): Promise<KpiStrategi> {
  const kini = await potret(sql, null);
  const tanggalJejak: string[] = [];
  for (let t = kini.hariIni, i = 0; i < 3; i++) {
    t = akhirKuartalSebelum(t);
    tanggalJejak.push(t);
  }

  const zona = sql`coalesce((select timezone from public.studio_settings where id), 'Asia/Jakarta')`;
  const hariIni = sql`${kini.hariIni}::date`;
  const awalTahun = sql`date_trunc('year', ${hariIni})::date`;
  const awalKuartal = sql`date_trunc('quarter', ${hariIni})::date`;
  const awal6 = sql`(date_trunc('month', ${hariIni}) - interval '6 months')::date`;
  const dibuat = sql`(p.created_at at time zone ${zona})::date`;
  const proyekTahunIni = sql`p.status <> 'archived' and ${dibuat} >= ${awalTahun} and ${dibuat} <= ${hariIni}`;

  const [jejak, proyek, segmen, paket, lead, leadBulan, keluarBulan] = await Promise.all([
    Promise.all(tanggalJejak.map((t) => potret(sql, t))),
    sql<Proyek[]>`
      select p.id, p.title, p.category::text as kategori, t.name as tier, t.sort_order as tier_urut,
             p.contract_value as kontrak, ${dibuat}::text as dibuat,
             coalesce((select sum(c.amount) from public.project_costs c
                        where c.project_id = p.id and c.incurred_on <= ${hariIni}), 0) as biaya
        from public.projects p
        left join public.service_tiers t on t.id = p.tier_id
       where ${proyekTahunIni} and p.contract_value > 0
       order by p.created_at`,
    // Laba per segmen (kategori proyek), basis kas tahun ini.
    sql<Segmen[]>`
      select p.category::text as kategori,
             count(distinct p.id) as proyek,
             coalesce(sum((select coalesce(sum(pp.amount), 0) from public.project_payments pp
                            where pp.project_id = p.id
                              and (pp.paid_at at time zone ${zona})::date between ${awalTahun} and ${hariIni})), 0) as diterima,
             coalesce(sum((select coalesce(sum(c.amount), 0) from public.project_costs c
                            where c.project_id = p.id and c.incurred_on between ${awalTahun} and ${hariIni})), 0) as biaya
        from public.projects p
       where p.status <> 'archived'
         and (${proyekTahunIni}
              or exists (select 1 from public.project_payments pp
                          where pp.project_id = p.id
                            and (pp.paid_at at time zone ${zona})::date between ${awalTahun} and ${hariIni})
              or exists (select 1 from public.project_costs c
                          where c.project_id = p.id and c.incurred_on between ${awalTahun} and ${hariIni}))
       group by p.category
       order by p.category`,
    // Tangga paket: SEMUA paket aktif (yang belum terpakai tetap tampil
    // sebagai anak tangga kosong) + berapa proyek tahun ini memakainya.
    sql<Paket[]>`
      select t.name as nama, t.group_key as kelompok, t.sort_order as urutan,
             (select count(*) from public.projects p where p.tier_id = t.id and ${proyekTahunIni}) as jumlah
        from public.service_tiers t
       where t.is_active
       order by t.group_key, t.sort_order, t.created_at`,
    sql<StatusLead[]>`
      select i.status::text as status, count(*) as jumlah
        from public.inquiries i
       where (i.created_at at time zone ${zona})::date between ${awalKuartal} and ${hariIni}
       group by i.status`,
    sql<BulanJumlah[]>`
      select to_char((i.created_at at time zone ${zona})::date, 'YYYY-MM') as bulan, count(*) as jumlah
        from public.inquiries i
       where (i.created_at at time zone ${zona})::date between ${awalKuartal} and ${hariIni}
       group by 1`,
    // Uang keluar per bulan untuk enam bulan penuh yang dibagi di atas.
    sql<BulanJumlah[]>`
      select to_char(b, 'YYYY-MM') as bulan, sum(n) as jumlah from (
        select date_trunc('month', incurred_on) as b, amount as n from public.project_costs
         where incurred_on >= ${awal6} and incurred_on < date_trunc('month', ${hariIni})
        union all
        select date_trunc('month', occurred_on), amount from public.studio_ledger
         where direction = 'keluar' and occurred_on >= ${awal6} and occurred_on < date_trunc('month', ${hariIni})
        union all
        select date_trunc('month', period), amount from public.payroll
         where paid_on is not null and period >= ${awal6} and period < date_trunc('month', ${hariIni})
      ) x group by 1`,
  ]);

  const daftar = proyek.map((p) => {
    const kontrak = Number(p.kontrak);
    const biaya = Number(p.biaya);
    return {
      projectId: p.id,
      title: p.title,
      kategori: p.kategori,
      tier: p.tier,
      signature: p.tier_urut !== null && p.tier_urut >= 2,
      kontrak,
      biaya,
      margin: ((kontrak - biaya) / kontrak) * 100,
      dibuat: p.dibuat,
    };
  });

  // Tiga bulan kuartal berjalan dan enam bulan penuh terakhir, lengkap
  // dengan bulan yang kosong — grafik yang melompati bulan kosong berbohong.
  const bulanKe = (dasar: string, geser: number) => {
    const d = new Date(Date.UTC(Number(dasar.slice(0, 4)), Number(dasar.slice(5, 7)) - 1 + geser, 1));
    return d.toISOString().slice(0, 7);
  };
  const awalK = `${kini.hariIni.slice(0, 4)}-${String((kuartalDari(kini.hariIni) - 1) * 3 + 1).padStart(2, "0")}`;
  const lb = new Map(leadBulan.map((x) => [x.bulan, Number(x.jumlah)]));
  const kb = new Map(keluarBulan.map((x) => [x.bulan, Number(x.jumlah)]));
  const ls = new Map(lead.map((x) => [x.status, Number(x.jumlah)]));

  const ringkas = (p: Potret): KpiJejak => ({
    tanggal: p.hariIni,
    tahun: Number(p.hariIni.slice(0, 4)),
    kuartal: kuartalDari(p.hariIni),
    rataKontrak: p.rataKontrak,
    margin: p.margin,
    lead: p.leadKuartal,
    signature: p.signature,
    cadangan: p.cadanganBulan,
  });

  return {
    hariIni: kini.hariIni,
    tahun: Number(kini.hariIni.slice(0, 4)),
    kuartal: kuartalDari(kini.hariIni),
    target: { ...TARGET_KPI },
    rataKontrak: { nilai: kini.rataKontrak, proyek: kini.proyekBerkontrak },
    margin: {
      rata: kini.margin,
      proyek: daftar.length,
      dibawah: daftar
        .filter((m) => m.margin < TARGET_KPI.marginMin)
        .sort((a, b) => a.margin - b.margin)
        .map(({ projectId, title, kontrak, biaya, margin }) => ({ projectId, title, kontrak, biaya, margin })),
    },
    lead: {
      kuartalIni: kini.leadKuartal,
      ditindaklanjuti: kini.leadLanjut,
      status: {
        new: ls.get("new") ?? 0,
        contacted: ls.get("contacted") ?? 0,
        qualified: ls.get("qualified") ?? 0,
        closed: ls.get("closed") ?? 0,
      },
      perBulan: [0, 1, 2]
        .map((i) => bulanKe(awalK, i))
        .filter((b) => b <= kini.hariIni.slice(0, 7))
        .map((b) => ({ bulan: b, jumlah: lb.get(b) ?? 0 })),
    },
    signature: {
      jumlah: kini.signature,
      proyek: daftar.filter((p) => p.signature).map((p) => ({ projectId: p.projectId, title: p.title, tier: p.tier ?? "" })),
    },
    cadangan: {
      saldo: kini.saldo,
      keluarPerBulan: kini.keluarPerBulan,
      bulanBerdata: kini.bulanBerdata,
      bulan: kini.cadanganBulan,
      bulanan: [-6, -5, -4, -3, -2, -1].map((g) => {
        const b = bulanKe(kini.hariIni, g);
        return { bulan: b, keluar: kb.get(b) ?? 0 };
      }),
    },
    segmen: segmen.map((g) => {
      const diterima = Number(g.diterima);
      const biaya = Number(g.biaya);
      return { kategori: g.kategori, proyek: Number(g.proyek), diterima, biaya, laba: diterima - biaya };
    }),
    proyek: daftar,
    paket: paket.map((t) => ({ nama: t.nama, kelompok: t.kelompok, urutan: Number(t.urutan), jumlah: Number(t.jumlah) })),
    // Tertua dulu: K1 → K2 → K3, lalu "kini" ada di angka utama.
    jejak: jejak.map(ringkas).reverse(),
  };
}
