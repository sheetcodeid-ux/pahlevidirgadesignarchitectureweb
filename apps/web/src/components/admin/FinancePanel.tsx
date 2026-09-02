import { useEffect, useState } from "react";
import { Icon } from "../ui/Icon";
import { SkeletonKartu, SkeletonStat } from "../ui/Skeleton";
import { BarChart } from "../ui/data/Chart";
import { DataTable, type Kolom } from "../ui/data/DataTable";
import { RequireAuth } from "./RequireAuth";
import { ambilRingkasanKeuangan, type FinanceOverview, bacaCache, tulisCache} from "../../lib/admin";
import { formatRupiah } from "../../lib/format";

type BarisProyek = FinanceOverview["proyek"][number];

const KOLOM: Kolom<BarisProyek>[] = [
  {
    judul: "Proyek",
    render: (p) => (
      <a href={`/admin/proyek/edit?id=${p.projectId}`} className="item__title" style={{ textDecoration: "none" }}>
        {p.projectTitle}
      </a>
    ),
  },
  { judul: "Kontrak", kelas: "table__num", lebar: "7rem", render: (p) => (p.contractValue !== null ? formatRupiah(p.contractValue) : "—") },
  { judul: "Diterima", kelas: "table__num", lebar: "7rem", render: (p) => formatRupiah(p.received) },
  { judul: "Biaya (HPP)", kelas: "table__num", lebar: "7rem", render: (p) => formatRupiah(p.costsTotal) },
  {
    judul: "Margin",
    kelas: "table__num",
    lebar: "3.5rem",
    render: (p) =>
      p.marginPct !== null ? (
        <span className={`badge ${p.marginPct >= 35 ? "badge--success" : "badge--warn"}`}>
          {p.marginPct.toFixed(0)}%
        </span>
      ) : "—",
  },
];

function Isi() {
  const [data, setData] = useState<FinanceOverview | null>(() => bacaCache<FinanceOverview>("keuangan"));
  const [galat, setGalat] = useState<string | null>(null);

  useEffect(() => {
    ambilRingkasanKeuangan().then((d) => { tulisCache("keuangan", d); setData(d); }).catch((e) => setGalat((e as Error).message));
  }, []);

  if (galat) {
    return (
      <div className="empty">
        <span className="icon-tile"><Icon name="alert" size={20} /></span>
        <span className="t-subheading">{galat}</span>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="stack" style={{ gap: "var(--space-6)" }}>
        <SkeletonStat jumlah={3} />
        <SkeletonKartu ikon="finance" />
      </div>
    );
  }

  return (
    <div className="stack" style={{ gap: "var(--space-6)" }}>
      <div className="spec-grid">
        {[
          { label: "Kas masuk", nilai: data.kasMasuk, ikon: "finance" as const },
          { label: "Piutang", nilai: data.piutang, ikon: "clock" as const },
        ].map((s) => (
          <div className="card" key={s.label}>
            <div className="card__header">
              <span className="icon-tile"><Icon name={s.ikon} size={18} /></span>
              <span className="card__titles">
                <span className="t-label" style={{ margin: 0 }}>{s.label}</span>
                <span className="t-numeral">{formatRupiah(s.nilai)}</span>
              </span>
            </div>
          </div>
        ))}
        <div className="card">
          <div className="card__header">
            <span className="icon-tile"><Icon name="finance" size={18} /></span>
            <span className="card__titles">
              <span className="t-label" style={{ margin: 0 }}>Margin rata-rata</span>
              <span className="t-numeral">
                {data.marginRataRata !== null ? `${data.marginRataRata.toFixed(0)}%` : "—"}
              </span>
            </span>
          </div>
        </div>
      </div>

      {data.proyek.length === 0 ? (
        <div className="empty">
          <span className="icon-tile"><Icon name="finance" size={20} /></span>
          <span className="t-subheading">Belum ada proyek dengan nilai kontrak</span>
          <p className="t-muted">Isi nilai kontrak di tab Keuangan pada halaman tiap proyek.</p>
        </div>
      ) : (
        <>
          <div className="spec-grid">
            <div className="spec-demo">
              <BarChart
                title="Kas diterima per proyek"
                unit=" jt"
                data={data.proyek.map((p) => ({ label: p.projectTitle, value: Math.round(p.received / 1_000_000) }))}
              />
            </div>
            {data.proyek.some((p) => p.marginPct !== null) && (
              <div className="spec-demo">
                <BarChart
                  title="Margin per proyek"
                  unit="%"
                  data={data.proyek
                    .filter((p): p is typeof p & { marginPct: number } => p.marginPct !== null)
                    .map((p) => ({ label: p.projectTitle, value: Math.round(p.marginPct) }))}
                />
              </div>
            )}
          </div>

          <DataTable
            data={data.proyek}
            kunci={(p) => p.projectId}
            kolom={KOLOM}
            cariPada={(p) => [p.projectTitle]}
            placeholderCari="Cari proyek…"
            labelCari="Cari proyek"
            satuan="proyek"
            barisSkeleton={data.proyek.length}
            kosong={{
              ikon: "finance",
              judul: "Belum ada proyek dengan nilai kontrak",
              keterangan: "Isi nilai kontrak di tab Keuangan pada halaman tiap proyek.",
            }}
          />
        </>
      )}
    </div>
  );
}

export function FinancePanel() {
  return <RequireAuth skeleton={
      <div className="stack" style={{ gap: "var(--space-6)" }}>
        <SkeletonStat jumlah={3} />
        <SkeletonKartu ikon="finance" />
      </div>
    }><Isi /></RequireAuth>;
}
