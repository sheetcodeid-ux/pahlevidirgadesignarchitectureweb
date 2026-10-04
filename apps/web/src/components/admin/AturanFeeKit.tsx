import { useEffect, useState } from "react";
import { RequireAuth } from "./RequireAuth";
import { ToastProvider, useToast } from "../kit/Toast";
import { Tombol } from "../kit/Tombol";
import { IsianTempel, KelompokIsian } from "../kit/Formulir";
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

function Halaman() {
  const toast = useToast();
  const [aturan, setAturan] = useState<AturanFee | null>(() => bacaCache<AturanFee>("aturan-fee"));
  const [isi, setIsi] = useState<Isi | null>(() => (aturan ? dariAturan(aturan) : null));
  const [contoh, setContoh] = useState("12.000.000");
  const [menyimpan, setMenyimpan] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);

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
  const berubah = !!(isi && asal && (Object.keys(isi) as (keyof Isi)[]).some((k) => isi[k].trim() !== asal[k]));
  useCegahPindah(berubah && !menyimpan);

  if (!isi || !aturan) {
    return galat ? (
      <p className="afee__galat">Aturan fee tidak bisa dimuat: {galat}</p>
    ) : (
      <div className="pas pas--rangka" />
    );
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
  if (pool === null || Number.isNaN(pool) || pool < 0 || pool > 100) salah.push("jatah bonus tim");
  if (awal === null || Number.isNaN(awal) || awal < 0 || awal > 100) salah.push("bagian tahap awal");
  const alasan = salah.length
    ? `Periksa ${salah.join(", ")} — isi angka 0 sampai 100${salah.some((s) => s.startsWith("persen")) ? ", atau kosongkan persen peran" : ""}.`
    : !berubah
      ? "Belum ada yang diubah."
      : null;

  const ditentukan = URUTAN_PERAN.map((r) => ({ r, v: n(r) })).filter(
    (x): x is { r: PeranTim; v: number } => x.v !== null && !Number.isNaN(x.v),
  );
  const kosong = URUTAN_PERAN.filter((r) => n(r) === null);
  const total = ditentukan.reduce((s, x) => s + x.v, 0);
  const awalAman = awal !== null && !Number.isNaN(awal) ? awal : aturan.firstTranchePct;
  const lewat = pool !== null && !Number.isNaN(pool) && total > pool ? total - pool : 0;

  function set(k: keyof Isi, v: string) {
    setIsi((l) => (l ? { ...l, [k]: v.replace(/[^\d.,]/g, "") } : l));
  }

  async function simpan(e: React.FormEvent) {
    e.preventDefault();
    if (alasan || !isi || !asal) return;
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

  return (
    <div className="pas pjb afee">
      {/* Bidang besar frame 34: berapa bagian tim dari setiap proyek. */}
      <div className="pak__bidang pak__bidang--besar pjb__bidang" aria-live="polite">
        <span className="pak__kelompok">Bagian tim dari fee design</span>
        <span className="pak__harga">
          <b>{pctTampil(total)}</b>
          <small>%</small>
        </span>
        <span className="pak__per">
          {kosong.length
            ? `Belum termasuk ${kosong.map((r) => LABEL_PERAN[r]).join(" dan ")} — persennya belum ditentukan.`
            : "Semua peran sudah punya persen."}
          {lewat > 0
            ? ` Melebihi jatah bonus tim ${pctTampil(pool!)}% sebanyak ${pctTampil(lewat)} poin.`
            : pool !== null && !Number.isNaN(pool)
              ? ` Jatah bonus tim ${pctTampil(pool)}%.`
              : ""}
        </span>
      </div>

      <div className="pas__badan">
        <div className="pas__utama">
          <form className="pas__form" id="form-aturan-fee" onSubmit={simpan}>
            <div className="pas__judulbaris">
              <h2 className="pas__judul">Aturan fee tim</h2>
            </div>

            <section className="pjb__bagian" aria-labelledby="afee-peran">
              <h3 id="afee-peran" className="pjb__judul">
                Persen per peran
              </h3>
              <div className="afee__tabel" role="table" aria-label="Persen tiap peran dan contoh bayarannya">
                <div className="afee__baris afee__baris--kepala" role="row">
                  <span role="columnheader">Peran</span>
                  <span role="columnheader">Persen</span>
                  <span role="columnheader" className="pjb__kanan">
                    Hak
                  </span>
                  <span role="columnheader" className="pjb__kanan">
                    Saat DP masuk
                  </span>
                  <span role="columnheader" className="pjb__kanan">
                    Saat desain selesai
                  </span>
                </div>
                {URUTAN_PERAN.map((r) => {
                  const v = n(r);
                  const sah = v !== null && !Number.isNaN(v);
                  const hak = sah ? Math.round((fee * v) / 100) : null;
                  const t1 = hak === null ? null : Math.round((hak * awalAman) / 100);
                  return (
                    <div className="afee__baris" role="row" key={r}>
                      <span role="cell" className="pjb__peran">
                        {LABEL_PERAN[r]}
                      </span>
                      <span role="cell">
                        <KelompokIsian
                          aria-label={`Persen ${LABEL_PERAN[r]}`}
                          inputMode="decimal"
                          placeholder="—"
                          kanan="%"
                          className="pjb__pct"
                          value={isi[r]}
                          onChange={(e) => set(r, e.currentTarget.value)}
                        />
                      </span>
                      {hak === null ? (
                        <span role="cell" className="afee__belum">
                          Belum ditentukan
                        </span>
                      ) : (
                        <>
                          <span role="cell" className="pjb__kanan pjb__rp">
                            {formatRupiah(hak)}
                          </span>
                          <span role="cell" className="pjb__kanan afee__rp">
                            {formatRupiah(t1!)}
                          </span>
                          <span role="cell" className="pjb__kanan afee__rp">
                            {formatRupiah(hak - t1!)}
                          </span>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
              <p className="pjb__ket">
                Kosongkan kalau belum diputuskan — bayaran peran itu tampil "Persen belum ditentukan", bukan Rp0. Rupiah di
                tabel adalah contoh untuk proyek ber-fee {formatRupiah(fee)}.
              </p>
            </section>

            <section className="pjb__bagian" aria-labelledby="afee-tahap">
              <h3 id="afee-tahap" className="pjb__judul">
                Bayaran bertahap
              </h3>
              <div className="pas__kisi">
                <IsianTempel
                  label="Dibayar saat DP klien masuk"
                  kanan="%"
                  inputMode="decimal"
                  value={isi.awal}
                  onChange={(e) => set("awal", e.currentTarget.value)}
                  bantu={`Sisanya, ${pctTampil(Math.max(0, 100 - awalAman))}%, dibayar saat tahap proyek mencapai Finish.`}
                />
                <IsianTempel
                  label="Jatah bonus tim per proyek"
                  kanan="%"
                  inputMode="decimal"
                  value={isi.pool}
                  onChange={(e) => set("pool", e.currentTarget.value)}
                  bantu="Pembanding saja — tidak membatasi persen peran."
                />
              </div>
              {lewat > 0 && (
                <p className="pjb__peringatan">
                  Persen peran yang sudah ditentukan berjumlah {pctTampil(total)}%, melebihi jatah bonus {pctTampil(pool!)}%
                  sebanyak {pctTampil(lewat)} poin. Bayarannya tetap dihitung dari persen peran.
                </p>
              )}
            </section>
          </form>
        </div>

        <aside className="pf__samping" aria-label="Simpan aturan fee">
          <div className="pf__simpan pjb__simpan">
            <Tombol
              ukuran="large"
              jenis="primary"
              tipeHtml="submit"
              form="form-aturan-fee"
              memuat={menyimpan}
              disabled={!!alasan || menyimpan}
            >
              {menyimpan ? "Menyimpan…" : "Simpan aturan"}
            </Tombol>
            <Tombol ukuran="large" jenis="ghost" disabled={!berubah || menyimpan} onClick={() => asal && setIsi(asal)}>
              Batalkan perubahan
            </Tombol>
            <span className="pf__alasan">{alasan ?? "Siap disimpan."}</span>
          </div>
          <div className="pf__info">
            <IsianTempel
              label="Contoh fee design"
              kiri="Rp"
              inputMode="numeric"
              value={contoh}
              onChange={(e) => {
                const d = e.currentTarget.value.replace(/\D/g, "");
                setContoh(d ? Number(d).toLocaleString("id-ID") : "");
              }}
              bantu="Hanya untuk hitungan di tabel — tidak disimpan."
            />
            <p className="pas__sampingjudul">Yang ikut berubah</p>
            <dl className="pf__fakta">
              <div>
                <dt>Persen peran</dt>
                <dd>Penugasan baru, dan penugasan lama yang persennya kosong. Yang sudah berpersen tidak berubah.</dd>
              </div>
              <div>
                <dt>Tahap awal</dt>
                <dd>Semua tahap yang belum dibayar, di semua proyek.</dd>
              </div>
            </dl>
          </div>
        </aside>
      </div>
    </div>
  );
}

export function AturanFeeKit() {
  return (
    <RequireAuth skeleton={<div className="pas pas--rangka" />}>
      <ToastProvider>
        <Halaman />
      </ToastProvider>
    </RequireAuth>
  );
}
