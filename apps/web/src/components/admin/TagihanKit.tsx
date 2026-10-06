import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { RequireAuth } from "./RequireAuth";
import { IsianTempel, Kombo, Bidang, IsianTanggal } from "../kit/Formulir";
import { Peringatan } from "../kit/Tampilan";
import { Tombol } from "../kit/Tombol";
import { Ikon } from "../kit/Ikon";
import { Isian } from "../kit/Isian";
import { ToastProvider, useToast } from "../kit/Toast";
import { Dialog, DropdownMenu } from "../kit/Overlay";
import { Keterangan, pemberiKet, type KabarKartu } from "../kit/kartuGrafik";
import { navigate } from "astro:transitions/client";
import {
  ArrowClockwise,
  ArrowRight,
  CaretLeft,
  CaretRight,
  CheckCircle,
  CoinIn,
  DotsThree,
  PaperPlaneRight,
  Plus,
  Trash,
} from "../kit/ikon";
import {
  semuaTagihan,
  ubahInvoice,
  tambahInvoice,
  hapusInvoice,
  daftarProyek,
  ambilSettings,
  bacaCache,
  tulisCache,
  type Invoice,
  type Proyek,
  type StudioSettings,
} from "../../lib/admin";
import { formatRupiah } from "../../lib/format";
import { terbilang } from "../../lib/terbilang";
import { tanya } from "../../lib/tanya";
import { kodeProyek, inisial } from "../../lib/nomorDokumen";
import { CapLunas } from "./capLunas";
import { BULAN, BULAN_PENDEK } from "./frame25";

/* =============================================================================
   Tagihan & Termin — PAPAN JADWAL TERMIN + PAPAN JEPIT SURAT TAGIHAN.

   Benda dunia nyatanya dua, dan judul halamannya memang menyebut keduanya:

   - TERMIN adalah jadwal bayar sebuah kontrak. Di kantor ia hidup sebagai
     papan jadwal di dinding: satu lajur per kontrak, garis waktu bulan, hari
     ini ditandai, dan tiap termin dipaku di tanggal tenggatnya. Di sini
     papan itu digambar di bidang uang (`--kas-bidang`) yang sama dengan
     sampul Buku Gaji dan papan Fee Proyek, supaya ketiganya serumpun. Garis
     lajur bermint sampai termin terakhir yang LUNAS — jadi tiap lajur juga
     menjawab "sudah sampai mana bayarnya".
   - TAGIHAN adalah suratnya: selembar kertas putih di PAPAN JEPIT yang
     menunggu dikirim atau dibayar. Kop studio, nomor surat, kepada, proyek,
     termin ke berapa dari berapa, jumlah + terbilang, jatuh tempo. Ruang
     cap di kaki surat adalah tempat bertindak: Terbitkan (draf → terbit),
     Tandai lunas (cap LUNAS dibubuhkan di tempat itu juga), dan cap LUNAS
     yang diklik membatalkannya — seperti cap DITERIMA di Buku Gaji.

   Di sebelah papan jepit, LEMBAR KONTRAK: mistar nilai kontrak yang dipotong
   per termin menurut keadaannya, sisa yang belum dijadwalkan, dan daftar
   termin kontrak itu. Menyorot satu termin menyalakan pakunya di papan dan
   barisnya di lembar.

   3D hanya satu momen: saat termin lain dipilih, surat barunya dijatuhkan
   ke papan jepit dari engselnya di klip (rotateX dari tepi atas). Tidak ada
   gerak saat halaman dimuat, dan diam kalau gerak dikurangi.

   Tiga keputusan lama yang tetap berlaku:
   1. "Lewat tenggat" BUKAN status database — enumnya tiga (draft, terbit,
      lunas); yang keempat diturunkan dari terbit + tenggat lewat.
   2. Nomor termin = urutannya di dalam kontrak (`sort_order`), bukan id.
   3. Termin baru dibuat DI SINI dengan proyek dipilih di dialog; sisa
      kontrak yang belum ditagihkan ditampilkan, dan melebihinya cuma
      diperingatkan (adendum memang ada).
   ============================================================================= */

const HARI = 86_400_000;
/** Lebar jendela papan, dalam bulan: dua bulan ke belakang, empat ke depan. */
const JENDELA = 6;

type Keadaan = "lunas" | "terbit" | "lewat" | "draf";

const LABEL_KEADAAN: Record<Keadaan, string> = {
  lunas: "Lunas",
  terbit: "Terbit",
  lewat: "Lewat tempo",
  draf: "Draf",
};

/** Nomor hari (UTC) dari kolom `date` — dibaca dari POTONGAN string, supaya
    tenggat tidak mundur sehari di zona barat GMT. */
function hariDari(iso: string): number {
  const [t, b, h] = iso.slice(0, 10).split("-").map(Number);
  return Date.UTC(t!, (b ?? 1) - 1, h ?? 1) / HARI;
}
function hariIni(): number {
  const k = new Date();
  return Date.UTC(k.getFullYear(), k.getMonth(), k.getDate()) / HARI;
}
/** `paid_at` stempel waktu, jadi dibaca di zona peramban. */
function tglLokal(iso: string): { t: number; b: number; h: number } {
  const d = new Date(iso);
  return { t: d.getFullYear(), b: d.getMonth() + 1, h: d.getDate() };
}
function tanggalPanjang(iso: string): string {
  const [t, b, h] = iso.slice(0, 10).split("-").map(Number);
  return `${h} ${BULAN[(b ?? 1) - 1]} ${t}`;
}
function tanggalPendek(iso: string): string {
  const [, b, h] = iso.slice(0, 10).split("-").map(Number);
  return `${h} ${BULAN_PENDEK[(b ?? 1) - 1]}`;
}
function tanggalLunas(iso: string): string {
  const { t, b, h } = tglLokal(iso);
  return `${h} ${BULAN[b - 1]} ${t}`;
}
function isoLokal(iso: string): string {
  const { t, b, h } = tglLokal(iso);
  return `${t}-${String(b).padStart(2, "0")}-${String(h).padStart(2, "0")}`;
}

function sisaHari(i: Invoice): number | null {
  return i.dueDate ? hariDari(i.dueDate) - hariIni() : null;
}

function keadaanDari(i: Invoice): Keadaan {
  if (i.status === "lunas") return "lunas";
  if (i.status === "terbit") {
    const s = sisaHari(i);
    return s !== null && s < 0 ? "lewat" : "terbit";
  }
  return "draf";
}

function kalimatTenggat(i: Invoice): string {
  if (i.status === "lunas") return i.paidAt ? `dibayar ${tanggalLunas(i.paidAt)}` : "sudah dibayar";
  const s = sisaHari(i);
  if (s === null) return "belum dijadwalkan";
  if (s < 0) return `lewat ${Math.abs(s)} hari`;
  if (s === 0) return "jatuh tempo hari ini";
  return `${s} hari lagi`;
}

/** Urutan "paling perlu dikerjakan": lewat tempo tertua, lalu terbit
    terdekat, lalu draf terdekat, lalu lunas terbaru. */
/** Pembanding angka yang tahan Infinity (Infinity − Infinity = NaN). */
const banding = (a: number, b: number) => (a === b ? 0 : a < b ? -1 : 1);

function palingMendesak(daftar: Invoice[]): Invoice | undefined {
  const tgl = (i: Invoice) => (i.dueDate ? hariDari(i.dueDate) : Infinity);
  const per = (k: Keadaan) => daftar.filter((i) => keadaanDari(i) === k).sort((a, b) => banding(tgl(a), tgl(b)));
  return (
    per("lewat")[0] ??
    per("terbit")[0] ??
    per("draf")[0] ??
    [...daftar].filter((i) => i.status === "lunas").sort((a, b) => (b.paidAt ?? "").localeCompare(a.paidAt ?? ""))[0]
  );
}

/** Lebar paku yang DIPERKIRAKAN (bukan diukur): keping lunas membawa ikon
    centang, paku di luar jendela membawa tanda ‹ ›. Sedikit lebih lebar
    dari aslinya, jadi jaraknya selalu aman. */
function lebarPaku(k: Keadaan, luar: boolean): number {
  return (k === "lunas" ? 41 : 31) + (luar ? 8 : 0);
}

/** Pusat tiap paku dalam piksel. Paku diletakkan di tanggalnya, dijepit di
    dalam rel, lalu yang bertabrakan digeser seperlunya ke kanan (dan balik
    ke kiri kalau mentok) — urutannya tidak pernah berubah. Tanpa ini paku
    yang tenggatnya berdekatan saling tindih di layar sempit. */
function tataPaku(daftar: { id: string; x: number; w: number }[], W: number): Map<string, number> {
  const urut = [...daftar].sort((a, b) => a.x - b.x);
  const c = urut.map((d) => Math.min(W - d.w / 2, Math.max(d.w / 2, d.x * W)));
  for (let i = 1; i < urut.length; i++) {
    const min = c[i - 1]! + urut[i - 1]!.w / 2 + 3 + urut[i]!.w / 2;
    if (c[i]! < min) c[i] = min;
  }
  for (let i = urut.length - 1; i >= 0; i--) {
    const max = i === urut.length - 1 ? W - urut[i]!.w / 2 : c[i + 1]! - urut[i + 1]!.w / 2 - 3 - urut[i]!.w / 2;
    if (c[i]! > max) c[i] = max;
  }
  return new Map(urut.map((d, i) => [d.id, c[i]!]));
}

interface Lajur {
  id: string;
  judul: string;
  kode: string;
  klien: string | null;
  kontrak: number;
  /** Urut `sort_order` — urutan kontrak, bukan urutan tanggal. */
  termin: Invoice[];
  awal: number;
}

const pakaiGerak = () =>
  typeof window !== "undefined" && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function RupiahBesar({ n }: { n: number }) {
  const s = formatRupiah(n);
  const i = s.lastIndexOf(".");
  return (
    <>
      <b>{i < 0 ? s : s.slice(0, i)}</b>
      {i >= 0 && <span>{s.slice(i)}</span>}
    </>
  );
}

function bacaUrl(): { termin: string | null; proyek: string | null } {
  if (typeof window === "undefined") return { termin: null, proyek: null };
  const q = new URLSearchParams(location.search);
  return { termin: q.get("termin"), proyek: q.get("proyek") };
}

function Isi() {
  const toast = useToast();
  const kabar: KabarKartu = useRef(null);
  const ket = pemberiKet(kabar);

  const [tagihan, setTagihan] = useState<Invoice[] | null>(() => bacaCache<Invoice[]>("tagihan-semua"));
  const [proyek, setProyek] = useState<Proyek[] | null>(() => bacaCache<Proyek[]>("proyek"));
  /* Nama dan kota studio dari Info Studio — kunci cache `settings` milik Info
     Studio, jadi di sini cuma DIBACA (jebakan #8). */
  const [studio, setStudio] = useState<{ nama: string; kota: string | null }>(() => {
    const s = bacaCache<StudioSettings>("settings");
    return { nama: s?.studioName || "Studio", kota: s?.city ?? null };
  });
  const [galat, setGalat] = useState(false);
  const [pilih, setPilih] = useState<string | null>(() => bacaUrl().termin);
  const [geser, setGeser] = useState(0);
  /** Naik tiap kali termin lain dipilih — pemicu surat jatuh ke papan. */
  const [jatuh, setJatuh] = useState(0);
  /** Termin yang baru dicap LUNAS — capnya "tercap" sekali. */
  const [baruCap, setBaruCap] = useState<string | null>(null);
  const [sorot, setSorot] = useState<string | null>(null);
  const [sibuk, setSibuk] = useState<string | null>(null);
  const papanRef = useRef<HTMLDivElement>(null);
  /** Lebar rel paku — diukur sekali tiap ukurannya berubah, bukan saat
      menggulir. 0 = belum diukur (render server): paku memakai persen. */
  const [lebarRel, setLebarRel] = useState(0);

  async function muatUlang() {
    const segar = await semuaTagihan();
    tulisCache("tagihan-semua", segar);
    setTagihan(segar);
    return segar;
  }

  useEffect(() => {
    muatUlang()
      .then(() => setGalat(false))
      .catch(() => {
        setGalat(true);
        setTagihan((l) => l ?? []);
      });
    daftarProyek()
      .then((d) => {
        tulisCache("proyek", d);
        setProyek(d);
      })
      .catch(() => setProyek((l) => l ?? []));
    ambilSettings()
      .then((d) => setStudio({ nama: d.studioName || "Studio", kota: d.city ?? null }))
      .catch(() => {});
  }, []);

  const semua = tagihan ?? [];
  const adaLajur = semua.length > 0;
  useEffect(() => {
    const rel = papanRef.current?.querySelector<HTMLElement>(".tgh__rel");
    if (!rel) return;
    const ro = new ResizeObserver(([e]) => setLebarRel(Math.round(e!.contentRect.width)));
    ro.observe(rel);
    return () => ro.disconnect();
  }, [adaLajur]);

  const nomor = useMemo(() => {
    const per = new Map<string, Invoice[]>();
    for (const i of semua) per.set(i.projectId, [...(per.get(i.projectId) ?? []), i]);
    const out = new Map<string, { ke: number; dari: number }>();
    for (const d of per.values()) {
      [...d].sort((a, b) => a.sortOrder - b.sortOrder).forEach((i, k) => out.set(i.id, { ke: k + 1, dari: d.length }));
    }
    return out;
  }, [semua]);

  const lajur: Lajur[] = useMemo(() => {
    const per = new Map<string, Invoice[]>();
    for (const i of semua) per.set(i.projectId, [...(per.get(i.projectId) ?? []), i]);
    const pp = new Map((proyek ?? []).map((p) => [p.id, p]));
    return [...per]
      .map(([id, daftar]) => {
        const termin = [...daftar].sort((a, b) => a.sortOrder - b.sortOrder);
        const p = pp.get(id);
        const judul = p?.title ?? termin[0]?.projectTitle ?? "Proyek";
        const tgl = termin.filter((i) => i.dueDate).map((i) => hariDari(i.dueDate!));
        return {
          id,
          judul,
          kode: kodeProyek(judul),
          klien: p?.client || null,
          kontrak: p?.contractValue ?? 0,
          termin,
          awal: tgl.length ? Math.min(...tgl) : Infinity,
        };
      })
      .sort((a, b) => banding(a.awal, b.awal) || a.judul.localeCompare(b.judul, "id"));
  }, [semua, proyek]);

  const ringkas = useMemo(() => {
    const k = new Date();
    const bulanIni = `${k.getFullYear()}-${String(k.getMonth() + 1).padStart(2, "0")}`;
    const jumlah = (f: (i: Invoice) => boolean) => {
      const d = semua.filter(f);
      return { n: d.length, rp: d.reduce((a, i) => a + i.amount, 0) };
    };
    return {
      menunggu: jumlah((i) => i.status === "terbit"),
      lewat: jumlah((i) => keadaanDari(i) === "lewat"),
      lunasBulanIni: jumlah((i) => i.status === "lunas" && !!i.paidAt && isoLokal(i.paidAt).startsWith(bulanIni)),
      draf: jumlah((i) => i.status === "draft"),
    };
  }, [semua]);

  /* Termin terpilih: dari alamat, atau yang paling mendesak. `?proyek=`
     (dari menu Satu Proyek) memilih yang paling mendesak di proyek itu. */
  const terpilih = useMemo(() => {
    const ada = semua.find((i) => i.id === pilih);
    if (ada) return ada;
    const { proyek: idProyek } = bacaUrl();
    const milik = idProyek ? semua.filter((i) => i.projectId === idProyek) : [];
    return palingMendesak(milik.length ? milik : semua);
  }, [semua, pilih]);
  const lajurTerpilih = lajur.find((l) => l.id === terpilih?.projectId);

  /* Jendela papan: enam bulan, dua di belakang bulan ini. Digeser per bulan. */
  const jendela = useMemo(() => {
    const k = new Date();
    const y = k.getFullYear();
    const m0 = k.getMonth() - 2 + geser;
    const bulan = Array.from({ length: JENDELA }, (_, i) => {
      const d = new Date(Date.UTC(y, m0 + i, 1));
      return {
        t: d.getUTCFullYear(),
        b: d.getUTCMonth(),
        mulai: Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) / HARI,
        akhir: Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1) / HARI,
      };
    });
    return { bulan, mulai: bulan[0]!.mulai, akhir: bulan[JENDELA - 1]!.akhir };
  }, [geser]);
  const posisi = (hari: number) => (hari - jendela.mulai) / (jendela.akhir - jendela.mulai);
  const xKini = posisi(hariIni());
  const labelJendela = `${BULAN_PENDEK[jendela.bulan[0]!.b]} ${jendela.bulan[0]!.t} – ${BULAN_PENDEK[jendela.bulan[JENDELA - 1]!.b]} ${jendela.bulan[JENDELA - 1]!.t}`;

  function pilihTermin(i: Invoice, opsi: { fokus?: boolean } = {}) {
    if (i.id !== terpilih?.id) {
      setPilih(i.id);
      setJatuh((n) => n + 1);
      const u = new URL(location.href);
      u.searchParams.delete("proyek");
      u.searchParams.set("termin", i.id);
      history.replaceState(history.state, "", u);
      /* Paku di luar jendela: geser jendelanya sampai pakunya kelihatan. */
      if (i.dueDate) {
        const x = posisi(hariDari(i.dueDate));
        if (x < 0 || x >= 1) {
          /* Bulan tenggatnya ditaruh di tempat bulan ini biasanya berada
             (kolom ketiga), jadi geser = selisih bulannya dari sekarang. */
          const k = new Date();
          const [t, b] = i.dueDate.slice(0, 7).split("-").map(Number);
          setGeser((t! - k.getFullYear()) * 12 + (b! - 1 - k.getMonth()));
        }
      }
    }
    if (opsi.fokus) {
      requestAnimationFrame(() =>
        papanRef.current?.querySelector<HTMLElement>(`[data-termin="${i.id}"]`)?.focus({ preventScroll: false }),
      );
    }
  }

  /* Papan ketik di papan jadwal: ←/→ termin sebelum/sesudah di kontrak yang
     sama, ↑/↓ lajur tetangga (paku terdekat menurut tanggal), Home/End
     termin pertama/terakhir kontraknya. Pilihan ikut fokus, seperti tab. */
  function tombolPapan(e: KeyboardEvent<HTMLDivElement>) {
    if (!terpilih || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(e.key)) return;
    const li = lajur.findIndex((l) => l.id === terpilih.projectId);
    const l = lajur[li];
    if (!l) return;
    const ti = l.termin.findIndex((i) => i.id === terpilih.id);
    let tujuan: Invoice | undefined;
    if (e.key === "ArrowLeft") tujuan = l.termin[ti - 1];
    else if (e.key === "ArrowRight") tujuan = l.termin[ti + 1];
    else if (e.key === "Home") tujuan = l.termin[0];
    else if (e.key === "End") tujuan = l.termin[l.termin.length - 1];
    else {
      const lain = lajur[li + (e.key === "ArrowUp" ? -1 : 1)];
      if (lain) {
        const acuan = terpilih.dueDate ? hariDari(terpilih.dueDate) : Infinity;
        tujuan = [...lain.termin].sort(
          (a, b) =>
            Math.abs((a.dueDate ? hariDari(a.dueDate) : 1e9) - acuan) -
            Math.abs((b.dueDate ? hariDari(b.dueDate) : 1e9) - acuan),
        )[0];
      }
    }
    if (!tujuan) return;
    e.preventDefault();
    pilihTermin(tujuan, { fokus: true });
  }

  async function ubahStatus(i: Invoice, baru: "draft" | "terbit" | "lunas") {
    if (baru === i.status) return;
    setSibuk(i.id);
    const sebelum = semua;
    /* Diubah di layar LEBIH DULU dan dikembalikan kalau gagal — staf yang
       menandai beberapa termin berturut-turut tidak menekan dua kali. */
    setTagihan(
      semua.map((x) =>
        x.id === i.id ? { ...x, status: baru, paidAt: baru === "lunas" ? (x.paidAt ?? new Date().toISOString()) : null } : x,
      ),
    );
    if (baru === "lunas") setBaruCap(i.id);
    try {
      await ubahInvoice(i.id, { status: baru });
      await muatUlang();
      const kata = baru === "lunas" ? "dicap lunas" : baru === "terbit" ? "diterbitkan ke klien" : "dikembalikan ke draf";
      toast({ judul: `${i.label} ${kata}`, keterangan: i.projectTitle, nada: "sukses" });
    } catch (e) {
      setTagihan(sebelum);
      setBaruCap(null);
      toast({ judul: "Gagal mengubah status", keterangan: e instanceof Error ? e.message : "Coba lagi.", nada: "gagal" });
    } finally {
      setSibuk(null);
    }
  }

  async function batalkanLunas(i: Invoice) {
    const ya = await tanya({
      judul: `Batalkan lunas ${i.label}?`,
      isi: "Termin kembali menunggu pembayaran. Catatan uang masuk di Terima Pembayaran tidak ikut berubah.",
      ya: "Batalkan lunas",
    });
    if (ya) await ubahStatus(i, "terbit");
  }

  async function hapus(i: Invoice) {
    const ya = await tanya({
      judul: `Hapus ${i.label}?`,
      isi:
        i.status === "lunas"
          ? "Termin ini sudah lunas. Catatan uang masuknya tetap ada."
          : "Termin hilang dari jadwal kontrak ini. Tidak bisa dikembalikan.",
      ya: "Ya, hapus",
      bahaya: true,
    });
    if (!ya) return;
    setSibuk(i.id);
    try {
      await hapusInvoice(i.id);
      const segar = await muatUlang();
      const sisa = segar.filter((x) => x.projectId === i.projectId);
      const lanjut = palingMendesak(sisa.length ? sisa : segar);
      if (lanjut) pilihTermin(lanjut, { fokus: true });
      toast({ judul: `${i.label} dihapus`, keterangan: i.projectTitle, nada: "sukses" });
    } catch (e) {
      toast({ judul: "Gagal menghapus termin", keterangan: (e as Error).message, nada: "gagal" });
    } finally {
      setSibuk(null);
    }
  }

  const memuat = tagihan === null;
  if (memuat) return <Kerangka />;

  return (
    <div className="tgh">
      <Keterangan kabar={kabar} />
      <div className="tgh__papan">
        {/* ---- Kop papan: angka yang ditanyakan setiap pagi --------------- */}
        <header className="tgh__kop">
          <div className="tgh__utama">
            <p className="tgh__alis">Menunggu dibayar klien</p>
            <p className="tgh__total">
              <RupiahBesar n={ringkas.menunggu.rp} />
            </p>
            <p className="tgh__sub">
              {ringkas.menunggu.n} termin terbit · {lajur.length} kontrak
            </p>
          </div>
          <ul className="tgh__angka">
            <li>
              <button
                type="button"
                className={`tgh__angkatombol${ringkas.lewat.n ? " is-lewat" : ""}`}
                disabled={!ringkas.lewat.n}
                onClick={() => {
                  const t = palingMendesak(semua.filter((i) => keadaanDari(i) === "lewat"));
                  if (t) pilihTermin(t, { fokus: true });
                }}
              >
                <span>Lewat tempo</span>
                <b>{formatRupiah(ringkas.lewat.rp)}</b>
                <small>{ringkas.lewat.n ? `${ringkas.lewat.n} termin · buka yang tertua` : "tidak ada"}</small>
              </button>
            </li>
            <li>
              <div className="tgh__angkatombol is-diam">
                <span>Lunas bulan ini</span>
                <b>{formatRupiah(ringkas.lunasBulanIni.rp)}</b>
                <small>{ringkas.lunasBulanIni.n} termin</small>
              </div>
            </li>
            <li>
              <div className="tgh__angkatombol is-diam">
                <span>Belum diterbitkan</span>
                <b>{formatRupiah(ringkas.draf.rp)}</b>
                <small>{ringkas.draf.n} draf</small>
              </div>
            </li>
          </ul>
          <div className="tgh__kanan">
          <div className="tgh__kontrol">
            <div className="tgh__jendela" role="group" aria-label="Geser jendela papan">
              <button type="button" className="tgh__geser" aria-label="Bulan sebelumnya" onClick={() => setGeser((g) => g - 1)}>
                <Ikon ikon={CaretLeft} ukuran={14} />
              </button>
              <button
                type="button"
                className="tgh__jendelalabel"
                title="Kembali ke bulan ini"
                disabled={geser === 0}
                onClick={() => setGeser(0)}
              >
                {labelJendela}
              </button>
              <button type="button" className="tgh__geser" aria-label="Bulan sesudahnya" onClick={() => setGeser((g) => g + 1)}>
                <Ikon ikon={CaretRight} ukuran={14} />
              </button>
            </div>
            <DialogTermin
              proyek={proyek ?? []}
              tagihan={semua}
              pemicu={
                <button type="button" className="tgh__baru">
                  <Ikon ikon={Plus} ukuran={14} />
                  Termin baru
                </button>
              }
              onSelesai={async (id) => {
                const segar = await muatUlang().catch(() => null);
                const baru = segar?.find((x) => x.id === id);
                if (baru) pilihTermin(baru);
              }}
            />
          </div>
          <ul className="tgh__legenda" aria-label="Arti warna paku">
            {(["lunas", "terbit", "lewat", "draf"] as Keadaan[]).map((k) => (
              <li key={k}>
                <i className={`is-${k}`} />
                {LABEL_KEADAAN[k]}
              </li>
            ))}
          </ul>
          </div>
        </header>

        {/* ---- Papan jadwal termin ---------------------------------------- */}
        <section className="tgh__jadwal" aria-label="Jadwal termin">
          <div className="tgh__sumbu" aria-hidden="true">
            <span className="tgh__sumbujudul">Kontrak</span>
            <div className="tgh__bulan-bulan">
              {jendela.bulan.map((b) => (
                <span
                  key={`${b.t}-${b.b}`}
                  className={`tgh__bln${b.mulai <= hariIni() && hariIni() < b.akhir ? " is-kini" : ""}`}
                  style={{ left: `${posisi(b.mulai) * 100}%`, width: `${(posisi(b.akhir) - posisi(b.mulai)) * 100}%` }}
                >
                  {BULAN_PENDEK[b.b]}
                  {b.b === 0 || b === jendela.bulan[0] ? <small> {b.t}</small> : null}
                </span>
              ))}
            </div>
            <span className="tgh__sumbujudul tgh__sumbujudul--tanpa">Tanpa tenggat</span>
          </div>

          {galat && (
            <p className="tgh__galat">
              Tagihan gagal dimuat.{" "}
              <button type="button" onClick={() => muatUlang().then(() => setGalat(false)).catch(() => {})}>
                Coba lagi
              </button>
            </p>
          )}

          {lajur.length === 0 ? (
            <p className="tgh__kosong">Belum ada termin. Tekan Termin baru untuk membuat jadwal bayar kontrak pertama.</p>
          ) : (
            <div className="tgh__lajur-lajur" ref={papanRef} onKeyDown={tombolPapan}>
              <div className="tgh__lajurdalam">
                {/* Kisi bulan + garis hari ini: satu lapis untuk semua lajur,
                    di belakang paku — tidak pernah di belakang tulisan. */}
                <div className="tgh__kisi" aria-hidden="true">
                  {jendela.bulan.slice(1).map((b) => (
                    <i key={`${b.t}-${b.b}`} style={{ left: `${posisi(b.mulai) * 100}%` }} />
                  ))}
                  {xKini >= 0 && xKini < 1 && <b className="tgh__kini" style={{ left: `${xKini * 100}%` }} />}
                </div>
                {lajur.map((l) => (
                  <BarisLajur
                    key={l.id}
                    l={l}
                    nomor={nomor}
                    posisi={posisi}
                    lebarRel={lebarRel}
                    terpilih={terpilih}
                    sorot={sorot}
                    setSorot={setSorot}
                    ket={ket}
                    onPilih={pilihTermin}
                  />
                ))}
              </div>
            </div>
          )}
          {lajur.length > 0 && (
            <div className="tgh__kakijadwal" aria-hidden="true">
              <span />
              <div className="tgh__kinirel">
                {xKini >= 0 && xKini < 1 && (
                  <span
                    className={`tgh__kinilabel${xKini < 0.08 ? " is-awal" : xKini > 0.92 ? " is-akhir" : ""}`}
                    style={{ left: `${xKini * 100}%` }}
                  >
                    Hari ini · {tanggalPendek(isoLokal(new Date().toISOString()))}
                  </span>
                )}
              </div>
            </div>
          )}
        </section>

        {/* ---- Papan jepit + lembar kontrak ------------------------------- */}
        {terpilih && lajurTerpilih && (
          <div className="tgh__bawah">
            <section className="tgh__jepit" aria-label="Surat tagihan">
              <span className="tgh__klip" aria-hidden="true" />
              <div className="tgh__tumpuk" aria-hidden="true" data-n={Math.min(3, lajurTerpilih.termin.length - 1)} />
              <Surat
                key={`${terpilih.id}-${jatuh}`}
                i={terpilih}
                l={lajurTerpilih}
                n={nomor.get(terpilih.id)}
                studio={studio}
                jatuh={jatuh > 0 && pakaiGerak()}
                tercap={baruCap === terpilih.id && pakaiGerak()}
                sibuk={sibuk === terpilih.id}
                onStatus={ubahStatus}
                onBatalLunas={batalkanLunas}
                onHapus={hapus}
              />
            </section>

            <LembarKontrak
              l={lajurTerpilih}
              terpilih={terpilih}
              sorot={sorot}
              setSorot={setSorot}
              onPilih={pilihTermin}
              ket={ket}
              tambah={
                <DialogTermin
                  proyek={proyek ?? []}
                  tagihan={semua}
                  awal={lajurTerpilih.id}
                  pemicu={
                    <button type="button" className="tgh__tambah">
                      <Ikon ikon={Plus} ukuran={14} />
                      Termin
                    </button>
                  }
                  onSelesai={async (id) => {
                    const segar = await muatUlang().catch(() => null);
                    const baru = segar?.find((x) => x.id === id);
                    if (baru) pilihTermin(baru);
                  }}
                />
              }
            />
          </div>
        )}
      </div>
    </div>
  );
}

/* Satu lajur kontrak di papan jadwal. Di LUAR Isi supaya tidak dipasang
   ulang tiap render. */
function BarisLajur({
  l,
  nomor,
  posisi,
  lebarRel,
  terpilih,
  sorot,
  setSorot,
  ket,
  onPilih,
}: {
  l: Lajur;
  nomor: Map<string, { ke: number; dari: number }>;
  posisi: (hari: number) => number;
  lebarRel: number;
  terpilih: Invoice | undefined;
  sorot: string | null;
  setSorot: (id: string | null) => void;
  ket: ReturnType<typeof pemberiKet>;
  onPilih: (i: Invoice, o?: { fokus?: boolean }) => void;
}) {
  const bertanggal = l.termin.filter((i) => i.dueDate);
  const tanpa = l.termin.filter((i) => !i.dueDate);
  const xMentah = (i: Invoice) => posisi(hariDari(i.dueDate!));
  const letak = lebarRel
    ? tataPaku(
        bertanggal.map((i) => {
          const x = xMentah(i);
          return { id: i.id, x, w: lebarPaku(keadaanDari(i), x < 0 || x >= 1) };
        }),
        lebarRel,
      )
    : null;
  /* Satuan rel: piksel kalau sudah diukur, persen kalau belum. */
  const pos = (i: Invoice) => (letak ? letak.get(i.id)! : Math.min(1, Math.max(0, xMentah(i))) * 100);
  const satuan = letak ? "px" : "%";
  const xs = bertanggal.map(pos);
  const lunasTerakhir = bertanggal.reduce((m, i, k) => (i.status === "lunas" ? Math.max(m, xs[k]!) : m), -Infinity);
  const xMin = xs.length ? Math.min(...xs) : 0;
  const xMax = xs.length ? Math.max(...xs) : 0;
  const nLunas = l.termin.filter((i) => i.status === "lunas").length;
  const aktif = terpilih?.projectId === l.id;

  const paku = (i: Invoice, gaya?: CSSProperties) => {
    const k = keadaanDari(i);
    const n = nomor.get(i.id);
    const x = i.dueDate ? posisi(hariDari(i.dueDate)) : 0.5;
    const luar = i.dueDate ? (x < 0 ? " is-luarkiri" : x >= 1 ? " is-luarkanan" : "") : "";
    const pilih = terpilih?.id === i.id;
    const kt = ket(() => ({
      judul: `${i.label} · ${l.judul}`,
      baris: [
        { label: "Jumlah", nilai: formatRupiah(i.amount) },
        { label: "Tenggat", nilai: i.dueDate ? tanggalPanjang(i.dueDate) : "belum dijadwalkan" },
        { label: LABEL_KEADAAN[k], nilai: kalimatTenggat(i) },
      ],
    }));
    return (
      <button
        key={i.id}
        type="button"
        data-termin={i.id}
        className={`tgh__paku is-${k}${pilih ? " is-pilih" : ""}${sorot === i.id ? " is-sorot" : ""}${luar}`}
        style={gaya}
        tabIndex={pilih ? 0 : -1}
        aria-pressed={pilih}
        aria-label={`${i.label}, ${l.judul}, ${formatRupiah(i.amount)}, ${
          i.dueDate ? `tenggat ${tanggalPanjang(i.dueDate)}` : "tanpa tenggat"
        }, ${LABEL_KEADAAN[k]}`}
        onClick={() => onPilih(i)}
        onFocus={() => setSorot(i.id)}
        onBlur={() => setSorot(null)}
        data-ket=""
        onPointerMove={kt.onPointerMove}
        onPointerUp={kt.onPointerUp}
        onPointerEnter={(e) => {
          kt.onPointerEnter(e);
          if (e.pointerType === "mouse") setSorot(i.id);
        }}
        onPointerLeave={(e) => {
          kt.onPointerLeave(e);
          if (e.pointerType === "mouse") setSorot(null);
        }}
      >
        {k === "lunas" ? <Ikon ikon={CheckCircle} ukuran={11} /> : null}T{n?.ke ?? "?"}
      </button>
    );
  };

  return (
    <div className={`tgh__lajur${aktif ? " is-aktif" : ""}`} role="group" aria-label={`Termin ${l.judul}`}>
      <button
        type="button"
        tabIndex={-1}
        className="tgh__lajurlabel"
        onClick={() => {
          const t = palingMendesak(l.termin);
          if (t) onPilih(t, { fokus: true });
        }}
      >
        <span className="tgh__kode">{l.kode}</span>
        <span className="tgh__lajurjudul">{l.judul}</span>
        <small>
          {nLunas}/{l.termin.length} lunas
        </small>
      </button>
      <div className="tgh__rel">
        {xs.length > 1 && (
          <>
            <i className="tgh__relgaris" style={{ left: `${xMin}${satuan}`, width: `${xMax - xMin}${satuan}` }} />
            {lunasTerakhir > xMin && (
              <i
                className="tgh__relgaris tgh__relgaris--lunas"
                style={{ left: `${xMin}${satuan}`, width: `${lunasTerakhir - xMin}${satuan}` }}
              />
            )}
          </>
        )}
        {bertanggal.map((i) => paku(i, { left: `${pos(i)}${satuan}` }))}
      </div>
      <div className="tgh__tanpa">{tanpa.map((i) => paku(i))}</div>
    </div>
  );
}

/* Surat tagihan di papan jepit. Kertas putih TETAP di kedua tema — surat
   memang selembar kertas putih — dengan tinta `--kas-bidang`. */
function Surat({
  i,
  l,
  n,
  studio,
  jatuh,
  tercap,
  sibuk,
  onStatus,
  onBatalLunas,
  onHapus,
}: {
  i: Invoice;
  l: Lajur;
  n: { ke: number; dari: number } | undefined;
  studio: { nama: string; kota: string | null };
  jatuh: boolean;
  tercap: boolean;
  sibuk: boolean;
  onStatus: (i: Invoice, s: "draft" | "terbit" | "lunas") => void;
  onBatalLunas: (i: Invoice) => void;
  onHapus: (i: Invoice) => void;
}) {
  const k = keadaanDari(i);
  const nomorSurat = `TG-${l.kode}-${String(n?.ke ?? 0).padStart(2, "0")}`;
  const sisa = sisaHari(i);
  const kodeStudio = inisial(studio.nama) || "ST";
  return (
    <article className={`tgh__surat is-${k}${jatuh ? " is-jatuh" : ""}`} aria-label={`Surat tagihan ${nomorSurat}`}>
      <header className="tgh__suratkop">
        <div className="tgh__studio">
          <b>{studio.nama}</b>
          {studio.kota && <small>{studio.kota}</small>}
        </div>
        <div className="tgh__suratjudul">
          <span>Tagihan</span>
          <small>
            No. <b>{nomorSurat}</b>
          </small>
          {n && (
            <small>
              termin {n.ke} dari {n.dari}
            </small>
          )}
        </div>
        <DropdownMenu
          trigger={
            <button type="button" className="tgh__menu" aria-label={`Tindakan lain untuk ${i.label}`}>
              <Ikon ikon={DotsThree} ukuran={18} />
            </button>
          }
          sections={[
            {
              items: [
                ...(i.status === "terbit"
                  ? [{ label: "Kembalikan ke draf", ikon: ArrowClockwise, onSelect: () => onStatus(i, "draft") }]
                  : []),
                ...(i.status === "lunas"
                  ? [{ label: "Batalkan lunas", ikon: ArrowClockwise, onSelect: () => onBatalLunas(i) }]
                  : []),
                {
                  label: "Catat uang masuk",
                  ikon: CoinIn,
                  onSelect: () => navigate(`/admin/keuangan/terima?proyek=${i.projectId}`),
                },
                { label: "Buka proyek", ikon: ArrowRight, onSelect: () => navigate(`/admin/proyek/satu?id=${i.projectId}`) },
              ],
            },
            { items: [{ label: "Hapus termin", ikon: Trash, danger: true, onSelect: () => onHapus(i) }] },
          ]}
        />
      </header>

      <dl className="tgh__suratbaris">
        <div>
          <dt>Kepada</dt>
          <dd>{l.klien ?? "—"}</dd>
        </div>
        <div>
          <dt>Proyek</dt>
          <dd>{l.judul}</dd>
        </div>
        <div>
          <dt>Termin</dt>
          <dd>
            {i.label}
          </dd>
        </div>
        <div>
          <dt>Jatuh tempo</dt>
          <dd>
            {i.dueDate ? tanggalPanjang(i.dueDate) : "belum dijadwalkan"}
            {i.status !== "lunas" && sisa !== null && (
              <span className={`tgh__sisa${k === "lewat" ? " is-lewat" : ""}`}>{kalimatTenggat(i)}</span>
            )}
          </dd>
        </div>
      </dl>

      <div className="tgh__jumlah">
        <span>Jumlah tagihan</span>
        <b>{formatRupiah(i.amount)}</b>
      </div>
      <p className="tgh__terbilang"># {terbilang(i.amount)} #</p>

      <footer className="tgh__suratkaki">
        <div className="tgh__ruangcap">
          {k === "lunas" ? (
            <>
              <button
                type="button"
                className={`tgh__captombol${tercap ? " is-tercap" : ""}`}
                title="Batalkan lunas"
                aria-label={`Lunas ${i.paidAt ? tanggalLunas(i.paidAt) : ""} — batalkan lunas`}
                disabled={sibuk}
                onClick={() => onBatalLunas(i)}
              >
                <CapLunas tanggal={i.paidAt ? isoLokal(i.paidAt) : (i.dueDate ?? "")} studio={kodeStudio} id={i.id} kelas="tgh" ukuran={48} />
              </button>
              <small>Dibayar {i.paidAt ? tanggalLunas(i.paidAt) : ""}</small>
            </>
          ) : (
            <>
              {k === "lewat" ? (
                <span className="tgh__caplewat">
                  Lewat tempo
                  <small>{Math.abs(sisa ?? 0)} hari</small>
                </span>
              ) : (
                <span className={`tgh__keadaan is-${k}`}>{k === "draf" ? "Draf · belum dikirim" : "Menunggu pembayaran"}</span>
              )}
              <button
                type="button"
                className="tgh__aksi"
                disabled={sibuk}
                onClick={() => onStatus(i, k === "draf" ? "terbit" : "lunas")}
              >
                <Ikon ikon={k === "draf" ? PaperPlaneRight : CheckCircle} ukuran={15} />
                {sibuk ? "Menyimpan…" : k === "draf" ? "Terbitkan ke klien" : "Tandai lunas"}
              </button>
            </>
          )}
        </div>
        <div className="tgh__ttd">
          <small>Hormat kami,</small>
          <span className="tgh__garisttd" />
          <b>{studio.nama}</b>
        </div>
      </footer>
    </article>
  );
}

/* Lembar kontrak: mistar nilai kontrak per termin + jadwal termin. */
function LembarKontrak({
  l,
  terpilih,
  sorot,
  setSorot,
  onPilih,
  ket,
  tambah,
}: {
  l: Lajur;
  terpilih: Invoice;
  sorot: string | null;
  setSorot: (id: string | null) => void;
  onPilih: (i: Invoice, o?: { fokus?: boolean }) => void;
  ket: ReturnType<typeof pemberiKet>;
  tambah: ReactNode;
}) {
  const jumlahTermin = l.termin.reduce((a, i) => a + i.amount, 0);
  const skala = Math.max(l.kontrak, jumlahTermin, 1);
  const per = (k: Keadaan) => l.termin.filter((i) => keadaanDari(i) === k).reduce((a, i) => a + i.amount, 0);
  const belumDijadwalkan = Math.max(0, l.kontrak - jumlahTermin);
  const listRef = useRef<HTMLOListElement>(null);

  function tombolBaris(e: KeyboardEvent<HTMLButtonElement>, idx: number) {
    const ke =
      e.key === "ArrowDown" ? idx + 1 : e.key === "ArrowUp" ? idx - 1 : e.key === "Home" ? 0 : e.key === "End" ? l.termin.length - 1 : null;
    if (ke === null) return;
    const t = l.termin[Math.max(0, Math.min(l.termin.length - 1, ke))];
    if (!t) return;
    e.preventDefault();
    onPilih(t);
    requestAnimationFrame(() => listRef.current?.querySelector<HTMLElement>(`[data-baris="${t.id}"]`)?.focus());
  }

  return (
    <section className="tgh__kontrak" aria-label={`Jadwal termin ${l.judul}`}>
      <header className="tgh__kontrakkop">
        <div>
          <p className="tgh__alis tgh__alis--kertas">Jadwal termin kontrak</p>
          <h2>
            {l.judul} <span className="tgh__kodebesar">{l.kode}</span>
          </h2>
          <small>{l.klien ?? "Klien belum diisi"}</small>
        </div>
        {tambah}
      </header>

      <div className="tgh__nilai">
        <span>Nilai kontrak</span>
        <b>{l.kontrak > 0 ? formatRupiah(l.kontrak) : "belum diisi"}</b>
      </div>

      <div className="tgh__mistar" role="img" aria-label={`Mistar kontrak: lunas ${formatRupiah(per("lunas"))}, menunggu ${formatRupiah(per("terbit") + per("lewat"))}, draf ${formatRupiah(per("draf"))}, belum dijadwalkan ${formatRupiah(belumDijadwalkan)}`}>
        {l.termin.map((i) => {
          const k = keadaanDari(i);
          return (
            <i
              key={i.id}
              className={`is-${k}${i.id === terpilih.id ? " is-pilih" : ""}${sorot === i.id ? " is-sorot" : ""}`}
              style={{ width: `${(i.amount / skala) * 100}%` }}
              {...ket(() => ({
                judul: i.label,
                baris: [
                  { label: "Jumlah", nilai: formatRupiah(i.amount) },
                  { label: "Bagian kontrak", nilai: l.kontrak > 0 ? `${((i.amount / l.kontrak) * 100).toFixed(1).replace(".", ",")}%` : "—" },
                  { label: LABEL_KEADAAN[k], nilai: kalimatTenggat(i) },
                ],
              }))}
            />
          );
        })}
        {belumDijadwalkan > 0 && (
          <i
            className="is-belum"
            style={{ width: `${(belumDijadwalkan / skala) * 100}%` }}
            {...ket(() => ({
              judul: "Belum masuk termin",
              baris: [{ label: "Sisa kontrak", nilai: formatRupiah(belumDijadwalkan) }],
            }))}
          />
        )}
      </div>
      <ul className="tgh__ringkaskontrak">
        <li>
          <i className="is-lunas" />
          Lunas <b>{formatRupiah(per("lunas"))}</b>
        </li>
        <li>
          <i className="is-terbit" />
          Menunggu <b>{formatRupiah(per("terbit") + per("lewat"))}</b>
        </li>
        <li>
          <i className="is-draf" />
          Draf <b>{formatRupiah(per("draf"))}</b>
        </li>
        {belumDijadwalkan > 0 && (
          <li>
            <i className="is-belum" />
            Belum masuk termin <b>{formatRupiah(belumDijadwalkan)}</b>
          </li>
        )}
      </ul>

      <ol className="tgh__baris-baris" ref={listRef}>
        {l.termin.map((i, idx) => {
          const k = keadaanDari(i);
          const pilih = i.id === terpilih.id;
          return (
            <li key={i.id}>
              <button
                type="button"
                data-baris={i.id}
                className={`tgh__baris${pilih ? " is-pilih" : ""}${sorot === i.id ? " is-sorot" : ""}`}
                aria-current={pilih ? "true" : undefined}
                onClick={() => onPilih(i)}
                onKeyDown={(e) => tombolBaris(e, idx)}
                onPointerEnter={(e) => e.pointerType === "mouse" && setSorot(i.id)}
                onPointerLeave={(e) => e.pointerType === "mouse" && setSorot(null)}
                onFocus={() => setSorot(i.id)}
                onBlur={() => setSorot(null)}
              >
                <span className={`tgh__no is-${k}`}>T{idx + 1}</span>
                <span className="tgh__barisisi">
                  <b>{i.label}</b>
                  <small>{i.dueDate ? tanggalPanjang(i.dueDate) : "belum dijadwalkan"}</small>
                </span>
                <span className="tgh__barisnominal">{formatRupiah(i.amount)}</span>
                <span className={`tgh__keping is-${k}`}>{k === "lewat" ? kalimatTenggat(i) : LABEL_KEADAAN[k]}</span>
              </button>
            </li>
          );
        })}
      </ol>

      <footer className="tgh__kontrakkaki">
        <span>Jumlah {l.termin.length} termin</span>
        <b>{formatRupiah(jumlahTermin)}</b>
        <small>
          {l.kontrak > 0
            ? `${Math.round((jumlahTermin / l.kontrak) * 100)}% dari kontrak`
            : "nilai kontrak belum diisi"}
        </small>
      </footer>
    </section>
  );
}

function Kerangka() {
  return (
    <div className="tgh tgh--rangka" aria-busy="true">
      <div className="tgh__papan">
        <header className="tgh__kop">
          <div className="tgh__utama">
            <span className="rk rk--gelap" style={{ width: 150, height: 10 }} />
            <span className="rk rk--gelap" style={{ width: 230, height: 28 }} />
            <span className="rk rk--gelap" style={{ width: 160, height: 10 }} />
          </div>
        </header>
        <section className="tgh__jadwal">
          <div className="tgh__lajur-lajur">
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="tgh__lajur">
                <span className="rk rk--gelap" style={{ width: 150, height: 12 }} />
                <span className="rk rk--gelap" style={{ height: 4 }} />
                <span />
              </div>
            ))}
          </div>
        </section>
        <div className="tgh__bawah">
          <section className="tgh__jepit">
            <span className="tgh__klip" />
            <div className="tgh__surat tgh__surat--rangka" />
          </section>
          <section className="tgh__kontrak" />
        </div>
      </div>
    </div>
  );
}

/* Termin baru. Proyeknya dipilih DI DALAM dialog; sisa kontrak yang belum
   ditagihkan tampil begitu proyeknya dipilih, karena kesalahan yang paling
   mahal di sini menagih melebihi kontrak. */
function DialogTermin({
  proyek,
  tagihan,
  awal,
  pemicu,
  onSelesai,
}: {
  proyek: Proyek[];
  tagihan: Invoice[];
  /** Proyek yang sedang dibuka di lembar kontrak — dipilihkan dulu. */
  awal?: string;
  pemicu: ReactNode;
  onSelesai: (id: string) => void;
}) {
  const toast = useToast();
  const [buka, setBuka] = useState(false);
  const [idProyek, setIdProyek] = useState("");
  const [label, setLabel] = useState("");
  const [nominal, setNominal] = useState("");
  const [tenggat, setTenggat] = useState("");
  const [kirim, setKirim] = useState(false);

  const angka = Number(nominal.replace(/\D/g, "")) || 0;
  const p = proyek.find((x) => x.id === idProyek);
  const milik = tagihan.filter((i) => i.projectId === idProyek);
  const ditagihkan = milik.reduce((a, i) => a + i.amount, 0);
  const kontrak = p?.contractValue ?? 0;
  const sisa = kontrak - ditagihkan;
  const alasan = !idProyek
    ? "Pilih proyeknya dulu."
    : label.trim().length < 2
      ? "Isi nama termin, minimal 2 huruf."
      : angka <= 0
        ? "Isi nominalnya."
        : null;
  const lewatKontrak = kontrak > 0 && angka > sisa;

  function saatBuka(b: boolean) {
    setBuka(b);
    if (b) {
      setIdProyek(awal ?? "");
      setLabel(`Termin ${tagihan.filter((i) => i.projectId === (awal ?? "")).length + 1}`);
      setNominal("");
      setTenggat("");
    }
  }

  function gantiProyek(id: string) {
    setIdProyek(id);
    /* Nama bawaan mengikuti nomor urut di proyek itu selama staf belum
       mengetik sendiri. */
    setLabel((l) =>
      /^Termin \d+$/.test(l) || !l ? `Termin ${tagihan.filter((i) => i.projectId === id).length + 1}` : l,
    );
  }

  async function simpan() {
    if (alasan) return;
    setKirim(true);
    try {
      const urutan = milik.reduce((m, i) => Math.max(m, i.sortOrder), 0) + 1;
      const { id } = await tambahInvoice(idProyek, label.trim(), angka, tenggat || null, urutan);
      setBuka(false);
      onSelesai(id);
      toast({
        judul: "Termin ditambahkan sebagai Draf",
        keterangan: `${label.trim()} — ${formatRupiah(angka)}. Terbitkan dari suratnya saat ditagihkan ke klien.`,
        nada: "sukses",
      });
    } catch (e) {
      toast({ judul: "Gagal menambah termin", keterangan: (e as Error).message, nada: "gagal" });
    } finally {
      setKirim(false);
    }
  }

  return (
    <Dialog
      open={buka}
      onOpenChange={saatBuka}
      title="Termin baru"
      trigger={pemicu}
      footer={
        <div className="kd-form__kaki">
          {alasan && <small className="kd-form__alasan">{alasan}</small>}
          <Tombol memuat={kirim} ukuran="large" jenis="primary" disabled={Boolean(alasan) || kirim} onClick={simpan}>
            {kirim ? "Menyimpan…" : "Simpan"}
          </Tombol>
        </div>
      }
    >
      <div className="kd-form">
        <Bidang label="Proyek">
          {(b) => (
            <Kombo
              id={b.id}
              opsi={proyek.map((x) => ({ nilai: x.id, label: x.title, ket: x.client || undefined }))}
              nilai={idProyek || undefined}
              onUbah={gantiProyek}
              placeholder="Pilih proyek…"
              cariPlaceholder="Cari proyek atau klien…"
            />
          )}
        </Bidang>
        {p && (
          <p className="tgh__konteks">
            {kontrak > 0 ? (
              <>
                Kontrak <b>{formatRupiah(kontrak)}</b> · sudah dalam termin <b>{formatRupiah(ditagihkan)}</b> ({milik.length}{" "}
                termin) · sisa <b>{formatRupiah(Math.max(0, sisa))}</b>
              </>
            ) : (
              <>Nilai kontrak proyek ini belum diisi — sisa kontrak tidak bisa dihitung.</>
            )}
          </p>
        )}
        <Isian
          label="Nama termin"
          placeholder="mis. Termin 2 — gambar kerja"
          maxLength={120}
          value={label}
          onChange={(e) => setLabel(e.currentTarget.value)}
        />
        <div className="kd-form__dua">
          <IsianTempel
            label="Nominal"
            kiri="Rp"
            inputMode="numeric"
            placeholder="0"
            value={angka ? angka.toLocaleString("id-ID") : nominal}
            onChange={(e) => setNominal(e.currentTarget.value)}
          />
          <IsianTanggal label="Tenggat (boleh kosong)" nilai={tenggat} onUbah={setTenggat} placeholder="Belum dijadwalkan" />
        </div>
        {/* Peringatan, bukan penghalang: adendum kontrak memang ada. */}
        {lewatKontrak && (
          <Peringatan nada="awas" judul="Melebihi sisa kontrak">
            Sisa kontrak <b>{formatRupiah(Math.max(0, sisa))}</b>. Periksa lagi — atau perbarui nilai kontraknya dulu kalau
            memang ada adendum.
          </Peringatan>
        )}
      </div>
    </Dialog>
  );
}

export function TagihanKit() {
  return (
    <ToastProvider>
      <RequireAuth skeleton={<Kerangka />}>
        <Isi />
      </RequireAuth>
    </ToastProvider>
  );
}
