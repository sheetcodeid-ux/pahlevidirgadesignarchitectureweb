import { useState } from "react";
import { Banding } from "./Banding";
import { Tombol, TombolIkon } from "./Tombol";
import { Segmen } from "./Segmen";
import { Lencana, Angka, Titik } from "./Lencana";
import { Remah } from "./Remah";
import { Paginasi } from "./Paginasi";
import { Cari, Isian, Centang, Sakelar } from "./Isian";
import { Ikon } from "./Ikon";
import {
  CalendarBlank,
  CaretDown,
  ChatTeardropDots,
  NavSquaresFour,
  Paperclip,
  SmileySticker,
} from "./ikon";

/* =============================================================================
   Seluruh pasangan banding, satu tempat.

   Teks contoh sengaja disamakan dengan yang ada di frame Figma ("Label",
   "Completed", "Paid") supaya lebar kotaknya bisa dibandingkan juga — di
   halaman sungguhan labelnya tentu berbahasa Indonesia.
   ============================================================================= */

function Grup({ judul, children }: { judul: string; children: React.ReactNode }) {
  return (
    <>
      <h3 className="k-galeri__subjudul">{judul}</h3>
      <div className="k-banding__daftar">{children}</div>
    </>
  );
}

export function GaleriBanding() {
  const [seg, setSeg] = useState("a");
  const [, setHal] = useState(3);

  return (
    <section className="k-galeri__seksi">
      <h2 className="k-galeri__judul">Banding dengan Figma</h2>
      <p className="k-galeri__ket">
        Acuan Figma di atas, komponen kit di bawah, perbesaran 3x, tepi kiri dan
        atas berimpit. Garis putus-putus adalah tepi kanan dan bawah milik
        Figma — apa pun yang meleset satu piksel menonjol keluar garis itu.
        Teks acuan berbahasa Inggris dan sudah jadi outline; yang dibandingkan
        kotak, warna, radius, dan letak ikonnya.
      </p>

      <Grup judul="Tombol">
        <Banding kunci="btn-small-primary-kiri">
          <Tombol ukuran="small" jenis="primary" kiri={CalendarBlank}>Button</Tombol>
        </Banding>
        <Banding kunci="btn-small-secondary-kanan">
          <Tombol ukuran="small" jenis="secondary" kanan={CaretDown}>Button</Tombol>
        </Banding>
        <Banding kunci="btn-small-ghost-kosong">
          <Tombol ukuran="small" jenis="ghost">Button</Tombol>
        </Banding>
        <Banding kunci="btn-medium-primary-kiri">
          <Tombol ukuran="medium" jenis="primary" kiri={CalendarBlank}>Button</Tombol>
        </Banding>
        <Banding kunci="btn-medium-secondary-kanan">
          <Tombol ukuran="medium" jenis="secondary" kanan={CaretDown}>Button</Tombol>
        </Banding>
        <Banding kunci="btn-medium-ghost-kosong">
          <Tombol ukuran="medium" jenis="ghost">Button</Tombol>
        </Banding>
        <Banding kunci="btn-medium-primary-dua">
          <Tombol ukuran="medium" jenis="primary" kiri={CalendarBlank} kanan={CaretDown}>Button</Tombol>
        </Banding>
        <Banding kunci="btn-large-primary-kiri">
          <Tombol ukuran="large" jenis="primary" kiri={CalendarBlank}>Button</Tombol>
        </Banding>
        <Banding kunci="btn-large-secondary-kanan">
          <Tombol ukuran="large" jenis="secondary" kanan={CaretDown}>Button</Tombol>
        </Banding>
        <Banding kunci="btn-large-ghost-kosong">
          <Tombol ukuran="large" jenis="ghost">Button</Tombol>
        </Banding>
        <Banding kunci="btn-large-primary-dua">
          <Tombol ukuran="large" jenis="primary" kiri={CalendarBlank} kanan={CaretDown}>Button</Tombol>
        </Banding>
      </Grup>

      <Grup judul="Tombol ikon">
        <Banding kunci="btnikon-xsmall-primary">
          <TombolIkon ukuran="xsmall" jenis="primary" ikon={ChatTeardropDots} judul="Pesan" />
        </Banding>
        <Banding kunci="btnikon-small-primary">
          <TombolIkon ukuran="small" jenis="primary" ikon={ChatTeardropDots} judul="Pesan" />
        </Banding>
        <Banding kunci="btnikon-medium-primary">
          <TombolIkon ukuran="medium" jenis="primary" ikon={ChatTeardropDots} judul="Pesan" titik titikJudul="3 pesan belum dibaca" />
        </Banding>
        <Banding kunci="btnikon-medium-ghost">
          <TombolIkon ukuran="medium" jenis="ghost" ikon={ChatTeardropDots} judul="Pesan" titik titikJudul="3 pesan belum dibaca" />
        </Banding>
        <Banding kunci="btnikon-large-primary">
          <TombolIkon ukuran="large" jenis="primary" ikon={ChatTeardropDots} judul="Pesan" titik titikJudul="3 pesan belum dibaca" />
        </Banding>
        <Banding kunci="btnikon-large-secondary">
          <TombolIkon ukuran="large" jenis="secondary" ikon={ChatTeardropDots} judul="Pesan" titik titikJudul="3 pesan belum dibaca" />
        </Banding>
      </Grup>

      <Grup judul="Tombol bersegmen">
        <Banding kunci="segmen-2" zoom={2}>
          <Segmen
            judul="Contoh"
            nilai={seg}
            onPilih={setSeg}
            segmen={[{ nilai: "a", label: "Label" }, { nilai: "b", label: "Label" }]}
          />
        </Banding>
        <Banding kunci="segmen-3" zoom={2}>
          <Segmen
            judul="Contoh"
            nilai={seg}
            onPilih={setSeg}
            segmen={[
              { nilai: "a", label: "Label" },
              { nilai: "b", label: "Label" },
              { nilai: "c", label: "Label" },
            ]}
          />
        </Banding>
        <Banding kunci="segmen-4" zoom={2}>
          <Segmen
            judul="Contoh"
            nilai={seg}
            onPilih={setSeg}
            segmen={[
              { nilai: "a", label: "Label" },
              { nilai: "b", label: "Label" },
              { nilai: "c", label: "Label" },
              { nilai: "d", label: "Label" },
            ]}
          />
        </Banding>
      </Grup>

      <Grup judul="Tombol nav">
        <Banding kunci="nav-aktif" zoom={2}>
          <div style={{ width: 177 }}>
            <button type="button" className="k-nav is-aktif">
              <Ikon ikon={NavSquaresFour} ukuran={24} />
              Dashboard
            </button>
          </div>
        </Banding>
        <Banding
          kunci="nav-mati"
          zoom={2}
          tanpaKotak
          catatan="acuan Figma tanpa kotak — varian tidak aktif memang tidak punya latar, jadi yang terukur cuma tinta ikon dan teksnya"
        >
          <div style={{ width: 177 }}>
            <button type="button" className="k-nav">
              <Ikon ikon={NavSquaresFour} ukuran={24} />
              Dashboard
            </button>
          </div>
        </Banding>
        <Banding kunci="nav-sub-aktif" zoom={2}>
          <div style={{ width: 177 }}>
            <button type="button" className="k-nav k-nav--sub is-aktif">Dashboard</button>
          </div>
        </Banding>
      </Grup>

      <Grup judul="Lencana">
        <Banding kunci="lencana-garis-selesai">
          <Lencana bentuk="garis" nada="selesai">Completed</Lencana>
        </Banding>
        <Banding kunci="lencana-garis-menunggu">
          <Lencana bentuk="garis" nada="menunggu">Pending</Lencana>
        </Banding>
        <Banding kunci="lencana-garis-gagal">
          <Lencana bentuk="garis" nada="gagal">Failed</Lencana>
        </Banding>
        <Banding kunci="lencana-v2-selesai">
          <Lencana bentuk="pejalkecil" nada="selesai">Completed</Lencana>
        </Banding>
        <Banding kunci="lencana-pejal-selesai">
          <Lencana bentuk="pejal" nada="selesai">Completed</Lencana>
        </Banding>
        <Banding kunci="lencana-pejal-gagal">
          <Lencana bentuk="pejal" nada="gagal">Failed</Lencana>
        </Banding>
        <Banding kunci="lencana-pil-lunas">
          <Lencana bentuk="pil" nada="selesai">Paid</Lencana>
        </Banding>
        <Banding kunci="lencana-pil-telat">
          <Lencana bentuk="pil" nada="gagal">Overdue</Lencana>
        </Banding>
        <Banding kunci="lencana-pil-belum">
          <Lencana bentuk="pil" nada="netral">Unpaid</Lencana>
        </Banding>
        {/* Framenya menulis "99" — contohnya harus kata yang sama, kalau tidak
            yang dibandingkan lebar dua tulisan yang berbeda. */}
        <Banding kunci="angka-18" zoom={6}>
          <Angka jumlah={99} judul="Contoh" />
        </Banding>
        <Banding kunci="angka-13" zoom={6}>
          <Angka jumlah={99} kecil judul="Contoh" />
        </Banding>
        <Banding kunci="titik-10" zoom={6}>
          <Titik judul="Contoh" />
        </Banding>
        <Banding kunci="titik-8" zoom={6}>
          <Titik kecil judul="Contoh" />
        </Banding>
      </Grup>

      <Grup judul="Remah &amp; paginasi">
        <Banding
          kunci="remah-2"
          zoom={2}
          tanpaKotak
          catatan="acuan tanpa kotak, dan isi teksnya sudah jadi outline — yang dicocokkan ukuran huruf, warna, dan jaraknya"
        >
          <Remah
            jalur={[
              { label: "Link 1", href: "#" },
              { label: "Link 2", href: "#" },
              { label: "Page" },
            ]}
          />
        </Banding>
        {/* Framenya menggambar halaman PERTAMA dari 12: tombol "sebelumnya"
            mati, empat tombol angka, satu jeda, lalu tombol "berikutnya".
            Halaman ke-1 menghasilkan susunan yang persis sama. */}
        <Banding kunci="paginasi-default" zoom={2}>
          <Paginasi kini={1} total={12} onPindah={setHal} />
        </Banding>
        <Banding kunci="paginasi-ponsel" zoom={2}>
          <Paginasi kini={1} total={12} onPindah={setHal} ponsel />
        </Banding>
      </Grup>

      <Grup judul="Isian">
        <Banding kunci="cari-large" zoom={2}>
          <Cari ukuran="large" judul="Cari" placeholder="Search placeholder" />
        </Banding>
        <Banding kunci="cari-medium" zoom={2}>
          <Cari ukuran="medium" judul="Cari" placeholder="Search placeholder" />
        </Banding>
        <Banding kunci="cari-small" zoom={2}>
          <Cari ukuran="small" judul="Cari" placeholder="Search placeholder" />
        </Banding>
        <Banding kunci="isian-large" zoom={2}>
          <div style={{ width: 236 }}>
            <Isian label="Label" placeholder="Placeholder" kiri={SmileySticker}
              kanan={<Ikon ikon={Paperclip} ukuran={18} />} />
          </div>
        </Banding>
        <Banding kunci="centang-13" zoom={6}><Centang ukuran="default" defaultChecked /></Banding>
        <Banding kunci="centang-17" zoom={6}><Centang ukuran="medium" defaultChecked /></Banding>
        <Banding kunci="centang-23" zoom={6}><Centang ukuran="big" defaultChecked /></Banding>
        <Banding kunci="sakelar-on" zoom={6}><Sakelar judul="Contoh" defaultChecked /></Banding>
        <Banding kunci="sakelar-off" zoom={6}><Sakelar judul="Contoh" /></Banding>
      </Grup>
    </section>
  );
}
