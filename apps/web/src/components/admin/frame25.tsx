import { PilihMenu, PilihTombol as PilihTombolKit } from "../kit/Formulir";
import { Ikon, type DataIkon } from "../kit/Ikon";
import {
  CaretDown,
  SpecialHandshake,
  SpecialPersonSimple,
  SpecialSealCheck,
  SpecialSuitcase,
} from "../kit/ikon";
import { type JenisAnggota } from "../../lib/admin";

/* =============================================================================
   Bahan bersama yang lahir dari frame "25. Investments": nama bulan, jenis
   penerima beserta ikonnya, persen tertulis, dan dua pemilih. Fee Proyek dan
   Gaji kini punya bentuk sendiri (lemari laci, buku gaji), tapi tetap
   mengambil bahan ini dari sini — dua salinan akan menyimpang (jebakan #32).

   Kelas CSS pemilih teksnya (`fee__pilihteks`) hidup di fee-kit.css.
   ============================================================================= */

export const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus",
  "September", "Oktober", "November", "Desember"];
export const BULAN_PENDEK = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];


export const JENIS: JenisAnggota[] = ["partner", "inti", "proyek", "staf"];
export const IKON_JENIS: Record<JenisAnggota, DataIkon> = {
  partner: SpecialHandshake,
  inti: SpecialSealCheck,
  proyek: SpecialSuitcase,
  staf: SpecialPersonSimple,
};


export function teksPersen(p: number): string {
  return `${p.toFixed(p >= 10 ? 0 : 1).replace(".", ",")}%`;
}

/** Pemilih bertombol berbingkai — pola `.k-pilihtombol` yang sama dengan halaman Ringkasan. */
export function PilihTombol({
  judul,
  nilai,
  opsi,
  onUbah,
}: {
  judul: string;
  nilai: string;
  opsi: { nilai: string; label: string }[];
  onUbah: (v: string) => void;
}) {
  return <PilihTombolKit judul={judul} nilai={nilai} opsi={opsi} onPilih={onUbah} jenis="ghost" />;
}

/** Pemilih TEKS tanpa bingkai — "Today ▾" di kepala widget Assets. */
export function PilihTeks({
  judul,
  nilai,
  opsi,
  onUbah,
  className,
}: {
  judul: string;
  nilai: string;
  opsi: { nilai: string; label: string }[];
  onUbah: (v: string) => void;
  className?: string;
}) {
  return (
    <PilihMenu
      label={judul}
      nilai={nilai}
      opsi={opsi}
      onUbah={onUbah}
      align="end"
      pemicu={
        <button type="button" className={["fee__pilihteks", className].filter(Boolean).join(" ")}>
          <span>{opsi.find((o) => o.nilai === nilai)?.label ?? judul}</span>
          <Ikon ikon={CaretDown} ukuran={12} />
        </button>
      }
    />
  );
}

