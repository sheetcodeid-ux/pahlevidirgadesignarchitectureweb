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
   * String KOSONG berarti tanpa kepala kelompok — dipakai baris paling atas,
   * yang tidak perlu diberi judul karena ia sendirian dan selalu terlihat.
   */
  group: string;
}

// Ikon dipilih agar cocok dengan labelnya, bukan sekadar mengisi ruang:
// denah bangunan untuk proyek, amplop untuk pesan masuk, lapisan untuk
// pustaka komponen.
export const NAV: NavItem[] = [
  /* Tanpa kepala kelompok, seperti baris Dashboard di Coinest. Namanya
     "Hari Ini", bukan "Dashboard": yang dibukanya antrean pekerjaan hari ini
     — pesan yang belum dibalas, tenggat yang lewat, uang yang belum masuk —
     bukan papan angka untuk dipandangi. */
  { label: "Hari Ini", href: "/admin", icon: "dashboard", group: "" },

  /* --- Calon klien: yang terjadi SEBELUM sebuah proyek ada --------------- */
  /* Paling atas sesudah antrean karena inilah yang paling mahal kalau
     terlewat. Satu pesan yang tidak dibalas dua hari adalah satu proyek yang
     tidak pernah terjadi — dan dengan ~7 klien sebulan, itu terasa. */
  { label: "Pesan Masuk", href: "/admin/pesan", icon: "inquiry", group: "Calon klien" },
  { label: "Direktori", href: "/admin/direktori", icon: "directory", group: "Calon klien" },

  /* --- Pekerjaan: mengerjakan proyek yang sudah jadi ---------------------- */
  {
    label: "Proyek",
    icon: "project",
    group: "Pekerjaan",
    children: [
      { label: "Semua Proyek", href: "/admin/proyek", icon: "list" },
      // Mengikuti proyek yang dipilih di combobox topbar. Semua Proyek
      // sengaja TIDAK ikut — ia daftar, bukan tampilan satu proyek.
      { label: "Portal Klien", href: "/admin/proyek/klien", icon: "document" },
    ],
  },
  { label: "Tugas", href: "/admin/list-kerjaan", icon: "checklist", group: "Pekerjaan" },

  /* --- Uang --------------------------------------------------------------- */
  /* Ketiganya satu menu, bukan tiga baris berjajar. Alasan berdampingannya
     tidak berubah — angka fee LAHIR di Keuangan (diketik sekali lewat Catat
     pengeluaran) dan Gaji menjawab pertanyaan yang sama dari sisi bulan —
     tapi tiga baris setara membuat ketiganya terbaca sebagai tiga pembukuan
     yang harus dicocokkan. */
  {
    label: "Keuangan",
    icon: "finance",
    group: "Uang",
    children: [
      { label: "Ringkasan", href: "/admin/keuangan", icon: "finance" },
      { label: "Fee Proyek", href: "/admin/fee", icon: "cash" },
      { label: "Gaji", href: "/admin/gaji", icon: "bank" },
    ],
  },

  /* --- Reputasi: keluaran yang mendatangkan calon klien berikutnya -------- */
  /* Semuanya satu jenis pekerjaan: menyunting apa yang dibaca PENGUNJUNG.
     Bedanya nyata dari sisa panel — halaman di sini dibekukan saat build,
     jadi setiap perubahan di dalamnya perlu tombol Terbitkan ditekan,
     sementara Proyek dan Keuangan langsung berlaku.

     Datar, bukan menu yang harus dibuka dulu: pemilik datang ke sini untuk
     MENGISI satu hal tertentu ("tambahkan foto tim"), dan menu yang harus
     diklik dua kali menyembunyikan justru daftar yang jadi pengingatnya.

     Urutannya menurut seberapa besar pengaruhnya pada orang yang baru
     menemukan studio ini: karya dulu, lalu bukti sosial, lalu sisanya. */
  { label: "Halaman Proyek", href: "/admin/proyek/publik", icon: "project", group: "Reputasi" },
  { label: "Testimoni", href: "/admin/testimoni", icon: "quote", group: "Reputasi" },
  { label: "Jurnal", href: "/admin/jurnal", icon: "document", group: "Reputasi" },
  { label: "Sebelum & Sesudah", href: "/admin/halaman/banding", icon: "camera", group: "Reputasi" },
  { label: "Logo Klien", href: "/admin/halaman/klien", icon: "image", group: "Reputasi" },
  { label: "Tim Studio", href: "/admin/halaman/tim", icon: "team", group: "Reputasi" },

  /* --- Studio: orang dan setelan ------------------------------------------ */
  /* Paling bawah karena paling jarang disentuh. Tiga halaman "Situs Publik"
     lama ikut ke sini — identitas, angka FAQ, dan privasi bukan bahan
     pemasaran melainkan keterangan studio yang diisi sekali lalu ditinggal. */
  { label: "Tim & Freelancer", href: "/admin/tim", icon: "team", group: "Studio" },
  { label: "Identitas Studio", href: "/admin/halaman/identitas", icon: "building", group: "Studio" },
  { label: "Angka di FAQ", href: "/admin/halaman/faq", icon: "info", group: "Studio" },
  { label: "Halaman Privasi", href: "/admin/halaman/privasi", icon: "lock", group: "Studio" },
  {
    label: "Pengaturan",
    icon: "settings",
    group: "Studio",
    children: [
      { label: "Info Studio", href: "/admin/pengaturan", icon: "info" },
      { label: "Akun", href: "/admin/pengaturan/akun", icon: "user" },
    ],
  },
  { label: "UI Component", href: "/admin/ui", icon: "component", group: "Studio", masterOnly: true },
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
