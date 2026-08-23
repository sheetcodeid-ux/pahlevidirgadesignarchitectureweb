import { useEffect, useState } from "react";
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

function Isi() {
  const toast = useToast();
  const [proyek, setProyek] = useState<Proyek[] | null>(null);
  const [galat, setGalat] = useState<string | null>(null);
  const [saring, setSaring] = useState("semua");

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

  const terlihat = saring === "semua" ? proyek : proyek.filter((p) => p.status === saring);
  const judulSah = judulBaru.trim().length >= 2;

  return (
    <div className="stack" style={{ gap: "var(--space-5)" }}>
      <div className="row row--between">
        <div className="segmented" role="group" aria-label="Saring status">
          {[
            { id: "semua", label: `Semua ${proyek.length}` },
            { id: "published", label: "Terbit" },
            { id: "draft", label: "Draf" },
            { id: "archived", label: "Arsip" },
          ].map((s) => (
            <button key={s.id} type="button" className="segmented__opt"
              aria-pressed={saring === s.id} onClick={() => setSaring(s.id)}>
              {s.label}
            </button>
          ))}
        </div>

        <Dialog
          trigger={<button type="button" className="btn btn--primary"><Icon name="plus" size={16} />Proyek baru</button>}
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
      </div>

      {terlihat.length === 0 ? (
        <div className="empty">
          <span className="icon-tile"><Icon name="project" size={20} /></span>
          <span className="t-subheading">
            {proyek.length === 0 ? "Belum ada proyek" : "Tidak ada proyek dengan status ini"}
          </span>
          <p className="t-muted">
            {proyek.length === 0
              ? "Buat proyek pertama untuk mulai mengisi portfolio."
              : "Coba pilih status lain."}
          </p>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>Proyek</th><th>Kategori</th><th>Kota</th><th className="table__num">Tahun</th><th>Status</th><th className="table__actions">Aksi</th></tr>
            </thead>
            <tbody>
              {terlihat.map((p) => (
                <tr key={p.id}>
                  <td>
                    <a href={`/admin/proyek/edit?id=${p.id}`} className="item__title" style={{ textDecoration: "none" }}>
                      {p.title}
                    </a>
                    <div className="attachment__size">/{p.slug}</div>
                  </td>
                  <td>{LABEL[p.category] ?? p.category}</td>
                  <td>{p.city ?? "—"}</td>
                  <td className="table__num">{p.year ?? "—"}</td>
                  <td>
                    <span className={`badge ${STATUS[p.status]?.kelas ?? ""}`}>
                      {p.status === "published" && <span className="badge__dot" />}
                      {STATUS[p.status]?.teks ?? p.status}
                    </span>
                  </td>
                  <td className="table__actions">
                    <span className="row" style={{ justifyContent: "flex-end", gap: "var(--space-2)" }}>
                      <a className="btn btn--secondary btn--sm" href={`/admin/proyek/edit?id=${p.id}`}>
                        <Icon name="edit" size={14} />Sunting
                      </a>
                      <AlertDialog
                        destructive
                        title={`Hapus ${p.title}?`}
                        description="Seluruh gambar proyek ini ikut terhapus dan tidak bisa dikembalikan."
                        confirmLabel="Ya, hapus"
                        onConfirm={() => hapus(p)}
                        trigger={
                          <button type="button" className="btn btn--ghost btn--icon" aria-label={`Hapus ${p.title}`}>
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
