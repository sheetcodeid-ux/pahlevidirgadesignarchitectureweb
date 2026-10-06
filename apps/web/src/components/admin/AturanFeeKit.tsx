import { useEffect, useState, type ReactNode } from "react";
import { RequireAuth } from "./RequireAuth";
import { ToastProvider, useToast } from "../kit/Toast";
import { Tombol } from "../kit/Tombol";
import { KelompokIsian } from "../kit/Formulir";
import { Lencana } from "../kit/Lencana";
import { Ikon, type DataIkon } from "../kit/Ikon";
import {
  CheckCircle, CoinIn, Hourglass, Info, Medal, NavSealPercent, Ruler, SpecialCube, SpecialListNumbers,
  SpecialWarning, Users,
} from "../kit/ikon";
import { PenandaSimpan } from "./situsKit";
import { BulatSumbu, SampulLembar, TabLembar, tabDariAlamat, tulisTabKeAlamat } from "./lembarKit";
import {
  ambilAturanFee,
  bacaCache,
  simpanAturanFee,
  tulisCache,
  LABEL_PERAN,
  URUTAN_PERAN,
  type AturanFee,
  type PeranTim,
} from "../../lib/admin";
import { formatRupiah } from "../../lib/format";
import { useCegahPindah } from "../../lib/cegahPindah";

/* =============================================================================
   Aturan Fee Tim — persen bawaan tiap peran, jatah bonus, dan pembagian tahap.

   Rupanya lembar gambar kerja ketiga (kerangka `lembarKit`, sama dengan Akun
   dan Info Studio): sampulnya POTONGAN A–A, kop lembarnya angka aturan yang
   sedang diisi, benda besarnya stempel persen bagian tim. Tiga tab, satu
   pekerjaan masing-masing: persen per peran, tahap bayar, jatah bonus.

   Angka di Excel pemilik: Drafter 10%, Render 5%, "FEE BONUS 10%", dan "5%
   dulu, sisa tunggu design selesai". Leader dan Estimator SENGAJA kosong —
   jawaban pemilik "belum ditentukan, buat bisa di-setting nanti". Kosong
   BUKAN nol: nol berarti "peran ini tidak dibayar", kosong berarti "belum
   diputuskan", dan bayarannya tampil "Persen belum ditentukan" alih-alih Rp0.

   Siapa yang terpengaruh kalau angkanya diubah:
   - persen peran → penugasan BARU, dan penugasan lama yang persennya kosong
     (ikut aturan studio). Persen yang sudah ditentukan dibekukan saat orang
     ditugaskan, jadi proyek yang sudah berjalan tidak berubah diam-diam.
   - bagian tahap awal → semua tahap yang BELUM dibayar. Yang sudah dibayar
     tercatat sebagai biaya proyek dan tidak ikut berubah.
   - jatah bonus → pembanding saja, tidak membatasi apa pun.
   ============================================================================= */

const KUNCI_PCT: Record<PeranTim, "pctLeader" | "pctDrafter" | "pctRender" | "pctEstimator"> = {
  leader: "pctLeader",
  drafter: "pctDrafter",
  render: "pctRender",
  estimator: "pctEstimator",
};

const IKON_PERAN: Record<PeranTim, DataIkon> = {
  leader: Medal,
  drafter: Ruler,
  render: SpecialCube,
  estimator: SpecialListNumbers,
};

const TUGAS_PERAN: Record<PeranTim, string> = {
  leader: "Memimpin desain dan klien",
  drafter: "Gambar kerja",
  render: "Visual 3D",
  estimator: "RAB dan volume",
};

type Tab = "peran" | "tahap" | "jatah";
const TAB: { nilai: Tab; label: string; ikon: DataIkon }[] = [
  { nilai: "peran", label: "Persen peran", ikon: Users },
  { nilai: "tahap", label: "Tahap bayar", ikon: Hourglass },
  { nilai: "jatah", label: "Jatah bonus", ikon: NavSealPercent },
];
const NAMA_TAB = TAB.map((t) => t.nilai);

type Isi = Record<PeranTim | "pool" | "awal", string>;

const keTeks = (n: number | null) => (n === null ? "" : String(n).replace(".", ","));
/** "" → null; teks yang bukan angka → NaN (ditolak sebelum dikirim). */
function keAngka(s: string): number | null {
  const t = s.trim();
  if (!t) return null;
  const n = Number(t.replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
}
const pctTampil = (n: number) => n.toLocaleString("id-ID", { maximumFractionDigits: 2 });
const sah = (n: number | null): n is number => n !== null && !Number.isNaN(n);

function dariAturan(a: AturanFee): Isi {
  return {
    leader: keTeks(a.pctLeader),
    drafter: keTeks(a.pctDrafter),
    render: keTeks(a.pctRender),
    estimator: keTeks(a.pctEstimator),
    pool: keTeks(a.poolPct),
    awal: keTeks(a.firstTranchePct),
  };
}

/* ─── Sampul: potongan A–A ──────────────────────────────────────────────────
   Gambar ketiga lembar (Akun denah, Info Studio tampak): potongan melintang
   dua lantai dengan tangga, peil di kiri, garis ukur tinggi di kanan. */

function PotonganSampul() {
  const sumbu = [70, 230, 390];
  // Tangga: 7 anak tangga dari lantai dasar ke pelat lantai atas.
  const tangga = Array.from({ length: 7 }, (_, i) => `L${262 + i * 12} ${104 - i * 6} L${262 + (i + 1) * 12} ${104 - i * 6}`).join(" ");
  return (
    <svg className="lbr-gambar afee__potongan" viewBox="0 0 470 116" fill="none" aria-hidden="true">
      <g className="lbr-sumbu">
        {sumbu.map((x) => <line key={x} x1={x} y1={22} x2={x} y2={116} />)}
      </g>
      {sumbu.map((x, i) => <BulatSumbu key={x} x={x} y={11} teks={String(i + 1)} />)}
      <g className="lbr-tebal">
        {/* Tanah, dinding, pelat lantai, atap pelana terpotong. */}
        <path d="M40 104 H420" />
        <path d="M70 104 V44 M390 104 V44" />
        <path d="M70 62 H250 M346 62 H390" />
        <path d="M56 46 L230 26 L404 46" />
      </g>
      <g className="lbr-tipis">
        <path d={`M262 104 ${tangga} L346 62`} />
        {/* Arsir tanah. */}
        {Array.from({ length: 16 }, (_, i) => <path key={i} d={`M${48 + i * 23} 112 L${56 + i * 23} 104`} />)}
        {/* Jendela terpotong di dinding kanan: dua garis kaca. */}
        <path d="M386 72 V92 M394 72 V92" />
        {/* Garis ukur tinggi di kanan. */}
        <path d="M440 104 V46 M436 108 L444 100 M436 66 L444 58 M436 50 L444 42" />
        <path d="M440 62 H432 M440 104 H432 M440 46 H432" />
        {/* Peil di kiri: segitiga + garis. */}
        <path d="M22 104 H40 M26 98 L30 104 L34 98 Z M22 62 H40 M26 56 L30 62 L34 56 Z" />
      </g>
      <g className="lbr-angka">
        <text x={452} y={86}>3.500</text>
        <text x={452} y={57}>1.300</text>
        <text x={30} y={95}>±0.00</text>
        <text x={30} y={53}>+3.50</text>
        <text x={150} y={84}>A–A</text>
      </g>
    </svg>
  );
}

/** Isian contoh fee — dipakai ketiga tab untuk menghitung rupiah. Bukan
 *  aturan: tidak disimpan, cuma alat bantu membaca persen sebagai uang. */
function ContohFee({ nilai, onUbah }: { nilai: string; onUbah: (s: string) => void }) {
  return (
    <label className="afee__contoh">
      <span>Contoh fee design</span>
      <KelompokIsian
        kiri="Rp"
        inputMode="numeric"
        value={nilai}
        aria-label="Contoh fee design"
        onChange={(e) => {
          const d = e.currentTarget.value.replace(/\D/g, "");
          onUbah(d ? Number(d).toLocaleString("id-ID") : "");
        }}
      />
    </label>
  );
}

function KepalaPanel({ judul, kanan }: { judul: string; kanan?: ReactNode }) {
  return (
    <div className="lbr-panelkepala">
      <h3 className="lbr-judul">{judul}</h3>
      {kanan}
    </div>
  );
}

function Halaman() {
  const toast = useToast();
  const [aturan, setAturan] = useState<AturanFee | null>(() => bacaCache<AturanFee>("aturan-fee"));
  const [isi, setIsi] = useState<Isi | null>(() => (aturan ? dariAturan(aturan) : null));
  const [contoh, setContoh] = useState("12.000.000");
  const [menyimpan, setMenyimpan] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);
  const [sorot, setSorot] = useState<PeranTim | null>(null);
  // "peran" juga yang dirender server; tab dari alamat dibaca sesudah
  // hidrasi (jebakan #8).
  const [tab, setTabState] = useState<Tab>("peran");

  useEffect(() => {
    setTabState(tabDariAlamat(NAMA_TAB));
    const dengar = () => setTabState(tabDariAlamat(NAMA_TAB));
    window.addEventListener("hashchange", dengar);
    return () => window.removeEventListener("hashchange", dengar);
  }, []);
  const setTab = (t: Tab) => {
    setTabState(t);
    tulisTabKeAlamat(t, "peran");
  };

  useEffect(() => {
    ambilAturanFee()
      .then((a) => {
        tulisCache("aturan-fee", a);
        setAturan(a);
        setIsi((l) => l ?? dariAturan(a));
      })
      .catch((e) => setGalat((e as Error).message));
  }, []);

  const asal = aturan ? dariAturan(aturan) : null;
  const berubahKunci = isi && asal ? (Object.keys(isi) as (keyof Isi)[]).filter((k) => isi[k].trim() !== asal[k]) : [];
  const berubah = berubahKunci.length > 0;
  useCegahPindah(berubah && !menyimpan);

  if (!isi || !aturan) {
    return galat ? <p className="afee__galat">Aturan fee tidak bisa dimuat: {galat}</p> : <Kerangka />;
  }

  const n = (k: keyof Isi) => keAngka(isi[k]);
  const fee = Number(contoh.replace(/\D/g, "")) || 0;
  const awal = n("awal");
  const pool = n("pool");

  /* Alasan tombol Simpan mati — syarat yang sama dengan feeRules.persen(). */
  const salah: string[] = [];
  for (const r of URUTAN_PERAN) {
    const v = n(r);
    if (v !== null && (Number.isNaN(v) || v < 0 || v > 100)) salah.push(`persen ${LABEL_PERAN[r]}`);
  }
  if (!sah(pool) || pool < 0 || pool > 100) salah.push("jatah bonus tim");
  if (!sah(awal) || awal < 0 || awal > 100) salah.push("bagian tahap awal");
  const galatIsi = salah.length
    ? `Periksa ${salah.join(", ")} — isi angka 0 sampai 100${salah.some((s) => s.startsWith("persen")) ? ", atau kosongkan persen peran" : ""}.`
    : null;

  const ditentukan = URUTAN_PERAN.map((r) => ({ r, v: n(r) })).filter((x): x is { r: PeranTim; v: number } => sah(x.v));
  const kosong = URUTAN_PERAN.filter((r) => n(r) === null);
  const total = ditentukan.reduce((s, x) => s + x.v, 0);
  const awalAman = sah(awal) ? Math.min(100, Math.max(0, awal)) : aturan.firstTranchePct;
  const poolAman = sah(pool) ? pool : aturan.poolPct;
  const lewat = total > poolAman ? total - poolAman : 0;
  const rp = (pct: number) => Math.round((fee * pct) / 100);

  function set(k: keyof Isi, v: string) {
    setIsi((l) => (l ? { ...l, [k]: v.replace(/[^\d.,]/g, "") } : l));
  }

  async function simpan() {
    if (galatIsi || !berubah || !isi || !asal) return;
    const ubah: Partial<AturanFee> = {};
    for (const r of URUTAN_PERAN) if (isi[r].trim() !== asal[r]) ubah[KUNCI_PCT[r]] = n(r);
    if (isi.pool.trim() !== asal.pool) ubah.poolPct = n("pool")!;
    if (isi.awal.trim() !== asal.awal) ubah.firstTranchePct = n("awal")!;
    setMenyimpan(true);
    try {
      const a = await simpanAturanFee(ubah);
      tulisCache("aturan-fee", a);
      setAturan(a);
      setIsi(dariAturan(a));
      toast({
        judul: "Aturan fee disimpan",
        keterangan: "Berlaku untuk penugasan baru dan tahap yang belum dibayar.",
        nada: "sukses",
      });
    } catch (err) {
      toast({ judul: "Gagal menyimpan aturan fee", keterangan: (err as Error).message, nada: "gagal" });
    } finally {
      setMenyimpan(false);
    }
  }

  /* Skala pita: cukup lebar untuk jumlah persen DAN jatah, dibulatkan ke
     atas ke kelipatan 5 dengan ruang 20% supaya penanda jatah tidak
     menempel di ujung. */
  const skala = Math.max(5, Math.ceil((Math.max(total, poolAman) * 1.2) / 5) * 5);
  const lebar = (pct: number) => `${(pct / skala) * 100}%`;

  return (
    <div className="lbr afee">
      <header className="lbr-kepala">
        {/* Kop lembar — angka aturan yang sedang diisi, bukan hiasan. */}
        <SampulLembar
          judul="Aturan fee tim"
          gambar={<PotonganSampul />}
          kop={[
            { label: "Bagian tim", nilai: `${pctTampil(total)}%` },
            { label: "Jatah bonus", nilai: `${pctTampil(poolAman)}%` },
            { label: "Tahap awal", nilai: `${pctTampil(awalAman)}%` },
          ]}
        />
        <div className="lbr-identitas">
          {/* Stempel: bagian tim dari fee design, angka terbesar halaman ini. */}
          <span className={`afee__stempel${lewat > 0 ? " afee__stempel--lewat" : ""}`} aria-hidden="true">
            <b>{pctTampil(total)}<small>%</small></b>
            <span>bagian tim</span>
          </span>
          <div className="lbr-siapa">
            <h2 className="lbr-nama">
              Aturan fee tim
              {/* Garis amber, bukan pejal: lencana pejal "menunggu" milik kit
                  bermint (warna frame), sedangkan ini peringatan (aturan #1). */}
              <Lencana bentuk={lewat > 0 ? "garis" : "pejalkecil"} nada={lewat > 0 ? "menunggu" : "selesai"}>
                {lewat > 0 ? `Melebihi jatah ${pctTampil(lewat)} poin` : "Dalam jatah bonus"}
              </Lencana>
            </h2>
            <p className="lbr-sub">
              <Ikon ikon={Info} ukuran={14} />
              Berlaku untuk penugasan baru dan tahap yang belum dibayar
            </p>
          </div>
          <div className="lbr-pintas">
            <PenandaSimpan n={galatIsi ? 1 : berubahKunci.length} teks={galatIsi ?? undefined} />
            {berubah && (
              <Tombol jenis="ghost" ukuran="medium" disabled={menyimpan} onClick={() => asal && setIsi(asal)}>Batalkan</Tombol>
            )}
            <Tombol
              jenis="primary"
              ukuran="medium"
              memuat={menyimpan}
              disabled={!!galatIsi || !berubah || menyimpan}
              onClick={() => void simpan()}
            >
              Simpan aturan
            </Tombol>
          </div>
        </div>
        <TabLembar
          awalan="afee"
          label="Bagian aturan fee"
          nilai={tab}
          onPilih={setTab}
          tab={TAB.map((t) =>
            t.nilai === "peran" && kosong.length
              ? { ...t, angka: kosong.length, nada: "awas" as const }
              : t.nilai === "jatah" && lewat > 0
                ? { ...t, angka: 1, nada: "awas" as const }
                : t,
          )}
        />
      </header>

      <section className="lbr-isi" id="afee-panel" role="tabpanel" aria-labelledby={`afee-tab-${tab}`}>
        {tab === "peran" && (
          <div className="lbr-panel afee__panel">
            <KepalaPanel judul="Persen per peran" kanan={<ContohFee nilai={contoh} onUbah={setContoh} />} />
            <div className="afee__peranpita">
              <ul className="afee__peran">
                {URUTAN_PERAN.map((r) => {
                  const v = n(r);
                  return (
                    <li
                      key={r}
                      className="afee__peranbaris"
                      data-sorot={sorot === r || undefined}
                      data-kosong={v === null || undefined}
                      onPointerEnter={(e) => { if (e.pointerType === "mouse") setSorot(r); }}
                      onPointerLeave={() => setSorot(null)}
                    >
                      <span className={`afee__ubin afee__ubin--${r}`} aria-hidden="true"><Ikon ikon={IKON_PERAN[r]} ukuran={16} /></span>
                      <span className="afee__perannama">
                        <b>{LABEL_PERAN[r]}</b>
                        <small>{TUGAS_PERAN[r]}</small>
                      </span>
                      <KelompokIsian
                        aria-label={`Persen ${LABEL_PERAN[r]}`}
                        inputMode="decimal"
                        placeholder="—"
                        kanan="%"
                        className="afee__pct"
                        value={isi[r]}
                        onChange={(e) => set(r, e.currentTarget.value)}
                      />
                      <span className="afee__hak">
                        {sah(v) ? (
                          <><b>{formatRupiah(rp(v))}</b><small>per proyek</small></>
                        ) : v === null ? (
                          <span className="afee__belum">Belum ditentukan</span>
                        ) : (
                          <span className="afee__belum">Bukan angka</span>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>

              {/* Pita bagian: tiap peran satu ruas, penanda jatah bonus di
                  atasnya; bagian yang melewati jatah diarsir amber. */}
              <div className="afee__pitakartu">
                <span className="afee__pitalabel">Bagian tim dari fee design</span>
                <span className="afee__pitatotal">
                  <b>{pctTampil(total)}%</b>
                  <small>{formatRupiah(rp(total))}</small>
                </span>
                <div className="afee__pita" style={{ ["--jatah" as string]: lebar(poolAman) }}>
                  <div className="afee__pitajalur">
                    {ditentukan.map(({ r, v }) => (
                      <i
                        key={r}
                        className={`afee__ruas afee__ruas--${r}`}
                        data-sorot={sorot === r || undefined}
                        data-redup={(sorot && sorot !== r) || undefined}
                        style={{ width: lebar(v) }}
                        onPointerEnter={(e) => { if (e.pointerType === "mouse") setSorot(r); }}
                        onPointerLeave={() => setSorot(null)}
                      />
                    ))}
                    {lewat > 0 && (
                      <i className="afee__lewat" style={{ left: lebar(poolAman), width: lebar(lewat) }} />
                    )}
                  </div>
                  <span className="afee__jatah"><i />Jatah {pctTampil(poolAman)}%</span>
                  <span className="afee__skala"><span>0%</span><span>{skala}%</span></span>
                </div>
                <ul className="afee__legenda">
                  {URUTAN_PERAN.map((r) => {
                    const v = n(r);
                    return (
                      <li key={r} data-sorot={sorot === r || undefined}>
                        <i className={`afee__titik afee__ruas--${r}`} data-kosong={!sah(v) || undefined} />
                        {LABEL_PERAN[r]}
                        <b>{sah(v) ? `${pctTampil(v)}%` : "—"}</b>
                      </li>
                    );
                  })}
                </ul>
                {lewat > 0 && (
                  <p className="afee__catatan">
                    <Ikon ikon={SpecialWarning} ukuran={14} />
                    Lewat {pctTampil(lewat)} poin — bayaran tetap dari persen peran.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {tab === "tahap" && (
          <div className="lbr-panel afee__panel">
            <KepalaPanel judul="Bayaran bertahap" kanan={<ContohFee nilai={contoh} onUbah={setContoh} />} />
            {/* Garis ukur pembagian: geser penandanya untuk mengubah bagian
                tahap awal. Input range ASLI di atas garisnya (papan ketik,
                pembaca layar), digambar sebagai penanda garis ukur. */}
            <div className="afee__ukur" style={{ ["--awal" as string]: `${awalAman}%` }}>
              <div className="afee__ukurlabel">
                <span className="afee__ukurseg afee__ukurseg--awal">
                  <b>Tahap awal · {pctTampil(awalAman)}%</b>
                </span>
                <span className="afee__ukurseg afee__ukurseg--akhir">
                  <b>Tahap akhir · {pctTampil(100 - awalAman)}%</b>
                </span>
              </div>
              <div className="afee__ukurgaris">
                <i className="afee__ukurisi" />
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={awalAman}
                  aria-label="Bagian tahap awal"
                  aria-valuetext={`${pctTampil(awalAman)} persen saat DP masuk, ${pctTampil(100 - awalAman)} persen saat Finish`}
                  onChange={(e) => set("awal", e.currentTarget.value)}
                />
              </div>
              <div className="afee__ukurujung">
                <span><Ikon ikon={CoinIn} ukuran={14} />DP klien masuk</span>
                <KelompokIsian
                  aria-label="Bagian tahap awal, persen"
                  inputMode="decimal"
                  kanan="%"
                  className="afee__pct afee__pct--kecil"
                  value={isi.awal}
                  onChange={(e) => set("awal", e.currentTarget.value)}
                />
                <span><Ikon ikon={CheckCircle} ukuran={14} />Desain Finish</span>
              </div>
            </div>
            <div className="afee__tahapbawah">
              <table className="afee__tabel">
                <thead>
                  <tr><th>Peran</th><th>Saat DP masuk</th><th>Saat Finish</th></tr>
                </thead>
                <tbody>
                  {URUTAN_PERAN.map((r) => {
                    const v = n(r);
                    const hak = sah(v) ? rp(v) : null;
                    const t1 = hak === null ? null : Math.round((hak * awalAman) / 100);
                    return (
                      <tr key={r}>
                        <td>{LABEL_PERAN[r]}</td>
                        {hak === null ? (
                          <td colSpan={2} className="afee__belumsel"><span className="afee__belum">Persen belum ditentukan</span></td>
                        ) : (
                          <><td>{formatRupiah(t1!)}</td><td>{formatRupiah(hak - t1!)}</td></>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <ul className="afee__aturan">
                <li><span className="lbr-ubin" aria-hidden="true"><Ikon ikon={CoinIn} ukuran={16} /></span>
                  <span><b>Tahap awal jatuh tempo</b><small>saat pembayaran DP klien tercatat, atau tahap proyek sudah melewati DP 50%.</small></span></li>
                <li><span className="lbr-ubin" aria-hidden="true"><Ikon ikon={CheckCircle} ukuran={16} /></span>
                  <span><b>Tahap akhir jatuh tempo</b><small>saat tahap proyek mencapai Finish.</small></span></li>
                <li><span className="lbr-ubin" aria-hidden="true"><Ikon ikon={Hourglass} ukuran={16} /></span>
                  <span><b>Yang sudah dibayar tidak berubah</b><small>pembagian baru berlaku untuk tahap yang belum dibayar.</small></span></li>
              </ul>
            </div>
          </div>
        )}

        {tab === "jatah" && (
          <div className="lbr-panel afee__panel">
            <KepalaPanel judul="Jatah bonus tim per proyek" kanan={<ContohFee nilai={contoh} onUbah={setContoh} />} />
            <div className="afee__jatahkisi">
              <div className="afee__jatahisi">
                <label className="afee__jatahbesar">
                  <span>Jatah bonus</span>
                  <KelompokIsian
                    aria-label="Jatah bonus tim per proyek, persen"
                    inputMode="decimal"
                    kanan="%"
                    className="afee__pct afee__pct--besar"
                    value={isi.pool}
                    onChange={(e) => set("pool", e.currentTarget.value)}
                  />
                </label>
                <p className="afee__jatahket">
                  "FEE BONUS 10%" di Excel. Hanya pembanding — tidak membatasi bayaran siapa pun.
                </p>
              </div>
              {/* Timbangan: jatah lawan jumlah persen peran, di skala yang sama. */}
              <div className="afee__timbang" style={{ ["--jatah" as string]: lebar(poolAman) }}>
                <div className="afee__timbangbaris">
                  <span className="afee__timbanglabel">Jatah bonus</span>
                  <span className="afee__timbangjalur">
                    <i className="afee__timbangisi afee__timbangisi--jatah" style={{ width: lebar(poolAman) }} />
                  </span>
                  <span className="afee__timbangnilai"><b>{pctTampil(poolAman)}%</b><small>{formatRupiah(rp(poolAman))}</small></span>
                </div>
                <div className="afee__timbangbaris">
                  <span className="afee__timbanglabel">Persen peran</span>
                  {/* Sampai jatah hijau; yang melewatinya saja yang amber. */}
                  <span className="afee__timbangjalur">
                    <i className="afee__timbangisi afee__timbangisi--peran" style={{ width: lebar(Math.min(total, poolAman)) }} />
                    {lewat > 0 && <i className="afee__timbangisi afee__timbangisi--lewat" style={{ width: lebar(lewat) }} />}
                    <span className="afee__timbangpenanda" aria-hidden="true" />
                  </span>
                  <span className="afee__timbangnilai"><b>{pctTampil(total)}%</b><small>{formatRupiah(rp(total))}</small></span>
                </div>
                <p className={`afee__putusan${lewat > 0 ? " afee__putusan--lewat" : ""}`}>
                  <Ikon ikon={lewat > 0 ? SpecialWarning : CheckCircle} ukuran={16} />
                  {lewat > 0
                    ? `Persen peran ${pctTampil(total)}% melebihi jatah ${pctTampil(poolAman)}% — selisih ${formatRupiah(rp(lewat))} per proyek di contoh fee. Belum diputuskan; bayaran tetap dari persen peran.`
                    : `Persen peran masih ${pctTampil(poolAman - total)} poin di bawah jatah.`}
                </p>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function Kerangka(): ReactNode {
  return (
    <div className="lbr lbr--rangka" aria-hidden="true">
      <div className="lbr-kepala"><div className="lbr-sampul" /></div>
      <div className="lbr-isi" />
    </div>
  );
}

export function AturanFeeKit() {
  return (
    <RequireAuth skeleton={<Kerangka />}>
      <ToastProvider>
        <Halaman />
      </ToastProvider>
    </RequireAuth>
  );
}
