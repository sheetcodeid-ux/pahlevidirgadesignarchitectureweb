/* Penanda "bagian mana yang sedang dibaca" untuk rel daftar isi.
 *
 * Dipakai bersama oleh /privasi, /jurnal/[slug], dan /proyek/[slug]. Ketiganya
 * dulu punya salinannya sendiri dengan isi yang sama persis — dan salinan yang
 * sama persis adalah salinan yang suatu saat menyimpang.
 *
 * MASALAH YANG DIPERBAIKI. Ketiga salinan itu memanggil
 * `getBoundingClientRect()` untuk SETIAP bagian di SETIAP peristiwa gulir, dan
 * dua di antaranya juga membaca `document.body.scrollHeight`. Membaca properti
 * geometri menagih layout sinkron: peramban harus menyelesaikan perhitungan
 * tata letak sebelum bisa menjawab. Halaman /privasi punya delapan bagian,
 * jadi satu kali gulir berarti delapan permintaan seperti itu. Cacat yang sama
 * sudah pernah ditemukan pada bar kemajuan baca di beranda dan tercatat
 * sebagai jebakan #21 di CLAUDE.md.
 *
 * CARA KERJA SEKARANG. Posisi tiap bagian diukur SEKALI, disimpan sebagai
 * angka, lalu dibandingkan dengan `scrollY` — yang memang sudah dipegang
 * peramban dan tidak menagih layout apa pun. Pengukuran ulang hanya terjadi
 * saat ukuran halaman benar-benar berubah (layar diputar, gambar lazy mendarat
 * dan mendorong isi ke bawah), yang ditangkap ResizeObserver.
 *
 * KENAPA BUKAN IntersectionObserver. Sudah diputuskan di sesi sebelumnya dan
 * alasannya masih berlaku: IO hanya berbunyi saat perpotongan BERUBAH, dan
 * pada lompatan gulir besar — menekan End, mengklik tautan rel — ia bisa
 * melewatkan bagian yang dilompati. Penandanya lalu menyala di bagian yang
 * salah. Cara di bawah membandingkan POSISI, jadi lompatan sebesar apa pun
 * tetap menghasilkan jawaban yang benar.
 */

interface Opsi {
  /** Elemen tiap bagian, urut sesuai urutan dokumen. */
  bagian: Element[];
  /** Tautan rel yang ditandai, sejajar indeksnya dengan `bagian`. */
  tautan: Element[];
  /** Garis baca dari tepi atas viewport. Bawaannya 14% tinggi layar. */
  garis?: () => number;
  /** Nama kelas penanda. */
  kelas?: string;
}

export function relSpy({ bagian, tautan, garis, kelas = "kini" }: Opsi): void {
  if (!bagian.length || bagian.length !== tautan.length) return;
  const garisDari = garis ?? (() => innerHeight * 0.14);

  /* Posisi tiap bagian terhadap DOKUMEN, bukan terhadap viewport — supaya ia
     tetap sah berapa pun halamannya sudah digulir, dan cukup diukur sekali. */
  let titik: number[] = [];
  let ujung = 0;

  const ukur = () => {
    titik = bagian.map((b) => b.getBoundingClientRect().top + scrollY);
    ujung = document.documentElement.scrollHeight;
  };

  const tandai = () => {
    const batas = scrollY + garisDari();
    let ke = 0;
    for (let k = 0; k < titik.length; k++) if (titik[k] <= batas + 1) ke = k;
    /* Bagian terakhir tidak pernah melewati garis kalau halamannya sudah
       mentok di bawah — tanpa ini ia tidak pernah menyala. */
    if (scrollY + innerHeight >= ujung - 4) ke = titik.length - 1;
    tautan.forEach((t, k) => t.classList.toggle(kelas, k === ke));
  };

  /* Paling banyak satu perhitungan per frame. Tanpa ini, satu gerakan
     trackpad bisa memicu puluhan peristiwa gulir yang semuanya menulis
     kelas ke elemen yang sama. */
  let antre = false;
  const jadwal = () => {
    if (antre) return;
    antre = true;
    requestAnimationFrame(() => {
      antre = false;
      tandai();
    });
  };

  ukur();
  tandai();
  addEventListener("scroll", jadwal, { passive: true });
  addEventListener("resize", () => { ukur(); tandai(); }, { passive: true });

  /* Gambar lazy yang mendarat mendorong isi di bawahnya, jadi posisi yang
     sudah disimpan jadi basi. ResizeObserver menangkapnya tanpa perlu
     mengukur apa pun di jalur gulir. */
  if ("ResizeObserver" in window) {
    new ResizeObserver(() => { ukur(); tandai(); }).observe(document.documentElement);
  }
}
