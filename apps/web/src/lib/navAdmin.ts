import type { NamaIkonNav } from "../components/admin/RelKit";
import type { IconName } from "../components/ui/Icon";

/* =============================================================================
   Peta navigasi panel admin — SATU daftar, dua pemakai.

   Sidebar dan command palette dulu punya daftarnya sendiri-sendiri, dan
   keduanya sudah menyimpang: palet menawarkan "Analisis Bulanan" ke
   /admin/keuangan/bulanan yang halamannya TIDAK ADA (404), sementara sembilan
   halaman yang sungguhan — Fee Proyek, Gaji, Jurnal, Akun, dan enam halaman
   Situs Publik — tidak pernah bisa dicari dari palet sama sekali.

   Dua daftar berisi hal yang sama pasti menyimpang suatu saat; yang kedua
   biasanya yang jarang dilihat. Jadi daftarnya satu di sini, dan palet
   meratakannya sendiri.

   ---------------------------------------------------------------------------
   URUTAN KELOMPOKNYA DITURUNKAN DARI BISNISNYA, BUKAN DARI TABEL DATABASE.

   Susunan sebelumnya ("Utama" berisi sebelas baris, lalu "Situs Publik", lalu
   "Sistem") adalah bentuk skemanya: satu baris untuk tiap tabel. Itu masuk
   akal bagi yang menulis migrasinya, dan tidak berarti apa-apa bagi orang
   yang bisnisnya arsitektur.

   Dokumen strategi studio menyebut satu lingkaran: coffee shop jadi mesin
   reputasi, reputasi mendatangkan calon klien, calon klien jadi proyek,
   proyek menghasilkan uang DAN foto, foto kembali jadi reputasi. Kelompok di
   bawah ini adalah lingkaran itu, urut:

     Hari ini    — antrean: apa yang menunggu saya sekarang
     Calon klien — sebelum proyek ada: pesan masuk dan daftar kontak
     Pekerjaan   — mengerjakan proyek: fase, tugas, dokumen, portal klien
     Uang        — termin masuk, biaya keluar, laba per proyek dan per bulan
     Reputasi    — keluaran yang mendatangkan calon klien berikutnya
     Studio      — orang dan setelan; yang paling jarang disentuh, paling bawah

   Tidak ada halaman yang hilang — yang berubah rumahnya, dan urutan orang
   menemukannya. "Tim & Freelancer" masuk Studio (itu orangnya), sementara
   "Tim Studio" masuk Reputasi (itu halaman yang dibaca pengunjung); keduanya
   memang beda pekerjaan walau namanya mirip.
   ============================================================================= */

export interface SubItem {
  label: string;
  href: string;
  icon: IconName;
  /** Lihat `NavItem.ikonKit`. */
  ikonKit: NamaIkonNav;
}

export interface NavItem {
  label: string;
  href?: string;
  icon: IconName;
  children?: SubItem[];
  /** Hanya tampil untuk master admin. */
  masterOnly?: boolean;
  /**
   * Label kelompok kecil di atas item.
   *
   * Digambar rel kit sebagai kepala kategori bergaris batas — setiap kali
   * nilainya berganti dari baris sebelumnya. Baris yang berurutan dengan
   * kelompok sama harus BERDEKATAN di daftar ini.
   */
  group: string;

  /**
   * Sumber angka merah di kanan baris, seperti "Inbox 99" di Coinest.
   * Hanya "pesan" yang punya; sisanya tidak berangka.
   */
  lencana?: "pesan";

  /**
   * Nama ikon di pustaka kit (`components/kit/ikon`), sebagai STRING.
   *
   * Kenapa string dan bukan komponennya: berkas ini dipakai command palette
   * dan sidebar LAMA juga, dan keduanya berjalan di luar kit. Mengimpor
   * komponen React ke sini menyeret seluruh pustaka ikon kit ke tiap
   * pemakainya. Yang memakai kit meresolusinya lewat `IKON_NAV` di RelKit.
   *
   * Kenapa di berkas INI dan bukan di daftar sendiri: dua daftar berisi hal
   * yang sama pasti menyimpang, dan yang jarang dilihat yang salah — persis
   * cacat yang membuat berkas ini ada.
   */
  ikonKit: NamaIkonNav;
}

// Ikon dipilih agar cocok dengan labelnya, bukan sekadar mengisi ruang:
// denah bangunan untuk proyek, amplop untuk pesan masuk, lapisan untuk
// pustaka komponen.
export const NAV: NavItem[] = [
  /* KATEGORI — permintaan pemilik: "sidebar dibuat berdasarkan kategori,
     contoh kategori setting isinya apa, kategori utama apa". Membalik
     keputusan lama yang membuang kepala kelompok karena sidebar Coinest
     tidak punya; bentrok dengan frame itu disebutkan terbuka ke pemilik.
     Urutannya tetap lingkaran bisnis di atas: yang dikerjakan tiap hari di
     atas, setelan paling bawah. */
  { label: "Dashboard", href: "/admin", icon: "dashboard", ikonKit: "NavSquaresFour", group: "Utama" },
  /* Lima angka target dokumen strategi §8 — fase 4. */
  { label: "KPI Strategi", href: "/admin/kpi", icon: "finance", ikonKit: "Medal", group: "Utama" },
  { label: "Tugas", href: "/admin/list-kerjaan", icon: "checklist", ikonKit: "SpecialCheckSquare", group: "Utama" },
  /* Pesan Masuk membawa angka merah, sama seperti "Inbox 99" di Coinest —
     satu-satunya baris nav yang isinya berubah sendiri tanpa disentuh. */
  { label: "Pesan Masuk", href: "/admin/pesan", icon: "inquiry", ikonKit: "NavEnvelope", group: "Utama", lencana: "pesan" },
  {
    label: "Proyek",
    icon: "project",
    ikonKit: "Ruler",
    group: "Pekerjaan",
    children: [
      { label: "Semua Proyek", href: "/admin/proyek", icon: "list", ikonKit: "List" },
      // Keduanya mengikuti proyek yang dipilih di combobox topbar. Semua
      // Proyek sengaja TIDAK ikut — ia daftar, bukan tampilan satu proyek.
      { label: "Portal Klien", href: "/admin/proyek/klien", icon: "document", ikonKit: "UserCircle" },
      { label: "Halaman Publik", href: "/admin/proyek/publik", icon: "globe", ikonKit: "Globe" },
    ],
  },
  /* Ketiganya satu menu, bukan tiga baris berjajar. Alasan berdampingannya
     tidak berubah — angka fee LAHIR di Keuangan (diketik sekali lewat Catat
     pengeluaran) dan Gaji menjawab pertanyaan yang sama dari sisi bulan —
     tapi tiga baris setara membuat ketiganya terbaca sebagai tiga pembukuan
     yang harus dicocokkan. */
  {
    label: "Keuangan",
    icon: "finance",
    ikonKit: "NavCoins",
    group: "Pekerjaan",
    children: [
      { label: "Ringkasan", href: "/admin/keuangan", icon: "finance", ikonKit: "ChartBar" },
      { label: "Terima Pembayaran", href: "/admin/keuangan/terima", icon: "cash", ikonKit: "CoinIn" },
      { label: "Catat Pengeluaran", href: "/admin/keuangan/keluar", icon: "cash", ikonKit: "CoinOut" },
      { label: "Semua Transaksi", href: "/admin/keuangan/transaksi", icon: "list", ikonKit: "NavArrowsLeftRight" },
      /* Uang di luar proyek (PVC, bagi hasil, konsumsi, sewa) + target semester
         — sheet "KELUAR MASUK". */
      { label: "Kas Studio", href: "/admin/keuangan/kas", icon: "bank", ikonKit: "CoinVertical" },
      { label: "Tagihan & Termin", href: "/admin/keuangan/tagihan", icon: "cash", ikonKit: "NavReceipt" },
      { label: "Fee Proyek", href: "/admin/fee", icon: "cash", ikonKit: "NavCurrencyCircleDollar" },
      { label: "Gaji", href: "/admin/gaji", icon: "bank", ikonKit: "Wallet" },
      /* Hak, dibayar, terutang, dan slip per orang — sheet "GAJI <nama>". */
      { label: "Bayaran Tim", href: "/admin/gaji/tim", icon: "team", ikonKit: "Users" },
    ],
  },
  /* Orang di luar dan di dalam studio. "Tim & Freelancer" di sini (orangnya),
     "Tim Studio" di Konten Situs (halaman yang dibaca pengunjung). */
  { label: "Direktori", href: "/admin/direktori", icon: "directory", ikonKit: "IdentificationBadge", group: "Relasi" },
  { label: "Tim & Freelancer", href: "/admin/tim", icon: "team", ikonKit: "Users", group: "Relasi" },
  { label: "Testimoni", href: "/admin/testimoni", icon: "quote", ikonKit: "ChatTeardropDots", group: "Relasi" },
  { label: "Jurnal", href: "/admin/jurnal", icon: "document", ikonKit: "NavNewspaper", group: "Konten Situs" },
  /* Halaman yang isinya dibaca PENGUNJUNG, dikumpulkan jadi satu menu. */
  {
    label: "Situs Publik",
    icon: "globe",
    ikonKit: "Globe",
    group: "Konten Situs",
    children: [
      { label: "Paket Layanan", href: "/admin/paket", icon: "cash", ikonKit: "NavSealPercent" },
      { label: "Logo Klien", href: "/admin/halaman/klien", icon: "image", ikonKit: "ImageSquare" },
      { label: "Tim Studio", href: "/admin/halaman/tim", icon: "team", ikonKit: "Users" },
      { label: "Sebelum & Sesudah", href: "/admin/halaman/banding", icon: "camera", ikonKit: "ArrowsLeftRight" },
      { label: "Angka di FAQ", href: "/admin/halaman/faq", icon: "info", ikonKit: "Question" },
      { label: "Halaman Privasi", href: "/admin/halaman/privasi", icon: "lock", ikonKit: "FileText" },
      { label: "Identitas Studio", href: "/admin/halaman/identitas", icon: "building", ikonKit: "House" },
    ],
  },
  /* Kategori Pengaturan: isinya baris DATAR, bukan submenu "Pengaturan" di
     dalam kategori "Pengaturan" — dua tingkat bernama sama untuk dua baris. */
  { label: "Info Studio", href: "/admin/pengaturan", icon: "info", ikonKit: "GearSix", group: "Pengaturan" },
  /* Persen tiap peran tim desain — dibaca Proyek Baru dan Tim & Bayaran. */
  { label: "Aturan Fee Tim", href: "/admin/pengaturan/fee", icon: "cash", ikonKit: "NavSealPercent", group: "Pengaturan" },
  { label: "Akun", href: "/admin/pengaturan/akun", icon: "user", ikonKit: "UserCircle", group: "Pengaturan" },
  /* Ke pustaka komponen KIT, bukan /admin/ui: /admin/ui berisi sistem lama di
     kerangka lama, dan menu yang membawa ke tampilan lain sama sekali terbaca
     sebagai panel yang rusak. /admin/ui masih bisa dibuka lewat alamatnya. */
  { label: "UI Component", href: "/admin/kit", icon: "component", ikonKit: "SpecialCube", group: "Pengaturan", masterOnly: true },
];

/**
 * Semua halaman yang bisa dituju, rata — dipakai command palette.
 *
 * Induk yang punya anak TIDAK ikut: ia tombol pembuka menu, bukan halaman.
 * Yang masuk anak-anaknya, dinamai "Induk — Anak" supaya "Gaji" dan
 * "Ringkasan" tetap bisa dibedakan dari daftar yang datar.
 */
export function halamanRata(): { label: string; icon: IconName; href: string; masterOnly?: boolean }[] {
  return NAV.flatMap((i) =>
    i.children
      ? i.children.map((c) => ({ label: `${i.label} — ${c.label}`, icon: c.icon, href: c.href }))
      : [{ label: i.label, icon: i.icon, href: i.href!, masterOnly: i.masterOnly }],
  );
}
