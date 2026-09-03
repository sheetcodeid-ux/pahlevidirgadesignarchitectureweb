import { useId, type ReactNode } from "react";
import { Icon, type IconName } from "../Icon";

/* =============================================================================
   Kartu statistik — bahasa kartu dari referensi Aniq-ui yang dikirim pemilik.

   Bedanya dengan KartuMetrik di Keuangan.tsx (yang tetap dipakai di tempat
   lain): kartu ini punya grafik area yang menempel penuh ke dasar kartu, dan
   tombol ikon bulat yang mengambang di pojok kanan atas. Dua hal itu yang
   paling khas di referensi, dan dua-duanya tidak ada di kartu lama.

   Aturan yang berlaku di berkas ini:
   - Tidak ada nilai warna literal; semuanya menunjuk token.
   - Grafiknya melar mengikuti lebar kartu, tapi TEBAL GARISNYA tidak ikut
     melar — pakai vector-effect, karena preserveAspectRatio="none" akan
     membuat garis vertikal jadi lebih tebal daripada garis mendatar.
   - Angka nol, data kosong, dan data satu titik harus tetap tergambar.
   ============================================================================= */

/* --- Interpolasi ---------------------------------------------------------- */

/**
 * Kurva kubik monoton (Fritsch–Carlson).
 *
 * Bukan spline biasa: spline kardinal bisa melampaui titik datanya, jadi
 * grafik kas masuk yang semua angkanya positif bisa menukik ke bawah nol
 * di antara dua titik. Kurva monoton tidak pernah melakukan itu.
 */
function kurva(titik: Array<{ x: number; y: number }>) {
  const n = titik.length;
  if (n === 0) return "";
  if (n === 1) return `M ${titik[0].x} ${titik[0].y}`;

  const sekan: number[] = [];
  for (let i = 0; i < n - 1; i += 1) {
    sekan.push((titik[i + 1].y - titik[i].y) / (titik[i + 1].x - titik[i].x));
  }

  const m: number[] = [sekan[0]];
  for (let i = 1; i < n - 1; i += 1) {
    m.push(sekan[i - 1] * sekan[i] <= 0 ? 0 : (sekan[i - 1] + sekan[i]) / 2);
  }
  m.push(sekan[n - 2]);

  for (let i = 0; i < n - 1; i += 1) {
    if (sekan[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
    const a = m[i] / sekan[i];
    const b = m[i + 1] / sekan[i];
    const s = a * a + b * b;
    if (s > 9) {
      const t = 3 / Math.sqrt(s);
      m[i] = t * a * sekan[i];
      m[i + 1] = t * b * sekan[i];
    }
  }

  let jalur = `M ${titik[0].x} ${titik[0].y}`;
  for (let i = 0; i < n - 1; i += 1) {
    const dx = titik[i + 1].x - titik[i].x;
    jalur +=
      ` C ${titik[i].x + dx / 3} ${titik[i].y + (m[i] * dx) / 3}` +
      ` ${titik[i + 1].x - dx / 3} ${titik[i + 1].y - (m[i + 1] * dx) / 3}` +
      ` ${titik[i + 1].x} ${titik[i + 1].y}`;
  }
  return jalur;
}

/* --- Grafik dasar kartu --------------------------------------------------- */

const SW = 100;
const SH = 40;

/**
 * Grafik area yang menempel ke dasar kartu, mepet ke kedua tepinya.
 *
 * Sengaja tanpa sumbu, tanpa kisi, tanpa label: ini pendamping angka besar
 * di atasnya, bukan grafik yang dibaca sendiri. Titik terakhir ditandai
 * supaya mata tahu ke mana arah bacanya berakhir.
 */
export function GrafikDasar({
  data, warna = "var(--chart-1)", tinggi = 56, tandai = true,
}: {
  data: number[];
  warna?: string;
  tinggi?: number;
  tandai?: boolean;
}) {
  const gid = useId().replace(/:/g, "");
  if (data.length === 0) return <div className="kstat__spark kstat__spark--kosong" style={{ height: tinggi }} />;

  const maks = Math.max(...data);
  const min = Math.min(...data);
  /* Rentang nol (semua angkanya sama, termasuk semua nol) digambar sebagai
     garis di tengah — bukan dibagi nol, dan bukan menghilang. */
  const rentang = maks - min || 1;
  const rata = maks === min;

  const titik = data.map((v, i) => ({
    x: data.length === 1 ? SW / 2 : (i / (data.length - 1)) * SW,
    y: rata ? SH * 0.55 : SH - 4 - ((v - min) / rentang) * (SH - 8),
  }));

  const garis = kurva(titik);
  const akhir = titik[titik.length - 1];
  /* Seri datar (semua angkanya sama, termasuk semua nol) digambar sebagai
     garis putus-putus tanpa isian. Isian penuh di bawah garis datar tampak
     seperti balok warna solid — terbaca "besar", padahal artinya "tidak ada
     pergerakan". */
  const area = data.length === 1 || rata ? "" : `${garis} L ${SW} ${SH} L 0 ${SH} Z`;

  return (
    <svg
      className="kstat__spark"
      style={{ height: tinggi }}
      viewBox={`0 0 ${SW} ${SH}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={`g${gid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={warna} stopOpacity="0.28" />
          <stop offset="100%" stopColor={warna} stopOpacity="0" />
        </linearGradient>
      </defs>
      {area && <path d={area} fill={`url(#g${gid})`} stroke="none" />}
      <path
        d={garis}
        fill="none"
        stroke={warna}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={rata ? "4 5" : undefined}
        opacity={rata ? 0.55 : 1}
        vectorEffect="non-scaling-stroke"
      />
      {tandai && !rata && (
        /* Lingkaran akan jadi lonjong kalau ikut diregangkan, jadi digambar
           sebagai titik tebal bergaris-bulat — bentuknya tetap bundar. */
        <path
          d={`M ${akhir.x} ${akhir.y} l 0.01 0`}
          stroke={warna}
          strokeWidth="7"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      )}
    </svg>
  );
}

/* --- Tombol bulat mengambang ---------------------------------------------- */

export interface AksiKartu {
  ikon: IconName;
  label: string;
  onClick?: () => void;
}

/** Deret tombol ikon bulat di pojok kanan atas kartu. */
export function AksiBulat({ aksi }: { aksi: AksiKartu[] }) {
  if (aksi.length === 0) return null;
  return (
    <div className="kstat__aksi">
      {aksi.map((a) => (
        <button
          key={a.label}
          type="button"
          className="kstat__bulat"
          aria-label={a.label}
          title={a.label}
          onClick={a.onClick}
        >
          <Icon name={a.ikon} size={14} />
        </button>
      ))}
    </div>
  );
}

/* --- Kartu statistik ------------------------------------------------------ */

/**
 * Satu angka besar dengan grafik area di dasarnya.
 *
 * Urutan bacanya dari referensi, tidak diubah: ubin ikon + label sebaris di
 * atas, angka besar di bawahnya, lalu baris delta. Grafiknya paling bawah,
 * mepet tepi.
 */
export function KartuStatistik({
  label, nilai, ikon, warna = "var(--chart-1)", lembut,
  delta, deltaArah, deltaNada, banding, data = [], aksi = [], minus, catatan,
}: {
  label: string;
  nilai: string;
  ikon: IconName;
  warna?: string;
  lembut?: string;
  delta?: string;
  deltaArah?: "naik" | "turun";
  /**
   * Warna pil delta, dipisah dari arah panahnya.
   *
   * Untuk kas masuk, naik itu baik. Untuk beban operasional dan piutang,
   * naik itu buruk — dan kalau warnanya diturunkan langsung dari arah panah,
   * beban yang TURUN 3,6% tampil merah seolah kabar buruk. Bawaannya tetap
   * naik = baik, jadi kartu yang tidak menyebut apa-apa berperilaku wajar.
   */
  deltaNada?: "baik" | "buruk";
  banding?: string;
  data?: number[];
  aksi?: AksiKartu[];
  /** Warnai angkanya sebagai nilai negatif. */
  minus?: boolean;
  /** Dipakai saat belum ada sumber datanya — menggantikan grafik. */
  catatan?: string;
}) {
  return (
    <article className="kstat">
      <AksiBulat aksi={aksi} />
      <div className="kstat__isi">
        <div className="kstat__atas">
          <span className="kstat__ubin" style={{ background: lembut ?? "var(--tray)", color: warna }}>
            <Icon name={ikon} size={15} />
          </span>
          <span className="kstat__label">{label}</span>
        </div>
        <p className={`kstat__nilai${minus ? " angka-minus" : ""}`}>{nilai}</p>
        {(delta || banding) && (
          <p className="kstat__kaki">
            {delta && (
              <span className={`kstat__delta kstat__delta--${deltaNada ?? (deltaArah === "naik" ? "baik" : "buruk")}`}>
                <Icon name={deltaArah === "naik" ? "arrowUpRight" : "arrowDownRight"} size={11} />
                {delta}
              </span>
            )}
            {banding && <span className="kstat__banding">{banding}</span>}
          </p>
        )}
      </div>
      {catatan
        ? <p className="kstat__catatan">{catatan}</p>
        : <GrafikDasar data={data} warna={warna} />}
    </article>
  );
}

/* --- Dekorasi kartu utama ------------------------------------------------- */

const K = Math.cos(Math.PI / 6);

function iso(x: number, y: number, z: number): [number, number] {
  return [(x - y) * K, (x + y) * 0.5 - z];
}

function muka(t: Array<[number, number, number]>) {
  return t.map(([x, y, z]) => iso(x, y, z).join(",")).join(" ");
}

/**
 * Massa bangunan isometrik.
 *
 * Referensi memakai render 3D dekoratif yang tidak saya punya asetnya.
 * Ini penggantinya, dan sengaja bukan bentuk abstrak: studio arsitektur
 * memang menggambar massa seperti ini, jadi hiasannya masih bicara tentang
 * pekerjaan pemilik — bukan tempelan.
 */
function MassaIso() {
  const balok: Array<{ x: number; y: number; w: number; d: number; h: number; op: number }> = [
    { x: 0,   y: 0,   w: 2.2, d: 2.2, h: 3.4, op: 1 },
    { x: 2.4, y: 0.6, w: 1.6, d: 1.6, h: 2.0, op: 0.7 },
    { x: 0.3, y: 2.6, w: 1.6, d: 1.4, h: 1.2, op: 0.45 },
  ];
  return (
    <svg className="kstat__dekor" viewBox="-4.6 -3.8 9.6 8.4" aria-hidden="true" focusable="false">
      {balok.map((b) => {
        const atas = muka([
          [b.x, b.y, b.h], [b.x + b.w, b.y, b.h],
          [b.x + b.w, b.y + b.d, b.h], [b.x, b.y + b.d, b.h],
        ]);
        const kiri = muka([
          [b.x, b.y + b.d, b.h], [b.x + b.w, b.y + b.d, b.h],
          [b.x + b.w, b.y + b.d, 0], [b.x, b.y + b.d, 0],
        ]);
        const kanan = muka([
          [b.x + b.w, b.y, b.h], [b.x + b.w, b.y + b.d, b.h],
          [b.x + b.w, b.y + b.d, 0], [b.x + b.w, b.y, 0],
        ]);
        return (
          <g key={`${b.x}-${b.y}`} opacity={b.op} strokeWidth="0.05" strokeLinejoin="round">
            <polygon points={kiri} className="dekor__kiri" />
            <polygon points={kanan} className="dekor__kanan" />
            <polygon points={atas} className="dekor__atas" />
          </g>
        );
      })}
    </svg>
  );
}

/**
 * Kartu utama yang lebih besar: angka pokok periode ini, ditemani dekorasi.
 *
 * Di referensi kartu ini yang paling kiri dan paling menonjol. Isinya tetap
 * satu angka — yang membedakan cuma ukuran dan hiasannya.
 */
export function KartuUtama({
  label, nilai, banding, delta, deltaArah, deltaNada, chip, aksi = [], dekor,
}: {
  label: string;
  nilai: string;
  banding?: string;
  delta?: string;
  deltaArah?: "naik" | "turun";
  deltaNada?: "baik" | "buruk";
  chip?: string;
  aksi?: AksiKartu[];
  /** Ganti dekorasi bawaan. Kirim `null` untuk menghilangkannya. */
  dekor?: ReactNode | null;
}) {
  return (
    <article className="kstat kstat--utama">
      <AksiBulat aksi={aksi} />
      <div className="kstat__isi">
        {chip && <span className="kstat__chip">{chip}</span>}
        <span className="kstat__label">{label}</span>
        <p className="kstat__nilai kstat__nilai--besar">{nilai}</p>
        <p className="kstat__kaki">
          {delta && (
            <span className={`kstat__delta kstat__delta--${deltaNada ?? (deltaArah === "naik" ? "baik" : "buruk")}`}>
              <Icon name={deltaArah === "naik" ? "arrowUpRight" : "arrowDownRight"} size={11} />
              {delta}
            </span>
          )}
          {banding && <span className="kstat__banding">{banding}</span>}
        </p>
      </div>
      {dekor === undefined ? <MassaIso /> : dekor}
    </article>
  );
}
