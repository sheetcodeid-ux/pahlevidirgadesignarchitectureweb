import { useEffect, useRef, useState } from "react";
import { Icon } from "../ui/Icon";
import { Tabs } from "../ui/misc/Nav";
import { AlertDialog } from "../ui/overlay/Dialog";
import { ToastProvider, useToast } from "../ui/overlay/Toast";
import { RequireAuth } from "./RequireAuth";
import {
  daftarProyek, simpanProyek, mintaUrlUnggah, type Proyek,
  ambilProgress, ubahFaseProgress, buatUlangTokenProgress,
  tambahCatatanProgress, hapusCatatanProgress, type ProjectProgress,
  daftarTim, daftarTugasProyek, tambahTugas, ubahTugas, hapusTugas,
  type AnggotaTim, type Tugas,
  daftarInvoice, tambahInvoice, ubahInvoice, hapusInvoice, type Invoice,
  daftarBiaya, tambahBiaya, hapusBiaya, type BiayaProyek,
  daftarDokumen, tambahDokumen, ubahDokumen, hapusDokumen, type DokumenProyek,
  ambilBrief, ubahBrief, type BriefProyek,
  daftarKomentarDokumen, tambahKomentarDokumen, type KomentarDokumen,
  daftarGambar, tambahGambar, ubahGambar, hapusGambar, type GambarProyek,
} from "../../lib/admin";
import { formatRupiah } from "../../lib/format";

const KATEGORI: Record<string, string> = {
  residential: "Hunian", commercial: "Komersial", interior: "Interior",
  landscape: "Lanskap", masterplan: "Masterplan", renovation: "Renovasi",
};

const FASE: [string, string][] = [
  ["konsultasi", "Konsultasi"],
  ["konsep", "Konsep"],
  ["ded", "DED"],
  ["perizinan", "Perizinan"],
  ["konstruksi", "Konstruksi"],
  ["selesai", "Selesai"],
];

const PIPELINE: [string, string][] = [
  ["proposal", "Proposal"],
  ["deal_kontrak", "Deal & Kontrak"],
  ["dp_50", "DP 50%"],
  ["desain_1", "Desain 1"],
  ["desain_2", "Desain 2"],
  ["finish", "Finish"],
  ["pelunasan", "Pelunasan"],
];

const STATUS_TUGAS: [string, string][] = [
  ["belum_mulai", "Belum mulai"],
  ["berjalan", "Berjalan"],
  ["review_internal", "Review internal"],
  ["menunggu_klien", "Menunggu klien"],
  ["selesai", "Selesai"],
];

const STATUS_INVOICE: [string, string][] = [
  ["draft", "Draf"],
  ["terbit", "Terbit"],
  ["lunas", "Lunas"],
];

const KATEGORI_BIAYA: [string, string][] = [
  ["freelancer", "Freelancer"],
  ["operasional", "Operasional"],
  ["prinsipal", "Prinsipal"],
  ["lainnya", "Lainnya"],
];

const STATUS_DOKUMEN: [string, string][] = [
  ["draft", "Draf"],
  ["menunggu_klien", "Menunggu klien"],
  ["revisi_diminta", "Revisi diminta"],
  ["disetujui", "Disetujui"],
  ["final", "Final"],
];

function PanelKeuangan({ proyek, onUbahKontrak }: { proyek: Proyek; onUbahKontrak: (nilai: number | null) => void }) {
  const toast = useToast();
  const [invoice, setInvoice] = useState<Invoice[] | null>(null);
  const [biaya, setBiaya] = useState<BiayaProyek[] | null>(null);
  const [kontrakInput, setKontrakInput] = useState(String(proyek.contractValue ?? ""));

  const [labelInv, setLabelInv] = useState("");
  const [nominalInv, setNominalInv] = useState("");

  const [labelBiaya, setLabelBiaya] = useState("");
  const [kategoriBiaya, setKategoriBiaya] = useState("lainnya");
  const [nominalBiaya, setNominalBiaya] = useState("");

  function muat() {
    daftarInvoice(proyek.id).then(setInvoice).catch(() => setInvoice([]));
    daftarBiaya(proyek.id).then(setBiaya).catch(() => setBiaya([]));
  }

  useEffect(muat, [proyek.id]);

  async function simpanKontrak() {
    const angka = Number(kontrakInput);
    if (!kontrakInput || Number.isNaN(angka) || angka <= 0) return;
    try {
      await simpanProyek(proyek.id, { contractValue: angka });
      onUbahKontrak(angka);
      toast({ judul: "Nilai kontrak disimpan", nada: "sukses" });
    } catch (e) {
      toast({ judul: "Gagal menyimpan", keterangan: (e as Error).message, nada: "gagal" });
    }
  }

  async function tambahInv() {
    const label = labelInv.trim();
    const nominal = Number(nominalInv);
    if (label.length < 2 || !nominal || nominal <= 0) return;
    try {
      await tambahInvoice(proyek.id, label, nominal, null);
      setLabelInv("");
      setNominalInv("");
      muat();
    } catch (e) {
      toast({ judul: "Gagal menambah invoice", keterangan: (e as Error).message, nada: "gagal" });
    }
  }

  async function ubahStatusInv(id: string, status: string) {
    if (!invoice) return;
    const sebelum = invoice;
    setInvoice(invoice.map((i) => (i.id === id ? { ...i, status } : i)));
    try {
      await ubahInvoice(id, { status });
    } catch (e) {
      setInvoice(sebelum);
      toast({ judul: "Gagal mengubah status", keterangan: (e as Error).message, nada: "gagal" });
    }
  }

  async function hapusInv(id: string) {
    if (!invoice) return;
    try {
      await hapusInvoice(id);
      setInvoice(invoice.filter((i) => i.id !== id));
    } catch (e) {
      toast({ judul: "Gagal menghapus invoice", keterangan: (e as Error).message, nada: "gagal" });
    }
  }

  async function tambahBiayaBaru() {
    const label = labelBiaya.trim();
    const nominal = Number(nominalBiaya);
    if (label.length < 2 || !nominal || nominal <= 0) return;
    try {
      await tambahBiaya(proyek.id, label, kategoriBiaya, nominal);
      setLabelBiaya("");
      setNominalBiaya("");
      muat();
    } catch (e) {
      toast({ judul: "Gagal menambah biaya", keterangan: (e as Error).message, nada: "gagal" });
    }
  }

  async function hapusBiayaItem(id: string) {
    if (!biaya) return;
    try {
      await hapusBiaya(id);
      setBiaya(biaya.filter((b) => b.id !== id));
    } catch (e) {
      toast({ judul: "Gagal menghapus biaya", keterangan: (e as Error).message, nada: "gagal" });
    }
  }

  const totalBiaya = (biaya ?? []).reduce((s, b) => s + b.amount, 0);
  const kontrak = proyek.contractValue ?? 0;
  const marginPct = kontrak > 0 ? ((kontrak - totalBiaya) / kontrak) * 100 : null;

  return (
    <div className="stack" style={{ gap: "var(--space-5)" }}>
      <div className="card">
        <div className="card__header">
          <span className="icon-tile"><Icon name="finance" size={20} /></span>
          <span className="card__titles">
            <span className="t-subheading">Nilai kontrak</span>
            {marginPct !== null && <span className="t-muted">Margin saat ini: {marginPct.toFixed(0)}%</span>}
          </span>
        </div>
        <div className="card__body">
          <div className="row" style={{ gap: "var(--space-2)" }}>
            <input className="input" type="number" value={kontrakInput}
              onChange={(e) => setKontrakInput(e.target.value)} placeholder="Contoh: 68000000" style={{ flex: 1 }} />
            <button type="button" className="btn btn--secondary" onClick={simpanKontrak}>Simpan</button>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card__header">
          <span className="card__titles">
            <span className="t-subheading">Invoice</span>
            <span className="t-muted">DP, pelunasan, atau tagihan lain untuk proyek ini.</span>
          </span>
        </div>
        <div className="card__body">
          <div className="stack">
            <div className="spec-grid">
              <div className="field">
                <label className="field__label" htmlFor="inv-label">Label</label>
                <input id="inv-label" className="input" value={labelInv} onChange={(e) => setLabelInv(e.target.value)}
                  placeholder="Contoh: DP 50%" />
              </div>
              <div className="field">
                <label className="field__label" htmlFor="inv-nominal">Nominal (Rp)</label>
                <input id="inv-nominal" className="input" type="number" value={nominalInv}
                  onChange={(e) => setNominalInv(e.target.value)} />
              </div>
            </div>
            <div className="row row--end">
              <button type="button" className="btn btn--secondary btn--sm" onClick={tambahInv}>
                <Icon name="plus" size={14} />Tambah invoice
              </button>
            </div>

            {invoice && invoice.length > 0 && (
              <ul className="stack" style={{ gap: "var(--space-2)", listStyle: "none", padding: 0, marginTop: "var(--space-3)" }}>
                {invoice.map((i) => (
                  <li key={i.id} className="item item--bordered">
                    <span className="item__text">
                      <span className="item__title">{i.label}</span>
                      <span className="item__desc">{formatRupiah(i.amount)}</span>
                    </span>
                    <select className="input" style={{ width: "auto", fontSize: "var(--text-sm)" }}
                      value={i.status} onChange={(e) => ubahStatusInv(i.id, e.target.value)}
                      aria-label={`Ubah status ${i.label}`}>
                      {STATUS_INVOICE.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                    <AlertDialog
                      destructive
                      title={`Hapus ${i.label}?`}
                      description="Riwayat tagihan ini akan dihapus permanen."
                      confirmLabel="Ya, hapus"
                      onConfirm={() => hapusInv(i.id)}
                      trigger={
                        <button type="button" className="btn btn--ghost btn--icon" aria-label={`Hapus ${i.label}`}>
                          <Icon name="trash" size={15} />
                        </button>
                      }
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card__header">
          <span className="card__titles">
            <span className="t-subheading">Biaya (HPP)</span>
            <span className="t-muted">Fee freelancer, operasional, dan bagian prinsipal. Total: {formatRupiah(totalBiaya)}</span>
          </span>
        </div>
        <div className="card__body">
          <div className="stack">
            <div className="spec-grid">
              <div className="field">
                <label className="field__label" htmlFor="biaya-label">Label</label>
                <input id="biaya-label" className="input" value={labelBiaya} onChange={(e) => setLabelBiaya(e.target.value)}
                  placeholder="Contoh: Fee Rian — DED" />
              </div>
              <div className="field">
                <label className="field__label" htmlFor="biaya-kategori">Kategori</label>
                <select id="biaya-kategori" className="input" value={kategoriBiaya}
                  onChange={(e) => setKategoriBiaya(e.target.value)}>
                  {KATEGORI_BIAYA.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div className="field">
                <label className="field__label" htmlFor="biaya-nominal">Nominal (Rp)</label>
                <input id="biaya-nominal" className="input" type="number" value={nominalBiaya}
                  onChange={(e) => setNominalBiaya(e.target.value)} />
              </div>
            </div>
            <div className="row row--end">
              <button type="button" className="btn btn--secondary btn--sm" onClick={tambahBiayaBaru}>
                <Icon name="plus" size={14} />Tambah biaya
              </button>
            </div>

            {biaya && biaya.length > 0 && (
              <ul className="stack" style={{ gap: "var(--space-2)", listStyle: "none", padding: 0, marginTop: "var(--space-3)" }}>
                {biaya.map((b) => (
                  <li key={b.id} className="item item--bordered">
                    <span className="item__text">
                      <span className="item__title">{b.label}</span>
                      <span className="item__desc">{KATEGORI_BIAYA.find(([v]) => v === b.category)?.[1] ?? b.category} · {formatRupiah(b.amount)}</span>
                    </span>
                    <AlertDialog
                      destructive
                      title={`Hapus ${b.label}?`}
                      description="Biaya ini akan dihapus dari perhitungan margin proyek."
                      confirmLabel="Ya, hapus"
                      onConfirm={() => hapusBiayaItem(b.id)}
                      trigger={
                        <button type="button" className="btn btn--ghost btn--icon" aria-label={`Hapus ${b.label}`}>
                          <Icon name="trash" size={15} />
                        </button>
                      }
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ThreadKomentar({ documentId }: { documentId: string }) {
  const toast = useToast();
  const [komentar, setKomentar] = useState<KomentarDokumen[] | null>(null);
  const [isi, setIsi] = useState("");
  const [mengirim, setMengirim] = useState(false);

  function muat() {
    daftarKomentarDokumen(documentId).then(setKomentar).catch(() => setKomentar([]));
  }

  async function kirim() {
    const bersih = isi.trim();
    if (bersih.length < 1) return;
    setMengirim(true);
    try {
      await tambahKomentarDokumen(documentId, bersih);
      setIsi("");
      muat();
    } catch (e) {
      toast({ judul: "Gagal mengirim komentar", keterangan: (e as Error).message, nada: "gagal" });
    } finally {
      setMengirim(false);
    }
  }

  return (
    <details className="collapsible" onToggle={(e) => {
      if ((e.target as HTMLDetailsElement).open && komentar === null) muat();
    }}>
      <summary>Komentar<span className="collapsible__chevron"><Icon name="chevronDown" size={16} /></span></summary>
      <div className="collapsible__body stack" style={{ gap: "var(--space-3)" }}>
        {komentar === null ? (
          <span className="skeleton" style={{ height: "3rem" }} />
        ) : komentar.length === 0 ? (
          <p className="t-muted">Belum ada komentar.</p>
        ) : (
          <ul className="stack" style={{ gap: "var(--space-2)", listStyle: "none", padding: 0 }}>
            {komentar.map((k) => (
              <li key={k.id}>
                <span className="t-label">{k.author === "staf" ? "Staf" : "Klien"}</span>
                <span className="t-muted t-mono" style={{ fontSize: "var(--text-xs)" }}>
                  {" · "}{new Date(k.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
                </span>
                <p>{k.body}</p>
              </li>
            ))}
          </ul>
        )}
        <div className="row" style={{ gap: "var(--space-2)" }}>
          <input className="input" value={isi} onChange={(e) => setIsi(e.target.value)}
            placeholder="Tulis balasan..." style={{ flex: 1 }} />
          <button type="button" className="btn btn--secondary btn--sm" disabled={isi.trim().length < 1 || mengirim} onClick={kirim}>
            Kirim
          </button>
        </div>
      </div>
    </details>
  );
}

function PanelDokumen({ proyek }: { proyek: Proyek }) {
  const toast = useToast();
  const [dokumen, setDokumen] = useState<DokumenProyek[] | null>(null);
  const [judulBaru, setJudulBaru] = useState("");
  const [mengunggah, setMengunggah] = useState(false);
  const berkas = useRef<HTMLInputElement>(null);

  function muat() {
    daftarDokumen(proyek.id).then(setDokumen).catch(() => setDokumen([]));
  }

  useEffect(muat, [proyek.id]);

  async function unggahDanTambah(f: File) {
    const judul = judulBaru.trim();
    if (judul.length < 2) {
      toast({ judul: "Isi judul dokumen dulu", nada: "netral" });
      return;
    }
    setMengunggah(true);
    try {
      const target = await mintaUrlUnggah(proyek.slug, f.type);
      const res = await fetch(target.uploadUrl, { method: "PUT", headers: { "Content-Type": f.type }, body: f });
      if (!res.ok) throw new Error(`Penyimpanan menolak berkas (${res.status})`);

      await tambahDokumen(proyek.id, judul, target.key);
      setJudulBaru("");
      muat();
      toast({ judul: "Dokumen diunggah", nada: "sukses" });
    } catch (e) {
      toast({ judul: "Gagal mengunggah dokumen", keterangan: (e as Error).message, nada: "gagal" });
    } finally {
      setMengunggah(false);
    }
  }

  async function ubahStatus(id: string, status: string) {
    if (!dokumen) return;
    const sebelum = dokumen;
    setDokumen(dokumen.map((d) => (d.id === id ? { ...d, status } : d)));
    try {
      await ubahDokumen(id, { status });
    } catch (e) {
      setDokumen(sebelum);
      toast({ judul: "Gagal mengubah status", keterangan: (e as Error).message, nada: "gagal" });
    }
  }

  async function hapus(id: string) {
    if (!dokumen) return;
    try {
      await hapusDokumen(id);
      setDokumen(dokumen.filter((d) => d.id !== id));
    } catch (e) {
      toast({ judul: "Gagal menghapus dokumen", keterangan: (e as Error).message, nada: "gagal" });
    }
  }

  if (!dokumen) {
    return <span className="skeleton" style={{ height: "6rem" }} />;
  }

  return (
    <div className="stack" style={{ gap: "var(--space-5)" }}>
      <div className="card">
        <div className="card__header">
          <span className="icon-tile"><Icon name="document" size={20} /></span>
          <span className="card__titles">
            <span className="t-subheading">Unggah dokumen</span>
            <span className="t-muted">PDF gambar kerja, RAB, atau dokumen lain untuk dilihat klien.</span>
          </span>
        </div>
        <div className="card__body">
          <div className="stack">
            <div className="field">
              <label className="field__label" htmlFor="dok-judul">Judul dokumen</label>
              <input id="dok-judul" className="input" value={judulBaru}
                onChange={(e) => setJudulBaru(e.target.value)} placeholder="Contoh: DED Rev.2" />
            </div>
            <input ref={berkas} type="file" className="sr-only" accept="application/pdf"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) unggahDanTambah(f); }} />
            <div className="row row--end">
              <button type="button" className="btn btn--secondary" disabled={judulBaru.trim().length < 2 || mengunggah}
                onClick={() => berkas.current?.click()}>
                {mengunggah && <span className="spinner spinner--sm spinner--on-action" />}
                <Icon name="upload" size={15} />Pilih berkas PDF
              </button>
            </div>
          </div>
        </div>
      </div>

      {dokumen.length === 0 ? (
        <p className="t-muted">Belum ada dokumen untuk proyek ini.</p>
      ) : (
        <ul className="stack" style={{ gap: "var(--space-3)", listStyle: "none", padding: 0 }}>
          {dokumen.map((d) => (
            <li key={d.id} className="stack" style={{ gap: "var(--space-2)" }}>
              <div className="item item--bordered">
                <span className="item__text">
                  <span className="item__title">{d.title}</span>
                  <span className="item__desc">
                    <a href={d.fileUrl} target="_blank" rel="noreferrer">Lihat berkas</a>
                    {d.status === "revisi_diminta" && d.clientNote && ` — Catatan klien: ${d.clientNote}`}
                  </span>
                </span>
                <select className="input" style={{ width: "auto", fontSize: "var(--text-sm)" }}
                  value={d.status} onChange={(e) => ubahStatus(d.id, e.target.value)}
                  aria-label={`Ubah status ${d.title}`}>
                  {STATUS_DOKUMEN.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
                <AlertDialog
                  destructive
                  title={`Hapus ${d.title}?`}
                  description="Dokumen ini akan hilang dari portal klien beserta seluruh komentarnya."
                  confirmLabel="Ya, hapus"
                  onConfirm={() => hapus(d.id)}
                  trigger={
                    <button type="button" className="btn btn--ghost btn--icon" aria-label={`Hapus ${d.title}`}>
                      <Icon name="trash" size={15} />
                    </button>
                  }
                />
              </div>
              <ThreadKomentar documentId={d.id} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Galeri proyek — foto yang tampil di halaman publik.
 *
 * Sebelumnya tab ini hanya mengurus satu gambar cover, jadi tidak ada cara
 * sama sekali mengunggah foto galeri lewat panel admin walaupun endpoint dan
 * tabelnya sudah lama ada. Ini yang menutup celah itu.
 *
 * Urutan diatur dengan tombol naik/turun, bukan seret-lepas: seret-lepas butuh
 * pustaka tambahan dan perilaku sentuh yang harus dirawat sendiri, sementara
 * satu proyek jarang lebih dari sepuluh foto.
 */
function PanelGaleri({ proyek, onJadikanCover }: { proyek: Proyek; onJadikanCover: (key: string) => void }) {
  const toast = useToast();
  const [gambar, setGambar] = useState<GambarProyek[] | null>(null);
  const [mengunggah, setMengunggah] = useState(0);
  const [dragging, setDragging] = useState(false);
  const berkas = useRef<HTMLInputElement>(null);

  function muat() {
    daftarGambar(proyek.id).then(setGambar).catch(() => setGambar([]));
  }

  useEffect(muat, [proyek.id]);

  async function unggahSatu(f: File, urutan: number) {
    const target = await mintaUrlUnggah(proyek.slug, f.type);
    const res = await fetch(target.uploadUrl, { method: "PUT", headers: { "Content-Type": f.type }, body: f });
    if (!res.ok) throw new Error(`Penyimpanan menolak ${f.name} (${res.status})`);
    await tambahGambar(proyek.id, target.key, urutan);
  }

  async function unggahBanyak(files: FileList | File[]) {
    const daftar = [...files].filter((f) => f.type.startsWith("image/"));
    if (daftar.length === 0) return;

    setMengunggah(daftar.length);
    // Berurutan, bukan Promise.all: unggahan paralel dari satu koneksi rumah
    // justru saling memperlambat, dan urutannya jadi tidak bisa dipastikan.
    let mulai = (gambar?.length ?? 0);
    let gagal = 0;
    for (const f of daftar) {
      try {
        await unggahSatu(f, mulai);
        mulai += 1;
      } catch (e) {
        gagal += 1;
        toast({ judul: "Gagal mengunggah", keterangan: (e as Error).message, nada: "gagal" });
      } finally {
        setMengunggah((n) => n - 1);
      }
    }
    muat();
    const berhasil = daftar.length - gagal;
    if (berhasil > 0) toast({ judul: `${berhasil} foto terunggah`, nada: "sukses" });
  }

  async function simpanKeterangan(g: GambarProyek, caption: string) {
    if ((g.caption ?? "") === caption) return;
    try {
      await ubahGambar(g.id, { caption: caption || null });
      setGambar((a) => a?.map((x) => (x.id === g.id ? { ...x, caption } : x)) ?? a);
    } catch (e) {
      toast({ judul: "Gagal menyimpan keterangan", keterangan: (e as Error).message, nada: "gagal" });
    }
  }

  /** Menukar posisi satu gambar dengan tetangganya, lalu menulis dua urutan. */
  async function geser(i: number, arah: -1 | 1) {
    if (!gambar) return;
    const j = i + arah;
    if (j < 0 || j >= gambar.length) return;

    const baru = gambar.slice();
    [baru[i], baru[j]] = [baru[j], baru[i]];
    const berurut = baru.map((g, k) => ({ ...g, sortOrder: k }));
    setGambar(berurut);
    try {
      await Promise.all([
        ubahGambar(berurut[i].id, { sortOrder: i }),
        ubahGambar(berurut[j].id, { sortOrder: j }),
      ]);
    } catch (e) {
      setGambar(gambar);
      toast({ judul: "Gagal mengubah urutan", keterangan: (e as Error).message, nada: "gagal" });
    }
  }

  async function hapus(g: GambarProyek) {
    if (!gambar) return;
    const sebelum = gambar;
    setGambar(gambar.filter((x) => x.id !== g.id));
    try {
      await hapusGambar(g.id);
    } catch (e) {
      setGambar(sebelum);
      toast({ judul: "Gagal menghapus", keterangan: (e as Error).message, nada: "gagal" });
    }
  }

  if (!gambar) return <span className="skeleton" style={{ height: "10rem" }} />;

  return (
    <div className="stack" style={{ gap: "var(--space-5)" }}>
      <div
        className="dropzone"
        data-dragging={dragging || undefined}
        role="button"
        tabIndex={0}
        aria-label="Unggah foto galeri"
        onClick={() => berkas.current?.click()}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); berkas.current?.click(); } }}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); unggahBanyak(e.dataTransfer.files); }}
      >
        <span className="icon-tile">
          {mengunggah > 0 ? <span className="spinner spinner--sm" /> : <Icon name="image" size={20} />}
        </span>
        <span className="t-subheading">
          {mengunggah > 0 ? `Mengunggah ${mengunggah} foto…` : "Tarik foto ke sini, atau klik untuk memilih"}
        </span>
        <span className="t-muted">Bisa banyak sekaligus. JPG, PNG, WEBP, atau AVIF.</span>
      </div>

      <input
        ref={berkas}
        type="file"
        multiple
        className="sr-only"
        accept="image/jpeg,image/png,image/webp,image/avif"
        onChange={(e) => { if (e.target.files) unggahBanyak(e.target.files); e.target.value = ""; }}
      />

      {gambar.length === 0 ? (
        <div className="empty">
          <span className="icon-tile"><Icon name="image" size={20} /></span>
          <span className="t-subheading">Belum ada foto galeri</span>
          <p className="t-muted">Halaman proyek publik hanya menampilkan seksi galeri kalau ada isinya.</p>
        </div>
      ) : (
        <ul className="galeri-grid">
          {gambar.map((g, i) => (
            <li className="galeri-item" key={g.id}>
              <div className="aspect aspect--4-3">
                <img src={g.url} alt={g.altText ?? ""} loading="lazy" />
              </div>

              <div className="galeri-item__body">
                <label className="sr-only" htmlFor={`cap-${g.id}`}>Keterangan foto {i + 1}</label>
                <input
                  id={`cap-${g.id}`}
                  className="input"
                  defaultValue={g.caption ?? ""}
                  placeholder="Keterangan (opsional)"
                  onBlur={(e) => simpanKeterangan(g, e.target.value.trim())}
                />
              </div>

              <div className="galeri-item__foot">
                <span className="galeri-item__nav">
                  <button type="button" className="btn btn--ghost btn--icon btn--boxed"
                    aria-label={`Majukan foto ${i + 1}`} disabled={i === 0} onClick={() => geser(i, -1)}>
                    <Icon name="chevronLeft" size={15} />
                  </button>
                  <button type="button" className="btn btn--ghost btn--icon btn--boxed"
                    aria-label={`Mundurkan foto ${i + 1}`} disabled={i === gambar.length - 1} onClick={() => geser(i, 1)}>
                    <Icon name="chevronRight" size={15} />
                  </button>
                  <AlertDialog
                    destructive
                    title="Hapus foto ini?"
                    description="Foto hilang dari halaman proyek publik dan tidak bisa dikembalikan."
                    confirmLabel="Ya, hapus"
                    onConfirm={() => hapus(g)}
                    trigger={
                      <button type="button" className="btn btn--ghost btn--icon btn--boxed" aria-label={`Hapus foto ${i + 1}`}>
                        <Icon name="trash" size={15} />
                      </button>
                    }
                  />
                </span>
                <button type="button" className="btn btn--ghost btn--sm"
                  onClick={() => { onJadikanCover(g.storageKey); toast({ judul: "Dipakai sebagai cover", keterangan: "Tekan Simpan untuk menerapkannya.", nada: "sukses" }); }}>
                  <Icon name="star" size={14} />Jadikan cover
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PanelBrief({ projectId }: { projectId: string }) {
  const toast = useToast();
  const [brief, setBrief] = useState<BriefProyek | null>(null);
  const [sibuk, setSibuk] = useState(false);

  useEffect(() => {
    ambilBrief(projectId).then(setBrief).catch(() => setBrief(null));
  }, [projectId]);

  function set<K extends keyof BriefProyek>(kunci: K, nilai: BriefProyek[K]) {
    setBrief((b) => (b ? { ...b, [kunci]: nilai } : b));
  }

  async function simpan() {
    if (!brief) return;
    setSibuk(true);
    try {
      await ubahBrief(projectId, {
        budgetRange: brief.budgetRange,
        timeline: brief.timeline,
        stylePreference: brief.stylePreference,
        requirements: brief.requirements,
        internalNotes: brief.internalNotes,
      });
      toast({ judul: "Brief disimpan", nada: "sukses" });
    } catch (e) {
      toast({ judul: "Gagal menyimpan", keterangan: (e as Error).message, nada: "gagal" });
    } finally {
      setSibuk(false);
    }
  }

  if (!brief) {
    return <span className="skeleton" style={{ height: "10rem" }} />;
  }

  return (
    <div className="stack" style={{ gap: "var(--space-5)" }}>
      <div className="card">
        <div className="card__header">
          <span className="icon-tile"><Icon name="edit" size={20} /></span>
          <span className="card__titles">
            <span className="t-subheading">Kebutuhan awal klien</span>
            <span className="t-muted">
              {brief.submittedAt
                ? `Terakhir dikirim klien ${new Date(brief.submittedAt).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}`
                : "Klien belum mengisi brief lewat link progres — staf bisa mengisikannya di sini."}
            </span>
          </span>
        </div>
        <div className="card__body">
          <div className="stack">
            <div className="spec-grid">
              <div className="field">
                <label className="field__label" htmlFor="brief-budget">Kisaran anggaran</label>
                <input id="brief-budget" className="input" value={brief.budgetRange ?? ""}
                  onChange={(e) => set("budgetRange", e.target.value)} placeholder="Contoh: 300-500jt" />
              </div>
              <div className="field">
                <label className="field__label" htmlFor="brief-waktu">Target waktu</label>
                <input id="brief-waktu" className="input" value={brief.timeline ?? ""}
                  onChange={(e) => set("timeline", e.target.value)} placeholder="Contoh: mulai konstruksi Q1 2027" />
              </div>
              <div className="field">
                <label className="field__label" htmlFor="brief-gaya">Preferensi gaya</label>
                <input id="brief-gaya" className="input" value={brief.stylePreference ?? ""}
                  onChange={(e) => set("stylePreference", e.target.value)} placeholder="Contoh: tropis modern" />
              </div>
            </div>
            <div className="field">
              <label className="field__label" htmlFor="brief-kebutuhan">Kebutuhan ruang/fungsi</label>
              <textarea id="brief-kebutuhan" className="input input--area" value={brief.requirements ?? ""}
                onChange={(e) => set("requirements", e.target.value)} placeholder="Contoh: 3 kamar tidur, ruang kerja, carport 2 mobil" />
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card__header">
          <span className="card__titles">
            <span className="t-subheading">Catatan internal</span>
            <span className="t-muted">Hanya terlihat staf — tidak pernah dikirim ke klien.</span>
          </span>
        </div>
        <div className="card__body">
          <textarea className="input input--area" value={brief.internalNotes ?? ""}
            onChange={(e) => set("internalNotes", e.target.value)}
            placeholder="Contoh: sudah ditelepon, minta contoh referensi tambahan" />
        </div>
      </div>

      <div className="row row--end">
        <button type="button" className="btn btn--primary" disabled={sibuk} onClick={simpan}>
          {sibuk && <span className="spinner spinner--sm spinner--on-action" />}
          Simpan brief
        </button>
      </div>
    </div>
  );
}

function PanelTugas({ projectId }: { projectId: string }) {
  const toast = useToast();
  const [tugas, setTugas] = useState<Tugas[] | null>(null);
  const [tim, setTim] = useState<AnggotaTim[]>([]);
  const [judulBaru, setJudulBaru] = useState("");
  const [penanggungJawab, setPenanggungJawab] = useState("");
  const [sibuk, setSibuk] = useState(false);

  function muat() {
    daftarTugasProyek(projectId).then(setTugas).catch(() => setTugas([]));
  }

  useEffect(() => {
    muat();
    daftarTim().then(setTim).catch(() => setTim([]));
  }, [projectId]);

  async function tambah() {
    const judul = judulBaru.trim();
    if (judul.length < 2) return;
    setSibuk(true);
    try {
      await tambahTugas(projectId, { title: judul, assigneeId: penanggungJawab || null });
      setJudulBaru("");
      setPenanggungJawab("");
      muat();
      toast({ judul: "Tugas ditambahkan", nada: "sukses" });
    } catch (e) {
      toast({ judul: "Gagal menambah tugas", keterangan: (e as Error).message, nada: "gagal" });
    } finally {
      setSibuk(false);
    }
  }

  async function ubahStatusTugas(id: string, status: string) {
    if (!tugas) return;
    const sebelum = tugas;
    setTugas(tugas.map((t) => (t.id === id ? { ...t, status } : t)));
    try {
      await ubahTugas(id, { status });
    } catch (e) {
      setTugas(sebelum);
      toast({ judul: "Gagal mengubah status", keterangan: (e as Error).message, nada: "gagal" });
    }
  }

  async function hapus(id: string) {
    if (!tugas) return;
    try {
      await hapusTugas(id);
      setTugas(tugas.filter((t) => t.id !== id));
    } catch (e) {
      toast({ judul: "Gagal menghapus tugas", keterangan: (e as Error).message, nada: "gagal" });
    }
  }

  if (!tugas) {
    return <span className="skeleton" style={{ height: "6rem" }} />;
  }

  return (
    <div className="stack" style={{ gap: "var(--space-5)" }}>
      <div className="card">
        <div className="card__body">
          <div className="spec-grid">
            <div className="field">
              <label className="field__label" htmlFor="tug-judul">Tugas baru</label>
              <input id="tug-judul" className="input" value={judulBaru}
                onChange={(e) => setJudulBaru(e.target.value)} placeholder="Contoh: Gambar kerja denah" />
            </div>
            <div className="field">
              <label className="field__label" htmlFor="tug-pic">Penanggung jawab</label>
              <select id="tug-pic" className="input" value={penanggungJawab}
                onChange={(e) => setPenanggungJawab(e.target.value)}>
                <option value="">Belum ditentukan</option>
                {tim.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          </div>
          <div className="row row--end" style={{ marginTop: "var(--space-4)" }}>
            <button type="button" className="btn btn--primary" disabled={judulBaru.trim().length < 2 || sibuk} onClick={tambah}>
              <Icon name="plus" size={15} />Tambah tugas
            </button>
          </div>
        </div>
      </div>

      {tugas.length === 0 ? (
        <p className="t-muted">Belum ada tugas untuk proyek ini.</p>
      ) : (
        <ul className="stack" style={{ gap: "var(--space-2)", listStyle: "none", padding: 0 }}>
          {tugas.map((t) => (
            <li key={t.id} className="item item--bordered">
              <span className="item__text">
                <span className="item__title">{t.title}</span>
                <span className="item__desc">{t.assigneeName ?? "Belum ditentukan"}</span>
              </span>
              <select className="input" style={{ width: "auto", fontSize: "var(--text-sm)" }}
                value={t.status} onChange={(e) => ubahStatusTugas(t.id, e.target.value)}
                aria-label={`Ubah status ${t.title}`}>
                {STATUS_TUGAS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <AlertDialog
                destructive
                title={`Hapus ${t.title}?`}
                description="Tugas ini akan dihapus dari daftar list kerjaan."
                confirmLabel="Ya, hapus"
                onConfirm={() => hapus(t.id)}
                trigger={
                  <button type="button" className="btn btn--ghost btn--icon" aria-label={`Hapus ${t.title}`}>
                    <Icon name="trash" size={15} />
                  </button>
                }
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PanelProgres({ projectId }: { projectId: string }) {
  const toast = useToast();
  const [progres, setProgres] = useState<ProjectProgress | null>(null);
  const [judulBaru, setJudulBaru] = useState("");
  const [catatanBaru, setCatatanBaru] = useState("");
  const [sibuk, setSibuk] = useState(false);

  useEffect(() => {
    ambilProgress(projectId).then(setProgres).catch(() => setProgres(null));
  }, [projectId]);

  const linkKlien = progres
    ? `${import.meta.env.PUBLIC_SITE_URL ?? ""}/progres?t=${progres.accessToken}`
    : "";

  async function ubahFase(fase: string) {
    if (!progres) return;
    const sebelum = progres.phase;
    setProgres({ ...progres, phase: fase });
    try {
      await ubahFaseProgress(projectId, fase);
    } catch (e) {
      setProgres({ ...progres, phase: sebelum });
      toast({ judul: "Gagal mengubah fase", keterangan: (e as Error).message, nada: "gagal" });
    }
  }

  async function salinLink() {
    try {
      await navigator.clipboard.writeText(linkKlien);
      toast({ judul: "Link disalin", nada: "sukses" });
    } catch {
      toast({ judul: "Tidak bisa menyalin otomatis", keterangan: linkKlien, nada: "netral" });
    }
  }

  async function buatUlangLink() {
    if (!progres) return;
    setSibuk(true);
    try {
      const { accessToken } = await buatUlangTokenProgress(projectId);
      setProgres({ ...progres, accessToken });
      toast({ judul: "Link baru dibuat", keterangan: "Link lama tidak berlaku lagi.", nada: "sukses" });
    } catch (e) {
      toast({ judul: "Gagal membuat link baru", keterangan: (e as Error).message, nada: "gagal" });
    } finally {
      setSibuk(false);
    }
  }

  async function tambahCatatan() {
    const judul = judulBaru.trim();
    if (judul.length < 2 || !progres) return;
    setSibuk(true);
    try {
      await tambahCatatanProgress(projectId, judul, catatanBaru.trim() || null);
      setJudulBaru("");
      setCatatanBaru("");
      const ulang = await ambilProgress(projectId);
      setProgres(ulang);
      toast({ judul: "Catatan ditambahkan", nada: "sukses" });
    } catch (e) {
      toast({ judul: "Gagal menambah catatan", keterangan: (e as Error).message, nada: "gagal" });
    } finally {
      setSibuk(false);
    }
  }

  async function hapusCatatan(id: string) {
    if (!progres) return;
    try {
      await hapusCatatanProgress(id);
      setProgres({ ...progres, updates: progres.updates.filter((u) => u.id !== id) });
    } catch (e) {
      toast({ judul: "Gagal menghapus catatan", keterangan: (e as Error).message, nada: "gagal" });
    }
  }

  if (!progres) {
    return <span className="skeleton" style={{ height: "6rem" }} />;
  }

  return (
    <div className="stack" style={{ gap: "var(--space-5)" }}>
      <div className="card">
        <div className="card__header">
          <span className="icon-tile"><Icon name="calendar" size={20} /></span>
          <span className="card__titles">
            <span className="t-subheading">Fase proyek</span>
            <span className="t-muted">Ditampilkan ke klien lewat link progres.</span>
          </span>
        </div>
        <div className="card__body">
          <div className="segmented" role="group" aria-label="Fase proyek">
            {FASE.map(([nilai, label]) => (
              <button
                key={nilai}
                type="button"
                className="segmented__opt"
                aria-pressed={progres.phase === nilai}
                onClick={() => ubahFase(nilai)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card__header">
          <span className="icon-tile"><Icon name="external" size={20} /></span>
          <span className="card__titles">
            <span className="t-subheading">Link untuk klien</span>
            <span className="t-muted">Tanpa login — bagikan lewat WhatsApp atau email.</span>
          </span>
        </div>
        <div className="card__body">
          <div className="stack">
            <div className="row" style={{ gap: "var(--space-2)" }}>
              <input className="input input--mono" readOnly value={linkKlien} style={{ flex: 1 }} />
              <button type="button" className="btn btn--secondary btn--icon" aria-label="Salin link" onClick={salinLink}>
                <Icon name="copy" size={16} />
              </button>
            </div>
            <div className="row row--end">
              <button type="button" className="btn btn--ghost btn--sm" disabled={sibuk} onClick={buatUlangLink}>
                Buat ulang link
              </button>
            </div>
            <p className="field__help">
              Membuat ulang link membuat link lama berhenti berfungsi — pakai kalau link lama terlanjur tersebar ke pihak yang salah.
            </p>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card__header">
          <span className="icon-tile"><Icon name="edit" size={20} /></span>
          <span className="card__titles">
            <span className="t-subheading">Linimasa</span>
            <span className="t-muted">Catatan singkat yang dilihat klien, terbaru di atas.</span>
          </span>
        </div>
        <div className="card__body">
          <div className="stack">
            <div className="field">
              <label className="field__label" htmlFor="prog-judul">Judul catatan</label>
              <input id="prog-judul" className="input" value={judulBaru}
                onChange={(e) => setJudulBaru(e.target.value)} placeholder="Contoh: Fondasi selesai" />
            </div>
            <div className="field">
              <label className="field__label" htmlFor="prog-catatan">Catatan (opsional)</label>
              <textarea id="prog-catatan" className="input input--area" value={catatanBaru}
                onChange={(e) => setCatatanBaru(e.target.value)} />
            </div>
            <div className="row row--end">
              <button type="button" className="btn btn--primary" disabled={judulBaru.trim().length < 2 || sibuk}
                onClick={tambahCatatan}>
                Tambah ke linimasa
              </button>
            </div>
          </div>
        </div>
      </div>

      {progres.updates.length > 0 && (
        <ol className="stack" style={{ gap: "var(--space-3)", listStyle: "none", padding: 0 }}>
          {progres.updates.map((u) => (
            <li key={u.id} className="card">
              <div className="card__body row row--between" style={{ alignItems: "flex-start" }}>
                <span className="stack" style={{ gap: "var(--space-1)" }}>
                  <span className="t-subheading">{u.title}</span>
                  {u.note && <span className="t-muted">{u.note}</span>}
                  <span className="t-mono t-muted" style={{ fontSize: "var(--text-xs)" }}>
                    {new Date(u.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
                  </span>
                </span>
                <AlertDialog
                  destructive
                  title={`Hapus "${u.title}"?`}
                  description="Catatan ini akan hilang dari linimasa yang dilihat klien."
                  confirmLabel="Ya, hapus"
                  onConfirm={() => hapusCatatan(u.id)}
                  trigger={
                    <button type="button" className="btn btn--ghost btn--icon" aria-label={`Hapus catatan ${u.title}`}>
                      <Icon name="trash" size={15} />
                    </button>
                  }
                />
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

type Draf = Partial<Proyek>;

function Isi() {
  const toast = useToast();
  const [asli, setAsli] = useState<Proyek | null>(null);
  const [draf, setDraf] = useState<Draf>({});
  const [galat, setGalat] = useState<string | null>(null);
  const [menyimpan, setMenyimpan] = useState(false);
  const berkas = useRef<HTMLInputElement>(null);

  const id = typeof window !== "undefined" ? new URLSearchParams(location.search).get("id") : null;

  useEffect(() => {
    if (!id) { setGalat("Tidak ada proyek yang dipilih."); return; }
    daftarProyek()
      .then((semua) => {
        const p = semua.find((x) => x.id === id);
        if (!p) { setGalat("Proyek tidak ditemukan."); return; }
        setAsli(p);
      })
      .catch((e) => setGalat((e as Error).message));
  }, [id]);

  // Hanya field yang benar-benar berubah yang dikirim. Selain lebih hemat, ini
  // menghindarkan dua orang yang menyunting bersamaan saling menimpa kolom
  // yang tidak mereka sentuh.
  const berubah = Object.keys(draf).filter((k) => draf[k as keyof Draf] !== asli?.[k as keyof Proyek]);
  const adaPerubahan = berubah.length > 0;

  function set<K extends keyof Proyek>(kunci: K, nilai: Proyek[K]) {
    setDraf((d) => ({ ...d, [kunci]: nilai }));
  }

  const nilai = <K extends keyof Proyek>(kunci: K): Proyek[K] | undefined =>
    (kunci in draf ? draf[kunci] : asli?.[kunci]) as Proyek[K] | undefined;

  async function simpan() {
    if (!asli || !adaPerubahan) return;
    setMenyimpan(true);
    try {
      const patch: Record<string, unknown> = {};
      berubah.forEach((k) => { patch[k] = draf[k as keyof Draf]; });
      await simpanProyek(asli.id, patch);
      setAsli({ ...asli, ...draf } as Proyek);
      setDraf({});
      toast({ judul: "Perubahan disimpan", nada: "sukses" });
    } catch (e) {
      toast({ judul: "Gagal menyimpan", keterangan: (e as Error).message, nada: "gagal" });
    } finally {
      setMenyimpan(false);
    }
  }

  async function unggah(f: File) {
    if (!asli) return;
    try {
      const target = await mintaUrlUnggah(asli.slug, f.type);
      const res = await fetch(target.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": f.type },
        body: f,
      });
      if (!res.ok) throw new Error(`Penyimpanan menolak berkas (${res.status})`);

      set("coverImageKey" as keyof Proyek, target.key as never);
      toast({ judul: "Gambar terunggah", keterangan: "Tekan Simpan untuk menerapkannya.", nada: "sukses" });
    } catch (e) {
      toast({
        judul: "Gagal mengunggah",
        keterangan: `${(e as Error).message}. Penyimpanan R2 mungkin belum dikonfigurasi.`,
        nada: "gagal",
      });
    }
  }

  if (galat) {
    return (
      <div className="empty">
        <span className="icon-tile"><Icon name="alert" size={20} /></span>
        <span className="t-subheading">{galat}</span>
        <a className="btn btn--secondary" href="/admin/proyek">Kembali ke daftar</a>
      </div>
    );
  }

  if (!asli) {
    return <div className="stack">{[0, 1].map((i) => <span key={i} className="skeleton" style={{ height: "8rem" }} />)}</div>;
  }

  const detail = (
    <div className="stack">
      <div className="field">
        <label className="field__label" htmlFor="ed-judul">Judul</label>
        <input id="ed-judul" className="input" value={String(nilai("title") ?? "")}
          onChange={(e) => set("title", e.target.value)} />
      </div>
      <div className="field">
        <label className="field__label" htmlFor="ed-slug">Slug</label>
        <input id="ed-slug" className="input input--mono" value={String(nilai("slug") ?? "")}
          onChange={(e) => set("slug", e.target.value)} />
        <p className="field__help">
          Mengubah slug memutus tautan lama ke halaman ini.
        </p>
      </div>
      <div className="field">
        <label className="field__label" htmlFor="ed-sub">Subjudul</label>
        <input id="ed-sub" className="input" value={String(nilai("subtitle") ?? "")}
          onChange={(e) => set("subtitle", e.target.value)} />
      </div>
      <div className="field">
        <label className="field__label" htmlFor="ed-ring">Ringkasan</label>
        <textarea id="ed-ring" className="input input--area" value={String(nilai("summary") ?? "")}
          onChange={(e) => set("summary", e.target.value)} />
      </div>
      <div className="field">
        <label className="field__label" htmlFor="ed-desc">Deskripsi</label>
        <textarea id="ed-desc" className="input input--area" style={{ minHeight: "10rem" }}
          value={String(nilai("description") ?? "")} onChange={(e) => set("description", e.target.value)} />
      </div>
      <div className="spec-grid">
        <div className="field">
          <label className="field__label" htmlFor="ed-kota">Kota</label>
          <input id="ed-kota" className="input" value={String(nilai("city") ?? "")}
            onChange={(e) => set("city", e.target.value)} />
        </div>
        <div className="field">
          <label className="field__label" htmlFor="ed-lok">Lokasi</label>
          <input id="ed-lok" className="input" value={String(nilai("location") ?? "")}
            onChange={(e) => set("location", e.target.value)} />
        </div>
        <div className="field">
          <label className="field__label" htmlFor="ed-tahun">Tahun</label>
          <input id="ed-tahun" className="input" type="number" value={String(nilai("year") ?? "")}
            onChange={(e) => set("year", Number(e.target.value) as never)} />
        </div>
        <div className="field">
          <label className="field__label" htmlFor="ed-luas">Luas (m²)</label>
          <input id="ed-luas" className="input" type="number" value={String(nilai("areaSqm") ?? "")}
            onChange={(e) => set("areaSqm", Number(e.target.value) as never)} />
        </div>
      </div>
    </div>
  );

  const galeri = (
    <div className="stack">
      {nilai("coverImageUrl") || nilai("coverImageKey" as keyof Proyek) ? (
        <div className="aspect aspect--16-9">
          {nilai("coverImageUrl") ? (
            <img src={String(nilai("coverImageUrl"))} alt={`Cover ${asli.title}`} />
          ) : (
            <div style={{ display: "grid", placeItems: "center", color: "var(--text-faint)" }}>
              Cover baru tersimpan — tekan Simpan untuk menerapkannya
            </div>
          )}
        </div>
      ) : (
        <div className="dropzone">
          <span className="icon-tile"><Icon name="image" size={20} /></span>
          <span className="t-subheading">Belum ada cover</span>
          <span className="t-muted">Proyek tidak bisa diterbitkan tanpa cover.</span>
        </div>
      )}

      <input ref={berkas} type="file" className="sr-only"
        accept="image/jpeg,image/png,image/webp,image/avif"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) unggah(f); }} />
      <button type="button" className="btn btn--secondary" onClick={() => berkas.current?.click()}>
        <Icon name="upload" size={15} />Unggah cover
      </button>
      <p className="field__help">
        Berkas dikirim langsung ke penyimpanan lewat URL berbatas waktu — tidak melewati server API.
      </p>

      <span className="separator" role="presentation" />

      <div className="row" style={{ gap: "var(--space-3)", alignItems: "flex-start" }}>
        <span className="icon-tile"><Icon name="image" size={20} /></span>
        <span className="card__titles">
          <span className="t-subheading">Foto galeri</span>
          <span className="t-muted">Tampil di halaman proyek publik, urut seperti di bawah.</span>
        </span>
      </div>

      <PanelGaleri
        proyek={asli}
        onJadikanCover={(key) => set("coverImageKey" as keyof Proyek, key as never)}
      />
    </div>
  );

  const seo = (
    <div className="stack">
      <div className="field">
        <label className="field__label" htmlFor="ed-seot">Judul SEO</label>
        <input id="ed-seot" className="input" value={String(nilai("seoTitle") ?? "")}
          onChange={(e) => set("seoTitle", e.target.value)} />
        <p className="field__help">Kosongkan untuk memakai judul proyek.</p>
      </div>
      <div className="field">
        <label className="field__label" htmlFor="ed-seod">Deskripsi SEO</label>
        <textarea id="ed-seod" className="input input--area" value={String(nilai("seoDescription") ?? "")}
          onChange={(e) => set("seoDescription", e.target.value)} />
      </div>
    </div>
  );

  const bisaTerbit = Boolean(nilai("coverImageUrl") || nilai("coverImageKey" as keyof Proyek));

  return (
    <div className="stack" style={{ gap: "var(--space-5)" }}>
      <div className="row row--between">
        <a className="btn btn--ghost btn--sm" href="/admin/proyek">
          <Icon name="chevronLeft" size={15} />Semua proyek
        </a>
        <span className="row" style={{ gap: "var(--space-2)" }}>
          {adaPerubahan && (
            <span className="marker marker--warn"><span className="marker__dot" />{berubah.length} perubahan belum disimpan</span>
          )}
          <button type="button" className="btn btn--primary" disabled={!adaPerubahan || menyimpan} onClick={simpan}>
            {menyimpan && <span className="spinner spinner--sm spinner--on-action" />}
            Simpan
          </button>
        </span>
      </div>

      <div className="card">
        <div className="card__header">
          <span className="icon-tile"><Icon name="project" size={20} /></span>
          <span className="card__titles">
            <span className="t-subheading">Status terbit</span>
            <span className="t-muted">
              {bisaTerbit ? "Proyek siap diterbitkan." : "Unggah cover dulu sebelum menerbitkan."}
            </span>
          </span>
        </div>
        <div className="card__body">
          <div className="stack" style={{ gap: "var(--space-2)" }}>
            {[
              { v: "draft", t: "Draf", d: "Hanya terlihat oleh staf studio." },
              { v: "published", t: "Terbit", d: "Tampil di situs setelah build berikutnya." },
              { v: "archived", t: "Arsip", d: "Disembunyikan tanpa dihapus." },
            ].map((s) => (
              <label className="radio-card" key={s.v}>
                <input type="radio" name="ed-status" checked={nilai("status") === s.v}
                  disabled={s.v === "published" && !bisaTerbit}
                  onChange={() => set("status", s.v)} />
                <span className="radio-card__mark"><Icon name="check" size={14} /></span>
                <span className="radio-card__body">
                  <span className="radio-card__title">{s.t}</span>
                  <span className="radio-card__desc">{s.d}</span>
                </span>
              </label>
            ))}
            <label className="choice" style={{ marginTop: "var(--space-2)" }}>
              <input type="checkbox" checked={Boolean(nilai("isFeatured"))}
                onChange={(e) => set("isFeatured", e.target.checked)} />
              <span className="choice__text">
                <span>Tampilkan di beranda</span>
                <span className="choice__desc">Proyek unggulan muncul di halaman depan.</span>
              </span>
            </label>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card__header">
          <span className="icon-tile"><Icon name="dashboard" size={20} /></span>
          <span className="card__titles">
            <span className="t-subheading">Tahap pipeline</span>
            <span className="t-muted">Alur kerja internal studio — beda dari status terbit di atas.</span>
          </span>
        </div>
        <div className="card__body">
          <div className="segmented" role="group" aria-label="Tahap pipeline">
            {PIPELINE.map(([tahap, label]) => (
              <button
                key={tahap}
                type="button"
                className="segmented__opt"
                aria-pressed={nilai("pipelineStage") === tahap}
                onClick={async () => {
                  const sebelum = nilai("pipelineStage");
                  set("pipelineStage" as keyof Proyek, tahap as never);
                  try {
                    await simpanProyek(asli.id, { pipelineStage: tahap });
                    setAsli((a) => (a ? { ...a, pipelineStage: tahap } : a));
                  } catch (e) {
                    set("pipelineStage" as keyof Proyek, sebelum as never);
                    toast({ judul: "Gagal mengubah tahap", keterangan: (e as Error).message, nada: "gagal" });
                  }
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <Tabs
        items={[
          { id: "detail", label: "Detail", content: detail },
          { id: "brief", label: "Brief", content: <PanelBrief projectId={asli.id} /> },
          { id: "galeri", label: "Galeri", content: galeri },
          { id: "tugas", label: "Tugas", content: <PanelTugas projectId={asli.id} /> },
          { id: "dokumen", label: "Dokumen", content: <PanelDokumen proyek={asli} /> },
          {
            id: "keuangan",
            label: "Keuangan",
            content: (
              <PanelKeuangan
                proyek={asli}
                onUbahKontrak={(nilai) => setAsli((a) => (a ? { ...a, contractValue: nilai } : a))}
              />
            ),
          },
          { id: "progres", label: "Progres", content: <PanelProgres projectId={asli.id} /> },
          { id: "seo", label: "SEO", content: seo },
        ]}
      />

      <p className="field__help">
        Kategori: {KATEGORI[String(nilai("category"))] ?? nilai("category")}
      </p>
    </div>
  );
}

export function ProjectEditor() {
  return (
    <RequireAuth>
      <ToastProvider><Isi /></ToastProvider>
    </RequireAuth>
  );
}
