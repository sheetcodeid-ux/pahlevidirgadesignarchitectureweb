import { useEffect, useState, type ReactNode } from "react";
import { RequireAuth } from "./RequireAuth";
import { ToastProvider, useToast } from "../kit/Toast";
import { Tombol } from "../kit/Tombol";
import { KelompokIsian, PilihMenu } from "../kit/Formulir";
import { Ikon, type DataIkon } from "../kit/Ikon";
import { CaretDown, Medal, Ruler, SpecialCube, SpecialListNumbers, SpecialWarning } from "../kit/ikon";
import { PenandaSimpan } from "./situsKit";
import { SelTahap } from "./timProyekKit";
import {
  ambilAturanFee,
  bacaCache,
  daftarPaket,
  simpanAturanFee,
  tulisCache,
  LABEL_PERAN,
  URUTAN_PERAN,
  type AturanFee,
  type BarisSlip,
  type PenugasanTim,
  type PeranTim,
  type TahapBayaran,
} from "../../lib/admin";
import type { Paket } from "../../lib/api";
import { rentangFee } from "../../lib/tier";
import { formatRupiah } from "../../lib/format";
import { useCegahPindah } from "../../lib/cegahPindah";
import { keteranganFee } from "../../lib/pdfProyek";

/* =============================================================================
   Aturan Fee Tim — halaman ATURAN, bukan halaman profil.

   Bentuknya mengikuti pekerjaannya: di kiri BUKU ATURAN — tiga pasal yang
   dibaca sebagai kalimat ("Drafter mendapat 10% dari fee design"), dengan
   angkanya diketik di dalam kalimat itu sendiri. Di kanan KALKULATOR satu
   proyek: fee design (atau fee paket), pembagi bonus yang bisa digeser, dan
   pratinjau baris Tim & Bayaran di Satu Proyek yang digambar dengan komponen
   ASLINYA (`SelTahap`), supaya yang dilihat di sini sama persis dengan yang
   muncul di sana.

   Kerangka lembar Akun/Info Studio (sampul, kop, tab) SENGAJA tidak dipakai:
   versi yang memakainya ditolak pemilik — "jangan disamakan semua … jika
   aturan fee maka tampilannya aturan fee" (lihat "Selera pemilik").

   Angka di Excel pemilik: Drafter 10%, Render 5%, "FEE BONUS 10%", dan "5%
   dulu, sisa tunggu design selesai". Leader dan Estimator SENGAJA kosong —
   jawaban pemilik "belum ditentukan". Kosong BUKAN nol: nol berarti "peran
   ini tidak dibayar", kosong berarti "belum diputuskan".

   Siapa yang terpengaruh kalau angkanya diubah:
   - persen peran → penugasan BARU, dan penugasan lama yang persennya kosong.
     Persen yang sudah ditentukan dibekukan saat orang ditugaskan.
   - bagian tahap awal → semua tahap yang BELUM dibayar.
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
const rupiahDari = (s: string) => Number(s.replace(/\D/g, "")) || 0;
const titik = (n: number) => (n ? n.toLocaleString("id-ID") : "");

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

/** Satu pasal: nomor besar di marjin kiri, judul, lalu kalimat-kalimatnya. */
function Pasal({ no, judul, children }: { no: number; judul: string; children: ReactNode }) {
  return (
    <section className="atf__pasal" aria-labelledby={`atf-pasal-${no}`}>
      <span className="atf__pasalno" aria-hidden="true">{no}</span>
      <div className="atf__pasalisi">
        <h3 id={`atf-pasal-${no}`} className="atf__pasaljudul"><span>Pasal {no}</span>{judul}</h3>
        {children}
      </div>
    </section>
  );
}

/** Angka di dalam kalimat: isian kecil, bukan kotak formulir selebar kolom. */
function AngkaKalimat({ label, nilai, onUbah, kosong = "—" }: { label: string; nilai: string; onUbah: (v: string) => void; kosong?: string }) {
  return (
    <KelompokIsian
      aria-label={label}
      inputMode="decimal"
      placeholder={kosong}
      kanan="%"
      className="atf__angka"
      value={nilai}
      onChange={(e) => onUbah(e.currentTarget.value)}
    />
  );
}

/** Penugasan contoh untuk pratinjau — bentuk data yang SAMA dengan yang
 *  dipakai Satu Proyek, jadi `SelTahap` menggambarnya persis seperti di sana:
 *  tahap awal jatuh tempo (DP sudah masuk), tahap akhir menunggu Finish. */
function penugasanContoh(r: PeranTim, pct: number | null, fee: number, awal: number): PenugasanTim {
  const hak = pct === null ? null : Math.round((fee * pct) / 100);
  const t1 = hak === null ? null : Math.round((hak * awal) / 100);
  const tahap = (jenis: TahapBayaran["tahap"], nominal: number | null, keadaan: TahapBayaran["keadaan"]): TahapBayaran => ({
    tahap: jenis, nominal, keadaan, costId: null, dibayar: null, dibayarPada: null,
  });
  return {
    id: `contoh-${r}`, projectId: "contoh", projectTitle: "Contoh", teamMemberId: "", teamMemberName: LABEL_PERAN[r],
    teamMemberKind: "", role: r, pct, pctBerlaku: pct, note: null, feeDesign: fee, hak, dibayar: 0, terutang: hak,
    tahap: hak === null
      ? [tahap("awal", null, "belum_ditentukan"), tahap("akhir", null, "belum_ditentukan")]
      : [tahap("awal", t1, "jatuh_tempo"), tahap("akhir", hak - t1!, "menunggu")],
  };
}

function Halaman() {
  const toast = useToast();
  const [aturan, setAturan] = useState<AturanFee | null>(() => bacaCache<AturanFee>("aturan-fee"));
  const [isi, setIsi] = useState<Isi | null>(() => (aturan ? dariAturan(aturan) : null));
  const [fee, setFee] = useState("12.000.000");
  const [paket, setPaket] = useState<Paket[]>([]);
  const [paketDipilih, setPaketDipilih] = useState("");
  const [menyimpan, setMenyimpan] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);
  const [sorot, setSorot] = useState<PeranTim | null>(null);

  useEffect(() => {
    ambilAturanFee()
      .then((a) => {
        tulisCache("aturan-fee", a);
        setAturan(a);
        setIsi((l) => l ?? dariAturan(a));
      })
      .catch((e) => setGalat((e as Error).message));
    // Paket cuma jalan pintas fee contoh; gagal memuatnya tidak mengganggu.
    daftarPaket().then((p) => setPaket(p.filter((x) => x.active))).catch(() => {});
  }, []);

  const asal = aturan ? dariAturan(aturan) : null;
  const berubahKunci = isi && asal ? (Object.keys(isi) as (keyof Isi)[]).filter((k) => isi[k].trim() !== asal[k]) : [];
  const berubah = berubahKunci.length > 0;
  useCegahPindah(berubah && !menyimpan);

  if (!isi || !aturan) {
    return galat ? <p className="atf__galat">Aturan fee tidak bisa dimuat: {galat}</p> : <Kerangka />;
  }

  const n = (k: keyof Isi) => keAngka(isi[k]);
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

  const total = URUTAN_PERAN.reduce((s, r) => s + (sah(n(r)) ? n(r)! : 0), 0);
  const awalAman = sah(awal) ? Math.min(100, Math.max(0, awal)) : aturan.firstTranchePct;
  const poolAman = sah(pool) ? pool : aturan.poolPct;
  const lewat = total > poolAman ? total - poolAman : 0;
  const feeAngka = rupiahDari(fee);
  const rp = (pct: number) => Math.round((feeAngka * pct) / 100);
  const timTotal = rp(total);
  const slipPeran = (sorot && sah(n(sorot)) ? sorot : URUTAN_PERAN.find((r) => sah(n(r)))) ?? null;
  const timAwal = URUTAN_PERAN.reduce((s, r) => {
    const v = n(r);
    return sah(v) ? s + Math.round((rp(v) * awalAman) / 100) : s;
  }, 0);

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
      toast({ judul: "Aturan fee disimpan", keterangan: "Berlaku untuk penugasan baru dan tahap yang belum dibayar.", nada: "sukses" });
    } catch (err) {
      toast({ judul: "Gagal menyimpan aturan fee", keterangan: (err as Error).message, nada: "gagal" });
    } finally {
      setMenyimpan(false);
    }
  }

  // Menyorot satu peran (tetikus saja, jebakan #9) menyalakan kalimatnya di
  // buku aturan DAN barisnya di pratinjau — aturan dan akibatnya berpasangan.
  const sorotan = (r: PeranTim) => ({
    "data-sorot": sorot === r || undefined,
    onPointerEnter: (e: React.PointerEvent) => { if (e.pointerType === "mouse") setSorot(r); },
    onPointerLeave: () => setSorot(null),
  });

  return (
    <div className="atf">
      {/* ─── Buku aturan ─────────────────────────────────────────────────── */}
      <article className="atf__buku" aria-labelledby="atf-judul">
        <header className="atf__bukukepala">
          <div className="atf__bukujudul">
            <h2 id="atf-judul" className="atf__judul">Aturan fee tim</h2>
            <p className="atf__berlaku">Berlaku untuk penugasan baru dan tahap yang belum dibayar.</p>
          </div>
          <span className={`atf__jumlah${lewat > 0 ? " atf__jumlah--lewat" : ""}`}>
            <small>Bagian tim</small>
            <b>{pctTampil(total)}%</b>
            <small>dari fee design</small>
          </span>
        </header>

        <Pasal no={1} judul="Persen tiap peran dari fee design">
          <ul className="atf__kalimat">
            {URUTAN_PERAN.map((r) => {
              const v = n(r);
              return (
                <li key={r} className="atf__baris" {...sorotan(r)}>
                  <span className={`atf__ubin atf__ubin--${r}`} aria-hidden="true"><Ikon ikon={IKON_PERAN[r]} ukuran={15} /></span>
                  <span className="atf__teks">
                    <b>{LABEL_PERAN[r]}</b> mendapat
                    <AngkaKalimat label={`Persen ${LABEL_PERAN[r]}`} nilai={isi[r]} onUbah={(x) => set(r, x)} />
                  </span>
                  <span className="atf__akibat">
                    {sah(v) ? formatRupiah(rp(v)) : <span className="atf__belum">{v === null ? "Belum ditentukan" : "Bukan angka"}</span>}
                  </span>
                </li>
              );
            })}
          </ul>
        </Pasal>

        <Pasal no={2} judul="Pembayaran bertahap">
          <p className="atf__baris atf__baris--polos">
            <span className="atf__teks">
              Dibayar
              <AngkaKalimat label="Bagian tahap awal" nilai={isi.awal} onUbah={(x) => set("awal", x)} kosong="0" />
              saat DP masuk, sisa <b className="atf__sisa">{pctTampil(100 - awalAman)}%</b> saat Finish.
            </span>
          </p>
        </Pasal>

        <Pasal no={3} judul="Jatah bonus — sebagai pembanding">
          <p className="atf__baris atf__baris--polos">
            <span className="atf__teks">
              Jatah bonus tim
              <AngkaKalimat label="Jatah bonus tim per proyek" nilai={isi.pool} onUbah={(x) => set("pool", x)} kosong="0" />
              per proyek.
            </span>
          </p>
          {lewat > 0 && (
            <p className="atf__bentrok">
              <Ikon ikon={SpecialWarning} ukuran={15} />
              <span>
                Persen peran berjumlah <b>{pctTampil(total)}%</b>, lewat {pctTampil(lewat)} poin dari jatah. Belum diputuskan —
                bayaran tetap dihitung dari persen peran.
              </span>
            </p>
          )}
        </Pasal>

        <footer className="atf__kaki">
          <PenandaSimpan n={galatIsi ? 1 : berubahKunci.length} teks={galatIsi ?? undefined} />
          <span className="atf__kakiaksi">
            {berubah && <Tombol jenis="ghost" ukuran="medium" disabled={menyimpan} onClick={() => asal && setIsi(asal)}>Batalkan</Tombol>}
            <Tombol jenis="primary" ukuran="medium" memuat={menyimpan} disabled={!!galatIsi || !berubah || menyimpan} onClick={() => void simpan()}>
              Simpan aturan
            </Tombol>
          </span>
        </footer>
      </article>

      {/* ─── Kalkulator satu proyek ──────────────────────────────────────── */}
      <aside className="atf__hitung" aria-labelledby="atf-hitung">
        <header className="atf__hitungkepala">
          <h2 id="atf-hitung" className="atf__judul">Hitung satu proyek</h2>
          {paket.length > 0 && (
            <PilihMenu
              label="Pakai fee paket"
              nilai={paketDipilih || undefined}
              align="end"
              onUbah={(id) => {
                const p = paket.find((x) => x.id === id);
                if (!p) return;
                setPaketDipilih(id);
                // Fee paket disimpan dalam JUTA (Starter = 15 → Rp15.000.000).
                setFee(titik(p.feeMin * 1e6));
              }}
              opsi={paket.map((p) => ({ nilai: p.id, label: p.name, ket: `Rp${rentangFee(p)} jt` }))}
              pemicu={
                <button type="button" className="atf__paket">
                  {paket.find((p) => p.id === paketDipilih)?.name ?? "Pakai fee paket"}
                  <Ikon ikon={CaretDown} ukuran={14} />
                </button>
              }
            />
          )}
        </header>

        <label className="atf__fee">
          <span>Fee design</span>
          <KelompokIsian
            kiri="Rp"
            inputMode="numeric"
            className="atf__feeisian"
            value={fee}
            onChange={(e) => { setFee(titik(rupiahDari(e.currentTarget.value))); setPaketDipilih(""); }}
          />
        </label>

        {/* Pembagi: bonus tim satu proyek sebagai satu batang, dibelah oleh
            penanda yang bisa digeser — kiri dibayar saat DP masuk, kanan saat
            Finish. Input range ASLI di atasnya (papan ketik, pembaca layar). */}
        <div className="atf__bagi" style={{ ["--a" as string]: awalAman }}>
          <div className="atf__bagikepala">
            <span>Bonus tim proyek ini</span>
            <b>{formatRupiah(timTotal)}</b>
          </div>
          <div className="atf__bagibatang">
            <span className="atf__bagisisi atf__bagisisi--awal" />
            <span className="atf__bagisisi atf__bagisisi--akhir" />
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={awalAman}
              aria-label="Bagian tahap awal, geser"
              aria-valuetext={`${pctTampil(awalAman)} persen saat DP masuk, ${pctTampil(100 - awalAman)} persen saat Finish`}
              onChange={(e) => set("awal", e.currentTarget.value)}
            />
          </div>
          <div className="atf__bagiangka">
            <span><small>Saat DP masuk · {pctTampil(awalAman)}%</small><b>{formatRupiah(timAwal)}</b></span>
            <span><small>Saat Finish · {pctTampil(100 - awalAman)}%</small><b>{formatRupiah(timTotal - timAwal)}</b></span>
          </div>
        </div>

        {/* Tempat aturan ini benar-benar muncul: Satu Proyek → Tim & Bayaran.
            Komponen tahapnya ASLI; `inert` supaya tombol contohnya tidak bisa
            ditekan atau difokus. */}
        <div className="atf__pratinjau">
          <span className="atf__pratinjaujudul">Tampil di Satu Proyek · Tim &amp; Bayaran</span>
          <table className="atf__tabel" inert>
            <thead>
              <tr><th>Peran</th><th>Saat DP masuk</th><th>Saat Finish</th></tr>
            </thead>
            <tbody>
              {URUTAN_PERAN.map((r) => {
                const v = n(r);
                const p = penugasanContoh(r, sah(v) ? v : null, feeAngka, awalAman);
                return (
                  // Tabelnya `inert`, jadi tetikus tidak pernah sampai ke sini —
                  // sorotannya datang dari kalimat di buku aturan.
                  <tr key={r} data-sorot={sorot === r || undefined}>
                    <td>
                      <span className="atf__peran">
                        <i className={`atf__titik atf__ubin--${r}`} />
                        {LABEL_PERAN[r]}
                        <small>{sah(v) ? `${pctTampil(v)}%` : "—"}</small>
                      </span>
                    </td>
                    <td><SelTahap p={p} jenis="awal" onBayar={() => {}} /></td>
                    <td><SelTahap p={p} jenis="akhir" onBayar={() => {}} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Tempat kedua: baris fee di slip gaji (Bayaran Tim & PDF-nya),
            dengan keterangan dari `keteranganFee` — fungsi yang SAMA. Peran
            yang disorot diperlihatkan; tanpa sorotan, peran pertama yang
            sudah punya persen. */}
        {slipPeran && (
          <div className="atf__slip" aria-label="Tampil di slip gaji">
            <span className="atf__pratinjaujudul">Tampil di slip gaji · baris fee {LABEL_PERAN[slipPeran]}</span>
            <ul className="atf__slipbaris">
              {(["awal", "akhir"] as const).map((t) => {
                const v = n(slipPeran)!;
                const hak = rp(v);
                const t1 = Math.round((hak * awalAman) / 100);
                const baris: BarisSlip = {
                  costId: t, projectId: "contoh", projectTitle: "Proyek contoh", label: "", amount: t === "awal" ? t1 : hak - t1,
                  incurredOn: "", role: slipPeran, pct: v, payoutStage: t,
                };
                return (
                  <li key={t}>
                    <span><small>{keteranganFee(baris)}</small></span>
                    <b>{formatRupiah(baris.amount)}</b>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </aside>
    </div>
  );
}

function Kerangka(): ReactNode {
  return <div className="atf atf--rangka" aria-hidden="true"><i /><i /></div>;
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
