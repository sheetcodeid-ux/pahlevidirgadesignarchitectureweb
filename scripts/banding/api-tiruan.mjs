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
    teamMemberId: null,
    teamMemberName: null,
  };
});

const profil = { id: "u1", email: "dirga@contoh.id", name: "Dirga Pahlevi", role: "master" };

/* Proyek versi ADMIN — beda bentuk dari `proyek` di atas, yang meniru
   endpoint publik. Yang ini memuat contractValue dan paidTotal, dua kolom
   yang dibaca halaman Terima Pembayaran untuk menghitung sisa tagihan. */
const proyekAdmin = proyekKeu.map((p, i) => ({
  id: p.projectId,
  slug: `proyek-${i + 1}`,
  title: p.projectTitle,
  category: i % 2 ? "residential" : "hospitality",
  status: "published",
  city: "Pontianak",
  client: ["Bu Ratna", "Pak Hendra", "Bakmi Hauw", "Notaris Ahmad", "PT Kapuas Jaya"][i],
  isFeatured: i === 0,
  contractValue: p.contractValue,
  paidTotal: p.received,
  pipelineStage: "konstruksi",
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
          note: null,
          paidAt: d.toISOString(),
          receiptToken: `tok${i}${j}`,
        };
      }),
    ];
  }),
);

const jawab = (path) => {
  if (path.startsWith("/api/v1/admin/me")) return profil;
  if (path.startsWith("/api/v1/admin/finance/overview")) return ringkasanKeu;
  if (path.startsWith("/api/v1/admin/finance/monthly")) return bulananKeu;
  if (path.startsWith("/api/v1/admin/costs")) return biayaKeu;
  /* Yang PALING KHUSUS lebih dulu: "/admin/projects/<id>/payments" juga
     berawalan "/admin/projects", jadi urutan terbalik membuat daftar
     pembayaran dijawab dengan daftar proyek — dan halamannya menggambar
     kartu pembayaran berisi judul proyek tanpa satu pun galat. */
  {
    const m = path.match(/^\/api\/v1\/admin\/projects\/([^/?]+)\/payments/);
    if (m) return bayarAdmin[m[1]] ?? [];
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

createServer((req, res) => {
  const path = (req.url || "/").split("#")[0];
  res.writeHead(200, {
    "content-type": "application/json",
    "access-control-allow-origin": "*",
  });
  res.end(JSON.stringify({ data: jawab(path) }));
}).listen(PORT, () => console.log(`api tiruan: http://127.0.0.1:${PORT}`));
