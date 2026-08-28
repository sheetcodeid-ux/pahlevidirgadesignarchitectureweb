import { useEffect, useMemo, useState } from "react";
import { Icon } from "../ui/Icon";
import { SkeletonTabel } from "../ui/Skeleton";
import { Dialog, AlertDialog } from "../ui/overlay/Dialog";
import { Popover, Tooltip, TooltipProvider } from "../ui/overlay/Floating";
import { Select } from "../ui/overlay/Select";
import { ToastProvider, useToast } from "../ui/overlay/Toast";
import { RequireAuth } from "./RequireAuth";
import { daftarProyek, hapusProyek, type Proyek, bacaCache, tulisCache} from "../../lib/admin";

const LABEL: Record<string, string> = {
  residential: "Hunian", commercial: "Komersial", interior: "Interior",
  landscape: "Lanskap", masterplan: "Masterplan", renovation: "Renovasi",
};

const STATUS: Record<string, { teks: string; kelas: string }> = {
  published: { teks: "Terbit", kelas: "badge--success" },
  draft: { teks: "Draf", kelas: "" },
  archived: { teks: "Arsip", kelas: "badge--warn" },
};

/** Saringan status, sekaligus urutan tampilnya di barisan chip. */
const SARINGAN: { id: string; label: string }[] = [
  { id: "semua", label: "Semua" },
  { id: "published", label: "Terbit" },
  { id: "draft", label: "Draf" },
  { id: "archived", label: "Arsip" },
];

/** Pilihan urutan di panel saringan. */
const URUTAN: { value: string; label: string }[] = [
  { value: "baru", label: "Terbaru" },
  { value: "lama", label: "Terlama" },
  { value: "judul", label: "Judul A–Z" },
  { value: "tahun", label: "Tahun terbaru" },
];

function Lencana({ status }: { status: string }) {
  const s = STATUS[status];
  return (
    <span className={`badge ${s?.kelas ?? ""}`}>
      {status === "published" && <span className="badge__dot" />}
      {s?.teks ?? status}
    </span>
  );
}

function Isi() {
  const toast = useToast();
  const [proyek, setProyek] = useState<Proyek[] | null>(() => bacaCache<Proyek[]>("proyek"));
  const [galat, setGalat] = useState<string | null>(null);
  const [saring, setSaring] = useState("semua");
  const [cari, setCari] = useState("");
  const [tampilan, setTampilan] = useState<"tabel" | "kartu">("tabel");
  const [urut, setUrut] = useState("baru");
  const [kategori, setKategori] = useState("semua");

  async function muat() {
    try {
      const daftar = await daftarProyek();
      tulisCache("proyek", daftar);
      setProyek(daftar);
    } catch (e) {
      setGalat((e as Error).message);
    }
  }

  useEffect(() => { muat(); }, []);

  async function hapus(p: Proyek) {
    try {
      await hapusProyek(p.id);
      toast({ judul: "Proyek dihapus", keterangan: `${p.title} beserta gambarnya.`, nada: "sukses" });
      muat();
    } catch (e) {
      toast({ judul: "Gagal menghapus", keterangan: (e as Error).message, nada: "gagal" });
    }
  }

  // Pencarian menyapu judul, slug, kota, dan klien sekaligus. Staf mengingat
  // proyek dengan cara berbeda-beda — kadang lewat nama klien, bukan judul.
  const cocokCari = useMemo(() => {
    const q = cari.trim().toLowerCase();
    if (!q) return () => true;
    return (p: Proyek) =>
      [p.title, p.slug, p.city, p.client, p.location]
        .some((v) => (v ?? "").toLowerCase().includes(q));
  }, [cari]);

  if (galat) {
    return (
      <div className="alert alert--danger" role="alert">
        <span className="alert__icon"><Icon name="alert" size={18} /></span>
        <span className="alert__body">
          <span className="alert__title">Gagal memuat proyek</span>
          <span className="alert__text">{galat}</span>
        </span>
      </div>
    );
  }

  if (!proyek) {
    // Kolomnya persis kolom tabel di bawah — termasuk kelas .table__idx dan
    // .table__num, supaya lebar dan perataan tiap sel sama.
    return (
      <div className="listpage">
        <div className="listpage__pad">
          <SkeletonTabel
            baris={6}
            kolom={[
              { label: "#", kelas: "table__idx", lebar: "1rem" },
              { label: "Proyek", gambar: true },
              { label: "Kategori", lebar: "5rem" },
              { label: "Kota", lebar: "4.5rem" },
              { label: "Tahun", kelas: "table__num", lebar: "2.5rem" },
              { label: "Status", lebar: "4rem" },
              { label: "Aksi", kelas: "table__actions", lebar: "3.5rem" },
            ]}
          />
        </div>
      </div>
    );
  }

  // Hitungan chip mengikuti pencarian yang sedang aktif, bukan seluruh data —
  // kalau tidak, chip menjanjikan hasil yang tidak akan muncul saat diklik.
  const terkena = proyek
    .filter(cocokCari)
    .filter((p) => kategori === "semua" || p.category === kategori)
    // Disalin dulu: sort mengubah array aslinya, dan array itu datang
    // langsung dari state.
    .slice()
    .sort((a, b) => {
      if (urut === "judul") return a.title.localeCompare(b.title, "id");
      if (urut === "tahun") return (b.year ?? 0) - (a.year ?? 0);
      const arah = urut === "lama" ? 1 : -1;
      return arah * (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
    });
  const jumlah = (id: string) => (id === "semua" ? terkena.length : terkena.filter((p) => p.status === id).length);
  const terlihat = saring === "semua" ? terkena : terkena.filter((p) => p.status === saring);

  const tombolBaru = (
    <a className="btn btn--primary btn--lg btn--lift" href="/admin/proyek/baru">
      <Icon name="projectPlus" size={20} />Tambah Proyek
    </a>
  );

  return (
    <div className="listpage">
      <div className="listbar">
        <div className="listbar__main">
          <div className="listbar__search">
            <span className="listbar__icon"><Icon name="search" size={20} /></span>
            <input
              className="input"
              type="search"
              value={cari}
              onChange={(e) => setCari(e.target.value)}
              placeholder="Cari judul, slug, kota, atau klien…"
              aria-label="Cari proyek"
            />
          </div>

          <div className="listbar__views">
            <div className="viewtoggle" role="group" aria-label="Tampilan daftar">
              <Tooltip label="Tampilan tabel">
                <button type="button" className="viewtoggle__opt"
                  aria-pressed={tampilan === "tabel"} aria-label="Tampilan tabel"
                  onClick={() => setTampilan("tabel")}>
                  <Icon name="list" size={18} />
                </button>
              </Tooltip>
              <Tooltip label="Tampilan kartu">
                <button type="button" className="viewtoggle__opt"
                  aria-pressed={tampilan === "kartu"} aria-label="Tampilan kartu"
                  onClick={() => setTampilan("kartu")}>
                  <Icon name="dashboard" size={18} />
                </button>
              </Tooltip>
            </div>
          </div>

          <div className="listbar__cta">{tombolBaru}</div>
        </div>

        <div className="listbar__filters">
          <div className="chips" role="group" aria-label="Saring status">
            {SARINGAN.map((s) => (
              <button key={s.id} type="button" className="chip"
                aria-pressed={saring === s.id} onClick={() => setSaring(s.id)}>
                {s.label}<span className="chip__n">{jumlah(s.id)}</span>
              </button>
            ))}
          </div>

          {/* Tombol saringan membuka panel berisi urutan dan kategori —
              keduanya tidak muat sebagai chip, dan chip sudah dipakai untuk
              status. Tombolnya tetap di tempat yang sama seperti referensi. */}
          <Popover
            title="Saringan"
            trigger={
              <button type="button" className="btn btn--secondary btn--icon btn--boxed"
                aria-label="Saringan dan urutan">
                <Icon name="filter" size={16} />
              </button>
            }
          >
            <div className="stack" style={{ gap: "var(--space-4)", minWidth: "15rem" }}>
              <div className="field">
                <label className="field__label">Urutkan</label>
                <Select ariaLabel="Urutkan proyek" options={URUTAN} value={urut} onValueChange={setUrut} />
              </div>
              <div className="field">
                <label className="field__label">Kategori</label>
                <Select
                  ariaLabel="Saring kategori"
                  value={kategori}
                  onValueChange={setKategori}
                  options={[
                    { value: "semua", label: "Semua kategori" },
                    ...Object.entries(LABEL).map(([v, l]) => ({ value: v, label: l })),
                  ]}
                />
              </div>
              <button type="button" className="btn btn--secondary"
                disabled={!cari && saring === "semua" && urut === "baru" && kategori === "semua"}
                onClick={() => { setCari(""); setSaring("semua"); setUrut("baru"); setKategori("semua"); }}>
                <Icon name="close" size={14} />Bersihkan semua
              </button>
            </div>
          </Popover>
        </div>
      </div>

      {terlihat.length === 0 ? (
        <div className="listpage__pad"><div className="empty">
          <span className="icon-tile"><Icon name="project" size={20} /></span>
          <span className="t-subheading">
            {proyek.length === 0
              ? "Belum ada proyek"
              : cari
                ? `Tidak ada proyek yang cocok dengan "${cari}"`
                : "Tidak ada proyek dengan status ini"}
          </span>
          <p className="t-muted">
            {proyek.length === 0
              ? "Buat proyek pertama untuk mulai mengisi portfolio."
              : "Coba kata kunci atau status lain."}
          </p>
        </div></div>
      ) : tampilan === "tabel" ? (
        <div className="table-wrap">
          <div className="listcount">
            <strong>1–{terlihat.length}</strong>&nbsp;dari&nbsp;<strong>{proyek.length}</strong>&nbsp;proyek
          </div>
          <table className="table table--ruled">
            <thead>
              <tr>
                <th className="table__idx">#</th>
                <th>Proyek</th><th>Kategori</th><th>Kota</th>
                <th className="table__num">Tahun</th><th>Status</th>
                <th className="table__actions">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {terlihat.map((p, i) => (
                <tr key={p.id}>
                  <td className="table__idx">{i + 1}</td>
                  <td>
                    <span className="row" style={{ gap: "var(--space-3)", flexWrap: "nowrap" }}>
                      {p.coverImageUrl ? (
                        <Dialog
                          title={p.title}
                          description="Gambar sampul proyek."
                          trigger={
                            <button type="button" className="thumb-btn" aria-label={`Lihat sampul ${p.title}`}>
                              <img className="pcard__thumb" src={p.coverImageUrl} alt="" />
                            </button>
                          }
                        >
                          <img className="lihat-foto" src={p.coverImageUrl} alt={`Sampul ${p.title}`} />
                        </Dialog>
                      ) : (
                        <span className="pcard__thumb"><Icon name="image" size={18} /></span>
                      )}
                      <span style={{ minWidth: 0 }}>
                        <a href={`/admin/proyek/edit?id=${p.id}`} className="item__title" style={{ textDecoration: "none" }}>
                          {p.title}
                        </a>
                        <div className="attachment__size">/{p.slug}</div>
                      </span>
                    </span>
                  </td>
                  <td>{LABEL[p.category] ?? p.category}</td>
                  <td>{p.city ?? "—"}</td>
                  <td className="table__num">{p.year ?? "—"}</td>
                  <td><Lencana status={p.status} /></td>
                  <td className="table__actions">
                    <span className="table__act">
                      <a className="btn btn--secondary btn--icon btn--boxed" href={`/admin/proyek/edit?id=${p.id}`}
                        aria-label={`Buka ${p.title}`}>
                        <Icon name="edit" size={15} />
                      </a>
                      <AlertDialog
                        destructive
                        title={`Hapus ${p.title}?`}
                        description="Seluruh gambar proyek ini ikut terhapus dan tidak bisa dikembalikan."
                        confirmLabel="Ya, hapus"
                        onConfirm={() => hapus(p)}
                        trigger={
                          <button type="button" className="btn btn--secondary btn--icon btn--boxed btn--hapus" aria-label={`Hapus ${p.title}`}>
                            <Icon name="trash" size={15} />
                          </button>
                        }
                      />
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="listpage__pad"><div className="pcard-grid">
          {terlihat.map((p) => (
            <article className="pcard" key={p.id}>
              <div className="pcard__head">
                {p.coverImageUrl
                  ? <img className="pcard__thumb" src={p.coverImageUrl} alt="" />
                  : <span className="pcard__thumb"><Icon name="image" size={18} /></span>}
                <span className="card__titles">
                  <a href={`/admin/proyek/edit?id=${p.id}`} className="item__title" style={{ textDecoration: "none" }}>
                    {p.title}
                  </a>
                  <span className="t-muted" style={{ fontSize: "var(--text-sm)" }}>
                    {LABEL[p.category] ?? p.category} · /{p.slug}
                  </span>
                </span>
                <Lencana status={p.status} />
              </div>

              <div className="pcard__body">
                <span className="pcard__cell">
                  <span className="pcard__k">Kota</span>
                  <span className="pcard__v">{p.city ?? "—"}</span>
                </span>
                <span className="pcard__cell">
                  <span className="pcard__k">Tahun</span>
                  <span className="pcard__v t-mono">{p.year ?? "—"}</span>
                </span>
                <span className="pcard__cell">
                  <span className="pcard__k">Klien</span>
                  <span className="pcard__v">{p.client ?? "—"}</span>
                </span>
                <span className="pcard__cell">
                  <span className="pcard__k">Luas</span>
                  <span className="pcard__v t-mono">{p.areaSqm ? `${p.areaSqm} m²` : "—"}</span>
                </span>
              </div>

              <div className="pcard__foot">
                <a className="pcard__act" href={`/admin/proyek/edit?id=${p.id}`}>
                  <Icon name="external" size={15} />Buka
                </a>
                <a className="pcard__act" href={`/proyek/${p.slug}`} target="_blank" rel="noreferrer">
                  <Icon name="external" size={15} />Lihat
                </a>
                <AlertDialog
                  destructive
                  title={`Hapus ${p.title}?`}
                  description="Seluruh gambar proyek ini ikut terhapus dan tidak bisa dikembalikan."
                  confirmLabel="Ya, hapus"
                  onConfirm={() => hapus(p)}
                  trigger={
                    <button type="button" className="pcard__act pcard__act--danger">
                      <Icon name="trash" size={15} />Hapus
                    </button>
                  }
                />
              </div>
            </article>
          ))}
        </div></div>
      )}
    </div>
  );
}

export function ProjectList() {
  return (
    <RequireAuth kerangka={
      <div className="listpage">
        <div className="listpage__pad">
          <SkeletonTabel
            baris={6}
            kolom={[
              { label: "#", kelas: "table__idx", lebar: "1rem" },
              { label: "Proyek", gambar: true },
              { label: "Kategori", lebar: "5rem" },
              { label: "Kota", lebar: "4.5rem" },
              { label: "Tahun", kelas: "table__num", lebar: "2.5rem" },
              { label: "Status", lebar: "4rem" },
              { label: "Aksi", kelas: "table__actions", lebar: "3.5rem" },
            ]}
          />
        </div>
      </div>
    }>
      <ToastProvider><TooltipProvider><Isi /></TooltipProvider></ToastProvider>
    </RequireAuth>
  );
}
