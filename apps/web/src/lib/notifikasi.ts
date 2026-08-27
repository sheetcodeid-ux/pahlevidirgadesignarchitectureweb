/**
 * Sumber tunggal daftar notifikasi dan milestone.
 *
 * Dipakai halaman /admin/notifikasi DAN lonceng di topbar. Kalau keduanya
 * menurunkan daftarnya sendiri-sendiri, angka di badge dan isi halaman bisa
 * berbeda tanpa ada yang menyadarinya — dan angka yang salah di lonceng lebih
 * buruk daripada tidak ada angka sama sekali.
 */

import type { IconName } from "../components/ui/Icon";
import { daftarPesan, daftarTugas, daftarTestimoni, daftarProyek, type Proyek } from "./admin";

export interface BarisNotifikasi {
  id: string;
  ikon: IconName;
  judul: string;
  detail: string;
  waktu?: string;
  ke: string;
}

export const TAHAP_PROYEK: Record<string, string> = {
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

export interface IsiNotifikasi {
  notifikasi: BarisNotifikasi[];
  milestone: BarisNotifikasi[];
  /** Proyek yang belum sampai pelunasan — dipakai penghitung di topbar. */
  proyekAktif: number;
  proyek: Proyek[];
}

/**
 * Keempat panggilan dijalankan bersamaan: tidak ada yang bergantung pada hasil
 * yang lain, dan pemanggilnya baru berguna setelah semuanya tiba.
 */
export async function ambilNotifikasi(): Promise<IsiNotifikasi> {
  const [pesan, tugas, testimoni, proyek] = await Promise.all([
    daftarPesan(), daftarTugas(), daftarTestimoni(), daftarProyek(),
  ]);

  const hariIni = new Date().toISOString().slice(0, 10);

  const notifikasi: BarisNotifikasi[] = [
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
  ];

  // Milestone di sini adalah pencapaian PROYEK, bukan lama berlangganan
  // seperti di aplikasi rujukan — studio arsitektur tidak punya anggota
  // berlangganan. Yang setara maknanya adalah tahap yang sudah dilewati.
  const milestone: BarisNotifikasi[] = proyek
    .filter((p) => p.pipelineStage && TAHAP_PROYEK[p.pipelineStage])
    .map((p) => ({
      id: `tahap-${p.id}`,
      ikon: "project" as const,
      judul: `${p.title} sampai tahap ${TAHAP_PROYEK[p.pipelineStage!]}`,
      detail: p.city ? `${p.category} — ${p.city}` : p.category,
      ke: `/admin/proyek/edit?id=${p.id}`,
    }));

  const proyekAktif = proyek.filter((p) => p.pipelineStage && p.pipelineStage !== "pelunasan").length;

  return { notifikasi, milestone, proyekAktif, proyek };
}
