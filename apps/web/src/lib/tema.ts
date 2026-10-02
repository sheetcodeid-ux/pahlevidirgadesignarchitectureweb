/* Ganti tema terang/gelap — SATU tempat, dipakai tombol di navbar dan butir
   "Ganti tema" di palet perintah. Atribut di <html> yang menentukan; pilihan
   disimpan supaya halaman berikutnya terbuka dengan tema yang sama (skrip
   kepala KitLayout membacanya sebelum paint). Mengabarkan perubahannya
   lewat `kit:tema` supaya tombol yang menampilkan keadaannya ikut berganti. */
export const PERISTIWA_TEMA = "kit:tema";

export function temaGelap(): boolean {
  return document.documentElement.getAttribute("data-theme") === "dark";
}

export function gantiTema(): void {
  const baru = temaGelap() ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", baru);
  try {
    localStorage.setItem("tema", baru);
  } catch {
    /* penyimpanan diblokir: temanya tetap berganti untuk halaman ini */
  }
  window.dispatchEvent(new CustomEvent(PERISTIWA_TEMA, { detail: baru }));
}
