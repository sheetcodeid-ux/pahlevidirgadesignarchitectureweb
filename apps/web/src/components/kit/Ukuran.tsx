import type { ReactNode } from "react";
import { Ikon, type DataIkon } from "./Ikon";

/* =============================================================================
   Ukuran — lima bentuk yang dipakai frame INTERFACE dan tidak ada di satu pun
   dari lima belas frame Style & Component.

   Itu sebabnya P2 tidak pernah membangunnya: pustaka komponennya memang
   dibangun dari lembar Style & Component, dan kelima bentuk ini cuma muncul
   di halaman jadinya. Ketahuannya waktu kotak wireframe ditumpuk di atas
   gambar framenya — bukan waktu angkanya dibaca, karena angka tidak pernah
   bisa bilang "yang ada di sini bar kemajuan, bukan sparkline".

   Kelimanya:

     1. `BarKemajuan`   — empat tempat di dua halaman
     2. `GrafikArea`    — dua bentuk: halus dan bertangga
     3. `Busur`         — setengah lingkaran bersegmen
     4. `KartuStatistikLebar` — ikon di KANAN, bukan di kiri atas

   Semua angkanya diukur dari ekspor SVG frame Interface-nya, dengan alat
   yang sama yang dipakai P2 — termasuk aturan bahwa <rect> anak langsung
   sebuah grup ADALAH panelnya, karena bbox grup Figma ikut memuat bayangan
   dan tumpukan kartu hias yang menjulur keluar.
   ============================================================================= */

const kelas = (...k: (string | false | undefined)[]) => k.filter(Boolean).join(" ");

/* -----------------------------------------------------------------------------
   1. Bar kemajuan.

   Dua bentuk, dan bedanya bukan gaya melainkan cara Figma menggambarnya:

   - `terpisah` (bawaan): DUA kotak bersebelahan dengan celah di antaranya —
     bagian terisi gelap, sisanya mint. Bukan satu rel dengan isian di
     atasnya. Terukur di frame Saving Plans: gelap 188,2 lalu mint 131,8
     dengan celah 4, total 324.
   - `tumpuk`: rel mint ber-radius 8 dengan isian gelap DI ATASNYA, tanpa
     celah. Dipakai pada bar besar di panel detail (252x51).

   Kalau keduanya disamakan jadi satu bentuk, yang kecil kehilangan celahnya
   dan yang besar kehilangan radiusnya — dua-duanya kelihatan.
   -------------------------------------------------------------------------- */
export interface PropBarKemajuan {
  /** 0–100. Di luar itu dijepit, karena bar yang melewati relnya adalah bug. */
  persen: number;
  bentuk?: "terpisah" | "tumpuk";
  /** Tinggi bar. Figma memakai 12 (daftar), 25 (kartu), 51 (panel detail). */
  tinggi?: number;
  /** Celah antar-potongan pada bentuk `terpisah`. 4 di tinggi 12, 6 di 25. */
  celah?: number;
  /** Dibacakan pembaca layar. Bar tanpa nama tidak bercerita apa pun. */
  judul: string;
  className?: string;
}

export function BarKemajuan({
  persen,
  bentuk = "terpisah",
  tinggi = 12,
  celah = 4,
  judul,
  className,
}: PropBarKemajuan) {
  const p = Math.min(100, Math.max(0, persen));
  const gaya = {
    "--k-bar-t": `${tinggi}px`,
    "--k-bar-celah": `${celah}px`,
    "--k-bar-isi": `${p}%`,
  } as React.CSSProperties;
  return (
    <div
      className={kelas("k-bar", `k-bar--${bentuk}`, className)}
      style={gaya}
      role="progressbar"
      aria-valuenow={Math.round(p)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={judul}
    >
      <span className="k-bar__isi" />
      <span className="k-bar__sisa" />
    </div>
  );
}

/* -----------------------------------------------------------------------------
   2. Grafik area.

   Kurvanya memakai tangen monoton Fritsch–Carlson, sama persis dengan
   `Kilau` di Grafik.tsx — dan itu disengaja: dua rumus kurva di satu panel
   pasti menyimpang, dan yang satu ini sudah dibuktikan berdampingan dengan
   framenya sampai 1,44% selisih piksel.

   Yang membedakannya dari `Kilau`: ia punya kisi, label sumbu, dan bisa
   menggambar DUA deret sekaligus. Dan ia punya bentuk kedua — `tangga`,
   yang dipakai frame Investments: nilainya bertahan sampai titik berikutnya
   lalu melompat, bukan melengkung.
   -------------------------------------------------------------------------- */
export interface DeretArea {
  titik: number[];
  /** `naik` hijau tua, `turun` mint. Mengikuti dua deret di framenya. */
  nada?: "utama" | "kedua";
}

export interface PropGrafikArea {
  deret: DeretArea[];
  /** Label di bawah plot — satu per titik, atau lebih sedikit kalau dijarangkan. */
  labelX?: ReactNode[];
  /** Label di kiri, dari ATAS ke bawah. Kisinya digambar di tiap label. */
  labelY?: ReactNode[];
  /** Tinggi bidang plot. Figma: 141 (Cashflow), 181 (Portfolio Value). */
  tinggi?: number;
  /**
   * Ruang kosong DI ATAS garis kisi teratas.
   *
   * Bukan hiasan: garis kurva setebal 2px yang menyentuh nilai tertinggi
   * akan terpotong separuh tanpa ruang itu. Figma menyisakan 29,5 di
   * Cashflow dan 17,7 di Portfolio Value — berbeda karena kurvanya memang
   * berbeda tinggi, jadi ia prop dan bukan angka tetap.
   */
  ruangAtas?: number;
  bentuk?: "halus" | "tangga";
  /** Nilai terbesar sumbu Y. Tanpa ini diambil dari datanya. */
  maks?: number;
  className?: string;
}

/** Tangen monoton Fritsch–Carlson — tidak pernah melampaui datanya sendiri. */
function tangen(xs: number[], ys: number[]) {
  const n = xs.length;
  const dx = xs.slice(1).map((x, i) => x - xs[i]);
  const lereng = ys.slice(1).map((y, i) => (y - ys[i]) / (dx[i] || 1));
  const m: number[] = [];
  for (let i = 0; i < n; i++) {
    if (i === 0) m.push(lereng[0] ?? 0);
    else if (i === n - 1) m.push(lereng[n - 2] ?? 0);
    else if (lereng[i - 1] * lereng[i] <= 0) m.push(0);
    else m.push((lereng[i - 1] + lereng[i]) / 2);
  }
  for (let i = 0; i < n - 1; i++) {
    if (lereng[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
      continue;
    }
    const a = m[i] / lereng[i];
    const b = m[i + 1] / lereng[i];
    const s = Math.hypot(a, b);
    if (s > 3) {
      m[i] = ((3 / s) * a) * lereng[i];
      m[i + 1] = ((3 / s) * b) * lereng[i];
    }
  }
  return m;
}

/** Panjang gagang Bezier. 0,45 dibaca dari kurva Figma, bukan 1/3 bawaan. */
const GAGANG = 0.45;

function jalur(xs: number[], ys: number[], bentuk: "halus" | "tangga") {
  const n = xs.length;
  if (n === 0) return "";
  if (bentuk === "tangga") {
    /* Nilainya bertahan sampai titik berikutnya lalu melompat tegak. Itu
       yang digambar frame Investments — dan itu berarti sesuatu: angkanya
       memang tidak berubah di antara dua pengukuran, bukan naik perlahan. */
    let d = `M${xs[0].toFixed(2)} ${ys[0].toFixed(2)}`;
    for (let i = 1; i < n; i++) {
      d += `H${xs[i].toFixed(2)}V${ys[i].toFixed(2)}`;
    }
    return d;
  }
  const m = tangen(xs, ys);
  return xs
    .map((x, i) => {
      if (i === 0) return `M${x.toFixed(2)} ${ys[0].toFixed(2)}`;
      const h = xs[i] - xs[i - 1];
      /* Gagang di kedua UJUNG dirapatkan ke nol. Tanpa itu kurvanya
         menjulur keluar bidang plot di titik pertama dan terakhir. */
      const f1 = i === 1 ? 0 : GAGANG;
      const f2 = i === n - 1 ? 0 : GAGANG;
      const c1x = xs[i - 1] + f1 * h;
      const c1y = ys[i - 1] + m[i - 1] * f1 * h;
      const c2x = x - f2 * h;
      const c2y = ys[i] - m[i] * f2 * h;
      return `C${c1x.toFixed(2)} ${c1y.toFixed(2)} ${c2x.toFixed(2)} ${c2y.toFixed(2)} ${x.toFixed(2)} ${ys[i].toFixed(2)}`;
    })
    .join(" ");
}

export function GrafikArea({
  deret,
  labelX,
  labelY,
  tinggi = 141,
  ruangAtas = 0,
  bentuk = "halus",
  maks,
  className,
}: PropGrafikArea) {
  const semua = deret.flatMap((d) => d.titik);
  const atas = maks ?? Math.max(1, ...semua);
  const LEBAR = 1000; // viewBox; lebar tampilnya dari CSS
  const id = `k-area-${bentuk}`;
  return (
    <div
      className={kelas("k-area", className)}
      style={{ "--k-area-t": `${tinggi}px`, "--k-area-atas": `${ruangAtas}px` } as React.CSSProperties}
    >
      {labelY && labelY.length > 0 && (
        <div className="k-area__labely">
          {labelY.map((v, i) => (
            <span key={i}>{v}</span>
          ))}
        </div>
      )}
      <div className="k-area__plot">
        {/* Kisi digambar CSS, bukan SVG: satu garis per label Y, dan
            keduanya lalu tidak mungkin menyimpang karena sumbernya sama. */}
        {labelY && labelY.length > 0 && (
          <div className="k-area__kisi" aria-hidden="true">
            {labelY.map((_, i) => (
              <span key={i} />
            ))}
          </div>
        )}
        <svg
          className="k-area__svg"
          viewBox={`0 0 ${LEBAR} ${tinggi}`}
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <defs>
            {deret.map((d, i) => (
              <linearGradient key={i} id={`${id}-${i}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="currentColor" stopOpacity={0.28} />
                <stop offset="100%" stopColor="currentColor" stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          {deret.map((d, i) => {
            const n = d.titik.length;
            const xs = d.titik.map((_, j) => (n < 2 ? 0 : (j / (n - 1)) * LEBAR));
            const ys = d.titik.map((v) => tinggi - (v / atas) * tinggi);
            const garis = jalur(xs, ys, bentuk);
            return (
              <g key={i} className={d.nada === "kedua" ? "k-area__deret k-area__deret--kedua" : "k-area__deret"}>
                <path d={`${garis} V${tinggi} H${xs[0]?.toFixed(2) ?? 0} Z`} fill={`url(#${id}-${i})`} />
                <path d={garis} fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" />
              </g>
            );
          })}
        </svg>
      </div>
      {labelX && labelX.length > 0 && (
        <div className="k-area__labelx">
          {labelX.map((v, i) => (
            <span key={i}>{v}</span>
          ))}
        </div>
      )}
    </div>
  );
}

/* -----------------------------------------------------------------------------
   3. Busur — setengah lingkaran bersegmen.

   Terukur di frame Investments: jari-jari luar 112, dalam 85 (jadi tebalnya
   27), setengah lingkaran penuh 180 derajat, celah 2 derajat antar-segmen.

   Digambar sebagai path arc, bukan sebagai lingkaran ber-`stroke-dasharray`.
   Dasharray menghitung celahnya dalam satuan PANJANG BUSUR, jadi celah yang
   sama terlihat berbeda lebar pada segmen yang berbeda besar — dan di
   framenya celahnya sama semua.
   -------------------------------------------------------------------------- */
export interface IrisBusur {
  nilai: number;
  /** Warna irisan. Di halaman dipakai `--ramp-1`..`--ramp-5`. */
  warna: string;
  label?: string;
}

export function Busur({
  iris,
  luar = 112,
  dalam = 85,
  celah = 2,
  tengah,
  className,
}: {
  iris: IrisBusur[];
  luar?: number;
  dalam?: number;
  /** Celah antar-irisan dalam DERAJAT, bukan piksel. */
  celah?: number;
  /** Isi lubang di tengahnya — nominal dan keterangannya. */
  tengah?: ReactNode;
  className?: string;
}) {
  const total = iris.reduce((a, b) => a + b.nilai, 0) || 1;
  const titik = (sudut: number, r: number) => {
    const rad = (sudut * Math.PI) / 180;
    return [luar + r * Math.cos(rad), luar - r * Math.sin(rad)];
  };
  let mulai = 180;
  const potong = iris.map((s) => {
    const lebar = (s.nilai / total) * 180;
    const a1 = mulai - celah / 2;
    const a2 = mulai - lebar + celah / 2;
    mulai -= lebar;
    const [x1, y1] = titik(a1, luar);
    const [x2, y2] = titik(a2, luar);
    const [x3, y3] = titik(a2, dalam);
    const [x4, y4] = titik(a1, dalam);
    const besar = a1 - a2 > 180 ? 1 : 0;
    return {
      ...s,
      d: `M${x1.toFixed(2)} ${y1.toFixed(2)} A${luar} ${luar} 0 ${besar} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} ` +
         `L${x3.toFixed(2)} ${y3.toFixed(2)} A${dalam} ${dalam} 0 ${besar} 0 ${x4.toFixed(2)} ${y4.toFixed(2)} Z`,
    };
  });
  return (
    <div className={kelas("k-busur", className)}>
      <svg viewBox={`0 0 ${luar * 2} ${luar}`} aria-hidden="true">
        {potong.map((s, i) => (
          <path key={i} d={s.d} fill={s.warna} />
        ))}
      </svg>
      {tengah && <div className="k-busur__tengah">{tengah}</div>}
    </div>
  );
}

/* -----------------------------------------------------------------------------
   4. Kartu statistik LEBAR — 385,7x87, ikon 56px di KANAN.

   Bukan varian lain dari `KartuStatistik`: yang itu ikonnya di kiri atas,
   angkanya di bawah, dan latarnya putih. Yang ini berlatar mint pucat,
   satu baris, dan ikonnya ubin bulat 56 di ujung kanan. Menyatukan keduanya
   lewat prop berarti satu komponen dengan dua tata letak yang tidak
   berhubungan — dan itu selalu berakhir jadi dua komponen juga, cuma lebih
   sulit dibaca.
   -------------------------------------------------------------------------- */
export function KartuStatistikLebar({
  judul,
  nilai,
  tren,
  ikon,
  ikonUkuran = 26,
  className,
}: {
  judul: ReactNode;
  nilai: ReactNode;
  /** Lencana tren — pakai `Tren` dari Kartu.tsx. */
  tren?: ReactNode;
  ikon: DataIkon;
  ikonUkuran?: number;
  className?: string;
}) {
  return (
    <div className={kelas("k-statlebar", className)}>
      <div className="k-statlebar__info">
        <p className="k-statlebar__judul">{judul}</p>
        <p className="k-statlebar__baris">
          <span className="k-statlebar__nilai">{nilai}</span>
          {tren}
        </p>
      </div>
      <span className="k-statlebar__ubin">
        <Ikon ikon={ikon} ukuran={ikonUkuran} />
      </span>
    </div>
  );
}
