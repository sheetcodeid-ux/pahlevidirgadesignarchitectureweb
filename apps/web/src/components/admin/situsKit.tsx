import type { ReactNode } from "react";
import { Lencana } from "../kit/Lencana";
import { Ikon } from "../kit/Ikon";
import { Globe } from "../kit/ikon";

/* =============================================================================
   Kerangka halaman "Situs Publik" di kit — Logo Klien, Tim Studio, Sebelum &
   Sesudah, Angka di FAQ, Privasi, Identitas Studio, dan Info Studio.

   Bentuknya frame 34 yang sama dengan Halaman Publik dan Portal Klien: isi
   di kolom kiri (724), kolom kanan (210) yang lengket berisi keadaan,
   tombol Simpan, dan tautan ke halaman publiknya. Dibuat SATU, bukan tujuh,
   dengan alasan yang sama seperti `SisiSitus` lama: ketujuhnya menjawab
   pertanyaan yang sama — "sudah lengkap belum, dan di mana saya bisa
   melihat hasilnya?" — dan tujuh salinan yang menjawabnya sendiri-sendiri
   pasti menyimpang.
   ============================================================================= */

export interface FaktaSisi {
  label: string;
  nilai: ReactNode;
}

export function HalamanSitus({
  children,
  lengkap,
  status,
  fakta,
  tautan,
  tautanLabel,
  aksi,
}: {
  children: ReactNode;
  /** Sudah lengkap atau belum — menentukan nada lencananya. */
  lengkap: boolean;
  status: string;
  fakta?: FaktaSisi[];
  /** Alamat halaman publik yang menampilkannya. Boleh berisi #anchor. */
  tautan: string;
  tautanLabel: string;
  /** Tombol Simpan dan penandanya — menempel di dasar layar pada satu kolom. */
  aksi?: ReactNode;
}) {
  return (
    <div className="pas situs">
      <div className="pas__badan">
        <div className="pas__utama pf__utama">{children}</div>

        <aside className="pf__samping" aria-label="Tampil di situs">
          <div className="pf__info">
            <p className="pas__sampingjudul">Tampil di situs</p>
            {/* Lencana, bukan kalimat: yang dicari mata saat membuka halaman
                ini "masih ada yang kurang atau tidak" — jawaban satu kata. */}
            <Lencana bentuk="pil" nada={lengkap ? "selesai" : "menunggu"}>
              {status}
            </Lencana>
            {fakta && fakta.length > 0 && (
              <dl className="pf__fakta">
                {fakta.map((f) => (
                  <div key={f.label}>
                    <dt>{f.label}</dt>
                    <dd>{f.nilai}</dd>
                  </div>
                ))}
              </dl>
            )}
            {/* Tanpa tautan ini, satu-satunya cara memeriksa hasilnya adalah
                menebak alamatnya sendiri. */}
            <a className="pf__tautan" href={tautan} target="_blank" rel="noreferrer">
              <Ikon ikon={Globe} ukuran={14} />
              {tautanLabel}
            </a>
          </div>

          {aksi && <div className="pf__simpan">{aksi}</div>}

          {/* Kalimatnya SAMA di ketujuh halaman — pemilik pernah menyimpulkan
              sebuah fitur rusak padahal datanya benar dan situsnya saja yang
              belum dibangun ulang. */}
          <p className="pf__statusket situs__terbit">
            Tersimpan langsung, tapi baru tampil di situs setelah tombol <b>Terbitkan</b> (bola dunia di kanan
            atas) ditekan.
          </p>
        </aside>
      </div>
    </div>
  );
}

/** Penanda simpan di bawah tombol: titik hijau = tersimpan, amber = belum. */
export function PenandaSimpan({ n, teks }: { n: number; teks?: string }) {
  return (
    <p className={`pf__penanda${n > 0 ? " pf__penanda--belum" : ""}`}>
      <span aria-hidden="true" />
      {teks ?? (n > 0 ? `${n} perubahan belum disimpan` : "Semua perubahan tersimpan")}
    </p>
  );
}

/** Judul bagian di kolom kiri, dengan keterangan kecil di kanannya. */
export function KepalaBagian({ judul, kanan }: { judul: string; kanan?: ReactNode }) {
  return (
    <div className="situs__kepala">
      <h3 className="pf__subjudul">{judul}</h3>
      {kanan && <span className="situs__ket">{kanan}</span>}
    </div>
  );
}
