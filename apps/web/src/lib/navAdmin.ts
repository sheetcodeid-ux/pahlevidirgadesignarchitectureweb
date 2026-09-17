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
  /** Label kelompok kecil di atas item — mengelompokkan sidebar seperti bagian di halaman panjang. */
  group: string;
}

// Ikon dipilih agar cocok dengan labelnya, bukan sekadar mengisi ruang:
// denah bangunan untuk proyek, amplop untuk pesan masuk, lapisan untuk
// pustaka komponen.
export const NAV: NavItem[] = [
  { label: "Dashboard", href: "/admin", icon: "dashboard", group: "Utama" },
  {
    label: "Proyek",
    icon: "project",
    group: "Utama",
    children: [
      { label: "Semua Proyek", href: "/admin/proyek", icon: "list" },
      // Keduanya mengikuti proyek yang dipilih di combobox topbar. Semua
      // Proyek sengaja TIDAK ikut — ia daftar, bukan tampilan satu proyek.
      //
      // Yang ketiga, "Halaman Publik", pindah ke kelompok Situs Publik atas
      // permintaan pemilik: isinya memang yang dilihat pengunjung, dan dia
      // mencarinya di sana. Halamannya tidak berubah dan tetap mengikuti
      // combobox yang sama — yang pindah cuma tautannya.
      { label: "Portal Klien", href: "/admin/proyek/klien", icon: "document" },
    ],
  },
  { label: "Tugas", href: "/admin/list-kerjaan", icon: "checklist", group: "Utama" },
  /* Ketiganya satu menu, bukan tiga baris berjajar. Alasan berdampingannya
     tidak berubah — angka fee LAHIR di Keuangan (diketik sekali lewat Catat
     pengeluaran) dan Gaji menjawab pertanyaan yang sama dari sisi bulan —
     tapi tiga baris setara membuat ketiganya terbaca sebagai tiga pembukuan
     yang harus dicocokkan. Sebagai satu menu bernama Keuangan dengan tiga
     isi, hubungannya terbaca sebelum satu pun halaman dibuka.
     Anaknya diberi nama "Ringkasan", bukan "Keuangan" lagi, karena induknya
     sudah menyandang nama itu. */
  {
    label: "Keuangan",
    icon: "finance",
    group: "Utama",
    children: [
      { label: "Ringkasan", href: "/admin/keuangan", icon: "finance" },
      { label: "Fee Proyek", href: "/admin/fee", icon: "cash" },
      { label: "Gaji", href: "/admin/gaji", icon: "bank" },
    ],
  },
  { label: "Tim & Freelancer", href: "/admin/tim", icon: "team", group: "Utama" },
  /* Pesan Masuk sengaja TIDAK ikut dikelompokkan ke mana pun. Isinya calon
     klien dari form kontak, dan satu klik tambahan untuk menemukannya adalah
     satu klik yang kadang tidak terjadi. */
  { label: "Pesan Masuk", href: "/admin/pesan", icon: "inquiry", group: "Utama" },
  { label: "Direktori", href: "/admin/direktori", icon: "directory", group: "Utama" },
  { label: "Testimoni", href: "/admin/testimoni", icon: "quote", group: "Utama" },
  { label: "Jurnal", href: "/admin/jurnal", icon: "document", group: "Utama" },

  /* Kelompok sendiri bernama "Situs Publik", datar — bukan menu yang harus
   * dibuka dulu.
   *
   * Datar karena pemilik datang ke sini untuk MENGISI satu hal tertentu
   * ("tambahkan foto tim"), bukan untuk menjelajah; menu yang harus diklik
   * dua kali menyembunyikan justru daftar yang jadi pengingatnya. Namanya
   * "Situs Publik", bukan "Halaman Publik", karena label kedua dulu dipakai
   * submenu Proyek — dan sekarang ia sendiri sudah pindah ke sini sebagai
   * "Halaman Proyek", jadi dua label serupa di satu kelompok akan lebih
   * membingungkan lagi.
   *
   * Isinya satu jenis pekerjaan yang jelas: menyunting apa yang dibaca
   * PENGUNJUNG. Bedanya nyata dari sisa panel — halaman di sini dibekukan
   * saat build, jadi setiap perubahan di dalamnya perlu tombol Terbitkan
   * ditekan, sementara Proyek dan Keuangan langsung berlaku.
   *
   * Semua isinya dulu di-hardcode di lib/menunggu.ts dan hanya bisa diubah
   * dengan menyunting repo — yang tidak pernah dilakukan pemilik. Akibatnya
   * nama staf kedua, foto tim, foto sebelum/sesudah, empat isian privasi,
   * dan empat angka FAQ sudah berbulan menampilkan penanda "menunggu" di
   * situs yang tayang. */
  /* Satu-satunya di kelompok ini yang mengikuti proyek terpilih di bilah atas;
     sisanya berlaku untuk seluruh studio. Ditaruh paling atas karena ia yang
     paling sering disentuh — judul, galeri, dan SEO tiap karya. */
  { label: "Halaman Proyek", href: "/admin/proyek/publik", icon: "project", group: "Situs Publik" },
  { label: "Logo Klien", href: "/admin/halaman/klien", icon: "image", group: "Situs Publik" },
  { label: "Tim Studio", href: "/admin/halaman/tim", icon: "team", group: "Situs Publik" },
  { label: "Sebelum & Sesudah", href: "/admin/halaman/banding", icon: "camera", group: "Situs Publik" },
  { label: "Angka di FAQ", href: "/admin/halaman/faq", icon: "info", group: "Situs Publik" },
  { label: "Halaman Privasi", href: "/admin/halaman/privasi", icon: "lock", group: "Situs Publik" },
  { label: "Identitas Studio", href: "/admin/halaman/identitas", icon: "building", group: "Situs Publik" },
  {
    label: "Pengaturan",
    icon: "settings",
    group: "Sistem",
    children: [
      { label: "Info Studio", href: "/admin/pengaturan", icon: "info" },
      { label: "Akun", href: "/admin/pengaturan/akun", icon: "user" },
    ],
  },
  { label: "UI Component", href: "/admin/ui", icon: "component", group: "Sistem", masterOnly: true },
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
