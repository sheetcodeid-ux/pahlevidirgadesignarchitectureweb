import type { ReactNode } from "react";
import { Ikon, type DataIkon } from "./Ikon";
import { TrendUp, TrendDown } from "./ikon";

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

/**
 * Letak tiap titik pada lebar plot, 0..1.
 *
 * Perlu karena kurva Figma TIDAK menaruh titiknya rata: tujuh titik datanya
 * duduk di tengah kolom, lalu ada dua titik tambahan di tepi kiri dan kanan
 * plot supaya garisnya sampai ke ujung. Sembilan titik yang dibagi rata
 * menggeser semuanya, dan kurvanya lalu mirip tapi tidak pernah berimpit.
 */
export type PosisiArea = number[];

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
  /**
   * Jarak dari garis kisi terbawah ke kotak label X.
   *
   * Prop, bukan angka tetap, karena keduanya harus disetel BERSAMA
   * `ruangAtas` supaya garis kisinya mendarat tepat — dan kisi yang meleset
   * menggeser seluruh kurvanya. Terukur: Cashflow 29,5 + 16, Portfolio
   * Value 25,5 + 18,5.
   */
  jarakLabelX?: number;
  bentuk?: "halus" | "tangga";
  /** Letak tiap titik 0..1. Tanpa ini dibagi rata. */
  posisi?: PosisiArea;
  /**
   * Titik yang sedang disorot — kartu keterangan, penanda, garis putus.
   *
   * Ada di framenya, dan bukan hiasan: grafik tanpa cara membaca satu titik
   * cuma bercerita tentang bentuk, tidak pernah tentang angka.
   */
  sorot?: { indeks: number; deret?: number; judul: ReactNode; nilai: ReactNode; ket?: ReactNode };
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

/** Warna satu deret. Disebut eksplisit karena gradien tidak mewarisi. */
const warnaDeret = (d: DeretArea) =>
  d.nada === "kedua" ? "var(--brand-mint)" : "var(--brand)";

/**
 * Kepekatan bidang di bawah garis — BERBEDA antar deret.
 *
 * Terukur langsung dari stop gradien framenya: mint 0,24 dan hijau tua
 * 0,16, di grafik Cashflow maupun Portfolio Value. Sempat saya samakan 0,28
 * untuk keduanya, dan bidang hijau tua lalu tergambar hampir dua kali lebih
 * pekat — terlihat jelas di peta selisih sebagai bidang yang menggelap,
 * sementara angka kotaknya tetap cocok sempurna.
 */
const pekatDeret = (d: DeretArea) => (d.nada === "kedua" ? 0.24 : 0.16);

/** Panjang gagang Bezier. 0,45 dibaca dari kurva Figma, bukan 1/3 bawaan. */
const GAGANG = 0.45;

function jalur(xs: number[], ys: number[], bentuk: "halus" | "tangga") {
  const n = xs.length;
  if (n === 0) return "";
  if (bentuk === "tangga") {
    /* N nilai = N anak tangga, jadi N+1 batas kolom. Sempat digambar sebagai
       N titik yang disambung — hasilnya N−1 tangga, dan nilai terakhirnya
       kehilangan bidang datarnya sama sekali. Terukur di frame Investments:
       20 simpul untuk 10 nilai, yaitu sepasang per nilai. */
    const w = xs[xs.length - 1];
    const lebar = w / n;
    let d = `M0 ${ys[0].toFixed(2)}`;
    for (let i = 0; i < n; i++) {
      d += `H${((i + 1) * lebar).toFixed(2)}`;
      if (i < n - 1) d += `V${ys[i + 1].toFixed(2)}`;
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
  jarakLabelX = 17.8,
  bentuk = "halus",
  posisi,
  sorot,
  maks,
  className,
}: PropGrafikArea) {
  const semua = deret.flatMap((d) => d.titik);
  const atas = maks ?? Math.max(1, ...semua);
  const LEBAR = 1000; // viewBox; lebar tampilnya dari CSS
  const id = `k-area-${bentuk}`;
  /* Letak penanda sorot dalam PERSEN lebar plot — bukan piksel, karena
     lebar plotnya ditentukan CSS dan baru diketahui di browser. */
  const sD = deret[sorot?.deret ?? 0];
  const nS = sD?.titik.length ?? 0;
  const sorotX =
    sorot === undefined || nS === 0
      ? 0
      : bentuk === "tangga"
        ? ((sorot.indeks + 0.5) / nS) * 100
        : (posisi ? posisi[sorot.indeks] : nS < 2 ? 0 : sorot.indeks / (nS - 1)) * 100;
  const sorotY =
    sorot === undefined || !sD ? 0 : (1 - sD.titik[sorot.indeks] / atas) * 100;
  return (
    <div
      className={kelas("k-area", className)}
      style={
        {
          "--k-area-t": `${tinggi}px`,
          "--k-area-atas": `${ruangAtas}px`,
          "--k-area-jarakx": `${jarakLabelX}px`,
        } as React.CSSProperties
      }
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
              /* Warnanya DISEBUT, bukan `currentColor`. Stop gradien tidak
                 mewarisi `color` dari elemen yang memakainya — ia
                 diselesaikan di tempat gradiennya didefinisikan, yaitu
                 <defs>, yang warnanya abu bawaan. Akibatnya bidang di bawah
                 kedua garis tergambar ABU, bukan mint dan hijau. Tidak ada
                 galat; yang salah cuma warnanya, dan itu baru kelihatan
                 waktu ditempel di samping framenya. */
              <linearGradient key={i} id={`${id}-${i}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={warnaDeret(deret[i])} stopOpacity={pekatDeret(deret[i])} />
                <stop offset="100%" stopColor={warnaDeret(deret[i])} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          {deret.map((d, i) => {
            const n = d.titik.length;
            const xs = d.titik.map((_, j) =>
              posisi ? posisi[j] * LEBAR : n < 2 ? 0 : (j / (n - 1)) * LEBAR,
            );
            const ys = d.titik.map((v) => tinggi - (v / atas) * tinggi);
            const garis = jalur(xs, ys, bentuk);
            return (
              <g key={i} className={d.nada === "kedua" ? "k-area__deret k-area__deret--kedua" : "k-area__deret"}>
                <path d={`${garis} V${tinggi} H${xs[0]?.toFixed(2) ?? 0} Z`} fill={`url(#${id}-${i})`} />
                <path
                  d={garis}
                  fill="none"
                  stroke={warnaDeret(d)}
                  strokeWidth="2"
                  vectorEffect="non-scaling-stroke"
                />
              </g>
            );
          })}
        </svg>
        {sorot && (
          <div className="k-area__sorot" style={{ left: `${sorotX}%` }}>
            <div className="k-area__kartu">
              <p className="k-area__kjudul">{sorot.judul}</p>
              <p className="k-area__knilai">{sorot.nilai}</p>
              {sorot.ket && <p className="k-area__kket">{sorot.ket}</p>}
            </div>
            {bentuk === "tangga" ? (
              <span className="k-area__pita" style={{ top: `${sorotY}%` }} />
            ) : (
              <>
                <span className="k-area__garis" style={{ top: `${sorotY}%` }} />
                <span className="k-area__titik" style={{ top: `${sorotY}%` }} />
              </>
            )}
          </div>
        )}
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
  sudut = 8,
  label,
  nilai,
  tanda,
  ket,
  className,
}: {
  iris: IrisBusur[];
  luar?: number;
  dalam?: number;
  /** Celah antar-irisan dalam DERAJAT, bukan piksel. */
  celah?: number;
  /**
   * Radius keempat sudut tiap irisan.
   *
   * Bukan hiasan — ujung irisan di framenya MEMBULAT, dan potongan lurus
   * terlihat tajam berdampingan dengannya. Terukur pada irisan terkecil
   * (18 derajat): kotaknya 29,4x33,1, sementara sudut siku memberi
   * 31,2x34,6. Selisih ~1,6 ke dalam itu yang dibayar oleh pembulatan.
   */
  sudut?: number;
  /* Tiga baris di lubang tengahnya. Dibuat prop dan bukan satu slot bebas
     karena jaraknya diukur: label 10px, nominal 24px, keterangan 10px,
     dengan celah 6,1 dan 8,1 — angka yang tidak mungkin ditebak pemanggil. */
  label?: ReactNode;
  nilai?: ReactNode;
  /** Bagian bertinta gelap di baris ketiga, mis. "+5%". */
  tanda?: ReactNode;
  ket?: ReactNode;
  className?: string;
}) {
  const total = iris.reduce((a, b) => a + b.nilai, 0) || 1;
  const titik = (sudut: number, r: number) => {
    const rad = (sudut * Math.PI) / 180;
    return [luar + r * Math.cos(rad), luar - r * Math.sin(rad)];
  };
  let mulai = 180;
  const potong = iris.map((s, i) => {
    const lebar = (s.nilai / total) * 180;
    /* Celahnya diambil dari UJUNG irisan saja, bukan dibagi dua sisi. Itu
       yang digambar framenya: tiap irisan mulai PERSIS di batas bagiannya
       (81, 45, 18 derajat untuk 55/20/15/10) dan berhenti 2 derajat sebelum
       batas berikutnya. Dibagi dua, keempat irisan menyempit 2 derajat DAN
       bergeser 1 derajat searah jarum jam — terukur meleset 2px di tiap
       irisan, dan itu kelihatan sebagai busur yang kependekan.

       Irisan terakhir tidak diberi celah: di framenya ia berhenti tepat di
       0 derajat, yaitu di garis dasar setengah lingkarannya. */
    const a1 = mulai;
    const a2 = mulai - lebar + (i === iris.length - 1 ? 0 : celah);
    mulai -= lebar;
    /* Radius sudut dijepit supaya irisan sempit tidak melipat ke dalam
       dirinya sendiri: setengah tebal cincin, dan setengah panjang busur
       terpendeknya. Tanpa jepitan ini irisan 2 derajat tergambar sebagai
       simpul, bukan sebagai potongan. */
    const rc = Math.max(
      0,
      Math.min(sudut, (luar - dalam) / 2, ((a1 - a2) * Math.PI * dalam) / 180 / 2),
    );
    const dLuar = (rc / luar) * (180 / Math.PI);   // derajat setara rc di busur luar
    const dDalam = (rc / dalam) * (180 / Math.PI); // ... dan di busur dalam
    const P = (a: number, r: number) => titik(a, r).map((v) => v.toFixed(2)).join(" ");
    const besar = a1 - a2 > 180 ? 1 : 0;
    /* Urutannya: busur luar, lengkung ke garis jari-jari, masuk, lengkung ke
       busur dalam, balik, lengkung, keluar, lengkung menutup. Delapan
       potongan untuk satu irisan — dan itu memang yang digambar Figma. */
    const d =
      `M${P(a1 - dLuar, luar)} ` +
      `A${luar} ${luar} 0 ${besar} 1 ${P(a2 + dLuar, luar)} ` +
      `A${rc} ${rc} 0 0 1 ${P(a2, luar - rc)} ` +
      `L${P(a2, dalam + rc)} ` +
      `A${rc} ${rc} 0 0 1 ${P(a2 + dDalam, dalam)} ` +
      `A${dalam} ${dalam} 0 ${besar} 0 ${P(a1 - dDalam, dalam)} ` +
      `A${rc} ${rc} 0 0 1 ${P(a1, dalam + rc)} ` +
      `L${P(a1, luar - rc)} ` +
      `A${rc} ${rc} 0 0 1 ${P(a1 - dLuar, luar)} Z`;
    return { ...s, d };
  });
  return (
    <div className={kelas("k-busur", className)}>
      <svg viewBox={`0 0 ${luar * 2} ${luar}`} aria-hidden="true">
        {potong.map((s, i) => (
          <path key={i} d={s.d} fill={s.warna} />
        ))}
      </svg>
      {(label || nilai || ket) && (
        <div className="k-busur__tengah">
          {label && <p className="k-busur__label">{label}</p>}
          {nilai && <p className="k-busur__nilai">{nilai}</p>}
          {(tanda || ket) && (
            <p className="k-busur__ket">
              {tanda && <b>{tanda}</b>}
              {ket}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/* -----------------------------------------------------------------------------
   4a. Lencana tren 54x17 — BUKAN `Tren` dari Kartu.tsx.

   Ada DUA lencana tren di file Figma ini, dan mereka berbeda ukuran:

     frame Badges → 49x12, tanpa latar   → `Tren` di Kartu.tsx
     frame halaman → 54x17 r8,5, mint    → yang ini

   Yang 49x12 sempat dipakai di kartu statistik lebar dan di baris watchlist,
   dan hasilnya lencana yang jelas kekecilan berdampingan dengan framenya —
   terlihat sebagai pil mint pejal di peta selisih. Angka saja tidak
   menangkapnya, karena lencananya slot bebas dan kotak kartunya tetap cocok.
   -------------------------------------------------------------------------- */
export function LencanaTren({
  naik = true,
  baik = naik,
  children,
  className,
}: {
  naik?: boolean;
  /** Apakah arah itu kabar baik. Arah dan penilaian dua hal berbeda. */
  baik?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={kelas("k-trenlebar", !baik && "k-trenlebar--buruk", className)}>
      <Ikon ikon={naik ? TrendUp : TrendDown} ukuran={9} />
      {children}
    </span>
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
