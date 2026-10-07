import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { RequireAuth } from "./RequireAuth";
import { useKemajuanTarget, persenTarget, kalimatSisa, labelSemester } from "./targetKit";
import { Keterangan, pemberiKet, type KabarKartu } from "../kit/kartuGrafik";
import { Ikon } from "../kit/Ikon";
import { CheckCircle, Clock, CoinIn, CoinOut, NavReceipt, X } from "../kit/ikon";
import {
  ambilSettings,
  ambilRingkasanKeuangan,
  ambilBulanan,
  semuaTagihan,
  profilTersimpan,
  bacaCache,
  tulisCache,
  type FinanceOverview,
  type BarisBulanan,
  type Invoice,
  type Proyek,
  type Profil,
} from "../../lib/admin";
import { ambilNotifikasi, TAHAP_PROYEK, type IsiNotifikasi } from "../../lib/notifikasi";
import { kepalaHari, waktuButir, ikonButir } from "./linimasaNotif";
import { formatRupiah, formatRupiahRingkas } from "../../lib/format";
import { kodeProyek } from "../../lib/nomorDokumen";
import { Hitung, geraknya } from "./hitung";

/* =============================================================================
   Dashboard = RUANG KENDALI STUDIO.

   Dipilih pemilik dari dua rancangan (sesudah "tampak bangunan" ditolak):
   dashboard sungguhan — angka, grafik, daftar kerja — dengan bahasa kantor
   arsitek, di papan hijau berjahit yang sama dengan halaman keuangan.

   1. KOP GAMBAR selebar papan: kotak judul (studio, tanggal, pemeriksa) +
      lima sel angka bernomor seperti kop lembar kerja — kas masuk, beban,
      laba bulan ini (dengan garis enam bulan), piutang (dengan bagian yang
      lewat tempo), dan proyek berjalan (dengan sebaran tahapnya).
   2. JADWAL INDUK: time schedule semua proyek berjalan. Satu lajur per
      proyek — batang dari termin/tenggat pertama sampai terakhir, isinya
      bagian tahap yang sudah dilalui (% selesai ala Gantt), paku termin
      menurut keadaannya, belah ketupat tenggat preview/final, garis HARI INI,
      dan garis bidik yang mengikuti tetikus dengan tanggalnya. Jendela
      delapan bulan digeser ‹ ›. Klik/Enter satu lajur = LACI DETAIL proyek
      meluncur dari kanan; ↑/↓/Home/End memindah, Escape menutup.
   3. ARUS KAS dua belas bulan: kas masuk sebagai bidang berbasuhan mint,
      beban garis putus; disentuh = kartu angka per bulan.
   4. AGENDA 14 HARI (tenggat proyek & termin, yang lewat lebih dulu), PERLU
      DITANGANI, BUSUR TARGET semester dengan penanda "seharusnya", dan
      empat jalan pintas.

   Tidak ada tulisan di dalam bidang jadwal maupun grafik: nama di kolom
   kiri, keterangan lewat kartu saat disentuh (jebakan #70). Tanpa animasi
   saat muat; gerak hanya saat memilih, menggeser, dan menyentuh.
   ============================================================================= */

const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const BULAN_PENDEK = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const JENIS: Record<string, string> = {
  residential: "Hunian",
  commercial: "Komersial",
  coffeeshop: "Coffee shop",
  interior: "Interior",
  landscape: "Lanskap",
  masterplan: "Masterplan",
  renovation: "Renovasi",
};
const URUT_TAHAP = ["proposal", "deal_kontrak", "dp_50", "desain_1", "desain_2", "finish", "pelunasan"];
const I_FINISH = URUT_TAHAP.indexOf("finish");
/** Lebar jendela jadwal: empat bulan ke belakang, bulan ini, tiga ke depan. */
const JENDELA = 8;
const MUNDUR = 4;
const HARI_MS = 86_400_000;

type StatusTermin = "lunas" | "lewat" | "terbit" | "draf";
interface Termin {
  id: string;
  label: string;
  nilai: number;
  status: StatusTermin;
  /** Tanggal yang digambar: lunas = tanggal lunas, lainnya = tenggat. */
  tanggal: string | null;
}
interface Jalur {
  p: Proyek;
  kode: string;
  kontrak: number;
  diterima: number;
  biaya: number;
  laba: number;
  persen: number;
  lewat: number;
  tahap: number;
  mulai: string;
  selesai: string;
  termin: Termin[];
  preview: string | null;
  final: string | null;
}
interface Acara {
  kunci: string;
  tanggal: string;
  jenis: "final" | "preview" | "tempo";
  judul: string;
  kode: string;
  nilai: number | null;
  lewat: boolean;
  ke: string;
}
type Sentuh = ReturnType<ReturnType<typeof pemberiKet>>;

const isoHari = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const keTgl = (iso: string) => new Date(iso.length === 10 ? iso + "T00:00:00" : iso);
const keHari = (iso: string) => isoHari(keTgl(iso));
const tglPendek = (iso: string | null | undefined) => {
  if (!iso) return "—";
  const d = keTgl(iso);
  return `${d.getDate()} ${BULAN_PENDEK[d.getMonth()]} ${d.getFullYear()}`;
};
const tglHB = (iso: string) => {
  const d = keTgl(iso);
  return `${d.getDate()} ${BULAN_PENDEK[d.getMonth()]}`;
};
const kunciBulan = (mundur: number) => {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - mundur);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};
const namaBulan = (k: string) => BULAN[Number(k.slice(5, 7)) - 1]!;
const persenTeks = (v: number) => `${v.toFixed(v % 1 ? 1 : 0).replace(".", ",")}%`;
const selisihHari = (a: string, b: string) => Math.round((keTgl(a).getTime() - keTgl(b).getTime()) / HARI_MS);

/* --- Garis mungil (sparkline) --------------------------------------------- */
function Garis({ nilai, id }: { nilai: number[]; id: string }) {
  const maks = Math.max(...nilai, 0);
  const min = Math.min(...nilai, 0);
  const r = maks - min || 1;
  const t = (v: number) => 4 + (1 - (v - min) / r) * 24;
  const x = (i: number) => (i / Math.max(1, nilai.length - 1)) * 100;
  const d = nilai.map((v, i) => `${i ? "L" : "M"} ${x(i)} ${t(v)}`).join(" ");
  const akhir = nilai.length - 1;
  return (
    <span className="rks__garis" aria-hidden="true">
      <svg viewBox="0 0 100 30" preserveAspectRatio="none">
        <defs>
          <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" className="rks__basuh-a" />
            <stop offset="1" className="rks__basuh-b" />
          </linearGradient>
        </defs>
        <path d={`${d} L 100 30 L 0 30 Z`} fill={`url(#${id})`} />
        <path d={d} className="rks__garisjalur" />
      </svg>
      <i style={{ left: `${x(akhir)}%`, top: `${(t(nilai[akhir] ?? 0) / 30) * 100}%` }} />
    </span>
  );
}

/* --- Kop gambar: satu sel angka bernomor ----------------------------------- */
function SelKop({
  nomor,
  label,
  children,
  ket,
  className,
  sentuh,
}: {
  nomor: string;
  label: string;
  children: ReactNode;
  ket?: ReactNode;
  className?: string;
  sentuh?: Sentuh;
}) {
  return (
    <div className={`rks__sel${className ? " " + className : ""}`} {...(sentuh ?? {})}>
      <p className="rks__sellabel">
        <span>{nomor}</span>
        {label}
      </p>
      {children}
      {ket && <p className="rks__selket">{ket}</p>}
    </div>
  );
}

/* --- Jadwal induk ----------------------------------------------------------- */
function Jadwal({
  jalur,
  pilih,
  onPilih,
  ket,
}: {
  jalur: Jalur[];
  pilih: string | null;
  onPilih: (id: string | null) => void;
  ket: ReturnType<typeof pemberiKet>;
}) {
  const [geser, setGeser] = useState(0);
  const tombol = useRef<(HTMLButtonElement | null)[]>([]);
  const kisi = useRef<HTMLDivElement>(null);
  const kotak = useRef<DOMRect | null>(null);
  const bidik = useRef<HTMLElement>(null);
  const bidikLabel = useRef<HTMLSpanElement>(null);
  const kini = new Date();
  const awal = new Date(kini.getFullYear(), kini.getMonth() - MUNDUR + geser, 1);
  const akhir = new Date(kini.getFullYear(), kini.getMonth() - MUNDUR + geser + JENDELA, 1);
  const rentang = akhir.getTime() - awal.getTime();
  const pos = (iso: string) => ((keTgl(iso).getTime() - awal.getTime()) / rentang) * 100;
  const bulan = Array.from({ length: JENDELA }, (_, i) => new Date(awal.getFullYear(), awal.getMonth() + i, 1));
  const hariIni = isoHari(kini);
  const xKini = pos(hariIni);
  const terlihat = (x: number) => x >= 0 && x <= 100;
  const bulanTerakhir = bulan[JENDELA - 1]!;

  function kunci(e: KeyboardEvent<HTMLButtonElement>, i: number) {
    const ke =
      e.key === "ArrowDown" ? i + 1 : e.key === "ArrowUp" ? i - 1 : e.key === "Home" ? 0 : e.key === "End" ? jalur.length - 1 : null;
    if (ke === null) return;
    e.preventDefault();
    const j = Math.max(0, Math.min(jalur.length - 1, ke));
    onPilih(jalur[j]!.p.id);
    tombol.current[j]?.focus();
  }
  const iFokus = Math.max(0, jalur.findIndex((j) => j.p.id === pilih));
  const sembunyiBidik = () => {
    bidik.current?.classList.remove("is-tampak");
    bidikLabel.current?.classList.remove("is-tampak");
  };

  return (
    <section className="rks__jadwal" aria-label="Jadwal induk proyek berjalan">
      <header className="rks__kepala">
        <div>
          <p className="rks__alis">Jadwal induk proyek</p>
          <p className="rks__judul">
            {BULAN_PENDEK[awal.getMonth()]} {awal.getFullYear()} – {BULAN_PENDEK[bulanTerakhir.getMonth()]} {bulanTerakhir.getFullYear()}
            <small>{jalur.length} proyek berjalan</small>
          </p>
        </div>
        <div className="rks__geser" role="group" aria-label="Geser jendela jadwal">
          <button type="button" onClick={() => setGeser((g) => g - 1)} aria-label="Satu bulan ke belakang">
            ‹
          </button>
          <button type="button" className="rks__kinitombol" onClick={() => setGeser(0)} disabled={geser === 0}>
            Bulan ini
          </button>
          <button type="button" onClick={() => setGeser((g) => g + 1)} aria-label="Satu bulan ke depan">
            ›
          </button>
        </div>
      </header>

      <div
        className="rks__tabel"
        onPointerEnter={(e) => {
          if (e.pointerType !== "mouse") return;
          kotak.current = kisi.current?.getBoundingClientRect() ?? null;
        }}
        onPointerMove={(e) => {
          const k = kotak.current;
          const garis = bidik.current;
          const label = bidikLabel.current;
          if (e.pointerType !== "mouse" || !k || !garis || !label) return;
          const f = (e.clientX - k.left) / k.width;
          if (f < 0 || f > 1) return sembunyiBidik();
          const t = new Date(awal.getTime() + f * rentang);
          garis.style.left = `${f * 100}%`;
          label.style.left = `${f * 100}%`;
          label.textContent = `${t.getDate()} ${BULAN_PENDEK[t.getMonth()]}`;
          garis.classList.add("is-tampak");
          label.classList.add("is-tampak");
        }}
        onPointerLeave={() => {
          kotak.current = null;
          sembunyiBidik();
        }}
      >
        {/* Kepala kolom: bulan di atas, pita penanda (hari ini, bidik) di bawah. */}
        <div className="rks__skala" aria-hidden="true">
          <span className="rks__skalakiri">Proyek · tahap</span>
          <div className="rks__skalawaktu">
            <div className="rks__bulan">
              {bulan.map((b, i) => {
                const x = (pos(isoHari(b)) + pos(isoHari(new Date(b.getFullYear(), b.getMonth() + 1, 1)))) / 2;
                const ini = b.getFullYear() === kini.getFullYear() && b.getMonth() === kini.getMonth();
                return (
                  <span key={i} className={ini ? "is-ini" : undefined} style={{ left: `${x}%` }}>
                    {BULAN_PENDEK[b.getMonth()]}
                    {(b.getMonth() === 0 || i === 0) && <small> {String(b.getFullYear()).slice(2)}</small>}
                  </span>
                );
              })}
            </div>
            <div className="rks__pita">
              {terlihat(xKini) && (
                <span className="rks__pitakini" style={{ left: `${xKini}%` }}>
                  Hari ini · {tglHB(hariIni)}
                </span>
              )}
              <span className="rks__pitabidik" ref={bidikLabel} />
            </div>
          </div>
        </div>

        <div className="rks__lajur">
          {/* Kisi bulan, garis hari ini, dan garis bidik — satu lapis di belakang
              seluruh lajur, hanya di kolom waktu (tanpa tulisan). */}
          <div className="rks__kisi" ref={kisi} aria-hidden="true">
            {bulan.map((b, i) =>
              i === 0 ? null : <i key={i} className={b.getMonth() === 0 ? "is-tahun" : undefined} style={{ left: `${pos(isoHari(b))}%` }} />,
            )}
            {terlihat(xKini) && <b className="rks__kini" style={{ left: `${xKini}%` }} />}
            <b className="rks__bidik" ref={bidik} />
          </div>

          {jalur.length === 0 && <p className="rks__kosong">Belum ada proyek yang sedang berjalan.</p>}
          <ol className="rks__baris">
            {jalur.map((j, i) => {
              const a = pos(j.mulai);
              const z = pos(j.selesai);
              const kiri = Math.max(0, Math.min(100, a));
              const kanan = Math.max(0, Math.min(100, z));
              const isi = Math.max(0, Math.min(1, j.tahap / (URUT_TAHAP.length - 1)));
              /* Isi dihitung terhadap batang utuh, lalu dipotong ke jendela. */
              const xIsi = a + (z - a) * isi;
              const lebarIsi = Math.max(0, Math.min(100, xIsi) - kiri);
              const dipilih = j.p.id === pilih;
              return (
                <li key={j.p.id}>
                  <button
                    type="button"
                    ref={(el) => {
                      tombol.current[i] = el;
                    }}
                    className={`rks__jalur${dipilih ? " is-pilih" : ""}`}
                    aria-pressed={dipilih}
                    aria-label={`${j.p.title}, tahap ${TAHAP_PROYEK[j.p.pipelineStage ?? ""] ?? "—"}, diterima ${persenTeks(j.persen)}`}
                    tabIndex={i === iFokus ? 0 : -1}
                    onClick={() => onPilih(dipilih ? null : j.p.id)}
                    onKeyDown={(e) => kunci(e, i)}
                  >
                    <span className="rks__nama">
                      <b>{j.kode}</b>
                      <span>{j.p.title}</span>
                      <small>
                        {TAHAP_PROYEK[j.p.pipelineStage ?? ""] ?? "—"} · {persenTeks(j.persen)} diterima
                      </small>
                    </span>
                    <span className="rks__waktu">
                      {kanan > kiri && (
                        <span
                          className={`rks__batang${a < 0 ? " is-potongkiri" : ""}${z > 100 ? " is-potongkanan" : ""}`}
                          style={{ left: `${kiri}%`, width: `${kanan - kiri}%` }}
                          {...ket(() => ({
                            judul: j.p.title,
                            baris: [
                              { label: "Jadwal", nilai: `${tglPendek(j.mulai)} – ${tglPendek(j.selesai)}` },
                              { label: "Tahap", nilai: `${TAHAP_PROYEK[j.p.pipelineStage ?? ""] ?? "—"} (${j.tahap + 1}/7)` },
                              { label: "Kontrak", nilai: formatRupiah(j.kontrak) },
                              { label: "Diterima", nilai: `${formatRupiah(j.diterima)} · ${persenTeks(j.persen)}` },
                            ],
                          }))}
                        >
                          <i style={{ width: `${kanan - kiri > 0 ? (lebarIsi / (kanan - kiri)) * 100 : 0}%` }} />
                        </span>
                      )}
                      {j.termin
                        .filter((t) => t.tanggal && terlihat(pos(t.tanggal)))
                        .map((t) => (
                          <span
                            key={t.id}
                            className={`rks__paku is-${t.status}`}
                            style={{ left: `${pos(t.tanggal!)}%` }}
                            {...ket(() => ({
                              judul: `${t.label} · ${j.kode}`,
                              baris: [
                                {
                                  label: t.status === "lunas" ? "Lunas" : t.status === "lewat" ? "Lewat tempo" : t.status === "terbit" ? "Jatuh tempo" : "Draf, tempo",
                                  nilai: tglPendek(t.tanggal),
                                },
                                { label: "Nilai", nilai: formatRupiah(t.nilai) },
                              ],
                            }))}
                          />
                        ))}
                      {(
                        [
                          ["preview", j.preview],
                          ["final", j.final],
                        ] as const
                      )
                        .filter(([, d]) => d && terlihat(pos(d)))
                        .map(([jenis, d]) => {
                          const telat = jenis === "final" && d! < hariIni && j.tahap < I_FINISH;
                          return (
                            <span
                              key={jenis}
                              className={`rks__tenggat is-${jenis}${telat ? " is-telat" : ""}`}
                              style={{ left: `${pos(d!)}%` }}
                              {...ket(() => ({
                                judul: `Tenggat ${jenis} · ${j.kode}`,
                                baris: [
                                  { label: "Tanggal", nilai: tglPendek(d) },
                                  ...(telat ? [{ label: "Terlewat", nilai: `${selisihHari(hariIni, d!)} hari` }] : []),
                                ],
                              }))}
                            />
                          );
                        })}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
      </div>

      <ul className="rks__legenda" aria-label="Arti tanda jadwal">
        <li>
          <i className="is-isi" />
          Tahap dilalui
        </li>
        <li>
          <i className="is-paku is-lunas" />
          Termin lunas
        </li>
        <li>
          <i className="is-paku is-terbit" />
          Terbit
        </li>
        <li>
          <i className="is-paku is-lewat" />
          Lewat tempo
        </li>
        <li>
          <i className="is-paku is-draf" />
          Draf
        </li>
        <li>
          <i className="is-ketupat" />
          Preview
        </li>
        <li>
          <i className="is-ketupat is-pejal" />
          Final
        </li>
      </ul>
    </section>
  );
}

/* --- Laci detail proyek (kertas putih tetap) ------------------------------- */
function Laci({ j, hidup, onTutup }: { j: Jalur | undefined; hidup: boolean; onTutup: () => void }) {
  /* Isi terakhir tetap digambar selama laci menutup, supaya ia meluncur
     keluar bersama isinya, bukan kosong. */
  const terakhir = useRef<Jalur | undefined>(j);
  if (j) terakhir.current = j;
  const g = j ?? terakhir.current;
  const buka = Boolean(j);
  /* Daftar termin yang lebih panjang dari tempatnya memudar di tepi bawah.
     Diukur sekali per proyek & ukuran, bukan saat menggulir (jebakan #21). */
  const termin = useRef<HTMLUListElement>(null);
  useLayoutEffect(() => {
    const el = termin.current;
    if (!el) return;
    const ukur = () => el.classList.toggle("is-gulir", el.scrollHeight > el.clientHeight + 1);
    ukur();
    const ro = new ResizeObserver(ukur);
    ro.observe(el);
    return () => ro.disconnect();
  }, [g?.p.id]);
  return (
    <aside className={`rks__laci${buka ? " is-buka" : ""}`} aria-label={g ? `Detail ${g.p.title}` : "Detail proyek"} aria-hidden={!buka} inert={!buka}>
      {g && (
        <div className="rks__laciisi" key={g.p.id}>
          <header className="rks__lacikop">
            <div>
              <p className="rks__alis">
                Map proyek · <b>{g.kode}</b>
              </p>
              <h2>{g.p.title}</h2>
              <p className="rks__laciket">
                {[g.p.client, g.p.city, JENIS[g.p.category] ?? g.p.category].filter(Boolean).join(" · ")}
                <span>
                  {" "}
                  · tahap <b>{TAHAP_PROYEK[g.p.pipelineStage ?? ""] ?? "—"}</b> ({g.tahap + 1}/7)
                </span>
              </p>
            </div>
            <button type="button" className="rks__tutup" onClick={onTutup} aria-label="Tutup detail">
              <Ikon ikon={X} ukuran={14} />
            </button>
          </header>
          <dl className="rks__angka">
            <div>
              <dt>Kontrak</dt>
              <dd>{formatRupiah(g.kontrak)}</dd>
            </div>
            <div>
              <dt>Diterima · {persenTeks(g.persen)}</dt>
              <dd>
                <Hitung nilai={g.diterima} hidup={hidup} format={formatRupiah} />
              </dd>
            </div>
            <div>
              <dt>Biaya</dt>
              <dd>{formatRupiah(g.biaya)}</dd>
            </div>
            <div className={g.laba < 0 ? "is-minus" : undefined}>
              <dt>Laba bersih</dt>
              <dd>
                <Hitung nilai={g.laba} hidup={hidup} format={formatRupiah} />
              </dd>
            </div>
          </dl>
          <ul className="rks__termin" aria-label="Termin" ref={termin}>
            {g.termin.length === 0 && <li className="rks__terminkosong">Belum ada termin.</li>}
            {g.termin.map((t) => (
              <li key={t.id} className={`is-${t.status}`}>
                <i aria-hidden="true" />
                <span>{t.label}</span>
                <small>{t.status === "lunas" ? `lunas ${tglPendek(t.tanggal)}` : t.tanggal ? `tempo ${tglPendek(t.tanggal)}` : "tanpa tenggat"}</small>
                <b>{formatRupiahRingkas(t.nilai)}</b>
              </li>
            ))}
          </ul>
          <p className="rks__laciaksi">
            <a href={`/admin/proyek/satu?id=${encodeURIComponent(g.p.id)}`}>Buka proyek</a>
            <a href={`/admin/keuangan/tagihan?proyek=${encodeURIComponent(g.p.id)}`}>Tagihan</a>
            <a href={`/admin/keuangan/terima?proyek=${encodeURIComponent(g.p.id)}`}>Terima bayar</a>
          </p>
        </div>
      )}
    </aside>
  );
}

/* --- Arus kas dua belas bulan --------------------------------------------- */
function ArusKas({ arus, hidup, ket }: { arus: { k: string; masuk: number; beban: number }[]; hidup: boolean; ket: ReturnType<typeof pemberiKet> }) {
  const maks = Math.max(1, ...arus.map((a) => Math.max(a.masuk, a.beban)));
  const langkah = (() => {
    const kasar = maks / 3;
    const p = 10 ** Math.floor(Math.log10(kasar || 1));
    for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= kasar) return m * p;
    return 10 * p;
  })();
  const atas = Math.ceil(maks / langkah) * langkah;
  const n = arus.length;
  const x = (i: number) => ((i + 0.5) / n) * 100;
  const y = (v: number) => 100 - (v / atas) * 100;
  const jalur = (f: (a: (typeof arus)[number]) => number) => arus.map((a, i) => `${i ? "L" : "M"} ${x(i)} ${y(f(a))}`).join(" ");
  const dMasuk = jalur((a) => a.masuk);
  const bersih = arus.reduce((s, a) => s + a.masuk - a.beban, 0);
  const masukTotal = arus.reduce((s, a) => s + a.masuk, 0);
  const bebanTotal = arus.reduce((s, a) => s + a.beban, 0);
  const tanda: number[] = [];
  for (let v = langkah; v <= atas + 1; v += langkah) tanda.push(v);
  return (
    <section className="rks__arus" aria-label="Arus kas dua belas bulan">
      <header className="rks__kepala">
        <div>
          <p className="rks__alis">Arus kas · 12 bulan</p>
          <p className={`rks__judul rks__judul--angka${bersih < 0 ? " is-minus" : ""}`}>
            <Hitung nilai={bersih} hidup={hidup} format={formatRupiah} />
            <small>kas bersih</small>
          </p>
        </div>
        <a className="rks__tautan" href="/admin/keuangan">
          Ringkasan
        </a>
      </header>
      <dl className="rks__arusjumlah">
        <div>
          <dt>
            <i className="is-masuk" aria-hidden="true" />
            Masuk
          </dt>
          <dd>{formatRupiahRingkas(masukTotal)}</dd>
        </div>
        <div>
          <dt>
            <i className="is-beban" aria-hidden="true" />
            Beban
          </dt>
          <dd>{formatRupiahRingkas(bebanTotal)}</dd>
        </div>
      </dl>
      <div className="rks__grafik">
        <div className="rks__plot">
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <defs>
              <linearGradient id="rks-basuh-arus" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" className="rks__basuh-a" />
                <stop offset="1" className="rks__basuh-b" />
              </linearGradient>
            </defs>
            {tanda.map((v) => (
              <line key={v} className="rks__grafikkisi" x1="0" x2="100" y1={y(v)} y2={y(v)} />
            ))}
            <path d={`${dMasuk} L ${x(n - 1)} 100 L ${x(0)} 100 Z`} fill="url(#rks-basuh-arus)" />
            <path d={dMasuk} className="rks__arusmasuk" />
            <path d={jalur((a) => a.beban)} className="rks__arusbeban" />
          </svg>
          <ol className="rks__arustitik" aria-hidden="true">
            {arus.map((a, i) => (
              <li key={a.k} style={{ left: `${x(i)}%` }}>
                <i className="is-masuk" style={{ top: `${y(a.masuk)}%` }} />
                <i className="is-beban" style={{ top: `${y(a.beban)}%` }} />
              </li>
            ))}
          </ol>
          <ol className="rks__arussentuh">
            {arus.map((a) => (
              <li
                key={a.k}
                {...ket(() => ({
                  judul: `${namaBulan(a.k)} ${a.k.slice(0, 4)}`,
                  baris: [
                    { label: "Kas masuk", nilai: formatRupiah(a.masuk) },
                    { label: "Beban", nilai: formatRupiah(a.beban) },
                    { label: a.masuk - a.beban < 0 ? "Rugi" : "Laba", nilai: formatRupiah(a.masuk - a.beban) },
                  ],
                }))}
              />
            ))}
          </ol>
        </div>
        <ol className="rks__sumbu" aria-hidden="true">
          {tanda.map((v) => (
            <li key={v} style={{ top: `${y(v)}%` }}>
              {formatRupiahRingkas(v).replace("Rp", "")}
            </li>
          ))}
        </ol>
        <ol className="rks__arusbulan" aria-hidden="true">
          {arus.map((a, i) => (
            <li key={a.k} className={i === n - 1 ? "is-ini" : undefined}>
              {BULAN_PENDEK[Number(a.k.slice(5, 7)) - 1]!.charAt(0)}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* --- Agenda empat belas hari ----------------------------------------------- */
function Agenda({ acara, ket }: { acara: Acara[]; ket: ReturnType<typeof pemberiKet> }) {
  const kini = new Date();
  const hari = Array.from({ length: 14 }, (_, i) => new Date(kini.getFullYear(), kini.getMonth(), kini.getDate() + i));
  const perHari = new Map<string, Acara[]>();
  for (const a of acara) {
    if (a.lewat) continue;
    perHari.set(a.tanggal, [...(perHari.get(a.tanggal) ?? []), a]);
  }
  const lewat = acara.filter((a) => a.lewat);
  const batas = isoHari(hari[13]!);
  const datang = acara.filter((a) => !a.lewat && a.tanggal <= batas);
  const daftar = [...lewat, ...datang].slice(0, 2);
  const sesudah = acara.find((a) => !a.lewat && a.tanggal > batas);
  const hariIni = isoHari(kini);
  return (
    <section className="rks__panel rks__agenda" aria-label="Agenda empat belas hari">
      <header className="rks__panelkop">
        <span>
          Agenda 14 hari
          {lewat.length > 0 && <b>{lewat.length} lewat</b>}
        </span>
        <a href="/admin/keuangan/tagihan">Tagihan</a>
      </header>
      <ol className="rks__hari">
        {hari.map((d) => {
          const k = isoHari(d);
          const isi = perHari.get(k) ?? [];
          return (
            <li
              key={k}
              className={[k === hariIni ? "is-ini" : "", d.getDay() === 0 ? "is-minggu" : "", isi.length ? "is-ada" : ""].filter(Boolean).join(" ") || undefined}
              {...(isi.length
                ? ket(() => ({
                    judul: `${HARI[d.getDay()]}, ${d.getDate()} ${BULAN[d.getMonth()]}`,
                    baris: isi.map((a) => ({ label: `${a.judul} · ${a.kode}`, nilai: a.nilai ? formatRupiahRingkas(a.nilai) : "tenggat" })),
                  }))
                : {})}
            >
              <small>{HARI[d.getDay()]!.charAt(0)}</small>
              <b>{d.getDate()}</b>
              <span className="rks__haritanda" aria-hidden="true">
                {isi.slice(0, 3).map((a) => (
                  <i key={a.kunci} className={`is-${a.jenis}`} />
                ))}
              </span>
            </li>
          );
        })}
      </ol>
      <ul className="rks__acara">
        {daftar.map((a) => (
          <li key={a.kunci} className={a.lewat ? "is-lewat" : undefined}>
            <a href={a.ke}>
              <span className={`rks__acaratgl is-${a.jenis}`}>
                <b>{keTgl(a.tanggal).getDate()}</b>
                <small>{BULAN_PENDEK[keTgl(a.tanggal).getMonth()]}</small>
              </span>
              <span className="rks__acarateks">
                <b>{a.judul}</b>
                <span>
                  {a.kode}
                  {a.nilai ? ` · ${formatRupiah(a.nilai)}` : ""}
                </span>
              </span>
              <small className="rks__acarawaktu">
                {a.lewat ? `lewat ${selisihHari(hariIni, a.tanggal)} hr` : a.tanggal === hariIni ? "hari ini" : `${selisihHari(a.tanggal, hariIni)} hr lagi`}
              </small>
            </a>
          </li>
        ))}
        {daftar.length === 0 && (
          <li className="rks__acarakosong">
            <Ikon ikon={CheckCircle} ukuran={16} />
            {sesudah ? `Tidak ada tenggat 14 hari ke depan — berikutnya ${tglPendek(sesudah.tanggal)}.` : "Tidak ada tenggat yang tercatat."}
          </li>
        )}
      </ul>
    </section>
  );
}

/* --- Busur target semester -------------------------------------------------- */
function BusurTarget({ hidup }: { hidup: boolean }) {
  const [target] = useKemajuanTarget();
  const p = target ? persenTarget(target) : null;
  /* "Seharusnya" = bagian semester yang sudah lewat. */
  const seharusnya = (() => {
    if (!target) return null;
    const a = keTgl(target.semesterStart).getTime();
    const z = keTgl(target.semesterEnd).getTime();
    return Math.max(0, Math.min(1, (Date.now() - a) / (z - a)));
  })();
  const R = 52;
  const panjang = Math.PI * R;
  const isi = Math.max(0, Math.min(1, (p ?? 0) / 100));
  const titik = (f: number, r: number) => [64 - r * Math.cos(Math.PI * f), 62 - r * Math.sin(Math.PI * f)] as const;
  const [sx1, sy1] = seharusnya !== null ? titik(seharusnya, R - 9) : [0, 0];
  const [sx2, sy2] = seharusnya !== null ? titik(seharusnya, R + 9) : [0, 0];
  const busur = `M ${64 - R} 62 A ${R} ${R} 0 0 1 ${64 + R} 62`;
  return (
    <section className="rks__panel rks__target" aria-label="Target semester">
      <header className="rks__panelkop">
        <span>Target {target ? labelSemester(target.semesterStart) : "semester"}</span>
        <a href="/admin/keuangan/kas">Kas Studio</a>
      </header>
      <div className="rks__busur">
        <svg viewBox="0 0 128 70" aria-hidden="true">
          <path className="rks__busurjalur" d={busur} />
          <path className="rks__busurisi" d={busur} strokeDasharray={`${panjang} ${panjang}`} strokeDashoffset={panjang * (1 - isi)} />
          {seharusnya !== null && <line className="rks__busurharus" x1={sx1} y1={sy1} x2={sx2} y2={sy2} />}
        </svg>
        <p className="rks__busurangka">
          {p === null ? "—" : <Hitung nilai={p} hidup={hidup} format={(v) => `${v.toFixed(1).replace(".", ",")}%`} />}
          <small>{target?.target ? `${formatRupiahRingkas(target.tercapai)} dari ${formatRupiahRingkas(target.target)}` : "tercapai"}</small>
        </p>
      </div>
      <p className="rks__panelket">
        {seharusnya !== null && target?.target ? (
          <>
            <i className="rks__haruslegenda" aria-hidden="true" />
            seharusnya {Math.round(seharusnya * 100)}% · {kalimatSisa(target)}
          </>
        ) : target ? (
          kalimatSisa(target)
        ) : (
          "Memuat…"
        )}
      </p>
    </section>
  );
}

function Isi() {
  const [nama, setNama] = useState<string | null>(() => bacaCache<{ studioName?: string }>("settings")?.studioName ?? null);
  const [profil, setProfil] = useState<Profil | null>(null);
  const [keu, setKeu] = useState<FinanceOverview | null>(() => bacaCache<FinanceOverview>("keuangan:semua"));
  const [bulanan, setBulanan] = useState<BarisBulanan[] | null>(() => bacaCache<BarisBulanan[]>("keuangan-bulan:semua"));
  /* Kunci `tagihan-semua` milik Tagihan & Termin — di sini cuma dibaca
     (jebakan #8). */
  const [tagihan, setTagihan] = useState<Invoice[] | null>(() => bacaCache<Invoice[]>("tagihan-semua"));
  const [notif, setNotif] = useState<IsiNotifikasi | null>(() => bacaCache<IsiNotifikasi>("dasbor-notif"));
  const [pilihId, setPilihId] = useState<string | null>(null);
  const kabar: KabarKartu = useRef(null);
  const ket = pemberiKet(kabar);
  const akar = useRef<HTMLDivElement>(null);
  const [hidup, setHidup] = useState(false);
  const lengkap = keu !== null && notif !== null && tagihan !== null && bulanan !== null;
  useEffect(() => {
    if (!lengkap || hidup) return;
    let b2 = 0;
    const b1 = requestAnimationFrame(() => (b2 = requestAnimationFrame(() => setHidup(true))));
    return () => {
      cancelAnimationFrame(b1);
      cancelAnimationFrame(b2);
    };
  }, [lengkap, hidup]);

  useEffect(() => {
    setProfil(profilTersimpan());
    ambilSettings()
      .then((s) => setNama(s.studioName))
      .catch(() => setNama((l) => l ?? "Studio"));
    ambilRingkasanKeuangan(null)
      .then((d) => {
        tulisCache("keuangan:semua", d);
        setKeu(d);
      })
      .catch(() => {});
    ambilBulanan(null, 24)
      .then((d) => {
        tulisCache("keuangan-bulan:semua", d);
        setBulanan(d);
      })
      .catch(() => setBulanan((l) => l ?? []));
    semuaTagihan()
      .then(setTagihan)
      .catch(() => setTagihan((l) => l ?? []));
    ambilNotifikasi()
      .then((d) => {
        tulisCache("dasbor-notif", d);
        setNotif(d);
      })
      .catch(() => setNotif((l) => l ?? { notifikasi: [], milestone: [], proyekAktif: 0, proyek: [] }));
  }, []);

  /* Escape menutup laci — kecuali ada dialog terbuka. */
  useEffect(() => {
    if (!pilihId) return;
    const f = (e: globalThis.KeyboardEvent) => {
      if (e.key !== "Escape" || document.querySelector("[role=dialog]")) return;
      setPilihId(null);
    };
    window.addEventListener("keydown", f);
    return () => window.removeEventListener("keydown", f);
  }, [pilihId]);

  const hariIni = isoHari(new Date());

  /* --- Proyek berjalan (definisi yang sama dengan penghitung lib/notifikasi). */
  const jalan = useMemo(() => (notif?.proyek ?? []).filter((p) => p.pipelineStage && p.pipelineStage !== "pelunasan"), [notif]);
  const jalur = useMemo<Jalur[]>(() => {
    const keuP = new Map((keu?.proyek ?? []).map((r) => [r.projectId, r]));
    return jalan
      .map((p): Jalur => {
        const r = keuP.get(p.id);
        const inv = (tagihan ?? []).filter((t) => t.projectId === p.id).sort((a, b) => a.sortOrder - b.sortOrder);
        const jumlahInv = inv.reduce((n, t) => n + t.amount, 0);
        const kontrak = Math.max(p.contractValue ?? r?.contractValue ?? 0, jumlahInv);
        const termin: Termin[] = inv.map((t) => {
          const status: StatusTermin =
            t.status === "lunas" ? "lunas" : t.status === "terbit" ? (t.dueDate && t.dueDate < hariIni ? "lewat" : "terbit") : "draf";
          return {
            id: t.id,
            label: t.label,
            nilai: t.amount,
            status,
            tanggal: status === "lunas" ? (t.paidAt ? keHari(t.paidAt) : (t.dueDate ?? null)) : (t.dueDate ?? null),
          };
        });
        const tanggal = [...termin.map((t) => t.tanggal), ...inv.map((t) => t.dueDate ?? null), p.deadlinePreview ?? null, p.deadlineFinal ?? null].filter(
          (d): d is string => Boolean(d),
        );
        tanggal.sort();
        const mulai = tanggal[0] ?? isoHari(new Date(Date.now() - 30 * HARI_MS));
        let selesai = tanggal[tanggal.length - 1] ?? isoHari(new Date(Date.now() + 60 * HARI_MS));
        if (selesai <= mulai) selesai = isoHari(new Date(keTgl(mulai).getTime() + 30 * HARI_MS));
        const diterima = r?.received ?? p.paidTotal ?? 0;
        const biaya = r?.costsTotal ?? 0;
        return {
          p,
          kode: kodeProyek(p.title),
          kontrak,
          diterima,
          biaya,
          laba: r?.labaBersih ?? diterima - biaya,
          persen: kontrak > 0 ? (diterima / kontrak) * 100 : 0,
          lewat: termin.filter((t) => t.status === "lewat").reduce((n, t) => n + t.nilai, 0),
          tahap: Math.max(0, URUT_TAHAP.indexOf(p.pipelineStage ?? "")),
          mulai,
          selesai,
          termin,
          preview: p.deadlinePreview ?? null,
          final: p.deadlineFinal ?? null,
        };
      })
      .sort((a, b) => (a.mulai < b.mulai ? -1 : a.mulai > b.mulai ? 1 : 0));
  }, [jalan, keu, tagihan, hariIni]);
  const terpilih = jalur.find((j) => j.p.id === pilihId);

  /* Di layar sempit laci ada di bawah jadwal — digulir ke sana saat dibuka. */
  useLayoutEffect(() => {
    if (!pilihId || !window.matchMedia("(max-width: 1288px)").matches) return;
    akar.current?.querySelector(".rks__kanan")?.scrollIntoView({ block: "nearest", behavior: geraknya() ? "smooth" : "auto" });
  }, [pilihId]);

  /* --- Bulanan: kop dan arus kas. --------------------------------------- */
  const peta = useMemo(() => new Map((bulanan ?? []).map((b) => [b.bulan, b])), [bulanan]);
  const arus = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => {
        const k = kunciBulan(11 - i);
        const b = peta.get(k);
        return { k, masuk: b?.kasMasuk ?? 0, beban: b?.biaya ?? 0 };
      }),
    [peta],
  );
  const ini = arus[11]!;
  const lalu = arus[10]!;
  const enam = arus.slice(6);

  /* --- Agenda: tenggat proyek + termin terbit/draf. ---------------------- */
  const acara = useMemo<Acara[]>(() => {
    const out: Acara[] = [];
    for (const j of jalur) {
      const ke = `/admin/proyek/satu?id=${encodeURIComponent(j.p.id)}`;
      if (j.preview && j.preview >= hariIni)
        out.push({ kunci: `${j.p.id}-pv`, tanggal: j.preview, jenis: "preview", judul: "Tenggat preview", kode: j.kode, nilai: null, lewat: false, ke });
      if (j.final && (j.final >= hariIni || j.tahap < I_FINISH))
        out.push({ kunci: `${j.p.id}-fn`, tanggal: j.final, jenis: "final", judul: "Tenggat final", kode: j.kode, nilai: null, lewat: j.final < hariIni, ke });
      for (const t of j.termin) {
        if (t.status === "lunas" || !t.tanggal) continue;
        const lewat = t.status === "lewat";
        if (!lewat && t.tanggal < hariIni) continue;
        out.push({
          kunci: t.id,
          tanggal: t.tanggal,
          jenis: "tempo",
          judul: t.label.replace(/\s—.*$/, ""),
          kode: j.kode,
          nilai: t.nilai,
          lewat,
          ke: `/admin/keuangan/tagihan?termin=${encodeURIComponent(t.id)}`,
        });
      }
    }
    return out.sort((a, b) => (a.lewat !== b.lewat ? (a.lewat ? -1 : 1) : a.tanggal < b.tanggal ? -1 : a.tanggal > b.tanggal ? 1 : 0));
  }, [jalur, hariIni]);

  /* --- Kop. ---------------------------------------------------------------- */
  const lewatTempo = jalur.flatMap((j) => j.termin.filter((t) => t.status === "lewat"));
  const nilaiLewat = lewatTempo.reduce((n, t) => n + t.nilai, 0);
  const kontrakJalan = jalur.reduce((n, j) => n + j.kontrak, 0);
  const sebaran = URUT_TAHAP.slice(0, -1).map((t) => jalan.filter((p) => p.pipelineStage === t).length);
  const persenJalan = kontrakJalan > 0 ? (jalur.reduce((n, j) => n + j.diterima, 0) / kontrakJalan) * 100 : 0;
  const kini = new Date();
  const butir = useMemo(() => {
    const semua = [...(notif?.notifikasi ?? [])];
    semua.sort((a, b) => (b.tanggal ? new Date(b.tanggal).getTime() : 0) - (a.tanggal ? new Date(a.tanggal).getTime() : 0));
    return semua;
  }, [notif]);
  const sentuhGaris = (judul: string, f: (a: (typeof arus)[number]) => number) =>
    ket(() => ({ judul, baris: enam.map((a) => ({ label: namaBulan(a.k), nilai: formatRupiah(f(a)) })) }));
  const pemegang = profil?.email ? profil.email.split("@")[0] : null;

  return (
    <div className="rks" ref={akar}>
      <div className="rks__papan">
        {/* ---- Kop gambar --------------------------------------------------- */}
        <header className="rks__kop" aria-label="Kop ruang kendali">
          <div className="rks__kotakjudul">
            <p className="rks__alis">Ruang kendali studio</p>
            <p className="rks__studio">{nama ?? "Studio"}</p>
            <dl>
              <div>
                <dt>Tanggal</dt>
                <dd>
                  {HARI[kini.getDay()]}, {kini.getDate()} {BULAN[kini.getMonth()]} {kini.getFullYear()}
                </dd>
              </div>
              <div>
                <dt>Diperiksa</dt>
                <dd>
                  {pemegang ?? "—"}
                  {profil ? (profil.isMasterAdmin ? " · master" : " · staf") : ""}
                </dd>
              </div>
            </dl>
          </div>
          <SelKop
            nomor="01"
            label={`Kas masuk · ${namaBulan(ini.k)}`}
            ket={`${namaBulan(lalu.k)} ${formatRupiahRingkas(lalu.masuk)}`}
            sentuh={sentuhGaris("Kas masuk 6 bulan", (a) => a.masuk)}
          >
            <p className="rks__selangka">{bulanan ? <Hitung nilai={ini.masuk} hidup={hidup} format={formatRupiah} /> : "—"}</p>
            <Garis id="rks-g1" nilai={enam.map((a) => a.masuk)} />
          </SelKop>
          <SelKop
            nomor="02"
            label={`Beban · ${namaBulan(ini.k)}`}
            ket={`${namaBulan(lalu.k)} ${formatRupiahRingkas(lalu.beban)}`}
            className="is-beban"
            sentuh={sentuhGaris("Beban 6 bulan", (a) => a.beban)}
          >
            <p className="rks__selangka">{bulanan ? <Hitung nilai={ini.beban} hidup={hidup} format={formatRupiah} /> : "—"}</p>
            <Garis id="rks-g2" nilai={enam.map((a) => a.beban)} />
          </SelKop>
          <SelKop
            nomor="03"
            label={`Laba bersih · ${namaBulan(ini.k)}`}
            ket={`${namaBulan(lalu.k)} ${formatRupiahRingkas(lalu.masuk - lalu.beban)}`}
            className={ini.masuk - ini.beban < 0 ? "is-minus" : undefined}
            sentuh={sentuhGaris("Laba bersih 6 bulan", (a) => a.masuk - a.beban)}
          >
            <p className="rks__selangka">{bulanan ? <Hitung nilai={ini.masuk - ini.beban} hidup={hidup} format={formatRupiah} /> : "—"}</p>
            <Garis id="rks-g3" nilai={enam.map((a) => a.masuk - a.beban)} />
          </SelKop>
          <SelKop
            nomor="04"
            label="Piutang klien"
            className={nilaiLewat ? "is-waspada" : undefined}
            ket={
              nilaiLewat ? (
                <>
                  <i className="rks__titikamber" aria-hidden="true" />
                  {lewatTempo.length} termin lewat · {formatRupiahRingkas(nilaiLewat)}
                </>
              ) : (
                "tidak ada yang lewat tempo"
              )
            }
          >
            <p className="rks__selangka">{keu ? <Hitung nilai={keu.piutang} hidup={hidup} format={formatRupiah} /> : "—"}</p>
            <span className="rks__meter" aria-hidden="true">
              <i style={{ width: `${keu && keu.piutang ? Math.min(100, (nilaiLewat / keu.piutang) * 100) : 0}%` }} />
            </span>
          </SelKop>
          <SelKop
            nomor="05"
            label="Proyek berjalan"
            ket={`kontrak ${formatRupiahRingkas(kontrakJalan)} · ${persenTeks(Math.round(persenJalan))} masuk`}
            sentuh={ket(() => ({
              judul: "Sebaran tahap",
              baris: URUT_TAHAP.slice(0, -1).map((t, i) => ({ label: TAHAP_PROYEK[t] ?? t, nilai: `${sebaran[i]} proyek` })),
            }))}
          >
            <p className="rks__selangka">
              {notif ? <Hitung nilai={jalan.length} hidup={hidup} format={(v) => String(Math.round(v))} /> : "—"}
              <small> proyek</small>
            </p>
            <span className="rks__meter is-mint" aria-hidden="true">
              <i style={{ width: `${Math.min(100, persenJalan)}%` }} />
            </span>
          </SelKop>
        </header>

        {/* ---- Jadwal induk + kanan (arus kas / laci detail) --------------- */}
        <Jadwal jalur={jalur} pilih={pilihId} onPilih={setPilihId} ket={ket} />
        <div className="rks__kanan">
          <ArusKas arus={arus} hidup={hidup} ket={ket} />
          <Laci j={terpilih} hidup={hidup} onTutup={() => setPilihId(null)} />
        </div>

        {/* ---- Baris bawah -------------------------------------------------- */}
        <div className="rks__bawah">
          <Agenda acara={acara} ket={ket} />
          <section className="rks__panel rks__perlu" aria-label="Perlu ditangani">
            <header className="rks__panelkop">
              <span>
                Perlu ditangani
                {butir.length ? <b>{butir.length}</b> : null}
              </span>
              <a href="/admin/notifikasi">Semua</a>
            </header>
            {notif && butir.length === 0 && (
              <p className="rks__beres">
                <Ikon ikon={CheckCircle} ukuran={16} />
                Semua sudah ditangani.
              </p>
            )}
            <ul>
              {butir.slice(0, 3).map((n) => (
                <li key={n.id}>
                  <a href={n.ke}>
                    <span className="rks__perluikon">
                      <Ikon ikon={ikonButir(n)} ukuran={14} />
                    </span>
                    <span className="rks__perluteks">
                      <b>{n.judul}</b>
                      <span>{n.detail}</span>
                    </span>
                    <small>{n.tanggal ? `${kepalaHari(n.tanggal)} ${waktuButir(n)}` : ""}</small>
                  </a>
                </li>
              ))}
            </ul>
          </section>
          <BusurTarget hidup={hidup} />
          <nav className="rks__pintas" aria-label="Aksi cepat">
            <a href="/admin/keuangan/terima">
              <Ikon ikon={CoinIn} ukuran={16} />
              Terima bayar
            </a>
            <a href="/admin/keuangan/keluar">
              <Ikon ikon={CoinOut} ukuran={16} />
              Catat biaya
            </a>
            <a href="/admin/keuangan/tagihan">
              <Ikon ikon={NavReceipt} ukuran={16} />
              Tagihan
            </a>
            <a href="/admin/keuangan/transaksi">
              <Ikon ikon={Clock} ukuran={16} />
              Riwayat
            </a>
          </nav>
        </div>
      </div>
      <Keterangan kabar={kabar} />
    </div>
  );
}

export function DashboardKit() {
  return (
    <RequireAuth
      skeleton={
        <div className="rks rks--rangka">
          <div className="rks__papan" />
        </div>
      }
    >
      <Isi />
    </RequireAuth>
  );
}
