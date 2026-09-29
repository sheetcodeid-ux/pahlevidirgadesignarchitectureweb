import { KepalaHalaman, TombolBulat } from "../kit/Item";
import { Cari } from "../kit/Isian";
import { ChatTeardropDots, Bell, ArrowLeft } from "../kit/ikon";
import { navigate } from "astro:transitions/client";

/* Kepala halaman panel admin — `KepalaHalaman` kit dengan isi kanan yang
   sama di seluruh halaman.

   Dibungkus jadi komponen React sendiri, bukan dirangkai di berkas .astro,
   karena JSX di dalam .astro menghasilkan fragmen ASTRO — bukan elemen
   React — jadi ia tidak bisa dioper sebagai prop ke komponen React. Yang
   dioper dari .astro cuma string. */
export function KepalaKit({ judul, kembali }: { judul: string; kembali?: string }) {
  return (
    <KepalaHalaman
      judul={judul}
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
            <TombolBulat ikon={ChatTeardropDots} judul="Pesan" />
            <TombolBulat ikon={Bell} judul="Pemberitahuan" />
          </span>
        </>
      }
    />
  );
}
