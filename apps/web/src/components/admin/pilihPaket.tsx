import { PilihMenu } from "../kit/Formulir";
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
    <div className="k-isian">
      <span className="k-isian__label">{label}</span>
      <PilihMenu
        label={label}
        nilai={nilai}
        onUbah={onUbah}
        opsi={[
          { nilai: "", label: "Tanpa paket" },
          ...(Object.keys(KELOMPOK) as Paket["group"][]).flatMap((g) =>
            tampil
              .filter((p) => p.group === g)
              .map((p) => ({ nilai: p.id, label: `${labelPaket(p)}${p.active ? "" : " (dihentikan)"}`, kelompok: KELOMPOK[g] })),
          ),
        ]}
      />
      {bantu && <span className="k-isian__bantu">{bantu}</span>}
    </div>
  );
}
