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
   * SELURUHNYA kosong sekarang, dan itu disengaja: sidebar Coinest tidak
   * punya satu pun kepala kelompok, dan kepala kelompok itulah yang paling
   * membuat punggung panel ini terbaca berbeda dari framenya. Yang
   * menggantikan pengelompokan adalah submenu ber-caret — bentuk yang memang
   * dipakai Coinest untuk "Payments".
   *
   * Bidangnya dipertahankan, bukan dibuang, supaya pengelompokan bisa
   * dihidupkan lagi tanpa menyentuh Sidebar maupun command palette.
   */
  group: string;

  /**
   * Sumber angka merah di kanan baris, seperti "Inbox 99" di Coinest.
   * Hanya "pesan" yang punya; sisanya tidak berangka.
   */
  lencana?: "pesan";
}

// Ikon dipilih agar cocok dengan labelnya, bukan sekadar mengisi ruang:
// denah bangunan untuk proyek, amplop untuk pesan masuk, lapisan untuk
// pustaka komponen.
export const NAV: NavItem[] = [
  { label: "Dashboard", href: "/admin", icon: "dashboard", group: "" },
  {
    label: "Proyek",
    icon: "project",
    group: "",
    children: [
      { label: "Semua Proyek", href: "/admin/proyek", icon: "list" },
      // Keduanya mengikuti proyek yang dipilih di combobox topbar. Semua
      // Proyek sengaja TIDAK ikut — ia daftar, bukan tampilan satu proyek.
      { label: "Portal Klien", href: "/admin/proyek/klien", icon: "document" },
      { label: "Halaman Publik", href: "/admin/proyek/publik", icon: "globe" },
    ],
  },
  { label: "Tugas", href: "/admin/list-kerjaan", icon: "checklist", group: "" },
  /* Ketiganya satu menu, bukan tiga baris berjajar. Alasan berdampingannya
     tidak berubah — angka fee LAHIR di Keuangan (diketik sekali lewat Catat
     pengeluaran) dan Gaji menjawab pertanyaan yang sama dari sisi bulan —
     tapi tiga baris setara membuat ketiganya terbaca sebagai tiga pembukuan
     yang harus dicocokkan. */
  {
    label: "Keuangan",
    icon: "finance",
    group: "",
    children: [
      { label: "Ringkasan", href: "/admin/keuangan", icon: "finance" },
      { label: "Fee Proyek", href: "/admin/fee", icon: "cash" },
      { label: "Gaji", href: "/admin/gaji", icon: "bank" },
    ],
  },
  /* Pesan Masuk membawa angka merah, sama seperti "Inbox 99" di Coinest —
     satu-satunya baris nav yang isinya berubah sendiri tanpa disentuh. */
  { label: "Pesan Masuk", href: "/admin/pesan", icon: "inquiry", group: "", lencana: "pesan" },
  { label: "Direktori", href: "/admin/direktori", icon: "directory", group: "" },
  { label: "Testimoni", href: "/admin/testimoni", icon: "quote", group: "" },
  { label: "Jurnal", href: "/admin/jurnal", icon: "document", group: "" },
  /* Enam halaman yang isinya dibaca PENGUNJUNG, dikumpulkan jadi satu menu.
     Sebelumnya tujuh baris datar di kelompok tersendiri — dan kelompoknya
     yang membuat sidebar ini tidak mungkin mirip Coinest, yang tidak punya
     satu pun kepala kelompok. */
  {
    label: "Situs Publik",
    icon: "globe",
    group: "",
    children: [
      { label: "Logo Klien", href: "/admin/halaman/klien", icon: "image" },
      { label: "Tim Studio", href: "/admin/halaman/tim", icon: "team" },
      { label: "Sebelum & Sesudah", href: "/admin/halaman/banding", icon: "camera" },
      { label: "Angka di FAQ", href: "/admin/halaman/faq", icon: "info" },
      { label: "Halaman Privasi", href: "/admin/halaman/privasi", icon: "lock" },
      { label: "Identitas Studio", href: "/admin/halaman/identitas", icon: "building" },
    ],
  },
  { label: "Tim & Freelancer", href: "/admin/tim", icon: "team", group: "" },
  {
    label: "Pengaturan",
    icon: "settings",
    group: "",
    children: [
      { label: "Info Studio", href: "/admin/pengaturan", icon: "info" },
      { label: "Akun", href: "/admin/pengaturan/akun", icon: "user" },
    ],
  },
  { label: "UI Component", href: "/admin/ui", icon: "component", group: "", masterOnly: true },
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
