import { useEffect, useState } from "react";
import { Icon, type IconName } from "../ui/Icon";
import { RequireAuth } from "./RequireAuth";
import {
  daftarPesan, daftarTugas, daftarTestimoni, daftarProyek,
  type Proyek,
} from "../../lib/admin";

interface Baris {
  id: string;
  ikon: IconName;
  judul: string;
  detail: string;
  waktu?: string;
  ke: string;
}

const TAHAP: Record<string, string> = {
  proposal: "Proposal",
  deal_kontrak: "Deal & Kontrak",
  dp_50: "DP 50%",
  desain_1: "Desain 1",
  desain_2: "Desain 2",
  finish: "Finish",
  pelunasan: "Pelunasan",
};

function tanggal(iso: string) {
  return new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

function Isi() {
  const [tab, setTab] = useState<"notifikasi" | "milestone">("notifikasi");
  const [notif, setNotif] = useState<Baris[] | null>(null);
  const [milestone, setMilestone] = useState<Baris[] | null>(null);

  useEffect(() => {
    // Keempat panggilan dijalankan bersamaan: tidak ada yang bergantung pada
    // hasil yang lain, dan halaman ini baru berguna setelah semuanya tiba.
    Promise.all([daftarPesan(), daftarTugas(), daftarTestimoni(), daftarProyek()])
      .then(([pesan, tugas, testimoni, proyek]) => {
        const hariIni = new Date().toISOString().slice(0, 10);

        setNotif([
          ...pesan
            .filter((p) => p.status === "new")
            .map((p) => ({
              id: `pesan-${p.id}`,
              ikon: "inquiry" as const,
              judul: "Pesan baru belum dibaca",
              detail: `${p.name} — ${p.projectType || "tanpa jenis proyek"}`,
              waktu: tanggal(p.createdAt),
              ke: "/admin/pesan",
            })),
          ...tugas
            .filter((t) => t.status !== "done" && t.dueDate && t.dueDate <= hariIni)
            .map((t) => ({
              id: `tugas-${t.id}`,
              ikon: "clock" as const,
              judul: "Tenggat kerjaan terlewat",
              detail: `${t.title}${t.projectTitle ? ` — ${t.projectTitle}` : ""}`,
              waktu: t.dueDate ? tanggal(t.dueDate) : undefined,
              ke: "/admin/list-kerjaan",
            })),
          ...testimoni
            .filter((t) => t.status === "pending")
            .map((t) => ({
              id: `testimoni-${t.id}`,
              ikon: "quote" as const,
              judul: "Testimoni menunggu persetujuan",
              detail: `${t.clientName}${t.projectTitle ? ` — ${t.projectTitle}` : ""}`,
              waktu: tanggal(t.createdAt),
              ke: "/admin/testimoni",
            })),
        ]);

        setMilestone(pencapaian(proyek));
      })
      .catch(() => {
        setNotif([]);
        setMilestone([]);
      });
  }, []);

  const isi = tab === "notifikasi" ? notif : milestone;

  return (
    <div className="notifpage__isi">
      <div className="segmented" role="tablist" aria-label="Jenis pemberitahuan">
        {([["notifikasi", "Notifikasi"], ["milestone", "Milestone"]] as const).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            className="segmented__opt"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="notifkotak">
        {isi === null && (
          <div className="empty">
            <span className="spinner" />
            <p className="t-muted">Memuat…</p>
          </div>
        )}

        {isi !== null && isi.length === 0 && (
          <div className="empty">
            <span className="icon-tile">
              <Icon name={tab === "notifikasi" ? "bellOff" : "gift"} size={22} />
            </span>
            <h2 className="t-heading">
              {tab === "notifikasi" ? "Tidak ada notifikasi" : "Tidak ada milestone bulan ini"}
            </h2>
            <p className="t-muted">
              {tab === "notifikasi"
                ? "Notifikasi penting akan muncul di sini"
                : "Akan muncul ketika sebuah proyek naik tahap: Deal & Kontrak, DP 50%, Desain, Finish, atau Pelunasan."}
            </p>
          </div>
        )}

        {isi !== null && isi.length > 0 && (
          <ul className="notiflist">
            {isi.map((b) => (
              <li key={b.id}>
                <a className="notiflist__baris" href={b.ke}>
                  <span className="icon-tile icon-tile--sm"><Icon name={b.ikon} size={16} /></span>
                  <span className="notiflist__teks">
                    <span className="notiflist__judul">{b.judul}</span>
                    <span className="notiflist__detail">{b.detail}</span>
                  </span>
                  {b.waktu && <span className="notiflist__waktu t-mono">{b.waktu}</span>}
                  <Icon name="chevronRight" size={16} />
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/**
 * Milestone di sini adalah pencapaian PROYEK, bukan lama berlangganan seperti
 * di aplikasi rujukan — studio arsitektur tidak punya anggota berlangganan.
 * Yang setara maknanya adalah tahap yang sudah dilewati sebuah proyek.
 */
function pencapaian(proyek: Proyek[]): Baris[] {
  return proyek
    .filter((p) => p.pipelineStage && TAHAP[p.pipelineStage])
    .map((p) => ({
      id: `tahap-${p.id}`,
      ikon: "project" as const,
      judul: `${p.title} sampai tahap ${TAHAP[p.pipelineStage!]}`,
      detail: p.city ? `${p.category} — ${p.city}` : p.category,
      ke: `/admin/proyek/edit?id=${p.id}`,
    }));
}

export function NotifikasiPanel() {
  return <RequireAuth><Isi /></RequireAuth>;
}
