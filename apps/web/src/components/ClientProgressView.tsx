import { useEffect, useState } from "react";
import { Icon } from "./ui/Icon";
import { formatRupiah } from "../lib/format";

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

interface Dokumen {
  id: string;
  title: string;
  fileUrl: string;
  status: string;
  clientNote?: string | null;
}

interface Tagihan {
  id: string;
  label: string;
  amount: number;
  status: string;
  dueDate?: string | null;
}

interface View {
  projectTitle: string;
  coverImageUrl?: string | null;
  phase: string;
  updates: Update[];
  documents: Dokumen[];
  invoices: Tagihan[];
}

const BADGE_DOKUMEN: Record<string, string> = {
  draft: "badge--info",
  menunggu_klien: "badge--warn",
  revisi_diminta: "badge--warn",
  disetujui: "badge--success",
  final: "badge--success",
};

const LABEL_DOKUMEN: Record<string, string> = {
  draft: "Draf",
  menunggu_klien: "Menunggu tanggapan Anda",
  revisi_diminta: "Revisi diminta",
  disetujui: "Disetujui",
  final: "Final",
};

const BADGE_TAGIHAN: Record<string, string> = {
  draft: "badge--info",
  terbit: "badge--warn",
  lunas: "badge--success",
};

const LABEL_TAGIHAN: Record<string, string> = {
  draft: "Draf",
  terbit: "Menunggu pembayaran",
  lunas: "Lunas",
};

/** Satu dokumen dengan aksi setujui/minta-revisi — form revisi baru muncul saat ditekan. */
function BarisDokumen({ dokumen, token, onBerubah }: { dokumen: Dokumen; token: string; onBerubah: () => void }) {
  const [formRevisi, setFormRevisi] = useState(false);
  const [catatan, setCatatan] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);

  async function setujui() {
    setSibuk(true);
    setGalat(null);
    try {
      const res = await fetch(`${API}/api/v1/progress/${token}/documents/${dokumen.id}/approve`, { method: "POST" });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error?.message ?? "gagal menyetujui");
      onBerubah();
    } catch (e) {
      setGalat((e as Error).message);
    } finally {
      setSibuk(false);
    }
  }

  async function kirimRevisi() {
    if (catatan.trim().length < 2) return;
    setSibuk(true);
    setGalat(null);
    try {
      const res = await fetch(`${API}/api/v1/progress/${token}/documents/${dokumen.id}/revise`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: catatan.trim() }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error?.message ?? "gagal mengirim catatan revisi");
      setFormRevisi(false);
      setCatatan("");
      onBerubah();
    } catch (e) {
      setGalat((e as Error).message);
    } finally {
      setSibuk(false);
    }
  }

  return (
    <li className="card">
      <div className="card__body stack" style={{ gap: "var(--space-3)" }}>
        <div className="row row--between" style={{ alignItems: "flex-start" }}>
          <span className="stack" style={{ gap: "var(--space-1)" }}>
            <span className="t-subheading">{dokumen.title}</span>
            <a href={dokumen.fileUrl} target="_blank" rel="noreferrer" className="row" style={{ gap: "var(--space-1)", alignItems: "center" }}>
              <Icon name="document" size={14} />Lihat / unduh
            </a>
          </span>
          <span className={`badge ${BADGE_DOKUMEN[dokumen.status] ?? "badge--info"}`}>
            <span className="badge__dot" />{LABEL_DOKUMEN[dokumen.status] ?? dokumen.status}
          </span>
        </div>

        {dokumen.status === "revisi_diminta" && dokumen.clientNote && (
          <p className="t-muted">Catatan revisi Anda: {dokumen.clientNote}</p>
        )}

        {dokumen.status === "menunggu_klien" && !formRevisi && (
          <div className="row" style={{ gap: "var(--space-2)" }}>
            <button type="button" className="btn btn--primary btn--sm" disabled={sibuk} onClick={setujui}>
              <Icon name="check" size={14} />Setujui
            </button>
            <button type="button" className="btn btn--secondary btn--sm" disabled={sibuk} onClick={() => setFormRevisi(true)}>
              Minta revisi
            </button>
          </div>
        )}

        {dokumen.status === "menunggu_klien" && formRevisi && (
          <div className="stack" style={{ gap: "var(--space-2)" }}>
            <textarea className="input input--area" value={catatan} onChange={(e) => setCatatan(e.target.value)}
              placeholder="Bagian mana yang perlu direvisi?" />
            <div className="row" style={{ gap: "var(--space-2)" }}>
              <button type="button" className="btn btn--primary btn--sm" disabled={catatan.trim().length < 2 || sibuk}
                onClick={kirimRevisi}>
                Kirim catatan revisi
              </button>
              <button type="button" className="btn btn--ghost btn--sm" disabled={sibuk} onClick={() => setFormRevisi(false)}>
                Batal
              </button>
            </div>
          </div>
        )}

        {galat && <p className="field__error">{galat}</p>}
      </div>
    </li>
  );
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
  const token = typeof window !== "undefined" ? new URLSearchParams(location.search).get("t") ?? "" : "";

  function muat() {
    if (!token) { setStatus("tidak-ditemukan"); return; }

    fetch(`${API}/api/v1/progress/${token}`, { headers: { Accept: "application/json" } })
      .then(async (res) => {
        if (!res.ok) { setStatus("tidak-ditemukan"); return; }
        const body = await res.json();
        setData(body.data as View);
        setStatus("siap");
      })
      .catch(() => setStatus("tidak-ditemukan"));
  }

  useEffect(muat, []);

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

      {data.documents.length > 0 && (
        <div>
          <p className="eyebrow">Dokumen</p>
          <ul className="stack" style={{ gap: "var(--space-3)", listStyle: "none", padding: 0 }}>
            {data.documents.map((d) => (
              <BarisDokumen key={d.id} dokumen={d} token={token} onBerubah={muat} />
            ))}
          </ul>
        </div>
      )}

      {data.invoices.length > 0 && (
        <div>
          <p className="eyebrow">Tagihan</p>
          <ul className="stack" style={{ gap: "var(--space-2)", listStyle: "none", padding: 0 }}>
            {data.invoices.map((i) => (
              <li key={i.id} className="item item--bordered">
                <span className="item__text">
                  <span className="item__title">{i.label}</span>
                  <span className="item__desc t-mono">{formatRupiah(i.amount)}</span>
                </span>
                <span className={`badge ${BADGE_TAGIHAN[i.status] ?? "badge--info"}`}>
                  <span className="badge__dot" />{LABEL_TAGIHAN[i.status] ?? i.status}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
