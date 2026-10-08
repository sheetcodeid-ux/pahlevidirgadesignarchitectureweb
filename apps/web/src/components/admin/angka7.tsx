/* =============================================================================
   Angka tujuh-segmen untuk layar VFD — dipakai mesin kas (Kas Studio) dan
   layar potret panel kendali (KPI Strategi). Satu modul, bukan salinan per
   halaman (jebakan #32). `kelas` menamai svg-nya; dua path-nya bernama
   `${kelas}mati` dan `${kelas}nyala`.
   ============================================================================= */

/* ---- Layar tujuh-segmen --------------------------------------------------------
   Angka layar digambar sebagai sel tujuh-segmen seperti layar VFD mesin kas:
   tiap sel menggambar SEMUA segmennya — yang mati sebagai "8" hantu, yang
   menyala berpijar. Titik ribuan rupiah jatuh tepat di titik desimal sel
   sebelumnya, persis seperti mesin kas sungguhan. Dua <path> saja (mati,
   nyala), jadi menghitung tiap frame tetap murah. */
const SEG7: Record<string, string> = {
  "0": "abcdef",
  "1": "bc",
  "2": "abged",
  "3": "abgcd",
  "4": "fgbc",
  "5": "afgcd",
  "6": "afgedc",
  "7": "abc",
  "8": "abcdefg",
  "9": "abcdfg",
  "-": "g",
};
const S7 = { w: 20, h: 38, t: 3.8, g: 0.9, langkah: 27 };

function segmen(k: string, ox: number): string {
  const { w, h, t, g } = S7;
  const m = t / 2;
  const kiri = ox + m;
  const kanan = ox + w - m;
  const datar = (x0: number, x1: number, y: number) =>
    `M${x0} ${y}L${x0 + m} ${y - m}L${x1 - m} ${y - m}L${x1} ${y}L${x1 - m} ${y + m}L${x0 + m} ${y + m}Z`;
  const tegak = (x: number, y0: number, y1: number) =>
    `M${x} ${y0}L${x + m} ${y0 + m}L${x + m} ${y1 - m}L${x} ${y1}L${x - m} ${y1 - m}L${x - m} ${y0 + m}Z`;
  switch (k) {
    case "a": return datar(kiri + g, kanan - g, m);
    case "g": return datar(kiri + g, kanan - g, h / 2);
    case "d": return datar(kiri + g, kanan - g, h - m);
    case "f": return tegak(kiri, m + g, h / 2 - g);
    case "b": return tegak(kanan, m + g, h / 2 - g);
    case "e": return tegak(kiri, h / 2 + g, h - m - g);
    default: return tegak(kanan, h / 2 + g, h - m - g);
  }
}

export function Angka7({ teks, sel = 10, kelas = "ksr__7" }: { teks: string; sel?: number; kelas?: string }) {
  const isi: { c: string; titik: boolean }[] = [];
  for (const c of teks) {
    if (c === ".") {
      const akhir = isi[isi.length - 1];
      if (akhir) akhir.titik = true;
    } else isi.push({ c, titik: false });
  }
  const n = Math.max(sel, isi.length);
  const semua = [...Array.from({ length: n - isi.length }, () => ({ c: " ", titik: false })), ...isi];
  let nyala = "";
  let mati = "";
  semua.forEach((s, i) => {
    const ox = i * S7.langkah;
    const lit = SEG7[s.c] ?? "";
    for (const k of "abcdefg") {
      if (lit.includes(k)) nyala += segmen(k, ox);
      else mati += segmen(k, ox);
    }
    const x = ox + S7.w + 2.2;
    const y = S7.h - S7.t;
    const titik = `M${x} ${y}h${S7.t}v${S7.t}h${-S7.t}Z`;
    if (s.titik) nyala += titik;
    else mati += titik;
  });
  return (
    <svg className={kelas} viewBox={`0 -1 ${n * S7.langkah + 4} ${S7.h + 2}`} aria-hidden="true" focusable="false">
      {/* Miring 6° seperti huruf layar VFD; digeser 4 supaya kaki sel
          pertama tidak keluar kotak. */}
      <g transform="translate(4 0) skewX(-6)">
        <path className={`${kelas}mati`} d={mati} />
        <path className={`${kelas}nyala`} d={nyala} />
      </g>
    </svg>
  );
}
