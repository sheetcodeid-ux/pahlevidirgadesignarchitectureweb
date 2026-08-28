import { useEffect, useState } from "react";
import { Icon } from "../ui/Icon";
import { SkeletonDaftar } from "../ui/Skeleton";
import { Avatar } from "../ui/misc/Avatar";
import { Dialog, AlertDialog } from "../ui/overlay/Dialog";
import { ToastProvider, useToast } from "../ui/overlay/Toast";
import { RequireAuth } from "./RequireAuth";
import { daftarTim, tambahAnggotaTim, hapusAnggotaTim, type AnggotaTim, bacaCache, tulisCache} from "../../lib/admin";

function Isi() {
  const toast = useToast();
  const [tim, setTim] = useState<AnggotaTim[] | null>(() => bacaCache<AnggotaTim[]>("tim"));
  const [dialogTerbuka, setDialogTerbuka] = useState(false);
  const [nama, setNama] = useState("");
  const [peran, setPeran] = useState("");
  const [menambah, setMenambah] = useState(false);

  function muat() {
    daftarTim().then((d) => { tulisCache("tim", d); setTim(d); }).catch(() => setTim((l) => l ?? []));
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
      setDialogTerbuka(false);
      muat();
      toast({ judul: "Anggota ditambahkan", nada: "sukses" });
    } catch (e) {
      toast({ judul: "Gagal menambah anggota", keterangan: (e as Error).message, nada: "gagal" });
    } finally {
      setMenambah(false);
    }
  }

  async function hapus(id: string) {
    try {
      await hapusAnggotaTim(id);
      setTim((t) => t?.filter((x) => x.id !== id) ?? null);
    } catch (e) {
      toast({ judul: "Gagal menghapus", keterangan: (e as Error).message, nada: "gagal" });
    }
  }

  return (
    <div className="stack" style={{ gap: "var(--space-5)" }}>
      <div className="row row--between">
        <span className="t-muted">Staf tetap maupun freelancer — bukan akun login.</span>
        <Dialog
          open={dialogTerbuka}
          onOpenChange={setDialogTerbuka}
          trigger={<button type="button" className="btn btn--primary"><Icon name="plus" size={16} />Tambah anggota</button>}
          title="Tambah anggota"
          description="Staf tetap maupun freelancer — bukan akun login."
          footer={
            <button type="button" className="btn btn--primary" disabled={nama.trim().length < 2 || menambah} onClick={tambah}>
              {menambah && <span className="spinner spinner--sm spinner--on-action" />}
              Tambah
            </button>
          }
        >
          <div className="stack">
            <div className="field">
              <label className="field__label" htmlFor="tim-nama">
                Nama<span className="field__req" aria-hidden="true">*</span>
              </label>
              <input id="tim-nama" className="input" value={nama} onChange={(e) => setNama(e.target.value)}
                placeholder="Contoh: Rian Saputra" />
            </div>
            <div className="field">
              <label className="field__label" htmlFor="tim-peran">Peran</label>
              <input id="tim-peran" className="input" value={peran} onChange={(e) => setPeran(e.target.value)}
                placeholder="Contoh: Drafter DED" />
            </div>
          </div>
        </Dialog>
      </div>

      {tim === null ? (
        <SkeletonDaftar jumlah={3} aksi={2} />
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
              <AlertDialog
                destructive
                title={`Hapus ${t.name}?`}
                description="Anggota ini tidak akan lagi muncul di daftar tim maupun sebagai pilihan PIC tugas."
                confirmLabel="Ya, hapus"
                onConfirm={() => hapus(t.id)}
                trigger={
                  <button type="button" className="btn btn--ghost btn--icon btn--hapus" aria-label={`Hapus ${t.name}`}>
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

export function TeamPanel() {
  return (
    <RequireAuth kerangka={<SkeletonDaftar jumlah={3} aksi={2} />}>
      <ToastProvider><Isi /></ToastProvider>
    </RequireAuth>
  );
}
