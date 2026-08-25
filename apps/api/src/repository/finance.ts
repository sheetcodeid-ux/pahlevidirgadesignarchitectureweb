import type { Sql } from "postgres";
import type { FinanceOverview, FinanceOverviewRow } from "../types";

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
 * Margin dihitung di sini, bukan disimpan — (kontrak - total biaya) / kontrak.
 * "Diterima" cuma menghitung invoice yang statusnya lunas; invoice draft
 * atau terbit belum dianggap kas masuk.
 */
export async function overview(sql: Sql): Promise<FinanceOverview> {
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
    order by p.created_at desc`;

  const piutangRows = await sql<{ total: string }[]>`
    select coalesce(sum(amount), 0) as total from public.invoices where status = 'terbit'`;

  const proyek: FinanceOverviewRow[] = rows.map((r) => {
    const kontrak = Number(r.contract_value);
    const biaya = Number(r.costs_total);
    return {
      projectId: r.project_id,
      projectTitle: r.project_title,
      contractValue: kontrak,
      received: Number(r.received),
      costsTotal: biaya,
      marginPct: kontrak > 0 ? ((kontrak - biaya) / kontrak) * 100 : null,
    };
  });

  const kasMasuk = proyek.reduce((sum, p) => sum + p.received, 0);
  const totalKontrak = proyek.reduce((sum, p) => sum + (p.contractValue ?? 0), 0);
  const totalBiaya = proyek.reduce((sum, p) => sum + p.costsTotal, 0);

  return {
    kasMasuk,
    piutang: Number(piutangRows[0]?.total ?? 0),
    marginRataRata: totalKontrak > 0 ? ((totalKontrak - totalBiaya) / totalKontrak) * 100 : null,
    proyek,
  };
}
