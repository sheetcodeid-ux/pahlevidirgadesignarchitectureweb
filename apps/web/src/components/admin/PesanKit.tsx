import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { RequireAuth } from "./RequireAuth";
import { GagalMuat } from "./gagalMuat";
import { ToastProvider, useToast } from "../kit/Toast";
import { Cari, Centang } from "../kit/Isian";
import { PilihMenu } from "../kit/Formulir";
import { DropdownMenu } from "../kit/Overlay";
import { Ikon } from "../kit/Ikon";
import { ArrowClockwise, CaretDown, CaretLeft, CaretRight, ChatTeardropDots, NavEnvelope, WarningOctagon } from "../kit/ikon";
import { Hitung, geraknya } from "./hitung";
import { CATEGORY_LABELS } from "../../lib/api";
import { formatRupiahRingkas } from "../../lib/format";
import { nomorAgenda } from "../../lib/nomorDokumen";
import { nomorWa } from "../../lib/telepon";
import { pisahLokasi, rentangAnggaran, type RentangAnggaran } from "../../lib/briefPesan";
import {
  daftarPesan,
  ubahStatusPesan,
  ambilSettings,
  bacaCache,
  tulisCache,
  type Pesan,
  type StudioSettings,
  STATUS_PESAN,
} from "../../lib/admin";

/* =============================================================================
   Pesan Masuk = BUKU AGENDA SURAT MASUK + LEMBAR BRIEF AWAL.

   Di kantor arsitek, surat dari calon klien dicatat dulu di BUKU AGENDA
   SURAT MASUK — nomor agenda, tanggal terima, dari siapa, perihal — lalu
   dipindah ke LEMBAR BRIEF AWAL, formulir konsultasi yang diisi studio:
   siapa kliennya, di mana tapaknya, jenis proyek, anggaran, kebutuhannya,
   dan sudah sampai mana tindak lanjutnya. Halaman ini dua benda itu, di
   papan hijau berjahit (`--kas-bidang`) yang dipakai halaman keuangan.

   1. KOP — Baru (dengan umur surat tertua yang belum dibalas), Dihubungi,
      Prospek (porsinya dari seluruh surat), Selesai. Tiap sel sekaligus
      saringan status.
   2. BUKU AGENDA — kertas bergaris dengan kolom tercetak, per BULAN.
      Nomor SM-YYMM-NN = urutan masuk di antara SEMUA surat bulan itu
      (`nomorAgenda`, satu sumber dengan panel Pesan di kepala halaman).
      Cap status di kolom terakhir. Centang = ubah status beberapa surat
      sekaligus.
   3. REKAP PER JENIS — batang bertumpuk + kunci yang sekaligus saringan.
   4. LEMBAR BRIEF AWAL — kertas putih tetap berbingkai cetak ganda: kop
      bernomor agenda + CAP status, Dari/Kontak/Lokasi (lokasi dibaca dari
      baris "Lokasi tapak:" di depan pesan), daftar JENIS PROYEK tercetak
      dengan centang pilihan klien, PENGGARIS ANGGARAN logaritmik (rentang
      klien diarsir, titik = anggaran surat lain), kebutuhan yang ditulis
      klien, ALUR tindak lanjut (Diterima → Dihubungi → Prospek → Selesai)
      yang sekaligus pengubah status, Balas email / WhatsApp. Di bawahnya
      TUMPUKAN: tepi dua surat berikutnya, yang bisa ditarik.

   Tidak ada tombol hapus, sengaja: API-nya cuma mengubah status, dan pesan
   calon klien yang terhapus tidak bisa dicari lagi saat orangnya menelepon
   tiga bulan kemudian. "Selesai" menyingkirkannya tanpa menghilangkannya.

   Gerak — hanya karena perbuatan (jebakan #74), seketika bila gerak
   dikurangi: memilih surat MENARIK lembar brief-nya dari tumpukan (lembar
   lama turun kembali ke tumpukan, yang baru naik menutupinya, serentak);
   mengubah status MENCAP ulang cap-nya, di lembar dan di baris agendanya,
   dan angka kop berhitung.
   ============================================================================= */

const STATUS = STATUS_PESAN;
const JENIS: Record<string, string> = CATEGORY_LABELS;
const URUT_JENIS = Object.keys(CATEGORY_LABELS);

interface Langkah {
  nilai: string;
  label: string;
  ket: string;
}
const ALUR: Langkah[] = [
  { nilai: "new", label: "Diterima", ket: "belum dibalas" },
  { nilai: "contacted", label: "Dihubungi", ket: "sudah dibalas" },
  { nilai: "qualified", label: "Prospek", ket: "calon klien serius" },
  { nilai: "closed", label: "Selesai", ket: "diarsip" },
];
const LANGKAH = Object.fromEntries(ALUR.map((l, i) => [l.nilai, i])) as Record<string, number>;

const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const BULAN_PENDEK = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

const PERIODE = [
  { nilai: "semua", label: "Semua waktu" },
  { nilai: "bulan", label: "Bulan ini" },
  { nilai: "3", label: "3 bulan" },
];

const jam = (d: Date) => `${String(d.getHours()).padStart(2, "0")}.${String(d.getMinutes()).padStart(2, "0")}`;
const kunciBulan = (iso: string) => iso.slice(0, 7);
/** Kunci bulan menurut zona peramban (createdAt UTC bisa jatuh di bulan lain). */
function bulanLokal(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
const umurHari = (iso: string) => Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 864e5));
const kataUmur = (n: number) => (n === 0 ? "hari ini" : n === 1 ? "kemarin" : `${n} hari lalu`);
const umurPendek = (n: number) => (n === 0 ? "hari ini" : `${n} hr`);

/* ---- Penggaris anggaran: skala log 50 jt – 10 M ------------------------- */
const LOG_MIN = Math.log10(5e7);
const LOG_MAKS = 10;
const posAnggaran = (v: number) => Math.min(1, Math.max(0, (Math.log10(v) - LOG_MIN) / (LOG_MAKS - LOG_MIN)));
const TAKIK: { v: number; label?: string }[] = [
  { v: 1e8, label: "100 jt" },
  { v: 2.5e8, label: "250 jt" },
  { v: 5e8, label: "500 jt" },
  { v: 1e9, label: "1 M" },
  { v: 1.5e9 },
  { v: 2.5e9 },
  { v: 5e9, label: "5 M" },
];
const titikTengah = (r: RentangAnggaran) =>
  r.min && r.max ? Math.sqrt(r.min * r.max) : (r.min ?? r.max ?? 0);

/** "Rp500 jt – Rp1,5 M" / "< Rp500 jt" / "> Rp5 M" — teks pendek baris agenda. */
function ringkasAnggaran(r: RentangAnggaran | null, asli: string | undefined): string {
  if (!r) return asli?.trim() ? asli.trim() : "anggaran —";
  const f = formatRupiahRingkas;
  if (r.min === null && r.max !== null) return `< ${f(r.max)}`;
  if (r.max === null && r.min !== null) return `> ${f(r.min)}`;
  if (r.min === r.max) return f(r.min!);
  return `${f(r.min!)}–${f(r.max!)}`;
}

/** Rentang menurut periode saringan; null = semua. */
function batasPeriode(periode: string): Date | null {
  const k = new Date();
  if (periode === "bulan") return new Date(k.getFullYear(), k.getMonth(), 1);
  if (periode === "3") return new Date(k.getFullYear(), k.getMonth() - 2, 1);
  return null;
}

/** Surat bawaan: yang BARU paling baru (sama dengan surat teratas panel
    Pesan), kalau tidak ada yang baru, surat terbaru. */
function bawaan(urut: Pesan[]): Pesan | null {
  return urut.find((p) => p.status === "new") ?? urut[0] ?? null;
}

function Isi() {
  const toast = useToast();
  const [pesan, setPesan] = useState<Pesan[] | null>(() => bacaCache<Pesan[]>("pesan:"));
  const [galat, setGalat] = useState<string | null>(null);
  const [cari, setCari] = useState("");
  const [saring, setSaring] = useState("semua");
  const [jenis, setJenis] = useState("semua");
  const [periode, setPeriode] = useState("semua");
  const [pilihId, setPilihId] = useState<string | null>(() =>
    typeof location === "undefined" ? null : new URLSearchParams(location.search).get("id"),
  );
  const [centang, setCentang] = useState<string[]>([]);
  /* Kunci settings milik Info Studio — dibaca saja, tidak ditulis (jebakan #8). */
  const [setelan, setSetelan] = useState<StudioSettings | null>(() => bacaCache<StudioSettings>("settings"));
  /* Cap yang baru saja berganti; dicap ulang sekali. */
  const [tercap, setTercap] = useState<string[]>([]);
  /* Angka kop berhitung hanya sesudah perbuatan, tidak saat data datang. */
  const [kopHidup, setKopHidup] = useState(false);
  const mejaRef = useRef<HTMLDivElement>(null);
  const bekasRef = useRef<HTMLDivElement>(null);
  const tarikRef = useRef(false);
  const fokusKe = useRef<string | null>(null);
  const waktu = useRef<number[]>([]);

  function muat() {
    daftarPesan()
      .then((d) => {
        tulisCache("pesan:", d);
        setPesan(d);
        setGalat(null);
      })
      .catch((e) => setGalat((e as Error).message));
  }
  useEffect(muat, []);
  useEffect(() => {
    ambilSettings().then(setSetelan).catch(() => {});
  }, []);
  useEffect(() => () => waktu.current.forEach((t) => clearTimeout(t)), []);

  const semua = pesan ?? [];
  const terurut = useMemo(
    () => semua.slice().sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0)),
    [pesan],
  );
  const nomor = useMemo(() => nomorAgenda(semua), [pesan]);
  const rentang = useMemo(() => new Map(semua.map((p) => [p.id, rentangAnggaran(p.budgetRange)])), [pesan]);
  const lokasi = useMemo(() => new Map(semua.map((p) => [p.id, pisahLokasi(p.message)])), [pesan]);

  const batas = batasPeriode(periode);
  const dalamPeriode = useMemo(
    () => terurut.filter((p) => !batas || new Date(p.createdAt) >= batas),
    [terurut, periode],
  );

  const tampak = useMemo(() => {
    const q = cari.trim().toLowerCase();
    return dalamPeriode.filter(
      (p) =>
        (saring === "semua" || p.status === saring) &&
        (jenis === "semua" || (p.projectType ?? "lain") === jenis) &&
        (!q ||
          [p.name, p.email, p.phone, p.message, p.budgetRange, p.projectType && JENIS[p.projectType], nomor.get(p.id)]
            .filter(Boolean)
            .some((v) => String(v).toLowerCase().includes(q))),
    );
  }, [dalamPeriode, cari, saring, jenis, nomor]);

  /* Yang dipilih harus ada di daftar yang TAMPAK — kalau saringan
     menyembunyikannya, lembar brief pindah ke surat bawaan yang tampak. */
  const indeks = tampak.findIndex((p) => p.id === pilihId);
  const kini = indeks >= 0 ? tampak[indeks]! : bawaan(tampak);
  const posisi = kini ? tampak.indexOf(kini) : -1;

  /* ---- Kop ---- */
  const hitung = (s: string) => semua.filter((p) => p.status === s).length;
  const nBaru = hitung("new");
  const nHubung = hitung("contacted");
  const nProspek = hitung("qualified");
  const nSelesai = hitung("closed");
  const pTangani = semua.length ? ((semua.length - nBaru) / semua.length) * 100 : 0;
  const pProspek = semua.length ? (nProspek / semua.length) * 100 : 0;
  const tertua = semua.filter((p) => p.status === "new").reduce<string | null>((m, p) => (!m || p.createdAt < m ? p.createdAt : m), null);

  /* ---- Rekap per jenis (periode yang dipilih) ---- */
  const rekap = useMemo(() => {
    const per = new Map<string, number>();
    for (const p of dalamPeriode) per.set(p.projectType ?? "lain", (per.get(p.projectType ?? "lain") ?? 0) + 1);
    const baris = [...URUT_JENIS, "lain"]
      .filter((k) => per.has(k))
      .map((k) => ({ kunci: k, label: k === "lain" ? "Tanpa jenis" : JENIS[k] ?? k, n: per.get(k)! }))
      .sort((a, b) => b.n - a.n);
    return { total: dalamPeriode.length, baris: baris.map((b, i) => ({ ...b, tingkat: Math.min(i, 5) })) };
  }, [dalamPeriode]);

  /* ---- Agenda per bulan ---- */
  const perBulan = useMemo(() => {
    const kelompok: { kunci: string; isi: Pesan[] }[] = [];
    for (const p of tampak) {
      const k = bulanLokal(p.createdAt);
      const akhir = kelompok[kelompok.length - 1];
      if (akhir && akhir.kunci === k) akhir.isi.push(p);
      else kelompok.push({ kunci: k, isi: [p] });
    }
    return kelompok;
  }, [tampak]);
  const jumlahBulan = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of semua) m.set(bulanLokal(p.createdAt), (m.get(bulanLokal(p.createdAt)) ?? 0) + 1);
    return m;
  }, [pesan]);

  /* ---- Memilih surat: lembar brief ditarik dari tumpukan ---- */
  function pilih(p: Pesan, gerak = true) {
    if (kini && p.id !== kini.id && gerak && geraknya()) {
      const lembar = mejaRef.current?.querySelector<HTMLElement>(":scope > .agd__lembar");
      const bekas = bekasRef.current;
      if (lembar && bekas) {
        /* Salinan lembar lama di wadah yang tidak dirender React; ia turun
           kembali ke tumpukan sementara lembar baru naik menutupinya. */
        const s = lembar.cloneNode(true) as HTMLElement;
        s.removeAttribute("id");
        s.querySelectorAll("[id]").forEach((x) => x.removeAttribute("id"));
        s.setAttribute("inert", "");
        s.classList.add("agd__salinan");
        s.style.height = `${lembar.getBoundingClientRect().height}px`;
        bekas.replaceChildren(s);
        tarikRef.current = true;
      }
    }
    setPilihId(p.id);
    history.replaceState(null, "", `?id=${encodeURIComponent(p.id)}`);
  }

  useLayoutEffect(() => {
    if (!tarikRef.current) return;
    tarikRef.current = false;
    /* `:scope >` — salinan di `.agd__bekas` juga berkelas agd__lembar dan
       ada LEBIH DULU di DOM; tanpa itu yang dianimasikan salinannya. */
    const lembar = mejaRef.current?.querySelector<HTMLElement>(":scope > .agd__lembar");
    const s = bekasRef.current?.firstElementChild as HTMLElement | null;
    const lembut = "cubic-bezier(0.22, 0.7, 0.2, 1)";
    lembar?.animate(
      [
        { transform: "translateY(26px) rotate(-0.9deg)", boxShadow: "0 0 0 transparent" },
        { transform: "none" },
      ],
      { duration: 460, easing: lembut },
    );
    if (s) {
      const a = s.animate(
        [{ transform: "none", opacity: 1 }, { transform: "translateY(18px) scale(0.985)", opacity: 0 }],
        { duration: 460, easing: lembut },
      );
      a.onfinish = () => s.remove();
    }
  }, [kini?.id]);

  /* Fokus papan ketik mengikuti pilihan di buku agenda. */
  useLayoutEffect(() => {
    const id = fokusKe.current;
    if (!id) return;
    fokusKe.current = null;
    const el = document.querySelector<HTMLElement>(`[data-surat="${CSS.escape(id)}"] .agd__buka`);
    el?.focus();
    el?.scrollIntoView({ block: "nearest" });
  }, [kini?.id]);

  /* Baris terpilih dijaga kelihatan di halaman buku — surat dari `?id=`,
     dari tumpukan, atau dari tombol sebelum/sesudah bisa ada di bawah
     lipatan. Yang digulir cuma kotak halaman buku (tanpa gerak), bukan
     dokumennya; kepala bulan yang menempel ikut diperhitungkan. */
  const halamanRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const h = halamanRef.current;
    const el = kini ? h?.querySelector<HTMLElement>(`[data-surat="${CSS.escape(kini.id)}"]`) : null;
    if (!h || !el) return;
    const kotak = h.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    const kepala = el.closest(".agd__bulan")?.querySelector("h3")?.getBoundingClientRect().height ?? 0;
    if (r.top < kotak.top + kepala) h.scrollTop -= kotak.top + kepala - r.top;
    else if (r.bottom > kotak.bottom) h.scrollTop += r.bottom - kotak.bottom;
  }, [kini?.id, pesan === null]);

  function tombolAgenda(e: KeyboardEvent<HTMLElement>) {
    if (!kini) return;
    let tuju: Pesan | undefined;
    if (e.key === "ArrowDown") tuju = tampak[posisi + 1];
    else if (e.key === "ArrowUp") tuju = tampak[posisi - 1];
    else if (e.key === "Home") tuju = tampak[0];
    else if (e.key === "End") tuju = tampak[tampak.length - 1];
    else return;
    e.preventDefault();
    if (tuju && tuju.id !== kini.id) {
      fokusKe.current = tuju.id;
      pilih(tuju, !e.repeat);
    }
  }

  /* ---- Mengubah status ---- */
  async function ubah(ids: string[], status: string) {
    const target = semua.filter((p) => ids.includes(p.id) && p.status !== status);
    if (target.length === 0) return;
    const hasil = await Promise.allSettled(target.map((p) => ubahStatusPesan(p.id, status)));
    const berhasil = target.filter((_, i) => hasil[i]!.status === "fulfilled").map((p) => p.id);
    if (berhasil.length) {
      setKopHidup(true);
      setTercap(berhasil);
      setPesan((cur) => {
        const baru = cur?.map((x) => (berhasil.includes(x.id) ? { ...x, status } : x)) ?? null;
        if (baru) tulisCache("pesan:", baru);
        return baru;
      });
      waktu.current.push(
        window.setTimeout(() => {
          setTercap([]);
          setKopHidup(false);
        }, 900),
      );
    }
    if (berhasil.length === target.length) {
      toast({
        judul: "Status diperbarui",
        keterangan:
          target.length === 1 ? `${target[0]!.name} → ${STATUS[status]}` : `${target.length} surat → ${STATUS[status]}`,
        nada: "sukses",
      });
    } else {
      toast({
        judul: "Sebagian gagal diperbarui",
        keterangan: `${target.length - berhasil.length} dari ${target.length} surat tidak berubah. Coba lagi.`,
        nada: "gagal",
      });
    }
  }

  function tombolAlur(e: KeyboardEvent<HTMLElement>) {
    if (!kini) return;
    const i = LANGKAH[kini.status] ?? 0;
    let j = i;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") j = Math.min(ALUR.length - 1, i + 1);
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") j = Math.max(0, i - 1);
    else if (e.key === "Home") j = 0;
    else if (e.key === "End") j = ALUR.length - 1;
    else return;
    e.preventDefault();
    if (j !== i) {
      ubah([kini.id], ALUR[j]!.nilai);
      requestAnimationFrame(() => document.querySelector<HTMLElement>(`.agd__stasiun[data-langkah="${ALUR[j]!.nilai}"]`)?.focus());
    }
  }

  const studio = setelan?.studioName?.trim() || "Studio Dirga Pahlevi Architecture";
  const semuaTercentang = tampak.length > 0 && tampak.every((p) => centang.includes(p.id));
  const adaSaring = cari.trim() !== "" || saring !== "semua" || jenis !== "semua" || periode !== "semua";

  if (galat && pesan === null) return <GagalMuat apa="Pesan masuk" galat={galat} />;
  if (pesan === null) return <Rangka />;

  /* ---- Baris agenda (fungsi, bukan komponen — jebakan #80) ---- */
  const baris = (p: Pesan) => {
    const dipilih = kini?.id === p.id;
    const d = new Date(p.createdAt);
    const lok = lokasi.get(p.id)?.lokasi;
    const r = rentang.get(p.id) ?? null;
    const jn = p.projectType ? JENIS[p.projectType] ?? p.projectType : null;
    return (
      <li
        key={p.id}
        data-surat={p.id}
        className={`agd__baris${dipilih ? " is-pilih" : ""}${p.status === "new" ? " is-baru" : ""}${centang.includes(p.id) ? " is-centang" : ""}`}
      >
        <span className="agd__k-centang">
          <Centang
            aria-label={`Centang ${nomor.get(p.id)} ${p.name}`}
            checked={centang.includes(p.id)}
            onChange={(e) => {
              const v = e.currentTarget.checked;
              setCentang((c) => (v ? [...c, p.id] : c.filter((x) => x !== p.id)));
            }}
          />
        </span>
        <button
          type="button"
          className="agd__buka"
          tabIndex={dipilih ? 0 : -1}
          aria-pressed={dipilih}
          aria-label={`${nomor.get(p.id)}, ${p.name}, ${jn ?? "tanpa jenis"}, ${STATUS[p.status] ?? p.status}, diterima ${d.getDate()} ${BULAN[d.getMonth()]}`}
          onClick={() => {
            pilih(p);
            /* Di layar sempit lembar brief ada di bawah buku: bawa ke sana. */
            if (matchMedia("(max-width: 1288px)").matches)
              requestAnimationFrame(() =>
                mejaRef.current?.scrollIntoView({ block: "start", behavior: geraknya() ? "smooth" : "auto" }),
              );
          }}
        />
        <span className="agd__k-no" aria-hidden="true">{nomor.get(p.id)}</span>
        <span className="agd__k-tgl" aria-hidden="true">
          <b>{d.getDate()} {BULAN_PENDEK[d.getMonth()]}</b>
          <small>{jam(d)}</small>
        </span>
        <span className="agd__k-dari" aria-hidden="true">
          <b>{p.name}</b>
          <small>{lok ?? p.email}</small>
        </span>
        <span className="agd__k-hal" aria-hidden="true">
          <b className={jn ? undefined : "is-kosong"}>{jn ?? "tanpa jenis"}</b>
          <small>{ringkasAnggaran(r, p.budgetRange)}</small>
        </span>
        <span className="agd__k-status" aria-hidden="true">
          <i key={p.status} className={`agd__capkecil is-${p.status}${tercap.includes(p.id) ? " is-tercap" : ""}`}>
            {STATUS[p.status] ?? p.status}
          </i>
        </span>
      </li>
    );
  };

  /* ---- Lembar brief ---- */
  const brief = () => {
    if (!kini) {
      return (
        <article className="agd__lembar agd__lembar--kosong">
          <p className="agd__dlabel">Lembar brief awal</p>
          <p className="agd__kosongisi">
            {semua.length === 0
              ? "Belum ada surat masuk. Pesan dari form kontak situs dicatat di buku agenda ini, dan salinannya dikirim ke email studio."
              : "Tidak ada surat yang cocok dengan saringan ini."}
          </p>
        </article>
      );
    }
    const d = new Date(kini.createdAt);
    const { lokasi: lok, isi } = lokasi.get(kini.id) ?? { lokasi: null, isi: kini.message };
    const paragraf = isi.split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean);
    const r = rentang.get(kini.id) ?? null;
    const wa = nomorWa(kini.phone);
    const langkah = LANGKAH[kini.status] ?? 0;
    const umur = umurHari(kini.createdAt);
    const lain = semua
      .filter((p) => p.id !== kini.id)
      .map((p) => rentang.get(p.id))
      .filter((x): x is RentangAnggaran => Boolean(x))
      .map((x) => posAnggaran(titikTengah(x)));
    const sapa = kini.name.split(/\s+/)[0] ?? kini.name;
    const subjek = `Balasan dari ${studio}`;
    const badanEmail = `Halo ${sapa},\n\nTerima kasih sudah menghubungi ${studio}.\n\n`;
    const teksWa = `Halo ${sapa}, kami dari ${studio}. Terima kasih atas pesan Anda lewat situs kami.`;
    const a = r ? (r.min === null ? 0 : posAnggaran(r.min)) : 0;
    const b = r ? (r.max === null ? 1 : posAnggaran(r.max)) : 0;
    const tunggal = Boolean(r && r.min !== null && r.min === r.max);

    return (
      <article className="agd__lembar" aria-labelledby="agd-judul">
        <header className="agd__dkop">
          <div>
            <p className="agd__dlabel">Lembar brief awal</p>
            <h2 id="agd-judul">{kini.name}</h2>
            <small>
              No. agenda <b>{nomor.get(kini.id)}</b> · diterima {HARI[d.getDay()]}, {d.getDate()} {BULAN[d.getMonth()]} {d.getFullYear()},{" "}
              {jam(d)}
            </small>
          </div>
          <span key={kini.status} className={`agd__cap is-${kini.status}${tercap.includes(kini.id) ? " is-tercap" : ""}`}>
            <b>{STATUS[kini.status] ?? kini.status}</b>
            {/* Tanggal MASUK, seperti cap agenda surat sungguhan — tabel inquiries
                tidak menyimpan kapan statusnya berubah. */}
            <small>{kini.status === "new" ? kataUmur(umur) : `masuk ${d.getDate()}.${d.getMonth() + 1}.${String(d.getFullYear()).slice(2)}`}</small>
          </span>
        </header>

        <dl className="agd__isian">
          <div>
            <dt>Kontak</dt>
            <dd>
              <a href={`mailto:${kini.email}`}>{kini.email}</a>
              {kini.phone ? <span className="agd__telp">{kini.phone}</span> : <span className="agd__tanpa">tanpa telepon</span>}
            </dd>
          </div>
          <div>
            <dt>Lokasi</dt>
            <dd>{lok ? <span className="agd__lokasi">{lok}</span> : <span className="agd__tanpa">tidak disebut</span>}</dd>
          </div>
        </dl>

        <section className="agd__bagian" aria-labelledby="agd-jenis">
          <h3 id="agd-jenis" className="agd__dlabel">
            Jenis proyek{!kini.projectType && <span className="agd__catat"> · klien tidak memilih</span>}
          </h3>
          <ul className="agd__jenis">
            {URUT_JENIS.map((k) => {
              const ya = kini.projectType === k;
              return (
                <li key={k} className={ya ? "is-ya" : undefined}>
                  <i aria-hidden="true">
                    {ya && (
                      <svg width="12" height="12" viewBox="0 0 12 12">
                        <path d="M2 6.4 4.8 9 10 2.8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </i>
                  {JENIS[k]}
                  {ya && <span className="sr-only"> (dipilih klien)</span>}
                </li>
              );
            })}
          </ul>
        </section>

        <section className="agd__bagian" aria-labelledby="agd-anggaran">
          <h3 id="agd-anggaran" className="agd__dlabel agd__anggarankop">
            Anggaran
            <span className="agd__asli">{kini.budgetRange?.trim() ? `“${kini.budgetRange.trim()}”` : "tidak diisi"}</span>
          </h3>
          <div
            className="agd__mistar"
            role="img"
            aria-label={r ? `Anggaran ${ringkasAnggaran(r, kini.budgetRange)} pada skala 50 juta sampai 10 miliar` : "Anggaran tidak terbaca"}
          >
            <div className="agd__jalur">
              {TAKIK.map((t) => (
                <i key={t.v} className={t.label ? "is-utama" : undefined} style={{ left: `${posAnggaran(t.v) * 100}%` }} />
              ))}
              {r && !tunggal && (
                <span
                  className={`agd__rentang${r.min === null ? " is-bukakiri" : ""}${r.max === null ? " is-bukakanan" : ""}`}
                  style={{ left: `${a * 100}%`, width: `${Math.max(0.02, b - a) * 100}%` }}
                />
              )}
              {r && tunggal && <span className="agd__titikanggaran" style={{ left: `${a * 100}%` }} />}
              {lain.map((x, i) => (
                <u key={i} style={{ left: `${x * 100}%` }} />
              ))}
            </div>
            <div className="agd__skala" aria-hidden="true">
              {TAKIK.filter((t) => t.label).map((t) => (
                <span key={t.v} style={{ left: `${posAnggaran(t.v) * 100}%` }}>
                  {t.label}
                </span>
              ))}
            </div>
          </div>
        </section>

        <section className="agd__bagian agd__kebutuhan" aria-labelledby="agd-butuh">
          <h3 id="agd-butuh" className="agd__dlabel">
            Kebutuhan <span className="agd__catat">· ditulis klien</span>
          </h3>
          <div className="agd__tulis" tabIndex={0} aria-labelledby="agd-butuh">
            {paragraf.length ? paragraf.map((t, i) => <p key={i}>{t}</p>) : <p className="agd__tanpa">Pesan kosong.</p>}
          </div>
        </section>

        <section className="agd__bagian" aria-labelledby="agd-tindak">
          <h3 id="agd-tindak" className="agd__dlabel">Tindak lanjut</h3>
          <div className="agd__alur" role="radiogroup" aria-labelledby="agd-tindak" onKeyDown={tombolAlur}>
            {ALUR.map((l, i) => (
              <button
                key={l.nilai}
                type="button"
                role="radio"
                data-langkah={l.nilai}
                aria-checked={kini.status === l.nilai}
                tabIndex={kini.status === l.nilai ? 0 : -1}
                className={`agd__stasiun${i < langkah ? " is-lewat" : ""}${i === langkah ? " is-kini" : ""}`}
                onClick={() => ubah([kini.id], l.nilai)}
              >
                <i aria-hidden="true">{i + 1}</i>
                <span>{l.label}</span>
                <small>{l.ket}</small>
              </button>
            ))}
          </div>
        </section>

        <footer className="agd__dkaki">
          <a className="agd__aksi" href={`mailto:${kini.email}?subject=${encodeURIComponent(subjek)}&body=${encodeURIComponent(badanEmail)}`}>
            <Ikon ikon={NavEnvelope} ukuran={14} />
            Balas email
          </a>
          {wa ? (
            <a className="agd__aksi" href={`https://wa.me/${wa}?text=${encodeURIComponent(teksWa)}`} target="_blank" rel="noreferrer">
              <Ikon ikon={ChatTeardropDots} ukuran={14} />
              WhatsApp
            </a>
          ) : (
            <span className="agd__aksi is-mati" aria-disabled="true" title="Klien tidak menulis nomor telepon">
              <Ikon ikon={ChatTeardropDots} ukuran={14} />
              WhatsApp
            </span>
          )}
          <span className="agd__navi">
            <button
              type="button"
              aria-label="Surat sebelumnya"
              disabled={posisi <= 0}
              onClick={() => tampak[posisi - 1] && pilih(tampak[posisi - 1]!)}
            >
              <Ikon ikon={CaretLeft} ukuran={14} />
            </button>
            <span>
              {posisi + 1} / {tampak.length}
            </span>
            <button
              type="button"
              aria-label="Surat berikutnya"
              disabled={posisi >= tampak.length - 1}
              onClick={() => tampak[posisi + 1] && pilih(tampak[posisi + 1]!)}
            >
              <Ikon ikon={CaretRight} ukuran={14} />
            </button>
          </span>
        </footer>
      </article>
    );
  };

  const berikut = kini ? [tampak[posisi + 1], tampak[posisi + 2]] : [undefined, undefined];

  return (
    <div className="agd">
      <div className="agd__papan">
        <header className="agd__kop">
          <div className="agd__kopjudul">
            <p>
              Buku agenda · {semua.length} surat · {Math.round(pTangani)}% ditangani
            </p>
            <h2>Surat masuk</h2>
          </div>
          <div className="agd__ringkas" role="group" aria-label="Saring menurut status">
            {(
              [
                ["new", nBaru, nBaru ? `tertua ${umurPendek(umurHari(tertua!))}` : "semua dibalas"],
                ["contacted", nHubung, "menunggu klien"],
                ["qualified", nProspek, `${Math.round(pProspek)}% surat`],
                ["closed", nSelesai, "diarsip"],
              ] as [string, number, string][]
            ).map(([s, n, ket]) => (
              <button
                key={s}
                type="button"
                className={`agd__rk is-${s}`}
                aria-pressed={saring === s}
                onClick={() => setSaring(saring === s ? "semua" : s)}
              >
                <small>{STATUS[s]}</small>
                <b>
                  <Hitung nilai={n} hidup={kopHidup} format={(v) => String(Math.round(v))} />
                </b>
                <span>{ket}</span>
              </button>
            ))}
          </div>
        </header>

        <div className="agd__alat">
          <Cari
            judul="Cari surat"
            placeholder="Cari nama, isi, nomor agenda…"
            className="agd__cari"
            value={cari}
            onChange={(e) => setCari(e.currentTarget.value)}
          />
          <PilihMenu
            label="Periode"
            nilai={periode}
            onUbah={setPeriode}
            opsi={PERIODE}
            pemicu={
              <button type="button" className={`agd__pilih${periode !== "semua" ? " is-aktif" : ""}`}>
                <span>{PERIODE.find((o) => o.nilai === periode)?.label}</span>
                <Ikon ikon={CaretDown} ukuran={12} />
              </button>
            }
          />
          {adaSaring && (
            <button
              type="button"
              className="agd__lepas"
              onClick={() => {
                setCari("");
                setSaring("semua");
                setJenis("semua");
                setPeriode("semua");
              }}
            >
              Lepas saringan
            </button>
          )}
          {centang.length > 0 && (
            <span className="agd__massal">
              <b>{centang.length} dicentang</b>
              <DropdownMenu
                align="start"
                trigger={
                  <button type="button" className="agd__pilih is-aktif">
                    <span>Ubah status</span>
                    <Ikon ikon={CaretDown} ukuran={12} />
                  </button>
                }
                sections={[
                  {
                    label: `Ubah status ${centang.length} surat`,
                    items: ALUR.map((l) => ({
                      label: `Tandai ${STATUS[l.nilai]!.toLowerCase()}`,
                      onSelect: () => ubah(centang, l.nilai).then(() => setCentang([])),
                    })),
                  },
                ]}
              />
              <button type="button" className="agd__lepas" onClick={() => setCentang([])}>
                lepas
              </button>
            </span>
          )}
          {setelan?.notifikasiEmailAktif === false && (
            <span className="agd__awas" title="Surat tetap tercatat di buku ini, tapi email pemberitahuan ke studio tidak terkirim.">
              <Ikon ikon={WarningOctagon} ukuran={14} />
              Email pemberitahuan mati
            </span>
          )}
          <button type="button" className="agd__muat" aria-label="Muat ulang" title="Muat ulang" onClick={muat}>
            <Ikon ikon={ArrowClockwise} ukuran={15} />
          </button>
        </div>

        <section className="agd__buku" aria-label="Buku agenda surat masuk">
          <div className="agd__kepalabuku">
            <span className="agd__k-centang">
              <Centang
                aria-label="Centang semua surat yang tampak"
                checked={semuaTercentang}
                onChange={() => setCentang(semuaTercentang ? [] : tampak.map((p) => p.id))}
              />
              <DropdownMenu
                align="start"
                trigger={
                  <button type="button" className="agd__caret" aria-label="Centang menurut status">
                    <Ikon ikon={CaretDown} ukuran={10} />
                  </button>
                }
                sections={[
                  {
                    label: "Centang",
                    items: [
                      { label: "Semua yang tampak", onSelect: () => setCentang(tampak.map((p) => p.id)) },
                      { label: "Tidak ada", onSelect: () => setCentang([]) },
                      ...ALUR.map((l) => ({
                        label: `Yang ${STATUS[l.nilai]!.toLowerCase()}`,
                        onSelect: () => setCentang(tampak.filter((p) => p.status === l.nilai).map((p) => p.id)),
                      })),
                    ],
                  },
                ]}
              />
            </span>
            <span>No. agenda</span>
            <span>Tgl.</span>
            <span>Dari</span>
            <span>Perihal</span>
            <span>Status</span>
          </div>
          <div className="agd__halaman" ref={halamanRef} onKeyDown={tombolAgenda}>
            {perBulan.map((k) => {
              const [th, bl] = k.kunci.split("-").map(Number);
              const total = jumlahBulan.get(k.kunci) ?? k.isi.length;
              const baru = k.isi.filter((p) => p.status === "new").length;
              return (
                <section key={k.kunci} className="agd__bulan" aria-label={`${BULAN[bl! - 1]} ${th}`}>
                  <h3>
                    <span>
                      {BULAN[bl! - 1]} {th}
                    </span>
                    <small>
                      {k.isi.length === total ? `${total} surat` : `${k.isi.length} dari ${total} surat`}
                      {baru > 0 && <em> · {baru} baru</em>}
                    </small>
                  </h3>
                  <ol>{k.isi.map(baris)}</ol>
                </section>
              );
            })}
            {tampak.length === 0 && (
              <p className="agd__kosong">
                {semua.length === 0
                  ? "Belum ada surat masuk. Pesan dari form kontak situs akan tercatat di sini."
                  : "Tidak ada surat yang cocok dengan pencarian atau saringan ini."}
              </p>
            )}
          </div>
        </section>

        <section className="agd__rekap" aria-labelledby="agd-rekap">
          <h3 id="agd-rekap">
            Rekap per jenis <small>· {PERIODE.find((o) => o.nilai === periode)?.label.toLowerCase()} · {rekap.total} surat</small>
          </h3>
          <div className="agd__batang" aria-hidden="true">
            {rekap.baris.map((x) => (
              <i
                key={x.kunci}
                className={`t${x.tingkat}${jenis !== "semua" && jenis !== x.kunci ? " is-redup" : ""}`}
                style={{ flexGrow: x.n } as CSSProperties}
              />
            ))}
          </div>
          <ul className="agd__kunci">
            {rekap.baris.map((x) => (
              <li key={x.kunci}>
                <button
                  type="button"
                  aria-pressed={jenis === x.kunci}
                  onClick={() => setJenis(jenis === x.kunci ? "semua" : x.kunci)}
                >
                  <i className={`t${x.tingkat}`} aria-hidden="true" />
                  {x.label}
                  <b>{x.n}</b>
                </button>
              </li>
            ))}
            {rekap.baris.length === 0 && <li className="agd__kosongrekap">Belum ada surat pada periode ini.</li>}
          </ul>
        </section>

        <div className="agd__meja" ref={mejaRef}>
          <div className="agd__bekas" ref={bekasRef} aria-hidden="true" />
          {brief()}
          <div className="agd__tumpuk">
            {berikut.map((p, i) =>
              p ? (
                <button
                  key={i}
                  type="button"
                  className={`agd__tepi agd__tepi--${i + 1}`}
                  aria-label={`Tarik surat ${nomor.get(p.id)} dari ${p.name}`}
                  onClick={() => pilih(p)}
                >
                  <b>{nomor.get(p.id)}</b>
                  <span>{p.name}</span>
                  <i className={`is-${p.status}`} aria-hidden="true" />
                </button>
              ) : (
                <span key={i} className={`agd__tepi agd__tepi--${i + 1} is-kosong`} aria-hidden="true" />
              ),
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* Kerangka memuat berbentuk papan dan setinggi papan aslinya. */
function Rangka() {
  return (
    <div className="agd" aria-busy="true">
      <div className="agd__papan">
        <div className="agd__kop agd__kop--rangka" />
        <div className="agd__alat" />
        <div className="agd__buku agd__buku--rangka" />
        <div className="agd__rekap agd__rekap--rangka" />
        <div className="agd__meja">
          <div className="agd__lembar agd__lembar--rangka" />
          <div className="agd__tumpuk">
            <span className="agd__tepi agd__tepi--1 is-kosong" />
            <span className="agd__tepi agd__tepi--2 is-kosong" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function PesanKit() {
  return (
    <RequireAuth skeleton={<Rangka />}>
      <ToastProvider>
        <Isi />
      </ToastProvider>
    </RequireAuth>
  );
}
