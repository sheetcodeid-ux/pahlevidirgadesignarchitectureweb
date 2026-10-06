import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";

/* =============================================================================
   Kartu keterangan grafik — muncul saat kursor (atau jari) berada di atas
   sebuah irisan, batang, atau titik.

   Permintaan pemilik: "kursor diarahkan ke grafik ada keterangannya". Grafik
   yang cuma bisa dibaca bentuknya tidak pernah menjawab "berapa", dan
   angka penuh tidak muat ditulis di atas setiap irisan.

   Satu bentuk kartu untuk semua grafik kit (Busur, Donat, Cincin, Kilau,
   KolomGrafik), supaya membaca satu grafik sama dengan membaca yang lain.
   Kartunya tidak menangkap kursor (`pointer-events: none`), jadi ia tidak
   pernah menghalangi irisan di bawahnya. Ia dipasang di <body> (portal)
   dengan posisi `fixed` — di dalam kartu ber-`overflow: hidden` ia sempat
   terpotong separuh di tepi kartunya.
   ============================================================================= */

export interface BarisKartu {
  warna?: string;
  label: ReactNode;
  nilai: ReactNode;
}

/** Melacak letak kursor di layar selama ia berada di atas wadah grafik. */
export function usePenunjuk() {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const gerak = (e: React.PointerEvent) => setPos({ x: e.clientX, y: e.clientY });
  return { ref, pos, gerak, lepas: () => setPos(null) };
}

/** Kartu di koordinat LAYAR (clientX/clientY). */
export function KartuGrafik({
  x,
  y,
  judul,
  baris,
}: {
  x: number;
  y: number;
  judul?: ReactNode;
  baris: BarisKartu[];
}) {
  if (typeof document === "undefined") return null;
  // Dekat tepi kanan layar: kartu dibuka ke KIRI kursor. Dekat tepi atas:
  // ke BAWAH kursor.
  const kiri = x > window.innerWidth - 280;
  const bawah = y < 120;
  const kelas = ["k-grafikkartu", kiri && "k-grafikkartu--kiri", bawah && "k-grafikkartu--bawah"].filter(Boolean).join(" ");
  return createPortal(
    <div className={kelas} style={{ left: x, top: y }} role="status">
      {judul && <p className="k-grafikkartu__judul">{judul}</p>}
      {baris.map((b, i) => (
        <p className="k-grafikkartu__baris" key={i}>
          {b.warna && <span className="k-grafikkartu__warna" style={{ background: b.warna }} />}
          <span className="k-grafikkartu__label">{b.label}</span>
          <b>{b.nilai}</b>
        </p>
      ))}
    </div>,
    document.body,
  );
}

/* --- Keterangan untuk benda yang BUKAN grafik kit ---------------------------
   Amplop, tab bulan, jilid di rak: state kartunya milik komponen kecil
   `Keterangan`, bukan halaman, supaya kursor yang bergerak tidak menggambar
   ulang seluruh halaman. Tetikus lewat pointerenter/move/leave; jari lewat
   pointerup (ketuk = tampilkan) — `pointerType` diperiksa (jebakan #9).
   Halaman yang memakainya menutup kartu dari ketukan di luar sendiri. */
export interface InfoKartu { x: number; y: number; judul: string; baris: BarisKartu[] }
export type KabarKartu = RefObject<((i: InfoKartu | null) => void) | null>;

export function Keterangan({ kabar }: { kabar: KabarKartu }) {
  const [info, setInfo] = useState<InfoKartu | null>(null);
  useEffect(() => {
    kabar.current = setInfo;
    return () => { kabar.current = null; };
  }, [kabar]);
  return info ? <KartuGrafik x={info.x} y={info.y} judul={info.judul} baris={info.baris} /> : null;
}

export function pemberiKet(kabar: KabarKartu) {
  return (isi: () => { judul: string; baris: BarisKartu[] }) => ({
    "data-ket": "",
    onPointerEnter: (e: React.PointerEvent) => {
      if (e.pointerType === "mouse") kabar.current?.({ x: e.clientX, y: e.clientY, ...isi() });
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (e.pointerType === "mouse") kabar.current?.({ x: e.clientX, y: e.clientY, ...isi() });
    },
    onPointerLeave: (e: React.PointerEvent) => {
      if (e.pointerType === "mouse") kabar.current?.(null);
    },
    onPointerUp: (e: React.PointerEvent) => {
      if (e.pointerType !== "mouse") kabar.current?.({ x: e.clientX, y: e.clientY, ...isi() });
    },
  });
}
