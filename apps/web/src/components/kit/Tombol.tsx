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

/* Ukuran ikon = tinta instance / tinta MASTER ikon itu sendiri * 32.
   Lebar tinta master BEDA-BEDA per ikon — CalendarBlank 24, ChatTeardropDots
   25, MagnifyingGlass 26, Nav/SquaresFour 22, CaretDown 18. Sempat saya kira
   24 untuk semuanya, dan akibatnya hampir setiap ikon di kit 2px kekecilan. */
const IKON_PX: Record<UkuranTombol, number> = { small: 12, medium: 14, large: 16 };

/* Caret di KANAN ukurannya sendiri: 12 / 14 / 14 — pada Large ia TIDAK ikut
   naik jadi 16 seperti ikon kirinya. Terukur di ketiga ukuran. */
const CARET_PX: Record<UkuranTombol, number> = { small: 12, medium: 14, large: 14 };

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
  const kelas = [
    "k-tombol",
    `k-tombol--${ukuran}`,
    `k-tombol--${jenis}`,
    // Padding sisi kiri dan kanan berbeda tergantung ada-tidaknya ikon di
    // sisi itu — begitu di Figma, terukur dari letak tinta ikonnya.
    kiri && "k-tombol--ikonkiri",
    kanan && "k-tombol--ikonkanan",
    className,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <button type={tipeHtml} className={kelas} {...sisa}>
      {kiri && <Ikon ikon={kiri} ukuran={px} />}
      {children}
      {kanan && <Ikon ikon={kanan} ukuran={CARET_PX[ukuran]} />}
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
  xsmall: 12,
  small: 14,
  medium: 16,
  large: 18,
};

export interface PropTombolIkon extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type"> {
  ikon: DataIkon;
  judul: string;
  ukuran?: UkuranTombolIkon;
  jenis?: JenisTombol;
  tipeHtml?: "button" | "submit" | "reset";
  /**
   * Titik merah pemberitahuan di sudut kanan-atas ikonnya.
   *
   * Ada di setiap varian Button Icon di Figma, tapi dibuat opsional di sini:
   * titik yang selalu menyala berhenti berarti apa-apa. Yang memakainya harus
   * menyebut apa yang belum ditangani lewat `titikJudul`, supaya pembaca layar
   * ikut mendengarnya — titik merah tanpa nama tidak bercerita apa pun.
   */
  titik?: boolean;
  titikJudul?: string;
}

export function TombolIkon({
  ikon,
  judul,
  ukuran = "medium",
  jenis = "primary",
  tipeHtml = "button",
  titik,
  titikJudul,
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
      {titik && (
        <span className="k-tombolikon__titik" role="img" aria-label={titikJudul ?? "Ada yang baru"} />
      )}
    </button>
  );
}
