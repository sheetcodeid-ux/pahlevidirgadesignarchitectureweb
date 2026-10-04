import { useState } from "react";
import { Tombol } from "../Tombol";
import { SisiNav } from "../Nav";
import { Menubar, MenuNavigasi } from "../Overlay";
import { Remah } from "../Remah";
import { Paginasi } from "../Paginasi";
import { Segmen, KelompokTab } from "../Segmen";
import { Tabel, SelDua, SelIkon } from "../Tabel";
import { GrafikArea, Donat, BarKemajuan } from "../Ukuran";
import { Kartu, KartuStatistik, KartuKas, Tren } from "../Kartu";
import { Lencana, Angka, Titik } from "../Lencana";
import { Gelembung, BarisPesan, BarisTransfer } from "../Item";
import {
  Peringatan,
  Kosong,
  Rangka,
  RangkaBaris,
  Putar,
  Rasio,
  Avatar,
  TumpukAvatar,
  Penanda,
  SorotTeks,
  Pemisah,
  Teks,
  Butir,
  Lipat,
  AreaGulir,
  GulirPesan,
  Korsel,
  Kuesioner,
} from "../Tampilan";
import { Bagi } from "../Bagi";
import { Arah } from "../Arah";
import { Cari } from "../Isian";
import { DaftarKit, PilihTombol } from "../../admin/daftarKit";
import {
  ChartBar,
  ChatTeardropDots,
  CoinIn,
  CoinOut,
  CoinVertical,
  DotsThree,
  FileText,
  ImageSquare,
  MagnifyingGlass,
  NavCoins,
  NavCreditCard,
  NavEnvelope,
  NavSquaresFour,
  Users,
  VirtualAccount,
  Wallet,
} from "../ikon";
import { PROYEK } from "./demoSatu";

/* --- Navigasi --------------------------------------------------------------- */

export function DemoSisiNav() {
  const [buka, setBuka] = useState(true);
  return (
    <div className="gal-rel">
      <SisiNav
        logo={<b className="gal-logo">Dirga Pahlevi</b>}
        item={[
          { ikon: NavSquaresFour, label: "Dashboard", aktif: true, href: "#navigasi/sidebar" },
          {
            ikon: NavCoins,
            label: "Keuangan",
            lipat: true,
            terbuka: buka,
            onLipat: () => setBuka(!buka),
            anak: [
              { ikon: ChartBar, label: "Ringkasan", href: "#navigasi/sidebar" },
              { ikon: CoinIn, label: "Terima Pembayaran", href: "#navigasi/sidebar" },
            ],
          },
          { ikon: NavEnvelope, label: "Pesan Masuk", jumlah: 3, jumlahJudul: "3 belum dibaca", href: "#navigasi/sidebar" },
          { ikon: Users, label: "Tim & Freelancer", href: "#navigasi/sidebar" },
        ]}
      />
    </div>
  );
}

export function DemoMenuNavigasi() {
  return (
    <div className="gal-navmenu">
      <MenuNavigasi
        label="Contoh navigasi situs"
        butir={[
          { label: "Beranda", href: "#navigasi/navigation-menubar" },
          {
            label: "Karya",
            anak: [
              { label: "Hunian", href: "#navigasi/navigation-menubar", ket: "Rumah tropis dan renovasi" },
              { label: "Komersial", href: "#navigasi/navigation-menubar", ket: "Kedai kopi, kantor, penginapan" },
              { label: "Interior", href: "#navigasi/navigation-menubar", ket: "Bar, dapur, ruang kerja" },
              { label: "Semua proyek", href: "#navigasi/navigation-menubar", ket: "Daftar lengkap" },
            ],
          },
          {
            label: "Studio",
            anak: [
              { label: "Tentang", href: "#navigasi/navigation-menubar", ket: "Cara kami bekerja" },
              { label: "Jurnal", href: "#navigasi/navigation-menubar", ket: "Catatan dari lapangan" },
            ],
          },
          { label: "Kontak", href: "#navigasi/navigation-menubar" },
        ]}
      />
    </div>
  );
}

export function DemoBilahMenu() {
  const [pilih, setPilih] = useState("");
  const p = (s: string) => () => setPilih(s);
  return (
    <div className="gal-tumpuk">
      <Menubar
        label="Aksi proyek"
        menus={[
          {
            label: "Proyek",
            sections: [{ items: [{ label: "Ubah data", onSelect: p("Ubah data") }, { label: "Halaman publik", onSelect: p("Halaman publik") }, { label: "Portal klien", onSelect: p("Portal klien") }] }],
          },
          {
            label: "Keuangan",
            sections: [{ items: [{ label: "Terima pembayaran", ikon: CoinIn, onSelect: p("Terima") }, { label: "Catat pengeluaran", ikon: CoinOut, onSelect: p("Keluar") }] }],
          },
          {
            label: "Dokumen",
            sections: [{ items: [{ label: "Daftar tagihan (PDF)", ikon: FileText, onSelect: p("Daftar tagihan") }, { label: "Rincian biaya (PDF)", ikon: FileText, onSelect: p("Rincian biaya") }] }],
          },
        ]}
      />
      {pilih && <p className="gal-ket">Dipilih: {pilih}</p>}
    </div>
  );
}

export function DemoRemah() {
  return (
    <Remah
      jalur={[
        { label: "Dashboard", href: "#navigasi/breadcrumb" },
        { label: "Proyek", href: "#navigasi/breadcrumb" },
        { label: "Kedai Kopi Ruas" },
      ]}
    />
  );
}

export function DemoPaginasi() {
  const [h, setH] = useState(3);
  return (
    <div className="gal-tumpuk">
      <Paginasi kini={h} total={12} onPindah={setH} />
      <Paginasi kini={h} total={12} onPindah={setH} ponsel />
    </div>
  );
}

export function DemoTab() {
  const [s, setS] = useState("bulan");
  const [t, setT] = useState("transfer");
  return (
    <div className="gal-tumpuk">
      <div style={{ width: 313, maxWidth: "100%" }}>
        <Segmen
          judul="Rentang"
          nilai={s}
          onPilih={setS}
          segmen={[
            { nilai: "bulan", label: "Bulan" },
            { nilai: "kuartal", label: "Kuartal" },
            { nilai: "tahun", label: "Tahun" },
          ]}
        />
      </div>
      <div style={{ width: 303, maxWidth: "100%" }}>
        <KelompokTab
          judul="Cara bayar"
          nilai={t}
          onPilih={setT}
          tab={[
            { nilai: "tunai", label: "Tunai", ikon: CoinVertical },
            { nilai: "transfer", label: "Transfer", ikon: NavCreditCard },
            { nilai: "qris", label: "QRIS", ikon: VirtualAccount },
            { nilai: "lainnya", label: "Lainnya", ikon: DotsThree },
          ]}
        />
      </div>
    </div>
  );
}

/* --- Data ------------------------------------------------------------------- */

const TERMIN = [
  ["Termin 1 — DP", "Kedai Kopi Ruas", "Rp61.666.667", "10 Sep 2026", "selesai", "Lunas"],
  ["Termin 2 — gambar kerja", "Kedai Kopi Ruas", "Rp61.666.667", "10 Okt 2026", "menunggu", "Terbit"],
  ["Termin 1 — DP", "Rumah Tropis Sungai Raya", "Rp85.000.000", "10 Okt 2026", "selesai", "Lunas"],
  ["Termin 2 — gambar kerja", "Rumah Tropis Sungai Raya", "Rp85.000.000", "10 Nov 2026", "netral", "Draf"],
] as const;

export function DemoTabel() {
  return (
    <div className="gal-gulirdatar">
      <Tabel
        kolom={[
          { judul: "Termin", lebar: 260 },
          { judul: "Nominal", lebar: 140, kanan: true },
          { judul: "Tenggat", lebar: 120 },
          { judul: "Status", lebar: 100 },
        ]}
        baris={TERMIN.map(([t, p, n, d, nada, s]) => [
          <SelIkon key="t" ikon={FileText} ukuran={32}>
            <SelDua atas={t} bawah={p} />
          </SelIkon>,
          <b key="n">{n}</b>,
          d,
          <Lencana key="s" bentuk="pil" nada={nada}>
            {s}
          </Lencana>,
        ])}
      />
    </div>
  );
}

export function DemoDaftarKit() {
  const [cari, setCari] = useState("");
  const [status, setStatus] = useState("semua");
  const lolos = TERMIN.filter(([t, p, , , , s]) => (status === "semua" || s === status) && `${t} ${p}`.toLowerCase().includes(cari.toLowerCase()));
  return (
    <DaftarKit
      kiri={
        <>
          <Cari judul="Cari termin" placeholder="Cari termin" value={cari} onChange={(e) => setCari(e.target.value)} />
          <PilihTombol
            judul="Status"
            nilai={status}
            onPilih={setStatus}
            opsi={[
              { nilai: "semua", label: "Semua status" },
              { nilai: "Lunas", label: "Lunas" },
              { nilai: "Terbit", label: "Terbit" },
              { nilai: "Draf", label: "Draf" },
            ]}
          />
        </>
      }
      kolom={[
        { judul: "Termin", lebar: 260, urut: true },
        { judul: "Nominal", lebar: 140, urut: true },
        { judul: "Status", lebar: 100 },
      ]}
      baris={lolos.map(([t, p, n, , nada, s]) => [
        <SelDua key="t" atas={t} bawah={p} />,
        n,
        <Lencana key="s" bentuk="pil" nada={nada}>
          {s}
        </Lencana>,
      ])}
      kunci={lolos.map((r, i) => `${r[0]}-${r[1]}-${i}`)}
      memuat={false}
      kosong="Tidak ada termin yang cocok."
      satuan="termin"
      kunciSaring={`${cari}|${status}`}
      tinggiBaris={56}
    />
  );
}

export function DemoGrafik() {
  return (
    <div className="gal-kisi2 gal-kisi2--lebar">
      <Kartu>
        <b className="gal-teks">Arus kas 6 bulan</b>
        <GrafikArea
          deret={[
            { titik: [18, 22, 26, 21, 30, 34], nada: "utama" },
            { titik: [12, 15, 13, 17, 16, 19], nada: "kedua" },
          ]}
          labelX={["Mei", "Jun", "Jul", "Agu", "Sep", "Okt"]}
          labelY={["40 jt", "20 jt", "0"]}
          maks={40}
          ruangAtas={8}
          keterangan={(i) => ({
            judul: `${["Mei", "Jun", "Jul", "Agu", "Sep", "Okt"][i]} 2026`,
            nilai: `Masuk Rp${[18, 22, 26, 21, 30, 34][i]} jt`,
            ket: `Keluar Rp${[12, 15, 13, 17, 16, 19][i]} jt`,
          })}
        />
      </Kartu>
      <Kartu>
        <b className="gal-teks">Beban per jenis</b>
        <Donat
          label="Total beban"
          nilai="Rp12,7 jt"
          iris={[
            { nilai: 67, warna: "var(--ramp-1)", label: "Freelancer", ket: "Rp8,5 jt" },
            { nilai: 20, warna: "var(--ramp-2)", label: "Operasional", ket: "Rp2,5 jt" },
            { nilai: 13, warna: "var(--ramp-4)", label: "Cetak", ket: "Rp1,7 jt" },
          ]}
        />
      </Kartu>
    </div>
  );
}

export function DemoKartu() {
  return (
    <div className="gal-kisi3">
      <KartuStatistik ikon={CoinIn} judul="Kas masuk bulan ini" nilai="Rp18,7 jt" tren={<Tren naik>4,2 %</Tren>} />
      <KartuKas nama="Kas studio" nilai="Rp532 jt" kaki={[{ judul: "Proyek", isi: "4" }, { judul: "Piutang", isi: "Rp575 jt" }]} />
      <Kartu>
        <b className="gal-teks">Kartu polos</b>
        <p className="gal-ket">Wadah r16 bergaris 1px — tanpa bayangan. Isinya bebas.</p>
      </Kartu>
    </div>
  );
}

export function DemoButir() {
  const [aktif, setAktif] = useState("kopi");
  return (
    <div className="gal-kartu gal-kartu--daftar">
      {PROYEK.slice(0, 3).map((p) => (
        <Butir
          key={p.nilai}
          media={<Avatar nama={p.label} />}
          judul={p.label}
          ket={p.ket}
          kanan={<Lencana bentuk="pejalkecil" nada={p.nilai === "kopi" ? "menunggu" : "selesai"}>{p.nilai === "kopi" ? "Berjalan" : "Lunas"}</Lencana>}
          aktif={aktif === p.nilai}
          onClick={() => setAktif(p.nilai)}
        />
      ))}
      <BarisTransfer ikon={Wallet} nama="Pembayaran termin" rekening="Transfer · Kedai Kopi Ruas" kananAtas="Rp60.000.000" kananBawah="1 Okt" />
    </div>
  );
}

export function DemoAvatar() {
  return (
    <div className="gal-tumpuk">
      <div className="gal-baris">
        <Avatar nama="Dirga Pahlevi" ukuran="lg" status="aktif" />
        <Avatar nama="Sari Ningsih" />
        <Avatar nama="Nanda Wijaya" ukuran="sm" />
        <Avatar nama="Tuti Hartati" status="diam" />
        <Avatar nama="Gambar rusak" src="/tidak-ada.jpg" />
      </div>
      <TumpukAvatar nama={["Dirga Pahlevi", "Sari Ningsih", "Nanda Wijaya", "Tuti Hartati", "Aan", "Rina"]} />
      <p className="gal-ket">Warna diturunkan dari nama — orang yang sama selalu berwarna sama.</p>
    </div>
  );
}

export function DemoLencana() {
  return (
    <div className="gal-tumpuk">
      {(["garis", "pejalkecil", "pejal", "pil"] as const).map((b) => (
        <div key={b} className="gal-baris">
          <Lencana bentuk={b} nada="selesai">Lunas</Lencana>
          <Lencana bentuk={b} nada="menunggu">Terbit</Lencana>
          <Lencana bentuk={b} nada="gagal">Lewat tenggat</Lencana>
          <Lencana bentuk={b} nada="netral">Draf</Lencana>
          <span className="gal-ket">{b}</span>
        </div>
      ))}
      <div className="gal-baris">
        <Angka jumlah={3} judul="Pesan belum dibaca" />
        <Angka jumlah={128} judul="Notifikasi" />
        <Titik judul="Ada yang baru" />
      </div>
    </div>
  );
}

export function DemoKemajuan() {
  const [p, setP] = useState(65);
  return (
    <div className="gal-tumpuk">
      <BarKemajuan persen={p} judul={`Pembayaran ${p}%`} />
      <BarKemajuan persen={p} judul={`Pembayaran ${p}%`} bentuk="tumpuk" tinggi={25} />
      <div className="gal-baris">
        <Tombol ukuran="small" jenis="ghost" onClick={() => setP(Math.max(0, p - 15))}>
          −15%
        </Tombol>
        <Tombol ukuran="small" jenis="ghost" onClick={() => setP(Math.min(100, p + 15))}>
          +15%
        </Tombol>
        <span className="gal-ket">Rp120 jt diterima dari Rp185 jt — {p}%</span>
      </div>
    </div>
  );
}

/* --- Umpan balik -------------------------------------------------------------- */

export function DemoPeringatan() {
  return (
    <div className="gal-tumpuk">
      <Peringatan nada="info" judul="Belum tayang di situs">
        Perubahan tersimpan, tapi baru tampil setelah tombol Terbitkan ditekan.
      </Peringatan>
      <Peringatan nada="sukses" judul="Pembayaran dicatat">
        Termin 2 Kedai Kopi Ruas — Rp61.666.667.
      </Peringatan>
      <Peringatan nada="awas" judul="Nominal melebihi sisa kontrak" aksi={<Tombol ukuran="small" jenis="ghost">Ubah kontrak</Tombol>}>
        Sisa kontrak Rp0. Periksa lagi, atau perbarui nilai kontraknya dulu kalau ada adendum.
      </Peringatan>
      <Peringatan nada="bahaya" judul="Gagal mengunggah">
        Berkas lebih dari 10 MB. Kecilkan dulu, lalu coba lagi.
      </Peringatan>
    </div>
  );
}

export function DemoKosong() {
  return (
    <div className="gal-kisi2">
      <div className="gal-kartu">
        <Kosong ikon={ChatTeardropDots} judul="Belum ada pesan" aksi={<Tombol jenis="secondary">Buka halaman Kontak</Tombol>}>
          Pesan dari form kontak situs muncul di sini.
        </Kosong>
      </div>
      <div className="gal-kartu">
        <Kosong ikon={MagnifyingGlass} judul="Tidak ada yang cocok" ringkas aksi={<Tombol ukuran="small" jenis="ghost">Hapus saringan</Tombol>}>
          Coba kata lain, atau hapus saringan status.
        </Kosong>
      </div>
    </div>
  );
}

export function DemoRangka() {
  return (
    <div className="gal-kisi2">
      <div className="gal-kartu">
        <RangkaBaris jumlah={3} />
      </div>
      <div className="gal-kartu gal-tumpuk">
        <Rangka lebar="40%" tinggi={14} />
        <Rangka tinggi={32} />
        <Rangka lebar="70%" />
      </div>
    </div>
  );
}

export function DemoPutar() {
  return (
    <div className="gal-baris">
      <Putar />
      <Putar ukuran={24} />
      <span className="gal-baris gal-baris--rapat gal-ket">
        <Putar ukuran={14} /> Mengunggah 3 foto…
      </span>
      <Tombol memuat>Menyimpan…</Tombol>
    </div>
  );
}

/* --- Tata letak --------------------------------------------------------------- */

export function DemoRasio() {
  return (
    <div className="gal-kisi3">
      {[
        [16 / 9, "16:9 — foto proyek"],
        [1200 / 630, "1200:630 — sampul jurnal / kartu bagikan"],
        [1, "1:1 — logo klien"],
      ].map(([r, t]) => (
        <figure key={t as string} className="gal-fig">
          <Rasio rasio={r as number}>
            <div className="gal-isirasio">
              <svg width="28" height="28" viewBox={ImageSquare.vb} fill="none" aria-hidden="true" dangerouslySetInnerHTML={{ __html: ImageSquare.isi }} />
            </div>
          </Rasio>
          <figcaption className="gal-ket">{t as string}</figcaption>
        </figure>
      ))}
    </div>
  );
}

export function DemoPemisah() {
  return (
    <div className="gal-tumpuk">
      <p className="gal-teks">Ringkasan kontrak</p>
      <Pemisah />
      <div className="gal-baris" style={{ height: 24 }}>
        <span className="gal-ket">Proyek 4</span>
        <Pemisah arah="tegak" />
        <span className="gal-ket">Piutang Rp575 jt</span>
        <Pemisah arah="tegak" />
        <span className="gal-ket">Kas Rp532 jt</span>
      </div>
      <Pemisah label="atau" />
    </div>
  );
}

export function DemoAreaGulir() {
  return (
    <div className="gal-kartu" style={{ maxWidth: 360 }}>
      <AreaGulir tinggi={180}>
        <ul className="gal-daftar">
          {Array.from({ length: 14 }, (_, i) => (
            <li key={i}>
              <b>Termin {(i % 4) + 1}</b> · {PROYEK[i % PROYEK.length]!.label}
            </li>
          ))}
        </ul>
      </AreaGulir>
    </div>
  );
}

export function DemoBagi() {
  const [pilih, setPilih] = useState(PROYEK[0]!.nilai);
  const p = PROYEK.find((x) => x.nilai === pilih)!;
  return (
    <Bagi
      kiri={
        <div className="gal-tumpuk" style={{ padding: 8 }}>
          {PROYEK.map((x) => (
            <Butir key={x.nilai} judul={x.label} ket={x.ket} aktif={pilih === x.nilai} onClick={() => setPilih(x.nilai)} />
          ))}
        </div>
      }
      kanan={
        <div className="gal-tumpuk" style={{ padding: 20 }}>
          <Teks tingkat="judul3">{p.label}</Teks>
          <Teks tingkat="kecil">{p.ket}</Teks>
          <Teks>Seret garis di tengah, atau fokuskan dengan Tab lalu tekan panah kiri/kanan.</Teks>
        </div>
      }
    />
  );
}

export function DemoLipat() {
  return (
    <div>
      <Lipat judul="Apa yang terjadi kalau termin dihapus?" ket="Tagihan" buka>
        Termin hilang dari daftar tagihan klien. Riwayat pembayarannya di Semua Transaksi tidak ikut terhapus.
      </Lipat>
      <Lipat judul="Kenapa laba bersih proyek naik bertahap?" ket="Keuangan">
        Laba dihitung dari kas yang benar-benar masuk, bukan nilai kontrak — jadi ia naik mengikuti termin.
      </Lipat>
    </div>
  );
}

export function DemoKorsel() {
  return (
    <Korsel label="Foto proyek" lebarButir={240}>
      {PROYEK.map((p, i) => (
        <figure key={p.nilai} className="gal-fig">
          <Rasio rasio={4 / 3}>
            <div className={`gal-isirasio gal-isirasio--${i % 3}`}>
              <b>{p.label}</b>
            </div>
          </Rasio>
          <figcaption className="gal-ket">{p.ket}</figcaption>
        </figure>
      ))}
    </Korsel>
  );
}

export function DemoArah() {
  const [arah, setArah] = useState<"ltr" | "rtl">("rtl");
  return (
    <div className="gal-tumpuk">
      <Segmen
        judul="Arah"
        nilai={arah}
        onPilih={(v) => setArah(v as "ltr" | "rtl")}
        segmen={[
          { nilai: "ltr", label: "Kiri ke kanan" },
          { nilai: "rtl", label: "Kanan ke kiri" },
        ]}
      />
      <Arah arah={arah}>
        <div className="gal-kartu gal-tumpuk">
          <Butir media={<Avatar nama="Ahmad" />} judul="Kantor Notaris Ahmad" ket="Hunian · Kubu Raya" kanan="Rp210 jt" />
          <BarKemajuan persen={40} judul="Kemajuan 40%" />
        </div>
      </Arah>
    </div>
  );
}

export function DemoTeks() {
  return (
    <div className="gal-tumpuk">
      <Teks tingkat="label">Label · 11 / 600</Teks>
      <Teks tingkat="judul1">Judul halaman — 24 / 700</Teks>
      <Teks tingkat="judul2">Judul kartu — 18 / 700</Teks>
      <Teks tingkat="judul3">Subjudul — 16 / 600</Teks>
      <Teks>
        Teks badan 14 / 1,6. Dirga Pahlevi Architecture mendesain ruang hospitality dan rumah tropis dengan pendekatan iklim khatulistiwa — panjang baris dibatasi supaya tetap enak dibaca.
      </Teks>
      <Teks tingkat="kecil">Teks kecil 12, abu — keterangan dan waktu.</Teks>
      <Teks tingkat="angka">Rp831.500.000</Teks>
    </div>
  );
}

export function DemoPenanda() {
  const [q, setQ] = useState("kopi");
  return (
    <div className="gal-tumpuk">
      <Cari judul="Sorot kata" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ketik kata…" />
      <ul className="gal-daftar">
        {["Kedai Kopi Ruas — bar kopi 6 m", "Renovasi Bakmi Hauw — dapur terbuka", "Guest House Kapuas — kopi pagi di teras"].map((t) => (
          <li key={t}>
            <SorotTeks teks={t} cari={q} />
          </li>
        ))}
      </ul>
      <p className="gal-teks">
        Angka yang berubah: kas bulan ini <Penanda nada="amber">Rp18,7 jt</Penanda>.
      </p>
    </div>
  );
}

/* --- Percakapan ---------------------------------------------------------------- */

export function DemoPesan() {
  return (
    <div className="gal-kartu gal-kartu--daftar" style={{ maxWidth: 420 }}>
      <BarisPesan avatar={<Avatar nama="Hendra Wijaya" />} nama="Hendra Wijaya" status="Komersial" waktu="09.17" belum={2}>
        Halo, saya mau tanya biaya desain kedai kopi 120 m²…
      </BarisPesan>
      <BarisPesan avatar={<Avatar nama="Rina Oktaviani" />} nama="Rina Oktaviani" status="Hunian" waktu="Kemarin">
        Terima kasih, gambar konsepnya sudah saya terima.
      </BarisPesan>
    </div>
  );
}

export function DemoGelembung() {
  return (
    <div className="gal-tumpuk" style={{ maxWidth: 480 }}>
      <Gelembung nama="Bu Ratna" waktu="09.12" avatar={<Avatar nama="Bu Ratna" ukuran="sm" />}>
        Pak, denah lantai dua bisa ditambah satu kamar mandi?
      </Gelembung>
      <Gelembung nama="Studio" waktu="09.30" sendiri dibaca>
        Bisa, Bu. Kami sesuaikan di revisi berikutnya — kabar Jumat ini.
      </Gelembung>
    </div>
  );
}

export function DemoGulirPesan() {
  const [pesan, setPesan] = useState<[string, string, boolean][]>([
    ["Bu Ratna", "Pak, denah lantai dua bisa ditambah satu kamar mandi?", false],
    ["Studio", "Bisa, Bu. Kami sesuaikan di revisi berikutnya.", true],
    ["Bu Ratna", "Baik. Kalau begitu jadwal kunjungan lokasi tetap Sabtu?", false],
    ["Studio", "Tetap Sabtu jam 9, Bu.", true],
  ]);
  return (
    <div className="gal-tumpuk">
      <div className="gal-kartu" style={{ maxWidth: 480 }}>
        <GulirPesan tinggi={240} jumlah={pesan.length}>
          {pesan.map(([n, t, s], i) => (
            <Gelembung key={i} nama={n} waktu={`09.${10 + i * 4}`} sendiri={s}>
              {t}
            </Gelembung>
          ))}
        </GulirPesan>
      </div>
      <div className="gal-baris">
        <Tombol jenis="secondary" ukuran="small" onClick={() => setPesan((p) => [...p, ["Bu Ratna", "Satu lagi: warna kusen bisa coklat tua?", false]])}>
          Pesan masuk
        </Tombol>
        <span className="gal-ket">Gulir ke atas dulu, lalu tekan — muncul tombol “Pesan baru”, posisi Anda tidak direnggut.</span>
      </div>
    </div>
  );
}

export function DemoKuesioner() {
  return (
    <div className="gal-kartu" style={{ maxWidth: 440 }}>
      <Kuesioner
        langkah={[
          { tanya: "Jenis proyek apa yang Anda rencanakan?", pilihan: ["Hunian baru", "Renovasi", "Interior", "Komersial"] },
          { tanya: "Berapa perkiraan luas bangunannya?", pilihan: ["Di bawah 100 m²", "100–250 m²", "250–500 m²", "Di atas 500 m²"] },
          { tanya: "Kapan ingin mulai membangun?", pilihan: ["Dalam 3 bulan", "3–6 bulan", "6–12 bulan", "Belum ditentukan"] },
        ]}
      />
    </div>
  );
}
