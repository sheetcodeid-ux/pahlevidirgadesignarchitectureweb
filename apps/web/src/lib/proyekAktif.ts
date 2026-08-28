/**
 * Proyek yang sedang dibuka — dipilih lewat combobox di topbar, dipakai oleh
 * tiga halaman proyek di sidebar.
 *
 * Disimpan di localStorage, bukan di URL. Alasannya: situs ini statis, jadi
 * setiap halaman adalah dokumen terpisah yang dimuat ulang penuh. Kalau id-nya
 * hidup di query string, tiap perpindahan halaman harus membawanya sendiri —
 * dan satu tautan yang lupa membawanya membuat penggunanya mendarat di
 * halaman kosong tanpa tahu sebabnya. Di localStorage, pilihannya bertahan
 * ke mana pun ia berpindah sampai ia memilih yang lain.
 *
 * Konsekuensi yang diterima: tautan ke halaman proyek tidak bisa dibagikan
 * dengan proyeknya ikut. Untuk panel yang dipakai dua orang di satu studio,
 * itu tidak pernah dibutuhkan.
 */

const KUNCI = "pd-proyek-aktif";
const PERISTIWA = "pd-proyek-aktif-berubah";

export function proyekAktif(): string | null {
  try {
    return localStorage.getItem(KUNCI);
  } catch {
    return null;
  }
}

export function setProyekAktif(id: string | null) {
  try {
    if (id) localStorage.setItem(KUNCI, id);
    else localStorage.removeItem(KUNCI);
  } catch {
    // Penyimpanan diblokir; pilihannya hanya bertahan selama halaman terbuka.
  }
  // localStorage tidak memicu event di tab yang menulisnya sendiri, jadi
  // peristiwa sendiri yang memberi tahu komponen lain di halaman yang sama.
  window.dispatchEvent(new CustomEvent(PERISTIWA, { detail: id }));
}

/** Berlangganan perubahan, termasuk yang datang dari tab lain. */
export function onProyekAktif(cb: (id: string | null) => void): () => void {
  const lokal = (e: Event) => cb((e as CustomEvent<string | null>).detail);
  const antarTab = (e: StorageEvent) => { if (e.key === KUNCI) cb(e.newValue); };

  window.addEventListener(PERISTIWA, lokal);
  window.addEventListener("storage", antarTab);
  return () => {
    window.removeEventListener(PERISTIWA, lokal);
    window.removeEventListener("storage", antarTab);
  };
}

/** Ketiga halaman yang bergantung pada proyek yang sedang dibuka. */
export const HALAMAN_PROYEK = ["/admin/proyek/publik", "/admin/proyek/klien", "/admin/proyek/internal"];

/**
 * Membuka sebuah proyek: menetapkannya aktif lalu pindah halaman kalau perlu.
 * Kalau sudah berada di salah satu halaman proyek, tetap di situ — isinya yang
 * berganti, bukan halamannya.
 */
export function bukaProyek(id: string) {
  setProyekAktif(id);
  if (!HALAMAN_PROYEK.includes(window.location.pathname.replace(/\/+$/, ""))) {
    window.location.href = HALAMAN_PROYEK[0];
  }
}
