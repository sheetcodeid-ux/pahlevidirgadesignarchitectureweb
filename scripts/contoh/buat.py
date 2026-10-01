"""Menyusun scripts/contoh/isi.sql dan hapus.sql — data contoh Jan–Sep 2026.

Setiap baris contoh ber-ID berawalan `c0de000N-`, jadi SATU perintah
(hapus.sql) membuang semuanya tanpa menyentuh data asli. Nilai asli proyek
yang ikut diubah (nilai kontrak, tahap) dikembalikan apa adanya di hapus.sql.
Email memakai example.com (domain cadangan RFC 2606) dan telepon dikosongkan:
tombol WhatsApp/email di panel tidak boleh sampai ke orang sungguhan.
Nama klien asli tidak dipakai untuk pesan karangan.
Jalankan: python3 scripts/contoh/buat.py
"""
from pathlib import Path

P = {  # proyek ASLI di produksi — tidak ada proyek baru
    "cano": "456d093b-9768-47d8-9f4a-c35a84a3abbe",
    "nordu": "dc6375e1-94d7-4be2-9f5e-d967b6c09f14",
    "sintang": "edb56d6a-ba39-44c1-868c-3bd543ff3daf",
    "skw": "411d2fdb-5207-4a2b-8eb8-0e1573042781",
    "tropic": "bed32d7b-cd0f-44f4-8737-57d4f4d9bc17",
    "elsana": "028ceac7-03fd-4496-817a-30d336f5f4b5",
}
AAN = "aa3c9c3c-e39a-4ef6-a880-b6e78d4db714"  # anggota tim asli

def cid(tabel, n):
    return f"c0de000{tabel}-0000-4000-8000-{n:012d}"

def q(v):
    if v is None:
        return "null"
    if isinstance(v, (int, float)):
        return str(v)
    return "'" + str(v).replace("'", "''") + "'"

sql = ["-- Data contoh Jan–Sep 2026. Dibuat scripts/contoh/buat.py — jangan disunting tangan.", ""]

# --- Proyek: nilai kontrak & tahap (asli dikembalikan di hapus.sql) -------
UBAH = [  # (proyek, kontrak baru, tahap baru, kontrak asli, tahap asli)
    ("nordu", 145_000_000, "desain_1", None, "proposal"),
    ("sintang", 120_000_000, "dp_50", None, "proposal"),
    ("skw", 120_000_000, "dp_50", None, "proposal"),
    ("tropic", 180_000_000, "finish", None, "dp_50"),
    ("elsana", 220_000_000, "desain_2", None, "desain_2"),
]
for k, nilai, tahap, _, _ in UBAH:
    sql.append(f"update public.projects set contract_value = {nilai}, pipeline_stage = '{tahap}' where id = '{P[k]}';")

# --- Tim ------------------------------------------------------------------
TIM = [  # kunci, nama, peran, jenis, tarif, telepon
    ("dirga", "Dirga Pahlevi", "Arsitek Prinsipal", "partner", None, None),
    ("yoga", "Yoga Prasetya", "Arsitek Junior", "inti", 6_500_000, None),
    ("sari", "Sari Ningsih", "Admin & Keuangan", "staf", 4_200_000, None),
    ("rizky", "Rizky Pratama", "Drafter", "proyek", None, None),
    ("nanda", "Nanda Wijaya", "Visualizer 3D", "proyek", None, None),
    ("bima", "Bima Saputra", "Konsultan Struktur", "proyek", None, None),
]
T = {"aan": AAN}
for i, (k, nama, peran, jenis, tarif, tlp) in enumerate(TIM, 1):
    T[k] = cid(5, i)
    sql.append(
        "insert into public.team_members (id, name, role, kind, rate, phone, active, created_at) values "
        f"({q(T[k])}, {q(nama)}, {q(peran)}, '{jenis}', {q(tarif)}, {q(tlp)}, true, '2026-01-05 09:00+07');"
    )

# --- Gaji (tabel payroll: hanya staf & inti; freelancer lewat biaya) -------
n = 0
for bulan in range(1, 10):
    n += 1
    sql.append(
        "insert into public.payroll (id, team_member_id, period, amount, paid_on, note) values "
        f"({q(cid(4, n))}, {q(T['sari'])}, '2026-{bulan:02d}-01', 4200000, '2026-{bulan:02d}-25', null);"
    )
for bulan in range(3, 10):
    n += 1
    gaji = 6_500_000 if bulan < 7 else 7_000_000
    catatan = "Naik setelah evaluasi Juni" if bulan == 7 else None
    sql.append(
        "insert into public.payroll (id, team_member_id, period, amount, paid_on, note) values "
        f"({q(cid(4, n))}, {q(T['yoga'])}, '2026-{bulan:02d}-01', {gaji}, '2026-{bulan:02d}-25', {q(catatan)});"
    )

# --- Tagihan & pembayaran -------------------------------------------------
# (proyek, label, nominal, status, tenggat, dibayar_pada, jenis, metode, penerima, catatan)
TAGIHAN = [
    ("tropic", "DP 30% — konsep", 54_000_000, "lunas", "2026-01-15", "2026-01-12 10:20+07", "dp", "transfer", "Dirga Pahlevi", "Transfer BCA"),
    ("tropic", "Termin 2 — desain skematik", 54_000_000, "lunas", "2026-03-25", "2026-03-20 14:05+07", "termin", "transfer", "Sari Ningsih", None),
    ("tropic", "Termin 3 — gambar kerja (DED)", 45_000_000, "lunas", "2026-06-15", "2026-06-10 11:40+07", "termin", "transfer", "Sari Ningsih", None),
    ("tropic", "Pelunasan", 27_000_000, "terbit", "2026-10-20", None, None, None, None, None),
    ("elsana", "DP 30% — konsep", 66_000_000, "lunas", "2026-02-20", "2026-02-18 09:15+07", "dp", "transfer", "Dirga Pahlevi", None),
    ("elsana", "Termin 2 — desain 1", 88_000_000, "lunas", "2026-05-30", "2026-05-25 16:30+07", "termin", "transfer", "Sari Ningsih", "Dibayar dua hari setelah presentasi"),
    ("elsana", "Termin 3 — desain 2", 44_000_000, "lunas", "2026-09-01", "2026-08-30 13:00+07", "termin", "qris", "Sari Ningsih", None),
    ("elsana", "Pelunasan — serah terima DED", 22_000_000, "draft", "2026-11-15", None, None, None, None, None),
    ("nordu", "DP 50%", 72_500_000, "lunas", "2026-04-25", "2026-04-22 10:45+07", "dp", "transfer", "Dirga Pahlevi", None),
    ("nordu", "Termin 2 — desain 1", 43_500_000, "lunas", "2026-07-31", "2026-07-28 15:20+07", "termin", "transfer", "Sari Ningsih", None),
    ("nordu", "Pelunasan", 29_000_000, "terbit", "2026-10-05", None, None, None, None, None),
    ("sintang", "DP 50%", 60_000_000, "lunas", "2026-06-20", "2026-06-16 11:10+07", "dp", "transfer", "Dirga Pahlevi", None),
    ("sintang", "Termin 2 — desain 1", 36_000_000, "terbit", "2026-09-25", None, None, None, None, None),
    ("sintang", "Pelunasan", 24_000_000, "draft", "2026-12-10", None, None, None, None, None),
    ("skw", "DP 50%", 60_000_000, "lunas", "2026-08-21", "2026-08-19 09:50+07", "dp", "tunai", "Sari Ningsih", "Tunai di kantor studio"),
    ("skw", "Termin 2 — desain", 60_000_000, "draft", "2026-11-30", None, None, None, None, None),
]
urut = {}
nb = 0
for i, (k, label, nominal, status, tenggat, bayar, jenis, metode, penerima, catatan) in enumerate(TAGIHAN, 1):
    urut[k] = urut.get(k, -1) + 1
    iid = cid(1, i)
    sql.append(
        "insert into public.invoices (id, project_id, label, amount, status, due_date, paid_at, sort_order, created_at) values "
        f"({q(iid)}, {q(P[k])}, {q(label)}, {nominal}, '{status}', {q(tenggat)}, {q(bayar)}, {urut[k]}, "
        f"({q(tenggat)}::date - interval '21 days'));"
    )
    if bayar:
        nb += 1
        sql.append(
            "insert into public.project_payments (id, project_id, invoice_id, amount, kind, method, receiver, note, paid_at, created_at) values "
            f"({q(cid(2, nb))}, {q(P[k])}, {q(iid)}, {nominal}, '{jenis}', '{metode}', {q(penerima)}, {q(catatan)}, {q(bayar)}, {q(bayar)});"
        )

# --- Biaya proyek ---------------------------------------------------------
# (proyek, keterangan, kategori, nominal, tanggal, orang)
BIAYA = [
    ("tropic", "Survei & ukur lokasi", "lainnya", 1_250_000, "2026-01-20", None),
    ("tropic", "Drafter gambar konsep", "freelancer", 6_500_000, "2026-02-10", "rizky"),
    ("tropic", "Render eksterior 8 frame", "freelancer", 9_600_000, "2026-03-15", "nanda"),
    ("tropic", "Perhitungan struktur", "freelancer", 12_000_000, "2026-04-08", "bima"),
    ("tropic", "Drafter gambar kerja", "freelancer", 8_500_000, "2026-05-12", "rizky"),
    ("tropic", "Fee prinsipal termin 2", "prinsipal", 13_500_000, "2026-05-30", "dirga"),
    ("tropic", "Cetak gambar kerja A1", "operasional", 1_850_000, "2026-06-18", None),
    ("tropic", "Fee arsitek proyek", "freelancer", 10_000_000, "2026-07-05", "aan"),
    ("tropic", "Fee prinsipal termin 3", "prinsipal", 11_250_000, "2026-08-14", "dirga"),
    ("elsana", "Survei lokasi & transport Singkawang", "lainnya", 2_400_000, "2026-02-25", None),
    ("elsana", "Drafter gambar konsep", "freelancer", 7_000_000, "2026-03-12", "rizky"),
    ("elsana", "Render interior 10 frame", "freelancer", 12_500_000, "2026-04-20", "nanda"),
    ("elsana", "Fee prinsipal termin 2", "prinsipal", 22_000_000, "2026-06-03", "dirga"),
    ("elsana", "Perhitungan struktur", "freelancer", 15_000_000, "2026-06-22", "bima"),
    ("elsana", "Maket studi 1:100", "operasional", 3_200_000, "2026-07-15", None),
    ("elsana", "Drafter gambar kerja", "freelancer", 9_500_000, "2026-08-10", "rizky"),
    ("elsana", "Fee arsitek proyek", "freelancer", 12_000_000, "2026-09-05", "aan"),
    ("elsana", "Fee prinsipal termin 3", "prinsipal", 11_000_000, "2026-09-12", "dirga"),
    ("nordu", "Survei lokasi & transport Tebas", "lainnya", 2_100_000, "2026-04-28", None),
    ("nordu", "Drafter gambar konsep", "freelancer", 6_000_000, "2026-05-15", "rizky"),
    ("nordu", "Render eksterior 6 frame", "freelancer", 7_500_000, "2026-06-25", "nanda"),
    ("nordu", "Fee prinsipal termin 2", "prinsipal", 10_900_000, "2026-08-05", "dirga"),
    ("nordu", "Drafter gambar kerja", "freelancer", 7_500_000, "2026-09-18", "rizky"),
    ("sintang", "Survei lokasi & transport Sintang", "lainnya", 3_100_000, "2026-06-24", None),
    ("sintang", "Drafter gambar konsep", "freelancer", 5_500_000, "2026-07-20", "rizky"),
    ("sintang", "Render eksterior 5 frame", "freelancer", 6_800_000, "2026-08-25", "nanda"),
    ("sintang", "Fee prinsipal DP", "prinsipal", 9_000_000, "2026-09-26", "dirga"),
    ("skw", "Survei lokasi & dokumentasi", "lainnya", 1_900_000, "2026-08-27", None),
    ("skw", "Drafter gambar konsep", "freelancer", 5_500_000, "2026-09-15", "rizky"),
    ("cano", "Render interior 6 frame", "freelancer", 8_200_000, "2026-09-10", "nanda"),
    ("cano", "Cetak & jilid presentasi", "operasional", 750_000, "2026-09-20", None),
    ("cano", "Fee prinsipal DP", "prinsipal", 7_500_000, "2026-09-28", "dirga"),
]
for i, (k, label, kat, nominal, tgl, orang) in enumerate(BIAYA, 1):
    sql.append(
        "insert into public.project_costs (id, project_id, label, category, amount, incurred_on, team_member_id, created_at) values "
        f"({q(cid(3, i))}, {q(P[k])}, {q(label)}, '{kat}', {nominal}, '{tgl}', {q(T[orang] if orang else None)}, '{tgl} 15:00+07');"
    )

# --- Tugas ----------------------------------------------------------------
# (proyek, judul, tahap, status, tenggat, orang)
TUGAS = [
    ("tropic", "Render final 8 frame", "desain_2", "selesai", "2026-03-14", "nanda"),
    ("tropic", "Revisi gambar kerja tampak depan", "finish", "berjalan", "2026-10-03", "yoga"),
    ("tropic", "Koordinasi jadwal kontraktor pelaksana", "finish", "menunggu_klien", "2026-10-08", "dirga"),
    ("tropic", "Serah terima gambar final", "pelunasan", "belum_mulai", "2026-10-15", "rizky"),
    ("elsana", "Detail fasad & secondary skin", "desain_2", "berjalan", "2026-10-06", "yoga"),
    ("elsana", "Gambar MEP listrik & plumbing", "desain_2", "review_internal", "2026-09-30", "rizky"),
    ("elsana", "Presentasi desain 2 ke klien", "desain_2", "menunggu_klien", "2026-10-10", "dirga"),
    ("elsana", "Susun RAB tahap 2", "desain_2", "belum_mulai", "2026-10-20", "sari"),
    ("nordu", "Survei ulang kontur tapak", "dp_50", "selesai", "2026-08-02", "aan"),
    ("nordu", "Konsep layout bar & dapur", "desain_1", "berjalan", "2026-10-04", "yoga"),
    ("nordu", "Render suasana malam", "desain_1", "belum_mulai", "2026-10-12", "nanda"),
    ("nordu", "Perhitungan struktur kanopi", "desain_1", "belum_mulai", "2026-10-18", "bima"),
    ("sintang", "Zoning & sirkulasi pengunjung", "dp_50", "berjalan", "2026-10-02", "aan"),
    ("sintang", "Moodboard material & warna", "dp_50", "review_internal", "2026-09-27", "yoga"),
    ("sintang", "Tagih termin 2 ke klien", "dp_50", "belum_mulai", "2026-09-26", "sari"),
    ("skw", "Survei lokasi & dokumentasi", "dp_50", "selesai", "2026-08-27", "aan"),
    ("skw", "Konsep denah awal", "dp_50", "berjalan", "2026-10-07", "rizky"),
    ("cano", "Detail bar counter & back bar", "deal_kontrak", "berjalan", "2026-10-05", "yoga"),
    ("cano", "Pilih lampu dekoratif bersama klien", "deal_kontrak", "menunggu_klien", "2026-10-09", "dirga"),
]
for i, (k, judul, tahap, status, tenggat, orang) in enumerate(TUGAS, 1):
    sql.append(
        "insert into public.project_tasks (id, project_id, title, stage, status, due_date, assignee_id, sort_order, created_at) values "
        f"({q(cid(6, i))}, {q(P[k])}, {q(judul)}, '{tahap}', '{status}', '{tenggat}', {q(T[orang])}, {i}, "
        f"('{tenggat}'::date - interval '14 days'));"
    )

# --- Pesan masuk ----------------------------------------------------------
UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1"
PESAN = [  # nama, email, telepon, jenis, anggaran, pesan, status, waktu
    ("Hendra Wijaya", "hendra.wijaya82@example.com", None, "commercial", "Rp250 – 500 jt",
     "Selamat siang, kami sedang mencari arsitek untuk coffee shop dua lantai di Jl. Gajah Mada, luas bangunan sekitar 180 m². Apakah studio menerima proyek di Pontianak kota? Kami ingin buka sebelum Lebaran.", "closed", "2026-01-08 10:12+07"),
    ("Wahyu Saputra", "wahyu.saputra@example.com", None, "commercial", "Rp100 – 250 jt",
     "Halo, kami ingin membuka cabang kedua kedai kami. Konsepnya kurang lebih sama dengan cabang pertama tapi lahannya lebih sempit. Bisa diskusi minggu ini?", "closed", "2026-01-05 19:40+07"),
    ("Maria Susanti", "maria.susanti@example.com", None, "interior", "Rp50 – 100 jt",
     "Saya ingin renovasi interior dapur dan ruang makan rumah di Kota Baru. Kira-kira berapa lama proses desainnya dan apakah termasuk pengawasan?", "closed", "2026-02-03 08:55+07"),
    ("Dimas Pratama", "dimas.pratama@example.com", None, "residential", "Rp100 – 250 jt",
     "Rumah peninggalan orang tua, dibangun tahun 1990-an, ingin direnovasi supaya lebih terang dan tidak lembap. Apakah bisa survei dulu sebelum penawaran?", "contacted", "2026-03-11 21:15+07"),
    ("Yuliana Effendi", "yuliana.effendi@example.com", None, "commercial", "Rp250 – 500 jt",
     "Kami ingin membuka cabang restoran di Singkawang. Butuh desain bangunan baru sekaligus interior. Mohon info paket dan jadwal kosong studio.", "closed", "2026-02-09 13:30+07"),
    ("Kevin Gunawan", "kevin.gunawan@example.com", None, "residential", "Rp500 jt – Rp1 M",
     "Rencana bangun rumah tinggal 2 lantai di Sungai Raya Dalam, luas tanah 15 x 30. Ingin gaya tropis modern dengan banyak bukaan. Bisa minta portofolio rumah tinggal?", "qualified", "2026-04-14 07:48+07"),
    ("Hartono Wijaya", "hartono.wijaya@example.com", None, "commercial", "Di atas Rp1 M",
     "Kami mengelola beberapa outlet F&B dan ada tiga lokasi baru tahun ini di luar Pontianak. Mohon dijadwalkan pertemuan untuk membahas paket beberapa proyek sekaligus.", "closed", "2026-03-28 16:05+07"),
    ("Rahmat Hidayat", "rahmat.hidayat@example.com", None, "renovation", "Rp50 – 100 jt",
     "Ruko 3 lantai di Jl. Tanjungpura mau diubah lantai bawahnya jadi kafe kecil. Apakah studio menangani renovasi skala kecil?", "contacted", "2026-05-19 11:22+07"),
    ("Fransiska Ayu", "fransiska.ayu@example.com", None, "interior", "Rp100 – 250 jt",
     "Butuh desain interior klinik kecantikan sekitar 90 m², target buka akhir tahun. Apakah bisa sampai gambar kerja untuk kontraktor?", "qualified", "2026-06-23 14:40+07"),
    ("PT Kapuas Lestari", "procurement@example.com", None, "masterplan", "Di atas Rp1 M",
     "Kami membutuhkan masterplan untuk kawasan guest house dan restoran di tepi Sungai Kapuas, luas lahan sekitar 1,2 ha. Mohon kirimkan company profile.", "contacted", "2026-07-30 09:05+07"),
    ("Steven Tan", "steven.tan88@example.com", None, "commercial", "Rp250 – 500 jt",
     "Mau konsultasi desain roastery sekaligus coffee bar, bangunan eksisting gudang 12 x 24 m. Kapan bisa survei?", "qualified", "2026-08-18 20:10+07"),
    ("Nurul Fadilah", "nurul.fadilah@example.com", None, "residential", "Rp100 – 250 jt",
     "Rumah tipe 70 di perumahan, ingin tambah lantai 2 untuk kamar anak. Apakah perlu perhitungan struktur ulang? Terima kasih.", "closed", "2026-09-02 10:30+07"),
    ("Andre Kurniawan", "andre.kurniawan@example.com", None, "commercial", "Rp250 – 500 jt",
     "Kami berencana membuka kedai kopi dengan konsep semi-outdoor di Jl. Ahmad Yani. Lahan sudah ada, butuh desain dan estimasi biaya. Bisa dibantu minggu depan?", "new", "2026-09-29 15:42+07"),
    ("Lestari Wulandari", "lestari.wulan@example.com", None, "residential", "Rp500 jt – Rp1 M",
     "Halo, saya berencana membangun rumah dua lantai di Sungai Raya, luas tanah 12 x 25 m. Kami ingin rumah yang sejuk tanpa terlalu bergantung pada AC. Apakah bisa dari konsep sampai gambar kerja?", "new", "2026-09-30 21:03+07"),
]
for i, (nama, email, tlp, jenis, anggaran, pesan, status, waktu) in enumerate(PESAN, 1):
    sql.append(
        "insert into public.inquiries (id, name, email, phone, project_type, budget_range, message, status, source, ip_hash, user_agent, created_at) values "
        f"({q(cid(7, i))}, {q(nama)}, {q(email)}, {q(tlp)}, '{jenis}', {q(anggaran)}, {q(pesan)}, '{status}', 'website', "
        f"encode(sha256(convert_to({q(email)}, 'UTF8')), 'hex'), {q(UA)}, {q(waktu)});"
    )

# --- Direktori ------------------------------------------------------------
KONTAK = [
    ("Hadi Kurniawan", "kontraktor", "CV Borneo Karya Konstruksi", None, "hadi@example.com", "Kontraktor pelaksana TROPIC 2ND. Responsif, tim 12 orang."),
    ("Yanti Susilo", "supplier", "PT Sinar Kapuas Baja Ringan", None, "sales@example.com", "Rangka atap & kanopi. Harga sudah termasuk antar dalam kota."),
    ("Aseng", "supplier", "Toko Bangunan Sumber Rejeki", None, None, "Semen, bata ringan, keramik. Bisa tempo 14 hari."),
    ("Rudi Hartono", "supplier", "Lumina Lighting Pontianak", None, "rudi@example.com", "Lampu dekoratif & track light. Rekomendasi untuk CANO."),
    ("Joko Santoso", "kontraktor", None, None, None, "Mandor borongan, spesialis finishing kayu & plafon."),
    ("Studio Foto Ruang", "lainnya", "Ruang Visual", None, "halo@example.com", "Fotografer arsitektur untuk dokumentasi proyek selesai."),
]
for i, (nama, kat, perus, tlp, email, catatan) in enumerate(KONTAK, 1):
    sql.append(
        "insert into public.directory_contacts (id, name, category, company, phone, email, note) values "
        f"({q(cid(8, i))}, {q(nama)}, '{kat}', {q(perus)}, {q(tlp)}, {q(email)}, {q(catatan)});"
    )

d = Path(__file__).parent
(d / "isi.sql").write_text("\n".join(sql) + "\n")

hapus = [
    "-- Membuang SELURUH data contoh (ID berawalan c0de000) dan mengembalikan nilai",
    "-- proyek yang diubah ke aslinya. Aman dijalankan berulang.",
    "delete from public.project_payments where id::text like 'c0de000%';",
    "delete from public.invoices where id::text like 'c0de000%';",
    "delete from public.project_costs where id::text like 'c0de000%';",
    "delete from public.payroll where id::text like 'c0de000%';",
    "delete from public.project_tasks where id::text like 'c0de000%';",
    "delete from public.inquiries where id::text like 'c0de000%';",
    "delete from public.directory_contacts where id::text like 'c0de000%';",
    "delete from public.team_members where id::text like 'c0de000%';",
]
for k, _, _, kontrak_asli, tahap_asli in UBAH:
    hapus.append(f"update public.projects set contract_value = {q(kontrak_asli)}, pipeline_stage = '{tahap_asli}' where id = '{P[k]}';")
(d / "hapus.sql").write_text("\n".join(hapus) + "\n")
print(len(sql), "baris isi;", len(hapus), "baris hapus")
