import { useEffect, useMemo, useState } from "react";
import { RequireAuth } from "./RequireAuth";
import { KartuKas } from "../kit/Kartu";
import { KepalaSeksi } from "../kit/Item";
import { KelompokTab } from "../kit/Segmen";
import { BarKemajuan } from "../kit/Ukuran";
import { KolomGrafik, LabelYGrafik } from "../kit/Grafik";
import { Tabel, SelDua, type KolomTabel } from "../kit/Tabel";
import { Lencana } from "../kit/Lencana";
import { Tombol, TombolIkon } from "../kit/Tombol";
import { Ikon } from "../kit/Ikon";
import {
  CaretDown,
  CoinIn,
  CoinOut,
  DotsThreeVertical,
  Globe,
  NotePencil,
  Plus,
} from "../kit/ikon";
import {
  daftarProyek,
  ambilBulanan,
  semuaPembayaran,
  semuaBiaya,
  simpanProyek,
  ubahFaseProgress,
  bacaCache,
  tulisCache,
  type Proyek,
  type BarisBulanan,
  type Pembayaran,
  type BiayaProyek,
} from "../../lib/admin";
import { formatRupiah, formatRupiahRingkas } from "../../lib/format";

/* =============================================================================
   Semua Proyek — frame Figma "19. Cards".

   Coinest menaruh KARTU KREDIT di kolom kiri dan rincian satu kartu di
   kanannya. Studio ini tidak punya kartu; yang ia punya dan yang dibuka
   satu per satu setiap hari adalah PROYEK. Jadi:

     Coinest                    Halaman ini
     -------------------------  ---------------------------------------------
     My Cards                   daftar proyek, satu kartu per proyek
       nama kartu / logo        judul proyek / kategori
       saldo / Debit-Credit     nilai kontrak / status terbit
       Card Number, EXP, CVV    klien, tahun, kota
     Top Up / Transfer / Pay    Ubah / Terima Bayar / Halaman publik
     Card Number                klien
     Expiry, CVC, Status        tahap pipeline, fase klien, status terbit
     Spending Limits            pembayaran: diterima terhadap nilai kontrak
     Cashflow                   kas masuk (atas) dan biaya (bawah) per bulan
     Transactions               transaksi proyek terpilih

   Kartu yang terpilih digambar GELAP, sisanya terang — persis kartu kedua
   di framenya. Tahap dan fase bisa diubah langsung dari panel rincian,
   seperti di daftar lama: keduanya yang paling sering disentuh staf, dan
   memaksanya lewat editor proyek berarti tiga klik untuk satu kata.

   Yang TIDAK ikut dari daftar lama, karena framenya tidak punya tempat:
   pencarian, saringan status/kategori, urutan, dan tampilan tabel. Hapus
   proyek pindah ke editor proyek.
   ============================================================================= */

const KATEGORI: Record<string, string> = {
  residential: "Hunian",
  commercial: "Komersial",
  hospitality: "Hospitality",
  interior: "Interior",
  landscape: "Lanskap",
  masterplan: "Masterplan",
  renovation: "Renovasi",
};

const STATUS: Record<string, { teks: string; nada: "selesai" | "menunggu" | "netral" }> = {
  published: { teks: "Terbit", nada: "selesai" },
  draft: { teks: "Draf", nada: "netral" },
  archived: { teks: "Arsip", nada: "menunggu" },
};

// Dua daftar ini SAMA dengan daftar lama (ProjectList) dan dengan editor
// proyek — nilainya disimpan di database, jadi mengubah satu kata di sini
// berarti tahap lama tidak lagi punya label.
const TAHAP: { value: string; label: string }[] = [
  { value: "proposal", label: "Proposal" },
  { value: "deal_kontrak", label: "Deal Kontrak" },
  { value: "dp_50", label: "DP 50%" },
  { value: "desain_1", label: "Desain 1" },
  { value: "desain_2", label: "Desain 2" },
  { value: "finish", label: "Finish" },
  { value: "pelunasan", label: "Pelunasan" },
];
const FASE: { value: string; label: string }[] = [
  { value: "konsultasi", label: "Konsultasi" },
  { value: "konsep", label: "Konsep" },
  { value: "ded", label: "DED" },
  { value: "perizinan", label: "Perizinan" },
  { value: "konstruksi", label: "Konstruksi" },
  { value: "selesai", label: "Selesai" },
];

const BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const LABEL_JENIS: Record<string, string> = { dp: "DP", termin: "Termin", pelunasan: "Pelunasan" };
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

const RENTANG = [
  { nilai: "1", label: "Bulan ini" },
  { nilai: "3", label: "3 bulan" },
  { nilai: "12", label: "12 bulan" },
  { nilai: "0", label: "Semua" },
];

function batasRentang(bulan: number): number | null {
  if (bulan <= 0) return null;
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  d.setMonth(d.getMonth() - (bulan - 1));
  return d.getTime();
}

/** `paid_at` timestamptz ATAU `incurred_on` date -> milidetik. */
function waktuKe(iso: string, akhirHari = true): number {
  return new Date(iso.length === 10 ? iso + (akhirHari ? "T23:59:59" : "T00:00:00") : iso).getTime();
}

/** Batas sumbu arus kas: dibulatkan ke atas ke angka yang enak dibaca,
 *  supaya label tengahnya (separuhnya) juga bulat. */
function batasSumbu(n: number): number {
  const t = Math.max(1, n);
  const pangkat = 10 ** Math.floor(Math.log10(t));
  const langkah = [1, 2, 2.5, 5, 10].find((k) => k * pangkat >= t) ?? 10;
  return langkah * pangkat;
}

/** 12.500.000 -> "12,5 jt" — label sumbu, tanpa "Rp". */
function singkat(n: number): string {
  const a = Math.abs(n);
  const tanda = n < 0 ? "−" : "";
  if (a >= 1e9) return `${tanda}${(a / 1e9).toFixed(1).replace(/\.0$/, "").replace(".", ",")} M`;
  if (a >= 1e6) return `${tanda}${(a / 1e6).toFixed(1).replace(/\.0$/, "").replace(".", ",")} jt`;
  if (a >= 1e3) return `${tanda}${Math.round(a / 1e3)} rb`;
  return `${tanda}${a}`;
}

interface Transaksi {
  kunci: string;
  masuk: boolean;
  nama: string;
  sub: string;
  orang: string;
  waktu: string;
  nominal: number;
  catatan: string;
}

/**
 * Pilihan yang TERLIHAT sebagai teks biasa berpanah, dengan <select> asli
 * ditumpangkan transparan — pola `.k-pilihtombol` dalam ukuran teks. Yang
 * tergambar nilainya; yang dibuka daftar bawaan peramban.
 */
function PilihTeks({
  judul,
  nilai,
  opsi,
  onUbah,
}: {
  judul: string;
  nilai: string;
  opsi: { value: string; label: string }[];
  onUbah: (baru: string) => Promise<void>;
}) {
  const [tampil, setTampil] = useState(nilai);
  const [sibuk, setSibuk] = useState(false);
  useEffect(() => setTampil(nilai), [nilai]);
  return (
    <label className="pro__pilih" data-sibuk={sibuk || undefined}>
      <span>{opsi.find((o) => o.value === tampil)?.label ?? "Belum diisi"}</span>
      <Ikon ikon={CaretDown} ukuran={12} />
      <select
        aria-label={judul}
        value={tampil}
        disabled={sibuk}
        onChange={async (e) => {
          const baru = e.currentTarget.value;
          const lama = tampil;
          setTampil(baru);
          setSibuk(true);
          try {
            await onUbah(baru);
          } catch {
            // Gagal menyimpan: kembalikan tampilannya. Galatnya tidak
            // ditelan diam-diam — nilai yang melompat balik adalah tandanya.
            setTampil(lama);
          } finally {
            setSibuk(false);
          }
        }}
      >
        {!opsi.some((o) => o.value === tampil) && <option value={tampil}>Belum diisi</option>}
        {opsi.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function Isi() {
  const [proyek, setProyek] = useState<Proyek[] | null>(() => bacaCache<Proyek[]>("proyek"));
  const [bayar, setBayar] = useState<Pembayaran[] | null>(() => bacaCache<Pembayaran[]>("bayar-semua"));
  const [biaya, setBiaya] = useState<BiayaProyek[] | null>(() => bacaCache<BiayaProyek[]>("biaya-semua"));
  const [pilih, setPilih] = useState<string | null>(() => {
    try {
      return new URLSearchParams(location.search).get("id");
    } catch {
      return null;
    }
  });
  const [bulanan, setBulanan] = useState<BarisBulanan[] | null>(null);
  const [rentangArus, setRentangArus] = useState(6);
  const [rentangTrx, setRentangTrx] = useState("0");
  const [sorot, setSorot] = useState<number | null>(null);

  useEffect(() => {
    daftarProyek()
      .then((d) => {
        tulisCache("proyek", d);
        setProyek(d);
      })
      .catch(() => setProyek((l) => l ?? []));
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
  }, []);

  /* Terbaru di atas — sama dengan urutan bawaan daftar lama. */
  const urut = useMemo(
    () =>
      [...(proyek ?? [])].sort((a, b) =>
        (b.publishedAt ?? "").localeCompare(a.publishedAt ?? "") || (b.year ?? 0) - (a.year ?? 0),
      ),
    [proyek],
  );
  const kini = urut.find((p) => p.id === pilih) ?? urut[0] ?? null;

  /* Pilihan ikut ke alamat (`?id=`), supaya tombol Kembali dari editor
     proyek mendarat di proyek yang sama, dan tautannya bisa dibagikan. */
  function pilihProyek(id: string) {
    setPilih(id);
    setSorot(null);
    try {
      const u = new URL(location.href);
      u.searchParams.set("id", id);
      history.replaceState(history.state, "", u);
    } catch {
      /* alamat tidak bisa diubah — pilihannya tetap jalan */
    }
  }

  const kunciBulan = kini ? `proyek-bulan:${kini.id}:${rentangArus}` : null;
  useEffect(() => {
    if (!kini || !kunciBulan) return;
    let batal = false;
    setBulanan(bacaCache<BarisBulanan[]>(kunciBulan));
    ambilBulanan(kini.id, rentangArus)
      .then((d) => {
        if (batal) return;
        tulisCache(kunciBulan, d);
        setBulanan(d);
      })
      .catch(() => !batal && setBulanan((l) => l ?? []));
    return () => {
      batal = true;
    };
  }, [kini?.id, rentangArus, kunciBulan]);

  function gantiSatu(id: string, ubahan: Partial<Proyek>) {
    setProyek((l) => {
      const baru = (l ?? []).map((p) => (p.id === id ? { ...p, ...ubahan } : p));
      tulisCache("proyek", baru);
      return baru;
    });
  }

  /* --- Pembayaran ---------------------------------------------------------- */
  const kontrak = kini?.contractValue ?? 0;
  const diterima = kini?.paidTotal ?? 0;
  const persen = kontrak > 0 ? Math.max(0, Math.min(100, (diterima / kontrak) * 100)) : 0;

  /* --- Arus kas ------------------------------------------------------------ */
  /* Dipotong di sini juga, bukan cuma lewat parameter `bulan`: jawaban yang
     lebih panjang dari yang diminta (cache lama dari rentang 12) tidak
     boleh menjejalkan 12 kolom ke kisi yang lebarnya dihitung untuk 6. */
  const deret = (bulanan ?? []).slice(-rentangArus);
  const maks = batasSumbu(Math.max(0, ...deret.flatMap((b) => [b.kasMasuk, b.biaya])));
  const iSorot = sorot ?? (deret.length ? deret.length - 1 : null);
  const bSorot = iSorot !== null ? deret[iSorot] : undefined;

  /* --- Transaksi proyek ---------------------------------------------------- */
  const transaksi = useMemo<Transaksi[]>(() => {
    if (!kini) return [];
    const batas = batasRentang(Number(rentangTrx));
    const cocok = (projectId: string, waktu: string) =>
      projectId === kini.id && (batas === null || waktuKe(waktu, false) >= batas);
    const masuk = (bayar ?? [])
      .filter((b) => cocok(b.projectId, b.paidAt))
      .map<Transaksi>((b) => ({
        kunci: `p:${b.id}`,
        masuk: true,
        nama: `Pembayaran ${LABEL_JENIS[b.kind] ?? b.kind}`,
        sub: LABEL_METODE[b.method] ?? b.method,
        orang: b.receiver || "—",
        waktu: b.paidAt,
        nominal: b.amount,
        catatan: b.note || "—",
      }));
    const keluar = (biaya ?? [])
      .filter((k) => cocok(k.projectId, k.incurredOn))
      .map<Transaksi>((k) => ({
        kunci: `b:${k.id}`,
        masuk: false,
        nama: k.label,
        sub: LABEL_KATEGORI[k.category] ?? k.category,
        orang: k.teamMemberName || "—",
        waktu: k.incurredOn,
        nominal: k.amount,
        catatan: "—",
      }));
    /* Enam — sebanyak baris yang digambar framenya. Sisanya ada di halaman
       Semua Transaksi, yang tautannya ada di pemilih rentang. */
    return [...masuk, ...keluar].sort((a, b) => waktuKe(b.waktu) - waktuKe(a.waktu)).slice(0, 6);
  }, [kini, bayar, biaya, rentangTrx]);

  /* Lebar kolom dari jangkar tinta framenya (tabel 539..1396 = 857): centang
     554,5, nama 587, penerima 778,4, tanggal 889,5, nominal 992,5, catatan
     1077,7, status 1302 — dikurangi pad sel 15,5.

     Kolom centang framenya TIDAK dipasang: di sini tidak ada satu pun aksi
     yang memakai pilihan baris, dan kotak centang yang tidak berbuat apa-apa
     adalah janji palsu. Lebarnya (32,5) diserap kolom pertama, jadi kolom
     lain tetap di jangkarnya dan cuma ikon baris yang bergeser ke kiri. */
  const kolom: KolomTabel[] = [
    { judul: "Transaksi", lebar: 223.9, urut: true },
    { judul: "Penerima", lebar: 111.1, urut: true },
    { judul: "Tanggal", lebar: 103, urut: true },
    { judul: "Nominal", lebar: 85.2, urut: true },
    { judul: "Catatan", lebar: 224.3, urut: true },
    { judul: "Status", lebar: 109.5, urut: true },
  ];
  const baris = transaksi.map((t) => {
    const d = new Date(t.waktu.length === 10 ? t.waktu + "T00:00:00" : t.waktu);
    return [
      <div className="trx__sel">
        <span className={`trx__ubin${t.masuk ? "" : " trx__ubin--keluar"}`}>
          <Ikon ikon={t.masuk ? CoinIn : CoinOut} ukuran={16} />
        </span>
        <SelDua atas={t.nama} bawah={t.sub} besar bobotAtas={500} />
      </div>,
      t.orang,
      <SelDua atas={`${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}`} bawah={HARI[d.getDay()]} besar bobotAtas={400} />,
      <span className={t.masuk ? "trx__masuk" : "trx__keluar"} title={formatRupiah(t.nominal)}>
        {t.masuk ? "+" : "−"}
        {formatRupiahRingkas(t.nominal)}
      </span>,
      <span className="pro__catatan">{t.catatan}</span>,
      <Lencana bentuk="pejal" nada={t.masuk ? "selesai" : "menunggu"}>
        {t.masuk ? "Masuk" : "Keluar"}
      </Lencana>,
    ];
  });

  return (
    <div className="pro">
      {/* ---- Daftar proyek (slot "My Cards") ---------------------------- */}
      <section className="pro__daftar" aria-label="Daftar proyek">
        <div className="pro__daftarkepala">
          <h2 className="pro__judul">Proyek</h2>
          <a className="pro__baru" href="/admin/proyek/baru">
            <Ikon ikon={Plus} ukuran={12} />
            Baru
          </a>
        </div>
        <div className="pro__kartu">
          {urut.map((p) => {
            const st = STATUS[p.status] ?? { teks: p.status, nada: "netral" as const };
            const aktif = p.id === kini?.id;
            return (
              <button
                key={p.id}
                type="button"
                className="pro__kartub"
                aria-pressed={aktif}
                onClick={() => pilihProyek(p.id)}
              >
                <KartuKas
                  terang={!aktif}
                  nama={p.title}
                  kanan={<span className="pro__kategori">{KATEGORI[p.category] ?? p.category}</span>}
                  nilai={
                    <span title={p.contractValue ? formatRupiah(p.contractValue) : undefined}>
                      {p.contractValue ? formatRupiahRingkas(p.contractValue) : "—"}
                    </span>
                  }
                  label={st.teks}
                  kaki={[
                    { judul: "Klien", isi: p.client || "—" },
                    { judul: "Tahun", isi: p.year ?? "—" },
                    { judul: "Kota", isi: p.city || "—" },
                  ]}
                />
              </button>
            );
          })}
          {proyek !== null && urut.length === 0 && (
            <p className="pro__kosong">Belum ada proyek. Mulai dari tombol Baru di atas.</p>
          )}
        </div>
      </section>

      <div className="pro__kanan">
        <div className="pro__atas">
          <div className="pro__kolomrinci">
            {/* ---- Rincian proyek terpilih (slot "Card Details") ------------- */}
            <article className="pro__w pro__rinci" aria-label="Rincian proyek terpilih">
              <KelompokTab
                judul="Aksi proyek"
                className="pro__aksi"
                tab={
                  kini
                    ? [
                        { nilai: "ubah", label: "Ubah", ikon: NotePencil, href: `/admin/proyek/edit?id=${kini.id}` },
                        { nilai: "terima", label: "Terima Bayar", ikon: CoinIn, href: `/admin/keuangan/terima?proyek=${kini.id}` },
                        { nilai: "publik", label: "Halaman", ikon: Globe, href: `/proyek/${kini.slug}` },
                      ]
                    : []
                }
              />
              <p className="pro__label pro__label--atas">Klien</p>
              <p className="pro__nilai pro__nilai--besar">{kini?.client || "—"}</p>
              <div className="pro__baris">
                <div>
                  <p className="pro__label">Tahap</p>
                  {kini && (
                    <PilihTeks
                      judul={`Tahap pipeline ${kini.title}`}
                      nilai={kini.pipelineStage ?? ""}
                      opsi={TAHAP}
                      onUbah={async (v) => {
                        await simpanProyek(kini.id, { pipelineStage: v });
                        gantiSatu(kini.id, { pipelineStage: v });
                      }}
                    />
                  )}
                </div>
                <div>
                  <p className="pro__label">Fase klien</p>
                  {kini && (
                    <PilihTeks
                      judul={`Fase klien ${kini.title}`}
                      nilai={kini.phase ?? ""}
                      opsi={FASE}
                      onUbah={async (v) => {
                        await ubahFaseProgress(kini.id, v);
                        gantiSatu(kini.id, { phase: v });
                      }}
                    />
                  )}
                </div>
                <div>
                  <p className="pro__label">Status</p>
                  {kini && (
                    <Lencana bentuk="pejal" nada={STATUS[kini.status]?.nada ?? "netral"}>
                      {STATUS[kini.status]?.teks ?? kini.status}
                    </Lencana>
                  )}
                </div>
              </div>
            </article>

            {/* ---- Pembayaran (slot "Spending Limits") ---------------------- */}
            <article className="pro__w pro__bayar">
              <KepalaSeksi
                judul="Pembayaran"
                kanan={
                  kini ? (
                    <TombolIkon
                      ikon={DotsThreeVertical}
                      jenis="transparent"
                      ukuran="xsmall"
                      judul="Atur termin di editor proyek"
                      href={`/admin/proyek/edit?id=${kini.id}`}
                    />
                  ) : undefined
                }
              />
              <BarKemajuan persen={persen} tinggi={20} celah={6} judul="Pembayaran diterima" />
              <p className="pro__bayarket">
                <span>
                  <b title={formatRupiah(diterima)}>{formatRupiahRingkas(diterima)}</b>{" "}
                  <small>
                    {kontrak > 0 ? `diterima dari ${formatRupiahRingkas(kontrak)}` : "diterima · belum berkontrak"}
                  </small>
                </span>
                <b>{Math.round(persen)}%</b>
              </p>
            </article>
          </div>

          {/* ---- Arus kas proyek (slot "Cashflow") -------------------------- */}
          <article className="pro__w pro__arus">
            <KepalaSeksi
              judul="Arus Kas"
              kanan={
                <Tombol
                  ukuran="medium"
                  jenis="ghost"
                  kanan={CaretDown}
                  onClick={() => setRentangArus((r) => (r === 6 ? 12 : 6))}
                >
                  {rentangArus} bulan
                </Tombol>
              }
            />
            <ul className="pro__legenda">
              <li>
                <span className="pro__kotak pro__kotak--mint" />
                Kas masuk
              </li>
              <li>
                <span className="pro__kotak pro__kotak--tua" />
                Biaya
              </li>
            </ul>
            <div className="pro__grafik">
              <LabelYGrafik
                tinggi={211}
                nilai={[singkat(maks), singkat(maks / 2), "0", singkat(-maks / 2), singkat(-maks)]}
              />
              <div className="pro__kolom" onPointerLeave={() => setSorot(null)}>
                {deret.map((b, i) => {
                  const nyala = i === iSorot;
                  const atas = 50 - (b.kasMasuk / maks) * 50;
                  const bawah = 50 + (b.biaya / maks) * 50;
                  return (
                    <div
                      key={b.bulan}
                      className="pro__kolomb"
                      tabIndex={0}
                      aria-label={`${BULAN[Number(b.bulan.slice(5, 7)) - 1]} ${b.bulan.slice(0, 4)}: kas masuk ${formatRupiah(b.kasMasuk)}, biaya ${formatRupiah(b.biaya)}`}
                      onPointerEnter={() => setSorot(i)}
                      onFocus={() => setSorot(i)}
                    >
                      <KolomGrafik
                        tinggi={211}
                        /* 69,7 dari kolom 85,7 di framenya — 81%. Pada 12
                           bulan kolomnya separuh, batangnya juga. */
                        lebarBatang={rentangArus > 6 ? 34 : 69.7}
                        tumpuk
                        label={BULAN[Number(b.bulan.slice(5, 7)) - 1]}
                        batang={[
                          ...(b.kasMasuk > 0
                            ? [{ atas, bawah: 50, nada: nyala ? ("mint" as const) : ("mintpudar" as const), radiusAtas: 4 }]
                            : []),
                          ...(b.biaya > 0
                            ? [{ atas: 50, bawah, nada: nyala ? ("tua" as const) : ("tuapudar" as const), radiusBawah: 4 }]
                            : []),
                        ]}
                      />
                    </div>
                  );
                })}
                {bSorot && iSorot !== null && (
                  <div
                    className="pro__tip"
                    style={{
                      /* Di kanan kolom yang disorot, seperti framenya; kolom
                         terakhir membaliknya ke kiri supaya tidak keluar. */
                      left:
                        iSorot >= deret.length - 1
                          ? `calc(${(iSorot / deret.length) * 100}% - 122px)`
                          : `${((iSorot + 1) / deret.length) * 100}%`,
                    }}
                    aria-hidden="true"
                  >
                    <p className="pro__tipjudul">
                      {BULAN[Number(bSorot.bulan.slice(5, 7)) - 1]} {bSorot.bulan.slice(0, 4)}
                    </p>
                    <p className="pro__tipbaris">
                      <span>
                        <i className="pro__tiptitik pro__kotak--mint" />
                        Masuk
                      </span>
                      <b>{formatRupiahRingkas(bSorot.kasMasuk)}</b>
                    </p>
                    <p className="pro__tipbaris">
                      <span>
                        <i className="pro__tiptitik pro__kotak--tua" />
                        Biaya
                      </span>
                      <b>{formatRupiahRingkas(bSorot.biaya)}</b>
                    </p>
                  </div>
                )}
              </div>
            </div>
          </article>
        </div>

        {/* ---- Transaksi proyek (slot "Transactions") ----------------------- */}
        <article className="pro__w pro__trx">
          <KepalaSeksi
            judul="Transaksi"
            kanan={
              <label className="k-pilihtombol">
                <Tombol ukuran="medium" jenis="ghost" kanan={CaretDown} tabIndex={-1}>
                  {RENTANG.find((r) => r.nilai === rentangTrx)?.label ?? "Rentang"}
                </Tombol>
                <select
                  aria-label="Rentang transaksi"
                  value={rentangTrx}
                  onChange={(e) => setRentangTrx(e.currentTarget.value)}
                >
                  {RENTANG.map((r) => (
                    <option key={r.nilai} value={r.nilai}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </label>
            }
          />
          {baris.length > 0 ? (
            <div className="pro__tabel">
              <Tabel
                kolom={kolom}
                baris={baris}
                kepala="mint"
                pad={15.5}
                tinggiKepala={37}
                tinggiBaris={64}
                fontBaris={12}
              />
            </div>
          ) : (
            <p className="pro__kosong">
              {bayar === null || biaya === null
                ? "Memuat transaksi…"
                : kini
                  ? "Belum ada transaksi proyek ini pada rentang ini."
                  : "Pilih proyek di kiri."}
            </p>
          )}
        </article>
      </div>
    </div>
  );
}

export function ProyekKit() {
  return (
    <RequireAuth skeleton={<div className="pro pro--rangka" />}>
      <Isi />
    </RequireAuth>
  );
}
