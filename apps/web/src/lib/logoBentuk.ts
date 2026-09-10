/**
 * Mengelompokkan logo klien menurut bentuknya.
 *
 * Satu batas ukuran untuk semua logo TERLIHAT tidak konsisten, dan itu bukan
 * perasaan: wordmark panjang berhenti di batas lebar sementara logo petak
 * berhenti di batas tinggi, jadi yang petak tampil sebagai benda mungil di
 * sebelah tetangganya walau berkas aslinya sama besar. Yang menyamakannya
 * bukan satu angka melainkan angka per bentuk.
 *
 * Berkas ini ada supaya ambangnya HANYA punya satu tempat tinggal. Marquee di
 * beranda dan pratinjau di /admin/klien harus mengelompokkan logo yang sama ke
 * kelas yang sama — kalau tidak, pemilik menyetujui satu ukuran di panel lalu
 * mendapat ukuran lain di situs, dan itu persis keluhan yang membuat kelas ini
 * dibuat. Dua salinan ambang pasti menyimpang; satu tidak bisa.
 */
export type BentukLogo = "lebar" | "sedang" | "petak";

/**
 * `lebar` = wordmark memanjang (rasio >= 3:1), `petak` = kotak atau menjulang
 * (< 1,4:1), sisanya `sedang`. Angkanya diturunkan dari logo yang sudah
 * diunggah pemilik: wordmark kopi ada di 4-5:1, lockup bergambar di sekitar
 * 2:1, dan maskot di sekitar 1:1.
 */
export function bentukLogo(lebar: number, tinggi: number): BentukLogo {
  if (!lebar || !tinggi) return "sedang";
  const rasio = lebar / tinggi;
  if (rasio >= 3) return "lebar";
  if (rasio >= 1.4) return "sedang";
  return "petak";
}
