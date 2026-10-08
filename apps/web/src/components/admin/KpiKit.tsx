import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent as PointerEventReact,
  type ReactNode,
} from "react";
import { RequireAuth } from "./RequireAuth";
import { Keterangan, pemberiKet, type KabarKartu } from "../kit/kartuGrafik";
import {
  ambilKpi,
  ambilSettings,
  bacaCache,
  tulisCache,
  type KpiStrategi,
  type StudioSettings,
} from "../../lib/admin";
import { CATEGORY_LABELS, type ProjectCategory } from "../../lib/api";
import { formatRupiah, formatRupiahRingkas } from "../../lib/format";
import { kodeProyek } from "../../lib/nomorDokumen";
import { daftarLembar, lembarUntuk } from "../../lib/navAdmin";
import { Hitung, geraknya } from "./hitung";

/* =============================================================================
   KPI Strategi = MAWAR STRATEGI — dokumen STRATEGI_BISNIS §8.

   Sebelum menggambar, arsitek menganalisis tapaknya: MAWAR ANGIN (seberapa
   kuat tiap arah) dan LINTASAN MATAHARI (letak matahari sepanjang tahun).
   Halaman ini lembar analisis yang sama untuk STRATEGI studio:

   1. MAWAR — satu kelopak per pasal §8.1–8.5. Panjang kelopak = realisasi ÷
      ketentuan minimum (cincin putus-putus = 100%, tepi = 200%), jadi
      kelopak yang belum keluar dari cincin ketentuan langsung terbaca, dan
      kekurangannya diarsir amber sampai cincin itu. Rentang ketentuan
      (kontrak, pesan) diarsir mint di sektornya; KONTUR titik-titik = letak
      kelopak di kuartal-kuartal sebelumnya. Pusatnya hitungan pasal yang
      memenuhi.
   2. CATATAN — balon detail (nomor pasal / nomor lembar sumbernya di set
      gambar rel) dengan GARIS PENUNJUK ke kelopaknya: angka realisasi,
      ketentuan, persen, dan selisih dari kuartal sebelumnya. Satu catatan =
      satu tab; lampirannya di kertas kanan.
   3. LINTASAN KUARTAL — busur matahari dengan stasiun potret akhir K1/K2/K3
      dan hari ini (`jejak` API: angka yang SAMA dengan yang terbaca di
      halaman ini pada hari itu). Matahari diseret atau diklik: kelopak
      BERUBAH BENTUK mengikuti letaknya di antara dua potret, dan saat
      melompat jauh mawar melewati bentuk kuartal-kuartal di antaranya.
   4. LAMPIRAN — rincian pasal terpilih dari data yang sama, dengan cap
      pemeriksaan dan tautan ke LEMBAR SUMBER-nya.

   Gerak hanya karena perbuatan (seret, klik, papan ketik) — tidak saat
   dimuat, seketika bila gerak dikurangi. Warna: hijau = memenuhi, amber =
   belum. Merah tidak dipakai: angka di bawah target bukan perbuatan
   destruktif. Tidak ada tulisan di dalam mawar selain label skala di celah
   puncaknya, dan cincinnya terputus tepat di label itu (jebakan #70).
   ============================================================================= */

type Kunci = "kontrak" | "margin" | "lead" | "signature" | "cadangan";
type Keadaan = "memenuhi" | "lampaui" | "belum" | "kosong";

interface Potret {
  kode: string; // "K1" … "Kini"
  tanggal: string;
  tahun: number;
  kuartal: number;
  kini: boolean;
  nilai: Record<Kunci, number | null>;
}

interface Pasal {
  kunci: Kunci;
  no: string;
  judul: string;
  /** Ketentuan lengkap (kop lampiran). */
  ketentuan: (k: KpiStrategi) => string;
  /** Ketentuan ringkas (catatan, keterangan kelopak). */
  pendek: string;
  min: number;
  maks: number | null;
  /** Bilangan bulat (lead, proyek): skala bertangga 1. */
  bulat?: boolean;
  besar: (v: number) => string;
  selisih: (d: number) => string;
  sumber: string;
}

const koma = (v: number, d = 1) => v.toLocaleString("id-ID", { maximumFractionDigits: d });
const jt = (v: number) => `${koma(v / 1e6, 0)} jt`;

function pasalDari(k: KpiStrategi): Pasal[] {
  const t = k.target;
  return [
    {
      kunci: "kontrak",
      no: "8.1",
      judul: "Rata-rata nilai kontrak",
      ketentuan: (x) => `Rp${koma(t.rataKontrakMin / 1e6, 0)}–${koma(t.rataKontrakMaks / 1e6, 0)} jt per proyek · ${x.rataKontrak.proyek} proyek`,
      pendek: `Rp${koma(t.rataKontrakMin / 1e6, 0)}–${koma(t.rataKontrakMaks / 1e6, 0)} jt`,
      min: t.rataKontrakMin,
      maks: t.rataKontrakMaks,
      besar: (v) => formatRupiahRingkas(v),
      selisih: (d) => formatRupiahRingkas(Math.abs(d)),
      sumber: "/admin/proyek",
    },
    {
      kunci: "margin",
      no: "8.2",
      judul: "Margin kontrak",
      ketentuan: () => `≥${t.marginMin}% sesudah biaya proyek, tertimbang`,
      pendek: `≥${t.marginMin}%`,
      min: t.marginMin,
      maks: null,
      besar: (v) => `${koma(v)}%`,
      selisih: (d) => `${koma(Math.abs(d))} poin`,
      sumber: "/admin/keuangan/keluar",
    },
    {
      kunci: "lead",
      no: "8.3",
      judul: "Pesan masuk per kuartal",
      ketentuan: (x) => `${t.leadKuartalMin}–${t.leadKuartalMaks} pesan · ${x.lead.ditindaklanjuti} ditindaklanjuti`,
      pendek: `${t.leadKuartalMin}–${t.leadKuartalMaks} pesan`,
      min: t.leadKuartalMin,
      maks: t.leadKuartalMaks,
      bulat: true,
      besar: (v) => `${koma(v, 0)} pesan`,
      selisih: (d) => `${koma(Math.abs(d), 0)} pesan`,
      sumber: "/admin/pesan",
    },
    {
      kunci: "signature",
      no: "8.4",
      judul: "Proyek Signature ke atas",
      ketentuan: () => `≥${t.signatureMin} proyek setahun, paket urutan 2 ke atas`,
      pendek: `≥${t.signatureMin} proyek`,
      min: t.signatureMin,
      maks: null,
      bulat: true,
      besar: (v) => `${koma(v, 0)} proyek`,
      selisih: (d) => `${koma(Math.abs(d), 0)} proyek`,
      sumber: "/admin/paket",
    },
    {
      kunci: "cadangan",
      no: "8.5",
      judul: "Cadangan kas",
      ketentuan: () => `≥${t.cadanganBulan} bulan pengeluaran studio`,
      pendek: `≥${t.cadanganBulan} bulan`,
      min: t.cadanganBulan,
      maks: null,
      besar: (v) => `${koma(v)} bulan`,
      selisih: (d) => `${koma(Math.abs(d))} bulan`,
      sumber: "/admin/keuangan/kas",
    },
  ];
}

function potretDari(k: KpiStrategi): Potret[] {
  const lalu: Potret[] = k.jejak.map((j) => ({
    kode: `K${j.kuartal}`,
    tanggal: j.tanggal,
    tahun: j.tahun,
    kuartal: j.kuartal,
    kini: false,
    nilai: { kontrak: j.rataKontrak, margin: j.margin, lead: j.lead, signature: j.signature, cadangan: j.cadangan },
  }));
  return [
    ...lalu,
    {
      kode: "Kini",
      tanggal: k.hariIni,
      tahun: k.tahun,
      kuartal: k.kuartal,
      kini: true,
      nilai: {
        kontrak: k.rataKontrak.nilai,
        margin: k.margin.rata,
        lead: k.lead.kuartalIni,
        signature: k.signature.jumlah,
        cadangan: k.cadangan.bulan,
      },
    },
  ];
}

function keadaanDari(p: Pasal, v: number | null): Keadaan {
  if (v === null) return "kosong";
  if (v < p.min) return "belum";
  if (p.maks !== null && v > p.maks) return "lampaui";
  return "memenuhi";
}

const TEKS_CAP: Record<Keadaan, string> = {
  memenuhi: "Memenuhi",
  lampaui: "Melampaui",
  belum: "Belum",
  kosong: "Belum ada data",
};

/** Langkah skala "rapi": 1 / 2 / 2,5 / 5 × 10^n, sekitar lima ruas. */
function langkah(rentang: number, bulat: boolean): number {
  const kasar = Math.max(rentang, 1e-9) / 5;
  const p = Math.pow(10, Math.floor(Math.log10(kasar)));
  let l = 10 * p;
  for (const k of [1, 2, 2.5, 5, 10]) {
    if (k * p >= kasar) {
      l = k * p;
      break;
    }
  }
  return bulat ? Math.max(1, Math.ceil(l)) : l;
}

interface Skala {
  bawah: number;
  atas: number;
  pos: (v: number) => number;
}

/** Satu skala per pasal untuk jejak dan sebaran di lampiran, cukup lebar
    untuk SEMUA potret dan ketentuannya. */
function skalaDari(p: Pasal, nilai: (number | null)[]): Skala {
  const ada = nilai.filter((v): v is number => v !== null);
  const puncak = Math.max(...ada, (p.maks ?? p.min) * 1.25);
  const dasar = Math.min(0, ...ada);
  const l = langkah(puncak - dasar, !!p.bulat);
  const atas = Math.ceil(puncak / l) * l;
  const bawah = Math.floor(dasar / l) * l;
  const rentang = atas - bawah || 1;
  return { bawah, atas, pos: (v) => Math.min(100, Math.max(0, ((v - bawah) / rentang) * 100)) };
}

const TGL = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", timeZone: "UTC" });
const TGL_PANJANG = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const BLN = new Intl.DateTimeFormat("id-ID", { month: "short", timeZone: "UTC" });
const tglPendek = (t: string) => TGL.format(new Date(`${t}T00:00:00Z`));
const tglPanjang = (t: string) => TGL_PANJANG.format(new Date(`${t}T00:00:00Z`));
const blnPendek = (b: string) => BLN.format(new Date(`${b}-01T00:00:00Z`));

/* ---- Geometri mawar (satuan viewBox 0–400) ------------------------------------
   Kelopak ke-i berpusat di 36° + 72°·i (searah jarum jam dari atas), jadi
   CELAH di puncak — tempat label skala — tidak pernah ditumpangi kelopak. */
const PUSAT = 200;
const HUB = 38;
const R200 = 168; // jari-jari 200% ketentuan
const RIM = 182; // cincin pinggir
const UJUNG_PENUNJUK = 196;
const LEBAR = 22; // setengah lebar kelopak, derajat
const sudut = (i: number) => 36 + 72 * i;
const jari = (q: number) => HUB + ((R200 - HUB) * Math.min(2, Math.max(0, q))) / 2;
const bulat2 = (n: number) => Math.round(n * 100) / 100;
function titik(r: number, deg: number): [number, number] {
  const a = (deg * Math.PI) / 180;
  return [PUSAT + r * Math.sin(a), PUSAT - r * Math.cos(a)];
}
function busur(r: number, a1: number, a2: number): string {
  const [x1, y1] = titik(r, a1);
  const [x2, y2] = titik(r, a2);
  return `M${bulat2(x1)} ${bulat2(y1)}A${bulat2(r)} ${bulat2(r)} 0 ${a2 - a1 > 180 ? 1 : 0} 1 ${bulat2(x2)} ${bulat2(y2)}`;
}
function sektor(r1: number, r2: number, a1: number, a2: number): string {
  if (r2 - r1 < 0.05) return "";
  const [x1, y1] = titik(r2, a1);
  const [x2, y2] = titik(r2, a2);
  const [x3, y3] = titik(r1, a2);
  const [x4, y4] = titik(r1, a1);
  const b = a2 - a1 > 180 ? 1 : 0;
  return `M${bulat2(x1)} ${bulat2(y1)}A${bulat2(r2)} ${bulat2(r2)} 0 ${b} 1 ${bulat2(x2)} ${bulat2(y2)}L${bulat2(x3)} ${bulat2(y3)}A${bulat2(r1)} ${bulat2(r1)} 0 ${b} 0 ${bulat2(x4)} ${bulat2(y4)}Z`;
}
/** Panah kecil di luar 200% untuk kelopak yang melewati tepi skala. */
function panahLebih(i: number): string {
  const s = sudut(i);
  const [ax, ay] = titik(R200 + 3, s - 4);
  const [bx, by] = titik(R200 + 11, s);
  const [cx, cy] = titik(R200 + 3, s + 4);
  return `M${bulat2(ax)} ${bulat2(ay)}L${bulat2(bx)} ${bulat2(by)}L${bulat2(cx)} ${bulat2(cy)}Z`;
}

/** Label skala di celah puncak; cincinnya terputus selebar labelnya. */
const CINCIN: { q: number; label: string; celah: number }[] = [
  { q: 0.5, label: "50%", celah: 13 },
  { q: 1, label: "100%", celah: 11 },
  { q: 1.5, label: "150%", celah: 8 },
  { q: 2, label: "200%", celah: 6.5 },
];

/* ---- Lintasan kuartal (satuan 1000 × 100, direntang selebar lajurnya) -------- */
const LX0 = 110;
const LX1 = 890;
const LTINGGI = 74;
const lintasX = (t: number) => LX0 + (LX1 - LX0) * t;
const lintasY = (x: number) => 100 - LTINGGI * Math.sqrt(Math.max(0, 1 - Math.pow((x - 500) / 500, 2)));
function jalurLintas(t0: number, t1: number): string {
  const n = Math.max(2, Math.round(Math.abs(t1 - t0) * 48));
  let d = "";
  for (let j = 0; j <= n; j++) {
    const x = lintasX(t0 + ((t1 - t0) * j) / n);
    d += `${j ? "L" : "M"}${bulat2(x)} ${bulat2(lintasY(x))}`;
  }
  return d;
}
const BUSUR_LANGIT = (() => {
  let d = "";
  for (let j = 0; j <= 60; j++) {
    const x = (1000 * j) / 60;
    d += `${j ? "L" : "M"}${bulat2(x)} ${bulat2(lintasY(x))}`;
  }
  return d;
})();

/** Letak catatan di kiri/kanan mawar, mengikuti arah kelopaknya. */
const LETAK: Record<Kunci, { sisi: "kiri" | "kanan"; baris: number; rata: "start" | "center" | "end" }> = {
  kontrak: { sisi: "kanan", baris: 2, rata: "start" },
  margin: { sisi: "kanan", baris: 3, rata: "center" },
  lead: { sisi: "kanan", baris: 4, rata: "end" },
  signature: { sisi: "kiri", baris: 4, rata: "start" },
  cadangan: { sisi: "kiri", baris: 2, rata: "start" },
};

/** Kalimat pemeriksa: seberapa jauh realisasi dari ketentuannya, dengan
    hitungan sisa waktu / uang untuk potret hari ini. */
function catatanPemeriksa(p: Pasal, v: number | null, k: KpiStrategi, kini: boolean): { teks: string; kurang: boolean } {
  if (v === null) return { teks: "Belum ada data untuk potret ini.", kurang: false };
  const hari = (sampai: string) =>
    Math.max(0, Math.round((Date.parse(`${sampai}T00:00:00Z`) - Date.parse(`${k.hariIni}T00:00:00Z`)) / 86_400_000));
  if (v < p.min) {
    let tambah = "";
    if (kini && p.kunci === "lead") {
      const akhir = new Date(Date.UTC(k.tahun, k.kuartal * 3, 0)).toISOString().slice(0, 10);
      tambah = ` Sisa ${hari(akhir)} hari di kuartal ${k.kuartal}.`;
    } else if (kini && p.kunci === "signature") {
      tambah = ` Sisa ${hari(`${k.tahun}-12-31`)} hari di ${k.tahun}.`;
    } else if (kini && p.kunci === "cadangan" && k.cadangan.keluarPerBulan !== null) {
      tambah = ` Setara ±${formatRupiahRingkas((p.min - v) * k.cadangan.keluarPerBulan)} kas lagi.`;
    }
    return { teks: `Kurang ${p.selisih(p.min - v)} dari ketentuan minimum.${tambah}`, kurang: true };
  }
  if (p.maks !== null && v > p.maks) return { teks: `${p.selisih(v - p.maks)} di atas batas atas rentang ketentuan.`, kurang: false };
  if (v === p.min) return { teks: p.maks !== null ? "Tepat di batas bawah rentang ketentuan." : "Tepat di ketentuan minimum.", kurang: false };
  if (p.maks !== null) return { teks: `Di dalam rentang — ${p.selisih(p.maks - v)} lagi sampai batas atasnya.`, kurang: false };
  return { teks: `${p.selisih(v - p.min)} di atas ketentuan minimum.`, kurang: false };
}

/* ---- Cap pemeriksaan -------------------------------------------------------- */
function Cap({ keadaan, no, kode, tercap }: { keadaan: Keadaan; no: string; kode: string; tercap: boolean }) {
  return (
    <span className={`mws__cap is-${keadaan}${tercap ? " is-tercap" : ""}`}>
      <b>{TEKS_CAP[keadaan]}</b>
      <small>
        §{no} · {kode}
      </small>
    </span>
  );
}

/* ---- Lampiran per pasal ------------------------------------------------------ */
function Jejak({
  pasal,
  skala,
  potret,
  pilih,
  onPilih,
}: {
  pasal: Pasal;
  skala: Skala;
  potret: Potret[];
  pilih: number;
  onPilih: (i: number) => void;
}) {
  const zonaA = skala.pos(pasal.min);
  const zonaB = pasal.maks === null ? 100 : skala.pos(pasal.maks);
  const nol = skala.pos(Math.max(0, skala.bawah));
  return (
    <div className="mws__jejak">
      <div className="mws__jejakbidang" aria-hidden="true">
        <i className="mws__jejakzona" style={{ bottom: `${zonaA}%`, height: `${zonaB - zonaA}%` }} />
      </div>
      {potret.map((p, i) => {
        const v = p.nilai[pasal.kunci];
        const y = v === null ? nol : skala.pos(v);
        return (
          <button
            key={p.kode}
            type="button"
            className={i === pilih ? "mws__jejakkolom is-pilih" : "mws__jejakkolom"}
            aria-pressed={i === pilih}
            aria-label={`${p.kode} ${tglPendek(p.tanggal)}: ${v === null ? "belum ada data" : pasal.besar(v)}`}
            onClick={() => onPilih(i)}
          >
            <span className="mws__jejaktiang" aria-hidden="true">
              <i
                className={keadaanDari(pasal, v) === "belum" ? "is-belum" : undefined}
                style={{ bottom: `${Math.min(nol, y)}%`, height: `${Math.abs(y - nol)}%` }}
              />
            </span>
            <b>{v === null ? "—" : pasal.besar(v)}</b>
            <small>{p.kini ? `Kini · ${tglPendek(p.tanggal)}` : `${p.kode} · ${tglPendek(p.tanggal)}`}</small>
          </button>
        );
      })}
    </div>
  );
}

const PERAN_SEGMEN: Partial<Record<string, string>> = {
  coffeeshop: "mesin reputasi",
  residential: "pilar margin",
};

function LampiranKontrak({ k, skala, ket }: { k: KpiStrategi; skala: Skala; ket: ReturnType<typeof pemberiKet> }) {
  const t = k.target;
  const urut = [...k.proyek].sort((a, b) => b.kontrak - a.kontrak);
  return (
    <>
      <h4 className="mws__sub">Sebaran kontrak {k.tahun}</h4>
      <div className="mws__sebaran" aria-hidden="true">
        <i
          className="mws__sebaranzona"
          style={{ left: `${skala.pos(t.rataKontrakMin)}%`, width: `${skala.pos(t.rataKontrakMaks) - skala.pos(t.rataKontrakMin)}%` }}
        />
        {urut.map((p) => (
          <i
            key={p.projectId}
            className="mws__titik"
            style={{ left: `${skala.pos(p.kontrak)}%` }}
            {...ket(() => ({ judul: p.title, baris: [{ label: "Nilai kontrak", nilai: formatRupiah(p.kontrak) }] }))}
          />
        ))}
        {k.rataKontrak.nilai !== null && <b className="mws__sebaranrata" style={{ left: `${skala.pos(k.rataKontrak.nilai)}%` }} />}
      </div>
      <div className="mws__sebaranskala" aria-hidden="true">
        <span>{skala.bawah === 0 ? "0" : jt(skala.bawah)}</span>
        <span>{jt(skala.atas)}</span>
      </div>
      <ol className="mws__daftar">
        {urut.map((p) => (
          <li key={p.projectId}>
            <span className="mws__kode">{kodeProyek(p.title)}</span>
            <a href={`/admin/proyek/satu?id=${encodeURIComponent(p.projectId)}`}>{p.title}</a>
            <small>{p.tier ?? "Tanpa paket"}</small>
            <b className={p.kontrak < t.rataKontrakMin ? "is-belum" : undefined}>{formatRupiahRingkas(p.kontrak)}</b>
          </li>
        ))}
        {!urut.length && <li className="mws__kosong">Belum ada proyek berkontrak tahun ini.</li>}
      </ol>
    </>
  );
}

function LampiranMargin({ k, ket }: { k: KpiStrategi; ket: ReturnType<typeof pemberiKet> }) {
  const min = k.target.marginMin;
  const urut = [...k.proyek].sort((a, b) => a.margin - b.margin);
  return (
    <>
      <h4 className="mws__sub">
        Biaya terhadap kontrak <span>batas biaya {100 - min}%</span>
      </h4>
      <ol className="mws__daftar mws__daftar--batang">
        {urut.map((p) => {
          const biaya = Math.min(100, (p.biaya / p.kontrak) * 100);
          return (
            <li key={p.projectId}>
              <a href={`/admin/proyek/satu?id=${encodeURIComponent(p.projectId)}`}>{p.title}</a>
              <b className={p.margin < min ? "is-belum" : undefined}>{koma(p.margin)}%</b>
              <span
                className={p.biaya > p.kontrak ? "mws__batangbiaya is-lebih" : "mws__batangbiaya"}
                style={{ "--mws-biaya": `${biaya}%`, "--mws-garisbatas": `${100 - min}%` } as CSSProperties}
                {...ket(() => ({
                  judul: p.title,
                  baris: [
                    { label: "Kontrak", nilai: formatRupiah(p.kontrak) },
                    { label: "Biaya tercatat", nilai: formatRupiah(p.biaya) },
                    { label: "Margin", nilai: `${koma(p.margin)}%` },
                  ],
                }))}
              />
            </li>
          );
        })}
        {!urut.length && <li className="mws__kosong">Belum ada proyek berkontrak tahun ini.</li>}
      </ol>
      {k.segmen.length > 0 && (
        <>
          <h4 className="mws__sub">Laba kas per segmen</h4>
          <dl className="mws__segmen">
            {[...k.segmen]
              .sort((a, b) => b.laba - a.laba)
              .map((g) => (
                <div key={g.kategori}>
                  <dt>
                    {CATEGORY_LABELS[g.kategori as ProjectCategory] ?? g.kategori}
                    {PERAN_SEGMEN[g.kategori] && <small> · {PERAN_SEGMEN[g.kategori]}</small>}
                  </dt>
                  <dd className={g.laba < 0 ? "is-belum" : undefined}>{formatRupiahRingkas(g.laba)}</dd>
                </div>
              ))}
          </dl>
        </>
      )}
    </>
  );
}

const STATUS_LEAD: { kunci: keyof KpiStrategi["lead"]["status"]; label: string }[] = [
  { kunci: "new", label: "Baru" },
  { kunci: "contacted", label: "Dihubungi" },
  { kunci: "qualified", label: "Prospek" },
  { kunci: "closed", label: "Selesai" },
];

function LampiranLead({ k }: { k: KpiStrategi }) {
  const t = k.target;
  const total = Math.max(1, k.lead.kuartalIni);
  const perBulanMin = t.leadKuartalMin / 3;
  const perBulanMaks = t.leadKuartalMaks / 3;
  const puncak = Math.max(perBulanMaks * 1.25, ...k.lead.perBulan.map((b) => b.jumlah));
  return (
    <>
      <h4 className="mws__sub">Status pesan kuartal {k.kuartal}</h4>
      <ol className="mws__daftar mws__daftar--status">
        {STATUS_LEAD.map((s) => (
          <li key={s.kunci}>
            <span>{s.label}</span>
            <span className="mws__batangpenuh" aria-hidden="true">
              <i
                className={s.kunci === "contacted" || s.kunci === "qualified" ? "is-lanjut" : undefined}
                style={{ width: `${(k.lead.status[s.kunci] / total) * 100}%` }}
              />
            </span>
            <b>{k.lead.status[s.kunci]}</b>
          </li>
        ))}
      </ol>
      <h4 className="mws__sub">
        Per bulan <span>laju ketentuan {koma(perBulanMin)}–{koma(perBulanMaks)}</span>
      </h4>
      <div className="mws__bulan" aria-label="Pesan masuk per bulan kuartal ini">
        <div className="mws__bidangtiang" aria-hidden="true">
          <i
            className="mws__bulanzona"
            style={{ bottom: `${(perBulanMin / puncak) * 100}%`, height: `${((perBulanMaks - perBulanMin) / puncak) * 100}%` }}
          />
        </div>
        {k.lead.perBulan.map((b) => (
          <div key={b.bulan} className="mws__bulankolom">
            <span className="mws__bulantiang" aria-hidden="true">
              <i style={{ height: `${(b.jumlah / puncak) * 100}%` }} />
            </span>
            <b>{b.jumlah}</b>
            <small>{blnPendek(b.bulan)}</small>
          </div>
        ))}
      </div>
    </>
  );
}

function LampiranSignature({ k }: { k: KpiStrategi }) {
  const kelompok = [
    { kunci: "kafe", label: "Coffee shop" },
    { kunci: "rumah", label: "Rumah tinggal" },
  ].map((g) => ({ ...g, anak: k.paket.filter((t) => t.kelompok === g.kunci).sort((a, b) => a.urutan - b.urutan) }));
  return (
    <>
      <h4 className="mws__sub">
        Tangga paket {k.tahun} <span>arsir = Signature ke atas</span>
      </h4>
      <div className="mws__tangga">
        {kelompok
          .filter((g) => g.anak.length)
          .map((g) => (
            <div key={g.kunci} className="mws__tanggakelompok">
              <p>{g.label}</p>
              <ol>
                {g.anak.map((t, i) => (
                  <li
                    key={t.nama}
                    className={t.urutan >= 2 ? "is-atas" : undefined}
                    style={{ "--mws-anak": i + 1, "--mws-anak-n": g.anak.length } as CSSProperties}
                  >
                    <span className="mws__tanggajumlah">{t.jumlah}</span>
                    <span className="mws__tanggaanak" aria-hidden="true" />
                    <small>{t.nama}</small>
                  </li>
                ))}
              </ol>
            </div>
          ))}
      </div>
      <ol className="mws__daftar">
        {k.signature.proyek.map((p) => (
          <li key={p.projectId}>
            <span className="mws__kode">{kodeProyek(p.title)}</span>
            <a href={`/admin/proyek/satu?id=${encodeURIComponent(p.projectId)}`}>{p.title}</a>
            <small>{p.tier}</small>
          </li>
        ))}
        {!k.signature.proyek.length && <li className="mws__kosong">Belum ada proyek Signature ke atas tahun ini.</li>}
      </ol>
    </>
  );
}

function LampiranCadangan({ k, ket }: { k: KpiStrategi; ket: ReturnType<typeof pemberiKet> }) {
  const c = k.cadangan;
  const target = k.target.cadanganBulan;
  const n = Math.max(target, Math.ceil(Math.max(0, c.bulan ?? 0))) + 1;
  const bulanan = c.bulanan;
  const puncak = Math.max(1, ...bulanan.map((b) => b.keluar));
  return (
    <>
      <p className="mws__rumus">
        {formatRupiah(c.saldo)} <em>÷</em> {c.keluarPerBulan === null ? "—" : `${formatRupiah(c.keluarPerBulan)}/bln`}
      </p>
      <p className="mws__rumusket">Saldo catatan panel ÷ rata-rata keluar {c.bulanBerdata} bulan berdata</p>
      <div className="mws__landasan" aria-label={`Cadangan ${c.bulan === null ? "belum ada data" : koma(c.bulan)} dari ${target} bulan`}>
        {Array.from({ length: n }, (_, i) => {
          const isi = c.bulan === null ? 0 : Math.min(1, Math.max(0, c.bulan - i));
          return (
            <span key={i} className={`mws__landasanbulan${i < target ? " is-wajib" : ""}${i + 1 === target ? " is-batas" : ""}`}>
              <i style={{ width: `${isi * 100}%` }} />
              <small>{i + 1}</small>
            </span>
          );
        })}
      </div>
      <h4 className="mws__sub">
        Keluar per bulan <span>putus = rata-rata</span>
      </h4>
      <div className="mws__keluar">
        <div className="mws__bidangtiang" aria-hidden="true">
          {c.keluarPerBulan !== null && <i className="mws__rata" style={{ bottom: `${(c.keluarPerBulan / puncak) * 100}%` }} />}
        </div>
        {bulanan.map((b) => (
          <div
            key={b.bulan}
            className="mws__keluarkolom"
            {...ket(() => ({ judul: blnPendek(b.bulan), baris: [{ label: "Uang keluar", nilai: formatRupiah(b.keluar) }] }))}
          >
            <span className="mws__bulantiang" aria-hidden="true">
              <i style={{ height: `${(b.keluar / puncak) * 100}%` }} />
            </span>
            <small>{blnPendek(b.bulan)}</small>
          </div>
        ))}
      </div>
    </>
  );
}

/* ---- Halaman ------------------------------------------------------------------ */
function Isi() {
  const [k, setK] = useState<KpiStrategi | null>(() => bacaCache<KpiStrategi>("kpi"));
  const [galat, setGalat] = useState<string | null>(null);
  /* Info Studio — kunci `settings` milik halaman itu, di sini cuma dibaca
     (jebakan #8). */
  const [studio, setStudio] = useState<StudioSettings | null>(() => bacaCache<StudioSettings>("settings"));

  useEffect(() => {
    ambilKpi()
      .then((d) => {
        tulisCache("kpi", d);
        setK(d);
      })
      .catch((e) => setGalat((e as Error).message));
    ambilSettings()
      .then(setStudio)
      .catch(() => {});
  }, []);

  if (!k) {
    return galat ? (
      <div className="mws">
        <div className="mws__papan mws__papan--galat">
          <p>KPI tidak bisa dimuat: {galat}</p>
        </div>
      </div>
    ) : (
      <Rangka />
    );
  }
  return <Mawar k={k} studio={studio} />;
}

function Rangka() {
  return (
    <div className="mws" aria-busy="true">
      <div className="mws__papan">
        <div className="mws__panggung mws__panggung--rangka">
          <div className="mws__sel">
            <div className="mws__mawar">
              <i className="mws__rangkacincin" />
            </div>
          </div>
        </div>
        <div className="mws__kertas mws__lampiran mws__kertas--rangka" />
      </div>
    </div>
  );
}

interface Elemen {
  bayang: SVGPathElement | null;
  cahaya: SVGPathElement | null;
  isi: SVGPathElement | null;
  kurang: SVGPathElement | null;
  ujung: SVGPathElement | null;
  garis: SVGPathElement | null;
  lebih: SVGPathElement | null;
  kosong: SVGPathElement | null;
}
interface Penunjuk {
  kunci: Kunci;
  d: string;
  x: number;
  y: number;
}

function Mawar({ k, studio }: { k: KpiStrategi; studio: StudioSettings | null }) {
  const pasal = useMemo(() => pasalDari(k), [k]);
  const potret = useMemo(() => potretDari(k), [k]);
  const skala = useMemo(
    () => Object.fromEntries(pasal.map((p) => [p.kunci, skalaDari(p, potret.map((x) => x.nilai[p.kunci]))])) as Record<Kunci, Skala>,
    [pasal, potret],
  );
  /* q = realisasi ÷ ketentuan minimum, per potret per pasal. */
  const q = useMemo(
    () =>
      potret.map((s) =>
        pasal.map((p) => {
          const v = s.nilai[p.kunci];
          return v === null ? null : v / p.min;
        }),
      ),
    [potret, pasal],
  );
  const n = potret.length;
  const kini = n - 1;
  const tDari = (i: number) => (n > 1 ? i / (n - 1) : 0);

  const [pilihPotret, setPilihPotret] = useState(kini);
  const pilihRef = useRef(kini);
  /* Bawaan: pasal pertama yang BELUM memenuhi — halaman membuka yang perlu
     diperhatikan. */
  const [pilihPasal, setPilihPasal] = useState<Kunci>(
    () => pasal.find((p) => keadaanDari(p, potret[kini]!.nilai[p.kunci]) === "belum")?.kunci ?? "kontrak",
  );
  const [sorot, setSorot] = useState<Kunci | null>(null);
  /* Gerak hanya sesudah perbuatan (jebakan #74): `hidup` menyala sesudah
     bingkai pertama; `ditarik` dan `tercap` hanya dipasang oleh perbuatan. */
  const [hidup, setHidup] = useState(false);
  const [ditarik, setDitarik] = useState<Kunci | null>(null);
  const [tercap, setTercap] = useState({ n: 0, nyala: false });
  const [lampiranBaru, setLampiranBaru] = useState(0);
  const [penunjuk, setPenunjuk] = useState<Penunjuk[]>([]);
  const waktu = useRef<number[]>([]);
  const kabar: KabarKartu = useRef(null);
  const ket = pemberiKet(kabar);
  const idLampiran = useId();
  const idPola = `mws${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const tabRef = useRef<Partial<Record<Kunci, HTMLButtonElement | null>>>({});
  const balonRef = useRef<Partial<Record<Kunci, HTMLSpanElement | null>>>({});
  const panggungRef = useRef<HTMLElement>(null);
  const mawarRef = useRef<HTMLDivElement>(null);
  const lapisRef = useRef<SVGSVGElement>(null);
  const el = useRef<Elemen[]>(pasal.map(() => ({ bayang: null, cahaya: null, isi: null, kurang: null, ujung: null, garis: null, lebih: null, kosong: null })));
  const matahariRef = useRef<HTMLSpanElement>(null);
  const bayangRef = useRef<SVGGElement>(null);
  const jalurRef = useRef<SVGPathElement>(null);
  const tKini = useRef(tDari(kini));
  const raf = useRef(0);
  const seret = useRef<{ kiri: number; lebar: number; x0: number; geser: boolean } | null>(null);

  /* Bentuk kelopak di letak t (0 = potret pertama, 1 = hari ini): di antara
     dua stasiun, kelopak ditarik lurus dari bentuk yang satu ke yang lain. */
  const qPada = (t: number): (number | null)[] => {
    if (n === 1) return q[0]!;
    const f = Math.min(n - 1, Math.max(0, t * (n - 1)));
    const i0 = Math.min(n - 2, Math.floor(f));
    const u = f - i0;
    return pasal.map((_, j) => {
      const a = q[i0]![j]!;
      const b = q[i0 + 1]![j]!;
      if (a === null || b === null) return u < 0.5 ? a : b;
      return a + (b - a) * u;
    });
  };

  /* Seluruh bagian mawar yang bergerak ditulis LANGSUNG ke DOM: seret dan
     perjalanan matahari tidak menggambar ulang halaman. React tidak pernah
     memegang atribut `d` elemen-elemen ini. */
  const gambar = (qs: (number | null)[]) => {
    const tulis = (x: SVGPathElement | null, d: string) => {
      if (x && x.getAttribute("d") !== d) x.setAttribute("d", d);
    };
    qs.forEach((v, i) => {
      const e = el.current[i];
      if (!e) return;
      const a1 = sudut(i) - LEBAR;
      const a2 = sudut(i) + LEBAR;
      if (v === null) {
        tulis(e.bayang, "");
        tulis(e.cahaya, "");
        tulis(e.isi, "");
        tulis(e.garis, "");
        tulis(e.kurang, "");
        tulis(e.ujung, "");
        tulis(e.lebih, "");
        tulis(e.kosong, sektor(HUB, jari(1), a1, a2));
        return;
      }
      const r = jari(v);
      tulis(e.kosong, "");
      tulis(e.bayang, sektor(HUB, r, a1, a2));
      tulis(e.isi, sektor(HUB, r, a1, a2));
      tulis(e.cahaya, sektor(Math.max(HUB, r - 16), r, a1, a2));
      tulis(e.garis, sektor(HUB, r, a1, a2));
      tulis(e.kurang, v < 1 ? sektor(r, jari(1), a1, a2) : "");
      tulis(e.ujung, busur(r, a1, a2));
      e.ujung?.classList.toggle("is-kurang", v < 1);
      tulis(e.lebih, v > 2 ? panahLebih(i) : "");
    });
  };

  const taruh = (t: number) => {
    const x = lintasX(t);
    /* Bayangan kelopak jatuh berlawanan dengan matahari, dan memendek saat
       matahari tinggi — studi bayangan, cuma lewat satu transform. */
    const tinggi = (100 - lintasY(x)) / LTINGGI;
    bayangRef.current?.setAttribute("transform", `translate(${bulat2((-(x - 500) / 390) * 7)} ${bulat2(3 + (1 - tinggi) * 10)})`);
    const m = matahariRef.current;
    if (m) {
      m.style.left = `${x / 10}%`;
      m.style.top = `${lintasY(x)}%`;
    }
    jalurRef.current?.setAttribute("d", t > 0.001 ? jalurLintas(0, t) : "");
  };

  useLayoutEffect(() => {
    gambar(qPada(tKini.current));
    taruh(tKini.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  useEffect(() => {
    let b2 = 0;
    const b1 = requestAnimationFrame(() => (b2 = requestAnimationFrame(() => setHidup(true))));
    return () => {
      cancelAnimationFrame(b1);
      cancelAnimationFrame(b2);
      cancelAnimationFrame(raf.current);
      waktu.current.forEach((w) => window.clearTimeout(w));
    };
  }, []);

  /* Garis penunjuk: dibaca dari kotak balon dan kotak mawar HANYA saat
     ukurannya berubah (ResizeObserver), tidak pernah saat menggeser. */
  useLayoutEffect(() => {
    const pg = panggungRef.current;
    const sq = mawarRef.current;
    const lapis = lapisRef.current;
    if (!pg || !sq || !lapis) return;
    const hitung = () => {
      if (getComputedStyle(lapis).display === "none") {
        setPenunjuk((s) => (s.length ? [] : s));
        return;
      }
      const P = pg.getBoundingClientRect();
      const S = sq.getBoundingClientRect();
      const sk = S.width / 400;
      const baru = pasal.map((p, i): Penunjuk => {
        const b = balonRef.current[p.kunci]!.getBoundingClientRect();
        const kanan = LETAK[p.kunci].sisi === "kanan";
        const ax = Math.round((kanan ? b.left : b.right) - P.left) + (kanan ? -0.5 : 0.5);
        const ay = Math.round(b.top + b.height / 2 - P.top) + 0.5;
        const bahu = ax + (kanan ? -12 : 12);
        const [ux, uy] = titik(UJUNG_PENUNJUK, sudut(i));
        const x = bulat2(S.left - P.left + ux * sk);
        const y = bulat2(S.top - P.top + uy * sk);
        return { kunci: p.kunci, d: `M${ax} ${ay}H${bahu}L${x} ${y}`, x, y };
      });
      setPenunjuk((s) => (JSON.stringify(s) === JSON.stringify(baru) ? s : baru));
    };
    hitung();
    const ro = new ResizeObserver(hitung);
    ro.observe(pg);
    ro.observe(sq);
    Object.values(tabRef.current).forEach((t) => t && ro.observe(t));
    return () => ro.disconnect();
  }, [pasal]);

  const tunda = (f: () => void, ms: number) => {
    waktu.current.push(window.setTimeout(f, ms));
  };

  /* Matahari berjalan sepanjang busurnya; kelopak ikut berubah bentuk
     melewati potret-potret di antaranya. */
  const jalan = (ke: number) => {
    cancelAnimationFrame(raf.current);
    const t0 = tKini.current;
    const t1 = tDari(ke);
    if (!geraknya() || Math.abs(t1 - t0) < 1e-4) {
      tKini.current = t1;
      gambar(qPada(t1));
      taruh(t1);
      return;
    }
    const lama = 360 + 420 * Math.abs(t1 - t0);
    const mulai = performance.now();
    const langkahi = (sekarang: number) => {
      const p = Math.min(1, (sekarang - mulai) / lama);
      const e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
      const t = p < 1 ? t0 + (t1 - t0) * e : t1;
      tKini.current = t;
      gambar(qPada(t));
      taruh(t);
      if (p < 1) raf.current = requestAnimationFrame(langkahi);
    };
    raf.current = requestAnimationFrame(langkahi);
  };

  const pilihSnap = (i: number, berjalan = true) => {
    const lama = pilihRef.current;
    if (i !== lama) {
      pilihRef.current = i;
      setPilihPotret(i);
      /* Cap lampiran dibubuhkan ulang hanya kalau keadaan pasal yang sedang
         diperiksa memang berubah. */
      const p = pasal.find((x) => x.kunci === pilihPasal)!;
      if (geraknya() && keadaanDari(p, potret[i]!.nilai[p.kunci]) !== keadaanDari(p, potret[lama]!.nilai[p.kunci])) {
        setTercap((c) => ({ n: c.n + 1, nyala: true }));
        tunda(() => setTercap((c) => ({ ...c, nyala: false })), 700);
      }
    }
    if (berjalan) jalan(i);
  };

  const pilihP = (kunci: Kunci) => {
    if (kunci === pilihPasal) return;
    setPilihPasal(kunci);
    if (geraknya()) {
      setDitarik(kunci);
      setLampiranBaru((x) => x + 1);
      tunda(() => setDitarik((d) => (d === kunci ? null : d)), 900);
    }
  };

  /* ---- Lintasan: seret, klik, papan ketik ---- */
  const tDariX = (clientX: number, kiri: number, lebar: number) => {
    const x = ((clientX - kiri) / lebar) * 1000;
    return Math.min(1, Math.max(0, (x - LX0) / (LX1 - LX0)));
  };
  const tekan = (e: PointerEventReact<HTMLDivElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const kotak = e.currentTarget.getBoundingClientRect();
    seret.current = { kiri: kotak.left, lebar: kotak.width, x0: e.clientX, geser: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const geser = (e: PointerEventReact<HTMLDivElement>) => {
    const s = seret.current;
    if (!s) return;
    if (!s.geser && Math.abs(e.clientX - s.x0) < 4) return;
    s.geser = true;
    cancelAnimationFrame(raf.current);
    const t = tDariX(e.clientX, s.kiri, s.lebar);
    tKini.current = t;
    gambar(qPada(t));
    taruh(t);
    const i = Math.round(t * (n - 1));
    if (i !== pilihRef.current) pilihSnap(i, false);
  };
  const lepas = (e: PointerEventReact<HTMLDivElement>) => {
    const s = seret.current;
    seret.current = null;
    if (!s) return;
    const t = s.geser ? tKini.current : tDariX(e.clientX, s.kiri, s.lebar);
    pilihSnap(Math.round(t * (n - 1)));
  };
  const batal = () => {
    if (!seret.current) return;
    seret.current = null;
    jalan(pilihRef.current);
  };
  const tombolLintas = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = pilihRef.current;
    const ke =
      e.key === "ArrowRight" || e.key === "ArrowUp" || e.key === "PageUp"
        ? Math.min(n - 1, i + 1)
        : e.key === "ArrowLeft" || e.key === "ArrowDown" || e.key === "PageDown"
          ? Math.max(0, i - 1)
          : e.key === "Home"
            ? 0
            : e.key === "End"
              ? n - 1
              : null;
    if (ke === null) return;
    e.preventDefault();
    pilihSnap(ke);
  };

  const tombolTab = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const m = pasal.length;
    const ke =
      e.key === "ArrowDown" || e.key === "ArrowRight"
        ? (i + 1) % m
        : e.key === "ArrowUp" || e.key === "ArrowLeft"
          ? (i - 1 + m) % m
          : e.key === "Home"
            ? 0
            : e.key === "End"
              ? m - 1
              : null;
    if (ke === null) return;
    e.preventDefault();
    pilihP(pasal[ke]!.kunci);
    tabRef.current[pasal[ke]!.kunci]?.focus();
  };

  const snap = potret[pilihPotret]!;
  const sebelum = pilihPotret > 0 ? potret[pilihPotret - 1]! : null;
  const keadaan = Object.fromEntries(pasal.map((p) => [p.kunci, keadaanDari(p, snap.nilai[p.kunci])])) as Record<Kunci, Keadaan>;
  const memenuhi = pasal.filter((p) => keadaan[p.kunci] === "memenuhi" || keadaan[p.kunci] === "lampaui").length;
  const daftar = daftarLembar().halaman;
  const aktif = pasal.find((p) => p.kunci === pilihPasal)!;
  const sumber = lembarUntuk(aktif.sumber, daftar)?.lembar ?? null;
  const kodeSnap = snap.kini ? `K${snap.kuartal}` : snap.kode;

  let lampiran: ReactNode;
  switch (aktif.kunci) {
    case "kontrak":
      lampiran = <LampiranKontrak k={k} skala={skala.kontrak} ket={ket} />;
      break;
    case "margin":
      lampiran = <LampiranMargin k={k} ket={ket} />;
      break;
    case "lead":
      lampiran = <LampiranLead k={k} />;
      break;
    case "signature":
      lampiran = <LampiranSignature k={k} />;
      break;
    case "cadangan":
      lampiran = <LampiranCadangan k={k} ket={ket} />;
      break;
  }

  /* Kelopak menjawab "berapa" di tiap kuartal, dan menyorot catatannya —
     tetikus saja (jebakan #9). */
  const keteranganKelopak = (p: Pasal) => {
    const h = ket(() => ({
      judul: `§${p.no} ${p.judul}`,
      baris: [
        ...potret.map((s) => {
          const v = s.nilai[p.kunci];
          return { label: s.kini ? `Kini · ${tglPendek(s.tanggal)}` : `${s.kode} · ${tglPendek(s.tanggal)}`, nilai: v === null ? "—" : p.besar(v) };
        }),
        { label: "Ketentuan", nilai: p.pendek },
      ],
    }));
    return {
      ...h,
      onPointerEnter: (e: PointerEventReact) => {
        h.onPointerEnter(e);
        if (e.pointerType === "mouse") setSorot(p.kunci);
      },
      onPointerLeave: (e: PointerEventReact) => {
        h.onPointerLeave(e);
        if (e.pointerType === "mouse") setSorot(null);
      },
    };
  };

  const adaZona = pasal.some((p) => p.maks !== null);
  const kelasPilih = (p: Pasal) => `${p.kunci === pilihPasal ? " is-pilih" : ""}${sorot === p.kunci ? " is-sorot" : ""}`;

  return (
    <div className={hidup ? "mws is-hidup" : "mws"}>
      <div className="mws__papan">
        <section ref={panggungRef} className="mws__panggung" aria-labelledby="mws-judul">
          <header className="mws__kop">
            <div className="mws__kopjudul">
              <p>Dokumen strategi bisnis · Pasal 8 · {snap.tahun}</p>
              <h2 id="mws-judul">Mawar strategi</h2>
            </div>
            <ul className="mws__legenda" aria-hidden="true">
              <li>
                <i className="mws__lg-isi" /> realisasi
              </li>
              <li>
                <i className="mws__lg-batas" /> ketentuan minimum
              </li>
              {adaZona && (
                <li>
                  <i className="mws__lg-zona" /> rentang ketentuan
                </li>
              )}
              <li>
                <i className="mws__lg-kurang" /> kekurangan
              </li>
              {sebelum && (
                <li>
                  <i className="mws__lg-kontur" /> kuartal lalu
                </li>
              )}
            </ul>
          </header>

          <div className="mws__sel">
            <div ref={mawarRef} className="mws__mawar">
              <svg className="mws__gambar" viewBox="0 0 400 400" aria-hidden="true">
                <defs>
                  <radialGradient id={`${idPola}-isi`} gradientUnits="userSpaceOnUse" cx={PUSAT} cy={PUSAT} r={R200}>
                    <stop offset={HUB / R200} className="mws__henti-a" />
                    <stop offset={jari(1) / R200} className="mws__henti-b" />
                    <stop offset="1" className="mws__henti-c" />
                  </radialGradient>
                  <radialGradient id={`${idPola}-pijar`} gradientUnits="userSpaceOnUse" cx={PUSAT} cy={PUSAT} r={RIM}>
                    <stop offset="0" className="mws__pijar-a" />
                    <stop offset="1" className="mws__pijar-b" />
                  </radialGradient>
                  <pattern id={`${idPola}-kurang`} patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
                    <rect width="2.2" height="6" className="mws__arsir-amber" />
                  </pattern>
                  {/* Bayangan hanya jatuh di lajur kelopak, tidak pernah ke celah
                      puncak tempat label skala. */}
                  <clipPath id={`${idPola}-lajur`}>
                    {pasal.map((p, i) => (
                      <path key={p.kunci} d={sektor(HUB, RIM - 2, sudut(i) - LEBAR - 3, sudut(i) + LEBAR + 3)} />
                    ))}
                  </clipPath>
                  <pattern id={`${idPola}-zona`} patternUnits="userSpaceOnUse" width="5" height="5" patternTransform="rotate(-45)">
                    <rect width="1.6" height="5" className="mws__arsir-mint" />
                  </pattern>
                </defs>

                <circle className="mws__pijar" cx={PUSAT} cy={PUSAT} r={RIM} fill={`url(#${idPola}-pijar)`} />

                {/* Lajur kelopak: sektor 0–200% tiap pasal. */}
                {pasal.map((p, i) => (
                  <path key={`lajur-${p.kunci}`} className={`mws__lajur${kelasPilih(p)}`} d={sektor(HUB, R200, sudut(i) - LEBAR, sudut(i) + LEBAR)} />
                ))}

                <g clipPath={`url(#${idPola}-lajur)`}>
                  <g ref={bayangRef} className="mws__bayang">
                    {pasal.map((p, i) => (
                      <path
                        key={p.kunci}
                        ref={(x) => {
                          el.current[i]!.bayang = x;
                        }}
                      />
                    ))}
                  </g>
                </g>

                {/* Rentang ketentuan (kontrak, pesan). */}
                {pasal.map((p, i) =>
                  p.maks === null ? null : (
                    <g key={`zona-${p.kunci}`}>
                      <path
                        className="mws__zona"
                        fill={`url(#${idPola}-zona)`}
                        d={sektor(jari(1), jari(p.maks / p.min), sudut(i) - LEBAR, sudut(i) + LEBAR)}
                      />
                      <path className="mws__zonabatas" d={busur(jari(p.maks / p.min), sudut(i) - LEBAR, sudut(i) + LEBAR)} />
                    </g>
                  ),
                )}

                {/* Cincin skala, terputus di celah puncak tempat labelnya. */}
                {CINCIN.map((c) => (
                  <path key={c.q} className={c.q === 1 ? "mws__cincin is-batas" : "mws__cincin"} d={busur(jari(c.q), c.celah, 360 - c.celah)} />
                ))}

                {/* Kelopak: isi bergradasi, kekurangan berarsir amber, garis
                    tepi (kelopak terpilih), ujung, panah lewat 200%. */}
                {pasal.map((p, i) => (
                  <g key={`kelopak-${p.kunci}`} className={`mws__kelopak${kelasPilih(p)}`}>
                    <path
                      ref={(x) => {
                        el.current[i]!.isi = x;
                      }}
                      className="mws__isi"
                      fill={`url(#${idPola}-isi)`}
                    />
                    <path
                      ref={(x) => {
                        el.current[i]!.cahaya = x;
                      }}
                      className="mws__cahaya"
                    />
                    <path
                      ref={(x) => {
                        el.current[i]!.kurang = x;
                      }}
                      className="mws__kurang"
                      fill={`url(#${idPola}-kurang)`}
                    />
                    <path
                      ref={(x) => {
                        el.current[i]!.kosong = x;
                      }}
                      className="mws__kosongkelopak"
                    />
                    <path
                      ref={(x) => {
                        el.current[i]!.garis = x;
                      }}
                      className="mws__garistepi"
                    />
                    <path
                      ref={(x) => {
                        el.current[i]!.ujung = x;
                      }}
                      className="mws__ujung"
                    />
                    <path
                      ref={(x) => {
                        el.current[i]!.lebih = x;
                      }}
                      className="mws__lebih"
                    />
                  </g>
                ))}

                {/* Kontur kuartal-kuartal sebelum potret terpilih. */}
                {pasal.map((p, i) =>
                  potret.slice(0, pilihPotret).map((s, j) => {
                    const v = q[j]![i];
                    if (v === null || v === undefined) return null;
                    return (
                      <path
                        key={`kontur-${p.kunci}-${s.kode}`}
                        className={j === pilihPotret - 1 ? "mws__kontur is-dekat" : "mws__kontur"}
                        d={busur(jari(v), sudut(i) - LEBAR + 3, sudut(i) + LEBAR - 3)}
                      />
                    );
                  }),
                )}

                {/* Cincin pinggir bertakik: tiap 6°, panjang di sumbu kelopak. */}
                <circle className="mws__rim" cx={PUSAT} cy={PUSAT} r={RIM} />
                <path
                  className="mws__takik"
                  d={Array.from({ length: 60 }, (_, j) => {
                    const deg = j * 6;
                    const sumbu = (deg - 36) % 72 === 0;
                    const celah = deg % 72 === 0;
                    const [x1, y1] = titik(RIM, deg);
                    const [x2, y2] = titik(RIM + (sumbu ? 10 : celah ? 6 : 3.5), deg);
                    return `M${bulat2(x1)} ${bulat2(y1)}L${bulat2(x2)} ${bulat2(y2)}`;
                  }).join("")}
                />

                <circle className="mws__hub" cx={PUSAT} cy={PUSAT} r={HUB} />

                {/* Bidang sentuh: seluruh lajur sampai cincin pinggir. */}
                {pasal.map((p, i) => (
                  <path
                    key={`sentuh-${p.kunci}`}
                    className="mws__sentuh"
                    d={sektor(HUB, RIM, sudut(i) - LEBAR - 4, sudut(i) + LEBAR + 4)}
                    onClick={() => pilihP(p.kunci)}
                    {...keteranganKelopak(p)}
                  />
                ))}
              </svg>

              {CINCIN.map((c) => (
                <span
                  key={c.q}
                  className={c.q === 1 ? "mws__skala is-batas" : "mws__skala"}
                  style={{ top: `${((PUSAT - jari(c.q)) / 400) * 100}%` }}
                  aria-hidden="true"
                >
                  {c.label}
                </span>
              ))}

              <span className="mws__pusat" aria-hidden="true">
                <b>
                  <Hitung nilai={memenuhi} hidup={hidup} format={(v) => koma(Math.round(v), 0)} />
                  <em>/{pasal.length}</em>
                </b>
                <small>memenuhi</small>
              </span>
            </div>
          </div>

          <div className="mws__catatandaftar" role="tablist" aria-label="Pasal KPI" aria-orientation="vertical">
            {pasal.map((p, i) => {
              const v = snap.nilai[p.kunci];
              const lalu = sebelum?.nilai[p.kunci] ?? null;
              const beda = v !== null && lalu !== null ? v - lalu : null;
              const dipilih = p.kunci === pilihPasal;
              const letak = LETAK[p.kunci];
              const lembar = lembarUntuk(p.sumber, daftar)?.lembar.kode ?? "";
              return (
                <button
                  key={p.kunci}
                  ref={(x) => {
                    tabRef.current[p.kunci] = x;
                  }}
                  type="button"
                  role="tab"
                  id={`mws-tab-${p.kunci}`}
                  aria-selected={dipilih}
                  aria-controls={idLampiran}
                  tabIndex={dipilih ? 0 : -1}
                  className={`mws__catatan is-${letak.sisi} is-${keadaan[p.kunci]}${kelasPilih(p)}`}
                  data-baris={letak.baris}
                  data-rata={letak.rata}
                  onClick={() => pilihP(p.kunci)}
                  onKeyDown={(e) => tombolTab(e, i)}
                  onPointerEnter={(e) => e.pointerType === "mouse" && setSorot(p.kunci)}
                  onPointerLeave={(e) => e.pointerType === "mouse" && setSorot(null)}
                >
                  <span
                    ref={(x) => {
                      balonRef.current[p.kunci] = x;
                    }}
                    className="mws__balon"
                    aria-hidden="true"
                  >
                    <b>{p.no}</b>
                    <small>{lembar}</small>
                  </span>
                  <span className="mws__catatanisi">
                    <span className="mws__cjudul">{p.judul}</span>
                    {v === null ? <b className="mws__cangka">—</b> : <Hitung nilai={v} hidup={hidup} format={p.besar} className="mws__cangka" />}
                    <span className="mws__cket">ketentuan {p.pendek}</span>
                    <span className="mws__cpersen">
                      {v === null ? (
                        "belum ada data"
                      ) : (
                        <>
                          <Hitung nilai={(v / p.min) * 100} hidup={hidup} format={(x) => `${koma(Math.round(x), 0)}%`} className="mws__cpersenangka" />
                          {" dari ketentuan"}
                        </>
                      )}
                    </span>
                    <span className={`mws__cbeda${beda === null ? "" : beda > 0 ? " is-naik" : beda < 0 ? " is-turun" : ""}`}>
                      {beda === null
                        ? sebelum
                          ? "—"
                          : `potret pertama · ${tglPendek(snap.tanggal)}`
                        : beda === 0
                          ? `tetap dari ${sebelum!.kode}`
                          : `${beda > 0 ? "▲" : "▼"} ${p.selisih(beda)} dari ${sebelum!.kode}`}
                    </span>
                    <span className="sr-only">, {TEKS_CAP[keadaan[p.kunci]]}</span>
                  </span>
                </button>
              );
            })}
          </div>

          <svg ref={lapisRef} className="mws__penunjuklapis" aria-hidden="true">
            {penunjuk.map((g) => (
              <g key={g.kunci} className={`mws__penunjuk is-${keadaan[g.kunci]}${kelasPilih(pasal.find((p) => p.kunci === g.kunci)!)}`}>
                <path
                  key={ditarik === g.kunci ? "tarik" : "diam"}
                  className={ditarik === g.kunci ? "mws__penunjukgaris is-ditarik" : "mws__penunjukgaris"}
                  d={g.d}
                  pathLength={1}
                />
                <circle cx={g.x} cy={g.y} r={2.5} />
              </g>
            ))}
          </svg>

          <div className="mws__lintasanket">
            <p>Lintasan kuartal</p>
            <small>Seret matahari, atau ← →</small>
          </div>

          <div
            className="mws__lintasan"
            role="slider"
            tabIndex={0}
            aria-label="Potret kuartal"
            aria-valuemin={0}
            aria-valuemax={n - 1}
            aria-valuenow={pilihPotret}
            aria-valuetext={`${snap.kini ? "Kini" : `${snap.kode} ${snap.tahun}`}, ${tglPanjang(snap.tanggal)}: ${memenuhi} dari ${pasal.length} pasal memenuhi`}
            onPointerDown={tekan}
            onPointerMove={geser}
            onPointerUp={lepas}
            onPointerCancel={batal}
            onKeyDown={tombolLintas}
          >
            <div className="mws__langit">
              <svg viewBox="0 0 1000 100" preserveAspectRatio="none" aria-hidden="true">
                <path className="mws__busurlangit" d={BUSUR_LANGIT} />
                {potret.map((s, i) => {
                  const x = lintasX(tDari(i));
                  return <path key={s.kode} className="mws__tegak" d={`M${bulat2(x)} ${bulat2(lintasY(x))}V100`} />;
                })}
                <path ref={jalurRef} className="mws__jalur" />
                <path className="mws__cakrawalagaris" d="M0 99.5H1000" />
              </svg>
              {potret.map((s, i) => {
                const x = lintasX(tDari(i));
                return (
                  <i
                    key={s.kode}
                    className={`mws__stasiun${i <= pilihPotret ? " is-lewat" : ""}${i === pilihPotret ? " is-pilih" : ""}`}
                    style={{ left: `${x / 10}%`, top: `${lintasY(x)}%` }}
                  />
                );
              })}
              <span ref={matahariRef} className="mws__matahari" aria-hidden="true">
                <svg viewBox="-14 -14 28 28">
                  <path
                    className="mws__sinar"
                    d={Array.from({ length: 8 }, (_, j) => {
                      const a = (j * Math.PI) / 4;
                      return `M${bulat2(Math.cos(a) * 9)} ${bulat2(Math.sin(a) * 9)}L${bulat2(Math.cos(a) * 13)} ${bulat2(Math.sin(a) * 13)}`;
                    }).join("")}
                  />
                  <circle className="mws__inti" r="6.5" />
                </svg>
              </span>
            </div>
            <div className="mws__cakrawala" aria-hidden="true">
              {potret.map((s, i) => (
                <span key={s.kode} className={i === pilihPotret ? "is-pilih" : undefined} style={{ left: `${lintasX(tDari(i)) / 10}%` }}>
                  <b>{s.kini ? "Kini" : `${s.kode} ’${String(s.tahun).slice(2)}`}</b>
                  <small>{tglPendek(s.tanggal)}</small>
                </span>
              ))}
            </div>
          </div>

          <div className="mws__periksa">
            <p>Diperiksa per</p>
            <b>{tglPanjang(snap.tanggal)}</b>
            <small>{snap.kini ? `hari ini · kuartal ${snap.kuartal}` : `akhir ${snap.kode} ${snap.tahun}`}</small>
          </div>
        </section>

        <section className="mws__kertas mws__lampiran" id={idLampiran} role="tabpanel" aria-labelledby={`mws-tab-${aktif.kunci}`}>
          <header className="mws__lampirankop">
            <div>
              <p>Lampiran §{aktif.no}</p>
              <h3>{aktif.judul}</h3>
              <small>{aktif.ketentuan(k)}</small>
            </div>
            <Cap key={`${aktif.kunci}-${tercap.n}`} keadaan={keadaan[aktif.kunci]} no={aktif.no} kode={kodeSnap} tercap={tercap.nyala} />
          </header>
          {sumber && (
            <a className="mws__sumber" href={sumber.href}>
              Sumber · <b>{sumber.kode}</b> {sumber.label}
            </a>
          )}
          <Jejak pasal={aktif} skala={skala[aktif.kunci]} potret={potret} pilih={pilihPotret} onPilih={(i) => pilihSnap(i)} />
          <div key={`${aktif.kunci}-${lampiranBaru}`} className={lampiranBaru ? "mws__lampiranisi is-baru" : "mws__lampiranisi"}>
            {lampiran}
          </div>
          {(() => {
            const c = catatanPemeriksa(aktif, snap.nilai[aktif.kunci], k, snap.kini);
            return (
              <div className={c.kurang ? "mws__pemeriksa is-kurang" : "mws__pemeriksa"}>
                <p>
                  Catatan pemeriksa · {kodeSnap} {snap.tahun}
                </p>
                <span>{c.teks}</span>
              </div>
            );
          })()}
          <p className="mws__lampirankaki">
            Diperiksa {studio?.studioName ?? "studio"} · rincian per {tglPanjang(k.hariIni)}
          </p>
        </section>
      </div>
      <Keterangan kabar={kabar} />
    </div>
  );
}

export function KpiKit() {
  return (
    <RequireAuth skeleton={<Rangka />}>
      <Isi />
    </RequireAuth>
  );
}
