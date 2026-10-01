/* =============================================================================
   Fokus papan ketik sesudah MENGHAPUS sesuatu.

   Dialog konfirmasi (Radix) mengembalikan fokus ke tombol yang membukanya.
   Tapi tombol itu biasanya milik kartu yang baru saja dihapus: begitu daftar
   digambar ulang, kartunya lenyap bersama tombolnya, dan fokus jatuh ke
   <body> — pemakai papan ketik terlempar ke awal halaman tanpa tanda apa pun.
   Terukur di tiga tempat sekaligus: kartu biaya di Catat Pengeluaran, logo
   di Logo Klien, dan orang di Tim Studio.

   Daftar yang barisnya berkunci URUTAN (tabel kit) tidak kena: elemen
   pemicunya dipakai ulang untuk baris berikutnya, jadi ia tetap ada.
   Karena itu cadangannya hanya dipakai kalau pemicunya memang lenyap.
   ============================================================================= */

const BISA_FOKUS =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Kontrol sesudah `el` dalam urutan dokumen yang benar-benar tergambar —
    atau sebelumnya, kalau `el` yang terakhir. Isi dialog dilewati: dialog
    konfirmasinya sendiri sedang terbuka saat ini dihitung. */
const bisaFokus = () =>
  [...document.querySelectorAll<HTMLElement>(BISA_FOKUS)].filter(
    (e) => e.getClientRects().length > 0 && !e.closest("[role=dialog], [role=alertdialog]"),
  );

function kontrolSesudah(el: HTMLElement): HTMLElement | null {
  const semua = bisaFokus().filter((e) => !el.contains(e));
  const sesudah = semua.find((e) => el.compareDocumentPosition(e) & Node.DOCUMENT_POSITION_FOLLOWING);
  return sesudah ?? semua.filter((e) => el.compareDocumentPosition(e) & Node.DOCUMENT_POSITION_PRECEDING).pop() ?? null;
}

/**
 * Menjalankan `kerja` (yang menghapus lalu memuat ulang daftar), lalu
 * memindahkan fokus ke kontrol sesudah `pemicu` kalau pemicunya ikut lenyap.
 * Cadangannya dicatat SEBELUM menghapus, selagi pemicunya masih ada.
 */
export async function jagaFokusSesudahHapus(pemicu: HTMLElement | null, kerja: () => unknown) {
  const cadangan = pemicu ? kontrolSesudah(pemicu) : null;
  await kerja();
  /* Dua penantian, keduanya terukur:
     - janji `kerja` selesai saat state DISETEL, bukan saat React selesai
       menggambar — tanpa menunggu, `isConnected` masih true;
     - dialog konfirmasi baru dilepas SESUDAH animasi tutupnya, dan saat
       itulah Radix mengembalikan fokus (ke pemicu yang sudah lenyap, jadi
       ke <body>). Fokus yang dipindahkan sebelum itu ditarik balik oleh
       perangkap fokus dialognya. Jadi ditunggu sampai tidak ada dialog
       terbuka, paling lama sekitar satu detik. */
  for (let i = 0; i < 60; i++) {
    await frame();
    if (!document.querySelector("[role=dialog], [role=alertdialog]")) break;
  }
  await frame();
  if (!pemicu || pemicu.isConnected || !cadangan?.isConnected) return;
  /* Jangan merebut fokus yang sudah dipindahkan pemakainya sendiri. */
  const aktif = document.activeElement;
  if (aktif && aktif !== document.body && aktif.isConnected) return;
  /* Cadangannya sendiri bisa MATI sesudah digambar ulang — terukur di Logo
     Klien: kontrol sesudah tombol hapus adalah "geser ke kiri" kartu
     berikutnya, yang jadi `disabled` begitu kartu itu naik ke urutan
     pertama, dan tombol mati tidak bisa difokus. Jadi yang difokus kontrol
     HIDUP pertama mulai dari cadangan itu. */
  const tujuan = bisaFokus().find((e) => e === cadangan || cadangan.compareDocumentPosition(e) & Node.DOCUMENT_POSITION_FOLLOWING);
  tujuan?.focus();
}

const frame = () => new Promise((r) => requestAnimationFrame(r));
