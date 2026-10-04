import { SorotTeks } from "../kit/Tampilan";
import { useEffect, useMemo, useState } from "react";
import { RequireAuth } from "./RequireAuth";
import { ToastProvider, useToast } from "../kit/Toast";
import { KelompokTombol } from "../kit/Formulir";
import { DialogBukti } from "./buktiKit";
import { DialogBiaya } from "./biayaKit";
import { SelDua, useUrutTabel, type KolomTabel } from "../kit/Tabel";
import { Lencana } from "../kit/Lencana";
import { Cari } from "../kit/Isian";
import { Tombol } from "../kit/Tombol";
import { Ikon } from "../kit/Ikon";
import { CalendarBlank, DownloadSimple, CoinIn, CoinOut, Ruler, CopySimple } from "../kit/ikon";
import { DaftarKit, PilihTombol } from "./daftarKit";
import {
  semuaPembayaran,
  semuaBiaya,
  daftarProyek,
  daftarKas,
  LABEL_KATEGORI_KAS,
  type EntriKas,
  bacaCache,
  tulisCache,
  type Pembayaran,
  type BiayaProyek,
  type Proyek,
} from "../../lib/admin";
import { formatRupiah } from "../../lib/format";

/* =============================================================================
   Semua Transaksi — frame Figma "13. Transactions".

   Halaman ini menggabungkan TIGA tabel database jadi satu daftar berurut
   waktu: `project_payments` (uang masuk), `project_costs` (uang keluar),
   dan `studio_ledger` (kas studio di luar proyek, dua arah — fase 4).
   Itu persis yang digambar framenya — kolom Amount di sana memuat angka
   bertanda plus DAN minus dalam satu tabel.

   Pemetaannya:

     Coinest             Halaman ini
     -----------------   ----------------------------------------------------
     Transaction Name    keterangan + jenis/kategori di bawahnya
     Account             proyek
     Transaction ID      penerima (`receiver`) / dibayar ke (`team_member`)
     Date & Time         tanggal + nama hari
     Amount              +rupiah hijau / -rupiah merah
     Note                catatan (`note`) — biaya tidak punya, jadi "—"
     Status              Masuk / Keluar
     All Category        jenis: semua / masuk / keluar
     All Account         proyek
     Rentang tanggal     bulan ini / 3 bulan / 12 bulan / semua
     Download            unduh CSV

   Kolom "Transaction ID" TIDAK diisi id barisnya. Id di sini uuid 36 huruf
   yang tidak pernah dibacakan siapa pun, sementara "siapa yang menerima
   atau dibayar" adalah pertanyaan yang memang ditanyakan tentang satu baris
   transaksi — dan tidak dijawab kolom lain di halaman ini.

   Kotak centangnya MEMILIH, dan yang memakai pilihan itu tombol Unduh:
   kosong berarti seluruh baris tersaring, terisi berarti yang tercentang
   saja. Ia sengaja TIDAK dipasangi aksi hapus massal — menghapus catatan
   uang dalam jumlah banyak dengan satu klik adalah perbuatan yang paling
   bikin panik kalau salah, dan tidak ada satu pun permintaan untuk itu.
   ============================================================================= */

interface Transaksi {
  kunci: string;
  masuk: boolean;
  nama: string;
  sub: string;
  proyek: string;
  orang: string;
  waktu: string;
  nominal: number;
  catatan: string;
  /** Baris pembayaran aslinya — namanya membuka bukti pembayaran. */
  bayar?: Pembayaran;
  /** Baris biaya aslinya — namanya membuka rinciannya (dan hapus). */
  biaya?: BiayaProyek;
  /** Catatan kas studio di luar proyek — diubah di halaman Kas Studio. */
  kas?: EntriKas;
}

const LABEL_JENIS: Record<string, string> = {
  dp: "DP",
  termin: "Termin",
  pelunasan: "Pelunasan",
};
const LABEL_METODE: Record<string, string> = {
  tunai: "Tunai",
  transfer: "Transfer",
  qris: "QRIS",
  lainnya: "Lainnya",
};
const LABEL_KATEGORI: Record<string, string> = {
  freelancer: "Freelancer",
  operasional: "Operasional",
  prinsipal: "Prinsipal",
  lainnya: "Lainnya",
};

const HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

function tanggalBaris(iso: string): { atas: string; bawah: string } {
  const d = new Date(iso.length === 10 ? iso + "T00:00:00" : iso);
  if (Number.isNaN(d.getTime())) return { atas: "—", bawah: "" };
  return {
    atas: `${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}`,
    bawah: HARI[d.getDay()]!,
  };
}

const RENTANG = [
  { nilai: "1", label: "Bulan ini" },
  { nilai: "3", label: "3 bulan terakhir" },
  { nilai: "12", label: "12 bulan terakhir" },
  { nilai: "0", label: "Semua waktu" },
];

/** Batas bawah rentang, atau null untuk "semua waktu". */
function batasRentang(bulan: number): number | null {
  if (bulan <= 0) return null;
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  d.setMonth(d.getMonth() - (bulan - 1));
  return d.getTime();
}

/**
 * Satu baris CSV.
 *
 * Tanda kutip DIGANDAKAN, bukan dibuang: nama proyek studio ini memuat
 * tanda kutip sesekali ("Rumah 'Tropis' Sungai Raya"), dan membuangnya
 * mengubah data yang diunduh. Pemisahnya titik koma karena Excel
 * berlokal Indonesia membaca koma sebagai desimal dan menaruh seluruh
 * baris di satu sel.
 */
function selCsv(v: string | number): string {
  const t = String(v);
  return /[";\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
}

function Isi() {
  const toast = useToast();
  const [bayar, setBayar] = useState<Pembayaran[] | null>(() =>
    bacaCache<Pembayaran[]>("bayar-semua"),
  );
  const [biaya, setBiaya] = useState<BiayaProyek[] | null>(() =>
    bacaCache<BiayaProyek[]>("biaya-semua"),
  );
  const [proyek, setProyek] = useState<Proyek[] | null>(() => bacaCache<Proyek[]>("proyek"));
  /* Kas studio cuma DIBACA di sini: kunci cache-nya milik halaman Kas Studio
     (jebakan #8 — yang menulis cache satu kunci hanya pemilik daftarnya). */
  const [kas, setKas] = useState<EntriKas[] | null>(() => bacaCache<EntriKas[]>("kas-studio"));

  const [cari, setCari] = useState("");
  const [jenis, setJenis] = useState<"semua" | "masuk" | "keluar">("semua");
  const [filterProyek, setFilterProyek] = useState("semua");
  const [rentang, setRentang] = useState("12");
  const [terpilih, setTerpilih] = useState<string[]>([]);
  const [bukti, setBukti] = useState<Pembayaran | null>(null);
  const [rinci, setRinci] = useState<BiayaProyek | null>(null);

  /* "Lihat semua" dari Terima Pembayaran dan Catat Pengeluaran membawa
     ?jenis=masuk|keluar. Dibaca di efek, bukan di useState: halaman ini
     dirender di server tanpa URL, dan membacanya saat render memecah
     hidrasi. */
  useEffect(() => {
    const j = new URLSearchParams(window.location.search).get("jenis");
    if (j === "masuk" || j === "keluar") setJenis(j);
  }, []);

  useEffect(() => {
    semuaPembayaran()
      .then((d) => {
        tulisCache("bayar-semua", d);
        setBayar(d);
      })
      .catch(() => setBayar((l) => l ?? []));
    semuaBiaya()
      .then((d) => {
        tulisCache("biaya-semua", d);
        setBiaya(d);
      })
      .catch(() => setBiaya((l) => l ?? []));
    daftarProyek()
      .then((d) => {
        tulisCache("proyek", d);
        setProyek(d);
      })
      .catch(() => setProyek((l) => l ?? []));
    daftarKas()
      .then(setKas)
      .catch(() => setKas((l) => l ?? []));
  }, []);

  const semua = useMemo<Transaksi[]>(() => {
    const masuk = (bayar ?? []).map<Transaksi>((b) => ({
      kunci: `p:${b.id}`,
      masuk: true,
      nama: `Pembayaran ${LABEL_JENIS[b.kind] ?? b.kind}`,
      sub: LABEL_METODE[b.method] ?? b.method,
      proyek: b.projectTitle ?? "—",
      orang: b.receiver || "—",
      waktu: b.paidAt,
      nominal: b.amount,
      catatan: b.note || "—",
      bayar: b,
    }));
    const keluar = (biaya ?? []).map<Transaksi>((k) => ({
      kunci: `b:${k.id}`,
      masuk: false,
      nama: k.label,
      sub: LABEL_KATEGORI[k.category] ?? k.category,
      proyek: k.projectTitle ?? "—",
      orang: k.teamMemberName || "—",
      waktu: k.incurredOn,
      nominal: k.amount,
      /* Biaya tidak punya kolom catatan — keterangannya sudah jadi nama
         barisnya. Mengisi kolom ini dengan keterangan yang sama berarti
         satu kalimat dicetak dua kali dalam satu baris. */
      catatan: "—",
      biaya: k,
    }));
    /* Dibandingkan sebagai ANGKA, bukan sebagai string. `paid_at` timestamptz
       ("2026-09-29T02:17:36.031Z") dan `incurred_on` date ("2026-09-29")
       tidak bisa diurutkan bersama secara leksikografis: yang kedua selalu
       kalah dari yang pertama pada tanggal yang sama, dan lebih buruk, "Z"
       lawan tanpa-Z membuat urutannya tidak berarti lintas tahun. */
    const waktuKe = (t: Transaksi) =>
      new Date(t.waktu.length === 10 ? t.waktu + "T23:59:59" : t.waktu).getTime();
    /* Kas studio (sheet KELUAR MASUK): uang di luar proyek desain. Yang
       tidak terkait proyek dikelompokkan sebagai "Kas studio" di kolom
       Proyek, supaya saringan proyek bisa memisahkannya. */
    const studio = (kas ?? []).map<Transaksi>((k) => ({
      kunci: `k:${k.id}`,
      masuk: k.direction === "masuk",
      nama: k.label,
      sub: LABEL_KATEGORI_KAS[k.category],
      proyek: k.projectTitle ?? "Kas studio",
      orang: k.counterparty || "—",
      waktu: k.occurredOn,
      nominal: k.amount,
      catatan: k.note || "—",
      kas: k,
    }));
    return [...masuk, ...keluar, ...studio].sort((a, b) => waktuKe(b) - waktuKe(a));
  }, [bayar, biaya, kas]);

  const tersaring = useMemo(() => {
    const q = cari.trim().toLowerCase();
    const batas = batasRentang(Number(rentang));
    return semua.filter((t) => {
      if (jenis === "masuk" && !t.masuk) return false;
      if (jenis === "keluar" && t.masuk) return false;
      if (filterProyek !== "semua" && t.proyek !== filterProyek) return false;
      if (batas !== null) {
        const w = new Date(t.waktu.length === 10 ? t.waktu + "T00:00:00" : t.waktu).getTime();
        if (Number.isFinite(w) && w < batas) return false;
      }
      if (!q) return true;
      return (
        t.nama.toLowerCase().includes(q) ||
        t.proyek.toLowerCase().includes(q) ||
        t.orang.toLowerCase().includes(q) ||
        t.catatan.toLowerCase().includes(q)
      );
    });
  }, [semua, cari, jenis, filterProyek, rentang]);

  /** Baris yang diekspor: yang dicentang, atau semua yang lolos saringan. */
  function barisEkspor(): (string | number)[][] {
    const set = new Set(terpilih);
    const isi = terpilih.length ? tersaring.filter((t) => set.has(t.kunci)) : tersaring;
    return [
      ["Tanggal", "Arah", "Keterangan", "Jenis", "Proyek", "Orang", "Nominal", "Catatan"],
      ...isi.map((t) => [t.waktu.slice(0, 10), t.masuk ? "Masuk" : "Keluar", t.nama, t.sub, t.proyek, t.orang, t.masuk ? t.nominal : -t.nominal, t.catatan]),
    ];
  }

  function unduh() {
    const baris = barisEkspor().map((b) => b.map(selCsv).join(";"));
    /* BOM di depan. Tanpa itu Excel membaca berkasnya sebagai Windows-1252
       dan setiap nama berhuruf non-ASCII tergambar rusak. */
    const teks = "\ufeff" + baris.join("\r\n");
    const url = URL.createObjectURL(new Blob([teks], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `transaksi-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /* Salin sebagai teks bertab: ditempel di Excel atau Google Sheets, tiap
     kolom langsung jatuh ke selnya sendiri — tanpa mengunduh berkas. */
  async function salin() {
    const teks = barisEkspor()
      .map((b) => b.map((v) => String(v).replace(/[\t\n]/g, " ")).join("\t"))
      .join("\n");
    try {
      await navigator.clipboard.writeText(teks);
      toast({ judul: "Transaksi disalin", keterangan: `${barisEkspor().length - 1} baris — tempel di Excel atau Google Sheets.`, nada: "sukses" });
    } catch {
      toast({ judul: "Tidak bisa menyalin", keterangan: "Peramban menolak akses papan klip. Pakai Unduh CSV.", nada: "gagal" });
    }
  }

  const kolom: KolomTabel[] = [
    { judul: "Transaksi", lebar: 202, urut: true },
    { judul: "Proyek", lebar: 242, urut: true },
    { judul: "Penerima", lebar: 121, urut: true },
    { judul: "Tanggal", lebar: 113, urut: true },
    /* 124, bukan 94 milik frame: "−Rp15.000.000" tebal butuh ~110 dan dulu
       meluber ke kolom Catatan — tanda "—"-nya menempel seperti coretan.
       Diambil dari Catatan, jadi jumlah lebarnya tetap. */
    { judul: "Nominal", lebar: 124, urut: true, kanan: true },
    { judul: "Catatan", lebar: 207, redup: true },
    { judul: "Status", lebar: 119, urut: true },
  ];

  /* Urutan klik-judul-kolom berlaku pada SELURUH hasil saringan sebelum
     DaftarKit memotongnya per halaman. Kunci baris ikut urutan yang sama. */
  const urut = useUrutTabel(tersaring, [
    (t) => t.nama,
    (t) => (t.proyek === "—" ? null : t.proyek),
    (t) => (t.orang === "—" ? null : t.orang),
    (t) => new Date(t.waktu.length === 10 ? t.waktu + "T00:00:00" : t.waktu).getTime(),
    (t) => (t.masuk ? t.nominal : -t.nominal),
    null,
    (t) => (t.masuk ? "Masuk" : "Keluar"),
  ]);
  const baris = urut.terurut.map((t) => {
    const tgl = tanggalBaris(t.waktu);
    return [
      <div className="trx__sel">
        <span className={`trx__ubin${t.masuk ? "" : " trx__ubin--keluar"}`}>
          <Ikon ikon={t.masuk ? CoinIn : CoinOut} ukuran={16} />
        </span>
        {/* Nama pembayaran membuka buktinya — pola yang sama dengan nama
            orang di Gaji. Biaya keluar tidak punya bukti untuk klien. */}
        {t.bayar ? (
          <button
            type="button"
            className="trx__bukti"
            title={`Bukti pembayaran ${formatRupiah(t.nominal)}`}
            onClick={() => setBukti(t.bayar!)}
          >
            <SelDua atas={<SorotTeks teks={t.nama} cari={cari} />} bawah={t.sub} />
          </button>
        ) : t.biaya ? (
          <button
            type="button"
            className="trx__bukti"
            title={`Rincian biaya ${formatRupiah(t.nominal)}`}
            onClick={() => setRinci(t.biaya!)}
          >
            <SelDua atas={<SorotTeks teks={t.nama} cari={cari} />} bawah={t.sub} />
          </button>
        ) : t.kas ? (
          <a className="trx__bukti" href="/admin/keuangan/kas" title="Ubah di Kas Studio">
            <SelDua atas={<SorotTeks teks={t.nama} cari={cari} />} bawah={t.sub} />
          </a>
        ) : (
          <SelDua atas={<SorotTeks teks={t.nama} cari={cari} />} bawah={t.sub} />
        )}
      </div>,
      <div className="trx__sel">
        <span className="trx__ubinkecil">
          <Ikon ikon={Ruler} ukuran={10} />
        </span>
        <span className="trx__nama">{t.proyek}</span>
      </div>,
      t.orang,
      <SelDua atas={tgl.atas} bawah={tgl.bawah} />,
      <span className={t.masuk ? "trx__masuk" : "trx__keluar"}>
        {t.masuk ? "+" : "−"}
        {formatRupiah(t.nominal)}
      </span>,
      t.catatan,
      <Lencana bentuk="pejal" nada={t.masuk ? "selesai" : "menunggu"}>
        {t.masuk ? "Masuk" : "Keluar"}
      </Lencana>,
    ];
  });

  const judulProyek = useMemo(() => {
    const dari = new Set((proyek ?? []).map((p) => p.title));
    for (const t of semua) if (t.proyek !== "—") dari.add(t.proyek);
    return [...dari].sort((a, b) => a.localeCompare(b, "id"));
  }, [proyek, semua]);

  const memuat = bayar === null || biaya === null;

  return (
    <>
    <DaftarKit
      className="trx"
      kunciSaring={`${cari}|${jenis}|${filterProyek}|${rentang}|${urut.urutan ? `${urut.urutan.kolom}${urut.urutan.arah}` : ""}`}
      urutan={urut.urutan}
      onUrut={urut.onUrut}
      kiri={
        <>
          <Cari
            ukuran="medium"
            judul="Cari transaksi"
            placeholder="Cari transaksi"
            value={cari}
            onChange={(e) => setCari(e.currentTarget.value)}
          />
          <PilihTombol
            judul="Saring jenis transaksi"
            nilai={jenis}
            onPilih={(v) => setJenis(v as typeof jenis)}
            opsi={[
              { nilai: "semua", label: "Semua jenis" },
              { nilai: "masuk", label: "Uang masuk" },
              { nilai: "keluar", label: "Uang keluar" },
            ]}
          />
          <PilihTombol
            judul="Saring proyek"
            nilai={filterProyek}
            onPilih={setFilterProyek}
            opsi={[{ nilai: "semua", label: "Semua proyek" }, ...judulProyek.map((j) => ({ nilai: j, label: j }))]}
          />
        </>
      }
      kanan={
        <>
          <PilihTombol judul="Rentang waktu" kiri={CalendarBlank} nilai={rentang} onPilih={setRentang} opsi={RENTANG} />
          <KelompokTombol label="Ekspor transaksi">
            <Tombol ukuran="medium" kiri={DownloadSimple} onClick={unduh} disabled={tersaring.length === 0}>
              Unduh
            </Tombol>
            <Tombol ukuran="medium" kiri={CopySimple} onClick={salin} disabled={tersaring.length === 0}>
              Salin
            </Tombol>
          </KelompokTombol>
        </>
      }
      kolom={kolom}
      baris={baris}
      kunci={urut.terurut.map((t) => t.kunci)}
      pilih={{ terpilih, onPilih: setTerpilih }}
      memuat={memuat}
      teksMemuat="Memuat transaksi…"
      kosong="Tidak ada transaksi pada saringan ini."
    />
    <DialogBukti
      bayar={bukti}
      judulProyek={bukti?.projectTitle ?? ""}
      whatsapp={(proyek ?? []).find((p) => p.id === bukti?.projectId)?.clientWhatsapp}
      jenis={bukti ? LABEL_JENIS[bukti.kind] ?? bukti.kind : ""}
      metode={bukti ? LABEL_METODE[bukti.method] ?? bukti.method : ""}
      open={bukti !== null}
      onOpenChange={(b) => !b && setBukti(null)}
    />
    <DialogBiaya
      biaya={rinci}
      kategori={rinci ? LABEL_KATEGORI[rinci.category] ?? rinci.category : ""}
      open={rinci !== null}
      onOpenChange={(b) => !b && setRinci(null)}
      onDihapus={() =>
        semuaBiaya()
          .then((d) => {
            tulisCache("biaya-semua", d);
            setBiaya(d);
          })
          .catch(() => {})
      }
    />
    </>
  );
}

export function TransaksiKit() {
  return (
    <RequireAuth skeleton={<div className="kd trx trx--rangka" />}>
      <ToastProvider>
        <Isi />
      </ToastProvider>
    </RequireAuth>
  );
}
