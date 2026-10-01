import { useEffect, useState } from "react";
import { ToastProvider, useToast } from "../kit/Toast";
import { Dialog } from "../kit/Overlay";
import { RequireAuth } from "./RequireAuth";
import { Tombol, TombolIkon } from "../kit/Tombol";
import { Isian } from "../kit/Isian";
import { Ikon } from "../kit/Ikon";
import { CaretLeft, CaretRight, ImageSquare, Plus, X } from "../kit/ikon";
import { HalamanSitus, KepalaBagian } from "./situsKit";
import { HapusBaris } from "./daftarKit";
import {
  daftarKlien,
  buatKlien,
  ubahKlien,
  hapusKlien,
  mintaUrlUnggahLogoKlien,
  bacaCache,
  tulisCache,
  type KlienAdmin,
} from "../../lib/admin";
import { bentukLogo } from "../../lib/logoBentuk";

/* =============================================================================
   Logo Klien — pita logo di beranda.

   Logikanya dari ClientLogosPanel lama, alasannya tetap:
   - Pratinjau pita memakai ambang bentuk yang SAMA dengan marquee
     (lib/logoBentuk) — pemilik menyetujui satu ukuran di sini dan harus
     mendapat ukuran yang sama di situs.
   - Klien tanpa logo tetap tampil, sebagai teks nama.
   - Yang baru masuk ke urutan paling belakang; pindah urutan menukar
     sort_order dua tetangga.
   - Kunci logo baru disimpan SETELAH unggahannya berhasil.

   Kartunya kisi foto yang sama dengan Halaman Publik (.pf__kisi/.pf__ubin),
   dengan logonya DIMUAT utuh, bukan dipotong: yang dinilai bentuk utuhnya.
   ============================================================================= */

const TIPE_DIIZINKAN = new Set(["image/png", "image/jpeg", "image/webp"]);
const UKURAN_MAKS = 2 * 1024 * 1024;

const pasangBentuk = (e: React.SyntheticEvent<HTMLImageElement>) => {
  const img = e.currentTarget;
  img.dataset.bentuk = bentukLogo(img.naturalWidth, img.naturalHeight);
};

function Isi() {
  const toast = useToast();
  const [klien, setKlien] = useState<KlienAdmin[] | null>(() => bacaCache<KlienAdmin[]>("klien"));
  const [mengunggah, setMengunggah] = useState<string | null>(null);

  function muat() {
    daftarKlien()
      .then((d) => {
        tulisCache("klien", d);
        setKlien(d);
      })
      .catch(() => setKlien((l) => l ?? []));
  }
  useEffect(muat, []);

  async function unggah(k: KlienAdmin, f: File) {
    if (!TIPE_DIIZINKAN.has(f.type)) {
      toast({ judul: "Format tidak didukung", keterangan: "Pakai PNG, JPG, atau WebP.", nada: "gagal" });
      return;
    }
    if (f.size > UKURAN_MAKS) {
      toast({ judul: "Berkas terlalu besar", keterangan: "Maksimal 2 MB — logo sebesar itu biasanya foto yang salah pilih.", nada: "gagal" });
      return;
    }
    setMengunggah(k.id);
    try {
      const target = await mintaUrlUnggahLogoKlien(f.type);
      const res = await fetch(target.uploadUrl, { method: "PUT", headers: { "Content-Type": f.type }, body: f });
      if (!res.ok) throw new Error(`Penyimpanan menolak berkas (${res.status})`);
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
      toast({ judul: `Logo ${k.name} dilepas`, keterangan: "Tampil sebagai teks nama.", nada: "sukses" });
    } catch (e) {
      toast({ judul: "Gagal melepas logo", keterangan: (e as Error).message, nada: "gagal" });
    }
  }

  async function hapus(k: KlienAdmin) {
    try {
      await hapusKlien(k.id);
      setKlien((l) => l?.filter((x) => x.id !== k.id) ?? l);
      toast({ judul: `${k.name} dihapus`, nada: "sukses" });
    } catch (e) {
      toast({ judul: "Gagal menghapus", keterangan: (e as Error).message, nada: "gagal" });
    }
  }

  async function geser(i: number, arah: -1 | 1) {
    if (!klien) return;
    const j = i + arah;
    if (j < 0 || j >= klien.length) return;
    const a = klien[i]!;
    const b = klien[j]!;
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

  const total = klien?.length ?? 0;
  const berlogo = klien?.filter((k) => k.logoUrl).length ?? 0;

  return (
    <HalamanSitus
      lengkap={total > 0 && berlogo === total}
      status={total === 0 ? "Belum ada klien" : berlogo === total ? "Semua logo terpasang" : `${total - berlogo} belum punya logo`}
      tautan="/"
      tautanLabel="Lihat di beranda"
      fakta={[
        { label: "Jumlah klien", nilai: total },
        { label: "Sudah berlogo", nilai: berlogo },
        { label: "Tampil sebagai teks", nilai: total - berlogo },
      ]}
      aksi={<DialogKlien urutan={(klien ?? []).reduce((m, k) => Math.max(m, k.sortOrder), 0) + 1} onSelesai={muat} />}
    >
      <section className="pf__bagian">
        <KepalaBagian judul="Seperti yang tampil di beranda" kanan="Arahkan kursor untuk melihat warnanya" />
        {total === 0 ? (
          <p className="pf__fotoket">Belum ada yang bisa ditampilkan.</p>
        ) : (
          <div className="ih lk-pita">
            {klien!.map((k) => (
              <span className="lk-pita__sel" key={k.id}>
                {k.logoUrl ? <img src={k.logoUrl} alt={k.name} onLoad={pasangBentuk} /> : <b>{k.name}</b>}
              </span>
            ))}
          </div>
        )}
        <p className="pf__statusket">
          Abu-abu seperti di beranda; warnanya baru muncul saat pengunjung mengarahkan kursor. Klien tanpa logo tampil
          sebagai teks nama.
        </p>
      </section>

      <section className="pf__bagian">
        <KepalaBagian judul="Daftar klien" kanan={`${total} klien · urut seperti di beranda`} />
        {klien === null ? (
          <p className="pf__fotoket">Memuat klien…</p>
        ) : klien.length === 0 ? (
          <p className="pf__fotoket">Belum ada klien. Tambahkan namanya dulu, logonya bisa menyusul.</p>
        ) : (
          <ul className="pf__kisi">
            {klien.map((k, i) => (
              <li key={k.id} className="pf__ubin lk-ubin">
                <span className="lk-ubin__logo">
                  {k.logoUrl ? (
                    <img src={k.logoUrl} alt="" onLoad={pasangBentuk} />
                  ) : (
                    <Ikon ikon={ImageSquare} ukuran={28} />
                  )}
                  <span className="lk-ubin__urut">{String(i + 1).padStart(2, "0")}</span>
                </span>
                <span className="lk-ubin__teks">
                  <b>{k.name}</b>
                  <small data-ada={k.logoUrl ? "" : undefined}>
                    <span aria-hidden="true" />
                    {k.logoUrl ? "Logo terpasang" : "Tampil sebagai teks nama"}
                  </small>
                </span>
                <div className="pf__ubinaksi">
                  <TombolIkon
                    ikon={CaretLeft}
                    ukuran="xsmall"
                    jenis="ghost"
                    judul={`Majukan ${k.name}`}
                    disabled={i === 0}
                    onClick={() => geser(i, -1)}
                  />
                  <TombolIkon
                    ikon={CaretRight}
                    ukuran="xsmall"
                    jenis="ghost"
                    judul={`Mundurkan ${k.name}`}
                    disabled={i === klien.length - 1}
                    onClick={() => geser(i, 1)}
                  />
                  <label className="pf__jadisampul lk-ubin__unggah">
                    {mengunggah === k.id ? "Mengunggah…" : k.logoUrl ? "Ganti logo" : "Unggah logo"}
                    <input
                      type="file"
                      className="sr-only"
                      accept="image/png,image/jpeg,image/webp"
                      aria-label={`Pilih logo ${k.name}`}
                      disabled={mengunggah === k.id}
                      onChange={(e) => {
                        const f = e.currentTarget.files?.[0];
                        e.currentTarget.value = "";
                        if (f) unggah(k, f);
                      }}
                    />
                  </label>
                  <span className="lk-ubin__dorong" />
                  {k.logoUrl && (
                    <TombolIkon ikon={X} ukuran="xsmall" jenis="ghost" judul={`Lepas logo ${k.name}`} onClick={() => hapusLogo(k)} />
                  )}
                  <HapusBaris
                    judul={`Hapus ${k.name}?`}
                    keterangan="Klien ini hilang dari beranda. Berkas logonya tetap di penyimpanan."
                    label={`Hapus ${k.name}`}
                    onHapus={() => hapus(k)}
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

/* Dikendalikan: footer Dialog tidak menutup sendiri, dan dialog lama tetap
   terbuka sesudah Tambah — staf yang mengira belum tersimpan menekannya
   lagi, dan kliennya tercatat dua kali. */
function DialogKlien({ urutan, onSelesai }: { urutan: number; onSelesai: () => void }) {
  const toast = useToast();
  const [buka, setBuka] = useState(false);
  const [nama, setNama] = useState("");
  const [kirim, setKirim] = useState(false);

  async function simpan() {
    const n = nama.trim();
    if (!n) return;
    setKirim(true);
    try {
      /* Paling belakang: menaruhnya di depan menggeser beranda tanpa diminta. */
      await buatKlien({ name: n, sortOrder: urutan });
      setBuka(false);
      onSelesai();
      toast({ judul: "Klien ditambahkan", keterangan: `${n} — logonya bisa diunggah dari kartunya.`, nada: "sukses" });
    } catch (e) {
      toast({ judul: "Gagal menambah klien", keterangan: (e as Error).message, nada: "gagal" });
    } finally {
      setKirim(false);
    }
  }

  return (
    <Dialog
      open={buka}
      onOpenChange={(b) => {
        setBuka(b);
        if (b) setNama("");
      }}
      title="Tambah klien"
      description="Nama dulu; logonya bisa diunggah setelah kartunya ada."
      trigger={
        <Tombol ukuran="large" jenis="primary" kiri={Plus}>
          Tambah klien
        </Tombol>
      }
      footer={
        <div className="kd-form__kaki">
          <Tombol memuat={kirim} ukuran="large" jenis="primary" disabled={!nama.trim() || kirim} onClick={simpan}>
            {kirim ? "Menyimpan…" : "Tambah"}
          </Tombol>
        </div>
      }
    >
      <div className="kd-form">
        <Isian
          label="Nama klien"
          placeholder="mis. Elsana Coffee"
          value={nama}
          onChange={(e) => setNama(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") simpan();
          }}
        />
      </div>
    </Dialog>
  );
}

export function LogoKlienKit() {
  return (
    <RequireAuth skeleton={<div className="pas pas--rangka" />}>
      <ToastProvider>
        <Isi />
      </ToastProvider>
    </RequireAuth>
  );
}
