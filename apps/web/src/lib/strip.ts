/* Rel kemajuan + penanda foto aktif untuk galeri yang digeser mendatar.
 *
 * Dipakai bersama oleh beranda (enam galeri, satu per tab) dan
 * /proyek/[slug] (satu galeri). Sebelumnya keduanya punya salinannya sendiri
 * dengan isi yang sama persis.
 *
 * MASALAH YANG DIPERBAIKI — sama persis dengan jebakan #21 di CLAUDE.md,
 * cuma pada penampung mendatar alih-alih halaman. Salinan lama melakukan ini
 * di SETIAP peristiwa gulir strip:
 *
 *   baca  strip.scrollWidth, strip.clientWidth     → menagih layout
 *   tulis prog.style.width, prog.style.marginLeft  → mengotori layout
 *   baca  el.offsetLeft untuk SEPULUH kartu        → menagih layout lagi
 *
 * Baca-tulis-baca itu memaksa layout sinkron di tengah gerakan jari. Dan
 * menggeser mendatar adalah satu-satunya cara melihat galeri, jadi ongkosnya
 * dibayar persis saat orang sedang menikmati fotonya.
 *
 * CARA KERJA SEKARANG. Posisi tiap kartu dan lebar penampung diukur SEKALI
 * lalu disimpan sebagai angka. Selama menggeser, yang dibaca cuma
 * `scrollLeft` — nilai yang sudah dipegang peramban dan tidak menagih apa
 * pun. Semua penulisan terjadi di akhir, jadi tidak ada pembacaan yang
 * menyusul untuk menagih hasilnya.
 *
 * Pengukuran ulang hanya saat ukurannya benar-benar berubah: layar diputar,
 * atau gambar mendarat dan mengubah lebar kartu. ResizeObserver yang
 * menangkapnya.
 */

interface Opsi {
  /** Penampung ber-`overflow-x`. */
  strip: HTMLElement;
  /** Batang di dalam `.rel` yang menunjukkan posisi. Boleh kosong. */
  prog?: HTMLElement | null;
  /** Rel thumbnail; anaknya diberi `aria-current`. Boleh kosong. */
  film?: HTMLElement | null;
  /** Tempat keterangan "3 / 10 — …". Boleh kosong. */
  info?: HTMLElement | null;
  /** Kalimat keterangan untuk kartu ke-`ke`. */
  teks?: (ke: number, jumlah: number) => string;
}

export interface Kendali {
  /** Hitung ulang posisi kartu — panggil kalau isi strip berubah. */
  ukur: () => void;
  /** Kartu-kartu strip, dipakai tombol thumbnail untuk melompat. */
  kartu: HTMLElement[];
}

export function pantauStrip({ strip, prog, film, info, teks }: Opsi): Kendali {
  const kartu = [...strip.children] as HTMLElement[];

  let kiri: number[] = [];
  let lebarIsi = 0;
  let lebarTampak = 0;

  const ukur = () => {
    kiri = kartu.map((k) => k.offsetLeft);
    lebarIsi = strip.scrollWidth;
    lebarTampak = strip.clientWidth;
  };

  let terakhir = -1;
  const gambar = () => {
    const maks = lebarIsi - lebarTampak;
    const geser = strip.scrollLeft;
    const rasio = maks > 0 ? geser / maks : 0;
    const lebar = lebarIsi > 0 ? Math.max(8, (lebarTampak / lebarIsi) * 100) : 100;

    let ke = 0;
    for (let i = 0; i < kiri.length; i++) if (kiri[i] - geser <= 40) ke = i;

    if (prog) {
      prog.style.width = lebar + "%";
      prog.style.marginLeft = rasio * (100 - lebar) + "%";
    }
    /* Penanda foto aktif hanya disentuh kalau memang BERPINDAH. Menulis
       atribut yang nilainya sudah sama tetap membatalkan gaya elemennya,
       dan di sini itu berarti sepuluh elemen per frame tanpa hasil apa pun. */
    if (ke === terakhir) return;
    terakhir = ke;
    if (info && teks) info.textContent = teks(ke, kartu.length);
    if (film) {
      for (let i = 0; i < film.children.length; i++) {
        film.children[i].setAttribute("aria-current", String(i === ke));
      }
    }
  };

  let antre = false;
  const jadwal = () => {
    if (antre) return;
    antre = true;
    requestAnimationFrame(() => { antre = false; gambar(); });
  };

  const ulang = () => { ukur(); terakhir = -1; gambar(); };

  ulang();
  strip.addEventListener("scroll", jadwal, { passive: true });
  addEventListener("resize", ulang, { passive: true });
  if ("ResizeObserver" in window) new ResizeObserver(ulang).observe(strip);

  return { ukur: ulang, kartu };
}
