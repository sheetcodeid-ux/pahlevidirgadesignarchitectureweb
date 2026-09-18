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

/**
 * Nomor yang ditampilkan, plus jeda di tempat yang dilompati.
 *
 * `lebar` adalah JUMLAH nomor berurutan di sekitar halaman yang sedang dibuka,
 * dan jumlah itu dijaga tetap — kalau halaman yang dibuka mepet ke ujung,
 * jendelanya digeser, bukan dipendekkan. Itu yang membuat lebar paginasi tidak
 * berubah-ubah saat dipakai, dan itu juga bentuk yang digambar Figma: halaman
 * pertama dari dua belas tampil sebagai 1 2 3 … 12, bukan 1 2 … 12.
 */
function nomor(kini: number, total: number, lebar: number): (number | "jeda")[] {
  if (total <= lebar + 3) return Array.from({ length: total }, (_, i) => i + 1);

  let dari = Math.max(1, kini - Math.floor((lebar - 1) / 2));
  let sampai = dari + lebar - 1;
  if (sampai > total) {
    sampai = total;
    dari = Math.max(1, sampai - lebar + 1);
  }

  const urut = [...new Set([1, ...Array.from({ length: sampai - dari + 1 }, (_, i) => dari + i), total])]
    .sort((a, b) => a - b);

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
  const px = ponsel ? 16 : 14;
  /* Versi ponsel menampilkan satu nomor lebih banyak — terukur dari lebar
     framenya: 312 = 8 slot berjarak 8, lawan 254 = 7 slot. */
  const lebar = ponsel ? 4 : 3;
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

      {nomor(kini, total, lebar).map((n, i) =>
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
