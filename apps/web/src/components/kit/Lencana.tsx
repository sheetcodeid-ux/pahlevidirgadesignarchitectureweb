import type { ReactNode } from "react";

/* =============================================================================
   Lencana — frame Badges.

   Empat BENTUK dan empat NADA, dan keduanya dipisah karena di Figma memang
   begitu: "Badge Status" dan "Badge Status v2" membawa tiga state yang sama
   persis (Completed / Pending / Failed) dengan kotak yang berbeda, sementara
   "Badge Status Invoice" menambah satu nada keempat (Unpaid) pada kotak pil.

   Nama nada di sini Indonesia dan menyebut MAKNANYA, bukan warnanya:
   "selesai", bukan "hijau". Warna boleh berubah; maknanya tidak.
   ============================================================================= */

export type BentukLencana = "garis" | "pejalkecil" | "pejal" | "pil";
export type NadaLencana = "selesai" | "menunggu" | "gagal" | "netral";

export interface PropLencana {
  children: ReactNode;
  bentuk?: BentukLencana;
  nada?: NadaLencana;
  className?: string;
}

export function Lencana({ children, bentuk = "garis", nada = "netral", className }: PropLencana) {
  return (
    <span
      className={["k-lencana", `k-lencana--${bentuk}`, `k-lencana--${nada}`, className]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </span>
  );
}

/* -----------------------------------------------------------------------------
   Angka merah — keluarga "Badge" (Indicator) di Figma.

   Dua ukuran dan dua bentuk: berangka (18 dan 13x10) dan titik polos (10 dan
   8). Yang berangka membutuhkan `jumlah`; yang polos tidak menerimanya sama
   sekali, supaya tidak ada cara memanggilnya dengan angka yang tidak tampil.
   -------------------------------------------------------------------------- */
export function Angka({ jumlah, kecil = false, judul }: { jumlah: number; kecil?: boolean; judul: string }) {
  return (
    <span className={kecil ? "k-angka k-angka--kecil" : "k-angka"} aria-label={`${judul}: ${jumlah}`}>
      {jumlah > 99 ? "99+" : jumlah}
    </span>
  );
}

export function Titik({ kecil = false, judul }: { kecil?: boolean; judul: string }) {
  return <span className={kecil ? "k-titik k-titik--kecil" : "k-titik"} role="img" aria-label={judul} />;
}
