import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Ikon, type DataIkon } from "./Ikon";

/* =============================================================================
   Tombol — frame Button di file Figma Coinest.

   Empat jenis dan tiga ukuran, persis seperti matriks variannya:

     Type = Primary | Secondary | Ghost | Transparent
     Size = small | Medium | Large
     With Icon = No Icon | Left | Right | Left & Right

   "With Icon" tidak jadi prop tersendiri di sini: ada-tidaknya ikon sudah
   terbaca dari `kiri` dan `kanan`. Satu prop yang bisa berbohong tentang isi
   komponennya sendiri hanya menambah cara untuk salah.

   Ukuran ikonnya ikut ukuran tombol dan TIDAK bisa disetel dari luar —
   angkanya dari Figma, dan yang paling mudah membuat tombol terbaca berbeda
   adalah ikon yang ukurannya dikarang pemanggil.
   ============================================================================= */

export type UkuranTombol = "small" | "medium" | "large";
export type JenisTombol = "primary" | "secondary" | "ghost" | "transparent";

/** Terukur dari lebar gambar instance dibagi gambar masternya, dikali 32. */
const IKON_PX: Record<UkuranTombol, number> = { small: 12, medium: 14, large: 16 };

export interface PropTombol extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type"> {
  children?: ReactNode;
  ukuran?: UkuranTombol;
  jenis?: JenisTombol;
  kiri?: DataIkon;
  kanan?: DataIkon;
  /** type HTML-nya; dinamai begini supaya tidak bentrok dengan `jenis`. */
  tipeHtml?: "button" | "submit" | "reset";
}

export function Tombol({
  children,
  ukuran = "medium",
  jenis = "primary",
  kiri,
  kanan,
  tipeHtml = "button",
  className,
  ...sisa
}: PropTombol) {
  const px = IKON_PX[ukuran];
  const kelas = ["k-tombol", `k-tombol--${ukuran}`, `k-tombol--${jenis}`, className]
    .filter(Boolean)
    .join(" ");
  return (
    <button type={tipeHtml} className={kelas} {...sisa}>
      {kiri && <Ikon ikon={kiri} ukuran={px} />}
      {children}
      {kanan && <Ikon ikon={kanan} ukuran={px} />}
    </button>
  );
}

/* -----------------------------------------------------------------------------
   Tombol Ikon — keluarga "Button Icon". Bujur sangkar, tanpa label.

   `judul` WAJIB: tombol tanpa teks tidak punya nama yang bisa dibacakan
   pembaca layar, dan ikon di dalamnya sudah aria-hidden. Bukan prop opsional
   yang biasanya diisi — prop opsional yang biasanya diisi adalah prop yang
   suatu saat lupa diisi.
   -------------------------------------------------------------------------- */
export type UkuranTombolIkon = "xsmall" | "small" | "medium" | "large";

const IKON_PX_KOTAK: Record<UkuranTombolIkon, number> = {
  xsmall: 10,
  small: 12,
  medium: 14,
  large: 16,
};

export interface PropTombolIkon extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type"> {
  ikon: DataIkon;
  judul: string;
  ukuran?: UkuranTombolIkon;
  jenis?: JenisTombol;
  tipeHtml?: "button" | "submit" | "reset";
}

export function TombolIkon({
  ikon,
  judul,
  ukuran = "medium",
  jenis = "primary",
  tipeHtml = "button",
  className,
  ...sisa
}: PropTombolIkon) {
  const kelas = [
    "k-tombolikon",
    `k-tombolikon--${ukuran}`,
    `k-tombol--${jenis}`,
    className,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <button type={tipeHtml} className={kelas} aria-label={judul} title={judul} {...sisa}>
      <Ikon ikon={ikon} ukuran={IKON_PX_KOTAK[ukuran]} />
    </button>
  );
}
