import { useEffect, useState } from "react";
import { Icon } from "./Icon";

type Theme = "dark" | "light";

/**
 * Pengalih tema siang/malam.
 *
 * Pemasangan kelas .theme-switching sesaat sebelum atribut diganti membuat
 * seluruh halaman meluncur antar-warna, bukan berkedip. Kelasnya dilepas lagi
 * setelah transisi selesai supaya interaksi lain (hover, fokus) tetap gesit.
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("dark");
  const [siap, setSiap] = useState(false);

  // Nilai awal dibaca dari DOM, bukan dari localStorage: skrip anti-kedip di
  // <head> sudah menetapkannya lebih dulu, dan itulah kebenarannya.
  useEffect(() => {
    const aktif = document.documentElement.getAttribute("data-theme");
    setTheme(aktif === "light" ? "light" : "dark");
    setSiap(true);
  }, []);

  function ganti(baru: Theme) {
    if (baru === theme) return;

    const root = document.documentElement;
    const diamGerak = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (!diamGerak) {
      root.classList.add("theme-switching");
      window.setTimeout(() => root.classList.remove("theme-switching"), 460);
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
    <div
      className="theme-toggle"
      role="radiogroup"
      aria-label="Tema tampilan"
      data-theme-state={theme}
    >
      {/* Penanda geser; posisinya mengikuti data-theme-state pada induk. */}
      <span className="theme-toggle__thumb" aria-hidden="true" />

      <button
        type="button"
        role="radio"
        aria-checked={gelap}
        aria-label="Tema gelap"
        className="theme-toggle__opt"
        onClick={() => ganti("dark")}
        disabled={!siap}
      >
        <Icon name="moon" size={16} />
      </button>

      <button
        type="button"
        role="radio"
        aria-checked={!gelap}
        aria-label="Tema terang"
        className="theme-toggle__opt"
        onClick={() => ganti("light")}
        disabled={!siap}
      >
        <Icon name="sun" size={16} />
      </button>
    </div>
  );
}
