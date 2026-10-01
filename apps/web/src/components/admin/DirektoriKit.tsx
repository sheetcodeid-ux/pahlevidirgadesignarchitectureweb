import { SorotTeks } from "../kit/Tampilan";
import { PilihAsli } from "../kit/Formulir";
import { useEffect, useMemo, useState } from "react";
import { RequireAuth } from "./RequireAuth";
import { ToastProvider, useToast } from "../kit/Toast";
import { Dialog } from "../kit/Overlay";
import { SelDua, type KolomTabel } from "../kit/Tabel";
import { Cari, Isian } from "../kit/Isian";
import { Tombol } from "../kit/Tombol";
import { Plus } from "../kit/ikon";
import { DaftarKit, PilihTombol, Inisial, HapusBaris } from "./daftarKit";
import {
  daftarKontak,
  tambahKontak,
  ubahKontak,
  hapusKontak,
  bacaCache,
  tulisCache,
  type KontakDirektori,
} from "../../lib/admin";

/* =============================================================================
   Direktori — klien, kontraktor, dan supplier yang dipakai berulang.

   Tidak punya frame sendiri di Coinest; kerangkanya daftar frame 13 yang
   sama dengan Semua Transaksi (daftarKit.tsx). Yang dibawa dari halaman
   lama tanpa berubah: kategori sebagai saringan, catatan yang disunting
   langsung di barisnya (membuka dialog untuk satu baris teks yang sering
   diubah justru memperlambat pekerjaan yang paling sering dilakukan di
   sini), dan telepon/email yang bisa diklik.
   ============================================================================= */

const KATEGORI: Record<string, string> = {
  klien: "Klien",
  kontraktor: "Kontraktor",
  supplier: "Supplier",
  lainnya: "Lainnya",
};

function Isi() {
  const toast = useToast();
  const [kontak, setKontak] = useState<KontakDirektori[] | null>(() => bacaCache<KontakDirektori[]>("direktori"));
  const [cari, setCari] = useState("");
  const [kategori, setKategori] = useState("semua");
  const [urut, setUrut] = useState("nama");

  function muat() {
    daftarKontak()
      .then((d) => {
        tulisCache("direktori", d);
        setKontak(d);
      })
      .catch(() => setKontak((l) => l ?? []));
  }
  useEffect(muat, []);

  async function ubahCatatan(k: KontakDirektori, note: string) {
    if (note === (k.note ?? "")) return;
    setKontak((l) => l?.map((x) => (x.id === k.id ? { ...x, note } : x)) ?? l);
    try {
      await ubahKontak(k.id, { note });
    } catch (e) {
      setKontak((l) => l?.map((x) => (x.id === k.id ? k : x)) ?? l);
      toast({ judul: "Gagal menyimpan catatan", keterangan: (e as Error).message, nada: "gagal" });
    }
  }

  async function hapus(k: KontakDirektori) {
    try {
      await hapusKontak(k.id);
      setKontak((l) => l?.filter((x) => x.id !== k.id) ?? l);
      toast({ judul: "Kontak dihapus", keterangan: k.name, nada: "sukses" });
    } catch (e) {
      toast({ judul: "Gagal menghapus", keterangan: (e as Error).message, nada: "gagal" });
    }
  }

  const tersaring = useMemo(() => {
    const q = cari.trim().toLowerCase();
    return (kontak ?? [])
      .filter((k) => kategori === "semua" || k.category === kategori)
      .filter(
        (k) =>
          !q ||
          [k.name, k.company, k.phone, k.email, k.note].some((v) => (v ?? "").toLowerCase().includes(q)),
      )
      .sort((a, b) =>
        urut === "nama" ? a.name.localeCompare(b.name, "id") : (b.createdAt ?? "").localeCompare(a.createdAt ?? ""),
      );
  }, [kontak, cari, kategori, urut]);

  const kolom: KolomTabel[] = [
    { judul: "Kontak", lebar: 290 },
    { judul: "Kategori", lebar: 110 },
    { judul: "Telepon", lebar: 150 },
    { judul: "Email", lebar: 220 },
    { judul: "Catatan", lebar: 330 },
    { judul: "", lebar: 60 },
  ];

  const baris = tersaring.map((k) => [
    <div className="kd__sel">
      <Inisial nama={k.name} />
      <SelDua atas={<SorotTeks teks={k.name} cari={cari} />} bawah={k.company ? <SorotTeks teks={k.company} cari={cari} /> : "—"} />
    </div>,
    KATEGORI[k.category] ?? k.category,
    k.phone ? (
      <a className="kd__tautan" href={`tel:${k.phone.replace(/[^\d+]/g, "")}`}>
        {k.phone}
      </a>
    ) : (
      <span className="kd__redup">—</span>
    ),
    k.email ? (
      <a className="kd__tautan" href={`mailto:${k.email}`}>
        {k.email}
      </a>
    ) : (
      <span className="kd__redup">—</span>
    ),
    <input
      /* `key` ikut nilai catatannya: defaultValue cuma dibaca sekali, jadi
         tanpa ini catatan yang berubah dari luar tidak pernah tergambar. */
      key={`${k.id}:${k.note ?? ""}`}
      className="kd__isian"
      defaultValue={k.note ?? ""}
      placeholder="Tambah catatan"
      aria-label={`Catatan untuk ${k.name}`}
      onBlur={(e) => ubahCatatan(k, e.currentTarget.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
    />,
    <HapusBaris
      judul={`Hapus ${k.name}?`}
      keterangan="Kontak ini beserta catatannya dihapus dari direktori."
      label={`Hapus ${k.name}`}
      onHapus={() => hapus(k)}
    />,
  ]);

  return (
    <DaftarKit
      kunciSaring={`${cari}|${kategori}|${urut}`}
      kiri={
        <>
          <Cari
            ukuran="medium"
            judul="Cari kontak"
            placeholder="Cari kontak"
            value={cari}
            onChange={(e) => setCari(e.currentTarget.value)}
          />
          <PilihTombol
            judul="Saring kategori"
            nilai={kategori}
            onPilih={setKategori}
            opsi={[
              { nilai: "semua", label: "Semua kategori" },
              ...Object.entries(KATEGORI).map(([nilai, label]) => ({ nilai, label })),
            ]}
          />
          <PilihTombol
            judul="Urutkan kontak"
            nilai={urut}
            onPilih={setUrut}
            opsi={[
              { nilai: "nama", label: "Nama A–Z" },
              { nilai: "baru", label: "Terbaru ditambahkan" },
            ]}
          />
        </>
      }
      kanan={<DialogKontak onSelesai={muat} />}
      kolom={kolom}
      baris={baris}
      kunci={tersaring.map((k) => k.id)}
      memuat={kontak === null}
      teksMemuat="Memuat kontak…"
      kosong={
        kontak && kontak.length > 0
          ? "Tidak ada kontak pada saringan ini."
          : "Belum ada kontak. Klien, kontraktor, atau supplier yang dipakai berulang disimpan di sini."
      }
      satuan="kontak"
    />
  );
}

function DialogKontak({ onSelesai }: { onSelesai: () => void }) {
  const toast = useToast();
  /* Dikendalikan, bukan dibiarkan Radix: footer Dialog tidak menutup
     sendiri, dan staf yang mengira belum tersimpan menekan Simpan dua kali. */
  const [buka, setBuka] = useState(false);
  const [nama, setNama] = useState("");
  const [kategori, setKategori] = useState("klien");
  const [perusahaan, setPerusahaan] = useState("");
  const [telepon, setTelepon] = useState("");
  const [email, setEmail] = useState("");
  const [kirim, setKirim] = useState(false);
  const alasan = nama.trim().length < 2 ? "Isi nama dulu, minimal 2 huruf." : null;

  function saatBuka(b: boolean) {
    setBuka(b);
    if (b) {
      setNama("");
      setKategori("klien");
      setPerusahaan("");
      setTelepon("");
      setEmail("");
    }
  }

  async function simpan() {
    if (alasan) return;
    setKirim(true);
    try {
      await tambahKontak({
        name: nama.trim(),
        category: kategori,
        company: perusahaan.trim() || null,
        phone: telepon.trim() || null,
        email: email.trim() || null,
      });
      setBuka(false);
      onSelesai();
      toast({ judul: "Kontak ditambahkan", keterangan: nama.trim(), nada: "sukses" });
    } catch (e) {
      toast({ judul: "Gagal menambah kontak", keterangan: (e as Error).message, nada: "gagal" });
    } finally {
      setKirim(false);
    }
  }

  return (
    <Dialog
      open={buka}
      onOpenChange={saatBuka}
      title="Tambah kontak"
      description="Klien, kontraktor, atau supplier yang dipakai berulang."
      trigger={
        <Tombol ukuran="medium" jenis="primary" kiri={Plus}>
          Tambah kontak
        </Tombol>
      }
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
        <div className="kd-form__dua">
          <Isian label="Nama" placeholder="mis. Bu Ratna" value={nama} onChange={(e) => setNama(e.currentTarget.value)} />
          <div className="k-isian">
            <label className="k-isian__label" htmlFor="dk-kategori">
              Kategori
            </label>
            <PilihAsli
                id="dk-kategori"
                
                value={kategori}
                onChange={(e) => setKategori(e.currentTarget.value)}
              >
                {Object.entries(KATEGORI).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </PilihAsli>
          </div>
        </div>
        <Isian
          label="Perusahaan"
          placeholder="Opsional"
          value={perusahaan}
          onChange={(e) => setPerusahaan(e.currentTarget.value)}
        />
        <div className="kd-form__dua">
          <Isian
            label="Telepon"
            type="tel"
            inputMode="tel"
            placeholder="Opsional"
            value={telepon}
            onChange={(e) => setTelepon(e.currentTarget.value)}
          />
          <Isian
            label="Email"
            type="email"
            placeholder="Opsional"
            value={email}
            onChange={(e) => setEmail(e.currentTarget.value)}
          />
        </div>
      </div>
    </Dialog>
  );
}

export function DirektoriKit() {
  return (
    <RequireAuth skeleton={<div className="kd" aria-busy="true" />}>
      <ToastProvider>
        <Isi />
      </ToastProvider>
    </RequireAuth>
  );
}
