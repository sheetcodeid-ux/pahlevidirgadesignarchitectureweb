import { PilihAsli } from "../kit/Formulir";
import type { Paket } from "../../lib/admin";

/* =============================================================================
   Pemilih paket layanan untuk satu proyek — Proyek Baru dan dialog Lingkup &
   Tenggat di Satu Proyek. Satu komponen supaya keduanya menampilkan paket
   dengan cara yang sama (jebakan #32).

   Paket yang dihentikan tidak ditawarkan, KECUALI yang sedang terpasang:
   proyek lama yang dijual dengan paket lama harus tetap terbaca benar.
   ============================================================================= */

const KELOMPOK: Record<Paket["group"], string> = { kafe: "Coffee shop", rumah: "Rumah tinggal" };

export const labelPaket = (p: Paket) => `${p.name} · Rp${p.feeMin}–${p.feeMax} jt`;

export function PilihPaket({
  paket,
  nilai,
  onUbah,
  label = "Paket layanan",
  bantu,
}: {
  paket: Paket[];
  nilai: string;
  onUbah: (id: string) => void;
  label?: string;
  bantu?: string;
}) {
  const tampil = paket.filter((p) => p.active || p.id === nilai);
  return (
    <label className="k-isian">
      <span className="k-isian__label">{label}</span>
      <PilihAsli value={nilai} onChange={(e) => onUbah(e.currentTarget.value)}>
        <option value="">Tanpa paket</option>
        {(Object.keys(KELOMPOK) as Paket["group"][]).map((g) => {
          const isi = tampil.filter((p) => p.group === g);
          return isi.length ? (
            <optgroup key={g} label={KELOMPOK[g]}>
              {isi.map((p) => (
                <option key={p.id} value={p.id}>
                  {labelPaket(p)}
                  {p.active ? "" : " (dihentikan)"}
                </option>
              ))}
            </optgroup>
          ) : null;
        })}
      </PilihAsli>
      {bantu && <span className="k-isian__bantu">{bantu}</span>}
    </label>
  );
}
