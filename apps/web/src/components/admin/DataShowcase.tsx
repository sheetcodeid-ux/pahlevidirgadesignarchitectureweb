import { Icon } from "../ui/Icon";
import { DataTable, type Kolom, type Chip } from "../ui/data/DataTable";
import { Calendar } from "../ui/data/Calendar";
import { DatePicker } from "../ui/data/DatePicker";
import { BarChart, LineChart } from "../ui/data/Chart";
import { Carousel } from "../ui/data/Carousel";
import { ScrollArea, ResizableDemo } from "../ui/data/Panels";
import {
  AreaChart, Gauge, KartuMini, KartuPapan, Sparkline, StackedBarChart, StripMetrik, bandingkan,
} from "../ui/data/Dashboard";
import {
  BilahKategori, BusurTarget, ChartBanding, CincinDistribusi, KartuData, LiniMasa, PilLive, PitaMetrik,
} from "../ui/data/Keuangan";

/** Rupiah LENGKAP — bentuk yang dipakai di bawah busur target. */
function rpPenuh(n: number) {
  return `Rp${Math.round(n).toLocaleString("id-ID")}`;
}

/** Rupiah ringkas untuk contoh di halaman ini. */
function rp(n: number) {
  const a = Math.abs(n);
  const tanda = n < 0 ? "\u2212" : "";
  if (a >= 1_000_000_000) return `${tanda}Rp${(a / 1_000_000_000).toFixed(2).replace(".", ",")} M`;
  if (a >= 1_000_000) return `${tanda}Rp${Math.round(a / 1_000_000)} jt`;
  return `${tanda}Rp${a.toLocaleString("id-ID")}`;
}

interface Proyek extends Record<string, unknown> {
  judul: string;
  kota: string;
  kategori: string;
  tahun: number;
  status: string;
}

const proyek: Proyek[] = [
  { judul: "Rumah Tepi Sawah", kota: "Badung", kategori: "Hunian", tahun: 2024, status: "Terbit" },
  { judul: "Kantor Kayu Bandung", kota: "Bandung", kategori: "Komersial", tahun: 2023, status: "Terbit" },
  { judul: "Renovasi Rumah Menteng", kota: "Jakarta Pusat", kategori: "Renovasi", tahun: 2025, status: "Draf" },
  { judul: "Vila Bukit Ubud", kota: "Gianyar", kategori: "Hunian", tahun: 2022, status: "Terbit" },
  { judul: "Interior Klinik Pontianak", kota: "Pontianak", kategori: "Interior", tahun: 2026, status: "Draf" },
];

const kolom: Kolom<Proyek>[] = [
  { judul: "Proyek", render: (b) => <span className="item__title">{b.judul}</span> },
  { judul: "Kota", lebar: "5rem", render: (b) => b.kota },
  { judul: "Kategori", lebar: "5rem", render: (b) => b.kategori },
  { judul: "Tahun", kelas: "table__num", lebar: "2.5rem", render: (b) => b.tahun },
  {
    judul: "Status",
    lebar: "4rem",
    render: (b) => (
      <span className={`badge ${b.status === "Terbit" ? "badge--success" : ""}`}>
        {b.status === "Terbit" && <span className="badge__dot" />}
        {b.status}
      </span>
    ),
  },
];

/** Chip menyaring di klien, sama seperti di Semua Proyek. */
const chips: Chip<Proyek>[] = [
  { id: "semua", label: "Semua" },
  { id: "terbit", label: "Terbit", cocok: (b) => b.status === "Terbit" },
  { id: "draf", label: "Draf", cocok: (b) => b.status === "Draf" },
];

const besok = new Date();
besok.setDate(besok.getDate() + 1);

export function DataShowcase() {
  return (
    <div className="stack" style={{ gap: "var(--space-5)" }}>
      <div className="spec-demo">
        <div className="spec-demo__name">
          <span className="t-subheading">Data Table</span>
          <code className="swatch__name">DataTable</code>
        </div>
        <DataTable
          data={proyek}
          kunci={(b) => b.judul}
          kolom={kolom}
          chips={chips}
          cariPada={(b) => [b.judul, b.kota, b.kategori]}
          placeholderCari="Cari judul, kota, atau kategori…"
          labelCari="Cari proyek"
          satuan="proyek"
          barisSkeleton={5}
          kosong={{ ikon: "project", judul: "Belum ada proyek", keterangan: "Buat proyek pertama untuk mulai mengisi portfolio." }}
        />
      </div>

      <div className="spec-grid">
        <div className="spec-demo">
          <BarChart
            title="Pesan masuk per bulan"
            data={[
              { label: "Mar", value: 5 },
              { label: "Apr", value: 8 },
              { label: "Mei", value: 6 },
              { label: "Jun", value: 9 },
              { label: "Jul", value: 7 },
              { label: "Agu", value: 11 },
            ]}
          />
          <p className="field__help">
            Satu deret, jadi tanpa legenda — judulnya sudah menamainya. Besaran memakai satu warna, bukan enam.
          </p>
        </div>

        <div className="spec-demo">
          <LineChart
            title="Pesan masuk vs proyek terbit"
            labels={["Mar", "Apr", "Mei", "Jun", "Jul", "Agu"]}
            series={[
              { name: "Pesan masuk", color: "var(--chart-1)", points: [5, 8, 6, 9, 7, 11] },
              { name: "Proyek terbit", color: "var(--chart-2)", points: [1, 2, 1, 3, 2, 4] },
            ]}
          />
          <p className="field__help">
            Dua deret di satu sumbu. Sumbu ganda tidak pernah dipakai — dua besaran berbeda skala dipecah jadi dua grafik.
          </p>
        </div>
      </div>

      <div className="spec-grid">
        <div className="spec-demo">
          <div className="spec-demo__name">
            <span className="t-subheading">Calendar</span>
            <code className="swatch__name">Calendar</code>
          </div>
          <Calendar minDate={besok} />
          <p className="field__help">
            Tanggal lampau dicoret, bukan sekadar diredupkan — redup mudah tertukar dengan "di luar bulan ini".
          </p>
        </div>

        <div className="spec-demo">
          <div className="spec-demo__name">
            <span className="t-subheading">Date Picker</span>
            <code className="swatch__name">DatePicker</code>
          </div>
          <div className="spec-demo__stage spec-demo__stage--stack">
            <DatePicker label="Tanggal survei" minDate={besok} />
            <p className="field__help">Kalender yang sama di dalam popover — bukan komponen baru.</p>
          </div>
        </div>

        <div className="spec-demo">
          <div className="spec-demo__name">
            <span className="t-subheading">Scroll Area</span>
            <code className="swatch__name">ScrollArea</code>
          </div>
          <ScrollArea>
            <div className="stack" style={{ gap: "var(--space-3)" }}>
              {proyek.concat(proyek).map((p, i) => (
                <div key={i} className="row" style={{ gap: "var(--space-3)" }}>
                  <span className="icon-tile icon-tile--sm"><Icon name="project" size={14} /></span>
                  <span className="t-body">{p.judul}</span>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>

        <div className="spec-demo">
          <div className="spec-demo__name">
            <span className="t-subheading">Resizable</span>
            <code className="swatch__name">ResizableDemo</code>
          </div>
          <ResizableDemo />
          <p className="field__help">Seret sekatnya, atau raih dengan Tab lalu geser dengan panah.</p>
        </div>
      </div>

      {/* --- Papan angka -------------------------------------------------- */}

      <div className="spec-demo">
        <div className="spec-demo__name">
          <span className="t-subheading">Strip Metrik</span>
          <code className="swatch__name">StripMetrik</code>
        </div>
        <StripMetrik
          metrik={[
            { label: "Kas masuk", nilai: "Rp185.000.000", delta: bandingkan(30, 45), deltaFormat: (v) => `Rp${v} jt` },
            { label: "Biaya", nilai: "Rp261.000.000", delta: bandingkan(8, 70), deltaTerbalik: true, deltaFormat: (v) => `Rp${v} jt` },
            { label: "Laba bersih", nilai: "−Rp76.000.000", minus: true, delta: bandingkan(22, -25), deltaFormat: (v) => `Rp${v} jt` },
            { label: "Tertagih", nilai: "41%" },
          ]}
        />
        <p className="field__help">
          Satu bilah dipisah garis, bukan empat kartu. Delta yang basisnya negatif menampilkan
          selisih rupiah, bukan persen — "dari rugi ke untung" bukan pertumbuhan sekian persen.
        </p>
      </div>

      <div className="spec-demo">
        <div className="spec-demo__name">
          <span className="t-subheading">Kartu Papan + Area Chart</span>
          <code className="swatch__name">KartuPapan, AreaChart</code>
        </div>
        <KartuPapan
          judul="Arus uang per bulan"
          nilai="Rp22.000.000"
          delta={bandingkan(22, 18)}
          kanan={<span className="t-muted" style={{ fontSize: "var(--text-xs)" }}>7 bulan terakhir</span>}
          anak={
            <AreaChart
              titik={[23, 32, -18, -17, -30, -25, 22]}
              label={["Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep"]}
              judulNilai="Laba bersih"
              format={(v) => `Rp${Math.round(v)} jt`}
              warna="var(--chart-3)"
            />
          }
          tab={
            <div className="segmented segmented--block" role="group" aria-label="Deret">
              <button type="button" className="segmented__opt" aria-pressed>Laba bersih</button>
              <button type="button" className="segmented__opt">Kas masuk</button>
              <button type="button" className="segmented__opt">Biaya</button>
            </div>
          }
        />
        <p className="field__help">
          Sumbu nilainya di kanan dan garis putus-putus menandai puncaknya. Tab di KAKI kartu,
          karena yang dipilih di situ mengganti isi grafik di atasnya.
        </p>
      </div>

      <div className="spec-demo">
        <div className="spec-demo__name">
          <span className="t-subheading">Stacked Bar Chart</span>
          <code className="swatch__name">StackedBarChart</code>
        </div>
        <StackedBarChart
          label={["Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep"]}
          format={(v) => `Rp${Math.round(v)} jt`}
          deret={[
            { nama: "Kas masuk", warna: "var(--chart-1)", nilai: [35, 72, 0, 22, 60, 45, 30] },
            { nama: "Biaya", warna: "var(--chart-2)", nilai: [-12, -40, -18, -40, -90, -70, -8] },
          ]}
        />
        <p className="field__help">
          Yang positif naik dari nol, yang negatif turun. Menjumlahkannya jadi satu batang akan
          menyembunyikan bahwa dua deretnya berlawanan arah — dan selisih itulah datanya.
        </p>
      </div>

      <div className="spec-grid spec-grid--dua">
        <div className="spec-demo">
          <div className="spec-demo__name">
            <span className="t-subheading">Gauge</span>
            <code className="swatch__name">Gauge</code>
          </div>
          <Gauge nilai={42} judul="Margin proyeksi" keterangan="Sehat" />
          <p className="field__help">Zonanya memakai warna semantik: merah rugi, amber tipis, hijau sehat.</p>
        </div>

        <div className="spec-demo">
          <div className="spec-demo__name">
            <span className="t-subheading">Sparkline</span>
            <code className="swatch__name">Sparkline</code>
          </div>
          <Sparkline titik={[23, 32, -18, -17, -30, -25, 22]} label="Laba bersih per bulan" />
          <p className="field__help">Tanpa sumbu — bentuknya yang bercerita. Merah kalau berakhir lebih rendah dari awalnya.</p>
        </div>
      </div>

      <div className="spec-demo">
        <div className="spec-demo__name">
          <span className="t-subheading">Kartu Mini</span>
          <code className="swatch__name">KartuMini</code>
        </div>
        <div className="spec-grid spec-grid--tiga-tetap">
          <KartuMini judul="Bulan terbaik" keterangan="Laba bersih tertinggi" nilai="Apr 2026"
            badge="Rp32.500.000" badgeKelas="badge--success" />
          <KartuMini judul="Bulan terberat" keterangan="Laba bersih terendah" nilai="Jul 2026"
            badge="−Rp30.000.000" badgeKelas="badge--brand" />
          <KartuMini judul="Bulan rugi" keterangan="Biaya melebihi kas masuk" nilai="4 dari 7"
            badge="Sering" badgeKelas="badge--warn" />
        </div>
      </div>


      {/* --- Primitif papan Keuangan -------------------------------------- */}

      <div className="spec-demo">
        <div className="spec-demo__name">
          <span className="t-subheading">Busur Target</span>
          <code className="swatch__name">KartuData, BusurTarget, PilLive</code>
        </div>
        <div className="papan-grid papan-grid--tiga">
          <KartuData judul="Target Per Bulan" keterangan="Realisasi vs target bulan ini" kanan={<PilLive />}>
            <BusurTarget judul="Target Per Bulan" nilai={836_896_159} target={15_496_418_900}
              format={rpPenuh} delta="−93,7% vs bulan lalu" deltaArah="turun" />
          </KartuData>
          <KartuData judul="Target 6 Bulan" keterangan="Semester berjalan" kanan={<PilLive />}>
            <BusurTarget judul="Target 6 Bulan" nilai={640_000_000} target={1_000_000_000}
              format={rpPenuh} delta="+18,2% vs semester lalu" deltaArah="naik" />
          </KartuData>
          <KartuData judul="Target Tahunan" keterangan="Akumulasi 12 bulan">
            <BusurTarget judul="Target Tahunan" nilai={1_180_000_000} target={1_000_000_000}
              format={rpPenuh} delta="+31,4% vs tahun lalu" deltaArah="naik" />
          </KartuData>
        </div>
        <p className="field__help">
          Penandanya kapsul di atas rel, bukan busur terisi — bacanya "sudah sampai mana",
          dan untuk target yang baru 5% terisi kapsul jauh lebih terlihat daripada busur
          setipis rambut. Busurnya 240°, terbuka di bawah.
        </p>
      </div>

      <div className="spec-demo">
        <div className="spec-demo__name">
          <span className="t-subheading">Cincin Distribusi</span>
          <code className="swatch__name">CincinDistribusi</code>
        </div>
        <div className="papan-grid papan-grid--dua">
          <KartuData
            judul="Distribusi Margin"
            keterangan="Sebaran kesehatan margin per proyek"
            bawah={
              <div className="segmented" role="group" aria-label="Kelompokkan menurut">
                <button type="button" className="segmented__opt" aria-pressed="true">Kategori</button>
                <button type="button" className="segmented__opt" aria-pressed="false">Arsitek</button>
              </div>
            }>
            <CincinDistribusi
              judul="Distribusi margin"
              pita={[
                { label: "Sehat", keterangan: "Margin ≥ 35%", jumlah: 30, warna: "var(--success)", lembut: "var(--success-soft)", ikon: "check" },
                { label: "Cukup", keterangan: "Margin 15–34%", jumlah: 15, warna: "var(--warn)", lembut: "var(--warn-soft)", ikon: "clock" },
                { label: "Kritis", keterangan: "Margin < 15%", jumlah: 5, warna: "var(--brand)", lembut: "var(--brand-soft)", ikon: "alert" },
              ]}
            />
          </KartuData>
          <KartuData judul="Distribusi Margin" keterangan="Studio yang belum punya proyek berkontrak">
            <CincinDistribusi
              judul="Distribusi margin kosong"
              pita={[
                { label: "Sehat", keterangan: "Margin ≥ 35%", jumlah: 0, warna: "var(--success)", lembut: "var(--success-soft)", ikon: "check" },
                { label: "Cukup", keterangan: "Margin 15–34%", jumlah: 0, warna: "var(--warn)", lembut: "var(--warn-soft)", ikon: "clock" },
                { label: "Kritis", keterangan: "Margin < 15%", jumlah: 0, warna: "var(--brand)", lembut: "var(--brand-soft)", ikon: "alert" },
              ]}
            />
          </KartuData>
        </div>
        <p className="field__help">
          Tiga cincin sepusat, satu per pita — bukan satu donat yang dibagi tiga. Tiap busur
          mulai di titik yang sama (puncak), jadi panjangnya bisa dibandingkan langsung.
          Keadaan kosong digambar sebagai rel polos, bukan lingkaran penuh satu warna.
        </p>
      </div>

      <div className="spec-demo">
        <div className="spec-demo__name">
          <span className="t-subheading">Chart Banding Periode</span>
          <code className="swatch__name">ChartBanding</code>
        </div>
        <KartuData
          judul="Nilai Proyek"
          keterangan="Total nilai kontrak per bulan · tahun ini vs tahun lalu"
          kanan={
            <div className="segmented" role="group" aria-label="Tahun">
              <button type="button" className="segmented__opt" aria-pressed="true">2026</button>
              <button type="button" className="segmented__opt" aria-pressed="false">2025</button>
            </div>
          }>
          <ChartBanding
            label={["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"]}
            kini={[45, 120, 96, 180, 210, 150, 96, 240, 205, 160, 190, 220]}
            lalu={[30, 88, 110, 92, 140, 165, 120, 96, 150, 130, 118, 175]}
            namaKini="Tahun ini"
            namaLalu="Tahun lalu"
            format={(v) => `Rp${Math.round(v)} jt`}
          />
        </KartuData>
        <p className="field__help">
          Garis bidik tegak, titik membesar, dan kartu nilai yang membalik arah di paruh
          kanan supaya tidak pernah keluar kartu. Sumbu Y selalu mulai dari nol: memotongnya
          membuat selisih dua bulan terlihat berlipat dari yang sebenarnya.
        </p>
      </div>

      <div className="spec-demo">
        <div className="spec-demo__name">
          <span className="t-subheading">Pita Metrik</span>
          <code className="swatch__name">PitaMetrik</code>
        </div>
        <PitaMetrik
          sel={[
            { label: "Nilai kontrak", nilai: "Rp451.000.000", persen: "100%", arah: "netral" },
            { label: "Kas masuk", nilai: "Rp185.000.000", persen: "41,0%", arah: "naik" },
            { label: "Biaya ops", nilai: "Rp261.000.000", persen: "57,9%", arah: "turun" },
            { label: "Laba bersih", nilai: "−Rp76.000.000", persen: "−41,1%", arah: "turun", minus: true },
            { label: "Margin", nilai: "−16,9%", persen: "−16,9%", arah: "turun", minus: true },
            { label: "Tertagih", nilai: "41,0%", persen: "+12,4%", arah: "naik" },
          ]}
        />
        <p className="field__help">
          Setiap sel WAJIB punya persentase dan labelnya satu baris. Kalau sebagian punya
          chip dan sebagian tidak, tinggi selnya beda dan barisnya terbaca miring. Ketiga
          barisnya dipatok ke grid yang sama lewat <code>subgrid</code>, jadi label, angka,
          dan chip benar-benar sejajar antar sel.
        </p>
      </div>

      <div className="spec-demo">
        <div className="spec-demo__name">
          <span className="t-subheading">Bilah Kategori</span>
          <code className="swatch__name">BilahKategori</code>
        </div>
        <KartuData judul="Beban Operasional" keterangan="Rincian beban studio · 12 bulan" kanan={<PilLive />}>
          <BilahKategori
            format={rp}
            iris={[
              { nama: "Tenaga kerja & render", nilai: 148_000_000, warna: "var(--chart-1)" },
              { nama: "Management fee 10%", nilai: 45_100_000, warna: "var(--chart-2)" },
              { nama: "Operasional harian", nilai: 52_000_000, warna: "var(--chart-3)" },
              { nama: "Lainnya", nilai: 15_900_000, warna: "var(--tray)" },
            ]}
          />
        </KartuData>
        <p className="field__help">
          Bilah, bukan pie: membandingkan panjang jauh lebih akurat daripada membandingkan
          sudut — dan kategori beban di sini memang timpang jauh.
        </p>
      </div>

      <div className="spec-demo">
        <div className="spec-demo__name">
          <span className="t-subheading">Lini Masa</span>
          <code className="swatch__name">LiniMasa</code>
        </div>
        <KartuData judul="Aktivitas Terkini" keterangan="Pergerakan uang dan dokumen terbaru" kanan={<PilLive />}>
          <LiniMasa
            butir={[
              { id: "1", judul: "Invoice DP 50% lunas", keterangan: "Rumah Kaca · Rp72.500.000", waktu: "2 jam lalu",
                ikon: "check", warna: "var(--success)", lembut: "var(--success-soft)" },
              { id: "2", judul: "Biaya render ditambahkan", keterangan: "Kopi Simpang Tiga · Rp8.500.000", waktu: "5 jam lalu",
                ikon: "alert", warna: "var(--warn)", lembut: "var(--warn-soft)" },
              { id: "3", judul: "Gambar kerja diunggah", keterangan: "Renovasi Ruko Gajahmada · 12 berkas", waktu: "kemarin",
                ikon: "document", warna: "var(--text-muted)", lembut: "var(--surface-hover)" },
              { id: "4", judul: "Fase naik ke Desain 2", keterangan: "Rumah Kaca", waktu: "kemarin",
                ikon: "clock", warna: "var(--upgrade)", lembut: "var(--upgrade-soft)" },
            ]}
          />
        </KartuData>
        <p className="field__help">
          Garis penghubung tegak yang membuat daftar ini terbaca sebagai urutan waktu, bukan
          tumpukan baris. Garis pada butir terakhir sengaja tidak digambar — kalau digambar, ia
          menjanjikan butir berikutnya yang tidak ada.
        </p>
      </div>

      <div className="spec-demo">
        <div className="spec-demo__name">
          <span className="t-subheading">Carousel</span>
          <code className="swatch__name">Carousel</code>
        </div>
        <Carousel label="Galeri proyek">
          {proyek.map((p) => (
            <div className="carousel__slide" key={p.judul}>
              <div className="carousel__figure"><Icon name="image" size={28} /></div>
              <div className="carousel__caption">
                <div className="t-subheading">{p.judul}</div>
                <div className="t-muted">{p.kota} · {p.tahun}</div>
              </div>
            </div>
          ))}
        </Carousel>
      </div>
    </div>
  );
}
