import { useEffect, useState } from "react";
import { ToastProvider, useToast } from "../kit/Toast";
import { Dialog } from "../kit/Overlay";
import { RequireAuth } from "./RequireAuth";
import { Tombol, TombolIkon } from "../kit/Tombol";
import { Isian } from "../kit/Isian";
import { CaretLeft, CaretRight, NotePencil, Plus, X } from "../kit/ikon";
import { HalamanSitus, KepalaBagian } from "./situsKit";
import { HapusBaris } from "./daftarKit";
import {
  daftarOrangStudio,
  buatOrangStudio,
  ubahOrangStudio,
  hapusOrangStudio,
  mintaUrlUnggahStudio,
  bacaCache,
  tulisCache,
  type OrangStudio,
} from "../../lib/admin";

/* =============================================================================
   Tim Studio — kartu orang di halaman /studio.

   Dari TimStudioPanel lama: potret 4:5 seperti di situs, nama boleh kosong
   (kartunya tampil bertanda menunggu), urutan ditukar dua tetangga, dan
   satu orang disebut lengkap kalau punya nama DAN foto.

   Yang baru: nama, peran, dan label slot bisa DIUBAH setelah kartunya ada.
   Panel lama cuma bisa mengisinya saat membuat — padahal kartu memang
   sengaja dibuat tanpa nama dulu, jadi nama yang menyusul tidak pernah
   punya tempat untuk diketik.
   ============================================================================= */

const MAKS_BYTE = 4 * 1024 * 1024;
const JENIS_SAH = ["image/png", "image/jpeg", "image/webp"];

function Isi() {
  const toast = useToast();
  const [orang, setOrang] = useState<OrangStudio[] | null>(() => bacaCache<OrangStudio[]>("tim-studio"));
  const [mengunggah, setMengunggah] = useState<string | null>(null);

  function muat() {
    daftarOrangStudio()
      .then((d) => {
        tulisCache("tim-studio", d);
        setOrang(d);
      })
      .catch(() => setOrang((l) => l ?? []));
  }
  useEffect(muat, []);

  const nama = (o: OrangStudio) => o.name ?? o.role;

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
      toast({ judul: "Foto terpasang", keterangan: "Tekan Terbitkan supaya tampil di situs.", nada: "sukses" });
    } catch (e) {
      toast({ judul: "Gagal mengunggah", keterangan: (e as Error).message, nada: "gagal" });
    } finally {
      setMengunggah(null);
    }
  }

  async function lepasFoto(o: OrangStudio) {
    try {
      await ubahOrangStudio(o.id, { photoKey: null });
      muat();
    } catch (e) {
      toast({ judul: "Gagal melepas foto", keterangan: (e as Error).message, nada: "gagal" });
    }
  }

  async function hapus(o: OrangStudio) {
    try {
      await hapusOrangStudio(o.id);
      setOrang((l) => l?.filter((x) => x.id !== o.id) ?? l);
      toast({ judul: `${nama(o)} dihapus`, nada: "sukses" });
    } catch (e) {
      toast({ judul: "Gagal menghapus", keterangan: (e as Error).message, nada: "gagal" });
    }
  }

  async function geser(i: number, arah: -1 | 1) {
    if (!orang) return;
    const j = i + arah;
    if (j < 0 || j >= orang.length) return;
    const a = orang[i]!;
    const b = orang[j]!;
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

  const total = orang?.length ?? 0;
  const berfoto = orang?.filter((o) => o.photoUrl).length ?? 0;
  const bernama = orang?.filter((o) => o.name).length ?? 0;
  const lengkap = orang?.filter((o) => o.photoUrl && o.name).length ?? 0;

  return (
    <HalamanSitus
      lengkap={total > 0 && lengkap === total}
      status={total === 0 ? "Belum ada anggota" : lengkap === total ? "Semua lengkap" : `${total - lengkap} masih kurang`}
      tautan="/studio/"
      tautanLabel="Lihat di halaman Studio"
      fakta={[
        { label: "Jumlah orang", nilai: total },
        { label: "Sudah berfoto", nilai: berfoto },
        { label: "Sudah bernama", nilai: bernama },
      ]}
      aksi={
        <DialogOrang
          urutan={(orang ?? []).reduce((m, o) => Math.max(m, o.sortOrder), 0) + 1}
          onSelesai={muat}
          pemicu={
            <Tombol ukuran="large" jenis="primary" kiri={Plus}>
              Tambah orang
            </Tombol>
          }
        />
      }
    >
      <section className="pf__bagian">
        <KepalaBagian judul="Pratinjau halaman Studio" />
        {total === 0 ? (
          <p className="pf__fotoket">Belum ada yang bisa ditampilkan.</p>
        ) : (
          <div className="ih ts-pita">
            {orang!.map((o) => (
              <div className="ts-pita__sel" key={o.id}>
                <span className="ts-pita__foto">
                  {o.photoUrl ? <img src={o.photoUrl} alt="" /> : <span>{o.slotLabel}</span>}
                </span>
                <b>{o.name ?? <em className="ih__tunggu">Nama menyusul</em>}</b>
                <small>{o.role}</small>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="pf__bagian">
        <KepalaBagian judul="Daftar anggota" kanan={`${total} orang`} />
        {orang === null ? (
          <p className="pf__fotoket">Memuat…</p>
        ) : orang.length === 0 ? (
          <p className="pf__fotoket">Belum ada anggota. Seksi tim di halaman Studio kosong sampai ada yang ditambahkan.</p>
        ) : (
          <ul className="pf__kisi ts-kisi">
            {orang.map((o, i) => (
              <li key={o.id} className="pf__ubin">
                <span className="ts-ubin__foto">
                  {o.photoUrl ? <img src={o.photoUrl} alt="" /> : <span>{o.slotLabel}</span>}
                  <span className="lk-ubin__urut">{String(i + 1).padStart(2, "0")}</span>
                </span>
                <span className="lk-ubin__teks">
                  <b>{o.name ?? "Nama belum diisi"}</b>
                  <small data-ada={o.photoUrl && o.name ? "" : undefined}>
                    <span aria-hidden="true" />
                    {!o.photoUrl ? "Fotonya belum diunggah" : !o.name ? "Namanya belum diisi" : o.role}
                  </small>
                </span>
                <div className="pf__ubinaksi lk-ubin">
                  <TombolIkon ikon={CaretLeft} ukuran="xsmall" jenis="ghost" judul={`Majukan ${nama(o)}`} disabled={i === 0} onClick={() => geser(i, -1)} />
                  <TombolIkon
                    ikon={CaretRight}
                    ukuran="xsmall"
                    jenis="ghost"
                    judul={`Mundurkan ${nama(o)}`}
                    disabled={i === orang.length - 1}
                    onClick={() => geser(i, 1)}
                  />
                  <label className="pf__jadisampul lk-ubin__unggah">
                    {mengunggah === o.id ? "Mengunggah…" : o.photoUrl ? "Ganti foto" : "Unggah foto"}
                    <input
                      type="file"
                      className="sr-only"
                      accept="image/png,image/jpeg,image/webp"
                      aria-label={`Pilih foto ${nama(o)}`}
                      disabled={mengunggah === o.id}
                      onChange={(e) => {
                        const f = e.currentTarget.files?.[0];
                        e.currentTarget.value = "";
                        if (f) unggah(o, f);
                      }}
                    />
                  </label>
                  <span className="lk-ubin__dorong" />
                  <DialogOrang
                    awal={o}
                    onSelesai={muat}
                    pemicu={<TombolIkon ikon={NotePencil} ukuran="xsmall" jenis="ghost" judul={`Ubah ${nama(o)}`} />}
                  />
                  {o.photoUrl && (
                    <TombolIkon ikon={X} ukuran="xsmall" jenis="ghost" judul={`Lepas foto ${nama(o)}`} onClick={() => lepasFoto(o)} />
                  )}
                  <HapusBaris
                    judul={`Hapus ${nama(o)}?`}
                    keterangan="Kartunya hilang dari halaman Studio. Berkas fotonya tetap di penyimpanan."
                    label={`Hapus ${nama(o)}`}
                    onHapus={() => hapus(o)}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </HalamanSitus>
  );
}

/* Satu dialog untuk tambah DAN ubah, dikendalikan supaya menutup sendiri
   sesudah tersimpan. */
function DialogOrang({
  awal,
  urutan = 0,
  pemicu,
  onSelesai,
}: {
  awal?: OrangStudio;
  urutan?: number;
  pemicu: React.ReactNode;
  onSelesai: () => void;
}) {
  const toast = useToast();
  const [buka, setBuka] = useState(false);
  const [nama, setNama] = useState("");
  const [peran, setPeran] = useState("");
  const [slot, setSlot] = useState("STAFF");
  const [kirim, setKirim] = useState(false);
  const alasan = peran.trim().length < 2 ? "Isi perannya dulu, minimal 2 huruf." : null;

  async function simpan() {
    if (alasan) return;
    setKirim(true);
    /* Nama kosong dikirim null, bukan "": /studio memeriksa null untuk
       menampilkan penanda "menunggu". */
    const isi = { name: nama.trim() || null, role: peran.trim(), slotLabel: slot.trim() || "STAFF" };
    try {
      if (awal) await ubahOrangStudio(awal.id, isi);
      else await buatOrangStudio({ ...isi, sortOrder: urutan });
      setBuka(false);
      onSelesai();
      toast({ judul: awal ? "Kartu diperbarui" : "Anggota tim ditambahkan", keterangan: isi.name ?? isi.role, nada: "sukses" });
    } catch (e) {
      toast({ judul: "Gagal menyimpan", keterangan: (e as Error).message, nada: "gagal" });
    } finally {
      setKirim(false);
    }
  }

  return (
    <Dialog
      open={buka}
      onOpenChange={(b) => {
        setBuka(b);
        if (b) {
          setNama(awal?.name ?? "");
          setPeran(awal?.role ?? "");
          setSlot(awal?.slotLabel ?? "STAFF");
        }
      }}
      title={awal ? `Ubah ${awal.name ?? awal.role}` : "Tambah anggota tim"}
      trigger={pemicu}
      footer={
        <div className="kd-form__kaki">
          {alasan && <small className="kd-form__alasan">{alasan}</small>}
          <Tombol memuat={kirim} ukuran="large" jenis="primary" disabled={Boolean(alasan) || kirim} onClick={simpan}>
            {kirim ? "Menyimpan…" : "Simpan"}
          </Tombol>
        </div>
      }
    >
      <div className="kd-form">
        <Isian
          label="Peran"
          placeholder="mis. Project coordinator"
          value={peran}
          onChange={(e) => setPeran(e.currentTarget.value)}
        />
        <Isian
          label="Nama"
          placeholder="Boleh dikosongkan dulu"
          value={nama}
          onChange={(e) => setNama(e.currentTarget.value)}
        />
        <Isian
          label="Label slot foto"
          value={slot}
          onChange={(e) => setSlot(e.currentTarget.value)}
        />
      </div>
    </Dialog>
  );
}

export function TimStudioKit() {
  return (
    <RequireAuth skeleton={<div className="pas pas--rangka" />}>
      <ToastProvider>
        <Isi />
      </ToastProvider>
    </RequireAuth>
  );
}
