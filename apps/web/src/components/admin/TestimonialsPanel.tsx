import { useEffect, useState } from "react";
import { Icon } from "../ui/Icon";
import { AlertDialog } from "../ui/overlay/Dialog";
import { ToastProvider, useToast } from "../ui/overlay/Toast";
import { RequireAuth } from "./RequireAuth";
import { daftarTestimoni, ubahTestimoni, hapusTestimoni, type TestimoniAdmin } from "../../lib/admin";

const LABEL_STATUS: Record<string, string> = { menunggu: "Menunggu", disetujui: "Disetujui", ditolak: "Ditolak" };
const BADGE_STATUS: Record<string, string> = { menunggu: "badge--warn", disetujui: "badge--success", ditolak: "badge--info" };

function Isi() {
  const toast = useToast();
  const [testimoni, setTestimoni] = useState<TestimoniAdmin[] | null>(null);
  const [filter, setFilter] = useState<string>("semua");

  function muat() {
    daftarTestimoni().then(setTestimoni).catch(() => setTestimoni([]));
  }

  useEffect(muat, []);

  async function ubahStatus(id: string, status: string) {
    if (!testimoni) return;
    const sebelum = testimoni;
    setTestimoni(testimoni.map((t) => (t.id === id ? { ...t, status } : t)));
    try {
      await ubahTestimoni(id, { status });
    } catch (e) {
      setTestimoni(sebelum);
      toast({ judul: "Gagal mengubah status", keterangan: (e as Error).message, nada: "gagal" });
    }
  }

  async function toggleFeatured(id: string, isFeatured: boolean) {
    if (!testimoni) return;
    const sebelum = testimoni;
    setTestimoni(testimoni.map((t) => (t.id === id ? { ...t, isFeatured } : t)));
    try {
      await ubahTestimoni(id, { isFeatured });
    } catch (e) {
      setTestimoni(sebelum);
      toast({ judul: "Gagal mengubah status unggulan", keterangan: (e as Error).message, nada: "gagal" });
    }
  }

  async function hapus(id: string) {
    try {
      await hapusTestimoni(id);
      setTestimoni((t) => t?.filter((x) => x.id !== id) ?? null);
    } catch (e) {
      toast({ judul: "Gagal menghapus", keterangan: (e as Error).message, nada: "gagal" });
    }
  }

  const terfilter = (testimoni ?? []).filter((t) => filter === "semua" || t.status === filter);

  return (
    <div className="stack" style={{ gap: "var(--space-5)" }}>
      <div className="segmented" role="group" aria-label="Filter status">
        {[["semua", "Semua"], ["menunggu", "Menunggu"], ["disetujui", "Disetujui"], ["ditolak", "Ditolak"]].map(([v, l]) => (
          <button key={v} type="button" className="segmented__opt" aria-pressed={filter === v} onClick={() => setFilter(v)}>
            {l}
          </button>
        ))}
      </div>

      {testimoni === null ? (
        <div className="stack">{[0, 1, 2].map((i) => <span key={i} className="skeleton" style={{ height: "6rem" }} />)}</div>
      ) : terfilter.length === 0 ? (
        <div className="empty empty--sm">
          <span className="icon-tile"><Icon name="quote" size={20} /></span>
          <span className="t-subheading">Belum ada testimoni di kategori ini</span>
        </div>
      ) : (
        <ul className="stack" style={{ gap: "var(--space-3)", listStyle: "none", padding: 0 }}>
          {terfilter.map((t) => (
            <li key={t.id} className="card">
              <div className="card__body stack" style={{ gap: "var(--space-3)" }}>
                <div className="row row--between" style={{ alignItems: "flex-start" }}>
                  <span className="stack" style={{ gap: "var(--space-1)" }}>
                    <span className="t-subheading">{t.clientName}</span>
                    {t.projectTitle && <span className="t-muted">{t.projectTitle}</span>}
                    {t.rating && (
                      <span className="row" style={{ gap: "2px" }}>
                        {Array.from({ length: 5 }).map((_, i) => (
                          <span key={i} style={{ color: i < t.rating! ? "var(--text-strong)" : "var(--text-faint)" }}>
                            <Icon name="star" size={13} variant={i < t.rating! ? "filled" : "stroke"} />
                          </span>
                        ))}
                      </span>
                    )}
                  </span>
                  <span className={`badge ${BADGE_STATUS[t.status] ?? "badge--info"}`}>
                    <span className="badge__dot" />{LABEL_STATUS[t.status] ?? t.status}
                  </span>
                </div>
                <p>{t.quote}</p>
                <div className="row row--between">
                  <label className="choice">
                    <input type="checkbox" checked={t.isFeatured} onChange={(e) => toggleFeatured(t.id, e.target.checked)} />
                    <span className="choice__text"><span>Tampilkan di beranda</span></span>
                  </label>
                  <span className="row" style={{ gap: "var(--space-2)" }}>
                    {t.status !== "disetujui" && (
                      <button type="button" className="btn btn--secondary btn--sm" onClick={() => ubahStatus(t.id, "disetujui")}>
                        <Icon name="check" size={14} />Setujui
                      </button>
                    )}
                    {t.status !== "ditolak" && (
                      <button type="button" className="btn btn--ghost btn--sm" onClick={() => ubahStatus(t.id, "ditolak")}>
                        Tolak
                      </button>
                    )}
                    <AlertDialog
                      destructive
                      title={`Hapus testimoni dari ${t.clientName}?`}
                      description="Testimoni ini akan dihapus permanen dan tidak lagi tampil di beranda."
                      confirmLabel="Ya, hapus"
                      onConfirm={() => hapus(t.id)}
                      trigger={
                        <button type="button" className="btn btn--ghost btn--icon btn--hapus" aria-label={`Hapus testimoni ${t.clientName}`}>
                          <Icon name="trash" size={15} />
                        </button>
                      }
                    />
                  </span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function TestimonialsPanel() {
  return (
    <RequireAuth>
      <ToastProvider><Isi /></ToastProvider>
    </RequireAuth>
  );
}
