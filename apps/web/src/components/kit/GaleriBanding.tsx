import { useState } from "react";
import { Banding } from "./Banding";
import { Tombol, TombolIkon } from "./Tombol";
import { Segmen } from "./Segmen";
import { SisiNav, BilahNav, type ItemNav } from "./Nav";
import { KolomGrafik, LabelYGrafik, Kilau, SelTanggal, SelHari } from "./Grafik";
import { Tabel, SelDua, SelIkon, SelKeping, type KolomTabel } from "./Tabel";
import { Lencana, Angka, Titik } from "./Lencana";
import { Remah } from "./Remah";
import { Paginasi } from "./Paginasi";
import { Cari, Isian, Centang, Sakelar } from "./Isian";
import { KartuStatistik, KartuKas, Tren, TandaKas } from "./Kartu";
import {
  KepalaSeksi,
  KepalaHalaman,
  TombolBulat,
  KakiHalaman,
  Gelembung,
  BarisPesan,
  BarisAktivitas,
  BarisLog,
  KepingTagar,
  KepingKategori,
  BarisAset,
  BarisPantau,
  BarisTransfer,
  BarisPenyedia,
  BarisBeban,
  BarisInbox,
  BarisTagar,
  BarisPenulis,
} from "./Item";
import { BarKemajuan, GrafikArea, Busur, KartuStatistikLebar, LencanaTren } from "./Ukuran";
import { Ikon } from "./Ikon";
import {
  ArrowLeft,
  Bell,
  CalendarBlank,
  CoinIn,
  CaretDown,
  ChatTeardropDots,
  DotsThree,
  FacebookLogo,
  InstagramLogo,
  LinkedinLogo,
  List,
  MagnifyingGlass,
  NavCalendarDots,
  NavReceipt,
  NavPersonSimpleTaiChi,
  ShoppingCart,
  Sliders,
  SpecialAppleLogo,
  SpecialShoppingCart,
  TwitterLogo,
  YoutubeLogo,
  NavArrowsLeftRight,
  NavCardholder,
  NavCoins,
  NavCreditCard,
  NavCurrencyEth,
  NavEnvelope,
  NavNewspaper,
  NavSealPercent,
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
  { judul: "Note", lebar: 154.4, urut: true, redup: true },
  { judul: "Status", lebar: 82, urut: true },
];
const KOL_INVEST: KolomTabel[] = [
  { judul: "Stock Symbol", lebar: 165.75, urut: true },
  { judul: "Invest Date", lebar: 113.35, urut: true },
  { judul: "Price", lebar: 99.3, urut: true, redup: true },
  { judul: "Change", lebar: 93.5, urut: true, redup: true },
  { judul: "Current Value", lebar: 99.85, urut: true, redup: true },
];
/* Transaction punya kolom kotak centang di paling kiri. Lebarnya 32,5 —
   yaitu jarak tepi baris ke tepi kiri kolom berikutnya, bukan lebar kotak
   centangnya sendiri. */
/* Sembilan baris menu Coinest, dengan ikon Nav/* masing-masing. Labelnya
   bahasa Inggris seperti di framenya — yang dibandingkan geometrinya, dan
   kata yang berbeda cuma akan terbaca sebagai cacat yang tidak ada. */
const MENU_NAV: ItemNav[] = [
  { ikon: NavSquaresFour, label: "Dashboard", aktif: true },
  { ikon: NavCreditCard, label: "Payments", lipat: true },
  { ikon: NavArrowsLeftRight, label: "Transactions" },
  { ikon: NavReceipt, label: "Invoices" },
  { ikon: NavCardholder, label: "Cards" },
  { ikon: NavCoins, label: "Saving Plans" },
  { ikon: NavCurrencyEth, label: "Investments" },
  { ikon: NavEnvelope, label: "Inbox", jumlah: 99, jumlahJudul: "99 pesan belum dibaca" },
  { ikon: NavSealPercent, label: "Promos" },
  { ikon: NavNewspaper, label: "Insights" },
];

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
          <Paginasi kini={1} total={16} onPindah={setHal} />
        </Banding>
        <Banding kunci="paginasi-ponsel" zoom={2}>
          <Paginasi kini={1} total={16} onPindah={setHal} ponsel />
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
                  {/* Transaction menyimpang: 12px/500 di atas dan 11px di bawah —
                      tinta "Comcast Bill Payment" 113,54 dan "Food & Dining"
                      64,84 di framenya. */}
                  <SelDua besar bobotAtas={500} pxBawah={11} atas="Comcast Bill Payment" bawah="Food & Dining" />
                </SelIkon>,
                <SelKeping keping="Freedom">Freedom Unlimited Mastercard</SelKeping>,
                "4567890123",
                <SelDua besar bobotAtas={500} pxBawah={11} atas="2024-09-24" bawah="14:30" />,
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

      <Grup judul="Rel samping & bilah atas">
        {/* Tinggi 1034 diberikan dari luar: itu tinggi kanvas halaman di
            Figma, bukan ukuran relnya sendiri. Banner 159x220 di kakinya
            adalah slot promo Coinest — di panel ini tempatnya kosong sampai
            pemilik memutuskan isinya, jadi di sini diisi kotak seukurannya
            supaya tata letak kakinya tetap bisa dibandingkan. */}
        <Banding kunci="sisi-desktop" zoom={1}>
          <div style={{ height: 1034 }}>
            <SisiNav
              logo={<span style={{ fontWeight: 700, fontSize: 18 }}>Coinest</span>}
              item={MENU_NAV}
              kaki={<div style={{ width: 159, height: 220, borderRadius: 16, background: "var(--brand)" }} />}
            />
          </div>
        </Banding>
        <Banding kunci="sisi-tablet" zoom={1}>
          <div style={{ height: 1034 }}>
            <SisiNav sempit logo={<span style={{ fontWeight: 700, fontSize: 18 }}>C</span>} item={MENU_NAV} />
          </div>
        </Banding>
        <Banding kunci="bilah-ponsel" zoom={1}>
          <BilahNav
            logo={<span style={{ fontWeight: 700, fontSize: 18 }}>C</span>}
            judul="Dashboard"
            menuIkon={List}
          />
        </Banding>
      </Grup>

      {/* Grafik. Persen tiap batang diturunkan dari letaknya di frame:
          (y - 26) / 152, karena bidang plotnya membentang y26..y178. */}
      <Grup judul="Grafik">
        <Banding
          kunci="kolom-labely"
          zoom={2}
          tanpaKotak
          catatan="acuannya cuma tinta lima labelnya — kotak teks punya side bearing yang tidak ada di tinta, jadi lebarnya tidak sah dibandingkan"
        >
          {/* Kelimanya "8K" — itu memang isi framenya, dan itu yang
              menjelaskan kenapa lebar tinta kelima barisnya sama persis
              9,99. */}
          <LabelYGrafik nilai={["8K", "8K", "8K", "8K", "8K"]} />
        </Banding>
        <Banding kunci="kolom-kosong" zoom={2}>
          <KolomGrafik label="Jan" />
        </Banding>
        <Banding kunci="kolom-naikturun" zoom={2}>
          <KolomGrafik
            label="Jan"
            tumpuk
            lebarBatang={27}
            batang={[
              { atas: 24.7, bawah: 50, nada: "tua", radiusAtas: 4 },
              { atas: 50, bawah: 75.3, nada: "mint", radiusBawah: 4 },
            ]}
          />
        </Banding>
        <Banding kunci="kolom-tunggal" zoom={2}>
          <KolomGrafik label="Jan" lebarBatang={31} batang={[{ atas: 16.2, bawah: 100.2, radius: 6 }]} />
        </Banding>
        <Banding kunci="kolom-ganda" zoom={2}>
          <KolomGrafik
            label="Jan"
            lebarBatang={15.5}
            batang={[
              { atas: 8.2, bawah: 100.3, nada: "mint", radiusAtas: 4 },
              { atas: 54.3, bawah: 100.3, nada: "tua", radiusAtas: 4 },
            ]}
          />
        </Banding>
        <Banding kunci="kolom-tiga" zoom={2}>
          <KolomGrafik
            label="Jan"
            lebarBatang={6.67}
            celah={4}
            batang={[
              { atas: 33.2, bawah: 100.3, nada: "hitam", radiusAtas: 3 },
              { atas: 9.54, bawah: 100.3, nada: "mint", radiusAtas: 3 },
              { atas: 68.8, bawah: 100.3, nada: "tua", radiusAtas: 3 },
            ]}
          />
        </Banding>
        <Banding
          kunci="kilau-naik"
          zoom={3}
          catatan="kurvanya dihitung dari data, bukan menyalin path Figma — yang dibandingkan ukuran kotak, tinggi garis, warna, dan gradiennya"
        >
          {/* Angka dan letaknya diambil dari titik jangkar path Figma
              (42,2 - y), supaya yang dibandingkan MATEMATIKA KURVANYA, bukan
              data yang kebetulan berbeda. Bentuknya tangga: turun, datar,
              turun, naik sedikit — bukan zigzag. */}
          <Kilau
            titik={[0, 6.5, 6.5, 19.5, 17.6, 36.2, 35.2, 42.2]}
            posisi={[0, 0.073, 0.218, 0.37, 0.538, 0.717, 0.902, 1]}
          />
        </Banding>
        <Banding kunci="kilau-turun" zoom={3} catatan="sama, varian menurun">
          <Kilau
            turun
            titik={[42.2, 35.2, 36.2, 17.6, 19.5, 6.5, 6.5, 0]}
            posisi={[0, 0.098, 0.283, 0.462, 0.63, 0.782, 0.927, 1]}
            className="k-kilau--turun"
          />
        </Banding>
      </Grup>

      <Grup judul="Kalender">
        <Banding kunci="tgl-biasa" zoom={6} tanpaKotak catatan="varian tanpa bulatan — yang terukur cuma tinta angkanya">
          <SelTanggal>30</SelTanggal>
        </Banding>
        <Banding kunci="tgl-mati" zoom={6} tanpaKotak catatan="sama, tinta abu">
          <SelTanggal keadaan="mati">30</SelTanggal>
        </Banding>
        <Banding kunci="tgl-pilih" zoom={6}>
          <SelTanggal keadaan="pilih">30</SelTanggal>
        </Banding>
        <Banding kunci="tgl-kini" zoom={6}>
          <SelTanggal keadaan="kini">30</SelTanggal>
        </Banding>
        <Banding kunci="hari" zoom={6} tanpaKotak catatan="nama hari, 10px abu">
          <SelHari>Wed</SelHari>
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
            {/* Isinya NILAI, bukan placeholder. Di framenya teks di dalam
                kotak ini bertinta #242E2C sama seperti labelnya — sementara
                kotak cari ukuran Medium memang abu #6B7271. Jadi yang
                digambar di sini kotak yang sudah terisi, dan dirender
                begitu supaya perbandingannya jujur. */}
            <Isian label="Label" defaultValue="Placeholder" kiri={SmileySticker}
              kanan={<Ikon ikon={Paperclip} ukuran={18} />} />
          </div>
        </Banding>
        <Banding kunci="centang-13" zoom={6}><Centang ukuran="default" defaultChecked /></Banding>
        <Banding kunci="centang-17" zoom={6}><Centang ukuran="medium" defaultChecked /></Banding>
        <Banding kunci="centang-23" zoom={6}><Centang ukuran="big" defaultChecked /></Banding>
        <Banding kunci="sakelar-on" zoom={6}><Sakelar judul="Contoh" defaultChecked /></Banding>
        <Banding kunci="sakelar-off" zoom={6}><Sakelar judul="Contoh" /></Banding>
      </Grup>

      {/* ---------------------------------------------------------------------
          Item — delapan belas jenis baris daftar.

          Foto avatar di acuan Figma tergambar sebagai gambar sungguhan; di
          kit ini tempatnya diisi bulatan polos, jadi selisih pikselnya di
          situ MEMANG ada dan bukan cacat bentuk. Yang dibandingkan: tinggi
          baris, radius, jarak, dan warna.
          ------------------------------------------------------------------ */}
      <Grup judul="Item — kerangka halaman">
        <Banding kunci="kepalaseksi-1" zoom={1} catatan="Model=Default: judul kiri, tujuh kendali kanan">
          <div style={{ width: 1280 }}>
            <KepalaSeksi
              judul="Header Title"
              kanan={
                <>
                  <Cari ukuran="medium" judul="Cari" placeholder="Search placeholder" />
                  <Segmen
                    segmen={[
                      { nilai: "a", label: "Button 1" },
                      { nilai: "b", label: "Button 2" },
                      { nilai: "c", label: "Button 3" },
                    ]}
                    nilai="a"
                    onPilih={() => {}}
                    judul="Contoh"
                  />
                  {/* Ukuran Medium, bukan small. Terukur di framenya: tiap
                      pemilih "Popular" berbingkai 81x32 dan kedua tombol
                      ikonnya 32x32 — small memberi 68x28 dan 28x28, jadi
                      seluruh separuh kanan bilah ini melar ke kanan 50px
                      dan tingginya tidak sama dengan tombol bersegmen di
                      sebelahnya. */}
                  {/* GHOST, bukan secondary. Di framenya ketiga pemilih dan
                      tombol saringnya kotak PUTIH bergaris #E5E6E6 — bukan
                      kotak mint. Sempat secondary semuanya, dan akibatnya
                      seluruh bilah terbaca jauh lebih hijau: porsi mint
                      15,6% di acuan lawan 52,3% di kit. */}
                  <Tombol ukuran="medium" jenis="ghost" kanan={CaretDown}>Popular</Tombol>
                  <Tombol ukuran="medium" jenis="ghost" kanan={CaretDown}>Popular</Tombol>
                  <span className="k-kepalaseksi__kiri" style={{ gap: 10.6 }}>
                    <span style={{ fontSize: "var(--k-t11)", color: "var(--text-muted)" }}>Sort by:</span>
                    <Tombol ukuran="medium" jenis="ghost" kanan={CaretDown}>Popular</Tombol>
                  </span>
                  <TombolIkon ukuran="medium" jenis="ghost" ikon={Sliders} judul="Saring" />
                  {/* Titik tiga tergambar 22px di framenya — lebih besar
                      daripada 16 yang dipakai ikon Medium lain. Terbaca dari
                      tintanya: 13,06 lebar, dan tinta master DotsThree
                      0,594 dari kotaknya. */}
                  {/* Titik tiga TIDAK punya kotak sama sekali di framenya — bukan
                      ghost yang bergaris, melainkan transparent. */}
                  <TombolIkon ukuran="medium" jenis="transparent" ikon={DotsThree} ikonPx={22} judul="Lainnya" />
                  <Tombol ukuran="medium">Popular</Tombol>
                </>
              }
            />
          </div>
        </Banding>

        <Banding kunci="kepalahal" zoom={1} catatan="Type=Default: judul, cari, dua tombol bulat, akun">
          <div style={{ width: 1191 }}>
            <KepalaHalaman
              judul="Dashboard"
              kanan={
                <>
                  <Cari ukuran="large" judul="Cari" placeholder="Search placeholder" />
                  <span className="k-kepalahal__grup">
                    <TombolBulat ikon={ChatTeardropDots} judul="Pesan" />
                    <TombolBulat ikon={Bell} ukuran={13.5} judul="Notifikasi" tanda />
                  </span>
                  <span className="k-kepalahal__akun">
                    Andrew Forbist
                    <span className="k-banding__avatar" style={{ width: 38, height: 38 }} />
                  </span>
                </>
              }
            />
          </div>
        </Banding>

        <Banding kunci="kepalahal-sub" zoom={1} catatan="Type=Subpage: tombol kembali 32px KOTAK di depan judul">
          <div style={{ width: 1192 }}>
            <KepalaHalaman
              judul="Dashboard"
              onKembali={() => {}}
              ikonKembali={ArrowLeft}
              kanan={
                <>
                  <Cari ukuran="large" judul="Cari" placeholder="Search placeholder" />
                  <span className="k-kepalahal__grup">
                    <TombolBulat ikon={ChatTeardropDots} judul="Pesan" />
                    <TombolBulat ikon={Bell} ukuran={13.5} judul="Notifikasi" tanda />
                  </span>
                  <span className="k-kepalahal__akun">
                    Andrew Forbist
                    <span className="k-banding__avatar" style={{ width: 38, height: 38 }} />
                  </span>
                </>
              }
            />
          </div>
        </Banding>

        <Banding kunci="kakihal" zoom={1}>
          <div style={{ width: 1189 }}>
            <KakiHalaman
              hakCipta="Copyright © 2024 Peterdraw"
              tautan={[
                { label: "Privacy Policy", href: "#" },
                { label: "Term and conditions", href: "#" },
                { label: "Contact", href: "#" },
              ]}
              sosial={[
                { ikon: FacebookLogo, judul: "Facebook", href: "#" },
                { ikon: TwitterLogo, judul: "Twitter", href: "#" },
                { ikon: InstagramLogo, judul: "Instagram", href: "#" },
                { ikon: YoutubeLogo, judul: "YouTube", href: "#" },
                { ikon: LinkedinLogo, judul: "LinkedIn", href: "#" },
              ]}
            />
          </div>
        </Banding>

        <Banding
          kunci="kakihal-ponsel"
          zoom={2}
          catatan="varian Mobile — di kit ini media query, jadi di lebar penuh ia tetap satu baris"
        >
          {/* Tanpa lebar tetap: di 252px ketiga tautannya membungkus jadi dua
              baris, dan yang terukur lalu bukan lagi bentuk framenya. */}
          <div style={{ width: "max-content" }}>
            <KakiHalaman
              hakCipta="Copyright © 2024 Peterdraw"
              tautan={[
                { label: "Privacy Policy", href: "#" },
                { label: "Term and conditions", href: "#" },
                { label: "Contact", href: "#" },
              ]}
              sosial={[
                { ikon: FacebookLogo, judul: "Facebook", href: "#" },
                { ikon: TwitterLogo, judul: "Twitter", href: "#" },
                { ikon: InstagramLogo, judul: "Instagram", href: "#" },
                { ikon: YoutubeLogo, judul: "YouTube", href: "#" },
                { ikon: LinkedinLogo, judul: "LinkedIn", href: "#" },
              ]}
            />
          </div>
        </Banding>
      </Grup>

      <Grup judul="Item — percakapan">
        <Banding kunci="chat-keluar" zoom={2} catatan="siku di kanan atas, centang ganda">
          <div style={{ width: 270 }}>
            <Gelembung sendiri dibaca nama="Name" waktu="9.46 PM">
              Can I request a late check-out for Room 305?
            </Gelembung>
          </div>
        </Banding>
        <Banding kunci="chat-masuk" zoom={2} catatan="siku di kiri atas, beravatar, berlampiran 164px">
          <div style={{ width: 318 }}>
            <Gelembung
              nama="Name"
              waktu="9.46 PM"
              avatar={<span className="k-banding__avatar" style={{ width: 36, height: 36 }} />}
              lampiran={<span className="k-banding__gambar" style={{ height: 148 }} />}
            >
              Can I request a late check-out for Room 305?
            </Gelembung>
          </div>
        </Banding>
        <Banding kunci="pesan-belum" zoom={2} catatan="jam menebal, lencana jumlah merah muda">
          <div style={{ width: 327 }}>
            <BarisPesan
              avatar={<span className="k-banding__avatar" style={{ width: 36, height: 36 }} />}
              nama="Helen Martinez"
              status={<span className="k-pesan__status">Trainer</span>}
              waktu="09:15 AM"
              belum={5}
            >
              Just confirming my booking for the Mazda 3…
            </BarisPesan>
          </div>
        </Banding>
        <Banding kunci="pesan-dibaca" zoom={2}>
          <div style={{ width: 326 }}>
            <BarisPesan
              avatar={<span className="k-banding__avatar" style={{ width: 36, height: 36 }} />}
              nama="Helen Martinez"
              status={<span className="k-pesan__status">Trainer</span>}
              waktu="09:15 AM"
            >
              Just confirming my booking for the Mazda 3 next…
            </BarisPesan>
          </div>
        </Banding>
        <Banding kunci="pesan-terbuka" zoom={2} catatan="berkartu r11,5 bergaris hijau muda">
          <div style={{ width: 344 }}>
            <BarisPesan
              terbuka
              avatar={<span className="k-banding__avatar" style={{ width: 36, height: 36 }} />}
              nama="Helen Martinez"
              status={<span className="k-pesan__status">Trainer</span>}
              waktu="09:15 AM"
            >
              Just confirming my booking for the Mazda 3 next…
            </BarisPesan>
          </div>
        </Banding>
      </Grup>

      <Grup judul="Item — linimasa">
        <Banding kunci="aktivitas" zoom={2} catatan="ubin hijau muda #C2E66E + rel 1px ke bawah">
          <div style={{ width: 287 }}>
            <BarisAktivitas ikon={NavPersonSimpleTaiChi} waktu="10:30 AM">
              <strong>Cardio progress updated</strong> – 7.5 km completed out of 10 km
              goal for endurance improvement
            </BarisAktivitas>
          </div>
        </Banding>
        <Banding kunci="aktivitas-akhir" zoom={2} catatan="titik akhir — relnya mati">
          <div style={{ width: 287 }}>
            <BarisAktivitas akhir ikon={NavPersonSimpleTaiChi} waktu="10:30 AM">
              <strong>Cardio progress updated</strong> – 7.5 km completed out of 10 km
              goal for endurance improvement
            </BarisAktivitas>
          </div>
        </Banding>
        <Banding kunci="log" zoom={3} catatan="foto 30px, waktu DI BAWAH keterangan">
          <div style={{ width: 204 }}>
            <BarisLog
              avatar={<span className="k-banding__avatar" style={{ width: 30, height: 30 }} />}
              waktu="16:05"
            >
              <strong>Jamie Smith</strong> updated account settings
            </BarisLog>
          </div>
        </Banding>
        <Banding kunci="log-v2" zoom={3} catatan="ubin mint, waktu DI ATAS">
          <div style={{ width: 204 }}>
            <BarisLog akhir waktuDulu ikon={NavCalendarDots} waktu="16:05">
              <strong>Jamie Smith</strong> updated account settings
            </BarisLog>
          </div>
        </Banding>
      </Grup>

      <Grup judul="Item — keping">
        <Banding kunci="keping-tagar" zoom={4}>
          <KepingTagar>FinancialPlanning</KepingTagar>
        </Banding>
        <Banding kunci="kategori-aktif" zoom={5}>
          <KepingKategori aktif>All</KepingKategori>
        </Banding>
        <Banding kunci="kategori-mati" zoom={5}>
          <KepingKategori>All</KepingKategori>
        </Banding>
      </Grup>

      <Grup judul="Item — baris daftar">
        <Banding kunci="aset" zoom={3} catatan="batang warna 16x39 r5">
          <div style={{ width: 250 }}>
            <BarisAset warna="var(--ramp-1)" nama="Mutual Funds" persen="55%" total="$275,000" />
          </div>
        </Banding>
        <Banding kunci="pantau" zoom={2} catatan="ubin bulat 48, lencana tren di kanan bawah">
          <div style={{ width: 352 }}>
            <BarisPantau
              ikon={SpecialAppleLogo}
              ikonUkuran={23}
              simbol="GOOGL"
              nama="Microsoft Corporation"
              nilai="$3,204.50"
              tren={<LencanaTren>+2.30%</LencanaTren>}
            />
          </div>
        </Banding>
        <Banding kunci="transfer" zoom={2} catatan="kartu 67 r15,5, avatar mint 40">
          <div style={{ width: 300 }}>
            <BarisTransfer
              gambar={<span className="k-banding__avatar" style={{ width: 40, height: 40 }} />}
              nama="Audrey Murphy"
              rekening="120987654328"
            />
          </div>
        </Banding>
        <Banding kunci="transfer-akun" zoom={2} catatan="varian dengan blok kedua rata kanan">
          <div style={{ width: 280 }}>
            <BarisTransfer
              gambar={<span className="k-banding__avatar" style={{ width: 40, height: 40 }} />}
              nama="Abe Reeves"
              rekening="120987654322"
              kananAtas="$1,000"
              kananBawah="Successful"
            />
          </div>
        </Banding>
        <Banding kunci="penyedia-kartu" zoom={2} catatan="kartu 57 dengan caret">
          <div style={{ width: 303 }}>
            <BarisPenyedia ikon={SpecialShoppingCart} nama="Healthcare" />
          </div>
        </Banding>
        <Banding kunci="penyedia-rinci" zoom={2} catatan="rel tegak 1px di x29, ubin mint pucat">
          <div style={{ width: 303 }}>
            <BarisPenyedia bentuk="rinci" ikon={SpecialShoppingCart} nama="Healthcare" />
          </div>
        </Banding>
        <Banding kunci="penyedia-aktif" zoom={2} catatan="aktif: rel jadi 4px mint, latar mint pucat">
          <div style={{ width: 303 }}>
            <BarisPenyedia bentuk="rinci" aktif ikon={SpecialShoppingCart} nama="Healthcare" />
          </div>
        </Banding>
        <Banding kunci="beban" zoom={3} catatan="pil persen 32x25">
          <div style={{ width: 250 }}>
            <BarisBeban persen="60%" kategori="Rent &amp; Living" nominal="$2,100" />
          </div>
        </Banding>
        <Banding kunci="beban-ponsel" zoom={3} catatan="varian Mobile: pil 40x30 — di kit media query">
          <div style={{ width: 250 }}>
            <BarisBeban persen="60%" kategori="Rent &amp; Living" nominal="$2,100" />
          </div>
        </Banding>
        <Banding kunci="inbox" zoom={2} catatan="centang 13px, bintang di kanan bawah">
          <div style={{ width: 350 }}>
            <BarisInbox pengirim="New Feature: Advanced Budgeting Tools" waktu="07:00 AM">
              Explore our new advanced budgeting tools to better manage your finances.
            </BarisInbox>
          </div>
        </Banding>
        <Banding kunci="tagar" zoom={3} catatan="judul di atas, kategori dan keterangan di bawah">
          <div style={{ width: 289 }}>
            <BarisTagar judul="#RetirementPlanning" kategori="Real Estate Investment" keterangan="120 articles" />
          </div>
        </Banding>
        <Banding kunci="tagar-ponsel" zoom={2} catatan="varian Mobile: keterangan pindah ke kanan — media query">
          <div style={{ width: 342 }}>
            <BarisTagar judul="#RetirementPlanning" kategori="Real Estate Investment" keterangan="120 articles" />
          </div>
        </Banding>
        <Banding kunci="penulis" zoom={3} catatan="avatar mint 36, nama di atas peran">
          <div style={{ width: 289 }}>
            <BarisPenulis
              avatar={<span className="k-banding__avatar" style={{ width: 36, height: 36 }} />}
              nama="Mark Thompson"
              peran="3.5K Followers"
            />
          </div>
        </Banding>
        <Banding kunci="penulis-ponsel" zoom={2} catatan="varian Mobile: peran sebaris dengan nama — media query">
          <div style={{ width: 342 }}>
            <BarisPenulis
              avatar={<span className="k-banding__avatar" style={{ width: 40, height: 40 }} />}
              nama="Mark Thompson"
              peran="3.5K Followers"
            />
          </div>
        </Banding>
      </Grup>

      {/* ---------------------------------------------------------------------
          Lima bentuk dari frame INTERFACE — tidak ada di satu pun frame
          Style & Component, jadi P2 memang tidak pernah membangunnya.
          ------------------------------------------------------------------ */}
      <Grup judul="Ukuran — bentuk dari frame halaman">
        <Banding kunci="bar-terpisah" zoom={3} catatan="dua kotak bersebelahan, celah 4 — bukan rel dengan isian">
          <div style={{ width: 324 }}>
            <BarKemajuan persen={58.1} judul="Contoh" />
          </div>
        </Banding>
        <Banding kunci="bar-kartu" zoom={3} catatan="tinggi 25, celah 6">
          <div style={{ width: 251 }}>
            <BarKemajuan persen={72.9} tinggi={25} celah={6} judul="Contoh" />
          </div>
        </Banding>
        <Banding kunci="bar-tumpuk" zoom={2} catatan="rel r8, isian tanpa radius sendiri">
          <div style={{ width: 252 }}>
            <BarKemajuan persen={57.6} bentuk="tumpuk" tinggi={51} judul="Contoh" />
          </div>
        </Banding>
        {/* Angka kedua deret ini DIBACA dari simpul Bezier kurva Figma-nya,
            bukan dikarang: tiap segmen C berakhir di satu titik data, jadi
            tinggal dipetakan balik lewat kisinya (y421,5 = 2000, y562,5 = 0).
            Sembilan titik, bukan tujuh — ada titik tambahan di tepi kiri dan
            kanan plot supaya garisnya sampai ke ujung. */}
        <Banding kunci="area-halus" zoom={1} catatan="dua deret, titik dari simpul kurva Figma">
          <div style={{ width: 554.7 }}>
            <GrafikArea
              tinggi={141}
              ruangAtas={29.5}
              jarakLabelX={16}
              labelY={["2000", "1500", "1000", "500", "0"]}
              labelX={["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]}
              maks={2000}
              posisi={[0, 0.0681, 0.2111, 0.3538, 0.4965, 0.6392, 0.7793, 0.9247, 1]}
              sorot={{ indeks: 3, deret: 0, judul: "Income", nilai: "$6,000", ket: "Tuesday, 6 June 2029" }}
              deret={[
                { titik: [909.5, 1031.9, 807.2, 1325.6, 661.5, 1751.8, 1233.3, 1545.8, 1396.7], nada: "kedua" },
                { titik: [633.7, 755.1, 149.2, 755.1, 340.4, 955.0, 522.8, 825.9, 762.4] },
              ]}
            />
          </div>
        </Banding>
        <Banding kunci="area-tangga" zoom={1} catatan="sepuluh anak tangga, nilainya dari simpul kurva Figma">
          <div style={{ width: 553.7 }}>
            <GrafikArea
              bentuk="tangga"
              tinggi={174}
              ruangAtas={25.5}
              jarakLabelX={18.5}
              labelY={["40K", "30K", "20K", "10K", "0"]}
              labelX={["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct"]}
              maks={40}
              sorot={{ indeks: 5, judul: "June 2028", nilai: "$31,675.05" }}
              deret={[{ titik: [10, 15.9, 12.8, 21.3, 7.4, 31.4, 23.3, 17.6, 26.6, 34.1] }]}
            />
          </div>
        </Banding>
        <Banding kunci="busur" zoom={2} catatan="setengah lingkaran, jari-jari 112/85, celah 2 derajat">
          <div style={{ width: 223.695 }}>
            <Busur
              iris={[
                { nilai: 55, warna: "var(--ramp-1)" },
                { nilai: 20, warna: "var(--ramp-2)" },
                { nilai: 15, warna: "var(--ramp-3)" },
                { nilai: 10, warna: "var(--ramp-4)" },
              ]}
              label="Total Assets"
              nilai="$500,000"
              tanda="+5%"
              ket="compared to last year"
            />
          </div>
        </Banding>
        <Banding kunci="statlebar" zoom={2} catatan="ikon 56 di KANAN, latar mint pucat — bukan KartuStatistik">
          <div style={{ width: 386.667 }}>
            <KartuStatistikLebar
              judul="Total Savings"
              nilai="$47,600"
              tren={<LencanaTren>4.20 %</LencanaTren>}
              ikon={NavReceipt}
            />
          </div>
        </Banding>
      </Grup>
    </section>
  );
}
