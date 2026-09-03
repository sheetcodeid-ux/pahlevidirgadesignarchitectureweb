import type { CSSProperties, ReactNode } from "react";
import { Icon } from "./Icon";

/* Placeholder yang mengikuti bentuk isi halaman, bukan kotak abu seragam.
 *
 * Aturan yang membuat berkas ini tetap benar setahun lagi: **placeholder
 * memakai kelas markup yang SAMA dengan komponen aslinya** (.card, .item,
 * .field, .spec-grid), lalu mengganti isinya dengan balok abu. Tingginya,
 * jaraknya, dan radiusnya jadi ikut sendiri saat komponen aslinya berubah —
 * tidak ada angka yang perlu diselaraskan tangan, dan tidak ada placeholder
 * yang diam-diam meleset dari isi yang menggantikannya.
 *
 * Itu juga alasan komponen di sini tidak menerima ukuran piksel: begitu
 * pemanggil boleh menentukan tinggi baris, jaminan di atas hilang.
 */

/** Lebar baris teks dibuat berbeda-beda supaya terbaca seperti kalimat,
 *  bukan seperti tabel. Polanya tetap (bukan acak) supaya tidak berkedip
 *  berubah-ubah tiap render. */
const LEBAR = ["92%", "68%", "84%", "57%", "76%", "63%"];

interface BalokProps {
  /** Lebar CSS apa pun. Kosong = selebar wadahnya. */
  lebar?: string;
  /** Tinggi CSS. Bawaannya setinggi satu baris teks. */
  tinggi?: string;
  bulat?: boolean;
  style?: CSSProperties;
}

export function Balok({ lebar, tinggi, bulat, style }: BalokProps) {
  return (
    <span
      className={`skeleton${bulat ? " skeleton--circle" : ""}`}
      style={{ width: lebar, height: tinggi ?? "0.85em", display: "block", ...style }}
    />
  );
}

/** Beberapa baris teks dengan lebar berbeda — untuk paragraf dan keterangan. */
export function SkeletonTeks({ baris = 3 }: { baris?: number }) {
  return (
    <span className="stack skeleton--tunda" style={{ gap: "var(--space-2)" }}>
      {Array.from({ length: baris }, (_, i) => (
        <Balok key={i} lebar={LEBAR[i % LEBAR.length]} />
      ))}
    </span>
  );
}

/**
 * Satu baris daftar: judul, keterangan, dan kendali di ujung kanan —
 * bentuk .item yang dipakai hampir seluruh panel admin.
 */
export function SkeletonBaris({ aksi = 1 }: { aksi?: number }) {
  return (
    <div className="item item--bordered skeleton--tunda" aria-hidden="true">
      <span className="item__text">
        <Balok lebar="52%" tinggi="1rem" />
        <Balok lebar="34%" style={{ marginTop: "0.35rem" }} />
      </span>
      {Array.from({ length: aksi }, (_, i) => (
        <Balok key={i} lebar="2rem" tinggi="2rem" style={{ flex: "none", borderRadius: "var(--radius-sm)" }} />
      ))}
    </div>
  );
}

export function SkeletonDaftar({ jumlah = 3, aksi = 1 }: { jumlah?: number; aksi?: number }) {
  return (
    <div className="stack" style={{ gap: "var(--space-2)" }}>
      {Array.from({ length: jumlah }, (_, i) => <SkeletonBaris key={i} aksi={aksi} />)}
    </div>
  );
}

/**
 * Kartu dengan kepala dan isi. Ikonnya digambar sungguhan, bukan dibalok:
 * ubin ikon punya bentuk tetap yang sudah dikenali mata sebagai penanda
 * kartu, dan membalokkannya justru membuat halaman terlihat lebih kosong
 * daripada yang sebenarnya sedang dimuat.
 */
export function SkeletonKartu({
  ikon = "list", judul = true, anak,
}: { ikon?: Parameters<typeof Icon>[0]["name"]; judul?: boolean; anak?: ReactNode }) {
  return (
    <div className="card skeleton--tunda" aria-hidden="true">
      <div className="card__header">
        <span className="icon-tile" style={{ opacity: 0.4 }}><Icon name={ikon} size={20} /></span>
        {judul && (
          <span className="card__titles">
            <Balok lebar="38%" tinggi="1rem" />
            <Balok lebar="62%" style={{ marginTop: "0.35rem" }} />
          </span>
        )}
      </div>
      <div className="card__body">{anak ?? <SkeletonDaftar />}</div>
    </div>
  );
}

/** Deretan ubin angka — bentuk kepala Dashboard dan halaman Keuangan. */
export function SkeletonStat({ jumlah = 3 }: { jumlah?: number }) {
  return (
    <div className="spec-grid skeleton--tunda" aria-hidden="true">
      {Array.from({ length: jumlah }, (_, i) => (
        <div className="card" key={i}>
          <div className="card__header">
            <span className="icon-tile" style={{ opacity: 0.4 }}><Icon name="list" size={18} /></span>
            <span className="card__titles">
              <Balok lebar="70%" tinggi="0.7rem" />
              <Balok lebar="2.5rem" tinggi="1.75rem" style={{ marginTop: "0.4rem" }} />
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Pasangan label + isian, memakai .spec-grid yang sama dengan formnya. */
export function SkeletonIsian({ jumlah = 4 }: { jumlah?: number }) {
  return (
    <div className="spec-grid skeleton--tunda" aria-hidden="true">
      {Array.from({ length: jumlah }, (_, i) => (
        <div className="field" key={i}>
          <Balok lebar="35%" tinggi="0.6rem" />
          {/* Tinggi isian mengikuti .input: padding 0.7rem atas-bawah
              ditambah satu baris teks. */}
          <Balok tinggi="2.85rem" style={{ borderRadius: "var(--radius-pill)" }} />
        </div>
      ))}
    </div>
  );
}

/** Deretan kotak gambar — galeri, material, dan lampiran foto. */
export function SkeletonKotak({ jumlah = 4, rasio = "4 / 3" }: { jumlah?: number; rasio?: string }) {
  return (
    <div className="row skeleton--tunda" style={{ gap: "var(--space-3)", overflow: "hidden" }} aria-hidden="true">
      {Array.from({ length: jumlah }, (_, i) => (
        <span key={i} className="skeleton"
          style={{ flex: "0 0 min(13.5rem, 45%)", aspectRatio: rasio, borderRadius: "var(--radius-md)" }} />
      ))}
    </div>
  );
}

/**
 * Tabel — kepala kolomnya SUNGGUHAN, isinya balok.
 *
 * Label kolom tidak bergantung pada data: "Proyek", "Kategori", "Kota" sudah
 * pasti begitu sebelum permintaan apa pun dikirim. Menyembunyikannya di balik
 * balok abu membuang informasi yang sudah dimiliki halaman, dan membuat
 * skeleton-nya terbaca lebih kosong daripada keadaan sebenarnya. Ini yang
 * membedakan skeleton yang terasa "sudah setengah jadi" dari skeleton yang
 * terasa "belum apa-apa".
 *
 * Memakai <table> sungguhan dengan kelas .table yang sama, jadi tinggi baris,
 * padding sel, dan garisnya identik dengan tabel yang menggantikannya.
 */
export function SkeletonTabel({
  kolom, baris = 6,
}: {
  kolom: {
    label: string;
    lebar?: string;
    kelas?: string;
    /** Kolom yang di baris aslinya berisi thumbnail + dua baris teks. Tanpa
     *  ini barisnya jadi 30 px lebih pendek daripada baris sungguhannya —
     *  terukur, bukan dikira. */
    gambar?: boolean;
  }[];
  baris?: number;
}) {
  return (
    <table className="table table--ruled skeleton--tunda" aria-hidden="true">
      <thead>
        <tr>{kolom.map((k) => <th key={k.label} className={k.kelas}>{k.label}</th>)}</tr>
      </thead>
      <tbody>
        {Array.from({ length: baris }, (_, i) => (
          <tr key={i}>
            {kolom.map((k, j) => (
              <td key={k.label} className={k.kelas}>
                {k.gambar ? (
                  <span className="row" style={{ gap: "var(--space-3)", flexWrap: "nowrap", alignItems: "center" }}>
                    {/* 2.75rem persis .pcard__thumb */}
                    <Balok lebar="2.75rem" tinggi="2.75rem"
                      style={{ flex: "none", borderRadius: "var(--radius-md)" }} />
                    <span className="stack" style={{ gap: "0.3rem", flex: 1, minWidth: 0 }}>
                      <Balok lebar={LEBAR[i % LEBAR.length]} tinggi="0.9rem" />
                      <Balok lebar="45%" tinggi="0.7rem" />
                    </span>
                  </span>
                ) : (
                  <Balok lebar={k.lebar ?? LEBAR[(i + j) % LEBAR.length]} tinggi="0.9rem" />
                )}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
