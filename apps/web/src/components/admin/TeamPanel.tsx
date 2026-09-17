import { useEffect, useState } from "react";
import { Icon } from "../ui/Icon";
import { SkeletonTabel } from "../ui/Skeleton";
import { Avatar } from "../ui/misc/Avatar";
import { Dialog, AlertDialog } from "../ui/overlay/Dialog";
import { Select } from "../ui/overlay/Select";
import { InputRupiah } from "../ui/InputRupiah";
import { ToastProvider, useToast } from "../ui/overlay/Toast";
import { DataTable, kolomSkeleton, type Kolom, type Chip } from "../ui/data/DataTable";
import { RequireAuth } from "./RequireAuth";
import {
  daftarTim, tambahAnggotaTim, ubahAnggotaTim, hapusAnggotaTim,
  LABEL_JENIS_ANGGOTA, type AnggotaTim, type JenisAnggota,
  bacaCache, tulisCache, jumlahDiingat,
} from "../../lib/admin";
import { formatRupiah } from "../../lib/format";

/**
 * Tim & Freelancer.
 *
 * Migrasi Fase 01 menambahkan empat kolom — jenis, tarif acuan, telepon, dan
 * aktif — dan API sudah menerimanya sejak saat itu. Yang belum ada cuma
 * tempat mengisinya, jadi keempatnya hanya bisa diubah lewat database. Itu
 * yang diperbaiki di sini; bentuk tabelnya ikut, tapi bukan itu intinya.
 *
 * `kind` bukan label kosmetik: halaman Fee dan Gaji memakainya untuk
 * memutuskan siapa yang wajar digaji bulanan dan siapa yang dibayar per
 * proyek. Salah jenis berarti peringatan di dialog gaji muncul pada orang
 * yang salah.
 */

const JENIS: { value: JenisAnggota; label: string }[] = [
  { value: "partner", label: "Partner" },
  { value: "inti", label: "Freelancer inti" },
  { value: "proyek", label: "Freelancer proyek" },
  { value: "staf", label: "Staf tetap" },
];

function Isi() {
  const toast = useToast();
  const [tim, setTim] = useState<AnggotaTim[] | null>(() => bacaCache<AnggotaTim[]>("tim"));

  function muat() {
    daftarTim().then((d) => { tulisCache("tim", d); setTim(d); }).catch(() => setTim((l) => l ?? []));
  }

  useEffect(muat, []);

  async function ubahAktif(t: AnggotaTim, aktif: boolean) {
    if (!tim) return;
    const sebelum = tim;
    setTim(tim.map((x) => (x.id === t.id ? { ...x, active: aktif } : x)));
    try {
      await ubahAnggotaTim(t.id, { active: aktif });
    } catch (e) {
      setTim(sebelum);
      toast({ judul: "Gagal mengubah status", keterangan: (e as Error).message, nada: "gagal" });
    }
  }

  async function hapus(t: AnggotaTim) {
    try {
      await hapusAnggotaTim(t.id);
      muat();
      toast({ judul: `${t.name} dihapus`, nada: "sukses" });
    } catch (e) {
      /* Postgres menolak menghapus orang yang masih punya baris gaji
         (on delete restrict). Pesannya diteruskan apa adanya, dan saran
         menonaktifkan ditambahkan — itu memang jalan keluarnya. */
      toast({
        judul: "Tidak bisa dihapus",
        keterangan: `${(e as Error).message}. Kalau ia sudah punya riwayat gaji atau fee, nonaktifkan saja — namanya tetap tercetak di catatan lama.`,
        nada: "gagal",
      });
    }
  }

  const kolom: Kolom<AnggotaTim>[] = [
    {
      judul: "Nama",
      gambar: true,
      render: (t) => (
        <span className="row" style={{ gap: "var(--space-3)", flexWrap: "nowrap", minWidth: 0 }}>
          <Avatar name={t.name} size="sm" />
          <span style={{ minWidth: 0 }}>
            <span className="item__title">{t.name}</span>
            <div className="attachment__size">{t.role ?? "peran belum diisi"}</div>
          </span>
        </span>
      ),
    },
    {
      judul: "Jenis", lebar: "8rem",
      render: (t) => <span className="badge">{LABEL_JENIS_ANGGOTA[t.kind]}</span>,
    },
    {
      judul: "Tarif acuan", kelas: "table__num", lebar: "8rem",
      /* "Acuan", bukan "tarif": yang benar-benar dibayar tetap diketik per
         proyek di Keuangan. Kolom ini cuma supaya tidak perlu diingat-ingat. */
      render: (t) => (t.rate ? formatRupiah(t.rate) : <span className="t-faint">—</span>),
    },
    {
      judul: "Telepon", lebar: "9rem",
      render: (t) => (t.phone
        /* .t-tautan, kelas yang memang ada — sama dengan kolom telepon di
           Direktori. Nama karangan sendiri akan tampil sebagai teks biasa
           tanpa satu pun galat (jebakan #5 di CLAUDE.md). */
        ? <a className="t-tautan" href={`https://wa.me/${t.phone.replace(/\D/g, "")}`}
            target="_blank" rel="noreferrer">{t.phone}</a>
        : <span className="t-faint">—</span>),
    },
    {
      judul: "Status", lebar: "8rem",
      render: (t) => (t.active
        ? (
          <button type="button" className="badge badge--ok payroll__status"
            title="Aktif — muncul di dropdown PIC, fee, dan gaji. Klik untuk menonaktifkan."
            onClick={() => ubahAktif(t, false)}>
            <span className="badge__dot" />Aktif
          </button>
        )
        : (
          <button type="button" className="badge payroll__status"
            title="Nonaktif — disembunyikan dari dropdown, tapi namanya tetap tercetak di catatan lama. Klik untuk mengaktifkan."
            onClick={() => ubahAktif(t, true)}>
            Nonaktif
          </button>
        )),
    },
    {
      judul: "Aksi", kelas: "table__actions", lebar: "5rem",
      render: (t) => (
        <span className="table__act">
          <DialogAnggota
            awal={t} onSelesai={muat}
            pemicu={
              <button type="button" className="btn btn--secondary btn--icon btn--boxed"
                aria-label={`Ubah ${t.name}`}>
                <Icon name="edit" size={15} />
              </button>
            }
          />
          <AlertDialog
            destructive
            title={`Hapus ${t.name}?`}
            description="Kalau ia sudah punya riwayat gaji, penghapusan akan ditolak database — nonaktifkan saja. Biaya proyek yang sudah tercatat tidak ikut terhapus; yang hilang cuma namanya."
            confirmLabel="Ya, hapus"
            onConfirm={() => hapus(t)}
            trigger={
              <button type="button" className="btn btn--ghost btn--icon btn--sm btn--hapus"
                aria-label={`Hapus ${t.name}`}>
                <Icon name="trash" size={14} />
              </button>
            }
          />
        </span>
      ),
    },
  ];

  const chips: Chip<AnggotaTim>[] = [
    { id: "aktif", label: "Aktif", cocok: (t) => t.active },
    ...JENIS.map((j) => ({
      id: j.value, label: j.label, cocok: (t: AnggotaTim) => t.kind === j.value && t.active,
    })),
    { id: "nonaktif", label: "Nonaktif", cocok: (t) => !t.active },
  ];

  return (
    <DataTable
      data={tim}
      kunci={(t) => t.id}
      kolom={kolom}
      chips={chips}
      cariPada={(t) => [t.name, t.role, t.phone, LABEL_JENIS_ANGGOTA[t.kind]]}
      placeholderCari="Cari nama, peran, atau nomor…"
      labelCari="Cari anggota"
      satuan="anggota"
      barisSkeleton={jumlahDiingat("tim", 4)}
      bentuk="kartu"
      aksi={
        <DialogAnggota
          onSelesai={muat}
          pemicu={
            <button type="button" className="btn btn--primary btn--lift">
              <Icon name="plus" size={15} />Tambah anggota
            </button>
          }
        />
      }
      kosong={{
        ikon: "team",
        judul: "Belum ada anggota tim",
        keterangan: "Staf tetap maupun freelancer — bukan akun login. Yang didaftarkan di sini bisa dipilih sebagai PIC tugas, penerima fee, dan penerima gaji.",
      }}
    />
  );
}

/* ── Dialog tambah / ubah anggota ─────────────────────────────────────────
 *
 * Satu dialog untuk dua hal. Dua dialog yang isiannya sama persis adalah dua
 * tempat yang harus diingat saat salah satunya diperbaiki.
 */
function DialogAnggota({
  awal, pemicu, onSelesai,
}: { awal?: AnggotaTim; pemicu: React.ReactNode; onSelesai: () => void }) {
  const toast = useToast();
  const [buka, setBuka] = useState(false);
  const [nama, setNama] = useState("");
  const [peran, setPeran] = useState("");
  const [jenis, setJenis] = useState<JenisAnggota>("proyek");
  const [tarif, setTarif] = useState<number | null>(null);
  const [telepon, setTelepon] = useState("");
  const [aktif, setAktif] = useState(true);
  const [kirim, setKirim] = useState(false);

  const ubah = Boolean(awal);
  const siap = nama.trim().length >= 2;

  /* Disetel ulang tiap dibuka, bukan sekali saat dipasang: komponennya tetap
     hidup di antara pembukaan, jadi tanpa ini isian membawa sisa ketikan yang
     batal dari pembukaan sebelumnya. */
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
    if (!siap) return;
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
      if (ubah && awal) await ubahAnggotaTim(awal.id, isi);
      else await tambahAnggotaTim(isi);
      setBuka(false);
      onSelesai();
      toast({ judul: ubah ? "Anggota diperbarui" : "Anggota ditambahkan", nada: "sukses" });
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
      title={ubah ? "Ubah anggota" : "Tambah anggota"}
      description="Staf tetap maupun freelancer — bukan akun login."
      trigger={pemicu}
      footer={
        <button type="button" className="btn btn--primary" disabled={!siap || kirim} onClick={simpan}>
          {kirim && <span className="spinner spinner--sm spinner--on-action" />}Simpan
        </button>
      }
    >
      <div className="stack">
        <div className="spec-grid spec-grid--rapat">
          <div className="field">
            <label className="field__label" htmlFor="tm-nama">
              Nama<span className="field__req" aria-hidden="true">*</span>
            </label>
            <input id="tm-nama" className="input" value={nama}
              onChange={(e) => setNama(e.target.value)} placeholder="Contoh: Rian Saputra" />
          </div>
          <div className="field">
            <label className="field__label" htmlFor="tm-peran">Peran</label>
            <input id="tm-peran" className="input" value={peran}
              onChange={(e) => setPeran(e.target.value)} placeholder="Contoh: Drafter DED" />
          </div>
        </div>

        <div className="field">
          <label className="field__label" htmlFor="tm-jenis">Jenis</label>
          <Select id="tm-jenis" ariaLabel="Jenis anggota" value={jenis}
            onValueChange={(v) => setJenis(v as JenisAnggota)} options={JENIS} />
          <p className="field__help">
            Menentukan siapa yang wajar digaji bulanan dan siapa yang dibayar
            per proyek. Halaman Gaji memperingatkan kalau freelancer diberi
            gaji bulanan, dan peringatan itu membaca kolom ini.
          </p>
        </div>

        <div className="spec-grid spec-grid--rapat">
          <div className="field">
            <label className="field__label" htmlFor="tm-tarif">Tarif acuan</label>
            <InputRupiah id="tm-tarif" value={tarif} onChange={setTarif} />
            <p className="field__help">Pengingat saja, bukan nominal yang mengikat.</p>
          </div>
          <div className="field">
            <label className="field__label" htmlFor="tm-telepon">Telepon</label>
            <input id="tm-telepon" className="input" type="tel" value={telepon}
              onChange={(e) => setTelepon(e.target.value)} placeholder="08…" />
            <p className="field__help">Jadi tautan WhatsApp di tabel.</p>
          </div>
        </div>

        {/* .choice, bentuk yang sudah dipakai kotak Terbitkan di Jurnal. */}
        <label className="choice">
          <input type="checkbox" checked={aktif} onChange={(e) => setAktif(e.target.checked)} />
          <span className="choice__text">
            <span>Aktif</span>
            <span className="choice__desc">
              Yang nonaktif disembunyikan dari dropdown PIC, fee, dan gaji —
              tapi namanya tetap tercetak di catatan lama.
            </span>
          </span>
        </label>
      </div>
    </Dialog>
  );
}

const KOLOM_TIRUAN = kolomSkeleton<AnggotaTim>([
  { judul: "Nama", gambar: true, render: () => null },
  { judul: "Jenis", lebar: "8rem", render: () => null },
  { judul: "Tarif acuan", kelas: "table__num", lebar: "8rem", render: () => null },
  { judul: "Telepon", lebar: "9rem", render: () => null },
  { judul: "Status", lebar: "8rem", render: () => null },
  { judul: "Aksi", kelas: "table__actions", lebar: "5rem", render: () => null },
], "kartu");

export function TeamPanel() {
  return (
    <RequireAuth
      skeleton={
        <div className="kartudaftar">
          <SkeletonTabel baris={jumlahDiingat("tim", 4)} kolom={KOLOM_TIRUAN} />
        </div>
      }
    >
      <ToastProvider><Isi /></ToastProvider>
    </RequireAuth>
  );
}
