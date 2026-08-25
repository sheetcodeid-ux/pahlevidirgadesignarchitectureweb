import { useEffect, useState } from "react";
import { Icon } from "../ui/Icon";
import { Avatar } from "../ui/misc/Avatar";
import { ToastProvider, useToast } from "../ui/overlay/Toast";
import { RequireAuth } from "./RequireAuth";
import { daftarTim, tambahAnggotaTim, hapusAnggotaTim, type AnggotaTim } from "../../lib/admin";

function Isi() {
  const toast = useToast();
  const [tim, setTim] = useState<AnggotaTim[] | null>(null);
  const [nama, setNama] = useState("");
  const [peran, setPeran] = useState("");
  const [menambah, setMenambah] = useState(false);

  function muat() {
    daftarTim().then(setTim).catch(() => setTim([]));
  }

  useEffect(muat, []);

  async function tambah() {
    const namaBersih = nama.trim();
    if (namaBersih.length < 2) return;
    setMenambah(true);
    try {
      await tambahAnggotaTim(namaBersih, peran.trim() || null);
      setNama("");
      setPeran("");
      muat();
      toast({ judul: "Anggota ditambahkan", nada: "sukses" });
    } catch (e) {
      toast({ judul: "Gagal menambah anggota", keterangan: (e as Error).message, nada: "gagal" });
    } finally {
      setMenambah(false);
    }
  }

  async function hapus(id: string, namaOrang: string) {
    if (!confirm(`Hapus ${namaOrang} dari tim?`)) return;
    try {
      await hapusAnggotaTim(id);
      setTim((t) => t?.filter((x) => x.id !== id) ?? null);
    } catch (e) {
      toast({ judul: "Gagal menghapus", keterangan: (e as Error).message, nada: "gagal" });
    }
  }

  return (
    <div className="stack" style={{ gap: "var(--space-5)" }}>
      <div className="card">
        <div className="card__header">
          <span className="icon-tile"><Icon name="team" size={20} /></span>
          <span className="card__titles">
            <span className="t-subheading">Tambah anggota</span>
            <span className="t-muted">Staf tetap maupun freelancer — bukan akun login.</span>
          </span>
        </div>
        <div className="card__body">
          <div className="spec-grid">
            <div className="field">
              <label className="field__label" htmlFor="tim-nama">Nama</label>
              <input id="tim-nama" className="input" value={nama} onChange={(e) => setNama(e.target.value)}
                placeholder="Contoh: Rian Saputra" />
            </div>
            <div className="field">
              <label className="field__label" htmlFor="tim-peran">Peran</label>
              <input id="tim-peran" className="input" value={peran} onChange={(e) => setPeran(e.target.value)}
                placeholder="Contoh: Drafter DED" />
            </div>
          </div>
          <div className="row row--end" style={{ marginTop: "var(--space-4)" }}>
            <button type="button" className="btn btn--primary" disabled={nama.trim().length < 2 || menambah} onClick={tambah}>
              <Icon name="plus" size={15} />Tambah
            </button>
          </div>
        </div>
      </div>

      {tim === null ? (
        <div className="stack">{[0, 1, 2].map((i) => <span key={i} className="skeleton" style={{ height: "4rem" }} />)}</div>
      ) : tim.length === 0 ? (
        <div className="empty empty--sm">
          <span className="icon-tile"><Icon name="team" size={20} /></span>
          <span className="t-subheading">Belum ada anggota tim</span>
        </div>
      ) : (
        <ul className="stack" style={{ gap: "var(--space-2)", listStyle: "none", padding: 0 }}>
          {tim.map((t) => (
            <li key={t.id} className="item item--bordered">
              <Avatar name={t.name} size="sm" />
              <span className="item__text">
                <span className="item__title">{t.name}</span>
                {t.role && <span className="item__desc">{t.role}</span>}
              </span>
              <button type="button" className="btn btn--ghost btn--icon" aria-label={`Hapus ${t.name}`}
                onClick={() => hapus(t.id, t.name)}>
                <Icon name="trash" size={15} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function TeamPanel() {
  return (
    <RequireAuth>
      <ToastProvider><Isi /></ToastProvider>
    </RequireAuth>
  );
}
