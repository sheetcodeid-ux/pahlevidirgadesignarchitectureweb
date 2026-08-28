import { useEffect, useRef, useState } from "react";
import { bacaCache, tulisCache } from "./admin";

/**
 * Mengambil data panel dengan cache antar-halaman.
 *
 * Tiga keadaan yang dibedakan, dan bedanya penting:
 *
 * - `data === null` — belum ada apa pun, bahkan di cache. HANYA di sini
 *   kerangka halaman ditampilkan. Ini terjadi sekali saja per tab.
 * - `data` terisi dari cache — halaman langsung tampil penuh sementara
 *   permintaan segar jalan di belakang. Tidak ada kerangka, tidak ada kedip.
 * - `menyegarkan` — permintaan latar sedang jalan. Dipakai kalau panel mau
 *   memberi tanda halus; tidak pernah untuk menyembunyikan isinya.
 *
 * Kenapa bukan sekadar useEffect biasa: panel admin ini situs statis, jadi
 * setiap pindah halaman mematikan konteks JS. Tanpa cache, kembali ke
 * halaman yang baru saja dibuka tetap berarti menunggu jaringan dari nol.
 */
export function pakaiData<T>(
  kunci: string,
  ambil: () => Promise<T>,
  /** Nilai yang dipakai kalau permintaan gagal DAN cache kosong. */
  cadangan: T,
): {
  data: T | null;
  menyegarkan: boolean;
  /** Menimpa data di layar sekaligus di cache — untuk perubahan optimistis. */
  pasang: (nilai: T) => void;
  /** Meminta ulang dari server, mis. setelah menambah atau menghapus. */
  muatUlang: () => void;
} {
  const [data, setData] = useState<T | null>(() => bacaCache<T>(kunci));
  const [menyegarkan, setMenyegarkan] = useState(false);
  const [putaran, setPutaran] = useState(0);

  // Disimpan di ref supaya fungsi ambil yang dibuat ulang tiap render tidak
  // memicu permintaan berulang tanpa henti.
  const ambilRef = useRef(ambil);
  ambilRef.current = ambil;

  useEffect(() => {
    let batal = false;
    setMenyegarkan(true);

    ambilRef.current()
      .then((hasil) => {
        if (batal) return;
        tulisCache(kunci, hasil);
        setData(hasil);
      })
      .catch(() => {
        // Gagal mengambil TIDAK menghapus yang sudah tampil: data lama yang
        // masih masuk akal lebih berguna daripada halaman kosong saat
        // jaringan sedang buruk.
        if (batal) return;
        setData((lama) => (lama === null ? cadangan : lama));
      })
      .finally(() => {
        if (!batal) setMenyegarkan(false);
      });

    return () => { batal = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kunci, putaran]);

  function pasang(nilai: T) {
    tulisCache(kunci, nilai);
    setData(nilai);
  }

  return { data, menyegarkan, pasang, muatUlang: () => setPutaran((n) => n + 1) };
}
