import { useEffect, useState } from "react";

/* =============================================================================
   Jam STUDIO — tanggal dan jam menurut zona Info Studio, bukan zona peramban.

   Dipakai kotak judul Dashboard dan kop gambar di kaki rel samping. Satu
   modul, supaya dua tempat yang menulis jam di layar yang sama tidak pernah
   berbeda menit atau berbeda zona (jebakan #32).
   ============================================================================= */

const ZONA: Record<string, string> = { "Asia/Jakarta": "WIB", "Asia/Makassar": "WITA", "Asia/Jayapura": "WIT" };
const BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

export interface Jam {
  /** "Kamis, 8 Okt 2026" */
  tanggal: string;
  /** "8 Okt 2026" */
  tanggalPendek: string;
  /** "09.58 WIB" */
  jam: string;
}

/** Zona yang tidak dikenal jatuh ke WIB — studio berkantor di Pontianak. */
export function jamStudio(d: Date, zona?: string | null): Jam {
  const tz = zona && ZONA[zona] ? zona : "Asia/Jakarta";
  try {
    const b = Object.fromEntries(
      new Intl.DateTimeFormat("id-ID", {
        timeZone: tz,
        weekday: "long",
        day: "numeric",
        month: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      })
        .formatToParts(d)
        .map((p) => [p.type, p.value]),
    );
    const pendek = `${b.day} ${BULAN[Number(b.month) - 1]} ${b.year}`;
    return { tanggal: `${b.weekday}, ${pendek}`, tanggalPendek: pendek, jam: `${b.hour}.${b.minute} ${ZONA[tz]}` };
  } catch {
    const pendek = `${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}`;
    return {
      tanggal: `${HARI[d.getDay()]}, ${pendek}`,
      tanggalPendek: pendek,
      jam: `${String(d.getHours()).padStart(2, "0")}.${String(d.getMinutes()).padStart(2, "0")}`,
    };
  }
}

/**
 * Waktu sekarang, diperbarui TEPAT di batas menit (bukan tiap 60 detik sejak
 * dipasang — itu bisa terlambat hampir semenit).
 *
 * `tunda`: mulai dari null dan baru diisi sesudah dipasang. Wajib untuk
 * komponen yang dirender di server (rel samping): waktu build bukan waktu
 * pengunjung, dan HTML server yang berbeda dari render pertama klien membuat
 * React membuang pohonnya (jebakan #8).
 */
export function useJam(tunda: true): Date | null;
export function useJam(tunda?: false): Date;
export function useJam(tunda = false): Date | null {
  const [kini, setKini] = useState<Date | null>(() => (tunda ? null : new Date()));
  useEffect(() => {
    if (tunda) setKini(new Date());
    let t = 0;
    const jadwal = () => {
      const d = new Date();
      t = window.setTimeout(
        () => {
          setKini(new Date());
          jadwal();
        },
        60_000 - (d.getSeconds() * 1000 + d.getMilliseconds()) + 40,
      );
    };
    jadwal();
    return () => window.clearTimeout(t);
  }, [tunda]);
  return kini;
}
