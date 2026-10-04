import { useEffect, useMemo, useRef, useState } from "react";
import { RequireAuth } from "./RequireAuth";
import { KepalaSeksi, BarisPantau, BarisAset } from "../kit/Item";
import { GrafikArea, Busur, LencanaTren } from "../kit/Ukuran";
import { KolomGrafik, type BatangGrafik } from "../kit/Grafik";
import { Tabel, SelDua, SelIkon, type KolomTabel } from "../kit/Tabel";
import { TombolIkon } from "../kit/Tombol";
import { DownloadSimple, Ruler } from "../kit/ikon";
import {
  BULAN,
  BULAN_PENDEK,
  JENIS,
  IKON_JENIS,
  bulatkan,
  sumbu,
  NominalBesar,
  persen,
  teksPersen,
  PilihTombol,
  PilihTeks,
} from "./frame25";
import {
  feePerProyek,
  feePerOrang,
  semuaBiaya,
  bacaCache,
  tulisCache,
  LABEL_JENIS_ANGGOTA,
  type FeeProyek,
  type FeeOrang,
  type BiayaProyek,
} from "../../lib/admin";
import { formatRupiah, formatRupiahRingkas } from "../../lib/format";
import { unduhCsv } from "../../lib/csv";

/* =============================================================================
   Fee Proyek, mengikuti frame Figma "25. Investments".

   Halaman ini TIDAK PERNAH MENULIS apa pun. Fee diketik satu kali saja, di
   Keuangan → Catat Pengeluaran, dan di sini cuma dibaca. Itu aturan yang
   sama yang menjaga beban studio tidak tercatat dua kali — kalau halaman ini
   punya tombol simpan sendiri, nominal yang sama bisa masuk dari dua pintu.

   Pemetaan slotnya, karena Coinest menghitung saham dan studio ini
   menghitung bayaran orang:

     Coinest            Halaman ini
     -----------------  ----------------------------------------------------
     Portfolio Value    Total Fee — fee per bulan sebagai grafik tangga
     Profits            Beban per Tahun — empat kategori biaya bertumpuk,
                        dua yang di atas (gelap, mint) memang fee-nya
     Watchlist          Penerima Fee — enam orang terbesar sepanjang waktu
     Assets             Fee per Jenis — partner / inti / proyek / staf
     My Portfolio       Fee per Proyek, atau per Orang — tabel lengkap
                        pengganti dua tab halaman lama, plus ekspor CSV

   Yang DIANGGAP fee sama dengan repository/fee.ts: biaya berkategori
   freelancer atau prinsipal. Operasional dan lainnya bukan bayaran ke orang.

   Ukurannya dari frame, batas luar bergaris (garis Figma mengangkangi tepi
   rect, jadi kotaknya 1px lebih besar):

     baris 1   Total Fee 586x373   celah 20   Beban per Tahun 586x373
     baris 2   283 / 283 / 586, tinggi 485, celah 20 di kedua arah
   ============================================================================= */

const KATEGORI_FEE = new Set(["freelancer", "prinsipal"]);

/* Urutan tumpukan dari ATAS ke bawah, dan warnanya tangga `--ramp-1..4` —
   di tema terang persis #1E4841 / #BBF49C / #ECF4E9 / #E5E6E6 milik frame.
   Tangga, bukan `--brand`/`--brand-mint`: di tema gelap keduanya bernilai
   sama (jebakan #37), sementara tangga gelapnya empat rona yang berbeda.
   Fee di atas: dua potongan yang paling pekat adalah yang ditanyakan
   halaman ini. */
const KATEGORI_TAHUN = [
  { nilai: "freelancer", label: "Freelancer", warna: "var(--ramp-1)" },
  { nilai: "prinsipal", label: "Prinsipal", warna: "var(--ramp-2)" },
  { nilai: "operasional", label: "Operasional", warna: "var(--ramp-3)" },
  { nilai: "lainnya", label: "Lainnya", warna: "var(--ramp-4)" },
] as const;

/* Rentang siap pakai, sama dengan halaman lama. Bukan pemilih tanggal
   bebas: pertanyaan yang benar-benar muncul selalu "tahun ini" atau "bulan
   ini", dan dua kotak tanggal untuk itu berarti empat ketukan sebelum satu
   angka terbaca. */
const RENTANG = [
  { nilai: "semua", label: "Sepanjang waktu" },
  { nilai: "tahun", label: "Tahun ini" },
  { nilai: "bulan", label: "Bulan ini" },
];
const PILIH_BULAN = [
  { nilai: "6", label: "6 bulan" },
  { nilai: "10", label: "10 bulan" },
  { nilai: "12", label: "12 bulan" },
];
const PILIH_TAHUN = [
  { nilai: "4", label: "4 tahun" },
  { nilai: "8", label: "8 tahun" },
];

function batas(r: string): { dari?: string; sampai?: string } {
  const kini = new Date();
  const y = kini.getFullYear();
  if (r === "tahun") return { dari: `${y}-01-01`, sampai: `${y}-12-31` };
  if (r === "bulan") {
    const m = String(kini.getMonth() + 1).padStart(2, "0");
    // Hari terakhir bulan ini: tanggal 0 bulan BERIKUTNYA. Menghitungnya
    // sendiri dari tabel jumlah hari adalah cara paling mudah salah di Februari.
    const akhir = new Date(y, kini.getMonth() + 1, 0).getDate();
    return { dari: `${y}-${m}-01`, sampai: `${y}-${m}-${akhir}` };
  }
  return {};
}

type Mode = "proyek" | "orang";

function Isi() {
  const [biaya, setBiaya] = useState<BiayaProyek[] | null>(() => bacaCache<BiayaProyek[]>("biaya-semua"));
  /* Penerima Fee SELALU sepanjang waktu — ia daftar "siapa yang paling sering
     kita bayar", dan daftar itu yang dicari dari halaman ini. Cache hanya
     dipakai untuk rentang bawaan: menyimpan hasil "bulan ini" di bawah kunci
     yang sama membuat kunjungan berikutnya menampilkan angka sebulan sebagai
     angka sepanjang waktu — dan angka uang yang salah tanpa tanda adalah
     yang paling mahal. */
  const [orangSemua, setOrangSemua] = useState<FeeOrang[] | null>(() => bacaCache<FeeOrang[]>("feeorang"));
  const [proyekSemua, setProyekSemua] = useState<FeeProyek[] | null>(() =>
    bacaCache<FeeProyek[]>("feeproyek"),
  );

  const [nBulan, setNBulan] = useState("10");
  const [nTahun, setNTahun] = useState("8");
  const [rJenis, setRJenis] = useState("semua");
  const [rTabel, setRTabel] = useState("semua");
  const [mode, setMode] = useState<Mode>("proyek");

  /* Hasil rentang selain "semua" — tidak pernah di-cache. */
  const [orangRentang, setOrangRentang] = useState<FeeOrang[] | null>(null);
  const [proyekRentang, setProyekRentang] = useState<FeeProyek[] | null>(null);
  const [orangTabel, setOrangTabel] = useState<FeeOrang[] | null>(null);

  const tabelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    semuaBiaya()
      .then((d) => {
        tulisCache("biaya-semua", d);
        setBiaya(d);
      })
      .catch(() => setBiaya((l) => l ?? []));
    feePerOrang()
      .then((d) => {
        tulisCache("feeorang", d);
        setOrangSemua(d);
      })
      .catch(() => setOrangSemua((l) => l ?? []));
    feePerProyek()
      .then((d) => {
        tulisCache("feeproyek", d);
        setProyekSemua(d);
      })
      .catch(() => setProyekSemua((l) => l ?? []));
  }, []);

  useEffect(() => {
    if (rJenis === "semua") return;
    let batal = false;
    setOrangRentang(null);
    feePerOrang(batas(rJenis))
      .then((d) => !batal && setOrangRentang(d))
      .catch(() => !batal && setOrangRentang([]));
    return () => {
      batal = true;
    };
  }, [rJenis]);

  useEffect(() => {
    if (rTabel === "semua") return;
    let batal = false;
    setProyekRentang(null);
    setOrangTabel(null);
    feePerProyek(batas(rTabel))
      .then((d) => !batal && setProyekRentang(d))
      .catch(() => !batal && setProyekRentang([]));
    feePerOrang(batas(rTabel))
      .then((d) => !batal && setOrangTabel(d))
      .catch(() => !batal && setOrangTabel([]));
    return () => {
      batal = true;
    };
  }, [rTabel]);

  /* ---- Total Fee: fee per bulan ---------------------------------------- */
  const bulanan = useMemo(() => {
    const n = Number(nBulan);
    /* Dua kali n bulan: n yang digambar, n sebelumnya untuk pembanding.
       Tanggal 1 DULU baru mundur bulannya — `setMonth` pada tanggal 31
       melompati bulan yang pendek. */
    const kunci: string[] = [];
    const d = new Date();
    d.setDate(1);
    for (let i = 2 * n - 1; i >= 0; i--) {
      const x = new Date(d);
      x.setMonth(d.getMonth() - i);
      kunci.push(`${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}`);
    }
    const jumlah = new Map(kunci.map((k) => [k, 0]));
    for (const b of biaya ?? []) {
      if (!KATEGORI_FEE.has(b.category)) continue;
      const k = b.incurredOn.slice(0, 7);
      if (jumlah.has(k)) jumlah.set(k, jumlah.get(k)! + b.amount);
    }
    const semua = kunci.map((k) => ({ bulan: k, nilai: jumlah.get(k)! }));
    const kini = semua.slice(n);
    const lalu = semua.slice(0, n);
    const total = kini.reduce((a, b) => a + b.nilai, 0);
    const totalLalu = lalu.reduce((a, b) => a + b.nilai, 0);
    let puncak = -1;
    kini.forEach((b, i) => {
      if (b.nilai > 0 && (puncak < 0 || b.nilai > kini[puncak]!.nilai)) puncak = i;
    });
    return { kini, total, totalLalu, puncak, maks: bulatkan(Math.max(0, ...kini.map((b) => b.nilai))) };
  }, [biaya, nBulan]);

  /* ---- Beban per Tahun -------------------------------------------------- */
  const tahunan = useMemo(() => {
    const kini = new Date();
    const y = kini.getFullYear();
    const n = Number(nTahun);
    const tahunData = (biaya ?? []).map((b) => Number(b.incurredOn.slice(0, 4))).filter(Boolean);
    const pertama = tahunData.length ? Math.min(...tahunData) : y;
    /* Mulai dari tahun data pertama kalau itu lebih baru — studio muda tidak
       perlu delapan kolom yang enam di antaranya kosong. Tapi paling sedikit
       empat kolom: dua batang selebar 277 terbaca sebagai grafik yang rusak. */
    const mulai = Math.min(y - 3, Math.max(y - n + 1, pertama));
    const daftar = Array.from({ length: y - mulai + 1 }, (_, i) => mulai + i);
    const per = new Map(daftar.map((t) => [t, { freelancer: 0, prinsipal: 0, operasional: 0, lainnya: 0 } as Record<string, number>]));
    /* Pembanding tahun lalu diambil pada PERIODE YANG SAMA, bukan setahun
       penuh: bulan September, tahun berjalan baru tiga perempat — dibanding
       setahun penuh ia selalu tampak turun 25%. */
    const hariIni = kini.toISOString().slice(5, 10);
    let ytd = 0;
    let ytdLalu = 0;
    for (const b of biaya ?? []) {
      const t = Number(b.incurredOn.slice(0, 4));
      const k = KATEGORI_TAHUN.some((x) => x.nilai === b.category) ? b.category : "lainnya";
      const baris = per.get(t);
      if (baris) baris[k] = (baris[k] ?? 0) + b.amount;
      if (t === y) ytd += b.amount;
      if (t === y - 1 && b.incurredOn.slice(5, 10) <= hariIni) ytdLalu += b.amount;
    }
    const kolom = daftar.map((t) => {
      const v = per.get(t)!;
      return { tahun: t, nilai: v, total: KATEGORI_TAHUN.reduce((a, k) => a + (v[k.nilai] ?? 0), 0) };
    });
    const total = kolom.reduce((a, k) => a + k.total, 0);
    return { kolom, total, ytd, ytdLalu };
  }, [biaya, nTahun]);

  /* Tinggi tumpukan dalam piksel bidang plot 174. Yang tertinggi 139 — 80%
     bidang, angka framenya (puncak 270 dari dasar 409,5) — lalu celah 4
     antarpotongan ditambahkan DI ATASNYA, bukan dipotong dari nilainya:
     potongan yang dipotong celah membuat kategori kecil lenyap. */
  const TINGGI_BIDANG = 174;
  const batangTahun = useMemo(() => {
    const maks = Math.max(1, ...tahunan.kolom.map((k) => k.total));
    return tahunan.kolom.map((k) => {
      const isi = KATEGORI_TAHUN.filter((x) => (k.nilai[x.nilai] ?? 0) > 0);
      let dasar = TINGGI_BIDANG;
      const potong: BatangGrafik[] = [];
      /* Dari BAWAH ke atas: lainnya dulu, freelancer terakhir. */
      [...isi].reverse().forEach((x, i) => {
        const h = Math.max(2, ((k.nilai[x.nilai] ?? 0) / maks) * 139);
        const atas = dasar - h;
        potong.push({
          atas: (atas / TINGGI_BIDANG) * 100,
          bawah: (dasar / TINGGI_BIDANG) * 100,
          radiusAtas: 2,
          radiusBawah: i === 0 ? 0 : 2,
          warna: x.warna,
        });
        dasar = atas - 4;
      });
      return { ...k, potong, puncak: dasar + 4 };
    });
  }, [tahunan]);

  /* ---- Fee per Jenis ---------------------------------------------------- */
  const orangJenis = rJenis === "semua" ? orangSemua : orangRentang;
  /* Tanpa nama TIDAK bisa diambil dari daftar per orang — ia justru yang
     tidak punya orang. Datangnya dari daftar per proyek: sepanjang waktu
     dari cache, rentang lain dari permintaannya sendiri. */
  const [tanpaNamaRentang, setTanpaNamaRentang] = useState<number | null>(null);
  useEffect(() => {
    if (rJenis === "semua") return;
    let batal = false;
    setTanpaNamaRentang(null);
    feePerProyek(batas(rJenis))
      .then((d) => !batal && setTanpaNamaRentang(d.reduce((a, p) => a + p.feeTanpaNama, 0)))
      .catch(() => !batal && setTanpaNamaRentang(0));
    return () => {
      batal = true;
    };
  }, [rJenis]);
  const tanpaNama =
    rJenis === "semua"
      ? (proyekSemua ?? []).reduce((a, p) => a + p.feeTanpaNama, 0)
      : tanpaNamaRentang ?? 0;

  const jenis = useMemo(() => {
    const per = JENIS.map((j) => ({
      kunci: j as string,
      label: LABEL_JENIS_ANGGOTA[j],
      nilai: (orangJenis ?? []).filter((o) => o.kind === j).reduce((a, o) => a + o.total, 0),
    })).filter((x) => x.nilai > 0);
    /* Yang belum bernama tetap irisan sendiri: busur yang jumlah irisannya
       tidak sama dengan angka di tengahnya adalah gambar yang berbohong. */
    if (tanpaNama > 0) per.push({ kunci: "tanpa", label: "Belum bernama", nilai: tanpaNama });
    const total = per.reduce((a, x) => a + x.nilai, 0);
    return {
      total,
      iris: per.map((x, i) => ({ ...x, warna: `var(--ramp-${i + 1})`, persen: persen(x.nilai, total) })),
    };
  }, [orangJenis, tanpaNama]);

  /* ---- Tabel ------------------------------------------------------------ */
  const dataProyek = rTabel === "semua" ? proyekSemua : proyekRentang;
  const dataOrang = rTabel === "semua" ? orangSemua : orangTabel;

  /* Lebar kolom dari jangkar tinta framenya: judul kolom di x854,5 / 1015,8
     / 1124,6 / 1219,4 / 1308,4 pada tabel 842..1396, pad sel 12,5. Jumlahnya
     554, persis kotak-dalam kartunya. */
  const kolomProyek: KolomTabel[] = [
    { judul: "Proyek", lebar: 161.3, urut: true },
    { judul: "Nilai kontrak", lebar: 108.8, urut: true },
    { judul: "Fee bernama", lebar: 94.8, urut: true, redup: true },
    { judul: "Tanpa nama", lebar: 89, urut: true, redup: true },
    { judul: "Porsi fee", lebar: 100.1, urut: true, redup: true },
  ];
  const kolomOrang: KolomTabel[] = [
    { judul: "Nama", lebar: 161.3, urut: true },
    { judul: "Jenis", lebar: 108.8, urut: true },
    { judul: "Proyek", lebar: 94.8, urut: true, redup: true },
    { judul: "Terakhir", lebar: 89, urut: true, redup: true },
    { judul: "Total", lebar: 100.1, urut: true, redup: true },
  ];

  const barisProyek = (dataProyek ?? []).map((p) => [
    <SelIkon ikon={Ruler} ukuran={30} ikonPx={14}>
      {/* Nama-namanya ikut tercetak di bawah judul proyek. Tanpa ini,
          satu-satunya cara tahu siapa yang dibayar di sebuah proyek adalah
          membuka mode per orang dan mencocokkan sendiri. */}
      <span
        className="fee__sel"
        title={p.orang.map((o) => `${o.name} (${formatRupiah(o.amount)})`).join(" · ") || undefined}
      >
        <SelDua
          besar
          atas={p.projectTitle}
          bawah={p.orang.length === 0 ? "belum ada fee bernama" : p.orang.map((o) => o.name).join(", ")}
        />
      </span>
    </SelIkon>,
    p.contractValue === null ? (
      <span className="fee__redup">belum diisi</span>
    ) : (
      <span title={formatRupiah(p.contractValue)}>{formatRupiahRingkas(p.contractValue)}</span>
    ),
    <span title={formatRupiah(p.feeTotal)}>{formatRupiahRingkas(p.feeTotal)}</span>,
    /* Amber, bukan merah: ini bukan kesalahan melainkan data lama yang
       memang belum punya kolom penautnya. */
    p.feeTanpaNama > 0 ? (
      <span
        className="fee__tanpa"
        title="Biaya fee yang belum ditautkan ke nama siapa pun — tidak ikut terhitung per orang"
      >
        {formatRupiahRingkas(p.feeTanpaNama)}
      </span>
    ) : (
      "—"
    ),
    p.feeShare === null ? (
      <span title="Nilai kontrak belum diisi, jadi porsinya belum bisa dihitung">—</span>
    ) : (
      teksPersen(p.feeShare * 100)
    ),
  ]);

  const barisOrang = (dataOrang ?? []).map((o) => [
    <SelIkon ikon={IKON_JENIS[o.kind]} ukuran={30} ikonPx={14}>
      <span className="fee__sel">
        <SelDua besar atas={o.name} bawah={o.role ?? LABEL_JENIS_ANGGOTA[o.kind]} />
      </span>
    </SelIkon>,
    LABEL_JENIS_ANGGOTA[o.kind],
    `${o.projectCount} proyek`,
    o.lastOn
      ? (() => {
          const [t, b, h] = o.lastOn.slice(0, 10).split("-").map(Number);
          return `${h} ${BULAN_PENDEK[(b ?? 1) - 1]} ${t}`;
        })()
      : "—",
    <span title={formatRupiah(o.total)}>{formatRupiahRingkas(o.total)}</span>,
  ]);

  function ekspor() {
    const tanda = new Date().toISOString().slice(0, 10);
    if (mode === "orang") {
      unduhCsv(`fee-per-orang-${tanda}.csv`, [
        ["Nama", "Jenis", "Peran", "Jumlah proyek", "Terakhir", "Total diterima"],
        ...(dataOrang ?? []).map((o) => [
          o.name,
          LABEL_JENIS_ANGGOTA[o.kind],
          o.role ?? "",
          String(o.projectCount),
          o.lastOn ?? "",
          String(o.total),
        ]),
      ]);
    } else {
      unduhCsv(`fee-per-proyek-${tanda}.csv`, [
        ["Proyek", "Nilai kontrak", "Fee bernama", "Fee tanpa nama", "Porsi fee %", "Penerima"],
        ...(dataProyek ?? []).map((p) => [
          p.projectTitle,
          p.contractValue === null ? "" : String(p.contractValue),
          String(p.feeTotal),
          String(p.feeTanpaNama),
          p.feeShare === null ? "" : (p.feeShare * 100).toFixed(2),
          p.orang.map((o) => `${o.name}:${o.amount}`).join("; "),
        ]),
      ]);
    }
  }

  if (biaya === null || orangSemua === null || proyekSemua === null) {
    return <div className="fee fee--rangka" aria-busy="true" />;
  }

  const selisihBulan = bulanan.total - bulanan.totalLalu;
  const trenBulan = bulanan.totalLalu > 0 ? (selisihBulan / bulanan.totalLalu) * 100 : null;
  const selisihTahun = tahunan.ytd - tahunan.ytdLalu;
  const trenTahun = tahunan.ytdLalu > 0 ? (selisihTahun / tahunan.ytdLalu) * 100 : null;
  const puncak = bulanan.puncak >= 0 ? bulanan.kini[bulanan.puncak]! : null;
  const tanda = (n: number) => (n >= 0 ? "+" : "−");
  const penerima = orangSemua.slice(0, 6);
  const tabelMuat = mode === "proyek" ? dataProyek === null : dataOrang === null;
  const baris = mode === "proyek" ? barisProyek : barisOrang;

  return (
    <div className="fee">
      {/* ---- Total Fee (Portfolio Value) --------------------------------- */}
      <article className="fee__w fee__bulan">
        <KepalaSeksi
          judul="Total Fee"
          kanan={<PilihTombol judul="Rentang bulan" nilai={nBulan} opsi={PILIH_BULAN} onUbah={setNBulan} />}
        />
        <div className="fee__info">
          <p className="fee__label">Fee {nBulan} bulan terakhir</p>
          <p className="fee__baris">
            <NominalBesar n={bulanan.total} />
            {trenBulan !== null && (
              /* Fee yang naik bukan kabar baik ATAU buruk — ia bisa berarti
                 proyek bertambah, bisa juga berarti biaya membengkak. Jadi
                 warnanya tetap hijau di kedua arah; yang membawa arahnya
                 ikonnya. */
              <LencanaTren naik={trenBulan >= 0} baik>
                {teksPersen(Math.abs(trenBulan))}
              </LencanaTren>
            )}
          </p>
          <p className="fee__beda">
            <b>
              {tanda(selisihBulan)}
              {formatRupiah(Math.abs(selisihBulan))}
            </b>{" "}
            dari {nBulan} bulan sebelumnya
          </p>
        </div>
        <GrafikArea
          className={[
            "fee__grafik",
            bulanan.puncak === 0 && "fee__grafik--awal",
            bulanan.puncak === bulanan.kini.length - 1 && "fee__grafik--akhir",
          ]
            .filter(Boolean)
            .join(" ")}
          bentuk="tangga"
          tinggi={174}
          ruangAtas={25.5}
          jarakLabelX={18.5}
          maks={bulanan.maks}
          labelY={[1, 0.75, 0.5, 0.25, 0].map((f) => (f === 0 ? "0" : sumbu(bulanan.maks * f)))}
          labelX={bulanan.kini.map((b) => BULAN_PENDEK[Number(b.bulan.slice(5, 7)) - 1])}
          deret={[{ titik: bulanan.kini.map((b) => b.nilai) }]}
          keterangan={(i) => {
            const b = bulanan.kini[i]!;
            return { judul: `${BULAN[Number(b.bulan.slice(5, 7)) - 1]} ${b.bulan.slice(0, 4)}`, nilai: formatRupiah(b.nilai) };
          }}
          sorot={
            puncak
              ? {
                  indeks: bulanan.puncak,
                  judul: `${BULAN[Number(puncak.bulan.slice(5, 7)) - 1]} ${puncak.bulan.slice(0, 4)}`,
                  nilai: formatRupiah(puncak.nilai),
                }
              : undefined
          }
        />
      </article>

      {/* ---- Beban per Tahun (Profits) ----------------------------------- */}
      <article className="fee__w fee__tahun">
        <KepalaSeksi
          judul="Beban per Tahun"
          kanan={<PilihTombol judul="Rentang tahun" nilai={nTahun} opsi={PILIH_TAHUN} onUbah={setNTahun} />}
        />
        <div className="fee__info fee__info--legenda">
          <div>
            <p className="fee__label">Total beban</p>
            <p className="fee__baris">
              <NominalBesar n={tahunan.total} />
              {trenTahun !== null && (
                /* Beban yang TURUN kabar baik, meski panahnya ke bawah. */
                <LencanaTren naik={trenTahun >= 0} baik={trenTahun < 0}>
                  {teksPersen(Math.abs(trenTahun))}
                </LencanaTren>
              )}
            </p>
            <p className="fee__beda">
              <b>
                {tanda(selisihTahun)}
                {formatRupiah(Math.abs(selisihTahun))}
              </b>{" "}
              dari periode sama tahun lalu
            </p>
          </div>
          <ul className="fee__legenda">
            {KATEGORI_TAHUN.map((k) => (
              <li key={k.nilai}>
                <span className="fee__kotak" style={{ background: k.warna }} />
                {k.label}
              </li>
            ))}
          </ul>
        </div>
        <div className="fee__batang" style={{ "--fee-kolom": batangTahun.length } as React.CSSProperties}>
          {batangTahun.map((k, i) => (
            <div className="fee__kolom" key={k.tahun}>
              {/* Angka tiap tahun dibaca lewat kartu saat kolomnya disentuh —
                  label di atas batang dulu menimpa batangnya sendiri begitu
                  tinggi plot mengecil di layar satu-layar. */}
              <KolomGrafik
                batang={k.potong}
                tumpuk
                lebar={69.25}
                lebarBatang={49.3}
                tinggi={TINGGI_BIDANG}
                label={k.tahun}
                className="fee__kolomgrafik"
                sisiKartu={i >= batangTahun.length / 2 ? "kiri" : "kanan"}
                keterangan={
                  k.total > 0
                    ? {
                        judul: `Beban ${k.tahun} · ${formatRupiah(k.total)}`,
                        baris: KATEGORI_TAHUN.filter((x) => (k.nilai[x.nilai] ?? 0) > 0).map((x) => ({
                          warna: x.warna,
                          label: x.label,
                          nilai: formatRupiahRingkas(k.nilai[x.nilai] ?? 0),
                        })),
                      }
                    : undefined
                }
              />
            </div>
          ))}
        </div>
      </article>

      {/* ---- Penerima Fee (Watchlist) ------------------------------------ */}
      <article className="fee__w fee__penerima">
        <KepalaSeksi
          judul="Penerima Fee"
          kanan={
            <button
              type="button"
              className="fee__tautan"
              onClick={() => {
                setMode("orang");
                tabelRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
              }}
            >
              Lihat Semua
            </button>
          }
        />
        <div className="fee__pantau">
          {penerima.map((o) => (
            <BarisPantau
              key={o.teamMemberId}
              ikon={IKON_JENIS[o.kind]}
              simbol={o.name}
              nama={o.role ?? LABEL_JENIS_ANGGOTA[o.kind]}
              nilai={<span title={formatRupiah(o.total)}>{formatRupiahRingkas(o.total)}</span>}
              /* Bentuk lencana tren 55x17 framenya, TANPA ikon arah: yang
                 dibawanya jumlah proyek, bukan kenaikan — dan panah di
                 sebelah jumlah akan terbaca sebagai tren yang tidak ada. */
              tren={<span className="k-trenlebar">{o.projectCount} proyek</span>}
            />
          ))}
          {penerima.length === 0 && (
            <p className="fee__kosong">
              Belum ada fee bernama.
            </p>
          )}
        </div>
      </article>

      {/* ---- Fee per Jenis (Assets) -------------------------------------- */}
      <article className="fee__w fee__jenis">
        <KepalaSeksi
          judul="Fee per Jenis"
          kanan={<PilihTeks judul="Rentang fee per jenis" nilai={rJenis} opsi={RENTANG} onUbah={setRJenis} />}
        />
        {orangJenis === null ? (
          <p className="fee__kosong">Memuat…</p>
        ) : jenis.total === 0 ? (
          <p className="fee__kosong">Belum ada fee pada rentang ini.</p>
        ) : (
          <>
            <Busur
              className="fee__busur"
              iris={jenis.iris.map((x) => ({ nilai: x.nilai, warna: x.warna, label: x.label, ket: formatRupiah(x.nilai) }))}
              label="Total fee"
              nilai={formatRupiahRingkas(jenis.total)}
              tanda={String((orangJenis ?? []).length)}
              ket="orang dibayar"
            />
            <hr className="fee__garis" />
            <div className={`fee__aset${jenis.iris.length > 4 ? " fee__aset--rapat" : ""}`}>
              {jenis.iris.map((x) => (
                <BarisAset
                  key={x.kunci}
                  warna={x.warna}
                  nama={x.label}
                  persen={`${Math.round(x.persen)}%`}
                  total={<span title={formatRupiah(x.nilai)}>{formatRupiahRingkas(x.nilai)}</span>}
                />
              ))}
            </div>
          </>
        )}
      </article>

      {/* ---- Fee per Proyek / per Orang (My Portfolio) -------------------- */}
      <article className="fee__w fee__tabelw" ref={tabelRef}>
        <KepalaSeksi
          judul={
            <PilihTeks
              className="fee__pilihjudul"
              judul="Tampilan tabel fee"
              nilai={mode}
              opsi={[
                { nilai: "proyek", label: "Fee per Proyek" },
                { nilai: "orang", label: "Fee per Orang" },
              ]}
              onUbah={(v) => setMode(v as Mode)}
            />
          }
          kanan={
            <>
              <PilihTombol judul="Rentang tabel" nilai={rTabel} opsi={RENTANG} onUbah={setRTabel} />
              <TombolIkon ikon={DownloadSimple} jenis="ghost" judul="Unduh CSV" onClick={ekspor} />
            </>
          }
        />
        {tabelMuat ? (
          <p className="fee__kosong">Memuat…</p>
        ) : baris.length === 0 ? (
          <p className="fee__kosong">
            {mode === "proyek"
              ? "Belum ada fee tercatat pada rentang ini. Catat pengeluaran berkategori Freelancer atau Prinsipal di Keuangan, lalu proyeknya muncul di sini."
              : "Belum ada fee bernama pada rentang ini."}
          </p>
        ) : (
          <div className="fee__tabel">
            <Tabel
              kolom={mode === "proyek" ? kolomProyek : kolomOrang}
              baris={baris}
              pad={12.5}
              tinggiKepala={39}
              tinggiBaris={61}
            />
          </div>
        )}
      </article>
    </div>
  );
}

export function FeeKit() {
  return (
    <RequireAuth skeleton={<div className="fee fee--rangka" />}>
      <Isi />
    </RequireAuth>
  );
}
