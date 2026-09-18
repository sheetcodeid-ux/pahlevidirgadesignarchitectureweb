import { Ikon, type DataIkon } from "./Ikon";

/* =============================================================================
   Tombol bersegmen — frame Button, keluarga "Segmented Button".

   Di Figma ada varian 2, 3, dan 4 segmen, dan LEBARNYA SAMA di ketiganya
   (313px). Jadi segmennya dibagi rata, bukan mengikuti panjang labelnya —
   itu sebabnya di sini grid `1fr` dan bukan flex.
   ============================================================================= */

export interface SatuSegmen {
  nilai: string;
  label: string;
  ikon?: DataIkon;
}

export interface PropSegmen {
  segmen: SatuSegmen[];
  nilai: string;
  onPilih: (nilai: string) => void;
  /** Dibacakan pembaca layar sebagai nama kelompoknya. */
  judul: string;
  className?: string;
}

export function Segmen({ segmen, nilai, onPilih, judul, className }: PropSegmen) {
  return (
    <div role="tablist" aria-label={judul} className={["k-segmen", className].filter(Boolean).join(" ")}>
      {segmen.map((s) => (
        <button
          key={s.nilai}
          type="button"
          role="tab"
          aria-selected={s.nilai === nilai}
          className="k-segmen__b"
          onClick={() => onPilih(s.nilai)}
        >
          {s.ikon && <Ikon ikon={s.ikon} ukuran={14} />}
          {s.label}
        </button>
      ))}
    </div>
  );
}
