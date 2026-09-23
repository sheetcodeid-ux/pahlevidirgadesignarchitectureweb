import type { ReactNode } from "react";
import { Ikon, type DataIkon } from "./Ikon";
import { CaretDown } from "./ikon";

/* =============================================================================
   Item — frame Item di file Figma Coinest. Delapan belas jenis, dan yang
   terakhir dari lima belas frame Style & Component.

   Isinya BUKAN komponen kecil seperti tombol dan lencana, melainkan BARIS:
   satu entri di dalam sebuah daftar. Itu sebabnya hampir semuanya berbentuk
   sama — sesuatu di kiri, dua baris teks di tengah, sesuatu di kanan — dan
   itu juga sebabnya keluarga ini ditulis dalam satu berkas: kalau
   dipisah-pisah, delapan belas salinan bentuk yang sama pasti menyimpang
   satu per satu (jebakan #32 di CLAUDE.md, yang sudah terjadi pada sidebar
   dan command palette).

   Tiga hal yang diukur dari framenya dan gampang terlewat:

   1. Frame ini memakai palet KETIGA. Selain palet Coinest (#242E2C,
      #6B7271, #1E4841) dan palet beige-mint milik Forms/Calendar (#FAF6F5,
      #E4E2DD, #CDEDDD), Item memakai #272932 / #8A8C90 / #E1E1E2 / #C2E66E /
      #52545B — dan kelimanya TIDAK muncul di satu pun frame lain. Dihitung:
      #272932 sembilan kali di Item dan nol di dua belas frame lainnya.
      Tokennya di tokens.css diberi nama `--item-*` supaya jelas asalnya.

   2. Garis pemisah di bawah baris ditulis Figma sebagai <path> setinggi
      2px, bukan stroke 1px. Itu karena strokenya mengangkangi tepi: 1px di
      dalam, 1px di luar. Yang benar di CSS `border-bottom: 1px`, bukan 2px —
      dan mengambil angka 2 apa adanya membuat setiap daftar tumbuh satu
      piksel per baris.

   3. Gelembung chat punya SATU sudut siku. Sisanya r12 (Figma menuliskannya
      sebagai rentang 21,6 karena corner smoothing — sama seperti batang
      grafik, yang sempat saya baca sebagai radius 7,2 padahal 4).
   ============================================================================= */

/* -----------------------------------------------------------------------------
   Dua bentuk yang ikut disalin dari frame ini karena tidak ada di daftar 179
   ikon yang dikirim pemilik: centang ganda "sudah dibaca" dan bintang inbox.

   Path-nya diambil APA ADANYA dari Item.svg, termasuk viewBox aslinya yang
   tidak dimulai dari nol — bukan digambar ulang dari tangkapan layar. Kalau
   suatu saat pemilik mengekspor keduanya sebagai ikon, keduanya dihapus dari
   sini dan dipanggil dari daftar seperti yang lain.
   -------------------------------------------------------------------------- */
function Centang2({ className }: { className?: string }) {
  return (
    <svg width="15" height="6.5" viewBox="496.5 896.5 15 6.5" className={className} aria-hidden="true">
      <path
        fill="currentColor"
        d="M505.351 897.357L499.751 902.857C499.657 902.949 499.531 903 499.4 903C499.269 903 499.143 902.949 499.049 902.857L496.649 900.5C496.603 900.454 496.565 900.399 496.54 900.339C496.514 900.278 496.501 900.213 496.5 900.148C496.499 900.082 496.512 900.017 496.536 899.956C496.561 899.895 496.597 899.84 496.644 899.793C496.69 899.746 496.744 899.709 496.805 899.683C496.865 899.657 496.93 899.644 496.996 899.643C497.062 899.643 497.127 899.655 497.188 899.68C497.248 899.704 497.304 899.741 497.351 899.787L499.4 901.799L504.65 896.643C504.745 896.55 504.872 896.499 505.005 896.5C505.071 896.5 505.136 896.514 505.196 896.539C505.257 896.565 505.312 896.603 505.358 896.649C505.404 896.696 505.44 896.752 505.465 896.813C505.489 896.874 505.502 896.939 505.501 897.004C505.5 897.07 505.487 897.135 505.461 897.196C505.436 897.256 505.398 897.311 505.351 897.357H505.351ZM511.357 896.649C511.311 896.602 511.256 896.565 511.196 896.539C511.135 896.514 511.07 896.5 511.004 896.5C510.939 896.499 510.874 896.511 510.813 896.536C510.752 896.561 510.696 896.597 510.649 896.643L505.399 901.799L504.223 900.643C504.128 900.55 504 900.499 503.868 900.5C503.735 900.501 503.608 900.555 503.515 900.65C503.422 900.744 503.371 900.872 503.372 901.005C503.373 901.137 503.427 901.264 503.522 901.357L505.049 902.857C505.142 902.949 505.268 903 505.399 903C505.531 903 505.657 902.949 505.75 902.857L511.35 897.357C511.397 897.311 511.434 897.256 511.46 897.196C511.486 897.135 511.5 897.07 511.5 897.005C511.501 896.939 511.488 896.874 511.464 896.813C511.439 896.752 511.403 896.696 511.357 896.649Z"
      />
    </svg>
  );
}

function Bintang({ className }: { className?: string }) {
  return (
    <svg width="14" height="13.5" viewBox="714 1841 14 13.5" className={className} aria-hidden="true">
      <path
        fill="currentColor"
        d="M727.949 1846.08C727.886 1845.89 727.768 1845.72 727.61 1845.59C727.451 1845.47 727.259 1845.39 727.058 1845.38L723.37 1845.08L721.946 1841.63C721.869 1841.45 721.738 1841.29 721.57 1841.17C721.401 1841.06 721.203 1841 721 1841C720.798 1841 720.599 1841.06 720.431 1841.17C720.262 1841.29 720.131 1841.45 720.054 1841.63L718.632 1845.08L714.943 1845.38C714.741 1845.39 714.549 1845.47 714.39 1845.59C714.231 1845.72 714.113 1845.89 714.051 1846.08C713.988 1846.28 713.984 1846.48 714.038 1846.68C714.093 1846.87 714.204 1847.05 714.357 1847.18L717.169 1849.61L716.313 1853.23C716.265 1853.43 716.276 1853.64 716.346 1853.83C716.416 1854.02 716.541 1854.18 716.705 1854.3C716.869 1854.42 717.065 1854.49 717.268 1854.5C717.471 1854.51 717.671 1854.45 717.844 1854.35L721 1852.41L724.158 1854.35C724.331 1854.45 724.531 1854.5 724.733 1854.5C724.935 1854.49 725.13 1854.42 725.294 1854.3C725.457 1854.18 725.582 1854.02 725.652 1853.83C725.722 1853.64 725.734 1853.43 725.688 1853.23L724.828 1849.61L727.64 1847.18C727.795 1847.05 727.906 1846.87 727.961 1846.68C728.016 1846.48 728.012 1846.27 727.949 1846.08ZM726.99 1846.42L723.946 1849.05C723.877 1849.11 723.825 1849.18 723.797 1849.27C723.769 1849.36 723.765 1849.45 723.786 1849.54L724.716 1853.47C724.719 1853.47 724.719 1853.48 724.717 1853.48C724.715 1853.49 724.711 1853.49 724.706 1853.5C724.694 1853.5 724.691 1853.5 724.682 1853.5L721.262 1851.39C721.183 1851.34 721.093 1851.32 721 1851.32C720.908 1851.32 720.817 1851.34 720.738 1851.39L717.318 1853.5C717.309 1853.5 717.306 1853.5 717.294 1853.5C717.289 1853.49 717.285 1853.49 717.283 1853.48C717.281 1853.48 717.281 1853.47 717.284 1853.47L718.214 1849.54C718.235 1849.45 718.231 1849.36 718.203 1849.27C718.175 1849.18 718.123 1849.11 718.054 1849.05L715.01 1846.42C715.003 1846.42 714.996 1846.41 715.002 1846.39C715.008 1846.37 715.013 1846.37 715.023 1846.37L719.018 1846.05C719.109 1846.04 719.197 1846.01 719.271 1845.95C719.345 1845.9 719.403 1845.83 719.438 1845.74L720.976 1842.02C720.981 1842.01 720.983 1842 720.998 1842C721.013 1842 721.015 1842.01 721.02 1842.02L722.563 1845.74C722.598 1845.83 722.656 1845.9 722.73 1845.95C722.805 1846.01 722.893 1846.04 722.984 1846.05L726.979 1846.37C726.989 1846.37 726.994 1846.37 727 1846.39C727.006 1846.41 727 1846.41 726.99 1846.42Z"
      />
    </svg>
  );
}

const kelas = (...k: (string | false | undefined)[]) => k.filter(Boolean).join(" ");

/* =============================================================================
   1. Header-Section — 1280x32, judul di kiri, kendali di kanan.

   Wadah saja: seluruh isi kanannya komponen yang sudah ada (Cari, Segmen,
   Tombol, TombolIkon). Empat "Model" di Figma cuma menukar SUSUNAN isinya,
   bukan bentuk wadahnya — jadi yang dibuat prop, bukan varian.
   ============================================================================= */
export function KepalaSeksi({
  judul,
  kiri,
  kanan,
  className,
}: {
  /** Judul di kiri. Model 2–4 tidak punya judul; isi `kiri` saja. */
  judul?: ReactNode;
  kiri?: ReactNode;
  kanan?: ReactNode;
  className?: string;
}) {
  return (
    <div className={kelas("k-kepalaseksi", className)}>
      <div className="k-kepalaseksi__kiri">
        {judul && <h2 className="k-kepalaseksi__judul">{judul}</h2>}
        {kiri}
      </div>
      {kanan && <div className="k-kepalaseksi__kanan">{kanan}</div>}
    </div>
  );
}

/* =============================================================================
   2. Header — kepala halaman, 38 tinggi.

   Varian Subpage/Back Button ditandai dengan adanya `onKembali`, bukan
   dengan prop `type`: tombol kembali yang tidak melakukan apa-apa adalah
   tombol yang rusak, jadi bentuknya dan perilakunya datang bersama.
   ============================================================================= */
export function KepalaHalaman({
  judul,
  onKembali,
  ikonKembali,
  kanan,
  className,
}: {
  judul: ReactNode;
  onKembali?: () => void;
  ikonKembali?: DataIkon;
  kanan?: ReactNode;
  className?: string;
}) {
  return (
    <header className={kelas("k-kepalahal", className)}>
      <div className="k-kepalahal__kiri">
        {onKembali && ikonKembali && (
          <button type="button" className="k-kepalahal__kembali" onClick={onKembali} aria-label="Kembali">
            <Ikon ikon={ikonKembali} ukuran={12} />
          </button>
        )}
        <h1 className="k-kepalahal__judul">{judul}</h1>
      </div>
      {kanan && <div className="k-kepalahal__kanan">{kanan}</div>}
    </header>
  );
}

/** Tombol bulat 38px berlatar mint pucat — bentuk khas kanan-atas Coinest. */
export function TombolBulat({
  ikon,
  ukuran = 14,
  judul,
  tanda,
  onClick,
}: {
  ikon: DataIkon;
  ukuran?: number;
  judul: string;
  /** Titik 8px di sudut kanan atas — mis. ada notifikasi belum dibaca. */
  tanda?: boolean;
  onClick?: () => void;
}) {
  return (
    <button type="button" className="k-bulat" onClick={onClick} aria-label={judul}>
      <Ikon ikon={ikon} ukuran={ukuran} />
      {tanda && <span className="k-bulat__tanda" />}
    </button>
  );
}

/* =============================================================================
   3. Footer — hak cipta dan tautan di kiri, media sosial di kanan.

   Varian Mobile menumpuknya jadi tiga baris tengah. Dikerjakan media query,
   bukan prop: yang menentukan lebar layar, bukan pemanggilnya.
   ============================================================================= */
export function KakiHalaman({
  hakCipta,
  tautan,
  sosial,
  className,
}: {
  hakCipta: ReactNode;
  tautan?: { label: string; href: string }[];
  sosial?: { ikon: DataIkon; judul: string; href: string }[];
  className?: string;
}) {
  return (
    <footer className={kelas("k-kakihal", className)}>
      <div className="k-kakihal__legal">
        <span className="k-kakihal__cipta">{hakCipta}</span>
        {tautan && tautan.length > 0 && (
          <nav className="k-kakihal__tautan" aria-label="Tautan kaki halaman">
            {tautan.map((t) => (
              <a key={t.label} href={t.href}>
                {t.label}
              </a>
            ))}
          </nav>
        )}
      </div>
      {sosial && sosial.length > 0 && (
        <div className="k-kakihal__sosial">
          {sosial.map((s) => (
            <a key={s.judul} href={s.href} aria-label={s.judul}>
              <Ikon ikon={s.ikon} ukuran={20} />
            </a>
          ))}
        </div>
      )}
    </footer>
  );
}

/* =============================================================================
   4. Bubble-chat — dua jenis: yang dikirim sendiri (mint, siku kanan-atas,
   bercentang ganda) dan yang diterima (persik, siku kiri-atas, beravatar).
   ============================================================================= */
export function Gelembung({
  nama,
  waktu,
  sendiri,
  dibaca,
  avatar,
  lampiran,
  children,
  className,
}: {
  nama: ReactNode;
  waktu: ReactNode;
  /** Pesan keluar: mint, rata kanan, siku di kanan atas. */
  sendiri?: boolean;
  /** Centang ganda. Hanya masuk akal pada pesan keluar. */
  dibaca?: boolean;
  avatar?: ReactNode;
  /** Lampiran gambar di bawah gelembung — 164x164 berbingkai warna yang sama. */
  lampiran?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={kelas("k-chat", sendiri && "k-chat--sendiri", className)}>
      {avatar && <span className="k-chat__avatar">{avatar}</span>}
      <div className="k-chat__utama">
        <p className="k-chat__info">
          <span className="k-chat__nama">{nama}</span>
          {/* Titik pemisah 4px. Kecil, dan justru karena kecil ia lolos dari
              pembacaan ukuran — yang menemukannya audit warna, yang melapor
              ada #E4E2DD di framenya dan tidak ada satu pun di kit. */}
          <span className="k-titikpisah" aria-hidden="true" />
          <span className="k-chat__waktu">{waktu}</span>
          {dibaca && <Centang2 className="k-chat__centang" />}
        </p>
        <div className="k-chat__gelembung">{children}</div>
        {lampiran && <div className="k-chat__lampiran">{lampiran}</div>}
      </div>
    </div>
  );
}

/* =============================================================================
   5. Item List Message — baris daftar percakapan.
   ============================================================================= */
export function BarisPesan({
  avatar,
  nama,
  status,
  waktu,
  belum,
  terbuka,
  children,
  className,
}: {
  avatar: ReactNode;
  nama: ReactNode;
  /** Lencana kecil di sebelah nama — di Figma "Badge Status" 50x18. */
  status?: ReactNode;
  waktu: ReactNode;
  /** Jumlah pesan belum dibaca. Nol tidak sama dengan tidak ada: 0 tetap
      digambar kalau memang dikirim, karena "0 baru" dan "tidak ada kabar"
      dua keadaan berbeda di layar. */
  belum?: number;
  /** Percakapan yang sedang dibuka: berkartu, bergaris hijau. */
  terbuka?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={kelas(
        "k-pesan",
        belum !== undefined && "k-pesan--belum",
        terbuka && "k-pesan--terbuka",
        className,
      )}
    >
      <span className="k-pesan__avatar">{avatar}</span>
      <div className="k-pesan__utama">
        <div className="k-pesan__kepala">
          <span className="k-pesan__nama">{nama}</span>
          {status}
          <span className="k-pesan__waktu">{waktu}</span>
        </div>
        <div className="k-pesan__badan">
          <p className="k-pesan__cuplik">{children}</p>
          {belum !== undefined && (
            <span className="k-pesan__jumlah" title={`${belum} pesan belum dibaca`}>
              {belum}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/* =============================================================================
   6. Item List Recent Activity — linimasa bertitik ikon.

   `akhir` mematikan garis penyambungnya. Yang menentukan bukan komponennya
   sendiri melainkan pemanggilnya, karena hanya dia yang tahu ini baris
   terakhir — dan garis yang menjulur ke bawah tanpa tujuan adalah cacat yang
   paling sering lolos di komponen linimasa.
   ============================================================================= */
export function BarisAktivitas({
  ikon,
  waktu,
  akhir,
  children,
  className,
}: {
  ikon: DataIkon;
  waktu: ReactNode;
  akhir?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={kelas("k-aktivitas", akhir && "k-aktivitas--akhir", className)}>
      <span className="k-aktivitas__ubin">
        <Ikon ikon={ikon} ukuran={12} />
      </span>
      <div className="k-aktivitas__isi">
        <p className="k-aktivitas__waktu">{waktu}</p>
        <p className="k-aktivitas__teks">{children}</p>
      </div>
    </div>
  );
}

/* =============================================================================
   7. Log Item — sama bentuknya dengan aktivitas, tapi 30px dan waktunya di
   bawah (Default) atau di atas (V2).
   ============================================================================= */
export function BarisLog({
  avatar,
  ikon,
  waktu,
  waktuDulu,
  akhir,
  children,
  className,
}: {
  avatar?: ReactNode;
  ikon?: DataIkon;
  waktu: ReactNode;
  /** V2: waktu di atas keterangan, bukan di bawahnya. */
  waktuDulu?: boolean;
  akhir?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const jam = <p className="k-log__waktu">{waktu}</p>;
  return (
    <div className={kelas("k-log", akhir && "k-log--akhir", className)}>
      <span className="k-log__kiri">
        {avatar ?? (ikon && <Ikon ikon={ikon} ukuran={12} />)}
      </span>
      <div className="k-log__isi">
        {waktuDulu && jam}
        <p className="k-log__teks">{children}</p>
        {!waktuDulu && jam}
      </div>
    </div>
  );
}

/* =============================================================================
   8 & 14. Chips — tagar (kotak r8, 32 tinggi) dan kategori (pil r15, 30).
   ============================================================================= */
export function KepingTagar({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={kelas("k-keping", className)}>
      {/* Pagarnya glif teks di Figma, bukan ikon — jadi ia ditulis sebagai
          teks juga, supaya ikut bobot dan ukuran hurufnya. */}
      <span className="k-keping__pagar" aria-hidden="true">
        #
      </span>
      {children}
    </span>
  );
}

export function KepingKategori({
  aktif,
  children,
  className,
  ...sisa
}: {
  aktif?: boolean;
  children: ReactNode;
  className?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={kelas("k-kategori", aktif && "is-aktif", className)}
      aria-pressed={aktif}
      {...sisa}
    >
      {children}
    </button>
  );
}

/* =============================================================================
   9. Item List Asset — batang warna, nama, lalu persentase di atas jumlah.
   ============================================================================= */
export function BarisAset({
  warna,
  nama,
  persen,
  total,
  className,
}: {
  /** Warna batang kiri. Dipakai `--ramp-1`..`--ramp-5` di halaman. */
  warna: string;
  nama: ReactNode;
  persen: ReactNode;
  total: ReactNode;
  className?: string;
}) {
  return (
    <div className={kelas("k-aset", className)}>
      <span className="k-aset__batang" style={{ background: warna }} />
      <span className="k-aset__nama">{nama}</span>
      <span className="k-aset__kanan">
        <span className="k-aset__persen">{persen}</span>
        <span className="k-aset__total">{total}</span>
      </span>
    </div>
  );
}

/* =============================================================================
   10. Item List Watchlist — ubin bulat 48, simbol di atas nama, nominal di
   atas lencana tren.
   ============================================================================= */
export function BarisPantau({
  ikon,
  ikonUkuran = 24,
  simbol,
  nama,
  nilai,
  tren,
  className,
}: {
  ikon: DataIkon;
  ikonUkuran?: number;
  simbol: ReactNode;
  nama: ReactNode;
  nilai: ReactNode;
  /** Lencana tren — pakai `Tren` dari Kartu.tsx. */
  tren?: ReactNode;
  className?: string;
}) {
  return (
    <div className={kelas("k-pantau", className)}>
      <span className="k-pantau__ubin">
        <Ikon ikon={ikon} ukuran={ikonUkuran} />
      </span>
      <span className="k-pantau__info">
        <span className="k-pantau__simbol">{simbol}</span>
        <span className="k-pantau__nama">{nama}</span>
      </span>
      <span className="k-pantau__kanan">
        <span className="k-pantau__nilai">{nilai}</span>
        {tren}
      </span>
    </div>
  );
}

/* =============================================================================
   11 & 13. Item List Transfer List / Recent Transfer — kartu 67 tinggi.

   Satu komponen, karena kedua frame itu bentuknya identik sampai ke radius
   15,5 dan avatar 40: yang membedakan cuma ada-tidaknya blok kedua di kanan.
   ============================================================================= */
export function BarisTransfer({
  gambar,
  ikon,
  nama,
  rekening,
  kananAtas,
  kananBawah,
  className,
}: {
  gambar?: ReactNode;
  ikon?: DataIkon;
  nama: ReactNode;
  rekening?: ReactNode;
  kananAtas?: ReactNode;
  kananBawah?: ReactNode;
  className?: string;
}) {
  return (
    <div className={kelas("k-transfer", className)}>
      <span className="k-transfer__gambar">
        {gambar ?? (ikon && <Ikon ikon={ikon} ukuran={17} />)}
      </span>
      <span className="k-transfer__info">
        <span className="k-transfer__nama">{nama}</span>
        {rekening && <span className="k-transfer__rek">{rekening}</span>}
      </span>
      {(kananAtas || kananBawah) && (
        <span className="k-transfer__kanan">
          {kananAtas && <span className="k-transfer__nilai">{kananAtas}</span>}
          {kananBawah && <span className="k-transfer__ket">{kananBawah}</span>}
        </span>
      )}
    </div>
  );
}

/* =============================================================================
   12. Item List Providers — tiga varian.

   `bentuk="kartu"` berkartu dengan caret; `bentuk="rinci"` baris polos
   bergaris tegak di kiri, yang aktifnya bergaris mint 4px.
   ============================================================================= */
export function BarisPenyedia({
  ikon,
  nama,
  bentuk = "kartu",
  aktif,
  className,
  ...sisa
}: {
  ikon: DataIkon;
  nama: ReactNode;
  bentuk?: "kartu" | "rinci";
  aktif?: boolean;
  className?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={kelas("k-penyedia", `k-penyedia--${bentuk}`, aktif && "is-aktif", className)}
      aria-pressed={bentuk === "rinci" ? aktif : undefined}
      {...sisa}
    >
      <span className="k-penyedia__ubin">
        <Ikon ikon={ikon} ukuran={14} />
      </span>
      <span className="k-penyedia__nama">{nama}</span>
      {bentuk === "kartu" && <Ikon ikon={CaretDown} ukuran={10} className="k-penyedia__caret" />}
    </button>
  );
}

/* =============================================================================
   15. Item List Expense Statistic — pil persentase, kategori, nominal.
   ============================================================================= */
export function BarisBeban({
  persen,
  kategori,
  nominal,
  className,
}: {
  persen: ReactNode;
  kategori: ReactNode;
  nominal: ReactNode;
  className?: string;
}) {
  return (
    <div className={kelas("k-beban", className)}>
      <span className="k-beban__persen">{persen}</span>
      <span className="k-beban__kategori">{kategori}</span>
      <span className="k-beban__nominal">{nominal}</span>
    </div>
  );
}

/* =============================================================================
   16. Item List Inbox — baris kotak masuk dengan centang dan bintang.
   ============================================================================= */
export function BarisInbox({
  dipilih,
  onPilih,
  pengirim,
  waktu,
  dibintangi,
  onBintang,
  children,
  className,
}: {
  dipilih?: boolean;
  onPilih?: (nilai: boolean) => void;
  pengirim: ReactNode;
  waktu: ReactNode;
  dibintangi?: boolean;
  onBintang?: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={kelas("k-inbox", className)}>
      <input
        type="checkbox"
        className="k-centang k-inbox__centang"
        checked={!!dipilih}
        onChange={(e) => onPilih?.(e.currentTarget.checked)}
        aria-label="Pilih pesan ini"
      />
      <div className="k-inbox__isi">
        <div className="k-inbox__kepala">
          <span className="k-inbox__pengirim">{pengirim}</span>
          <span className="k-inbox__waktu">{waktu}</span>
        </div>
        <div className="k-inbox__badan">
          <p className="k-inbox__teks">{children}</p>
          <button
            type="button"
            className={kelas("k-inbox__bintang", dibintangi && "is-aktif")}
            onClick={onBintang}
            aria-pressed={dibintangi}
            aria-label="Tandai penting"
          >
            <Bintang />
          </button>
        </div>
      </div>
    </div>
  );
}

/* =============================================================================
   17. Item List Trending Tags — judul di atas, kategori dan keterangan di
   bawahnya, bergaris pemisah.
   ============================================================================= */
export function BarisTagar({
  judul,
  kategori,
  keterangan,
  className,
}: {
  judul: ReactNode;
  kategori: ReactNode;
  keterangan?: ReactNode;
  className?: string;
}) {
  return (
    <div className={kelas("k-tagar", className)}>
      <p className="k-tagar__judul">{judul}</p>
      <p className="k-tagar__bawah">
        <span className="k-tagar__kategori">{kategori}</span>
        {keterangan && (
          <>
            <span className="k-titikpisah" aria-hidden="true" />
            <span className="k-tagar__ket">{keterangan}</span>
          </>
        )}
      </p>
    </div>
  );
}

/* =============================================================================
   18. Item List Top Author — avatar, nama, peran.
   ============================================================================= */
export function BarisPenulis({
  avatar,
  nama,
  peran,
  className,
}: {
  avatar: ReactNode;
  nama: ReactNode;
  peran?: ReactNode;
  className?: string;
}) {
  return (
    <div className={kelas("k-penulis", className)}>
      <span className="k-penulis__avatar">{avatar}</span>
      <span className="k-penulis__info">
        <span className="k-penulis__nama">{nama}</span>
        {peran && <span className="k-penulis__peran">{peran}</span>}
      </span>
    </div>
  );
}
