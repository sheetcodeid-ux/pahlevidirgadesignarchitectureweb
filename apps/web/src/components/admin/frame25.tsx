import { Tombol } from "../kit/Tombol";
import { Ikon, type DataIkon } from "../kit/Ikon";
import {
  CaretDown,
  SpecialHandshake,
  SpecialPersonSimple,
  SpecialSealCheck,
  SpecialSuitcase,
} from "../kit/ikon";
import { type JenisAnggota } from "../../lib/admin";
import { formatRupiah } from "../../lib/format";

/* =============================================================================
   Bahan bersama dua halaman yang dibangun dari frame "25. Investments": Fee
   Proyek dan Gaji. Keduanya menjawab pertanyaan yang sama — berapa yang
   dibayarkan studio kepada orang — dari dua sisi, jadi nominalnya harus
   dicetak, dibulatkan, dan dipilih dengan cara yang sama persis. Dua salinan
   akan menyimpang (jebakan #32), dan yang menyimpang justru angka uang.

   Kelas CSS-nya tetap `fee__*` di fee-kit.css: satu stylesheet untuk satu
   frame, dimuat kedua halaman.
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


/** Batas atas sumbu yang enak dibaca: 13.748.211 -> 20.000.000. */
export function bulatkan(t: number): number {
  const n = Math.max(1, t);
  const pangkat = 10 ** Math.floor(Math.log10(n));
  return Math.ceil(n / pangkat) * pangkat;
}

/** Label sumbu: 12.500.000 -> "12,5 jt". */
export function sumbu(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1).replace(".", ",").replace(/,0$/, "")} M`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1).replace(".", ",").replace(/,0$/, "")} jt`;
  if (n >= 1e3) return `${Math.round(n / 1e3)} rb`;
  return String(n);
}

/* Nominal besar dipecah jadi dua tinta, meniru "$349,256.45" framenya yang
   sen-nya abu. Rupiah tidak punya sen, jadi yang diabukan tiga angka
   terakhirnya: "Rp18.700" hijau tua, ".000" abu. Angkanya tetap utuh dan
   terbaca sebagai satu bilangan; yang diredupkan cuma bagian yang tidak
   pernah mengubah keputusan siapa pun. */
export function NominalBesar({ n }: { n: number }) {
  const s = formatRupiah(n);
  const i = s.lastIndexOf(".");
  return (
    <span className="fee__nominal">
      <b>{i < 0 ? s : s.slice(0, i)}</b>
      {i >= 0 && <span>{s.slice(i)}</span>}
    </span>
  );
}

export function persen(atas: number, bawah: number): number {
  return bawah > 0 ? (atas / bawah) * 100 : 0;
}

export function teksPersen(p: number): string {
  return `${p.toFixed(p >= 10 ? 0 : 1).replace(".", ",")}%`;
}

/** Pemilih bertombol berbingkai dengan <select> asli ditumpangkan — pola
 *  `.k-pilihtombol` yang sama dengan halaman Ringkasan. */
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
  return (
    <label className="k-pilihtombol">
      <Tombol ukuran="medium" jenis="ghost" kanan={CaretDown} tabIndex={-1}>
        {opsi.find((o) => o.nilai === nilai)?.label ?? judul}
      </Tombol>
      <select aria-label={judul} value={nilai} onChange={(e) => onUbah(e.currentTarget.value)}>
        {opsi.map((o) => (
          <option key={o.nilai} value={o.nilai}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
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
    <label className={["fee__pilihteks", className].filter(Boolean).join(" ")}>
      <span>{opsi.find((o) => o.nilai === nilai)?.label ?? judul}</span>
      <Ikon ikon={CaretDown} ukuran={12} />
      <select aria-label={judul} value={nilai} onChange={(e) => onUbah(e.currentTarget.value)}>
        {opsi.map((o) => (
          <option key={o.nilai} value={o.nilai}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

