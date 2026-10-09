import { useLayoutEffect, useRef } from "react";

/* =============================================================================
   Angka yang BERHITUNG ke nilai barunya (560 ms) — dipakai Ringkasan (Kurva S)
   dan Dashboard. Satu modul, bukan salinan per halaman (jebakan #32).

   Teksnya ditulis langsung ke DOM per bingkai, jadi halaman pemakainya tidak
   dirender ulang 30 kali. Tidak berhitung saat pertama tampil (`hidup` palsu
   atau nilai pertama), seketika bila gerak dikurangi.
   ============================================================================= */

export const geraknya = () =>
  typeof window !== "undefined" && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function Hitung({
  nilai,
  hidup,
  format,
  className,
  tunda = 0,
}: {
  nilai: number;
  hidup: boolean;
  format: (v: number) => string;
  className?: string;
  /** Jeda sebelum mulai berhitung (ms) — angka lama tetap tampil selama itu. */
  tunda?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const kini = useRef<number | null>(null);
  const fmt = useRef(format);
  fmt.current = format;
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const tulis = (v: number) => {
      const t = fmt.current(v);
      if (el.textContent !== t) el.textContent = t;
    };
    const dari = kini.current;
    if (dari === null || !hidup || !geraknya() || Math.abs(nilai - dari) < 0.005) {
      kini.current = nilai;
      tulis(nilai);
      return;
    }
    let mulai = 0;
    let r = 0;
    const f = (t: number) => {
      if (!mulai) mulai = t;
      const p = Math.min(1, (t - mulai) / 560);
      const v = p < 1 ? dari + (nilai - dari) * (1 - Math.pow(1 - p, 3)) : nilai;
      kini.current = v;
      tulis(v);
      if (p < 1) r = requestAnimationFrame(f);
    };
    let w = 0;
    if (tunda > 0) w = window.setTimeout(() => (r = requestAnimationFrame(f)), tunda);
    else r = requestAnimationFrame(f);
    return () => {
      window.clearTimeout(w);
      cancelAnimationFrame(r);
      kini.current = nilai;
      tulis(nilai);
    };
  }, [nilai, hidup]);
  return <span ref={ref} className={className} />;
}
