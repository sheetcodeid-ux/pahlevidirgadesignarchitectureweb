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

/* =============================================================================
   Kelompok tab berikon — frame Interface "Button Group".

   BUKAN varian `Segmen`: di sini ikonnya DI ATAS label, jalurnya 72 tinggi,
   dan segmennya tidak punya celah maupun latar sendiri. Satu-satunya tanda
   pilihan adalah tinta labelnya — terukur pada frame 07, latar keempat tab
   #ECF4E9 yang sama persis pada y88.

   Dinaikkan jadi komponen kit dan bukan dibiarkan sebagai CSS halaman karena
   frame 07 (Transfer) DAN frame 10 (Payment) sama-sama memakainya di kolom
   kiri. Dua salinan bentuk yang sama pasti menyimpang — jebakan #32.
   ============================================================================= */
export function KelompokTab({
  tab,
  nilai,
  onPilih,
  judul,
  className,
}: {
  /** `href` membuat butir itu TAUTAN, bukan tab — frame 19 memakai bentuk
   *  yang sama untuk tiga aksi (Top Up / Transfer / Payment) yang masing-
   *  masing pindah halaman. Tautan tidak punya keadaan terpilih. */
  tab: { nilai: string; label: string; ikon: DataIkon; href?: string }[];
  nilai?: string;
  onPilih?: (nilai: string) => void;
  judul: string;
  className?: string;
}) {
  return (
    <div role="group" aria-label={judul} className={["k-jalurtab", className].filter(Boolean).join(" ")}>
      {tab.map((t) =>
        t.href ? (
          <a key={t.nilai} className="k-jalurtab__b" href={t.href}>
            <Ikon ikon={t.ikon} ukuran={24} />
            {t.label}
          </a>
        ) : (
          <button
            key={t.nilai}
            type="button"
            className="k-jalurtab__b"
            aria-pressed={t.nilai === nilai}
            onClick={() => onPilih?.(t.nilai)}
          >
            <Ikon ikon={t.ikon} ukuran={24} />
            {t.label}
          </button>
        ),
      )}
    </div>
  );
}
