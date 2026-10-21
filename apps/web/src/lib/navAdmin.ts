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
  { label: "Dashboard", href: "/admin", icon: "dashboard", ikonKit: "ArsLembar", group: "Utama" },
  /* Lima angka target dokumen strategi §8 — fase 4. */
  { label: "KPI Strategi", href: "/admin/kpi", icon: "finance", ikonKit: "ArsPeil", group: "Utama" },
  { label: "Tugas", href: "/admin/list-kerjaan", icon: "checklist", ikonKit: "ArsDaftarPeriksa", group: "Utama" },
  /* Pesan Masuk membawa angka merah, sama seperti "Inbox 99" di Coinest —
     satu-satunya baris nav yang isinya berubah sendiri tanpa disentuh. */
  { label: "Pesan Masuk", href: "/admin/pesan", icon: "inquiry", ikonKit: "ArsSuratPengantar", group: "Utama", lencana: "pesan" },
  /* Cara memakai panel, langkah demi langkah — permintaan pemilik. Di Utama
     supaya terlihat tanpa menggulir rel. */
  { label: "Panduan", href: "/admin/panduan", icon: "info", ikonKit: "ArsArahUtara", group: "Utama" },
  {
    label: "Proyek",
    icon: "project",
    ikonKit: "ArsTampakRumah",
    group: "Pekerjaan",
    children: [
      { label: "Semua Proyek", href: "/admin/proyek", icon: "list", ikonKit: "ArsOrdner" },
      // Keduanya mengikuti proyek yang dipilih di combobox topbar. Semua
      // Proyek sengaja TIDAK ikut — ia daftar, bukan tampilan satu proyek.
      { label: "Portal Klien", href: "/admin/proyek/klien", icon: "document", ikonKit: "ArsKunciRumah" },
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
    ikonKit: "ArsKurvaS",
    group: "Pekerjaan",
    children: [
      { label: "Ringkasan", href: "/admin/keuangan", icon: "finance", ikonKit: "ArsRekap" },
      { label: "Terima Pembayaran", href: "/admin/keuangan/terima", icon: "cash", ikonKit: "ArsKartuBayar" },
      { label: "Catat Pengeluaran", href: "/admin/keuangan/keluar", icon: "cash", ikonKit: "ArsNotaPaku" },
      { label: "Semua Transaksi", href: "/admin/keuangan/transaksi", icon: "list", ikonKit: "ArsKertasLubang" },
      /* Uang di luar proyek (PVC, bagi hasil, konsumsi, sewa) + target semester
         — sheet "KELUAR MASUK". */
      { label: "Kas Studio", href: "/admin/keuangan/kas", icon: "bank", ikonKit: "ArsMesinKas" },
      { label: "Tagihan & Termin", href: "/admin/keuangan/tagihan", icon: "cash", ikonKit: "ArsTermin" },
      { label: "Fee Proyek", href: "/admin/fee", icon: "cash", ikonKit: "ArsKuitansi" },
      { label: "Gaji", href: "/admin/gaji", icon: "bank", ikonKit: "ArsBukuGaji" },
      /* Hak, dibayar, terutang, dan slip per orang — sheet "GAJI <nama>". */
      { label: "Bayaran Tim", href: "/admin/gaji/tim", icon: "team", ikonKit: "ArsAmplopGaji" },
    ],
  },
  /* Orang di luar dan di dalam studio. */
  { label: "Direktori", href: "/admin/direktori", icon: "directory", ikonKit: "ArsKartuIndeks", group: "Relasi" },
  { label: "Tim & Freelancer", href: "/admin/tim", icon: "team", ikonKit: "ArsSkalaManusia", group: "Relasi" },
  { label: "Testimoni", href: "/admin/testimoni", icon: "quote", ikonKit: "ArsAwanRevisi", group: "Relasi" },
  /* Kategori Pengaturan: isinya baris DATAR, bukan submenu "Pengaturan" di
     dalam kategori "Pengaturan" — dua tingkat bernama sama untuk dua baris. */
  /* masterOnly: halamannya memang hanya untuk master (`RequireAuth masterOnly`
     di InfoStudioKit). Tanpa tanda ini rel menawarkannya ke staf, lalu
     halamannya menolak dengan "Tidak bisa memuat panel". */
  { label: "Info Studio", href: "/admin/pengaturan", icon: "info", ikonKit: "ArsMejaGambar", group: "Pengaturan", masterOnly: true },
  /* Persen tiap peran tim desain — dibaca Proyek Baru dan Tim & Bayaran. */
  { label: "Aturan Fee Tim", href: "/admin/pengaturan/fee", icon: "cash", ikonKit: "ArsJangka", group: "Pengaturan" },
  { label: "Akun", href: "/admin/pengaturan/akun", icon: "user", ikonKit: "ArsAkun", group: "Pengaturan" },
  /* Ke pustaka komponen KIT, bukan /admin/ui: /admin/ui berisi sistem lama di
     kerangka lama, dan menu yang membawa ke tampilan lain sama sekali terbaca
     sebagai panel yang rusak. /admin/ui masih bisa dibuka lewat alamatnya. */
  { label: "UI Component", href: "/admin/kit", icon: "component", ikonKit: "ArsMal", group: "Pengaturan", masterOnly: true },
];

/* =============================================================================
   NOMOR LEMBAR — rel samping adalah DAFTAR GAMBAR sebuah set gambar kerja.

   Tiap halaman bernomor seperti lembar gambar (U-01, P-22): huruf depannya
   kode disiplin = kategori, angkanya urutan di kategori itu. Kategori yang
   punya submenu memakai SERI PULUHAN seperti seri gambar kerja (A-100 denah,
   A-200 tampak): induk ke-n bernomor n0, anaknya n1, n2, … — jadi Keuangan
   P-20 dan Terima Pembayaran P-22. Kategori tanpa submenu bernomor urut
   biasa (U-01 … U-05).

   Dihitung dari NAV LENGKAP, bukan dari baris yang tampil untuk satu peran,
   supaya satu halaman bernomor sama di akun mana pun — staf yang tidak melihat
   Info Studio tetap menyebut Akun "G-03", sama dengan master.

   Satu fungsi, dua pemakai: baris rel (kolom nomor) dan kop gambar di kaki
   rel (lembar yang sedang dibuka). Dua tempat yang menghitung sendiri pasti
   suatu saat tidak sepakat (jebakan #32).
   ============================================================================= */

/** Kode disiplin tiap kategori — huruf depan nomor lembar. */
export const KODE_KELOMPOK: Record<string, string> = {
  Utama: "U",
  Pekerjaan: "P",
  Relasi: "R",
  Pengaturan: "G",
};

export interface Lembar {
  kode: string;
  label: string;
  href: string;
  kelompok: string;
  /** Ikon arsitekturnya — sama dengan barisnya di rel. */
  ikon: NamaIkonNav;
  masterOnly?: boolean;
  /** Label induknya kalau lembar ini anak submenu. */
  induk?: string;
}

export interface DaftarLembar {
  /** Semua halaman, urut rel. */
  halaman: Lembar[];
  /** Nomor seri induk submenu, menurut labelnya (Keuangan → "P-20"). */
  induk: Map<string, string>;
}

const dua = (n: number) => String(n).padStart(2, "0");

/* Dihitung sekali: NAV tidak berubah selama halaman hidup, dan rel, kepala
   halaman, serta palet perintah semuanya memintanya. */
let daftarTersimpan: DaftarLembar | null = null;

export function daftarLembar(): DaftarLembar {
  return (daftarTersimpan ??= hitungLembar());
}

function hitungLembar(): DaftarLembar {
  const halaman: Lembar[] = [];
  const induk = new Map<string, string>();
  const urutan = new Map<string, number>();
  const berseri = new Set(NAV.filter((n) => n.children).map((n) => n.group));
  for (const n of NAV) {
    const huruf = KODE_KELOMPOK[n.group] ?? n.group.slice(0, 1).toUpperCase();
    const ke = (urutan.get(n.group) ?? 0) + 1;
    urutan.set(n.group, ke);
    if (n.children) {
      /* Lebih dari sembilan anak akan menabrak seri berikutnya (P-20 + 10 =
         P-30). Dilaporkan, bukan diam-diam salah nomor. */
      if (n.children.length > 9) console.warn(`[navAdmin] ${n.label} punya ${n.children.length} anak — nomor lembarnya bertabrakan`);
      induk.set(n.label, `${huruf}-${ke}0`);
      n.children.forEach((c, j) =>
        halaman.push({ kode: `${huruf}-${ke}${j + 1}`, label: c.label, href: c.href, kelompok: n.group, ikon: c.ikonKit, induk: n.label }),
      );
    } else {
      const kode = berseri.has(n.group) ? `${huruf}-${ke}0` : `${huruf}-${dua(ke)}`;
      halaman.push({ kode, label: n.label, href: n.href!, kelompok: n.group, ikon: n.ikonKit, masterOnly: n.masterOnly });
    }
  }
  return { halaman, induk };
}

/** Path tanpa garis miring di ujung — `Astro.url.pathname` statis berakhir
    dengan "/", navAdmin menulisnya tanpa. */
export const rapiPath = (p: string): string => (p.length > 1 && p.endsWith("/") ? p.slice(0, -1) : p);

/**
 * Lembar milik sebuah path. Persis, atau `<daftar>/satu` (Satu Proyek,
 * Detail Paket, Detail Tulisan) — sama dengan baris yang menyala di rel.
 * Halaman turunan tanpa baris sendiri (Proyek Baru) memakai lembar dengan
 * awalan path TERPANJANG, ditandai `turunan`; "/admin" sendiri tidak
 * dihitung sebagai awalan, supaya Notifikasi tidak mengaku Dashboard.
 */
export function lembarUntuk(path: string, daftar: Lembar[]): { lembar: Lembar; turunan: boolean } | null {
  const kini = rapiPath(path);
  const persis = daftar.find((l) => rapiPath(l.href) === kini || `${rapiPath(l.href)}/satu` === kini);
  if (persis) return { lembar: persis, turunan: false };
  let terbaik: Lembar | null = null;
  for (const l of daftar) {
    const h = rapiPath(l.href);
    if (h === "/admin" || !kini.startsWith(h + "/")) continue;
    if (!terbaik || h.length > rapiPath(terbaik.href).length) terbaik = l;
  }
  return terbaik ? { lembar: terbaik, turunan: true } : null;
}

/** Lembar yang TAMPIL untuk peran ini — staf tidak menghitung lembar master. */
export const lembarTampil = (master: boolean | undefined): Lembar[] =>
  daftarLembar().halaman.filter((l) => !l.masterOnly || master);

export interface PosisiLembar {
  dibuka: { lembar: Lembar; turunan: boolean } | null;
  /** Urutan lembar yang dibuka di antara yang tampil, mulai 1 (0 = tidak ada). */
  urut: number;
  jumlah: number;
  /** "10 / 32", "lampiran", atau "di luar daftar" — kop rel dan kepala halaman. */
  keterangan: string;
}

/** Letak satu path di set gambar — SATU rumusan untuk kop di kaki rel dan
    jalur di kepala halaman, supaya dua tempat yang menulis "10 / 32" di layar
    yang sama tidak bisa berbeda (jebakan #32). */
export function posisiLembar(path: string, tampil: Lembar[]): PosisiLembar {
  const dibuka = lembarUntuk(path, tampil);
  const urut = dibuka ? tampil.indexOf(dibuka.lembar) + 1 : 0;
  return {
    dibuka,
    urut,
    jumlah: tampil.length,
    keterangan: dibuka ? (dibuka.turunan ? "lampiran" : `${urut} / ${tampil.length}`) : "di luar daftar",
  };
}

/**
 * Butir per NOMOR LEMBAR dari butir per path (`revisiPerHalaman`). Halaman
 * tujuan tiap butir dipetakan ke lembarnya — persis, atau awalan terpanjang
 * ("/admin/proyek/edit" milik Semua Proyek). Satu rumusan untuk kolom REV
 * rel samping dan kolom REV palet perintah (jebakan #32).
 */
export function revisiPerLembar(perHalaman: Record<string, number>): Map<string, number> {
  const hasil = new Map<string, number>();
  const semua = daftarLembar().halaman;
  for (const [jalur, n] of Object.entries(perHalaman)) {
    const l = lembarUntuk(jalur, semua);
    if (l) hasil.set(l.lembar.kode, (hasil.get(l.lembar.kode) ?? 0) + n);
  }
  return hasil;
}

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
