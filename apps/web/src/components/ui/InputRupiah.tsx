import { useId } from "react";
import { formatRupiah } from "../../lib/format";

interface Props {
  /** Nilai dalam rupiah penuh. null berarti kosong. */
  value: number | null;
  onChange: (n: number | null) => void;
  id?: string;
  placeholder?: string;
  disabled?: boolean;
  ariaLabel?: string;
}

/**
 * Isian nominal rupiah yang memformat dirinya sambil diketik: mengetik
 * 10000000 langsung terbaca Rp10.000.000.
 *
 * Kenapa bukan `type="number"`: kolom angka bawaan tidak bisa menampilkan
 * pemisah ribuan sama sekali — nilainya harus angka murni. Padahal nominal
 * tanpa pemisah adalah sumber salah ketik yang paling mahal di halaman ini;
 * Rp10.000.000 dan Rp100.000.000 sulit dibedakan kalau ditulis rapat.
 * Jadi kotaknya teks, angkanya disaring sendiri, dan `inputMode="numeric"`
 * yang memunculkan papan tombol angka di ponsel.
 *
 * Kursor sengaja tidak dipertahankan di tengah: setiap ketikan mengubah
 * jumlah titik pemisah, jadi menyunting di tengah selalu terasa meloncat.
 * Yang benar-benar dilakukan orang pada kolom nominal adalah mengetik dari
 * awal atau menghapus dari belakang, dan keduanya tetap wajar.
 */
export function InputRupiah({ value, onChange, id, placeholder = "Rp0", disabled, ariaLabel }: Props) {
  const otomatis = useId();
  return (
    <input
      id={id ?? otomatis}
      className="input input--mono"
      type="text"
      inputMode="numeric"
      autoComplete="off"
      disabled={disabled}
      aria-label={ariaLabel}
      placeholder={placeholder}
      value={value === null ? "" : formatRupiah(value)}
      onChange={(e) => {
        const angka = e.target.value.replace(/\D/g, "");
        onChange(angka === "" ? null : Number(angka));
      }}
    />
  );
}
