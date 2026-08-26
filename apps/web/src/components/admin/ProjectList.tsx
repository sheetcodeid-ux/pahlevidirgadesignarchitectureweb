import { useEffect, useMemo, useState } from "react";
import { Icon } from "../ui/Icon";
import { Dialog, AlertDialog } from "../ui/overlay/Dialog";
import { ToastProvider, useToast } from "../ui/overlay/Toast";
import { RequireAuth } from "./RequireAuth";
import { daftarProyek, buatProyek, hapusProyek, type Proyek } from "../../lib/admin";

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

/** Mengubah judul jadi slug: huruf kecil, tanpa aksen, dipisah tanda hubung. */
function keSlug(judul: string) {
  return judul
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

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
  const [proyek, setProyek] = useState<Proyek[] | null>(null);
  const [galat, setGalat] = useState<string | null>(null);
  const [saring, setSaring] = useState("semua");
  const [cari, setCari] = useState("");
  const [tampilan, setTampilan] = useState<"tabel" | "kartu">("tabel");

  const [judulBaru, setJudulBaru] = useState("");
  const [slugBaru, setSlugBaru] = useState("");
  const [slugDisunting, setSlugDisunting] = useState(false);
  const [kategoriBaru, setKategoriBaru] = useState("residential");
  const [menyimpan, setMenyimpan] = useState(false);

  async function muat() {
    try {
      setProyek(await daftarProyek());
    } catch (e) {
      setGalat((e as Error).message);
    }
  }

  useEffect(() => { muat(); }, []);

  async function tambah() {
    setMenyimpan(true);
    try {
      const { id } = await buatProyek(slugBaru || keSlug(judulBaru), judulBaru.trim(), kategoriBaru);
      window.location.href = `/admin/proyek/edit?id=${id}`;
    } catch (e) {
      toast({ judul: "Gagal membuat proyek", keterangan: (e as Error).message, nada: "gagal" });
      setMenyimpan(false);
    }
  }

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
    return (
      <div className="stack">
        {[0, 1, 2].map((i) => <span key={i} className="skeleton" style={{ height: "4rem" }} />)}
      </div>
    );
  }

  // Hitungan chip mengikuti pencarian yang sedang aktif, bukan seluruh data —
  // kalau tidak, chip menjanjikan hasil yang tidak akan muncul saat diklik.
  const terkena = proyek.filter(cocokCari);
  const jumlah = (id: string) => (id === "semua" ? terkena.length : terkena.filter((p) => p.status === id).length);
  const terlihat = saring === "semua" ? terkena : terkena.filter((p) => p.status === saring);
  const judulSah = judulBaru.trim().length >= 2;

  const tombolBaru = (
    <button type="button" className="btn btn--primary">
      <Icon name="plus" size={16} />Proyek baru
    </button>
  );

  const dialogBaru = (
    <Dialog
      trigger={tombolBaru}
      title="Proyek baru"
      description="Judul dan slug bisa diubah nanti. Proyek dibuat sebagai draf."
      footer={
        <button type="button" className="btn btn--primary" disabled={!judulSah || menyimpan} onClick={tambah}>
          {menyimpan && <span className="spinner spinner--sm spinner--on-action" />}
          Buat &amp; sunting
        </button>
      }
    >
      <div className="stack">
        <div className="field">
          <label className="field__label" htmlFor="np-judul">
            Judul<span className="field__req" aria-hidden="true">*</span>
          </label>
          <input id="np-judul" className="input" value={judulBaru}
            onChange={(e) => {
              setJudulBaru(e.target.value);
              // Slug mengikuti judul sampai staf menyuntingnya sendiri;
              // setelah itu jangan ditimpa diam-diam.
              if (!slugDisunting) setSlugBaru(keSlug(e.target.value));
            }} />
        </div>
        <div className="field">
          <label className="field__label" htmlFor="np-slug">Slug</label>
          <input id="np-slug" className="input input--mono" value={slugBaru}
            onChange={(e) => { setSlugDisunting(true); setSlugBaru(e.target.value); }} />
          <p className="field__help">Muncul di URL: /proyek/{slugBaru || "…"}</p>
        </div>
        <div className="field">
          <label className="field__label" htmlFor="np-kat">Kategori</label>
          <span className="select">
            <select id="np-kat" className="input" value={kategoriBaru} onChange={(e) => setKategoriBaru(e.target.value)}>
              {Object.entries(LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <span className="select__chevron"><Icon name="chevronDown" size={16} /></span>
          </span>
        </div>
      </div>
    </Dialog>
  );

  return (
    <div className="stack" style={{ gap: "var(--space-5)" }}>
      <div className="listbar">
        <div className="listbar__main">
          <div className="listbar__search">
            <span className="listbar__icon"><Icon name="search" size={18} /></span>
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
              <button type="button" className="viewtoggle__opt"
                aria-pressed={tampilan === "tabel"} aria-label="Tampilan tabel"
                onClick={() => setTampilan("tabel")}>
                <Icon name="list" size={17} />
              </button>
              <button type="button" className="viewtoggle__opt"
                aria-pressed={tampilan === "kartu"} aria-label="Tampilan kartu"
                onClick={() => setTampilan("kartu")}>
                <Icon name="dashboard" size={17} />
              </button>
            </div>
          </div>

          <div className="listbar__cta">{dialogBaru}</div>
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

          {/* Tombol bersihkan menempati tempat tombol saringan di referensi.
              Dimatikan, bukan disembunyikan, saat tidak ada yang disaring —
              kalau ikut hilang, barisan chip melompat setiap kali disaring. */}
          <button type="button" className="btn btn--secondary btn--icon"
            aria-label="Bersihkan saringan"
            disabled={!cari && saring === "semua"}
            onClick={() => { setCari(""); setSaring("semua"); }}>
            <Icon name="filter" size={16} />
          </button>
        </div>
      </div>

      {terlihat.length === 0 ? (
        <div className="empty">
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
        </div>
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
                      {p.coverImageUrl
                        ? <img className="pcard__thumb" src={p.coverImageUrl} alt="" />
                        : <span className="pcard__thumb"><Icon name="image" size={18} /></span>}
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
                    <span className="row" style={{ justifyContent: "flex-end", gap: "var(--space-2)" }}>
                      <a className="btn btn--secondary btn--icon btn--boxed" href={`/admin/proyek/edit?id=${p.id}`}
                        aria-label={`Sunting ${p.title}`}>
                        <Icon name="edit" size={15} />
                      </a>
                      <AlertDialog
                        destructive
                        title={`Hapus ${p.title}?`}
                        description="Seluruh gambar proyek ini ikut terhapus dan tidak bisa dikembalikan."
                        confirmLabel="Ya, hapus"
                        onConfirm={() => hapus(p)}
                        trigger={
                          <button type="button" className="btn btn--secondary btn--icon btn--boxed" aria-label={`Hapus ${p.title}`}>
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
        <div className="pcard-grid">
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
                  <Icon name="edit" size={15} />Sunting
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
        </div>
      )}
    </div>
  );
}

export function ProjectList() {
  return (
    <RequireAuth>
      <ToastProvider><Isi /></ToastProvider>
    </RequireAuth>
  );
}
