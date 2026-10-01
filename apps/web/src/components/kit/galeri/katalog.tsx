import type { ComponentType } from "react";
import type { DataIkon } from "../Ikon";
import {
  ChatTeardropDots,
  CursorClick,
  GridFour,
  ImageSquare,
  List,
  NotePencil,
  SidebarSimple,
  SpecialWarning,
  ChartBar,
} from "../ikon";
import * as A from "./demoSatu";
import * as B from "./demoDua";

/* =============================================================================
   Katalog galeri — 62 komponen dalam 8 folder.

   SATU-SATUNYA daftar komponen. Halaman UI Component digambar dari sini, dan
   pemindai pemakaian di `pages/admin/kit.astro` membaca `modul` + `ekspor`
   untuk menghitung halaman mana yang memakainya — jadi angka "dipakai di"
   tidak bisa basi: ia dihitung ulang tiap build dari kode sumbernya.

   `nama` memakai istilah yang dipakai pemilik (istilah umum pustaka UI);
   `kit` nama komponennya di kode.
   ============================================================================= */

export interface Entri {
  id: string;
  nama: string;
  kit: string;
  /** Berkas sumber relatif ke components/, tanpa ekstensi — mis. "kit/Overlay". */
  modul: string;
  /** Nama ekspor yang dihitung sebagai pemakaian. */
  ekspor: string[];
  ket: string;
  Demo: ComponentType;
}

export interface Folder {
  id: string;
  nama: string;
  ket: string;
  ikon: DataIkon;
  isi: Entri[];
}

export const KATALOG: Folder[] = [
  {
    id: "aksi",
    nama: "Aksi",
    ket: "Tombol dan kontrol yang menjalankan sesuatu.",
    ikon: CursorClick,
    isi: [
      { id: "button", nama: "Button", kit: "Tombol", modul: "kit/Tombol", ekspor: ["Tombol", "TombolIkon"], ket: "Lima jenis (utama, sekunder, garis, transparan, bahaya), tiga ukuran, dan keadaan memuat.", Demo: A.DemoTombol },
      { id: "button-group", nama: "Button Group", kit: "KelompokTombol", modul: "kit/Formulir", ekspor: ["KelompokTombol"], ket: "Beberapa tombol yang menyatu jadi satu bidang — ekspor, simpan dengan pilihan.", Demo: A.DemoKelompokTombol },
      { id: "toggle", nama: "Toggle", kit: "Tuas", modul: "kit/Formulir", ekspor: ["Tuas"], ket: "Tombol yang tetap tertekan: menyalakan atau mematikan satu hal.", Demo: A.DemoTuas },
      { id: "toggle-group", nama: "Toggle Group", kit: "KelompokTuas", modul: "kit/Formulir", ekspor: ["KelompokTuas"], ket: "Sekumpulan tuas — satu pilihan (tampilan tabel/papan) atau beberapa sekaligus (kolom yang tampil).", Demo: A.DemoKelompokTuas },
      { id: "kbd", nama: "Kbd", kit: "Tuts", modul: "kit/Tampilan", ekspor: ["Tuts"], ket: "Tuts papan ketik untuk pintasan.", Demo: A.DemoTuts },
    ],
  },
  {
    id: "formulir",
    nama: "Formulir",
    ket: "Semua yang menerima isian.",
    ikon: NotePencil,
    isi: [
      { id: "input", nama: "Input", kit: "Isian · Cari", modul: "kit/Isian", ekspor: ["Isian", "Cari"], ket: "Kotak isian berlabel dan kotak cari — diukur dari frame Forms Coinest.", Demo: A.DemoIsian },
      { id: "input-group", nama: "Input Group", kit: "KelompokIsian", modul: "kit/Formulir", ekspor: ["KelompokIsian"], ket: "Isian dengan tempelan di kiri atau kanan: Rp, m², https://.", Demo: A.DemoKelompokIsian },
      { id: "textarea", nama: "Textarea", kit: "IsianPanjang", modul: "kit/Formulir", ekspor: ["IsianPanjang"], ket: "Isian banyak baris; bisa ditarik lebih tinggi.", Demo: A.DemoTeksarea },
      { id: "label", nama: "Label", kit: "Label", modul: "kit/Formulir", ekspor: ["Label"], ket: "Nama isian, dengan tanda wajib.", Demo: A.DemoLabel },
      { id: "field", nama: "Field", kit: "Bidang", modul: "kit/Formulir", ekspor: ["Bidang"], ket: "Label + kontrol + bantuan + galat, untuk kontrol apa pun. Galat menggantikan bantuan.", Demo: A.DemoBidang },
      { id: "checkbox", nama: "Checkbox", kit: "Centang", modul: "kit/Isian", ekspor: ["Centang"], ket: "Kotak centang asli berkulit kit, tiga ukuran.", Demo: A.DemoCentang },
      { id: "radio-group", nama: "Radio Group", kit: "KelompokRadio", modul: "kit/Formulir", ekspor: ["KelompokRadio"], ket: "Satu dari beberapa pilihan, dengan keterangan per pilihan.", Demo: A.DemoRadio },
      { id: "switch", nama: "Switch", kit: "Sakelar", modul: "kit/Isian", ekspor: ["Sakelar"], ket: "Nyala/mati yang langsung berlaku.", Demo: A.DemoSakelar },
      { id: "slider", nama: "Slider", kit: "Geser", modul: "kit/Formulir", ekspor: ["Geser"], ket: "Nilai dalam rentang — persen uang muka, fee desain.", Demo: A.DemoGeser },
      { id: "select", nama: "Select", kit: "Pilih", modul: "kit/Formulir", ekspor: ["Pilih"], ket: "Pilihan bergaya dengan keterangan per butir.", Demo: A.DemoPilih },
      { id: "native-select", nama: "Native Select", kit: "PilihAsli · PilihTombol", modul: "kit/Formulir", ekspor: ["PilihAsli"], ket: "<select> asli — di ponsel membuka pemilih sistem.", Demo: A.DemoPilihAsli },
      { id: "combobox", nama: "Combobox", kit: "Kombo", modul: "kit/Formulir", ekspor: ["Kombo"], ket: "Pilihan yang bisa dicari, untuk daftar panjang (proyek, kontak).", Demo: A.DemoKombo },
      { id: "input-otp", nama: "Input OTP", kit: "IsianKode", modul: "kit/Formulir", ekspor: ["IsianKode"], ket: "Kode sekali pakai: tempel penuh, backspace mundur, panah berpindah.", Demo: A.DemoKode },
      { id: "calendar", nama: "Calendar", kit: "Kalender", modul: "kit/Formulir", ekspor: ["Kalender"], ket: "Kalender bulanan, Senin di depan; hari terlarang dicoret.", Demo: A.DemoKalender },
      { id: "date-picker", nama: "Date Picker", kit: "PilihTanggal", modul: "kit/Formulir", ekspor: ["PilihTanggal"], ket: "Kalender di dalam sembul; nilainya ISO seperti <input type=date>.", Demo: A.DemoPilihTanggal },
      { id: "attachment", nama: "Attachment", kit: "Lampiran", modul: "kit/Formulir", ekspor: ["Lampiran"], ket: "Zona seret di atas <input type=file> asli; berkas tampil sebagai keping.", Demo: A.DemoLampiran },
    ],
  },
  {
    id: "overlay",
    nama: "Overlay",
    ket: "Yang melayang di atas halaman.",
    ikon: GridFour,
    isi: [
      { id: "dialog-drawer", nama: "Dialog / Drawer", kit: "Dialog", modul: "kit/Overlay", ekspor: ["Dialog"], ket: "Jendela di tengah untuk satu tugas pendek — tambah kontak, termin baru.", Demo: A.DemoDialog },
      { id: "sheet", nama: "Sheet", kit: "Laci", modul: "kit/Overlay", ekspor: ["Sheet", "Laci"], ket: "Panel dari sisi layar; bawah untuk ponsel.", Demo: A.DemoLaci },
      { id: "alert-dialog", nama: "Alert Dialog", kit: "Konfirmasi", modul: "kit/Overlay", ekspor: ["AlertDialog", "Konfirmasi"], ket: "Konfirmasi untuk tindakan yang sulit dibatalkan. Tidak tertutup oleh klik latar.", Demo: A.DemoKonfirmasi },
      { id: "popover", nama: "Popover", kit: "Sembul", modul: "kit/Overlay", ekspor: ["Sembul"], ket: "Panel kecil yang menempel pada pemicunya.", Demo: A.DemoSembul },
      { id: "hover-card", nama: "Hover Card", kit: "KartuMelayang", modul: "kit/Overlay", ekspor: ["KartuMelayang"], ket: "Pratinjau saat kursor diam di atas tautan.", Demo: A.DemoMelayang },
      { id: "tooltip", nama: "Tooltip", kit: "Petunjuk", modul: "kit/Overlay", ekspor: ["Petunjuk"], ket: "Nama tombol ikon yang tidak tertulis.", Demo: A.DemoPetunjuk },
      { id: "dropdown-menu", nama: "Dropdown Menu", kit: "MenuTarik", modul: "kit/Overlay", ekspor: ["DropdownMenu", "MenuTarik"], ket: "Daftar aksi dari satu tombol.", Demo: A.DemoMenuTarik },
      { id: "context-menu", nama: "Context Menu", kit: "MenuKonteks", modul: "kit/Overlay", ekspor: ["ContextMenu", "MenuKonteks"], ket: "Menu klik-kanan (tekan lama di layar sentuh).", Demo: A.DemoMenuKonteks },
      { id: "command", nama: "Command", kit: "Palet · DaftarPerintah", modul: "kit/Palet", ekspor: ["Palet", "DaftarPerintah"], ket: "Cari halaman dan perintah — Ctrl/Cmd+K di seluruh panel.", Demo: A.DemoPerintah },
      { id: "toast", nama: "Toast", kit: "Toast", modul: "kit/Toast", ekspor: ["useToast", "titipToast", "ToastProvider", "TitipanToast"], ket: "Kabar singkat sesudah sebuah perbuatan; bisa dititipkan ke halaman berikutnya.", Demo: A.DemoToast },
    ],
  },
  {
    id: "navigasi",
    nama: "Navigasi",
    ket: "Berpindah tempat.",
    ikon: SidebarSimple,
    isi: [
      { id: "sidebar", nama: "Sidebar", kit: "SisiNav", modul: "kit/Nav", ekspor: ["SisiNav"], ket: "Rel samping panel — bisa dilipat per kelompok.", Demo: B.DemoSisiNav },
      { id: "navigation-menubar", nama: "Navigation Menubar", kit: "MenuNavigasi", modul: "kit/Overlay", ekspor: ["MenuNavigasi"], ket: "Bilah tautan dengan panel turun berisi tautan anak.", Demo: B.DemoMenuNavigasi },
      { id: "menubar", nama: "Menubar", kit: "BilahMenu", modul: "kit/Overlay", ekspor: ["Menubar", "BilahMenu"], ket: "Bilah menu ala aplikasi desktop: Proyek, Keuangan, Dokumen.", Demo: B.DemoBilahMenu },
      { id: "breadcrumb", nama: "Breadcrumb", kit: "Remah", modul: "kit/Remah", ekspor: ["Remah"], ket: "Jejak letak halaman.", Demo: B.DemoRemah },
      { id: "pagination", nama: "Pagination", kit: "Paginasi", modul: "kit/Paginasi", ekspor: ["Paginasi"], ket: "Halaman daftar; versi 32px untuk ponsel.", Demo: B.DemoPaginasi },
      { id: "tabs", nama: "Tabs", kit: "Segmen · KelompokTab", modul: "kit/Segmen", ekspor: ["Segmen", "KelompokTab"], ket: "Memilih satu dari beberapa tampilan.", Demo: B.DemoTab },
    ],
  },
  {
    id: "data",
    nama: "Data",
    ket: "Menampilkan angka, daftar, dan keadaan.",
    ikon: ChartBar,
    isi: [
      { id: "table", nama: "Table", kit: "Tabel", modul: "kit/Tabel", ekspor: ["Tabel"], ket: "Tabel kit — kolom, sel dua baris, sel berikon.", Demo: B.DemoTabel },
      { id: "data-table", nama: "Data Table", kit: "DaftarKit", modul: "admin/daftarKit", ekspor: ["DaftarKit"], ket: "Tabel lengkap: cari, saring, halaman, pilih baris.", Demo: B.DemoDaftarKit },
      { id: "chart", nama: "Chart", kit: "GrafikArea · Donat · KolomGrafik", modul: "kit/Ukuran", ekspor: ["GrafikArea", "Donat", "Cincin", "KolomGrafik"], ket: "Grafik garis-area, donat, dan batang.", Demo: B.DemoGrafik },
      { id: "card", nama: "Card", kit: "Kartu · KartuStatistik · KartuKas", modul: "kit/Kartu", ekspor: ["Kartu", "KartuStatistik", "KartuKas", "KartuStatistikRingkas"], ket: "Wadah r16; varian statistik dan kas.", Demo: B.DemoKartu },
      { id: "item", nama: "Item", kit: "Butir · Baris*", modul: "kit/Tampilan", ekspor: ["Butir"], ket: "Satu baris media — judul & keterangan — aksi.", Demo: B.DemoButir },
      { id: "avatar", nama: "Avatar", kit: "Avatar · TumpukAvatar", modul: "kit/Tampilan", ekspor: ["Avatar", "TumpukAvatar"], ket: "Foto atau inisial; warnanya diturunkan dari nama.", Demo: B.DemoAvatar },
      { id: "badge", nama: "Badge", kit: "Lencana · Angka · Titik", modul: "kit/Lencana", ekspor: ["Lencana", "Angka", "Titik"], ket: "Status bernama makna, bukan warna.", Demo: B.DemoLencana },
      { id: "progress", nama: "Progress", kit: "BarKemajuan", modul: "kit/Ukuran", ekspor: ["BarKemajuan"], ket: "Kemajuan pembayaran atau tahap.", Demo: B.DemoKemajuan },
    ],
  },
  {
    id: "umpan-balik",
    nama: "Umpan Balik",
    ket: "Kabar, kosong, dan menunggu.",
    ikon: SpecialWarning,
    isi: [
      { id: "alert", nama: "Alert", kit: "Peringatan", modul: "kit/Tampilan", ekspor: ["Peringatan"], ket: "Kabar di dalam halaman: info, berhasil, perlu perhatian, gagal.", Demo: B.DemoPeringatan },
      { id: "empty", nama: "Empty", kit: "Kosong", modul: "kit/Tampilan", ekspor: ["Kosong"], ket: "Kenapa kosong, dan apa langkah berikutnya.", Demo: B.DemoKosong },
      { id: "skeleton", nama: "Skeleton", kit: "Rangka · RangkaBaris", modul: "kit/Tampilan", ekspor: ["Rangka", "RangkaBaris"], ket: "Bentuk isi selama dimuat — diam, tanpa denyut.", Demo: B.DemoRangka },
      { id: "spinner", nama: "Spinner", kit: "Putar", modul: "kit/Tampilan", ekspor: ["Putar"], ket: "Satu-satunya yang berputar terus — dan hanya selama sesuatu berjalan.", Demo: B.DemoPutar },
    ],
  },
  {
    id: "tata-letak",
    nama: "Tata Letak",
    ket: "Wadah, pemisah, dan teks.",
    ikon: ImageSquare,
    isi: [
      { id: "aspect-ratio", nama: "Aspect Ratio", kit: "Rasio", modul: "kit/Tampilan", ekspor: ["Rasio"], ket: "Kotak berasio tetap untuk foto, sampul, logo.", Demo: B.DemoRasio },
      { id: "separator", nama: "Separator", kit: "Pemisah", modul: "kit/Tampilan", ekspor: ["Pemisah"], ket: "Garis datar, tegak, atau berlabel.", Demo: B.DemoPemisah },
      { id: "scroll-area", nama: "Scroll Area", kit: "AreaGulir", modul: "kit/Tampilan", ekspor: ["AreaGulir"], ket: "Batang gulir tipis yang sama di semua sistem operasi.", Demo: B.DemoAreaGulir },
      { id: "resizable", nama: "Resizable", kit: "Bagi", modul: "kit/Bagi", ekspor: ["Bagi"], ket: "Dua panel yang lebarnya bisa diatur.", Demo: B.DemoBagi },
      { id: "collapsible", nama: "Collapsible", kit: "Lipat", modul: "kit/Tampilan", ekspor: ["Lipat"], ket: "Bagian yang bisa dibuka-tutup — <details> asli.", Demo: B.DemoLipat },
      { id: "carousel", nama: "Carousel", kit: "Korsel", modul: "kit/Tampilan", ekspor: ["Korsel"], ket: "Geser mendatar dengan snap, dua tombol untuk tetikus.", Demo: B.DemoKorsel },
      { id: "direction", nama: "Direction", kit: "Arah", modul: "kit/Arah", ekspor: ["Arah"], ket: "Membalik arah baca sebuah bagian (kanan-ke-kiri).", Demo: B.DemoArah },
      { id: "typography", nama: "Typography", kit: "Teks", modul: "kit/Tampilan", ekspor: ["Teks"], ket: "Tangga huruf kit di satu tempat.", Demo: B.DemoTeks },
      { id: "marker", nama: "Marker", kit: "Penanda · SorotTeks", modul: "kit/Tampilan", ekspor: ["Penanda", "SorotTeks"], ket: "Stabilo pada teks — hasil cari, angka yang berubah.", Demo: B.DemoPenanda },
    ],
  },
  {
    id: "percakapan",
    nama: "Percakapan",
    ket: "Pesan, balasan, dan pertanyaan.",
    ikon: ChatTeardropDots,
    isi: [
      { id: "message", nama: "Message", kit: "BarisPesan", modul: "kit/Item", ekspor: ["BarisPesan", "BarisInbox"], ket: "Baris daftar percakapan dengan cuplikan dan angka belum dibaca.", Demo: B.DemoPesan },
      { id: "bubble", nama: "Bubble", kit: "Gelembung", modul: "kit/Item", ekspor: ["Gelembung"], ket: "Gelembung obrolan — milik sendiri di kanan.", Demo: B.DemoGelembung },
      { id: "message-scroller", nama: "Message Scroller", kit: "GulirPesan", modul: "kit/Tampilan", ekspor: ["GulirPesan"], ket: "Percakapan yang menempel di bawah tanpa merenggut posisi baca.", Demo: B.DemoGulirPesan },
      { id: "questionnaire", nama: "Questionnaire", kit: "Kuesioner", modul: "kit/Tampilan", ekspor: ["Kuesioner"], ket: "Satu pertanyaan per langkah.", Demo: B.DemoKuesioner },
    ],
  },
];

export const JUMLAH_KOMPONEN = KATALOG.reduce((n, f) => n + f.isi.length, 0);

/** Ikon untuk folder tambahan "Ikon" (bukan komponen, tapi bahan semuanya). */
export const IKON_FOLDER_IKON = List;
