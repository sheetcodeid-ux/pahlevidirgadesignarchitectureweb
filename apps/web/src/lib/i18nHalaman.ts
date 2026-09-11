/**
 * Kamus Indonesia per halaman publik.
 *
 * Bentuknya sama dengan KAMUS_BERANDA yang sudah ada di index.astro: kunci
 * cocok dengan atribut `data-t` di markup, dan yang INGGRIS tidak ditulis di
 * sini — ia sudah ada di markup, dan skrip pengalih di BaseLayout menyimpannya
 * sendiri sebelum menukar. Jadi kembali ke EN selalu mengembalikan kalimat
 * yang persis sama, bukan salinan yang bisa menyimpang.
 *
 * Kenapa satu berkas untuk lima halaman, bukan satu per halaman: yang membuat
 * terjemahan busuk adalah kalimat yang sama diterjemahkan dua kali dengan
 * pilihan kata berbeda. Berdampingan di satu berkas, ketidakkonsistenannya
 * kelihatan. Tiap halaman tetap hanya memuat kamusnya sendiri.
 *
 * Catatan yang berlaku untuk semuanya: mesin pencari melihat versi INGGRIS —
 * itu keputusan yang sudah dicatat di lib/i18n.ts. Indonesia disediakan untuk
 * kenyamanan tamu lokal, bukan untuk diindeks terpisah.
 */

import type { Kamus } from "./i18n";

/* ── /jurnal ──────────────────────────────────────────────────────────── */

export const KAMUS_JURNAL: Kamus = {
  jurLabel: "JURNAL",
  jurJudul:
    '<span class="brs"><i>Yang kami pelajari</i></span>' +
    '<span class="brs"><i><span class="ak">dengan mahal</span>, ditulis</i></span>' +
    '<span class="brs"><i>supaya Anda tidak perlu.</i></span>',
  jurLead:
    "Ini bukan pemasaran. Ini hal-hal yang akhirnya kami jelaskan lewat telepon setiap beberapa minggu — soal tanah, izin, anggaran, dan tukang. Kalau salah satunya menyelamatkan Anda dari satu kesalahan bahkan sebelum menghubungi kami, ia sudah bekerja.",

  jurTopik: "TOPIK",
  jurSemua: "Semua",
  jurKatsite: "Tapak & iklim",
  jurKatmoney: "Uang",
  jurKatpermit: "Perizinan",
  jurKatbuild: "Pembangunan",

  jurSering: "SEBERAPA SERING",
  jurSeringKet:
    "Setiap kali ada yang layak dicatat — bukan menurut jadwal. Kami tidak menjalankan buletin dan tidak akan meminta alamat email Anda di sini.",

  jurTerbit: "terbit",
  jurRencana: "berencana",
  jurMenitBaca: "menit baca",
  jurMenit: "menit",
  jurBelum: "Berencana",
  jurBelumCap: "Belum ditulis",
  jurKosong: "Belum ada apa-apa di sini. Tulisan pertama sedang dikerjakan.",
};

/* ── /proyek ──────────────────────────────────────────────────────────── */

export const KAMUS_KERJA: Kamus = {
  kerjaLabel: "KARYA",
  kerjaJudul: "Bangunan, dan persoalan<br />yang membuatnya dibangun.",
  kerjaLead:
    "Tiap proyek di sini dimulai dari bagian brief yang canggung, bukan dari foto jadinya. Kalau sebuah halaman tidak memberi tahu apa yang sulit, ia tidak layak dibaca.",

  kerjaKategori: "KATEGORI",
  /* Nama kategori dipakai di dua tempat — tombol rel dan judul panel — dan
     keduanya menunjuk kunci yang sama. */
  kerjaKatall: "Semua karya",
  kerjaKatcommercial: "Komersial",
  kerjaKatresidential: "Hunian",
  kerjaKatinterior: "Interior",
  kerjaKatrenovation: "Renovasi",
  kerjaKatlandscape: "Lanskap",
  kerjaKatmasterplan: "Masterplan",

  kerjaKetall: "Semua yang sudah diterbitkan studio ini sejauh ini.",
  kerjaKetcommercial: "Tempat yang harus tetap bekerja setelah minggu pembukaan lewat.",
  kerjaKetresidential: "Rumah, dan cara orang benar-benar tinggal di dalamnya.",
  kerjaKetinterior: "Pekerjaan di dalam bangunan yang sudah berdiri.",
  kerjaKetrenovation: "Bangunan yang diberi tahun-tahun tambahan alih-alih diganti.",
  kerjaKetlandscape: "Tanah di sekeliling bangunan, diperlakukan sebagai bagian darinya.",
  kerjaKetmasterplan: "Bagaimana beberapa bangunan bersepakat duduk di satu tapak.",

  kerjaUrut: "URUTAN",
  kerjaBaru: "Terbaru",
  kerjaLama: "Terlama",

  kerjaProyekSatu: "1 proyek",
  kerjaProyekBanyak: "proyek",
  kerjaTanpaSampul: "BELUM ADA SAMPUL",

  kerjaKosongSemua: "Belum ada karya yang diterbitkan",
  kerjaKosongKat: "Belum ada karya yang diterbitkan di sini",
  kerjaKosongKet:
    "Sedang menuju ke sana. Sementara itu, karya studio yang lain cuma satu klik jauhnya.",
  kerjaLihatSemua: "Lihat semua karya",

  kerjaAjakJudul:
    'Punya Anda bisa jadi <span class="ak">brief canggung</span> berikutnya di halaman ini.',
};

/* ── /kontak ──────────────────────────────────────────────────────────── */

export const KAMUS_KONTAK: Kamus = {
  konLabel: "KONTAK",
  konJudul:
    'Ceritakan lokasinya, anggarannya,<br />dan <span class="ak">apa yang mengganjal</span> soal itu.',
  konLead:
    "Percakapan pertama tidak dipungut biaya dan tidak mengikat apa pun. Bahkan kalau Anda akhirnya memutuskan tidak membangun, Anda pulang tahu kira-kira apa yang sebenarnya dibutuhkan proyek itu.",

  konBalas: "Waktu balasan",
  konBalasNilai: "Di bawah 24 jam",
  konBalasKet:
    "Termasuk akhir pekan. Studio kecil lebih lambat dalam banyak hal, dan lebih cepat dalam yang satu ini.",
  konJam: "Jam kerja",
  konBahasa: "Bahasa",
  konBahasaKet: "Tulis dengan yang mana pun yang lebih mudah. Kami menjawab dengan bahasa yang sama.",
  konLangsung: "Langsung",
  konLangsungKet: "Atau WhatsApp, kalau itu lebih cepat buat Anda.",

  konBantu: "MEMBANTU, TIDAK WAJIB",
  konBantu0: "Luas dan orientasi tanah",
  konBantu1: "Foto tapaknya seperti sekarang",
  konBantu2: "Kira-kira kapan ingin mulai",
  konBantuKet: "Tidak ada yang wajib untuk menulis. Kirim saja yang Anda punya.",

  konNama: "Nama Anda",
  konEmail: "Email",
  konEmailKet: "Balasan kami kirim ke sini.",
  konWa: "WhatsApp",
  konWaKet: "Opsional. Lebih cepat untuk pertanyaan singkat.",
  konLokasi: "Di mana tapaknya?",
  konLokasiKet: "Nama kota saja sudah cukup.",
  konJenis: "Anda membangun apa?",
  konPilih: "Pilih satu…",
  konJenis0: "Rumah",
  konJenis1: "Kafe atau restoran",
  konJenis2: "Ruang kerja atau kantor",
  konJenis3: "Ritel",
  konJenis4: "Renovasi",
  konJenis5: "Lainnya",
  konAnggaran: "Rentang anggaran",
  konAnggaran0: "Belum tahu",
  konAnggaran1: "Di bawah Rp 500 juta",
  konAnggaran2: "Rp 500 juta – 1,5 miliar",
  konAnggaran3: "Rp 1,5 – 5 miliar",
  konAnggaran4: "Di atas Rp 5 miliar",
  konAnggaranKet: "“Belum tahu” itu jawaban yang wajar.",
  konPesan: "Ceritakan",
  konPesanKet: "Bagian brief yang canggung justru bagian yang berguna.",
  konJebakan: "Biarkan kosong",
  konPrivasi: "Kami tidak pernah membagikan data Anda, dan tidak mengirim buletin.",
  konKirim: 'Kirim pesan <span class="ar">→</span>',

  /* Jam studio dirakit JS dari tiga potong, supaya angkanya bisa disisipkan
     di tengah tanpa membelah kalimatnya jadi tidak wajar. */
  konJamAwal: "Sekarang pukul",
  konJamTengah: "di studio —",
  konJamBuka: "kami sedang bekerja",
  konJamTutup: "di luar jam kerja, tapi pesannya tetap masuk",

  konSalahNama: "Tuliskan nama yang bisa kami pakai menyapa Anda.",
  konSalahEmail: "Alamat ini kehilangan bagian setelah titiknya.",
  konSalahLokasi: "Nama kotanya saja sudah cukup membantu kami menjawab dengan benar.",
  konSalahJenis: "Pilih yang paling mendekati — nanti masih bisa diubah.",
  konSalahPesan: "Tambah sedikit lagi — minimal satu kalimat tentang tapaknya.",

  konHasilBelumJ: "Belum ada yang terkirim.",
  konHasilBelumT:
    "Beberapa isian masih perlu dilengkapi — sudah ditandai di atas. Perbaiki, lalu tekan kirim lagi.",
  konHasilOkJ: "Terkirim. Sudah masuk ke kotak masuk studio.",
  konHasilOkT: "Anda akan dapat balasan dalam sehari, biasanya dengan dua tiga pertanyaan.",
  konHasilGagalJ: "Tidak berhasil terkirim.",
  konHasilGagalT: " Coba lagi sebentar, atau tulis langsung ke kami — alamatnya ada di sebelah kiri.",

  konSetelah: "SETELAH ANDA MENEKAN KIRIM",
  konSetelahJudul: "Tiga langkah, dan tidak satu pun berbayar.",
  konLangkah0J: "Kami baca dan balas dalam sehari",
  konLangkah0T:
    "Biasanya dengan dua tiga pertanyaan, karena pesan pertama tidak pernah memuat semuanya — dan itu wajar.",
  konLangkah1J: "Satu panggilan, sekitar sejam",
  konLangkah1T:
    "Video atau WhatsApp, mana pun yang disukai koneksi Anda. Kita bicara soal tapak, uang, dan jadwal secara jujur.",
  konLangkah2J: "Proposal tertulis",
  konLangkah2T:
    "Lingkup, biaya, dan tahapannya hitam di atas putih. Anda memutuskan setelah membacanya — bukan saat panggilan berlangsung.",

  konKlien: "SUDAH JADI KLIEN?",
  konKlienKet:
    "Halaman proyek Anda memuat tahapan, dokumen, dan tagihan. Pakai tautan yang kami kirim — tidak perlu kata sandi.",
  konPortal: 'Buka portal proyek <span class="ar">→</span>',
  konTanpaForm: "TIDAK INGIN MENGISI FORM?",
  konTanpaFormKet:
    "Tulis satu baris di WhatsApp. “Saya punya tanah di Pontianak dan belum tahu harus mulai dari mana” sudah jadi pesan pertama yang sangat baik.",
  konWaTombol: 'Kirim lewat WhatsApp <span class="ar">→</span>',
  konEmailTombol: 'Kirim email saja <span class="ar">→</span>',
};

/* ── /faq ─────────────────────────────────────────────────────────────────
 *
 * Kunci jawabannya HTML utuh, bukan teks polos: pengalih menukar innerHTML,
 * dan jawaban di halaman ini memang memuat <p>, <strong>, dan <ul>. Struktur
 * tag-nya dijaga sama persis dengan versi Inggrisnya — kalau berbeda, tata
 * letak jawabannya ikut berbeda begitu bahasa ditukar.
 */

export const KAMUS_FAQ: Kamus = {
  faqLabel: "PERTANYAAN",
  faqJudul: "Semua yang orang tanyakan sebelum<br />memutuskan untuk mulai.",
  faqLead:
    "Sembilan belas pertanyaan, dijawab seperti kami menjawabnya lewat telepon. Kalau ada angka yang belum diumumkan, kami bilang begitu alih-alih berpura-pura.",

  faqCariLabel: "CARI JAWABAN",
  faqCariPlaceholder: "Cari, misalnya “uang muka”",
  faqCariAria: "Cari di daftar pertanyaan",
  faqHapusCari: "Hapus pencarian",

  faqKatsemua: "Semua",
  faqKatmulai: "Memulai",
  faqKatuang: "Uang",
  faqKatwaktu: "Waktu",
  faqKatkerja: "Bekerja sama",
  faqKatselesai: "Setelah serah terima",

  faqPertanyaan: "pertanyaan",
  faqSatu: "1 pertanyaan",
  faqTakCocok: "Tidak ada pertanyaan yang memuat kata itu — coba kata yang lebih pendek, atau tanyakan langsung.",

  faqTidakAda: "TIDAK ADA DI SINI?",
  faqTidakAdaKet:
    "Tanyakan langsung. Balasannya datang dari orang yang akan menggambar bangunan Anda, bukan dari sebuah form.",
  faqTanya: 'Tanyakan langsung <span class="ar">→</span>',
  faqLencana: "ANGKA DIBERIKAN SAAT DITANYA",
  faqAngka: "Angkanya",
  faqKosong:
    "Tidak ada yang memakai kata itu di sini. Pertanyaannya kemungkinan besar tetap bagus — kirimkan dan Anda akan dapat jawabannya dalam sehari.",

  /* ── Memulai ── */
  "faqT-we-only-own-land-is": "Kami baru punya tanah. Apa terlalu dini bicara dengan arsitek?",
  "faqJ-we-only-own-land-is":
    "<p>Justru ini waktu terbaiknya. Setengah dari hal yang menentukan bangunan yang baik — di mana ia diletakkan di kavling, menghadap ke mana, ke mana airnya pergi, boleh setinggi apa — sudah ditentukan sebelum satu garis pun ditarik.</p>" +
    "<p>Datang dengan gagasan yang sudah jadi juga bukan masalah. Tapi datang hanya dengan tanah berarti belum ada satu pun keputusan yang salah diambil.</p>",

  "faqT-do-you-work-with-clients": "Apakah Anda melayani klien di luar Indonesia?",
  "faqJ-do-you-work-with-clients":
    "<p>Ya. Kami bekerja dalam bahasa Inggris dan Indonesia, mana pun yang lebih mudah buat Anda, dan kami menjawab dengan bahasa yang sama seperti yang Anda pakai menulis.</p>" +
    "<p>Jarak mengubah caranya, bukan pekerjaannya: panggilan lewat video atau WhatsApp, gambar dan tagihan di halaman proyek Anda, dan catatan tertulis untuk tiap keputusan sehingga tidak ada yang bergantung pada siapa yang masih ingat. Yang tidak bisa dihapus jarak adalah keharusan seseorang berdiri di tapaknya — pada satu titik itu berarti kami yang berangkat, atau orang lokal yang Anda percaya.</p>",

  "faqT-what-do-you-need-from": "Apa yang Anda butuhkan dari kami di pesan pertama?",
  "faqJ-what-do-you-need-from":
    "<p>Tiga hal, dan tidak satu pun harus presisi: <strong>di mana tapaknya</strong>, <strong>kira-kira berapa yang bisa Anda keluarkan</strong>, dan <strong>apa yang membuat Anda ragu</strong>.</p>" +
    "<p>Yang ketiga itu yang paling berguna. “Saya punya kavling sudut dan belum tahu sebaiknya naik ke atas atau melebar” memberi tahu kami lebih banyak daripada satu halaman daftar kebutuhan.</p>",

  "faqT-is-the-first-conversation-free": "Apakah percakapan pertama gratis?",
  "faqJ-is-the-first-conversation-free":
    "<p>Ya, dan akan selalu begitu. Sekitar sejam, lewat video atau WhatsApp, membicarakan tapak, uang, dan jadwalnya secara jujur. Anda pulang tahu kira-kira apa yang sebenarnya dibutuhkan proyek Anda, mau bekerja dengan kami atau tidak.</p>" +
    "<p>Gambar tidak gratis — untuk siapa pun. Kami tidak membuat konsep supaya studio bisa dibanding-bandingkan berdampingan.</p>",

  /* ── Uang ── */
  "faqT-how-much-do-you-charge": "Berapa tarif Anda?",
  "faqJ-how-much-do-you-charge":
    "<p>Biaya disusun dengan salah satu dari dua cara, dan kami memberi tahu yang mana sebelum satu pun pekerjaan dimulai: <strong>persentase dari biaya konstruksi</strong> untuk proyek penuh, atau <strong>biaya tetap per tahap</strong> kalau lingkupnya jelas dan terbatas.</p>" +
    "<p>Dengan cara mana pun, biayanya dibagi ke seluruh tahap, dan tiap tahap baru ditagih setelah diserahkan. Anda tidak pernah membayar pekerjaan yang belum sampai.</p>" +
    "<p><strong>Angka sebenarnya belum diumumkan di halaman ini.</strong> Tanyakan di pesan pertama dan Anda akan mendapatkannya di balasan — kami lebih suka menghitung terhadap tapak Anda yang sungguhan daripada memasang angka yang tidak cocok untuk siapa pun.</p>",

  "faqT-how-much-do-you-need": "Berapa yang Anda butuhkan sebelum mulai?",
  "faqJ-how-much-do-you-need":
    "<p>Uang muka di awal tahap pertama, lalu pembayaran setiap kali satu tahap diserahkan. Uang muka itu ada karena tahap pertama — mengukur, memeriksa aturan, menguji apa yang diizinkan kavlingnya — adalah pekerjaan sungguhan, mau proyeknya dilanjutkan atau tidak.</p>" +
    "<p><strong>Persentasenya belum diumumkan di sini.</strong> Ia datang bersama proposal tertulis, lengkap dengan jadwal setiap pembayaran berikutnya, jadi Anda melihat seluruh bentuknya sebelum menyetujui bagian mana pun.</p>",

  "faqT-what-if-our-budget-turns": "Bagaimana kalau anggaran kami ternyata terlalu kecil?",
  "faqJ-what-if-our-budget-turns":
    "<p>Kami akan mengatakannya di balasan pertama, bukan di bulan ketiga. Desain yang tidak sanggup Anda selesaikan bukanlah desain — itu gambar.</p>" +
    "<p>Sering kali jawaban jujurnya bukan “tidak”, melainkan “tidak sebesar ini”, atau “tidak dengan finishing ini”, atau “bisa, tapi dua tahap”. Itu jawaban yang berguna, dan mendengarnya tidak memakan biaya apa pun.</p>",

  "faqT-are-there-costs-beyond-your": "Adakah biaya di luar jasa Anda?",
  "faqJ-are-there-costs-beyond-your":
    "<p>Ada, dan semuanya terbuka sejak proposal pertama. Tergantung proyeknya, siapkan sebagian dari:</p>" +
    "<p><ul><li>Survei tanah dan penyelidikan lapisan tanah</li><li>Ahli struktur dan MEP</li><li>Perizinan dan retribusi pemerintah</li><li>Render 3D, kalau Anda memerlukannya untuk persetujuan atau untuk menjual</li><li>Pencetakan dan legalisasi dokumen</li></ul></p>" +
    "<p>Semuanya dibayarkan kepada yang mengerjakannya, bukan kepada kami dengan margin ditambahkan.</p>",

  "faqT-do-you-take-a-commission": "Apakah Anda mengambil komisi dari kontraktor atau pemasok?",
  "faqJ-do-you-take-a-commission":
    "<p>Tidak. Tidak dari kontraktor, tidak dari pemasok material, tidak dari siapa pun.</p>" +
    "<p>Ini lebih penting daripada kedengarannya. Studio yang mendapat persentase dari material punya alasan diam-diam untuk menentukan keramik yang mahal. Biaya kami datang dari Anda, jadi satu-satunya alasan menentukan sesuatu adalah karena itu yang benar untuk bangunannya.</p>",

  /* ── Waktu ── */
  "faqT-how-long-does-it-take": "Berapa lama pengerjaannya?",
  "faqJ-how-long-does-it-take":
    "<p>Ditentukan per tahap, bukan oleh satu angka: memahami tapak, konsep, pengembangan desain, lalu gambar kerja dan dokumen perizinan. Tiap tahap berakhir dengan sesuatu yang bisa Anda pegang dan setujui sebelum tahap berikutnya dimulai.</p>" +
    "<p><strong>Lama khas tiap tahap belum diumumkan di sini</strong> — ia bergerak mengikuti besar bangunan dan mengikuti secepat apa izin bergerak di daerah Anda, dan rentang yang dikarang hanya akan menyesatkan. Proposal tertulis memuat tanggal untuk proyek Anda secara khusus.</p>",

  "faqT-can-you-do-it-faster": "Bisa lebih cepat?",
  "faqJ-can-you-do-it-faster":
    "<p>Konsep saja memakan waktu lebih dari dua minggu begitu tapaknya diukur dengan benar, jadi kami lebih rela kehilangan pekerjaannya daripada menjanjikan tanggal yang kemudian kami lewatkan.</p>" +
    "<p>Yang benar-benar bisa dipersingkat adalah menunggunya: keputusan diambil dalam hitungan hari alih-alih minggu, satu orang yang bisa menjawab alih-alih tiga. Itu sebabnya studionya kecil.</p>",

  "faqT-what-if-we-have-to": "Bagaimana kalau kami harus menunda proyeknya?",
  "faqJ-what-if-we-have-to":
    "<p>Menunda itu wajar — izin tersendat, pendanaan bergeser, keluarga berubah pikiran. Tidak ada yang hilang. Gambar, dokumen, dan keputusan Anda tetap ada di halaman proyek Anda, dan halamannya tetap hidup.</p>" +
    "<p>Saat Anda kembali, kami mulai dari tahap terakhir yang sudah disetujui, bukan dari awal.</p>",

  /* ── Bekerja sama ── */
  "faqT-how-do-we-know-what": "Bagaimana kami tahu apa yang sedang terjadi?",
  "faqJ-how-do-we-know-what":
    "<p>Tiap klien mendapat halaman proyek. Tahapan, gambar, tagihan, dan seluruh percakapannya tinggal di sana, dan ia diperbarui saat kami memperbaruinya — bukan saat Anda bertanya.</p>" +
    "<p>Tidak perlu kata sandi dan tidak perlu aplikasi. Tautan yang kami kirim itulah loginnya, yang juga berarti Anda bisa meneruskannya ke siapa pun yang perlu melihat.</p>",

  "faqT-how-many-revisions-do-we": "Berapa kali revisi yang kami dapat?",
  "faqJ-how-many-revisions-do-we":
    "<p>Revisi milik sebuah tahap, bukan milik seluruh proyek. Di dalam satu tahap kami bekerja sampai Anda puas; begitu Anda menyetujui tahap itu dan kami lanjut, membukanya kembali adalah perubahan lingkup dan dihitung sebagai perubahan lingkup.</p>" +
    "<p>Ini bukan kami yang kaku. Revisi tanpa batas lintas tahap justru cara persis bagaimana proyek berakhir terlambat delapan belas bulan dengan desain yang tidak pernah dipilih siapa pun dengan sengaja.</p>",

  "faqT-do-you-work-with-our": "Apakah Anda bekerja dengan kontraktor kami, atau membawa sendiri?",
  "faqJ-do-you-work-with-our":
    "<p>Dua-duanya bisa. Kalau Anda sudah punya kontraktor yang Anda percaya, kami menggambar untuk mereka dan menjawab pertanyaannya langsung — detail yang sampai harus ditelepon tukang berarti belum selesai.</p>" +
    "<p>Kalau belum punya, kami bisa mengenalkan kontraktor yang pernah bekerja dengan kami. Kami tidak mengambil biaya untuk pengenalan itu, dan Anda yang mempekerjakan mereka, bukan kami.</p>",

  "faqT-can-we-take-the-drawings": "Bisakah kami ambil gambarnya lalu membangun tanpa Anda?",
  "faqJ-can-we-take-the-drawings":
    "<p>Bisa, dan kalau memang itu rencananya sebaiknya disampaikan sejak awal — studio lain akan melayani Anda lebih baik dengan biaya lebih murah.</p>" +
    "<p>Kami tetap terlibat karena gambar bukanlah bangunan. Harus ada yang menjawab pertanyaan yang diajukan kontraktor pada Selasa pagi, dan kalau itu tidak ada, jawabannya dikarang di lokasi.</p>",

  /* ── Setelah serah terima ── */
  "faqT-do-you-visit-the-site": "Apakah Anda datang ke lokasi selama pembangunan?",
  "faqJ-do-you-visit-the-site":
    "<p>Ya. Seberapa sering tergantung besar proyeknya, jaraknya dari kami, dan sedang di tahap apa pekerjaannya — rapat saat struktur dan finishing, lebih longgar di antaranya.</p>" +
    "<p><strong>Jadwal kunjungan dan siapa yang menanggung perjalanan untuk lokasi jauh belum ditetapkan di halaman ini</strong>, karena keduanya berubah total antara tapak di Pontianak dan tapak di provinsi lain. Itu dituliskan di proposal supaya tidak jadi perdebatan belakangan.</p>",

  "faqT-do-we-get-the-files": "Apakah kami mendapat berkasnya setelah serah terima?",
  "faqJ-do-we-get-the-files":
    "<p>Ya. Anda menerima satu set gambar dalam PDF, dan berkas kerjanya sejauh itu memang hak Anda. Itu dokumen bangunan Anda; menahannya demi menjamin pekerjaan berikutnya bukan cara kami bekerja.</p>" +
    "<p>Halaman proyek Anda juga tetap hidup setelah serah terima, jadi gambar dan tagihannya masih bisa ditemukan bertahun-tahun kemudian — yang biasanya justru saat seseorang benar-benar membutuhkannya.</p>",

  "faqT-will-our-project-appear-on": "Apakah proyek kami akan tampil di situs ini?",
  "faqJ-will-our-project-appear-on":
    "<p>Hanya kalau Anda mengizinkan. Kami menanyakannya setelah serah terima, dan “tidak” adalah jawaban yang utuh dan tidak mengubah apa pun tentang cara kami bekerja dengan Anda.</p>" +
    "<p>Kalau Anda setuju, kita sepakati bersama apa yang ditampilkan: sebagian klien senang semuanya tampil, sebagian ingin bangunannya saja tanpa alamat, sebagian tidak ingin apa pun yang mengenali mereka.</p>",
};

/* ── /studio ──────────────────────────────────────────────────────────── */

export const KAMUS_STUDIO: Kamus = {
  stuLabel: "STUDIO",
  /* Judulnya dipotong tiga karena nama kota disisipkan dari setelan studio. */
  stuJudul1: "Studio kecil di",
  stuJudul2: 'yang lebih suka <span class="ak">menunjukkan karyanya</span>',
  stuJudul3: "daripada menjelaskannya.",
  stuLead:
    "Kami memang sengaja kecil. Itu bukan kerendahan hati — itu cara supaya orang yang menggambar bangunan Anda tetap orang yang membalas pesan Anda. Semua yang di bawah ini adalah apa artinya itu dalam praktik, termasuk bagian yang merepotkan kami sendiri.",

  stuAngka0L: "Orang, seluruhnya",
  stuAngka0K:
    "Bukan jumlah yang sedang kami usahakan bertambah. Dua adalah angka saat tidak ada satu pun pekerjaan yang dioper ke orang yang belum pernah Anda temui.",
  stuAngka1L: "Percakapan per bulan",
  stuAngka1K:
    "Yang kami ambil hanya sebagian. Mengatakan tidak lebih awal lebih murah buat Anda daripada mengetahuinya di bulan ketiga.",
  stuAngka2L: "Waktu balasan",
  stuAngka2K:
    "Termasuk akhir pekan. Ini satu-satunya janji yang benar-benar bisa ditepati studio seukuran ini, jadi kami menepatinya.",
  stuAngka3L: "Proyek diserahkan",
  stuAngka3K:
    "Tiap satu punya halamannya sendiri di situs ini. Angka yang tidak bisa Anda buka bukan angka yang layak dicetak.",

  stuKerja: "CARA KAMI BEKERJA",
  stuKerjaJudul: "Anda tidak perlu bertanya proyeknya sampai mana.",
  stuKerjaP1:
    "Sebagian besar kecemasan dalam proyek bangunan bukan soal desain, melainkan soal tidak tahu. Sekarang di tahap mana, apa yang diputuskan minggu lalu, sudah terbayar berapa, apa hal berikutnya yang menunggu saya.",
  stuKerjaP2:
    "Karena itu tiap klien mendapat satu halaman. Tahapan, gambar, tagihan, dan seluruh percakapannya tinggal di sana. Ia diperbarui saat kami memperbaruinya, bukan saat Anda bertanya. Tidak perlu kata sandi dan tidak perlu aplikasi — tautan yang kami kirim itulah loginnya.",
  stuLihatPortal: 'Lihat cara halaman klien bekerja <span class="ar">→</span>',

  stuFotoJadi: "FOTO — SUDAH DIBANGUN",
  stuFotoAwal: "FOTO — TAPAK APA ADANYA",
  stuFotoTunggu: "menunggu foto dari studio",
  stuTagAwal: "APA ADANYA",
  stuTagJadi: "SUDAH DIBANGUN",

  stuYakin: "APA YANG KAMI YAKINI",
  stuYakinJudul: "Empat sikap yang tidak kami tawar.",
  stuPrinsip01J: "Tapaknya lebih menentukan daripada kami",
  stuPrinsip01T:
    "Orientasi, angin, dinding tetangga, ke mana airnya pergi bulan Maret. Kami mulai dengan mengukur apa yang sudah ada, karena rencana yang mengabaikannya akan dikoreksi oleh bangunannya sendiri — dengan mahal, belakangan.",
  stuPrinsip02J: "Satu aturan material per lantai",
  stuPrinsip02T:
    "Sebuah lantai terbaca sebagai satu gagasan, atau terbaca sebagai katalog. Menetapkan aturannya lebih awal itulah yang menjaga anggaran sederhana tidak terlihat sederhana.",
  stuPrinsip03J: "Uang itu batasan desain, bukan hal tabu",
  stuPrinsip03T:
    "Kami menaruh angkanya di meja sejak panggilan pertama. Desain yang tidak sanggup Anda selesaikan bukanlah desain — itu gambar.",
  stuPrinsip04J: "Gambar dibuat untuk tukang, bukan untuk kami",
  stuPrinsip04T:
    "Kalau kontraktor harus menelepon kami untuk memahami sebuah detail, detail itu belum selesai. Kami lebih rela menghabiskan satu minggu tambahan di atas kertas daripada di lokasi.",

  stuTim: "TIM KAMI",
  stuTimJudul: "Dua orang, dan Anda akan bertemu keduanya.",
  stuTimLead:
    "Tidak ada account manager di antara Anda dan orang yang menggambar. Dua nama yang sama muncul di panggilan pertama, di gambar-gambarnya, dan di pesan yang Anda kirim jam sembilan malam Minggu.",
  stuPotret: "potret 4:5",
  stuLainnya: "Selebihnya masuk per proyek",
  stuLainnyaKet:
    "Ahli struktur, MEP, perender, dan fotografer disewa per proyek dan dicantumkan di kredit proyek itu — bukan didaftar di sini seolah mereka duduk di ruangan ini. Anda akan tahu siapa yang menyentuh gambar Anda.",

  stuRiwayat: "BAGAIMANA JALANNYA",
  stuRiwayatJudul: "Versi singkatnya.",
  stuRiwayatLead:
    "Ditulis apa adanya, bukan sebagai kisah pertumbuhan. Apa pun yang bertahun di sini seharusnya bisa diperiksa terhadap halaman proyeknya di situs ini.",
  stuTonggak0J: "Studionya dimulai",
  stuTonggak0T: "Satu meja, satu meja gambar, dan keputusan untuk tetap kecil dengan sengaja.",
  stuTonggak1J: "Proyek komersial pertama",
  stuTonggak1T:
    "Titik saat pekerjaannya berhenti jadi rumah saja, dan gambarnya harus menjawab kepada sebuah usaha, bukan cuma kepada sebuah keluarga.",
  stuTonggak2T:
    "Proyek pertama yang didokumentasikan foto demi foto di situs ini, bukan diringkas jadi satu paragraf.",
  stuTonggak3J: "Halaman klien mulai tayang",
  stuTonggak3T:
    "Tahapan, gambar, dan tagihan di satu tempat. Dibuat karena menjawab “sekarang sampai mana?” lima kali seminggu adalah persoalan desain, bukan persoalan administrasi.",

  stuJujur: "JUJURNYA",
  stuJujurJudul: "Hal-hal yang membuat kami bukan studio yang tepat.",
  stuJujurLead:
    "Membaca daftar ini memakan dua menit. Mengetahui hal yang sama di bulan ketiga jauh lebih mahal.",
  stuTidak0:
    "<b>Gambar saja, tanpa pendampingan.</b> Kalau rencananya mengambil berkasnya lalu membangun tanpa kami, studio lain akan melayani Anda lebih baik dengan biaya lebih murah.",
  stuTidak1:
    "<b>Desain dalam dua minggu.</b> Konsep saja memakan waktu lebih lama dari itu begitu tapaknya diukur dengan benar. Kami lebih rela kehilangan pekerjaannya daripada menjanjikan tanggalnya.",
  stuTidak2:
    "<b>Menyalin bangunan yang Anda lihat.</b> Kami akan membaca acuannya bersama Anda dan mengambil gagasan di baliknya, tapi salinan di tapak yang berbeda berhenti bekerja sejak hari pertama.",
  stuTidak3:
    "<b>Konsep gratis untuk membandingkan studio.</b> Percakapan pertama gratis dan akan selalu begitu. Gambar tidak, untuk siapa pun.",

  stuAjakJudul: "Masih merasa kami studio yang tepat?",
  stuAjakLead:
    "Ceritakan tapaknya dan anggarannya. Kalau kami bukan yang cocok, kami akan mengatakannya di balasan pertama, dan menunjukkan tempat yang lebih baik.",
  stuLihatKarya: 'Lihat karyanya <span class="ar">→</span>',
};
