import { navigate } from "astro:transitions/client";
import {
  useEffect,
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
  /* PRESTASI PEKERJAAN — seperti baris "prestasi s.d. hari ini" di laporan
     time schedule: rata-rata kemajuan ketujuh tahap (bobot sama). */
  const prestasi = Math.round(tahap.reduce((n, t) => n + t.persen, 0) / tahap.length);

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
      return { p, rentang, tanda, tugasn: milik.length };
    });
  }, [tim, tugas, awalProyek, akhirProyek, kiniMs, tDp, tFinal]);
  const jatuhTempo = tim.flatMap((p) => p.tahap.filter((t) => t.keadaan === "jatuh_tempo").map((t) => ({ p, t })));

  /* --- Uang ---------------------------------------------------------------------- */
  const kontrak = kini?.contractValue ?? 0;
  const diterima = d.bayar ? masuk.reduce((n, b) => n + b.amount, 0) : (kini?.paidTotal ?? 0);
  const totalKeluar = keluar.reduce((n, b) => n + b.amount, 0);
  const skalaUang = Math.max(kontrak, diterima, 1);

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
    return { garis: d, isi, titik, kontrakY: y(kontrak) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [masuk, j, skalaUang, kontrak, posKini]);

  /* --- PENA: ganti proyek / ganti tahap menarik realisasi dari kiri ---------------
     Hanya karena perbuatan: muatan pertama dan data yang datang menyusul tidak
     dianimasikan (jebakan #74). Kuncinya proyek + tahap, dan baru dihitung
     sesudah tugas proyek itu ada. */
  const kunciPena = kini && d.tugas ? `${kini.id}|${kini.pipelineStage ?? ""}` : null;
  const penaLalu = useRef<string | null>(null);
  useLayoutEffect(() => {
    if (!kunciPena) return;
    const lalu = penaLalu.current;
    penaLalu.current = kunciPena;
    if (lalu === null || lalu === kunciPena || !geraknya() || !akar.current) return;
    const el = akar.current;
    const opsi = { duration: 760, easing: LEMBUT };
    el.querySelectorAll<HTMLElement>(".jdp__real, .jdp__rencana").forEach((x) =>
      x.animate([{ clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0 0 0)" }], opsi),
    );
    el.querySelectorAll<SVGPathElement>(".jdp__kurvagaris").forEach((x) =>
      x.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], opsi),
    );
    el.querySelectorAll<HTMLElement>(".jdp__kurvaisi, .jdp__tonggak, .jdp__tanda, .jdp__paku, .jdp__titik").forEach((x) =>
      x.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 420, delay: 300, easing: LEMBUT, fill: "backwards" }),
    );
    el.querySelectorAll<HTMLElement>(".jdp__kinigaris").forEach((x) =>
      x.animate([{ transform: "scaleY(0)" }, { transform: "scaleY(1)" }], opsi),
    );
  }, [kunciPena]);

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
  const uangDiTanggal = (t: number) =>
    masuk.reduce((n, b) => ((ms(b.paidAt) ?? Infinity) <= t ? n + b.amount : n), 0);
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
  }
  function bidikLepas() {
    delete bidikRef.current?.dataset.tampil;
    delete bidikTagRef.current?.dataset.tampil;
    delete uangBidikRef.current?.dataset.tampil;
  }

  /* --- Perbuatan ----------------------------------------------------------------- */
  async function gantiTahap(baru: string) {
    if (!kini) return;
    try {
      await simpanProyek(kini.id, { pipelineStage: baru });
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
                  className="jdp__prestasi"
                  style={{ "--jdp-prestasi": `${prestasi}%` } as CSSProperties}
                  {...ket(() => ({
                    judul: "Prestasi pekerjaan",
                    baris: tahap.map((t) => ({ label: `${t.kode} ${t.label}`, nilai: `${t.persen}%` })),
                  }))}
                >
                  <span>Prestasi</span>
                  <b>
                    <Hitung nilai={prestasi} hidup format={(v) => `${Math.round(v)}%`} />
                  </b>
                  <i aria-hidden="true" />
                </div>
                <div className="jdp__stempel">
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
              {/* Kepala kolom: No · Uraian · bulan · Kemajuan */}
              <div className="jdp__th" role="row">
                <span role="columnheader">No.</span>
                <span role="columnheader">Uraian pekerjaan</span>
                <span role="columnheader" className="jdp__thwaktu">
                  <span className={`jdp__bulan is-${modeBulan}`} ref={thWaktuRef}>
                    {j.bulan.map((b, i) => {
                      const bulanKe = new Date(b.awal).getMonth();
                      const tampil = modeBulan !== "kuartal" || bulanKe % 3 === 0;
                      return (
                        <span key={b.awal} style={{ width: `${b.lebar}%` }} title={`${BULAN[bulanKe]} ${new Date(b.awal).getFullYear()}`}>
                          {tampil ? (modeBulan === "pendek" ? b.label : b.label.slice(0, 1)) : ""}
                          {(b.tahun !== null || (i === 0 && modeBulan !== "pendek")) && modeBulan !== "kuartal" ? (
                            <small>{modeBulan === "pendek" ? new Date(b.awal).getFullYear() : `’${String(new Date(b.awal).getFullYear()).slice(2)}`}</small>
                          ) : null}
                        </span>
                      );
                    })}
                  </span>
                  <span className="jdp__pita">
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
                  {/* Lapis kolom waktu: kisi bulan, garis tenggat, pita hari ini, bidik. */}
                  <div className="jdp__lapis" ref={lapisRef} aria-hidden="true">
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
                    <span role="cell" className="jdp__seksijudul">Tahap pekerjaan</span>
                    <span role="cell" />
                    <span role="cell" className="jdp__seksiket">
                      {muatTugas ? "…" : `${tugas.filter((x) => x.status === "selesai").length}/${tugas.length} tugas`}
                    </span>
                  </div>
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
                      </span>
                      <span role="cell" className="jdp__ket">
                        {t.isi.length || t.keadaan === "selesai" ? <b>{t.persen}%</b> : <span className="jdp__redup">—</span>}
                        <small>{t.isi.length ? `${t.selesai}/${t.isi.length}` : t.tonggak ? tglPendek(t.tonggak.t) : "tanpa tugas"}</small>
                      </span>
                    </div>
                  ))}

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
                    orang.map(({ p, rentang, tanda, tugasn }, i) => {
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
                                    { label: "Tugas di proyek ini", nilai: String(tugasn) },
                                    { label: "Bagian", nilai: p.pctBerlaku === null ? "belum ditentukan" : `${p.pctBerlaku.toLocaleString("id-ID")}%` },
                                  ],
                                }))}
                              />
                            )}
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
                        <span className="jdp__redup">kumulatif</span>
                      </a>
                    </span>
                    <span role="cell" className="jdp__waktu">
                      <svg className="jdp__kurva" viewBox="0 0 1000 100" preserveAspectRatio="none" aria-hidden="true">
                        {kontrak > 0 && <line className="jdp__kontrakgaris" x1="0" x2="1000" y1={kurva.kontrakY} y2={kurva.kontrakY} />}
                        <path className="jdp__kurvaisi" d={kurva.isi} />
                        <path className="jdp__kurvagaris" d={kurva.garis} pathLength={1} />
                      </svg>
                      {kurva.titik.map(({ x, y, b, t: kapan }) => {
                        return (
                          <i
                            key={b.id}
                            className="jdp__titik is-masuk"
                            style={{ left: `${x / 10}%`, top: `${y}%` }}
                            {...ket(() => ({
                              judul: `Uang masuk · ${tglPanjang(kapan)}`,
                              baris: [
                                { label: b.kind === "dp" ? "DP" : b.kind === "pelunasan" ? "Pelunasan" : "Termin", nilai: formatRupiah(b.amount) },
                                { label: "s.d. tanggal ini", nilai: formatRupiah(uangDiTanggal(kapan)) },
                                ...(b.receiver ? [{ label: "Diterima", nilai: b.receiver }] : []),
                              ],
                            }))}
                          />
                        );
                      })}
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

              <footer className="jdp__legenda" aria-label="Keterangan simbol">
                <span className="jdp__legendajudul">Keterangan</span>
                <span><i className="jdp__l-rencana" />Rencana</span>
                <span><i className="jdp__l-real" />Realisasi</span>
                <span><i className="jdp__l-tonggak" />Tonggak</span>
                <span><i className="jdp__l-tenggat" />Tenggat</span>
                <span><i className="jdp__l-paku" />Termin</span>
                <span><i className="jdp__l-tanda" />Bayaran tim</span>
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
                <dd title={formatRupiah(totalKeluar)}>{jutaan(totalKeluar)}</dd>
              </div>
              <div>
                <dt>Laba kas</dt>
                <dd title={formatRupiah(diterima - totalKeluar)} className={diterima - totalKeluar < 0 ? "jdp__amber" : undefined}>
                  {diterima - totalKeluar < 0 ? "−" : ""}
                  {jutaan(Math.abs(diterima - totalKeluar))}
                </dd>
              </div>
            </dl>

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
                      <li key={t.id} className={`${t.status === "selesai" ? "is-selesai" : ""}${dicentang === t.id ? " is-baru" : ""}`}>
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
