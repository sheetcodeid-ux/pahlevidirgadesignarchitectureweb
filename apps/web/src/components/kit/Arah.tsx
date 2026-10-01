import { DirectionProvider } from "@radix-ui/react-direction";
import type { ReactNode } from "react";

/* =============================================================================
   Arah (Direction) — membalik arah baca sebuah bagian (kiri-ke-kanan ⇄
   kanan-ke-kiri) untuk teks dan untuk primitif Radix di dalamnya (menu,
   tab, slider ikut membalik arah panahnya).

   Jujur soal pemakaiannya: panel ini seluruhnya berbahasa Indonesia, jadi
   tidak ada halaman yang membutuhkannya hari ini. Ia ada di pustaka supaya
   kalau suatu saat ada isi berbahasa Arab (kutipan, nama klien), bagiannya
   bisa dibalik tanpa merakit ulang komponen.
   ============================================================================= */

export function Arah({ arah, children }: { arah: "ltr" | "rtl"; children: ReactNode }) {
  return (
    <DirectionProvider dir={arah}>
      <div dir={arah} className="k-arah">
        {children}
      </div>
    </DirectionProvider>
  );
}
