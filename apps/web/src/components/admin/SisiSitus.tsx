import type { ReactNode } from "react";
import { Icon } from "../ui/Icon";
import type { IconName } from "../ui/Icon";

/**
 * Panel kanan yang menempel untuk keenam halaman Situs Publik.
 *
 * Dibuat satu, bukan enam, karena keenamnya menjawab pertanyaan yang sama —
 * "apa yang saya urus di sini, sudah lengkap belum, dan di mana saya bisa
 * melihat hasilnya?" — dan enam salinan yang menjawabnya sendiri-sendiri
 * PASTI menyimpang: satu dapat tautan ke situs, satunya tidak; satu menghitung
 * yang kosong, satunya cuma bilang "belum lengkap".
 *
 * Bentuknya sengaja sama persis dengan panel "Proyek yang dibuka" di Halaman
 * Proyek (`.buatpage__aksi` + `.buat-kartu` + `.sisi-proyek__fakta`), karena
 * itu yang diminta pemilik: satu bahasa visual untuk seluruh panel admin.
 */

export interface FaktaSisi {
  label: string;
  /** Nilainya sudah jadi — angka diformat di pemanggil, bukan di sini. */
  nilai: ReactNode;
}

export interface SisiSitusProps {
  /** Judul kartu. Menyebut BAGIAN situsnya, bukan nama halaman admin. */
  judul: string;
  /** Satu kalimat: bagian mana di situs yang diurus halaman ini. */
  letak: string;
  ikon: IconName;
  /** Sudah lengkap atau belum. Menentukan warna lencana dan ikonnya. */
  lengkap: boolean;
  /** Kalimat lencana. Pendek — ia dibaca sekilas, bukan dibaca utuh. */
  status: string;
  fakta?: FaktaSisi[];
  /** Alamat halaman publik yang menampilkannya. Boleh berisi #anchor. */
  tautan: string;
  tautanLabel: string;
  /** Tombol aksi utama halaman itu. Ditaruh di bawah kartu, bukan di dalam. */
  children?: ReactNode;
}

export function SisiSitus({
  judul, letak, ikon, lengkap, status, fakta, tautan, tautanLabel, children,
}: SisiSitusProps) {
  return (
    <aside className="buatpage__aksi">
      <section className="buat-kartu sisi-proyek">
        {/* Label kartu menyebut FUNGSINYA, bukan mengulang judul di bawahnya.
            Versi pertama mencetak "LOGO KLIEN" lalu "Logo klien" dua baris di
            bawahnya — dua baris yang mengatakan hal sama persis terbaca
            sebagai kesalahan tempel, bukan sebagai hierarki. */}
        <h2 className="buat-kartu__judul">Tampil di situs</h2>

        <div className="sisi-proyek__kepala">
          <span className="sisi-proyek__sampul"><Icon name={ikon} size={18} /></span>
          <span className="card__titles">
            <span className="t-subheading">{judul}</span>
            <span className="t-muted">{letak}</span>
          </span>
        </div>

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
    <p className="t-muted buat-aksi__catatan" style={{ fontSize: "var(--text-xs)" }}>
      Tersimpan langsung, tapi baru tampil di situs setelah
      {" "}<strong>Terbitkan</strong> di bilah atas ditekan.
    </p>
  );
}
