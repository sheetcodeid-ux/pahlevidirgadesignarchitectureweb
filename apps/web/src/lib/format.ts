const RUPIAH = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

export function formatRupiah(n: number): string {
  // Intl menyisipkan spasi tak-putus setelah "Rp". Ejaan resmi bahasa
  // Indonesia menulisnya rapat — Rp10.000.000, bukan Rp 10.000.000 — dan
  // itu juga yang diminta pemilik, jadi spasinya dibuang.
  return RUPIAH.format(n).replace(/\u00a0/g, "");
}

/**
 * Rupiah dipendekkan untuk ruang sempit: 532.000.000 -> "Rp532 jt",
 * 18.668.394 -> "Rp18,7 jt", 1.140.000.000 -> "Rp1,1 M".
 *
 * Dipakai di tempat yang kotaknya dirancang untuk "$8,500", bukan untuk
 * "Rp532.000.000" — kartu statistik frame 04 dan kartu piutang di
 * sebelahnya. Angka penuhnya tetap ikut sebagai `title` di pemanggilnya;
 * yang dipendekkan cuma tampilannya. Satu desimal di bawah 100 juta, tanpa
 * desimal di atasnya: "Rp532,4 jt" menambah satu angka yang tidak mengubah
 * keputusan siapa pun, sementara "Rp18,7 jt" lawan "Rp19 jt" memang beda.
 */
export function formatRupiahRingkas(n: number): string {
  const a = Math.abs(n);
  // U+2212, bukan tanda hubung — sama dengan kolom nominal Semua Transaksi.
  const tanda = n < 0 ? "−" : "";
  const koma = (v: number) => v.toFixed(1).replace(/\.0$/, "").replace(".", ",");
  if (a >= 1e9) return `${tanda}Rp${koma(a / 1e9)} M`;
  if (a >= 1e8) return `${tanda}Rp${Math.round(a / 1e6)} jt`;
  if (a >= 1e6) return `${tanda}Rp${koma(a / 1e6)} jt`;
  if (a >= 1e3) return `${tanda}Rp${Math.round(a / 1e3)} rb`;
  return `${tanda}Rp${a}`;
}
