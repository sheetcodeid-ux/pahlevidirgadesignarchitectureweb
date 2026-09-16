import { useEffect, useRef, useState } from "react";
import { Icon } from "../ui/Icon";
import { SkeletonDaftar } from "../ui/Skeleton";
import { AlertDialog, Dialog } from "../ui/overlay/Dialog";
import { ToastProvider, useToast } from "../ui/overlay/Toast";
import { RequireAuth } from "./RequireAuth";
import { CatatanTerbit, SisiSitus } from "./SisiSitus";
import {
  daftarKlien, buatKlien, ubahKlien, hapusKlien, mintaUrlUnggahLogoKlien,
  bacaCache, tulisCache, jumlahDiingat, type KlienAdmin,
} from "../../lib/admin";
import { bentukLogo } from "../../lib/logoBentuk";

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

  const berlogo = klien?.filter((k) => k.logoUrl).length ?? 0;
  const total = klien?.length ?? 0;

  return (
    <div className="buatpage buatpage--situs">
      <div className="buatpage__utama">
        {/* Pratinjau pita marquee. Ini bagian yang benar-benar dibutuhkan
            halaman ini: sampai sekarang satu-satunya cara memeriksa apakah
            delapan logo terlihat sepadan adalah membuka beranda, dan beranda
            baru berubah setelah build berikutnya. Kotaknya memakai kelas
            .klien-logo yang sama dengan baris di bawah, dan ambang bentuknya
            dari lib/logoBentuk — satu sumber dengan marquee sungguhan. */}
        <section className="buat-kartu">
          <h2 className="buat-kartu__judul">Seperti yang tampil di beranda</h2>
          {total === 0 ? (
            <p className="t-muted" style={{ margin: 0 }}>Belum ada yang bisa ditampilkan.</p>
          ) : (
            <div className="situs-pratinjau situs-pratinjau--pita">
              <div className="klienpita">
                {klien!.map((k) => (
                  <span className="klienpita__sel" key={k.id}>
                    {k.logoUrl
                      ? <img src={k.logoUrl} alt=""
                          onLoad={(e) => {
                            const img = e.currentTarget;
                            img.dataset.bentuk = bentukLogo(img.naturalWidth, img.naturalHeight);
                          }} />
                      : <b className="klienpita__teks">{k.name}</b>}
                  </span>
                ))}
              </div>
            </div>
          )}
          <p className="field__help" style={{ margin: 0 }}>
            Abu-abu seperti di beranda; warnanya baru muncul saat pengunjung
            mengarahkan kursor. Klien tanpa logo tampil sebagai teks nama.
          </p>
        </section>

        <section className="buat-kartu">
          <h2 className="buat-kartu__judul">Daftar klien</h2>

          {klien === null ? (
            <SkeletonDaftar jumlah={jumlahDiingat("klien", 4)} aksi={3} />
          ) : klien.length === 0 ? (
            <div className="empty empty--sm">
              <span className="icon-tile"><Icon name="image" size={20} /></span>
              <span className="t-subheading">Belum ada klien</span>
              <p className="t-muted">Tambahkan namanya dulu, logonya bisa menyusul.</p>
            </div>
          ) : (
            /* Grid kartu, bukan baris teks. Halaman ini mengurus GAMBAR:
               daftar baris menyembunyikan logonya di kotak 24px dan yang
               terbaca cuma namanya — persis keterangan yang paling tidak
               dibutuhkan di sini. Kartu memberi logonya ruang seukuran yang
               dipakai menilainya. */
            <div className="kartugrid">
              {klien.map((k, i) => (
                <article className={`kartugrid__sel${k.logoUrl ? "" : " kartugrid__sel--kosong"}`} key={k.id}>
                  <header className="kartugrid__kop">
                    <span className="kartugrid__urut t-num">{String(i + 1).padStart(2, "0")}</span>
                    <span className="kartugrid__pindah">
                      <button type="button" className="btn btn--ghost btn--icon btn--sm"
                        disabled={i === 0} onClick={() => geser(i, -1)}
                        aria-label={`Naikkan ${k.name}`}>
                        <Icon name="chevronUp" size={14} />
                      </button>
                      <button type="button" className="btn btn--ghost btn--icon btn--sm"
                        disabled={i === klien.length - 1} onClick={() => geser(i, 1)}
                        aria-label={`Turunkan ${k.name}`}>
                        <Icon name="chevronDown" size={14} />
                      </button>
                    </span>
                  </header>

                  <span className="kartugrid__gambar kartugrid__gambar--logo">
                    {k.logoUrl
                      ? (
                        /* Bentuknya baru bisa diketahui setelah berkasnya sampai,
                           jadi dipasang di onLoad — bukan dihitung dari data,
                           yang tidak menyimpan rasio apa pun. */
                        <img src={k.logoUrl} alt=""
                          onLoad={(e) => {
                            const img = e.currentTarget;
                            img.dataset.bentuk = bentukLogo(img.naturalWidth, img.naturalHeight);
                          }} />
                      )
                      : <Icon name="image" size={24} />}
                  </span>

                  <span className="kartugrid__nama">{k.name}</span>
                  <span className="kartugrid__ket">
                    {k.logoUrl
                      ? <><Icon name="check" size={12} />Logo terpasang</>
                      : <><Icon name="alert" size={12} />Tampil sebagai teks nama</>}
                  </span>

                  <footer className="kartugrid__aksi">
                    <input type="file" accept="image/png,image/jpeg,image/webp" hidden
                      ref={(el) => { berkasRef.current[k.id] = el; }}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        e.target.value = "";
                        if (f) unggah(k, f);
                      }} />
                    <button type="button" className="btn btn--secondary btn--sm"
                      disabled={mengunggah === k.id}
                      onClick={() => berkasRef.current[k.id]?.click()}>
                      {mengunggah === k.id
                        ? <span className="spinner spinner--sm" />
                        : <Icon name="upload" size={14} />}
                      {k.logoUrl ? "Ganti" : "Unggah"}
                    </button>

                    {k.logoUrl && (
                      <button type="button" className="btn btn--ghost btn--icon btn--sm"
                        onClick={() => hapusLogo(k)} aria-label={`Hapus logo ${k.name}`}>
                        <Icon name="close" size={14} />
                      </button>
                    )}

                    <AlertDialog
                      destructive
                      title={`Hapus ${k.name}?`}
                      description="Klien ini hilang dari beranda. Berkas logonya tetap di penyimpanan."
                      confirmLabel="Ya, hapus"
                      onConfirm={() => hapus(k.id)}
                      trigger={
                        <button type="button" className="btn btn--ghost btn--icon btn--sm btn--hapus"
                          aria-label={`Hapus ${k.name}`}>
                          <Icon name="trash" size={14} />
                        </button>
                      }
                    />
                  </footer>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      <SisiSitus
        lengkap={total > 0 && berlogo === total}
        status={
          total === 0 ? "Belum ada klien"
            : berlogo === total ? "Semua logo terpasang"
            : `${total - berlogo} belum punya logo`
        }
        tautan="/"
        tautanLabel="Lihat di beranda"
        fakta={[
          { label: "Jumlah klien", nilai: <span className="t-num">{total}</span> },
          { label: "Sudah berlogo", nilai: <span className="t-num">{berlogo}</span> },
          { label: "Tampil teks", nilai: <span className="t-num">{total - berlogo}</span> },
        ]}
      >
        <Dialog
          title="Tambah klien"
          description="Nama dulu; logonya bisa diunggah setelah barisnya ada."
          trigger={
            <button type="button" className="btn btn--primary btn--lift buat-aksi__utama">
              <Icon name="plus" size={15} /> Tambah klien
            </button>
          }
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
        <CatatanTerbit />
      </SisiSitus>
    </div>
  );
}

export function ClientLogosPanel() {
  return (
    <RequireAuth
      skeleton={
        <div className="buatpage buatpage--situs"><div className="buatpage__utama">
          <section className="buat-kartu">
            <SkeletonDaftar jumlah={jumlahDiingat("klien", 4)} aksi={3} />
          </section>
        </div></div>
      }
    >
      <ToastProvider><Isi /></ToastProvider>
    </RequireAuth>
  );
}
