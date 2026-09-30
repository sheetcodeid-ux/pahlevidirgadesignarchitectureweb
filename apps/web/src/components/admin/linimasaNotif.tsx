import type { DataIkon } from "../kit/Ikon";
import { ChatTeardropDots, Clock, HourglassHigh, NavEnvelope, SealPercent } from "../kit/ikon";
import type { BarisNotifikasi } from "../../lib/notifikasi";

/* =============================================================================
   Linimasa pemberitahuan — dipakai Dashboard ("Perlu Ditangani") dan
   halaman Notifikasi. Kelompok per hari, keterangan waktu, dan ikon per
   sumber ada di SATU tempat: dua salinan pasti menyimpang, dan yang
   menyimpang membuat butir yang sama tampil beda di dua halaman.
   ============================================================================= */

const BULAN_PENDEK = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

/** "Hari ini" / "Kemarin" / "3 Okt" — kepala kelompok linimasa. */
export function kepalaHari(iso: string): string {
  const d = iso.length === 10 ? new Date(iso + "T00:00:00") : new Date(iso);
  const kini = new Date();
  const hari = (x: Date) => Date.UTC(x.getFullYear(), x.getMonth(), x.getDate());
  const selisihHari = Math.round((hari(kini) - hari(d)) / 86_400_000);
  if (selisihHari === 0) return "Hari ini";
  if (selisihHari === 1) return "Kemarin";
  const tahun = d.getFullYear() === kini.getFullYear() ? "" : ` ${d.getFullYear()}`;
  return `${d.getDate()} ${BULAN_PENDEK[d.getMonth()]}${tahun}`;
}

/** Baris kecil di bawah keterangan: jam untuk yang punya jam, umur tenggat
 *  untuk tenggat kerjaan (yang cuma punya tanggal). */
export function waktuButir(n: BarisNotifikasi): string {
  if (!n.tanggal) return n.waktu ?? "";
  if (n.tanggal.length > 10) {
    return new Date(n.tanggal).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  }
  const kini = new Date();
  const [t, b, h] = n.tanggal.split("-").map(Number);
  const lewat = Math.round(
    (Date.UTC(kini.getFullYear(), kini.getMonth(), kini.getDate()) - Date.UTC(t!, b! - 1, h!)) / 86_400_000,
  );
  return lewat <= 0 ? "Tenggat hari ini" : `Lewat ${lewat} hari`;
}

/* Ikon butir linimasa menurut sumbernya. Id-nya berawalan sumbernya sendiri
   (pesan-, tugas-, testimoni-) — lihat lib/notifikasi.ts. */
export function ikonButir(n: BarisNotifikasi): DataIkon {
  if (n.id.startsWith("pesan-")) return NavEnvelope;
  if (n.id.startsWith("tugas-")) return HourglassHigh;
  if (n.id.startsWith("testimoni-")) return ChatTeardropDots;
  /* Milestone: pencapaian tahap proyek. */
  if (n.id.startsWith("tahap-")) return SealPercent;
  return Clock;
}

