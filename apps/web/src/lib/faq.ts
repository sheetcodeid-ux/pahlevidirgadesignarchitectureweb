/**
 * Isi halaman /faq — sumber tunggal untuk halaman itu DAN untuk lima
 * pertanyaan yang disorot di beranda. Kalimatnya tidak boleh disalin ke
 * tempat lain: dua salinan pasti menyimpang, dan itu bug yang sudah
 * memakan berjam-jam di stylesheet sistem.
 *
 * `angka` menyebut isian mana di /admin/halaman/faq yang mengisi
 * angkanya. Selama isian itu kosong, halaman menandai pertanyaannya dengan
 * lencana "FIGURES ON REQUEST" persis seperti rancangan yang di-ACC; begitu
 * terisi, lencananya padam dan angkanya ikut dicetak di bawah jawaban —
 * untuk pertanyaan itu saja. Empat pertanyaan yang begitu: tarif, uang muka,
 * lama pengerjaan, dan kunjungan ke lokasi.
 */
export type KategoriFaq = "mulai" | "uang" | "waktu" | "kerja" | "selesai";

export const LABEL_FAQ: Record<KategoriFaq, string> = {
  mulai: "Memulai",
  uang: "Uang",
  waktu: "Waktu",
  kerja: "Bekerja sama",
  selesai: "Setelah serah terima",
};

export interface Tanya {
  /** Dipakai sebagai anchor: /faq#<id>. Jangan diubah kalau sudah dibagikan. */
  id: string;
  kat: KategoriFaq;
  tanya: string;
  /** HTML — jawabannya memuat <p>, <strong>, dan <ul>. */
  jawab: string;
  /**
   * Angkanya ditunggu dari pemilik, dan INI nama isian yang mengisinya di
   * /admin/halaman/faq.
   *
   * Bukan sekadar `menunggu: boolean` seperti sebelumnya. Boolean cuma bisa
   * menyalakan lencana "FIGURES ON REQUEST"; ia tidak tahu isian mana yang
   * memadamkannya, jadi keempat pertanyaan akan menyala atau padam bersamaan
   * walau pemilik baru mengisi satu. Dengan nama isiannya di sini, tiap
   * pertanyaan menjawab sendiri apakah angkanya sudah ada.
   */
  angka?: "faqTarif" | "faqUangMuka" | "faqLamaKerja" | "faqKunjungan";
}

export const FAQ: Tanya[] = [
  {
    id: "we-only-own-land-is",
    kat: "mulai",
    tanya: "Kami baru punya tanah. Apa terlalu dini bicara dengan arsitek?",
    jawab: `<p>Justru ini waktu terbaiknya. Setengah dari hal yang menentukan bangunan yang baik — di mana ia diletakkan di kavling, menghadap ke mana, ke mana airnya pergi, boleh setinggi apa — sudah ditentukan sebelum satu garis pun ditarik.</p><p>Datang dengan gagasan yang sudah jadi juga bukan masalah. Tapi datang hanya dengan tanah berarti belum ada satu pun keputusan yang salah diambil.</p>`,
  },
  {
    id: "do-you-work-with-clients",
    kat: "mulai",
    tanya: "Apakah Anda melayani klien di luar Indonesia?",
    jawab: `<p>Ya. Kami bekerja dalam bahasa Inggris dan Indonesia, mana pun yang lebih mudah buat Anda, dan kami menjawab dengan bahasa yang sama seperti yang Anda pakai menulis.</p><p>Jarak mengubah caranya, bukan pekerjaannya: panggilan lewat video atau WhatsApp, gambar dan tagihan di halaman proyek Anda, dan catatan tertulis untuk tiap keputusan sehingga tidak ada yang bergantung pada siapa yang masih ingat. Yang tidak bisa dihapus jarak adalah keharusan seseorang berdiri di tapaknya — pada satu titik itu berarti kami yang berangkat, atau orang lokal yang Anda percaya.</p>`,
  },
  {
    id: "what-do-you-need-from",
    kat: "mulai",
    tanya: "Apa yang Anda butuhkan dari kami di pesan pertama?",
    jawab: `<p>Tiga hal, dan tidak satu pun harus presisi: <strong>di mana tapaknya</strong>, <strong>kira-kira berapa yang bisa Anda keluarkan</strong>, dan <strong>apa yang membuat Anda ragu</strong>.</p><p>Yang ketiga itu yang paling berguna. “Saya punya kavling sudut dan belum tahu sebaiknya naik ke atas atau melebar” memberi tahu kami lebih banyak daripada satu halaman daftar kebutuhan.</p>`,
  },
  {
    id: "is-the-first-conversation-free",
    kat: "mulai",
    tanya: "Apakah percakapan pertama gratis?",
    jawab: `<p>Ya, dan akan selalu begitu. Sekitar sejam, lewat video atau WhatsApp, membicarakan tapak, uang, dan jadwalnya secara jujur. Anda pulang tahu kira-kira apa yang sebenarnya dibutuhkan proyek Anda, mau bekerja dengan kami atau tidak.</p><p>Gambar tidak gratis — untuk siapa pun. Kami tidak membuat konsep supaya studio bisa dibanding-bandingkan berdampingan.</p>`,
  },
  {
    id: "how-much-do-you-charge",
    kat: "uang",
    tanya: "Berapa tarif Anda?",
    jawab: `<p><strong>Rentangnya diumumkan di beranda</strong>, dibagi tiga tier untuk coffee shop dan tiga untuk rumah. Coffee shop mulai Rp 15–25 juta untuk konsep dan denah sampai Rp 100–180 juta untuk layanan penuh; rumah mulai Rp 10–20 juta untuk konsultasi sampai Rp 80–200 juta untuk desain sampai lanskap.</p><p>Di mana Anda mendarat di dalam rentangnya tergantung tapak dan seberapa rumit ia ternyata, dan kami memberi tahu tier mana yang berlaku sebelum satu pun pekerjaan dimulai. Biayanya dibagi ke seluruh tahap, dan tiap tahap baru ditagih setelah diserahkan — Anda tidak pernah membayar pekerjaan yang belum sampai.</p><p>Di atas tier paling dasar kami tidak menghitung per meter persegi. Kafe 200 m² dengan tiga bar station bukan setengah pekerjaan kafe 400 m² berkonter tunggal, dan menghitung per luas diam-diam menghukum proyek yang justru paling butuh dipikirkan.</p>`,
  },
  {
    id: "how-much-do-you-need",
    kat: "uang",
    tanya: "Berapa yang Anda butuhkan sebelum mulai?",
    angka: "faqUangMuka",
    jawab: `<p>Uang muka di awal tahap pertama, lalu pembayaran setiap kali satu tahap diserahkan. Uang muka itu ada karena tahap pertama — mengukur, memeriksa aturan, menguji apa yang diizinkan kavlingnya — adalah pekerjaan sungguhan, mau proyeknya dilanjutkan atau tidak.</p><p><strong>Persentasenya belum diumumkan di sini.</strong> Ia datang bersama proposal tertulis, lengkap dengan jadwal setiap pembayaran berikutnya, jadi Anda melihat seluruh bentuknya sebelum menyetujui bagian mana pun.</p>`,
  },
  {
    id: "what-if-our-budget-turns",
    kat: "uang",
    tanya: "Bagaimana kalau anggaran kami ternyata terlalu kecil?",
    jawab: `<p>Kami akan mengatakannya di balasan pertama, bukan di bulan ketiga. Desain yang tidak sanggup Anda selesaikan bukanlah desain — itu gambar.</p><p>Sering kali jawaban jujurnya bukan “tidak”, melainkan “tidak sebesar ini”, atau “tidak dengan finishing ini”, atau “bisa, tapi dua tahap”. Itu jawaban yang berguna, dan mendengarnya tidak memakan biaya apa pun.</p>`,
  },
  {
    id: "are-there-costs-beyond-your",
    kat: "uang",
    tanya: "Adakah biaya di luar jasa Anda?",
    jawab: `<p>Ada, dan semuanya terbuka sejak proposal pertama. Tergantung proyeknya, siapkan sebagian dari:</p><p><ul><li>Survei tanah dan penyelidikan lapisan tanah</li><li>Ahli struktur dan MEP</li><li>Perizinan dan retribusi pemerintah</li><li>Render 3D, kalau Anda memerlukannya untuk persetujuan atau untuk menjual</li><li>Pencetakan dan legalisasi dokumen</li></ul></p><p>Semuanya dibayarkan kepada yang mengerjakannya, bukan kepada kami dengan margin ditambahkan.</p>`,
  },
  {
    id: "do-you-take-a-commission",
    kat: "uang",
    tanya: "Apakah Anda mengambil komisi dari kontraktor atau pemasok?",
    jawab: `<p>Tidak. Tidak dari kontraktor, tidak dari pemasok material, tidak dari siapa pun.</p><p>Ini lebih penting daripada kedengarannya. Studio yang mendapat persentase dari material punya alasan diam-diam untuk menentukan keramik yang mahal. Biaya kami datang dari Anda, jadi satu-satunya alasan menentukan sesuatu adalah karena itu yang benar untuk bangunannya.</p>`,
  },
  {
    id: "how-long-does-it-take",
    kat: "waktu",
    tanya: "Berapa lama pengerjaannya?",
    angka: "faqLamaKerja",
    jawab: `<p>Ditentukan per tahap, bukan oleh satu angka: memahami tapak, konsep, pengembangan desain, lalu gambar kerja dan dokumen perizinan. Tiap tahap berakhir dengan sesuatu yang bisa Anda pegang dan setujui sebelum tahap berikutnya dimulai.</p><p><strong>Lama khas tiap tahap belum diumumkan di sini</strong> — ia bergerak mengikuti besar bangunan dan mengikuti secepat apa izin bergerak di daerah Anda, dan rentang yang dikarang hanya akan menyesatkan. Proposal tertulis memuat tanggal untuk proyek Anda secara khusus.</p>`,
  },
  {
    id: "can-you-do-it-faster",
    kat: "waktu",
    tanya: "Bisa lebih cepat?",
    jawab: `<p>Konsep saja memakan waktu lebih dari dua minggu begitu tapaknya diukur dengan benar, jadi kami lebih rela kehilangan pekerjaannya daripada menjanjikan tanggal yang kemudian kami lewatkan.</p><p>Yang benar-benar bisa dipersingkat adalah menunggunya: keputusan diambil dalam hitungan hari alih-alih minggu, satu orang yang bisa menjawab alih-alih tiga. Itu sebabnya studionya kecil.</p>`,
  },
  {
    id: "what-if-we-have-to",
    kat: "waktu",
    tanya: "Bagaimana kalau kami harus menunda proyeknya?",
    jawab: `<p>Menunda itu wajar — izin tersendat, pendanaan bergeser, keluarga berubah pikiran. Tidak ada yang hilang. Gambar, dokumen, dan keputusan Anda tetap ada di halaman proyek Anda, dan halamannya tetap hidup.</p><p>Saat Anda kembali, kami mulai dari tahap terakhir yang sudah disetujui, bukan dari awal.</p>`,
  },
  {
    id: "how-do-we-know-what",
    kat: "kerja",
    tanya: "Bagaimana kami tahu apa yang sedang terjadi?",
    jawab: `<p>Tiap klien mendapat halaman proyek. Tahapan, gambar, tagihan, dan seluruh percakapannya tinggal di sana, dan ia diperbarui saat kami memperbaruinya — bukan saat Anda bertanya.</p><p>Tidak perlu kata sandi dan tidak perlu aplikasi. Tautan yang kami kirim itulah loginnya, yang juga berarti Anda bisa meneruskannya ke siapa pun yang perlu melihat.</p>`,
  },
  {
    id: "how-many-revisions-do-we",
    kat: "kerja",
    tanya: "Berapa kali revisi yang kami dapat?",
    jawab: `<p>Revisi milik sebuah tahap, bukan milik seluruh proyek. Di dalam satu tahap kami bekerja sampai Anda puas; begitu Anda menyetujui tahap itu dan kami lanjut, membukanya kembali adalah perubahan lingkup dan dihitung sebagai perubahan lingkup.</p><p>Ini bukan kami yang kaku. Revisi tanpa batas lintas tahap justru cara persis bagaimana proyek berakhir terlambat delapan belas bulan dengan desain yang tidak pernah dipilih siapa pun dengan sengaja.</p>`,
  },
  {
    id: "do-you-work-with-our",
    kat: "kerja",
    tanya: "Apakah Anda bekerja dengan kontraktor kami, atau membawa sendiri?",
    jawab: `<p>Dua-duanya bisa. Kalau Anda sudah punya kontraktor yang Anda percaya, kami menggambar untuk mereka dan menjawab pertanyaannya langsung — detail yang sampai harus ditelepon tukang berarti belum selesai.</p><p>Kalau belum punya, kami bisa mengenalkan kontraktor yang pernah bekerja dengan kami. Kami tidak mengambil biaya untuk pengenalan itu, dan Anda yang mempekerjakan mereka, bukan kami.</p>`,
  },
  {
    id: "can-we-take-the-drawings",
    kat: "kerja",
    tanya: "Bisakah kami ambil gambarnya lalu membangun tanpa Anda?",
    jawab: `<p>Bisa, dan kalau memang itu rencananya sebaiknya disampaikan sejak awal — studio lain akan melayani Anda lebih baik dengan biaya lebih murah.</p><p>Kami tetap terlibat karena gambar bukanlah bangunan. Harus ada yang menjawab pertanyaan yang diajukan kontraktor pada Selasa pagi, dan kalau itu tidak ada, jawabannya dikarang di lokasi.</p>`,
  },
  {
    id: "do-you-visit-the-site",
    kat: "selesai",
    tanya: "Apakah Anda datang ke lokasi selama pembangunan?",
    angka: "faqKunjungan",
    jawab: `<p>Ya. Seberapa sering tergantung besar proyeknya, jaraknya dari kami, dan sedang di tahap apa pekerjaannya — rapat saat struktur dan finishing, lebih longgar di antaranya.</p><p><strong>Jadwal kunjungan dan siapa yang menanggung perjalanan untuk lokasi jauh belum ditetapkan di halaman ini</strong>, karena keduanya berubah total antara tapak di Pontianak dan tapak di provinsi lain. Itu dituliskan di proposal supaya tidak jadi perdebatan belakangan.</p>`,
  },
  {
    id: "do-we-get-the-files",
    kat: "selesai",
    tanya: "Apakah kami mendapat berkasnya setelah serah terima?",
    jawab: `<p>Ya. Anda menerima satu set gambar dalam PDF, dan berkas kerjanya sejauh itu memang hak Anda. Itu dokumen bangunan Anda; menahannya demi menjamin pekerjaan berikutnya bukan cara kami bekerja.</p><p>Halaman proyek Anda juga tetap hidup setelah serah terima, jadi gambar dan tagihannya masih bisa ditemukan bertahun-tahun kemudian — yang biasanya justru saat seseorang benar-benar membutuhkannya.</p>`,
  },
  {
    id: "will-our-project-appear-on",
    kat: "selesai",
    tanya: "Apakah proyek kami akan tampil di situs ini?",
    jawab: `<p>Hanya kalau Anda mengizinkan. Kami menanyakannya setelah serah terima, dan “tidak” adalah jawaban yang utuh dan tidak mengubah apa pun tentang cara kami bekerja dengan Anda.</p><p>Kalau Anda setuju, kita sepakati bersama apa yang ditampilkan: sebagian klien senang semuanya tampil, sebagian ingin bangunannya saja tanpa alamat, sebagian tidak ingin apa pun yang mengenali mereka.</p>`,
  },
];

/**
 * Lima yang disorot di beranda. Hanya id — kalimatnya tetap satu, di atas.
 */
export const SOROTAN_ID = [
  "do-you-work-with-clients",
  "how-much-do-you-charge",
  "how-long-does-it-take",
  "do-we-get-the-files",
  "do-you-visit-the-site"
];

export const SOROTAN_FAQ = SOROTAN_ID.map((id) => {
  const t = FAQ.find((x) => x.id === id);
  if (!t) throw new Error(`SOROTAN_ID menunjuk id yang tidak ada di FAQ: ${id}`);
  return t;
});
