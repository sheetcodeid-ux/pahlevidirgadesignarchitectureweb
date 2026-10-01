import { useRef, useState, type ReactNode } from "react";
import { Tabel, type KolomTabel } from "../kit/Tabel";
import { Paginasi } from "../kit/Paginasi";
import { Tombol, TombolIkon } from "../kit/Tombol";
import { Ikon, type DataIkon } from "../kit/Ikon";
import { CaretDown, MagnifyingGlass, Trash } from "../kit/ikon";
import { Avatar, Kosong, RangkaBaris } from "../kit/Tampilan";
import { AlertDialog } from "../kit/Overlay";
import { jagaFokusSesudahHapus } from "../../lib/fokus";

/* =============================================================================
   Kerangka daftar kit — diangkat dari frame "13. Transactions".

   Satu kartu: bilah alat (cari + pemilih di kiri, aksi di kanan), tabel
   kit, lalu kaki berisi hitungan dan paginasi. Semua Transaksi, Tugas,
   Direktori, Testimoni, dan Tim memakai kerangka INI — bukan salinan
   masing-masing. Lima salinan bilah alat pasti menyimpang (jebakan #32),
   dan yang menyimpang biasanya yang jarang dibuka.

   Yang sengaja TIDAK diurus di sini: menyaring dan mencari. Tiap halaman
   punya aturan saringnya sendiri (Tugas menyembunyikan yang selesai,
   Tim menyembunyikan yang nonaktif), jadi pemanggil yang menyaring lalu
   menyerahkan baris yang tersisa. Yang diurus di sini cuma memotongnya
   jadi halaman.

   Bentuknya diukur di Semua Transaksi dan terbukti identik piksel demi
   piksel setelah halaman itu pindah ke kerangka ini.
   ============================================================================= */

/**
 * Pemilih berbentuk tombol ber-caret, dengan <select> asli ditumpangkan
 * transparan di atasnya. Yang tergambar tombol kit; yang dibuka daftar
 * bawaan peramban — papan ketik, ketik-untuk-melompat, dan pemilih layar
 * penuh di ponsel ikut, dan tidak bisa rusak diam-diam.
 */
export function PilihTombol({
  judul,
  nilai,
  opsi,
  onPilih,
  kiri,
}: {
  /** Dibacakan pembaca layar — tombolnya sendiri cuma menampilkan pilihan. */
  judul: string;
  nilai: string;
  opsi: { nilai: string; label: string }[];
  onPilih: (nilai: string) => void;
  kiri?: DataIkon;
}) {
  return (
    <label className="k-pilihtombol">
      <Tombol ukuran="medium" jenis="secondary" kiri={kiri} kanan={CaretDown} tabIndex={-1}>
        {opsi.find((o) => o.nilai === nilai)?.label ?? judul}
      </Tombol>
      <select aria-label={judul} value={nilai} onChange={(e) => onPilih(e.currentTarget.value)}>
        {opsi.map((o) => (
          <option key={o.nilai} value={o.nilai}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/**
 * Status yang sekaligus pemilih: titik warna di depan <select> asli. Satu
 * benda yang menunjukkan DAN mengubah — bukan lencana ditambah pemilih
 * terpisah. Dipakai Portal Klien (status dokumen) dan Tugas.
 *
 * `nada` mengikuti aturan warna situs: amber = menunggu pihak lain,
 * merah = perlu tindakan, hijau = beres, abu = belum mulai.
 */
export type NadaStatus = "netral" | "tunggu" | "tindak" | "jalan" | "beres";
export function PilihStatus({
  judul,
  nilai,
  nada,
  opsi,
  onPilih,
}: {
  judul: string;
  nilai: string;
  nada: NadaStatus;
  opsi: { nilai: string; label: string }[];
  onPilih: (nilai: string) => void;
}) {
  return (
    <label className="kd-status" data-nada={nada}>
      <span className="kd-status__titik" aria-hidden="true" />
      <select aria-label={judul} value={nilai} onChange={(e) => onPilih(e.currentTarget.value)}>
        {opsi.map((o) => (
          <option key={o.nilai} value={o.nilai}>
            {o.label}
          </option>
        ))}
        {!opsi.some((o) => o.nilai === nilai) && <option value={nilai}>{nilai}</option>}
      </select>
      <Ikon ikon={CaretDown} ukuran={12} />
    </label>
  );
}

export interface PropDaftarKit {
  /** Kelas tambahan pada kartunya — mis. `trx` untuk tinggi tetap frame 13. */
  className?: string;
  /** Isi bilah alat sebelum pendorong: kotak cari dan pemilih. */
  kiri: ReactNode;
  /** Isi bilah alat sesudah pendorong: aksi utama. */
  kanan?: ReactNode;
  kolom: KolomTabel[];
  /** SELURUH baris yang lolos saringan — dipotong jadi halaman di sini. */
  baris: ReactNode[][];
  kunci: string[];
  /** null = sedang memuat. */
  memuat: boolean;
  /** Kalimat saat saringannya tidak menyisakan apa pun. */
  kosong: ReactNode;
  /** Ikon keadaan kosong. Bawaan kaca pembesar: kosong karena saringan. */
  ikonKosong?: DataIkon;
  /** Kalimat kedua di bawah judul kosong — mis. langkah berikutnya. */
  ketKosong?: ReactNode;
  /** Kalimat selama data belum datang. */
  teksMemuat?: string;
  /** Kata benda di kaki: "dari 12 tugas". */
  satuan?: string;
  /**
   * Berubah setiap kali saringan berubah. Halaman kembali ke 1 begitu nilai
   * ini berganti — dibandingkan saat RENDER, bukan lewat efek, supaya tidak
   * ada satu frame tabel kosong karena masih berdiri di halaman 5 dari 2.
   */
  kunciSaring: string;
  /** Kotak centang pemilih baris, seperti frame 13. */
  pilih?: { terpilih: string[]; onPilih: (k: string[]) => void };
  /** Pengganti tabel, mis. tampilan papan. Kaki paginasinya disembunyikan. */
  ganti?: ReactNode;
  pad?: number;
  tinggiBaris?: number;
}

export function DaftarKit({
  className,
  kiri,
  kanan,
  kolom,
  baris,
  kunci,
  memuat,
  kosong,
  ikonKosong = MagnifyingGlass,
  ketKosong,
  teksMemuat = "Memuat…",
  satuan,
  kunciSaring,
  pilih,
  ganti,
  pad = 10.5,
  tinggiBaris = 64,
}: PropDaftarKit) {
  const [halaman, setHalaman] = useState(1);
  const [perHalaman, setPerHalaman] = useState(12);
  const [saringLalu, setSaringLalu] = useState(kunciSaring);
  if (saringLalu !== kunciSaring) {
    setSaringLalu(kunciSaring);
    setHalaman(1);
  }

  const totalHalaman = Math.max(1, Math.ceil(baris.length / perHalaman));
  /* Dijepit saat render juga: menghapus baris terakhir di halaman terakhir
     tidak boleh meninggalkan tabel kosong. */
  const halamanKini = Math.min(halaman, totalHalaman);
  const mulai = (halamanKini - 1) * perHalaman;
  const tampil = baris.slice(mulai, mulai + perHalaman);
  const kunciTampil = kunci.slice(mulai, mulai + perHalaman);

  /* Lebar minimum tabel saat digulir mendatar = jumlah kolomnya (+32 untuk
     kotak centang), supaya tiap daftar tidak perlu menyebut angkanya sendiri. */
  const lebar = kolom.reduce((n, k) => n + k.lebar, pilih ? 32 : 0);

  return (
    <section
      className={["kd", className].filter(Boolean).join(" ")}
      style={{ "--kd-lebar": `${Math.round(lebar)}px` } as React.CSSProperties}
    >
      <div className="kd__bar">
        {kiri}
        <span className="kd__dorong" />
        {kanan}
      </div>

      <div className="kd__tabel">
        {ganti ??
          (tampil.length === 0 ? (
            /* Memuat = rangka seukuran baris, bukan kalimat; kosong =
               Kosong kit (kenapa kosong + langkah berikutnya). */
            memuat ? (
              <div className="kd__memuat">
                <RangkaBaris jumlah={4} label={teksMemuat} />
              </div>
            ) : (
              <Kosong ikon={ikonKosong} judul={kosong} ringkas>
                {ketKosong}
              </Kosong>
            )
          ) : (
            <Tabel
              kolom={kolom}
              baris={tampil}
              pilih={Boolean(pilih)}
              kunci={kunciTampil}
              terpilih={pilih?.terpilih}
              onPilih={pilih?.onPilih}
              kepala="polos"
              pad={pad}
              tinggiKepala={32}
              tinggiBaris={tinggiBaris}
              fontBaris={12}
            />
          ))}
      </div>

      {!ganti && (
        <div className="kd__kaki">
          <p className="kd__hitung">
            Menampilkan
            <select
              aria-label="Baris per halaman"
              value={perHalaman}
              onChange={(e) => {
                setPerHalaman(Number(e.currentTarget.value));
                setHalaman(1);
              }}
            >
              {[12, 25, 50].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            dari {baris.length}
            {satuan ? ` ${satuan}` : ""}
            {pilih && pilih.terpilih.length > 0 && ` · ${pilih.terpilih.length} dipilih`}
          </p>
          <Paginasi kini={halamanKini} total={totalHalaman} onPindah={setHalaman} />
        </div>
      )}
    </section>
  );
}

/** Avatar kit berisi inisial — pengganti foto untuk orang dan kontak.
 *  Dua huruf pertama dari dua kata pertama, tanpa sapaan (Bu, Pak, CV, PT):
 *  "Bu Ratna Sari" jadi RS, bukan BR. Warnanya diturunkan dari nama. */
export function Inisial({ nama, redup }: { nama: string; redup?: boolean }) {
  const huruf = nama
    .replace(/^(bu|pak|ibu|bapak|cv|pt)\.?\s+/i, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((k) => k[0]!.toUpperCase())
    .join("");
  return <Avatar nama={nama} inisial={huruf || "?"} ukuran="sm" hiasan className={redup ? "kd__ubin--redup" : undefined} />;
}

/**
 * Tombol hapus baris berkonfirmasi. TombolIkon kit (meneruskan ref ke
 * pemicu Radix, dan membawa Petunjuk berisi namanya: "Hapus Bu Ratna").
 */
export function HapusBaris({
  judul,
  keterangan,
  label,
  onHapus,
}: {
  judul: string;
  keterangan: string;
  /** Nama tombolnya untuk pembaca layar, mis. "Hapus Bu Ratna". */
  label: string;
  /** Boleh mengembalikan janji — fokus baru dipindahkan sesudahnya. */
  onHapus: () => unknown;
}) {
  /* Di daftar berkartu (Logo Klien, Tim Studio) tombol ini lenyap bersama
     kartunya, dan fokus yang dikembalikan Radix ke sini jatuh ke <body>.
     lib/fokus memindahkannya ke kontrol berikutnya. */
  const pemicu = useRef<HTMLButtonElement>(null);
  return (
    <AlertDialog
      destructive
      title={judul}
      description={keterangan}
      confirmLabel="Ya, hapus"
      onConfirm={() => void jagaFokusSesudahHapus(pemicu.current, onHapus)}
      trigger={<TombolIkon ref={pemicu} ikon={Trash} judul={label} ukuran="small" jenis="ghost" ikonPx={14} className="kd__hapus" />}
    />
  );
}
