import { useMemo, useState, type ReactNode } from "react";
import { Icon } from "../Icon";
import { Popover } from "../overlay/Floating";
import { SkeletonTabel } from "../Skeleton";

type NamaIkon = Parameters<typeof Icon>[0]["name"];

export interface Kolom<T> {
  /** Judul kolom. Dipakai di <th> DAN di skeleton, jadi cukup ditulis sekali. */
  judul: string;
  /** .table__idx | .table__num | .table__actions — sama seperti Semua Proyek. */
  kelas?: string;
  /** Lebar tiruan untuk skeleton. Kolom tanpa lebar mengisi sisa ruang. */
  lebar?: string;
  /** Sel yang isinya gambar + dua baris teks (skeleton menirunya). */
  gambar?: boolean;
  render: (baris: T, indeks: number) => ReactNode;
}

export interface Chip<T> {
  id: string;
  label: string;
  /** Tidak diisi berarti "semua" — chip ini tidak menyaring apa pun. */
  cocok?: (baris: T) => boolean;
}

interface Props<T> {
  /** null berarti masih dimuat: yang tampil skeleton berbentuk tabel ini. */
  data: T[] | null;
  kunci: (baris: T) => string;
  kolom: Kolom<T>[];
  /** Nilai-nilai yang ikut dicari. Null dan undefined dilewati. */
  cariPada: (baris: T) => (string | null | undefined)[];
  placeholderCari: string;
  labelCari: string;
  /** Kata benda jamak untuk baris jumlah: "pesan", "kontak", "anggota". */
  satuan: string;
  chips?: Chip<T>[];
  /** Tombol aksi utama di kanan bilah. */
  aksi?: ReactNode;
  /** Pengalih tampilan (.listbar__views), seperti tabel/kartu di Semua Proyek. */
  tampilan?: ReactNode;
  /** Kalau diisi, ini yang digambar sebagai ganti tabel — untuk tampilan
   *  kanban atau kartu. Barisnya sudah tersaring dan terurut. */
  gantiIsi?: (terlihat: T[]) => ReactNode;
  /** Isi tambahan panel saringan — biasanya Select urutan atau kategori. */
  saringan?: ReactNode;
  /** Dipanggil saat "Bersihkan semua" ditekan, untuk menyetel ulang saringan
   *  milik pemanggil. Pencarian dan chip disetel ulang oleh komponen ini. */
  onBersihkan?: () => void;
  bersihkanAktif?: boolean;
  kosong: { ikon: NamaIkon; judul: string; keterangan: string };
  /** Kunci ingatan jumlah baris skeleton, lihat jumlahDiingat di lib/admin. */
  barisSkeleton: number;
  /**
   * Bentuk bilah perkakasnya.
   *
   * "listbar" — bentuk Semua Proyek: bilah full-bleed bergaris tebal yang
   *   menembus talang halaman, dengan kolom nomor di tabelnya.
   * "kartu" — bentuk Halaman Proyek: satu kartu hitam berbingkai 2px berisi
   *   kotak cari selebar penuh, lalu baris hitungan + aksi, dan tabelnya
   *   sendiri berkartu dengan sudut yang sama. Tanpa kolom nomor.
   *
   * Yang kedua diminta pemilik untuk daftar-daftar baru. Kedua bentuk memakai
   * satu komponen supaya perilaku cari, chip, dan saringannya tidak bisa
   * menyimpang — yang berbeda cuma bungkusnya.
   */
  bentuk?: "listbar" | "kartu";
}

/** Spesifikasi kolom skeleton diturunkan dari kolom tabelnya sendiri, supaya
 *  keduanya tidak bisa hanyut berbeda. Dipakai juga oleh RequireAuth. */
export function kolomSkeleton<T>(kolom: Kolom<T>[], bentuk: "listbar" | "kartu" = "listbar") {
  const sel = kolom.map((k) => ({ label: k.judul, kelas: k.kelas, lebar: k.lebar, gambar: k.gambar }));
  // Kolom "#" ditambahkan sendiri oleh tabelnya, jadi skeleton harus ikut
  // menambahkannya — kalau tidak, lebar tiap sel bergeser satu kolom saat
  // data tiba dan seluruh tabel tampak melompat. Bentuk kartu tidak punya
  // kolom itu, jadi skeletonnya pun tidak boleh punya.
  if (bentuk === "kartu") return sel;
  return [{ label: "#", kelas: "table__idx", lebar: "1rem" }, ...sel];
}

/**
 * Tabel daftar — bentuk yang sama persis dengan halaman Semua Proyek.
 *
 * Satu bentuk untuk semua daftar di panel admin: bilah cari dengan tombol
 * aksi, chip status berangka, panel saringan, tabel bergaris dengan kolom
 * nomor, baris jumlah hasil, dan keadaan kosong. Sebelumnya tiap panel
 * membangun bentuknya sendiri — dan hasilnya enam daftar yang tidak ada dua
 * pun yang sama, di panel yang isinya sama-sama "daftar sesuatu".
 *
 * Penyaringan dan pengurutan dikerjakan di klien. Itu keputusan sadar untuk
 * skala studio ini — puluhan baris, bukan puluhan ribu — dan menghindarkan
 * satu perjalanan bolak-balik ke server untuk tiap ketikan.
 */
export function DataTable<T>({
  data, kunci, kolom, cariPada, placeholderCari, labelCari, satuan,
  chips, aksi, tampilan, gantiIsi, saringan, onBersihkan, bersihkanAktif,
  kosong, barisSkeleton, bentuk = "listbar",
}: Props<T>) {
  const kartu = bentuk === "kartu";
  const [cari, setCari] = useState("");
  const [saring, setSaring] = useState(chips?.[0]?.id ?? "semua");

  const cocokCari = useMemo(() => {
    const q = cari.trim().toLowerCase();
    if (!q) return () => true;
    return (b: T) => cariPada(b).some((v) => (v ?? "").toLowerCase().includes(q));
  }, [cari, cariPada]);

  if (!data) {
    // Bentuk kartu tidak membawa padding sendiri — halaman yang memakainya
    // (Keuangan, Tugas, Fee, Gaji) sudah dipadding oleh .admin__content.
    if (kartu) {
      return (
        <div className="kartudaftar">
          <SkeletonTabel baris={barisSkeleton} kolom={kolomSkeleton(kolom, "kartu")} />
        </div>
      );
    }
    return (
      <div className="listpage">
        <div className="listpage__pad">
          <SkeletonTabel baris={barisSkeleton} kolom={kolomSkeleton(kolom)} />
        </div>
      </div>
    );
  }

  // Angka di chip mengikuti pencarian yang sedang aktif, bukan seluruh data —
  // kalau tidak, chip menjanjikan hasil yang tidak akan muncul saat diklik.
  const terkena = data.filter(cocokCari);
  const chipAktif = chips?.find((c) => c.id === saring);
  const terlihat = chipAktif?.cocok ? terkena.filter(chipAktif.cocok) : terkena;

  const adaSaringan = Boolean(cari) || (chips ? saring !== chips[0]?.id : false) || Boolean(bersihkanAktif);

  /* Kotak cari, chip, dan panel saringan sama persis di kedua bentuk —
     yang berbeda cuma pembungkus dan urutannya. Ditulis sekali sebagai
     variabel, bukan dua kali di dua cabang JSX: dua salinan yang isinya
     sama adalah cara paling mudah membuat satu bentuk diam-diam tertinggal
     saat yang satunya diperbaiki. */
  const kotakCari = (
    <>
      <span className={kartu ? "kartudaftar__cariikon" : "listbar__icon"}>
        <Icon name="search" size={20} />
      </span>
      <input
        className="input"
        type="search"
        value={cari}
        onChange={(e) => setCari(e.target.value)}
        placeholder={placeholderCari}
        aria-label={labelCari}
      />
    </>
  );

  const daftarChip = chips && (
    <div className="chips" role="group" aria-label="Saring daftar">
      {chips.map((c) => (
        <button key={c.id} type="button" className="chip"
          aria-pressed={saring === c.id} onClick={() => setSaring(c.id)}>
          {c.label}
          <span className="chip__n">
            {c.cocok ? terkena.filter(c.cocok).length : terkena.length}
          </span>
        </button>
      ))}
    </div>
  );

  const panelSaringan = saringan && (
    <Popover
      title="Saringan"
      trigger={
        <button type="button" className="btn btn--secondary btn--icon btn--boxed"
          aria-label="Saringan dan urutan">
          <Icon name="filter" size={16} />
        </button>
      }
    >
      <div className="stack" style={{ gap: "var(--space-4)", minWidth: "15rem" }}>
        {saringan}
        <button type="button" className="btn btn--secondary" disabled={!adaSaringan}
          onClick={() => {
            setCari("");
            setSaring(chips?.[0]?.id ?? "semua");
            onBersihkan?.();
          }}>
          <Icon name="close" size={14} />Bersihkan semua
        </button>
      </div>
    </Popover>
  );

  const isiKosong = (
    <div className="empty">
      <span className="icon-tile"><Icon name={kosong.ikon} size={20} /></span>
      <span className="t-subheading">
        {data.length === 0
          ? kosong.judul
          : cari
            ? `Tidak ada hasil untuk "${cari}"`
            : `Tidak ada ${satuan} dengan saringan ini`}
      </span>
      <p className="t-muted">
        {data.length === 0 ? kosong.keterangan : "Coba kata kunci atau saringan lain."}
      </p>
    </div>
  );

  const badanTabel = (
    <tbody>
      {terlihat.map((baris, i) => (
        <tr key={kunci(baris)}>
          {!kartu && <td className="table__idx">{i + 1}</td>}
          {kolom.map((k) => (
            <td key={k.judul} className={k.kelas}>{k.render(baris, i)}</td>
          ))}
        </tr>
      ))}
    </tbody>
  );

  const kepalaTabel = (
    <thead>
      <tr>
        {!kartu && <th className="table__idx">#</th>}
        {kolom.map((k) => <th key={k.judul} className={k.kelas}>{k.judul}</th>)}
      </tr>
    </thead>
  );

  /* ── Bentuk kartu: bilah dan tabel berkartu, seperti Halaman Proyek ──── */
  if (kartu) {
    return (
      <div className="kartudaftar">
        <div className="kartudaftar__bar">
          <div className="kartudaftar__cari">{kotakCari}</div>

          <div className="kartudaftar__meta">
            <p className="kartudaftar__hitung">
              <span>Total: <strong>{data.length}</strong></span>
              {/* Baris kedua muncul HANYA saat daftarnya memang sedang
                  disaring. Menampilkan "Tampil: 7 dari 7" di daftar yang utuh
                  cuma menambah angka yang tidak pernah berubah. */}
              {terlihat.length !== data.length && (
                <span>Tampil: <strong>{terlihat.length}</strong></span>
              )}
            </p>

            <div className="kartudaftar__alat">
              {tampilan}
              {panelSaringan}
              {aksi}
            </div>
          </div>

          {daftarChip}
        </div>

        {terlihat.length === 0 ? isiKosong : gantiIsi ? gantiIsi(terlihat) : (
          <div className="table-wrap kartudaftar__wrap">
            <table className="table table--ruled kartudaftar__tabel">
              {kepalaTabel}
              {badanTabel}
            </table>
          </div>
        )}
      </div>
    );
  }

  /* ── Bentuk listbar: full-bleed, seperti Semua Proyek ─────────────────── */
  return (
    <div className="listpage">
      <div className="listbar">
        <div className="listbar__main">
          <div className="listbar__search">{kotakCari}</div>
          {tampilan && <div className="listbar__views">{tampilan}</div>}
          {aksi && <div className="listbar__cta">{aksi}</div>}
        </div>

        {(chips || saringan) && (
          <div className="listbar__filters">
            {daftarChip}
            {panelSaringan}
          </div>
        )}
      </div>

      {terlihat.length === 0 ? (
        <div className="listpage__pad">{isiKosong}</div>
      ) : gantiIsi ? (
        <div className="listpage__pad">{gantiIsi(terlihat)}</div>
      ) : (
        <div className="table-wrap">
          <div className="listcount">
            <strong>1–{terlihat.length}</strong>&nbsp;dari&nbsp;<strong>{data.length}</strong>&nbsp;{satuan}
          </div>
          <table className="table table--ruled">
            {kepalaTabel}
            {badanTabel}
          </table>
        </div>
      )}
    </div>
  );
}
