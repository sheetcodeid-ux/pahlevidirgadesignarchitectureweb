import { useEffect, useState } from "react";
import { Icon } from "./ui/Icon";

const API = (import.meta.env.PUBLIC_API_BASE_URL ?? "http://localhost:8787").replace(/\/$/, "");

const FASE: [string, string][] = [
  ["konsultasi", "Konsultasi"],
  ["konsep", "Konsep"],
  ["ded", "DED"],
  ["perizinan", "Perizinan"],
  ["konstruksi", "Konstruksi"],
  ["selesai", "Selesai"],
];

interface Update {
  id: string;
  title: string;
  note?: string | null;
  photoUrl?: string | null;
  createdAt: string;
}

interface View {
  projectTitle: string;
  coverImageUrl?: string | null;
  phase: string;
  updates: Update[];
}

type Status = "memuat" | "siap" | "tidak-ditemukan";

/**
 * Dilihat klien lewat link token, tanpa login — bukan panel admin, jadi
 * fetch langsung ke API publik, bukan lewat lib/admin.ts yang mengharuskan
 * token sesi staf.
 */
export function ClientProgressView() {
  const [status, setStatus] = useState<Status>("memuat");
  const [data, setData] = useState<View | null>(null);

  useEffect(() => {
    const token = new URLSearchParams(location.search).get("t") ?? "";
    if (!token) { setStatus("tidak-ditemukan"); return; }

    fetch(`${API}/api/v1/progress/${token}`, { headers: { Accept: "application/json" } })
      .then(async (res) => {
        if (!res.ok) { setStatus("tidak-ditemukan"); return; }
        const body = await res.json();
        setData(body.data as View);
        setStatus("siap");
      })
      .catch(() => setStatus("tidak-ditemukan"));
  }, []);

  if (status === "memuat") {
    return (
      <div className="stack" style={{ gap: "var(--space-5)" }}>
        <span className="skeleton" style={{ height: "16rem", borderRadius: "var(--radius-lg)" }} />
        <span className="skeleton" style={{ height: "4rem" }} />
      </div>
    );
  }

  if (status === "tidak-ditemukan" || !data) {
    return (
      <div className="empty">
        <span className="icon-tile"><Icon name="lock" size={22} /></span>
        <span className="t-subheading">Link tidak ditemukan</span>
        <p className="t-muted">
          Link ini mungkin sudah tidak berlaku. Hubungi studio untuk mendapatkan link progres terbaru.
        </p>
        <a className="btn btn--primary" href="/kontak">Hubungi studio</a>
      </div>
    );
  }

  const indeksFase = FASE.findIndex(([nilai]) => nilai === data.phase);

  return (
    <div className="stack" style={{ gap: "var(--space-7)" }}>
      <div>
        {data.coverImageUrl && (
          <div className="aspect aspect--16-9" style={{ marginBottom: "var(--space-5)" }}>
            <img src={data.coverImageUrl} alt={data.projectTitle} />
          </div>
        )}
        <p className="eyebrow">Progres proyek</p>
        <h1>{data.projectTitle}</h1>
      </div>

      <ol className="progres-stepper">
        {FASE.map(([nilai, label], i) => (
          <li
            key={nilai}
            className="progres-stepper__step"
            data-done={i < indeksFase || undefined}
            data-current={i === indeksFase || undefined}
          >
            <span className="progres-stepper__dot" aria-hidden="true">
              {i < indeksFase ? <Icon name="check" size={12} /> : null}
            </span>
            <span className="progres-stepper__label">{label}</span>
          </li>
        ))}
      </ol>

      <div>
        <p className="eyebrow">Linimasa</p>
        {data.updates.length === 0 ? (
          <p className="t-muted">Belum ada catatan progres.</p>
        ) : (
          <ol className="progres-timeline">
            {data.updates.map((u) => (
              <li key={u.id} className="progres-timeline__item">
                <span className="progres-timeline__dot" aria-hidden="true" />
                <div className="progres-timeline__body">
                  <span className="t-mono t-muted progres-timeline__date">
                    {new Date(u.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
                  </span>
                  <span className="t-subheading">{u.title}</span>
                  {u.note && <p className="t-muted">{u.note}</p>}
                  {u.photoUrl && (
                    <div className="aspect aspect--16-9 progres-timeline__photo">
                      <img src={u.photoUrl} alt={u.title} loading="lazy" />
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
