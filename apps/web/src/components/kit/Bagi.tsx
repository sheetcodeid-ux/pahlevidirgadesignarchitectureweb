import { Group, Panel, Separator } from "react-resizable-panels";
import type { ReactNode } from "react";

/* =============================================================================
   Bagi (Resizable) — dua panel yang lebarnya bisa diatur.

   Berkas sendiri karena pustakanya cuma dibutuhkan halaman yang memakainya.
   Pegangannya digambar 1px tapi area tangkapnya 12px (pseudo-elemen), dan
   panah kiri/kanan menggesernya lewat papan ketik — milik pustakanya.
   ============================================================================= */

export function Bagi({
  kiri,
  kanan,
  awalKiri = "40%",
  minKiri = "24%",
  minKanan = "30%",
  arah = "horizontal",
  label = "Geser untuk mengubah lebar",
}: {
  kiri: ReactNode;
  kanan: ReactNode;
  /** Lebar panel kiri saat pertama tampil. ANGKA = piksel, "40%" = persen. */
  awalKiri?: number | string;
  minKiri?: number | string;
  minKanan?: number | string;
  arah?: "horizontal" | "vertical";
  label?: string;
}) {
  return (
    <Group orientation={arah} className={`k-bagi k-bagi--${arah}`}>
      <Panel defaultSize={awalKiri} minSize={minKiri} className="k-bagi__panel">
        {kiri}
      </Panel>
      <Separator className="k-bagi__pegangan" aria-label={label} />
      <Panel minSize={minKanan} className="k-bagi__panel">
        {kanan}
      </Panel>
    </Group>
  );
}
