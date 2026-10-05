import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { ToastProvider, useToast } from "../kit/Toast";
import { RequireAuth, useProfil } from "./RequireAuth";
import { Tombol, TombolIkon } from "../kit/Tombol";
import { Isian } from "../kit/Isian";
import { Lencana } from "../kit/Lencana";
import { AlertDialog } from "../kit/Overlay";
import { Peringatan, Rangka } from "../kit/Tampilan";
import { Ikon, type DataIkon } from "../kit/Ikon";
import {
  ArrowClockwise, Briefcase, CheckCircle, CircleDashed, Eye, GearSix, Globe, IdentificationBadge, NavEnvelope,
  NavSignOut, NavSquaresFour, NotePencil, Question, SpecialAppleLogo, SpecialGoogleLogo, SpecialMoonStars,
  SpecialSealCheck, SpecialWindowsLogo, Users,
} from "../kit/ikon";
import { PenandaSimpan } from "./situsKit";
import { BulatSumbu, LambangStudio, SampulLembar, TabLembar, tabDariAlamat, tulisTabKeAlamat } from "./lembarKit";
import { waktuRelatif } from "./panelKabar";
import {
  ambilAkun, keluar, keluarkanPerangkatLain, namaTampilan, sesiTetap, ubahNamaAkun, ubahPassword, waktuMasukSesi,
  type InfoAkun,
} from "../../lib/admin";
import { NAV } from "../../lib/navAdmin";
import { jagaFokusSesudahHapus } from "../../lib/fokus";
import { bacaPerangkat, type SistemPerangkat } from "../../lib/perangkat";
import { PERISTIWA_TEMA, pilihanTema, pilihTema, type PilihanTema } from "../../lib/tema";

/* =============================================================================
   Akun — halaman akun, bukan dashboard.

   Kerangkanya `lembarKit` (dipakai bersama Info Studio). Tema rupanya LEMBAR GAMBAR KERJA, karena ini panel studio arsitektur:
   sampulnya kertas kalkir dengan denah garis, sumbu grid berbulatan
   (A–D / 1–2), garis ukur, dan panah utara; di pojoknya kop lembar yang
   memuat data akun sungguhan. Di bawahnya avatar besar, nama, lalu empat tab
   bergaris bawah — Profil, Keamanan, Perangkat, Tampilan. Satu tab satu
   pekerjaan, jadi tiap tab muat satu layar. Tab yang terbuka disimpan di
   alamat (#keamanan), supaya tautan dan tombol Kembali membawa ke tempat
   yang sama.

   Aturan kata sandinya aturan SUPABASE proyek ini, bukan karangan panel:
   minimal 12 karakter, dengan huruf besar, huruf kecil, angka, dan simbol
   (lihat CLAUDE.md — pengganti proteksi kata sandi bocor yang tidak ada di
   plan Free). API memeriksa aturan yang sama (`lib/gotrue.ts`), jadi daftar
   di sini dan penolakan server tidak bisa menyimpang.
   ============================================================================= */

type Tab = "profil" | "keamanan" | "perangkat" | "tampilan";
const TAB: { nilai: Tab; label: string; ikon: DataIkon }[] = [
  { nilai: "profil", label: "Profil", ikon: IdentificationBadge },
  { nilai: "keamanan", label: "Keamanan", ikon: SpecialSealCheck },
  { nilai: "perangkat", label: "Perangkat", ikon: Globe },
  { nilai: "tampilan", label: "Tampilan", ikon: SpecialMoonStars },
];
const NAMA_TAB = TAB.map((t) => t.nilai);

const SYARAT: [string, (s: string) => boolean][] = [
  ["12 karakter atau lebih", (s) => s.length >= 12],
  ["Huruf besar", (s) => /[A-Z]/.test(s)],
  ["Huruf kecil", (s) => /[a-z]/.test(s)],
  ["Angka", (s) => /\d/.test(s)],
  ["Simbol", (s) => /[^A-Za-z0-9]/.test(s)],
];

/** Kata sandi acak 20 karakter yang PASTI memenuhi kelima aturan. Huruf
 *  yang mirip (0/O, 1/l/I) dibuang supaya bisa disalin dengan mata. */
function sandiAcak(panjang = 20): string {
  const kelompok = ["ABCDEFGHJKLMNPQRSTUVWXYZ", "abcdefghijkmnopqrstuvwxyz", "23456789", "!@#$%&*-_=+?"];
  const semua = kelompok.join("");
  const acak = (n: number) => {
    // Sampel tolak: modulo langsung condong ke huruf awal daftar.
    const batas = Math.floor(0x1_0000_0000 / n) * n;
    const b = new Uint32Array(1);
    do crypto.getRandomValues(b);
    while (b[0]! >= batas);
    return b[0]! % n;
  };
  const huruf = kelompok.map((k) => k[acak(k.length)]!);
  while (huruf.length < panjang) huruf.push(semua[acak(semua.length)]!);
  for (let i = huruf.length - 1; i > 0; i--) {
    const j = acak(i + 1);
    [huruf[i], huruf[j]] = [huruf[j]!, huruf[i]!];
  }
  return huruf.join("");
}

const TGL = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric" });
const TGL_PENDEK = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short" });
const tanggal = (iso?: string | null) => (iso ? TGL.format(new Date(iso)) : "—");
/** "4 Okt, 13.20" — jam ditulis dengan titik, seperti di seluruh panel. */
function tanggalJam(nilai?: Date | string | null): string {
  if (!nilai) return "—";
  const d = new Date(nilai);
  const dua = (n: number) => String(n).padStart(2, "0");
  return `${TGL_PENDEK.format(d)}, ${dua(d.getHours())}.${dua(d.getMinutes())}`;
}

function inisial(nama: string) {
  return nama.split(/\s+/).filter(Boolean).slice(0, 2).map((k) => k[0]!.toUpperCase()).join("") || "?";
}

/* ─── Sampul: lembar gambar kerja ───────────────────────────────────────────
   Denahnya hiasan (tidak menggambar bangunan mana pun) — tapi kop lembarnya
   berisi data akun yang benar: peran, sesi aktif, dan terakhir masuk. */

function DenahSampul() {
  const sumbuX = [40, 180, 300, 420];
  return (
    <svg className="lbr-gambar akn__denah" viewBox="0 0 460 116" fill="none" aria-hidden="true">
      {/* Sumbu grid putus-putus dengan bulatan berhuruf, seperti gambar kerja. */}
      <g className="lbr-sumbu">
        {sumbuX.map((x) => <line key={x} x1={x} y1={22} x2={x} y2={116} />)}
        <line x1={22} y1={60} x2={460} y2={60} />
        <line x1={22} y1={104} x2={460} y2={104} />
      </g>
      {sumbuX.map((x, i) => <BulatSumbu key={x} x={x} y={11} teks={"ABCD"[i]!} />)}
      {[60, 104].map((y, i) => <BulatSumbu key={y} x={11} y={y} teks={String(i + 1)} />)}
      {/* Dinding: tebal; jendela di dinding atas; dua bukaan pintu. */}
      <g className="lbr-tebal">
        <path d="M40 116 V40 H205 M265 40 H420 V116" />
        <path d="M180 40 V74 M180 100 V116" />
        <path d="M300 40 V66 M300 92 V116" />
        <path d="M300 92 H352" />
      </g>
      <g className="lbr-tipis">
        <path d="M205 37.5 H265 M205 42.5 H265" />
        <path d="M180 100 L154 100 M154 100 A26 26 0 0 1 180 74" />
        <path d="M300 92 L326 92 M326 92 A26 26 0 0 0 300 66" />
        {/* Garis ukur dengan tanda miring dan angkanya. */}
        <path d="M40 28 H420 M36 32 L44 24 M176 32 L184 24 M296 32 L304 24 M416 32 L424 24" />
      </g>
      <g className="lbr-angka">
        <text x={110} y={24}>3.500</text>
        <text x={240} y={24}>3.000</text>
        <text x={360} y={24}>3.000</text>
      </g>
    </svg>
  );
}

/* ─── Tab Profil ─────────────────────────────────────────────────────────── */

const IKON_KELOMPOK: Record<string, DataIkon> = {
  Utama: NavSquaresFour,
  Pekerjaan: Briefcase,
  Relasi: Users,
  "Konten Situs": Globe,
  Pengaturan: GearSix,
};

/** Kartu staf: badge tegak berlubang tali, miring mengikuti kursor. Hanya
 *  tetikus (jebakan #9: peristiwa tiruan sentuh tidak pernah "pergi"), dan
 *  diam kalau pemakai meminta gerak dikurangi (CSS). */
function KartuStaf({ nama, email, master, stafSejak }: { nama: string; email: string; master: boolean; stafSejak: string | null }) {
  const ref = useRef<HTMLDivElement>(null);
  const kotak = useRef<DOMRect | null>(null);
  const atur = (rx: number, ry: number, mx = 50, my = 50) => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty("--rx", `${rx}deg`);
    el.style.setProperty("--ry", `${ry}deg`);
    el.style.setProperty("--mx", `${mx}%`);
    el.style.setProperty("--my", `${my}%`);
  };
  return (
    <div
      ref={ref}
      className="akn__staf"
      // Kotaknya dibaca SEKALI saat kursor masuk, bukan di tiap gerakan.
      onPointerEnter={(e) => { if (e.pointerType === "mouse") kotak.current = e.currentTarget.getBoundingClientRect(); }}
      onPointerMove={(e) => {
        const r = kotak.current;
        if (e.pointerType !== "mouse" || !r) return;
        const x = (e.clientX - r.left) / r.width;
        const y = (e.clientY - r.top) / r.height;
        atur((0.5 - y) * 10, (x - 0.5) * 14, x * 100, y * 100);
      }}
      onPointerLeave={() => { kotak.current = null; atur(0, 0); }}
    >
      <div className="akn__stafatas">
        <span className="akn__staflubang" aria-hidden="true" />
        <span className="akn__staflabel"><LambangStudio className="akn__staflambang" tebal={4} />Kartu staf</span>
      </div>
      <span className="akn__staffoto" aria-hidden="true">{inisial(nama)}</span>
      <div className="akn__stafbadan">
        <b className="akn__stafnama">{nama}</b>
        <span className="akn__stafperan">{master ? "Master admin" : "Staf"}</span>
        <dl className="akn__stafdata">
          <div><dt>Email</dt><dd>{email}</dd></div>
          <div><dt>Staf sejak</dt><dd>{stafSejak ? tanggal(stafSejak) : "—"}</dd></div>
        </dl>
      </div>
      <span className="akn__stafkilau" aria-hidden="true" />
    </div>
  );
}

/** Satu baris setelan: nama di kiri, nilai di tengah, aksi di kanan. */
function Baris({ label, children, aksi }: { label: string; children: ReactNode; aksi?: ReactNode }) {
  return (
    <div className="akn__baris">
      <dt>{label}</dt>
      <dd>{children}</dd>
      {aksi && <dd className="akn__barisaksi">{aksi}</dd>}
    </div>
  );
}

function PanelProfil({ akun, nama, namaTersimpan, email, master, ubah, setUbah, onNama }: {
  akun: InfoAkun | null; nama: string; namaTersimpan: string; email: string; master: boolean;
  ubah: boolean; setUbah: (b: boolean) => void; onNama: (n: string | null) => void;
}) {
  const toast = useToast();
  const [isi, setIsi] = useState("");
  const [kirim, setKirim] = useState(false);
  const isianRef = useRef<HTMLDivElement>(null);
  const terlalu = isi.trim().length > 60;

  useEffect(() => {
    if (!ubah) return;
    setIsi(namaTersimpan);
    requestAnimationFrame(() => isianRef.current?.querySelector("input")?.focus());
    // namaTersimpan sengaja tidak ikut: isian tidak boleh ditimpa saat diketik.
  }, [ubah]); // eslint-disable-line react-hooks/exhaustive-deps

  async function simpan(e: React.FormEvent) {
    e.preventDefault();
    if (terlalu) return;
    setKirim(true);
    try {
      onNama(await ubahNamaAkun(isi));
      toast({ judul: "Nama disimpan", nada: "sukses" });
      setUbah(false);
    } catch (err) {
      toast({ judul: "Gagal menyimpan nama", keterangan: (err as Error).message, nada: "gagal" });
    } finally {
      setKirim(false);
    }
  }

  /* Hak akses dihitung dari peta navigasi yang SAMA dengan rel
     (lib/navAdmin), jadi tidak bisa menyimpang dari menu yang tampil. */
  const hak = useMemo(() => {
    const per = new Map<string, { total: number; bisa: number }>();
    const khusus: string[] = [];
    for (const n of NAV) {
      const jumlah = n.children?.length ?? 1;
      const k = per.get(n.group) ?? { total: 0, bisa: 0 };
      k.total += jumlah;
      if (!n.masterOnly || master) k.bisa += jumlah;
      if (n.masterOnly) khusus.push(n.label);
      per.set(n.group, k);
    }
    return { kelompok: [...per.entries()], khusus };
  }, [master]);

  return (
    <div className="lbr-panel akn__panel--profil">
      {/* Kartu ikut nama yang SEDANG diketik — pratinjau tanpa perender kedua. */}
      <KartuStaf
        nama={ubah ? namaTampilan({ email, nama: isi }) : nama}
        email={email}
        master={master}
        stafSejak={akun?.stafSejak ?? null}
      />

      <section className="akn__bagian" aria-labelledby="akn-info">
        <h3 id="akn-info" className="lbr-judul">Informasi akun</h3>
        <dl className="akn__daftar">
          {ubah ? (
            <form className="akn__baris akn__baris--ubah" onSubmit={simpan}>
              <div ref={isianRef} className="akn__ubahisian">
                <Isian
                  label="Nama tampilan"
                  value={isi}
                  maxLength={80}
                  autoComplete="name"
                  placeholder={namaTampilan({ email })}
                  bantu={terlalu ? "Maksimal 60 karakter." : "Kosongkan untuk memakai nama dari email."}
                  onChange={(e) => setIsi(e.currentTarget.value)}
                  onKeyDown={(e) => { if (e.key === "Escape") setUbah(false); }}
                />
              </div>
              <div className="akn__ubahaksi">
                <Tombol jenis="ghost" ukuran="medium" onClick={() => setUbah(false)}>Batal</Tombol>
                <Tombol jenis="primary" ukuran="medium" tipeHtml="submit" memuat={kirim} disabled={kirim || terlalu}>Simpan</Tombol>
              </div>
            </form>
          ) : (
            <Baris
              label="Nama tampilan"
              aksi={<Tombol jenis="ghost" ukuran="small" kiri={NotePencil} onClick={() => setUbah(true)}>Ubah</Tombol>}
            >
              <b>{nama}</b>
              {!namaTersimpan && <small>Diturunkan dari email</small>}
            </Baris>
          )}
          <Baris label="Email"><b>{email}</b><small>Dipakai untuk masuk</small></Baris>
          <Baris label="Peran">
            <b>{master ? "Master admin" : "Staf"}</b>
            <small>{master ? "Seluruh panel" : `Kecuali ${hak.khusus.join(" dan ")}`}</small>
          </Baris>
          <Baris label="Staf sejak"><b>{akun ? tanggal(akun.stafSejak) : "—"}</b></Baris>
        </dl>
      </section>

      <section className="akn__bagian akn__bagian--hak" aria-labelledby="akn-hak">
        <h3 id="akn-hak" className="lbr-judul">Hak akses</h3>
        <ul className="akn__hak">
          {hak.kelompok.map(([nama, k]) => (
            <li key={nama}>
              <span className="lbr-ubin" aria-hidden="true"><Ikon ikon={IKON_KELOMPOK[nama] ?? NavSquaresFour} ukuran={16} /></span>
              <span className="akn__haknama">{nama}</span>
              <span className={`akn__hakangka${k.bisa < k.total ? " is-terbatas" : ""}`}>
                {k.bisa === k.total ? `${k.total} halaman` : `${k.bisa} dari ${k.total}`}
              </span>
            </li>
          ))}
        </ul>
        <p className="akn__hakkhusus">
          <span className="akn__hakkhususlabel">Khusus master admin</span>
          {hak.khusus.map((h) => <Lencana key={h} bentuk="garis" nada={master ? "selesai" : "menunggu"}>{h}</Lencana>)}
        </p>
      </section>
    </div>
  );
}

/* ─── Tab Keamanan ───────────────────────────────────────────────────────── */

function TombolMata({ lihat, setLihat, apa }: { lihat: boolean; setLihat: (b: boolean) => void; apa: string }) {
  return (
    <TombolIkon
      ikon={Eye}
      judul={lihat ? `Sembunyikan ${apa}` : `Tampilkan ${apa}`}
      jenis="ghost"
      ukuran="small"
      className="akn__mata"
      aria-pressed={lihat}
      onClick={() => setLihat(!lihat)}
    />
  );
}

function PanelKeamanan({ email, fokusAwal, onBerhasil }: { email: string; fokusAwal: boolean; onBerhasil: () => void }) {
  const toast = useToast();
  const [lama, setLama] = useState("");
  const [baru, setBaru] = useState("");
  const [ulang, setUlang] = useState("");
  const [lihat, setLihat] = useState({ lama: false, baru: false, ulang: false });
  const [kirim, setKirim] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);
  const meterId = useId();
  const awalRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (fokusAwal) awalRef.current?.querySelector("input")?.focus();
  }, [fokusAwal]);

  const terpenuhi = SYARAT.filter(([, uji]) => uji(baru)).length;
  const cocok = baru.length > 0 && baru === ulang;
  const siap = !!lama && terpenuhi === SYARAT.length && cocok && lama !== baru;
  const alasan = !lama
    ? "Isi kata sandi saat ini."
    : !baru
      ? "Ketik kata sandi baru."
      : terpenuhi < SYARAT.length
        ? `Masih kurang ${SYARAT.length - terpenuhi} aturan.`
        : lama === baru
          ? "Kata sandi baru sama dengan yang sekarang."
          : !cocok
            ? "Ulangannya belum sama."
            : null;
  const tingkat = !baru ? "kosong" : terpenuhi < SYARAT.length ? "kurang" : baru.length >= 16 ? "sangat" : "kuat";
  const labelTingkat = { kosong: "Belum diisi", kurang: `${terpenuhi} dari 5 aturan`, kuat: "Kuat", sangat: "Sangat kuat" }[tingkat];

  async function buatAcak() {
    const s = sandiAcak();
    setBaru(s);
    setUlang(s);
    setLihat((l) => ({ ...l, baru: true }));
    let disalin = false;
    try {
      await navigator.clipboard.writeText(s);
      disalin = true;
    } catch { /* izin papan klip ditolak — sandinya tetap terlihat di kotak */ }
    toast({
      judul: disalin ? "Sandi acak dibuat dan disalin" : "Sandi acak dibuat",
      keterangan: "Simpan di tempat aman sebelum menekan Simpan.",
      nada: "netral",
    });
  }

  async function simpan(e: React.FormEvent) {
    e.preventDefault();
    if (!siap) return;
    setKirim(true);
    setGalat(null);
    try {
      const r = await ubahPassword(lama, baru);
      setLama("");
      setBaru("");
      setUlang("");
      setLihat({ lama: false, baru: false, ulang: false });
      toast({
        judul: "Kata sandi diubah",
        keterangan: r.lainKeluar ? "Perangkat lain sudah dikeluarkan." : undefined,
        nada: "sukses",
      });
      onBerhasil();
    } catch (err) {
      const pesan = (err as Error).message;
      setGalat(pesan.charAt(0).toUpperCase() + pesan.slice(1) + ".");
    } finally {
      setKirim(false);
    }
  }

  return (
    <form className="lbr-panel akn__panel--keamanan" onSubmit={simpan} aria-label="Ganti kata sandi">
      {/* Nama pengguna tersembunyi: pengelola kata sandi peramban perlu tahu
          akun mana yang sandinya sedang diganti. */}
      <input type="text" name="username" autoComplete="username" value={email} readOnly hidden />
      <div className="akn__sandikisi">
        <div className="akn__isian" ref={awalRef}>
          <Isian
            label="Kata sandi saat ini"
            type={lihat.lama ? "text" : "password"}
            autoComplete="current-password"
            value={lama}
            onChange={(e) => { setLama(e.currentTarget.value); setGalat(null); }}
            kanan={<TombolMata lihat={lihat.lama} setLihat={(b) => setLihat((l) => ({ ...l, lama: b }))} apa="kata sandi saat ini" />}
          />
          <Isian
            label="Kata sandi baru"
            type={lihat.baru ? "text" : "password"}
            autoComplete="new-password"
            value={baru}
            aria-describedby={meterId}
            onChange={(e) => { setBaru(e.currentTarget.value); setGalat(null); }}
            kanan={<TombolMata lihat={lihat.baru} setLihat={(b) => setLihat((l) => ({ ...l, baru: b }))} apa="kata sandi baru" />}
          />
          <Isian
            label="Ulangi kata sandi baru"
            type={lihat.ulang ? "text" : "password"}
            autoComplete="new-password"
            value={ulang}
            onChange={(e) => { setUlang(e.currentTarget.value); setGalat(null); }}
            kanan={<TombolMata lihat={lihat.ulang} setLihat={(b) => setLihat((l) => ({ ...l, ulang: b }))} apa="ulangan kata sandi" />}
          />
        </div>
        {/* Kekuatan dan syarat menyala sambil mengetik — lebih cepat dibaca
            daripada satu kalimat galat sesudah menekan Simpan. */}
        <div className={`akn__kekuatan akn__kekuatan--${tingkat}`}>
          <div className="akn__meter" id={meterId}>
            <span className="akn__meterperisai" aria-hidden="true"><Ikon ikon={SpecialSealCheck} ukuran={22} /></span>
            <span className="akn__metertulis">
              <span className="akn__meterlabel">Kekuatan kata sandi</span>
              <b className="akn__metertingkat">{labelTingkat}</b>
            </span>
            <span className="akn__meterbar" aria-hidden="true">
              {SYARAT.map(([l], i) => <i key={l} data-isi={i < terpenuhi || undefined} />)}
            </span>
          </div>
          <ul className="akn__syarat" aria-label="Syarat kata sandi">
            {[...SYARAT, ["Ulangan sama", () => cocok] as [string, (s: string) => boolean]].map(([label, uji]) => {
              const ok = uji(baru);
              return (
                <li key={label} data-ok={ok || undefined}>
                  <Ikon ikon={ok ? CheckCircle : CircleDashed} ukuran={16} />
                  {label}
                  <span className="sr-only">{ok ? " — terpenuhi" : " — belum"}</span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
      {galat && <Peringatan nada="bahaya">{galat}</Peringatan>}
      <div className="lbr-kaki">
        <PenandaSimpan n={siap ? 0 : 1} teks={alasan ?? "Siap disimpan. Perangkat lain akan dikeluarkan."} />
        <div className="lbr-kakiaksi">
          <Tombol jenis="secondary" ukuran="large" kiri={ArrowClockwise} onClick={buatAcak}>Buat sandi acak</Tombol>
          <Tombol memuat={kirim} ukuran="large" jenis="primary" tipeHtml="submit" disabled={!siap || kirim}>
            Simpan kata sandi
          </Tombol>
        </div>
      </div>
    </form>
  );
}

/* ─── Tab Perangkat ──────────────────────────────────────────────────────── */

const IKON_SISTEM: Partial<Record<SistemPerangkat, DataIkon>> = {
  macOS: SpecialAppleLogo,
  iPhone: SpecialAppleLogo,
  iPad: SpecialAppleLogo,
  Windows: SpecialWindowsLogo,
  Android: SpecialGoogleLogo,
  ChromeOS: SpecialGoogleLogo,
};

/** Gambar garis perangkatnya — laptop, ponsel, tablet, atau tanda tanya
 *  kalau agennya tidak dikenali — dengan lambang sistemnya di layar. */
function GambarAlat({ ua, angka }: { ua: string | null; angka?: number }) {
  const p = bacaPerangkat(ua);
  const jenis = angka !== undefined ? "banyak" : p ? p.jenis : "tak";
  return (
    <span className={`akn__alat akn__alat--${jenis}`} aria-hidden="true">
      <span className="akn__alatlayar">
        {angka !== undefined ? <b>{angka}</b> : <Ikon ikon={p ? (IKON_SISTEM[p.sistem] ?? Globe) : Question} ukuran={20} />}
      </span>
      {jenis === "komputer" && <span className="akn__alatalas" />}
    </span>
  );
}

function KartuAlat({ ua, angka, judul, ket, masuk, aktif, ini, children }: {
  ua: string | null; angka?: number; judul: string; ket?: string; masuk: string; aktif: string; ini?: boolean; children?: ReactNode;
}) {
  return (
    <li className={`akn__alatkartu${ini ? " is-ini" : ""}${angka !== undefined || !bacaPerangkat(ua) ? " is-pudar" : ""}`}>
      {ini && <span className="akn__alathidup"><i aria-hidden="true" />Sekarang</span>}
      <GambarAlat ua={ua} angka={angka} />
      <span className="akn__alatjudul">
        <b className="akn__alatnama">{judul}</b>
        {ket && <small>{ket}</small>}
      </span>
      <dl className="akn__alatdata">
        <div><dt>Masuk</dt><dd>{masuk}</dd></div>
        <div><dt>Terakhir aktif</dt><dd>{aktif}</dd></div>
      </dl>
      {children}
    </li>
  );
}

function PanelPerangkat({ akun, galat, muat }: { akun: InfoAkun | null; galat: string | null; muat: () => Promise<void> }) {
  const toast = useToast();
  const [ua, setUa] = useState<string | null>(null);
  const [tetap, setTetap] = useState<boolean | null>(null);
  const [masuk, setMasuk] = useState<Date | null>(null);
  const [keluarJalan, setKeluarJalan] = useState(false);
  const pemicuKeluarkan = useRef<HTMLButtonElement>(null);
  // Dibaca di efek, bukan saat render: semuanya milik peramban, dan HTML
  // server tidak mengenalnya (jebakan #8).
  useEffect(() => {
    setUa(navigator.userAgent);
    setTetap(sesiTetap());
    setMasuk(waktuMasukSesi());
  }, []);

  const s = akun?.sesi;
  const lainBernama = s ? s.jumlah - (s.ini ? 1 : 0) - s.tanpaNama : 0;
  const sisaBernama = s ? Math.max(0, lainBernama - s.lain.length) : 0;
  const jumlahLain = s ? s.jumlah - (s.ini ? 1 : 0) : 0;
  const p = bacaPerangkat(ua);
  const masukSejak = masuk ?? (s?.ini ? new Date(s.ini.dibuat) : null);
  const nama = (x: string | null) => {
    const q = bacaPerangkat(x);
    return q ? `${q.peramban} · ${q.sistem}` : "Perangkat tak dikenal";
  };

  async function keluarkanLain() {
    try {
      await keluarkanPerangkatLain();
      toast({ judul: "Perangkat lain dikeluarkan", keterangan: "Mereka harus masuk lagi paling lambat satu jam lagi.", nada: "sukses" });
      await muat();
    } catch (err) {
      toast({ judul: "Gagal mengeluarkan perangkat lain", keterangan: (err as Error).message, nada: "gagal" });
    }
  }

  return (
    <div className="lbr-panel akn__panel--perangkat">
      <div className="lbr-panelkepala">
        <h3 className="lbr-judul">
          Perangkat yang masuk
          {s && <span className="lbr-jumlah">{s.jumlah} sesi · {s.aktif24j} aktif hari ini</span>}
        </h3>
        <AlertDialog
          trigger={
            <Tombol ref={pemicuKeluarkan} jenis="secondary" ukuran="medium" disabled={!s || jumlahLain === 0}>
              Keluarkan perangkat lain
            </Tombol>
          }
          title={`Keluarkan ${jumlahLain} sesi lain?`}
          description="Semua perangkat selain yang ini harus masuk lagi. Perangkat ini tetap masuk."
          confirmLabel="Keluarkan"
          destructive
          /* Sesudah berhasil tombol ini MATI (tidak ada perangkat lain), jadi
             fokus papan ketik dipindah ke kontrol berikutnya — jebakan #39. */
          onConfirm={() => jagaFokusSesudahHapus(pemicuKeluarkan.current, keluarkanLain)}
        />
      </div>

      {galat && (
        <Peringatan nada="bahaya" aksi={<Tombol jenis="ghost" ukuran="small" onClick={() => void muat()}>Coba lagi</Tombol>}>{galat}</Peringatan>
      )}
      <ul className="akn__alatkisi">
        <KartuAlat
          ini
          ua={ua}
          judul={p ? `${p.peramban} · ${p.sistem}` : "Perangkat ini"}
          ket={tetap === null ? undefined : tetap ? "Tetap masuk di perangkat ini" : "Masuk selama tab terbuka"}
          masuk={masukSejak ? tanggalJam(masukSejak) : "—"}
          aktif="Sekarang"
        >
          <Tombol
            jenis="ghost"
            ukuran="small"
            kiri={NavSignOut}
            memuat={keluarJalan}
            onClick={async () => {
              setKeluarJalan(true);
              await keluar();
              window.location.replace("/admin/masuk");
            }}
          >
            Keluar dari sini
          </Tombol>
        </KartuAlat>
        {!s && !galat && <li className="akn__alatkartu"><Rangka tinggi={180} /></li>}
        {s?.lain.map((x) => (
          <KartuAlat key={x.id} ua={x.userAgent} judul={nama(x.userAgent)} masuk={tanggalJam(x.dibuat)} aktif={waktuRelatif(x.terakhirAktif)} />
        ))}
        {sisaBernama > 0 && <KartuAlat ua={null} angka={sisaBernama} judul={`${sisaBernama} perangkat lain`} masuk="—" aktif="—" />}
        {s && s.tanpaNama > 0 && (
          <KartuAlat
            ua={null}
            judul={`${s.tanpaNama} sesi tanpa nama perangkat`}
            masuk="Sesi lama"
            aktif={s.tanpaNamaTerakhir ? waktuRelatif(s.tanpaNamaTerakhir) : "—"}
          />
        )}
      </ul>
      {s && jumlahLain === 0 && !galat && (
        <p className="akn__kosong"><Ikon ikon={CheckCircle} ukuran={16} /> Tidak ada perangkat lain yang masuk.</p>
      )}
    </div>
  );
}

/* ─── Tab Tampilan ───────────────────────────────────────────────────────── */

const PILIHAN_TEMA: { nilai: PilihanTema; label: string; ket: string }[] = [
  { nilai: "light", label: "Terang", ket: "Latar mint, kartu putih" },
  { nilai: "dark", label: "Gelap", ket: "Untuk malam dan ruang redup" },
  { nilai: "sistem", label: "Ikuti sistem", ket: "Mengikuti setelan perangkat" },
];

/** Panel mini: rel, kepala, dan dua baris kartu — dalam warna tema itu.
 *  "Ikuti sistem" menumpuk keduanya dan memotong yang gelap miring. */
function LapisTema({ tema }: { tema: "light" | "dark" }) {
  return (
    <span className={`akn__lapis akn__lapis--${tema}`}>
      <span className="akn__prarel"><i /><i /><i /><i /><i /></span>
      <span className="akn__prapanel">
        <i className="akn__prajudul" />
        <span className="akn__prabaris"><i className="is-pejal" /><i /><i /></span>
        <span className="akn__prabaris akn__prabaris--dua"><i /><i /></span>
      </span>
    </span>
  );
}

function PratinjauTema({ nilai }: { nilai: PilihanTema }) {
  return (
    <span className={`akn__pra akn__pra--${nilai}`} aria-hidden="true">
      {nilai === "sistem" ? (
        <>
          <LapisTema tema="light" />
          <LapisTema tema="dark" />
        </>
      ) : (
        <LapisTema tema={nilai} />
      )}
    </span>
  );
}

function PanelTampilan() {
  // "sistem" juga nilai yang dirender server — pilihan sungguhannya dibaca
  // sesudah hidrasi (jebakan #8).
  const [tema, setTema] = useState<PilihanTema>("sistem");
  useEffect(() => {
    setTema(pilihanTema());
    // Tombol tema di navbar menulis pilihan eksplisit; ikuti.
    const dengar = () => setTema(pilihanTema());
    window.addEventListener(PERISTIWA_TEMA, dengar);
    return () => window.removeEventListener(PERISTIWA_TEMA, dengar);
  }, []);

  return (
    <div className="lbr-panel akn__panel--tampilan">
      <div className="akn__tema" role="radiogroup" aria-label="Tema panel">
        {PILIHAN_TEMA.map((t) => (
          <label key={t.nilai} className="akn__temabutir">
            <input
              type="radio"
              name="akn-tema"
              value={t.nilai}
              checked={tema === t.nilai}
              onChange={() => { pilihTema(t.nilai); setTema(t.nilai); }}
            />
            <PratinjauTema nilai={t.nilai} />
            <span className="akn__temateks">
              <b>{t.label}</b>
              <small>{t.ket}</small>
            </span>
            <span className="akn__temacek" aria-hidden="true"><Ikon ikon={CheckCircle} ukuran={18} /></span>
          </label>
        ))}
      </div>
    </div>
  );
}

/* ─── Halaman ────────────────────────────────────────────────────────────── */

function Isi() {
  const profil = useProfil();
  const [akun, setAkun] = useState<InfoAkun | null>(null);
  const [galat, setGalat] = useState<string | null>(null);
  const [namaKini, setNamaKini] = useState<string | null | undefined>(undefined);
  const [ubahNama, setUbahNama] = useState(false);
  const [fokusSandi, setFokusSandi] = useState(false);
  // "profil" juga yang dirender server; tab dari alamat dibaca sesudah
  // hidrasi (jebakan #8).
  const [tab, setTabState] = useState<Tab>("profil");

  useEffect(() => {
    setTabState(tabDariAlamat(NAMA_TAB));
    const dengar = () => setTabState(tabDariAlamat(NAMA_TAB));
    window.addEventListener("hashchange", dengar);
    return () => window.removeEventListener("hashchange", dengar);
  }, []);
  const setTab = (t: Tab) => {
    setTabState(t);
    setFokusSandi(false);
    tulisTabKeAlamat(t, "profil");
  };

  function muat(): Promise<void> {
    setGalat(null);
    return ambilAkun()
      .then((a) => { setAkun(a); setNamaKini(a.nama); })
      .catch((e) => setGalat((e as Error).message));
  }
  useEffect(() => { void muat(); }, []);

  const email = akun?.email || profil.email;
  const master = akun?.isMasterAdmin ?? profil.isMasterAdmin;
  const namaTersimpan = (namaKini !== undefined ? namaKini : profil.nama) ?? "";
  const nama = namaTampilan({ email, nama: namaTersimpan });

  return (
    <div className="lbr akn">
      <header className="lbr-kepala">
        {/* Kop lembar — data akun sungguhan, bukan hiasan. */}
        <SampulLembar
          gambar={<DenahSampul />}
          kop={[
            { label: "Peran", nilai: master ? "Master admin" : "Staf" },
            { label: "Sesi aktif", nilai: akun ? akun.sesi.jumlah : "—" },
            { label: "Terakhir masuk", nilai: akun ? tanggalJam(akun.terakhirMasuk) : "—" },
          ]}
        />
        <div className="lbr-identitas">
          <span className="akn__avatar" aria-hidden="true">
            {inisial(nama)}
            <i className="akn__avatarhidup" />
          </span>
          <div className="lbr-siapa">
            <h2 className="lbr-nama">
              {nama}
              <Lencana bentuk="pejalkecil" nada={master ? "selesai" : "netral"}>{master ? "Master admin" : "Staf"}</Lencana>
            </h2>
            <p className="lbr-sub"><Ikon ikon={NavEnvelope} ukuran={14} />{email}</p>
          </div>
          <div className="lbr-pintas">
            <Tombol jenis="secondary" ukuran="medium" kiri={NotePencil} onClick={() => { setTab("profil"); setUbahNama(true); }}>
              Ubah nama
            </Tombol>
            <Tombol jenis="primary" ukuran="medium" kiri={SpecialSealCheck} onClick={() => { setTab("keamanan"); setFokusSandi(true); }}>
              Ganti kata sandi
            </Tombol>
          </div>
        </div>
        <TabLembar
          awalan="akn"
          label="Bagian akun"
          nilai={tab}
          onPilih={setTab}
          tab={TAB.map((t) => (t.nilai === "perangkat" ? { ...t, angka: akun?.sesi.jumlah ?? null } : t))}
        />
      </header>
      <section className="lbr-isi" id="akn-panel" role="tabpanel" aria-labelledby={`akn-tab-${tab}`}>
        {tab === "profil" && (
          <PanelProfil
            akun={akun}
            nama={nama}
            namaTersimpan={namaTersimpan}
            email={email}
            master={master}
            ubah={ubahNama}
            setUbah={setUbahNama}
            onNama={setNamaKini}
          />
        )}
        {tab === "keamanan" && <PanelKeamanan email={email} fokusAwal={fokusSandi} onBerhasil={() => void muat()} />}
        {tab === "perangkat" && <PanelPerangkat akun={akun} galat={galat} muat={muat} />}
        {tab === "tampilan" && <PanelTampilan />}
      </section>
    </div>
  );
}

function Kerangka(): ReactNode {
  return (
    <div className="lbr lbr--rangka" aria-hidden="true">
      <div className="lbr-kepala"><div className="lbr-sampul" /></div>
      <div className="lbr-isi" />
    </div>
  );
}

export function AkunKit() {
  return (
    <RequireAuth skeleton={<Kerangka />}>
      <ToastProvider>
        <Isi />
      </ToastProvider>
    </RequireAuth>
  );
}
