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
import { CATEGORY_LABELS } from "./api";

/* Nilai enum `project_category` jadi kata yang dibaca staf. Sebelumnya
   tercetak mentah — "commercial", "residential" — di lonceng, Dashboard,
   dan halaman Notifikasi. */
const jenis = (v: string | null | undefined) =>
  v ? (CATEGORY_LABELS as Record<string, string>)[v] ?? v : "";

export interface BarisNotifikasi {
  id: string;
  ikon: IconName;
  judul: string;
  detail: string;
  waktu?: string;
  /**
   * Waktu mentahnya (ISO), di samping `waktu` yang sudah jadi kalimat.
   * Dashboard mengelompokkan daftar ini per hari ("Hari ini", "Kemarin"),
   * dan itu tidak bisa dikerjakan dari kalimat "3 Okt 2026". Tanggal
   * telanjang ("2026-10-03") berarti butir itu cuma punya hari, tanpa jam —
   * tenggat kerjaan.
   */
  tanggal?: string;
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
  const notifikasi = susunNotifikasi(pesan, tugas, testimoni);
  return { notifikasi, ...susunMilestone(proyek) };
}

/**
 * Baris notifikasi SAJA — tanpa daftar proyek. Untuk titik di lonceng dan
 * tombol pesan di kepala kit, yang dipasang ulang tiap pindah halaman:
 * mengambil daftar proyek di sana cuma untuk milestone yang tidak ia
 * tampilkan adalah satu permintaan sia-sia per klik menu. Aturan barisnya
 * SATU (`susunNotifikasi`), dipakai keduanya — dua salinan aturan yang sama
 * pasti menyimpang (jebakan #32).
 */
export async function ambilBarisNotifikasi(): Promise<BarisNotifikasi[]> {
  const [pesan, tugas, testimoni] = await Promise.all([daftarPesan(), daftarTugas(), daftarTestimoni()]);
  return susunNotifikasi(pesan, tugas, testimoni);
}

function susunNotifikasi(
  pesan: Awaited<ReturnType<typeof daftarPesan>>,
  tugas: Awaited<ReturnType<typeof daftarTugas>>,
  testimoni: Awaited<ReturnType<typeof daftarTestimoni>>,
): BarisNotifikasi[] {
  const hariIni = new Date().toISOString().slice(0, 10);

  return [
    ...pesan
      .filter((p) => p.status === "new")
      .map((p) => ({
        id: `pesan-${p.id}`,
        ikon: "inquiry" as const,
        judul: "Pesan baru belum dibaca",
        detail: `${p.name} — ${jenis(p.projectType) || "tanpa jenis proyek"}`,
        waktu: tanggal(p.createdAt),
        tanggal: p.createdAt,
        ke: "/admin/pesan",
      })),
    ...tugas
      /* "selesai", bukan "done": enum `task_status` berbahasa Indonesia.
         Dengan "done" saringannya tidak pernah menyaring apa pun, dan tugas
         yang SUDAH selesai tetap dilaporkan terlewat selamanya. */
      .filter((t) => t.status !== "selesai" && t.dueDate && t.dueDate <= hariIni)
      .map((t) => ({
        id: `tugas-${t.id}`,
        ikon: "clock" as const,
        judul: "Tenggat kerjaan terlewat",
        detail: `${t.title}${t.projectTitle ? ` — ${t.projectTitle}` : ""}`,
        waktu: t.dueDate ? tanggal(t.dueDate) : undefined,
        tanggal: t.dueDate ?? undefined,
        ke: "/admin/list-kerjaan",
      })),
    ...testimoni
      /* "menunggu", bukan "pending": enum `testimonial_status`. Dengan
         "pending" testimoni yang menunggu persetujuan tidak pernah muncul. */
      .filter((t) => t.status === "menunggu")
      .map((t) => ({
        id: `testimoni-${t.id}`,
        ikon: "quote" as const,
        judul: "Testimoni menunggu persetujuan",
        detail: `${t.clientName}${t.projectTitle ? ` — ${t.projectTitle}` : ""}`,
        waktu: tanggal(t.createdAt),
        tanggal: t.createdAt,
        ke: "/admin/testimoni",
      })),
  ];
}

function susunMilestone(proyek: Proyek[]): Omit<IsiNotifikasi, "notifikasi"> {
  // Milestone di sini adalah pencapaian PROYEK, bukan lama berlangganan
  // seperti di aplikasi rujukan — studio arsitektur tidak punya anggota
  // berlangganan. Yang setara maknanya adalah tahap yang sudah dilewati.
  const milestone: BarisNotifikasi[] = proyek
    .filter((p) => p.pipelineStage && TAHAP_PROYEK[p.pipelineStage])
    .map((p) => ({
      id: `tahap-${p.id}`,
      ikon: "project" as const,
      judul: `${p.title} sampai tahap ${TAHAP_PROYEK[p.pipelineStage!]}`,
      detail: p.city ? `${jenis(p.category)} — ${p.city}` : jenis(p.category),
      ke: `/admin/proyek/edit?id=${p.id}`,
    }));

  const proyekAktif = proyek.filter((p) => p.pipelineStage && p.pipelineStage !== "pelunasan").length;

  return { milestone, proyekAktif, proyek };
}
