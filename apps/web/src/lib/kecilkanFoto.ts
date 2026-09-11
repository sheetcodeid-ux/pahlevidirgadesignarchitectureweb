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

/* ── Thumbnail rel pemilih foto ───────────────────────────────────────────
 *
 * Kotak 120x62 di bawah galeri memuat foto yang SAMA dengan foto besar di
 * atasnya. Berkas yang diunggah sudah dikecilkan ke 2560px oleh fungsi di
 * atas — tapi 2560px yang dilukis ke dalam kotak 120px tetap berarti
 * peramban mendekode sekitar dua puluh kali piksel yang dipakainya, sepuluh
 * kali, di halaman yang sama.
 *
 * Kenapa dibuat di BROWSER dan bukan di Worker API: Worker tidak pernah
 * memegang berkasnya. Unggahan memakai presigned URL — panel meminta URL ke
 * API, lalu mengirim bytes-nya LANGSUNG ke R2. Menaruh pembuatan thumbnail
 * di Worker berarti berkasnya harus lewat Worker dulu, dan runtime Workers
 * juga tidak punya kanvas untuk mendekode JPEG. Di browser, bytes-nya sudah
 * ada di tangan dan kanvasnya memang tersedia.
 *
 * Ongkosnya satu decode tambahan per foto di mesin staf. Diterima: unggahan
 * ditentukan jaringan, bukan CPU, dan ini menukar sekali decode saat
 * mengunggah dengan sepuluh decode di tiap ponsel klien yang membuka
 * halamannya.
 */

/** Sisi terpanjang thumbnail. Sel rel paling lebar terukur 120 CSS px, jadi
 *  400 menutup layar 3x tanpa menyisakan piksel yang tidak pernah dipakai. */
const THUMB_SISI = 400;

/** Lebih rendah dari foto besar dengan sengaja: pada kotak setinggi 62px
 *  artefaknya tidak terlihat, dan bedanya belasan kilobyte per foto. */
const THUMB_MUTU = 0.72;

/**
 * Versi kecil sebuah foto, untuk rel pemilih foto.
 *
 * Mengembalikan `null` — bukan melempar — kalau apa pun gagal: peramban tua,
 * berkas rusak, atau format yang tidak dikenali. Yang memanggil lalu
 * mengunggah foto besarnya saja, dan situsnya jatuh kembali ke foto penuh
 * persis seperti sebelum kolom `thumb_key` ada. Thumbnail adalah percepatan,
 * bukan syarat; kegagalannya tidak boleh menggagalkan unggahan.
 */
export async function buatThumb(f: File): Promise<File | null> {
  if (!f.type.startsWith("image/")) return null;
  /* GIF beranimasi kehilangan animasinya di kanvas — alasan yang sama seperti
     di kecilkanFoto(), dan di sini akibatnya lebih tidak kentara karena yang
     tampil cuma kotak kecil. */
  if (f.type === "image/gif") return null;

  try {
    const bitmap = await createImageBitmap(f);
    const sisi = Math.max(bitmap.width, bitmap.height);
    /* Foto yang MEMANG sudah sekecil thumbnail tidak perlu kembarannya:
       menyimpan dua berkas yang nyaris sama ukurannya cuma menambah objek
       di R2 dan satu baris kolom yang tidak memperbaiki apa pun. */
    if (sisi <= THUMB_SISI) { bitmap.close(); return null; }

    const skala = THUMB_SISI / sisi;
    const lebar = Math.max(1, Math.round(bitmap.width * skala));
    const tinggi = Math.max(1, Math.round(bitmap.height * skala));

    const kanvas = document.createElement("canvas");
    kanvas.width = lebar;
    kanvas.height = tinggi;
    const ctx = kanvas.getContext("2d");
    if (!ctx) { bitmap.close(); return null; }
    /* Penurunan skalanya besar — 2560 jadi 400 — dan penyaringan bawaan
       kanvas pada lompatan sejauh itu meninggalkan tepi yang bergerigi. */
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, 0, 0, lebar, tinggi);
    bitmap.close();

    const blob = await new Promise<Blob | null>((selesai) =>
      kanvas.toBlob(selesai, "image/webp", THUMB_MUTU));
    if (!blob) return null;

    const nama = f.name.replace(/\.[^.]+$/, "") + "-kecil.webp";
    return new File([blob], nama, { type: "image/webp", lastModified: Date.now() });
  } catch {
    return null;
  }
}
