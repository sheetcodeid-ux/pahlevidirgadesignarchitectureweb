"""Wireframe 14 halaman admin, digambar dari ukuran frame Figma-nya sendiri.

    python3 scripts/buat-wireframe.py

Hasilnya `docs/wireframe/coinest.html` — satu berkas berisi empat belas
kerangka halaman, masing-masing pada proporsi framenya.

Kenapa digenerate dan bukan digambar tangan: angkanya harus datang dari
ekspor SVG framenya, bukan dari mengira-ngira tangkapan layar. Wireframe
yang proporsinya karangan tidak bisa dipakai menilai apa pun, dan justru
memberi rasa aman palsu — halamannya nanti dibangun mengikuti kerangka yang
salah, lalu salahnya baru ketahuan setelah empat belas halaman jadi.

Tiap wilayah membawa TIGA keterangan sekaligus:

  1. nama layer Figma-nya, supaya bisa dilacak balik ke framenya
  2. komponen kit yang akan mengisinya (keluarga `k-`)
  3. isi SUNGGUHAN kita — bukan isi Coinest

Yang ketiga yang paling penting. Coinest aplikasi keuangan pribadi; studio
arsitektur tidak punya "watchlist saham" atau "saving plan". Memetakannya
mentah-mentah berarti membangun empat belas halaman yang bentuknya benar dan
isinya tidak ada gunanya. Pemetaan di bawah ini sudah ditetapkan pemilik
lewat tabel di CLAUDE.md; yang ditambahkan di sini cuma turunannya
per-wilayah.
"""
import html
import pathlib

AKAR = pathlib.Path(__file__).resolve().parent.parent
KELUAR = AKAR / "docs/wireframe/coinest.html"

# --- Kerangka bersama, diukur sama di seluruh frame -------------------------
# Bingkai 1440. Rel samping 0..192. Kolom konten 220..1412 (1192), jadi
# talangnya 28 di kiri kolom dan 28 di tepi kanan bingkai.
BINGKAI = 1440
REL = 192
KONTEN_X = 220
KONTEN_W = 1192
KEPALA_Y, KEPALA_H = 22, 38          # Header — kepala halaman
KAKI_H = 19.5                        # Footer

# (nama layer Figma, x, y, lebar, tinggi, komponen kit, isi kita)
HALAMAN = [
    {
        "kunci": "01",
        "frame": "01. Dashboard (v1)",
        "halaman": "/admin — Hari Ini",
        "tinggi": 1072,
        "catatan": "Frame ini BELUM diekspor pemilik. Kerangkanya disusun dari "
                   "spesifikasi enam bagiannya yang sudah ditarik lebih dulu "
                   "(kiri 3:1127, statistik 3:1188, kolom grafik 3:1210, kanan "
                   "3:1245, kepala seksi 11:1745) — jadi proporsinya benar, "
                   "tapi ia satu-satunya yang belum bisa ditumpuk dengan "
                   "gambar framenya.",
        "wilayah": [
            ("Section Statistic", 220, 80, 585, 191, "KartuStatistik x2",
             "Proyek berjalan · Tagihan jatuh tempo"),
            ("Widget Chart", 220, 292, 585, 313, "KolomGrafik + LabelYGrafik",
             "Kas masuk vs beban, 12 bulan"),
            ("Widget Right", 826, 80, 282, 525, "Kartu + daftar",
             "Pesan masuk belum dibaca"),
            ("Widget Balance", 1129, 80, 282, 525, "KartuKas",
             "Saldo kas studio"),
            ("Widget Transaction", 220, 626, 585, 379, "Tabel (bentuk listbar)",
             "Pembayaran terakhir"),
            ("Section Activity", 826, 626, 282, 379, "BarisAktivitas",
             "Aktivitas proyek hari ini"),
            ("Section Plans", 1129, 626, 282, 379, "BarisTagar / BarisPenulis",
             "Tenggat terdekat"),
        ],
    },
    {
        "kunci": "04",
        "frame": "04. Dashboard (v2)",
        "halaman": "Keuangan — Ringkasan",
        "tinggi": 1072,
        "wilayah": [
            ("Section Statistic", 220.5, 80.5, 585, 191, "KartuStatistik x4 (2x2)",
             "Kas masuk · Beban · Laba berjalan · Piutang"),
            ("Widget Cashflow", 220.5, 292.5, 585, 313, "Grafik area — BELUM ADA",
             "Kas masuk vs beban, dua garis berisi"),
            ("Widget Expense Breakdown", 826.5, 80.5, 282, 525, "Donat + BarisAset",
             "Beban per kategori, tangga --ramp-1..5"),
            ("Widget Finance Score", 1129, 80, 283, 151, "Kartu + bar kemajuan — BELUM ADA",
             "Kesehatan kas: berapa bulan beban tertutup"),
            ("Widget Balance", 1129.5, 251.5, 282, 354, "KartuKas x2",
             "Saldo kas studio, per rekening"),
            ("Widget Transaction", 220.5, 626.5, 585, 379, "Tabel (listbar)",
             "Transaksi terakhir"),
            ("Widget Saving Plans", 826.5, 626.5, 282, 379, "Kartu + bar kemajuan — BELUM ADA",
             "Termin per proyek: sudah ditagih vs nilai kontrak"),
            ("Section Plans", 1129.5, 626.5, 282, 379, "BarisAktivitas",
             "Aktivitas terakhir, berkelompok Hari ini / Kemarin"),
        ],
    },
    {
        "kunci": "07",
        "frame": "07. Transfer",
        "halaman": "Terima Pembayaran",
        "tinggi": 1024,
        "wilayah": [
            ("Button Group", 220, 80, 303, 72, "Segmen",
             "DP · Termin · Pelunasan"),
            ("Section Transfer List", 220, 168, 303, 793, "BarisTransfer",
             "Proyek yang menunggu pembayaran"),
            ("Section Recent Transfer", 559.5, 96.5, 836, 139, "BarisTransfer (varian Account)",
             "Pembayaran terakhir masuk"),
            ("Transfer Form", 559.5, 252.5, 836, 685, "Isian + Select + Tombol",
             "Form terima pembayaran: nominal, metode, penerima, nomor bukti"),
        ],
    },
    {
        "kunci": "10",
        "frame": "10. Payment",
        "halaman": "Catat Pengeluaran",
        "tinggi": 1024,
        "wilayah": [
            ("Button Group", 220, 80, 303, 72, "Segmen",
             "Biaya proyek · Beban operasional · Gaji"),
            ("Section Transfer List", 220, 168, 303, 790, "BarisPenyedia",
             "Kategori beban, bisa dibuka"),
            ("Section Recent Transfer", 559.5, 96.5, 836, 139, "BarisTransfer (varian Provider)",
             "Pengeluaran terakhir"),
            ("Transfer Form", 559.5, 252.5, 836, 689, "Isian + Select + Tombol",
             "Form catat beban: label, kategori, nominal, dibayar ke siapa, proyek"),
        ],
    },
    {
        "kunci": "13",
        "frame": "13. Transactions",
        "halaman": "Semua Transaksi",
        "tinggi": 1075,
        "wilayah": [
            ("Header-Section", 236.5, 96, 1159.5, 32, "KepalaSeksi",
             "Judul, cari, saring periode, saring proyek, ekspor"),
            ("Table", 236, 156, 1139, 793, "Tabel (bentuk kartu) — 12 baris 65px",
             "Kas masuk dan beban jadi satu daftar, berlencana arah"),
            ("Footer / Section Result", 236.6, 965, 157.4, 28, "teks",
             "“Menampilkan 12 dari N”"),
            ("Footer / Pagination", 1142, 965, 254, 28, "Paginasi", "—"),
        ],
    },
    {
        "kunci": "16",
        "frame": "16. Invoices",
        "halaman": "Tagihan & Termin",
        "tinggi": 1126,
        "wilayah": [
            ("Card Statistic Invoice", 220.5, 80.5, 385.7, 88, "KartuStatistik",
             "Sudah dibayar"),
            ("Card Statistic Invoice 2", 623.2, 80.5, 385.7, 88, "KartuStatistik",
             "Menunggu pembayaran"),
            ("Card Statistic Invoice 3", 1025.8, 80.5, 385.7, 88, "KartuStatistik",
             "Lewat tenggat"),
            ("Header-Section", 220, 189, 1192, 33, "KepalaSeksi",
             "Judul, saring status, Tagihan Baru"),
            ("Table", 220.5, 241.5, 1191, 770, "Tabel (kartu) + Lencana pil",
             "Termin per proyek: nomor, klien, nominal, jatuh tempo, status"),
            ("Footer", 220.6, 1032, 1191.4, 28, "Paginasi", "—"),
        ],
    },
    {
        "kunci": "19",
        "frame": "19. Cards",
        "halaman": "Semua Proyek",
        "tinggi": 1024,
        "wilayah": [
            ("Section My Cards / Header", 237, 105.5, 247, 16, "KepalaSeksi", "“Proyek” + Proyek Baru"),
            ("List Card", 236, 144, 251, 519, "KartuKas (satu per proyek)",
             "Kartu proyek: nama, klien, nilai kontrak, fase"),
            ("Widget Card Details", 523.5, 80.5, 282, 217, "Kartu",
             "Ringkasan proyek terpilih"),
            ("Section Spending", 523.5, 318.5, 282, 118, "KartuStatistik",
             "Beban proyek itu bulan ini"),
            ("Widget Cashflow", 826.5, 80.5, 585, 356, "KolomGrafik",
             "Kas masuk proyek per termin"),
            ("Widget Transaction", 523.5, 457.5, 888, 500, "Tabel (listbar)",
             "Pembayaran dan beban proyek itu"),
        ],
    },
    {
        "kunci": "22",
        "frame": "22. Saving Plans",
        "halaman": "Satu Proyek",
        "tinggi": 1099,
        "wilayah": [
            ("Card Statistic 1", 220.5, 80.5, 385.7, 87, "Kartu lebar + Tren + TombolBulat", "Nilai kontrak"),
            ("Card Statistic 2", 623.2, 80.5, 385.7, 87, "Kartu lebar + Tren + TombolBulat", "Sudah diterima"),
            ("Card Statistic 3", 1025.8, 80.5, 385.7, 87, "Kartu lebar + Tren + TombolBulat", "Laba bersih berjalan"),
            ("Horizontal Line", 220, 188, 1192, 1, "garis", "—"),
            ("Section Plans", 220.5, 208.5, 383, 824, "Kartu + bar kemajuan — BELUM ADA",
             "Fase proyek dan kemajuannya, yang aktif bertanda"),
            ("Plan Details", 623.5, 208.5, 788, 824, "Kartu + grafik area + Tabel",
             "Detail fase: tenggat, tim, kemajuan, lalu tabel biaya"),
        ],
    },
    {
        "kunci": "25",
        "frame": "25. Investments",
        "halaman": "Fee Proyek & Gaji",
        "tinggi": 1024,
        "wilayah": [
            ("Widget Portfolio Value", 220.5, 80.5, 585, 372, "Grafik area bertangga — BELUM ADA",
             "Total fee terbayar, per bulan"),
            ("Widget Profits", 826.5, 80.5, 585, 372, "KolomGrafik (tumpuk, berlabel nilai)",
             "Fee per tahun, dipecah per peran"),
            ("Widget Watchlist", 220.5, 473.5, 282, 484, "BarisPantau",
             "Orang: tim dan freelancer"),
            ("Widget Assets", 523.5, 473.5, 282, 484, "Busur — BELUM ADA + BarisAset",
             "Fee per peran, tangga --ramp"),
            ("Widget My Portfolio", 826.5, 473.5, 585, 484, "Tabel (listbar)",
             "Rincian bayaran: siapa, proyek, nominal, tanggal"),
        ],
    },
    {
        "kunci": "28",
        "frame": "28. Inbox",
        "halaman": "Pesan Masuk",
        "tinggi": 1120,
        "wilayah": [
            ("Left Section / Transfer List", 221, 96, 338, 942, "BarisPesan",
             "Daftar percakapan — belum dibaca berlencana"),
            ("Header", 559, 96, 837, 64, "KepalaHalaman + TombolBulat",
             "Nama pengirim, status, aksi"),
            ("Message", 559.5, 160, 836, 877.5, "Gelembung",
             "Isi percakapan dengan calon klien"),
        ],
    },
    {
        "kunci": "31",
        "frame": "31. Promos",
        "halaman": "Paket Layanan (6 tier)",
        "tinggi": 1078,
        "wilayah": [
            ("Header-Section", 220.5, 80, 1191.5, 32, "KepalaSeksi",
             "Judul + saring segmen (kafe / rumah)"),
            ("Row 1", 220.5, 136.5, 1191, 275, "Kartu x3",
             "Tier 1–3 dengan rentang fee dari lib/tier.ts"),
            ("Row 2", 220.5, 436.5, 1191, 275, "Kartu x3", "Tier 4–6"),
            ("Row 3", 220.5, 736.5, 1191, 275, "Kartu x3",
             "Baris cadangan — kalau tier bertambah"),
        ],
    },
    {
        "kunci": "34",
        "frame": "34. Promo Details",
        "halaman": "Detail satu tier",
        "tinggi": 1710,
        "wilayah": [
            ("Img Promos", 248, 74, 1136, 546, "gambar sampul",
             "Foto karya yang mewakili tier itu"),
            ("Main Section", 321, 603, 724, 960, "teks + daftar",
             "Apa yang termasuk, tidak termasuk, dan berapa lama"),
            ("Side Section", 1101, 608, 210, 767, "Kartu lengket",
             "Rentang fee, tombol Pakai Tier Ini"),
        ],
    },
    {
        "kunci": "37",
        "frame": "37. Insights",
        "halaman": "Jurnal",
        "tinggi": 1037,
        "wilayah": [
            ("Categories", 220, 80, 951, 30, "KepingKategori",
             "Kategori tulisan, satu aktif"),
            ("Section Featured Articles", 220, 139.5, 581, 364.5, "Kartu besar",
             "Tulisan yang disorot"),
            ("Section Recent Articles", 825, 139.5, 280.8, 364.5, "BarisPenulis",
             "Tulisan terbaru"),
            ("Section Popular Articles", 220, 533.5, 888, 166.5, "BarisTagar",
             "Yang paling banyak dibaca"),
            ("Section Recommended", 220, 729.5, 888, 241, "Kartu x3",
             "Tulisan berencana, bertanda “belum ditulis”"),
        ],
    },
    {
        "kunci": "40",
        "frame": "40. Insight Details",
        "halaman": "Satu tulisan",
        "tinggi": 2429,
        "wilayah": [
            ("Title & Subtitle", 424.9, 132.6, 782, 124.4, "judul + kepala",
             "Judul tulisan, ringkasan, tanggal"),
            ("Img Insights", 248, 268.9, 1136, 680.2, "gambar sampul", "Sampul tulisan"),
            ("Article", 321, 966.8, 724, 973.2, "markdown terender",
             "Isi tulisan — heading-nya jadi daftar isi"),
            ("Side Section", 1101, 961, 210, 482, "rel lengket",
             "Daftar isi, dari heading yang sama"),
            ("Section Related Contents", 248, 2031, 1136, 268, "Kartu x3",
             "Tulisan lain"),
        ],
    },
]

CSS = """
:root {
  --kertas:#f2f2f1; --putih:#fff; --garis:#c9c9c7; --tipis:#e2e2e0;
  --isi:#f7f7f6; --balok:#dadad8; --kuat:#a9a9a7; --anotasi:#84847f;
  --label:#3a3a38; --rel:#e8efe6; --sorot:#1E4841;
}
*{box-sizing:border-box}
body{margin:0;padding:32px;background:var(--kertas);color:var(--label);
  font:13px/1.45 system-ui,-apple-system,"Segoe UI",sans-serif}
h1{font-size:20px;margin:0 0 4px}
.kop{max-width:1180px;margin:0 auto 28px}
.kop p{margin:6px 0;max-width:72ch}
.hal{max-width:1180px;margin:0 auto 34px;background:var(--putih);
  border:1px solid var(--garis);border-radius:14px;padding:16px 18px 20px}
.judul{display:flex;align-items:baseline;gap:12px;flex-wrap:wrap;margin-bottom:12px}
.judul b{font-size:15px}
.judul .frame{font:11px ui-monospace,Menlo,monospace;color:var(--anotasi)}
.judul .arah{margin-left:auto;font:11px ui-monospace,Menlo,monospace;color:var(--sorot)}
.catatan{margin:0 0 12px;padding:8px 10px;border-left:3px solid var(--kuat);
  background:var(--isi);font-size:12px;max-width:80ch}
.bingkai{position:relative;width:100%;background:var(--isi);
  border:1px solid var(--tipis);border-radius:10px;overflow:hidden}
.w{position:absolute;background:var(--putih);border:1px solid var(--garis);
  border-radius:8px;padding:6px 8px;overflow:hidden}
.w .n{font:10px/1.25 ui-monospace,Menlo,monospace;color:var(--anotasi);
  text-transform:uppercase;letter-spacing:.04em}
.w .k{font-size:11px;font-weight:600;color:var(--sorot);margin-top:3px;line-height:1.25}
.w .i{font-size:11px;color:var(--label);margin-top:2px;line-height:1.3}
.w .u{position:absolute;right:6px;bottom:4px;font:9px ui-monospace,Menlo,monospace;
  color:var(--kuat)}
.rel{position:absolute;left:0;top:0;bottom:0;background:var(--rel);
  border-right:1px solid var(--tipis)}
.rel span{position:absolute;top:10px;left:0;right:0;text-align:center;
  font:10px ui-monospace,Menlo,monospace;color:var(--anotasi)}
.bar{position:absolute;background:var(--balok);border-radius:6px}
.bar span{position:absolute;inset:0;display:flex;align-items:center;
  padding:0 8px;font:10px ui-monospace,Menlo,monospace;color:#5d5d5a}
table{border-collapse:collapse;font-size:12px;margin-top:10px;width:100%}
th,td{border-top:1px solid var(--tipis);padding:5px 8px;text-align:left;vertical-align:top}
th{color:var(--anotasi);font-weight:600}
code{font:11px ui-monospace,Menlo,monospace;background:var(--isi);padding:1px 4px;border-radius:3px}
"""


def gambar(h):
    """Satu kerangka halaman, digambar pada proporsi framenya."""
    t = h["tinggi"]
    pct_x = lambda v: f"{v / BINGKAI * 100:.3f}%"
    pct_y = lambda v: f"{v / t * 100:.3f}%"
    keping = [
        f'<div class="bingkai" style="aspect-ratio:{BINGKAI}/{t}">',
        f'<div class="rel" style="width:{pct_x(REL)}"><span>Rel samping<br>192</span></div>',
        # Header dan Footer sama di seluruh frame, jadi digambar di sini sekali.
        f'<div class="bar" style="left:{pct_x(KONTEN_X)};top:{pct_y(KEPALA_Y)};'
        f'width:{pct_x(KONTEN_W)};height:{pct_y(KEPALA_H)}">'
        f'<span>Header · KepalaHalaman · 1192x38</span></div>',
        f'<div class="bar" style="left:{pct_x(KONTEN_X)};top:{pct_y(t - 44)};'
        f'width:{pct_x(KONTEN_W)};height:{pct_y(KAKI_H)}">'
        f'<span>Footer · KakiHalaman · 1192x19,5</span></div>',
    ]
    for nama, x, y, w, hh, komp, isi in h["wilayah"]:
        keping.append(
            f'<div class="w" style="left:{pct_x(x)};top:{pct_y(y)};'
            f'width:{pct_x(w)};height:{pct_y(hh)}">'
            f'<div class="n">{html.escape(nama)}</div>'
            f'<div class="k">{html.escape(komp)}</div>'
            f'<div class="i">{html.escape(isi)}</div>'
            f'<div class="u">{w:g}x{hh:g}</div></div>')
    keping.append("</div>")
    return "".join(keping)


def tabel(h):
    baris = "".join(
        f"<tr><td><code>{html.escape(n)}</code></td><td>{w:g}x{hh:g}</td>"
        f"<td>{html.escape(k)}</td><td>{html.escape(i)}</td></tr>"
        for n, x, y, w, hh, k, i in h["wilayah"])
    return ("<table><tr><th>Layer Figma</th><th>Kotak</th><th>Komponen kit</th>"
            f"<th>Isi kita</th></tr>{baris}</table>")


def main():
    bagian = []
    for h in HALAMAN:
        catatan = (f'<p class="catatan">{html.escape(h["catatan"])}</p>'
                   if h.get("catatan") else "")
        bagian.append(
            f'<section class="hal"><div class="judul">'
            f'<b>{html.escape(h["halaman"])}</b>'
            f'<span class="frame">{html.escape(h["frame"])} · 1440x{h["tinggi"]}</span>'
            f'<span class="arah">kolom konten 220 → 1412 (1192)</span></div>'
            f'{catatan}{gambar(h)}{tabel(h)}</section>')
    KELUAR.parent.mkdir(parents=True, exist_ok=True)
    KELUAR.write_text(
        '<!doctype html><html lang="id"><head><meta charset="utf-8">'
        '<title>Wireframe 14 halaman admin — Coinest</title>'
        f"<style>{CSS}</style></head><body>"
        '<div class="kop"><h1>Wireframe 14 halaman admin</h1>'
        "<p>Digambar dari ukuran frame Figma-nya sendiri, bukan dikira dari "
        "tangkapan layar. Tiap kotak membawa nama layer Figma-nya, komponen "
        "kit yang akan mengisinya, dan isi sungguhan kita.</p>"
        "<p>Kerangka bersama di seluruh frame: bingkai 1440, rel samping "
        "0–192, kolom konten 220–1412 (1192), kepala halaman 1192x38 di y22, "
        "kaki halaman 1192x19,5. Talangnya 28 di kedua sisi.</p>"
        "<p>Dibuat ulang dengan <code>python3 scripts/buat-wireframe.py</code>, "
        "dan angkanya dibuktikan masih sama dengan framenya oleh "
        "<code>python3 scripts/periksa-wireframe.py</code>.</p>"
        "<p><b>Lima bentuk yang dipakai frame Interface tapi BELUM ADA di "
        "kit</b>, ketahuan waktu kotak wireframe ditumpuk di atas gambar "
        "framenya \u2014 bukan waktu angkanya dibaca: bar kemajuan (dipakai di "
        "tiga halaman), grafik area halus, grafik area bertangga, busur "
        "(gauge), dan kartu statistik LEBAR yang ikonnya di kanan. Kelimanya "
        "harus dibangun sebelum halaman yang memakainya, atau halamannya "
        "dibangun dengan bentuk yang salah.</p></div>"
        + "".join(bagian) + "</body></html>")
    n = sum(len(h["wilayah"]) for h in HALAMAN)
    print(f"halaman: {len(HALAMAN)}  wilayah: {n}  ->  "
          f"{KELUAR.relative_to(AKAR)}  ({KELUAR.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
