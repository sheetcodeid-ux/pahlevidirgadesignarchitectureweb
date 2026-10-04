import { useState, type ReactNode } from "react";
import { KartuGrafik, usePenunjuk, type BarisKartu } from "./kartuGrafik";

/* =============================================================================
   Grafik — frame Chart di file Figma Coinest.

   Delapan varian kolom di frame itu (Y-labels, Default, Up Down, Single,
   Up Down v2, Phil, Double, Tripple) sekali lagi BUKAN delapan komponen.
   Kerangkanya sama di semuanya: kolom selebar 45, bidang plot setinggi 152
   dengan lima garis kisi berjarak 38, dan label sumbu-X 21 di bawah garis
   terakhir. Yang berbeda cuma batang di dalamnya — berapa buah, selebar apa,
   dari mana ke mana, dan warnanya.

   Jadi batangnya dikirim sebagai data, dalam PERSEN terhadap bidang plot.
   Persen, bukan piksel: tinggi bidang plot berubah per halaman, dan angka
   piksel yang diambil dari satu frame akan diam-diam salah di halaman lain.
   ============================================================================= */

/**
 * `mintpudar` / `tuapudar`: batang yang TIDAK disorot di grafik arus kas
 * frame 19 — bidang gradien (mint 24% → 0, hijau tua 16% → 0) dengan tepi
 * pejal 1,5px di ujung LUARNYA saja: atas untuk batang positif, bawah untuk
 * batang negatif. Terbaca dari path-nya: satu rect bergradien dan satu rect
 * 3px yang dimask separuh.
 */
export type NadaBatang = "mint" | "tua" | "hitam" | "pudar" | "mintpudar" | "tuapudar";

export interface BatangGrafik {
  /** Puncak batang, persen dari ATAS bidang plot. */
  atas: number;
  /** Dasar batang, persen dari ATAS bidang plot. 100 = menyentuh dasar. */
  bawah: number;
  nada?: NadaBatang;
  /**
   * Radius sudut ATAS saja, dalam px.
   *
   * Batang di Figma membulat cuma di sudut LUARNYA: yang tumbuh ke atas
   * membulat di atas dan rata di garis dasarnya, yang tumbuh ke bawah
   * sebaliknya. Radiusnya sempat saya baca NOL di keempat varian, dan itu
   * salah baca: Figma memanggang lengkungnya ke dalam data path sebagai
   * kurva bezier, bukan menulisnya sebagai atribut `rx` — jadi mencari `rx`
   * menjawab "tidak ada radius" untuk batang yang jelas-jelas membulat.
   *
   * Yang benar: Up Down 4, Tripple 3 — keduanya busur lingkaran biasa —
   * dan Double 4 juga, BUKAN 7,2 seperti bacaan pertama. Sudut Double
   * dipakaikan corner smoothing Figma, yang menggambar satu sudut dengan
   * TIGA ruas bezier membentang 7,2 di sepanjang tepinya padahal
   * lengkungnya sendiri setara radius 4. Membaca rentang path-nya sebagai
   * radius membuat batang selebar 15,5 nyaris jadi pil.
   *
   * Yang membuktikan angkanya bukan path-nya melainkan PROFIL SUDUTNYA —
   * lebar batang yang benar-benar tergambar pada tiap baris piksel dari
   * puncak. Figma sudah 93% lebar penuh pada 2px dari puncak; radius 7,2
   * baru 73%. Radius 4 cocok di seluruh titik ukur: selisih 0,02-0,06px.
   */
  radiusAtas?: number;
  /** Radius sudut BAWAH saja. Dipakai potongan negatif varian Up Down. */
  radiusBawah?: number;
  /** Keempat sudut sekaligus — varian Single, yang rect-nya memang rx 6. */
  radius?: number;
  /**
   * Warna bebas, menimpa `nada`. Dipakai grafik bertumpuk yang potongannya
   * kategori — Profits di frame Investments memakai EMPAT rona (tangga
   * `--ramp-1..4`), dan nada tetap cuma punya dua yang cocok.
   */
  warna?: string;
}

export interface PropKolomGrafik {
  batang?: BatangGrafik[];
  /** Label sumbu-X di bawah kolom. */
  label?: ReactNode;
  /** Lebar tiap batang dalam px. Figma: 27 / 31 / 29 / 15,5 / 6,67. */
  lebarBatang?: number;
  /** Jarak antarbatang dalam px. Figma: 0 pada Double, 4 pada Tripple. */
  celah?: number;
  /** Rel abu di belakang batang — varian "Phil". */
  rel?: boolean;
  /**
   * Batangnya BERTUMPUK pada sumbu yang sama, bukan berjajar.
   *
   * Varian "Up Down" di Figma adalah SATU batang yang terbelah di garis
   * tengah: bagian atas hijau tua, bagian bawah mint. Dibiarkan berjajar,
   * keduanya berdiri bersebelahan dan grafiknya bercerita hal yang sama
   * sekali berbeda — terukur 22,3% selisih piksel, cacat terbesar di seluruh
   * kelompok ini.
   */
  tumpuk?: boolean;
  /** Tinggi bidang plot. Figma 152. */
  tinggi?: number;
  /** Lebar kolom. Figma 45. */
  lebar?: number;
  /**
   * Isi kartu saat kursor ada di kolom ini — angka penuh tiap potongan.
   * Kolomnya lalu juga bisa difokus papan ketik.
   */
  keterangan?: { judul: ReactNode; baris: BarisKartu[] };
  /** Sisi kartu terhadap kolom. Kolom di separuh kanan grafik: "kiri". */
  sisiKartu?: "kanan" | "kiri";
  className?: string;
}

export function KolomGrafik({
  batang = [],
  label,
  lebarBatang = 27,
  celah = 0,
  rel,
  tumpuk,
  tinggi = 152,
  lebar = 45,
  keterangan,
  sisiKartu = "kanan",
  className,
}: PropKolomGrafik) {
  return (
    <div
      className={["k-kolom", keterangan && "k-kolom--sentuh", className].filter(Boolean).join(" ")}
      style={{ "--k-kolom-w": `${lebar}px`, "--k-kolom-h": `${tinggi}px` } as React.CSSProperties}
      tabIndex={keterangan ? 0 : undefined}
    >
      <div className="k-kolom__bidang">
        {/* Lima garis kisi, bukan empat: garis pertama duduk DI PUNCAK bidang
            plot dan yang terakhir di dasarnya. Terukur di y 26/64/102/140/178
            pada bidang 26..178. */}
        {[0, 1, 2, 3, 4].map((i) => (
          <span key={i} className="k-kolom__garis" style={{ top: `${i * 25}%` }} />
        ))}
        {rel && <span className="k-kolom__rel" />}
        <div
          className={["k-kolom__batang", tumpuk && "k-kolom__batang--tumpuk"].filter(Boolean).join(" ")}
          style={{ gap: `${celah}px` }}
        >
          {batang.map((b, i) => (
            <span
              key={i}
              className={`k-kolom__b k-kolom__b--${b.nada ?? "mint"}`}
              style={{
                width: lebarBatang,
                ...(b.warna ? { background: b.warna } : {}),
                top: `${b.atas}%`,
                height: `${b.bawah - b.atas}%`,
                borderRadius:
                  b.radius !== undefined
                    ? b.radius
                    : `${b.radiusAtas ?? 0}px ${b.radiusAtas ?? 0}px ${b.radiusBawah ?? 0}px ${b.radiusBawah ?? 0}px`,
              }}
            />
          ))}
        </div>
      </div>
      {label !== undefined && <span className="k-kolom__label">{label}</span>}
      {keterangan && (
        <div className={`k-grafikkartu k-kolom__kartu k-kolom__kartu--${sisiKartu}`} role="tooltip">
          <p className="k-grafikkartu__judul">{keterangan.judul}</p>
          {keterangan.baris.map((b, i) => (
            <p className="k-grafikkartu__baris" key={i}>
              {b.warna && <span className="k-grafikkartu__warna" style={{ background: b.warna }} />}
              <span className="k-grafikkartu__label">{b.label}</span>
              <b>{b.nilai}</b>
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

/* -----------------------------------------------------------------------------
   Label sumbu-Y — lima baris 10px yang BERPUSAT pada garis kisinya, bukan
   duduk di atasnya. Terukur: tinta 22,37..29,63 berpusat tepat di garis y26.
   -------------------------------------------------------------------------- */
export function LabelYGrafik({ nilai, tinggi = 152 }: { nilai: ReactNode[]; tinggi?: number }) {
  /* Label dipasang absolut supaya bisa berpusat tepat di garis kisinya — dan
     anak absolut tidak memberi lebar apa pun kepada induknya, jadi kotaknya
     jadi 0 lebar. Ditutup dengan satu salinan STATIS yang tidak tergambar:
     ia yang menentukan lebar kolom label, dan lebarnya otomatis mengikuti
     angka terpanjang tanpa ada yang perlu menghitungnya. */
  const terpanjang = nilai.reduce(
    (a, b) => (String(b).length > String(a).length ? b : a),
    nilai[0] ?? "",
  );
  return (
    <div className="k-labely" style={{ "--k-kolom-h": `${tinggi}px` } as React.CSSProperties}>
      <span className="k-labely__ukur" aria-hidden="true">
        {terpanjang}
      </span>
      {nilai.map((v, i) => (
        <span key={i} className="k-labely__b" style={{ top: `${i * 25}%` }}>
          {v}
        </span>
      ))}
    </div>
  );
}

/* -----------------------------------------------------------------------------
   Kilau — grafik garis mungil di dalam kartu ("Chart on Card" di Figma).

   Digambar dari DATA, bukan menyalin path Figma. Kurvanya karena itu tidak
   akan pernah persis sama dengan framenya: yang di Figma digambar tangan,
   yang di sini dihitung dari angka. Yang harus sama dan bisa diperiksa:
   ukuran kotaknya (89,26x61,68), tinggi garisnya (42,20), warnanya, dan
   gradien bidang di bawah garisnya.
   -------------------------------------------------------------------------- */
export function Kilau({
  titik,
  posisi,
  turun,
  lebar = 89.26,
  tinggi = 61.68,
  keterangan,
  className,
}: {
  titik: number[];
  /**
   * Letak tiap titik pada sumbu-X, 0..1. Kalau tidak diisi, titiknya dibagi
   * rata.
   *
   * Ada karena deret waktu jarang berjarak rata — dan karena kurva di Figma
   * memang tidak: titiknya di 0 / 7,3% / 21,8% / 37% / 53,8% / 71,7% / 90,2%
   * / 100%. Tanpa ini, bentuk kurvanya tidak akan pernah bisa dibandingkan.
   */
  posisi?: number[];
  /** Tren menurun — garisnya merah, bukan hijau. */
  turun?: boolean;
  lebar?: number;
  tinggi?: number;
  /** Isi kartu untuk titik yang disentuh kursor, mis. bulan dan nominalnya. */
  keterangan?: (indeks: number) => { judul: ReactNode; nilai: ReactNode };
  className?: string;
}) {
  const pen = usePenunjuk();
  const [arah, setArah] = useState<number | null>(null);
  const n = titik.length;
  const min = Math.min(...titik);
  const max = Math.max(...titik);
  const rentang = max - min || 1;
  /* Garisnya cuma memakai 68% tinggi teratas kotaknya — sisanya ruang untuk
     bidang gradien di bawahnya. Terukur: garis 42,20 dari kotak 61,68. */
  const tinggiGaris = tinggi * 0.684;
  const xs = titik.map((_, i) => (posisi ? posisi[i] : i / (n - 1)) * lebar);
  /* Kurva SPLINE ALAMI (natural cubic spline), lalu diskalakan supaya
     seluruh lengkungnya — termasuk puncak yang melampaui titik data — muat
     di [1, tinggiGaris].

     Dulu interpolasi kubik MONOTON (Fritsch-Carlson). Ia jujur pada data,
     tapi justru itu yang ditolak pemilik: dua bulan yang hampir sama tinggi
     dipaksa jadi DATARAN lurus dengan dua siku di ujungnya, dan puncaknya
     terbaca terpotong ("lengkungannya ga ada"). Spline alami lewat persis
     di tiap titik data dan menyambungkannya dengan lengkung yang menerus
     (turunan kedua kontinu), jadi dataran itu jadi kubah. Melampaui sedikit
     di puncak adalah harga yang diterima di garis mungil tanpa sumbu —
     angka sebenarnya dibaca dari kartu keterangan saat disentuh, dan
     titiknya tetap duduk persis di kurva karena kurvanya melewati titik
     datanya. */
  const ys0 = titik.map((v) => tinggiGaris - ((v - min) / rentang) * tinggiGaris);
  const dx = xs.slice(1).map((x, i) => x - xs[i] || 1);
  /* Turunan kedua M_i: M_0 = M_n-1 = 0, sistem tridiagonal untuk yang di
     tengah (algoritma Thomas). */
  const M = new Array<number>(n).fill(0);
  if (n > 2) {
    const k = n - 2;
    const sub: number[] = [], diag: number[] = [], sup: number[] = [], rhs: number[] = [];
    for (let i = 1; i <= k; i++) {
      sub.push(dx[i - 1]);
      diag.push(2 * (dx[i - 1] + dx[i]));
      sup.push(dx[i]);
      rhs.push(6 * ((ys0[i + 1] - ys0[i]) / dx[i] - (ys0[i] - ys0[i - 1]) / dx[i - 1]));
    }
    for (let i = 1; i < k; i++) {
      const w = sub[i] / diag[i - 1];
      diag[i] -= w * sup[i - 1];
      rhs[i] -= w * rhs[i - 1];
    }
    for (let i = k - 1; i >= 0; i--) M[i + 1] = (rhs[i] - (i < k - 1 ? sup[i] * M[i + 2] : 0)) / diag[i];
  }
  /* Kemiringan di tiap titik, lalu tiap ruas jadi Bézier kubik yang SAMA
     PERSIS dengan ruas splinenya (kendali di sepertiga ruas). */
  const m0 = xs.map((_, i) =>
    i < n - 1
      ? (ys0[i + 1] - ys0[i]) / dx[i] - (dx[i] * (2 * M[i] + M[i + 1])) / 6
      : (ys0[i] - ys0[i - 1]) / dx[i - 1] + (dx[i - 1] * (M[i - 1] + 2 * M[i])) / 6,
  );
  const ruas = dx.map((_, j) => {
    const h = dx[j];
    return [ys0[j], ys0[j] + (m0[j] * h) / 3, ys0[j + 1] - (m0[j + 1] * h) / 3, ys0[j + 1]];
  });
  /* Batas tegak kurva yang SEBENARNYA (dicuplik), lalu skala afin ke
     [1, tinggiGaris] — 1, bukan 0, supaya goresan 2px-nya utuh. */
  let atas = Infinity, bawah = -Infinity;
  for (const [p0, p1, p2, p3] of ruas)
    for (let t = 0; t <= 1; t += 0.05) {
      const u = 1 - t;
      const y = u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
      if (y < atas) atas = y;
      if (y > bawah) bawah = y;
    }
  if (!Number.isFinite(atas)) { atas = 0; bawah = tinggiGaris; }
  const skala = bawah - atas > 0.01 ? (tinggiGaris - 1) / (bawah - atas) : 1;
  const ty = (y: number) => 1 + (y - atas) * skala;
  const ys = ys0.map(ty);
  const d = xs
    .map((x, i) => {
      if (i === 0) return `M${x.toFixed(2)} ${ys[0].toFixed(2)}`;
      const h = dx[i - 1];
      const [, c1, c2] = ruas[i - 1];
      return `C${(xs[i - 1] + h / 3).toFixed(2)} ${ty(c1).toFixed(2)} ${(x - h / 3).toFixed(2)} ${ty(c2).toFixed(2)} ${x.toFixed(2)} ${ys[i].toFixed(2)}`;
    })
    .join(" ");
  const id = `kilau-${turun ? "turun" : "naik"}`;
  const svg = (
    <svg
      className={["k-kilau", turun && "k-kilau--turun", !keterangan && className].filter(Boolean).join(" ")}
      width={lebar}
      height={tinggi}
      viewBox={`0 0 ${lebar} ${tinggi}`}
      fill="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          {/* 0,30 / 0,28 — lebih tipis daripada 0,48 / 0,36 milik Figma. Di sana
              garis naiknya biru tua; di panel ini hijau brand, dan bidang hijau
              tua 48% tergambar sebagai lempeng abu gelap yang lebih berat
              daripada angka di bawahnya. */}
          <stop offset="0%" stopColor="currentColor" stopOpacity={turun ? 0.28 : 0.3} />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${d} L${lebar} ${tinggi} L0 ${tinggi} Z`} fill={`url(#${id})`} />
      <path d={d} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {arah !== null && (
        <circle className="k-kilau__titik" cx={xs[arah]} cy={ys[arah]} r="3.5" />
      )}
    </svg>
  );
  if (!keterangan) return svg;
  const ket = arah !== null ? keterangan(arah) : null;
  return (
    <span
      ref={pen.ref as unknown as React.Ref<HTMLSpanElement>}
      className={["k-kilau__wadah", className].filter(Boolean).join(" ")}
      onPointerMove={(e) => {
        pen.gerak(e);
        const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const f = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
        let i = 0;
        for (let j = 1; j < n; j++) if (Math.abs(xs[j] / lebar - f) < Math.abs(xs[i] / lebar - f)) i = j;
        setArah(i);
      }}
      onPointerLeave={() => {
        pen.lepas();
        setArah(null);
      }}
    >
      {svg}
      {ket && pen.pos && (
        <KartuGrafik x={pen.pos.x} y={pen.pos.y} baris={[{ label: ket.judul, nilai: ket.nilai }]} />
      )}
    </span>
  );
}
