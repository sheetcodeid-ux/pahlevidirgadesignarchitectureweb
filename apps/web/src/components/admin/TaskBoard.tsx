import { useEffect, useMemo, useState } from "react";
import { Icon } from "../ui/Icon";
import { SkeletonDaftar, SkeletonKartu } from "../ui/Skeleton";
import { Avatar } from "../ui/misc/Avatar";
import { ToastProvider, useToast } from "../ui/overlay/Toast";
import { RequireAuth } from "./RequireAuth";
import { daftarTugas, ubahTugas, type Tugas, bacaCache, tulisCache} from "../../lib/admin";
import { Select } from "../ui/overlay/Select";

const KOLOM: [string, string][] = [
  ["belum_mulai", "Belum mulai"],
  ["berjalan", "Berjalan"],
  ["review_internal", "Review internal"],
  ["menunggu_klien", "Menunggu klien"],
];

function formatTanggal(iso: string | null | undefined): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short" });
}

function Isi() {
  const toast = useToast();
  const [tugas, setTugas] = useState<Tugas[] | null>(() => bacaCache<Tugas[]>("tugas"));
  const [pic, setPic] = useState("semua");

  function muat() {
    daftarTugas().then((d) => { tulisCache("tugas", d); setTugas(d); }).catch(() => setTugas((l) => l ?? []));
  }

  useEffect(muat, []);

  const daftarPic = useMemo(() => {
    if (!tugas) return [];
    const nama = new Set(tugas.map((t) => t.assigneeName).filter((n): n is string => Boolean(n)));
    return Array.from(nama).sort();
  }, [tugas]);

  const tersaring = useMemo(() => {
    if (!tugas) return [];
    return pic === "semua" ? tugas : tugas.filter((t) => t.assigneeName === pic);
  }, [tugas, pic]);

  async function ubahStatus(id: string, status: string) {
    if (!tugas) return;
    const sebelum = tugas;
    setTugas(tugas.map((t) => (t.id === id ? { ...t, status } : t)));
    try {
      await ubahTugas(id, { status });
    } catch (e) {
      setTugas(sebelum);
      toast({ judul: "Gagal mengubah status", keterangan: (e as Error).message, nada: "gagal" });
    }
  }

  if (tugas === null) {
    return (
      <div className="stack" style={{ gap: "var(--space-5)" }}>
        {[0, 1, 2].map((i) => (
          <SkeletonKartu key={i} ikon="checklist" anak={<SkeletonDaftar jumlah={2} aksi={2} />} />
        ))}
      </div>
    );
  }

  const aktif = tersaring.filter((t) => t.status !== "selesai");

  return (
    <div className="stack" style={{ gap: "var(--space-5)" }}>
      <div className="row row--between">
        <p className="t-muted" style={{ margin: 0 }}>
          {aktif.length} tugas aktif lintas {new Set(tersaring.map((t) => t.projectId)).size} proyek
        </p>
        {daftarPic.length > 0 && (
          <div className="segmented" role="group" aria-label="Saring PIC">
            <button type="button" className="segmented__opt" aria-pressed={pic === "semua"} onClick={() => setPic("semua")}>
              Semua PIC
            </button>
            {daftarPic.map((n) => (
              <button key={n} type="button" className="segmented__opt" aria-pressed={pic === n} onClick={() => setPic(n)}>
                {n}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="spec-grid" style={{ alignItems: "start" }}>
        {KOLOM.map(([nilai, label]) => {
          const isiKolom = aktif.filter((t) => t.status === nilai);
          return (
            <div className="card" key={nilai}>
              <div className="card__header">
                <span className="card__titles">
                  <span className="t-subheading">{label}</span>
                  <span className="t-muted">{isiKolom.length} tugas</span>
                </span>
              </div>
              <div className="card__body">
                {isiKolom.length === 0 ? (
                  <p className="t-muted" style={{ margin: 0 }}>Kosong.</p>
                ) : (
                  <ul className="stack" style={{ gap: "var(--space-3)", listStyle: "none", padding: 0 }}>
                    {isiKolom.map((t) => (
                      <li key={t.id} className="stack" style={{ gap: "var(--space-2)", padding: "var(--space-3)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)" }}>
                        <span className="t-label" style={{ margin: 0 }}>{t.projectTitle}</span>
                        <span>{t.title}</span>
                        <div className="row row--between">
                          <span className="row" style={{ gap: "var(--space-2)" }}>
                            {t.assigneeName && <Avatar name={t.assigneeName} size="sm" />}
                            {formatTanggal(t.dueDate) && (
                              <span className="t-mono t-muted" style={{ fontSize: "var(--text-xs)" }}>
                                {formatTanggal(t.dueDate)}
                              </span>
                            )}
                          </span>
                          <Select
                            ringkas
                            ariaLabel={`Ubah status ${t.title}`}
                            value={t.status}
                            onValueChange={(v) => ubahStatus(t.id, v)}
                            options={[...KOLOM, ["selesai", "Selesai"] as const].map(
                              ([value, label]) => ({ value, label }),
                            )}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {aktif.length === 0 && (
        <div className="empty">
          <span className="icon-tile"><Icon name="check" size={20} /></span>
          <span className="t-subheading">Tidak ada tugas aktif</span>
          <p className="t-muted">Tambah tugas dari tab Tugas di halaman tiap proyek.</p>
        </div>
      )}
    </div>
  );
}

export function TaskBoard() {
  return (
    <RequireAuth skeleton={
      <div className="stack" style={{ gap: "var(--space-5)" }}>
        {[0, 1, 2].map((i) => (
          <SkeletonKartu key={i} ikon="checklist" anak={<SkeletonDaftar jumlah={2} aksi={2} />} />
        ))}
      </div>
    }>
      <ToastProvider><Isi /></ToastProvider>
    </RequireAuth>
  );
}
