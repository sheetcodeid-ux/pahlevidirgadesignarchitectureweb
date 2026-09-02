import { useEffect, useMemo, useState } from "react";
import { Icon } from "../ui/Icon";
import { Select } from "../ui/overlay/Select";
import { Sheet } from "../ui/overlay/Dialog";
import { ToastProvider, useToast } from "../ui/overlay/Toast";
import { DataTable, kolomSkeleton, type Kolom, type Chip } from "../ui/data/DataTable";
import { SkeletonTabel } from "../ui/Skeleton";
import { RequireAuth } from "./RequireAuth";
import { daftarPesan, ubahStatusPesan, ambilSettings, type Pesan, bacaCache, tulisCache, jumlahDiingat} from "../../lib/admin";

const STATUS: Record<string, { teks: string; kelas: string }> = {
  new: { teks: "Baru", kelas: "badge--brand" },
  contacted: { teks: "Dihubungi", kelas: "badge--info" },
  qualified: { teks: "Prospek", kelas: "badge--success" },
  closed: { teks: "Selesai", kelas: "" },
};

const JENIS: Record<string, string> = {
  residential: "Hunian", commercial: "Komersial", interior: "Interior",
  landscape: "Lanskap", masterplan: "Masterplan", renovation: "Renovasi",
};

/** Pilihan urutan di panel saringan — sama bentuknya dengan Semua Proyek. */
const URUTAN: { value: string; label: string }[] = [
  { value: "baru", label: "Terbaru" },
  { value: "lama", label: "Terlama" },
  { value: "nama", label: "Nama A–Z" },
];

function tanggal(iso: string) {
  return new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

function Lencana({ status }: { status: string }) {
  const s = STATUS[status];
  return (
    <span className={`badge ${s?.kelas ?? ""}`}>
      {status === "new" && <span className="badge__dot" />}
      {s?.teks ?? status}
    </span>
  );
}

function Isi() {
  const toast = useToast();
  // Seluruh pesan diambil sekali, lalu disaring di klien oleh DataTable.
  // Sebelumnya tiap chip status memanggil API lagi dan punya kunci cache
  // sendiri — dan angka di chip jadi mustahil, karena tiap daftar cuma tahu
  // isi saringannya sendiri.
  const [pesan, setPesan] = useState<Pesan[] | null>(() => bacaCache<Pesan[]>("pesan:"));
  const [galat, setGalat] = useState<string | null>(null);
  const [urut, setUrut] = useState("baru");
  const [jenis, setJenis] = useState("semua");
  // null selama belum diketahui, supaya spanduknya tidak berkedip muncul
  // lalu hilang setiap kali halaman dibuka.
  const [notifAktif, setNotifAktif] = useState<boolean | null>(null);

  useEffect(() => {
    daftarPesan()
      .then((daftar) => { tulisCache("pesan:", daftar); setPesan(daftar); })
      .catch((e) => setGalat((e as Error).message));
  }, []);

  useEffect(() => {
    ambilSettings()
      .then((s) => setNotifAktif(s.notifikasiEmailAktif !== false))
      .catch(() => setNotifAktif(null));
  }, []);

  async function ubah(p: Pesan, status: string) {
    try {
      await ubahStatusPesan(p.id, status);
      setPesan((cur) => cur?.map((x) => (x.id === p.id ? { ...x, status } : x)) ?? null);
      toast({ judul: "Status diperbarui", keterangan: `${p.name} → ${STATUS[status].teks}`, nada: "sukses" });
    } catch (e) {
      toast({ judul: "Gagal memperbarui", keterangan: (e as Error).message, nada: "gagal" });
    }
  }

  const kolom: Kolom<Pesan>[] = useMemo(() => [
    {
      judul: "Pengirim",
      render: (p) => (
        <span className="row" style={{ gap: "var(--space-3)", flexWrap: "nowrap" }}>
          <span className="pcard__thumb"><Icon name="inquiry" size={18} /></span>
          <span style={{ minWidth: 0 }}>
            <span className="item__title">{p.name}</span>
            <div className="attachment__size">{p.email}</div>
          </span>
        </span>
      ),
      gambar: true,
    },
    { judul: "Jenis", lebar: "5rem", render: (p) => (p.projectType ? JENIS[p.projectType] ?? p.projectType : "—") },
    { judul: "Anggaran", lebar: "6rem", render: (p) => p.budgetRange || "—" },
    { judul: "Tanggal", kelas: "table__num", lebar: "5rem", render: (p) => tanggal(p.createdAt) },
    { judul: "Status", lebar: "4rem", render: (p) => <Lencana status={p.status} /> },
    {
      judul: "Aksi",
      kelas: "table__actions",
      lebar: "3.5rem",
      render: (p) => (
        <span className="table__act">
          <Sheet
            title={p.name}
            description={`${p.email} · ${tanggal(p.createdAt)}`}
            trigger={
              <button type="button" className="btn btn--secondary btn--icon btn--boxed"
                aria-label={`Buka pesan dari ${p.name}`}>
                <Icon name="document" size={15} />
              </button>
            }
            footer={
              <a className="btn btn--primary" href={`mailto:${p.email}?subject=${encodeURIComponent("Balasan dari Studio Dirga Pahlevi Architecture")}`}>
                Balas lewat email
              </a>
            }
          >
            <div className="stack">
              <div className="bubble">{p.message}</div>
              <dl className="stack" style={{ gap: "var(--space-2)" }}>
                {[
                  ["Telepon", p.phone],
                  ["Jenis proyek", p.projectType ? JENIS[p.projectType] : undefined],
                  ["Anggaran", p.budgetRange],
                ]
                  .filter(([, v]) => v)
                  .map(([k, v]) => (
                    <div className="row row--between" key={String(k)}>
                      <dt className="t-label" style={{ margin: 0 }}>{k}</dt>
                      <dd className="t-body" style={{ margin: 0 }}>{v}</dd>
                    </div>
                  ))}
              </dl>

              <span className="t-label">Ubah status</span>
              <div className="segmented segmented--block" role="group" aria-label="Ubah status pesan">
                {Object.entries(STATUS).map(([v, s]) => (
                  <button key={v} type="button" className="segmented__opt"
                    aria-pressed={p.status === v} onClick={() => ubah(p, v)}>
                    {s.teks}
                  </button>
                ))}
              </div>
            </div>
          </Sheet>
        </span>
      ),
    },
  ], []);

  const chips: Chip<Pesan>[] = [
    { id: "semua", label: "Semua" },
    ...Object.entries(STATUS).map(([v, s]) => ({
      id: v, label: s.teks, cocok: (p: Pesan) => p.status === v,
    })),
  ];

  if (galat) {
    return (
      <div className="alert alert--danger" role="alert">
        <span className="alert__icon"><Icon name="alert" size={18} /></span>
        <span className="alert__body">
          <span className="alert__title">Gagal memuat pesan</span>
          <span className="alert__text">{galat}</span>
        </span>
      </div>
    );
  }

  // Urutan dan saringan jenis dikerjakan di sini; pencarian dan chip status
  // milik DataTable. Disalin dulu karena sort mengubah array aslinya, dan
  // array itu datang langsung dari state.
  const terurut = pesan
    ?.filter((p) => jenis === "semua" || p.projectType === jenis)
    .slice()
    .sort((a, b) => {
      if (urut === "nama") return a.name.localeCompare(b.name, "id");
      const arah = urut === "lama" ? 1 : -1;
      return arah * (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0);
    }) ?? null;

  return (
    <div className="stack" style={{ gap: "var(--space-5)" }}>
      {notifAktif === false && (
        <div className="alert alert--warn" role="status">
          <span className="alert__icon"><Icon name="alert" size={18} /></span>
          <span className="alert__body">
            <span className="alert__title">Pemberitahuan email mati</span>
            <span className="alert__text">
              Pesan masuk tetap tersimpan dan tampil di sini, tapi tidak ada email
              yang dikirim ke studio. Setel rahasia Worker RESEND_API_KEY dan
              INQUIRY_NOTIFY_TO untuk menghidupkannya.
            </span>
          </span>
        </div>
      )}

      <DataTable
        data={terurut}
        kunci={(p) => p.id}
        kolom={kolom}
        chips={chips}
        cariPada={(p) => [p.name, p.email, p.phone, p.message, p.budgetRange]}
        placeholderCari="Cari nama, email, telepon, atau isi pesan…"
        labelCari="Cari pesan"
        satuan="pesan"
        barisSkeleton={jumlahDiingat("pesan:", 6)}
        saringan={
          <>
            <div className="field">
              <label className="field__label">Urutkan</label>
              <Select ariaLabel="Urutkan pesan" options={URUTAN} value={urut} onValueChange={setUrut} />
            </div>
            <div className="field">
              <label className="field__label">Jenis proyek</label>
              <Select
                ariaLabel="Saring jenis proyek"
                value={jenis}
                onValueChange={setJenis}
                options={[
                  { value: "semua", label: "Semua jenis" },
                  ...Object.entries(JENIS).map(([v, l]) => ({ value: v, label: l })),
                ]}
              />
            </div>
          </>
        }
        bersihkanAktif={urut !== "baru" || jenis !== "semua"}
        onBersihkan={() => { setUrut("baru"); setJenis("semua"); }}
        kosong={{
          ikon: "inquiry",
          judul: "Belum ada pesan masuk",
          keterangan: "Pesan dari form kontak akan muncul di sini, dan salinannya dikirim ke email studio.",
        }}
      />
    </div>
  );
}

/** Kolom skeleton diturunkan dari bentuk tabelnya, bukan ditulis ulang. */
const KOLOM_TIRUAN = kolomSkeleton<Pesan>([
  { judul: "Pengirim", gambar: true, render: () => null },
  { judul: "Jenis", lebar: "5rem", render: () => null },
  { judul: "Anggaran", lebar: "6rem", render: () => null },
  { judul: "Tanggal", kelas: "table__num", lebar: "5rem", render: () => null },
  { judul: "Status", lebar: "4rem", render: () => null },
  { judul: "Aksi", kelas: "table__actions", lebar: "3.5rem", render: () => null },
]);

export function InquiryList() {
  return (
    <RequireAuth
      skeleton={
        <div className="listpage"><div className="listpage__pad">
          <SkeletonTabel baris={jumlahDiingat("pesan:", 6)} kolom={KOLOM_TIRUAN} />
        </div></div>
      }
    >
      <ToastProvider><Isi /></ToastProvider>
    </RequireAuth>
  );
}
