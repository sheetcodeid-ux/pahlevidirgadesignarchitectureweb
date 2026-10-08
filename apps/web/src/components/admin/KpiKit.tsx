import {
  Fragment,
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
import { Angka7 } from "./angka7";

/* =============================================================================
   KPI Strategi = PANEL KENDALI KINERJA — dokumen STRATEGI_BISNIS §8.

   Benda dunia nyatanya panel instrumen gedung (panel BMS / panel MCC) yang
   dipasang di ruang kendali: alat ukur jarum di baris atas, kendali di
   baris bawah. Dipilih pemilik lewat sketsa ASCII sesudah Tabel Kesesuaian,
   Mawar Strategi, dan Papan Kinerja ditolak. Di atas papan `--kas-bidang`
   berjahit:

   1. PELAT NAMA bersekrup + ANNUNSIATOR — satu jendela berlampu per pasal
      (mint memenuhi / amber belum / padam belum ada data). Jendela yang
      keadaannya berubah saat saklar diputar BERKEDIP tiga kali.
   2. LIMA METER PANEL (DIN) — muka putih, busur 90°, cermin anti-paralaks,
      pita zona ketentuan (amber di bawah, mint di dalam, mint pucat di atas
      rentang), JARUM BATAS di ketentuan, JARUM PENGINGAT di potret
      sebelumnya, tutup jarum dengan sekrup nol, dan pelat bertulisan di
      bawahnya (bacaan angka + ketentuan + lembar sumber). Meter = tab pasal.
   3. MODUL INDUK di tengah baris bawah — meter SKOR (0–5 pasal, pitanya
      lima ruas), layar VFD tanggal potret, dan SAKLAR PEMILIH K1/K2/K3/Kini
      yang bisa diputar (seret kenopnya, klik posisinya, atau panah). Tiap
      takik yang dilewati langsung berlaku: SEMUA JARUM BERAYUN berpegas ke
      nilai kuartal itu.
   4. PENCATAT GRAFIK — kertas berkisi berlubang sproket di antara dua rol:
      pena menulis jejak pasal terpilih (garis lewat potret, tangga
      Signature, kolom pesan per kuartal yang kuartal berjalannya masih
      terbuka), pena titik mencetak proyek, pena peristiwa menandai
      K1/K2/K3/Kini. Pasal berganti = pena MENULIS ULANG dari kiri.
   5. KERTAS RINCIAN — cap pemeriksaan, catatan pemeriksa, lampiran per
      pasal, tautan ke lembar sumbernya.

   Gerak hanya karena perbuatan (jebakan #74), tidak saat dimuat, diam bila
   gerak dikurangi. Jarum ditulis langsung ke atribut `transform` per
   bingkai (pegas teredam), bukan lewat render React. Tidak ada tulisan di
   daerah sapuan jarum maupun di bidang kertas pencatat — angka skala di
   luar busur, label di talang kertas (jebakan #70). Warna: mint memenuhi,
   amber belum; merah tidak dipakai.
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
  /** Judul pendek untuk baris matriks. */
  singkat: string;
  ketentuan: (k: KpiStrategi) => string;
  pendek: string;
  min: number;
  maks: number | null;
  bulat?: boolean;
  besar: (v: number) => string;
  /** Nilai ringkas di sel matriks dan sumbu. */
  ringkas: (v: number) => string;
  selisih: (d: number) => string;
  /** Selisih ringkas untuk garis dimensi. */
  selisihPendek: (d: number) => string;
  sumber: string;
  /** Tulisan jendela annunsiator. */
  lampu: string;
  /** Satuan yang tercetak di muka meter. */
  satuan: string;
  /** Angka skala muka meter dan kertas pencatat. */
  angkaSkala: (v: number) => string;
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
      singkat: "Rata-rata kontrak",
      ketentuan: (x) => `Rp${koma(t.rataKontrakMin / 1e6, 0)}–${koma(t.rataKontrakMaks / 1e6, 0)} jt per proyek · ${x.rataKontrak.proyek} proyek`,
      pendek: `Rp${koma(t.rataKontrakMin / 1e6, 0)}–${koma(t.rataKontrakMaks / 1e6, 0)} jt`,
      min: t.rataKontrakMin,
      maks: t.rataKontrakMaks,
      besar: (v) => formatRupiahRingkas(v),
      ringkas: (v) => jt(v),
      selisih: (d) => formatRupiahRingkas(Math.abs(d)),
      selisihPendek: (d) => jt(Math.abs(d)),
      sumber: "/admin/proyek",
      lampu: "Kontrak",
      satuan: "Rp juta",
      angkaSkala: (v) => koma(v / 1e6, 1),
    },
    {
      kunci: "margin",
      no: "8.2",
      judul: "Margin kontrak",
      singkat: "Margin kontrak",
      ketentuan: () => `≥${t.marginMin}% sesudah biaya proyek, tertimbang`,
      pendek: `≥${t.marginMin}%`,
      min: t.marginMin,
      maks: null,
      besar: (v) => `${koma(v)}%`,
      ringkas: (v) => `${koma(v)}%`,
      selisih: (d) => `${koma(Math.abs(d))} poin`,
      selisihPendek: (d) => `${koma(Math.abs(d))} poin`,
      sumber: "/admin/keuangan/keluar",
      lampu: "Margin",
      satuan: "persen",
      angkaSkala: (v) => koma(v, 1),
    },
    {
      kunci: "lead",
      no: "8.3",
      judul: "Pesan masuk per kuartal",
      singkat: "Pesan masuk",
      ketentuan: (x) => `${t.leadKuartalMin}–${t.leadKuartalMaks} pesan · ${x.lead.ditindaklanjuti} ditindaklanjuti`,
      pendek: `${t.leadKuartalMin}–${t.leadKuartalMaks} pesan`,
      min: t.leadKuartalMin,
      maks: t.leadKuartalMaks,
      bulat: true,
      besar: (v) => `${koma(v, 0)} pesan`,
      ringkas: (v) => koma(v, 0),
      selisih: (d) => `${koma(Math.abs(d), 0)} pesan`,
      selisihPendek: (d) => `${koma(Math.abs(d), 0)} pesan`,
      sumber: "/admin/pesan",
      lampu: "Pesan masuk",
      satuan: "pesan",
      angkaSkala: (v) => koma(v, 1),
    },
    {
      kunci: "signature",
      no: "8.4",
      judul: "Proyek Signature ke atas",
      singkat: "Proyek Signature",
      ketentuan: () => `≥${t.signatureMin} proyek setahun, paket urutan 2 ke atas`,
      pendek: `≥${t.signatureMin} proyek`,
      min: t.signatureMin,
      maks: null,
      bulat: true,
      besar: (v) => `${koma(v, 0)} proyek`,
      ringkas: (v) => koma(v, 0),
      selisih: (d) => `${koma(Math.abs(d), 0)} proyek`,
      selisihPendek: (d) => `${koma(Math.abs(d), 0)} proyek`,
      sumber: "/admin/paket",
      lampu: "Signature",
      satuan: "proyek",
      angkaSkala: (v) => koma(v, 1),
    },
    {
      kunci: "cadangan",
      no: "8.5",
      judul: "Cadangan kas",
      singkat: "Cadangan kas",
      ketentuan: () => `≥${t.cadanganBulan} bulan pengeluaran studio`,
      pendek: `≥${t.cadanganBulan} bulan`,
      min: t.cadanganBulan,
      maks: null,
      besar: (v) => `${koma(v)} bulan`,
      ringkas: (v) => `${koma(v)} bln`,
      selisih: (d) => `${koma(Math.abs(d))} bulan`,
      selisihPendek: (d) => `${koma(Math.abs(d))} bln`,
      sumber: "/admin/keuangan/kas",
      lampu: "Cadangan kas",
      satuan: "bulan",
      angkaSkala: (v) => koma(v, 1),
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
const terpenuhi = (k: Keadaan) => k === "memenuhi" || k === "lampaui";

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
  /** 0–100 dari bawah. */
  pos: (v: number) => number;
}

/** Satu skala cukup lebar untuk semua nilai yang digambar dan ketentuannya. */
function skalaDari(p: Pasal, nilai: (number | null)[]): Skala {
  const ada = nilai.filter((v): v is number => v !== null && Number.isFinite(v));
  const puncak = Math.max(...ada, (p.maks ?? p.min) * 1.25);
  const dasar = Math.min(0, ...ada);
  const l = langkah(puncak - dasar, !!p.bulat);
  const atas = Math.ceil(puncak / l) * l;
  const bawah = Math.floor(dasar / l) * l;
  const rentang = atas - bawah || 1;
  return { bawah, atas, langkah: l, pos: (v) => Math.min(100, Math.max(0, ((v - bawah) / rentang) * 100)) };
}

const HARI = 86_400_000;
const ms = (t: string) => Date.parse(`${t}T00:00:00Z`);
const awalKuartal = (tahun: number, kuartal: number) => Date.UTC(tahun, (kuartal - 1) * 3, 1);
const akhirKuartal = (tahun: number, kuartal: number) => Date.UTC(tahun, kuartal * 3, 0);
const TGL = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", timeZone: "UTC" });
const TGL_PANJANG = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const BLN = new Intl.DateTimeFormat("id-ID", { month: "short", timeZone: "UTC" });
const tglPendek = (t: string) => TGL.format(new Date(`${t}T00:00:00Z`));
const tglPanjang = (t: string) => TGL_PANJANG.format(new Date(`${t}T00:00:00Z`));
const blnPendek = (b: string) => BLN.format(new Date(`${b}-01T00:00:00Z`));
const kodePotret = (s: Potret) => (s.kini ? "Kini" : `${s.kode} ’${String(s.tahun).slice(2)}`);

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
    <span className={`pkk__cap is-${keadaan}${tercap ? " is-tercap" : ""}`}>
      <b>{TEKS_CAP[keadaan]}</b>
      <small>
        §{no} · {kode}
      </small>
    </span>
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
      <h4 className="pkk__sub">Sebaran kontrak {k.tahun}</h4>
      <div className="pkk__sebaran" aria-hidden="true">
        <i
          className="pkk__sebaranzona"
          style={{ left: `${skala.pos(t.rataKontrakMin)}%`, width: `${skala.pos(t.rataKontrakMaks) - skala.pos(t.rataKontrakMin)}%` }}
        />
        {urut.map((p) => (
          <i
            key={p.projectId}
            className="pkk__titik"
            style={{ left: `${skala.pos(p.kontrak)}%` }}
            {...ket(() => ({ judul: p.title, baris: [{ label: "Nilai kontrak", nilai: formatRupiah(p.kontrak) }] }))}
          />
        ))}
        {k.rataKontrak.nilai !== null && <b className="pkk__sebaranrata" style={{ left: `${skala.pos(k.rataKontrak.nilai)}%` }} />}
      </div>
      <div className="pkk__sebaranskala" aria-hidden="true">
        <span>{skala.bawah === 0 ? "0" : jt(skala.bawah)}</span>
        <span>{jt(skala.atas)}</span>
      </div>
      <ol className="pkk__daftar">
        {urut.map((p) => (
          <li key={p.projectId}>
            <span className="pkk__kode">{kodeProyek(p.title)}</span>
            <a href={`/admin/proyek/satu?id=${encodeURIComponent(p.projectId)}`}>{p.title}</a>
            <small>{p.tier ?? "Tanpa paket"}</small>
            <b className={p.kontrak < t.rataKontrakMin ? "is-belum" : undefined}>{formatRupiahRingkas(p.kontrak)}</b>
          </li>
        ))}
        {!urut.length && <li className="pkk__kosong">Belum ada proyek berkontrak tahun ini.</li>}
      </ol>
    </>
  );
}

function LampiranMargin({ k, ket }: { k: KpiStrategi; ket: ReturnType<typeof pemberiKet> }) {
  const min = k.target.marginMin;
  const urut = [...k.proyek].sort((a, b) => a.margin - b.margin);
  return (
    <>
      <h4 className="pkk__sub">
        Biaya terhadap kontrak <span>batas biaya {100 - min}%</span>
      </h4>
      <ol className="pkk__daftar pkk__daftar--batang">
        {urut.map((p) => {
          const biaya = Math.min(100, (p.biaya / p.kontrak) * 100);
          return (
            <li key={p.projectId}>
              <a href={`/admin/proyek/satu?id=${encodeURIComponent(p.projectId)}`}>{p.title}</a>
              <b className={p.margin < min ? "is-belum" : undefined}>{koma(p.margin)}%</b>
              <span
                className={p.biaya > p.kontrak ? "pkk__batangbiaya is-lebih" : "pkk__batangbiaya"}
                style={{ "--pkk-biaya": `${biaya}%`, "--pkk-garisbatas": `${100 - min}%` } as CSSProperties}
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
        {!urut.length && <li className="pkk__kosong">Belum ada proyek berkontrak tahun ini.</li>}
      </ol>
      {k.segmen.length > 0 && (
        <>
          <h4 className="pkk__sub">Laba kas per segmen</h4>
          <dl className="pkk__segmen">
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
      <h4 className="pkk__sub">Status pesan kuartal {k.kuartal}</h4>
      <ol className="pkk__daftar pkk__daftar--status">
        {STATUS_LEAD.map((s) => (
          <li key={s.kunci}>
            <span>{s.label}</span>
            <span className="pkk__batangpenuh" aria-hidden="true">
              <i
                className={s.kunci === "contacted" || s.kunci === "qualified" ? "is-lanjut" : undefined}
                style={{ width: `${(k.lead.status[s.kunci] / total) * 100}%` }}
              />
            </span>
            <b>{k.lead.status[s.kunci]}</b>
          </li>
        ))}
      </ol>
      <h4 className="pkk__sub">
        Per bulan <span>laju ketentuan {koma(perBulanMin)}–{koma(perBulanMaks)}</span>
      </h4>
      <div className="pkk__bulan" aria-label="Pesan masuk per bulan kuartal ini">
        <div className="pkk__bidangtiang" aria-hidden="true">
          <i
            className="pkk__bulanzona"
            style={{ bottom: `${(perBulanMin / puncak) * 100}%`, height: `${((perBulanMaks - perBulanMin) / puncak) * 100}%` }}
          />
        </div>
        {k.lead.perBulan.map((b) => (
          <div key={b.bulan} className="pkk__bulankolom">
            <span className="pkk__bulantiang" aria-hidden="true">
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
      <h4 className="pkk__sub">
        Tangga paket {k.tahun} <span>arsir = Signature ke atas</span>
      </h4>
      <div className="pkk__tangga">
        {kelompok
          .filter((g) => g.anak.length)
          .map((g) => (
            <div key={g.kunci} className="pkk__tanggakelompok">
              <p>{g.label}</p>
              <ol>
                {g.anak.map((t, i) => (
                  <li
                    key={t.nama}
                    className={t.urutan >= 2 ? "is-atas" : undefined}
                    style={{ "--pkk-anak": i + 1, "--pkk-anak-n": g.anak.length } as CSSProperties}
                  >
                    <span className="pkk__tanggajumlah">{t.jumlah}</span>
                    <span className="pkk__tanggaanak" aria-hidden="true" />
                    <small>{t.nama}</small>
                  </li>
                ))}
              </ol>
            </div>
          ))}
      </div>
      <ol className="pkk__daftar">
        {k.signature.proyek.map((p) => (
          <li key={p.projectId}>
            <span className="pkk__kode">{kodeProyek(p.title)}</span>
            <a href={`/admin/proyek/satu?id=${encodeURIComponent(p.projectId)}`}>{p.title}</a>
            <small>{p.tier}</small>
          </li>
        ))}
        {!k.signature.proyek.length && <li className="pkk__kosong">Belum ada proyek Signature ke atas tahun ini.</li>}
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
      <p className="pkk__rumus">
        {formatRupiah(c.saldo)} <em>÷</em> {c.keluarPerBulan === null ? "—" : `${formatRupiah(c.keluarPerBulan)}/bln`}
      </p>
      <p className="pkk__rumusket">Saldo catatan panel ÷ rata-rata keluar {c.bulanBerdata} bulan berdata</p>
      <div className="pkk__landasan" aria-label={`Cadangan ${c.bulan === null ? "belum ada data" : koma(c.bulan)} dari ${target} bulan`}>
        {Array.from({ length: n }, (_, i) => {
          const isi = c.bulan === null ? 0 : Math.min(1, Math.max(0, c.bulan - i));
          return (
            <span key={i} className={`pkk__landasanbulan${i < target ? " is-wajib" : ""}${i + 1 === target ? " is-batas" : ""}`}>
              <i style={{ width: `${isi * 100}%` }} />
              <small>{i + 1}</small>
            </span>
          );
        })}
      </div>
      <h4 className="pkk__sub">
        Keluar per bulan <span>putus = rata-rata</span>
      </h4>
      <div className="pkk__keluar">
        <div className="pkk__bidangtiang" aria-hidden="true">
          {c.keluarPerBulan !== null && <i className="pkk__rata" style={{ bottom: `${(c.keluarPerBulan / puncak) * 100}%` }} />}
        </div>
        {bulanan.map((b) => (
          <div
            key={b.bulan}
            className="pkk__keluarkolom"
            {...ket(() => ({ judul: blnPendek(b.bulan), baris: [{ label: "Uang keluar", nilai: formatRupiah(b.keluar) }] }))}
          >
            <span className="pkk__bulantiang" aria-hidden="true">
              <i style={{ height: `${(b.keluar / puncak) * 100}%` }} />
            </span>
            <small>{blnPendek(b.bulan)}</small>
          </div>
        ))}
      </div>
    </>
  );
}


/* ---- Meter panel -------------------------------------------------------------
   Meter panel DIN: busur skala 90° (meter skor 104°) di atas poros dekat
   tepi bawah muka. Geometri dalam satuan viewBox; sudut diukur dari tegak,
   searah jarum jam. Angka skala HTML di luar busur, jadi jarum (paling
   jauh r − 3) tidak pernah lewat di belakangnya (jebakan #70). */
interface Geo {
  w: number;
  h: number;
  cx: number;
  cy: number;
  r: number;
  sudut: number;
}
const GEO_PASAL: Geo = { w: 200, h: 150, cx: 100, cy: 138, r: 100, sudut: 45 };
const GEO_SKOR: Geo = { w: 200, h: 128, cx: 100, cy: 118, r: 88, sudut: 52 };

const rad = (d: number) => (d * Math.PI) / 180;
function titikBusur(g: Geo, a: number, r: number): [number, number] {
  return [g.cx + r * Math.sin(rad(a)), g.cy - r * Math.cos(rad(a))];
}
function busur(g: Geo, a1: number, a2: number, r: number): string {
  const [x1, y1] = titikBusur(g, a1, r);
  const [x2, y2] = titikBusur(g, a2, r);
  return `M${x1.toFixed(2)} ${y1.toFixed(2)}A${r} ${r} 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
}
const sudutPos = (g: Geo, pos: number) => -g.sudut + (2 * g.sudut * pos) / 100;
/** Jarum tanpa data diam di penahan kiri, sedikit di bawah awal skala. */
const sudutDiam = (g: Geo) => -g.sudut - 4;

interface Tanda {
  pos: number;
  besar: boolean;
  label?: string;
}
interface Zona {
  a: number;
  b: number;
  jenis: "kurang" | "ok" | "lebih";
}

/** Takik skala: besar di tiap langkah, kecil di antaranya. */
function tandaSkala(sk: Skala, bulat: boolean, label: (v: number) => string): Tanda[] {
  const e = Math.pow(10, Math.floor(Math.log10(sk.langkah)));
  const mant = Math.round((sk.langkah / e) * 10) / 10;
  const bagi = bulat && sk.langkah <= 2 ? 2 : mant === 2 ? 4 : 5;
  const kecil = sk.langkah / bagi;
  const n = Math.round((sk.atas - sk.bawah) / kecil);
  return Array.from({ length: n + 1 }, (_, i) => {
    const v = Math.round((sk.bawah + i * kecil) * 1e6) / 1e6;
    const besar = i % bagi === 0;
    return { pos: sk.pos(v), besar, label: besar ? label(v) : undefined };
  });
}

/** Jarum berpegas teredam: ditulis langsung ke atribut `transform` per
    bingkai, mulai dari posisi dan kecepatannya sekarang — memutar saklar
    lagi di tengah ayunan membelokkan jarum, bukan memulainya ulang. Tanpa
    pegas saat pertama tampil dan bila gerak dikurangi. */
function useJarum(sudut: number, hidup: boolean, g: Geo, tunda: number) {
  const ref = useRef<SVGGElement>(null);
  const st = useRef<{ a: number; v: number } | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const tulis = (a: number) => el.setAttribute("transform", `rotate(${a.toFixed(2)} ${g.cx} ${g.cy})`);
    const s = st.current;
    if (!s || !hidup || !geraknya()) {
      st.current = { a: sudut, v: 0 };
      tulis(sudut);
      return;
    }
    const henti = g.sudut + 7;
    const W = 13;
    const Z = 0.45;
    let raf = 0;
    let t0 = 0;
    const f = (t: number) => {
      const dt = t0 ? Math.min(0.034, (t - t0) / 1000) : 1 / 60;
      t0 = t;
      s.v += (-2 * Z * W * s.v - W * W * (s.a - sudut)) * dt;
      s.a += s.v * dt;
      if (s.a > henti) {
        s.a = henti;
        s.v *= -0.3;
      } else if (s.a < -henti) {
        s.a = -henti;
        s.v *= -0.3;
      }
      if (Math.abs(s.a - sudut) < 0.04 && Math.abs(s.v) < 0.8) {
        s.a = sudut;
        s.v = 0;
        tulis(sudut);
        return;
      }
      tulis(s.a);
      raf = requestAnimationFrame(f);
    };
    const w = window.setTimeout(() => (raf = requestAnimationFrame(f)), tunda);
    return () => {
      window.clearTimeout(w);
      cancelAnimationFrame(raf);
    };
  }, [sudut, hidup, g, tunda]);
  return ref;
}

function MukaMeter({
  g,
  tanda,
  zona,
  batas,
  ingat,
  jarum,
  hidup,
  tunda,
  satuan,
  kanan,
  kelas,
}: {
  g: Geo;
  tanda: Tanda[];
  zona: Zona[];
  /** Jarum batas (ketentuan), dalam posisi 0–100. */
  batas: number[];
  /** Jarum pengingat = potret sebelumnya. */
  ingat: number | null;
  jarum: number | null;
  hidup: boolean;
  tunda: number;
  satuan: string;
  kanan: string;
  kelas?: string;
}) {
  const idCermin = `pkk${useId().replace(/[^a-zA-Z0-9]/g, "")}cermin`;
  const ref = useJarum(jarum === null ? sudutDiam(g) : sudutPos(g, jarum), hidup, g, tunda);
  const r = g.r;
  const rGaris = r - 6.5;
  const rZona = r - 11;
  const rCermin = r - 19;
  let takik = "";
  for (const t of tanda) {
    const a = sudutPos(g, t.pos);
    const [x1, y1] = titikBusur(g, a, rGaris);
    const [x2, y2] = titikBusur(g, a, rGaris + (t.besar ? 7.5 : 4));
    takik += `M${x1.toFixed(2)} ${y1.toFixed(2)}L${x2.toFixed(2)} ${y2.toFixed(2)}`;
  }
  const ujung = rZona - 5;
  return (
    <span className={kelas ? `pkk__muka ${kelas}` : "pkk__muka"} style={{ aspectRatio: `${g.w} / ${g.h}` }} aria-hidden="true">
      <svg viewBox={`0 0 ${g.w} ${g.h}`} focusable="false">
        <defs>
          <linearGradient id={idCermin} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" className="pkk__cermin-a" />
            <stop offset="0.5" className="pkk__cermin-b" />
            <stop offset="1" className="pkk__cermin-a" />
          </linearGradient>
        </defs>
        <path className="pkk__cermin" d={busur(g, -g.sudut, g.sudut, rCermin)} stroke={`url(#${idCermin})`} />
        {zona
          .filter((z) => z.b - z.a > 0.05)
          .map((z) => (
            <path key={`${z.a.toFixed(2)}-${z.jenis}`} className={`pkk__zona is-${z.jenis}`} d={busur(g, sudutPos(g, z.a), sudutPos(g, z.b), rZona)} />
          ))}
        <path className="pkk__garisskala" d={busur(g, -g.sudut, g.sudut, rGaris)} />
        <path className="pkk__takik" d={takik} />
        {batas.map((b) => (
          <g key={b.toFixed(3)} className="pkk__batas" transform={`rotate(${sudutPos(g, b).toFixed(2)} ${g.cx} ${g.cy})`}>
            <path className="pkk__batasgaris" d={`M${g.cx} ${g.cy - (r - 44)}V${g.cy - ujung}`} />
            <path className="pkk__batasujung" d={`M${g.cx - 3.4} ${g.cy - ujung}L${g.cx} ${g.cy - rGaris}L${g.cx + 3.4} ${g.cy - ujung}Z`} />
          </g>
        ))}
        {ingat !== null && (
          <g className="pkk__ingat" style={{ transform: `rotate(${sudutPos(g, ingat).toFixed(2)}deg)`, transformOrigin: `${g.cx}px ${g.cy}px` }}>
            <path d={`M${g.cx} ${g.cy - 26}V${g.cy - (r - 12)}`} />
            <circle cx={g.cx} cy={g.cy - (r - 12)} r="2.2" />
          </g>
        )}
        <g ref={ref} className="pkk__jarum">
          <path d={`M${g.cx - 1.8} ${g.cy}L${g.cx - 0.45} ${g.cy - (r - 3)}L${g.cx + 0.45} ${g.cy - (r - 3)}L${g.cx + 1.8} ${g.cy}Z`} />
        </g>
        <path className="pkk__tutup" d={`M${g.cx - 21} ${g.h}V${g.cy}A21 21 0 0 1 ${g.cx + 21} ${g.cy}V${g.h}Z`} />
        <circle className="pkk__sekrupnol" cx={g.cx} cy={g.cy + 1} r="3.6" />
        <path className="pkk__sekrupalur" d={`M${g.cx - 2.3} ${g.cy + 1}H${g.cx + 2.3}`} />
      </svg>
      {tanda.map((t) => {
        if (t.label === undefined) return null;
        const [x, y] = titikBusur(g, sudutPos(g, t.pos), r + 12);
        return (
          <span key={t.pos.toFixed(3)} className="pkk__angkaskala" style={{ left: `${(x / g.w) * 100}%`, top: `${(y / g.h) * 100}%` }}>
            {t.label}
          </span>
        );
      })}
      <span className="pkk__satuan">{satuan}</span>
      <span className="pkk__mukakanan">{kanan}</span>
    </span>
  );
}

/* ---- Saklar pemilih potret -----------------------------------------------------
   Kenop bersayap di atas piring bertakik; posisinya K1 · K2 · K3 · Kini di
   busur −60°…+60°. Diseret relatif (bukan melompat ke titik yang ditekan),
   tiap takik yang dilewati langsung berlaku; klik kenop = satu takik maju.
   Kotak kenop dibaca sekali saat ditekan. Papan ketik lewat tombol posisi
   (radio): panah, Home, End. */
const SAKLAR = { w: 124, h: 104, cx: 62, cy: 64, r: 50 };

function Saklar({ potret, pilih, onPilih }: { potret: Potret[]; pilih: number; onPilih: (i: number) => void }) {
  const n = potret.length;
  const sudutKe = (i: number) => (n <= 1 ? 0 : -60 + (120 * i) / (n - 1));
  const [seret, setSeret] = useState<number | null>(null);
  const genggam = useRef<{ x: number; y: number; a0: number; k0: number; jauh: number } | null>(null);
  const radio = useRef<(HTMLButtonElement | null)[]>([]);
  const sudut = seret ?? sudutKe(pilih);

  const arah = (x: number, y: number, c: { x: number; y: number }) => (Math.atan2(x - c.x, c.y - y) * 180) / Math.PI;
  const terdekat = (a: number) => {
    let i0 = 0;
    for (let i = 1; i < n; i++) if (Math.abs(a - sudutKe(i)) < Math.abs(a - sudutKe(i0))) i0 = i;
    return i0;
  };
  const turun = (e: PointerEventReact<HTMLSpanElement>) => {
    if (e.button !== 0) return;
    const b = e.currentTarget.getBoundingClientRect();
    const c = { x: b.left + b.width / 2, y: b.top + b.height / 2 };
    genggam.current = { ...c, a0: arah(e.clientX, e.clientY, c), k0: sudutKe(pilih), jauh: 0 };
    e.currentTarget.setPointerCapture(e.pointerId);
    e.preventDefault();
  };
  const gerak = (e: PointerEventReact<HTMLSpanElement>) => {
    const g = genggam.current;
    if (!g) return;
    let d = arah(e.clientX, e.clientY, g) - g.a0;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    g.jauh = Math.max(g.jauh, Math.abs(d));
    if (g.jauh < 4) return;
    const a = Math.max(-70, Math.min(70, g.k0 + d));
    setSeret(a);
    const i = terdekat(a);
    if (Math.abs(a - sudutKe(i)) < 15 && i !== pilih) onPilih(i);
  };
  const lepas = () => {
    const g = genggam.current;
    genggam.current = null;
    if (!g) return;
    if (g.jauh < 4) onPilih((pilih + 1) % n);
    setSeret(null);
  };
  const tombol = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const ke =
      e.key === "ArrowRight" || e.key === "ArrowUp"
        ? Math.min(n - 1, i + 1)
        : e.key === "ArrowLeft" || e.key === "ArrowDown"
          ? Math.max(0, i - 1)
          : e.key === "Home"
            ? 0
            : e.key === "End"
              ? n - 1
              : null;
    if (ke === null) return;
    e.preventDefault();
    onPilih(ke);
    radio.current[ke]?.focus();
  };

  let takik = "";
  for (let i = 0; i < n; i++) {
    const a = rad(sudutKe(i));
    const x = (rr: number) => (SAKLAR.cx + rr * Math.sin(a)).toFixed(2);
    const y = (rr: number) => (SAKLAR.cy - rr * Math.cos(a)).toFixed(2);
    takik += `M${x(29)} ${y(29)}L${x(33)} ${y(33)}`;
  }
  return (
    <div className="pkk__saklar">
      <svg className="pkk__piring" viewBox={`0 0 ${SAKLAR.w} ${SAKLAR.h}`} aria-hidden="true" focusable="false">
        <circle className="pkk__piringbadan" cx={SAKLAR.cx} cy={SAKLAR.cy} r="35" />
        <path className="pkk__piringtakik" d={takik} />
      </svg>
      <div className="pkk__posisian" role="radiogroup" aria-label="Saklar potret kuartal">
        {potret.map((s, i) => {
          const a = rad(sudutKe(i));
          return (
            <button
              key={`${s.kode}-${s.tanggal}`}
              ref={(x) => {
                radio.current[i] = x;
              }}
              type="button"
              role="radio"
              aria-checked={i === pilih}
              tabIndex={i === pilih ? 0 : -1}
              aria-label={`${s.kini ? "Kini" : kodePotret(s)}, ${tglPanjang(s.tanggal)}`}
              className={i === pilih ? "pkk__posisi is-pilih" : "pkk__posisi"}
              style={{ left: `${SAKLAR.cx + SAKLAR.r * Math.sin(a)}px`, top: `${SAKLAR.cy - SAKLAR.r * Math.cos(a)}px` }}
              onClick={() => onPilih(i)}
              onKeyDown={(e) => tombol(e, i)}
            >
              {s.kini ? "Kini" : s.kode}
            </button>
          );
        })}
      </div>
      <span
        className={seret === null ? "pkk__kenop" : "pkk__kenop is-seret"}
        style={{ "--pkk-putar": `${sudut}deg` } as CSSProperties}
        onPointerDown={turun}
        onPointerMove={gerak}
        onPointerUp={lepas}
        onPointerCancel={lepas}
        aria-hidden="true"
      >
        <i className="pkk__sayap" />
      </span>
    </div>
  );
}

/* ---- Pencatat grafik --------------------------------------------------------------
   Rentang = dua belas bulan sampai akhir kuartal berjalan. Kertas berkisi
   di antara dua rol; label skala, peristiwa, dan bulan di talang kertas,
   bukan di bidangnya. Satu fungsi posisi (`xp`, `yp`) dipakai kisi, jejak,
   titik, dan pena. */
interface JejakKertas {
  xp: (t: number) => number;
  sk: Skala;
  yp: (v: number) => number;
  /** Titik sudut jejak pena (x %, y %), x naik. */
  sudut: [number, number][];
  jalur: string;
  kurang: string;
  minY: number;
  atasY: number;
  kiniX: number;
  potret: { j: number; s: Potret; x: number; y: number; v: number; arah: "kiri" | "kanan" | "tengah" }[];
  proyek: { id: string; x: number; y: number; v: number; judul: string; tgl: string; belum: boolean }[];
  bulan: { x: number; tengah: number; label: string; kuartal: boolean }[];
  garis: number[];
  rentang: string;
}

function jejakKertas(k: KpiStrategi, p: Pasal, potret: Potret[]): JejakKertas {
  const akhir = new Date(akhirKuartal(k.tahun, k.kuartal));
  const d0 = Date.UTC(akhir.getUTCFullYear(), akhir.getUTCMonth() - 11, 1);
  const d1 = akhir.getTime() + HARI;
  const xp = (t: number) => Math.min(100, Math.max(0, ((t - d0) / (d1 - d0)) * 100));
  const awalTahun = Date.UTC(k.tahun, 0, 1);
  const kiniX = xp(ms(k.hariIni));

  const proyekRentang = k.proyek.filter((pr) => ms(pr.dibuat) >= d0 && ms(pr.dibuat) < d1);
  const proyekMentah =
    p.kunci === "kontrak" || p.kunci === "margin"
      ? proyekRentang.map((pr) => ({ id: pr.projectId, x: xp(ms(pr.dibuat)), v: p.kunci === "kontrak" ? pr.kontrak : pr.margin, judul: pr.title, tgl: pr.dibuat }))
      : [];
  const sig =
    p.kunci === "signature"
      ? k.proyek.filter((pr) => pr.signature && ms(pr.dibuat) >= awalTahun).sort((a, b) => ms(a.dibuat) - ms(b.dibuat))
      : [];

  const sk = skalaDari(p, [...potret.map((s) => s.nilai[p.kunci]), ...proyekMentah.map((t) => t.v), sig.length]);
  const yp = (v: number) => 100 - sk.pos(v);
  const nol = yp(Math.max(sk.bawah, 0));
  const minY = yp(p.min);
  const atasY = p.maks === null ? 0 : yp(p.maks);

  const ada = potret
    .map((s, j) => ({ j, s, x: xp(ms(s.tanggal)), v: s.nilai[p.kunci] }))
    .filter((t): t is { j: number; s: Potret; x: number; v: number } => t.v !== null);

  const sudut: [number, number][] = [];
  let kurang = "";
  const u = (x: number, y: number) => `${(x * 10).toFixed(1)} ${(y * 3).toFixed(1)}`;
  if (p.kunci === "lead") {
    /* Kolom per kuartal: pena naik di awal kuartal, menyusur, turun di
       akhirnya. Kuartal berjalan masih terbuka — penanya masih menulis. */
    for (const t of ada) {
      const a = xp(awalKuartal(t.s.tahun, t.s.kuartal));
      const b = t.s.kini ? kiniX : xp(akhirKuartal(t.s.tahun, t.s.kuartal) + HARI);
      const y = yp(t.v);
      sudut.push([a, nol], [a, y], [b, y]);
      if (!t.s.kini) sudut.push([b, nol]);
      if (t.v < p.min) kurang += `M${u(a, y)}H${(b * 10).toFixed(1)}V${(minY * 3).toFixed(1)}H${(a * 10).toFixed(1)}Z`;
    }
  } else if (p.kunci === "signature") {
    /* Tangga: jumlah kumulatif proyek paket ≥2 sejak 1 Januari. */
    const x0 = xp(Math.max(d0, awalTahun));
    sudut.push([x0, yp(0)]);
    sig.forEach((pr, i) => {
      const xb = xp(ms(pr.dibuat));
      sudut.push([xb, yp(i)], [xb, yp(i + 1)]);
    });
    sudut.push([kiniX, yp(sig.length)]);
    if (sig.length < p.min) kurang = `M${sudut.map(([x, y]) => u(x, y)).join("L")}V${(minY * 3).toFixed(1)}H${(x0 * 10).toFixed(1)}Z`;
  } else {
    for (const t of ada) sudut.push([t.x, yp(t.v)]);
    if (sudut.length > 1 && ada.some((t) => t.v < p.min)) {
      const ak = sudut[sudut.length - 1]!;
      kurang = `M${sudut.map(([x, y]) => u(x, y)).join("L")}L${u(ak[0], minY)}L${u(sudut[0]![0], minY)}Z`;
    }
  }
  const jalur = sudut.length ? `M${sudut.map(([x, y]) => u(x, y)).join("L")}` : "";

  /* Penanda peristiwa: label di samping takiknya kalau berdekatan. */
  const titikPotret = ada.map((t) => ({ ...t, y: yp(t.v), arah: "tengah" as "kiri" | "kanan" | "tengah" }));
  titikPotret.forEach((t, i) => {
    const lanjut = titikPotret[i + 1];
    if (lanjut && lanjut.x - t.x < 7) {
      t.arah = "kiri";
      lanjut.arah = "kanan";
    }
    if (t.x > 95) t.arah = "kiri";
    if (t.x < 5) t.arah = "kanan";
  });

  const garis: number[] = [];
  for (let v = sk.bawah; v <= sk.atas + sk.langkah / 1000; v += sk.langkah) garis.push(Math.round(v * 1000) / 1000);
  const bulan = Array.from({ length: 12 }, (_, i) => {
    const a = Date.UTC(akhir.getUTCFullYear(), akhir.getUTCMonth() - 11 + i, 1);
    const b = Date.UTC(akhir.getUTCFullYear(), akhir.getUTCMonth() - 10 + i, 1);
    const d = new Date(a);
    return { x: xp(a), tengah: (xp(a) + xp(b)) / 2, label: BLN.format(d), kuartal: d.getUTCMonth() % 3 === 0 };
  });
  const awal = new Date(d0);
  const rentang = `${BLN.format(awal)} ${awal.getUTCFullYear()} – ${BLN.format(akhir)} ${akhir.getUTCFullYear()}`;

  return {
    xp,
    sk,
    yp,
    sudut,
    jalur,
    kurang,
    minY,
    atasY,
    kiniX,
    potret: titikPotret,
    proyek: proyekMentah.map((t) => ({ ...t, y: yp(t.v), belum: t.v < p.min })),
    bulan,
    garis,
    rentang,
  };
}

/** Tinggi jejak di x (%), menyusuri titik sudutnya — dipakai pena. */
function yDi(s: [number, number][], x: number): number {
  if (!s.length) return 100;
  if (x <= s[0]![0]) return s[0]![1];
  for (let i = 1; i < s.length; i++) {
    const [x0, y0] = s[i - 1]!;
    const [x1, y1] = s[i]!;
    if (x < x1) return x1 === x0 ? y1 : y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
  }
  return s[s.length - 1]![1];
}

function Pencatat({
  k,
  p,
  potret,
  pilih,
  onPilih,
  ket,
  tarik,
  hidup,
}: {
  k: KpiStrategi;
  p: Pasal;
  potret: Potret[];
  pilih: number;
  onPilih: (i: number) => void;
  ket: ReturnType<typeof pemberiKet>;
  tarik: number;
  hidup: boolean;
}) {
  const jk = useMemo(() => jejakKertas(k, p, potret), [k, p, potret]);
  const idKlip = `pkk${useId().replace(/[^a-zA-Z0-9]/g, "")}klip`;
  const kereta = useRef<HTMLSpanElement>(null);
  const pemegang = useRef<HTMLSpanElement>(null);
  const jejakRef = useRef<SVGSVGElement>(null);
  const plot = useRef<HTMLDivElement>(null);
  const sudahTarik = useRef(tarik);

  /* Pena: diam di "hari ini" di atas jejaknya; saat pasal berganti karena
     perbuatan, ia menulis ulang jejak dari titik pertamanya — jejak dibuka
     sejauh pena, titik proyek dan potret tercetak saat pena melewatinya. */
  useLayoutEffect(() => {
    const kr = kereta.current;
    const pg = pemegang.current;
    const svg = jejakRef.current;
    const pl = plot.current;
    if (!kr || !pg || !svg || !pl) return;
    const taruh = (x: number) => {
      const y = yDi(jk.sudut, x);
      kr.style.left = `${x}%`;
      pg.style.top = `${y}%`;
      pg.dataset.bawah = y < 30 ? "1" : "";
    };
    const titik = [...pl.querySelectorAll<HTMLElement>("[data-x]")];
    const pulih = () => {
      svg.style.clipPath = "";
      titik.forEach((t) => (t.style.opacity = ""));
      kr.classList.remove("is-menulis");
      taruh(jk.kiniX);
    };
    const mulai = tarik !== sudahTarik.current && hidup && geraknya() && jk.sudut.length > 0;
    sudahTarik.current = tarik;
    if (!mulai) {
      pulih();
      return;
    }
    const x0 = jk.sudut[0]![0];
    const x1 = jk.kiniX;
    const lama = Math.min(1500, 420 + 11 * Math.max(0, x1 - x0));
    let raf = 0;
    let t0 = 0;
    kr.classList.add("is-menulis");
    const f = (t: number) => {
      if (!t0) t0 = t;
      const q = Math.min(1, (t - t0) / lama);
      const e = q < 0.5 ? 2 * q * q : 1 - Math.pow(-2 * q + 2, 2) / 2;
      const x = x0 + (x1 - x0) * e;
      taruh(x);
      svg.style.clipPath = `inset(-4% ${Math.max(0, 100 - x)}% -4% -4%)`;
      titik.forEach((tt) => (tt.style.opacity = Number(tt.dataset.x) <= x + 0.2 ? "" : "0"));
      if (q < 1) raf = requestAnimationFrame(f);
      else pulih();
    };
    taruh(x0);
    svg.style.clipPath = `inset(-4% ${100 - x0}% -4% -4%)`;
    titik.forEach((tt) => (tt.style.opacity = Number(tt.dataset.x) <= x0 + 0.2 ? "" : "0"));
    raf = requestAnimationFrame(f);
    return () => {
      cancelAnimationFrame(raf);
      pulih();
    };
  }, [jk, tarik, hidup]);

  const s = potret[pilih]!;
  const xPilih = jk.xp(ms(s.tanggal));
  const adaKurang = !!jk.kurang;
  return (
    <section className="pkk__pencatat pkk__benda" aria-label={`Pencatat grafik ${p.judul}`}>
      <header className="pkk__pencatatkepala">
        <div>
          <p className="pkk__alis">Pencatat grafik · §{p.no}</p>
          <h3>{p.judul}</h3>
          <small>
            Skala {p.satuan} · {jk.rentang}
          </small>
        </div>
        <ul className="pkk__legenda" aria-hidden="true">
          <li>
            <i className="pkk__lg-pena" /> pena realisasi
          </li>
          {jk.proyek.length > 0 && (
            <li>
              <i className="pkk__lg-titik" /> per proyek
            </li>
          )}
          <li>
            <i className="pkk__lg-batas" /> ketentuan
          </li>
          {adaKurang && (
            <li>
              <i className="pkk__lg-kurang" /> kekurangan
            </li>
          )}
        </ul>
      </header>
      <div className="pkk__mesin">
        <span className="pkk__rol" aria-hidden="true" />
        <div className="pkk__kertasgrafik">
          <div className="pkk__acara">
            {jk.potret.map((t) => (
              <button
                key={`${t.s.kode}-${t.s.tanggal}`}
                type="button"
                tabIndex={-1}
                className={`pkk__peristiwa is-${t.arah}${t.j === pilih ? " is-pilih" : ""}`}
                style={{ left: `${t.x}%` }}
                aria-label={`${kodePotret(t.s)}, ${tglPanjang(t.s.tanggal)}: ${p.besar(t.v)}`}
                onClick={() => onPilih(t.j)}
                {...ket(() => ({
                  judul: `${kodePotret(t.s)} · ${tglPanjang(t.s.tanggal)}`,
                  baris: [
                    { label: p.judul, nilai: p.besar(t.v) },
                    { label: "Keadaan", nilai: TEKS_CAP[keadaanDari(p, t.v)] },
                  ],
                }))}
              >
                <span>{t.s.kini ? "Kini" : t.s.kode}</span>
              </button>
            ))}
          </div>
          <div className="pkk__sumbuy" aria-hidden="true">
            {jk.garis.map((v) => (
              <span key={v} style={{ top: `${jk.yp(v)}%` }}>
                {p.angkaSkala(v)}
              </span>
            ))}
          </div>
          <div className="pkk__plot" ref={plot}>
            {jk.garis.map((v, i) => (
              <Fragment key={v}>
                <i className="pkk__kisi" style={{ top: `${jk.yp(v)}%` }} />
                {i > 0 && <i className="pkk__kisi is-kecil" style={{ top: `${jk.yp(v - jk.sk.langkah / 2)}%` }} />}
              </Fragment>
            ))}
            {jk.bulan.map((b, i) => (i > 0 ? <i key={b.x} className={b.kuartal ? "pkk__kisibulan is-kuartal" : "pkk__kisibulan"} style={{ left: `${b.x}%` }} /> : null))}
            <i className="pkk__pitaketentuan" style={{ top: `${jk.atasY}%`, height: `${Math.max(0, jk.minY - jk.atasY)}%` }} />
            <i className="pkk__garisketentuan" style={{ top: `${jk.minY}%` }} />
            {p.maks !== null && <i className="pkk__garisketentuan is-atas" style={{ top: `${jk.atasY}%` }} />}
            <svg ref={jejakRef} className="pkk__jejak" viewBox="0 0 1000 300" preserveAspectRatio="none" aria-hidden="true" focusable="false">
              <defs>
                <clipPath id={idKlip}>
                  <rect x="0" y={jk.minY * 3} width="1000" height={Math.max(0, 300 - jk.minY * 3) + 1} />
                </clipPath>
              </defs>
              {jk.kurang && <path className="pkk__kurangbidang" d={jk.kurang} clipPath={`url(#${idKlip})`} />}
              {jk.jalur && <path className="pkk__tinta" d={jk.jalur} />}
            </svg>
            {jk.proyek.map((t) => (
              <i
                key={t.id}
                data-x={t.x}
                className={t.belum ? "pkk__cetak is-belum" : "pkk__cetak"}
                style={{ left: `${t.x}%`, top: `${t.y}%` }}
                {...ket(() => ({
                  judul: t.judul,
                  baris: [
                    { label: p.kunci === "kontrak" ? "Nilai kontrak" : "Margin kontrak", nilai: p.kunci === "kontrak" ? formatRupiah(t.v) : `${koma(t.v)}%` },
                    { label: "Dibuat", nilai: tglPendek(t.tgl) },
                  ],
                }))}
              />
            ))}
            <i className="pkk__kursor" style={{ left: `${xPilih}%` }} />
            {jk.potret.map((t) => (
              <i
                key={`${t.s.kode}-${t.s.tanggal}`}
                data-x={t.x}
                className={`pkk__noktah is-${keadaanDari(p, t.v)}${t.j === pilih ? " is-pilih" : ""}`}
                style={{ left: `${t.x}%`, top: `${t.y}%` }}
              />
            ))}
            <span ref={kereta} className="pkk__kereta" aria-hidden="true">
              <span ref={pemegang} className="pkk__pemegang" />
            </span>
          </div>
          <div className="pkk__setel" aria-hidden="true">
            <i style={{ top: `${jk.minY}%` }} />
            {p.maks !== null && <i style={{ top: `${jk.atasY}%` }} />}
          </div>
          <div className="pkk__sumbux" aria-hidden="true">
            {jk.bulan.map((b) => (
              <span key={b.x} className={b.kuartal ? "is-kuartal" : undefined} style={{ left: `${b.tengah}%` }}>
                {b.label}
              </span>
            ))}
          </div>
        </div>
        <span className="pkk__rol is-kanan" aria-hidden="true" />
      </div>
    </section>
  );
}

/* ---- Meter per pasal (tab) -------------------------------------------------------- */
function MeterPasal({
  p,
  sk,
  v,
  lalu,
  kd,
  dipilih,
  hidup,
  urutan,
  kodeLembar,
  idPanel,
  tabRef,
  onPilih,
  onKey,
}: {
  p: Pasal;
  sk: Skala;
  v: number | null;
  lalu: number | null;
  kd: Keadaan;
  dipilih: boolean;
  hidup: boolean;
  urutan: number;
  kodeLembar: string;
  idPanel: string;
  tabRef: (x: HTMLButtonElement | null) => void;
  onPilih: () => void;
  onKey: (e: KeyboardEvent<HTMLButtonElement>) => void;
}) {
  const tanda = useMemo(() => tandaSkala(sk, !!p.bulat, p.angkaSkala), [sk, p]);
  const minP = sk.pos(p.min);
  const maksP = p.maks === null ? 100 : sk.pos(p.maks);
  const zona: Zona[] = [
    { a: 0, b: minP, jenis: "kurang" },
    { a: minP, b: maksP, jenis: "ok" },
    { a: maksP, b: 100, jenis: "lebih" },
  ];
  return (
    <button
      ref={tabRef}
      type="button"
      role="tab"
      id={`pkk-tab-${p.kunci}`}
      aria-selected={dipilih}
      aria-controls={idPanel}
      tabIndex={dipilih ? 0 : -1}
      className={`pkk__meter is-${kd}${dipilih ? " is-pilih" : ""}`}
      onClick={onPilih}
      onKeyDown={onKey}
    >
      <MukaMeter
        g={GEO_PASAL}
        tanda={tanda}
        zona={zona}
        batas={p.maks === null ? [minP] : [minP, maksP]}
        ingat={lalu === null ? null : sk.pos(lalu)}
        jarum={v === null ? null : sk.pos(v)}
        hidup={hidup}
        tunda={urutan * 60}
        satuan={p.satuan}
        kanan={`§${p.no}`}
      />
      <span className="pkk__pelat">
        <span className="pkk__pelatkepala">
          <b>{p.no}</b>
          <span className="pkk__pelatjudul">{p.singkat}</span>
          <small>{kodeLembar}</small>
        </span>
        <span className="pkk__bacaan">
          <i className={`pkk__pilot is-${kd}`} aria-hidden="true" />
          {v === null ? <b className="pkk__bacaangka">—</b> : <Hitung nilai={v} hidup={hidup} format={p.besar} className="pkk__bacaangka" />}
        </span>
        <span className="pkk__pelatket">ketentuan {p.pendek}</span>
      </span>
      <span className="sr-only">, {TEKS_CAP[kd]}</span>
    </button>
  );
}

const tglVfd = (t: string) => `${t.slice(8, 10)}.${t.slice(5, 7)}.${t.slice(2, 4)}`;

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
      <div className="pkk">
        <div className="pkk__papan pkk__papan--galat">
          <p>KPI tidak bisa dimuat: {galat}</p>
        </div>
      </div>
    ) : (
      <Rangka />
    );
  }
  return <Panel k={k} studio={studio} />;
}

function Rangka() {
  return (
    <div className="pkk pkk--rangka" aria-busy="true">
      <div className="pkk__papan">
        <div className="pkk__atas">
          <div className="pkk__papannama" />
          <div className="pkk__annun">
            {Array.from({ length: 5 }, (_, i) => (
              <span key={i} className="pkk__jendela is-kosong" />
            ))}
          </div>
        </div>
        <div className="pkk__meteran">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="pkk__meter" />
          ))}
        </div>
        <div className="pkk__bawah">
          <div className="pkk__pencatat pkk__benda" />
          <div className="pkk__induk pkk__benda" />
          <div className="pkk__kertas pkk__rincian" />
        </div>
      </div>
    </div>
  );
}

function Panel({ k, studio }: { k: KpiStrategi; studio: StudioSettings | null }) {
  const pasal = useMemo(() => pasalDari(k), [k]);
  const potret = useMemo(() => potretDari(k), [k]);
  const skala = useMemo(
    () => Object.fromEntries(pasal.map((p) => [p.kunci, skalaDari(p, potret.map((x) => x.nilai[p.kunci]))])) as Record<Kunci, Skala>,
    [pasal, potret],
  );
  const n = potret.length;
  const kini = n - 1;
  const [pilihPotret, setPilihPotret] = useState(kini);
  /* Bawaan: pasal pertama yang BELUM memenuhi — panel membuka yang perlu
     diperhatikan. */
  const [pilihPasal, setPilihPasal] = useState<Kunci>(
    () => pasal.find((p) => keadaanDari(p, potret[kini]!.nilai[p.kunci]) === "belum")?.kunci ?? "kontrak",
  );
  /* Gerak hanya sesudah perbuatan (jebakan #74). */
  const [hidup, setHidup] = useState(false);
  const [kedip, setKedip] = useState<{ kunci: Set<Kunci>; n: number }>({ kunci: new Set(), n: 0 });
  const [tarik, setTarik] = useState(0);
  const waktu = useRef<number[]>([]);
  const kabar: KabarKartu = useRef(null);
  const ket = pemberiKet(kabar);
  const idPanel = useId();
  const tabRef = useRef<Partial<Record<Kunci, HTMLButtonElement | null>>>({});

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
    if (i === pilihPotret || i < 0 || i >= n) return;
    const berubah = new Set(
      pasal.filter((p) => keadaanDari(p, potret[i]!.nilai[p.kunci]) !== keadaanDari(p, potret[pilihPotret]!.nilai[p.kunci])).map((p) => p.kunci),
    );
    setPilihPotret(i);
    if (geraknya() && berubah.size) {
      setKedip((c) => ({ kunci: berubah, n: c.n + 1 }));
      tunda(() => setKedip((c) => ({ ...c, kunci: new Set() })), 900);
    }
  };
  const pilihP = (kunci: Kunci) => {
    if (kunci === pilihPasal) return;
    setPilihPasal(kunci);
    if (geraknya()) setTarik((x) => x + 1);
  };
  const tombolMeter = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const m = pasal.length;
    const ke =
      e.key === "ArrowRight" || e.key === "ArrowDown"
        ? (i + 1) % m
        : e.key === "ArrowLeft" || e.key === "ArrowUp"
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
  const memenuhi = pasal.filter((p) => terpenuhi(keadaan[p.kunci])).length;
  const memenuhiLalu = sebelum ? pasal.filter((p) => terpenuhi(keadaanDari(p, sebelum.nilai[p.kunci]))).length : null;
  const daftar = daftarLembar().halaman;
  const aktif = pasal.find((p) => p.kunci === pilihPasal)!;
  const sumber = lembarUntuk(aktif.sumber, daftar)?.lembar ?? null;
  const kodeSnap = snap.kini ? `K${snap.kuartal}` : snap.kode;

  const awalK = awalKuartal(k.tahun, k.kuartal);
  const akhirK = akhirKuartal(k.tahun, k.kuartal);
  const hariKe = Math.round((ms(k.hariIni) - awalK) / HARI) + 1;
  const hariTotal = Math.round((akhirK - awalK) / HARI) + 1;

  /* Meter skor: 0–5 pasal, pitanya lima ruas — mint sebanyak pasal yang
     terpenuhi, amber sisanya. Jarum batasnya di 5: ketentuannya semua. */
  const m = pasal.length;
  const tandaSkor = useMemo<Tanda[]>(
    () => Array.from({ length: m * 2 + 1 }, (_, i) => ({ pos: (i / (m * 2)) * 100, besar: i % 2 === 0, label: i % 2 === 0 ? String(i / 2) : undefined })),
    [m],
  );
  const zonaSkor: Zona[] = Array.from({ length: m }, (_, i) => ({
    a: (i / m) * 100 + 0.9,
    b: ((i + 1) / m) * 100 - 0.9,
    jenis: i < memenuhi ? "ok" : "kurang",
  }));

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
  const catatan = catatanPemeriksa(aktif, snap.nilai[aktif.kunci], k, snap.kini);
  const bedaSkor =
    memenuhiLalu === null
      ? "potret pertama"
      : memenuhi === memenuhiLalu
        ? `sama dengan ${sebelum!.kode}`
        : `${memenuhi > memenuhiLalu ? "▲" : "▼"} ${Math.abs(memenuhi - memenuhiLalu)} dari ${sebelum!.kode}`;

  return (
    <div className={hidup ? "pkk is-hidup" : "pkk"}>
      <div className="pkk__papan">
        {/* ---- Pelat nama + annunsiator ---- */}
        <div className="pkk__atas">
          <header className="pkk__papannama">
            <p className="pkk__alis">{studio?.studioName ?? "Studio"}</p>
            <h2 id="pkk-judul">Panel kendali kinerja</h2>
            <p className="pkk__papannamaket">
              Pasal 8 · K{k.kuartal} {k.tahun} · hari ke-{hariKe} dari {hariTotal}
            </p>
          </header>
          <div className="pkk__annun" role="group" aria-label="Lampu annunsiator per pasal">
            {pasal.map((p) => {
              const kd = keadaan[p.kunci];
              const kedipKah = kedip.kunci.has(p.kunci);
              return (
                <button
                  key={`${p.kunci}-${kedipKah ? kedip.n : 0}`}
                  type="button"
                  tabIndex={-1}
                  className={`pkk__jendela is-${kd}${p.kunci === pilihPasal ? " is-pilih" : ""}${kedipKah ? " is-kedip" : ""}`}
                  aria-label={`§${p.no} ${p.judul}: ${TEKS_CAP[kd]}`}
                  onClick={() => pilihP(p.kunci)}
                >
                  <span className="pkk__jendelano">§{p.no}</span>
                  <span className="pkk__jendelanama">{p.lampu}</span>
                  <b>{TEKS_CAP[kd]}</b>
                </button>
              );
            })}
          </div>
        </div>

        {/* ---- Lima meter panel ---- */}
        <div className="pkk__meteran" role="tablist" aria-label="Pasal KPI">
          {pasal.map((p, i) => (
            <MeterPasal
              key={p.kunci}
              p={p}
              sk={skala[p.kunci]}
              v={snap.nilai[p.kunci]}
              lalu={sebelum?.nilai[p.kunci] ?? null}
              kd={keadaan[p.kunci]}
              dipilih={p.kunci === pilihPasal}
              hidup={hidup}
              urutan={i}
              kodeLembar={lembarUntuk(p.sumber, daftar)?.lembar.kode ?? ""}
              idPanel={idPanel}
              tabRef={(x) => {
                tabRef.current[p.kunci] = x;
              }}
              onPilih={() => pilihP(p.kunci)}
              onKey={(e) => tombolMeter(e, i)}
            />
          ))}
        </div>

        {/* ---- Pencatat · modul induk · kertas rincian ---- */}
        <div className="pkk__bawah">
          <Pencatat k={k} p={aktif} potret={potret} pilih={pilihPotret} onPilih={pilihSnap} ket={ket} tarik={tarik} hidup={hidup} />

          <section className="pkk__induk pkk__benda" aria-label="Skor ketentuan dan saklar potret">
            <header className="pkk__indukkepala">
              <span>Skor ketentuan</span>
              <small>§8.1–8.{m}</small>
            </header>
            <MukaMeter
              g={GEO_SKOR}
              tanda={tandaSkor}
              zona={zonaSkor}
              batas={[100]}
              ingat={memenuhiLalu === null ? null : (memenuhiLalu / m) * 100}
              jarum={(memenuhi / m) * 100}
              hidup={hidup}
              tunda={120}
              satuan="pasal"
              kanan="§8"
              kelas="pkk__muka--skor"
            />
            <div className="pkk__kendali">
              <Saklar potret={potret} pilih={pilihPotret} onPilih={pilihSnap} />
              <div className="pkk__layar" role="status" aria-live="polite">
                <span className="pkk__layarlabel">Potret · {snap.kini ? "kini" : snap.kode}</span>
                <Angka7 teks={tglVfd(snap.tanggal)} sel={6} kelas="pkk__7" />
                <span className="sr-only">
                  {tglPanjang(snap.tanggal)}: {memenuhi} dari {m} pasal terpenuhi
                </span>
                <b className="pkk__layarskor" aria-hidden="true">
                  {memenuhi} dari {m} pasal
                </b>
                <small
                  className={`pkk__layarbeda${memenuhiLalu === null ? "" : memenuhi > memenuhiLalu ? " is-naik" : memenuhi < memenuhiLalu ? " is-turun" : ""}`}
                  aria-hidden="true"
                >
                  {bedaSkor}
                </small>
              </div>
            </div>
          </section>

          <section className="pkk__kertas pkk__rincian" id={idPanel} role="tabpanel" aria-labelledby={`pkk-tab-${aktif.kunci}`}>
            <header className="pkk__rinciankop">
              <div>
                <p>Rincian §{aktif.no}</p>
                <h3>{aktif.judul}</h3>
                <small>{aktif.ketentuan(k)}</small>
              </div>
              <Cap
                key={`${aktif.kunci}-${kedip.kunci.has(aktif.kunci) ? kedip.n : 0}`}
                keadaan={keadaan[aktif.kunci]}
                no={aktif.no}
                kode={kodeSnap}
                tercap={kedip.kunci.has(aktif.kunci)}
              />
            </header>
            <div className={catatan.kurang ? "pkk__pemeriksa is-kurang" : "pkk__pemeriksa"}>
              <p>
                Catatan pemeriksa · {kodeSnap} {snap.tahun}
              </p>
              <span>{catatan.teks}</span>
            </div>
            <div key={aktif.kunci} className={tarik && hidup ? "pkk__rincianisi is-baru" : "pkk__rincianisi"}>
              {lampiran}
            </div>
            <footer className="pkk__rinciankaki">
              {sumber && (
                <a className="pkk__sumber" href={sumber.href}>
                  Lembar sumber · <b>{sumber.kode}</b> {sumber.label} →
                </a>
              )}
              {/* Lampiran selalu data hari ini; potret lama cuma menggeser
                  jarum, cap, dan catatan pemeriksa. */}
              {!snap.kini && <small>Lampiran per {tglPendek(k.hariIni)} · potret {snap.kode} di meter</small>}
            </footer>
          </section>
        </div>
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
