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

/* Pilihan tema di halaman Akun: terang, gelap, atau IKUTI SISTEM. Yang
   terakhir = tidak ada pilihan tersimpan, jadi skrip kepala KitLayout
   jatuh ke `prefers-color-scheme` — persis keadaan sebelum orang pernah
   menekan tombol tema di navbar. */
export type PilihanTema = "light" | "dark" | "sistem";

export function pilihanTema(): PilihanTema {
  try {
    const t = localStorage.getItem("tema");
    return t === "light" || t === "dark" ? t : "sistem";
  } catch {
    return "sistem";
  }
}

export function pilihTema(p: PilihanTema): void {
  const terap =
    p === "sistem" ? (window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark") : p;
  try {
    if (p === "sistem") localStorage.removeItem("tema");
    else localStorage.setItem("tema", p);
  } catch {
    /* penyimpanan diblokir: temanya tetap berganti untuk halaman ini */
  }
  document.documentElement.setAttribute("data-theme", terap);
  window.dispatchEvent(new CustomEvent(PERISTIWA_TEMA, { detail: terap }));
}
