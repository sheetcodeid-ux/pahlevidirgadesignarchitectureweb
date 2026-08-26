/**
 * Ikon SVG inline.
 *
 * Tidak ada emoji dan tidak ada icon-font di seluruh proyek: emoji tampil
 * berbeda di tiap sistem operasi dan tidak bisa mewarisi warna teks, sementara
 * icon-font gagal diam-diam ketika font-nya tidak termuat.
 *
 * Setiap ikon di sini punya makna tetap dan hanya boleh dipakai untuk makna
 * itu — ikon yang tidak cocok dengan labelnya lebih membingungkan ketimbang
 * tidak ada ikon sama sekali.
 */

export type IconName =
  | "dashboard"
  | "project"
  | "image"
  | "inquiry"
  | "component"
  | "coffee"
  | "team"
  | "finance"
  | "settings"
  | "logout"
  | "chevronDown"
  | "chevronRight"
  | "chevronLeft"
  | "sun"
  | "moon"
  | "check"
  | "plus"
  | "search"
  | "trash"
  | "edit"
  | "upload"
  | "calendar"
  | "alert"
  | "info"
  | "lock"
  | "external"
  | "copy"
  | "filter"
  | "close"
  | "document"
  | "directory"
  | "quote"
  | "star"
  | "list"
  | "user"
  | "checklist"
  | "clock"
  | "camera"
  | "save";

interface Props {
  name: IconName;
  /** Ukuran dalam piksel. Ikon dirancang pada grid 24 dan tetap tajam di 16–32. */
  size?: number;
  className?: string;
  /**
   * "stroke" (bawaan): garis luar saja. "filled": bentuk padat berwarna
   * currentColor — gambar berbeda, bukan sekadar stroke yang ditebalkan,
   * dipakai untuk menandai keadaan terpilih/aktif (mis. item sidebar yang
   * sedang dibuka). Ikon yang belum punya gambar filled otomatis jatuh
   * kembali ke versi stroke, jadi variant ini selalu aman dipakai di ikon apa pun.
   */
  variant?: "stroke" | "filled";
}

// Semua path digambar pada viewBox 24×24 dengan stroke, sehingga ketebalannya
// seragam dan warnanya mengikuti currentColor.
const PATHS: Record<IconName, React.ReactNode> = {
  dashboard: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </>
  ),
  // Denah bangunan — proyek arsitektur.
  project: (
    <>
      <path d="M3 21h18" />
      <path d="M5 21V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v16" />
      <path d="M16 9h3a2 2 0 0 1 2 2v10" />
      <path d="M9 7h3M9 11h3M9 15h3" />
    </>
  ),
  image: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="8.5" cy="9.5" r="1.5" />
      <path d="m21 16-4.5-4.5L7 21" />
    </>
  ),
  // Amplop — pesan masuk dari form kontak.
  inquiry: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </>
  ),
  // Lapisan bertumpuk — pustaka komponen.
  component: (
    <>
      <path d="m12 3 9 5-9 5-9-5 9-5Z" />
      <path d="m3 13 9 5 9-5" />
    </>
  ),
  // Cangkir kopi — layanan desain ruang hospitality/F&B.
  coffee: (
    <>
      <path d="M17 8h1a4 4 0 1 1 0 8h-1" />
      <path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z" />
      <path d="M6 2v2M10 2v2M14 2v2" />
    </>
  ),
  // Dua figur — tim & freelancer.
  team: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  // Grafik batang — keuangan & laporan.
  finance: (
    <>
      <path d="M3 3v18h18" />
      <rect x="7" y="13" width="3" height="5" />
      <rect x="12" y="9" width="3" height="9" />
      <rect x="17" y="5" width="3" height="13" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
    </>
  ),
  logout: (
    <>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="m16 17 5-5-5-5" />
      <path d="M21 12H9" />
    </>
  ),
  chevronDown: <path d="m6 9 6 6 6-6" />,
  chevronRight: <path d="m9 18 6-6-6-6" />,
  chevronLeft: <path d="m15 18-6-6 6-6" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>
  ),
  moon: <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />,
  check: <path d="m4 12 5.5 5.5L20 7" />,
  plus: <path d="M12 5v14M5 12h14" />,
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </>
  ),
  trash: (
    <>
      <path d="M3 6h18" />
      <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
    </>
  ),
  edit: (
    <>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </>
  ),
  upload: (
    <>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="m7 9 5-5 5 5" />
      <path d="M12 4v12" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </>
  ),
  alert: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v6M12 16.5v.5" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 7.5v.5" />
    </>
  ),
  lock: (
    <>
      <rect x="4" y="10" width="16" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </>
  ),
  external: (
    <>
      <path d="M14 4h6v6" />
      <path d="M20 4 10 14" />
      <path d="M18 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5" />
    </>
  ),
  copy: (
    <>
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </>
  ),
  filter: <path d="M3 5h18l-7 8v6l-4 2v-8L3 5Z" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  // Lembar dengan sudut terlipat — dokumen proyek (PDF gambar kerja, dsb).
  document: (
    <>
      <path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" />
      <path d="M14 2v6h6" />
      <path d="M9 13h6M9 17h6" />
    </>
  ),
  // Kartu kontak dengan pengait buku alamat — direktori klien/kontraktor/supplier.
  directory: (
    <>
      <rect x="4" y="4" width="16" height="17" rx="2" />
      <path d="M4 9h2M4 14h2" />
      <circle cx="12.5" cy="11" r="2" />
      <path d="M9 17c0-1.7 1.6-3 3.5-3s3.5 1.3 3.5 3" />
    </>
  ),
  // Tanda kutip — testimoni klien.
  quote: (
    <>
      <path d="M7 8a3 3 0 0 0-3 3v2a3 3 0 0 0 3 3h1v-5H6a2 2 0 0 1 2-2V8Z" />
      <path d="M17 8a3 3 0 0 0-3 3v2a3 3 0 0 0 3 3h1v-5h-2a2 2 0 0 1 2-2V8Z" />
    </>
  ),
  star: <path d="m12 3 2.6 5.6 6.2.7-4.6 4.2 1.2 6.1L12 16.8 6.6 19.6l1.2-6.1L3.2 9.3l6.2-.7Z" />,
  // Titik + garis bertumpuk — daftar lengkap (submenu "Semua Proyek").
  list: (
    <>
      <circle cx="4" cy="6" r="1" fill="currentColor" stroke="none" />
      <circle cx="4" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="4" cy="18" r="1" fill="currentColor" stroke="none" />
      <path d="M8 6h13M8 12h13M8 18h13" />
    </>
  ),
  // Satu figur — akun milik sendiri, beda dari "team" yang dua figur.
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21v-1a8 8 0 0 1 16 0v1" />
    </>
  ),
  // Papan jalan dengan centang — daftar tugas (List Kerjaan), beda dari
  // "check" tunggal yang berarti konfirmasi/setuju.
  checklist: (
    <>
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <path d="M9 3.5h6a1 1 0 0 1 1 1V6a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z" />
      <path d="m8.3 12.3 1.4 1.4 2.5-3" />
      <path d="M14.7 12h2.8" />
      <path d="m8.3 17.3 1.4 1.4 2.5-3" />
      <path d="M14.7 17h2.8" />
    </>
  ),
  // Jam — piutang: uang yang ditagih tapi belum diterima, sedang ditunggu.
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </>
  ),
  // Disket — menyimpan. Sudut kanan-atas terpotong seperti disket sungguhan
  // supaya tetap terbaca meski bentuk aslinya sudah jarang dilihat orang.
  // Kamera — tempat foto yang belum diisi (mis. slot logo kosong).
  camera: (
    <>
      <path d="M3 8.5A2 2 0 0 1 5 6.5h1.9a1 1 0 0 0 .83-.45l.94-1.4a1 1 0 0 1 .83-.45h4.99a1 1 0 0 1 .83.45l.94 1.4a1 1 0 0 0 .83.45H19a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
      <circle cx="12" cy="13" r="3.2" />
    </>
  ),
  save: (
    <>
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z" />
      <path d="M17 21v-8H7v8" />
      <path d="M7 3v5h8" />
    </>
  ),
};

// Gambar solid untuk sebagian ikon — dipakai lewat variant="filled". Hanya
// dibuat untuk ikon yang benar-benar dipakai dengan keadaan terpilih/tidak
// (nav sidebar); ikon lain tidak butuh versi ini karena tidak pernah punya
// keadaan "aktif". Lubang (mis. celah centang, avatar, roda gigi) dipotong
// lewat fill-rule evenodd dalam satu path, bukan elemen berlapis — supaya
// tetap satu warna currentColor tanpa bergantung warna latar di baliknya.
const PATHS_FILLED: Partial<Record<IconName, React.ReactNode>> = {
  dashboard: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </>
  ),
  project: (
    <path d="M12 2.2a1 1 0 0 1 .6.2l8 6A1 1 0 0 1 21 9v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 .4-.8l8-6a1 1 0 0 1 .6-.2Zm-2 18.8v-6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v6Z" />
  ),
  check: (
    <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm4.7 7.7-5.4 5.4a1 1 0 0 1-1.4 0l-2.6-2.6a1 1 0 1 1 1.4-1.4l1.9 1.9 4.7-4.7a1 1 0 0 1 1.4 1.4Z" />
  ),
  finance: (
    <>
      <rect x="4" y="13" width="3.6" height="8" rx="1" />
      <rect x="10.2" y="8" width="3.6" height="13" rx="1" />
      <rect x="16.4" y="3" width="3.6" height="18" rx="1" />
    </>
  ),
  inquiry: (
    <path d="M5.5 5h13A2.5 2.5 0 0 1 21 7.5v9a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 16.5v-9A2.5 2.5 0 0 1 5.5 5Zm.3 1.6c-.1.1-.1.3-.1.4v.9L12 13.2l6.3-5.3v-.9c0-.1 0-.3-.1-.4L12 12.7Z" />
  ),
  team: (
    <>
      <circle cx="8.5" cy="7.5" r="3.3" />
      <circle cx="16.2" cy="8.7" r="2.6" opacity="0.6" />
      <path d="M2.2 20.5a6.5 6.5 0 0 1 12.6-2.3 5.4 5.4 0 0 1 8.4 3.4c.1.5-.3.9-.8.9H3c-.5 0-.9-.4-.8-.9Z" />
    </>
  ),
  directory: (
    <path d="M4 3h16a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm11.1 7.5a2.1 2.1 0 1 1-4.2 0 2.1 2.1 0 0 1 4.2 0ZM9.3 18c0-2 1.7-3.5 3.7-3.5s3.7 1.5 3.7 3.5c0 .5-.4.8-.9.8h-5.6c-.5 0-.9-.3-.9-.8ZM5 7.5h2v1.5H5Zm0 4.5h2v1.5H5Z" />
  ),
  quote: (
    <>
      <path d="M7 8a3 3 0 0 0-3 3v2a3 3 0 0 0 3 3h1v-5H6a2 2 0 0 1 2-2V8Z" />
      <path d="M17 8a3 3 0 0 0-3 3v2a3 3 0 0 0 3 3h1v-5h-2a2 2 0 0 1 2-2V8Z" />
    </>
  ),
  settings: (
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1ZM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
  ),
  star: <path d="m12 3 2.6 5.6 6.2.7-4.6 4.2 1.2 6.1L12 16.8 6.6 19.6l1.2-6.1L3.2 9.3l6.2-.7Z" />,
  component: (
    <>
      <path d="m12 3 9 5-9 5-9-5 9-5Z" />
      <path d="M2.6 13.3a1 1 0 0 1 1.4-.3L12 17.8l8-4.8a1 1 0 1 1 1 1.7l-8.5 5.1a1 1 0 0 1-1 0l-8.5-5.1a1 1 0 0 1-.4-1.4Z" />
    </>
  ),
  checklist: (
    <path d="M7 2a2 2 0 0 0-2 2v18a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2Zm2 .8h6a.8.8 0 0 1 .8.8v1a.8.8 0 0 1-.8.8H9a.8.8 0 0 1-.8-.8v-1a.8.8 0 0 1 .8-.8Zm-.6 9.6 1.3 1.3 2.3-2.3.9.9-3.2 3.2-2.2-2.2Zm0 5 1.3 1.3 2.3-2.3.9.9-3.2 3.2-2.2-2.2Z" />
  ),
};

export function Icon({ name, size = 20, className, variant = "stroke" }: Props) {
  const filled = variant === "filled" && PATHS_FILLED[name];

  if (filled) {
    return (
      <svg
        className={className}
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="currentColor"
        fillRule="evenodd"
        clipRule="evenodd"
        aria-hidden="true"
        focusable="false"
      >
        {PATHS_FILLED[name]}
      </svg>
    );
  }

  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}
