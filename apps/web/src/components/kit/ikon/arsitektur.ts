import type { DataIkon } from "./daftar";

/* =============================================================================
   IKON ARSITEKTUR — buatan sendiri untuk rel samping dan palet perintah.

   Permintaan pemilik: ikon sidebar "harus di-custom menyesuaikan
   architecture". Bukan jiplakan pustaka mana pun: tiap ikon digambar dari
   BENDA yang memang dipakai kantor arsitek untuk pekerjaan di labelnya —
   lembar berkop untuk Dashboard, peil untuk KPI, kurva S untuk Keuangan,
   skala manusia untuk Tim, awan revisi untuk Testimoni, simbol pintu denah
   untuk Keluar, mal gambar untuk UI Component.

   Bahasa garisnya bahasa gambar kerja: DUA ketebalan pena — garis potong
   1,6 (bentuk utama) dan garis tampak 1,1 (rincian) — ujung bulat seperti
   pena rapido, tanpa bidang isi kecuali satu-satunya yang memang pejal di
   gambar sungguhan (separuh panah utara, separuh segitiga peil).

   Tiap garis membawa `pathLength="1"`, jadi CSS bisa MENGGAMBARNYA seperti
   pena (stroke-dashoffset 1 → 0) tanpa tahu panjang aslinya. Bidang isi
   berkelas `isi` dan muncul sesudah garisnya selesai.

   Semua bentuk ditulis sebagai <path> — lingkaran dan kotak lewat pembantu
   di bawah — supaya satu selektor animasi berlaku untuk semuanya.
   ============================================================================= */

const T = (d: string) => `<path d="${d}" stroke-width="1.6" pathLength="1"/>`;
const H = (d: string) => `<path d="${d}" stroke-width="1.1" pathLength="1"/>`;
const F = (d: string) => `<path class="isi" d="${d}" fill="currentColor" stroke="none"/>`;
const ling = (cx: number, cy: number, r: number) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${r * 2} 0a${r} ${r} 0 1 0 ${-r * 2} 0`;
const kotak = (x: number, y: number, w: number, h: number, r = 0) =>
  r
    ? `M${x + r} ${y}h${w - 2 * r}a${r} ${r} 0 0 1 ${r} ${r}v${h - 2 * r}a${r} ${r} 0 0 1 ${-r} ${r}h${-(w - 2 * r)}a${r} ${r} 0 0 1 ${-r} ${-r}v${-(h - 2 * r)}a${r} ${r} 0 0 1 ${r} ${-r}z`
    : `M${x} ${y}h${w}v${h}h${-w}z`;
const ikon = (...isi: string[]): DataIkon => ({
  vb: "0 0 24 24",
  isi: `<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">${isi.join("")}</g>`,
});

/* --- Menu utama --------------------------------------------------------- */

/** Dashboard — lembar gambar berkop: bingkai, kotak judul di pojok, denah kecil. */
export const ArsLembar = ikon(
  T(kotak(3.5, 4, 17, 16, 1)),
  H("M13 15.5h7.5M13 15.5V20"),
  H("M15 17.8h3.5"),
  H(kotak(6.5, 7, 5, 5.5)),
  H("M9 7v2.2M6.5 9.8h1.6"),
);

/** KPI Strategi — peil target di atas tiga batang yang naik. */
export const ArsPeil = ikon(
  T("M3 20h18"),
  H(kotak(5, 15, 2.6, 5)),
  H(kotak(10.7, 11.5, 2.6, 8.5)),
  T(kotak(16.4, 8, 2.6, 12)),
  H("M3.5 5.5h9"),
  T("M8 1.8h4.4l-2.2 3.7z"),
  F("M10.2 1.8h2.2l-2.2 3.7z"),
);

/** Tugas — daftar periksa lapangan di papan jepit. */
export const ArsDaftarPeriksa = ikon(
  T(kotak(4.5, 4.5, 15, 16, 1.5)),
  T(kotak(9, 3, 6, 3, 1)),
  H("M7.5 10.5l1.3 1.3 2.2-2.4"),
  H("M7.5 15.5l1.3 1.3 2.2-2.4"),
  H("M13 11h3.5M13 16h3.5"),
);

/** Pesan Masuk — surat pengantar dengan gulungan gambar yang menyembul. */
export const ArsSuratPengantar = ikon(
  T("M6 8.5h-1.5a1 1 0 0 0-1 1V19a1 1 0 0 0 1 1h15a1 1 0 0 0 1-1V9.5a1 1 0 0 0-1-1H18"),
  H("M3.8 9.3l8.2 5.6 8.2-5.6"),
  T("M8 11.5V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v6.5"),
  H("M10.5 6h3"),
);

/** Panduan — panah utara: orientasi. */
export const ArsArahUtara = ikon(
  H(ling(12, 12.5, 8)),
  T("M12 4.5l3.5 11.5-3.5-2.6-3.5 2.6z"),
  F("M12 4.5v8.9l3.5 2.6z"),
  H("M12 1.6v2"),
);

/** Proyek — tampak bangunan bergaris tanah. */
export const ArsTampakRumah = ikon(
  T("M2.5 20h19"),
  T("M5 20v-8.5L12 5l7 6.5V20"),
  H("M10.3 20v-5h3.4v5"),
  H(kotak(6.8, 12.6, 2.4, 2.4)),
  H(kotak(14.8, 12.6, 2.4, 2.4)),
  H("M15.5 7.8V5.2h2v4.4"),
);

/** Keuangan — kurva S rencana proyek. */
export const ArsKurvaS = ikon(
  T("M4 3.5V20h16.5"),
  T("M5 19c6.5 0 5.5-13 13.5-13"),
  H("M8.5 20v1.6M13 20v1.6M17.5 20v1.6"),
  F(ling(18.6, 6, 1.3)),
);

/** Direktori — kartu indeks bertab. */
export const ArsKartuIndeks = ikon(
  T("M3.5 8h17v11.5h-17z"),
  T("M3.5 8V6a1 1 0 0 1 1-1h4.6l1.6 3"),
  H(ling(7.8, 12.2, 1.6)),
  H("M5.4 17c.5-1.5 1.3-2.2 2.4-2.2s1.9.7 2.4 2.2"),
  H("M12.5 12h5.5M12.5 15h4"),
);

/** Tim & Freelancer — dua figur skala, seperti di gambar potongan. */
export const ArsSkalaManusia = ikon(
  T(ling(8.5, 5.5, 1.8)),
  T("M6 20.5v-8a2.5 2.5 0 0 1 5 0v8"),
  T(ling(15.8, 7.3, 1.6)),
  T("M13.6 20.5v-6.6a2.2 2.2 0 0 1 4.4 0v6.6"),
  H("M3 20.5h18"),
);

/** Testimoni — awan revisi bertanda kutip: masukan klien. */
export const ArsAwanRevisi = ikon(
  T("M5 8a2 2 0 0 1 3.5 0a2 2 0 0 1 3.5 0a2 2 0 0 1 3.5 0a2 2 0 0 1 3.5 0a2 2 0 0 1 0 3.5a2 2 0 0 1 0 3.5a2 2 0 0 1-3.5 0a2 2 0 0 1-3.5 0a2 2 0 0 1-3.5 0a2 2 0 0 1-3.5 0a2 2 0 0 1 0-3.5a2 2 0 0 1 0-3.5z"),
  H("M6.5 16.6L5 20.5l4-2.4"),
  H("M9.6 10.4v1.6l-.7 1M13.4 10.4v1.6l-.7 1"),
);

/** Jurnal — buku sketsa berspiral dan pensil. */
export const ArsBukuSketsa = ikon(
  T(kotak(3.5, 5, 12.5, 15.5, 1)),
  H("M6.5 3.5v3M9.7 3.5v3M12.9 3.5v3"),
  H("M6.3 16l3.2-3.4 3.2 3.4"),
  T("M18.4 7.6l2 2-6.8 6.8-2.6.6.6-2.6z"),
);

/** Situs Publik — tampak muka bangunan di dalam jendela peramban. */
export const ArsFasad = ikon(
  T(kotak(3, 4, 18, 16, 1.5)),
  H("M3 7.8h18"),
  H("M5.5 5.9h3"),
  H("M7 18v-7.2h10V18"),
  H("M9.5 10.8V18M12 10.8V18M14.5 10.8V18M7 14.4h10"),
);

/** Info Studio — meja gambar miring dengan lampu. */
export const ArsMejaGambar = ikon(
  T("M3.5 14l15.5-4v2.6L3.5 16.6z"),
  T("M7 15.6v4.9M16 13.3v7.2"),
  H("M5 20.5h4M14 20.5h4"),
  H("M5.8 14.3l10.4-2.7"),
  H("M19 10V5.2l-3.2-1.4"),
  T("M13.4 5.6l1.7-2.9 2.4 1.9z"),
);

/** Aturan Fee Tim — jangka: membagi proporsi. */
export const ArsJangka = ikon(
  T(ling(12, 4.6, 1.5)),
  T("M12 3.1V1.6"),
  T("M11.3 6L6.4 20.5M12.7 6l4.9 14.5"),
  H("M7.6 16.6a9.5 9.5 0 0 0 8.8 0"),
  H("M12 17.6v1.6"),
);

/** Akun — figur skala di dalam gelembung bertakik, seperti titik ukur. */
export const ArsAkun = ikon(
  T(ling(12, 12, 8.3)),
  H(ling(12, 9.6, 2.3)),
  H("M7.8 17.4c.8-2.3 2.4-3.5 4.2-3.5s3.4 1.2 4.2 3.5"),
  H("M12 1.8v1.7M12 20.5v1.7M1.8 12h1.7M20.5 12h1.7"),
);

/** UI Component — mal gambar (stensil) berlubang lingkaran, kotak, segitiga. */
export const ArsMal = ikon(
  T(kotak(2.5, 5, 19, 14, 2)),
  H(ling(7.8, 10, 2.3)),
  H(kotak(12.6, 7.8, 4.4, 4.4)),
  H("M5.6 16.6l2.2-3.4 2.2 3.4z"),
  H(ling(14, 15.2, 1)),
  H(ling(17.6, 15.2, 1.4)),
);

/** Keluar — simbol pintu denah: daun pintu, busur ayun, panah keluar.
    Daun pintunya berkelas `daun` supaya bisa diayun saat disentuh. */
export const ArsPintu = ikon(
  T("M2.5 20.5h4.5M17 20.5h4.5"),
  T("M7 20.5V10.5").replace("<path", '<path class="daun"'),
  H("M7 10.5a10 10 0 0 1 10 10"),
  T("M13.5 6h7M18.3 3.6L20.7 6l-2.4 2.4"),
);

/* --- Anak submenu (tampil di palet perintah) ---------------------------- */

/** Semua Proyek — ordner berlabel dengan lubang jari. */
export const ArsOrdner = ikon(
  T(kotak(6, 3, 12, 18, 1.2)),
  H(kotak(8.5, 6, 7, 6)),
  H("M10 8h4M10 10h2.5"),
  H(ling(12, 16.5, 1.5)),
);

/** Portal Klien — kunci berkepala rumah. */
export const ArsKunciRumah = ikon(
  T("M4 11.5L8.5 7l4.5 4.5V16H4z"),
  H(ling(8.5, 12.3, 1.3)),
  T("M13 13.5h7.5"),
  H("M17 13.5v2.3M19.5 13.5v1.6"),
);

/** Halaman Publik — bingkai foto berisi siluet bangunan. */
export const ArsBingkaiFoto = ikon(
  T(kotak(3, 4.5, 18, 15, 1.5)),
  H("M5.5 17.5v-5l3.5-3 3.5 3v5"),
  H("M12.5 17.5v-3.5h5v3.5"),
  H("M5 17.5h14"),
  H(ling(16.5, 8.3, 1.3)),
);

/** Ringkasan — lembar rekapitulasi bergaris jumlah ganda. */
export const ArsRekap = ikon(
  T(kotak(5, 3, 14, 18, 1)),
  H("M7.5 7h9M7.5 10h9M7.5 13h9"),
  H("M12.5 6v9"),
  T("M7.5 16.4h9M7.5 18.2h9"),
);

/** Terima Pembayaran — kartu pembayaran dengan panah masuk. */
export const ArsKartuBayar = ikon(
  T(kotak(3, 6, 14, 13, 1.2)),
  H("M5.5 10h9M5.5 13h9M5.5 16h5"),
  T("M21 12.5h-6.5M17 10l-2.5 2.5L17 15"),
);

/** Catat Pengeluaran — nota yang ditusuk paku. */
export const ArsNotaPaku = ikon(
  T("M12 2.5v18"),
  T("M7 21.5h10"),
  T("M6.5 8h11v9h-11z"),
  H("M8.5 11h3M8.5 14h7"),
);

/** Semua Transaksi — kertas berlubang traktor (continuous form). */
export const ArsKertasLubang = ikon(
  T("M6 3h12v18H6z"),
  H("M4 5v.1M4 8.5v.1M4 12v.1M4 15.5v.1M4 19v.1M20 5v.1M20 8.5v.1M20 12v.1M20 15.5v.1M20 19v.1"),
  H("M8.5 7.5h7M8.5 11h7M8.5 14.5h5"),
  H("M6 17.5h12"),
);

/** Kas Studio — mesin kas dengan laci. */
export const ArsMesinKas = ikon(
  T(kotak(4, 9, 16, 8, 1)),
  T("M3 17h18v3.5H3z"),
  H(kotak(6, 4, 8, 3.5)),
  H("M10 7.5V9"),
  H("M7 11.5h2M11 11.5h2M15 11.5h2M7 14h2M11 14h2M15 14h2"),
  H("M10 19h4"),
);

/** Tagihan & Termin — kalender termin berpaku. */
export const ArsTermin = ikon(
  T(kotak(3.5, 5, 17, 15, 1.5)),
  H("M3.5 9.5h17"),
  T("M8 3v4M16 3v4"),
  H(ling(8, 14, 1.2)),
  F(ling(12.5, 14, 1.2)),
  H(ling(17, 14, 1.2)),
);

/** Fee Proyek — kuitansi dengan bonggol berlubang sobekan. */
export const ArsKuitansi = ikon(
  T(kotak(2.5, 6, 19, 12, 1)),
  H("M8 6.5v1M8 9.5v1M8 12.5v1M8 15.5v1"),
  H("M4.5 9.5h1.8M4.5 12.5h1.8"),
  H("M10.5 10h8.5M10.5 13h6"),
  T("M10.5 15.5h4"),
);

/** Gaji — buku besar terbuka bergaris kolom. */
export const ArsBukuGaji = ikon(
  T("M12 6.5C10 5 7 4.5 3 5v14c4-.5 7 0 9 1.5c2-1.5 5-2 9-1.5V5c-4-.5-7 0-9 1.5z"),
  H("M12 6.5V20"),
  H("M5.5 9h4M5.5 12h4M14.5 9h4M14.5 12h4"),
);

/** Bayaran Tim — amplop gaji bersegel. */
export const ArsAmplopGaji = ikon(
  T(kotak(3, 6, 18, 13, 1)),
  H("M3.5 6.8L12 13l8.5-6.2"),
  T(ling(12, 13, 2.4)),
);

/** Paket Layanan — lantai bertingkat: tiga pelat bertumpuk. */
export const ArsLantai = ikon(
  T("M12 3.5l8.5 4L12 11.5 3.5 7.5z"),
  H("M3.5 12L12 16l8.5-4"),
  H("M3.5 16.5L12 20.5l8.5-4"),
);

/** Logo Klien — lencana segi enam. */
export const ArsLencanaKlien = ikon(
  T("M12 2.5l8.2 4.7v9.6L12 21.5l-8.2-4.7V7.2z"),
  H("M8.5 14.5l3.5-6 3.5 6z"),
);

/** Tim Studio — figur skala di dalam bingkai halaman. */
export const ArsTimStudio = ikon(
  T(kotak(3, 4, 18, 16, 1.5)),
  H(ling(9, 9, 1.5)),
  H("M7 17v-4.4a2 2 0 0 1 4 0V17"),
  H(ling(15, 9.6, 1.4)),
  H("M13.2 17v-3.8a1.8 1.8 0 0 1 3.6 0V17"),
);

/** Sebelum & Sesudah — bingkai terbelah: kiri berarsir (sebelum), kanan
    bersih (sesudah), pegangan geser di garis belahnya. */
export const ArsSebelumSesudah = ikon(
  T(kotak(3, 5, 18, 14, 1.5)),
  T("M12 3v18"),
  H("M4.5 10.5l4-4M4.5 15l6-6M6 17.5l4-4"),
  T("M14.5 12h4M17 10l2 2-2 2"),
);

/** Angka di FAQ — garis ukur dengan takik 45°. */
export const ArsGarisUkur = ikon(
  T("M3.5 12h17"),
  H("M3.5 7v10M20.5 7v10"),
  T("M2 13.5l3-3M19 13.5l3-3"),
  H("M9 8.5h6"),
);

/** Halaman Privasi — gembok pintu. */
export const ArsGembok = ikon(
  T(kotak(5, 10.5, 14, 10, 1.5)),
  T("M8 10.5V7.5a4 4 0 0 1 8 0v3"),
  H(ling(12, 14.8, 1.3)),
  H("M12 16.1v2"),
);

/** Identitas Studio — stempel studio. */
export const ArsStempel = ikon(
  T("M9.5 3.5h5v5.5l2.5 2.5H7l2.5-2.5z"),
  T("M5 11.5h14v4H5z"),
  H("M6 19.5h12"),
);

/* --- Kepala halaman ------------------------------------------------------ */

/** Tema terang/gelap — lampu meja gambar berlengan engsel yang dijepit di
    tepi meja. Lengan atas, kap, dan CAHAYANYA satu kelompok `lengan` yang
    berayun di engselnya (9,3 10,4); cahayanya berkelas `cahaya` dan hanya
    menyala di tema gelap — malam, lampu meja dinyalakan. */
export const ArsLampuMeja = ikon(
  T("M2.5 20.5h19"),
  T("M4.2 20.5v-2.4h3.4v2.4"),
  T("M5.9 18.1l3-6.9"),
  H(ling(9.3, 10.4, 0.9)),
  `<g class="lengan">${[
    F("M20.2 8.3L17.6 9.7L13.6 20.5H21.4Z").replace('class="isi"', 'class="isi cahaya"'),
    T("M10 9.9l4.6-3.1"),
    T("M15.6 3.9l4.6 4.4-2.6 1.4-3.2-3z"),
  ].join("")}</g>`,
);

/** Menu geser di ponsel — set gambar: lembar depan berkop di atas dua lembar
    di belakangnya. Yang dibuka memang daftar gambar satu set. */
export const ArsSetGambar = ikon(
  H("M7.5 4.5V3h13v13.5H19"),
  H("M5.5 6.5V5h13v13.5H17"),
  T(kotak(3.5, 7, 13, 14, 1)),
  H("M10 17.5h6.5M10 17.5V21"),
  H("M6.5 10.5h6M6.5 13h4"),
);

/** Notifikasi — segitiga REVISI bernomor, simbol revisi di kop gambar.
    Bentuk yang sama dengan tombol notifikasi di kepala halaman dan kolom REV
    rel; di sini sebagai ikon baris palet perintah. */
export const ArsRevisi = ikon(
  T("M12 3.5L21 19.5H3Z"),
  H("M10.9 11.4l1.4-1.2v6.1"),
  H("M10.6 16.3h3.4"),
);

/** Seluruh ikon arsitektur, untuk galeri UI Component. */
export const IKON_ARSITEKTUR: [string, DataIkon][] = Object.entries({
  ArsLembar, ArsPeil, ArsDaftarPeriksa, ArsSuratPengantar, ArsArahUtara, ArsTampakRumah, ArsKurvaS, ArsKartuIndeks,
  ArsSkalaManusia, ArsAwanRevisi, ArsBukuSketsa, ArsFasad, ArsMejaGambar, ArsJangka, ArsAkun, ArsMal, ArsPintu,
  ArsOrdner, ArsKunciRumah, ArsBingkaiFoto, ArsRekap, ArsKartuBayar, ArsNotaPaku, ArsKertasLubang, ArsMesinKas,
  ArsTermin, ArsKuitansi, ArsBukuGaji, ArsAmplopGaji, ArsLantai, ArsLencanaKlien, ArsTimStudio, ArsSebelumSesudah,
  ArsGarisUkur, ArsGembok, ArsStempel, ArsLampuMeja, ArsSetGambar, ArsRevisi,
});
