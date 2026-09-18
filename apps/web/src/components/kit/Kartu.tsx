import type { ReactNode } from "react";
import { Ikon, type DataIkon } from "./Ikon";
import { DotsThreeVertical, TrendUp, TrendDown } from "./ikon";

/* =============================================================================
   Kartu — frame Card.

   `Kartu` adalah wadah dasarnya: radius 16, garis 1px, padding 15. Seluruh
   panel Coinest dibangun dari bentuk itu, jadi ia dibuat telanjang — tanpa
   kepala, tanpa judul — supaya isinya bebas.

   Yang punya anatomi tetap dibuat komponen sendiri: `KartuStatistik` dan
   `KartuKas`.
   ============================================================================= */

export function Kartu({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={["k-kartu", className].filter(Boolean).join(" ")}>{children}</div>;
}

/* -----------------------------------------------------------------------------
   Lencana tren — 49x12 di Figma, menempel di atas angka.

   `naik` menentukan arah DAN warnanya sekaligus; tidak ada cara memanggilnya
   dengan panah naik berwarna merah. Untuk angka yang naiknya buruk (beban,
   tunggakan) pakai `baik={false}` — arah dan penilaian memang dua hal
   berbeda, dan menyamakannya sudah pernah bikin beban naik tampil hijau.
   -------------------------------------------------------------------------- */
export interface PropTren {
  naik: boolean;
  /** Apakah arah itu kabar baik. Bawaannya: naik = baik. */
  baik?: boolean;
  children: ReactNode;
}

export function Tren({ naik, baik = naik, children }: PropTren) {
  return (
    <span className={baik ? "k-tren" : "k-tren k-tren--turun"}>
      <Ikon ikon={naik ? TrendUp : TrendDown} ukuran={10} />
      {children}
    </span>
  );
}

export interface PropKartuStatistik {
  ikon: DataIkon;
  judul: string;
  nilai: ReactNode;
  tren?: ReactNode;
  /** Menu titik-tiga di pojok kanan atas. Tanpa ini, menunya tidak digambar. */
  onMenu?: () => void;
  menuJudul?: string;
  className?: string;
}

export function KartuStatistik({
  ikon,
  judul,
  nilai,
  tren,
  onMenu,
  menuJudul,
  className,
}: PropKartuStatistik) {
  return (
    <div className={["k-stat", className].filter(Boolean).join(" ")}>
      <div className="k-stat__kepala">
        <span className="k-stat__ubin">
          <Ikon ikon={ikon} ukuran={20} />
        </span>
        {onMenu && (
          <button
            type="button"
            className="k-stat__menu"
            onClick={onMenu}
            aria-label={menuJudul ?? `Pilihan untuk ${judul}`}
          >
            <Ikon ikon={DotsThreeVertical} ukuran={18} />
          </button>
        )}
      </div>
      {tren}
      <p className="k-stat__nilai">{nilai}</p>
      <p className="k-stat__judul">{judul}</p>
    </div>
  );
}

/**
 * Tanda dua lingkaran di pojok kartu kas.
 *
 * Bentuknya dari Figma apa adanya: dua lingkaran berdiameter 24 yang
 * bertumpang 9,6px, dengan irisannya hijau tua.
 *
 * Transparansinya ditulis Figma sebagai atribut `opacity`, BUKAN
 * `fill-opacity` — dan sekali saya membacanya dengan mencari `fill-opacity`,
 * jawabannya "tidak ada transparansi sama sekali", yang membuat lingkaran
 * kiri kartu terang tergambar hijau tua pejal padahal seharusnya 30%.
 *
 * Kartu gelap : kanan #BBF49C 80%, kiri #ECF4E9 penuh, irisan #1E4841 80%
 * Kartu terang: kanan #BBF49C 80%, kiri #1E4841 30%,  irisan #1E4841 80%
 *
 * Di Coinest ini lambang jaringan pembayaran. Di panel ini tempatnya dipakai
 * LOGO STUDIO — jadi komponen ini ada supaya bentuk acuannya bisa dibanding,
 * bukan supaya dipakai di halaman sungguhan. Yang dipakai di halaman: prop
 * `kanan` diisi logo studio.
 */
export function TandaKas({ terang }: { terang?: boolean }) {
  return (
    <svg width="38.4" height="24" viewBox="0 0 38.4 24" fill="none" aria-hidden="true">
      <circle cx="26.4" cy="12" r="12" fill="var(--brand-mint)" opacity="0.8" />
      <circle
        cx="12"
        cy="12"
        r="12"
        fill={terang ? "var(--brand)" : "var(--brand-soft)"}
        opacity={terang ? 0.3 : undefined}
      />
      <path d="M19.2 2.1A12 12 0 0 0 19.2 21.9 12 12 0 0 0 19.2 2.1Z" fill="var(--brand)" opacity="0.8" />
    </svg>
  );
}

export interface PropKartuKas {
  nama: string;
  nilai: ReactNode;
  /** Dua keterangan kecil di kaki kartu — mis. periode dan jumlah transaksi. */
  kaki?: { judul: string; isi: ReactNode }[];
  kanan?: ReactNode;
  /**
   * Keterangan kecil di sebelah kanan nominal — "Debit" di framenya.
   *
   * Sempat tidak ada sama sekali, dan itu tidak terlihat dari membandingkan
   * ukuran kartunya: yang menemukannya peta selisih piksel, yang menggambar
   * kata itu merah pejal karena ia ada di Figma dan tidak ada di kit.
   */
  label?: ReactNode;
  terang?: boolean;
  className?: string;
}

export function KartuKas({ nama, nilai, kaki, kanan, label, terang, className }: PropKartuKas) {
  return (
    <div className={["k-kas", terang && "k-kas--terang", className].filter(Boolean).join(" ")}>
      <div className="k-kas__atas">
        <p className="k-kas__nama">{nama}</p>
        {kanan}
      </div>
      <div className="k-kas__tengah">
        <p className="k-kas__nilai">{nilai}</p>
        {label && <p className="k-kas__label">{label}</p>}
      </div>
      <div className="k-kas__kaki">
        {kaki?.map((k) => (
          <div key={k.judul}>
            <p className="k-kas__ket">{k.judul}</p>
            <p className="k-kas__isi">{k.isi}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
