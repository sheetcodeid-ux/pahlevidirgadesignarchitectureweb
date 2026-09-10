/**
 * Mengecilkan foto di BROWSER sebelum diunggah ke R2.
 *
 * Kenapa ada: pemilik menarik sepuluh render ke galeri satu proyek dan
 * menunggu sekitar empat menit. Yang diunggah adalah berkas render mentah —
 * sisi panjangnya bisa 4000px dan ukurannya beberapa megabyte masing-masing —
 * lewat koneksi unggah rumahan yang selalu jauh lebih lambat daripada
 * unduhnya. Situsnya sendiri tidak pernah menampilkan foto selebar itu:
 * galeri halaman proyek paling lebar sekitar 1400 CSS px, dan pada layar
 * retina itu berarti 2800px sudah lebih dari cukup.
 *
 * Jadi yang dipotong bukan kualitas yang terlihat, melainkan piksel yang
 * memang tidak pernah dipakai — plus metadata kamera yang ikut terbawa.
 *
 * Yang SENGAJA tidak dilakukan:
 * - tidak memperbesar foto yang sudah kecil (hanya mengecilkan)
 * - tidak menyentuh PNG dengan transparansi... sebetulnya menyentuh, tapi
 *   hasilnya WebP yang juga punya alpha, jadi transparansinya selamat
 * - tidak memaksakan hasilnya: kalau apa pun gagal (peramban tua, gambar
 *   rusak, kanvas terkotori), berkas ASLI yang dikirim. Unggahan yang berhasil
 *   pelan jauh lebih baik daripada unggahan yang gagal cepat.
 */

/** Sisi terpanjang hasil akhir. 2560 = cukup untuk galeri lebar di layar retina. */
const SISI_MAKS = 2560;

/** Di bawah ini tidak diproses sama sekali — ongkos decode-nya tidak terbayar. */
const AMBANG_BYTE = 600 * 1024;

const MUTU = 0.86;

export interface HasilKecilkan {
  berkas: File;
  /** true kalau benar-benar dikecilkan; false kalau berkas aslinya diteruskan. */
  diubah: boolean;
  byteAsli: number;
  byteBaru: number;
}

export async function kecilkanFoto(f: File): Promise<HasilKecilkan> {
  const apaAdanya = (): HasilKecilkan => ({
    berkas: f, diubah: false, byteAsli: f.size, byteBaru: f.size,
  });

  if (!f.type.startsWith("image/")) return apaAdanya();
  /* GIF beranimasi akan kehilangan animasinya kalau digambar ke kanvas —
     yang tersisa cuma frame pertama. Tidak diproses sama sekali. */
  if (f.type === "image/gif") return apaAdanya();
  if (f.size <= AMBANG_BYTE) return apaAdanya();

  try {
    const bitmap = await createImageBitmap(f);
    const skala = Math.min(1, SISI_MAKS / Math.max(bitmap.width, bitmap.height));

    // Sudah cukup kecil dimensinya: menggambar ulang hanya menambah artefak.
    if (skala === 1 && f.type === "image/webp") { bitmap.close(); return apaAdanya(); }

    const lebar = Math.round(bitmap.width * skala);
    const tinggi = Math.round(bitmap.height * skala);

    const kanvas = document.createElement("canvas");
    kanvas.width = lebar;
    kanvas.height = tinggi;
    const ctx = kanvas.getContext("2d");
    if (!ctx) { bitmap.close(); return apaAdanya(); }
    ctx.drawImage(bitmap, 0, 0, lebar, tinggi);
    bitmap.close();

    const blob = await new Promise<Blob | null>((selesai) =>
      kanvas.toBlob(selesai, "image/webp", MUTU));
    if (!blob) return apaAdanya();

    /* Kalau hasilnya justru lebih besar — terjadi pada foto kecil bertekstur
       ramai — yang asli yang menang. */
    if (blob.size >= f.size) return apaAdanya();

    const nama = f.name.replace(/\.[^.]+$/, "") + ".webp";
    return {
      berkas: new File([blob], nama, { type: "image/webp", lastModified: Date.now() }),
      diubah: true,
      byteAsli: f.size,
      byteBaru: blob.size,
    };
  } catch {
    // createImageBitmap bisa gagal pada berkas rusak atau format yang tidak
    // dikenali peramban. Aslinya tetap diunggah.
    return apaAdanya();
  }
}

/** "2,4 MB" — dipakai di toast supaya penghematannya terlihat, bukan diklaim. */
export function formatByte(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
}
