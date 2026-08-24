import { useEffect, useState } from "react";
import { Icon } from "../ui/Icon";
import { RequireAuth } from "./RequireAuth";
import { daftarProyek, daftarPesan } from "../../lib/admin";

function Isi() {
  const [angka, setAngka] = useState<{ terbit: number; draf: number; baru: number } | null>(null);

  useEffect(() => {
    Promise.all([daftarProyek(), daftarPesan()])
      .then(([p, q]) =>
        setAngka({
          terbit: p.filter((x) => x.status === "published").length,
          draf: p.filter((x) => x.status === "draft").length,
          baru: q.filter((x) => x.status === "new").length,
        }),
      )
      .catch(() => setAngka({ terbit: 0, draf: 0, baru: 0 }));
  }, []);

  // Urutan langkah mengikuti ketergantungannya: tidak ada gunanya menerbitkan
  // proyek sebelum ada proyek, dan tidak ada gunanya menunggu pesan sebelum
  // situsnya tayang.
  const langkah = [
    { judul: "Buat proyek pertama", selesai: (angka?.terbit ?? 0) + (angka?.draf ?? 0) > 0, ke: "/admin/proyek" },
    { judul: "Terbitkan satu proyek", selesai: (angka?.terbit ?? 0) > 0, ke: "/admin/proyek" },
    { judul: "Periksa pesan masuk", selesai: (angka?.baru ?? 0) === 0 && angka !== null, ke: "/admin/pesan" },
  ];
  const aktif = langkah.findIndex((l) => !l.selesai);

  return (
    <div className="stack" style={{ gap: "var(--space-6)" }}>
      <div className="spec-grid">
        {[
          { label: "Proyek terbit", nilai: angka?.terbit, ikon: "project" as const, ke: "/admin/proyek" },
          { label: "Draf", nilai: angka?.draf, ikon: "edit" as const, ke: "/admin/proyek" },
          { label: "Pesan belum dibaca", nilai: angka?.baru, ikon: "inquiry" as const, ke: "/admin/pesan" },
        ].map((s) => (
          <a className="card" href={s.ke} key={s.label} style={{ textDecoration: "none" }}>
            <div className="card__header">
              <span className="icon-tile"><Icon name={s.ikon} size={18} /></span>
              <span className="card__titles">
                <span className="t-label" style={{ margin: 0 }}>{s.label}</span>
                {angka === null
                  ? <span className="skeleton" style={{ height: "1.75rem", width: "2.5rem" }} />
                  : <span className="t-numeral">{s.nilai}</span>}
              </span>
            </div>
          </a>
        ))}
      </div>

      <div className="card">
        <div className="card__header">
          <span className="card__titles">
            <span className="t-heading">Panduan memulai</span>
            <span className="t-muted">Satu langkah menonjol pada satu waktu.</span>
          </span>
        </div>
        <div className="card__body">
          <div className="stack" style={{ gap: 0 }}>
            {langkah.map((l, i) => (
              <div className="item" key={l.judul} style={{ borderTop: i ? "1px solid var(--border)" : undefined, borderRadius: 0 }}>
                <span className="langkah-lingkaran"
                  style={{
                    borderColor: l.selesai ? "var(--success)" : i === aktif ? "var(--brand)" : "var(--border-strong)",
                    color: l.selesai ? "var(--success)" : i === aktif ? "var(--brand)" : "var(--text-faint)",
                  }}>
                  {l.selesai ? <Icon name="check" size={15} /> : <span className="t-mono">{i + 1}</span>}
                </span>
                <span className="item__text">
                  <span className="item__title" style={l.selesai ? { textDecoration: "line-through", color: "var(--text-faint)" } : undefined}>
                    {l.judul}
                  </span>
                </span>
                {l.selesai ? (
                  <span className="badge">Selesai</span>
                ) : (
                  <a className={i === aktif ? "btn btn--primary btn--sm" : "btn btn--ghost btn--sm"} href={l.ke}>
                    Mulai<Icon name="chevronRight" size={14} />
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function DashboardPanel() {
  return <RequireAuth><Isi /></RequireAuth>;
}
