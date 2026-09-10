import { useEffect, useState } from "react";
import { Icon } from "../ui/Icon";
import { SkeletonTabel } from "../ui/Skeleton";
import { AlertDialog, Sheet } from "../ui/overlay/Dialog";
import { ToastProvider, useToast } from "../ui/overlay/Toast";
import { Select } from "../ui/overlay/Select";
import { DataTable, kolomSkeleton, type Kolom, type Chip } from "../ui/data/DataTable";
import { RequireAuth } from "./RequireAuth";
import {
  daftarTulisan, buatTulisan, ubahTulisan, hapusTulisan, slugDariJudul,
  bacaCache, tulisCache, jumlahDiingat,
  type TulisanAdmin, type KategoriJurnal,
} from "../../lib/admin";

const KATEGORI: Record<KategoriJurnal, string> = {
  site: "Tapak & iklim",
  money: "Uang",
  permit: "Perizinan",
  build: "Membangun",
};

/** Isi minimal sebelum sebuah tulisan boleh terbit — sama dengan CHECK di database. */
const ISI_MINIMAL = 200;

type Keadaan = "terbit" | "terjadwal" | "rencana";

/* Tiga keadaan, bukan dua. "Terjadwal" adalah tulisan yang tanggalnya sudah
   diisi tapi masih di depan — ia belum terbaca pengunjung, dan menyamakannya
   dengan "terbit" membuat pemilik mengira tulisannya sudah tayang. */
function keadaan(t: TulisanAdmin): Keadaan {
  if (!t.publishedAt) return "rencana";
  return Date.parse(t.publishedAt) <= Date.now() ? "terbit" : "terjadwal";
}

const LABEL_KEADAAN: Record<Keadaan, string> = {
  terbit: "Terbit", terjadwal: "Terjadwal", rencana: "Rencana",
};
const BADGE_KEADAAN: Record<Keadaan, string> = {
  terbit: "badge--success", terjadwal: "badge--warn", rencana: "badge--info",
};

function tanggal(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

/** Isian tulisan. Dipakai untuk membuat maupun menyunting — satu bentuk, satu tempat. */
function FormTulisan({
  awal, onSimpan, menyimpan,
}: {
  awal?: TulisanAdmin;
  onSimpan: (isi: Partial<TulisanAdmin>) => void;
  menyimpan: boolean;
}) {
  const [judul, setJudul] = useState(awal?.title ?? "");
  const [slug, setSlug] = useState(awal?.slug ?? "");
  /* Slug hanya ikut judul selama pemilik belum menyentuhnya sendiri. Tulisan
     yang sudah terbit alamatnya TIDAK boleh berubah gara-gara judulnya
     disunting — setiap tautan yang sudah tersebar akan mati. */
  const [slugManual, setSlugManual] = useState(Boolean(awal));
  const [pembuka, setPembuka] = useState(awal?.excerpt ?? "");
  const [kategori, setKategori] = useState<KategoriJurnal>(awal?.category ?? "site");
  const [menit, setMenit] = useState(String(awal?.readMinutes ?? 5));
  const [isi, setIsi] = useState(awal?.body ?? "");
  const [terbit, setTerbit] = useState(Boolean(awal?.publishedAt));

  const slugKini = slugManual ? slug : slugDariJudul(judul);
  const isiCukup = isi.trim().length >= ISI_MINIMAL;
  const bisaSimpan =
    judul.trim().length >= 3 &&
    slugKini.length >= 3 &&
    pembuka.trim().length >= 10 &&
    (!terbit || isiCukup);

  return (
    <div className="stack">
      <div className="field">
        <label className="field__label" htmlFor="j-judul">
          Judul<span className="field__req" aria-hidden="true">*</span>
        </label>
        <input id="j-judul" className="input" value={judul}
          onChange={(e) => setJudul(e.target.value)}
          placeholder="Contoh: Sembilan pertanyaan sebelum membeli tanah" />
      </div>

      <div className="field">
        <label className="field__label" htmlFor="j-slug">Alamat</label>
        <input id="j-slug" className="input" value={slugKini}
          onChange={(e) => { setSlugManual(true); setSlug(slugDariJudul(e.target.value)); }} />
        <p className="field__help">
          pahlevidirgaarchitecture.com/jurnal/<b>{slugKini || "…"}</b>
          {awal?.publishedAt && " · tulisan ini sudah terbit, mengubah alamatnya mematikan tautan yang sudah dibagikan"}
        </p>
      </div>

      <div className="field">
        <label className="field__label" htmlFor="j-pembuka">
          Kalimat pembuka<span className="field__req" aria-hidden="true">*</span>
        </label>
        <textarea id="j-pembuka" className="input input--area" rows={3} value={pembuka}
          onChange={(e) => setPembuka(e.target.value)}
          placeholder="Satu atau dua kalimat yang menjelaskan isinya." />
        <p className="field__help">Tampil di daftar jurnal DAN di kepala tulisan — cukup ditulis sekali.</p>
      </div>

      {/* alignItems flex-start, BUKAN flex-end. Dengan flex-end kedua isian
          diratakan BAWAHNYA — dan karena Lama baca punya keterangan di bawah
          sementara Kategori tidak, isian Lama baca terdorong ke atas dan kedua
          labelnya berhenti di ketinggian berbeda. Terlihat jelas di tangkapan
          layar pemilik.

          Satuan "menit" pindah ke DALAM isiannya sebagai akhiran, memakai
          .input-affix yang memang sudah ada untuk ini — jadi tidak ada lagi
          keterangan di bawah yang bisa menggeser apa pun. */}
      <div className="row" style={{ gap: "var(--space-3)", alignItems: "flex-start" }}>
        <div className="field" style={{ flex: 1, minWidth: 0 }}>
          <label className="field__label" htmlFor="j-kategori">Kategori</label>
          <Select id="j-kategori" ariaLabel="Kategori tulisan" value={kategori}
            onValueChange={(v) => setKategori(v as KategoriJurnal)}
            options={Object.entries(KATEGORI).map(([value, label]) => ({ value, label }))} />
        </div>
        <div className="field" style={{ width: "10rem" }}>
          <label className="field__label" htmlFor="j-menit">Lama baca</label>
          <span className="input-affix">
            <input id="j-menit" className="input" type="number" min={1} max={90} value={menit}
              onChange={(e) => setMenit(e.target.value)} />
            <span className="input-affix__unit" aria-hidden="true">menit</span>
          </span>
        </div>
      </div>

      <div className="field">
        <label className="field__label" htmlFor="j-isi">Isi tulisan</label>
        <textarea id="j-isi" className="input input--area jurnal__isi" rows={16} value={isi}
          onChange={(e) => setIsi(e.target.value)}
          placeholder={"## Judul bagian\n\nSatu paragraf.\n\n- poin pertama\n- poin kedua"} />
        <p className="field__help">
          Ditulis dengan Markdown. <b>## di awal baris</b> membuat judul bagian —
          judul-judul itulah yang jadi daftar isi di halaman tulisannya.
          <b> **tebal**</b>, <b>- </b> untuk poin.
          {" "}{isi.trim().length} karakter{terbit && !isiCukup && ` — kurang ${ISI_MINIMAL - isi.trim().length} lagi untuk bisa terbit`}
        </p>
      </div>

      <label className="choice">
        <input type="checkbox" checked={terbit} onChange={(e) => setTerbit(e.target.checked)} />
        <span className="choice__text">
          <span>Terbitkan</span>
          <span className="choice__desc">
            {terbit
              ? "Tulisan ini akan bisa dibaca siapa pun begitu situs di-deploy ulang."
              : "Tetap jadi rencana: judulnya tampil di daftar jurnal bertanda “belum ditulis”, dan isinya tidak ikut terkirim."}
          </span>
        </span>
      </label>

      <button type="button" className="btn btn--primary" disabled={!bisaSimpan || menyimpan}
        onClick={() => onSimpan({
          title: judul.trim(),
          slug: slugKini,
          excerpt: pembuka.trim(),
          category: kategori,
          readMinutes: Number(menit) || 5,
          body: isi.trim() ? isi : null,
          /* Tanggal terbit yang SUDAH ada dipertahankan — mengubahnya setiap
             kali tulisan disunting akan melempar tulisan lama ke puncak daftar. */
          publishedAt: terbit ? (awal?.publishedAt ?? new Date().toISOString()) : null,
        })}>
        {menyimpan && <span className="spinner spinner--sm spinner--on-action" />}
        Simpan
      </button>
    </div>
  );
}

function Isi() {
  const toast = useToast();
  const [tulisan, setTulisan] = useState<TulisanAdmin[] | null>(
    () => bacaCache<TulisanAdmin[]>("jurnal"),
  );
  const [menyimpan, setMenyimpan] = useState(false);

  function muat() {
    daftarTulisan()
      .then((d) => { tulisCache("jurnal", d); setTulisan(d); })
      .catch(() => setTulisan((l) => l ?? []));
  }

  useEffect(muat, []);

  async function simpanBaru(isi: Partial<TulisanAdmin>) {
    setMenyimpan(true);
    try {
      await buatTulisan(isi);
      muat();
      toast({ judul: "Tulisan disimpan", nada: "sukses" });
    } catch (e) {
      toast({ judul: "Gagal menyimpan", keterangan: (e as Error).message, nada: "gagal" });
    } finally {
      setMenyimpan(false);
    }
  }

  async function simpanUbah(id: string, isi: Partial<TulisanAdmin>) {
    setMenyimpan(true);
    try {
      await ubahTulisan(id, isi);
      muat();
      toast({ judul: "Perubahan disimpan", nada: "sukses" });
    } catch (e) {
      toast({ judul: "Gagal menyimpan", keterangan: (e as Error).message, nada: "gagal" });
    } finally {
      setMenyimpan(false);
    }
  }

  async function hapus(id: string) {
    try {
      await hapusTulisan(id);
      setTulisan((t) => t?.filter((x) => x.id !== id) ?? null);
    } catch (e) {
      toast({ judul: "Gagal menghapus", keterangan: (e as Error).message, nada: "gagal" });
    }
  }

  const kolom: Kolom<TulisanAdmin>[] = [
    {
      judul: "Judul",
      render: (t) => (
        <span style={{ minWidth: 0, display: "block" }}>
          <span className="item__title">{t.title}</span>
          <div className="attachment__size">/jurnal/{t.slug}</div>
        </span>
      ),
    },
    { judul: "Kategori", lebar: "8rem", render: (t) => KATEGORI[t.category] ?? t.category },
    {
      judul: "Lama baca", kelas: "table__num", lebar: "5rem",
      render: (t) => `${t.readMinutes} mnt`,
    },
    {
      judul: "Terbit", kelas: "table__num", lebar: "6rem",
      render: (t) => tanggal(t.publishedAt),
    },
    {
      judul: "Status", lebar: "5rem",
      render: (t) => {
        const k = keadaan(t);
        return (
          <span className={`badge ${BADGE_KEADAAN[k]}`}>
            <span className="badge__dot" />{LABEL_KEADAAN[k]}
          </span>
        );
      },
    },
    {
      judul: "Aksi", kelas: "table__actions", lebar: "3.5rem",
      render: (t) => (
        <span className="table__act">
          <Sheet
            title={t.title}
            description={`/jurnal/${t.slug} · ${LABEL_KEADAAN[keadaan(t)]}`}
            trigger={
              <button type="button" className="btn btn--secondary btn--icon btn--boxed"
                aria-label={`Sunting ${t.title}`}>
                <Icon name="edit" size={15} />
              </button>
            }
          >
            <FormTulisan awal={t} menyimpan={menyimpan}
              onSimpan={(isi) => simpanUbah(t.id, isi)} />
          </Sheet>
          <AlertDialog
            destructive
            title={`Hapus “${t.title}”?`}
            description="Tulisan ini dihapus permanen. Kalau sudah pernah terbit, alamatnya berubah jadi 404 untuk siapa pun yang menyimpan tautannya."
            confirmLabel="Ya, hapus"
            onConfirm={() => hapus(t.id)}
            trigger={
              <button type="button" className="btn btn--secondary btn--icon btn--boxed btn--hapus"
                aria-label={`Hapus ${t.title}`}>
                <Icon name="trash" size={15} />
              </button>
            }
          />
        </span>
      ),
    },
  ];

  const chips: Chip<TulisanAdmin>[] = [
    { id: "semua", label: "Semua" },
    { id: "terbit", label: "Terbit", cocok: (t) => keadaan(t) === "terbit" },
    { id: "terjadwal", label: "Terjadwal", cocok: (t) => keadaan(t) === "terjadwal" },
    { id: "rencana", label: "Rencana", cocok: (t) => keadaan(t) === "rencana" },
  ];

  return (
    <DataTable
      data={tulisan}
      kunci={(t) => t.id}
      kolom={kolom}
      chips={chips}
      cariPada={(t) => [t.title, t.slug, t.excerpt]}
      placeholderCari="Cari judul, alamat, atau kalimat pembuka…"
      labelCari="Cari tulisan"
      satuan="tulisan"
      barisSkeleton={jumlahDiingat("jurnal", 5)}
      aksi={
        <Sheet
          title="Tulisan baru"
          description="Judul, kalimat pembuka, dan isinya. Bisa disimpan sebagai rencana dulu."
          trigger={
            <button type="button" className="btn btn--primary">
              <Icon name="plus" size={15} /> Tulis baru
            </button>
          }
        >
          <FormTulisan menyimpan={menyimpan} onSimpan={simpanBaru} />
        </Sheet>
      }
      kosong={{
        ikon: "document",
        judul: "Belum ada tulisan",
        keterangan: "Jurnal berisi hal-hal yang berulang kali dijelaskan ke calon klien. Satu tulisan yang benar-benar berguna lebih berarti daripada sepuluh yang basa-basi.",
      }}
    />
  );
}

const KOLOM_TIRUAN = kolomSkeleton<TulisanAdmin>([
  { judul: "Judul", render: () => null },
  { judul: "Kategori", lebar: "8rem", render: () => null },
  { judul: "Lama baca", kelas: "table__num", lebar: "5rem", render: () => null },
  { judul: "Terbit", kelas: "table__num", lebar: "6rem", render: () => null },
  { judul: "Status", lebar: "5rem", render: () => null },
  { judul: "Aksi", kelas: "table__actions", lebar: "3.5rem", render: () => null },
]);

export function JournalPanel() {
  return (
    <RequireAuth
      skeleton={
        <div className="listpage"><div className="listpage__pad">
          <SkeletonTabel baris={jumlahDiingat("jurnal", 5)} kolom={KOLOM_TIRUAN} />
        </div></div>
      }
    >
      <ToastProvider><Isi /></ToastProvider>
    </RequireAuth>
  );
}
