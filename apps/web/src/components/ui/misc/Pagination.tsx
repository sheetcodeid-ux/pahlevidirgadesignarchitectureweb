import { Icon } from "../Icon";

interface Props {
  halaman: number;
  total: number;
  onChange: (h: number) => void;
}

/**
 * Menyusun daftar nomor halaman dengan elipsis.
 *
 * Halaman pertama dan terakhir selalu terlihat supaya lompat ke ujung tidak
 * butuh menebak; sekitar halaman aktif ditampilkan satu tetangga di tiap sisi.
 */
function nomor(halaman: number, total: number): (number | "gap")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const dekat = [halaman - 1, halaman, halaman + 1].filter((n) => n > 1 && n < total);
  const out: (number | "gap")[] = [1];

  if (dekat[0] > 2) out.push("gap");
  out.push(...dekat);
  if (dekat[dekat.length - 1] < total - 1) out.push("gap");
  out.push(total);

  return out;
}

export function Pagination({ halaman, total, onChange }: Props) {
  return (
    <nav className="pagination" aria-label="Navigasi halaman">
      <button
        type="button"
        className="pagination__page"
        onClick={() => onChange(halaman - 1)}
        disabled={halaman === 1}
        aria-label="Halaman sebelumnya"
      >
        <Icon name="chevronLeft" size={16} />
      </button>

      {nomor(halaman, total).map((n, i) =>
        n === "gap" ? (
          <span key={`gap-${i}`} className="pagination__gap" aria-hidden="true">…</span>
        ) : (
          <button
            key={n}
            type="button"
            className="pagination__page"
            aria-current={n === halaman ? "page" : undefined}
            aria-label={`Halaman ${n}`}
            onClick={() => onChange(n)}
          >
            {n}
          </button>
        ),
      )}

      <button
        type="button"
        className="pagination__page"
        onClick={() => onChange(halaman + 1)}
        disabled={halaman === total}
        aria-label="Halaman berikutnya"
      >
        <Icon name="chevronRight" size={16} />
      </button>
    </nav>
  );
}
