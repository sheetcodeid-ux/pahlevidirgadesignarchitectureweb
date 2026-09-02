import { Icon } from "../ui/Icon";
import { DataTable, type Kolom, type Chip } from "../ui/data/DataTable";
import { Calendar } from "../ui/data/Calendar";
import { DatePicker } from "../ui/data/DatePicker";
import { BarChart, LineChart } from "../ui/data/Chart";
import { Carousel } from "../ui/data/Carousel";
import { ScrollArea, ResizableDemo } from "../ui/data/Panels";

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
