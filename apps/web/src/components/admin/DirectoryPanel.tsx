import { useEffect, useState } from "react";
import { Icon } from "../ui/Icon";
import { SkeletonTabel } from "../ui/Skeleton";
import { Avatar } from "../ui/misc/Avatar";
import { Dialog, AlertDialog } from "../ui/overlay/Dialog";
import { ToastProvider, useToast } from "../ui/overlay/Toast";
import { DataTable, kolomSkeleton, type Kolom, type Chip } from "../ui/data/DataTable";
import { RequireAuth } from "./RequireAuth";
import { daftarKontak, tambahKontak, ubahKontak, hapusKontak, type KontakDirektori, bacaCache, tulisCache, jumlahDiingat} from "../../lib/admin";
import { Select } from "../ui/overlay/Select";

const KATEGORI: [string, string][] = [
  ["klien", "Klien"],
  ["kontraktor", "Kontraktor"],
  ["supplier", "Supplier"],
  ["lainnya", "Lainnya"],
];

const URUTAN: { value: string; label: string }[] = [
  { value: "nama", label: "Nama A–Z" },
  { value: "baru", label: "Terbaru ditambahkan" },
];

function labelKategori(v: string): string {
  return KATEGORI.find(([nilai]) => nilai === v)?.[1] ?? v;
}

function Isi() {
  const toast = useToast();
  const [kontak, setKontak] = useState<KontakDirektori[] | null>(() => bacaCache<KontakDirektori[]>("direktori"));
  const [dialogTerbuka, setDialogTerbuka] = useState(false);
  const [urut, setUrut] = useState("nama");

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

  const kolom: Kolom<KontakDirektori>[] = [
    {
      judul: "Kontak",
      gambar: true,
      render: (k) => (
        <span className="row" style={{ gap: "var(--space-3)", flexWrap: "nowrap" }}>
          <Avatar name={k.name} size="sm" />
          <span style={{ minWidth: 0 }}>
            <span className="item__title">{k.name}</span>
            {k.company && <div className="attachment__size">{k.company}</div>}
          </span>
        </span>
      ),
    },
    { judul: "Kategori", lebar: "5rem", render: (k) => labelKategori(k.category) },
    {
      judul: "Telepon",
      lebar: "6rem",
      render: (k) => (k.phone ? <a className="t-tautan" href={`tel:${k.phone}`}>{k.phone}</a> : "—"),
    },
    {
      judul: "Email",
      lebar: "8rem",
      render: (k) => (k.email ? <a className="t-tautan" href={`mailto:${k.email}`}>{k.email}</a> : "—"),
    },
    {
      // Catatan tetap bisa disunting langsung di baris. Membuka dialog untuk
      // satu baris teks yang sering diubah justru memperlambat pekerjaan
      // yang paling sering dilakukan di halaman ini.
      judul: "Catatan",
      lebar: "8rem",
      render: (k) => (
        <input
          className="input input--ringkas"
          defaultValue={k.note ?? ""}
          placeholder="Catatan"
          onBlur={(e) => { if (e.target.value !== (k.note ?? "")) ubahCatatan(k.id, e.target.value); }}
          aria-label={`Catatan untuk ${k.name}`}
        />
      ),
    },
    {
      judul: "Aksi",
      kelas: "table__actions",
      lebar: "3.5rem",
      render: (k) => (
        <span className="table__act">
          <AlertDialog
            destructive
            title={`Hapus ${k.name}?`}
            description="Kontak ini beserta catatannya akan dihapus dari direktori."
            confirmLabel="Ya, hapus"
            onConfirm={() => hapus(k.id)}
            trigger={
              <button type="button" className="btn btn--secondary btn--icon btn--boxed btn--hapus" aria-label={`Hapus ${k.name}`}>
                <Icon name="trash" size={15} />
              </button>
            }
          />
        </span>
      ),
    },
  ];

  const chips: Chip<KontakDirektori>[] = [
    { id: "semua", label: "Semua" },
    ...KATEGORI.map(([v, l]) => ({ id: v, label: l, cocok: (k: KontakDirektori) => k.category === v })),
  ];

  const terurut = kontak
    ?.slice()
    .sort((a, b) => (urut === "nama" ? a.name.localeCompare(b.name, "id") : (a.id < b.id ? 1 : -1))) ?? null;

  const tombolTambah = (
    <Dialog
      open={dialogTerbuka}
      onOpenChange={setDialogTerbuka}
      trigger={
        <button type="button" className="btn btn--primary btn--lg btn--lift">
          <Icon name="plus" size={20} />Tambah Kontak
        </button>
      }
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
  );

  return (
    <DataTable
      data={terurut}
      kunci={(k) => k.id}
      kolom={kolom}
      chips={chips}
      aksi={tombolTambah}
      cariPada={(k) => [k.name, k.company, k.phone, k.email, k.note]}
      placeholderCari="Cari nama, perusahaan, telepon, atau email…"
      labelCari="Cari kontak"
      satuan="kontak"
      barisSkeleton={jumlahDiingat("direktori", 5)}
      saringan={
        <div className="field">
          <label className="field__label">Urutkan</label>
          <Select ariaLabel="Urutkan kontak" options={URUTAN} value={urut} onValueChange={setUrut} />
        </div>
      }
      bersihkanAktif={urut !== "nama"}
      onBersihkan={() => setUrut("nama")}
      kosong={{
        ikon: "directory",
        judul: "Belum ada kontak",
        keterangan: "Klien, kontraktor, atau supplier yang dipakai berulang disimpan di sini.",
      }}
    />
  );
}

const KOLOM_TIRUAN = kolomSkeleton<KontakDirektori>([
  { judul: "Kontak", gambar: true, render: () => null },
  { judul: "Kategori", lebar: "5rem", render: () => null },
  { judul: "Telepon", lebar: "6rem", render: () => null },
  { judul: "Email", lebar: "8rem", render: () => null },
  { judul: "Catatan", lebar: "8rem", render: () => null },
  { judul: "Aksi", kelas: "table__actions", lebar: "3.5rem", render: () => null },
]);

export function DirectoryPanel() {
  return (
    <RequireAuth
      skeleton={
        <div className="listpage"><div className="listpage__pad">
          <SkeletonTabel baris={jumlahDiingat("direktori", 5)} kolom={KOLOM_TIRUAN} />
        </div></div>
      }
    >
      <ToastProvider><Isi /></ToastProvider>
    </RequireAuth>
  );
}
