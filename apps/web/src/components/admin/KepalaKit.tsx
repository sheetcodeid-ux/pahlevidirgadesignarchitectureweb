import { KepalaHalaman, TombolBulat } from "../kit/Item";
import { Cari } from "../kit/Isian";
import { ChatTeardropDots, Bell } from "../kit/ikon";

/* Kepala halaman panel admin — `KepalaHalaman` kit dengan isi kanan yang
   sama di seluruh halaman.

   Dibungkus jadi komponen React sendiri, bukan dirangkai di berkas .astro,
   karena JSX di dalam .astro menghasilkan fragmen ASTRO — bukan elemen
   React — jadi ia tidak bisa dioper sebagai prop ke komponen React. Yang
   dioper dari .astro cuma string. */
export function KepalaKit({ judul }: { judul: string }) {
  return (
    <KepalaHalaman
      judul={judul}
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
