import type { ReactNode } from "react";

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

export type NadaBatang = "mint" | "tua" | "hitam" | "pudar";

export interface BatangGrafik {
  /** Puncak batang, persen dari ATAS bidang plot. */
  atas: number;
  /** Dasar batang, persen dari ATAS bidang plot. 100 = menyentuh dasar. */
  bawah: number;
  nada?: NadaBatang;
  /** Radius sudut dalam px. Figma memakai 0, 6, 8, dan 12 tergantung varian. */
  radius?: number;
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
  className,
}: PropKolomGrafik) {
  return (
    <div
      className={["k-kolom", className].filter(Boolean).join(" ")}
      style={{ "--k-kolom-w": `${lebar}px`, "--k-kolom-h": `${tinggi}px` } as React.CSSProperties}
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
                top: `${b.atas}%`,
                height: `${b.bawah - b.atas}%`,
                borderRadius: b.radius ?? 0,
              }}
            />
          ))}
        </div>
      </div>
      {label !== undefined && <span className="k-kolom__label">{label}</span>}
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
  turun,
  lebar = 89.26,
  tinggi = 61.68,
  className,
}: {
  titik: number[];
  /** Tren menurun — garisnya merah, bukan hijau. */
  turun?: boolean;
  lebar?: number;
  tinggi?: number;
  className?: string;
}) {
  const n = titik.length;
  const min = Math.min(...titik);
  const max = Math.max(...titik);
  const rentang = max - min || 1;
  /* Garisnya cuma memakai 68% tinggi teratas kotaknya — sisanya ruang untuk
     bidang gradien di bawahnya. Terukur: garis 42,20 dari kotak 61,68. */
  const tinggiGaris = tinggi * 0.684;
  const xs = titik.map((_, i) => (i / (n - 1)) * lebar);
  const ys = titik.map((v) => tinggiGaris - ((v - min) / rentang) * tinggiGaris + 1);
  /* Kurva Catmull-Rom yang diubah jadi bezier kubik, bukan garis patah.
     Grafik mungil di Figma melengkung, dan garis patah membuatnya terbaca
     seperti data yang lain sama sekali — bukan sekadar "kurang halus". */
  const d = xs
    .map((x, i) => {
      if (i === 0) return `M${x.toFixed(2)} ${ys[0].toFixed(2)}`;
      const x0 = xs[Math.max(0, i - 2)], y0 = ys[Math.max(0, i - 2)];
      const x1 = xs[i - 1], y1 = ys[i - 1];
      const x3 = xs[Math.min(n - 1, i + 1)], y3 = ys[Math.min(n - 1, i + 1)];
      const c1x = x1 + (x - x0) / 6, c1y = y1 + (ys[i] - y0) / 6;
      const c2x = x - (x3 - x1) / 6, c2y = ys[i] - (y3 - y1) / 6;
      return `C${c1x.toFixed(2)} ${c1y.toFixed(2)} ${c2x.toFixed(2)} ${c2y.toFixed(2)} ${x.toFixed(2)} ${ys[i].toFixed(2)}`;
    })
    .join(" ");
  const id = `kilau-${turun ? "turun" : "naik"}`;
  return (
    <svg
      className={["k-kilau", className].filter(Boolean).join(" ")}
      width={lebar}
      height={tinggi}
      viewBox={`0 0 ${lebar} ${tinggi}`}
      fill="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.35" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${d} L${lebar} ${tinggi} L0 ${tinggi} Z`} fill={`url(#${id})`} />
      <path d={d} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* -----------------------------------------------------------------------------
   Sel tanggal & sel hari — frame Calendar.

   Empat keadaan: biasa, mati (tanggal di luar bulan ini), dipilih (bulatan
   persik), dan hari ini (bulatan mint). Bulatannya 24px; angkanya 12px.

   Warnanya memakai palet KEDUA file Figma — beige/mint yang sama seperti
   kotak centang dan sakelar, bukan hijau Coinest. Itu memang begitu di
   file-nya, dan dicatat apa adanya lewat token supaya pemilik bisa
   menyeragamkannya belakangan kalau mau.
   -------------------------------------------------------------------------- */
export type KeadaanTanggal = "biasa" | "mati" | "pilih" | "kini";

export function SelTanggal({
  children,
  keadaan = "biasa",
  ...sisa
}: { children: ReactNode; keadaan?: KeadaanTanggal } & React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span className={`k-tgl k-tgl--${keadaan}`} {...sisa}>
      {children}
    </span>
  );
}

export function SelHari({ children }: { children: ReactNode }) {
  return <span className="k-hari">{children}</span>;
}
