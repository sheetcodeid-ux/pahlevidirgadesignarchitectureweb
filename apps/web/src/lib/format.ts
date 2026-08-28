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
