import { useEffect, useMemo, useState } from "react";
import { RequireAuth } from "./RequireAuth";
import { Tabel, SelDua, type KolomTabel } from "../kit/Tabel";
import { Paginasi } from "../kit/Paginasi";
import { Lencana } from "../kit/Lencana";
import { Cari } from "../kit/Isian";
import { Tombol } from "../kit/Tombol";
import { Ikon } from "../kit/Ikon";
import { CaretDown, CalendarBlank, DownloadSimple, CoinIn, CoinOut, Ruler } from "../kit/ikon";
import {
  semuaPembayaran,
  semuaBiaya,
  daftarProyek,
  bacaCache,
  tulisCache,
  type Pembayaran,
  type BiayaProyek,
  type Proyek,
} from "../../lib/admin";
import { formatRupiah } from "../../lib/format";

/* =============================================================================
   Semua Transaksi — frame Figma "13. Transactions".

   Halaman ini menggabungkan DUA tabel database jadi satu daftar berurut
   waktu: `project_payments` (uang masuk) dan `project_costs` (uang keluar).
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
  const [bayar, setBayar] = useState<Pembayaran[] | null>(() =>
    bacaCache<Pembayaran[]>("bayar-semua"),
  );
  const [biaya, setBiaya] = useState<BiayaProyek[] | null>(() =>
    bacaCache<BiayaProyek[]>("biaya-semua"),
  );
  const [proyek, setProyek] = useState<Proyek[] | null>(() => bacaCache<Proyek[]>("proyek"));

  const [cari, setCari] = useState("");
  const [jenis, setJenis] = useState<"semua" | "masuk" | "keluar">("semua");
  const [filterProyek, setFilterProyek] = useState("semua");
  const [rentang, setRentang] = useState("12");
  const [halaman, setHalaman] = useState(1);
  const [perHalaman, setPerHalaman] = useState(12);
  const [terpilih, setTerpilih] = useState<string[]>([]);

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
    }));
    /* Dibandingkan sebagai ANGKA, bukan sebagai string. `paid_at` timestamptz
       ("2026-09-29T02:17:36.031Z") dan `incurred_on` date ("2026-09-29")
       tidak bisa diurutkan bersama secara leksikografis: yang kedua selalu
       kalah dari yang pertama pada tanggal yang sama, dan lebih buruk, "Z"
       lawan tanpa-Z membuat urutannya tidak berarti lintas tahun. */
    const waktuKe = (t: Transaksi) =>
      new Date(t.waktu.length === 10 ? t.waktu + "T23:59:59" : t.waktu).getTime();
    return [...masuk, ...keluar].sort((a, b) => waktuKe(b) - waktuKe(a));
  }, [bayar, biaya]);

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

  const totalHalaman = Math.max(1, Math.ceil(tersaring.length / perHalaman));
  /* Halaman dijepit saat RENDER, bukan disetel ulang lewat efek. Menyaring
     dari halaman 5 ke daftar yang cuma punya 2 halaman akan menampilkan
     tabel kosong selama satu frame kalau perbaikannya lewat useEffect. */
  const halamanKini = Math.min(halaman, totalHalaman);
  const mulai = (halamanKini - 1) * perHalaman;
  const tampil = tersaring.slice(mulai, mulai + perHalaman);

  function unduh() {
    const set = new Set(terpilih);
    const isi = terpilih.length ? tersaring.filter((t) => set.has(t.kunci)) : tersaring;
    const kepala = ["Tanggal", "Arah", "Keterangan", "Jenis", "Proyek", "Orang", "Nominal", "Catatan"];
    const baris = isi.map((t) =>
      [
        t.waktu.slice(0, 10),
        t.masuk ? "Masuk" : "Keluar",
        t.nama,
        t.sub,
        t.proyek,
        t.orang,
        t.masuk ? t.nominal : -t.nominal,
        t.catatan,
      ]
        .map(selCsv)
        .join(";"),
    );
    /* BOM di depan. Tanpa itu Excel membaca berkasnya sebagai Windows-1252
       dan setiap nama berhuruf non-ASCII tergambar rusak. */
    const teks = "﻿" + [kepala.join(";"), ...baris].join("\r\n");
    const url = URL.createObjectURL(new Blob([teks], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `transaksi-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const kolom: KolomTabel[] = [
    { judul: "Transaksi", lebar: 202, urut: true },
    { judul: "Proyek", lebar: 242, urut: true },
    { judul: "Penerima", lebar: 121, urut: true },
    { judul: "Tanggal", lebar: 113, urut: true },
    { judul: "Nominal", lebar: 94, urut: true, kanan: true },
    { judul: "Catatan", lebar: 237, redup: true },
    { judul: "Status", lebar: 119, urut: true },
  ];

  const baris = tampil.map((t) => {
    const tgl = tanggalBaris(t.waktu);
    return [
      <div className="trx__sel">
        <span className={`trx__ubin${t.masuk ? "" : " trx__ubin--keluar"}`}>
          <Ikon ikon={t.masuk ? CoinIn : CoinOut} ukuran={16} />
        </span>
        <SelDua atas={t.nama} bawah={t.sub} />
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
    <section className="trx">
      <div className="trx__bar">
        <Cari
          ukuran="medium"
          judul="Cari transaksi"
          placeholder="Cari transaksi"
          value={cari}
          onChange={(e) => {
            setCari(e.currentTarget.value);
            setHalaman(1);
          }}
        />

        {/* Pemilih di framenya tombol ber-caret, bukan <select> telanjang —
            jadi <select> aslinya ditumpangkan transparan di atas tombolnya.
            Yang tergambar tombol kit, yang dibuka daftar bawaan peramban:
            papan ketik, ketik-untuk-melompat, dan pemilih layar penuh di
            ponsel semuanya ikut, dan tidak bisa rusak diam-diam. */}
        <label className="k-pilihtombol">
          <Tombol ukuran="medium" jenis="secondary" kanan={CaretDown} tabIndex={-1}>
            {jenis === "semua" ? "Semua jenis" : jenis === "masuk" ? "Uang masuk" : "Uang keluar"}
          </Tombol>
          <select
            aria-label="Saring jenis transaksi"
            value={jenis}
            onChange={(e) => {
              setJenis(e.currentTarget.value as typeof jenis);
              setHalaman(1);
            }}
          >
            <option value="semua">Semua jenis</option>
            <option value="masuk">Uang masuk</option>
            <option value="keluar">Uang keluar</option>
          </select>
        </label>

        <label className="k-pilihtombol">
          <Tombol ukuran="medium" jenis="secondary" kanan={CaretDown} tabIndex={-1}>
            {filterProyek === "semua" ? "Semua proyek" : filterProyek}
          </Tombol>
          <select
            aria-label="Saring proyek"
            value={filterProyek}
            onChange={(e) => {
              setFilterProyek(e.currentTarget.value);
              setHalaman(1);
            }}
          >
            <option value="semua">Semua proyek</option>
            {judulProyek.map((j) => (
              <option key={j} value={j}>
                {j}
              </option>
            ))}
          </select>
        </label>

        <span className="trx__dorong" />

        <label className="k-pilihtombol">
          <Tombol ukuran="medium" jenis="secondary" kiri={CalendarBlank} kanan={CaretDown} tabIndex={-1}>
            {RENTANG.find((r) => r.nilai === rentang)?.label ?? "Rentang"}
          </Tombol>
          <select
            aria-label="Rentang waktu"
            value={rentang}
            onChange={(e) => {
              setRentang(e.currentTarget.value);
              setHalaman(1);
            }}
          >
            {RENTANG.map((r) => (
              <option key={r.nilai} value={r.nilai}>
                {r.label}
              </option>
            ))}
          </select>
        </label>

        <Tombol ukuran="medium" kiri={DownloadSimple} onClick={unduh} disabled={tersaring.length === 0}>
          Unduh
        </Tombol>
      </div>

      <div className="trx__tabel">
        {tampil.length === 0 ? (
          <p className="trx__kosong">
            {memuat ? "Memuat transaksi…" : "Tidak ada transaksi pada saringan ini."}
          </p>
        ) : (
          <Tabel
            kolom={kolom}
            baris={baris}
            pilih
            kunci={tampil.map((t) => t.kunci)}
            terpilih={terpilih}
            onPilih={setTerpilih}
            kepala="polos"
            pad={10.5}
            tinggiKepala={32}
            tinggiBaris={64}
            fontBaris={12}
          />
        )}
      </div>

      <div className="trx__kaki">
        <p className="trx__hitung">
          Menampilkan
          <select
            aria-label="Baris per halaman"
            value={perHalaman}
            onChange={(e) => {
              setPerHalaman(Number(e.currentTarget.value));
              setHalaman(1);
            }}
          >
            {[12, 25, 50].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          dari {tersaring.length}
          {terpilih.length > 0 && ` · ${terpilih.length} dipilih`}
        </p>
        <Paginasi kini={halamanKini} total={totalHalaman} onPindah={setHalaman} />
      </div>
    </section>
  );
}

export function TransaksiKit() {
  return (
    <RequireAuth skeleton={<div className="trx trx--rangka" />}>
      <Isi />
    </RequireAuth>
  );
}
