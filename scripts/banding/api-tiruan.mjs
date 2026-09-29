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
  phone: "",
  whatsapp: "",
  instagram: "",
  address: "",
  logoUrl: null,
  timezone: "Asia/Jakarta",
};

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
  phone: null,
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


const profil = { id: "u1", email: "dirga@contoh.id", name: "Dirga Pahlevi", role: "master" };

/* Proyek versi ADMIN — beda bentuk dari `proyek` di atas, yang meniru
   endpoint publik. Yang ini memuat contractValue dan paidTotal, dua kolom
   yang dibaca halaman Terima Pembayaran untuk menghitung sisa tagihan. */
const proyekAdmin = proyekKeu.map((p, i) => ({
  id: p.projectId,
  slug: `proyek-${i + 1}`,
  title: p.projectTitle,
  category: i % 2 ? "residential" : "hospitality",
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

const jawab = (path) => {
  if (path.startsWith("/api/v1/admin/me")) return profil;
  if (path.startsWith("/api/v1/admin/finance/overview")) return ringkasanKeu;
  if (path.startsWith("/api/v1/admin/finance/monthly")) return bulananKeu;
  if (path.startsWith("/api/v1/admin/costs")) return [...biayaKeu, ...biayaRiwayat];
  if (path.startsWith("/api/v1/admin/inquiries")) return pesanAdmin;
  if (path.startsWith("/api/v1/admin/fee/people")) return feeOrang(path);
  if (path.startsWith("/api/v1/admin/fee/projects")) return feeProyek(path);
  if (path.startsWith("/api/v1/admin/team")) return timAdmin;
  if (path.startsWith("/api/v1/admin/invoices")) return tagihanAdmin;
  /* Yang PALING KHUSUS lebih dulu: "/admin/projects/<id>/payments" juga
     berawalan "/admin/projects", jadi urutan terbalik membuat daftar
     pembayaran dijawab dengan daftar proyek — dan halamannya menggambar
     kartu pembayaran berisi judul proyek tanpa satu pun galat. */
  {
    const m = path.match(/^\/api\/v1\/admin\/projects\/([^/?]+)\/tasks/);
    if (m) return tugasAdmin[m[1]] ?? [];
  }
  if (path.startsWith("/api/v1/admin/tasks")) return Object.values(tugasAdmin).flat();
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
  if (path.startsWith("/api/v1/journal")) return [];
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
  const m = path.match(/^\/api\/v1\/admin\/invoices\/([^/?]+)$/);
  if (m && metode === "PATCH") {
    const t = tagihanAdmin.find((x) => x.id === m[1]);
    if (!t) return { galat: 404 };
    if (badan.status) t.status = badan.status;
    return { updated: true };
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
    "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS",
    "access-control-allow-headers": "content-type,authorization",
  };
  if (metode === "OPTIONS") {
    res.writeHead(204, kepala);
    return res.end();
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
        return res.end(JSON.stringify({ error: { status: hasil.galat, message: "tidak ada" } }));
      }
      res.writeHead(hasil ? 200 : 201, kepala);
      res.end(JSON.stringify({ data: hasil ?? { id: "baru" } }));
    });
  }
  res.writeHead(200, kepala);
  res.end(JSON.stringify({ data: jawab(path) }));
}).listen(PORT, () => console.log(`api tiruan: http://127.0.0.1:${PORT}`));
