import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as PE } from "react";
import { RequireAuth, useProfil } from "./RequireAuth";
import { GagalMuat } from "./gagalMuat";
import { geraknya } from "./hitung";
import { ToastProvider, useToast } from "../kit/Toast";
import { Dialog } from "../kit/Overlay";
import { Isian, Sakelar } from "../kit/Isian";
import { IsianTanggal, PilihMenu } from "../kit/Formulir";
import { Tombol } from "../kit/Tombol";
import { Ikon } from "../kit/Ikon";
import { ArrowClockwise, CopySimple, Plus } from "../kit/ikon";
import { tanya } from "../../lib/tanya";
import { inisial } from "../../lib/nomorDokumen";
import { daftarLembar, KODE_KELOMPOK, type Lembar } from "../../lib/navAdmin";
import { FITUR_PEMILIK, FITUR_SELALU, hariIniWIB, hitungAkses, type StatusLangganan } from "../../../../api/src/lib/fitur";
import {
  aturFiturPaket,
  bacaCache,
  buatPaketAkses,
  buatPengguna,
  daftarAudit,
  daftarPaketAkses,
  daftarPengguna,
  hapusPaketAkses,
  resetSandiPengguna,
  tulisCache,
  ubahPaketAkses,
  ubahPengguna,
  type EntriAudit,
  type PaketAkses,
  type PenggunaAdmin,
  type PeranAkun,
} from "../../lib/admin";

/* =============================================================================
   Pengguna & Akses (/admin/pengguna) — MATRIKS DAFTAR GAMBAR. Owner saja.

   Di set gambar kerja, lembar distribusi menyebut gambar mana dikirim ke
   pihak mana: baris = nomor lembar, kolom = penerima, sel = tanda kirim.
   Halaman ini bentuk yang sama untuk akses panel: baris = lembar (nomor yang
   sama dengan rel samping), kolom = Owner, Staf, lalu tiap paket langganan,
   sel = cap akses. Mengeklik sel paket mengubah mapping fiturnya — satu sel
   satu permintaan, jadi buku log audit mencatat tiap perubahan satu per satu.

   1. KOP — jumlah pengguna, pelanggan aktif, yang perlu ditagih (habis atau
      belum bayar), perubahan 24 jam; dan catatan terbuka bahwa pelanggan
      belum bisa masuk (tahap 1: data masih satu studio).
   2. MATRIKS — kertas putih tetap; kepala kolom paket = nama, harga, jumlah
      pelanggan, fitur n/19 (diklik = ubah paket). Lembar SELALU tercap di
      semua kolom; lembar PEMILIK hanya di kolom Owner.
   3. PEMEGANG AKSES — tiap akun: peran, paket, masa aktif, keadaan
      langganan (dihitung dengan `hitungAkses` yang SAMA dengan API).
   4. BUKU LOG AUDIT — siapa, kapan, apa; dibuka = sebelum → sesudah.

   Sorot silang (tetikus saja, jebakan #9): menunjuk kolom paket menyalakan
   pemegangnya, menunjuk pemegang menyalakan kolom paketnya.
   Gerak hanya karena perbuatan: cap dibubuhkan saat sel diubah.
   ============================================================================= */

const PERAN: Record<PeranAkun, string> = { admin: "Owner", editor: "Staf", pelanggan: "Pelanggan" };
const OPSI_PERAN = (["pelanggan", "editor", "admin"] as const).map((p) => ({ nilai: p, label: PERAN[p] }));

const ENTITAS: Record<string, string> = {
  projects: "proyek", invoices: "tagihan", payments: "pembayaran", costs: "biaya", tasks: "tugas",
  directory: "kontak", team: "anggota tim", testimonials: "testimoni", ledger: "kas studio", payroll: "gaji",
  "project-team": "penugasan tim", "team-payouts": "bayaran tim", inquiries: "pesan masuk", documents: "dokumen",
  brief: "brief", progress: "portal klien", "progress-updates": "kabar portal", users: "pengguna",
  "access-plans": "paket akses", settings: "info studio", account: "akun", uploads: "unggahan",
  publish: "terbitkan situs", "fee-rules": "aturan fee", targets: "target", images: "foto",
};

const KATA_AKSI: Record<EntriAudit["action"], string> = {
  masuk: "masuk", gagal_masuk: "gagal masuk", keluar: "keluar", buat: "menambah", ubah: "mengubah", hapus: "menghapus", ditolak: "ditolak membuka",
};

/* Kolom yang tidak perlu ditampilkan di "sebelum → sesudah". */
const ABAIKAN = new Set(["updated_at", "created_at", "id"]);

function rupiahPendek(n: number | null): string {
  if (n === null) return "tanpa harga";
  if (n === 0) return "gratis";
  if (n >= 1_000_000) return `Rp${(n / 1_000_000).toLocaleString("id-ID", { maximumFractionDigits: 1 })} jt`;
  return `Rp${Math.round(n / 1000).toLocaleString("id-ID")} rb`;
}

const tglPendek = (iso: string) =>
  new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });

function selisihHari(dari: string, ke: string): number {
  return Math.round((Date.parse(`${ke}T00:00:00Z`) - Date.parse(`${dari}T00:00:00Z`)) / 86_400_000);
}

function tambahBulan(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  const hari = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + n);
  const akhir = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(hari, akhir));
  return d.toISOString().slice(0, 10);
}

/** Keadaan langganan satu akun — rumus yang sama dengan penjagaan API. */
function keadaan(u: PenggunaAdmin, paket: PaketAkses[], hari: string): StatusLangganan {
  const p = paket.find((x) => x.id === u.planId);
  return hitungAkses({ role: u.role, isSuspended: u.isSuspended, accessUntil: u.accessUntil, fiturPaket: p?.isActive ? p.fitur : [] }, hari).status;
}

function capKeadaan(u: PenggunaAdmin, k: StatusLangganan, hari: string): { teks: string; nada: string } {
  switch (k) {
    case "pemilik": return { teks: "tanpa batas", nada: "netral" };
    case "staf": return { teks: "staf studio", nada: "netral" };
    case "nonaktif": return { teks: "dinonaktifkan", nada: "bahaya" };
    case "belum": return { teks: "belum bayar", nada: "amber" };
    case "habis": return { teks: `lewat ${selisihHari(u.accessUntil!, hari)} hr`, nada: "amber" };
    default: {
      const sisa = selisihHari(hari, u.accessUntil!);
      return { teks: sisa <= 7 ? `sisa ${sisa} hr` : `s.d. ${tglPendek(u.accessUntil!)}`, nada: sisa <= 7 ? "amber" : "hidup" };
    }
  }
}

/* ---- Halaman ---------------------------------------------------------------------- */

function Isi() {
  const toast = useToast();
  const profil = useProfil();
  const [pengguna, setPengguna] = useState<PenggunaAdmin[] | null>(() => bacaCache<PenggunaAdmin[]>("akses-pengguna"));
  const [paket, setPaket] = useState<PaketAkses[] | null>(() => bacaCache<PaketAkses[]>("akses-paket"));
  const [log, setLog] = useState<EntriAudit[] | null>(() => bacaCache<EntriAudit[]>("akses-log"));
  const [galat, setGalat] = useState<string | null>(null);
  const [habisLog, setHabisLog] = useState(false);
  const [sorot, setSorot] = useState<string | null>(null);
  const [tercap, setTercap] = useState<string | null>(null);
  const [ubahPaket, setUbahPaket] = useState<PaketAkses | "baru" | null>(null);
  const [ubahOrang, setUbahOrang] = useState<PenggunaAdmin | "baru" | null>(null);
  const hari = hariIniWIB();

  async function muat() {
    try {
      const [u, p, l] = await Promise.all([daftarPengguna(), daftarPaketAkses(), daftarAudit({ batas: 60 })]);
      tulisCache("akses-pengguna", u);
      tulisCache("akses-paket", p);
      tulisCache("akses-log", l);
      setPengguna(u);
      setPaket(p);
      setLog(l);
      setHabisLog(l.length < 60);
      setGalat(null);
    } catch (e) {
      setGalat((e as Error).message);
    }
  }
  useEffect(() => { void muat(); }, []);

  /* Log baru selalu diambil ulang sesudah perbuatan — yang baru saja diubah
     langsung terbaca di bukunya. */
  async function segarkanLog() {
    try {
      const l = await daftarAudit({ batas: 60 });
      tulisCache("akses-log", l);
      setLog(l);
      setHabisLog(l.length < 60);
    } catch { /* buku log tetap yang lama */ }
  }

  async function muatLebihLama() {
    if (!log?.length) return;
    try {
      const lagi = await daftarAudit({ batas: 60, sebelum: log[log.length - 1]!.id });
      setLog([...log, ...lagi]);
      setHabisLog(lagi.length < 60);
    } catch (e) {
      toast({ judul: "Log lama tidak bisa dimuat", keterangan: (e as Error).message, nada: "gagal" });
    }
  }

  async function ketukSel(p: PaketAkses, fitur: string) {
    const nyala = !p.fitur.includes(fitur);
    const ganti = (f: string[]) => setPaket((l) => l?.map((x) => (x.id === p.id ? { ...x, fitur: f } : x)) ?? l);
    ganti(nyala ? [...p.fitur, fitur].sort() : p.fitur.filter((x) => x !== fitur));
    if (geraknya()) {
      setTercap(`${p.id}:${fitur}`);
      window.setTimeout(() => setTercap((t) => (t === `${p.id}:${fitur}` ? null : t)), 460);
    }
    try {
      await aturFiturPaket(p.id, fitur, nyala);
      void segarkanLog();
    } catch (e) {
      ganti(p.fitur);
      toast({ judul: "Akses tidak tersimpan", keterangan: (e as Error).message, nada: "gagal" });
    }
  }

  if (galat && !pengguna) return <GagalMuat apa="Pengguna & akses" galat={galat} />;
  if (!pengguna || !paket || !log) return <Rangka />;

  const lembar = daftarLembar().halaman;
  const kelompok = [...new Set(lembar.map((l) => l.kelompok))];
  const pelanggan = pengguna.filter((u) => u.role === "pelanggan");
  const kead = new Map(pengguna.map((u) => [u.id, keadaan(u, paket, hari)]));
  const aktif = pelanggan.filter((u) => kead.get(u.id) === "aktif").length;
  const tagih = pelanggan.filter((u) => ["habis", "belum"].includes(kead.get(u.id)!)).length;
  const sehari = Date.now() - 86_400_000;
  const ubah24 = log.filter((l) => Date.parse(l.at) > sehari && ["buat", "ubah", "hapus"].includes(l.action)).length;
  const jumlahPaket = lembar.filter((l) => !isSelalu(l) && !isPemilik(l)).length;
  const kolomSorot = (k: string) => sorot === k;

  const tunjuk = (k: string | null) => (e: PE) => {
    if (e.pointerType === "mouse") setSorot(k);
  };

  return (
    <div className="aks">
      <div className="aks__papan">
        {/* 1. Kop */}
        <header className="aks__kop">
          <div className="aks__kopjudul">
            <p>Pengguna & akses · distribusi lembar</p>
            <h2>Matriks akses</h2>
          </div>
          <dl className="aks__sel">
            <div>
              <dt>Pengguna</dt>
              <dd>{pengguna.length}</dd>
              <small>{pelanggan.length} pelanggan</small>
            </div>
            <div>
              <dt>Pelanggan aktif</dt>
              <dd>{aktif}</dd>
              <small>dari {pelanggan.length} pelanggan</small>
            </div>
            <div className={tagih ? "is-amber" : undefined}>
              <dt>Perlu ditagih</dt>
              <dd>{tagih}</dd>
              <small>habis / belum bayar</small>
            </div>
            <div>
              <dt>Perubahan</dt>
              <dd>{ubah24}</dd>
              <small>24 jam terakhir</small>
            </div>
          </dl>
          <p className="aks__tahap" role="note">
            <b>Tahap 1</b> Akun pelanggan sudah bisa diatur, tapi belum bisa masuk sampai data tiap studio dipisah.
          </p>
        </header>

        {/* 2. Matriks */}
        <section className="aks__kertas" aria-labelledby="aks-matriks">
          <div className="aks__kertaskop">
            <h3 id="aks-matriks">Distribusi lembar per paket</h3>
            <p>{lembar.length} lembar · {jumlahPaket} bisa dijual · klik sel untuk mengubah</p>
            <Tombol ukuran="small" jenis="secondary" kiri={Plus} onClick={() => setUbahPaket("baru")}>Paket</Tombol>
          </div>
          <div className="aks__gulir">
            <table className="aks__matriks" style={{ "--aks-n": 2 + paket.length } as CSSProperties}>
              <thead>
                <tr>
                  <th scope="col" className="aks__kno">No.</th>
                  <th scope="col" className="aks__klembar">Lembar</th>
                  <th scope="col" className={`aks__kolom${kolomSorot("admin") ? " is-sorot" : ""}`} onPointerEnter={tunjuk("admin")} onPointerLeave={tunjuk(null)}>
                    <span className="aks__knama">Owner</span>
                    <span className="aks__kket">tanpa batas</span>
                  </th>
                  <th scope="col" className={`aks__kolom${kolomSorot("editor") ? " is-sorot" : ""}`} onPointerEnter={tunjuk("editor")} onPointerLeave={tunjuk(null)}>
                    <span className="aks__knama">Staf</span>
                    <span className="aks__kket">studio pemilik</span>
                  </th>
                  {paket.map((p) => (
                    <th
                      key={p.id}
                      scope="col"
                      className={`aks__kolom aks__kolom--paket${kolomSorot(p.id) ? " is-sorot" : ""}${p.isActive ? "" : " is-mati"}`}
                      onPointerEnter={tunjuk(p.id)}
                      onPointerLeave={tunjuk(null)}
                    >
                      <button type="button" onClick={() => setUbahPaket(p)} aria-label={`Ubah paket ${p.name}`}>
                        <span className="aks__knama">{p.name}</span>
                        <span className={`aks__kket${p.priceMonth === null ? " is-amber" : ""}`}>
                          {rupiahPendek(p.priceMonth)}{p.priceMonth ? "/bln" : ""}
                        </span>
                        <span className="aks__kket">{p.isActive ? `${p.pengguna} pelanggan` : "nonaktif"}</span>
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              {kelompok.map((g) => (
                <tbody key={g}>
                  <tr className="aks__grup">
                    <th scope="rowgroup" colSpan={4 + paket.length}>
                      <span className="aks__grupnama">
                        <span className="aks__huruf">{KODE_KELOMPOK[g] ?? g.slice(0, 1)}</span>
                        {g}
                      </span>
                    </th>
                  </tr>
                  {lembar.filter((l) => l.kelompok === g).map((l) => {
                    const selalu = isSelalu(l);
                    const pemilik = isPemilik(l);
                    return (
                      <tr key={l.kode} className={selalu ? "is-selalu" : pemilik ? "is-pemilik" : undefined}>
                        <td className="aks__kno">{l.kode}</td>
                        <th scope="row" className="aks__klembar">
                          {l.induk ? <small>{l.induk} ·</small> : null} {l.label}
                          {selalu && <em>selalu ada</em>}
                          {pemilik && <em>khusus owner</em>}
                        </th>
                        <td className={`aks__sel-c${kolomSorot("admin") ? " is-sorot" : ""}`}><Cap nyala kunci /></td>
                        <td className={`aks__sel-c${kolomSorot("editor") ? " is-sorot" : ""}`}>{pemilik ? <Strip /> : <Cap nyala kunci />}</td>
                        {paket.map((p) => (
                          <td key={p.id} className={`aks__sel-c${kolomSorot(p.id) ? " is-sorot" : ""}${p.isActive ? "" : " is-mati"}`}>
                            {selalu ? (
                              <Cap nyala kunci />
                            ) : pemilik ? (
                              <Strip />
                            ) : (
                              <button
                                type="button"
                                className={`aks__cap${p.fitur.includes(l.fitur) ? " is-nyala" : ""}${tercap === `${p.id}:${l.fitur}` ? " is-tercap" : ""}`}
                                aria-pressed={p.fitur.includes(l.fitur)}
                                aria-label={`${l.label} untuk paket ${p.name}`}
                                onClick={() => void ketukSel(p, l.fitur)}
                              />
                            )}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              ))}
              <tfoot>
                <tr>
                  <td className="aks__kno" />
                  <th scope="row" className="aks__klembar">Jumlah lembar</th>
                  <td className={`aks__sel-c${kolomSorot("admin") ? " is-sorot" : ""}`}>{lembar.length}</td>
                  <td className={`aks__sel-c${kolomSorot("editor") ? " is-sorot" : ""}`}>{lembar.filter((l) => !isPemilik(l)).length}</td>
                  {paket.map((p) => (
                    <td key={p.id} className={`aks__sel-c${kolomSorot(p.id) ? " is-sorot" : ""}${p.isActive ? "" : " is-mati"}`}>
                      {lembar.filter((l) => isSelalu(l) || p.fitur.includes(l.fitur)).length}
                    </td>
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="aks__kunci" aria-hidden="true">
            <span><Cap nyala kunci /> akses tetap</span>
            <span><span className="aks__cap is-nyala is-contoh" /> termasuk paket</span>
            <span><span className="aks__cap is-contoh" /> tidak termasuk</span>
            <span><Strip /> tidak pernah</span>
          </p>
        </section>

        {/* 3. Pemegang akses */}
        <section className="aks__kartu aks__orang" aria-labelledby="aks-orang">
          <div className="aks__kartukop">
            <h3 id="aks-orang">Pemegang akses</h3>
            <Tombol ukuran="small" jenis="secondary" kiri={Plus} onClick={() => setUbahOrang("baru")}>Pengguna</Tombol>
          </div>
          <ul className="aks__daftar">
            {pengguna.map((u) => {
              const k = kead.get(u.id)!;
              const cap = capKeadaan(u, k, hari);
              const kolom = u.role === "pelanggan" ? u.planId : u.role;
              return (
                <li key={u.id} className={kolom && sorot === kolom ? "is-sorot" : undefined}>
                  <button
                    type="button"
                    onClick={() => setUbahOrang(u)}
                    onPointerEnter={tunjuk(kolom ?? null)}
                    onPointerLeave={tunjuk(null)}
                  >
                    <span className={`aks__inisial aks__inisial--${u.role}`} aria-hidden="true">{inisial(u.nama || u.email || "?")}</span>
                    <span className="aks__siapa">
                      <b>{u.nama || (u.email ?? "").split("@")[0]}</b>
                      <small>{u.email}</small>
                    </span>
                    <span className="aks__peran">
                      <b>{u.role === "pelanggan" ? u.planName ?? "tanpa paket" : PERAN[u.role]}</b>
                      <small className={`is-${cap.nada}`}>{cap.teks}</small>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="aks__kaki">Masa aktif terisi otomatis begitu payment gateway tersambung. Sampai saat itu diisi tangan di sini.</p>
        </section>

        {/* 4. Buku log audit */}
        <BukuLog log={log} pengguna={pengguna} habis={habisLog} onLagi={() => void muatLebihLama()} onSegar={() => void segarkanLog()} />
      </div>

      <DialogPaket
        paket={ubahPaket}
        onTutup={() => setUbahPaket(null)}
        onSelesai={() => { setUbahPaket(null); void muat(); }}
      />
      <DialogPengguna
        orang={ubahOrang}
        paket={paket}
        diriSendiri={profil.email}
        onTutup={() => setUbahOrang(null)}
        onSelesai={() => void muat()}
      />
    </div>
  );
}

const isSelalu = (l: Lembar) => (FITUR_SELALU as readonly string[]).includes(l.fitur);
const isPemilik = (l: Lembar) => (FITUR_PEMILIK as readonly string[]).includes(l.fitur);

function Cap({ nyala, kunci }: { nyala: boolean; kunci?: boolean }) {
  return <span className={`aks__cap${nyala ? " is-nyala" : ""}${kunci ? " is-kunci" : ""}`} role="img" aria-label={nyala ? "akses" : "tanpa akses"} />;
}
function Strip() {
  return <span className="aks__strip" role="img" aria-label="tidak pernah" />;
}

/* ---- Buku log audit ------------------------------------------------------------------ */

type Saring = "semua" | "masuk" | "ubah" | "tolak";
const SARING: { k: Saring; label: string; cocok: (a: EntriAudit["action"]) => boolean }[] = [
  { k: "semua", label: "Semua", cocok: () => true },
  { k: "masuk", label: "Masuk", cocok: (a) => a === "masuk" || a === "keluar" || a === "gagal_masuk" },
  { k: "ubah", label: "Perubahan", cocok: (a) => a === "buat" || a === "ubah" || a === "hapus" },
  { k: "tolak", label: "Ditolak", cocok: (a) => a === "ditolak" || a === "gagal_masuk" },
];

function hariLog(iso: string): string {
  const d = new Date(iso);
  const kini = new Date();
  const sama = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (sama(d, kini)) return "Hari ini";
  const kemarin = new Date(kini);
  kemarin.setDate(kini.getDate() - 1);
  if (sama(d, kemarin)) return "Kemarin";
  return d.toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short" });
}

function perubahan(e: EntriAudit): { kolom: string; lama: string; baru: string }[] {
  const s = e.detail?.sebelum ?? null;
  const t = e.detail?.sesudah ?? null;
  const teks = (v: unknown) => (v === null || v === undefined || v === "" ? "—" : typeof v === "object" ? JSON.stringify(v) : String(v));
  if (s && t) {
    return Object.keys(t)
      .filter((k) => !ABAIKAN.has(k) && JSON.stringify(s[k]) !== JSON.stringify(t[k]))
      .map((k) => ({ kolom: k, lama: teks(s[k]), baru: teks(t[k]) }));
  }
  if (s && e.action === "hapus") {
    return Object.keys(s).filter((k) => !ABAIKAN.has(k) && s[k] !== null).slice(0, 6).map((k) => ({ kolom: k, lama: teks(s[k]), baru: "—" }));
  }
  const kirim = e.detail?.kiriman;
  if (kirim && typeof kirim === "object") {
    return Object.entries(kirim as Record<string, unknown>).slice(0, 8).map(([k, v]) => ({ kolom: k, lama: "", baru: teks(v) }));
  }
  return [];
}

function BukuLog({ log, pengguna, habis, onLagi, onSegar }: {
  log: EntriAudit[]; pengguna: PenggunaAdmin[]; habis: boolean; onLagi: () => void; onSegar: () => void;
}) {
  const [saring, setSaring] = useState<Saring>("semua");
  const [buka, setBuka] = useState<number | null>(null);
  const cocok = SARING.find((s) => s.k === saring)!.cocok;
  const tampil = log.filter((e) => cocok(e.action));
  const nama = (e: EntriAudit) =>
    e.actorNama || pengguna.find((u) => u.id === e.actorId)?.nama || (e.actorEmail ?? "tanpa akun").split("@")[0];
  let hariSebelum = "";
  return (
    <section className="aks__kartu aks__log" aria-labelledby="aks-log">
      <div className="aks__kartukop">
        <h3 id="aks-log">Log audit</h3>
        <div className="aks__saring" role="group" aria-label="Saring log">
          {SARING.map((s) => (
            <button key={s.k} type="button" aria-pressed={saring === s.k} onClick={() => setSaring(s.k)}>{s.label}</button>
          ))}
        </div>
        <button type="button" className="aks__segar" onClick={onSegar} aria-label="Segarkan log">
          <Ikon ikon={ArrowClockwise} ukuran={14} />
        </button>
      </div>
      <ol className="aks__baris">
        {tampil.length === 0 && <li className="aks__kosong">Belum ada catatan untuk saringan ini.</li>}
        {tampil.map((e) => {
          const h = hariLog(e.at);
          const kepala = h !== hariSebelum ? h : null;
          hariSebelum = h;
          const rinci = buka === e.id ? perubahan(e) : [];
          const ent = e.entity ? ENTITAS[e.entity] ?? e.entity : "";
          return (
            <li key={e.id}>
              {kepala && <p className="aks__hari">{kepala}</p>}
              <button
                type="button"
                className={`aks__entri is-${e.action}${buka === e.id ? " is-buka" : ""}`}
                aria-expanded={buka === e.id}
                onClick={() => setBuka(buka === e.id ? null : e.id)}
              >
                <time dateTime={e.at}>{new Date(e.at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}</time>
                <span className="aks__titik" aria-hidden="true" />
                <span className="aks__kalimat">
                  <b>{nama(e)}</b> {KATA_AKSI[e.action]} {e.action === "masuk" || e.action === "keluar" || e.action === "gagal_masuk" ? "" : ent}
                  {e.action === "gagal_masuk" && e.detail?.alasan ? <small> · {e.detail.alasan}</small> : null}
                </span>
                {e.status && e.status >= 400 && e.action !== "gagal_masuk" && e.action !== "ditolak" ? <small className="aks__galat">{e.status}</small> : null}
              </button>
              {buka === e.id && (
                <div className="aks__rinci">
                  <p className="aks__jalur"><code>{e.method} {e.path}</code>{e.actorEmail ? ` · ${e.actorEmail}` : ""}</p>
                  {rinci.length ? (
                    <dl>
                      {rinci.map((r) => (
                        <div key={r.kolom}>
                          <dt>{r.kolom}</dt>
                          <dd>{r.lama && <s>{r.lama}</s>} {r.lama && "→"} <b>{r.baru}</b></dd>
                        </div>
                      ))}
                    </dl>
                  ) : (
                    <p className="aks__jalur">Tanpa rincian isi.</p>
                  )}
                </div>
              )}
            </li>
          );
        })}
        {!habis && (
          <li>
            <button type="button" className="aks__lagi" onClick={onLagi}>Muat catatan lebih lama</button>
          </li>
        )}
      </ol>
    </section>
  );
}

/* ---- Dialog paket ---------------------------------------------------------------------- */

function DialogPaket({ paket, onTutup, onSelesai }: { paket: PaketAkses | "baru" | null; onTutup: () => void; onSelesai: () => void }) {
  const toast = useToast();
  const baru = paket === "baru";
  const [f, setF] = useState({ name: "", price: "", description: "", isActive: true });
  const [sibuk, setSibuk] = useState(false);
  useEffect(() => {
    if (!paket) return;
    setF(baru
      ? { name: "", price: "", description: "", isActive: true }
      : { name: paket.name, price: paket.priceMonth === null ? "" : String(paket.priceMonth), description: paket.description ?? "", isActive: paket.isActive });
  }, [paket]);
  const nama = f.name.trim();
  const harga = f.price.replace(/\D/g, "");
  const salahNama = nama.length < 2 || nama.length > 40;

  async function simpan() {
    setSibuk(true);
    try {
      const isi = { name: nama, description: f.description.trim() || null, priceMonth: harga ? Number(harga) : null };
      if (baru) await buatPaketAkses(isi);
      else await ubahPaketAkses((paket as PaketAkses).id, { ...isi, isActive: f.isActive });
      toast({ judul: baru ? `Paket ${nama} ditambahkan` : `Paket ${nama} disimpan`, nada: "sukses" });
      onSelesai();
    } catch (e) {
      toast({ judul: "Paket tidak tersimpan", keterangan: (e as Error).message, nada: "gagal" });
    } finally {
      setSibuk(false);
    }
  }

  async function hapus() {
    if (baru || !paket) return;
    onTutup();
    if (!(await tanya({ judul: `Hapus paket ${paket.name}?`, isi: "Mapping fiturnya ikut terhapus.", ya: "Ya, hapus", bahaya: true }))) return;
    try {
      await hapusPaketAkses(paket.id);
      toast({ judul: `Paket ${paket.name} dihapus`, nada: "sukses" });
      onSelesai();
    } catch (e) {
      toast({ judul: "Paket tidak bisa dihapus", keterangan: (e as Error).message, nada: "gagal" });
    }
  }

  return (
    <Dialog
      open={paket !== null}
      onOpenChange={(o) => !o && onTutup()}
      title={baru ? "Paket langganan baru" : `Paket ${(paket as PaketAkses | null)?.name ?? ""}`}
      footer={
        <>
          {!baru && (
            <Tombol
              ukuran="medium"
              jenis="bahaya"
              className="aks__dialogkiri"
              onClick={() => void hapus()}
              disabled={sibuk || ((paket as PaketAkses | null)?.pengguna ?? 0) > 0}
              title={((paket as PaketAkses | null)?.pengguna ?? 0) > 0 ? "Masih dipakai pelanggan — nonaktifkan saja" : undefined}
            >
              Hapus paket
            </Tombol>
          )}
          <Tombol ukuran="medium" jenis="ghost" onClick={onTutup} disabled={sibuk}>Batal</Tombol>
          <Tombol ukuran="medium" jenis="primary" onClick={() => void simpan()} disabled={sibuk || salahNama} memuat={sibuk}>Simpan</Tombol>
        </>
      }
    >
      <div className="aks__dialogisi">
        <Isian label="Nama paket" value={f.name} maxLength={40} onChange={(e) => setF({ ...f, name: e.currentTarget.value })} bantu={salahNama && f.name ? "Nama 2–40 karakter." : undefined} />
        <Isian
          label="Harga per bulan"
          inputMode="numeric"
          value={harga ? Number(harga).toLocaleString("id-ID") : ""}
          placeholder="kosong = belum ditentukan"
          onChange={(e) => setF({ ...f, price: e.currentTarget.value })}
          kanan={<span className="aks__satuan">Rp/bln</span>}
        />
        <Isian label="Keterangan singkat" value={f.description} maxLength={200} onChange={(e) => setF({ ...f, description: e.currentTarget.value })} />
        {!baru && (
          <label className="aks__sakelar">
            <Sakelar judul="Paket aktif" checked={f.isActive} onChange={(e) => setF({ ...f, isActive: e.currentTarget.checked })} />
            <span>
              <b>Paket aktif</b>
              <small>Paket nonaktif tidak memberi fitur apa pun ke pemegangnya.</small>
            </span>
          </label>
        )}
      </div>
    </Dialog>
  );
}

/* ---- Dialog pengguna ---------------------------------------------------------------------- */

function DialogPengguna({ orang, paket, diriSendiri, onTutup, onSelesai }: {
  orang: PenggunaAdmin | "baru" | null; paket: PaketAkses[]; diriSendiri: string; onTutup: () => void; onSelesai: () => void;
}) {
  const toast = useToast();
  const baru = orang === "baru";
  const lama = baru || !orang ? null : orang;
  const hari = hariIniWIB();
  const [f, setF] = useState({ email: "", nama: "", role: "pelanggan" as PeranAkun, planId: "", until: "", suspended: false });
  const [sibuk, setSibuk] = useState(false);
  const [sandi, setSandi] = useState<string | null>(null);
  const sandiRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!orang) return;
    setSandi(null);
    setF(lama
      ? { email: lama.email ?? "", nama: lama.nama ?? "", role: lama.role, planId: lama.planId ?? "", until: lama.accessUntil ?? "", suspended: lama.isSuspended }
      : { email: "", nama: "", role: "pelanggan", planId: paket.find((p) => p.isActive)?.id ?? "", until: "", suspended: false });
  }, [orang]);

  const diri = lama?.email === diriSendiri;
  const emailSah = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email.trim());
  const dasarMasa = f.until && f.until > hari ? f.until : hari;

  async function simpan() {
    setSibuk(true);
    try {
      if (baru) {
        const r = await buatPengguna({
          email: f.email.trim(), nama: f.nama.trim() || null, role: f.role,
          planId: f.role === "pelanggan" ? f.planId || null : null, accessUntil: f.role === "pelanggan" ? f.until || null : null,
        });
        setSandi(r.sandiSementara);
        toast({ judul: "Pengguna dibuat", keterangan: f.email.trim(), nada: "sukses" });
        onSelesai();
        return;
      }
      if (!lama) return;
      const p: Parameters<typeof ubahPengguna>[1] = {};
      if ((f.nama.trim() || null) !== (lama.nama || null)) p.nama = f.nama.trim() || null;
      if (f.role !== lama.role) p.role = f.role;
      if ((f.planId || null) !== lama.planId) p.planId = f.planId || null;
      if ((f.until || null) !== lama.accessUntil) p.accessUntil = f.until || null;
      if (f.suspended !== lama.isSuspended) p.isSuspended = f.suspended;
      if (Object.keys(p).length) {
        await ubahPengguna(lama.id, p);
        toast({ judul: "Pengguna disimpan", keterangan: lama.email ?? undefined, nada: "sukses" });
        onSelesai();
      }
      onTutup();
    } catch (e) {
      toast({ judul: "Pengguna tidak tersimpan", keterangan: (e as Error).message, nada: "gagal" });
    } finally {
      setSibuk(false);
    }
  }

  async function reset() {
    if (!lama) return;
    setSibuk(true);
    try {
      const r = await resetSandiPengguna(lama.id);
      setSandi(r.sandiSementara);
      onSelesai();
    } catch (e) {
      toast({ judul: "Sandi tidak bisa disetel ulang", keterangan: (e as Error).message, nada: "gagal" });
    } finally {
      setSibuk(false);
    }
  }

  async function salin() {
    if (!sandi) return;
    try {
      await navigator.clipboard.writeText(sandi);
      toast({ judul: "Sandi sementara disalin", nada: "sukses" });
    } catch {
      sandiRef.current?.select();
    }
  }

  const opsiPaket = [{ nilai: "", label: "Tanpa paket" }, ...paket.map((p) => ({ nilai: p.id, label: p.isActive ? p.name : `${p.name} (nonaktif)` }))];

  return (
    <Dialog
      open={orang !== null}
      onOpenChange={(o) => !o && onTutup()}
      title={sandi ? "Sandi sementara" : baru ? "Pengguna baru" : lama?.nama || lama?.email || "Pengguna"}
      ukuran="lebar"
      footer={
        sandi ? (
          <Tombol ukuran="medium" jenis="primary" onClick={onTutup}>Selesai</Tombol>
        ) : (
          <>
            {lama && (
              <Tombol ukuran="medium" jenis="ghost" className="aks__dialogkiri" onClick={() => void reset()} disabled={sibuk}>
                Setel ulang sandi
              </Tombol>
            )}
            <Tombol ukuran="medium" jenis="ghost" onClick={onTutup} disabled={sibuk}>Batal</Tombol>
            <Tombol ukuran="medium" jenis="primary" onClick={() => void simpan()} disabled={sibuk || (baru && !emailSah)} memuat={sibuk}>
              {baru ? "Buat akun" : "Simpan"}
            </Tombol>
          </>
        )
      }
    >
      {sandi ? (
        <div className="aks__dialogisi">
          <p className="aks__catatan">Serahkan sandi ini ke penggunanya. Ia hanya tampil SEKALI dan tidak disimpan di mana pun; pengguna menggantinya sendiri di halaman Akun.</p>
          <div className="aks__sandi">
            <input ref={sandiRef} readOnly value={sandi} aria-label="Sandi sementara" onFocus={(e) => e.currentTarget.select()} />
            <Tombol ukuran="medium" jenis="secondary" kiri={CopySimple} onClick={() => void salin()}>Salin</Tombol>
          </div>
        </div>
      ) : (
        <div className="aks__dialogisi aks__dialogdua">
          <Isian label="Email" type="email" value={f.email} disabled={!baru} onChange={(e) => setF({ ...f, email: e.currentTarget.value })} bantu={baru && f.email && !emailSah ? "Email tidak sah." : undefined} />
          <Isian label="Nama" value={f.nama} maxLength={80} onChange={(e) => setF({ ...f, nama: e.currentTarget.value })} />
          <div className="k-isian">
            <span className="k-isian__label">Peran</span>
            <PilihMenu label="Peran" opsi={OPSI_PERAN} nilai={f.role} disabled={diri} onUbah={(v) => setF({ ...f, role: v as PeranAkun })} />
            {diri && <p className="k-isian__bantu">Peran akun sendiri tidak bisa diubah.</p>}
          </div>
          {f.role === "pelanggan" ? (
            <div className="k-isian">
              <span className="k-isian__label">Paket langganan</span>
              <PilihMenu label="Paket langganan" opsi={opsiPaket} nilai={f.planId} onUbah={(v) => setF({ ...f, planId: v })} />
            </div>
          ) : (
            <p className="aks__catatan">{f.role === "admin" ? "Owner membuka semua lembar tanpa batas waktu." : "Staf membuka semua lembar kerja, tanpa pengaturan aplikasi."}</p>
          )}
          {f.role === "pelanggan" && (
            <div className="aks__masa">
              <IsianTanggal label="Aktif sampai" nilai={f.until} onUbah={(v) => setF({ ...f, until: v })} bantu={f.until ? undefined : "Kosong = belum bayar."} />
              <div className="aks__pintas" role="group" aria-label="Perpanjang masa aktif">
                <button type="button" onClick={() => setF({ ...f, until: tambahBulan(dasarMasa, 1) })}>+1 bulan</button>
                <button type="button" onClick={() => setF({ ...f, until: tambahBulan(dasarMasa, 12) })}>+1 tahun</button>
              </div>
            </div>
          )}
          {lama && (
            <label className="aks__sakelar aks__lebar">
              <Sakelar judul="Nonaktifkan akun" checked={f.suspended} disabled={diri} onChange={(e) => setF({ ...f, suspended: e.currentTarget.checked })} />
              <span>
                <b>Nonaktifkan akun</b>
                <small>{diri ? "Akun sendiri tidak bisa dinonaktifkan." : "Tidak bisa masuk sama sekali; semua sesinya langsung dicabut."}</small>
              </span>
            </label>
          )}
          {lama && (
            <p className="aks__catatan aks__lebar">
              Dibuat {tglPendek(lama.dibuat)} · {lama.terakhirMasuk ? `terakhir masuk ${tglPendek(lama.terakhirMasuk)}` : "belum pernah masuk"} · {lama.perubahan30} perubahan 30 hari
            </p>
          )}
        </div>
      )}
    </Dialog>
  );
}

/* ---- Kerangka memuat --------------------------------------------------------------------- */

function Rangka() {
  return (
    <div className="aks" aria-hidden="true">
      <div className="aks__papan">
        <header className="aks__kop"><div className="aks__kopjudul"><p>Pengguna & akses</p><h2>Matriks akses</h2></div></header>
        <section className="aks__kertas aks__rangka" />
        <section className="aks__kartu aks__orang aks__rangka" />
        <section className="aks__kartu aks__log aks__rangka" />
      </div>
    </div>
  );
}

export function AksesKit() {
  return (
    <RequireAuth masterOnly skeleton={<Rangka />}>
      <ToastProvider>
        <Isi />
      </ToastProvider>
    </RequireAuth>
  );
}

