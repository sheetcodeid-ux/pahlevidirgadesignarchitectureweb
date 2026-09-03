import { Icon } from "../ui/Icon";
import { DataTable, type Kolom, type Chip } from "../ui/data/DataTable";
import { Calendar } from "../ui/data/Calendar";
import { DatePicker } from "../ui/data/DatePicker";
import { BarChart, LineChart } from "../ui/data/Chart";
import { Carousel } from "../ui/data/Carousel";
import { ScrollArea, ResizableDemo } from "../ui/data/Panels";
import { KartuAngka } from "../ui/data/KartuAngka";
import { ChartArusKas } from "../ui/data/ChartArusKas";
import { KartuDonat } from "../ui/data/KartuDonat";
import {
  AreaChart, Gauge, KartuMini, KartuPapan, Sparkline, StackedBarChart, StripMetrik, bandingkan,
} from "../ui/data/Dashboard";

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


/** Contoh dua belas bulan untuk grafik arus kas di halaman ini. */
const arusContoh = [
  { label: "Jan", labelPanjang: "Januari", nilai: { kas: 330_000_000, beban: 270_000_000, laba: 95_000_000 } },
  { label: "Feb", labelPanjang: "Februari", nilai: { kas: 480_000_000, beban: 320_000_000, laba: 175_000_000 } },
  { label: "Mar", labelPanjang: "Maret", nilai: { kas: 555_000_000, beban: 430_000_000, laba: 300_000_000 } },
  { label: "Apr", labelPanjang: "April", nilai: { kas: 470_000_000, beban: 545_000_000, laba: 555_000_000 } },
  { label: "Mei", labelPanjang: "Mei", nilai: { kas: 400_000_000, beban: 520_000_000, laba: 470_000_000 } },
  { label: "Jun", labelPanjang: "Juni", nilai: { kas: 670_000_000, beban: 400_000_000, laba: 310_000_000 } },
  { label: "Jul", labelPanjang: "Juli", nilai: { kas: 640_000_000, beban: 610_000_000, laba: 480_000_000 } },
  { label: "Agu", labelPanjang: "Agustus", nilai: { kas: 470_000_000, beban: 655_000_000, laba: 545_000_000 } },
  { label: "Sep", labelPanjang: "September", nilai: { kas: 560_000_000, beban: 520_000_000, laba: 430_000_000 } },
  { label: "Okt", labelPanjang: "Oktober", nilai: { kas: 540_000_000, beban: 420_000_000, laba: 300_000_000 } },
  { label: "Nov", labelPanjang: "November", nilai: { kas: 385_000_000, beban: 400_000_000, laba: 320_000_000 } },
  { label: "Des", labelPanjang: "Desember", nilai: { kas: 545_000_000, beban: 665_000_000, laba: 490_000_000 } },
];

const arusSeri = [
  { kunci: "kas", label: "Kas masuk", warna: "var(--success)", gaya: "penuh" as const, isi: true },
  { kunci: "beban", label: "Beban", warna: "var(--brand)", gaya: "putus" as const },
  { kunci: "laba", label: "Laba", warna: "var(--warn)", gaya: "putus" as const },
];


/** Contoh irisan untuk kartu donat di halaman ini. */
const irisContoh = [
  { label: "Tenaga kerja & render", nilai: 106_600_000, warna: "var(--chart-cat-1)" },
  { label: "Management fee", nilai: 45_200_000, warna: "var(--chart-cat-2)" },
  { label: "Operasional harian", nilai: 34_900_000, warna: "var(--chart-cat-3)" },
  { label: "Perizinan", nilai: 12_300_000, warna: "var(--chart-cat-4)" },
  { label: "Lainnya", nilai: 6_000_000, warna: "var(--chart-cat-5)" },
];

const donatTab = [
  { nilai: "kategori", label: "Kategori", ikon: "list" as const },
  { nilai: "proyek", label: "Proyek", ikon: "project" as const },
  { nilai: "bulan", label: "Bulan", ikon: "calendar" as const },
];

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


      {/* --- Kartu angka -------------------------------------------------- */}

      <div className="spec-demo">
        <div className="spec-demo__name">
          <span className="t-subheading">Kartu Angka</span>
          <code className="swatch__name">KartuAngka</code>
        </div>
        <div className="kangka-deret">
          <KartuAngka label="Kas masuk (bulan ini)" nilai="Rp590.000.000" ikon="finance"
            delta="+18,2%" deltaArah="naik" />
          <KartuAngka label="Beban operasional" nilai="Rp205.000.000" ikon="coffee"
            delta="−8,5%" deltaArah="turun" deltaNada="baik" />
          <KartuAngka label="Nilai kontrak berjalan" nilai="Rp1.284.500.000" ikon="project"
            delta="+12,4%" deltaArah="naik" />
          <KartuAngka label="Rata-rata nilai proyek" nilai="Rp0" ikon="projectPlus"
            delta="belum ada proyek berkontrak" deltaNada="netral" />
        </div>
        <p className="field__help">
          Ubin ikon di pojok KANAN atas, label huruf biasa (bukan huruf besar bertrack seperti
          label lain di panel ini), angka besar, lalu satu baris delta berpanah tren. Angkanya
          22px, bukan 28px seperti referensinya: &quot;Rp1.284.500.000&quot; lima belas karakter
          dan pada 28px butuh 269px sementara ruang dalam kartu cuma 237px — terukur, bukan
          dikira. Nada netral tidak dapat panah, karena barisnya keterangan dan bukan tren.
        </p>
      </div>

      {/* --- Grafik arus kas ----------------------------------------------- */}

      <div className="spec-demo">
        <div className="spec-demo__name">
          <span className="t-subheading">Grafik Arus Kas</span>
          <code className="swatch__name">ChartArusKas</code>
        </div>
        <ChartArusKas
          judul="Analisis Arus Kas"
          seri={arusSeri}
          data={arusContoh}
          periode="tahun"
          opsiPeriode={[{ nilai: "tahun", label: "Tahun ini" }, { nilai: "lalu", label: "Tahun lalu" }]}
        />
        <p className="field__help">
          Satu seri bergaris penuh dengan bidang di bawahnya, dua seri putus-putus tanpa bidang.
          Tunjuk di mana saja untuk memunculkan garis bidik, titik per seri, dan kartu keterangan
          yang melompat ke kiri saat mendekati tepi kanan. Panah kiri/kanan dan Home/End juga
          bekerja. Sumbu nilai memakai singkatan karena kolomnya cuma 58px; kartu keterangan
          memakai nominal LENGKAP, karena di situlah angkanya dicocokkan dengan rekening.
          Kurvanya monoton, jadi garis kas yang semua angkanya positif tidak pernah tergambar
          menukik ke bawah nol di antara dua bulan.
        </p>
      </div>

      {/* --- Kartu donat ---------------------------------------------------- */}

      <div className="spec-demo">
        <div className="spec-demo__name">
          <span className="t-subheading">Kartu Donat</span>
          <code className="swatch__name">KartuDonat</code>
        </div>
        <div className="papan-grid papan-grid--dua">
          <KartuDonat
            judul="Rincian Beban"
            subjudul="September 2026"
            tab={donatTab}
            iris={irisContoh}
            format={(n) => `Rp${Math.round(n / 1_000_000)} jt`}
            kakiLabel="Total beban"
            kakiNilai="Rp205.000.000"
          />
          <KartuDonat
            judul="Rincian Beban"
            subjudul="Belum ada biaya tercatat"
            tab={donatTab}
            iris={irisContoh.map((i) => ({ ...i, nilai: 0 }))}
            format={(n) => `Rp${Math.round(n / 1_000_000)} jt`}
            kakiLabel="Total beban"
            kakiNilai="Rp0"
          />
        </div>
        <p className="field__help">
          Judul dan subjudul, bilah tab berkotak dengan segmen aktif yang jadi kartu terang,
          donat berangka persentase besar di tengah, legenda tegak, lalu kaki berisi label,
          lingkaran bertindih, dan total. Menunjuk satu baris legenda meredupkan irisan lain
          dan mengganti angka di tengah. Warnanya memakai skala KATEGORI tersendiri
          (<code className="swatch__name">--chart-cat-1</code>…<code className="swatch__name">5</code>),
          bukan warna semantik — makna tiap irisan dibawa labelnya, bukan warnanya. Donat dan
          legenda bertumpuk sendiri saat berdampingan tidak lagi muat.
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
