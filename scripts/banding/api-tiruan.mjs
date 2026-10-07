/* API tiruan untuk MEMBANGUN situs statis di mesin pengembangan.
 *
 *     node scripts/banding/api-tiruan.mjs &
 *
 * Halaman proyek dan jurnal dibekukan dari jawaban API saat build, dan
 * `listProjects()` memakai `wajib()` — jadi tanpa API yang menjawab, build
 * memang GAGAL, bukan menghasilkan situs kosong (jebakan #12 di CLAUDE.md).
 * Itu perilaku yang benar, dan itu juga sebabnya berkas ini ada: mengukur
 * komponen di /admin/kit butuh build, dan build butuh API.
 *
 * Ia TIDAK meniru data sungguhan. Yang penting cuma bentuknya sah, karena
 * yang diukur komponennya, bukan isinya.
 */
import { createServer } from "node:http";

const PORT = Number(process.env.PORT || 8787);

const proyek = Array.from({ length: 6 }, (_, i) => ({
  id: `p${i + 1}`,
  slug: `proyek-${i + 1}`,
  title: `Proyek ${i + 1}`,
  kind: i % 2 ? "residential" : "hospitality",
  year: 2024 - i,
  location: "Pontianak",
  summary: "Ringkasan singkat.",
  coverUrl: null,
  images: [],
  materials: [],
  credits: [],
  publishedAt: new Date().toISOString(),
}));

const setelan = {
  studioName: "Dirga Pahlevi Architecture",
  city: "Pontianak",
  email: "halo@pahlevidirgaarchitecture.com",
  phone: "+62 812 0000 0000",
  whatsapp: "",
  instagram: "",
  address: "",
  logoUrl: null,
  timezone: "Asia/Jakarta",
  tagline: "Arsitektur untuk iklim khatulistiwa",
  instagramUrl: "",
  /* Isi halaman publik — sengaja setengah terisi, supaya pratinjau yang
     kosong dan yang terisi sama-sama terlihat. */
  foundedYear: 2019,
  firstCommercialYear: null,
  beforeUrl: null,
  afterUrl: null,
  legalEntity: "CV Dirga Pahlevi Arsitektur",
  legalAddress: null,
  retentionMessages: "24 bulan",
  retentionDocuments: null,
  governingLaw: "Hukum Republik Indonesia",
  faqTarif: null,
  faqUangMuka: "30% saat kontrak",
  faqLamaKerja: null,
  faqKunjungan: null,
};

/* Logo klien — rasio sengaja berbeda-beda (lebar, persegi, tinggi), karena
   ambang lib/logoBentuk hanya teruji kalau ketiganya ada. */
const klienAdmin = [
  ["Kedai Kopi Ruas", "klien/logo-1.svg"],
  ["Bakmi Hauw", "klien/logo-2.svg"],
  ["Notaris Ahmad & Rekan", null],
  ["Guest House Kapuas", "klien/logo-3.svg"],
  ["Elsana Coffee", null],
].map(([name, key], i) => ({ id: `kl${i + 1}`, name, logoKey: key, sortOrder: i + 1 }));
const urlMedia = (key) => (key ? `http://127.0.0.1:${PORT}/media/${key}` : null);
const urutKlien = () =>
  [...klienAdmin].sort((a, b) => a.sortOrder - b.sortOrder).map(({ logoKey, ...k }) => ({ ...k, logoUrl: urlMedia(logoKey) }));

const orangStudio = [
  { id: "os1", name: "Dirga Pahlevi", role: "Arsitek utama", bio: null, photoUrl: null, slotLabel: "Pendiri", sortOrder: 1 },
  { id: "os2", name: null, role: "Arsitek interior", bio: null, photoUrl: null, slotLabel: "Interior", sortOrder: 2 },
  { id: "os3", name: "Rina Maharani", role: "Drafter", bio: null, photoUrl: null, slotLabel: "Gambar kerja", sortOrder: 3 },
];

/* Data admin — dipakai halaman P4 yang datanya datang saat DIJALANKAN, bukan
   saat build. Angkanya sengaja berbentuk rupiah studio arsitektur, bukan angka
   bulat: kolom yang rapi karena semua angkanya sama panjang tidak pernah
   menunjukkan cacat perataan. */
const proyekKeu = [
  ["Kedai Kopi Ruas", 185_000_000, 120_000_000, 62_400_000],
  ["Rumah Tropis Sungai Raya", 340_000_000, 170_000_000, 98_750_000],
  ["Renovasi Bakmi Hauw", 96_500_000, 96_500_000, 41_200_000],
  ["Kantor Notaris Ahmad", 210_000_000, 63_000_000, 28_900_000],
  ["Guest House Kapuas", 275_000_000, 82_500_000, 35_600_000],
].map(([projectTitle, contractValue, received, costsTotal], i) => ({
  projectId: `k${i + 1}`,
  projectTitle,
  contractValue,
  received,
  costsTotal,
  marginPct: Math.round(((contractValue - costsTotal) / contractValue) * 100),
  labaBersih: received - costsTotal,
  belumDiterima: contractValue - received,
}));

const ringkasanKeu = {
  kasMasuk: proyekKeu.reduce((a, p) => a + p.received, 0),
  piutang: proyekKeu.reduce((a, p) => a + (p.belumDiterima ?? 0), 0),
  marginRataRata: 41.8,
  labaBersih: proyekKeu.reduce((a, p) => a + p.labaBersih, 0),
  totalBiaya: proyekKeu.reduce((a, p) => a + p.costsTotal, 0),
  totalKontrak: proyekKeu.reduce((a, p) => a + (p.contractValue ?? 0), 0),
  proyek: proyekKeu,
  bebanKategori: [
    { kategori: "freelancer", nilai: 121_400_000 },
    { kategori: "operasional", nilai: 86_300_000 },
    { kategori: "prinsipal", nilai: 41_150_000 },
    { kategori: "lainnya", nilai: 18_000_000 },
  ],
};

const bulananKeu = Array.from({ length: 24 }, (_, i) => {
  /* Tanggal 1 DULU, baru mundur bulannya. `setMonth` pada tanggal 29 Sep
     melewati Februari sama sekali — 29 Feb tidak ada, jadi ia berguling ke
     1 Maret dan deretnya memuat "Mar" dua kali tanpa "Feb". Terlihat di
     sumbu grafik arus kas, dan sempat terbaca sebagai cacat komponen. */
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - (23 - i));
  const kasMasuk = 18_000_000 + Math.round(Math.sin(i / 2.1) * 9_000_000) + i * 420_000;
  const biaya = 11_000_000 + Math.round(Math.cos(i / 1.7) * 5_200_000) + i * 210_000;
  return {
    bulan: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
    kasMasuk,
    biaya,
    labaBersih: kasMasuk - biaya,
    proyekAktif: 3 + (i % 3),
  };
});

const biayaKeu = [
  ["Render eksterior 6 frame", "freelancer", 8_500_000, 0, "Kedai Kopi Ruas"],
  ["Sewa kantor September", "operasional", 4_200_000, 0, null],
  ["Drafter denah lantai 2", "freelancer", 6_750_000, 1, "Rumah Tropis Sungai Raya"],
  ["Cetak A1 set gambar kerja", "operasional", 1_350_000, 2, "Renovasi Bakmi Hauw"],
  ["Fee prinsipal termin 2", "prinsipal", 15_000_000, 4, "Kantor Notaris Ahmad"],
].map(([label, category, amount, mundur, projectTitle], i) => {
  const d = new Date();
  d.setDate(d.getDate() - mundur);
  return {
    id: `b${i + 1}`,
    projectId: `k${i + 1}`,
    projectTitle,
    label,
    category,
    amount,
    incurredOn: d.toISOString().slice(0, 10),
    teamMemberId: category === "operasional" ? null : `t${(i % 5) + 2}`,
    teamMemberName: category === "operasional"
      ? null
      : ["Sari Ningsih", "Bayu Prakoso", "Nanda Wijaya", "Rizki Ardian", "Tuti Hartati"][i % 5],
  };
});

/* Anggota tim — empat kelompok `member_kind`, dipakai akordeon di halaman
   Catat Pengeluaran. Sengaja tidak rata: satu kelompok kosong supaya
   keadaan "belum ada orang di kelompok ini" ikut tergambar. */
const timAdmin = [
  ["Dirga Pahlevi", "partner", "Principal architect"],
  ["Sari Ningsih", "inti", "Arsitek"],
  ["Bayu Prakoso", "inti", "Drafter"],
  ["Nanda Wijaya", "proyek", "3D artist"],
  ["Rizki Ardian", "proyek", "Drafter lepas"],
  ["Tuti Hartati", "proyek", "Quantity surveyor"],
].map(([name, kind, role], i) => ({
  id: `t${i + 1}`,
  name,
  role,
  kind,
  rate: null,
  /* Dua bernomor, supaya tombol WhatsApp slip gaji punya keadaan hidup dan mati. */
  phone: i === 1 ? "0812-3456-7890" : i === 2 ? "+62 813 1111 2222" : null,
  active: true,
}));

/* Pesan masuk dari form kontak — dipakai halaman Pesan Masuk (frame 28).
   Panjang pesannya sengaja beragam: baris daftar memotong di dua baris,
   dan pesan satu kalimat tidak pernah menunjukkan potongannya. */
const pesanAdmin = [
  ["Rina Oktaviani", "rina.okta@gmail.com", "0812 5567 2210", "residential", "Rp500 jt – Rp1 M", "new", 0, 3,
    "Halo, saya berencana membangun rumah dua lantai di Sungai Raya, luas tanah 12 x 25 m. Kami keluarga dengan tiga anak dan ingin rumah yang sejuk tanpa terlalu bergantung pada AC.\n\nApakah studio bisa membantu dari tahap konsep sampai gambar kerja? Kami juga ingin tahu kira-kira berapa lama prosesnya."],
  ["Hendra Wijaya", "hendra@kopiruang.id", "0813 4400 9981", "commercial", "Rp250 – 500 jt", "new", 0, 9,
    "Kami sedang mencari arsitek untuk coffee shop kedua kami di Jalan Gajah Mada. Bangunan eksisting ruko dua lantai, ingin dirombak jadi bar di lantai bawah dan ruang kerja di atas."],
  ["Maria Susanti", "maria.s@yahoo.co.id", "", "interior", "Rp100 – 250 jt", "contacted", 1, 14,
    "Selamat siang. Saya ingin renovasi interior dapur dan ruang keluarga. Apakah bisa survei lokasi minggu depan?"],
  ["PT Kapuas Lestari", "admin@kapuaslestari.co.id", "0561 733 120", "masterplan", "Di atas Rp1 M", "qualified", 2, 10,
    "Kami membutuhkan masterplan untuk kawasan guest house di tepi Sungai Kapuas seluas kurang lebih 1,2 hektar, termasuk 14 unit kamar, restoran, dan dermaga kecil. Mohon informasi portofolio proyek serupa dan tahapan kerja sama."],
  ["Dimas Pratama", "dimas.pratama@outlook.com", "0857 2231 4410", "renovation", "Rp100 – 250 jt", "new", 3, 16,
    "Rumah peninggalan orang tua, dibangun tahun 1990-an. Atapnya sering bocor dan ruangannya gelap. Ingin direnovasi tanpa menghilangkan karakter lamanya."],
  ["Lestari Anggraini", "lestari.a@gmail.com", "", "landscape", "Di bawah Rp100 jt", "closed", 5, 11,
    "Apakah studio menerima desain taman saja? Halaman belakang kami sekitar 80 m2."],
  ["Yohanes Tan", "yohanes.tan@tanbrothers.com", "0811 567 8890", "commercial", "Rp500 jt – Rp1 M", "contacted", 6, 13,
    "Kami pemilik restoran bakmi yang ingin membuka cabang baru dengan konsep semi terbuka. Kapasitas sekitar 60 kursi. Bisa kirim contoh proyek hospitality yang sudah selesai?"],
  ["Nur Aisyah", "aisyah.nur@gmail.com", "0852 4410 7723", "residential", "Rp250 – 500 jt", "qualified", 8, 9,
    "Terima kasih atas penjelasan kemarin. Kami setuju dengan ruang lingkupnya dan ingin lanjut ke tahap kontrak."],
  ["Fajar Nugroho", "fajar.n@proton.me", "", "interior", "Rp100 – 250 jt", "closed", 12, 15,
    "Kami sudah menemukan kontraktor lain, terima kasih atas waktunya."],
  ["Clara Hartono", "clara.hartono@gmail.com", "0812 9900 1122", "residential", "Rp500 jt – Rp1 M", "contacted", 15, 10,
    "Kami tinggal di Jakarta dan membangun rumah untuk orang tua di Pontianak. Apakah koordinasinya bisa dilakukan jarak jauh?"],
].map(([name, email, phone, projectType, budgetRange, status, mundur, jam, message], i) => {
  const d = new Date();
  d.setDate(d.getDate() - mundur);
  d.setHours(jam, (i * 17) % 60, 0, 0);
  return { id: `q${i + 1}`, name, email, phone: phone || undefined, projectType, budgetRange, message, status, createdAt: d.toISOString() };
});

/* Paket layanan — isi awalnya sama dengan migrasi 20260929000025, supaya
   beranda yang dibangun dari API tiruan identik dengan yang tayang. */
const paketAdmin = [
  ["kafe", "starter", "Starter", "Untuk coffee shop pertama, dengan anggaran yang apa adanya.", 15, 25,
    "Coffee shop pertama, budget terbatas", "Yang Anda dapat",
    ["Konsep desain", "Denah dan tata ruang", "Visualisasi 3D dasar"], false, 1],
  ["kafe", "signature", "Signature", "Untuk pemilik yang sudah punya gambaran jelas soal ruang yang ingin dikenang.", 45, 80,
    "Visi kuat, target ikonik", "Semua di Starter, ditambah",
    ["Gambar kerja lengkap (DED)", "Branding ruang dan palet material", "Pengarahan dan pendampingan kontraktor", "Perencanaan alur bar dan dapur"], true, 2],
  ["kafe", "flagship", "Flagship", "Layanan penuh, dari sketsa pertama sampai foto pembukaan.", 100, 180,
    "Grup F&B yang siap membuka cabang", "Semua di Signature, ditambah",
    ["Supervisi konstruksi", "Desain furnitur custom", "Dokumentasi foto profesional"], false, 3],
  ["rumah", "konsultasi", "Konsultasi", "Untuk pemilik yang akan membangun sendiri bersama tukangnya.", 10, 20,
    "Membangun sendiri, dengan tukang", "Yang Anda dapat",
    ["Konsep desain", "Denah skematik", "Saran orientasi dan ventilasi"], false, 1],
  ["rumah", "standar", "Standar", "Dari konsep sampai gambar yang bisa dibangun kontraktor tanpa menelepon kami.", 35, 70,
    "100–200 m², budget bangun Rp 500 juta–1,5 miliar", "Semua di Konsultasi, ditambah",
    ["Gambar kerja lengkap (DED)", "Gambar kerja siap kontraktor", "Daftar material dan finishing"], true, 2],
  ["rumah", "premium", "Premium", "Rumahnya, isinya, dan tanah tempat ia berdiri — diurus sebagai satu proyek.", 80, 200,
    "Di atas 200 m², budget bangun di atas Rp 2 miliar", "Semua di Standar, ditambah",
    ["Supervisi konstruksi", "Desain interior", "Desain lanskap", "Dokumentasi foto saat serah terima"], false, 3],
].map(([group, slug, name, summary, feeMin, feeMax, forWhom, includesHeading, includes, highlighted, sortOrder], i) => ({
  id: `t0000000-0000-4000-8000-00000000000${i + 1}`,
  group, slug, name, summary, feeMin, feeMax, forWhom, includesHeading, includes, highlighted,
  active: true, sortOrder, updatedAt: new Date(Date.now() - (i + 1) * 86_400_000 * 3).toISOString(),
}));
const urutPaket = () => [...paketAdmin].sort((a, z) =>
  a.group.localeCompare(z.group) || a.sortOrder - z.sortOrder);

/* Jurnal — sembilan tulisan dalam tiga keadaan (terbit, terjadwal, rencana),
   sebagian bersampul. Sampulnya SVG yang dibangkitkan server ini sendiri di
   /media/jurnal/<n>.svg, supaya halaman bisa dipotret tanpa foto sungguhan. */
const ISI_CONTOH = `Tanah di tepi sungai selalu tampak murah di brosur. Yang jarang disebut: air tanahnya.

## Sebelum membeli

Tanyakan tinggi banjir terakhir kepada tetangga, bukan kepada penjual. Lihat bekas garis air di dinding pagar.

## Orientasi

Bukaan besar ke utara dan selatan, dinding masif ke barat. Matahari sore di khatulistiwa tidak kenal ampun.

## Biaya tersembunyi

Pengurukan, cerucuk, dan saluran pembuangan sering lebih mahal daripada selisih harga tanahnya.`;
const hariLalu = (n, jam = 9) => { const d = new Date(); d.setDate(d.getDate() - n); d.setHours(jam, 0, 0, 0); return d.toISOString(); };
const jurnalAdmin = [
  ["sembilan-pertanyaan-tapak", "Sembilan pertanyaan sebelum membeli tanah", "Orientasi, akses, air, dan tembok tetangga menentukan lebih banyak daripada gambar mana pun.", "site", 7, 2, 1],
  ["uang-muka-yang-wajar", "Berapa uang muka yang wajar untuk jasa arsitek", "Pembayaran per tahap melindungi kedua pihak — ini cara kami membaginya dan alasannya.", "money", 5, 9, 2],
  ["pbg-tanpa-drama", "PBG tanpa drama: urutan dokumen yang benar", "Persetujuan Bangunan Gedung bisa selesai dalam hitungan minggu kalau berkasnya disusun sejak desain.", "permit", 8, 16, 3],
  ["atap-untuk-hujan-tropis", "Atap untuk hujan tropis yang tidak kenal jeda", "Kemiringan, talang, dan overstek adalah tiga keputusan yang menentukan umur bangunan di Pontianak.", "build", 6, 24, 4],
  ["kafe-pertama-anggaran", "Kafe pertama dengan anggaran yang apa adanya", "Di mana uang harus dihabiskan dan di mana cukup rapi: bar, cahaya, dan kursi yang membuat orang betah.", "money", 6, 33, null],
  ["menghitung-cerucuk", "Menghitung cerucuk di tanah gambut", "Fondasi di tanah lunak Kalimantan tidak bisa ditebak dari gambar standar — ini cara kami memeriksanya.", "build", 9, -5, 5],
  ["ventilasi-silang", "Ventilasi silang yang benar-benar mengalir", "", "site", 5, null, null],
  ["izin-renovasi-ruko", "Apakah renovasi ruko perlu izin baru?", "", "permit", 4, null, null],
  ["membaca-rab", "Membaca RAB kontraktor tanpa tertipu", "", "money", 6, null, null],
].map(([slug, title, excerpt, category, readMinutes, lalu, sampul], i) => ({
  id: `j0000000-0000-4000-8000-00000000000${i + 1}`,
  slug, title, category, readMinutes,
  excerpt: excerpt || "Rencana tulisan — kalimat pembukanya menyusul.",
  body: lalu === null ? null : ISI_CONTOH,
  publishedAt: lalu === null ? null : hariLalu(lalu),
  coverKey: sampul ? `jurnal/contoh-${sampul}.svg` : null,
  coverUrl: sampul ? `http://127.0.0.1:${PORT}/media/jurnal/contoh-${sampul}.svg` : null,
  createdAt: hariLalu(40 + i),
  updatedAt: hariLalu(lalu === null ? 3 + i : Math.max(0, lalu)),
}));
const sampulSvg = (n) => {
  const rona = [["#1E4841", "#BBF49C"], ["#2F5D50", "#ECF4E9"], ["#BCBEBD", "#1E4841"], ["#7FC98E", "#1E4841"], ["#E5E6E6", "#2F5D50"]][(n - 1) % 5];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630"><rect width="1200" height="630" fill="${rona[0]}"/>` +
    `<path d="M0 470 L300 300 L520 420 L820 210 L1200 430 L1200 630 L0 630Z" fill="${rona[1]}" opacity=".55"/>` +
    `<rect x="760" y="120" width="260" height="190" rx="8" fill="none" stroke="${rona[1]}" stroke-width="10" opacity=".8"/>` +
    `<circle cx="210" cy="150" r="70" fill="${rona[1]}" opacity=".7"/></svg>`;
};

/* Riwayat biaya 30 bulan ke belakang — dipakai halaman Fee Proyek, yang
   grafiknya membaca biaya PER BULAN dan PER TAHUN. Lima baris di atas cuma
   menjangkau beberapa hari terakhir, dan grafik tangga sepuluh bulan dengan
   sembilan anak tangga nol tidak menunjukkan apa pun tentang komponennya.
   Satu baris fee sengaja tanpa nama tiap beberapa bulan, supaya jalur
   "fee tanpa nama" ikut tergambar. */
const biayaRiwayat = [];
for (let m = 1; m <= 30; m++) {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - m);
  const tgl = (h) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(h).padStart(2, "0")}`;
  const k = (m % 5) + 1;
  const judul = proyekKeu[k - 1].projectTitle;
  const baris = [
    ["Drafter gambar kerja", "freelancer", 3_200_000 + ((m * 730_000) % 5_100_000), 6, (m % 3) + 2],
    ["Render interior", "freelancer", 2_400_000 + ((m * 410_000) % 3_900_000), 14, (m % 3) + 4],
    ["Sewa kantor", "operasional", 4_200_000, 3, null],
    ["Fee prinsipal", "prinsipal", m % 3 === 0 ? 12_500_000 : 0, 20, 1],
    ["Cetak & maket", "lainnya", 650_000 + ((m * 170_000) % 1_400_000), 24, null],
  ];
  baris.forEach(([label, category, amount, hari, t], j) => {
    if (!amount) return;
    const tanpaNama = category === "freelancer" && j === 1 && m % 4 === 0;
    const orang = t === null || tanpaNama ? null : timAdmin[t - 1];
    biayaRiwayat.push({
      id: `r${m}-${j}`,
      projectId: `k${k}`,
      projectTitle: judul,
      label,
      category,
      amount,
      incurredOn: tgl(hari),
      teamMemberId: orang ? orang.id : null,
      teamMemberName: orang ? orang.name : null,
    });
  });
}


const profil = { id: "u1", email: "dirga@contoh.id", name: "Dirga Pahlevi", nama: "Dirga Pahlevi", role: "master", isMasterAdmin: true, avatarUrl: null };
/* Berkas yang diunggah ke /unggah?key=… disimpan di memori dan disajikan
   lagi di /media/<key>, supaya foto akun hasil potongan benar-benar tampil
   di uji — bukan gambar contoh pengganti. */
const unggahan = new Map();
let nomorUnggah = 0;

/* Halaman Akun — sesi CONTOH. Produksi menyimpan agen peramban sejak login
   meneruskannya; sesi lama tercatat tanpa nama perangkat (userAgent null). */
const SANDI_TIRUAN = "Lama-Sandi-2026";
const jamLalu = (j) => new Date(Date.now() - j * 3600e3).toISOString();
const sesiIni = { id: "s-ini", dibuat: jamLalu(26), terakhirAktif: jamLalu(0.05), userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36" };
let sesiLain = [
  { id: "s-2", dibuat: jamLalu(30), terakhirAktif: jamLalu(3), userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1" },
  { id: "s-3", dibuat: jamLalu(80), terakhirAktif: jamLalu(50), userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36 Edg/129.0" },
];
let sesiTanpaNama = 6;

/* Proyek versi ADMIN — beda bentuk dari `proyek` di atas, yang meniru
   endpoint publik. Yang ini memuat contractValue dan paidTotal, dua kolom
   yang dibaca halaman Terima Pembayaran untuk menghitung sisa tagihan. */
const proyekAdmin = proyekKeu.map((p, i) => ({
  id: p.projectId,
  slug: `proyek-${i + 1}`,
  title: p.projectTitle,
  /* Enum project_category di database tidak punya "hospitality" — proyek
     kafe masuk "commercial". Data tiruan mengikuti databasenya, bukan peta
     label di panel. */
  category: i === 0 ? "coffeeshop" : i % 2 ? "residential" : "commercial",
  coverImageUrl: i < 3 ? `http://127.0.0.1:${PORT}/media/projects/uji/contoh-${i + 1}.svg` : null,
  status: i === 3 ? "draft" : "published",
  city: ["Pontianak", "Singkawang", "Pontianak", "Kubu Raya", "Pontianak"][i],
  client: ["Bu Ratna", "Pak Hendra", "Bakmi Hauw", "Notaris Ahmad", "PT Kapuas Jaya"][i],
  isFeatured: i === 0,
  contractValue: p.contractValue,
  paidTotal: p.received,
  pipelineStage: ["dp_50", "desain_1", "desain_2", "finish", "pelunasan"][i],
  phase: ["konsep", "ded", "perizinan", "konstruksi", "selesai"][i],
  year: 2026 - (i % 3),
  publishedAt: `2026-0${9 - i}-01T00:00:00Z`,
  scopeOfWork: i === 0
    ? "Desain interior coffee shop dua lantai: alur bar dan dapur, area duduk 48 kursi, fasad, dan pencahayaan."
    : null,
  deadlinePreview: i < 2 ? ["2026-10-08", "2026-09-28"][i] : null,
  deadlineFinal: i < 2 ? ["2026-10-15", "2026-10-02"][i] : null,
  /* Paket (fase 4): t…02 Signature, t…05 Standar — sebagian proyek saja,
     supaya "Tanpa paket" ikut tergambar. */
  tierId: i === 0 ? "t0000000-0000-4000-8000-000000000002" : i === 1 ? "t0000000-0000-4000-8000-000000000005"
    : i === 3 ? "t0000000-0000-4000-8000-000000000002" : null,
}));

/* Tim per peran (fase 1-2 alur Excel pemilik). Hitungannya disalin dari
   repository/projectTeam.ts — persen × fee design, tahap awal saat DP
   masuk, tahap akhir saat pipeline ≥ finish — supaya panel lokal
   menggambar angka yang sama dengan produksi. */
const aturanFee = { pctLeader: null, pctDrafter: 10, pctRender: 5, pctEstimator: null, poolPct: 10, firstTranchePct: 50 };
const aturanFeeKop = { diubahPada: "2026-10-04T02:12:00.000Z", diubahOleh: "Dirga Pahlevi" };
const URUT_TAHAP = ["proposal", "deal_kontrak", "dp_50", "desain_1", "desain_2", "finish", "pelunasan"];
const timProyek = [
  ["k1", "t1", "leader", null], ["k1", "t3", "drafter", 10], ["k1", "t4", "render", 5],
  ["k2", "t1", "leader", null], ["k2", "t5", "drafter", 10], ["k2", "t4", "render", 2.5], ["k2", "t2", "render", 2.5],
  ["k4", "t3", "drafter", 10], ["k4", "t6", "estimator", null],
].map(([projectId, teamMemberId, role, pct], i) => ({ id: `pt${i + 1}`, projectId, teamMemberId, role, pct, note: null }));
const pctPeran = (r) => ({ leader: aturanFee.pctLeader, drafter: aturanFee.pctDrafter, render: aturanFee.pctRender, estimator: aturanFee.pctEstimator })[r];
function hitungTim(a) {
  const p = proyekAdmin.find((x) => x.id === a.projectId);
  const o = timAdmin.find((x) => x.id === a.teamMemberId);
  const pctBerlaku = a.pct ?? pctPeran(a.role);
  const fee = p?.contractValue ?? null;
  const hak = fee !== null && pctBerlaku !== null ? Math.round((fee * pctBerlaku) / 100) : null;
  const awal = hak === null ? null : Math.round((hak * aturanFee.firstTranchePct) / 100);
  const nominal = { awal, akhir: hak === null ? null : hak - awal };
  const iTahap = URUT_TAHAP.indexOf(p?.pipelineStage ?? "proposal");
  const syarat = { awal: iTahap >= 2 || (bayarAdmin[a.projectId] ?? []).some((b) => b.kind === "dp"), akhir: iTahap >= 5 };
  const bayar = [...biayaKeu, ...biayaRiwayat].filter((b) => b.projectTeamId === a.id);
  const tahap = ["awal", "akhir"].filter((t) => nominal[t] !== 0 || bayar.some((b) => b.payoutStage === t)).map((t) => {
    const b = bayar.find((x) => x.payoutStage === t);
    if (b) return { tahap: t, nominal: nominal[t], keadaan: "dibayar", costId: b.id, dibayar: b.amount, dibayarPada: b.incurredOn };
    return { tahap: t, nominal: nominal[t], keadaan: nominal[t] === null ? "belum_ditentukan" : syarat[t] ? "jatuh_tempo" : "menunggu",
      costId: null, dibayar: null, dibayarPada: null };
  });
  const dibayar = bayar.reduce((n, b) => n + b.amount, 0);
  return { ...a, projectTitle: p?.title, teamMemberName: o?.name, teamMemberKind: o?.kind, pctBerlaku, feeDesign: fee,
    hak, dibayar, terutang: hak === null ? null : hak - dibayar, tahap };
}
const URUT_PERAN = ["leader", "drafter", "render", "estimator"];
const daftarTimProyek = (pid) => timProyek.filter((a) => !pid || a.projectId === pid)
  .sort((a, b) => URUT_PERAN.indexOf(a.role) - URUT_PERAN.indexOf(b.role)).map(hitungTim);

/* Foto galeri dan material per proyek. Proyek pertama penuh (enam galeri,
   tiga material), yang lain berkurang — supaya kisi foto, batas sepuluh,
   dan keadaan kosong bisa diperiksa di proyek yang berbeda. */
const gambarAdmin = Object.fromEntries(
  proyekAdmin.map((p, i) => {
    const buat = (kind, n, awal) =>
      Array.from({ length: n }, (_, k) => ({
        id: `${p.id}-${kind}-${k + 1}`,
        storageKey: `projects/${p.slug}/contoh-${((awal + k) % 6) + 1}.svg`,
        url: `http://127.0.0.1:${PORT}/media/projects/${p.slug}/contoh-${((awal + k) % 6) + 1}.svg`,
        thumbUrl: null,
        caption: kind === "material" ? ["Kayu ulin", "Beton ekspos", "Batu alam"][k % 3] : k === 0 ? "Fasad depan" : null,
        altText: null,
        sortOrder: k,
      }));
    return [p.id, { galeri: buat("galeri", Math.max(0, 6 - i * 2), i), material: buat("material", Math.max(0, 3 - i), i + 2) }];
  }),
);

/* Portal klien per proyek: brief, dokumen (berikut komentarnya), dan
   progres. Proyek pertama terisi lengkap; yang kedua belum diisi klien —
   supaya dua keadaan brief ("dikirim klien" lawan "belum") bisa dilihat. */
const briefAdmin = Object.fromEntries(
  proyekAdmin.map((p, i) => [p.id, i === 0
    ? { budgetRange: null, budgetAmount: 450_000_000, startDate: "2026-10-05", endDate: "2027-03-30", timeline: null,
        stylePreference: "Tropis modern, banyak kayu", requirements: "Bar kopi 6 m, 40 kursi, dapur terbuka, mushola kecil, parkir motor 20.",
        internalNotes: "Sudah ditelepon 22 Sep. Minta contoh referensi kafe di Singkawang.", submittedAt: hariLalu(9) }
    : { budgetRange: null, budgetAmount: null, startDate: null, endDate: null, timeline: null,
        stylePreference: null, requirements: null, internalNotes: null, submittedAt: null }]),
);
const dokumenAdmin = Object.fromEntries(
  proyekAdmin.map((p, i) => [p.id, i > 1 ? [] : [
    ["Denah lantai 1 Rev.2", "berkas", "menunggu_klien", "denah-lt1-rev2.pdf", 2_480_000, "application/pdf", null, null, 2],
    ["Tampak depan", "berkas", "revisi_diminta", "tampak-depan.png", 1_120_000, "image/png", "Jendela samping tolong diperbesar.", null, 4],
    ["Pesan suara 0:42", "suara", "final", null, 180_000, "audio/webm", null, 42_000, 6],
    ["RAB tahap 1", "berkas", "disetujui", "rab-tahap-1.pdf", 640_000, "application/pdf", null, null, 11],
  ].map(([title, kind, status, fileName, fileSize, mimeType, clientNote, durationMs, umur], k) => ({
    id: `${p.id}-dok-${k + 1}`, projectId: p.id, title, kind, status, fileName, fileSize, mimeType, clientNote, durationMs,
    fileUrl: `http://127.0.0.1:${PORT}/media/projects/${p.slug}/contoh-${k + 1}.svg`, sortOrder: k,
    createdAt: hariLalu(umur), updatedAt: hariLalu(umur),
  }))]),
);
const komentarAdmin = {
  "k1-dok-2": [
    { id: "c1", documentId: "k1-dok-2", author: "klien", body: "Jendela samping tolong diperbesar, supaya dapur lebih terang.", createdAt: hariLalu(3, 14) },
    { id: "c2", documentId: "k1-dok-2", author: "staf", body: "Baik, kami revisi minggu ini.", createdAt: hariLalu(2, 9) },
  ],
};
const progresAdmin = Object.fromEntries(
  proyekAdmin.map((p, i) => [p.id, {
    phase: p.phase ?? "konsultasi",
    /* 40 heksa, persis bentuk token sungguhan — /progres menolak bentuk
       lain sebagai "tautan tidak lengkap" sebelum sempat bertanya ke API. */
    accessToken: `${String(i + 1).padStart(2, "0")}${"7f3a9c".repeat(7)}`.slice(0, 40),
    updates: i > 1 ? [] : [
      { id: `${p.id}-up-1`, title: "Survei lokasi selesai", note: "Ukuran tapak sesuai sertifikat. Pohon mangga dipertahankan.", photoUrl: null, createdAt: hariLalu(12) },
      { id: `${p.id}-up-2`, title: "Konsep disetujui", note: null, photoUrl: null, createdAt: hariLalu(5) },
    ].reverse(),
  }]),
);

/* Direktori dan testimoni — halaman Tugas & daftar. Kategori direktori
   sengaja tidak rata (supplier cuma satu), dan testimoni membawa ketiga
   status beserta satu yang tampil di beranda. */
const kontakAdmin = [
  ["Bu Ratna Sari", "klien", "Kedai Kopi Ruas", "0812-5566-7788", "ratna@ruas.id", "Suka ditelepon sore"],
  ["Pak Hendra", "klien", null, "0813-2222-1111", null, null],
  ["CV Karya Bangun", "kontraktor", "CV Karya Bangun", "0561-733-201", "proyek@karyabangun.co.id", "Tukang kayu bagus"],
  ["Andi Saputra", "kontraktor", "Saputra Konstruksi", "0852-4545-9090", null, null],
  ["Toko Kayu Jati Borneo", "supplier", null, "0561-744-118", "jatiborneo@gmail.com", "Diskon 5% di atas 10 m³"],
  ["Studio Cahaya", "lainnya", "Konsultan pencahayaan", null, "halo@studiocahaya.id", null],
].map(([name, category, company, phone, email, note], i) => ({
  id: `kt${i + 1}`, name, category, company, phone, email, note,
  createdAt: hariLalu(40 - i * 5), updatedAt: hariLalu(40 - i * 5),
}));
const testimoniAdmin = [
  ["Ratna Sari", "k1", "Kedai Kopi Ruas", "Alur bar-nya benar-benar dipikirkan. Barista kami tidak lagi saling tabrak di jam ramai, dan pelanggan betah duduk lama.", 5, "disetujui", true, 20],
  ["Hendra Wijaya", "k2", "Rumah Tropis Sungai Raya", "Rumahnya sejuk tanpa AC di siang hari. Tim studio sabar menjelaskan setiap revisi.", 5, "disetujui", false, 12],
  ["Liana", "k3", "Renovasi Bakmi Hauw", "Renovasinya selesai tepat waktu dan dapur jadi jauh lebih lega.", 4, "menunggu", false, 3],
  ["Anonim", null, null, "Bagus.", null, "ditolak", false, 30],
].map(([clientName, projectId, projectTitle, quote, rating, status, isFeatured, umur], i) => ({
  id: `ts${i + 1}`, clientName, projectId, projectTitle, quote, rating, status, isFeatured,
  createdAt: hariLalu(umur), updatedAt: hariLalu(umur),
}));

/* Pembayaran per proyek. Dua sampai empat butir, mundur beberapa minggu —
   cukup untuk mengisi strip mendatar di frame 07 dan untuk membuktikan
   striponya memang MELEWATI tepi kartu seperti di framenya. */
const bayarAdmin = Object.fromEntries(
  proyekAdmin.map((p, i) => {
    const n = 2 + (i % 3);
    const potong = Math.round(p.paidTotal / n);
    return [
      p.id,
      Array.from({ length: n }, (_, j) => {
        const d = new Date();
        d.setDate(d.getDate() - (j * 26 + i * 3));
        return {
          id: `${p.id}-bayar-${j + 1}`,
          projectId: p.id,
          amount: j === 0 ? p.paidTotal - potong * (n - 1) : potong,
          kind: j === n - 1 ? "dp" : "termin",
          method: ["transfer", "tunai", "qris", "lainnya"][(i + j) % 4],
          receiver: ["Dirga", "Sari", "Dirga"][j % 3],
          /* Sebagian saja yang bercatatan — kolom Catatan di halaman Semua
             Transaksi harus terlihat apa adanya, termasuk yang kosong. */
          note: j % 2 === 0 ? null : ["setelah gambar kerja", "lewat rekening BCA", "tunai di kantor"][i % 3],
          paidAt: d.toISOString(),
          receiptToken: `tok${i}${j}`,
        };
      }),
    ];
  }),
);

/* Tagihan (termin) lintas proyek. Sengaja tidak rata: satu proyek punya
   termin tanpa tenggat (draf yang belum dijadwalkan) dan satu punya termin
   yang tenggatnya sudah lewat, supaya keempat lencana statusnya ikut
   tergambar di halaman Tagihan & Termin. */
const tagihanAdmin = proyekAdmin.flatMap((p, i) => {
  const n = 3 + (i % 2);
  const potong = Math.round(p.contractValue / n);
  return Array.from({ length: n }, (_, j) => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - 1 + j + (i % 2));
    const tanpaTenggat = j === n - 1 && i % 3 === 0;
    return {
      id: `${p.id}-tagih-${j + 1}`,
      projectId: p.id,
      projectTitle: p.title,
      label: ["Termin 1 — DP", "Termin 2 — gambar kerja", "Termin 3 — konstruksi", "Termin 4 — serah terima"][j],
      amount: j === n - 1 ? p.contractValue - potong * (n - 1) : potong,
      status: j === 0 ? "lunas" : j === 1 ? "terbit" : "draft",
      dueDate: tanpaTenggat ? null : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-10`,
      paidAt: j === 0 ? d.toISOString() : null,
      sortOrder: j,
    };
  });
});


/* Tugas per proyek, tersebar di tahap pipeline. Sebagian lewat tenggat dan
   sebagian selesai, supaya kartu tahap di halaman Satu Proyek memperlihatkan
   keempat keadaannya (selesai, berjalan, terlambat, kosong). */
const JUDUL_TUGAS = {
  proposal: ["Survei lokasi", "Susun proposal biaya"],
  deal_kontrak: ["Tanda tangan kontrak", "Kirim salinan kontrak"],
  dp_50: ["Terbitkan tagihan DP", "Konfirmasi DP masuk"],
  desain_1: ["Denah lantai 1", "Denah lantai 2", "Konsep fasad", "Presentasi konsep", "Revisi konsep"],
  desain_2: ["Gambar kerja arsitektur", "Detail bar dan dapur", "Rencana pencahayaan", "RAB"],
  finish: ["Serah terima gambar", "Kunjungan akhir"],
  pelunasan: ["Terbitkan tagihan pelunasan"],
};
const TIM = ["Dirga", "Sari Ningsih", "Bima", null];
const tugasAdmin = Object.fromEntries(
  proyekAdmin.map((p, i) => {
    const urut = ["proposal", "deal_kontrak", "dp_50", "desain_1", "desain_2", "finish", "pelunasan"];
    const kini = urut.indexOf(p.pipelineStage);
    const daftar = [];
    urut.forEach((tahap, t) => {
      (JUDUL_TUGAS[tahap] ?? []).forEach((judul, j) => {
        const d = new Date();
        d.setDate(d.getDate() + (t - kini) * 12 + j * 3 - 4);
        daftar.push({
          id: `${p.id}-tugas-${t}-${j}`,
          projectId: p.id,
          projectTitle: p.title,
          title: judul,
          stage: tahap,
          assigneeId: null,
          assigneeName: TIM[(i + t + j) % TIM.length],
          status: t < kini ? "selesai" : t === kini ? (j < 2 ? "selesai" : j === 2 ? "berjalan" : "belum_mulai") : "belum_mulai",
          dueDate: d.toISOString().slice(0, 10),
          sortOrder: j,
        });
      });
    });
    return [p.id, daftar];
  }),
);

/* Fee lintas proyek — tiruan dari repository/fee.ts: biaya berkategori
   freelancer ATAU prinsipal, disaring `dari`/`sampai` kalau ada. */
function saringFee(path) {
  const q = new URLSearchParams(path.split("?")[1] ?? "");
  const dari = q.get("dari") ?? q.get("from");
  const sampai = q.get("sampai") ?? q.get("to");
  return [...biayaKeu, ...biayaRiwayat].filter(
    (b) =>
      (b.category === "freelancer" || b.category === "prinsipal") &&
      (!dari || b.incurredOn >= dari) &&
      (!sampai || b.incurredOn <= sampai),
  );
}
function feeOrang(path) {
  const peta = new Map();
  for (const b of saringFee(path)) {
    if (!b.teamMemberId) continue;
    const t = timAdmin.find((x) => x.id === b.teamMemberId);
    const o = peta.get(b.teamMemberId) ?? {
      teamMemberId: b.teamMemberId, name: t?.name ?? b.teamMemberName, kind: t?.kind ?? "proyek",
      role: t?.role ?? null, total: 0, proyek: new Set(), lastOn: null,
    };
    o.total += b.amount;
    o.proyek.add(b.projectId);
    if (!o.lastOn || b.incurredOn > o.lastOn) o.lastOn = b.incurredOn;
    peta.set(b.teamMemberId, o);
  }
  return [...peta.values()]
    .map(({ proyek, ...o }) => ({ ...o, projectCount: proyek.size }))
    .sort((a, z) => z.total - a.total);
}
function feeProyek(path) {
  const peta = new Map();
  for (const b of saringFee(path)) {
    const p = proyekKeu.find((x) => x.projectId === b.projectId);
    const o = peta.get(b.projectId) ?? {
      projectId: b.projectId, projectTitle: p?.projectTitle ?? b.projectTitle,
      contractValue: p?.contractValue ?? null, feeTotal: 0, feeTanpaNama: 0, orang: new Map(),
    };
    /* feeTotal HANYA yang bernama — sama dengan `fee_total` di fee.ts. */
    if (!b.teamMemberId) o.feeTanpaNama += b.amount;
    else {
      o.feeTotal += b.amount;
      const kind = timAdmin.find((t) => t.id === b.teamMemberId)?.kind ?? "proyek";
      const x = o.orang.get(b.teamMemberId) ?? { teamMemberId: b.teamMemberId, name: b.teamMemberName, kind, amount: 0 };
      x.amount += b.amount;
      o.orang.set(b.teamMemberId, x);
    }
    peta.set(b.projectId, o);
  }
  return [...peta.values()]
    .map((o) => ({
      ...o,
      orang: [...o.orang.values()].sort((a, z) => z.amount - a.amount),
      feeShare: o.contractValue ? o.feeTotal / o.contractValue : null,
    }))
    .sort((a, z) => z.feeTotal - a.feeTotal);
}

/* Gaji bulanan — halaman Gaji (frame 25 isi gaji). Tiga orang bergaji
   tetap selama 14 bulan, naik di Januari; bulan berjalan sengaja belum
   lunas untuk dua orang, supaya status "belum dibayar" ikut tergambar.
   Fee TIDAK diketik di sini — sama dengan API sungguhan, ia dijumlahkan dari
   biaya proyek yang bernama. */
const gajiAdmin = [];
{
  const dasar = [["t1", 12_000_000], ["t2", 8_500_000], ["t3", 6_500_000]];
  for (let m = 13; m >= 0; m--) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - m);
    const y = d.getFullYear();
    const bln = String(d.getMonth() + 1).padStart(2, "0");
    dasar.forEach(([orang, nominal], j) => {
      const naik = y >= new Date().getFullYear() ? 1.1 : 1;
      gajiAdmin.push({
        id: `g${y}${bln}-${j}`,
        teamMemberId: orang,
        teamMemberName: timAdmin.find((t) => t.id === orang).name,
        period: `${y}-${bln}-01`,
        amount: Math.round((nominal * naik) / 50_000) * 50_000,
        paidOn: m === 0 && j > 0 ? null : `${y}-${bln}-25`,
        note: j === 0 ? "Termasuk tunjangan transport" : null,
      });
    });
  }
}
/* Slip satu orang satu bulan — sama dengan payroll.slip() di API. */
function slipTiruan(orang, period) {
  const t = timAdmin.find((x) => x.id === orang);
  if (!t) return null;
  const awal = `${period.slice(0, 7)}-01`;
  const g = gajiAdmin.find((x) => x.teamMemberId === orang && x.period === awal);
  const fees = [...biayaKeu, ...biayaRiwayat]
    .filter((b) => b.teamMemberId === orang && b.incurredOn.slice(0, 7) === period.slice(0, 7))
    .sort((a, b) => a.incurredOn.localeCompare(b.incurredOn))
    .map((b) => {
      const a = timProyek.find((x) => x.id === b.projectTeamId);
      return { costId: b.id, projectId: b.projectId, projectTitle: b.projectTitle, label: b.label, amount: b.amount,
        incurredOn: b.incurredOn, role: a?.role ?? null, pct: a ? a.pct ?? pctPeran(a.role) : null, payoutStage: b.payoutStage ?? null };
    });
  const salaryAmount = g ? g.amount : 0;
  const feeAmount = fees.reduce((n, f) => n + f.amount, 0);
  return { teamMemberId: t.id, name: t.name, kind: t.kind, role: t.role, phone: t.phone, period: awal,
    salary: g ? { id: g.id, amount: g.amount, paidOn: g.paidOn, note: g.note } : null,
    fees, salaryAmount, feeAmount, total: salaryAmount + feeAmount };
}
/* Riwayat slip dua belas bulan — sama dengan payroll.riwayatSlip() di API:
   tiap bulan dijumlah dari slipTiruan() supaya batang = total slip. */
function riwayatSlipTiruan(orang, sampai) {
  const [y, m] = sampai.split("-").map(Number);
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1 - (11 - i), 1));
    const k = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    const s = slipTiruan(orang, k);
    return { period: k, salary: s?.salaryAmount ?? 0, salaryPaid: s?.salary ? !!s.salary.paidOn : null,
      fee: s?.feeAmount ?? 0, feeCount: s?.fees.length ?? 0, total: s?.total ?? 0 };
  });
}
/* Ringkasan hak per orang — sama dengan projectTeam.perOrang() di API. */
function orangTiruan() {
  const peta = new Map();
  for (const p of daftarTimProyek(null)) {
    const o = peta.get(p.teamMemberId) ?? { teamMemberId: p.teamMemberId, teamMemberName: p.teamMemberName,
      teamMemberKind: p.teamMemberKind, proyek: 0, hak: 0, dibayar: 0, terutang: 0, jatuhTempo: 0, belumDitentukan: 0 };
    o.proyek += 1;
    o.dibayar += p.dibayar;
    if (p.hak === null) o.belumDitentukan += 1;
    else { o.hak += p.hak; o.terutang += p.hak - p.dibayar; }
    for (const t of p.tahap) if (t.keadaan === "jatuh_tempo" && t.nominal) o.jatuhTempo += t.nominal;
    peta.set(p.teamMemberId, o);
  }
  return [...peta.values()].sort((a, b) => b.terutang - a.terutang || a.teamMemberName.localeCompare(b.teamMemberName));
}
function gajiSebulan(period) {
  const awal = `${period.slice(0, 7)}-01`;
  const semuaBiayaTiruan = [...biayaKeu, ...biayaRiwayat];
  return timAdmin
    .map((t) => {
      const g = gajiAdmin.find((x) => x.teamMemberId === t.id && x.period === awal);
      const fee = semuaBiayaTiruan.filter((b) => b.teamMemberId === t.id && b.incurredOn.slice(0, 7) === period.slice(0, 7));
      const feeAmount = fee.reduce((a, b) => a + b.amount, 0);
      if (!g && fee.length === 0) return null;
      return {
        teamMemberId: t.id, name: t.name, kind: t.kind, role: t.role,
        salaryId: g ? g.id : null, salaryAmount: g ? g.amount : null,
        salaryPaidOn: g ? g.paidOn : null, salaryNote: g ? g.note : null,
        feeAmount, feeCount: fee.length, total: (g ? g.amount : 0) + feeAmount,
      };
    })
    .filter(Boolean);
}

/* Buku gaji satu tahun — sama dengan payroll.buku() di API: tiap bulan
   dijumlah dari gajiSebulan(), jadi indeks bulan = baris Jumlah daftarnya. */
function bukuTiruan(tahun) {
  const y = Number(tahun);
  const months = Array.from({ length: 24 }, (_, i) => {
    const k = `${y - 1 + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}`;
    const d = gajiSebulan(k);
    const salary = d.reduce((n, r) => n + (r.salaryAmount ?? 0), 0);
    const fee = d.reduce((n, r) => n + r.feeAmount, 0);
    return {
      period: k, salary, salaryCount: d.filter((r) => r.salaryId).length,
      salaryUnpaid: d.filter((r) => r.salaryId && !r.salaryPaidOn).length,
      fee, feeCount: d.reduce((n, r) => n + r.feeCount, 0), people: d.length, total: salary + fee,
    };
  });
  const per = new Map();
  for (const g of gajiAdmin) {
    const t = Number(g.period.slice(0, 4));
    const v = per.get(t) ?? { year: t, salary: 0, fee: 0 };
    v.salary += g.amount;
    per.set(t, v);
  }
  for (const b of [...biayaKeu, ...biayaRiwayat]) {
    if (!b.teamMemberId) continue;
    const t = Number(b.incurredOn.slice(0, 4));
    const v = per.get(t) ?? { year: t, salary: 0, fee: 0 };
    v.fee += b.amount;
    per.set(t, v);
  }
  const years = [...per.values()].sort((a, z) => a.year - z.year).map((v) => ({ ...v, total: v.salary + v.fee }));
  return { months, years };
}

/* Tombol Terbitkan. Cap perubahan bergeser tiap kali ada penulisan — sama
   dengan trigger content_revision di database — dan mulai dari jauh di masa
   lalu, jadi halaman yang baru dimuat bertanda "sudah sama" sampai sesuatu
   disimpan. */
/* Kas studio (sheet KELUAR MASUK) dan target semester — fase 4. Tanggalnya
   relatif terhadap hari ini supaya selalu jatuh di semester berjalan. */
const kasHariLalu = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const kasAdmin = [
  ["masuk", "penjualan_material", "Penjualan PVC", "Ko Fendy", 1_440_000, 2, null],
  ["keluar", "konsumsi", "Konsumsi rapat klien", "Nisa", 85_000, 3, null],
  ["keluar", "operasional", "Sewa kantor Oktober", null, 4_200_000, 4, null],
  ["masuk", "bagi_hasil", "Cashbon bagi hasil", "Reza", 2_000_000, 19, null],
  ["keluar", "pembelian_material", "Sampel keramik untuk presentasi", "Toko Sinar", 650_000, 23, "k1"],
  ["keluar", "operasional", "Sewa kantor September", null, 4_200_000, 34, null],
  ["masuk", "penjualan_material", "Penjualan PVC", "Pak Hendra", 3_150_000, 48, null],
].map(([direction, category, label, counterparty, amount, lalu, projectId], i) => ({
  id: `kas${i + 1}`, direction, category, label, counterparty, amount, occurredOn: kasHariLalu(lalu),
  projectId, projectTitle: projectId ? proyekAdmin.find((p) => p.id === projectId)?.title ?? null : null, note: null,
}));
const targetAdmin = [{ semesterStart: "2026-07-01", amount: 1_000_000_000, note: null }];
function awalSemester(iso) {
  const [y, m] = iso.split("-").map(Number);
  return `${y}-${m <= 6 ? "01" : "07"}-01`;
}
function kemajuanTiruan(semester) {
  const kini = kasHariLalu(0);
  const mulai = semester || awalSemester(kini);
  const [y, m] = mulai.split("-").map(Number);
  const akhir = m === 1 ? `${y}-06-30` : `${y}-12-31`;
  const sendiri = targetAdmin.find((t) => t.semesterStart === mulai);
  const lama = targetAdmin.filter((t) => t.semesterStart < mulai).sort((a, b) => b.semesterStart.localeCompare(a.semesterStart))[0];
  const target = sendiri?.amount ?? lama?.amount ?? null;
  const dalam = (t) => t >= mulai && t <= akhir;
  const pembayaranKlien = Object.values(bayarAdmin).flat().filter((b) => dalam(b.paidAt.slice(0, 10))).reduce((n, b) => n + b.amount, 0);
  const kasLain = kasAdmin.filter((k) => k.direction === "masuk" && dalam(k.occurredOn)).reduce((n, k) => n + k.amount, 0);
  const tercapai = pembayaranKlien + kasLain;
  const sisaHari = kini > akhir ? 0 : Math.round((new Date(`${akhir}T00:00:00`) - new Date(`${kini < mulai ? mulai : kini}T00:00:00`)) / 864e5) + 1;
  const kurang = target === null ? null : Math.max(0, target - tercapai);
  const sisaBulan = Math.max(1, Math.ceil(sisaHari / 30.44));
  return { semesterStart: mulai, semesterEnd: akhir, target, asal: sendiri ? "ditetapkan" : lama ? "diteruskan" : null,
    pembayaranKlien, kasLain, tercapai, kurang, sisaHari,
    perBulanDibutuhkan: kurang === null || kurang === 0 || sisaHari === 0 ? null : Math.ceil(kurang / sisaBulan) };
}
/* Pemakaian paket (§3.3) dan KPI (§8) — fase 4. Starter diberi tiga proyek
   selesai "lama" (tidak ada di daftar proyek tiruan) supaya keadaan amber
   "saatnya naik harga" ikut tergambar. */
const SELESAI_LAMA = { "t0000000-0000-4000-8000-000000000001": 3 };
function pemakaianTiruan() {
  return paketAdmin.map((t) => {
    const milik = proyekAdmin.filter((p) => p.tierId === t.id);
    const selesai = milik.filter((p) => ["finish", "pelunasan"].includes(p.pipelineStage)).length + (SELESAI_LAMA[t.id] ?? 0);
    return { tierId: t.id, priceChangedAt: "2026-01-15T00:00:00.000Z", proyek: milik.length + (SELESAI_LAMA[t.id] ?? 0),
      selesai, selesaiSejakHarga: selesai, saatnyaNaik: selesai >= 3 };
  });
}
function kpiTiruan() {
  const semuaBiaya = [...biayaKeu, ...biayaRiwayat];
  const berkontrak = proyekAdmin.filter((p) => p.contractValue > 0);
  const margins = berkontrak.map((p) => {
    const biaya = semuaBiaya.filter((b) => b.projectId === p.id).reduce((n, b) => n + b.amount, 0);
    return { projectId: p.id, title: p.title, kontrak: p.contractValue, biaya, margin: ((p.contractValue - biaya) / p.contractValue) * 100 };
  });
  const tk = margins.reduce((n, m) => n + m.kontrak, 0);
  const tb = margins.reduce((n, m) => n + m.biaya, 0);
  const bayar = Object.values(bayarAdmin).flat();
  const masuk = bayar.reduce((n, b) => n + b.amount, 0) + kasAdmin.filter((k) => k.direction === "masuk").reduce((n, k) => n + k.amount, 0);
  const keluar = semuaBiaya.reduce((n, b) => n + b.amount, 0) + kasAdmin.filter((k) => k.direction === "keluar").reduce((n, k) => n + k.amount, 0)
    + gajiAdmin.filter((g) => g.paidOn).reduce((n, g) => n + g.amount, 0);
  const keluarPerBulan = Math.round(keluar / 6);
  const saldo = masuk - keluar + 1_250_000_000; // saldo awal tiruan supaya angkanya masuk akal
  const kategori = [...new Set(proyekAdmin.map((p) => p.category))];
  const sig = proyekAdmin.filter((p) => (paketAdmin.find((t) => t.id === p.tierId)?.sortOrder ?? 0) >= 2);
  return {
    hariIni: kasHariLalu(0), tahun: new Date().getFullYear(), kuartal: Math.floor(new Date().getMonth() / 3) + 1,
    target: { rataKontrakMin: 50_000_000, rataKontrakMaks: 70_000_000, marginMin: 35, leadKuartalMin: 10, leadKuartalMaks: 15, signatureMin: 3, cadanganBulan: 6 },
    rataKontrak: { nilai: Math.round(tk / Math.max(1, berkontrak.length)), proyek: berkontrak.length },
    margin: { rata: tk ? ((tk - tb) / tk) * 100 : null, proyek: margins.length,
      dibawah: [...margins, { projectId: "k6", title: "Renovasi Dapur Bu Ratna", kontrak: 18_000_000, biaya: 13_500_000, margin: 25 }]
        .filter((m) => m.margin < 35).sort((a, b) => a.margin - b.margin) },
    lead: { kuartalIni: pesanAdmin.length, ditindaklanjuti: pesanAdmin.filter((x) => ["contacted", "qualified"].includes(x.status)).length },
    signature: { jumlah: sig.length, proyek: sig.map((p) => ({ projectId: p.id, title: p.title, tier: paketAdmin.find((t) => t.id === p.tierId).name })) },
    cadangan: { saldo, keluarPerBulan, bulanBerdata: 6, bulan: saldo / keluarPerBulan },
    segmen: kategori.map((kat) => {
      const ids = proyekAdmin.filter((p) => p.category === kat).map((p) => p.id);
      const diterima = bayar.filter((b) => ids.includes(b.projectId)).reduce((n, b) => n + b.amount, 0);
      const biaya = semuaBiaya.filter((b) => ids.includes(b.projectId)).reduce((n, b) => n + b.amount, 0);
      return { kategori: kat, proyek: ids.length, diterima, biaya, laba: diterima - biaya };
    }),
  };
}
let capBerubah = "2026-01-01T00:00:00.000Z";
const jawab = (path) => {
  {
    const gb = path.match(/^\/api\/v1\/admin\/payroll\/month\?period=([0-9-]+)/);
    if (gb) return gajiSebulan(gb[1]);
  }
  {
    const bk = path.match(/^\/api\/v1\/admin\/payroll\/ledger\?year=(\d{4})/);
    if (bk) return bukuTiruan(bk[1]);
  }
  {
    const rw = path.match(/^\/api\/v1\/admin\/payroll\/slip\/history\?teamMemberId=([^&]+)&until=([0-9-]+)/);
    if (rw) return riwayatSlipTiruan(decodeURIComponent(rw[1]), rw[2]);
  }
  {
    const sl = path.match(/^\/api\/v1\/admin\/payroll\/slip\?teamMemberId=([^&]+)&period=([0-9-]+)/);
    if (sl) return slipTiruan(decodeURIComponent(sl[1]), sl[2]);
  }
  if (path.startsWith("/api/v1/admin/payroll")) return gajiAdmin;
  if (path.startsWith("/api/v1/admin/ledger")) {
    const dari = path.match(/dari=([0-9-]+)/)?.[1];
    const sampai = path.match(/sampai=([0-9-]+)/)?.[1];
    return kasAdmin.filter((k) => (!dari || k.occurredOn >= dari) && (!sampai || k.occurredOn <= sampai))
      .sort((a, b) => b.occurredOn.localeCompare(a.occurredOn));
  }
  {
    const tp = path.match(/^\/api\/v1\/admin\/targets\/progress(?:\?semester=([0-9-]+))?/);
    if (tp) return kemajuanTiruan(tp[1]);
  }
  if (path.startsWith("/api/v1/admin/targets")) return targetAdmin;
  if (path.startsWith("/api/v1/admin/publish-status")) return { terakhirBerubah: capBerubah };
  if (path.startsWith("/api/v1/admin/settings")) return { ...setelan, terbitSitusAktif: true };
  if (path.startsWith("/api/v1/admin/account")) {
    return {
      email: profil.email, role: "admin", isMasterAdmin: true, nama: profil.nama, avatarUrl: profil.avatarUrl,
      stafSejak: "2026-08-18T03:00:00.000Z", terakhirMasuk: jamLalu(26),
      sesi: {
        jumlah: 1 + sesiLain.length + sesiTanpaNama,
        aktif24j: 1 + sesiLain.filter((x) => Date.now() - Date.parse(x.terakhirAktif) < 864e5).length,
        ini: sesiIni, lain: sesiLain,
        tanpaNama: sesiTanpaNama, tanpaNamaTerakhir: sesiTanpaNama ? jamLalu(24 * 12) : null,
      },
    };
  }
  if (path.startsWith("/api/v1/admin/me")) return profil;
  if (path.startsWith("/api/v1/admin/finance/overview")) return ringkasanKeu;
  if (path.startsWith("/api/v1/admin/finance/monthly")) return bulananKeu;
  /* Urutan Worker: tanggal terjadi terbaru dulu, lalu yang terakhir dicatat. */
  if (path.startsWith("/api/v1/admin/costs"))
    return [...biayaKeu, ...biayaRiwayat]
      .map((b, i) => [b, i])
      .sort(([a, ia], [z, iz]) => z.incurredOn.localeCompare(a.incurredOn) || ia - iz)
      .map(([b]) => b);
  if (path.startsWith("/api/v1/admin/inquiries")) return pesanAdmin;
  {
    const j = path.match(/^\/api\/v1\/admin\/journal\/([^/?]+)/);
    if (j) return jurnalAdmin.find((x) => x.id === j[1]) ?? null;
  }
  if (path.startsWith("/api/v1/admin/journal")) return jurnalAdmin;
  if (path.startsWith("/api/v1/admin/tiers/usage")) return pemakaianTiruan();
  if (path.startsWith("/api/v1/admin/kpi")) return kpiTiruan();
  {
    const t = path.match(/^\/api\/v1\/admin\/tiers\/([^/?]+)/);
    if (t) return paketAdmin.find((x) => x.id === t[1]) ?? null;
  }
  if (path.startsWith("/api/v1/admin/tiers")) return urutPaket();
  if (path.startsWith("/api/v1/tiers")) return urutPaket().filter((x) => x.active);
  if (path.startsWith("/api/v1/admin/fee/people")) return feeOrang(path);
  if (path.startsWith("/api/v1/admin/fee/projects")) return feeProyek(path);
  if (path.startsWith("/api/v1/admin/clients")) return urutKlien();
  if (path.startsWith("/api/v1/admin/studio-team")) return orangStudio;
  // Sama dengan feeRules.ringkasan(): dihitung dari timProyek dan biaya
  // bertaut tahapnya, bukan angka karangan.
  if (path === "/api/v1/admin/fee-rules/ringkasan") {
    const perPeran = Object.fromEntries(["leader", "drafter", "render", "estimator"].map((r) => [r, {
      ikutAturan: timProyek.filter((t) => t.role === r && t.pct === null).length,
      persenTetap: timProyek.filter((t) => t.role === r && t.pct !== null).length,
    }]));
    const lunas = (t) => [...biayaKeu, ...biayaRiwayat].filter((b) => b.projectTeamId === t.id).length >= 2;
    return { ...aturanFeeKop, perPeran, belumLunas: timProyek.filter((t) => !lunas(t)).length };
  }
  if (path.startsWith("/api/v1/admin/fee-rules")) return aturanFee;
  if (path.startsWith("/api/v1/admin/team-payouts/people")) return orangTiruan();
  if (path.startsWith("/api/v1/admin/team-payouts")) {
    const o = path.match(/teamMemberId=([^&]+)/);
    return daftarTimProyek(null).filter((a) => !o || a.teamMemberId === o[1]);
  }
  {
    const m = path.match(/^\/api\/v1\/admin\/projects\/([^/?]+)\/team$/);
    if (m) return daftarTimProyek(m[1]);
  }
  if (path.startsWith("/api/v1/admin/team")) return timAdmin;
  if (path.startsWith("/api/v1/admin/directory")) return kontakAdmin;
  if (path.startsWith("/api/v1/admin/testimonials")) return testimoniAdmin;
  if (path.startsWith("/api/v1/admin/invoices")) return tagihanAdmin;
  /* Yang PALING KHUSUS lebih dulu: "/admin/projects/<id>/payments" juga
     berawalan "/admin/projects", jadi urutan terbalik membuat daftar
     pembayaran dijawab dengan daftar proyek — dan halamannya menggambar
     kartu pembayaran berisi judul proyek tanpa satu pun galat. */
  /* Portal klien publik (/progres?t=…) — disusun dari data admin yang sama,
     jadi yang ditulis staf di Portal Klien terlihat di sini seperti di
     produksi. Termasuk komentar berpenulis "staf": portal pernah memeriksa
     "studio", dan balasan studio tampil sebagai "Anda". */
  {
    const m = path.match(/^\/api\/v1\/progress\/([^/?]+)$/);
    if (m) {
      const p = proyekAdmin.find((x) => progresAdmin[x.id]?.accessToken === m[1]);
      if (!p) return { galat: 404 };
      return {
        projectTitle: p.title, coverImageUrl: p.coverImageUrl ?? null, phase: progresAdmin[p.id].phase,
        category: p.category, city: p.city ?? "Pontianak", contractValue: p.contractValue, updatedAt: new Date().toISOString(),
        updates: progresAdmin[p.id].updates,
        documents: (dokumenAdmin[p.id] ?? []).map((d) => ({ ...d, comments: komentarAdmin[d.id] ?? [] })),
        invoices: tagihanAdmin.filter((t) => t.projectId === p.id),
        brief: briefAdmin[p.id] ?? {},
      };
    }
  }
  {
    const m = path.match(/^\/api\/v1\/admin\/projects\/([^/?]+)\/(brief|documents|progress)$/);
    if (m) return { brief: briefAdmin, documents: dokumenAdmin, progress: progresAdmin }[m[2]][m[1]] ?? null;
    const k = path.match(/^\/api\/v1\/admin\/documents\/([^/?]+)\/comments$/);
    if (k) return komentarAdmin[k[1]] ?? [];
  }
  {
    const m = path.match(/^\/api\/v1\/admin\/projects\/([^/?]+)\/images(?:\?kind=(\w+))?/);
    if (m) return gambarAdmin[m[1]]?.[m[2] ?? "galeri"] ?? [];
  }
  {
    const m = path.match(/^\/api\/v1\/admin\/projects\/([^/?]+)\/tasks/);
    if (m) return tugasAdmin[m[1]] ?? [];
  }
  if (path.startsWith("/api/v1/admin/tasks")) return Object.values(tugasAdmin).flat();
  /* Per proyek — dipakai PDF Rincian Biaya dan Daftar Tagihan di Satu
     Proyek. Tanpa ini keduanya jatuh ke "/admin/projects" dan PDF-nya
     tersusun dari daftar PROYEK. */
  {
    const bp = path.match(/^\/api\/v1\/admin\/projects\/([^/?]+)\/costs$/);
    if (bp) return [...biayaKeu, ...biayaRiwayat].filter((b) => b.projectId === bp[1]);
    const tp = path.match(/^\/api\/v1\/admin\/projects\/([^/?]+)\/invoices$/);
    if (tp) return tagihanAdmin.filter((t) => t.projectId === tp[1]).map(({ projectTitle, ...t }) => t);
  }
  {
    const m = path.match(/^\/api\/v1\/admin\/projects\/([^/?]+)\/payments/);
    if (m) return bayarAdmin[m[1]] ?? [];
  }
  /* Lintas proyek — judul proyek ikut di baris, sama seperti /admin/costs. */
  if (path.startsWith("/api/v1/admin/payments")) {
    return Object.values(bayarAdmin)
      .flat()
      .map((b) => ({
        ...b,
        projectTitle: proyekAdmin.find((p) => p.id === b.projectId)?.title,
      }))
      .sort((a, z) => z.paidAt.localeCompare(a.paidAt));
  }
  if (path.startsWith("/api/v1/admin/projects")) return proyekAdmin;
  if (path.startsWith("/api/v1/projects/")) return proyek[0];
  if (path.startsWith("/api/v1/projects")) return proyek;
  if (path.startsWith("/api/v1/settings")) return setelan;
  {
    const j = path.match(/^\/api\/v1\/journal\/([^/?]+)/);
    if (j) return jurnalAdmin.find((x) => x.slug === j[1] && x.publishedAt && x.publishedAt <= new Date().toISOString()) ?? null;
  }
  if (path.startsWith("/api/v1/journal")) return jurnalAdmin.map(({ body, ...x }) => x);
  if (path.startsWith("/api/v1/team")) return [];
  if (path.startsWith("/api/v1/clients")) return [];
  if (path.startsWith("/api/v1/testimonials")) return [];
  return [];
};

/* Satu-satunya PENULISAN yang ditiru: mengubah status tagihan.
 *
 * Ada karena tanpanya halaman Tagihan & Termin tidak bisa diuji sampai
 * selesai — ia menulis, lalu MENGAMBIL ULANG daftarnya, jadi tanpa
 * penyimpanan di sini lencananya selalu kembali ke nilai lama dan jalur
 * suksesnya tidak pernah benar-benar terlihat. Sisanya tetap baca saja;
 * meniru seluruh API berarti membuat API kedua yang pasti menyimpang. */
function tulis(metode, path, badan) {
  if (path === "/api/v1/admin/publish" && metode === "POST") return { dimulai: true };
  if (path.startsWith("/api/v1/admin/")) capBerubah = new Date().toISOString();
  /* Proyek baru dan ubah proyek — sebelumnya jatuh ke balasan umum, jadi
     form Proyek Baru "berhasil" tanpa proyek apa pun muncul. */
  if (path === "/api/v1/admin/projects" && metode === "POST") {
    const id = `pbaru${proyekAdmin.length + 1}`;
    proyekAdmin.unshift({ id, slug: badan.slug, title: badan.title, category: badan.category ?? "residential",
      status: "draft", isFeatured: false, contractValue: null, paidTotal: 0, pipelineStage: "proposal", phase: null });
    return { id };
  }
  {
    const up = path.match(/^\/api\/v1\/admin\/projects\/([^/?]+)$/);
    if (up && metode === "PATCH") {
      const x = proyekAdmin.find((y) => y.id === up[1]);
      if (!x) return { galat: 404 };
      Object.assign(x, badan);
      return { updated: true };
    }
  }
  /* Catat Pengeluaran — bentuk badan dan galatnya sama dengan costs.create. */
  if (path === "/api/v1/admin/costs" && metode === "POST") {
    if (!badan.label || String(badan.label).trim().length < 2 || !(badan.amount > 0)) return { galat: 422 };
    const id = `bn${Date.now()}`;
    const orang = timAdmin.find((t) => t.id === badan.teamMemberId);
    biayaKeu.unshift({ id, projectId: badan.projectId, projectTitle: proyekAdmin.find((p) => p.id === badan.projectId)?.title,
      label: String(badan.label).trim(), category: badan.category ?? "lainnya", amount: badan.amount,
      incurredOn: badan.incurredOn || new Date().toISOString().slice(0, 10),
      teamMemberId: orang?.id ?? null, teamMemberName: orang?.name ?? null });
    return { id };
  }
  if (path === "/api/v1/admin/ledger" && metode === "POST") {
    if (!badan.label || !(badan.amount > 0)) return { galat: 422 };
    const id = `kas${Date.now()}`;
    kasAdmin.unshift({ id, direction: badan.direction, category: badan.category ?? "lainnya", label: badan.label,
      counterparty: badan.counterparty ?? null, amount: badan.amount, occurredOn: badan.occurredOn || kasHariLalu(0),
      projectId: badan.projectId ?? null, projectTitle: proyekAdmin.find((p) => p.id === badan.projectId)?.title ?? null,
      note: badan.note ?? null });
    return { id };
  }
  {
    const lk = path.match(/^\/api\/v1\/admin\/ledger\/([^/?]+)$/);
    if (lk) {
      const i = kasAdmin.findIndex((k) => k.id === lk[1]);
      if (i < 0) return { galat: 404 };
      if (metode === "DELETE") { kasAdmin.splice(i, 1); return { deleted: true }; }
      if (metode === "PATCH") {
        Object.assign(kasAdmin[i], badan);
        if ("projectId" in badan) kasAdmin[i].projectTitle = proyekAdmin.find((p) => p.id === badan.projectId)?.title ?? null;
        return { updated: true };
      }
    }
  }
  if (path === "/api/v1/admin/targets" && metode === "PUT") {
    if (!/^\d{4}-(01|07)-01$/.test(badan.semesterStart ?? "") || !(badan.amount > 0)) return { galat: 422 };
    const t = targetAdmin.find((x) => x.semesterStart === badan.semesterStart);
    if (t) Object.assign(t, { amount: badan.amount, note: badan.note ?? null });
    else targetAdmin.push({ semesterStart: badan.semesterStart, amount: badan.amount, note: badan.note ?? null });
    return { saved: true };
  }
  if (path === "/api/v1/admin/fee-rules" && metode === "PATCH") {
    for (const [k, v] of Object.entries(badan)) if (k in aturanFee) aturanFee[k] = v;
    Object.assign(aturanFeeKop, { diubahPada: new Date().toISOString(), diubahOleh: "Dirga Pahlevi" });
    return aturanFee;
  }
  {
    const tb = path.match(/^\/api\/v1\/admin\/projects\/([^/?]+)\/team$/);
    if (tb && metode === "POST") {
      if (timProyek.some((a) => a.projectId === tb[1] && a.role === badan.role && a.teamMemberId === badan.teamMemberId)) {
        return { galat: 422 };
      }
      const id = `pt${Date.now()}`;
      timProyek.push({ id, projectId: tb[1], teamMemberId: badan.teamMemberId, role: badan.role,
        pct: "pct" in badan ? badan.pct : pctPeran(badan.role), note: badan.note ?? null });
      return { id };
    }
    const tu = path.match(/^\/api\/v1\/admin\/project-team\/([^/?]+)$/);
    if (tu) {
      const i = timProyek.findIndex((a) => a.id === tu[1]);
      if (i < 0) return { galat: 404 };
      if (metode === "DELETE") {
        if ([...biayaKeu, ...biayaRiwayat].some((b) => b.projectTeamId === tu[1])) return { galat: 409 };
        timProyek.splice(i, 1);
        return { deleted: true };
      }
      Object.assign(timProyek[i], badan);
      return { updated: true };
    }
    if (path === "/api/v1/admin/team-payouts" && metode === "POST") {
      const a = timProyek.find((x) => x.id === badan.projectTeamId);
      if (!a) return { galat: 404 };
      const h = hitungTim(a);
      const t = h.tahap.find((x) => x.tahap === badan.tahap);
      if (t?.keadaan === "dibayar") return { galat: 409 };
      const amount = badan.amount ?? t?.nominal;
      if (!amount) return { galat: 422 };
      const id = `byr${Date.now()}`;
      biayaRiwayat.unshift({ id, projectId: a.projectId, projectTitle: h.projectTitle,
        label: `${a.role[0].toUpperCase()}${a.role.slice(1)} ${h.projectTitle} — tahap ${badan.tahap === "awal" ? "awal (DP masuk)" : "akhir (desain selesai)"}`,
        category: h.teamMemberKind === "partner" ? "prinsipal" : "freelancer", amount,
        incurredOn: badan.paidOn || new Date().toISOString().slice(0, 10),
        teamMemberId: a.teamMemberId, teamMemberName: h.teamMemberName, projectTeamId: a.id, payoutStage: badan.tahap });
      return { id };
    }
  }
  /* Tugas, tim, direktori, testimoni — halaman Tugas & daftar menulis lalu
     mengambil ulang, jadi tanpa penyimpanan di sini jalur suksesnya tidak
     pernah benar-benar terlihat. */
  {
    const tb = path.match(/^\/api\/v1\/admin\/projects\/([^/?]+)\/tasks$/);
    if (tb && metode === "POST") {
      const p = proyekAdmin.find((x) => x.id === tb[1]);
      const orang = timAdmin.find((t) => t.id === badan.assigneeId);
      const id = `${tb[1]}-tugas-baru-${Date.now()}`;
      (tugasAdmin[tb[1]] ??= []).push({ id, projectId: tb[1], projectTitle: p?.title, title: badan.title,
        stage: badan.stage ?? null, assigneeId: badan.assigneeId ?? null, assigneeName: orang?.name ?? null,
        status: "belum_mulai", dueDate: badan.dueDate ?? null, sortOrder: 99 });
      return { id };
    }
    const tu = path.match(/^\/api\/v1\/admin\/tasks\/([^/?]+)$/);
    if (tu) {
      for (const daftar of Object.values(tugasAdmin)) {
        const i = daftar.findIndex((t) => t.id === tu[1]);
        if (i < 0) continue;
        if (metode === "DELETE") { daftar.splice(i, 1); return { deleted: true }; }
        Object.assign(daftar[i], badan);
        return { updated: true };
      }
      return { galat: 404 };
    }
    const sumber = [["team", timAdmin, "t"], ["directory", kontakAdmin, "kt"], ["testimonials", testimoniAdmin, "ts"]];
    for (const [nama, daftar, awalan] of sumber) {
      const m = path.match(new RegExp(`^/api/v1/admin/${nama}(?:/([^/?]+))?$`));
      if (!m) continue;
      if (!m[1] && metode === "POST") {
        const id = `${awalan}${daftar.length + 100}`;
        const kini = new Date().toISOString();
        daftar.push({ id, active: true, createdAt: kini, updatedAt: kini, ...badan });
        return { id };
      }
      const i = daftar.findIndex((x) => x.id === m[1]);
      if (i < 0) return { galat: 404 };
      if (metode === "DELETE") { daftar.splice(i, 1); return { deleted: true }; }
      Object.assign(daftar[i], badan, { updatedAt: new Date().toISOString() });
      return { updated: true };
    }
  }
  /* Pembayaran baru — dibalas BARIS UTUH beserta receiptToken, sama dengan
     `returning … receipt_token` di paymentsRepo.create: panel membuka dialog
     bukti dari balasan ini. paidTotal proyeknya ikut naik. */
  {
    const pb = path.match(/^\/api\/v1\/admin\/projects\/([^/?]+)\/payments$/);
    if (pb && metode === "POST") {
      const baris = { id: `${pb[1]}-bayar-baru-${Date.now()}`, projectId: pb[1], amount: badan.amount,
        kind: badan.kind ?? "termin", method: badan.method ?? "transfer", receiver: badan.receiver ?? null,
        note: badan.note ?? null, paidAt: new Date().toISOString(),
        receiptToken: [...Array(40)].map(() => "0123456789abcdef"[Math.floor(Math.random() * 16)]).join("") };
      (bayarAdmin[pb[1]] ??= []).unshift(baris);
      const p = proyekAdmin.find((x) => x.id === pb[1]);
      if (p) p.paidTotal = (p.paidTotal ?? 0) + badan.amount;
      return baris;
    }
  }
  /* Termin baru, hapus termin, hapus biaya — dibalas seperti Worker API. */
  {
    const tb = path.match(/^\/api\/v1\/admin\/projects\/([^/?]+)\/invoices$/);
    if (tb && metode === "POST") {
      if (!badan.label || String(badan.label).trim().length < 2) return { galat: 422 };
      const p = proyekAdmin.find((x) => x.id === tb[1]);
      const id = `inv-baru-${Date.now()}`;
      tagihanAdmin.push({ id, projectId: tb[1], projectTitle: p?.title, label: badan.label, amount: badan.amount,
        status: "draft", dueDate: badan.dueDate ?? null, paidAt: null, sortOrder: badan.sortOrder ?? 0 });
      return { id };
    }
    const th = path.match(/^\/api\/v1\/admin\/invoices\/([^/?]+)$/);
    if (th && metode === "DELETE") {
      const i = tagihanAdmin.findIndex((x) => x.id === th[1]);
      if (i < 0) return { galat: 404 };
      tagihanAdmin.splice(i, 1);
      return { deleted: true };
    }
    /* Hapus proyek — sebelumnya jatuh ke balasan umum "ok" tanpa menghapus
       apa pun, jadi Semua Proyek tetap menampilkan proyek yang "dihapus". */
    const hp = path.match(/^\/api\/v1\/admin\/projects\/([^/?]+)$/);
    if (hp && metode === "DELETE") {
      const i = proyekAdmin.findIndex((x) => x.id === hp[1]);
      if (i < 0) return { galat: 404 };
      proyekAdmin.splice(i, 1);
      return { deleted: true };
    }
    const bh = path.match(/^\/api\/v1\/admin\/costs\/([^/?]+)$/);
    if (bh && metode === "DELETE") {
      for (const d of [biayaKeu, biayaRiwayat]) {
        const i = d.findIndex((x) => x.id === bh[1]);
        if (i >= 0) { d.splice(i, 1); return { deleted: true }; }
      }
      return { galat: 404 };
    }
  }
  /* Situs Publik & Pengaturan. Kunci R2 yang dikirim diterjemahkan ke URL
     seperti di Worker, jadi pratinjau sesudah Simpan menggambar berkasnya. */
  if (path === "/api/v1/admin/settings" && metode === "PATCH") {
    for (const [k, v] of Object.entries(badan)) {
      const url = { logoKey: "logoUrl", beforeKey: "beforeUrl", afterKey: "afterUrl" }[k];
      if (url) setelan[url] = urlMedia(v);
      else setelan[k] = v;
    }
    return { updated: true };
  }
  if (path === "/api/v1/admin/account/password" && metode === "PATCH") {
    // Aturan yang sama dengan lib/gotrue.ts — sandi lama tiruan: Lama-Sandi-2026.
    const b = String(badan.newPassword ?? "");
    const kurang = [[b.length >= 12, "minimal 12 karakter"], [/[A-Z]/.test(b), "huruf besar"], [/[a-z]/.test(b), "huruf kecil"],
      [/\d/.test(b), "angka"], [/[^A-Za-z0-9]/.test(b), "simbol"]].filter(([ok]) => !ok).map(([, l]) => l);
    if (kurang.length) return { galat: 422, pesan: `kata sandi belum memenuhi: ${kurang.join(", ")}` };
    if (badan.currentPassword !== SANDI_TIRUAN) return { galat: 422, pesan: "kata sandi saat ini salah" };
    if (b === SANDI_TIRUAN) return { galat: 422, pesan: "kata sandi baru sama dengan yang sekarang" };
    sesiLain = []; sesiTanpaNama = 0;
    return { updated: true, lainKeluar: true };
  }
  if (path === "/api/v1/admin/account/profile" && metode === "PATCH") {
    // Aturan yang sama dengan rute sungguhan: tiap kolom hanya ditulis kalau dikirim.
    if ("avatarKey" in badan) {
      const k = badan.avatarKey;
      if (k !== null && !/^akun\/[A-Za-z0-9._-]+$/.test(String(k))) return { galat: 422, pesan: "kunci foto harus berkas di folder akun/" };
      profil.avatarUrl = urlMedia(k);
    }
    if ("nama" in badan) {
      const nama = String(badan.nama ?? "").replace(/\s+/g, " ").trim();
      if (nama.length > 60) return { galat: 422, pesan: "nama maksimal 60 karakter" };
      profil.nama = nama || null;
    }
    return { nama: profil.nama, avatarUrl: profil.avatarUrl };
  }
  if (path === "/api/v1/admin/account/logout" && metode === "POST") {
    if (badan.scope === "others") { sesiLain = []; sesiTanpaNama = 0; }
    return { scope: badan.scope };
  }
  {
    const kl = path.match(/^\/api\/v1\/admin\/clients(?:\/([^/?]+))?$/);
    if (kl && !kl[1] && metode === "POST") {
      const id = `kl${Date.now()}`;
      klienAdmin.push({ id, name: badan.name, logoKey: badan.logoKey ?? null, sortOrder: badan.sortOrder ?? 99 });
      return { id };
    }
    if (kl && kl[1]) {
      const i = klienAdmin.findIndex((x) => x.id === kl[1]);
      if (i < 0) return { galat: 404 };
      if (metode === "DELETE") { klienAdmin.splice(i, 1); return { deleted: true }; }
      Object.assign(klienAdmin[i], badan);
      return { updated: true };
    }
    const os = path.match(/^\/api\/v1\/admin\/studio-team(?:\/([^/?]+))?$/);
    if (os && !os[1] && metode === "POST") {
      const id = `os${Date.now()}`;
      orangStudio.push({ id, name: null, bio: null, photoUrl: null, slotLabel: "", sortOrder: 99, ...badan });
      return { id };
    }
    if (os && os[1]) {
      const i = orangStudio.findIndex((x) => x.id === os[1]);
      if (i < 0) return { galat: 404 };
      if (metode === "DELETE") { orangStudio.splice(i, 1); return { deleted: true }; }
      const { photoKey, ...sisa } = badan;
      Object.assign(orangStudio[i], sisa);
      if ("photoKey" in badan) orangStudio[i].photoUrl = urlMedia(photoKey);
      orangStudio.sort((a, b) => a.sortOrder - b.sortOrder);
      return { updated: true };
    }
  }
  if (path === "/api/v1/admin/payroll" && metode === "POST") {
    const awal = `${String(badan.period).slice(0, 7)}-01`;
    if (gajiAdmin.some((g) => g.teamMemberId === badan.teamMemberId && g.period === awal)) return { galat: 409 };
    const id = `g-baru-${gajiAdmin.length}`;
    gajiAdmin.push({ id, teamMemberId: badan.teamMemberId,
      teamMemberName: timAdmin.find((t) => t.id === badan.teamMemberId)?.name ?? "?",
      period: awal, amount: badan.amount, paidOn: badan.paidOn ?? null, note: badan.note ?? null });
    return { id };
  }
  {
    const gp = path.match(/^\/api\/v1\/admin\/payroll\/([^/?]+)$/);
    if (gp && metode === "PATCH") {
      const g = gajiAdmin.find((x) => x.id === gp[1]);
      if (!g) return { galat: 404 };
      Object.assign(g, badan);
      return { updated: true };
    }
    if (gp && metode === "DELETE") {
      const i = gajiAdmin.findIndex((x) => x.id === gp[1]);
      if (i < 0) return { galat: 404 };
      gajiAdmin.splice(i, 1);
      return { deleted: true };
    }
  }
  const m = path.match(/^\/api\/v1\/admin\/invoices\/([^/?]+)$/);
  if (m && metode === "PATCH") {
    const t = tagihanAdmin.find((x) => x.id === m[1]);
    if (!t) return { galat: 404 };
    /* Sama dengan invoicesRepo.update: hanya kolom yang dikirim, dan paid_at
       mengikuti status — diisi saat lunas, dikosongkan saat ditarik mundur. */
    if (badan.label !== undefined) t.label = badan.label;
    if (badan.amount !== undefined) t.amount = badan.amount;
    if (badan.dueDate !== undefined) t.dueDate = badan.dueDate;
    if (badan.status) {
      t.status = badan.status;
      t.paidAt = badan.status === "lunas" ? (t.paidAt ?? new Date().toISOString()) : null;
    }
    return { updated: true };
  }
  const tp = path.match(/^\/api\/v1\/admin\/tiers(?:\/([^/?]+))?$/);
  if (tp && metode === "POST" && !tp[1]) {
    const id = `t0000000-0000-4000-8000-0000000000${String(paketAdmin.length + 10).padStart(2, "0")}`;
    paketAdmin.push({ id, summary: "", forWhom: "", includesHeading: "Yang Anda dapat", includes: [],
      highlighted: false, active: true, sortOrder: 0, ...badan, updatedAt: new Date().toISOString() });
    return { id };
  }
  if (tp && tp[1] && metode === "PATCH") {
    const x = paketAdmin.find((y) => y.id === tp[1]);
    if (!x) return { galat: 404 };
    Object.assign(x, badan, { updatedAt: new Date().toISOString() });
    return { updated: true };
  }
  if (tp && tp[1] && metode === "DELETE") {
    const i = paketAdmin.findIndex((y) => y.id === tp[1]);
    if (i < 0) return { galat: 404 };
    paketAdmin.splice(i, 1);
    return { deleted: true };
  }
  {
    const b = path.match(/^\/api\/v1\/admin\/projects\/([^/?]+)\/brief$/);
    if (b && metode === "PATCH") { Object.assign(briefAdmin[b[1]] ??= {}, badan); return { updated: true }; }
    const pr = path.match(/^\/api\/v1\/admin\/projects\/([^/?]+)\/progress(\/token|\/updates)?$/);
    if (pr) {
      const x = progresAdmin[pr[1]];
      if (!x) return { galat: 404 };
      if (!pr[2] && metode === "PATCH") { x.phase = badan.phase; return { updated: true }; }
      if (pr[2] === "/token") { x.accessToken = Array.from({ length: 40 }, () => "0123456789abcdef"[Math.floor(Math.random() * 16)]).join(""); return { accessToken: x.accessToken }; }
      if (pr[2] === "/updates" && metode === "POST") {
        const id = `${pr[1]}-up-${Date.now()}`;
        x.updates.unshift({ id, title: badan.title, note: badan.note, photoUrl: null, createdAt: new Date().toISOString() });
        return { id };
      }
    }
    const pu = path.match(/^\/api\/v1\/admin\/progress-updates\/([^/?]+)$/);
    if (pu && metode === "DELETE") {
      for (const x of Object.values(progresAdmin)) x.updates = x.updates.filter((u) => u.id !== pu[1]);
      return { deleted: true };
    }
    const dp = path.match(/^\/api\/v1\/admin\/projects\/([^/?]+)\/documents$/);
    if (dp && metode === "POST") {
      const daftar = (dokumenAdmin[dp[1]] ??= []);
      const id = `${dp[1]}-dok-baru-${daftar.length + 1}`;
      const kini = new Date().toISOString();
      daftar.unshift({ id, projectId: dp[1], status: "draft", clientNote: null, sortOrder: daftar.length,
        fileUrl: `http://127.0.0.1:${PORT}/media/${badan.fileKey}`, createdAt: kini, updatedAt: kini, ...badan });
      return { id };
    }
    const dk = path.match(/^\/api\/v1\/admin\/documents\/([^/?]+)(\/comments)?$/);
    if (dk && dk[2] && metode === "POST") {
      (komentarAdmin[dk[1]] ??= []).push({ id: `c${Date.now()}`, documentId: dk[1], author: "staf", body: badan.body, createdAt: new Date().toISOString() });
      return { id: "c" };
    }
    if (dk && !dk[2]) {
      for (const [pid, daftar] of Object.entries(dokumenAdmin)) {
        const i = daftar.findIndex((d) => d.id === dk[1]);
        if (i < 0) continue;
        if (metode === "DELETE") { daftar.splice(i, 1); return { deleted: true }; }
        Object.assign(daftar[i], badan);
        return { updated: true, pid };
      }
      return { galat: 404 };
    }
  }
  const gi = path.match(/^\/api\/v1\/admin\/projects\/([^/?]+)\/images$/);
  if (gi && metode === "POST") {
    const kind = badan.kind ?? "galeri";
    const daftar = (gambarAdmin[gi[1]] ??= { galeri: [], material: [] })[kind];
    const id = `${gi[1]}-${kind}-baru-${daftar.length + 1}`;
    daftar.push({ id, storageKey: badan.storageKey, url: `http://127.0.0.1:${PORT}/media/${badan.storageKey}`,
      thumbUrl: null, caption: null, altText: null, sortOrder: badan.sortOrder ?? daftar.length });
    return { id };
  }
  const ig = path.match(/^\/api\/v1\/admin\/images\/([^/?]+)$/);
  if (ig) {
    for (const per of Object.values(gambarAdmin)) {
      for (const kind of ["galeri", "material"]) {
        const i = per[kind].findIndex((x) => x.id === ig[1]);
        if (i < 0) continue;
        if (metode === "DELETE") { per[kind].splice(i, 1); return { deleted: true }; }
        Object.assign(per[kind][i], badan);
        per[kind].sort((a, b) => a.sortOrder - b.sortOrder);
        return { updated: true };
      }
    }
    return { galat: 404 };
  }
  /* Unggah tiruan: URL "presigned" menunjuk server ini sendiri, dan PUT ke
     sana diterima begitu saja. Kuncinya menunjuk salah satu sampul contoh
     supaya gambar hasil unggahan tetap tergambar. */
  if (path === "/api/v1/admin/uploads" && metode === "POST") {
    if (badan.scope === "akun") {
      const ext = { "image/webp": "webp", "image/jpeg": "jpg", "image/png": "png" }[badan.contentType];
      if (!ext) return { galat: 422, pesan: `tipe file "${badan.contentType}" tidak diizinkan` };
      const key = `akun/uji-${++nomorUnggah}.${ext}`;
      return { key, uploadUrl: `http://127.0.0.1:${PORT}/unggah?key=${encodeURIComponent(key)}`, expiresAt: new Date(Date.now() + 6e5).toISOString() };
    }
    const kunci = { jurnal: "jurnal/contoh-3.svg", klien: "klien/logo-2.svg", logo: "studio/logo-2.svg", studio: "studio/contoh-4.svg" };
    return { key: kunci[badan.scope] ?? "projects/uji/contoh-3.svg",
      uploadUrl: `http://127.0.0.1:${PORT}/unggah`, expiresAt: new Date(Date.now() + 6e5).toISOString() };
  }
  if (path === "/unggah" && metode === "PUT") return { ok: true };
  const jp = path.match(/^\/api\/v1\/admin\/journal(?:\/([^/?]+))?$/);
  if (jp && metode === "POST" && !jp[1]) {
    const id = `j0000000-0000-4000-8000-0000000000${String(jurnalAdmin.length + 10).padStart(2, "0")}`;
    const kini = new Date().toISOString();
    jurnalAdmin.push({ id, body: null, publishedAt: null, coverKey: null, coverUrl: null, readMinutes: 5, category: "site",
      ...badan, createdAt: kini, updatedAt: kini });
    return { id };
  }
  if (jp && jp[1] && metode === "PATCH") {
    const x = jurnalAdmin.find((y) => y.id === jp[1]);
    if (!x) return { galat: 404 };
    Object.assign(x, badan, { updatedAt: new Date().toISOString() });
    if ("coverKey" in badan) x.coverUrl = badan.coverKey ? `http://127.0.0.1:${PORT}/media/${badan.coverKey}` : null;
    return { updated: true };
  }
  if (jp && jp[1] && metode === "DELETE") {
    const i = jurnalAdmin.findIndex((y) => y.id === jp[1]);
    if (i < 0) return { galat: 404 };
    jurnalAdmin.splice(i, 1);
    return { deleted: true };
  }
  const q = path.match(/^\/api\/v1\/admin\/inquiries\/([^/?]+)$/);
  if (q && metode === "PATCH") {
    const x = pesanAdmin.find((y) => y.id === q[1]);
    if (!x) return { galat: 404 };
    if (badan.status) x.status = badan.status;
    return { updated: true };
  }
  return null;
}

createServer((req, res) => {
  const path = (req.url || "/").split("#")[0];
  const metode = (req.method || "GET").toUpperCase();
  const kepala = {
    "content-type": "application/json",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "access-control-allow-headers": "content-type,authorization",
  };
  if (metode === "OPTIONS") {
    res.writeHead(204, kepala);
    return res.end();
  }
  if (metode === "PUT" && path.startsWith("/unggah")) {
    const key = new URL(path, "http://x").searchParams.get("key");
    const potong = [];
    req.on("data", (c) => potong.push(c));
    return req.on("end", () => {
      if (key) unggahan.set(key, { tipe: req.headers["content-type"] || "application/octet-stream", isi: Buffer.concat(potong) });
      res.writeHead(200, { "access-control-allow-origin": "*" });
      res.end();
    });
  }
  if (metode !== "GET") {
    let mentah = "";
    req.on("data", (c) => (mentah += c));
    return req.on("end", () => {
      let badan = {};
      try { badan = JSON.parse(mentah || "{}"); } catch { /* biarkan kosong */ }
      const hasil = tulis(metode, path, badan);
      if (hasil && hasil.galat) {
        res.writeHead(hasil.galat, kepala);
        return res.end(JSON.stringify({ error: { status: hasil.galat, message: hasil.pesan ?? "tidak ada" } }));
      }
      res.writeHead(hasil ? 200 : 201, kepala);
      res.end(JSON.stringify({ data: hasil ?? { id: "baru" } }));
    });
  }
  {
    const u = path.startsWith("/media/") && unggahan.get(decodeURIComponent(path.slice(7)));
    if (u) {
      res.writeHead(200, { "content-type": u.tipe, "access-control-allow-origin": "*" });
      return res.end(u.isi);
    }
  }
  {
    const m = path.match(/^\/media\/.*contoh-(\d+)\.svg$/);
    if (m) {
      res.writeHead(200, { "content-type": "image/svg+xml", "access-control-allow-origin": "*" });
      return res.end(sampulSvg(Number(m[1])));
    }
    /* Logo tiruan: lebar (4:1), persegi, dan tinggi (2:3). */
    const lg = path.match(/^\/media\/.*logo-(\d+)\.svg$/);
    if (lg) {
      const [w, h, teks] = [[400, 100, "RUAS"], [200, 200, "BH"], [160, 240, "GK"]][(Number(lg[1]) - 1) % 3];
      res.writeHead(200, { "content-type": "image/svg+xml", "access-control-allow-origin": "*" });
      return res.end(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">` +
        `<rect width="${w}" height="${h}" rx="12" fill="#C2410C"/><text x="50%" y="58%" text-anchor="middle" ` +
        `font-family="sans-serif" font-weight="700" font-size="${h * 0.4}" fill="#fff">${teks}</text></svg>`);
    }
  }
  res.writeHead(200, kepala);
  res.end(JSON.stringify({ data: jawab(path) }));
}).listen(PORT, () => console.log(`api tiruan: http://127.0.0.1:${PORT}`));
