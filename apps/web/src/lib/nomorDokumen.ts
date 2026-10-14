/* =============================================================================
   Nomor dokumen — satu sumber untuk kuitansi fee (FP-KKR-15), surat tagihan
   (TG-KKR-02), dan agenda surat masuk (SM-2610-04). Dua halaman yang
   menurunkan nomor sendiri-sendiri pasti suatu saat menulis nomor berbeda
   untuk benda yang sama (jebakan #32).
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

/** Nomor agenda surat masuk SM-YYMM-NN: urutan surat itu di antara SEMUA
    pesan yang masuk pada bulan yang sama, menurut waktu masuknya — nomor
    yang diturunkan dari data, seperti BKM/BKK di Kas Studio, bukan nomor
    karangan. Dihitung dari daftar LENGKAP, jadi surat yang sudah selesai ikut
    memakan nomornya; panel Pesan di kepala halaman dan halaman Pesan Masuk
    memakai fungsi ini supaya satu surat tidak punya dua nomor. */
export function nomorAgenda(semua: readonly { id: string; createdAt: string }[]): Map<string, string> {
  const hasil = new Map<string, string>();
  const perBulan = new Map<string, { id: string; createdAt: string }[]>();
  for (const p of semua) {
    const d = new Date(p.createdAt);
    const k = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, "0")}`;
    perBulan.set(k, [...(perBulan.get(k) ?? []), p]);
  }
  for (const [k, isi] of perBulan) {
    isi
      .slice()
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .forEach((p, i) => hasil.set(p.id, `SM-${k}-${String(i + 1).padStart(2, "0")}`));
  }
  return hasil;
}
