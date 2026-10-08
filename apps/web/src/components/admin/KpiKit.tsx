import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
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
   KPI Strategi = TABEL KESESUAIAN — dokumen STRATEGI_BISNIS §8.

   Di dunia arsitektur, rencana selalu diperiksa terhadap KETENTUAN: tabel
   intensitas di gambar izin bangunan menulis ketentuan KRK (KDB maks, KDH
   min, garis sempadan) di sebelah angka rencananya, lalu satu kolom
   "Memenuhi / Tidak". Halaman ini tabel yang sama untuk studionya sendiri:
   ketentuannya lima target dokumen strategi §8, rencananya angka studio yang
   dihitung API dari catatan panel.

   1. TABEL — satu baris per PASAL (§8.1–8.5): uraian + ketentuan, GARIS
      UKUR (mistar berskala dengan ZONA ketentuan berarsir — seperti garis
      sempadan — penanda realisasi, dan TAKIK potret sebelumnya), angka
      realisasi + selisihnya, dan CAP MEMENUHI / MELAMPAUI / BELUM.
   2. DIPERIKSA PER — potret akhir K1/K2/K3 dan hari ini (`jejak` API: angka
      yang SAMA dengan yang terbaca di halaman ini pada hari itu). Memilih
      potret menggeser penanda, menghitung angka, dan mengecap ulang pasal
      yang keadaannya berubah.
   3. LAMPIRAN — rincian pasal yang dipilih (tab), dari data yang sama:
      sebaran kontrak, biaya per proyek, status pesan, tangga paket, landasan
      kas; dengan tautan ke LEMBAR SUMBERNYA (nomor set gambar rel).

   Gerak hanya karena perbuatan, tidak saat dimuat, diam bila gerak
   dikurangi. Warna: hijau = memenuhi, amber = belum. Merah tidak dipakai —
   angka di bawah target bukan perbuatan destruktif.
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
  ketentuan: (k: KpiStrategi) => string;
  min: number;
  maks: number | null;
  /** Bilangan bulat (lead, proyek): skala bertangga 1. */
  bulat?: boolean;
  besar: (v: number) => string;
  selisih: (d: number) => string;
  skala: (v: number) => string;
  sumber: string;
}

const koma = (v: number, d = 1) => v.toLocaleString("id-ID", { maximumFractionDigits: d });
const jt = (v: number) => `${koma(v / 1e6, 0)} jt`;

function pasalDari(k: KpiStrategi): Pasal[] {
  const t = k.target;
  return [
    {
      kunci: "kontrak",
      no: "8.1",
      judul: "Rata-rata nilai kontrak",
      ketentuan: (x) => `Rp${koma(t.rataKontrakMin / 1e6, 0)}–${koma(t.rataKontrakMaks / 1e6, 0)} jt per proyek · ${x.rataKontrak.proyek} proyek`,
      min: t.rataKontrakMin,
      maks: t.rataKontrakMaks,
      besar: (v) => formatRupiahRingkas(v),
      selisih: (d) => formatRupiahRingkas(Math.abs(d)),
      skala: (v) => (v === 0 ? "0" : jt(v)),
      sumber: "/admin/proyek",
    },
    {
      kunci: "margin",
      no: "8.2",
      judul: "Margin kontrak",
      ketentuan: () => `≥${t.marginMin}% sesudah biaya proyek, tertimbang`,
      min: t.marginMin,
      maks: null,
      besar: (v) => `${koma(v)}%`,
      selisih: (d) => `${koma(Math.abs(d))} poin`,
      skala: (v) => `${koma(v, 0)}%`,
      sumber: "/admin/keuangan/keluar",
    },
    {
      kunci: "lead",
      no: "8.3",
      judul: "Pesan masuk per kuartal",
      ketentuan: (x) => `${t.leadKuartalMin}–${t.leadKuartalMaks} pesan · ${x.lead.ditindaklanjuti} ditindaklanjuti`,
      min: t.leadKuartalMin,
      maks: t.leadKuartalMaks,
      bulat: true,
      besar: (v) => `${koma(v, 0)} pesan`,
      selisih: (d) => `${koma(Math.abs(d), 0)} pesan`,
      skala: (v) => koma(v, 0),
      sumber: "/admin/pesan",
    },
    {
      kunci: "signature",
      no: "8.4",
      judul: "Proyek Signature ke atas",
      ketentuan: () => `≥${t.signatureMin} proyek setahun, paket urutan 2 ke atas`,
      min: t.signatureMin,
      maks: null,
      bulat: true,
      besar: (v) => `${koma(v, 0)} proyek`,
      selisih: (d) => `${koma(Math.abs(d), 0)} proyek`,
      skala: (v) => koma(v, 0),
      sumber: "/admin/paket",
    },
    {
      kunci: "cadangan",
      no: "8.5",
      judul: "Cadangan kas",
      ketentuan: () => `≥${t.cadanganBulan} bulan pengeluaran studio`,
      min: t.cadanganBulan,
      maks: null,
      besar: (v) => `${koma(v)} bulan`,
      selisih: (d) => `${koma(Math.abs(d))} bulan`,
      skala: (v) => `${koma(v, 0)} bln`,
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
  langkah: number;
  pos: (v: number) => number;
  dari: (persen: number) => number;
}

/** Satu skala per pasal, cukup lebar untuk SEMUA potret dan ketentuannya —
    jadi penanda tidak pernah keluar mistar saat potret berganti. */
function skalaDari(p: Pasal, nilai: (number | null)[]): Skala {
  const ada = nilai.filter((v): v is number => v !== null);
  const puncak = Math.max(...ada, (p.maks ?? p.min) * 1.25);
  const dasar = Math.min(0, ...ada);
  const l = langkah(puncak - dasar, !!p.bulat);
  const atas = Math.ceil(puncak / l) * l;
  const bawah = Math.floor(dasar / l) * l;
  const rentang = atas - bawah || 1;
  return {
    bawah,
    atas,
    langkah: l,
    pos: (v) => Math.min(100, Math.max(0, ((v - bawah) / rentang) * 100)),
    dari: (persen) => bawah + (persen / 100) * rentang,
  };
}

const TGL = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", timeZone: "UTC" });
const TGL_PANJANG = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const BLN = new Intl.DateTimeFormat("id-ID", { month: "short", timeZone: "UTC" });
const tglPendek = (t: string) => TGL.format(new Date(`${t}T00:00:00Z`));
const tglPanjang = (t: string) => TGL_PANJANG.format(new Date(`${t}T00:00:00Z`));
const blnPendek = (b: string) => BLN.format(new Date(`${b}-01T00:00:00Z`));

/* ---- Garis ukur --------------------------------------------------------------
   Mistar berskala: zona ketentuan berarsir di dalam rel, garis batasnya
   putus-putus, takik potret sebelumnya, penanda realisasi, dan — untuk
   pasal yang sedang diperiksa — GARIS UKUR yang ditarik dari nol ke
   penanda. Tulisan skala hanya di pita bawah; pita atas milik pembacaan
   tetikus. Tidak ada tulisan di dalam rel (jebakan #70). */
function GarisUkur({
  pasal,
  skala,
  nilai,
  takik,
  takikKode,
  diukur,
  ket,
}: {
  pasal: Pasal;
  skala: Skala;
  nilai: number | null;
  takik: number | null;
  takikKode: string | null;
  diukur: boolean;
  ket: ReturnType<typeof pemberiKet>;
}) {
  const baca = useRef<HTMLSpanElement>(null);
  const bacaTeks = useRef<HTMLElement>(null);
  const kotak = useRef<DOMRect | null>(null);
  const nol = skala.pos(Math.max(0, skala.bawah));
  const zonaA = skala.pos(pasal.min);
  const zonaB = pasal.maks === null ? 100 : skala.pos(pasal.maks);
  const ticks: number[] = [];
  for (let v = skala.bawah; v <= skala.atas + skala.langkah / 1000; v += skala.langkah) ticks.push(Math.round(v * 1000) / 1000);
  const x = nilai === null ? null : skala.pos(nilai);
  const isiDari = Math.min(nol, x ?? nol);
  const isiLebar = x === null ? 0 : Math.abs(x - nol);

  /* Pembacaan skala mengikuti TETIKUS (jebakan #9): kotak mistar dibaca
     sekali saat masuk, lalu tiap gerak cuma menulis transform + teks lewat
     ref — tanpa render ulang, tanpa membaca geometri di tengah gerak. */
  const masuk = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse") return;
    kotak.current = e.currentTarget.getBoundingClientRect();
    gerak(e);
  };
  const gerak = (e: React.PointerEvent<HTMLDivElement>) => {
    const k = kotak.current;
    if (e.pointerType !== "mouse" || !k || !baca.current || !bacaTeks.current) return;
    const persen = Math.min(100, Math.max(0, ((e.clientX - k.left) / k.width) * 100));
    baca.current.style.setProperty("--tks-baca", `${persen}%`);
    baca.current.dataset.tampak = "";
    bacaTeks.current.textContent = pasal.skala(skala.dari(persen));
  };
  const keluar = () => {
    kotak.current = null;
    if (baca.current) delete baca.current.dataset.tampak;
  };

  return (
    <div className="tks__mistar" onPointerEnter={masuk} onPointerMove={gerak} onPointerLeave={keluar} aria-hidden="true">
      <span ref={baca} className="tks__baca">
        <b ref={bacaTeks} />
      </span>
      <div className="tks__rel">
        <i className="tks__zona" style={{ left: `${zonaA}%`, width: `${zonaB - zonaA}%` }} />
        <i className="tks__batas" style={{ left: `${zonaA}%` }} />
        {pasal.maks !== null && <i className="tks__batas" style={{ left: `${zonaB}%` }} />}
        {x !== null && (
          <i
            className={diukur ? "tks__isi is-diukur" : "tks__isi"}
            style={{ left: `${isiDari}%`, width: `${isiLebar}%`, transformOrigin: x >= nol ? "left" : "right" }}
          />
        )}
        {takik !== null && (
          <i
            className="tks__takik"
            style={{ left: `${skala.pos(takik)}%` }}
            {...ket(() => ({ judul: `Potret ${takikKode}`, baris: [{ label: pasal.judul, nilai: pasal.besar(takik) }] }))}
          />
        )}
        {x !== null && nilai !== null && (
          <b
            className="tks__penanda"
            style={{ left: `${x}%` }}
            {...ket(() => ({ judul: "Realisasi", baris: [{ label: pasal.judul, nilai: pasal.besar(nilai) }] }))}
          />
        )}
      </div>
      <div className="tks__skala">
        {ticks.map((v, i) => {
          const pos = skala.pos(v);
          /* Takik tetap ada, tulisannya mengalah: label tengah yang terlalu
             dekat ke label ujung (rata kiri/kanan) akan bertindih di mistar
             yang sempit. */
          const ujung = i === 0 || i === ticks.length - 1;
          const bisu = !ujung && (pos < 14 || pos > 78);
          return (
            <span
              key={v}
              className={i === 0 ? "is-awal" : i === ticks.length - 1 ? "is-akhir" : bisu ? "is-bisu" : undefined}
              style={{ left: `${pos}%` }}
            >
              {bisu ? "" : pasal.skala(v)}
            </span>
          );
        })}
      </div>
    </div>
  );
}

/* ---- Cap pemeriksaan -------------------------------------------------------- */
function Cap({ keadaan, no, kode, tercap }: { keadaan: Keadaan; no: string; kode: string; tercap: boolean }) {
  return (
    <span className={`tks__cap is-${keadaan}${tercap ? " is-tercap" : ""}`}>
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
    <div className="tks__jejak">
      <div className="tks__jejakbidang" aria-hidden="true">
        <i className="tks__jejakzona" style={{ bottom: `${zonaA}%`, height: `${zonaB - zonaA}%` }} />
      </div>
      {potret.map((p, i) => {
        const v = p.nilai[pasal.kunci];
        const y = v === null ? nol : skala.pos(v);
        return (
          <button
            key={p.kode}
            type="button"
            className={i === pilih ? "tks__jejakkolom is-pilih" : "tks__jejakkolom"}
            aria-pressed={i === pilih}
            aria-label={`${p.kode} ${tglPendek(p.tanggal)}: ${v === null ? "belum ada data" : pasal.besar(v)}`}
            onClick={() => onPilih(i)}
          >
            <span className="tks__jejaktiang" aria-hidden="true">
              <i style={{ bottom: `${Math.min(nol, y)}%`, height: `${Math.abs(y - nol)}%` }} />
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
      <h4 className="tks__sub">Sebaran kontrak {k.tahun}</h4>
      <div className="tks__sebaran" aria-hidden="true">
        <i className="tks__zona" style={{ left: `${skala.pos(t.rataKontrakMin)}%`, width: `${skala.pos(t.rataKontrakMaks) - skala.pos(t.rataKontrakMin)}%` }} />
        {urut.map((p) => (
          <i
            key={p.projectId}
            className="tks__titik"
            style={{ left: `${skala.pos(p.kontrak)}%` }}
            {...ket(() => ({ judul: p.title, baris: [{ label: "Nilai kontrak", nilai: formatRupiah(p.kontrak) }] }))}
          />
        ))}
        {k.rataKontrak.nilai !== null && <b className="tks__penanda" style={{ left: `${skala.pos(k.rataKontrak.nilai)}%` }} />}
      </div>
      <div className="tks__sebaranskala" aria-hidden="true">
        <span>{skala.bawah === 0 ? "0" : jt(skala.bawah)}</span>
        <span>{jt(skala.atas)}</span>
      </div>
      <ol className="tks__daftar">
        {urut.map((p) => (
          <li key={p.projectId}>
            <span className="tks__kode">{kodeProyek(p.title)}</span>
            <a href={`/admin/proyek/satu?id=${encodeURIComponent(p.projectId)}`}>{p.title}</a>
            <small>{p.tier ?? "Tanpa paket"}</small>
            <b className={p.kontrak < t.rataKontrakMin ? "is-belum" : undefined}>{formatRupiahRingkas(p.kontrak)}</b>
          </li>
        ))}
        {!urut.length && <li className="tks__kosong">Belum ada proyek berkontrak tahun ini.</li>}
      </ol>
    </>
  );
}

function LampiranMargin({ k, ket }: { k: KpiStrategi; ket: ReturnType<typeof pemberiKet> }) {
  const min = k.target.marginMin;
  const urut = [...k.proyek].sort((a, b) => a.margin - b.margin);
  return (
    <>
      <h4 className="tks__sub">
        Biaya terhadap kontrak <span>batas biaya {100 - min}%</span>
      </h4>
      <ol className="tks__daftar tks__daftar--batang">
        {urut.map((p) => {
          const biaya = Math.min(100, (p.biaya / p.kontrak) * 100);
          return (
            <li key={p.projectId}>
              <a href={`/admin/proyek/satu?id=${encodeURIComponent(p.projectId)}`}>{p.title}</a>
              <b className={p.margin < min ? "is-belum" : undefined}>{koma(p.margin)}%</b>
              <span
                className={p.biaya > p.kontrak ? "tks__batangbiaya is-lebih" : "tks__batangbiaya"}
                style={{ "--tks-biaya": `${biaya}%`, "--tks-garisbatas": `${100 - min}%` } as CSSProperties}
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
        {!urut.length && <li className="tks__kosong">Belum ada proyek berkontrak tahun ini.</li>}
      </ol>
      {k.segmen.length > 0 && (
        <>
          <h4 className="tks__sub">Laba kas per segmen</h4>
          <dl className="tks__segmen">
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
      <h4 className="tks__sub">Status pesan kuartal {k.kuartal}</h4>
      <ol className="tks__daftar tks__daftar--status">
        {STATUS_LEAD.map((s) => (
          <li key={s.kunci}>
            <span>{s.label}</span>
            <span className="tks__batangpenuh" aria-hidden="true">
              <i
                className={s.kunci === "contacted" || s.kunci === "qualified" ? "is-lanjut" : undefined}
                style={{ width: `${(k.lead.status[s.kunci] / total) * 100}%` }}
              />
            </span>
            <b>{k.lead.status[s.kunci]}</b>
          </li>
        ))}
      </ol>
      <h4 className="tks__sub">
        Per bulan <span>laju ketentuan {koma(perBulanMin)}–{koma(perBulanMaks)}</span>
      </h4>
      <div className="tks__bulan" aria-label="Pesan masuk per bulan kuartal ini">
        <div className="tks__bidangtiang" aria-hidden="true">
          <i className="tks__bulanzona" style={{ bottom: `${(perBulanMin / puncak) * 100}%`, height: `${((perBulanMaks - perBulanMin) / puncak) * 100}%` }} />
        </div>
        {k.lead.perBulan.map((b) => (
          <div key={b.bulan} className="tks__bulankolom">
            <span className="tks__bulantiang" aria-hidden="true">
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
      <h4 className="tks__sub">
        Tangga paket {k.tahun} <span>arsir = Signature ke atas</span>
      </h4>
      <div className="tks__tangga">
        {kelompok
          .filter((g) => g.anak.length)
          .map((g) => (
            <div key={g.kunci} className="tks__tanggakelompok">
              <p>{g.label}</p>
              <ol>
                {g.anak.map((t, i) => (
                  <li
                    key={t.nama}
                    className={t.urutan >= 2 ? "is-atas" : undefined}
                    style={{ "--tks-anak": i + 1, "--tks-anak-n": g.anak.length } as CSSProperties}
                  >
                    <span className="tks__tanggajumlah">{t.jumlah}</span>
                    <span className="tks__tanggaanak" aria-hidden="true" />
                    <small>{t.nama}</small>
                  </li>
                ))}
              </ol>
            </div>
          ))}
      </div>
      <ol className="tks__daftar">
        {k.signature.proyek.map((p) => (
          <li key={p.projectId}>
            <span className="tks__kode">{kodeProyek(p.title)}</span>
            <a href={`/admin/proyek/satu?id=${encodeURIComponent(p.projectId)}`}>{p.title}</a>
            <small>{p.tier}</small>
          </li>
        ))}
        {!k.signature.proyek.length && <li className="tks__kosong">Belum ada proyek Signature ke atas tahun ini.</li>}
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
      <p className="tks__hasil">
        <b className={c.bulan !== null && c.bulan < target ? "is-belum" : undefined}>
          {c.bulan === null ? "—" : c.saldo <= 0 ? "Saldo minus" : `${koma(c.bulan)} bulan`}
        </b>
        <span>dari {target} bulan ketentuan</span>
      </p>
      <p className="tks__rumus">
        {formatRupiah(c.saldo)} <em>÷</em> {c.keluarPerBulan === null ? "—" : `${formatRupiah(c.keluarPerBulan)}/bln`}
      </p>
      <p className="tks__rumusket">Saldo catatan panel ÷ rata-rata keluar {c.bulanBerdata} bulan berdata</p>
      <div className="tks__landasan" aria-label={`Cadangan ${c.bulan === null ? "belum ada data" : koma(c.bulan)} dari ${target} bulan`}>
        {Array.from({ length: n }, (_, i) => {
          const isi = c.bulan === null ? 0 : Math.min(1, Math.max(0, c.bulan - i));
          return (
            <span
              key={i}
              className={`tks__landasanbulan${i < target ? " is-wajib" : ""}${i + 1 === target ? " is-batas" : ""}`}
            >
              <i style={{ width: `${isi * 100}%` }} />
              <small>{i + 1}</small>
            </span>
          );
        })}
      </div>
      <h4 className="tks__sub">
        Keluar per bulan <span>putus = rata-rata</span>
      </h4>
      <div className="tks__keluar">
        <div className="tks__bidangtiang" aria-hidden="true">
          {c.keluarPerBulan !== null && <i className="tks__rata" style={{ bottom: `${(c.keluarPerBulan / puncak) * 100}%` }} />}
        </div>
        {bulanan.map((b) => (
          <div
            key={b.bulan}
            className="tks__keluarkolom"
            {...ket(() => ({ judul: blnPendek(b.bulan), baris: [{ label: "Uang keluar", nilai: formatRupiah(b.keluar) }] }))}
          >
            <span className="tks__bulantiang" aria-hidden="true">
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
      <div className="tks">
        <div className="tks__papan tks__papan--galat">
          <p>KPI tidak bisa dimuat: {galat}</p>
        </div>
      </div>
    ) : (
      <Rangka />
    );
  }
  return <Tabel k={k} studio={studio} />;
}

function Rangka() {
  return (
    <div className="tks" aria-busy="true">
      <div className="tks__papan">
        <div className="tks__kertas tks__kertas--rangka" />
        <div className="tks__kertas tks__kertas--rangka tks__lampiran" />
      </div>
    </div>
  );
}

function Tabel({ k, studio }: { k: KpiStrategi; studio: StudioSettings | null }) {
  const pasal = useMemo(() => pasalDari(k), [k]);
  const potret = useMemo(() => potretDari(k), [k]);
  const skala = useMemo(
    () => Object.fromEntries(pasal.map((p) => [p.kunci, skalaDari(p, potret.map((x) => x.nilai[p.kunci]))])) as Record<Kunci, Skala>,
    [pasal, potret],
  );
  const kini = potret.length - 1;
  const [pilihPotret, setPilihPotret] = useState(kini);
  /* Bawaan: pasal pertama yang BELUM memenuhi — halaman membuka yang perlu
     diperhatikan. */
  const [pilihPasal, setPilihPasal] = useState<Kunci>(
    () => pasal.find((p) => keadaanDari(p, potret[kini]!.nilai[p.kunci]) === "belum")?.kunci ?? "kontrak",
  );
  /* Gerak hanya sesudah perbuatan (jebakan #74): `hidup` menyala sesudah
     bingkai pertama, `diukur` dan `tercap` hanya dipasang oleh klik. */
  const [hidup, setHidup] = useState(false);
  const [diukur, setDiukur] = useState<Kunci | null>(null);
  const [tercap, setTercap] = useState<{ kunci: Set<Kunci>; putaran: number }>({ kunci: new Set(), putaran: 0 });
  const [lampiranBaru, setLampiranBaru] = useState(0);
  const waktu = useRef<number[]>([]);
  const kabar: KabarKartu = useRef(null);
  const ket = pemberiKet(kabar);
  const idLampiran = useId();
  const tabRef = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    let b2 = 0;
    const b1 = requestAnimationFrame(() => (b2 = requestAnimationFrame(() => setHidup(true))));
    return () => {
      cancelAnimationFrame(b1);
      cancelAnimationFrame(b2);
      waktu.current.forEach((w) => window.clearTimeout(w));
    };
  }, []);

  const tunda = (f: () => void, ms: number) => {
    waktu.current.push(window.setTimeout(f, ms));
  };

  const pilihSnap = (i: number) => {
    if (i === pilihPotret) return;
    const berubah = new Set(
      pasal.filter((p) => keadaanDari(p, potret[i]!.nilai[p.kunci]) !== keadaanDari(p, potret[pilihPotret]!.nilai[p.kunci])).map((p) => p.kunci),
    );
    setPilihPotret(i);
    if (geraknya() && berubah.size) {
      setTercap((c) => ({ kunci: berubah, putaran: c.putaran + 1 }));
      tunda(() => setTercap((c) => ({ kunci: new Set(), putaran: c.putaran })), 700);
    }
  };

  const pilihP = (kunci: Kunci) => {
    if (kunci === pilihPasal) return;
    setPilihPasal(kunci);
    if (geraknya()) {
      setDiukur(kunci);
      setLampiranBaru((n) => n + 1);
      tunda(() => setDiukur((d) => (d === kunci ? null : d)), 800);
    }
  };

  const tombolTab = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const n = pasal.length;
    const ke =
      e.key === "ArrowDown" ? (i + 1) % n : e.key === "ArrowUp" ? (i - 1 + n) % n : e.key === "Home" ? 0 : e.key === "End" ? n - 1 : null;
    if (ke === null) return;
    e.preventDefault();
    pilihP(pasal[ke]!.kunci);
    tabRef.current[ke]?.focus();
  };

  const tombolSnap = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const n = potret.length;
    const ke =
      e.key === "ArrowRight" ? Math.min(n - 1, i + 1) : e.key === "ArrowLeft" ? Math.max(0, i - 1) : e.key === "Home" ? 0 : e.key === "End" ? n - 1 : null;
    if (ke === null) return;
    e.preventDefault();
    pilihSnap(ke);
    (e.currentTarget.parentElement?.children[ke] as HTMLElement | undefined)?.focus();
  };

  const snap = potret[pilihPotret]!;
  const sebelum = pilihPotret > 0 ? potret[pilihPotret - 1]! : null;
  const keadaan = Object.fromEntries(pasal.map((p) => [p.kunci, keadaanDari(p, snap.nilai[p.kunci])])) as Record<Kunci, Keadaan>;
  const memenuhi = pasal.filter((p) => keadaan[p.kunci] === "memenuhi" || keadaan[p.kunci] === "lampaui").length;
  const daftar = daftarLembar().halaman;
  const aktif = pasal.find((p) => p.kunci === pilihPasal)!;
  const sumber = lembarUntuk(aktif.sumber, daftar)?.lembar ?? null;

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

  return (
    <div className={hidup ? "tks is-hidup" : "tks"}>
      <div className="tks__papan">
        <section className="tks__kertas tks__tabel" aria-labelledby="tks-judul">
          <header className="tks__kop">
            <div className="tks__kopjudul">
              <p>Dokumen strategi bisnis · Pasal 8</p>
              <h2 id="tks-judul">Tabel kesesuaian</h2>
              <p className="tks__kopsub">Ketentuan strategi studio terhadap realisasi {snap.tahun}</p>
            </div>
            <div className="tks__periksa">
              <p id="tks-periksa">Diperiksa per</p>
              <div className="tks__potret" role="radiogroup" aria-labelledby="tks-periksa">
                {potret.map((p, i) => (
                  <button
                    key={p.kode}
                    type="button"
                    role="radio"
                    aria-checked={i === pilihPotret}
                    tabIndex={i === pilihPotret ? 0 : -1}
                    className={i === pilihPotret ? "is-pilih" : undefined}
                    onClick={() => pilihSnap(i)}
                    onKeyDown={(e) => tombolSnap(e, i)}
                  >
                    <b>{p.kini ? "Kini" : `${p.kode} ${String(p.tahun).slice(2)}`}</b>
                    <small>{tglPendek(p.tanggal)}</small>
                  </button>
                ))}
              </div>
            </div>
            <div className="tks__tally" aria-label={`${memenuhi} dari ${pasal.length} pasal memenuhi`}>
              <span>
                <Hitung nilai={memenuhi} hidup={hidup} format={(v) => koma(Math.round(v), 0)} />
                <em>/{pasal.length}</em>
              </span>
              <small>pasal memenuhi</small>
            </div>
          </header>

          <div className="tks__kepala" aria-hidden="true">
            <span>Pasal</span>
            <span>Uraian &amp; ketentuan</span>
            <span>Garis ukur</span>
            <span>Realisasi</span>
            <span>Pemeriksaan</span>
          </div>

          <div className="tks__pasal" role="tablist" aria-orientation="vertical" aria-label="Pasal KPI">
            {pasal.map((p, i) => {
              const v = snap.nilai[p.kunci];
              const lalu = sebelum?.nilai[p.kunci] ?? null;
              const beda = v !== null && lalu !== null ? v - lalu : null;
              const dipilih = p.kunci === pilihPasal;
              return (
                <div key={p.kunci} className={`tks__baris is-${keadaan[p.kunci]}${dipilih ? " is-pilih" : ""}`}>
                  <button
                    ref={(el) => {
                      tabRef.current[i] = el;
                    }}
                    type="button"
                    role="tab"
                    id={`tks-tab-${p.kunci}`}
                    aria-selected={dipilih}
                    aria-controls={idLampiran}
                    tabIndex={dipilih ? 0 : -1}
                    className="tks__pilih"
                    onClick={() => pilihP(p.kunci)}
                    onKeyDown={(e) => tombolTab(e, i)}
                  >
                    <span className="sr-only">
                      §{p.no} {p.judul}: {v === null ? "belum ada data" : p.besar(v)}, {TEKS_CAP[keadaan[p.kunci]]}
                    </span>
                  </button>
                  <span className="tks__no" aria-hidden="true">
                    <b>§{p.no}</b>
                    <small>{lembarUntuk(p.sumber, daftar)?.lembar.kode ?? ""}</small>
                  </span>
                  <span className="tks__uraian" aria-hidden="true">
                    <b>{p.judul}</b>
                    <small>{p.ketentuan(k)}</small>
                  </span>
                  <div className="tks__ukur" onClick={() => pilihP(p.kunci)}>
                    <GarisUkur
                      pasal={p}
                      skala={skala[p.kunci]}
                      nilai={v}
                      takik={lalu}
                      takikKode={sebelum?.kode ?? null}
                      diukur={diukur === p.kunci}
                      ket={ket}
                    />
                  </div>
                  <span className="tks__nilai" aria-hidden="true">
                    {v === null ? <b>—</b> : <Hitung nilai={v} hidup={hidup} format={p.besar} className="tks__angka" />}
                    <small className={beda === null ? undefined : beda > 0 ? "is-naik" : beda < 0 ? "is-turun" : undefined}>
                      {beda === null
                        ? sebelum
                          ? `—`
                          : `per ${tglPendek(snap.tanggal)}`
                        : beda === 0
                          ? `tetap dari ${sebelum!.kode}`
                          : `${beda > 0 ? "▲" : "▼"} ${p.selisih(beda)} dari ${sebelum!.kode}`}
                    </small>
                  </span>
                  <span className="tks__periksasel" aria-hidden="true">
                    <Cap
                      key={`${keadaan[p.kunci]}-${tercap.kunci.has(p.kunci) ? tercap.putaran : 0}`}
                      keadaan={keadaan[p.kunci]}
                      no={p.no}
                      kode={snap.kini ? `K${snap.kuartal}` : snap.kode}
                      tercap={tercap.kunci.has(p.kunci)}
                    />
                  </span>
                </div>
              );
            })}
          </div>

          <footer className="tks__kaki">
            <span className="tks__legenda">
              <i className="tks__lg-zona" /> zona ketentuan
            </span>
            <span className="tks__legenda">
              <i className="tks__lg-penanda" /> realisasi
            </span>
            {sebelum && (
              <span className="tks__legenda">
                <i className="tks__lg-takik" /> potret {sebelum.kode}
              </span>
            )}
            <span className="tks__diperiksa">
              Diperiksa {studio?.studioName ?? "studio"} · {tglPanjang(snap.tanggal)}
            </span>
          </footer>
        </section>

        <section
          className="tks__kertas tks__lampiran"
          id={idLampiran}
          role="tabpanel"
          aria-labelledby={`tks-tab-${aktif.kunci}`}
        >
          <header className="tks__lampirankop">
            <p>Lampiran §{aktif.no}</p>
            <h3>{aktif.judul}</h3>
            {sumber && (
              <a className="tks__sumber" href={sumber.href}>
                Sumber · <b>{sumber.kode}</b> {sumber.label}
              </a>
            )}
          </header>
          <Jejak pasal={aktif} skala={skala[aktif.kunci]} potret={potret} pilih={pilihPotret} onPilih={pilihSnap} />
          <div key={`${aktif.kunci}-${lampiranBaru}`} className={lampiranBaru ? "tks__lampiranisi is-baru" : "tks__lampiranisi"}>
            {lampiran}
          </div>
          <p className="tks__lampirankaki">Rincian per {tglPanjang(k.hariIni)}</p>
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
