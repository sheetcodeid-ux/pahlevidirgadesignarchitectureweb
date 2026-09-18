import type { DataIkon } from "./ikon/daftar";

/* =============================================================================
   Ikon — 179 bentuk asli dari file Figma Coinest, bukan pustaka pihak ketiga.

   Ukuran BAWAAN 24, karena itu ukuran instance yang dipakai Coinest di
   halaman. Bingkai masternya 32 (lihat assets/figma/DAFTAR.md); yang disetel
   di sini ukuran tampilnya, sementara viewBox-nya tetap milik Figma.

   Atribut width DAN height selalu ditulis — jebakan #7 di CLAUDE.md
   menggantung padanya: `svg[width][height] { flex: none; max-width: none }`
   yang menjaga ikon tidak menyusut jadi 0x0 di kolom sempit.
   ============================================================================= */

export interface PropIkon {
  ikon: DataIkon;
  /** Ukuran tampil dalam piksel. Coinest memakai 10 / 12 / 14 / 16 / 20 / 24. */
  ukuran?: number;
  /** Tebal garis tidak ada di sini — ikon Coinest bentuk isi, bukan garis. */
  className?: string;
  /** Diisi kalau ikon berdiri sendiri tanpa teks di sebelahnya. */
  judul?: string;
}

export function Ikon({ ikon, ukuran = 24, className, judul }: PropIkon) {
  return (
    <svg
      width={ukuran}
      height={ukuran}
      viewBox={ikon.vb}
      fill="none"
      className={className}
      role={judul ? "img" : undefined}
      aria-label={judul}
      aria-hidden={judul ? undefined : true}
      focusable="false"
      dangerouslySetInnerHTML={{ __html: ikon.isi }}
    />
  );
}

export type { DataIkon };
