import { useEffect, useState } from "react";
import { Icon } from "./Icon";

type Theme = "dark" | "light";

/**
 * Pengalih tema siang/malam — SATU tombol, bukan dua pilihan bersebelahan.
 *
 * Yang tampil selalu tema yang sedang aktif, dan menekannya membalik ke
 * lawannya. Bentuk dua-pilihan sebelumnya memakan lebar dua kali lipat untuk
 * menyampaikan satu bit yang sama.
 *
 * Dua gerakan yang berbeda dan sengaja dipisah:
 *
 * 1. Ikonnya berputar setengah putaran sambil menyusut lalu tumbuh lagi, tiap
 *    kali ditekan. Dijalankan lewat kunci React yang berganti, bukan lewat
 *    kelas yang ditambah-lepas: elemen dengan kunci baru adalah elemen baru
 *    bagi React, jadi animasinya pasti mulai dari awal — sementara kelas yang
 *    dipasang ulang pada elemen yang sama tidak selalu memulai ulang animasi.
 * 2. Seluruh halaman meluncur antar-warna lewat kelas .theme-switching yang
 *    dipasang sesaat sebelum atribut tema diganti, lalu dilepas lagi supaya
 *    hover dan fokus tetap gesit.
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("dark");
  const [siap, setSiap] = useState(false);
  const [putaran, setPutaran] = useState(0);

  // Nilai awal dibaca dari DOM, bukan dari localStorage: skrip anti-kedip di
  // <head> sudah menetapkannya lebih dulu, dan itulah kebenarannya.
  useEffect(() => {
    const aktif = document.documentElement.getAttribute("data-theme");
    setTheme(aktif === "light" ? "light" : "dark");
    setSiap(true);
  }, []);

  function balik() {
    const baru: Theme = theme === "dark" ? "light" : "dark";
    const root = document.documentElement;
    const diamGerak = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (!diamGerak) {
      root.classList.add("theme-switching");
      window.setTimeout(() => root.classList.remove("theme-switching"), 460);
      setPutaran((n) => n + 1);
    }

    root.setAttribute("data-theme", baru);
    try {
      localStorage.setItem("tema", baru);
    } catch {
      // Mode penyamaran atau penyimpanan diblokir — temanya tetap berubah,
      // hanya tidak diingat untuk kunjungan berikutnya.
    }
    setTheme(baru);
  }

  const gelap = theme === "dark";

  return (
    <button
      type="button"
      className="theme-btn"
      onClick={balik}
      disabled={!siap}
      aria-label={gelap ? "Ganti ke tema terang" : "Ganti ke tema gelap"}
      title={gelap ? "Tema gelap" : "Tema terang"}
    >
      <span className="theme-btn__ikon" key={putaran}>
        <Icon name={gelap ? "moon" : "sun"} size={17} />
      </span>
    </button>
  );
}
