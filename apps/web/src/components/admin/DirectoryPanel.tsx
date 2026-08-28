import { useEffect, useState } from "react";
import { Icon } from "../ui/Icon";
import { SkeletonDaftar } from "../ui/Skeleton";
import { Avatar } from "../ui/misc/Avatar";
import { Dialog, AlertDialog } from "../ui/overlay/Dialog";
import { ToastProvider, useToast } from "../ui/overlay/Toast";
import { RequireAuth } from "./RequireAuth";
import { daftarKontak, tambahKontak, ubahKontak, hapusKontak, type KontakDirektori, bacaCache, tulisCache} from "../../lib/admin";
import { Select } from "../ui/overlay/Select";

const KATEGORI: [string, string][] = [
  ["klien", "Klien"],
  ["kontraktor", "Kontraktor"],
  ["supplier", "Supplier"],
  ["lainnya", "Lainnya"],
];

function labelKategori(v: string): string {
  return KATEGORI.find(([nilai]) => nilai === v)?.[1] ?? v;
}

function Isi() {
  const toast = useToast();
  const [kontak, setKontak] = useState<KontakDirektori[] | null>(() => bacaCache<KontakDirektori[]>("direktori"));
  const [filter, setFilter] = useState<string>("semua");
  const [dialogTerbuka, setDialogTerbuka] = useState(false);

  const [nama, setNama] = useState("");
  const [kategori, setKategori] = useState("klien");
  const [perusahaan, setPerusahaan] = useState("");
  const [telepon, setTelepon] = useState("");
  const [email, setEmail] = useState("");
  const [menambah, setMenambah] = useState(false);

  function muat() {
    daftarKontak().then((d) => { tulisCache("direktori", d); setKontak(d); }).catch(() => setKontak((l) => l ?? []));
  }

  useEffect(muat, []);

  async function tambah() {
    const namaBersih = nama.trim();
    if (namaBersih.length < 2) return;
    setMenambah(true);
    try {
      await tambahKontak({
        name: namaBersih,
        category: kategori,
        company: perusahaan.trim() || null,
        phone: telepon.trim() || null,
        email: email.trim() || null,
      });
      setNama(""); setPerusahaan(""); setTelepon(""); setEmail("");
      setDialogTerbuka(false);
      muat();
      toast({ judul: "Kontak ditambahkan", nada: "sukses" });
    } catch (e) {
      toast({ judul: "Gagal menambah kontak", keterangan: (e as Error).message, nada: "gagal" });
    } finally {
      setMenambah(false);
    }
  }

  async function ubahCatatan(id: string, note: string) {
    if (!kontak) return;
    const sebelum = kontak;
    setKontak(kontak.map((k) => (k.id === id ? { ...k, note } : k)));
    try {
      await ubahKontak(id, { note });
    } catch (e) {
      setKontak(sebelum);
      toast({ judul: "Gagal menyimpan catatan", keterangan: (e as Error).message, nada: "gagal" });
    }
  }

  async function hapus(id: string) {
    try {
      await hapusKontak(id);
      setKontak((k) => k?.filter((x) => x.id !== id) ?? null);
    } catch (e) {
      toast({ judul: "Gagal menghapus", keterangan: (e as Error).message, nada: "gagal" });
    }
  }

  const terfilter = (kontak ?? []).filter((k) => filter === "semua" || k.category === filter);

  return (
    <div className="stack" style={{ gap: "var(--space-5)" }}>
      <div className="row row--between">
        <span className="t-muted">Klien, kontraktor, atau supplier yang dipakai berulang.</span>
        <Dialog
          open={dialogTerbuka}
          onOpenChange={setDialogTerbuka}
          trigger={<button type="button" className="btn btn--primary"><Icon name="plus" size={16} />Tambah kontak</button>}
          title="Tambah kontak"
          description="Klien, kontraktor, atau supplier yang dipakai berulang."
          footer={
            <button type="button" className="btn btn--primary" disabled={nama.trim().length < 2 || menambah} onClick={tambah}>
              {menambah && <span className="spinner spinner--sm spinner--on-action" />}
              Tambah
            </button>
          }
        >
          <div className="stack">
            <div className="field">
              <label className="field__label" htmlFor="dir-nama">
                Nama<span className="field__req" aria-hidden="true">*</span>
              </label>
              <input id="dir-nama" className="input" value={nama} onChange={(e) => setNama(e.target.value)}
                placeholder="Contoh: Bu Ratna" />
            </div>
            <div className="field">
              <label className="field__label" htmlFor="dir-kategori">Kategori</label>
              <Select
                id="dir-kategori"
                ariaLabel="Kategori kontak"
                value={kategori}
                onValueChange={setKategori}
                options={KATEGORI.map(([value, label]) => ({ value, label }))}
              />
            </div>
            <div className="field">
              <label className="field__label" htmlFor="dir-perusahaan">Perusahaan</label>
              <input id="dir-perusahaan" className="input" value={perusahaan} onChange={(e) => setPerusahaan(e.target.value)}
                placeholder="Opsional" />
            </div>
            <div className="field">
              <label className="field__label" htmlFor="dir-telepon">Telepon</label>
              <input id="dir-telepon" className="input" value={telepon} onChange={(e) => setTelepon(e.target.value)}
                placeholder="Opsional" />
            </div>
            <div className="field">
              <label className="field__label" htmlFor="dir-email">Email</label>
              <input id="dir-email" className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="Opsional" />
            </div>
          </div>
        </Dialog>
      </div>

      <div className="segmented" role="group" aria-label="Filter kategori">
        <button type="button" className="segmented__opt" aria-pressed={filter === "semua"} onClick={() => setFilter("semua")}>
          Semua
        </button>
        {KATEGORI.map(([v, l]) => (
          <button key={v} type="button" className="segmented__opt" aria-pressed={filter === v} onClick={() => setFilter(v)}>
            {l}
          </button>
        ))}
      </div>

      {kontak === null ? (
        <SkeletonDaftar jumlah={3} aksi={2} />
      ) : terfilter.length === 0 ? (
        <div className="empty empty--sm">
          <span className="icon-tile"><Icon name="directory" size={20} /></span>
          <span className="t-subheading">Belum ada kontak di kategori ini</span>
        </div>
      ) : (
        <ul className="stack" style={{ gap: "var(--space-2)", listStyle: "none", padding: 0 }}>
          {terfilter.map((k) => (
            <li key={k.id} className="item item--bordered">
              <Avatar name={k.name} size="sm" />
              <span className="item__text">
                <span className="item__title">{k.name}</span>
                <span className="item__desc">
                  {labelKategori(k.category)}
                  {k.company && ` · ${k.company}`}
                  {k.phone && ` · ${k.phone}`}
                  {k.email && ` · ${k.email}`}
                </span>
                <input
                  className="input"
                  style={{ marginTop: "var(--space-2)", fontSize: "var(--text-sm)" }}
                  defaultValue={k.note ?? ""}
                  placeholder="Catatan (opsional)"
                  onBlur={(e) => { if (e.target.value !== (k.note ?? "")) ubahCatatan(k.id, e.target.value); }}
                  aria-label={`Catatan untuk ${k.name}`}
                />
              </span>
              <AlertDialog
                destructive
                title={`Hapus ${k.name}?`}
                description="Kontak ini beserta catatannya akan dihapus dari direktori."
                confirmLabel="Ya, hapus"
                onConfirm={() => hapus(k.id)}
                trigger={
                  <button type="button" className="btn btn--ghost btn--icon btn--hapus" aria-label={`Hapus ${k.name}`}>
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

export function DirectoryPanel() {
  return (
    <RequireAuth skeleton={<SkeletonDaftar jumlah={3} aksi={2} />}>
      <ToastProvider><Isi /></ToastProvider>
    </RequireAuth>
  );
}
