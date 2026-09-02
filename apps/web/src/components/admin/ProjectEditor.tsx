import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Icon } from "../ui/Icon";
import { Select } from "../ui/overlay/Select";
import { InputRupiah } from "../ui/InputRupiah";
import { Carousel } from "../ui/data/Carousel";
import { DatePicker } from "../ui/data/DatePicker";
import { Tabs } from "../ui/misc/Nav";
import { PerekamSuara, PemutarSuara, formatDurasi } from "../ui/misc/VoiceNote";
import {
  SkeletonDaftar, SkeletonKartu, SkeletonIsian, SkeletonKotak, SkeletonTeks, Balok,
} from "../ui/Skeleton";
import { AlertDialog } from "../ui/overlay/Dialog";
import { ToastProvider, useToast } from "../ui/overlay/Toast";
import { RequireAuth } from "./RequireAuth";
import { proyekAktif, onProyekAktif } from "../../lib/proyekAktif";
import {
  daftarProyek, simpanProyek, mintaUrlUnggah, type Proyek,
  ambilProgress, ubahFaseProgress, buatUlangTokenProgress,
  tambahCatatanProgress, hapusCatatanProgress, type ProjectProgress,
  daftarTim, daftarTugasProyek, tambahTugas, ubahTugas, hapusTugas,
  type AnggotaTim, type Tugas,
  daftarInvoice, tambahInvoice, ubahInvoice, hapusInvoice, type Invoice,
  daftarBiaya, tambahBiaya, hapusBiaya, type BiayaProyek,
  daftarDokumen, tambahDokumen, ubahDokumen, hapusDokumen, type DokumenProyek,
  MAKS_BYTE_DOKUMEN,
  ambilBrief, ubahBrief, type BriefProyek,
  daftarKomentarDokumen, tambahKomentarDokumen, type KomentarDokumen,
  daftarGambar, tambahGambar, ubahGambar, hapusGambar, type GambarProyek,
  terbitkanSitus, type JenisGambar,
  ambilSettings, type StudioSettings,
  bacaCache, tulisCache,
} from "../../lib/admin";
import { useCegahPindah } from "../../lib/cegahPindah";
import { unduhPdf } from "../../lib/pdf";
import { formatRupiah } from "../../lib/format";

/* useLayoutEffect di browser, useEffect di server — sama seperti di
   RequireAuth. Yang dibutuhkan di sini: menjalankan pembacaan penyimpanan
   sebelum browser melukis frame pertama, tanpa memicu peringatan React saat
   Astro merender island ini di server. */
const useEfekTataLetak = typeof window === "undefined" ? useEffect : useLayoutEffect;

/* Radix Select menolak value string kosong — itu nilai cadangan untuk
   "belum ada pilihan". Jadi "belum ditentukan" perlu nilai sendiri. */
const TANPA_PIC = "__tanpa__";

/* Batas foto per proyek, dipakai galeri maupun material. Angkanya keputusan
   pemilik, bukan batas teknis: sepuluh foto sudah lebih dari cukup untuk satu
   proyek, dan galeri yang tak terbatas membuat halaman publik lambat tanpa
   ada yang menyadari penyebabnya. */
const MAKS_FOTO = 10;

const LABEL_STATUS: Record<string, string> = {
  draft: "Draf", published: "Terbit", archived: "Arsip",
};

/* Warna punya makna tetap: hijau = hidup, amber = belum lengkap atau
   tertahan, netral = disimpan tanpa dihapus. */
const BADGE_STATUS: Record<string, string> = {
  draft: "badge--warn", published: "badge--success", archived: "",
};


/* Sama persis dengan allowlist R2 di Worker API. Kalau keduanya berbeda,
   staf bisa memilih berkas yang lalu ditolak saat diunggah — dan pesan
   penolakannya datang dari penyimpanan, bukan dari halaman ini. */
const TIPE_DOKUMEN = [
  "application/pdf",
  "image/jpeg", "image/png", "image/webp", "image/avif",
  "audio/mpeg", "audio/mp4", "audio/webm", "audio/ogg",
].join(",");

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
  const [invoice, setInvoice] = useState<Invoice[] | null>(() => bacaCache<Invoice[]>(`invoice:${proyek.id}`));
  const [biaya, setBiaya] = useState<BiayaProyek[] | null>(() => bacaCache<BiayaProyek[]>(`biaya:${proyek.id}`));
  const [kontrakInput, setKontrakInput] = useState<number | null>(proyek.contractValue ?? null);

  const [labelInv, setLabelInv] = useState("");
  const [nominalInv, setNominalInv] = useState<number | null>(null);

  const [labelBiaya, setLabelBiaya] = useState("");
  const [kategoriBiaya, setKategoriBiaya] = useState("lainnya");
  const [nominalBiaya, setNominalBiaya] = useState<number | null>(null);
  // Kosong berarti hari ini. Staf yang mencatat nota hari ini tidak perlu
  // mengetik tanggalnya; yang mencatat nota bulan lalu tinggal menggantinya.
  const [tanggalBiaya, setTanggalBiaya] = useState("");

  /* Kop PDF diambil dari Info Studio. Dimuat sekali bersama panelnya, bukan
     saat tombol ditekan: kalau permintaannya gagal, tombolnya mati dengan
     alasan yang jelas ketimbang menggantung setelah diklik. */
  const [studio, setStudio] = useState<StudioSettings | null>(null);
  const [membuatPdf, setMembuatPdf] = useState<"biaya" | "invoice" | null>(null);

  function muat() {
    daftarInvoice(proyek.id).then((d) => { tulisCache(`invoice:${proyek.id}`, d); setInvoice(d); }).catch(() => setInvoice((l) => l ?? []));
    daftarBiaya(proyek.id).then((d) => { tulisCache(`biaya:${proyek.id}`, d); setBiaya(d); }).catch(() => setBiaya((l) => l ?? []));
  }

  useEffect(muat, [proyek.id]);
  useEffect(() => { ambilSettings().then(setStudio).catch(() => setStudio(null)); }, []);

  async function simpanKontrak() {
    const angka = kontrakInput;
    if (angka === null || angka <= 0) return;
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
    const nominal = nominalInv;
    if (label.length < 2 || nominal === null || nominal <= 0) return;
    try {
      await tambahInvoice(proyek.id, label, nominal, null);
      setLabelInv("");
      setNominalInv(null);
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
    const nominal = nominalBiaya;
    if (label.length < 2 || nominal === null || nominal <= 0) return;
    try {
      await tambahBiaya(proyek.id, label, kategoriBiaya, nominal, tanggalBiaya || undefined);
      setLabelBiaya("");
      setNominalBiaya(null);
      setTanggalBiaya("");
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
  const totalInvoice = (invoice ?? []).reduce((s, i) => s + i.amount, 0);
  const totalLunas = (invoice ?? []).filter((i) => i.status === "lunas").reduce((s, i) => s + i.amount, 0);

  async function unduhBiaya() {
    if (!studio || !biaya) return;
    setMembuatPdf("biaya");
    try {
      const nama = await unduhPdf({
        judul: "Rincian Biaya Proyek",
        namaProyek: proyek.title,
        kolomTengah: "Kategori",
        baris: biaya.map((b) => ({
          label: b.label,
          keterangan: KATEGORI_BIAYA.find(([v]) => v === b.category)?.[1] ?? b.category,
          nominal: b.amount,
        })),
        ringkasan: [
          ...(kontrak > 0 ? [{ label: "Nilai kontrak", nilai: formatRupiah(kontrak) }] : []),
          { label: "Total biaya", nilai: formatRupiah(totalBiaya), tebal: true },
          ...(marginPct !== null
            ? [{ label: "Margin", nilai: `${formatRupiah(kontrak - totalBiaya)} (${marginPct.toFixed(0)}%)` }]
            : []),
        ],
        catatan: "Dokumen internal studio. Berisi biaya dan margin — tidak untuk dibagikan ke klien.",
      }, studio);
      toast({ judul: "PDF diunduh", keterangan: nama, nada: "sukses" });
    } catch (e) {
      toast({ judul: "Gagal membuat PDF", keterangan: (e as Error).message, nada: "gagal" });
    } finally {
      setMembuatPdf(null);
    }
  }

  async function unduhInvoice() {
    if (!studio || !invoice) return;
    setMembuatPdf("invoice");
    try {
      const nama = await unduhPdf({
        judul: "Daftar Tagihan",
        namaProyek: proyek.title,
        kolomTengah: "Status",
        baris: invoice.map((i) => ({
          label: i.label,
          keterangan: STATUS_INVOICE.find(([v]) => v === i.status)?.[1] ?? i.status,
          nominal: i.amount,
        })),
        ringkasan: [
          { label: "Total tagihan", nilai: formatRupiah(totalInvoice), tebal: true },
          { label: "Sudah dibayar", nilai: formatRupiah(totalLunas) },
          { label: "Sisa", nilai: formatRupiah(totalInvoice - totalLunas) },
        ],
        catatan: studio.phone
          ? `Pembayaran dan pertanyaan tagihan: ${studio.phone}`
          : undefined,
      }, studio);
      toast({ judul: "PDF diunduh", keterangan: nama, nada: "sukses" });
    } catch (e) {
      toast({ judul: "Gagal membuat PDF", keterangan: (e as Error).message, nada: "gagal" });
    } finally {
      setMembuatPdf(null);
    }
  }

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
          <div className="input-group">
            <InputRupiah value={kontrakInput} onChange={setKontrakInput}
              ariaLabel="Nilai kontrak" placeholder="Rp0" />
            <button type="button" className="btn btn--secondary" disabled={kontrakInput === null || kontrakInput <= 0}
              onClick={simpanKontrak}>Simpan</button>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card__header">
          <span className="card__titles">
            <span className="t-subheading">Invoice</span>
            <span className="t-muted">DP, pelunasan, atau tagihan lain untuk proyek ini.</span>
          </span>
          <button type="button" className="btn btn--ghost btn--sm"
            disabled={!studio || !invoice || invoice.length === 0 || membuatPdf !== null}
            onClick={unduhInvoice}>
            {membuatPdf === "invoice"
              ? <span className="spinner spinner--sm" />
              : <Icon name="download" size={14} />}
            Unduh PDF
          </button>
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
                <label className="field__label" htmlFor="inv-nominal">Nominal</label>
                <InputRupiah id="inv-nominal" value={nominalInv} onChange={setNominalInv} />
              </div>
            </div>
            <div className="row row--end">
              <button type="button" className="btn btn--secondary btn--sm"
                disabled={labelInv.trim().length < 2 || nominalInv === null || nominalInv <= 0}
                onClick={tambahInv}>
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
                    <Select
                      ringkas
                      ariaLabel={`Ubah status ${i.label}`}
                      value={i.status}
                      onValueChange={(v) => ubahStatusInv(i.id, v)}
                      options={STATUS_INVOICE.map(([value, label]) => ({ value, label }))}
                    />
                    <AlertDialog
                      destructive
                      title={`Hapus ${i.label}?`}
                      description="Riwayat tagihan ini akan dihapus permanen."
                      confirmLabel="Ya, hapus"
                      onConfirm={() => hapusInv(i.id)}
                      trigger={
                        <button type="button" className="btn btn--ghost btn--icon btn--hapus" aria-label={`Hapus ${i.label}`}>
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
          <button type="button" className="btn btn--ghost btn--sm"
            disabled={!studio || !biaya || biaya.length === 0 || membuatPdf !== null}
            onClick={unduhBiaya}>
            {membuatPdf === "biaya"
              ? <span className="spinner spinner--sm" />
              : <Icon name="download" size={14} />}
            Unduh PDF
          </button>
        </div>
        <div className="card__body">
          <div className="stack">
            {/* --rapat: ambang .spec-grid biasa (18rem) memaksa Nominal turun
                sendirian ke baris kedua di kartu selebar ini. Ketiganya isian
                pendek dan dibaca sebagai satu kalimat — label, jenisnya,
                berapa — jadi harus sebaris. */}
            <div className="spec-grid spec-grid--rapat spec-grid--tiga">
              <div className="field">
                <label className="field__label" htmlFor="biaya-label">Label</label>
                <input id="biaya-label" className="input" value={labelBiaya} onChange={(e) => setLabelBiaya(e.target.value)}
                  placeholder="Contoh: Fee Rian — DED" />
              </div>
              <div className="field">
                <label className="field__label" htmlFor="biaya-kategori">Kategori</label>
                <Select
                  id="biaya-kategori"
                  ariaLabel="Kategori biaya"
                  value={kategoriBiaya}
                  onValueChange={setKategoriBiaya}
                  options={KATEGORI_BIAYA.map(([value, label]) => ({ value, label }))}
                />
              </div>
              <div className="field">
                <label className="field__label" htmlFor="biaya-nominal">Nominal</label>
                <InputRupiah id="biaya-nominal" value={nominalBiaya} onChange={setNominalBiaya} />
              </div>
            </div>
            {/* Tanggal ditaruh di baris tombol, bukan jadi kolom keempat:
                baris Label / Kategori / Nominal sudah disetujui pemilik dan
                tidak diubah. Ruang kosong di kiri tombol memang menganggur. */}
            <div className="row row--between" style={{ flexWrap: "wrap", gap: "var(--space-3)" }}>
              <div className="field field--sebaris">
                <label className="field__label" htmlFor="biaya-tanggal">Tanggal biaya</label>
                <input id="biaya-tanggal" className="input input--ringkas" type="date"
                  value={tanggalBiaya} onChange={(e) => setTanggalBiaya(e.target.value)}
                  max={new Date().toISOString().slice(0, 10)} />
                <span className="field__help">Kosongkan kalau hari ini.</span>
              </div>
              <button type="button" className="btn btn--secondary btn--sm"
                disabled={labelBiaya.trim().length < 2 || nominalBiaya === null || nominalBiaya <= 0}
                onClick={tambahBiayaBaru}>
                <Icon name="plus" size={14} />Tambah biaya
              </button>
            </div>

            {biaya && biaya.length > 0 && (
              <ul className="stack" style={{ gap: "var(--space-2)", listStyle: "none", padding: 0, marginTop: "var(--space-3)" }}>
                {biaya.map((b) => (
                  <li key={b.id} className="item item--bordered">
                    <span className="item__text">
                      <span className="item__title">{b.label}</span>
                      <span className="item__desc">
                        {KATEGORI_BIAYA.find(([v]) => v === b.category)?.[1] ?? b.category}
                        {" · "}{formatRupiah(b.amount)}
                        {" · "}{new Date(b.incurredOn).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                      </span>
                    </span>
                    <AlertDialog
                      destructive
                      title={`Hapus ${b.label}?`}
                      description="Biaya ini akan dihapus dari perhitungan margin proyek."
                      confirmLabel="Ya, hapus"
                      onConfirm={() => hapusBiayaItem(b.id)}
                      trigger={
                        <button type="button" className="btn btn--ghost btn--icon btn--hapus" aria-label={`Hapus ${b.label}`}>
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
          <SkeletonTeks baris={2} />
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

function ukuranBerkas(b: number): string {
  if (b >= 1_048_576) return `${(b / 1_048_576).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(b / 1024))} KB`;
}

/** "DED Rev.2.pdf" → "DED Rev.2". Dipakai saat staf mengunggah banyak berkas
 *  sekaligus: mengetik judul sepuluh kali bukan alur yang masuk akal. */
function judulDariNama(nama: string): string {
  const titik = nama.lastIndexOf(".");
  const dasar = titik > 0 ? nama.slice(0, titik) : nama;
  return dasar.trim().slice(0, 120) || nama;
}

function PanelDokumen({ proyek }: { proyek: Proyek }) {
  const toast = useToast();
  const [dokumen, setDokumen] = useState<DokumenProyek[] | null>(() => bacaCache<DokumenProyek[]>(`dokumen:${proyek.id}`));
  const [judulBaru, setJudulBaru] = useState("");
  const [antre, setAntre] = useState<{ selesai: number; total: number } | null>(null);
  const berkas = useRef<HTMLInputElement>(null);

  function muat() {
    daftarDokumen(proyek.id).then((d) => { tulisCache(`dokumen:${proyek.id}`, d); setDokumen(d); }).catch(() => setDokumen((l) => l ?? []));
  }

  useEffect(muat, [proyek.id]);

  /** Satu berkas: presign → PUT ke R2 → catat barisnya. */
  async function unggahSatu(f: File, judul: string) {
    const target = await mintaUrlUnggah(proyek.slug, f.type);
    const res = await fetch(target.uploadUrl, { method: "PUT", headers: { "Content-Type": f.type }, body: f });
    if (!res.ok) throw new Error(`Penyimpanan menolak berkas (${res.status})`);
    await tambahDokumen(proyek.id, {
      title: judul,
      fileKey: target.key,
      kind: "berkas",
      fileName: f.name,
      fileSize: f.size,
      mimeType: f.type,
    });
  }

  async function unggahBanyak(list: FileList) {
    const dipilih = [...list];
    if (dipilih.length === 0) return;

    // Berkas kebesaran disaring lebih dulu, bukan membatalkan seluruh
    // antrean: kalau sembilan dari sepuluh berkas sah, sembilan itu tetap
    // naik dan staf hanya mengulang yang satu.
    const kebesaran = dipilih.filter((f) => f.size > MAKS_BYTE_DOKUMEN);
    const sah = dipilih.filter((f) => f.size <= MAKS_BYTE_DOKUMEN);
    if (kebesaran.length > 0) {
      toast({
        judul: kebesaran.length === 1 ? `"${kebesaran[0].name}" lebih dari 100 MB` : `${kebesaran.length} berkas lebih dari 100 MB`,
        keterangan: "Berkas sebesar itu dilewati. Batasnya 100 MB per berkas.",
        nada: "gagal",
      });
    }
    if (sah.length === 0) return;

    // Judul yang diketik hanya dipakai kalau berkasnya satu. Untuk banyak
    // berkas, nama berkasnya sendiri yang jadi judul — bisa diubah setelahnya.
    const judulManual = judulBaru.trim();
    const pakaiManual = sah.length === 1 && judulManual.length >= 2;

    setAntre({ selesai: 0, total: sah.length });
    let gagal = 0;
    for (let i = 0; i < sah.length; i++) {
      const f = sah[i];
      try {
        await unggahSatu(f, pakaiManual ? judulManual : judulDariNama(f.name));
      } catch (e) {
        gagal++;
        toast({ judul: `Gagal mengunggah ${f.name}`, keterangan: (e as Error).message, nada: "gagal" });
      }
      setAntre({ selesai: i + 1, total: sah.length });
    }
    setAntre(null);
    setJudulBaru("");
    muat();

    const berhasil = sah.length - gagal;
    if (berhasil > 0) {
      toast({ judul: berhasil === 1 ? "Dokumen diunggah" : `${berhasil} dokumen diunggah`, nada: "sukses" });
    }
  }

  async function kirimSuara(blob: Blob, durasiMs: number, mime: string) {
    try {
      const target = await mintaUrlUnggah(proyek.slug, mime);
      const res = await fetch(target.uploadUrl, { method: "PUT", headers: { "Content-Type": mime }, body: blob });
      if (!res.ok) throw new Error(`Penyimpanan menolak rekaman (${res.status})`);
      await tambahDokumen(proyek.id, {
        title: `Pesan suara ${formatDurasi(durasiMs)}`,
        fileKey: target.key,
        kind: "suara",
        fileSize: blob.size,
        mimeType: mime,
        durationMs: Math.round(durasiMs),
      });
      muat();
      toast({ judul: "Pesan suara terkirim", nada: "sukses" });
    } catch (e) {
      toast({ judul: "Gagal mengirim pesan suara", keterangan: (e as Error).message, nada: "gagal" });
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
    return (
      <div className="stack" style={{ gap: "var(--space-5)" }}>
        <SkeletonKartu ikon="document" anak={<SkeletonIsian jumlah={1} />} />
        <SkeletonDaftar jumlah={3} aksi={2} />
      </div>
    );
  }

  const mengunggah = antre !== null;

  return (
    <div className="stack" style={{ gap: "var(--space-5)" }}>
      <div className="card">
        <div className="card__header">
          <span className="icon-tile"><Icon name="document" size={20} /></span>
          <span className="card__titles">
            <span className="t-subheading">Unggah dokumen</span>
            <span className="t-muted">Gambar kerja, RAB, atau foto untuk dilihat klien.</span>
          </span>
        </div>
        <div className="card__body">
          <div className="stack">
            <div className="field">
              <label className="field__label" htmlFor="dok-judul">Judul dokumen <span className="t-muted">(opsional)</span></label>
              <input id="dok-judul" className="input" value={judulBaru} disabled={mengunggah}
                onChange={(e) => setJudulBaru(e.target.value)} placeholder="Contoh: DED Rev.2" />
              <p className="field__help">
                Dikosongkan atau memilih lebih dari satu berkas: nama berkasnya yang dipakai sebagai judul.
              </p>
            </div>
            <input ref={berkas} type="file" multiple className="sr-only" accept={TIPE_DOKUMEN}
              onChange={(e) => {
                const list = e.target.files;
                if (list && list.length > 0) void unggahBanyak(list);
                // Direset supaya memilih berkas yang sama dua kali tetap memicu onChange.
                e.target.value = "";
              }} />
            <div className="row row--between">
              <p className="field__help" style={{ margin: 0 }}>
                PDF, JPG, PNG — maks 100 MB per berkas, boleh beberapa sekaligus.
              </p>
              <button type="button" className="btn btn--secondary" disabled={mengunggah}
                onClick={() => berkas.current?.click()}>
                {mengunggah && <span className="spinner spinner--sm spinner--on-action" />}
                <Icon name="upload" size={15} />
                {antre ? `Mengunggah ${antre.selesai}/${antre.total}` : "Pilih berkas"}
              </button>
            </div>
          </div>
        </div>
      </div>

      <PerekamSuara onKirim={kirimSuara} disabled={mengunggah} />

      {dokumen.length === 0 ? (
        <div className="empty empty--sm buat-kartu">
          <span className="icon-tile"><Icon name="document" size={20} /></span>
          <span className="t-subheading">Belum ada dokumen</span>
          <p className="t-muted">Berkas yang diunggah di sini langsung terlihat di portal klien.</p>
        </div>
      ) : (
        <ul className="stack" style={{ gap: "var(--space-3)", listStyle: "none", padding: 0 }}>
          {dokumen.map((d) => (
            <li key={d.id} className="stack" style={{ gap: "var(--space-2)" }}>
              <div className="item item--bordered">
                <span className="item__text">
                  <span className="item__title">{d.title}</span>
                  {d.kind === "suara" ? (
                    <PemutarSuara url={d.fileUrl} durationMs={d.durationMs} label={d.title} />
                  ) : (
                    <span className="item__desc">
                      <a href={d.fileUrl} target="_blank" rel="noreferrer">Lihat berkas</a>
                      {typeof d.fileSize === "number" && ` — ${ukuranBerkas(d.fileSize)}`}
                    </span>
                  )}
                  {d.status === "revisi_diminta" && d.clientNote && (
                    <span className="item__desc">Catatan klien: {d.clientNote}</span>
                  )}
                </span>
                <Select
                  ringkas
                  ariaLabel={`Ubah status ${d.title}`}
                  value={d.status}
                  onValueChange={(v) => ubahStatus(d.id, v)}
                  options={STATUS_DOKUMEN.map(([value, label]) => ({ value, label }))}
                />
                <AlertDialog
                  destructive
                  title={`Hapus ${d.title}?`}
                  description="Dokumen ini akan hilang dari portal klien beserta seluruh komentarnya."
                  confirmLabel="Ya, hapus"
                  onConfirm={() => hapus(d.id)}
                  trigger={
                    <button type="button" className="btn btn--ghost btn--icon btn--hapus" aria-label={`Hapus ${d.title}`}>
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
/* Kata-kata yang berbeda antara galeri dan material. Dipisah ke satu tempat
   supaya panelnya tetap satu — yang berbeda cuma isi kalimat dan satu tombol,
   bukan cara kerjanya. Menyalin panelnya berarti merawat dua salinan dari
   unggah berurutan, batas sepuluh, urutan, dan penghapusan. */
const KATA_GAMBAR = {
  galeri: {
    judul: "Foto galeri",
    ket: "Tampil di halaman proyek publik, urut seperti di bawah.",
    kosong: "Belum ada foto galeri",
    kosongKet: "Halaman proyek publik hanya menampilkan seksi galeri kalau ada isinya.",
    seret: "Tarik foto ke sini, atau klik untuk memilih",
    label: "Keterangan (opsional)",
  },
  material: {
    judul: "Material yang dipakai",
    ket: "Bahan yang membentuk proyek ini — beri nama tiap fotonya.",
    kosong: "Belum ada foto material",
    kosongKet: "Contoh: batu alam, kayu jati, beton ekspos, genteng tanah liat.",
    seret: "Tarik foto material ke sini, atau klik untuk memilih",
    label: "Nama material",
  },
} as const;

function PanelGaleri({
  proyek, jenis = "galeri", onJadikanCover,
}: {
  proyek: Proyek;
  jenis?: JenisGambar;
  onJadikanCover?: (key: string) => void;
}) {
  const kata = KATA_GAMBAR[jenis];
  const toast = useToast();
  const [gambar, setGambar] = useState<GambarProyek[] | null>(() => bacaCache<GambarProyek[]>(`gambar:${jenis}:${proyek.id}`));
  const [mengunggah, setMengunggah] = useState(0);
  const [dragging, setDragging] = useState(false);
  const berkas = useRef<HTMLInputElement>(null);

  function muat() {
    daftarGambar(proyek.id, jenis).then((d) => { tulisCache(`gambar:${jenis}:${proyek.id}`, d); setGambar(d); }).catch(() => setGambar((l) => l ?? []));
  }

  // jenis ikut jadi dependensi: satu komponen ini dipakai dua kali di halaman
  // yang sama, dan tanpa itu panel material akan menampilkan foto galeri.
  useEffect(muat, [proyek.id, jenis]);

  async function unggahSatu(f: File, urutan: number) {
    const target = await mintaUrlUnggah(proyek.slug, f.type);
    const res = await fetch(target.uploadUrl, { method: "PUT", headers: { "Content-Type": f.type }, body: f });
    if (!res.ok) throw new Error(`Penyimpanan menolak ${f.name} (${res.status})`);
    await tambahGambar(proyek.id, target.key, urutan, jenis);
  }

  async function unggahBanyak(files: FileList | File[]) {
    const semua = [...files].filter((f) => f.type.startsWith("image/"));
    if (semua.length === 0) return;

    // Batas 10 foto per proyek. Dipotong di sini, bukan ditolak seluruhnya:
    // menolak sepuluh berkas karena yang kesebelas kelebihan membuang
    // sembilan unggahan yang sebenarnya sah.
    const sisa = MAKS_FOTO - (gambar?.length ?? 0);
    if (sisa <= 0) {
      toast({ judul: `${kata.judul} penuh`, keterangan: `Maksimum ${MAKS_FOTO} foto per proyek.`, nada: "gagal" });
      return;
    }
    const daftar = semua.slice(0, sisa);
    if (semua.length > sisa) {
      toast({
        judul: `${daftar.length} foto diunggah`,
        keterangan: `Sisanya dilewati — maksimum ${MAKS_FOTO} foto per proyek.`,
        nada: "gagal",
      });
    }

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

  if (!gambar) return <SkeletonKotak jumlah={4} />;

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
          {mengunggah > 0 ? `Mengunggah ${mengunggah} foto…` : kata.seret}
        </span>
        <span className="t-muted">
          JPG, PNG, WEBP, atau AVIF — maksimum {MAKS_FOTO} foto per proyek
          ({gambar.length}/{MAKS_FOTO} terpakai).
        </span>
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
          <span className="t-subheading">{kata.kosong}</span>
          <p className="t-muted">{kata.kosongKet}</p>
        </div>
      ) : (
        // Carousel, bukan petak: sepuluh foto dalam petak mendorong sisa
        // halaman jauh ke bawah, sementara yang dilakukan staf di sini adalah
        // menelusuri satu per satu. Komponennya diambil dari UI Component.
        <Carousel label={`${kata.judul} proyek`}>
          {gambar.map((g, i) => (
            <div className="galeri-item carousel__slide" key={g.id}>
              <div className="aspect aspect--4-3">
                <img src={g.url} alt={g.altText ?? ""} loading="lazy" />
              </div>

              <div className="galeri-item__body">
                <label className="sr-only" htmlFor={`cap-${g.id}`}>{kata.label} {i + 1}</label>
                <input
                  id={`cap-${g.id}`}
                  className="input"
                  defaultValue={g.caption ?? ""}
                  placeholder={kata.label}
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
                      <button type="button" className="btn btn--ghost btn--icon btn--boxed btn--hapus" aria-label={`Hapus foto ${i + 1}`}>
                        <Icon name="trash" size={15} />
                      </button>
                    }
                  />
                </span>
                {/* Hanya foto galeri yang bisa jadi cover. Foto material
                    bukan potret proyeknya, jadi tombolnya tidak ada di sana
                    sama sekali — bukan ada tapi tidak berfungsi. */}
                {onJadikanCover && (
                  <button type="button" className="btn btn--ghost btn--sm"
                    onClick={() => { onJadikanCover(g.storageKey); toast({ judul: "Dipakai sebagai cover", keterangan: "Tekan Simpan untuk menerapkannya.", nada: "sukses" }); }}>
                    <Icon name="star" size={14} />Jadikan cover
                  </button>
                )}
              </div>
            </div>
          ))}
        </Carousel>
      )}
    </div>
  );
}

function PanelBrief({ projectId }: { projectId: string }) {
  const toast = useToast();
  const [brief, setBrief] = useState<BriefProyek | null>(() => bacaCache<BriefProyek>(`brief:${projectId}`));
  const [sibuk, setSibuk] = useState(false);

  useEffect(() => {
    ambilBrief(projectId).then((d) => { tulisCache(`brief:${projectId}`, d); setBrief(d); }).catch(() => setBrief((l) => l));
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
    return (
      <div className="stack" style={{ gap: "var(--space-5)" }}>
        <SkeletonKartu ikon="quote" anak={<SkeletonIsian jumlah={4} />} />
        <SkeletonKartu ikon="edit" anak={<SkeletonTeks baris={3} />} />
      </div>
    );
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
            {/* Dua baris berisi dua, bukan tiga sejajar: anggaran dan gaya
                sama-sama sifat proyek, sementara dua tanggal adalah satu
                rentang yang harus dibaca berpasangan. Tiga kolom memisahkan
                pasangan itu. */}
            <div className="spec-grid spec-grid--rapat spec-grid--dua">
              <div className="field">
                <label className="field__label" htmlFor="brief-budget">Kisaran anggaran</label>
                <InputRupiah id="brief-budget" value={brief.budgetAmount ?? null}
                  onChange={(n) => set("budgetAmount", n)} />
              </div>
              <div className="field">
                <label className="field__label" htmlFor="brief-gaya">Preferensi gaya</label>
                <input id="brief-gaya" className="input" value={brief.stylePreference ?? ""}
                  onChange={(e) => set("stylePreference", e.target.value)} placeholder="Contoh: tropis modern" />
              </div>
              {/* DatePicker, bukan <input type="date">: kolom tanggal bawaan
                  digambar sistem operasi dan mengikuti locale BROWSER, jadi
                  1 September bisa terbaca 09/01/2026 — urutan terbalik yang
                  tidak disadari sampai salah. Di sini bulannya bernama. */}
              <DatePicker
                id="brief-mulai"
                label="Tanggal mulai"
                value={brief.startDate ?? null}
                onChange={(iso) => set("startDate", iso)}
              />
              <DatePicker
                id="brief-selesai"
                label="Tanggal selesai"
                value={brief.endDate ?? null}
                /* Tanggal sebelum mulai tidak bisa dipilih sama sekali.
                   Dijaga juga di API dan database — ini lapis pertama, bukan
                   satu-satunya. */
                minDate={brief.startDate ? new Date(
                  Number(brief.startDate.slice(0, 4)),
                  Number(brief.startDate.slice(5, 7)) - 1,
                  Number(brief.startDate.slice(8, 10)),
                ) : undefined}
                onChange={(iso) => set("endDate", iso)}
              />
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
  const [tugas, setTugas] = useState<Tugas[] | null>(() => bacaCache<Tugas[]>(`tugasproyek:${projectId}`));
  const [tim, setTim] = useState<AnggotaTim[]>([]);
  const [judulBaru, setJudulBaru] = useState("");
  const [penanggungJawab, setPenanggungJawab] = useState("");
  const [sibuk, setSibuk] = useState(false);

  function muat() {
    daftarTugasProyek(projectId).then((d) => { tulisCache(`tugasproyek:${projectId}`, d); setTugas(d); }).catch(() => setTugas((l) => l ?? []));
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
    return <SkeletonKartu ikon="checklist" anak={<SkeletonDaftar jumlah={3} aksi={2} />} />;
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
              <Select
                id="tug-pic"
                ariaLabel="Penanggung jawab"
                value={penanggungJawab || TANPA_PIC}
                onValueChange={(v) => setPenanggungJawab(v === TANPA_PIC ? "" : v)}
                options={[
                  { value: TANPA_PIC, label: "Belum ditentukan" },
                  ...tim.map((t) => ({ value: t.id, label: t.name })),
                ]}
              />
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
        <div className="empty empty--sm buat-kartu">
          <span className="icon-tile"><Icon name="check" size={20} /></span>
          <span className="t-subheading">Belum ada tugas</span>
          <p className="t-muted">Tugas yang ditambahkan di sini juga muncul di List Kerjaan.</p>
        </div>
      ) : (
        <ul className="stack" style={{ gap: "var(--space-2)", listStyle: "none", padding: 0 }}>
          {tugas.map((t) => (
            <li key={t.id} className="item item--bordered">
              <span className="item__text">
                <span className="item__title">{t.title}</span>
                <span className="item__desc">{t.assigneeName ?? "Belum ditentukan"}</span>
              </span>
              <Select
                ringkas
                ariaLabel={`Ubah status ${t.title}`}
                value={t.status}
                onValueChange={(v) => ubahStatusTugas(t.id, v)}
                options={STATUS_TUGAS.map(([value, label]) => ({ value, label }))}
              />
              <AlertDialog
                destructive
                title={`Hapus ${t.title}?`}
                description="Tugas ini akan dihapus dari daftar list kerjaan."
                confirmLabel="Ya, hapus"
                onConfirm={() => hapus(t.id)}
                trigger={
                  <button type="button" className="btn btn--ghost btn--icon btn--hapus" aria-label={`Hapus ${t.title}`}>
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
  const [progres, setProgres] = useState<ProjectProgress | null>(() => bacaCache<ProjectProgress>(`progres:${projectId}`));
  const [judulBaru, setJudulBaru] = useState("");
  const [catatanBaru, setCatatanBaru] = useState("");
  const [sibuk, setSibuk] = useState(false);

  useEffect(() => {
    ambilProgress(projectId).then((d) => { tulisCache(`progres:${projectId}`, d); setProgres(d); }).catch(() => setProgres((l) => l));
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
    return (
      <div className="stack" style={{ gap: "var(--space-5)" }}>
        <SkeletonKartu ikon="clock" anak={<SkeletonIsian jumlah={2} />} />
        <SkeletonDaftar jumlah={3} aksi={1} />
      </div>
    );
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
          {/* --block: fase dibaca sebagai perjalanan dari kiri ke kanan, jadi
              bilahnya harus penuh sampai ujung — bukan menggerombol di kiri
              dengan ruang kosong di kanan. */}
          <div className="segmented segmented--block segmented--tebal" role="group" aria-label="Fase proyek">
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
                    <button type="button" className="btn btn--ghost btn--icon btn--hapus" aria-label={`Hapus catatan ${u.title}`}>
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

export type HalamanProyek = "publik" | "klien" | "internal";

function Isi({ halaman }: { halaman: HalamanProyek }) {
  const toast = useToast();
  const [asli, setAsli] = useState<Proyek | null>(null);
  const [draf, setDraf] = useState<Draf>({});
  const [galat, setGalat] = useState<string | null>(null);
  const [menyimpan, setMenyimpan] = useState(false);
  const [menerbitkan, setMenerbitkan] = useState(false);
  const [id, setId] = useState<string | null>(null);
  const [siapId, setSiapId] = useState(false);
  const berkas = useRef<HTMLInputElement>(null);

  /* Proyek yang sedang dibuka dibaca SEBELUM paint pertama, bukan sesudah.
   *
   * Dua-duanya cuma bisa dilakukan di browser — proyekAktif() membaca
   * localStorage dan cache-nya sessionStorage — jadi keduanya tidak boleh
   * masuk ke nilai awal useState: HTML yang dipanggang Astro tidak tahu isi
   * penyimpanan, dan bedanya akan jadi ketidakcocokan hidrasi.
   *
   * useLayoutEffect menyelesaikan keduanya: ia berjalan setelah hidrasi tapi
   * SEBELUM browser melukis, jadi frame pertama yang sampai ke mata sudah
   * berisi proyeknya. Dengan useEffect biasa, halaman ini sempat melukis
   * skeleton dulu — terukur 10 dari 26 frame pada kunjungan kedua, padahal
   * datanya sudah ada di cache. */
  useEfekTataLetak(() => {
    const aktif = proyekAktif();
    setId(aktif);
    setSiapId(true);

    // Daftar proyek yang tersimpan dipakai langsung — kunci "proyek" yang
    // sama dengan halaman Semua Proyek dan Dashboard, karena memang daftar
    // yang sama.
    if (aktif) {
      const dariCache = bacaCache<Proyek[]>("proyek")?.find((x) => x.id === aktif);
      if (dariCache) setAsli(dariCache);
    }

    // Combobox di topbar menulis ke tempat yang sama. Berlangganan membuat
    // halaman ini ikut berganti isi tanpa dimuat ulang.
    return onProyekAktif((baru) => {
      setId(baru);
      setDraf({});
      setGalat(null);
      const dariCache = bacaCache<Proyek[]>("proyek")?.find((x) => x.id === baru);
      setAsli(dariCache ?? null);
    });
  }, []);

  useEffect(() => {
    if (!siapId || !id) return;
    let batal = false;

    daftarProyek()
      .then((semua) => {
        if (batal) return;
        tulisCache("proyek", semua);
        const p = semua.find((x) => x.id === id);
        if (!p) { setGalat("Proyek tidak ditemukan. Mungkin sudah dihapus."); return; }
        setAsli(p);
      })
      .catch((e) => {
        // Yang sudah tampil dari cache dibiarkan: jaringan putus sesaat tidak
        // boleh mengganti halaman yang sudah terisi dengan pesan galat.
        if (!batal) setAsli((lama) => { if (!lama) setGalat((e as Error).message); return lama; });
      });

    return () => { batal = true; };
  }, [id, siapId]);

  // Hanya field yang benar-benar berubah yang dikirim. Selain lebih hemat, ini
  // menghindarkan dua orang yang menyunting bersamaan saling menimpa kolom
  // yang tidak mereka sentuh.
  const berubah = Object.keys(draf).filter((k) => draf[k as keyof Draf] !== asli?.[k as keyof Proyek]);
  const adaPerubahan = berubah.length > 0;

  // Menahan perpindahan selama masih ada yang belum disimpan.
  useCegahPindah(adaPerubahan);

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

  /* Situs publik dibekukan saat build, jadi menerbitkan proyek di sini tidak
     mengubah apa pun sampai ada build ulang. Ini tombolnya. */
  async function bangunUlangSitus() {
    setMenerbitkan(true);
    try {
      await terbitkanSitus();
      toast({
        judul: "Situs sedang dibangun ulang",
        keterangan: "Sekitar satu menit lagi perubahan tampil di situs publik.",
        nada: "sukses",
      });
    } catch (e) {
      toast({ judul: "Gagal menerbitkan", keterangan: (e as Error).message, nada: "gagal" });
    } finally {
      setMenerbitkan(false);
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

  if (siapId && !id) {
    return (
      <div className="empty">
        <span className="icon-tile"><Icon name="project" size={22} /></span>
        <h2 className="t-heading">Belum ada proyek yang dibuka</h2>
        <p className="t-muted">
          Pilih satu lewat kotak <strong>Cari proyek</strong> di bilah atas, atau dari daftar
          semua proyek. Halaman ini lalu mengikuti proyek itu sampai Anda memilih yang lain.
        </p>
        <a className="btn btn--primary" href="/admin/proyek">Buka daftar proyek</a>
      </div>
    );
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
    return (
      <div className="stack" style={{ gap: "var(--space-5)" }}>
        <Balok tinggi="3rem" style={{ borderRadius: "var(--radius-pill)" }} />
        <SkeletonKartu ikon="project" anak={<SkeletonIsian jumlah={4} />} />
        <SkeletonDaftar jumlah={2} aksi={2} />
      </div>
    );
  }

  const detail = (
    <div className="stack proyek-kartu">
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
      <div className="spec-grid spec-grid--rapat">
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
    <div className="stack proyek-kartu">
      {/* Cover dipasang sebagai pratinjau kecil di samping keterangannya,
          bukan gambar selebar kartu: yang perlu dilihat di sini cuma "cover-
          nya yang mana", dan gambar 16:9 selebar kartu mendorong seluruh
          galeri keluar layar sebelum sempat terlihat. */}
      <div className="cover-baris">
        <div className="cover-baris__gambar">
          {nilai("coverImageUrl") ? (
            <img src={String(nilai("coverImageUrl"))} alt={`Cover ${asli.title}`} />
          ) : nilai("coverImageKey" as keyof Proyek) ? (
            <span className="cover-baris__catatan">Belum disimpan</span>
          ) : (
            <Icon name="image" size={22} />
          )}
        </div>

        <div className="cover-baris__teks">
          <span className="t-subheading">Gambar sampul</span>
          <span className="t-muted">
            {nilai("coverImageUrl") || nilai("coverImageKey" as keyof Proyek)
              ? "Dipakai sebagai gambar utama proyek di situs publik."
              : "Proyek tidak bisa diterbitkan tanpa cover."}
          </span>
        </div>

        <input ref={berkas} type="file" className="sr-only"
          accept="image/jpeg,image/png,image/webp,image/avif"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) unggah(f); }} />
        <button type="button" className="btn btn--secondary btn--sm cover-baris__aksi"
          onClick={() => berkas.current?.click()}>
          <Icon name="upload" size={15} />
          {nilai("coverImageUrl") || nilai("coverImageKey" as keyof Proyek) ? "Ganti" : "Unggah"}
        </button>
      </div>

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

      <span className="separator" role="presentation" />

      {/* Material di kartu yang sama dengan galeri, bukan tab tersendiri:
          keduanya foto proyek yang diunggah berurutan dalam satu duduk, dan
          tab keempat memaksa staf mengingat bahwa material ada. */}
      <div className="row" style={{ gap: "var(--space-3)", alignItems: "flex-start" }}>
        <span className="icon-tile"><Icon name="component" size={20} /></span>
        <span className="card__titles">
          <span className="t-subheading">Material yang dipakai</span>
          <span className="t-muted">Bahan yang membentuk proyek ini — beri nama tiap fotonya.</span>
        </span>
      </div>

      <PanelGaleri proyek={asli} jenis="material" />
    </div>
  );

  const seo = (
    <div className="stack proyek-kartu">
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

  /* Panel kanan yang menempel, sama seperti di halaman Tambah Proyek. Isinya
     menjawab satu pertanyaan yang sebelumnya tidak dijawab di mana pun:
     "proyek mana yang sedang saya ubah?" — dan di halaman Klien serta
     Internal, itu satu-satunya tempat jawabannya bisa dibaca. */
  const sisi = (aksi?: ReactNode) => (
    <aside className="buatpage__aksi">
      <section className="buat-kartu sisi-proyek">
        <h2 className="buat-kartu__judul">Proyek yang dibuka</h2>
        <div className="sisi-proyek__kepala">
          <span className="sisi-proyek__sampul">
            {asli.coverImageUrl
              ? <img src={asli.coverImageUrl} alt="" />
              : <Icon name="image" size={18} />}
          </span>
          <span className="card__titles">
            <span className="t-subheading">{asli.title}</span>
            <span className="t-muted">{KATEGORI[String(asli.category)] ?? asli.category}</span>
          </span>
        </div>

        <dl className="sisi-proyek__fakta">
          <div>
            <dt>Status terbit</dt>
            <dd>
              <span className={`badge ${BADGE_STATUS[String(nilai("status"))] ?? ""}`}>
                <span className="badge__dot" />
                {LABEL_STATUS[String(nilai("status"))] ?? String(nilai("status"))}
              </span>
            </dd>
          </div>
          <div>
            <dt>Tahap pipeline</dt>
            <dd>
              <span className="badge badge--info">
                {PIPELINE.find(([t]) => t === nilai("pipelineStage"))?.[1] ?? "Belum ditentukan"}
              </span>
            </dd>
          </div>
        </dl>

        {nilai("status") === "published" && (
          <a className="btn btn--ghost btn--sm sisi-proyek__tautan"
            href={`/proyek/${asli.slug}`} target="_blank" rel="noreferrer">
            <Icon name="globe" size={15} />Lihat di situs
          </a>
        )}
      </section>

      {aksi}
    </aside>
  );

  if (halaman === "publik") {
    return (
      <div className="buatpage">
        <div className="buatpage__utama">
          <section className="buat-kartu">
            <h2 className="buat-kartu__judul">Status terbit</h2>
            <p className="t-muted" style={{ margin: 0, fontSize: "var(--text-sm)" }}>
              {bisaTerbit
                ? "Proyek siap diterbitkan."
                : "Unggah cover dulu sebelum menerbitkan."}
            </p>
            {/* Menyamping, bukan bertumpuk: ketiganya saling meniadakan dan
                sama pentingnya, jadi berjajar membuat perbandingannya terbaca
                sekali lihat. Ikonnya dipilih supaya cocok maknanya dengan
                labelnya — pensil untuk yang masih ditulis, bola dunia untuk
                yang sudah dilihat orang, kotak arsip untuk yang disimpan. */}
            <div className="statuspilih">
              {[
                { v: "draft", t: "Draf", d: "Hanya terlihat oleh staf studio.", i: "edit" as const },
                { v: "published", t: "Terbit", d: "Tampil di situs setelah build berikutnya.", i: "globe" as const },
                { v: "archived", t: "Arsip", d: "Disembunyikan tanpa dihapus.", i: "archive" as const },
              ].map((s) => (
                <label className="radio-card statuspilih__kartu" key={s.v}>
                  <input type="radio" name="ed-status" checked={nilai("status") === s.v}
                    disabled={s.v === "published" && !bisaTerbit}
                    onChange={() => set("status", s.v)} />
                  <span className="statuspilih__ikon"><Icon name={s.i} size={18} /></span>
                  <span className="radio-card__body">
                    <span className="radio-card__title">{s.t}</span>
                    <span className="radio-card__desc">{s.d}</span>
                  </span>
                </label>
              ))}
            </div>

            {/* Di LUAR grid status: ini pilihan lain yang berdiri sendiri —
                sebuah proyek bisa terbit tanpa jadi unggulan. Di dalam grid
                ia jadi kolom keempat yang seolah bagian dari pilihan status. */}
            <label className="choice" style={{ marginTop: "var(--space-4)" }}>
              <input type="checkbox" checked={Boolean(nilai("isFeatured"))}
                onChange={(e) => set("isFeatured", e.target.checked)} />
              <span className="choice__text">
                <span>Tampilkan di beranda</span>
                <span className="choice__desc">Proyek unggulan muncul di halaman depan.</span>
              </span>
            </label>
          </section>

          <Tabs
            items={[
              { id: "detail", label: "Detail", content: detail },
              { id: "galeri", label: "Galeri", content: galeri },
              { id: "seo", label: "SEO", content: seo },
            ]}
          />
        </div>

        {sisi(
          <>
            <button type="button" className="btn btn--primary btn--lift buat-aksi__utama"
              disabled={!adaPerubahan || menyimpan} onClick={simpan}>
              {menyimpan && <span className="spinner spinner--sm spinner--on-action" />}
              <Icon name="check" size={16} />Simpan perubahan
            </button>
            {adaPerubahan ? (
              <span className="marker marker--warn buat-aksi__reset">
                <span className="marker__dot" />{berubah.length} perubahan belum disimpan
              </span>
            ) : (
              <span className="marker marker--success buat-aksi__reset">
                <span className="marker__dot" />Semua perubahan tersimpan
              </span>
            )}

            <span className="separator" role="presentation" />

            {/* Menyimpan menulis ke database; MENERBITKAN membangun ulang
                situs publik. Dua hal berbeda, jadi dua tombol berbeda —
                dipisah garis supaya tidak terbaca sebagai satu urutan. */}
            <button type="button" className="btn btn--secondary buat-aksi__utama"
              disabled={menerbitkan} onClick={bangunUlangSitus}>
              {menerbitkan && <span className="spinner spinner--sm" />}
              <Icon name="globe" size={16} />Terbitkan situs
            </button>
            <p className="t-muted buat-aksi__catatan">
              Halaman publik dibekukan saat dibangun. Tekan ini setelah selesai
              mengubah konten — sekitar satu menit sampai tampil.
            </p>
          </>,
        )}
      </div>
    );
  }

  if (halaman === "klien") {
    return (
      <div className="buatpage">
        <div className="buatpage__utama">
          <Tabs
            items={[
              { id: "brief", label: "Brief", content: <PanelBrief projectId={asli.id} /> },
              { id: "dokumen", label: "Dokumen", content: <PanelDokumen proyek={asli} /> },
              { id: "progres", label: "Progres", content: <PanelProgres projectId={asli.id} /> },
            ]}
          />
        </div>
        {sisi(
          <p className="t-muted buat-aksi__catatan">
            Semua isian di halaman ini tersimpan seketika — tidak ada tombol simpan.
          </p>,
        )}
      </div>
    );
  }

  return (
    <div className="buatpage">
      <div className="buatpage__utama">
        <section className="buat-kartu">
          <h2 className="buat-kartu__judul">Tahap pipeline</h2>
          <p className="t-muted" style={{ margin: 0, fontSize: "var(--text-sm)" }}>
            Alur kerja internal studio — beda dari status terbit di Halaman Publik.
          </p>
          <div className="segmented segmented--block segmented--tebal" role="group" aria-label="Tahap pipeline">
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
        </section>

        <Tabs
          items={[
            { id: "tugas", label: "Tugas", content: <PanelTugas projectId={asli.id} /> },
            {
              id: "keuangan",
              label: "Keuangan",
              content: (
                <PanelKeuangan
                  proyek={asli}
                  onUbahKontrak={(v) => setAsli((a) => (a ? { ...a, contractValue: v } : a))}
                />
              ),
            },
          ]}
        />
      </div>
      {sisi(
        <p className="t-muted buat-aksi__catatan">
          Tahap, tugas, dan angka keuangan tersimpan seketika saat diubah.
        </p>,
      )}
    </div>
  );
}

/**
 * Satu panel, tiga halaman. Pembagiannya menurut SIAPA yang melihat hasilnya:
 *
 *   publik   — Detail, Galeri, SEO, status terbit: yang dilihat pengunjung situs
 *   klien    — Brief, Dokumen, Progres: yang dilihat klien proyek ini
 *   internal — Tahap pipeline, Tugas, Keuangan: yang hanya dilihat studio
 *
 * Bukan dibagi menurut jenis datanya, karena pertanyaan yang benar-benar
 * muncul saat mengubah sesuatu adalah "kalau saya ubah ini, siapa yang
 * lihat?" — dan pembagian ini yang menjawabnya tanpa perlu diingat.
 */
export function ProyekPanel({ halaman }: { halaman: HalamanProyek }) {
  return (
    <RequireAuth skeleton={
      <div className="stack" style={{ gap: "var(--space-5)" }}>
        <Balok tinggi="3rem" style={{ borderRadius: "var(--radius-pill)" }} />
        <SkeletonKartu ikon="project" anak={<SkeletonIsian jumlah={4} />} />
        <SkeletonDaftar jumlah={2} aksi={2} />
      </div>
    }>
      {/* Pembungkus .proyekpage yang membuat halaman ini memakai bahasa visual
          yang sama dengan Tambah Proyek: badan halaman ABU, kartu dan isian
          HITAM berbingkai tebal, judul dipisah garis tebal dari isinya. */}
      <ToastProvider><div className="proyekpage"><Isi halaman={halaman} /></div></ToastProvider>
    </RequireAuth>
  );
}
