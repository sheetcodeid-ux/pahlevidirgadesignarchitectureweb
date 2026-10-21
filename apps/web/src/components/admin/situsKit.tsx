/* =============================================================================
   Sisa kerangka "Situs Publik". Halaman-halamannya (Logo Klien, Tim Studio,
   Sebelum & Sesudah, Angka di FAQ, Privasi, Identitas Studio) dibuang bersama
   kategori Konten Situs pada Okt 2026 — yang tersisa cuma penanda simpan,
   dipakai Akun, Info Studio, dan Aturan Fee Tim. Gayanya `.pf__penanda` di
   `proyekform-kit.css`.
   ============================================================================= */

/** Penanda simpan di bawah tombol: titik hijau = tersimpan, amber = belum. */
export function PenandaSimpan({ n, teks }: { n: number; teks?: string }) {
  return (
    <p className={`pf__penanda${n > 0 ? " pf__penanda--belum" : ""}`}>
      <span aria-hidden="true" />
      {teks ?? (n > 0 ? `${n} perubahan belum disimpan` : "Semua perubahan tersimpan")}
    </p>
  );
}
