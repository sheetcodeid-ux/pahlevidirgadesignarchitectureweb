/* =============================================================================
   Nomor dokumen keuangan — satu sumber untuk kuitansi fee (FP-KKR-15) dan
   surat tagihan (TG-KKR-02). Dua halaman yang menurunkan kode proyek
   sendiri-sendiri pasti suatu saat menulis kode berbeda untuk proyek yang
   sama (jebakan #32).
   ============================================================================= */

/** Huruf depan tiap kata judul proyek — "Kedai Kopi Ruas" → KKR. */
export function kodeProyek(judul: string): string {
  const k = judul
    .split(/\s+/)
    .filter((w) => /^[A-Za-z]/.test(w))
    .slice(0, 3)
    .map((w) => w[0]!.toUpperCase())
    .join("");
  return k || "PR";
}

/** Dua huruf depan nama — "Dirga Pahlevi" → DP. */
export function inisial(nama: string): string {
  return nama
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}
