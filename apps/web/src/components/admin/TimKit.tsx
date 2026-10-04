import { SorotTeks } from "../kit/Tampilan";
import { KelompokRadio } from "../kit/Formulir";
import { useEffect, useMemo, useState } from "react";
import { RequireAuth } from "./RequireAuth";
import { ToastProvider, useToast } from "../kit/Toast";
import { Dialog } from "../kit/Overlay";
import { SelDua, type KolomTabel } from "../kit/Tabel";
import { Cari, Isian, Sakelar } from "../kit/Isian";
import { Tombol, TombolIkon } from "../kit/Tombol";
import { KartuStatistik } from "../kit/Kartu";
import { Briefcase, IdentificationBadge, NotePencil, Plus, Users } from "../kit/ikon";
import { DaftarKit, PilihTombol, Inisial, HapusBaris } from "./daftarKit";
import {
  daftarTim,
  tambahAnggotaTim,
  ubahAnggotaTim,
  hapusAnggotaTim,
  bacaCache,
  tulisCache,
  LABEL_JENIS_ANGGOTA,
  type AnggotaTim,
  type JenisAnggota,
} from "../../lib/admin";
import { formatRupiah } from "../../lib/format";

/* =============================================================================
   Tim & Freelancer — staf tetap maupun freelancer, bukan akun login.

   Kerangkanya daftar frame 13 (daftarKit.tsx), dengan tiga kartu statistik
   frame 01 di atasnya. Yang dibawa dari halaman lama tanpa berubah:

   - `kind` bukan label kosmetik: Fee dan Gaji memakainya untuk memutuskan
     siapa yang wajar digaji bulanan dan siapa yang dibayar per proyek.
   - Anggota nonaktif TETAP disimpan — namanya harus tetap tercetak di fee
     dan gaji lama — tapi disembunyikan dari saringan bawaan dan tidak ikut
     dihitung di kartu angka. Menghitungnya membuat angkanya naik selamanya.
   - Menghapus orang yang sudah punya riwayat gaji ditolak database; pesan
     galatnya menyarankan menonaktifkan, karena itulah jalan keluarnya.

   Status aktif sekarang SAKELAR di barisnya, bukan lencana yang bisa diklik:
   lencana yang diam-diam jadi tombol tidak terbaca sebagai sesuatu yang
   bisa diubah.
   ============================================================================= */

const JENIS: JenisAnggota[] = ["partner", "inti", "proyek", "staf"];
/* Akibat tiap jenis, dalam satu baris — tampil di bawah pilihannya. */
const KET_JENIS: Record<JenisAnggota, string> = {
  partner: "Ikut memiliki studio",
  inti: "Freelancer langganan studio",
  proyek: "Dibayar per proyek lewat fee",
  staf: "Digaji bulanan",
};

function Isi() {
  const toast = useToast();
  const [tim, setTim] = useState<AnggotaTim[] | null>(() => bacaCache<AnggotaTim[]>("tim"));
  const [cari, setCari] = useState("");
  const [status, setStatus] = useState("aktif");
  const [jenis, setJenis] = useState("semua");

  function muat() {
    daftarTim()
      .then((d) => {
        tulisCache("tim", d);
        setTim(d);
      })
      .catch(() => setTim((l) => l ?? []));
  }
  useEffect(muat, []);

  async function ubahAktif(t: AnggotaTim, aktif: boolean) {
    setTim((l) => l?.map((x) => (x.id === t.id ? { ...x, active: aktif } : x)) ?? l);
    try {
      await ubahAnggotaTim(t.id, { active: aktif });
      toast({
        judul: aktif ? `${t.name} diaktifkan` : `${t.name} dinonaktifkan`,
        keterangan: aktif
          ? "Muncul lagi di pilihan PIC, fee, dan gaji."
          : "Disembunyikan dari pilihan PIC, fee, dan gaji — namanya tetap di catatan lama.",
        nada: "sukses",
      });
    } catch (e) {
      setTim((l) => l?.map((x) => (x.id === t.id ? t : x)) ?? l);
      toast({ judul: "Gagal mengubah status", keterangan: (e as Error).message, nada: "gagal" });
    }
  }

  async function hapus(t: AnggotaTim) {
    try {
      await hapusAnggotaTim(t.id);
      muat();
      toast({ judul: `${t.name} dihapus`, nada: "sukses" });
    } catch (e) {
      toast({
        judul: "Tidak bisa dihapus",
        keterangan: `${(e as Error).message}. Kalau ia sudah punya riwayat gaji atau fee, nonaktifkan saja — namanya tetap tercetak di catatan lama.`,
        nada: "gagal",
      });
    }
  }

  const angka = useMemo(() => {
    const aktif = (tim ?? []).filter((t) => t.active);
    return {
      aktif: aktif.length,
      tetap: aktif.filter((t) => t.kind === "partner" || t.kind === "staf").length,
      lepas: aktif.filter((t) => t.kind === "inti" || t.kind === "proyek").length,
    };
  }, [tim]);

  const tersaring = useMemo(() => {
    const q = cari.trim().toLowerCase();
    return (tim ?? [])
      .filter((t) => (status === "aktif" ? t.active : status === "nonaktif" ? !t.active : true))
      .filter((t) => jenis === "semua" || t.kind === jenis)
      .filter(
        (t) =>
          !q ||
          [t.name, t.role, t.phone, LABEL_JENIS_ANGGOTA[t.kind]].some((v) => (v ?? "").toLowerCase().includes(q)),
      )
      .sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name, "id"));
  }, [tim, cari, status, jenis]);

  const kolom: KolomTabel[] = [
    { judul: "Nama", lebar: 300 },
    { judul: "Jenis", lebar: 170 },
    { judul: "Tarif acuan", lebar: 170, kanan: true },
    { judul: "Telepon", lebar: 200 },
    { judul: "Aktif", lebar: 200 },
    { judul: "", lebar: 120 },
  ];

  const baris = tersaring.map((t) => [
    <div className="kd__sel">
      <Inisial nama={t.name} redup={!t.active} />
      <SelDua atas={<SorotTeks teks={t.name} cari={cari} />} bawah={t.role ?? "Peran belum diisi"} />
    </div>,
    LABEL_JENIS_ANGGOTA[t.kind] ?? t.kind,
    /* "Acuan", bukan "tarif": yang benar-benar dibayar tetap diketik per
       proyek di Keuangan. Kolom ini cuma supaya tidak perlu diingat-ingat. */
    t.rate ? formatRupiah(t.rate) : <span className="kd__redup">—</span>,
    t.phone ? (
      <a className="kd__tautan" href={`https://wa.me/${t.phone.replace(/\D/g, "").replace(/^0/, "62")}`} target="_blank" rel="noreferrer">
        {t.phone}
      </a>
    ) : (
      <span className="kd__redup">—</span>
    ),
    <label className="kd__sakelar">
      <Sakelar judul={`${t.name} aktif`} checked={t.active} onChange={(e) => ubahAktif(t, e.currentTarget.checked)} />
      <span className={t.active ? undefined : "kd__redup"}>{t.active ? "Aktif" : "Nonaktif"}</span>
    </label>,
    <div className="kd__aksi">
      <DialogAnggota
        awal={t}
        onSelesai={muat}
        pemicu={<TombolIkon ikon={NotePencil} ukuran="small" jenis="ghost" judul={`Ubah ${t.name}`} />}
      />
      <HapusBaris
        judul={`Hapus ${t.name}?`}
        keterangan="Kalau ia sudah punya riwayat gaji, penghapusan ditolak database — nonaktifkan saja. Biaya proyek yang sudah tercatat tidak ikut terhapus; yang hilang cuma namanya."
        label={`Hapus ${t.name}`}
        onHapus={() => hapus(t)}
      />
    </div>,
  ]);

  return (
    <>
      <div className="kd-angka">
        <KartuStatistik ikon={Users} judul="Anggota aktif" nilai={tim ? angka.aktif : "—"} />
        <KartuStatistik ikon={IdentificationBadge} judul="Partner & staf tetap — dibayar lewat Gaji" nilai={tim ? angka.tetap : "—"} />
        <KartuStatistik ikon={Briefcase} judul="Freelancer — dibayar lewat fee proyek" nilai={tim ? angka.lepas : "—"} />
      </div>
      <DaftarKit
        kunciSaring={`${cari}|${status}|${jenis}`}
        kiri={
          <>
            <Cari
              ukuran="medium"
              judul="Cari anggota"
              placeholder="Cari anggota"
              value={cari}
              onChange={(e) => setCari(e.currentTarget.value)}
            />
            <PilihTombol
              judul="Saring status"
              nilai={status}
              onPilih={setStatus}
              opsi={[
                { nilai: "aktif", label: "Yang aktif" },
                { nilai: "nonaktif", label: "Nonaktif" },
                { nilai: "semua", label: "Semua status" },
              ]}
            />
            <PilihTombol
              judul="Saring jenis"
              nilai={jenis}
              onPilih={setJenis}
              opsi={[
                { nilai: "semua", label: "Semua jenis" },
                ...JENIS.map((j) => ({ nilai: j, label: LABEL_JENIS_ANGGOTA[j] })),
              ]}
            />
          </>
        }
        kanan={
          <DialogAnggota
            onSelesai={muat}
            pemicu={
              <Tombol ukuran="medium" jenis="primary" kiri={Plus}>
                Tambah anggota
              </Tombol>
            }
          />
        }
        kolom={kolom}
        baris={baris}
        kunci={tersaring.map((t) => t.id)}
        memuat={tim === null}
        teksMemuat="Memuat tim…"
        kosong={
          tim && tim.length > 0
            ? "Tidak ada anggota pada saringan ini."
            : "Belum ada anggota. Yang didaftarkan di sini bisa dipilih sebagai PIC tugas, penerima fee, dan penerima gaji."
        }
        satuan="anggota"
      />
    </>
  );
}

/* Satu dialog untuk tambah DAN ubah — dua dialog berisian sama adalah dua
   tempat yang harus diingat saat salah satunya diperbaiki. */
function DialogAnggota({
  awal,
  pemicu,
  onSelesai,
}: {
  awal?: AnggotaTim;
  pemicu: React.ReactNode;
  onSelesai: () => void;
}) {
  const toast = useToast();
  const [buka, setBuka] = useState(false);
  const [nama, setNama] = useState("");
  const [peran, setPeran] = useState("");
  const [jenis, setJenis] = useState<JenisAnggota>("proyek");
  const [tarif, setTarif] = useState<number | null>(null);
  const [telepon, setTelepon] = useState("");
  const [aktif, setAktif] = useState(true);
  const [kirim, setKirim] = useState(false);
  const alasan = nama.trim().length < 2 ? "Isi nama dulu, minimal 2 huruf." : null;

  /* Disetel ulang tiap dibuka: komponennya tetap hidup di antara pembukaan,
     jadi tanpa ini isian membawa sisa ketikan yang batal. */
  function saatBuka(b: boolean) {
    setBuka(b);
    if (b) {
      setNama(awal?.name ?? "");
      setPeran(awal?.role ?? "");
      setJenis(awal?.kind ?? "proyek");
      setTarif(awal?.rate ?? null);
      setTelepon(awal?.phone ?? "");
      setAktif(awal?.active ?? true);
    }
  }

  async function simpan() {
    if (alasan) return;
    setKirim(true);
    const isi = {
      name: nama.trim(),
      role: peran.trim() || null,
      kind: jenis,
      rate: tarif,
      phone: telepon.trim() || null,
      active: aktif,
    };
    try {
      if (awal) await ubahAnggotaTim(awal.id, isi);
      else await tambahAnggotaTim(isi);
      setBuka(false);
      onSelesai();
      toast({ judul: awal ? "Anggota diperbarui" : "Anggota ditambahkan", keterangan: isi.name, nada: "sukses" });
    } catch (e) {
      toast({ judul: "Gagal menyimpan", keterangan: (e as Error).message, nada: "gagal" });
    } finally {
      setKirim(false);
    }
  }

  return (
    <Dialog
      open={buka}
      onOpenChange={saatBuka}
      title={awal ? `Ubah ${awal.name}` : "Tambah anggota"}
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
        <div className="kd-form__dua">
          <Isian label="Nama" placeholder="mis. Rian Saputra" value={nama} onChange={(e) => setNama(e.currentTarget.value)} />
          <Isian label="Peran" placeholder="mis. Drafter DED" value={peran} onChange={(e) => setPeran(e.currentTarget.value)} />
        </div>
        {/* Radio kit, bukan pilihan turun: empat jenis dengan akibat yang
            berbeda (digaji bulanan atau dibayar per proyek) lebih mudah
            dipilih kalau keempatnya terlihat sekaligus beserta artinya. */}
        <KelompokRadio
          nama="tm-jenis"
          label="Jenis"
          arah="datar"
          nilai={jenis}
          onUbah={(v) => setJenis(v as JenisAnggota)}
          opsi={JENIS.map((j) => ({ nilai: j, label: LABEL_JENIS_ANGGOTA[j], ket: KET_JENIS[j] }))}
        />
        <div className="kd-form__dua">
          <Isian
            label="Tarif acuan (Rp)"
            inputMode="numeric"
            placeholder="0"
            value={tarif === null ? "" : tarif.toLocaleString("id-ID")}
            onChange={(e) => {
              const angka = e.currentTarget.value.replace(/\D/g, "");
              setTarif(angka ? Number(angka) : null);
            }}
          />
          <Isian
            label="Telepon"
            type="tel"
            inputMode="tel"
            placeholder="08…"
            value={telepon}
            onChange={(e) => setTelepon(e.currentTarget.value)}
          />
        </div>
        <label className="kd-form__centang">
          <Sakelar judul="Aktif" checked={aktif} onChange={(e) => setAktif(e.currentTarget.checked)} />
          <span>
            <b>Aktif</b>
            <small>Nonaktif = tidak muncul di pilihan.</small>
          </span>
        </label>
      </div>
    </Dialog>
  );
}

export function TimKit() {
  return (
    <RequireAuth skeleton={<div className="kd" aria-busy="true" />}>
      <ToastProvider>
        <Isi />
      </ToastProvider>
    </RequireAuth>
  );
}
