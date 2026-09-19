import type { ReactNode } from "react";
import { Ikon, type DataIkon } from "./Ikon";
import { Sort } from "./ikon";

/* =============================================================================
   Tabel — frame Table di file Figma Coinest.

   Tujuh jenis baris di frame itu (Dashboard, Dashboard v2, Investment,
   Transaction, Cards, Saving Plan, Invoice) TIDAK jadi tujuh komponen. Yang
   berbeda cuma tiga hal: daftar kolomnya, lebar kolomnya, dan tinggi
   barisnya — anatominya sama persis di ketujuhnya:

     baris kepala : teks 10px reguler abu + ikon Sort 12px
     baris isi    : sel yang dipusatkan tegak, satu atau dua baris teks
     garis        : 1px #E5E6E6 di ATAS tiap baris, bukan di bawahnya

   Membuat tujuh komponen berarti tujuh salinan yang pasti menyimpang —
   jebakan yang sudah menggigit di sidebar lawan command palette. Jadi satu
   komponen, dan yang berbeda dikirim sebagai prop.

   Memakai <table> SUNGGUHAN, bukan div ber-role: urutan baca pembaca layar,
   hubungan sel-ke-kepala, dan pemilihan teks antarkolom sudah benar tanpa
   satu baris kode pun, dan tidak bisa rusak diam-diam.
   ============================================================================= */

export interface KolomTabel {
  judul: string;
  /** Lebar kolom dalam px — dari Figma. Dipasang lewat <col>. */
  lebar: number;
  /** Kolom ini bisa diurutkan: ikon Sort tampil di sebelah judulnya. */
  urut?: boolean;
  /** Angka dirapatkan ke kanan. Bawaannya kiri. */
  kanan?: boolean;
}

export interface PropTabel {
  kolom: KolomTabel[];
  baris: ReactNode[][];
  /** Kolom kotak centang di paling kiri, seperti Transaction dan Invoice. */
  pilih?: boolean;
  /** Jarak sel ke tepi baris. Figma: 10,5 / 12,25 / 16,2 tergantung jenisnya. */
  pad?: number;
  tinggiKepala?: number;
  tinggiBaris?: number;
  /** Ukuran huruf baris isi. Dashboard 10, sisanya 12. */
  fontBaris?: number;
  /**
   * Latar baris kepala, dan ini BEDA per jenis tabel di Figma — bukan satu
   * bentuk yang dipakai ulang:
   *
   *   garis  Dashboard dan Investment: garis 1px di atas kepalanya
   *   mint   Saving Plan: bidang #ECF4E9 penuh, tanpa garis sama sekali
   *   polos  Transaction: tidak punya latar maupun garis
   */
  kepala?: "garis" | "mint" | "polos";
  /**
   * Hanya menggambar badan tabelnya. Dipakai halaman perbandingan: frame
   * Figma memisahkan baris kepala dan baris isi jadi dua varian, jadi
   * menempelkan keduanya sekaligus akan menggeser yang dibandingkan.
   */
  tanpaKepala?: boolean;
  className?: string;
}

export function Tabel({
  kolom,
  baris,
  pilih,
  pad = 10.5,
  tinggiKepala = 34,
  tinggiBaris = 49,
  fontBaris = 12,
  kepala = "garis",
  tanpaKepala,
  className,
}: PropTabel) {
  const gaya = {
    "--k-tabel-pad": `${pad}px`,
    "--k-tabel-h-kepala": `${tinggiKepala}px`,
    "--k-tabel-h-baris": `${tinggiBaris}px`,
    "--k-tabel-font": `${fontBaris}px`,
  } as React.CSSProperties;
  return (
    <table
      className={["k-tabel", `k-tabel--kepala-${kepala}`, className].filter(Boolean).join(" ")}
      style={gaya}
    >
      <colgroup>
        {pilih && <col style={{ width: 32.5 }} />}
        {kolom.map((k, i) => (
          <col key={i} style={{ width: k.lebar }} />
        ))}
      </colgroup>
      {/* Tidak dirender sama sekali, bukan disembunyikan dengan [hidden]:
          kepala tabel yang ada di DOM tapi tidak tergambar tetap dibacakan
          pembaca layar sebagai kolom yang kosong. */}
      {!tanpaKepala && (
      <thead>
        <tr>
          {pilih && (
            <th scope="col">
              <input
                type="checkbox"
                className="k-centang k-centang--default"
                aria-label="Pilih semua baris"
              />
            </th>
          )}
          {kolom.map((k, i) => (
            <th key={i} scope="col" className={k.kanan ? "is-kanan" : undefined}>
              {/* Ikon Sort tidak pernah berdiri sendiri: ia menempel pada
                  judulnya lewat span, supaya ia tidak terpisah saat kolomnya
                  terlalu sempit. */}
              <span className="k-tabel__judul">
                {k.judul}
                {k.urut && <Ikon ikon={Sort} ukuran={12} />}
              </span>
            </th>
          ))}
        </tr>
      </thead>
      )}
      <tbody>
        {baris.map((b, i) => (
          <tr key={i}>
            {pilih && (
              <td>
                <input
                  type="checkbox"
                  className="k-centang k-centang--default"
                  aria-label={`Pilih baris ${i + 1}`}
                />
              </td>
            )}
            {b.map((sel, j) => (
              <td key={j} className={kolom[j]?.kanan ? "is-kanan" : undefined}>
                {sel}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/* -----------------------------------------------------------------------------
   Sel dua baris — judul di atas, keterangan di bawahnya.

   Ukuran baris atasnya BEDA antar jenis tabel (Dashboard 10px, Investment dan
   Transaction 12px) sementara baris bawahnya selalu 10px abu. Dikirim sebagai
   prop, bukan ditebak dari konteks.
   -------------------------------------------------------------------------- */
export function SelDua({
  atas,
  bawah,
  besar,
}: {
  atas: ReactNode;
  bawah: ReactNode;
  /** Baris atas 12px, bukan 10px. */
  besar?: boolean;
}) {
  return (
    <span className={["k-sel2", besar && "k-sel2--besar"].filter(Boolean).join(" ")}>
      <span className="k-sel2__atas">{atas}</span>
      <span className="k-sel2__bawah">{bawah}</span>
    </span>
  );
}

/* -----------------------------------------------------------------------------
   Sel berikon — bulatan mint berisi ikon, lalu teksnya.

   Dipakai Investment (bulatan 30, ikon 14) dan Saving Plan (bulatan 24, ikon
   10). Bulatannya PENUH (radius = setengah sisi), bukan kotak membulat seperti
   ubin kartu statistik.
   -------------------------------------------------------------------------- */
export function SelIkon({
  ikon,
  ukuran = 30,
  ikonPx = 14,
  jarak = 12.4,
  children,
}: {
  ikon: DataIkon;
  ukuran?: number;
  ikonPx?: number;
  /** Jarak bulatan ke teksnya. Investment 12,4; Saving Plan 10,34. */
  jarak?: number;
  children: ReactNode;
}) {
  return (
    <span className="k-selikon" style={{ "--k-selikon-gap": `${jarak}px` } as React.CSSProperties}>
      <span
        className="k-selikon__bulat"
        style={{ width: ukuran, height: ukuran } as React.CSSProperties}
      >
        <Ikon ikon={ikon} ukuran={ikonPx} />
      </span>
      {children}
    </span>
  );
}

/* -----------------------------------------------------------------------------
   Sel berkeping — kotak gelap 23x15 lalu teksnya.

   Di Coinest kepingnya logo jaringan kartu; di panel ini tempatnya dipakai
   untuk menandai REKENING atau metode pembayaran. Bentuknya kotak membulat
   yang lebih lebar daripada tinggi, bukan bulatan seperti SelIkon — dan itu
   memang yang membedakan "ini kartu" dari "ini kategori" di framenya.
   -------------------------------------------------------------------------- */
export function SelKeping({ keping, children }: { keping?: ReactNode; children: ReactNode }) {
  return (
    <span className="k-selkeping">
      <span className="k-selkeping__keping" aria-hidden="true">
        {keping}
      </span>
      <span className="k-selkeping__teks">{children}</span>
    </span>
  );
}
