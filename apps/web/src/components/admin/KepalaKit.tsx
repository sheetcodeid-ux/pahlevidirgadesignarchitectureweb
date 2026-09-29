import { KepalaHalaman, TombolBulat } from "../kit/Item";
import { Cari } from "../kit/Isian";
import { useEffect, useState } from "react";
import { ChatTeardropDots, Bell, ArrowLeft, List } from "../kit/ikon";
import { PERISTIWA_REL, PERISTIWA_REL_KEADAAN, ID_REL } from "./RelKit";
import { navigate } from "astro:transitions/client";
import { TerbitKit } from "./TerbitKit";

/* Kepala halaman panel admin — `KepalaHalaman` kit dengan isi kanan yang
   sama di seluruh halaman.

   Dibungkus jadi komponen React sendiri, bukan dirangkai di berkas .astro,
   karena JSX di dalam .astro menghasilkan fragmen ASTRO — bukan elemen
   React — jadi ia tidak bisa dioper sebagai prop ke komponen React. Yang
   dioper dari .astro cuma string. */
export function KepalaKit({ judul, kembali, dibangunPada }: {
  judul: string;
  kembali?: string;
  /** Stempel build yang dipanggang ke HTML — lihat useTerbit. */
  dibangunPada: string;
}) {
  /* Keadaan menu geser milik RelKit; di sini cuma cerminnya untuk
     aria-expanded. Kepala ini dipasang ulang tiap halaman, jadi ia bertanya
     sekali saat dipasang. */
  const [menuBuka, setMenuBuka] = useState(false);
  useEffect(() => {
    const dengar = (e: Event) => setMenuBuka(Boolean((e as CustomEvent<boolean>).detail));
    window.addEventListener(PERISTIWA_REL_KEADAAN, dengar);
    window.dispatchEvent(new CustomEvent(PERISTIWA_REL, { detail: "tanya" }));
    return () => window.removeEventListener(PERISTIWA_REL_KEADAAN, dengar);
  }, []);

  return (
    <KepalaHalaman
      judul={judul}
      /* Hanya tampil di ponsel (CSS .kl__menu). Bulat, bukan kotak seperti
         tombol kembali: di kit, yang bulat membuka panel. */
      kiri={
        <TombolBulat
          className="kl__menu"
          ikon={List}
          judul={menuBuka ? "Tutup menu" : "Buka menu"}
          aria-controls={ID_REL}
          aria-expanded={menuBuka}
          data-kl-rel-tombol=""
          onClick={() => window.dispatchEvent(new CustomEvent(PERISTIWA_REL))}
        />
      }
      /* `kembali` berupa ALAMAT, bukan history.back(): halaman detail bisa
         dibuka langsung dari tautan, dan "kembali" ke halaman sebelumnya
         lalu berarti keluar dari panel. navigate() lewat router sisi klien,
         sama dengan klik menu. */
      onKembali={kembali ? () => navigate(kembali) : undefined}
      ikonKembali={kembali ? ArrowLeft : undefined}
      kanan={
        <>
          <Cari ukuran="medium" judul="Cari" placeholder="Cari di panel" />
          <span className="k-kepalahal__grup">
            <TerbitKit dibangunPada={dibangunPada} />
            <TombolBulat ikon={ChatTeardropDots} judul="Pesan" />
            <TombolBulat ikon={Bell} judul="Pemberitahuan" />
          </span>
        </>
      }
    />
  );
}
