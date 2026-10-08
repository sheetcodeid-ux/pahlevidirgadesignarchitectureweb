import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { RequireAuth } from "./RequireAuth";
import { ToastProvider, useToast } from "../kit/Toast";
import { Tombol } from "../kit/Tombol";
import { Isian } from "../kit/Isian";
import { Segmen } from "../kit/Segmen";
import { Dialog } from "../kit/Overlay";
import { Ikon } from "../kit/Ikon";
import { IsianTanggal, IsianTempel, PilihMenu } from "../kit/Formulir";
import { Keterangan, pemberiKet, type KabarKartu } from "../kit/kartuGrafik";
import { CoinIn, CoinOut, MagnifyingGlass, X } from "../kit/ikon";
import { DialogTarget, labelSemester, semesterBerikut, useKemajuanTarget } from "./targetKit";
import { BULAN, BULAN_PENDEK } from "./frame25";
import { Angka7 } from "./angka7";
import {
  ambilSettings,
  bacaCache,
  catatKas,
  daftarKas,
  daftarProyek,
  hapusKas,
  tulisCache,
  ubahKas,
  KATEGORI_KAS,
  LABEL_KATEGORI_KAS,
  type ArusKas,
  type EntriKas,
  type KategoriKas,
  type Proyek,
  type StudioSettings,
} from "../../lib/admin";
import { formatRupiah, formatRupiahRingkas } from "../../lib/format";

/* =============================================================================
   Kas Studio — MESIN KAS STUDIO.

   Halaman ini sheet "KELUAR MASUK" pemilik: uang yang tidak lahir dari satu
   proyek desain (penjualan PVC, bagi hasil, konsumsi, sewa kantor). Benda
   dunia nyata untuk urusan KAS adalah mesin kas, dan halamannya berperilaku
   seperti mesin itu:

   - LAYAR SALDO: saldo kas studio (seluruh masuk − seluruh keluar), dan
     masuk/keluar bulan berjalan.
   - TUTS: dua tuts besar Uang masuk / Uang keluar membuka bukti kasnya;
     tuts kategori (searah constraint database) menyaring struk dan
     menampilkan jumlah kategori itu pada rentang terpilih; tuts rentang.
   - ROL STRUK: tiap catatan dicetak satu baris dengan SALDO BERJALAN-nya,
     nomor bukti BKM/BKK per bulan (diturunkan dari urutan, bukan nomor
     karangan), dipisah per bulan dengan subtotal, dan diawali saldo awal
     rentang. Baris terbaru paling dekat ke mulut printer. Klik baris =
     buka bukti kasnya.
   - TABUNG TARGET: target pemasukan semester (sumber yang sama dengan
     Dashboard) sebagai tabung bertakar — pembayaran klien dan kas masuk
     bertumpuk, garis target di puncak, dan garis amber "seharusnya hari
     ini" dari hari yang sudah lewat dalam semester.

   Satu-satunya gerak: catatan baru TERCETAK keluar dari mulut printer
   (sekali, sesudah disimpan), dan tuts yang ditekan turun. Diam bila gerak
   dikurangi.

   Bukan pintu kedua untuk hal yang sama ("Keuangan satu pintu" tetap):
   pembayaran klien di Terima Pembayaran, biaya proyek di Catat Pengeluaran,
   gaji di Gaji. Kunci cache `kas-studio` milik halaman ini (jebakan #8).
   ============================================================================= */

type Rentang = "bulan" | "semester" | "12bulan" | "semua";
const RENTANG: { nilai: Rentang; label: string }[] = [
  { nilai: "bulan", label: "Bulan ini" },
  { nilai: "semester", label: "Semester" },
  { nilai: "12bulan", label: "12 bulan" },
  { nilai: "semua", label: "Semua" },
];

const hariIni = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const bulanIni = () => hariIni().slice(0, 7);

function awalRentang(r: Rentang): string | undefined {
  const d = new Date();
  if (r === "bulan") return `${bulanIni()}-01`;
  if (r === "semester") return `${d.getFullYear()}-${d.getMonth() < 6 ? "01" : "07"}-01`;
  if (r === "12bulan") {
    d.setMonth(d.getMonth() - 11, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  }
  return undefined;
}

function tanggalPanjang(iso: string): string {
  const [t, b, h] = iso.slice(0, 10).split("-").map(Number);
  return `${h} ${BULAN[(b ?? 1) - 1]} ${t}`;
}
function tanggalStruk(iso: string): string {
  const [, b, h] = iso.slice(0, 10).split("-");
  return `${h}/${b}`;
}
function namaBulan(kunci: string): string {
  const [t, b] = kunci.split("-").map(Number);
  return `${BULAN[(b ?? 1) - 1]} ${t}`;
}
/** Rupiah bertanda tanpa "Rp" ganda: "+Rp1.440.000" / "−Rp85.000". */
const bertanda = (d: ArusKas, n: number) => `${d === "masuk" ? "+" : "−"}${formatRupiah(n)}`;
/** Saldo bisa minus — ditulis dengan tanda minus yang sama dengan layar. */
const rupiahSaldo = (n: number) => (n < 0 ? `−${formatRupiah(-n)}` : formatRupiah(n));

const pakaiGerak = () =>
  typeof window !== "undefined" && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Angka layar BERHITUNG ke nilai barunya (520 ms) — hanya saat nilainya
    berubah, tidak saat pertama tampil; seketika bila gerak dikurangi. */
function useHitung(nilai: number): number {
  const [tampil, setTampil] = useState(nilai);
  const kini = useRef(nilai);
  useEffect(() => {
    const awal = kini.current;
    if (awal === nilai) return;
    if (!pakaiGerak()) {
      kini.current = nilai;
      setTampil(nilai);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const langkah = (t: number) => {
      const p = Math.min(1, (t - t0) / 520);
      const v = Math.round(awal + (nilai - awal) * (1 - Math.pow(1 - p, 3)));
      kini.current = v;
      setTampil(v);
      if (p < 1) raf = requestAnimationFrame(langkah);
    };
    raf = requestAnimationFrame(langkah);
    return () => cancelAnimationFrame(raf);
  }, [nilai]);
  return tampil;
}

type ModeLayar = "saldo" | ArusKas;

function Layar({
  label,
  nilai,
  mode,
  rentang,
  bulan,
  masuk,
  keluar,
}: {
  label: string;
  nilai: number;
  mode: ModeLayar;
  rentang: string;
  bulan: string;
  masuk: number;
  keluar: number;
}) {
  const tampil = useHitung(nilai);
  const minus = mode === "saldo" && nilai < 0;
  const teks = `${tampil < 0 ? "-" : ""}${Math.abs(tampil).toLocaleString("id-ID")}`;
  return (
    <div className={`ksr__layar${minus ? " is-minus" : ""}`} role="status" aria-live="polite">
      <span className="ksr__layarkop">
        <span className="ksr__layarlabel">{label}</span>
        <span className="ksr__layarrp">Rp</span>
      </span>
      <Angka7 teks={teks} />
      <b className={`ksr__saldo sr-only${minus ? " is-minus" : ""}`}>
        {label}: {mode === "saldo" ? rupiahSaldo(nilai) : formatRupiah(nilai)}
      </b>
      <span className="ksr__penanda" aria-hidden="true">
        <span className={mode === "saldo" ? "is-nyala" : ""}>Saldo</span>
        <span className={mode === "masuk" ? "is-nyala" : ""}>Masuk</span>
        <span className={mode === "keluar" ? "is-nyala" : ""}>Keluar</span>
        <span className="ksr__penandarentang is-nyala">{rentang}</span>
      </span>
      <span className="ksr__layarbaris">
        <span>{bulan}</span>
        <span className="ksr__layarmasuk">{bertanda("masuk", masuk)}</span>
        <span className="ksr__layarkeluar">{bertanda("keluar", keluar)}</span>
      </span>
    </div>
  );
}

/* Laci kas: tertutup di dasar mesin; TERBUKA sekali saat catatan baru
   dicetak (bersama struk dan layar yang berhitung), lalu menutup sendiri.
   Isi bakinya data sungguhan: satu sekat per kategori uang masuk pada
   rentang terpilih, tumpukan lembarnya = banyaknya catatan (paling banyak 5). */
function Laci({ buka, sekat, bukti }: { buka: boolean; sekat: { label: string; n: number }[]; bukti: number }) {
  return (
    <div className={`ksr__laci${buka ? " is-buka" : ""}`} aria-hidden="true">
      <div className="ksr__lacibaki">
        {sekat.map((s) => (
          <span key={s.label} className="ksr__lacisekat">
            {Array.from({ length: Math.min(5, s.n) }, (_, i) => (
              <i key={i} style={{ "--i": i } as CSSProperties} />
            ))}
          </span>
        ))}
        <span className="ksr__lacisekat ksr__lacisekat--koin">
          <i />
          <i />
          <i />
        </span>
      </div>
      <div className="ksr__lacidepan">
        <span className="ksr__lacinama">
          Laci kas
          <small>{bukti} bukti bulan ini</small>
        </span>
        <i className="ksr__lacipegangan" />
        <i className="ksr__lacikunci" />
      </div>
    </div>
  );
}

/** Satu tuts kategori: arah + kategorinya (lainnya ada di kedua arah). */
type Tuts = `${ArusKas}:${KategoriKas}`;

interface Saring {
  arus?: ArusKas;
  tuts?: Tuts;
}

function Isi() {
  const kabar: KabarKartu = useRef(null);
  const ket = pemberiKet(kabar);
  const [kas, setKas] = useState<EntriKas[] | null>(() => bacaCache<EntriKas[]>("kas-studio"));
  const [proyek, setProyek] = useState<Proyek[]>(() => bacaCache<Proyek[]>("proyek") ?? []);
  /* Nama studio dari Info Studio — kunci `settings` milik Info Studio, di
     sini cuma DIBACA (jebakan #8). */
  const [studio, setStudio] = useState(() => bacaCache<StudioSettings>("settings")?.studioName || "Studio");
  const [galat, setGalat] = useState(false);
  const [rentang, setRentang] = useState<Rentang>("semester");
  const [saring, setSaring] = useState<Saring>({});
  const [cari, setCari] = useState("");
  const [ubah, setUbah] = useState<EntriKas | { baru: ArusKas; kategori?: KategoriKas } | null>(null);
  /** Catatan yang baru tersimpan — barisnya "tercetak" sekali. */
  const [cetak, setCetak] = useState<string | null>(null);
  const [target, muatTarget] = useKemajuanTarget();
  const strukRef = useRef<HTMLDivElement>(null);
  const [laci, setLaci] = useState(false);
  const laciTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(laciTimer.current), []);

  function muat() {
    return daftarKas()
      .then((d) => {
        tulisCache("kas-studio", d);
        setKas(d);
        setGalat(false);
      })
      .catch(() => {
        setGalat(true);
        setKas((l) => l ?? []);
      });
  }
  useEffect(() => {
    muat();
    daftarProyek().then(setProyek).catch(() => {});
    ambilSettings()
      .then((s) => setStudio(s.studioName || "Studio"))
      .catch(() => {});
  }, []);

  const semua = kas ?? [];

  /* Urutan kronologis (API membalas terbaru dulu; di tanggal yang sama
     urutan API dipertahankan terbalik) → saldo berjalan dan nomor bukti. */
  const buku = useMemo(() => {
    const naik = semua
      .map((k, i) => ({ k, i }))
      .sort((a, b) => a.k.occurredOn.localeCompare(b.k.occurredOn) || b.i - a.i)
      .map((x) => x.k);
    const saldo = new Map<string, number>();
    const urutan = new Map(naik.map((k, i) => [k.id, i]));
    const nomor = new Map<string, string>();
    const hitung = new Map<string, number>();
    let s = 0;
    for (const k of naik) {
      s += k.direction === "masuk" ? k.amount : -k.amount;
      saldo.set(k.id, s);
      const yymm = k.occurredOn.slice(2, 4) + k.occurredOn.slice(5, 7);
      const kunci = `${k.direction}${yymm}`;
      const n = (hitung.get(kunci) ?? 0) + 1;
      hitung.set(kunci, n);
      nomor.set(k.id, `${k.direction === "masuk" ? "BKM" : "BKK"}-${yymm}-${String(n).padStart(2, "0")}`);
    }
    return { naik, saldo, nomor, urutan, total: s };
  }, [semua]);

  const dari = awalRentang(rentang);
  const dalamRentang = useMemo(() => semua.filter((k) => !dari || k.occurredOn >= dari), [semua, dari]);
  /** Saldo sebelum rentang dibuka — baris pembuka struk. */
  const saldoAwal = useMemo(() => {
    if (!dari) return 0;
    let s = 0;
    for (const k of buku.naik) if (k.occurredOn < dari) s = buku.saldo.get(k.id)!;
    return s;
  }, [buku, dari]);

  const perTuts = useMemo(() => {
    const m = new Map<Tuts, { rp: number; n: number }>();
    for (const k of dalamRentang) {
      const t = `${k.direction}:${k.category}` as Tuts;
      const x = m.get(t) ?? { rp: 0, n: 0 };
      m.set(t, { rp: x.rp + k.amount, n: x.n + 1 });
    }
    return m;
  }, [dalamRentang]);

  const tersaring = useMemo(() => {
    const q = cari.trim().toLowerCase();
    return dalamRentang.filter(
      (k) =>
        (!saring.arus || k.direction === saring.arus) &&
        (!saring.tuts || `${k.direction}:${k.category}` === saring.tuts) &&
        (!q ||
          `${k.label} ${k.counterparty ?? ""} ${k.projectTitle ?? ""} ${LABEL_KATEGORI_KAS[k.category]} ${buku.nomor.get(k.id)}`
            .toLowerCase()
            .includes(q)),
    );
  }, [dalamRentang, saring, cari, buku]);

  /* Struk per bulan, terbaru di atas (paling dekat ke mulut printer). */
  const perBulan = useMemo(() => {
    const g = new Map<string, EntriKas[]>();
    for (const k of tersaring) {
      const b = k.occurredOn.slice(0, 7);
      g.set(b, [...(g.get(b) ?? []), k]);
    }
    return [...g]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([bulan, daftar]) => ({
        bulan,
        daftar: [...daftar].sort((a, b) => buku.urutan.get(b.id)! - buku.urutan.get(a.id)!),
        masuk: daftar.filter((k) => k.direction === "masuk").reduce((n, k) => n + k.amount, 0),
        keluar: daftar.filter((k) => k.direction === "keluar").reduce((n, k) => n + k.amount, 0),
      }));
  }, [tersaring, buku]);

  const bln = bulanIni();
  const bulanan = semua.filter((k) => k.occurredOn.startsWith(bln));
  const masukBulan = bulanan.filter((k) => k.direction === "masuk").reduce((n, k) => n + k.amount, 0);
  const keluarBulan = bulanan.filter((k) => k.direction === "keluar").reduce((n, k) => n + k.amount, 0);
  const adaSaring = Boolean(saring.arus || saring.tuts || cari.trim());

  /* Layar menampilkan yang sedang "ditekan", seperti mesin kas: tuts
     kategori = jumlah kategori itu, judul kelompok = jumlah satu arah,
     tanpa tuts = saldo. */
  const layar: { label: string; nilai: number; mode: ModeLayar } = saring.tuts
    ? {
        label: `${LABEL_KATEGORI_KAS[saring.tuts.split(":")[1] as KategoriKas]} · ${perTuts.get(saring.tuts)?.n ?? 0}×`,
        nilai: perTuts.get(saring.tuts)?.rp ?? 0,
        mode: saring.tuts.split(":")[0] as ArusKas,
      }
    : saring.arus
      ? {
          label: `Semua uang ${saring.arus}`,
          nilai: dalamRentang.filter((k) => k.direction === saring.arus).reduce((n, k) => n + k.amount, 0),
          mode: saring.arus,
        }
      : { label: "Saldo kas studio", nilai: buku.total, mode: "saldo" };

  async function sesudahSimpan(id: string | null) {
    await muat();
    muatTarget();
    if (id && pakaiGerak()) {
      /* Ka-ching: laci terbuka bersamaan dengan struk yang tercetak, lalu
         menutup sendiri. */
      window.clearTimeout(laciTimer.current);
      setLaci(true);
      laciTimer.current = window.setTimeout(() => setLaci(false), 1300);
    }
    if (id) {
      /* Struk digulung ke mulut printer supaya baris barunya terlihat
         keluar. Saringan yang menyembunyikannya dilepas. */
      setSaring({});
      setCari("");
      setCetak(pakaiGerak() ? id : null);
      strukRef.current?.scrollTo({ top: 0 });
    }
  }

  if (kas === null) return <Kerangka />;

  const labelRentang = dari ? (rentang === "bulan" ? namaBulan(bln) : `sejak ${tanggalPanjang(dari)}`) : "seluruh catatan";

  return (
    <div className="ksr">
      <Keterangan kabar={kabar} />
      <div className="ksr__papan">
        {/* ---- Mesin: layar + tuts ------------------------------------- */}
        <section className="ksr__mesin" aria-label="Mesin kas">
          <Layar
            {...layar}
            rentang={RENTANG.find((r) => r.nilai === rentang)!.label}
            bulan={namaBulan(bln)}
            masuk={masukBulan}
            keluar={keluarBulan}
          />

          <div className="ksr__tutsbesar">
            <button type="button" className="ksr__tuts ksr__tuts--masuk" onClick={() => setUbah({ baru: "masuk" })}>
              <Ikon ikon={CoinIn} ukuran={18} />
              <span>
                Uang masuk
                <small>Bukti kas masuk</small>
              </span>
            </button>
            <button type="button" className="ksr__tuts ksr__tuts--keluar" onClick={() => setUbah({ baru: "keluar" })}>
              <Ikon ikon={CoinOut} ukuran={18} />
              <span>
                Uang keluar
                <small>Bukti kas keluar</small>
              </span>
            </button>
          </div>

          {(["masuk", "keluar"] as ArusKas[]).map((arah) => (
            <div key={arah} className={`ksr__kelompok ksr__kelompok--${arah}`} role="group" aria-label={`Kategori uang ${arah}`}>
              <button
                type="button"
                className={`ksr__kelompokjudul${saring.arus === arah && !saring.tuts ? " is-aktif" : ""}`}
                aria-pressed={saring.arus === arah && !saring.tuts}
                onClick={() => setSaring((s) => (s.arus === arah && !s.tuts ? {} : { arus: arah }))}
              >
                {arah === "masuk" ? "Masuk" : "Keluar"}
                <span>
                  {bertanda(
                    arah,
                    dalamRentang.filter((k) => k.direction === arah).reduce((n, k) => n + k.amount, 0),
                  )}
                </span>
              </button>
              <div className="ksr__tutskecil">
                {KATEGORI_KAS[arah].map((kat) => {
                  const t = `${arah}:${kat}` as Tuts;
                  const isi = perTuts.get(t);
                  const aktif = saring.tuts === t;
                  return (
                    <button
                      key={t}
                      type="button"
                      className={`ksr__tutskat is-${arah}${aktif ? " is-aktif" : ""}${isi ? "" : " is-kosong"}`}
                      aria-pressed={aktif}
                      onClick={() => setSaring((s) => (s.tuts === t ? {} : { tuts: t }))}
                    >
                      <span>{LABEL_KATEGORI_KAS[kat]}</span>
                      <b>{isi ? formatRupiah(isi.rp) : "—"}</b>
                      <small>{isi ? `${isi.n}×` : "belum ada"}</small>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          <div className="ksr__rentang" role="group" aria-label="Rentang struk">
            {RENTANG.map((r) => (
              <button
                key={r.nilai}
                type="button"
                className={`ksr__tutsrentang${rentang === r.nilai ? " is-aktif" : ""}`}
                aria-pressed={rentang === r.nilai}
                onClick={() => setRentang(r.nilai)}
              >
                {r.label}
              </button>
            ))}
          </div>

          <Laci
            buka={laci}
            bukti={bulanan.length}
            sekat={KATEGORI_KAS.masuk.map((kat) => ({
              label: kat,
              n: perTuts.get(`masuk:${kat}` as Tuts)?.n ?? 0,
            }))}
          />
        </section>

        {/* ---- Rol struk ------------------------------------------------- */}
        <section className="ksr__rol" aria-label="Struk kas">
          <div className="ksr__printer" aria-hidden="true">
            <span className="ksr__gulung" />
            <span className="ksr__lampu" />
            <i />
          </div>
          <div className={`ksr__struk${cetak ? " is-umpan" : ""}`} ref={strukRef}>
            <header className="ksr__strukkop">
              <b>Kas studio</b>
              <span>{studio}</span>
              <small>
                {labelRentang} · {tersaring.length} catatan
              </small>
              <label className="ksr__cari">
                <Ikon ikon={MagnifyingGlass} ukuran={13} />
                <input
                  type="search"
                  placeholder="Cari di struk"
                  aria-label="Cari di struk"
                  value={cari}
                  onChange={(e) => setCari(e.currentTarget.value)}
                />
              </label>
              {adaSaring && (
                <button
                  type="button"
                  className="ksr__lepas"
                  onClick={() => {
                    setSaring({});
                    setCari("");
                  }}
                >
                  <Ikon ikon={X} ukuran={12} />
                  {saring.tuts
                    ? LABEL_KATEGORI_KAS[saring.tuts.split(":")[1] as KategoriKas]
                    : saring.arus
                      ? `Semua ${saring.arus}`
                      : "Pencarian"}
                </button>
              )}
            </header>

            {galat && (
              <p className="ksr__strukcatat">
                Struk gagal dimuat.{" "}
                <button type="button" onClick={() => muat()}>
                  Coba lagi
                </button>
              </p>
            )}

            {perBulan.length === 0 ? (
              <p className="ksr__strukcatat">
                {semua.length === 0
                  ? "Belum ada catatan kas di luar proyek. Tekan Uang masuk atau Uang keluar."
                  : "Tidak ada catatan pada rentang dan saringan ini."}
              </p>
            ) : (
              perBulan.map((g) => (
                <section key={g.bulan} className="ksr__bulan" aria-label={namaBulan(g.bulan)}>
                  <h3 className="ksr__bulanjudul">
                    <span>{namaBulan(g.bulan)}</span>
                    <span className="ksr__bulanangka">
                      {g.masuk > 0 && <span className="is-masuk">{bertanda("masuk", g.masuk)}</span>}
                      {g.keluar > 0 && <span className="is-keluar">{bertanda("keluar", g.keluar)}</span>}
                    </span>
                  </h3>
                  <ol className="ksr__baris-baris">
                    {g.daftar.map((k) => (
                      <li key={k.id}>
                        <button
                          type="button"
                          className={`ksr__baris is-${k.direction}${cetak === k.id ? " is-cetak" : ""}`}
                          onClick={() => setUbah(k)}
                          onAnimationEnd={() => setCetak(null)}
                          aria-label={`${buku.nomor.get(k.id)}, ${tanggalPanjang(k.occurredOn)}, ${k.label}, ${bertanda(
                            k.direction,
                            k.amount,
                          )}, saldo ${rupiahSaldo(buku.saldo.get(k.id)!)}. Buka bukti kas`}
                        >
                          <span className="ksr__tgl">{tanggalStruk(k.occurredOn)}</span>
                          <span className="ksr__ket">
                            <b>{k.label}</b>
                            <small>
                              {[LABEL_KATEGORI_KAS[k.category], k.counterparty, k.projectTitle].filter(Boolean).join(" · ")}
                            </small>
                          </span>
                          <span className="ksr__nominal">{bertanda(k.direction, k.amount)}</span>
                          <span className="ksr__no">{buku.nomor.get(k.id)}</span>
                          <span className="ksr__saldobaris">saldo {rupiahSaldo(buku.saldo.get(k.id)!)}</span>
                        </button>
                      </li>
                    ))}
                  </ol>
                </section>
              ))
            )}

            <footer className="ksr__strukkaki">
              {dari ? (
                <>
                  <span>Saldo awal {tanggalPanjang(dari)}</span>
                  <b>{rupiahSaldo(saldoAwal)}</b>
                </>
              ) : (
                <span>*** awal catatan kas ***</span>
              )}
            </footer>
          </div>
        </section>

        {/* ---- Tabung target -------------------------------------------- */}
        <TabungTarget target={target} muatTarget={muatTarget} ket={ket} />
      </div>

      <DialogKas
        entri={ubah}
        nomor={ubah && "id" in ubah ? buku.nomor.get(ubah.id) : undefined}
        proyek={proyek}
        onTutup={() => setUbah(null)}
        onSelesai={sesudahSimpan}
      />
    </div>
  );
}

/* Target pemasukan semester sebagai TABUNG BERTAKAR. Tingginya skala
   target (atau tercapai, kalau sudah lewat). */
function TabungTarget({
  target,
  muatTarget,
  ket,
}: {
  target: ReturnType<typeof useKemajuanTarget>[0];
  muatTarget: () => void;
  ket: ReturnType<typeof pemberiKet>;
}) {
  if (!target) {
    return (
      <section className="ksr__target" aria-label="Target semester">
        <p className="ksr__alis">Target pemasukan</p>
        <p className="ksr__targetkosong">Memuat target…</p>
      </section>
    );
  }
  const t = target.target;
  const skala = Math.max(t ?? 0, target.tercapai, 1);
  const pKlien = (target.pembayaranKlien / skala) * 100;
  const pKas = (target.kasLain / skala) * 100;
  const pTarget = t ? (t / skala) * 100 : null;
  const hariTotal =
    Math.round((Date.parse(target.semesterEnd) - Date.parse(target.semesterStart)) / 86_400_000) + 1;
  const lewat = Math.min(1, Math.max(0, (hariTotal - target.sisaHari) / hariTotal));
  const seharusnya = t ? t * lewat : null;
  const pSeharusnya = seharusnya !== null ? (seharusnya / skala) * 100 : null;
  const persen = t ? (target.tercapai / t) * 100 : null;
  const takar = t ? [0.25, 0.5, 0.75] : [];
  const berikut = semesterBerikut(target.semesterStart);

  return (
    <section className="ksr__target" aria-label="Target pemasukan semester">
      <header className="ksr__targetkop">
        <p className="ksr__alis">Target pemasukan · {labelSemester(target.semesterStart)}</p>
        <p className="ksr__targetangka">
          <b>{formatRupiah(target.tercapai)}</b>
          <span>{persen === null ? "belum ada target" : `${persen.toFixed(1).replace(".", ",")}% dari ${formatRupiah(t!)}`}</span>
        </p>
        {target.asal === "diteruskan" && <small className="ksr__diteruskan">memakai target semester lalu</small>}
      </header>

      <div className="ksr__tabungwadah">
        <div
          className="ksr__tabung"
          role="img"
          aria-label={`Tercapai ${formatRupiah(target.tercapai)}${t ? ` dari target ${formatRupiah(t)}` : ""}`}
        >
          <div className="ksr__isi" style={{ "--p-klien": `${pKlien}%`, "--p-kas": `${pKas}%` } as CSSProperties}>
            <i
              className="ksr__isiklien"
              {...ket(() => ({
                judul: "Pembayaran klien",
                baris: [{ label: labelSemester(target.semesterStart), nilai: formatRupiah(target.pembayaranKlien) }],
              }))}
            />
            <i
              className="ksr__isikas"
              {...ket(() => ({
                judul: "Kas studio masuk",
                baris: [{ label: labelSemester(target.semesterStart), nilai: formatRupiah(target.kasLain) }],
              }))}
            />
          </div>
          {takar.map((f) => (
            <span key={f} className="ksr__takar" style={{ bottom: `${f * pTarget!}%` }}>
              <small>{formatRupiahRingkas(t! * f)}</small>
            </span>
          ))}
          {pTarget !== null && (
            <span className="ksr__garistarget" style={{ bottom: `${pTarget}%` }}>
              <small>Target</small>
            </span>
          )}
          {pSeharusnya !== null && target.sisaHari > 0 && (
            <span className="ksr__seharusnya" style={{ bottom: `${pSeharusnya}%` }}>
              <small>Seharusnya hari ini</small>
            </span>
          )}
        </div>

        <dl className="ksr__targetrinci">
          <div>
            <dt>
              <i className="is-klien" />
              Pembayaran klien
            </dt>
            <dd>{formatRupiah(target.pembayaranKlien)}</dd>
          </div>
          <div>
            <dt>
              <i className="is-kas" />
              Kas studio masuk
            </dt>
            <dd>{formatRupiah(target.kasLain)}</dd>
          </div>
          {seharusnya !== null && (
            <div>
              <dt>
                <i className="is-seharusnya" />
                Seharusnya hari ini
              </dt>
              <dd>{formatRupiah(Math.round(seharusnya))}</dd>
            </div>
          )}
          <div className="ksr__targetgaris">
            <dt>Kurang</dt>
            <dd>{target.kurang === null ? "—" : formatRupiah(target.kurang)}</dd>
          </div>
          <div>
            <dt>Per bulan dibutuhkan</dt>
            <dd>{target.perBulanDibutuhkan ? formatRupiah(target.perBulanDibutuhkan) : "—"}</dd>
          </div>
          <div>
            <dt>Sisa semester</dt>
            <dd>{target.sisaHari} hari</dd>
          </div>
        </dl>
      </div>

      <div className="ksr__targetaksi">
        <DialogTarget
          semester={target.semesterStart}
          nilai={target.target}
          onSelesai={muatTarget}
          pemicu={(buka) => (
            <button type="button" className="ksr__tautan" onClick={buka}>
              {target.target ? "Ubah target" : "Tetapkan target"}
            </button>
          )}
        />
        <DialogTarget
          semester={berikut}
          nilai={target.target}
          onSelesai={muatTarget}
          pemicu={(buka) => (
            <button type="button" className="ksr__tautan" onClick={buka}>
              Target {labelSemester(berikut)}
            </button>
          )}
        />
      </div>
    </section>
  );
}

function Kerangka() {
  return (
    <div className="ksr ksr--rangka" aria-busy="true">
      <div className="ksr__papan">
        <section className="ksr__mesin">
          <div className="ksr__layar" />
          <span className="rk" style={{ height: 56 }} />
          <span className="rk" style={{ height: 120 }} />
          <span className="rk" style={{ height: 150 }} />
        </section>
        <section className="ksr__rol">
          <div className="ksr__printer">
            <i />
          </div>
          <div className="ksr__struk" />
        </section>
        <section className="ksr__target">
          <span className="rk" style={{ height: 60 }} />
          <span className="rk" style={{ flex: 1 }} />
        </section>
      </div>
    </div>
  );
}

/* Bukti kas masuk / keluar — catat baru atau ubah. */
function DialogKas({
  entri,
  nomor,
  proyek,
  onTutup,
  onSelesai,
}: {
  entri: EntriKas | { baru: ArusKas; kategori?: KategoriKas } | null;
  nomor?: string;
  proyek: Proyek[];
  onTutup: () => void;
  onSelesai: (idBaru: string | null) => void;
}) {
  const toast = useToast();
  const lama = entri && "id" in entri ? entri : null;
  const [f, setF] = useState({
    direction: "masuk" as ArusKas,
    category: "penjualan_material" as KategoriKas,
    label: "",
    counterparty: "",
    amount: "",
    occurredOn: hariIni(),
    projectId: "",
  });
  const [sibuk, setSibuk] = useState(false);
  const [yakinHapus, setYakinHapus] = useState(false);

  useEffect(() => {
    if (!entri) return;
    setYakinHapus(false);
    if (lama) {
      setF({
        direction: lama.direction,
        category: lama.category,
        label: lama.label,
        counterparty: lama.counterparty ?? "",
        amount: lama.amount.toLocaleString("id-ID"),
        occurredOn: lama.occurredOn,
        projectId: lama.projectId ?? "",
      });
    } else if ("baru" in entri) {
      setF({
        direction: entri.baru,
        category: entri.kategori ?? KATEGORI_KAS[entri.baru][0]!,
        label: "",
        counterparty: "",
        amount: "",
        occurredOn: hariIni(),
        projectId: "",
      });
    }
  }, [entri]);

  const nominal = Number(f.amount.replace(/\D/g, "")) || 0;
  const alasan =
    f.label.trim().length < 2 ? "Isi keterangannya dulu." : nominal <= 0 ? "Isi nominalnya." : !f.occurredOn ? "Pilih tanggal." : null;

  function gantiArus(a: string) {
    const arah = a as ArusKas;
    /* Kategori harus searah arusnya (constraint database) — yang tidak
       cocok diganti kategori pertama arus baru, bukan dibiarkan ditolak. */
    setF((x) => ({ ...x, direction: arah, category: KATEGORI_KAS[arah].includes(x.category) ? x.category : KATEGORI_KAS[arah][0]! }));
  }

  async function simpan() {
    if (alasan) return;
    setSibuk(true);
    const isi = {
      direction: f.direction,
      category: f.category,
      label: f.label.trim(),
      counterparty: f.counterparty.trim() || null,
      amount: nominal,
      occurredOn: f.occurredOn,
      projectId: f.projectId || null,
    };
    try {
      let id: string | null = null;
      if (lama) await ubahKas(lama.id, isi);
      else id = (await catatKas(isi)).id;
      toast({
        judul: lama ? "Bukti kas diubah" : f.direction === "masuk" ? "Uang masuk dicetak" : "Uang keluar dicetak",
        keterangan: `${isi.label} — ${formatRupiah(nominal)}`,
        nada: "sukses",
      });
      onTutup();
      onSelesai(id);
    } catch (e) {
      toast({ judul: "Gagal menyimpan", keterangan: (e as Error).message, nada: "gagal" });
    } finally {
      setSibuk(false);
    }
  }
  async function hapus() {
    if (!lama) return;
    if (!yakinHapus) {
      setYakinHapus(true);
      return;
    }
    setSibuk(true);
    try {
      await hapusKas(lama.id);
      toast({ judul: "Bukti kas dihapus", keterangan: lama.label, nada: "sukses" });
      onTutup();
      onSelesai(null);
    } catch (e) {
      toast({ judul: "Gagal menghapus", keterangan: (e as Error).message, nada: "gagal" });
    } finally {
      setSibuk(false);
    }
  }

  const judul = lama
    ? `${f.direction === "masuk" ? "Bukti kas masuk" : "Bukti kas keluar"}${nomor ? ` · ${nomor}` : ""}`
    : f.direction === "masuk"
      ? "Bukti kas masuk baru"
      : "Bukti kas keluar baru";

  return (
    <Dialog
      open={entri !== null}
      onOpenChange={(o) => !o && onTutup()}
      title={judul}
      footer={
        <>
          {lama && (
            <Tombol ukuran="medium" jenis="bahaya" onClick={hapus} disabled={sibuk} className="kas__hapus">
              {yakinHapus ? "Ya, hapus" : "Hapus"}
            </Tombol>
          )}
          <Tombol ukuran="medium" jenis="ghost" onClick={onTutup} disabled={sibuk}>
            Batal
          </Tombol>
          <Tombol ukuran="medium" jenis="primary" onClick={simpan} disabled={sibuk || !!alasan} memuat={sibuk} title={alasan ?? undefined}>
            {lama ? "Simpan" : "Cetak ke struk"}
          </Tombol>
        </>
      }
    >
      <div className="kas__form">
        <Segmen
          judul="Arus kas"
          nilai={f.direction}
          onPilih={gantiArus}
          segmen={[
            { nilai: "masuk", label: "Uang masuk", ikon: CoinIn },
            { nilai: "keluar", label: "Uang keluar", ikon: CoinOut },
          ]}
        />
        <div className="kas__dua">
          <div className="k-isian">
            <span className="k-isian__label">Kategori</span>
            <PilihMenu
              label="Kategori"
              nilai={f.category}
              onUbah={(v) => setF({ ...f, category: v as KategoriKas })}
              opsi={KATEGORI_KAS[f.direction].map((k) => ({ nilai: k, label: LABEL_KATEGORI_KAS[k] }))}
            />
          </div>
          <IsianTanggal label="Tanggal" nilai={f.occurredOn} onUbah={(v) => setF({ ...f, occurredOn: v })} bisaKosong={false} />
        </div>
        <Isian
          label="Keterangan"
          maxLength={160}
          placeholder={f.direction === "masuk" ? "mis. Penjualan PVC" : "mis. Konsumsi rapat klien"}
          value={f.label}
          onChange={(e) => setF({ ...f, label: e.currentTarget.value })}
        />
        <div className="kas__dua">
          <Isian
            label={f.direction === "masuk" ? "Dari" : "Untuk"}
            maxLength={120}
            placeholder={f.direction === "masuk" ? "mis. Ko Fendy" : "mis. Toko Sinar"}
            value={f.counterparty}
            onChange={(e) => setF({ ...f, counterparty: e.currentTarget.value })}
          />
          <IsianTempel
            label="Nominal"
            kiri="Rp"
            inputMode="numeric"
            value={f.amount}
            onChange={(e) => {
              const d = e.currentTarget.value.replace(/\D/g, "");
              setF({ ...f, amount: d ? Number(d).toLocaleString("id-ID") : "" });
            }}
          />
        </div>
        <div className="k-isian">
          <span className="k-isian__label">Proyek terkait (boleh kosong)</span>
          <PilihMenu
            label="Proyek terkait"
            nilai={f.projectId}
            onUbah={(v) => setF({ ...f, projectId: v })}
            opsi={[{ nilai: "", label: "Tidak terkait proyek" }, ...proyek.map((p) => ({ nilai: p.id, label: p.title }))]}
          />
        </div>
        {f.direction === "masuk" && <p className="kas__info">Ikut dihitung ke target semester.</p>}
        {yakinHapus && <p className="kas__info kas__info--bahaya">Tekan "Ya, hapus" sekali lagi.</p>}
      </div>
    </Dialog>
  );
}

export function KasKit() {
  return (
    <RequireAuth skeleton={<Kerangka />}>
      <ToastProvider>
        <Isi />
      </ToastProvider>
    </RequireAuth>
  );
}
