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

/* -----------------------------------------------------------------------------
   KARTU STATISTIK RINGKAS — 284x87, frame "04. Dashboard (v2)".

   Varian KETIGA dari kartu statistik, dan ketiganya memang berbeda bentuk —
   bukan satu komponen dengan tiga ukuran:

     KartuStatistik        183x174  tegak, ikon di atas, angka di bawah
     KartuStatistikLebar   386x88   ikon BESAR di kanan, latar mint pucat
     KartuStatistikRingkas 284x87   ikon kecil sebaris label, lencana di kanan

   Terukur dari framenya (koordinat relatif terhadap pojok kartu):

     kartu    284x87 radius 15,5 latar #FBFBFC garis #E5E6E6
     ubin     22x22 radius 8 di (15,5 , 15,5), latar #ECF4E9
     label    tinta di (46,6 , 21,7) — 14px/400
     nominal  tinta di (16,5 , 47)   — 24px/700, #1E4841
     lencana  51x17 radius 8,5 rata KANAN, puncaknya 23 dari atas kartu
     ket      tinta di y50,3 rata kanan — "+$355" 12/700 lalu 12/400

   Dua angka yang gampang salah ambil: nominalnya 24px meski TINGGI tintanya
   22,18 (glif "$" menjulang, jadi tinggi tinta bukan ukuran font — jebakan
   yang sudah ditulis di .k-stat__nilai), dan labelnya 400 bukan 600.
   -------------------------------------------------------------------------- */
export function KartuStatistikRingkas({
  ikon,
  judul,
  nilai,
  nilaiPenuh,
  tren,
  ket,
  className,
}: {
  ikon: DataIkon;
  judul: ReactNode;
  nilai: ReactNode;
  /**
   * Angka lengkapnya, kalau `nilai` dipendekkan ("Rp532 jt"). Muncul sebagai
   * tooltip — yang dipendekkan cuma tampilannya, bukan datanya.
   */
  nilaiPenuh?: string;
  /** Lencana tren di sudut kanan atas. */
  tren?: ReactNode;
  /** Baris keterangan di bawah lencana. */
  ket?: ReactNode;
  className?: string;
}) {
  return (
    <div className={["k-statkecil", className].filter(Boolean).join(" ")}>
      <div className="k-statkecil__kiri">
        <p className="k-statkecil__kepala">
          <span className="k-statkecil__ubin">
            <Ikon ikon={ikon} ukuran={16} />
          </span>
          <span className="k-statkecil__judul">{judul}</span>
        </p>
        <p className="k-statkecil__nilai" title={nilaiPenuh}>
          {nilai}
        </p>
      </div>
      {/* Keterangan di KOLOM KANAN, di bawah lencana — persis framenya.

          Sempat dipindah ke bawah nominal karena "Rp532.000.000" (200px)
          menabrak keterangannya di kartu selebar 285. Yang diperbaiki
          sekarang penyebabnya, bukan letaknya: nominal di kartu ini
          dipendekkan ("Rp532 jt", lihat `formatRupiahRingkas`), dan pada
          lebar itu keduanya muat berdampingan seperti "$8,500" di Coinest.

          Kartu tanpa lencana tetap memakai ruang lencananya, supaya
          keterangannya duduk sebaris dengan keterangan kartu tetangganya. */}
      <div className="k-statkecil__kanan">
        {tren ?? <span className="k-statkecil__tanpatren" />}
        {ket && <p className="k-statkecil__ket">{ket}</p>}
      </div>
    </div>
  );
}
