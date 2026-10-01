import { Peringatan } from "../kit/Tampilan";
import { Tombol } from "../kit/Tombol";
import { ArrowClockwise } from "../kit/ikon";

/* Satu bentuk untuk "datanya tidak datang" di semua halaman kit: Peringatan
   merah yang menyebut APA yang gagal, pesan galatnya, dan satu jalan keluar.
   Dulu tiap halaman menulis kalimat polosnya sendiri ("Gagal memuat …: …")
   tanpa tombol apa pun — orang tidak tahu harus berbuat apa. */
export function GagalMuat({ apa, galat }: { apa: string; galat: string }) {
  return (
    <Peringatan
      nada="bahaya"
      judul={`${apa} tidak bisa dimuat`}
      aksi={
        <Tombol ukuran="small" jenis="ghost" kiri={ArrowClockwise} onClick={() => location.reload()}>
          Muat ulang
        </Tombol>
      }
    >
      {galat}. Periksa koneksi, lalu muat ulang halaman.
    </Peringatan>
  );
}
