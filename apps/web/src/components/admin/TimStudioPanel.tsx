import { useEffect, useRef, useState } from "react";
import { Icon } from "../ui/Icon";
import { SkeletonDaftar } from "../ui/Skeleton";
import { AlertDialog, Dialog } from "../ui/overlay/Dialog";
import { ToastProvider, useToast } from "../ui/overlay/Toast";
import { RequireAuth } from "./RequireAuth";
import { CatatanTerbit, SisiSitus } from "./SisiSitus";
import {
  daftarOrangStudio, buatOrangStudio, ubahOrangStudio, hapusOrangStudio,
  mintaUrlUnggahStudio, bacaCache, tulisCache, jumlahDiingat, type OrangStudio,
} from "../../lib/admin";

/* Potret 4:5. Batas 4 MB, bukan 2 MB seperti logo: ini foto orang, dan foto
   orang yang layak tayang memang lebih berat daripada sebuah logo. */
const MAKS_BYTE = 4 * 1024 * 1024;
const JENIS_SAH = ["image/png", "image/jpeg", "image/webp"];

function Isi() {
  const toast = useToast();
  const [orang, setOrang] = useState<OrangStudio[] | null>(
    () => bacaCache<OrangStudio[]>("tim-studio"),
  );
  const [nama, setNama] = useState("");
  const [peran, setPeran] = useState("");
  const [slot, setSlot] = useState("STAFF");
  const [menambah, setMenambah] = useState(false);
  const [mengunggah, setMengunggah] = useState<string | null>(null);
  const berkasRef = useRef<Record<string, HTMLInputElement | null>>({});

  function muat() {
    daftarOrangStudio()
      .then((d) => { tulisCache("tim-studio", d); setOrang(d); })
      .catch(() => setOrang((l) => l ?? []));
  }
  useEffect(muat, []);

  async function tambah() {
    if (!peran.trim()) return;
    setMenambah(true);
    try {
      const urutan = (orang?.reduce((m, o) => Math.max(m, o.sortOrder), 0) ?? 0) + 1;
      await buatOrangStudio({
        // Nama dikirim null kalau kosong, bukan string kosong: halaman /studio
        // memeriksa null untuk memutuskan menampilkan penanda "menunggu".
        name: nama.trim() || null,
        role: peran.trim(),
        slotLabel: slot.trim() || "STAFF",
        sortOrder: urutan,
      });
      setNama(""); setPeran(""); setSlot("STAFF");
      muat();
      toast({ judul: "Anggota tim ditambahkan", nada: "sukses" });
    } catch (e) {
      toast({ judul: "Gagal menambahkan", keterangan: (e as Error).message, nada: "gagal" });
    } finally {
      setMenambah(false);
    }
  }

  async function unggah(o: OrangStudio, f: File) {
    if (!JENIS_SAH.includes(f.type)) {
      toast({ judul: "Jenis berkas tidak didukung", keterangan: "PNG, JPG, atau WebP.", nada: "gagal" });
      return;
    }
    if (f.size > MAKS_BYTE) {
      toast({ judul: "Berkas terlalu besar", keterangan: "Maksimal 4 MB.", nada: "gagal" });
      return;
    }
    setMengunggah(o.id);
    try {
      const target = await mintaUrlUnggahStudio(f.type);
      const res = await fetch(target.uploadUrl, { method: "PUT", headers: { "Content-Type": f.type }, body: f });
      if (!res.ok) throw new Error(`Penyimpanan menolak berkas (${res.status})`);
      await ubahOrangStudio(o.id, { photoKey: target.key });
      muat();
      toast({ judul: "Foto terpasang", keterangan: "Tekan Terbitkan di bilah atas supaya tampil di situs.", nada: "sukses" });
    } catch (e) {
      toast({ judul: "Gagal mengunggah", keterangan: (e as Error).message, nada: "gagal" });
    } finally {
      setMengunggah(null);
    }
  }

  async function hapusFoto(o: OrangStudio) {
    try {
      await ubahOrangStudio(o.id, { photoKey: null });
      muat();
    } catch (e) {
      toast({ judul: "Gagal menghapus foto", keterangan: (e as Error).message, nada: "gagal" });
    }
  }

  async function hapus(id: string) {
    try {
      await hapusOrangStudio(id);
      setOrang((l) => l?.filter((x) => x.id !== id) ?? null);
    } catch (e) {
      toast({ judul: "Gagal menghapus", keterangan: (e as Error).message, nada: "gagal" });
    }
  }

  /* Menukar sort_order dua tetangga, bukan menulis ulang seluruh daftar: dua
     permintaan alih-alih sebanyak anggotanya, dan urutan yang lain tidak ikut
     berubah kalau salah satunya gagal. */
  async function geser(i: number, arah: -1 | 1) {
    if (!orang) return;
    const j = i + arah;
    if (j < 0 || j >= orang.length) return;
    const a = orang[i], b = orang[j];
    const baru = [...orang];
    baru[i] = { ...b, sortOrder: a.sortOrder };
    baru[j] = { ...a, sortOrder: b.sortOrder };
    setOrang(baru);
    try {
      await ubahOrangStudio(a.id, { sortOrder: b.sortOrder });
      await ubahOrangStudio(b.id, { sortOrder: a.sortOrder });
      muat();
    } catch (e) {
      setOrang(orang);
      toast({ judul: "Gagal mengubah urutan", keterangan: (e as Error).message, nada: "gagal" });
    }
  }

  const kerangka = (
    <div className="buatpage buatpage--situs"><div className="buatpage__utama">
      <section className="buat-kartu">
        <SkeletonDaftar jumlah={jumlahDiingat("tim-studio", 2)} aksi={4} />
      </section>
    </div></div>
  );
  if (orang === null) return kerangka;

  const berfoto = orang.filter((o) => o.photoUrl).length;
  const bernama = orang.filter((o) => o.name).length;
  const total = orang.length;
  /* Satu orang disebut lengkap kalau punya nama DAN foto — bukan salah
     satunya. Versi sebelumnya memakai min(berfoto, bernama), yang menghitung
     dua orang setengah-lengkap sebagai satu orang lengkap. */
  const lengkapBenar = orang.filter((o) => o.photoUrl && o.name).length;

  return (
    <div className="buatpage buatpage--situs">
      <div className="buatpage__utama">
        {/* Pratinjau kartu tim persis seperti di /studio: potret 4:5, nama
            tebal, peran abu di bawahnya. Halaman ini mengurus tampilan, jadi
            yang harus terlihat di sini adalah tampilannya — bukan daftar
            baris yang tidak memberi tahu apa pun soal hasilnya. */}
        <section className="buat-kartu">
          <h2 className="buat-kartu__judul">Seperti yang tampil di halaman Studio</h2>
          {total === 0 ? (
            <p className="t-muted" style={{ margin: 0 }}>Belum ada yang bisa ditampilkan.</p>
          ) : (
            <div className="situs-pratinjau">
              <div className="timpratinjau">
                {orang.map((o) => (
                  <div className="timpratinjau__sel" key={o.id}>
                    <span className="timpratinjau__foto">
                      {o.photoUrl
                        ? <img src={o.photoUrl} alt="" />
                        : <span className="tim-foto__slot">{o.slotLabel}</span>}
                    </span>
                    <span className="timpratinjau__nm">
                      {o.name ?? <em className="t-muted">Nama menyusul</em>}
                    </span>
                    <span className="timpratinjau__pr">{o.role}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <p className="field__help" style={{ margin: 0 }}>
            Di situs, fotonya tampil bertitik warna teal dan baru jadi foto asli
            saat kursor diarahkan. Urutan di sini menentukan urutan di sana.
          </p>
        </section>

        <section className="buat-kartu">
          <h2 className="buat-kartu__judul">Daftar anggota</h2>
          {orang.length === 0 ? (
            <div className="empty empty--sm">
              <span className="icon-tile"><Icon name="team" size={22} /></span>
              <span className="t-subheading">Belum ada anggota tim</span>
              <p className="t-muted">Seksi tim di halaman Studio kosong sampai ada yang ditambahkan.</p>
            </div>
          ) : (
            /* Grid kartu berpotret 4:5, sama bentuknya dengan kartu tim di
               /studio. Daftar baris memampatkan fotonya jadi kotak 24px —
               dan foto wajah adalah satu-satunya hal di halaman ini yang
               benar-benar perlu dilihat sebelum diterbitkan. */
            <div className="kartugrid kartugrid--potret">
              {orang.map((o, i) => (
                <article className={`kartugrid__sel${o.photoUrl ? "" : " kartugrid__sel--kosong"}`} key={o.id}>
                  <header className="kartugrid__kop">
                    <span className="kartugrid__urut t-num">{String(i + 1).padStart(2, "0")}</span>
                    <span className="kartugrid__pindah">
                      <button type="button" className="btn btn--ghost btn--icon btn--sm"
                        disabled={i === 0} onClick={() => geser(i, -1)}
                        aria-label={`Naikkan ${o.name ?? o.role}`}>
                        <Icon name="chevronUp" size={14} />
                      </button>
                      <button type="button" className="btn btn--ghost btn--icon btn--sm"
                        disabled={i === orang.length - 1} onClick={() => geser(i, 1)}
                        aria-label={`Turunkan ${o.name ?? o.role}`}>
                        <Icon name="chevronDown" size={14} />
                      </button>
                    </span>
                  </header>

                  <span className="kartugrid__gambar kartugrid__gambar--potret">
                    {o.photoUrl
                      ? <img src={o.photoUrl} alt="" />
                      : <span className="tim-foto__slot">{o.slotLabel}</span>}
                  </span>

                  <span className="kartugrid__nama">
                    {o.name ?? <em className="t-muted">Nama belum diisi</em>}
                  </span>
                  <span className="kartugrid__ket">{o.role}</span>
                  {!o.photoUrl && (
                    <span className="kartugrid__ket kartugrid__ket--kurang">
                      <Icon name="alert" size={12} />Fotonya belum diunggah
                    </span>
                  )}

                  <footer className="kartugrid__aksi">
                    <input type="file" accept="image/png,image/jpeg,image/webp" hidden
                      ref={(el) => { berkasRef.current[o.id] = el; }}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        e.target.value = "";
                        if (f) unggah(o, f);
                      }} />
                    <button type="button" className="btn btn--secondary btn--sm"
                      disabled={mengunggah === o.id}
                      onClick={() => berkasRef.current[o.id]?.click()}>
                      {mengunggah === o.id
                        ? <span className="spinner spinner--sm" />
                        : <Icon name="upload" size={14} />}
                      {o.photoUrl ? "Ganti" : "Unggah"}
                    </button>

                    {o.photoUrl && (
                      <button type="button" className="btn btn--ghost btn--icon btn--sm"
                        onClick={() => hapusFoto(o)} aria-label={`Hapus foto ${o.name ?? o.role}`}>
                        <Icon name="close" size={14} />
                      </button>
                    )}

                    <AlertDialog
                      destructive
                      title={`Hapus ${o.name ?? o.role}?`}
                      description="Kartunya hilang dari halaman Studio. Berkas fotonya tetap di penyimpanan."
                      confirmLabel="Hapus"
                      onConfirm={() => hapus(o.id)}
                      trigger={
                        <button type="button" className="btn btn--ghost btn--icon btn--sm btn--hapus"
                          aria-label={`Hapus ${o.name ?? o.role}`}>
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
        lengkap={total > 0 && lengkapBenar === total}
        status={
          total === 0 ? "Belum ada anggota"
            : lengkapBenar === total ? "Semua lengkap"
            : `${total - lengkapBenar} masih kurang`
        }
        tautan="/studio/"
        tautanLabel="Lihat di halaman Studio"
        fakta={[
          { label: "Jumlah orang", nilai: <span className="t-num">{total}</span> },
          { label: "Sudah berfoto", nilai: <span className="t-num">{berfoto}</span> },
          { label: "Sudah bernama", nilai: <span className="t-num">{bernama}</span> },
        ]}
      >
        <Dialog
          title="Tambah anggota tim"
          description="Peran dulu; nama dan fotonya bisa menyusul."
          trigger={
            <button type="button" className="btn btn--primary btn--lift buat-aksi__utama">
              <Icon name="plus" size={15} /> Tambah orang
            </button>
          }
          footer={
            <button type="button" className="btn btn--primary"
              disabled={peran.trim().length < 2 || menambah} onClick={tambah}>
              {menambah && <span className="spinner spinner--sm spinner--on-action" />}
              Tambah
            </button>
          }
        >
          <div className="stack">
            <div className="field">
              <label className="field__label" htmlFor="tim-peran">
                Peran<span className="field__req" aria-hidden="true">*</span>
              </label>
              <input id="tim-peran" className="input input--panel" value={peran}
                placeholder="Contoh: Project coordinator"
                onChange={(e) => setPeran(e.target.value)} />
              <p className="field__help">Inilah baris abu di bawah nama, di halaman Studio.</p>
            </div>
            <div className="field">
              <label className="field__label" htmlFor="tim-nama">Nama</label>
              <input id="tim-nama" className="input input--panel" value={nama}
                placeholder="Boleh dikosongkan dulu"
                onChange={(e) => setNama(e.target.value)} />
              <p className="field__help">Kosong = kartunya tampil bertanda menunggu.</p>
            </div>
            <div className="field">
              <label className="field__label" htmlFor="tim-slot">Label slot foto</label>
              <input id="tim-slot" className="input input--panel" value={slot}
                onChange={(e) => setSlot(e.target.value)} />
              <p className="field__help">Tulisan di kotak foto selama fotonya belum ada.</p>
            </div>
          </div>
        </Dialog>
        <CatatanTerbit />
      </SisiSitus>
    </div>
  );
}

export function TimStudioPanel() {
  return (
    <RequireAuth>
      <ToastProvider>
        <Isi />
      </ToastProvider>
    </RequireAuth>
  );
}
