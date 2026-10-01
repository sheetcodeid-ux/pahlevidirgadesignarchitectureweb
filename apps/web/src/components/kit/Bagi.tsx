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
  awalKiri = 40,
  minKiri = 24,
  minKanan = 30,
  arah = "horizontal",
  label = "Geser untuk mengubah lebar",
}: {
  kiri: ReactNode;
  kanan: ReactNode;
  /** Persen lebar panel kiri saat pertama tampil. */
  awalKiri?: number;
  minKiri?: number;
  minKanan?: number;
  arah?: "horizontal" | "vertical";
  label?: string;
}) {
  return (
    <Group orientation={arah} className={`k-bagi k-bagi--${arah}`}>
      <Panel defaultSize={String(awalKiri)} minSize={String(minKiri)} className="k-bagi__panel">
        {kiri}
      </Panel>
      <Separator className="k-bagi__pegangan" aria-label={label} />
      <Panel minSize={String(minKanan)} className="k-bagi__panel">
        {kanan}
      </Panel>
    </Group>
  );
}
