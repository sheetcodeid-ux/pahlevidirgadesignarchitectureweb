import { useState } from "react";
import { Banding } from "./Banding";
import { Tombol, TombolIkon } from "./Tombol";
import { Segmen } from "./Segmen";
import { Tabel, SelDua, SelIkon, SelKeping, type KolomTabel } from "./Tabel";
import { Lencana, Angka, Titik } from "./Lencana";
import { Remah } from "./Remah";
import { Paginasi } from "./Paginasi";
import { Cari, Isian, Centang, Sakelar } from "./Isian";
import { KartuStatistik, KartuKas, Tren, TandaKas } from "./Kartu";
import { Ikon } from "./Ikon";
import {
  CalendarBlank,
  CoinIn,
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

/* Lebar kolom dari Figma: tepi kiri tiap sel = tinta teksnya dikurangi
   padding baris, dan lebar kolom = jarak ke tepi kiri kolom berikutnya.
   Jumlahnya PERSIS lebar barisnya — itu yang membuktikan pembacaannya benar. */
const KOL_DASH: KolomTabel[] = [
  { judul: "Transaction Name", lebar: 170.6, urut: true },
  { judul: "Date & Time", lebar: 92.3, urut: true },
  { judul: "Amount", lebar: 72.7, urut: true },
  { judul: "Note", lebar: 154.4, urut: true },
  { judul: "Status", lebar: 82, urut: true },
];
const KOL_INVEST: KolomTabel[] = [
  { judul: "Stock Symbol", lebar: 165.75, urut: true },
  { judul: "Invest Date", lebar: 113.35, urut: true },
  { judul: "Price", lebar: 99.3, urut: true },
  { judul: "Change", lebar: 93.5, urut: true },
  { judul: "Current Value", lebar: 99.85, urut: true },
];
/* Transaction punya kolom kotak centang di paling kiri. Lebarnya 32,5 —
   yaitu jarak tepi baris ke tepi kiri kolom berikutnya, bukan lebar kotak
   centangnya sendiri. */
const KOL_TRX: KolomTabel[] = [
  { judul: "Transaction Name", lebar: 201.9, urut: true },
  { judul: "Account", lebar: 241.5, urut: true },
  { judul: "Transaction ID", lebar: 121.7, urut: true },
  { judul: "Date & Time", lebar: 113.3, urut: true },
  { judul: "Amount", lebar: 95.7, urut: true },
  { judul: "Note", lebar: 235.4, urut: true },
  { judul: "Status", lebar: 97, urut: true },
];
const KOL_TABUNG: KolomTabel[] = [
  { judul: "Transaction Type", lebar: 250.5, urut: true },
  { judul: "Date & Time", lebar: 193.8, urut: true },
  { judul: "Amount", lebar: 128, urut: true },
  { judul: "Brief Note", lebar: 197.7, urut: true },
];

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
            segmen={[{ nilai: "a", label: "Button 1" }, { nilai: "b", label: "Button 2" }]}
          />
        </Banding>
        <Banding kunci="segmen-3" zoom={2}>
          <Segmen
            judul="Contoh"
            nilai={seg}
            onPilih={setSeg}
            segmen={[
              { nilai: "a", label: "Button 1" },
              { nilai: "b", label: "Button 2" },
              { nilai: "c", label: "Button 3" },
            ]}
          />
        </Banding>
        <Banding kunci="segmen-4" zoom={2}>
          <Segmen
            judul="Contoh"
            nilai={seg}
            onPilih={setSeg}
            segmen={[
              { nilai: "a", label: "Button 1" },
              { nilai: "b", label: "Button 2" },
              { nilai: "c", label: "Button 3" },
              { nilai: "d", label: "Button 4" },
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
              { label: "Link", href: "#" },
              { label: "Link", href: "#" },
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

      <Grup judul="Kartu">
        {/* Teks contoh disamakan dengan framenya supaya lebar kotaknya bisa
            ikut dibandingkan. */}
        <Banding kunci="stat-desktop" zoom={2}>
          <KartuStatistik
            ikon={CoinIn}
            judul="Total Income"
            nilai="$78,000"
            tren={<Tren naik>+ 1.78 %</Tren>}
            onMenu={() => {}}
          />
        </Banding>
        {/* Teks contoh disamakan PERSIS dengan framenya — termasuk tiga kolom
            di kakinya. Di halaman sungguhan isinya nama kas, saldo, dan
            periode; di sini yang diukur geometrinya, jadi kata yang berbeda
            cuma akan terbaca sebagai cacat yang tidak ada. */}
        <Banding kunci="kas-gelap" zoom={2}>
          <KartuKas
            nama={"Freedom Unlimited\nMastercard"}
            nilai="$532,000"
            label="Debit"
            kanan={<TandaKas />}
            kaki={[
              { judul: "Card Number", isi: "**** **** **** 3321" },
              { judul: "EXP", isi: "05/25" },
              { judul: "CVV", isi: "672" },
            ]}
          />
        </Banding>
        <Banding kunci="kas-terang" zoom={2}>
          <KartuKas
            terang
            nama={"Freedom Unlimited\nMastercard"}
            nilai="$532,000"
            label="Debit"
            kanan={<TandaKas terang />}
            kaki={[
              { judul: "Card Number", isi: "**** **** **** 3321" },
              { judul: "EXP", isi: "05/25" },
              { judul: "CVV", isi: "672" },
            ]}
          />
        </Banding>
      </Grup>

      {/* Tabel — empat dari tujuh jenis baris di frame Table. Ketujuhnya
          anatominya sama; yang berbeda daftar kolom, lebar kolom, dan tinggi
          barisnya, jadi keempat ini sudah menguji seluruh jalurnya. */}
      <Grup judul="Tabel">
        <Banding kunci="tabel-dash-kepala" zoom={1.5}>
          <div style={{ width: 572 }}>
            <Tabel kolom={KOL_DASH} baris={[]} pad={10} tinggiKepala={34} tinggiBaris={49} />
          </div>
        </Banding>
        <Banding kunci="tabel-dash-baris" zoom={1.5}>
          <div style={{ width: 572 }}>
            <Tabel
              kolom={KOL_DASH}
              baris={[[
                <SelDua atas="Dinner at Italian Restaurant" bawah="Dining Out" />,
                <SelDua atas="2024-03-01" bawah="04:28:48" />,
                "$226.25",
                "Dining out with family at a local Italian restaurant.",
                <Lencana bentuk="garis" nada="selesai">Completed</Lencana>,
              ]]}
              pad={10}
              tinggiKepala={34}
              tinggiBaris={49}
              fontBaris={10}
              tanpaKepala
            />
          </div>
        </Banding>
        <Banding kunci="tabel-invest-kepala" zoom={1.5}>
          <div style={{ width: 572 }}>
            <Tabel kolom={KOL_INVEST} baris={[]} pad={12.15} tinggiKepala={40} tinggiBaris={62} />
          </div>
        </Banding>
        <Banding kunci="tabel-invest-baris" zoom={1.5}>
          <div style={{ width: 572 }}>
            <Tabel
              kolom={KOL_INVEST}
              baris={[[
                <SelIkon ikon={CoinIn} ukuran={30} ikonPx={14}>
                  <SelDua besar atas="GOOGL" bawah="Amazon.com Inc." />
                </SelIkon>,
                "2024-01-15",
                "$3,250.00",
                "+$10.00",
                "$2,785.58",
              ]]}
              pad={12.15}
              tinggiKepala={40}
              tinggiBaris={62}
              tanpaKepala
            />
          </div>
        </Banding>
        <Banding kunci="tabel-tabung-kepala" zoom={1.5}>
          <div style={{ width: 770 }}>
            <Tabel
              kolom={KOL_TABUNG}
              baris={[]}
              pad={16}
              tinggiKepala={37}
              tinggiBaris={57}
              kepala="mint"
            />
          </div>
        </Banding>
        {/* Transaction: satu-satunya jenis yang punya kolom kotak centang.
            Kepala-nya TIDAK ikut dibandingkan — di Figma ia tanpa latar dan
            tanpa garis, jadi kotak acuannya cuma sebesar tinta teksnya dan
            letaknya tidak sah dibandingkan dengan baris selebar 1139. */}
        <Banding kunci="tabel-trx-baris" zoom={1}>
          <div style={{ width: 1139 }}>
            <Tabel
              kolom={KOL_TRX}
              baris={[[
                <SelIkon ikon={CoinIn} ukuran={30} ikonPx={14} jarak={10.48}>
                  <SelDua besar atas="Comcast Bill Payment" bawah="Food & Dining" />
                </SelIkon>,
                <SelKeping keping="Freedom">Freedom Unlimited Mastercard</SelKeping>,
                "4567890123",
                <SelDua besar atas="2024-09-24" bawah="14:30" />,
                <span style={{ color: "var(--danger)" }}>-$350.00</span>,
                "Monthly entertainment subscription",
                <Lencana bentuk="pil" nada="selesai">Completed</Lencana>,
              ]]}
              pilih
              pad={9.5}
              tinggiBaris={65}
              tanpaKepala
            />
          </div>
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
          <div style={{ width: 237 }}>
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
