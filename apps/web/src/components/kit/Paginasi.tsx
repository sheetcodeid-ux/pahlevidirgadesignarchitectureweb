import { Ikon } from "./Ikon";
import { CaretLeft, CaretRight } from "./ikon";

/* =============================================================================
   Paginasi — frame Pagination.

   Dua versi di Figma: Default (tombol angka 30x28) dan Mobile (32x32 penuh).
   Yang dipilih di sini lewat prop `ponsel`, bukan lewat media query, karena
   paginasi bisa duduk di kolom sempit pada layar lebar juga.

   Daftar nomornya dipotong sendiri: selalu halaman pertama, terakhir, yang
   sedang dibuka, dan satu tetangga di kiri-kanannya; sisanya jadi jeda.
   Frame Figma menggambarkan bentuk itu persis — empat tombol lalu satu jeda.
   ============================================================================= */

function nomor(kini: number, total: number): (number | "jeda")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const inti = [1, total, kini, kini - 1, kini + 1].filter((n) => n >= 1 && n <= total);
  const urut = [...new Set(inti)].sort((a, b) => a - b);
  const out: (number | "jeda")[] = [];
  urut.forEach((n, i) => {
    if (i > 0 && n - urut[i - 1] > 1) out.push("jeda");
    out.push(n);
  });
  return out;
}

export interface PropPaginasi {
  kini: number;
  total: number;
  onPindah: (halaman: number) => void;
  ponsel?: boolean;
  className?: string;
}

export function Paginasi({ kini, total, onPindah, ponsel = false, className }: PropPaginasi) {
  const px = ponsel ? 14 : 12;
  return (
    <nav
      aria-label="Halaman"
      className={["k-paginasi", ponsel && "k-paginasi--ponsel", className].filter(Boolean).join(" ")}
    >
      <button
        type="button"
        className="k-paginasi__b k-paginasi__b--ikon"
        disabled={kini <= 1}
        onClick={() => onPindah(kini - 1)}
        aria-label="Halaman sebelumnya"
      >
        <Ikon ikon={CaretLeft} ukuran={px} />
      </button>

      {nomor(kini, total).map((n, i) =>
        n === "jeda" ? (
          <span key={`jeda${i}`} className="k-paginasi__jeda" aria-hidden="true">
            …
          </span>
        ) : (
          <button
            key={n}
            type="button"
            className="k-paginasi__b"
            aria-current={n === kini ? "page" : undefined}
            onClick={() => onPindah(n)}
          >
            {n}
          </button>
        ),
      )}

      <button
        type="button"
        className="k-paginasi__b k-paginasi__b--ikon"
        disabled={kini >= total}
        onClick={() => onPindah(kini + 1)}
        aria-label="Halaman berikutnya"
      >
        <Ikon ikon={CaretRight} ukuran={px} />
      </button>
    </nav>
  );
}
