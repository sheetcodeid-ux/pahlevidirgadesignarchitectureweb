import { useEffect, useMemo, useRef, useState } from "react";
import { RequireAuth } from "./RequireAuth";
import { KepalaSeksi, BarisPantau, BarisAset } from "../kit/Item";
import { GrafikArea, Busur, LencanaTren } from "../kit/Ukuran";
import { KolomGrafik, type BatangGrafik } from "../kit/Grafik";
import { Tabel, SelDua, SelIkon, type KolomTabel } from "../kit/Tabel";
import { Tombol, TombolIkon } from "../kit/Tombol";
import { Isian } from "../kit/Isian";
import { CopySimple, DownloadSimple, Plus } from "../kit/ikon";
import { Dialog, AlertDialog } from "../ui/overlay/Dialog";
import { ToastProvider, useToast } from "../ui/overlay/Toast";
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
} from "./frame25";
import {
  gajiBulan,
  riwayatGaji,
  catatGaji,
  ubahGaji,
  hapusGaji,
  semuaBiaya,
  daftarTim,
  bacaCache,
  LABEL_JENIS_ANGGOTA,
  type BarisGajiBulan,
  type EntriGaji,
  type BiayaProyek,
  type AnggotaTim,
} from "../../lib/admin";
import { formatRupiah, formatRupiahRingkas } from "../../lib/format";
import { unduhCsv } from "../../lib/csv";

/* =============================================================================
   Gaji, mengikuti frame Figma "25. Investments" — kerangka yang SAMA dengan
   Fee Proyek, dipilih pemilik: dua halaman yang menjawab "berapa yang
   dibayarkan studio kepada orang" dari dua sisi harus terbaca sebagai satu
   keluarga.

   Aturannya tetap satu kalimat, dan dijaga di lapisan data: FEE MENULIS, GAJI
   MEMBACA. Kolom Gaji diketik di sini, hanya untuk bayaran yang TIDAK lahir
   dari proyek. Kolom Fee tidak bisa diketik di mana pun di halaman ini — ia
   dijumlahkan SQL dari biaya proyek bernama yang dicatat di Keuangan.

     Coinest            Halaman ini
     -----------------  ----------------------------------------------------
     Portfolio Value    Total Gaji — gaji per bulan sebagai grafik tangga
     Profits            Untuk Orang per Tahun — gaji dan fee bertumpuk
     Watchlist          Penerima bulan terpilih + status bayar
     Assets             Per Jenis — partner / inti / proyek / staf
     My Portfolio       Gaji bulan terpilih — tempat mencatat, menandai
                        dibayar, menyalin dari bulan lalu, dan mengekspor

   Stylesheet-nya fee-kit.css: satu frame, satu berkas gaya.
   ============================================================================= */

const PILIH_BULAN = [
  { nilai: "6", label: "6 bulan" },
  { nilai: "10", label: "10 bulan" },
  { nilai: "12", label: "12 bulan" },
];
const PILIH_TAHUN = [
  { nilai: "4", label: "4 tahun" },
  { nilai: "8", label: "8 tahun" },
];

/* Tumpukan dari ATAS ke bawah. Gaji di atas dengan rona paling pekat: ia yang
   ditanyakan halaman ini; fee ikut digambar supaya "keluar untuk orang"
   terbaca utuh tanpa pindah halaman. */
const TUMPUK = [
  { nilai: "gaji", label: "Gaji", warna: "var(--ramp-1)" },
  { nilai: "fee", label: "Fee proyek", warna: "var(--ramp-2)" },
] as const;

const kunciBulan = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const bulanIni = () => kunciBulan(new Date());

function bulanSebelum(period: string): string {
  const [y, m] = period.split("-").map(Number);
  // Date(y, m - 2) sudah benar melewati pergantian tahun.
  return kunciBulan(new Date(y!, m! - 2, 1));
}

function labelBulan(period: string): string {
  const [y, m] = period.split("-").map(Number);
  return `${BULAN[m! - 1]} ${y}`;
}

function tanggalPendek(iso: string): string {
  const [t, b, h] = iso.slice(0, 10).split("-").map(Number);
  return `${h} ${BULAN_PENDEK[(b ?? 1) - 1]} ${t}`;
}

const HARI_INI = () => new Date().toISOString().slice(0, 10);

/* Delapan belas bulan ke belakang. Gaji yang lebih tua dari itu tidak pernah
   diubah lagi; yang perlu dibaca ada di grafik dan di CSV. */
const DAFTAR_BULAN = (() => {
  const d = new Date();
  d.setDate(1);
  return Array.from({ length: 18 }, (_, i) => {
    const x = new Date(d);
    x.setMonth(d.getMonth() - i);
    const k = kunciBulan(x);
    return { nilai: k, label: labelBulan(k) };
  });
})();

function Isi() {
  const toast = useToast();
  const [riwayat, setRiwayat] = useState<EntriGaji[] | null>(null);
  /* Dibaca dari cache saja — pemilik daftar biaya adalah halaman Keuangan
     (jebakan #8: yang boleh menulis cache hanya pemilik daftarnya). */
  const [biaya, setBiaya] = useState<BiayaProyek[] | null>(() => bacaCache<BiayaProyek[]>("biaya-semua"));
  const [tim, setTim] = useState<AnggotaTim[]>([]);

  const [period, setPeriod] = useState(bulanIni());
  /* TIDAK di-cache. Isinya milik satu bulan tertentu, dan cache yang tidak
     membawa bulannya di kunci adalah cara paling mudah menampilkan angka
     bulan lalu sebagai angka bulan ini. */
  const [baris, setBaris] = useState<BarisGajiBulan[] | null>(null);
  const [bulanLalu, setBulanLalu] = useState<BarisGajiBulan[]>([]);
  const [menyalin, setMenyalin] = useState(false);

  const [nBulan, setNBulan] = useState("10");
  const [nTahun, setNTahun] = useState("4");
  const tabelRef = useRef<HTMLElement>(null);

  function muatRiwayat() {
    riwayatGaji().then(setRiwayat).catch(() => setRiwayat((l) => l ?? []));
  }
  function muatBulan() {
    gajiBulan(period).then(setBaris).catch(() => setBaris((l) => l ?? []));
    /* Diam-diam: kalau gagal, tombol salin sekadar tidak muncul. */
    gajiBulan(bulanSebelum(period)).then(setBulanLalu).catch(() => setBulanLalu([]));
  }
  function muatUlang() {
    muatBulan();
    muatRiwayat();
  }

  useEffect(() => {
    muatRiwayat();
    semuaBiaya().then(setBiaya).catch(() => setBiaya((l) => l ?? []));
    daftarTim().then(setTim).catch(() => setTim([]));
  }, []);
  useEffect(() => {
    setBaris(null);
    muatBulan();
  }, [period]);

  /* Fee di halaman ini = biaya proyek yang BERNAMA — definisi yang sama
     dengan `/payroll/month`, supaya grafik dan tabel sepakat. */
  const feeBernama = useMemo(() => (biaya ?? []).filter((b) => b.teamMemberId), [biaya]);

  /* ---- Total Gaji: gaji per bulan ------------------------------------- */
  const bulanan = useMemo(() => {
    const n = Number(nBulan);
    const kunci: string[] = [];
    const d = new Date();
    d.setDate(1);
    for (let i = 2 * n - 1; i >= 0; i--) {
      const x = new Date(d);
      x.setMonth(d.getMonth() - i);
      kunci.push(kunciBulan(x));
    }
    const jumlah = new Map(kunci.map((k) => [k, 0]));
    for (const g of riwayat ?? []) {
      const k = g.period.slice(0, 7);
      if (jumlah.has(k)) jumlah.set(k, jumlah.get(k)! + g.amount);
    }
    const semua = kunci.map((k) => ({ bulan: k, nilai: jumlah.get(k)! }));
    const kini = semua.slice(n);
    const lalu = semua.slice(0, n);
    const total = kini.reduce((a, b) => a + b.nilai, 0);
    const totalLalu = lalu.reduce((a, b) => a + b.nilai, 0);
    let puncak = -1;
    kini.forEach((b, i) => {
      if (b.nilai > 0 && (puncak < 0 || b.nilai >= kini[puncak]!.nilai)) puncak = i;
    });
    /* Puncak paling tinggi 80% sumbu — rasio framenya (31,6 rb di sumbu
       40 rb). Gaji hampir rata dari bulan ke bulan, jadi tanpa ruang kepala
       garisnya menempel di batas atas dan menimpa tooltip puncaknya. */
    const tertinggi = Math.max(0, ...kini.map((b) => b.nilai));
    return { kini, total, totalLalu, puncak, maks: bulatkan(tertinggi / 0.8) };
  }, [riwayat, nBulan]);

  /* ---- Untuk Orang per Tahun: gaji + fee ------------------------------ */
  const tahunan = useMemo(() => {
    const kini = new Date();
    const y = kini.getFullYear();
    const n = Number(nTahun);
    const tahunData = [
      ...(riwayat ?? []).map((g) => Number(g.period.slice(0, 4))),
      ...feeBernama.map((b) => Number(b.incurredOn.slice(0, 4))),
    ].filter(Boolean);
    const pertama = tahunData.length ? Math.min(...tahunData) : y;
    /* Paling sedikit empat kolom — alasan yang sama dengan Fee Proyek. */
    const mulai = Math.min(y - 3, Math.max(y - n + 1, pertama));
    const daftar = Array.from({ length: y - mulai + 1 }, (_, i) => mulai + i);
    const per = new Map(daftar.map((t) => [t, { gaji: 0, fee: 0 } as Record<string, number>]));
    /* Pembanding pada PERIODE YANG SAMA tahun lalu, bukan setahun penuh. */
    const bulanKini = kini.getMonth() + 1;
    const hariIni = kini.toISOString().slice(5, 10);
    let ytd = 0;
    let ytdLalu = 0;
    for (const g of riwayat ?? []) {
      const t = Number(g.period.slice(0, 4));
      const b = Number(g.period.slice(5, 7));
      const k = per.get(t);
      if (k) k.gaji! += g.amount;
      if (t === y) ytd += g.amount;
      if (t === y - 1 && b <= bulanKini) ytdLalu += g.amount;
    }
    for (const f of feeBernama) {
      const t = Number(f.incurredOn.slice(0, 4));
      const k = per.get(t);
      if (k) k.fee! += f.amount;
      if (t === y) ytd += f.amount;
      if (t === y - 1 && f.incurredOn.slice(5, 10) <= hariIni) ytdLalu += f.amount;
    }
    const kolom = daftar.map((t) => {
      const v = per.get(t)!;
      return { tahun: t, nilai: v, total: v.gaji! + v.fee! };
    });
    return { kolom, total: kolom.reduce((a, k) => a + k.total, 0), ytd, ytdLalu };
  }, [riwayat, feeBernama, nTahun]);

  /* Geometri tumpukan sama dengan Fee Proyek: puncak 139 dari bidang 174,
     celah 4 di atas nilai, bukan dipotong darinya. */
  const TINGGI_BIDANG = 174;
  const batangTahun = useMemo(() => {
    const maks = Math.max(1, ...tahunan.kolom.map((k) => k.total));
    return tahunan.kolom.map((k) => {
      const isi = TUMPUK.filter((x) => (k.nilai[x.nilai] ?? 0) > 0);
      let dasar = TINGGI_BIDANG;
      const potong: BatangGrafik[] = [];
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

  /* ---- Bulan terpilih ---------------------------------------------------- */
  const ringkas = useMemo(() => {
    const d = baris ?? [];
    return {
      gaji: d.reduce((a, b) => a + (b.salaryAmount ?? 0), 0),
      fee: d.reduce((a, b) => a + b.feeAmount, 0),
      total: d.reduce((a, b) => a + b.total, 0),
      belum: d.filter((b) => b.salaryId && !b.salaryPaidOn).length,
    };
  }, [baris]);

  const jenis = useMemo(() => {
    const per = JENIS.map((j) => ({
      kunci: j as string,
      label: LABEL_JENIS_ANGGOTA[j],
      nilai: (baris ?? []).filter((o) => o.kind === j).reduce((a, o) => a + o.total, 0),
    })).filter((x) => x.nilai > 0);
    const total = per.reduce((a, x) => a + x.nilai, 0);
    return {
      total,
      iris: per.map((x, i) => ({ ...x, warna: `var(--ramp-${i + 1})`, persen: persen(x.nilai, total) })),
    };
  }, [baris]);

  /* Yang disalin HANYA nominalnya, dan selalu sebagai BELUM DIBAYAR — menyalin
     tanggal bayar bulan lalu berarti menandai gaji bulan ini lunas padahal
     uangnya belum keluar. Orang yang bulan ini sudah punya baris dilewati,
     bukan ditimpa. */
  const bisaDisalin = bulanLalu.filter(
    (l) => l.salaryId && !baris?.some((b) => b.teamMemberId === l.teamMemberId && b.salaryId),
  );

  async function salinBulanLalu() {
    if (bisaDisalin.length === 0) return;
    setMenyalin(true);
    let berhasil = 0;
    const gagal: string[] = [];
    for (const l of bisaDisalin) {
      try {
        await catatGaji({
          teamMemberId: l.teamMemberId,
          period,
          amount: l.salaryAmount as number,
          paidOn: null,
          note: l.salaryNote ?? null,
        });
        berhasil++;
      } catch (e) {
        gagal.push(`${l.name}: ${(e as Error).message}`);
      }
    }
    setMenyalin(false);
    muatUlang();
    /* Dilaporkan apa adanya, termasuk yang gagal. */
    if (gagal.length === 0) {
      toast({ judul: `${berhasil} gaji disalin`, keterangan: "Semuanya ditandai belum dibayar.", nada: "sukses" });
    } else {
      toast({ judul: `${berhasil} tersalin, ${gagal.length} gagal`, keterangan: gagal.join("; "), nada: "gagal" });
    }
  }

  async function tandaiDibayar(b: BarisGajiBulan, dibayar: boolean) {
    if (!b.salaryId || !baris) return;
    const sebelum = baris;
    const tgl = dibayar ? HARI_INI() : null;
    setBaris(baris.map((x) => (x.salaryId === b.salaryId ? { ...x, salaryPaidOn: tgl } : x)));
    try {
      await ubahGaji(b.salaryId, { paidOn: tgl });
      muatRiwayat();
    } catch (e) {
      setBaris(sebelum);
      toast({ judul: "Gagal mengubah status", keterangan: (e as Error).message, nada: "gagal" });
    }
  }

  function ekspor() {
    unduhCsv(`gaji-${period}.csv`, [
      ["Nama", "Jenis", "Peran", "Gaji", "Fee bulan ini", "Total", "Dibayar pada", "Catatan"],
      ...(baris ?? []).map((b) => [
        b.name,
        LABEL_JENIS_ANGGOTA[b.kind],
        b.role ?? "",
        b.salaryAmount === null || b.salaryAmount === undefined ? "" : String(b.salaryAmount),
        String(b.feeAmount),
        String(b.total),
        b.salaryPaidOn ?? "",
        b.salaryNote ?? "",
      ]),
    ]);
  }

  /* Lebar kolom dari jangkar tinta framenya — sama dengan tabel Fee. */
  const kolom: KolomTabel[] = [
    { judul: "Nama", lebar: 161.3 },
    { judul: "Gaji", lebar: 108.8 },
    { judul: "Fee", lebar: 94.8, redup: true },
    { judul: "Total", lebar: 89 },
    { judul: "Status", lebar: 100.1 },
  ];

  const barisTabel = (baris ?? []).map((b) => [
    <SelIkon ikon={IKON_JENIS[b.kind]} ukuran={30} ikonPx={14}>
      {/* Nama = tombol ubah. Tabel kit tidak punya aksi per baris, dan satu
          kolom ikon pensil untuk tiap orang memakan ruang yang frame ini
          berikan ke angka. */}
      <DialogGaji
        tim={tim}
        period={period}
        awal={b}
        onSelesai={muatUlang}
        pemicu={
          <button type="button" className="fee__sel gaji__nama" title={`Ubah gaji ${b.name}`}>
            <SelDua besar atas={b.name} bawah={b.role ?? LABEL_JENIS_ANGGOTA[b.kind]} />
          </button>
        }
      />
    </SelIkon>,
    b.salaryAmount === null || b.salaryAmount === undefined ? (
      <span className="fee__redup">—</span>
    ) : (
      <span title={formatRupiah(b.salaryAmount)}>{formatRupiahRingkas(b.salaryAmount)}</span>
    ),
    b.feeAmount === 0 ? (
      "—"
    ) : (
      /* Tidak bisa diketik di sini; judulnya menjawab "kenapa" di tempat
         pertanyaan itu muncul. */
      <span title={`Dari ${b.feeCount} biaya proyek bulan ini. Diubah di Keuangan, bukan di sini.`}>
        {formatRupiahRingkas(b.feeAmount)}
      </span>
    ),
    <b title={formatRupiah(b.total)}>{formatRupiahRingkas(b.total)}</b>,
    /* Yang cuma dapat fee TIDAK punya status bayar: fee proyek sudah uang
       yang keluar saat dicatat, bukan janji yang menunggu dibayar. */
    !b.salaryId ? (
      <span className="k-trenlebar k-trenlebar--netral">fee saja</span>
    ) : b.salaryPaidOn ? (
      <button
        type="button"
        className="gaji__status"
        title={`Dibayar ${tanggalPendek(b.salaryPaidOn)}. Klik untuk membatalkan tanda.`}
        onClick={() => tandaiDibayar(b, false)}
      >
        <span className="k-trenlebar">Dibayar {tanggalPendek(b.salaryPaidOn).replace(/ \d{4}$/, "")}</span>
      </button>
    ) : (
      <button
        type="button"
        className="gaji__status"
        title="Klik untuk menandai sudah dibayar hari ini"
        onClick={() => tandaiDibayar(b, true)}
      >
        <span className="k-trenlebar k-trenlebar--tunggu">Tandai dibayar</span>
      </button>
    ),
  ]);

  if (riwayat === null || biaya === null) {
    return <div className="fee fee--rangka" aria-busy="true" />;
  }

  const selisihBulan = bulanan.total - bulanan.totalLalu;
  const trenBulan = bulanan.totalLalu > 0 ? (selisihBulan / bulanan.totalLalu) * 100 : null;
  const selisihTahun = tahunan.ytd - tahunan.ytdLalu;
  const trenTahun = tahunan.ytdLalu > 0 ? (selisihTahun / tahunan.ytdLalu) * 100 : null;
  const puncak = bulanan.puncak >= 0 ? bulanan.kini[bulanan.puncak]! : null;
  const tanda = (n: number) => (n >= 0 ? "+" : "−");
  const penerima = [...(baris ?? [])].sort((a, z) => z.total - a.total).slice(0, 6);
  const namaBulan = labelBulan(period);

  return (
    <div className="fee">
      {/* ---- Total Gaji (Portfolio Value) -------------------------------- */}
      <article className="fee__w fee__bulan">
        <KepalaSeksi
          judul="Total Gaji"
          kanan={<PilihTombol judul="Rentang bulan" nilai={nBulan} opsi={PILIH_BULAN} onUbah={setNBulan} />}
        />
        <div className="fee__info">
          <p className="fee__label">Gaji {nBulan} bulan terakhir</p>
          <p className="fee__baris">
            <NominalBesar n={bulanan.total} />
            {trenBulan !== null && (
              /* Gaji yang naik bukan kabar buruk: orang yang sama dibayar
                 lebih wajar. Hijau di kedua arah; ikonnya yang membawa arah. */
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
          labelX={bulanan.kini.map((b) => BULAN_PENDEK[Number(b.bulan.slice(5, 7)) - 1]!)}
          deret={[{ titik: bulanan.kini.map((b) => b.nilai) }]}
          sorot={
            puncak
              ? {
                  indeks: bulanan.puncak,
                  judul: labelBulan(puncak.bulan),
                  nilai: formatRupiah(puncak.nilai),
                }
              : undefined
          }
        />
      </article>

      {/* ---- Untuk Orang per Tahun (Profits) ----------------------------- */}
      <article className="fee__w fee__tahun">
        <KepalaSeksi
          judul="Untuk Orang per Tahun"
          kanan={<PilihTombol judul="Rentang tahun" nilai={nTahun} opsi={PILIH_TAHUN} onUbah={setNTahun} />}
        />
        <div className="fee__info fee__info--legenda">
          <div>
            <p className="fee__label">Gaji dan fee</p>
            <p className="fee__baris">
              <NominalBesar n={tahunan.total} />
              {trenTahun !== null && (
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
            {TUMPUK.map((k) => (
              <li key={k.nilai}>
                <span className="fee__kotak" style={{ background: k.warna }} />
                {k.label}
              </li>
            ))}
          </ul>
        </div>
        <div className="fee__batang" style={{ "--fee-kolom": batangTahun.length } as React.CSSProperties}>
          {batangTahun.map((k) => (
            <div className="fee__kolom" key={k.tahun}>
              {k.total > 0 && (
                <span className="fee__nilaibatang" style={{ top: `${k.puncak}px` }} title={formatRupiah(k.total)}>
                  {formatRupiahRingkas(k.total)}
                </span>
              )}
              <KolomGrafik
                batang={k.potong}
                tumpuk
                lebar={69.25}
                lebarBatang={49.3}
                tinggi={TINGGI_BIDANG}
                label={k.tahun}
                className="fee__kolomgrafik"
              />
            </div>
          ))}
        </div>
      </article>

      {/* ---- Penerima bulan terpilih (Watchlist) ------------------------- */}
      <article className="fee__w fee__penerima">
        <KepalaSeksi
          judul={`Penerima ${BULAN[Number(period.slice(5, 7)) - 1]}`}
          kanan={
            <button
              type="button"
              className="fee__tautan"
              onClick={() => tabelRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" })}
            >
              Lihat Semua
            </button>
          }
        />
        <div className="fee__pantau">
          {baris === null ? (
            <p className="fee__kosong">Memuat…</p>
          ) : (
            penerima.map((o) => (
              <BarisPantau
                key={o.teamMemberId}
                ikon={IKON_JENIS[o.kind]}
                simbol={o.name}
                nama={o.role ?? LABEL_JENIS_ANGGOTA[o.kind]}
                nilai={<span title={formatRupiah(o.total)}>{formatRupiahRingkas(o.total)}</span>}
                tren={
                  !o.salaryId ? (
                    <span className="k-trenlebar k-trenlebar--netral">fee saja</span>
                  ) : o.salaryPaidOn ? (
                    <span className="k-trenlebar">dibayar</span>
                  ) : (
                    <span className="k-trenlebar k-trenlebar--tunggu">belum</span>
                  )
                }
              />
            ))
          )}
          {baris !== null && penerima.length === 0 && (
            <p className="fee__kosong">
              Belum ada gaji atau fee di {namaBulan}. Tekan tombol tambah di tabel untuk mencatat gaji bulanan.
            </p>
          )}
        </div>
      </article>

      {/* ---- Per Jenis (Assets) ------------------------------------------ */}
      <article className="fee__w fee__jenis">
        <KepalaSeksi judul="Per Jenis" kanan={<span className="fee__ketkepala">{namaBulan}</span>} />
        {baris === null ? (
          <p className="fee__kosong">Memuat…</p>
        ) : jenis.total === 0 ? (
          <p className="fee__kosong">Belum ada yang dibayar di {namaBulan}.</p>
        ) : (
          <>
            <Busur
              className="fee__busur"
              iris={jenis.iris.map((x) => ({ nilai: x.nilai, warna: x.warna, label: x.label }))}
              label="Keluar untuk orang"
              nilai={formatRupiahRingkas(jenis.total)}
              tanda={String((baris ?? []).length)}
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

      {/* ---- Gaji bulan terpilih (My Portfolio) -------------------------- */}
      <article className="fee__w fee__tabelw" ref={tabelRef}>
        <KepalaSeksi
          judul="Gaji Bulanan"
          kanan={
            <>
              <PilihTombol judul="Bulan" nilai={period} opsi={DAFTAR_BULAN} onUbah={setPeriod} />
              {/* Muncul HANYA kalau ada yang bisa disalin: tombol yang sering
                  tidak melakukan apa-apa mengajari staf mengabaikannya. */}
              {bisaDisalin.length > 0 && (
                <TombolIkon
                  ikon={CopySimple}
                  jenis="ghost"
                  judul={`Salin ${bisaDisalin.length} gaji dari ${labelBulan(bulanSebelum(period))}, semuanya sebagai belum dibayar`}
                  disabled={menyalin}
                  onClick={salinBulanLalu}
                />
              )}
              <DialogGaji
                tim={tim}
                period={period}
                onSelesai={muatUlang}
                pemicu={<TombolIkon ikon={Plus} jenis="ghost" judul={`Catat gaji ${namaBulan}`} />}
              />
              <TombolIkon ikon={DownloadSimple} jenis="ghost" judul="Unduh CSV" onClick={ekspor} />
            </>
          }
        />
        {baris === null ? (
          <p className="fee__kosong">Memuat…</p>
        ) : barisTabel.length === 0 ? (
          <p className="fee__kosong">
            Belum ada gaji atau fee di {namaBulan}. Tombol tambah mencatat gaji bulanan; fee freelancer tidak
            diketik di sini — ia muncul sendiri dari pengeluaran proyek yang dicatat di Keuangan.
          </p>
        ) : (
          <>
            <div className="fee__tabel">
              <Tabel kolom={kolom} baris={barisTabel} pad={12.5} tinggiKepala={39} tinggiBaris={61} />
            </div>
            <p className="gaji__jumlah">
              <span>
                Gaji <b>{formatRupiah(ringkas.gaji)}</b>
              </span>
              <span>
                Fee <b>{formatRupiah(ringkas.fee)}</b>
              </span>
              <span>
                Total <b>{formatRupiah(ringkas.total)}</b>
              </span>
              <span className={ringkas.belum > 0 ? "gaji__belum" : undefined}>
                {ringkas.belum > 0 ? `${ringkas.belum} gaji belum dibayar` : "semua gaji sudah dibayar"}
              </span>
            </p>
          </>
        )}
      </article>
    </div>
  );
}

/* ── Dialog catat / ubah gaji ────────────────────────────────────────────
 * Satu dialog untuk dua hal, dan hapus tinggal di dalamnya: tabel kit tidak
 * punya kolom aksi, jadi nama orang di tabel adalah pintunya. */
function DialogGaji({
  tim,
  period,
  awal,
  pemicu,
  onSelesai,
}: {
  tim: AnggotaTim[];
  period: string;
  awal?: BarisGajiBulan;
  pemicu: React.ReactNode;
  onSelesai: () => void;
}) {
  const toast = useToast();
  const [buka, setBuka] = useState(false);
  const [orang, setOrang] = useState("");
  const [nominal, setNominal] = useState<number | null>(null);
  const [dibayar, setDibayar] = useState("");
  const [catatan, setCatatan] = useState("");
  const [kirim, setKirim] = useState(false);

  const ubah = Boolean(awal?.salaryId);
  const alasan = !orang ? "Pilih orangnya dulu." : !nominal || nominal <= 0 ? "Isi nominal gajinya." : null;

  /* Nilai awal disetel ulang tiap dialog dibuka: komponennya tetap hidup di
     antara pembukaan, jadi tanpa ini isian membawa sisa ketikan yang batal. */
  function saatBuka(b: boolean) {
    setBuka(b);
    if (b) {
      setOrang(awal?.teamMemberId ?? "");
      setNominal(awal?.salaryAmount ?? null);
      setDibayar(awal?.salaryPaidOn ?? "");
      setCatatan(awal?.salaryNote ?? "");
    }
  }

  /* Freelancer dibayar per proyek. Tidak disaring — seorang freelancer inti
     bisa saja diberi retainer — tapi diingatkan. */
  const jenisTerpilih = tim.find((t) => t.id === orang)?.kind;
  const perluIngat = jenisTerpilih === "proyek" || jenisTerpilih === "inti";

  async function simpan() {
    if (alasan) return;
    setKirim(true);
    try {
      if (ubah && awal?.salaryId) {
        await ubahGaji(awal.salaryId, { amount: nominal as number, paidOn: dibayar || null, note: catatan.trim() || null });
      } else {
        await catatGaji({
          teamMemberId: orang,
          period,
          amount: nominal as number,
          paidOn: dibayar || null,
          note: catatan.trim() || null,
        });
      }
      setBuka(false);
      onSelesai();
      toast({ judul: ubah ? "Gaji diperbarui" : "Gaji tercatat", nada: "sukses" });
    } catch (e) {
      toast({ judul: "Gagal menyimpan", keterangan: (e as Error).message, nada: "gagal" });
    } finally {
      setKirim(false);
    }
  }

  async function hapus() {
    if (!awal?.salaryId) return;
    try {
      await hapusGaji(awal.salaryId);
      setBuka(false);
      onSelesai();
      toast({ judul: "Baris gaji dihapus", nada: "sukses" });
    } catch (e) {
      toast({ judul: "Gagal menghapus", keterangan: (e as Error).message, nada: "gagal" });
    }
  }

  return (
    <Dialog
      open={buka}
      onOpenChange={saatBuka}
      title={awal ? (ubah ? `Ubah gaji ${awal.name}` : `Catat gaji ${awal.name}`) : "Catat gaji"}
      description={`Gaji operasional ${labelBulan(period)}. Bayaran per proyek dicatat di Keuangan.`}
      trigger={pemicu}
      footer={
        <div className="gaji__kaki">
          {ubah && (
            <AlertDialog
              destructive
              title="Hapus baris gaji ini?"
              description={`${awal!.name} — ${labelBulan(period)}. Fee proyeknya tidak ikut terhapus; yang hilang cuma gaji bulan ini.`}
              confirmLabel="Ya, hapus"
              onConfirm={hapus}
              trigger={
                <button type="button" className="pas__hapus">
                  Hapus gaji
                </button>
              }
            />
          )}
          {alasan && <small className="gaji__alasan">{alasan}</small>}
          <Tombol ukuran="large" jenis="primary" disabled={Boolean(alasan) || kirim} onClick={simpan}>
            {kirim ? "Menyimpan…" : "Simpan"}
          </Tombol>
        </div>
      }
    >
      <div className="gaji__form">
        {/* Bentuk .k-isian kit, dengan <select> asli di dalam kotaknya —
            perilaku pilihan bawaan tidak bisa rusak diam-diam. */}
        <div className="k-isian">
          <label className="k-isian__label" htmlFor="gj-orang">
            Orang
          </label>
          <div className="k-isian__kotak">
            <select
              id="gj-orang"
              className="k-isian__input"
              value={orang}
              /* Saat mengubah, orangnya dikunci: memindahkan baris ke nama
                 lain bisa menabrak baris yang sudah ada di bulan itu. */
              disabled={Boolean(awal)}
              onChange={(e) => setOrang(e.currentTarget.value)}
            >
              <option value="">Pilih orang…</option>
              {tim
                .filter((t) => t.active || t.id === orang)
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.role ? `${t.name} — ${t.role}` : t.name}
                  </option>
                ))}
            </select>
          </div>
          {perluIngat && !ubah && (
            <p className="k-isian__bantu">
              Orang ini freelancer. Bayaran yang lahir dari proyek dicatat di Keuangan → Catat Pengeluaran dan muncul
              sendiri di kolom Fee. Isi di sini hanya kalau ia memang digaji bulanan di luar proyek.
            </p>
          )}
        </div>
        <div className="gaji__dua">
          <Isian
            label="Nominal (Rp)"
            inputMode="numeric"
            placeholder="0"
            value={nominal === null ? "" : nominal.toLocaleString("id-ID")}
            onChange={(e) => {
              const angka = e.currentTarget.value.replace(/\D/g, "");
              setNominal(angka ? Number(angka) : null);
            }}
          />
          <Isian
            label="Dibayar pada"
            type="date"
            bantu="Kosongkan kalau belum dibayar."
            value={dibayar}
            onChange={(e) => setDibayar(e.currentTarget.value)}
          />
        </div>
        <Isian
          label="Catatan"
          maxLength={400}
          placeholder="Opsional — mis. termasuk tunjangan transport"
          value={catatan}
          onChange={(e) => setCatatan(e.currentTarget.value)}
        />
      </div>
    </Dialog>
  );
}

export function GajiKit() {
  return (
    <RequireAuth skeleton={<div className="fee fee--rangka" />}>
      <ToastProvider>
        <Isi />
      </ToastProvider>
    </RequireAuth>
  );
}
