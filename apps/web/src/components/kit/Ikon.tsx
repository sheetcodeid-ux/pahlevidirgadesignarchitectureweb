import type { DataIkon } from "./ikon/daftar";

/* =============================================================================
   Ikon — 179 bentuk asli dari file Figma Coinest, bukan pustaka pihak ketiga,
   ditambah 38 bentuk ARSITEKTUR buatan studio sendiri (`ikon/arsitektur.ts`,
   dipakai rel samping, kepala halaman, dan palet perintah) — digambar dari
   benda studio,
   bukan jiplakan ikon siapa pun.

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

/* SATU objek `{ __html }` per ikon, bukan objek baru tiap render. React 19
   membandingkan prop ini menurut IDENTITAS objek, dan objek baru berarti
   `innerHTML` ditulis ulang — seluruh <path> ikonnya dibuang dan dibuat lagi
   setiap kali komponen pemakainya digambar ulang. Akibatnya animasi yang
   sedang berjalan di garis ikon putus atau mulai dari awal: lengan lampu
   tema tidak pernah berayun (penangan kliknya menganimasikan elemen yang
   sesaat kemudian dibuang), dan pena di rel bisa menggambar ulang di tengah
   jalan. WeakMap supaya ikon yang tidak dipakai lagi tetap bisa dibuang. */
const HTML_IKON = new WeakMap<DataIkon, { __html: string }>();
function htmlIkon(ikon: DataIkon): { __html: string } {
  let h = HTML_IKON.get(ikon);
  if (!h) {
    h = { __html: ikon.isi };
    HTML_IKON.set(ikon, h);
  }
  return h;
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
      dangerouslySetInnerHTML={htmlIkon(ikon)}
    />
  );
}

export type { DataIkon };
