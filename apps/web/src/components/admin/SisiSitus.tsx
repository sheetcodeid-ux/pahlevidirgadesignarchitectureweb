import type { ReactNode } from "react";
import { Icon } from "../ui/Icon";
import type { IconName } from "../ui/Icon";

/**
 * Kerangka bersama keenam halaman Situs Publik: satu kepala selebar halaman
 * dan satu panel kanan yang menempel.
 *
 * Dibuat satu, bukan enam, karena keenamnya menjawab pertanyaan yang sama —
 * "apa yang saya urus di sini, sudah lengkap belum, dan di mana saya bisa
 * melihat hasilnya?" — dan enam salinan yang menjawabnya sendiri-sendiri
 * PASTI menyimpang.
 *
 * Pembagian tugasnya sengaja tegas, karena versi sebelumnya melanggarnya:
 * identitas halaman (ikon, judul, letak, tautan ke situs) tinggal di KEPALA,
 * dan panel kanan cuma memuat angka dan aksi. Sebelumnya panel kanan memuat
 * keduanya, sehingga halaman membuka dengan judul yang sama dicetak dua kali
 * dalam dua ukuran — yang terbaca sebagai kesalahan tempel, bukan hierarki.
 */

export interface FaktaSisi {
  label: string;
  /** Nilainya sudah jadi — angka diformat di pemanggil, bukan di sini. */
  nilai: ReactNode;
}

export interface KepalaSitusProps {
  /** Judul halaman. Menyebut BAGIAN situsnya, bukan nama menu admin. */
  judul: string;
  /** Satu kalimat: bagian mana di situs yang diurus halaman ini. */
  letak: string;
  ikon: IconName;
  /** Alamat halaman publiknya. Boleh berisi #anchor. */
  tautan: string;
  /**
   * Kelengkapan sebagai pecahan. `dari` nol berarti belum ada apa pun yang
   * bisa dihitung, dan meternya tidak digambar — bar kosong tanpa satu pun
   * segmen terbaca sebagai gagal memuat, bukan sebagai "belum ada isinya".
   */
  terisi: number;
  dari: number;
  /** Kalimat lencana. Pendek — ia dibaca sekilas, bukan dibaca utuh. */
  status: string;
}

/* Alamat yang dicetak di chip. Dipisah jadi tetapan supaya kalau domainnya
   berubah, yang diubah satu baris — bukan enam pemanggil. */
const DOMAIN = "pahlevidirgaarchitecture.com";

export function KepalaSitus({
  judul, letak, ikon, tautan, terisi, dari, status,
}: KepalaSitusProps) {
  const lengkap = dari > 0 && terisi >= dari;
  const keadaan = dari === 0 ? "kosong" : lengkap ? "lengkap" : "kurang";

  /* Meter BERSEGMEN, bukan bar mulus: yang diukur di keenam halaman ini selalu
     berupa benda yang bisa dihitung — delapan logo, dua tahun, lima keterangan
     hukum — jadi satu segmen per benda mengatakan sesuatu yang benar, dan
     pemilik bisa membaca "tinggal dua lagi" tanpa mengurangi sendiri.
     Di atas 16 benda segmennya jadi terlalu tipis untuk dibedakan, dan di situ
     meternya berubah jadi bar tunggal. */
  const bersegmen = dari > 0 && dari <= 16;

  return (
    <header className={`kepalasitus kepalasitus--${keadaan}`}>
      <span className="kepalasitus__ikon"><Icon name={ikon} size={22} /></span>

      <div className="kepalasitus__teks">
        <span className="kepalasitus__mata">Situs publik</span>
        <h1 className="kepalasitus__judul">{judul}</h1>
        <p className="kepalasitus__ket">{letak}</p>
      </div>

      {/* Chip alamat: tautan ke halaman publiknya, ditulis sebagai alamat
          sungguhan. Sebelumnya ini tombol "Lihat di situs" di panel kanan —
          dipindah ke sini karena yang menjawab "di mana hasilnya" adalah
          identitas halaman, dan alamat yang terbaca utuh menjawabnya lebih
          langsung daripada kata kerja. */}
      <a className="kepalasitus__alamat" href={tautan} target="_blank" rel="noreferrer">
        <Icon name="globe" size={14} />
        <span className="kepalasitus__domain">{DOMAIN}</span>
        {/* Beranda TIDAK mencetak jalurnya. "pahlevidirgaarchitecture.com /"
            dengan garis miring tebal menggantung di ujung terbaca sebagai
            alamat yang terpotong, bukan sebagai beranda. */}
        {tautan !== "/" && <b>{tautan}</b>}
        <Icon name="external" size={13} />
      </a>

      <div className="kepalasitus__ukur">
        <span className="kepalasitus__status">
          <Icon name={dari === 0 ? "info" : lengkap ? "check" : "alert"} size={13} />
          {status}
        </span>

        {dari > 0 && (
          <>
            <span className="kepalasitus__angka">
              <b className="t-num">{terisi}</b>
              <span className="t-num">/ {dari}</span>
            </span>
            <span className="kepalasitus__meter" role="img"
              aria-label={`${terisi} dari ${dari} sudah lengkap`}>
              {bersegmen
                ? Array.from({ length: dari }, (_, n) => (
                    <i key={n} className={n < terisi ? "on" : undefined} />
                  ))
                : <i className="kepalasitus__bar" style={{ width: `${(terisi / dari) * 100}%` }} />}
            </span>
          </>
        )}
      </div>
    </header>
  );
}

export interface SisiSitusProps {
  fakta?: FaktaSisi[];
  /** Tombol aksi utama halaman itu. Di bawah kartu ringkasan, bukan di dalam. */
  children?: ReactNode;
}

export function SisiSitus({ fakta, children }: SisiSitusProps) {
  return (
    <aside className="buatpage__aksi">
      {fakta && fakta.length > 0 && (
        <section className="buat-kartu sisi-proyek">
          <h2 className="buat-kartu__judul">Ringkasan</h2>
          <dl className="sisi-proyek__fakta">
            {fakta.map((f) => (
              <div key={f.label}>
                <dt>{f.label}</dt>
                <dd>{f.nilai}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

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
