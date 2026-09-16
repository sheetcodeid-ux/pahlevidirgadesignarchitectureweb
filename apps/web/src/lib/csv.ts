/**
 * Unduh CSV dari daftar baris.
 *
 * Diangkat dari FinancePanel karena halaman Fee memerlukan yang sama persis.
 * Disalin akan berarti dua fungsi yang isinya sama — dan yang pertama lupa
 * diperbaiki saat yang kedua diperbaiki adalah pola yang sudah berkali-kali
 * memakan waktu di proyek ini.
 */
export function unduhCsv(nama: string, baris: string[][]) {
  const isi = baris
    .map((r) => r.map((sel) => `"${String(sel).replace(/"/g, '""')}"`).join(";"))
    .join("\r\n");
  // BOM supaya Excel berbahasa Indonesia membaca UTF-8 dengan benar; tanpa
  // ini "Rp" dan tanda minus tipografis tampil sebagai sampah.
  const blob = new Blob([`﻿${isi}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nama;
  a.click();
  URL.revokeObjectURL(url);
}
