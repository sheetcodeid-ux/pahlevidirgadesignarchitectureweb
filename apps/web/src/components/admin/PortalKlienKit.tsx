import { useEffect, useRef, useState } from "react";
import { RequireAuth } from "./RequireAuth";
import { ToastProvider, useToast } from "../ui/overlay/Toast";
import { AlertDialog } from "../ui/overlay/Dialog";
import { Icon } from "../ui/Icon";
import { Tombol } from "../kit/Tombol";
import { Isian } from "../kit/Isian";
import { Segmen } from "../kit/Segmen";
import { BarisAktivitas, Gelembung } from "../kit/Item";
import { Ikon } from "../kit/Ikon";
import { CaretDown, CopySimple, FilePdf, FileText, Globe, Note, Trash } from "../kit/ikon";
import { PemutarSuaraKit, PerekamSuaraKit } from "../kit/Suara";
import { formatDurasi } from "../ui/misc/VoiceNote";
import { usePilihProyek, JudulPilihProyek } from "./pilihProyekKit";
import {
  ambilBrief,
  ubahBrief,
  daftarDokumen,
  tambahDokumen,
  ubahDokumen,
  hapusDokumen,
  daftarKomentarDokumen,
  tambahKomentarDokumen,
  ambilProgress,
  ubahFaseProgress,
  buatUlangTokenProgress,
  tambahCatatanProgress,
  hapusCatatanProgress,
  mintaUrlUnggah,
  bacaCache,
  tulisCache,
  MAKS_BYTE_DOKUMEN,
  type Proyek,
  type BriefProyek,
  type DokumenProyek,
  type KomentarDokumen,
  type ProjectProgress,
} from "../../lib/admin";
import { useCegahPindah } from "../../lib/cegahPindah";
import { bukaLightbox } from "../../lib/lightbox";

/* =============================================================================
   Portal Klien — semua yang dilihat klien lewat tautan /progres?t=…

   Tidak punya frame di Coinest. Kerangkanya frame "34. Promo Details" yang
   sama dengan Halaman Publik: judul-pemilih proyek, badan dua kolom (isi 724
   / samping 210), tanpa bidang besar di atas — portal klien tidak punya
   sampul. Kolom sampingnya TAUTAN portal itu sendiri, karena itulah yang
   paling sering dicari di halaman ini: tautannya disalin lalu dikirim lewat
   WhatsApp.

   Yang berubah dari kerangka lama, dan alasannya:

   - Fase jadi pita enam langkah, bukan tombol bersegmen. Klien melihat fase
     sebagai "Tahap 3 dari 6" berikut langkah-langkah sebelumnya, jadi staf
     yang mengubahnya harus melihat bentuk yang sama.
   - Komentar dokumen memakai gelembung obrolan kit (frame 28): balasan
     studio di kanan, klien di kiri — terbaca sebagai percakapan, bukan
     daftar.
   - Brief sekarang benar-benar MENYIMPAN anggaran dan kedua tanggalnya.
     Panel lama menampilkan ketiganya tapi tidak pernah mengirimnya: staf
     mengetik, menekan Simpan, melihat "Brief disimpan", dan angkanya hilang
     saat halaman dimuat ulang.

   Fase, dokumen, dan kabar tersimpan seketika; cuma brief yang punya tombol
   Simpan, karena ia formulir panjang yang diketik bertahap.
   ============================================================================= */

/* Sama persis dengan allowlist R2 di Worker API. Kalau berbeda, staf bisa
   memilih berkas yang lalu ditolak saat diunggah — dan penolakannya datang
   dari penyimpanan, bukan dari halaman ini. */
const TIPE_SAH = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "audio/mpeg",
  "audio/mp4",
  "audio/webm",
  "audio/ogg",
];
const TIPE_DOKUMEN = TIPE_SAH.join(",");

/* Urutan dan nama sama dengan yang dilihat klien di /progres. */
const FASE: [string, string][] = [
  ["konsultasi", "Konsultasi"],
  ["konsep", "Konsep"],
  ["ded", "DED"],
  ["perizinan", "Perizinan"],
  ["konstruksi", "Konstruksi"],
  ["selesai", "Selesai"],
];

/* Warna titik status mengikuti aturan warna situs: amber = menunggu pihak
   lain, merah = perlu tindakan, hijau = beres, abu = belum dikirim. */
const STATUS_DOKUMEN: Record<string, { label: string; nada: string }> = {
  draft: { label: "Draf", nada: "netral" },
  menunggu_klien: { label: "Menunggu klien", nada: "tunggu" },
  revisi_diminta: { label: "Revisi diminta", nada: "tindak" },
  disetujui: { label: "Disetujui", nada: "beres" },
  final: { label: "Final", nada: "beres" },
};

type Tab = "brief" | "dokumen" | "kabar";

const tanggal = (iso: string) =>
  new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
const tanggalJam = (iso: string) =>
  new Date(iso).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

function ukuranBerkas(b: number): string {
  if (b >= 1_048_576) return `${(b / 1_048_576).toFixed(1).replace(".", ",")} MB`;
  return `${Math.max(1, Math.round(b / 1024))} KB`;
}

/** "DED Rev.2.pdf" → "DED Rev.2". Mengetik judul sepuluh kali untuk sepuluh
 *  berkas bukan alur yang masuk akal. */
function judulDariNama(nama: string): string {
  const titik = nama.lastIndexOf(".");
  const dasar = titik > 0 ? nama.slice(0, titik) : nama;
  return dasar.trim().slice(0, 120) || nama;
}

function Isi() {
  const { semua, asli, galat, id, pilih } = usePilihProyek();

  if (galat) return <p className="pf__kosong">Gagal memuat proyek: {galat}</p>;
  if (!semua) return <div className="pas pas--rangka" aria-busy="true" />;
  if (!asli) {
    return (
      <div className="pas">
        <p className="pf__kosong">
          {id ? "Proyek ini tidak ditemukan — mungkin sudah dihapus." : "Belum ada proyek."}{" "}
          <a href="/admin/proyek">Buka Semua Proyek</a>
        </p>
      </div>
    );
  }
  /* `key`: berpindah proyek memasang ulang seluruh portal, jadi tidak ada
     sisa brief, dokumen, atau kabar proyek sebelumnya yang sempat tergambar
     di bawah judul proyek yang baru. */
  return <Portal key={asli.id} proyek={asli} semua={semua} onPilih={pilih} />;
}

function Portal({ proyek, semua, onPilih }: { proyek: Proyek; semua: Proyek[]; onPilih: (id: string) => void }) {
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("brief");
  const [brief, setBrief] = useState<BriefProyek | null>(() => bacaCache<BriefProyek>(`brief:${proyek.id}`));
  const [dokumen, setDokumen] = useState<DokumenProyek[] | null>(() =>
    bacaCache<DokumenProyek[]>(`dokumen:${proyek.id}`),
  );
  const [progres, setProgres] = useState<ProjectProgress | null>(() =>
    bacaCache<ProjectProgress>(`progres:${proyek.id}`),
  );
  const [briefBerubah, setBriefBerubah] = useState(0);

  useEffect(() => {
    ambilBrief(proyek.id)
      .then((d) => {
        tulisCache(`brief:${proyek.id}`, d);
        setBrief(d);
      })
      .catch(() => setBrief((l) => l ?? {}));
    muatDokumen();
    ambilProgress(proyek.id)
      .then((d) => {
        tulisCache(`progres:${proyek.id}`, d);
        setProgres(d);
      })
      .catch((e) => toast({ judul: "Gagal memuat progres", keterangan: (e as Error).message, nada: "gagal" }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proyek.id]);

  function muatDokumen() {
    daftarDokumen(proyek.id)
      .then((d) => {
        tulisCache(`dokumen:${proyek.id}`, d);
        setDokumen(d);
      })
      .catch(() => setDokumen((l) => l ?? []));
  }

  function gantiProyek(baru: string) {
    if (baru === proyek.id) return;
    if (briefBerubah > 0 && !confirm(`Ada ${briefBerubah} perubahan brief yang belum disimpan. Tinggalkan?`)) return;
    onPilih(baru);
  }

  const tautan = progres ? `${import.meta.env.PUBLIC_SITE_URL || location.origin}/progres?t=${progres.accessToken}` : "";
  const menunggu = dokumen?.filter((d) => d.status === "menunggu_klien").length ?? 0;
  const revisi = dokumen?.filter((d) => d.status === "revisi_diminta").length ?? 0;
  const faseKe = progres ? Math.max(0, FASE.findIndex(([v]) => v === progres.phase)) : -1;

  async function salin() {
    try {
      await navigator.clipboard.writeText(tautan);
      toast({ judul: "Tautan disalin", keterangan: "Tempel ke WhatsApp atau email klien.", nada: "sukses" });
    } catch {
      toast({ judul: "Tidak bisa menyalin otomatis", keterangan: tautan, nada: "netral" });
    }
  }

  async function buatUlang() {
    if (!progres) return;
    try {
      const { accessToken } = await buatUlangTokenProgress(proyek.id);
      setProgres({ ...progres, accessToken });
      toast({ judul: "Tautan baru dibuat", keterangan: "Tautan lama sudah tidak berlaku.", nada: "sukses" });
    } catch (e) {
      toast({ judul: "Gagal membuat tautan baru", keterangan: (e as Error).message, nada: "gagal" });
    }
  }

  async function ubahFase(fase: string) {
    if (!progres || fase === progres.phase) return;
    const sebelum = progres.phase;
    setProgres({ ...progres, phase: fase });
    try {
      await ubahFaseProgress(proyek.id, fase);
    } catch (e) {
      setProgres((p) => (p ? { ...p, phase: sebelum } : p));
      toast({ judul: "Gagal mengubah fase", keterangan: (e as Error).message, nada: "gagal" });
    }
  }

  return (
    <div className="pas pk">
      <div className="pas__badan">
        <div className="pas__utama pf__utama">
          <div className="pas__judulbaris">
            <JudulPilihProyek semua={semua} asli={proyek} onPilih={gantiProyek} />
          </div>

          {/* ---- Fase ---------------------------------------------------- */}
          <section className="pf__bagian" aria-labelledby="pk-fase">
            <div className="pk__kepala">
              <h3 className="pf__subjudul" id="pk-fase">
                Fase proyek
              </h3>
              {progres && (
                <span className="pk__ke">
                  Tahap {faseKe + 1} dari {FASE.length}
                </span>
              )}
            </div>
            <ol className="pk__fase" aria-busy={!progres || undefined}>
              {FASE.map(([nilai, label], i) => (
                <li key={nilai}>
                  <button
                    type="button"
                    aria-pressed={i === faseKe}
                    data-lewat={(progres && i < faseKe) || undefined}
                    disabled={!progres}
                    onClick={() => ubahFase(nilai)}
                  >
                    <span className="pk__fasebar" aria-hidden="true" />
                    <span className="pk__fasenama">{label}</span>
                  </button>
                </li>
              ))}
            </ol>
            <p className="pf__statusket">Klien melihat fase ini di bagian atas portalnya. Tersimpan seketika.</p>
          </section>

          <Segmen
            judul="Isi portal klien"
            className="pf__tab"
            nilai={tab}
            onPilih={(v) => setTab(v as Tab)}
            segmen={[
              { nilai: "brief", label: briefBerubah > 0 ? "Brief •" : "Brief" },
              { nilai: "dokumen", label: dokumen ? `Dokumen (${dokumen.length})` : "Dokumen" },
              { nilai: "kabar", label: progres ? `Kabar (${progres.updates.length})` : "Kabar" },
            ]}
          />

          {/* Ketiga panel tetap terpasang; yang disembunyikan cuma tampilannya
              — supaya brief yang setengah diketik tidak hilang karena staf
              melirik tab Dokumen. */}
          <div hidden={tab !== "brief"}>
            {brief ? (
              <PanelBrief projectId={proyek.id} brief={brief} onTersimpan={setBrief} onBerubah={setBriefBerubah} />
            ) : (
              <p className="pf__fotoket">Memuat brief…</p>
            )}
          </div>
          <div hidden={tab !== "dokumen"}>
            <PanelDokumen proyek={proyek} dokumen={dokumen} setDokumen={setDokumen} muat={muatDokumen} />
          </div>
          <div hidden={tab !== "kabar"}>
            <PanelKabar projectId={proyek.id} progres={progres} setProgres={setProgres} />
          </div>
        </div>

        {/* ---- Kolom samping: tautan portal ------------------------------- */}
        <aside className="pf__samping" aria-label="Tautan portal klien">
          <div className="pf__info">
            <p className="pas__sampingjudul">Tautan portal</p>
            <p className="pk__tautan">{tautan || "Memuat…"}</p>
            <Tombol ukuran="large" jenis="primary" kiri={CopySimple} disabled={!tautan} onClick={salin}>
              Salin tautan
            </Tombol>
            {tautan && (
              <a className="pf__tautan" href={tautan} target="_blank" rel="noreferrer">
                <Ikon ikon={Globe} ukuran={14} />
                Buka seperti klien
              </a>
            )}
            <dl className="pf__fakta">
              <div>
                <dt>Brief</dt>
                <dd>{brief?.submittedAt ? `Dikirim klien ${tanggal(brief.submittedAt)}` : "Belum diisi klien"}</dd>
              </div>
              <div>
                <dt>Dokumen</dt>
                <dd>
                  {dokumen === null
                    ? "…"
                    : dokumen.length === 0
                      ? "Belum ada"
                      : `${dokumen.length} dokumen${menunggu ? ` · ${menunggu} menunggu klien` : ""}`}
                </dd>
              </div>
              {revisi > 0 && (
                <div>
                  <dt>Revisi diminta</dt>
                  <dd className="pk__tindak">{revisi} dokumen</dd>
                </div>
              )}
              <div>
                <dt>Kabar terakhir</dt>
                <dd>{progres?.updates[0] ? tanggal(progres.updates[0].createdAt) : "Belum ada"}</dd>
              </div>
            </dl>
          </div>

          <div className="pk__ulang">
            <AlertDialog
              destructive
              title="Buat tautan baru?"
              description="Tautan lama langsung berhenti bekerja. Klien yang masih memegangnya harus dikirimi tautan yang baru."
              confirmLabel="Ya, buat baru"
              onConfirm={buatUlang}
              trigger={
                <button type="button" className="pas__hapus pf__hapus" disabled={!progres}>
                  Buat ulang tautan
                </button>
              }
            />
            <p className="pf__statusket">Pakai kalau tautan lama telanjur sampai ke orang yang salah.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}

/* --- Brief ---------------------------------------------------------------- */

type KunciBrief = "budgetAmount" | "stylePreference" | "startDate" | "endDate" | "requirements" | "internalNotes";
const KUNCI_BRIEF: KunciBrief[] = [
  "budgetAmount",
  "stylePreference",
  "startDate",
  "endDate",
  "requirements",
  "internalNotes",
];
/* "" dan null sama-sama "kosong" — tanpa ini, mengetik lalu menghapus satu
   huruf terhitung sebagai perubahan. */
const kosongkan = (v: unknown) => (v === "" || v === undefined ? null : v);

function PanelBrief({
  projectId,
  brief,
  onTersimpan,
  onBerubah,
}: {
  projectId: string;
  brief: BriefProyek;
  onTersimpan: (b: BriefProyek) => void;
  onBerubah: (n: number) => void;
}) {
  const toast = useToast();
  const [draf, setDraf] = useState<Partial<Pick<BriefProyek, KunciBrief>>>({});
  const [menyimpan, setMenyimpan] = useState(false);

  const nilai = <K extends KunciBrief>(k: K) => (k in draf ? draf[k] : brief[k]) as BriefProyek[K];
  const berubah = KUNCI_BRIEF.filter((k) => k in draf && kosongkan(draf[k]) !== kosongkan(brief[k]));
  const n = berubah.length;
  useCegahPindah(n > 0);
  useEffect(() => onBerubah(n), [n, onBerubah]);

  const set = <K extends KunciBrief>(k: K, v: BriefProyek[K]) => setDraf((d) => ({ ...d, [k]: v }));
  const mulai = nilai("startDate") ?? "";
  const selesai = nilai("endDate") ?? "";
  /* Dijaga juga di API dan database — ini lapis pertama, supaya penolakan
     datang sebagai kalimat, bukan galat Postgres. */
  const tanggalTerbalik = Boolean(mulai && selesai && selesai < mulai);
  const alasan = tanggalTerbalik ? "Tanggal selesai mendahului tanggal mulai." : null;

  async function simpan() {
    if (n === 0 || tanggalTerbalik) return;
    setMenyimpan(true);
    try {
      /* Hanya yang berubah — brief juga diisi KLIEN dari portalnya, dan
         mengirim ulang semua kolom akan menimpa isian klien yang masuk
         selagi staf mengetik. */
      const patch: Partial<BriefProyek> = {};
      for (const k of berubah) (patch as Record<string, unknown>)[k] = kosongkan(draf[k]);
      await ubahBrief(projectId, patch);
      onTersimpan({ ...brief, ...patch });
      setDraf({});
      toast({ judul: "Brief disimpan", nada: "sukses" });
    } catch (e) {
      toast({ judul: "Gagal menyimpan brief", keterangan: (e as Error).message, nada: "gagal" });
    } finally {
      setMenyimpan(false);
    }
  }

  const anggaran = nilai("budgetAmount");
  /* Isian bentuk lama (teks bebas) masih dikirim API untuk brief yang
     diisi sebelum formulirnya berubah. Tidak bisa disunting lagi, tapi juga
     tidak boleh hilang dari pandangan. */
  const lama = [
    brief.budgetRange && `anggaran “${brief.budgetRange}”`,
    brief.timeline && `jadwal “${brief.timeline}”`,
  ].filter(Boolean);

  return (
    <div className="pas__form">
      <p className="pk__keadaan" data-ada={brief.submittedAt ? "" : undefined}>
        <span aria-hidden="true" />
        {brief.submittedAt
          ? `Dikirim klien ${tanggal(brief.submittedAt)}. Perubahan di sini ikut terlihat di portalnya.`
          : "Klien belum mengisi brief lewat portalnya — staf bisa mengisikannya di sini."}
      </p>

      <div className="pas__kisi">
        <Isian
          label="Kisaran anggaran (Rp)"
          inputMode="numeric"
          placeholder="0"
          value={anggaran == null ? "" : anggaran.toLocaleString("id-ID")}
          onChange={(e) => {
            const angka = e.currentTarget.value.replace(/\D/g, "");
            set("budgetAmount", angka ? Number(angka) : null);
          }}
        />
        <Isian
          label="Preferensi gaya"
          placeholder="mis. tropis modern"
          value={nilai("stylePreference") ?? ""}
          onChange={(e) => set("stylePreference", e.currentTarget.value)}
        />
        <Isian
          label="Tanggal mulai"
          type="date"
          value={mulai}
          onChange={(e) => set("startDate", e.currentTarget.value || null)}
        />
        <Isian
          label="Tanggal selesai"
          type="date"
          min={mulai || undefined}
          className={tanggalTerbalik ? "pf__peringatan" : undefined}
          bantu={tanggalTerbalik ? "Mendahului tanggal mulai." : undefined}
          value={selesai}
          onChange={(e) => set("endDate", e.currentTarget.value || null)}
        />
      </div>
      <label className="k-isian pas__lebar">
        <span className="k-isian__label">Kebutuhan ruang dan fungsi</span>
        <textarea
          className="pas__area"
          rows={4}
          placeholder="mis. 3 kamar tidur, ruang kerja, carport 2 mobil"
          value={nilai("requirements") ?? ""}
          onChange={(e) => set("requirements", e.currentTarget.value)}
        />
      </label>
      {lama.length > 0 && <p className="pf__catatan">Isian bentuk lama dari klien: {lama.join(", ")}.</p>}

      <label className="k-isian pas__lebar">
        <span className="k-isian__label">Catatan internal</span>
        <textarea
          className="pas__area"
          rows={3}
          placeholder="mis. sudah ditelepon, minta contoh referensi tambahan"
          value={nilai("internalNotes") ?? ""}
          onChange={(e) => set("internalNotes", e.currentTarget.value)}
        />
        <span className="k-isian__bantu">Hanya terlihat staf — tidak pernah tampil di portal klien.</span>
      </label>

      <div className="pas__aksi">
        <Tombol ukuran="large" jenis="primary" disabled={n === 0 || tanggalTerbalik || menyimpan} onClick={simpan}>
          {menyimpan ? "Menyimpan…" : "Simpan brief"}
        </Tombol>
        {n > 0 && (
          <Tombol ukuran="large" jenis="ghost" disabled={menyimpan} onClick={() => setDraf({})}>
            Batalkan perubahan
          </Tombol>
        )}
        <p className={`pf__penanda${n > 0 ? " pf__penanda--belum" : ""}`}>
          <span aria-hidden="true" />
          {alasan ?? (n > 0 ? `${n} perubahan belum disimpan` : "Semua perubahan tersimpan")}
        </p>
      </div>
    </div>
  );
}

/* --- Dokumen -------------------------------------------------------------- */

function PanelDokumen({
  proyek,
  dokumen,
  setDokumen,
  muat,
}: {
  proyek: Proyek;
  dokumen: DokumenProyek[] | null;
  setDokumen: React.Dispatch<React.SetStateAction<DokumenProyek[] | null>>;
  muat: () => void;
}) {
  const toast = useToast();
  const [judul, setJudul] = useState("");
  const [antre, setAntre] = useState<{ selesai: number; total: number } | null>(null);
  const [diseret, setDiseret] = useState(false);
  const pilihBerkas = useRef<HTMLInputElement>(null);
  const mengunggah = antre !== null;

  /** Satu berkas: minta URL → PUT langsung ke penyimpanan → catat barisnya. */
  async function unggahSatu(f: File, j: string) {
    const target = await mintaUrlUnggah(proyek.slug, f.type);
    const res = await fetch(target.uploadUrl, { method: "PUT", headers: { "Content-Type": f.type }, body: f });
    if (!res.ok) throw new Error(`Penyimpanan menolak berkas (${res.status})`);
    await tambahDokumen(proyek.id, {
      title: j,
      fileKey: target.key,
      kind: "berkas",
      fileName: f.name,
      fileSize: f.size,
      mimeType: f.type,
    });
  }

  async function unggahBanyak(daftar: File[]) {
    if (daftar.length === 0 || mengunggah) return;
    /* Yang kebesaran dilewati, bukan membatalkan antrean: kalau sembilan
       dari sepuluh sah, sembilan itu tetap naik. */
    const kebesaran = daftar.filter((f) => f.size > MAKS_BYTE_DOKUMEN);
    const sah = daftar.filter((f) => f.size <= MAKS_BYTE_DOKUMEN && TIPE_SAH.includes(f.type));
    const ditolak = daftar.length - sah.length - kebesaran.length;
    if (kebesaran.length > 0) {
      toast({
        judul:
          kebesaran.length === 1 ? `“${kebesaran[0].name}” lebih dari 100 MB` : `${kebesaran.length} berkas lebih dari 100 MB`,
        keterangan: "Dilewati. Batasnya 100 MB per berkas.",
        nada: "gagal",
      });
    }
    if (ditolak > 0) {
      toast({ judul: `${ditolak} berkas dilewati`, keterangan: "Yang diterima: PDF, gambar, dan rekaman suara.", nada: "gagal" });
    }
    if (sah.length === 0) return;

    /* Judul yang diketik hanya dipakai kalau berkasnya satu. */
    const manual = judul.trim();
    const pakaiManual = sah.length === 1 && manual.length >= 2;
    setAntre({ selesai: 0, total: sah.length });
    let gagal = 0;
    for (let i = 0; i < sah.length; i++) {
      try {
        await unggahSatu(sah[i], pakaiManual ? manual : judulDariNama(sah[i].name));
      } catch (e) {
        gagal++;
        toast({ judul: `Gagal mengunggah ${sah[i].name}`, keterangan: (e as Error).message, nada: "gagal" });
      }
      setAntre({ selesai: i + 1, total: sah.length });
    }
    setAntre(null);
    setJudul("");
    muat();
    const berhasil = sah.length - gagal;
    if (berhasil > 0) {
      toast({
        judul: berhasil === 1 ? "Dokumen diunggah" : `${berhasil} dokumen diunggah`,
        keterangan: "Langsung terlihat di portal klien.",
        nada: "sukses",
      });
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

  async function hapus(d: DokumenProyek) {
    try {
      await hapusDokumen(d.id);
      setDokumen((l) => l?.filter((x) => x.id !== d.id) ?? l);
      toast({ judul: "Dokumen dihapus", keterangan: d.title, nada: "sukses" });
    } catch (e) {
      toast({ judul: "Gagal menghapus dokumen", keterangan: (e as Error).message, nada: "gagal" });
    }
  }

  const gambar = (dokumen ?? []).filter((d) => d.kind !== "suara" && d.mimeType?.startsWith("image/"));

  return (
    <div className="pas__form">
      <Isian
        label="Judul dokumen (opsional)"
        placeholder="mis. DED Rev.2"
        value={judul}
        disabled={mengunggah}
        onChange={(e) => setJudul(e.currentTarget.value)}
        bantu="Dipakai kalau berkasnya satu. Lebih dari satu berkas, atau dikosongkan: nama berkasnya yang jadi judul."
      />
      <label
        className="pf__seret"
        data-diseret={diseret || undefined}
        onDragOver={(e) => {
          e.preventDefault();
          setDiseret(true);
        }}
        onDragLeave={() => setDiseret(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDiseret(false);
          void unggahBanyak([...e.dataTransfer.files]);
        }}
      >
        <b>{antre ? `Mengunggah ${antre.selesai}/${antre.total}…` : "Tarik berkas ke sini, atau klik untuk memilih"}</b>
        <small>PDF, JPG, PNG, WebP, atau rekaman — maks 100 MB per berkas, boleh beberapa sekaligus.</small>
        <input
          ref={pilihBerkas}
          type="file"
          multiple
          className="sr-only"
          accept={TIPE_DOKUMEN}
          disabled={mengunggah}
          aria-label="Pilih dokumen untuk diunggah"
          onChange={(e) => {
            const l = e.currentTarget.files;
            if (l && l.length > 0) void unggahBanyak([...l]);
            e.currentTarget.value = "";
          }}
        />
      </label>

      <PerekamSuaraKit onKirim={kirimSuara} disabled={mengunggah} />

      {dokumen === null ? (
        <p className="pf__fotoket">Memuat dokumen…</p>
      ) : dokumen.length === 0 ? (
        <p className="pf__fotoket">Belum ada dokumen. Berkas yang diunggah di sini langsung terlihat di portal klien.</p>
      ) : (
        <ul className="pk__dokdaftar">
          {dokumen.map((d) => {
            const st = STATUS_DOKUMEN[d.status] ?? { label: d.status, nada: "netral" };
            const suara = d.kind === "suara";
            const img = !suara && d.mimeType?.startsWith("image/");
            const pdf = d.mimeType === "application/pdf";
            const meta = [
              suara ? "Pesan suara" : pdf ? "PDF" : img ? "Gambar" : "Berkas",
              suara && d.durationMs ? formatDurasi(d.durationMs) : typeof d.fileSize === "number" && ukuranBerkas(d.fileSize),
              tanggal(d.createdAt),
            ].filter(Boolean);
            return (
              <li key={d.id} className="pk__dok" data-nada={st.nada}>
                <div className="pk__dokbaris">
                  {img ? (
                    <button
                      type="button"
                      className="pk__pratinjau"
                      aria-label={`Perbesar ${d.title}`}
                      onClick={() =>
                        bukaLightbox(
                          gambar.map((g) => ({ url: g.fileUrl, caption: g.title })),
                          gambar.findIndex((g) => g.id === d.id),
                        )
                      }
                    >
                      <img src={d.fileUrl} alt="" loading="lazy" />
                    </button>
                  ) : (
                    <span className="pk__pratinjau pk__pratinjau--ikon" aria-hidden="true">
                      {suara ? <Icon name="mic" size={20} /> : <Ikon ikon={pdf ? FilePdf : FileText} ukuran={24} />}
                    </span>
                  )}
                  <span className="pk__dokteks">
                    {suara ? (
                      <span className="pk__dokjudul">{d.title}</span>
                    ) : (
                      <a className="pk__dokjudul" href={d.fileUrl} target="_blank" rel="noreferrer">
                        {d.title}
                      </a>
                    )}
                    <span className="pk__dokmeta">{meta.join(" · ")}</span>
                  </span>
                  <label className="pk__status" data-nada={st.nada}>
                    <span className="pk__statustitik" aria-hidden="true" />
                    <select
                      aria-label={`Status ${d.title}`}
                      value={d.status}
                      onChange={(e) => ubahStatus(d.id, e.currentTarget.value)}
                    >
                      {Object.entries(STATUS_DOKUMEN).map(([v, s]) => (
                        <option key={v} value={v}>
                          {s.label}
                        </option>
                      ))}
                      {!STATUS_DOKUMEN[d.status] && <option value={d.status}>{d.status}</option>}
                    </select>
                    <Ikon ikon={CaretDown} ukuran={12} />
                  </label>
                  <AlertDialog
                    destructive
                    title={`Hapus ${d.title}?`}
                    description="Dokumen ini hilang dari portal klien beserta seluruh komentarnya."
                    confirmLabel="Ya, hapus"
                    onConfirm={() => hapus(d)}
                    trigger={
                      /* Tombol asli berkelas kit, bukan TombolIkon: pemicu
                         Radix butuh ref, dan TombolIkon tidak meneruskannya. */
                      <button
                        type="button"
                        className="k-tombolikon k-tombolikon--small k-tombol--ghost pk__hapus"
                        aria-label={`Hapus ${d.title}`}
                      >
                        <Ikon ikon={Trash} ukuran={14} />
                      </button>
                    }
                  />
                </div>
                {suara && <PemutarSuaraKit url={d.fileUrl} durationMs={d.durationMs} label={d.title} className="pk__suara" />}
                {d.status === "revisi_diminta" && d.clientNote && (
                  <p className="pk__catatanklien">
                    <b>Catatan klien</b>
                    {d.clientNote}
                  </p>
                )}
                <Komentar documentId={d.id} />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Komentar({ documentId }: { documentId: string }) {
  const toast = useToast();
  const [komentar, setKomentar] = useState<KomentarDokumen[] | null>(null);
  const [isi, setIsi] = useState("");
  const [mengirim, setMengirim] = useState(false);

  function muat() {
    daftarKomentarDokumen(documentId)
      .then(setKomentar)
      .catch(() => setKomentar([]));
  }

  async function kirim(e: React.FormEvent) {
    e.preventDefault();
    const bersih = isi.trim();
    if (!bersih) return;
    setMengirim(true);
    try {
      await tambahKomentarDokumen(documentId, bersih);
      setIsi("");
      muat();
    } catch (err) {
      toast({ judul: "Gagal mengirim balasan", keterangan: (err as Error).message, nada: "gagal" });
    } finally {
      setMengirim(false);
    }
  }

  return (
    /* <details>, bukan tombol buatan: buka-tutupnya perilaku bawaan yang
       tidak bisa rusak diam-diam. Komentarnya baru diambil saat dibuka —
       sepuluh dokumen tidak perlu sepuluh permintaan yang tidak dibaca. */
    <details
      className="pk__komentar"
      onToggle={(e) => {
        if ((e.currentTarget as HTMLDetailsElement).open && komentar === null) muat();
      }}
    >
      <summary>
        Komentar{komentar && komentar.length > 0 ? ` (${komentar.length})` : ""}
        <Ikon ikon={CaretDown} ukuran={12} />
      </summary>
      <div className="pk__komentarisi">
        {komentar === null ? (
          <p className="pf__fotoket">Memuat…</p>
        ) : komentar.length === 0 ? (
          <p className="pf__fotoket">Belum ada komentar. Balasan di sini terlihat klien di bawah dokumennya.</p>
        ) : (
          komentar.map((k) => (
            <Gelembung
              key={k.id}
              sendiri={k.author === "staf"}
              nama={k.author === "staf" ? "Studio" : "Klien"}
              waktu={tanggalJam(k.createdAt)}
            >
              {k.body}
            </Gelembung>
          ))
        )}
        <form className="pk__balas" onSubmit={kirim}>
          <span className="k-isian__kotak">
            <input
              className="k-isian__input"
              aria-label="Tulis balasan"
              placeholder="Tulis balasan untuk klien…"
              maxLength={2000}
              value={isi}
              onChange={(e) => setIsi(e.currentTarget.value)}
            />
          </span>
          <Tombol ukuran="large" jenis="secondary" tipeHtml="submit" disabled={!isi.trim() || mengirim}>
            {mengirim ? "Mengirim…" : "Kirim"}
          </Tombol>
        </form>
      </div>
    </details>
  );
}

/* --- Kabar (linimasa progres) --------------------------------------------- */

function PanelKabar({
  projectId,
  progres,
  setProgres,
}: {
  projectId: string;
  progres: ProjectProgress | null;
  setProgres: React.Dispatch<React.SetStateAction<ProjectProgress | null>>;
}) {
  const toast = useToast();
  const [judul, setJudul] = useState("");
  const [catatan, setCatatan] = useState("");
  const [sibuk, setSibuk] = useState(false);
  useCegahPindah(judul.trim() !== "" || catatan.trim() !== "");

  async function tambah(e: React.FormEvent) {
    e.preventDefault();
    const j = judul.trim();
    if (j.length < 2) return;
    setSibuk(true);
    try {
      await tambahCatatanProgress(projectId, j, catatan.trim() || null);
      setJudul("");
      setCatatan("");
      setProgres(await ambilProgress(projectId));
      toast({ judul: "Kabar ditambahkan", keterangan: "Langsung terlihat di portal klien.", nada: "sukses" });
    } catch (err) {
      toast({ judul: "Gagal menambah kabar", keterangan: (err as Error).message, nada: "gagal" });
    } finally {
      setSibuk(false);
    }
  }

  async function hapus(id: string) {
    try {
      await hapusCatatanProgress(id);
      setProgres((p) => (p ? { ...p, updates: p.updates.filter((u) => u.id !== id) } : p));
    } catch (err) {
      toast({ judul: "Gagal menghapus kabar", keterangan: (err as Error).message, nada: "gagal" });
    }
  }

  return (
    <div className="pas__form">
      <form className="pk__kabarform" onSubmit={tambah}>
        <Isian
          label="Judul kabar"
          placeholder="mis. Fondasi selesai dicor"
          maxLength={160}
          value={judul}
          onChange={(e) => setJudul(e.currentTarget.value)}
        />
        <label className="k-isian">
          <span className="k-isian__label">Catatan (opsional)</span>
          <textarea
            className="pas__area"
            rows={3}
            placeholder="Satu-dua kalimat yang menjelaskan apa artinya bagi klien."
            value={catatan}
            onChange={(e) => setCatatan(e.currentTarget.value)}
          />
        </label>
        <div className="pk__kabaraksi">
          <Tombol ukuran="large" jenis="primary" tipeHtml="submit" disabled={judul.trim().length < 2 || sibuk}>
            {sibuk ? "Menambah…" : "Tambah ke linimasa"}
          </Tombol>
          {judul.trim().length < 2 && <span className="pf__alasan">Isi judulnya dulu, minimal 2 huruf.</span>}
        </div>
      </form>

      <section aria-label="Linimasa yang dilihat klien">
        <div className="pk__kepala">
          <h3 className="pf__subjudul">Linimasa</h3>
          <span className="pk__ke">Terbaru di atas</span>
        </div>
        {progres === null ? (
          <p className="pf__fotoket">Memuat kabar…</p>
        ) : progres.updates.length === 0 ? (
          <p className="pf__fotoket">Belum ada kabar. Kabar pertama yang ditambahkan langsung tampil di portal klien.</p>
        ) : (
          <ol className="pk__lini">
            {progres.updates.map((u, i) => (
              <li key={u.id}>
                <BarisAktivitas ikon={Note} waktu={tanggal(u.createdAt)} akhir={i === progres.updates.length - 1}>
                  <b className="pk__kabarjudul">{u.title}</b>
                  {u.note && <span className="pk__kabarcatatan">{u.note}</span>}
                </BarisAktivitas>
                <AlertDialog
                  destructive
                  title={`Hapus “${u.title}”?`}
                  description="Kabar ini hilang dari linimasa yang dilihat klien."
                  confirmLabel="Ya, hapus"
                  onConfirm={() => hapus(u.id)}
                  trigger={
                    <button
                      type="button"
                      className="k-tombolikon k-tombolikon--small k-tombol--ghost pk__hapus"
                      aria-label={`Hapus kabar ${u.title}`}
                    >
                      <Ikon ikon={Trash} ukuran={14} />
                    </button>
                  }
                />
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

export function PortalKlienKit() {
  return (
    <RequireAuth skeleton={<div className="pas pas--rangka" />}>
      <ToastProvider>
        <Isi />
      </ToastProvider>
    </RequireAuth>
  );
}
