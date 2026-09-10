import { useEffect, useRef, useState } from "react";
import { Icon } from "../ui/Icon";
import { SkeletonDaftar } from "../ui/Skeleton";
import { AlertDialog, Dialog } from "../ui/overlay/Dialog";
import { ToastProvider, useToast } from "../ui/overlay/Toast";
import { RequireAuth } from "./RequireAuth";
import {
  daftarKlien, buatKlien, ubahKlien, hapusKlien, mintaUrlUnggahLogoKlien,
  bacaCache, tulisCache, jumlahDiingat, type KlienAdmin,
} from "../../lib/admin";

/* Sama dengan logo studio: PNG/JPEG/WebP, maksimal 2 MB. Logo yang lebih
   besar dari itu hampir selalu foto yang salah pilih, bukan logo. */
const TIPE_DIIZINKAN = new Set(["image/png", "image/jpeg", "image/webp"]);
const UKURAN_MAKS = 2 * 1024 * 1024;

function Isi() {
  const toast = useToast();
  const [klien, setKlien] = useState<KlienAdmin[] | null>(() => bacaCache<KlienAdmin[]>("klien"));
  const [nama, setNama] = useState("");
  const [menambah, setMenambah] = useState(false);
  const [mengunggah, setMengunggah] = useState<string | null>(null);
  const berkasRef = useRef<Record<string, HTMLInputElement | null>>({});

  function muat() {
    daftarKlien()
      .then((d) => { tulisCache("klien", d); setKlien(d); })
      .catch(() => setKlien((l) => l ?? []));
  }

  useEffect(muat, []);

  async function tambah() {
    const n = nama.trim();
    if (!n) return;
    setMenambah(true);
    try {
      /* Yang baru masuk ke urutan PALING BELAKANG. Menaruhnya di depan berarti
         setiap klien baru menggeser tampilan beranda tanpa diminta. */
      const urutan = (klien?.reduce((m, k) => Math.max(m, k.sortOrder), 0) ?? 0) + 1;
      await buatKlien({ name: n, sortOrder: urutan });
      setNama("");
      muat();
    } catch (e) {
      toast({ judul: "Gagal menambah klien", keterangan: (e as Error).message, nada: "gagal" });
    } finally {
      setMenambah(false);
    }
  }

  async function unggah(k: KlienAdmin, f: File) {
    if (!TIPE_DIIZINKAN.has(f.type)) {
      toast({ judul: "Format tidak didukung", keterangan: "Pakai PNG, JPG, atau WebP.", nada: "gagal" });
      return;
    }
    if (f.size > UKURAN_MAKS) {
      toast({ judul: "Berkas terlalu besar", keterangan: "Maksimal 2 MB.", nada: "gagal" });
      return;
    }

    setMengunggah(k.id);
    try {
      const target = await mintaUrlUnggahLogoKlien(f.type);
      const res = await fetch(target.uploadUrl, {
        method: "PUT", headers: { "Content-Type": f.type }, body: f,
      });
      if (!res.ok) throw new Error(`Penyimpanan menolak berkas (${res.status})`);
      /* Key baru disimpan SETELAH unggahannya berhasil. Menyimpannya lebih
         dulu berarti baris menunjuk berkas yang mungkin tidak pernah ada. */
      await ubahKlien(k.id, { logoKey: target.key });
      muat();
      toast({ judul: `Logo ${k.name} tersimpan`, nada: "sukses" });
    } catch (e) {
      toast({ judul: "Gagal mengunggah", keterangan: (e as Error).message, nada: "gagal" });
    } finally {
      setMengunggah(null);
    }
  }

  async function hapusLogo(k: KlienAdmin) {
    try {
      await ubahKlien(k.id, { logoKey: null });
      muat();
    } catch (e) {
      toast({ judul: "Gagal menghapus logo", keterangan: (e as Error).message, nada: "gagal" });
    }
  }

  async function hapus(id: string) {
    try {
      await hapusKlien(id);
      setKlien((l) => l?.filter((x) => x.id !== id) ?? null);
    } catch (e) {
      toast({ judul: "Gagal menghapus", keterangan: (e as Error).message, nada: "gagal" });
    }
  }

  /* Pindah urutan dengan MENUKAR sort_order tetangganya, bukan menulis ulang
     seluruh daftar: dua permintaan, bukan delapan, dan urutan yang lain tidak
     ikut berubah kalau salah satunya gagal. */
  async function geser(i: number, arah: -1 | 1) {
    if (!klien) return;
    const j = i + arah;
    if (j < 0 || j >= klien.length) return;
    const a = klien[i], b = klien[j];

    const baru = [...klien];
    baru[i] = { ...b, sortOrder: a.sortOrder };
    baru[j] = { ...a, sortOrder: b.sortOrder };
    setKlien(baru);

    try {
      await ubahKlien(a.id, { sortOrder: b.sortOrder });
      await ubahKlien(b.id, { sortOrder: a.sortOrder });
      muat();
    } catch (e) {
      setKlien(klien);
      toast({ judul: "Gagal mengubah urutan", keterangan: (e as Error).message, nada: "gagal" });
    }
  }

  return (
    <div className="listpage">
      <div className="listpage__pad">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-end", gap: "var(--space-3)" }}>
          <p className="t-muted" style={{ maxWidth: "52ch", margin: 0 }}>
            Logo yang tampil berjalan di beranda. Nama wajib diisi; selama logonya
            belum diunggah, yang tampil namanya sebagai teks — jadi barisnya tidak
            pernah bolong.
          </p>
          <Dialog
            title="Tambah klien"
            description="Nama dulu; logonya bisa diunggah setelah barisnya ada."
            trigger={<button type="button" className="btn btn--primary"><Icon name="plus" size={15} /> Tambah klien</button>}
            footer={
              <button type="button" className="btn btn--primary"
                disabled={nama.trim().length < 1 || menambah} onClick={tambah}>
                {menambah && <span className="spinner spinner--sm spinner--on-action" />}
                Tambah
              </button>
            }
          >
            <div className="field">
              <label className="field__label" htmlFor="kl-nama">
                Nama klien<span className="field__req" aria-hidden="true">*</span>
              </label>
              <input id="kl-nama" className="input" value={nama}
                onChange={(e) => setNama(e.target.value)} placeholder="Contoh: Elsana Coffee" />
            </div>
          </Dialog>
        </div>

        <div className="s16" />

        {klien === null ? (
          <SkeletonDaftar jumlah={jumlahDiingat("klien", 4)} aksi={3} />
        ) : klien.length === 0 ? (
          <div className="empty empty--sm">
            <span className="icon-tile"><Icon name="image" size={20} /></span>
            <span className="t-subheading">Belum ada klien</span>
            <p className="t-muted">Tambahkan namanya dulu, logonya bisa menyusul.</p>
          </div>
        ) : (
          <ul className="stack" style={{ gap: "var(--space-2)", listStyle: "none", padding: 0 }}>
            {klien.map((k, i) => (
              <li key={k.id} className="item item--bordered">
                <span className="klien-logo" aria-hidden="true">
                  {k.logoUrl
                    ? <img src={k.logoUrl} alt="" />
                    : <Icon name="image" size={16} />}
                </span>
                <span className="item__text">
                  <span className="item__title">{k.name}</span>
                  <span className="item__desc">
                    {k.logoUrl ? "Logo terpasang" : "Tampil sebagai teks — logonya belum diunggah"}
                  </span>
                </span>

                <span className="row" style={{ gap: "4px", flexWrap: "nowrap" }}>
                  <button type="button" className="btn btn--ghost btn--icon"
                    disabled={i === 0} onClick={() => geser(i, -1)}
                    aria-label={`Naikkan ${k.name}`}>
                    <Icon name="chevronUp" size={15} />
                  </button>
                  <button type="button" className="btn btn--ghost btn--icon"
                    disabled={i === klien.length - 1} onClick={() => geser(i, 1)}
                    aria-label={`Turunkan ${k.name}`}>
                    <Icon name="chevronDown" size={15} />
                  </button>

                  <input type="file" accept="image/png,image/jpeg,image/webp" hidden
                    ref={(el) => { berkasRef.current[k.id] = el; }}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      e.target.value = "";
                      if (f) unggah(k, f);
                    }} />
                  <button type="button" className="btn btn--secondary"
                    disabled={mengunggah === k.id}
                    onClick={() => berkasRef.current[k.id]?.click()}>
                    {mengunggah === k.id && <span className="spinner spinner--sm" />}
                    {k.logoUrl ? "Ganti logo" : "Unggah logo"}
                  </button>

                  {k.logoUrl && (
                    <button type="button" className="btn btn--ghost btn--icon"
                      onClick={() => hapusLogo(k)} aria-label={`Hapus logo ${k.name}`}>
                      <Icon name="close" size={15} />
                    </button>
                  )}

                  <AlertDialog
                    destructive
                    title={`Hapus ${k.name}?`}
                    description="Klien ini hilang dari beranda. Berkas logonya tetap di penyimpanan."
                    confirmLabel="Ya, hapus"
                    onConfirm={() => hapus(k.id)}
                    trigger={
                      <button type="button" className="btn btn--ghost btn--icon btn--hapus"
                        aria-label={`Hapus ${k.name}`}>
                        <Icon name="trash" size={15} />
                      </button>
                    }
                  />
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export function ClientLogosPanel() {
  return (
    <RequireAuth
      skeleton={
        <div className="listpage"><div className="listpage__pad">
          <SkeletonDaftar jumlah={jumlahDiingat("klien", 4)} aksi={3} />
        </div></div>
      }
    >
      <ToastProvider><Isi /></ToastProvider>
    </RequireAuth>
  );
}
