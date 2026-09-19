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
  className?: string;
}) {
  const n = titik.length;
  const min = Math.min(...titik);
  const max = Math.max(...titik);
  const rentang = max - min || 1;
  /* Garisnya cuma memakai 68% tinggi teratas kotaknya — sisanya ruang untuk
     bidang gradien di bawahnya. Terukur: garis 42,20 dari kotak 61,68. */
  const tinggiGaris = tinggi * 0.684;
  const xs = titik.map((_, i) => (posisi ? posisi[i] : i / (n - 1)) * lebar);
  /* TANPA geseran +1. Sempat saya tambahkan supaya goresan setebal 2 tidak
     terpotong di tepi atas — dan itu menggeser SELURUH kurva satu piksel ke
     bawah, setengah tebal goresannya sendiri. Figma pun membiarkan
     separuhnya terpotong di sana; yang penting kurvanya berimpit. */
  const ys = titik.map((v) => tinggiGaris - ((v - min) / rentang) * tinggiGaris);
  /* Interpolasi kubik MONOTON (Fritsch-Carlson), bukan Catmull-Rom.
     Bedanya bukan soal kehalusan: Catmull-Rom MELAMPAUI titik datanya di
     tiap belokan, jadi grafik yang datanya tidak pernah turun tetap
     tergambar turun sedikit — kurva yang berbohong tentang angkanya.
     Monoton menahan lerengnya di tiap titik balik, dan justru itu yang
     membuat dataran-dataran panjang seperti di Figma. */
  const dx = xs.slice(1).map((x, i) => x - xs[i]);
  const lereng = ys.slice(1).map((y, i) => (y - ys[i]) / (dx[i] || 1));
  const m: number[] = [];
  for (let i = 0; i < n; i++) {
    if (i === 0) m.push(lereng[0]);
    else if (i === n - 1) m.push(lereng[n - 2]);
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
    const h = Math.hypot(a, b);
    if (h > 3) {
      m[i] = ((3 / h) * a) * lereng[i];
      m[i + 1] = ((3 / h) * b) * lereng[i];
    }
  }
  /* Titik kendali di 48% panjang ruas, BUKAN 33% yang jadi bawaan rumus
     Hermite.

     Ini yang membuat kurvanya terbaca halus, dan angkanya dibaca langsung
     dari path Figma: pada ruas (19,5;35,7)->(33;22,7) kendalinya di x26 dan
     x26,5 — keduanya 48% dari ujungnya. Sama di ruas lain: 44%, 48%, 53%.
     Pada 33% kurvanya menahan sebentar lalu membelok tajam, persis yang
     dilihat pemilik sebagai "terlalu tajam, tidak smooth".

     Angka 0,45 bukan tebakan dari melihat: kedua kurva dicuplik pada 400
     titik lalu jarak tegaknya diukur. Tangen monoton dengan kendali 0,45
     meleset rata-rata 0,33px dari kurva Figma; Catmull-Rom meleset 0,70px
     pada panjang kendali mana pun. */
  const F = 0.45;
  const d = xs
    .map((x, i) => {
      if (i === 0) return `M${x.toFixed(2)} ${ys[0].toFixed(2)}`;
      const h = dx[i - 1];
      /* Gagang di titik PERTAMA dan TERAKHIR dikuncupkan jadi nol — sama
         seperti di Figma, yang menulis titik kendali pertamanya tepat di
         atas titik awalnya. Efeknya kurva berangkat lurus dan tidak
         mengarang lengkung di ujung yang tidak punya tetangga. */
      const f1 = i === 1 ? 0 : F;
      const f2 = i === n - 1 ? 0 : F;
      const c1x = xs[i - 1] + f1 * h, c1y = ys[i - 1] + m[i - 1] * f1 * h;
      const c2x = x - f2 * h, c2y = ys[i] - m[i] * f2 * h;
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
          {/* 0,48 untuk tren naik dan 0,36 untuk tren turun — beda, dan itu
              memang begitu di Figma. Satu angka untuk keduanya membuat yang
              merah terbaca lebih pekat daripada seharusnya. */}
          <stop offset="0%" stopColor="currentColor" stopOpacity={turun ? 0.36 : 0.48} />
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
