/* =============================================================================
   Nomor telepon Indonesia untuk wa.me — satu sumber untuk slip gaji (Bayaran
   Tim) dan brief awal (Pesan Masuk). Dua salinan pasti menyimpang (jebakan
   #32): yang satu menerima "+62 812…", yang lain tidak.
   ============================================================================= */

/** "0812-3456-7890" / "+62 812…" / "812…" → "62812…"; null kalau terlalu pendek. */
export function nomorWa(telepon: string | null | undefined): string | null {
  const d = (telepon ?? "").replace(/\D/g, "");
  if (d.length < 9) return null;
  if (d.startsWith("62")) return d;
  if (d.startsWith("0")) return `62${d.slice(1)}`;
  if (d.startsWith("8")) return `62${d}`;
  return d;
}

/** "6281312345678" → "+62 813-1234-5678", untuk dibaca, bukan untuk dikirim. */
export function tampilWa(n: string): string {
  const s = n.slice(2);
  return `+62 ${s.slice(0, 3)}-${s.slice(3, 7)}-${s.slice(7)}`;
}
