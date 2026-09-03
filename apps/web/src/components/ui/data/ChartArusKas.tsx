import { useId, useMemo, useState } from "react";
import { Icon } from "../Icon";
import { formatRupiah } from "../../../lib/format";

/* =============================================================================
   Grafik arus kas — ditiru dari kartu "Cash Flow Analysis" milik pemilik.

   Anatominya, langsung dari gambar referensi:
   - kepala satu baris: judul, legenda tiga titik, pemilih periode rata kanan
   - sumbu nilai di KIRI, di luar bidang gambar
   - enam garis kisi mendatar yang nyaris tak terlihat
   - satu seri bergaris penuh tebal DENGAN bidang di bawahnya
   - dua seri bergaris putus-putus tanpa bidang
   - saat ditunjuk: garis bidik tegak putus-putus, satu titik per seri tepat
     di atas kurvanya, dan kartu keterangan mengambang di sebelahnya

   Teks sumbu dan nama bulan ditulis sebagai HTML, bukan di dalam SVG.
   Alasannya: SVG-nya diregangkan mengikuti lebar kartu, dan teks di dalamnya
   ikut mengecil sampai tidak terbaca di kartu yang menyempit. Yang di-SVG
   cuma gambarnya; tebal garisnya dijaga vector-effect supaya tidak ikut melar.
   ============================================================================= */

export interface SeriArus {
  kunci: string;
  label: string;
  /** Token warna, bukan nilai heksa. */
  warna: string;
  /** Garis penuh tebal, atau putus-putus tipis seperti dua seri pendamping. */
  gaya?: "penuh" | "putus";
  /** Gambar bidang di bawah garisnya. Di referensi hanya seri pertama. */
  isi?: boolean;
}

export interface TitikArus {
  /** Nama bulan pendek untuk sumbu mendatar. */
  label: string;
  /** Nama bulan lengkap untuk kartu keterangan. */
  labelPanjang?: string;
  nilai: Record<string, number>;
}

/* --- Kurva ---------------------------------------------------------------- */

/**
 * Kurva Catmull–Rom, diubah jadi rangkaian kubik Bézier.
 *
 * Ini yang membuat lengkungannya membulat penuh seperti di gambar referensi.
 * Versi sebelumnya memakai kurva monoton (Fritsch–Carlson) yang memaksa
 * kemiringan jadi NOL di tiap puncak dan lembah — hasilnya puncak yang rata,
 * dan itu persis yang dikeluhkan pemilik.
 *
 * Bahayanya sudah ditutup, bukan diabaikan: Catmull–Rom bisa MELAMPAUI titik
 * datanya, jadi garis kas yang semua angkanya positif bisa tergambar menukik
 * ke bawah nol. Titik kendali Bézier di sini dijepit ke dalam bidang gambar,
 * dan sebuah kurva kubik dijamin berada di dalam selubung cembung keempat
 * titik kendalinya — jadi kurvanya tidak mungkin keluar dari bidangnya
 * sementara bentuk membulatnya tetap utuh.
 */
function kurva(titik: Array<{ x: number; y: number }>, batasAtas: number, batasBawah: number) {
  const n = titik.length;
  if (n === 0) return "";
  if (n === 1) return `M ${titik[0].x} ${titik[0].y}`;

  const jepit = (y: number) => Math.min(batasBawah, Math.max(batasAtas, y));
  /* Sepertiga dibagi dua — nilai baku Catmull–Rom. Makin besar makin
     melengkung; di atas ini kurvanya mulai bergelombang sendiri. */
  const T = 1 / 6;

  let jalur = `M ${titik[0].x} ${titik[0].y}`;
  for (let i = 0; i < n - 1; i += 1) {
    const p0 = titik[i - 1] ?? titik[i];
    const p1 = titik[i];
    const p2 = titik[i + 1];
    const p3 = titik[i + 2] ?? titik[i + 1];

    const c1x = p1.x + (p2.x - p0.x) * T;
    const c1y = jepit(p1.y + (p2.y - p0.y) * T);
    const c2x = p2.x - (p3.x - p1.x) * T;
    const c2y = jepit(p2.y - (p3.y - p1.y) * T);

    jalur += ` C ${c1x} ${c1y} ${c2x} ${c2y} ${p2.x} ${p2.y}`;
  }
  return jalur;
}

/* --- Skala ---------------------------------------------------------------- */

/**
 * Puncak sumbu dan langkahnya, dibulatkan ke angka yang enak dibaca.
 *
 * Sumbu di gambar referensi berlabel $700k, $650k, $550k, $400k, $300k, $0
 * dengan jarak yang SAMA — padahal selisihnya tidak sama. Itu sumbu hiasan.
 * Di sini sumbunya benar-benar linear; kalau tidak, tinggi garisnya tidak
 * berarti apa-apa.
 */
function skala(maks: number, bagian = 5) {
  if (!Number.isFinite(maks) || maks <= 0) return { atas: bagian, langkah: 1 };
  const kasar = maks / bagian;
  const pangkat = 10 ** Math.floor(Math.log10(kasar));
  /* Daftar langkah yang lebih rapat daripada [1, 2, 2.5, 5, 10].
     Dengan daftar kasar itu, data tertinggi Rp420 juta menghasilkan puncak
     sumbu Rp800 juta — hampir separuh bidang gambar kosong. Yang rapat
     memberi Rp500 juta: masih angka bulat, tapi headroom-nya 19% bukan 90%. */
  const langkah = [1, 1.25, 1.5, 2, 2.5, 3, 4, 5, 6, 7.5, 10]
    .map((k) => k * pangkat).find((k) => k >= kasar) ?? 10 * pangkat;
  return { atas: langkah * bagian, langkah };
}

/* --- Pemformatan ---------------------------------------------------------- */

/**
 * Rupiah ringkas untuk sumbu nilai.
 *
 * Sumbu memang harus disingkat: kolomnya cuma 44px, sementara
 * "Rp700.000.000" butuh lebih dari dua kali itu. Yang TIDAK boleh disingkat
 * adalah angka di kartu keterangan — di situ pemilik mencocokkan dengan
 * rekening, dan "Rp134 jt" menyembunyikan ratusan ribunya.
 */
function rupiahRingkas(n: number): string {
  const a = Math.abs(n);
  const tanda = n < 0 ? "\u2212" : "";
  if (a >= 1_000_000_000) {
    const m = a / 1_000_000_000;
    return `${tanda}Rp${(m >= 10 ? Math.round(m) : +m.toFixed(1)).toLocaleString("id-ID")} M`;
  }
  if (a >= 1_000_000) return `${tanda}Rp${Math.round(a / 1_000_000).toLocaleString("id-ID")} jt`;
  if (a >= 1_000) return `${tanda}Rp${Math.round(a / 1_000).toLocaleString("id-ID")} rb`;
  return `${tanda}Rp${Math.round(a)}`;
}

/* --- Komponen ------------------------------------------------------------- */

const VW = 1000;
const VH = 400;
/** Sisa ruang atas-bawah supaya garis paling tebal tidak terpotong tepi. */
const INSET = 8;

export function ChartArusKas({
  judul, seri, data, periode, opsiPeriode, onPeriode,
}: {
  judul: string;
  seri: SeriArus[];
  data: TitikArus[];
  periode?: string;
  opsiPeriode?: Array<{ nilai: string; label: string }>;
  onPeriode?: (nilai: string) => void;
}) {
  /* Pemformatan angka SENGAJA tidak bisa dioper lewat prop.
     Astro menserialisasi prop island ke JSON sebelum hidrasi, jadi fungsi
     yang dioper dari berkas .astro hilang di browser: komponennya tampil
     benar di HTML server lalu jatuh dengan "formatSumbu is not a function"
     begitu React mengambil alih. Sudah kejadian. Lagi pula grafik keuangan
     berbahasa Indonesia tidak punya alasan diformat berbeda per pemanggil. */
  const gid = useId().replace(/:/g, "");
  const [aktif, setAktif] = useState<number | null>(null);

  const { atas, tanda, jalur, kosong } = useMemo(() => {
    const semua = data.flatMap((d) => seri.map((s) => d.nilai[s.kunci] ?? 0));
    /* Belum ada satu pun angka di atas nol. Sumbunya TIDAK boleh diisi angka
       karangan: versi sebelumnya jatuh ke skala bawaan dan menampilkan
       "Rp5, Rp4, Rp3" — nominal yang tidak pernah ada di studio mana pun. */
    const belumAda = !semua.some((v) => v > 0);
    const { atas: a, langkah } = skala(Math.max(0, ...semua));
    const tandaSumbu: number[] = [];
    for (let v = a; v >= 0; v -= langkah) tandaSumbu.push(v);

    const x = (i: number) => (data.length <= 1 ? VW / 2 : (i / (data.length - 1)) * VW);
    const y = (v: number) => INSET + (1 - (a === 0 ? 0 : v / a)) * (VH - INSET * 2);

    const jalurSeri = seri.map((s) => {
      const t = data.map((d, i) => ({ x: x(i), y: y(d.nilai[s.kunci] ?? 0) }));
      const garis = kurva(t, INSET, VH - INSET);
      return {
        ...s,
        garis,
        bidang: s.isi && t.length > 1 ? `${garis} L ${VW} ${VH} L 0 ${VH} Z` : "",
        titik: t,
      };
    });
    return { atas: a, tanda: tandaSumbu, jalur: jalurSeri, kosong: belumAda };
  }, [data, seri]);

  function tunjuk(e: React.PointerEvent<HTMLDivElement>) {
    const kotak = e.currentTarget.getBoundingClientRect();
    if (kotak.width === 0 || data.length === 0) return;
    const rasio = (e.clientX - kotak.left) / kotak.width;
    const i = Math.round(rasio * (data.length - 1));
    setAktif(Math.min(data.length - 1, Math.max(0, i)));
  }

  function tombol(e: React.KeyboardEvent<HTMLDivElement>) {
    if (data.length === 0) return;
    const kini = aktif ?? 0;
    if (e.key === "ArrowRight") { e.preventDefault(); setAktif(Math.min(data.length - 1, kini + 1)); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); setAktif(Math.max(0, kini - 1)); }
    else if (e.key === "Home") { e.preventDefault(); setAktif(0); }
    else if (e.key === "End") { e.preventDefault(); setAktif(data.length - 1); }
    else if (e.key === "Escape") { setAktif(null); }
  }

  const xPersen = aktif === null || data.length <= 1 ? 0 : (aktif / (data.length - 1)) * 100;
  /* Kartu keterangan pindah ke kiri garis bidik begitu mendekati tepi kanan —
     kalau tidak, ia terpotong bingkai kartu. */
  const keKiri = xPersen > 62;
  const titikTertinggi = aktif === null ? 0
    : Math.min(...jalur.map((s) => s.titik[aktif].y)) / VH;

  return (
    <section className="arus">
      <header className="arus__head">
        <h3 className="arus__judul">{judul}</h3>
        <ul className="arus__legenda">
          {seri.map((s) => (
            <li key={s.kunci}>
              <span className="arus__titik" style={{ background: s.warna }} aria-hidden="true" />
              {s.label}
            </li>
          ))}
        </ul>
        {opsiPeriode && opsiPeriode.length > 0 && (
          <span className="select arus__periode">
            <select
              className="input"
              value={periode}
              aria-label="Periode grafik"
              onChange={(e) => onPeriode?.(e.currentTarget.value)}
            >
              {opsiPeriode.map((o) => <option key={o.nilai} value={o.nilai}>{o.label}</option>)}
            </select>
            <span className="select__chevron" aria-hidden="true"><Icon name="chevronDown" size={16} /></span>
          </span>
        )}
      </header>

      <div className="arus__plot">
        <ul className="arus__sumbu" aria-hidden="true">
          {tanda.map((v) => <li key={v}>{kosong && v !== 0 ? "" : rupiahRingkas(v)}</li>)}
        </ul>

        <div
          className="arus__gambar"
          role="img"
          tabIndex={0}
          aria-label={`${judul}. Gunakan panah kiri dan kanan untuk menelusuri per bulan.`}
          onPointerMove={tunjuk}
          onPointerDown={tunjuk}
          onPointerLeave={() => setAktif(null)}
          onPointerCancel={() => setAktif(null)}
          onKeyDown={tombol}
          onBlur={() => setAktif(null)}
        >
          <svg viewBox={`0 0 ${VW} ${VH}`} preserveAspectRatio="none" aria-hidden="true" focusable="false">
            <defs>
              {jalur.filter((s) => s.bidang).map((s) => (
                <linearGradient key={s.kunci} id={`${gid}-${s.kunci}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={s.warna} stopOpacity="0.22" />
                  <stop offset="100%" stopColor={s.warna} stopOpacity="0.02" />
                </linearGradient>
              ))}
            </defs>

            {tanda.map((v) => {
              const y = INSET + (1 - (atas === 0 ? 0 : v / atas)) * (VH - INSET * 2);
              return <line key={v} className="arus__kisi" x1="0" y1={y} x2={VW} y2={y} vectorEffect="non-scaling-stroke" />;
            })}

            {jalur.map((s) => s.bidang && (
              <path key={`b-${s.kunci}`} d={s.bidang} fill={`url(#${gid}-${s.kunci})`} stroke="none" />
            ))}

            {jalur.map((s) => (
              <path
                key={`g-${s.kunci}`}
                d={s.garis}
                fill="none"
                stroke={s.warna}
                strokeWidth={s.gaya === "putus" ? 2.5 : 3.5}
                strokeDasharray={s.gaya === "putus" ? "7 6" : undefined}
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            ))}

            {aktif !== null && (
              <line className="arus__bidik" x1={(aktif / Math.max(1, data.length - 1)) * VW} y1="0"
                x2={(aktif / Math.max(1, data.length - 1)) * VW} y2={VH} vectorEffect="non-scaling-stroke" />
            )}
          </svg>

          {/* Titik digambar sebagai elemen HTML, bukan <circle>: SVG-nya
              diregangkan tanpa mempertahankan rasio, jadi lingkaran di
              dalamnya akan tergambar lonjong. */}
          {aktif !== null && !kosong && jalur.map((s) => (
            <span
              key={`t-${s.kunci}`}
              className="arus__nodul"
              style={{
                left: `${xPersen}%`,
                top: `${(s.titik[aktif].y / VH) * 100}%`,
                borderColor: s.warna,
              }}
              aria-hidden="true"
            />
          ))}

          {kosong && <p className="arus__belum">Belum ada pergerakan kas di periode ini</p>}

          {aktif !== null && !kosong && (
            <div
              className={`arus__tip${keKiri ? " arus__tip--kiri" : ""}`}
              style={{ left: `${xPersen}%`, top: `${Math.min(52, Math.max(2, titikTertinggi * 100 + 4))}%` }}
              role="status"
            >
              <p className="arus__tip-judul">{data[aktif].labelPanjang ?? data[aktif].label}</p>
              {seri.map((s) => (
                <p key={s.kunci} className="arus__tip-baris" style={{ color: s.warna }}>
                  <span>{s.label}</span>
                  <b>{formatRupiah(data[aktif].nilai[s.kunci] ?? 0)}</b>
                </p>
              ))}
            </div>
          )}
        </div>
      </div>

      <ul className="arus__bulan" aria-hidden="true">
        {data.map((d, i) => (
          <li key={d.label} className={i === aktif ? "is-aktif" : undefined}>{d.label}</li>
        ))}
      </ul>
    </section>
  );
}
