import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { RequireAuth } from "./RequireAuth";
import { PilihTombol } from "../kit/Formulir";
import { Segmen } from "../kit/Segmen";
import { LencanaTren } from "../kit/Ukuran";
import { useUrutTabel, type Urutan } from "../kit/Tabel";
import { Ikon } from "../kit/Ikon";
import { Keterangan, pemberiKet, type KabarKartu } from "../kit/kartuGrafik";
import { CoinIn, CoinOut, HourglassHigh, NavCalendarDots, Sliders } from "../kit/ikon";
import {
  ambilRingkasanKeuangan,
  ambilBulanan,
  semuaBiaya,
  semuaPembayaran,
  semuaTagihan,
  bacaCache,
  tulisCache,
  type FinanceOverview,
  type BarisBulanan,
  type BiayaProyek,
  type Pembayaran,
  type Invoice,
} from "../../lib/admin";
import { proyekAktif, onProyekAktif } from "../../lib/proyekAktif";
import { formatRupiah } from "../../lib/format";
import { kodeProyek } from "../../lib/nomorDokumen";

/* =============================================================================
   Keuangan — Ringkasan = NERACA STUDIO.

   "Neraca" dalam bahasa Indonesia berarti dua hal sekaligus: laporan
   keuangan yang menimbang yang masuk lawan yang keluar, dan TIMBANGAN. Halaman
   ini memakai keduanya secara harfiah, dan berperilaku seperti timbangan:

   1. TIMBANGAN — piringan kiri memuat KAS MASUK (satu anak timbangan per
      proyek, sebesar tagihan lunasnya), piringan kanan BEBAN (satu anak
      timbangan per kategori biaya). Lengan miring ke sisi yang lebih berat;
      di atas poros JARUM MARJIN (kontrak untuk "Semua", kas untuk satu
      bulan), di tiang PAPAN LABA BERSIH. Menyentuh satu anak timbangan
      (tetikus saja) memperlihatkan neraca TANPA anak timbangan itu: lengan
      bergeser dan papan laba ikut berhitung ulang.
   2. LEMBAR NERACA — bentuk T akuntansi: kiri masuk, kanan keluar, jumlah
      kedua sisi, lalu SALDO (laba bersih) bergaris ganda; di bawahnya
      piutang yang "belum ditimbang" per proyek dengan bagian kontrak yang
      sudah masuk.
   3. CATATAN TIMBANG — satu tiket per bulan (12/24), kas masuk ke atas,
      beban ke bawah. Mengklik satu bulan MENIMBANG bulan itu: anak
      timbangannya jatuh ke piringan dan lengannya berayun sampai seimbang.
      Itu satu-satunya gerak besar halaman ini, 2D.
   4. Transaksi terbaru (urut kolom, rentang) dan tenggat tagihan dalam satu
      kartu bersegmen.

   Datanya tidak berubah: `kasMasuk` = jumlah `received` per proyek (tagihan
   lunas) dan beban per kategori = `totalBiaya`, jadi jumlah anak timbangan
   pasti sama dengan angka di lembar. Untuk satu bulan, pecahannya dihitung
   dari tagihan lunas & biaya bulan itu; selisih terhadap angka bulanan API
   (mis. daftar biaya yang terpotong) jadi anak timbangan "tak terinci",
   supaya jumlahnya tetap sama dengan catatan bulanannya.
   ============================================================================= */

const BULAN_PENDEK = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

const KATEGORI: Record<string, string> = {
  freelancer: "Freelancer",
  operasional: "Operasional",
  prinsipal: "Prinsipal",
  lainnya: "Lainnya",
};
const LABEL_JENIS: Record<string, string> = { dp: "DP", termin: "Termin", pelunasan: "Pelunasan" };
const LABEL_METODE: Record<string, string> = { tunai: "Tunai", transfer: "Transfer", qris: "QRIS", lainnya: "Lainnya" };

const RENTANG = [
  { nilai: "1", label: "Bulan ini" },
  { nilai: "3", label: "3 bulan" },
  { nilai: "12", label: "12 bulan" },
  { nilai: "0", label: "Semua" },
];

/** Sudut lengan paling miring. */
const SUDUT_MAKS = 9;
/** Tinggi tumpukan anak timbangan untuk sisi yang lebih berat. */
const TUMPUK_MAKS = 132;
const ANAK_MIN = 22;

function batasRentang(bulan: number): number | null {
  if (bulan <= 0) return null;
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  d.setMonth(d.getMonth() - (bulan - 1));
  return d.getTime();
}

function waktuKe(iso: string, akhirHari = true): number {
  return new Date(iso.length === 10 ? iso + (akhirHari ? "T23:59:59" : "T00:00:00") : iso).getTime();
}

/** Hari tersisa sampai tenggat (UTC, sama dengan Tagihan & Termin). */
function sisaHari(iso: string): number | null {
  const [t, b, h] = iso.slice(0, 10).split("-").map(Number);
  if (!t || !b || !h) return null;
  const kini = new Date();
  const hariIni = Date.UTC(kini.getFullYear(), kini.getMonth(), kini.getDate());
  return Math.round((Date.UTC(t, b - 1, h) - hariIni) / 86_400_000);
}

function hariTenggat(sisa: number, iso: string): string {
  if (sisa === 0) return "Hari ini";
  if (sisa === 1) return "Besok";
  const [, b, h] = iso.slice(0, 10).split("-").map(Number);
  return `${h} ${BULAN_PENDEK[(b ?? 1) - 1]}`;
}

const kunciBulanDari = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const namaBulan = (k: string) => `${BULAN[Number(k.slice(5, 7)) - 1]} ${k.slice(0, 4)}`;
const pendekBulan = (k: string) => BULAN_PENDEK[Number(k.slice(5, 7)) - 1] ?? k;

/** n bulan terakhir, berurutan, termasuk yang tanpa data (nol). */
function deretBulan(n: number): string[] {
  const d = new Date();
  d.setDate(1);
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const x = new Date(d.getFullYear(), d.getMonth() - i, 1);
    out.push(kunciBulanDari(x));
  }
  return out;
}

interface Anak {
  kunci: string;
  kode: string;
  label: string;
  nilai: number;
  sisa?: boolean;
}

interface Transaksi {
  kunci: string;
  masuk: boolean;
  nama: string;
  sub: string;
  proyek: string;
  waktu: string;
  nominal: number;
}

/** Empat terbesar + sisanya digabung — piringan tidak muat lebih. */
function ringkasAnak(daftar: Anak[], labelSisa: string): Anak[] {
  const urut = [...daftar].filter((a) => a.nilai > 0).sort((a, b) => b.nilai - a.nilai);
  if (urut.length <= 4) return urut;
  const sisa = urut.slice(3).reduce((n, a) => n + a.nilai, 0);
  return [...urut.slice(0, 3), { kunci: "sisa", kode: `+${urut.length - 3} lain`, label: `${labelSisa} (${urut.length - 3})`, nilai: sisa, sisa: true }];
}

function tren(kini?: number, lalu?: number) {
  if (kini === undefined || lalu === undefined || !lalu) return null;
  const p = ((kini - lalu) / Math.abs(lalu)) * 100;
  return { naik: p >= 0, teks: `${Math.abs(p).toFixed(1).replace(".", ",")} %` };
}

const geraknya = () =>
  typeof window !== "undefined" && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Kepala kolom yang bisa mengurutkan (pola Tabel kit). */
function KepalaUrut({ label, i, urutan, onUrut, kanan }: { label: string; i: number; urutan: Urutan | null; onUrut: (u: Urutan | null) => void; kanan?: boolean }) {
  const arah = urutan?.kolom === i ? urutan.arah : null;
  return (
    <span role="columnheader" aria-sort={arah === "naik" ? "ascending" : arah === "turun" ? "descending" : "none"} className={kanan ? "is-kanan" : undefined}>
      <button
        type="button"
        className="nrc__urut"
        data-arah={arah ?? undefined}
        onClick={() => onUrut(arah === null ? { kolom: i, arah: "naik" } : arah === "naik" ? { kolom: i, arah: "turun" } : null)}
      >
        {label}
        <svg viewBox="0 0 8 12" width="8" height="12" aria-hidden="true">
          <path className="nrc__urutnaik" d="M4 1 7 5H1z" />
          <path className="nrc__urutturun" d="M4 11 1 7h6z" />
        </svg>
      </button>
    </span>
  );
}

/** Anak timbangan di piringan. */
function AnakTimbangan({
  a,
  sisi,
  tinggi,
  urutan,
  jatuh,
  redup,
  ket,
  onSentuh,
}: {
  a: Anak;
  sisi: "masuk" | "keluar";
  tinggi: number;
  urutan: number;
  jatuh: boolean;
  redup: boolean;
  ket: ReturnType<typeof pemberiKet>;
  onSentuh: (k: string | null) => void;
}) {
  const sentuh = ket(() => ({
    judul: a.label,
    baris: [{ label: sisi === "masuk" ? "Kas masuk" : "Beban", nilai: formatRupiah(a.nilai) }],
  }));
  return (
    <li
      className={`nrc__anak nrc__anak--${sisi}${jatuh ? " is-jatuh" : ""}${redup ? " is-redup" : ""}${a.sisa ? " is-sisa" : ""}`}
      style={{ height: tinggi, "--nrc-urutan": urutan } as CSSProperties}
      {...sentuh}
      onPointerEnter={(e) => {
        sentuh.onPointerEnter(e);
        if (e.pointerType === "mouse") onSentuh(a.kunci);
      }}
      onPointerLeave={(e) => {
        sentuh.onPointerLeave(e);
        if (e.pointerType === "mouse") onSentuh(null);
      }}
    >
      <b>{a.kode}</b>
      <span>{formatRupiah(a.nilai)}</span>
    </li>
  );
}

function Isi() {
  const [proyekId, setProyekId] = useState<string | null>(() => proyekAktif());
  const [rentang, setRentang] = useState(12);
  const kunci = `keuangan:${proyekId ?? "semua"}`;
  const kunciBulan = `keuangan-bulan:${proyekId ?? "semua"}`;

  const [ringkas, setRingkas] = useState<FinanceOverview | null>(() => bacaCache<FinanceOverview>(kunci));
  const [bulanan, setBulanan] = useState<BarisBulanan[] | null>(() => bacaCache<BarisBulanan[]>(kunciBulan));
  const [biaya, setBiaya] = useState<BiayaProyek[] | null>(() => bacaCache<BiayaProyek[]>("biaya-semua"));
  const [bayar, setBayar] = useState<Pembayaran[] | null>(() => bacaCache<Pembayaran[]>("bayar-semua"));
  const [tagihan, setTagihan] = useState<Invoice[] | null>(() => bacaCache<Invoice[]>("tagihan-semua"));
  const [rentangTrx, setRentangTrx] = useState("1");
  const [daftarAktif, setDaftarAktif] = useState<"trx" | "tenggat">("trx");
  /* Yang ditimbang: seluruh catatan, atau satu bulan (YYYY-MM). */
  const [periode, setPeriode] = useState<string>("semua");
  /* Kunci gerak: berganti tiap periode berganti, supaya anak timbangan jatuh lagi. */
  const [timbang, setTimbang] = useState(0);
  const [tanpa, setTanpa] = useState<string | null>(null);
  /* Selama anak timbangan jatuh, lengan menunggu mereka mendarat dulu. */
  const [menimbang, setMenimbang] = useState(false);
  const jedaTimbang = useRef(0);
  useEffect(() => () => clearTimeout(jedaTimbang.current), []);
  const kabar: KabarKartu = useRef(null);
  const ket = pemberiKet(kabar);
  const lenganRef = useRef<HTMLDivElement>(null);
  const [lebarLengan, setLebarLengan] = useState(400);
  /* Lengan baru boleh berayun SESUDAH lebarnya terukur — tanpa ini ia
     berayun dari tebakan 620 ke lebar sebenarnya tiap halaman dibuka. */
  const [siap, setSiap] = useState(false);

  useEffect(() => onProyekAktif(setProyekId), []);

  useEffect(() => {
    semuaBiaya()
      .then((d) => {
        tulisCache("biaya-semua", d);
        setBiaya(d);
      })
      .catch(() => setBiaya((l) => l ?? []));
    semuaPembayaran()
      .then((d) => {
        tulisCache("bayar-semua", d);
        setBayar(d);
      })
      .catch(() => setBayar((l) => l ?? []));
    semuaTagihan()
      .then((d) => {
        tulisCache("tagihan-semua", d);
        setTagihan(d);
      })
      .catch(() => setTagihan((l) => l ?? []));
  }, []);

  useEffect(() => {
    let batal = false;
    setRingkas(bacaCache<FinanceOverview>(kunci));
    setBulanan(bacaCache<BarisBulanan[]>(kunciBulan));
    ambilRingkasanKeuangan(proyekId)
      .then((d) => {
        if (!batal) {
          tulisCache(kunci, d);
          setRingkas(d);
        }
      })
      .catch(() => {});
    ambilBulanan(proyekId, 24)
      .then((d) => {
        if (!batal) {
          tulisCache(kunciBulan, d);
          setBulanan(d);
        }
      })
      .catch(() => {});
    return () => {
      batal = true;
    };
  }, [proyekId, kunci, kunciBulan]);

  /* Panjang lengan (lebar tata letaknya, sebelum diputar) — turun-naiknya
     piringan dihitung darinya. Diukur saat ukurannya berubah, bukan saat
     menggulir (jebakan #21). Persennya milik CSS (64%, 60% di ponsel). */
  useEffect(() => {
    const el = lenganRef.current;
    if (!el) return;
    let bingkai = 0;
    const ro = new ResizeObserver(([e]) => {
      setLebarLengan(e.contentRect.width);
      if (!bingkai) bingkai = requestAnimationFrame(() => requestAnimationFrame(() => setSiap(true)));
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(bingkai);
    };
  }, []);

  /* --- Catatan bulanan (tiket timbang) ------------------------------------ */
  const petaBulan = useMemo(() => new Map((bulanan ?? []).map((b) => [b.bulan, b])), [bulanan]);
  const tiket = useMemo(
    () =>
      deretBulan(rentang).map((k) => {
        const b = petaBulan.get(k);
        return { bulan: k, kasMasuk: b?.kasMasuk ?? 0, biaya: b?.biaya ?? 0, labaBersih: b?.labaBersih ?? 0 };
      }),
    [rentang, petaBulan],
  );
  const puncakTiket = Math.max(1, ...tiket.flatMap((t) => [t.kasMasuk, t.biaya]));

  function pilihPeriode(p: string) {
    if (p === periode) return;
    setPeriode(p);
    setTanpa(null);
    if (!geraknya()) return;
    setTimbang((n) => n + 1);
    setMenimbang(true);
    clearTimeout(jedaTimbang.current);
    jedaTimbang.current = window.setTimeout(() => setMenimbang(false), 1500);
  }

  /* --- Anak timbangan --------------------------------------------------------- */
  const { masuk, keluar } = useMemo(() => {
    if (periode === "semua") {
      const m: Anak[] = (ringkas?.proyek ?? []).map((p) => ({
        kunci: p.projectId,
        kode: kodeProyek(p.projectTitle),
        label: p.projectTitle,
        nilai: p.received,
      }));
      const k: Anak[] = (ringkas?.bebanKategori ?? []).map((b) => ({
        kunci: b.kategori,
        kode: KATEGORI[b.kategori] ?? b.kategori,
        label: KATEGORI[b.kategori] ?? b.kategori,
        nilai: b.nilai,
      }));
      return { masuk: ringkasAnak(m, "Proyek lain"), keluar: ringkasAnak(k, "Kategori lain") };
    }
    const b = petaBulan.get(periode);
    const cocokProyek = (id: string) => !proyekId || id === proyekId;
    const perProyek = new Map<string, Anak>();
    for (const t of tagihan ?? []) {
      if (t.status !== "lunas" || !t.paidAt || t.paidAt.slice(0, 7) !== periode || !cocokProyek(t.projectId)) continue;
      const l = perProyek.get(t.projectId);
      if (l) l.nilai += t.amount;
      else perProyek.set(t.projectId, { kunci: t.projectId, kode: kodeProyek(t.projectTitle ?? "—"), label: t.projectTitle ?? "—", nilai: t.amount });
    }
    const perKategori = new Map<string, Anak>();
    for (const c of biaya ?? []) {
      if (c.incurredOn.slice(0, 7) !== periode || !cocokProyek(c.projectId)) continue;
      const l = perKategori.get(c.category);
      if (l) l.nilai += c.amount;
      else perKategori.set(c.category, { kunci: c.category, kode: KATEGORI[c.category] ?? c.category, label: KATEGORI[c.category] ?? c.category, nilai: c.amount });
    }
    const m = [...perProyek.values()];
    const k = [...perKategori.values()];
    /* Selisih terhadap angka bulanan API jadi "tak terinci" — jumlahnya
       harus sama dengan tiket bulan itu. */
    const sm = (b?.kasMasuk ?? 0) - m.reduce((n, a) => n + a.nilai, 0);
    const sk = (b?.biaya ?? 0) - k.reduce((n, a) => n + a.nilai, 0);
    if (sm > 0) m.push({ kunci: "tak-masuk", kode: "Tak terinci", label: "Tak terinci", nilai: sm, sisa: true });
    if (sk > 0) k.push({ kunci: "tak-keluar", kode: "Tak terinci", label: "Tak terinci", nilai: sk, sisa: true });
    return { masuk: ringkasAnak(m, "Proyek lain"), keluar: ringkasAnak(k, "Kategori lain") };
  }, [periode, ringkas, petaBulan, tagihan, biaya, proyekId]);

  const totalMasuk = masuk.reduce((n, a) => n + a.nilai, 0);
  const totalKeluar = keluar.reduce((n, a) => n + a.nilai, 0);
  /* Neraca yang sedang tampak — tanpa anak timbangan yang disentuh. */
  const tampakMasuk = totalMasuk - (masuk.find((a) => a.kunci === tanpa)?.nilai ?? 0);
  const tampakKeluar = totalKeluar - (keluar.find((a) => a.kunci === tanpa)?.nilai ?? 0);
  const laba = tampakMasuk - tampakKeluar;
  const berat = Math.max(tampakMasuk, tampakKeluar, 1);
  const sudut = Math.max(-SUDUT_MAKS, Math.min(SUDUT_MAKS, ((tampakKeluar - tampakMasuk) / berat) * SUDUT_MAKS));
  const setengahLengan = lebarLengan / 2;
  const turun = setengahLengan * Math.sin((sudut * Math.PI) / 180);

  const skala = TUMPUK_MAKS / Math.max(totalMasuk, totalKeluar, 1);
  const tinggiAnak = (a: Anak) => Math.max(ANAK_MIN, Math.round(a.nilai * skala));

  /* Marjin: kontrak untuk seluruh catatan, kas untuk satu bulan. */
  const marjin =
    periode === "semua"
      ? ringkas?.marginRataRata ?? null
      : tampakMasuk > 0
        ? (laba / tampakMasuk) * 100
        : null;
  const sudutJarum = marjin === null ? -90 : -90 + (Math.max(-20, Math.min(60, marjin)) + 20) * (180 / 80);
  const nadaMarjin = marjin === null ? "kosong" : marjin >= 30 ? "sehat" : marjin >= 15 ? "cukup" : "tipis";
  const kataMarjin = marjin === null ? "Belum ada" : marjin >= 30 ? "Sehat" : marjin >= 15 ? "Cukup" : "Tipis";

  /* Tren: bulan yang ditimbang (atau bulan terakhir) lawan sebelumnya. */
  const kunciKini = periode === "semua" ? kunciBulanDari(new Date()) : periode;
  const iKini = (bulanan ?? []).findIndex((b) => b.bulan === kunciKini);
  const bKini = iKini >= 0 ? bulanan![iKini] : undefined;
  const bLalu = iKini > 0 ? bulanan![iKini - 1] : undefined;
  const tKas = tren(bKini?.kasMasuk, bLalu?.kasMasuk);
  const tBeban = tren(bKini?.biaya, bLalu?.biaya);
  const tLaba = tren(bKini?.labaBersih, bLalu?.labaBersih);

  /* --- Belum ditimbang: piutang per proyek -------------------------------- */
  const belum = useMemo(
    () =>
      (ringkas?.proyek ?? [])
        .filter((p) => (p.contractValue ?? 0) > 0 && (p.belumDiterima ?? 0) > 0)
        .sort((a, b) => (b.belumDiterima ?? 0) - (a.belumDiterima ?? 0))
        .slice(0, 3),
    [ringkas],
  );

  /* --- Transaksi terbaru ---------------------------------------------------- */
  const transaksi = useMemo<Transaksi[]>(() => {
    const batas = batasRentang(Number(rentangTrx));
    const cocok = (projectId: string, waktu: string) =>
      (!proyekId || projectId === proyekId) && (batas === null || waktuKe(waktu, false) >= batas);
    const m = (bayar ?? [])
      .filter((b) => cocok(b.projectId, b.paidAt))
      .map<Transaksi>((b) => ({
        kunci: `p:${b.id}`,
        masuk: true,
        nama: `Pembayaran ${LABEL_JENIS[b.kind] ?? b.kind}`,
        sub: LABEL_METODE[b.method] ?? b.method,
        proyek: b.projectTitle ?? "—",
        waktu: b.paidAt,
        nominal: b.amount,
      }));
    const k = (biaya ?? [])
      .filter((c) => cocok(c.projectId, c.incurredOn))
      .map<Transaksi>((c) => ({
        kunci: `b:${c.id}`,
        masuk: false,
        nama: c.label,
        sub: KATEGORI[c.category] ?? c.category,
        proyek: c.projectTitle ?? "—",
        waktu: c.incurredOn,
        nominal: c.amount,
      }));
    return [...m, ...k].sort((x, y) => waktuKe(y.waktu) - waktuKe(x.waktu)).slice(0, 6);
  }, [bayar, biaya, proyekId, rentangTrx]);
  const urutTrx = useUrutTabel(transaksi, [
    (t) => new Date(t.waktu.length === 10 ? t.waktu + "T00:00:00" : t.waktu).getTime(),
    (t) => t.nama,
    (t) => (t.masuk ? t.nominal : -t.nominal),
  ]);

  /* --- Tenggat tagihan ------------------------------------------------------ */
  const tenggat = useMemo(() => {
    return (tagihan ?? [])
      .filter((t) => t.status === "terbit" && t.dueDate && (!proyekId || t.projectId === proyekId))
      .map((t) => ({ t, sisa: sisaHari(t.dueDate!) }))
      .filter((x): x is { t: Invoice; sisa: number } => x.sisa !== null)
      .sort((x, y) => x.sisa - y.sisa)
      .map(({ t, sisa }) => ({
        kunci: t.id,
        kepala: sisa < 0 ? "Lewat tenggat" : hariTenggat(sisa, t.dueDate!),
        nominal: t.amount,
        keterangan: sisa < 0 ? `lewat ${-sisa} hari` : null,
        teks: `${t.projectTitle ?? "—"} · ${t.label}`,
        lewat: sisa < 0,
      }));
  }, [tagihan, proyekId]);

  const judulPeriode = periode === "semua" ? "Seluruh catatan" : namaBulan(periode);
  /* Kode, bukan nama: kode itulah yang tertulis di anak timbangan yang
     disentuh, dan nama proyek terpotong di papan laba. */
  const nTanpa = tanpa ? [...masuk, ...keluar].find((a) => a.kunci === tanpa)?.kode : null;
  const kosong = totalMasuk === 0 && totalKeluar === 0;

  return (
    <div className="nrc">
      <div className="nrc__papan">
        {/* ---- Timbangan ------------------------------------------------------ */}
        <section className="nrc__timbang" aria-label="Neraca studio">
          <header className="nrc__kepala">
            <p className="nrc__alis">
              Neraca studio <span>· {judulPeriode}</span>
              {bLalu && (tKas || tBeban || tLaba) && (
                <span className="nrc__alistren">
                  {" "}
                  · panah: {pendekBulan(kunciKini)} dibanding {pendekBulan(bLalu.bulan)}
                </span>
              )}
            </p>
            {periode !== "semua" && (
              <button type="button" className="nrc__kembali" onClick={() => pilihPeriode("semua")}>
                Timbang seluruh catatan
              </button>
            )}
          </header>

          <div className={`nrc__alat${siap ? " is-siap" : ""}${menimbang ? " is-menimbang" : ""}`} aria-describedby="nrc-ringkas">
            {/* Jarum marjin di atas poros. */}
            <div className={`nrc__dial is-${nadaMarjin}`}>
              <svg viewBox="0 0 120 66" width="120" height="66" aria-hidden="true">
                <path className="nrc__dialjalur" d="M10 60 A50 50 0 0 1 110 60" />
                {/* Zona: tipis < 15, cukup 15–30, sehat ≥ 30 (skala −20..60). */}
                <path className="nrc__dialzona nrc__dialzona--tipis" d="M10 60 A50 50 0 0 1 65.6 10.3" />
                <path className="nrc__dialzona nrc__dialzona--sehat" d="M89 15.4 A50 50 0 0 1 110 60" />
                <g style={{ transform: `rotate(${sudutJarum}deg)` }} className="nrc__jarum">
                  <line x1="60" y1="60" x2="60" y2="18" />
                </g>
                <circle cx="60" cy="60" r="5" className="nrc__jarumporos" />
              </svg>
              <p>
                <span>{periode === "semua" ? "Marjin kontrak" : "Marjin kas"}</span>
                <b>{marjin === null ? "—" : `${Math.round(marjin)}%`}</b>
                <small>{kataMarjin}</small>
              </p>
            </div>

            {/* Tiang dan alas. */}
            <i className="nrc__tiang" aria-hidden="true" />
            <i className="nrc__alas" aria-hidden="true" />
            <div className={`nrc__laba${laba < 0 ? " is-rugi" : ""}`}>
              <span>
                {nTanpa ? `Laba tanpa ${nTanpa}` : "Laba bersih"}
                {!nTanpa && tLaba && (
                  <LencanaTren panah naik={tLaba.naik}>
                    {tLaba.teks}
                  </LencanaTren>
                )}
              </span>
              <b>{formatRupiah(laba)}</b>
            </div>

            {/* Lengan. */}
            <div className="nrc__lengan" ref={lenganRef} style={{ transform: `translateX(-50%) rotate(${sudut}deg)` }} aria-hidden="true">
              <i className="nrc__lenganujung" />
              <i className="nrc__lenganujung nrc__lenganujung--kanan" />
            </div>
            <i className="nrc__poros" aria-hidden="true" />

            {/* Piringan. */}
            {(["masuk", "keluar"] as const).map((sisi) => {
              const anak = sisi === "masuk" ? masuk : keluar;
              const dy = sisi === "masuk" ? -turun : turun;
              const total = sisi === "masuk" ? tampakMasuk : tampakKeluar;
              const t = sisi === "masuk" ? tKas : tBeban;
              return (
                <div key={sisi} className={`nrc__piring nrc__piring--${sisi}`} style={{ transform: `translateY(${dy}px)` }}>
                  <i className="nrc__kait" aria-hidden="true" />
                  <ol className="nrc__tumpuk" key={`${sisi}-${timbang}`} aria-label={sisi === "masuk" ? "Kas masuk per proyek" : "Beban per kategori"}>
                    {anak.length === 0 && <li className="nrc__anakkosong">{kosong ? "belum ada catatan" : "kosong"}</li>}
                    {anak.map((a, i) => (
                      <AnakTimbangan
                        key={a.kunci}
                        a={a}
                        sisi={sisi}
                        tinggi={tinggiAnak(a)}
                        urutan={anak.length - i}
                        jatuh={timbang > 0}
                        redup={tanpa === a.kunci}
                        ket={ket}
                        onSentuh={setTanpa}
                      />
                    ))}
                  </ol>
                  <i className="nrc__pinggan" aria-hidden="true" />
                  <p className="nrc__piringlabel">
                    <span>
                      {sisi === "masuk" ? "Kas masuk" : "Beban"}
                      {t && (
                        <LencanaTren panah naik={t.naik} baik={sisi === "masuk" ? t.naik : !t.naik}>
                          {t.teks}
                        </LencanaTren>
                      )}
                    </span>
                    <b>{formatRupiah(total)}</b>
                  </p>
                </div>
              );
            })}
            <p id="nrc-ringkas" className="sr-only">
              {`${judulPeriode}: kas masuk ${formatRupiah(tampakMasuk)}, beban ${formatRupiah(tampakKeluar)}, laba bersih ${formatRupiah(laba)}.`}
            </p>
          </div>
        </section>

        {/* ---- Lembar neraca (bentuk T) --------------------------------------- */}
        <section className="nrc__lembar" aria-label="Lembar neraca">
          <header className="nrc__lembarkop">
            <h3>Neraca</h3>
            <p>{judulPeriode}</p>
          </header>
          <div className="nrc__t">
            <div className="nrc__tsisi">
              <p className="nrc__tjudul">Masuk</p>
              <ul>
                {masuk.map((a) => (
                  <li key={a.kunci} className={tanpa === a.kunci ? "is-sorot" : undefined}>
                    <span>{a.label}</span>
                    <b>{formatRupiah(a.nilai)}</b>
                  </li>
                ))}
                {masuk.length === 0 && <li className="nrc__tkosong">—</li>}
              </ul>
              <p className="nrc__tjumlah">
                <span>Jumlah</span>
                <b>{formatRupiah(totalMasuk)}</b>
              </p>
            </div>
            <div className="nrc__tsisi">
              <p className="nrc__tjudul">Keluar</p>
              <ul>
                {keluar.map((a) => (
                  <li key={a.kunci} className={tanpa === a.kunci ? "is-sorot" : undefined}>
                    <span>{a.label}</span>
                    <b>{formatRupiah(a.nilai)}</b>
                  </li>
                ))}
                {keluar.length === 0 && <li className="nrc__tkosong">—</li>}
              </ul>
              <p className="nrc__tjumlah">
                <span>Jumlah</span>
                <b>{formatRupiah(totalKeluar)}</b>
              </p>
            </div>
          </div>
          <p className={`nrc__saldo${totalMasuk - totalKeluar < 0 ? " is-rugi" : ""}`}>
            <span>Saldo · laba bersih</span>
            <b>{formatRupiah(totalMasuk - totalKeluar)}</b>
          </p>
          <div className="nrc__belum">
            <p className="nrc__belumkepala">
              <span>Belum ditimbang · piutang</span>
              <b>{formatRupiah(ringkas?.piutang ?? 0)}</b>
            </p>
            <ul>
              {belum.map((p) => {
                const pct = Math.min(100, (p.received / (p.contractValue || 1)) * 100);
                return (
                  <li key={p.projectId}>
                    <span className="nrc__belumnama">{p.projectTitle}</span>
                    <span className="nrc__belumbar" aria-hidden="true">
                      <i style={{ width: `${pct}%` }} />
                    </span>
                    <b>{formatRupiah(p.belumDiterima ?? 0)}</b>
                  </li>
                );
              })}
              {belum.length === 0 && <li className="nrc__tkosong">Semua kontrak sudah masuk.</li>}
            </ul>
            <p className="nrc__belumkaki">
              dari nilai kontrak {formatRupiah(ringkas?.totalKontrak ?? 0)} ·{" "}
              <a href="/admin/keuangan/tagihan">Tagihan &amp; termin</a>
            </p>
          </div>
        </section>

        {/* ---- Catatan timbang bulanan ------------------------------------------ */}
        <section className="nrc__catatan" aria-label="Catatan timbang per bulan">
          <header className="nrc__kepala">
            <p className="nrc__alis">
              Catatan timbang <span>· klik bulan untuk menimbangnya</span>
            </p>
            <button type="button" className="nrc__kembali" onClick={() => setRentang((r) => (r === 12 ? 24 : 12))}>
              {rentang} bulan
            </button>
          </header>
          <ol className="nrc__tiket" style={{ "--nrc-n": tiket.length } as CSSProperties}>
            {tiket.map((t) => {
              const pilih = periode === t.bulan;
              const kosongT = !t.kasMasuk && !t.biaya;
              return (
                <li key={t.bulan}>
                  <button
                    type="button"
                    className={`nrc__tiketb${pilih ? " is-pilih" : ""}${kosongT ? " is-kosong" : ""}`}
                    aria-pressed={pilih}
                    aria-label={`${namaBulan(t.bulan)}: kas masuk ${formatRupiah(t.kasMasuk)}, beban ${formatRupiah(t.biaya)}`}
                    onClick={() => pilihPeriode(pilih ? "semua" : t.bulan)}
                    {...ket(() => ({
                      judul: namaBulan(t.bulan),
                      baris: [
                        { label: "Kas masuk", nilai: formatRupiah(t.kasMasuk) },
                        { label: "Beban", nilai: formatRupiah(t.biaya) },
                        { label: "Laba", nilai: formatRupiah(t.labaBersih) },
                      ],
                    }))}
                  >
                    <span className="nrc__tiketatas">
                      <i style={{ height: `${(t.kasMasuk / puncakTiket) * 100}%` }} />
                    </span>
                    <span className="nrc__tiketbawah">
                      <i style={{ height: `${(t.biaya / puncakTiket) * 100}%` }} />
                    </span>
                    <small>{pendekBulan(t.bulan)}</small>
                  </button>
                </li>
              );
            })}
          </ol>
        </section>

        {/* ---- Transaksi & tenggat ---------------------------------------------- */}
        <section className="nrc__daftar" aria-label="Transaksi dan tenggat">
          <header className="nrc__daftarkepala">
            <Segmen
              judul="Daftar"
              className="nrc__segmen"
              nilai={daftarAktif}
              onPilih={(v) => setDaftarAktif(v as "trx" | "tenggat")}
              segmen={[
                { nilai: "trx", label: "Transaksi" },
                { nilai: "tenggat", label: `Tenggat${tenggat.length ? ` · ${tenggat.length}` : ""}` },
              ]}
            />
            {daftarAktif === "trx" ? (
              <>
                <PilihTombol judul="Rentang transaksi" jenis="ghost" ukuran="small" className="nrc__rentang" nilai={rentangTrx} opsi={RENTANG} onPilih={setRentangTrx} />
                <a className="nrc__ikontaut" href="/admin/keuangan/transaksi" aria-label="Saring lebih rinci di Semua Transaksi">
                  <Ikon ikon={Sliders} ukuran={16} />
                </a>
              </>
            ) : (
              <a className="nrc__taut" href="/admin/keuangan/tagihan">
                Tagihan &amp; termin
              </a>
            )}
          </header>
          {daftarAktif === "trx" ? (
            <div className="nrc__trx" role="table" aria-label="Transaksi terbaru">
              <div className="nrc__trxkepala" role="row">
                <KepalaUrut label="Tanggal" i={0} urutan={urutTrx.urutan} onUrut={urutTrx.onUrut} />
                <KepalaUrut label="Transaksi" i={1} urutan={urutTrx.urutan} onUrut={urutTrx.onUrut} />
                <KepalaUrut label="Nominal" i={2} urutan={urutTrx.urutan} onUrut={urutTrx.onUrut} kanan />
              </div>
              {urutTrx.terurut.map((t) => {
                const d = new Date(t.waktu.length === 10 ? t.waktu + "T00:00:00" : t.waktu);
                return (
                  <div key={t.kunci} className="nrc__trxbaris" role="row">
                    <span role="cell" className="nrc__trxtgl">
                      {d.getDate()} {BULAN_PENDEK[d.getMonth()]}
                    </span>
                    <span role="cell" className="nrc__trxnama">
                      <span className={`nrc__trxubin${t.masuk ? "" : " is-keluar"}`}>
                        <Ikon ikon={t.masuk ? CoinIn : CoinOut} ukuran={14} />
                      </span>
                      <span>
                        <b>{t.nama}</b>
                        <small>
                          {t.sub} · {t.proyek}
                        </small>
                      </span>
                    </span>
                    <span role="cell" className={`nrc__trxrp${t.masuk ? " is-masuk" : ""}`}>
                      {t.masuk ? "+" : "−"}
                      {formatRupiah(t.nominal)}
                    </span>
                  </div>
                );
              })}
              {transaksi.length === 0 && (
                <p className="nrc__kosong">{bayar === null || biaya === null ? "Memuat transaksi…" : "Belum ada transaksi pada rentang ini."}</p>
              )}
            </div>
          ) : (
            <div className="nrc__tenggat">
              {tenggat.map((t, i) => (
                <div key={t.kunci} className="nrc__tenggatbaris">
                  {(i === 0 || tenggat[i - 1]!.kepala !== t.kepala) && (
                    <p className={`nrc__harilabel${t.lewat ? " is-lewat" : ""}`}>{t.kepala}</p>
                  )}
                  <p className="nrc__tenggatisi">
                    <span className={`nrc__trxubin${t.lewat ? " is-lewat" : ""}`}>
                      <Ikon ikon={t.lewat ? HourglassHigh : NavCalendarDots} ukuran={14} />
                    </span>
                    <span>
                      <b>
                        {formatRupiah(t.nominal)}
                        {t.keterangan && <em> · {t.keterangan}</em>}
                      </b>
                      <small>{t.teks}</small>
                    </span>
                  </p>
                </div>
              ))}
              {tenggat.length === 0 && (
                <p className="nrc__kosong">{tagihan === null ? "Memuat tagihan…" : "Tidak ada tagihan terbit yang menunggu dibayar."}</p>
              )}
            </div>
          )}
        </section>
      </div>
      <Keterangan kabar={kabar} />
    </div>
  );
}

export function RingkasanKit() {
  return (
    <RequireAuth
      skeleton={
        <div className="nrc nrc--rangka">
          <div className="nrc__papan" />
        </div>
      }
    >
      <Isi />
    </RequireAuth>
  );
}
