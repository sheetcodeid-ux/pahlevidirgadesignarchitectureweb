import { useId, type InputHTMLAttributes, type ReactNode } from "react";
import { Ikon, type DataIkon } from "./Ikon";
import { MagnifyingGlass } from "./ikon";

/* =============================================================================
   Isian — frame Forms.

   Semuanya memakai elemen HTML ASLI yang digambar ulang, bukan div ber-role:
   <input type=search>, <input type=checkbox>. Perilaku bawaannya — label yang
   bisa diklik, spasi untuk mencentang, ikut terkirim bersama form, tombol
   hapus di peramban — tidak bisa rusak diam-diam, dan itu alasan yang sama
   dengan yang dipakai <details> untuk akordeon di situs publik.
   ============================================================================= */

export type UkuranCari = "small" | "medium" | "large";
const IKON_CARI: Record<UkuranCari, number> = { small: 14, medium: 16, large: 18 };

export interface PropCari extends Omit<InputHTMLAttributes<HTMLInputElement>, "size" | "type"> {
  ukuran?: UkuranCari;
  /** Wajib: kotak cari tanpa nama tidak bisa dibacakan pembaca layar. */
  judul: string;
}

/**
 * Memisahkan atribut data-* dari sisa prop.
 *
 * Pada kontrol gabungan seperti kotak cari, KOTAKNYA adalah komponen dan
 * <input> di dalamnya cuma bagian. Jadi data-* (dan className) menempel di
 * kotak, sementara value/placeholder/onChange tetap ke input. Tanpa
 * pemisahan ini, data-* mendarat di input — dan yang terukur jadi tinggi
 * baris teks, bukan tinggi komponennya.
 */
function pisahData<T extends Record<string, unknown>>(prop: T) {
  const data: Record<string, unknown> = {};
  const sisa: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(prop)) {
    (k.startsWith("data-") ? data : sisa)[k] = v;
  }
  return { data, sisa: sisa as T };
}

/** Ikonnya di KANAN, seperti di Figma — bukan di kiri seperti kebiasaan umum. */
export function Cari({ ukuran = "medium", judul, className, ...prop }: PropCari) {
  const { data, sisa } = pisahData(prop);
  return (
    <div className={["k-cari", `k-cari--${ukuran}`, className].filter(Boolean).join(" ")} {...data}>
      <input type="search" className="k-cari__input" aria-label={judul} {...sisa} />
      <Ikon ikon={MagnifyingGlass} ukuran={IKON_CARI[ukuran]} />
    </div>
  );
}

export interface PropIsian extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  label: string;
  bantu?: string;
  kiri?: DataIkon;
  /** Tombol atau ikon di ujung kanan kotak — lampiran, mata sandi, satuan. */
  kanan?: ReactNode;
}

export function Isian({ label, bantu, kiri, kanan, className, id, ...sisa }: PropIsian) {
  const otomatis = useId();
  const kunci = id ?? otomatis;
  const bantuId = bantu ? `${kunci}-bantu` : undefined;
  return (
    <div className={["k-isian", className].filter(Boolean).join(" ")}>
      <label className="k-isian__label" htmlFor={kunci}>
        {label}
      </label>
      <div className="k-isian__kotak">
        {kiri && <Ikon ikon={kiri} ukuran={18} />}
        <input id={kunci} className="k-isian__input" aria-describedby={bantuId} {...sisa} />
        {kanan}
      </div>
      {bantu && (
        <p id={bantuId} className="k-isian__bantu">
          {bantu}
        </p>
      )}
    </div>
  );
}

export type UkuranCentang = "default" | "medium" | "big";

export interface PropCentang extends Omit<InputHTMLAttributes<HTMLInputElement>, "size" | "type"> {
  ukuran?: UkuranCentang;
}

export function Centang({ ukuran = "default", className, ...sisa }: PropCentang) {
  return (
    <input
      type="checkbox"
      className={["k-centang", `k-centang--${ukuran}`, className].filter(Boolean).join(" ")}
      {...sisa}
    />
  );
}

export interface PropSakelar extends Omit<InputHTMLAttributes<HTMLInputElement>, "size" | "type"> {
  /** Wajib: sakelar tanpa nama tidak bisa dibacakan pembaca layar. */
  judul: string;
}

export function Sakelar({ judul, className, ...sisa }: PropSakelar) {
  return (
    <input
      type="checkbox"
      role="switch"
      aria-label={judul}
      className={["k-sakelar", className].filter(Boolean).join(" ")}
      {...sisa}
    />
  );
}
