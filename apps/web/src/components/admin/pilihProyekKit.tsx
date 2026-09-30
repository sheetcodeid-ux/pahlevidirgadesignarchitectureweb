import { useEffect, useLayoutEffect, useState } from "react";
import { Ikon } from "../kit/Ikon";
import { CaretDown } from "../kit/ikon";
import { daftarProyek, bacaCache, tulisCache, type Proyek } from "../../lib/admin";
import { proyekAktif, setProyekAktif } from "../../lib/proyekAktif";

/* =============================================================================
   Pemilih proyek halaman kit — Halaman Publik dan Portal Klien.

   Dua halaman itu sama-sama "satu proyek, pilih yang mana", dan keduanya
   harus sepakat soal urutan sumbernya: ?id= di alamat lebih dulu (tautan
   dari Semua Proyek dan Satu Proyek), lalu proyek aktif yang diingat, lalu
   proyek pertama di daftar. Dua salinan aturan itu pasti menyimpang
   (jebakan #32), dan yang menyimpang baru ketahuan saat staf membuka proyek
   yang salah dari satu halaman tapi tidak dari halaman sebelahnya.
   ============================================================================= */

export function usePilihProyek() {
  const [semua, setSemua] = useState<Proyek[] | null>(() => bacaCache<Proyek[]>("proyek"));
  const [id, setId] = useState<string | null>(null);
  const [galat, setGalat] = useState<string | null>(null);

  /* Dibaca SEBELUM paint pertama. Alamat dan penyimpanan cuma ada di
     browser, jadi tidak boleh masuk nilai awal useState — bedanya akan jadi
     ketidakcocokan hidrasi. */
  useLayoutEffect(() => {
    const dariAlamat = new URLSearchParams(location.search).get("id");
    if (dariAlamat) setProyekAktif(dariAlamat);
    setId(dariAlamat ?? proyekAktif());
  }, []);

  useEffect(() => {
    daftarProyek()
      .then((d) => {
        tulisCache("proyek", d);
        setSemua(d);
      })
      .catch((e) =>
        setSemua((l) => {
          if (!l) setGalat((e as Error).message);
          return l;
        }),
      );
  }, []);

  /* Tanpa proyek yang diingat, yang dibuka proyek pertama — bukan halaman
     kosong yang menyuruh pergi ke tempat lain. */
  const asli = semua?.find((p) => p.id === id) ?? (semua && !id ? semua[0] : undefined) ?? null;

  function pilih(baru: string) {
    setProyekAktif(baru);
    setId(baru);
    /* Alamatnya ikut, supaya muat ulang dan tautan yang disalin membuka
       proyek yang sama. replaceState, bukan pushState: berpindah proyek di
       sini bukan langkah yang perlu dibatalkan dengan tombol Kembali. */
    history.replaceState(history.state, "", `?id=${encodeURIComponent(baru)}`);
  }

  return { semua, setSemua, id, asli, galat, pilih };
}

/** Judul halaman yang sekaligus pemilih proyek: <select> asli ditumpangkan
 *  transparan di atas judulnya. */
export function JudulPilihProyek({
  semua,
  asli,
  onPilih,
}: {
  semua: Proyek[];
  asli: Proyek;
  onPilih: (id: string) => void;
}) {
  return (
    <label className="pf__pilihjudul">
      <span className="pas__judul">{asli.title}</span>
      <Ikon ikon={CaretDown} ukuran={20} />
      <select aria-label="Pilih proyek" value={asli.id} onChange={(e) => onPilih(e.currentTarget.value)}>
        {semua.map((p) => (
          <option key={p.id} value={p.id}>
            {p.title}
          </option>
        ))}
      </select>
    </label>
  );
}
