import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { RequireAuth } from "./RequireAuth";
import { TombolIkon } from "../kit/Tombol";
import { DropdownMenu } from "../kit/Overlay";
import { PilihMenu } from "../kit/Formulir";
import { Ikon } from "../kit/Ikon";
import { ArrowRight, CaretDown, Check, DownloadSimple, Hourglass, WarningOctagon } from "../kit/ikon";
import { Keterangan, pemberiKet, type KabarKartu } from "../kit/kartuGrafik";
import { BULAN, BULAN_PENDEK, JENIS, IKON_JENIS, PilihTombol, teksPersen } from "./frame25";
import {
  feePerProyek,
  feePerOrang,
  semuaBiaya,
  daftarBiaya,
  daftarTimProyek,
  bacaCache,
  tulisCache,
  LABEL_JENIS_ANGGOTA,
  LABEL_PERAN,
  type FeeProyek,
  type FeeOrang,
  type BiayaProyek,
  type PenugasanTim,
  type JenisAnggota,
} from "../../lib/admin";
import { formatRupiah } from "../../lib/format";
import { unduhCsv } from "../../lib/csv";

/* =============================================================================
   Fee Proyek — LEMARI LACI GAMBAR.

   Benda dunia nyatanya lemari gambar (plan chest) di studio: laci lebar yang
   dangkal, satu laci per proyek, dengan tempat label berbingkai di mukanya.
   Halaman ini menjawab "proyek ini mengeluarkan fee berapa, ke siapa, dan
   berapa bagian dari kontraknya" — jadi bentuknya laci PER PROYEK. Gaji sudah
   menjawab per bulan (buku), Bayaran Tim per orang (amplop), Aturan Fee
   aturannya (aliran); tiga bentuk itu sengaja tidak dipakai di sini.

     Kop lemari        jumlah fee keluar pada rentang + pita 12 bulan
     Muka laci         label berbingkai (nomor laci, proyek, kontrak),
                       pegangan, MISTAR porsi fee terhadap kontrak yang
                       dipotong per penerima, dan jumlah fee
     Laci ditarik      isinya: map per penerima (peran, diterima, tahap
                       bayar), map amber untuk fee tanpa nama, dan kartu
                       catatan (kontrak, hak tim, jatuh tempo)
     Rak kartu         penerima fee per jenis, kartu menyembul dari
                       kantongnya; bilah porsi tiap jenis di kepala rak

   Menyentuh satu laci menarik kartu orang-orangnya dari rak; menyentuh satu
   kartu menandai laci-laci tempat orang itu dibayar. Dua arah, tetikus saja.

   Halaman ini TIDAK PERNAH MENULIS apa pun. Fee diketik satu kali saja, di
   Keuangan → Catat Pengeluaran atau tombol Bayar di Satu Proyek, dan di sini
   cuma dibaca — aturan yang menjaga beban studio tidak tercatat dua kali.
   Yang DIANGGAP fee sama dengan repository/fee.ts: biaya berkategori
   freelancer atau prinsipal.
   ============================================================================= */

const KATEGORI_FEE = new Set(["freelancer", "prinsipal"]);

const RENTANG = [
  { nilai: "semua", label: "Sepanjang waktu" },
  { nilai: "tahun", label: "Tahun ini" },
  { nilai: "bulan", label: "Bulan ini" },
];
const URUT = [
  { nilai: "fee", label: "Fee terbesar" },
  { nilai: "porsi", label: "Porsi terbesar" },
  { nilai: "nama", label: "Nama proyek" },
];

function batas(r: string): { dari?: string; sampai?: string } {
  const kini = new Date();
  const y = kini.getFullYear();
  if (r === "tahun") return { dari: `${y}-01-01`, sampai: `${y}-12-31` };
  if (r === "bulan") {
    const m = String(kini.getMonth() + 1).padStart(2, "0");
    // Hari terakhir bulan ini: tanggal 0 bulan BERIKUTNYA.
    const akhir = new Date(y, kini.getMonth() + 1, 0).getDate();
    return { dari: `${y}-${m}-01`, sampai: `${y}-${m}-${akhir}` };
  }
  return {};
}

function dalamRentang(tgl: string, r: string): boolean {
  const { dari, sampai } = batas(r);
  return (!dari || tgl >= dari) && (!sampai || tgl <= sampai);
}

function tanggalPendek(iso: string, tahun = false): string {
  const [t, b, h] = iso.slice(0, 10).split("-").map(Number);
  return `${h} ${BULAN_PENDEK[(b ?? 1) - 1]}${tahun ? ` ${t}` : ""}`;
}

/* Satu warna per JENIS penerima — di muka laci yang hijau tua dan di rak.
   Warnanya hidup sebagai token `--lmr-<jenis>` di lemari-kit.css, satu tangga
   terang di atas bidang uang (yang tidak ikut berbalik tema). */
const WARNA_JENIS = (j: JenisAnggota | "tanpa") => `var(--lmr-${j})`;

const pakaiGerak = () =>
  typeof window !== "undefined" && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Isi satu laci — diambil saat laci ditarik (atau saat kursor mendekatinya). */
interface IsiLaci {
  tim: PenugasanTim[];
  biaya: BiayaProyek[];
}

/** Satu map di dalam laci: satu penerima di satu proyek. */
interface Map_ {
  id: string;
  nama: string;
  jenis: JenisAnggota;
  diterima: number;
  kali: number;
  terakhir: string | null;
  tugas: PenugasanTim[];
}

/* Sorotan dua arah antara laci dan rak. */
type Sorot = { laci: string } | { orang: string } | null;

function Isi() {
  const kabar: KabarKartu = useRef(null);
  const ket = pemberiKet(kabar);

  const [biaya, setBiaya] = useState<BiayaProyek[] | null>(() => bacaCache<BiayaProyek[]>("biaya-semua"));
  const [orangSemua, setOrangSemua] = useState<FeeOrang[] | null>(() => bacaCache<FeeOrang[]>("feeorang"));
  const [proyekSemua, setProyekSemua] = useState<FeeProyek[] | null>(() => bacaCache<FeeProyek[]>("feeproyek"));
  const [galat, setGalat] = useState(false);

  const [rentang, setRentang] = useState("semua");
  const [urut, setUrut] = useState("fee");
  /* Hasil rentang selain "semua" TIDAK pernah di-cache: angka sebulan yang
     tersimpan di bawah kunci sepanjang-waktu akan tampil sebagai angka
     sepanjang waktu pada kunjungan berikutnya. */
  const [proyekRentang, setProyekRentang] = useState<FeeProyek[] | null>(null);
  const [orangRentang, setOrangRentang] = useState<FeeOrang[] | null>(null);

  /* undefined = belum dipilih (laci pertama dibuka begitu daftarnya ada);
     null = semua laci tertutup. */
  const [buka, setBuka] = useState<string | null | undefined>(() => {
    if (typeof window === "undefined") return undefined;
    return new URLSearchParams(location.search).get("laci") ?? undefined;
  });
  const [isi, setIsi] = useState<Record<string, IsiLaci | "galat">>({});
  const meminta = useRef(new Set<string>());
  const [sorot, setSorot] = useState<Sorot>(null);
  const [sematan, setSematan] = useState<string | null>(null);
  /* Laci yang BARU ditarik: map di dalamnya meletak satu per satu. Hanya
     sekali per tarikan — menggambar ulang tidak mengulang geraknya. */
  const [baruDitarik, setBaruDitarik] = useState<string | null>(null);

  const lemariRef = useRef<HTMLDivElement>(null);

  function muat() {
    setGalat(false);
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
      .catch(() => {
        setOrangSemua((l) => l ?? []);
        setGalat(true);
      });
    feePerProyek()
      .then((d) => {
        tulisCache("feeproyek", d);
        setProyekSemua(d);
      })
      .catch(() => {
        setProyekSemua((l) => l ?? []);
        setGalat(true);
      });
  }
  useEffect(muat, []);

  useEffect(() => {
    if (rentang === "semua") return;
    let batal = false;
    setProyekRentang(null);
    setOrangRentang(null);
    feePerProyek(batas(rentang))
      .then((d) => !batal && setProyekRentang(d))
      .catch(() => !batal && setProyekRentang([]));
    feePerOrang(batas(rentang))
      .then((d) => !batal && setOrangRentang(d))
      .catch(() => !batal && setOrangRentang([]));
    return () => {
      batal = true;
    };
  }, [rentang]);

  const proyek = rentang === "semua" ? proyekSemua : proyekRentang;
  const orang = rentang === "semua" ? orangSemua : orangRentang;

  /* Jenis tiap orang — dari daftar SEPANJANG WAKTU, supaya orang yang belum
     dibayar di rentang ini tetap berwarna benar di dalam laci. */
  const jenisOrang = useMemo(() => {
    const m = new Map<string, JenisAnggota>();
    for (const o of orangSemua ?? []) m.set(o.teamMemberId, o.kind);
    for (const p of proyekSemua ?? []) for (const o of p.orang) m.set(o.teamMemberId, o.kind);
    return m;
  }, [orangSemua, proyekSemua]);

  /* ---- Laci-laci -------------------------------------------------------- */
  const laci = useMemo(() => {
    const d = [...(proyek ?? [])];
    const keluar = (p: FeeProyek) => p.feeTotal + p.feeTanpaNama;
    const porsi = (p: FeeProyek) => (p.contractValue ? keluar(p) / p.contractValue : -1);
    if (urut === "porsi") d.sort((a, z) => porsi(z) - porsi(a));
    else if (urut === "nama") d.sort((a, z) => a.projectTitle.localeCompare(z.projectTitle, "id"));
    else d.sort((a, z) => keluar(z) - keluar(a));
    return d;
  }, [proyek, urut]);

  /* Nomor laci MENGIKUTI PROYEK, bukan urutan tampil: laci Kedai Kopi tetap
     "Laci 02" walau urutannya diganti — persis lemari sungguhan, yang lacinya
     tidak berpindah tempat saat orang mencari dengan cara lain. */
  const nomorLaci = useMemo(() => {
    const m = new Map<string, number>();
    [...(proyekSemua ?? [])]
      .sort((a, z) => z.feeTotal + z.feeTanpaNama - (a.feeTotal + a.feeTanpaNama))
      .forEach((p, i) => m.set(p.projectId, i + 1));
    let n = m.size;
    for (const p of laci) if (!m.has(p.projectId)) m.set(p.projectId, ++n);
    return m;
  }, [proyekSemua, laci]);

  /* Laci pertama dibuka begitu daftarnya ada — halaman tidak dibuka sebagai
     lemari tertutup yang belum bercerita apa-apa. */
  useEffect(() => {
    if (buka === undefined && laci.length > 0) setBuka(laci[0]!.projectId);
    if (typeof buka === "string" && proyek && laci.length > 0 && !laci.some((p) => p.projectId === buka)) {
      setBuka(laci[0]!.projectId);
    }
  }, [buka, laci, proyek]);

  function ambilIsi(id: string, paksa = false) {
    if (!paksa && meminta.current.has(id)) return;
    meminta.current.add(id);
    Promise.all([daftarTimProyek(id), daftarBiaya(id)])
      .then(([tim, b]) => setIsi((l) => ({ ...l, [id]: { tim, biaya: b.filter((x) => x.projectId === id) } })))
      .catch(() => {
        meminta.current.delete(id);
        setIsi((l) => ({ ...l, [id]: "galat" }));
      });
  }
  useEffect(() => {
    if (typeof buka === "string") ambilIsi(buka);
  }, [buka]);

  function tarik(id: string) {
    const baru = buka === id ? null : id;
    setBuka(baru);
    setBaruDitarik(baru);
    kabar.current?.(null);
    const u = new URL(location.href);
    if (baru) u.searchParams.set("laci", baru);
    else u.searchParams.delete("laci");
    history.replaceState(history.state, "", u);
  }

  /* Ruang tegak untuk isi laci yang terbuka: sisa tinggi lemari sesudah
     semua muka laci. Diukur sekali per perubahan ukuran — bukan di handler
     gulir (jebakan #21). */
  useEffect(() => {
    const el = lemariRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => el.style.setProperty("--lmr-ruang", `${el.clientHeight}px`));
    ro.observe(el);
    return () => ro.disconnect();
  }, [proyek === null]);

  /* Panah atas/bawah, Home/End berpindah antar-muka laci. */
  function tombolLaci(e: React.KeyboardEvent, i: number) {
    const tujuan =
      e.key === "ArrowDown" ? i + 1 : e.key === "ArrowUp" ? i - 1 : e.key === "Home" ? 0 : e.key === "End" ? laci.length - 1 : null;
    if (tujuan === null) {
      if (e.key === "Escape" && buka) {
        e.preventDefault();
        tarik(buka);
      }
      return;
    }
    e.preventDefault();
    const n = Math.max(0, Math.min(laci.length - 1, tujuan));
    lemariRef.current?.querySelectorAll<HTMLButtonElement>(".lmr__muka")[n]?.focus();
  }

  /* ---- Pita 12 bulan ---------------------------------------------------- */
  const bulanan = useMemo(() => {
    const kunci: string[] = [];
    const d = new Date();
    d.setDate(1);
    for (let i = 11; i >= 0; i--) {
      const x = new Date(d.getFullYear(), d.getMonth() - i, 1);
      kunci.push(`${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}`);
    }
    const jumlah = new Map(kunci.map((k) => [k, 0]));
    for (const b of biaya ?? []) {
      if (!KATEGORI_FEE.has(b.category)) continue;
      const k = b.incurredOn.slice(0, 7);
      if (jumlah.has(k)) jumlah.set(k, jumlah.get(k)! + b.amount);
    }
    const bln = kunci.map((k) => ({ bulan: k, nilai: jumlah.get(k)! }));
    const maks = Math.max(1, ...bln.map((b) => b.nilai));
    const total = bln.reduce((a, b) => a + b.nilai, 0);
    return { bln, maks, rata: total / 12 };
  }, [biaya]);

  /* ---- Rak kartu -------------------------------------------------------- */
  const tanpaNama = (proyek ?? []).reduce((a, p) => a + p.feeTanpaNama, 0);
  const rak = useMemo(() => {
    const total = (orang ?? []).reduce((a, o) => a + o.total, 0) + tanpaNama;
    const maks = Math.max(1, ...(orang ?? []).map((o) => o.total));
    const kelompok = JENIS.map((j) => {
      const isi = (orang ?? []).filter((o) => o.kind === j);
      const n = isi.reduce((a, o) => a + o.total, 0);
      return { jenis: j, isi, total: n, persen: total > 0 ? (n / total) * 100 : 0 };
    }).filter((k) => k.isi.length > 0);
    return { total, maks, kelompok };
  }, [orang, tanpaNama]);

  /* Siapa saja di tiap laci — untuk sorotan dua arah. */
  const orangLaci = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const p of laci) m.set(p.projectId, new Set(p.orang.map((o) => o.teamMemberId)));
    return m;
  }, [laci]);

  const sorotan: Sorot = sorot ?? (sematan ? { orang: sematan } : null);
  const orangDisorot = sorotan && "orang" in sorotan ? sorotan.orang : null;
  const laciDisorot = sorotan && "laci" in sorotan ? sorotan.laci : null;

  function ekspor(mode: "proyek" | "orang") {
    const tanda = new Date().toISOString().slice(0, 10);
    if (mode === "orang") {
      unduhCsv(`fee-per-orang-${tanda}.csv`, [
        ["Nama", "Jenis", "Peran", "Jumlah proyek", "Terakhir", "Total diterima"],
        ...(orang ?? []).map((o) => [
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
        ...laci.map((p) => [
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

  if (biaya === null || orangSemua === null || proyekSemua === null) return <Kerangka />;

  const memuat = proyek === null || orang === null;
  const keluarTotal = (proyek ?? []).reduce((a, p) => a + p.feeTotal + p.feeTanpaNama, 0);
  const kontrakTotal = (proyek ?? []).reduce((a, p) => a + (p.contractValue ?? 0), 0);
  const kontrakBerfee = (proyek ?? []).filter((p) => p.contractValue).reduce((a, p) => a + p.feeTotal + p.feeTanpaNama, 0);
  const porsiRata = kontrakTotal > 0 ? (kontrakBerfee / kontrakTotal) * 100 : null;
  const labelRentang = RENTANG.find((r) => r.nilai === rentang)!.label;
  const bulanIni = bulanan.bln[11]!;

  return (
    <div className="lmr">
      <Keterangan kabar={kabar} />

      {/* ---- Bilah atas: legenda warna mistar + kontrol ------------------ */}
      <div className="lmr__bilah">
        <ul className="lmr__legenda" aria-label="Warna penerima di mistar laci">
          {JENIS.map((j) => (
            <li key={j}>
              <span className="lmr__titikwarna" style={{ "--lmr-w": WARNA_JENIS(j) } as React.CSSProperties} />
              {LABEL_JENIS_ANGGOTA[j]}
            </li>
          ))}
          <li>
            <span className="lmr__titikwarna lmr__titikwarna--tanpa" />
            Tanpa nama
          </li>
        </ul>
        <div className="lmr__kontrol">
          <PilihTombol judul="Rentang fee" nilai={rentang} opsi={RENTANG} onUbah={setRentang} />
          <PilihMenu
            label="Urutan laci"
            nilai={urut}
            opsi={URUT}
            onUbah={setUrut}
            align="end"
            pemicu={
              <button type="button" className="fee__pilihteks lmr__urut">
                <span>{URUT.find((u) => u.nilai === urut)!.label}</span>
                <Ikon ikon={CaretDown} ukuran={12} />
              </button>
            }
          />
          <DropdownMenu
            trigger={<TombolIkon ikon={DownloadSimple} jenis="ghost" judul="Unduh CSV" />}
            sections={[
              {
                label: `Unduh CSV · ${labelRentang.toLowerCase()}`,
                items: [
                  { label: "Fee per proyek", onSelect: () => ekspor("proyek") },
                  { label: "Fee per orang", onSelect: () => ekspor("orang") },
                ],
              },
            ]}
          />
        </div>
      </div>

      {/* ---- Lemari ------------------------------------------------------ */}
      <section className="lmr__lemari" aria-label="Lemari gambar — fee per proyek">
        <header className="lmr__kop">
          <div className="lmr__plat">
            <p className="lmr__alis">Lemari gambar · fee proyek</p>
            <p className="lmr__total">
              {memuat ? (
                <span className="rk rk--gelap" style={{ width: 200, height: 26 }} />
              ) : (
                <RupiahBesar n={keluarTotal} />
              )}
            </p>
            <p className="lmr__sub">
              {labelRentang} · {laci.length} laci · {(orang ?? []).length} penerima
              {porsiRata !== null && <> · rata-rata {teksPersen(porsiRata)} dari kontrak</>}
            </p>
          </div>
          <div className="lmr__pita" aria-label="Fee per bulan, 12 bulan terakhir">
            <p className="lmr__pitajudul">
              <span>Fee per bulan</span>
              <span>
                bulan ini <b>{formatRupiah(bulanIni.nilai)}</b> · rata-rata {formatRupiah(Math.round(bulanan.rata))}
              </span>
            </p>
            <div className="lmr__pitabatang" role="list">
              {bulanan.bln.map((b, i) => {
                const m = Number(b.bulan.slice(5, 7));
                return (
                  <span
                    key={b.bulan}
                    role="listitem"
                    className={`lmr__bln${i === 11 ? " is-kini" : ""}`}
                    style={{ "--lmr-t": b.nilai / bulanan.maks } as React.CSSProperties}
                    aria-label={`${BULAN[m - 1]} ${b.bulan.slice(0, 4)}: ${formatRupiah(b.nilai)}`}
                    {...ket(() => ({
                      judul: `${BULAN[m - 1]} ${b.bulan.slice(0, 4)}`,
                      baris: [{ label: "Fee keluar", nilai: formatRupiah(b.nilai) }],
                    }))}
                  >
                    <i />
                    <small>{BULAN_PENDEK[m - 1]!.slice(0, 3)}</small>
                  </span>
                );
              })}
              <span className="lmr__rata" style={{ "--lmr-t": bulanan.rata / bulanan.maks } as React.CSSProperties} />
            </div>
          </div>
        </header>

        <div
          className="lmr__laci-laci"
          ref={lemariRef}
          style={{ "--lmr-n": Math.max(1, laci.length) } as React.CSSProperties}
          onPointerLeave={(e) => e.pointerType === "mouse" && setSorot(null)}
        >
          {galat && laci.length === 0 ? (
            <div className="lmr__kosong">
              <p>Isi lemari gagal dimuat.</p>
              <button type="button" className="lmr__coba" onClick={muat}>
                Coba lagi
              </button>
            </div>
          ) : memuat ? (
            Array.from({ length: 5 }, (_, i) => <div key={i} className="lmr__laci lmr__laci--rangka" />)
          ) : laci.length === 0 ? (
            <div className="lmr__kosong">
              <p>Belum ada fee pada rentang ini.</p>
              <p className="lmr__kosongket">
                Fee tercatat dari tombol Bayar di Satu Proyek, atau biaya berkategori Freelancer/Prinsipal di Keuangan.
              </p>
            </div>
          ) : (
            laci.map((p, i) => (
              <Laci
                key={p.projectId}
                p={p}
                no={nomorLaci.get(p.projectId) ?? i + 1}
                terbuka={buka === p.projectId}
                baru={baruDitarik === p.projectId}
                isi={isi[p.projectId]}
                rentang={rentang}
                jenisOrang={jenisOrang}
                orangDisorot={orangDisorot}
                punya={orangDisorot !== null && !!orangLaci.get(p.projectId)?.has(orangDisorot)}
                redup={
                  (orangDisorot !== null && !orangLaci.get(p.projectId)?.has(orangDisorot)) ||
                  (laciDisorot !== null && laciDisorot !== p.projectId)
                }
                ket={ket}
                onTarik={() => tarik(p.projectId)}
                onCobaLagi={() => ambilIsi(p.projectId, true)}
                onDekat={(e) => {
                  if (e.pointerType !== "mouse") return;
                  ambilIsi(p.projectId);
                  setSorot({ laci: p.projectId });
                }}
                onKey={(e) => tombolLaci(e, i)}
              />
            ))
          )}
        </div>
        <footer className="lmr__alas" aria-hidden="true">
          <span />
          <span />
        </footer>
      </section>

      {/* ---- Rak kartu penerima ------------------------------------------ */}
      <aside className="lmr__rak" aria-label="Rak kartu penerima fee">
        <header className="lmr__rakkepala">
          <p className="lmr__rakjudul">
            Rak kartu penerima <span>{(orang ?? []).length} orang</span>
          </p>
          <div className="lmr__porsijenis" aria-label="Porsi fee per jenis penerima">
            {rak.kelompok.map((k) => (
              <span
                key={k.jenis}
                style={{ flexGrow: k.total, background: WARNA_JENIS(k.jenis) }}
                {...ket(() => ({
                  judul: LABEL_JENIS_ANGGOTA[k.jenis],
                  baris: [
                    { label: "Fee", nilai: formatRupiah(k.total) },
                    { label: "Porsi", nilai: teksPersen(k.persen) },
                  ],
                }))}
              />
            ))}
            {tanpaNama > 0 && (
              <span
                className="is-tanpa"
                style={{ flexGrow: tanpaNama }}
                {...ket(() => ({
                  judul: "Tanpa nama",
                  baris: [
                    { label: "Fee", nilai: formatRupiah(tanpaNama) },
                    { label: "Porsi", nilai: teksPersen(rak.total > 0 ? (tanpaNama / rak.total) * 100 : 0) },
                  ],
                }))}
              />
            )}
          </div>
        </header>
        <div className="lmr__rakisi" onPointerLeave={(e) => e.pointerType === "mouse" && setSorot(null)}>
          {memuat ? (
            <p className="lmr__rakkosong">Memuat…</p>
          ) : rak.kelompok.length === 0 ? (
            <p className="lmr__rakkosong">Belum ada fee bernama pada rentang ini.</p>
          ) : (
            rak.kelompok.map((k) => (
              <section key={k.jenis} className="lmr__kelompok">
                <h3 className="lmr__sekat">
                  <span>{LABEL_JENIS_ANGGOTA[k.jenis]}</span>
                  <span>
                    {formatRupiah(k.total)} · {teksPersen(k.persen)}
                  </span>
                </h3>
                {k.isi.map((o) => {
                  const ditarik =
                    sematan === o.teamMemberId ||
                    orangDisorot === o.teamMemberId ||
                    (laciDisorot !== null && orangLaci.get(laciDisorot)?.has(o.teamMemberId));
                  const redup =
                    (laciDisorot !== null && !orangLaci.get(laciDisorot)?.has(o.teamMemberId)) ||
                    (orangDisorot !== null && orangDisorot !== o.teamMemberId);
                  return (
                    <button
                      key={o.teamMemberId}
                      type="button"
                      className={`lmr__kartu${ditarik ? " is-tarik" : ""}${redup ? " is-redup" : ""}`}
                      style={{ "--lmr-w": WARNA_JENIS(o.kind), "--lmr-t": o.total / rak.maks } as React.CSSProperties}
                      aria-pressed={sematan === o.teamMemberId}
                      aria-label={`${o.name}, ${formatRupiah(o.total)} dari ${o.projectCount} proyek. Tandai laci-lacinya`}
                      onClick={() => setSematan((s) => (s === o.teamMemberId ? null : o.teamMemberId))}
                      onPointerEnter={(e) => e.pointerType === "mouse" && setSorot({ orang: o.teamMemberId })}
                    >
                      <span className="lmr__kantong" aria-hidden="true">
                        <Ikon ikon={IKON_JENIS[o.kind]} ukuran={14} />
                      </span>
                      <span className="lmr__kertas">
                        <span className="lmr__kartuatas">
                          <b>{o.name}</b>
                          <span>{formatRupiah(o.total)}</span>
                        </span>
                        <span className="lmr__kartuket">
                          {o.role ?? LABEL_JENIS_ANGGOTA[o.kind]} · {o.projectCount} proyek
                          {o.lastOn && <> · terakhir {tanggalPendek(o.lastOn)}</>}
                        </span>
                        <span className="lmr__lubang" aria-hidden="true">
                          <i />
                        </span>
                      </span>
                    </button>
                  );
                })}
              </section>
            ))
          )}
          {!memuat && tanpaNama > 0 && (
            <section className="lmr__kelompok">
              <h3 className="lmr__sekat">
                <span>Belum ditautkan</span>
                <span>
                  {formatRupiah(tanpaNama)} · {teksPersen(rak.total > 0 ? (tanpaNama / rak.total) * 100 : 0)}
                </span>
              </h3>
              <div className="lmr__kartu lmr__kartu--tanpa">
                <span className="lmr__kantong" aria-hidden="true">
                  <Ikon ikon={WarningOctagon} ukuran={14} />
                </span>
                <span className="lmr__kertas">
                  <span className="lmr__kartuatas">
                    <b>Tanpa nama</b>
                    <span>{formatRupiah(tanpaNama)}</span>
                  </span>
                  <span className="lmr__kartuket">
                    fee di {(proyek ?? []).filter((p) => p.feeTanpaNama > 0).length} proyek belum bernama penerima
                  </span>
                </span>
              </div>
            </section>
          )}
        </div>
      </aside>
    </div>
  );
}

/** Rupiah besar di plat kuningan: ribuan terakhir dikecilkan seperti nominal kit. */
function RupiahBesar({ n }: { n: number }) {
  const s = formatRupiah(n);
  const i = s.lastIndexOf(".");
  return (
    <>
      <b>{i < 0 ? s : s.slice(0, i)}</b>
      {i >= 0 && <span>{s.slice(i)}</span>}
    </>
  );
}

/* =============================================================================
   Satu laci
   ============================================================================= */

function Laci({
  p,
  no,
  terbuka,
  baru,
  isi,
  rentang,
  jenisOrang,
  orangDisorot,
  punya,
  redup,
  ket,
  onTarik,
  onCobaLagi,
  onDekat,
  onKey,
}: {
  p: FeeProyek;
  no: number;
  terbuka: boolean;
  baru: boolean;
  isi: IsiLaci | "galat" | undefined;
  rentang: string;
  jenisOrang: Map<string, JenisAnggota>;
  orangDisorot: string | null;
  punya: boolean;
  redup: boolean;
  ket: ReturnType<typeof pemberiKet>;
  onTarik: () => void;
  onCobaLagi: () => void;
  onDekat: (e: React.PointerEvent) => void;
  onKey: (e: React.KeyboardEvent) => void;
}) {
  const keluar = p.feeTotal + p.feeTanpaNama;
  const kontrak = p.contractValue && p.contractValue > 0 ? p.contractValue : null;
  const porsi = kontrak ? (keluar / kontrak) * 100 : null;
  const idBaki = `lmr-baki-${p.projectId}`;
  const nomor = String(no).padStart(2, "0");

  /* Ruas mistar: satu per penerima, lalu tanpa nama. Dipotong di 100% —
     fee yang melewati kontraknya ditandai, bukan digambar keluar laci. */
  const ruas: { id: string; nama: string; nilai: number; warna: string; tanpa?: boolean }[] = [
    ...p.orang.map((o) => ({ id: o.teamMemberId, nama: o.name, nilai: o.amount, warna: WARNA_JENIS(o.kind) })),
    ...(p.feeTanpaNama > 0
      ? [{ id: "tanpa", nama: "Tanpa nama", nilai: p.feeTanpaNama, warna: WARNA_JENIS("tanpa"), tanpa: true }]
      : []),
  ];
  let kiri = 0;

  /* Isi laci tetap terpasang sesudah pernah ditarik: laci yang MENUTUP
     masuk membawa isinya, bukan meluncur sebagai baki kosong. */
  const [pernah, setPernah] = useState(terbuka);
  if (terbuka && !pernah) setPernah(true);

  return (
    <div className={`lmr__laci${terbuka ? " is-buka" : ""}${redup ? " is-redup" : ""}${punya ? " is-punya" : ""}`}>
      <div className="lmr__baki" id={idBaki} role="region" aria-label={`Isi laci ${nomor} — ${p.projectTitle}`}>
        <div className="lmr__bakidalam" inert={!terbuka || undefined}>
          {(terbuka || pernah) && (
            <IsiBaki p={p} isi={isi} rentang={rentang} jenisOrang={jenisOrang} orangDisorot={orangDisorot} baru={baru} onCobaLagi={onCobaLagi} />
          )}
        </div>
      </div>
      <button
        type="button"
        className="lmr__muka"
        aria-expanded={terbuka}
        aria-controls={idBaki}
        onClick={onTarik}
        onPointerEnter={onDekat}
        onKeyDown={onKey}
      >
        <span className="lmr__tepi" aria-hidden="true" />
        <span className="lmr__bingkai">
          <span className="lmr__label">
            <span className="lmr__labelno">Laci {nomor}</span>
            <span className="lmr__labeljudul">{p.projectTitle}</span>
            <span className="lmr__labelket">{kontrak ? `Kontrak ${formatRupiah(kontrak)}` : "Kontrak belum diisi"}</span>
          </span>
        </span>
        <span className="lmr__pegangan" aria-hidden="true">
          <i />
        </span>
        <span className="lmr__ukur">
          <span className="lmr__ukurteks">
            {porsi === null ? (
              <span className="lmr__ukurkosong">Porsi belum bisa dihitung</span>
            ) : (
              <span>
                <b>{teksPersen(porsi)}</b> dari kontrak
              </span>
            )}
            <span className="lmr__ukurorang">
              {p.orang.length} penerima
            </span>
          </span>
          <span className={`lmr__mistar${porsi === null ? " is-kosong" : ""}`} aria-hidden="true">
            {porsi !== null &&
              ruas.map((r) => {
                const lebar = Math.max(0, Math.min(100 - kiri, (r.nilai / kontrak!) * 100));
                const el = (
                  <span
                    key={r.id}
                    className={`lmr__ruas${r.tanpa ? " is-tanpa" : ""}${orangDisorot && orangDisorot !== r.id ? " is-pudar" : ""}${orangDisorot === r.id ? " is-nyala" : ""}`}
                    style={{ left: `${kiri}%`, width: `${lebar}%`, background: r.tanpa ? undefined : r.warna }}
                    {...ket(() => ({
                      judul: `${r.nama} · ${p.projectTitle}`,
                      baris: [
                        { warna: r.tanpa ? "var(--warn)" : r.warna, label: "Fee", nilai: formatRupiah(r.nilai) },
                        { label: "Dari kontrak", nilai: teksPersen((r.nilai / kontrak!) * 100) },
                      ],
                    }))}
                  />
                );
                kiri += lebar;
                return el;
              })}
            {porsi !== null && porsi > 100 && <span className="lmr__lewat">lewat</span>}
          </span>
        </span>
        <span className="lmr__jumlah">
          <b>{formatRupiah(keluar)}</b>
          <span>fee keluar</span>
        </span>
      </button>
    </div>
  );
}

/* =============================================================================
   Isi laci yang ditarik
   ============================================================================= */

function IsiBaki({
  p,
  isi,
  rentang,
  jenisOrang,
  orangDisorot,
  baru,
  onCobaLagi,
}: {
  p: FeeProyek;
  isi: IsiLaci | "galat" | undefined;
  rentang: string;
  jenisOrang: Map<string, JenisAnggota>;
  orangDisorot: string | null;
  baru: boolean;
  onCobaLagi: () => void;
}) {
  const data = isi && isi !== "galat" ? isi : null;

  const map = useMemo<Map_[]>(() => {
    const per = new Map<string, Map_>();
    for (const o of p.orang) {
      per.set(o.teamMemberId, { id: o.teamMemberId, nama: o.name, jenis: o.kind, diterima: o.amount, kali: 0, terakhir: null, tugas: [] });
    }
    for (const b of data?.biaya ?? []) {
      if (!KATEGORI_FEE.has(b.category) || !b.teamMemberId || !dalamRentang(b.incurredOn, rentang)) continue;
      const m = per.get(b.teamMemberId);
      if (!m) continue;
      m.kali += 1;
      if (!m.terakhir || b.incurredOn > m.terakhir) m.terakhir = b.incurredOn;
    }
    /* Orang yang DITUGASKAN tapi belum dibayar di rentang ini tetap punya
       map — map kosong yang berlabel hak adalah kabar, bukan celah. */
    for (const t of data?.tim ?? []) {
      const m =
        per.get(t.teamMemberId) ??
        ({
          id: t.teamMemberId,
          nama: t.teamMemberName,
          jenis: (jenisOrang.get(t.teamMemberId) ?? t.teamMemberKind) as JenisAnggota,
          diterima: 0,
          kali: 0,
          terakhir: null,
          tugas: [],
        } satisfies Map_);
      m.tugas.push(t);
      per.set(t.teamMemberId, m);
    }
    return [...per.values()].sort((a, z) => z.diterima - a.diterima);
  }, [p, data, rentang, jenisOrang]);

  const hak = (data?.tim ?? []).reduce((a, t) => a + (t.hak ?? 0), 0);
  const dibayar = (data?.tim ?? []).reduce((a, t) => a + t.dibayar, 0);
  const tempo = (data?.tim ?? []).reduce(
    (a, t) => a + t.tahap.filter((x) => x.keadaan === "jatuh_tempo").reduce((s, x) => s + (x.nominal ?? 0), 0),
    0,
  );
  const tanpaPersen = (data?.tim ?? []).filter((t) => t.pctBerlaku === null).length;
  /* Fee tanpa nama bukan milik penerima mana pun, jadi ia tidak dapat map:
     ia keterangan tentang LACINYA — biaya lama yang belum ditautkan. */
  const tanpa = (data?.biaya ?? []).filter(
    (b) => KATEGORI_FEE.has(b.category) && !b.teamMemberId && dalamRentang(b.incurredOn, rentang),
  );
  const keluar = p.feeTotal + p.feeTanpaNama;

  return (
    <div className={`lmr__dasar${baru && pakaiGerak() ? " is-baru" : ""}`}>
      <div className="lmr__catatan">
        <p className="lmr__catatanjudul">Catatan laci</p>
        <dl>
          <div>
            <dt>Kontrak</dt>
            <dd>{p.contractValue ? formatRupiah(p.contractValue) : "—"}</dd>
          </div>
          <div>
            <dt>Fee keluar</dt>
            <dd>{formatRupiah(keluar)}</dd>
          </div>
          {p.feeTanpaNama > 0 && (
            <div className="is-tanpa">
              <dt title={tanpa.length > 0 ? `${tanpa.length} biaya fee belum ditautkan ke nama siapa pun` : undefined}>Tanpa nama</dt>
              <dd>{formatRupiah(p.feeTanpaNama)}</dd>
            </div>
          )}
          {!data ? (
            <div className="lmr__garisbuku">
              <dt>Hak tim</dt>
              <dd>…</dd>
            </div>
          ) : data.tim.length === 0 ? (
            <div className="lmr__garisbuku">
              <dt>Penugasan tim</dt>
              <dd>belum ada</dd>
            </div>
          ) : (
            <>
              <div className="lmr__garisbuku">
                <dt>Hak tim</dt>
                <dd>{hak > 0 ? formatRupiah(hak) : "—"}</dd>
              </div>
              <div>
                <dt>Sudah dibayar</dt>
                <dd>{formatRupiah(dibayar)}</dd>
              </div>
              {tempo > 0 && (
                <div className="is-tempo">
                  <dt>Jatuh tempo</dt>
                  <dd>{formatRupiah(tempo)}</dd>
                </div>
              )}
            </>
          )}
        </dl>
        {tanpaPersen > 0 && <p className="lmr__catatanket">{tanpaPersen} peran belum berpersen</p>}
        <a className="lmr__buka" href={`/admin/proyek/satu?id=${encodeURIComponent(p.projectId)}#tim-bayaran`}>
          {tempo > 0 ? "Bayar di Satu Proyek" : "Buka proyek"}
          <Ikon ikon={ArrowRight} ukuran={14} />
        </a>
      </div>

      <div className="lmr__map-map">
        {isi === "galat" ? (
          <div className="lmr__bakikosong">
            <p>Isi laci gagal dimuat.</p>
            <button type="button" className="lmr__coba lmr__coba--terang" onClick={onCobaLagi}>
              Coba lagi
            </button>
          </div>
        ) : (
          map.map((m, i) => (
            <MapOrang key={m.id} m={m} urutan={i} pudar={orangDisorot !== null && orangDisorot !== m.id} nyala={orangDisorot === m.id} />
          ))
        )}
      </div>
    </div>
  );
}

function MapOrang({ m, urutan, pudar, nyala }: { m: Map_; urutan: number; pudar: boolean; nyala: boolean }) {
  const peran = m.tugas.map((t) => `${LABEL_PERAN[t.role]}${t.pctBerlaku !== null ? ` ${teksPersen(t.pctBerlaku)}` : ""}`).join(" · ");
  const tahap = m.tugas.flatMap((t) => t.tahap.map((x) => ({ ...x, peran: LABEL_PERAN[t.role] })));
  const hak = m.tugas.reduce((a, t) => a + (t.hak ?? 0), 0);
  return (
    <article
      className={`lmr__map${pudar ? " is-pudar" : ""}${nyala ? " is-nyala" : ""}`}
      style={{ "--lmr-w": WARNA_JENIS(m.jenis), "--lmr-i": urutan } as React.CSSProperties}
    >
      <p className="lmr__maptab">
        <span>{m.nama}</span>
      </p>
      <div className="lmr__mapisi">
        <p className="lmr__mapperan">
          {peran || `${LABEL_JENIS_ANGGOTA[m.jenis]} · fee lepas`}
        </p>
        <p className="lmr__mapnilai">{formatRupiah(m.diterima)}</p>
        <p className="lmr__mapket">
          {m.diterima === 0 && hak > 0
            ? `Belum dibayar · hak ${formatRupiah(hak)}`
            : `${m.kali > 0 ? `${m.kali}× dibayar` : "dibayar"}${m.terakhir ? ` · ${tanggalPendek(m.terakhir, true)}` : ""}`}
        </p>
        {tahap.length > 0 && (
          <ul className="lmr__tahap">
            {tahap.map((x, i) => (
              <li key={i} className={`is-${x.keadaan}`}>
                {x.keadaan === "dibayar" ? (
                  <Ikon ikon={Check} ukuran={10} />
                ) : x.keadaan === "jatuh_tempo" || x.keadaan === "menunggu" ? (
                  <Ikon ikon={Hourglass} ukuran={10} />
                ) : null}
                <span>
                  {tahap.length > 2 ? `${x.peran} ` : ""}
                  {x.tahap === "awal" ? "Awal" : "Akhir"}
                  {x.keadaan === "dibayar" && x.dibayarPada
                    ? ` ${tanggalPendek(x.dibayarPada)}`
                    : x.keadaan === "jatuh_tempo"
                      ? " jatuh tempo"
                      : x.keadaan === "menunggu"
                        ? " menunggu"
                        : " tanpa persen"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </article>
  );
}

function Kerangka(): ReactNode {
  return (
    <div className="lmr lmr--rangka" aria-busy="true">
      <div className="lmr__bilah" />
      <section className="lmr__lemari">
        <header className="lmr__kop">
          <div className="lmr__plat">
            <span className="rk rk--gelap" style={{ width: 150, height: 10 }} />
            <span className="rk rk--gelap" style={{ width: 220, height: 26 }} />
            <span className="rk rk--gelap" style={{ width: 260, height: 10 }} />
          </div>
        </header>
        <div className="lmr__laci-laci">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="lmr__laci lmr__laci--rangka" />
          ))}
        </div>
        <footer className="lmr__alas" aria-hidden="true">
          <span />
          <span />
        </footer>
      </section>
      <aside className="lmr__rak" />
    </div>
  );
}

export function FeeKit() {
  return (
    <RequireAuth skeleton={<Kerangka />}>
      <Isi />
    </RequireAuth>
  );
}
