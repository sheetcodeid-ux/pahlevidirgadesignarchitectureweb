import type { ReactNode } from "react";
import { Icon } from "../ui/Icon";

/**
 * Panel kanan yang menempel untuk keenam halaman Situs Publik.
 *
 * Dibuat satu, bukan enam, karena keenamnya menjawab pertanyaan yang sama —
 * "sudah lengkap belum, dan di mana saya bisa melihat hasilnya?" — dan enam
 * salinan yang menjawabnya sendiri-sendiri PASTI menyimpang: satu dapat tautan
 * ke situs, satunya tidak; satu menghitung yang kosong, satunya cuma bilang
 * "belum lengkap".
 *
 * Sempat ada kepala halaman selebar grid yang memuat ikon besar, judul, letak,
 * chip alamat, dan meter kelengkapan. DIBUANG atas permintaan pemilik. Yang
 * ikut pindah ke sini cuma dua hal yang memang membawa keterangan: lencana
 * status dan tautan ke halaman publiknya — keduanya tidak punya tempat lain,
 * dan tanpa keduanya panel ini kembali jadi daftar angka tanpa jalan keluar.
 * Judul halamannya sendiri tidak dibawa: ia sudah tercetak di bilah atas.
 */

export interface FaktaSisi {
  label: string;
  /** Nilainya sudah jadi — angka diformat di pemanggil, bukan di sini. */
  nilai: ReactNode;
}

export interface SisiSitusProps {
  /** Sudah lengkap atau belum. Menentukan warna lencana dan ikonnya. */
  lengkap: boolean;
  /** Kalimat lencana. Pendek — ia dibaca sekilas, bukan dibaca utuh. */
  status: string;
  fakta?: FaktaSisi[];
  /** Alamat halaman publik yang menampilkannya. Boleh berisi #anchor. */
  tautan: string;
  tautanLabel: string;
  /** Tombol aksi utama halaman itu. Di bawah kartu, bukan di dalam. */
  children?: ReactNode;
}

export function SisiSitus({
  lengkap, status, fakta, tautan, tautanLabel, children,
}: SisiSitusProps) {
  return (
    <aside className="buatpage__aksi">
      <section className="buat-kartu sisi-proyek">
        <h2 className="buat-kartu__judul">Tampil di situs</h2>

        {/* Lencana status, bukan kalimat biasa: yang dicari mata saat membuka
            halaman ini adalah "masih ada yang kurang atau tidak", dan itu
            jawaban satu kata yang tidak perlu dibaca sampai habis. */}
        <span className={`badge ${lengkap ? "badge--success" : "badge--warn"} sisi-situs__status`}>
          <Icon name={lengkap ? "check" : "alert"} size={13} />
          {status}
        </span>

        {fakta && fakta.length > 0 && (
          <dl className="sisi-proyek__fakta">
            {fakta.map((f) => (
              <div key={f.label}>
                <dt>{f.label}</dt>
                <dd>{f.nilai}</dd>
              </div>
            ))}
          </dl>
        )}

        {/* Tautan ke halaman publiknya. Tanpa ini, satu-satunya cara memeriksa
            hasilnya adalah menebak alamatnya sendiri — dan halaman yang paling
            sering salah tebak justru yang paling jarang dibuka. */}
        <a className="btn btn--ghost btn--sm sisi-proyek__tautan"
          href={tautan} target="_blank" rel="noreferrer">
          <Icon name="globe" size={15} />{tautanLabel}
        </a>
      </section>

      {children}
    </aside>
  );
}

/**
 * Catatan tetap di kaki panel kanan: perubahan di sini baru tampil di situs
 * setelah Terbitkan ditekan. Dipisah jadi komponen sendiri karena kalimatnya
 * harus SAMA di keenam halaman — pemilik pernah menyimpulkan sebuah fitur
 * rusak padahal datanya benar dan situsnya saja yang belum dibangun ulang.
 */
export function CatatanTerbit() {
  return (
    <p className="buat-aksi__catatan sisi-terbit">
      <Icon name="info" size={13} />
      <span>
        Tersimpan langsung, tapi baru tampil di situs setelah
        {" "}<strong>Terbitkan</strong> di bilah atas ditekan.
      </span>
    </p>
  );
}
