import { useEffect, useRef, useState, type ReactNode } from "react";
import { IsianPanjang } from "../kit/Formulir";
import { GagalMuat } from "./gagalMuat";
import { ToastProvider, useToast } from "../kit/Toast";
import { RequireAuth } from "./RequireAuth";
import { Tombol } from "../kit/Tombol";
import { Isian } from "../kit/Isian";
import { Lencana } from "../kit/Lencana";
import { Putar } from "../kit/Tampilan";
import { Ikon, type DataIkon } from "../kit/Ikon";
import {
  CheckCircle, FilePdf, Globe, House, ImageSquare, InstagramLogo, MagnifyingGlass, MapPinArea, NavEnvelope, NavReceipt, Phone,
  SpecialInvoice, Wallet,
} from "../kit/ikon";
import { Segmen } from "../kit/Segmen";
import { PenandaSimpan } from "./situsKit";
import { BulatSumbu, SampulLembar, TabLembar, tabDariAlamat, tulisTabKeAlamat } from "./lembarKit";
import {
  ambilSettings,
  simpanSettings,
  mintaUrlUnggahLogo,
  ZONA_WAKTU,
  bacaCache,
  tulisCache,
  type StudioSettings,
} from "../../lib/admin";
import { useCegahPindah } from "../../lib/cegahPindah";
import { JUDUL_BERANDA, KET_BERANDA } from "../../lib/beranda";

/* =============================================================================
   Info Studio — identitas studio: nama, logo, kontak, lokasi, zona waktu.

   Rupanya mengikuti "Selera pemilik" (CLAUDE.md) dan kerangka `lembarKit`
   yang sama dengan halaman Akun: sampul kertas kalkir — kali ini TAMPAK
   bangunan dengan penanda peil (±0.00, +3.50), bukan denah — kop lembar
   berisi data studio, logo besar yang menumpang di tepi sampul (bisa
   diklik dan diseret untuk mengganti), lalu empat tab. Tiap tab berisi
   isian di kiri dan PRATINJAU TEMPAT DATANYA BENAR-BENAR MUNCUL di kanan:
   - Identitas → kepala situs publik (wordmark tanpa ekor "Architecture",
     seperti Header.astro)
   - Kontak    → kaki situs publik (baris kosong dihilangkan, seperti
     Footer.astro)
   - Lokasi    → jam studio menurut zona waktu (jam panel & tanggal PDF)
   - Kop dokumen → kop surat PDF, digambar dengan ukuran `lib/pdf.ts`

   Logika dari versi sebelumnya dibawa apa adanya:
   - Empat isian WAJIB menahan tombol Simpan selama masih kosong.
   - Hanya kolom yang berubah yang dikirim.
   - Logo diunggah lebih dulu, lalu kuncinya baru berlaku saat Simpan —
     melepas logo juga baru berlaku saat Simpan, jadi masih bisa dibatalkan.
   - Hanya master admin yang boleh membuka halaman ini.
   Satu tombol Simpan di kepala untuk keempat tab; draf bertahan saat
   berpindah tab.
   ============================================================================= */

type Draf = Partial<StudioSettings>;
type Kunci = keyof StudioSettings;
type Tab = "identitas" | "kontak" | "lokasi" | "kop";

const TIPE_LOGO = new Set(["image/png", "image/jpeg", "image/webp"]);
const MAKS_LOGO = 2 * 1024 * 1024;
const WAJIB: Kunci[] = ["studioName", "city", "email", "phone"];
const LABEL_WAJIB: Partial<Record<Kunci, string>> = {
  studioName: "nama studio",
  city: "kota",
  email: "email",
  phone: "telepon",
};
/** Isian wajib per tab — angka amber di tab menunjuk tempat yang kosong. */
const WAJIB_TAB: Record<Tab, Kunci[]> = {
  identitas: ["studioName"],
  kontak: ["email", "phone"],
  lokasi: ["city"],
  kop: [],
};
const TAB: { nilai: Tab; label: string; ikon: DataIkon }[] = [
  { nilai: "identitas", label: "Identitas", ikon: House },
  { nilai: "kontak", label: "Kontak", ikon: Phone },
  { nilai: "lokasi", label: "Lokasi", ikon: MapPinArea },
  { nilai: "kop", label: "Kop dokumen", ikon: FilePdf },
];
const NAMA_TAB = TAB.map((t) => t.nilai);

/** Sama persis dengan Footer.astro: nomor 0812… jadi 62812…, wa.me menolak
 *  bentuk lokal. */
function waTautan(nomor: string) {
  const angka = nomor.replace(/[^\d+]/g, "");
  const intl = angka.startsWith("+") ? angka.slice(1) : angka.startsWith("0") ? `62${angka.slice(1)}` : angka;
  return `https://wa.me/${intl}`;
}

/** Sama persis dengan Header.astro: ekor generik dibuang dari wordmark. */
const EKOR = /\s+(architecture|architects|architect|studio|design|designs)$/i;
const wordmark = (nama: string) => (nama.trim() || "Dirga Pahlevi Architecture").replace(EKOR, "").toUpperCase();

/* ─── Sampul: tampak bangunan ─────────────────────────────────────────────── */

function TampakSampul() {
  const sumbuX = [70, 200, 330];
  // Kisi-kisi kayu di lantai atas: garis tegak tiap 7px.
  const kisi = Array.from({ length: 14 }, (_, i) => 152 + i * 7);
  return (
    <svg className="lbr-gambar ist__tampak" viewBox="0 0 470 116" fill="none" aria-hidden="true">
      <g className="lbr-sumbu">
        {sumbuX.map((x) => <line key={x} x1={x} y1={22} x2={x} y2={104} />)}
        {/* Garis peil, dari bangunan ke penandanya. */}
        <path d="M330 64 H432 M330 40 H432" />
      </g>
      {sumbuX.map((x, i) => <BulatSumbu key={x} x={x} y={11} teks={"ABC"[i]!} />)}
      <g className="lbr-tebal">
        {/* Tanah, dinding, pelat lantai, kolom bawah. */}
        <path d="M20 104 H440" />
        <path d="M76 104 V64 H324 V104" />
        <path d="M96 64 V40 H304 V64" />
      </g>
      <g className="lbr-tipis">
        {/* Atap tropis berteritis lebar. */}
        <path d="M58 40 L128 20 H272 L342 40 Z" />
        {/* Jendela kaca bawah, pintu, kisi-kisi atas. */}
        <path d="M110 74 H176 V100 H110 Z M143 74 V100" />
        <path d="M208 70 H236 V104" />
        <path d="M252 74 H306 V100 H252 Z" />
        {kisi.map((x) => <path key={x} d={`M${x} 45 V60`} />)}
        {/* Arsir tanah. */}
        {Array.from({ length: 30 }, (_, i) => 24 + i * 14).map((x) => <path key={x} d={`M${x} 104 L${x - 6} 112`} />)}
        {/* Penanda peil: segitiga terbalik di ujung garis. */}
        <path d="M432 104 L426 96 H438 Z M432 64 L426 56 H438 Z M432 40 L426 32 H438 Z" />
      </g>
      <g className="lbr-angka ist__peil">
        <text x={452} y={103}>±0.00</text>
        <text x={452} y={63}>+3.50</text>
        <text x={452} y={39}>+6.80</text>
      </g>
    </svg>
  );
}

/* ─── Pratinjau ──────────────────────────────────────────────────────────── */

/** Logo situs publik bawaan (segi enam teal) — Header/Footer.astro. */
function LogoBawaan({ ukuran }: { ukuran: number }) {
  return (
    <svg width={ukuran} height={ukuran} viewBox="0 0 20 20" fill="none" aria-hidden="true" className="ist__logobawaan">
      <path d="M10 1.5 18 6v8l-8 4.5L2 14V6l8-4.5Z" strokeWidth="1.6" />
      <path d="M10 6.5 14 9v4l-4 2.2L6 13V9l4-2.5Z" strokeWidth="1.2" />
    </svg>
  );
}

/** Jendela peramban. `tab` = judul di tab — nama studio ikut di sana
 *  karena BaseLayout menulis "<judul halaman> — <nama studio>". */
function BingkaiPeramban({ alamat, tab, logo, children }: { alamat: string; tab?: string; logo?: string | null; children: ReactNode }) {
  return (
    <div className="ist__peramban" aria-hidden="true">
      {tab && (
        <div className="ist__peramban-tabjalur">
          <span className="ist__peramban-tab">
            {logo ? <img src={logo} alt="" /> : <LogoBawaan ukuran={11} />}
            <span>{tab}</span>
          </span>
        </div>
      )}
      <div className="ist__peramban-bilah">
        <span className="ist__peramban-titik"><i /><i /><i /></span>
        <span className="ist__peramban-alamat"><Ikon ikon={Globe} ukuran={11} />{alamat}</span>
      </div>
      {children}
    </div>
  );
}

function Pratinjau({ judul, ket, aksi, children }: { judul: string; ket?: string; aksi?: ReactNode; children: ReactNode }) {
  return (
    <figure className="ist__pratinjau">
      <figcaption className="ist__pratinjau-judul">
        <b>{judul}</b>
        {ket && <span>{ket}</span>}
        {aksi}
      </figcaption>
      {children}
    </figure>
  );
}

/** Ponsel gambar garis berisi kepala situs versi ponsel — persis
 *  Header.astro di bawah titik-patahnya: logo, wordmark, dua garis menu. */
function BingkaiPonsel({ children }: { children: ReactNode }) {
  return (
    <div className="ist__ponselmeja" aria-hidden="true">
      <div className="ist__ponsel">
        <span className="ist__ponselponi" />
        <span className="ist__ponselstatus"><b>9.41</b><i /><i /></span>
        {children}
      </div>
      {/* Garis ukur lebar layar: 390 = lebar ponsel acuan di panel ini. */}
      <svg className="ist__ponselukur" viewBox="0 0 160 14" fill="none">
        <path d="M1 3 V11 M159 3 V11 M1 7 H159" />
        <text x="80" y="5">390</text>
      </svg>
    </div>
  );
}

/* ─── Jam studio ─────────────────────────────────────────────────────────── */

function jamDi(zona: string, d: Date) {
  return new Intl.DateTimeFormat("id-ID", { timeZone: zona, hour: "2-digit", minute: "2-digit" }).format(d).replace(":", ".");
}
function tanggalDi(zona: string, d: Date) {
  return new Intl.DateTimeFormat("id-ID", { timeZone: zona, weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(d);
}

/** Jam dinding bergaya busur derajat: 60 strip menit, strip tebal tiap
 *  lima, angka derajat 0/90/180/270 di cincin luar seperti busur gambar.
 *  Jarumnya dihitung dari jam DI ZONA STUDIO, bukan jam peramban. */
function JamBusur({ zona, kini }: { zona: string; kini: Date | null }) {
  let sj = 0;
  let sm = 0;
  if (kini) {
    const [j, m] = jamDi(zona, kini).split(".").map(Number);
    sm = (m ?? 0) * 6;
    sj = ((j ?? 0) % 12) * 30 + (m ?? 0) * 0.5;
  }
  return (
    <svg className="ist__busur" viewBox="0 0 120 120" fill="none" aria-hidden="true">
      <circle className="ist__busur-luar" cx="60" cy="60" r="57" />
      <circle className="ist__busur-dalam" cx="60" cy="60" r="44" />
      {Array.from({ length: 60 }, (_, i) => {
        const tebal = i % 5 === 0;
        return (
          <line
            key={i}
            className={tebal ? "ist__busur-strip ist__busur-strip--tebal" : "ist__busur-strip"}
            x1="60" y1={tebal ? 17 : 18} x2="60" y2="22"
            transform={`rotate(${i * 6} 60 60)`}
          />
        );
      })}
      {[0, 90, 180, 270].map((d) => {
        const r = (d - 90) * (Math.PI / 180);
        return (
          <text key={d} className="ist__busur-derajat" x={60 + Math.cos(r) * 50.5} y={60 + Math.sin(r) * 50.5 + 2.3}>
            {d}°
          </text>
        );
      })}
      {kini && (
        <>
          <line className="ist__busur-jarumjam" x1="60" y1="60" x2="60" y2="36" transform={`rotate(${sj} 60 60)`} />
          <line className="ist__busur-jarummenit" x1="60" y1="64" x2="60" y2="25" transform={`rotate(${sm} 60 60)`} />
        </>
      )}
      <circle className="ist__busur-poros" cx="60" cy="60" r="3.2" />
    </svg>
  );
}

function JamStudio({ zona }: { zona: string }) {
  // Dibaca sesudah hidrasi dan diperbarui tiap 20 detik — server tidak
  // tahu jamnya (jebakan #8).
  const [kini, setKini] = useState<Date | null>(null);
  useEffect(() => {
    setKini(new Date());
    const t = setInterval(() => setKini(new Date()), 20_000);
    return () => clearInterval(t);
  }, []);
  const z = ZONA_WAKTU.find((x) => x.id === zona) ?? ZONA_WAKTU[0]!;
  return (
    <div className="ist__jam">
      <div className="ist__jamatas">
        <JamBusur zona={z.id} kini={kini} />
        <div className="ist__jamteks">
          <span className="ist__jamlabel">Sekarang di studio</span>
          <b className="ist__jamangka">{kini ? jamDi(z.id, kini) : "—.—"}<small>{z.label}</small></b>
          <span className="ist__jamtanggal">{kini ? tanggalDi(z.id, kini) : " "}</span>
        </div>
      </div>
      <ul className="ist__jamzona">
        {ZONA_WAKTU.map((x) => (
          <li key={x.id} data-pilih={x.id === z.id || undefined}>
            <span>{x.label}</span>
            <b>{kini ? jamDi(x.id, kini) : "—"}</b>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ─── Halaman ────────────────────────────────────────────────────────────── */

type JenisDok = "biaya" | "tagihan" | "gaji";

/** Tiga dokumen yang memakai kop ini — judul dan kolom tengahnya sama
 *  dengan lib/pdfProyek.ts; barisnya CONTOH, ditandai begitu di halaman. */
const DOKUMEN: {
  nilai: JenisDok; judul: string; untuk: string; ikon: DataIkon; sub: string; tengah: string;
  baris: [string, string, string][]; total: string;
}[] = [
  {
    nilai: "biaya", judul: "Rincian Biaya Proyek", untuk: "Internal studio", ikon: NavReceipt,
    sub: "Rumah Tropis Sungai Raya", tengah: "Kategori",
    baris: [["Fee drafter", "Tim", "Rp4.500.000"], ["Cetak gambar A1", "Produksi", "Rp850.000"], ["Survei lokasi", "Perjalanan", "Rp600.000"]],
    total: "Rp5.950.000",
  },
  {
    nilai: "tagihan", judul: "Daftar Tagihan", untuk: "Dikirim ke klien", ikon: SpecialInvoice,
    sub: "Rumah Tropis Sungai Raya", tengah: "Status",
    baris: [["Termin 1 — DP 50%", "Lunas", "Rp22.500.000"], ["Termin 2 — Desain final", "Terbit", "Rp13.500.000"], ["Termin 3 — Gambar kerja", "Draf", "Rp9.000.000"]],
    total: "Rp45.000.000",
  },
  {
    nilai: "gaji", judul: "Slip Gaji", untuk: "Untuk anggota tim", ikon: Wallet,
    sub: "Anggota tim · Oktober 2026", tengah: "Keterangan",
    baris: [["Gaji pokok", "Dibayar 1 Okt 2026", "Rp4.000.000"], ["Fee Rumah Tropis", "Drafter 10% · tahap awal", "Rp2.250.000"], ["Fee Kedai Kopi Tepian", "Render 5% · tahap akhir", "Rp900.000"]],
    total: "Rp7.150.000",
  },
];

function Isi() {
  const toast = useToast();
  const [layar, setLayar] = useState<"desktop" | "ponsel" | "cari">("desktop");
  const [dok, setDok] = useState<JenisDok>("biaya");
  const dokumen = DOKUMEN.find((d) => d.nilai === dok)!;
  // Tanggal kop = tanggal di zona studio (lib/pdf.ts tanggalPanjang);
  // dibaca sesudah hidrasi, server tidak tahu harinya (jebakan #8).
  const [hariIni, setHariIni] = useState<Date | null>(null);
  useEffect(() => setHariIni(new Date()), []);
  const [asli, setAsli] = useState<StudioSettings | null>(() => bacaCache<StudioSettings>("settings"));
  const [draf, setDraf] = useState<Draf>({});
  const [galat, setGalat] = useState<string | null>(null);
  const [menyimpan, setMenyimpan] = useState(false);
  const [pratinjau, setPratinjau] = useState<string | null>(null);
  const [mengunggah, setMengunggah] = useState(false);
  const [diseret, setDiseret] = useState(false);
  const [tab, setTabState] = useState<Tab>("identitas");
  const berkasRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    ambilSettings()
      .then((d) => {
        tulisCache("settings", d);
        setAsli(d);
      })
      .catch((e) => setGalat((e as Error).message));
  }, []);
  // "identitas" juga yang dirender server; tab dari alamat dibaca sesudah
  // hidrasi (jebakan #8).
  useEffect(() => {
    setTabState(tabDariAlamat(NAMA_TAB));
    const dengar = () => setTabState(tabDariAlamat(NAMA_TAB));
    window.addEventListener("hashchange", dengar);
    return () => window.removeEventListener("hashchange", dengar);
  }, []);
  const setTab = (t: Tab) => {
    setTabState(t);
    tulisTabKeAlamat(t, "identitas");
  };

  const berubah = (Object.keys(draf) as Kunci[]).filter((k) => draf[k] !== asli?.[k]);
  useCegahPindah(berubah.length > 0);

  const nilai = (k: Kunci) => String((k in draf ? draf[k] : asli?.[k]) ?? "");
  const set = (k: Kunci, v: unknown) => setDraf((d) => ({ ...d, [k]: v }));
  const kosong = WAJIB.filter((k) => !nilai(k).trim());

  async function simpan() {
    if (!asli || berubah.length === 0 || kosong.length) return;
    setMenyimpan(true);
    try {
      const patch: Record<string, unknown> = {};
      for (const k of berubah) patch[k] = draf[k];
      await simpanSettings(patch);
      setAsli({ ...asli, ...draf, ...(pratinjau ? { logoUrl: pratinjau } : {}) } as StudioSettings);
      setDraf({});
      toast({ judul: "Info studio disimpan", keterangan: "Tampil di situs setelah Terbitkan.", nada: "sukses" });
    } catch (e) {
      toast({ judul: "Gagal menyimpan", keterangan: (e as Error).message, nada: "gagal" });
    } finally {
      setMenyimpan(false);
    }
  }

  function batalkan() {
    setDraf({});
    setPratinjau((l) => {
      if (l) URL.revokeObjectURL(l);
      return null;
    });
  }

  async function prosesLogo(f: File) {
    if (!TIPE_LOGO.has(f.type)) {
      toast({ judul: "Format tidak didukung", keterangan: "Pakai PNG, JPG, atau WebP.", nada: "gagal" });
      return;
    }
    if (f.size > MAKS_LOGO) {
      toast({ judul: "Berkas terlalu besar", keterangan: "Maksimal 2 MB.", nada: "gagal" });
      return;
    }
    setMengunggah(true);
    try {
      const target = await mintaUrlUnggahLogo(f.type);
      const res = await fetch(target.uploadUrl, { method: "PUT", headers: { "Content-Type": f.type }, body: f });
      if (!res.ok) throw new Error(`Penyimpanan menolak berkas (${res.status})`);
      set("logoKey", target.key);
      setPratinjau((l) => {
        if (l) URL.revokeObjectURL(l);
        return URL.createObjectURL(f);
      });
      toast({ judul: "Logo terunggah", keterangan: "Tekan Simpan untuk memasangnya.", nada: "sukses" });
    } catch (e) {
      toast({ judul: "Gagal mengunggah", keterangan: (e as Error).message, nada: "gagal" });
    } finally {
      setMengunggah(false);
    }
  }

  function lepasLogo() {
    setPratinjau((l) => {
      if (l) URL.revokeObjectURL(l);
      return null;
    });
    set("logoKey", null);
    toast({ judul: "Logo dilepas", keterangan: "Tekan Simpan untuk menerapkannya.", nada: "sukses" });
  }

  if (galat) return <GagalMuat apa="Info studio" galat={galat} />;
  if (!asli) return <Kerangka />;

  const logoDilepas = "logoKey" in draf && draf.logoKey === null;
  const logo = pratinjau ?? (logoDilepas ? null : asli.logoUrl ?? null);
  const zona = nilai("timezone") || "Asia/Jakarta";
  const zonaInfo = ZONA_WAKTU.find((z) => z.id === zona) ?? ZONA_WAKTU[0]!;
  const tanggalKop = hariIni
    ? new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: zona }).format(hariIni)
    : "";
  const nama = nilai("studioName");
  const kota = nilai("city");
  const tagline = nilai("tagline");
  const email = nilai("email");
  const telepon = nilai("phone");
  const instagram = nilai("instagramUrl");
  const alamat = nilai("address");

  // Seret berkas ke logo besar di kepala ATAU ke kotak di tab Identitas.
  const seret = {
    onDragOver: (e: React.DragEvent) => { e.preventDefault(); setDiseret(true); },
    onDragLeave: () => setDiseret(false),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      setDiseret(false);
      const f = e.dataTransfer.files?.[0];
      if (f) prosesLogo(f);
    },
  };

  return (
    <div className="lbr ist">
      <input
        ref={berkasRef}
        type="file"
        className="sr-only"
        accept="image/png,image/jpeg,image/webp"
        aria-label="Pilih berkas logo studio"
        disabled={mengunggah}
        onChange={(e) => {
          const f = e.currentTarget.files?.[0];
          e.currentTarget.value = "";
          if (f) prosesLogo(f);
        }}
      />
      <header className="lbr-kepala">
        {/* Kop lembar — data studio sungguhan, ikut draf yang sedang diketik. */}
        <SampulLembar
          judul="Info studio"
          gambar={<TampakSampul />}
          kop={[
            { label: "Kota", nilai: kota || "—" },
            { label: "Berdiri", nilai: asli.foundedYear ?? "—" },
            { label: "Zona waktu", nilai: zonaInfo.label },
          ]}
        />
        <div className="lbr-identitas">
          <button
            type="button"
            className="ist__logo"
            data-diseret={diseret || undefined}
            aria-label={logo ? "Ganti logo studio" : "Unggah logo studio"}
            disabled={mengunggah}
            onClick={() => berkasRef.current?.click()}
            {...seret}
          >
            {logo ? <img src={logo} alt="" /> : <span className="ist__logokosong"><Ikon ikon={ImageSquare} ukuran={26} />Logo</span>}
            <span className="ist__logokamera" aria-hidden="true"><Ikon ikon={ImageSquare} ukuran={14} /></span>
            <span className="ist__logotirai" aria-hidden="true">
              {mengunggah ? <Putar ukuran={18} label="Mengunggah" /> : <><Ikon ikon={ImageSquare} ukuran={18} />{logo ? "Ganti" : "Unggah"}</>}
            </span>
          </button>
          <div className="lbr-siapa">
            <h2 className="lbr-nama">
              {nama || <span className="ist__namakosong">Nama studio belum diisi</span>}
              <Lencana bentuk="pejalkecil" nada={kosong.length ? "menunggu" : "selesai"}>
                {kosong.length ? `${kosong.length} isian wajib kosong` : "Lengkap"}
              </Lencana>
            </h2>
            <p className="lbr-sub">
              {tagline && <span className="ist__tagline">{tagline}</span>}
              {tagline && kota && <span aria-hidden="true">·</span>}
              {kota && <><Ikon ikon={MapPinArea} ukuran={14} />{kota}</>}
            </p>
          </div>
          <div className="lbr-pintas">
            <PenandaSimpan
              n={kosong.length || berubah.length}
              teks={kosong.length ? `Isi dulu: ${kosong.map((k) => LABEL_WAJIB[k]).join(", ")}.` : undefined}
            />
            {berubah.length > 0 && (
              <Tombol jenis="ghost" ukuran="medium" onClick={batalkan}>Batalkan</Tombol>
            )}
            <Tombol
              memuat={menyimpan}
              ukuran="medium"
              jenis="primary"
              disabled={berubah.length === 0 || kosong.length > 0 || menyimpan}
              onClick={simpan}
            >
              Simpan perubahan
            </Tombol>
          </div>
        </div>
        <TabLembar
          awalan="ist"
          label="Bagian info studio"
          nilai={tab}
          onPilih={setTab}
          tab={TAB.map((t) => {
            const n = WAJIB_TAB[t.nilai].filter((k) => kosong.includes(k)).length;
            return n ? { ...t, angka: n, nada: "awas" as const } : t;
          })}
        />
      </header>

      <section className="lbr-isi" id="ist-panel" role="tabpanel" aria-labelledby={`ist-tab-${tab}`}>
        {tab === "identitas" && (
          <div className="lbr-panel ist__panel">
            <div className="ist__isian">
              <Isian label="Nama studio *" value={nama} onChange={(e) => set("studioName", e.currentTarget.value)} />
              <Isian label="Tagline" value={tagline} maxLength={120} onChange={(e) => set("tagline", e.currentTarget.value)} />
              <div className="ist__logobaris" {...seret} data-diseret={diseret || undefined}>
                <span className="ist__logokecil">
                  {logo ? <img src={logo} alt="Logo studio" /> : <Ikon ikon={ImageSquare} ukuran={22} />}
                </span>
                <span className="ist__logoteks">
                  <b>{mengunggah ? "Mengunggah…" : logo ? "Logo terpasang" : "Belum ada logo"}</b>
                  <small>PNG, JPG, atau WebP · maks. 2 MB · persegi lebih baik</small>
                </span>
                <Tombol jenis="secondary" ukuran="small" disabled={mengunggah} onClick={() => berkasRef.current?.click()}>
                  {logo ? "Ganti" : "Pilih berkas"}
                </Tombol>
                {logo && <Tombol jenis="ghost" ukuran="small" onClick={lepasLogo}>Lepas</Tombol>}
              </div>
            </div>
            <Pratinjau
              judul={layar === "cari" ? "Hasil pencarian" : "Kepala situs"}
              aksi={
                <Segmen
                  className="ist__layar"
                  judul="Ukuran layar pratinjau"
                  nilai={layar}
                  onPilih={(v) => setLayar(v as "desktop" | "ponsel" | "cari")}
                  segmen={[{ nilai: "desktop", label: "Desktop" }, { nilai: "ponsel", label: "Ponsel" }, { nilai: "cari", label: "Pencarian" }]}
                />
              }
            >
              {layar === "desktop" ? (
                <BingkaiPeramban alamat="pahlevidirgaarchitecture.com" tab={`${JUDUL_BERANDA} — ${nama.trim() || "Dirga Pahlevi Architecture"}`} logo={logo}>
                  <div className="ist__pubkepala">
                    <span className="ist__pubmerek">
                      {logo ? <img src={logo} alt="" /> : <LogoBawaan ukuran={16} />}
                      {wordmark(nama)}
                    </span>
                    <span className="ist__pubnav"><i>Karya</i><i>Studio</i><i>Jurnal</i><i>Kontak</i></span>
                    <span className="ist__pubtombol">Mulai proyek</span>
                  </div>
                  <div className="ist__pubhero">
                    <i className="ist__pubhero-garis" />
                    <i className="ist__pubhero-garis ist__pubhero-garis--pendek" />
                    <i className="ist__pubhero-foto" />
                  </div>
                </BingkaiPeramban>
              ) : layar === "cari" ? (
                /* Hasil mesin pencari: nama situs dari og:site_name, judul
                   dari <title> (BaseLayout), cuplikan dari meta description
                   beranda. Bentuknya umum, bukan tiruan merek mesin pencari. */
                <div className="ist__cari" aria-hidden="true">
                  <span className="ist__carikotak"><Ikon ikon={MagnifyingGlass} ukuran={13} />arsitek coffee shop {kota.trim() || "Pontianak"}</span>
                  <div className="ist__carihasil">
                    <span className="ist__carisitus">
                      <span className="ist__carifav">{logo ? <img src={logo} alt="" /> : <LogoBawaan ukuran={14} />}</span>
                      <span><b>{nama.trim() || "Dirga Pahlevi Architecture"}</b><small>pahlevidirgaarchitecture.com</small></span>
                    </span>
                    <span className="ist__carijudul">{JUDUL_BERANDA} — {nama.trim() || "Dirga Pahlevi Architecture"}</span>
                    <span className="ist__cariket">{KET_BERANDA}</span>
                  </div>
                  <div className="ist__carihasil ist__carihasil--redup"><i /><i /><i /></div>
                </div>
              ) : (
                <BingkaiPonsel>
                  <div className="ist__pubkepala ist__pubkepala--ponsel">
                    <span className="ist__pubmerek">
                      {logo ? <img src={logo} alt="" /> : <LogoBawaan ukuran={14} />}
                      <span className="ist__pubmerekteks">{wordmark(nama)}</span>
                    </span>
                    <svg className="ist__pubmenu" width="14" height="14" viewBox="0 0 20 20" fill="none"><path d="M2 6h16M2 14h16" /></svg>
                  </div>
                  <div className="ist__pubhero ist__pubhero--ponsel">
                    <i className="ist__pubhero-garis" />
                    <i className="ist__pubhero-garis ist__pubhero-garis--pendek" />
                    <i className="ist__pubhero-foto" />
                  </div>
                </BingkaiPonsel>
              )}
            </Pratinjau>
          </div>
        )}

        {tab === "kontak" && (
          <div className="lbr-panel ist__panel">
            <div className="ist__isian">
              <Isian
                label="Email *"
                type="email"
                value={email}
                onChange={(e) => set("email", e.currentTarget.value)}
                kanan={email ? <UjiTautan href={`mailto:${email}`} judul="Coba kirim email" ikon={NavEnvelope} /> : undefined}
              />
              <Isian
                label="Telepon/WhatsApp *"
                type="tel"
                inputMode="tel"
                value={telepon}
                bantu={telepon ? `Tautan WhatsApp: ${waTautan(telepon).replace("https://", "")}` : undefined}
                onChange={(e) => set("phone", e.currentTarget.value)}
                kanan={telepon ? <UjiTautan href={waTautan(telepon)} judul="Coba tautan WhatsApp" ikon={Phone} /> : undefined}
              />
              <Isian
                label="URL Instagram"
                type="url"
                placeholder="https://instagram.com/…"
                value={instagram}
                onChange={(e) => set("instagramUrl", e.currentTarget.value)}
                kanan={instagram ? <UjiTautan href={instagram} judul="Buka Instagram" ikon={InstagramLogo} /> : undefined}
              />
            </div>
            <Pratinjau judul="Kaki situs" ket="Baris yang kosong tidak ditampilkan">
              <BingkaiPeramban alamat="pahlevidirgaarchitecture.com/kontak">
                <div className="ist__pubkaki">
                  <div>
                    <span className="ist__pubmerek ist__pubmerek--kecil">
                      {logo ? <img src={logo} alt="" /> : <LogoBawaan ukuran={14} />}
                      {(nama.trim() || "Dirga Pahlevi Architecture").toUpperCase()}
                    </span>
                    <p className="ist__pubredup">Studio arsitektur<br />{kota.trim() || "Indonesia"}</p>
                  </div>
                  <div>
                    <span className="ist__publabel">KLIEN</span>
                    <ul className="ist__pubtautan"><li>Portal proyek</li><li>Bukti pembayaran</li><li>Tanya jawab</li></ul>
                  </div>
                  <div>
                    <span className="ist__publabel">KONTAK</span>
                    {email || telepon || instagram ? (
                      <ul className="ist__pubtautan ist__pubtautan--kontak">
                        {email && <li>{email}</li>}
                        {telepon && <li>WhatsApp</li>}
                        {instagram && <li>Instagram</li>}
                      </ul>
                    ) : (
                      <p className="ist__pubredup">Belum ada</p>
                    )}
                  </div>
                </div>
              </BingkaiPeramban>
            </Pratinjau>
          </div>
        )}

        {tab === "lokasi" && (
          <div className="lbr-panel ist__panel">
            <div className="ist__isian">
              <Isian label="Kota *" value={kota} onChange={(e) => set("city", e.currentTarget.value)} />
              <label className="k-isian">
                <span className="k-isian__label">Alamat</span>
                <IsianPanjang className="ist__alamat" rows={2} value={alamat} onChange={(e) => set("address", e.currentTarget.value)} />
              </label>
              <span className="k-isian__label" id="ist-zona">Zona waktu</span>
              <div className="ist__zona" role="radiogroup" aria-labelledby="ist-zona">
                {ZONA_WAKTU.map((z) => (
                  <button
                    key={z.id}
                    type="button"
                    role="radio"
                    aria-checked={zona === z.id}
                    className="ist__zonab"
                    onClick={() => set("timezone", z.id)}
                  >
                    <b>{z.label}</b>
                    <span>{z.utc}</span>
                    <Ikon ikon={CheckCircle} ukuran={16} />
                  </button>
                ))}
              </div>
            </div>
            <Pratinjau judul="Jam studio" ket="Jam di panel dan tanggal di setiap PDF">
              <JamStudio zona={zona} />
            </Pratinjau>
          </div>
        )}

        {tab === "kop" && (
          <div className="lbr-panel ist__panel ist__panel--kop">
            <div className="ist__kopket">
              <h3 className="lbr-judul" id="ist-dok">Kop di setiap dokumen PDF</h3>
              <div className="ist__dokumen" role="radiogroup" aria-labelledby="ist-dok">
                {DOKUMEN.map((d) => (
                  <button
                    key={d.nilai}
                    type="button"
                    role="radio"
                    aria-checked={dok === d.nilai}
                    tabIndex={dok === d.nilai ? 0 : -1}
                    className="ist__dokb"
                    onClick={() => setDok(d.nilai)}
                    onKeyDown={(e) => {
                      const i = DOKUMEN.findIndex((x) => x.nilai === dok);
                      const ke = { ArrowDown: i + 1, ArrowRight: i + 1, ArrowUp: i - 1, ArrowLeft: i - 1 }[e.key];
                      if (ke === undefined) return;
                      e.preventDefault();
                      const j = (ke + DOKUMEN.length) % DOKUMEN.length;
                      setDok(DOKUMEN[j]!.nilai);
                      (e.currentTarget.parentElement?.children[j] as HTMLElement | undefined)?.focus();
                    }}
                  >
                    <span className="lbr-ubin" aria-hidden="true"><Ikon ikon={d.ikon} ukuran={16} /></span>
                    <span className="ist__dokteks"><b>{d.judul}</b><small>{d.untuk}</small></span>
                  </button>
                ))}
              </div>
              <p className="ist__kopcatatan">Kop diambil saat dokumen dibuat — tidak perlu Terbitkan. Baris di bawah kop hanya contoh.</p>
            </div>
            <div className="ist__meja" aria-label="Pratinjau kop dokumen">
              {/* Kertasnya wadah ukuran (container-type): seluruh ukuran di
                  dalamnya ditulis dalam cqw = pt × 100 / 595,28 — lebar A4
                  di lib/pdf.ts — jadi perbandingannya sama dengan PDF-nya. */}
              <div className="ist__kertas" aria-hidden="true">
                <div className="ist__kertasisi">
                  <div className="ist__kop">
                    <div className="ist__kopkiri">
                      {logo && <img className="ist__koplogo" src={logo} alt="" />}
                      <b className="ist__kopnama">{nama.trim() || "Nama studio"}</b>
                      {tagline && <span className="ist__koptag">{tagline}</span>}
                    </div>
                    <div className="ist__kopkanan">
                      {[[alamat, kota].filter((x) => x.trim()).join(", "), email, telepon]
                        .filter((b) => b.trim())
                        .map((b) => <span key={b}>{b}</span>)}
                    </div>
                  </div>
                  <i className="ist__kopgaris" />
                  <b className="ist__kopjudul">{dokumen.judul}</b>
                  <span className="ist__kopsub">
                    <span>{dokumen.sub}</span>
                    <span className="ist__koptanggal">{tanggalKop}</span>
                  </span>
                  <span className="ist__koptabel ist__koptabel--kepala">
                    <span>URAIAN</span><span>{dokumen.tengah.toUpperCase()}</span><span>NOMINAL</span>
                  </span>
                  {dokumen.baris.map(([l, k, n]) => (
                    <span key={l} className="ist__koptabel">
                      <span>{l}</span><span className="ist__kopabu">{k}</span><span>{n}</span>
                    </span>
                  ))}
                  <span className="ist__kopringkas"><span>Total</span><b>{dokumen.total}</b></span>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

/** Tombol kecil di ujung isian: membuka tautan yang dirakit dari isinya,
 *  supaya salah ketik ketahuan SEBELUM klien yang mencobanya. */
function UjiTautan({ href, judul, ikon }: { href: string; judul: string; ikon: DataIkon }) {
  return (
    <a
      className="k-tombolikon k-tombolikon--small k-tombol--ghost ist__uji"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={judul}
      title={judul}
    >
      <Ikon ikon={ikon} ukuran={14} />
    </a>
  );
}

function Kerangka(): ReactNode {
  return (
    <div className="lbr lbr--rangka" aria-busy="true">
      <div className="lbr-kepala"><div className="lbr-sampul" /></div>
      <div className="lbr-isi" />
    </div>
  );
}

export function InfoStudioKit() {
  return (
    <RequireAuth masterOnly skeleton={<Kerangka />}>
      <ToastProvider>
        <Isi />
      </ToastProvider>
    </RequireAuth>
  );
}
