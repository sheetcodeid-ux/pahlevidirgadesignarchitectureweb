import { navigate } from "astro:transitions/client";
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
} from "react";
import { RequireAuth } from "./RequireAuth";
import { ToastProvider, useToast } from "../kit/Toast";
import { DropdownMenu } from "../kit/Overlay";
import { PilihMenu } from "../kit/Formulir";
import { Ikon } from "../kit/Ikon";
import {
  ArsBingkaiFoto,
  ArsKunciRumah,
  ArsTermin,
  CaretDown,
  Check,
  CoinIn,
  CoinOut,
  DotsThree,
  FilePdf,
  Globe,
  NotePencil,
  Plus,
} from "../kit/ikon";
import { Keterangan, pemberiKet, type BarisKartu, type InfoKartu } from "../kit/kartuGrafik";
import { GagalMuat } from "./gagalMuat";
import { usePilihProyek } from "./pilihProyekKit";
import { geraknya, Hitung } from "./hitung";
import { TAHAP, PilihTeks } from "./ProyekKit";
import { DialogBayar, DialogLingkup, DialogTugaskan, type PilihanBayar, type UbahTugaskan } from "./timProyekKit";
import { unduhRincianBiaya, unduhDaftarTagihan } from "../../lib/pdfProyek";
import { kodeProyek, inisial } from "../../lib/nomorDokumen";
import { CATEGORY_LABELS } from "../../lib/api";
import {
  daftarProyek,
  daftarTugasProyek,
  tambahTugas,
  ubahTugas,
  daftarInvoice,
  daftarTimProyek,
  daftarPembayaran,
  daftarBiaya,
  daftarPaket,
  ambilSettings,
  simpanProyek,
  bacaCache,
  tulisCache,
  LABEL_PERAN,
  URUTAN_PERAN,
  type Proyek,
  type Tugas,
  type Invoice,
  type PenugasanTim,
  type TahapBayaran,
  type Pembayaran,
  type BiayaProyek,
  type Paket,
  type StudioSettings,
} from "../../lib/admin";
import { formatRupiah, formatRupiahRingkas } from "../../lib/format";

/* =============================================================================
   Satu Proyek — JADWAL PELAKSANAAN PEKERJAAN.

   Di kantor konsultan perencana, satu proyek dikendalikan lewat satu lembar
   TIME SCHEDULE: uraian pekerjaan di kiri, kolom waktu per bulan, batang
   rencana dan realisasi, garis hari ini — ditambah jadwal penugasan personil
   (manning schedule) dan jadwal termin. Halaman ini lembar itu, di papan hijau
   berjahit, untuk proyek yang dibuka:

   A  TAHAP PEKERJAAN — tujuh tahap pipeline. Batang = rentang tugas tahap itu
      (dibuat → tenggat terakhir); kalau tahapnya tanpa tugas, rentangnya
      diturunkan dari tenggat preview/final dan termin, atau jadi TONGGAK
      (DP masuk, tenggat final, termin terakhir). Isi gelap = bagian tugas
      yang sudah selesai. Diklik = lembar tugasnya di kop.
   B  PERSONIL — satu baris per penugasan per peran: rentang tugas orang itu,
      lalu tanda bayaran tahap awal dan akhir (dibayar / jatuh tempo /
      menunggu) di tanggalnya. Nama = ubah penugasan, tanda = bayar.
   C  KEUANGAN — paku TERMIN (tagihan) di tenggatnya, kurva UANG MASUK
      kumulatif terhadap nilai kontrak, dan titik BIAYA KELUAR.

   Di tepi kanan lembar KOP GAMBAR: perencana, pemilik, uang, lingkup, tenggat,
   lembar tugas tahap yang dipilih (centang = selesai, tulis = tugas baru),
   dan jalan pintas ke halaman milik proyek ini.

   Tidak ada tulisan di kolom waktu — semua angka ada di kolom kiri/kanan atau
   muncul saat disentuh (kartu keterangan), jadi garis hari ini, garis
   tenggat, dan kisi bulan tidak pernah lewat di belakang tulisan (#70).

   Gerak — hanya karena perbuatan, seketika bila gerak dikurangi: ganti proyek
   atau ganti tahap = PENA menarik realisasi seluruh batang dari kiri sampai
   tempatnya dan pita hari ini turun, serentak (bukan bergiliran); centang =
   isi batangnya memanjang; bayaran dicatat = tanda dicap; tahap dipilih =
   lembar tugas berganti. Disentuh tetikus: GARIS BIDIK mengikuti kursor di
   kolom waktu, dengan tanggalnya di kepala dan uang masuk s.d. tanggal itu.
   ============================================================================= */

const HARI = 86_400_000;
const BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const LEMBUT = "cubic-bezier(0.22, 0.7, 0.2, 1)";
const KODE_TAHAP = ["A1", "A2", "A3", "A4", "A5", "A6", "A7"];

/** Milidetik dari tanggal kalender (tengah malam setempat) atau stempel waktu ISO. */
function ms(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = iso.length === 10 ? new Date(`${iso}T00:00:00`).getTime() : Date.parse(iso);
  return Number.isFinite(t) ? t : null;
}
const awalHari = (t: number) => {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};
const hariIni = () => awalHari(Date.now());
const tglPendek = (t: number) => {
  const d = new Date(t);
  return `${d.getDate()} ${BULAN[d.getMonth()]}`;
};
const tglPanjang = (t: number) => {
  const d = new Date(t);
  return `${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}`;
};
const tglBulan = (t: number) => {
  const d = new Date(t);
  return `${BULAN[d.getMonth()]} ${d.getFullYear()}`;
};
/** Selisih prestasi (pecahan) sebagai "+4%" / "−16%" / "0%". */
const tandaPersen = (v: number) => {
  const n = Math.round(v * 100);
  return n === 0 ? "0%" : `${n > 0 ? "+" : "−"}${Math.abs(n)}%`;
};
/** "lewat 3 hr" / "hari ini" / "5 hr lagi" terhadap hari ini. */
function sisa(t: number): string {
  const n = Math.round((awalHari(t) - hariIni()) / HARI);
  return n < 0 ? `lewat ${-n} hr` : n === 0 ? "hari ini" : `${n} hr lagi`;
}
const jutaan = (n: number) => formatRupiahRingkas(n);

/* --- Data per proyek ---------------------------------------------------------- */

interface DataProyek {
  tugas: Tugas[] | null;
  tagihan: Invoice[] | null;
  tim: PenugasanTim[] | null;
  bayar: Pembayaran[] | null;
  biaya: BiayaProyek[] | null;
}
type Bagian = keyof DataProyek;
const KUNCI: Record<Bagian, (id: string) => string> = {
  tugas: (id) => `tugas-proyek:${id}`,
  tagihan: (id) => `jdp-tagihan:${id}`,
  tim: (id) => `tim-proyek:${id}`,
  bayar: (id) => `jdp-bayar:${id}`,
  biaya: (id) => `jdp-biaya:${id}`,
};
const AMBIL: Record<Bagian, (id: string) => Promise<unknown>> = {
  tugas: daftarTugasProyek,
  tagihan: daftarInvoice,
  tim: daftarTimProyek,
  bayar: daftarPembayaran,
  biaya: daftarBiaya,
};
const SEMUA_BAGIAN: Bagian[] = ["tugas", "tagihan", "tim", "bayar", "biaya"];
const dariCache = (id: string): DataProyek => ({
  tugas: bacaCache<Tugas[]>(KUNCI.tugas(id)),
  tagihan: bacaCache<Invoice[]>(KUNCI.tagihan(id)),
  tim: bacaCache<PenugasanTim[]>(KUNCI.tim(id)),
  bayar: bacaCache<Pembayaran[]>(KUNCI.bayar(id)),
  biaya: bacaCache<BiayaProyek[]>(KUNCI.biaya(id)),
});

/* --- Jendela waktu ------------------------------------------------------------
   Dari bulan titik paling awal sampai akhir bulan titik paling akhir (hari ini
   selalu ikut), paling sedikit empat bulan. Satu fungsi `pos()` untuk kepala
   bulan, kisi, batang, dan garis — semuanya dalam persen, jadi tidak ada yang
   bisa menyimpang dari yang lain. */
interface Jendela {
  mulai: number;
  akhir: number;
  bulan: { awal: number; label: string; tahun: number | null; lebar: number }[];
}
function jendelaDari(titik: number[]): Jendela {
  const kini = hariIni();
  const semua = [...titik, kini];
  const a = new Date(Math.min(...semua));
  const b = new Date(Math.max(...semua));
  const mulai = new Date(a.getFullYear(), a.getMonth(), 1);
  let akhir = new Date(b.getFullYear(), b.getMonth() + 1, 1);
  const selisihBulan = () => (akhir.getFullYear() - mulai.getFullYear()) * 12 + akhir.getMonth() - mulai.getMonth();
  while (selisihBulan() < 4) akhir = new Date(akhir.getFullYear(), akhir.getMonth() + 1, 1);
  const total = akhir.getTime() - mulai.getTime();
  const bulan: Jendela["bulan"] = [];
  for (let d = new Date(mulai); d < akhir; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
    const s = new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime();
    bulan.push({
      awal: d.getTime(),
      label: BULAN[d.getMonth()]!,
      tahun: bulan.length === 0 || d.getMonth() === 0 ? d.getFullYear() : null,
      lebar: ((s - d.getTime()) / total) * 100,
    });
  }
  return { mulai: mulai.getTime(), akhir: akhir.getTime(), bulan };
}

/* --- Baris tahap ----------------------------------------------------------------- */

type Keadaan = "selesai" | "kini" | "rencana";
interface BarisTahap {
  nilai: string;
  label: string;
  kode: string;
  isi: Tugas[];
  selesai: number;
  persen: number;
  keadaan: Keadaan;
  telat: boolean;
  rentang: { a: number; b: number; sumber: "tugas" | "tenggat" } | null;
  tonggak: { t: number; ket: string } | null;
}

/* --- KURVA S PRESTASI ------------------------------------------------------------
   Lembar time schedule sungguhan selalu memuat kurva S: prestasi kumulatif
   RENCANA lawan REALISASI, dengan nilainya per periode di dua baris dasar
   tabel. Bobot ketujuh tahap sama (sama dengan PRESTASI lama: rata-rata
   kemajuan tahap). Rencana tiap tahap naik lurus sepanjang rentangnya, atau
   melompat di tonggaknya; tahap tanpa tanggal yang sudah dilewati dihitung
   penuh, yang belum dihitung nol ("belum berjadwal"). Realisasi = bagian
   tugasnya yang sudah dicentang menurut KAPAN dicentang — `updatedAt`, yang
   disetel Worker saat statusnya berganti. */
const selesaiPada = (x: Tugas) => ms(x.updatedAt) ?? ms(x.dueDate) ?? ms(x.createdAt);
function rencanaTahap(t: BarisTahap, w: number): number {
  if (t.rentang) return Math.min(1, Math.max(0, (w - t.rentang.a) / (t.rentang.b - t.rentang.a)));
  if (t.tonggak) return w >= t.tonggak.t ? 1 : 0;
  return t.keadaan === "selesai" ? 1 : 0;
}
function realisasiTahap(t: BarisTahap, w: number, kiniAkhir: number): number {
  if (t.isi.length)
    return t.isi.filter((x) => x.status === "selesai" && (selesaiPada(x) ?? -Infinity) <= w).length / t.isi.length;
  if (t.keadaan !== "selesai") return 0;
  const kapan = t.tonggak?.t ?? (t.rentang ? t.rentang.b - HARI : null);
  return kapan === null || Math.min(kapan, kiniAkhir) <= w ? 1 : 0;
}

/** Satu simpul kurva: letak (persen kolom waktu), rencana, dan realisasi
 *  (null sesudah hari ini). Nilai 0–1. */
interface Simpul {
  x: number;
  t: number;
  r: number;
  a: number | null;
  /** Simpul hari ini (ujung realisasi), bukan batas bulan. */
  kini?: boolean;
}
/** Letak tegak nilai 0–1 di blok tahap (persen): 0% di dasar blok, 100% di puncaknya. */
const yKurva = (v: number) => 97.5 - v * 92;

/** Bidang di antara dua kurva, dipecah di titik silangnya: TERLAMBAT (rencana
 *  di atas realisasi) dan MAJU (sebaliknya) — warnanya berbeda. */
function bidangDeviasi(s: { x: number; r: number; a: number }[]): { telat: string; maju: string } {
  let telat = "";
  let maju = "";
  const quad = (x1: number, r1: number, a1: number, x2: number, r2: number, a2: number) =>
    `M ${x1 * 10} ${yKurva(a1)} L ${x2 * 10} ${yKurva(a2)} L ${x2 * 10} ${yKurva(r2)} L ${x1 * 10} ${yKurva(r1)} Z `;
  for (let i = 0; i + 1 < s.length; i++) {
    const p = s[i]!;
    const q = s[i + 1]!;
    const d1 = p.a - p.r;
    const d2 = q.a - q.r;
    if (Math.abs(d1) < 1e-6 && Math.abs(d2) < 1e-6) continue;
    if (d1 * d2 >= 0) {
      const ruas = quad(p.x, p.r, p.a, q.x, q.r, q.a);
      if (d1 + d2 < 0) telat += ruas;
      else maju += ruas;
      continue;
    }
    /* Silang di tengah ruas: dua segitiga, masing-masing warnanya. */
    const k = d1 / (d1 - d2);
    const xs = p.x + (q.x - p.x) * k;
    const vs = p.r + (q.r - p.r) * k;
    const kiri = quad(p.x, p.r, p.a, xs, vs, vs);
    const kanan = quad(xs, vs, vs, q.x, q.r, q.a);
    if (d1 < 0) {
      telat += kiri;
      maju += kanan;
    } else {
      maju += kiri;
      telat += kanan;
    }
  }
  return { telat, maju };
}

/** Nilai yang MELUNCUR ke nilai barunya (420 ms) — hanya kalau kuncinya sama
 *  (proyek yang sama) dan panjangnya sama; selebihnya melompat. Dirender di
 *  komponen kecil pemakainya, bukan di halaman, jadi tiap bingkai cuma
 *  menggambar ulang kurvanya. */
function useHalus(nilai: number[], kunci: string): number[] {
  const [tampil, setTampil] = useState(nilai);
  const lalu = useRef({ kunci, nilai });
  const jejak = nilai.map((v) => v.toFixed(5)).join(",");
  useLayoutEffect(() => {
    const dari = lalu.current;
    lalu.current = { kunci, nilai };
    const sama = dari.nilai.length === nilai.length && dari.nilai.every((v, i) => Math.abs(v - nilai[i]!) < 1e-6);
    if (dari.kunci !== kunci || dari.nilai.length !== nilai.length || sama || !geraknya()) {
      setTampil(nilai);
      return;
    }
    let r = 0;
    let mulai = 0;
    const f = (w: number) => {
      if (!mulai) mulai = w;
      const p = Math.min(1, (w - mulai) / 420);
      const e = 1 - Math.pow(1 - p, 3);
      setTampil(nilai.map((v, i) => dari.nilai[i]! + (v - dari.nilai[i]!) * e));
      if (p < 1) r = requestAnimationFrame(f);
    };
    r = requestAnimationFrame(f);
    return () => {
      cancelAnimationFrame(r);
      setTampil(nilai);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kunci, jejak]);
  return tampil.length === nilai.length ? tampil : nilai;
}

/* Kurva S di atas blok tahap. Dipasang DUA kali: lapis BIDANG (deviasi,
   di bawah batang) dan lapis GARIS (kurva + simpul, di atas batang). */
function KurvaPrestasi({
  lapis,
  simpul,
  kunci,
  ket,
}: {
  lapis: "bidang" | "garis";
  simpul: Simpul[];
  kunci: string;
  ket: ReturnType<typeof pemberiKet>;
}) {
  const nyata = simpul.filter((s): s is Simpul & { a: number } => s.a !== null);
  const a = useHalus(
    nyata.map((s) => s.a),
    kunci,
  );
  const halus = nyata.map((s, i) => ({ ...s, a: a[i] ?? s.a }));
  if (lapis === "bidang") {
    const { telat, maju } = bidangDeviasi(halus);
    return (
      <div className="jdp__kurvas jdp__kurvas--bidang" aria-hidden="true">
        <svg viewBox="0 0 1000 100" preserveAspectRatio="none">
          {telat && <path className="jdp__devtelat" d={telat} />}
          {maju && <path className="jdp__devmaju" d={maju} />}
        </svg>
      </div>
    );
  }
  const garis = (l: { x: number; v: number }[]) =>
    l.map((s, i) => `${i ? "L" : "M"} ${(s.x * 10).toFixed(1)} ${yKurva(s.v).toFixed(2)}`).join(" ");
  const dRencana = garis(simpul.map((s) => ({ x: s.x, v: s.r })));
  const dNyata = garis(halus.map((s) => ({ x: s.x, v: s.a })));
  return (
    <div className="jdp__kurvas jdp__kurvas--garis" aria-hidden="true">
      <svg viewBox="0 0 1000 100" preserveAspectRatio="none">
        <path className="jdp__srencana" d={dRencana} />
        {halus.length > 1 && <path className="jdp__shalo" d={dNyata} />}
        {halus.length > 1 && <path className="jdp__snyata" d={dNyata} />}
      </svg>
      {simpul.map((s) =>
        s.kini || s.x <= 0.01 || s.x >= 99.99 ? null : (
          <i
            key={`r${s.t}`}
            className="jdp__simpul is-rencana"
            style={{ left: `${s.x}%`, top: `${yKurva(s.r)}%` }}
            {...ket(() => ({
              judul: `Akhir ${tglBulan(s.t - HARI)}`,
              baris: [
                { label: "Rencana kumulatif", nilai: `${Math.round(s.r * 100)}%` },
                ...(s.a !== null
                  ? [
                      { label: "Realisasi kumulatif", nilai: `${Math.round(s.a * 100)}%` },
                      { label: "Deviasi", nilai: tandaPersen(s.a - s.r) },
                    ]
                  : [{ label: "Realisasi", nilai: "belum sampai" }]),
              ],
            }))}
          />
        ),
      )}
      {halus.map((s) =>
        s.x <= 0.01 || (!s.kini && s.x >= 99.99) ? null : (
          <i
            key={`a${s.t}`}
            className={`jdp__simpul is-nyata${s.kini ? " is-kini" : ""}`}
            style={{ left: `${s.x}%`, top: `${yKurva(s.a)}%` }}
            {...(s.kini
              ? ket(() => ({
                  judul: `Prestasi s.d. ${tglPanjang(s.t)}`,
                  baris: [
                    { label: "Rencana", nilai: `${Math.round(s.r * 100)}%` },
                    { label: "Realisasi", nilai: `${Math.round(s.a * 100)}%` },
                    { label: "Deviasi", nilai: tandaPersen(s.a - s.r) },
                  ],
                }))
              : {})}
          />
        ),
      )}
      <i className="jdp__bidikkurva is-rencana" />
      <i className="jdp__bidikkurva is-nyata" />
    </div>
  );
}

/* --- Halaman ------------------------------------------------------------------- */

function Isi({ dibangunPada }: { dibangunPada?: string }) {
  const { semua, setSemua, asli: kini, galat, pilih } = usePilihProyek();
  const toast = useToast();
  const [data, setData] = useState<Record<string, DataProyek>>({});
  const [paket, setPaket] = useState<Paket[]>([]);
  const [studio, setStudio] = useState<StudioSettings | null>(() => bacaCache<StudioSettings>("settings"));
  const [tahapPilih, setTahapPilih] = useState<string | null>(null);
  const [lingkupBuka, setLingkupBuka] = useState(false);
  const [tugaskan, setTugaskan] = useState<UbahTugaskan | null>(null);
  const [bayar, setBayar] = useState<PilihanBayar | null>(null);
  const [membuatPdf, setMembuatPdf] = useState(false);
  const [tulis, setTulis] = useState("");
  const [menulis, setMenulis] = useState(false);
  /* Tanda bayaran yang baru dicap dan centang yang baru dibubuhkan — gerak
     sekali, hanya untuk yang berubah. */
  const [tercap, setTercap] = useState<string | null>(null);
  const [dicentang, setDicentang] = useState<string | null>(null);
  useEffect(() => {
    if (!tercap && !dicentang) return;
    const w = window.setTimeout(() => {
      setTercap(null);
      setDicentang(null);
    }, 900);
    return () => window.clearTimeout(w);
  }, [tercap, dicentang]);
  const akar = useRef<HTMLDivElement>(null);
  const kabar = useRef<((i: InfoKartu | null) => void) | null>(null);
  const ket = pemberiKet(kabar);

  useEffect(() => {
    daftarPaket().then(setPaket).catch(() => setPaket([]));
    /* Dibaca saja — kunci `settings` milik Info Studio (jebakan #8). */
    ambilSettings().then(setStudio).catch(() => {});
  }, []);

  /* Ketuk di luar benda berketerangan menutup kartunya (layar sentuh). */
  useEffect(() => {
    const tutup = (e: PointerEvent) => {
      if (!(e.target instanceof Element) || !e.target.closest("[data-ket]")) kabar.current?.(null);
    };
    document.addEventListener("pointerdown", tutup);
    return () => document.removeEventListener("pointerdown", tutup);
  }, []);

  function muat(id: string, bagian: Bagian[] = SEMUA_BAGIAN) {
    for (const b of bagian) {
      AMBIL[b](id)
        .then((d) => {
          tulisCache(KUNCI[b](id), d);
          setData((l) => ({ ...l, [id]: { ...(l[id] ?? dariCache(id)), [b]: d } }));
        })
        .catch(() =>
          setData((l) => {
            const ada = l[id] ?? dariCache(id);
            return { ...l, [id]: { ...ada, [b]: ada[b] ?? [] } };
          }),
        );
    }
  }
  useEffect(() => {
    if (!kini) return;
    setData((l) => (l[kini.id] ? l : { ...l, [kini.id]: dariCache(kini.id) }));
    muat(kini.id);
    setTahapPilih(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kini?.id]);

  const d: DataProyek = (kini && data[kini.id]) || { tugas: null, tagihan: null, tim: null, bayar: null, biaya: null };
  const tugas = d.tugas ?? [];
  const tagihan = d.tagihan ?? [];
  const tim = d.tim ?? [];
  /* `#tim-bayaran` (dari Fee Proyek): seksi personilnya baru ada sesudah
     datanya tiba, jadi lompatan bawaan peramban saat muat tidak menemukannya.
     Di layar satu-layar seksinya sudah tampak; yang perlu dibawa hanya ponsel. */
  const timSiap = d.tim !== null;
  useEffect(() => {
    if (!timSiap || location.hash !== "#tim-bayaran") return;
    if (document.scrollingElement && document.scrollingElement.scrollHeight <= innerHeight) return;
    document.getElementById("tim-bayaran")?.scrollIntoView({ block: "start" });
  }, [timSiap]);
  const masuk = useMemo(() => [...(d.bayar ?? [])].sort((a, b) => (ms(a.paidAt) ?? 0) - (ms(b.paidAt) ?? 0)), [d.bayar]);
  const keluar = useMemo(
    () => [...(d.biaya ?? [])].sort((a, b) => (ms(a.incurredOn) ?? 0) - (ms(b.incurredOn) ?? 0)),
    [d.biaya],
  );
  const kiniMs = hariIni();

  /* --- Turunan: tonggak uang dan tenggat -------------------------------------- */
  const tPreview = ms(kini?.deadlinePreview);
  const tFinal = ms(kini?.deadlineFinal);
  const tagihanUrut = [...tagihan].sort((a, b) => a.sortOrder - b.sortOrder);
  const tDp =
    ms(masuk.find((b) => b.kind === "dp")?.paidAt) ??
    ms(masuk[0]?.paidAt) ??
    ms(tagihanUrut[0]?.paidAt ?? tagihanUrut[0]?.dueDate ?? null);
  const terminAkhir = tagihanUrut.at(-1);
  const tPelunasan = ms(terminAkhir?.dueDate ?? terminAkhir?.paidAt ?? null);
  const iKini = Math.max(0, TAHAP.findIndex((t) => t.value === kini?.pipelineStage));

  const tahap = useMemo<BarisTahap[]>(() => {
    return TAHAP.map((t, i) => {
      const isi = tugas.filter((x) => x.stage === t.value);
      const selesai = isi.filter((x) => x.status === "selesai").length;
      const keadaan: Keadaan = i < iKini ? "selesai" : i === iKini ? "kini" : "rencana";
      const telat = isi.some((x) => x.status !== "selesai" && (ms(x.dueDate) ?? Infinity) < kiniMs);
      let rentang: BarisTahap["rentang"] = null;
      let tonggak: BarisTahap["tonggak"] = null;
      if (isi.length) {
        const awal = isi.map((x) => ms(x.createdAt) ?? ms(x.dueDate)).filter((v): v is number => v !== null);
        const akhir = isi.map((x) => ms(x.dueDate) ?? ms(x.createdAt)).filter((v): v is number => v !== null);
        if (awal.length && akhir.length) {
          const a = awalHari(Math.min(...awal));
          rentang = { a, b: Math.max(a + HARI, awalHari(Math.max(...akhir)) + HARI), sumber: "tugas" };
        }
      } else if (t.value === "dp_50" && tDp !== null) tonggak = { t: tDp, ket: "DP masuk" };
      else if (t.value === "desain_1" && tPreview !== null) {
        if (tDp !== null && tDp < tPreview) rentang = { a: awalHari(tDp), b: tPreview + HARI, sumber: "tenggat" };
        else tonggak = { t: tPreview, ket: "Tenggat preview" };
      } else if (t.value === "desain_2" && tFinal !== null) {
        if (tPreview !== null && tPreview < tFinal) rentang = { a: tPreview, b: tFinal + HARI, sumber: "tenggat" };
        else tonggak = { t: tFinal, ket: "Tenggat final" };
      } else if (t.value === "finish" && tFinal !== null) tonggak = { t: tFinal, ket: "Tenggat final" };
      else if (t.value === "pelunasan" && tPelunasan !== null) tonggak = { t: tPelunasan, ket: "Termin terakhir" };
      const persen = isi.length ? Math.round((selesai / isi.length) * 100) : keadaan === "selesai" ? 100 : 0;
      return { nilai: t.value, label: t.label, kode: KODE_TAHAP[i]!, isi, selesai, persen, keadaan, telat, rentang, tonggak };
    });
  }, [tugas, iKini, kiniMs, tDp, tPreview, tFinal, tPelunasan]);

  const aktif = tahap.find((t) => t.nilai === tahapPilih) ?? tahap[iKini] ?? tahap[0]!;

  /* Rentang proyek: dari tahap pertama yang bertanggal sampai tenggat final
     (atau tahap terakhir yang bertanggal) — dipakai garis personil yang belum
     punya tugas sendiri. */
  const titikTahap = tahap.flatMap((t) => (t.rentang ? [t.rentang.a, t.rentang.b] : t.tonggak ? [t.tonggak.t] : []));
  const awalProyek = titikTahap.length ? Math.min(...titikTahap) : null;
  const akhirProyek = tFinal ?? (titikTahap.length ? Math.max(...titikTahap) : null);

  /* --- Personil ---------------------------------------------------------------- */
  const orang = useMemo(() => {
    const urut = [...tim].sort((a, b) => URUTAN_PERAN.indexOf(a.role) - URUTAN_PERAN.indexOf(b.role));
    return urut.map((p) => {
      const milik = tugas.filter((x) => x.assigneeId === p.teamMemberId);
      const awal = milik.map((x) => ms(x.createdAt) ?? ms(x.dueDate)).filter((v): v is number => v !== null);
      const akhir = milik.map((x) => ms(x.dueDate) ?? ms(x.createdAt)).filter((v): v is number => v !== null);
      const rentang =
        awal.length && akhir.length
          ? { a: awalHari(Math.min(...awal)), b: Math.max(awalHari(Math.min(...awal)) + HARI, awalHari(Math.max(...akhir)) + HARI), sendiri: true }
          : awalProyek !== null && akhirProyek !== null && akhirProyek > awalProyek
            ? { a: awalProyek, b: akhirProyek + HARI, sendiri: false }
            : null;
      const tanda = p.tahap
        .filter((t) => t.keadaan !== "belum_ditentukan")
        .map((t) => {
          /* Dibayar = tanggal bayarnya. Jatuh tempo dan menunggu = tanggal
             pemicunya (DP masuk untuk tahap awal, tenggat final untuk tahap
             akhir) — yang jatuh tempo tanpa tanggal pemicu duduk di hari ini. */
          const pemicu = t.tahap === "awal" ? tDp : tFinal;
          const kapan =
            t.keadaan === "dibayar" ? ms(t.dibayarPada) : t.keadaan === "jatuh_tempo" ? (pemicu ?? kiniMs) : pemicu;
          return { t, kapan };
        });
      return { p, rentang, tanda, tugasn: milik.length, milik };
    });
  }, [tim, tugas, awalProyek, akhirProyek, kiniMs, tDp, tFinal]);
  const jatuhTempo = tim.flatMap((p) => p.tahap.filter((t) => t.keadaan === "jatuh_tempo").map((t) => ({ p, t })));

  /* --- Uang ---------------------------------------------------------------------- */
  const kontrak = kini?.contractValue ?? 0;
  const diterima = d.bayar ? masuk.reduce((n, b) => n + b.amount, 0) : (kini?.paidTotal ?? 0);
  const totalKeluar = keluar.reduce((n, b) => n + b.amount, 0);
  const skalaUang = Math.max(kontrak, diterima, totalKeluar, 1);

  /* --- Jendela waktu ------------------------------------------------------------- */
  const j = useMemo(() => {
    const titik = [
      ...titikTahap,
      ...orang.flatMap((o) => o.tanda.map((x) => x.kapan).filter((v): v is number => v !== null)),
      ...tagihan.map((t) => ms(t.dueDate ?? t.paidAt ?? null)).filter((v): v is number => v !== null),
      ...masuk.map((b) => ms(b.paidAt)).filter((v): v is number => v !== null),
      ...[tPreview, tFinal].filter((v): v is number => v !== null),
    ];
    /* BIAYA tidak ikut menentukan jendela: riwayat biaya bisa berekor
       bertahun-tahun (biaya lama yang dicatat ke proyek ini), dan satu biaya
       2024 akan memeras seluruh jadwal ke sepertiga lebar. Biaya di luar
       jendela tidak digambar — jumlahnya tetap di kolom kanan. */
    return jendelaDari(titik);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tahap, orang, tagihan, masuk, tPreview, tFinal]);
  const keluarTampak = keluar.filter((b) => {
    const t = ms(b.incurredOn);
    return t !== null && t >= j.mulai && t < j.akhir;
  });

  /* Label bulan menurut lebar kolom waktu yang SEBENARNYA (diukur saat ukuran
     berubah, bukan saat menggulir): "Okt" kalau muat, "O" kalau sempit, dan
     hanya awal kuartal kalau lebih sempit lagi. */
  const thWaktuRef = useRef<HTMLSpanElement>(null);
  const [lebarWaktu, setLebarWaktu] = useState(0);
  useLayoutEffect(() => {
    const el = thWaktuRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setLebarWaktu(Math.round(e!.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [kini?.id]);
  const perBulan = lebarWaktu / Math.max(1, j.bulan.length);
  const modeBulan: "pendek" | "huruf" | "kuartal" = perBulan === 0 || perBulan >= 30 ? "pendek" : perBulan >= 13 ? "huruf" : "kuartal";
  const pos = (t: number) => Math.min(100, Math.max(0, ((t - j.mulai) / (j.akhir - j.mulai)) * 100));
  const posKini = pos(kiniMs + HARI / 2);
  const tabelRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = tabelRef.current;
    if (!el || el.scrollWidth <= el.clientWidth + 1) return;
    /* Dibaca sekali per proyek (dan sekali lagi kalau jendela waktunya
       bergeser karena datanya baru tiba), bukan di penangan gulir (jebakan
       #21). Hari ini diletakkan di 60% jendela yang TAMPAK — di kanan kolom
       uraian yang menempel. */
    const waktu = el.querySelector<HTMLElement>(".jdp__thwaktu");
    if (!waktu) return;
    const kotak = el.getBoundingClientRect();
    const r = waktu.getBoundingClientRect();
    const awal = r.left - kotak.left + el.scrollLeft;
    const tempel = el.querySelector<HTMLElement>(".jdp__th > span:nth-child(2)");
    const lebarTempel = tempel && getComputedStyle(tempel).position === "sticky" ? tempel.getBoundingClientRect().right - kotak.left : 0;
    const x = awal + (r.width * posKini) / 100;
    el.scrollLeft = Math.max(0, x - lebarTempel - (el.clientWidth - lebarTempel) * 0.6);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kini?.id, lebarWaktu > 0, Math.round(posKini)]);

  /* --- Kurva S prestasi + rekap per bulan -------------------------------------------
     Simpul di tiap batas bulan (nilai di AKHIR bulan sebelumnya) dan satu
     simpul hari ini (ujung realisasi). Baris rekap membaca simpul yang sama,
     jadi angka di dasar tabel dan titik di kurva tidak bisa menyimpang. */
  const kiniAkhir = kiniMs + HARI - 1;
  const rencanaPada = (w: number) => tahap.reduce((n, t) => n + rencanaTahap(t, w), 0) / tahap.length;
  const realisasiPada = (w: number) => tahap.reduce((n, t) => n + realisasiTahap(t, w, kiniAkhir), 0) / tahap.length;
  const simpul = useMemo<Simpul[]>(() => {
    const l: Simpul[] = [...j.bulan.map((b) => b.awal), j.akhir].map((t) => ({
      x: pos(t),
      t,
      r: rencanaPada(t),
      a: t <= kiniMs ? realisasiPada(t) : null,
    }));
    const sk: Simpul = { x: posKini, t: kiniAkhir, r: rencanaPada(kiniAkhir), a: realisasiPada(kiniAkhir), kini: true };
    const i = l.findIndex((x) => x.t > kiniMs);
    if (i === -1) l.push(sk);
    else l.splice(i, 0, sk);
    return l;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [j, tahap, kiniMs]);
  const capaianKini = simpul.find((x) => x.kini)!;
  const nRencana = Math.round(capaianKini.r * 100);
  const nNyata = Math.round((capaianKini.a ?? 0) * 100);
  const nDev = nNyata - nRencana;
  /* Selama tugas proyek yang baru dipilih belum tiba, angka capaian MENAHAN
     angka terakhir yang sah (diredupkan) — angka setengah termuat bukan
     angka siapa pun. Begitu datanya tiba, angka itu berhitung ke nilai
     barunya bersama sapuan plotter. Belum ada angka sah sama sekali = "—". */
  const muatCapaian = d.tugas === null;
  const capSah = useRef<{ r: number; a: number } | null>(null);
  useEffect(() => {
    if (!muatCapaian) capSah.current = { r: nRencana, a: nNyata };
  });
  const capTampil = muatCapaian ? capSah.current : { r: nRencana, a: nNyata };
  const devTampil = capTampil ? capTampil.a - capTampil.r : 0;
  const rekap = j.bulan.map((b, k) => {
    const akhirBulan = j.bulan[k + 1]?.awal ?? j.akhir;
    return {
      awal: b.awal,
      lebar: b.lebar,
      r: rencanaPada(akhirBulan),
      a: akhirBulan <= kiniMs ? realisasiPada(akhirBulan) : b.awal <= kiniMs ? realisasiPada(kiniAkhir) : null,
      kini: b.awal <= kiniMs && kiniMs < akhirBulan,
    };
  });
  /* Angka rekap butuh ±22px; di kolom bulan yang lebih sempit hanya tiap
     k bulan yang ditulis, berpangkal di bulan berjalan. */
  const langkahRekap = perBulan > 0 && perBulan < 22 ? Math.ceil(22 / perBulan) : 1;
  const iRekapKini = Math.max(0, rekap.findIndex((m) => m.kini));
  const rekapTampil = (i: number) => Math.abs(i - iRekapKini) % langkahRekap === 0;
  /* Mistar minggu di pita kepala: satu takik tiap Senin, kalau kolom bulannya
     cukup lebar untuk empat takik. */
  const minggu = useMemo(() => {
    if (perBulan < 34) return [];
    const l: number[] = [];
    const d = new Date(j.mulai);
    d.setDate(d.getDate() + ((8 - d.getDay()) % 7));
    for (; d.getTime() < j.akhir; d.setDate(d.getDate() + 7)) l.push(d.getTime());
    return l;
  }, [j, perBulan]);

  /* Kurva uang masuk kumulatif, digambar dalam koordinat 0–1000 × 0–100. */
  const kurva = useMemo(() => {
    let kum = 0;
    const y = (v: number) => 92 - (v / skalaUang) * 80;
    let d = `M 0 ${y(0)}`;
    const titik: { x: number; y: number; b: Pembayaran; t: number }[] = [];
    for (const b of masuk) {
      const t = ms(b.paidAt);
      if (t === null) continue;
      const x = pos(t) * 10;
      d += ` L ${x.toFixed(1)} ${y(kum).toFixed(2)}`;
      kum += b.amount;
      d += ` L ${x.toFixed(1)} ${y(kum).toFixed(2)}`;
      titik.push({ x, y: y(kum), b, t });
    }
    const xKini = posKini * 10;
    d += ` L ${xKini.toFixed(1)} ${y(kum).toFixed(2)}`;
    const isi = `${d} L ${xKini.toFixed(1)} 92 L 0 92 Z`;
    /* Biaya keluar kumulatif — berpangkal di biaya yang SUDAH keluar sebelum
       jendela, jadi garisnya jujur walau titik lamanya tidak digambar. */
    let kk = keluar.reduce((n, b) => ((ms(b.incurredOn) ?? Infinity) < j.mulai ? n + b.amount : n), 0);
    let dk = `M 0 ${y(kk).toFixed(2)}`;
    for (const b of keluar) {
      const t = ms(b.incurredOn);
      if (t === null || t < j.mulai || t >= j.akhir) continue;
      const x = Math.min(pos(t + HARI / 2) * 10, xKini);
      dk += ` L ${x.toFixed(1)} ${y(kk).toFixed(2)}`;
      kk += b.amount;
      dk += ` L ${x.toFixed(1)} ${y(kk).toFixed(2)}`;
    }
    dk += ` L ${xKini.toFixed(1)} ${y(kk).toFixed(2)}`;
    const keluarIsi = `${dk} L ${xKini.toFixed(1)} 92 L 0 92 Z`;
    return { garis: d, isi, titik, kontrakY: y(kontrak), keluarGaris: dk, keluarIsi };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [masuk, keluar, j, skalaUang, kontrak, posKini]);
  const idSvg = `jdp${useId().replace(/[^a-zA-Z0-9]/g, "")}`;

  /* --- PLOTTER: ganti proyek / ganti tahap mencetak ulang kolom waktu ---------------
     Kereta plotter menyapu kolom waktu dari kiri ke kanan; di belakangnya
     lembar sudah tercetak, di depannya masih kertas kosong — kepala bulan,
     batang, kurva S, kurva uang, dan rekap tergambar SERENTAK oleh satu sapuan
     (bukan baris demi baris). Hanya karena perbuatan: muatan pertama dan data
     yang datang menyusul tidak dianimasikan (jebakan #74). Kuncinya proyek +
     tahap, dan baru dihitung sesudah tugas proyek itu ada. Lebar kolom dibaca
     sekali saat mulai. */
  const plotRef = useRef<HTMLDivElement>(null);
  /* Proyek yang baru dipilih dan datanya belum ada: kolom waktunya langsung
     kertas kosong dengan kereta di tepi kiri — bukan lembar setengah jadi
     yang sesaat kemudian ditutup lagi. Sapuan mulai begitu tugasnya tiba. */
  const proyekLalu = useRef<string | null>(null);
  useLayoutEffect(() => {
    const id = kini?.id ?? null;
    const lalu = proyekLalu.current;
    proyekLalu.current = id;
    if (lalu === null || id === null || lalu === id || !geraknya() || !akar.current) return;
    akar.current.dataset.cetak = "tunggu";
  }, [kini?.id]);
  const kunciPena = kini && d.tugas ? `${kini.id}|${kini.pipelineStage ?? ""}` : null;
  const penaLalu = useRef<string | null>(null);
  useLayoutEffect(() => {
    if (!kunciPena) return;
    const lalu = penaLalu.current;
    penaLalu.current = kunciPena;
    const plot = plotRef.current;
    const el = akar.current;
    const lepas = () => {
      if (el) delete el.dataset.cetak;
    };
    /* Kembali ke proyek yang sama sebelum data proyek lain tiba: tanpa
       sapuan, dan kertas kosongnya dilepas. */
    if (lalu === null || lalu === kunciPena || !geraknya() || !plot || !el) return lepas();
    const lebar = plot.getBoundingClientRect().width;
    const tirai = plot.querySelector<HTMLElement>(".jdp__tirai");
    const kereta = plot.querySelector<HTMLElement>(".jdp__kereta");
    if (!tirai || !kereta || lebar < 1) return;
    el.dataset.cetak = "";
    const opsi = { duration: 960, easing: "cubic-bezier(0.45, 0.05, 0.25, 1)" };
    const a1 = tirai.animate([{ transform: "translateX(0)" }, { transform: `translateX(${lebar}px)` }], opsi);
    const a2 = kereta.animate([{ transform: "translateX(0)" }, { transform: `translateX(${lebar}px)` }], opsi);
    a2.onfinish = lepas;
    return () => {
      a1.cancel();
      a2.cancel();
      lepas();
    };
  }, [kunciPena]);

  /* --- PENANDA baris tahap terpilih: SATU garis tinta yang meluncur -----------------
     Letaknya dibaca dari baris terpilih saat pilihan atau ukuran blok berubah
     (bukan saat menggulir), lalu ditulis langsung ke gayanya. */
  const blokRef = useRef<HTMLDivElement>(null);
  const penandaRef = useRef<HTMLElement>(null);
  const iAktif = tahap.findIndex((t) => t.nilai === aktif.nilai);
  useLayoutEffect(() => {
    const blok = blokRef.current;
    const tanda = penandaRef.current;
    if (!blok || !tanda) return;
    const taruh = () => {
      const baris = blok.querySelectorAll<HTMLElement>(":scope > .jdp__baris")[iAktif];
      if (!baris) return;
      tanda.style.transform = `translateY(${baris.offsetTop}px)`;
      tanda.style.height = `${baris.offsetHeight}px`;
    };
    taruh();
    /* Pemasangan pertama tidak meluncur. */
    const w = requestAnimationFrame(() => tanda.classList.add("is-siap"));
    const ro = new ResizeObserver(taruh);
    ro.observe(blok);
    return () => {
      cancelAnimationFrame(w);
      ro.disconnect();
    };
  }, [iAktif, kini?.id]);

  /* --- Sorot silang tugas: takik di batang ⇄ ruas personil ⇄ baris lembar tugas ---
     Kelas ditulis langsung ke DOM (tetikus saja), jadi kursor yang lewat tidak
     menggambar ulang halaman. */
  function sorot(id: string | null) {
    akar.current?.querySelectorAll<HTMLElement>("[data-tugas]").forEach((e) => {
      e.classList.toggle("is-sorot", id !== null && e.dataset.tugas === id);
    });
  }
  const ketSorot = (id: string, isi: () => { judul: string; baris: BarisKartu[] }) => {
    const k = ket(isi);
    return {
      ...k,
      onPointerEnter: (e: PointerEventReact) => {
        k.onPointerEnter(e);
        if (e.pointerType === "mouse") sorot(id);
      },
      onPointerLeave: (e: PointerEventReact) => {
        k.onPointerLeave(e);
        if (e.pointerType === "mouse") sorot(null);
      },
    };
  };
  const ketTugas = (x: Tugas) => {
    const due = ms(x.dueDate);
    const jadi = x.status === "selesai" ? selesaiPada(x) : null;
    return {
      judul: x.title,
      baris: [
        { label: "Tahap", nilai: TAHAP.find((t) => t.value === x.stage)?.label ?? "—" },
        { label: "PIC", nilai: x.assigneeName ?? "belum ada" },
        { label: "Tenggat", nilai: due === null ? "—" : `${tglPanjang(due)}${x.status === "selesai" ? "" : ` · ${sisa(due)}`}` },
        { label: "Keadaan", nilai: jadi !== null ? `Selesai ${tglPendek(jadi)}` : x.status === "selesai" ? "Selesai" : "Belum selesai" },
      ],
    };
  };

  /* --- Lembar tugas berganti saat tahap dipilih ---------------------------------- */
  const daftarRef = useRef<HTMLUListElement>(null);
  const tahapLalu = useRef<string | null>(null);
  useLayoutEffect(() => {
    const lalu = tahapLalu.current;
    tahapLalu.current = aktif.nilai;
    if (lalu === null || lalu === aktif.nilai || !geraknya() || !daftarRef.current) return;
    daftarRef.current.animate(
      [{ transform: "translateY(10px)", opacity: 0 }, { transform: "none", opacity: 1 }],
      { duration: 300, easing: LEMBUT },
    );
  }, [aktif.nilai]);

  /* --- GARIS BIDIK: kursor di kolom waktu ------------------------------------------
     Kotak kolom waktu dibaca SEKALI saat kursor masuk (jebakan #21); garis,
     tanggal, dan uang masuk s.d. tanggal itu ditulis langsung ke DOM, jadi
     halaman tidak dirender ulang tiap gerak. Tetikus saja (jebakan #9). */
  const lapisRef = useRef<HTMLDivElement>(null);
  const bidikRef = useRef<HTMLDivElement>(null);
  const bidikTagRef = useRef<HTMLSpanElement>(null);
  const uangBidikRef = useRef<HTMLSpanElement>(null);
  const kotakWaktu = useRef<DOMRect | null>(null);
  const prestasiBidikRef = useRef<HTMLSpanElement>(null);
  const uangDiTanggal = (t: number) =>
    masuk.reduce((n, b) => ((ms(b.paidAt) ?? Infinity) <= t ? n + b.amount : n), 0);
  const keluarDiTanggal = (t: number) =>
    keluar.reduce((n, b) => ((ms(b.incurredOn) ?? Infinity) <= t ? n + b.amount : n), 0);
  /** Nilai kurva S di letak p (persen) — dibaca dari simpul yang SAMA dengan
   *  garis yang tergambar, jadi titik bidik selalu duduk di garisnya. */
  function bacaKurva(p: number): { r: number; a: number | null } {
    const l = simpul;
    let i = 0;
    while (i + 1 < l.length && l[i + 1]!.x < p) i++;
    const u = l[i]!;
    const v = l[i + 1] ?? u;
    const k = v.x > u.x ? Math.min(1, Math.max(0, (p - u.x) / (v.x - u.x))) : 0;
    const r = u.r + (v.r - u.r) * k;
    const a = u.a !== null && v.a !== null ? u.a + (v.a - u.a) * k : u.a !== null && k === 0 ? u.a : null;
    return { r, a };
  }
  function bidikMasuk(e: PointerEventReact) {
    if (e.pointerType !== "mouse") return;
    kotakWaktu.current = lapisRef.current?.getBoundingClientRect() ?? null;
    bidikGerak(e);
  }
  function bidikGerak(e: PointerEventReact) {
    if (e.pointerType !== "mouse") return;
    const k = kotakWaktu.current;
    const garis = bidikRef.current;
    const tag = bidikTagRef.current;
    if (!k || !garis || !tag) return;
    const x = e.clientX - k.left;
    if (x < 0 || x > k.width) return bidikLepas();
    const t = j.mulai + (x / k.width) * (j.akhir - j.mulai);
    const p = (x / k.width) * 100;
    garis.style.left = `${p}%`;
    garis.dataset.tampil = "";
    tag.style.left = `${p}%`;
    tag.dataset.tampil = "";
    tag.textContent = tglPanjang(t);
    const u = uangBidikRef.current;
    if (u) {
      const v = uangDiTanggal(t);
      u.textContent = `s.d. ${tglPendek(t)} · ${jutaan(v)}`;
      u.dataset.tampil = "";
    }
    /* Titik baca di kedua kurva S + angkanya di kepala seksi A. */
    const nilai = bacaKurva(p);
    const blok = blokRef.current;
    const tr = blok?.querySelector<HTMLElement>(".jdp__bidikkurva.is-rencana");
    const ta = blok?.querySelector<HTMLElement>(".jdp__bidikkurva.is-nyata");
    if (tr) {
      tr.style.left = `${p}%`;
      tr.style.top = `${yKurva(nilai.r)}%`;
      tr.dataset.tampil = "";
    }
    if (ta) {
      if (nilai.a === null) delete ta.dataset.tampil;
      else {
        ta.style.left = `${p}%`;
        ta.style.top = `${yKurva(nilai.a)}%`;
        ta.dataset.tampil = "";
      }
    }
    const pb = prestasiBidikRef.current;
    if (pb) {
      pb.textContent =
        nilai.a === null
          ? `rencana ${Math.round(nilai.r * 100)}%`
          : `rencana ${Math.round(nilai.r * 100)} · real ${Math.round(nilai.a * 100)}%`;
      pb.dataset.tampil = "";
    }
  }
  function bidikLepas() {
    delete bidikRef.current?.dataset.tampil;
    delete bidikTagRef.current?.dataset.tampil;
    delete uangBidikRef.current?.dataset.tampil;
    delete prestasiBidikRef.current?.dataset.tampil;
    blokRef.current?.querySelectorAll<HTMLElement>(".jdp__bidikkurva").forEach((x) => delete x.dataset.tampil);
  }

  /* --- Perbuatan ----------------------------------------------------------------- */
  const stempelRef = useRef<HTMLDivElement>(null);
  async function gantiTahap(baru: string) {
    if (!kini) return;
    try {
      await simpanProyek(kini.id, { pipelineStage: baru });
      /* Stempel tahap DICAP ulang — sekali, karena perbuatan ini. */
      if (geraknya())
        stempelRef.current?.animate(
          [
            { transform: "rotate(-7deg) scale(1.55)", opacity: 0 },
            { transform: "rotate(-1deg) scale(0.95)", opacity: 1, offset: 0.62 },
            { transform: "rotate(-1.5deg) scale(1)", opacity: 1 },
          ],
          { duration: 520, easing: LEMBUT },
        );
      setSemua((l) => {
        const n = l?.map((p) => (p.id === kini.id ? { ...p, pipelineStage: baru } : p)) ?? l;
        if (n) tulisCache("proyek", n);
        return n;
      });
      setTahapPilih(null);
      toast({ judul: `Tahap kini: ${TAHAP.find((t) => t.value === baru)?.label ?? baru}`, nada: "sukses" });
      /* Bayaran tahap tim bergantung pada tahap proyek (DP, Finish). */
      muat(kini.id, ["tim"]);
    } catch (e) {
      toast({ judul: "Gagal mengubah tahap", keterangan: (e as Error).message, nada: "gagal" });
      throw e;
    }
  }

  async function centang(t: Tugas) {
    if (!kini) return;
    const id = kini.id;
    const lama = t.status;
    const baru = lama === "selesai" ? "berjalan" : "selesai";
    const ganti = (status: string) =>
      setData((l) => {
        const ada = l[id];
        if (!ada?.tugas) return l;
        const tugasBaru = ada.tugas.map((x) => (x.id === t.id ? { ...x, status, updatedAt: new Date().toISOString() } : x));
        tulisCache(KUNCI.tugas(id), tugasBaru);
        return { ...l, [id]: { ...ada, tugas: tugasBaru } };
      });
    ganti(baru);
    if (baru === "selesai") setDicentang(t.id);
    try {
      await ubahTugas(t.id, { status: baru });
      toast({ judul: baru === "selesai" ? "Tugas selesai" : "Tugas dibuka lagi", keterangan: t.title, nada: "sukses" });
    } catch (e) {
      ganti(lama);
      toast({ judul: "Gagal menyimpan", keterangan: (e as Error).message, nada: "gagal" });
    }
  }

  async function tambah() {
    const judul = tulis.trim();
    if (!kini || !judul || menulis) return;
    setMenulis(true);
    try {
      await tambahTugas(kini.id, { title: judul, stage: aktif.nilai });
      setTulis("");
      toast({ judul: "Tugas ditambahkan", keterangan: `${aktif.label} · ${judul}`, nada: "sukses" });
      muat(kini.id, ["tugas"]);
    } catch (e) {
      toast({ judul: "Gagal menambah tugas", keterangan: (e as Error).message, nada: "gagal" });
    } finally {
      setMenulis(false);
    }
  }

  async function pdf(buat: (p: Proyek) => Promise<string>) {
    if (!kini || membuatPdf) return;
    setMembuatPdf(true);
    try {
      const nama = await buat(kini);
      toast({ judul: "PDF diunduh", keterangan: nama, nada: "sukses" });
    } catch (e) {
      toast({ judul: "Gagal membuat PDF", keterangan: (e as Error).message, nada: "gagal" });
    } finally {
      setMembuatPdf(false);
    }
  }

  function bukaBayar(p: PenugasanTim, t: TahapBayaran) {
    kabar.current?.(null);
    setBayar({ p, t });
  }
  function sesudahBayar() {
    if (!kini || !bayar) return;
    setTercap(`${bayar.p.id}:${bayar.t.tahap}`);
    muat(kini.id, ["tim", "biaya"]);
  }

  /* Papan ketik di daftar tahap: ↑/↓/Home/End memindah pilihan. */
  function tombolTahap(e: KeyboardEvent<HTMLButtonElement>, i: number) {
    const ke = e.key === "ArrowDown" ? i + 1 : e.key === "ArrowUp" ? i - 1 : e.key === "Home" ? 0 : e.key === "End" ? tahap.length - 1 : null;
    if (ke === null) return;
    e.preventDefault();
    const n = Math.max(0, Math.min(tahap.length - 1, ke));
    setTahapPilih(tahap[n]!.nilai);
    akar.current?.querySelectorAll<HTMLButtonElement>(".jdp__uraian--tahap")[n]?.focus();
  }

  /* --- Keadaan muat ----------------------------------------------------------------- */
  if (galat && !semua) return <GagalMuat apa="daftar proyek" galat={galat} />;
  if (semua && semua.length === 0) {
    return (
      <div className="jdp">
        <div className="jdp__papan jdp__papan--kosong">
          <p>
            Belum ada proyek. <a href="/admin/proyek/baru">Buat proyek pertama</a>.
          </p>
        </div>
      </div>
    );
  }
  if (!kini) return <Rangka />;

  const kode = kodeProyek(kini.title);
  const idKini = encodeURIComponent(kini.id);
  const paketIni = paket.find((p) => p.id === kini.tierId) ?? null;
  const namaStudio = studio?.studioName || "Studio";
  const muatTugas = d.tugas === null;
  const muatUang = d.biaya === null || d.bayar === null;
  const aktifTugas = [...aktif.isi].sort(
    (a, b) => Number(a.status === "selesai") - Number(b.status === "selesai") || a.sortOrder - b.sortOrder,
  );
  const sudahTayang =
    kini.status === "published" && (!dibangunPada || !kini.publishedAt || kini.publishedAt <= dibangunPada);
  const persenDiterima = kontrak > 0 ? Math.round((diterima / kontrak) * 100) : null;

  const ketTahap = (t: BarisTahap) => () => {
    const baris: BarisKartu[] = [];
    if (t.rentang) baris.push({ label: t.rentang.sumber === "tugas" ? "Rentang tugas" : "Dari tenggat", nilai: `${tglPendek(t.rentang.a)} – ${tglPendek(t.rentang.b - HARI)}` });
    if (t.tonggak) baris.push({ label: t.tonggak.ket, nilai: tglPanjang(t.tonggak.t) });
    baris.push({ label: "Tugas selesai", nilai: t.isi.length ? `${t.selesai} / ${t.isi.length}` : "tanpa tugas" });
    baris.push({ label: "Keadaan", nilai: t.keadaan === "selesai" ? "Sudah dilewati" : t.keadaan === "kini" ? (t.telat ? "Berjalan · terlambat" : "Berjalan") : "Belum sampai" });
    return { judul: `${t.kode} ${t.label}`, baris };
  };

  return (
    <div className="jdp" ref={akar}>
      <div className="jdp__papan">
        <article className="jdp__kertas" aria-label={`Jadwal pelaksanaan ${kini.title}`}>
          {/* ================= KIRI: jadwal ================= */}
          <section className="jdp__jadwal" aria-label="Jadwal">
            <header className="jdp__kepala">
              <div className="jdp__kepalakiri">
                <p className="jdp__label">
                  Jadwal pelaksanaan pekerjaan perencanaan <span>·</span> No. {kode}
                </p>
                <PilihMenu
                  label="Pilih proyek"
                  nilai={kini.id}
                  opsi={(semua ?? []).map((p) => ({ nilai: p.id, label: p.title }))}
                  onUbah={(v) => {
                    kabar.current?.(null);
                    pilih(v);
                  }}
                  pemicu={
                    <button type="button" className="jdp__judul">
                      <span>{kini.title}</span>
                      <Ikon ikon={CaretDown} ukuran={18} />
                    </button>
                  }
                />
              </div>
              <div className="jdp__kepalakanan">
                <div
                  className={`jdp__capaian${muatCapaian ? " is-muat" : ""}`}
                  aria-busy={muatCapaian || undefined}
                  style={{ "--jdp-nyata": `${capTampil?.a ?? 0}%`, "--jdp-rencana": `${capTampil?.r ?? 0}%` } as CSSProperties}
                  {...ket(() => ({
                    judul: `Prestasi s.d. ${tglPanjang(kiniMs)} · rencana / realisasi`,
                    baris: tahap.map((t) => ({
                      label: `${t.kode} ${t.label}`,
                      nilai: `${Math.round(rencanaTahap(t, kiniAkhir) * 100)}% / ${Math.round(realisasiTahap(t, kiniAkhir, kiniAkhir) * 100)}%`,
                    })),
                  }))}
                >
                  <span className="jdp__cap">
                    <small>Rencana</small>
                    <b>
                      {capTampil ? <Hitung nilai={capTampil.r} hidup format={(v) => `${Math.round(v)}%`} /> : "—"}
                    </b>
                  </span>
                  <span className="jdp__cap is-utama">
                    <small>Realisasi</small>
                    <b>
                      {capTampil ? <Hitung nilai={capTampil.a} hidup format={(v) => `${Math.round(v)}%`} /> : "—"}
                    </b>
                  </span>
                  <span className={`jdp__cap is-dev${devTampil < 0 ? " is-telat" : devTampil > 0 ? " is-maju" : ""}`}>
                    <small>{devTampil < 0 ? "Terlambat" : devTampil > 0 ? "Lebih cepat" : "Deviasi"}</small>
                    <b>
                      {capTampil ? <Hitung nilai={devTampil} hidup format={(v) => tandaPersen(v / 100)} /> : "—"}
                    </b>
                  </span>
                  <i className="jdp__capmistar" aria-hidden="true" />
                </div>
                <div className="jdp__stempel" ref={stempelRef}>
                  <span>Tahap kini</span>
                  <PilihTeks
                    judul="Tahap pipeline proyek"
                    nilai={kini.pipelineStage ?? ""}
                    opsi={TAHAP}
                    onUbah={gantiTahap}
                  />
                </div>
              </div>
            </header>

            <div className="jdp__tabel" ref={tabelRef} role="table" aria-label="Jadwal pelaksanaan" style={{ "--jdp-kini": `${posKini}%` } as CSSProperties}>
              {/* Lembar cetak: kepala, badan, dan rekap — wilayah yang dilintasi
                  kereta PLOTTER saat proyek atau tahap berganti. */}
              <div className="jdp__cetak">
                {/* Kepala kolom: No · Uraian · bulan · Kemajuan */}
                <div className="jdp__th" role="row">
                  <span role="columnheader">No.</span>
                  <span role="columnheader">Uraian pekerjaan</span>
                  <span role="columnheader" className="jdp__thwaktu">
                    <span className={`jdp__bulan is-${modeBulan}`} ref={thWaktuRef}>
                      {j.bulan.map((b, i) => {
                        const bulanKe = new Date(b.awal).getMonth();
                        const tampil = modeBulan !== "kuartal" || bulanKe % 3 === 0;
                        const iniBulan = b.awal <= kiniMs && kiniMs < (j.bulan[i + 1]?.awal ?? j.akhir);
                        return (
                          <span
                            key={b.awal}
                            className={iniBulan ? "is-kini" : undefined}
                            style={{ width: `${b.lebar}%` }}
                            title={`${BULAN[bulanKe]} ${new Date(b.awal).getFullYear()}`}
                          >
                            {tampil ? (modeBulan === "pendek" ? b.label : b.label.slice(0, 1)) : ""}
                            {(b.tahun !== null || (i === 0 && modeBulan !== "pendek")) && modeBulan !== "kuartal" ? (
                              <small>{modeBulan === "pendek" ? new Date(b.awal).getFullYear() : `’${String(new Date(b.awal).getFullYear()).slice(2)}`}</small>
                            ) : null}
                          </span>
                        );
                      })}
                    </span>
                    <span className="jdp__pita">
                      {/* Mistar minggu: satu takik tiap Senin. */}
                      {minggu.map((t) => (
                        <i key={t} className="jdp__minggu" style={{ left: `${pos(t)}%` }} />
                      ))}
                      <i
                        className="jdp__kinitanda"
                        style={{ left: `${posKini}%` }}
                        {...ket(() => ({ judul: "Hari ini", baris: [{ label: "Tanggal", nilai: tglPanjang(kiniMs) }] }))}
                      />
                      {tPreview !== null && (
                        <i
                          className="jdp__tenggattanda"
                          style={{ left: `${pos(tPreview + HARI / 2)}%` }}
                          {...ket(() => ({ judul: "Tenggat preview", baris: [{ label: tglPanjang(tPreview), nilai: sisa(tPreview) }] }))}
                        />
                      )}
                      {tFinal !== null && (
                        <i
                          className="jdp__tenggattanda jdp__tenggattanda--final"
                          style={{ left: `${pos(tFinal + HARI / 2)}%` }}
                          {...ket(() => ({ judul: "Tenggat desain final", baris: [{ label: tglPanjang(tFinal), nilai: sisa(tFinal) }] }))}
                        />
                      )}
                      <span className="jdp__bidiktag" ref={bidikTagRef} aria-hidden="true" />
                    </span>
                  </span>
                  <span role="columnheader" className="jdp__thket">Kemajuan</span>
                </div>

                <div className="jdp__gulir">
                  <div className="jdp__badan" onPointerEnter={bidikMasuk} onPointerMove={bidikGerak} onPointerLeave={bidikLepas}>
                    {/* Lapis kolom waktu: pita bulan berselang, kisi, garis tenggat, pita hari ini, bidik. */}
                    <div className="jdp__lapis" ref={lapisRef} aria-hidden="true">
                      {j.bulan.map((b, i) =>
                        i % 2 === 1 ? <i key={`z${b.awal}`} className="jdp__zebra" style={{ left: `${pos(b.awal)}%`, width: `${b.lebar}%` }} /> : null,
                      )}
                      {j.bulan.slice(1).map((b) => (
                        <i key={b.awal} className="jdp__kisi" style={{ left: `${pos(b.awal)}%` }} />
                      ))}
                      {tPreview !== null && <i className="jdp__tenggatgaris" style={{ left: `${pos(tPreview + HARI / 2)}%` }} />}
                      {tFinal !== null && <i className="jdp__tenggatgaris jdp__tenggatgaris--final" style={{ left: `${pos(tFinal + HARI / 2)}%` }} />}
                      <i className="jdp__kinigaris" style={{ left: `${posKini}%` }} />
                      <div className="jdp__bidik" ref={bidikRef} />
                    </div>

                    {/* ---- A  TAHAP PEKERJAAN ---- */}
                    <div className="jdp__seksi" role="row">
                      <span role="cell" className="jdp__huruf">A</span>
                      <span role="cell" className="jdp__seksijudul">
                        Tahap pekerjaan
                        <span className="jdp__prestasibidik" ref={prestasiBidikRef} aria-hidden="true" />
                      </span>
                      <span role="cell" />
                      <span role="cell" className="jdp__seksiket">
                        {muatTugas ? "…" : `${tugas.filter((x) => x.status === "selesai").length}/${tugas.length} tugas`}
                      </span>
                    </div>
                    <div className="jdp__blok" ref={blokRef} style={{ flexGrow: tahap.length }}>
                      <KurvaPrestasi lapis="bidang" simpul={simpul} kunci={kini.id} ket={ket} />
                      {tahap.map((t, i) => (
                        <div
                          key={t.nilai}
                          role="row"
                          className={`jdp__baris jdp__baris--tahap is-${t.keadaan}${t.nilai === aktif.nilai ? " is-pilih" : ""}${t.telat ? " is-telat" : ""}`}
                        >
                          <span role="cell" className="jdp__no">{t.kode}</span>
                          <span role="cell" className="jdp__sel-uraian">
                            <button
                              type="button"
                              className="jdp__uraian jdp__uraian--tahap"
                              aria-pressed={t.nilai === aktif.nilai}
                              tabIndex={t.nilai === aktif.nilai ? 0 : -1}
                              onClick={() => setTahapPilih(t.nilai)}
                              onKeyDown={(e) => tombolTahap(e, i)}
                            >
                              <b>{t.label}</b>
                              {t.keadaan === "kini" && <em>kini</em>}
                            </button>
                          </span>
                          <span role="cell" className="jdp__waktu">
                            {t.rentang && (
                              <span
                                className={`jdp__batang${t.rentang.sumber === "tenggat" ? " is-turunan" : ""}`}
                                style={{ left: `${pos(t.rentang.a)}%`, width: `${Math.max(0.8, pos(t.rentang.b) - pos(t.rentang.a))}%` }}
                                {...ket(ketTahap(t))}
                              >
                                <span className="jdp__rencana" />
                                <span className="jdp__real" style={{ width: `${t.persen}%` }}>
                                  {t.keadaan === "kini" && t.persen > 0 && t.persen < 100 && <i className="jdp__ujung" />}
                                </span>
                              </span>
                            )}
                            {!t.rentang && t.tonggak && (
                              <span
                                className={`jdp__tonggak${t.keadaan === "selesai" || (t.tonggak.t <= kiniMs && t.keadaan !== "rencana") ? " is-tercapai" : ""}`}
                                style={{ left: `${pos(t.tonggak.t + HARI / 2)}%` }}
                                {...ket(ketTahap(t))}
                              />
                            )}
                            {/* Takik tenggat tiap tugas di batang tahapnya. */}
                            {t.rentang &&
                              t.isi.map((x) => {
                                const due = ms(x.dueDate);
                                if (due === null) return null;
                                const lewat = x.status !== "selesai" && due < kiniMs;
                                return (
                                  <i
                                    key={x.id}
                                    className={`jdp__tik is-${x.status === "selesai" ? "selesai" : lewat ? "lewat" : "buka"}`}
                                    data-tugas={x.id}
                                    style={{ left: `${pos(due + HARI / 2)}%` }}
                                    {...ketSorot(x.id, () => ketTugas(x))}
                                  />
                                );
                              })}
                          </span>
                          <span role="cell" className="jdp__ket">
                            {muatTugas ? (
                              <>
                                <span className="jdp__redup">—</span>
                                <small className="jdp__redup">memuat</small>
                              </>
                            ) : (
                              <>
                                {t.isi.length || t.keadaan === "selesai" ? (
                                  <b>
                                    <Hitung nilai={t.persen} hidup format={(v) => `${Math.round(v)}%`} />
                                  </b>
                                ) : (
                                  <span className="jdp__redup">—</span>
                                )}
                                <small>{t.isi.length ? `${t.selesai}/${t.isi.length}` : t.tonggak ? tglPendek(t.tonggak.t) : "tanpa tugas"}</small>
                              </>
                            )}
                            <i className="jdp__mistar" style={{ "--jdp-p": `${muatTugas ? 0 : t.persen}%` } as CSSProperties} aria-hidden="true" />
                          </span>
                        </div>
                      ))}
                      <i className="jdp__penanda" ref={penandaRef} aria-hidden="true" />
                      <KurvaPrestasi lapis="garis" simpul={simpul} kunci={kini.id} ket={ket} />
                    </div>

                    {/* ---- B  PERSONIL ---- */}
                    <div className="jdp__seksi" role="row" id="tim-bayaran">
                      <span role="cell" className="jdp__huruf">B</span>
                      <span role="cell" className="jdp__seksijudul">
                        Personil
                        {jatuhTempo.length > 0 && (
                          <button
                            type="button"
                            className="jdp__tempo"
                            onClick={() => bukaBayar(jatuhTempo[0]!.p, jatuhTempo[0]!.t)}
                            aria-label={`${jatuhTempo.length} bayaran tim jatuh tempo — bayar yang pertama`}
                          >
                            {jatuhTempo.length} jatuh tempo
                          </button>
                        )}
                      </span>
                      <span role="cell" />
                      <span role="cell" className="jdp__seksiket">
                        <button type="button" className="jdp__tambahorang" onClick={() => setTugaskan({ mode: "baru" })}>
                          <Ikon ikon={Plus} ukuran={12} />
                          Tugaskan
                        </button>
                      </span>
                    </div>
                    {d.tim === null ? (
                      <div className="jdp__baris jdp__baris--kosong" role="row">
                        <span role="cell" />
                        <span role="cell" className="jdp__redup">Memuat tim…</span>
                      </div>
                    ) : orang.length === 0 ? (
                      <div className="jdp__baris jdp__baris--kosong" role="row">
                        <span role="cell" />
                        <span role="cell" className="jdp__redup">Belum ada yang ditugaskan</span>
                      </div>
                    ) : (
                      orang.map(({ p, rentang, tanda, tugasn, milik }, i) => {
                        const tempo = p.tahap.find((t) => t.keadaan === "jatuh_tempo");
                        return (
                          <div key={p.id} role="row" className="jdp__baris jdp__baris--orang">
                            <span role="cell" className="jdp__no">B{i + 1}</span>
                            <span role="cell" className="jdp__sel-uraian">
                              <button
                                type="button"
                                className="jdp__uraian jdp__uraian--orang"
                                onClick={() => setTugaskan({ mode: "ubah", p })}
                              >
                                <span className="jdp__peran">{LABEL_PERAN[p.role]}</span>
                                <b>{p.teamMemberName}</b>
                              </button>
                            </span>
                            <span role="cell" className="jdp__waktu">
                              {rentang && (
                                <span
                                  className={`jdp__garisorang${rentang.sendiri ? "" : " is-proyek"}`}
                                  style={{ left: `${pos(rentang.a)}%`, width: `${Math.max(0.6, pos(rentang.b) - pos(rentang.a))}%` }}
                                  {...ket(() => ({
                                    judul: `${LABEL_PERAN[p.role]} · ${p.teamMemberName}`,
                                    baris: [
                                      { label: rentang.sendiri ? "Rentang tugasnya" : "Sepanjang proyek", nilai: `${tglPendek(rentang.a)} – ${tglPendek(rentang.b - HARI)}` },
                                      { label: "Tugas di proyek ini", nilai: `${milik.filter((x) => x.status === "selesai").length} selesai dari ${tugasn}` },
                                      { label: "Bagian", nilai: p.pctBerlaku === null ? "belum ditentukan" : `${p.pctBerlaku.toLocaleString("id-ID")}%` },
                                    ],
                                  }))}
                                />
                              )}
                              {/* Beban kerja: satu ruas per tugas orang ini (dibuat → tenggat). */}
                              {milik.map((x) => {
                                const a = ms(x.createdAt) ?? ms(x.dueDate);
                                const b = ms(x.dueDate) ?? a;
                                if (a === null || b === null) return null;
                                const awal = awalHari(Math.min(a, b));
                                const akhir = Math.max(awal + HARI, awalHari(Math.max(a, b)) + HARI);
                                const lewat = x.status !== "selesai" && (ms(x.dueDate) ?? Infinity) < kiniMs;
                                return (
                                  <i
                                    key={x.id}
                                    className={`jdp__ruas is-${x.status === "selesai" ? "selesai" : lewat ? "lewat" : "buka"}`}
                                    data-tugas={x.id}
                                    style={{ left: `${pos(awal)}%`, width: `${Math.max(0.5, pos(akhir) - pos(awal))}%` }}
                                    {...ketSorot(x.id, () => ketTugas(x))}
                                  />
                                );
                              })}
                              {tanda.map(({ t, kapan }) => {
                                if (kapan === null) return null;
                                const Benda = t.keadaan === "dibayar" ? "span" : "button";
                                return (
                                  <Benda
                                    key={t.tahap}
                                    {...(Benda === "button" ? { type: "button" as const, onClick: () => bukaBayar(p, t) } : {})}
                                    className={`jdp__tanda is-${t.keadaan}${tercap === `${p.id}:${t.tahap}` ? " is-tercap" : ""}`}
                                    style={{ left: `${pos(kapan + HARI / 2)}%` }}
                                    aria-label={`Bayaran tahap ${t.tahap} ${p.teamMemberName}: ${t.keadaan === "dibayar" ? "dibayar" : t.keadaan === "jatuh_tempo" ? "jatuh tempo" : "menunggu"}`}
                                    {...ket(() => ({
                                      judul: `Bayaran tahap ${t.tahap} · ${p.teamMemberName}`,
                                      baris: [
                                        { label: "Nominal", nilai: formatRupiah((t.keadaan === "dibayar" ? t.dibayar : t.nominal) ?? 0) },
                                        {
                                          label: t.keadaan === "dibayar" ? "Dibayar" : t.keadaan === "jatuh_tempo" ? "Jatuh tempo" : t.tahap === "awal" ? "Saat DP klien" : "Saat desain selesai",
                                          nilai: t.keadaan === "jatuh_tempo" ? "klik untuk bayar" : tglPanjang(kapan),
                                        },
                                      ],
                                    }))}
                                  >
                                    {t.keadaan === "dibayar" && <Ikon ikon={Check} ukuran={9} />}
                                  </Benda>
                                );
                              })}
                            </span>
                            <span role="cell" className="jdp__ket jdp__ket--orang">
                              {tempo ? (
                                <>
                                  <b>{jutaan(tempo.nominal ?? 0)}</b>
                                  <button
                                    type="button"
                                    className="jdp__bayar"
                                    onClick={() => bukaBayar(p, tempo)}
                                    aria-label={`Bayar tahap ${tempo.tahap} ${p.teamMemberName} ${formatRupiah(tempo.nominal ?? 0)}`}
                                  >
                                    Bayar
                                  </button>
                                </>
                              ) : p.hak === null ? (
                                <small className="jdp__amber" title="Persen peran ini belum ditentukan di Aturan Fee Tim">
                                  % belum ada
                                </small>
                              ) : (
                                <>
                                  <b>{jutaan(p.hak)}</b>
                                  <small>{p.terutang ? `sisa ${jutaan(p.terutang)}` : "lunas"}</small>
                                </>
                              )}
                            </span>
                          </div>
                        );
                      })
                    )}

                    {/* ---- C  KEUANGAN ---- */}
                    <div className="jdp__seksi" role="row">
                      <span role="cell" className="jdp__huruf">C</span>
                      <span role="cell" className="jdp__seksijudul">Keuangan</span>
                      <span role="cell" />
                      <span role="cell" className="jdp__seksiket">{kontrak ? `kontrak ${jutaan(kontrak)}` : "tanpa kontrak"}</span>
                    </div>
                    <div role="row" className="jdp__baris jdp__baris--termin">
                      <span role="cell" className="jdp__no">C1</span>
                      <span role="cell" className="jdp__sel-uraian">
                        <a className="jdp__uraian" href={`/admin/keuangan/tagihan?proyek=${idKini}`}>
                          <b>Termin tagihan</b>
                        </a>
                      </span>
                      <span role="cell" className="jdp__waktu">
                        {tagihanUrut.map((t, i) => {
                          const kapan = ms(t.dueDate ?? t.paidAt ?? null);
                          if (kapan === null) return null;
                          const lewat = t.status === "terbit" && kapan < kiniMs;
                          const jenis = t.status === "lunas" ? "lunas" : lewat ? "lewat" : t.status === "terbit" ? "terbit" : "draf";
                          return (
                            <a
                              key={t.id}
                              className={`jdp__paku is-${jenis}`}
                              href={`/admin/keuangan/tagihan?termin=${encodeURIComponent(t.id)}`}
                              style={{ left: `${pos(kapan + HARI / 2)}%` }}
                              aria-label={`${t.label}: ${formatRupiah(t.amount)}, ${jenis}`}
                              {...ket(() => ({
                                judul: t.label || `Termin ${i + 1}`,
                                baris: [
                                  { label: "Jumlah", nilai: formatRupiah(t.amount) },
                                  { label: t.status === "lunas" && t.paidAt ? "Lunas" : "Jatuh tempo", nilai: tglPanjang(ms(t.status === "lunas" && t.paidAt ? t.paidAt : t.dueDate ?? t.paidAt ?? null) ?? kapan) },
                                  { label: "Keadaan", nilai: jenis === "lunas" ? "Lunas" : jenis === "lewat" ? `Lewat tempo · ${sisa(kapan).replace("lewat ", "")}` : jenis === "terbit" ? "Terbit, menunggu klien" : "Draf" },
                                ],
                              }))}
                            >
                              {jenis === "lunas" && <Ikon ikon={Check} ukuran={8} />}
                            </a>
                          );
                        })}
                      </span>
                      <span role="cell" className="jdp__ket">
                        <b>
                          {tagihan.filter((t) => t.status === "lunas").length}/{tagihan.length}
                        </b>
                        <small>lunas</small>
                      </span>
                    </div>
                    <div role="row" className="jdp__baris jdp__baris--uang">
                      <span role="cell" className="jdp__no">C2</span>
                      <span role="cell" className="jdp__sel-uraian">
                        <a className="jdp__uraian" href={`/admin/keuangan/terima?proyek=${idKini}`}>
                          <b>Uang masuk</b>
                          <span className="jdp__redup">vs keluar</span>
                        </a>
                      </span>
                      <span role="cell" className="jdp__waktu">
                        <svg className="jdp__kurva" viewBox="0 0 1000 100" preserveAspectRatio="none" aria-hidden="true">
                          <defs>
                            <mask id={`${idSvg}-laba`} maskUnits="userSpaceOnUse" x="0" y="0" width="1000" height="100">
                              <rect width="1000" height="100" fill="white" />
                              <path d={kurva.keluarIsi} fill="black" />
                            </mask>
                            <mask id={`${idSvg}-rugi`} maskUnits="userSpaceOnUse" x="0" y="0" width="1000" height="100">
                              <rect width="1000" height="100" fill="white" />
                              <path d={kurva.isi} fill="black" />
                            </mask>
                          </defs>
                          {kontrak > 0 && <line className="jdp__kontrakgaris" x1="0" x2="1000" y1={kurva.kontrakY} y2={kurva.kontrakY} />}
                          <path className="jdp__kurvaisi" d={kurva.isi} />
                          <path className="jdp__labaisi" d={kurva.isi} mask={`url(#${idSvg}-laba)`} />
                          <path className="jdp__rugiisi" d={kurva.keluarIsi} mask={`url(#${idSvg}-rugi)`} />
                          <path className="jdp__keluargaris" d={kurva.keluarGaris} />
                          <path className="jdp__kurvagaris" d={kurva.garis} />
                        </svg>
                        {kurva.titik.map(({ x, y, b, t: kapan }) => (
                          <i
                            key={b.id}
                            className="jdp__titik is-masuk"
                            style={{ left: `${x / 10}%`, top: `${y}%` }}
                            {...ket(() => ({
                              judul: `Uang masuk · ${tglPanjang(kapan)}`,
                              baris: [
                                { label: b.kind === "dp" ? "DP" : b.kind === "pelunasan" ? "Pelunasan" : "Termin", nilai: formatRupiah(b.amount) },
                                { label: "s.d. tanggal ini", nilai: formatRupiah(uangDiTanggal(kapan)) },
                                { label: "Keluar s.d. tanggal ini", nilai: formatRupiah(keluarDiTanggal(kapan)) },
                                ...(b.receiver ? [{ label: "Diterima", nilai: b.receiver }] : []),
                              ],
                            }))}
                          />
                        ))}
                      </span>
                      <span role="cell" className="jdp__ket">
                        <b>
                          <Hitung nilai={diterima} hidup format={jutaan} />
                        </b>
                        <small>{persenDiterima !== null ? `${persenDiterima}% kontrak` : "tanpa kontrak"}</small>
                        <span className="jdp__uangbidik" ref={uangBidikRef} aria-hidden="true" />
                      </span>
                    </div>
                    <div role="row" className="jdp__baris jdp__baris--biaya">
                      <span role="cell" className="jdp__no">C3</span>
                      <span role="cell" className="jdp__sel-uraian">
                        <a className="jdp__uraian" href="/admin/keuangan/keluar">
                          <b>Biaya keluar</b>
                        </a>
                      </span>
                      <span role="cell" className="jdp__waktu">
                        {keluarTampak.map((b) => {
                          const kapan = ms(b.incurredOn);
                          if (kapan === null) return null;
                          const besar = Math.max(...keluarTampak.map((x) => x.amount), 1);
                          const ukuran = 6 + Math.round(Math.sqrt(b.amount / besar) * 6);
                          return (
                            <i
                              key={b.id}
                              className="jdp__titik is-keluar"
                              style={{ left: `${pos(kapan + HARI / 2)}%`, "--jdp-ukuran": `${ukuran}px` } as CSSProperties}
                              {...ket(() => ({
                                judul: `Biaya · ${tglPanjang(kapan)}`,
                                baris: [
                                  { label: b.label, nilai: formatRupiah(b.amount) },
                                  ...(b.teamMemberName ? [{ label: "Dibayar ke", nilai: b.teamMemberName }] : []),
                                ],
                              }))}
                            />
                          );
                        })}
                      </span>
                      <span role="cell" className="jdp__ket">
                        <b>{jutaan(totalKeluar)}</b>
                        <small title={keluar.length > keluarTampak.length ? `${keluar.length - keluarTampak.length} catatan di luar rentang jadwal` : undefined}>
                          {keluar.length}×
                        </small>
                      </span>
                    </div>
                  </div>
                </div>

                {/* REKAP PRESTASI — baris dasar setiap lembar time schedule:
                    prestasi kumulatif per bulan, rencana dan realisasi. */}
                <div className="jdp__rekap" role="rowgroup" aria-label="Prestasi kumulatif per bulan">
                  {(["rencana", "nyata"] as const).map((k) => (
                    <div key={k} role="row" className={`jdp__rekapbaris is-${k}`}>
                      <span role="cell" className="jdp__no">{k === "rencana" ? "R" : "A"}</span>
                      <span role="cell" className="jdp__rekaplabel">
                        <i aria-hidden="true" />
                        {k === "rencana" ? "Rencana kumulatif" : "Realisasi kumulatif"}
                      </span>
                      <span role="cell" className="jdp__rekapbulan">
                        {rekap.map((m, i) => {
                          const v = k === "rencana" ? m.r : m.a;
                          return (
                            <span
                              key={m.awal}
                              className={`${m.kini ? "is-kini" : ""}${i % 2 === 1 ? " is-genap" : ""}`}
                              style={{ width: `${m.lebar}%` }}
                              {...ket(() => ({
                                judul: `${m.kini ? "Bulan ini" : "Akhir"} ${tglBulan(m.awal)}`,
                                baris: [
                                  { label: m.kini ? "Rencana akhir bulan" : "Rencana kumulatif", nilai: `${Math.round(m.r * 100)}%` },
                                  { label: m.kini ? "Realisasi s.d. hari ini" : "Realisasi kumulatif", nilai: m.a === null ? "belum sampai" : `${Math.round(m.a * 100)}%` },
                                ],
                              }))}
                            >
                              {v !== null && rekapTampil(i) ? Math.round(v * 100) : ""}
                            </span>
                          );
                        })}
                      </span>
                      <span role="cell" className="jdp__ket">
                        {!capTampil ? (
                          <span className="jdp__redup">—</span>
                        ) : k === "rencana" ? (
                          <>
                            <b>{capTampil.r}%</b>
                            <small>s.d. kini</small>
                          </>
                        ) : (
                          <>
                            <b>{capTampil.a}%</b>
                            <small className={devTampil < 0 ? "jdp__amber" : undefined}>{tandaPersen(devTampil / 100)}</small>
                          </>
                        )}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Kereta PLOTTER: hanya tampil selama lembar baru dicetak. */}
                <div className="jdp__plot" ref={plotRef} aria-hidden="true">
                  <i className="jdp__tirai" />
                  <i className="jdp__kereta" />
                </div>
              </div>

              <footer className="jdp__legenda" aria-label="Keterangan simbol">
                <span className="jdp__legendajudul">Keterangan</span>
                <span><i className="jdp__l-rencana" />Rencana</span>
                <span><i className="jdp__l-real" />Realisasi</span>
                <span><i className="jdp__l-kurva" />Kurva S</span>
                <span><i className="jdp__l-tik" />Tenggat tugas</span>
                <span><i className="jdp__l-tonggak" />Tonggak</span>
                <span><i className="jdp__l-paku" />Termin</span>
                <span><i className="jdp__l-tanda" />Bayaran</span>
                <span className="jdp__legendakini"><i className="jdp__l-kini" />Hari ini {tglPendek(kiniMs)}</span>
              </footer>
            </div>
          </section>

          {/* ================= KANAN: kop gambar ================= */}
          <aside className="jdp__kop" aria-label="Kop gambar">
            <div className="jdp__sel jdp__sel--studio">
              <span className="jdp__monogram" aria-hidden="true">
                {studio?.logoUrl ? <img src={studio.logoUrl} alt="" /> : inisial(namaStudio)}
              </span>
              <span className="jdp__selisi">
                <small>Perencana</small>
                <b>{namaStudio}</b>
              </span>
              <span className="jdp__nolembar">
                <small>Lembar</small>
                <b>JP-{kode}</b>
              </span>
            </div>

            <dl className="jdp__sel jdp__grid">
              <div>
                <dt>Pemilik</dt>
                <dd>{kini.client || <span className="jdp__redup">belum diisi</span>}</dd>
              </div>
              <div>
                <dt>Lokasi</dt>
                <dd>{kini.city || <span className="jdp__redup">—</span>}</dd>
              </div>
              <div>
                <dt>Jenis</dt>
                <dd>{CATEGORY_LABELS[kini.category as keyof typeof CATEGORY_LABELS] ?? kini.category}</dd>
              </div>
              <div>
                <dt>Paket</dt>
                <dd>{paketIni ? paketIni.name : <span className="jdp__redup">tanpa paket</span>}</dd>
              </div>
            </dl>

            <dl className="jdp__sel jdp__grid jdp__grid--uang">
              <div>
                <dt>Nilai kontrak</dt>
                <dd title={formatRupiah(kontrak)}>{kontrak ? jutaan(kontrak) : "—"}</dd>
              </div>
              <div>
                <dt>Diterima{persenDiterima !== null ? ` · ${persenDiterima}%` : ""}</dt>
                <dd title={formatRupiah(diterima)}>
                  <Hitung nilai={diterima} hidup format={jutaan} />
                </dd>
              </div>
              <div>
                <dt>Biaya keluar</dt>
                {muatUang ? (
                  <dd className="jdp__redup">—</dd>
                ) : (
                  <dd title={formatRupiah(totalKeluar)}>{jutaan(totalKeluar)}</dd>
                )}
              </div>
              <div>
                <dt>Laba kas</dt>
                {muatUang ? (
                  <dd className="jdp__redup">—</dd>
                ) : (
                  <dd title={formatRupiah(diterima - totalKeluar)} className={diterima - totalKeluar < 0 ? "jdp__amber" : undefined}>
                    {diterima - totalKeluar < 0 ? "−" : ""}
                    {jutaan(Math.abs(diterima - totalKeluar))}
                  </dd>
                )}
              </div>
            </dl>

            {/* NERACA KAS: dua lajur berskala nilai kontrak — uang masuk dan
                biaya keluar; laba kas = selisih keduanya. */}
            <div
              className={`jdp__sel jdp__neraca${totalKeluar > diterima ? " is-rugi" : ""}${muatUang ? " is-muat" : ""}`}
              style={
                {
                  "--jdp-masuk": `${(diterima / skalaUang) * 100}%`,
                  "--jdp-keluar": `${(totalKeluar / skalaUang) * 100}%`,
                } as CSSProperties
              }
              {...ket(() => ({
                judul: "Neraca kas proyek",
                baris: [
                  { label: "Nilai kontrak", nilai: formatRupiah(kontrak) },
                  { label: "Uang masuk", nilai: formatRupiah(diterima) },
                  { label: "Biaya keluar", nilai: formatRupiah(totalKeluar) },
                  { label: diterima - totalKeluar < 0 ? "Rugi kas" : "Laba kas", nilai: formatRupiah(Math.abs(diterima - totalKeluar)) },
                  ...(kontrak > 0 ? [{ label: "Belum ditagih/diterima", nilai: formatRupiah(Math.max(0, kontrak - diterima)) }] : []),
                ],
              }))}
            >
              <span className="jdp__lajur is-masuk">
                <small>Masuk</small>
                <i />
              </span>
              <span className="jdp__lajur is-keluar">
                <small>Keluar</small>
                <i />
              </span>
            </div>

            <div className="jdp__sel jdp__sel--lingkup">
              <p className="jdp__sellabel">
                Lingkup kerja
                <button type="button" className="jdp__ubah" onClick={() => setLingkupBuka(true)}>
                  <Ikon ikon={NotePencil} ukuran={12} />
                  Ubah
                </button>
              </p>
              <p className="jdp__lingkup">{kini.scopeOfWork || <span className="jdp__redup">Belum diisi — tekan Ubah.</span>}</p>
            </div>

            <dl className="jdp__sel jdp__grid jdp__grid--tenggat">
              <div>
                <dt>
                  <i className="jdp__l-tenggat" aria-hidden="true" />
                  Preview
                </dt>
                <dd>
                  {tPreview !== null ? (
                    <>
                      {tglPendek(tPreview)}{" "}
                      <small className={tPreview < kiniMs ? "jdp__amber" : undefined}>{sisa(tPreview)}</small>
                    </>
                  ) : (
                    <span className="jdp__redup">—</span>
                  )}
                </dd>
              </div>
              <div>
                <dt>
                  <i className="jdp__l-tenggat jdp__l-tenggat--final" aria-hidden="true" />
                  Final
                </dt>
                <dd>
                  {tFinal !== null ? (
                    <>
                      {tglPendek(tFinal)}{" "}
                      <small className={tFinal < kiniMs && iKini < 5 ? "jdp__amber" : undefined}>{sisa(tFinal)}</small>
                    </>
                  ) : (
                    <span className="jdp__redup">—</span>
                  )}
                </dd>
              </div>
            </dl>

            <div className="jdp__sel jdp__sel--tugas">
              <p className="jdp__sellabel">
                Tugas · {aktif.kode} {aktif.label}
                <span>{aktif.isi.length ? `${aktif.selesai}/${aktif.isi.length}` : ""}</span>
              </p>
              <p className="jdp__tugasinfo" style={{ "--jdp-p": `${muatTugas ? 0 : aktif.persen}%` } as CSSProperties}>
                <span>
                  {muatTugas
                    ? "—"
                    : aktif.rentang
                      ? `${tglPendek(aktif.rentang.a)} – ${tglPendek(aktif.rentang.b - HARI)}`
                      : aktif.tonggak
                        ? `${aktif.tonggak.ket} · ${tglPendek(aktif.tonggak.t)}`
                        : "belum berjadwal"}
                </span>
                <span>
                  {muatTugas ? "memuat…" : `rencana ${Math.round(rencanaTahap(aktif, kiniAkhir) * 100)}% · real ${aktif.persen}%`}
                </span>
                <i aria-hidden="true" />
              </p>
              <ul className="jdp__tugas" ref={daftarRef}>
                {muatTugas ? (
                  <li className="jdp__redup">Memuat tugas…</li>
                ) : aktifTugas.length === 0 ? (
                  <li className="jdp__tugaskosong">Belum ada tugas di tahap ini.</li>
                ) : (
                  aktifTugas.map((t) => {
                    const tenggat = ms(t.dueDate);
                    const telat = t.status !== "selesai" && tenggat !== null && tenggat < kiniMs;
                    return (
                      <li
                        key={t.id}
                        className={`${t.status === "selesai" ? "is-selesai" : ""}${dicentang === t.id ? " is-baru" : ""}`}
                        data-tugas={t.id}
                        onPointerEnter={(e) => e.pointerType === "mouse" && sorot(t.id)}
                        onPointerLeave={(e) => e.pointerType === "mouse" && sorot(null)}
                      >
                        <button
                          type="button"
                          className="jdp__centang"
                          role="checkbox"
                          aria-checked={t.status === "selesai"}
                          aria-label={`${t.title} selesai`}
                          onClick={() => void centang(t)}
                        >
                          <svg viewBox="0 0 12 12" aria-hidden="true">
                            <path d="M2.5 6.2 5 8.6 9.6 3.6" pathLength={1} />
                          </svg>
                        </button>
                        <a href={`/admin/list-kerjaan?tugas=${encodeURIComponent(t.id)}`} className="jdp__tugasjudul">
                          {t.title}
                        </a>
                        <span className="jdp__pic" title={t.assigneeName ?? "Belum ada PIC"}>
                          {t.assigneeName ? inisial(t.assigneeName) : "—"}
                        </span>
                        <small className={telat ? "jdp__amber" : undefined}>
                          {tenggat === null ? "—" : t.status === "selesai" ? tglPendek(tenggat) : sisa(tenggat)}
                        </small>
                      </li>
                    );
                  })
                )}
              </ul>
              <form
                className="jdp__tulis"
                onSubmit={(e) => {
                  e.preventDefault();
                  void tambah();
                }}
              >
                <Ikon ikon={Plus} ukuran={12} />
                <input
                  value={tulis}
                  onChange={(e) => setTulis(e.currentTarget.value)}
                  placeholder={`Tulis tugas ${aktif.label}…`}
                  aria-label={`Tugas baru di tahap ${aktif.label}`}
                  maxLength={200}
                  disabled={menulis}
                />
                {tulis.trim() && (
                  <button type="submit" disabled={menulis}>
                    Tambah
                  </button>
                )}
              </form>
            </div>

            <div className="jdp__sel jdp__aksi">
              <a className="jdp__aksitombol" href={`/admin/proyek/klien?id=${idKini}`}>
                <Ikon ikon={ArsKunciRumah} ukuran={14} />
                Portal klien
              </a>
              <a className="jdp__aksitombol" href={`/admin/proyek/publik?id=${idKini}`}>
                <Ikon ikon={ArsBingkaiFoto} ukuran={14} />
                Halaman publik
              </a>
              <DropdownMenu
                trigger={
                  <button type="button" className="jdp__aksitombol jdp__aksilain" aria-label="Aksi lain proyek ini">
                    <Ikon ikon={DotsThree} ukuran={16} />
                  </button>
                }
                sections={[
                  {
                    label: "Keuangan",
                    items: [
                      { label: "Terima pembayaran", ikon: CoinIn, onSelect: () => navigate(`/admin/keuangan/terima?proyek=${idKini}`) },
                      { label: "Catat pengeluaran", ikon: CoinOut, onSelect: () => navigate("/admin/keuangan/keluar") },
                      { label: "Tagihan & termin", ikon: ArsTermin, onSelect: () => navigate(`/admin/keuangan/tagihan?proyek=${idKini}`) },
                    ],
                  },
                  {
                    label: "Unduh PDF",
                    items: [
                      { label: "Daftar tagihan — untuk klien", ikon: FilePdf, disabled: membuatPdf, onSelect: () => void pdf(unduhDaftarTagihan) },
                      { label: "Rincian biaya — internal", ikon: FilePdf, disabled: membuatPdf, onSelect: () => void pdf(unduhRincianBiaya) },
                    ],
                  },
                  ...(sudahTayang
                    ? [{ items: [{ label: "Lihat di situs", ikon: Globe, onSelect: () => window.open(`/proyek/${kini.slug}`, "_blank", "noopener") }] }]
                    : []),
                ]}
              />
            </div>
          </aside>
        </article>
      </div>

      <Keterangan kabar={kabar} />
      <DialogLingkup
        proyek={kini}
        paket={paket}
        buka={lingkupBuka}
        onTutup={() => setLingkupBuka(false)}
        onBerubah={() =>
          void daftarProyek()
            .then((l) => {
              tulisCache("proyek", l);
              setSemua(l);
            })
            .catch(() => {})
        }
      />
      <DialogTugaskan
        proyek={kini}
        daftar={tim}
        ubah={tugaskan}
        onTutup={() => setTugaskan(null)}
        onSelesai={() => muat(kini.id, ["tim"])}
        fokusCadangan={() =>
          [...(akar.current?.querySelectorAll<HTMLElement>(".jdp__uraian--orang") ?? [])].at(-1) ??
          akar.current?.querySelector<HTMLElement>(".jdp__tambahorang") ??
          null
        }
      />
      <DialogBayar bayar={bayar} onTutup={() => setBayar(null)} onSelesai={sesudahBayar} />
    </div>
  );
}

/* Kerangka memuat — papan dan lembar yang sama, tanpa isi. */
function Rangka() {
  return (
    <div className="jdp jdp--rangka" aria-busy="true">
      <div className="jdp__papan">
        <div className="jdp__kertas" />
      </div>
    </div>
  );
}

export function SatuProyekKit({ dibangunPada }: { dibangunPada?: string }) {
  return (
    <RequireAuth skeleton={<Rangka />}>
      <ToastProvider>
        <Isi dibangunPada={dibangunPada} />
      </ToastProvider>
    </RequireAuth>
  );
}
