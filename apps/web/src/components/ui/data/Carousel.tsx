import { useRef, type ReactNode } from "react";
import { Icon } from "../Icon";

/**
 * Carousel di atas scroll-snap asli.
 *
 * Jempol, roda tetikus, dan panah keyboard sudah bekerja tanpa JavaScript;
 * tombol panah hanya menambah satu cara lagi, bukan menggantikan yang lain.
 * Itu sebabnya track-nya tetap berupa daftar yang bisa digulir, bukan deretan
 * yang diposisikan dengan transform.
 */
export function Carousel({ children, label }: { children: ReactNode; label: string }) {
  const track = useRef<HTMLDivElement>(null);

  function geser(arah: -1 | 1) {
    const el = track.current;
    if (!el) return;
    el.scrollBy({ left: arah * el.clientWidth * 0.8, behavior: "smooth" });
  }

  return (
    <div className="carousel">
      <div className="carousel__track" ref={track} tabIndex={0} role="group" aria-label={label}>
        {children}
      </div>
      <div className="carousel__nav">
        <button type="button" className="btn btn--secondary btn--icon" onClick={() => geser(-1)} aria-label="Geser ke kiri">
          <Icon name="chevronLeft" size={16} />
        </button>
        <button type="button" className="btn btn--secondary btn--icon" onClick={() => geser(1)} aria-label="Geser ke kanan">
          <Icon name="chevronRight" size={16} />
        </button>
      </div>
    </div>
  );
}
