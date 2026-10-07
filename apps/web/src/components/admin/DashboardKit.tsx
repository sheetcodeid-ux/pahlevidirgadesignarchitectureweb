import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { RequireAuth } from "./RequireAuth";
import { useKemajuanTarget, persenTarget, kalimatSisa } from "./targetKit";
import { Keterangan, pemberiKet, type KabarKartu } from "../kit/kartuGrafik";
import { Ikon } from "../kit/Ikon";
import { CheckCircle, Clock, CoinIn, CoinOut, NavReceipt } from "../kit/ikon";
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
   Dashboard = TAMPAK KAWASAN STUDIO.

   Pandangan pertama studio arsitektur atas dirinya sendiri: semua proyek
   yang sedang berjalan berdiri berderet sebagai BANGUNAN di satu gambar
   tampak jalan, di atas papan hijau berjahit (bahasa halaman keuangan yang
   sudah di-ACC). Tiap bangunan membawa data sungguhan:

   - TINGGI = nilai kontrak, pada skala peil di kiri (garis +100 jt, +200 jt…);
   - LANTAI = termin, dari bawah menurut urutannya, setinggi bagian kontrak
     yang ditagihkannya: mint pejal = lunas, amber berarsir = lewat tempo,
     garis terang = terbit, garis putus = draf, arsir tipis di puncak = bagian
     kontrak yang belum ditagihkan;
   - ATAP menurut jenis proyek (rumah berpelana, coffee shop berkanopi,
     lainnya beratap datar);
   - di atas atap: persen kontrak yang sudah dibayar; di bawah garis tanah:
     kode, nama, tahap.

   Bangunan yang dipilih (klik, Enter, panah) MEMPERLIHATKAN SISINYA — sisi
   samping tumbuh dari tepi kanannya seperti maket yang diputar tiga
   perempat. Itu satu-satunya gerak 3D, hanya saat pilihan berubah,
   seketika bila gerak dikurangi. Di kanan, MAP PROYEK (kertas putih tetap)
   membuka bangunan itu: klien, tahap, kontrak / diterima / biaya / laba,
   daftar termin, tenggat, dan jalan pintas.

   Di bawah gambar, empat panel: kas studio (kartu yang miring disentuh),
   arus kas dua belas bulan, target semester, dan yang perlu ditangani.

   Tidak ada tulisan di atas gambar bangunan: persen di langit di atas atap,
   label di bawah garis tanah, angka peil di margin kiri (jebakan #70).
   ============================================================================= */

const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const BULAN_PENDEK = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
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
/** Bangunan paling banyak di satu tampak — sisanya disebut di kepala. */
const MAKS_GEDUNG = 8;

type StatusLantai = "lunas" | "lewat" | "terbit" | "draf" | "sisa";
interface Lantai {
  kunci: string;
  label: string;
  nilai: number;
  status: StatusLantai;
  tanggal: string | null;
}
interface Gedung {
  p: Proyek;
  kode: string;
  kontrak: number;
  diterima: number;
  biaya: number;
  laba: number;
  lantai: Lantai[];
  persen: number;
  lewat: number;
}

const hariIni = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const tglPendek = (iso: string | null | undefined) => {
  if (!iso) return "—";
  const d = new Date(iso.length === 10 ? iso + "T00:00:00" : iso);
  return `${d.getDate()} ${BULAN_PENDEK[d.getMonth()]} ${d.getFullYear()}`;
};
const kunciBulan = (mundur: number) => {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - mundur);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};
const persenTeks = (v: number) => `${v.toFixed(v % 1 ? 1 : 0).replace(".", ",")}%`;
const LABEL_STATUS: Record<StatusLantai, string> = {
  lunas: "Lunas",
  lewat: "Lewat tempo",
  terbit: "Terbit",
  draf: "Draf",
  sisa: "Belum ditagihkan",
};

/** Langkah peil yang enak dibaca: 1/2/2,5/5 × 10^k. */
function langkahRapi(maks: number, banyak: number) {
  const kasar = maks / Math.max(1, banyak);
  const p = 10 ** Math.floor(Math.log10(kasar || 1));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= kasar) return m * p;
  return 10 * p;
}

/* -----------------------------------------------------------------------------
   Gambar tampak. Ukurannya dibaca ResizeObserver (bukan saat menggulir —
   jebakan #21). Bangunan digambar di SVG; tombol HTML transparan di atas
   tiap bangunan memegang klik, papan ketik, kartu keterangan, dan label
   teksnya (di langit dan di bawah tanah, tidak pernah di atas gambar).
   -------------------------------------------------------------------------- */
function Tampak({
  gedung,
  pilih,
  onPilih,
  ket,
}: {
  gedung: Gedung[];
  pilih: number;
  onPilih: (i: number) => void;
  ket: ReturnType<typeof pemberiKet>;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const tombol = useRef<(HTMLButtonElement | null)[]>([]);
  const [uk, setUk] = useState({ w: 760, h: 330 });
  const [sorot, setSorot] = useState<number | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setUk({ w: Math.round(e!.contentRect.width), h: Math.round(e!.contentRect.height) }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { w, h } = uk;
  const KIRI = 56;
  const KANAN = 26;
  const LANGIT = 44; // ruang angka persen di atas atap tertinggi (+ sisi samping atap)
  const BAWAH = 48; // ruang label di bawah garis tanah
  const tanah = h - BAWAH;
  const atap = 24;
  const tinggiPlot = Math.max(60, tanah - LANGIT - atap);
  const maksKontrak = Math.max(1, ...gedung.map((g) => g.kontrak));
  const langkah = langkahRapi(maksKontrak, 3);
  const skala = Math.ceil(maksKontrak / langkah) * langkah;
  const y = (v: number) => tanah - (v / skala) * tinggiPlot;
  const n = Math.max(1, gedung.length);
  const celah = n > 6 ? 20 : 30;
  const lebar = Math.max(40, Math.min(128, (w - KIRI - KANAN - celah * (n - 1)) / n));
  const mulai = KIRI + (w - KIRI - KANAN - (lebar * n + celah * (n - 1))) / 2;
  const xg = (i: number) => mulai + i * (lebar + celah);
  const peil: number[] = [];
  for (let v = langkah; v <= skala + 1; v += langkah) peil.push(v);
  const dalam = Math.min(celah - 8, lebar * 0.18); // kedalaman sisi samping
  const tinggiAtap = (g: Gedung) => (g.p.category === "residential" ? Math.min(atap, lebar * 0.32) : 6);
  /* Persen di langit duduk di atas sisi samping atap (yang naik dalam × 0,6
     saat dipilih), jadi tidak pernah menumpang di atas gambar. */
  const atasTombol = (g: Gedung) => y(g.kontrak) - tinggiAtap(g) - 26 - dalam * 0.6;
  /* Lubang di kisi dan garis peil tempat persen berdiri: garis berhenti di
     tepi keping, tidak lewat di belakang angkanya (jebakan #70). */
  const lubang =
    `M 0 0 H ${w} V ${tanah} H 0 Z ` +
    gedung.map((g, i) => `M ${xg(i) + lebar / 2 - 30} ${atasTombol(g) - 2} h 60 v 25 h -60 Z`).join(" ");

  function tombolKunci(e: KeyboardEvent<HTMLButtonElement>, i: number) {
    const ke = e.key === "ArrowRight" ? i + 1 : e.key === "ArrowLeft" ? i - 1 : e.key === "Home" ? 0 : e.key === "End" ? gedung.length - 1 : null;
    if (ke === null) return;
    e.preventDefault();
    const j = Math.max(0, Math.min(gedung.length - 1, ke));
    onPilih(j);
    tombol.current[j]?.focus();
  }

  return (
    <div className="tkw__gambar" ref={ref}>
      <svg className="tkw__svg" width={w} height={h} aria-hidden="true">
        <defs>
          <pattern id="tkw-arsir-lewat" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="6" height="6" className="tkw__arsir-lewat-dasar" />
            <line x1="0" y1="0" x2="0" y2="6" className="tkw__arsir-lewat" />
          </pattern>
          <pattern id="tkw-arsir-sisa" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
            <line x1="0" y1="0" x2="0" y2="5" className="tkw__arsir-sisa" />
          </pattern>
          {/* Kusen jendela: garis tegak di muka bangunan, jadi lantai terbaca sebagai fasad kaca. */}
          <pattern id="tkw-kusen" width="14" height="10" patternUnits="userSpaceOnUse">
            <line x1="13" y1="0" x2="13" y2="10" className="tkw__kusen" />
          </pattern>
          <pattern id="tkw-kanopi" width="12" height="12" patternUnits="userSpaceOnUse">
            <rect width="6" height="12" className="tkw__kanopi-a" />
            <rect x="6" width="6" height="12" className="tkw__kanopi-b" />
          </pattern>
          <pattern id="tkw-kisi" width="24" height="24" patternUnits="userSpaceOnUse">
            <path d="M 24 0 V 24 M 0 24 H 24" className="tkw__kisi" />
          </pattern>
          <clipPath id="tkw-lubang">
            <path d={lubang} clipRule="evenodd" />
          </clipPath>
          <pattern id="tkw-tanah" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="8" className="tkw__arsir-tanah" />
          </pattern>
        </defs>
        {/* Kertas milimeter hanya di bidang gambar (di atas tanah); garis peil
            (elevasi) — angka di margin kiri, garisnya di belakang bangunan. */}
        <g clipPath="url(#tkw-lubang)">
          <rect x={KIRI - 4} y={0} width={w - KIRI + 4} height={tanah} fill="url(#tkw-kisi)" />
          {peil.map((v) => (
            <line key={v} className="tkw__peil" x1={KIRI - 4} x2={w - KANAN + 10} y1={y(v)} y2={y(v)} />
          ))}
        </g>
        {peil.map((v) => (
          <path key={v} className="tkw__peiltanda" d={`M ${KIRI - 12} ${y(v) - 6} h 8 l -4 6 z`} />
        ))}
        {/* Tanah. */}
        <rect x={KIRI - 4} y={tanah} width={w - KIRI - KANAN + 22} height={7} fill="url(#tkw-tanah)" />
        <line className="tkw__tanahgaris" x1={KIRI - 4} x2={w - KANAN + 18} y1={tanah} y2={tanah} />

        {gedung.map((g, i) => {
          const x = xg(i);
          const atas = y(g.kontrak);
          const jenis = g.p.category;
          let dasar = tanah;
          const lantai = g.lantai.map((l) => {
            const tg = Math.max(3, (l.nilai / (g.kontrak || 1)) * (tanah - atas));
            const r = { l, y: dasar - tg, t: tg };
            dasar -= tg;
            return r;
          });
          const puncak = Math.min(atas, dasar);
          const tinggi = tanah - puncak;
          return (
            <g key={g.p.id} className={`tkw__gedung${i === pilih ? " is-pilih" : ""}${sorot === i ? " is-sorot" : ""}`}>
              {/* Sisi samping: tumbuh dari tepi kanan saat dipilih — lantainya
                  ikut terlihat dari samping, atap pelana memperlihatkan bidang
                  miringnya. */}
              <g className="tkw__sisi" style={{ transformOrigin: `${x + lebar}px ${tanah}px` } as CSSProperties}>
                <path
                  className="tkw__sisibidang"
                  d={`M ${x + lebar} ${tanah} L ${x + lebar + dalam} ${tanah - dalam * 0.6} L ${x + lebar + dalam} ${puncak - dalam * 0.6} L ${x + lebar} ${puncak} Z`}
                />
                {lantai.map(({ l, y: ly, t }) => (
                  <path
                    key={l.kunci}
                    className={`tkw__sisilantai tkw__lantai--${l.status}`}
                    d={`M ${x + lebar} ${ly + t - 1.5} L ${x + lebar + dalam} ${ly + t - 1.5 - dalam * 0.6} L ${x + lebar + dalam} ${ly + 1.5 - dalam * 0.6} L ${x + lebar} ${ly + 1.5} Z`}
                    fill={l.status === "lewat" ? "url(#tkw-arsir-lewat)" : l.status === "sisa" ? "url(#tkw-arsir-sisa)" : undefined}
                  />
                ))}
                {jenis === "residential" ? (
                  <path
                    className="tkw__sisiatap"
                    d={`M ${x + lebar / 2} ${puncak - tinggiAtap(g)} L ${x + lebar / 2 + dalam} ${puncak - tinggiAtap(g) - dalam * 0.6} L ${x + lebar + 5 + dalam} ${puncak - dalam * 0.6} L ${x + lebar + 5} ${puncak} Z`}
                  />
                ) : (
                  <path className="tkw__sisiatap" d={`M ${x - 3} ${puncak - 6} L ${x - 3 + dalam} ${puncak - 6 - dalam * 0.6} L ${x + lebar + 3 + dalam} ${puncak - 6 - dalam * 0.6} L ${x + lebar + 3} ${puncak - 6} Z`} />
                )}
              </g>
              {/* Badan bangunan (bidang dasar pejal supaya garis peil tidak tembus). */}
              <rect className="tkw__badan" x={x} y={puncak} width={lebar} height={tinggi} />
              {lantai.map(({ l, y: ly, t }) => (
                <rect
                  key={l.kunci}
                  className={`tkw__lantai tkw__lantai--${l.status}`}
                  x={x + 3}
                  y={ly + 1.5}
                  width={lebar - 6}
                  height={Math.max(1, t - 3)}
                  fill={l.status === "lewat" ? "url(#tkw-arsir-lewat)" : l.status === "sisa" ? "url(#tkw-arsir-sisa)" : undefined}
                />
              ))}
              <rect className="tkw__fasad" x={x + 3} y={puncak + 1.5} width={lebar - 6} height={Math.max(1, tinggi - 3)} fill="url(#tkw-kusen)" />
              {/* Pintu di lantai dasar. */}
              <rect
                className="tkw__pintu"
                x={x + lebar / 2 - Math.min(9, lebar * 0.1)}
                y={tanah - Math.min(20, tinggi * 0.3)}
                width={Math.min(18, lebar * 0.2)}
                height={Math.min(20, tinggi * 0.3)}
              />
              {/* Atap menurut jenis. */}
              {jenis === "residential" ? (
                <path className="tkw__atap" d={`M ${x - 5} ${puncak} L ${x + lebar / 2} ${puncak - tinggiAtap(g)} L ${x + lebar + 5} ${puncak} Z`} />
              ) : (
                <rect className="tkw__atap" x={x - 3} y={puncak - 6} width={lebar + 6} height={6} />
              )}
              {jenis === "coffeeshop" && (
                <path className="tkw__kanopi" fill="url(#tkw-kanopi)" d={`M ${x - 7} ${tanah - Math.min(34, tinggi * 0.5)} h ${lebar + 14} l -6 9 h ${-(lebar + 2)} z`} />
              )}
              <rect className="tkw__garisluar" x={x} y={puncak} width={lebar} height={tinggi} />
            </g>
          );
        })}
      </svg>

      {/* Tombol & label per bangunan. */}
      {gedung.map((g, i) => {
        const x = xg(i);
        const atas = atasTombol(g);
        const k = ket(() => ({
          judul: g.p.title,
          baris: [
            { label: "Kontrak", nilai: formatRupiah(g.kontrak) },
            { label: "Diterima", nilai: `${formatRupiah(g.diterima)} · ${persenTeks(g.persen)}` },
            { label: "Biaya", nilai: formatRupiah(g.biaya) },
            { label: "Laba bersih", nilai: formatRupiah(g.laba) },
            ...(g.lewat ? [{ label: "Lewat tempo", nilai: formatRupiah(g.lewat) }] : []),
          ],
        }));
        return (
          <button
            key={g.p.id}
            ref={(el) => {
              tombol.current[i] = el;
            }}
            type="button"
            className={`tkw__tombol${i === pilih ? " is-pilih" : ""}`}
            style={{ left: x - 6, width: lebar + 12, top: atas, height: h - atas } as CSSProperties}
            aria-pressed={i === pilih}
            aria-label={`${g.p.title}: kontrak ${formatRupiah(g.kontrak)}, diterima ${persenTeks(g.persen)}`}
            tabIndex={i === pilih ? 0 : -1}
            onClick={() => onPilih(i)}
            onKeyDown={(e) => tombolKunci(e, i)}
            {...k}
            onPointerEnter={(e) => {
              k.onPointerEnter(e);
              if (e.pointerType === "mouse") setSorot(i);
            }}
            onPointerLeave={(e) => {
              k.onPointerLeave(e);
              if (e.pointerType === "mouse") setSorot(null);
            }}
          >
            <span className={`tkw__persen${g.lewat ? " is-lewat" : ""}`}>{persenTeks(g.persen)}</span>
            <span className="tkw__label" style={{ height: BAWAH }}>
              <b>{g.kode}</b>
              <span>{g.p.title}</span>
              <small>{TAHAP_PROYEK[g.p.pipelineStage ?? ""] ?? "—"}</small>
            </span>
          </button>
        );
      })}

      <ol className="tkw__peilangka" aria-hidden="true">
        {peil.map((v) => (
          <li key={v} style={{ top: y(v) }}>
            {formatRupiahRingkas(v).replace("Rp", "+")}
          </li>
        ))}
        <li style={{ top: tanah }} className="is-nol">
          ±0
        </li>
      </ol>
    </div>
  );
}

/* --- Map proyek (kertas putih tetap) --------------------------------------- */
function MapProyek({ g, hidup, gerak }: { g: Gedung | undefined; hidup: boolean; gerak: boolean }) {
  if (!g) return <section className="tkw__map tkw__map--kosong">Belum ada proyek berjalan.</section>;
  const iTahap = URUT_TAHAP.indexOf(g.p.pipelineStage ?? "");
  const tagihan = g.lantai.filter((l) => l.status !== "sisa");
  return (
    <section className="tkw__map" aria-label={`Map proyek ${g.p.title}`}>
      <div className={`tkw__mapisi${gerak ? " is-gerak" : ""}`} key={g.p.id}>
        <header className="tkw__mapkop">
          <p className="tkw__alis">
            Map proyek · <b>{g.kode}</b>
          </p>
          <h2>{g.p.title}</h2>
          <p className="tkw__mapket">{[g.p.client, g.p.city, JENIS[g.p.category] ?? g.p.category].filter(Boolean).join(" · ")}</p>
        </header>
        <ol className="tkw__tangga" aria-label={`Tahap: ${TAHAP_PROYEK[g.p.pipelineStage ?? ""] ?? "—"}`}>
          {URUT_TAHAP.map((t, i) => (
            <li key={t} className={i < iTahap ? "is-lewat" : i === iTahap ? "is-kini" : undefined} title={TAHAP_PROYEK[t]} />
          ))}
        </ol>
        <p className="tkw__tahap">
          Tahap <b>{TAHAP_PROYEK[g.p.pipelineStage ?? ""] ?? "—"}</b>
          {g.p.deadlineFinal && <span> · final {tglPendek(g.p.deadlineFinal)}</span>}
        </p>
        <dl className="tkw__angka">
          <div>
            <dt>Kontrak</dt>
            <dd>{formatRupiah(g.kontrak)}</dd>
          </div>
          <div>
            <dt>Diterima</dt>
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
        <div className="tkw__mapmeter" role="img" aria-label={`${persenTeks(g.persen)} kontrak diterima`}>
          <i style={{ width: `${Math.min(100, g.persen)}%` }} />
        </div>
        <ul className="tkw__termin" aria-label="Termin">
          {tagihan.length === 0 && <li className="tkw__terminkosong">Belum ada termin.</li>}
          {tagihan.map((l) => (
            <li key={l.kunci} className={`is-${l.status}`}>
              <i aria-hidden="true" />
              <span>{l.label}</span>
              <small>{l.status === "lunas" ? `lunas ${tglPendek(l.tanggal)}` : l.tanggal ? `tempo ${tglPendek(l.tanggal)}` : LABEL_STATUS[l.status]}</small>
              <b>{formatRupiahRingkas(l.nilai)}</b>
            </li>
          ))}
        </ul>
        <p className="tkw__mapaksi">
          <a href={`/admin/proyek/satu?id=${encodeURIComponent(g.p.id)}`}>Buka proyek</a>
          <a href={`/admin/keuangan/tagihan?proyek=${encodeURIComponent(g.p.id)}`}>Tagihan</a>
          <a href={`/admin/keuangan/terima?proyek=${encodeURIComponent(g.p.id)}`}>Terima bayar</a>
        </p>
      </div>
    </section>
  );
}

/* --- Kartu kas studio (miring disentuh) ------------------------------------
   Satu-satunya benda yang "disentuh" di bawah gambar: miring ±7° mengikuti
   tetikus, bayangannya bergeser berlawanan. Sudut ditulis ke variabel CSS
   lewat ref (tanpa render ulang), kotak dibaca sekali saat kursor masuk.
   Tetikus saja (jebakan #9), diam bila gerak dikurangi. */
function KartuKas({ nama, profil, keu, jalan, hidup }: { nama: string | null; profil: Profil | null; keu: FinanceOverview | null; jalan: number; hidup: boolean }) {
  const ref = useRef<HTMLElement>(null);
  const kotak = useRef<DOMRect | null>(null);
  const miring = (rx: number, ry: number) => {
    ref.current?.style.setProperty("--kas-rx", `${rx.toFixed(2)}deg`);
    ref.current?.style.setProperty("--kas-ry", `${ry.toFixed(2)}deg`);
  };
  const masuk = keu?.kasMasuk ?? 0;
  const piutang = keu?.piutang ?? 0;
  const pct = masuk + piutang > 0 ? (masuk / (masuk + piutang)) * 100 : 0;
  return (
    <article
      ref={ref}
      className="tkw__kas"
      aria-label="Kas studio"
      onPointerEnter={(e) => {
        if (e.pointerType !== "mouse" || !geraknya()) return;
        kotak.current = e.currentTarget.getBoundingClientRect();
        e.currentTarget.classList.add("is-angkat");
      }}
      onPointerMove={(e) => {
        const k = kotak.current;
        if (e.pointerType !== "mouse" || !k) return;
        miring(-((e.clientY - k.top) / k.height - 0.5) * 14, ((e.clientX - k.left) / k.width - 0.5) * 14);
      }}
      onPointerLeave={(e) => {
        kotak.current = null;
        e.currentTarget.classList.remove("is-angkat");
        miring(0, 0);
      }}
    >
      <p className="tkw__kasatas">
        <b>{nama ?? "Studio"}</b>
        <span>{profil?.isMasterAdmin ? "Master admin" : profil ? "Staf" : ""}</span>
      </p>
      <p className="tkw__kasket">Kas masuk</p>
      <p className="tkw__kasnilai">{keu ? <Hitung nilai={masuk} hidup={hidup} format={formatRupiah} /> : "—"}</p>
      <div className="tkw__kasmeter" role="img" aria-label={`${Math.round(pct)}% tagihan sudah masuk`}>
        <i style={{ width: `${pct}%` }} />
      </div>
      <p className="tkw__kaskaki">
        <span>
          <i className="is-masuk" aria-hidden="true" />
          {Math.round(pct)}% tagihan masuk
        </span>
        <span>
          <i className="is-piutang" aria-hidden="true" />
          Piutang {keu ? formatRupiahRingkas(piutang) : "—"}
        </span>
      </p>
      <p className="tkw__kasproyek">{jalan} proyek berjalan</p>
    </article>
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
  const [target] = useKemajuanTarget();
  const [pilihId, setPilihId] = useState<string | null>(null);
  /* Map baru bergeser masuk hanya sesudah orang memilih — tidak saat muat. */
  const [pernahPilih, setPernahPilih] = useState(false);
  const kabar: KabarKartu = useRef(null);
  const ket = pemberiKet(kabar);
  const [hidup, setHidup] = useState(false);
  const lengkap = keu !== null && notif !== null && tagihan !== null;
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

  /* --- Bangunan: proyek yang belum sampai pelunasan (definisi yang sama
         dengan penghitung proyek di lib/notifikasi). --------------------- */
  const semuaJalan = useMemo(
    () => (notif?.proyek ?? []).filter((p) => p.pipelineStage && p.pipelineStage !== "pelunasan"),
    [notif],
  );
  const gedung = useMemo<Gedung[]>(() => {
    const keuP = new Map((keu?.proyek ?? []).map((r) => [r.projectId, r]));
    const kini = hariIni();
    const daftar = semuaJalan.map((p): Gedung => {
      const r = keuP.get(p.id);
      const inv = (tagihan ?? []).filter((t) => t.projectId === p.id).sort((a, b) => a.sortOrder - b.sortOrder);
      const jumlahInv = inv.reduce((n, t) => n + t.amount, 0);
      const kontrak = Math.max(p.contractValue ?? r?.contractValue ?? 0, jumlahInv);
      const lantai: Lantai[] = inv.map((t) => ({
        kunci: t.id,
        label: t.label,
        nilai: t.amount,
        status: t.status === "lunas" ? "lunas" : t.status === "terbit" ? (t.dueDate && t.dueDate < kini ? "lewat" : "terbit") : "draf",
        tanggal: t.status === "lunas" ? t.paidAt ?? null : t.dueDate ?? null,
      }));
      if (kontrak - jumlahInv > 0.5) lantai.push({ kunci: `${p.id}-sisa`, label: "Belum ditagihkan", nilai: kontrak - jumlahInv, status: "sisa", tanggal: null });
      if (lantai.length === 0) lantai.push({ kunci: `${p.id}-kosong`, label: "Belum ditagihkan", nilai: 1, status: "sisa", tanggal: null });
      const diterima = r?.received ?? p.paidTotal ?? inv.filter((t) => t.status === "lunas").reduce((n, t) => n + t.amount, 0);
      const biaya = r?.costsTotal ?? 0;
      return {
        p,
        kode: kodeProyek(p.title),
        kontrak: Math.max(1, kontrak),
        diterima,
        biaya,
        laba: r?.labaBersih ?? diterima - biaya,
        lantai,
        persen: kontrak > 0 ? (diterima / kontrak) * 100 : 0,
        lewat: lantai.filter((l) => l.status === "lewat").reduce((n, l) => n + l.nilai, 0),
      };
    });
    return daftar.sort((a, b) => b.kontrak - a.kontrak).slice(0, MAKS_GEDUNG);
  }, [semuaJalan, keu, tagihan]);
  const kontrakJalan = gedung.reduce((n, g) => n + g.kontrak, 0);
  /* Pilihan bawaan: yang termin lewat temponya terbesar, lalu kontrak terbesar. */
  const bawaan = useMemo(() => {
    let i = 0;
    gedung.forEach((g, j) => {
      if (g.lewat > gedung[i]!.lewat) i = j;
    });
    return i;
  }, [gedung]);
  const iPilih = Math.max(0, pilihId ? gedung.findIndex((g) => g.p.id === pilihId) : bawaan);
  const terpilih = gedung[iPilih];

  /* --- Arus kas 12 bulan ------------------------------------------------- */
  const arus = useMemo(() => {
    const peta = new Map((bulanan ?? []).map((b) => [b.bulan, b]));
    return Array.from({ length: 12 }, (_, i) => {
      const k = kunciBulan(11 - i);
      const b = peta.get(k);
      return { k, masuk: b?.kasMasuk ?? 0, beban: b?.biaya ?? 0 };
    });
  }, [bulanan]);
  const maksArus = Math.max(1, ...arus.map((a) => Math.max(a.masuk, a.beban)));
  const kasBersih = arus.reduce((n, a) => n + a.masuk - a.beban, 0);

  /* --- Perlu ditangani --------------------------------------------------- */
  const butir = useMemo(() => {
    const semua = [...(notif?.notifikasi ?? [])];
    semua.sort((a, b) => (b.tanggal ? new Date(b.tanggal).getTime() : 0) - (a.tanggal ? new Date(a.tanggal).getTime() : 0));
    return semua;
  }, [notif]);

  const pt = target ? persenTarget(target) : null;

  return (
    <div className="tkw">
      <div className="tkw__papan">
        {/* ---- Tampak kawasan --------------------------------------------- */}
        <section className="tkw__tampak" aria-label="Tampak kawasan proyek berjalan">
          <header className="tkw__kop">
            <div className="tkw__kopjudul">
              <p className="tkw__alis tkw__alis--papan">Tampak kawasan studio</p>
              <p className="tkw__judul">
                {gedung.length} proyek berjalan
                <span>
                  Nilai kontrak <Hitung nilai={kontrakJalan} hidup={hidup} format={formatRupiah} />
                  {semuaJalan.length > gedung.length && ` · +${semuaJalan.length - gedung.length} lainnya`}
                </span>
              </p>
            </div>
            <nav className="tkw__aksi" aria-label="Aksi cepat">
              <a href="/admin/keuangan/tagihan">
                <Ikon ikon={NavReceipt} ukuran={14} />
                Tagihan
              </a>
              <a href="/admin/keuangan/terima">
                <Ikon ikon={CoinIn} ukuran={14} />
                Terima
              </a>
              <a href="/admin/keuangan/keluar">
                <Ikon ikon={CoinOut} ukuran={14} />
                Biaya
              </a>
              <a href="/admin/keuangan/transaksi">
                <Ikon ikon={Clock} ukuran={14} />
                Riwayat
              </a>
            </nav>
          </header>
          {gedung.length > 0 ? (
            <Tampak gedung={gedung} pilih={iPilih} onPilih={(i) => {
                setPilihId(gedung[i]!.p.id);
                setPernahPilih(true);
              }} ket={ket} />
          ) : (
            <p className="tkw__kosong">{notif === null ? "Memuat proyek…" : "Belum ada proyek yang sedang berjalan."}</p>
          )}
          <ul className="tkw__legenda" aria-label="Arti warna lantai">
            <li>
              <i className="is-lunas" />
              Lunas
            </li>
            <li>
              <i className="is-terbit" />
              Terbit
            </li>
            <li>
              <i className="is-lewat" />
              Lewat tempo
            </li>
            <li>
              <i className="is-draf" />
              Draf
            </li>
            <li>
              <i className="is-sisa" />
              Belum ditagihkan
            </li>
            {gedung.length > 0 && (
              <li className="tkw__skala">
                Peil tiap {formatRupiahRingkas(langkahRapi(Math.max(...gedung.map((g) => g.kontrak)), 3))} · per {tglPendek(hariIni())}
              </li>
            )}
          </ul>
        </section>

        <MapProyek g={terpilih} hidup={hidup} gerak={pernahPilih} />

        {/* ---- Panel bawah -------------------------------------------------- */}
        <div className="tkw__bawah">
          <KartuKas nama={nama} profil={profil} keu={keu} jalan={semuaJalan.length} hidup={hidup} />

          <section className="tkw__panel tkw__arus" aria-label="Arus kas dua belas bulan">
            <p className="tkw__panelkop">
              <span>Arus kas · 12 bulan</span>
              <a href="/admin/keuangan">Ringkasan</a>
            </p>
            <p className={`tkw__panelangka${kasBersih < 0 ? " is-minus" : ""}`}>
              {bulanan ? <Hitung nilai={kasBersih} hidup={hidup} format={formatRupiah} /> : "—"}
              <small>kas bersih</small>
            </p>
            <ol className="tkw__arusbatang">
              {arus.map((a) => {
                const kk = ket(() => ({
                  judul: `${BULAN[Number(a.k.slice(5, 7)) - 1]} ${a.k.slice(0, 4)}`,
                  baris: [
                    { label: "Kas masuk", nilai: formatRupiah(a.masuk) },
                    { label: "Beban", nilai: formatRupiah(a.beban) },
                    { label: a.masuk - a.beban < 0 ? "Rugi" : "Laba", nilai: formatRupiah(a.masuk - a.beban) },
                  ],
                }));
                return (
                  <li key={a.k} {...kk}>
                    <span className="tkw__arusbidang">
                      {a.masuk > 0 && <i className="is-masuk" style={{ height: `${(a.masuk / maksArus) * 48}%` }} />}
                      {a.beban > 0 && <i className="is-beban" style={{ height: `${(a.beban / maksArus) * 48}%` }} />}
                    </span>
                    <small>{BULAN_PENDEK[Number(a.k.slice(5, 7)) - 1]!.charAt(0)}</small>
                  </li>
                );
              })}
            </ol>
          </section>

          <section className="tkw__panel tkw__target" aria-label="Target semester">
            <p className="tkw__panelkop">
              <span>Target semester</span>
              <a href="/admin/keuangan/kas">Kas Studio</a>
            </p>
            <p className="tkw__panelangka">
              {pt === null ? "—" : <Hitung nilai={pt} hidup={hidup} format={(v) => `${v.toFixed(1).replace(".", ",")}%`} />}
              <small>{target?.target ? `dari ${formatRupiahRingkas(target.target)}` : ""}</small>
            </p>
            <div className="tkw__targetmeter" role="img" aria-label="Pemasukan terhadap target semester">
              <i style={{ width: `${Math.min(100, pt ?? 0)}%` }} />
            </div>
            <p className="tkw__panelket">{target ? kalimatSisa(target) : "Memuat…"}</p>
          </section>

          <section className="tkw__panel tkw__perlu" aria-label="Perlu ditangani">
            <p className="tkw__panelkop">
              <span>
                Perlu ditangani
                {butir.length ? <b>{butir.length}</b> : null}
              </span>
              <a href="/admin/notifikasi">Semua</a>
            </p>
            {notif && butir.length === 0 && (
              <p className="tkw__beres">
                <Ikon ikon={CheckCircle} ukuran={16} />
                Semua sudah ditangani.
              </p>
            )}
            <ul>
              {butir.slice(0, 3).map((n) => (
                <li key={n.id}>
                  <a href={n.ke}>
                    <span className="tkw__perluikon">
                      <Ikon ikon={ikonButir(n)} ukuran={14} />
                    </span>
                    <span className="tkw__perluteks">
                      <b>{n.judul}</b> {n.detail}
                    </span>
                    <small>{n.tanggal ? `${kepalaHari(n.tanggal)} ${waktuButir(n)}` : ""}</small>
                  </a>
                </li>
              ))}
            </ul>
          </section>
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
        <div className="tkw tkw--rangka">
          <div className="tkw__papan" />
        </div>
      }
    >
      <Isi />
    </RequireAuth>
  );
}
