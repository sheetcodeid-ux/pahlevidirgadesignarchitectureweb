import type { ReactNode } from "react";
import type { Proyek } from "../../lib/admin";

/* =============================================================================
   Punggung ordner proyek — SATU bentuk untuk rak Semua Proyek dan pratinjau
   ordner di Proyek Baru (jebakan #32). Yang dilihat staf saat mengetik surat
   perjanjian harus persis yang nanti berdiri di rak, jadi isinya ditulis di
   sini dan gayanya hidup di `ordner-kit.css` (dimuat kedua halaman).

   Pemanggil yang menentukan pembungkusnya (`<button>` di rak, `<div>` di
   pratinjau) beserta kelas `ord__ordner` dan variabel `--ord-rona` /
   `--ord-isi`; komponen ini hanya isi punggungnya.
   ============================================================================= */

/** Tiga rona punggung menurut JENIS proyek — rona, bukan warna makna. */
export const RONA: Record<string, number> = {
  residential: 0,
  commercial: 1,
  coffeeshop: 2,
  hospitality: 2,
  interior: 1,
  renovation: 0,
  landscape: 2,
  masterplan: 1,
};

/** Tahun rak sebuah proyek: tahun selesai, atau tahun terbit kalau kosong. */
export const tahunProyek = (p: Pick<Proyek, "year" | "publishedAt">) =>
  p.year ?? (p.publishedAt ? Number(p.publishedAt.slice(0, 4)) : null);

/** Urutan rak: TAHUN dulu (terbaru kiri), lalu yang terbit lebih baru.
 *  Proyek Baru memakai urutan yang sama untuk menunjukkan di mana ordnernya
 *  nanti berdiri. */
export const bandingRak = (a: Pick<Proyek, "year" | "publishedAt">, b: Pick<Proyek, "year" | "publishedAt">) =>
  (tahunProyek(b) ?? 0) - (tahunProyek(a) ?? 0) || (b.publishedAt ?? "").localeCompare(a.publishedAt ?? "");

export function IsiPunggung({
  kode,
  judul,
  tahap,
  sampulUrl,
  huruf,
  judulKosong,
}: {
  kode: ReactNode;
  judul: ReactNode;
  tahap: ReactNode;
  sampulUrl?: string | null;
  /** Huruf jenis di jendela foto kalau belum ada sampul. */
  huruf: string;
  /** Judul belum diketik: kantong menulisnya dengan pensil. */
  judulKosong?: boolean;
}) {
  return (
    <>
      <span className={`ord__jendela${sampulUrl ? "" : " is-kosong"}`}>
        {sampulUrl ? <img src={sampulUrl} alt="" loading="lazy" decoding="async" /> : <span>{huruf}</span>}
      </span>
      <span className="ord__kantong">
        <b>{kode}</b>
        <span className={`ord__judultegak${judulKosong ? " is-pensil" : ""}`}>{judul}</span>
        <small>{tahap}</small>
      </span>
      <i className="ord__lubang" aria-hidden="true" />
      <i className="ord__meter" aria-hidden="true" />
    </>
  );
}
